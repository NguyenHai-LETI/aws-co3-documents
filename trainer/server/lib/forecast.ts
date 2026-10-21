// [L] Exam-date forecast, review workload and calibration against external practice-exam scores (pure functions).
//
// Forecast for the exam day, per exam domain d (weights from taxonomy.yaml, e.g. 30/26/24/20):
//   seen question q    → FSRS-6 recall probability on the exam day
//                         ifStopNow:  R(exam − last answer, S) — no further study
//                         onSchedule: every review that falls due before the exam is done on its due day (overdue ones
//                                     today) and answered "good" → R(exam − last scheduled review, S′) ≥ desired retention
//   unseen question    → first-attempt accuracy of the learner in that domain, Laplace prior (ok + 1) / (n + 2)
//                         (first *viewed* answer of each question: never-viewed blanks are not attempts)
//   acc_d = Σ_q p_q / active questions of d · exam % = Σ_d f_d · acc_d (f_d = weight share)
//   Sealed questions (held back for the sealed forms) are not part of the practice bank: left out of every count.
// Calibration: offset = mean(external score − app readiness on that date) over the last 5 external scores (sealed
// forms of this app count as internal scores, see progress.ts).
import type { BankState } from './bank.ts';
import { dayKey, dayOfKey, localDay, scheduler, type Scheduler } from './fsrs.ts';
import { isUnviewed, notReadinessReason } from './regrade.ts';
import { DuePlanner } from './due-planner.ts';
import type { AppConfig } from '../config.ts';
import { stableHash } from '../../shared/filters.ts';
import type { Attempt, ExamForecast, ExternalCalibration, ExternalScore, Question, QuestionState, WorkloadDay } from '../../shared/types.ts';

const round1 = (x: number) => Math.round(x * 10) / 10;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** Simulated reviews per question are capped (an interval never shrinks below 1 day, so this is only a safety net). */
const MAX_SIM_REVIEWS = 120;

/**
 * First-attempt tallies per domain: the chronologically first viewed answer (non-rushed attempts) of every question.
 * [v5] Skipped blanks and relearning retries are not answers; a first exposure that is self-graded (Anki / listen) or in
 * a retest marks the question as seen without being a first-try sample.
 */
export function firstTryByDomain(attempts: Attempt[], bank: BankState): Map<string, { n: number; ok: number }> {
  const ordered = attempts
    .filter((a) => !a.rushed)
    .map((a, i) => ({ a, i, at: Date.parse(a.finished) || 0 }))
    .sort((x, y) => x.at - y.at || x.i - y.i);
  const seen = new Set<string>();
  const out = new Map<string, { n: number; ok: number }>();
  for (const { a } of ordered) {
    for (const r of a.answers) {
      if (seen.has(r.q) || isUnviewed(r) || r.skipped || r.relearn) continue;
      seen.add(r.q);
      const q = bank.byId.get(r.q);
      if (!q || r.grade !== undefined || notReadinessReason(a) !== undefined) continue;
      const t = out.get(q.domain) ?? { n: 0, ok: 0 };
      t.n++;
      if (r.ok) t.ok++;
      out.set(q.domain, t);
    }
  }
  return out;
}

/** Laplace-smoothed probability (ok + 1) / (n + 2). */
export const laplace = (t: { n: number; ok: number } | undefined) => ((t?.ok ?? 0) + 1) / ((t?.n ?? 0) + 2);

export interface MemoryAt {
  stability: number;
  difficulty: number;
  lastDay: number; // local day number of the last answer
}

/** Memory of a question from its computed state (FSRS fields), undefined when unseen / not FSRS. */
export function memoryOf(s: QuestionState | undefined): MemoryAt | undefined {
  if (!s?.lastAt || s.stability === undefined || s.fsrsDifficulty === undefined) return undefined;
  const t = Date.parse(s.reviewedAt ?? s.lastAt); // [v5] a sibling's `for` answer can be the last review
  if (!Number.isFinite(t)) return undefined;
  return { stability: Math.max(0.01, s.stability), difficulty: clamp(s.fsrsDifficulty, 1, 10), lastDay: localDay(t) };
}

/**
 * Recall probability of one seen question on `examDay` if study stops now, and if every review due before the exam is
 * done on time (due day, overdue ones `today`) with grade "good". `reviews` = simulated reviews until the exam.
 */
export function questionForecast(m: MemoryAt, examDay: number, today: number, sched: Scheduler): { stop: number; schedule: number; reviews: number } {
  const stop = sched.recall(examDay - m.lastDay, m.stability);
  let day = m.lastDay;
  let mem = { stability: m.stability, difficulty: m.difficulty };
  let reviews = 0;
  while (reviews < MAX_SIM_REVIEWS) {
    const due = Math.max(day + sched.interval(mem.stability), today);
    if (due > examDay) break;
    mem = sched.review(mem, 3, due - day);
    day = due;
    reviews++;
  }
  return { stop, schedule: Math.max(stop, sched.recall(examDay - day, mem.stability)), reviews };
}

export interface ForecastOptions {
  weights: readonly number[];
  desiredRetention: number;
  now?: number;
  exclude?: Set<string>; // question ids outside the practice bank (sealed forms)
  // [v5] exam-aware lines (examAware, capacity) — only with srs.exam_aware on and the exam ahead
  policy?: {
    srs: AppConfig['srs'];
    minutesPerDay?: number; // goal.minutesPerDay (added to the capacity lines)
    restDays?: number[]; // goal.restDays: no study on these weekdays
    pace?: number; // learnerPace (seconds per question = estimate × pace)
    excludeOutOfScope?: boolean; // practice.exclude_out_of_scope: such unseen questions are never "learned"
  };
}

/** Capacity lines: minutes per day simulated (+ the goal's minutes); horizon of the day-by-day simulation. */
export const CAPACITY_MINUTES = [10, 20, 45];
export const CAPACITY_MAX_DAYS = 120;

/** Expected exam score (percent) on `examDate` — see the header for the model. */
export function forecastExam(states: Map<string, QuestionState>, bank: BankState, attempts: Attempt[], examDate: string, opts: ForecastOptions): ExamForecast {
  const now = opts.now ?? Date.now();
  const today = localDay(now);
  const examDay = dayOfKey(examDate) ?? today;
  const at = Math.max(examDay, today); // a past exam date is forecast for today
  const sched = scheduler(opts.weights, opts.desiredRetention);
  const first = firstTryByDomain(attempts, bank);
  const domains = bank.taxonomy.domains;
  const totalWeight = domains.reduce((s, d) => s + d.weight, 0) || 1;
  const active = bank.questions.filter((q) => q.status === 'active' && !opts.exclude?.has(q.id));
  const byDomain = new Map<string, Question[]>();
  for (const q of active) {
    const list = byDomain.get(q.domain);
    if (list) list.push(q);
    else byDomain.set(q.domain, [q]);
  }

  let seenAll = 0;
  let reviewsUntilExam = 0;
  let stopTotal = 0;
  let scheduleTotal = 0;
  const firstAll = { n: 0, ok: 0 };
  const rows: ExamForecast['byDomain'] = [];
  for (const d of domains) {
    const qs = byDomain.get(d.id) ?? [];
    const pFirst = laplace(first.get(d.id));
    firstAll.n += first.get(d.id)?.n ?? 0;
    firstAll.ok += first.get(d.id)?.ok ?? 0;
    let stop = 0;
    let schedule = 0;
    let seen = 0;
    for (const q of qs) {
      const m = memoryOf(states.get(q.id));
      if (!m) {
        stop += pFirst;
        schedule += pFirst;
        continue;
      }
      seen++;
      const f = questionForecast(m, at, today, sched);
      stop += f.stop;
      schedule += f.schedule;
      reviewsUntilExam += f.reviews;
    }
    const n = qs.length;
    const accStop = n ? stop / n : pFirst;
    const accSchedule = n ? schedule / n : pFirst;
    const share = d.weight / totalWeight;
    stopTotal += share * accStop;
    scheduleTotal += share * accSchedule;
    seenAll += seen;
    rows.push({
      domain: d.id,
      ifStopNow: round1(100 * accStop),
      onSchedule: round1(100 * accSchedule),
      coverage: n ? round1((100 * seen) / n) : 0,
      firstTry: round1(100 * pFirst),
      weight: d.weight,
    });
  }
  const coverage = active.length ? round1((100 * seenAll) / active.length) : 0;
  const daysLeft = examDay - today;
  const firstTry = round1(100 * laplace(firstAll));
  let note: string | undefined;
  if (daysLeft < 0) note = 'Ngày thi đã qua — dự báo đang tính cho hôm nay. Cập nhật ngày thi mới nếu bạn dời lịch.';
  else if (!seenAll) note = `Chưa làm câu nào: dự báo dựa hoàn toàn vào ước tính mặc định (${firstTry}%). Làm vài bài để có số liệu thật.`;
  else if (coverage < 60) note = `Bạn mới gặp ${coverage}% ngân hàng — câu chưa làm được ước tính theo tỉ lệ đúng lần đầu (${firstTry}%).`;
  const out: ExamForecast = {
    examDate: dayKey(examDay),
    daysLeft,
    ifStopNow: round1(100 * stopTotal),
    onSchedule: round1(100 * scheduleTotal),
    byDomain: rows,
    coverage,
    note,
    seen: seenAll,
    active: active.length,
    firstTry,
    reviewsUntilExam,
  };
  const policy = opts.policy;
  if (policy && policy.srs.exam_aware !== false && examDay > today) {
    const pFirst = new Map(domains.map((d) => [d.id, laplace(first.get(d.id))]));
    const share = new Map(domains.map((d) => [d.id, d.weight / totalWeight]));
    const sim = { states, active, examDay, today, weights: opts.weights, policy, pFirst, share, sched };
    out.examAware = examAwareForecast(sim);
    const minutes = [...new Set([...CAPACITY_MINUTES, ...(policy.minutesPerDay ? [policy.minutesPerDay] : [])])].sort((a, b) => a - b);
    out.capacity = minutes.map((m) => capacityForecast(sim, m));
  }
  return out;
}

// ── [v5 · λ] exam-aware and capacity-constrained forecasts ──────────────────
//
// examAware: every seen question is reviewed on its due days under the exam-aware policy (due-planner.ts: final-review
//   clamp, final_retention ramp; grade "good") → recall on exam day; every eligible unseen question (practice pool) is
//   learned on a day spread evenly over [today, exam − new_cutoff_days) per the new-question quota — first answer right
//   (p = first-try rate of its domain, FSRS "good") or wrong then relearned the same day — and reviewed the same way.
//   A learned question counts max(first-try rate, recall). After the cutoff unseen questions keep the first-try rate.
// capacity(N): the same, day by day, with only N minutes a day (rest days: none; light phase ≤ 30′): due reviews lowest
//   recall first, then new questions within the quota, each costing estimate × pace seconds (a learned question is
//   followed as two weighted branches). Horizon CAPACITY_MAX_DAYS; reviewsPerDay = reviews done ÷ days simulated.

interface SimInput {
  states: Map<string, QuestionState>;
  active: Question[];
  examDay: number;
  today: number;
  weights: readonly number[];
  policy: NonNullable<ForecastOptions['policy']>;
  pFirst: Map<string, number>;
  share: Map<string, number>;
  sched: Scheduler;
}

interface Branch {
  w: number; // probability weight of this branch
  mem: { stability: number; difficulty: number };
  last: number;
  due: number;
}

function planner(sim: SimInput): DuePlanner {
  return new DuePlanner({ srs: { ...sim.policy.srs, load_balance: false }, weights: sim.weights, examDay: sim.examDay, today: sim.today });
}

/** Unseen questions that the quota would bring in, in a stable order, and the day count until the cutoff. */
function learnable(sim: SimInput): { qs: Question[]; days: number } {
  const cutoff = sim.examDay - Math.max(0, sim.policy.srs.new_cutoff_days ?? 0);
  const consolidate = sim.examDay - 7; // no new questions from the consolidate phase on
  const days = Math.min(cutoff, consolidate) - sim.today;
  if (days < 1) return { qs: [], days: 0 };
  const qs = sim.active
    .filter((q) => !memoryOf(sim.states.get(q.id)) && !(sim.policy.excludeOutOfScope && q.outOfScope))
    .sort((a, b) => stableHash(a.id, 'learn') - stableHash(b.id, 'learn') || a.id.localeCompare(b.id));
  return { qs, days };
}

/** First exposure on `day`: right (FSRS good) or wrong + same-day relearning. */
function firstBranches(sim: SimInput, pFirst: number, day: number, plan: DuePlanner, id: string): Branch[] {
  const good = sim.sched.review(undefined, 3, 0);
  const again = sim.sched.review(sim.sched.review(undefined, 1, 0), 3, 0);
  return [
    { w: pFirst, mem: good, last: day, due: plan.plan(`${id}+`, day, good.stability) },
    { w: 1 - pFirst, mem: again, last: day, due: plan.plan(`${id}-`, day, again.stability) },
  ].filter((b) => b.w > 0);
}

/** Reviews a branch on every due day before the exam (no capacity limit); returns its recall on exam day. */
function followUnlimited(sim: SimInput, b: Branch, plan: DuePlanner, id: string): number {
  let { mem, last, due } = b;
  for (let n = 0; n < MAX_SIM_REVIEWS; n++) {
    const d = Math.max(due, sim.today);
    if (d > sim.examDay) break;
    mem = sim.sched.review(mem, 3, d - last);
    last = d;
    due = plan.plan(id, d, mem.stability, due);
  }
  return sim.sched.recall(sim.examDay - last, mem.stability);
}

function weighted(sim: SimInput, perQ: Map<string, number>): number {
  let total = 0;
  for (const [domain, share] of sim.share) {
    const qs = sim.active.filter((q) => q.domain === domain);
    const p = sim.pFirst.get(domain) ?? 0.5;
    const acc = qs.length ? qs.reduce((s, q) => s + (perQ.get(q.id) ?? p), 0) / qs.length : p;
    total += share * acc;
  }
  return round1(100 * total);
}

function examAwareForecast(sim: SimInput): number {
  const plan = planner(sim);
  const perQ = new Map<string, number>();
  for (const q of sim.active) {
    const m = memoryOf(sim.states.get(q.id));
    if (!m) continue;
    const stop = sim.sched.recall(sim.examDay - m.lastDay, m.stability);
    const b: Branch = { w: 1, mem: m, last: m.lastDay, due: plan.plan(q.id, m.lastDay, m.stability) };
    perQ.set(q.id, Math.max(stop, followUnlimited(sim, b, plan, q.id)));
  }
  const { qs, days } = learnable(sim);
  qs.forEach((q, i) => {
    const day = sim.today + Math.floor((i * days) / qs.length);
    const p = sim.pFirst.get(q.domain) ?? 0.5;
    const r = firstBranches(sim, p, day, plan, q.id).reduce((s, b) => s + b.w * followUnlimited(sim, b, plan, q.id), 0);
    perQ.set(q.id, Math.max(p, r));
  });
  return weighted(sim, perQ);
}

function capacityForecast(sim: SimInput, minutes: number): { minutesPerDay: number; expected: number; reviewsPerDay: number } {
  const plan = planner(sim);
  const pace = sim.policy.pace && sim.policy.pace > 0 ? sim.policy.pace : 1;
  const items: { q: Question; branches: Branch[]; learned: boolean; p: number }[] = [];
  for (const q of sim.active) {
    const m = memoryOf(sim.states.get(q.id));
    if (m) items.push({ q, learned: true, p: 0, branches: [{ w: 1, mem: m, last: m.lastDay, due: plan.plan(q.id, m.lastDay, m.stability) }] });
  }
  const { qs: fresh, days: learnDays } = learnable(sim);
  const perDayNew = learnDays > 0 && fresh.length ? Math.ceil(fresh.length / learnDays) : 0;
  let nextNew = 0;
  const end = Math.min(sim.examDay, sim.today + CAPACITY_MAX_DAYS);
  const rest = new Set(sim.policy.restDays ?? []);
  let reviews = 0;
  for (let d = sim.today; d < end; d++) {
    const weekday = new Date(d * 86_400_000).getUTCDay();
    let budget = rest.has(weekday) ? 0 : minutes * 60;
    if (sim.examDay - d <= 2) budget = Math.min(budget, 30 * 60); // light phase
    if (budget <= 0) continue;
    const due: { item: (typeof items)[number]; b: Branch; r: number }[] = [];
    for (const item of items) for (const b of item.branches) if (b.due <= d) due.push({ item, b, r: sim.sched.recall(d - b.last, b.mem.stability) });
    due.sort((x, y) => x.r - y.r || x.item.q.id.localeCompare(y.item.q.id));
    for (const { item, b } of due) {
      const cost = Math.max(1, item.q.time) * pace * b.w;
      if (cost > budget) continue;
      budget -= cost;
      b.mem = sim.sched.review(b.mem, 3, d - b.last);
      b.last = d;
      b.due = plan.plan(item.q.id, d, b.mem.stability, b.due);
      reviews += b.w;
    }
    if (d - sim.today < learnDays) {
      for (let n = 0; n < perDayNew && nextNew < fresh.length; n++) {
        const q = fresh[nextNew];
        const cost = Math.max(1, q.time) * pace;
        if (cost > budget) break;
        budget -= cost;
        nextNew++;
        const p = sim.pFirst.get(q.domain) ?? 0.5;
        items.push({ q, learned: false, p, branches: firstBranches(sim, p, d, plan, q.id) });
      }
    }
  }
  const perQ = new Map<string, number>();
  for (const item of items) {
    const r = item.branches.reduce((s, b) => s + b.w * sim.sched.recall(sim.examDay - b.last, b.mem.stability), 0);
    perQ.set(item.q.id, item.learned ? r : Math.max(item.p, r));
  }
  const simulated = Math.max(1, end - sim.today);
  return { minutesPerDay: minutes, expected: weighted(sim, perQ), reviewsPerDay: round1(reviews / simulated) };
}

/** Reviews falling due per local day from today for `days` days; overdue ones count on the first day. */
export function workloadDays(states: Map<string, QuestionState>, questions: Question[], days: number, now = Date.now()): WorkloadDay[] {
  const today = localDay(now);
  const out: WorkloadDay[] = Array.from({ length: Math.max(1, days) }, (_, i) => ({ date: dayKey(today + i), due: 0 }));
  let overdue = 0;
  for (const q of questions) {
    if (q.status !== 'active') continue;
    const due = states.get(q.id)?.dueAt;
    if (!due) continue;
    const t = Date.parse(due);
    if (!Number.isFinite(t)) continue;
    const i = t <= now ? 0 : localDay(t) - today;
    if (t <= now && localDay(t) < today) overdue++;
    if (i >= 0 && i < out.length) out[i].due++;
  }
  out[0].overdue = overdue;
  return out;
}

/** Calibration of the app readiness against the last `lastN` external scores that have a readiness on their date. */
export function calibrate(scores: ExternalScore[], readiness: number, lastN = 5): ExternalCalibration | undefined {
  const usable = scores
    .filter((s) => typeof s.readinessAtDate === 'number')
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, lastN);
  if (!usable.length) return undefined;
  const offset = usable.reduce((sum, s) => sum + (s.score - (s.readinessAtDate ?? 0)), 0) / usable.length;
  return { samples: usable.length, offset: round1(offset), adjustedReadiness: round1(clamp(readiness + offset, 0, 100)), readiness };
}
