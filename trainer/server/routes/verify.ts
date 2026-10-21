// Blind-solve verification routes (owner: AI pipeline):
//   GET  /api/verify                        → VerifySummary & { latest: Record<qid, VerifyVerdict> } — [v5] + audit (import
//                                           audit progress + next questions), groundedQueue, groundedEnabled
//   POST /api/verify/run {ids?|pack?|scope?} → { run: CoachRunInfo } — coach task 'verify' (409: busy, guard, nothing to do);
//                                           [v5] scope 'grounded' (fact-check against AWS docs, `ids` optional) | 'audit'
//   POST /api/verify/decision {qid, decision: 'approve'|'retire', note?, hash?} → { verdict } — 409 when `hash` (the version
//                                           the learner looked at) is not the current one
import { HttpError, readBody, route } from '../http.ts';
import { loadBank } from '../lib/bank.ts';
import { context } from '../context.ts';
import { bankWriteBlocked, coachRunner } from '../lib/coach-runner.ts';
import { upcomingIds } from '../lib/enrich.ts';
import { VERIFY_FILE, VERIFY_SCOPES, VerifyConflictError, VerifyInputError, auditStatus, decide, groundedTargets, latestVerdicts, verifySummary } from '../lib/verify.ts';
import { fileSig } from '../lib/index-db.ts';
import { ISSUES_FILE } from '../config.ts';
import type { AuditStatus } from '../../shared/types.ts';

let extraMemo: { key: string; audit: AuditStatus; groundedQueue: string[] } | undefined;

/** [v5] Import-audit progress + grounded queue, memoized per data state + ledger + issues file. */
function verifyExtras(): { audit: AuditStatus; groundedQueue: string[] } {
  const ctx = context();
  const key = `${ctx.key}|${fileSig(VERIFY_FILE)}|${fileSig(ISSUES_FILE)}`;
  if (extraMemo?.key === key) return extraMemo;
  const upcoming = upcomingIds({ bank: ctx.bank, states: ctx.states, attempts: ctx.attempts, plans: ctx.plans, cfg: ctx.cfg });
  extraMemo = { key, audit: auditStatus(ctx.bank, upcoming), groundedQueue: groundedTargets(ctx.bank, {}, { limit: 30 }).ids };
  return extraMemo;
}

route('GET', '/api/verify', () => {
  const bank = loadBank();
  return { ...verifySummary(bank), latest: latestVerdicts(bank), ...verifyExtras(), groundedEnabled: !!context().cfg.coach.verify.grounded };
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
  if (body.scope === 'audit' && (params.ids || params.pack)) throw new HttpError(400, 'scope audit tự chọn câu — không kèm ids / pack');
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
  const busy = bankWriteBlocked(); // [R3] a file-mode AI run would take this decision for its own change (undo)
  if (busy) throw new HttpError(409, busy);
  try {
    return { verdict: decide(body.qid.trim(), body.decision, typeof body.note === 'string' ? body.note : undefined, body.hash as string | undefined) };
  } catch (e) {
    if (e instanceof VerifyInputError) throw new HttpError(400, e.message);
    if (e instanceof VerifyConflictError) throw new HttpError(409, e.message);
    throw e;
  }
});
