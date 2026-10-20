// [v5] π Micro API end-to-end in a sandbox: one short question without its answer, answers appended to ONE result file
// per day (mode micro, source micro, sessionId micro:<date>), same question again = relearn record out of the score,
// input checks, and the status line. Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import type { MicroAnswerResult, MicroNext, MicroStatus, Question } from '../../shared/types.ts';

const T = { timeout: 120_000 };
let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;
let bank: Map<string, Question>;

before(async () => {
  sb = makeSandbox();
  srv = await startServer({ home: sb.home });
  api = apiClient(srv.base);
  bank = new Map(((await api.get<{ questions: Question[] }>('/api/bank')).body.questions).map((q) => [q.id, q]));
}, T);

after(async () => {
  await srv?.stop();
  sb?.cleanup();
});

const microFiles = () => {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (/_micro(-\d+)?\.md$/.test(e.name)) out.push(path.join(d, e.name));
    }
  };
  walk(path.join(sb.home, 'results'));
  return out;
};

/** A short practice question (σ's microCandidates when it serves one, else picked from the bank). */
async function nextQuestion(): Promise<{ id: string; labels: Map<string, string> }> {
  const r = await api.get<MicroNext>('/api/micro/next');
  assert.equal(r.status, 200);
  if (r.body.question) return { id: r.body.question.id, labels: new Map(r.body.question.options.map((o) => [o.key, o.label])) };
  const q = [...bank.values()].find((x) => x.status === 'active' && x.words <= 40 && x.answer.length === 1)!;
  return { id: q.id, labels: new Map(q.options.map((o) => [o.key, o.key])) };
}

test('next: one short question, options labelled, never the answer or the explanation', T, async () => {
  const r = await api.get<MicroNext>('/api/micro/next');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.today, { answered: 0, correct: 0 });
  const q = r.body.question;
  assert.ok(q, 'σ microCandidates serves a question to a fresh learner');
  assert.ok(q!.stem.split(/\s+/).length <= 45);
  assert.deepEqual(q!.options.map((o) => o.label), 'ABCDEFGH'.slice(0, q!.options.length).split(''));
  assert.equal(q!.choose, bank.get(q!.id)!.answer.length);
  assert.deepEqual(Object.keys(q!).sort(), ['choose', 'due', 'id', 'options', 'stem', 'topic', 'topicLabel'].filter((k) => k !== 'topicLabel' || 'topicLabel' in q!));
  for (const o of q!.options) assert.deepEqual(Object.keys(o).sort(), ['key', 'label', 'text']);
  assert.ok(!JSON.stringify(r.body).includes(bank.get(q!.id)!.explanation.slice(0, 40)), 'no explanation text');
  assert.equal((await api.get<MicroNext>('/api/micro/next')).body.question?.id, q!.id, 'deterministic');
});

test('answer: graded, stored in today\'s micro attempt (createAttempt, then rewriteAttempt), repeats are relearn records', T, async () => {
  const first = await nextQuestion();
  const q1 = bank.get(first.id)!;
  const right = await api.post<MicroAnswerResult>('/api/micro/answer', { q: q1.id, pick: q1.answer, t: 21 });
  assert.equal(right.status, 200, JSON.stringify(right.body));
  assert.equal(right.body.ok, true);
  assert.equal(right.body.key, q1.answer.join(''));
  assert.equal(right.body.keyLabels, q1.answer.map((k) => first.labels.get(k)).sort().join(''));
  assert.ok(right.body.explanation.length > 10 && right.body.explanation.length <= 220);
  assert.deepEqual(right.body.today, { answered: 1, correct: 1 });
  assert.equal(microFiles().length, 1);

  const q2 = [...bank.values()].find((x) => x.status === 'active' && x.id !== q1.id && x.words <= 40 && x.answer.length === 1)!;
  const wrongKey = q2.options.map((o) => o.key).find((k) => !q2.answer.includes(k))!;
  const wrong = await api.post<MicroAnswerResult>('/api/micro/answer', { q: q2.id, pick: [wrongKey], t: 5000 });
  assert.equal(wrong.body.ok, false);
  assert.deepEqual(wrong.body.today, { answered: 2, correct: 1 });
  assert.equal(wrong.body.attempt, right.body.attempt, 'same attempt');
  const again = await api.post<MicroAnswerResult>('/api/micro/answer', { q: q1.id, pick: q1.answer.join(''), t: 4 });
  assert.equal(again.body.repeat, true);
  assert.deepEqual(again.body.today, { answered: 2, correct: 1 }, 'a repeat is not counted twice');

  const files = microFiles();
  assert.equal(files.length, 1, 'one file per day');
  const text = fs.readFileSync(files[0], 'utf8');
  assert.match(text, /^mode: micro$/m);
  assert.match(text, /^source: micro$/m);
  assert.match(text, /^session: "?micro:\d{4}-\d{2}-\d{2}"?$/m);
  assert.match(text, /^total: 2$/m);
  assert.match(text, /^correct: 1$/m);
  assert.match(text, /relearn: true/);
  assert.match(text, /t: 900\b/, 'a long break is capped');
  const res = await api.get<{ attempt: { mode: string; source?: string; answers: unknown[]; total: number } }>(`/api/results/${encodeURIComponent(right.body.attempt)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.attempt.source, 'micro');
  assert.equal(res.body.attempt.answers.length, 3);
  // the answered question is not served again today
  assert.notEqual((await api.get<MicroNext>('/api/micro/next')).body.question?.id, q1.id);
});

test('answer: input checks (unknown question, bad pick, X-Trainer)', T, async () => {
  const q = [...bank.values()].find((x) => x.status === 'active')!;
  assert.equal((await api.post('/api/micro/answer', { q: 'nope', pick: ['A'] })).status, 404);
  assert.equal((await api.post('/api/micro/answer', { q: q.id, pick: [] })).status, 400);
  assert.equal((await api.post('/api/micro/answer', { q: q.id, pick: ['Z'] })).status, 400);
  const r = await fetch(`${srv.base}/api/micro/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: q.id, pick: q.answer }) });
  assert.equal(r.status, 403, 'X-Trainer header required');
});

test('status: one line for the Claude Code status line', T, async () => {
  const r = await api.get<MicroStatus>('/api/micro/status');
  assert.equal(r.status, 200);
  assert.equal(typeof r.body.due, 'number');
  assert.deepEqual(r.body.today, { answered: 2, correct: 1 });
  assert.match(r.body.line, /^📚 /);
  assert.match(r.body.line, /☕ 1\/2/);
  assert.equal(r.body.readiness, null, 'not enough answers yet');
});
