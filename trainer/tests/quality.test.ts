// Unit tests for bank migrations (answer rebalance, result remapping), task heuristic, quality metrics
// and ratings. Run: npm test — everything works on temp files; the real bank is only read.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadTaxonomy } from '../server/lib/taxonomy.ts';
import { parsePack } from '../server/lib/pack-format.ts';
import { splitFrontMatter, stringifyFrontMatter } from '../server/lib/frontmatter.ts';
import { guessTask, type TaskInput } from '../server/lib/classify.ts';
import {
  canonicalLayout,
  hasLetterRef,
  letterDistribution,
  mappingByText,
  migrateResults,
  rebalancePackText,
  replaceLetterRefs,
  setQuestionMeta,
  writeMigration,
} from '../server/lib/migrations.ts';
import { computeQuality, correctIsLongest, findDuplicates, variantCycles } from '../server/lib/quality.ts';
import { addRating, aggregateRatings, loadRatings, lowRatedIds, type RatingEntry } from '../server/lib/ratings.ts';
import type { BankState } from '../server/lib/bank.ts';
import type { Attempt, Question } from '../shared/types.ts';

const tax = loadTaxonomy();
const tmpDirs: string[] = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-quality-'));
  tmpDirs.push(d);
  return d;
};
after(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

interface Q {
  id: string;
  options: string[];
  answer: string[];
  stem?: string;
  explanation?: string;
  variantOf?: string;
  status?: string;
}

function packText(id: string, qs: Q[], origin = 'imported'): string {
  const blocks = qs.map((q) =>
    [
      `## Q ${q.id}`,
      '- domain: resilient',
      '- topic: database',
      '- difficulty: easy',
      '- time: 45',
      ...(q.variantOf ? [`- variant_of: ${q.variantOf}`] : []),
      ...(q.status ? [`- status: ${q.status}`] : []),
      '',
      q.stem ?? `Scenario ${q.id}: which option fits${q.answer.length > 1 ? ' (Choose TWO)' : ''}?`,
      '',
      ...q.options.map((t, i) => `- ${'ABCDEFGH'[i]}. ${t}`),
      '',
      `**Answer:** ${q.answer.join(', ')}`,
      '',
      `**Explanation:** ${q.explanation ?? 'Because it fits.'}`,
      '',
    ].join('\n'),
  );
  return `---\npack: ${id}\ntitle: Test pack\nexam: SAA-C03\norigin: ${origin}\n---\n\n# Test pack\n\n> Intro stays as is.\n\n${blocks.join('\n---\n\n')}`;
}

const opts4 = (n: number) => [`Right answer ${n}`, `Wrong one ${n}`, `Wrong two ${n}`, `Wrong three ${n}`];

function bankOf(text: string): BankState {
  const { questions, pack, problems } = parsePack(text, 'bank/packs/imported/t.md', tax);
  return { version: 'test', taxonomy: tax, packs: [pack], questions, byId: new Map(questions.map((q) => [q.id, q])), problems };
}

// ── answer rebalance ────────────────────────────────────────────────────────

test('rebalance spreads single-answer letters evenly, deterministically and idempotently', () => {
  const singles: Q[] = Array.from({ length: 40 }, (_, i) => ({ id: `t-s${i}`, options: opts4(i), answer: ['A'] }));
  const multis: Q[] = Array.from({ length: 8 }, (_, i) => ({ id: `t-m${i}`, options: [...opts4(100 + i), `Right too ${i}`], answer: ['A', 'E'] }));
  const text = packText('t-pack', [...singles, ...multis]);
  const r1 = rebalancePackText(text, 'bank/packs/imported/t.md', tax);
  assert.deepEqual(r1.problems, []);
  const after = parsePack(r1.text, 'bank/packs/imported/t.md', tax).questions;
  assert.deepEqual(letterDistribution(after.filter((q) => q.answer.length === 1)).single, { A: 10, B: 10, C: 10, D: 10 });
  assert.ok(new Set(after.filter((q) => q.answer.length > 1).map((q) => q.answer.join(''))).size > 1, 'multi-answer keys are permuted');
  // the correct option keeps its text, every option survives
  for (const q of after) {
    const n = q.id.replace(/^t-[sm]/, '');
    assert.ok(q.options.filter((o) => q.answer.includes(o.key)).every((o) => /^Right/.test(o.text)), `${q.id} correct text`);
    assert.equal(q.options.length, q.id.startsWith('t-m') ? 5 : 4);
    assert.ok(q.options.some((o) => o.text === `Wrong two ${q.id.startsWith('t-m') ? 100 + Number(n) : n}`));
  }
  // deterministic + idempotent
  assert.equal(rebalancePackText(text, 'bank/packs/imported/t.md', tax).text, r1.text);
  const r2 = rebalancePackText(r1.text, 'bank/packs/imported/t.md', tax);
  assert.equal(r2.changes.length, 0);
  assert.equal(r2.text, r1.text);
  // front matter, intro and separators are kept
  assert.ok(r1.text.startsWith('---\npack: t-pack\ntitle: Test pack\nexam: SAA-C03\norigin: imported\n---\n\n# Test pack\n\n> Intro stays as is.\n\n## Q t-s0\n'));
  assert.equal(r1.text.split('\n---\n').length, text.split('\n---\n').length);
  // mapping old → new matches the moved texts
  const c = r1.changes.find((x) => x.id === 't-s5')!;
  const before = parsePack(text, 'x.md', tax).questions.find((q) => q.id === 't-s5')!;
  const now = after.find((q) => q.id === 't-s5')!;
  for (const o of before.options) assert.equal(now.options.find((x) => x.key === c.mapping[o.key])!.text, o.text);
});

test('layout depends on content, not on the current option order', () => {
  const q = { id: 'x-01', options: [{ key: 'A', text: 'one' }, { key: 'B', text: 'two' }, { key: 'C', text: 'three' }, { key: 'D', text: 'four' }], answer: ['B'] };
  const shuffled = { id: 'x-01', options: [{ key: 'A', text: 'four' }, { key: 'B', text: 'three' }, { key: 'C', text: 'two' }, { key: 'D', text: 'one' }], answer: ['C'] };
  const a = canonicalLayout(q, 2);
  const b = canonicalLayout(shuffled, 2);
  assert.deepEqual(a.options, b.options);
  assert.deepEqual(a.answer, ['C']);
  assert.equal(a.options[2].text, 'two');
  assert.deepEqual(mappingByText(q.options, a.options), a.mapping);
});

test('options that refer to other options keep their order', () => {
  const text = packText('t-pos', [
    { id: 't-p1', options: ['Use S3', 'Use EBS', 'Both A and B', 'Neither'], answer: ['C'] },
    { id: 't-p2', options: ['Use S3', 'Use EBS', 'Use EFS', 'All of the above'], answer: ['D'] },
  ]);
  const r = rebalancePackText(text, 'bank/packs/imported/t.md', tax);
  assert.deepEqual(r.positional, ['t-p1', 't-p2']);
  assert.equal(r.changes.length, 0);
});

test('letter references in explanations become option text', () => {
  const options = [
    { key: 'A', text: 'Backup & Restore with frequent snapshots' },
    { key: 'B', text: 'Multi-Site Active-Active' },
    { key: 'C', text: 'Warm Standby' },
    { key: 'D', text: 'Pilot Light' },
  ];
  const cases: [string, string][] = [
    ['Cheapest fit (Pilot Light also ok; cheapest = A).', 'cheapest = “Backup & Restore with frequent snapshots”'],
    ['Pick (C) when RTO is minutes.', '(“Warm Standby”)'],
    ['Option B costs the most.', 'Option “Multi-Site Active-Active” costs'],
    ['Answers A and D both restore later.', 'Answers “Backup & Restore with frequent snapshots” and “Pilot Light”'],
    ['Why:\n- A: slow restore.\n- B) expensive\n(C) - scaled down', '- “Backup & Restore with frequent snapshots”: slow restore.\n- “Multi-Site Active-Active”: expensive\n“Warm Standby” - scaled down'],
  ];
  for (const [input, expected] of cases) {
    if (!/^Answers/.test(input)) assert.equal(hasLetterRef(input), true, input); // plural lists: our extension
    const out = replaceLetterRefs(input, options);
    assert.ok(out.text.includes(expected), `${input} → ${out.text}`);
    assert.equal(hasLetterRef(out.text), false, out.text);
  }
  // not option references: lowercase enumerations, A-B tests, letters that are no option
  const keep = 'Percentage split / A-B test = Weighted routing; (a) first, (F) none.';
  assert.equal(replaceLetterRefs(keep, options).text, keep);
});

test('setQuestionMeta inserts after the domain line or updates in place', () => {
  const text = packText('t-meta', [
    { id: 't-m1', options: opts4(1), answer: ['A'] },
    { id: 't-m2', options: opts4(2), answer: ['B'] },
  ]);
  const one = setQuestionMeta(text, 'task', new Map([['t-m2', '2.2']]));
  assert.deepEqual(one.changed, ['t-m2']);
  assert.match(one.text, /## Q t-m2\n- domain: resilient\n- task: 2\.2\n- topic: database/);
  const two = setQuestionMeta(one.text, 'task', new Map([['t-m1', '2.1'], ['t-m2', '2.1']]));
  assert.deepEqual(two.changed, ['t-m1', 't-m2']);
  const qs = parsePack(two.text, 'x.md', tax).questions;
  assert.deepEqual(qs.map((q) => q.task), ['2.1', '2.1']);
  assert.equal(setQuestionMeta(two.text, 'task', new Map([['t-m1', '2.1']])).changed.length, 0);
  assert.equal(two.text.split('\n').length, text.split('\n').length + 2);
});

// ── result files ────────────────────────────────────────────────────────────

function resultFile(dir: string, name: string, data: Record<string, unknown>): string {
  const abs = path.join(dir, 'results', '2026', '10', name);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stringifyFrontMatter({ kind: 'attempt', ...data }, ['answers']) + '\n# Report\n\nbody text\n');
  return abs;
}

test('migrateResults remaps letters of results graded before a layout change — once', () => {
  const dir = tmp();
  const migrationsDir = path.join(dir, 'migrations');
  const resultsDir = path.join(dir, 'results');
  assert.deepEqual(migrateResults({ resultsDir, migrationsDir }), { migrated: 0, files: [] });
  const rec = writeMigration(
    'rebalance-answers',
    {
      kind: 'rebalance-answers',
      questions: { q1: { A: 'C', B: 'A', C: 'B', D: 'D' }, q2: { A: 'B', B: 'A', C: 'C', D: 'D' }, q3: { A: 'A', B: 'D', C: 'B', D: 'C' } },
      answers: { q1: ['A', 'C'], q2: ['A', 'B'], q3: ['A', 'A'] },
    },
    { dir: migrationsDir, applied: new Date('2026-10-16T12:00:00Z') },
  );
  assert.equal(rec.id, '2026-10-16-rebalance-answers');
  const before = '2026-10-15T09:00:00+07:00';
  // old letters (key = old answer) even though the new code wrote layout 2 → migrate
  const oldFile = resultFile(dir, 'old.md', {
    id: 'old',
    layout: 2,
    finished: before,
    answers: [
      { q: 'q1', pick: 'B', key: 'A', ok: false, t: 30, est: 60, elim: 'CD' },
      { q: 'q2', pick: 'A', key: 'A', ok: true, t: 30, est: 60 },
      { q: 'other', pick: 'B', key: 'B', ok: true, t: 30, est: 60 },
    ],
  });
  // already in the new layout (key = new answer), backdated → untouched
  const newFile = resultFile(dir, 'new.md', { id: 'new', layout: 2, finished: before, answers: [{ q: 'q1', pick: 'C', key: 'C', ok: true, t: 30, est: 60 }] });
  // only an answer whose correct letter did not move: decided by layout + time
  const legacy = resultFile(dir, 'legacy.md', { id: 'legacy', finished: before, answers: [{ q: 'q3', pick: 'B', key: 'A', ok: false, t: 30, est: 60 }] });
  const ambiguousNew = resultFile(dir, 'amb.md', { id: 'amb', layout: 2, finished: before, answers: [{ q: 'q3', pick: 'B', key: 'A', ok: false, t: 30, est: 60 }] });
  const late = resultFile(dir, 'late.md', { id: 'late', finished: '2026-10-17T09:00:00+07:00', answers: [{ q: 'q3', pick: 'B', key: 'A', ok: false, t: 30, est: 60 }] });
  const untouched = [newFile, ambiguousNew, late].map((f) => fs.readFileSync(f, 'utf8'));

  const out = migrateResults({ resultsDir, migrationsDir });
  assert.deepEqual(out.files.map((f) => path.basename(f)).sort(), ['legacy.md', 'old.md']);
  const fm = splitFrontMatter(fs.readFileSync(oldFile, 'utf8'));
  const answers = fm.data.answers as Record<string, unknown>[];
  assert.deepEqual(answers[0], { q: 'q1', pick: 'A', key: 'C', ok: false, t: 30, est: 60, elim: 'BD' });
  assert.deepEqual(answers[1], { q: 'q2', pick: 'B', key: 'B', ok: true, t: 30, est: 60 });
  assert.deepEqual(answers[2], { q: 'other', pick: 'B', key: 'B', ok: true, t: 30, est: 60 });
  assert.equal(fm.data.layout, 2);
  assert.deepEqual(fm.data.migrations, [rec.id]);
  assert.match(fm.body, /body text\n\n> ℹ️ Ký tự đáp án đã chuyển theo bố cục mới \(2026-10-16-rebalance-answers\)\n$/);
  assert.equal((splitFrontMatter(fs.readFileSync(legacy, 'utf8')).data.answers as Record<string, unknown>[])[0].pick, 'D');
  assert.deepEqual([newFile, ambiguousNew, late].map((f) => fs.readFileSync(f, 'utf8')), untouched);
  // idempotent
  const snapshot = fs.readFileSync(oldFile, 'utf8');
  assert.equal(migrateResults({ resultsDir, migrationsDir }).migrated, 0);
  assert.equal(fs.readFileSync(oldFile, 'utf8'), snapshot);
});

// ── task heuristic ──────────────────────────────────────────────────────────

const taskQ = (domain: string, stem: string, correct: string, others = ['Use Amazon Lightsail', 'Use AWS Batch', 'Use Amazon Lex']): TaskInput => ({
  stem,
  domain,
  options: [correct, ...others].map((text, i) => ({ key: 'ABCD'[i], text })),
  answer: ['A'],
});

test('guessTask maps domain + cues to exam-guide task statements', () => {
  const cases: [TaskInput, string][] = [
    [taskQ('secure', 'Data in S3 must be encrypted at rest with keys the company controls.', 'SSE-KMS with a customer managed key'), '1.3'],
    [taskQ('secure', 'Developers in account A need access to a bucket in account B.', 'Create an IAM role in account B that account A can assume'), '1.1'],
    [taskQ('secure', 'A web app is hit by SQL injection attempts.', 'Attach AWS WAF with managed rule groups to the ALB'), '1.2'],
    [taskQ('resilient', 'Order processing must be decoupled so spikes do not overwhelm the backend.', 'Put an Amazon SQS queue between the tiers'), '2.1'],
    [taskQ('resilient', 'The web tier must stay highly available if an Availability Zone fails.', 'An Auto Scaling group spanning multiple AZs behind an ALB'), '2.2'],
    [taskQ('performance', 'Users worldwide see high latency downloading static assets.', 'Serve the assets through Amazon CloudFront'), '3.4'],
    [taskQ('performance', 'A read-heavy DynamoDB table needs microsecond reads.', 'Add DynamoDB Accelerator (DAX)'), '3.3'],
    [taskQ('performance', 'Many Linux instances need a shared POSIX file system.', 'Amazon EFS'), '3.1'],
    [taskQ('performance', 'Clickstream events must be ingested and processed in real time.', 'Amazon Kinesis Data Streams'), '3.5'],
    [taskQ('cost', 'Logs are rarely read after 90 days and must be kept 7 years at the lowest cost.', 'S3 Lifecycle rule to S3 Glacier Deep Archive'), '4.1'],
    [taskQ('cost', 'Fault-tolerant batch jobs should run at the lowest cost.', 'EC2 Spot Instances'), '4.2'],
    [taskQ('cost', 'An Aurora database is idle at night and bursts during the day.', 'Aurora Serverless v2'), '4.3'],
    [taskQ('cost', 'EC2 instances in private subnets download from S3 through a NAT gateway; data processing charges are high.', 'Add a gateway VPC endpoint for S3'), '4.4'],
  ];
  for (const [q, want] of cases) assert.equal(guessTask(q, tax), want, `${q.domain}: ${q.stem}`);
  assert.equal(guessTask({ ...cases[0][0], domain: 'nowhere' }, tax), undefined);
  // option order never changes the result (the rebalance must not move tasks)
  const multi: TaskInput = {
    stem: 'Which TWO changes improve performance of the reporting workload? (Choose TWO)',
    domain: 'performance',
    options: [{ key: 'A', text: 'Add an ElastiCache cluster' }, { key: 'B', text: 'Use CloudFront' }, { key: 'C', text: 'Use S3 Glacier' }],
    answer: ['A', 'B'],
  };
  const swapped: TaskInput = { ...multi, options: [multi.options[1], multi.options[0], multi.options[2]].map((o, i) => ({ ...o, key: 'ABC'[i] })) };
  assert.equal(guessTask(multi, tax), guessTask(swapped, tax));
});

// ── quality metrics ─────────────────────────────────────────────────────────

test('quality: letters, correct-longest, coverage, duplicates and variant effect', () => {
  const text = packText('t-q', [
    { id: 'q-a', options: ['A much longer correct option text here', 'short', 'tiny', 'small'], answer: ['A'] },
    { id: 'q-b', options: ['opt1', 'opt2', 'opt3', 'opt4'], answer: ['C'] },
    { id: 'q-c', stem: 'A company needs an immutable cryptographically verifiable ledger of financial transactions. Which service?', options: ['Amazon QLDB', 'Amazon DynamoDB', 'Amazon RDS', 'Amazon Neptune'], answer: ['A'] },
    { id: 'q-d', stem: 'A company wants an immutable, cryptographically verifiable ledger of financial transactions. Which service?', options: ['Amazon DynamoDB', 'Amazon QLDB', 'Amazon RDS', 'Amazon Neptune'], answer: ['B'], variantOf: 'q-c' },
    { id: 'q-e', options: ['one', 'two', 'three', 'four'], answer: ['D'], status: 'retired' },
  ]);
  const bank = bankOf(text);
  const r = (q: string, ok: boolean) => ({ q, pick: ok ? 'A' : 'B', key: 'A', ok, t: 30, est: 60 });
  const at = (id: string, day: number, answers: ReturnType<typeof r>[], rushed = false) =>
    ({ id, finished: `2026-10-${String(day).padStart(2, '0')}T10:00:00+07:00`, answers, rushed }) as unknown as Attempt;
  const attempts = [at('1', 1, [r('q-c', false)]), at('2', 2, [r('q-d', true)]), at('3', 3, [r('q-c', true)])];
  const ratings: RatingEntry[] = [
    { line: 1, date: '2026-10-01', qid: 'q-b', value: 'down', note: 'two answers fit' },
    { line: 2, date: '2026-10-02', qid: 'q-b', value: 'down' },
    { line: 3, date: '2026-10-02', qid: 'q-a', value: 'up' },
  ];
  const q = computeQuality(bank, attempts, ratings);
  assert.equal(q.total, 4); // retired excluded
  assert.equal(q.singleAnswer, 4);
  assert.deepEqual(q.letters, { A: 2, B: 1, C: 1, D: 0 });
  assert.deepEqual(q.lettersByOrigin.imported, { A: 2, B: 1, C: 1, D: 0 });
  assert.equal(q.correctLongest, 1);
  assert.equal(q.shortExplanations, 4);
  assert.deepEqual(q.duplicates.map((d) => [d.a, d.b]), [['q-c', 'q-d']]);
  assert.ok(q.duplicates[0].score >= 0.8);
  assert.deepEqual(q.lowRated, ['q-b']);
  assert.deepEqual(q.ratings['q-a'], { up: 1, down: 0 });
  assert.deepEqual(q.variantEffect, { originals: 1, fixedAfterVariant: 1, examples: ['q-c'] });
  // rushed attempts do not count; a retry without a variant in between is no cycle
  assert.equal(variantCycles(bank, [at('1', 1, [r('q-c', false)]), at('2', 2, [r('q-d', true)], true), at('3', 3, [r('q-c', true)])]).length, 0);
  assert.equal(variantCycles(bank, [at('1', 1, [r('q-c', false)]), at('2', 2, [r('q-c', true)]), at('3', 3, [r('q-d', true)])]).length, 0);
  assert.equal(correctIsLongest({ options: bank.byId.get('q-b')!.options, answer: ['C'] }), false);
  assert.deepEqual(findDuplicates([bank.byId.get('q-a')!, bank.byId.get('q-b')!] as Question[]), []);
});

test('ratings file: append, parse, one vote per day, resolved lines do not count', () => {
  const file = path.join(tmp(), 'ratings.md'); // never the real bank/ratings.md
  const first = addRating('q-1', 'down', 'B and C\nboth `fit` → really', file);
  assert.deepEqual({ qid: first.qid, value: first.value, note: first.note }, { qid: 'q-1', value: 'down', note: "B and C both 'fit' -> really" });
  addRating('q-1', 'up', undefined, file);
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^# 👍👎 Question ratings\n/);
  assert.match(text, /\n- \d{4}-\d{2}-\d{2} · `q-1` · down · B and C both 'fit' -> really\n- \d{4}-\d{2}-\d{2} · `q-1` · up\n$/);
  assert.deepEqual(aggregateRatings(loadRatings(file)), { 'q-1': { up: 1, down: 0 } }); // same day: the latest vote wins

  fs.appendFileSync(file, '- 2026-10-01 · `q-2` · down · wrong key → ✅ 2026-10-02 coach: fixed key\n');
  const resolved = loadRatings(file).find((x) => x.qid === 'q-2')!;
  assert.deepEqual([resolved.note, resolved.resolution], ['wrong key', '✅ 2026-10-02 coach: fixed key']);

  const entries: RatingEntry[] = [
    { line: 1, date: '2026-10-01', qid: 'x', value: 'down', note: 'wrong key' },
    { line: 2, date: '2026-10-02', qid: 'x', value: 'down' },
    { line: 3, date: '2026-10-02', qid: 'x', value: 'up' }, // the learner changed their mind that day
    { line: 4, date: '2026-10-03', qid: 'x', value: 'down' },
    { line: 5, date: '2026-10-03', qid: 'y', value: 'down' },
    { line: 6, date: '2026-10-04', qid: 'y', value: 'down', resolution: '✅ coach: fixed' },
    { line: 7, date: '2026-10-04', qid: 'y', value: 'down' }, // unresolved copy kept by a union merge
  ];
  const votes = aggregateRatings(entries);
  assert.deepEqual(votes, { x: { up: 1, down: 2 }, y: { up: 0, down: 1 } });
  assert.deepEqual(lowRatedIds(votes), ['x']);
});
