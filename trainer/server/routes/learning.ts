// Learning engine routes: building tests, grading, results, stats, plans. (owner: learning engine)
// Reads go through the memoized context(); writes schedule the coach snapshot instead of building it in the request.
import { HttpError, readBody, route } from '../http.ts';
import { context, contextStats, currentConfig } from '../context.ts';
import { loadBank, type BankState } from '../lib/bank.ts';
import { WHY_MAX_CHARS, attemptById, cleanNote, gradeAndSave, loadAttempts, resultsPage, rewriteAttempt, summarize } from '../lib/results.ts';
import { buildTest, modeCounts } from '../lib/select.ts';
import { planSummary } from '../lib/plans.ts';
import { newDataSince, scheduleSnapshot } from '../lib/snapshot.ts';
import { attemptBySession } from '../lib/results.ts'; // [δ] idempotent submit
import { NothingToSave, recordRetry, submitDiffers } from '../lib/results.ts'; // [v5 ρ] early stop + result-page retry
import { clearActiveMirror } from '../lib/active.ts'; // [v5 ρ] resume on another device
import { autoSync } from '../lib/sync.ts'; // [δ] quiet sync after a submit
import { resultAnnotations } from '../lib/regrade.ts'; // [β1] GET /api/results/:id annotations
import { loadSealed } from '../lib/sealed.ts'; // [β1] official sealed sitting (annotations.sealedOfficial)
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

/**
 * [δ] Idempotent by `session.sessionId`: a retried submit (response lost on flaky Wi-Fi, the browser outbox after a
 * reconnect) gets the attempt already stored for that session — `duplicate: true`, nothing written, no double count.
 * Lookup and write run without an await in between, so two racing submits of one session cannot both write.
 */
route('POST', '/api/results', async (req) => {
  const body = await readBody<SubmitRequest>(req);
  if (!body.session?.questions?.length) throw new HttpError(400, 'session is required');
  const sid = typeof body.session.sessionId === 'string' && body.session.sessionId.length <= 200 ? body.session.sessionId : undefined;
  const stored = attemptBySession(sid);
  if (stored) {
    if (sid) clearActiveMirror(sid); // [v5 ρ] the outbox resent it: that test's mirror is done too
    // [v5 ρ] another copy of the same test (another device) was stored first with other answers: say so
    return submitDiffers(stored, body, loadBank()) ? { attempt: stored, duplicate: true, differs: true } : { attempt: stored, duplicate: true };
  }
  let attempt: Attempt;
  try {
    attempt = gradeAndSave(body, loadBank());
  } catch (e) {
    if (e instanceof NothingToSave) throw new HttpError(422, e.message); // [v5 ρ] "⏹ Dừng ở đây" before any answer
    throw e;
  }
  if (sid) clearActiveMirror(sid); // [v5 ρ] another device must not offer to resume a submitted test
  scheduleSnapshot(); // coach/snapshot.md is rebuilt ~3 s later, after the response
  autoSync.noteSubmit(); // sync.auto: idle → quiet sync after auto_delay_minutes unless another test starts first
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
    // [v5 ρ] on the graded first attempt only (an in-session relearn retry of the question keeps no note of its own)
    const r = a.answers.find((x) => x.q === body.q && !x.relearn) ?? a.answers.find((x) => x.q === body.q);
    if (r) r.why = why || undefined;
  });
  if (!ok) throw new HttpError(500, 'Không ghi được file kết quả');
  scheduleSnapshot();
  return { attempt: attemptById(loadAttempts(currentConfig()), attempt.id) ?? attempt };
});

/**
 * [v5 ρ] Result page "thử lại trước khi xem giải thích": body `{q, pick: string[]}` (option keys) → `{attempt, answer, retry,
 * retryOk, duplicate?}`. Display only: never a review, the score and `ok` stay as graded. The first retry wins.
 */
route('POST', '/api/results/:id/retry', async (req, _url, [id]) => {
  const body = await readBody<{ q?: string; pick?: string[] | string }>(req);
  const attempt = attemptById(loadAttempts(currentConfig()), decodeURIComponent(id));
  if (!attempt) throw new HttpError(404, 'Result not found');
  return recordRetry(attempt, body.q, body.pick, loadBank());
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

/**
 * [β1] The stored attempt (as graded at the time) + `annotations` from the learning view of the history (ResultAnnotations:
 * exposure per question, recognized repeats, never-viewed answers, seen-before vs first-time split of the scored ones,
 * `sealedOfficial` = the form whose sitting sealed.md records as this attempt — the only "điểm trên câu mới").
 * [v5 λ] + stoppedEarly / skipped / relearn / for / retest {of, title, misses} / retested / notReadiness.
 */
route('GET', '/api/results/:id', (_req, _url, [id]) => {
  const bank = loadBank();
  const attempt = attemptById(loadAttempts(currentConfig()), decodeURIComponent(id));
  if (!attempt) throw new HttpError(404, 'Result not found');
  const annotations = resultAnnotations(attemptById(context().attempts, attempt.id), attempt);
  const official = loadSealed().forms.find((f) => f.status === 'used' && f.attempt === attempt.id);
  if (official) annotations.sealedOfficial = official.id;
  // [v5 λ] cross-attempt parts: the attempt a retest re-checks (title), the retests that re-checked this one (newest first)
  const all = loadAttempts(currentConfig());
  if (annotations.retest) {
    const of = attemptById(all, annotations.retest.of);
    if (of) annotations.retest.title = of.title;
  }
  const retested = all.filter((a) => a.mode === 'retest' && a.retestOf === attempt.id).map((a) => a.id).reverse();
  if (retested.length) annotations.retested = retested;
  return { attempt, summary: summarize(attempt, bank), questions: attempt.answers.map((r) => bank.byId.get(r.q) ?? null), annotations };
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
