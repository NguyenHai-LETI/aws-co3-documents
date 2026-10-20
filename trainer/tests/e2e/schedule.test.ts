// End-to-end tests of the v5 exam-aware plan (λ) against the real server: sandbox TRAINER_HOME, free port, a simulated
// learner. GET /api/progress phase / newQuota / goNoGo / catch-up and the examAware / capacity forecast lines; POST
// /api/plan/sprint (deterministic, one file per day, 400 outside T−14); GET /api/stats evidence fields, pace, transfer.
// Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { seedHistory } from '../helpers/learner.ts';
import type { ProgressResponse, StatsResponse } from '../../shared/types.ts';

let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;
const T = { timeout: 120_000 };
const DAY = 86_400_000;
const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

before(
  async () => {
    sb = makeSandbox();
    const notRepo = path.join(sb.root, 'not-a-repo');
    fs.mkdirSync(notRepo);
    srv = await startServer({ home: sb.home, repo: notRepo });
    api = apiClient(srv.base);
    await seedHistory(api);
  },
  { timeout: 120_000 },
);

after(async () => {
  await srv?.stop();
  if (process.env.E2E_KEEP) console.log(`sandbox kept: ${sb?.root}`);
  else sb?.cleanup();
});

const plansDir = () => path.join(sb.home, 'coach', 'plans');
const planFiles = () => (fs.existsSync(plansDir()) ? fs.readdirSync(plansDir()).sort() : []);

test('GET /api/stats: evidence fields on every bucket list, pace, leeches, transfer', T, async () => {
  const s = (await api.get<StatsResponse>('/api/stats')).body;
  for (const list of [s.byDomain, s.byTopic, s.byTask, s.byService, s.byTag, s.byRequirement ?? []]) {
    for (const b of list) {
      assert.equal(typeof b.shrunk, 'number', b.key);
      assert.ok(b.lo! <= b.shrunk! && b.shrunk! <= b.hi! && b.hi! <= 100);
      assert.ok(['below', 'above', 'same', 'unknown'].includes(b.verdict!));
    }
  }
  assert.ok(s.pace! >= 0.6 && s.pace! <= 2);
  assert.equal(typeof s.leeches, 'number');
  assert.equal(s.transfer?.days, 30);
});

test('no exam date: no phase / quota / go-no-go; the sprint plan is refused (400) and nothing is written', T, async () => {
  const p = (await api.get<ProgressResponse>('/api/progress')).body;
  assert.equal(p.phase, undefined);
  assert.equal(p.newQuota, undefined);
  assert.equal(p.goNoGo, undefined);
  const before = planFiles();
  const r = await api.post('/api/plan/sprint', {});
  assert.equal(r.status, 400);
  assert.match(r.body.error, /ngày thi/);
  assert.deepEqual(planFiles(), before);
});

test('exam in 30 days: build phase, new-question quota, examAware + capacity lines; no go / no-go yet', T, async () => {
  const r = await api.post<ProgressResponse>('/api/goal', { examDate: dayKey(Date.now() + 30 * DAY), minutesPerDay: 30 });
  assert.equal(r.status, 200);
  const p = r.body;
  assert.equal(p.phase?.id, 'build');
  assert.equal(p.phase?.daysLeft, 30);
  assert.ok(p.phase!.rules.length > 0);
  const q = p.newQuota!;
  assert.equal(q.daysLeft, 20);
  assert.equal(q.cutoff, dayKey(Date.now() + 20 * DAY));
  assert.ok(q.unseen > 100 && q.perDay >= Math.ceil(q.unseen / 20));
  assert.equal(p.goNoGo, undefined, 'shown from T−14');
  assert.equal(typeof p.forecast?.examAware, 'number');
  assert.deepEqual(p.forecast!.capacity!.map((c) => c.minutesPerDay), [10, 20, 30, 45]);
  const r2 = await api.post('/api/plan/sprint', {});
  assert.equal(r2.status, 400);
  assert.match(r2.body.error, /14 ngày/);
});

test('exam in 10 days: measure phase, go / no-go with a deadline, POST /api/plan/sprint writes one plan per day', T, async () => {
  const exam = dayKey(Date.now() + 10 * DAY);
  const p = (await api.post<ProgressResponse>('/api/goal', { examDate: exam, examTime: '09:30' })).body;
  assert.equal(p.phase?.id, 'measure');
  assert.ok(p.goNoGo);
  assert.ok(['go', 'reschedule', 'unknown'].includes(p.goNoGo!.verdict));
  assert.deepEqual(p.goNoGo!.checks.map((c) => c.id), ['fresh', 'readiness', 'domains']);
  assert.equal(p.goNoGo!.deadline, `${dayKey(Date.now() + 9 * DAY)}T09:30`);
  const filesBefore = planFiles();
  await api.get('/api/progress');
  await api.get('/api/plans');
  assert.deepEqual(planFiles(), filesBefore, 'GETs never write');
  const r = await api.post<{ plan: { id: string; trigger: string; sessions: { id: string; filter?: { mode: string } }[] }; created: boolean }>('/api/plan/sprint', {});
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.created, true);
  assert.equal(r.body.plan.trigger, 'sprint');
  assert.ok(r.body.plan.sessions.length >= 9);
  assert.ok(r.body.plan.sessions.some((s) => s.filter?.mode === 'exam'), 'a mock');
  const again = await api.post<{ created: boolean; plan: { id: string } }>('/api/plan/sprint', {});
  assert.equal(again.body.created, false);
  assert.equal(again.body.plan.id, r.body.plan.id);
  assert.equal(planFiles().filter((f) => f.endsWith('-sprint.md')).length, 1);
  const list = (await api.get<{ plans: { id: string }[] }>('/api/plans')).body.plans;
  assert.equal(list[0].id, r.body.plan.id, 'the newest plan');
  // a session of the plan builds a test (plan sessions work unchanged)
  const s = r.body.plan.sessions.find((x) => x.filter?.mode === 'exam')!;
  const built = await api.post('/api/tests', { mode: 'coach', plan: `${r.body.plan.id}#${s.id}` });
  assert.equal(built.status, 200, JSON.stringify(built.body).slice(0, 200));
});

test('exam in 3 days: consolidate, no new questions (quota paused with a reason)', T, async () => {
  const p = (await api.post<ProgressResponse>('/api/goal', { examDate: dayKey(Date.now() + 3 * DAY) })).body;
  assert.equal(p.phase?.id, 'consolidate');
  assert.equal(p.phase?.newQuestions, false);
  assert.equal(p.newQuota?.perDay, 0);
  assert.match(p.newQuota!.paused!, /Củng cố/);
  await api.post('/api/goal', { examDate: null });
});
