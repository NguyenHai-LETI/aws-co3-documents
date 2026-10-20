// AI routes: coach runs (analyze / generate / enrich / longform / verify / twins / family), costs, ENRICH status,
// snapshot, "Hỏi AI", [v5] undo of an AI run (POST /api/coach/runs/:id/undo, GET /api/coach/undo-info?qid=).
// (owner: AI pipeline; blind-solve review routes live in routes/verify.ts)
import fs from 'node:fs';
import os from 'node:os';
import { HttpError, RawResponse, readBody, route } from '../http.ts';
import { context } from '../context.ts';
import { PROFILE_FILE, loadConfig } from '../config.ts';
import { loadBank } from '../lib/bank.ts';
import { newDataSince, writeSnapshot } from '../lib/snapshot.ts';
import { COACH_TASKS, buildPrompt, coachGuard, coachRunner, costSummary, findClaude, hostAllowed, idleSteps, readLock, resolvedModels, skillParam } from '../lib/coach-runner.ts';
import { UndoError, undoInfo, undoRun, undoableCounts } from '../lib/undo.ts';
import { twinsTargets } from '../lib/twins.ts';
import { TWIN_KINDS } from '../lib/ai-output.ts';
import { scheduleSnapshot } from '../lib/snapshot.ts';
import { MAX_BATCH, enrichStatus, readRunInfos } from '../lib/enrich.ts';
import { askQuestion, loadQa } from '../lib/ask.ts';
import type { CoachTask } from '../../shared/types.ts';

route('GET', '/api/coach', (_req, url) => {
  const { cfg, bank, attempts, plans } = context();
  let profile = '';
  try {
    profile = fs.readFileSync(PROFILE_FILE, 'utf8');
  } catch {
    // not created yet
  }
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));
  const allRuns = readRunInfos();
  const models = resolvedModels(cfg);
  const undoable = undoableCounts(bank); // [v5] what "↩️ Hoàn tác" would restore / retire per run
  return {
    claude: findClaude(cfg), // cached; refreshed in the background when older than a minute
    status: coachRunner.status(),
    runs: allRuns.slice(0, 30).map((r) => (undoable.has(r.id) ? { ...r, undoable: undoable.get(r.id) } : r)),
    newSince: newDataSince(plans[0], attempts),
    profile,
    coworkPrompt: buildPrompt('analyze', 'cowork-manual', 'manual'),
    schedule: cfg.coach.schedule,
    costs: costSummary(days, allRuns),
    enrich: enrichStatus(bank, allRuns),
    models,
    host: os.hostname(),
    hostAllowed: hostAllowed(cfg),
    blocked: coachGuard() ?? null, // why coach runs are refused (TRAINER_HOME test mode), null = allowed
    sync: { beforeAi: cfg.sync.before_ai, afterAi: cfg.sync.after_ai }, // auto-sync around runs
    structured: !!cfg.coach.structured_output, // generate / ENRICH / long-form answer in JSON, the app writes the files
    verify: { auto: !!cfg.coach.verify.auto, autoDraft: !!cfg.coach.verify.auto_draft, batchSize: cfg.coach.verify.batch_size, model: models.verify, grounded: !!cfg.coach.verify.grounded, localModel: cfg.coach.verify.local_model || '' },
    // [v5] γ2
    idle: { enabled: !!cfg.coach.enrich_on_idle, tasks: idleSteps(cfg).map((s) => s.idle) },
    targets: { twins: twinsCandidates(), twinsPerRun: cfg.coach.twins_per_run },
  };
});

let twinsMemo: { key: string; n: number } | undefined;
/** Questions a `twins` run would pick right now (memoized per data state). */
function twinsCandidates(): number {
  const ctx = context();
  if (twinsMemo?.key === ctx.key) return twinsMemo.n;
  let n = 0;
  try {
    n = twinsTargets(ctx.bank, ctx.states, { count: 20 }).length;
  } catch {
    n = 0;
  }
  twinsMemo = { key: ctx.key, n };
  return n;
}

route('POST', '/api/coach/run', async (req) => {
  const body = await readBody<{ task?: string; params?: Record<string, unknown> }>(req);
  const task = (body.task ?? 'analyze') as CoachTask;
  if (!COACH_TASKS.includes(task)) throw new HttpError(400, `Tác vụ không hợp lệ: ${String(body.task)} (${COACH_TASKS.join(' | ')})`);
  const params = body.params && typeof body.params === 'object' && !Array.isArray(body.params) ? body.params : {};
  if (params.ids !== undefined) {
    const ok = (Array.isArray(params.ids) && params.ids.every((x) => typeof x === 'string')) || typeof params.ids === 'string';
    if (!ok || !String(params.ids).trim()) throw new HttpError(400, 'params.ids phải là danh sách id câu hỏi');
    if (Array.isArray(params.ids) && params.ids.length > MAX_BATCH) throw new HttpError(400, `Tối đa ${MAX_BATCH} câu mỗi lượt`);
  }
  // [v5] exam-guide bullets (generate / longform), twin kind
  if (params.skills !== undefined) {
    try {
      params.skills = skillParam(params.skills);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  }
  if (params.kind !== undefined && !(TWIN_KINDS as readonly unknown[]).includes(params.kind)) throw new HttpError(400, `params.kind phải là ${TWIN_KINDS.join(' | ')}`);
  try {
    // returns at once; the runner syncs first (sync.before_ai) and writes the snapshot after that sync
    return { run: coachRunner.start(task, 'manual', params) };
  } catch (e) {
    // busy / CLI missing / TRAINER_HOME guard / NothingToDoError (empty ENRICH batch) — the message is shown as is
    throw new HttpError(409, (e as Error).message);
  }
});

route('POST', '/api/coach/cancel', () => ({ cancelled: coachRunner.cancel() }));

/** A route parameter, percent-decoded; a malformed escape is the caller's mistake (400), never a 500. */
function param(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    throw new HttpError(400, 'Đường dẫn không hợp lệ (mã % sai)');
  }
}

route('GET', '/api/coach/runs/:id', (_req, _url, [id]) => ({ events: coachRunner.events(param(id)) }));

// [v5] ↩️ undo of an AI run: restore the questions it changed (when still unchanged since), retire the ones it created
route('POST', '/api/coach/runs/:id/undo', async (req, _url, [id]) => {
  const body = await readBody<{ qid?: unknown }>(req);
  if (body.qid !== undefined && (typeof body.qid !== 'string' || !body.qid.trim())) throw new HttpError(400, 'qid phải là id câu hỏi');
  const lock = readLock();
  if (coachRunner.current || lock) throw new HttpError(409, `Đang có lượt AI chạy (${coachRunner.current?.info.id ?? lock?.runId ?? '?'}) — đợi xong rồi hoàn tác.`);
  try {
    const r = undoRun(param(id), { qid: typeof body.qid === 'string' ? body.qid : undefined });
    if (r.restored.length || r.retired.length) scheduleSnapshot();
    return r;
  } catch (e) {
    if (e instanceof UndoError) throw new HttpError(e.status, e.message);
    throw e;
  }
});

// [v5] the newest AI change of a question that can still be undone (Bank question panel "↩️"), or null
route('GET', '/api/coach/undo-info', (_req, url) => {
  const qid = url.searchParams.get('qid')?.trim();
  if (!qid) throw new HttpError(400, 'Thiếu qid');
  // a literal JSON `null` (the router turns a null result into {ok: true})
  return new RawResponse(JSON.stringify(undoInfo(qid)), 'application/json; charset=utf-8');
});

route('GET', '/api/enrich/status', () => enrichStatus(loadBank()));

route('POST', '/api/ask', async (req) => {
  const body = await readBody<{ qid?: string; question?: string; pick?: string }>(req);
  return askQuestion(body);
});

route('GET', '/api/qa/:qid', (_req, _url, [qid]) => loadQa(param(qid)));

route('POST', '/api/snapshot', () => writeSnapshot(loadBank(), loadConfig()));
