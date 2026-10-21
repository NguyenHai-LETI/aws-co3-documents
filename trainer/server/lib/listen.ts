// [v5 τ] 🎧 Listen mode (#/listen): short practice questions read aloud by the browser, self-graded 1–4.
// GET /api/listen/next — select.ts microCandidates (σ: due first, ≤ 40-word stems, practice pool, one per cluster, not
// answered today, deterministic). The answer travels with the item (the page reads it aloud after the recall pause), so the
// ids are checked again here: sealed / draft / out-of-scope / long questions are never served.
// POST /api/listen/finish — one attempt (mode 'listen', source 'listen') via results.ts createAttempt: each answer carries
// `grade` (FSRS grade = the self-grade, ok = grade ≥ 3), no pick. Idempotent by the page's session id.
import { HttpError } from '../http.ts';
import type { Ctx } from '../context.ts';
import type { BankState } from './bank.ts';
import { attemptBySession, createAttempt } from './results.ts';
import { sealedIds } from './sealed.ts';
import { microCandidates } from './select.ts';
import { normalizeKeys } from '../../shared/scoring.ts';
import type { AnswerRecord, ListenFinishRequest, ListenFinishResponse, ListenItem, ListenNext, Question } from '../../shared/types.ts';

/** Stems longer than this are hard to follow by ear (same bar as σ's microCandidates). */
export const LISTEN_MAX_WORDS = 40;
export const LISTEN_MAX_ITEMS = 30;
const MAX_FINISH_ITEMS = 200;

/** Markdown → speakable plain text (links, emphasis, code, bullets, quotes removed). */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/(\*\*|__|`|~~)/g, '')
    .replace(/(^|\s)[*_](\S[^*_]*?)[*_](?=\s|[.,;:!?]|$)/g, '$1$2')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The first paragraph of an explanation (the "why correct" part) and its "🇻🇳 …" summary line, if any. */
export function splitExplanation(explanation: string): { en: string; vi?: string } {
  const src = explanation.replace(/\r\n?/g, '\n');
  const viLine = /^\s*(?:>\s*)?🇻🇳\s*(.+)$/mu.exec(src)?.[1];
  const paras = src
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !/^(?:>\s*)?🇻🇳/u.test(p));
  const first = plainText(paras[0] ?? '');
  const en = first.length > 420 ? `${first.slice(0, 419).replace(/\s+\S*$/, '')}…` : first;
  const vi = viLine ? plainText(viLine) : undefined;
  return { en, ...(vi ? { vi } : {}) };
}

export function listenItem(q: Question, due: boolean): ListenItem {
  const { en, vi } = splitExplanation(q.explanation);
  return {
    id: q.id,
    stem: plainText(q.stem),
    options: q.options.map((o) => ({ key: o.key, text: plainText(o.text) })),
    answer: [...q.answer],
    explanation: en,
    ...(vi ? { vi } : {}),
    domain: q.domain,
    topic: q.topic,
    due,
  };
}

/** Practice pool for listening: active, not sealed, in scope, short stem. */
function listenable(q: Question | undefined, ctx: Ctx, sealed: ReadonlySet<string>): q is Question {
  return !!q && q.status === 'active' && !sealed.has(q.id) && !(ctx.cfg.practice.exclude_out_of_scope && q.outOfScope) && q.words <= LISTEN_MAX_WORDS;
}

/** GET /api/listen/next?n= */
export function listenNext(ctx: Ctx, n: number): ListenNext {
  const max = Math.min(LISTEN_MAX_ITEMS, Math.max(1, Math.floor(n) || 10));
  const sealed = sealedIds();
  const now = Date.now();
  const ids = microCandidates(ctx, max).filter((id) => listenable(ctx.bank.byId.get(id), ctx, sealed)); // defence in depth
  const items = ids.slice(0, max).map((id) => {
    const s = ctx.states.get(id);
    return listenItem(ctx.bank.byId.get(id)!, !!s?.dueAt && Date.parse(s.dueAt) <= now);
  });
  return { items, source: 'micro' };
}

const isGrade = (g: unknown): g is 1 | 2 | 3 | 4 => g === 1 || g === 2 || g === 3 || g === 4;

/** Self-graded answers → attempt records (no pick; `grade` is the FSRS grade, ok = grade ≥ 3). Unknown / sealed ids dropped. */
export function listenRecords(items: unknown, bank: BankState): AnswerRecord[] {
  if (!Array.isArray(items)) return [];
  const sealed = sealedIds();
  const byQ = new Map<string, AnswerRecord>();
  for (const x of items.slice(0, MAX_FINISH_ITEMS)) {
    if (!x || typeof x !== 'object') continue;
    const it = x as { q?: unknown; grade?: unknown; t?: unknown };
    const q = bank.byId.get(String(it.q ?? ''));
    const grade = Number(it.grade);
    if (!q || q.status !== 'active' || sealed.has(q.id) || !isGrade(grade)) continue; // only what listen mode can serve
    byQ.delete(q.id); // the last grade of a question wins (and keeps the session's order)
    byQ.set(q.id, {
      q: q.id,
      pick: '',
      key: normalizeKeys(q.answer),
      ok: grade >= 3,
      t: Math.min(900, Math.max(0, Math.round(Number(it.t) || 0))),
      est: q.time,
      grade,
      h: q.hash,
    });
  }
  return [...byQ.values()];
}

const isoOr = (v: unknown, fallback: Date): Date => {
  const d = typeof v === 'string' ? new Date(v) : undefined;
  return d && Number.isFinite(d.getTime()) ? d : fallback;
};

export const LISTEN_SESSION_RE = /^listen:[\w-]{6,80}$/;

/** POST /api/listen/finish — the session id is required (a retry must find the stored attempt, never write a second one). */
export function finishListen(body: Partial<ListenFinishRequest>, bank: BankState): ListenFinishResponse {
  if (typeof body.sessionId !== 'string' || !LISTEN_SESSION_RE.test(body.sessionId)) throw new HttpError(400, 'Thiếu hoặc sai mã phiên nghe (sessionId "listen:…") — tải lại trang 🎧 Nghe rồi thử lại.');
  const sessionId = body.sessionId;
  const prev = attemptBySession(sessionId);
  if (prev) return { id: prev.id, file: prev.file, total: prev.total, correct: prev.correct, duplicate: true };
  const answers = listenRecords(body.items, bank);
  if (!answers.length) throw new HttpError(400, 'Chưa có câu nào được chấm — nghe xong một câu rồi bấm 1–4 để tự chấm.');
  // never in the future (a wrong device clock would file the attempt under a later month and schedule reviews from then)
  const now = new Date();
  const finished = new Date(Math.min(isoOr(body.finished, now).getTime(), now.getTime()));
  const started = new Date(Math.min(isoOr(body.started, finished).getTime(), finished.getTime()));
  const a = createAttempt(
    {
      mode: 'listen',
      title: `Nghe · ${answers.length} câu (tự chấm)`,
      feedback: 'practice',
      started: started.toISOString(),
      finished: finished.toISOString(),
      answers,
      source: 'listen',
      sessionId,
    },
    bank,
  );
  return { id: a.id, file: a.file, total: a.total, correct: a.correct };
}
