// Runs the AI coach headlessly through the Claude Code CLI (`claude -p … --output-format stream-json`)
// and turns its event stream into short progress lines for the UI (SSE) and log files in coach/runs/.
// Tasks: analyze (COACH.md), generate (GENERATE.md), enrich + longform (ENRICH.md — the batch of questions
// is prepared here before the spawn, and the patch is re-applied/verified when the run ends).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { COACH_DIR, DATA_DIR, PACKS_DIR, REPO_DIR, RUNS_DIR, TRAINER_DIR, loadConfig, rel, type AppConfig } from '../config.ts';
import { context } from '../context.ts';
import { loadBank } from './bank.ts';
import { DAY_MS, localDateKey, localIso, stampParts } from './time.ts';
import { applyPatch } from './patch.ts';
import { MAX_BATCH, MAX_LONGFORM, learnerNotes, longformTargets, parseTasks, patchPath, readRunInfos, repoRel, selectBatch, writeBatchFile, writeLongformFile } from './enrich.ts';
import { askCostsSince } from './ask.ts';
import type { ClaudeStatus, CoachEvent, CoachRunInfo, CoachTask, CostSummary } from '../../shared/types.ts';

const LOCK_FILE = path.join(COACH_DIR, '.lock');
const RUN_TIMEOUT_MS = 40 * 60_000;
const IS_WIN = process.platform === 'win32';
export const COACH_TASKS: readonly CoachTask[] = ['analyze', 'generate', 'enrich', 'longform'];

/** Run record = shared CoachRunInfo + optional extras written by this runner (UI may show them). */
export type RunInfo = CoachRunInfo & {
  model?: string; // model reported by the CLI (system/init)
  outcome?: RunOutcome; // verified result of enrich/longform runs
};

export interface RunOutcome {
  // enrich: final apply-patch pass over coach/patches/<runId>.yaml
  patch?: string | null;
  updated?: number; // items applied now or earlier (applied + unchanged)
  skipped?: number;
  failed?: number;
  missing?: string[]; // batch questions without an item in the patch
  // longform: the new pack
  pack?: string | null;
  questions?: number;
  longForm?: number;
  errors?: number;
}

/** Nothing left to do for this task (empty ENRICH batch, no long-form target) — not an error. */
export class NothingToDoError extends Error {}

// ── locating the CLI ────────────────────────────────────────────────────────

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isExecutable(p: string): boolean {
  if (IS_WIN) return isFile(p);
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return isFile(p);
  } catch {
    return false;
  }
}

function versionKey(dir: string): number[] {
  const m = dir.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

function extensionBinaries(): string[] {
  const home = os.homedir();
  const roots = ['.vscode', '.vscode-insiders', '.cursor', '.windsurf', '.vscode-oss'].map((d) => path.join(home, d, 'extensions'));
  const found: { p: string; v: number[] }[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const d of fs.readdirSync(root)) {
      if (!d.startsWith('anthropic.claude-code-')) continue;
      const p = path.join(root, d, 'resources', 'native-binary', IS_WIN ? 'claude.exe' : 'claude');
      if (isExecutable(p)) found.push({ p, v: versionKey(d) });
    }
  }
  found.sort((a, b) => b.v[0] - a.v[0] || b.v[1] - a.v[1] || b.v[2] - a.v[2]);
  return found.map((f) => f.p);
}

/** npm's Windows shim (claude.cmd) → the file it launches, e.g. `node_modules\@anthropic-ai\claude-code\cli.js`. */
export function shimTarget(shimText: string): string | undefined {
  for (const m of shimText.matchAll(/%~?dp0%?\\([^"%\r\n]+?\.(?:c?js|mjs|exe))/gi)) {
    if (!/(^|\\)node\.exe$/i.test(m[1])) return m[1];
  }
  return undefined;
}

/** What to execute for a candidate: native binaries as-is; npm `.cmd` shims resolved to their JS entry (run with node). */
export function resolveCandidate(p: string): string | undefined {
  if (/\.(cmd|bat)$/i.test(p)) {
    if (!isFile(p)) return undefined;
    const dir = path.dirname(p);
    let target: string | undefined;
    try {
      const t = shimTarget(fs.readFileSync(p, 'utf8'));
      if (t) target = path.join(dir, ...t.split('\\'));
    } catch {
      // unreadable shim → fallback below
    }
    return [target, path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')].find((x): x is string => !!x && isFile(x));
  }
  if (/\.(c?js|mjs)$/i.test(p)) return isFile(p) ? p : undefined;
  return isExecutable(p) ? p : undefined;
}

/** How to spawn a resolved CLI path: JS entry points run through this Node binary (Windows npm installs). */
export function claudeCommand(p: string): { cmd: string; pre: string[] } {
  return /\.(c?js|mjs)$/i.test(p) ? { cmd: process.execPath, pre: [p] } : { cmd: p, pre: [] };
}

function candidates(cfg: AppConfig): { p: string; source: string }[] {
  const home = os.homedir();
  const out: { p: string; source: string }[] = [];
  if (cfg.coach.claude_bin) out.push({ p: cfg.coach.claude_bin.replace(/^~(?=$|[\\/])/, home), source: 'config.yaml coach.claude_bin' });
  if (process.env.CLAUDE_BIN) out.push({ p: process.env.CLAUDE_BIN, source: 'env CLAUDE_BIN' });
  const names = IS_WIN ? ['claude.exe', 'claude.cmd'] : ['claude'];
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) if (dir) for (const n of names) out.push({ p: path.join(dir, n), source: 'PATH' });
  const std = IS_WIN
    ? [
        path.join(home, '.local', 'bin', 'claude.exe'),
        path.join(home, '.claude', 'local', 'claude.exe'),
        ...(process.env.APPDATA ? [path.join(process.env.APPDATA, 'npm', 'claude.cmd')] : []),
      ]
    : [path.join(home, '.claude', 'local', 'claude'), path.join(home, '.local', 'bin', 'claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude'];
  for (const p of std) out.push({ p, source: 'standard location' });
  for (const p of extensionBinaries()) out.push({ p, source: 'VS Code extension (bundled CLI)' });
  return out;
}

let statusCache: { at: number; status: ClaudeStatus } | undefined;

/** `claude auth status` → whether the CLI is logged in and how (no personal details are kept). */
function authStatus(bin: string): ClaudeStatus['auth'] {
  const { cmd, pre } = claudeCommand(bin);
  const r = spawnSync(cmd, [...pre, 'auth', 'status'], { encoding: 'utf8', timeout: 15_000, windowsHide: true });
  try {
    const j = JSON.parse(r.stdout) as { loggedIn?: boolean; authMethod?: string; subscriptionType?: string };
    return { loggedIn: !!j.loggedIn, method: j.authMethod, plan: j.subscriptionType };
  } catch {
    return r.status === 0 ? { loggedIn: true } : { loggedIn: false };
  }
}

const INSTALL_HINT = IS_WIN
  ? 'Không tìm thấy Claude Code CLI. Cài bằng PowerShell `irm https://claude.ai/install.ps1 | iex` (hoặc `npm i -g @anthropic-ai/claude-code`), chạy `claude` một lần để đăng nhập, hoặc đặt đường dẫn ở trainer/config.yaml → coach.claude_bin / biến môi trường CLAUDE_BIN (claude.exe hoặc claude.cmd). Có thể dùng Claude Cowork thay thế (nút “Copy prompt”).'
  : 'Không tìm thấy Claude Code CLI. Cài bằng `npm i -g @anthropic-ai/claude-code` (rồi `claude` để đăng nhập), hoặc đặt đường dẫn ở trainer/config.yaml → coach.claude_bin / biến môi trường CLAUDE_BIN. Có thể dùng Claude Cowork thay thế (nút “Copy prompt”).';

export function findClaude(cfg: AppConfig = loadConfig(), fresh = false): ClaudeStatus {
  if (!fresh && statusCache && Date.now() - statusCache.at < 60_000) return statusCache.status;
  let status: ClaudeStatus = { available: false, hint: INSTALL_HINT };
  const tried = new Set<string>();
  for (const c of candidates(cfg)) {
    const target = resolveCandidate(c.p);
    if (!target || tried.has(target)) continue;
    tried.add(target);
    const { cmd, pre } = claudeCommand(target);
    const r = spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8', timeout: 15_000, windowsHide: true });
    if (r.status === 0) {
      const source = target === c.p ? c.source : `${c.source} (${path.basename(c.p)} → ${path.basename(target)})`;
      status = { available: true, path: target, version: r.stdout.trim().split('\n')[0], source, auth: authStatus(target) };
      break;
    }
  }
  statusCache = { at: Date.now(), status };
  return status;
}

export function versionAtLeast(version: string | undefined, min: [number, number, number]): boolean {
  const m = version?.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return false;
  const v = [Number(m[1]), Number(m[2]), Number(m[3])];
  for (let i = 0; i < 3; i++) if (v[i] !== min[i]) return v[i] > min[i];
  return true;
}

/** CLI versions that know `--permission-prompts`, `--tools`, `--no-session-persistence`. */
export const MODERN_CLI: [number, number, number] = [2, 1, 259];

// ── policy: test mode, hosts, models ────────────────────────────────────────

/**
 * Coach runs write into `trainer/` of the repo (cwd = repo root), so they are refused while the app runs
 * on a TRAINER_HOME copy (tests, sandboxes) unless TRAINER_ALLOW_COACH=1. Returns the reason or undefined.
 */
export function coachGuard(): string | undefined {
  if (path.resolve(DATA_DIR) === path.resolve(TRAINER_DIR) || process.env.TRAINER_ALLOW_COACH === '1') return undefined;
  return `App đang chạy với TRAINER_HOME=${DATA_DIR} (dữ liệu thử nghiệm) — AI Coach bị tắt để Claude không ghi vào trainer/ của repo thật. Đặt TRAINER_ALLOW_COACH=1 nếu thật sự muốn.`;
}

/** Scheduled runs only on the machines listed in coach.hosts ([] = any). Matches full or short hostname, case-insensitive. */
export function hostAllowed(cfg: AppConfig, host: string = os.hostname()): boolean {
  const list = (cfg.coach.hosts ?? []).map((h) => String(h).trim().toLowerCase()).filter(Boolean);
  if (!list.length) return true;
  const h = host.trim().toLowerCase();
  const short = h.split('.')[0];
  return list.some((x) => x === h || x === short || x.split('.')[0] === short);
}

/** Model for a task: coach.models[task] || coach.model ('' = Claude Code default). Long-form uses the enrich model. */
export function modelFor(task: CoachTask | 'ask', cfg: AppConfig): string {
  const key = task === 'longform' ? 'enrich' : task;
  return String(cfg.coach.models?.[key] || cfg.coach.model || '').trim();
}

export function resolvedModels(cfg: AppConfig): { analyze: string; generate: string; enrich: string; ask: string } {
  return { analyze: modelFor('analyze', cfg), generate: modelFor('generate', cfg), enrich: modelFor('enrich', cfg), ask: modelFor('ask', cfg) };
}

/** Scheduled runs started today (local date) — compared with coach.max_runs_per_day. */
export function scheduledRunsToday(runs: CoachRunInfo[] = readRunInfos(200), now = new Date()): number {
  const today = localDateKey(now);
  return runs.filter((r) => r.trigger === 'schedule' && r.status !== 'skipped' && localDateKey(r.startedAt) === today).length;
}

// ── prompts ─────────────────────────────────────────────────────────────────

export interface GenerateParams {
  sources?: string[];
  count?: number;
  topic?: string;
  difficulty?: string;
  focus?: string;
  slug?: string;
}

const TASK_LABEL: Record<CoachTask, string> = {
  analyze: 'Phân tích kết quả & lập kế hoạch',
  generate: 'Sinh câu hỏi',
  enrich: 'Bảo trì ngân hàng (ENRICH)',
  longform: 'Sinh câu dài chuẩn đề thi',
};

export function buildPrompt(task: CoachTask, runId: string, trigger: string, params: Record<string, unknown> = {}): string {
  const common = [
    `- run_id: ${runId}`,
    `- trigger: ${trigger}`,
    `- now: ${localIso()}`,
    `- working directory = thư mục gốc repo; mọi đường dẫn bên dưới là tương đối từ đây.`,
  ];
  if (task === 'analyze') {
    return [
      'Bạn là AI Coach của hệ thống luyện thi AWS SAA-C03 trong repo này.',
      'Đọc TOÀN BỘ file `trainer/coach/COACH.md` rồi thực hiện ĐÚNG quy trình trong đó (phân tích kết quả → cập nhật ngân hàng câu hỏi → viết kế hoạch luyện tập).',
      '',
      'Thông tin lượt chạy:',
      ...common,
      '- snapshot vừa được cập nhật: `trainer/coach/snapshot.md`',
      params.note ? `- ghi chú của người học: ${String(params.note)}` : '',
      '',
      'Kết thúc bằng 3–6 dòng tóm tắt (tiếng Việt): phát hiện chính, số câu mới, file kế hoạch đã tạo.',
    ]
      .filter((l) => l !== '')
      .join('\n');
  }
  if (task === 'enrich') {
    return [
      'Bạn là biên tập viên ngân hàng câu hỏi (ENRICH) của hệ thống luyện thi AWS SAA-C03 trong repo này.',
      'Đọc TOÀN BỘ file `trainer/coach/ENRICH.md` rồi thực hiện ĐÚNG phần **A (lô bảo trì)** cho lô câu hỏi đã được app chuẩn bị sẵn.',
      '',
      'Thông tin lượt chạy:',
      ...common,
      `- lô câu hỏi: \`${String(params.batch)}\` (${String(params.size)} câu)`,
      `- todo được yêu cầu: ${(params.tasks as string[] | undefined)?.join(', ') || 'explain, hint, classify, balance'}`,
      `- patch phải ghi: \`${String(params.patch)}\``,
      `- áp dụng: \`node trainer/scripts/apply-patch.ts ${String(params.patch)}\` (sửa item lỗi rồi chạy lại đến khi sạch)`,
      '',
      'Kết thúc bằng 2–4 dòng tóm tắt (tiếng Việt): số câu đã cải thiện theo từng loại todo, item lỗi/bỏ qua (nếu có), kết quả apply-patch cuối cùng.',
    ].join('\n');
  }
  if (task === 'longform') {
    return [
      'Bạn là AI Question Writer của hệ thống luyện thi AWS SAA-C03 trong repo này.',
      'Đọc TOÀN BỘ file `trainer/coach/ENRICH.md` rồi thực hiện ĐÚNG phần **B (câu dài chuẩn đề thi)** cho các câu gốc đã được app chọn sẵn.',
      '',
      'Thông tin lượt chạy:',
      ...common,
      `- câu gốc: \`${String(params.batch)}\``,
      `- số câu cần viết: ${String(params.count)} (mỗi câu gốc một biến thể dài, \`variant_of\` = id gốc)`,
      `- pack mới: \`${String(params.packFile)}\` (thay \`<slug>\`), pack id \`${String(params.packId)}\`, id câu \`${String(params.idPrefix)}01\`, \`${String(params.idPrefix)}02\`, …`,
      '',
      'Kết thúc bằng 2–4 dòng tóm tắt (tiếng Việt): file pack đã tạo, số câu + số từ stem trung bình, kết quả validate.',
    ].join('\n');
  }
  const p = params as GenerateParams;
  return [
    'Bạn là AI Question Writer của hệ thống luyện thi AWS SAA-C03 trong repo này.',
    'Đọc TOÀN BỘ file `trainer/coach/GENERATE.md` rồi thực hiện ĐÚNG quy trình trong đó để sinh câu hỏi mới vào ngân hàng.',
    '',
    'Thông tin lượt chạy:',
    ...common,
    `- sources: ${p.sources?.length ? p.sources.map((s) => '`' + s + '`').join(', ') : '(không chỉ định — chọn theo topic/focus)'}`,
    `- count: ${p.count ?? 15}`,
    `- topic: ${p.topic || '(tự xác định từ tài liệu)'}`,
    `- difficulty mix: ${p.difficulty || 'medium 50%, hard 35%, easy 15%'}`,
    `- focus: ${p.focus || '(không có)'}`,
    `- pack slug gợi ý: ${p.slug || '(tự đặt)'}`,
    '',
    'Kết thúc bằng 3–5 dòng tóm tắt (tiếng Việt): file pack đã tạo, số câu, kết quả validate.',
  ].join('\n');
}

/** Least-privilege tool rules per task (dontAsk mode: everything else is denied; reads inside the repo are allowed). */
export function allowedTools(task: CoachTask): string[] {
  const rw = (p: string) => [`Edit(${p})`, `Write(${p})`];
  const base = ['Glob', 'Grep', 'TodoWrite', 'Bash(node trainer/scripts/validate.ts:*)'];
  switch (task) {
    case 'enrich':
      return [...base, ...rw('trainer/coach/patches/**'), 'Bash(node trainer/scripts/apply-patch.ts:*)'];
    case 'longform':
      return [...base, ...rw('trainer/bank/packs/ai/**')];
    default:
      return [
        ...base,
        ...rw('trainer/bank/**'),
        ...rw('trainer/coach/**'),
        'Bash(node trainer/scripts/snapshot.ts:*)',
        'Bash(node trainer/scripts/apply-patch.ts:*)',
      ];
  }
}

export function cliArgs(prompt: string, cfg: AppConfig, version?: string, task: CoachTask = 'analyze'): string[] {
  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    // Non-interactive and least-privilege: anything not allowed below is denied instead of prompting.
    // Reads inside the repo (cwd) are allowed by default; reads outside it are denied.
    '--permission-mode',
    'dontAsk',
    ...(versionAtLeast(version, MODERN_CLI) ? ['--permission-prompts', 'none'] : []),
    '--allowedTools',
    ...allowedTools(task),
  ];
  const model = modelFor(task, cfg);
  if (model) args.push('--model', model);
  if (cfg.coach.effort) args.push('--effort', cfg.coach.effort);
  if (cfg.coach.max_budget_usd > 0) args.push('--max-budget-usd', String(cfg.coach.max_budget_usd));
  return args;
}

/** Environment for CLI children: the claude.ai login unless config opts into the API key. */
export function cliEnv(cfg: AppConfig): NodeJS.ProcessEnv {
  // In -p mode an ANTHROPIC_API_KEY in the environment wins over the claude.ai login, which would
  // silently bill the API account. Use the subscription login unless config says otherwise.
  const env = { ...process.env };
  if (!cfg.coach.use_api_key) delete env.ANTHROPIC_API_KEY;
  return env;
}

// ── costs ───────────────────────────────────────────────────────────────────

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Spend over the last `days` days (API-equivalent USD reported by the CLI; a claude.ai plan is not billed per run).
 * `costUsd` = coach runs + asks; `byTask` covers coach runs, `asks` the "Hỏi AI" calls.
 */
export function costSummary(days = 30, runs: CoachRunInfo[] = readRunInfos()): CostSummary {
  const since = Date.now() - days * DAY_MS;
  const inRange = runs.filter((r) => Date.parse(r.startedAt) >= since && r.status !== 'skipped');
  const byTask: CostSummary['byTask'] = {};
  let total = 0;
  for (const r of inRange) {
    const b = (byTask[r.task] ??= { runs: 0, costUsd: 0 });
    b.runs++;
    b.costUsd = round4(b.costUsd + (r.costUsd ?? 0));
    total += r.costUsd ?? 0;
  }
  const asks = askCostsSince(since);
  return { days, runs: inRange.length, costUsd: round4(total + asks.costUsd), byTask, asks };
}

// ── run management ──────────────────────────────────────────────────────────

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readLock(): { pid: number; runId: string } | undefined {
  try {
    const l = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) as { pid: number; runId: string };
    if (l.pid && pidAlive(l.pid)) return l;
  } catch {
    // no lock
  }
  return undefined;
}

function summarizeInput(name: string, input: Record<string, unknown>): string {
  const p = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '');
  const short = (s: string) => {
    const r = s.startsWith(REPO_DIR) ? path.relative(REPO_DIR, s) : s;
    return r.length > 120 ? r.slice(0, 117) + '…' : r;
  };
  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'NotebookEdit':
      return short(p('file_path'));
    case 'Glob':
      return p('pattern');
    case 'Grep':
      return `"${p('pattern')}"${p('path') ? ' in ' + short(p('path')) : ''}`;
    case 'Bash':
      return short(p('command'));
    case 'TodoWrite':
      return Array.isArray(input.todos) ? `${(input.todos as unknown[]).length} việc` : '';
    default:
      return short(JSON.stringify(input));
  }
}

const clampInt = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, n)) : dflt;
};

/** Selects the questions and writes coach/enrich/<runId>-batch.md; returns the params recorded with the run. */
function prepare(task: CoachTask, runId: string, params: Record<string, unknown>, cfg: AppConfig, s: ReturnType<typeof stampParts>): Record<string, unknown> {
  if (task !== 'enrich' && task !== 'longform') return {};
  const { bank, states, attempts } = context();
  if (task === 'enrich') {
    const { todos, examTasks } = parseTasks(params.tasks);
    const size = clampInt(params.size, 1, MAX_BATCH, clampInt(cfg.coach.enrich_batch_size, 1, MAX_BATCH, 20));
    const items = selectBatch(bank, states, { size, tasks: params.tasks });
    if (!items.length) throw new NothingToDoError(`Không còn câu nào cần ENRICH (${[...todos, ...examTasks].join(', ')}) 🎉`);
    const file = writeBatchFile(runId, items, bank, { todos, notes: learnerNotes(attempts, items.map((i) => i.q.id)) });
    return { size: items.length, tasks: [...todos, ...examTasks], batch: repoRel(file), patch: repoRel(patchPath(runId)), ids: items.map((i) => i.q.id) };
  }
  const count = clampInt(params.count, 1, MAX_LONGFORM, 5);
  const targets = longformTargets(bank, states, count);
  if (!targets.length) throw new NothingToDoError('Không còn câu ngắn nào cần biến thể dài (mọi câu đã có bản dài hoặc đủ 3 biến thể).');
  const hhmm = s.time.slice(0, 4);
  const plan = {
    count: targets.length,
    packFile: `${repoRel(path.join(PACKS_DIR, 'ai'))}/${s.date}-${hhmm}-longform-<slug>.md`,
    packId: `ai-${s.date}-${hhmm}-longform`,
    idPrefix: `ai-${s.compact}-${hhmm}-lf`,
  };
  const file = writeLongformFile(runId, targets, bank, plan);
  return { count: plan.count, batch: repoRel(file), packFile: plan.packFile, packId: plan.packId, idPrefix: plan.idPrefix, ids: targets.map((t) => t.q.id) };
}

export class CoachRunner extends EventEmitter {
  current?: { info: RunInfo; child: ChildProcess; events: CoachEvent[] };

  status() {
    return { running: this.current?.info, lockedBy: this.current ? undefined : readLock() };
  }

  listRuns(limit = 30): RunInfo[] {
    return readRunInfos(limit);
  }

  events(runId: string): CoachEvent[] {
    if (this.current?.info.id === runId) return this.current.events;
    const f = path.join(RUNS_DIR, `${runId}.events.jsonl`);
    if (!/^[\w-]+$/.test(runId) || !fs.existsSync(f)) return [];
    return fs
      .readFileSync(f, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as CoachEvent);
  }

  start(task: CoachTask, trigger: CoachRunInfo['trigger'], params: Record<string, unknown> = {}): RunInfo {
    const blocked = coachGuard();
    if (blocked) throw new Error(blocked);
    if (!COACH_TASKS.includes(task)) throw new Error(`Tác vụ không hợp lệ: ${String(task)}`);
    if (this.current) throw new Error(`Đang có lượt chạy ${this.current.info.id}`);
    const lock = readLock();
    if (lock) throw new Error(`Một tiến trình khác (pid ${lock.pid}) đang chạy coach: ${lock.runId}`);
    const cfg = loadConfig();
    const claude = findClaude(cfg, true);
    if (!claude.available || !claude.path) throw new Error(claude.hint ?? 'Claude Code CLI not found');

    fs.mkdirSync(RUNS_DIR, { recursive: true });
    const s = stampParts();
    const id = `${s.date}_${s.time}_${task}`;
    const runParams = { ...params, ...prepare(task, id, params, cfg, s) };
    const info: RunInfo = { id, task, trigger, status: 'running', startedAt: localIso(), params: runParams };
    const prompt = buildPrompt(task, id, trigger, runParams);
    const args = cliArgs(prompt, cfg, claude.version, task);
    const { cmd, pre } = claudeCommand(claude.path);
    const child = spawn(cmd, [...pre, ...args], { cwd: REPO_DIR, env: cliEnv(cfg), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, runId: id }));
    const raw = fs.createWriteStream(path.join(RUNS_DIR, `${id}.raw.jsonl`));
    const evOut = fs.createWriteStream(path.join(RUNS_DIR, `${id}.events.jsonl`));
    const events: CoachEvent[] = [];
    this.current = { info, child, events };
    const saveInfo = () => fs.writeFileSync(path.join(RUNS_DIR, `${id}.json`), JSON.stringify(info, null, 2));
    saveInfo();

    const emit = (kind: CoachEvent['kind'], text: string) => {
      const ev: CoachEvent = { runId: id, at: new Date().toISOString(), kind, text };
      events.push(ev);
      evOut.write(JSON.stringify(ev) + '\n');
      this.emit('event', ev);
    };
    const size = task === 'enrich' ? ` · ${String(runParams.size)} câu` : task === 'longform' ? ` · ${String(runParams.count)} câu` : '';
    const model = modelFor(task, cfg);
    const shownPath = claude.path.startsWith(os.homedir() + path.sep) ? `~/${rel(claude.path, os.homedir())}` : claude.path;
    emit('start', `${TASK_LABEL[task]}${size} · Claude Code ${claude.version?.split(' ')[0] ?? ''}${model ? ` · model ${model}` : ''} · ${shownPath}`);
    if (runParams.batch) emit('start', `Lô câu hỏi: ${String(runParams.batch)}`);

    let buf = '';
    let resultSeen = false;
    child.stdout!.on('data', (chunk: Buffer) => {
      raw.write(chunk);
      buf += chunk.toString('utf8');
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(line);
        } catch {
          emit('text', line.slice(0, 500));
          continue;
        }
        this.handleMessage(msg, info, emit, () => (resultSeen = true));
      }
    });
    child.stderr!.on('data', (chunk: Buffer) => {
      const t = chunk.toString('utf8').trim();
      if (t) emit('stderr', t.slice(0, 1000));
    });

    const timer = setTimeout(() => {
      emit('error', `⏱ Quá ${RUN_TIMEOUT_MS / 60000} phút — dừng lượt chạy.`);
      info.status = 'error';
      info.error = 'timeout';
      child.kill('SIGTERM');
    }, RUN_TIMEOUT_MS);

    const finish = (code: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timer);
      if (info.status === 'running') {
        if (signal) info.status = 'cancelled';
        else info.status = code === 0 && resultSeen ? 'success' : 'error';
        if (info.status === 'error' && !info.error) info.error = `CLI exited with code ${code}`;
      }
      if (info.status !== 'cancelled') {
        try {
          this.postProcess(info, emit);
        } catch (e) {
          emit('error', `Kiểm tra sau lượt chạy thất bại: ${(e as Error).message}`);
        }
      }
      info.finishedAt = localIso();
      saveInfo();
      emit('end', `Kết thúc: ${info.status}${info.costUsd ? ` · $${info.costUsd.toFixed(3)}` : ''}`);
      raw.end();
      evOut.end();
      try {
        fs.unlinkSync(LOCK_FILE);
      } catch {
        // already gone
      }
      this.current = undefined;
      this.emit('done', info);
    };
    child.on('error', (e) => {
      info.status = 'error';
      info.error = e.message;
      emit('error', e.message);
    });
    child.on('close', finish);
    return info;
  }

  /** enrich: re-apply the patch (idempotent; catches a patch the AI wrote but never applied). longform: check the new pack. */
  private postProcess(info: RunInfo, emit: (k: CoachEvent['kind'], t: string) => void) {
    const params = info.params ?? {};
    if (info.task === 'enrich') {
      const file = patchPath(info.id);
      if (!fs.existsSync(file)) {
        info.outcome = { patch: null, updated: 0 };
        if (info.status === 'success') {
          info.status = 'error';
          info.error = 'no patch';
        }
        emit('error', `Không thấy patch ${repoRel(file)} — lượt này chưa cập nhật câu nào.`);
        return;
      }
      const r = applyPatch(file);
      const ids = Array.isArray(params.ids) ? (params.ids as string[]) : [];
      const inPatch = new Set(r.items.map((i) => i.id));
      const missing = ids.filter((x) => !inPatch.has(x));
      info.outcome = { patch: repoRel(file), updated: r.applied + r.unchanged, skipped: r.skipped, failed: r.failed + (r.error ? 1 : 0), missing };
      if (r.error) emit('stderr', `❌ ${r.error}`);
      for (const it of r.items) if (it.status === 'failed' || it.status === 'skipped') emit('stderr', `${it.status === 'skipped' ? '⏭' : '❌'} ${it.id}: ${it.errors.join(' | ')}`);
      emit(
        'result',
        `Patch: ${r.applied + r.unchanged}/${ids.length || r.items.length} câu đã cập nhật${r.skipped ? ` · ${r.skipped} bỏ qua` : ''}${r.failed ? ` · ${r.failed} lỗi` : ''}${missing.length ? ` · ${missing.length} câu thiếu trong patch` : ''}${r.error ? ` · ${r.error}` : ''}`,
      );
      return;
    }
    if (info.task === 'longform') {
      const bank = loadBank();
      const prefix = String(params.idPrefix ?? '');
      const qs = prefix ? bank.questions.filter((q) => q.id.startsWith(prefix)) : [];
      const pack = bank.packs.find((p) => p.id === params.packId) ?? bank.packs.find((p) => qs.some((q) => q.file === p.file));
      const errors = pack ? bank.problems.filter((p) => p.level === 'error' && p.file === pack.file).length : 0;
      info.outcome = { pack: pack ? pack.file : null, questions: qs.length, longForm: qs.filter((q) => q.longForm).length, errors };
      if (!qs.length && info.status === 'success') {
        info.status = 'error';
        info.error = 'no new questions';
      }
      emit(
        pack && !errors ? 'result' : 'stderr',
        pack ? `Pack mới ${pack.file}: ${qs.length} câu (${qs.filter((q) => q.longForm).length} câu dài) · ${errors} lỗi định dạng` : 'Không thấy pack câu dài mới.',
      );
    }
  }

  private handleMessage(msg: Record<string, unknown>, info: RunInfo, emit: (k: CoachEvent['kind'], t: string) => void, markResult: () => void) {
    const type = msg.type;
    if (type === 'system' && msg.subtype === 'init') {
      if (typeof msg.model === 'string') info.model = msg.model;
      emit('start', `Model: ${String(msg.model ?? '?')} · permission: ${String(msg.permissionMode ?? '?')}`);
      return;
    }
    if (type === 'assistant') {
      const content = ((msg.message as { content?: unknown[] })?.content ?? []) as Record<string, unknown>[];
      for (const c of content) {
        if (c.type === 'text' && typeof c.text === 'string' && c.text.trim()) emit('text', c.text.trim().slice(0, 1500));
        if (c.type === 'tool_use') emit('tool', `${String(c.name)} ${summarizeInput(String(c.name), (c.input ?? {}) as Record<string, unknown>)}`);
      }
      return;
    }
    if (type === 'user') {
      const content = ((msg.message as { content?: unknown[] })?.content ?? []) as Record<string, unknown>[];
      for (const c of content) {
        if (c.type === 'tool_result' && c.is_error) {
          const text = typeof c.content === 'string' ? c.content : JSON.stringify(c.content);
          emit('error', `Tool lỗi: ${text.slice(0, 400)}`);
        }
      }
      return;
    }
    if (type === 'result') {
      markResult();
      info.costUsd = typeof msg.total_cost_usd === 'number' ? msg.total_cost_usd : undefined;
      info.summary = typeof msg.result === 'string' ? msg.result.slice(0, 4000) : undefined;
      if (msg.is_error || (typeof msg.subtype === 'string' && msg.subtype !== 'success')) {
        info.status = 'error';
        info.error = String(msg.subtype ?? 'error');
      } else info.status = 'success';
      const denials = Array.isArray(msg.permission_denials) ? msg.permission_denials.length : 0;
      if (denials) emit('stderr', `${denials} thao tác bị chặn bởi quyền hạn (${allowedTools(info.task).filter((t) => /^(Edit|Bash)/.test(t)).join(', ')}).`);
      emit('result', info.summary ?? '(không có tóm tắt)');
    }
  }

  cancel(): boolean {
    if (!this.current) return false;
    this.current.info.status = 'cancelled';
    this.current.child.kill('SIGTERM');
    return true;
  }
}

export const coachRunner = new CoachRunner();
