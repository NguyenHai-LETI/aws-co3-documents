// Production build of the web UI. A phone on Wi-Fi loads it ~4.5× faster than the Vite dev server (measured on a
// throttled phone profile: first load 2.7 s / 66 requests / 6.8 MB → 0.6 s / 10 requests / 0.9 MB), and since v5 [π]
// `npm start` serves it to this machine too (production React, lazy pages, manifest + service worker); `npm run dev`
// (or --dev / TRAINER_UI=dev) keeps the Vite dev server with HMR for this machine — LAN devices get the build either way
// and never reach the dev server (no build yet / build failed / LAN_UI=dev → 503 for them).
// Built by `vite build` in a child process (~0.3–1 s) into <data>/.cache/lan-ui (git-ignored) and served from memory
// (gzip). The source stamp is a hash of path + mtime + size of every build input (index.html, vite.config.ts,
// package*.json, web/, shared/): any change — an edit, a `git pull`, a restore with an older mtime — rebuilds on the next
// page request. A code update received by sync while the app runs (version.ts pendingUpdate) freezes the build until the
// restart, so pages keep matching the server code; the restarted process finds the stale stamp and rebuilds.
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import type http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import zlib from 'node:zlib';
import { DATA_DIR, TRAINER_DIR } from '../config.ts';
import { acceptsGzip } from '../http.ts';

const STAMP_FILE = '.source-stamp';
export const UI_SOURCES = ['index.html', 'vite.config.ts', 'package.json', 'package-lock.json', 'web', 'shared'];
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

interface UiFile {
  type: string;
  body: Buffer;
  gz?: Buffer;
}

/** Hash of path + mtime + size of every build input under `root` (dot-files and node_modules skipped). */
export function sourceStampOf(root: string, sources: string[] = UI_SOURCES): string {
  const h = crypto.createHash('sha1');
  let count = 0;
  const visit = (abs: string, rel: string) => {
    let st: fs.Stats;
    try {
      st = fs.statSync(abs);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(abs).sort()) if (!name.startsWith('.') && name !== 'node_modules') visit(path.join(abs, name), `${rel}/${name}`);
      return;
    }
    count++;
    h.update(`${rel}\0${Math.round(st.mtimeMs)}\0${st.size}\n`);
  };
  for (const s of sources) visit(path.join(root, s), s);
  return `${count}:${h.digest('hex').slice(0, 16)}`;
}

function readTree(dir: string): Map<string, UiFile> {
  const files = new Map<string, UiFile>();
  const walk = (d: string) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, ent.name);
      if (ent.isDirectory()) walk(abs);
      else if (!ent.name.startsWith('.')) {
        const body = fs.readFileSync(abs);
        const type = TYPES[path.extname(ent.name)] ?? 'application/octet-stream';
        const gz = /^(text|application\/(json|manifest)|image\/svg)/.test(type) && body.length > 1024 ? zlib.gzipSync(body, { level: 9 }) : undefined;
        files.set('/' + path.relative(dir, abs).split(path.sep).join('/'), { type, body, gz });
      }
    }
  };
  walk(dir);
  return files;
}

function viteBin(root: string): string {
  try {
    return path.join(path.dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin', 'vite.js');
  } catch {
    return path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  }
}

const CARRIED_FILE = '.carried';

/**
 * A page loaded before a rebuild still asks for its old lazy chunks (/assets/Pair-<old hash>.js): the previous build's
 * hashed assets move into the new build for one generation (listed in .carried, never carried twice), so open pages —
 * also across a restart — keep working until they reload.
 */
export function carryAssets(prevDir: string, nextDir: string): void {
  const from = path.join(prevDir, 'assets');
  const to = path.join(nextDir, 'assets');
  let carried: Set<string>;
  try {
    carried = new Set(fs.readFileSync(path.join(prevDir, CARRIED_FILE), 'utf8').split('\n').filter(Boolean));
  } catch {
    carried = new Set();
  }
  let names: string[];
  try {
    names = fs.readdirSync(from);
  } catch {
    return;
  }
  const moved: string[] = [];
  fs.mkdirSync(to, { recursive: true });
  for (const name of names) {
    if (carried.has(name) || fs.existsSync(path.join(to, name))) continue;
    try {
      fs.copyFileSync(path.join(from, name), path.join(to, name));
      moved.push(name);
    } catch {
      // best effort
    }
  }
  if (moved.length) fs.writeFileSync(path.join(nextDir, CARRIED_FILE), moved.join('\n') + '\n');
}

export interface UiBuildOptions {
  root: string; // the app folder (vite root)
  outDir: string; // where the build lives between runs
  /** Builds into `outDir` → undefined, or an error message. Default: `vite build` in a child process. */
  build?: (outDir: string) => Promise<string | undefined>;
  /** True = keep serving the build already loaded even if the sources changed (code update waiting for a restart). */
  frozen?: () => boolean;
  /** Re-read the sources at most this often (ms). */
  stampTtlMs?: number;
}

export interface UiBuild {
  ensure(): Promise<boolean>;
  serve(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean>;
  /** 'dev' while the build is disabled (LAN_UI=dev) or failed for the current sources (this machine falls back to Vite). */
  mode(): 'dist' | 'dev';
  stamp(): string;
  /** Stamp of the build being served (undefined: none loaded yet). */
  served(): string | undefined;
  /** Kills a running `vite build` (shutdown). */
  stop(): void;
}

export function createUiBuild(o: UiBuildOptions): UiBuild {
  const ttl = o.stampTtlMs ?? 2000;
  let ui: { stamp: string; files: Map<string, UiFile> } | undefined;
  let building: Promise<boolean> | undefined;
  let failedStamp: string | undefined;
  let stampCache: { at: number; value: string } | undefined;
  let child: ChildProcess | undefined;

  const stamp = () => {
    if (stampCache && Date.now() - stampCache.at < ttl) return stampCache.value;
    stampCache = { at: Date.now(), value: sourceStampOf(o.root) };
    return stampCache.value;
  };

  const viteBuild = (outDir: string) =>
    new Promise<string | undefined>((resolve) => {
      const env = { ...process.env, NODE_ENV: 'production' };
      const p = spawn(process.execPath, [viteBin(o.root), 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], { cwd: o.root, env, stdio: ['ignore', 'pipe', 'pipe'] });
      child = p;
      let out = '';
      p.stdout?.on('data', (b: Buffer) => (out += b.toString()));
      p.stderr?.on('data', (b: Buffer) => (out += b.toString()));
      const killer = setTimeout(() => p.kill('SIGKILL'), 120_000);
      p.on('error', (e) => {
        clearTimeout(killer);
        child = undefined;
        resolve(e.message);
      });
      p.on('exit', (code) => {
        clearTimeout(killer);
        child = undefined;
        resolve(code === 0 ? undefined : out.trim().slice(-2000) || `vite build exited with ${code}`);
      });
    });

  const build = async (s: string): Promise<boolean> => {
    const tmp = `${o.outDir}.tmp-${process.pid}`;
    fs.rmSync(tmp, { recursive: true, force: true });
    const err = await (o.build ?? viteBuild)(tmp);
    if (err || !fs.existsSync(path.join(tmp, 'index.html'))) {
      fs.rmSync(tmp, { recursive: true, force: true });
      failedStamp = s;
      console.error(`  ⚠️ Không dựng được giao diện (dùng tạm dev server): ${(err ?? 'index.html missing').split('\n')[0]}`);
      return false;
    }
    fs.writeFileSync(path.join(tmp, STAMP_FILE), s);
    carryAssets(o.outDir, tmp);
    fs.rmSync(o.outDir, { recursive: true, force: true });
    fs.renameSync(tmp, o.outDir);
    ui = { stamp: s, files: readTree(o.outDir) };
    failedStamp = undefined;
    return true;
  };

  const ensure = (): Promise<boolean> => {
    if (lanUiDisabled()) return Promise.resolve(false);
    if (building) return building;
    if (ui && o.frozen?.()) return Promise.resolve(true);
    const s = stamp();
    if (ui?.stamp === s) return Promise.resolve(true);
    if (failedStamp === s) return Promise.resolve(false);
    try {
      if (fs.readFileSync(path.join(o.outDir, STAMP_FILE), 'utf8') === s) {
        ui = { stamp: s, files: readTree(o.outDir) };
        return Promise.resolve(true);
      }
    } catch {
      // no previous build
    }
    building = build(s)
      .catch((e) => {
        failedStamp = s;
        console.error('UI build failed', e);
        return false;
      })
      .finally(() => {
        building = undefined;
      });
    return building;
  };

  /**
   * `/` → index.html (hash routing: no other page paths), built assets (hashed, cached for a year) and the files of
   * web/public (manifest, service worker, icons). Anything else is a 404: sources, node_modules and /@fs stay with the
   * dev server.
   */
  const serve = async (req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    if (!(await ensure()) || !ui) return false;
    let p = url.pathname;
    try {
      p = decodeURIComponent(p);
    } catch {
      return false;
    }
    if (p === '/') p = '/index.html';
    const file = ui.files.get(p);
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end('Not found');
      return true;
    }
    const gzip = !!file.gz && acceptsGzip(req.headers['accept-encoding']);
    const body = gzip ? file.gz! : file.body;
    res.writeHead(200, {
      'Content-Type': file.type,
      'Content-Length': body.length,
      'Cache-Control': p.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Accept-Encoding',
      ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
    });
    res.end(req.method === 'HEAD' ? undefined : body);
    return true;
  };

  return {
    ensure,
    serve,
    mode: () => (lanUiDisabled() || (failedStamp !== undefined && failedStamp === stamp()) ? 'dev' : 'dist'),
    stamp,
    served: () => ui?.stamp,
    stop: () => {
      child?.kill('SIGKILL');
      child = undefined;
    },
  };
}

export function lanUiDisabled(): boolean {
  return (process.env.LAN_UI ?? '').toLowerCase() === 'dev';
}

let frozenFn: (() => boolean) | undefined;
/** index.ts: rebuilds wait while this says so (a synced code update waiting for the restart). */
export function setUiFrozen(fn: () => boolean): void {
  frozenFn = fn;
}

/** The app's build (one per process). */
export const appUi = createUiBuild({ root: TRAINER_DIR, outDir: path.join(DATA_DIR, '.cache', 'lan-ui'), frozen: () => !!frozenFn?.() });

/** What LAN devices are served right now: the production build, or the dev server (disabled / build failed). */
export function lanUiMode(): 'dist' | 'dev' {
  return appUi.mode();
}

/** Makes sure the production build matches the sources (reuses one left by a previous run); false = use the dev server. */
export function ensureLanUi(): Promise<boolean> {
  return appUi.ensure();
}

export function serveLanUi(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean> {
  return appUi.serve(req, res, url);
}
