import { loadConfig, type AppConfig } from '../config.ts';
import type { BankState } from './bank.ts';
import { DAY_MS, localDateKey } from './time.ts';
import { FSRS_LEVEL_LABELS, dayOfKey, dayStartMs, localDay, memoryLevel, reviewGrade, scheduler, type Grade, type MemoryState } from './fsrs.ts';
import { resolveFsrsParams } from './fsrs-optimize.ts';
import { countRegraded, isAnswer, isSelfGraded, isUnviewed, notReadinessReason } from './regrade.ts';
import { sealedIds } from './sealed.ts';
import { confusionPairs, transferStats } from './insights.ts';
import { DuePlanner } from './due-planner.ts'; // [v5] exam-aware due dates, load balancing
import { LEECH_RECOVER_DAYS, LEECH_WRONG_DAYS, LEECH_WRONG_MIN, pausedLeeches } from './leech.ts'; // [v5]
import { disputedIds } from './verify.ts'; // [v5] questions whose key is in doubt: out of readiness
import { compareDue, isMasteredState } from '../../shared/filters.ts';
import { REQUIREMENTS, REQUIREMENT_INFO } from '../../shared/labels.ts';
import { pct, scaledScore } from '../../shared/scoring.ts';
import { PRIOR_K, evidenceOf } from '../../shared/evidence.ts'; // [v5] statistical shield
import type { AnswerRecord, Attempt, Bucket, Difficulty, DomainDef, ExamGoal, ExposureSplit, Question, QuestionState, StatsResponse } from '../../shared/types.ts';

/** Readiness evidence weight of a recognized answer (a repeat answered faster than the question can be read). */
export const RECOGNIZED_WEIGHT = 0.3;
/** StatsResponse.exposure window (days). */
export const EXPOSURE_DAYS = 14;
/** StatsResponse.confusions: confirmed pairs shown. */
export const CONFUSIONS_SHOWN = 10;
/** byRequirement bucket of stems that name no requirement (the learner's baseline for the other buckets). */
export const NO_REQUIREMENT = 'none';
/** byRequirement order: shared/labels.ts REQUIREMENTS, then the baseline bucket. */
const REQUIREMENT_ORDER: string[] = [...REQUIREMENTS, NO_REQUIREMENT];

/** Vietnamese label of a byRequirement bucket. */
export function requirementLabel(key: string): string {
  return key === NO_REQUIREMENT ? 'Không nêu tiêu chí' : (REQUIREMENT_INFO[key]?.label ?? key);
}

const round = (x: number, digits = 2) => Math.round(x * 10 ** digits) / 10 ** digits;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function timeOf(iso: string | undefined): number {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** True when the learner struck out (one of) the correct option(s). */
export function struckCorrect(r: { elim?: string; key: string }): boolean {
  return !!r.elim && [...r.elim].some((k) => r.key.includes(k));
}

/**
 * Learning state per question, recomputed from the full answer history (no database).
 * Rushed attempts (median answer time below stats.rushed_median_seconds) are ignored, and so are never-viewed answers
 * (no pick, t = 0 — not reviews: no state, no FSRS step). `attempts` = the learning view (regradeAttempts): its
 * `recognized` flags cap the FSRS grade at "good".
 *
 * srs.algorithm = fsrs (default): FSRS-6 memory model (see fsrs.ts), day-scale: elapsed time between answers in whole
 *   local days (same day = short-term rule). `box` = memory level by stability; due = start of the local day
 *   `last answer day + interval(S, desired_retention)` (whole days ≥ 1); retrievability at today's date.
 *   Parameters: `weights` argument, else config srs.weights > personal (results/fsrs-params.json) > defaults.
 *   [v5] Due days go through DuePlanner (due-planner.ts), replayed chronologically: load balancing (srs.load_balance),
 *   and with `opts.goal.examDate` ahead (srs.exam_aware) the final-review clamp and the final_retention ramp.
 * srs.algorithm = leitner:
 *   wrong → box 1 · correct + unsure/hinted → stays (min box 1) · correct → first time box 2, else box + 1 (max 5)
 *   due = last answer + intervals[box − 1] days
 *
 * [v5] Record kinds:
 *   - `skipped` (blank left when the learner stopped early) and never-viewed answers: not reviews — nothing at all.
 *   - `relearn` (in-session retry after a wrong / hinted first attempt): ONE same-day FSRS step of that question (the
 *     ts-fsrs short-term rule, grade at most "good", no speed-based grade) and nothing else — counters, last answer,
 *     lapses, leech and every statistic keep the graded first attempt. (Choice documented for C7: the retry is a real
 *     retrieval with the options hidden, so it may strengthen short-term memory a little; it never counts as a pass.)
 *   - `grade` (self-graded: listen mode, Anki import): the FSRS grade itself; `ok` = grade ≥ 3.
 *   - `for` (a sibling served in place of a mature due question): a first exposure of the served question AND an FSRS
 *     review of `for` with the same grade (its memory, due date and `reviewedAt` — not its counters or last answer).
 *   - attempt `source` (chat / micro / listen / anki): no speed-based grades, out of avgTime / slowCount.
 *   - mode `retest`: a normal answer, grade at most "good" (asked minutes after the explanation), out of avgTime.
 *   Leech (srs.leech_lapses > 0): lapses ≥ leech_lapses, or ≥ LEECH_WRONG_MIN wrong answers on ≥ LEECH_WRONG_DAYS days,
 *   until right (sure, no hint) on LEECH_RECOVER_DAYS different days in a row since the last wrong answer.
 */
export interface StatesOptions {
  goal?: ExamGoal; // exam date for the exam-aware due dates (final-review clamp, final_retention ramp)
}

interface LeechTrack {
  wrong: number;
  wrongDays: Set<number>;
  okDays: Set<number>; // days with a sure right answer since the last wrong one
}

/** [v5] Answers of "Học hôm nay" (and `for` substitutions) that were reviews of a due question, per history array (computeStates). */
const reviewMemo = new WeakMap<Attempt[], WeakSet<AnswerRecord>>();

export function computeStates(attempts: Attempt[], cfg: AppConfig, now = Date.now(), weights?: readonly number[], opts: StatesOptions = {}): Map<string, QuestionState> {
  const reviewAnswers = new WeakSet<AnswerRecord>();
  reviewMemo.set(attempts, reviewAnswers);
  const fsrs = cfg.srs.algorithm !== 'leitner';
  const w = fsrs ? (weights ?? resolveFsrsParams(cfg).weights) : undefined;
  const sched = w ? scheduler(w, cfg.srs.desired_retention) : undefined;
  const today = localDay(now);
  const examDay = opts.goal?.examDate ? dayOfKey(opts.goal.examDate) : undefined;
  const planner = w ? new DuePlanner({ srs: cfg.srs, weights: w, examDay, today }) : undefined;
  const states = new Map<string, QuestionState>();
  const timing = new Map<string, { sum: number; n: number }>();
  const memory = new Map<string, MemoryState & { day: number; due: number }>();
  const reviewedAt = new Map<string, string>(); // last FSRS review: own answer or a sibling's `for` credit
  const leech = new Map<string, LeechTrack>();
  const ordered = attempts
    .filter((a) => !a.rushed)
    .map((a, i) => ({ a, i, at: timeOf(a.finished) }))
    .sort((x, y) => x.at - y.at || x.i - y.i);
  const step = (id: string, g: Grade, day: number) => {
    const m = memory.get(id);
    const next = sched!.review(m, g, m ? Math.max(0, day - m.day) : 0);
    memory.set(id, { ...next, day, due: planner!.plan(id, day, next.stability, m?.due) });
  };
  for (const { a, at } of ordered) {
    const day = localDay(at);
    const timed = !a.source && a.mode !== 'retest'; // speed statistics: the app's own runner only, retests left out
    const cap: Grade | undefined = a.mode === 'retest' ? 3 : undefined;
    for (const r of a.answers) {
      if (r.skipped || isUnviewed(r)) continue;
      if (r.relearn) {
        if (sched && memory.has(r.q)) step(r.q, reviewGrade(r, { timed: false, cap: 3 }), day);
        continue;
      }
      let s = states.get(r.q);
      if (!s) {
        s = { id: r.q, attempts: 0, correct: 0, everWrong: false, streak: 0, box: 0, avgTime: 0, slowCount: 0, wrongPicks: {} };
        states.set(r.q, s);
      }
      const ok = r.grade !== undefined ? r.grade >= 3 : r.ok;
      const grade = reviewGrade(r, { timed: timed && !a.source, cap });
      if (a.mode === 'today' || r.for) {
        // "Học hôm nay": only answers to questions due at that moment (or standing in for one) are reviews of the daily cap
        const m = memory.get(r.q);
        const iv = cfg.srs.intervals_days;
        const due = m ? m.due <= day : !fsrs && !!s.lastAt && s.box > 0 && timeOf(s.lastAt) + (iv[Math.min(s.box, iv.length) - 1] ?? 1) * DAY_MS <= at;
        if (r.for || (s.attempts > 0 && due)) reviewAnswers.add(r);
      }
      if (sched) {
        step(r.q, grade, day);
        reviewedAt.set(r.q, a.finished);
        if (r.for && r.for !== r.q && states.has(r.for) && memory.has(r.for)) {
          step(r.for, grade, day);
          reviewedAt.set(r.for, a.finished);
        }
      }
      const retest = a.mode === 'retest'; // asked minutes after the explanation: no lapse, no leech evidence
      if (!ok && s.correct > 0 && !retest) s.lapses = (s.lapses ?? 0) + 1;
      if (struckCorrect(r)) s.elimCorrect = (s.elimCorrect ?? 0) + 1;
      s.attempts++;
      if (timed && r.t > 0) {
        const t = timing.get(r.q) ?? { sum: 0, n: 0 };
        t.sum += r.t;
        t.n++;
        timing.set(r.q, t);
        if (r.est && r.t > r.est * 1.5) s.slowCount++;
      }
      let lt = leech.get(r.q);
      if (!lt) leech.set(r.q, (lt = { wrong: 0, wrongDays: new Set(), okDays: new Set() }));
      if (retest) lt = { wrong: 0, wrongDays: new Set(), okDays: new Set() }; // tracked on a throw-away record
      if (ok) {
        s.correct++;
        if (r.unsure || r.hinted) {
          if (!fsrs) s.box = Math.max(1, s.box);
          s.streak = 0;
        } else {
          if (!fsrs) s.box = s.box === 0 ? 2 : Math.min(5, s.box + 1);
          s.streak++;
          lt.okDays.add(day);
        }
      } else {
        s.everWrong = true;
        if (!fsrs) s.box = 1;
        s.streak = 0;
        if (r.pick) s.wrongPicks[r.pick] = (s.wrongPicks[r.pick] ?? 0) + 1;
        lt.wrong++;
        lt.wrongDays.add(day);
        lt.okDays.clear();
      }
      s.lastAt = a.finished;
      s.lastOk = ok;
      s.lastPick = r.pick;
      s.lastUnsure = !!r.unsure;
      s.lastFlag = !!r.flag;
      s.lastGrade = grade;
    }
  }
  const intervals = cfg.srs.intervals_days;
  const leechLapses = cfg.srs.leech_lapses ?? 3;
  for (const s of states.values()) {
    const t = timing.get(s.id);
    s.avgTime = t?.n ? Math.round(t.sum / t.n) : 0;
    const m = memory.get(s.id);
    if (sched && m) {
      s.stability = round(m.stability, 2);
      s.fsrsDifficulty = round(m.difficulty, 2);
      s.retrievability = round(sched.recall(today - m.day, m.stability), 3);
      s.box = memoryLevel(m.stability);
      s.dueAt = new Date(dayStartMs(m.due)).toISOString();
      const rv = reviewedAt.get(s.id);
      if (rv && rv !== s.lastAt) s.reviewedAt = rv;
    } else if (!fsrs && s.lastAt && s.box > 0) {
      const days = intervals[Math.min(s.box, intervals.length) - 1] ?? 1;
      s.dueAt = new Date(new Date(s.lastAt).getTime() + days * DAY_MS).toISOString();
    }
    const lt = leech.get(s.id);
    if (leechLapses > 0 && lt && ((s.lapses ?? 0) >= leechLapses || (lt.wrong >= LEECH_WRONG_MIN && lt.wrongDays.size >= LEECH_WRONG_DAYS)) && lt.okDays.size < LEECH_RECOVER_DAYS) s.leech = true;
  }
  return states;
}

export function isDue(s: QuestionState | undefined, now = Date.now()): boolean {
  return !!s?.dueAt && new Date(s.dueAt).getTime() <= now;
}

/** FSRS: stability ≥ srs.mastered_stability_days · Leitner: box ≥ srs.mastered_box. */
export function isMastered(s: QuestionState | undefined, cfg: AppConfig): boolean {
  return isMasteredState(s, cfg.srs);
}

/** Labels for the memory levels 0..5 (`StatsResponse.boxes`). */
export function boxLabels(cfg: AppConfig): string[] {
  if (cfg.srs.algorithm !== 'leitner') return [...FSRS_LEVEL_LABELS];
  const iv = cfg.srs.intervals_days;
  return ['Chưa học', ...[1, 2, 3, 4, 5].map((b) => `Box ${b} · ${iv[Math.min(b, iv.length) - 1] ?? 1} ngày`)];
}

// ── daily review cap ────────────────────────────────────────────────────────

/**
 * Reviews given today (local date) that count against srs.daily_limit: answers of SRS-mode tests, and [v5] the review
 * share of "Học hôm nay" — answers to a question that was due at that moment, or standing in for one (`for`); its retry,
 * weak-task and new shares do not count. Known from computeStates' chronological replay of this same history (run here
 * with `cfg`, default config.yaml, when it has not been). Blanks, skipped blanks and relearning retries never count.
 */
export function srsAnswersToday(attempts: Attempt[], now = Date.now(), cfg?: AppConfig): number {
  const today = localDateKey(new Date(now));
  let reviews = reviewMemo.get(attempts);
  if (!reviews && attempts.some((a) => a.mode === 'today' && localDateKey(a.finished) === today)) {
    computeStates(attempts, cfg ?? loadConfig(), now);
    reviews = reviewMemo.get(attempts);
  }
  let n = 0;
  for (const a of attempts) {
    if (a.rushed || (a.mode !== 'srs' && a.mode !== 'today') || localDateKey(a.finished) !== today) continue;
    for (const r of a.answers) {
      if (!r.pick || r.relearn || r.skipped) continue;
      if (a.mode === 'srs' || r.for || reviews?.has(r)) n++;
    }
  }
  return n;
}

/** [v5] A leech the learner parked (results/leeches.md) through local day `today` — left out of reviews. */
export function isParkedLeech(s: QuestionState | undefined, today: string, paused: Set<string> = pausedLeeches(today)): boolean {
  return !!s?.leech && (paused.has(s.id) || (!!s.leechPausedUntil && s.leechPausedUntil >= today));
}

export interface ReviewQueue {
  due: Question[]; // every due question of the pool, lowest recall probability first
  today: Question[]; // the share offered today (srs.daily_limit minus SRS answers already given today)
  backlog: number; // due questions beyond today's cap
  remaining: number; // reviews still allowed today
}

/** Due questions of `pool` (parked leeches left out), today's share under srs.daily_limit, and the backlog. */
export function reviewQueue(pool: Question[], states: Map<string, QuestionState>, attempts: Attempt[], cfg: AppConfig, now = Date.now()): ReviewQueue {
  const day = localDateKey(new Date(now));
  const paused = pausedLeeches(day);
  const due = pool
    .filter((q) => {
      const s = states.get(q.id);
      return isDue(s, now) && !isParkedLeech(s, day, paused);
    })
    .sort((a, b) => compareDue(states.get(a.id), states.get(b.id)));
  const cap = cfg.srs.daily_limit;
  const remaining = cap > 0 ? Math.max(0, cap - srsAnswersToday(attempts, now, cfg)) : due.length;
  const today = due.slice(0, remaining);
  return { due, today, backlog: due.length - today.length, remaining };
}

// ── readiness v2 ────────────────────────────────────────────────────────────

export interface ReadinessItem {
  domain: string;
  ok: boolean;
  ageDays: number;
  longForm: boolean;
  difficulty: Difficulty;
  recognized?: boolean; // weighs RECOGNIZED_WEIGHT: item memory, not exam skill
}

export interface Readiness {
  readiness: number; // percent, 1 decimal
  low: number; // 90 % interval, percent
  high: number;
  sigma: number; // standard deviation, percent points
  passProbability: number; // 0..1
  confidence: 'low' | 'medium' | 'high';
}

const DIFFICULTY_WEIGHT: Record<Difficulty, number> = { easy: 0.8, medium: 1, hard: 1.2 };

/** Evidence weight of one answer: recency half-life × long-form bonus × difficulty × recognition discount. */
export function answerWeight(it: Pick<ReadinessItem, 'ageDays' | 'longForm' | 'difficulty' | 'recognized'>, halfLifeDays: number): number {
  const recency = halfLifeDays > 0 ? Math.pow(0.5, Math.max(0, it.ageDays) / halfLifeDays) : 1;
  return recency * (it.longForm ? 1.5 : 1) * (DIFFICULTY_WEIGHT[it.difficulty] ?? 1) * (it.recognized ? RECOGNIZED_WEIGHT : 1);
}

/** Standard normal CDF (erfc approximation, |error| < 1.2e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * x);
  const erfc =
    t *
    Math.exp(
      -x * x -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return z >= 0 ? 1 - erfc / 2 : erfc / 2;
}

/**
 * Exam-weighted readiness with a Beta(1,1) prior per domain:
 *   p_d = (Σw·ok + 1) / (Σw + 2), n_eff = (Σw)² / Σw², readiness = Σ f_d·p_d (f_d = exam weight fraction),
 *   var = Σ f_d²·p_d(1 − p_d) / max(n_eff, 1) → 90 % interval ± 1.645σ, P(pass) = 1 − Φ((pass − readiness)/σ).
 */
export function computeReadiness(items: ReadinessItem[], domains: DomainDef[], passPct: number, halfLifeDays: number): Readiness {
  if (!items.length || !domains.length) return { readiness: 0, low: 0, high: 0, sigma: 0, passProbability: 0, confidence: 'low' };
  const totalWeight = domains.reduce((s, d) => s + d.weight, 0) || 1;
  const acc = new Map<string, { w: number; w2: number; ok: number }>();
  for (const it of items) {
    const w = answerWeight(it, halfLifeDays);
    const g = acc.get(it.domain) ?? { w: 0, w2: 0, ok: 0 };
    g.w += w;
    g.w2 += w * w;
    if (it.ok) g.ok += w;
    acc.set(it.domain, g);
  }
  let mean = 0;
  let variance = 0;
  for (const d of domains) {
    const g = acc.get(d.id) ?? { w: 0, w2: 0, ok: 0 };
    const p = (g.ok + 1) / (g.w + 2);
    const nEff = g.w2 > 0 ? (g.w * g.w) / g.w2 : 0;
    const f = d.weight / totalWeight;
    mean += f * p;
    variance += (f * f * p * (1 - p)) / Math.max(nEff, 1);
  }
  const readiness = 100 * mean;
  const sigma = 100 * Math.sqrt(variance);
  const half = 1.645 * sigma;
  const passProbability = sigma > 0 ? 1 - normalCdf((passPct - readiness) / sigma) : readiness >= passPct ? 1 : 0;
  const width = 2 * half;
  return {
    readiness: round(readiness, 1),
    low: round(clamp(readiness - half, 0, 100), 1),
    high: round(clamp(readiness + half, 0, 100), 1),
    sigma: round(sigma, 2),
    passProbability: round(passProbability, 3),
    confidence: width < 8 ? 'high' : width < 15 ? 'medium' : 'low',
  };
}

/**
 * [v5] An accuracy sample of the statistics (totals, buckets, calibration, exposure, readiness…): a real answer (viewed,
 * not a skipped blank, not a relearning retry) with a recorded pick (not self-graded) in an attempt that is a readiness
 * sample (not a retest, not an Anki / listen source).
 */
export function isStatsSample(r: Attempt['answers'][number], a: Pick<Attempt, 'mode' | 'source'>): boolean {
  return isAnswer(r) && !isSelfGraded(r, a) && notReadinessReason(a) === undefined;
}

/**
 * Readiness evidence of one answer (undefined: not a stats sample, the question is retired / gone, or [v5] its key is
 * disputed — verify.ts disputedIds()).
 */
function readinessItem(r: Attempt['answers'][number], a: Pick<Attempt, 'mode' | 'source'>, bank: BankState, ageDays: number, disputed: Set<string>): ReadinessItem | undefined {
  if (!isStatsSample(r, a) || disputed.has(r.q)) return undefined;
  const q = bank.byId.get(r.q);
  if (!q || q.status === 'retired') return undefined;
  const it: ReadinessItem = { domain: q.domain, ok: r.ok, ageDays, longForm: q.longForm, difficulty: q.difficulty };
  if (r.recognized) it.recognized = true;
  return it;
}

/**
 * The readiness the stats page would have shown at time `at`: same items and weights as computeStats (non-rushed
 * attempts, never-viewed answers and retired questions left out, recognized answers discounted; [v5] skipped blanks,
 * relearning retries, retests, self-graded answers and disputed questions left out), restricted to attempts finished by
 * `at` (and not `opts.exclude`), ages measured from `at`. `answers` = evidence behind it (0 → no readiness yet).
 */
export function readinessAt(attempts: Attempt[], bank: BankState, cfg: AppConfig, at: number, opts: { exclude?: string; disputed?: Set<string> } = {}): Readiness & { answers: number } {
  const items: ReadinessItem[] = [];
  const disputed = opts.disputed ?? disputedIds(bank);
  for (const a of attempts) {
    const t = timeOf(a.finished);
    if (a.rushed || t > at || (opts.exclude !== undefined && a.id === opts.exclude)) continue;
    const ageDays = Math.max(0, (at - t) / DAY_MS);
    for (const r of a.answers) {
      const it = readinessItem(r, a, bank, ageDays, disputed);
      if (it) items.push(it);
    }
  }
  const tax = bank.taxonomy;
  return { ...computeReadiness(items, tax.domains, tax.exam.pass_pct, cfg.stats.recency_half_life_days), answers: items.length };
}

// ── aggregate statistics ────────────────────────────────────────────────────

interface Acc {
  attempts: number;
  correct: number;
  qs: Set<string>;
  time: number;
  est: number;
  timed: number; // [v5] answers behind time / est (the app's own runner only)
}

function bucketize(map: Map<string, Acc>, bankCount: Map<string, number>, label: (k: string) => string): Bucket[] {
  const keys = new Set([...map.keys(), ...bankCount.keys()]);
  return [...keys].map((key) => {
    const a = map.get(key) ?? { attempts: 0, correct: 0, qs: new Set<string>(), time: 0, est: 0, timed: 0 };
    return {
      key,
      label: label(key),
      attempts: a.attempts,
      correct: a.correct,
      accuracy: pct(a.correct, a.attempts),
      questions: a.qs.size,
      bank: bankCount.get(key) ?? 0,
      avgTime: a.timed ? Math.round(a.time / a.timed) : 0,
      avgEst: a.timed ? Math.round(a.est / a.timed) : 0,
    };
  });
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * [v5] Evidence fields of a bucket (0..100 like `accuracy`): accuracy shrunk toward `prior` (default the base rate),
 * 80 % interval, verdict vs the learner's base rate, answers still needed (shared/evidence.ts). Returns the shrunk rate.
 */
function withEvidence(b: Bucket, base: number, prior = base): number {
  const e = evidenceOf(b.correct, b.attempts, base, { p: prior, k: PRIOR_K });
  b.shrunk = round1(100 * e.shrunk);
  b.lo = round1(100 * e.lo);
  b.hi = round1(100 * e.hi);
  b.verdict = e.verdict;
  b.needMore = e.needMore;
  return e.shrunk;
}

interface Tally {
  answers: number;
  correct: number;
}

function tally(t: Tally, ok: boolean) {
  t.answers++;
  if (ok) t.correct++;
}

export interface StatsOptions {
  sealed?: Set<string>; // sealed question ids (default: sealedIds()) — out of the bank denominators, review queue and lists
  disputed?: Set<string>; // [v5] questions whose key is in doubt (default: verify.ts disputedIds()) — out of readiness
}

/**
 * Everything GET /api/stats shows, from the learning view of the history (regradeAttempts) and its states. Rushed
 * attempts and never-viewed answers are left out (the latter are counted in `unviewed`); sealed questions are left out of
 * every bank denominator (coverage, buckets' `bank`, boxes), the review queue and the question lists until released.
 * [v5] Accuracy statistics use stats samples only (isStatsSample: no skipped blanks, relearning retries, retests or
 * self-graded answers); speed (avgTime / avgEst) only the app's own runner; readiness also leaves disputed questions out.
 * Every bucket carries the evidence fields (shrunk / lo / hi / verdict / needMore vs the learner's overall rate; services
 * shrink toward their topic, tasks toward their domain). Plus `pace`, `leeches` (count) and `transfer`.
 */
export function computeStats(attempts: Attempt[], bank: BankState, states: Map<string, QuestionState>, cfg: AppConfig, now = Date.now(), opts: StatsOptions = {}): StatsResponse {
  const tax = bank.taxonomy;
  const used = attempts.filter((a) => !a.rushed);
  const sealed = opts.sealed ?? sealedIds();
  const active = bank.questions.filter((q) => q.status === 'active');
  const practice = sealed.size ? active.filter((q) => !sealed.has(q.id)) : active; // the bank the learner can practise
  const dims: Record<string, (q: Question) => string[]> = {
    domain: (q) => [q.domain],
    topic: (q) => [q.topic],
    difficulty: (q) => [q.difficulty],
    service: (q) => q.services,
    tag: (q) => q.tags,
    task: (q) => (q.task ? [q.task] : []),
    requirement: (q) => (q.requirements?.length ? q.requirements : [NO_REQUIREMENT]),
  };
  const acc: Record<string, Map<string, Acc>> = {};
  const bankCount: Record<string, Map<string, number>> = {};
  for (const d of Object.keys(dims)) {
    acc[d] = new Map();
    bankCount[d] = new Map();
  }
  for (const t of tax.tasks ?? []) bankCount.task.set(t.id, 0);
  for (const k of REQUIREMENT_ORDER) bankCount.requirement.set(k, 0);
  for (const q of practice) for (const [d, f] of Object.entries(dims)) for (const k of f(q)) bankCount[d].set(k, (bankCount[d].get(k) ?? 0) + 1);

  let answers = 0;
  let correct = 0;
  let unviewed = 0;
  let studySeconds = 0;
  const daily = new Map<string, { answers: number; correct: number; seconds: number }>();
  const calibration = { sure: { answers: 0, correct: 0 }, unsure: { answers: 0, correct: 0 }, hinted: { answers: 0, correct: 0 } };
  const elimination = { answersWithElim: 0, correctEliminated: 0, questions: [] as string[] };
  const elimQs: string[] = [];
  const recall = { answers: 0, hits: 0, hitCorrect: 0, missCorrect: 0 };
  const lengthSplit = { long: { answers: 0, correct: 0 }, short: { answers: 0, correct: 0 } };
  const exposure: ExposureSplit = { days: EXPOSURE_DAYS, first: { answers: 0, correct: 0 }, repeat: { answers: 0, correct: 0 }, recognized: 0 };
  const exposureSince = now - EXPOSURE_DAYS * DAY_MS;
  const readinessItems: ReadinessItem[] = [];
  const disputed = opts.disputed ?? disputedIds(bank);
  for (const a of used) {
    const day = localDateKey(a.finished);
    const dd = daily.get(day) ?? { answers: 0, correct: 0, seconds: 0 };
    dd.seconds += a.timeUsed;
    studySeconds += a.timeUsed;
    const finishedAt = timeOf(a.finished);
    const ageDays = Math.max(0, (now - finishedAt) / DAY_MS);
    const recent = finishedAt >= exposureSince;
    const timed = !a.source; // speed: the app's own runner only
    for (const r of a.answers) {
      if (isUnviewed(r)) {
        unviewed++;
        continue;
      }
      if (!isStatsSample(r, a)) continue; // [v5] skipped blanks, relearning retries, retests, self-graded answers
      answers++;
      dd.answers++;
      if (r.ok) {
        correct++;
        dd.correct++;
      }
      if (recent && r.exposure !== undefined) {
        tally(r.exposure > 1 ? exposure.repeat : exposure.first, r.ok);
        if (r.recognized) exposure.recognized++;
      }
      if (r.hinted) tally(calibration.hinted, r.ok);
      else if (r.unsure) tally(calibration.unsure, r.ok);
      else if (r.pick) tally(calibration.sure, r.ok);
      if (r.elim) {
        elimination.answersWithElim++;
        if (struckCorrect(r)) {
          elimination.correctEliminated++;
          elimQs.push(r.q);
        }
      }
      if (r.recall) {
        recall.answers++;
        if (r.recallHit) {
          recall.hits++;
          if (r.ok) recall.hitCorrect++;
        } else if (r.ok) recall.missCorrect++;
      }
      const q = bank.byId.get(r.q);
      if (!q) continue;
      tally(q.longForm ? lengthSplit.long : lengthSplit.short, r.ok);
      for (const [d, f] of Object.entries(dims)) {
        for (const k of f(q)) {
          const x = acc[d].get(k) ?? { attempts: 0, correct: 0, qs: new Set<string>(), time: 0, est: 0, timed: 0 };
          x.attempts++;
          if (r.ok) x.correct++;
          x.qs.add(r.q);
          if (timed) {
            x.time += r.t;
            x.est += r.est;
            x.timed++;
          }
          acc[d].set(k, x);
        }
      }
      const it = readinessItem(r, a, bank, ageDays, disputed);
      if (it) readinessItems.push(it);
    }
    daily.set(day, dd);
  }
  elimination.questions = [...new Set(elimQs.reverse())].filter((id) => !sealed.has(id)).slice(0, 30);

  const domainOrder = (k: string) => tax.domains.findIndex((d) => d.id === k);
  const byDomain = bucketize(acc.domain, bankCount.domain, (k) => {
    const d = tax.domains.find((x) => x.id === k);
    return d ? `${d.code} · ${d.label_vi}` : k;
  }).sort((a, b) => domainOrder(a.key) - domainOrder(b.key));
  const taskOrder = (k: string) => {
    const i = (tax.tasks ?? []).findIndex((t) => t.id === k);
    return i < 0 ? 999 : i;
  };
  const byTask = bucketize(acc.task, bankCount.task, (k) => {
    const t = tax.tasks?.find((x) => x.id === k);
    return t ? `${t.id} · ${t.label_vi}` : k;
  }).sort((a, b) => taskOrder(a.key) - taskOrder(b.key) || a.key.localeCompare(b.key));
  const requirementOrder = (k: string) => {
    const i = REQUIREMENT_ORDER.indexOf(k);
    return i < 0 ? 999 : i;
  };
  const byRequirement = bucketize(acc.requirement, bankCount.requirement, requirementLabel).sort(
    (a, b) => requirementOrder(a.key) - requirementOrder(b.key) || a.key.localeCompare(b.key),
  );

  const ready = computeReadiness(readinessItems, tax.domains, tax.exam.pass_pct, cfg.stats.recency_half_life_days);

  // [v5] statistical shield on every bucket list: base = the learner's overall rate (pass % before any answer);
  // services shrink toward their taxonomy topic, tasks toward their domain, everything else toward the base
  const base = answers ? correct / answers : tax.exam.pass_pct / 100;
  const domainRate = new Map(byDomain.map((b) => [b.key, withEvidence(b, base)]));
  for (const b of byTask) withEvidence(b, base, domainRate.get(tax.tasks?.find((t) => t.id === b.key)?.domain ?? '') ?? base);
  for (const b of byRequirement) withEvidence(b, base);

  // study streak: consecutive days with activity ending today or yesterday
  let streakDays = 0;
  for (let i = 0; i < 400; i++) {
    const key = localDateKey(new Date(now - i * DAY_MS));
    if (daily.has(key)) streakDays++;
    else if (i > 0) break;
  }

  const stateList = [...states.values()].filter((s) => bank.byId.get(s.id)?.status === 'active' && !sealed.has(s.id));
  const boxes = [0, 0, 0, 0, 0, 0];
  for (const q of practice) boxes[Math.min(5, Math.max(0, states.get(q.id)?.box ?? 0))]++;
  const queue = reviewQueue(practice, states, attempts, cfg, now);

  const topicLabel = (k: string) => {
    const t = tax.topics.find((x) => x.id === k);
    return t ? `${t.icon} ${t.label}` : k;
  };
  const diffLabel = (k: string) => tax.difficulties.find((x) => x.id === k)?.label ?? k;

  const mostMissed = stateList
    .filter((s) => s.attempts - s.correct > 0)
    .sort((a, b) => b.attempts - b.correct - (a.attempts - a.correct) || (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
    .slice(0, 15)
    .map((s) => {
      const q = bank.byId.get(s.id)!;
      return { id: s.id, wrong: s.attempts - s.correct, attempts: s.attempts, topic: q.topic, stem: q.stem.slice(0, 160) };
    });

  const rushed = attempts
    .filter((a) => a.rushed)
    .map((a) => ({ id: a.id, title: a.title, finished: a.finished, medianTime: a.medianTime ?? 0 }))
    .reverse();

  const byTopic = bucketize(acc.topic, bankCount.topic, topicLabel).sort((a, b) => b.bank - a.bank);
  const topicRate = new Map(byTopic.map((b) => [b.key, withEvidence(b, base)]));
  const byDifficulty = bucketize(acc.difficulty, bankCount.difficulty, diffLabel);
  for (const b of byDifficulty) withEvidence(b, base);
  const byService = bucketize(acc.service, bankCount.service, (k) => k).filter((b) => b.attempts > 0).sort((a, b) => b.attempts - a.attempts);
  for (const b of byService) withEvidence(b, base, topicRate.get(tax.services[b.key]?.topic ?? '') ?? base);
  const byTag = bucketize(acc.tag, bankCount.tag, (k) => k).filter((b) => b.attempts > 0).sort((a, b) => b.attempts - a.attempts);
  for (const b of byTag) withEvidence(b, base);

  return {
    totals: {
      attempts: used.length,
      answers,
      correct,
      accuracy: pct(correct, answers),
      distinctSeen: stateList.length,
      bankActive: practice.length,
      mastered: stateList.filter((s) => isMastered(s, cfg)).length,
      due: queue.due.length,
      wrongOpen: stateList.filter((s) => s.lastOk === false).length,
      flagged: stateList.filter((s) => s.lastFlag || s.lastUnsure).length,
      studySeconds,
      streakDays,
      readiness: ready.readiness,
      readinessScaled: scaledScore(ready.readiness),
      readinessConfidence: ready.confidence,
      readinessLow: ready.low,
      readinessHigh: ready.high,
      passProbability: ready.passProbability,
      dueToday: queue.today.length,
      backlog: queue.backlog,
      rushedAttempts: rushed.length,
      longFormShare: pct(lengthSplit.long.answers, lengthSplit.long.answers + lengthSplit.short.answers),
    },
    byDomain,
    byTopic,
    byDifficulty,
    byService,
    byTag,
    byTask,
    boxes,
    boxLabels: boxLabels(cfg),
    calibration,
    elimination,
    recall: {
      answers: recall.answers,
      hits: recall.hits,
      hitAccuracy: pct(recall.hitCorrect, recall.hits),
      missAccuracy: pct(recall.missCorrect, recall.answers - recall.hits),
    },
    lengthSplit,
    rushed,
    trend: used.slice(-40).map((a) => ({ id: a.id, finished: a.finished, score: a.score, total: a.total, mode: a.mode, title: a.title })),
    daily: [...daily].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
    mostMissed,
    regraded: countRegraded(used),
    unviewed,
    exposure,
    byRequirement,
    confusions: confusionPairs(attempts, bank, { sealed, excludeOutOfScope: cfg.practice?.exclude_out_of_scope !== false }).slice(0, CONFUSIONS_SHOWN),
    // [v5]
    transfer: transferStats(attempts, bank, { now, sealed }),
    leeches: stateList.filter((s) => s.leech).length,
    pace: learnerPace(attempts),
  };
}

// ── [v5] learner pace, today's answers ──────────────────────────────────────

/** learnerPace: answers looked at (newest first) and the minimum needed before the median replaces 1. */
export const PACE_WINDOW = 200;
export const PACE_MIN_ANSWERS = 30;
export const PACE_MIN = 0.6;
export const PACE_MAX = 2;

const paceMemo = new WeakMap<Attempt[], number>();

/**
 * Learner speed: median t / est of the last PACE_WINDOW answered questions of non-rushed attempts from the app's own
 * runner (no `source`: chat latency, reading aloud, Anki and micro breaks say nothing about exam pace), leaving out
 * in-session relearning retries, skipped / never-viewed answers, self-graded answers and retests (asked minutes after the
 * explanation). Clamped to [PACE_MIN, PACE_MAX]; 1 (= the estimate) with fewer than PACE_MIN_ANSWERS such answers.
 */
export function learnerPace(attempts: Attempt[]): number {
  const hit = paceMemo.get(attempts);
  if (hit !== undefined) return hit;
  const ordered = attempts
    .map((a, i) => ({ a, i, at: timeOf(a.finished) }))
    .filter(({ a }) => !a.rushed && !a.source && a.mode !== 'retest')
    .sort((x, y) => y.at - x.at || y.i - x.i);
  const ratios: number[] = [];
  outer: for (const { a } of ordered) {
    for (let j = a.answers.length - 1; j >= 0; j--) {
      const r = a.answers[j];
      if (!r.pick || r.relearn || r.skipped || r.grade || !(r.t > 0) || !(r.est > 0)) continue;
      ratios.push(r.t / r.est);
      if (ratios.length >= PACE_WINDOW) break outer;
    }
  }
  let pace = 1;
  if (ratios.length >= PACE_MIN_ANSWERS) {
    ratios.sort((x, y) => x - y);
    const m = ratios.length >> 1;
    pace = round(clamp(ratios.length % 2 ? ratios[m] : (ratios[m - 1] + ratios[m]) / 2, PACE_MIN, PACE_MAX), 2);
  }
  paceMemo.set(attempts, pace);
  return pace;
}

const answeredMemo = new WeakMap<Attempt[], Map<string, Set<string>>>();

/**
 * Question ids looked at on local day `day` (YYYY-MM-DD) — never served again that day, their siblings buried until
 * tomorrow: every answer with a pick, time spent or a self-grade (skipped blanks and relearning retries included, rushed
 * attempts too — the learner saw them), plus the questions a sibling stood in for (`for`). Shared set — do not mutate.
 */
export function answeredOn(attempts: Attempt[], day: string): Set<string> {
  let byDay = answeredMemo.get(attempts);
  if (!byDay) answeredMemo.set(attempts, (byDay = new Map()));
  const hit = byDay.get(day);
  if (hit) return hit;
  const ids = new Set<string>();
  for (const a of attempts) {
    if (!a.finished || localDateKey(a.finished) !== day) continue;
    for (const r of a.answers) {
      if (!r.pick && !(r.t > 0) && !r.grade) continue;
      ids.add(r.q);
      if (r.for) ids.add(r.for);
    }
  }
  byDay.set(day, ids);
  return ids;
}
