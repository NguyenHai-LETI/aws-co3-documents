// [v5 ρ] Resume on another device: GET / PUT / DELETE /api/active against the real server on a sandbox — the unfinished
// test mirrored in .local/active.json (never synced), last writer wins by updatedAt, removed by a submit of its session,
// and the browser side (web/lib/session.ts mirroring, driven in Node with a localStorage stand-in). Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { buildTest } from '../helpers/learner.ts';
import type { Attempt, Question, TestSession } from '../../shared/types.ts';

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

interface Mirror {
  updatedAt: string;
  device?: string;
  deviceId?: string;
  test: { session: TestSession; questions: Question[]; answers: Record<string, string[]>; current?: number };
}

const file = () => path.join(sb.home, '.local', 'active.json');

/** PUT / DELETE (the shared test client has GET / POST only). */
async function call<T>(method: string, p: string, body?: unknown): Promise<{ status: number; body: T }> {
  const r = await fetch(srv.base + p, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Trainer': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await r.text();
  return { status: r.status, body: (text ? JSON.parse(text) : undefined) as T };
}
const put = (body: unknown) => call<{ saved: boolean; active: { updatedAt: string; sessionId: string; title: string; device?: string } }>('PUT', '/api/active', body);
const del = (q = '') => call<{ removed: boolean }>('DELETE', `/api/active${q}`);
const get = () => api.get<{ active: Mirror | null }>('/api/active');

async function activeTest(answered = 0) {
  const { session, questions } = await buildTest(api, { mode: 'quick', feedback: 'practice' });
  const answers = Object.fromEntries(questions.slice(0, answered).map((q) => [q.id, q.answer]));
  return { session, questions, answers, current: answered, startedAt: Date.now() - 60_000, pausedTotal: 0 };
}

test('PUT stores the test with a server-stamped version; one device orders its own writes; DELETE needs the same session', T, async () => {
  assert.deepEqual((await get()).body, { active: null }, 'nothing mirrored yet');
  const desk = await activeTest(2);
  const before = Date.now();
  // a client clock an hour ahead (or behind) changes nothing: the version is the server's
  const r1 = await put({ updatedAt: new Date(Date.now() + 3_600_000).toISOString(), changedAt: 1000, device: '💻 máy tính', deviceId: 'desk-1', test: desk });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.equal(r1.body.saved, true);
  assert.equal(r1.body.active.sessionId, desk.session.sessionId);
  const v1 = Date.parse(r1.body.active.updatedAt);
  assert.ok(v1 >= before - 5 && v1 <= Date.now() + 5, 'stamped with the server clock');
  assert.ok(fs.existsSync(file()), '.local/active.json written');
  const g = (await get()).body.active!;
  assert.equal(g.updatedAt, r1.body.active.updatedAt);
  assert.equal(g.device, '💻 máy tính');
  assert.equal(g.deviceId, 'desk-1');
  assert.deepEqual(Object.keys(g.test.answers).length, 2);

  // the same device: a later change is stored with a newer version; an earlier change arriving late is refused
  const r2 = await put({ changedAt: 2000, deviceId: 'desk-1', test: { ...desk, current: 2 } });
  assert.equal(r2.body.saved, true);
  assert.ok(Date.parse(r2.body.active.updatedAt) > v1, 'versions strictly increase');
  const late = await put({ changedAt: 1500, deviceId: 'desk-1', test: desk });
  assert.equal(late.status, 200, 'a stale write is not an error (no red console)');
  assert.deepEqual([late.body.saved, (late.body as { refused?: string }).refused], [false, 'older']);
  assert.equal((await get()).body.active!.test.current, 2, 'the later change is kept');

  // DELETE of another session leaves it; DELETE of its session removes it
  assert.equal((await del('?session=someone-else')).body.removed, false);
  assert.ok((await get()).body.active);
  assert.equal((await del(`?session=${encodeURIComponent(desk.session.sessionId)}`)).body.removed, true);
  assert.deepEqual((await get()).body, { active: null });
  assert.equal(fs.existsSync(file()), false);
});

test('another device writes the same test only from the stored version (base); its clock does not matter; ?info=1 is light', T, async () => {
  const t = await activeTest(1);
  const v1 = (await put({ changedAt: Date.now(), deviceId: 'desk', device: '💻 máy tính', test: t })).body.active.updatedAt;
  // the phone took it over (base = v1). Its clock runs 60 s behind: still stored
  const phone = { ...t, answers: { ...t.answers, [t.questions[1].id]: t.questions[1].answer, [t.questions[2].id]: t.questions[2].answer } };
  const p1 = await put({ updatedAt: new Date(Date.now() - 60_000).toISOString(), changedAt: Date.now() - 60_000, base: v1, deviceId: 'phone', device: '📱 điện thoại', test: phone });
  assert.deepEqual([p1.body.saved, (p1.body as { refused?: string }).refused], [true, undefined], 'a slow clock is not "older"');
  const v2 = p1.body.active.updatedAt;
  // without a base, or from a stale one, the desktop cannot overwrite the phone's progress: refused as a conflict
  for (const base of [undefined, v1]) {
    const stale = await put({ changedAt: Date.now() + 120_000, base, deviceId: 'desk', device: '💻 máy tính', test: { ...t, current: 1 } });
    assert.equal(stale.status, 200);
    assert.deepEqual([stale.body.saved, (stale.body as { refused?: string }).refused, stale.body.active.device], [false, 'conflict', '📱 điện thoại']);
  }
  const info = (await api.get<{ active: { sessionId: string; answered: number; total: number; mode: string; device: string; updatedAt: string } }>('/api/active?info=1')).body.active;
  assert.deepEqual([info.sessionId, info.answered, info.total, info.mode, info.device, info.updatedAt], [t.session.sessionId, 3, t.questions.length, 'quick', '📱 điện thoại', v2]);
  assert.equal((info as unknown as { test?: unknown }).test, undefined, 'no test in the info answer');
  // "Giữ bản trên máy này": the desktop now bases its write on v2 → accepted
  const keep = await put({ changedAt: Date.now(), base: v2, deviceId: 'desk', test: { ...t, current: 1 } });
  assert.equal(keep.body.saved, true);
  // another test (from any device) replaces the mirror: the latest test touched is the one offered elsewhere
  const other = await activeTest(0);
  assert.equal((await put({ changedAt: 1, deviceId: 'phone', test: other })).body.saved, true);
  assert.equal((await get()).body.active?.test.session.sessionId, other.session.sessionId);
  // ?session= tells a device that its test was finished elsewhere
  const answers = t.questions.map((q) => ({ q: q.id, pick: q.answer, t: 20 }));
  const sub = await api.post<{ attempt: Attempt }>('/api/results', { session: t.session, answers, startedAt: new Date(Date.now() - 300_000).toISOString(), finishedAt: new Date().toISOString(), timedOut: false, timeUsed: 200 });
  const after = (await api.get<{ active: unknown; submitted?: string }>(`/api/active?info=1&session=${encodeURIComponent(t.session.sessionId)}`)).body;
  assert.deepEqual(after, { active: (await api.get<{ active: unknown }>('/api/active?info=1')).body.active, submitted: sub.body.attempt.id });
  await del();
});

test('PUT refuses a body that is not an unfinished test (400); a broken file reads as nothing', T, async () => {
  assert.equal((await put({ updatedAt: new Date().toISOString(), test: { hello: 1 } })).status, 400);
  assert.equal((await put({})).status, 400);
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), '{ not json');
  assert.deepEqual((await get()).body, { active: null });
  fs.rmSync(file());
});

test('a submit removes the mirror of its session (also a duplicate submit); a mirror of an already submitted session is dropped', T, async () => {
  const t = await activeTest(1);
  assert.equal((await put({ updatedAt: new Date().toISOString(), deviceId: 'd', test: t })).body.saved, true);
  const answers = t.questions.map((q) => ({ q: q.id, pick: q.answer, t: 30 }));
  const req = { session: t.session, answers, startedAt: new Date(Date.now() - 400_000).toISOString(), finishedAt: new Date().toISOString(), timedOut: false, timeUsed: 300 };
  const r = await api.post<{ attempt: Attempt }>('/api/results', req);
  assert.equal(r.status, 200);
  assert.deepEqual((await get()).body, { active: null }, 'cleared by the submit');

  // the other device still mirrors the finished test (its PUT raced the submit): refused, nothing stored again
  const late = await put({ changedAt: Date.now(), deviceId: 'phone', test: t });
  assert.equal(late.status, 200);
  assert.deepEqual([late.body.saved, (late.body as { refused?: string }).refused, late.body.active], [false, 'submitted', null]);
  assert.deepEqual((await get()).body, { active: null });
  assert.equal(fs.existsSync(file()), false);

  // another session's mirror survives a submit
  const other = await activeTest(0);
  await put({ updatedAt: new Date().toISOString(), deviceId: 'd', test: other });
  const dup = await api.post<{ duplicate?: boolean }>('/api/results', req);
  assert.equal(dup.body.duplicate, true);
  assert.equal((await get()).body.active?.test.session.sessionId, other.session.sessionId);
  await del();
});

// ── the browser side (web/lib/session.ts), two devices = two localStorage stand-ins in one process ──

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
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)); // api.get shares identical GETs for 40 ms

test('client mirror: desktop → phone takes over (paused) → desktop picks up the newer progress → a stale copy must choose → submitted elsewhere', T, async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => realFetch(typeof url === 'string' && url.startsWith('/') ? srv.base + url : url, init)) as typeof fetch;
  const desk = new MemoryStorage();
  const phone = new MemoryStorage();
  const use = (s: MemoryStorage) => Object.assign(globalThis, { localStorage: s });
  const s = await import('../../web/lib/session.ts');
  s.configureMirror({ enabled: true, delayMs: 60_000 }); // sent explicitly with flushMirror()
  const refused: string[] = [];
  const off = s.onMirrorRefused((r) => refused.push(r.refused ?? '?'));
  try {
    const { session, questions } = await buildTest(api, { mode: 'quick', feedback: 'practice' });
    use(desk);
    s.startActive(session, questions);
    assert.equal((await s.flushMirror())?.saved, true, 'desktop mirrored');

    await sleep(60);
    use(phone);
    assert.equal(s.loadActive(), undefined, 'the phone has nothing of its own');
    const info = (await s.fetchMirrorInfo()).active!;
    assert.equal(info.sessionId, session.sessionId);
    const remote = (await s.fetchMirror())!;
    const taken = s.adoptMirror(remote);
    assert.ok(taken.pausedAt && taken.pausedAt <= Date.now(), 'arrives paused: the time between devices is not study time');
    assert.equal((await s.flushMirror())?.saved, true, 'the phone is the writer now');
    s.saveActive({ ...s.loadActive()!, answers: { [questions[0].id]: questions[0].answer } });
    assert.equal((await s.flushMirror())?.saved, true);

    await sleep(60);
    use(desk);
    const check = await s.checkRemote(s.loadActive()!);
    assert.equal(check.kind, 'adopt', 'nothing new on the desktop: take the phone’s progress');
    if (check.kind !== 'adopt') return;
    const back = s.adoptMirror(check.remote);
    assert.deepEqual(back.answers[questions[0].id], questions[0].answer);
    assert.equal((await s.flushMirror())?.saved, true);

    // the phone's tab is stale now; the learner answers there anyway → refused, then asked
    await sleep(60);
    use(phone);
    s.saveActive({ ...s.loadActive()!, answers: { [questions[1].id]: questions[1].answer } });
    const stale = await s.flushMirror();
    assert.deepEqual([stale?.saved, stale?.refused], [false, 'conflict']);
    assert.deepEqual(refused, ['conflict'], 'the runner hears about it');
    const again = await s.checkRemote(s.loadActive()!);
    assert.equal(again.kind, 'conflict');
    if (again.kind !== 'conflict') return;
    s.keepLocalOver(again.remote, s.loadActive()!); // "Giữ bản trên máy này"
    assert.equal((await s.flushMirror())?.saved, true);

    // submitted from the phone: the desktop learns it on its next check
    const req = s.buildSubmitRequest(s.loadActive()!, false);
    assert.equal((await api.post('/api/results', req)).status, 200);
    await sleep(60);
    use(desk);
    const done = await s.checkRemote(s.loadActive()!);
    assert.equal(done.kind, 'submitted');
    assert.deepEqual((await get()).body, { active: null });
  } finally {
    off();
    s.configureMirror({ enabled: false });
    globalThis.fetch = realFetch;
  }
});
