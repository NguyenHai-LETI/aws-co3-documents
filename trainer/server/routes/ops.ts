// Ops routes: two-machine git sync. (owner: ops)
import { HttpError, readBody, route } from '../http.ts';
import { isSyncing, runSync, syncStatus } from '../lib/sync.ts';

/** `?fetch=0` skips the best-effort `git fetch` (otherwise at most one fetch per minute). */
route('GET', '/api/sync/status', (_req, url) => syncStatus({ fetch: url.searchParams.get('fetch') !== '0' }));

/** Body `{dryRun?: boolean}` → SyncResult (ok:false + Vietnamese hint on failure, still HTTP 200 so the UI can show the steps). */
route('POST', '/api/sync', async (req) => {
  const body = await readBody<{ dryRun?: boolean }>(req);
  if (isSyncing()) throw new HttpError(409, 'Đang đồng bộ — đợi lượt hiện tại xong rồi thử lại.');
  return runSync({ dryRun: body.dryRun === true });
});
