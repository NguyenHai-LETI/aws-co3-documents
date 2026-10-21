// [L] Learning progress routes: exam goal & forecast, external practice-exam scores, FSRS parameters / optimizer,
// first-day onboarding plan.
//   GET  /api/progress                  → ProgressResponse {today, fsrs, workload, goal, forecast?, external, externalCalibration?,
//                                          regraded, sealed, checklist, checklistChecked, studyStart?}
//   POST /api/goal {examDate?, targetScaled?, minutesPerDay?, restDays?, studyTime?, examTime?, delivery?, esl?, checklist?}
//        (missing = keep, null / '' = clear; checklist merged per item)                           → ProgressResponse
//   POST /api/external {date, source, score?, scaled?, note?}                                    → ProgressResponse
//   POST /api/external/:id/delete                                                                → ProgressResponse
//   POST /api/fsrs/optimize             → FsrsInfo (the optimizer runs in a child process; poll GET /api/progress)
//   POST /api/onboarding/plan {attemptId?} → OnboardingPlanResponse (coach/plans/<date>-onboarding.md, one per day)
//   POST /api/plan/sprint {}            → {plan, created} [v5 λ] (coach/plans/<date>-sprint.md, one per day; exam ≤ 14 days)
import { HttpError, readBody, route } from '../http.ts';
import { context } from '../context.ts';
import { ProgressError, addExternal, computeProgress, deleteExternal, saveGoal, type GoalInput } from '../lib/progress.ts';
import { onboardingPlan } from '../lib/onboarding.ts';
import { sprintPlan } from '../lib/sprint.ts'; // [v5 λ]
import { OptimizeError, fsrsInfo, maybeAutoOptimize, startOptimize } from '../lib/fsrs-optimize.ts';

/** Library input errors → HTTP errors with the same status and (Vietnamese) message. */
function guard<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof ProgressError || e instanceof OptimizeError) throw new HttpError(e.status, e.message);
    throw e;
  }
}

function progress() {
  const ctx = context();
  const out = computeProgress(ctx);
  // auto mode: maybe re-optimize FSRS parameters — after the response, in a child process
  setImmediate(() => maybeAutoOptimize(ctx.attempts, ctx.cfg));
  return out;
}

route('GET', '/api/progress', () => progress());

route('POST', '/api/goal', async (req) => {
  const body = await readBody<GoalInput>(req);
  const { bank } = context();
  const input: GoalInput = {};
  for (const k of ['examDate', 'targetScaled', 'minutesPerDay', 'restDays', 'studyTime', 'examTime', 'delivery', 'esl', 'checklist'] as const) {
    if (body && k in body) input[k] = body[k];
  }
  guard(() => saveGoal(input, bank.taxonomy.exam.pass_scaled));
  return progress();
});

route('POST', '/api/external', async (req) => {
  const body = await readBody<{ date?: unknown; source?: unknown; score?: unknown; scaled?: unknown; note?: unknown }>(req);
  guard(() => addExternal(body));
  return progress();
});

route('POST', '/api/external/:id/delete', (_req, _url, [id]) => {
  guard(() => deleteExternal(decodeURIComponent(id)));
  return progress();
});

route('POST', '/api/fsrs/optimize', () => {
  const { cfg, attempts } = context();
  const run = guard(() => startOptimize(attempts, cfg));
  // a blocked run rejects synchronously-ish: surface it as an HTTP error instead of a silent background failure
  const info = fsrsInfo(cfg, attempts);
  if (!info.running) {
    return run.then(
      () => fsrsInfo(cfg, attempts),
      (e: Error) => {
        throw e instanceof OptimizeError ? new HttpError(e.status, e.message) : e;
      },
    );
  }
  run.catch(() => undefined); // finishes in the background; the result lands in results/fsrs-params.json
  return info;
});

route('POST', '/api/onboarding/plan', async (req) => {
  const body = await readBody<{ attemptId?: unknown }>(req);
  const attemptId = typeof body?.attemptId === 'string' && body.attemptId.trim() ? body.attemptId.trim() : undefined;
  return guard(() => onboardingPlan(context(), { attemptId }));
});

/** [v5 λ] Deterministic sprint / final-week plan (sprint.ts): today's file is returned unchanged when it exists. */
route('POST', '/api/plan/sprint', () => guard(() => sprintPlan(context())));
