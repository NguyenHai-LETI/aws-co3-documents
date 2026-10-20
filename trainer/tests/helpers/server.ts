// Runs the real server against a sandbox copy of the data: temp TRAINER_HOME, free port, killed afterwards.
// Used by tests/e2e/*.test.ts and tests/ui/smoke.mjs. Never touches trainer/results or port 3003.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { TRAINER_ROOT } from './paths.ts';
import { configureRepo, git, isolateGitConfig, realGitattributes } from './git.ts';

export interface Sandbox {
  root: string; // temp dir (removed by cleanup)
  home: string; // TRAINER_HOME
  repo?: string; // TRAINER_REPO when git: true (work tree; data in repo/trainer)
  remote?: string; // bare repo standing in for GitHub
  cleanup(): void;
}

/** Top-level coach prompts only (no plans, runs, profile, Q&A): a fresh learner on the real bank. */
function copyData(dest: string, opts: { results?: boolean }) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(path.join(TRAINER_ROOT, 'bank'), path.join(dest, 'bank'), { recursive: true });
  // sandboxes never start the semantic-duplicate job (on a machine running Ollama it would embed the whole bank);
  // tests that need it set quality.embeddings themselves
  const cfgText = fs.readFileSync(path.join(TRAINER_ROOT, 'config.yaml'), 'utf8');
  // …nor hold back sealed forms or sync on their own (tests that need these set them explicitly)
  const sandboxCfg = cfgText
    .replace(/^(\s+embeddings:\s*)\w+/m, '$1off')
    .replace(/^(\s+sealed_forms:\s*)\d+/m, '$10')
    .replace(/^(\s+auto:\s*)idle\b/m, '$1off');
  fs.writeFileSync(path.join(dest, 'config.yaml'), sandboxCfg);
  const coach = path.join(TRAINER_ROOT, 'coach');
  fs.mkdirSync(path.join(dest, 'coach'), { recursive: true });
  for (const f of fs.existsSync(coach) ? fs.readdirSync(coach) : []) {
    if (f.endsWith('.md') && f !== 'snapshot.md' && f !== 'learner-profile.md') fs.copyFileSync(path.join(coach, f), path.join(dest, 'coach', f));
  }
  if (opts.results && fs.existsSync(path.join(TRAINER_ROOT, 'results'))) {
    fs.cpSync(path.join(TRAINER_ROOT, 'results'), path.join(dest, 'results'), { recursive: true });
  }
}

/**
 * Sandbox data dir. `git: true` → root/repo is a git work tree (data in root/repo/trainer) whose `origin` is the bare
 * repo root/remote.git, so POST /api/sync can run for real without going near GitHub.
 */
export function makeSandbox(opts: { git?: boolean; results?: boolean } = {}): Sandbox {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-e2e-')));
  const cleanup = () => fs.rmSync(root, { recursive: true, force: true });
  if (!opts.git) {
    const home = path.join(root, 'home');
    copyData(home, opts);
    return { root, home, cleanup };
  }
  isolateGitConfig(); // the server inherits it too: no keychain helper, no signing
  const repo = path.join(root, 'repo');
  const remote = path.join(root, 'remote.git');
  const home = path.join(repo, 'trainer');
  copyData(home, opts);
  fs.writeFileSync(path.join(repo, '.gitattributes'), realGitattributes());
  fs.copyFileSync(path.join(TRAINER_ROOT, '.gitignore'), path.join(home, '.gitignore'));
  git(root, 'init', '-q', '--bare', '-b', 'main', remote);
  git(root, 'init', '-q', '-b', 'main', repo);
  configureRepo(repo, 'e2e');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'sandbox data');
  git(repo, 'remote', 'add', 'origin', remote);
  git(repo, 'push', '-q', '-u', 'origin', 'main');
  return { root, home, repo, remote, cleanup };
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

export interface ServerHandle {
  base: string;
  port: number;
  proc: ChildProcess;
  logs(): string;
  stop(): Promise<void>;
}

/** Spawns `node server/index.ts` with TRAINER_HOME (+ TRAINER_REPO) and waits until /api/meta answers. */
export async function startServer(opts: { home: string; repo?: string; port?: number; env?: Record<string, string>; timeoutMs?: number }): Promise<ServerHandle> {
  const port = opts.port ?? (await freePort());
  if (port === 3003) throw new Error('port 3003 belongs to the real app');
  const env: NodeJS.ProcessEnv = { ...process.env, TRAINER_HOME: opts.home, PORT: String(port), ...opts.env };
  if (opts.repo) env.TRAINER_REPO = opts.repo;
  for (const k of ['OPEN', 'NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'ANTHROPIC_API_KEY']) delete env[k];
  const proc = spawn(process.execPath, ['server/index.ts'], { cwd: TRAINER_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  proc.stdout?.on('data', (b: Buffer) => (logs += b.toString()));
  proc.stderr?.on('data', (b: Buffer) => (logs += b.toString()));
  const exited = new Promise<void>((r) => proc.once('exit', () => r()));
  const base = `http://127.0.0.1:${port}`;

  const deadline = Date.now() + (opts.timeoutMs ?? 60_000);
  for (;;) {
    if (proc.exitCode !== null || proc.signalCode) throw new Error(`server exited early (${proc.exitCode ?? proc.signalCode}):\n${logs}`);
    try {
      const r = await fetch(`${base}/api/meta`, { signal: AbortSignal.timeout(5000) });
      if (r.ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      proc.kill('SIGKILL');
      throw new Error(`server did not start on ${base}:\n${logs}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  return {
    base,
    port,
    proc,
    logs: () => logs,
    async stop() {
      if (proc.exitCode !== null || proc.signalCode) return;
      proc.kill('SIGTERM');
      const killer = setTimeout(() => proc.kill('SIGKILL'), 8000);
      await exited;
      clearTimeout(killer);
    },
  };
}

// ── tiny API client ─────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  status: number;
  ok: boolean;
  body: T;
}

export function apiClient(base: string) {
  const call = async <T = any>(method: string, p: string, body?: unknown, headers: Record<string, string> = {}): Promise<ApiResponse<T>> => {
    const h: Record<string, string> = method === 'GET' ? { ...headers } : { 'Content-Type': 'application/json', 'X-Trainer': '1', ...headers };
    const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
    const text = await r.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      // non-JSON (HTML fallback for unknown routes)
    }
    return { status: r.status, ok: r.ok, body: parsed as T };
  };
  return {
    get: <T = any>(p: string, headers?: Record<string, string>) => call<T>('GET', p, undefined, headers),
    post: <T = any>(p: string, body: unknown = {}, headers?: Record<string, string>) => call<T>('POST', p, body, headers),
  };
}
export type ApiClient = ReturnType<typeof apiClient>;
