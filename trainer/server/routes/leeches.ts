// [v5 · λ] Leeches ("câu dai dẳng", leech.ts, results/leeches.md):
//   GET  /api/leeches                               → LeechItem[] (worst first; sealed questions never listed)
//   POST /api/leeches/:id {note?, pauseDays?}        → {ok, item?, leeches} — missing fields keep their value;
//        pauseDays 0 = un-park, 1–3 = park from today (only a current leech); 404 unknown, 400 bad input
import { HttpError, readBody, route } from '../http.ts';
import { context } from '../context.ts';
import { LeechError, leeches, saveLeechNote } from '../lib/leech.ts';
import type { LeechItem } from '../../shared/types.ts';

route('GET', '/api/leeches', (): LeechItem[] => leeches(context()));

route('POST', '/api/leeches/:id', async (req, _url, [raw]) => {
  const body = (await readBody<{ note?: unknown; pauseDays?: unknown }>(req)) ?? {};
  const id = decodeURIComponent(raw);
  try {
    saveLeechNote(context(), id, { note: body.note, pauseDays: body.pauseDays });
  } catch (e) {
    if (e instanceof LeechError) throw new HttpError(e.status, e.message);
    throw e;
  }
  const list = leeches(context()); // leeches.md is in results/: a new context with the pause applied
  return { ok: true, item: list.find((x) => x.id === id), leeches: list };
});
