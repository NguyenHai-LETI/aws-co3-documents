// [v5 · λ] Sprint / final-week plan (C2): POST /api/plan/sprint writes coach/plans/<YYYY-MM-DD>-sprint.md — a
// deterministic plan (no AI) in the coach plan format, so the Dashboard / Coach page show it with "Bắt đầu" buttons.
//   - needs goal.examDate within GO_NO_GO_DAYS (14) days and srs.exam_aware on
//   - one file per day: an existing file for today with the same exam date / time is returned unchanged (`created:
//     false`); a changed goal rewrites it (same plan id); a GET never writes
//   - days T−14 … T−1 (from today), one or two sessions a day by phase:
//       measure (14…8)   timed mocks 3–4 days apart (a still-sealed form on its suggested day, else Pearson), the day after
//                        a mock "ôn lại lỗi hôm qua", other days "Học hôm nay" (it leans to weak tasks)
//       consolidate (7…3) T−7 the last sealed form or a Pearson rehearsal at the booked hour, T−6 yesterday's errors,
//                        T−5 weak tasks + qualifier reading, T−4 a second rehearsal, T−3 retry-wrong; today's session in
//                        this phase lists the final-review (advance) questions explicitly
//       light (2…1)      "Học hôm nay" (≤ 30′, confident errors and confusable pairs only)
//     T−0 has no session: the exam-day checklist is in the body.
import fs from 'node:fs';
import path from 'node:path';
import { PLANS_DIR } from '../config.ts';
import type { Ctx } from '../context.ts';
import { splitFrontMatter, stringifyFrontMatter } from './frontmatter.ts';
import { loadPlans, planSummary } from './plans.ts';
import { ProgressError, examChecklist, loadGoal, sealedProgress } from './progress.ts';
import { GO_NO_GO_DAYS, advanceQueue, examDayOf, examPhase, goNoGo } from './exam-schedule.ts';
import { loadSealed } from './sealed.ts';
import { answeredOn } from './stats.ts';
import { dayKey, dayOfKey, localDay } from './fsrs.ts';
import { fmtLocal, localDateKey, localIso } from './time.ts';
import { PHASE_INFO } from '../../shared/labels.ts';
import type { ExamGoal, PlanSummary } from '../../shared/types.ts';

export const SPRINT_TRIGGER = 'sprint';
/** Final-review questions listed in today's consolidate session. */
export const SPRINT_ADVANCE = 20;
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export interface SprintSession {
  id: string;
  day: string; // YYYY-MM-DD
  title: string;
  why: string;
  feedback: 'practice' | 'exam';
  questions?: string[];
  filter?: Record<string, unknown>;
}

type SprintCtx = Pick<Ctx, 'cfg' | 'bank' | 'attempts' | 'states'>;

const label = (day: number) => `${WEEKDAYS[new Date(day * 86_400_000).getUTCDay()]} ${dayKey(day).slice(8, 10)}/${dayKey(day).slice(5, 7)}`;

/** Mock days of the sprint (days left); a sealed form never goes on a day with fewer than FORM_MIN_LEFT days left. */
export const SPRINT_MOCK_DAYS = [14, 10, 7, 4];
export const FORM_MIN_LEFT = 4;
/** Two sealed forms are at least this many days apart. */
const FORM_GAP = 2;

/**
 * The sessions of the sprint from `today` to the exam (deterministic: same data + date → same list).
 * Mocks: every still-sealed form gets its own day (its suggested date or the first free day after it, ≥ FORM_GAP days
 * from another form, never with fewer than FORM_MIN_LEFT days left — a form that does not fit is left out); the
 * Pearson mock days T−14 / −10 / −7 / −4 stay unless a form sits on or next to them. The day after a mock of the plan:
 * "ôn lại lỗi hôm qua". Today, in the consolidate phase: the final-review (advance) questions, one per sibling cluster.
 */
export function sprintSessions(ctx: SprintCtx, goal: ExamGoal, now = Date.now()): SprintSession[] {
  const exam = examDayOf(goal, ctx.cfg);
  const today = localDay(now);
  if (exam === undefined) return [];
  const first = Math.max(today, exam - GO_NO_GO_DAYS);
  // sealed forms, in the order of their suggested dates
  const forms = sealedProgress(loadSealed(), ctx.attempts, goal, now)
    .filter((f) => f.status === 'sealed' && f.suggested)
    .map((f) => ({ id: f.id, day: dayOfKey(f.suggested!) ?? today }))
    .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));
  const formOn = new Map<number, string>();
  for (const f of forms) {
    for (let d = Math.max(f.day, first); exam - d >= FORM_MIN_LEFT; d++) {
      if ([...formOn.keys()].some((x) => Math.abs(x - d) < FORM_GAP)) continue;
      formOn.set(d, f.id);
      break;
    }
  }
  const mockDays = new Set<number>(formOn.keys());
  for (const k of SPRINT_MOCK_DAYS) {
    const d = exam - k;
    if (d >= first && ![...formOn.keys()].some((x) => Math.abs(x - d) <= 1)) mockDays.add(d);
  }
  const at = goal.examTime ? ` lúc ${goal.examTime} (giờ thi thật)` : '';
  const out: SprintSession[] = [];
  const add = (day: number, s: Omit<SprintSession, 'id' | 'day'>) => {
    const n = out.filter((x) => x.day === dayKey(day)).length;
    out.push({ id: `t${exam - day}${n ? String.fromCharCode(97 + n) : ''}`, day: dayKey(day), ...s });
  };
  let mocks = 0;
  const mock = (day: number) => {
    const form = formOn.get(day);
    if (form) {
      add(day, { title: `T−${exam - day} · Đề niêm phong ${form}${at}`, why: 'Điểm trên câu chưa từng gặp — số đo trung thực nhất cho quyết định thi / dời.', feedback: 'exam', filter: { mode: 'sealed', form } });
    } else {
      add(day, {
        title: `T−${exam - day} · Thi thử Pearson #${++mocks}${at}`,
        why: 'Đo trong điều kiện như thi thật (65 câu, 15 câu thử nghiệm, không tạm dừng); chữa bài ngay sau khi nộp.',
        feedback: 'exam',
        filter: { mode: 'exam', pearson: true },
      });
    }
  };
  const today_ = (day: number, why: string) => add(day, { title: `T−${exam - day} · ▶ Học hôm nay`, why, feedback: 'practice', filter: { mode: 'today' } });
  for (let day = first; day < exam; day++) {
    const k = exam - day;
    if (mockDays.has(day)) {
      mock(day);
      continue;
    }
    if (k >= 3 && mockDays.has(day - 1) && day - 1 >= first)
      add(day, { title: `T−${k} · ☀️ Ôn lại lỗi hôm qua`, why: 'Sau một giấc ngủ: làm lại câu sai / chưa chắc của bài thi thử hôm qua.', feedback: 'practice', filter: { mode: 'yesterday' } });
    if (k >= 3 && k <= 7 && day === today) {
      const ids = advanceIds(ctx, goal, dayKey(day));
      if (ids.length) add(day, { title: `T−${k} · 🧲 Ôn trước hạn`, why: 'Câu chưa đến hạn nhưng xác suất nhớ vào ngày thi thấp nhất (× trọng số domain), mỗi nhóm câu anh em một câu.', feedback: 'practice', questions: ids });
    }
    if (k === 5) {
      add(day, { title: `T−${k} · 🧩 Vá task yếu`, why: 'Các task có tỉ lệ đúng (đã co về mức nền) thấp nhất.', feedback: 'practice', filter: { mode: 'weak', count: 20 } });
      add(day, { title: `T−${k} · 🎯 Đọc yêu cầu`, why: 'Cùng tình huống, đổi câu hỏi cuối (rẻ nhất / ít vận hành / an toàn nhất…).', feedback: 'practice', filter: { mode: 'qualifier' } });
    } else if (k === 3) {
      add(day, { title: `T−${k} · 🔁 Làm lại câu sai`, why: 'Câu đang sai — lần cuối trước 2 ngày nhẹ.', feedback: 'practice', filter: { mode: 'retry-wrong', count: 20 } });
    } else if (k <= 2) {
      today_(day, 'Ngày nhẹ: tối đa 30′, chỉ lỗi “chắc mà sai” và cặp dễ nhầm. Ngủ đủ.');
    } else {
      today_(day, k <= 7 ? 'Củng cố: không thêm câu mới, ôn câu có xác suất nhớ thấp vào ngày thi.' : 'Câu đến hạn, task yếu và câu mới còn trong hạn mức.');
    }
  }
  return out;
}

/** Final-review ids for a plan session: one per sibling cluster, never a sibling of a question answered today (plan `questions` lists bypass the selection rules). */
function advanceIds(ctx: SprintCtx, goal: ExamGoal, day: string): string[] {
  const clusterOf = (id: string) => ctx.bank.byId.get(id)?.cluster ?? id;
  const used = new Set([...answeredOn(ctx.attempts, day)].map(clusterOf));
  const out: string[] = [];
  for (const id of advanceQueue(ctx, goal, day, SPRINT_ADVANCE * 3)) {
    const c = clusterOf(id);
    if (used.has(c)) continue;
    used.add(c);
    out.push(id);
    if (out.length >= SPRINT_ADVANCE) break;
  }
  return out;
}

/** Builds (or returns today's) sprint plan. 400 without an exam date ahead within 14 days. */
export function sprintPlan(ctx: SprintCtx, opts: { now?: number; goal?: ExamGoal } = {}): { plan: PlanSummary; created: boolean } {
  const now = opts.now ?? Date.now();
  const goal = opts.goal ?? loadGoal();
  const exam = examDayOf(goal, ctx.cfg);
  const today = localDay(now);
  if (exam === undefined) throw new ProgressError(400, 'Cần đặt ngày thi (và bật srs.exam_aware) trước khi lập kế hoạch nước rút.');
  if (exam < today) throw new ProgressError(400, 'Ngày thi đã qua — cập nhật ngày thi mới trước.');
  if (exam - today > GO_NO_GO_DAYS) throw new ProgressError(400, `Kế hoạch nước rút mở từ ${GO_NO_GO_DAYS} ngày trước ngày thi (còn ${exam - today} ngày).`);
  const date = localDateKey(new Date(now));
  const id = `plan-${date}-sprint`;
  const abs = path.join(PLANS_DIR, `${date}-sprint.md`);
  if (fs.existsSync(abs)) {
    // same day AND same exam date / time → the stored plan unchanged; a changed goal rewrites today's plan (same plan id:
    // sessions done earlier today keep their completion when their id still exists)
    const fm = splitFrontMatter(fs.readFileSync(abs, 'utf8'));
    const same = !fm.error && String(fm.data.exam_date ?? '') === goal.examDate && String(fm.data.exam_time ?? '') === (goal.examTime ?? '');
    const stored = same ? loadPlans(ctx.attempts).find((p) => p.file.endsWith(`${date}-sprint.md`)) : undefined;
    if (stored) return { plan: planSummary(stored), created: false };
  }
  const sessions = sprintSessions(ctx, goal, now);
  const phase = examPhase(goal, date, ctx.cfg);
  const go = goNoGo(ctx, goal, date);
  const checklist = examChecklist(goal, now).filter((c) => !c.done && c.due && c.due >= date);
  const summary = `Kế hoạch nước rút ${exam - today} ngày tới ngày thi ${goal.examDate}: ${sessions.length} phiên (thi thử, ôn lỗi, củng cố, ngày nhẹ) — tự lập, không dùng AI`;
  const front: Record<string, unknown> = {
    id,
    kind: 'plan',
    created: localIso(new Date(now)),
    trigger: SPRINT_TRIGGER,
    summary,
    new_packs: [],
    exam_date: goal.examDate,
    exam_time: goal.examTime,
    sessions: sessions.map((s) => {
      const o: Record<string, unknown> = { id: s.id, title: s.title, why: s.why, feedback: s.feedback };
      if (s.questions) o.questions = s.questions;
      if (s.filter) o.filter = s.filter;
      return o;
    }),
  };
  for (const k of Object.keys(front)) if (front[k] === undefined) delete front[k];
  const byDay = new Map<string, SprintSession[]>();
  for (const s of sessions) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
  const body = [
    `# 🏁 Kế hoạch nước rút — ${fmtLocal(localIso(new Date(now)))} (tự lập, không dùng AI)`,
    '',
    '## 1. Tóm tắt',
    '',
    `- Ngày thi: **${goal.examDate}**${goal.examTime ? ` lúc ${goal.examTime}` : ''} · còn ${exam - today} ngày${phase ? ` · giai đoạn ${PHASE_INFO[phase.id]?.icon ?? ''} ${phase.label}` : ''}.`,
    ...(phase?.rules.length ? phase.rules.map((r) => `- ${r}`) : []),
    ...(go ? [`- Thi hay dời: **${go.verdict === 'go' ? 'giữ lịch' : go.verdict === 'reschedule' ? 'cân nhắc dời' : 'chưa đủ dữ liệu'}** — ${go.checks.map((c) => `${c.ok === true ? '✓' : c.ok === false ? '✗' : '·'} ${c.label}`).join(' · ')}`] : []),
    '',
    '## 2. Lịch từng ngày',
    '',
    '| Ngày | Còn | Phiên |',
    '|---|---|---|',
    ...[...byDay].map(([day, list]) => `| ${label(dayOfKey(day)!)} | T−${exam - dayOfKey(day)!} | ${list.map((s) => s.title.split(' · ').slice(1).join(' · ').replace(/\|/g, '/')).join(' + ')} |`),
    `| ${label(exam)} | T−0 | 🏁 Ngày thi — không học thêm, xem checklist |`,
    '',
    '## 3. Các phiên',
    '',
    ...sessions.flatMap((s) => [`**${s.id} — ${s.title}** · ${label(dayOfKey(s.day)!)}`, `- Vì sao: ${s.why}`, '']),
    '## 4. Checklist còn lại',
    '',
    ...(checklist.length ? checklist.map((c) => `- [ ] ${c.label} — hạn ${c.due}${c.link ? ` ([chi tiết](${c.link}))` : ''}`) : ['- Không còn mục nào chưa xong.']),
    '',
    '## 5. Lưu ý',
    '',
    '- Lịch này chỉ là gợi ý: đổi ngày tuỳ ý, nhưng giữ khoảng 3–4 ngày giữa hai bài thi thử và 2 ngày cuối thật nhẹ.',
    '- Quy định AWS: dời hoặc huỷ chậm nhất 24 giờ trước giờ thi (tối đa 2 lần); trượt phải chờ 14 ngày mới thi lại.',
    '',
  ].join('\n');
  fs.mkdirSync(PLANS_DIR, { recursive: true });
  const tmp = `${abs}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, stringifyFrontMatter(front) + '\n' + body);
  fs.renameSync(tmp, abs);
  const plan = loadPlans(ctx.attempts).find((p) => p.id === id);
  if (!plan) throw new ProgressError(500, 'Không đọc lại được kế hoạch vừa ghi.');
  return { plan: planSummary(plan), created: true };
}
