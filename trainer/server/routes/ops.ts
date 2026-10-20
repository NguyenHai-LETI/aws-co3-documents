// Ops routes: two-machine git sync, code-update status and restart. (owner: ops)
import { HttpError, readBody, route } from '../http.ts';
import { isSyncing, runSync, syncStatus } from '../lib/sync.ts';
import { coachRunner } from '../lib/coach-runner.ts';
import { launcherActive, requestRestart, updateStatus } from '../lib/version.ts';

/**
 * `?fetch=0` skips the best-effort `git fetch` (otherwise at most one fetch per minute). Extras: lastRun / lastOkAt (this
 * process), unpushedSince + stale (> 24 h), auto (sync.auto scheduler state).
 */
route('GET', '/api/sync/status', (_req, url) => syncStatus({ fetch: url.searchParams.get('fetch') !== '0' }));

/** Body `{dryRun?: boolean}` → SyncResult (ok:false + Vietnamese hint on failure, still HTTP 200 so the UI can show the steps). */
route('POST', '/api/sync', async (req) => {
  const body = await readBody<{ dryRun?: boolean }>(req);
  if (isSyncing()) throw new HttpError(409, 'Đang đồng bộ — đợi lượt hiện tại xong rồi thử lại.');
  return runSync({ dryRun: body.dryRun === true });
});

/** {codeVersion, launcher, watch, update?} — update = a sync brought newer app code than this process runs. */
route('GET', '/api/update', () => updateStatus());

/**
 * Restart after a code update: answers, then exits with code 75 so start.sh / start.bat / start.command run the server
 * again (npm install first when package-lock.json changed). Without a launcher → 409 with what to do by hand.
 */
route('POST', '/api/restart', () => {
  if (!launcherActive()) {
    throw new HttpError(409, 'App không được mở bằng start.command / start.sh / start.bat nên không tự khởi động lại được — tắt app (Ctrl+C trong cửa sổ Terminal) rồi chạy lại `npm start`.');
  }
  // a run in this process would be cut off (a scheduled run in its own process is not affected by the restart)
  if (coachRunner.status().running) throw new HttpError(409, 'AI Coach đang chạy — đợi lượt chạy xong rồi khởi động lại.');
  if (isSyncing()) throw new HttpError(409, 'Đang đồng bộ — đợi xong rồi khởi động lại.');
  if (!requestRestart()) throw new HttpError(409, 'Tiến trình này không tự khởi động lại được — chạy lại `npm start`.');
  return { ok: true, restarting: true };
});
