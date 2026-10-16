// Local-only HTTP server: JSON API + Vite (React UI) in middleware mode, bound to 127.0.0.1.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { HOST, PORT, TRAINER_DIR, REPO_DIR, PROFILE_FILE, SNAPSHOT_FILE, PACKS_DIR, RESULTS_DIR, PLANS_DIR, RUNS_DIR, INBOX_DIR, loadConfig, rel } from './config.ts';
import { loadBank } from './lib/bank.ts';
import { loadAttempts, gradeAndSave, summarize, attemptsVersion } from './lib/results.ts';
import { computeStates, computeStats } from './lib/stats.ts';
import { buildTest, modeCounts } from './lib/select.ts';
import { loadPlans, plansVersion } from './lib/plans.ts';
import { addIssue, ensureIssuesFile, loadIssues } from './lib/issues.ts';
import { newDataSince, writeSnapshot } from './lib/snapshot.ts';
import { coachRunner, findClaude, buildPrompt } from './lib/coach-runner.ts';
import { listNotes, readNote } from './lib/notes.ts';
import type { BuildTestRequest, SelectionFilters, SubmitRequest } from '../shared/types.ts';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

async function readBody<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 5_000_000) throw new HttpError(413, 'Body too large');
    chunks.push(c as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

function context() {
  const cfg = loadConfig();
  const bank = loadBank();
  const attempts = loadAttempts();
  const states = computeStates(attempts, cfg);
  const plans = loadPlans(attempts);
  return { cfg, bank, attempts, states, plans };
}

function versions() {
  return { bank: loadBank().version, results: attemptsVersion(), plans: plansVersion() };
}

// ── Server-Sent Events (coach progress + "data changed" notifications) ─────

const clients = new Set<http.ServerResponse>();
function broadcast(event: string, data: unknown) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) c.write(msg);
}
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
  if (!clients.size) return;
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
  for (const c of clients) c.write(': ping\n\n');
}, 25_000);

// ── routes ──────────────────────────────────────────────────────────────────

type Handler = (req: http.IncomingMessage, url: URL, params: string[]) => Promise<unknown> | unknown;
const routes: { method: string; re: RegExp; fn: Handler }[] = [];
const route = (method: string, pattern: string, fn: Handler) =>
  routes.push({ method, re: new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$'), fn });

route('GET', '/api/meta', () => {
  const { cfg, bank, attempts, plans } = context();
  const issues = loadIssues();
  return {
    exam: bank.taxonomy.exam,
    domains: bank.taxonomy.domains,
    topics: bank.taxonomy.topics,
    difficulties: bank.taxonomy.difficulties,
    timing: bank.taxonomy.timing,
    services: Object.entries(bank.taxonomy.services).map(([name, d]) => ({ name, topic: d.topic })),
    packs: bank.packs,
    bankVersion: bank.version,
    problems: { errors: bank.problems.filter((p) => p.level === 'error').length, warnings: bank.problems.filter((p) => p.level === 'warning').length },
    openIssues: issues.filter((i) => i.open).length,
    practice: cfg.practice,
    srs: cfg.srs,
    attempts: attempts.length,
    latestPlan: plans[0] ? { id: plans[0].id, created: plans[0].created } : null,
    claude: findClaude(cfg),
    paths: { trainer: TRAINER_DIR, repo: REPO_DIR },
  };
});

route('GET', '/api/bank', () => {
  const bank = loadBank();
  return { version: bank.version, packs: bank.packs, questions: bank.questions, problems: bank.problems };
});

route('GET', '/api/state', () => {
  const ctx = context();
  return { states: Object.fromEntries(ctx.states), counts: modeCounts(ctx) };
});

route('POST', '/api/counts', async (req) => {
  const body = await readBody<{ filters?: SelectionFilters }>(req);
  return modeCounts(context(), body.filters);
});

route('POST', '/api/tests', async (req) => {
  const body = await readBody<BuildTestRequest>(req);
  if (!body.mode) throw new HttpError(400, 'mode is required');
  const ctx = context();
  const session = buildTest(body, ctx);
  if (!session.questions.length) throw new HttpError(422, session.notes.join(' ') || 'Không có câu hỏi nào phù hợp.');
  return { session, questions: session.questions.map((r) => ctx.bank.byId.get(r.id)) };
});

route('POST', '/api/results', async (req) => {
  const body = await readBody<SubmitRequest>(req);
  if (!body.session?.questions?.length) throw new HttpError(400, 'session is required');
  const cfg = loadConfig();
  const bank = loadBank();
  const attempt = gradeAndSave(body, bank);
  try {
    writeSnapshot(bank, cfg);
  } catch (e) {
    console.error('snapshot failed', e);
  }
  return { attempt };
});

route('GET', '/api/results', () => {
  const bank = loadBank();
  return loadAttempts()
    .map((a) => summarize(a, bank))
    .reverse();
});

route('GET', '/api/results/:id', (_req, _url, [id]) => {
  const bank = loadBank();
  const attempt = loadAttempts().find((a) => a.id === decodeURIComponent(id));
  if (!attempt) throw new HttpError(404, 'Result not found');
  return { attempt, summary: summarize(attempt, bank), questions: attempt.answers.map((r) => bank.byId.get(r.q) ?? null) };
});

route('GET', '/api/stats', () => {
  const { cfg, bank, attempts, states } = context();
  return computeStats(attempts, bank, states, cfg);
});

route('GET', '/api/plans', () => {
  const { attempts, plans } = context();
  return { plans, newSince: newDataSince(plans[0], attempts) };
});

route('GET', '/api/coach', () => {
  const cfg = loadConfig();
  const { attempts, plans } = context();
  let profile = '';
  try {
    profile = fs.readFileSync(PROFILE_FILE, 'utf8');
  } catch {
    // not created yet
  }
  return {
    claude: findClaude(cfg),
    status: coachRunner.status(),
    runs: coachRunner.listRuns(),
    newSince: newDataSince(plans[0], attempts),
    profile,
    coworkPrompt: buildPrompt('analyze', 'cowork-manual', 'manual'),
    schedule: cfg.coach.schedule,
  };
});

route('POST', '/api/coach/run', async (req) => {
  const body = await readBody<{ task?: 'analyze' | 'generate'; params?: Record<string, unknown> }>(req);
  const task = body.task === 'generate' ? 'generate' : 'analyze';
  writeSnapshot(loadBank(), loadConfig());
  try {
    return { run: coachRunner.start(task, 'manual', body.params ?? {}) };
  } catch (e) {
    throw new HttpError(409, (e as Error).message);
  }
});

route('POST', '/api/coach/cancel', () => ({ cancelled: coachRunner.cancel() }));

route('GET', '/api/coach/runs/:id', (_req, _url, [id]) => ({ events: coachRunner.events(decodeURIComponent(id)) }));

route('POST', '/api/snapshot', () => writeSnapshot(loadBank(), loadConfig()));

route('GET', '/api/issues', () => loadIssues().reverse());

route('POST', '/api/issues', async (req) => {
  const body = await readBody<{ qid?: string; type?: string; note?: string }>(req);
  if (!body.qid || !loadBank().byId.has(body.qid)) throw new HttpError(400, 'Unknown question id');
  return addIssue(body.qid, body.type ?? 'other', (body.note ?? '').slice(0, 1000));
});

route('GET', '/api/notes', () => listNotes());

route('GET', '/api/note', (_req, url) => {
  const p = url.searchParams.get('path') ?? '';
  const content = readNote(p);
  if (content === undefined) throw new HttpError(404, 'Note not found');
  return { path: p, content };
});

/** Raw Markdown of any file under trainer/ (result reports, plans, snapshot, packs). */
route('GET', '/api/file', (_req, url) => {
  const p = url.searchParams.get('path') ?? '';
  const abs = path.resolve(TRAINER_DIR, p);
  if (!abs.startsWith(TRAINER_DIR + path.sep) || !abs.endsWith('.md') || abs.includes(`${path.sep}node_modules${path.sep}`) || !fs.existsSync(abs)) {
    throw new HttpError(404, 'File not found');
  }
  return { path: rel(abs), content: fs.readFileSync(abs, 'utf8') };
});

route('GET', '/api/snapshot', () => ({ content: fs.existsSync(SNAPSHOT_FILE) ? fs.readFileSync(SNAPSHOT_FILE, 'utf8') : '' }));

// ── server ──────────────────────────────────────────────────────────────────

const allowedHosts = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  // Defence against DNS rebinding / cross-site requests: the coach endpoint can launch an agent.
  if (!allowedHosts.has(req.headers.host ?? '')) return json(res, 403, { error: 'Forbidden host' });
  if (req.method !== 'GET' && req.headers['x-trainer'] !== '1') return json(res, 403, { error: 'Missing X-Trainer header' });

  if (url.pathname === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 3000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
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

async function main() {
  for (const d of [path.join(PACKS_DIR, 'ai'), path.join(PACKS_DIR, 'docs'), path.join(PACKS_DIR, 'manual'), RESULTS_DIR, PLANS_DIR, RUNS_DIR, INBOX_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
  ensureIssuesFile();
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
  server.listen(PORT, HOST, () => {
    const bank = loadBank();
    const errors = bank.problems.filter((p) => p.level === 'error').length;
    console.log(`\n  🎓 AWS SAA-C03 Trainer → http://localhost:${PORT}`);
    console.log(`     Bank: ${bank.questions.length} câu / ${bank.packs.length} pack${errors ? ` · ⚠️ ${errors} lỗi (npm run validate)` : ''} · Kết quả: ${loadAttempts().length} bài`);
    const c = findClaude();
    console.log(`     AI Coach: ${c.available ? `Claude Code ${c.version} (${c.source})` : 'chưa tìm thấy Claude Code CLI — xem README'}\n`);
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
