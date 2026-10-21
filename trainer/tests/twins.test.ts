// [v5] γ2 — twins (6-01 / 3-01): targets (due soon, ≥ 2 reviews, no unseen sibling, never sealed), kinds, the batch
// file, sibling checks (surface = reworded, contrast = new key), schema, pack plan; the idle chooser. Temporary TRAINER_HOME.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { QuestionState } from '../shared/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-twins-'));
fs.mkdirSync(path.join(home, 'bank', 'packs', 'manual'), { recursive: true });
fs.copyFileSync(path.join(here, '..', 'bank', 'taxonomy.yaml'), path.join(home, 'bank', 'taxonomy.yaml'));
for (const d of ['results', 'coach/runs', 'coach/patches', 'coach/enrich']) fs.mkdirSync(path.join(home, d), { recursive: true });
fs.writeFileSync(path.join(home, 'config.yaml'), 'coach:\n  model: opus\n');
process.env.TRAINER_HOME = home;
delete process.env.TRAINER_ALLOW_COACH;
after(() => fs.rmSync(home, { recursive: true, force: true }));

const { loadBank } = await import('../server/lib/bank.ts');
const { loadConfig } = await import('../server/config.ts');
const twins = await import('../server/lib/twins.ts');
const aiOut = await import('../server/lib/ai-output.ts');
const runner = await import('../server/lib/coach-runner.ts');

const TOPICS = ['database', 'storage', 'networking', 'compute', 'security', 'integration'];
const block = (id: string, i: number, extra = '') => `## Q ${id}
- domain: resilient
- topic: ${TOPICS[i % TOPICS.length]}
- difficulty: medium
- time: 60${extra}

Scenario ${id}: a ${['retail', 'media', 'bank', 'game', 'health', 'travel'][i % 6]} company needs ${['failover', 'durable storage', 'private routing', 'elastic compute', 'key rotation', 'decoupling'][i % 6]} for workload number ${i}. Which option fits best?

- A. Option alpha ${i}
- B. Option bravo ${i}
- C. Option charlie ${i}
- D. Option delta ${i}

**Answer:** B

**Explanation:** Because bravo.`;
fs.writeFileSync(
  path.join(home, 'bank', 'packs', 'manual', 'w.md'),
  `---\npack: w-pack\ntitle: W\norigin: manual\n---\n\n# W\n\n${[
    block('w-01', 0),
    block('w-02', 1),
    block('w-03', 2),
    block('w-04', 3),
    block('w-05', 4, '\n- variant_of: w-04'),
    block('w-06', 5),
  ].join('\n\n---\n\n')}\n`,
);

const now = Date.parse('2026-10-20T09:00:00+07:00');
const day = 86_400_000;
const st = (id: string, o: Partial<QuestionState>): QuestionState => ({ id, attempts: 2, correct: 2, everWrong: false, streak: 2, box: 3, avgTime: 30, slowCount: 0, wrongPicks: {}, ...o });
const iso = (t: number) => new Date(t).toISOString();

test('twins targets: due within 7 days with ≥ 2 reviews, no unseen sibling, never sealed; contrast for repeated confusions; soonest first', () => {
  const bank = loadBank();
  const states = new Map<string, QuestionState>([
    ['w-01', st('w-01', { dueAt: iso(now + 2 * day) })],
    ['w-02', st('w-02', { dueAt: iso(now - day), wrongPicks: { A: 2 }, lapses: 1 })], // overdue + repeated wrong pick → contrast, first
    ['w-03', st('w-03', { dueAt: iso(now + 20 * day) })], // not due soon
    ['w-04', st('w-04', { dueAt: iso(now) })], // its variant w-05 is unseen → a sibling can stand in
    ['w-06', st('w-06', { attempts: 1, dueAt: iso(now) })], // one review only
  ]);
  const t = twins.twinsTargets(bank, states, { now, sealed: new Set() });
  assert.deepEqual(t.map((x) => [x.q.id, x.kind]), [['w-02', 'contrast'], ['w-01', 'surface']]);
  assert.match(t[0].why, /đã đến hạn ôn · đã làm 2 lần · hay nhầm/);
  // once w-05 has been met, w-04 needs a twin too
  states.set('w-05', st('w-05', { dueAt: iso(now + 50 * day) }));
  assert.deepEqual(twins.twinsTargets(bank, states, { now, sealed: new Set() }).map((x) => x.q.id), ['w-02', 'w-04', 'w-01']);
  assert.deepEqual(twins.twinsTargets(bank, states, { now, sealed: new Set(['w-02']) }).map((x) => x.q.id), ['w-04', 'w-01'], 'a sealed question never gets a twin');
  assert.equal(twins.twinsTargets(bank, states, { now, sealed: new Set(), count: 1 }).length, 1);
  // explicit ids + kind (the leech clinic's "✨ câu tương phản")
  const ex = twins.twinsTargets(bank, states, { ids: ['w-06', 'nope', 'w-03'], kind: 'contrast', sealed: new Set(['w-03']) });
  assert.deepEqual(ex.map((x) => [x.q.id, x.kind]), [['w-06', 'contrast']]);
  assert.equal(twins.autoKind(st('x', { leech: true })), 'contrast');
  assert.equal(twins.autoKind(undefined), 'surface');
});

test('twins batch file: kind per original, siblings and variants listed, pack / id plan', () => {
  const bank = loadBank();
  const states = new Map<string, QuestionState>([['w-04', st('w-04', { dueAt: iso(now) })]]);
  const t = twins.twinsTargets(bank, states, { ids: ['w-04', 'w-01'], kind: 'surface', sealed: new Set() });
  const plan = { count: 2, packFile: 'trainer/bank/packs/ai/2026-10-20-0900-twins-<slug>.md', packId: 'ai-2026-10-20-0900-twins', idPrefix: 'ai-20261020-0900-tw' };
  const file = twins.writeTwinsFile('2026-10-20_090000_twins', t, bank, plan);
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^kind: twins-batch$/m);
  assert.match(text, /## 1\. `w-04` — câu gốc · loại: \*\*surface\*\*/);
  assert.match(text, /biến thể đã có: w-05/);
  assert.match(text, /TWINS\.md/);
});

test('twin checks: a surface twin must be reworded, a contrast twin must move the key; one sibling per original', () => {
  const bank = loadBank();
  const orig = bank.byId.get('w-01')!;
  const draft = { ...orig, variantOf: ['w-01'] } as unknown as Parameters<typeof aiOut.twinChecks>[0];
  assert.match(aiOut.twinChecks(draft, orig, 'surface').errors[0], /trùng \d+% từ với câu gốc/);
  assert.match(aiOut.twinChecks(draft, orig, 'contrast').errors.join(' '), /phải đổi đáp án đúng/);
  const other = { ...draft, stem: 'A logistics firm wants its tracking API to keep answering when one data center is lost; what should it choose?', answer: ['C'] };
  assert.deepEqual(aiOut.twinChecks(other, orig, 'contrast').errors, []);
  assert.deepEqual(aiOut.twinChecks({ ...other, answer: ['B'] }, orig, 'surface').errors, []);
  assert.match(aiOut.twinChecks(other, orig, 'contrast', 'surface').warnings[0], /khác loại lô yêu cầu/);
  assert.ok(aiOut.wordOverlap('Multi AZ failover database', 'database failover Multi AZ') > 0.99);
  // draftOf: twins need exactly one original of the batch
  const raw = { domain: 'resilient', task: '2.2', topic: 'database', services: [], tags: [], difficulty: 'medium', concept: 'c', hint: 'Cơ chế nào giữ bản sao?', stem: other.stem, options: ['a1', 'b1', 'c1', 'd1'], answer: ['C'], explanation: 'x' };
  const ctx = { tax: bank.taxonomy, today: '2026-10-20', kind: 'twins' as const, originals: ['w-01'], bank };
  assert.match(aiOut.draftOf({ ...raw }, 'ai-x-tw01', ctx).errors.join(' '), /câu song sinh phải có variant_of/);
  assert.match(aiOut.draftOf({ ...raw, variant_of: ['w-02'] }, 'ai-x-tw01', ctx).errors.join(' '), /không phải câu gốc của lô/);
  assert.match(aiOut.draftOf({ ...raw, variant_of: ['w-01', 'w-02'] }, 'ai-x-tw01', ctx).errors.join(' '), /chỉ có một câu gốc/);
});

test('schemas and pack plans of the new tasks; CLI args and prompts', () => {
  const s = aiOut.schemaFor('twins') as { properties: { questions: { items: { required: string[]; properties: Record<string, unknown> } } } };
  assert.ok(s.properties.questions.items.required.includes('kind') && s.properties.questions.items.required.includes('variant_of'));
  assert.ok((aiOut.schemaFor('family') as { properties: Record<string, unknown> }).properties.families);
  assert.ok((aiOut.schemaFor('generate') as { properties: { questions: { items: { properties: Record<string, unknown> } } } }).properties.questions.items.properties.skills);
  const bank = loadBank();
  const p = aiOut.planPack({ kind: 'family', runId: 'r', today: '2026-10-20', idPrefix: 'ai-20261020-0900-fa', packId: 'ai-2026-10-20-0900-family' }, { pack: { slug: 'Cost vs Ops', title: 'Compute' } }, bank);
  assert.equal(p.meta.title, 'AI · Họ câu đổi yêu cầu · Compute');
  assert.equal(p.idOf(0), 'ai-20261020-0900-fa01');
  assert.equal(p.familyOf(1), 'ai-20261020-0900-f2');
  assert.match(p.file, /2026-10-20-family-cost-vs-ops\.md$/);
  const cfg = loadConfig();
  const args = runner.structuredArgs('p', cfg, 'twins');
  assert.equal(args[args.indexOf('--tools') + 1], 'Read,Glob,Grep');
  assert.ok(!args.some((a) => /^(Edit|Write|Bash)\(/.test(a)));
  assert.deepEqual(runner.allowedTools('family'), runner.allowedTools('longform'));
  const jp = runner.buildJsonPrompt('twins', 'run-1', 'manual', { batch: 'b.md', count: 3, idPrefix: 'ai-x-tw', packFile: 'f.md' });
  assert.match(jp, /trainer\/coach\/TWINS\.md/);
  assert.match(runner.buildJsonPrompt('family', 'run-1', 'manual', { batch: 'b.md', count: 2, idPrefix: 'ai-x-fa', familyPrefix: 'ai-x-f', packFile: 'f.md' }), /viết đúng 2 họ/);
  assert.match(runner.buildPrompt('twins', 'run-1', 'manual', { batch: 'b.md', count: 3, idPrefix: 'ai-x-tw', packFile: 'f.md', packId: 'p' }), /Chế độ tương tác/);
  assert.equal(runner.modelFor('twins', cfg), runner.modelFor('generate', cfg));
  assert.ok(runner.COACH_TASKS.includes('twins') && runner.COACH_TASKS.includes('family'));
});

test('idle chooser: config order, unknown names dropped; the default [enrich] is one ENRICH batch; first task with work wins', async () => {
  const cfg = loadConfig();
  assert.deepEqual(runner.idleSteps(cfg).map((s) => [s.idle, s.task]), [['enrich', 'enrich']]);
  const many = { ...cfg, coach: { ...cfg.coach, idle_tasks: ['bogus', 'twins', 'audit', 'notebook', 'longform', 'twins'] } };
  assert.deepEqual(runner.idleSteps(many).map((s) => [s.idle, s.task, s.params]), [
    ['twins', 'twins', { count: cfg.coach.twins_per_run }],
    ['audit', 'verify', { scope: 'audit' }],
    ['notebook', undefined, {}],
    ['longform', 'longform', { count: 5, idle: true }],
  ]);
  // a fake runner: twins / audit have nothing to do, the notebook update is skipped, long-form starts
  const tried: string[] = [];
  const fake = {
    start(task: string, _trigger: string, params: Record<string, unknown>) {
      tried.push(`${task}${params.scope ? `:${String(params.scope)}` : ''}`);
      if (task !== 'longform') throw new runner.NothingToDoError(`${task}: nothing`);
      return { id: 'r-1', task, trigger: 'schedule', status: 'running', startedAt: 'now' };
    },
  } as unknown as InstanceType<typeof runner.CoachRunner>;
  const lines: string[] = [];
  const r = await runner.startIdle(fake, 'schedule', many, (l) => lines.push(l), { notebook: async () => ({ status: 'skipped', summary: 'không có lỗi mới' }) });
  assert.equal(r.kind, 'run');
  assert.deepEqual(tried, ['twins', 'verify:audit', 'longform']);
  assert.match(lines.join('\n'), /cập nhật 📒 sổ lỗi: không có lỗi mới/);
  // the notebook as first step with work
  const nb = await runner.startIdle(fake, 'schedule', { ...cfg, coach: { ...cfg.coach, idle_tasks: ['notebook'] } }, () => undefined, { notebook: async () => ({ status: 'success', summary: '3 mục mới' }) });
  assert.deepEqual(nb.kind === 'notebook' && [nb.status, nb.summary], ['success', '3 mục mới']);
  const none = await runner.startIdle(fake, 'schedule', { ...cfg, coach: { ...cfg.coach, idle_tasks: ['twins'] } });
  assert.equal(none.kind, 'none');
});

test('[R3] the twins batch never names a sealed sibling or variant', () => {
  const bank = loadBank();
  const states = new Map<string, QuestionState>();
  const [t] = twins.twinsTargets(bank, states, { ids: ['w-04'], kind: 'surface', sealed: new Set(['w-05']) });
  assert.deepEqual(t.variants, []);
  assert.ok(!t.siblings.includes('w-05'));
  const file = twins.writeTwinsFile('2026-10-20_100000_twins', [t], bank, { count: 1, packFile: 'p-<slug>.md', packId: 'p', idPrefix: 'ai-x-tw' });
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /w-05/);
});

test('[R3] every coach CLI call ignores MCP servers (--strict-mcp-config); a file-mode lock blocks learner bank writes', () => {
  const cfg = loadConfig();
  for (const args of [runner.cliArgs('p', cfg, '2.1.301', 'analyze'), runner.structuredArgs('p', cfg, 'twins'), runner.verifyArgs('p', cfg), runner.groundedArgs('p', cfg)]) {
    assert.ok(args.includes('--strict-mcp-config'), args.join(' '));
    assert.ok(!args.includes('--mcp-config'));
  }
  const lock = path.join(home, 'coach', '.lock');
  assert.equal(runner.bankWriteBlocked(), undefined);
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, runId: 'x_analyze', bankWrites: true }));
  try {
    assert.match(runner.bankWriteBlocked() ?? '', /AI đang sửa ngân hàng trực tiếp \(lượt x_analyze\)/);
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, runId: 'x_enrich' }));
    assert.equal(runner.bankWriteBlocked(), undefined, 'structured runs write through patches with their own pre-images');
  } finally {
    fs.rmSync(lock, { force: true });
  }
});
