// [L] Learning progress routes: exam goal & forecast, external practice-exam scores, FSRS parameters / optimizer.
//   GET  /api/progress                  → ProgressResponse {today, fsrs, workload, goal, forecast?, external, externalCalibration?, regraded}
//   POST /api/goal {examDate?, targetScaled?}               (missing = keep, null / '' = clear)  → ProgressResponse
//   POST /api/external {date, source, score?, scaled?, note?}                                  → ProgressResponse
//   POST /api/external/:id/delete                                                              → ProgressResponse
//   POST /api/fsrs/optimize             → FsrsInfo (the optimizer runs in a child process; poll GET /api/progress)
import { HttpError, readBody, route } from '../http.ts';
import { context } from '../context.ts';
import { ProgressError, addExternal, computeProgress, deleteExternal, saveGoal } from '../lib/progress.ts';
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
  const body = await readBody<{ examDate?: unknown; targetScaled?: unknown }>(req);
  const { bank } = context();
  guard(() => saveGoal({ examDate: body.examDate, targetScaled: body.targetScaled }, bank.taxonomy.exam.pass_scaled));
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
