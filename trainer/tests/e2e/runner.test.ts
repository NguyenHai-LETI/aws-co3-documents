// [v5 ρ] Runner submits against the real server on a sandbox: "⏹ Dừng ở đây" (never-viewed refs dropped, viewed blanks
// stored as skipped, score over the answered part), in-session relearn retries (stored after the first attempt, out of the
// score), sibling substitution (`ref.for`), session fields copied to the attempt (source / budget / phase / retestOf) and
// the result-page retry (POST /api/results/:id/retry). Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { buildTest, wrongKeys } from '../helpers/learner.ts';
import type { AnswerInput, Attempt, AttemptSummary, Question, SubmitRequest, TestSession } from '../../shared/types.ts';

const T = { timeout: 120_000 };
let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;
let bank: Question[] = [];

before(
  async () => {
    sb = makeSandbox();
    srv = await startServer({ home: sb.home });
    api = apiClient(srv.base);
    bank = (await api.get<{ questions: Question[] }>('/api/bank')).body.questions.filter((q) => q.status === 'active');
  },
  { timeout: 90_000 },
);
after(async () => {
  await srv?.stop();
  sb?.cleanup();
});

function request(session: TestSession, answers: AnswerInput[], extra: Partial<SubmitRequest> = {}): SubmitRequest {
  const finished = Date.now() - 60_000;
  const timeUsed = answers.reduce((s, a) => s + (a.t || 0), 0);
  return { session, answers, startedAt: new Date(finished - timeUsed * 1000).toISOString(), finishedAt: new Date(finished).toISOString(), timedOut: false, timeUsed, ...extra };
}

async function submit(req: SubmitRequest): Promise<Attempt> {
  const r = await api.post<{ attempt: Attempt; error?: string }>('/api/results', req);
  assert.equal(r.status, 200, `submit: ${r.body?.error}`);
  return r.body.attempt;
}

const fileOf = (a: Attempt) => fs.readFileSync(path.join(sb.home, a.file), 'utf8');
const right = (q: Question, t = 40): AnswerInput => ({ q: q.id, pick: q.answer, t });
const wrong = (q: Question, t = 40): AnswerInput => ({ q: q.id, pick: [wrongKeys(q)[0]], t });

test('⏹ stop early: never-viewed refs are not stored, viewed blanks are skipped, score covers the answered part', T, async () => {
  const { session, questions } = await buildTest(api, { mode: 'topic', count: 6, filters: { topics: ['database'] }, feedback: 'practice' });
  assert.equal(questions.length, 6);
  const [q0, q1, q2, q3] = questions;
  const answers: AnswerInput[] = [
    right(q0),
    wrong(q1),
    { q: q2.id, pick: [], t: 12 }, // opened, left blank
    { q: q3.id, pick: [], t: 0 }, // sent but never opened (no time, no interaction)
    // q4, q5: not sent at all
  ];
  const a = await submit(request(session, answers, { stoppedEarly: true }));
  assert.equal(a.stoppedEarly, true);
  assert.equal(a.planned, 6);
  assert.deepEqual(
    a.answers.map((r) => r.q),
    [q0.id, q1.id, q2.id],
    'unseen refs dropped (they stay in the queues)',
  );
  assert.equal(a.answers[2].skipped, true);
  assert.equal(a.answers[2].ok, false);
  assert.equal(a.answers[0].skipped, undefined);
  assert.deepEqual([a.total, a.answered, a.correct, a.score], [2, 2, 1, 50], 'score over the answered part');
  const text = fileOf(a);
  assert.match(text, /^planned: 6$/m);
  assert.match(text, /^stopped_early: true$/m);
  assert.match(text, new RegExp(`q: ${q2.id}, .*skipped: true`));
  assert.match(text, /⏹ Dừng sớm \| làm 2\/6 câu, điểm tính trên phần đã làm · 3 câu chưa xem quay lại hàng chờ \(không tính sai\) · 1 câu đã xem nhưng để trống/);
  assert.match(text, /## ⏭ Đã xem nhưng để trống khi dừng sớm \(1\)/);
  // read back from the file + history summary
  const detail = (await api.get<{ attempt: Attempt }>(`/api/results/${encodeURIComponent(a.id)}`)).body.attempt;
  assert.deepEqual([detail.planned, detail.stoppedEarly, detail.answers.length, detail.answers[2].skipped], [6, true, 3, true]);
  const page = (await api.get<{ items: AttemptSummary[] }>('/api/results?limit=5')).body.items;
  const sum = page.find((x) => x.id === a.id)!;
  assert.deepEqual([sum.planned, sum.stoppedEarly], [6, true]);
  assert.equal(Object.values(sum.topics).reduce((n, t) => n + t.total, 0), 2, 'tallies leave the skipped blank out');
});

test('⏹ stop early is ignored where every blank must count (mock exam) and refused before any answer (422)', T, async () => {
  const exam = await buildTest(api, { mode: 'exam', count: 4 });
  const a = await submit(request(exam.session, [right(exam.questions[0])], { stoppedEarly: true }));
  assert.equal(a.stoppedEarly, undefined, 'honest mock: a stop is a plain submit');
  assert.equal(a.planned, undefined);
  assert.equal(a.total, 4, 'every question graded, blanks wrong');
  assert.equal(a.answers.filter((r) => !r.pick).length, 3);
  assert.ok(a.answers.every((r) => !r.skipped));

  const quick = await buildTest(api, { mode: 'quick' });
  const none = await api.post<{ error: string }>('/api/results', request(quick.session, [{ q: quick.questions[0].id, pick: [], t: 9 }], { stoppedEarly: true }));
  assert.equal(none.status, 422, 'only a viewed blank: nothing to store');
  assert.match(none.body.error, /chưa trả lời câu nào/);
  const stored = (await api.get<Attempt[]>('/api/results')).body.filter((x) => x.sessionId === quick.session.sessionId);
  assert.equal(stored.length, 0);
});

test('🔁 relearn retries: stored right after the graded first attempt, out of the score; one per question; only after a miss or the hint', T, async () => {
  const { session, questions } = await buildTest(api, { mode: 'quick', feedback: 'practice', relearn: true });
  const [q0, q1, q2, q3] = questions;
  const answers: AnswerInput[] = [
    wrong(q0, 30),
    { ...right(q1, 20), hinted: true },
    right(q2, 25),
    wrong(q3, 35),
    ...questions.slice(4).map((q) => right(q, 30)),
    // retries, in the order the runner sent them
    { q: q0.id, pick: q0.answer, t: 9, relearn: true, recall: 'nhớ ra rồi' },
    { q: q0.id, pick: q0.answer, t: 5, relearn: true }, // a second retry of q0: dropped
    { q: q1.id, pick: [wrongKeys(q1)[0]], t: 8, relearn: true }, // hinted first attempt: kept
    { q: q2.id, pick: q2.answer, t: 7, relearn: true }, // answered right without help: dropped
    { q: q3.id, pick: [], t: 6, relearn: true }, // no pick: dropped
  ];
  const a = await submit(request(session, answers));
  const order = a.answers.map((r) => `${r.q}${r.relearn ? '+r' : ''}`);
  assert.deepEqual(order.slice(0, 6), [q0.id, `${q0.id}+r`, q1.id, `${q1.id}+r`, q2.id, q3.id]);
  assert.equal(a.answers.length, questions.length + 2);
  const r0 = a.answers[1];
  assert.deepEqual([r0.relearn, r0.ok, r0.t, r0.recall], [true, true, 9, 'nhớ ra rồi']);
  assert.equal(a.answers[3].ok, false);
  assert.equal(a.total, questions.length, 'retries are not scored');
  assert.equal(a.correct, questions.length - 2, 'the first attempts decide the score');
  const text = fileOf(a);
  assert.match(text, new RegExp(`q: ${q0.id}, .*relearn: true`));
  assert.match(text, /🔁 Học lại trong phiên \| 2 câu được hỏi lại sau khi sai \/ dùng gợi ý — đúng 1\/2 lần hỏi lại/);
  assert.match(text, /- 🔁 Hỏi lại trong phiên: chọn .* — ✅ đúng \(nhớ trước: “nhớ ra rồi”\)/);
  assert.match(text, /^\| 1🔁 \| `/m, 'a retry carries its question number');
  assert.match(text, /^\| 2🔁 \| `/m);
  // the "why" note goes to the graded record only
  const why = await api.post<{ attempt: Attempt }>(`/api/results/${encodeURIComponent(a.id)}/why`, { q: q0.id, why: 'Nhầm hai dịch vụ; tưởng SNS lưu tin' });
  assert.equal(why.status, 200);
  const recs = why.body.attempt.answers.filter((r) => r.q === q0.id);
  assert.deepEqual(
    recs.map((r) => r.why),
    ['Nhầm hai dịch vụ; tưởng SNS lưu tin', undefined],
  );
  assert.equal(recs[1].relearn, true, 'the retry survives the rewrite');
});

test('↔ ref.for (sibling substitution) is kept only for a cluster mate; an unrelated, unknown or self reference is dropped', T, async () => {
  // two members of one sibling cluster (Question.cluster, clusters.ts) and a question outside it
  const byCluster = new Map<string, Question[]>();
  for (const q of bank) if (q.cluster) byCluster.set(q.cluster, [...(byCluster.get(q.cluster) ?? []), q]);
  const [served, mate] = [...byCluster.values()].find((m) => m.length >= 2)!;
  const others = bank.filter((q) => q.cluster !== served.cluster && !q.variantOf.includes(served.id) && !served.variantOf.includes(q.id)).slice(0, 3);
  const { session } = await buildTest(api, { mode: 'ids', ids: [served.id, ...others.map((q) => q.id)] });
  const forOf = [mate.id, others[2].id, 'does-not-exist', others[2].id];
  const refs = session.questions.map((r, i) => ({ ...r, for: i === 3 ? r.id : forOf[i] }));
  const all = [served, ...others];
  const a = await submit(request({ ...session, questions: refs }, refs.map((r) => right(all.find((q) => q.id === r.id)!))));
  assert.deepEqual(
    a.answers.map((r) => r.for),
    [mate.id, undefined, undefined, undefined],
    'cluster mate kept; unrelated / unknown / self dropped',
  );
  assert.match(fileOf(a), new RegExp(`q: ${served.id}, .*for: ${mate.id}`));
  assert.match(fileOf(a), /↔ Câu anh em \| 1 câu được hỏi thay cho câu bạn đã thuộc/);
});

test('a resent submit whose answers differ from the stored attempt says so (differs), an identical one does not', T, async () => {
  const { session, questions } = await buildTest(api, { mode: 'quick' });
  const phone = request(session, questions.map((q) => right(q)));
  const desk = request(session, questions.map((q, i) => (i < 3 ? wrong(q) : right(q))));
  const first = await api.post<{ attempt: Attempt; duplicate?: boolean; differs?: boolean }>('/api/results', desk);
  assert.equal(first.body.duplicate, undefined);
  const same = await api.post<{ duplicate?: boolean; differs?: boolean }>('/api/results', desk);
  assert.deepEqual([same.body.duplicate, same.body.differs], [true, undefined]);
  const other = await api.post<{ attempt: Attempt; duplicate?: boolean; differs?: boolean }>('/api/results', phone);
  assert.deepEqual([other.body.duplicate, other.body.differs, other.body.attempt.id], [true, true, first.body.attempt.id]);
  // the browser outbox carries it to the UI (SentSubmit.differs → DIFFERS_NOTE toast)
  const store = new Map<string, string>();
  const realFetch = globalThis.fetch;
  Object.assign(globalThis, { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } });
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => realFetch(typeof url === 'string' && url.startsWith('/') ? srv.base + url : url, init)) as typeof fetch;
  try {
    const s = await import('../../web/lib/session.ts');
    s.queueSubmit(phone);
    const sent = await s.flushOutbox();
    assert.deepEqual([sent.length, sent[0].differs, sent[0].attempt.id], [1, true, first.body.attempt.id]);
    assert.match(s.DIFFERS_NOTE, /thiết bị khác/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('session source / budget / phase / retestOf are copied to the attempt (validated)', T, async () => {
  const { session, questions } = await buildTest(api, { mode: 'quick' });
  const prior = (await api.get<Attempt[]>('/api/results')).body[0];
  const a = await submit(
    request({ ...session, source: 'chat', budgetMinutes: 25, phase: 'consolidate', retestOf: prior.id }, questions.map((q) => right(q))),
  );
  assert.deepEqual([a.source, a.budgetMinutes, a.phase, a.retestOf], ['chat', 25, 'consolidate', prior.id]);
  const text = fileOf(a);
  assert.match(text, /^source: chat$/m);
  assert.match(text, /^budget_minutes: 25$/m);
  assert.match(text, /^phase: consolidate$/m);
  assert.match(text, new RegExp(`^retest_of: ${prior.id}$`, 'm'));
  assert.match(text, /\| Nguồn \| 💬 Claude chat \(MCP\) \|/);
  const back = (await api.get<{ attempt: Attempt }>(`/api/results/${encodeURIComponent(a.id)}`)).body.attempt;
  assert.deepEqual([back.source, back.budgetMinutes, back.phase, back.retestOf], ['chat', 25, 'consolidate', prior.id]);

  const b = await buildTest(api, { mode: 'quick' });
  const bad = await submit(
    request({ ...b.session, source: 'telepathy' as never, budgetMinutes: -5, phase: 'nap' as never, retestOf: '../../etc/passwd' }, b.questions.map((q) => right(q))),
  );
  assert.deepEqual([bad.source, bad.budgetMinutes, bad.phase, bad.retestOf], [undefined, undefined, undefined, undefined]);
});

test('🔄 result-page retry: stored on the graded record, never changes ok / score; first retry wins; bad input refused', T, async () => {
  const { session, questions } = await buildTest(api, { mode: 'quick' });
  const [q0, q1] = questions;
  const a = await submit(request(session, [wrong(q0), ...questions.slice(1).map((q) => right(q))]));
  const url = `/api/results/${encodeURIComponent(a.id)}/retry`;
  const r = await api.post<{ attempt: Attempt; answer: { q: string; retry: string; retryOk: boolean; ok: boolean }; retry: string; retryOk: boolean; duplicate?: boolean }>(url, { q: q0.id, pick: q0.answer });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.retry, [...q0.answer].sort().join(''));
  assert.equal(r.body.retryOk, true);
  assert.equal(r.body.answer.ok, false, 'still graded wrong');
  assert.equal(r.body.duplicate, undefined);
  assert.equal(r.body.attempt.score, a.score);
  assert.equal(r.body.attempt.correct, a.correct);
  const again = await api.post<{ retry: string; retryOk: boolean; duplicate?: boolean }>(url, { q: q0.id, pick: [wrongKeys(q0)[0]] });
  assert.equal(again.status, 200);
  assert.deepEqual([again.body.retry, again.body.retryOk, again.body.duplicate], [r.body.retry, true, true], 'made before the explanation: kept');
  const text = fileOf(a);
  assert.match(text, new RegExp(`q: ${q0.id}, .*ok: false.*retry: ${r.body.retry}, retryOk: true`));
  assert.match(text, /- 🔄 Thử lại khi chữa bài: chọn .* — ✅ đúng/);
  const wrongRetry = await api.post<{ retry: string; retryOk: boolean }>(url, { q: q1.id, pick: wrongKeys(q1)[0] }); // a string pick works too
  assert.deepEqual([wrongRetry.status, wrongRetry.body.retryOk], [200, false]);
  assert.equal((await api.post(url, { q: 'not-in-this-test', pick: ['A'] })).status, 400);
  assert.equal((await api.post(url, { q: questions[2].id, pick: [] })).status, 400);
  assert.equal((await api.post(url, { q: questions[2].id, pick: ['Z'] })).status, 400, 'option keys of the question only');
  assert.equal((await api.post('/api/results/nope/retry', { q: q0.id, pick: ['A'] })).status, 404);
  const stats = (await api.get('/api/results')).body as Attempt[];
  assert.equal(stats.find((x) => x.id === a.id)?.score, a.score);
});
