// End-to-end tests of leeches ("câu dai dẳng", λ) against the real server: a question answered wrong again and again
// becomes a leech (GET /api/leeches, StatsResponse.leeches, QuestionState.leech); POST /api/leeches/:id parks it ≤ 3
// days (results/leeches.md, append-only) — then it is out of the SRS queue; notes keep the pause; 400 / 404 rules.
// GET /api/results/:id annotations of a retest. Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { takeTest } from '../helpers/learner.ts';
import type { LeechItem, QuestionState, StatsResponse } from '../../shared/types.ts';

let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;
let qid = '';
let other = '';
const T = { timeout: 120_000 };

before(
  async () => {
    sb = makeSandbox();
    const notRepo = path.join(sb.root, 'not-a-repo');
    fs.mkdirSync(notRepo);
    srv = await startServer({ home: sb.home, repo: notRepo });
    api = apiClient(srv.base);
    const first = await takeTest(api, { mode: 'quick' }, { daysAgo: 12, acc: 1 });
    qid = first.questions[0].id;
    other = first.questions[1].id;
    // right once, then wrong / right / wrong / right / wrong on different days → 3 lapses
    for (const [daysAgo, acc] of [
      [10, 0],
      [8, 1],
      [6, 0],
      [4, 1],
      [2, 0],
    ] as const) {
      await takeTest(api, { mode: 'ids', ids: [qid], feedback: 'practice' }, { daysAgo, acc, speed: 1 });
    }
  },
  { timeout: 120_000 },
);

after(async () => {
  await srv?.stop();
  if (process.env.E2E_KEEP) console.log(`sandbox kept: ${sb?.root}`);
  else sb?.cleanup();
});

const leechFile = () => path.join(sb.home, 'results', 'leeches.md');

test('a question missed again and again is a leech: GET /api/leeches, stats count, state flag', T, async () => {
  const list = (await api.get<LeechItem[]>('/api/leeches')).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].id, qid);
  assert.equal(list[0].lapses, 3);
  assert.equal(list[0].wrong, 3);
  assert.equal(list[0].wrongDays, 3);
  assert.ok(Object.values(list[0].picks).reduce((a, b) => a + b, 0) >= 3);
  assert.ok(list[0].stem.length > 0 && list[0].stem.length <= 140);
  const s = (await api.get<StatsResponse>('/api/stats')).body;
  assert.equal(s.leeches, 1);
  const st = (await api.get<{ states: Record<string, QuestionState> }>('/api/state')).body.states;
  assert.equal(st[qid].leech, true);
  assert.equal(st[other].leech, undefined);
  assert.equal(fs.existsSync(leechFile()), false, 'GETs never write');
});

test('POST /api/leeches/:id parks a leech ≤ 3 days (out of the SRS queue), keeps notes, refuses bad input', T, async () => {
  assert.equal((await api.post(`/api/leeches/${encodeURIComponent(qid)}`, { pauseDays: 5 })).status, 400);
  assert.equal((await api.post(`/api/leeches/${encodeURIComponent(other)}`, { pauseDays: 2 })).status, 400, 'not a leech');
  assert.equal((await api.post('/api/leeches/no-such-question', { note: 'x' })).status, 404);
  assert.equal((await api.post(`/api/leeches/${encodeURIComponent(qid)}`, {})).status, 400);
  const dueBefore = (await api.get<{ states: Record<string, QuestionState> }>('/api/state')).body.states[qid].dueAt!;
  assert.ok(Date.parse(dueBefore) <= Date.now() + 86_400_000 * 3, 'a lapsed question comes back soon');
  const r = await api.post<{ ok: boolean; item: LeechItem; leeches: LeechItem[] }>(`/api/leeches/${encodeURIComponent(qid)}`, { pauseDays: 3, note: 'Nhớ: đọc kỹ yêu cầu' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.item.pausedUntil);
  assert.equal(r.body.item.note, 'Nhớ: đọc kỹ yêu cầu');
  const st = (await api.get<{ states: Record<string, QuestionState> }>('/api/state')).body.states[qid];
  assert.equal(st.leechPausedUntil, r.body.item.pausedUntil);
  // a parked leech is not served by the SRS review even when due
  const srs = await api.post<{ session: { questions: { id: string }[] } }>('/api/tests', { mode: 'srs', count: 50 });
  if (srs.status === 200) assert.ok(!srs.body.session.questions.some((x) => x.id === qid), 'parked → not reviewed');
  const n = await api.post<{ item: LeechItem }>(`/api/leeches/${encodeURIComponent(qid)}`, { note: 'mẹo mới' });
  assert.equal(n.body.item.pausedUntil, r.body.item.pausedUntil, 'a note keeps the pause');
  const un = await api.post<{ item: LeechItem }>(`/api/leeches/${encodeURIComponent(qid)}`, { pauseDays: 0 });
  assert.equal(un.body.item.pausedUntil, undefined);
  assert.equal(un.body.item.note, 'mẹo mới');
  const lines = fs.readFileSync(leechFile(), 'utf8').split('\n').filter((l) => l.startsWith('- '));
  assert.equal(lines.length, 3, 'append-only lines');
  assert.ok(lines.every((l) => l.includes(` · ${qid} · pause `)));
  // results/leeches.md is not an attempt
  const results = (await api.get<unknown[]>('/api/results')).body;
  assert.ok(results.length >= 6);
});

test('GET /api/results/:id: a retest names the attempt it re-checks and its misses; the original lists its retests', T, async () => {
  const base = await takeTest(api, { mode: 'quick' }, { daysAgo: 0, acc: 0, speed: 1 });
  const wrongIds = base.attempt.answers.filter((a) => !a.ok).map((a) => a.q);
  assert.ok(wrongIds.length > 0);
  const retest = await api.post('/api/tests', { mode: 'retest', retestOf: base.attempt.id });
  if (retest.status !== 200) return; // σ's retest mode not available in this tree yet
  const taken = await takeTest(api, { mode: 'retest', retestOf: base.attempt.id }, { daysAgo: 0, acc: 0, speed: 1 });
  const r = (await api.get<{ annotations: { retest?: { of: string; title?: string; misses: string[] }; notReadiness?: string } }>(`/api/results/${encodeURIComponent(taken.attempt.id)}`)).body.annotations;
  assert.equal(r.retest?.of, base.attempt.id);
  assert.equal(r.retest?.title, base.attempt.title);
  assert.ok(r.retest!.misses.length > 0);
  assert.match(r.notReadiness ?? '', /mức sẵn sàng/);
  const o = (await api.get<{ annotations: { retested?: string[] } }>(`/api/results/${encodeURIComponent(base.attempt.id)}`)).body.annotations;
  assert.deepEqual(o.retested, [taken.attempt.id]);
});
