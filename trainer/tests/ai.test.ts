// AI pipeline tests: patches, ENRICH batches, coach-runner policy, "Hỏi AI" log, scheduler text. Run: npm test
// Everything runs against a temporary TRAINER_HOME (no Claude Code call is ever made).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage } from 'node:http';
import type { CoachEvent, CoachRunInfo, QuestionState } from '../shared/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-ai-'));
fs.mkdirSync(path.join(home, 'bank', 'packs', 'manual'), { recursive: true });
fs.copyFileSync(path.join(here, '..', 'bank', 'taxonomy.yaml'), path.join(home, 'bank', 'taxonomy.yaml'));
for (const d of ['results', 'coach/runs', 'coach/qa', 'coach/patches', 'coach/enrich']) fs.mkdirSync(path.join(home, d), { recursive: true });
fs.writeFileSync(path.join(home, 'config.yaml'), 'coach:\n  model: opus\n  models: { enrich: sonnet, ask: haiku }\n  hosts: [build-box]\n');
process.env.TRAINER_HOME = home;
delete process.env.TRAINER_ALLOW_COACH;
after(() => fs.rmSync(home, { recursive: true, force: true }));

const { loadConfig } = await import('../server/config.ts');
const { loadBank } = await import('../server/lib/bank.ts');
const { applyPatch, findBlock } = await import('../server/lib/patch.ts');
const enrich = await import('../server/lib/enrich.ts');
const runner = await import('../server/lib/coach-runner.ts');
const ask = await import('../server/lib/ask.ts');
const sched = await import('../scripts/schedule.ts');

const PACK = path.join(home, 'bank', 'packs', 'manual', 't.md');
const PACK_TEXT = `---
pack: t-pack
title: Test pack
origin: manual
---

# Test pack

Intro text that must survive patches.

## Q t-01
- domain: resilient
- topic: database
- services: RDS
- tags: multi-az
- difficulty: medium
- time: 60

A database must fail over automatically when an Availability Zone fails, without application changes. Which feature should be used?

- A. Read Replicas in another AZ
- B. Multi-AZ deployment
- C. Cross-Region snapshots
- D. Aurora Global Database

**Answer:** B

**Explanation:** Multi-AZ = automatic failover.

---

## Q t-02
- domain: performance
- topic: storage
- difficulty: easy
- time: 45

Which storage gives shared POSIX file access to many Linux instances in several AZs?

- A. EBS
- B. Amazon EFS with mount targets in each Availability Zone
- C. S3
- D. Instance store

**Answer:** B

**Explanation:** EFS is shared.

---

## Q t-03
- domain: secure
- topic: security
- difficulty: hard
- time: 90

A company must encrypt data at rest and audit every key use. Which TWO actions meet the requirement? (Choose TWO)

- A. Use AWS KMS customer managed keys
- B. Review key usage in AWS CloudTrail
- C. Use AWS Certificate Manager certificates
- D. Use IAM credential reports
- E. Use Amazon Macie

**Answer:** A, B

**Explanation:** KMS keys plus CloudTrail logging.

---

## Q t-04
- domain: cost
- topic: compute
- difficulty: medium
- time: 90
- variant_of: t-03

A media company runs a nightly batch job on Amazon EC2 instances that transcodes video files uploaded during the day. The job can be interrupted and restarted at any time without data loss, and it must finish before the next morning. The finance team wants to reduce compute costs as much as possible while keeping the current instance types and avoiding long-term commitments. Which purchasing option meets these requirements?

- A. Use Spot Instances with a diversified allocation strategy
- B. Purchase Standard Reserved Instances for one year term
- C. Buy a Compute Savings Plan for a three year period
- D. Use Dedicated Hosts billed on demand for each server

**Answer:** A

**Explanation:** Interruptible + cheapest + no commitment = Spot Instances.

---

## Q t-05
- domain: cost
- topic: storage
- difficulty: easy
- time: 45
- status: retired

Old retired question about storage classes for archives?

- A. S3 Glacier Deep Archive
- B. S3 Standard
- C. EBS gp3
- D. EFS Standard

**Answer:** A

**Explanation:** Deep Archive is cheapest.
`;

function resetPack(): void {
  fs.writeFileSync(PACK, PACK_TEXT);
  for (const f of fs.readdirSync(path.join(home, 'coach', 'patches'))) fs.rmSync(path.join(home, 'coach', 'patches', f));
}

function writePatch(name: string, yaml: string): string {
  const file = path.join(home, 'coach', 'patches', `${name}.yaml`);
  fs.writeFileSync(file, yaml);
  return file;
}

const hashOf = (id: string) => loadBank().byId.get(id)!.hash;
const TODAY = '2026-10-16';
const GOOD_EXPLANATION = [
  'Multi-AZ keeps a synchronous standby in another Availability Zone and fails over automatically behind the same endpoint, so no application change is needed.',
  '- Read Replicas in another AZ: asynchronous copies for read scaling; promotion is manual.',
  '- Cross-Region snapshots: restore is slow and manual.',
  '> 🇻🇳 Mất AZ + failover tự động → Multi-AZ.',
].join('\n');
const indent = (s: string) => s.split('\n').map((l) => `      ${l}`).join('\n');

// ── patch ───────────────────────────────────────────────────────────────────

test('patch: applies explanation, metadata and options; keeps the rest of the pack; re-run is idempotent', () => {
  resetPack();
  const file = writePatch(
    'p1',
    `run_id: p1
items:
  - id: t-01
    base: ${hashOf('t-01')}
    set: { task: "2.2", concept: "RDS Multi-AZ vs Read Replica", hint: "Đề cần failover tự động khi mất một AZ — cơ chế nào giữ bản sao đồng bộ?" }
    explanation: |
${indent(GOOD_EXPLANATION)}
  - id: t-02
    base: ${hashOf('t-02')}
    options: { A: "Amazon EBS Multi-Attach volumes in one AZ", C: "Amazon S3 buckets mounted with a FUSE driver" }
  - id: t-03
    base: ${hashOf('t-03')}
`,
  );
  const r = applyPatch(file, { today: TODAY });
  assert.equal(r.error, undefined);
  assert.deepEqual(
    r.items.map((i) => [i.id, i.status]),
    [
      ['t-01', 'applied'],
      ['t-02', 'applied'],
      ['t-03', 'applied'],
    ],
  );
  const text = fs.readFileSync(PACK, 'utf8');
  assert.ok(text.startsWith('---\npack: t-pack\ntitle: Test pack\norigin: manual\n---\n\n# Test pack\n\nIntro text that must survive patches.\n\n## Q t-01\n'));
  assert.ok(text.includes('\n---\n\n## Q t-02\n'), 'separators are kept');
  const bank = loadBank();
  const q1 = bank.byId.get('t-01')!;
  assert.equal(q1.task, '2.2');
  assert.equal(q1.enriched, TODAY);
  assert.equal(q1.explanation, GOOD_EXPLANATION);
  assert.match(q1.hint ?? '', /^Đề cần failover/);
  const q2 = bank.byId.get('t-02')!;
  assert.equal(q2.options[0].text, 'Amazon EBS Multi-Attach volumes in one AZ');
  assert.deepEqual(q2.answer, ['B']);
  assert.notEqual(q2.hash, r.items[1].hash === q2.hash ? '' : q2.hash);
  assert.equal(bank.byId.get('t-03')!.enriched, TODAY, 'a bare item marks the question as reviewed');
  assert.equal(bank.byId.get('t-04')!.enriched, undefined);
  assert.deepEqual(bank.problems.filter((p) => p.level === 'error'), []);

  // re-running the same patch (t-02's base no longer matches) is recognised through the ledger
  const again = applyPatch(file, { today: TODAY });
  assert.deepEqual(again.items.map((i) => i.status), ['unchanged', 'unchanged', 'unchanged']);
  assert.equal(fs.readFileSync(PACK, 'utf8'), text);
});

test('patch: failing items are reverted and reported, valid items still apply', () => {
  resetPack();
  const before = fs.readFileSync(PACK, 'utf8');
  const file = writePatch(
    'p2',
    `run_id: p2
items:
  - id: t-01
    base: ${hashOf('t-01')}
    explanation: |
      Option B is right because Multi-AZ fails over automatically to a synchronous standby in another zone.
  - id: t-02
    base: ${hashOf('t-02')}
    options: { F: "nope" }
  - id: t-03
    base: ${hashOf('t-03')}
    set: { task: "4.1" }
  - id: t-04
    base: ${hashOf('t-04')}
    answer: [B]
  - id: t-05
    base: 0000000000
    set: { hint: "x" }
  - id: missing-01
    base: abc
  - id: t-01
    base: ${hashOf('t-01')}
`,
  );
  const r = applyPatch(file, { today: TODAY });
  const by = Object.fromEntries(r.items.map((i, n) => [`${i.id}#${n}`, i]));
  assert.equal(by['t-01#0'].status, 'failed');
  assert.match(by['t-01#0'].errors.join(' '), /chữ cái/);
  assert.match(by['t-02#1'].errors.join(' '), /không có lựa chọn F/);
  assert.match(by['t-03#2'].errors.join(' '), /task 4\.1 thuộc domain cost/);
  assert.match(by['t-04#3'].errors.join(' '), /reason/);
  assert.equal(by['t-05#4'].status, 'skipped');
  assert.match(by['missing-01#5'].errors.join(' '), /không tồn tại/);
  assert.match(by['t-01#6'].errors.join(' '), /lặp lại/);
  assert.equal(r.applied, 0);
  assert.equal(r.failed, 6);
  assert.equal(r.skipped, 1);
  assert.equal(fs.readFileSync(PACK, 'utf8'), before, 'nothing written when every item fails');

  const reveal = writePatch('p2b', `items:\n  - id: t-02\n    base: ${hashOf('t-02')}\n    set: { hint: "Chọn Amazon EFS with mount targets in each Availability Zone" }\n`);
  assert.match(applyPatch(reveal).items[0].errors.join(' '), /lộ đáp án/);

  const bad = writePatch('p3', 'items: [ { id: t-01, base: x\n');
  assert.match(applyPatch(bad).error ?? '', /YAML/);
});

test('patch: answer fix with reason, status-only retire, dry run', () => {
  resetPack();
  const file = writePatch(
    'p4',
    `items:
  - id: t-04
    base: ${hashOf('t-04')}
    answer: [A]
    stem: |
      A media company runs an interruptible nightly batch job on Amazon EC2. Which purchasing option is the MOST cost-effective without commitments?
  - id: t-02
    base: ${hashOf('t-02')}
    status: retired
`,
  );
  const dry = applyPatch(file, { dryRun: true, today: TODAY });
  assert.deepEqual(dry.items.map((i) => i.status), ['applied', 'applied']);
  assert.equal(fs.readFileSync(PACK, 'utf8'), PACK_TEXT, 'dry run writes nothing');

  const r = applyPatch(file, { today: TODAY });
  assert.deepEqual(r.items.map((i) => i.status), ['applied', 'applied']);
  const bank = loadBank();
  assert.match(bank.byId.get('t-04')!.stem, /interruptible nightly batch/);
  assert.equal(bank.byId.get('t-04')!.enriched, TODAY);
  assert.equal(bank.byId.get('t-02')!.status, 'retired');
  assert.equal(bank.byId.get('t-02')!.enriched, undefined, 'status-only items do not count as enrichment');

  const withAnswer = writePatch('p5', `items:\n  - id: t-01\n    base: ${hashOf('t-01')}\n    answer: [A]\n    reason: "test"\n`);
  const r2 = applyPatch(withAnswer, { today: TODAY });
  assert.equal(r2.items[0].status, 'applied');
  assert.deepEqual(loadBank().byId.get('t-01')!.answer, ['A']);
});

test('patch: an item prepared before an answer-position migration is re-keyed (or skipped when the hash does not match)', () => {
  resetPack();
  const oldBase = hashOf('t-02');
  const file = writePatch(
    'p6',
    `items:
  - id: t-02
    base: ${oldBase}
    options: { A: "Amazon EBS Multi-Attach volumes attached in one Availability Zone" }
    explanation: |
      Amazon EFS is a regional, shared NFS file system that many Linux instances in several Availability Zones can mount at the same time.
      - EBS Multi-Attach volumes: limited to one AZ and not a shared POSIX file system.
      - Amazon S3 buckets: object storage, not a POSIX file system.
      > 🇻🇳 File system dùng chung nhiều AZ → EFS.
  - id: t-01
    base: 0123456789
`,
  );
  // simulate the rebalance: options re-lettered (old → new: A→C, B→D, C→A, D→B) + migration record
  const relettered = PACK_TEXT.replace(
    '- A. EBS\n- B. Amazon EFS with mount targets in each Availability Zone\n- C. S3\n- D. Instance store\n\n**Answer:** B',
    '- A. S3\n- B. Instance store\n- C. EBS\n- D. Amazon EFS with mount targets in each Availability Zone\n\n**Answer:** D',
  );
  assert.notEqual(relettered, PACK_TEXT);
  fs.writeFileSync(PACK, relettered);
  const migDir = path.join(home, 'bank', 'migrations');
  fs.mkdirSync(migDir, { recursive: true });
  fs.writeFileSync(
    path.join(migDir, '2026-10-16-rebalance-answers.json'),
    JSON.stringify({ id: '2026-10-16-rebalance-answers', applied: '2026-10-16T12:00:00+07:00', kind: 'rebalance-answers', questions: { 't-02': { A: 'C', B: 'D', C: 'A', D: 'B' } } }),
  );
  try {
    assert.notEqual(hashOf('t-02'), oldBase);
    const r = applyPatch(file, { today: TODAY });
    assert.equal(r.items[0].status, 'applied');
    assert.match(r.items[0].warnings.join(' '), /bố cục đáp án cũ \(2026-10-16-rebalance-answers\) — đã đổi khoá A→C/);
    assert.ok(r.items[0].changes.includes('options C'), r.items[0].changes.join(', '));
    const q = loadBank().byId.get('t-02')!;
    assert.equal(q.options[2].text, 'Amazon EBS Multi-Attach volumes attached in one Availability Zone');
    assert.equal(q.options[0].text, 'S3');
    assert.deepEqual(q.answer, ['D']);
    assert.equal(r.items[1].status, 'skipped', 'a hash that no migration explains is still skipped');
    assert.match(r.items[1].errors.join(' '), /đổi vị trí đáp án/);
  } finally {
    fs.rmSync(migDir, { recursive: true, force: true });
  }
});

test('findBlock stops before separators and the next heading', () => {
  const lines = PACK_TEXT.split('\n');
  const b = enrich && findBlock(lines, 't-02');
  assert.ok(b);
  assert.equal(lines[b!.start], '## Q t-02');
  assert.equal(lines[b!.end - 1], '**Explanation:** EFS is shared.');
  assert.equal(findBlock(lines, 'nope'), undefined);
});

// ── ENRICH selection, batch files, status ───────────────────────────────────

const state = (id: string, attempts: number, correct: number): QuestionState => ({
  id,
  attempts,
  correct,
  everWrong: correct < attempts,
  streak: 0,
  box: 1,
  avgTime: 30,
  slowCount: 0,
  wrongPicks: correct < attempts ? { A: attempts - correct } : {},
  lastOk: correct === attempts,
});

test('enrich: pending todos and batch priority (wrong > seen > unseen, then exam weight); retired skipped', () => {
  resetPack();
  const bank = loadBank();
  assert.deepEqual(enrich.pendingTodos(bank.byId.get('t-02')!), ['explain', 'hint', 'classify', 'balance']);
  assert.deepEqual(enrich.pendingTodos(bank.byId.get('t-01')!), ['explain', 'hint', 'classify']);
  const states = new Map([
    ['t-02', state('t-02', 2, 1)],
    ['t-01', state('t-01', 1, 1)],
  ]);
  assert.deepEqual(
    enrich.selectBatch(bank, states, { size: 10 }).map((i) => [i.q.id, i.tier]),
    [
      ['t-02', 'wrong'],
      ['t-01', 'seen'],
      ['t-03', 'unseen'], // secure 30 % before cost 20 %
      ['t-04', 'unseen'],
    ],
  );
  assert.deepEqual(enrich.selectBatch(bank, states, { size: 2 }).map((i) => i.q.id), ['t-02', 't-01']);
  assert.deepEqual(enrich.selectBatch(bank, states, { tasks: ['balance'] }).map((i) => [i.q.id, i.todo]), [['t-02', ['balance']]]);
  assert.deepEqual(enrich.selectBatch(bank, states, { tasks: 'hint,2.2' }), [], 'exam-task filter: nobody has task 2.2 yet');
  assert.deepEqual(enrich.parseTasks('explain, 3.1, bogus'), { todos: ['explain'], examTasks: ['3.1'] });

  const st = enrich.enrichStatus(bank, []);
  assert.equal(st.total, 4);
  assert.equal(st.enriched, 0);
  assert.deepEqual(st.pending, { explain: 4, hint: 4, classify: 4, balance: 1 });
  assert.equal(st.longForm, 1);
  assert.equal(st.lastRun, undefined);
});

test('enrich: batch file lists base hashes, todo and a patch skeleton; long-form targets skip covered questions', () => {
  resetPack();
  const bank = loadBank();
  const states = new Map([['t-02', state('t-02', 3, 0)]]);
  const items = enrich.selectBatch(bank, states, { size: 2 });
  const attempts = [
    { answers: [{ q: 't-02', pick: 'A', key: 'B', ok: false, t: 20, est: 45, why: 'Tưởng   EBS dùng chung được' }] },
    { answers: [{ q: 't-02', pick: 'C', key: 'B', ok: false, t: 20, est: 45, why: 'S3 mount được' }, { q: 't-03', pick: 'A', key: 'AB', ok: false, t: 9, est: 90, why: 'không liên quan' }] },
  ] as unknown as Parameters<typeof enrich.learnerNotes>[0];
  const notes = enrich.learnerNotes(attempts, ['t-02', 't-01']);
  assert.deepEqual(notes.get('t-02'), ['đã chọn C (đúng: B): “S3 mount được”', 'đã chọn A (đúng: B): “Tưởng EBS dùng chung được”']);
  assert.equal(notes.has('t-03'), false);
  const file = enrich.writeBatchFile('2026-10-16_120000_enrich', items, bank, { notes });
  assert.equal(file, path.join(home, 'coach', 'enrich', '2026-10-16_120000_enrich-batch.md'));
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^---\nkind: enrich-batch\nrun_id: 2026-10-16_120000_enrich\n/);
  assert.ok(text.includes(`- base: \`${bank.byId.get('t-02')!.hash}\``));
  assert.ok(text.includes(`  - id: t-02        # explain, hint, classify, balance\n    base: ${bank.byId.get('t-02')!.hash}`));
  assert.match(text, /người học: sai 3\/3 lượt · đã chọn sai: A×3/);
  assert.match(text, /- B\. Amazon EFS with mount targets in each Availability Zone {2}⟨\d+⟩ {2}✅/);
  assert.match(text, /`2\.2` \(resilient\)/);
  assert.match(text, /- 🗣️ người học đã chọn C \(đúng: B\): “S3 mount được” → giải thích phải gỡ đúng hiểu lầm này/);

  const targets = enrich.longformTargets(bank, states, 5);
  // t-03 already has a long-form variant (t-04), t-04 is long-form, t-05 is retired
  assert.deepEqual(targets.map((t) => t.q.id), ['t-02', 't-01']);
  const lf = enrich.writeLongformFile('2026-10-16_120000_longform', targets, bank, {
    count: 2,
    packFile: 'trainer/bank/packs/ai/2026-10-16-1200-longform-<slug>.md',
    packId: 'ai-2026-10-16-1200-longform',
    idPrefix: 'ai-20261016-1200-lf',
  });
  assert.match(fs.readFileSync(lf, 'utf8'), /id câu `ai-20261016-1200-lf01`/);
});

// ── coach runner policy, costs, CLI discovery ───────────────────────────────

test('coach runner: refused on a TRAINER_HOME copy, per-task models and least-privilege tools', async () => {
  assert.match(runner.coachGuard() ?? '', /TRAINER_HOME/);
  assert.throws(() => runner.coachRunner.start('enrich', 'cli', {}), /TRAINER_HOME/);
  const cfg = loadConfig();
  assert.deepEqual(runner.resolvedModels(cfg), { analyze: 'opus', generate: 'opus', enrich: 'sonnet', ask: 'haiku' });
  assert.equal(runner.modelFor('longform', cfg), 'sonnet');

  const args = runner.cliArgs('PROMPT', cfg, '2.1.301 (Claude Code)', 'enrich');
  assert.deepEqual(args.slice(0, 2), ['-p', 'PROMPT']);
  assert.ok(args.includes('--permission-prompts'));
  assert.equal(args[args.indexOf('--model') + 1], 'sonnet');
  assert.ok(args.includes('Bash(node trainer/scripts/apply-patch.ts:*)'));
  assert.ok(args.includes('Edit(trainer/coach/patches/**)'));
  assert.ok(!args.includes('Edit(trainer/bank/**)'), 'enrich edits packs only through apply-patch');
  assert.ok(!runner.cliArgs('P', cfg, '2.1.100', 'analyze').includes('--permission-prompts'));
  assert.ok(runner.allowedTools('longform').includes('Write(trainer/bank/packs/ai/**)'));
  assert.ok(runner.allowedTools('analyze').includes('Bash(node trainer/scripts/apply-patch.ts:*)'));

  assert.match(runner.buildPrompt('enrich', 'r1', 'cli', { batch: 'trainer/coach/enrich/r1-batch.md', size: 5, patch: 'trainer/coach/patches/r1.yaml' }), /ENRICH\.md[\s\S]*r1-batch\.md[\s\S]*apply-patch\.ts trainer\/coach\/patches\/r1\.yaml/);
  assert.match(runner.buildPrompt('longform', 'r2', 'cli', { batch: 'b.md', count: 2, packFile: 'p.md', packId: 'ai-x', idPrefix: 'ai-1-lf' }), /phần \*\*B[\s\S]*ai-1-lf01/);

  // the HTTP layer maps refusals / bad input to 4xx
  await import('../server/routes/ai.ts');
  const { routes } = await import('../server/http.ts');
  const call = async (method: string, url: string, body?: unknown) => {
    const u = new URL(url, 'http://localhost');
    const r = routes.find((x) => x.method === method && x.re.test(u.pathname))!;
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
    return r.fn(req, u, u.pathname.match(r.re)!.slice(1));
  };
  await assert.rejects(() => call('POST', '/api/coach/run', { task: 'bogus' }) as Promise<unknown>, (e: Error & { status?: number }) => e.status === 400);
  await assert.rejects(() => call('POST', '/api/coach/run', { task: 'enrich', params: { size: 5 } }) as Promise<unknown>, (e: Error & { status?: number }) => e.status === 409);
  await assert.rejects(() => call('POST', '/api/ask', { qid: 'nope', question: 'Vì sao?' }) as Promise<unknown>, (e: Error & { status?: number }) => e.status === 400);
  await assert.rejects(() => call('POST', '/api/ask', { qid: 't-01', question: 'Vì sao?' }) as Promise<unknown>, (e: Error & { status?: number }) => e.status === 409);
  const status = (await call('GET', '/api/enrich/status')) as { total: number };
  assert.equal(status.total, 4);
  assert.deepEqual(await call('GET', '/api/qa/t-01'), []);
});

test('coach runner: hosts, daily schedule cap and cost summary', () => {
  const cfg = loadConfig();
  assert.equal(runner.hostAllowed(cfg, 'Build-Box.local'), true);
  assert.equal(runner.hostAllowed(cfg, 'other-mac'), false);
  assert.equal(runner.hostAllowed({ ...cfg, coach: { ...cfg.coach, hosts: [] } }, 'anything'), true);

  const now = new Date();
  const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19) + '+00:00';
  const run = (id: string, task: CoachRunInfo['task'], trigger: CoachRunInfo['trigger'], daysAgo: number, cost?: number, status: CoachRunInfo['status'] = 'success'): CoachRunInfo => ({
    id,
    task,
    trigger,
    status,
    startedAt: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
    costUsd: cost,
  });
  const runs = [
    run('a', 'enrich', 'schedule', 0, 0.2),
    run('b', 'analyze', 'schedule', 0, 0.5),
    run('c', 'analyze', 'manual', 0, 0.4),
    run('d', 'longform', 'schedule', 2, 0.1),
    run('e', 'enrich', 'schedule', 40, 9),
    run('f', 'analyze', 'schedule', 0, undefined, 'skipped'),
  ];
  assert.ok(iso(now));
  assert.equal(runner.scheduledRunsToday(runs, now), 2);

  ask.appendQa('t-01', { at: new Date(now.getTime() - 86400000).toISOString(), question: 'Q?', answer: 'A.', costUsd: 0.05 });
  const c = runner.costSummary(30, runs);
  assert.equal(c.runs, 4);
  assert.deepEqual(c.byTask, { enrich: { runs: 1, costUsd: 0.2 }, analyze: { runs: 2, costUsd: 0.9 }, longform: { runs: 1, costUsd: 0.1 } });
  assert.deepEqual(c.asks, { count: 1, costUsd: 0.05 });
  assert.equal(c.costUsd, 1.25);
  fs.rmSync(path.join(home, 'coach', 'qa', 't-01.md'));
});

test('CLI discovery helpers: npm .cmd shims resolve to the JS entry run by node', () => {
  const shim = [
    '@ECHO off',
    'IF EXIST "%dp0%\\node.exe" (',
    '  SET "_prog=%dp0%\\node.exe"',
    ')',
    'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*',
  ].join('\r\n');
  assert.equal(runner.shimTarget(shim), 'node_modules\\@anthropic-ai\\claude-code\\cli.js');
  assert.equal(runner.shimTarget('"%~dp0\\node_modules\\x\\bin\\claude.exe" %*'), 'node_modules\\x\\bin\\claude.exe');
  assert.equal(runner.shimTarget('echo nothing'), undefined);
  assert.deepEqual(runner.claudeCommand('/x/cli.js'), { cmd: process.execPath, pre: ['/x/cli.js'] });
  assert.deepEqual(runner.claudeCommand('/usr/local/bin/claude'), { cmd: '/usr/local/bin/claude', pre: [] });
  const dir = fs.mkdtempSync(path.join(home, 'npm-'));
  fs.mkdirSync(path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'), '');
  fs.writeFileSync(path.join(dir, 'claude.cmd'), shim);
  assert.equal(runner.resolveCandidate(path.join(dir, 'claude.cmd')), path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'));
  assert.equal(runner.versionAtLeast('2.1.259 (Claude Code)', [2, 1, 259]), true);
  assert.equal(runner.versionAtLeast('2.0.99', [2, 1, 259]), false);
});

// ── "Hỏi AI" ────────────────────────────────────────────────────────────────

test('ask: prompt names options by content, Q&A log round-trips (even with "-->" and "---"), snapshot section', () => {
  resetPack();
  const bank = loadBank();
  const q = bank.byId.get('t-01')!;
  assert.equal(ask.normalizePick('ad z', q), 'AD');
  const prompt = ask.buildAskPrompt(q, 'Vì sao không phải Read Replica?', 'A', bank);
  assert.match(prompt, /KHÔNG dùng chữ cái/);
  assert.match(prompt, /- \[A\] Read Replicas in another AZ {2}← người học đã chọn/);
  assert.match(prompt, /- \[B\] Multi-AZ deployment {2}✅ đáp án đúng/);
  assert.match(prompt, /Người học đã chọn: “Read Replicas in another AZ” \(sai\)/);
  assert.match(prompt, /03-database-services\.md/);
  const args = ask.askArgs(prompt, loadConfig(), '2.1.301');
  assert.deepEqual(args.slice(0, 4), ['-p', prompt, '--output-format', 'json']);
  assert.equal(args[args.indexOf('--model') + 1], 'haiku');
  assert.ok(args.includes('--tools') && !args.some((a) => /^(Edit|Write|Bash)/.test(a)));

  assert.deepEqual(ask.parseCliJson('{"type":"result","result":"ok","total_cost_usd":0.01}'), { type: 'result', result: 'ok', total_cost_usd: 0.01 });
  assert.equal(ask.parseCliJson('[{"type":"system"},{"type":"result","result":"x"}]')?.result, 'x');

  ask.appendQa('t-01', { at: '2026-10-16T10:00:00+07:00', question: 'Line 1 --> tricky\nLine 2', answer: 'Answer with\n---\nseparator', pick: 'A', costUsd: 0.02 });
  ask.appendQa('t-01', { at: '2026-10-16T11:00:00+07:00', question: 'Second?', answer: '**Bold** answer.' });
  const qa = ask.loadQa('t-01');
  assert.equal(qa.length, 2);
  assert.deepEqual(qa[0], { at: '2026-10-16T10:00:00+07:00', question: 'Line 1 --> tricky\nLine 2', answer: 'Answer with\n---\nseparator', pick: 'A', costUsd: 0.02 });
  assert.equal(qa[1].answer, '**Bold** answer.');
  assert.deepEqual(ask.loadQa('../etc/passwd'), []);
  const lines = ask.qaSnapshotLines(bank).join('\n');
  assert.match(lines, /^## 15\. Câu người học hỏi AI/);
  assert.match(lines, /`t-01` \(database · RDS\) — ❓ Second\? → 💡 Bold answer\./);
  assert.match(lines, /đã chọn A ✗/);
  assert.deepEqual(ask.askCostsSince(Date.parse('2026-10-16T00:00:00+07:00')), { count: 2, costUsd: 0.02 });
  fs.rmSync(path.join(home, 'coach', 'qa', 't-01.md'));
  assert.deepEqual(ask.qaSnapshotLines(bank), ['## 15. Câu người học hỏi AI (`trainer/coach/qa/`)', '', '_Chưa có._', '']);
});

// ── scheduler text (pure functions) ─────────────────────────────────────────

test('schedule: times, launchd plist, crontab block merge, Windows tasks', () => {
  const { times, invalid } = sched.parseTimes(['21:00', '8:30', '08:30', '25:00', 'x']);
  assert.deepEqual(times.map((t) => t.hhmm), ['08:30', '21:00']);
  assert.deepEqual(invalid, ['25:00', 'x']);
  const spec = { node: '/opt/node/bin/node', script: '/r/trainer/scripts/coach-run.ts', repo: '/r', log: '/r/trainer/coach/runs/launchd.log', times };
  const plist = sched.plistXml({ ...spec, home: '/Users/me' });
  assert.match(plist, /<key>Label<\/key><string>com\.saa-trainer\.coach<\/string>/);
  assert.match(plist, /<dict><key>Hour<\/key><integer>8<\/integer><key>Minute<\/key><integer>30<\/integer><\/dict>/);
  assert.match(plist, /<string>--trigger<\/string>\n {4}<string>schedule<\/string>/);
  assert.match(plist, /<key>PATH<\/key><string>\/opt\/node\/bin:\/opt\/homebrew\/bin/);

  const block = sched.cronBlock({ ...spec, repo: "/it's here", log: '/r/50%.log' });
  assert.match(block, /^30 8 \* \* \* cd '\/it'\\''s here' && PATH='\/opt\/node\/bin:/m);
  assert.match(block, /'\/r\/50\\%\.log' 2>&1$/m);
  const existing = 'MAILTO=""\n0 1 * * * /usr/bin/backup\n';
  const once = sched.mergeCrontab(existing, block);
  assert.equal(sched.mergeCrontab(once, block), once, 'install twice = one block');
  assert.equal(once.split(sched.CRON_BEGIN).length, 2);
  assert.equal(sched.mergeCrontab(once, null), existing);
  assert.equal(sched.mergeCrontab('', null), '');

  const tasks = sched.windowsTasks('C:\\Users\\Me Too\\trainer\\coach\\runs\\coach-schedule.cmd', times);
  assert.deepEqual(tasks.map((t) => t.name), ['SAA-Trainer-Coach-0830', 'SAA-Trainer-Coach-2100']);
  assert.deepEqual(tasks[0].args.slice(0, 8), ['/Create', '/F', '/SC', 'DAILY', '/ST', '08:30', '/TN', 'SAA-Trainer-Coach-0830']);
  assert.equal(tasks[0].args[9], '"C:\\Users\\Me Too\\trainer\\coach\\runs\\coach-schedule.cmd"');
  const wrapper = sched.windowsWrapper({ node: 'C:\\node\\node.exe', script: 'C:\\r\\trainer\\scripts\\coach-run.ts', repo: 'C:\\r', log: 'C:\\r\\50%.log' });
  assert.match(wrapper, /cd \/d "C:\\r"\r\n"C:\\node\\node\.exe" "C:\\r\\trainer\\scripts\\coach-run\.ts" --trigger schedule >> "C:\\r\\50%%\.log" 2>&1\r\n$/);
  assert.deepEqual(
    sched.parseSchtasksCsv('"\\Microsoft\\Other","N/A","Ready"\r\n"\\SAA-Trainer-Coach-0830","10/17/2026 8:30:00 AM","Ready"\r\n'),
    [{ name: 'SAA-Trainer-Coach-0830', next: '10/17/2026 8:30:00 AM', status: 'Ready' }],
  );
});

// ── coach runner: CLI errors + automatic retry, against a fake CLI (no Claude call) ──

// Stand-in for the Claude Code CLI: --version, auth status, and a stream-json run whose outcome depends on
// FAKE_CLAUDE_MODE and how many runs it has served (FAKE_CLAUDE_COUNT). Error results mirror a real
// coach/runs/*.raw.jsonl: subtype "success" with is_error: true and the reason in `result`.
const FAKE_CLI = `
import fs from 'node:fs';
const argv = process.argv.slice(2);
const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
const RACE = 'Failed to refresh OAuth token: another Claude Code process is refreshing it or exited mid-refresh. This is usually transient; retry in a minute, and if it persists close other Claude Code processes or sign in again';
const fail = (text) => {
  out({ type: 'assistant', message: { content: [{ type: 'text', text }] }, error: 'server_error', is_api_error_message: true });
  out({ type: 'result', subtype: 'success', is_error: true, result: text, total_cost_usd: 0, num_turns: 1 });
  process.exitCode = 1;
};
if (argv[0] === '--version') console.log('2.1.282 (Claude Code)');
else if (argv[0] === 'auth') console.log(JSON.stringify({ loggedIn: true }));
else {
  const file = process.env.FAKE_CLAUDE_COUNT;
  const n = (fs.existsSync(file) ? Number(fs.readFileSync(file, 'utf8')) : 0) + 1;
  fs.writeFileSync(file, String(n));
  const mode = process.env.FAKE_CLAUDE_MODE;
  out({ type: 'system', subtype: 'init', model: 'claude-fake', permissionMode: 'dontAsk' });
  if (mode === 'race-after-tool') {
    out({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'x.md' } }] } });
    fail(RACE);
  } else if (mode === 'limit') fail('Claude AI usage limit reached|1760000000');
  else if (mode === 'race' || (mode === 'race-then-ok' && n === 1)) fail(RACE);
  else out({ type: 'result', subtype: 'success', is_error: false, result: 'Đã viết kế hoạch', total_cost_usd: 0.01, num_turns: 3 });
}
`;

test('coach runner: login race → one automatic retry; errors show the CLI message, not "success"', async () => {
  const fake = path.join(home, 'fake-claude.mjs');
  const count = path.join(home, 'fake-claude.count');
  fs.writeFileSync(fake, FAKE_CLI);
  Object.assign(process.env, { CLAUDE_BIN: fake, TRAINER_ALLOW_COACH: '1', FAKE_CLAUDE_COUNT: count });
  const delay = runner.RETRY.delayMs;
  runner.RETRY.delayMs = 20;
  const run = (mode: string, onEvent?: (ev: CoachEvent) => void) => {
    process.env.FAKE_CLAUDE_MODE = mode;
    fs.rmSync(count, { force: true });
    const events: CoachEvent[] = [];
    const listen = (ev: CoachEvent) => {
      events.push(ev);
      onEvent?.(ev);
    };
    runner.coachRunner.on('event', listen);
    return new Promise<{ info: CoachRunInfo; events: CoachEvent[]; calls: number }>((resolve) => {
      runner.coachRunner.once('done', (info: CoachRunInfo) => {
        runner.coachRunner.off('event', listen);
        resolve({ info, events, calls: Number(fs.readFileSync(count, 'utf8')) });
      });
      runner.coachRunner.start('analyze', 'manual');
    });
  };
  try {
    const ok = await run('race-then-ok');
    assert.equal(ok.calls, 2);
    assert.equal(ok.info.status, 'success');
    assert.equal(ok.info.summary, 'Đã viết kế hoạch');
    assert.ok(ok.events.some((e) => e.kind === 'stderr' && /tự thử lại/.test(e.text)));

    const race = await run('race');
    assert.equal(race.calls, 2, 'retried once, not forever');
    assert.equal(race.info.status, 'error');
    assert.match(race.info.error ?? '', /^Failed to refresh OAuth token/);
    assert.equal(race.info.summary, undefined, 'an error is not shown as the run summary');
    assert.ok(!race.events.some((e) => e.kind === 'result'));
    assert.equal(race.events.filter((e) => e.kind === 'error' && /OAuth/.test(e.text)).length, 2, 'one line per attempt, no duplicate assistant text');
    assert.ok(race.events.some((e) => /\/login/.test(e.text)), 'tells how to fix the login');

    const limit = await run('limit');
    assert.equal(limit.calls, 1, 'usage limits are not retried');
    assert.match(limit.info.error ?? '', /usage limit/);

    const busy = await run('race-after-tool');
    assert.equal(busy.calls, 1, 'no retry once a tool ran (files may already be written)');
    assert.equal(busy.info.status, 'error');

    runner.RETRY.delayMs = 10_000;
    const cancelled = await run('race', (ev) => {
      if (/tự thử lại/.test(ev.text)) setImmediate(() => runner.coachRunner.cancel());
    });
    assert.equal(cancelled.calls, 1);
    assert.equal(cancelled.info.status, 'cancelled', 'cancel works while waiting for the retry');
    assert.equal(runner.readLock(), undefined, 'lock released');
  } finally {
    runner.RETRY.delayMs = delay;
    for (const k of ['CLAUDE_BIN', 'TRAINER_ALLOW_COACH', 'FAKE_CLAUDE_COUNT', 'FAKE_CLAUDE_MODE']) delete process.env[k];
  }
});
