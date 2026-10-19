// End-to-end checks of the performance & search layer against the real server (sandbox TRAINER_HOME + a temp repo with
// notes, free port): data versions in /api/meta and the SSE `data` event, paginated results and plan summaries, the coach
// snapshot written after the response (and on demand), /api/search (FTS5) and gzip-compressed JSON. Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { seedHistory, takeTest } from '../helpers/learner.ts';
import type { AttemptSummary, DataVersions, Plan, PlansResponse, ResultsPage, SearchResponse } from '../../shared/types.ts';

let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;
let repo: string;
const T = { timeout: 120_000 };

before(
  async () => {
    sb = makeSandbox();
    repo = path.join(sb.root, 'repo');
    fs.mkdirSync(repo);
    fs.writeFileSync(path.join(repo, '02-storage.md'), '# Lưu trữ\n\n## Độ bền S3\nS3 có độ bền 11 số 9 nhờ nhiều bản sao.\n\n## Đáp án mẫu\nĐáp án chi tiết.\n');
    srv = await startServer({ home: sb.home, repo });
    api = apiClient(srv.base);
    await seedHistory(api);
  },
  { timeout: 120_000 },
);

after(async () => {
  await srv?.stop();
  sb?.cleanup();
});

test('meta carries the data versions; a submit changes the results version only', T, async () => {
  const v1 = (await api.get<{ versions: DataVersions; bankVersion: string }>('/api/meta')).body;
  assert.ok(v1.versions && ['bank', 'results', 'plans'].every((k) => typeof v1.versions[k as keyof DataVersions] === 'string'));
  assert.equal(v1.versions.bank, v1.bankVersion);
  await takeTest(api, { mode: 'quick' }, { daysAgo: 0 });
  const v2 = (await api.get<{ versions: DataVersions }>('/api/meta')).body.versions;
  assert.notEqual(v2.results, v1.versions.results);
  assert.equal(v2.bank, v1.versions.bank);
  assert.equal(v2.plans, v1.versions.plans);
});

test('the SSE data event announces the same versions as /api/meta', T, async () => {
  const ctl = new AbortController();
  const res = await fetch(`${srv.base}/api/events`, { signal: ctl.signal });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const event = (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error('stream closed');
      buf += decoder.decode(value, { stream: true });
      const m = buf.match(/event: data\ndata: (.+)\n/);
      if (m) return JSON.parse(m[1]) as DataVersions;
    }
  })();
  await new Promise((r) => setTimeout(r, 3500)); // the poller records the current versions first
  await takeTest(api, { mode: 'quick' }, { daysAgo: 0 });
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('no data event within 10 s')), 10_000));
  try {
    const v = await Promise.race([event, timeout]);
    const meta = (await api.get<{ versions: DataVersions }>('/api/meta')).body.versions;
    assert.deepEqual(v, meta);
  } finally {
    ctl.abort();
  }
});

test('results: legacy array without a query, ResultsPage with limit/offset/mode/q', T, async () => {
  const all = (await api.get<AttemptSummary[]>('/api/results')).body;
  assert.ok(Array.isArray(all) && all.length >= 6);
  const page = (await api.get<ResultsPage>('/api/results?limit=2&offset=1')).body;
  assert.deepEqual(page.items.map((a) => a.id), all.slice(1, 3).map((a) => a.id), 'newest first, same order as the legacy list');
  assert.equal(page.total, all.length);
  assert.equal(page.offset, 1);
  assert.equal(page.limit, 2);
  assert.ok(page.modes.includes('exam') && page.trend.length >= 2);
  const exams = (await api.get<ResultsPage>('/api/results?limit=50&mode=exam')).body;
  assert.ok(exams.total >= 1 && exams.items.every((a) => a.mode === 'exam'));
  assert.equal((await api.get<ResultsPage>('/api/results?limit=50&q=khong-co-tieu-de-nay')).body.total, 0);
  assert.equal((await api.get<ResultsPage>('/api/results?limit=999')).body.limit, 200, 'limit capped');
});

test('plans: summaries without the body (newest first), slices with total, full plan by id, 404 otherwise', T, async () => {
  const dir = path.join(sb.home, 'coach', 'plans');
  for (const [i, day] of [10, 11, 12].entries()) {
    fs.writeFileSync(
      path.join(dir, `plan-${day}.md`),
      `---\nid: plan-${day}\ncreated: 2026-10-${day}T08:00:00+07:00\nsessions:\n  - id: s1\n    title: "Phiên ${i + 1}"\n    filter: { mode: quick, count: 5 }\n---\n\n# Kế hoạch ${day}\n\n${'Phân tích. '.repeat(50)}\n`,
    );
  }
  const all = (await api.get<PlansResponse>('/api/plans')).body;
  assert.deepEqual(all.plans.map((p) => p.id), ['plan-12', 'plan-11', 'plan-10']);
  assert.ok(all.plans.every((p) => !('body' in p)), 'no Markdown body in the list');
  assert.equal(typeof all.newSince.attempts, 'number');
  const one = (await api.get<PlansResponse>('/api/plans?limit=1&offset=1')).body;
  assert.deepEqual(one.plans.map((p) => p.id), ['plan-11']);
  assert.equal(one.total, 3);
  const full = await api.get<Plan>('/api/plans/plan-11');
  assert.equal(full.status, 200);
  assert.match(full.body.body, /# Kế hoạch 11/);
  assert.deepEqual(full.body.sessions[0].done, []);
  assert.equal((await api.get('/api/plans/nope')).status, 404);
});

test('plans: offset pages reach every plan beyond the 200 cap (the Coach page appends pages of 30)', T, async () => {
  const dir = path.join(sb.home, 'coach', 'plans');
  const bulk = Array.from({ length: 230 }, (_, i) => `bulk-${String(i).padStart(3, '0')}`);
  bulk.forEach((id, i) => fs.writeFileSync(path.join(dir, `${id}.md`), `---\nid: ${id}\ncreated: ${new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString()}\nsessions: []\n---\n`));
  try {
    const total = (await api.get<PlansResponse>('/api/plans?limit=30')).body.total!;
    assert.ok(total >= 233);
    const seen: string[] = [];
    for (let offset = 0; offset < total; offset += 30) seen.push(...(await api.get<PlansResponse>(`/api/plans?limit=30&offset=${offset}`)).body.plans.map((p) => p.id));
    assert.equal(new Set(seen).size, total, 'every plan exactly once');
    assert.equal(seen.at(-1), 'bulk-000', 'the oldest plan comes last');
  } finally {
    for (const id of bulk) fs.rmSync(path.join(dir, `${id}.md`), { force: true });
  }
});

test('/api/state carries the versions it was computed from; config.yaml edits move them and fire a data event', T, async () => {
  const meta = (await api.get<{ versions: DataVersions }>('/api/meta')).body.versions;
  const state = (await api.get<{ versions: DataVersions }>('/api/state')).body;
  assert.deepEqual(state.versions, meta);
  assert.ok(meta.params && meta.config && /^\d{4}-\d{2}-\d{2}$/.test(meta.day ?? ''), 'params / config / day');
  const ctl = new AbortController();
  const res = await fetch(`${srv.base}/api/events`, { signal: ctl.signal });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  // earlier changes (e.g. the plan files of the previous test) may be announced first: wait for the config change
  const event = (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error('stream closed');
      buf += decoder.decode(value, { stream: true });
      for (let m = buf.match(/event: data\ndata: (.+)\n/); m; m = buf.match(/event: data\ndata: (.+)\n/)) {
        buf = buf.slice((m.index ?? 0) + m[0].length);
        const v = JSON.parse(m[1]) as DataVersions;
        if (v.config !== meta.config) return v;
      }
    }
  })();
  await new Promise((r) => setTimeout(r, 3500)); // the poller records the current versions first
  fs.appendFileSync(path.join(sb.home, 'config.yaml'), '\n# e2e: edited\n');
  try {
    const v = await Promise.race([event, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('no data event within 10 s')), 10_000))]);
    assert.notEqual(v.config, meta.config);
    assert.equal(v.results, meta.results);
    assert.deepEqual((await api.get<{ versions: DataVersions }>('/api/state')).body.versions, v, 'states recomputed for the new config');
  } finally {
    ctl.abort();
  }
});

test('submitting does not build the coach snapshot in the request; GET /api/snapshot builds it when stale', T, async () => {
  const file = path.join(sb.home, 'coach', 'snapshot.md');
  await api.get('/api/snapshot'); // fresh now
  fs.rmSync(file, { force: true });
  const t0 = performance.now();
  await takeTest(api, { mode: 'quick' }, { daysAgo: 0 });
  assert.ok(!fs.existsSync(file), 'written later by the debounced job, not by POST /api/results');
  const snap = await api.get<{ content: string }>('/api/snapshot');
  assert.equal(snap.status, 200);
  assert.ok(fs.existsSync(file), 'built on demand');
  const attempts = (await api.get<AttemptSummary[]>('/api/results')).body.filter((a) => !a.rushed).length;
  assert.match(snap.body.content, new RegExp(`^attempts: ${attempts}$`, 'm'), 'includes the attempt just submitted');
  assert.ok(performance.now() - t0 < 60_000);
});

test('search: FTS5 over questions and notes, Vietnamese without diacritics, scope, bad scope → 400', T, async () => {
  const r = (await api.get<SearchResponse>(`/api/search?q=${encodeURIComponent('do ben s3')}`)).body;
  assert.equal(r.engine, 'fts5');
  const note = r.hits.find((h) => h.kind === 'note');
  assert.ok(note, 'note section found');
  assert.equal(note.id, '02-storage.md');
  assert.equal(note.anchor, 'do-ben-s3');
  assert.match(note.snippet, /«độ» «bền»/);
  const q = (await api.get<SearchResponse>('/api/search?q=dynamodb&scope=questions&limit=3')).body;
  assert.ok(q.hits.length > 0 && q.hits.length <= 3 && q.hits.every((h) => h.kind === 'question'));
  assert.ok((q.total?.questions ?? 0) >= q.hits.length);
  assert.equal((await api.get('/api/search?q=x&scope=everything')).status, 400);
  assert.deepEqual((await api.get<SearchResponse>('/api/search?q=')).body.hits, []);
});

test('large JSON responses are gzip-compressed for clients that accept it', T, async () => {
  const r = await fetch(`${srv.base}/api/bank`, { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(r.headers.get('content-encoding'), 'gzip');
  const body = (await r.json()) as { questions: unknown[] };
  assert.ok(body.questions.length > 100, 'decoded transparently');
});
