// [v6] Exam-grade lint (server/lib/lint.ts): the exam-spec rules positive + negative, the exam-spec scope (origin,
// difficulty, created vs quality.exam_spec_since, '' = off, the config default), lintBank, the pack-level checks of
// `validate`, `scope: legacy` messages, AWS's "(Select TWO.)" wording in every instruction parser, and the AI acceptance
// of new questions (exam-spec flaws are warnings, the medium ones ride along in the repair round).
// Runs against a temporary TRAINER_HOME. Run: node --test tests/lint-v6.test.ts
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TRAINER_ROOT } from './helpers/paths.ts';
import type { Question, Taxonomy } from '../shared/types.ts';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-lint-v6-'));
fs.mkdirSync(path.join(home, 'bank', 'packs', 'ai'), { recursive: true });
fs.mkdirSync(path.join(home, 'results'), { recursive: true });
fs.copyFileSync(path.join(TRAINER_ROOT, 'bank', 'taxonomy.yaml'), path.join(home, 'bank', 'taxonomy.yaml'));
fs.cpSync(path.join(TRAINER_ROOT, 'bank', 'exam-guide'), path.join(home, 'bank', 'exam-guide'), { recursive: true });
const CONFIG = path.join(home, 'config.yaml');
const CONFIG_TEXT = 'quality:\n  exam_spec_since: "2026-10-01"\n';
fs.writeFileSync(CONFIG, CONFIG_TEXT);
process.env.TRAINER_HOME = home;
after(() => fs.rmSync(home, { recursive: true, force: true }));

const lint = await import('../server/lib/lint.ts');
const { loadTaxonomy } = await import('../server/lib/taxonomy.ts');
const { parsePack } = await import('../server/lib/pack-format.ts');
const { loadBank } = await import('../server/lib/bank.ts');
const { guideCoverage } = await import('../server/lib/exam-guide.ts');
const aiOut = await import('../server/lib/ai-output.ts');

const tax = loadTaxonomy();
const SINCE = '2026-10-22';
const SPEC_CODES = ['stem-short', 'options-bare', 'no-criterion', 'explanation-coverage', 'doc-url-missing', 'options-nonparallel'];

const STEM =
  'A healthcare company runs a patient portal on Amazon EC2 instances behind an Application Load Balancer and stores records in an Amazon RDS for PostgreSQL DB instance in a single Availability Zone. The database must keep running with automatic failover if that Availability Zone fails, and the application must not need any connection string changes after a failover. Which solution will meet these requirements?';
const SHORT_STEM = 'A company runs PostgreSQL on Amazon RDS in one Availability Zone and needs automatic failover. Which solution will meet these requirements?';
// no requirement keyword anywhere (taxonomy.keywords) and a closing question that names no requirement
const NO_CRITERION_STEM =
  'A company runs an internal reporting tool on Amazon EC2 instances. Each night the tool exports a CSV file of the orders of the day, and the finance team downloads the file the next morning from a shared folder that the operations team keeps on a separate server. The company plans to move the shared folder to AWS and keep the current workflow. Which solution should the solutions architect recommend?';
const OPTIONS = [
  'Convert the DB instance to a Multi-AZ deployment with a synchronous standby replica',
  'Create a cross-Region read replica and promote it manually during an outage',
  'Take hourly automated snapshots and restore them in another Availability Zone',
  'Add two read replicas in other Availability Zones behind a Route 53 record',
];
const LEAD = 'Multi-AZ keeps a synchronous standby in a second Availability Zone and fails over automatically behind the same DNS endpoint, so the application keeps its connection string.';
const LINES = [
  '- Cross-Region read replica: asynchronous and promoted by hand, so the failover is neither automatic nor transparent.',
  '- Hourly snapshots: a restore takes time, loses up to an hour of writes and comes up behind a new endpoint.',
  '- Read replicas behind Route 53: replicas stay read-only until promoted, so writes fail during the outage.',
];
const DOC = 'Source: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html';
const VN = '> 🇻🇳 AZ hỏng + failover tự động + không đổi endpoint → RDS Multi-AZ.';
const EXPLANATION = [LEAD, ...LINES, DOC, VN].join('\n');

type Input = Parameters<typeof lint.lintQuestion>[0];

/** An exam-grade question (AI, medium, created on SINCE); `patch` overrides any part. Options as plain strings. */
function spec(patch: Partial<Omit<Input, 'options'>> & { options?: string[] } = {}): Input {
  const { options, ...rest } = patch;
  return {
    id: 'v6-q1',
    stem: STEM,
    answer: ['A'],
    explanation: EXPLANATION,
    origin: 'ai',
    difficulty: 'medium',
    created: SINCE,
    refs: ['03-database-services.md'],
    ...rest,
    options: (options ?? OPTIONS).map((text, i) => ({ key: 'ABCDEFGH'[i], text })),
  };
}

const flawsOf = (q: Input, t?: Taxonomy, since = SINCE) => lint.lintQuestion(q, t, { examSpecSince: since });
const codes = (q: Input, t?: Taxonomy, since = SINCE) => flawsOf(q, t, since).map((f) => f.code);
const has = (q: Input, code: string, t?: Taxonomy) => codes(q, t).includes(code);
const specCodes = (q: Input, t?: Taxonomy, since = SINCE) => codes(q, t, since).filter((c) => SPEC_CODES.includes(c));
const find = (q: Input, code: string, t?: Taxonomy) => flawsOf(q, t).find((f) => f.code === code);

/** Everything wrong at once: short stem, bare options, no criterion, no per-distractor lines, no URL, mixed shapes. */
const FLAWED = {
  stem: 'Which service stores the order files?',
  options: ['Use Amazon S3 buckets', 'Amazon EBS', 'Amazon EFS', 'An instance store'],
  explanation: 'Amazon S3 stores any number of objects durably and cheaply, which fits files that are written once and read later.',
};

// ── rules ───────────────────────────────────────────────────────────────────

test('exam-spec rules: six codes flagged examSpec (four medium, two low, never high); an exam-grade question has no flaw', () => {
  assert.deepEqual(
    lint.LINT_RULES.filter((r) => r.examSpec).map((r) => [r.code, r.severity]),
    [['stem-short', 'medium'], ['options-bare', 'medium'], ['no-criterion', 'medium'], ['explanation-coverage', 'medium'], ['doc-url-missing', 'low'], ['options-nonparallel', 'low']],
  );
  for (const r of lint.LINT_RULES.filter((x) => x.examSpec)) assert.ok(r.label && r.fix, r.code);
  assert.deepEqual(flawsOf(spec(), tax), []);
  assert.deepEqual(flawsOf(spec()), []);
  assert.deepEqual(specCodes(spec(FLAWED)), SPEC_CODES);
});

test('stem-short (medium): a stem under timing.long_form_min_words (55)', () => {
  const f = find(spec({ stem: SHORT_STEM }), 'stem-short', tax)!;
  assert.equal(f.severity, 'medium');
  assert.match(f.message, /^Đề chỉ 21 từ \(< 55\)/);
  assert.equal(has(spec({ stem: SHORT_STEM }), 'stem-short', { ...tax, timing: { ...tax.timing, long_form_min_words: 20 } }), false, 'the taxonomy threshold');
  assert.equal(has(spec({ stem: SHORT_STEM, words: 70 }), 'stem-short'), false, 'the computed Question.words wins');
  assert.equal(has(spec(), 'stem-short', tax), false);
});

test('options-bare (medium): options of fewer than 8 words on average', () => {
  const f = find(spec({ options: ['Amazon RDS Multi-AZ', 'Cross-Region read replica', 'Hourly snapshots', 'Route 53 failover'] }), 'options-bare')!;
  assert.equal(f.severity, 'medium');
  assert.match(f.message, /^Phương án dài trung bình 2,8 từ \(< 8\)/);
  assert.equal(has(spec(), 'options-bare'), false);
});

test('no-criterion (medium): no qualifier group and no closing question naming the requirements', () => {
  const f = find(spec({ stem: NO_CRITERION_STEM }), 'no-criterion', tax)!;
  assert.equal(f.severity, 'medium');
  assert.match(f.message, /không nêu tiêu chí chọn/);
  assert.ok(has(spec({ stem: NO_CRITERION_STEM }), 'no-criterion'), 'without the taxonomy too');
  const meets = NO_CRITERION_STEM.replace('Which solution should the solutions architect recommend?', 'Which solution will meet these requirements?');
  assert.equal(has(spec({ stem: meets }), 'no-criterion'), false, 'the closing question names the requirements');
  const cheapest = NO_CRITERION_STEM.replace('Which solution should the solutions architect recommend?', 'Which solution is the MOST cost-effective?');
  assert.equal(has(spec({ stem: cheapest }), 'no-criterion', tax), false, 'a qualifier group (bank.ts stemRequirements) with the taxonomy');
  assert.equal(has(spec({ stem: cheapest, requirements: ['cost'] }), 'no-criterion'), false, 'the computed Question.requirements');
  assert.ok(has(spec({ stem: cheapest }), 'no-criterion'), 'neither the taxonomy nor computed requirements: the closing question only');
});

test('explanation-coverage (medium): fewer "- option: why" lines than distractors', () => {
  const two = [LEAD, ...LINES.slice(0, 2), DOC, VN].join('\n');
  const f = find(spec({ explanation: two }), 'explanation-coverage')!;
  assert.equal(f.severity, 'medium');
  assert.match(f.message, /^Giải thích có 2 dòng “- …:” cho 3 phương án nhiễu/);
  assert.equal(has(spec(), 'explanation-coverage'), false);
  // other bullet styles count: em dash, "*", numbered, a space before the colon; a bare URL bullet does not
  const styles = [LEAD, '* **Cross-Region read replica** — asynchronous, promoted by hand.', '1. Hourly snapshots : slow restore.', '- Read replicas behind Route 53: read-only until promoted.', VN].join('\n');
  assert.equal(has(spec({ explanation: styles }), 'explanation-coverage'), false);
  const urlBullet = [LEAD, ...LINES.slice(0, 2), `- ${DOC.replace('Source: ', '')}`, VN].join('\n');
  assert.ok(has(spec({ explanation: urlBullet }), 'explanation-coverage'));
  // multiple response: distractors = options − keys
  const mr = spec({ stem: `${STEM} (Choose TWO)`, options: [...OPTIONS, 'Move the database to Amazon DynamoDB with global tables in two Regions'], answer: ['A', 'B'] });
  assert.ok(has({ ...mr, explanation: [LEAD, ...LINES.slice(1), VN, DOC].join('\n') }, 'explanation-coverage'));
  assert.equal(has({ ...mr, explanation: [LEAD, ...LINES.slice(1), '- DynamoDB global tables: a rewrite to a NoSQL model.', DOC].join('\n') }, 'explanation-coverage'), false);
});

test('doc-url-missing (low): no docs.aws.amazon.com / aws.amazon.com URL in the explanation or refs', () => {
  const bare = [LEAD, ...LINES, VN].join('\n');
  const f = find(spec({ explanation: bare }), 'doc-url-missing')!;
  assert.equal(f.severity, 'low');
  assert.match(f.message, /chưa có URL tài liệu AWS/);
  assert.equal(has(spec({ explanation: bare, refs: ['03-database-services.md', 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html'] }), 'doc-url-missing'), false, 'URL in refs');
  assert.equal(has(spec({ explanation: `${bare}\nhttps://aws.amazon.com/rds/features/multi-az/` }), 'doc-url-missing'), false, 'aws.amazon.com');
  assert.ok(has(spec({ explanation: `${bare}\nhttps://aws.amazon.com.example.org/rds` }), 'doc-url-missing'), 'a look-alike host is no AWS page');
  assert.ok(has(spec({ explanation: `${bare}\nhttps://repost.aws/questions/rds` }), 'doc-url-missing'));
});

test('options-nonparallel (low): the key opens with an action verb while ≥ 2 distractors are noun phrases, or the reverse', () => {
  const verbKey = spec({
    options: [
      'Use Amazon RDS Multi-AZ with a synchronous standby in a second Availability Zone',
      'Amazon Aurora global database with a secondary cluster in another Region',
      'An Amazon RDS read replica in the same Region with manual promotion',
      'Take hourly automated snapshots and restore them in another Availability Zone',
    ],
  });
  const f = find(verbKey, 'options-nonparallel')!;
  assert.equal(f.severity, 'low');
  assert.equal(f.option, 'A');
  assert.match(f.message, /^Đáp án đúng mở đầu bằng động từ “Use Amazon …” còn 2 phương án nhiễu \(B, C\) là cụm danh từ/);
  const nounKey = spec({
    options: [
      'Amazon RDS Multi-AZ deployment with a synchronous standby in a second Availability Zone',
      'Create a cross-Region read replica and promote it manually during an outage',
      'Take hourly automated snapshots and restore them in another Availability Zone',
      'Add two read replicas in other Availability Zones behind a Route 53 record',
    ],
  });
  assert.match(find(nounKey, 'options-nonparallel')!.message, /^Đáp án đúng là cụm danh từ “Amazon RDS …” còn 3 phương án nhiễu \(B, C, D\) mở đầu bằng động từ/);
  // a taxonomy service name opens a noun phrase ("Aurora …") — known only with the taxonomy
  const aurora = spec({ options: ['Aurora Replicas behind the reader endpoint of the cluster', ...OPTIONS.slice(1)] });
  assert.ok(has(aurora, 'options-nonparallel', tax));
  assert.equal(has(aurora, 'options-nonparallel'), false);
  // feature names that open with a verb are noun phrases
  const runCommand = spec({ options: ['Run Command with the AWS-RunPatchBaseline document on every managed instance', ...OPTIONS.slice(1)] });
  assert.ok(has(runCommand, 'options-nonparallel'));
  // conservative: parallel sets, noun-phrase sets, undecided openings and a single odd distractor pass
  for (const options of [
    OPTIONS,
    ['Dedicated Hosts with host affinity for the licensed servers', 'Dedicated Instances in a dedicated-tenancy VPC', 'Spot Instances in a cluster placement group', 'Reserved Instances with default tenancy'],
    ['Amazon S3 Standard-IA with a lifecycle rule after 30 days', 'Amazon S3 Glacier Deep Archive for every object', 'Amazon EFS One Zone with lifecycle management', 'Amazon EBS gp3 volumes attached to one instance'],
    ['Inventory', 'Run Command', 'Parameter Store', 'Patch Manager'],
    ['Drift detection', 'Change sets', 'Stack policies', 'Nested stacks'],
    ['Use Amazon RDS Multi-AZ with a synchronous standby', 'Amazon Aurora global database in two Regions', 'Take hourly automated snapshots and restore them', 'Create a cross-Region read replica'],
    // the real AI long-form sample: an action verb not every list knows opens the key
    [
      'Launch the instances as Dedicated Instances in a dedicated-tenancy VPC and report the physical core count from instance metadata',
      'Launch Spot Instances in a cluster placement group and tag each instance with its license details to document placement over time',
      'Launch On-Demand Instances with default tenancy in a partition placement group and map each partition to a licensed server',
      'Allocate Dedicated Hosts, launch the instances onto them with host affinity set to Host, and track sockets and cores per host',
    ],
  ]) {
    const answer = options.length === 4 && options[3].startsWith('Allocate') ? ['D'] : ['A'];
    assert.equal(has(spec({ options, answer }), 'options-nonparallel', tax), false, options.join(' | '));
  }
});

// ── scope ───────────────────────────────────────────────────────────────────

test('exam-spec scope: origin ai | doc, difficulty medium | hard, created on or after the date; "" = off; other rules unaffected', () => {
  const all = (patch: Partial<Pick<Input, 'origin' | 'difficulty' | 'created'>>, since = SINCE) => specCodes(spec({ ...FLAWED, ...patch }), undefined, since);
  assert.deepEqual(all({}), SPEC_CODES);
  assert.deepEqual(all({ origin: 'doc', difficulty: 'hard' }), SPEC_CODES);
  for (const origin of ['imported', 'manual'] as const) assert.deepEqual(all({ origin }), [], origin);
  assert.deepEqual(all({ difficulty: 'easy' }), []);
  assert.deepEqual(all({ created: '2026-10-21' }), [], 'created the day before');
  assert.deepEqual(all({ created: '2026-11-03' }), SPEC_CODES, 'created later');
  assert.deepEqual(all({ created: '2026-10-22T09:30' }), SPEC_CODES, 'a timestamp counts by its day');
  assert.deepEqual(all({ created: undefined }), [], 'no created date');
  assert.deepEqual(all({ created: 'soon' }), [], 'a malformed date');
  assert.deepEqual(all({}, ''), [], '"" = off');
  assert.ok(lint.isExamSpec({ origin: 'ai', difficulty: 'hard', created: SINCE }, SINCE));
  assert.equal(lint.isExamSpec({ origin: 'ai', difficulty: 'hard', created: SINCE }, ''), false);
  assert.equal(lint.isExamSpec({ origin: 'imported', difficulty: 'hard', created: SINCE }, SINCE), false);
  // the classic rules do not depend on the scope
  const longest = spec({ ...FLAWED, origin: 'imported', options: ['Use Amazon S3 buckets with versioning and lifecycle rules', 'Amazon EBS', 'Amazon EFS', 'An instance store'] });
  assert.ok(codes(longest).includes('longest-correct'));
});

test('the default exam-spec date is config quality.exam_spec_since, re-read when config.yaml changes', () => {
  const q = spec({ ...FLAWED, created: '2026-10-05' });
  const spec0 = () => lint.lintQuestion(q, tax).map((f) => f.code).filter((c) => SPEC_CODES.includes(c));
  try {
    assert.equal(lint.examSpecSince(), '2026-10-01');
    assert.deepEqual(spec0(), SPEC_CODES);
    fs.writeFileSync(CONFIG, 'quality:\n  exam_spec_since: "2026-10-10"   # later than the question\n');
    assert.equal(lint.examSpecSince(), '2026-10-10');
    assert.deepEqual(spec0(), []);
    fs.writeFileSync(CONFIG, "quality:\n  exam_spec_since: ''\n");
    assert.equal(lint.examSpecSince(), '');
    assert.deepEqual(spec0(), [], "'' = off");
    fs.writeFileSync(CONFIG, 'quality:\n  exam_spec_since: next week\n');
    assert.equal(lint.examSpecSince(), '', 'a malformed date is off');
    fs.writeFileSync(CONFIG, '# no quality section\n');
    assert.equal(lint.examSpecSince(), '2026-10-22', 'the app default');
  } finally {
    fs.writeFileSync(CONFIG, CONFIG_TEXT);
  }
  assert.equal(lint.examSpecSince(), '2026-10-01');
});

// ── bank summary ────────────────────────────────────────────────────────────

/** A pack text: `origin` front matter, one block per question (difficulty / created per question). */
function packText(id: string, origin: string, qs: { id: string; stem: string; options: string[]; answer: string[]; explanation: string; difficulty?: string; created?: string }[]): string {
  const blocks = qs.map((q) =>
    [
      `## Q ${q.id}`,
      '- domain: resilient',
      '- task: 2.2',
      '- topic: database',
      `- difficulty: ${q.difficulty ?? 'medium'}`,
      '- time: 90',
      ...(q.created ? [`- created: ${q.created}`] : []),
      '',
      q.stem,
      '',
      ...q.options.map((o, i) => `- ${'ABCDEFGH'[i]}. ${o}`),
      '',
      `**Answer:** ${q.answer.join(', ')}`,
      '',
      `**Explanation:** ${q.explanation}`,
      '',
    ].join('\n'),
  );
  return `---\npack: ${id}\ntitle: ${id}\norigin: ${origin}\n---\n\n# ${id}\n\n${blocks.join('\n---\n\n')}`;
}

test('lintBank counts the exam-spec rules of exam-spec questions; the cache keys on the exam-spec date', () => {
  const text = packText('v6-bank', 'ai', [
    { id: 'b-clean', stem: STEM, options: OPTIONS, answer: ['A'], explanation: EXPLANATION, created: SINCE },
    { id: 'b-short', stem: SHORT_STEM, options: OPTIONS, answer: ['A'], explanation: EXPLANATION, created: SINCE },
    { id: 'b-easy', stem: SHORT_STEM, options: OPTIONS, answer: ['A'], explanation: EXPLANATION, created: SINCE, difficulty: 'easy' },
    { id: 'b-old', stem: SHORT_STEM, options: OPTIONS, answer: ['A'], explanation: EXPLANATION, created: '2026-09-30' },
  ]);
  const parsed = parsePack(text, 'bank/packs/ai/v6-bank.md', tax);
  assert.deepEqual(parsed.problems.filter((p) => p.level === 'error'), []);
  const bank = { version: 'lint-v6-bank', taxonomy: tax, packs: [parsed.pack], questions: parsed.questions, byId: new Map(parsed.questions.map((q) => [q.id, q])), problems: parsed.problems };
  const s = lint.lintBank(bank, { examSpecSince: SINCE });
  assert.equal(s.byCode['stem-short'].count, 1);
  assert.deepEqual(s.ids?.['stem-short'], ['b-short']);
  assert.equal(s.byCode['options-nonparallel'].count, 0);
  assert.equal(lint.lintBank(bank, { examSpecSince: SINCE }), s, 'same version and date → cached');
  const off = lint.lintBank(bank, { examSpecSince: '' });
  assert.notEqual(off, s);
  assert.equal(off.byCode['stem-short'].count, 0);
  // the drill-down uses the config date (2026-10-01): b-old was created before it
  assert.deepEqual(lint.lintQuestionsFor(bank, 'stem-short').map((x) => x.id), ['b-short']);
});

// ── pack-level checks (validate) ────────────────────────────────────────────

/** One question: the key and three distractors (multiple response: the first distractor is a key too). */
const mcq = (key: string, others: string[], multi = false) =>
  ({ options: [key, ...others].map((text, i) => ({ key: 'ABCD'[i], text })), answer: multi ? ['A', 'B'] : ['A'] }) as Pick<Question, 'options' | 'answer'>;

test('packSpecWarnings: from 8 exam-spec questions — multiple-response share < 20 %, key strictly the longest option in > 25 %', () => {
  const others = ['Run it on servers you patch', 'Run it on Spot capacity now', 'Run it on hosts you own too'];
  const even = mcq('Run it on a managed service', others); // as long as the longest distractor: not "the longest"
  const long = mcq('Run it on a managed service with automatic scaling', others);
  assert.equal(lint.PACK_SPEC_MIN_QUESTIONS, 8);
  assert.deepEqual(lint.packSpecWarnings(Array(7).fill(long)), [], 'fewer than 8: no pack-level check');
  const w = lint.packSpecWarnings(Array(8).fill(even));
  assert.equal(w.length, 1);
  assert.match(w[0], /^0\/8 câu chuẩn đề là câu nhiều đáp án \(0 % < 20 %\)/);
  const mr = mcq('Run it on a managed service', others, true);
  assert.deepEqual(lint.packSpecWarnings([mr, mr, ...Array(6).fill(even)]), [], '2/8 = 25 % multiple-response is enough');
  const three = lint.packSpecWarnings([mr, mr, long, long, long, even, even, even]);
  assert.equal(three.length, 1);
  assert.match(three[0], /^Đáp án đúng là phương án dài nhất ở 3\/8 câu chuẩn đề \(38 % > 25 %\)/);
  assert.deepEqual(lint.packSpecWarnings([mr, mr, long, long, even, even, even, even]), [], '2/8 = 25 % is not above the bar');
});

function validate(...args: string[]) {
  const r = spawnSync(process.execPath, ['scripts/validate.ts', ...args], { cwd: TRAINER_ROOT, env: { ...process.env, TRAINER_HOME: home, NODE_OPTIONS: '' }, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test('validate: ⚠️ pack-level lines for a pack of exam-spec questions (never an error); --lint lists the exam-spec rules and their scope', () => {
  const file = path.join(home, 'bank', 'packs', 'ai', 'v6-pack.md');
  const key = 'Convert the DB instance to a Multi-AZ deployment with a synchronous standby replica in a second zone';
  const qs = Array.from({ length: 8 }, (_, i) => ({ id: `vp-${i + 1}`, stem: STEM, options: [key, ...OPTIONS.slice(1)], answer: ['A'], explanation: EXPLANATION, created: SINCE }));
  fs.writeFileSync(file, packText('v6-pack', 'ai', qs));
  try {
    const plain = validate();
    assert.equal(plain.code, 0, plain.out + plain.err);
    assert.match(plain.out, /⚠️ {2}bank\/packs\/ai\/v6-pack\.md: 0\/8 câu chuẩn đề là câu nhiều đáp án \(0 % < 20 %\)/);
    assert.match(plain.out, /⚠️ {2}bank\/packs\/ai\/v6-pack\.md: Đáp án đúng là phương án dài nhất ở 8\/8 câu chuẩn đề \(100 % > 25 %\)/);

    const text = validate('--lint');
    assert.equal(text.code, 0);
    for (const r of lint.LINT_RULES.filter((x) => x.examSpec)) {
      assert.match(text.out, new RegExp(`  ${r.severity} +${r.code} +\\d+  ${r.label} \\[chuẩn đề\\]`), r.code);
    }
    assert.match(text.out, /\[chuẩn đề\] chỉ áp cho câu AI \/ tài liệu, medium \/ hard, tạo từ 2026-10-01 \(quality\.exam_spec_since\): 8 câu active/);

    const json = JSON.parse(validate('--lint', '--json').out);
    assert.equal(json.packWarnings.length, 2);
    assert.deepEqual(json.packWarnings.map((w: { pack: string }) => w.pack), ['v6-pack', 'v6-pack']);
    assert.deepEqual(json.lint.examSpec, { since: '2026-10-01', questions: 8 });
    assert.equal(json.lint.rules.find((r: { code: string }) => r.code === 'stem-short').count, 0);

    fs.writeFileSync(CONFIG, "quality:\n  exam_spec_since: ''\n");
    const off = validate('--lint');
    assert.equal(off.code, 0);
    assert.doesNotMatch(off.out, /câu chuẩn đề/);
    assert.match(off.out, /\[chuẩn đề\] đang tắt \(quality\.exam_spec_since rỗng\)/);
  } finally {
    fs.writeFileSync(CONFIG, CONFIG_TEXT);
    fs.rmSync(file, { force: true });
  }
});

// ── [v6] legacy scope ───────────────────────────────────────────────────────

test('scope: legacy — oos-answer / oos-distractor also fire, saying the service was dropped from the in-scope list; out messages unchanged', () => {
  const scoped = (scopes: Record<string, 'in' | 'out' | 'legacy'>): Taxonomy => ({
    ...tax,
    services: { ...tax.services, ...Object.fromEntries(Object.entries(scopes).map(([name, scope]) => [name, { ...tax.services[name], scope }])) },
  });
  const t = scoped({ 'Data Pipeline': 'legacy', QLDB: 'legacy', CodeCommit: 'out', Lightsail: 'out' });
  const q = (options: string[], answer = ['A']) => ({ id: 'lg', stem: STEM, options: options.map((text, i) => ({ key: 'ABCD'[i], text })), answer, explanation: EXPLANATION });
  const etl = ['Schedule the nightly copy with AWS Data Pipeline', 'Schedule the nightly copy with AWS Glue jobs', 'Run the copy from a cron job on Amazon EC2', 'Trigger the copy with Amazon EventBridge Scheduler'];

  const ans = lint.lintQuestion(q(etl), t).find((f) => f.code === 'oos-answer')!;
  assert.equal(ans.severity, 'medium');
  assert.equal(ans.option, 'A');
  assert.equal(ans.message, 'Đáp án đúng nêu dịch vụ đã bị gỡ khỏi danh sách in-scope của đề (Data Pipeline) — đề thật SAA-C03 không hỏi dịch vụ này');

  const dis = lint.lintQuestion(q(etl, ['B']), t).filter((f) => f.code === 'oos-distractor');
  assert.deepEqual(dis.map((f) => [f.option, f.severity]), [['A', 'low']]);
  assert.equal(dis[0].message, 'Phương án nhiễu A nêu dịch vụ đã bị gỡ khỏi danh sách in-scope của đề (Data Pipeline) — loại được ngay vì đề thật không dùng');

  // `scope: out` keeps its wording; a key naming both kinds names both
  const code = ['Store the code in AWS CodeCommit', 'Store the code in Amazon S3', 'Store the code on Amazon EFS', 'Store the code on an EBS volume'];
  assert.equal(lint.lintQuestion(q(code), t).find((f) => f.code === 'oos-answer')!.message, 'Đáp án đúng nêu dịch vụ ngoài phạm vi đề thi (CodeCommit) — đề thật SAA-C03 không hỏi dịch vụ này');
  assert.equal(
    lint.lintQuestion(q(['Use Amazon Lightsail', 'Keep the ledger in Amazon QLDB', 'Use Amazon RDS', 'Use Amazon DynamoDB'], ['C']), t).find((f) => f.option === 'A')!.message,
    'Phương án nhiễu A nêu dịch vụ ngoài phạm vi (Lightsail) — loại được ngay vì đề thật không dùng',
  );
  const both = lint.lintQuestion(q(['Mirror AWS CodeCommit repositories with AWS Data Pipeline', ...code.slice(1)]), t).find((f) => f.code === 'oos-answer')!;
  assert.match(both.message, /ngoài phạm vi đề thi \(CodeCommit\); đã bị gỡ khỏi danh sách in-scope của đề \(Data Pipeline\)/);
  // in scope: nothing
  assert.deepEqual(lint.lintQuestion(q(etl), scoped({ 'Data Pipeline': 'in' })).filter((f) => f.code.startsWith('oos-')), []);
});

// ── "(Select TWO.)" ─────────────────────────────────────────────────────────

const RAW = (over: Record<string, unknown> = {}) => ({
  domain: 'resilient',
  task: '2.2',
  topic: 'database',
  services: ['RDS'],
  tags: ['multi-az'],
  difficulty: 'medium',
  concept: 'RDS Multi-AZ vs read replicas',
  refs: ['03-database-services.md'],
  hint: 'Yêu cầu nào quyết định: tự chuyển đổi dự phòng hay mở rộng đọc?',
  stem: STEM,
  options: OPTIONS,
  answer: ['A'],
  explanation: EXPLANATION,
  ...over,
});

test('"(Select TWO.)" (the real exam) and "(Choose TWO)" (the bank) are the same instruction everywhere', () => {
  assert.deepEqual(lint.chooseInstruction('Which TWO actions meet these requirements? (Select TWO.)'), { count: 2, text: '(Select TWO.)' });
  assert.deepEqual(lint.chooseInstruction('Which steps should be taken? (select three)'), { count: 3, text: '(select three)' });
  assert.deepEqual(lint.chooseInstruction('Which steps should be taken? (SELECT 2.)'), { count: 2, text: '(SELECT 2.)' });
  assert.deepEqual(lint.chooseInstruction('Which steps should be taken? **(Select THREE.)**'), { count: 3, text: '(Select THREE.)' });
  assert.deepEqual(lint.chooseInstruction('Which steps should be taken? Select TWO.'), { count: 2, text: 'Select TWO.' });

  // lint choose-count
  const five = [...OPTIONS, 'Move the database to Amazon DynamoDB with global tables in two Regions'];
  const mr = (stem: string, answer: string[]) => ({ id: 's2', stem, options: five.map((text, i) => ({ key: 'ABCDE'[i], text })), answer, explanation: EXPLANATION });
  assert.deepEqual(lint.lintQuestion(mr(`${STEM} (Select TWO.)`, ['A', 'B'])).filter((f) => f.code === 'choose-count'), []);
  assert.match(lint.lintQuestion(mr(`${STEM} (Select TWO.)`, ['A'])).find((f) => f.code === 'choose-count')!.message, /Đề ghi “\(Select TWO\.\)” nhưng đáp án có 1 khoá/);

  // pack-format: count check, no "should say (Choose TWO)" warning
  const parsed = (stem: string, answer: string[]) => parsePack(packText('sel', 'manual', [{ id: 'sel-1', stem, options: five, answer, explanation: EXPLANATION }]), 'bank/packs/manual/sel.md', tax);
  const ok = parsed(`${STEM} (Select TWO.)`, ['A', 'B']);
  assert.deepEqual(ok.problems.filter((p) => /Choose|Select/.test(p.message)), []);
  assert.equal(ok.questions[0].answer.length, 2);
  assert.ok(parsed(`${STEM} (Select THREE.)`, ['A', 'B']).problems.some((p) => p.level === 'error' && p.message.startsWith('Stem says "(Select THREE.)" but the answer has 2 key(s)')));

  // AI drafts (ai-output.ts draftOf)
  const bank = loadBank();
  const ctx = { tax, today: SINCE, kind: 'generate' as const, bank };
  assert.deepEqual(aiOut.draftOf(RAW({ stem: `${STEM} (Select TWO.)`, options: five, answer: ['A', 'B'] }), 'doc-sel-01', ctx).errors, []);
  assert.match(aiOut.draftOf(RAW({ stem: `${STEM} (Select TWO.)` }), 'doc-sel-01', ctx).errors.join(' | '), /đề ghi "\(Select TWO\.\)" nhưng chỉ có 1 đáp án/);
  assert.match(aiOut.draftOf(RAW({ options: five, answer: ['A', 'B'] }), 'doc-sel-01', ctx).errors.join(' | '), /phải ghi "\(Choose TWO\)"/, 'the app still asks for its own wording');

  // exam-guide coverage: "Choose THREE" counts "(Select THREE.)" stems
  const g = (id: string, stem: string, answer: string[]) => ({ id, stem, answer, status: 'active', task: '2.2', options: [], skills: [], longForm: false }) as unknown as Question;
  const cov = guideCoverage({ questions: [g('g1', 'Which three? (Select THREE.)', ['A', 'B']), g('g2', 'Which three? (Choose THREE)', ['A', 'B']), g('g3', 'Which one?', ['A'])] });
  assert.equal(cov.chooseThree, 2);
});

// ── AI acceptance (ai-output.ts) ────────────────────────────────────────────

test('AI questions: exam-spec flaws come back as warnings (never rejections); the medium ones ride along in the repair round', () => {
  const bank = loadBank();
  const plan = aiOut.planPack({ kind: 'generate', runId: 'r-v6', today: SINCE, sources: ['03-database-services.md'] }, { pack: { slug: 'v6-spec', title: 'V6' } }, bank);
  const ctx = { tax, today: SINCE, kind: 'generate' as const, bank };
  const weak = aiOut.draftOf(RAW({ stem: SHORT_STEM, explanation: [LEAD, LINES[0], VN].join('\n') }), plan.idOf(0), ctx);
  assert.deepEqual(weak.errors, []);
  const c = aiOut.checkDraft(weak.draft!, plan, bank); // default exam-spec date: config 2026-10-01
  assert.deepEqual(c.errors, [], 'exam-spec flaws never reject');
  const tagged = (code: string) => c.warnings.some((w) => w.startsWith('lint: ') && w.endsWith(`[${code}]`));
  for (const code of ['stem-short', 'explanation-coverage', 'doc-url-missing']) assert.ok(tagged(code), `${code}: ${c.warnings.join(' | ')}`);
  const medium = aiOut.examSpecWarnings(c.warnings);
  assert.deepEqual(medium.map((w) => /\[([a-z-]+)\]$/.exec(w)?.[1]), ['stem-short', 'explanation-coverage']);
  assert.deepEqual(aiOut.examSpecWarnings(['lint: nhắc nhẹ [longest-correct · A]', 'thiếu hint', 'lint: x [doc-url-missing]']), []);

  const prompt = aiOut.repairPrompt('generate', 'r-v6', [{ id: plan.idOf(0), errors: ['lỗi nặng'], label: '“A company…”', warnings: medium }]);
  assert.match(prompt, /- `doc-v6-spec-01` \(“A company…”\): lỗi nặng — nên sửa luôn \(không chặn\): lint: Đề chỉ 21 từ \(< 55\)[^\n]*\[stem-short\] \| lint: Giải thích có 1 dòng[^\n]*\[explanation-coverage\]\n/);
  assert.match(aiOut.repairPrompt('generate', 'r-v6', [{ id: 'x-01', errors: ['e'] }]), /- `x-01`: e\n/, 'no warnings: the line is unchanged');

  // an easy question (and one written before the date) is not exam-spec
  const easy = aiOut.draftOf(RAW({ stem: SHORT_STEM, difficulty: 'easy' }), plan.idOf(1), ctx);
  assert.deepEqual(aiOut.examSpecWarnings(aiOut.checkDraft(easy.draft!, plan, bank).warnings), []);
  const old = aiOut.draftOf(RAW({ stem: SHORT_STEM }), plan.idOf(2), { ...ctx, today: '2026-09-15' });
  assert.deepEqual(aiOut.examSpecWarnings(aiOut.checkDraft(old.draft!, plan, bank).warnings), []);
});
