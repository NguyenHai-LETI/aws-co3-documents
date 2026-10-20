// [v5] γ2 — qualifier families (4-03): one scenario + shared options + 2–4 final questions with different requirements
// and keys; member drafts carry `family`; focus validation, seeds, batch file; the written pack parses back.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-family-'));
fs.mkdirSync(path.join(home, 'bank', 'packs', 'manual'), { recursive: true });
fs.copyFileSync(path.join(here, '..', 'bank', 'taxonomy.yaml'), path.join(home, 'bank', 'taxonomy.yaml'));
for (const d of ['results', 'coach/runs', 'coach/patches', 'coach/enrich']) fs.mkdirSync(path.join(home, d), { recursive: true });
fs.writeFileSync(path.join(home, 'config.yaml'), 'coach:\n  model: opus\n');
process.env.TRAINER_HOME = home;
after(() => fs.rmSync(home, { recursive: true, force: true }));

fs.writeFileSync(
  path.join(home, 'bank', 'packs', 'manual', 's.md'),
  `---\npack: s-pack\ntitle: S\norigin: manual\n---\n\n# S\n\n## Q s-01\n- domain: cost\n- topic: compute\n- difficulty: medium\n- time: 60\n\nA company runs batch jobs that can be interrupted. Which option is the MOST cost-effective?\n\n- A. Spot Instances\n- B. On-Demand Instances\n- C. Dedicated Hosts\n- D. Reserved Instances for three years\n\n**Answer:** A\n\n**Explanation:** Spot.\n`,
);

const { loadBank } = await import('../server/lib/bank.ts');
const aiOut = await import('../server/lib/ai-output.ts');
const twins = await import('../server/lib/twins.ts');

const EXPL = (x: string) => `${x} is the option that wins under this requirement because the scenario tolerates interruptions and the team is small, so the deciding factor is the one the final question names.\n- The other options: they lose on the requirement this question emphasises.\n> 🇻🇳 Đọc câu hỏi cuối: yêu cầu nào quyết định.`;
const fam = (over: Record<string, unknown> = {}, members?: unknown[]) => ({
  domain: 'cost',
  task: '4.2',
  topic: 'compute',
  services: ['EC2'],
  tags: ['spot-instances'],
  difficulty: 'hard',
  concept: 'cost vs ops',
  refs: ['01-compute-services.md'],
  scenario: 'A media company runs a stateless thumbnail service on Amazon EC2 instances that a small team patches by hand. The service tolerates interruptions and must scale with an unpredictable number of uploads.',
  options: ['Run it on EC2 Spot Instances in an Auto Scaling group', 'Move it to AWS Fargate tasks behind a load balancer', 'Run it on EC2 Reserved Instances managed by the team', 'Run it on EC2 Dedicated Hosts with custom AMIs'],
  members: members ?? [
    { ask: 'cost', question: 'Which solution meets these requirements MOST cost-effectively?', answer: ['A'], explanation: EXPL('Spot capacity'), hint: 'Khối lượng chịu được gián đoạn — mô hình giá nào rẻ nhất?' },
    { ask: 'ops', question: 'Which solution meets these requirements with the LEAST operational overhead?', answer: ['B'], explanation: EXPL('Serverless containers'), hint: 'Ai phải vá và quản lý máy chủ?' },
  ],
  ...over,
});

const ctx = () => {
  const bank = loadBank();
  return { tax: bank.taxonomy, today: '2026-10-20', bank };
};
const idOf = (i: number) => `ai-20261020-0900-fa${String(i + 1).padStart(2, '0')}`;

test('a valid family → one draft per member: stem = scenario + final question, shared options, family id, own key', () => {
  const f = aiOut.familyDrafts(fam(), 'ai-20261020-0900-f1', 0, idOf, ctx());
  assert.deepEqual(f.errors, []);
  assert.deepEqual(f.members.map((m) => [m.id, m.errors]), [
    ['ai-20261020-0900-fa01', []],
    ['ai-20261020-0900-fa02', []],
  ]);
  const [a, b] = f.members.map((m) => m.draft!);
  assert.equal(a.family, 'ai-20261020-0900-f1');
  assert.deepEqual(a.options, b.options);
  assert.match(a.stem, /patches by hand\. .*Which solution meets these requirements MOST cost-effectively\?$/s);
  assert.deepEqual([a.answer, b.answer], [['A'], ['B']]);
  assert.deepEqual(a.variantOf, []);
  assert.equal(a.task, '4.2');
});

test('family rules: 2–4 members, a qualifier in each final question, distinct asks and keys, distinct options', () => {
  const c = ctx();
  const one = aiOut.familyDrafts(fam({}, [fam().members[0]]), 'f', 0, idOf, c);
  assert.match(one.errors.join(' '), /cần 2–4 câu/);
  const sameKey = aiOut.familyDrafts(fam({}, [fam().members[0], { ...(fam().members[1] as object), answer: ['A'] }]), 'f', 0, idOf, c);
  assert.match(sameKey.members[1].errors.join(' '), /cùng đáp án A với câu thứ 1/);
  const sameAsk = aiOut.familyDrafts(fam({}, [fam().members[0], { ...(fam().members[1] as object), ask: 'cost' }]), 'f', 0, idOf, c);
  assert.match(sameAsk.members[1].errors.join(' '), /trùng yêu cầu "cost"/);
  const noQualifier = aiOut.familyDrafts(fam({}, [fam().members[0], { ...(fam().members[1] as object), question: 'Which solution should the company choose?' }]), 'f', 0, idOf, c);
  assert.match(noQualifier.members[1].errors.join(' '), /không nêu yêu cầu/);
  const dupOptions = aiOut.familyDrafts(fam({ options: ['Same option text', 'Same option text', 'Another one here', 'Fourth option'] }), 'f', 0, idOf, c);
  assert.match(dupOptions.errors.join(' '), /hai lựa chọn trùng nhau/);
  assert.match(aiOut.familyDrafts('x', 'f', 0, idOf, c).errors[0], /object/);
});

test('written family pack parses back with `family` on every member', () => {
  const bank = loadBank();
  const plan = aiOut.planPack({ kind: 'family', runId: '2026-10-20_090000_family', today: '2026-10-20', idPrefix: 'ai-20261020-0900-fa', packId: 'ai-2026-10-20-0900-family' }, { pack: { slug: 'compute', title: 'Compute' } }, bank);
  const f = aiOut.familyDrafts(fam(), plan.familyOf(0), 0, plan.idOf, ctx());
  for (const m of f.members) assert.deepEqual(aiOut.checkDraft(m.draft!, plan, bank).errors, []);
  const rel = aiOut.writePack(plan, f.members.map((m) => m.draft!));
  const qs = loadBank().questions.filter((q) => q.file === rel);
  assert.deepEqual(qs.map((q) => [q.id, q.family]), [
    ['ai-20261020-0900-fa01', 'ai-20261020-0900-f1'],
    ['ai-20261020-0900-fa02', 'ai-20261020-0900-f1'],
  ]);
});

test('family focus, seeds and batch file', () => {
  const bank = loadBank();
  assert.deepEqual(twins.familyFocus({ topic: 'compute', requirement: 'cost' }, bank), { topic: 'compute', task: undefined, requirement: 'cost' });
  assert.throws(() => twins.familyFocus({ requirement: 'cheap' }, bank), /requirement "cheap"/);
  assert.throws(() => twins.familyFocus({ task: '9.9' }, bank), /task "9.9"/);
  const seeds = twins.familySeeds(bank, { requirement: 'cost' }, new Set());
  assert.ok(seeds.some((q) => q.id === 's-01'));
  assert.deepEqual(twins.familySeeds(bank, { requirement: 'cost' }, new Set(['s-01'])).map((q) => q.id).includes('s-01'), false, 'never a sealed seed');
  const file = twins.writeFamilyFile('2026-10-20_090000_family', bank, { count: 2, packFile: 'p-<slug>.md', packId: 'p', idPrefix: 'ai-x-fa', familyPrefix: 'ai-x-f' }, { requirement: 'cost' }, seeds, [
    { key: 'cost', label: 'Chi phí', attempts: 10, correct: 5, accuracy: 50, questions: 5, bank: 9, avgTime: 30, avgEst: 40, verdict: 'below' },
  ]);
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^kind: family-batch$/m);
  assert.match(text, /yêu cầu phải có trong mỗi họ: `cost`/);
  assert.match(text, /Chi phí: 5\/10 đúng \(50%\) · yếu \(có bằng chứng\)/);
  assert.match(text, /`s-01` \(cost\)/);
});
