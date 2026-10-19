// Anki export end-to-end: TSV download, scope counts against the learner's state, AnkiConnect push through a fake
// add-on (sandbox config.yaml export.ankiconnect_url), error handling, and the same export from a LAN device that has
// the access code. Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { seedHistory } from '../helpers/learner.ts';
import { startFakeAnki, type FakeAnki } from '../helpers/fake-anki.ts';
import { acceptsGzip } from '../../server/http.ts';
import type { AnkiExportRequest, AnkiPreview, AnkiPushResult, AnkiStatus, Question, QuestionState } from '../../shared/types.ts';

const T = { timeout: 120_000 };
const IP = Object.values(os.networkInterfaces())
  .flat()
  .find((a) => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))?.address;

let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;
let anki: FakeAnki;
let active: Question[] = [];
let states: Record<string, QuestionState> = {};

before(
  async () => {
    anki = await startFakeAnki();
    sb = makeSandbox();
    const cfgFile = path.join(sb.home, 'config.yaml');
    const cfg = fs.readFileSync(cfgFile, 'utf8');
    assert.match(cfg, /ankiconnect_url: "[^"]*"/);
    fs.writeFileSync(cfgFile, cfg.replace(/ankiconnect_url: "[^"]*"/, `ankiconnect_url: "${anki.url}"`));
    srv = await startServer({ home: sb.home, env: { LAN: '1' } });
    api = apiClient(srv.base);
    await seedHistory(api);
    active = (await api.get<{ questions: Question[] }>('/api/bank')).body.questions.filter((q) => q.status === 'active');
    states = (await api.get<{ states: Record<string, QuestionState> }>('/api/state')).body.states;
  },
  { timeout: 180_000 },
);

after(async () => {
  await srv?.stop();
  await anki?.close().catch(() => undefined);
  sb?.cleanup();
});

const exportFile = (body: AnkiExportRequest) =>
  fetch(`${srv.base}/api/export/anki`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Trainer': '1' }, body: JSON.stringify(body) });
const preview = async (body: AnkiExportRequest) => {
  const r = await api.post<AnkiPreview>('/api/export/anki?preview=1', body);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
};

test('downloads a TSV file for Anki: headers, one row per active question, attachment name', T, async () => {
  const r = await exportFile({ scope: 'all' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'text/plain; charset=utf-8');
  const date = new Date();
  const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  assert.match(r.headers.get('content-disposition') ?? '', new RegExp(`^attachment; filename="anki-saa-c03-all-${ymd}\\.txt"`));
  assert.equal(r.headers.get('content-encoding'), 'gzip', 'large file compressed');
  const text = await r.text();
  const lines = text.trimEnd().split('\n');
  assert.deepEqual(lines.slice(0, 6), ['#separator:tab', '#html:true', '#notetype:Basic', '#deck:AWS SAA-C03', '#guid column:1', '#tags column:4']);
  const rows = lines.slice(6);
  assert.equal(rows.length, active.length);
  assert.deepEqual(
    rows.map((l) => l.split('\t')[0]),
    active.map((q) => `saa-c03:${q.id}`),
    'bank order, GUID per question',
  );
  assert.ok(rows.every((l) => l.split('\t').length === 4));
  const again = await (await exportFile({ scope: 'all' })).text();
  assert.equal(again, text, 'same data → identical file (re-import updates, never duplicates)');
});

test('gzip only when Accept-Encoding allows it (q-values honoured)', T, async () => {
  const post = (ae: string) =>
    new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port: srv.port, path: '/api/export/anki', method: 'POST', agent: false, headers: { 'Content-Type': 'application/json', 'X-Trainer': '1', 'Accept-Encoding': ae } },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res));
        },
      );
      req.on('error', reject);
      req.end('{"scope":"all"}');
    });
  const cases: [string, boolean][] = [
    ['gzip', true],
    ['gzip;q=0', false],
    ['br, gzip; q=0.5', true],
    ['br;q=1, gzip;q=0', false],
    ['identity', false],
    ['*', true],
    ['*;q=0', false],
    ['', false],
  ];
  for (const [ae, gz] of cases) {
    assert.equal(acceptsGzip(ae), gz, `acceptsGzip(${JSON.stringify(ae)})`);
    assert.equal((await post(ae)).headers['content-encoding'] === 'gzip', gz, `download with Accept-Encoding: ${JSON.stringify(ae)}`);
  }
});

test('preview counts match the learner state for every scope', T, async () => {
  const now = Date.now();
  const expect = {
    wrong: active.filter((q) => states[q.id]?.lastOk === false).length,
    everWrong: active.filter((q) => states[q.id]?.everWrong).length,
    due: active.filter((q) => states[q.id]?.dueAt && new Date(states[q.id].dueAt!).getTime() <= now).length,
    flagged: active.filter((q) => states[q.id]?.lastFlag || states[q.id]?.lastUnsure).length,
    secure: active.filter((q) => q.domain === 'secure').length,
  };
  assert.ok(expect.wrong > 0, 'seeded history has wrong answers');
  assert.equal((await preview({ scope: 'all' })).count, active.length);
  assert.equal((await preview({ scope: 'wrong' })).count, expect.wrong);
  assert.equal((await preview({ scope: 'wrong', everWrong: true })).count, expect.everWrong);
  assert.equal((await preview({ scope: 'due' })).count, expect.due);
  assert.equal((await preview({ scope: 'flagged' })).count, expect.flagged);
  assert.equal((await preview({ scope: 'filter', filters: { domains: ['secure'] } })).count, expect.secure);
  const wrongSecure = active.filter((q) => q.domain === 'secure' && states[q.id]?.lastOk === false).length;
  assert.equal((await preview({ scope: 'wrong', filters: { domains: ['secure'] } })).count, wrongSecure);

  const ids = await preview({ scope: 'ids', ids: [active[3].id, 'no-such-question', active[1].id], deck: 'Ôn  tập::SAA', includeExplanation: false });
  assert.deepEqual({ count: ids.count, missing: ids.missing, deck: ids.deck }, { count: 2, missing: ['no-such-question'], deck: 'Ôn  tập::SAA' });
  assert.equal(ids.sample?.id, active[3].id, 'first requested id');
  assert.ok(ids.sample?.front.includes(`<b>A.</b>`));
  assert.ok(ids.sample?.tags.includes(`SAA-C03::id::${active[3].id}`));
});

test('malformed requests → 400, empty selections → 422 (preview → 0)', T, async () => {
  assert.equal((await api.post('/api/export/anki', { scope: 'everything' })).status, 400);
  assert.equal((await api.post('/api/export/anki', { scope: 'ids' })).status, 400);
  assert.equal((await api.post('/api/export/anki', {})).status, 400);
  const odd = await api.post<AnkiPreview>('/api/export/anki?preview=1', { scope: 'filter', filters: { search: 42, domains: 'secure', topics: [7, 'database'] } });
  assert.equal(odd.status, 200, 'malformed filter fields are ignored, not a 500');
  assert.equal(odd.body.count, active.filter((q) => q.topic === 'database').length);
  const none: AnkiExportRequest = { scope: 'filter', filters: { search: 'zz-no-question-has-this-zz' } };
  assert.equal((await preview(none)).count, 0);
  assert.equal((await exportFile(none)).status, 422);
  assert.equal((await api.post('/api/export/anki?push=1', none)).status, 422);
  const noHeader = await fetch(`${srv.base}/api/export/anki`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"scope":"all"}' });
  assert.equal(noHeader.status, 403, 'X-Trainer required');
});

test('AnkiConnect: status, push adds notes, a second push updates them in place', T, async () => {
  const st = (await api.get<AnkiStatus>('/api/export/anki/status')).body;
  assert.deepEqual({ available: st.available, url: st.url, deck: st.deck }, { available: true, url: anki.url, deck: 'AWS SAA-C03' });
  assert.ok(st.models?.includes('Basic'));

  const req: AnkiExportRequest = { scope: 'wrong', deck: 'SAA-C03::Câu sai' };
  const n = (await preview(req)).count;
  const first = (await api.post<AnkiPushResult>('/api/export/anki?push=1', req)).body;
  assert.deepEqual({ ok: first.ok, total: first.total, added: first.added, updated: first.updated, deck: first.deck }, { ok: true, total: n, added: n, updated: 0, deck: 'SAA-C03::Câu sai' });
  assert.ok(anki.decks.has('SAA-C03::Câu sai'));
  assert.equal(anki.notes.length, n);
  const second = (await api.post<AnkiPushResult>('/api/export/anki?push=1', { ...req, includeExplanation: false })).body;
  assert.deepEqual({ ok: second.ok, added: second.added, updated: second.updated }, { ok: true, added: 0, updated: n });
  assert.equal(anki.notes.length, n, 'no duplicates');
});

test('Anki not running: status and push answer 200 with ok:false and the add-on hint', T, async () => {
  await anki.close();
  const st = (await api.get<AnkiStatus>('/api/export/anki/status')).body;
  assert.equal(st.available, false);
  assert.match(st.hint ?? '', /2055492159/);
  const r = await api.post<AnkiPushResult>('/api/export/anki?push=1', { scope: 'wrong' });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, false);
  assert.match(r.body.errors[0], /Không kết nối được AnkiConnect/);
  assert.match(r.body.hint ?? '', /2055492159/);
});

test('a LAN device exports with the access code, and only with it', { ...T, skip: IP ? false : 'no LAN IPv4' }, async () => {
  const request = (headers: Record<string, string>, p = '/api/export/anki', body = '{"scope":"wrong"}') =>
    new Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
      const req = http.request(
        { host: IP, port: srv.port, path: p, method: 'POST', agent: false, headers: { Host: `${IP}:${srv.port}`, 'Content-Type': 'application/json', 'X-Trainer': '1', ...headers } },
        (res) => {
          let b = '';
          res.setEncoding('utf8');
          res.on('data', (c) => (b += c));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: b, headers: res.headers }));
        },
      );
      req.on('error', reject);
      req.end(body);
    });
  assert.equal((await request({})).status, 401);
  const tok = fs.readFileSync(path.join(sb.home, '.local', 'lan-token'), 'utf8').trim();
  const landing = await new Promise<http.IncomingMessage>((resolve, reject) => {
    http.get({ host: IP, port: srv.port, path: `/?t=${tok}`, agent: false, headers: { Host: `${IP}:${srv.port}` } }, resolve).on('error', reject);
  });
  landing.resume();
  const cookie = String(landing.headers['set-cookie']?.[0]).split(';')[0];
  const ok = await request({ Cookie: cookie });
  assert.equal(ok.status, 200);
  assert.match(ok.headers['content-disposition'] ?? '', /anki-saa-c03-wrong-/);
  assert.ok(ok.body.startsWith('#separator:tab\n'));
  assert.equal(ok.body.trimEnd().split('\n').length - 6, (await preview({ scope: 'wrong' })).count);
});
