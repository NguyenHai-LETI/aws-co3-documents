// [v5] γ2 — content accuracy end to end (fake Claude CLI + a fake Ollama chat server): grounded fact-check runs (AWS-only
// tools, citations in bank/verify.md, GET /api/verify), the review queue and disputed count, citations in the ENRICH batch,
// the import audit (blind-solve + local vote + grounded check of the disputed ones), coach.verify.grounded: false.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { apiClient, makeSandbox, startServer } from '../helpers/server.ts';
import { TRAINER_ROOT } from '../helpers/paths.ts';
import type { CoachEvent, CoachRunInfo, CoachRunOutcome, VerifySummary, VerifyVerdict } from '../../shared/types.ts';

type Run = CoachRunInfo & { outcome?: CoachRunOutcome };
type VerifyApi = VerifySummary & { latest: Record<string, VerifyVerdict> };

const sb = makeSandbox({ git: true });
const home = sb.home;
const cfgFile = path.join(home, 'config.yaml');

function packKeys(file: string, n: number): { id: string; key: string }[] {
  return fs
    .readFileSync(path.join(home, 'bank', 'packs', 'imported', file), 'utf8')
    .split(/\n(?=## Q )/)
    .map((b) => ({ id: /^## Q (\S+)/.exec(b)?.[1] ?? '', key: /\*\*Answer:\*\*\s*([A-H](?:\s*,\s*[A-H])*)/.exec(b)?.[1]?.replace(/[\s,]/g, '') ?? '' }))
    .filter((q) => q.id && q.key.length === 1)
    .slice(0, n);
}
const [G1, G2] = packKeys('05-security-services-v1.md', 2);
const other = (key: string) => [...'ABCD'].find((k) => !key.includes(k))!;

// fake Ollama: always answers "A" with high confidence
let chats = 0;
const ollama = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    chats++;
    const ids = [...String((JSON.parse(raw) as { messages: { content: string }[] }).messages[0].content).matchAll(/^## \d+\. `([^`]+)`/gm)].map((m) => m[1]);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: { content: JSON.stringify({ results: ids.map((id) => ({ id, answer: ['A'], confidence: 'high', ambiguous: false, reason: 'local' })) }) } }));
  });
});
await new Promise<void>((r) => ollama.listen(0, '127.0.0.1', () => r()));
const ollamaUrl = `http://127.0.0.1:${(ollama.address() as { port: number }).port}`;

fs.writeFileSync(
  cfgFile,
  fs
    .readFileSync(cfgFile, 'utf8')
    .replace('before_ai: true', 'before_ai: false')
    .replace('after_ai: true', 'after_ai: false')
    .replace(/local_model: ""/, 'local_model: "qwen-fake"')
    .replace(/ollama_url: "[^"]*"/, `ollama_url: "${ollamaUrl}"`),
);
assert.match(fs.readFileSync(cfgFile, 'utf8'), /local_model: "qwen-fake"/);

const LOG = path.join(sb.root, 'fake-claude.log');
const ENV = {
  TRAINER_ALLOW_COACH: '1',
  CLAUDE_BIN: path.join(TRAINER_ROOT, 'tests/helpers/fake-claude.mjs'),
  FAKE_CLAUDE_LOG: LOG,
  FAKE_VERIFY: JSON.stringify({ [G1.id]: { answer: [other(G1.key)], confidence: 'high', reason: 'Model thứ hai chọn khác' } }),
  FAKE_GROUNDED: JSON.stringify({
    [G2.id]: { verdict: 'outdated', answer: [G2.key], reason: 'Tên dịch vụ đã đổi', citations: [{ url: 'https://aws.amazon.com/about-aws/whats-new/2025/08/fake/', quote: 'The service was renamed in 2025.' }] },
  }),
};
const server = await startServer({ home, repo: sb.repo, env: ENV });
const api = apiClient(server.base);
after(async () => {
  await server.stop();
  ollama.close();
  sb.cleanup();
});

interface Call {
  argv: string[];
}
const calls = (): Call[] => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Call) : []);
const flag = (c: Call, name: string) => (c.argv.includes(name) ? c.argv[c.argv.indexOf(name) + 1] : undefined);

async function waitRun(id: string): Promise<{ run: Run; log: string }> {
  const deadline = Date.now() + 90_000;
  for (;;) {
    const events = (await api.get<{ events: CoachEvent[] }>(`/api/coach/runs/${encodeURIComponent(id)}`)).body.events;
    if (events.some((e) => e.kind === 'end')) return { run: (await api.get<{ runs: Run[] }>('/api/coach')).body.runs.find((x) => x.id === id)!, log: events.map((e) => e.text).join('\n') };
    if (Date.now() > deadline) throw new Error(events.map((e) => e.text).join('\n'));
    await new Promise((res) => setTimeout(res, 150));
  }
}
async function verifyRun(body: Record<string, unknown>) {
  const r = await api.post<{ run: Run; error?: string }>('/api/verify/run', body);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return waitRun(r.body.run.id);
}
const ledger = () => fs.readFileSync(path.join(home, 'bank', 'verify.md'), 'utf8');

test('a blind-solve mismatch queues the question for the grounded check; the fact-check runs with AWS-only tools and stores citations', async () => {
  const blind = await verifyRun({ ids: [G1.id] });
  assert.equal(blind.run.outcome?.verify?.mismatch, 1, blind.log);
  let v = (await api.get<VerifyApi>('/api/verify')).body;
  assert.ok(v.groundedQueue?.includes(G1.id));
  assert.equal(v.groundedEnabled, true);
  assert.equal(v.disputed, 1);

  const start = calls().length;
  const g = await verifyRun({ scope: 'grounded' });
  assert.equal(g.run.status, 'success', g.log);
  assert.equal(g.run.params?.scope, 'grounded');
  assert.ok((g.run.params?.ids as string[]).includes(G1.id));
  assert.ok((g.run.outcome?.grounded?.checked ?? 0) >= 1);
  assert.match(g.log, /🔗 Kiểm chứng \d+ câu bằng tài liệu AWS/);
  const call = calls().slice(start)[0];
  assert.equal(flag(call, '--tools'), 'WebFetch,WebSearch');
  const i = call.argv.indexOf('--allowedTools');
  assert.deepEqual(call.argv.slice(i + 1, i + 4), ['WebFetch(domain:docs.aws.amazon.com)', 'WebFetch(domain:aws.amazon.com)', 'WebSearch']);
  assert.ok(!call.argv.some((a) => /^(Read|Edit|Write|Bash)/.test(a)));
  assert.match(flag(call, '-p')!, /Đáp án trong ngân hàng: /);

  v = (await api.get<VerifyApi>('/api/verify')).body;
  const shown = v.latest[G1.id];
  assert.equal(shown.grounded?.fact, 'correct');
  assert.equal(shown.grounded?.citations?.[0].url, 'https://docs.aws.amazon.com/fake/latest/userguide/feature.html');
  assert.ok(v.pending.some((p) => p.qid === G1.id), 'still waiting for the learner — now with the documentation');
  assert.equal(v.disputed, 0, 'a newer fact-check confirmed the key: no longer disputed');
  assert.ok(!v.groundedQueue?.includes(G1.id));
  assert.match(ledger(), new RegExp(`\`${G1.id}\` · 🔗 kiểm chứng tài liệu AWS: ✅ đúng theo tài liệu`));
});

test('explicit fact-check of a never-solved question: outdated → review queue + disputed; the ENRICH batch carries the quotes', async () => {
  const g = await verifyRun({ scope: 'grounded', ids: [G2.id] });
  assert.equal(g.run.outcome?.grounded?.outdated, 1, g.log);
  const v = (await api.get<VerifyApi>('/api/verify')).body;
  const p = v.pending.find((x) => x.qid === G2.id)!;
  assert.equal(p.check, 'grounded');
  assert.equal(p.fact, 'outdated');
  assert.equal(v.disputed, 1);

  const e = await api.post<{ run: Run }>('/api/coach/run', { task: 'enrich', params: { ids: [G2.id], tasks: 'explain' } });
  assert.equal(e.status, 200, JSON.stringify(e.body));
  const done = await waitRun(e.body.run.id);
  const batch = fs.readFileSync(path.join(home, String(done.run.params!.batch).replace(/^trainer\//, '')), 'utf8');
  assert.match(batch, /🔗 kiểm chứng tài liệu AWS .*kiến thức LỖI THỜI/);
  assert.match(batch, /📄 “The service was renamed in 2025\.” — https:\/\/aws\.amazon\.com\/about-aws\/whats-new\/2025\/08\/fake\//);
});

test('import audit: 10 imported questions blind-solved, the local model votes, its high-confidence disagreements are fact-checked; GET /api/verify shows the progress', async () => {
  const before = (await api.get<VerifyApi>('/api/verify')).body.audit!;
  assert.equal(before.next.length, 10);
  const a = await verifyRun({ scope: 'audit' });
  assert.equal(a.run.status, 'success', a.log);
  const ids = a.run.params!.ids as string[];
  assert.deepEqual(ids, before.next);
  assert.equal(a.run.outcome?.verify?.checked, 10);
  assert.equal(a.run.outcome?.verify?.drafted.length, 0, 'imported questions are never drafted');
  assert.equal(a.run.outcome?.local?.checked, 10);
  assert.ok(chats >= 1);
  const disagree = a.run.outcome!.local!.disagree;
  assert.ok(disagree >= 1);
  assert.equal(a.run.outcome?.grounded?.checked, disagree, 'each high-confidence disagreement is fact-checked');
  assert.match(a.log, /🖥️ Phiếu thứ ba: model local qwen-fake/);
  const after = (await api.get<VerifyApi>('/api/verify')).body.audit!;
  assert.equal(after.audited, before.audited + 10);
  assert.ok(!after.next.some((id) => ids.includes(id)));
  assert.match(ledger(), /🖥️ phiếu model local/);
  assert.equal((await api.post('/api/verify/run', { scope: 'audit', ids: ['x'] })).status, 400);
});

test('coach-run.ts --verify --scope audit; coach.verify.grounded: false refuses the fact-check', async () => {
  const env: NodeJS.ProcessEnv = { ...process.env, ...ENV, TRAINER_HOME: home, TRAINER_REPO: sb.repo };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'ANTHROPIC_API_KEY']) delete env[k];
  // async: the fake Ollama server lives in this process and must keep answering
  const r = await new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn(process.execPath, ['scripts/coach-run.ts', '--verify', '--scope', 'audit'], { cwd: TRAINER_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (b: Buffer) => (out += b.toString()));
    child.stderr.on('data', (b: Buffer) => (out += b.toString()));
    child.on('close', (code) => resolve({ code, out }));
  });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /kiểm toán câu nhập/);

  const text = fs.readFileSync(cfgFile, 'utf8');
  fs.writeFileSync(cfgFile, text.replace(/grounded: true/, 'grounded: false'));
  try {
    const off = await api.post<{ error: string }>('/api/verify/run', { scope: 'grounded', ids: [G1.id] });
    assert.equal(off.status, 409);
    assert.match(off.body.error, /coach\.verify\.grounded: false/);
    assert.equal((await api.get<VerifyApi>('/api/verify')).body.groundedEnabled, false);
  } finally {
    fs.writeFileSync(cfgFile, text);
  }
});
