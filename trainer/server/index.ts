// Local HTTP server: JSON API + Vite (React UI) in middleware mode, bound to 127.0.0.1. Opt-in LAN access adds a
// listener on the local network (server/lib/lan.ts): every request and websocket upgrade passes its gate first.
// API routes live in server/routes/* and register themselves on import.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import tty from 'node:tty';
import { spawn } from 'node:child_process';
import { HOST, PORT, TRAINER_DIR, PACKS_DIR, RESULTS_DIR, PLANS_DIR, RUNS_DIR, INBOX_DIR, PATCHES_DIR, ENRICH_DIR, QA_DIR, loadConfig } from './config.ts';
import { HttpError, RawResponse, broadcast, isLocalRequest, json, routes, sendRaw, sseClients } from './http.ts';
import { gateRequest, gateUpgrade, lanBanner, lanEnabled, lanHostNames, setLanEnabled, startLan, stopLan, upgradePath } from './lib/lan.ts';
import { serveLanUi } from './lib/lan-ui.ts';
import { dataVersions } from './context.ts';
import { loadBank } from './lib/bank.ts';
import { loadAttempts } from './lib/results.ts';
import { ensureIssuesFile } from './lib/issues.ts';
import { flushSnapshot, scheduleSnapshot } from './lib/snapshot.ts';
import { coachRunner, refreshClaudeStatus } from './lib/coach-runner.ts';
import { migrateResults } from './lib/migrations.ts';
import { ensureSealed } from './lib/sealed.ts';
import { autoSync, onSyncDone, shutdownPush } from './lib/sync.ts';
import { RESTART_EXIT_CODE, codeVersion, launcherActive, markUpdate, onRestartRequest, takeRestartMarker, updateStatus, watchMode, writeRestartMarker } from './lib/version.ts';
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
}, 3000);
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
  broadcast('update', updateStatus());
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
  const restarted = takeRestartMarker(); // state handed over by the previous process when it restarted for an update
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
  if (pulledInTime) prepareData();
  else {
    console.log(`  ⇅ Đồng bộ khi mở app chưa xong sau ${STARTUP_SYNC_WAIT_MS / 1000} s (mạng chậm?) — mở app với dữ liệu trên máy, đồng bộ tiếp ở nền.`);
    void pull.finally(prepareData);
  }
  const server = http.createServer();
  // Never listens: receives the websocket upgrades the LAN gate lets through, so Vite's HMR socket sees only those.
  const hmrHub = http.createServer();
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({
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
  server.on('upgrade', (req, socket, head) => {
    // Node drops the server's socket error handler on upgrade: without this, a client resetting the connection while
    // we answer (EPIPE / ECONNRESET) would be an unhandled 'error' event — and take the whole server down.
    socket.on('error', () => socket.destroy());
    if (!gateUpgrade(req, socket)) return;
    const protocol = String(req.headers['sec-websocket-protocol'] ?? '');
    // Vite answers its HMR socket and liveness ping on "/" only — anything else would stay open forever.
    if ((protocol === 'vite-hmr' || protocol === 'vite-ping') && upgradePath(req) === '/') hmrHub.emit('upgrade', req, socket, head);
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
    // LAN devices (phones) get the production build — much faster than the dev server over Wi-Fi.
    if (!isLocalRequest(req) && (await serveLanUi(req, res, url))) return;
    vite.middlewares(req, res);
  };
  server.on('request', (req, res) => {
    handleRequest(req, res).catch((e) => {
      console.error(e);
      if (!res.headersSent) json(res, 500, { error: String(e) });
    });
  });
  server.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n  ✗ Cổng ${PORT} đang được dùng — app có thể đã chạy sẵn: mở http://localhost:${PORT}\n    (dừng tiến trình cũ: lsof -ti tcp:${PORT} | xargs kill — hoặc đổi cổng: PORT=4000 npm start)\n`);
      process.exit(1);
    }
    throw e;
  });
  server.listen(PORT, HOST, async () => {
    const bank = loadBank();
    const errors = bank.problems.filter((p) => p.level === 'error').length;
    const url = `http://localhost:${PORT}`;
    console.log(`\n  🎓 AWS SAA-C03 Trainer → ${url}`);
    console.log(`     Bank: ${bank.questions.length} câu / ${bank.packs.length} pack${errors ? ` · ⚠️ ${errors} lỗi (npm run validate)` : ''} · Kết quả: ${loadAttempts().length} bài`);
    const autoOn = autoSync.active();
    const claude = refreshClaudeStatus().catch(() => undefined); // --version / auth status in the background (no spawnSync)
    await startLan(server).catch((e) => console.error('LAN start failed', e)); // config server.lan · npm start -- --lan · LAN=1
    // restarted for a code update: LAN access switched on from 🧰 Công cụ stays on, phones keep working
    if (restarted?.lan && !lanEnabled()) await setLanEnabled(true).catch((e) => console.error('LAN restore failed', e));
    if (process.env.OPEN === '1' || process.argv.includes('--open')) openBrowser(lanEnabled() ? `${url}/#/tools` : url);
    const c = await claude;
    console.log(`     AI Coach: ${c?.available ? `Claude Code ${c.version} (${c.source})` : 'chưa tìm thấy Claude Code CLI — xem README'}`);
    console.log(await lanBanner().catch(() => ''));
    if (autoOn) console.log('  ⇅ Tự đồng bộ khi rảnh: bật (sync.auto: idle) — kéo về khi mở app, đẩy lên vài phút sau mỗi bài nộp và khi tắt app');
  });
  const attempt = (what: string, fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      console.error(`${what} failed`, e);
    }
  };
  let stopping = false;
  let pushing = false;
  let exitCode = 0;
  /** `code` 75 = restart: the launcher (start.sh / .bat / .command) runs the server again. */
  const shutdown = (code = 0) => {
    if (stopping) {
      // a second signal while closing (Ctrl+C twice, SIGHUP then SIGTERM, …): stop waiting for the shutdown push
      if (pushing) process.exit(exitCode);
      return;
    }
    stopping = true;
    exitCode = code;
    attempt('snapshot', flushSnapshot); // first, synchronously: a snapshot still waiting on its debounce
    attempt('coach cancel', () => coachRunner.cancel());
    if (code === RESTART_EXIT_CODE) attempt('restart marker', () => writeRestartMarker({ lan: lanEnabled() }));
    attempt('LAN stop', stopLan);
    attempt('server close', () => server.close());
    const exit = () => process.exit(code);
    setTimeout(exit, SHUTDOWN_PUSH_MS + 3000).unref(); // hard upper bound, whatever hangs
    // sync.auto: idle → push what is still only on this machine (commit + push, bounded; skipped when nothing is pending)
    pushing = true;
    const pushed = shutdownPush(SHUTDOWN_PUSH_MS, () => say('  ⇅ Đang đẩy dữ liệu học lên GitHub trước khi tắt… (Ctrl+C lần nữa để bỏ qua)')).then(
      (r) => {
        if (r) say(r.ok ? `  ⇅ Đã đẩy dữ liệu lên trước khi tắt: ${r.message}` : `  ⚠️ Chưa đẩy được dữ liệu trước khi tắt: ${r.message}`);
      },
      () => undefined,
    );
    void pushed.finally(() => {
      pushing = false;
      if (code === RESTART_EXIT_CODE) say('  ↻ Đang khởi động lại để dùng bản mới…');
      setTimeout(exit, 3000).unref(); // never hang on a slow close
      vite.close().finally(exit);
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
}

/** Upper bound for the push at shutdown (sync.auto: idle) — closing the app never waits longer than this (+3 s). */
const SHUTDOWN_PUSH_MS = 12_000;
/** How long startup waits for the startup pull (sync.auto: idle) before opening with the data on this machine. */
const STARTUP_SYNC_WAIT_MS = 8000;

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
