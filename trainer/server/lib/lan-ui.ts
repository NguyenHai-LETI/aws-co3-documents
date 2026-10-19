// Production build of the web UI for LAN devices. A phone on Wi-Fi loads it ~4.5× faster than the Vite dev server
// (measured on a throttled phone profile: first load 2.7 s / 66 requests / 6.8 MB → 0.6 s / 10 requests / 0.9 MB;
// page switches 0.31 s → 0.17 s with production React). Built by `vite build` in a child process into
// <data>/.cache/lan-ui (git-ignored, ~0.6 s) when LAN access is turned on and again whenever web/, shared/ or the
// build inputs change; served from memory (gzip). A LAN request waits for a running build; LAN devices see nothing of
// the dev server (sources, node_modules, /@fs) unless the build fails or LAN_UI=dev (debugging). This machine keeps the
// dev server with HMR.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import type http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import zlib from 'node:zlib';
import { DATA_DIR, TRAINER_DIR } from '../config.ts';
import { acceptsGzip } from '../http.ts';

const OUT_DIR = path.join(DATA_DIR, '.cache', 'lan-ui');
const STAMP_FILE = '.source-stamp';
const SOURCES = ['index.html', 'vite.config.ts', 'package.json', 'package-lock.json', 'web', 'shared'];
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

interface UiFile {
  type: string;
  body: Buffer;
  gz?: Buffer;
}

let ui: { stamp: string; files: Map<string, UiFile> } | undefined;
let building: Promise<boolean> | undefined;
let failedStamp: string | undefined; // sources that failed to build (retried only after they change)
let stampCache: { at: number; value: string } | undefined;

export function lanUiDisabled(): boolean {
  return (process.env.LAN_UI ?? '').toLowerCase() === 'dev';
}

/** What LAN devices are served right now: the production build, or the dev server (disabled / build failed). */
export function lanUiMode(): 'dist' | 'dev' {
  return lanUiDisabled() || (failedStamp !== undefined && failedStamp === sourceStamp()) ? 'dev' : 'dist';
}

/** Count + newest mtime + total size of the build inputs (≈ 70 files, re-read at most every 2 s). */
function sourceStamp(): string {
  if (stampCache && Date.now() - stampCache.at < 2000) return stampCache.value;
  let count = 0;
  let newest = 0;
  let size = 0;
  const visit = (p: string) => {
    let st: fs.Stats;
    try {
      st = fs.statSync(p);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(p)) if (!name.startsWith('.')) visit(path.join(p, name));
      return;
    }
    count++;
    newest = Math.max(newest, st.mtimeMs);
    size += st.size;
  };
  for (const s of SOURCES) visit(path.join(TRAINER_DIR, s));
  stampCache = { at: Date.now(), value: `${count}:${Math.round(newest)}:${size}` };
  return stampCache.value;
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
        const gz = /^(text|application\/json|image\/svg)/.test(type) && body.length > 1024 ? zlib.gzipSync(body, { level: 9 }) : undefined;
        files.set('/' + path.relative(dir, abs).split(path.sep).join('/'), { type, body, gz });
      }
    }
  };
  walk(dir);
  return files;
}

function viteBin(): string {
  try {
    return path.join(path.dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin', 'vite.js');
  } catch {
    return path.join(TRAINER_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
  }
}

function runBuild(outDir: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const env = { ...process.env, NODE_ENV: 'production' };
    const p = spawn(process.execPath, [viteBin(), 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], { cwd: TRAINER_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout?.on('data', (b: Buffer) => (out += b.toString()));
    p.stderr?.on('data', (b: Buffer) => (out += b.toString()));
    const killer = setTimeout(() => p.kill('SIGKILL'), 120_000);
    p.on('error', (e) => {
      clearTimeout(killer);
      resolve(e.message);
    });
    p.on('exit', (code) => {
      clearTimeout(killer);
      resolve(code === 0 ? undefined : out.trim().slice(-2000) || `vite build exited with ${code}`);
    });
  });
}

async function build(stamp: string): Promise<boolean> {
  const tmp = `${OUT_DIR}.tmp-${process.pid}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  const err = await runBuild(tmp);
  if (err || !fs.existsSync(path.join(tmp, 'index.html'))) {
    fs.rmSync(tmp, { recursive: true, force: true });
    failedStamp = stamp;
    console.error(`  ⚠️ Không dựng được giao diện cho thiết bị LAN (dùng tạm dev server): ${(err ?? 'index.html missing').split('\n')[0]}`);
    return false;
  }
  fs.writeFileSync(path.join(tmp, STAMP_FILE), stamp);
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.renameSync(tmp, OUT_DIR);
  ui = { stamp, files: readTree(OUT_DIR) };
  failedStamp = undefined;
  return true;
}

/** Makes sure the production build matches the sources (reuses one left by a previous run); false = use the dev server. */
export function ensureLanUi(): Promise<boolean> {
  if (lanUiDisabled()) return Promise.resolve(false);
  if (building) return building;
  const stamp = sourceStamp();
  if (ui?.stamp === stamp) return Promise.resolve(true);
  if (failedStamp === stamp) return Promise.resolve(false);
  try {
    if (fs.readFileSync(path.join(OUT_DIR, STAMP_FILE), 'utf8') === stamp) {
      ui = { stamp, files: readTree(OUT_DIR) };
      return Promise.resolve(true);
    }
  } catch {
    // no previous build
  }
  building = build(stamp)
    .catch((e) => {
      failedStamp = stamp;
      console.error('LAN UI build failed', e);
      return false;
    })
    .finally(() => {
      building = undefined;
    });
  return building;
}

/**
 * Serves the production build to a LAN device: `/` → index.html (hash routing: no other page paths), built assets
 * (hashed, cached for a year). With the build in place nothing else is served to the network (404): sources,
 * node_modules and /@fs stay with the dev server, which LAN devices only reach with LAN_UI=dev or after a failed build.
 */
export async function serveLanUi(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (!(await ensureLanUi()) || !ui) return false;
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
}
