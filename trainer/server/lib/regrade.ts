// [L] Item versioning: answers given before the answer key changed are re-graded against the current key for every
// learning computation (states, FSRS, stats, pools, snapshot). Result files are never rewritten — this returns copies.
// A re-graded answer carries the current key (so pick/key/ok stay consistent for every consumer) and `regraded: true`;
// the key it was graded with is still in the result file (GET /api/results/:id serves the stored attempt).
import type { BankState } from './bank.ts';
import { isCorrect, normalizeKeys } from '../../shared/scoring.ts';
import type { AnswerRecord, Attempt } from '../../shared/types.ts';

// Cache by input identity + bank version: loadAttempts returns the same array while no result file changed.
const cache = new WeakMap<Attempt[], { version: string; out: Attempt[] }>();
const keyCache = new WeakMap<BankState, Map<string, string>>();

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

/**
 * Attempts whose answers count against the current answer keys. Unchanged attempts (and the whole array when nothing
 * needs re-grading) keep their identity, so identity-keyed caches downstream keep working.
 */
export function regradeAttempts(attempts: Attempt[], bank: BankState): Attempt[] {
  const hit = cache.get(attempts);
  if (hit && hit.version === bank.version) return hit.out;
  const keys = currentKeys(bank);
  let changed = false;
  const out = attempts.map((a) => {
    let answers: AnswerRecord[] | undefined;
    a.answers.forEach((r, i) => {
      const next = regradeAnswer(r, keys.get(r.q));
      if (next === r) return;
      answers ??= [...a.answers];
      answers[i] = next;
    });
    if (!answers) return a;
    changed = true;
    return { ...a, answers };
  });
  const result = changed ? out : attempts;
  cache.set(attempts, { version: bank.version, out: result });
  return result;
}

/** Answers marked `regraded` (optionally only in non-rushed attempts). */
export function countRegraded(attempts: Attempt[], opts: { includeRushed?: boolean } = {}): number {
  let n = 0;
  for (const a of attempts) if (opts.includeRushed || !a.rushed) for (const r of a.answers) if (r.regraded) n++;
  return n;
}
