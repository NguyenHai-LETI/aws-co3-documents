// Local HTTP server: JSON API + Vite (React UI) in middleware mode, bound to 127.0.0.1. Opt-in LAN access adds a
// listener on the local network (server/lib/lan.ts): every request and websocket upgrade passes its gate first.
// API routes live in server/routes/* and register themselves on import.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import tty from 'node:tty';
import { spawn } from 'node:child_process';
import { HOST, PORT, TRAINER_DIR, PACKS_DIR, RESULTS_DIR, PLANS_DIR, RUNS_DIR, INBOX_DIR, PATCHES_DIR, ENRICH_DIR, QA_DIR } from './config.ts';
import { HttpError, RawResponse, broadcast, isLocalRequest, json, routes, sendRaw, sseClients } from './http.ts';
import { gateRequest, gateUpgrade, lanBanner, lanEnabled, lanHostNames, startLan, stopLan, upgradePath } from './lib/lan.ts';
import { serveLanUi } from './lib/lan-ui.ts';
import { dataVersions } from './context.ts';
import { loadBank } from './lib/bank.ts';
import { loadAttempts } from './lib/results.ts';
import { ensureIssuesFile } from './lib/issues.ts';
import { flushSnapshot, scheduleSnapshot } from './lib/snapshot.ts';
import { coachRunner, refreshClaudeStatus } from './lib/coach-runner.ts';
import { migrateResults } from './lib/migrations.ts';
import './routes/core.ts';
import './routes/learning.ts';
import './routes/quality.ts';
import './routes/ai.ts';
import './routes/ops.ts';
import './routes/progress.ts';
import './routes/verify.ts';
import './routes/search.ts';
import './routes/export.ts';

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

// ── server ──────────────────────────────────────────────────────────────────

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  // The Host allow-list (DNS rebinding) and the LAN access code are checked by gateRequest before we get here.
  // Cross-site requests cannot set this header: the coach endpoint can launch an agent.
  if (req.method !== 'GET' && req.headers['x-trainer'] !== '1') return json(res, 403, { error: 'Missing X-Trainer header' });

  if (url.pathname === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 3000\n\n');
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
  for (const d of [path.join(PACKS_DIR, 'ai'), path.join(PACKS_DIR, 'docs'), path.join(PACKS_DIR, 'manual'), RESULTS_DIR, PLANS_DIR, RUNS_DIR, INBOX_DIR, PATCHES_DIR, ENRICH_DIR, QA_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
  ensureIssuesFile();
  try {
    const m = migrateResults();
    if (m.migrated) console.log(`  ↻ Đã chuyển đổi ${m.migrated} file kết quả theo bố cục đáp án mới`);
  } catch (e) {
    console.error('result migration failed', e);
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
    const claude = refreshClaudeStatus().catch(() => undefined); // --version / auth status in the background (no spawnSync)
    await startLan(server).catch((e) => console.error('LAN start failed', e)); // config server.lan · npm start -- --lan · LAN=1
    if (process.env.OPEN === '1' || process.argv.includes('--open')) openBrowser(lanEnabled() ? `${url}/#/tools` : url);
    const c = await claude;
    console.log(`     AI Coach: ${c?.available ? `Claude Code ${c.version} (${c.source})` : 'chưa tìm thấy Claude Code CLI — xem README'}`);
    console.log(await lanBanner().catch(() => ''));
  });
  const attempt = (what: string, fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      console.error(`${what} failed`, e);
    }
  };
  let stopping = false;
  const shutdown = () => {
    if (stopping) return; // a second signal while closing (Ctrl+C twice, SIGHUP then SIGTERM, …)
    stopping = true;
    attempt('snapshot', flushSnapshot); // first, synchronously: a snapshot still waiting on its debounce
    attempt('coach cancel', () => coachRunner.cancel());
    attempt('LAN stop', stopLan);
    attempt('server close', () => server.close());
    setTimeout(() => process.exit(0), 3000).unref(); // never hang on a slow close
    vite.close().finally(() => process.exit(0));
  };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const) process.on(sig, shutdown); // SIGBREAK: Ctrl+Break on Windows
  // SIGHUP: the terminal / Windows console window was closed → stop. A process detached from any terminal (nohup,
  // a service manager) keeps running — listening for SIGHUP overrides nohup's "ignore" — but still writes the snapshot.
  const fromTerminal = tty.isatty(0) || tty.isatty(1); // decided at startup: after a hangup the terminal is gone
  process.on('SIGHUP', () => {
    if (fromTerminal) shutdown();
    else attempt('snapshot', flushSnapshot);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
