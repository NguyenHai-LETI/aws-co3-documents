// [v5 τ] 🎧 listen routes against the real server on a sandbox: GET /api/listen/next (short practice questions with the
// answer, never sealed) and POST /api/listen/finish → a 'listen' attempt with self-grades (idempotent, shown in history,
// FSRS states move). Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import type { Attempt, ListenFinishResponse, ListenNext } from '../../shared/types.ts';

const T = { timeout: 120_000 };
let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;

before(
  async () => {
    sb = makeSandbox();
    srv = await startServer({ home: sb.home });
    api = apiClient(srv.base);
  },
  { timeout: 90_000 },
);
after(async () => {
  await srv?.stop();
  sb?.cleanup();
});

test('next: short practice questions with the answer, never a sealed one', T, async () => {
  const n = (await api.get<ListenNext>('/api/listen/next?n=8')).body;
  assert.ok(n.items.length > 0 && n.items.length <= 8);
  for (const it of n.items) {
    assert.ok(it.stem && it.options.length >= 2 && it.answer.length >= 1, it.id);
    assert.ok(it.stem.split(/\s+/).length <= 45, `${it.id} is short`);
    assert.ok(!/\*\*|`/.test(it.stem + it.explanation), 'plain text');
  }
  // hold the first one back in a sealed form: it is not served any more
  const first = n.items[0].id;
  const sealed = path.join(sb.home, 'results', 'sealed.md');
  fs.writeFileSync(sealed, `---\nkind: sealed\nsize: 1\nforms:\n  - id: S1\n    status: sealed\n    ids: [ ${first} ]\n---\n`);
  try {
    const again = (await api.get<ListenNext>('/api/listen/next?n=30')).body;
    assert.ok(!again.items.some((i) => i.id === first));
    const r = await api.post<ListenFinishResponse>('/api/listen/finish', { sessionId: 'listen:e2e-sealed-only', items: [{ q: first, grade: 4, t: 10 }] });
    assert.equal(r.status, 400, 'a sealed id is never recorded');
  } finally {
    fs.rmSync(sealed);
  }
});

test('finish: a listen attempt with self-grades (FSRS states move), idempotent, then not served again today', T, async () => {
  const n = (await api.get<ListenNext>('/api/listen/next?n=3')).body;
  const items = n.items.map((it, i) => ({ q: it.id, grade: ([1, 3, 4] as const)[i % 3], t: 20 + i }));
  const body = { sessionId: 'listen:e2e-session-1', started: new Date(Date.now() - 120_000).toISOString(), finished: new Date().toISOString(), items };
  const r = await api.post<ListenFinishResponse>('/api/listen/finish', body);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.total, items.length);
  assert.equal(r.body.correct, items.filter((x) => x.grade >= 3).length);
  const dup = await api.post<ListenFinishResponse>('/api/listen/finish', body);
  assert.equal(dup.body.id, r.body.id);
  assert.equal(dup.body.duplicate, true);

  const a = (await api.get<{ attempt: Attempt }>(`/api/results/${encodeURIComponent(r.body.id)}`)).body.attempt;
  assert.equal(a.mode, 'listen');
  assert.equal(a.source, 'listen');
  assert.deepEqual(
    a.answers.map((x) => [x.q, x.pick, x.grade, x.ok]),
    items.map((x) => [x.q, '', x.grade, x.grade >= 3]),
  );
  const states = (await api.get<{ states: Record<string, { attempts: number }> }>('/api/state')).body.states;
  for (const x of items) assert.ok((states[x.q]?.attempts ?? 0) >= 1, `${x.q} has a memory state`);
  const later = (await api.get<ListenNext>('/api/listen/next?n=30')).body;
  assert.ok(!later.items.some((i) => items.some((x) => x.q === i.id)), 'answered today: not served again');
  assert.equal((await api.post('/api/listen/finish', { sessionId: 'listen:e2e-empty', items: [] })).status, 400);
});
