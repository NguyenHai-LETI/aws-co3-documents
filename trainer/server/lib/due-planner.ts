// [v5 · λ] Due dates of the FSRS scheduler under the exam-aware policy. computeStates replays every review in
// chronological order through one planner, so a choice made for an earlier review never changes when later results
// arrive (the FSRS optimizer still trains on the raw review log — nothing here touches it). Pure: no I/O.
//
//   interval   I = ts-fsrs next_interval(S, r(day)) — whole days ≥ 1, no fuzz
//   r(day)     desired retention: srs.desired_retention, ramped linearly to srs.final_retention over the last
//              FINAL_RAMP_DAYS before the exam (exam ahead, final_retention > desired_retention; 0 = off)
//   balance    srs.load_balance and I ≥ BALANCE_MIN_INTERVAL: the due day moves within ±max(1, round(5 % · I)) to the day
//              with the fewest dues planned so far — ties to the earliest day
//   clamp      exam ahead (srs.exam_aware + goal.examDate ≥ today): a due day after exam − 2 whose recall on exam day would
//              be below max(0.9, final_retention) moves into [max(exam − srs.final_review_days, review day + 1), exam − 2],
//              the lightest day there (ties spread by a stable hash of the question id)
// Without balance / clamp / ramp the due day is exactly `review day + I` (the v4 scheduler).
import type { AppConfig } from '../config.ts';
import { clampRetention, retrievability, scheduler, type Scheduler } from './fsrs.ts';
import { stableHash } from '../../shared/filters.ts';

/** Load balancing starts at this interval (days); the window is ± BALANCE_SHARE of the interval (at least 1 day). */
export const BALANCE_MIN_INTERVAL = 4;
export const BALANCE_SHARE = 0.05;
/** final_retention ramps up over the last N days before the exam. */
export const FINAL_RAMP_DAYS = 14;
/** The final-review window ends this many days before the exam. */
export const FINAL_REVIEW_END = 2;
/** Recall on exam day below this (or below final_retention when higher) needs a final review. */
export const FINAL_REVIEW_RECALL = 0.9;

export interface PlannerOptions {
  srs: Pick<AppConfig['srs'], 'desired_retention' | 'load_balance' | 'exam_aware' | 'final_review_days' | 'final_retention'>;
  weights: readonly number[];
  examDay?: number; // local day number of goal.examDate (undefined: no exam date)
  today: number; // local day number of "now" — the exam-aware policy applies only while the exam is ahead
}

export class DuePlanner {
  private readonly counts = new Map<number, number>();
  private readonly base: number;
  private readonly balance: boolean;
  private readonly exam?: number; // set while the exam-aware policy is active
  private readonly finalRetention: number;
  private readonly finalDays: number;
  readonly active: boolean; // anything beyond `day + interval`
  private readonly opts: PlannerOptions;
  private readonly schedulers = new Map<number, Scheduler>(); // per desired retention (the ts-fsrs core lookup joins the weights)

  constructor(opts: PlannerOptions) {
    this.opts = opts;
    const srs = opts.srs;
    this.base = clampRetention(srs.desired_retention);
    this.balance = srs.load_balance === true;
    if (srs.exam_aware !== false && opts.examDay !== undefined && opts.examDay >= opts.today) this.exam = opts.examDay;
    const fr = Number(srs.final_retention) || 0;
    this.finalRetention = fr > this.base ? clampRetention(fr) : 0;
    this.finalDays = Math.max(0, Math.round(Number(srs.final_review_days) || 0));
    this.active = this.balance || this.exam !== undefined;
  }

  /** Desired retention for a review on `day` (the ramp is quantized to 0.005 so few scheduler variants exist). */
  retentionOn(day: number): number {
    if (this.exam === undefined || !this.finalRetention) return this.base;
    const start = this.exam - FINAL_RAMP_DAYS;
    if (day <= start) return this.base;
    const t = Math.min(1, (day - start) / FINAL_RAMP_DAYS);
    return Math.round((this.base + (this.finalRetention - this.base) * t) * 200) / 200;
  }

  /** Recall threshold on exam day below which the final-review clamp applies. */
  get finalRecall(): number {
    return Math.max(FINAL_REVIEW_RECALL, this.finalRetention || 0);
  }

  private lightest(from: number, to: number, tie: (d: number) => number): number {
    let best = from;
    let bestN = Infinity;
    let bestTie = Infinity;
    for (let d = from; d <= to; d++) {
      const n = this.counts.get(d) ?? 0;
      const t = tie(d);
      if (n < bestN || (n === bestN && t < bestTie)) {
        best = d;
        bestN = n;
        bestTie = t;
      }
    }
    return best;
  }

  /**
   * Due day of question `id` reviewed on `day` with resulting stability `stability`; `prevDue` = its previously planned
   * due day (released from the load counts).
   */
  plan(id: string, day: number, stability: number, prevDue?: number): number {
    const r = this.retentionOn(day);
    let sched = this.schedulers.get(r);
    if (!sched) this.schedulers.set(r, (sched = scheduler(this.opts.weights, r)));
    const interval = sched.interval(stability);
    let due = day + interval;
    if (!this.active) return due;
    if (this.balance && interval >= BALANCE_MIN_INTERVAL) {
      const delta = Math.max(1, Math.round(BALANCE_SHARE * interval));
      due = this.lightest(Math.max(day + 1, due - delta), due + delta, (d) => d); // ties → earliest day
    }
    const exam = this.exam;
    if (exam !== undefined && this.finalDays > 0 && due > exam - FINAL_REVIEW_END) {
      const recall = retrievability(exam - day, stability, this.opts.weights);
      const from = Math.max(exam - this.finalDays, day + 1);
      const to = exam - FINAL_REVIEW_END;
      if (recall < this.finalRecall && from <= to) due = this.lightest(from, to, (d) => stableHash(`${id}:${d}`, 'final-review'));
    }
    if (prevDue !== undefined) {
      const n = (this.counts.get(prevDue) ?? 0) - 1;
      if (n > 0) this.counts.set(prevDue, n);
      else this.counts.delete(prevDue);
    }
    this.counts.set(due, (this.counts.get(due) ?? 0) + 1);
    return due;
  }
}
