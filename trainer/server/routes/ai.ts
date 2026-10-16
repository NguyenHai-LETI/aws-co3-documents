// AI routes: coach runs (analyze / generate / enrich / longform), costs, ENRICH status, snapshot, "Hỏi AI". (owner: AI pipeline)
import fs from 'node:fs';
import os from 'node:os';
import { HttpError, readBody, route } from '../http.ts';
import { context } from '../context.ts';
import { PROFILE_FILE, loadConfig } from '../config.ts';
import { loadBank } from '../lib/bank.ts';
import { newDataSince, writeSnapshot } from '../lib/snapshot.ts';
import { COACH_TASKS, buildPrompt, coachGuard, coachRunner, costSummary, findClaude, hostAllowed, resolvedModels } from '../lib/coach-runner.ts';
import { enrichStatus, readRunInfos } from '../lib/enrich.ts';
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
  return {
    claude: findClaude(cfg),
    status: coachRunner.status(),
    runs: allRuns.slice(0, 30),
    newSince: newDataSince(plans[0], attempts),
    profile,
    coworkPrompt: buildPrompt('analyze', 'cowork-manual', 'manual'),
    schedule: cfg.coach.schedule,
    costs: costSummary(days, allRuns),
    enrich: enrichStatus(bank, allRuns),
    models: resolvedModels(cfg),
    host: os.hostname(),
    hostAllowed: hostAllowed(cfg),
    blocked: coachGuard() ?? null, // why coach runs are refused (TRAINER_HOME test mode), null = allowed
  };
});

route('POST', '/api/coach/run', async (req) => {
  const body = await readBody<{ task?: string; params?: Record<string, unknown> }>(req);
  const task = (body.task ?? 'analyze') as CoachTask;
  if (!COACH_TASKS.includes(task)) throw new HttpError(400, `Tác vụ không hợp lệ: ${String(body.task)} (analyze | generate | enrich | longform)`);
  const params = body.params && typeof body.params === 'object' && !Array.isArray(body.params) ? body.params : {};
  try {
    if (task === 'analyze') writeSnapshot(loadBank(), loadConfig());
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
