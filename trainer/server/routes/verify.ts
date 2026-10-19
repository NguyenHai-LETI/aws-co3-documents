// Blind-solve verification routes (owner: AI pipeline):
//   GET  /api/verify                        → VerifySummary & { latest: Record<qid, VerifyVerdict> }
//   POST /api/verify/run {ids?|pack?|scope?} → { run: CoachRunInfo } — coach task 'verify' (409: busy, guard, nothing to do)
//   POST /api/verify/decision {qid, decision: 'approve'|'retire', note?, hash?} → { verdict } — 409 when `hash` (the version
//                                           the learner looked at) is not the current one
import { HttpError, readBody, route } from '../http.ts';
import { loadBank } from '../lib/bank.ts';
import { coachRunner } from '../lib/coach-runner.ts';
import { VERIFY_SCOPES, VerifyConflictError, VerifyInputError, decide, latestVerdicts, verifySummary } from '../lib/verify.ts';

route('GET', '/api/verify', () => {
  const bank = loadBank();
  return { ...verifySummary(bank), latest: latestVerdicts(bank) };
});

route('POST', '/api/verify/run', async (req) => {
  const body = await readBody<{ ids?: unknown; pack?: unknown; scope?: unknown }>(req);
  const params: Record<string, unknown> = {};
  if (body.ids !== undefined) {
    if (!Array.isArray(body.ids) || !body.ids.length || body.ids.some((x) => typeof x !== 'string')) throw new HttpError(400, 'ids phải là danh sách id câu hỏi');
    params.ids = body.ids;
  }
  if (body.pack !== undefined) {
    if (typeof body.pack !== 'string' || !loadBank().packs.some((p) => p.id === body.pack || p.file === body.pack)) throw new HttpError(400, `Không có pack "${String(body.pack)}"`);
    params.pack = body.pack;
  }
  if (body.scope !== undefined) {
    if (!(VERIFY_SCOPES as readonly unknown[]).includes(body.scope)) throw new HttpError(400, `scope không hợp lệ (${VERIFY_SCOPES.join(' | ')})`);
    params.scope = body.scope;
  }
  try {
    return { run: coachRunner.start('verify', 'manual', params) };
  } catch (e) {
    // busy / CLI missing / TRAINER_HOME guard / nothing to verify — the message is shown as is
    throw new HttpError(409, (e as Error).message);
  }
});

route('POST', '/api/verify/decision', async (req) => {
  const body = await readBody<{ qid?: unknown; decision?: unknown; note?: unknown; hash?: unknown }>(req);
  if (typeof body.qid !== 'string' || !body.qid.trim()) throw new HttpError(400, 'Thiếu qid');
  if (body.decision !== 'approve' && body.decision !== 'retire') throw new HttpError(400, "decision phải là 'approve' hoặc 'retire'");
  if (body.hash !== undefined && (typeof body.hash !== 'string' || !body.hash)) throw new HttpError(400, 'hash phải là chuỗi (Question.hash của phiên bản đang xem)');
  try {
    return { verdict: decide(body.qid.trim(), body.decision, typeof body.note === 'string' ? body.note : undefined, body.hash as string | undefined) };
  } catch (e) {
    if (e instanceof VerifyInputError) throw new HttpError(400, e.message);
    if (e instanceof VerifyConflictError) throw new HttpError(409, e.message);
    throw e;
  }
});
