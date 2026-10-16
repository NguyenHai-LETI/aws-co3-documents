// Learning engine routes: building tests, grading, results, stats, plans. (owner: learning engine)
import { HttpError, readBody, route } from '../http.ts';
import { context } from '../context.ts';
import { loadConfig } from '../config.ts';
import { loadBank } from '../lib/bank.ts';
import { WHY_MAX_CHARS, cleanNote, gradeAndSave, loadAttempts, rewriteAttempt, summarize } from '../lib/results.ts';
import { computeStats } from '../lib/stats.ts';
import { buildTest, modeCounts } from '../lib/select.ts';
import { newDataSince, writeSnapshot } from '../lib/snapshot.ts';
import type { BuildTestRequest, SelectionFilters, SubmitRequest } from '../../shared/types.ts';

function refreshSnapshot() {
  try {
    writeSnapshot(loadBank(), loadConfig());
  } catch (e) {
    console.error('snapshot failed', e);
  }
}

route('GET', '/api/state', () => {
  const ctx = context();
  return { states: Object.fromEntries(ctx.states), counts: modeCounts(ctx) };
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
  refreshSnapshot();
  return { attempt };
});

/** Learner's "why did I pick this?" note for one question of a finished test → rewrites the result file. */
route('POST', '/api/results/:id/why', async (req, _url, [id]) => {
  const body = await readBody<{ q?: string; why?: string }>(req);
  const attempt = loadAttempts().find((a) => a.id === decodeURIComponent(id));
  if (!attempt) throw new HttpError(404, 'Result not found');
  if (!body.q || !attempt.answers.some((r) => r.q === body.q)) throw new HttpError(400, 'Câu hỏi không thuộc bài làm này');
  const why = cleanNote(body.why, WHY_MAX_CHARS);
  const ok = rewriteAttempt(attempt.file, (a) => {
    for (const r of a.answers) if (r.q === body.q) r.why = why || undefined;
  });
  if (!ok) throw new HttpError(500, 'Không ghi được file kết quả');
  refreshSnapshot();
  return { attempt: loadAttempts().find((a) => a.id === attempt.id) ?? attempt };
});

route('GET', '/api/results', () => {
  const bank = loadBank();
  return loadAttempts()
    .map((a) => summarize(a, bank))
    .reverse();
});

route('GET', '/api/results/:id', (_req, _url, [id]) => {
  const bank = loadBank();
  const attempt = loadAttempts().find((a) => a.id === decodeURIComponent(id));
  if (!attempt) throw new HttpError(404, 'Result not found');
  return { attempt, summary: summarize(attempt, bank), questions: attempt.answers.map((r) => bank.byId.get(r.q) ?? null) };
});

route('GET', '/api/stats', () => {
  const { cfg, bank, attempts, states } = context();
  return computeStats(attempts, bank, states, cfg);
});

route('GET', '/api/plans', () => {
  const { attempts, plans } = context();
  return { plans, newSince: newDataSince(plans[0], attempts) };
});
