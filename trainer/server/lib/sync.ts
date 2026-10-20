// Two-machine sync through git: commit the data folders (cfg.sync.data_paths) → pull --rebase → push.
// Git never gets a chance to prompt: no terminal prompt, no askpass program, no GCM dialog, no controlling tty,
// and every step is killed after a timeout. Failures come back as Vietnamese hints instead of raw git errors.
// Also here: the quiet auto sync (config sync.auto: idle — after a submitted test, at startup, a push at shutdown) and
// the detection of app code received from the other machine (SyncRunResult.codeFiles → SSE `update`, see version.ts).
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { COACH_DIR, DATA_DIR, REPO_DIR, loadConfig } from '../config.ts';
import { fmtLocal } from './time.ts';
import { migrateResults } from './migrations.ts';
import { isCodePath } from './version.ts';
import type { SyncResult, SyncStep } from '../../shared/types.ts';

export const SYNC_STEP_TIMEOUT_MS = 60_000;
const FETCH_TIMEOUT_MS = 20_000;
const FETCH_MAX_AGE_MS = 60_000;
const MAX_OUTPUT = 4000;
/** SyncButton turns into a warning when data waits this long without being pushed. */
export const STALE_UNPUSHED_MS = 24 * 3600_000;

/** Who started a sync (SSE `sync`, the auto-sync status, the server log). */
export type SyncSource = 'manual' | 'auto' | 'startup' | 'shutdown' | 'ai';

export interface SyncOptions {
  repoDir?: string; // default REPO_DIR (explicit = caller knows it is safe, e.g. tests on a temp clone)
  dataPaths?: string[]; // relative to repoDir; default cfg.sync.data_paths
  dataDir?: string; // app data root (results/, bank/migrations/) — migrated after a pull only when inside repoDir; default DATA_DIR
  host?: string; // default os.hostname()
  dryRun?: boolean; // report what would happen; never commits/pulls/pushes (fetch only)
  force?: boolean; // ignore a running AI coach
  timeoutMs?: number; // per git step
  now?: Date;
  /** Commit + push only, never pull (shutdown: a rebase cut short by the exit would leave the repo half-rebased). */
  pushOnly?: boolean;
  source?: SyncSource; // default 'manual'
}

/** SyncResult (shared contract) + optional details. On failure `message` says what failed, `hint` what to do. */
export interface SyncRunResult extends SyncResult {
  dryRun?: boolean;
  branch?: string;
  committed?: number; // files in the sync commit (0 = nothing to commit)
  received?: number; // commits pulled from the other machine
  pushed?: number; // commits pushed
  migrated?: number; // result files remapped to the current answer layout after the pull (migrateResults)
  conflicts?: string[];
  hint?: string;
  /** App code files (server/, shared/, web/, package files…) changed by the received commits — restart / reload needed. */
  codeFiles?: string[];
  source?: SyncSource;
}

/** One finished sync of this process (any source). */
export interface SyncRecord {
  at: string; // ISO
  ok: boolean;
  message: string;
  hint?: string;
  source: SyncSource;
  committed?: number;
  received?: number;
  pushed?: number;
}

export interface AutoSyncStatus {
  mode: 'idle' | 'off'; // config sync.auto
  delayMinutes: number; // config sync.auto_delay_minutes
  disabled?: string; // sync impossible here (TRAINER_HOME sandbox…) — auto sync never runs
  dueAt?: string; // next quiet sync (ISO)
  reason?: 'submit' | 'retry' | 'startup';
  running?: boolean;
  failures: number; // consecutive failed auto syncs (exponential backoff)
  last?: SyncRecord; // last auto / startup / shutdown sync
}

export interface SyncStatus {
  host: string;
  branch: string;
  remote: string; // upstream, e.g. "origin/main"
  ahead: number; // local commits not on the remote yet
  behind: number; // remote commits not pulled yet (as of the last fetch)
  dirtyData: number; // changed / new files under the data paths (not committed yet)
  error?: string;
  // optional extras
  remoteUrl?: string; // without credentials
  dirtyFiles?: string[]; // first 50
  fetchedAt?: string; // last successful fetch (ISO)
  lastSync?: { at: string; subject: string }; // newest "trainer: sync" commit on this branch
  syncing?: boolean;
  disabled?: boolean; // sync not possible here (test sandbox, not a git repo, …)
  lastRun?: SyncRecord; // last sync run by this server process (any source)
  lastOkAt?: string; // last successful sync of this server process (ISO)
  unpushedSince?: string; // oldest data change not on the remote yet: uncommitted data file (mtime) or local commit (ISO)
  stale?: boolean; // unpushedSince is older than 24 h → the other machine misses these results
  auto?: AutoSyncStatus;
}

// ── running git ─────────────────────────────────────────────────────────────

interface GitRun {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: string; // spawn failure (git not installed, cwd missing)
}

/** Environment that makes every credential / editor prompt fail fast instead of waiting for input. */
export function gitEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...base,
    GIT_TERMINAL_PROMPT: '0', // no username/password prompt on the terminal
    GIT_ASKPASS: '', // empty = also ignore core.askPass / SSH_ASKPASS (e.g. VS Code's askpass helper)
    SSH_ASKPASS_REQUIRE: 'never',
    GCM_INTERACTIVE: 'never', // Git Credential Manager: no dialogs
    GIT_EDITOR: ':', // never open an editor (merge/rebase messages)
    GIT_SEQUENCE_EDITOR: ':',
    GIT_MERGE_AUTOEDIT: 'no',
    GIT_OPTIONAL_LOCKS: '0', // `git status` must not fight a running pull over index.lock
    LC_ALL: 'C', // untranslated messages → reliable error matching
  };
}

function killTree(child: ChildProcess) {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else process.kill(-child.pid, 'SIGKILL'); // whole process group: git + git-remote-https + credential helpers
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      // already gone
    }
  }
}

export function runGit(args: string[], cwd: string, timeoutMs = SYNC_STEP_TIMEOUT_MS): Promise<GitRun> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const finish = (r: Omit<GitRun, 'stdout' | 'stderr' | 'timedOut'>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...r, stdout, stderr, timedOut });
    };
    let child: ChildProcess;
    try {
      child = spawn('git', ['-c', 'core.quotepath=off', ...args], {
        cwd,
        env: gitEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
        // Own session without a controlling terminal: ssh / gpg cannot open /dev/tty to ask for a passphrase.
        detached: process.platform !== 'win32',
        windowsHide: true,
      });
    } catch (e) {
      resolve({ code: null, stdout, stderr, timedOut, error: (e as Error).message });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    child.stdout?.on('data', (b: Buffer) => (stdout = (stdout + b.toString('utf8')).slice(-200_000)));
    child.stderr?.on('data', (b: Buffer) => (stderr = (stderr + b.toString('utf8')).slice(-200_000)));
    child.on('error', (e) => finish({ code: null, error: e.message }));
    child.on('close', (code) => finish({ code }));
  });
}

/** Hide credentials embedded in URLs (https://user:token@host). */
export function redact(text: string): string {
  return text.replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@'"]+@/gi, '$1***@');
}

function clip(text: string): string {
  const t = redact(text.trim());
  return t.length > MAX_OUTPUT ? '…' + t.slice(-MAX_OUTPUT) : t;
}

// ── error hints ─────────────────────────────────────────────────────────────

/** Vietnamese explanation for a failed git command (undefined = no specific advice). */
export function explainGitError(output: string, opts: { timedOut?: boolean; repoDir?: string } = {}): string | undefined {
  const o = output;
  const repo = opts.repoDir ?? REPO_DIR;
  if (opts.timedOut) {
    return 'Lệnh git chạy quá lâu nên đã bị dừng — mạng chậm, hoặc git/Keychain đang chờ xác nhận. Thử lại; nếu vẫn treo, chạy `git pull` trong Terminal để xem git đang hỏi gì.';
  }
  if (/ENOENT|spawn git/i.test(o)) return 'Không tìm thấy lệnh git. Cài Git (macOS: `xcode-select --install`, Windows: https://git-scm.com) rồi mở lại app.';
  if (/not a git repository/i.test(o)) return `Thư mục ${repo} không phải repo git (có thể bạn tải bản .zip). Hãy \`git clone\` repo từ GitHub để đồng bộ được.`;
  if (/dubious ownership/i.test(o)) return `Git từ chối repo vì thư mục thuộc người dùng khác. Chạy: git config --global --add safe.directory "${repo}"`;
  if (/index\.lock|Unable to create '.*\.lock'/i.test(o)) {
    return 'Một lệnh git khác đang chạy (hoặc vừa bị dừng giữa chừng). Đợi vài giây rồi thử lại; nếu vẫn lỗi và chắc chắn không còn git nào chạy, xoá file .git/index.lock.';
  }
  const denied = o.match(/Permission to \S+ denied to ([^\s.]+)/i);
  if (denied || /returned error: 403|\b403 Forbidden|HTTP 403/i.test(o)) {
    return (
      `GitHub từ chối quyền ghi (403)${denied ? ` cho tài khoản ${denied[1]}` : ''}. Hoặc tài khoản này chưa là collaborator của repo ` +
      '(chủ repo: Settings → Collaborators → mời, rồi chấp nhận lời mời), hoặc token thiếu quyền ghi: tạo Personal Access Token mới với quyền ' +
      '“Contents: Read and write” (fine-grained, chọn đúng repo) hoặc scope `repo` (classic). Sau đó chạy `git push` một lần trong Terminal và dán token ' +
      'khi được hỏi mật khẩu để Keychain lưu lại.'
    );
  }
  if (
    /could not read (Username|Password)|terminal prompts disabled|Authentication failed|Invalid username or (password|token)|returned error: 401|Password authentication is not supported|Missing or invalid credentials/i.test(
      o,
    )
  ) {
    return (
      'Git cần đăng nhập GitHub nhưng không lấy được thông tin từ Keychain (app không bao giờ hỏi mật khẩu để khỏi bị treo). ' +
      `Mở Terminal, chạy \`git -C "${repo}" pull\` một lần, nhập username GitHub và dán Personal Access Token làm mật khẩu — ` +
      'macOS Keychain sẽ lưu lại. Token hết hạn hoặc bị thu hồi cũng gây lỗi này: tạo token mới rồi làm lại bước trên.'
    );
  }
  if (/Repository not found/i.test(o)) return 'GitHub báo không tìm thấy repo — sai URL remote, hoặc token/tài khoản trên máy này không có quyền truy cập repo private này.';
  if (/Permission denied \(publickey\)|Host key verification failed/i.test(o)) return 'SSH bị từ chối — kiểm tra SSH key đã thêm vào GitHub (`ssh -T git@github.com`), hoặc đổi remote sang HTTPS.';
  if (/Could not resolve host|Failed to connect|Couldn't connect|Connection refused|Connection timed out|Network is unreachable|Operation timed out|Could not read from remote|unable to access/i.test(o)) {
    return 'Không kết nối được tới GitHub — kiểm tra mạng (proxy/VPN) rồi thử lại.';
  }
  if (/Please tell me who you are|Author identity unknown|unable to auto-detect email/i.test(o)) {
    return 'Git chưa biết tên/email của bạn trên máy này. Chạy: git config --global user.name "Tên bạn" và git config --global user.email "email@example.com", rồi đồng bộ lại.';
  }
  if (/GH006|protected branch/i.test(o)) return 'Nhánh này được bảo vệ trên GitHub nên không push thẳng được — tắt bảo vệ nhánh hoặc dùng nhánh khác.';
  if (/\[rejected\]|non-fast-forward|fetch first|failed to push some refs/i.test(o)) return 'Máy kia vừa đẩy dữ liệu mới trong lúc đồng bộ — bấm Đồng bộ lại.';
  if (/untracked working tree files would be overwritten|would be overwritten by (merge|checkout)/i.test(o)) {
    return 'Có file chưa commit trùng tên với file máy kia gửi về (xem danh sách bên dưới) — đổi tên hoặc chuyển chúng đi chỗ khác rồi đồng bộ lại.';
  }
  if (/no upstream|no tracking information|does not point to a branch|unknown revision or path|no such branch|couldn't find remote ref/i.test(o)) {
    return 'Nhánh hiện tại chưa gắn với nhánh trên GitHub. Chạy một lần trong Terminal: git push -u origin <tên-nhánh>.';
  }
  return undefined;
}

// ── guards & helpers ────────────────────────────────────────────────────────

let running: Promise<SyncRunResult> | undefined;
export function isSyncing(): boolean {
  return !!running;
}

/** Sync only makes sense when the app's data lives inside the git work tree (not in a TRAINER_HOME test sandbox). */
export function syncDisabledReason(repoDir = REPO_DIR, dataDir = DATA_DIR): string | undefined {
  const r = path.relative(path.resolve(repoDir), path.resolve(dataDir));
  if (r.startsWith('..') || path.isAbsolute(r)) {
    return `Đồng bộ đang tắt: thư mục dữ liệu (${dataDir}) nằm ngoài repo git (${repoDir}) — chế độ thử nghiệm TRAINER_HOME.`;
  }
  return undefined;
}

function coachRunning(): string | undefined {
  try {
    const l = JSON.parse(fs.readFileSync(path.join(COACH_DIR, '.lock'), 'utf8')) as { pid?: number; runId?: string };
    if (!l.pid) return undefined;
    process.kill(l.pid, 0);
    return l.runId ?? `pid ${l.pid}`;
  } catch {
    return undefined;
  }
}

/** Data paths that are safe (inside the repo, not ignored) and exist on disk or in the index (deletions must be committed too). */
async function usablePaths(repoDir: string, paths: string[], timeoutMs: number): Promise<string[]> {
  const root = path.resolve(repoDir);
  const out: string[] = [];
  for (const raw of paths) {
    const p = raw.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    if (!p) continue;
    const abs = path.resolve(root, p);
    const r = path.relative(root, abs);
    if (!r || r.startsWith('..') || path.isAbsolute(r)) continue; // never the whole repo, never outside it
    if ((await runGit(['check-ignore', '-q', '--', p], repoDir, timeoutMs)).code === 0) continue; // `git add <ignored>` would fail
    if (fs.existsSync(abs)) out.push(p);
    else if ((await runGit(['ls-files', '--', p], repoDir, timeoutMs)).stdout.trim()) out.push(p);
  }
  return out;
}

async function gitPath(repoDir: string, name: string): Promise<string | undefined> {
  const r = await runGit(['rev-parse', '--git-path', name], repoDir, 10_000);
  return r.code === 0 ? path.resolve(repoDir, r.stdout.trim()) : undefined;
}

async function operationInProgress(repoDir: string): Promise<string | undefined> {
  for (const [name, label] of [
    ['rebase-merge', 'rebase'],
    ['rebase-apply', 'rebase'],
    ['MERGE_HEAD', 'merge'],
    ['CHERRY_PICK_HEAD', 'cherry-pick'],
  ]) {
    const p = await gitPath(repoDir, name);
    if (p && fs.existsSync(p)) return label;
  }
  return undefined;
}

interface Upstream {
  remote: string; // "origin"
  branch: string; // "main" (branch name on the remote)
  ref: string; // "origin/main"
}

async function upstreamOf(repoDir: string, branch: string): Promise<Upstream | undefined> {
  const [remote, merge, ref] = await Promise.all([
    runGit(['config', '--get', `branch.${branch}.remote`], repoDir, 10_000),
    runGit(['config', '--get', `branch.${branch}.merge`], repoDir, 10_000),
    runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], repoDir, 10_000),
  ]);
  const r = remote.stdout.trim();
  const m = merge.stdout.trim().replace(/^refs\/heads\//, '');
  if (!r || !m || r === '.') return undefined; // "." = tracks a local branch
  return { remote: r, branch: m, ref: ref.code === 0 ? ref.stdout.trim() : `${r}/${m}` };
}

/** Parse `git status --porcelain=v1 -z` into paths (renames → new path). */
function parsePorcelain(z: string): string[] {
  const parts = z.split('\0');
  const files: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (e.length < 4) continue;
    files.push(e.slice(3));
    if (e[0] === 'R' || e[0] === 'C') i++; // next token = original path
  }
  return files;
}

async function countRange(repoDir: string, range: string, timeoutMs: number): Promise<number> {
  const r = await runGit(['rev-list', '--count', range], repoDir, timeoutMs);
  return r.code === 0 ? Number(r.stdout.trim()) || 0 : 0;
}

/** App folder inside the repo ("trainer"): the common parent of the data paths, which live next to the app code. */
export function appDirOf(dataPaths: string[]): string {
  const parents = new Set(
    dataPaths
      .map((p) => p.trim().replace(/\\/g, '/').replace(/\/+$/, ''))
      .filter(Boolean)
      .map((p) => path.posix.dirname(p)),
  );
  const [only] = parents;
  return parents.size === 1 && only !== '.' ? only : '';
}

/** Repo-relative files that changed between two commits and belong to the app code (server/, shared/, web/, …). */
export async function changedCodeFiles(repoDir: string, from: string, to: string, appDir: string, timeoutMs = 20_000): Promise<string[]> {
  const r = await runGit(['diff', '--name-only', '-z', from, to, '--'], repoDir, timeoutMs);
  if (r.code !== 0) return [];
  return r.stdout
    .split('\0')
    .filter(Boolean)
    .filter((f) => {
      const inApp = !appDir ? f : f.startsWith(appDir + '/') ? f.slice(appDir.length + 1) : '';
      return !!inApp && isCodePath(inApp);
    });
}

const fetchState = new Map<string, { at: number; ok: boolean; error?: string; okAt?: number }>();

async function fetchRemote(repoDir: string, remote: string, timeoutMs: number): Promise<{ ok: boolean; error?: string; output: string; timedOut: boolean }> {
  const r = await runGit(['fetch', '--quiet', '--no-tags', '--no-recurse-submodules', remote], repoDir, timeoutMs);
  const output = r.error ?? r.stderr + r.stdout;
  const ok = r.code === 0;
  const prev = fetchState.get(repoDir);
  fetchState.set(repoDir, {
    at: Date.now(),
    ok,
    okAt: ok ? Date.now() : prev?.okAt,
    error: ok ? undefined : (explainGitError(output, { timedOut: r.timedOut, repoDir }) ?? clip(output)),
  });
  return { ok, error: fetchState.get(repoDir)?.error, output, timedOut: r.timedOut };
}

// ── status ──────────────────────────────────────────────────────────────────

export async function syncStatus(opts: { repoDir?: string; dataPaths?: string[]; host?: string; fetch?: boolean; maxAgeMs?: number; now?: number } = {}): Promise<SyncStatus> {
  const repoDir = opts.repoDir ?? REPO_DIR;
  const host = opts.host ?? os.hostname();
  const base: SyncStatus = { host, branch: '', remote: '', ahead: 0, behind: 0, dirtyData: 0, syncing: isSyncing(), ...processRecords() };
  if (!opts.repoDir) base.auto = autoSync.status();
  const disabled = opts.repoDir ? undefined : syncDisabledReason(repoDir);
  if (disabled) return { ...base, error: disabled, disabled: true };
  if (!fs.existsSync(repoDir)) return { ...base, error: `Không tìm thấy thư mục repo ${repoDir}.`, disabled: true };

  const top = await runGit(['rev-parse', '--show-toplevel'], repoDir, 10_000);
  if (top.code !== 0) {
    const out = top.error ?? top.stderr;
    return { ...base, error: explainGitError(out, { repoDir }) ?? clip(out), disabled: true };
  }
  const head = await runGit(['symbolic-ref', '--short', '-q', 'HEAD'], repoDir, 10_000);
  const branch = head.stdout.trim();
  if (!branch) return { ...base, branch: 'HEAD', error: 'Repo đang ở trạng thái “detached HEAD” — chuyển về nhánh chính (git switch main) rồi đồng bộ.' };
  const dataPaths = await usablePaths(repoDir, opts.dataPaths ?? loadConfig().sync.data_paths, 10_000);

  const status: SyncStatus = { ...base, branch };
  let oldest = Infinity; // oldest change that is not on the remote yet (epoch ms)
  if (dataPaths.length) {
    const st = await runGit(['status', '--porcelain=v1', '-z', '-uall', '--', ...dataPaths], repoDir, 20_000);
    const files = parsePorcelain(st.stdout);
    status.dirtyData = files.length;
    status.dirtyFiles = files.slice(0, 50);
    for (const f of files) {
      try {
        oldest = Math.min(oldest, fs.statSync(path.join(repoDir, f)).mtimeMs);
      } catch {
        // deleted file: its deletion is the change, its age is unknown
      }
    }
  }
  const last = await runGit(['log', '-1', '--format=%cI%x1f%s', '--grep=^trainer: sync', 'HEAD'], repoDir, 10_000);
  const [at, subject] = last.stdout.trim().split('\x1f');
  if (at && subject) status.lastSync = { at, subject };

  const up = await upstreamOf(repoDir, branch);
  if (!up) return { ...withAge(status, oldest, opts.now), error: explainGitError('no upstream', { repoDir }) };
  status.remote = up.ref;
  const url = await runGit(['remote', 'get-url', up.remote], repoDir, 10_000);
  if (url.code === 0) status.remoteUrl = redact(url.stdout.trim()).replace('***@', '');

  const prev = fetchState.get(repoDir);
  const stale = !prev || Date.now() - prev.at > (opts.maxAgeMs ?? FETCH_MAX_AGE_MS);
  if (opts.fetch !== false && stale && !isSyncing()) await fetchRemote(repoDir, up.remote, FETCH_TIMEOUT_MS);
  const f = fetchState.get(repoDir);
  if (f?.okAt) status.fetchedAt = new Date(f.okAt).toISOString();
  if (f && !f.ok) status.error = f.error;

  const lr = await runGit(['rev-list', '--left-right', '--count', `HEAD...${up.ref}`], repoDir, 10_000);
  if (lr.code === 0) {
    const [a, b] = lr.stdout.trim().split(/\s+/).map(Number);
    status.ahead = a || 0;
    status.behind = b || 0;
  }
  if (status.ahead > 0) {
    // committed locally (e.g. a sync whose push failed) but not pushed: the oldest such commit
    const firstLocal = await runGit(['log', '--reverse', '--format=%cI', `${up.ref}..HEAD`], repoDir, 10_000);
    const t = Date.parse(firstLocal.stdout.split('\n')[0] ?? '');
    if (Number.isFinite(t)) oldest = Math.min(oldest, t);
  }
  return withAge(status, oldest, opts.now);
}

function withAge(status: SyncStatus, oldest: number, now = Date.now()): SyncStatus {
  if (!Number.isFinite(oldest)) return status;
  return { ...status, unpushedSince: new Date(oldest).toISOString(), stale: now - oldest > STALE_UNPUSHED_MS };
}

// ── sync ────────────────────────────────────────────────────────────────────

// ── what this process synced (status, SSE `sync`, update detection) ─────────

let lastRun: SyncRecord | undefined;
let lastOkAt: string | undefined;
type SyncListener = (r: SyncRunResult) => void;
const listeners = new Set<SyncListener>();

/** Called after every real (not dry-run) sync of this process, whatever started it. Returns an unsubscribe function. */
export function onSyncDone(fn: SyncListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function processRecords(): Pick<SyncStatus, 'lastRun' | 'lastOkAt'> {
  return { ...(lastRun ? { lastRun } : {}), ...(lastOkAt ? { lastOkAt } : {}) };
}

function recordRun(r: SyncRunResult, source: SyncSource): SyncRecord {
  const rec: SyncRecord = { at: new Date().toISOString(), ok: r.ok, message: r.message, source };
  if (r.hint) rec.hint = r.hint;
  for (const k of ['committed', 'received', 'pushed'] as const) if (r[k] !== undefined) rec[k] = r[k];
  lastRun = rec;
  if (r.ok) lastOkAt = rec.at;
  for (const fn of listeners) {
    try {
      fn(r);
    } catch (e) {
      console.error('sync listener failed', e);
    }
  }
  return rec;
}

/** add → commit → pull --rebase --autostash → push. One sync at a time per process. */
export function runSync(opts: SyncOptions = {}): Promise<SyncRunResult> {
  if (running) return running;
  const source = opts.source ?? 'manual';
  running = doSync(opts)
    .then((r) => {
      const out: SyncRunResult = { ...r, source };
      if (!opts.dryRun) recordRun(out, source);
      return out;
    })
    .finally(() => {
      running = undefined;
    });
  return running;
}

async function doSync(opts: SyncOptions): Promise<SyncRunResult> {
  const repoDir = opts.repoDir ?? REPO_DIR;
  const host = opts.host ?? os.hostname();
  const timeoutMs = opts.timeoutMs ?? SYNC_STEP_TIMEOUT_MS;
  const steps: SyncStep[] = [];
  const codeFiles = new Set<string>(); // app code received from the other machine
  // `message` = one-line outcome; the advice for failures goes to `hint` (the UI shows it as its own 💡 line)
  const result = (ok: boolean, message: string, extra: Partial<SyncRunResult> = {}): SyncRunResult => ({
    ok,
    message,
    steps,
    host,
    ...(opts.dryRun ? { dryRun: true } : {}),
    ...(codeFiles.size ? { codeFiles: [...codeFiles] } : {}),
    ...extra,
  });

  /** Runs one git step and records it (display command without the internal -c flags). */
  const step = async (args: string[], record = true) => {
    const r = await runGit(args, repoDir, timeoutMs);
    const output = r.error ?? [r.stdout, r.stderr].filter((s) => s.trim()).join('\n');
    if (record) {
      steps.push({ cmd: `git ${args.map((a) => (/[\s"]/.test(a) ? JSON.stringify(a) : a)).join(' ')}`, ok: r.code === 0 && !r.timedOut, output: clip(output) + (r.timedOut ? `\n(quá ${Math.round(timeoutMs / 1000)} s — đã dừng)` : '') });
    }
    return { ...r, ok: r.code === 0 && !r.timedOut, output };
  };
  const fail = (what: string, r: { output: string; timedOut: boolean }, extra: Partial<SyncRunResult> = {}) =>
    result(false, `Đồng bộ thất bại ở bước ${what}.`, { hint: explainGitError(r.output, { timedOut: r.timedOut, repoDir }) ?? 'Xem chi tiết lệnh git bên dưới.', ...extra });

  // 1. preconditions
  const disabled = opts.repoDir ? undefined : syncDisabledReason(repoDir);
  if (disabled) return result(false, disabled);
  if (!fs.existsSync(repoDir)) return result(false, `Không tìm thấy thư mục repo ${repoDir}.`);
  const top = await step(['rev-parse', '--show-toplevel'], false);
  if (!top.ok) return result(false, 'Không đồng bộ được.', { hint: explainGitError(top.output, { repoDir, timedOut: top.timedOut }) ?? clip(top.output) });
  const busy = !opts.force && coachRunning();
  if (busy) return result(false, `AI Coach đang chạy (${busy}) — đợi lượt chạy xong rồi đồng bộ, để không commit file đang ghi dở.`);
  const op = await operationInProgress(repoDir);
  if (op) {
    return result(false, `Repo đang có một ${op} dở dang.`, {
      hint: `Mở Terminal tại ${repoDir}: hoàn tất (git ${op} --continue) hoặc huỷ (git ${op} --abort), rồi đồng bộ lại.`,
    });
  }
  const branch = (await step(['symbolic-ref', '--short', '-q', 'HEAD'], false)).stdout.trim();
  if (!branch) return result(false, 'Repo đang ở trạng thái “detached HEAD”.', { hint: 'Chuyển về nhánh chính (git switch main) rồi đồng bộ lại.' });
  const up = await upstreamOf(repoDir, branch);
  if (!up) return result(false, `Nhánh ${branch} chưa có upstream.`, { branch, hint: explainGitError('no upstream', { repoDir }) });
  const configuredPaths = opts.dataPaths ?? loadConfig().sync.data_paths;
  const dataPaths = await usablePaths(repoDir, configuredPaths, timeoutMs);
  const appDir = appDirOf(configuredPaths);

  // 2. dry run: what would be committed / exchanged (fetch only)
  if (opts.dryRun) {
    const st = dataPaths.length ? await step(['status', '--porcelain=v1', '-uall', '--', ...dataPaths]) : undefined;
    const files = st ? st.stdout.split('\n').filter((l) => l.trim()).length : 0;
    const fetch = await step(['fetch', '--no-tags', up.remote]);
    const ahead = await countRange(repoDir, `${up.ref}..HEAD`, timeoutMs);
    const behind = await countRange(repoDir, `HEAD..${up.ref}`, timeoutMs);
    const parts = [
      files ? `sẽ commit ${files} file dữ liệu` : 'không có file dữ liệu mới',
      fetch.ok ? `nhận ${behind} commit` : 'không kiểm tra được GitHub',
      `đẩy ${ahead + (files ? 1 : 0)} commit`,
    ];
    return result(fetch.ok, `Chạy thử (chưa thay đổi gì): ${parts.join(', ')}.`, {
      branch,
      committed: 0,
      received: 0,
      pushed: 0,
      ...(fetch.ok ? {} : { hint: explainGitError(fetch.output, { timedOut: fetch.timedOut, repoDir }) }),
    });
  }

  // 3. commit the data folders only (other staged/unstaged work is left alone)
  const stamp = fmtLocal((opts.now ?? new Date()).toISOString());
  const commitData = async (suffix = ''): Promise<number | SyncRunResult> => {
    if (!dataPaths.length) return 0;
    const add = await step(['add', '-A', '--', ...dataPaths]);
    if (!add.ok) return fail('git add', add, { branch });
    const staged = (await step(['diff', '--cached', '--name-only', '-z', '--', ...dataPaths], false)).stdout.split('\0').filter(Boolean);
    if (!staged.length) return 0;
    const touched = dataPaths.filter((p) => staged.some((f) => f === p || f.startsWith(p + '/')));
    const commit = await step(['commit', '--no-verify', '-q', '-m', `trainer: sync từ ${host} ${stamp}${suffix}`, '--', ...touched]);
    if (!commit.ok) return fail('git commit', commit, { branch });
    steps[steps.length - 1].output ||= `${staged.length} file: ${staged.slice(0, 8).join(', ')}${staged.length > 8 ? ', …' : ''}`;
    return staged.length;
  };
  const first = await commitData();
  if (typeof first !== 'number') return first;
  let committed = first;

  // 4. pull --rebase (autostash keeps unrelated local edits); on conflict abort and keep the local commit
  let received = 0;
  let migrated = 0;
  let autostashNote = '';
  const dataDir = opts.dataDir ?? DATA_DIR;
  const ownData = !syncDisabledReason(repoDir, dataDir); // never migrate files outside the work tree being synced
  /** Result files pulled from the other machine may predate a layout migration → remap now and commit them too. */
  const afterPull = async (): Promise<SyncRunResult | undefined> => {
    if (!ownData) return undefined;
    let n = 0;
    try {
      n = migrateResults({ resultsDir: path.join(dataDir, 'results'), migrationsDir: path.join(dataDir, 'bank', 'migrations') }).migrated;
    } catch (e) {
      steps.push({ cmd: 'migrateResults', ok: false, output: `${(e as Error).message} — sẽ thử lại khi khởi động lại app` });
      return undefined;
    }
    if (!n) return undefined;
    migrated += n;
    steps.push({ cmd: 'migrateResults', ok: true, output: `${n} file kết quả đổi ký tự đáp án theo bố cục mới` });
    const c = await commitData(' (chuyển ký tự đáp án)');
    if (typeof c !== 'number') return { ...c, committed, received, migrated };
    committed += c;
    return undefined;
  };
  const pull = async (): Promise<SyncRunResult | undefined> => {
    const before = await step(['rev-parse', '-q', '--verify', 'HEAD^{commit}'], false); // local tip before the pull
    const r = await step(['pull', '--rebase', '--autostash', up.remote, up.branch]);
    if (/autostash resulted in conflicts|changes are safe in the stash/i.test(r.output)) {
      autostashNote = ' Lưu ý: thay đổi chưa commit ngoài thư mục dữ liệu không áp lại được (xung đột) — vẫn còn trong `git stash list`, chạy `git stash pop` để lấy lại.';
    }
    if (!r.ok) {
      const rebasing = (await operationInProgress(repoDir)) === 'rebase';
      if (rebasing) {
        const unmerged = await step(['diff', '--name-only', '--diff-filter=U'], false);
        const conflicts = unmerged.stdout.split('\n').filter(Boolean);
        const abort = await step(['rebase', '--abort']);
        return result(false, `Xung đột khi gộp dữ liệu hai máy${conflicts.length ? `: ${conflicts.join(', ')}` : ''}.`, {
          branch,
          conflicts,
          committed,
          hint:
            (abort.ok ? 'Đã huỷ rebase — dữ liệu máy này vẫn an toàn trong commit cục bộ (chưa đẩy lên GitHub). ' : 'Không huỷ được rebase — chạy `git rebase --abort` trong Terminal. ') +
            `Cách xử lý: mở Terminal tại ${repoDir}, chạy \`git pull --rebase\`, sửa các file xung đột, \`git add <file>\` rồi \`git rebase --continue\`, sau đó bấm Đồng bộ lại.`,
        });
      }
      return fail('git pull', r, { branch, committed });
    }
    // commits from the other machine = upstream commits the local tip did not have (independent of earlier fetches)
    const got = before.ok ? await countRange(repoDir, `${before.stdout.trim()}..${up.ref}`, timeoutMs) : 0;
    received += got;
    // app code among them (the local commits were in `before` already, so the diff is what arrived)
    if (got > 0) for (const f of await changedCodeFiles(repoDir, before.stdout.trim(), 'HEAD', appDir, timeoutMs)) codeFiles.add(f);
    return afterPull();
  };
  if (!opts.pushOnly) {
    const pulled = await pull();
    if (pulled) return pulled;
  }

  // 5. push (retry once when the other machine pushed in between — except push-only: data stays committed locally)
  let pushed = await countRange(repoDir, `${up.ref}..HEAD`, timeoutMs);
  if (pushed > 0) {
    let push = await step(['push', '--no-verify', up.remote, `HEAD:refs/heads/${up.branch}`]);
    const rejected = !push.ok && /\[rejected\]|non-fast-forward|fetch first/i.test(push.output);
    if (rejected && opts.pushOnly) {
      return result(false, 'Máy kia vừa đẩy dữ liệu mới nên chưa đẩy được — dữ liệu máy này đã nằm trong commit cục bộ.', {
        branch,
        committed,
        pushed: 0,
        hint: 'Lần mở app sau (hoặc khi bấm ⇅ Đồng bộ) app sẽ kéo dữ liệu máy kia về rồi đẩy lên.',
      });
    }
    if (rejected) {
      const again = await pull();
      if (again) return again;
      pushed = await countRange(repoDir, `${up.ref}..HEAD`, timeoutMs);
      push = await step(['push', '--no-verify', up.remote, `HEAD:refs/heads/${up.branch}`]);
    }
    if (!push.ok) return fail('git push', push, { branch, committed, received, migrated, pushed: 0 });
  }

  if (!opts.pushOnly) fetchState.set(repoDir, { at: Date.now(), ok: true, okAt: Date.now() }); // pull just fetched
  const parts: string[] = [];
  if (committed) parts.push(`commit ${committed} file dữ liệu`);
  if (pushed) parts.push(`đẩy ${pushed} commit lên GitHub`);
  if (received) parts.push(`nhận ${received} commit từ máy khác`);
  if (migrated) parts.push(`chuyển ${migrated} file kết quả theo bố cục đáp án mới`);
  const message = (parts.length ? `Đã đồng bộ: ${parts.join(', ')}.` : 'Đã đồng bộ — không có gì mới.') + autostashNote;
  return result(true, message, { branch, committed, received, pushed, migrated });
}

// ── auto-sync around AI coach runs (config sync.before_ai / sync.after_ai) ──

export interface AiSyncNote {
  phase: 'before' | 'after';
  ok: boolean;
  message: string;
  hint?: string;
  skipped?: boolean; // sync impossible here by design (TRAINER_HOME sandbox) — not a failure
  committed?: number;
  received?: number;
  pushed?: number;
  migrated?: number;
  conflicts?: string[];
}

/**
 * Sync right before an AI coach run (the AI then sees the other machine's results and bank changes) or right after a
 * successful one (its plans / packs / patches reach the other machine before that one runs AI). Never throws: a failed
 * sync comes back as ok:false with the hint, the caller logs it and carries on with this machine's data.
 * `force` = the caller holds the coach lock itself (the runner), so "AI Coach đang chạy" must not refuse the sync.
 */
export async function syncForAi(phase: 'before' | 'after', opts: { force?: boolean } = {}): Promise<AiSyncNote> {
  const disabled = syncDisabledReason();
  if (disabled) return { phase, ok: true, skipped: true, message: disabled };
  try {
    // a sync started from the UI may be in flight (possibly a dry run) — wait for it, then run a real one
    while (running) await running.catch(() => undefined);
    const r = await runSync({ force: opts.force, source: 'ai' });
    return { phase, ok: r.ok, message: r.message, hint: r.hint, committed: r.committed, received: r.received, pushed: r.pushed, migrated: r.migrated, conflicts: r.conflicts };
  } catch (e) {
    return { phase, ok: false, message: (e as Error).message };
  }
}

/** One line for the coach console / CLI log. */
export function aiSyncLine(n: AiSyncNote): string {
  const when = n.phase === 'before' ? 'trước khi chạy AI' : 'sau khi chạy AI';
  if (n.skipped) return `⇅ Bỏ qua đồng bộ ${when}: ${n.message}`;
  if (n.ok) return `⇅ Đồng bộ ${when}: ${n.message}`;
  const after = n.phase === 'before' ? 'AI vẫn chạy với dữ liệu trên máy này.' : 'Kết quả AI vẫn nằm trên máy này — bấm ⇅ Đồng bộ sau.';
  return `⚠️ Không đồng bộ được ${when}: ${n.message}${n.hint ? ` ${n.hint}` : ''} ${after}`;
}

// ── auto sync when idle (config sync.auto: idle) ────────────────────────────
// After a submitted test the server waits `auto_delay_minutes`; when no new test was built meanwhile (the learner is not
// in the middle of one) it runs a quiet sync — never while the AI coach or another sync runs (tried again a minute
// later). Failures back off exponentially (up to an hour) and stop after a few tries until the next submit. index.ts adds
// a pull at startup and a bounded push at shutdown. Results are committed locally even offline (a restore point each).

export interface AutoSyncDeps {
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(timer: unknown): void;
  run(source: SyncSource): Promise<SyncRunResult>;
  settings(): { mode: 'idle' | 'off'; delayMs: number };
  /** Why a sync cannot start right now (coach / another sync running) → tried again AUTO_SYNC_BUSY_RETRY_MS later. */
  busy(): string | undefined;
  /** Why syncing is impossible here (TRAINER_HOME sandbox outside the repo…) → never scheduled. */
  disabled(): string | undefined;
  log?(line: string): void;
}

export const AUTO_SYNC_BUSY_RETRY_MS = 60_000;
export const AUTO_SYNC_MAX_BACKOFF_MS = 60 * 60_000;
export const AUTO_SYNC_MAX_FAILURES = 6;

export class AutoSync {
  private readonly deps: AutoSyncDeps;
  private timer: unknown = undefined;
  private dueAt: number | undefined;
  private reason: AutoSyncStatus['reason'];
  private failures = 0;
  private current: Promise<void> | undefined;
  private last: SyncRecord | undefined;

  constructor(deps: AutoSyncDeps) {
    this.deps = deps;
  }

  /** On, and possible here. */
  active(): boolean {
    return this.deps.settings().mode === 'idle' && !this.deps.disabled();
  }

  /** A test was submitted: quiet sync after `auto_delay_minutes` (or the current backoff after failures). */
  noteSubmit(): void {
    if (this.active()) this.schedule(this.backoffMs(), 'submit');
  }

  /**
   * A test was built — the learner is busy: no quiet sync mid-test; the next submit schedules again. The startup pull
   * stays (it brings the other machine's results, which the first test of the day should already see).
   */
  noteTestBuilt(): void {
    if (this.reason !== 'startup') this.cancel();
  }

  /**
   * Server start, right away: pull what the other machine pushed meanwhile (and push what is still here). Resolves with
   * the result — undefined when auto sync is off or impossible here, or a sync / the coach is busy (retried later).
   */
  startup(): Promise<SyncRunResult | undefined> {
    if (!this.active()) return Promise.resolve(undefined);
    this.cancel();
    return this.run('startup');
  }

  /** A sync started elsewhere (⇅ button, AI coach) succeeded: the backoff and a pending retry are over. */
  noteExternal(r: Pick<SyncRunResult, 'ok'>): void {
    if (!r.ok) return;
    this.failures = 0;
    if (this.reason === 'retry') this.cancel();
  }

  cancel(): void {
    if (this.timer !== undefined) this.deps.clearTimer(this.timer);
    this.timer = undefined;
    this.dueAt = undefined;
    this.reason = undefined;
  }

  /** Resolves when the auto sync in flight (if any) has finished. */
  idle(): Promise<void> {
    return this.current ?? Promise.resolve();
  }

  status(): AutoSyncStatus {
    const s = this.deps.settings();
    const disabled = this.deps.disabled();
    return {
      mode: s.mode,
      delayMinutes: Math.round(s.delayMs / 6000) / 10,
      ...(disabled ? { disabled } : {}),
      ...(this.dueAt !== undefined ? { dueAt: new Date(this.dueAt).toISOString(), reason: this.reason } : {}),
      ...(this.current ? { running: true } : {}),
      failures: this.failures,
      ...(this.last ? { last: this.last } : {}),
    };
  }

  private backoffMs(): number {
    const base = this.deps.settings().delayMs;
    if (!this.failures) return base;
    return Math.min(Math.max(base, 60_000) * 2 ** this.failures, AUTO_SYNC_MAX_BACKOFF_MS);
  }

  private schedule(ms: number, reason: NonNullable<AutoSyncStatus['reason']>): void {
    this.cancel();
    this.reason = reason;
    this.dueAt = this.deps.now() + ms;
    this.timer = this.deps.setTimer(() => void this.fire(), ms);
  }

  private fire(): void {
    const reason = this.reason ?? 'submit';
    this.timer = undefined;
    this.dueAt = undefined;
    this.reason = undefined;
    if (this.active()) void this.run(reason);
  }

  private run(reason: NonNullable<AutoSyncStatus['reason']>): Promise<SyncRunResult | undefined> {
    if (this.current || this.deps.busy()) {
      this.schedule(AUTO_SYNC_BUSY_RETRY_MS, reason);
      return Promise.resolve(undefined);
    }
    const source: SyncSource = reason === 'startup' ? 'startup' : 'auto';
    const run = this.deps
      .run(source)
      .catch((e: Error): SyncRunResult => ({ ok: false, message: e.message, steps: [], host: '' }))
      .then((r) => {
        this.last = { at: new Date(this.deps.now()).toISOString(), ok: r.ok, message: r.message, source };
        if (r.hint) this.last.hint = r.hint;
        for (const k of ['committed', 'received', 'pushed'] as const) if (r[k] !== undefined) this.last[k] = r[k];
        const label = source === 'startup' ? 'Đồng bộ khi mở app' : 'Tự đồng bộ';
        if (r.ok) {
          this.failures = 0;
          this.deps.log?.(`⇅ ${label}: ${r.message}`);
          return r;
        }
        this.failures++;
        if (this.failures >= AUTO_SYNC_MAX_FAILURES) {
          this.deps.log?.(`⚠️ ${label} lỗi ${this.failures} lần liền — tạm dừng tới lần nộp bài sau: ${r.message}`);
          return r;
        }
        const wait = this.backoffMs();
        this.deps.log?.(`⚠️ ${label} lỗi: ${r.message} — thử lại sau ${Math.round(wait / 60_000)} phút`);
        if (this.timer === undefined) this.schedule(wait, 'retry'); // a submit meanwhile already scheduled one
        return r;
      })
      .finally(() => {
        this.current = undefined;
      });
    this.current = run.then(() => undefined);
    return run;
  }
}

function autoSettings(): { mode: 'idle' | 'off'; delayMs: number } {
  const c = loadConfig().sync;
  const minutes = Number(c.auto_delay_minutes);
  const on = (c.auto as unknown) === 'idle' || (c.auto as unknown) === true;
  return { mode: on ? 'idle' : 'off', delayMs: (Number.isFinite(minutes) && minutes >= 0 ? minutes : 4) * 60_000 };
}

/** The server's scheduler (timers are unref'd: importing this module never keeps a script alive). */
export const autoSync = new AutoSync({
  now: () => Date.now(),
  setTimer: (fn, ms) => {
    const t = setTimeout(fn, ms);
    t.unref();
    return t;
  },
  clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
  run: (source) => runSync({ source }),
  settings: autoSettings,
  busy: () => (isSyncing() ? 'Đang có một lượt đồng bộ khác.' : coachRunning() ? 'AI Coach đang chạy.' : undefined),
  disabled: () => syncDisabledReason(),
  log: (line) => console.log(`  ${line}`),
});
onSyncDone((r) => {
  if (r.source === 'manual' || r.source === 'ai') autoSync.noteExternal(r);
});

/** Something to push: data files not committed yet, or local commits the upstream lacks (local git only, no network). */
export async function hasUnpushed(opts: { repoDir?: string; dataPaths?: string[] } = {}): Promise<boolean> {
  const repoDir = opts.repoDir ?? REPO_DIR;
  const dataPaths = await usablePaths(repoDir, opts.dataPaths ?? loadConfig().sync.data_paths, 10_000);
  if (dataPaths.length) {
    const st = await runGit(['status', '--porcelain=v1', '-z', '-uall', '--', ...dataPaths], repoDir, 10_000);
    if (st.code === 0 && parsePorcelain(st.stdout).length) return true;
  }
  const ahead = await runGit(['rev-list', '--count', '@{u}..HEAD'], repoDir, 10_000);
  return ahead.code === 0 && Number(ahead.stdout.trim()) > 0;
}

/**
 * Shutdown with sync.auto: idle — commit + push what is still only here, within `maxMs` (never a pull: a rebase cut short
 * by the exit would leave the repo half-rebased). Skipped when nothing is pending, while a sync or the coach runs, or when
 * syncing is impossible here. Resolves undefined when skipped or out of time (a push still running finishes on its own).
 */
export async function shutdownPush(maxMs = 15_000, onPush?: () => void): Promise<SyncRunResult | undefined> {
  autoSync.cancel();
  if (!autoSync.active() || isSyncing() || coachRunning()) return undefined;
  const deadline = Date.now() + maxMs;
  if (!(await hasUnpushed())) return undefined;
  const left = deadline - Date.now();
  if (left < 1000) return undefined;
  onPush?.();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const out = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), left);
  });
  try {
    return await Promise.race([runSync({ pushOnly: true, source: 'shutdown', timeoutMs: Math.min(SYNC_STEP_TIMEOUT_MS, left) }), out]);
  } finally {
    clearTimeout(timer);
  }
}
