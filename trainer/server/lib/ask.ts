// "Ask AI about this question": a read-only Claude Code run (`claude -p --output-format json`, tools limited to
// Read/Glob/Grep inside the repo) that answers the learner in Vietnamese. Every Q&A is appended to
// coach/qa/<qid>.md — the coach reads these (snapshot §15) to see what still confuses the learner.
// [γ] The run may read the study notes only: trainer/** (bank packs, results/sealed.md, ENRICH batches, ledgers…) and
// practice-exams/** (the imported questions with their keys) are denied, so it can never quote a sealed question.
// [v5 τ] The same log holds 🧑‍🏫 tutor dialogs (`kind: 'tutor'`, the transcript as the answer — tutor.ts), and
// runClaudeCli() is the one-call `--output-format json` runner shared by the tutor and the 📒 notebook task.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { QA_DIR, REPO_DIR, loadConfig, type AppConfig } from '../config.ts';
import { HttpError } from '../http.ts';
import { loadBank, type BankState } from './bank.ts';
import { MODERN_CLI, claudeCommand, cliEnv, coachGuard, findClaude, modelFor, versionAtLeast } from './coach-runner.ts';
import { ID_RE } from './pack-format.ts';
import { sealedIds } from './sealed.ts';
import { DAY_MS, fmtLocal, localIso } from './time.ts';
import type { QaEntry, Question } from '../../shared/types.ts';

const ASK_TIMEOUT_MS = 4 * 60_000;
const MAX_CONCURRENT = 2;
const MAX_QUESTION_CHARS = 1500;
const ANSWER_HEADING = '**🤖 Trả lời:**';
let active = 0;

// ── prompt + CLI ────────────────────────────────────────────────────────────

function notesFor(q: Question, bank: BankState): string[] {
  const topic = bank.taxonomy.topics.find((t) => t.id === q.topic)?.notes ?? [];
  return [...new Set([...q.refs.map((r) => r.split('#')[0]), ...topic])].filter(Boolean);
}

/** Only option keys that exist in the question, sorted ("BD"). */
export function normalizePick(pick: unknown, q: Question): string {
  const keys = new Set(q.options.map((o) => o.key));
  return [...new Set(String(pick ?? '').toUpperCase().match(/[A-H]/g) ?? [])].filter((k) => keys.has(k)).sort().join('');
}

export function buildAskPrompt(q: Question, question: string, pick: string, bank: BankState): string {
  const notes = notesFor(q, bank);
  const picked = q.options.filter((o) => pick.includes(o.key));
  const pickOk = !!pick && pick === [...q.answer].sort().join('');
  return [
    'Bạn là gia sư AWS Certified Solutions Architect – Associate (SAA-C03) cho một người học Việt Nam.',
    'Người học đang xem lại MỘT câu trắc nghiệm trong app luyện thi và hỏi bạn một câu về nó. Trả lời đúng câu hỏi đó.',
    '',
    'Yêu cầu:',
    '- Tiếng Việt, TỐI ĐA 220 từ, Markdown gọn (gạch đầu dòng, **đậm** từ khoá quyết định). Giữ thuật ngữ AWS bằng tiếng Anh.',
    '- Gọi các lựa chọn bằng NỘI DUNG (vd “Multi-AZ deployment”), KHÔNG dùng chữ cái A/B/C/D — app xáo thứ tự đáp án nên chữ cái người học thấy khác.',
    '- Bám đề: chỉ ra từ khoá/qualifier trong đề quyết định đáp án; nếu người học chọn sai, nói vì sao lựa chọn đó hấp dẫn nhưng sai.',
    `- Chỉ nêu con số/giới hạn khi chắc chắn. Được dùng Grep/Read (chỉ đọc) trong notes \`*.md\` ở thư mục gốc repo để kiểm chứng${notes.length ? ` (gợi ý: ${notes.join(', ')})` : ''}; nếu có dùng, ghi tên file notes ở cuối để người học đọc thêm.`,
    '- Nếu đề/đáp án trong ngân hàng có vẻ sai hoặc mơ hồ, nói thẳng và gợi ý bấm “🐞 Báo lỗi”.',
    '- Chỉ đọc notes; KHÔNG đọc, tìm hay trích các câu hỏi khác của ngân hàng (`trainer/`, `practice-exams/`) — một số câu đang được giữ kín để đo điểm thật của người học.',
    '- Không sửa file, không chạy lệnh. Trả lời ngay, không mở đầu/kết thúc xã giao.',
    '',
    `## Câu hỏi \`${q.id}\` (${q.domain}${q.task ? ` · task ${q.task}` : ''} · ${q.topic}${q.services.length ? ` · ${q.services.join(', ')}` : ''})`,
    '',
    q.stem.trim(),
    '',
    '## Các lựa chọn (chữ cái chỉ là khoá nội bộ)',
    ...q.options.map((o) => `- [${o.key}] ${o.text}${q.answer.includes(o.key) ? '  ✅ đáp án đúng' : ''}${pick.includes(o.key) ? '  ← người học đã chọn' : ''}`),
    '',
    '## Giải thích hiện có trong ngân hàng',
    q.explanation.trim() || '(trống)',
    '',
    pick ? `Người học đã chọn: ${picked.map((o) => `“${o.text}”`).join(' + ')} (${pickOk ? 'đúng' : 'sai'}).` : 'Người học không cho biết đã chọn gì.',
    '',
    '## Câu hỏi của người học',
    question,
  ].join('\n');
}

/** Paths (relative to the repo root = the run's cwd) the "Hỏi AI" run may not read: everything but the study notes. */
export const ASK_DENY = ['Read(./trainer/**)', 'Read(./practice-exams/**)'];

export function askArgs(prompt: string, cfg: AppConfig, version?: string): string[] {
  const modern = versionAtLeast(version, MODERN_CLI);
  const args = [
    '-p',
    prompt,
    '--output-format',
    'json',
    '--permission-mode',
    'dontAsk',
    ...(modern ? ['--permission-prompts', 'none', '--no-session-persistence', '--tools', 'Read,Glob,Grep'] : []),
    // Read deny rules also cover Grep / Glob: the bank, sealed forms, batch files and the exam sources stay out of reach
    '--disallowedTools',
    ...ASK_DENY,
    '--allowedTools',
    'Glob',
    'Grep',
  ];
  const model = modelFor('ask', cfg);
  if (model) args.push('--model', model);
  return args;
}

interface CliResult {
  answer: string;
  costUsd?: number;
  model?: string;
}

/** `--output-format json` prints one result object (an array of messages with --verbose): take the result. */
export function parseCliJson(stdout: string): Record<string, unknown> | undefined {
  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  let v = tryParse(stdout.trim());
  if (v === undefined) {
    const lines = stdout.trim().split('\n').reverse();
    for (const l of lines) if ((v = tryParse(l.trim())) !== undefined) break;
  }
  if (Array.isArray(v)) v = [...v].reverse().find((m) => m && typeof m === 'object' && (m as { type?: unknown }).type === 'result');
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}

/** [v5 τ] One finished `claude -p --output-format json` call. */
export interface CliRun {
  result: Record<string, unknown>; // the CLI's result object (`structured_output` with --json-schema)
  text: string; // result.result, trimmed
  costUsd?: number;
  model?: string; // the answering model (most expensive modelUsage entry)
  sessionId?: string; // for --resume
}

/** [v5 τ] Shape of the `modelUsage` map: the most expensive entry is the answering model. */
function answeringModel(res: Record<string, unknown>): string | undefined {
  const usage = res.modelUsage && typeof res.modelUsage === 'object' ? Object.entries(res.modelUsage as Record<string, { costUSD?: number }>) : [];
  return usage.sort((a, b) => (b[1]?.costUSD ?? 0) - (a[1]?.costUSD ?? 0))[0]?.[0];
}

/**
 * [v5 τ] Runs one `claude -p … --output-format json` call from the repo root (claude.ai login unless coach.use_api_key) and
 * returns its result object. `input` = the prompt on stdin (no `-p <prompt>` argument: long prompts stay clear of the
 * Windows command-line limit). Rejects with an HttpError (502 CLI error, 504 timeout, 499 cancelled) — callers show the message.
 */
export function runClaudeCli(
  bin: string,
  args: string[],
  cfg: AppConfig,
  opts: { timeoutMs: number; timeoutMessage: string; input?: string; signal?: AbortSignal; structured?: boolean },
): Promise<CliRun> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new HttpError(499, 'Đã huỷ'));
    const { cmd, pre } = claudeCommand(bin);
    const stdin = opts.input !== undefined ? 'pipe' : 'ignore';
    const child = spawn(cmd, [...pre, ...args], { cwd: REPO_DIR, env: cliEnv(cfg), stdio: [stdin, 'pipe', 'pipe'], windowsHide: true });
    if (opts.input !== undefined) {
      child.stdin!.on('error', () => undefined); // the CLI may exit before reading everything (bad flag): `close` reports it
      child.stdin!.end(opts.input, 'utf8');
    }
    let out = '';
    let err = '';
    let why: 'timeout' | 'cancel' | undefined;
    child.stdout!.on('data', (c: Buffer) => (out += c.toString('utf8')));
    child.stderr!.on('data', (c: Buffer) => (err = (err + c.toString('utf8')).slice(-4000)));
    const stop = (reason: 'timeout' | 'cancel') => {
      why ??= reason;
      child.kill('SIGTERM');
    };
    const timer = setTimeout(() => stop('timeout'), opts.timeoutMs);
    const onAbort = () => stop('cancel');
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    const done = () => {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    };
    child.on('error', (e) => {
      done();
      reject(new HttpError(502, `Không chạy được Claude Code: ${e.message}`));
    });
    child.on('close', (code) => {
      done();
      if (why === 'timeout') return reject(new HttpError(504, opts.timeoutMessage));
      if (why === 'cancel') return reject(new HttpError(499, 'Đã huỷ'));
      const res = parseCliJson(out);
      const text = typeof res?.result === 'string' ? res.result.trim() : '';
      if (!res || res.is_error || code !== 0 || (!text && !opts.structured)) {
        const reason = text || err.trim().split('\n').slice(-3).join(' ') || `exit ${code}`;
        return reject(new HttpError(502, `Claude Code báo lỗi: ${reason.slice(0, 400)}`));
      }
      resolve({
        result: res,
        text,
        costUsd: typeof res.total_cost_usd === 'number' ? res.total_cost_usd : undefined,
        model: answeringModel(res),
        sessionId: typeof res.session_id === 'string' ? res.session_id : undefined,
      });
    });
  });
}

function runCli(bin: string, args: string[], cfg: AppConfig): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const { cmd, pre } = claudeCommand(bin);
    const child = spawn(cmd, [...pre, ...args], { cwd: REPO_DIR, env: cliEnv(cfg), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    let err = '';
    let timedOut = false;
    child.stdout!.on('data', (c: Buffer) => (out += c.toString('utf8')));
    child.stderr!.on('data', (c: Buffer) => (err = (err + c.toString('utf8')).slice(-4000)));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, ASK_TIMEOUT_MS);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new HttpError(502, `Không chạy được Claude Code: ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new HttpError(504, 'AI trả lời quá 4 phút — thử hỏi ngắn gọn hơn.'));
      const res = parseCliJson(out);
      const text = typeof res?.result === 'string' ? res.result.trim() : '';
      if (!res || res.is_error || code !== 0 || !text) {
        const why = text || err.trim().split('\n').slice(-3).join(' ') || `exit ${code}`;
        return reject(new HttpError(502, `Claude Code báo lỗi: ${why.slice(0, 400)}`));
      }
      // modelUsage also lists small auxiliary calls: the answering model is the most expensive entry
      const usage = res.modelUsage && typeof res.modelUsage === 'object' ? Object.entries(res.modelUsage as Record<string, { costUSD?: number }>) : [];
      const model = usage.sort((a, b) => (b[1]?.costUSD ?? 0) - (a[1]?.costUSD ?? 0))[0]?.[0];
      resolve({ answer: text.slice(0, 8000), costUsd: typeof res.total_cost_usd === 'number' ? res.total_cost_usd : undefined, model });
    });
  });
}

/** Answers one learner question about a bank question (slow: one Claude Code run, up to 4 min). */
export async function askQuestion(input: { qid?: unknown; question?: unknown; pick?: unknown }): Promise<QaEntry> {
  const qid = String(input.qid ?? '').trim();
  const question = String(input.question ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();
  const bank = loadBank();
  const q = bank.byId.get(qid);
  if (!q) throw new HttpError(400, 'Không có câu hỏi này trong ngân hàng');
  if (question.length < 2) throw new HttpError(400, 'Hãy nhập câu hỏi cho AI');
  if (question.length > MAX_QUESTION_CHARS) throw new HttpError(400, `Câu hỏi quá dài (tối đa ${MAX_QUESTION_CHARS} ký tự)`);
  const blocked = coachGuard();
  if (blocked) throw new HttpError(409, blocked);
  if (active >= MAX_CONCURRENT) throw new HttpError(429, `Đang có ${MAX_CONCURRENT} câu hỏi AI chạy cùng lúc — đợi một câu xong rồi hỏi tiếp.`);
  const cfg = loadConfig();
  const claude = findClaude(cfg);
  if (!claude.available || !claude.path) throw new HttpError(503, claude.hint ?? 'Không tìm thấy Claude Code CLI');
  const pick = normalizePick(input.pick, q);
  active++;
  try {
    const out = await runCli(claude.path, askArgs(buildAskPrompt(q, question, pick, bank), cfg, claude.version), cfg);
    const entry: QaEntry = { at: localIso(), question, answer: out.answer, ...(pick ? { pick } : {}), ...(out.costUsd !== undefined ? { costUsd: out.costUsd } : {}) };
    appendQa(qid, entry, out.model);
    return entry;
  } finally {
    active--;
  }
}

// ── coach/qa/<qid>.md ───────────────────────────────────────────────────────

export function qaFile(qid: string): string | undefined {
  return ID_RE.test(qid) && qid.length <= 80 ? path.join(QA_DIR, `${qid}.md`) : undefined;
}

const header = (qid: string) =>
  [
    `# 💬 Hỏi AI — \`${qid}\``,
    '',
    '> File tự sinh bởi trainer app (nút “🤖 Hỏi AI” và “🧑‍🏫 Gia sư”): mỗi mục là một câu người học hỏi và câu trả lời của AI,',
    '> hoặc một cuộc hội thoại với gia sư. AI Coach đọc các file này để biết người học còn mơ hồ ở đâu. Chỉ thêm mục mới, không sửa mục cũ.',
    '',
  ].join('\n');

/** No line of an appended block may look like an entry marker (`<!-- qa {…} -->`): HTML comments are escaped. */
const noMarkers = (s: string) => s.replace(/<!--/g, '&lt;!--');

/** Appends one entry. The machine-readable part lives in an HTML comment so union merges (two machines) stay parseable. */
export function appendQa(qid: string, entry: QaEntry, model?: string): void {
  const file = qaFile(qid);
  if (!file) throw new Error(`Invalid question id: ${qid}`);
  fs.mkdirSync(QA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, header(qid));
  const tutor = entry.kind === 'tutor';
  const meta = JSON.stringify({
    at: entry.at,
    q: entry.question,
    pick: entry.pick,
    costUsd: entry.costUsd,
    model,
    ...(tutor ? { kind: 'tutor', turns: entry.turns, calls: entry.calls, outcome: entry.outcome, rule: entry.rule } : {}),
  }).replace(/--/g, '-\\u002d');
  const block = tutor
    ? // [v5 τ] tutor dialog: the transcript is the body (tutor.ts renders it)
      ['', `<!-- qa ${meta} -->`, `### 🧑‍🏫 ${fmtLocal(entry.at)} · ${entry.question}${entry.pick ? ` · đã chọn ${entry.pick}` : ''}`, '', noMarkers(entry.answer.trim()), '']
    : [
        '',
        `<!-- qa ${meta} -->`,
        `### ❓ ${fmtLocal(entry.at)}${entry.pick ? ` · đã chọn ${entry.pick}` : ''}`,
        '',
        ...entry.question.split('\n').map((l) => `> ${l}`),
        '',
        ANSWER_HEADING,
        '',
        entry.answer.trim(),
        '',
      ];
  const prev = fs.readFileSync(file, 'utf8');
  fs.appendFileSync(file, (prev.endsWith('\n') ? '' : '\n') + block.join('\n'));
}

const TUTOR_OUTCOMES = new Set(['found', 'revealed', 'gave-up', 'capped', 'ended']);

export function parseQa(text: string): QaEntry[] {
  const src = text.replace(/\r\n?/g, '\n');
  const marks = [...src.matchAll(/^<!-- qa (\{.*\}) -->$/gm)];
  const out: QaEntry[] = [];
  marks.forEach((m, i) => {
    let meta: { at?: unknown; q?: unknown; pick?: unknown; costUsd?: unknown; kind?: unknown; turns?: unknown; calls?: unknown; outcome?: unknown; rule?: unknown };
    try {
      meta = JSON.parse(m[1]) as typeof meta;
    } catch {
      return;
    }
    if (typeof meta.at !== 'string' || typeof meta.q !== 'string') return;
    const body = src.slice((m.index ?? 0) + m[0].length, i + 1 < marks.length ? marks[i + 1].index : src.length);
    const common = {
      ...(typeof meta.pick === 'string' && meta.pick ? { pick: meta.pick } : {}),
      ...(typeof meta.costUsd === 'number' ? { costUsd: meta.costUsd } : {}),
    };
    if (meta.kind === 'tutor') {
      // [v5 τ] the transcript = everything after the "### 🧑‍🏫 …" heading line
      const transcript = body.replace(/^\s*\n?### [^\n]*\n?/, '').replace(/\n\s*(---|\*\*\*)\s*$/, '').trim();
      out.push({
        at: meta.at,
        question: meta.q,
        answer: transcript,
        ...common,
        kind: 'tutor',
        ...(typeof meta.turns === 'number' ? { turns: meta.turns } : {}),
        ...(typeof meta.calls === 'number' ? { calls: meta.calls } : {}),
        ...(typeof meta.outcome === 'string' && TUTOR_OUTCOMES.has(meta.outcome) ? { outcome: meta.outcome as QaEntry['outcome'] } : {}),
        ...(typeof meta.rule === 'string' && meta.rule ? { rule: meta.rule } : {}),
      });
      return;
    }
    const k = body.indexOf(ANSWER_HEADING);
    const answer = (k >= 0 ? body.slice(k + ANSWER_HEADING.length) : '').replace(/\n\s*(---|\*\*\*)\s*$/, '').trim();
    out.push({ at: meta.at, question: meta.q, answer, ...common });
  });
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** Q&A log of one question, oldest first. */
export function loadQa(qid: string): QaEntry[] {
  const file = qaFile(qid);
  if (!file || !fs.existsSync(file)) return [];
  return parseQa(fs.readFileSync(file, 'utf8'));
}

// Parsed Q&A files, re-read only when a file's mtime / size changes (appends do not touch the directory mtime).
const qaFiles = new Map<string, { sig: string; entries: QaEntry[] }>();
let qaList: { dir: string; dirSig: string; names: string[] } | undefined;

function allQa(): { qid: string; e: QaEntry }[] {
  let dirSig: string;
  try {
    dirSig = String(fs.statSync(QA_DIR).mtimeMs);
  } catch {
    return [];
  }
  if (qaList?.dir !== QA_DIR || qaList.dirSig !== dirSig) {
    const names = fs.readdirSync(QA_DIR).filter((f) => f.endsWith('.md') && !f.startsWith('.') && !f.startsWith('_'));
    const keep = new Set(names.map((f) => path.join(QA_DIR, f)));
    for (const k of qaFiles.keys()) if (!keep.has(k)) qaFiles.delete(k);
    qaList = { dir: QA_DIR, dirSig, names };
  }
  const out: { qid: string; e: QaEntry }[] = [];
  for (const f of qaList.names) {
    const file = path.join(QA_DIR, f);
    let sig: string;
    try {
      const st = fs.statSync(file);
      sig = `${st.mtimeMs}:${st.size}`;
    } catch {
      continue;
    }
    let cached = qaFiles.get(file);
    if (cached?.sig !== sig) {
      try {
        cached = { sig, entries: parseQa(fs.readFileSync(file, 'utf8')) };
      } catch {
        continue; // unreadable file — skip
      }
      qaFiles.set(file, cached);
    }
    const qid = f.slice(0, -3);
    for (const e of cached.entries) out.push({ qid, e });
  }
  return out;
}

/**
 * [v5 τ] AI replies of finished tutor dialogs started on or after `sinceMs` (the daily cap; open dialogs are counted by
 * tutor.ts). A dialog is attributed to the day it started.
 */
export function tutorCallsSince(sinceMs: number): number {
  let n = 0;
  for (const { e } of allQa()) if (e.kind === 'tutor' && Date.parse(e.at) >= sinceMs) n += e.calls ?? 1;
  return n;
}

/** Number and API-equivalent cost of asks since `sinceMs` (for CostSummary) — [v5 τ] a tutor dialog counts as one ask. */
export function askCostsSince(sinceMs: number): { count: number; costUsd: number } {
  let count = 0;
  let cost = 0;
  for (const { e } of allQa()) {
    if (Date.parse(e.at) < sinceMs) continue;
    count++;
    cost += e.costUsd ?? 0;
  }
  return { count, costUsd: Math.round(cost * 10000) / 10000 };
}

const oneLine = (s: string, max: number) => {
  const t = s
    .replace(/\*\*|__|`/g, '')
    .replace(/^[\s#>*-]+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
};

/** Markdown lines appended to coach/snapshot.md: the learner's recent questions to the AI. */
export function qaSnapshotLines(bank: BankState): string[] {
  const sealed = sealedIds(); // questions asked about before they were sealed are not named (the coach must not see them)
  const all = allQa()
    .filter((x) => !sealed.has(x.qid))
    .sort((a, b) => Date.parse(b.e.at) - Date.parse(a.e.at));
  const o = ['## 15. Câu người học hỏi AI (`trainer/coach/qa/`)', ''];
  if (!all.length) {
    o.push('_Chưa có._', '');
    return o;
  }
  const recent = all.filter((x) => Date.parse(x.e.at) >= Date.now() - 30 * DAY_MS).length;
  const qids = new Set(all.map((x) => x.qid));
  o.push(
    `> Câu người học tự hỏi khi xem lại — dấu hiệu khái niệm còn mơ hồ (cân nhắc biến thể/contrast hoặc sửa giải thích); 🧑‍🏫 = hội thoại với gia sư (quy tắc chốt đã vào \`coach/notebook/\`). Tổng ${all.length} câu hỏi về ${qids.size} câu · 30 ngày: ${recent}. Chi tiết: \`trainer/coach/qa/<id>.md\`.`,
    '',
  );
  for (const { qid, e } of all.slice(0, 15)) {
    const q = bank.byId.get(qid);
    const where = q ? ` (${q.topic}${q.services.length ? ` · ${q.services.slice(0, 3).join(', ')}` : ''})` : ' (⚠️ id không còn trong ngân hàng)';
    const pick = e.pick ? ` · đã chọn ${e.pick}${q ? (e.pick === [...q.answer].sort().join('') ? ' ✓' : ' ✗') : ''}` : '';
    if (e.kind === 'tutor') {
      // [v5 τ] a tutor dialog: how it ended + the closing rule (the transcript stays in the file)
      o.push(`- ${fmtLocal(e.at)} · \`${qid}\`${where}${pick} — 🧑‍🏫 ${oneLine(e.question, 80)}${e.rule ? ` → 📌 ${oneLine(e.rule, 160)}` : ''}`);
      continue;
    }
    o.push(`- ${fmtLocal(e.at)} · \`${qid}\`${where}${pick} — ❓ ${oneLine(e.question, 160)} → 💡 ${oneLine(e.answer, 160)}`);
  }
  o.push('');
  return o;
}
