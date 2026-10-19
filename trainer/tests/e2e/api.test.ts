// End-to-end API scenario against the real server: sandbox copy of the bank (temp TRAINER_HOME inside a throwaway
// git repo with a local bare remote), free port, a simulated learner, then every v2 endpoint. Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { buildTest, rng, takeTest, wrongKeys } from '../helpers/learner.ts';
import { git } from '../helpers/git.ts';
import type { AnswerInput, Attempt, Question, TestSession } from '../../shared/types.ts';

let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;
let meta: any;
let bank: Question[] = [];
const T = { timeout: 120_000 };

before(
  async () => {
    sb = makeSandbox({ git: true });
    srv = await startServer({ home: sb.home, repo: sb.repo });
    api = apiClient(srv.base);
    meta = (await api.get('/api/meta')).body;
    bank = (await api.get<{ questions: Question[] }>('/api/bank')).body.questions.filter((q) => q.status === 'active');
  },
  { timeout: 90_000 },
);

after(async () => {
  await srv?.stop();
  if (process.env.E2E_KEEP) console.log(`sandbox kept: ${sb?.root}`);
  else sb?.cleanup();
});

const round1 = (x: number) => Math.round(x * 10) / 10;
const answerOf = (a: Attempt, q: string) => {
  const r = a.answers.find((x) => x.q === q);
  assert.ok(r, `answer for ${q} missing`);
  return r;
};

async function submit(session: TestSession, answers: AnswerInput[], daysAgo = 0) {
  const finished = Date.now() - daysAgo * 86_400_000;
  const timeUsed = answers.reduce((s, a) => s + a.t, 0);
  const r = await api.post<{ attempt: Attempt; error?: string }>('/api/results', {
    session,
    answers,
    startedAt: new Date(finished - timeUsed * 1000).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    timedOut: false,
    timeUsed,
  });
  assert.equal(r.status, 200, `submit: ${r.body?.error}`);
  return r.body.attempt;
}

// ── basics ──────────────────────────────────────────────────────────────────

test('meta exposes the v2 fields and the sandbox paths', T, () => {
  assert.ok(bank.length > 100, 'bank loaded');
  assert.ok(Array.isArray(meta.tasks) && meta.tasks.length >= 14, 'tasks 1.1–4.4');
  assert.ok(meta.tasks.every((t: any) => /^[1-4]\.\d$/.test(t.id) && t.domain && t.label_vi));
  assert.ok(meta.keywords && typeof meta.keywords === 'object' && Object.keys(meta.keywords).length > 0, 'keywords');
  assert.equal(typeof meta.host, 'string');
  assert.ok(Array.isArray(meta.coachHosts));
  assert.equal(path.resolve(meta.paths.data), sb.home);
  assert.equal(path.resolve(meta.paths.repo), sb.repo);
  assert.equal(typeof meta.practice.shuffle_options, 'boolean');
  assert.ok(['fsrs', 'leitner'].includes(meta.srs.algorithm));
  assert.equal(typeof meta.srs.daily_limit, 'number');
});

test('rejects requests without X-Trainer or from a foreign Host', T, async () => {
  const r = await fetch(`${srv.base}/api/tests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"mode":"quick"}' });
  assert.equal(r.status, 403);
  const status = await new Promise<number>((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: srv.port, path: '/api/meta', headers: { Host: `evil.example:${srv.port}` } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end();
  });
  assert.equal(status, 403);
});

test('options are shuffled by default (practice.shuffle_options)', T, async () => {
  const { session, questions } = await buildTest(api, { mode: 'quick' });
  assert.equal(session.questions.length, questions.length);
  if (meta.practice.shuffle_options) {
    for (const [i, ref] of session.questions.entries()) {
      assert.ok(Array.isArray(ref.order), `question ${ref.id} has a display order`);
      assert.deepEqual([...ref.order!].sort(), questions[i].options.map((o) => o.key).sort());
    }
  }
  const plain = await buildTest(api, { mode: 'quick', shuffleOptions: false });
  assert.ok(plain.session.questions.every((r) => !r.order), 'shuffleOptions:false keeps the original order');
});

// ── history through every mode ──────────────────────────────────────────────

const history: Attempt[] = [];

test('builds and grades tests in the content modes', T, async (t) => {
  const rand = rng(7);
  const task = bank.find((q) => q.task)?.task; // set by scripts/classify-tasks.ts / ENRICH
  const pack = (meta.packs as any[]).find((p) => p.origin === 'imported' && p.activeCount >= 10) ?? meta.packs[0];
  const runs: [Parameters<typeof takeTest>[1], number][] = [
    [{ mode: 'topic', count: 15, filters: { topics: ['database'] } }, 6],
    [{ mode: 'exam', timing: { preset: 'official' } }, 4],
    [{ mode: 'topic', count: 20, filters: { topics: ['networking'] }, timing: { preset: 'strict' } }, 3],
    [{ mode: 'pack', filters: { packs: [pack.id] } }, 2],
    [{ mode: 'custom', count: 12, filters: { services: ['S3'], difficulties: ['hard'] } }, 1],
    [{ mode: 'new', count: 10 }, 1],
    [{ mode: 'weak', count: 10 }, 0],
  ];
  if (task) runs.push([{ mode: 'custom', count: 8, filters: { tasks: [task] } }, 0]);
  else t.diagnostic('no question has `task` metadata yet — filters.tasks not exercised');
  for (const [req, daysAgo] of runs) {
    const taken = await takeTest(api, req, { daysAgo, rand });
    const a = taken.attempt;
    assert.ok(a.id && a.file, `${req.mode}: attempt saved`);
    assert.equal(a.mode, req.mode);
    assert.equal(a.answers.length, taken.session.questions.length);
    assert.equal(a.total, a.answers.filter((x) => x.scored !== false).length);
    assert.equal(a.correct, a.answers.filter((x) => x.ok && x.scored !== false).length);
    assert.ok(Math.abs(a.score - round1((a.correct / a.total) * 100)) < 0.051, `${req.mode}: score`);
    if (req.mode === 'pack') assert.ok(taken.questions.every((q) => q.pack === pack.id));
    if (req.mode === 'topic') assert.ok(taken.questions.every((q) => q.topic === req.filters!.topics![0]));
    if (req.filters?.tasks) assert.ok(taken.questions.every((q) => q.task === task), 'filters.tasks');
    if (req.mode === 'exam') {
      assert.equal(taken.session.questions.length, meta.exam.questions);
      assert.equal(taken.session.timeLimit, meta.exam.questions * 120, 'official timing = 2 min/question');
    }
    history.push(a);
  }
});

test('pearson exam: 65 questions, 15 unscored pilots, graded over the scored 50', T, async () => {
  const { session, questions } = await buildTest(api, { mode: 'exam', pearson: true });
  assert.equal(session.pearson, true);
  assert.equal(session.questions.length, 65);
  assert.equal(session.feedback, 'exam');
  assert.equal(session.timeLimit, 65 * 120, 'pearson defaults to official timing');
  assert.match(session.title, /Pearson/);
  assert.equal(session.unscored?.length, 15);
  const ids = new Set(session.questions.map((r) => r.id));
  assert.ok(session.unscored!.every((id) => ids.has(id)));

  const rand = rng(3);
  const answers = questions.map((q): AnswerInput => ({ q: q.id, pick: rand() < 0.7 ? q.answer : [wrongKeys(q)[0]], t: Math.round(q.time * 0.9) }));
  const a = await submit(session, answers, 1);
  assert.equal(a.pearson, true);
  assert.equal(a.pilotTotal, 15);
  assert.equal(a.total, 50);
  const pilots = a.answers.filter((x) => x.scored === false);
  assert.equal(pilots.length, 15);
  assert.deepEqual(new Set(pilots.map((x) => x.q)), new Set(session.unscored));
  assert.equal(a.pilotCorrect, pilots.filter((x) => x.ok).length);
  assert.equal(a.correct, a.answers.filter((x) => x.scored !== false && x.ok).length);
  assert.ok(Math.abs(a.score - round1((a.correct / 50) * 100)) < 0.051);
  history.push(a);
});

let v2: { attempt: Attempt; qs: Question[] } | undefined;

test('stores the v2 answer fields: elim, recall/recallHit, hinted, why', T, async () => {
  // single-answer questions with descriptive options, so "recall = the correct option's text" must be a hit
  const qs = bank.filter((q) => q.answer.length === 1 && q.options.length >= 4 && q.options.every((o) => o.text.split(/\s+/).length >= 5)).slice(0, 6);
  assert.equal(qs.length, 6);
  const { session } = await buildTest(api, { mode: 'ids', ids: qs.map((q) => q.id), feedback: 'practice' });
  const text = (q: Question, k: string) => q.options.find((o) => o.key === k)!.text;
  const [q0, q1, q2, q3, q4, q5] = qs;
  const longWhy = 'Vì tưởng rằng '.repeat(60); // > 500 chars
  const answers: AnswerInput[] = [
    { q: q0.id, pick: q0.answer, t: 40, recall: text(q0, q0.answer[0]) },
    { q: q1.id, pick: q1.answer, t: 41, recall: 'zzqx wvut pqrs' },
    { q: q2.id, pick: [wrongKeys(q2)[0]], t: 42, elim: [q2.answer[0]], why: longWhy },
    { q: q3.id, pick: [wrongKeys(q3)[1]], t: 43, hinted: true, why: 'Nhầm giữa hai dịch vụ', elim: [wrongKeys(q3)[2], wrongKeys(q3)[0]] },
    { q: q4.id, pick: q4.answer, t: 44, hinted: true, unsure: true, recall: 'x'.repeat(400) },
    { q: q5.id, pick: [], t: 45 },
  ];
  const a = await submit(session, answers, 0);
  const r0 = answerOf(a, q0.id);
  assert.equal(r0.recall, text(q0, q0.answer[0]).trim().slice(0, 300));
  assert.equal(r0.recallHit, true, 'recall = correct option text');
  assert.equal(answerOf(a, q1.id).recallHit, false);
  const r2 = answerOf(a, q2.id);
  assert.equal(r2.ok, false);
  assert.equal(r2.elim, q2.answer[0], 'struck the correct option');
  assert.ok(r2.why && r2.why.length <= 500 && r2.why.startsWith('Vì tưởng rằng'), 'why trimmed to ≤ 500');
  const r3 = answerOf(a, q3.id);
  assert.equal(r3.hinted, true);
  assert.equal(r3.why, 'Nhầm giữa hai dịch vụ');
  assert.equal(r3.elim, [wrongKeys(q3)[2], wrongKeys(q3)[0]].sort().join(''), 'elim normalized to sorted keys');
  const r4 = answerOf(a, q4.id);
  assert.equal(r4.hinted, true);
  assert.ok((r4.recall ?? '').length <= 300, 'recall trimmed to ≤ 300');
  assert.equal(answerOf(a, q5.id).pick, '');
  assert.equal(a.layout, 2, 'new results are written with layout: 2');
  v2 = { attempt: a, qs };
  history.push(a);
});

test('POST /api/results/:id/why adds a note afterwards and rewrites the file', T, async () => {
  assert.ok(v2, 'needs the v2 attempt');
  const q3 = v2.qs[3];
  const note = 'Đọc sót chữ "cost-effective" trong đề';
  const r = await api.post<{ attempt: Attempt; error?: string }>(`/api/results/${encodeURIComponent(v2.attempt.id)}/why`, { q: q3.id, why: note });
  assert.equal(r.status, 200, r.body?.error);
  assert.equal(answerOf(r.body.attempt, q3.id).why, note);
  const detail = await api.get(`/api/results/${encodeURIComponent(v2.attempt.id)}`);
  assert.equal(answerOf(detail.body.attempt, q3.id).why, note);
  const file = await api.get(`/api/file?path=${encodeURIComponent(v2.attempt.file)}`);
  assert.equal(file.status, 200);
  assert.ok(file.body.content.includes('cost-effective'), 'note written into the result file');
  const bad = await api.post(`/api/results/${encodeURIComponent(v2.attempt.id)}/why`, { q: 'not-in-attempt', why: 'x' });
  assert.ok(bad.status >= 400 && bad.status < 500, `unknown question → 4xx (got ${bad.status})`);
  const missing = await api.post('/api/results/does-not-exist/why', { q: q3.id, why: 'x' });
  assert.equal(missing.status, 404);
});

test('rushed attempts are flagged and excluded from stats', T, async () => {
  const before = (await api.get('/api/stats')).body;
  const { session, questions } = await buildTest(api, { mode: 'quick' });
  const a = await submit(session, questions.map((q) => ({ q: q.id, pick: [q.options[0].key], t: 1 })), 0);
  const list = (await api.get<any[]>('/api/results')).body;
  const item = list.find((x) => x.id === a.id);
  assert.ok(item, 'listed');
  assert.equal(item.rushed, true);
  assert.ok(item.medianTime <= 2);
  const after = (await api.get('/api/stats')).body;
  assert.equal(after.totals.attempts, before.totals.attempts, 'not counted as an attempt');
  assert.equal(after.totals.answers, before.totals.answers, 'answers not counted');
  assert.ok(after.totals.rushedAttempts >= 1);
  assert.ok(after.rushed.some((x: any) => x.id === a.id));
});

test('review pools after the history: srs, retry-wrong, weak, new, flagged, slow, ids, coach', T, async () => {
  for (const mode of ['srs', 'retry-wrong', 'weak', 'new', 'flagged'] as const) {
    const r = await api.post('/api/tests', { mode, count: 15 });
    assert.equal(r.status, 200, `${mode}: ${r.body?.error}`);
    assert.ok(r.body.session.questions.length > 0, `${mode}: questions`);
  }
  const slow = await api.post('/api/tests', { mode: 'slow', count: 15 });
  assert.ok(slow.status === 200 || slow.status === 422, `slow → ${slow.status}`);

  const wrongIds = new Set(history.flatMap((a) => a.answers.filter((x) => !x.ok).map((x) => x.q)));
  const retry = await api.post('/api/tests', { mode: 'retry-wrong', count: 200 });
  assert.ok(retry.body.session.questions.every((r: any) => wrongIds.has(r.id)), 'retry-wrong only has wrong questions');

  const ids = await api.post('/api/tests', { mode: 'ids', ids: [bank[0].id, 'nope-id', bank[1].id] });
  assert.equal(ids.status, 200);
  assert.deepEqual(ids.body.session.questions.map((r: any) => r.id), [bank[0].id, bank[1].id]);
  assert.ok(ids.body.session.notes.join(' ').includes('nope-id'));

  // coach mode: a plan file in the sandbox
  const plan = [
    '---',
    'id: plan-e2e',
    'kind: plan',
    `created: ${new Date().toISOString()}`,
    'trigger: manual',
    'summary: "e2e"',
    'new_packs: []',
    'sessions:',
    '  - id: s1',
    '    title: "Phiên chọn sẵn"',
    '    feedback: practice',
    `    questions: [${bank.slice(2, 5).map((q) => q.id).join(', ')}]`,
    '  - id: s2',
    '    title: "Phiên theo bộ lọc"',
    '    filter: { mode: topic, count: 5, topics: [database] }',
    '---',
    '',
    '# Kế hoạch e2e',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(sb.home, 'coach', 'plans', 'plan-e2e.md'), plan);
  const s1 = await api.post('/api/tests', { mode: 'coach', plan: 'plan-e2e#s1' });
  assert.equal(s1.status, 200, s1.body?.error);
  assert.deepEqual(s1.body.session.questions.map((r: any) => r.id).sort(), bank.slice(2, 5).map((q) => q.id).sort());
  const s2 = await api.post('/api/tests', { mode: 'coach', plan: 'plan-e2e#s2' });
  assert.equal(s2.status, 200, s2.body?.error);
  assert.equal(s2.body.session.questions.length, 5);
  const none = await api.post('/api/tests', { mode: 'coach', plan: 'plan-x#s9' });
  assert.ok(none.status >= 400 && none.status < 500);
});

// ── derived data ────────────────────────────────────────────────────────────

test('state: per-question states and mode counts incl. srs/backlog', T, async () => {
  const st = (await api.get('/api/state')).body;
  const answered = new Set(history.flatMap((a) => a.answers.map((x) => x.q)));
  assert.ok(Object.keys(st.states).length >= answered.size * 0.9);
  const s = st.states[[...answered][0]];
  assert.ok(s && s.attempts >= 1 && typeof s.box === 'number');
  assert.equal(typeof st.counts.srs, 'number');
  assert.equal(typeof st.counts.backlog, 'number');
  assert.ok(st.counts.srs <= meta.srs.daily_limit, 'daily cap');
});

test('stats include the v2 fields', T, async () => {
  const s = (await api.get('/api/stats')).body;
  const t = s.totals;
  for (const k of ['readiness', 'readinessScaled', 'readinessLow', 'readinessHigh', 'passProbability', 'dueToday', 'backlog', 'rushedAttempts', 'longFormShare', 'due', 'mastered']) {
    assert.equal(typeof t[k], 'number', `totals.${k}`);
  }
  assert.ok(t.readinessLow <= t.readiness && t.readiness <= t.readinessHigh, 'readiness inside its 90 % interval');
  assert.ok(t.readinessLow >= 0 && t.readinessHigh <= 100);
  assert.ok(t.passProbability >= 0 && t.passProbability <= 1);
  assert.ok(['low', 'medium', 'high'].includes(t.readinessConfidence));
  assert.ok(Array.isArray(s.byTask) && s.byTask.length > 0, 'byTask');
  assert.equal(s.boxes.length, 6);
  assert.equal(s.boxLabels.length, 6);
  for (const k of ['sure', 'unsure', 'hinted']) assert.equal(typeof s.calibration[k].answers, 'number', `calibration.${k}`);
  assert.ok(s.calibration.hinted.answers >= 2, 'hinted answers counted');
  assert.ok(s.elimination.answersWithElim >= 2);
  assert.ok(s.elimination.correctEliminated >= 1, 'struck-correct counted');
  assert.ok(s.recall.answers >= 3 && s.recall.hits >= 1);
  assert.equal(typeof s.lengthSplit.long.answers, 'number');
  assert.equal(typeof s.lengthSplit.short.answers, 'number');
  assert.ok(Array.isArray(s.rushed) && s.rushed.length >= 1);
  assert.ok(s.trend.length >= history.length - 1 && s.daily.length >= 1 && Array.isArray(s.mostMissed));
  assert.ok(s.byDomain.length === 4 && s.byTopic.length > 0);
});

test('results list and detail', T, async () => {
  const list = (await api.get<any[]>('/api/results')).body;
  assert.ok(list.length >= history.length + 1);
  assert.ok(new Date(list[0].finished) >= new Date(list[list.length - 1].finished), 'newest first');
  // paginated form (History, Dashboard): same order, one slice + the total
  const page = (await api.get(`/api/results?limit=3&offset=1`)).body;
  assert.deepEqual(page.items.map((a: any) => a.id), list.slice(1, 4).map((a) => a.id));
  assert.equal(page.total, list.length);
  assert.ok(page.items.every((a: any) => !('answers' in a)), 'summaries only');
  const p = history.find((a) => a.pearson)!;
  const d = (await api.get(`/api/results/${encodeURIComponent(p.id)}`)).body;
  assert.equal(d.attempt.answers.length, 65);
  assert.equal(d.questions.filter(Boolean).length, 65);
  assert.equal(d.attempt.pilotTotal, 15);
  assert.ok(Object.keys(d.summary.domains).length > 0);
  assert.equal((await api.get('/api/results/nope')).status, 404);
});

// ── bank quality & ratings ──────────────────────────────────────────────────

test('ratings: 👎 listed and aggregated (one vote per question per day), 👎 on two days → low-rated', T, async () => {
  const qid = bank[7].id;
  for (const note of ['e2e: đề mơ hồ', 'e2e: đáp án gây tranh cãi']) {
    const r = await api.post('/api/ratings', { qid, value: 'down', note });
    assert.equal(r.status, 200, r.body?.error);
    assert.equal(r.body.qid, qid);
    assert.equal(r.body.value, 'down');
  }
  const up = await api.post('/api/ratings', { qid: bank[8].id, value: 'up' });
  assert.equal(up.status, 200);
  const list = (await api.get<any[]>('/api/ratings')).body;
  assert.ok(Array.isArray(list));
  assert.ok(list.filter((x) => x.qid === qid && x.value === 'down').length >= 2);
  assert.equal((await api.post('/api/ratings', { qid, value: 'meh' })).status, 400);
  assert.equal((await api.post('/api/ratings', { qid: 'does-not-exist', value: 'up' })).status, 400);
  assert.ok(fs.readFileSync(path.join(sb.home, 'bank', 'ratings.md'), 'utf8').includes(qid), 'appended to bank/ratings.md');

  const q = (await api.get('/api/quality')).body;
  assert.deepEqual(q.ratings[qid], { up: 0, down: 1 }, 'same-day votes count once');
  assert.ok(!q.lowRated.includes(qid));

  // a 👎 from an earlier day (e.g. synced from the other machine) → down 2 → low-rated
  const d = new Date(Date.now() - 2 * 86_400_000);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  fs.appendFileSync(path.join(sb.home, 'bank', 'ratings.md'), `- ${day} · \`${qid}\` · down · e2e: hôm trước\n`);
  const q2 = (await api.get('/api/quality')).body;
  assert.deepEqual(q2.ratings[qid], { up: 0, down: 2 });
  assert.ok(q2.lowRated.includes(qid));
});

test('quality: BankQuality shape', T, async () => {
  const r = await api.get('/api/quality');
  assert.equal(r.status, 200);
  const q = r.body;
  assert.equal(typeof q.version, 'string');
  assert.ok(q.total >= bank.length * 0.9);
  for (const k of ['singleAnswer', 'correctLongest', 'medianStemWords', 'longForm', 'shortExplanations', 'withHint', 'withTask', 'enriched']) {
    assert.equal(typeof q[k], 'number', k);
  }
  const letters = Object.values(q.letters as Record<string, number>).reduce((s, n) => s + n, 0);
  assert.equal(letters, q.singleAnswer, 'letter distribution covers single-answer questions');
  assert.ok(q.lettersByOrigin && typeof q.lettersByOrigin === 'object');
  assert.ok(Array.isArray(q.duplicates) && q.duplicates.length <= 50);
  for (const d of q.duplicates) assert.ok(d.a && d.b && d.score > 0 && d.score <= 1);
  assert.equal(typeof q.variantEffect.originals, 'number');
  assert.ok(Array.isArray(q.lowRated));
});

test('issues: report a question; unknown ids are rejected', T, async () => {
  const ok = await api.post('/api/issues', { qid: bank[0].id, type: 'wrong-key', note: 'e2e: nghĩ là đáp án khác' });
  assert.equal(ok.status, 200);
  assert.equal((await api.post('/api/issues', { qid: 'does-not-exist', type: 'typo', note: 'x' })).status, 400);
  const list = (await api.get<any[]>('/api/issues')).body;
  assert.ok(list.some((i) => i.qid === bank[0].id && i.open));
});

// ── AI side (read-only: never starts a coach run or an AI call) ─────────────

test('coach info: costs, enrich status, resolved models', T, async () => {
  const c = (await api.get('/api/coach')).body;
  assert.ok(c.costs && typeof c.costs.costUsd === 'number' && typeof c.costs.runs === 'number', 'costs');
  assert.ok(c.costs.byTask && c.costs.asks && typeof c.costs.asks.count === 'number');
  assert.ok(c.enrich && typeof c.enrich.total === 'number', 'enrich');
  assert.ok(c.models && ['analyze', 'generate', 'enrich', 'ask'].every((k) => typeof c.models[k] === 'string'), 'models');
  const e = await api.get('/api/enrich/status');
  assert.equal(e.status, 200);
  for (const k of ['explain', 'hint', 'classify', 'balance']) assert.equal(typeof e.body.pending[k], 'number', `pending.${k}`);
  assert.equal(typeof e.body.longForm, 'number');
  const qa = await api.get(`/api/qa/${encodeURIComponent(bank[0].id)}`);
  assert.equal(qa.status, 200);
  assert.ok(Array.isArray(qa.body));
});

test('snapshot carries why-notes and the bank quality section', T, async () => {
  const w = await api.post('/api/snapshot', {});
  assert.equal(w.status, 200);
  const s = (await api.get('/api/snapshot')).body.content as string;
  assert.ok(s.length > 500);
  assert.ok(s.includes('cost-effective'), 'why-note of a wrong answer');
  assert.ok(/Chất lượng ngân hàng/.test(s), 'section "Chất lượng ngân hàng" (qualitySnapshotLines) missing');
});

// ── sync (local bare remote — never GitHub) ─────────────────────────────────

test('sync: status → commit + push of the new results → clean', T, async () => {
  const st = await api.get('/api/sync/status');
  assert.equal(st.status, 200);
  assert.equal(st.body.branch, 'main');
  assert.equal(st.body.remote, 'origin/main');
  assert.equal(st.body.ahead, 0);
  assert.equal(st.body.behind, 0);
  assert.ok(st.body.dirtyData > 0, 'new result files are pending');
  assert.equal(st.body.error, undefined);
  assert.equal(st.body.host, meta.host);

  const dry = await api.post('/api/sync', { dryRun: true });
  assert.equal(dry.status, 200);
  assert.equal(dry.body.ok, true, dry.body.message);
  assert.match(dry.body.message, /Chạy thử/);

  const r = await api.post('/api/sync', {});
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true, r.body.message);
  assert.equal(r.body.host, meta.host);
  assert.ok(r.body.steps.length >= 3 && r.body.steps.every((s: any) => typeof s.cmd === 'string' && typeof s.ok === 'boolean' && typeof s.output === 'string'));
  assert.ok(r.body.steps.some((s: any) => s.cmd.startsWith('git push') && s.ok));
  assert.match(git(sb.remote!, 'log', '-1', '--format=%s', 'main'), /^trainer: sync từ .+ \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  const pushed = git(sb.remote!, 'show', '--name-only', '--format=', 'main');
  assert.match(pushed, /trainer\/results\/\d{4}\/\d{2}\/.+\.md/);
  assert.match(pushed, /trainer\/bank\/issues\.md/);
  assert.doesNotMatch(pushed, /snapshot\.md/, 'git-ignored snapshot is not synced');

  const after = (await api.get('/api/sync/status')).body;
  assert.equal(after.dirtyData, 0);
  assert.equal(after.ahead, 0);
  assert.match(after.lastSync?.subject ?? '', /^trainer: sync từ/);
});

test('a TRAINER_HOME sandbox outside the repo never syncs', T, async () => {
  const other = makeSandbox();
  const notRepo = path.join(other.root, 'not-a-repo');
  fs.mkdirSync(notRepo);
  const s2 = await startServer({ home: other.home, repo: notRepo });
  try {
    const c = apiClient(s2.base);
    const st = (await c.get('/api/sync/status')).body;
    assert.equal(st.disabled, true);
    assert.match(st.error, /TRAINER_HOME/);
    const r = (await c.post('/api/sync', {})).body;
    assert.equal(r.ok, false);
    assert.match(r.message, /TRAINER_HOME/);
    assert.deepEqual(r.steps, []);
  } finally {
    await s2.stop();
    other.cleanup();
  }
});
