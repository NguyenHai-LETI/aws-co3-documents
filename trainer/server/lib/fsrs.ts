// FSRS-4.5 spaced-repetition model (open-spaced-repetition, default weights), recomputed from the
// answer history on every request — no scheduler state is stored anywhere.
//   R(t,S) = (1 + FACTOR·t/S)^DECAY            recall probability t days after the last review
//   I(S,r) = S/FACTOR · (r^(1/DECAY) − 1)      interval that brings R down to the desired retention r
// With r = 0.9 the interval equals the stability (that is how FACTOR = 19/81 is chosen).
import type { AnswerRecord } from '../../shared/types.ts';

export const FSRS_WEIGHTS: readonly number[] = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];
export const DECAY = -0.5;
export const FACTOR = 19 / 81;
/** Longest interval the scheduler will ever produce (days). */
export const MAX_INTERVAL_DAYS = 36500;

/** 1 = again (wrong), 2 = hard, 3 = good, 4 = easy. */
export type Grade = 1 | 2 | 3 | 4;

export interface MemoryState {
  stability: number; // days until R drops to 90 %
  difficulty: number; // 1..10
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function retrievability(elapsedDays: number, stability: number): number {
  if (!(stability > 0)) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

/** Days until R(t, S) falls to `desiredRetention` (not rounded, not clamped to ≥ 1). */
export function intervalDays(stability: number, desiredRetention = 0.9): number {
  const r = clamp(desiredRetention, 0.5, 0.99);
  return Math.min(MAX_INTERVAL_DAYS, (stability / FACTOR) * (Math.pow(r, 1 / DECAY) - 1));
}

export function initStability(g: Grade, w: readonly number[] = FSRS_WEIGHTS): number {
  return Math.max(0.1, w[g - 1]);
}

export function initDifficulty(g: Grade, w: readonly number[] = FSRS_WEIGHTS): number {
  return clamp(w[4] - (g - 3) * w[5], 1, 10);
}

/** D' with mean reversion towards D0(easy). */
export function nextDifficulty(d: number, g: Grade, w: readonly number[] = FSRS_WEIGHTS): number {
  return clamp(w[7] * initDifficulty(4, w) + (1 - w[7]) * (d - w[6] * (g - 3)), 1, 10);
}

export function recallStability(d: number, s: number, r: number, g: Grade, w: readonly number[] = FSRS_WEIGHTS): number {
  const hardPenalty = g === 2 ? w[15] : 1;
  const easyBonus = g === 4 ? w[16] : 1;
  return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hardPenalty * easyBonus);
}

export function forgetStability(d: number, s: number, r: number, w: readonly number[] = FSRS_WEIGHTS): number {
  return Math.min(s, w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r)));
}

/**
 * Applies one review. `prev` undefined = first time the question is answered.
 * Stability is updated with the difficulty *before* the review (as in the reference implementation).
 */
export function review(prev: MemoryState | undefined, g: Grade, elapsedDays: number, w: readonly number[] = FSRS_WEIGHTS): MemoryState {
  if (!prev) return { stability: initStability(g, w), difficulty: initDifficulty(g, w) };
  const r = retrievability(elapsedDays, prev.stability);
  const stability = g === 1 ? forgetStability(prev.difficulty, prev.stability, r, w) : recallStability(prev.difficulty, prev.stability, r, g, w);
  return { stability: clamp(stability, 0.01, MAX_INTERVAL_DAYS), difficulty: nextDifficulty(prev.difficulty, g, w) };
}

/**
 * Grade of one recorded answer:
 *   wrong / unanswered → 1 · correct but unsure, hinted, struck a correct option or slower than 1.5× the estimate → 2
 *   correct, confident and faster than half the estimate → 4 · otherwise → 3
 */
export function gradeAnswer(r: Pick<AnswerRecord, 'ok' | 'pick' | 'key' | 't' | 'est' | 'unsure' | 'hinted' | 'elim'>): Grade {
  if (!r.ok || !r.pick) return 1;
  const struckCorrect = !!r.elim && [...r.elim].some((k) => r.key.includes(k));
  if (r.unsure || r.hinted || struckCorrect || (r.est > 0 && r.t > 1.5 * r.est)) return 2;
  if (r.est > 0 && r.t > 0 && r.t < 0.5 * r.est) return 4;
  return 3;
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
