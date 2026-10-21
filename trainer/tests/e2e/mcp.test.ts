// [v5] π MCP server (scripts/mcp-server.ts) over real stdio against a sandbox app: legacy `initialize` and modern
// (2026-07-28, stateless `_meta` + server/discover) protocol paths, JSON-RPC errors, and a whole chat quiz — the answer
// key never appears before `answer`, `finish` stores the attempt with source chat. Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { apiClient, freePort, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { TRAINER_ROOT } from '../helpers/paths.ts';
import type { Question } from '../../shared/types.ts';

const T = { timeout: 120_000 };
const MODERN = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {}, 'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1' } };
let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;

interface Client {
  proc: ChildProcess;
  send(msg: unknown): void;
  request(method: string, params?: Record<string, unknown>): Promise<any>;
  raw(line: string): Promise<any>;
  lines: unknown[];
  stop(): Promise<void>;
}

function mcp(port: number): Client {
  const proc = spawn(process.execPath, [path.join(TRAINER_ROOT, 'scripts', 'mcp-server.ts')], { env: { ...process.env, TRAINER_PORT: String(port) }, stdio: ['pipe', 'pipe', 'pipe'] });
  const lines: any[] = [];
  const waiters: ((m: any) => void)[] = [];
  readline.createInterface({ input: proc.stdout! }).on('line', (l) => {
    const m = JSON.parse(l); // every stdout line must be one JSON-RPC message
    lines.push(m);
    for (const w of waiters.splice(0)) w(m);
  });
  let next = 1;
  const wait = (match: (m: any) => boolean) =>
    new Promise<any>((resolve, reject) => {
      const hit = lines.find(match);
      if (hit) return resolve(hit);
      const timer = setTimeout(() => reject(new Error('no answer from the MCP server')), 60_000);
      const check = (m: any) => {
        if (match(m)) {
          clearTimeout(timer);
          resolve(m);
        } else waiters.push(check);
      };
      waiters.push(check);
    });
  const send = (msg: unknown) => proc.stdin!.write(JSON.stringify(msg) + '\n');
  return {
    proc,
    send,
    lines,
    request: (method, params) => {
      const id = next++;
      send({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
      return wait((m) => m.id === id);
    },
    raw: (line) => {
      const from = lines.length;
      proc.stdin!.write(line + '\n');
      return wait((m) => m.id === null && lines.indexOf(m) >= from);
    },
    stop: () =>
      new Promise((r) => {
        proc.once('exit', () => r());
        proc.stdin!.end(); // EOF = shutdown
      }),
  };
}

before(async () => {
  sb = makeSandbox();
  srv = await startServer({ home: sb.home });
  api = apiClient(srv.base);
}, T);

after(async () => {
  await srv?.stop();
  sb?.cleanup();
});

test('legacy handshake: initialize negotiates the version, notifications get no answer, tools/list, ping', T, async () => {
  const c = mcp(srv.port);
  try {
    const init = await c.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    assert.equal(init.result.protocolVersion, '2025-06-18');
    assert.deepEqual(init.result.capabilities, { tools: { listChanged: false } });
    assert.equal(init.result.serverInfo.name, 'saa-trainer');
    assert.match(init.result.instructions, /Never guess/);
    const newer = await c.request('initialize', { protocolVersion: '2099-01-01', capabilities: {} });
    assert.equal(newer.result.protocolVersion, '2025-11-25', 'unknown → our latest legacy version');
    const before = c.lines.length;
    c.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    const list = await c.request('tools/list');
    assert.equal(c.lines.length, before + 1, 'no response to the notification');
    assert.deepEqual(list.result.tools.map((t: { name: string }) => t.name), ['start_quiz', 'next_question', 'answer', 'finish', 'weak_areas', 'search_notes', 'report_issue']);
    assert.equal(list.result.resultType, undefined, 'legacy results carry no resultType');
    for (const t of list.result.tools) assert.equal(t.inputSchema.type, 'object');
    assert.deepEqual((await c.request('ping')).result, {});
  } finally {
    await c.stop();
  }
});

test('modern (2026-07-28): server/discover, per-request _meta, resultType, version and metadata errors', T, async () => {
  const c = mcp(srv.port);
  try {
    const d = await c.request('server/discover', { _meta: MODERN });
    assert.equal(d.result.resultType, 'complete');
    assert.ok(d.result.supportedVersions.includes('2026-07-28') && d.result.supportedVersions.includes('2025-11-25'));
    assert.deepEqual(d.result.capabilities, { tools: { listChanged: false } });
    assert.equal(d.result._meta['io.modelcontextprotocol/serverInfo'].name, 'saa-trainer');
    const list = await c.request('tools/list', { _meta: MODERN });
    assert.equal(list.result.resultType, 'complete');
    assert.equal(list.result.tools.length, 7);
    const bad = await c.request('tools/list', { _meta: { ...MODERN, 'io.modelcontextprotocol/protocolVersion': '1900-01-01' } });
    assert.equal(bad.error.code, -32022);
    assert.deepEqual(bad.error.data, { supported: ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'], requested: '1900-01-01' });
    const noCaps = await c.request('tools/list', { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } });
    assert.equal(noCaps.error.code, -32602, 'clientCapabilities is required');
    const noVersion = await c.request('server/discover', {});
    assert.equal(noVersion.error.code, -32602);
    assert.equal((await c.request('nope/method', { _meta: MODERN })).error.code, -32601);
    assert.equal((await c.request('tools/call', { _meta: MODERN, name: 'nope', arguments: {} })).error.code, -32602);
    assert.equal((await c.raw('{not json')).error.code, -32700);
    assert.equal((await c.raw('[]')).error.code, -32600, '[R3] an empty batch is an invalid request');
  } finally {
    await c.stop();
  }
});

test('a chat quiz: start → next (no key) → answer (key + explanation) → finish = an attempt with source chat', T, async () => {
  const bank = new Map(((await api.get<{ questions: Question[] }>('/api/bank')).body.questions).map((q) => [q.id, q]));
  const c = mcp(srv.port);
  const call = async (name: string, args: Record<string, unknown> = {}) => (await c.request('tools/call', { _meta: MODERN, name, arguments: args })).result;
  try {
    const start = await call('start_quiz', { mode: 'quick', n: 3 });
    assert.equal(start.isError, undefined, start.content[0].text);
    const quiz = start.structuredContent.quiz;
    assert.match(quiz, /^quiz-[0-9a-f]{8}$/);
    assert.equal(start.structuredContent.count, 3);

    const q1 = await call('next_question', { quiz });
    const qa = bank.get(q1.structuredContent.id)!;
    const text = q1.content[0].text as string;
    assert.ok(text.startsWith('Câu 1/3'));
    assert.ok(!text.includes(qa.explanation.slice(0, 30)) && !JSON.stringify(q1).includes('"answer"'), 'no key, no explanation');
    const labelOf = (q: Question, opts: { label: string; text: string }[], key: string) => opts.find((o) => q.options.find((x) => x.key === key)!.text.startsWith(o.text.slice(0, 20)))!.label;
    const right = qa.answer.map((k) => labelOf(qa, q1.structuredContent.options, k));
    if (qa.answer.length === 1) {
      const tooMany = await call('answer', { quiz, pick: 'A,B' });
      assert.equal(tooMany.isError, true);
      assert.match(tooMany.content[0].text, /cần chọn đúng 1/);
    }
    const a1 = await call('answer', { quiz, pick: right.join(','), unsure: true });
    assert.equal(a1.structuredContent.correct, true);
    assert.match(a1.content[0].text, /^✅ Đúng/);
    assert.ok(a1.content[0].text.length > 40, 'short explanation');
    assert.equal((await call('answer', { quiz, pick: 'A' })).isError, true, 'no current question until next_question');

    const q2 = await call('next_question', {}); // default: the latest quiz
    const qb = bank.get(q2.structuredContent.id)!;
    const wrongKeys = qb.options.map((o) => o.key).filter((k) => !qb.answer.includes(k)).slice(0, qb.answer.length);
    const a2 = await call('answer', { pick: wrongKeys.map((k) => labelOf(qb, q2.structuredContent.options, k)).join('') });
    assert.equal(a2.structuredContent.correct, false);
    assert.match(a2.content[0].text, /^❌ Sai/);

    await call('next_question', { quiz }); // viewed, never answered
    const fin = await call('finish', { quiz });
    assert.equal(fin.isError, undefined, fin.content[0].text);
    assert.match(fin.content[0].text, /dừng sớm/);
    const id = fin.structuredContent.attempt;
    const res = (await api.get(`/api/results/${encodeURIComponent(id)}`)).body;
    assert.equal(res.attempt.source, 'chat');
    assert.ok(res.attempt.title.startsWith('💬'));
    const first = res.attempt.answers.find((r: { q: string }) => r.q === qa.id);
    assert.equal(first.ok, true);
    assert.equal(first.unsure, true);
    assert.equal((await call('next_question', { quiz })).isError, true, 'the quiz is closed after finish');
  } finally {
    await c.stop();
  }
});

test('weak_areas, search_notes, report_issue; a stopped app gives a clear message', T, async () => {
  const c = mcp(srv.port);
  const call = async (name: string, args: Record<string, unknown> = {}) => (await c.request('tools/call', { name, arguments: args })).result;
  try {
    const weak = await call('weak_areas');
    assert.match(weak.content[0].text, /Sẵn sàng ≈/);
    const found = await call('search_notes', { query: 'S3 Glacier' });
    assert.equal(found.isError, undefined);
    assert.ok(Array.isArray(found.structuredContent.hits));
    const q = [...((await api.get<{ questions: Question[] }>('/api/bank')).body.questions)].find((x) => x.status === 'active')!;
    const rep = await call('report_issue', { type: 'ambiguous', note: 'mcp test', qid: q.id });
    assert.equal(rep.isError, undefined, rep.content[0].text);
    assert.ok(fs.readFileSync(path.join(sb.home, 'bank', 'issues.md'), 'utf8').includes('mcp test'));
  } finally {
    await c.stop();
  }
  const dead = mcp(await freePort());
  try {
    await dead.request('initialize', { protocolVersion: '2025-11-25', capabilities: {} });
    const r = (await dead.request('tools/call', { name: 'start_quiz', arguments: { mode: 'quick' } })).result;
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /Trainer chưa chạy/);
  } finally {
    await dead.stop();
  }
});
