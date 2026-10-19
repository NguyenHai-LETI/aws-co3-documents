// End-to-end tests of the v3 learning routes against the real server: sandbox TRAINER_HOME (copy of the bank),
// free port, a simulated learner. Goal + forecast, external scores + calibration, item re-grading after an answer-key
// fix, FSRS optimizer (blocked → 409; background child process → results/fsrs-params.json). Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { rng, seedHistory, takeTest } from '../helpers/learner.ts';
import type { Attempt, ProgressResponse, StatsResponse } from '../../shared/types.ts';

let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;
let meta: any;
let history: Attempt[] = [];
const T = { timeout: 120_000 };
const DAY = 86_400_000;

const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

before(
  async () => {
    sb = makeSandbox();
    const notRepo = path.join(sb.root, 'not-a-repo'); // nothing here may look at the real repo
    fs.mkdirSync(notRepo);
    srv = await startServer({ home: sb.home, repo: notRepo });
    api = apiClient(srv.base);
    meta = (await api.get('/api/meta')).body;
    history = await seedHistory(api);
  },
  { timeout: 120_000 },
);

after(async () => {
  await srv?.stop();
  if (process.env.E2E_KEEP) console.log(`sandbox kept: ${sb?.root}`);
  else sb?.cleanup();
});

async function progress(): Promise<ProgressResponse> {
  const r = await api.get<ProgressResponse>('/api/progress');
  assert.equal(r.status, 200);
  return r.body;
}

test('GET /api/progress: FSRS-6 info, 30-day workload, no goal yet', T, async () => {
  const p = await progress();
  assert.match(p.today, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(p.today, dayKey(Date.now()));
  assert.equal(p.fsrs.version, 'fsrs-6');
  assert.equal(p.fsrs.params, 'default');
  assert.equal(p.fsrs.weights.length, 21);
  assert.ok(['available', 'unavailable'].includes(p.fsrs.optimizer));
  assert.ok((p.fsrs.historyReviews ?? 0) > 50, 'seeded reviews counted');
  // blocked: below srs.optimize_min_reviews (or the optional optimizer package is missing on this platform)
  assert.match(p.fsrs.blocked ?? '', p.fsrs.optimizer === 'available' ? /400/ : /tối ưu/i, p.fsrs.blocked);
  assert.equal(p.workload.length, 30);
  assert.equal(p.workload[0].date, p.today);
  assert.ok(p.workload.reduce((s, d) => s + d.due, 0) > 0, 'wrong answers come back for review');
  assert.equal(p.goal.examDate, undefined);
  assert.equal(p.goal.targetScaled, meta.exam.pass_scaled);
  assert.equal(p.forecast, undefined);
  assert.deepEqual(p.external, []);
  assert.equal(p.regraded, 0);
});

test('POST /api/goal → forecast for that day; bad input → 400; results/goal.md is not an attempt', T, async () => {
  const before = (await api.get<any[]>('/api/results')).body.length;
  const exam = dayKey(Date.now() + 30 * DAY);
  const r = await api.post<ProgressResponse>('/api/goal', { examDate: exam, targetScaled: 800 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const f = r.body.forecast!;
  assert.equal(f.examDate, exam);
  assert.equal(f.daysLeft, 30);
  assert.ok(f.ifStopNow > 0 && f.ifStopNow <= f.onSchedule && f.onSchedule <= 100, `${f.ifStopNow} ≤ ${f.onSchedule}`);
  assert.equal(f.byDomain.length, 4);
  assert.ok(f.coverage > 0 && f.coverage < 100);
  assert.equal(r.body.workload.length, 31, 'today … exam day');
  assert.deepEqual(r.body.goal, { examDate: exam, targetScaled: 800 });
  const text = fs.readFileSync(path.join(sb.home, 'results', 'goal.md'), 'utf8');
  assert.match(text, /^kind: goal$/m);
  // keep / clear semantics and validation
  assert.deepEqual((await api.post<ProgressResponse>('/api/goal', { targetScaled: 760 })).body.goal, { examDate: exam, targetScaled: 760 });
  const bad = await api.post('/api/goal', { examDate: '2026-13-01' });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /Ngày thi/);
  assert.equal((await api.post('/api/goal', { targetScaled: 5000 })).status, 400);
  // the goal file never shows up as a result, stats unchanged
  assert.equal((await api.get<any[]>('/api/results')).body.length, before);
  const s = (await api.get<StatsResponse>('/api/stats')).body;
  assert.equal(s.totals.attempts + s.totals.rushedAttempts, before);
  assert.equal((await progress()).forecast?.examDate, exam, 'GET keeps the goal');
});

test('POST /api/external + delete: listed newest first, calibrated against the readiness on that date', T, async () => {
  const today = dayKey(Date.now());
  const r = await api.post<ProgressResponse>('/api/external', { date: today, source: 'AWS Official Practice Exam', score: 74, note: 'Skill Builder' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const e = r.body.external[0];
  assert.equal(e.source, 'AWS Official Practice Exam');
  assert.equal(e.score, 74);
  assert.equal(typeof e.readinessAtDate, 'number', 'the app had answers before that date');
  const c = r.body.externalCalibration!;
  assert.equal(c.samples, 1);
  assert.equal(c.offset, Math.round((74 - e.readinessAtDate!) * 10) / 10);
  assert.ok(fs.existsSync(path.join(sb.home, e.file)));
  const scaledOnly = await api.post<ProgressResponse>('/api/external', { date: dayKey(Date.now() - 2 * DAY), source: 'Tutorials Dojo', scaled: 690 });
  assert.equal(scaledOnly.status, 200);
  assert.deepEqual(scaledOnly.body.external.map((x) => x.score), [74, 69], 'newest first; percent = scaled / 10');
  for (const body of [{ date: today, source: 'x' }, { date: dayKey(Date.now() + 2 * DAY), source: 'x', score: 70 }, { date: 'yesterday', source: 'x', score: 70 }, { date: today, score: 70 }]) {
    assert.equal((await api.post('/api/external', body)).status, 400, JSON.stringify(body));
  }
  const del = await api.post<ProgressResponse>(`/api/external/${encodeURIComponent(e.id)}/delete`);
  assert.equal(del.status, 200);
  assert.deepEqual(del.body.external.map((x) => x.source), ['Tutorials Dojo']);
  assert.equal((await api.post(`/api/external/${encodeURIComponent(e.id)}/delete`)).status, 404);
  assert.equal((await api.post('/api/external/..%2Fgoal/delete')).status, 400);
  assert.equal((await api.get<any[]>('/api/results')).body.length, history.length, 'external files are not attempts');
});

test('item versioning: fixing an answer key re-grades old answers in stats/states, the stored result stays as graded', T, async () => {
  const exam = history.find((a) => a.answers.length >= 20)!;
  const target = exam.answers.find((a) => a.pick.length === 1 && !a.ok)!;
  // the learner's wrong pick becomes the key: the answer now counts as correct
  let edited = false;
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.md') ? [path.join(d, e.name)] : []));
  for (const f of walk(path.join(sb.home, 'bank', 'packs'))) {
    const text = fs.readFileSync(f, 'utf8');
    const i = text.indexOf(`## Q ${target.q}\n`);
    if (i < 0) continue;
    const j = text.indexOf('**Answer:**', i);
    fs.writeFileSync(f, text.slice(0, j) + `**Answer:** ${target.pick}` + text.slice(text.indexOf('\n', j)));
    edited = true;
  }
  assert.ok(edited, `question ${target.q} found in the sandbox bank`);
  const s = (await api.get<StatsResponse>('/api/stats')).body;
  assert.ok((s.regraded ?? 0) >= 1, `stats.regraded ${s.regraded}`);
  assert.ok(((await progress()).regraded ?? 0) >= 1);
  const st = (await api.get<any>('/api/state')).body.states[target.q];
  const later = history.filter((a) => a.finished > exam.finished && a.answers.some((x) => x.q === target.q));
  if (!later.length) assert.equal(st.lastOk, true, 'the last answer now counts as correct');
  const stored = (await api.get<any>(`/api/results/${encodeURIComponent(exam.id)}`)).body.attempt;
  const r = stored.answers.find((x: any) => x.q === target.q);
  assert.deepEqual([r.ok, r.key, r.regraded], [false, target.key, undefined], 'the result as graded at the time');
  assert.match(fs.readFileSync(path.join(sb.home, exam.file), 'utf8'), new RegExp(`q: "?${target.q}"?, pick: "?${target.pick}"?, key: "?${target.key}"?, ok: false`), 'file not rewritten');
});

test('POST /api/fsrs/optimize: 409 below the threshold; otherwise a background run writes results/fsrs-params.json', { timeout: 240_000 }, async (t) => {
  const blocked = await api.post('/api/fsrs/optimize');
  assert.equal(blocked.status, 409);
  assert.ok(String(blocked.body.error).length > 5);
  if ((await progress()).fsrs.optimizer === 'unavailable') return t.skip('optional @open-spaced-repetition/binding not installed');
  // fsrs-rs needs day-spaced reviews: first answers, a second answer days later and a third one
  const rand = rng(31);
  const a = await takeTest(api, { mode: 'new', count: 40 }, { daysAgo: 12, rand });
  const aIds = a.questions.map((q) => q.id);
  await takeTest(api, { mode: 'ids', ids: aIds, feedback: 'practice' }, { daysAgo: 8, rand });
  await takeTest(api, { mode: 'ids', ids: aIds }, { daysAgo: 3, rand });
  const b = await takeTest(api, { mode: 'new', count: 40 }, { daysAgo: 9, rand });
  await takeTest(api, { mode: 'ids', ids: b.questions.map((q) => q.id) }, { daysAgo: 4, rand });
  const cfgFile = path.join(sb.home, 'config.yaml');
  fs.writeFileSync(cfgFile, fs.readFileSync(cfgFile, 'utf8').replace(/optimize_min_reviews:\s*\d+/, 'optimize_min_reviews: 20').replace(/optimize:\s*auto/, 'optimize: manual'));
  const r = await api.post<any>('/api/fsrs/optimize');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.version, 'fsrs-6');
  // the child process runs in the background (slower when the whole e2e suite runs in parallel)
  let p = await progress();
  for (let i = 0; i < 600 && p.fsrs.running; i++) {
    await new Promise((res) => setTimeout(res, 250));
    p = await progress();
  }
  assert.equal(p.fsrs.running, false, 'optimization finished within 150 s');
  assert.equal(p.fsrs.lastError, undefined, `${p.fsrs.lastError}\n${srv.logs().slice(-1500)}`);
  assert.ok(p.fsrs.lastOutcome === 'adopted' || p.fsrs.lastOutcome === 'kept-default', JSON.stringify(p.fsrs));
  assert.ok(p.fsrs.optimizedAt, 'optimized');
  assert.equal(p.fsrs.reviews, p.fsrs.historyReviews);
  assert.ok(p.fsrs.metrics && Number.isFinite(p.fsrs.metrics.logLoss) && Number.isFinite(p.fsrs.metrics.defaultLogLoss));
  assert.equal(p.fsrs.params, p.fsrs.adopted ? 'personal' : 'default');
  const line = fs.readFileSync(path.join(sb.home, 'results', 'fsrs-params.json'), 'utf8').trim();
  assert.equal(line.split('\n').length, 1);
  assert.equal(JSON.parse(line).weights.length, 21);
  // the server still answers with recomputed states, and the params file is not a result
  assert.equal((await api.get('/api/stats')).status, 200);
  assert.equal((await api.get<any[]>('/api/results')).body.length, history.length + 5);
});
