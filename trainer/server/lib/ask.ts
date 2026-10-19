// "Ask AI about this question": a read-only Claude Code run (`claude -p --output-format json`, tools limited to
// Read/Glob/Grep inside the repo) that answers the learner in Vietnamese. Every Q&A is appended to
// coach/qa/<qid>.md — the coach reads these (snapshot §15) to see what still confuses the learner.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { QA_DIR, REPO_DIR, loadConfig, type AppConfig } from '../config.ts';
import { HttpError } from '../http.ts';
import { loadBank, type BankState } from './bank.ts';
import { MODERN_CLI, claudeCommand, cliEnv, coachGuard, findClaude, modelFor, versionAtLeast } from './coach-runner.ts';
import { ID_RE } from './pack-format.ts';
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
    '> File tự sinh bởi trainer app (nút “🤖 Hỏi AI”): mỗi mục là một câu người học hỏi và câu trả lời của AI.',
    '> AI Coach đọc các file này để biết người học còn mơ hồ ở đâu. Chỉ thêm mục mới, không sửa mục cũ.',
    '',
  ].join('\n');

/** Appends one entry. The machine-readable part lives in an HTML comment so union merges (two machines) stay parseable. */
export function appendQa(qid: string, entry: QaEntry, model?: string): void {
  const file = qaFile(qid);
  if (!file) throw new Error(`Invalid question id: ${qid}`);
  fs.mkdirSync(QA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, header(qid));
  const meta = JSON.stringify({ at: entry.at, q: entry.question, pick: entry.pick, costUsd: entry.costUsd, model }).replace(/--/g, '-\\u002d');
  const block = [
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
  ].join('\n');
  const prev = fs.readFileSync(file, 'utf8');
  fs.appendFileSync(file, (prev.endsWith('\n') ? '' : '\n') + block);
}

export function parseQa(text: string): QaEntry[] {
  const src = text.replace(/\r\n?/g, '\n');
  const marks = [...src.matchAll(/^<!-- qa (\{.*\}) -->$/gm)];
  const out: QaEntry[] = [];
  marks.forEach((m, i) => {
    let meta: { at?: unknown; q?: unknown; pick?: unknown; costUsd?: unknown };
    try {
      meta = JSON.parse(m[1]) as typeof meta;
    } catch {
      return;
    }
    if (typeof meta.at !== 'string' || typeof meta.q !== 'string') return;
    const body = src.slice((m.index ?? 0) + m[0].length, i + 1 < marks.length ? marks[i + 1].index : src.length);
    const k = body.indexOf(ANSWER_HEADING);
    const answer = (k >= 0 ? body.slice(k + ANSWER_HEADING.length) : '').replace(/\n\s*(---|\*\*\*)\s*$/, '').trim();
    out.push({
      at: meta.at,
      question: meta.q,
      answer,
      ...(typeof meta.pick === 'string' && meta.pick ? { pick: meta.pick } : {}),
      ...(typeof meta.costUsd === 'number' ? { costUsd: meta.costUsd } : {}),
    });
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

/** Number and API-equivalent cost of asks since `sinceMs` (for CostSummary). */
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
  const all = allQa().sort((a, b) => Date.parse(b.e.at) - Date.parse(a.e.at));
  const o = ['## 15. Câu người học hỏi AI (`trainer/coach/qa/`)', ''];
  if (!all.length) {
    o.push('_Chưa có._', '');
    return o;
  }
  const recent = all.filter((x) => Date.parse(x.e.at) >= Date.now() - 30 * DAY_MS).length;
  const qids = new Set(all.map((x) => x.qid));
  o.push(
    `> Câu người học tự hỏi khi xem lại — dấu hiệu khái niệm còn mơ hồ (cân nhắc biến thể/contrast hoặc sửa giải thích). Tổng ${all.length} câu hỏi về ${qids.size} câu · 30 ngày: ${recent}. Chi tiết: \`trainer/coach/qa/<id>.md\`.`,
    '',
  );
  for (const { qid, e } of all.slice(0, 15)) {
    const q = bank.byId.get(qid);
    const where = q ? ` (${q.topic}${q.services.length ? ` · ${q.services.slice(0, 3).join(', ')}` : ''})` : ' (⚠️ id không còn trong ngân hàng)';
    const pick = e.pick ? ` · đã chọn ${e.pick}${q ? (e.pick === [...q.answer].sort().join('') ? ' ✓' : ' ✗') : ''}` : '';
    o.push(`- ${fmtLocal(e.at)} · \`${qid}\`${where}${pick} — ❓ ${oneLine(e.question, 160)} → 💡 ${oneLine(e.answer, 160)}`);
  }
  o.push('');
  return o;
}
