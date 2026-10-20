// [β1] First-day onboarding: a deterministic week-1 plan built from the diagnostic (no AI), written in the coach plan
// schema so the Dashboard and the Coach page show it with "Bắt đầu" buttons: coach/plans/<YYYY-MM-DD>-onboarding.md.
//   - per exam-guide task: diagnostic answers (viewed) → status ✓ all right · ~ some · ✗ none · untested
//   - priority = task weight (domain weight ÷ tasks of the domain) × (1 − (correct + 1) / (answers + 2))
//   - sessions: the 3 highest-priority tasks (a 4th when it was missed entirely), one per session, explicit question
//     lists (never seen first, then least recently seen; long-form first; stable hash order — sealed, out-of-scope,
//     draft and retired questions left out) · spaced review (mode srs) · the end-of-week mock (Pearson) — or the first
//     sealed form when its suggested date falls within the week
//   - one file per day: the same diagnostic returns the stored plan unchanged; a new diagnostic rewrites today's file
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PLANS_DIR, type AppConfig } from '../config.ts';
import type { BankState } from './bank.ts';
import { splitFrontMatter, stringifyFrontMatter } from './frontmatter.ts';
import { loadPlans, planSummary } from './plans.ts';
import { ProgressError, loadGoal, sealedProgress } from './progress.ts';
import { isUnviewed } from './regrade.ts';
import { loadSealed, sealedIds } from './sealed.ts';
import { fmtLocal, localDateKey, localIso } from './time.ts';
import { dayKey, dayOfKey, localDay } from './fsrs.ts';
import type { Attempt, OnboardingPlanResponse, OnboardingTask, Question, QuestionState } from '../../shared/types.ts';

export const ONBOARDING_TRIGGER = 'onboarding';
/** Diagnostic attempts this many days before the chosen one belong to the same diagnostic (split 2 × 14). */
const SPLIT_WINDOW_DAYS = 7;
/** Seconds per practice question (reading the feedback included) used to size a session from goal.minutesPerDay. */
const SECONDS_PER_QUESTION = 120;
const DEFAULT_MINUTES = 30;
const SESSION_MIN = 8;
const SESSION_MAX = 20;
const TASK_SESSIONS = 3;
const SRS_COUNT = 20;

export interface OnboardingCtx {
  cfg: AppConfig;
  bank: BankState;
  attempts: Attempt[]; // learning view (regradeAttempts)
  states: Map<string, QuestionState>;
}

const DAY_MS = 86_400_000;
const isDiagnostic = (a: Attempt) => !!a.diagnostic || a.mode === 'diagnostic';
const stableHash = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

/**
 * The attempts the plan is built from, oldest first: `attemptId` (404 when unknown) plus the other parts of a split
 * diagnostic (diagnostic attempts within SPLIT_WINDOW_DAYS of it, either side — the button sits on each part's result);
 * without an id the latest diagnostic and its parts; with no diagnostic at all every non-rushed attempt (first answers
 * then act as the diagnostic).
 */
export function diagnosticSource(attempts: Attempt[], attemptId?: string): Attempt[] {
  const usable = attempts.filter((a) => !a.rushed);
  let anchor: Attempt | undefined;
  if (attemptId) {
    anchor = attempts.find((a) => a.id === attemptId);
    if (!anchor) throw new ProgressError(404, 'Không tìm thấy bài làm này.');
    if (!isDiagnostic(anchor)) return [anchor];
  } else {
    anchor = [...usable].reverse().find(isDiagnostic);
    if (!anchor) return usable;
  }
  const at = Date.parse(anchor.finished) || 0;
  const near = (a: Attempt) => Math.abs((Date.parse(a.finished) || 0) - at) <= SPLIT_WINDOW_DAYS * DAY_MS;
  return attempts.filter((a) => a === anchor || (!a.rushed && isDiagnostic(a) && near(a)));
}

/** Per task: answers / correct in `source` (first viewed answer per question), status and priority, weakest first. */
export function taskMap(source: Attempt[], bank: BankState): OnboardingTask[] {
  const tax = bank.taxonomy;
  const tally = new Map<string, { n: number; ok: number }>();
  const seen = new Set<string>();
  for (const a of source) {
    for (const r of a.answers) {
      if (isUnviewed(r) || seen.has(r.q)) continue;
      const q = bank.byId.get(r.q);
      if (!q?.task) continue;
      seen.add(r.q);
      const t = tally.get(q.task) ?? { n: 0, ok: 0 };
      t.n++;
      if (r.ok) t.ok++;
      tally.set(q.task, t);
    }
  }
  const totalWeight = tax.domains.reduce((s, d) => s + d.weight, 0) || 1;
  const perDomain = new Map<string, number>();
  for (const t of tax.tasks ?? []) perDomain.set(t.domain, (perDomain.get(t.domain) ?? 0) + 1);
  const order = new Map((tax.tasks ?? []).map((t, i) => [t.id, i]));
  return (tax.tasks ?? [])
    .map((t): OnboardingTask => {
      const { n, ok } = tally.get(t.id) ?? { n: 0, ok: 0 };
      const weight = (tax.domains.find((d) => d.id === t.domain)?.weight ?? 0) / totalWeight / (perDomain.get(t.domain) || 1);
      const status = n === 0 ? 'untested' : ok === n ? 'ok' : ok === 0 ? 'weak' : 'partial';
      return { task: t.id, label: t.label_vi, domain: t.domain, answers: n, correct: ok, status, priority: Math.round(1000 * weight * (1 - (ok + 1) / (n + 2))) / 10 };
    })
    .sort((a, b) => b.priority - a.priority || (order.get(a.task) ?? 0) - (order.get(b.task) ?? 0));
}

/** Questions of one task for a fix session: never seen first, then least recently seen; long-form first; stable order. */
function pickForTask(task: string, ctx: OnboardingCtx, exclude: Set<string>, count: number): Question[] {
  const lastAt = (q: Question) => ctx.states.get(q.id)?.lastAt ?? '';
  return ctx.bank.questions
    .filter((q) => q.task === task && q.status === 'active' && !q.outOfScope && !exclude.has(q.id))
    .map((q) => ({ q, seen: ctx.states.has(q.id) ? 1 : 0, last: lastAt(q), long: q.longForm ? 0 : 1, h: stableHash(`onboarding:${q.id}`) }))
    .sort((a, b) => a.seen - b.seen || a.last.localeCompare(b.last) || a.long - b.long || a.h.localeCompare(b.h))
    .slice(0, count)
    .map((x) => x.q);
}

interface SessionDraft {
  id: string;
  title: string;
  why: string;
  feedback: 'practice' | 'exam';
  questions?: string[];
  filter?: Record<string, unknown>;
  how: string; // plan body: how to work through it
}

const STATUS_MARK: Record<OnboardingTask['status'], string> = { ok: '✓', partial: '~', weak: '✗', untested: '·' };
const STATUS_TEXT: Record<OnboardingTask['status'], string> = { ok: 'vững', partial: 'chưa chắc', weak: 'cần vá', untested: 'chưa có dữ liệu' };
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Study days of the coming week (from today), rest days skipped — at least one day. */
function studyDays(today: number, rest: number[] = []): number[] {
  const days: number[] = [];
  for (let d = today; d < today + 7; d++) if (!rest.includes(new Date(d * DAY_MS).getUTCDay())) days.push(d);
  return days.length ? days : [today];
}

const sameList = (a: unknown, b: string[]) => Array.isArray(a) && a.length === b.length && a.every((x, i) => String(x) === b[i]);

/** Builds (or returns today's) week-1 plan. See the header. */
export function onboardingPlan(ctx: OnboardingCtx, opts: { attemptId?: string; now?: number } = {}): OnboardingPlanResponse {
  const now = opts.now ?? Date.now();
  const { bank } = ctx;
  const source = diagnosticSource(ctx.attempts, opts.attemptId);
  const sourceIds = source.map((a) => a.id);
  const tasks = taskMap(source, bank);
  const date = localDateKey(new Date(now));
  const id = `plan-${date}-onboarding`;
  const abs = path.join(PLANS_DIR, `${date}-onboarding.md`);

  // same diagnostic as today's stored plan → that plan, unchanged
  if (fs.existsSync(abs)) {
    const fm = splitFrontMatter(fs.readFileSync(abs, 'utf8'));
    if (!fm.error && sameList(fm.data.source_attempts, sourceIds)) {
      const stored = loadPlans(ctx.attempts).find((p) => p.file.endsWith(`${date}-onboarding.md`));
      if (stored) return { plan: planSummary(stored), created: false, tasks };
    }
  }

  const goal = loadGoal();
  const sealed = sealedIds();
  const today = localDay(now);
  const count = Math.max(SESSION_MIN, Math.min(SESSION_MAX, Math.round(((goal.minutesPerDay ?? DEFAULT_MINUTES) * 60) / SECONDS_PER_QUESTION)));
  const sessions: SessionDraft[] = [];
  const used = new Set<string>(sealed);
  const tested = source.reduce((n, a) => n + a.answers.filter((r) => !isUnviewed(r)).length, 0);
  for (const t of tasks) {
    const fixes = sessions.length;
    if (fixes >= TASK_SESSIONS + 1 || (fixes >= TASK_SESSIONS && t.status !== 'weak')) break;
    const qs = pickForTask(t.task, ctx, used, count);
    if (qs.length < Math.min(4, count)) continue; // too few questions for a session
    for (const q of qs) used.add(q.id);
    const evidence = t.answers ? `chẩn đoán đúng ${t.correct}/${t.answers}` : 'chưa có câu nào trong bài chẩn đoán';
    sessions.push({
      id: `s${sessions.length + 1}`,
      title: `Vá task ${t.task} · ${t.label}`,
      why: `${evidence} · ưu tiên ${t.priority} (trọng số domain × phần chưa vững)`,
      feedback: 'practice',
      questions: qs.map((q) => q.id),
      how: `${qs.length} câu, xem đáp án từng câu. Trước khi chọn, xác định yêu cầu chính của đề (an toàn? sẵn sàng cao? chi phí?); đọc kỹ vì sao từng phương án nhiễu sai.`,
    });
  }
  sessions.push({
    id: `s${sessions.length + 1}`,
    title: 'Ôn tập ngắt quãng (trộn chủ đề)',
    why: 'Câu sai ở bài chẩn đoán và các phiên vá lỗi đến hạn ôn từ ngày mai (FSRS) — ôn đúng hạn để nhớ lâu.',
    feedback: 'practice',
    filter: { mode: 'srs', count: SRS_COUNT },
    how: `Tối đa ${SRS_COUNT} câu đến hạn, câu sắp quên nhất trước. Làm từ ngày thứ 2, mỗi ngày một lượt ngắn.`,
  });
  // end of the week: a timed mock — the first sealed form instead when its suggested date falls within the week
  const firstSealed = sealedProgress(loadSealed(), ctx.attempts, goal, now).find((f) => f.status === 'sealed');
  const sealedDay = firstSealed?.suggested ? dayOfKey(firstSealed.suggested) : undefined;
  if (firstSealed && sealedDay !== undefined && sealedDay < today + 7) {
    sessions.push({
      id: `s${sessions.length + 1}`,
      title: `Đề niêm phong ${firstSealed.id} — điểm trên câu mới`,
      why: `Ngày thi ${goal.examDate}: nên làm đề niêm phong ${firstSealed.id} vào khoảng ${firstSealed.suggested} để đo năng lực trên câu chưa từng gặp.`,
      feedback: 'exam',
      filter: { mode: 'sealed' },
      how: `${firstSealed.count} câu tính điểm + câu thử nghiệm, như thi thật (không tạm dừng). Điểm này được so với mức sẵn sàng của app để hiệu chỉnh dự báo.`,
    });
  } else {
    sessions.push({
      id: `s${sessions.length + 1}`,
      title: 'Thi thử Pearson cuối tuần 1 (65 câu)',
      why: 'Đo tiến bộ sau tuần đầu trong điều kiện như thi thật: 15 câu thử nghiệm không tính điểm, không tạm dừng.',
      feedback: 'exam',
      filter: { mode: 'exam', pearson: true },
      how: 'Làm một mạch vào ngày học cuối cùng của tuần 1; câu nào quá 2,5 phút thì cắm cờ, chọn tạm rồi đi tiếp.',
    });
  }

  // a simple week layout for the body: sessions in order over the study days, the mock on the last one
  const days = studyDays(today, goal.restDays);
  const dayOf = (i: number) => (i === sessions.length - 1 ? days[days.length - 1] : days[Math.min(i, Math.max(0, days.length - 2))]);
  const fixTasks = sessions.filter((s) => s.questions).map((s) => s.title.split(' · ')[0].replace('Vá task ', ''));
  const okCount = tasks.filter((t) => t.status === 'ok').length;
  const summary = `Kế hoạch tuần 1 tự lập từ ${source.some(isDiagnostic) ? 'bài chẩn đoán' : 'các bài đã làm'}: ${fixTasks.length ? `vá task ${fixTasks.join(', ')}` : 'làm quen ngân hàng câu hỏi'} · ôn ngắt quãng · ${sessions.at(-1)!.filter?.mode === 'sealed' ? 'đề niêm phong' : 'thi thử cuối tuần 1'}`;

  const topicNotes = new Map<string, string[]>();
  for (const s of sessions) {
    for (const qid of s.questions ?? []) {
      const q = bank.byId.get(qid);
      const topic = q && bank.taxonomy.topics.find((t) => t.id === q.topic);
      if (topic && !topicNotes.has(topic.id)) topicNotes.set(topic.id, topic.notes);
    }
  }
  const notes = [...new Set([...topicNotes.values()].flat())].slice(0, 6);

  const front: Record<string, unknown> = {
    id,
    kind: 'plan',
    created: localIso(new Date(now)),
    trigger: ONBOARDING_TRIGGER,
    summary,
    new_packs: [],
    source_attempts: sourceIds,
    sessions: sessions.map((s) => {
      const o: Record<string, unknown> = { id: s.id, title: s.title, why: s.why, feedback: s.feedback };
      if (s.questions) o.questions = s.questions;
      if (s.filter) o.filter = s.filter;
      return o;
    }),
  };
  const body = [
    `# 🗓️ Kế hoạch tuần 1 — ${fmtLocal(localIso(new Date(now)))} (tự lập, không dùng AI)`,
    '',
    '## 1. Tóm tắt',
    '',
    `- Dữ liệu: ${source.length ? `${source.length} bài (${tested} câu đã xem)` : 'chưa có bài làm nào — ưu tiên theo trọng số đề thi'} · vững ${okCount}/${tasks.length} task.`,
    `- Tuần này: ${sessions.length} phiên, mỗi phiên vá lỗi ~${count} câu (${goal.minutesPerDay ?? DEFAULT_MINUTES} phút/ngày${goal.minutesPerDay ? '' : ' — mặc định'}).`,
    '- Kết quả 2 câu/task chỉ là ước lượng sơ bộ: đây là điểm xuất phát, không phải đánh giá đạt/chưa đạt.',
    '',
    '## 2. Bản đồ xuất phát (theo mục exam guide)',
    '',
    '| Task | Kết quả | Trạng thái | Ưu tiên |',
    '|---|---|---|---|',
    ...tasks
      .slice()
      .sort((a, b) => a.task.localeCompare(b.task, 'en', { numeric: true }))
      .map((t) => `| ${t.task} · ${t.label.replace(/\|/g, '/')} | ${t.answers ? `${t.correct}/${t.answers}` : '—'} | ${STATUS_MARK[t.status]} ${STATUS_TEXT[t.status]} | ${t.priority} |`),
    '',
    '## 3. Các phiên luyện',
    '',
    ...sessions.flatMap((s, i) => {
      const d = dayOf(i);
      return [`**${s.id} — ${s.title}** · gợi ý ${WEEKDAYS[new Date(d * DAY_MS).getUTCDay()]} ${dayKey(d).slice(8, 10)}/${dayKey(d).slice(5, 7)}`, `- Vì sao: ${s.why}`, `- Cách làm: ${s.how}`, ''];
    }),
    '## 4. Thay đổi ngân hàng câu hỏi',
    '',
    '- Không có — kế hoạch do app tự lập từ kết quả, không gọi AI. Khi đã có thêm vài bài, bấm “🔍 Phân tích ngay” ở AI Coach để có kế hoạch chi tiết hơn.',
    '',
    '## 5. Ôn lại lý thuyết',
    '',
    ...(notes.length ? notes.map((n) => `- [${n}](../../../${n})`) : ['- [L-quyet-dinh-nhanh.md](../../../L-quyet-dinh-nhanh.md) — bảng quyết định nhanh theo từ khoá']),
    '',
    '## 6. Mẹo làm bài',
    '',
    '1. Gạch chân yêu cầu của đề (*MOST cost-effective*, *LEAST operational overhead*, *highly available*) trước khi đọc phương án.',
    '2. Loại phương án sai trước (nút ✕), rồi mới chọn giữa các phương án còn lại.',
    '3. Câu sai: ghi một dòng “vì sao mình chọn” — AI Coach đọc ghi chú này để tìm hiểu nhầm.',
    '',
  ].join('\n');
  fs.mkdirSync(PLANS_DIR, { recursive: true });
  const tmp = `${abs}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, stringifyFrontMatter(front) + '\n' + body);
  fs.renameSync(tmp, abs);
  const plan = loadPlans(ctx.attempts).find((p) => p.id === id);
  if (!plan) throw new ProgressError(500, 'Không đọc lại được kế hoạch vừa ghi.');
  return { plan: planSummary(plan), created: true, tasks };
}
