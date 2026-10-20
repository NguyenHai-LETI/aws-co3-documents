// [v5 τ] 🧑‍🏫 tutor (tutor.ts), 📒 notebook (notebook.ts) and 🎧 listen mode (listen.ts).
// LAN scope (π): practice = GET /api/tutor, GET /api/notebook, GET /api/listen/next, POST /api/listen/finish;
// admin = POST /api/tutor/start|turn|end, POST /api/notebook/update|delete|merge (they run the AI or edit coach files).
import { HttpError, readBody, route } from '../http.ts';
import { context } from '../context.ts';
import { endTutor, startTutor, tutorStatus, tutorTurn, type StartInput } from '../lib/tutor.ts';
import { deleteEntry, mergeEntries, notebookView, runNotebookUpdate } from '../lib/notebook.ts';
import { finishListen, listenNext } from '../lib/listen.ts';
import type { ListenFinishRequest } from '../../shared/types.ts';

// ── 🧑‍🏫 tutor ──────────────────────────────────────────────────────────────

route('GET', '/api/tutor', (_req, url) => tutorStatus(url.searchParams.get('qid') ?? undefined));

route('POST', '/api/tutor/start', async (req) => startTutor(await readBody<StartInput>(req)));

route('POST', '/api/tutor/turn', async (req) => tutorTurn(await readBody<{ id?: string; text?: string; giveUp?: boolean }>(req)));

route('POST', '/api/tutor/end', async (req) => endTutor(await readBody<{ id?: string }>(req)));

// ── 📒 notebook ─────────────────────────────────────────────────────────────

route('GET', '/api/notebook', () => notebookView(context()));

/** Runs the 📒 notebook AI task now (slow: one Claude Code call) and returns the run + the new view. */
route('POST', '/api/notebook/update', async () => {
  const run = await runNotebookUpdate({ trigger: 'manual' });
  return { run, view: notebookView(context()) };
});

route('POST', '/api/notebook/delete', async (req) => {
  const { key } = await readBody<{ key?: string }>(req);
  if (!key || !deleteEntry(String(key))) throw new HttpError(404, 'Không có mục này trong sổ lỗi');
  return notebookView(context());
});

route('POST', '/api/notebook/merge', async (req) => {
  const { keys, into } = await readBody<{ keys?: unknown; into?: unknown }>(req);
  if (!Array.isArray(keys) || keys.length < 2 || keys.length > 20) throw new HttpError(400, 'Chọn 2–20 mục để gộp');
  const merged = mergeEntries(keys.map(String), typeof into === 'string' ? into : undefined);
  return { merged, view: notebookView(context()) };
});

// ── 🎧 listen ───────────────────────────────────────────────────────────────

route('GET', '/api/listen/next', (_req, url) => listenNext(context(), Number(url.searchParams.get('n')) || 10));

route('POST', '/api/listen/finish', async (req) => finishListen(await readBody<Partial<ListenFinishRequest>>(req), context().bank));
