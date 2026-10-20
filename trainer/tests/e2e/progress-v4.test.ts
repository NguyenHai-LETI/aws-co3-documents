// End-to-end tests of the v4 learning engine against the real server: sandbox TRAINER_HOME (copy of the bank) with two
// sealed forms, free port, a simulated learner. Never-viewed answers (A3), exposure / recognition (B2), confusion pairs
// (B3), requirement buckets (B4), sealed forms as internal calibration points (A1), goal fields + exam-day checklist
// (A2/B7), the deterministic week-1 onboarding plan (A2). Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { buildTest, rng, seedHistory, wrongKeys } from '../helpers/learner.ts';
import { countWords } from '../../shared/timing.ts';
import type { AnswerInput, Attempt, OnboardingPlanResponse, PlansResponse, ProgressResponse, Question, ResultAnnotations, SealedStatus, StatsResponse, TestSession } from '../../shared/types.ts';

let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;
let seeded: Attempt[] = [];
const T = { timeout: 180_000 };
const DAY = 86_400_000;

const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

before(
  async () => {
    sb = makeSandbox();
    // two sealed forms (sandboxes default to none): created at startup by ensureSealed
    const cfgFile = path.join(sb.home, 'config.yaml');
    fs.writeFileSync(cfgFile, fs.readFileSync(cfgFile, 'utf8').replace(/^(\s+sealed_forms:\s*)\d+/m, '$12'));
    const notRepo = path.join(sb.root, 'not-a-repo'); // nothing here may look at the real repo
    fs.mkdirSync(notRepo);
    srv = await startServer({ home: sb.home, repo: notRepo });
    api = apiClient(srv.base);
    seeded = await seedHistory(api);
  },
  { timeout: 180_000 },
);

after(async () => {
  await srv?.stop();
  if (process.env.E2E_KEEP) console.log(`sandbox kept: ${sb?.root}`);
  else sb?.cleanup();
});

/** Submits `session` with these answers, finished `daysAgo` days ago. */
async function submit(session: TestSession, answers: AnswerInput[], daysAgo: number): Promise<Attempt> {
  const finished = Date.now() - daysAgo * DAY;
  const timeUsed = answers.reduce((s, a) => s + a.t, 0) + 30;
  const r = await api.post<{ attempt: Attempt }>('/api/results', {
    session,
    answers,
    startedAt: new Date(finished - timeUsed * 1000).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    timedOut: false,
    timeUsed,
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.attempt;
}
const detail = async (id: string) => (await api.get<{ attempt: Attempt; annotations: ResultAnnotations }>(`/api/results/${encodeURIComponent(id)}`)).body;
const stats = async () => (await api.get<StatsResponse>('/api/stats')).body;
const progress = async () => (await api.get<ProgressResponse>('/api/progress')).body;
const state = async () => (await api.get<{ states: Record<string, any>; counts: Record<string, number> }>('/api/state')).body;
const right = (q: Question, t = 45): AnswerInput => ({ q: q.id, pick: q.answer, t });
const wrong = (q: Question, t = 50): AnswerInput => ({ q: q.id, pick: [wrongKeys(q)[0]], t });
const blank = (q: Question): AnswerInput => ({ q: q.id, pick: [], t: 0 });
const readSeconds = (q: Question, wpm = 300) => ((countWords(q.stem) + q.options.reduce((s, o) => s + countWords(o.text), 0)) / wpm) * 60;

test('A3 + B2: never-viewed answers leave no trace; repeats carry their exposure; a fast right repeat is recognition (grade ≤ good)', T, async () => {
  const { session, questions } = await buildTest(api, { mode: 'new', count: 6, feedback: 'exam' });
  assert.equal(questions.length, 6);
  const [r1, r2, w1, w2, b1, b2] = questions;
  const first = await submit(session, [right(r1), right(r2, 50), wrong(w1, 40), wrong(w2, 55), blank(b1), blank(b2)], 3);
  assert.deepEqual([first.correct, first.total], [2, 6], 'never-viewed answers still count as wrong in the score');
  const d1 = await detail(first.id);
  assert.deepEqual(new Set(d1.annotations.unviewed), new Set([b1.id, b2.id]));
  assert.deepEqual(d1.annotations.exposure, { [r1.id]: 1, [r2.id]: 1, [w1.id]: 1, [w2.id]: 1 });
  assert.deepEqual(d1.annotations.recognized, []);
  assert.deepEqual(d1.annotations.fresh, { total: 6, seenBefore: 0, answers: 4, correct: 2 });
  assert.ok(d1.attempt.answers.every((r) => r.unviewed === undefined && r.exposure === undefined), 'the stored attempt carries no computed field');
  const st1 = await state();
  assert.equal(st1.states[b1.id], undefined, 'no state: still a new question');
  assert.equal(st1.states[b2.id], undefined);
  assert.equal(st1.states[w1.id].lastOk, false);
  assert.ok((await stats()).unviewed! >= 2);
  // two days later: the 4 answered questions again, right and faster than they can be read
  const again = await buildTest(api, { mode: 'ids', ids: [r1.id, r2.id, w1.id, w2.id] });
  const second = await submit(again.session, again.questions.map((q) => right(q, 6)), 2);
  const d2 = await detail(second.id);
  assert.deepEqual(Object.values(d2.annotations.exposure), [2, 2, 2, 2]);
  assert.deepEqual(d2.annotations.fresh, { total: 4, seenBefore: 4, answers: 0, correct: 0 });
  const expected = again.questions.filter((q) => 6 < readSeconds(q)).map((q) => q.id);
  assert.ok(expected.length >= 1, 'fixture: at least one of them takes longer than 6 s to read');
  assert.deepEqual(new Set(d2.annotations.recognized), new Set(expected));
  const st2 = await state();
  for (const id of expected) assert.equal(st2.states[id].lastGrade, 3, `${id}: recognition is capped at "good"`);
  for (const q of again.questions) if (!expected.includes(q.id) && 6 < 0.5 * q.time) assert.equal(st2.states[q.id].lastGrade, 4, `${q.id}: fast and not recognition → easy`);
  const s = await stats();
  assert.equal(s.exposure?.days, 14);
  assert.ok(s.exposure!.repeat.answers >= 4 && s.exposure!.recognized >= expected.length, JSON.stringify(s.exposure));
  assert.ok(s.exposure!.first.answers >= 4);
});

test('A3: the daily review cap counts answers with a pick only; never-viewed reviews stay due', T, async () => {
  const before = await state();
  const srs = await buildTest(api, { mode: 'srs', count: 8 });
  assert.ok(srs.questions.length >= 3, `due reviews: ${srs.questions.length}`);
  const skipped = srs.questions.slice(2);
  await submit(srs.session, srs.questions.map((q, i) => (i < 2 ? right(q, 40) : blank(q))), 0);
  const after = await state();
  assert.equal(after.counts.srsRemaining, before.counts.srsRemaining - 2);
  for (const q of skipped) assert.equal(after.states[q.id]?.lastAt, before.states[q.id]?.lastAt, `${q.id}: untouched`);
  assert.ok(skipped.every((q) => after.states[q.id]?.dueAt === before.states[q.id]?.dueAt));
});

test('B4 + A1: requirement buckets with a baseline; sealed questions are out of every bank denominator', T, async () => {
  const bank = (await api.get<{ questions: Question[]; sealed: string[] }>('/api/bank')).body;
  const sealed = new Set(bank.sealed);
  const status = (await api.get<SealedStatus>('/api/sealed')).body;
  assert.equal(status.forms.length, 2, 'two sealed forms created at startup');
  assert.equal(sealed.size, status.sealed);
  assert.equal(sealed.size, status.forms.reduce((n, f) => n + f.count, 0));
  const practice = bank.questions.filter((q) => q.status === 'active' && !sealed.has(q.id));
  const s = await stats();
  assert.equal(s.totals.bankActive, practice.length);
  assert.equal(s.byDomain.reduce((n, d) => n + d.bank, 0), practice.length);
  assert.equal(s.boxes.reduce((n, x) => n + x, 0), practice.length);
  assert.ok(!s.mostMissed.some((m) => sealed.has(m.id)));
  assert.deepEqual(s.byRequirement!.map((b) => b.key), ['cost', 'ops', 'resilient', 'performance', 'secure', 'negative', 'none']);
  assert.equal(s.byRequirement!.at(-1)!.label, 'Không nêu tiêu chí');
  for (const b of s.byRequirement!) {
    const inBank = practice.filter((q) => (b.key === 'none' ? !q.requirements?.length : q.requirements?.includes(b.key))).length;
    assert.equal(b.bank, inBank, `${b.key}: bank count`);
  }
  assert.ok(s.byRequirement!.reduce((n, b) => n + b.attempts, 0) >= s.totals.answers, 'every answer lands in ≥ 1 bucket');
});

test('B3: a planted SNS ⟶ SQS confusion is confirmed with a drill set; seeded noise is not', T, async (t) => {
  const bank = (await api.get<{ questions: Question[]; sealed: string[] }>('/api/bank')).body;
  const sealed = new Set(bank.sealed);
  const SQS = /\bSQS\b|Simple Queue Service/;
  const SNS = /\bSNS\b|Simple Notification Service/;
  const lureOf = (q: Question) => q.options.find((o) => !q.answer.includes(o.key) && SNS.test(o.text) && !SQS.test(o.text));
  const targets = bank.questions.filter((q) => {
    if (q.status !== 'active' || sealed.has(q.id) || q.outOfScope || q.answer.length !== 1) return false;
    const key = q.options.find((o) => o.key === q.answer[0])!;
    return SQS.test(key.text) && !SNS.test(key.text) && !!lureOf(q);
  });
  if (targets.length < 3) return t.skip(`only ${targets.length} SQS-key / SNS-lure questions outside the sealed forms`);
  const before = await stats();
  assert.ok(!before.confusions?.some((p) => p.picked === 'SNS' && p.correct === 'SQS'), 'not there before');
  for (const daysAgo of [5, 3]) {
    const s = await buildTest(api, { mode: 'ids', ids: targets.map((q) => q.id) });
    await submit(s.session, s.questions.map((q) => ({ q: q.id, pick: [lureOf(q)!.key], t: 50 })), daysAgo);
  }
  const s = await stats();
  const pair = s.confusions?.find((p) => p.picked === 'SNS' && p.correct === 'SQS');
  assert.ok(pair, JSON.stringify(s.confusions));
  assert.ok(pair.picks >= 2 * targets.length && pair.questions >= targets.length, JSON.stringify(pair));
  assert.ok(pair.low > 2 * pair.base && pair.rate >= pair.low);
  assert.ok(pair.ids.length >= Math.min(targets.length, 30) && pair.ids.length <= 30);
  assert.ok(targets.every((q) => pair.ids.includes(q.id) || pair.ids.length === 30), 'the planted questions are in the drill set');
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  for (const id of pair.ids) {
    const q = byId.get(id)!;
    assert.ok(!sealed.has(id), `${id} is sealed`);
    assert.ok(q.options.some((o) => SNS.test(o.text)) && q.options.some((o) => SQS.test(o.text)), `${id} names both`);
  }
  assert.ok(s.confusions!.length <= 10);
  // the drill set starts as a test (mode ids)
  const drill = await api.post('/api/tests', { mode: 'ids', ids: pair.ids, title: 'Luyện cặp SNS ⟶ SQS' });
  assert.equal(drill.status, 200);
});

test('A1: sealed forms in /api/progress — suggested dates, then the used form as an internal calibration point', T, async () => {
  let p = await progress();
  const status = (await api.get<SealedStatus>('/api/sealed')).body;
  assert.deepEqual(p.sealed?.map((f) => [f.id, f.status, f.count]), status.forms.map((f) => [f.id, 'sealed', f.count]));
  assert.deepEqual(p.sealed?.map((f) => f.id), ['S1', 'S2']);
  assert.ok(p.sealed!.every((f) => f.suggested === undefined && !('ids' in f)), 'no exam date yet; never the question ids');
  const exam = dayKey(Date.now() + 30 * DAY);
  const g = await api.post<ProgressResponse>('/api/goal', { examDate: exam });
  assert.equal(g.status, 200);
  p = g.body;
  assert.deepEqual(p.sealed!.map((f) => [f.suggested, f.due]), [[dayKey(Date.now() + 9 * DAY), false], [dayKey(Date.now() + 23 * DAY), false]]);
  const bankActive = (await stats()).totals.bankActive;
  // take S1 (50 scored + pilots), ~70 % right
  const form = await buildTest(api, { mode: 'sealed' });
  assert.equal(form.session.sealedForm, 'S1');
  const r = rng(5);
  const used = await submit(form.session, form.questions.map((q) => (r() < 0.7 ? right(q, 60) : wrong(q, 70))), 0);
  p = await progress();
  const s1 = p.sealed![0];
  assert.deepEqual([s1.status, s1.attempt, s1.score, s1.scaled, s1.suggested], ['used', used.id, used.score, used.scaled, undefined]);
  assert.ok(p.sealed![1].suggested, 'S2 keeps its date');
  const point = p.external.find((e) => e.internal);
  assert.ok(point, JSON.stringify(p.external));
  assert.deepEqual([point.source, point.attempt, point.score, point.date, point.id], ['Đề niêm phong S1', used.id, used.score, dayKey(Date.now()), `sealed-${used.id}`]);
  assert.equal(typeof point.readinessAtDate, 'number', 'the app had answers before the sealed exam');
  assert.ok((p.externalCalibration?.samples ?? 0) >= 1);
  assert.equal((await api.post(`/api/external/${encodeURIComponent(point.id)}/delete`)).status, 404, 'not deletable');
  // its questions are back in the practice bank
  assert.equal((await stats()).totals.bankActive, bankActive + status.forms[0].count);
});

test('A2 + B7: goal fields and the exam-day checklist (due dates from the exam date, delivery items, merge, validation)', T, async () => {
  const r = await api.post<ProgressResponse>('/api/goal', { minutesPerDay: 40, restDays: [0], studyTime: '20:00', examTime: '08:30', delivery: 'online', esl: true, checklist: { esl: true, booked: false, 'id-name': false } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const p = r.body;
  assert.equal(p.goal.minutesPerDay, 40);
  assert.deepEqual([p.goal.restDays, p.goal.studyTime, p.goal.examTime, p.goal.delivery, p.goal.esl, p.goal.checklist], [[0], '20:00', '08:30', 'online', true, { esl: true }]);
  const exam = Date.parse(`${p.goal.examDate}T12:00:00`);
  const by = Object.fromEntries(p.checklist!.map((c) => [c.id, c]));
  assert.ok(by['system-test'] && !by.center, 'online → OnVUE system test');
  assert.equal(by.esl.done, true);
  assert.equal(by.booked.due, dayKey(exam - 21 * DAY));
  assert.equal(by.reschedule.due, dayKey(exam - DAY));
  assert.ok(p.checklist!.every((c) => c.label && c.dueText));
  assert.match(p.checklistChecked ?? '', /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(p.studyStart, dayKey(Math.min(...seeded.map((a) => Date.parse(a.finished)))), 'first non-rushed attempt');
  // merge per item; centre instead of online swaps the delivery items
  const m = (await api.post<ProgressResponse>('/api/goal', { delivery: 'center', checklist: { booked: true } })).body;
  assert.deepEqual(m.goal.checklist, { booked: true, esl: true });
  assert.ok(m.checklist!.some((c) => c.id === 'center') && !m.checklist!.some((c) => c.id === 'system-test'));
  for (const bad of [{ restDays: [9] }, { delivery: 'home' }, { minutesPerDay: 1 }, { studyTime: '24:61' }, { checklist: 'esl' }]) {
    assert.equal((await api.post('/api/goal', bad)).status, 400, JSON.stringify(bad));
  }
  const text = fs.readFileSync(path.join(sb.home, 'results', 'goal.md'), 'utf8');
  assert.match(text, /^minutes_per_day: 40$/m);
  assert.match(text, /^delivery: center$/m);
  assert.equal((await progress()).goal.minutesPerDay, 40, 'GET keeps the goal');
});

test('A2: POST /api/onboarding/plan — the week-1 plan from the diagnostic, one file per day, sessions start', T, async () => {
  const diag = await buildTest(api, { mode: 'diagnostic' });
  assert.equal(diag.session.diagnostic, true);
  const att = await submit(diag.session, diag.questions.map((q, i) => (i % 3 === 0 ? wrong(q) : right(q))), 0);
  const res = await api.post<OnboardingPlanResponse>('/api/onboarding/plan', { attemptId: att.id });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { plan, created, tasks } = res.body;
  assert.equal(created, true);
  assert.equal(plan.trigger, 'onboarding');
  assert.equal(plan.id, `plan-${dayKey(Date.now())}-onboarding`);
  assert.ok(!('body' in plan), 'summary only');
  assert.ok(plan.sessions.length >= 4 && plan.sessions.length <= 6, `${plan.sessions.length} sessions`);
  assert.equal(tasks.length, 14);
  assert.deepEqual(tasks.map((x) => x.priority), [...tasks.map((x) => x.priority)].sort((a, b) => b - a));
  assert.ok(fs.existsSync(path.join(sb.home, plan.file)));
  const list = (await api.get<PlansResponse>('/api/plans?limit=5')).body;
  assert.equal(list.plans[0].id, plan.id, 'shown first on the Dashboard');
  const again = await api.post<OnboardingPlanResponse>('/api/onboarding/plan', { attemptId: att.id });
  assert.deepEqual([again.status, again.body.created, again.body.plan.id], [200, false, plan.id], 'same day, same diagnostic → same plan');
  // sessions start: a task fix session (explicit ids, never sealed) and the end-of-week Pearson mock
  const bank = (await api.get<{ sealed: string[] }>('/api/bank')).body;
  const fix = plan.sessions.find((s) => s.questions?.length)!;
  const fixTest = await api.post<{ session: TestSession }>('/api/tests', { mode: 'coach', plan: `${plan.id}#${fix.id}` });
  assert.equal(fixTest.status, 200, JSON.stringify(fixTest.body));
  assert.ok(fixTest.body.session.questions.every((r) => !bank.sealed.includes(r.id)));
  const mock = plan.sessions.at(-1)!;
  const mockTest = await api.post<{ session: TestSession }>('/api/tests', { mode: 'coach', plan: `${plan.id}#${mock.id}` });
  assert.equal(mockTest.status, 200, JSON.stringify(mockTest.body));
  assert.ok(mockTest.body.session.pearson || mockTest.body.session.sealedForm, 'a timed full mock (Pearson or the next sealed form)');
  assert.equal((await api.post('/api/onboarding/plan', { attemptId: 'does-not-exist' })).status, 404);
});
