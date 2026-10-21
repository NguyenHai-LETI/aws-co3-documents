// Bank operations behind the /trainer-import and /trainer-coverage skills: merging new practice-exam
// questions into an existing pack, coverage vs the exam guide, ENRICH batches by id. Run: npm test
// Everything works on temp files; the real bank is only read.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTaxonomy } from '../server/lib/taxonomy.ts';
import { parsePack } from '../server/lib/pack-format.ts';
import { computeCoverage, coverageMarkdown } from '../server/lib/coverage.ts';
import { selectBatch } from '../server/lib/enrich.ts';
import type { BankState } from '../server/lib/bank.ts';

const TRAINER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tax = loadTaxonomy();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-bank-ops-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// ── import --merge ──────────────────────────────────────────────────────────

const Q1 = `**1.** A web app needs automatic failover for its MySQL database within one Region. What should be used?

- A. RDS Read Replica
- B. RDS Multi-AZ deployment
- C. Amazon ElastiCache
- D. Amazon S3`;
const Q2 = `**2.** A Lambda function exhausts database connections on RDS PostgreSQL. What fixes this?

- A. Increase instance size
- B. Add Read Replicas
- C. Enable RDS Proxy
- D. Enable Multi-AZ`;
const PART_C = `## Part C — Câu hỏi bẫy (Traps)

**3.** A MySQL workload must survive a Region outage with RTO under one minute. Which is BEST?

- A. Multi-AZ deployment
- B. Cross-Region Read Replica
- C. Aurora Global Database
- D. Cross-Region snapshot copy`;
const ANSWERS = ['1_B - Multi-AZ keeps a synchronous standby with automatic failover.', '2_C - RDS Proxy pools connections for Lambda.'];

test('import --merge: appends new questions only, reports source edits, refuses renumbered files', () => {
  const home = path.join(tmp, 'home');
  const src = path.join(tmp, 'practice-exams');
  fs.mkdirSync(path.join(home, 'bank', 'packs', 'imported'), { recursive: true });
  fs.copyFileSync(path.join(TRAINER, 'bank', 'taxonomy.yaml'), path.join(home, 'bank', 'taxonomy.yaml'));
  fs.mkdirSync(src);
  const exam = path.join(src, '03-database-services-exam-v2.md');
  const answers = path.join(src, '03-database-services-answers-v2.txt');
  const pack = path.join(home, 'bank', 'packs', 'imported', '03-database-services-v2.md');
  const head = '# 🗄️ Practice Exam 03 — Database Services (SAA-C03) · V2\n\n## Part A — Vận dụng\n\n';
  const write = (questions: string[], answerLines: string[]) => {
    fs.writeFileSync(exam, head + questions.join('\n\n') + '\n');
    fs.writeFileSync(answers, answerLines.join('\n') + '\n');
  };
  const run = (...flags: string[]) => {
    const r = spawnSync(process.execPath, ['scripts/import-practice-exams.ts', '--src', src, ...flags], {
      cwd: TRAINER,
      env: { ...process.env, TRAINER_HOME: home },
      encoding: 'utf8',
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };

  write([Q1, Q2], ANSWERS);
  assert.equal(run().code, 0, 'first import writes the pack');
  const v1 = fs.readFileSync(pack, 'utf8');

  // a new Part C question in the source → appended, nothing else touched
  write([Q1, Q2, PART_C], [...ANSWERS, '3_C - Aurora Global Database fails over across Regions in about a minute.']);
  assert.match(run('--merge', '--dry-run').out, /dry run[\s\S]*thêm 1 câu — 03-v2-03/);
  assert.equal(fs.readFileSync(pack, 'utf8'), v1, 'dry run writes nothing');
  const merged = run('--merge');
  assert.equal(merged.code, 0);
  assert.match(merged.out, /\+1 câu mới/);
  const v2 = fs.readFileSync(pack, 'utf8');
  assert.ok(v2.startsWith(v1.replace(/\s+$/, '')), 'existing questions stay byte-for-byte');
  const parsed = parsePack(v2, 'bank/packs/imported/03-database-services-v2.md', tax);
  assert.deepEqual(parsed.problems.filter((p) => p.level === 'error'), []);
  assert.deepEqual(parsed.questions.map((q) => q.id), ['03-v2-01', '03-v2-02', '03-v2-03']);
  const q3 = parsed.questions[2];
  assert.equal(q3.difficulty, 'hard', 'Part C counts as a hard part');
  assert.ok(q3.created, 'appended questions are dated (trainer-review picks them up)');
  assert.equal(q3.options.find((o) => q3.answer.includes(o.key))?.text, 'Aurora Global Database');
  assert.equal(run('--merge').out.includes('+0 câu mới'), true, 'idempotent');
  assert.equal(fs.readFileSync(pack, 'utf8'), v2);

  // editing an imported question in the source is reported (with its base hash), never applied
  write([Q1.replace('within one Region', 'inside a single AWS Region'), Q2, PART_C], [...ANSWERS, '3_C - Aurora Global Database.']);
  const edited = run('--merge');
  assert.match(edited.out, /~ 03-v2-01 \[base [0-9a-f]{10}\]: nguồn khác ngân hàng ở đề/);
  assert.equal(fs.readFileSync(pack, 'utf8'), v2);

  // inserting a question in the middle shifts the ids → refused
  const inserted = '**2.** A team needs a managed graph database for fraud detection. Which service?\n\n- A. Neptune\n- B. DocumentDB\n- C. Redshift\n- D. Keyspaces';
  write([Q1, inserted, Q2.replace('**2.**', '**3.**'), PART_C.replace('**3.**', '**4.**')], ['1_B - a', '2_A - b', '3_C - c', '4_C - d']);
  const renumbered = run('--merge');
  assert.match(renumbered.out, /✗ 03-database-services-exam-v2\.md: câu trong nguồn đã bị đánh số lại/);
  assert.equal(fs.readFileSync(pack, 'utf8'), v2);

  assert.equal(run('--merge', '--force').code, 2);
});

// ── coverage + ENRICH by id ─────────────────────────────────────────────────

function bankOf(blocks: string[]): BankState {
  const text = `---\npack: t-pack\ntitle: T\norigin: manual\n---\n\n# T\n\n${blocks.join('\n---\n\n')}`;
  const { questions } = parsePack(text, 'bank/packs/manual/t.md', tax);
  return { version: 't', taxonomy: tax, packs: [], questions, byId: new Map(questions.map((q) => [q.id, q])), problems: [] };
}

const block = (id: string, domain: string, task: string, services: string, stem: string, status = 'active') =>
  [
    `## Q ${id}`,
    `- domain: ${domain}`,
    `- task: ${task}`,
    '- topic: database',
    `- services: ${services}`,
    '- difficulty: medium',
    '- time: 60',
    ...(status === 'active' ? [] : [`- status: ${status}`]),
    '',
    stem,
    '',
    '- A. Use the first managed option for this workload',
    '- B. Use the second managed option for this workload',
    '- C. Use the third managed option for this workload',
    '- D. Use the fourth managed option for this workload',
    '',
    '**Answer:** A',
    '',
    '**Explanation:** The first option fits; the others miss one requirement each.',
    '',
  ].join('\n');

test('coverage: domain share vs exam weight, thin tasks, services without questions, qualifier misfits', () => {
  const bank = bankOf([
    block('c1', 'cost', '4.1', 'S3', 'Which storage class is the MOST cost-effective for rarely read logs?'),
    block('r1', 'resilient', '2.2', 'RDS', 'Which design keeps the database available after an AZ failure at the LOWEST cost?'),
    block('s1', 'secure', '1.1', 'IAM', 'How should developers get temporary access to production accounts?'),
    block('p1', 'performance', '3.4', 'CloudFront', 'How can a global audience get lower latency for static files?'),
    block('p2', 'performance', '3.4', 'CloudFront', 'How can video segments load faster for viewers abroad?'),
    block('x1', 'cost', '4.3', 'DynamoDB', 'Which capacity mode is cheapest for spiky traffic?', 'retired'),
  ]);
  const c = computeCoverage(bank, '2026-10-17');
  assert.equal(c.total, 5, 'retired questions do not count');
  const d = Object.fromEntries(c.domains.map((x) => [x.id, x]));
  assert.equal(d.secure.count, 1);
  assert.equal(d.secure.missing, 1, '1 of 5 = 20 % < 30 %: one more secure question reaches the weight');
  assert.equal(d.performance.share, 40);
  assert.equal(d.performance.missing, 0);
  const t = Object.fromEntries(c.tasks.map((x) => [x.id, x]));
  assert.equal(t['2.1'].thin, true);
  assert.equal(t['2.2'].thin, false);
  assert.equal(t['3.4'].count, 2);
  assert.ok(c.services.none.database.includes('MemoryDB'));
  assert.ok(!Object.values(c.services.none).flat().includes('RDS'));
  assert.deepEqual(
    c.misfits.map((m) => [m.id, m.from, m.to]),
    [['r1', 'resilient', 'cost']],
  );
  const md = coverageMarkdown(c);
  assert.match(md, /\| D1 Kiến trúc bảo mật \| 30% \| 1 \| 20% \| thiếu ~1 câu \|/);
  assert.match(md, /`r1` \| D2 → D4 \| LOWEST cost/);

  // ENRICH batch restricted to the suspected misfits
  assert.deepEqual(
    selectBatch(bank, new Map(), { ids: ['r1', 'p1', 'nope'] }).map((i) => i.q.id).sort(),
    ['p1', 'r1'],
  );
});
