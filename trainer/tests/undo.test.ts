// [v5] γ2 — undo of an AI run (9-09): pre-images written by patches / packs / file-mode diffs, restores only while a
// question is still the version the run produced, created questions retired, undo-info. Temporary TRAINER_HOME.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-undo-'));
fs.mkdirSync(path.join(home, 'bank', 'packs', 'manual'), { recursive: true });
fs.copyFileSync(path.join(here, '..', 'bank', 'taxonomy.yaml'), path.join(home, 'bank', 'taxonomy.yaml'));
for (const d of ['results', 'coach/runs', 'coach/patches']) fs.mkdirSync(path.join(home, d), { recursive: true });
fs.writeFileSync(path.join(home, 'config.yaml'), 'coach:\n  model: opus\n');
process.env.TRAINER_HOME = home;
after(() => fs.rmSync(home, { recursive: true, force: true }));

const { loadBank } = await import('../server/lib/bank.ts');
const { applyPatchItems } = await import('../server/lib/patch.ts');
const undo = await import('../server/lib/undo.ts');
const aiOut = await import('../server/lib/ai-output.ts');

const PACK = path.join(home, 'bank', 'packs', 'manual', 'u.md');
const block = (id: string, extra = '') => `## Q ${id}
- domain: resilient
- topic: database
- difficulty: medium
- time: 60${extra}

A database for ${id} must fail over automatically when an Availability Zone fails. Which feature should be used?

- A. Read Replicas in another AZ
- B. Multi-AZ deployment
- C. Cross-Region snapshots
- D. Aurora Global Database

**Answer:** B

**Explanation:** Multi-AZ = automatic failover.`;
const write = () => fs.writeFileSync(PACK, `---\npack: u-pack\ntitle: Undo pack\norigin: manual\n---\n\n# Undo pack\n\nIntro stays.\n\n${['u-01', 'u-02', 'u-03'].map((id) => block(id)).join('\n\n---\n\n')}\n`);
const q = (id: string) => loadBank().byId.get(id)!;
const RUN = '2026-10-20_100000_enrich';

test('a patch with a run id saves the previous blocks; undo restores them, a second undo does nothing', () => {
  write();
  const original = fs.readFileSync(PACK, 'utf8');
  const r = applyPatchItems(
    [
      { id: 'u-01', base: q('u-01').hash, set: { hint: 'Cơ chế nào giữ bản sao đồng bộ?' } },
      { id: 'u-02', base: q('u-02').hash, options: { A: 'Read Replicas promoted by a script' } },
    ],
    { runId: RUN, today: '2026-10-20' },
  );
  assert.equal(r.applied, 2);
  const pre = undo.loadPreImage(RUN)!;
  assert.deepEqual(Object.keys(pre.questions).sort(), ['u-01', 'u-02']);
  assert.equal(pre.task, 'enrich');
  assert.match(pre.questions['u-01'].before, /^## Q u-01\n/);
  assert.deepEqual(undo.undoInfo('u-01', loadBank()), { run: RUN, at: pre.questions['u-01'].at, task: 'enrich' });
  assert.deepEqual(undo.undoableCounts(loadBank()).get(RUN), { changed: 2, created: 0 });

  const u = undo.undoRun(RUN);
  assert.deepEqual(u, { run: RUN, restored: ['u-01', 'u-02'], retired: [], conflicts: [] });
  assert.equal(fs.readFileSync(PACK, 'utf8'), original, 'byte-identical pack after the undo');
  assert.deepEqual(undo.undoRun(RUN), { run: RUN, restored: [], retired: [], conflicts: [] });
  assert.equal(undo.undoInfo('u-01', loadBank()), null);
  const log = JSON.parse(fs.readFileSync(undo.undoLogPath(RUN), 'utf8')) as unknown[];
  assert.equal(log.length, 1, 'only the undo that did something is logged');
});

test('a question changed again after the run is a conflict and stays untouched; qid-only undo; dry runs and preImage:false record nothing', () => {
  write();
  const run = '2026-10-20_110000_enrich';
  applyPatchItems([{ id: 'u-01', base: q('u-01').hash, set: { hint: 'Gợi ý một' } }, { id: 'u-03', base: q('u-03').hash, set: { hint: 'Gợi ý ba' } }], { runId: run, today: '2026-10-20' });
  // a later manual edit of u-01 (no run id → no pre-image)
  applyPatchItems([{ id: 'u-01', base: q('u-01').hash, set: { hint: 'Sửa tay sau đó' } }], { today: '2026-10-20' });
  assert.equal(undo.undoInfo('u-01', loadBank()), null, 'the last change of u-01 was not this run');
  const one = undo.undoRun(run, { qid: 'u-03' });
  assert.deepEqual(one, { run, restored: ['u-03'], retired: [], conflicts: [] });
  const rest = undo.undoRun(run);
  assert.deepEqual(rest.restored, []);
  assert.equal(rest.conflicts.length, 1);
  assert.equal(rest.conflicts[0].id, 'u-01');
  assert.match(rest.conflicts[0].reason, /đã thay đổi sau lượt AI này/);
  assert.equal(q('u-01').hint, 'Sửa tay sau đó');
  assert.throws(() => undo.undoRun(run, { qid: 'u-02' }), /không sửa hay tạo câu u-02/);
  assert.throws(() => undo.undoRun('2026-10-20_000000_nope'), (e: Error & { status?: number }) => e.status === 404);
  assert.throws(() => undo.undoRun('../x'), /không hợp lệ/);

  applyPatchItems([{ id: 'u-02', base: q('u-02').hash, set: { hint: 'Dry' } }], { runId: 'dry-run-x', dryRun: true });
  applyPatchItems([{ id: 'u-02', base: q('u-02').hash, set: { hint: 'No pre-image' } }], { runId: 'no-pre-x', preImage: false });
  assert.equal(undo.loadPreImage('dry-run-x'), undefined);
  assert.equal(undo.loadPreImage('no-pre-x'), undefined);
});

test('questions a pack created are retired by the undo (ids kept); the run record notes the undo', () => {
  write();
  const bank = loadBank();
  const run = '2026-10-20_120000_twins';
  const plan = aiOut.planPack({ kind: 'twins', runId: run, today: '2026-10-20', idPrefix: 'ai-20261020-1200-tw', packId: 'ai-2026-10-20-1200-twins' }, { pack: { slug: 'x', title: 'X' } }, bank);
  const d = aiOut.draftOf(
    {
      domain: 'resilient',
      task: '2.2',
      topic: 'database',
      services: ['RDS'],
      tags: ['multi-az'],
      difficulty: 'medium',
      concept: 'c',
      hint: 'Cơ chế nào giữ bản sao đồng bộ khi mất một AZ?',
      variant_of: ['u-01'],
      stem: 'A retail startup keeps orders in one Amazon RDS instance and must survive the loss of an Availability Zone without editing its code. Which change should be made?',
      options: ['Enable a Multi-AZ deployment of the instance', 'Add read replicas in other zones', 'Copy snapshots to another Region', 'Move the tables to Amazon S3'],
      answer: ['A'],
      explanation: 'Multi-AZ keeps a synchronous standby and fails over automatically behind the same endpoint, which is exactly what the scenario asks for without code changes.\n- Read replicas: asynchronous, promotion is manual.\n> 🇻🇳 Mất AZ + tự failover → Multi-AZ.',
    },
    plan.idOf(0),
    { tax: bank.taxonomy, today: '2026-10-20', kind: 'twins', originals: ['u-01'], bank },
  );
  assert.deepEqual(d.errors, []);
  const rel = aiOut.writePack(plan, [d.draft!]);
  assert.deepEqual(undo.loadPreImage(run)!.createdIds, ['ai-20261020-1200-tw01']);
  assert.deepEqual(undo.loadPreImage(run)!.packs, [rel]);
  assert.deepEqual(undo.undoInfo('ai-20261020-1200-tw01', loadBank()), { run, at: undo.loadPreImage(run)!.created, task: 'twins', created: true });
  fs.writeFileSync(path.join(home, 'coach', 'runs', `${run}.json`), JSON.stringify({ id: run, task: 'twins', trigger: 'manual', status: 'success', startedAt: '2026-10-20T12:00:00+07:00' }));
  const u = undo.undoRun(run);
  assert.deepEqual(u, { run, restored: [], retired: ['ai-20261020-1200-tw01'], conflicts: [] });
  assert.equal(q('ai-20261020-1200-tw01').status, 'retired');
  const rec = JSON.parse(fs.readFileSync(path.join(home, 'coach', 'runs', `${run}.json`), 'utf8'));
  assert.deepEqual(rec.outcome.undo.retired, ['ai-20261020-1200-tw01']);
});

test('file-mode runs: a capture before + diff after records edits, new questions and a block the AI broke (restored by undo)', () => {
  write();
  const before = undo.captureBlocks(loadBank());
  const original = fs.readFileSync(PACK, 'utf8');
  // the "AI" edits u-01 in place, breaks u-02 (no answer line) and appends a new question
  let text = original.replace('Multi-AZ = automatic failover.', 'Multi-AZ keeps a synchronous standby.');
  text = text.replace(/(## Q u-02[\s\S]*?)\*\*Answer:\*\* B\n\n/, '$1');
  fs.writeFileSync(PACK, text + '\n---\n\n' + block('u-09') + '\n');
  const run = '2026-10-20_130000_analyze';
  const d = undo.recordRunDiff(run, before, loadBank(), 'analyze');
  assert.deepEqual(d.changed.sort(), ['u-01', 'u-02']);
  assert.deepEqual(d.created, ['u-09']);
  assert.equal(undo.loadPreImage(run)!.questions['u-02'].afterSig, undo.MISSING_SIG);
  const u = undo.undoRun(run);
  assert.deepEqual(u.restored.sort(), ['u-01', 'u-02']);
  assert.deepEqual(u.retired, ['u-09']);
  assert.equal(q('u-02').answer.join(''), 'B');
  assert.match(q('u-01').explanation, /automatic failover/);
});

test('questionSig: every stored field counts, computed ones do not', () => {
  write();
  const a = q('u-01');
  assert.equal(undo.questionSig(a), undo.questionSig({ ...a, requirements: ['cost'], outOfScope: true }));
  assert.notEqual(undo.questionSig(a), undo.questionSig({ ...a, hint: 'x' }));
  assert.notEqual(undo.questionSig(a), undo.questionSig({ ...a, status: 'draft' }));
  assert.equal(undo.taskOfRun('2026-10-20_120000_family-2'), 'family');
  assert.equal(undo.taskOfRun('2026-10-20_120000_enrich-verify'), 'enrich');
  assert.equal(undo.taskOfRun('hand-made'), 'patch');
});

test('[R3] a block the AI deleted entirely comes back (appended to its pack) on undo', () => {
  write();
  const before = undo.captureBlocks(loadBank());
  const raw = fs.readFileSync(PACK, 'utf8');
  fs.writeFileSync(PACK, raw.replace(/\n---\n\n## Q u-03[\s\S]*$/, '\n'));
  assert.equal(loadBank().byId.has('u-03'), false);
  const run = '2026-10-20_140000_analyze';
  assert.deepEqual(undo.recordRunDiff(run, before, loadBank(), 'analyze').changed, ['u-03']);
  const u = undo.undoRun(run);
  assert.deepEqual(u, { run, restored: ['u-03'], retired: [], conflicts: [] });
  assert.equal(q('u-03').answer.join(''), 'B');
  assert.deepEqual(loadBank().questions.filter((x) => x.file.endsWith('u.md')).map((x) => x.id), ['u-01', 'u-02', 'u-03']);
});
