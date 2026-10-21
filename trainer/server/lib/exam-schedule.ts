// [v5 · λ] Exam-aware planning from goal.examDate (srs.exam_aware): phases by days left, the daily new-question quota,
// the final-review ("ôn chốt") queue of not-yet-due questions with the lowest recall on exam day, catch-up advice and
// go / no-go. Pure derivation from results + goal.md (no hidden state); the scheduler side (final-review clamp, load
// balancing, final_retention ramp) lives in due-planner.ts, the sprint / final-week plan file in sprint.ts.
// Consumers: select.ts (today mix, 'advance' picks), progress.ts (GET /api/progress), sprint.ts, μ UI.
//
// Phases (days left = exam day − today): build > 14 · measure 14…8 · consolidate 7…3 · light 2…1 · exam-day 0 · after < 0.
// New-question quota = ceil(eligible unseen at the start of today ÷ max(1, days to exam − srs.new_cutoff_days)); eligible =
//   active practice pool (not sealed, in scope), never answered. Paused (perDay 0, with a reason) when the review backlog
//   exceeds 2 × srs.daily_limit or the phase adds no new questions.
// Catch-up: backlog > srs.daily_limit → clear the part beyond the limit in 2–7 days at daily_limit + extra reviews a day.
// Go / no-go (from T−14): the last two fresh scores ≥ 80 % · calibrated readiness ≥ target · no domain forecast < 65 %.
import type { AppConfig } from '../config.ts';
import { currentConfig, type Ctx } from '../context.ts';

/** What the schedule functions read from the request context (unit tests pass partial contexts). */
export type ScheduleCtx = Pick<Ctx, 'cfg' | 'bank' | 'attempts' | 'states'>;
import { dayKey, dayOfKey, dayStartMs, localDay, scheduler } from './fsrs.ts';
import { memoryOf } from './forecast.ts';
import { resolveFsrsParams } from './fsrs-optimize.ts';
import { pausedLeeches } from './leech.ts';
import { computeProgress } from './progress.ts';
import { resultAnnotations } from './regrade.ts';
import { loadSealed, sealedIds } from './sealed.ts';
import { answeredOn, isDue, reviewQueue } from './stats.ts';
import { localDateKey } from './time.ts';
import { practicePool, stableHash } from '../../shared/filters.ts';
import { PHASE_INFO } from '../../shared/labels.ts';
import { scaledScore } from '../../shared/scoring.ts';
import type { Attempt, ExamForecast, ExamGoal, ExamPhaseId, ExamPhaseInfo, GoNoGo, NewQuota, Question, SealedState } from '../../shared/types.ts';

/** Phase boundaries in days left (inclusive lower ends). */
export const PHASE_MEASURE_FROM = 14;
export const PHASE_CONSOLIDATE_FROM = 7;
export const PHASE_LIGHT_FROM = 2;
/** Daily cap of the light phase (minutes) and of the exam-day warm-up. */
export const LIGHT_MAX_MINUTES = 30;
export const EXAM_DAY_MAX_MINUTES = 10;
/** Go / no-go: shown from this many days before the exam; thresholds. */
export const GO_NO_GO_DAYS = 14;
export const GO_FRESH_MIN = 80;
export const GO_FRESH_ANSWERS = 20;
export const GO_DOMAIN_MIN = 65;
/** Readiness needs this many answers before the go / no-go readiness check counts. */
export const GO_READINESS_ANSWERS = 50;
/** Catch-up period length bounds (days). */
export const CATCH_UP_MIN_DAYS = 2;
export const CATCH_UP_MAX_DAYS = 7;

const ddmm = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

/** srs.exam_aware on and a valid exam date → the exam day number, else undefined. */
export function examDayOf(goal: ExamGoal, cfg: Pick<AppConfig, 'srs'>): number | undefined {
  if (cfg.srs.exam_aware === false || !goal.examDate) return undefined;
  return dayOfKey(goal.examDate);
}

function phaseId(daysLeft: number): ExamPhaseId {
  if (daysLeft < 0) return 'after';
  if (daysLeft === 0) return 'exam-day';
  if (daysLeft <= PHASE_LIGHT_FROM) return 'light';
  if (daysLeft <= PHASE_CONSOLIDATE_FROM) return 'consolidate';
  if (daysLeft <= PHASE_MEASURE_FROM) return 'measure';
  return 'build';
}

/** Phase for `today` (YYYY-MM-DD) — undefined without an exam date or with srs.exam_aware off. */
export function examPhase(goal: ExamGoal, today: string, cfg: Pick<AppConfig, 'srs'> = currentConfig()): ExamPhaseInfo | undefined {
  const exam = examDayOf(goal, cfg);
  const day = dayOfKey(today);
  if (exam === undefined || day === undefined) return undefined;
  const daysLeft = exam - day;
  const id = phaseId(daysLeft);
  const cutoff = dayKey(exam - Math.max(0, cfg.srs.new_cutoff_days ?? 0));
  const info: ExamPhaseInfo = { id, label: PHASE_INFO[id]?.label ?? id, daysLeft, rules: [], newQuestions: true };
  switch (id) {
    case 'build':
      info.to = dayKey(exam - PHASE_MEASURE_FROM - 1);
      info.rules = [
        `Mỗi ngày: câu đến hạn ôn + câu mới theo hạn mức — gặp hết câu mới trước ${ddmm(cutoff)}`,
        'Ôn đúng hạn quan trọng hơn làm thật nhiều câu mới',
        `Từ ${ddmm(dayKey(exam - PHASE_MEASURE_FROM))}: thi thử định kỳ để đo và vá`,
      ];
      break;
    case 'measure':
      info.from = dayKey(exam - PHASE_MEASURE_FROM);
      info.to = dayKey(exam - PHASE_CONSOLIDATE_FROM - 1);
      info.rules = [
        'Thi thử Pearson cách nhau 3–4 ngày, chữa bài ngay sau mỗi lần',
        '“Học hôm nay” nghiêng về task yếu nhất',
        day < exam - (cfg.srs.new_cutoff_days ?? 0) ? `Câu mới chỉ đến ${ddmm(cutoff)}, ưu tiên domain còn thiếu` : 'Đã qua mốc câu mới: chỉ còn câu chưa gặp ở domain còn thiếu',
      ];
      break;
    case 'consolidate':
      info.from = dayKey(exam - PHASE_CONSOLIDATE_FROM);
      info.to = dayKey(exam - PHASE_LIGHT_FROM - 1);
      info.newQuestions = false;
      info.rules = ['Không thêm câu mới', 'Ôn trước hạn câu có xác suất nhớ thấp vào ngày thi', 'Làm lại câu sai và cặp dịch vụ hay nhầm'];
      break;
    case 'light':
      info.from = dayKey(exam - PHASE_LIGHT_FROM);
      info.to = dayKey(exam - 1);
      info.newQuestions = false;
      info.maxMinutes = LIGHT_MAX_MINUTES;
      info.rules = [`Tối đa ${LIGHT_MAX_MINUTES}′ mỗi ngày`, 'Chỉ ôn lỗi “chắc mà sai” và cặp dễ nhầm — không thi thử dài', 'Ngủ đủ, không học khuya đêm trước ngày thi'];
      break;
    case 'exam-day':
      info.from = info.to = dayKey(exam);
      info.newQuestions = false;
      info.maxMinutes = EXAM_DAY_MAX_MINUTES;
      info.rules = [`Không học thêm — nếu muốn, khởi động ≤ ${EXAM_DAY_MAX_MINUTES}′ bằng câu đã vững`, 'Checklist: giấy tờ tuỳ thân, giờ check-in, máy và mạng nếu thi online'];
      break;
    case 'after':
      info.from = dayKey(exam + 1);
      info.rules = ['Ngày thi đã qua — cập nhật ngày thi mới nếu bạn thi lại', 'Lịch ôn trở lại bình thường'];
      break;
  }
  return info;
}

// ── new-question quota ──────────────────────────────────────────────────────

/** Questions practice modes may serve (active, not sealed, in scope with practice.exclude_out_of_scope). */
export function practiceQuestions(ctx: Pick<ScheduleCtx, 'bank' | 'cfg'>, sealed: Set<string> = sealedIds()): Question[] {
  return practicePool(ctx.bank.questions, { sealed, excludeOutOfScope: ctx.cfg.practice?.exclude_out_of_scope !== false });
}

/** Distinct questions answered for the first time (exposure 1 in the learning view) on local day `today` — siblings served in place of a due question (`for`) are reviews, not new questions. */
export function firstSeenOn(attempts: Attempt[], today: string): Set<string> {
  const ids = new Set<string>();
  for (const a of attempts) {
    if (a.rushed || !a.finished || localDateKey(a.finished) !== today) continue;
    for (const r of a.answers) if (r.exposure === 1 && !r.relearn && !r.skipped && !r.for) ids.add(r.q); // a swapped sibling (`for`) is a review, not a new question
  }
  return ids;
}

/** New questions per day to see everything before exam − srs.new_cutoff_days (undefined: no exam date / exam_aware off / exam passed). */
export function newQuota(ctx: ScheduleCtx, goal: ExamGoal, today: string): NewQuota | undefined {
  const phase = examPhase(goal, today, ctx.cfg);
  const exam = examDayOf(goal, ctx.cfg);
  const day = dayOfKey(today);
  if (!phase || exam === undefined || day === undefined || phase.id === 'after') return undefined;
  const cutoffDay = exam - Math.max(0, ctx.cfg.srs.new_cutoff_days ?? 0);
  const daysLeft = Math.max(1, cutoffDay - day);
  const pool = practiceQuestions(ctx);
  const unseen = pool.filter((q) => !ctx.states.has(q.id)).length;
  const done = firstSeenOn(ctx.attempts, today);
  const inPool = new Set(pool.map((q) => q.id));
  const doneToday = [...done].filter((id) => inPool.has(id)).length;
  // the day's quota stays put while the learner works through it: unseen as of this morning
  let perDay = unseen + doneToday > 0 ? Math.ceil((unseen + doneToday) / daysLeft) : 0;
  const quota: NewQuota = { perDay, unseen, cutoff: dayKey(cutoffDay), daysLeft, doneToday };
  const limit = ctx.cfg.srs.daily_limit;
  const backlog = limit > 0 ? reviewQueue(pool, ctx.states, ctx.attempts, ctx.cfg).due.length : 0;
  if (!phase.newQuestions) quota.paused = `Giai đoạn “${phase.label}”: không thêm câu mới — tập trung ôn và củng cố.`;
  else if (day >= cutoffDay) quota.paused = `Đã qua mốc câu mới (${ddmm(dayKey(cutoffDay))}): không thêm câu mới — tập trung ôn và vá task yếu.`;
  else if (limit > 0 && backlog > 2 * limit) quota.paused = `Đang tồn ${backlog} câu đến hạn ôn (hơn 2 × ${limit} câu/ngày) — ôn bớt trước, câu mới tạm dừng.`;
  if (quota.paused) perDay = 0;
  quota.perDay = perDay;
  return quota;
}

// ── final-review ("advance") queue ──────────────────────────────────────────

/**
 * Final-review period: not-yet-due question ids (practice pool, seen, not answered today, not a parked leech) whose recall
 * on exam day without another review is below max(0.9, srs.final_retention) — lowest recall × domain weight first, stable
 * hash on ties. Empty without an exam ahead.
 */
export function advanceQueue(ctx: ScheduleCtx, goal: ExamGoal, today: string, limit: number): string[] {
  const exam = examDayOf(goal, ctx.cfg);
  const day = dayOfKey(today);
  if (exam === undefined || day === undefined || exam < day || !(limit > 0)) return [];
  const sched = scheduler(resolveFsrsParams(ctx.cfg).weights, ctx.cfg.srs.desired_retention);
  const threshold = Math.max(0.9, ctx.cfg.srs.final_retention || 0);
  const tax = ctx.bank.taxonomy;
  const totalWeight = tax.domains.reduce((s, d) => s + d.weight, 0) || 1;
  const weight = new Map(tax.domains.map((d) => [d.id, d.weight / totalWeight]));
  const done = answeredOn(ctx.attempts, today);
  const paused = pausedLeeches(today);
  const now = Date.now();
  const scored: { id: string; key: number; h: number }[] = [];
  for (const q of practiceQuestions(ctx)) {
    const s = ctx.states.get(q.id);
    const m = memoryOf(s);
    if (!s || !m || done.has(q.id) || isDue(s, now) || (s.leech && paused.has(q.id))) continue;
    const r = sched.recall(exam - m.lastDay, m.stability);
    if (r >= threshold) continue;
    scored.push({ id: q.id, key: (1 - r) * (weight.get(q.domain) ?? 0.25), h: stableHash(q.id, `advance:${today}`) });
  }
  scored.sort((a, b) => b.key - a.key || a.h - b.h);
  return scored.slice(0, Math.round(limit)).map((x) => x.id);
}

// ── catch-up ────────────────────────────────────────────────────────────────

/**
 * Behind schedule (backlog of due reviews > srs.daily_limit): clear the part beyond the limit in 2–7 days (half the limit
 * extra per day as a guide, never past exam − 2) at daily_limit + extra reviews a day. Undefined when not behind.
 */
export function catchUpOf(backlog: number, dailyLimit: number, daysToExam?: number): { backlog: number; days: number; perDay: number } | undefined {
  if (!(dailyLimit > 0) || !(backlog > dailyLimit)) return undefined;
  const extra = backlog - dailyLimit;
  let days = Math.min(CATCH_UP_MAX_DAYS, Math.max(CATCH_UP_MIN_DAYS, Math.ceil(extra / (dailyLimit / 2))));
  if (daysToExam !== undefined && daysToExam - 2 >= 1) days = Math.min(days, daysToExam - 2);
  days = Math.max(1, days);
  return { backlog, days, perDay: dailyLimit + Math.ceil(extra / days) };
}

// ── go / no-go ──────────────────────────────────────────────────────────────

export interface FreshScore {
  date: string; // YYYY-MM-DD
  finished: string;
  label: string;
  score: number; // percent
  answers: number; // first-time (fresh) answers behind it
  official: boolean; // a sealed sitting recorded in results/sealed.md
}

/**
 * Fresh scores, newest first: official sealed sittings (the attempt sealed.md records per used form, as graded) and the
 * first-time split of other exam-like attempts (mode exam, Pearson included) with ≥ GO_FRESH_ANSWERS first-time answers.
 */
export function freshScores(attempts: Attempt[], sealed: SealedState = loadSealed()): FreshScore[] {
  const byId = new Map(attempts.map((a) => [a.id, a]));
  const official = new Map<string, string>();
  for (const f of sealed.forms) if (f.status === 'used' && f.attempt) official.set(f.attempt, f.id);
  const out: FreshScore[] = [];
  for (const [attemptId, form] of official) {
    const a = byId.get(attemptId);
    if (!a || a.rushed || !a.finished) continue;
    out.push({ date: localDateKey(a.finished), finished: a.finished, label: `Đề niêm phong ${form}`, score: a.score, answers: a.total, official: true });
  }
  for (const a of attempts) {
    if (a.rushed || a.mode !== 'exam' || official.has(a.id) || !a.finished || a.source) continue;
    const fresh = resultAnnotations(a).fresh;
    if (!fresh || fresh.answers < GO_FRESH_ANSWERS) continue;
    const score = Math.round((fresh.correct / fresh.answers) * 1000) / 10;
    out.push({ date: localDateKey(a.finished), finished: a.finished, label: `${a.pearson ? 'Thi thử Pearson' : 'Thi thử'} ${ddmm(localDateKey(a.finished))}`, score, answers: fresh.answers, official: false });
  }
  return out.sort((x, y) => (Date.parse(y.finished) || 0) - (Date.parse(x.finished) || 0));
}

export interface GoNoGoInput {
  goal: ExamGoal;
  today: string;
  fresh: FreshScore[];
  readiness?: { value: number; answers: number; calibrated?: number }; // percent; calibrated = after the external offset
  forecast?: ExamForecast;
  domainLabels?: Record<string, string>;
  passScaled: number;
  now?: number; // ms — whether the reschedule deadline has passed (default: the exam day counts as passed)
}

/** "Thi hay dời?" from the three checks (see the header); undefined outside [exam − 14, exam]. Advice only. */
export function goNoGoFrom(input: GoNoGoInput): GoNoGo | undefined {
  const exam = input.goal.examDate ? dayOfKey(input.goal.examDate) : undefined;
  const day = dayOfKey(input.today);
  if (exam === undefined || day === undefined || exam - day > GO_NO_GO_DAYS || exam < day) return undefined;
  const checks: GoNoGo['checks'] = [];
  // 1. fresh scores
  const last = input.fresh.slice(0, 2);
  checks.push({
    id: 'fresh',
    label: `2 bài “câu mới” gần nhất ≥ ${GO_FRESH_MIN}%`,
    ok: last.length < 2 ? null : last.every((s) => s.score >= GO_FRESH_MIN),
    detail: last.length
      ? `${last.map((s) => `${s.label}: ${s.score}%${s.official ? '' : ` (${s.answers} câu mới)`}`).join(' · ')}${last.length < 2 ? ' — cần thêm 1 bài (đề niêm phong hoặc thi thử có ≥ 20 câu mới)' : ''}`
      : `Chưa có — làm đề niêm phong hoặc thi thử Pearson (≥ ${GO_FRESH_ANSWERS} câu chưa gặp)`,
  });
  // 2. calibrated readiness vs the target
  const targetScaled = input.goal.targetScaled ?? input.passScaled;
  const r = input.readiness;
  const value = r ? (r.calibrated ?? r.value) : undefined;
  checks.push({
    id: 'readiness',
    label: `Mức sẵn sàng${r?.calibrated !== undefined ? ' (đã hiệu chỉnh)' : ''} ≥ mục tiêu ${targetScaled}`,
    ok: !r || r.answers < GO_READINESS_ANSWERS || value === undefined ? null : scaledScore(value) >= targetScaled,
    detail:
      !r || r.answers < GO_READINESS_ANSWERS || value === undefined
        ? `Chưa đủ dữ liệu — cần ≥ ${GO_READINESS_ANSWERS} câu đã làm (hiện ${r?.answers ?? 0})`
        : `${scaledScore(value)}/1000 (${value}%)${r.calibrated === undefined ? ' — chưa hiệu chỉnh bằng điểm thi thử bên ngoài' : ''}`,
  });
  // 3. no weak domain on exam day
  const rows = input.forecast?.byDomain ?? [];
  const low = rows.filter((d) => d.onSchedule < GO_DOMAIN_MIN);
  checks.push({
    id: 'domains',
    label: `Không domain nào dự báo < ${GO_DOMAIN_MIN}%`,
    ok: !rows.length || !input.forecast?.seen ? null : low.length === 0,
    detail: !rows.length || !input.forecast?.seen
      ? 'Chưa có dự báo theo domain'
      : low.length
        ? `Thấp: ${low.map((d) => `${input.domainLabels?.[d.domain] ?? d.domain} ${d.onSchedule}%`).join(', ')}`
        : `Thấp nhất: ${[...rows].sort((a, b) => a.onSchedule - b.onSchedule).map((d) => `${input.domainLabels?.[d.domain] ?? d.domain} ${d.onSchedule}%`)[0]}`,
  });
  const verdict: GoNoGo['verdict'] = checks.some((c) => c.ok === false) ? 'reschedule' : checks.every((c) => c.ok === true) ? 'go' : 'unknown';
  // last moment to reschedule: exam time − 24 h (the start of the exam day when no time is set)
  const [hh, mm] = (input.goal.examTime ?? '00:00').split(':').map(Number);
  const deadlineDay = dayKey(exam - 1);
  const deadline = `${deadlineDay}T${String(hh || 0).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')}`;
  const deadlineMs = dayStartMs(exam - 1) + ((hh || 0) * 60 + (mm || 0)) * 60_000;
  const closed = input.now !== undefined ? input.now >= deadlineMs : day >= exam;
  const advice = closed
    ? `Đã qua hạn dời lịch (24 giờ trước giờ thi)${verdict === 'go' ? ' — đủ cả 3 tiêu chí: thi theo lịch.' : ' — giữ lịch, làm nhẹ nhàng và ngủ đủ.'}`
    : verdict === 'go'
      ? 'Đủ cả 3 tiêu chí: giữ lịch thi.'
      : verdict === 'reschedule'
        ? `Chưa đạt ${checks.filter((c) => c.ok === false).length} tiêu chí: cân nhắc dời lịch trước ${deadlineDay.slice(8, 10)}/${deadlineDay.slice(5, 7)} ${input.goal.examTime ?? '00:00'}.`
        : 'Chưa đủ dữ liệu để khuyên — làm thêm đề niêm phong / thi thử.';
  return {
    verdict,
    checks,
    deadline,
    note: `${advice} Chỉ là lời khuyên, không phải quyết định. Quy định AWS: dời hoặc huỷ chậm nhất 24 giờ trước giờ thi, mỗi lịch thi dời tối đa 2 lần; nếu trượt phải chờ 14 ngày mới thi lại và trả lệ phí đầy đủ.${input.goal.examTime ? '' : ' Chưa đặt giờ thi — hạn dời tính từ 00:00 ngày thi.'}`,
  };
}

/**
 * "Thi hay dời?" from 14 days before the exam — the same numbers as GET /api/progress (computeProgress with this goal);
 * undefined outside that window, without an exam date or with srs.exam_aware off.
 */
export function goNoGo(ctx: ScheduleCtx, goal: ExamGoal, today: string): GoNoGo | undefined {
  if (examDayOf(goal, ctx.cfg) === undefined) return undefined;
  const day = dayOfKey(today);
  if (day === undefined) return undefined;
  const now = day === localDay(Date.now()) ? Date.now() : dayStartMs(day) + 12 * 3_600_000;
  return computeProgress(ctx, now, goal).goNoGo;
}
