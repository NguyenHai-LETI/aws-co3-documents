import type { AppConfig } from '../config.ts';
import type { BankState } from './bank.ts';
import { DAY_MS, localDateKey } from './time.ts';
import { FSRS_LEVEL_LABELS, dayStartMs, gradeAnswer, localDay, memoryLevel, scheduler, type MemoryState } from './fsrs.ts';
import { resolveFsrsParams } from './fsrs-optimize.ts';
import { countRegraded, isUnviewed } from './regrade.ts';
import { sealedIds } from './sealed.ts';
import { confusionPairs } from './insights.ts';
import { compareDue, isMasteredState } from '../../shared/filters.ts';
import { REQUIREMENTS, REQUIREMENT_INFO } from '../../shared/labels.ts';
import { pct, scaledScore } from '../../shared/scoring.ts';
import type { Attempt, Bucket, Difficulty, DomainDef, ExposureSplit, Question, QuestionState, StatsResponse } from '../../shared/types.ts';

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
 * srs.algorithm = leitner:
 *   wrong → box 1 · correct + unsure/hinted → stays (min box 1) · correct → first time box 2, else box + 1 (max 5)
 *   due = last answer + intervals[box − 1] days
 */
export function computeStates(attempts: Attempt[], cfg: AppConfig, now = Date.now(), weights?: readonly number[]): Map<string, QuestionState> {
  const fsrs = cfg.srs.algorithm !== 'leitner';
  const sched = fsrs ? scheduler(weights ?? resolveFsrsParams(cfg).weights, cfg.srs.desired_retention) : undefined;
  const states = new Map<string, QuestionState>();
  const timeSum = new Map<string, number>();
  const memory = new Map<string, MemoryState & { day: number }>();
  const ordered = attempts
    .filter((a) => !a.rushed)
    .map((a, i) => ({ a, i, at: timeOf(a.finished) }))
    .sort((x, y) => x.at - y.at || x.i - y.i);
  for (const { a, at } of ordered) {
    const day = localDay(at);
    for (const r of a.answers) {
      if (isUnviewed(r)) continue;
      let s = states.get(r.q);
      if (!s) {
        s = { id: r.q, attempts: 0, correct: 0, everWrong: false, streak: 0, box: 0, avgTime: 0, slowCount: 0, wrongPicks: {} };
        states.set(r.q, s);
      }
      const grade = gradeAnswer(r);
      if (sched) {
        const m = memory.get(r.q);
        memory.set(r.q, { ...sched.review(m, grade, m ? Math.max(0, day - m.day) : 0), day });
      }
      if (!r.ok && s.correct > 0) s.lapses = (s.lapses ?? 0) + 1;
      if (struckCorrect(r)) s.elimCorrect = (s.elimCorrect ?? 0) + 1;
      s.attempts++;
      timeSum.set(r.q, (timeSum.get(r.q) ?? 0) + r.t);
      if (r.est && r.t > r.est * 1.5) s.slowCount++;
      if (r.ok) {
        s.correct++;
        if (r.unsure || r.hinted) {
          if (!fsrs) s.box = Math.max(1, s.box);
          s.streak = 0;
        } else {
          if (!fsrs) s.box = s.box === 0 ? 2 : Math.min(5, s.box + 1);
          s.streak++;
        }
      } else {
        s.everWrong = true;
        if (!fsrs) s.box = 1;
        s.streak = 0;
        if (r.pick) s.wrongPicks[r.pick] = (s.wrongPicks[r.pick] ?? 0) + 1;
      }
      s.lastAt = a.finished;
      s.lastOk = r.ok;
      s.lastPick = r.pick;
      s.lastUnsure = !!r.unsure;
      s.lastFlag = !!r.flag;
      s.lastGrade = grade;
    }
  }
  const intervals = cfg.srs.intervals_days;
  const today = localDay(now);
  for (const s of states.values()) {
    s.avgTime = Math.round((timeSum.get(s.id) ?? 0) / Math.max(1, s.attempts));
    const m = memory.get(s.id);
    if (sched && m) {
      s.stability = round(m.stability, 2);
      s.fsrsDifficulty = round(m.difficulty, 2);
      s.retrievability = round(sched.recall(today - m.day, m.stability), 3);
      s.box = memoryLevel(m.stability);
      s.dueAt = new Date(dayStartMs(m.day + sched.interval(m.stability))).toISOString();
    } else if (!fsrs && s.lastAt && s.box > 0) {
      const days = intervals[Math.min(s.box, intervals.length) - 1] ?? 1;
      s.dueAt = new Date(new Date(s.lastAt).getTime() + days * DAY_MS).toISOString();
    }
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

/** Answers given today (local date) in SRS-mode tests — they count against srs.daily_limit. Blanks do not count. */
export function srsAnswersToday(attempts: Attempt[], now = Date.now()): number {
  const today = localDateKey(new Date(now));
  return attempts
    .filter((a) => !a.rushed && a.mode === 'srs' && localDateKey(a.finished) === today)
    .reduce((n, a) => n + a.answers.filter((r) => r.pick).length, 0);
}

export interface ReviewQueue {
  due: Question[]; // every due question of the pool, lowest recall probability first
  today: Question[]; // the share offered today (srs.daily_limit minus SRS answers already given today)
  backlog: number; // due questions beyond today's cap
  remaining: number; // reviews still allowed today
}

export function reviewQueue(pool: Question[], states: Map<string, QuestionState>, attempts: Attempt[], cfg: AppConfig, now = Date.now()): ReviewQueue {
  const due = pool.filter((q) => isDue(states.get(q.id), now)).sort((a, b) => compareDue(states.get(a.id), states.get(b.id)));
  const cap = cfg.srs.daily_limit;
  const remaining = cap > 0 ? Math.max(0, cap - srsAnswersToday(attempts, now)) : due.length;
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

/** Readiness evidence of one answer (undefined: never viewed, or the question is retired / gone). */
function readinessItem(r: Attempt['answers'][number], bank: BankState, ageDays: number): ReadinessItem | undefined {
  if (isUnviewed(r)) return undefined;
  const q = bank.byId.get(r.q);
  if (!q || q.status === 'retired') return undefined;
  const it: ReadinessItem = { domain: q.domain, ok: r.ok, ageDays, longForm: q.longForm, difficulty: q.difficulty };
  if (r.recognized) it.recognized = true;
  return it;
}

/**
 * The readiness the stats page would have shown at time `at`: same items and weights as computeStats (non-rushed
 * attempts, never-viewed answers and retired questions left out, recognized answers discounted), restricted to attempts
 * finished by `at` (and not `opts.exclude`), ages measured from `at`. `answers` = evidence behind it (0 → no readiness yet).
 */
export function readinessAt(attempts: Attempt[], bank: BankState, cfg: AppConfig, at: number, opts: { exclude?: string } = {}): Readiness & { answers: number } {
  const items: ReadinessItem[] = [];
  for (const a of attempts) {
    const t = timeOf(a.finished);
    if (a.rushed || t > at || (opts.exclude !== undefined && a.id === opts.exclude)) continue;
    const ageDays = Math.max(0, (at - t) / DAY_MS);
    for (const r of a.answers) {
      const it = readinessItem(r, bank, ageDays);
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
}

function bucketize(map: Map<string, Acc>, bankCount: Map<string, number>, label: (k: string) => string): Bucket[] {
  const keys = new Set([...map.keys(), ...bankCount.keys()]);
  return [...keys].map((key) => {
    const a = map.get(key) ?? { attempts: 0, correct: 0, qs: new Set<string>(), time: 0, est: 0 };
    return {
      key,
      label: label(key),
      attempts: a.attempts,
      correct: a.correct,
      accuracy: pct(a.correct, a.attempts),
      questions: a.qs.size,
      bank: bankCount.get(key) ?? 0,
      avgTime: a.attempts ? Math.round(a.time / a.attempts) : 0,
      avgEst: a.attempts ? Math.round(a.est / a.attempts) : 0,
    };
  });
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
}

/**
 * Everything GET /api/stats shows, from the learning view of the history (regradeAttempts) and its states. Rushed
 * attempts and never-viewed answers are left out (the latter are counted in `unviewed`); sealed questions are left out of
 * every bank denominator (coverage, buckets' `bank`, boxes), the review queue and the question lists until released.
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
  for (const a of used) {
    const day = localDateKey(a.finished);
    const dd = daily.get(day) ?? { answers: 0, correct: 0, seconds: 0 };
    dd.seconds += a.timeUsed;
    studySeconds += a.timeUsed;
    const finishedAt = timeOf(a.finished);
    const ageDays = Math.max(0, (now - finishedAt) / DAY_MS);
    const recent = finishedAt >= exposureSince;
    for (const r of a.answers) {
      if (isUnviewed(r)) {
        unviewed++;
        continue;
      }
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
          const x = acc[d].get(k) ?? { attempts: 0, correct: 0, qs: new Set<string>(), time: 0, est: 0 };
          x.attempts++;
          if (r.ok) x.correct++;
          x.qs.add(r.q);
          x.time += r.t;
          x.est += r.est;
          acc[d].set(k, x);
        }
      }
      const it = readinessItem(r, bank, ageDays);
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
    byTopic: bucketize(acc.topic, bankCount.topic, topicLabel).sort((a, b) => b.bank - a.bank),
    byDifficulty: bucketize(acc.difficulty, bankCount.difficulty, diffLabel),
    byService: bucketize(acc.service, bankCount.service, (k) => k).filter((b) => b.attempts > 0).sort((a, b) => b.attempts - a.attempts),
    byTag: bucketize(acc.tag, bankCount.tag, (k) => k).filter((b) => b.attempts > 0).sort((a, b) => b.attempts - a.attempts),
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
  };
}
