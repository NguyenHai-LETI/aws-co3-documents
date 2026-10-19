// [L] Exam-date forecast, review workload and calibration against external practice-exam scores (pure functions).
//
// Forecast for the exam day, per exam domain d (weights from taxonomy.yaml, e.g. 30/26/24/20):
//   seen question q    → FSRS-6 recall probability on the exam day
//                         ifStopNow:  R(exam − last answer, S) — no further study
//                         onSchedule: every review that falls due before the exam is done on its due day (overdue ones
//                                     today) and answered "good" → R(exam − last scheduled review, S′) ≥ desired retention
//   unseen question    → first-attempt accuracy of the learner in that domain, Laplace prior (ok + 1) / (n + 2)
//   acc_d = Σ_q p_q / active questions of d · exam % = Σ_d f_d · acc_d (f_d = weight share)
// Calibration: offset = mean(external score − app readiness on that date) over the last 5 external scores.
import type { BankState } from './bank.ts';
import { dayKey, dayOfKey, localDay, scheduler, type Scheduler } from './fsrs.ts';
import type { Attempt, ExamForecast, ExternalCalibration, ExternalScore, Question, QuestionState, WorkloadDay } from '../../shared/types.ts';

const round1 = (x: number) => Math.round(x * 10) / 10;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** Simulated reviews per question are capped (an interval never shrinks below 1 day, so this is only a safety net). */
const MAX_SIM_REVIEWS = 120;

/** First-attempt tallies per domain: the chronologically first non-rushed answer of every question. */
export function firstTryByDomain(attempts: Attempt[], bank: BankState): Map<string, { n: number; ok: number }> {
  const ordered = attempts
    .filter((a) => !a.rushed)
    .map((a, i) => ({ a, i, at: Date.parse(a.finished) || 0 }))
    .sort((x, y) => x.at - y.at || x.i - y.i);
  const seen = new Set<string>();
  const out = new Map<string, { n: number; ok: number }>();
  for (const { a } of ordered) {
    for (const r of a.answers) {
      if (seen.has(r.q)) continue;
      seen.add(r.q);
      const q = bank.byId.get(r.q);
      if (!q) continue;
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
  const t = Date.parse(s.lastAt);
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
}

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
  const active = bank.questions.filter((q) => q.status === 'active');
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
  return {
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
