// [v5 σ] End-to-end "▶ Học hôm nay" and the focused modes against the real server (sandbox copy of the bank, free port):
// GET /api/today (default budget, ?minutes=, 400), POST /api/tests mode today (session fields, same composition as the
// preview, today's answers and their siblings left out afterwards), yesterday (answers submitted with yesterday's date),
// retest (correction set of an attempt), discriminate (groups from GET /api/pairs), qualifier, and the modes that are never
// built (anki / listen / micro). Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { buildTest, takeTest } from '../helpers/learner.ts';
import { retestIds } from '../../shared/filters.ts';
import type { ConfusableGroup, Question, QuestionState, TestSession, TodayPreview } from '../../shared/types.ts';

const T = { timeout: 180_000 };

let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;
let bank: Question[];
let byId: Map<string, Question>;

before(
  async () => {
    sb = makeSandbox();
    srv = await startServer({ home: sb.home });
    api = apiClient(srv.base);
    bank = (await api.get<{ questions: Question[] }>('/api/bank')).body.questions;
    byId = new Map(bank.map((q) => [q.id, q]));
  },
  { timeout: 90_000 },
);
after(async () => {
  await srv?.stop();
  sb?.cleanup();
});

const ids = (s: TestSession) => s.questions.map((r) => r.id);
const preview = async (q = '') => (await api.get<TodayPreview>(`/api/today${q}`)).body;
const state = async () => (await api.get<{ states: Record<string, QuestionState>; counts: Record<string, number> }>('/api/state')).body;

test('GET /api/today: the daily goal by default, ?minutes=, 400 on a bad value', T, async () => {
  const p = await preview();
  assert.equal(p.minutes, 25, 'practice.today_minutes (no goal yet)');
  assert.ok(p.count > 0);
  assert.equal(p.label.startsWith(`25′ · ${p.count} câu`), true, p.label);
  assert.deepEqual(p.done, { answers: 0, minutes: 0, goalMet: false });
  assert.ok(Math.abs(p.mix.seconds - 25 * 60) <= 120, `seconds ${p.mix.seconds}`);
  const short = await preview('?minutes=5');
  assert.equal(short.minutes, 5);
  assert.ok(short.count < p.count);
  assert.deepEqual(await preview('?minutes=5'), short, 'deterministic');
  for (const bad of ['abc', '0', '-3', '9999']) assert.equal((await api.get(`/api/today?minutes=${bad}`)).status, 400, bad);
});

test("mode 'today': session fields, same composition as the preview; answered questions and their siblings wait", T, async () => {
  const p = await preview('?minutes=10');
  const { session } = await buildTest(api, { mode: 'today', budgetMinutes: 10 });
  assert.equal(session.mode, 'today');
  assert.equal(session.title, 'Học hôm nay · 10′');
  assert.equal(session.feedback, 'practice');
  assert.equal(session.relearn, true);
  assert.equal(session.timeLimit, 0, 'untimed: soft budget timer in the runner');
  assert.equal(session.budgetMinutes, 10);
  assert.deepEqual(session.mix, p.mix);
  assert.equal(session.questions.length, p.count);
  // interleaved by topic: the fewest same-topic neighbours the topic mix allows (max count − ⌈n/2⌉ … 0)
  const topics = ids(session).map((id) => byId.get(id)!.topic);
  const most = Math.max(...Object.values(topics.reduce<Record<string, number>>((m, t) => ((m[t] = (m[t] ?? 0) + 1), m), {})));
  const unavoidable = Math.max(0, 2 * most - topics.length - 1);
  const adjacent = topics.filter((t, i) => i > 0 && t === topics[i - 1]).length;
  assert.equal(adjacent, unavoidable, `topics ${topics.join(',')}`);
  // answer it today → the next "today" serves none of them, nor a sibling
  const taken = await takeTest(api, { mode: 'today', budgetMinutes: 10 }, { acc: 0.6 });
  const answered = new Set(taken.questions.map((q) => q.id));
  const clusterOf = (id: string) => byId.get(id)?.cluster;
  const hot = new Set(taken.questions.map((q) => q.cluster).filter(Boolean));
  const next = await buildTest(api, { mode: 'today', budgetMinutes: 25 });
  assert.ok(!ids(next.session).some((id) => answered.has(id)), 'never a question answered today');
  assert.ok(!ids(next.session).some((id) => clusterOf(id) && hot.has(clusterOf(id))), 'never a sibling of one');
  const after = await preview();
  assert.equal(after.done.answers, taken.answers.length);
});

test("modes 'yesterday' and 'retest' from the history", T, async () => {
  // yesterday: an attempt finished yesterday, ~half wrong
  const y = await takeTest(api, { mode: 'new', count: 12, feedback: 'practice' }, { daysAgo: 1, acc: 0.5 });
  const wrong = y.attempt.answers.filter((r) => !r.ok || r.unsure).map((r) => r.q);
  assert.ok(wrong.length > 0, 'fixture: some errors yesterday');
  const counts = (await state()).counts;
  assert.equal(counts.yesterday, Math.min(8, counts['yesterday.all']));
  assert.ok(counts['yesterday.all'] >= 1 && counts['yesterday.all'] <= wrong.length);
  const ys = await buildTest(api, { mode: 'yesterday' });
  assert.equal(ys.session.questions.length, counts.yesterday);
  assert.ok(ids(ys.session).every((id) => wrong.includes(id)));
  assert.equal(ys.session.feedback, 'practice');
  // retest: the correction set of an attempt, options reshuffled
  const expected = retestIds(y.attempt.answers).filter((id) => byId.get(id)?.status === 'active');
  const rt = await buildTest(api, { mode: 'retest', retestOf: y.attempt.id, shuffleOptions: false });
  assert.deepEqual(new Set(ids(rt.session)), new Set(expected));
  assert.equal(rt.session.retestOf, y.attempt.id);
  assert.ok(rt.session.questions.every((r) => (r.order?.length ?? 0) > 0));
  assert.equal((await api.post('/api/tests', { mode: 'retest', retestOf: 'nope' })).status, 404);
  assert.equal((await api.post('/api/tests', { mode: 'retest' })).status, 400);
});

test("modes 'discriminate' (GET /api/pairs) and 'qualifier'; anki / listen / micro are not built", T, async (t) => {
  for (const mode of ['anki', 'listen', 'micro']) assert.equal((await api.post('/api/tests', { mode })).status, 400, mode);
  const q = await buildTest(api, { mode: 'qualifier', count: 15 });
  assert.ok(q.session.questions.length > 0);
  assert.equal(q.session.feedback, 'practice');
  assert.ok(q.questions.every((x) => x.family || (x.requirements ?? []).some((r) => ['cost', 'ops', 'resilient', 'performance', 'secure'].includes(r))));
  const groups = (await api.get<ConfusableGroup[]>('/api/pairs')).body;
  if (!Array.isArray(groups) || !groups.length) return t.skip('GET /api/pairs returns no confusable group');
  const pair = groups[0].services.slice(0, 2);
  const d = await buildTest(api, { mode: 'discriminate', contrast: pair });
  assert.deepEqual(d.session.contrast, pair);
  assert.ok(d.session.questions.length > 0 && d.session.questions.length <= 12);
  assert.equal(d.session.feedback, 'practice');
  const keys = d.questions.map((x) => x.cluster ?? x.id);
  assert.equal(new Set(keys).size, keys.length, 'one per sibling cluster');
  assert.equal((await state()).counts.discriminate, groups.length);
});
