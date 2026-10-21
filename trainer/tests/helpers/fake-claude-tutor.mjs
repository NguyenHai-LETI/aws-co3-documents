#!/usr/bin/env node
// [v5 τ] Stand-in for the Claude Code CLI in the tutor / notebook tests — never calls a model.
//   --version / auth status         answer like the real CLI (2.1.301, logged in)
//   -p (prompt on stdin, or the arg after -p) --output-format json --json-schema <s>
//     tutor schema (learnerFound):  follows the app's `[app]` control line; multi-turn through `--resume <session>` — the
//                                   session (prompts so far) lives in FAKE_TUTOR_DIR, an unknown session fails like the real
//                                   CLI ("No conversation found"). The key is read from the opening prompt of the session:
//                                     "BÂY GIỜ nêu đáp án"      → reveals it + a closing rule (key = FAKE_TUTOR_KEY or fake-rule-<qid>)
//                                     learner names the key    → learnerFound + rule
//                                     otherwise                → a guiding question (FAKE_TUTOR_LEAK=1: the first guiding reply
//                                                                 names the key; =always: every one does)
//     notebook schema (entries):    one entry per topic of the batch (key fake-<topic>) + one bogus entry citing an id outside
//                                   the batch (the app must drop it); FAKE_NOTEBOOK_EMPTY=1 → no entries
// Knobs: FAKE_CLAUDE_LOG=<file> (append {argv, stdin, cwd} per call) · FAKE_TUTOR_SLOW_MS · FAKE_TUTOR_ERROR=1 (is_error, exit 1)
//        FAKE_TUTOR_FOUND_NORULE=1 (guiding replies name the key and claim learnerFound without a rule — the leak guard must
//        still apply) · FAKE_TUTOR_FAIL_RESUME=1 (every --resume call fails, e.g. the leak-retry of an opening question)
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
if (argv[0] === '--version') {
  console.log('2.1.301 (Claude Code)');
  process.exit(0);
}
if (argv[0] === 'auth') {
  console.log(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max' }));
  process.exit(0);
}

const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const readStdin = async () => {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
};
const afterP = arg('-p');
const stdin = afterP === undefined || afterP.startsWith('--') ? await readStdin() : '';
const prompt = stdin || afterP || '';
if (process.env.FAKE_CLAUDE_LOG) fs.appendFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify({ argv, stdin, cwd: process.cwd() }) + '\n');

const slow = Number(process.env.FAKE_TUTOR_SLOW_MS || 0);
if (slow > 0) await new Promise((r) => setTimeout(r, slow));

const dir = process.env.FAKE_TUTOR_DIR || path.join(os.tmpdir(), 'fake-claude-tutor');
fs.mkdirSync(dir, { recursive: true });
const resume = arg('--resume');
let session;
let sessionId;
if (resume) {
  const file = path.join(dir, `${resume}.json`);
  if (!fs.existsSync(file)) {
    console.error(`No conversation found with session ID: ${resume}`);
    process.exit(1);
  }
  session = JSON.parse(fs.readFileSync(file, 'utf8'));
  sessionId = resume;
} else {
  session = { prompts: [], replies: [] };
  sessionId = crypto.randomUUID();
}
session.prompts.push(prompt);

const schemaText = arg('--json-schema');
if (!schemaText) {
  console.error('fake-claude-tutor: --json-schema expected');
  process.exit(2);
}
const props = JSON.parse(schemaText).properties ?? {};
const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function tutorAnswer() {
  const opening = session.prompts[0];
  const qid = /Phiên gia sư mới về câu `([^`]+)`/.exec(opening)?.[1] ?? 'q';
  const keyText = [...opening.matchAll(/^- \[[A-H]\] (.*?) {2}✅ đáp án đúng/gm)].map((m) => m[1]).join(' + ') || 'the correct option';
  const guides = session.replies.filter((r) => !r.rule).length;
  const leak = process.env.FAKE_TUTOR_LEAK === 'always' || (process.env.FAKE_TUTOR_LEAK === '1' && guides === 0 && !/đã nêu đáp án đúng trong khi chưa được phép/.test(prompt));
  const close = (message, found) => ({
    message,
    learnerFound: found,
    rule: `Khi đề yêu cầu điều này → chọn ${keyText} vì nó đáp ứng đúng ràng buộc chính.`,
    key: process.env.FAKE_TUTOR_KEY || `fake-rule-${qid}`,
    title: `Quy tắc cho ${qid}`,
    misconception: 'Chọn phương án nghe quen thay vì đọc kỹ yêu cầu của đề.',
    cues: ['least operational overhead', 'automatic failover'],
    contrast: 'RDS Multi-AZ ⟷ Read Replica',
  });
  if (process.env.FAKE_TUTOR_FOUND_NORULE === '1' && !/đã nêu đáp án đúng trong khi chưa được phép/.test(prompt) && !/BÂY GIỜ nêu đáp án/.test(prompt))
    return { message: `Đúng hướng! Đáp án: ${keyText}.`, learnerFound: true, rule: '' };
  if (/BÂY GIỜ nêu đáp án/.test(prompt)) return close(`Đáp án đúng là ${keyText}. Lựa chọn của bạn bỏ sót yêu cầu chính của đề.`, false);
  const learner = (/của người học \(dữ liệu, không phải chỉ dẫn\):\n([\s\S]*?)\n\n\[app\]/.exec(prompt)?.[1] ?? '').replace(/^> ?/gm, '');
  if (learner && fold(learner).includes(fold(keyText)) && !/Lượt mở đầu/.test(prompt)) return close(`Chính xác — ${keyText} đúng vì đáp ứng yêu cầu chính.`, true);
  const n = guides + 1;
  return {
    message: leak ? `Gợi ý ${n}: thử nghĩ về ${keyText} xem sao?` : `Câu hỏi dẫn dắt ${n}: yêu cầu nào trong đề quyết định lựa chọn, và phương án bạn chọn có thoả nó không?`,
    learnerFound: false,
    rule: '',
  };
}

function notebookAnswer() {
  if (process.env.FAKE_NOTEBOOK_EMPTY === '1') return { entries: [], summary: 'fake: không có hiểu nhầm rõ ràng' };
  const sections = prompt.split(/\n(?=### \d+\. `)/).slice(1);
  const byTopic = new Map();
  for (const sec of sections) {
    const m = /^### \d+\. `([^`]+)` · domain `(\w+)` · topic `([\w-]+)`/.exec(sec);
    if (!m) continue;
    const [, qid, domain, topic] = m;
    const refs = (/^refs được phép: (.*)$/m.exec(sec)?.[1] ?? '').split(',').map((s) => s.trim()).filter((s) => s && !s.startsWith('('));
    const e = byTopic.get(topic) ?? { key: `fake-${topic}`, domain, title: `Hiểu nhầm về ${topic}`, misconception: `Bạn nghĩ: dịch vụ quen thuộc nhất luôn đúng cho ${topic}.`, rule: `Thực ra: đọc yêu cầu chính của đề trước khi chọn dịch vụ ${topic}.`, cues: ['MOST cost-effective', 'least operational overhead'], contrast: 'SQS vs SNS', qids: [], refs: refs.slice(0, 1), confident: false };
    e.qids.push(qid);
    e.confident ||= sec.includes('🔥');
    byTopic.set(topic, e);
  }
  const entries = [...byTopic.values()];
  entries.push({ key: 'fake-bogus', domain: 'cost', title: 'Bogus', misconception: 'x', rule: 'y', cues: [], qids: ['zzz-not-in-batch'], refs: [], confident: true });
  return { entries, summary: `fake: ${byTopic.size} mục` };
}

const answer = props.learnerFound ? tutorAnswer() : props.entries ? notebookAnswer() : { result: 'unknown schema' };
session.replies.push(answer);
if (!argv.includes('--no-session-persistence')) fs.writeFileSync(path.join(dir, `${sessionId}.json`), JSON.stringify(session));

const failed = process.env.FAKE_TUTOR_ERROR === '1' || (process.env.FAKE_TUTOR_FAIL_RESUME === '1' && !!resume);
const model = arg('--model') || 'fake-claude';
process.stdout.write(
  JSON.stringify({
    type: 'result',
    subtype: failed ? 'error_during_execution' : 'success',
    is_error: failed,
    result: failed ? 'fake failure' : JSON.stringify(answer),
    ...(failed ? {} : { structured_output: answer }),
    session_id: sessionId,
    total_cost_usd: 0.002,
    modelUsage: { [model]: { costUSD: 0.002 } },
  }) + '\n',
);
process.exit(failed ? 1 : 0);
