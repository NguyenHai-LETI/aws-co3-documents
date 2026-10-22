// Runs the AI coach headlessly through the Claude Code CLI (`claude -p … --output-format stream-json`)
// and turns its event stream into short progress lines for the UI (SSE) and log files in coach/runs/.
// Tasks: analyze (COACH.md), generate (GENERATE.md), enrich + longform (ENRICH.md — the batch of questions is prepared
// here before the spawn) and verify (blind-solve by a second model, verify.ts).
// A run is a sequence of CLI calls ("phases") under one lock, log and cost:
//   main      — the task itself. With coach.structured_output, generate / enrich / longform run with read-only tools and
//               `--json-schema`; the app writes and checks the patch / pack (ai-output.ts). Otherwise the AI writes the
//               files and the app re-checks them afterwards (legacy file mode, also used by the interactive skills).
//   repair    — structured runs only: the rejected items go back once through `--resume <session_id>`.
//   verify    — coach.verify.auto: questions the run added or changed (new hash) are blind-solved; mismatches on
//               AI-written / just-changed questions go to `status: draft` (coach.verify.auto_draft).
// After a successful analyze, coach.enrich_after_analyze starts a follow-up ENRICH run (its own record) over the next
// ~10 questions the learner is about to meet (enrich.ts upcomingIds: the new plan's sessions, reviews due by tomorrow,
// the next never-seen questions) — ENRICH batches put those first anyway.
// [v5] γ2: tasks `twins` (paraphrase / contrast siblings, TWINS.md) and `family` (qualifier families, FAMILY.md) write
// packs like long-form; generate / longform honour params.skills (exam-guide bullets) and the task deficits; the verify
// task has two more scopes — `grounded` (fact-check against AWS documentation, WebFetch / WebSearch on AWS domains only)
// and `audit` (imported questions, + an optional local-model vote, + a grounded check of what looks wrong). File-mode
// runs capture every block first so "↩️ Hoàn tác" can restore what the AI edited in place (undo.ts). The idle chooser
// (coach.idle_tasks) picks what a scheduled run without new results does.
// [v6] The blind solver sees the options shuffled (verify.ts blindOrders; picks mapped back to bank letters). Verify scope
// `cues` = the choices-only cue probe (coach.verify.probe_model, default haiku): options only, no stem — manual only
// (`--verify --scope cues`, POST /api/verify/run {scope: 'cues'}); it never drafts, reactivates or counts as verified.
import { execFile, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { COACH_DIR, DATA_DIR, PACKS_DIR, REPO_DIR, RUNS_DIR, TRAINER_DIR, loadConfig, rel, type AppConfig } from '../config.ts';
import { context } from '../context.ts';
import { loadBank, type BankState } from './bank.ts';
import { DAY_MS, localDateKey, localIso, stampParts } from './time.ts';
import { applyPatch, applyPatchItems, combineResults, ledgerPath, type PatchResult } from './patch.ts';
import { MAX_BATCH, MAX_LONGFORM, idList, learnerNotes, longformTargets, parseTasks, patchPath, readRunInfos, repoRel, selectBatch, upcomingIds, writeBatchFile, writeLongformFile } from './enrich.ts';
import { MAX_FAMILIES, MAX_TWINS, familyFocus, familySeeds, twinsTargets, writeFamilyFile, writeTwinsFile } from './twins.ts';
import { GROUNDED_ALLOWED, GROUNDED_BATCH, GROUNDED_SCHEMA, GROUNDED_TOOLS, groundedPrompt, groundedVerdicts, localVotes } from './factcheck.ts';
import { captureBlocks, recordRunDiff, type CapturedBlock } from './undo.ts';
import { loadExamGuide, taskDeficits } from './exam-guide.ts';
import { SKILL_ID_RE } from './pack-format.ts';
import { askCostsSince } from './ask.ts';
import { writeSnapshot } from './snapshot.ts';
import { aiSyncLine, syncForAi, type AiSyncNote } from './sync.ts';
import { distractorReport, optionStats } from './quality.ts';
import {
  MAX_NEW_QUESTIONS,
  STRUCTURED_TASKS,
  TWIN_KINDS,
  checkDraft,
  draftOf,
  familyDrafts,
  twinChecks,
  enrichItems,
  mergeRepaired,
  planPack,
  examSpecWarnings,
  repairPrompt,
  schemaFor,
  structuredOutput,
  writePack,
  writePatchFile,
  type ItemFailure,
  type PackTarget,
  type PackTask,
  type StructuredTask,
  type TwinKind,
} from './ai-output.ts';
import { sealedIds } from './sealed.ts';
import { loadIssues } from './issues.ts';
import { lintQuestion } from './lint.ts';
import {
  CUE_LABEL,
  MAX_VERIFY,
  PROBE_SCHEMA,
  VERIFY_SCHEMA,
  appendProbes,
  appendVerdicts,
  auditTargets,
  autoDraft,
  blindOrders,
  cueTargets,
  draftCandidates,
  groundedTargets,
  latestVerdicts,
  probeAnswers,
  probeAttempts,
  probeCost,
  probeLabel,
  probeOrders,
  probePrompt,
  probeRecord,
  reactivate,
  verdictsFor,
  verifyBatches,
  verifyPrompt,
  verifyTargets,
  type ProbeRun,
} from './verify.ts';
import { contextStats } from '../context.ts';
import type { QuestionDraft } from './pack-format.ts';
import type { Bucket, ClaudeStatus, CoachEvent, CoachRunInfo, CoachRunOutcome, CoachTask, CostSummary, CueProbe, Question, VerifyVerdict } from '../../shared/types.ts';

const LOCK_FILE = path.join(COACH_DIR, '.lock');
const RUN_TIMEOUT_MS = 40 * 60_000; // main + repair phases
const VERIFY_TIMEOUT_MS = Number(process.env.TRAINER_VERIFY_TIMEOUT_MS) || 20 * 60_000; // blind-solve phase (all its batches); env = tests
const fmtLimit = (ms: number) => (ms >= 60_000 ? `${Math.round(ms / 60_000)} phút` : `${Math.round(ms / 1000)} giây`);
const IS_WIN = process.platform === 'win32';

/** One automatic retry of the main CLI call for transient failures (tests shorten the delay). */
export const RETRY = { attempts: 2, delayMs: 60_000 };

/**
 * Failures that usually pass within a minute: the OAuth token refresh racing another Claude Code process
 * (VS Code extension, a terminal session — the CLI says "retry in a minute"), or an overloaded API.
 * Usage limits are not transient and are not retried.
 */
export function isTransientCliError(text: string | undefined): boolean {
  return !!text && /another Claude Code process|usually transient|overloaded/i.test(text);
}

export function isAuthError(text: string | undefined): boolean {
  return !!text && /OAuth|\/login|log ?in again|authenticat|credential/i.test(text);
}

const AUTH_HINT =
  '💡 Claude Code chưa lấy được token đăng nhập — thường do một phiên Claude Code khác (VS Code, terminal) đang làm mới token cùng lúc. Chạy lại sau 1 phút; nếu vẫn lỗi, đóng bớt các phiên Claude Code khác hoặc mở terminal chạy `claude` → `/login`.';
export const COACH_TASKS: readonly CoachTask[] = ['analyze', 'generate', 'enrich', 'longform', 'verify', 'twins', 'family'];
export const DEFAULT_VERIFY_MODEL = 'opus';
export const AFTER_ANALYZE_BATCH = 10; // coach.enrich_after_analyze: questions of the follow-up ENRICH run

/** Run record = shared CoachRunInfo + optional extras written by this runner (UI may show them). */
export type RunInfo = CoachRunInfo & {
  model?: string; // model reported by the CLI (system/init)
  outcome?: RunOutcome; // checked result: patch / new pack / blind-solve verdicts
  sync?: { before?: AiSyncNote; after?: AiSyncNote }; // auto-sync around the run (config sync.before_ai / after_ai)
};

export interface StartOptions {
  syncBefore?: boolean; // default config sync.before_ai (coach-run.ts passes false: it synced before choosing the task)
  syncAfter?: boolean; // default config sync.after_ai
}

export type RunOutcome = CoachRunOutcome;

/** Nothing left to do for this task (empty ENRICH batch, no long-form target, nothing to verify) — not an error. */
export class NothingToDoError extends Error {}

/**
 * A blind-solve verdict as a run-log line (Coach → Xem log). [γ] A sealed question shows no id, pick, key or reason —
 * the learner reads this log, and the line would give the answer away.
 */
export function verdictLogLine(v: Pick<VerifyVerdict, 'qid' | 'outcome' | 'picked' | 'key' | 'reason'>, sealed: ReadonlySet<string>): string {
  const icon = v.outcome === 'mismatch' ? '❌' : v.outcome === 'ambiguous' ? '⚠️' : v.outcome === 'ok' ? '✅' : '💥';
  if (sealed.has(v.qid)) {
    const label = v.outcome === 'mismatch' ? 'lệch đáp án' : v.outcome === 'ambiguous' ? 'mơ hồ' : v.outcome === 'ok' ? 'khớp' : 'không trả lời được';
    return `${icon} 1 câu đang niêm phong: ${label} (chi tiết ẩn tới khi bạn làm đề hoặc mở sớm)`;
  }
  const what = v.outcome === 'mismatch' ? `model chọn ${v.picked}, đáp án ${v.key}` : v.outcome === 'ambiguous' ? `mơ hồ (model chọn ${v.picked ?? '—'})` : v.outcome === 'ok' ? 'khớp' : 'không trả lời được';
  return `${icon} ${v.qid}: ${what}${v.reason ? ` — ${v.reason.slice(0, 200)}` : ''}`;
}

/** [v6] A `cue` probe result as a run-log line; a sealed question shows no id, key or giveaway (like verdictLogLine). */
export function cueLogLine(p: Pick<CueProbe, 'qid' | 'key' | 'picks' | 'reason'>, sealed: ReadonlySet<string>): string {
  if (sealed.has(p.qid)) return `🎯 1 câu đang niêm phong: ${CUE_LABEL} (chi tiết ẩn tới khi bạn làm đề hoặc mở sớm)`;
  return `🎯 ${p.qid}: ${CUE_LABEL} (${p.picks.length} lần đều chọn ${p.key ?? '—'})${p.reason ? ` — ${p.reason.slice(0, 200)}` : ''}`;
}

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

/** `claude auth status` output → whether the CLI is logged in and how (no personal details are kept). */
function parseAuth(stdout: string, ok: boolean): ClaudeStatus['auth'] {
  try {
    const j = JSON.parse(stdout) as { loggedIn?: boolean; authMethod?: string; subscriptionType?: string };
    return { loggedIn: !!j.loggedIn, method: j.authMethod, plan: j.subscriptionType };
  } catch {
    return { loggedIn: ok };
  }
}

const INSTALL_HINT = IS_WIN
  ? 'Không tìm thấy Claude Code CLI. Cài bằng PowerShell `irm https://claude.ai/install.ps1 | iex` (hoặc `npm i -g @anthropic-ai/claude-code`), chạy `claude` một lần để đăng nhập, hoặc đặt đường dẫn ở trainer/config.yaml → coach.claude_bin / biến môi trường CLAUDE_BIN (claude.exe hoặc claude.cmd). Có thể dùng Claude Cowork thay thế (nút “Copy prompt”).'
  : 'Không tìm thấy Claude Code CLI. Cài bằng `npm i -g @anthropic-ai/claude-code` (rồi `claude` để đăng nhập), hoặc đặt đường dẫn ở trainer/config.yaml → coach.claude_bin / biến môi trường CLAUDE_BIN. Có thể dùng Claude Cowork thay thế (nút “Copy prompt”).';

const STATUS_TTL_MS = 60_000;
let statusCache: { at: number; status: ClaudeStatus } | undefined;
let refreshing: Promise<ClaudeStatus> | undefined;

function sourceOf(c: { p: string; source: string }, target: string): string {
  return target === c.p ? c.source : `${c.source} (${path.basename(c.p)} → ${path.basename(target)})`;
}

/** Blocking detection (`--version`, then `auth status`) — first call / explicit fresh checks only. */
function detectSync(cfg: AppConfig): ClaudeStatus {
  const tried = new Set<string>();
  for (const c of candidates(cfg)) {
    const target = resolveCandidate(c.p);
    if (!target || tried.has(target)) continue;
    tried.add(target);
    const { cmd, pre } = claudeCommand(target);
    const r = spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8', timeout: 15_000, windowsHide: true });
    if (r.status !== 0) continue;
    const a = spawnSync(cmd, [...pre, 'auth', 'status'], { encoding: 'utf8', timeout: 15_000, windowsHide: true });
    return { available: true, path: target, version: r.stdout.trim().split('\n')[0], source: sourceOf(c, target), auth: parseAuth(a.stdout ?? '', a.status === 0) };
  }
  return { available: false, hint: INSTALL_HINT };
}

function run(cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { encoding: 'utf8', timeout: 15_000, windowsHide: true }, (err, stdout) => resolve({ ok: !err, stdout: String(stdout ?? '') }));
  });
}

/** Same detection without blocking the event loop. */
async function detectAsync(cfg: AppConfig): Promise<ClaudeStatus> {
  const tried = new Set<string>();
  for (const c of candidates(cfg)) {
    const target = resolveCandidate(c.p);
    if (!target || tried.has(target)) continue;
    tried.add(target);
    const { cmd, pre } = claudeCommand(target);
    const v = await run(cmd, [...pre, '--version']);
    if (!v.ok) continue;
    const a = await run(cmd, [...pre, 'auth', 'status']);
    return { available: true, path: target, version: v.stdout.trim().split('\n')[0], source: sourceOf(c, target), auth: parseAuth(a.stdout, a.ok) };
  }
  return { available: false, hint: INSTALL_HINT };
}

/**
 * Where the Claude Code CLI is and whether it is logged in. Never blocks once something is cached: a status older than
 * a minute is returned as is and refreshed in the background. `fresh` (scripts) and the very first call detect
 * synchronously (~0.4 s: `--version` + `auth status`).
 */
export function findClaude(cfg: AppConfig = loadConfig(), fresh = false): ClaudeStatus {
  if (!fresh && statusCache) {
    if (Date.now() - statusCache.at >= STATUS_TTL_MS) void refreshClaudeStatus(cfg);
    return statusCache.status;
  }
  const status = detectSync(cfg);
  statusCache = { at: Date.now(), status };
  return status;
}

/** The last detected Claude CLI status without starting a detection (LAN clients of /api/meta). */
export function cachedClaudeStatus(): ClaudeStatus | undefined {
  return statusCache?.status;
}

/** Re-detects the CLI off the request path (one detection at a time); resolves with the new status. */
export function refreshClaudeStatus(cfg: AppConfig = loadConfig()): Promise<ClaudeStatus> {
  refreshing ??= detectAsync(cfg)
    .then((status) => {
      statusCache = { at: Date.now(), status };
      return status;
    })
    .catch(() => statusCache?.status ?? { available: false, hint: INSTALL_HINT })
    .finally(() => {
      refreshing = undefined;
    });
  return refreshing;
}

export function versionAtLeast(version: string | undefined, min: [number, number, number]): boolean {
  const m = version?.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return false;
  const v = [Number(m[1]), Number(m[2]), Number(m[3])];
  for (let i = 0; i < 3; i++) if (v[i] !== min[i]) return v[i] > min[i];
  return true;
}

/** CLI versions that know `--permission-prompts`, `--tools`, `--no-session-persistence` (and `--json-schema`). */
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

/**
 * Model for a task: coach.models[task] || coach.model ('' = Claude Code default). Long-form uses the enrich model.
 * The blind-solve verifier is meant to be a different, strong model: coach.models.verify, default opus.
 */
export function modelFor(task: CoachTask | 'ask' | 'tutor' | 'notebook', cfg: AppConfig): string {
  if (task === 'verify') return String(cfg.coach.models?.verify || DEFAULT_VERIFY_MODEL).trim();
  const key = task === 'longform' ? 'enrich' : task === 'twins' || task === 'family' ? 'generate' : task; // [v5] twins / family write like generate
  return String(cfg.coach.models?.[key] || cfg.coach.model || '').trim();
}

/** [v6] Model of the choices-only cue probe: coach.verify.probe_model (default haiku), '' = the verify model. */
export function probeModel(cfg: AppConfig): string {
  return String(cfg.coach.verify?.probe_model ?? '').trim() || modelFor('verify', cfg);
}

export function resolvedModels(cfg: AppConfig): { analyze: string; generate: string; enrich: string; ask: string; verify: string } {
  return { analyze: modelFor('analyze', cfg), generate: modelFor('generate', cfg), enrich: modelFor('enrich', cfg), ask: modelFor('ask', cfg), verify: modelFor('verify', cfg) };
}

/** Scheduled runs started today (local date) — compared with coach.max_runs_per_day. A follow-up run (`params.after`) rides on its analyze run. */
export function scheduledRunsToday(runs: CoachRunInfo[] = readRunInfos(200), now = new Date()): number {
  const today = localDateKey(now);
  return runs.filter((r) => r.trigger === 'schedule' && r.status !== 'skipped' && !r.params?.after && localDateKey(r.startedAt) === today).length;
}

/** generate / enrich / longform answer in JSON (coach.structured_output) — needs a CLI with --json-schema / --tools. */
export function isStructured(task: CoachTask, cfg: AppConfig, version?: string): boolean {
  return !!cfg.coach.structured_output && STRUCTURED_TASKS.includes(task) && versionAtLeast(version, MODERN_CLI);
}

// ── prompts ─────────────────────────────────────────────────────────────────

export interface GenerateParams {
  skills?: string[]; // [v5] exam-guide bullets to cover
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
  verify: 'Giải mù câu hỏi (model thứ hai)',
  twins: 'Sinh câu song sinh (chống học vẹt)', // [v5] γ2
  family: 'Sinh họ câu đổi yêu cầu', // [v5] γ2
};

function runInfoLines(runId: string, trigger: string): string[] {
  return [`- run_id: ${runId}`, `- trigger: ${trigger}`, `- now: ${localIso()}`, `- working directory = thư mục gốc repo; mọi đường dẫn bên dưới là tương đối từ đây.`];
}

const noteLine = (params: Record<string, unknown>) => {
  const note = typeof params.note === 'string' ? params.note.trim() : '';
  return note ? `- ghi chú của người học: ${note.replace(/\s+/g, ' ').slice(0, 300)}` : '';
};

/** File mode: the AI writes the patch / pack / plan itself (also what the interactive skills do). */
export function buildPrompt(task: CoachTask, runId: string, trigger: string, params: Record<string, unknown> = {}): string {
  const common = runInfoLines(runId, trigger);
  if (task === 'analyze') {
    return [
      'Bạn là AI Coach của hệ thống luyện thi AWS SAA-C03 trong repo này.',
      'Đọc TOÀN BỘ file `trainer/coach/COACH.md` rồi thực hiện ĐÚNG quy trình trong đó (phân tích kết quả → cập nhật ngân hàng câu hỏi → viết kế hoạch luyện tập).',
      '',
      'Thông tin lượt chạy:',
      ...common,
      '- snapshot vừa được cập nhật: `trainer/coach/snapshot.md`',
      noteLine(params),
      '',
      'Kết thúc bằng 3–6 dòng tóm tắt (tiếng Việt): phát hiện chính, số câu mới, file kế hoạch đã tạo.',
    ]
      .filter((l) => l !== '')
      .join('\n');
  }
  if (task === 'enrich') {
    return [
      'Bạn là biên tập viên ngân hàng câu hỏi (ENRICH) của hệ thống luyện thi AWS SAA-C03 trong repo này.',
      'Đọc TOÀN BỘ file `trainer/coach/ENRICH.md` rồi thực hiện ĐÚNG phần **A (lô bảo trì)** cho lô câu hỏi đã được app chuẩn bị sẵn (chế độ tương tác: tự ghi file patch).',
      '',
      'Thông tin lượt chạy:',
      ...common,
      `- lô câu hỏi: \`${String(params.batch)}\` (${String(params.size)} câu)`,
      `- todo được yêu cầu: ${(params.tasks as string[] | undefined)?.join(', ') || 'explain, hint, classify, balance'}`,
      `- patch phải ghi: \`${String(params.patch)}\``,
      `- áp dụng: \`node trainer/scripts/apply-patch.ts ${String(params.patch)}\` (sửa item lỗi rồi chạy lại đến khi sạch)`,
      noteLine(params),
      '',
      'Kết thúc bằng 2–4 dòng tóm tắt (tiếng Việt): số câu đã cải thiện theo từng loại todo, item lỗi/bỏ qua (nếu có), kết quả apply-patch cuối cùng.',
    ]
      .filter((l) => l !== '')
      .join('\n');
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
  if (task === 'twins' || task === 'family') {
    const doc = task === 'twins' ? 'TWINS.md' : 'FAMILY.md';
    return [
      'Bạn là AI Question Writer của hệ thống luyện thi AWS SAA-C03 trong repo này.',
      `Đọc TOÀN BỘ file \`trainer/coach/${doc}\` (phần "Chế độ tương tác") rồi làm ĐÚNG theo file lô app đã chuẩn bị.`,
      '',
      'Thông tin lượt chạy:',
      ...common,
      `- file lô: \`${String(params.batch)}\``,
      `- ${task === 'twins' ? `số câu song sinh: ${String(params.count)} (mỗi câu gốc một câu, \`variant_of\` = id gốc)` : `số họ câu: ${String(params.count)} (mỗi họ 2–4 câu, \`family\` = id họ)`}`,
      `- pack mới: \`${String(params.packFile)}\` (thay \`<slug>\`), pack id \`${String(params.packId)}\`, id câu \`${String(params.idPrefix)}01\`, …${task === 'family' ? `, id họ \`${String(params.familyPrefix)}1\`, …` : ''}`,
      noteLine(params),
      '',
      'Kết thúc bằng 2–4 dòng tóm tắt (tiếng Việt): file pack đã tạo, số câu, kết quả validate.',
    ]
      .filter((l) => l !== '')
      .join('\n');
  }
  const p = params as GenerateParams;
  return [
    'Bạn là AI Question Writer của hệ thống luyện thi AWS SAA-C03 trong repo này.',
    'Đọc TOÀN BỘ file `trainer/coach/GENERATE.md` rồi thực hiện ĐÚNG quy trình trong đó để sinh câu hỏi mới vào ngân hàng.',
    '',
    'Thông tin lượt chạy:',
    ...common,
    ...generateLines(p),
    '',
    'Kết thúc bằng 3–5 dòng tóm tắt (tiếng Việt): file pack đã tạo, số câu, kết quả validate.',
  ].join('\n');
}

function generateLines(p: GenerateParams): string[] {
  return [
    `- sources: ${p.sources?.length ? p.sources.map((s) => '`' + s + '`').join(', ') : p.skills?.length ? '(không chỉ định — dùng notes của các task trong danh sách mục đề cương, Grep theo từ khoá)' : '(không chỉ định — chọn theo topic/focus)'}`,
    `- count: ${p.count ?? 15}`,
    `- topic: ${p.topic || '(tự xác định từ tài liệu)'}`,
    `- difficulty mix: ${p.difficulty || 'medium 50%, hard 35%, easy 15%'}`,
    `- focus: ${p.focus || '(không có)'}`,
    `- pack slug gợi ý: ${p.slug || '(tự đặt)'}`,
    ...skillLines(p.skills),
  ];
}

/** [v5] Exam-guide bullets a run targets, with their text when the guide is loaded. */
export function skillLines(skills: string[] | undefined): string[] {
  if (!skills?.length) return [];
  let text = new Map<string, string>();
  try {
    text = new Map(loadExamGuide().bullets.map((b) => [b.id, b.text]));
  } catch {
    // guide not available: ids only
  }
  return [
    `- mục đề cương cần phủ (skills — mỗi câu ghi \`skills\` gồm ít nhất một mục dưới đây; chia đều, ≥ 1 câu/mục; ưu tiên câu dài chuẩn đề, ~25 % nhiều đáp án):`,
    ...skills.map((s) => `  - \`${s}\`${text.get(s) ? ` ${text.get(s)}` : ''}`),
  ];
}

const APP_MODE = '- CHẾ ĐỘ APP (JSON): chỉ đọc file (Read / Grep / Glob) — KHÔNG ghi file, KHÔNG chạy lệnh. Trả toàn bộ kết quả bằng JSON đúng schema (công cụ StructuredOutput).';

/** App mode (coach.structured_output): read-only tools, the answer is JSON; the app writes, checks and repairs. */
export function buildJsonPrompt(task: StructuredTask, runId: string, trigger: string, params: Record<string, unknown> = {}): string {
  const common = runInfoLines(runId, trigger);
  if (task === 'enrich') {
    return [
      'Bạn là biên tập viên ngân hàng câu hỏi (ENRICH) của hệ thống luyện thi AWS SAA-C03 trong repo này.',
      'Đọc TOÀN BỘ file `trainer/coach/ENRICH.md` (mục "Chế độ app (JSON)" và phần **A**) rồi xử lý lô câu hỏi app đã chuẩn bị sẵn.',
      '',
      'Thông tin lượt chạy:',
      ...common,
      APP_MODE,
      `- lô câu hỏi: \`${String(params.batch)}\` (${String(params.size)} câu) — đọc toàn bộ; \`items\` có đúng một item cho mỗi câu (khoá như patch YAML SCHEMA §8; \`base\` do app tự điền).`,
      `- todo được yêu cầu: ${(params.tasks as string[] | undefined)?.join(', ') || 'explain, hint, classify, balance'}`,
      noteLine(params),
      `- app ghi patch \`${String(params.patch)}\`, kiểm tra từng item (base, giá trị, chữ cái đáp án, hint, lint) và gửi lại các item lỗi MỘT lần để bạn sửa.`,
      '',
      '`summary`: 2–4 dòng tiếng Việt — số câu đã cải thiện theo từng loại todo, câu đã đổi đáp án / retired (nếu có).',
    ]
      .filter((l) => l !== '')
      .join('\n');
  }
  if (task === 'twins') {
    return [
      'Bạn là AI Question Writer của hệ thống luyện thi AWS SAA-C03 trong repo này.',
      'Đọc TOÀN BỘ file `trainer/coach/TWINS.md` (mục "Chế độ app (JSON)") rồi viết câu song sinh cho các câu gốc app đã chọn sẵn.',
      '',
      'Thông tin lượt chạy:',
      ...common,
      APP_MODE,
      `- câu gốc: \`${String(params.batch)}\` — viết đúng ${String(params.count)} câu, mỗi câu gốc MỘT câu song sinh đúng loại ghi ở câu đó (\`kind\`), \`variant_of\` = [id câu gốc].`,
      '- `pack.slug`: 2–4 từ kebab-case; `pack.title`: tên chủ đề (app ghép thành "AI · Câu song sinh · …").',
      `- app gán id câu (\`${String(params.idPrefix)}01\`, …), tính \`time\`, ghi \`created\`/\`enriched\` và tạo pack \`${String(params.packFile)}\`.`,
      noteLine(params),
      '',
      '`summary`: 2–4 dòng tiếng Việt — số câu theo loại (surface / contrast), câu gốc khó viết (nếu có).',
    ]
      .filter((l) => l !== '')
      .join('\n');
  }
  if (task === 'family') {
    return [
      'Bạn là AI Question Writer của hệ thống luyện thi AWS SAA-C03 trong repo này.',
      'Đọc TOÀN BỘ file `trainer/coach/FAMILY.md` (mục "Chế độ app (JSON)") rồi viết các họ câu "cùng tình huống, đổi yêu cầu".',
      '',
      'Thông tin lượt chạy:',
      ...common,
      APP_MODE,
      `- file lô: \`${String(params.batch)}\` — viết đúng ${String(params.count)} họ (\`families\`), mỗi họ 2–4 câu (\`members\`) có yêu cầu và đáp án khác nhau.`,
      '- `pack.slug`: 2–4 từ kebab-case; `pack.title`: tên chủ đề (app ghép thành "AI · Họ câu đổi yêu cầu · …").',
      `- app ghép đề = scenario + question, gán id câu (\`${String(params.idPrefix)}01\`, …) và id họ (\`${String(params.familyPrefix)}1\`, …), tính \`time\`, tạo pack \`${String(params.packFile)}\`.`,
      noteLine(params),
      '',
      '`summary`: 2–4 dòng tiếng Việt — số họ, các cặp yêu cầu đã dùng (vd cost ⟷ ops).',
    ]
      .filter((l) => l !== '')
      .join('\n');
  }
  if (task === 'longform') {
    return [
      'Bạn là AI Question Writer của hệ thống luyện thi AWS SAA-C03 trong repo này.',
      'Đọc TOÀN BỘ file `trainer/coach/ENRICH.md` (mục "Chế độ app (JSON)" và phần **B**) rồi viết câu dài cho các câu gốc app đã chọn sẵn.',
      '',
      'Thông tin lượt chạy:',
      ...common,
      APP_MODE,
      `- câu gốc: \`${String(params.batch)}\` — viết đúng ${String(params.count)} câu, mỗi câu gốc một biến thể dài, \`variant_of\` = [id câu gốc].`,
      ...skillLines(Array.isArray(params.skills) ? params.skills.map(String) : undefined),
      '- `pack.slug`: 2–4 từ kebab-case mô tả chủ đề; `pack.title`: tên chủ đề (app ghép thành "AI · Câu dài chuẩn đề thi · …").',
      `- app gán id câu (\`${String(params.idPrefix)}01\`, …), tính \`time\`, ghi \`created\`/\`enriched\` và tạo pack \`${String(params.packFile)}\`.`,
      '',
      '`summary`: 2–4 dòng tiếng Việt — số câu, số từ stem trung bình, câu gốc nào khó viết biến thể (nếu có).',
    ].join('\n');
  }
  return [
    'Bạn là AI Question Writer của hệ thống luyện thi AWS SAA-C03 trong repo này.',
    'Đọc TOÀN BỘ file `trainer/coach/GENERATE.md` (mục "Chế độ app (JSON)") rồi sinh câu hỏi mới vào ngân hàng.',
    '',
    'Thông tin lượt chạy:',
    ...common,
    APP_MODE,
    ...generateLines(params as GenerateParams),
    '- app gán pack id `doc-<slug>` (theo `pack.slug`) và id câu `doc-<slug>-01`, …, tính `time`, ghi pack mới `trainer/bank/packs/docs/<ngày>-<slug>.md`.',
    '',
    '`summary`: 3–5 dòng tiếng Việt — số câu theo domain/độ khó, lưu ý nếu tài liệu có chỗ sai/lỗi thời.',
  ].join('\n');
}

/** Least-privilege tool rules per task in file mode (dontAsk mode: everything else is denied; reads inside the repo are allowed). */
export function allowedTools(task: CoachTask): string[] {
  const rw = (p: string) => [`Edit(${p})`, `Write(${p})`];
  const base = ['Glob', 'Grep', 'TodoWrite', 'Bash(node trainer/scripts/validate.ts:*)'];
  switch (task) {
    case 'enrich':
      return [...base, ...rw('trainer/coach/patches/**'), 'Bash(node trainer/scripts/apply-patch.ts:*)'];
    case 'longform':
    case 'twins':
    case 'family':
      return [...base, ...rw('trainer/bank/packs/ai/**')];
    case 'verify':
      return [];
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

function tail(args: string[], cfg: AppConfig, model: string): string[] {
  if (model) args.push('--model', model);
  if (cfg.coach.effort) args.push('--effort', cfg.coach.effort);
  if (cfg.coach.max_budget_usd > 0) args.push('--max-budget-usd', String(cfg.coach.max_budget_usd));
  return args;
}

/** File mode: the AI may write where allowedTools says. */
export function cliArgs(prompt: string, cfg: AppConfig, version?: string, task: CoachTask = 'analyze'): string[] {
  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    // [v5 R3] no MCP server, not even an approved project .mcp.json (repo root = cwd): tools are exactly what follows
    '--strict-mcp-config',
    // Non-interactive and least-privilege: anything not allowed below is denied instead of prompting.
    // Reads inside the repo (cwd) are allowed by default; reads outside it are denied.
    '--permission-mode',
    'dontAsk',
    ...(versionAtLeast(version, MODERN_CLI) ? ['--permission-prompts', 'none'] : []),
    '--allowedTools',
    ...allowedTools(task),
  ];
  return tail(args, cfg, modelFor(task, cfg));
}

/**
 * App mode (structured output): read-only built-in tools, no Edit / Write / Bash rule, the answer through
 * `--json-schema`. `resume` continues the session of the first call (repair round).
 */
export function structuredArgs(prompt: string, cfg: AppConfig, task: StructuredTask, opts: { resume?: string } = {}): string[] {
  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    // [v5 R3] no MCP server, not even an approved project .mcp.json (repo root = cwd): tools are exactly what follows
    '--strict-mcp-config',
    '--json-schema',
    JSON.stringify(schemaFor(task)),
    '--tools',
    'Read,Glob,Grep',
    '--permission-mode',
    'dontAsk',
    '--permission-prompts',
    'none',
    ...(opts.resume ? ['--resume', opts.resume] : []),
    '--allowedTools',
    'Glob',
    'Grep',
  ];
  return tail(args, cfg, modelFor(task, cfg));
}

/** Blind-solve call: no tools at all, no session kept, the verify model (with sonnet as fallback when it is overloaded). */
export function verifyArgs(prompt: string, cfg: AppConfig): string[] {
  const model = modelFor('verify', cfg);
  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    // [v5 R3] no MCP server, not even an approved project .mcp.json (repo root = cwd): tools are exactly what follows
    '--strict-mcp-config',
    '--json-schema',
    JSON.stringify(VERIFY_SCHEMA),
    '--tools',
    '',
    '--permission-mode',
    'dontAsk',
    '--permission-prompts',
    'none',
    '--no-session-persistence',
  ];
  if (model && !/sonnet/i.test(model)) args.push('--fallback-model', 'sonnet');
  return tail(args, cfg, model);
}

/**
 * [v6] Choices-only cue probe call: like the blind solve (no tools at all, no MCP, no session kept, `--json-schema`,
 * sonnet as fallback) with the probe model. No `--effort`: a guess from the options needs no long thinking, and the
 * default probe model (haiku) does not take every effort level.
 */
export function probeArgs(prompt: string, cfg: AppConfig): string[] {
  const model = probeModel(cfg);
  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--strict-mcp-config',
    '--json-schema',
    JSON.stringify(PROBE_SCHEMA),
    '--tools',
    '',
    '--permission-mode',
    'dontAsk',
    '--permission-prompts',
    'none',
    '--no-session-persistence',
  ];
  if (model && !/sonnet/i.test(model)) args.push('--fallback-model', 'sonnet');
  if (model) args.push('--model', model);
  if (cfg.coach.max_budget_usd > 0) args.push('--max-budget-usd', String(cfg.coach.max_budget_usd));
  return args;
}

/**
 * [v5] Grounded fact-check call: the model may only search / read AWS documentation — built-in tools limited to
 * WebFetch + WebSearch, WebFetch allowed on docs.aws.amazon.com / aws.amazon.com only (dontAsk denies anything else), no
 * file access, no write tool, no session kept; the verify model (sonnet fallback).
 */
export function groundedArgs(prompt: string, cfg: AppConfig): string[] {
  const model = modelFor('verify', cfg);
  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    // [v5 R3] no MCP server, not even an approved project .mcp.json (repo root = cwd): tools are exactly what follows
    '--strict-mcp-config',
    '--json-schema',
    JSON.stringify(GROUNDED_SCHEMA),
    '--tools',
    GROUNDED_TOOLS,
    '--permission-mode',
    'dontAsk',
    '--permission-prompts',
    'none',
    '--no-session-persistence',
    '--allowedTools',
    ...GROUNDED_ALLOWED,
  ];
  if (model && !/sonnet/i.test(model)) args.push('--fallback-model', 'sonnet');
  return tail(args, cfg, model);
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

export function readLock(): { pid: number; runId: string; bankWrites?: boolean } | undefined {
  try {
    const l = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) as { pid: number; runId: string; bankWrites?: boolean };
    if (l.pid && pidAlive(l.pid)) return l;
  } catch {
    // no lock
  }
  return undefined;
}

/**
 * Takes the coach lock atomically (`wx`: two processes starting together cannot both get it). A lock left by a dead
 * process is removed and the creation retried once; one that is being written right now (unreadable, < 10 s old)
 * counts as held. Throws the "busy" message otherwise.
 */
export function acquireLock(runId: string): void {
  fs.mkdirSync(COACH_DIR, { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, runId }), { flag: 'wx' });
      return;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    let held: { pid?: number; runId?: string } | undefined;
    try {
      held = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) as { pid?: number; runId?: string };
    } catch {
      const age = (() => {
        try {
          return Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
        } catch {
          return Infinity; // gone in between → retry
        }
      })();
      if (age < 10_000) throw new Error('Một tiến trình khác đang bắt đầu chạy coach — thử lại sau ít giây.');
    }
    // this process has no run (start() checked): a lock with our own pid is a leftover of a crashed run
    if (held?.pid && held.pid !== process.pid && pidAlive(held.pid)) throw new Error(`Một tiến trình khác (pid ${held.pid}) đang chạy coach: ${held.runId ?? '?'}`);
    try {
      fs.unlinkSync(LOCK_FILE); // stale: its process is gone
    } catch {
      // removed by someone else meanwhile
    }
  }
  throw new Error('Không tạo được khoá coach/.lock — thử lại.');
}

/** Rewrites the lock with the final run id — only while it is still ours. */
function updateLock(runId: string, extra: { bankWrites?: boolean } = {}): void {
  const l = readLock();
  if (l?.pid === process.pid) fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, runId, ...(extra.bankWrites ? { bankWrites: true } : {}) }));
}

/**
 * [v5 R3] A file-mode run (analyze, or any task with coach.structured_output: false) lets the AI edit packs in place; the
 * runner diffs the bank afterwards for "↩️ Hoàn tác". A learner change to the bank meanwhile would be taken for the AI's
 * and reverted by that undo — so bank-writing routes refuse while such a run holds the coach lock (any process).
 * Returns the Vietnamese reason, or undefined when writing is fine.
 */
export function bankWriteBlocked(): string | undefined {
  const l = readLock();
  return l?.bankWrites ? `AI đang sửa ngân hàng trực tiếp (lượt ${l.runId}) — đợi lượt chạy xong rồi thử lại.` : undefined;
}

/** Releases the lock only when it still holds this process and run (never someone else's lock). */
export function releaseLock(runId: string): void {
  try {
    const l = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) as { pid?: number; runId?: string };
    if (l.pid === process.pid && l.runId === runId) fs.unlinkSync(LOCK_FILE);
  } catch {
    // already gone
  }
}

/** Reserves coach/runs/<id>.json atomically (`wx`), adding -2, -3 … when two runs start within the same second. */
function reserveRunId(base: string): string {
  for (let n = 1; ; n++) {
    const id = n === 1 ? base : `${base}-${n}`;
    try {
      fs.writeFileSync(path.join(RUNS_DIR, `${id}.json`), '', { flag: 'wx' }); // empty = not a record yet (readRunInfos skips it)
      return id;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST' || n > 99) throw e;
    }
  }
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
    case 'StructuredOutput': {
      const n = (k: string) => (Array.isArray(input[k]) ? (input[k] as unknown[]).length : undefined);
      const parts = [n('items') !== undefined && `${n('items')} item`, n('questions') !== undefined && `${n('questions')} câu`, n('results') !== undefined && `${n('results')} câu đã giải`].filter(Boolean);
      return `→ kết quả JSON${parts.length ? ` (${parts.join(', ')})` : ''}`;
    }
    default:
      return short(JSON.stringify(input));
  }
}

/** [v5] params.skills → valid exam-guide bullet ids (lower-case, unique, ≤ 30); a malformed id is an input error. */
export function skillParam(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  const list = (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  const bad = list.filter((x) => !SKILL_ID_RE.test(x));
  if (bad.length) throw new Error(`params.skills: mục đề cương không hợp lệ ${bad.slice(0, 5).join(', ')} (dạng <task>.k<n> / <task>.s<n>, vd 3.5.s7)`);
  return [...new Set(list)].slice(0, 30);
}

const clampInt = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, n)) : dflt;
};

interface Prepared {
  params: Record<string, unknown>; // recorded with the run (UI, log)
  bases?: Record<string, string>; // enrich: question hash per batch id when the batch was written
}

/** Selects the questions (ENRICH batch, long-form originals, blind-solve targets) and writes the batch file. */
function prepare(task: CoachTask, runId: string, params: Record<string, unknown>, cfg: AppConfig, s: ReturnType<typeof stampParts>, structured: boolean): Prepared {
  const mode = structured ? { structured: true } : {};
  if (task === 'verify') {
    if (params.scope === 'grounded') {
      if (!cfg.coach.verify.grounded) throw new Error('Kiểm chứng có nguồn đang tắt (config.yaml → coach.verify.grounded: false).');
      const t = groundedTargets(loadBank(), { ids: params.ids });
      if (!t.ids.length) throw new NothingToDoError('Không có câu nào cần kiểm chứng bằng tài liệu AWS (hàng chờ trống hoặc đã kiểm cho phiên bản hiện tại) 🎉');
      return { params: { scope: 'grounded', ids: t.ids, count: t.ids.length, ...(t.total > t.ids.length ? { remaining: t.total - t.ids.length } : {}) } };
    }
    if (params.scope === 'audit') {
      const { bank, states, attempts, plans } = context();
      const t = auditTargets(bank, { upcoming: upcomingIds({ bank, states, attempts, plans, cfg }) });
      if (!t.ids.length) throw new NothingToDoError('Đã kiểm toán hết câu nhập (mỗi câu đã có kết quả giải mù cho phiên bản hiện tại) 🎉');
      return { params: { scope: 'audit', ids: t.ids, count: t.ids.length, ...(t.total > t.ids.length ? { remaining: t.total - t.ids.length } : {}) } };
    }
    if (params.scope === 'cues') {
      // [v6] choices-only cue probe: explicit ids / a pack, else the exam-grade AI questions not probed for their version
      const t = cueTargets(loadBank(), params, { since: cfg.quality.exam_spec_since });
      if (!t.ids.length) throw new NothingToDoError('Không có câu nào cần dò phương án lộ đáp án (câu AI mới đều đã dò cho phiên bản hiện tại) 🎉');
      return { params: { scope: 'cues', ids: t.ids, count: t.ids.length, ...(t.total > t.ids.length ? { remaining: t.total - t.ids.length } : {}) } };
    }
    const t = verifyTargets(loadBank(), params);
    if (!t.ids.length) throw new NothingToDoError('Không có câu nào cần giải mù (mọi câu trong phạm vi này đã có kết quả cho phiên bản hiện tại) 🎉');
    return { params: { ids: t.ids, count: t.ids.length, ...(t.total > t.ids.length ? { remaining: t.total - t.ids.length } : {}) } };
  }
  if (task === 'generate') {
    const skills = skillParam(params.skills);
    if (!skills.length) return { params: mode };
    return { params: { skills, count: clampInt(params.count, 1, MAX_NEW_QUESTIONS, Math.min(MAX_NEW_QUESTIONS, Math.max(3, 2 * skills.length))), ...mode } };
  }
  if (task !== 'enrich' && task !== 'longform' && task !== 'twins' && task !== 'family') return { params: mode };
  const { bank, states, attempts, plans } = context();
  const hhmm = s.time.slice(0, 4);
  const packPlan = (word: string, ids: string) => ({
    packFile: `${repoRel(path.join(PACKS_DIR, 'ai'))}/${s.date}-${hhmm}-${word}-<slug>.md`,
    packId: `ai-${s.date}-${hhmm}-${word}`,
    idPrefix: `ai-${s.compact}-${hhmm}-${ids}`,
  });
  if (task === 'twins') {
    const kind = params.kind === undefined ? undefined : (TWIN_KINDS as readonly unknown[]).includes(params.kind) ? (params.kind as TwinKind) : undefined;
    if (params.kind !== undefined && !kind) throw new Error(`params.kind phải là ${TWIN_KINDS.join(' | ')}`);
    const ids = idList(params.ids);
    if (params.ids !== undefined && !ids.length) throw new Error('params.ids phải là danh sách id câu hỏi');
    const targets = twinsTargets(bank, states, { count: clampInt(params.count, 1, MAX_TWINS, clampInt(cfg.coach.twins_per_run, 1, MAX_TWINS, 10)), ids, kind });
    if (!targets.length) {
      throw new NothingToDoError(
        ids.length ? 'Không có câu nào trong danh sách viết được câu song sinh (câu niêm phong, ngoài phạm vi, retired hoặc nháp).' : 'Không có câu nào cần câu song sinh lúc này (câu sắp ôn đều đã có câu anh em chưa gặp) 🎉',
      );
    }
    const plan = { count: targets.length, ...packPlan('twins', 'tw') };
    const file = writeTwinsFile(runId, targets, bank, plan);
    return {
      params: { count: plan.count, batch: repoRel(file), packFile: plan.packFile, packId: plan.packId, idPrefix: plan.idPrefix, ids: targets.map((t) => t.q.id), kinds: Object.fromEntries(targets.map((t) => [t.q.id, t.kind])), ...mode },
    };
  }
  if (task === 'family') {
    const focus = familyFocus(params, bank);
    const count = clampInt(params.count, 1, MAX_FAMILIES, 2);
    const plan = { count, ...packPlan('family', 'fa'), familyPrefix: `ai-${s.compact}-${hhmm}-f` };
    let weak: Bucket[] = [];
    try {
      weak = (contextStats().byRequirement ?? []).filter((b) => b.attempts > 0 && b.key !== 'none' && b.key !== 'negative');
    } catch {
      // stats unavailable: the batch just has no learner lines
    }
    const file = writeFamilyFile(runId, bank, plan, focus, familySeeds(bank, focus), weak);
    return { params: { count, batch: repoRel(file), packFile: plan.packFile, packId: plan.packId, idPrefix: plan.idPrefix, familyPrefix: plan.familyPrefix, ...focus, ...mode } };
  }
  if (task === 'enrich') {
    const { todos, examTasks } = parseTasks(params.tasks);
    const ids = idList(params.ids);
    if (params.ids !== undefined && !ids.length) throw new Error('params.ids phải là danh sách id câu hỏi');
    const size = clampInt(params.size, 1, MAX_BATCH, clampInt(cfg.coach.enrich_batch_size, 1, MAX_BATCH, 20));
    const wantsDistractors = todos.includes('distractors');
    const report = wantsDistractors ? distractorReport(bank, attempts) : undefined;
    const onlyUpcoming = params.upcoming === true; // follow-up of an analyze run (coach.enrich_after_analyze)
    const upcoming = ids.length ? [] : upcomingIds({ bank, states, attempts, plans, cfg });
    const items = selectBatch(bank, states, { size, tasks: params.tasks, ids, report, upcoming, onlyUpcoming });
    if (!items.length) {
      throw new NothingToDoError(
        ids.length
          ? 'Không có câu nào để ENRICH trong danh sách (id không tồn tại hoặc câu đã retired).'
          : onlyUpcoming
            ? 'Các câu bạn sắp gặp đều đã được ENRICH 🎉'
            : `Không còn câu nào cần ENRICH (${[...todos, ...examTasks].join(', ')}) 🎉`,
      );
    }
    const soon = items.filter((i) => i.tier === 'upcoming').length;
    const note = typeof (params.note ?? params.reason) === 'string' ? String(params.note ?? params.reason).replace(/\s+/g, ' ').trim().slice(0, 300) : '';
    const file = writeBatchFile(runId, items, bank, {
      todos,
      notes: learnerNotes(attempts, items.map((i) => i.q.id)),
      report,
      stats: wantsDistractors ? optionStats(bank, attempts) : undefined,
      verdicts: latestVerdicts(bank),
      mode: structured ? 'json' : 'files',
      note: note || undefined,
    });
    return {
      params: {
        size: items.length,
        tasks: [...todos, ...examTasks],
        batch: repoRel(file),
        patch: repoRel(patchPath(runId)),
        ids: items.map((i) => i.q.id),
        ...(soon ? { upcomingItems: soon } : {}), // questions of the batch the learner is about to meet
        ...(note ? { note } : {}),
        ...mode,
      },
      bases: Object.fromEntries(items.map((i) => [i.q.id, i.q.hash])),
    };
  }
  const count = clampInt(params.count, 1, MAX_LONGFORM, 5);
  const skills = skillParam(params.skills);
  const idle = params.idle === true; // scheduled idle run: only tasks still short of exam-like questions
  let deficits: ReturnType<typeof taskDeficits> = [];
  try {
    deficits = taskDeficits(bank);
  } catch {
    // exam guide unavailable: plain scoring
  }
  const targets = longformTargets(bank, states, count, undefined, { skills, deficits, deficitOnly: idle });
  if (!targets.length) {
    throw new NothingToDoError(
      skills.length
        ? 'Không có câu ngắn nào thuộc các mục đề cương này để viết bản dài — dùng ✨ Sinh câu (generate) cho mục còn trống.'
        : idle
          ? 'Mọi task đã đủ câu dài chuẩn đề (quality.longform_target_per_task) — không cần sinh thêm 🎉'
          : 'Không còn câu ngắn nào cần biến thể dài (mọi câu đã có bản dài hoặc đủ 3 biến thể).',
    );
  }
  const plan = { count: targets.length, ...packPlan('longform', 'lf') };
  let bullets: { id: string; text: string }[] = skills.map((id) => ({ id, text: '' }));
  try {
    const text = new Map(loadExamGuide().bullets.map((b) => [b.id, b.text]));
    bullets = skills.map((id) => ({ id, text: text.get(id) ?? '' }));
  } catch {
    // ids only
  }
  const file = writeLongformFile(runId, targets, bank, plan, bullets);
  return {
    params: { count: plan.count, batch: repoRel(file), packFile: plan.packFile, packId: plan.packId, idPrefix: plan.idPrefix, ids: targets.map((t) => t.q.id), ...(skills.length ? { skills } : {}), ...(idle ? { idle } : {}), ...mode },
  };
}

/** Stale-fact lint messages of a question (taxonomy `currency:`). */
function staleFlaws(q: Question, bank: BankState): string[] {
  try {
    return lintQuestion(q, bank.taxonomy)
      .filter((f) => f.code === 'stale-fact')
      .map((f) => f.message);
  } catch {
    return [];
  }
}

/** Question id → content hash (what a run may change: stem, options, key). */
function hashes(bank: BankState): Map<string, string> {
  return new Map(bank.questions.map((q) => [q.id, q.hash]));
}

/** Questions a run added or whose stem / options / key changed (retired ones excluded). */
export function changedSince(before: Map<string, string>, bank: BankState): string[] {
  return bank.questions.filter((q) => q.status !== 'retired' && before.get(q.id) !== q.hash).map((q) => q.id);
}

/** Atomic write: readRunInfos keys its cache on the directory mtime, which a rename always bumps. */
function saveRunInfo(info: RunInfo): void {
  const tmp = path.join(RUNS_DIR, `.${info.id}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(info, null, 2));
  fs.renameSync(tmp, path.join(RUNS_DIR, `${info.id}.json`));
}

interface PhaseResult {
  spawned: boolean;
  code: number | null;
  signal: NodeJS.Signals | null;
  result?: Record<string, unknown>; // the final {"type":"result"} line
  sessionId?: string;
  model?: string; // system/init
  error?: string; // spawn error / timeout
  toolUsed?: boolean; // the AI called a tool (files may have been written) — never start this phase over
  stderrTail?: string; // last stderr lines (transient-error detection)
}

/** A phase that did not end with a successful result line. */
const phaseFailed = (r: PhaseResult) => !!r.error || !r.result || !!r.result.is_error || (typeof r.result.subtype === 'string' && r.result.subtype !== 'success');

type PhaseKind = 'main' | 'repair' | 'verify';

/** Everything one run needs while it goes through its phases. `info.status` stays 'running' until finish(). */
interface RunState {
  info: RunInfo;
  cfg: AppConfig;
  claudePath: string;
  version?: string;
  structured: boolean;
  bases?: Record<string, string>;
  emit: (kind: CoachEvent['kind'], text: string) => void;
  raw: fs.WriteStream;
  evOut: fs.WriteStream;
  run: NonNullable<CoachRunner['current']>;
  deadline: number;
  result: 'success' | 'error'; // outcome so far
  opts: StartOptions;
}

const sizeLabel = (info: RunInfo) => {
  const p = info.params ?? {};
  if (info.task === 'enrich') return ` · ${String(p.size)} câu`;
  if (info.task === 'family') return ` · ${String(p.count)} họ`;
  if (info.task === 'verify') return ` · ${String(p.count)} câu${p.scope === 'grounded' ? ' · 🔗 kiểm chứng tài liệu AWS' : p.scope === 'audit' ? ' · 🧾 kiểm toán câu nhập' : p.scope === 'cues' ? ' · 🎯 dò phương án lộ đáp án' : ''}`;
  return info.task === 'longform' || info.task === 'twins' ? ` · ${String(p.count)} câu` : '';
};

const stemLabel = (raw: unknown) => {
  const s = raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).stem === 'string' ? ((raw as Record<string, unknown>).stem as string) : '';
  const t = s.replace(/\s+/g, ' ').trim();
  return t ? `“${t.length > 70 ? t.slice(0, 69) + '…' : t}”` : undefined;
};

export class CoachRunner extends EventEmitter {
  current?: { info: RunInfo; child?: ChildProcess; events: CoachEvent[]; wake?: () => void }; // no child while syncing / between phases; wake ends a retry wait

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

  /**
   * Checks and records the run synchronously (refusals and NothingToDoError are thrown to the caller), then goes on in
   * the background: sync (sync.before_ai) → snapshot (analyze) → Claude Code CLI → checks (+ repair round) → blind-solve
   * phase → sync (sync.after_ai, only after a success) → 'done'. The coach lock is held from start to end, so both
   * syncs pass `force`.
   */
  start(task: CoachTask, trigger: CoachRunInfo['trigger'], params: Record<string, unknown> = {}, opts: StartOptions = {}): RunInfo {
    const blocked = coachGuard();
    if (blocked) throw new Error(blocked);
    if (!COACH_TASKS.includes(task)) throw new Error(`Tác vụ không hợp lệ: ${String(task)}`);
    if (this.current) throw new Error(`Đang có lượt chạy ${this.current.info.id}`);
    const cfg = loadConfig();
    let claude = findClaude(cfg);
    if (!claude.available) claude = findClaude(cfg, true); // installed since the last check?
    if (!claude.available || !claude.path) throw new Error(claude.hint ?? 'Claude Code CLI not found');
    if (task === 'verify' && !versionAtLeast(claude.version, MODERN_CLI)) {
      throw new Error(`Giải mù cần Claude Code ≥ ${MODERN_CLI.join('.')} (đang có ${claude.version ?? '?'}) — cập nhật Claude Code rồi thử lại.`);
    }
    const structured = isStructured(task, cfg, claude.version);

    // lock first (atomic: another process starting at the same moment gets "busy"), then reserve a unique run id
    const s = stampParts();
    const baseId = `${s.date}_${s.time}_${task}`;
    acquireLock(baseId);
    let id = baseId;
    let reserved = false;
    let prep: Prepared;
    try {
      fs.mkdirSync(RUNS_DIR, { recursive: true });
      id = reserveRunId(baseId);
      reserved = true;
      updateLock(id, { bankWrites: !structured && task !== 'verify' }); // [R3] file mode: learner bank writes wait (bankWriteBlocked)
      prep = prepare(task, id, params, cfg, s, structured);
    } catch (e) {
      // refused before the run exists (nothing to do, bad params): give the run id and the lock back
      if (reserved) fs.rmSync(path.join(RUNS_DIR, `${id}.json`), { force: true });
      releaseLock(id);
      releaseLock(baseId);
      throw e;
    }
    const info: RunInfo = { id, task, trigger, status: 'running', startedAt: localIso(), params: { ...params, ...prep.params } };
    const raw = fs.createWriteStream(path.join(RUNS_DIR, `${id}.raw.jsonl`));
    const evOut = fs.createWriteStream(path.join(RUNS_DIR, `${id}.events.jsonl`));
    const events: CoachEvent[] = [];
    const run: NonNullable<CoachRunner['current']> = { info, events };
    this.current = run;
    saveRunInfo(info);

    const emit = (kind: CoachEvent['kind'], text: string) => {
      const ev: CoachEvent = { runId: id, at: new Date().toISOString(), kind, text };
      events.push(ev);
      evOut.write(JSON.stringify(ev) + '\n');
      this.emit('event', ev);
    };
    const model = task === 'verify' && params.scope === 'cues' ? probeModel(cfg) : modelFor(task, cfg); // [v6] the probe has its own model
    const shownPath = claude.path.startsWith(os.homedir() + path.sep) ? `~/${rel(claude.path, os.homedir())}` : claude.path;
    emit('start', `${TASK_LABEL[task]}${sizeLabel(info)} · Claude Code ${claude.version?.split(' ')[0] ?? ''}${model ? ` · model ${model}` : ''}${structured ? ' · JSON' : ''} · ${shownPath}`);
    if (info.params?.batch) emit('start', `Lô câu hỏi: ${String(info.params.batch)}`);

    const st: RunState = { info, cfg, claudePath: claude.path, version: claude.version, structured, bases: prep.bases, emit, raw, evOut, run, deadline: Date.now() + RUN_TIMEOUT_MS, result: 'error', opts };
    void this.execute(st, params, s);
    return info;
  }

  private fail(st: RunState, message: string) {
    st.result = 'error';
    st.info.error = message;
    st.emit('error', message);
  }

  private async execute(st: RunState, params: Record<string, unknown>, s: ReturnType<typeof stampParts>) {
    const { info, cfg, emit } = st;
    const task = info.task;
    try {
      if (st.opts.syncBefore ?? cfg.sync.before_ai) {
        emit('tool', '⇅ Đang đồng bộ với GitHub trước khi chạy AI…');
        const note = await syncForAi('before', { force: true });
        info.sync = { before: note };
        emit(note.ok ? 'result' : 'stderr', aiSyncLine(note));
        if (info.status !== 'running') return await this.finish(st); // cancelled while syncing
        if ((note.received || note.migrated) && (task === 'enrich' || task === 'longform' || task === 'verify' || task === 'twins')) {
          // the other machine may already have worked on some of these questions → choose them again
          try {
            const prep = prepare(task, info.id, params, cfg, s, st.structured);
            info.params = { ...params, ...prep.params };
            st.bases = prep.bases;
            saveRunInfo(info);
            emit('tool', `Chọn lại câu hỏi sau khi đồng bộ${sizeLabel(info)}${info.params.batch ? `: ${String(info.params.batch)}` : ''}`);
          } catch (e) {
            if (e instanceof NothingToDoError) {
              info.status = 'skipped';
              info.summary = e.message;
              emit('result', e.message);
            } else this.fail(st, (e as Error).message);
            return await this.finish(st);
          }
        }
      }
      const ids = Array.isArray(info.params?.ids) ? (info.params!.ids as string[]) : [];
      if (task === 'verify' && info.params?.scope === 'grounded') await this.groundedPhase(st, ids, {});
      else if (task === 'verify' && info.params?.scope === 'audit') await this.auditPhase(st, ids);
      else if (task === 'verify' && info.params?.scope === 'cues') await this.cuePhase(st, ids);
      else if (task === 'verify') await this.verifyPhase(st, ids, new Set());
      else await this.mainPhase(st);
    } catch (e) {
      this.fail(st, (e as Error).message);
    }
    await this.finish(st);
  }

  /** The task itself (+ checks, repair round) and, after a success, the blind-solve phase over what it changed. */
  private async mainPhase(st: RunState) {
    const { info, cfg, emit } = st;
    const task = info.task;
    if (task === 'analyze') {
      // written here, after the sync, so it includes the results that just arrived from the other machine
      try {
        const snap = writeSnapshot(loadBank(), cfg);
        emit('tool', `Snapshot: ${String(snap.attempts)} bài / ${String(snap.answers)} câu trả lời`);
      } catch (e) {
        emit('stderr', `Không cập nhật được snapshot: ${(e as Error).message}`);
      }
    }
    const bankBefore = loadBank();
    const before = hashes(bankBefore);
    // [v5] file mode: the AI may edit packs in place — keep every block so "↩️ Hoàn tác" can restore what it changed
    let blocks: Map<string, CapturedBlock> | undefined;
    if (!st.structured) {
      try {
        blocks = captureBlocks(bankBefore);
      } catch (e) {
        emit('stderr', `Không lưu được bản trước khi chạy (↩️ hoàn tác sẽ thiếu): ${(e as Error).message}`);
      }
    }
    const params = info.params ?? {};
    const args = st.structured
      ? structuredArgs(buildJsonPrompt(task as StructuredTask, info.id, info.trigger, params), cfg, task as StructuredTask)
      : cliArgs(buildPrompt(task, info.id, info.trigger, params), cfg, st.version, task);
    const main = await this.runMainWithRetry(st, args);
    if (blocks && main.spawned) {
      try {
        const d = recordRunDiff(info.id, blocks, loadBank(), task);
        if (d.changed.length || d.created.length) emit('tool', `↩️ Đã lưu bản trước khi sửa: ${d.changed.length} câu sửa · ${d.created.length} câu mới (Coach → Hoàn tác)`);
      } catch (e) {
        emit('stderr', `Không ghi được bản lưu hoàn tác: ${(e as Error).message}`);
      }
    }
    if (info.status !== 'running') return; // cancelled
    this.settle(st, main);
    if (st.structured) {
      if (main.result && st.result === 'success') await this.structuredPost(st, task as StructuredTask, main);
    } else if (main.spawned) {
      // the AI wrote the files itself: re-check them (also after a failed run — a patch may still be there)
      try {
        this.postProcess(st);
      } catch (e) {
        emit('error', `Kiểm tra sau lượt chạy thất bại: ${(e as Error).message}`);
      }
    }
    if (info.status !== 'running' || st.result !== 'success' || !cfg.coach.verify.auto) return;
    const changed = changedSince(before, loadBank());
    if (!changed.length) return;
    if (!versionAtLeast(st.version, MODERN_CLI)) {
      emit('stderr', `Bỏ qua giải mù tự động: cần Claude Code ≥ ${MODERN_CLI.join('.')}.`);
      return;
    }
    emit('tool', `🧪 ${changed.length} câu mới / vừa sửa đề, lựa chọn hoặc đáp án → giải mù tự động (coach.verify.auto)`);
    await this.verifyPhase(st, changed, new Set(changed));
  }

  /** Main-phase result → run outcome so far (error / success) and summary. */
  private settle(st: RunState, main: PhaseResult) {
    const { info } = st;
    const r = main.result;
    const text = typeof r?.result === 'string' ? r.result.trim() : '';
    if (main.error) {
      st.result = 'error';
      info.error = main.error;
    } else if (r) {
      if (r.is_error || (typeof r.subtype === 'string' && r.subtype !== 'success')) {
        // API / login errors keep subtype "success" (is_error: true): the reason is the result text
        st.result = 'error';
        info.error = (text || String(r.subtype ?? 'error')).slice(0, 1000);
      } else {
        st.result = 'success';
        if (text && !st.structured) info.summary = text.slice(0, 4000);
      }
    } else {
      st.result = 'error';
      info.error = `CLI exited with code ${main.code}`;
    }
    if (st.result === 'error' && isAuthError(info.error)) st.emit('stderr', AUTH_HINT);
  }

  /**
   * The main CLI call, started over once (RETRY) after a transient failure (login race, overloaded API) — only while
   * that attempt has not called a tool, so nothing can have been written yet. Cancel / timeout end the wait.
   */
  private async runMainWithRetry(st: RunState, args: string[]): Promise<PhaseResult> {
    for (let attempt = 1; ; attempt++) {
      const r = await this.runPhase(st, args, 'main');
      const why = `${r.error ?? ''}\n${typeof r.result?.result === 'string' ? r.result.result : ''}\n${r.stderrTail ?? ''}`;
      const retry =
        st.info.status === 'running' && phaseFailed(r) && !r.toolUsed && !r.signal && r.error !== 'timeout' && attempt < RETRY.attempts && Date.now() + RETRY.delayMs < st.deadline && isTransientCliError(why);
      if (!retry) return r;
      st.emit('stderr', `Lỗi tạm thời của Claude Code — tự thử lại sau ${Math.round(RETRY.delayMs / 1000)} giây (lần ${attempt + 1}/${RETRY.attempts}).`);
      await new Promise<void>((resolve) => {
        const wake = () => {
          clearTimeout(timer);
          st.run.wake = undefined;
          resolve();
        };
        const timer = setTimeout(wake, RETRY.delayMs);
        st.run.wake = wake;
      });
      if (st.info.status !== 'running') return r; // cancelled while waiting
    }
  }

  /** One CLI call: streams its events into the run log; resolves when the process is gone (never rejects). */
  private runPhase(st: RunState, args: string[], kind: PhaseKind, deadline = st.deadline): Promise<PhaseResult> {
    return new Promise((resolve) => {
      const out: PhaseResult = { spawned: false, code: null, signal: null };
      let done = false;
      let timer: NodeJS.Timeout | undefined;
      const end = () => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        st.run.child = undefined;
        resolve(out);
      };
      const { cmd, pre } = claudeCommand(st.claudePath);
      let child: ChildProcess;
      try {
        child = spawn(cmd, [...pre, ...args], { cwd: REPO_DIR, env: cliEnv(st.cfg), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      } catch (e) {
        out.error = (e as Error).message;
        st.emit('error', out.error);
        return end();
      }
      out.spawned = true;
      st.run.child = child;
      let buf = '';
      const onLine = (line: string) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(line);
        } catch {
          st.emit('text', line.slice(0, 500));
          return;
        }
        this.handleMessage(msg, st, out, kind);
      };
      child.stdout!.on('data', (chunk: Buffer) => {
        st.raw.write(chunk);
        buf += chunk.toString('utf8');
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) onLine(line);
        }
      });
      child.stderr!.on('data', (chunk: Buffer) => {
        const t = chunk.toString('utf8').trim();
        if (!t) return;
        out.stderrTail = `${out.stderrTail ?? ''}\n${t}`.slice(-2000);
        st.emit('stderr', t.slice(0, 1000));
      });
      timer = setTimeout(
        () => {
          out.error = 'timeout';
          st.emit('error', `⏱ Quá ${fmtLimit(kind === 'verify' ? VERIFY_TIMEOUT_MS : RUN_TIMEOUT_MS)} — dừng ${kind === 'verify' ? 'lượt giải mù này' : 'lượt chạy'}.`);
          child.kill('SIGTERM');
        },
        Math.max(1000, deadline - Date.now()),
      );
      child.on('error', (e) => {
        out.error = e.message;
        st.emit('error', e.message);
        end();
      });
      child.on('close', (code, signal) => {
        if (buf.trim()) onLine(buf.trim());
        out.code = code;
        out.signal = signal;
        end();
      });
    });
  }

  private handleMessage(msg: Record<string, unknown>, st: RunState, out: PhaseResult, kind: PhaseKind) {
    const { info, emit } = st;
    const type = msg.type;
    if (type === 'system' && msg.subtype === 'init') {
      if (typeof msg.model === 'string') {
        out.model = msg.model;
        if (kind === 'main' || (info.task === 'verify' && !info.model)) info.model = msg.model;
      }
      if (typeof msg.session_id === 'string') out.sessionId = msg.session_id;
      if (kind === 'main') emit('start', `Model: ${String(msg.model ?? '?')} · permission: ${String(msg.permissionMode ?? '?')}`);
      return;
    }
    if (type === 'assistant') {
      if (msg.is_api_error_message) return; // the same text arrives in the result message
      const content = ((msg.message as { content?: unknown[] })?.content ?? []) as Record<string, unknown>[];
      for (const c of content) {
        if (c.type === 'text' && typeof c.text === 'string' && c.text.trim()) emit('text', c.text.trim().slice(0, 1500));
        if (c.type === 'tool_use') {
          out.toolUsed = true;
          emit('tool', `${String(c.name)} ${summarizeInput(String(c.name), (c.input ?? {}) as Record<string, unknown>)}`);
        }
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
      out.result = msg;
      if (typeof msg.session_id === 'string') out.sessionId = msg.session_id;
      if (typeof msg.total_cost_usd === 'number') info.costUsd = round4((info.costUsd ?? 0) + msg.total_cost_usd);
      const failed = !!msg.is_error || (typeof msg.subtype === 'string' && msg.subtype !== 'success');
      const denials = Array.isArray(msg.permission_denials) ? msg.permission_denials.length : 0;
      if (denials) {
        const rules = st.structured || kind === 'verify' ? 'chế độ chỉ đọc' : allowedTools(info.task).filter((t) => /^(Edit|Bash)/.test(t)).join(', ');
        emit('stderr', `${denials} thao tác bị chặn bởi quyền hạn (${rules}).`);
      }
      if (failed) {
        // API / login errors come as subtype "success" + is_error: show only the reason then
        const sub = msg.subtype && msg.subtype !== 'success' ? String(msg.subtype) : '';
        const why = typeof msg.result === 'string' ? msg.result.slice(0, 300) : '';
        emit('error', `Claude Code báo lỗi: ${[sub, why].filter(Boolean).join(' — ') || 'error'}`);
      }
      else if (kind === 'main' && !st.structured) emit('result', typeof msg.result === 'string' && msg.result ? msg.result.slice(0, 4000) : '(không có tóm tắt)');
    }
  }

  // ── structured output: check, repair once, write ──────────────────────────

  private canRepair(st: RunState, main: PhaseResult): boolean {
    return !!main.sessionId && st.info.status === 'running' && Date.now() < st.deadline;
  }

  /** `--resume` with the failures per id; undefined when cancelled. */
  private async repairPhase(st: RunState, task: StructuredTask, main: PhaseResult, failures: ItemFailure[]): Promise<PhaseResult | undefined> {
    st.emit('start', `🔧 Vòng sửa lỗi: gửi lại ${failures.length} ${task === 'enrich' ? 'item' : 'câu'} bị từ chối cho Claude (--resume)…`);
    const r = await this.runPhase(st, structuredArgs(repairPrompt(task, st.info.id, failures), st.cfg, task, { resume: main.sessionId }), 'repair');
    if (st.info.status !== 'running') return undefined;
    if (!structuredOutput(r.result)) st.emit('stderr', `Vòng sửa lỗi không trả JSON hợp lệ${r.error ? ` (${r.error})` : ''} — giữ kết quả lần đầu.`);
    return r;
  }

  private async structuredPost(st: RunState, task: StructuredTask, main: PhaseResult) {
    const out = structuredOutput(main.result);
    if (typeof out?.summary === 'string' && out.summary.trim()) st.info.summary = out.summary.trim().slice(0, 4000);
    if (!out) st.emit('stderr', 'Claude không trả JSON hợp lệ (structured_output) — yêu cầu trả lại.');
    if (task === 'enrich') await this.enrichJson(st, main, out);
    else if (task === 'family') await this.familyJson(st, main, out);
    else await this.packJson(st, task, main, out);
  }

  private static patchFailures(r: PatchResult, missing: ItemFailure[]): ItemFailure[] {
    return [...missing, ...r.items.filter((i) => i.status === 'failed').map((i) => ({ id: i.id, errors: i.errors }))];
  }

  /** ENRICH: JSON items → coach/patches/<runId>.yaml → applyPatch; failed / missing items get one repair round. */
  private async enrichJson(st: RunState, main: PhaseResult, out: Record<string, unknown> | undefined) {
    const { info, emit } = st;
    const bases = st.bases ?? {};
    const ids = Object.keys(bases);
    const file = patchPath(info.id);
    const first = enrichItems(out, bases);
    let items = first.items;
    if (first.ignored.length) emit('stderr', `Bỏ qua ${first.ignored.length} item không thuộc lô: ${first.ignored.slice(0, 5).join(', ')}`);
    writePatchFile(file, info.id, items);
    let r = applyPatch(file);
    let fails = CoachRunner.patchFailures(r, first.failures);
    emit('tool', `Kiểm tra JSON: ${r.applied + r.unchanged}/${ids.length} item hợp lệ${r.skipped ? ` · ${r.skipped} bỏ qua (base)` : ''}${fails.length ? ` · ${fails.length} bị từ chối` : ''}`);
    let repaired = 0;
    if (fails.length && this.canRepair(st, main)) {
      for (const f of fails.slice(0, 10)) emit('stderr', `❌ ${f.id}: ${f.errors.join(' | ')}`);
      const rep = await this.repairPhase(st, 'enrich', main, fails);
      if (info.status !== 'running') return; // cancelled during the repair round: keep what round 1 applied, nothing more
      const out2 = structuredOutput(rep?.result);
      if (out2) {
        const merged = mergeRepaired(items, out2, fails.map((f) => f.id), bases);
        items = merged.items;
        writePatchFile(file, info.id, items); // audit trail = the final items
        // apply ONLY the repaired items: the others are already in the bank (re-applying them is never needed)
        const fixed = new Set(merged.fixed);
        const r2 = applyPatchItems(
          items.filter((it) => fixed.has(String(it.id))),
          { label: repoRel(file), runId: info.id, ledgerFile: ledgerPath(file) },
        );
        r = combineResults(r, r2);
        const after = CoachRunner.patchFailures(r, enrichItems({ items }, bases).failures);
        const still = new Set(after.map((f) => f.id));
        repaired = fails.filter((f) => !still.has(f.id)).length;
        fails = after;
      }
    }
    const inPatch = new Set(r.items.map((i) => i.id));
    const missing = ids.filter((x) => !inPatch.has(x));
    const updated = r.applied + r.unchanged;
    info.outcome = {
      ...info.outcome,
      structured: true,
      patch: repoRel(file),
      updated,
      skipped: r.skipped,
      failed: r.failed + (r.error ? 1 : 0),
      missing,
      repaired,
      rejected: fails.map((f) => ({ id: f.id, errors: f.errors })),
    };
    if (r.error) emit('stderr', `❌ ${r.error}`);
    for (const it of r.items) if (it.status === 'failed' || it.status === 'skipped') emit('stderr', `${it.status === 'skipped' ? '⏭' : '❌'} ${it.id}: ${it.errors.join(' | ')}`);
    emit(
      'result',
      `Patch ${repoRel(file)}: ${updated}/${ids.length} câu đã cập nhật${repaired ? ` (${repaired} nhờ vòng sửa lỗi)` : ''}${r.skipped ? ` · ${r.skipped} bỏ qua` : ''}${r.failed ? ` · ${r.failed} lỗi` : ''}${missing.length ? ` · ${missing.length} câu thiếu` : ''}`,
    );
    if (!updated && ids.length) {
      st.result = 'error';
      info.error = 'no item applied';
    }
  }

  /** Pack target of a structured pack task from the run params. */
  private static packTarget(info: RunInfo, task: PackTask): PackTarget {
    const p = info.params ?? {};
    const today = localDateKey(new Date());
    const skills = Array.isArray(p.skills) ? p.skills.map(String) : undefined;
    if (task === 'generate') return { kind: 'generate', runId: info.id, today, sources: Array.isArray(p.sources) ? p.sources.map(String) : [], slug: typeof p.slug === 'string' ? p.slug : undefined, skills };
    return {
      kind: task,
      runId: info.id,
      today,
      packFile: String(p.packFile ?? ''),
      packId: String(p.packId ?? ''),
      idPrefix: String(p.idPrefix ?? ''),
      originals: Array.isArray(p.ids) ? p.ids.map(String) : [],
      batch: typeof p.batch === 'string' ? p.batch : undefined,
      skills,
      ...(p.kinds && typeof p.kinds === 'object' ? { twinKinds: p.kinds as Record<string, TwinKind> } : {}),
      ...(typeof p.familyPrefix === 'string' ? { familyPrefix: p.familyPrefix } : {}),
    };
  }

  /** Exam-guide bullet ids (empty when the guide is not loaded: only the id format is checked). */
  private static knownSkills(): Set<string> {
    try {
      return new Set(loadExamGuide().bullets.map((b) => b.id));
    } catch {
      return new Set();
    }
  }

  /** generate / longform / twins: JSON questions → checked drafts → one repair round → the new pack (valid questions only). */
  private async packJson(st: RunState, task: Exclude<PackTask, 'family'>, main: PhaseResult, first: Record<string, unknown> | undefined) {
    const { info, emit } = st;
    const target = CoachRunner.packTarget(info, task);
    const today = target.today;
    const knownSkills = CoachRunner.knownSkills();
    const bank = loadBank();
    let plan = planPack(target, first, bank);
    interface Entry {
      id: string;
      raw: unknown;
      draft?: QuestionDraft;
      errors: string[];
      warnings: string[];
    }
    const check = (raw: unknown, id: string): Entry => {
      const d = draftOf(raw, id, { tax: bank.taxonomy, today, kind: task, originals: target.originals, bank, skills: target.skills, knownSkills });
      if (!d.draft) return { id, raw, errors: d.errors, warnings: d.warnings };
      const c = checkDraft(d.draft, plan, bank);
      const errors = [...c.errors];
      const warnings = [...d.warnings, ...c.warnings];
      if (task === 'twins') {
        const orig = d.draft.variantOf?.[0];
        const kind = target.twinKinds?.[orig ?? ''] ?? 'surface';
        const t = twinChecks(d.draft, orig ? bank.byId.get(orig) : undefined, kind, raw && typeof raw === 'object' ? (raw as Record<string, unknown>).kind : undefined);
        errors.push(...t.errors);
        warnings.push(...t.warnings);
      }
      return { id, raw, draft: d.draft, errors, warnings };
    };
    // twins: one sibling per original — a second one for the same original is rejected
    const dedupe = (es: Entry[]) => {
      if (task !== 'twins') return es;
      const seen = new Set<string>();
      return es.map((e) => {
        const o = e.draft?.variantOf?.[0];
        if (!o || e.errors.length) return e;
        if (seen.has(o)) return { ...e, draft: undefined, errors: [`câu gốc ${o} đã có một câu song sinh trong lượt này — mỗi câu gốc một câu`] };
        seen.add(o);
        return e;
      });
    };
    const build = (o: Record<string, unknown> | undefined) => dedupe((Array.isArray(o?.questions) ? (o!.questions as unknown[]) : []).slice(0, MAX_NEW_QUESTIONS).map((raw, i) => check(raw, plan.idOf(i))));
    const failuresOf = (es: Entry[]): ItemFailure[] => es.filter((e) => e.errors.length).map((e) => ({ id: e.id, errors: e.errors, label: stemLabel(e.raw), warnings: examSpecWarnings(e.warnings) }));
    let entries = build(first);
    let fails = entries.length ? failuresOf(entries) : [{ id: '(tất cả)', errors: ['không có câu hỏi nào trong JSON (`questions` rỗng hoặc thiếu)'] }];
    emit('tool', `Kiểm tra JSON: ${entries.length - failuresOf(entries).length}/${entries.length} câu hợp lệ${fails.length ? ` · ${fails.length} bị từ chối` : ''}`);
    let repaired = 0;
    if (fails.length && this.canRepair(st, main)) {
      for (const f of fails.slice(0, 10)) emit('stderr', `❌ ${f.id}${f.label ? ` ${f.label}` : ''}: ${f.errors.join(' | ')}`);
      const rep = await this.repairPhase(st, task, main, fails);
      if (info.status !== 'running') return; // cancelled during the repair round: write nothing
      const out2 = structuredOutput(rep?.result);
      if (out2 && !entries.length) {
        if (typeof out2.summary === 'string' && out2.summary.trim()) info.summary = out2.summary.trim().slice(0, 4000);
        plan = planPack(target, out2, bank);
        entries = build(out2);
        repaired = entries.length - failuresOf(entries).length;
      } else if (out2) {
        const failed = new Set(fails.map((f) => f.id));
        const byId = new Map<string, unknown>();
        const unnamed: unknown[] = [];
        for (const raw of Array.isArray(out2.questions) ? (out2.questions as unknown[]) : []) {
          const id = raw && typeof raw === 'object' ? String((raw as Record<string, unknown>).id ?? '').trim() : '';
          if (failed.has(id) && !byId.has(id)) byId.set(id, raw);
          else if (!id) unnamed.push(raw);
        }
        let k = 0;
        entries = entries.map((e) => {
          if (!failed.has(e.id)) return e;
          const raw = byId.get(e.id) ?? unnamed[k++];
          if (raw === undefined) return e;
          const fixed = check(raw, e.id);
          if (!fixed.errors.length) repaired++;
          return fixed;
        });
      }
      if (out2) fails = entries.length ? failuresOf(entries) : fails;
    }
    const good = entries.filter((e) => e.draft && !e.errors.length);
    for (const f of fails) emit('stderr', `⏭ ${f.id}${f.label ? ` ${f.label}` : ''}: ${f.errors.join(' | ')} — không ghi câu này`);
    const warned = good.filter((e) => e.warnings.length);
    if (warned.length) emit('stderr', `⚠️ ${warned.length} câu có cảnh báo (vẫn ghi): ${warned.slice(0, 3).map((e) => `${e.id}: ${e.warnings[0]}`).join(' | ')}${warned.length > 3 ? ' …' : ''}`);
    const rejected = fails.map((f) => ({ id: f.id, errors: f.errors }));
    if (!good.length) {
      st.result = 'error';
      info.error = 'no valid questions';
      info.outcome = { ...info.outcome, structured: true, pack: null, questions: 0, repaired, rejected };
      emit('error', 'Không có câu hợp lệ nào — không ghi pack.');
      return;
    }
    const relFile = writePack(plan, good.map((e) => e.draft!));
    const after = loadBank();
    const qs = after.questions.filter((q) => q.file === relFile);
    const errors = after.problems.filter((x) => x.level === 'error' && x.file === relFile).length;
    info.outcome = { ...info.outcome, structured: true, pack: relFile, questions: qs.length, longForm: qs.filter((q) => q.longForm).length, errors, repaired, rejected };
    emit(
      errors ? 'stderr' : 'result',
      `Pack mới ${relFile}: ${qs.length} câu (${qs.filter((q) => q.longForm).length} câu dài) · ${errors} lỗi định dạng${repaired ? ` · ${repaired} câu sửa ở vòng 2` : ''}${rejected.length ? ` · ${rejected.length} câu bị loại` : ''}`,
    );
  }

  /**
   * [v5] family: JSON families → member drafts (stem = scenario + final question, shared options, `family: <id>`) →
   * one repair round per rejected family → the new pack. A family keeps its valid members when ≥ 2 remain with distinct
   * keys; otherwise it is dropped. Each member is blind-solved on its own afterwards (verify phase).
   */
  private async familyJson(st: RunState, main: PhaseResult, first: Record<string, unknown> | undefined) {
    const { info, emit } = st;
    const target = CoachRunner.packTarget(info, 'family');
    const knownSkills = CoachRunner.knownSkills();
    const bank = loadBank();
    let plan = planPack(target, first, bank);
    const ctx = { tax: bank.taxonomy, today: target.today, bank, knownSkills };
    type Fam = ReturnType<typeof familyDrafts>;
    // member ids are consecutive over the pack: each family reserves 4 slots so a repaired family keeps its ids
    const buildOne = (raw: unknown, i: number): Fam => familyDrafts(raw, plan.familyOf(i), i * 4, plan.idOf, ctx);
    const checked = (f: Fam): Fam => {
      for (const m of f.members) {
        if (!m.draft || m.errors.length) continue;
        const c = checkDraft(m.draft, plan, bank);
        m.errors.push(...c.errors);
        m.warnings.push(...c.warnings);
      }
      return f;
    };
    const failuresOf = (fs: Fam[]): ItemFailure[] =>
      fs
        .filter((f) => f.errors.length || f.members.some((m) => m.errors.length))
        .map((f) => ({
          id: f.id,
          label: f.label,
          errors: [...f.errors, ...f.members.filter((m) => m.errors.length).map((m) => `${m.id}: ${m.errors.join('; ')}`)],
          warnings: f.members.flatMap((m) => examSpecWarnings(m.warnings).map((w) => `${m.id}: ${w}`)), // [v6]
        }));
    const list = (o: Record<string, unknown> | undefined) => (Array.isArray(o?.families) ? (o!.families as unknown[]) : []).slice(0, MAX_FAMILIES);
    let fams = list(first).map((raw, i) => checked(buildOne(raw, i)));
    let fails = fams.length ? failuresOf(fams) : [{ id: '(tất cả)', errors: ['không có họ câu nào trong JSON (`families` rỗng hoặc thiếu)'] }];
    emit('tool', `Kiểm tra JSON: ${fams.length - failuresOf(fams).length}/${fams.length} họ câu hợp lệ${fails.length ? ` · ${fails.length} bị từ chối` : ''}`);
    let repaired = 0;
    if (fails.length && this.canRepair(st, main)) {
      for (const f of fails.slice(0, 10)) emit('stderr', `❌ ${f.id}${f.label ? ` ${f.label}` : ''}: ${f.errors.join(' | ')}`);
      const rep = await this.repairPhase(st, 'family', main, fails);
      if (info.status !== 'running') return; // cancelled during the repair round: write nothing
      const out2 = structuredOutput(rep?.result);
      if (out2 && !fams.length) {
        plan = planPack(target, out2, bank);
        fams = list(out2).map((raw, i) => checked(buildOne(raw, i)));
        repaired = fams.length - failuresOf(fams).length;
      } else if (out2) {
        const failed = new Set(fails.map((f) => f.id));
        const byId = new Map<string, unknown>();
        const unnamed: unknown[] = [];
        for (const raw of list(out2)) {
          const id = raw && typeof raw === 'object' ? String((raw as Record<string, unknown>).id ?? '').trim() : '';
          if (failed.has(id) && !byId.has(id)) byId.set(id, raw);
          else if (!id) unnamed.push(raw);
        }
        let k = 0;
        fams = fams.map((f, i) => {
          if (!failed.has(f.id)) return f;
          const raw = byId.get(f.id) ?? unnamed[k++];
          if (raw === undefined) return f;
          const fixed = checked(buildOne(raw, i));
          if (!failuresOf([fixed]).length) repaired++;
          return fixed;
        });
      }
      if (out2) fails = fams.length ? failuresOf(fams) : fails;
    }
    // keep the valid members of each family when ≥ 2 remain (keys stay distinct: duplicates were rejected per member)
    const kept: Fam[] = [];
    for (const f of fams) {
      const good = f.members.filter((m) => m.draft && !m.errors.length);
      if (f.errors.length || good.length < 2) {
        emit('stderr', `⏭ ${f.id}${f.label ? ` ${f.label}` : ''}: ${[...f.errors, ...f.members.filter((m) => m.errors.length).map((m) => `${m.id}: ${m.errors.join('; ')}`)].join(' | ') || 'còn < 2 câu hợp lệ'} — không ghi họ này`);
        continue;
      }
      for (const m of f.members.filter((x) => x.errors.length)) emit('stderr', `⏭ ${m.id}: ${m.errors.join(' | ')} — bỏ câu này, giữ ${good.length} câu của họ ${f.id}`);
      kept.push({ ...f, members: good });
    }
    const drafts = kept.flatMap((f) => f.members.map((m) => m.draft!));
    const warned = kept.flatMap((f) => f.members).filter((m) => m.warnings.length);
    if (warned.length) emit('stderr', `⚠️ ${warned.length} câu có cảnh báo (vẫn ghi): ${warned.slice(0, 3).map((m) => `${m.id}: ${m.warnings[0]}`).join(' | ')}${warned.length > 3 ? ' …' : ''}`);
    const rejected = fails.map((f) => ({ id: f.id, errors: f.errors }));
    if (!drafts.length) {
      st.result = 'error';
      info.error = 'no valid families';
      info.outcome = { ...info.outcome, structured: true, pack: null, questions: 0, families: 0, repaired, rejected };
      emit('error', 'Không có họ câu hợp lệ nào — không ghi pack.');
      return;
    }
    const relFile = writePack(plan, drafts);
    const after = loadBank();
    const qs = after.questions.filter((q) => q.file === relFile);
    const errors = after.problems.filter((x) => x.level === 'error' && x.file === relFile).length;
    info.outcome = { ...info.outcome, structured: true, pack: relFile, questions: qs.length, longForm: qs.filter((q) => q.longForm).length, families: kept.length, errors, repaired, rejected };
    emit(errors ? 'stderr' : 'result', `Pack mới ${relFile}: ${kept.length} họ · ${qs.length} câu · ${errors} lỗi định dạng${repaired ? ` · ${repaired} họ sửa ở vòng 2` : ''}${rejected.length ? ` · ${rejected.length} họ bị từ chối` : ''}`);
  }

  // ── [v5] grounded fact-check & import audit ───────────────────────────────

  /**
   * Fact-checks `ids` against AWS documentation in batches of GROUNDED_BATCH (verify task scope 'grounded', or the end of
   * an audit run). Verdicts → bank/verify.md (`check: grounded`); nothing is drafted or changed. A sealed question's
   * log line hides its details.
   */
  private async groundedPhase(st: RunState, ids: string[], opts: { why?: Record<string, string>; partOfAudit?: boolean }) {
    const { info, cfg, emit } = st;
    const isTask = info.task === 'verify' && info.params?.scope === 'grounded';
    const bank = loadBank();
    const qs = ids.map((id) => bank.byId.get(id)).filter((q): q is Question => !!q && q.status !== 'retired');
    const sum: NonNullable<RunOutcome['grounded']> = { checked: 0, correct: 0, wrong: 0, outdated: 0, ambiguous: 0, error: 0, citations: 0 };
    if (!qs.length) {
      if (isTask) this.fail(st, 'Không còn câu nào để kiểm chứng (đã xoá hoặc retired).');
      return;
    }
    const why = opts.why ?? this.groundedReasons(qs);
    const model = modelFor('verify', cfg);
    const sealed = sealedIds();
    const batches: Question[][] = [];
    for (let i = 0; i < qs.length; i += GROUNDED_BATCH) batches.push(qs.slice(i, i + GROUNDED_BATCH));
    const deadline = Date.now() + VERIFY_TIMEOUT_MS;
    emit('start', `🔗 Kiểm chứng ${qs.length} câu bằng tài liệu AWS · model ${model} · chỉ WebSearch + WebFetch trên docs.aws.amazon.com / aws.amazon.com · ${batches.length} lượt gọi`);
    for (const [i, batch] of batches.entries()) {
      if (info.status !== 'running') return;
      if (Date.now() >= deadline) {
        emit('stderr', `⏱ Hết ${fmtLimit(VERIFY_TIMEOUT_MS)} — ${batches.slice(i).reduce((n, b) => n + b.length, 0)} câu chưa kiểm chứng, để lượt sau.`);
        break;
      }
      const r = await this.runPhase(st, groundedArgs(groundedPrompt(batch, info.id, why), cfg), 'verify', deadline);
      if (info.status !== 'running') return;
      const out = structuredOutput(r.result);
      if (!out || r.error || r.result?.is_error) {
        sum.error += batch.length;
        emit('stderr', `🔗 Lượt ${i + 1}/${batches.length}: không có kết quả JSON${r.error ? ` (${r.error})` : ''} — ${batch.length} câu chưa kiểm chứng.`);
        continue;
      }
      const vs = groundedVerdicts(batch, out, { model: r.model ?? model, runId: info.id });
      appendVerdicts(vs);
      sum.error += batch.length - vs.length;
      for (const v of vs) {
        sum.checked++;
        sum[v.fact ?? 'ambiguous']++;
        sum.citations += v.citations?.length ?? 0;
        const label = { correct: '✅ đúng theo tài liệu', wrong: '❌ sai theo tài liệu', outdated: '⏳ lỗi thời', ambiguous: '⚠️ chưa đủ để quyết' }[v.fact ?? 'ambiguous'];
        emit(v.fact === 'correct' ? 'result' : 'stderr', sealed.has(v.qid) ? `🔗 1 câu đang niêm phong: ${label} (chi tiết ẩn)` : `🔗 ${v.qid}: ${label}${v.picked ? ` (tài liệu ${v.picked} · đáp án ${v.key})` : ''}${v.citations?.length ? ` · ${v.citations.length} trích dẫn` : ''}${v.reason ? ` — ${v.reason.slice(0, 160)}` : ''}`);
      }
    }
    info.outcome = { ...info.outcome, grounded: sum };
    const line = `🔗 Kiểm chứng ${sum.checked}/${qs.length} câu: ${sum.correct} đúng · ${sum.wrong} sai · ${sum.outdated} lỗi thời · ${sum.ambiguous} chưa rõ${sum.error ? ` · ${sum.error} lỗi` : ''} · ${sum.citations} trích dẫn — xem Ngân hàng → Chất lượng → 🧪`;
    emit('result', line);
    if (isTask) {
      if (sum.checked) {
        st.result = 'success';
        info.summary = line;
      } else this.fail(st, 'Không kiểm chứng được câu nào (xem log).');
    } else if (opts.partOfAudit && info.summary) info.summary = `${info.summary}\n${line}`;
  }

  /** Why each question is suspected (shown to the fact-checker as data). */
  private groundedReasons(qs: Question[]): Record<string, string> {
    const bank = loadBank();
    const latest = latestVerdicts(bank);
    let issues: { qid: string; type: string; note: string; open: boolean }[] = [];
    try {
      issues = loadIssues();
    } catch {
      // no issues file
    }
    const out: Record<string, string> = {};
    for (const q of qs) {
      const parts: string[] = [];
      const v = latest[q.id];
      if (v && !v.check && v.hash === q.hash && (v.outcome === 'mismatch' || v.outcome === 'ambiguous')) parts.push(`model giải mù ${v.outcome === 'ambiguous' ? 'cho là mơ hồ' : `chọn ${v.picked ?? '—'}`}${v.reason ? `: ${v.reason}` : ''}`);
      const l = v?.local ?? (v?.check === 'local' ? v : undefined);
      if (l && l.hash === q.hash && l.outcome === 'mismatch') parts.push(`model local chọn ${l.picked ?? '—'}`);
      for (const it of issues.filter((x) => x.open && x.qid === q.id && (x.type === 'wrong-key' || x.type === 'outdated'))) parts.push(`người học báo ${it.type}: ${it.note.slice(0, 200)}`);
      for (const f of staleFlaws(q, bank)) parts.push(`kiến thức có thể đã cũ: ${f}`);
      out[q.id] = parts.join(' · ') || 'kiểm chứng theo yêu cầu';
    }
    return out;
  }

  /**
   * Import audit run (verify scope 'audit'): blind-solve the imported questions (never auto-drafted), then the local
   * model's vote when coach.verify.local_model is set, then — with coach.verify.grounded — a fact-check of what came out
   * mismatch / ambiguous or what the local model disputed with high confidence.
   */
  private async auditPhase(st: RunState, ids: string[]) {
    const { info, cfg, emit } = st;
    await this.verifyPhase(st, ids, new Set());
    if (info.status !== 'running') return;
    const bank = loadBank();
    const qs = ids.map((id) => bank.byId.get(id)).filter((q): q is Question => !!q && q.status !== 'retired');
    const runVerdicts = latestVerdicts(bank);
    const flagged = new Set(qs.filter((q) => {
      const v = runVerdicts[q.id];
      return v && !v.check && v.hash === q.hash && v.runId === info.id && (v.outcome === 'mismatch' || v.outcome === 'ambiguous');
    }).map((q) => q.id));
    const localModel = String(cfg.coach.verify.local_model ?? '').trim();
    if (localModel) {
      emit('start', `🖥️ Phiếu thứ ba: model local ${localModel} (Ollama, không tốn quota) — chỉ để gợi ý kiểm chứng, không đổi đáp án`);
      const sum: NonNullable<RunOutcome['local']> = { checked: 0, disagree: 0 };
      try {
        const votes = await localVotes(qs, { url: cfg.quality.ollama_url, model: localModel, runId: info.id });
        appendVerdicts(votes);
        sum.checked = votes.length;
        for (const v of votes) {
          if (v.outcome !== 'mismatch') continue;
          sum.disagree++;
          const blind = runVerdicts[v.qid];
          if (v.confidence === 'high' && blind && !blind.check && blind.outcome === 'ok') flagged.add(v.qid);
        }
        emit('result', `🖥️ Model local: ${sum.checked} câu · ${sum.disagree} khác đáp án`);
      } catch (e) {
        sum.error = (e as Error).message;
        emit('stderr', `🖥️ ${sum.error}`);
      }
      info.outcome = { ...info.outcome, local: sum };
    }
    if (!flagged.size) return;
    if (!cfg.coach.verify.grounded) {
      emit('stderr', `🔗 ${flagged.size} câu đáng kiểm chứng bằng tài liệu — coach.verify.grounded đang tắt, bỏ qua.`);
      return;
    }
    await this.groundedPhase(st, [...flagged], { partOfAudit: true });
  }

  // ── file mode: re-check what the AI wrote ─────────────────────────────────

  /** enrich: re-apply the patch (idempotent; catches a patch the AI wrote but never applied). longform: check the new pack. */
  private postProcess(st: RunState) {
    const { info, emit } = st;
    const params = info.params ?? {};
    if (info.task === 'enrich') {
      const file = patchPath(info.id);
      if (!fs.existsSync(file)) {
        info.outcome = { ...info.outcome, patch: null, updated: 0 };
        if (st.result === 'success') {
          st.result = 'error';
          info.error = 'no patch';
        }
        emit('error', `Không thấy patch ${repoRel(file)} — lượt này chưa cập nhật câu nào.`);
        return;
      }
      const r = applyPatch(file);
      const ids = Array.isArray(params.ids) ? (params.ids as string[]) : [];
      const inPatch = new Set(r.items.map((i) => i.id));
      const missing = ids.filter((x) => !inPatch.has(x));
      info.outcome = { ...info.outcome, patch: repoRel(file), updated: r.applied + r.unchanged, skipped: r.skipped, failed: r.failed + (r.error ? 1 : 0), missing };
      if (r.error) emit('stderr', `❌ ${r.error}`);
      for (const it of r.items) if (it.status === 'failed' || it.status === 'skipped') emit('stderr', `${it.status === 'skipped' ? '⏭' : '❌'} ${it.id}: ${it.errors.join(' | ')}`);
      emit(
        'result',
        `Patch: ${r.applied + r.unchanged}/${ids.length || r.items.length} câu đã cập nhật${r.skipped ? ` · ${r.skipped} bỏ qua` : ''}${r.failed ? ` · ${r.failed} lỗi` : ''}${missing.length ? ` · ${missing.length} câu thiếu trong patch` : ''}${r.error ? ` · ${r.error}` : ''}`,
      );
      return;
    }
    if (info.task === 'longform' || info.task === 'twins' || info.task === 'family') {
      const bank = loadBank();
      const prefix = String(params.idPrefix ?? '');
      const qs = prefix ? bank.questions.filter((q) => q.id.startsWith(prefix)) : [];
      const pack = bank.packs.find((p) => p.id === params.packId) ?? bank.packs.find((p) => qs.some((q) => q.file === p.file));
      const errors = pack ? bank.problems.filter((p) => p.level === 'error' && p.file === pack.file).length : 0;
      info.outcome = { ...info.outcome, pack: pack ? pack.file : null, questions: qs.length, longForm: qs.filter((q) => q.longForm).length, errors };
      if (!qs.length && st.result === 'success') {
        st.result = 'error';
        info.error = 'no new questions';
      }
      emit(
        pack && !errors ? 'result' : 'stderr',
        pack ? `Pack mới ${pack.file}: ${qs.length} câu (${qs.filter((q) => q.longForm).length} câu dài) · ${errors} lỗi định dạng` : 'Không thấy pack mới của lượt này.',
      );
    }
  }

  // ── blind-solve ───────────────────────────────────────────────────────────

  /**
   * Blind-solves `ids` in batches (verify task, or the auto phase after a run), appends the verdicts to bank/verify.md
   * and applies auto_draft. `changed` = questions this run just added / edited (they may be drafted even when not
   * AI-written; imported ones never are).
   */
  private async verifyPhase(st: RunState, ids: string[], changed: Set<string>) {
    const { info, cfg, emit } = st;
    const isTask = info.task === 'verify';
    const bank = loadBank();
    const all = ids.map((id) => bank.byId.get(id)).filter((q): q is Question => !!q && q.status !== 'retired');
    const qs = all.slice(0, MAX_VERIFY);
    const sum: NonNullable<RunOutcome['verify']> = { checked: 0, ok: 0, mismatch: 0, ambiguous: 0, error: 0, drafted: [] };
    const left = all.length - qs.length + (isTask && typeof info.params?.remaining === 'number' ? info.params.remaining : 0); // capped at MAX_VERIFY
    if (left > 0) sum.remaining = left;
    if (!qs.length) {
      if (isTask) this.fail(st, 'Không còn câu nào để giải mù (đã xoá hoặc retired).');
      return;
    }
    const model = modelFor('verify', cfg);
    const sealed = sealedIds(); // the log (Coach → Xem log) never shows a sealed question's pick, key or reason
    const batches = verifyBatches(qs, cfg.coach.verify.batch_size);
    const orders = blindOrders(qs); // [v6] options shuffled per question (hash + earlier answers); picks mapped back to bank letters
    const deadline = Date.now() + VERIFY_TIMEOUT_MS;
    emit('start', `🧪 Giải mù ${qs.length} câu · model ${model}${/sonnet/i.test(model) ? '' : ' (dự phòng sonnet)'} · ${batches.length} lượt gọi — model chỉ thấy đề + lựa chọn (đã xáo thứ tự)`);
    const verdicts: VerifyVerdict[] = [];
    for (const [i, batch] of batches.entries()) {
      if (info.status !== 'running') return; // cancelled
      if (Date.now() >= deadline) {
        // out of time: do not start a call that would be killed at once — the rest stays unverified for a later run
        const rest = batches.slice(i).reduce((n, b) => n + b.length, 0);
        sum.remaining = (sum.remaining ?? 0) + rest;
        emit('stderr', `⏱ Hết ${fmtLimit(VERIFY_TIMEOUT_MS)} giải mù — ${rest} câu chưa giải, để lượt sau (--scope unverified-ai / changed).`);
        break;
      }
      const r = await this.runPhase(st, verifyArgs(verifyPrompt(batch, info.id, orders), cfg), 'verify', deadline);
      if (info.status !== 'running') return;
      const out = structuredOutput(r.result);
      if (!out || r.error || r.result?.is_error) {
        emit('stderr', `🧪 Lượt ${i + 1}/${batches.length}: không có kết quả JSON${r.error ? ` (${r.error})` : ''} — ${batch.length} câu chưa được giải.`);
        continue;
      }
      const vs = verdictsFor(batch, out, { model: r.model ?? model, runId: info.id, orders });
      appendVerdicts(vs);
      verdicts.push(...vs);
      for (const v of vs) {
        sum.checked++;
        sum[v.outcome]++;
        if (v.outcome === 'ok') continue;
        emit(v.outcome === 'error' ? 'stderr' : 'result', verdictLogLine(v, sealed));
      }
    }
    // drafted by an earlier blind-solve and solved correctly now (fixed by ENRICH, or re-verified) → back to active
    const re = reactivate(verdicts, info.id);
    for (const e of re.errors) emit('stderr', `Không đưa câu về active được: ${e}`);
    if (re.reactivated.length) {
      sum.reactivated = re.reactivated;
      emit('result', `✅ ${re.reactivated.length} câu đang draft vì giải mù nay đã khớp → dùng lại: ${re.reactivated.join(', ')}`);
    }
    if (cfg.coach.verify.auto_draft) {
      const candidates = draftCandidates(verdicts, loadBank(), changed);
      if (candidates.length) {
        const d = autoDraft(candidates, info.id);
        sum.drafted = d.drafted;
        for (const e of d.errors) emit('stderr', `Không chuyển được sang draft: ${e}`);
        if (d.drafted.length) emit('result', `📝 ${d.drafted.length} câu chuyển sang draft, chờ bạn duyệt ở Ngân hàng → Chất lượng: ${d.drafted.join(', ')}`);
      }
    }
    info.outcome = { ...info.outcome, verify: sum };
    const line = `🧪 Giải mù ${sum.checked}/${qs.length} câu: ${sum.ok} khớp · ${sum.mismatch} lệch · ${sum.ambiguous} mơ hồ${sum.error ? ` · ${sum.error} lỗi` : ''}${sum.drafted.length ? ` · ${sum.drafted.length} câu → draft` : ''}${sum.remaining ? ` · còn ${sum.remaining} câu cho lượt sau` : ''}`;
    emit('result', line);
    if (isTask) {
      if (sum.checked) {
        st.result = 'success';
        info.summary = line;
      } else this.fail(st, 'Không giải được câu nào (xem log).');
    }
  }

  // ── [v6] choices-only cue probe ───────────────────────────────────────────

  /**
   * Verify scope 'cues': the probe model (coach.verify.probe_model) sees only each question's options — no stem, no id, no
   * metadata — shuffled, and guesses; the questions it got exactly right are asked once more with another order (the key
   * on other letters). Right both times = the options give the key away (`cue`), else `clean`. Lines → bank/verify.md
   * with `"probe":"choices-only"`: nothing is drafted, reactivated or counted as verified. Sealed questions: details hidden.
   */
  private async cuePhase(st: RunState, ids: string[]) {
    const { info, cfg, emit } = st;
    const isTask = info.task === 'verify';
    const bank = loadBank();
    const all = ids.map((id) => bank.byId.get(id)).filter((q): q is Question => !!q && q.status !== 'retired');
    const qs = all.slice(0, MAX_VERIFY);
    const sum: NonNullable<RunOutcome['cues']> = { checked: 0, cue: 0, clean: 0, error: 0, flagged: [] };
    let left = all.length - qs.length + (isTask && typeof info.params?.remaining === 'number' ? info.params.remaining : 0); // capped at MAX_VERIFY
    if (!qs.length) {
      if (isTask) this.fail(st, 'Không còn câu nào để dò (đã xoá hoặc retired).');
      return;
    }
    const model = probeModel(cfg);
    const sealed = sealedIds(); // the log never shows a sealed question's id, key or giveaway
    const seen = probeAttempts(qs); // a re-probe of the same version gets other shuffles
    const plan = qs.map((q, i) => ({ q, n: i + 1, key: [...q.answer].sort().join(''), orders: probeOrders(q, seen.get(q.id) ?? 0), runs: [] as (ProbeRun | undefined)[], model, done: false }));
    const deadline = Date.now() + VERIFY_TIMEOUT_MS;
    emit('start', `🎯 Dò phương án lộ đáp án ${qs.length} câu · model ${model}${/sonnet/i.test(model) ? '' : ' (dự phòng sonnet)'} — model chỉ thấy các phương án (không đề, không id, đã xáo thứ tự); câu đoán trúng được hỏi lại với thứ tự khác`);
    let late = false;
    for (const run of [1, 2] as const) {
      // run 2 only for the questions whose first guess was exactly the key — for the others the outcome is already 'clean'
      const todo = run === 1 ? plan : plan.filter((p) => !p.done && p.runs[0]?.picked === p.key);
      const byId = new Map(todo.map((p) => [p.q.id, p]));
      const batches = verifyBatches(todo.map((p) => p.q), cfg.coach.verify.batch_size, probeCost);
      for (const [i, batch] of batches.entries()) {
        if (info.status !== 'running') return; // cancelled
        if (Date.now() >= deadline) {
          late = true; // out of time: do not start a call that would be killed at once
          break;
        }
        const items = batch.map((q) => ({ q, label: probeLabel(run, byId.get(q.id)!.n), order: byId.get(q.id)!.orders[run - 1] }));
        const r = await this.runPhase(st, probeArgs(probePrompt(items, info.id), cfg), 'verify', deadline);
        if (info.status !== 'running') return;
        const out = structuredOutput(r.result);
        if (!out || r.error || r.result?.is_error) {
          emit('stderr', `🎯 Lần ${run} · lượt ${i + 1}/${batches.length}: không có kết quả JSON${r.error ? ` (${r.error})` : ''} — ${batch.length} câu chưa dò xong.`);
          continue;
        }
        const got = probeAnswers(items, out);
        for (const it of items) {
          const p = byId.get(it.q.id)!;
          p.runs[run - 1] = got.get(it.q.id) ?? { picked: '', order: it.order };
          p.model = r.model ?? model;
        }
      }
      // what this run settled goes to the ledger right away (a cancel or timeout later keeps it)
      const settled: CueProbe[] = [];
      for (const p of plan) {
        const rec = p.done ? undefined : probeRecord(p.q, p.runs, { model: p.model, runId: info.id });
        if (!rec) continue;
        p.done = true;
        settled.push(rec);
      }
      appendProbes(settled);
      for (const rec of settled) {
        sum.checked++;
        sum[rec.outcome]++;
        if (rec.outcome !== 'cue') continue;
        if (!sealed.has(rec.qid)) sum.flagged.push(rec.qid);
        emit('result', cueLogLine(rec, sealed));
      }
      if (late) break;
    }
    const open = plan.filter((p) => !p.done).length;
    if (late && open) {
      left += open;
      emit('stderr', `⏱ Hết ${fmtLimit(VERIFY_TIMEOUT_MS)} dò phương án — ${open} câu chưa dò xong, để lượt sau (--scope cues).`);
    } else sum.error = open;
    if (left > 0) sum.remaining = left;
    info.outcome = { ...info.outcome, cues: sum };
    const line = `🎯 Dò ${sum.checked}/${qs.length} câu chỉ bằng phương án: ${sum.cue} lộ đáp án · ${sum.clean} không lộ${sum.error ? ` · ${sum.error} lỗi` : ''}${sum.remaining ? ` · còn ${sum.remaining} câu cho lượt sau` : ''}${sum.cue ? ' — sửa phương án ở Ngân hàng → Chất lượng → 🧪' : ''}`;
    emit('result', line);
    if (isTask) {
      if (sum.checked) {
        st.result = 'success';
        info.summary = line;
      } else this.fail(st, 'Không dò được câu nào (xem log).');
    }
  }

  /** Final status, sync after a success, run record, unlock, 'done'. */
  private async finish(st: RunState) {
    const { info, cfg, emit } = st;
    if (info.status === 'running') info.status = st.result; // cancelled / skipped stay as they are
    if (info.status === 'error' && !info.error) info.error = 'error';
    if (info.status === 'success' && (st.opts.syncAfter ?? cfg.sync.after_ai)) {
      emit('tool', '⇅ Đang đẩy kết quả AI lên GitHub…');
      const note = await syncForAi('after', { force: true });
      info.sync = { ...info.sync, after: note };
      emit(note.ok ? 'result' : 'stderr', aiSyncLine(note));
    }
    info.finishedAt = localIso();
    saveRunInfo(info);
    emit('end', `Kết thúc: ${info.status}${info.costUsd ? ` · $${info.costUsd.toFixed(3)}` : ''}`);
    st.raw.end();
    st.evOut.end();
    releaseLock(info.id); // only our own lock — never one another process took meanwhile
    this.current = undefined;
    this.emit('done', info);
    this.followUp(info);
  }

  /**
   * coach.enrich_after_analyze: right after a successful analyze, a small ENRICH run (own record, same trigger) over the
   * questions the learner is about to meet — the new plan's sessions first. Started synchronously after 'done' (a
   * listener can tell from `current` that a run goes on); 'followup' reports it or why it was skipped.
   */
  private followUp(info: RunInfo) {
    if (info.task !== 'analyze' || info.status !== 'success') return;
    let enabled = false;
    try {
      enabled = !!loadConfig().coach.enrich_after_analyze;
    } catch {
      return;
    }
    if (!enabled) return;
    try {
      const run = this.start('enrich', info.trigger, { size: AFTER_ANALYZE_BATCH, upcoming: true, after: info.id }, { syncBefore: false }); // the analyze run just synced
      this.emit('followup', { after: info.id, run });
    } catch (e) {
      // nothing upcoming needs work (NothingToDoError), or another process took the lock — the analyze run succeeded anyway
      this.emit('followup', { after: info.id, skipped: (e as Error).message });
    }
  }

  /** Stops a run that is syncing or running a CLI phase; a run already in its final sync is left to finish. */
  cancel(): boolean {
    const cur = this.current;
    if (!cur || cur.info.status !== 'running') return false;
    cur.info.status = 'cancelled';
    cur.child?.kill('SIGTERM');
    cur.wake?.(); // waiting for a retry
    return true;
  }
}

export const coachRunner = new CoachRunner();

// ── [v5] idle chooser (coach.idle_tasks) ────────────────────────────────────

export const IDLE_TASKS = ['enrich', 'longform', 'twins', 'audit', 'notebook'] as const;
export type IdleTask = (typeof IDLE_TASKS)[number];

export interface IdleStep {
  idle: IdleTask;
  task?: CoachTask; // a coach run (undefined = notebook update)
  params: Record<string, unknown>;
  label: string; // Vietnamese, for the log
}

/**
 * What a scheduled run without new results may do, in config order (coach.idle_tasks, unknown names ignored, duplicates
 * dropped). The default `[enrich]` is today's behaviour: one ENRICH batch of coach.enrich_batch_size.
 */
export function idleSteps(cfg: AppConfig): IdleStep[] {
  const list = (Array.isArray(cfg.coach.idle_tasks) ? cfg.coach.idle_tasks : ['enrich']).map((x) => String(x).trim().toLowerCase());
  const out: IdleStep[] = [];
  for (const name of list) {
    if (!(IDLE_TASKS as readonly string[]).includes(name) || out.some((s) => s.idle === name)) continue;
    const idle = name as IdleTask;
    if (idle === 'enrich') out.push({ idle, task: 'enrich', params: { size: cfg.coach.enrich_batch_size }, label: 'ENRICH (bảo trì ngân hàng)' });
    if (idle === 'longform') out.push({ idle, task: 'longform', params: { count: 5, idle: true }, label: 'câu dài cho task còn thiếu' });
    if (idle === 'twins') out.push({ idle, task: 'twins', params: { count: cfg.coach.twins_per_run }, label: 'câu song sinh cho câu sắp ôn' });
    if (idle === 'audit') out.push({ idle, task: 'verify', params: { scope: 'audit' }, label: 'kiểm toán câu nhập' });
    if (idle === 'notebook') out.push({ idle, params: {}, label: 'cập nhật 📒 sổ lỗi' });
  }
  return out;
}

export type NotebookUpdate = (opts?: { trigger?: 'manual' | 'schedule' | 'cli' }) => Promise<{ status: string; summary?: string; error?: string; costUsd?: number }>;

/** τ's updateNotebook() when notebook.ts exports it (dynamic: the chooser never breaks while it is missing). */
export async function notebookUpdater(): Promise<NotebookUpdate | undefined> {
  try {
    const mod = (await import('./notebook.ts')) as Record<string, unknown>;
    return typeof mod.updateNotebook === 'function' ? (mod.updateNotebook as NotebookUpdate) : undefined;
  } catch {
    return undefined;
  }
}

export type IdleOutcome = { kind: 'run'; step: IdleStep; run: CoachRunInfo } | { kind: 'notebook'; step: IdleStep; status: string; summary?: string; error?: string } | { kind: 'none'; skipped: string[] };

/**
 * Runs the first idle step that has work: a coach run starts (NothingToDoError → next step), the notebook update runs to
 * its end ('skipped' → next step). `log` gets one line per step tried.
 */
export async function startIdle(
  runner: CoachRunner,
  trigger: CoachRunInfo['trigger'],
  cfg: AppConfig,
  log: (line: string) => void = () => undefined,
  opts: StartOptions & { notebook?: NotebookUpdate } = {},
): Promise<IdleOutcome> {
  const skipped: string[] = [];
  for (const step of idleSteps(cfg)) {
    if (!step.task) {
      const update = opts.notebook ?? (await notebookUpdater());
      if (!update) {
        skipped.push(`${step.label}: chưa có trong bản này`);
        log(`⏭  ${step.label}: chưa có trong bản này`);
        continue;
      }
      try {
        const r = await update({ trigger });
        if (r.status === 'skipped') {
          skipped.push(`${step.label}: ${r.summary ?? 'không có lỗi mới'}`);
          log(`⏭  ${step.label}: ${r.summary ?? 'không có lỗi mới'}`);
          continue;
        }
        return { kind: 'notebook', step, status: r.status, summary: r.summary, error: r.error };
      } catch (e) {
        return { kind: 'notebook', step, status: 'error', error: (e as Error).message };
      }
    }
    try {
      const run = runner.start(step.task, trigger, step.params, opts);
      log(`▶ Lượt rảnh: ${step.label} (${run.id})`);
      return { kind: 'run', step, run };
    } catch (e) {
      if (!(e instanceof NothingToDoError)) throw e;
      skipped.push(`${step.label}: ${e.message}`);
      log(`⏭  ${step.label}: ${e.message}`);
    }
  }
  return { kind: 'none', skipped };
}
