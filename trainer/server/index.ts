// Local-only HTTP server: JSON API + Vite (React UI) in middleware mode, bound to 127.0.0.1.
// API routes live in server/routes/* and register themselves on import.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { HOST, PORT, TRAINER_DIR, PACKS_DIR, RESULTS_DIR, PLANS_DIR, RUNS_DIR, INBOX_DIR, PATCHES_DIR, ENRICH_DIR, QA_DIR, loadConfig } from './config.ts';
import { HttpError, broadcast, json, routes, sseClients } from './http.ts';
import { loadBank } from './lib/bank.ts';
import { attemptsVersion, loadAttempts } from './lib/results.ts';
import { plansVersion } from './lib/plans.ts';
import { ensureIssuesFile } from './lib/issues.ts';
import { writeSnapshot } from './lib/snapshot.ts';
import { coachRunner, findClaude } from './lib/coach-runner.ts';
import { migrateResults } from './lib/migrations.ts';
import './routes/core.ts';
import './routes/learning.ts';
import './routes/quality.ts';
import './routes/ai.ts';
import './routes/ops.ts';

function versions() {
  return { bank: loadBank().version, results: attemptsVersion(), plans: plansVersion() };
}

// ── Server-Sent Events (coach progress + "data changed" notifications) ─────
coachRunner.on('event', (ev) => broadcast('coach', ev));
coachRunner.on('done', (info) => {
  broadcast('coach-done', info);
  try {
    writeSnapshot(loadBank(), loadConfig());
  } catch (e) {
    console.error('snapshot failed', e);
  }
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

const allowedHosts = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  // Defence against DNS rebinding / cross-site requests: the coach endpoint can launch an agent.
  if (!allowedHosts.has(req.headers.host ?? '')) return json(res, 403, { error: 'Forbidden host' });
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
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({
    root: TRAINER_DIR,
    configFile: path.join(TRAINER_DIR, 'vite.config.ts'),
    appType: 'spa',
    server: {
      middlewareMode: true,
      hmr: { server },
      watch: { ignored: ['**/bank/**', '**/results/**', '**/coach/**', '**/inbox/**', '**/node_modules/**'] },
    },
    logLevel: 'warn',
  });
  server.on('request', (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      handleApi(req, res, url).catch((e) => {
        console.error(e);
        if (!res.headersSent) json(res, 500, { error: String(e) });
      });
      return;
    }
    vite.middlewares(req, res);
  });
  server.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n  ✗ Cổng ${PORT} đang được dùng — app có thể đã chạy sẵn: mở http://localhost:${PORT}\n    (dừng tiến trình cũ: lsof -ti tcp:${PORT} | xargs kill — hoặc đổi cổng: PORT=4000 npm start)\n`);
      process.exit(1);
    }
    throw e;
  });
  server.listen(PORT, HOST, () => {
    const bank = loadBank();
    const errors = bank.problems.filter((p) => p.level === 'error').length;
    const url = `http://localhost:${PORT}`;
    console.log(`\n  🎓 AWS SAA-C03 Trainer → ${url}`);
    console.log(`     Bank: ${bank.questions.length} câu / ${bank.packs.length} pack${errors ? ` · ⚠️ ${errors} lỗi (npm run validate)` : ''} · Kết quả: ${loadAttempts().length} bài`);
    const c = findClaude();
    console.log(`     AI Coach: ${c.available ? `Claude Code ${c.version} (${c.source})` : 'chưa tìm thấy Claude Code CLI — xem README'}\n`);
    if (process.env.OPEN === '1' || process.argv.includes('--open')) openBrowser(url);
  });
  const shutdown = () => {
    coachRunner.cancel();
    server.close();
    vite.close().finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
