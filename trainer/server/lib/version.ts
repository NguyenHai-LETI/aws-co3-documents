// [δ] Code version of the running server and the "a sync brought newer code" state.
// codeVersion() is frozen when the server starts (index.ts calls it first thing): a short hash of the app code the process
// runs — server/, shared/, web/, the package files, index.html, vite.config.ts — plus the git tree ids of those paths at
// HEAD. Data commits (results, coach, bank) never change it, so a restart after a data sync does not reload open pages.
// A sync that receives commits touching app code marks an update (SSE `update` → banner "🔄 Ứng dụng vừa được cập nhật");
// started by a launcher (TRAINER_LAUNCHER=1), the server restarts itself with exit code 75 and start.sh / start.bat /
// start.command run it again (npm install first when package-lock.json changed). Pages reload when codeVersion changes.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, REPO_DIR, TRAINER_DIR } from '../config.ts';

/** EX_TEMPFAIL: "run me again" for the launcher scripts. */
export const RESTART_EXIT_CODE = 75;

/** App code (paths relative to the app folder) whose change needs a server restart / page reload. */
const CODE_DIRS = ['server', 'shared', 'web'];
const CODE_FILES = ['package.json', 'package-lock.json', 'index.html', 'vite.config.ts'];

/** `rel` = path relative to the app folder (forward slashes), e.g. "server/lib/sync.ts". */
export function isCodePath(rel: string): boolean {
  const p = rel.replace(/\\/g, '/').replace(/^\.\//, '');
  return CODE_DIRS.some((d) => p.startsWith(d + '/')) || CODE_FILES.includes(p);
}

function codeFilesUnder(dir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...codeFilesUnder(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/** Tree ids of the code paths at HEAD ('' outside a git work tree, e.g. a .zip download). Read-only git call. */
function gitTrees(dir: string): string {
  const revs = [...CODE_DIRS, ...CODE_FILES].map((p) => `HEAD:./${p}`);
  try {
    const r = spawnSync('git', ['rev-parse', ...revs], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
    });
    return r.status === 0 ? r.stdout.trim().split(/\s+/).join(',') : '';
  } catch {
    return '';
  }
}

/** Fresh hash of the app code in `dir` (default: the code this server was started from). */
export function computeCodeVersion(dir: string = TRAINER_DIR): string {
  const h = crypto.createHash('sha1');
  for (const d of CODE_DIRS) {
    for (const abs of codeFilesUnder(path.join(dir, d))) {
      h.update(path.relative(dir, abs).split(path.sep).join('/'));
      h.update('\0');
      h.update(fs.readFileSync(abs));
      h.update('\0');
    }
  }
  for (const f of CODE_FILES) {
    try {
      const body = fs.readFileSync(path.join(dir, f));
      h.update(f);
      h.update('\0');
      h.update(body);
      h.update('\0');
    } catch {
      // optional file
    }
  }
  h.update(`git:${gitTrees(dir)}`);
  return h.digest('hex').slice(0, 12);
}

let frozen: string | undefined;
/** Code the server process runs — computed once, at startup (later calls return the same value). */
export function codeVersion(): string {
  frozen ??= computeCodeVersion();
  return frozen;
}

/** Started by start.sh / start.bat / start.command, which run the server again after exit code 75. */
export function launcherActive(): boolean {
  return process.env.TRAINER_LAUNCHER === '1';
}

/** `npm run dev` (node --watch…): the process restarts by itself when server/ or shared/ change. */
export function watchMode(): boolean {
  return process.execArgv.some((a) => a.startsWith('--watch'));
}

// ── update state (sticky until the process restarts) ───────────────────────

export interface UpdateInfo {
  at: string; // when a sync first brought newer app code (ISO)
  files: string[]; // app code files changed by the received commits (repo-relative, first 50)
  lockChanged: boolean; // package-lock.json changed → `npm install` before running again (the launchers do it)
}

export interface UpdateStatus {
  codeVersion: string;
  launcher: boolean; // POST /api/restart restarts the server
  watch: boolean; // restarts by itself (npm run dev)
  update?: UpdateInfo;
}

let update: UpdateInfo | undefined;
const MAX_FILES = 50;

/** A sync received commits changing `files` (repo-relative app code paths). Returns the merged update state. */
export function markUpdate(files: string[], now: Date = new Date()): UpdateInfo | undefined {
  if (!files.length) return update;
  const merged = [...new Set([...(update?.files ?? []), ...files])];
  update = {
    at: update?.at ?? now.toISOString(),
    files: merged.slice(0, MAX_FILES),
    lockChanged: !!update?.lockChanged || files.some((f) => /(^|\/)package-lock\.json$/.test(f)),
  };
  return update;
}

export function pendingUpdate(): UpdateInfo | undefined {
  return update;
}

export function updateStatus(): UpdateStatus {
  checkCodeChange();
  return { codeVersion: codeVersion(), launcher: launcherActive(), watch: watchMode(), ...(update ? { update } : {}) };
}

// ── code pulled by ANOTHER process ───────────────────────────────────────────
// A scheduled coach run (scripts/coach-run.ts → syncForAi), `npm run sync` or a `git pull` in a terminal can bring app
// code while the server runs: its own onSyncDone never sees that. So the server remembers the code paths at HEAD of the
// synced repo when it starts and compares again whenever a ref file moved (a few stats — cheap enough for every poll).

interface CodeWatch {
  repoDir: string;
  appDir: string; // app folder inside the repo ("trainer"; '' = the repo root)
  head: string; // commit the server started from
  tree: string; // `git ls-tree` of the code paths at that commit
  refs: string[]; // files that change when HEAD moves (HEAD, the branch ref, packed-refs)
  refSig: string;
}
let codeWatch: CodeWatch | undefined;

function gitOut(args: string[], cwd: string): string | undefined {
  try {
    const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], {
      cwd,
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' },
    });
    return r.status === 0 ? r.stdout : undefined;
  } catch {
    return undefined;
  }
}

const codePaths = (appDir: string) => [...CODE_DIRS, ...CODE_FILES].map((p) => (appDir ? `${appDir}/${p}` : p));
const refSig = (files: string[]) =>
  files
    .map((f) => {
      try {
        const st = fs.statSync(f);
        return `${st.mtimeMs}:${st.size}:${st.ino}`;
      } catch {
        return '-';
      }
    })
    .join('|');

/** Startup: remember the code paths at HEAD of the repo the app syncs (no-op when the data lives outside a repo). */
export function initCodeWatch(repoDir: string = REPO_DIR, dataDir: string = DATA_DIR): void {
  codeWatch = undefined;
  const rel = path.relative(path.resolve(repoDir), path.resolve(dataDir));
  if (rel.startsWith('..') || path.isAbsolute(rel)) return; // TRAINER_HOME sandbox: nothing is synced there
  const appDir = rel.split(path.sep).join('/');
  const head = gitOut(['rev-parse', '-q', '--verify', 'HEAD^{commit}'], repoDir)?.trim();
  const gitDir = gitOut(['rev-parse', '--git-dir'], repoDir)?.trim();
  if (!head || !gitDir) return;
  const abs = path.resolve(repoDir, gitDir);
  const branchRef = gitOut(['symbolic-ref', '-q', 'HEAD'], repoDir)?.trim(); // refs/heads/main
  const refs = [path.join(abs, 'HEAD'), path.join(abs, 'packed-refs'), ...(branchRef ? [path.join(abs, ...branchRef.split('/'))] : [])];
  codeWatch = { repoDir, appDir, head, tree: gitOut(['ls-tree', head, '--', ...codePaths(appDir)], repoDir) ?? '', refs, refSig: refSig(refs) };
}

/**
 * The code at HEAD differs from what the server started with → marks the update. Never while files with conflict
 * markers are left (restarting into them would fail — the sync reported the conflict instead). True = new files marked.
 */
export function checkCodeChange(): boolean {
  const w = codeWatch;
  if (!w || watchMode()) return false;
  const sig = refSig(w.refs);
  if (sig === w.refSig) return false;
  const tree = gitOut(['ls-tree', 'HEAD', '--', ...codePaths(w.appDir)], w.repoDir);
  if (tree === undefined) return false; // git busy / unreadable right now: look again next time
  if (tree === w.tree) {
    w.refSig = sig; // only data moved
    return false;
  }
  const unmerged = (gitOut(['diff', '--name-only', '--diff-filter=U'], w.repoDir) ?? '').trim();
  if (unmerged) return false; // not settled: refSig kept, checked again later
  w.refSig = sig;
  const files = (gitOut(['diff', '--name-only', w.head, 'HEAD', '--', ...codePaths(w.appDir)], w.repoDir) ?? '').split('\n').filter(Boolean);
  if (!files.length) return false;
  const known = new Set(update?.files ?? []);
  markUpdate(files);
  return files.some((f) => !known.has(f));
}

// ── restart (exit 75 → the launcher runs the server again) ────────────────

let restartHandler: (() => void) | undefined;

/** index.ts: how to shut down with RESTART_EXIT_CODE (snapshot flush, shutdown push, LAN stop…). */
export function onRestartRequest(fn: () => void): void {
  restartHandler = fn;
}

/** POST /api/restart: answers first, then restarts (false = no handler, e.g. not the server process). */
export function requestRestart(delayMs = 250): boolean {
  if (!restartHandler) return false;
  const fn = restartHandler;
  setTimeout(fn, delayMs);
  return true;
}

// LAN access switched on from 🧰 Công cụ lasts "until the app restarts" — a restart for an update must not cut the phone
// off, so the state is handed to the next process through a short-lived marker file (git-ignored .cache/).
const RESTART_MARKER = path.join(DATA_DIR, '.cache', 'restart.json');
const MARKER_MAX_AGE_MS = 5 * 60_000;

export interface RestartState {
  lan?: boolean;
  lanAdmin?: boolean; // [v5] π: the 🧰 Công cụ "admin from the phone" toggle (only when set on that page)
}

export function writeRestartMarker(state: RestartState): void {
  try {
    fs.mkdirSync(path.dirname(RESTART_MARKER), { recursive: true });
    fs.writeFileSync(RESTART_MARKER, JSON.stringify({ ...state, at: Date.now() }));
  } catch {
    // best effort
  }
}

/** The previous process's state when it restarted less than 5 minutes ago (the marker is removed either way). */
export function takeRestartMarker(): RestartState | undefined {
  try {
    const raw = JSON.parse(fs.readFileSync(RESTART_MARKER, 'utf8')) as RestartState & { at?: number };
    fs.rmSync(RESTART_MARKER, { force: true });
    return typeof raw.at === 'number' && Date.now() - raw.at < MARKER_MAX_AGE_MS ? { lan: raw.lan === true, ...(typeof raw.lanAdmin === 'boolean' ? { lanAdmin: raw.lanAdmin } : {}) } : undefined;
  } catch {
    return undefined;
  }
}
