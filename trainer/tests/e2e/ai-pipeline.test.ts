// AI pipeline end to end: structured output (generate / ENRICH / long-form answer in JSON, the app writes and checks the
// files, one repair round through --resume), the blind-solve phase after runs that add or change questions, the verify
// routes and coach-run.ts --verify — on a sandbox repo with the fake Claude CLI (tests/helpers/fake-claude.mjs).
// Never touches the real repo or a real model. Run: npm run test:e2e
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { apiClient, makeSandbox, startServer } from '../helpers/server.ts';
import { TRAINER_ROOT } from '../helpers/paths.ts';
import type { CoachEvent, CoachRunInfo, CoachRunOutcome, Question, VerifySummary, VerifyVerdict } from '../../shared/types.ts';

type Run = CoachRunInfo & { outcome?: CoachRunOutcome; model?: string };

const sb = makeSandbox({ git: true });
const repo = sb.repo!;
const home = sb.home;
const cfgFile = path.join(home, 'config.yaml');
// the sync around runs is covered by ai-sync.test.ts — keep these runs local
fs.writeFileSync(cfgFile, fs.readFileSync(cfgFile, 'utf8').replace('before_ai: true', 'before_ai: false').replace('after_ai: true', 'after_ai: false'));

/** Answer keys of the first questions of an imported pack (read before the server starts: the fake's knobs need ids). */
function packKeys(file: string, n: number): { id: string; key: string }[] {
  const text = fs.readFileSync(path.join(home, 'bank', 'packs', 'imported', file), 'utf8');
  return text
    .split(/\n(?=## Q )/)
    .map((b) => ({ id: /^## Q (\S+)/.exec(b)?.[1] ?? '', key: /\*\*Answer:\*\*\s*([A-H](?:\s*,\s*[A-H])*)/.exec(b)?.[1]?.replace(/[\s,]/g, '') ?? '' }))
    .filter((q) => q.id && q.key)
    .slice(0, n);
}
const [E1, E2, V1, V2] = packKeys('02-storage-services-v1.md', 4);
const other = (key: string) => [...'ABCD'].find((k) => !key.includes(k))!;

const LOG = path.join(sb.root, 'fake-claude.log');
const ENV = {
  TRAINER_ALLOW_COACH: '1',
  CLAUDE_BIN: path.join(TRAINER_ROOT, 'tests/helpers/fake-claude.mjs'),
  FAKE_CLAUDE_LOG: LOG,
  FAKE_BAD: `#2,${E1.id}`, // 2nd new question / E1's ENRICH item are rejected first, fixed by the repair round
  FAKE_OPTIONS: `${E2.id},doc-fake-pack-2-03`, // ENRICH rewrites a distractor of these → new hash → blind-solved after the run
  FAKE_VERIFY: JSON.stringify({
    'doc-fake-pack-03': { answer: ['D'], confidence: 'high', reason: 'Model thứ hai chọn khác' },
    [E2.id]: { answer: [other(E2.key)], confidence: 'medium', reason: 'Lệch sau khi đổi phương án' },
    [V1.id]: { answer: [V1.key[0]], ambiguous: true, confidence: 'low', reason: 'Hai phương án cùng đúng' },
    // wrong until ENRICH rewrote its distractor (FAKE_OPTIONS appends this text) — then the real key
    'doc-fake-pack-2-03': { answer: ['D'], confidence: 'high', reason: 'Lệch trước khi sửa', until: 'in a second AWS Region' },
  }),
};
const server = await startServer({ home, repo, env: ENV });
const api = apiClient(server.base);
after(async () => {
  await server.stop();
  sb.cleanup();
});

const pad = (n: number) => String(n).padStart(2, '0');
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

interface Call {
  argv: string[];
  cwd: string;
}
const calls = (): Call[] => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Call) : []);
const flag = (c: Call, name: string) => (c.argv.includes(name) ? c.argv[c.argv.indexOf(name) + 1] : undefined);
const schemaOf = (c: Call) => (flag(c, '--json-schema') ? (JSON.parse(flag(c, '--json-schema')!) as { properties: Record<string, unknown> }) : undefined);

async function waitRun(id: string): Promise<{ run: Run; log: string }> {
  const deadline = Date.now() + 90_000;
  for (;;) {
    const events = (await api.get<{ events: CoachEvent[] }>(`/api/coach/runs/${encodeURIComponent(id)}`)).body.events;
    if (events.some((e) => e.kind === 'end')) {
      const runs = (await api.get<{ runs: Run[] }>('/api/coach')).body.runs;
      return { run: runs.find((x) => x.id === id)!, log: events.map((e) => e.text).join('\n') };
    }
    if (Date.now() > deadline) throw new Error(`run ${id} did not finish:\n${events.map((e) => e.text).join('\n')}`);
    await new Promise((res) => setTimeout(res, 150));
  }
}

async function runAi(task: string, params: Record<string, unknown>): Promise<{ run: Run; log: string; calls: Call[] }> {
  const start = calls().length;
  const r = await api.post<{ run: Run }>('/api/coach/run', { task, params });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const done = await waitRun(r.body.run.id);
  return { ...done, calls: calls().slice(start) };
}

const bankQuestions = async () => (await api.get<{ questions: Question[] }>('/api/bank')).body.questions;
const ledger = () => fs.readFileSync(path.join(home, 'bank', 'verify.md'), 'utf8');

test('GET /api/coach: structured output + blind-solve settings and the verify model', async () => {
  const c = (await api.get('/api/coach')).body;
  assert.equal(c.structured, true);
  assert.deepEqual(c.verify, { auto: true, autoDraft: true, batchSize: 10, model: 'opus' });
  assert.equal(c.models.verify, 'opus');
  assert.equal(c.claude.available, true);
  assert.equal((await api.post('/api/coach/run', { task: 'nope' })).status, 400);
  assert.equal((await api.post('/api/coach/run', { task: 'enrich', params: { ids: [1, 2] } })).status, 400);
});

test('generate (JSON): a rejected question is repaired through --resume, the app writes the pack, then a blind-solve mismatch on an AI question goes to draft', async () => {
  const { run, log, calls: cs } = await runAi('generate', { sources: ['03-database-services.md'], count: 3 });
  assert.equal(run.status, 'success', log);
  const out = run.outcome!;
  assert.equal(out.structured, true);
  assert.equal(out.pack, `bank/packs/docs/${today}-fake-pack.md`);
  assert.equal(out.questions, 3);
  assert.equal(out.errors, 0);
  assert.equal(out.repaired, 1);
  assert.deepEqual(out.rejected, []);
  assert.deepEqual(out.verify, { checked: 3, ok: 2, mismatch: 1, ambiguous: 0, error: 0, drafted: ['doc-fake-pack-03'] });
  assert.match(log, /❌ doc-fake-pack-02 “A retail company[^”]*”: explanation nhắc tới chữ cái đáp án/);
  assert.doesNotMatch(log, /⚠️ \d+ câu có cảnh báo/, 'the fake writes lint-clean questions');
  assert.match(log, /🔧 Vòng sửa lỗi: gửi lại 1 câu/);
  assert.match(log, /🧪 Giải mù 3 câu · model opus \(dự phòng sonnet\)/);
  assert.match(log, /❌ doc-fake-pack-03: model chọn D, đáp án C — Model thứ hai chọn khác/);
  assert.match(log, /📝 1 câu chuyển sang draft/);
  assert.equal(run.costUsd, 0.03, 'main + repair + verify');

  const qs = (await bankQuestions()).filter((q) => q.pack === 'doc-fake-pack');
  assert.deepEqual(qs.map((q) => [q.id, q.status, q.origin]), [
    ['doc-fake-pack-01', 'active', 'doc'],
    ['doc-fake-pack-02', 'active', 'doc'],
    ['doc-fake-pack-03', 'draft', 'doc'],
  ]);
  assert.ok(qs.every((q) => q.enriched === today && q.created === today && q.task === '2.2' && q.hint && q.time >= 45));
  assert.match(fs.readFileSync(path.join(home, out.pack!), 'utf8'), /^---\npack: doc-fake-pack\ntitle: Fake pack\nexam: SAA-C03\norigin: doc\nsource: 03-database-services\.md\ncreated: /);
  assert.ok(fs.existsSync(path.join(home, 'coach', 'patches', `${run.id}-verify.yaml`)), 'status change kept as a patch');
  assert.equal((ledger().match(/^- \d{4}-\d{2}-\d{2} · `doc-fake-pack-0\d` · /gm) ?? []).length, 4, '3 verdicts + 1 drafted decision');

  // the CLI calls: main (read-only + schema) → repair (same session) → blind-solve (no tools, opus, never the key)
  assert.equal(cs.length, 3);
  const [main, repair, verify] = cs;
  assert.ok(schemaOf(main)?.properties.questions);
  assert.equal(flag(main, '--tools'), 'Read,Glob,Grep');
  assert.ok(!main.argv.some((a) => /^(Edit|Write|Bash)\(/.test(a)), 'no write / shell rule in JSON mode');
  assert.equal(flag(main, '--resume'), undefined);
  assert.ok(flag(repair, '--resume'), 'repair continues the session');
  assert.match(flag(repair, '-p')!, /- `doc-fake-pack-02` /);
  assert.ok(schemaOf(verify)?.properties.results);
  assert.equal(flag(verify, '--tools'), '');
  assert.equal(flag(verify, '--model'), 'opus');
  assert.equal(flag(verify, '--fallback-model'), 'sonnet');
  assert.ok(verify.argv.includes('--no-session-persistence'));
  const vp = flag(verify, '-p')!;
  assert.doesNotMatch(vp, /Explanation|🇻🇳|Đề nhấn mạnh ràng buộc/, 'no explanation / hint in the blind-solve prompt');
  assert.equal(main.cwd, repo);
});

test('verify routes: summary + latest verdicts, approve a drafted question, retire, input errors', async () => {
  const v = (await api.get<VerifySummary & { latest: Record<string, VerifyVerdict> }>('/api/verify')).body;
  assert.equal(v.review, 1);
  assert.equal(v.ok, 2);
  assert.deepEqual(
    v.pending.map((p) => [p.qid, p.outcome, p.picked, p.key, p.decision]),
    [['doc-fake-pack-03', 'mismatch', 'D', 'C', 'drafted']],
  );
  assert.equal(v.latest['doc-fake-pack-01'].outcome, 'ok');

  const a = await api.post<{ verdict: VerifyVerdict }>('/api/verify/decision', { qid: 'doc-fake-pack-03', decision: 'approve', note: 'đã kiểm tra với notes' });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.verdict.decision, 'approved');
  assert.equal((await bankQuestions()).find((q) => q.id === 'doc-fake-pack-03')!.status, 'active', 'approve puts it back into tests');
  const r = await api.post('/api/verify/decision', { qid: 'doc-fake-pack-02', decision: 'retire' });
  assert.equal(r.status, 200);
  assert.equal((await bankQuestions()).find((q) => q.id === 'doc-fake-pack-02')!.status, 'retired');
  const after = (await api.get<VerifySummary>('/api/verify')).body;
  assert.equal(after.review, 0);
  assert.match(ledger(), /`doc-fake-pack-03` · 👍 đã duyệt — đã kiểm tra với notes/);

  assert.equal((await api.post('/api/verify/decision', { qid: 'doc-fake-pack-01', decision: 'maybe' })).status, 400);
  assert.equal((await api.post('/api/verify/decision', { qid: 'nope', decision: 'approve' })).status, 400);
  const unverified = await api.post<{ error: string }>('/api/verify/decision', { qid: E1.id, decision: 'approve' });
  assert.equal(unverified.status, 400);
  assert.match(unverified.body.error, /chưa được giải mù/);
  assert.equal((await api.post('/api/verify/run', { ids: [] })).status, 400);
  assert.equal((await api.post('/api/verify/run', { scope: 'bogus' })).status, 400);
  assert.equal((await api.post('/api/verify/run', { pack: 'nope' })).status, 400);
});

test('ENRICH (JSON) with explicit ids + distractors: audit patch written by the app, a rejected item repaired, the edited options blind-solved (imported → never drafted)', async () => {
  const { run, log, calls: cs } = await runAi('enrich', { ids: [E1.id, E2.id], tasks: 'explain,distractors' });
  assert.equal(run.status, 'success', log);
  const out = run.outcome!;
  assert.equal(out.structured, true);
  assert.equal(out.patch, `trainer/coach/patches/${run.id}.yaml`);
  assert.equal(out.updated, 2);
  assert.equal(out.failed, 0);
  assert.equal(out.repaired, 1);
  assert.deepEqual(out.missing, []);
  assert.deepEqual(out.verify, { checked: 1, ok: 0, mismatch: 1, ambiguous: 0, error: 0, drafted: [] }, 'only E2 changed its options; imported questions are never drafted');
  assert.match(log, new RegExp(`❌ ${E1.id}: explanation nhắc tới chữ cái đáp án`));
  assert.match(log, /🔧 Vòng sửa lỗi: gửi lại 1 item/);
  assert.match(log, /Patch trainer\/coach\/patches\/[\w-]+\.yaml: 2\/2 câu đã cập nhật \(1 nhờ vòng sửa lỗi\)/);

  const patch = YAML.parse(fs.readFileSync(path.join(repo, out.patch!), 'utf8')) as { run_id: string; items: { id: string; base: string; options?: Record<string, string> }[] };
  assert.equal(patch.run_id, run.id);
  assert.deepEqual(patch.items.map((i) => i.id), [E1.id, E2.id]);
  assert.ok(patch.items.every((i) => /^[0-9a-f]{10}$/.test(i.base)), 'base filled in by the app');
  const batch = fs.readFileSync(path.join(repo, String(run.params!.batch)), 'utf8');
  assert.match(batch, /^mode: json$/m);
  assert.match(batch, /todo: explain · distractors/);
  assert.match(batch, /📊 /);

  const qs = await bankQuestions();
  const e1 = qs.find((q) => q.id === E1.id)!;
  const e2 = qs.find((q) => q.id === E2.id)!;
  assert.equal(e1.enriched, today);
  assert.match(e1.explanation, /🇻🇳/);
  assert.ok(e2.options.some((o) => / in a second AWS Region$/.test(o.text)));
  assert.equal(e2.status, 'active');
  const review = (await api.get<VerifySummary>('/api/verify')).body;
  assert.deepEqual(review.pending.map((p) => p.qid), [E2.id]);
  assert.deepEqual(
    cs.map((c) => (flag(c, '--resume') ? 'repair' : schemaOf(c)?.properties.results ? 'verify' : 'main')),
    ['main', 'repair', 'verify'],
  );
});

test('long-form (JSON): new pack in packs/ai with variant_of and the run prefix, blind-solved after the run', async () => {
  const { run, log } = await runAi('longform', { count: 2 });
  assert.equal(run.status, 'success', log);
  const out = run.outcome!;
  assert.match(out.pack!, /^bank\/packs\/ai\/\d{4}-\d{2}-\d{2}-\d{4}-longform-fake-longform\.md$/);
  assert.equal(out.questions, 2);
  assert.equal(out.longForm, 2);
  assert.equal(out.repaired, 1, '2nd question rejected then repaired');
  assert.equal(out.verify!.checked, 2);
  const originals = run.params!.ids as string[];
  const qs = (await bankQuestions()).filter((q) => q.file === out.pack);
  assert.deepEqual(qs.map((q) => q.id), [`${String(run.params!.idPrefix)}01`, `${String(run.params!.idPrefix)}02`]);
  assert.deepEqual(qs.map((q) => q.variantOf[0]), originals);
  assert.ok(qs.every((q) => q.longForm && q.origin === 'ai'));
});

test('verify run (POST /api/verify/run): explicit ids (ambiguous imported question stays active), scope unverified-ai, then nothing left → 409', async () => {
  const r = await api.post<{ run: Run }>('/api/verify/run', { ids: [V1.id] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const { run, log } = await waitRun(r.body.run.id);
  assert.equal(run.task, 'verify');
  assert.equal(run.status, 'success', log);
  assert.deepEqual(run.outcome!.verify, { checked: 1, ok: 0, mismatch: 0, ambiguous: 1, error: 0, drafted: [] });
  assert.match(run.summary ?? '', /🧪 Giải mù 1\/1 câu: 0 khớp · 0 lệch · 1 mơ hồ/);
  assert.equal((await bankQuestions()).find((q) => q.id === V1.id)!.status, 'active');

  // the AI pack of the real bank (copied into the sandbox) has not been verified yet
  const s = await api.post<{ run: Run }>('/api/verify/run', { scope: 'unverified-ai' });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const scoped = await waitRun(s.body.run.id);
  assert.equal(scoped.run.status, 'success', scoped.log);
  assert.ok(scoped.run.outcome!.verify!.checked >= 1);
  const none = await api.post<{ error: string }>('/api/verify/run', { scope: 'unverified-ai' });
  assert.equal(none.status, 409);
  assert.match(none.body.error, /Không có câu nào cần giải mù/);
  const c = (await api.get('/api/coach')).body;
  assert.ok(c.costs.byTask.verify.runs >= 2);
});

test('coach-run.ts --verify (scheduler / terminal path)', () => {
  const env: NodeJS.ProcessEnv = { ...process.env, ...ENV, TRAINER_HOME: home, TRAINER_REPO: repo };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'ANTHROPIC_API_KEY']) delete env[k];
  const r = spawnSync(process.execPath, ['scripts/coach-run.ts', '--verify', '--ids', V2.id], { cwd: TRAINER_ROOT, env, encoding: 'utf8', timeout: 120_000 });
  const out = r.stdout + r.stderr;
  assert.equal(r.status, 0, out);
  assert.match(out, /🧪 Giải mù 1 câu · model opus/);
  assert.match(out, /Giải mù 1\/1 câu: 1 khớp/);
  assert.match(ledger(), new RegExp(`\`${V2.id}\` · ✅ khớp`));
});

test('coach.structured_output: false → file mode (write rules, no --json-schema)', async () => {
  const before = fs.readFileSync(cfgFile, 'utf8');
  fs.writeFileSync(cfgFile, before.replace(/structured_output: true/, 'structured_output: false'));
  try {
    const { run, log, calls: cs } = await runAi('generate', { count: 1 });
    assert.equal(run.status, 'success', log);
    assert.equal(cs.length, 1, 'no blind-solve: the fake wrote no question');
    assert.equal(flag(cs[0], '--json-schema'), undefined);
    assert.ok(cs[0].argv.includes('Write(trainer/bank/**)'));
    assert.equal(run.params?.structured, undefined);
  } finally {
    fs.writeFileSync(cfgFile, before);
  }
});

// ── review regressions ──────────────────────────────────────────────────────

/** coach-run.ts on the sandbox (terminal / scheduler path), with extra fake knobs; resolves when the process exits. */
function coachRun(args: string[], extra: Record<string, string> = {}, onOutput?: (text: string, kill: () => void) => void): Promise<{ code: number | null; out: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env, ...ENV, TRAINER_HOME: home, TRAINER_REPO: repo, ...extra };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'ANTHROPIC_API_KEY']) delete env[k];
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/coach-run.ts', ...args], { cwd: TRAINER_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const add = (b: Buffer) => {
      out += b.toString();
      onOutput?.(out, () => child.kill('SIGTERM'));
    };
    child.stdout.on('data', add);
    child.stderr.on('data', add);
    child.on('close', (code) => resolve({ code, out }));
  });
}

test('a question the blind-solve drafted, then fixed by ENRICH, is re-verified OK and back in use (not stuck in draft)', async () => {
  const id = 'doc-fake-pack-2-03';
  const g = await runAi('generate', { sources: ['03-database-services.md'], count: 3 });
  assert.equal(g.run.status, 'success', g.log);
  assert.deepEqual(g.run.outcome!.verify!.drafted, [id]);
  assert.equal((await bankQuestions()).find((q) => q.id === id)!.status, 'draft');
  const queued = (await api.get<VerifySummary>('/api/verify')).body.pending.find((p) => p.qid === id)!;
  assert.equal(queued.decision, 'drafted');

  // the review card's "🧹 Sửa bằng ENRICH": the distractor is rewritten → new version → the verifier agrees now
  const e = await runAi('enrich', { ids: [id], tasks: 'explain,distractors' });
  assert.equal(e.run.status, 'success', e.log);
  assert.equal(e.run.outcome!.verify!.ok, 1);
  assert.deepEqual(e.run.outcome!.verify!.reactivated, [id]);
  assert.match(e.log, /✅ 1 câu đang draft vì giải mù nay đã khớp → dùng lại/);
  assert.equal((await bankQuestions()).find((q) => q.id === id)!.status, 'active');
  assert.ok(!(await api.get<VerifySummary>('/api/verify')).body.pending.some((p) => p.qid === id));
  assert.match(ledger(), new RegExp(`\`${id}\` · ✅ tự dùng lại`));
});

test('decision on a version the learner did not see → 409', async () => {
  const q = (await bankQuestions()).find((x) => x.id === 'doc-fake-pack-2-01')!;
  const stale = await api.post<{ error: string }>('/api/verify/decision', { qid: q.id, decision: 'approve', hash: '0000000000' });
  assert.equal(stale.status, 409);
  assert.match(stale.body.error, /đã thay đổi sau khi bạn xem/);
  assert.equal((await api.post('/api/verify/decision', { qid: q.id, decision: 'approve', hash: q.hash })).status, 200);
});

test('cancelling during the repair round writes no pack', async () => {
  const docs = path.join(home, 'bank', 'packs', 'docs');
  const before = fs.readdirSync(docs);
  let killed = false;
  const r = await coachRun(['--generate', '--sources', '03-database-services.md', '--count', '3'], { FAKE_SLOW_RESUME_MS: '4000' }, (out, kill) => {
    if (!killed && /🔧 Vòng sửa lỗi/.test(out)) {
      killed = true;
      kill();
    }
  });
  assert.ok(killed, r.out);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /Kết thúc: cancelled/);
  assert.deepEqual(fs.readdirSync(docs), before, 'nothing written after the cancel');
  assert.equal(readLockFile(), undefined, 'lock released');
});

const readLockFile = () => (fs.existsSync(path.join(home, 'coach', '.lock')) ? fs.readFileSync(path.join(home, 'coach', '.lock'), 'utf8') : undefined);

test('two coach-run.ts started together: one runs, the other is refused (atomic lock, unique run id)', async () => {
  const runsBefore = fs.readdirSync(path.join(home, 'coach', 'runs')).filter((f) => f.endsWith('_verify.json') || /_verify-\d+\.json$/.test(f)).length;
  const [a, b] = await Promise.all([coachRun(['--verify', '--ids', V2.id], { FAKE_SLOW_VERIFY_MS: '3000' }), coachRun(['--verify', '--ids', V2.id], { FAKE_SLOW_VERIFY_MS: '3000' })]);
  const codes = [a.code, b.code].sort();
  assert.deepEqual(codes, [0, 1], `${a.out}\n----\n${b.out}`);
  const refused = a.code === 1 ? a : b;
  assert.match(refused.out, /đang chạy coach|đang bắt đầu chạy coach/);
  const runsAfter = fs.readdirSync(path.join(home, 'coach', 'runs')).filter((f) => f.endsWith('_verify.json') || /_verify-\d+\.json$/.test(f)).length;
  assert.equal(runsAfter, runsBefore + 1, 'exactly one run record');
  assert.equal(readLockFile(), undefined);
});

test('the blind-solve phase stops at its deadline instead of spawning calls that are killed at once', async () => {
  const before = fs.readFileSync(cfgFile, 'utf8');
  fs.writeFileSync(cfgFile, before.replace(/(\n\s+batch_size:\s*)\d+/, (_m, head: string) => `${head}1`)); // coach.verify.batch_size (not enrich_batch_size)
  assert.match(fs.readFileSync(cfgFile, 'utf8'), /\n\s+batch_size: 1\b/);
  const start = calls().length;
  try {
    const r = await coachRun(['--verify', '--ids', [E1.id, V1.id, V2.id].join(',')], { TRAINER_VERIFY_TIMEOUT_MS: '1500', FAKE_SLOW_VERIFY_MS: '2500' });
    assert.equal(r.code, 1, r.out); // nothing could be checked in time
    assert.match(r.out, /⏱ Hết 2 giây giải mù — 2 câu chưa giải/);
    assert.equal(calls().slice(start).filter((c) => schemaOf(c)?.properties.results).length, 1, 'one call, then the loop stops');
  } finally {
    fs.writeFileSync(cfgFile, before);
  }
});

test('coach-run.ts --verify: a mistyped --pack or --scope fails clearly (exit 2)', async () => {
  const p = await coachRun(['--verify', '--pack', 'no-such-pack']);
  assert.equal(p.code, 2, p.out);
  assert.match(p.out, /Không có pack "no-such-pack"/);
  const s = await coachRun(['--verify', '--scope', 'everything']);
  assert.equal(s.code, 2, s.out);
  assert.match(s.out, /--scope không hợp lệ: everything/);
});

// ── [γ] B9: ENRICH the questions the learner is about to meet, right after an analyze ─────────────────────────

/** The follow-up run (params.after = analyze run id) as soon as its record exists. */
async function followUpOf(id: string): Promise<Run> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const f = (await api.get<{ runs: Run[] }>('/api/coach')).body.runs.find((x) => x.params?.after === id);
    if (f) return f;
    if (Date.now() > deadline) throw new Error(`no follow-up run after ${id}`);
    await new Promise((res) => setTimeout(res, 150));
  }
}

test('[γ] coach.enrich_after_analyze: a successful analyze starts a 10-question ENRICH run over the questions the learner meets next (app and coach-run.ts)', async () => {
  const before = fs.readFileSync(cfgFile, 'utf8');
  assert.match(before, /enrich_after_analyze: false/);
  fs.writeFileSync(cfgFile, before.replace('enrich_after_analyze: false', 'enrich_after_analyze: true'));
  try {
    const { run, log } = await runAi('analyze', {});
    assert.equal(run.status, 'success', log);
    const follow = await followUpOf(run.id);
    assert.equal(follow.task, 'enrich');
    assert.equal(follow.trigger, run.trigger);
    assert.equal(follow.params?.upcoming, true);
    assert.equal(follow.params?.size, 10);
    assert.equal(follow.params?.upcomingItems, 10, 'every question of the batch is one the learner meets next');
    const done = await waitRun(follow.id);
    assert.equal(done.run.status, 'success', done.log);
    assert.ok((done.run.outcome?.updated ?? 0) >= 9, JSON.stringify(done.run.outcome));
    const batch = fs.readFileSync(path.join(home, String(follow.params?.batch).replace(/^trainer\//, '')), 'utf8');
    assert.equal((batch.match(/⏭ người học sắp gặp câu này/g) ?? []).length, 10);

    // terminal / scheduler path: coach-run.ts waits for the follow-up run and keeps the analyze run's exit code
    const r = await coachRun(['--force']);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /▶ ENRICH câu sắp gặp sau phân tích \(coach\.enrich_after_analyze\): \S+_enrich/);
    assert.match(r.out, /Bảo trì ngân hàng \(ENRICH\) · 10 câu/);
  } finally {
    fs.writeFileSync(cfgFile, before);
  }
  // switched off (the default): an analyze run is not followed by anything
  const { run } = await runAi('analyze', {});
  await new Promise((res) => setTimeout(res, 500));
  assert.ok(!(await api.get<{ runs: Run[] }>('/api/coach')).body.runs.some((x) => x.params?.after === run.id));
});

// ── [γ] review R2 #4: AI features never surface a sealed question ───────────────────────────────────────────

test('[R2 #4] "Hỏi AI" runs with read-deny rules for trainer/** and practice-exams/**; a blind-solve of a sealed question logs no pick, key or reason', async () => {
  const start = calls().length;
  const r = await api.post<{ answer: string; error?: string }>('/api/ask', { qid: V2.id, question: 'Vì sao đáp án này đúng?' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const askCall = calls().slice(start).find((c) => flag(c, '--output-format') === 'json');
  assert.ok(askCall, 'the fake CLI saw the "Hỏi AI" call');
  const i = askCall.argv.indexOf('--disallowedTools');
  assert.deepEqual(askCall.argv.slice(i + 1, i + 3), ['Read(./trainer/**)', 'Read(./practice-exams/**)']);
  assert.match(flag(askCall, '-p') ?? '', /KHÔNG đọc, tìm hay trích các câu hỏi khác của ngân hàng/);

  // V1 sealed (hand-written form): the explicit verify run still solves it, the log keeps its details out
  const file = path.join(home, 'results', 'sealed.md');
  fs.writeFileSync(file, `---\nkind: sealed\nsize: 1\nforms:\n  - id: S1\n    status: sealed\n    ids: [ ${V1.id} ]\n---\n`);
  try {
    const run = await api.post<{ run: Run; error?: string }>('/api/verify/run', { ids: [V1.id] });
    assert.equal(run.status, 200, JSON.stringify(run.body));
    const { log } = await waitRun(run.body.run.id);
    assert.match(log, /⚠️ 1 câu đang niêm phong: mơ hồ \(chi tiết ẩn/);
    assert.doesNotMatch(log, /Hai phương án cùng đúng/, 'the reason stays out of Coach → Xem log');
    assert.ok(!log.includes(`${V1.id}: mơ hồ`));
    // a pack run never picks it
    const pack = await api.post<{ run: Run; error?: string }>('/api/verify/run', { pack: bankPackOf(V1.id) });
    if (pack.status === 200) {
      const done = await waitRun(pack.body.run.id);
      assert.ok(!(done.run.params?.ids as string[] | undefined)?.includes(V1.id), 'a pack run skips the sealed question');
    } else assert.equal(pack.status, 409, JSON.stringify(pack.body)); // nothing left to verify in that pack
  } finally {
    fs.rmSync(file, { force: true });
  }
});

/** Pack id of a question (sandbox bank). */
function bankPackOf(id: string): string {
  const dir = path.join(home, 'bank', 'packs', 'imported');
  for (const f of fs.readdirSync(dir)) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    if (text.includes(`## Q ${id}\n`)) return /^pack:\s*(\S+)/m.exec(text)?.[1] ?? f;
  }
  throw new Error(`no pack for ${id}`);
}
