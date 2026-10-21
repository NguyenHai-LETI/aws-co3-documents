// Local HTTP server: JSON API + the React UI, bound to 127.0.0.1. Opt-in LAN access adds a listener on the local network
// (server/lib/lan.ts): every request and websocket upgrade passes its gate first, and [v5] LAN devices are limited to the
// practice scope (server/lib/lan-scope.ts) unless server.lan_admin. API routes live in server/routes/* and register
// themselves on import.
// [v5] UI: `npm start` serves the production build (server/lib/lan-ui.ts) to every client; `npm run dev`, --dev or
// TRAINER_UI=dev keep Vite in middleware mode with HMR for this machine. Vite is only loaded in dev mode, or as a fallback
// when the build fails.
import http from 'node:http';
import type { ViteDevServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import tty from 'node:tty';
import { spawn } from 'node:child_process';
import { HOST, PORT, TRAINER_DIR, PACKS_DIR, RESULTS_DIR, PLANS_DIR, RUNS_DIR, INBOX_DIR, PATCHES_DIR, ENRICH_DIR, QA_DIR, loadConfig } from './config.ts';
import { HttpError, RawResponse, broadcast, decodable, isLocalRequest, json, routes, sendRaw, sseClients } from './http.ts';
import { clientScope, gateRequest, gateUpgrade, lanAdminState, lanBanner, lanEnabled, lanHostNames, setLanAdmin, setLanEnabled, setLocalUiMode, startLan, stopLan, upgradePath } from './lib/lan.ts';
import { appUi, setUiFrozen } from './lib/lan-ui.ts';
import { routeScope, scopeAllows, scopeRefusal } from './lib/lan-scope.ts';
import { dataVersions } from './context.ts';
import { loadBank } from './lib/bank.ts';
import { loadAttempts } from './lib/results.ts';
import { ensureIssuesFile } from './lib/issues.ts';
import { flushSnapshot, scheduleSnapshot } from './lib/snapshot.ts';
import { coachRunner, refreshClaudeStatus } from './lib/coach-runner.ts';
import { migrateResults } from './lib/migrations.ts';
import { ensureSealed } from './lib/sealed.ts';
import { autoSync, onSyncDone, shutdownPush, syncInFlight } from './lib/sync.ts';
import { RESTART_EXIT_CODE, checkCodeChange, codeVersion, initCodeWatch, launcherActive, markUpdate, onRestartRequest, pendingUpdate, takeRestartMarker, updateStatus, watchMode, writeRestartMarker } from './lib/version.ts';
import './routes/core.ts';
import './routes/learning.ts';
import './routes/quality.ts';
import './routes/ai.ts';
import './routes/ops.ts';
import './routes/progress.ts';
import './routes/verify.ts';
import './routes/search.ts';
import './routes/export.ts';
import './routes/sealed.ts';
// [v5] new route files (owners: today σ · leeches λ · active ρ · pairs γ1 · tutor τ · micro π)
import './routes/today.ts';
import './routes/leeches.ts';
import './routes/active.ts';
import './routes/pairs.ts';
import './routes/tutor.ts';
import './routes/micro.ts';

/** {bank, results, plans, params, config, day} — same helper as /api/meta and /api/state `versions` ([P]). */
function versions() {
  return dataVersions();
}

// ── Server-Sent Events (coach progress + "data changed" notifications) ─────
coachRunner.on('event', (ev) => broadcast('coach', ev));
coachRunner.on('done', (info) => {
  broadcast('coach-done', info);
  scheduleSnapshot();
});
let lastVersions = '';
setInterval(() => {
  if (!sseClients.size) return;
  try {
    const v = JSON.stringify(versions());
    if (v !== lastVersions) {
      if (lastVersions) broadcast('data', JSON.parse(v));
      lastVersions = v;
    }
  } catch {
    // transient parse error while a file is being written — ignore
  }
  try {
    // app code pulled by another process (scheduled coach run, `npm run sync`, a terminal): the banner too — whoever
    // noticed it first (this poll, a GET /api/update), open pages hear it within a few seconds
    checkCodeChange();
    announceUpdate();
  } catch {
    // git busy — next tick
  }
}, 3000);

let announced = '';
/** SSE `update` when the pending update changed since the last announcement. */
function announceUpdate(): void {
  const u = pendingUpdate();
  const key = u ? `${u.at}|${u.files.join(',')}` : '';
  if (!key || key === announced) return;
  announced = key;
  broadcast('update', updateStatus());
}
setInterval(() => {
  for (const c of sseClients) c.write(': ping\n\n');
}, 25_000);

// Every finished sync (⇅ button, auto sync, AI coach, startup) → SSE `sync` (SyncButton refreshes its status). A sync
// that received app code from the other machine → SSE `update` (banner: restart to run the new code).
let quiet = false; // the terminal is gone (SIGHUP): writing to it could fail
const say = (line: string) => {
  if (!quiet) console.log(line);
};
onSyncDone((r) => {
  broadcast('sync', { ok: r.ok, message: r.message, source: r.source, committed: r.committed, received: r.received, pushed: r.pushed, at: new Date().toISOString() });
  if (!r.codeFiles?.length || watchMode()) return; // `npm run dev` restarts by itself when server/ or shared/ change
  const u = markUpdate(r.codeFiles);
  announceUpdate();
  const shown = r.codeFiles.slice(0, 3).join(', ') + (r.codeFiles.length > 3 ? ', …' : '');
  say(`\n  🔄 Đồng bộ vừa nhận code mới (${r.codeFiles.length} file: ${shown}).`);
  say(
    launcherActive()
      ? '     Mở app trong trình duyệt và bấm “Khởi động lại” trên banner để dùng bản mới.'
      : `     Tắt app (Ctrl+C) rồi chạy lại ${u?.lockChanged ? '`npm install` và ' : ''}\`npm start\` để dùng bản mới.`,
  );
});

// ── server ──────────────────────────────────────────────────────────────────

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  // The Host allow-list (DNS rebinding) and the LAN access code are checked by gateRequest before we get here.
  // Cross-site requests cannot set this header: the coach endpoint can launch an agent.
  if (req.method !== 'GET' && req.headers['x-trainer'] !== '1') return json(res, 403, { error: 'Missing X-Trainer header' });

  if (url.pathname === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 3000\n\n');
    // which code this process runs: a page that reconnects after a restart reloads itself when it changed
    res.write(`event: hello\ndata: ${JSON.stringify(updateStatus())}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = url.pathname.match(r.re);
    if (!m) continue;
    // [v5] least privilege: LAN devices may call practice routes; admin ones only with server.lan_admin, local ones never
    const scope = routeScope(r.method, r.pattern);
    if (!scopeAllows(scope, clientScope(req))) return json(res, 403, { error: scopeRefusal(scope), scope });
    // route params arrive still %-encoded and handlers decode them: a malformed escape is the client's error, not a 500
    if (!m.slice(1).every(decodable)) return json(res, 400, { error: 'Bad request: malformed %-encoding in the URL' });
    try {
      const out = await r.fn(req, url, m.slice(1));
      // a test was built = the learner is busy: no quiet auto sync mid-test (the next submit schedules one again)
      if (req.method === 'POST' && url.pathname === '/api/tests') autoSync.noteTestBuilt();
      if (out instanceof RawResponse) return sendRaw(res, out);
      return json(res, 200, out ?? { ok: true });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      return json(res, status, { error: (e as Error).message });
    }
  }
  return json(res, 404, { error: 'Not found' });
}

function openBrowser(url: string) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    // no browser launcher available — the URL is printed anyway
  }
}

async function main() {
  codeVersion(); // frozen now, before any sync can pull newer code into the work tree
  initCodeWatch(); // baseline of the code paths at HEAD: code pulled by another process (coach run, npm run sync) is noticed
  const restarted = takeRestartMarker(); // state handed over by the previous process when it restarted for an update

  // ── shutdown, installed before anything else: a signal during the startup pull must wait for git ────────────
  // (a sync stopped halfway leaves a half-rebased repo). The server and Vite are closed once they exist.
  let server: http.Server | undefined;
  let vite: { close(): Promise<void> } | undefined;
  let stopping = false;
  let waiting = false; // waiting for the in-flight sync / the shutdown push (a second signal exits at once)
  let exitCode = 0;
  const attempt = (what: string, fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      console.error(`${what} failed`, e);
    }
  };
  /** `code` 75 = restart: the launcher (start.sh / .bat / .command) runs the server again. */
  const shutdown = (code = 0) => {
    if (stopping) {
      // a second signal while closing (Ctrl+C twice, SIGHUP then SIGTERM, …): stop waiting — git finishes on its own
      if (waiting) process.exit(exitCode);
      return;
    }
    stopping = true;
    exitCode = code;
    autoSync.stop(); // a submit answered while closing must not start another sync
    attempt('snapshot', flushSnapshot); // first, synchronously: a snapshot still waiting on its debounce
    attempt('coach cancel', () => coachRunner.cancel());
    if (code === RESTART_EXIT_CODE) attempt('restart marker', () => writeRestartMarker({ lan: lanEnabled(), lanAdmin: lanAdminState().source === 'runtime' ? lanAdminState().enabled : undefined }));
    attempt('UI build stop', () => appUi.stop());
    attempt('LAN stop', stopLan);
    attempt('server close', () => server?.close());
    const exit = () => process.exit(code);
    setTimeout(exit, SHUTDOWN_MAX_MS).unref(); // hard upper bound, whatever hangs (an orphaned git still finishes)
    waiting = true;
    void (async () => {
      const inflight = syncInFlight();
      if (inflight) {
        say('  ⇅ Đợi lượt đồng bộ đang chạy xong rồi mới tắt… (Ctrl+C lần nữa để thoát ngay — git vẫn tự chạy nốt)');
        await inflight.catch(() => undefined);
      }
      // sync.auto: idle → push what is still only on this machine (commit + push, bounded; skipped when nothing is pending)
      const r = await shutdownPush(SHUTDOWN_PUSH_MS, () => say('  ⇅ Đang đẩy dữ liệu học lên GitHub trước khi tắt… (Ctrl+C lần nữa để bỏ qua)')).catch(() => undefined);
      if (r) say(r.ok ? `  ⇅ Đã đẩy dữ liệu lên trước khi tắt: ${r.message}` : `  ⚠️ Chưa đẩy được dữ liệu trước khi tắt: ${r.message}`);
    })().finally(() => {
      waiting = false;
      if (code === RESTART_EXIT_CODE) say('  ↻ Đang khởi động lại để dùng bản mới…');
      setTimeout(exit, 3000).unref(); // never hang on a slow close
      if (vite) void vite.close().finally(exit);
      else exit();
    });
  };
  onRestartRequest(() => shutdown(RESTART_EXIT_CODE));
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const) process.on(sig, () => shutdown()); // SIGBREAK: Ctrl+Break on Windows
  // SIGHUP: the terminal / Windows console window was closed → stop. A process detached from any terminal (nohup,
  // a service manager) keeps running — listening for SIGHUP overrides nohup's "ignore" — but still writes the snapshot.
  const fromTerminal = tty.isatty(0) || tty.isatty(1); // decided at startup: after a hangup the terminal is gone
  process.on('SIGHUP', () => {
    if (fromTerminal) {
      quiet = true;
      shutdown();
    } else attempt('snapshot', flushSnapshot);
  });

  for (const d of [path.join(PACKS_DIR, 'ai'), path.join(PACKS_DIR, 'docs'), path.join(PACKS_DIR, 'manual'), RESULTS_DIR, PLANS_DIR, RUNS_DIR, INBOX_DIR, PATCHES_DIR, ENRICH_DIR, QA_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
  ensureIssuesFile();
  const prepareData = () => {
    try {
      const m = migrateResults();
      if (m.migrated) console.log(`  ↻ Đã chuyển đổi ${m.migrated} file kết quả theo bố cục đáp án mới`);
    } catch (e) {
      console.error('result migration failed', e);
    }
    try {
      // hold back the sealed forms before the first practice session (no-op when they exist or exam.sealed_forms = 0)
      const sealed = ensureSealed(loadBank(), loadAttempts(), loadConfig());
      const open = sealed.forms.filter((f) => f.status === 'sealed');
      if (open.length) console.log(`  🔒 ${open.length} đề niêm phong (${open.reduce((n, f) => n + f.ids.length, 0)} câu) đang được giữ riêng để đo điểm trên câu mới`);
    } catch (e) {
      console.error('sealed forms failed', e);
    }
  };
  // sync.auto: idle → pull FIRST: the result migration and the sealed forms must see what the other machine pushed (two
  // machines must not each create their own forms before syncing). The wait is bounded: on a slow network the app opens
  // with the data on this machine and the preparation runs once the sync is done; a failed pull just continues.
  const pull = autoSync.startup();
  let waitTimer: ReturnType<typeof setTimeout> | undefined;
  const pulledInTime = await Promise.race([
    pull.then(() => true),
    new Promise<boolean>((resolve) => {
      waitTimer = setTimeout(() => resolve(false), STARTUP_SYNC_WAIT_MS);
    }),
  ]);
  clearTimeout(waitTimer);
  if (stopping) return; // a signal arrived during the pull: shutdown() waited for it and exits — no server
  if (pulledInTime) prepareData();
  else {
    console.log(`  ⇅ Đồng bộ khi mở app chưa xong sau ${STARTUP_SYNC_WAIT_MS / 1000} s (mạng chậm?) — mở app với dữ liệu trên máy, đồng bộ tiếp ở nền.`);
    void pull.finally(() => {
      if (!stopping) prepareData();
    });
  }
  const app = http.createServer();
  server = app;
  // Never listens: receives the websocket upgrades the LAN gate lets through, so Vite's HMR socket sees only those.
  const hmrHub = http.createServer();
  let devServer: ViteDevServer | undefined;
  let devStarting: Promise<ViteDevServer> | undefined;
  /** The Vite dev server: at startup in dev mode, lazily in dist mode (only when the production build failed). */
  const dev = (): Promise<ViteDevServer> =>
    (devStarting ??= (async () => {
      const { createServer: createVite } = await import('vite');
      const d = await createVite({
        root: TRAINER_DIR,
        configFile: path.join(TRAINER_DIR, 'vite.config.ts'),
        appType: 'spa',
        server: {
          middlewareMode: true,
          ws: { server: hmrHub },
          allowedHosts: lanHostNames(), // <host>.local for LAN devices (IP hosts are always allowed; gateRequest decides first)
          cors: false, // no page on another origin (e.g. another localhost port) may read what the dev server serves
          // the data dir is the Vite root by default: never serve the LAN access token, caches, git internals, keys, env
          fs: { deny: ['.env', '.env.*', '*.{crt,pem,key}', '**/.git/**', '**/.local/**', '**/.cache/**'] },
          watch: { ignored: ['**/bank/**', '**/results/**', '**/coach/**', '**/inbox/**', '**/node_modules/**', '**/.cache/**', '**/.local/**', '**/dist/**'] },
        },
        logLevel: 'warn',
      });
      devServer = d;
      vite = d;
      return d;
    })());
  // the build follows the code this process runs: a code update received by sync waits for the restart
  setUiFrozen(() => !!pendingUpdate());
  setLocalUiMode(UI_MODE);
  if (UI_MODE === 'dev') await dev();
  if (stopping) return; // a signal arrived while Vite was starting: shutdown() closes it and exits
  app.on('upgrade', (req, socket, head) => {
    // Node drops the server's socket error handler on upgrade: without this, a client resetting the connection while
    // we answer (EPIPE / ECONNRESET) would be an unhandled 'error' event — and take the whole server down.
    socket.on('error', () => socket.destroy());
    if (!gateUpgrade(req, socket)) return;
    const protocol = String(req.headers['sec-websocket-protocol'] ?? '');
    // Vite answers its HMR socket and liveness ping on "/" only — anything else would stay open forever. No dev server
    // (production build): nothing to upgrade to.
    if (devServer && (protocol === 'vite-hmr' || protocol === 'vite-ping') && upgradePath(req) === '/') hmrHub.emit('upgrade', req, socket, head);
    else socket.destroy();
  });
  const handleRequest = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://localhost');
    } catch {
      return json(res, 400, { error: 'Bad request' });
    }
    if (!gateRequest(req, res, url)) return;
    if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
    // pages and assets are read-only: anything but GET / HEAD never reaches a file server (the Vite dev server would
    // answer a POST with the raw file — config.yaml, results, sources)
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end('Method not allowed');
    }
    const local = isLocalRequest(req);
    // the production build: every client in dist mode, LAN devices (phones) always — much faster over Wi-Fi
    if ((UI_MODE === 'dist' || !local) && (await appUi.serve(req, res, url))) return;
    // the Vite dev server only ever answers this machine: in dev mode, or in dist mode while the build is unavailable
    if (!local || (UI_MODE === 'dist' && appUi.mode() !== 'dev')) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '5' });
      return res.end('Giao diện đang được dựng lại — thử lại sau vài giây.');
    }
    (await dev()).middlewares(req, res);
  };
  app.on('request', (req, res) => {
    handleRequest(req, res).catch((e) => {
      console.error(e);
      if (!res.headersSent) json(res, 500, { error: String(e) });
    });
  });
  app.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n  ✗ Cổng ${PORT} đang được dùng — app có thể đã chạy sẵn: mở http://localhost:${PORT}\n    (dừng tiến trình cũ: lsof -ti tcp:${PORT} | xargs kill — hoặc đổi cổng: PORT=4000 npm start)\n`);
      process.exit(1);
    }
    throw e;
  });
  app.listen(PORT, HOST, async () => {
    const bank = loadBank();
    const errors = bank.problems.filter((p) => p.level === 'error').length;
    const url = `http://localhost:${PORT}`;
    console.log(`\n  🎓 AWS SAA-C03 Trainer → ${url}`);
    console.log(`     Bank: ${bank.questions.length} câu / ${bank.packs.length} pack${errors ? ` · ⚠️ ${errors} lỗi (npm run validate)` : ''} · Kết quả: ${loadAttempts().length} bài`);
    const autoOn = autoSync.active();
    const claude = refreshClaudeStatus().catch(() => undefined); // --version / auth status in the background (no spawnSync)
    await startLan(app).catch((e) => console.error('LAN start failed', e)); // config server.lan · npm start -- --lan · LAN=1
    // restarted for a code update: LAN access switched on from 🧰 Công cụ stays on, phones keep working
    if (restarted?.lan && !lanEnabled()) await setLanEnabled(true).catch((e) => console.error('LAN restore failed', e));
    if (restarted?.lanAdmin !== undefined) setLanAdmin(restarted.lanAdmin);
    if (UI_MODE === 'dist') void appUi.ensure(); // warm the build (reused when the sources did not change)
    if (process.env.OPEN === '1' || process.argv.includes('--open')) openBrowser(lanEnabled() ? `${url}/#/tools` : url);
    const c = await claude;
    console.log(`     AI Coach: ${c?.available ? `Claude Code ${c.version} (${c.source})` : 'chưa tìm thấy Claude Code CLI — xem README'}`);
    console.log(await lanBanner().catch(() => ''));
    if (autoOn) console.log('  ⇅ Tự đồng bộ khi rảnh: bật (sync.auto: idle) — kéo về khi mở app, đẩy lên vài phút sau mỗi bài nộp và khi tắt app');
  });
}

/**
 * [v5] How this machine gets the UI: 'dist' (production build — `npm start`, start.sh, the service) or 'dev' (Vite with
 * HMR — `npm run dev`, --dev, TRAINER_UI=dev; test sandboxes too).
 */
const UI_MODE: 'dist' | 'dev' =
  process.argv.includes('--dev') || (process.env.TRAINER_UI ?? '').toLowerCase() === 'dev' || (watchMode() && (process.env.TRAINER_UI ?? '').toLowerCase() !== 'dist') ? 'dev' : 'dist';

/** Upper bound for the push at shutdown (sync.auto: idle). */
const SHUTDOWN_PUSH_MS = 12_000;
/** Closing the app never takes longer: waiting for an in-flight sync + the push + closing Vite. */
const SHUTDOWN_MAX_MS = SHUTDOWN_PUSH_MS + 3000;
/** How long startup waits for the startup pull (sync.auto: idle) before opening with the data on this machine. */
const STARTUP_SYNC_WAIT_MS = 8000;

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
