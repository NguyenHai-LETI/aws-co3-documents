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
import YAML from 'yaml';
import type { CoachEvent, CoachRunInfo, LintFlaw, Question, QuestionState, VerifyVerdict } from '../shared/types.ts';

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
const { applyPatch, applyPatchItems, findBlock } = await import('../server/lib/patch.ts');
const enrich = await import('../server/lib/enrich.ts');
const runner = await import('../server/lib/coach-runner.ts');
const ask = await import('../server/lib/ask.ts');
const sched = await import('../scripts/schedule.ts');
const aiOut = await import('../server/lib/ai-output.ts');
const verify = await import('../server/lib/verify.ts');

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
    base: "0000000000"
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

  // unquoted hashes such as 46794516e3 / 0123456789 are numbers for YAML: rejected with the fix, never silently mismatched
  const numeric = writePatch('p3b', `items:\n  - id: t-01\n    base: 46794516e3\n  - id: 1234\n    base: "x"\n`);
  const rn = applyPatch(numeric);
  assert.equal(rn.items[0].status, 'failed');
  assert.match(rn.items[0].errors.join(' '), /base phải là chuỗi trong ngoặc kép[^\n]*base: "<hash>"/);
  assert.match(rn.items[1].errors.join(' '), /id phải là chuỗi trong ngoặc kép/);
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
    base: "0123456789"
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
    // re-running the same patch (file-mode post-check, repair round, the AI running apply-patch twice) must not apply the
    // old letters again on the new layout — that would swap option texts
    const again = applyPatch(file, { today: TODAY });
    assert.equal(again.items[0].status, 'unchanged');
    const q2 = loadBank().byId.get('t-02')!;
    assert.deepEqual(
      q2.options.map((o) => o.text),
      ['S3', 'Instance store', 'Amazon EBS Multi-Attach volumes attached in one Availability Zone', 'Amazon EFS with mount targets in each Availability Zone'],
    );
    assert.deepEqual(q2.answer, ['D']);
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
  assert.deepEqual(enrich.parseTasks('explain, 3.1, bogus'), { todos: ['explain'], examTasks: ['3.1'], explicit: true });
  assert.deepEqual(enrich.parseTasks(undefined), { todos: ['explain', 'hint', 'classify', 'balance'], examTasks: [], explicit: false });
  assert.deepEqual(enrich.parseTasks(['distractors', 'Explain']).todos, ['distractors', 'explain']);

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
  assert.ok(text.includes(`  - id: "t-02"        # explain, hint, classify, balance\n    base: "${bank.byId.get('t-02')!.hash}"`), 'quoted: YAML reads hashes like 46794516e3 as numbers');
  const skeleton = YAML.parse(text.slice(text.indexOf('```yaml') + 8, text.lastIndexOf('```'))) as { items: { id: unknown; base: unknown }[] };
  assert.ok(skeleton.items.every((i) => typeof i.id === 'string' && typeof i.base === 'string'));
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

test('[γ] enrich: the "upcoming" tier (plan sessions not done → reviews due by tomorrow → next never-seen in newOrder) goes first; sealed and out-of-scope questions are never long-form originals', () => {
  resetPack();
  const bank = loadBank();
  const cfg = loadConfig();
  const day = 86_400_000;
  const now = Date.now();
  const states = new Map([
    ['t-02', { ...state('t-02', 2, 2), dueAt: new Date(now + day / 2).toISOString() }], // seen, due by tomorrow
    ['t-01', { ...state('t-01', 1, 1), dueAt: new Date(now + 10 * day).toISOString() }], // seen, not due
  ]);
  const plans = [
    {
      id: 'p1',
      file: 'coach/plans/p1.md',
      created: new Date(now).toISOString(),
      newPacks: [],
      body: '',
      sessions: [
        { id: 's1', title: 'done', questions: ['t-01'], done: [{ attemptId: 'a1', score: 80, finished: new Date(now).toISOString() }] },
        { id: 's2', title: 'next', questions: ['t-04', 't-05', 'nope'] }, // t-05 retired, nope unknown
      ],
    },
  ];
  const up = enrich.upcomingIds({ bank, states, attempts: [], plans, cfg, now, sealed: new Set() });
  assert.deepEqual(up, ['t-04', 't-02', 't-03'], 'plan session · due tomorrow · never seen (t-04 only once)');
  assert.deepEqual(enrich.upcomingIds({ bank, states, attempts: [], plans, cfg, now, sealed: new Set(['t-04', 't-02']) }), ['t-03'], 'sealed questions are never upcoming');
  assert.deepEqual(enrich.upcomingIds({ bank, states, attempts: [], plans: [], cfg, now, sealed: new Set(), newCount: 0 }), ['t-02']);

  const items = enrich.selectBatch(bank, states, { size: 10, upcoming: up });
  assert.deepEqual(
    items.map((i) => [i.q.id, i.tier]),
    [
      ['t-04', 'upcoming'],
      ['t-02', 'upcoming'],
      ['t-03', 'upcoming'],
      ['t-01', 'seen'],
    ],
    'upcoming first, soonest first',
  );
  assert.deepEqual(enrich.selectBatch(bank, states, { size: 2, upcoming: up, onlyUpcoming: true }).map((i) => i.q.id), ['t-04', 't-02']);
  assert.deepEqual(enrich.selectBatch(bank, states, { upcoming: [], onlyUpcoming: true }), [], 'nothing upcoming → empty batch (the follow-up run is skipped)');
  const file = enrich.writeBatchFile('2026-10-20_120000_enrich', items.slice(0, 2), bank, {});
  assert.match(fs.readFileSync(file, 'utf8'), /## 1\. `t-04` — todo: [^\n]* · ⏭ người học sắp gặp câu này/);

  // long-form originals: never a sealed question (a variant would leak it) nor an out-of-scope one
  assert.deepEqual(enrich.longformTargets(bank, new Map(), 5, new Set()).map((t) => t.q.id).sort(), ['t-01', 't-02']);
  assert.deepEqual(enrich.longformTargets(bank, new Map(), 5, new Set(['t-02'])).map((t) => t.q.id), ['t-01']);
  const t01 = bank.byId.get('t-01')!;
  t01.outOfScope = true;
  try {
    assert.deepEqual(enrich.longformTargets(bank, new Map(), 5, new Set()).map((t) => t.q.id), ['t-02']);
  } finally {
    delete t01.outOfScope;
  }
  assert.equal(enrich.enrichStatus(bank, [], new Set()).longFormCandidates, 2);
  assert.equal(enrich.enrichStatus(bank, [], new Set(['t-01'])).longFormCandidates, 1);
});

test('[γ] scheduledRunsToday: a follow-up run (params.after, coach.enrich_after_analyze) rides on its analyze run', () => {
  const now = new Date();
  const runs = [
    { id: 'a', task: 'analyze', trigger: 'schedule', status: 'success', startedAt: now.toISOString() },
    { id: 'b', task: 'enrich', trigger: 'schedule', status: 'success', startedAt: now.toISOString(), params: { size: 10, upcoming: true, after: 'a' } },
  ] as CoachRunInfo[];
  assert.equal(runner.scheduledRunsToday(runs, now), 1);
  assert.equal(runner.AFTER_ANALYZE_BATCH, 10);
});

// ── coach runner policy, costs, CLI discovery ───────────────────────────────

test('coach runner: refused on a TRAINER_HOME copy, per-task models and least-privilege tools', async () => {
  assert.match(runner.coachGuard() ?? '', /TRAINER_HOME/);
  assert.throws(() => runner.coachRunner.start('enrich', 'cli', {}), /TRAINER_HOME/);
  const cfg = loadConfig();
  assert.deepEqual(runner.resolvedModels(cfg), { analyze: 'opus', generate: 'opus', enrich: 'sonnet', ask: 'haiku', verify: 'opus' });
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

test('[R2 #4] "Hỏi AI" cannot read the bank, sealed forms, ENRICH batches or the exam sources; blind-solve pack/scope runs skip sealed questions and the run log never shows their pick, key or reason', () => {
  resetPack();
  const bank = loadBank();
  const q = bank.byId.get('t-01')!;
  const prompt = ask.buildAskPrompt(q, 'Vì sao?', '', bank);
  assert.match(prompt, /KHÔNG đọc, tìm hay trích các câu hỏi khác của ngân hàng \(`trainer\/`, `practice-exams\/`\)/);
  for (const version of ['2.1.301', '1.0.0']) {
    const args = ask.askArgs(prompt, loadConfig(), version);
    const i = args.indexOf('--disallowedTools');
    assert.ok(i > 0, `deny rules on CLI ${version}`);
    assert.deepEqual(args.slice(i + 1, i + 3), ['Read(./trainer/**)', 'Read(./practice-exams/**)']);
    assert.equal(args[i + 3], '--allowedTools', 'the variadic list ends before the next flag');
  }
  assert.deepEqual(ask.ASK_DENY, ['Read(./trainer/**)', 'Read(./practice-exams/**)']);

  const sealed = new Set(['t-02']);
  assert.ok(!verify.verifyTargets(bank, { pack: 't-pack' }, [], sealed).ids.includes('t-02'), 'pack run');
  assert.ok(!verify.verifyTargets(bank, { scope: 'changed' }, [], sealed).ids.includes('t-02'), 'scope run');
  assert.ok(verify.verifyTargets(bank, { pack: 't-pack' }, [], new Set()).ids.includes('t-02'), 'not sealed → verified as before');
  assert.deepEqual(verify.verifyTargets(bank, { ids: ['t-02'] }, [], sealed).ids, ['t-02'], 'an explicit id is still allowed');

  const v = { qid: 't-02', outcome: 'mismatch' as const, picked: 'C', key: 'B', reason: 'Lý do lộ đáp án' };
  assert.equal(runner.verdictLogLine(v, new Set()), '❌ t-02: model chọn C, đáp án B — Lý do lộ đáp án');
  const hidden = runner.verdictLogLine(v, sealed);
  assert.equal(hidden, '❌ 1 câu đang niêm phong: lệch đáp án (chi tiết ẩn tới khi bạn làm đề hoặc mở sớm)');
  assert.ok(!/t-02|C|Lý do/.test(hidden.replace('chi tiết', '')));
  assert.equal(runner.verdictLogLine({ ...v, outcome: 'ambiguous' }, sealed), '⚠️ 1 câu đang niêm phong: mơ hồ (chi tiết ẩn tới khi bạn làm đề hoặc mở sớm)');
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

// ── lint after every patch item ─────────────────────────────────────────────

test('patch: lint re-runs after every item — a new high-severity flaw rejects (reverts) it, other new flaws warn', () => {
  resetPack();
  // stand-in rules (injected) so the test does not depend on lint.ts's rule set
  const lint = (q: Question): LintFlaw[] => [
    ...q.options.filter((o) => /\bguaranteed\b/i.test(o.text)).map((o) => ({ code: 'test-high', severity: 'high' as const, message: 'phương án tuyệt đối', option: o.key })),
    ...q.options.filter((o) => /\bnormally\b/i.test(o.text)).map((o) => ({ code: 'test-medium', severity: 'medium' as const, message: 'từ mơ hồ', option: o.key })),
  ];
  const file = writePatch(
    'lint1',
    `items:
  - id: t-01
    base: ${hashOf('t-01')}
    options: { A: "Read Replicas in another AZ with guaranteed failover" }
  - id: t-02
    base: ${hashOf('t-02')}
    options: { A: "Amazon EBS volumes that are normally attached in one AZ" }
`,
  );
  const r = applyPatch(file, { today: TODAY, lint });
  assert.equal(r.items[0].status, 'failed');
  assert.match(r.items[0].errors.join(' '), /lint \(mức cao\): phương án tuyệt đối \[test-high · A\]/);
  assert.equal(r.items[1].status, 'applied');
  assert.match(r.items[1].warnings.join(' '), /lint: từ mơ hồ \[test-medium · A\]/);
  assert.equal(loadBank().byId.get('t-01')!.options[0].text, 'Read Replicas in another AZ', 'rejected item reverted');

  // a flaw the question already had is not new: editing another field passes
  const again = writePatch('lint2', `items:\n  - id: t-02\n    base: ${hashOf('t-02')}\n    set: { concept: "EFS vs EBS" }\n`);
  assert.deepEqual(applyPatch(again, { today: TODAY, lint }).items[0].warnings, []);

  // a crashing linter never blocks an edit
  const boom = writePatch('lint3', `items:\n  - id: t-03\n    base: ${hashOf('t-03')}\n`);
  const r3 = applyPatch(boom, {
    today: TODAY,
    lint: () => {
      throw new Error('bug');
    },
  });
  assert.equal(r3.items[0].status, 'applied');
  assert.match(r3.items[0].warnings.join(' '), /lint không chạy được: bug/);

  // default = lint.ts: duplicate options are high severity; option letters are reported once, not twice
  const real = writePatch(
    'lint4',
    `items:
  - id: t-04
    base: ${hashOf('t-04')}
    options: { B: "Use Spot Instances with a diversified allocation strategy" }
  - id: t-03
    base: ${hashOf('t-03')}
    explanation: |
      Option A and answer B together keep keys in KMS and log every use in CloudTrail for the auditors to review later on.
`,
  );
  const r4 = applyPatch(real, { today: TODAY });
  assert.equal(r4.items[0].status, 'failed');
  assert.match(r4.items[0].errors.join(' '), /\[duplicate-options/);
  assert.equal(r4.items[1].status, 'failed');
  assert.equal(r4.items[1].errors.filter((e) => /chữ cái|letter-ref/.test(e)).length, 1, r4.items[1].errors.join(' | '));
});

test('applyPatchItems: in-memory items (status change) without a patch file or ledger', () => {
  resetPack();
  const r = applyPatchItems([{ id: 't-04', base: hashOf('t-04'), status: 'draft' }], { label: '(test)' });
  assert.equal(r.patch, '(test)');
  assert.equal(r.items[0].status, 'applied');
  const q = loadBank().byId.get('t-04')!;
  assert.equal(q.status, 'draft');
  assert.equal(q.enriched, undefined, 'a status-only item is not enrichment');
  assert.deepEqual(fs.readdirSync(path.join(home, 'coach', 'patches')), [], 'no patch file, no ledger');
});

// ── structured output (coach.structured_output) ────────────────────────────

test('structured output: extraction, ENRICH items (base from the batch, empty values dropped), repair merge, audit patch round-trip', () => {
  resetPack();
  assert.deepEqual(aiOut.structuredOutput({ structured_output: { items: [] } }), { items: [] });
  assert.deepEqual(aiOut.structuredOutput({ result: '```json\n{"a":1}\n```' }), { a: 1 });
  assert.equal(aiOut.structuredOutput({ result: 'not json' }), undefined);
  assert.equal(aiOut.structuredOutput(undefined), undefined);

  const bases = { 't-01': hashOf('t-01'), 't-02': hashOf('t-02'), 't-03': hashOf('t-03') };
  const out = {
    items: [
      { id: 't-01', base: 'model-typo', set: { task: '2.2', hint: '', tags: [] }, explanation: GOOD_EXPLANATION, stem: ' ', answer: [], options: {} },
      { id: 't-01', explanation: 'duplicate → ignored' },
      { id: 'nope', explanation: 'not in the batch → ignored' },
      { id: 't-02', options: { A: 'Amazon EBS Multi-Attach volumes in one AZ', C: '' } },
    ],
    summary: 's',
  };
  const r = aiOut.enrichItems(out, bases);
  assert.deepEqual(r.items[0], { id: 't-01', base: bases['t-01'], set: { task: '2.2' }, explanation: GOOD_EXPLANATION });
  assert.deepEqual(r.items[1], { id: 't-02', base: bases['t-02'], options: { A: 'Amazon EBS Multi-Attach volumes in one AZ' } });
  assert.deepEqual(r.ignored, ['t-01', 'nope']);
  assert.deepEqual(r.failures.map((f) => f.id), ['t-03'], 'a batch question without an item must be repaired');

  const merged = aiOut.mergeRepaired(r.items, { items: [{ id: 't-03' }, { id: 't-02', explanation: 'not a failed id → ignored' }] }, ['t-03'], bases);
  assert.deepEqual(merged.fixed, ['t-03']);
  assert.deepEqual(merged.items[2], { id: 't-03', base: bases['t-03'] });
  assert.equal(merged.items[1].explanation, undefined);

  const items = [{ ...merged.items[0], set: { task: '2.2', hint: 'Đề cần: failover # tự động — cơ chế "đồng bộ" nào?' } }, merged.items[1], merged.items[2]];
  const file = path.join(home, 'coach', 'patches', 'json-1.yaml');
  aiOut.writePatchFile(file, 'json-1', items);
  assert.match(fs.readFileSync(file, 'utf8'), /^# Patch do app ghi[^\n]*\nrun_id: json-1\nitems:\n/);
  const applied = applyPatch(file, { today: TODAY });
  assert.deepEqual(applied.items.map((i) => i.status), ['applied', 'applied', 'applied']);
  const q1 = loadBank().byId.get('t-01')!;
  assert.equal(q1.hint, 'Đề cần: failover # tự động — cơ chế "đồng bộ" nào?');
  assert.equal(q1.explanation, GOOD_EXPLANATION);
  assert.match(aiOut.repairPrompt('enrich', 'r1', [{ id: 't-01', errors: ['a', 'b'] }]), /- `t-01`: a \| b[\s\S]*- run_id: r1$/);
  assert.match(aiOut.repairPrompt('generate', 'r2', [{ id: 'doc-x-02', errors: ['e'], label: '“A company…”' }]), /- `doc-x-02` \(“A company…”\): e/);
});

const NEW_Q = (over: Record<string, unknown> = {}) => ({
  domain: 'resilient',
  task: '2.2',
  topic: 'database',
  services: ['RDS'],
  tags: ['multi-az'],
  difficulty: 'medium',
  concept: 'RDS Multi-AZ vs read replicas',
  refs: ['03-database-services.md'],
  hint: 'Cần failover tự động khi mất một AZ — cơ chế nào giữ bản sao đồng bộ?',
  stem: 'A company runs PostgreSQL on Amazon RDS. The database must fail over automatically when an Availability Zone fails, without application changes. Which solution meets these requirements?',
  options: ['Convert the database to a Multi-AZ deployment', 'Add a read replica in another Availability Zone', 'Restore hourly snapshots in another zone', 'Copy nightly exports to Amazon S3 buckets'],
  answer: ['A'],
  explanation: GOOD_EXPLANATION,
  ...over,
});

test('structured output: new questions — schema checks, ids, rubric time, letters / hints / lint, pack written and parsed', () => {
  resetPack();
  const bank = loadBank();
  const target = { kind: 'generate' as const, runId: 'r-gen', today: TODAY, sources: ['03-database-services.md'] };
  const plan = aiOut.planPack(target, { pack: { slug: 'RDS Đa vùng!', title: 'RDS HA' } }, bank);
  assert.equal(plan.packId, 'doc-rds-da-vung');
  assert.equal(plan.file, path.join(home, 'bank', 'packs', 'docs', `${TODAY}-rds-da-vung.md`));
  assert.equal(plan.idOf(0), 'doc-rds-da-vung-01');
  assert.deepEqual(plan.meta, { pack: 'doc-rds-da-vung', title: 'RDS HA', origin: 'doc', created: TODAY, generated_by: 'r-gen', source: '03-database-services.md' });

  const ctx = { tax: bank.taxonomy, today: TODAY, kind: 'generate' as const, bank };
  const ok = aiOut.draftOf(NEW_Q(), 'doc-rds-da-vung-01', ctx);
  assert.deepEqual(ok.errors, []);
  assert.ok(ok.draft!.time >= 45 && ok.draft!.time <= 180, 'time from the rubric');
  assert.equal(ok.draft!.created, TODAY);
  assert.equal(ok.draft!.enriched, TODAY, 'complete question (explanation + hint + task) is marked enriched');
  assert.deepEqual(ok.draft!.options.map((o) => o.key), ['A', 'B', 'C', 'D']);

  const errs = (over: Record<string, unknown>, kind: 'generate' | 'longform' = 'generate', originals?: string[]) => aiOut.draftOf(NEW_Q(over), 'doc-x-01', { ...ctx, kind, originals }).errors.join(' | ');
  assert.match(errs({ domain: 'bogus' }), /domain "bogus"/);
  assert.match(errs({ task: '4.1' }), /task 4\.1 thuộc domain cost/);
  assert.match(errs({ topic: 'nope' }), /topic "nope"/);
  assert.match(errs({ explanation: 'Option A wins because (B) is slow and the rest are worse for this scenario overall.' }), /chữ cái đáp án/);
  assert.match(errs({ answer: ['A', 'B'] }), /Choose TWO/);
  assert.match(errs({ stem: `${NEW_Q().stem} (Choose TWO)` }), /chỉ có 1 đáp án/);
  assert.match(errs({ hint: 'Chọn Convert the database to a Multi-AZ deployment' }), /lộ đáp án/);
  assert.match(errs({ options: ['x', 'y', 'z'] }), /4–6 lựa chọn/);
  assert.match(errs({ answer: ['E'] }), /answer E/);
  assert.match(errs({}, 'longform', ['t-01']), /câu dài phải có variant_of[\s\S]*câu dài cần ≥ 55 từ/);
  assert.match(errs({ variant_of: ['t-02'] }, 'longform', ['t-01']), /không phải câu gốc của lô/);
  const prefixed = aiOut.draftOf(NEW_Q({ options: ['A. One option text', 'B) Two option text', 'C. Three option', 'D. Four option'] }), 'doc-x-01', ctx);
  assert.deepEqual(prefixed.draft!.options.map((o) => o.text), ['One option text', 'Two option text', 'Three option', 'Four option']);

  assert.match(aiOut.checkDraft({ ...ok.draft!, id: 't-01' }, plan, bank).errors.join(' '), /đã có trong ngân hàng/);
  assert.match(aiOut.checkDraft(ok.draft!, plan, bank, () => [{ code: 'x', severity: 'high', message: 'lỗi nặng' }]).errors.join(' '), /lint \(mức cao\): lỗi nặng \[x\]/);
  const medium = aiOut.checkDraft(ok.draft!, plan, bank, () => [{ code: 'y', severity: 'medium', message: 'nhắc nhẹ' }]);
  assert.deepEqual(medium.errors, []);
  assert.deepEqual(medium.warnings, ['lint: nhắc nhẹ [y]']);

  const rel = aiOut.writePack(plan, [ok.draft!]);
  try {
    assert.equal(rel, `bank/packs/docs/${TODAY}-rds-da-vung.md`);
    const b2 = loadBank();
    const q = b2.byId.get('doc-rds-da-vung-01')!;
    assert.equal(q.origin, 'doc');
    assert.equal(q.pack, 'doc-rds-da-vung');
    assert.equal(q.enriched, TODAY);
    assert.deepEqual(b2.problems.filter((p) => p.file === rel && p.level === 'error'), []);
    assert.equal(aiOut.planPack(target, { pack: { slug: 'rds-da-vung', title: 'x' } }, b2).packId, 'doc-rds-da-vung-2', 'a taken slug gets a suffix');
    const lf = aiOut.planPack(
      { kind: 'longform', runId: 'r-lf', today: TODAY, packFile: path.join(home, 'bank', 'packs', 'ai', '2026-10-16-1200-longform-<slug>.md'), packId: 'ai-2026-10-16-1200-longform', idPrefix: 'ai-20261016-1200-lf', batch: 'b.md' },
      { pack: { slug: 'RDS HA', title: 'RDS HA' } },
      b2,
    );
    assert.equal(lf.file, path.join(home, 'bank', 'packs', 'ai', '2026-10-16-1200-longform-rds-ha.md'));
    assert.equal(lf.idOf(1), 'ai-20261016-1200-lf02');
    assert.equal(lf.meta.title, 'AI · Câu dài chuẩn đề thi · RDS HA');
    assert.equal(lf.meta.origin, 'ai');
  } finally {
    fs.rmSync(path.join(home, rel), { force: true });
  }
});

// ── blind-solve verification ────────────────────────────────────────────────

function vpack(pack: string, origin: string, ids: string[]): string {
  const block = (id: string, i: number) => {
    const multi = i % 2 === 1;
    return [
      `## Q ${id}`,
      '- domain: resilient',
      '- topic: database',
      '- difficulty: medium',
      '- time: 60',
      '- concept: SECRET-CONCEPT',
      '- hint: SECRET-HINT gợi ý',
      '',
      `Question ${id}: which design keeps a standby database ready for an automatic failover inside one Region${multi ? ' (Choose TWO)' : ''}?`,
      '',
      '- A. Multi-AZ deployment',
      '- B. Read replica in another zone',
      '- C. Snapshot copied hourly',
      '- D. Global table',
      ...(multi ? ['- E. Backup plan'] : []),
      '',
      `**Answer:** ${multi ? 'A, C' : 'B'}`,
      '',
      `**Explanation:** SECRET-EXPLANATION ${id}`,
    ].join('\n');
  };
  return `---\npack: ${pack}\ntitle: ${pack}\norigin: ${origin}\n---\n\n# ${pack}\n\n${ids.map(block).join('\n\n---\n\n')}\n`;
}

test('verify: ledger round-trip, judging, a prompt without the key, batches', () => {
  const v: VerifyVerdict = {
    date: '2026-10-19',
    at: '2026-10-19T10:00:00+07:00',
    qid: 't-01',
    hash: 'abc1234567',
    outcome: 'mismatch',
    picked: 'C',
    key: 'B',
    confidence: 'high',
    model: 'opus',
    runId: 'r1',
    reason: 'Lý do có --> và <!-- và `code`\nxuống dòng',
  };
  const line = verify.formatVerdict(v);
  assert.match(line, /^- 2026-10-19 · `t-01` · ❌ lệch đáp án \(model C · đáp án B\) · opus · tin cậy cao — Lý do có/);
  assert.equal(line.split('\n').length, 1);
  const earlier = verify.formatVerdict({ ...v, qid: 't-02', at: '2026-10-19T09:00:00+07:00', outcome: 'ok', picked: 'B', reason: undefined });
  const parsed = verify.parseVerdicts(`# h\n\n${line}\n- 2026-10-19 · \`Bad Id\` · x <!-- verify {"hash":"x","outcome":"ok"} -->\nrandom\n${earlier}\n`);
  assert.deepEqual(parsed.map((p) => p.qid), ['t-02', 't-01'], 'ordered by time, not by line');
  assert.deepEqual(parsed[1], { ...v, line: 3, reason: 'Lý do có và và `code` xuống dòng' });

  const q = { id: 'x', options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: key.toLowerCase() })), answer: ['B'], stem: 's', hash: 'h' } as unknown as Question;
  assert.equal(verify.judge(q, { answer: ['b'], confidence: 'high', ambiguous: false }).outcome, 'ok');
  assert.deepEqual(verify.judge(q, { answer: ['C'], ambiguous: false, confidence: 'low', reason: ' r ' }), { outcome: 'mismatch', picked: 'C', key: 'B', confidence: 'low', reason: 'r' });
  assert.equal(verify.judge(q, { answer: ['B'], ambiguous: true }).outcome, 'ambiguous', 'two defensible options is a flaw even when the pick matches');
  assert.equal(verify.judge(q, { answer: ['Z'] }).outcome, 'error');
  assert.equal(verify.judge(q, undefined).outcome, 'error');
  const multi = { ...q, answer: ['A', 'C'] } as Question;
  assert.equal(verify.judge(multi, { answer: ['C', 'A'] }).outcome, 'ok');
  assert.equal(verify.judge(multi, { answer: ['A'] }).outcome, 'mismatch');
  const vs = verify.verdictsFor([q, { ...q, id: 'y' } as Question], { results: [{ id: 'x', answer: ['B'], confidence: 'high', ambiguous: false, reason: 'ok' }] }, { runId: 'r', model: 'm' });
  assert.deepEqual(vs.map((x) => [x.qid, x.outcome, x.hash, x.model, x.runId]), [
    ['x', 'ok', 'h', 'm', 'r'],
    ['y', 'error', 'h', 'm', 'r'],
  ]);

  const many = Array.from({ length: 23 }, (_, i) => ({ ...q, id: `x-${i}` }) as Question);
  assert.deepEqual(verify.verifyBatches(many, 10).map((b) => b.length), [10, 10, 3]);
  const big = Array.from({ length: 5 }, (_, i) => ({ ...q, id: `y-${i}`, stem: 'w'.repeat(9000) }) as Question);
  assert.deepEqual(verify.verifyBatches(big, 10).map((b) => b.length), [2, 2, 1], 'prompt size limit (Windows command lines)');

  const aiFile = path.join(home, 'bank', 'packs', 'ai', 'v-prompt.md');
  fs.mkdirSync(path.dirname(aiFile), { recursive: true });
  fs.writeFileSync(aiFile, vpack('v-prompt', 'ai', ['vp-01', 'vp-02']));
  try {
    const b = loadBank();
    const prompt = verify.verifyPrompt([b.byId.get('vp-01')!, b.byId.get('vp-02')!], 'r-v');
    assert.ok(!prompt.includes('SECRET'), 'no explanation / hint / concept');
    assert.doesNotMatch(prompt, /\*\*Answer|đáp án đúng/);
    assert.match(prompt, /## 1\. `vp-01` — chọn 1/);
    assert.match(prompt, /## 2\. `vp-02` — chọn 2\n\nQuestion vp-02: [^\n]*\(Choose TWO\)\?\n\n- A\. Multi-AZ deployment\n[\s\S]*- E\. Backup plan/);
    assert.match(prompt, /- run_id: r-v/);
  } finally {
    fs.rmSync(aiFile);
  }
});

test('verify: summary + review queue, targets by scope, auto-draft policy, decisions, stale verdicts', () => {
  resetPack();
  const files = [path.join(home, 'bank', 'packs', 'ai', 'v-ai.md'), path.join(home, 'bank', 'packs', 'imported', 'v-imp.md')];
  fs.mkdirSync(path.dirname(files[1]), { recursive: true });
  fs.writeFileSync(files[0], vpack('v-ai', 'ai', ['v-ai-01', 'v-ai-02']));
  fs.writeFileSync(files[1], vpack('v-imported', 'imported', ['v-imp-01']));
  try {
    let bank = loadBank();
    assert.deepEqual(verify.verifySummary(bank), { verified: 0, ok: 0, review: 0, stale: 0, pending: [], disputed: 0, grounded: 0 });
    assert.deepEqual(verify.verifyTargets(bank, {}).ids, ['v-ai-01', 'v-ai-02'], 'default scope: AI-written without a verdict');
    assert.deepEqual(verify.verifyTargets(bank, { scope: 'new' }).ids, ['v-ai-01', 'v-ai-02', 't-01', 't-02', 't-03', 't-04'], 'never verified, not imported, not retired');
    assert.deepEqual(verify.verifyTargets(bank, { pack: 'v-imported' }).ids, ['v-imp-01']);
    assert.deepEqual(verify.verifyTargets(bank, { ids: ['v-imp-01', 't-05', 'nope', 'v-imp-01'] }).ids, ['v-imp-01']);

    const qs = (...ids: string[]) => ids.map((id) => bank.byId.get(id)!);
    const now = new Date('2026-10-19T10:00:00+07:00');
    const vs = [
      ...verify.verdictsFor(qs('v-ai-01', 'v-ai-02'), { results: [{ id: 'v-ai-01', answer: ['B'] }, { id: 'v-ai-02', answer: ['A', 'B'] }] }, { runId: 'r1', model: 'opus', now }),
      ...verify.verdictsFor(qs('v-imp-01', 't-01'), { results: [{ id: 'v-imp-01', answer: ['C'] }, { id: 't-01', answer: ['B'], ambiguous: true }] }, { runId: 'r1', now }),
    ];
    verify.appendVerdicts(vs);
    assert.match(fs.readFileSync(verify.VERIFY_FILE, 'utf8'), /^# 🧪 Giải mù câu hỏi[\s\S]*<!-- verify-log -->\n- 2026-10-19 · `v-ai-01` · ✅ khớp/);
    bank = loadBank();
    const s = verify.verifySummary(bank);
    assert.deepEqual([s.verified, s.ok, s.review, s.stale], [4, 1, 3, 0]);
    assert.deepEqual(s.pending.map((p) => p.qid).sort(), ['t-01', 'v-ai-02', 'v-imp-01']);
    assert.deepEqual(verify.verifyTargets(bank, {}).ids, [], 'every AI question has a verdict now');

    // auto_draft: AI-written → yes · imported → never · other origins only when the run just changed them
    assert.deepEqual(verify.draftCandidates(vs, bank).map((v) => v.qid), ['v-ai-02']);
    assert.deepEqual(verify.draftCandidates(vs, bank, new Set(['t-01', 'v-imp-01'])).map((v) => v.qid), ['v-ai-02', 't-01']);
    assert.deepEqual(verify.autoDraft(verify.draftCandidates(vs, bank), 'r1', TODAY), { drafted: ['v-ai-02'], errors: [] });
    bank = loadBank();
    assert.equal(bank.byId.get('v-ai-02')!.status, 'draft');
    assert.match(fs.readFileSync(path.join(home, 'coach', 'patches', 'r1-verify.yaml'), 'utf8'), /- id: v-ai-02\n {4}base: \w+\n {4}status: draft/);
    assert.equal(verify.verifySummary(bank).pending.find((p) => p.qid === 'v-ai-02')!.decision, 'drafted', 'drafted questions stay in the review queue');

    // decisions
    const a = verify.decide('v-ai-02', 'approve', 'đã kiểm tra với notes');
    assert.equal(a.decision, 'approved');
    assert.equal(a.reason, 'đã kiểm tra với notes');
    assert.equal(loadBank().byId.get('v-ai-02')!.status, 'active', 'approve puts a drafted question back');
    verify.decide('v-imp-01', 'retire');
    assert.equal(loadBank().byId.get('v-imp-01')!.status, 'retired');
    assert.deepEqual(verify.verifySummary(loadBank()).pending.map((p) => p.qid), ['t-01']);
    assert.throws(() => verify.decide('nope', 'approve'), verify.VerifyInputError);
    assert.throws(() => verify.decide('t-02', 'approve'), /chưa được giải mù/);

    // an edit makes the verdict stale: kept for display, picked up again by scope 'changed'
    const edit = applyPatchItems([{ id: 't-01', base: hashOf('t-01'), stem: 'A database must fail over automatically when one Availability Zone fails. Which feature should be used?' }], { today: TODAY });
    assert.equal(edit.items[0].status, 'applied');
    bank = loadBank();
    const s3 = verify.verifySummary(bank);
    assert.deepEqual([s3.verified, s3.ok, s3.review, s3.stale], [2, 1, 0, 1]);
    assert.deepEqual(verify.verifyTargets(bank, { scope: 'changed' }).ids, ['t-01']);
    const latest = verify.latestVerdicts(bank);
    assert.notEqual(latest['t-01'].hash, bank.byId.get('t-01')!.hash);
    assert.equal(latest['v-ai-02'].decision, 'approved');
  } finally {
    for (const f of [...files, verify.VERIFY_FILE]) fs.rmSync(f, { force: true });
  }
});

// ── runner: structured / verify CLI arguments ───────────────────────────────

test('coach runner: structured (JSON) and blind-solve CLI arguments, prompts, changed questions', () => {
  const cfg = loadConfig();
  const sa = runner.structuredArgs('P', cfg, 'enrich');
  assert.ok(JSON.parse(sa[sa.indexOf('--json-schema') + 1]).properties.items);
  assert.equal(sa[sa.indexOf('--tools') + 1], 'Read,Glob,Grep');
  assert.ok(!sa.some((a) => /^(Edit|Write|Bash)/.test(a)), 'read-only: no write / shell rule');
  assert.ok(!sa.includes('--resume'));
  assert.equal(sa[sa.indexOf('--model') + 1], 'sonnet');
  const rs = runner.structuredArgs('P', cfg, 'generate', { resume: 'sess-1' });
  assert.equal(rs[rs.indexOf('--resume') + 1], 'sess-1');
  assert.ok(JSON.parse(rs[rs.indexOf('--json-schema') + 1]).properties.questions);
  const va = runner.verifyArgs('P', cfg);
  assert.equal(va[va.indexOf('--tools') + 1], '', 'no tools at all');
  assert.ok(va.includes('--no-session-persistence'));
  assert.equal(va[va.indexOf('--model') + 1], 'opus');
  assert.equal(va[va.indexOf('--fallback-model') + 1], 'sonnet');
  assert.ok(JSON.parse(va[va.indexOf('--json-schema') + 1]).properties.results);
  assert.ok(!runner.verifyArgs('P', { ...cfg, coach: { ...cfg.coach, models: { ...cfg.coach.models, verify: 'sonnet' } } }).includes('--fallback-model'));
  assert.equal(runner.modelFor('verify', { ...cfg, coach: { ...cfg.coach, model: 'haiku', models: { ...cfg.coach.models, verify: '' } } }), 'opus', 'verify defaults to opus, not coach.model');

  assert.equal(runner.isStructured('enrich', cfg, '2.1.301 (Claude Code)'), true);
  assert.equal(runner.isStructured('analyze', cfg, '2.1.301'), false);
  assert.equal(runner.isStructured('generate', cfg, '2.0.1'), false, 'an old CLI falls back to file mode');
  assert.equal(runner.isStructured('longform', { ...cfg, coach: { ...cfg.coach, structured_output: false } }, '2.1.301'), false);
  assert.ok(runner.COACH_TASKS.includes('verify'));

  const jp = runner.buildJsonPrompt('enrich', 'r1', 'manual', { batch: 'b.md', size: 2, patch: 'p.yaml', tasks: ['distractors'], note: 'xem lại D' });
  assert.match(jp, /CHẾ ĐỘ APP \(JSON\)[\s\S]*b\.md[\s\S]*distractors[\s\S]*ghi chú của người học: xem lại D/);
  assert.doesNotMatch(jp, /apply-patch\.ts/);
  assert.match(runner.buildJsonPrompt('generate', 'r2', 'manual', { count: 3, sources: ['x.md'] }), /GENERATE\.md[\s\S]*count: 3[\s\S]*doc-<slug>-01/);
  assert.match(runner.buildJsonPrompt('longform', 'r3', 'manual', { batch: 'b.md', count: 2, idPrefix: 'ai-1-lf', packFile: 'p.md' }), /phần \*\*B\*\*[\s\S]*ai-1-lf01/);

  resetPack();
  const bank = loadBank();
  const before = new Map(bank.questions.map((q) => [q.id, q.hash]));
  before.set('t-02', 'old');
  before.delete('t-03');
  before.set('t-05', 'old');
  assert.deepEqual(runner.changedSince(before, bank), ['t-02', 't-03'], 'new or edited, never retired');
});

// ── ENRICH: explicit ids, distractors, JSON-mode batch ──────────────────────

test('enrich: explicit ids bypass scoring, distractors todo with option numbers, JSON-mode batch with verifier notes', () => {
  resetPack();
  const bank = loadBank();
  const states = new Map<string, QuestionState>();
  assert.deepEqual(
    enrich.selectBatch(bank, states, { ids: ['t-04', 't-05', 'nope', 't-01'] }).map((i) => [i.q.id, i.todo]),
    [
      ['t-04', ['explain', 'hint', 'classify']],
      ['t-01', ['explain', 'hint', 'classify']],
    ],
    'order kept, retired / unknown dropped, pending work as todo',
  );
  assert.deepEqual(enrich.selectBatch(bank, states, { ids: ['t-02'], tasks: 'distractors' }).map((i) => i.todo), [['distractors']]);
  const report = {
    minExposures: 3,
    weakDistractors: [
      { id: 't-03', key: 'E', exposures: 4, elims: 3 },
      { id: 't-02', key: 'D', exposures: 5, elims: 4 },
    ],
    suspectedKeys: [{ id: 't-02', key: 'B', pick: 'A', times: 3, confident: 2, note: 'tưởng EBS dùng chung' }],
  };
  assert.deepEqual(enrich.selectBatch(bank, states, { tasks: 'distractors', report }).map((i) => i.q.id), ['t-02', 't-03'], 'most struck first');
  assert.deepEqual(enrich.selectBatch(bank, states, { tasks: 'distractors' }), [], 'no report → nothing to rewrite');

  const stats = new Map([['t-02', { id: 't-02', exposures: 5, correct: 1, options: { A: { picks: 3, elims: 0 }, B: { picks: 1, elims: 0 }, C: { picks: 1, elims: 2 }, D: { picks: 0, elims: 4 } }, wrong: {} }]]);
  const verdicts: Record<string, VerifyVerdict> = {
    't-02': { date: TODAY, qid: 't-02', hash: bank.byId.get('t-02')!.hash, outcome: 'mismatch', picked: 'A', key: 'B', confidence: 'high', model: 'opus', reason: 'EBS Multi-Attach cũng dùng chung được' },
  };
  const items = enrich.selectBatch(bank, states, { ids: ['t-02'], tasks: 'explain,distractors' });
  const file = enrich.writeBatchFile('2026-10-19_120000_enrich', items, bank, { todos: ['explain', 'distractors'], report, stats, verdicts, mode: 'json', note: 'xem lại phương án D' });
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^mode: json$/m);
  assert.match(text, /Chế độ app \(JSON\)/);
  assert.doesNotMatch(text, /Khung patch/);
  assert.match(text, /\*\*Id cần trả về \(1\):\*\* `t-02`/);
  assert.match(text, /📊 5 lượt trả lời phiên bản hiện tại \(đúng 1\) — phương án nhiễu: A chọn 3 · gạch 0; C chọn 1 · gạch 2; D chọn 0 · gạch 4/);
  assert.match(text, /📊 phương án nhiễu yếu [^\n]*D “Instance store” — gặp 5 lần, bị gạch 4 lần/);
  assert.match(text, /⚠️ người học chọn A 3 lần \(2 lần chắc chắn\) dù đáp án là B — tưởng EBS dùng chung/);
  assert.match(text, /🧪 model giải mù \(opus, tin cậy high\) chọn A thay vì B: “EBS Multi-Attach cũng dùng chung được”/);
  assert.match(text, /\*\*Ghi chú của người học cho lô này:\*\* xem lại phương án D/);
  assert.match(text, /- D\. Instance store {2}⟨14⟩/, 'option lengths shown for distractor rewrites');
  assert.match(fs.readFileSync(enrich.writeBatchFile('2026-10-19_120001_enrich', items, bank, {}), 'utf8'), /## Khung patch/, 'file mode keeps the skeleton');
  const approved = { ...verdicts['t-02'], decision: 'approved' as const };
  assert.deepEqual(enrich.verdictLines(bank.byId.get('t-02')!, { 't-02': approved }), [], 'an approved verdict is not repeated');
});

// ── caches ──────────────────────────────────────────────────────────────────

test('run records: cached by directory mtime, records of running runs re-read', () => {
  const dir = path.join(home, 'coach', 'runs');
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f));
  let tick = Date.now() / 1000;
  const bump = () => fs.utimesSync(dir, (tick += 5), tick); // coarse-mtime file systems
  const save = (info: Record<string, unknown>) => {
    const tmp = path.join(dir, `.${String(info.id)}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(info));
    fs.renameSync(tmp, path.join(dir, `${String(info.id)}.json`));
    bump();
  };
  const base = { trigger: 'manual', startedAt: '2026-10-19T10:00:00+07:00' };
  save({ ...base, id: '2026-10-19_100000_enrich', task: 'enrich', status: 'success' });
  save({ ...base, id: '2026-10-19_110000_verify', task: 'verify', status: 'running' });
  assert.deepEqual(enrich.readRunInfos().map((r) => [r.id, r.status]), [
    ['2026-10-19_110000_verify', 'running'],
    ['2026-10-19_100000_enrich', 'success'],
  ]);
  // rewritten in place (no rename → same directory mtime): still seen because the record was running
  const f = path.join(dir, '2026-10-19_110000_verify.json');
  fs.writeFileSync(f, JSON.stringify({ ...base, id: '2026-10-19_110000_verify', task: 'verify', status: 'success' }));
  fs.utimesSync(f, (tick += 5), tick);
  assert.equal(enrich.readRunInfos()[0].status, 'success');
  const cached = enrich.readRunInfos();
  assert.equal(enrich.readRunInfos(), cached, 'nothing running, directory unchanged → same parsed list');
  assert.equal(enrich.readRunInfos(1).length, 1);
  save({ ...base, id: '2026-10-19_120000_generate', task: 'generate', status: 'success' });
  assert.equal(enrich.readRunInfos()[0].id, '2026-10-19_120000_generate');
  for (const x of fs.readdirSync(dir)) fs.rmSync(path.join(dir, x));
});

test('ask: Q&A costs are cached per file and follow appends and deletions', () => {
  const since = Date.parse('2026-10-16T00:00:00+07:00');
  ask.appendQa('t-02', { at: '2026-10-17T10:00:00+07:00', question: 'Q1?', answer: 'A1', costUsd: 0.01 });
  assert.deepEqual(ask.askCostsSince(since), { count: 1, costUsd: 0.01 });
  ask.appendQa('t-02', { at: '2026-10-17T11:00:00+07:00', question: 'Q2?', answer: 'A2', costUsd: 0.02 });
  assert.deepEqual(ask.askCostsSince(since), { count: 2, costUsd: 0.03 });
  fs.rmSync(path.join(home, 'coach', 'qa', 't-02.md'));
  fs.utimesSync(path.join(home, 'coach', 'qa'), Date.now() / 1000 + 30, Date.now() / 1000 + 30);
  assert.deepEqual(ask.askCostsSince(since), { count: 0, costUsd: 0 });
});

test('CLI detection: the cached status is returned at once and refreshed in the background', async () => {
  const fake = path.join(here, 'helpers', 'fake-claude.mjs');
  const base = loadConfig();
  const cfg = { ...base, coach: { ...base.coach, claude_bin: fake } };
  const s1 = runner.findClaude(cfg, true);
  assert.equal(s1.available, true);
  assert.equal(s1.path, fake);
  assert.equal(s1.version, '2.1.301 (Claude Code)');
  assert.deepEqual(s1.auth, { loggedIn: true, method: 'claude.ai', plan: 'max' });
  assert.equal(runner.findClaude(cfg), s1, 'cached: no process spawned on the request path');
  const s2 = await runner.refreshClaudeStatus(cfg);
  assert.equal(s2.version, '2.1.301 (Claude Code)');
  assert.notEqual(s2, s1);
  assert.equal(runner.findClaude(cfg), s2, 'the refreshed status is the cached one now');
});

// ── review fixes (regressions) ──────────────────────────────────────────────

test('option letters: Vietnamese references are caught (Unicode-aware), prose is not; "(Select TWO.)" is a valid marker', async () => {
  const { LETTER_REF_RE, CHOOSE_RE } = await import('../server/lib/pack-format.ts');
  for (const s of ['> 🇻🇳 Chọn đáp án B vì Multi-AZ.', 'Đáp án B đúng.', '> 🇻🇳 Phương án B đúng; phương án C sai.', 'Lựa chọn C sai vì chậm.', 'Đáp án đúng là B vì…', 'phương án sai là C', 'Option B is wrong', 'answer C', '(B) is wrong', 'RPO = A', '- A: wrong']) {
    assert.ok(LETTER_REF_RE.test(s), s);
  }
  for (const s of ['answer a few questions', 'RPO = a few minutes', 'lựa chọn tốt nhất', 'phương án Bảo mật', 'Lựa chọn tốt nhất là Amazon RDS', 'đáp án đúng là AWS Lambda', 'Use option groups for RDS']) {
    assert.ok(!LETTER_REF_RE.test(s), s);
  }
  assert.match('Which TWO actions meet these requirements? (Select TWO.)', CHOOSE_RE);
  const bank = loadBank();
  const two = aiOut.draftOf(NEW_Q({ stem: `${NEW_Q().stem} (Select TWO.)`, answer: ['A', 'B'] }), 'doc-x-01', { tax: bank.taxonomy, today: TODAY, kind: 'generate', bank });
  assert.deepEqual(two.errors, []);
  const vn = aiOut.draftOf(NEW_Q({ explanation: `${GOOD_EXPLANATION}\n> 🇻🇳 Phương án A đúng vì failover tự động.` }), 'doc-x-01', { tax: bank.taxonomy, today: TODAY, kind: 'generate', bank });
  assert.match(vn.errors.join(' '), /chữ cái đáp án/);
});

test('verify: empty pick + ambiguous is "ambiguous", ids are normalised, error answers never count as verified', () => {
  resetPack();
  const file = path.join(home, 'bank', 'packs', 'ai', 'v-err.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, vpack('v-err', 'ai', ['ve-01', 've-02', 've-03']));
  try {
    const bank = loadBank();
    const [q1, q2, q3] = ['ve-01', 've-02', 've-03'].map((id) => bank.byId.get(id)!);
    assert.equal(verify.judge(q1, { answer: [], ambiguous: true, confidence: 'high', reason: 'không lựa chọn nào đúng' }).outcome, 'ambiguous');
    assert.equal((verify.VERIFY_SCHEMA.properties.results.items.properties.answer as { minItems?: number }).minItems, 1);
    const vs = verify.verdictsFor([q1, q2, q3], { results: [{ id: '`ve-01`', answer: ['B'] }, { id: ' ve-02 ', answer: ['A', 'C'] }] }, { runId: 'r-err' });
    assert.deepEqual(vs.map((v) => [v.qid, v.outcome]), [
      ['ve-01', 'ok'],
      ['ve-02', 'ok'],
      ['ve-03', 'error'],
    ], 'ids in backticks / with spaces match; the omitted one is an error');
    verify.appendVerdicts(vs);
    const b2 = loadBank();
    const s = verify.verifySummary(b2);
    assert.deepEqual([s.verified, s.ok, s.review, s.stale], [2, 2, 0, 0]);
    assert.ok(verify.verifyTargets(b2, { scope: 'unverified-ai' }).ids.includes('ve-03'), 'an error answer is picked again');
    assert.ok(verify.verifyTargets(b2, { scope: 'new' }).ids.includes('ve-03'));
    assert.ok(!verify.verifyTargets(b2, { scope: 'changed' }).ids.includes('ve-03'));
    assert.equal(verify.latestVerdicts(b2)['ve-03'], undefined);
  } finally {
    for (const f of [file, verify.VERIFY_FILE]) fs.rmSync(f, { force: true });
  }
});

test('verify: a question the blind-solve drafted stays queued until decided (any version), approve / OK re-verify reactivate it, an approved version is never re-drafted, a stale decision is refused', () => {
  resetPack();
  const file = path.join(home, 'bank', 'packs', 'ai', 'v-dr.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, vpack('v-dr', 'ai', ['vd-01', 'vd-03', 'vd-05']));
  const q = (id: string) => loadBank().byId.get(id)!;
  const solve = (id: string, answer: string[], runId: string) => {
    const vs = verify.verdictsFor([q(id)], { results: [{ id, answer, confidence: 'high', ambiguous: false, reason: 'r' }] }, { model: 'opus', runId });
    verify.appendVerdicts(vs);
    return vs;
  };
  const queued = (id: string) => verify.verifySummary(loadBank()).pending.find((p) => p.qid === id);
  try {
    // (a) drafted → fixed by an edit (new hash) → re-verified OK by a plain append (no runner): still queued, approve reactivates
    verify.autoDraft(verify.draftCandidates(solve('vd-01', ['A'], 'r1'), loadBank()), 'r1', TODAY);
    assert.equal(q('vd-01').status, 'draft');
    const fix = applyPatchItems([{ id: 'vd-01', base: q('vd-01').hash, options: { A: 'Multi-AZ deployment in a second AWS Region' } }], { today: TODAY });
    assert.equal(fix.items[0].status, 'applied');
    assert.equal(queued('vd-01')?.decision, 'drafted', 'edited after drafting: stays in the queue');
    solve('vd-01', ['A'], 'r2'); // still a mismatch on the new version
    assert.equal(queued('vd-01')?.outcome, 'mismatch');
    assert.throws(() => verify.decide('vd-01', 'approve', undefined, 'deadbeef00'), verify.VerifyConflictError, 'a decision on an older version is refused');
    assert.equal(verify.decide('vd-01', 'approve', undefined, q('vd-01').hash).decision, 'approved');
    assert.equal(q('vd-01').status, 'active', 'approve reactivates a verifier-drafted question whatever its version');
    assert.equal(queued('vd-01'), undefined);

    // (b) drafted → the same version re-verified OK through the runner path (reactivate) → active again, automatic decision
    const v3 = solve('vd-03', ['A', 'B'], 'r3');
    verify.autoDraft(verify.draftCandidates(v3, loadBank()), 'r3', TODAY);
    assert.equal(q('vd-03').status, 'draft');
    const ok = solve('vd-03', ['A', 'C'], 'r4');
    assert.equal(queued('vd-03')?.decision, 'drafted', 'OK verdict appended alone: queued until decided');
    assert.deepEqual(verify.reactivate(ok, 'r4'), { reactivated: ['vd-03'], errors: [] });
    assert.equal(q('vd-03').status, 'active');
    assert.equal(queued('vd-03'), undefined);
    assert.match(fs.readFileSync(verify.VERIFY_FILE, 'utf8'), /`vd-03` · ✅ tự dùng lại \(giải mù khớp\)/);

    // (c) approved mismatch → the same version solved wrong again is not drafted again
    verify.autoDraft(verify.draftCandidates(solve('vd-05', ['A'], 'r5'), loadBank()), 'r5', TODAY);
    verify.decide('vd-05', 'approve');
    assert.equal(q('vd-05').status, 'active');
    assert.deepEqual(verify.draftCandidates(solve('vd-05', ['A'], 'r6'), loadBank()), [], 'your approval of this version stands');
    assert.equal(queued('vd-05'), undefined);
  } finally {
    for (const f of [file, verify.VERIFY_FILE]) fs.rmSync(f, { force: true });
  }
});

test('coach lock: taken atomically; a live holder means busy, a dead one is replaced; only our own lock is released', () => {
  const lock = path.join(home, 'coach', '.lock');
  fs.rmSync(lock, { force: true });
  try {
    fs.writeFileSync(lock, JSON.stringify({ pid: process.ppid, runId: 'other-run' })); // a live process (our parent)
    assert.throws(() => runner.acquireLock('mine'), /pid \d+\) đang chạy coach: other-run/);
    fs.writeFileSync(lock, '');
    assert.throws(() => runner.acquireLock('mine'), /đang bắt đầu chạy coach/, 'a lock being written right now counts as held');
    fs.writeFileSync(lock, JSON.stringify({ pid: 2 ** 22 + 12345, runId: 'dead-run' })); // no such process
    runner.acquireLock('mine');
    assert.deepEqual(JSON.parse(fs.readFileSync(lock, 'utf8')), { pid: process.pid, runId: 'mine' });
    runner.releaseLock('someone-else');
    assert.ok(fs.existsSync(lock), 'not ours → kept');
    runner.releaseLock('mine');
    assert.ok(!fs.existsSync(lock));
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, runId: 'crashed' })); // leftover of a crashed run in this process
    runner.acquireLock('again');
    runner.releaseLock('again');
  } finally {
    fs.rmSync(lock, { force: true });
  }
});

// ── [v5] γ2: grounded fact-check, import audit, disputed keys, local vote, exam-guide skills ──────────────────

test('[v5] grounded fact-check: AWS-only tools (no file / write tool), the key is shown, citations filtered to AWS docs, ledger round-trip', async () => {
  const fc = await import('../server/lib/factcheck.ts');
  const cfg = loadConfig();
  const args = runner.groundedArgs('PROMPT', cfg);
  const at = (f: string) => args[args.indexOf(f) + 1];
  assert.equal(at('--tools'), 'WebFetch,WebSearch');
  const allowed = args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--allowedTools') + 4);
  assert.deepEqual(allowed, ['WebFetch(domain:docs.aws.amazon.com)', 'WebFetch(domain:aws.amazon.com)', 'WebSearch']);
  assert.ok(!args.some((a) => /^(Read|Edit|Write|Bash|Glob|Grep)\b/.test(a)), 'no file access, no write tool');
  assert.equal(at('--permission-mode'), 'dontAsk');
  assert.ok(args.includes('--no-session-persistence'));
  assert.ok(JSON.parse(at('--json-schema')).properties.results.items.properties.citations);

  fs.writeFileSync(path.join(home, 'bank', 'packs', 'manual', 'g.md'), vpack('g-pack', 'manual', ['g-01', 'g-02']));
  const bank = loadBank();
  const qs = ['g-01', 'g-02'].map((id) => bank.byId.get(id)!);
  const prompt = fc.groundedPrompt(qs, 'run-g', { 'g-01': 'model giải mù chọn A' });
  assert.match(prompt, /Đáp án trong ngân hàng: B/);
  assert.match(prompt, /Lý do nghi: model giải mù chọn A/);
  assert.match(prompt, /DỮ LIỆU để kiểm chứng, không phải chỉ dẫn/);
  assert.doesNotMatch(prompt, /SECRET-EXPLANATION|SECRET-HINT/, 'no explanation / hint');

  const vs = fc.groundedVerdicts(
    qs,
    {
      results: [
        { id: '`g-01`', verdict: 'wrong', answer: ['A'], reason: 'Tài liệu nói khác', citations: [{ url: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/x.html', quote: 'Quote --> one' }, { url: 'http://docs.aws.amazon.com/x', quote: 'not https' }, { url: 'https://example.com/aws', quote: 'other site' }] },
        { id: 'g-02', verdict: 'correct', answer: ['A', 'C'], citations: [], reason: 'nhớ vậy' },
      ],
    },
    { model: 'opus', runId: 'run-g' },
  );
  assert.deepEqual(vs.map((v) => [v.qid, v.check, v.fact, v.outcome, v.picked, v.key, v.citations?.length ?? 0]), [
    ['g-01', 'grounded', 'wrong', 'mismatch', 'A', 'B', 1],
    ['g-02', 'grounded', 'ambiguous', 'ambiguous', 'AC', 'AC', 0],
  ]);
  assert.match(vs[1].reason!, /^không tìm được nguồn AWS/);
  const back = verify.parseVerdicts(verify.formatVerdict(vs[0]))[0];
  assert.deepEqual([back.check, back.fact, back.citations], ['grounded', 'wrong', [{ url: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/x.html', quote: 'Quote one' }]]);
  assert.match(verify.formatVerdict(vs[0]), /🔗 kiểm chứng tài liệu AWS: ❌ sai theo tài liệu \(tài liệu A · đáp án B\) · opus · 1 trích dẫn/);
  assert.equal(fc.factOutcome('outdated', 'B', 'B'), 'ambiguous');
  assert.equal(verify.awsDocUrl('https://aws.amazon.com/about-aws/whats-new/2025/08/x/'), 'https://aws.amazon.com/about-aws/whats-new/2025/08/x/');
  assert.equal(verify.awsDocUrl('https://aws.amazon.com.evil.io/x'), undefined);
});

test('[v5] review queue + disputedIds: blind mismatch → disputed; a newer fact-check confirming the key clears "disputed" (still queued); grounded wrong queues a never-solved question; decisions', () => {
  const ledgerFile = verify.VERIFY_FILE;
  const saved = fs.existsSync(ledgerFile) ? fs.readFileSync(ledgerFile, 'utf8') : undefined;
  fs.rmSync(ledgerFile, { force: true });
  fs.writeFileSync(path.join(home, 'bank', 'packs', 'manual', 'd.md'), vpack('d-pack', 'manual', ['d-01', 'd-03', 'd-05']));
  try {
    const bank = loadBank();
    const h = (id: string) => bank.byId.get(id)!.hash;
    const v = (qid: string, at: string, more: Partial<VerifyVerdict>): VerifyVerdict => ({ date: at.slice(0, 10), at, qid, hash: h(qid), outcome: 'ok', key: 'B', ...more });
    verify.appendVerdicts([
      v('d-01', '2026-10-19T10:00:00+07:00', { outcome: 'mismatch', picked: 'A' }),
      v('d-03', '2026-10-19T10:00:00+07:00', { outcome: 'mismatch', picked: 'A' }),
      v('d-03', '2026-10-19T11:00:00+07:00', { check: 'grounded', fact: 'correct', outcome: 'ok', picked: 'B', citations: [{ url: 'https://docs.aws.amazon.com/a', quote: 'q' }] }),
      v('d-05', '2026-10-19T11:00:00+07:00', { check: 'grounded', fact: 'outdated', outcome: 'ambiguous', picked: 'B' }),
    ]);
    assert.deepEqual([...verify.disputedIds(loadBank())].sort(), ['d-01', 'd-05']);
    const s = verify.verifySummary(loadBank());
    assert.deepEqual(s.pending.map((p) => p.qid).sort(), ['d-01', 'd-03', 'd-05']);
    assert.equal(s.disputed, 2);
    assert.equal(s.grounded, 2);
    const shown = verify.latestVerdicts(loadBank());
    assert.equal(shown['d-03'].grounded?.fact, 'correct', 'the fact-check rides along with the blind verdict');
    assert.equal(shown['d-05'].check, 'grounded', 'stands alone when never blind-solved');
    // grounded targets skip questions already fact-checked for this version
    assert.deepEqual(verify.groundedTargets(loadBank(), {}, { issues: [] }, verify.loadVerdicts(), new Set()).ids, ['d-01']);
    // a decision on the grounded-only question works (basis = the fact-check) and clears it
    verify.decide('d-05', 'approve', 'đã sửa tên dịch vụ');
    assert.deepEqual([...verify.disputedIds(loadBank())], ['d-01']);
    // an open wrong-key issue makes a question a target
    assert.ok(verify.groundedTargets(loadBank(), {}, { issues: [{ line: 1, open: true, date: '2026-10-19', qid: 'd-05', type: 'outdated', note: 'x' }] }, verify.loadVerdicts(), new Set()).ids.includes('d-01'));
  } finally {
    fs.rmSync(path.join(home, 'bank', 'packs', 'manual', 'd.md'), { force: true });
    if (saved !== undefined) fs.writeFileSync(ledgerFile, saved);
    else fs.rmSync(ledgerFile, { force: true });
  }
});

test('[v5] import audit targets: imported only, upcoming first, then multiple-response, never sealed / out of scope / already solved', () => {
  const file = path.join(home, 'bank', 'packs', 'imported', 'au.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, vpack('au-pack', 'imported', ['au-01', 'au-02', 'au-03', 'au-04']));
  try {
    const bank = loadBank();
    const ids = (o: Parameters<typeof verify.auditTargets>[1], sealed = new Set<string>()) => verify.auditTargets(bank, o, [], sealed).ids.filter((x) => x.startsWith('au-'));
    assert.deepEqual(ids({}), ['au-02', 'au-04', 'au-01', 'au-03'], 'multiple-response first');
    assert.deepEqual(ids({ upcoming: ['au-03'] }), ['au-03', 'au-02', 'au-04', 'au-01']);
    assert.deepEqual(ids({}, new Set(['au-02'])), ['au-04', 'au-01', 'au-03']);
    const solved: VerifyVerdict[] = [{ date: '2026-10-19', qid: 'au-04', hash: bank.byId.get('au-04')!.hash, outcome: 'ok' }];
    assert.ok(!verify.auditTargets(bank, {}, solved, new Set()).ids.includes('au-04'));
    const st = verify.auditStatus(bank, [], solved, new Set());
    assert.ok(st.imported >= 4 && st.audited === 1 && st.next.length <= verify.MAX_AUDIT);
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test('[v5] local vote: Ollama /api/chat (json, temperature 0) → check:local verdicts; failures are clear messages', async () => {
  const http = await import('node:http');
  const fc = await import('../server/lib/factcheck.ts');
  fs.writeFileSync(path.join(home, 'bank', 'packs', 'manual', 'l.md'), vpack('l-pack', 'manual', ['l-01']));
  let body: Record<string, unknown> = {};
  const srv = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      body = JSON.parse(raw);
      if (body.model === 'missing') {
        res.writeHead(404).end('{}');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: { content: JSON.stringify({ results: [{ id: 'l-01', answer: ['A'], confidence: 'high', ambiguous: false, reason: 'local' }] }) } }));
    });
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const url = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  try {
    const q = loadBank().byId.get('l-01')!;
    const vs = await fc.localVotes([q], { url, model: 'qwen-test', runId: 'run-l' });
    assert.deepEqual(vs.map((v) => [v.qid, v.check, v.outcome, v.picked, v.confidence, v.model]), [['l-01', 'local', 'mismatch', 'A', 'high', 'qwen-test']]);
    assert.equal(body.format, 'json');
    assert.deepEqual(body.options, { temperature: 0 });
    assert.doesNotMatch(JSON.stringify(body), /SECRET-EXPLANATION/, 'the local model sees no key / explanation');
    await assert.rejects(fc.localVotes([q], { url, model: 'missing', runId: 'r' }), /ollama pull missing/);
    await assert.rejects(fc.localVotes([q], { url: 'http://127.0.0.1:9', model: 'x', runId: 'r', timeoutMs: 2000 }), /Không gọi được Ollama/);
  } finally {
    srv.close();
    fs.rmSync(path.join(home, 'bank', 'packs', 'manual', 'l.md'), { force: true });
  }
});

test('[v5] exam-guide skills: params.skills validated, generate questions must name a requested bullet, prompts list the bullets', () => {
  assert.deepEqual(runner.skillParam(['3.5.S7', '3.5.s7', '4.4.k2']), ['3.5.s7', '4.4.k2']);
  assert.deepEqual(runner.skillParam(undefined), []);
  assert.throws(() => runner.skillParam(['3.5', 'x']), /không hợp lệ/);
  const lines = runner.skillLines(['3.5.s7']).join('\n');
  assert.match(lines, /mục đề cương cần phủ/);
  assert.match(lines, /`3\.5\.s7`/);
  const bank = loadBank();
  const raw = {
    domain: 'resilient',
    task: '2.2',
    topic: 'database',
    services: ['RDS'],
    tags: [],
    difficulty: 'medium',
    concept: 'c',
    hint: 'Cơ chế nào giữ bản sao đồng bộ?',
    stem: 'A company must keep its Amazon RDS database available during an Availability Zone outage without code changes. Which design should be used?',
    options: ['Multi-AZ deployment', 'Read replica', 'Hourly snapshots', 'Manual restore'],
    answer: ['A'],
    explanation: 'x',
  };
  const ctx = { tax: bank.taxonomy, today: '2026-10-20', kind: 'generate' as const, bank, skills: ['2.2.s1'] };
  assert.match(aiOut.draftOf(raw, 'doc-x-01', ctx).errors.join(' '), /ít nhất một mục đề cương của lượt này/);
  const ok = aiOut.draftOf({ ...raw, skills: ['2.2.S1', 'bogus'] }, 'doc-x-01', ctx);
  assert.deepEqual(ok.draft?.skills, ['2.2.s1']);
  assert.match(ok.warnings.join(' '), /"bogus" không đúng dạng/);
  // longform targets restricted to the bullets (by stored skills, else by their task)
  const states = new Map<string, QuestionState>();
  const t = enrich.longformTargets(bank, states, 20, new Set(), { skills: ['3.1.s1'] });
  assert.ok(t.every((x) => x.q.task === '3.1' || (x.q.skills ?? []).includes('3.1.s1')));
  // task deficits push their tasks first; idle runs only take tasks still short
  const idle = enrich.longformTargets(bank, states, 20, new Set(), { deficits: [{ task: '1.1', longForm: 0, target: 12, need: 12 }], deficitOnly: true });
  assert.ok(idle.every((x) => x.q.task === '1.1'));
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
  assert.equal(runner.findClaude(loadConfig(), true).path, fake, 'the CLI status cached by an earlier test is replaced');
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
      runner.coachRunner.start('analyze', 'manual', {}, { syncBefore: false, syncAfter: false });
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
