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
import { computeQuality, correctIsLongest, distractorReport, findDuplicates, lexicalDuplicates, optionStats, qualitySnapshotLines, scopeReport, variantCycles } from '../server/lib/quality.ts';
import { mergeDuplicates } from '../server/lib/embeddings.ts';
import { addRating, aggregateRatings, loadRatings, lowRatedIds, type RatingEntry } from '../server/lib/ratings.ts';
import type { BankState } from '../server/lib/bank.ts';
import type { AnswerRecord, Attempt, DuplicatePair, Question } from '../shared/types.ts';

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

let bankSeq = 0;
/** Every test bank gets its own version: the per-part caches of quality.ts / lint.ts key on it. */
function bankOf(text: string): BankState {
  const { questions, pack, problems } = parsePack(text, 'bank/packs/imported/t.md', tax);
  return { version: `quality-test-${++bankSeq}`, taxonomy: tax, packs: [pack], questions, byId: new Map(questions.map((q) => [q.id, q])), problems };
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

// ── option analytics (distractor report) ───────────────────────────────────

function attemptOf(id: string, answers: Partial<AnswerRecord>[], opts: { rushed?: boolean; day?: number } = {}): Attempt {
  return {
    id,
    finished: `2026-10-${String(opts.day ?? 10).padStart(2, '0')}T10:00:00+07:00`,
    rushed: !!opts.rushed,
    answers: answers.map((a) => ({ pick: '', key: 'A', ok: false, t: 30, est: 60, ...a }) as AnswerRecord),
  } as unknown as Attempt;
}

test('distractorReport: weak distractors and suspected keys from non-rushed answers to the current version', () => {
  const text = packText('t-d', [
    { id: 'd-1', options: opts4(1), answer: ['A'] },
    { id: 'd-2', options: opts4(2), answer: ['A'] },
    { id: 'd-3', options: opts4(3), answer: ['A'] },
    { id: 'd-4', options: opts4(4), answer: ['A'] },
    { id: 'd-5', options: opts4(5), answer: ['A'] },
    { id: 'd-6', options: opts4(6), answer: ['A'], status: 'retired' },
  ]);
  const bank = bankOf(text);
  const h = (id: string) => bank.byId.get(id)!.hash;
  const ok = (q: string, elim = '') => ({ q, pick: 'A', key: 'A', ok: true, h: h(q), ...(elim ? { elim } : {}) });
  const attempts = [
    // d-1: always right, D struck out 3/4 times, C once → D is a weak distractor, C is not (struck < 2)
    attemptOf('a1', [ok('d-1', 'D'), { q: 'd-2', pick: 'B', h: h('d-2'), why: 'Mình nghĩ B rẻ hơn' }, { q: 'd-3', pick: 'C', h: h('d-3') }], { day: 1 }),
    attemptOf('a2', [ok('d-1', 'CD'), { q: 'd-2', pick: 'B', h: h('d-2'), unsure: true }, { q: 'd-3', pick: 'C', h: h('d-3'), hinted: true }], { day: 2 }),
    attemptOf('a3', [ok('d-1', 'D'), { q: 'd-2', pick: 'B', h: h('d-2'), why: 'B vẫn hợp lý' }], { day: 3 }),
    attemptOf('a4', [ok('d-1')], { day: 4 }),
    // rushed: would make D picked
    attemptOf('r1', [{ q: 'd-1', pick: 'D', h: h('d-1') }], { day: 5, rushed: true }),
    // d-4 was edited after these answers: an answer with an old hash proves it, hash-less answers are older still
    attemptOf('a5', [{ q: 'd-4', pick: 'B', h: 'oldhash001' }, { q: 'd-4', pick: 'B' }, { q: 'd-4', pick: 'B' }], { day: 6 }),
    // d-5: legacy answers (no h) graded against an older key, or re-graded → not the current version
    attemptOf('a6', [{ q: 'd-5', pick: 'B', key: 'B', ok: true }, { q: 'd-5', pick: 'B', key: 'A', regraded: true }, { q: 'd-5', pick: 'B', key: 'A', regraded: true }], { day: 7 }),
    // retired question: ignored
    attemptOf('a7', [{ q: 'd-6', pick: 'B', h: h('d-6') }, { q: 'd-6', pick: 'B', h: h('d-6') }], { day: 8 }),
    // unanswered without strike-outs: no exposure
    attemptOf('a8', [{ q: 'd-1', pick: '', h: h('d-1') }], { day: 9 }),
  ];

  const stats = optionStats(bank, attempts);
  assert.deepEqual(stats.get('d-1'), {
    id: 'd-1',
    exposures: 4,
    correct: 4,
    options: { A: { picks: 4, elims: 0 }, B: { picks: 0, elims: 0 }, C: { picks: 0, elims: 1 }, D: { picks: 0, elims: 3 } },
    wrong: {},
  });
  assert.equal(stats.has('d-4'), false, 'answers to an older version are skipped');
  assert.equal(stats.has('d-5'), false, 'old key / re-graded answers are skipped');

  const r = distractorReport(bank, attempts);
  assert.equal(r.minExposures, 3);
  assert.deepEqual(r.weakDistractors, [{ id: 'd-1', key: 'D', exposures: 4, elims: 3 }]);
  assert.equal(r.suspectedKeys.length, 1);
  const s = r.suspectedKeys[0];
  assert.deepEqual({ id: s.id, key: s.key, pick: s.pick, times: s.times, confident: s.confident }, { id: 'd-2', key: 'A', pick: 'B', times: 3, confident: 2 });
  assert.match(s.note, /^Chọn B 3\/3 lần \(2 lần chắc chắn/);
  assert.match(s.note, /chưa lần nào chọn đúng/);
  assert.match(s.note, /“Mình nghĩ B rẻ hơn” \| “B vẫn hợp lý”/);
  assert.equal(r.analysed, 2); // d-1 (4 answers), d-2 (3)
  assert.equal(r.answers, 9); // d-1 4 + d-2 3 + d-3 2 (retired d-6 not counted)
  // one hinted + one confident wrong pick is not enough; a higher bar for exposures hides d-2 from the weak list only
  assert.equal(distractorReport(bank, attempts, 5).weakDistractors.length, 0);
  assert.equal(distractorReport(bank, attempts, 5).suspectedKeys.length, 1);
  assert.deepEqual(distractorReport(bank, []), { minExposures: 3, weakDistractors: [], suspectedKeys: [], analysed: 0, answers: 0 });
  // slips on a question answered many times: the same wrong pick must be ≥ a third of the answers
  const many = [
    ...Array.from({ length: 9 }, (_, i) => attemptOf(`m${i}`, [ok('d-3')], { day: 10 + i })),
  ];
  assert.equal(distractorReport(bank, [...attempts, ...many]).suspectedKeys.some((k) => k.id === 'd-3'), false);
  const slips = Array.from({ length: 10 }, (_, i) => attemptOf(`s${i}`, [i < 2 ? { q: 'd-2', pick: 'B', h: h('d-2') } : ok('d-2')], { day: 10 + i }));
  assert.equal(distractorReport(bank, slips).suspectedKeys.length, 0, '2 confident slips in 10 answers are no suspected key');
  const stubborn = Array.from({ length: 8 }, (_, i) => attemptOf(`t${i}`, [i % 2 ? { q: 'd-2', pick: 'B', h: h('d-2') } : ok('d-2')], { day: 10 + i }));
  assert.equal(distractorReport(bank, stubborn).suspectedKeys[0]?.times, 4, 'half of the answers on the same wrong option still counts');
});

test('computeQuality carries lint, distractors, semantic status and verification; snapshot lines list them', () => {
  const text = packText('t-c', [
    { id: 'c-1', options: ['Right answer that is much much longer than all others', 'short', 'tiny', 'small'], answer: ['A'] },
    { id: 'c-2', options: opts4(2), answer: ['A'] },
  ]);
  const bank = bankOf(text);
  const h = bank.byId.get('c-2')!.hash;
  const attempts = [1, 2, 3].map((d) => attemptOf(`c${d}`, [{ q: 'c-2', pick: 'C', h, why: `lần ${d}` }], { day: d }));
  const q = computeQuality(bank, attempts, []);
  assert.equal(q.lint?.checked, 2);
  assert.equal(q.lint?.byCode['longest-correct'].count, 1);
  assert.deepEqual(q.lint?.ids?.['longest-correct'], ['c-1']);
  assert.equal(q.distractors?.suspectedKeys[0]?.id, 'c-2');
  assert.ok(q.semantic && ['ollama', 'lexical', 'off'].includes(q.semantic.provider));
  assert.deepEqual(Object.keys(q.verification ?? {}).sort(), ['ok', 'pending', 'review', 'stale', 'verified']);

  const lines = qualitySnapshotLines(bank, attempts, { background: false }).join('\n');
  assert.match(lines, /## 14\. Chất lượng ngân hàng/);
  assert.match(lines, /### 🩺 Lỗi viết câu hỏi/);
  assert.match(lines, /- Nặng: 0 câu ✓/);
  assert.match(lines, /Đáp án đúng dài nhất 1/);
  assert.match(lines, /### 🎯 Phương án nhiễu/);
  assert.match(lines, /`c-2` đáp án A “Right answer 2” · chọn C “Wrong two 2” 3\/3 lần/);
});

test('lexical duplicates are cached by bank version only (not recomputed when answers change)', () => {
  const text = packText('t-dup', [
    { id: 'u-1', stem: 'A company needs an immutable cryptographically verifiable ledger of financial transactions. Which service?', options: ['Amazon QLDB', 'Amazon DynamoDB', 'Amazon RDS', 'Amazon Neptune'], answer: ['A'] },
    { id: 'u-2', stem: 'A company wants an immutable, cryptographically verifiable ledger of financial transactions. Which service?', options: ['Amazon DynamoDB', 'Amazon QLDB', 'Amazon RDS', 'Amazon Neptune'], answer: ['B'] },
  ]);
  const bank = bankOf(text);
  const first = lexicalDuplicates(bank);
  assert.deepEqual(first.map((p) => [p.a, p.b, p.kind]), [['u-1', 'u-2', 'lexical']]);
  const a = computeQuality(bank, [attemptOf('x1', [{ q: 'u-1', pick: 'A' }])], undefined, { background: false });
  const b = computeQuality(bank, [attemptOf('x1', [{ q: 'u-1', pick: 'A' }]), attemptOf('x2', [{ q: 'u-2', pick: 'A' }], { day: 11 })], undefined, { background: false });
  assert.equal(lexicalDuplicates(bank), first, 'same array: not recomputed after new answers');
  assert.deepEqual(a.duplicates, b.duplicates);
  const edited = { ...bank, version: `${bank.version}-edited` };
  assert.notEqual(lexicalDuplicates(edited), first, 'a new bank version recomputes');
});

test('mergeDuplicates: lexical pairs first-class, semantic-only pairs added, inactive ids dropped, best first', () => {
  const lexical: DuplicatePair[] = [{ a: 'q1', b: 'q2', score: 0.9, kind: 'lexical' }];
  const semantic: DuplicatePair[] = [
    { a: 'q2', b: 'q1', score: 0.97, kind: 'semantic' }, // same pair found both ways → stays lexical
    { a: 'q3', b: 'q4', score: 0.92, kind: 'semantic' },
    { a: 'q1', b: 'qx', score: 0.99, kind: 'semantic' }, // qx is retired
  ];
  assert.deepEqual(mergeDuplicates(lexical, semantic, (id) => id !== 'qx'), [
    { a: 'q3', b: 'q4', score: 0.92, kind: 'semantic' },
    { a: 'q1', b: 'q2', score: 0.9, kind: 'lexical' },
  ]);
  assert.deepEqual(mergeDuplicates([{ a: 'q1', b: 'q2', score: 0.85 }], []), [{ a: 'q1', b: 'q2', score: 0.85, kind: 'lexical' }]);
  const many = Array.from({ length: 40 }, (_, i) => ({ a: `s${i}`, b: `t${i}`, score: 0.9, kind: 'semantic' as const }));
  assert.equal(mergeDuplicates(many.map((p) => ({ ...p, kind: 'lexical' as const })), many.map((p) => ({ ...p, a: `u${p.a}` }))).length, 50, 'merged list ≤ 50');
});

// ── [γ] exam scope + sealed questions ───────────────────────────────────────

test('scopeReport: out-of-scope answers vs distractors, per-service tallies, the practice exclusion flag; snapshot §14 tells the coach', () => {
  const bank = bankOf(
    packText('sc-pack', [
      { id: 'sc-ans', options: ['Use AWS CodeCommit', 'Use Amazon S3', 'Use Amazon EFS', 'Use Amazon EBS'], answer: ['A'] },
      { id: 'sc-dis', options: ['Use Amazon S3', 'Use Amazon Lightsail', 'Use AWS CodeBuild', 'Use Amazon EBS'], answer: ['A'] },
      { id: 'sc-ok', options: opts4(1), answer: ['A'] },
    ]),
  );
  const r = scopeReport(bank, bank.questions, { practice: { default_count: 20, quick_count: 10, shuffle_options: true, exclude_out_of_scope: true } });
  assert.deepEqual(r.answer, [{ id: 'sc-ans', services: ['CodeCommit'] }]);
  assert.deepEqual(r.distractor, [{ id: 'sc-dis', options: [{ key: 'B', services: ['Lightsail'] }, { key: 'C', services: ['CodeBuild'] }] }]);
  assert.equal(r.excluded, true);
  const svc = Object.fromEntries(r.services.map((s) => [s.name, [s.answers, s.distractors]]));
  assert.deepEqual([svc.CodeCommit, svc.Lightsail, svc.CodeBuild, svc.Braket], [[1, 0], [0, 1], [0, 1], [0, 0]]);
  assert.equal(r.services[0].name, 'CodeCommit', 'services the bank uses as answers first');
  assert.ok(r.services.length >= 30, 'every `scope: out` service of the taxonomy is listed');
  assert.deepEqual(r.services.find((s) => s.name === 'Location Service')?.aliases, ['Amazon Location Service']);
  assert.equal(scopeReport(bank, bank.questions, { practice: { default_count: 20, quick_count: 10, shuffle_options: true, exclude_out_of_scope: false } }).excluded, false);
  assert.deepEqual(computeQuality(bank, [], []).scope?.answer.map((x) => x.id), ['sc-ans']);
  const lines = qualitySnapshotLines(bank, [], { background: false }).join('\n');
  assert.match(lines, /### 🎯 Phạm vi đề thi/);
  assert.match(lines, /1 câu có \*\*đáp án đúng\*\* là dịch vụ ngoài phạm vi[^\n]*`sc-ans` \(CodeCommit\)/);
  assert.match(lines, /1 câu dùng dịch vụ ngoài phạm vi làm \*\*phương án nhiễu\*\*/);
  assert.match(lines, /\*\*không\*\* dùng CodeCommit, CodeBuild, Lightsail/);
});

test('computeQuality leaves sealed questions out of every number and list; BankQuality.sealed counts them', () => {
  const stem = 'A company stores signed invoices in a durable archive for seven years and must retrieve them rarely. Which service?';
  const bank = bankOf(
    packText('sl-pack', [
      { id: 'sl-1', options: opts4(1), answer: ['A'], explanation: 'x' },
      { id: 'sl-2', options: opts4(2), answer: ['A'], explanation: 'x' },
      { id: 'sl-dup-a', stem, options: opts4(3), answer: ['A'] },
      { id: 'sl-dup-b', stem, options: opts4(3), answer: ['A'] },
      { id: 'sl-oos', options: ['Use AWS CodeCommit', 'Use Amazon S3', 'Use Amazon EFS', 'Use Amazon EBS'], answer: ['A'] },
    ]),
  );
  const ratings: RatingEntry[] = [
    { line: 1, date: '2026-10-01', qid: 'sl-2', value: 'down', note: 'mơ hồ' },
    { line: 2, date: '2026-10-02', qid: 'sl-2', value: 'down' },
  ];
  const open = computeQuality(bank, [], ratings);
  assert.equal(open.total, 5);
  assert.equal(open.sealed, 0);
  assert.ok(open.duplicates.some((d) => d.a === 'sl-dup-a' && d.b === 'sl-dup-b'));
  assert.deepEqual(open.lowRated, ['sl-2']);
  assert.deepEqual(open.scope?.answer.map((x) => x.id), ['sl-oos']);

  const sealed = new Set(['sl-2', 'sl-dup-b', 'sl-oos']);
  const q = computeQuality(bank, [], ratings, { sealed });
  assert.equal(q.sealed, 3);
  assert.equal(q.total, 2, 'metrics cover the visible questions only');
  assert.deepEqual(q.duplicates, []);
  assert.deepEqual(q.lowRated, []);
  assert.deepEqual(q.scope?.answer, []);
  assert.equal(q.lint?.checked, 2);
  for (const ids of Object.values(q.lint?.ids ?? {})) for (const id of ids) assert.ok(!sealed.has(id), `${id} listed by lint`);
});
