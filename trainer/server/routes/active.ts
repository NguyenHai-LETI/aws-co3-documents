// [v5] GET / PUT / DELETE /api/active — the unfinished test mirrored for another device (lib/active.ts, .local/active.json).
// The browser keeps its own copy (localStorage) as the primary one; the mirror only lets the phone (LAN, same server)
// resume a test started on the desktop and the other way round. Practice scope on LAN.
import { HttpError, readBody, route } from '../http.ts';
import { attemptBySession } from '../lib/results.ts';
import { clearActiveMirror, loadActiveMirror, mirrorInfo, mirrorSession, saveActiveMirror } from '../lib/active.ts';

/**
 * → `{ active: ActiveMirror | null }`; `?info=1` → `{ active: ActiveMirrorInfo | null }` without the test (the runner's cheap
 * "did another device continue?" poll). `&session=<id>` adds `submitted: <attempt id>` when that test was already submitted
 * (on any device). A mirror whose session was already submitted is dropped.
 */
route('GET', '/api/active', (_req, url) => {
  const asked = url.searchParams.get('session');
  const done = asked && asked.length <= 200 ? attemptBySession(asked) : undefined;
  const m = loadActiveMirror();
  const sid = m ? mirrorSession(m.test)?.sessionId : undefined;
  let active = m;
  if (m && sid && (sid === asked ? done : attemptBySession(sid))) {
    clearActiveMirror(sid);
    active = undefined;
  }
  const out: { active: unknown; submitted?: string } = { active: active ? (url.searchParams.get('info') === '1' ? mirrorInfo(active) : active) : null };
  if (done) out.submitted = done.id;
  return out;
});

/**
 * Body `{ changedAt?, base?, device, deviceId, test }` → `{ saved, refused?: 'older' | 'conflict' | 'submitted', active }`
 * (lib/active.ts saveActiveMirror). A refusal is a 200; 400 only for a body that is not an unfinished test. A test already
 * submitted (from any device) is never mirrored again.
 */
route('PUT', '/api/active', async (req) => {
  const body = await readBody<unknown>(req);
  const sid = mirrorSession((body as { test?: unknown } | null)?.test)?.sessionId;
  if (sid && attemptBySession(sid)) {
    clearActiveMirror(sid);
    return { saved: false, refused: 'submitted', active: null };
  }
  try {
    return saveActiveMirror(body);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
});

/** `?session=<sessionId>` removes the mirror only when it is that session's (another device may have started a new one). */
route('DELETE', '/api/active', (_req, url) => {
  const sid = url.searchParams.get('session');
  return { removed: clearActiveMirror(sid && sid.length <= 200 ? sid : undefined) };
});
