// Safe submit on flaky connections (8-08) + reading time (1-05) against the real server on a sandbox: POST /api/results
// is idempotent per TestSession.sessionId, and the browser outbox (web/lib/session.ts, driven here in Node with a
// localStorage stand-in) keeps a submit that got no answer and sends the very same request again later.
// Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, freePort, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { buildTest, wrongKeys } from '../helpers/learner.ts';
import type { AnswerInput, Attempt, Question, SubmitRequest, TestSession } from '../../shared/types.ts';

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

function resultFiles(): string[] {
  const dir = path.join(sb.home, 'results');
  const walk = (d: string): string[] => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.md') && /^\d{4}-/.test(e.name) ? [path.join(d, e.name)] : [])) : []);
  return walk(dir);
}

function request(session: TestSession, questions: Question[], finishedMs: number, extra: (q: Question, i: number) => Partial<AnswerInput> = () => ({})): SubmitRequest {
  const answers = questions.map((q, i): AnswerInput => ({ q: q.id, pick: i % 2 ? q.answer : [wrongKeys(q)[0]], t: 30 + i, ...extra(q, i) }));
  const timeUsed = answers.reduce((s, a) => s + a.t, 0);
  return { session, answers, startedAt: new Date(finishedMs - timeUsed * 1000).toISOString(), finishedAt: new Date(finishedMs).toISOString(), timedOut: false, timeUsed };
}

test('the same session submitted twice → the stored attempt, duplicate: true, one file, counted once', T, async () => {
  const { session, questions } = await buildTest(api, { mode: 'quick' });
  const before = resultFiles().length;
  const statsBefore = (await api.get('/api/stats')).body.totals.attempts;
  const req = request(session, questions, Date.now() - 60_000);
  const first = await api.post<{ attempt: Attempt; duplicate?: boolean }>('/api/results', req);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.duplicate, undefined);
  assert.equal(first.body.attempt.sessionId, session.sessionId, 'session id stored in the result');
  // the retry of a lost response: a client that did not keep finishedAt would even send another one
  const again = await api.post<{ attempt: Attempt; duplicate?: boolean }>('/api/results', { ...req, finishedAt: new Date().toISOString(), timeUsed: req.timeUsed + 99 });
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal(again.body.attempt.id, first.body.attempt.id);
  assert.equal(again.body.attempt.finished, first.body.attempt.finished, 'the first submit wins');
  assert.equal(resultFiles().length, before + 1, 'exactly one result file');
  assert.match(fs.readFileSync(path.join(sb.home, first.body.attempt.file), 'utf8'), new RegExp(`^session: ${session.sessionId}$`, 'm'));
  const statsAfter = (await api.get('/api/stats')).body.totals.attempts;
  assert.equal(statsAfter, statsBefore + 1, 'stats count the attempt once');
  const list = (await api.get<Attempt[]>('/api/results')).body.filter((a) => a.id === first.body.attempt.id);
  assert.equal(list.length, 1);
});

test('racing duplicate submits of one session write one file; different sessions in the same second both count', T, async () => {
  const a = await buildTest(api, { mode: 'quick' });
  const b = await buildTest(api, { mode: 'quick' });
  const before = resultFiles().length;
  const at = Date.parse('2026-10-12T08:00:00+07:00'); // same finishedAt for every request below
  const reqA = request(a.session, a.questions, at);
  const reqB = request(b.session, b.questions, at);
  const out = await Promise.all([reqA, reqA, reqB, reqA, reqB].map((r) => api.post<{ attempt: Attempt; duplicate?: boolean }>('/api/results', r)));
  assert.ok(out.every((r) => r.status === 200), JSON.stringify(out.map((r) => r.status)));
  const ids = new Set(out.map((r) => r.body.attempt.id));
  assert.equal(ids.size, 2, `two attempts (A and B), got ${[...ids].join(', ')}`);
  assert.equal(out.filter((r) => !r.body.duplicate).length, 2, 'one write per session');
  assert.equal(resultFiles().length, before + 2);
  const [idA, idB] = [out[0].body.attempt.id, out[2].body.attempt.id];
  assert.notEqual(idA, idB, 'same second, same mode: the second file gets a -2 suffix');
});

test('a deleted result can be submitted again (the learner removed the file on purpose)', T, async () => {
  const { session, questions } = await buildTest(api, { mode: 'quick' });
  const req = request(session, questions, Date.now() - 30_000);
  const first = (await api.post<{ attempt: Attempt }>('/api/results', req)).body.attempt;
  fs.rmSync(path.join(sb.home, first.file));
  const again = await api.post<{ attempt: Attempt; duplicate?: boolean }>('/api/results', req);
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, undefined, 'written again');
  assert.ok(fs.existsSync(path.join(sb.home, again.body.attempt.file)));
});

test('reading time after "Kiểm tra" is stored as rt and kept out of t (FSRS / speed stats use t only)', T, async () => {
  const { session, questions } = await buildTest(api, { mode: 'quick', feedback: 'practice' });
  const req = request(session, questions, Date.now() - 20_000, (_q, i) => (i === 0 ? { t: 6, rt: 15 } : i === 1 ? { t: 7, rt: 0 } : {}));
  const r = await api.post<{ attempt: Attempt }>('/api/results', req);
  assert.equal(r.status, 200);
  const [a0, a1] = r.body.attempt.answers;
  assert.equal(a0.t, 6, 'decision time only');
  assert.equal(a0.rt, 15);
  assert.equal(a1.rt, undefined, 'rt 0 is not stored');
  const text = fs.readFileSync(path.join(sb.home, r.body.attempt.file), 'utf8');
  assert.match(text, new RegExp(`q: ${a0.q}, .*t: 6, .*rt: 15`));
  const detail = (await api.get<{ attempt: Attempt }>(`/api/results/${encodeURIComponent(r.body.attempt.id)}`)).body.attempt;
  assert.equal(detail.answers[0].rt, 15, 'read back from the file');
  assert.equal(detail.answers[0].t, 6);
});

// ── the browser outbox (web/lib/session.ts) ─────────────────────────────────

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

test('outbox: no answer → stays queued with the same request; sent once when the server is back; second copy deduplicated', T, async () => {
  const storage = new MemoryStorage();
  const realFetch = globalThis.fetch;
  let base = `http://127.0.0.1:${await freePort()}`; // nothing listens: like a dropped Wi-Fi / restarting server
  Object.assign(globalThis, { localStorage: storage });
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => realFetch(typeof url === 'string' && url.startsWith('/') ? base + url : url, init)) as typeof fetch;
  try {
    const outbox = await import('../../web/lib/session.ts');
    const { session, questions } = await buildTest(api, { mode: 'quick', feedback: 'practice' });
    const active = outbox.startActive(session, questions);
    const t = { ...active, answers: Object.fromEntries(questions.map((q) => [q.id, q.answer])), spent: Object.fromEntries(questions.map((q) => [q.id, 20])), read: { [questions[0].id]: 12.4 } };
    const finishedAt = Date.now() - 5 * 60_000;
    const req = outbox.buildSubmitRequest(t, false, finishedAt);
    assert.equal(req.finishedAt, new Date(finishedAt).toISOString());
    assert.equal(req.answers[0].rt, 12, 'reading time rounded into rt');
    assert.equal(req.answers[1].rt, undefined);
    outbox.queueSubmit(req);
    outbox.clearActive();

    const down = await outbox.sendQueued(session.sessionId);
    assert.ok('error' in down && down.retryable, `network failure is retryable: ${JSON.stringify(down)}`);
    let q = outbox.loadOutbox();
    assert.equal(q.length, 1, 'still waiting ("⏳ chờ nộp")');
    assert.equal(q[0].tries, 1);
    assert.match(q[0].error ?? '', /kết nối/);
    assert.equal(q[0].req.finishedAt, req.finishedAt, 'the request is kept as it was');
    assert.equal((await outbox.flushOutbox()).length, 0, 'automatic flush: still down');

    // a second tab queued the same submit too (storage shared) — after the reconnect both copies may go out
    const copy = JSON.parse(JSON.stringify(outbox.loadOutbox()[0].req)) as SubmitRequest;

    base = srv.base; // the server answers again
    const sent = await outbox.flushOutbox();
    assert.equal(sent.length, 1);
    assert.equal(outbox.loadOutbox().length, 0, 'outbox empty');
    const attempt = sent[0].attempt;
    assert.equal(attempt.sessionId, session.sessionId);
    assert.equal(attempt.answers[0].rt, 12);
    const stored = (await api.get<{ attempt: Attempt }>(`/api/results/${encodeURIComponent(attempt.id)}`)).body.attempt;
    assert.equal(Date.parse(stored.finished), Math.floor(finishedAt / 1000) * 1000, 'finishedAt of the first try, not of the retry');

    outbox.queueSubmit(copy);
    const dup = await outbox.flushOutbox();
    assert.equal(dup.length, 1);
    assert.equal(dup[0].attempt.id, attempt.id, 'the server returned the stored attempt');
    q = outbox.loadOutbox();
    assert.equal(q.length, 0);
    const same = (await api.get<Attempt[]>('/api/results')).body.filter((a) => a.sessionId === session.sessionId);
    assert.equal(same.length, 1, 'one attempt for the session');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('outbox: a refused submit (4xx) is marked permanent — automatic flushes leave it, an explicit retry sends it', T, async () => {
  const storage = new MemoryStorage();
  const realFetch = globalThis.fetch;
  Object.assign(globalThis, { localStorage: storage });
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => realFetch(typeof url === 'string' && url.startsWith('/') ? srv.base + url : url, init)) as typeof fetch;
  try {
    const outbox = await import('../../web/lib/session.ts');
    const { session } = await buildTest(api, { mode: 'quick' });
    const broken: SubmitRequest = { session: { ...session, questions: [] }, answers: [], startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), timedOut: false, timeUsed: 0 };
    outbox.queueSubmit(broken);
    const r = await outbox.sendQueued(session.sessionId);
    assert.ok('error' in r && !r.retryable, 'HTTP 400 is not retryable');
    assert.equal(outbox.loadOutbox()[0].permanent, true);
    assert.deepEqual(await outbox.flushOutbox(), [], 'automatic flush skips it');
    assert.equal(outbox.loadOutbox()[0].tries, 1);
    await outbox.flushOutbox({ explicit: true });
    assert.equal(outbox.loadOutbox()[0].tries, 2, '"Thử nộp lại ngay" tries again');
    outbox.dropFromOutbox(session.sessionId);
    assert.equal(outbox.loadOutbox().length, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('outbox: storage full / disabled → the entry lives in this tab’s memory and is still sent (once)', T, async () => {
  const realFetch = globalThis.fetch;
  const store = new Map<string, string>();
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (k === 'trainer.outbox.v1') throw new DOMException('quota', 'QuotaExceededError');
        store.set(k, v);
      },
      removeItem: (k: string) => store.delete(k),
    },
  });
  let posts = 0;
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    if (url === '/api/results' && init?.method === 'POST') posts++; // the outbox's submits (not the test helpers' calls)
    return realFetch(typeof url === 'string' && url.startsWith('/') ? srv.base + url : url, init);
  }) as typeof fetch;
  try {
    const outbox = await import('../../web/lib/session.ts');
    const { session, questions } = await buildTest(api, { mode: 'quick' });
    const t = { ...outbox.startActive(session, questions), answers: Object.fromEntries(questions.map((q) => [q.id, q.answer])), spent: Object.fromEntries(questions.map((q) => [q.id, 25])) };
    outbox.queueSubmit(outbox.buildSubmitRequest(t, false));
    assert.equal(outbox.loadOutbox().filter((e) => e.req.session.sessionId === session.sessionId).length, 1, 'kept in memory');
    const r = await outbox.sendQueued(session.sessionId);
    assert.ok('attempt' in r, JSON.stringify(r));
    assert.equal(posts, 1, 'POSTed once');
    assert.equal(r.attempt.sessionId, session.sessionId);
    assert.equal(outbox.loadOutbox().filter((e) => e.req.session.sessionId === session.sessionId).length, 0, 'removed after the server confirmed');
  } finally {
    globalThis.fetch = realFetch;
  }
});
