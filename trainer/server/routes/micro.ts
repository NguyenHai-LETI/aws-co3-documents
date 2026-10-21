// [v5] π Micro API (server/lib/micro.ts) — one-question breaks, one result file per day:
//   GET  /api/micro/next                 → MicroNext {question (no answer) | null, remaining, today}
//   POST /api/micro/answer {q, pick, t}  → MicroAnswerResult (key, one-line explanation, today's count)
//   GET  /api/micro/status               → MicroStatus {due, backlog, readiness, today, line} (Claude Code status line)
import { readBody, route } from '../http.ts';
import { context } from '../context.ts';
import { scheduleSnapshot } from '../lib/snapshot.ts';
import { microAnswer, microNext, microStatus } from '../lib/micro.ts';

route('GET', '/api/micro/next', () => microNext(context()));

route('POST', '/api/micro/answer', async (req) => {
  const body = await readBody<{ q?: unknown; pick?: unknown; t?: unknown }>(req);
  const out = microAnswer(context(), body);
  scheduleSnapshot();
  return out;
});

route('GET', '/api/micro/status', () => microStatus(context()));
