// FSRS-6 spaced-repetition model (open-spaced-repetition, ts-fsrs 5.x), recomputed from the answer history on every
// request — no scheduler state is stored anywhere (personal parameters aside, see fsrs-optimize.ts).
// Day-scale reviews: the elapsed time is counted in whole local calendar days; a second answer on the same day uses the
// FSRS-6 short-term stability rule (w17–w19). No fuzz.
//   R(t,S) = (1 + F·t/S)^(−w20), F = 0.9^(−1/w20) − 1      recall probability t days after the last review
//   I(S,r) = S/F · (r^(−1/w20) − 1)                          interval that brings R down to the desired retention r
// With r = 0.9 the interval equals the stability (that is how F is chosen).
import { FSRSAlgorithm, computeDecayFactor, default_w, forgetting_curve, generatorParameters } from 'ts-fsrs';
import type { AnswerRecord } from '../../shared/types.ts';

export const FSRS_VERSION = 'fsrs-6';
/** FSRS-6 default parameters w0…w20 (ts-fsrs, trained on the open-spaced-repetition dataset). */
export const FSRS_WEIGHTS: readonly number[] = default_w;
/** Longest interval the scheduler will ever produce (days). */
export const MAX_INTERVAL_DAYS = 36500;

/** 1 = again (wrong), 2 = hard, 3 = good, 4 = easy. */
export type Grade = 1 | 2 | 3 | 4;

export interface MemoryState {
  stability: number; // days until R drops to 90 %
  difficulty: number; // 1..10
}

const DAY_MS = 86_400_000;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const clampRetention = (r: number) => clamp(Number.isFinite(r) ? r : 0.9, 0.5, 0.99);

/**
 * A usable FSRS-6 parameter vector: 21 finite numbers, or a 17/19-number FSRS-4.5/5 vector migrated by ts-fsrs.
 * Anything else → undefined (caller falls back to the next parameter source).
 */
export function normalizeWeights(w: unknown): number[] | undefined {
  if (!Array.isArray(w) || ![17, 19, 21].includes(w.length)) return undefined;
  const nums = w.map(Number);
  if (!nums.every(Number.isFinite)) return undefined;
  return generatorParameters({ w: nums }).w as number[];
}

// One ts-fsrs core per (parameters, retention) — the parameter sets in use change rarely.
const algorithms = new Map<string, FSRSAlgorithm>();
function algorithm(w: readonly number[], desiredRetention: number): FSRSAlgorithm {
  const key = `${clampRetention(desiredRetention)}|${w.join(',')}`;
  let a = algorithms.get(key);
  if (!a) {
    if (algorithms.size > 16) algorithms.clear();
    a = new FSRSAlgorithm({
      w: [...w],
      request_retention: clampRetention(desiredRetention),
      maximum_interval: MAX_INTERVAL_DAYS,
      enable_fuzz: false,
      enable_short_term: true,
    });
    algorithms.set(key, a);
  }
  return a;
}

/** FSRS-6 operations for one parameter set + desired retention (get it once per computation, not per answer). */
export interface Scheduler {
  /** One review: `prev` undefined = first answer; `days` = whole days since the previous answer (0 = same day). */
  review(prev: MemoryState | undefined, g: Grade, days: number): MemoryState;
  /** Recall probability `days` after the last review. */
  recall(days: number, stability: number): number;
  /** Scheduled interval in whole days (≥ 1), rounded like the ts-fsrs scheduler (no fuzz). */
  interval(stability: number): number;
}

export function scheduler(w: readonly number[] = FSRS_WEIGHTS, desiredRetention = 0.9): Scheduler {
  const a = algorithm(w, desiredRetention);
  return {
    review(prev, g, days) {
      const next = a.next_state(prev ?? null, Math.max(0, Math.round(days)), g);
      return { stability: next.stability, difficulty: next.difficulty };
    },
    recall: (days, stability) => (stability > 0 ? a.forgetting_curve(Math.max(0, days), stability) : 0),
    interval: (stability) => a.next_interval(stability, 0),
  };
}

export function retrievability(elapsedDays: number, stability: number, w: readonly number[] = FSRS_WEIGHTS): number {
  if (!(stability > 0)) return 0;
  return forgetting_curve(w, Math.max(0, elapsedDays), stability);
}

/** Days until R(t, S) falls to `desiredRetention` (not rounded, not clamped to ≥ 1). */
export function intervalDays(stability: number, desiredRetention = 0.9, w: readonly number[] = FSRS_WEIGHTS): number {
  const { decay, factor } = computeDecayFactor(w);
  return Math.min(MAX_INTERVAL_DAYS, (stability / factor) * (Math.pow(clampRetention(desiredRetention), 1 / decay) - 1));
}

/** Scheduled interval in whole days (≥ 1), exactly as the ts-fsrs scheduler rounds it (no fuzz). */
export function nextIntervalDays(stability: number, desiredRetention = 0.9, w: readonly number[] = FSRS_WEIGHTS): number {
  return algorithm(w, desiredRetention).next_interval(stability, 0);
}

/**
 * Applies one review. `prev` undefined = first time the question is answered; `elapsedDays` = whole days since the
 * previous answer (0 = same day → short-term stability). Delegates to ts-fsrs `FSRSAlgorithm.next_state`.
 */
export function review(prev: MemoryState | undefined, g: Grade, elapsedDays: number, w: readonly number[] = FSRS_WEIGHTS): MemoryState {
  return scheduler(w).review(prev, g, elapsedDays);
}

/**
 * Grade of one recorded answer:
 *   wrong / unanswered → 1 · correct but unsure, hinted, struck a correct option or slower than 1.5× the estimate → 2
 *   correct, confident and faster than half the estimate → 4, unless `recognized` (a repeat answered faster than the
 *   question can be read — recognition, not recall: capped at 3) · otherwise → 3
 * Never-viewed answers (no pick, t = 0) are not reviews at all: callers skip them (regrade.ts isUnviewed).
 */
export function gradeAnswer(r: Pick<AnswerRecord, 'ok' | 'pick' | 'key' | 't' | 'est' | 'unsure' | 'hinted' | 'elim' | 'recognized'>): Grade {
  if (!r.ok || !r.pick) return 1;
  const struckCorrect = !!r.elim && [...r.elim].some((k) => r.key.includes(k));
  if (r.unsure || r.hinted || struckCorrect || (r.est > 0 && r.t > 1.5 * r.est)) return 2;
  if (!r.recognized && r.est > 0 && r.t > 0 && r.t < 0.5 * r.est) return 4;
  return 3;
}

/**
 * [v5] Grade the scheduler (computeStates) uses for one review — gradeAnswer extended for the v5 records:
 *   `grade` (self-graded: listen mode, Anki import) → that grade itself;
 *   `timed: false` (answers from chat / micro breaks: the time is not exam reading time) → no "easy" for speed and no
 *   "hard" for slowness; `cap` (relearning retries and retests, asked minutes after the explanation) → at most that grade.
 * gradeAnswer itself is unchanged: it stays the FSRS optimizer's view of the raw review log (fsrs-optimize.ts).
 */
export function reviewGrade(
  r: Pick<AnswerRecord, 'ok' | 'pick' | 'key' | 't' | 'est' | 'unsure' | 'hinted' | 'elim' | 'recognized' | 'grade'>,
  opts: { timed?: boolean; cap?: Grade } = {},
): Grade {
  let g: Grade = r.grade !== undefined && r.grade >= 1 && r.grade <= 4 ? (Math.round(r.grade) as Grade) : gradeAnswer(opts.timed === false ? { ...r, t: 0, est: 0 } : r);
  if (opts.cap !== undefined && g > opts.cap) g = opts.cap;
  return g;
}

// ── day scale (local calendar days, like the app's daily stats and review cap) ──

/** Local calendar day of a timestamp as a day number (days since 1970-01-01 of that local date). */
export function localDay(ms: number): number {
  const d = new Date(ms);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

/** Local midnight (ms) at the start of a day number from `localDay`. */
export function dayStartMs(day: number): number {
  const u = new Date(day * DAY_MS);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()).getTime();
}

/** YYYY-MM-DD of a day number from `localDay`. */
export function dayKey(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Day number of a YYYY-MM-DD string (undefined when malformed). */
export function dayOfKey(key: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return undefined;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dayKey(Math.round(ms / DAY_MS)) === key ? Math.round(ms / DAY_MS) : undefined;
}

/** Memory level shown in the UI: 0 unseen, 1 S < 1 d, 2 1–7 d, 3 7–21 d, 4 21–60 d, 5 ≥ 60 d. */
export function memoryLevel(stability: number | undefined): number {
  if (stability === undefined) return 0;
  if (stability < 1) return 1;
  if (stability < 7) return 2;
  if (stability < 21) return 3;
  if (stability < 60) return 4;
  return 5;
}

export const FSRS_LEVEL_LABELS = ['Chưa học', '< 1 ngày', '1–7 ngày', '7–21 ngày', '21–60 ngày', '≥ 60 ngày'];
