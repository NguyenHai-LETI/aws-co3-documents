// [v5] π MCP server for the SAA-C03 Trainer — study by chatting with Claude (Claude Code, Claude Desktop, the phone via
// Remote Control). Dependency-free JSON-RPC 2.0 over stdio (newline-delimited messages, logs on stderr), dual-era:
//   modern (2026-07-28): stateless, every request carries `_meta["io.modelcontextprotocol/protocolVersion"]`;
//                        `server/discover`; unsupported versions → -32022 with the supported list
//   legacy (2025-11-25 … 2024-11-05): `initialize` handshake with version negotiation.
// A thin client of the running app (http://127.0.0.1:$TRAINER_PORT|$PORT|3003, header X-Trainer: 1) — no grading logic
// here: POST /api/tests builds the quiz, POST /api/results stores it (`source: chat`, kept out of speed statistics).
// The answer key stays in this process: next_question shows the stem and options only; answer reveals the key and a
// short explanation after the learner chose. Quiz state is referenced by an explicit handle (`quiz`, default: the latest).
// Run: node trainer/scripts/mcp-server.ts (repo-root .mcp.json) — needs Node ≥ 22.18 and the app running (npm start).
import readline from 'node:readline';
import crypto from 'node:crypto';
import type { AnswerInput, Question, SearchResponse, StatsResponse, TestSession, TopicDef } from '../shared/types.ts';

const PORT = Number(process.env.TRAINER_PORT || process.env.PORT || 3003);
const BASE = `http://127.0.0.1:${PORT}`;
const MODERN = ['2026-07-28'];
const LEGACY = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'saa-trainer', title: 'SAA-C03 Trainer', version: '5.0.0' };
const META = 'io.modelcontextprotocol';
const LABELS = 'ABCDEFGH';
const QUIZ_TTL_MS = 6 * 3600_000;
const MAX_T = 900;

const INSTRUCTIONS = [
  'Quiz the learner on AWS SAA-C03 questions from their own trainer app (results are saved for spaced repetition).',
  'Flow: start_quiz → next_question → show the stem and ALL options verbatim with their letters, then wait for the learner → answer with their letters → explain → repeat → finish.',
  'Never guess, hint at or reveal the correct option before `answer` returns it; never answer for the learner. Reply in the learner’s language (usually Vietnamese).',
  'If the learner is unsure, pass unsure: true. weak_areas suggests what to practise; search_notes finds the study notes; report_issue flags a wrong / unclear question.',
].join(' ');

// ── app client ──────────────────────────────────────────────────────────────

class AppError extends Error {}

const DOWN = `Trainer chưa chạy ở ${BASE}. Mở app trước: \`cd trainer && npm start\` (hoặc start.command / start.bat, hoặc chạy nền: npm run service -- install) rồi thử lại. Cổng khác: đặt TRAINER_PORT cho MCP server.`;

async function app<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(BASE + path, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json', 'X-Trainer': '1' } : {},
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new AppError(DOWN);
  }
  const text = await r.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!r.ok) throw new AppError(`Trainer trả lỗi ${r.status}: ${(data as { error?: string })?.error ?? text.slice(0, 300)}`);
  return data as T;
}

// ── quiz state (in this process only) ──────────────────────────────────────

interface Quiz {
  id: string;
  session: TestSession;
  byId: Map<string, Question>;
  answers: Map<string, AnswerInput>;
  viewedAt: Map<string, number>;
  current?: string; // question id shown by next_question and not answered yet
  started: string;
  used: number;
}

const quizzes = new Map<string, Quiz>();
let latest: string | undefined;

function pickQuiz(id: unknown): Quiz {
  const now = Date.now();
  for (const [k, q] of quizzes) if (now - q.used > QUIZ_TTL_MS) quizzes.delete(k);
  const key = typeof id === 'string' && id ? id : latest;
  const q = key ? quizzes.get(key) : undefined;
  if (!q) throw new AppError('Không có bài quiz đang mở (hết hạn sau 6 giờ không dùng, hoặc MCP server vừa khởi động lại) — gọi start_quiz.');
  q.used = now;
  return q;
}

/** Display order of a question's options (the session's shuffled order when there is one). */
function order(quiz: Quiz, qid: string): string[] {
  const q = quiz.byId.get(qid)!;
  return quiz.session.questions.find((r) => r.id === qid)?.order ?? q.options.map((o) => o.key);
}

const plain = (md: string) =>
  md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|`)/g, '')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?)/gm, '')
    .trim();

/** A string argument (tool arguments are untrusted JSON: objects, arrays, `{toString: 1}` …). */
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

/** First paragraph of the explanation + the 🇻🇳 summary line. */
export function shortExplanation(md: string, max = 500): string {
  const src = md.replace(/\r\n?/g, '\n');
  const vi = /^\s*(?:>\s*)?(🇻🇳.+)$/mu.exec(src)?.[1]?.trim();
  const first = src.split(/\n\s*\n|\n(?=\s*[-*]\s)|\n(?=\s*>)/)[0] ?? '';
  let text = plain(first).replace(/\s+/g, ' ');
  if (text.length > max) text = text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
  return vi && !text.includes(vi) ? `${text}\n${plain(vi)}` : text;
}

/**
 * "B", "b, d", "BD", "B và D", ["B","D"] → unique labels. Only standalone tokens count (split on anything that is not a
 * letter or digit, Unicode-aware): a single A–H, or a run of 2–5 capitals A–H — never letters inside words ("chọn B" → B).
 */
export function parseLetters(v: unknown): string[] {
  const raw = Array.isArray(v) ? v.map(str).join(' ') : str(v);
  const out: string[] = [];
  for (const tok of raw.split(/[^\p{L}\p{N}]+/u)) {
    const letters = /^[A-Ha-h]$/.test(tok) ? tok.toUpperCase() : /^[A-H]{2,5}$/.test(tok) ? tok : '';
    for (const c of letters) if (!out.includes(c)) out.push(c);
  }
  return out;
}

// ── tools ───────────────────────────────────────────────────────────────────

interface ToolResult {
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}
const ok = (text: string, structured?: Record<string, unknown>): ToolResult => ({ content: [{ type: 'text', text }], ...(structured ? { structuredContent: structured } : {}) });
const err = (text: string): ToolResult => ({ content: [{ type: 'text', text }], isError: true });

const quizArg = { quiz: { type: 'string', description: 'Quiz handle returned by start_quiz (default: the latest quiz).' } };

export const TOOLS = [
  {
    name: 'start_quiz',
    title: 'Bắt đầu quiz',
    description: 'Start a practice quiz from the learner’s trainer. mode: srs = reviews due today (spaced repetition), weak = weakest topics, topic = one topic (give `topic`), quick = 10 mixed questions, today = the learner’s planned session for today (give `minutes`). Returns a quiz handle; then call next_question.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['srs', 'weak', 'topic', 'quick', 'today'], description: 'What to practise.' },
        n: { type: 'integer', minimum: 1, maximum: 50, description: 'Number of questions (default 10; not used by today).' },
        topic: { type: 'string', description: 'mode topic: topic id or name, e.g. "storage", "S3", "Mạng".' },
        minutes: { type: 'integer', minimum: 5, maximum: 120, description: 'mode today: minute budget (default: the learner’s daily goal).' },
      },
      required: ['mode'],
      additionalProperties: false,
    },
  },
  {
    name: 'next_question',
    title: 'Câu tiếp theo',
    description: 'The next question of the quiz: stem and options with letters only (the answer stays hidden). Show them verbatim and wait for the learner’s choice.',
    inputSchema: { type: 'object', properties: quizArg, additionalProperties: false },
  },
  {
    name: 'answer',
    title: 'Trả lời',
    description: 'Submit the learner’s choice for the current question (letters as shown, e.g. "B" or "B,D"). Returns right / wrong, the correct option(s) and a short explanation.',
    inputSchema: {
      type: 'object',
      properties: {
        pick: { type: 'string', description: 'The learner’s letter(s), e.g. "C" or "A,D".' },
        unsure: { type: 'boolean', description: 'The learner was not sure (counts as a weaker review).' },
        why: { type: 'string', description: 'Optional: why the learner chose it (kept with the result).' },
        ...quizArg,
      },
      required: ['pick'],
      additionalProperties: false,
    },
  },
  {
    name: 'finish',
    title: 'Nộp bài',
    description: 'Save the quiz in the trainer (scores, spaced-repetition schedule, statistics). Unanswered questions go back to the queue.',
    inputSchema: { type: 'object', properties: quizArg, additionalProperties: false },
  },
  {
    name: 'weak_areas',
    title: 'Phần còn yếu',
    description: 'The learner’s weakest topics and exam-guide tasks, reviews due today and readiness — to decide what to practise.',
    inputSchema: { type: 'object', additionalProperties: false },
  },
  {
    name: 'search_notes',
    title: 'Tìm trong tài liệu',
    description: 'Full-text search in the learner’s SAA-C03 study notes (Vietnamese / English). Returns note sections with snippets.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Words to search for.' }, limit: { type: 'integer', minimum: 1, maximum: 20 } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'report_issue',
    title: 'Báo lỗi câu hỏi',
    description: 'Flag a question as wrong / ambiguous / outdated / unclear for the learner’s AI coach to review. Default question: the current (or last) one of the quiz.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['wrong-key', 'ambiguous', 'outdated', 'explanation', 'metadata', 'typo', 'other'] },
        note: { type: 'string', description: 'What is wrong, in the learner’s words.' },
        qid: { type: 'string', description: 'Question id (default: the quiz’s current / last question).' },
        ...quizArg,
      },
      required: ['type', 'note'],
      additionalProperties: false,
    },
  },
];

async function resolveTopic(v: unknown): Promise<string> {
  const want = str(v).trim().toLowerCase();
  if (!want) throw new AppError('mode topic cần `topic` (vd "storage", "S3").');
  const meta = await app<{ topics: TopicDef[]; services: { name: string; topic: string }[] }>('GET', '/api/meta');
  const hit =
    meta.topics.find((t) => t.id.toLowerCase() === want || t.label.toLowerCase() === want) ??
    meta.topics.find((t) => t.label.toLowerCase().includes(want) || t.id.toLowerCase().includes(want)) ??
    meta.topics.find((t) => t.id === meta.services.find((s) => s.name.toLowerCase() === want || s.name.toLowerCase().replace(/^(amazon|aws)\s+/, '') === want)?.topic);
  if (!hit) throw new AppError(`Không có chủ đề "${v}". Chủ đề: ${meta.topics.map((t) => `${t.id} (${t.label})`).join(', ')}`);
  return hit.id;
}

async function startQuiz(a: Record<string, unknown>): Promise<ToolResult> {
  const mode = str(a.mode);
  if (!['srs', 'weak', 'topic', 'quick', 'today'].includes(mode)) return err('mode phải là srs | weak | topic | quick | today');
  const n = Math.min(50, Math.max(1, Math.round(Number(a.n) || 10)));
  const req: Record<string, unknown> = { mode, count: n, feedback: 'practice', source: 'chat', shuffleOptions: true };
  if (mode === 'topic') req.filters = { topics: [await resolveTopic(a.topic)] };
  if (mode === 'today') {
    delete req.count;
    if (Number(a.minutes) > 0) req.budgetMinutes = Math.round(Number(a.minutes));
  }
  const built = await app<{ session: TestSession; questions: Question[] }>('POST', '/api/tests', req);
  const session: TestSession = { ...built.session, source: 'chat', title: `💬 ${built.session.title}` };
  const id = `quiz-${crypto.randomBytes(4).toString('hex')}`;
  quizzes.set(id, { id, session, byId: new Map(built.questions.map((q) => [q.id, q])), answers: new Map(), viewedAt: new Map(), started: new Date().toISOString(), used: Date.now() });
  latest = id;
  const notes = session.notes.length ? `\n(${session.notes.join(' ')})` : '';
  return ok(`Đã tạo quiz "${session.title}" — ${session.questions.length} câu. Gọi next_question để lấy câu 1.${notes}`, { quiz: id, title: session.title, count: session.questions.length, mode });
}

function nextQuestion(a: Record<string, unknown>): ToolResult {
  const quiz = pickQuiz(a.quiz);
  const refs = quiz.session.questions;
  const idx = refs.findIndex((r) => !quiz.answers.has(r.id));
  if (idx < 0) return ok(`Đã trả lời hết ${refs.length} câu — gọi finish để lưu kết quả.`, { quiz: quiz.id, done: true, total: refs.length });
  const ref = refs[idx];
  const q = quiz.byId.get(ref.id)!;
  quiz.current = q.id;
  if (!quiz.viewedAt.has(q.id)) quiz.viewedAt.set(q.id, Date.now());
  const keys = order(quiz, q.id);
  const options = keys.map((k, i) => ({ label: LABELS[i], text: plain(q.options.find((o) => o.key === k)?.text ?? '') }));
  const choose = q.answer.length;
  const text = [
    `Câu ${idx + 1}/${refs.length}${choose > 1 ? ` · chọn ${choose} đáp án` : ''}`,
    '',
    plain(q.stem),
    '',
    ...options.map((o) => `${o.label}. ${o.text}`),
  ].join('\n');
  return ok(text, { quiz: quiz.id, index: idx + 1, total: refs.length, id: q.id, choose, stem: plain(q.stem), options });
}

function answer(a: Record<string, unknown>): ToolResult {
  const quiz = pickQuiz(a.quiz);
  const qid = quiz.current;
  if (!qid) return err(quiz.answers.size >= quiz.session.questions.length ? 'Không còn câu nào để trả lời — gọi finish.' : 'Chưa có câu nào đang hỏi — gọi next_question và cho người học xem câu trước.');
  const q = quiz.byId.get(qid)!;
  const keys = order(quiz, qid);
  const letters = parseLetters(a.pick);
  if (!letters.length || letters.some((l) => LABELS.indexOf(l) >= keys.length)) return err(`Chọn bằng chữ cái ${LABELS.slice(0, keys.length).split('').join(' / ')} (vd "B" hoặc "A,C").`);
  if (letters.length !== q.answer.length) return err(`Câu này cần chọn đúng ${q.answer.length} đáp án — hỏi lại người học.`);
  const pick = letters.map((l) => keys[LABELS.indexOf(l)]);
  const viewed = quiz.viewedAt.get(qid) ?? Date.now();
  const input: AnswerInput = { q: qid, pick, t: Math.min(MAX_T, Math.round((Date.now() - viewed) / 1000)) };
  if (a.unsure === true) input.unsure = true;
  if (typeof a.why === 'string' && a.why.trim()) input.why = a.why.trim().slice(0, 500);
  quiz.answers.set(qid, input);
  quiz.current = undefined;
  const right = [...pick].sort().join('') === [...q.answer].sort().join('');
  const keyLabels = q.answer.map((k) => LABELS[keys.indexOf(k)]).sort();
  const keyText = keyLabels.map((l) => `${l}. ${plain(q.options.find((o) => o.key === keys[LABELS.indexOf(l)])?.text ?? '')}`).join(' · ');
  const left = quiz.session.questions.filter((r) => !quiz.answers.has(r.id)).length;
  const done = quiz.answers.size;
  const correct = [...quiz.answers.entries()].filter(([id, x]) => [...x.pick].sort().join('') === [...quiz.byId.get(id)!.answer].sort().join('')).length;
  const text = [
    right ? `✅ Đúng — ${keyText}` : `❌ Sai — bạn chọn ${letters.join(', ')}; đáp án: ${keyText}`,
    '',
    shortExplanation(q.explanation),
    '',
    left ? `Đã làm ${done} câu (đúng ${correct}). Còn ${left} câu — next_question.` : `Xong ${done} câu (đúng ${correct}) — gọi finish để lưu.`,
  ].join('\n');
  return ok(text, { quiz: quiz.id, id: qid, correct: right, answer: keyLabels, remaining: left, score: { answered: done, correct } });
}

async function finish(a: Record<string, unknown>): Promise<ToolResult> {
  const quiz = pickQuiz(a.quiz);
  if (!quiz.answers.size) return err('Chưa trả lời câu nào — không có gì để lưu.');
  const viewedBlank = [...quiz.viewedAt.keys()].filter((id) => !quiz.answers.has(id)).map((id) => ({ q: id, pick: [], t: Math.min(MAX_T, Math.round((Date.now() - quiz.viewedAt.get(id)!) / 1000)) }));
  const answers = [...quiz.answers.values(), ...viewedBlank];
  const stoppedEarly = quiz.answers.size < quiz.session.questions.length;
  const body = {
    session: quiz.session,
    answers,
    startedAt: quiz.started,
    finishedAt: new Date().toISOString(),
    timedOut: false,
    timeUsed: answers.reduce((s, x) => s + x.t, 0),
    ...(stoppedEarly ? { stoppedEarly: true } : {}),
  };
  const r = await app<{ attempt: { id: string; correct: number; total: number; score: number; answered: number } }>('POST', '/api/results', body);
  quizzes.delete(quiz.id);
  if (latest === quiz.id) latest = undefined;
  const at = r.attempt;
  return ok(`Đã lưu vào trainer: ${at.correct}/${at.total} câu đúng (${at.score}%)${stoppedEarly ? ' · dừng sớm, câu chưa làm quay lại hàng chờ' : ''}. Xem chi tiết: http://localhost:${PORT}/#/result/${encodeURIComponent(at.id)}`, { attempt: at.id, correct: at.correct, total: at.total, score: at.score });
}

async function weakAreas(): Promise<ToolResult> {
  const s = await app<StatsResponse>('GET', '/api/stats');
  const t = s.totals;
  const weak = <B extends { label: string; attempts: number; accuracy: number; lo?: number; needMore?: number }>(list: B[] | undefined, n: number) =>
    (list ?? [])
      .filter((b) => b.attempts >= 3)
      .sort((x, y) => (x.lo ?? x.accuracy) - (y.lo ?? y.accuracy))
      .slice(0, n);
  const line = (b: { label: string; attempts: number; accuracy: number; lo?: number; needMore?: number }) => `- ${b.label}: ${Math.round(b.accuracy)}% (${b.attempts} câu${b.needMore ? `, cần ~${b.needMore} câu nữa để chắc` : ''})`;
  const topics = weak(s.byTopic, 5);
  const tasks = weak(s.byTask, 3);
  const text = [
    `Sẵn sàng ≈ ${Math.round(t.readiness)}% (${t.readinessConfidence === 'low' ? 'ít dữ liệu' : `khoảng ${Math.round(t.readinessLow)}–${Math.round(t.readinessHigh)}%`}) · ${t.answers} câu đã làm · ${t.dueToday} câu đến hạn hôm nay${t.backlog ? ` (+${t.backlog} tồn)` : ''}.`,
    topics.length ? `Chủ đề yếu nhất:\n${topics.map(line).join('\n')}` : 'Chưa đủ dữ liệu theo chủ đề (cần ≥ 3 câu mỗi chủ đề).',
    tasks.length ? `Task đề thi yếu nhất:\n${tasks.map(line).join('\n')}` : '',
    'Gợi ý: start_quiz {mode: "weak"} hoặc {mode: "srs"} cho câu đến hạn.',
  ]
    .filter(Boolean)
    .join('\n\n');
  return ok(text, { readiness: t.readiness, due: t.dueToday, topics, tasks });
}

async function searchNotes(a: Record<string, unknown>): Promise<ToolResult> {
  const q = str(a.query).trim().slice(0, 200);
  if (!q) return err('query trống.');
  const limit = Math.min(20, Math.max(1, Math.round(Number(a.limit) || 6)));
  const r = await app<SearchResponse>('GET', `/api/search?scope=notes&limit=${limit}&q=${encodeURIComponent(q)}`);
  if (!r.hits.length) return ok(`Không tìm thấy "${q}" trong tài liệu.`, { hits: [] });
  const hits = r.hits.map((h) => ({ file: h.id, heading: h.title, anchor: h.anchor, snippet: h.snippet }));
  return ok(hits.map((h) => `■ ${h.heading} — ${h.file}${h.anchor ? `#${h.anchor}` : ''}\n${h.snippet}`).join('\n\n'), { hits });
}

async function reportIssue(a: Record<string, unknown>): Promise<ToolResult> {
  let qid = typeof a.qid === 'string' && a.qid ? a.qid : undefined;
  if (!qid) {
    const quiz = pickQuiz(a.quiz);
    qid = quiz.current ?? [...quiz.answers.keys()].at(-1);
  }
  if (!qid) return err('Chưa có câu nào trong quiz — truyền qid.');
  await app('POST', '/api/issues', { qid, type: str(a.type) || 'other', note: str(a.note).slice(0, 1000) });
  return ok(`Đã ghi báo lỗi cho câu ${qid} — AI Coach sẽ xem lại ở lượt chạy tới.`, { qid });
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case 'start_quiz':
        return await startQuiz(args);
      case 'next_question':
        return nextQuestion(args);
      case 'answer':
        return answer(args);
      case 'finish':
        return await finish(args);
      case 'weak_areas':
        return await weakAreas();
      case 'search_notes':
        return await searchNotes(args);
      case 'report_issue':
        return await reportIssue(args);
    }
  } catch (e) {
    if (e instanceof AppError) return err(e.message);
    throw e;
  }
  throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
}

// ── JSON-RPC over stdio ─────────────────────────────────────────────────────

type Id = string | number;
interface Msg {
  jsonrpc?: unknown;
  id?: Id | null;
  method?: unknown;
  params?: Record<string, unknown>;
}

const rpcError = (id: Id | null, code: number, message: string, data?: unknown) => ({ jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } });

/** One message → its response (undefined for notifications and stray responses). */
export async function handle(msg: Msg): Promise<unknown> {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0') return rpcError(null, -32600, 'Invalid Request');
  if (msg.id !== undefined && msg.id !== null && typeof msg.id !== 'string' && typeof msg.id !== 'number') return rpcError(null, -32600, 'Invalid Request: id must be a string or a number');
  const isRequest = msg.id !== undefined && msg.id !== null;
  if (typeof msg.method !== 'string') return isRequest ? rpcError(msg.id!, -32600, 'Invalid Request') : undefined;
  if (!isRequest) return undefined; // notifications: initialized, cancelled, … — no response
  const id = msg.id as Id;
  if (msg.params !== undefined && (msg.params === null || typeof msg.params !== 'object' || Array.isArray(msg.params))) return rpcError(id, -32602, 'Invalid params: params must be an object');
  const params = msg.params ?? {};
  const meta = (params._meta && typeof params._meta === 'object' ? params._meta : {}) as Record<string, unknown>;
  const version = meta[`${META}/protocolVersion`];
  let modern = false;
  if (msg.method === 'initialize') {
    const asked = str(params.protocolVersion);
    return {
      jsonrpc: '2.0',
      id,
      result: { protocolVersion: LEGACY.includes(asked) ? asked : LEGACY[0], capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS },
    };
  }
  if (typeof version === 'string') {
    if (![...MODERN, ...LEGACY].includes(version)) return rpcError(id, -32022, 'Unsupported protocol version', { supported: [...MODERN, ...LEGACY], requested: version });
    modern = MODERN.includes(version);
    const caps = meta[`${META}/clientCapabilities`];
    if (modern && (caps === null || typeof caps !== 'object' || Array.isArray(caps))) {
      return rpcError(id, -32602, `Invalid params: _meta["${META}/clientCapabilities"] is required`);
    }
  } else if (msg.method === 'server/discover') {
    return rpcError(id, -32602, `Invalid params: _meta["${META}/protocolVersion"] is required`);
  }
  const done = (result: Record<string, unknown>) => ({ jsonrpc: '2.0', id, result: modern ? { resultType: 'complete', ...result, _meta: { [`${META}/serverInfo`]: SERVER_INFO } } : result });
  try {
    switch (msg.method) {
      case 'server/discover':
        return done({ supportedVersions: [...MODERN, ...LEGACY], capabilities: { tools: { listChanged: false } }, instructions: INSTRUCTIONS });
      case 'ping':
        return done({});
      case 'tools/list':
        return done({ tools: TOOLS });
      case 'tools/call': {
        const name = str(params.name);
        if (!TOOLS.some((t) => t.name === name)) return rpcError(id, -32602, `Unknown tool: ${name}`);
        const args = params.arguments && typeof params.arguments === 'object' ? (params.arguments as Record<string, unknown>) : {};
        return done({ ...(await callTool(name, args)) });
      }
      default:
        return rpcError(id, -32601, `Method not found: ${msg.method}`);
    }
  } catch (e) {
    const code = (e as { code?: number }).code;
    return rpcError(id, typeof code === 'number' ? code : -32603, (e as Error).message);
  }
}

function send(obj: unknown) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function serve() {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  let pending = 0;
  let closed = false;
  const maybeExit = () => {
    if (closed && pending === 0) process.exit(0);
  };
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      send(rpcError(null, -32700, 'Parse error'));
      return;
    }
    pending++;
    const work = Array.isArray(parsed) && !parsed.length
      ? Promise.resolve(send(rpcError(null, -32600, 'Invalid Request: empty batch')))
      : Array.isArray(parsed)
      ? Promise.all(parsed.map((m) => handle(m as Msg))).then((list) => {
          const out = list.filter((x) => x !== undefined);
          if (out.length) send(out);
        })
      : handle(parsed as Msg).then((r) => {
          if (r !== undefined) send(r);
        });
    void work
      .catch((e) => console.error('mcp-server:', e))
      .finally(() => {
        pending--;
        maybeExit();
      });
  });
  rl.on('close', () => {
    closed = true;
    maybeExit();
  });
  console.error(`saa-trainer MCP server · trainer at ${BASE}`);
}

if (import.meta.main ?? process.argv[1]?.endsWith('mcp-server.ts')) serve();
