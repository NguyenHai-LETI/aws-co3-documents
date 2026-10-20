// [L] The learning view of the answer history. Result files are never rewritten — this returns annotated copies:
// - Item versioning: answers given before the answer key changed are re-graded against the current key for every
//   learning computation (states, FSRS, stats, pools, snapshot). A re-graded answer carries the current key (so
//   pick/key/ok stay consistent for every consumer) and `regraded: true`; the key it was graded with is still in the
//   result file (GET /api/results/:id serves the stored attempt).
// - `unviewed`: no pick and t = 0 — the question was never shown long enough to answer. Not a review: FSRS, question
//   states, pools, the daily cap, readiness, buckets, forecast and insights skip it (it still counts as wrong in the
//   attempt's own score).
// - `exposure`: 1 = the first time the learner answered this question, 2 = the second time, … — counted in
//   chronological order (finish time, then file order, like computeStates) over viewed answers of non-rushed attempts.
// - `recognized`: a repeat (exposure ≥ 2) answered correctly faster than reading the stem + options at
//   stats.recognized_wpm — likely recognition of a known item rather than reasoning. FSRS caps its grade at "good" and
//   readiness weighs it × RECOGNIZED_WEIGHT.
// - `seenBefore` (never-viewed answers of non-rushed attempts): the question had a viewed answer earlier — the result
//   page counts it as "đã gặp", otherwise as a first-time question answered wrong (never an exposure itself).
import type { AppConfig } from '../config.ts';
import type { BankState } from './bank.ts';
import { isCorrect, normalizeKeys } from '../../shared/scoring.ts';
import { countWords } from '../../shared/timing.ts';
import type { AnswerRecord, Attempt, Question, ResultAnnotations } from '../../shared/types.ts';

/** stats.recognized_wpm when no config is passed (same as the config default). */
export const DEFAULT_RECOGNIZED_WPM = 300;

// Cache by input identity + bank version + reading speed: loadAttempts returns the same array while no result file changed.
const cache = new WeakMap<Attempt[], { key: string; out: Attempt[] }>();
const keyCache = new WeakMap<BankState, Map<string, string>>();
const wordCache = new WeakMap<Question, number>();

/** Current normalized answer key per question id ("B", "BD"). */
function currentKeys(bank: BankState): Map<string, string> {
  let m = keyCache.get(bank);
  if (!m) {
    m = new Map(bank.questions.map((q) => [q.id, normalizeKeys(q.answer)]));
    keyCache.set(bank, m);
  }
  return m;
}

/** Option letters of a stored key, normalized ("d, b" → "BD"). */
const letters = (k: string) => normalizeKeys([...k].filter((c) => /[a-z]/i.test(c)));

/** The answer re-graded against `key` (the current answer key), or the same object when the key did not change. */
export function regradeAnswer(r: AnswerRecord, key: string | undefined): AnswerRecord {
  if (!key || r.key === key || letters(r.key) === key) return r;
  return { ...r, key, ok: isCorrect(r.pick, key), regraded: true };
}

/** Never viewed: no pick and no time spent — not a review (see the header). */
export function isUnviewed(r: Pick<AnswerRecord, 'pick' | 't'>): boolean {
  return !r.pick && !(r.t > 0);
}

/** Words the learner has to read for a question: stem + every option. */
export function readingWords(q: Question): number {
  let n = wordCache.get(q);
  if (n === undefined) {
    n = countWords(q.stem) + q.options.reduce((s, o) => s + countWords(o.text), 0);
    wordCache.set(q, n);
  }
  return n;
}

/** Seconds below which a correct repeat counts as recognition: reading time of stem + options at `wpm`. */
export function recognitionSeconds(q: Question, wpm: number): number {
  return wpm > 0 ? (readingWords(q) / wpm) * 60 : 0;
}

/** Copy of `r` with exactly these computed flags (same object when nothing changes). */
function withFlags(r: AnswerRecord, unviewed: boolean, exposure: number | undefined, recognized: boolean, seenBefore: boolean): AnswerRecord {
  if (!!r.unviewed === unviewed && r.exposure === exposure && !!r.recognized === recognized && !!r.seenBefore === seenBefore) return r;
  const { unviewed: _u, exposure: _e, recognized: _r, seenBefore: _s, ...rest } = r;
  const next: AnswerRecord = { ...rest };
  if (unviewed) next.unviewed = true;
  if (exposure !== undefined) next.exposure = exposure;
  if (recognized) next.recognized = true;
  if (seenBefore) next.seenBefore = true;
  return next;
}

/**
 * Attempts as the learning engine sees them: re-graded against the current answer keys and annotated with
 * `unviewed` / `exposure` / `recognized` / `seenBefore` (see the header). Copies only — the input is never mutated. Unchanged answers
 * and attempts keep their identity, so an already annotated history comes back as the same array (idempotent).
 * `cfg` supplies stats.recognized_wpm (default DEFAULT_RECOGNIZED_WPM).
 */
export function regradeAttempts(attempts: Attempt[], bank: BankState, cfg?: Pick<AppConfig, 'stats'>): Attempt[] {
  const wpm = Number(cfg?.stats?.recognized_wpm ?? DEFAULT_RECOGNIZED_WPM) || 0;
  const key = `${bank.version}|${wpm}`;
  const hit = cache.get(attempts);
  if (hit && hit.key === key) return hit.out;
  const keys = currentKeys(bank);
  // 1. answers re-graded against the current key (copy on change)
  const graded = attempts.map((a) => {
    let answers: AnswerRecord[] | undefined;
    a.answers.forEach((r, i) => {
      const next = regradeAnswer(r, keys.get(r.q));
      if (next === r) return;
      answers ??= [...a.answers];
      answers[i] = next;
    });
    return answers ? { ...a, answers } : a;
  });
  // 2. computed flags, numbering exposures in chronological order (finish time, then position — like computeStates)
  const order = graded.map((a, i) => ({ i, at: Date.parse(a.finished) || 0 })).sort((x, y) => x.at - y.at || x.i - y.i);
  const seen = new Map<string, number>();
  const out = [...graded];
  let changed = graded.some((a, i) => a !== attempts[i]);
  for (const { i } of order) {
    const a = graded[i];
    let answers: AnswerRecord[] | undefined;
    a.answers.forEach((r, j) => {
      const unviewed = isUnviewed(r);
      let exposure: number | undefined;
      let recognized = false;
      let seenBefore = false;
      if (!unviewed && !a.rushed) {
        exposure = (seen.get(r.q) ?? 0) + 1;
        seen.set(r.q, exposure);
        const q = bank.byId.get(r.q);
        recognized = exposure >= 2 && r.ok && !!r.pick && r.t > 0 && !!q && r.t < recognitionSeconds(q, wpm);
      } else if (unviewed && !a.rushed) {
        seenBefore = (seen.get(r.q) ?? 0) > 0; // not an exposure: the count does not move
      }
      const next = withFlags(r, unviewed, exposure, recognized, seenBefore);
      if (next === r) return;
      answers ??= [...a.answers];
      answers[j] = next;
    });
    if (answers) {
      out[i] = { ...a, answers };
      changed = true;
    }
  }
  const result = changed ? out : attempts;
  cache.set(attempts, { key, out: result });
  // an annotated history passed back in (e.g. computeStats on context().attempts) is already final
  if (result !== attempts) cache.set(result, { key, out: result });
  return result;
}

/** Answers marked `regraded` (optionally only in non-rushed attempts); never-viewed blanks are not answers. */
export function countRegraded(attempts: Attempt[], opts: { includeRushed?: boolean } = {}): number {
  let n = 0;
  for (const a of attempts) if (opts.includeRushed || !a.rushed) for (const r of a.answers) if (r.regraded && !isUnviewed(r)) n++;
  return n;
}

/**
 * Annotations for the result page from the annotated (regradeAttempts) version of an attempt. `stored` = the attempt as
 * graded at the time (default: the annotated one) — the `fresh` split uses its `ok` / `scored`, like the page's score.
 * fresh: every scored answer is either "seen before" (a repeat, or a never-viewed question answered earlier) or first-time
 * (never-viewed first-time questions count as wrong, as in the score). No split for a rushed attempt: its answers are
 * not part of the exposure history.
 */
export function resultAnnotations(annotated: Attempt | undefined, stored: Attempt | undefined = annotated): ResultAnnotations {
  const out: ResultAnnotations = { exposure: {}, recognized: [], unviewed: [] };
  if (!annotated) return out;
  for (const r of annotated.answers) {
    if (r.exposure !== undefined) out.exposure[r.q] = r.exposure;
    if (r.recognized) out.recognized.push(r.q);
    if (r.unviewed) out.unviewed.push(r.q);
  }
  if (annotated.rushed || stored?.rushed) return out;
  const learning = new Map(annotated.answers.map((r) => [r.q, r]));
  const scored = (stored ?? annotated).answers.filter((r) => r.scored !== false);
  const fresh = { total: scored.length, seenBefore: 0, answers: 0, correct: 0 };
  for (const r of scored) {
    const l = learning.get(r.q);
    if (!l) continue;
    if (l.unviewed ? l.seenBefore : (l.exposure ?? 1) >= 2) fresh.seenBefore++;
    else {
      fresh.answers++;
      if (r.ok && !l.unviewed) fresh.correct++;
    }
  }
  out.fresh = fresh;
  return out;
}
