// Two-machine sync through git: commit the data folders (cfg.sync.data_paths) → pull --rebase → push.
// Git never gets a chance to prompt: no terminal prompt, no askpass program, no GCM dialog, no controlling tty,
// and every step is killed after a timeout. Failures come back as Vietnamese hints instead of raw git errors.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { COACH_DIR, DATA_DIR, REPO_DIR, loadConfig } from '../config.ts';
import { fmtLocal } from './time.ts';
import { migrateResults } from './migrations.ts';
import type { SyncResult, SyncStep } from '../../shared/types.ts';

export const SYNC_STEP_TIMEOUT_MS = 60_000;
const FETCH_TIMEOUT_MS = 20_000;
const FETCH_MAX_AGE_MS = 60_000;
const MAX_OUTPUT = 4000;

export interface SyncOptions {
  repoDir?: string; // default REPO_DIR (explicit = caller knows it is safe, e.g. tests on a temp clone)
  dataPaths?: string[]; // relative to repoDir; default cfg.sync.data_paths
  dataDir?: string; // app data root (results/, bank/migrations/) — migrated after a pull only when inside repoDir; default DATA_DIR
  host?: string; // default os.hostname()
  dryRun?: boolean; // report what would happen; never commits/pulls/pushes (fetch only)
  force?: boolean; // ignore a running AI coach
  timeoutMs?: number; // per git step
  now?: Date;
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

export async function syncStatus(opts: { repoDir?: string; dataPaths?: string[]; host?: string; fetch?: boolean; maxAgeMs?: number } = {}): Promise<SyncStatus> {
  const repoDir = opts.repoDir ?? REPO_DIR;
  const host = opts.host ?? os.hostname();
  const base: SyncStatus = { host, branch: '', remote: '', ahead: 0, behind: 0, dirtyData: 0, syncing: isSyncing() };
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
  if (dataPaths.length) {
    const st = await runGit(['status', '--porcelain=v1', '-z', '-uall', '--', ...dataPaths], repoDir, 20_000);
    const files = parsePorcelain(st.stdout);
    status.dirtyData = files.length;
    status.dirtyFiles = files.slice(0, 50);
  }
  const last = await runGit(['log', '-1', '--format=%cI%x1f%s', '--grep=^trainer: sync', 'HEAD'], repoDir, 10_000);
  const [at, subject] = last.stdout.trim().split('\x1f');
  if (at && subject) status.lastSync = { at, subject };

  const up = await upstreamOf(repoDir, branch);
  if (!up) return { ...status, error: explainGitError('no upstream', { repoDir }) };
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
  return status;
}

// ── sync ────────────────────────────────────────────────────────────────────

/** add → commit → pull --rebase --autostash → push. One sync at a time per process. */
export function runSync(opts: SyncOptions = {}): Promise<SyncRunResult> {
  if (running) return running;
  running = doSync(opts).finally(() => {
    running = undefined;
  });
  return running;
}

async function doSync(opts: SyncOptions): Promise<SyncRunResult> {
  const repoDir = opts.repoDir ?? REPO_DIR;
  const host = opts.host ?? os.hostname();
  const timeoutMs = opts.timeoutMs ?? SYNC_STEP_TIMEOUT_MS;
  const steps: SyncStep[] = [];
  // `message` = one-line outcome; the advice for failures goes to `hint` (the UI shows it as its own 💡 line)
  const result = (ok: boolean, message: string, extra: Partial<SyncRunResult> = {}): SyncRunResult => ({
    ok,
    message,
    steps,
    host,
    ...(opts.dryRun ? { dryRun: true } : {}),
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
  const dataPaths = await usablePaths(repoDir, opts.dataPaths ?? loadConfig().sync.data_paths, timeoutMs);

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
    received += before.ok ? await countRange(repoDir, `${before.stdout.trim()}..${up.ref}`, timeoutMs) : 0;
    return afterPull();
  };
  const pulled = await pull();
  if (pulled) return pulled;

  // 5. push (retry once when the other machine pushed in between)
  let pushed = await countRange(repoDir, `${up.ref}..HEAD`, timeoutMs);
  if (pushed > 0) {
    let push = await step(['push', '--no-verify', up.remote, `HEAD:refs/heads/${up.branch}`]);
    if (!push.ok && /\[rejected\]|non-fast-forward|fetch first/i.test(push.output)) {
      const again = await pull();
      if (again) return again;
      pushed = await countRange(repoDir, `${up.ref}..HEAD`, timeoutMs);
      push = await step(['push', '--no-verify', up.remote, `HEAD:refs/heads/${up.branch}`]);
    }
    if (!push.ok) return fail('git push', push, { branch, committed, received, migrated, pushed: 0 });
  }

  fetchState.set(repoDir, { at: Date.now(), ok: true, okAt: Date.now() }); // pull just fetched
  const parts: string[] = [];
  if (committed) parts.push(`commit ${committed} file dữ liệu`);
  if (pushed) parts.push(`đẩy ${pushed} commit lên GitHub`);
  if (received) parts.push(`nhận ${received} commit từ máy khác`);
  if (migrated) parts.push(`chuyển ${migrated} file kết quả theo bố cục đáp án mới`);
  const message = (parts.length ? `Đã đồng bộ: ${parts.join(', ')}.` : 'Đã đồng bộ — không có gì mới.') + autostashNote;
  return result(true, message, { branch, committed, received, pushed, migrated });
}
