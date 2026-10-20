// [v5 τ] 📒 mistake notebook: file format (parse / render / hand edits), merge by key, delete / merge, sealed ids never
// written or shown, the update batch (what is sent, the "through" mark), and a full update through the fake CLI
// (tests/helpers/fake-claude-tutor.mjs: argv, stdin prompt, schema output, invalid entries dropped). Run: npm test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnswerRecord, Attempt } from '../shared/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-notebook-')));
const LOG = path.join(home, 'fake-claude.log');
fs.mkdirSync(path.join(home, 'bank', 'packs', 'manual'), { recursive: true });
fs.copyFileSync(path.join(here, '..', 'bank', 'taxonomy.yaml'), path.join(home, 'bank', 'taxonomy.yaml'));
for (const d of ['results', 'coach/qa']) fs.mkdirSync(path.join(home, d), { recursive: true });
fs.copyFileSync(path.join(here, '..', 'coach', 'NOTEBOOK.md'), path.join(home, 'coach', 'NOTEBOOK.md'));
fs.writeFileSync(path.join(home, 'config.yaml'), 'coach:\n  model: opus\n  models: { notebook: sonnet }\nexam:\n  sealed_forms: 0\nsync:\n  auto: off\n');
const q = (id: string, domain: string, topic: string, stem: string, options: string[], answer: string, refs = '') =>
  [
    `## Q ${id}`,
    `- domain: ${domain}`,
    `- topic: ${topic}`,
    '- difficulty: medium',
    '- time: 60',
    ...(refs ? [`- refs: ${refs}`] : []),
    '',
    stem,
    '',
    ...options.map((o, i) => `- ${'ABCD'[i]}. ${o}`),
    '',
    `**Answer:** ${answer}`,
    '',
    '**Explanation:** Because the requirement says so.',
    '',
    '---',
    '',
  ].join('\n');
fs.writeFileSync(
  path.join(home, 'bank', 'packs', 'manual', 'nb.md'),
  [
    '---\npack: nb-pack\ntitle: Notebook pack\norigin: manual\n---\n\n# Notebook pack\n',
    q('nb-01', 'resilient', 'database', 'A database must fail over automatically. Which feature?', ['Read Replicas in another AZ', 'Multi-AZ deployment', 'Snapshots', 'Backups'], 'B', '03-database-services.md'),
    q('nb-02', 'resilient', 'database', 'Which option scales read traffic for RDS?', ['Multi-AZ standby', 'Read Replicas', 'Bigger instance', 'Snapshots'], 'B'),
    q('nb-03', 'performance', 'storage', 'Which storage is shared by many Linux instances?', ['EBS', 'EFS', 'Instance store', 'S3 Glacier'], 'B'),
    q('nb-04', 'cost', 'compute', 'A restartable batch job must be as cheap as possible. Which option?', ['Spot Instances', 'Reserved Instances', 'Dedicated Hosts', 'On-Demand'], 'A'),
    q('nb-05', 'secure', 'security', 'Which service manages encryption keys?', ['KMS', 'ACM', 'IAM', 'Macie'], 'A'),
  ].join('\n'),
);
process.env.TRAINER_HOME = home;
process.env.TRAINER_ALLOW_COACH = '1';
process.env.CLAUDE_BIN = path.join(here, 'helpers', 'fake-claude-tutor.mjs');
process.env.FAKE_CLAUDE_LOG = LOG;
process.env.FAKE_TUTOR_DIR = path.join(home, 'fake-sessions');
after(() => fs.rmSync(home, { recursive: true, force: true }));

const nb = await import('../server/lib/notebook.ts');
const { loadBank } = await import('../server/lib/bank.ts');
const { createAttempt } = await import('../server/lib/results.ts');

const NB = path.join(home, 'coach', 'notebook');
const read = (f: string) => fs.readFileSync(path.join(NB, f), 'utf8');
const SEALED = path.join(home, 'results', 'sealed.md');
const seal = (ids: string[]) => {
  // sealed.ts re-reads the file when its signature changes
  fs.writeFileSync(SEALED, `---\nkind: sealed\nsize: ${ids.length}\nforms:\n  - id: S1\n    status: sealed\n    ids: [ ${ids.join(', ')} ]\n---\n`);
};
const unseal = () => fs.rmSync(SEALED, { force: true });
const reset = () => fs.rmSync(NB, { recursive: true, force: true });
const inc = (o: Partial<import('../server/lib/notebook.ts').IncomingEntry> & { key: string; qids: string[] }) => ({
  domain: 'resilient' as const,
  title: 'Multi-AZ ≠ read scaling',
  misconception: 'Read Replicas cho failover tự động',
  rule: 'Failover tự động → Multi-AZ; đọc nhiều → Read Replicas',
  cues: ['fail over automatically'],
  contrast: 'Multi-AZ ⟷ Read Replica',
  refs: ['03-database-services.md'],
  confident: false,
  evidence: 1,
  source: 'ai' as const,
  ...o,
});

test('text helpers: keys, labels, cues, contrast', () => {
  assert.equal(nb.entryKey('RDS Multi-AZ vs Đọc bản sao!'), 'rds-multi-az-vs-doc-ban-sao');
  assert.ok(nb.entryKey('x'.repeat(30) + ' ' + 'y'.repeat(40)).length <= 60);
  assert.equal(nb.cleanMisconception('❌ Bạn nghĩ: SQS fan-out được'), 'SQS fan-out được');
  assert.equal(nb.cleanRule('Thực ra, SNS mới fan-out'), 'SNS mới fan-out');
  assert.deepEqual(nb.cleanCues(['“fan out”', 'Fan out', '"many subscribers"', '']), ['fan out', 'many subscribers']);
  assert.equal(nb.cleanContrast('SQS vs SNS'), 'SQS ⟷ SNS');
  assert.equal(nb.cleanContrast('EFS <-> EBS'), 'EFS ⟷ EBS');
  assert.equal(nb.cleanContrast('Savings Plans'), 'Savings Plans', 'a word containing "vs" is not split');
});

test('files: upsert writes readable sections, parses back, merges by key and keeps a hand-edited text', () => {
  reset();
  const r1 = nb.upsertEntries([inc({ key: 'multi-az-vs-read-replica', qids: ['nb-01'], confident: true })], '2026-10-19');
  assert.deepEqual(r1, { added: ['multi-az-vs-read-replica'], updated: [] });
  const text = read('resilient.md');
  assert.match(text, /^# 📒 Sổ lỗi · /);
  assert.match(text, /^## 🔥 Multi-AZ ≠ read scaling$/m);
  assert.match(text, /^<!-- nb \{"key":"multi-az-vs-read-replica","count":1,"confident":true,"updated":"2026-10-19","qids":\["nb-01"\],"refs":\["03-database-services.md"\],"source":"ai"\} -->$/m);
  assert.match(text, /^- ❌ \*\*Bạn nghĩ:\*\* Read Replicas cho failover tự động$/m);
  assert.match(text, /^- 🔎 \*\*Dấu hiệu trong đề:\*\* “fail over automatically”$/m);
  assert.match(text, /\[03-database-services\.md\]\(\.\.\/\.\.\/\.\.\/03-database-services\.md\)/);
  assert.match(read('README.md'), /<!-- notebook \{"through":null\} -->/);
  const [e] = nb.loadNotebook();
  assert.equal(e.key, 'multi-az-vs-read-replica');
  assert.equal(e.domain, 'resilient');
  assert.equal(e.rule, 'Failover tự động → Multi-AZ; đọc nhiều → Read Replicas');
  assert.equal(e.contrast, 'Multi-AZ ⟷ Read Replica');
  assert.equal(e.file, 'coach/notebook/resilient.md');

  // the learner rewrites the rule by hand; a later merge keeps it and adds the evidence
  fs.writeFileSync(path.join(NB, 'resilient.md'), text.replace('Failover tự động → Multi-AZ; đọc nhiều → Read Replicas', 'Tự failover = Multi-AZ (bản của tôi)'));
  const r2 = nb.upsertEntries([inc({ key: 'multi-az-vs-read-replica', qids: ['nb-02'], rule: 'AI rewrite', evidence: 2, cues: ['scale reads'] })], '2026-10-20');
  assert.deepEqual(r2, { added: [], updated: ['multi-az-vs-read-replica'] });
  const [m] = nb.loadNotebook();
  assert.equal(m.rule, 'Tự failover = Multi-AZ (bản của tôi)');
  assert.deepEqual(m.qids, ['nb-01', 'nb-02']);
  assert.equal(m.count, 3);
  assert.equal(m.confident, true, '🔥 stays');
  assert.equal(m.updated, '2026-10-20');
  assert.deepEqual(m.cues, ['fail over automatically', 'scale reads']);

  // a section the learner wrote by hand (no meta line) is an entry too; a free-text section is not
  fs.appendFileSync(path.join(NB, 'resilient.md'), '\n## Ghi chú của tôi\n\nChỉ là ghi chú.\n\n## EFS chia sẻ\n\n- ❌ **Bạn nghĩ:** EBS chia sẻ được\n- ✅ **Thực ra:** EFS mới chia sẻ nhiều instance\n');
  const keys = nb.loadNotebook().map((x) => x.key);
  assert.deepEqual(keys.sort(), ['efs-chia-se', 'multi-az-vs-read-replica']);
  assert.equal(nb.loadNotebook().find((x) => x.key === 'efs-chia-se')!.source, 'manual');
});

test('delete and merge entries (across domain files); unknown keys refused', () => {
  reset();
  nb.upsertEntries(
    [
      inc({ key: 'a-key', qids: ['nb-01'], count: 1 } as never),
      inc({ key: 'b-key', qids: ['nb-02'], confident: true, evidence: 2, contrast: '' }),
      inc({ key: 'c-key', domain: 'performance', qids: ['nb-03'], cues: ['shared file system'] }),
    ],
    '2026-10-18',
  );
  const merged = nb.mergeEntries(['a-key', 'b-key', 'c-key']);
  assert.equal(merged.key, 'a-key');
  assert.deepEqual(merged.qids, ['nb-01', 'nb-02', 'nb-03']);
  assert.equal(merged.count, 4);
  assert.equal(merged.confident, true);
  assert.deepEqual(nb.loadNotebook().map((e) => e.key), ['a-key']);
  assert.ok(!fs.existsSync(path.join(NB, 'performance.md')), 'an emptied domain file is removed');
  assert.throws(() => nb.mergeEntries(['a-key']), /ít nhất 2/);
  assert.throws(() => nb.mergeEntries(['a-key', 'nope']), /nope/);
  assert.equal(nb.deleteEntry('nope'), false);
  assert.equal(nb.deleteEntry('a-key'), true);
  assert.deepEqual(nb.loadNotebook(), []);
  assert.match(read('README.md'), /_Chưa có mục nào\._/);
});

test('sealed questions are never written into the notebook files nor shown', () => {
  reset();
  nb.upsertEntries([inc({ key: 'k', qids: ['nb-01', 'nb-02'] })]);
  seal(['nb-02']);
  try {
    assert.deepEqual(nb.loadNotebook()[0].qids, ['nb-01'], 'filtered on read');
    nb.upsertEntries([inc({ key: 'k', qids: ['nb-03'] })]);
    assert.ok(!read('resilient.md').includes('nb-02'), 'dropped on the next write');
    assert.equal(nb.addRule({ qid: 'nb-02', rule: 'x' }, loadBank()), undefined, 'no tutor rule for a sealed question');
  } finally {
    unseal();
  }
});

// ── the update batch ────────────────────────────────────────────────────────

const rec = (q: string, pick: string, key: string, extra: Partial<AnswerRecord> = {}): AnswerRecord => ({ q, pick, key, ok: pick === key, t: 30, est: 60, ...extra });
const att = (id: string, finished: string, answers: AnswerRecord[], extra: Partial<Attempt> = {}): Attempt =>
  ({ id, mode: 'quick', title: id, feedback: 'practice', started: finished, finished, timeLimit: 0, timeUsed: 0, timedOut: false, total: answers.length, answered: answers.length, correct: 0, score: 0, scaled: 100, passed: false, answers, file: `results/${id}.md`, ...extra }) as Attempt;

test('batch: wrong / unsure answers after the mark, oldest whole attempts first, no rushed / self-graded / sealed / relearn', () => {
  const bank = loadBank();
  const attempts = [
    att('a1', '2026-10-10T09:00:00+07:00', [rec('nb-01', 'A', 'B'), rec('nb-02', 'B', 'B', { unsure: true }), rec('nb-03', 'B', 'B'), rec('nb-04', '', 'A')]),
    att('a2', '2026-10-11T09:00:00+07:00', [rec('nb-01', 'A', 'B', { unsure: true, why: 'nghĩ replica tự failover' }), rec('nb-05', 'B', 'A', { relearn: true })]),
    att('rushed', '2026-10-12T09:00:00+07:00', [rec('nb-03', 'A', 'B')], { rushed: true }),
    att('listen', '2026-10-12T10:00:00+07:00', [rec('nb-03', '', 'B', { grade: 1 })], { source: 'listen' }),
    att('a3', '2026-10-13T09:00:00+07:00', [rec('nb-04', 'B', 'A', { hinted: true }), rec('nb-05', 'B', 'A')]),
  ];
  const all = nb.notebookBatch(attempts, bank, undefined, { now: Date.parse('2026-10-20T00:00:00+07:00'), sealed: new Set(['nb-05']) });
  assert.equal(all.total, 4); // a1: nb-01 wrong + nb-02 unsure · a2: nb-01 · a3: nb-04 (nb-05 sealed)
  assert.equal(all.answers, 4);
  assert.equal(all.through, '2026-10-13T09:00:00+07:00');
  assert.deepEqual(all.items.map((c) => c.qid), ['nb-01', 'nb-04', 'nb-02']);
  const first = all.items[0];
  assert.equal(first.times, 2);
  assert.equal(first.confident, true, 'wrong without unsure in a1');
  assert.equal(first.why, 'nghĩ replica tự failover');
  assert.equal(all.items[1].confident, false, 'hinted is not a confident error');

  // capped: whole attempts, the rest waits; after the mark only newer attempts count
  const capped = nb.notebookBatch(attempts, bank, undefined, { max: 2, now: Date.parse('2026-10-20T00:00:00+07:00'), sealed: new Set(['nb-05']) });
  assert.equal(capped.answers, 2);
  assert.equal(capped.through, '2026-10-10T09:00:00+07:00');
  assert.equal(capped.more, 2);
  const next = nb.notebookBatch(attempts, bank, capped.through, { sealed: new Set(['nb-05']) });
  assert.deepEqual(next.items.map((c) => c.qid).sort(), ['nb-01', 'nb-04']);
  assert.equal(nb.notebookBatch(attempts, bank, '2026-10-13T09:00:00+07:00').items.length, 0);
});

test('entries from the AI are checked: evidence inside the batch, labels stripped, refs allowed, duplicates merged', () => {
  const bank = loadBank();
  const batch = nb.notebookBatch([att('a1', '2026-10-10T09:00:00+07:00', [rec('nb-01', 'A', 'B'), rec('nb-02', 'A', 'B', { unsure: true })])], bank, '2026-10-01T00:00:00+07:00');
  const out = nb.notebookEntriesFrom(
    {
      entries: [
        { key: 'Multi AZ!', domain: 'cost', title: 't', misconception: 'Bạn nghĩ: x', rule: '✅ Thực ra: y', cues: ['a'], contrast: 'A vs B', qids: ['nb-01', 'nb-04', 'evil'], refs: ['03-database-services.md', '../../etc/passwd', 'Q-other.md'], confident: false },
        { key: 'multi-az', domain: 'resilient', title: 't2', misconception: 'x2', rule: 'y2', cues: ['b'], qids: ['nb-02'], confident: false },
        { key: 'no-evidence', domain: 'resilient', title: 't', misconception: 'x', rule: 'y', cues: [], qids: ['nb-05'], confident: true },
        { key: 'empty-rule', domain: 'resilient', title: 't', misconception: 'x', rule: '', cues: [], qids: ['nb-01'], confident: true },
      ],
    },
    batch,
    bank,
  );
  assert.equal(out.length, 1);
  const [e] = out;
  assert.equal(e.key, 'multi-az');
  assert.equal(e.domain, 'resilient', 'a domain none of its questions has falls back to theirs');
  assert.equal(e.misconception, 'x');
  assert.equal(e.rule, 'y');
  assert.equal(e.contrast, 'A ⟷ B');
  assert.deepEqual(e.qids, ['nb-01', 'nb-02']);
  assert.deepEqual(e.refs, ['03-database-services.md']);
  assert.equal(e.confident, true, 'nb-01 was a confident error');
  assert.equal(e.evidence, 2);
});

// ── a full update through the fake CLI ──────────────────────────────────────

const calls = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as { argv: string[]; stdin: string }) : []);
const flag = (argv: string[], name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);

test('updateNotebook: one structured call (no tools, model, NOTEBOOK.md, prompt on stdin), merged entries, then skipped', async () => {
  reset();
  const bank = loadBank();
  const mk = (q: string, pick: string, extra: Partial<AnswerRecord> = {}) => ({ ...rec(q, pick, bank.byId.get(q)!.answer.join('')), est: 60, ...extra });
  const now = Date.now();
  createAttempt({ mode: 'quick', title: 'one', started: new Date(now - 3_600_000).toISOString(), finished: new Date(now - 3_000_000).toISOString(), answers: [mk('nb-01', 'A'), mk('nb-02', 'A', { unsure: true }), mk('nb-03', 'B'), mk('nb-05', 'B')] }, bank);
  seal(['nb-05']);
  try {
    const before = calls().length;
    const run = await nb.updateNotebook({ trigger: 'cli' });
    assert.equal(run.status, 'success', JSON.stringify(run));
    assert.equal(run.answers, 2);
    assert.deepEqual(run.added, ['fake-database']);
    assert.equal(run.trigger, 'cli');
    const c = calls().slice(before);
    assert.equal(c.length, 1);
    const argv = c[0].argv;
    assert.equal(argv[0], '-p');
    assert.equal(argv[1], '--output-format', 'the prompt is not an argument');
    assert.equal(flag(argv, '--tools'), '');
    assert.equal(flag(argv, '--model'), 'sonnet');
    assert.match(flag(argv, '--system-prompt-file') ?? '', /coach[\\/]NOTEBOOK\.md$/);
    assert.ok(argv.includes('--no-session-persistence') && argv.includes('--strict-mcp-config') && !argv.includes('--resume'));
    assert.ok(JSON.parse(flag(argv, '--json-schema')!).properties.entries);
    assert.match(c[0].stdin, /### 1\. `nb-01` · domain `resilient` · topic `database`/);
    assert.ok(!c[0].stdin.includes('nb-05'), 'a sealed question is never sent');
    const [e] = nb.loadNotebook();
    assert.equal(e.key, 'fake-database');
    assert.equal(e.misconception, 'dịch vụ quen thuộc nhất luôn đúng cho database.', 'label stripped');
    assert.equal(e.contrast, 'SQS ⟷ SNS');
    assert.deepEqual(e.qids, ['nb-01', 'nb-02']);
    assert.equal(e.count, 2);
    assert.ok(!nb.loadNotebook().some((x) => x.key === 'fake-bogus'), 'an entry citing an id outside the batch is dropped');
    assert.ok(nb.notebookThrough(), 'the mark moved');
    assert.equal(nb.pendingAnswers(), 0);

    const again = await nb.updateNotebook();
    assert.equal(again.status, 'skipped');
    assert.equal(calls().length, before + 1, 'no AI call when nothing is new');

    createAttempt({ mode: 'quick', title: 'two', started: new Date(now - 60_000).toISOString(), finished: new Date(now - 30_000).toISOString(), answers: [mk('nb-01', 'C')] }, bank);
    assert.equal(nb.pendingAnswers(), 1);
    const third = await nb.updateNotebook();
    assert.equal(third.status, 'success');
    assert.deepEqual(third.updated, ['fake-database']);
    assert.match(calls().at(-1)!.stdin, /`fake-database` \(resilient\)/, 'existing keys are offered for reuse');
    assert.equal(nb.loadNotebook()[0].count, 3);
    assert.equal(nb.lastNotebookRun()?.status, 'success');
  } finally {
    unseal();
  }
});

test('updateNotebook never throws: a CLI failure becomes status "error"', async () => {
  const bank = loadBank();
  createAttempt({ mode: 'quick', title: 'three', started: new Date().toISOString(), finished: new Date().toISOString(), answers: [{ ...rec('nb-04', 'B', 'A'), est: 60 }] }, bank);
  process.env.FAKE_TUTOR_ERROR = '1';
  try {
    const r = await nb.updateNotebook();
    assert.equal(r.status, 'error');
    assert.match(r.error ?? '', /Claude Code báo lỗi/);
    assert.equal(nb.pendingAnswers(), 1, 'the mark did not move');
    assert.ok(!fs.existsSync(path.join(home, '.local', 'notebook.lock')), 'lock released');
  } finally {
    delete process.env.FAKE_TUTOR_ERROR;
  }
});

test('[R2] an attempt that arrives late (finished before the last update) is still sent; covered ids are kept', async () => {
  reset();
  const bank = loadBank();
  const now = Date.now();
  const mk = (q: string) => ({ ...rec(q, 'D', bank.byId.get(q)!.answer.join('')), est: 60 });
  const a1 = createAttempt({ mode: 'quick', title: 'r2-now', started: new Date(now - 120_000).toISOString(), finished: new Date(now - 60_000).toISOString(), answers: [mk('nb-03')] }, bank);
  let r = await nb.updateNotebook();
  assert.equal(r.status, 'success', JSON.stringify(r));
  assert.equal(nb.pendingAnswers(), 0);
  const cov = nb.notebookCoverage();
  assert.ok(cov.covered?.has(a1.id), 'the attempt id is recorded');
  // an offline resend: it finished two hours ago but reaches the server only now
  const late = createAttempt({ mode: 'quick', title: 'r2-late', started: new Date(now - 7_300_000).toISOString(), finished: new Date(now - 7_200_000).toISOString(), answers: [mk('nb-04')] }, bank);
  assert.equal(nb.pendingAnswers(), 1, 'not hidden by the newer finish time');
  r = await nb.updateNotebook();
  assert.equal(r.status, 'success');
  assert.equal(r.answers, 1);
  assert.ok(nb.notebookCoverage().covered?.has(late.id));
  assert.equal((await nb.updateNotebook()).status, 'skipped');
  // an index written before ids were kept (only `through`) still works: attempts up to it count as covered
  const legacy = att('old', '2026-01-01T00:00:00+07:00', [rec('nb-01', 'A', 'B')]);
  const fresh = att('new', new Date(now).toISOString(), [rec('nb-02', 'A', 'B')]);
  const b = nb.notebookBatch([legacy, fresh], bank, { through: new Date(now - 1000).toISOString() });
  assert.deepEqual(b.covers, ['new']);
});
