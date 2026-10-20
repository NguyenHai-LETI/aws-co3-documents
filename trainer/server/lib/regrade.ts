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
// [v5] Self-graded answers (`grade`: listen mode, Anki import) are always viewed, never re-graded (their `ok` is the
//   learner's own grade ≥ 3) and never "recognized"; in-session relearning retries (`relearn`) and the blanks of a
//   stopped-early test (`skipped`) are not exposures; answers from chat / micro breaks (attempt `source`) are never
//   "recognized" (their time is not reading time).
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

/** The answer re-graded against `key` (the current answer key), or the same object when the key did not change (or self-graded). */
export function regradeAnswer(r: AnswerRecord, key: string | undefined): AnswerRecord {
  if (!key || r.key === key || letters(r.key) === key || r.grade !== undefined) return r;
  return { ...r, key, ok: isCorrect(r.pick, key), regraded: true };
}

/** Never viewed: no pick, no time spent and no self-grade — not a review (see the header). */
export function isUnviewed(r: Pick<AnswerRecord, 'pick' | 't' | 'grade'>): boolean {
  return !r.pick && !(r.t > 0) && !r.grade;
}

/**
 * [v5] A real answer to the question: viewed, not a blank left when the learner stopped early (`skipped`), not an
 * in-session relearning retry (`relearn`). Only these are FSRS reviews of their own question and exposures.
 */
export function isAnswer(r: Pick<AnswerRecord, 'pick' | 't' | 'grade' | 'skipped' | 'relearn'>): boolean {
  return !r.skipped && !r.relearn && !isUnviewed(r);
}

/** [v5] Self-graded (listen mode, Anki import): no recorded pick — kept out of readiness, accuracy and speed statistics. */
export function isSelfGraded(r: Pick<AnswerRecord, 'grade'>, a?: Pick<Attempt, 'source'>): boolean {
  return r.grade !== undefined || a?.source === 'anki' || a?.source === 'listen';
}

/**
 * [v5] Why an attempt is not a readiness sample (undefined = it is one): retests are asked minutes after the
 * explanation, self-graded sources have no recorded pick.
 */
export function notReadinessReason(a: Pick<Attempt, 'mode' | 'source'>): string | undefined {
  if (a.mode === 'retest') return 'Bài kiểm tra lại ngay sau khi chữa: không tính vào mức sẵn sàng (trả lời ngay sau khi xem giải thích).';
  if (a.source === 'anki') return 'Lượt ôn trên Anki tự chấm: không tính vào mức sẵn sàng và xác suất đỗ.';
  if (a.source === 'listen') return 'Chế độ nghe tự chấm: không tính vào mức sẵn sàng và xác suất đỗ.';
  return undefined;
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
      if (!unviewed && !a.rushed && !r.skipped && !r.relearn) {
        exposure = (seen.get(r.q) ?? 0) + 1;
        seen.set(r.q, exposure);
        const q = bank.byId.get(r.q);
        recognized = exposure >= 2 && r.ok && !!r.pick && r.grade === undefined && !a.source && r.t > 0 && !!q && r.t < recognitionSeconds(q, wpm);
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

/** Answers marked `regraded` (optionally only in non-rushed attempts); never-viewed blanks, skipped blanks and relearning retries are not answers. */
export function countRegraded(attempts: Attempt[], opts: { includeRushed?: boolean } = {}): number {
  let n = 0;
  for (const a of attempts) if (opts.includeRushed || !a.rushed) for (const r of a.answers) if (r.regraded && isAnswer(r)) n++;
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
    if (r.relearn || r.skipped) continue;
    if (r.exposure !== undefined) out.exposure[r.q] = r.exposure;
    if (r.recognized) out.recognized.push(r.q);
    if (r.unviewed) out.unviewed.push(r.q);
  }
  newCaseAnnotations(out, stored ?? annotated, annotated);
  if (annotated.rushed || stored?.rushed) return out;
  // the first (graded) record per question: relearning retries and skipped blanks are not part of the score
  const learning = new Map<string, AnswerRecord>();
  for (const r of annotated.answers) if (!r.relearn && !r.skipped && !learning.has(r.q)) learning.set(r.q, r);
  const scored = (stored ?? annotated).answers.filter((r) => r.scored !== false && !r.relearn && !r.skipped);
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

/**
 * [v5] Annotations of the new record kinds, from the stored attempt (`stored`, as graded) and its learning view:
 * stopped early (session size, graded answers, viewed blanks), skipped blanks, relearning retries, `for` substitutions,
 * a retest's still-wrong questions, and why the attempt is not a readiness sample. GET /api/results/:id adds the
 * cross-attempt parts (the retested attempt's title, `retested`).
 */
function newCaseAnnotations(out: ResultAnnotations, stored: Attempt, annotated: Attempt): void {
  const skipped = stored.answers.filter((r) => r.skipped).map((r) => r.q);
  if (skipped.length) out.skipped = skipped;
  if (stored.stoppedEarly) {
    const answered = stored.answers.filter((r) => !r.skipped && !r.relearn && r.scored !== false && (!!r.pick || r.grade !== undefined)).length;
    out.stoppedEarly = { planned: stored.planned ?? stored.answers.filter((r) => !r.relearn).length, answered, skipped: skipped.length };
  }
  const relearn = annotated.answers.filter((r) => r.relearn).map((r) => ({ q: r.q, ok: r.ok }));
  if (relearn.length) out.relearn = relearn;
  const swaps = stored.answers.filter((r) => r.for && !r.relearn);
  if (swaps.length) out.for = Object.fromEntries(swaps.map((r) => [r.q, r.for!]));
  if (stored.mode === 'retest' && stored.retestOf) {
    const graded = new Map<string, AnswerRecord>();
    for (const r of annotated.answers) if (!r.relearn && !r.skipped && !graded.has(r.q)) graded.set(r.q, r);
    out.retest = { of: stored.retestOf, misses: [...graded.values()].filter((r) => !r.ok && !isUnviewed(r)).map((r) => r.q) };
  }
  const reason = notReadinessReason(stored);
  if (reason) out.notReadiness = reason;
}
