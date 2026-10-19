// Learning engine routes: building tests, grading, results, stats, plans. (owner: learning engine)
// Reads go through the memoized context(); writes schedule the coach snapshot instead of building it in the request.
import { HttpError, readBody, route } from '../http.ts';
import { context, contextStats, currentConfig } from '../context.ts';
import { loadBank, type BankState } from '../lib/bank.ts';
import { WHY_MAX_CHARS, attemptById, cleanNote, gradeAndSave, loadAttempts, resultsPage, rewriteAttempt, summarize } from '../lib/results.ts';
import { buildTest, modeCounts } from '../lib/select.ts';
import { planSummary } from '../lib/plans.ts';
import { newDataSince, scheduleSnapshot } from '../lib/snapshot.ts';
import type { Attempt, AttemptSummary, BuildTestRequest, PlansResponse, SelectionFilters, SubmitRequest } from '../../shared/types.ts';

const PAGE_DEFAULT = 50;
const PAGE_MAX = 200;

/** `?limit=&offset=` → clamped numbers; undefined when neither is given (legacy full responses). */
function pageParams(url: URL, keys: string[] = ['limit', 'offset']): { limit: number; offset: number } | undefined {
  if (!keys.some((k) => url.searchParams.has(k))) return undefined;
  const limit = Math.round(Number(url.searchParams.get('limit') ?? PAGE_DEFAULT));
  const offset = Math.round(Number(url.searchParams.get('offset') ?? 0));
  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(PAGE_MAX, limit) : PAGE_DEFAULT,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
  };
}

/** `versions` = the data versions these states were computed from (the store compares them, not meta's). */
route('GET', '/api/state', () => {
  const ctx = context();
  return { states: Object.fromEntries(ctx.states), counts: modeCounts(ctx), versions: ctx.versions };
});

route('POST', '/api/counts', async (req) => {
  const body = await readBody<{ filters?: SelectionFilters }>(req);
  return modeCounts(context(), body.filters);
});

route('POST', '/api/tests', async (req) => {
  const body = await readBody<BuildTestRequest>(req);
  if (!body.mode) throw new HttpError(400, 'mode is required');
  const ctx = context();
  const session = buildTest(body, ctx);
  if (!session.questions.length) throw new HttpError(422, session.notes.join(' ') || 'Không có câu hỏi nào phù hợp.');
  return { session, questions: session.questions.map((r) => ctx.bank.byId.get(r.id)) };
});

route('POST', '/api/results', async (req) => {
  const body = await readBody<SubmitRequest>(req);
  if (!body.session?.questions?.length) throw new HttpError(400, 'session is required');
  const attempt = gradeAndSave(body, loadBank());
  scheduleSnapshot(); // coach/snapshot.md is rebuilt ~3 s later, after the response
  return { attempt };
});

/** Learner's "why did I pick this?" note for one question of a finished test → rewrites the result file. */
route('POST', '/api/results/:id/why', async (req, _url, [id]) => {
  const body = await readBody<{ q?: string; why?: string }>(req);
  const attempt = attemptById(loadAttempts(currentConfig()), decodeURIComponent(id));
  if (!attempt) throw new HttpError(404, 'Result not found');
  if (!body.q || !attempt.answers.some((r) => r.q === body.q)) throw new HttpError(400, 'Câu hỏi không thuộc bài làm này');
  const why = cleanNote(body.why, WHY_MAX_CHARS);
  const ok = rewriteAttempt(attempt.file, (a) => {
    for (const r of a.answers) if (r.q === body.q) r.why = why || undefined;
  });
  if (!ok) throw new HttpError(500, 'Không ghi được file kết quả');
  scheduleSnapshot();
  return { attempt: attemptById(loadAttempts(currentConfig()), attempt.id) ?? attempt };
});

// Summaries are derived from the stored results as graded at the time (not re-graded): they match the file's score.
const summaryMemo = new WeakMap<Attempt[], { bank: BankState; list: AttemptSummary[] }>();
/** Summaries of every attempt, newest first (memoized per loadAttempts() array and bank). */
function summaries(attempts: Attempt[], bank: BankState): AttemptSummary[] {
  const hit = summaryMemo.get(attempts);
  if (hit?.bank === bank) return hit.list;
  const list = attempts.map((a) => summarize(a, bank)).reverse();
  summaryMemo.set(attempts, { bank, list });
  return list;
}

/**
 * GET /api/results → every summary (legacy array). With any of ?limit= &offset= &mode= &q= &rushed=0 → ResultsPage
 * (newest first; mode = TestMode or "pearson"; q = words of the title; rushed=0 hides rushed attempts).
 */
route('GET', '/api/results', (_req, url) => {
  const bank = loadBank();
  const attempts = loadAttempts(currentConfig());
  const page = pageParams(url, ['limit', 'offset', 'mode', 'q', 'rushed']);
  if (!page) return summaries(attempts, bank);
  return resultsPage(attempts, bank, {
    ...page,
    mode: url.searchParams.get('mode') || undefined,
    q: url.searchParams.get('q') || undefined,
    hideRushed: url.searchParams.get('rushed') === '0',
  });
});

route('GET', '/api/results/:id', (_req, _url, [id]) => {
  const bank = loadBank();
  const attempt = attemptById(loadAttempts(currentConfig()), decodeURIComponent(id));
  if (!attempt) throw new HttpError(404, 'Result not found');
  return { attempt, summary: summarize(attempt, bank), questions: attempt.answers.map((r) => bank.byId.get(r.q) ?? null) };
});

/** Memoized per data state, refreshed at least every 5 minutes (see contextStats). */
route('GET', '/api/stats', () => contextStats(context()));

/** GET /api/plans → summaries (no Markdown body) newest first; ?limit=&offset= → only that slice (+ total). */
route('GET', '/api/plans', (_req, url): PlansResponse => {
  const { attempts, plans } = context();
  const newSince = newDataSince(plans[0], attempts);
  const page = pageParams(url);
  if (!page) return { plans: plans.map(planSummary), newSince };
  return { plans: plans.slice(page.offset, page.offset + page.limit).map(planSummary), newSince, total: plans.length, offset: page.offset, limit: page.limit };
});

/** GET /api/plans/:id → the full plan (Markdown body + session completion). */
route('GET', '/api/plans/:id', (_req, _url, [id]) => {
  const plan = context().planById.get(decodeURIComponent(id));
  if (!plan) throw new HttpError(404, 'Không tìm thấy kế hoạch');
  return plan;
});
