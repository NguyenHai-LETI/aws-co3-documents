// AI routes: coach runs (analyze / generate / enrich / longform / verify), costs, ENRICH status, snapshot, "Hỏi AI".
// (owner: AI pipeline; blind-solve review routes live in routes/verify.ts)
import fs from 'node:fs';
import os from 'node:os';
import { HttpError, readBody, route } from '../http.ts';
import { context } from '../context.ts';
import { PROFILE_FILE, loadConfig } from '../config.ts';
import { loadBank } from '../lib/bank.ts';
import { newDataSince, writeSnapshot } from '../lib/snapshot.ts';
import { COACH_TASKS, buildPrompt, coachGuard, coachRunner, costSummary, findClaude, hostAllowed, resolvedModels } from '../lib/coach-runner.ts';
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
  return {
    claude: findClaude(cfg), // cached; refreshed in the background when older than a minute
    status: coachRunner.status(),
    runs: allRuns.slice(0, 30),
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
    verify: { auto: !!cfg.coach.verify.auto, autoDraft: !!cfg.coach.verify.auto_draft, batchSize: cfg.coach.verify.batch_size, model: models.verify },
  };
});

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
  try {
    // returns at once; the runner syncs first (sync.before_ai) and writes the snapshot after that sync
    return { run: coachRunner.start(task, 'manual', params) };
  } catch (e) {
    // busy / CLI missing / TRAINER_HOME guard / NothingToDoError (empty ENRICH batch) — the message is shown as is
    throw new HttpError(409, (e as Error).message);
  }
});

route('POST', '/api/coach/cancel', () => ({ cancelled: coachRunner.cancel() }));

route('GET', '/api/coach/runs/:id', (_req, _url, [id]) => ({ events: coachRunner.events(decodeURIComponent(id)) }));

route('GET', '/api/enrich/status', () => enrichStatus(loadBank()));

route('POST', '/api/ask', async (req) => {
  const body = await readBody<{ qid?: string; question?: string; pick?: string }>(req);
  return askQuestion(body);
});

route('GET', '/api/qa/:qid', (_req, _url, [qid]) => loadQa(decodeURIComponent(qid)));

route('POST', '/api/snapshot', () => writeSnapshot(loadBank(), loadConfig()));
