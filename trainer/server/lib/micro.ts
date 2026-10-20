// [v5] π Micro API: one short question at a time (Claude Code mod / status line, any small client). No AI, no quota.
//   next   — σ's microCandidates (due first, then not mastered, ≤ 40-word stems, practice pool, one per cluster, nothing
//            answered today), options in a per-day order, never the answer.
//   answer — graded like a one-question test (results.ts gradeSubmission), appended to TODAY's micro attempt: one result
//            file per day (sessionId `micro:<YYYY-MM-DD>`, mode micro, source micro — kept out of speed statistics):
//            createAttempt the first time, rewriteAttempt after. The same question again on the same day is stored as a
//            relearn record (out of the score, a same-day step for FSRS).
//   status — one line for the Claude Code status line, memoized per data state and minute.
import crypto from 'node:crypto';
import { HttpError } from '../http.ts';
import { contextStats, currentConfig, type Ctx } from '../context.ts';
import { attemptBySession, attemptById, createAttempt, gradeSubmission, loadAttempts, rewriteAttempt } from './results.ts';
import { sealedIds } from './sealed.ts';
import { microCandidates } from './select.ts';
import { plainText, splitExplanation } from './listen.ts';
import { localDateKey, localIso } from './time.ts';
import { pct, scaledScore } from '../../shared/scoring.ts';
import type { AnswerRecord, Attempt, MicroAnswerResult, MicroNext, MicroQuestion, MicroStatus, Question, SubmitRequest } from '../../shared/types.ts';

const LABELS = 'ABCDEFGH';
const MAX_T = 900; // seconds: a break longer than this is not answering time

export const microSessionId = (day: string) => `micro:${day}`;

/** Option keys in today's display order for a question (stable for the day, so `next` and `answer` agree). */
export function displayOrder(q: Pick<Question, 'id' | 'options'>, day: string, shuffle: boolean): string[] {
  const keys = q.options.map((o) => o.key);
  if (!shuffle) return keys;
  const h = (k: string) => crypto.createHash('sha1').update(`${q.id}|${day}|${k}`).digest().readUInt32BE(0);
  return [...keys].sort((a, b) => h(a) - h(b));
}

/** One line of explanation: the "why correct" sentence(s), or the 🇻🇳 summary when shorter. */
export function oneLine(explanation: string, max = 220): string {
  const { en, vi } = splitExplanation(explanation);
  const text = plainText(vi && vi.length < en.length ? vi : en || vi || '');
  return text.length > max ? text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : text;
}

function todayAttempt(day: string): Attempt | undefined {
  const stored = attemptBySession(microSessionId(day));
  if (!stored) return undefined;
  return attemptById(loadAttempts(currentConfig()), stored.id) ?? stored;
}

function todayCounts(a: Attempt | undefined): { answered: number; correct: number } {
  const first = (a?.answers ?? []).filter((r) => !r.relearn && !r.skipped);
  return { answered: first.length, correct: first.filter((r) => r.ok).length };
}

export function microNext(ctx: Ctx): MicroNext {
  const day = localDateKey(new Date());
  const sealed = sealedIds();
  const ids = microCandidates(ctx, 25).filter((id) => !sealed.has(id) && ctx.bank.byId.get(id)?.status === 'active');
  const today = todayCounts(todayAttempt(day));
  const q = ids.length ? ctx.bank.byId.get(ids[0]) : undefined;
  if (!q) return { question: null, remaining: 0, today, note: 'Hết câu ngắn cho hôm nay — các câu đến hạn đã làm, hoặc mở app để học tiếp.' };
  const order = displayOrder(q, day, ctx.cfg.practice.shuffle_options !== false);
  const byKey = new Map(q.options.map((o) => [o.key, o.text]));
  const st = ctx.states.get(q.id);
  const question: MicroQuestion = {
    id: q.id,
    stem: plainText(q.stem),
    options: order.map((key, i) => ({ key, label: LABELS[i], text: plainText(byKey.get(key) ?? '') })),
    choose: q.answer.length,
    topic: q.topic,
    topicLabel: ctx.bank.taxonomy.topics.find((t) => t.id === q.topic)?.label,
    due: !!st?.dueAt && st.dueAt.slice(0, 10) <= day,
  };
  return { question, remaining: ids.length - 1, today };
}

export function microAnswer(ctx: Ctx, body: { q?: unknown; pick?: unknown; t?: unknown }): MicroAnswerResult {
  const qid = typeof body.q === 'string' ? body.q : '';
  const q = ctx.bank.byId.get(qid);
  if (!q || q.status !== 'active') throw new HttpError(404, 'Không có câu hỏi này');
  if (sealedIds().has(q.id)) throw new HttpError(403, 'Câu này đang niêm phong (để đo điểm trên câu mới) — không trả lời ngoài đề niêm phong.');
  const raw = Array.isArray(body.pick) ? body.pick.map(String) : typeof body.pick === 'string' ? body.pick.split('') : [];
  const keys = new Set(q.options.map((o) => o.key));
  const pick = [...new Set(raw.map((k) => k.trim().toUpperCase()).filter(Boolean))];
  if (!pick.length || pick.some((k) => !keys.has(k))) throw new HttpError(400, `pick phải là khoá phương án của câu (${[...keys].join(', ')})`);
  const now = new Date();
  const day = localDateKey(now);
  const sessionId = microSessionId(day);
  const t = Math.min(MAX_T, Math.max(0, Math.round(Number(body.t) || 0)));
  const req: SubmitRequest = {
    session: { sessionId, mode: 'micro', title: '☕ Câu hỏi nhanh', feedback: 'practice', timeLimit: 0, estimateTotal: q.time, timingPreset: '', questions: [{ id: q.id }], selection: { mode: 'micro' }, createdAt: now.toISOString(), notes: [], source: 'micro' },
    answers: [{ q: q.id, pick, t }],
    startedAt: now.toISOString(),
    finishedAt: now.toISOString(),
    timedOut: false,
    timeUsed: t,
  };
  const rec: AnswerRecord = gradeSubmission(req, ctx.bank).records[0];
  // no await from here to the write: two answers arriving together cannot both create today's file
  const existing = todayAttempt(day);
  let attempt: Attempt;
  if (!existing) {
    attempt = createAttempt({ mode: 'micro', title: `☕ Câu hỏi nhanh · ${day.slice(8, 10)}/${day.slice(5, 7)}`, source: 'micro', sessionId, started: now.toISOString(), finished: now.toISOString(), answers: [rec] }, ctx.bank);
  } else {
    if (existing.answers.some((r) => r.q === q.id && !r.relearn)) rec.relearn = true;
    const passPct = ctx.bank.taxonomy.exam.pass_pct;
    const ok = rewriteAttempt(existing.file, (a) => {
      a.answers.push(rec);
      const scored = a.answers.filter((r) => !r.relearn && !r.skipped && r.scored !== false);
      a.total = scored.length;
      a.answered = scored.filter((r) => r.pick || r.grade).length;
      a.correct = scored.filter((r) => r.ok).length;
      a.score = pct(a.correct, a.total);
      a.scaled = scaledScore(a.score);
      a.passed = a.score >= passPct;
      a.finished = localIso(now);
      a.timeUsed = a.answers.reduce((s, r) => s + (r.t || 0), 0);
    });
    if (!ok) throw new HttpError(500, 'Không ghi được file kết quả hôm nay');
    attempt = attemptById(loadAttempts(currentConfig()), existing.id) ?? existing;
  }
  const order = displayOrder(q, day, ctx.cfg.practice.shuffle_options !== false);
  const label = (k: string) => LABELS[order.indexOf(k)] ?? k;
  return {
    ok: rec.ok,
    pick: rec.pick,
    key: rec.key,
    keyLabels: q.answer.map(label).sort().join(''),
    correct: q.answer.map((k) => ({ label: label(k), text: plainText(q.options.find((o) => o.key === k)?.text ?? '') })).sort((a, b) => a.label.localeCompare(b.label)),
    explanation: oneLine(q.explanation),
    attempt: attempt.id,
    today: todayCounts(attempt),
    ...(rec.relearn ? { repeat: true } : {}),
  };
}

let statusMemo: { key: string; value: MicroStatus } | undefined;

/** The status-line summary (cheap: memoized per data state and minute). */
export function microStatus(ctx: Ctx): MicroStatus {
  const day = localDateKey(new Date());
  const key = `${ctx.key}|${day}|${Math.floor(Date.now() / 60_000)}`;
  if (statusMemo?.key === key) return statusMemo.value;
  const o = contextStats(ctx).totals;
  const today = todayCounts(todayAttempt(day));
  const readiness = o.answers >= 30 ? Math.round(o.readiness) : null;
  const parts = [o.dueToday ? `📚 ${o.dueToday} câu đến hạn${o.backlog ? ` (+${o.backlog} tồn)` : ''}` : '📚 Hết câu đến hạn hôm nay'];
  if (readiness !== null) parts.push(`sẵn sàng ${readiness} %`);
  if (today.answered) parts.push(`☕ ${today.correct}/${today.answered}`);
  const value: MicroStatus = { due: o.dueToday, backlog: o.backlog, readiness, today, line: parts.join(' · ') };
  statusMemo = { key, value };
  return value;
}
