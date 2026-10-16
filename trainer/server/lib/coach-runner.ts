// Runs the AI coach headlessly through the Claude Code CLI (`claude -p … --output-format stream-json`)
// and turns its event stream into short progress lines for the UI (SSE) and log files in coach/runs/.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { COACH_DIR, REPO_DIR, RUNS_DIR, loadConfig, rel, type AppConfig } from '../config.ts';
import { localIso, stampParts } from './time.ts';
import type { ClaudeStatus, CoachEvent, CoachRunInfo } from '../../shared/types.ts';

const LOCK_FILE = path.join(COACH_DIR, '.lock');
const RUN_TIMEOUT_MS = 40 * 60_000;

// ── locating the CLI ────────────────────────────────────────────────────────

function isExecutable(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return fs.statSync(p).isFile();
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
      const p = path.join(root, d, 'resources', 'native-binary', 'claude');
      if (isExecutable(p)) found.push({ p, v: versionKey(d) });
    }
  }
  found.sort((a, b) => b.v[0] - a.v[0] || b.v[1] - a.v[1] || b.v[2] - a.v[2]);
  return found.map((f) => f.p);
}

let statusCache: { at: number; status: ClaudeStatus } | undefined;

/** `claude auth status` → whether the CLI is logged in and how (no personal details are kept). */
function authStatus(bin: string): ClaudeStatus['auth'] {
  const r = spawnSync(bin, ['auth', 'status'], { encoding: 'utf8', timeout: 15_000 });
  try {
    const j = JSON.parse(r.stdout) as { loggedIn?: boolean; authMethod?: string; subscriptionType?: string };
    return { loggedIn: !!j.loggedIn, method: j.authMethod, plan: j.subscriptionType };
  } catch {
    return r.status === 0 ? { loggedIn: true } : { loggedIn: false };
  }
}

export function findClaude(cfg: AppConfig = loadConfig(), fresh = false): ClaudeStatus {
  if (!fresh && statusCache && Date.now() - statusCache.at < 60_000) return statusCache.status;
  const home = os.homedir();
  const candidates: { p: string; source: string }[] = [];
  if (cfg.coach.claude_bin) candidates.push({ p: cfg.coach.claude_bin.replace(/^~/, home), source: 'config.yaml coach.claude_bin' });
  if (process.env.CLAUDE_BIN) candidates.push({ p: process.env.CLAUDE_BIN, source: 'env CLAUDE_BIN' });
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) if (dir) candidates.push({ p: path.join(dir, 'claude'), source: 'PATH' });
  for (const p of [path.join(home, '.claude', 'local', 'claude'), path.join(home, '.local', 'bin', 'claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude']) {
    candidates.push({ p, source: 'standard location' });
  }
  for (const p of extensionBinaries()) candidates.push({ p, source: 'VS Code extension (bundled CLI)' });

  let status: ClaudeStatus = {
    available: false,
    hint: 'Không tìm thấy Claude Code CLI. Cài bằng `npm i -g @anthropic-ai/claude-code` (rồi `claude` để đăng nhập), hoặc đặt đường dẫn ở trainer/config.yaml → coach.claude_bin / biến môi trường CLAUDE_BIN. Có thể dùng Claude Cowork thay thế (nút “Copy prompt”).',
  };
  for (const c of candidates) {
    if (!isExecutable(c.p)) continue;
    const r = spawnSync(c.p, ['--version'], { encoding: 'utf8', timeout: 15_000 });
    if (r.status === 0) {
      status = { available: true, path: c.p, version: r.stdout.trim().split('\n')[0], source: c.source, auth: authStatus(c.p) };
      break;
    }
  }
  statusCache = { at: Date.now(), status };
  return status;
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

export function buildPrompt(task: 'analyze' | 'generate', runId: string, trigger: string, params: Record<string, unknown> = {}): string {
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
    ].filter((l) => l !== '').join('\n');
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

function versionAtLeast(version: string | undefined, min: [number, number, number]): boolean {
  const m = version?.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return false;
  const v = [Number(m[1]), Number(m[2]), Number(m[3])];
  for (let i = 0; i < 3; i++) if (v[i] !== min[i]) return v[i] > min[i];
  return true;
}

export function cliArgs(prompt: string, cfg: AppConfig, version?: string): string[] {
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
    ...(versionAtLeast(version, [2, 1, 259]) ? ['--permission-prompts', 'none'] : []),
    '--allowedTools',
    'Glob',
    'Grep',
    'Edit(trainer/bank/**)',
    'Edit(trainer/coach/**)',
    'Write(trainer/bank/**)',
    'Write(trainer/coach/**)',
    'Bash(node trainer/scripts/validate.ts:*)',
    'Bash(node trainer/scripts/snapshot.ts:*)',
    'TodoWrite',
  ];
  if (cfg.coach.model) args.push('--model', cfg.coach.model);
  if (cfg.coach.effort) args.push('--effort', cfg.coach.effort);
  if (cfg.coach.max_budget_usd > 0) args.push('--max-budget-usd', String(cfg.coach.max_budget_usd));
  return args;
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

export class CoachRunner extends EventEmitter {
  current?: { info: CoachRunInfo; child: ChildProcess; events: CoachEvent[] };

  status() {
    return { running: this.current?.info, lockedBy: this.current ? undefined : readLock() };
  }

  listRuns(limit = 30): CoachRunInfo[] {
    if (!fs.existsSync(RUNS_DIR)) return [];
    return fs
      .readdirSync(RUNS_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit)
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), 'utf8')) as CoachRunInfo;
        } catch {
          return undefined;
        }
      })
      .filter((x): x is CoachRunInfo => !!x);
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

  start(task: 'analyze' | 'generate', trigger: CoachRunInfo['trigger'], params: Record<string, unknown> = {}): CoachRunInfo {
    if (this.current) throw new Error(`Đang có lượt chạy ${this.current.info.id}`);
    const lock = readLock();
    if (lock) throw new Error(`Một tiến trình khác (pid ${lock.pid}) đang chạy coach: ${lock.runId}`);
    const cfg = loadConfig();
    const claude = findClaude(cfg, true);
    if (!claude.available || !claude.path) throw new Error(claude.hint ?? 'Claude Code CLI not found');

    fs.mkdirSync(RUNS_DIR, { recursive: true });
    const s = stampParts();
    const id = `${s.date}_${s.time}_${task}`;
    const info: CoachRunInfo = { id, task, trigger, status: 'running', startedAt: localIso(), params };
    const prompt = buildPrompt(task, id, trigger, params);
    const args = cliArgs(prompt, cfg, claude.version);
    // In -p mode an ANTHROPIC_API_KEY in the environment wins over the claude.ai login, which would
    // silently bill the API account. Use the subscription login unless config says otherwise.
    const env = { ...process.env };
    if (!cfg.coach.use_api_key) delete env.ANTHROPIC_API_KEY;
    const child = spawn(claude.path, args, { cwd: REPO_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] });
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
    emit('start', `${task === 'analyze' ? 'Phân tích kết quả & lập kế hoạch' : 'Sinh câu hỏi'} · Claude Code ${claude.version?.split(' ')[0] ?? ''} · ~/${rel(claude.path, os.homedir())}`);

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
      child.kill('SIGTERM');
    }, RUN_TIMEOUT_MS);

    const finish = (code: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timer);
      if (info.status === 'running') {
        if (signal && info.status === 'running') info.status = 'cancelled';
        else info.status = code === 0 && resultSeen ? 'success' : 'error';
        if (info.status === 'error' && !info.error) info.error = `CLI exited with code ${code}`;
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

  private handleMessage(msg: Record<string, unknown>, info: CoachRunInfo, emit: (k: CoachEvent['kind'], t: string) => void, markResult: () => void) {
    const type = msg.type;
    if (type === 'system' && msg.subtype === 'init') {
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
      if (denials) emit('stderr', `${denials} thao tác bị chặn bởi quyền hạn (chỉ được ghi trong trainer/bank và trainer/coach).`);
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
