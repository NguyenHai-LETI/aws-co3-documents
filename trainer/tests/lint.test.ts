// Unit tests for the item-writing lint (server/lib/lint.ts): every rule positive + negative, severities, newFlaws,
// the bank summary + cache, the real bank (no high-severity flaw) and `validate --lint`. Run: npm test
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LINT_RULES, articleFor, chooseInstruction, correctIsLongest, familyFlaws, lintBank, lintContext, lintQuestion, lintQuestionsFor, newFlaws, type LintInput } from '../server/lib/lint.ts';
import { loadBank, type BankState } from '../server/lib/bank.ts';
import { loadTaxonomy } from '../server/lib/taxonomy.ts';
import { parsePack } from '../server/lib/pack-format.ts';
import { TRAINER_ROOT } from './helpers/paths.ts';

const tax = loadTaxonomy();
const tmpDirs: string[] = [];
after(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

const LONG_EXPLANATION =
  'Multi-AZ keeps a synchronous standby in another Availability Zone and fails over automatically through the same endpoint, so the application needs no change at all.';

/** A clean single-answer question; `patch` overrides any part. Options as plain strings (A, B, C…). */
function mk(patch: Partial<Omit<LintInput, 'options'>> & { options?: string[] } = {}): LintInput {
  const options = (patch.options ?? ['Convert the DB instance to a Multi-AZ deployment', 'Create a cross-Region read replica and promote it', 'Take hourly snapshots and restore them elsewhere', 'Add two read replicas behind a Route 53 record']).map(
    (text, i) => ({ key: 'ABCDEFGH'[i], text }),
  );
  return {
    id: patch.id ?? 'lint-q1',
    stem: patch.stem ?? 'A healthcare company runs PostgreSQL on Amazon RDS. The database must keep running if an Availability Zone fails. Which solution meets these requirements?',
    options,
    answer: patch.answer ?? ['A'],
    explanation: patch.explanation ?? LONG_EXPLANATION,
  };
}

const codes = (q: LintInput) => lintQuestion(q).map((f) => f.code);
const has = (q: LintInput, code: string) => codes(q).includes(code);

test('a well-written question has no flaw; every rule has a stable code, a severity and Vietnamese copy', () => {
  assert.deepEqual(lintQuestion(mk()), []);
  assert.equal(new Set(LINT_RULES.map((r) => r.code)).size, LINT_RULES.length);
  for (const r of LINT_RULES) {
    assert.match(r.code, /^[a-z]+(?:-[a-z]+)*$/);
    assert.ok(['high', 'medium', 'low'].includes(r.severity));
    assert.ok(r.label && r.fix, r.code);
  }
  assert.deepEqual(
    LINT_RULES.filter((r) => r.severity === 'high').map((r) => r.code),
    ['duplicate-options', 'all-none-above', 'choose-count', 'letter-ref'],
  );
  // degenerate input never throws
  assert.doesNotThrow(() => lintQuestion({ id: 'x', stem: '', options: [], answer: [], explanation: '' }));
});

test('duplicate-options (high): identical raw text ignoring case, whitespace and a trailing period — punctuation counts', () => {
  const q = mk({ options: ['Use Amazon SQS', 'Use Amazon SNS', 'use amazon  SQS.', 'Use Amazon MQ'] });
  const f = lintQuestion(q).filter((x) => x.code === 'duplicate-options');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'high');
  assert.equal(f[0].option, 'C');
  assert.match(f[0].message, /trùng nội dung với A/);
  assert.ok(has(mk({ options: ['arn:aws:s3:::reports-bucket/*', 'ARN:AWS:S3:::reports-bucket/* ', 'arn:aws:s3:::other', 'arn:aws:iam:::x'] }), 'duplicate-options'));
  assert.equal(has(mk({ options: ['Use Amazon SQS', 'Use Amazon SNS', 'Use Amazon SQS FIFO', 'Use Amazon MQ'] }), 'duplicate-options'), false);
  // review finding: bucket ARN vs object ARN vs a wildcard bucket are three different answers (same words, other punctuation)
  const arns = ['arn:aws:s3:::reports-bucket/*', 'arn:aws:s3:::reports-bucket', 'arn:aws:s3:::*/reports-bucket', 'arn:aws:iam:::reports-bucket'];
  assert.equal(has(mk({ options: arns }), 'duplicate-options'), false);
  assert.equal(has(mk({ options: ['10.0.0.0/16', '10.0.0.0/24', '10.0.0.0-16', '10.0.0.0+16'] }), 'duplicate-options'), false);
  assert.equal(has(mk({ options: ['C++ runtime', 'C# runtime', 'C runtime', '<C> runtime'] }), 'duplicate-options'), false);
});

test('all-none-above (high): "All/None of the above" and whole options that name other options by letter', () => {
  for (const text of [
    'All of the above',
    'None of the above.',
    'None of the following options apply',
    'Both of the answers',
    'Both A and C',
    'A and B',
    'Either option B or D',
    'Options B and D',
    'A, B and C are correct',
    'Neither A nor B',
    'Option C',
    '**Both A and C**.',
    'None',
    'All',
    'None of these',
  ]) {
    const q = mk({ options: ['Use Amazon S3', 'Use Amazon EBS', 'Use Amazon EFS', text], answer: ['A'] });
    const f = lintQuestion(q).find((x) => x.code === 'all-none-above');
    assert.ok(f, text);
    assert.equal(f.option, 'D');
    assert.equal(f.severity, 'high');
  }
  // review findings + ordinary prose: no positional reference
  for (const text of [
    'Create a gateway endpoint for S3 and add a route to it in the route tables of both of them',
    'Register all of these instances in an Application Load Balancer target group',
    'Use private Class B or C address ranges for the VPC',
    'Encrypt all objects with SSE-KMS',
    'Block all public access on the bucket',
    'Use an A record in Route 53',
    'Create A and AAAA alias records',
    'A',
    'Neither replica handles writes',
    'Apply the policy to all of the accounts in the organization',
  ]) {
    assert.equal(has(mk({ options: ['Use Amazon S3', 'Use Amazon EBS', 'Use Amazon EFS', text] }), 'all-none-above'), false, text);
  }
});

test('choose-count (high): only the "(Choose N)" / closing "Choose N." instruction counts, and it must match the keys', () => {
  const opts = ['Add Aurora Replicas', 'Use the cluster endpoint', 'Hard-code the writer', 'Enable Multi-AZ per reader', 'Put DAX in front'];
  assert.ok(has(mk({ stem: 'Which actions should be taken? (Choose TWO)', options: opts, answer: ['A'] }), 'choose-count'));
  assert.ok(has(mk({ stem: 'Which actions should be taken? (Select THREE.)', options: opts, answer: ['A', 'B'] }), 'choose-count'));
  assert.ok(has(mk({ stem: 'Which actions should be taken? Choose two.', options: opts, answer: ['A'] }), 'choose-count'));
  assert.ok(has(mk({ stem: 'Which actions should be taken? Select THREE', options: opts, answer: ['A', 'B'] }), 'choose-count'));
  assert.ok(has(mk({ stem: 'Which actions should be taken?', options: opts, answer: ['A', 'B'] }), 'choose-count'), 'multi-key without instruction');
  assert.equal(has(mk({ stem: 'Which actions should be taken? (Choose TWO)', options: opts, answer: ['A', 'B'] }), 'choose-count'), false);
  assert.equal(has(mk({ stem: 'Which actions should be taken? (Choose two.)', options: opts, answer: ['A', 'B'] }), 'choose-count'), false);
  assert.equal(has(mk({ stem: 'Which action should be taken? (select 3)', options: opts, answer: ['A', 'B', 'E'] }), 'choose-count'), false);
  assert.equal(has(mk({ stem: 'Which actions meet the requirements? Choose two answers.', options: opts, answer: ['A', 'C'] }), 'choose-count'), false);
  assert.equal(has(mk(), 'choose-count'), false);
  // review findings: counts inside the scenario are no instruction
  assert.equal(has(mk({ stem: 'Developers select 4 vCPUs and 16 GiB of memory for a batch job that runs nightly. Which purchasing option is the MOST cost-effective?' }), 'choose-count'), false);
  assert.equal(has(mk({ stem: 'A company must choose two AWS Regions for its disaster recovery plan. Which strategy meets the requirement?' }), 'choose-count'), false);
  assert.equal(has(mk({ stem: 'The team will pick three instance types and select 2 AZs. Which design is MOST resilient?' }), 'choose-count'), false);
  assert.deepEqual(chooseInstruction('Which TWO? (Choose two.)'), { count: 2, text: '(Choose two.)' });
  assert.deepEqual(chooseInstruction('Which ones meet the requirements? Select THREE'), { count: 3, text: 'Select THREE' });
  assert.equal(chooseInstruction('Developers select 4 vCPUs for the job. Which option?'), undefined);
  const msg = lintQuestion(mk({ stem: 'Which actions should be taken?', options: opts, answer: ['A', 'B'] })).find((f) => f.code === 'choose-count')!.message;
  assert.match(msg, /\(Choose TWO\)/);
});

test('review regression: a legitimate generated S3-policy question has no high-severity flaw', () => {
  const q = mk({
    stem: 'A company stores reports in an Amazon S3 bucket named reports-bucket. A bucket policy must let an IAM role download every object in the bucket and nothing else. Which value should the Resource element of the policy statement contain?',
    options: ['arn:aws:s3:::reports-bucket/*', 'arn:aws:s3:::reports-bucket', 'arn:aws:s3:::*/reports-bucket', 'arn:aws:iam:::reports-bucket'],
    explanation:
      'GetObject is an object-level action, so the Resource must match the objects inside the bucket, which the wildcard path after the bucket name does for every key.\n- Bucket ARN alone: matches the bucket itself, used for ListBucket, not objects.\n- IAM ARN: not an S3 resource.\n> 🇻🇳 Quyền trên đối tượng cần ARN có /* sau tên bucket.',
  });
  assert.deepEqual(lintQuestion(q).filter((f) => f.severity === 'high'), []);
});

test('letter-ref (high): explanations that name option letters (LETTER_REF_RE)', () => {
  for (const e of [
    'Option B is wrong because it is manual.',
    'Why:\n- A: slow restore.\n- B) expensive',
    'The cheapest = C here.',
    'Pick (D) when RTO is minutes.',
    // Vietnamese summaries (Unicode-aware LETTER_REF_RE)
    '> 🇻🇳 Đáp án B sai vì phải tự failover.',
    '> 🇻🇳 Chọn phương án C khi cần độ trễ thấp.',
    '> 🇻🇳 Lựa chọn A tốn kém hơn.',
    '> 🇻🇳 Vì vậy đáp án đúng là D.',
  ]) {
    assert.ok(has(mk({ explanation: `${LONG_EXPLANATION}\n${e}` }), 'letter-ref'), e);
  }
  // Vietnamese prose without a letter is fine
  assert.equal(has(mk({ explanation: `${LONG_EXPLANATION}\n> 🇻🇳 Phương án dùng Multi-AZ là đáp án đúng vì failover tự động; lựa chọn còn lại chỉ mở rộng đọc.` }), 'letter-ref'), false);
  // content references and prose are fine; an embedded "**Answer:** B" line is ignored like the validator does
  assert.equal(has(mk({ explanation: `${LONG_EXPLANATION}\n- Read replicas: asynchronous, no automatic failover.` }), 'letter-ref'), false);
  assert.equal(has(mk({ explanation: `**Answer:** A\n${LONG_EXPLANATION} Users answer a few questions.` }), 'letter-ref'), false);
  assert.equal(has(mk({ explanation: `${LONG_EXPLANATION} The RPO = a few minutes.` }), 'letter-ref'), false);
});

test('longest-correct (medium): correct option ≥ 15 % longer than every distractor (single and multi answer)', () => {
  const q = mk({ options: ['Convert the DB instance to a Multi-AZ deployment with automatic failover', 'Use a read replica', 'Take snapshots', 'Add Route 53'] });
  const f = lintQuestion(q).find((x) => x.code === 'longest-correct')!;
  assert.equal(f.severity, 'medium');
  assert.equal(f.option, 'A');
  assert.match(f.message, /ký tự/);
  assert.equal(correctIsLongest(q), true);
  assert.equal(has(mk(), 'longest-correct'), false); // balanced lengths
  const multi = mk({ stem: 'Which TWO? (Choose TWO)', options: ['A short one', 'The correct option that is clearly the longest of all', 'Another wrong', 'Wrong option', 'Also wrong'], answer: ['A', 'B'] });
  assert.equal(lintQuestion(multi).find((x) => x.code === 'longest-correct')?.option, 'B');
  assert.equal(correctIsLongest({ options: [{ key: 'A', text: 'abc' }, { key: 'B', text: 'abd' }], answer: ['A'] }), false); // < 3 options
});

test('stem-echo (medium): a distinctive stem word only the correct option repeats', () => {
  const stem = 'A Windows-based application needs shared storage over SMB with Active Directory integration. Which service?';
  const q = mk({ stem, options: ['Amazon FSx for Windows File Server', 'Amazon EFS', 'Amazon S3 with Transfer Acceleration', 'EC2 Instance Store volumes'] });
  const f = lintQuestion(q).find((x) => x.code === 'stem-echo')!;
  assert.ok(f);
  assert.equal(f.option, 'A');
  assert.match(f.message, /“windows”/);
  // the word also appears in a distractor → no cue
  assert.equal(has(mk({ stem, options: ['Amazon FSx for Windows File Server', 'Windows Server on EC2 with EBS', 'Amazon S3', 'Amazon EFS'] }), 'stem-echo'), false);
  // stemming: "encrypted" (stem) ~ "encryption" (option)
  assert.ok(has(mk({ stem: 'Data must be encrypted at rest. What should be done?', options: ['Turn on default encryption with SSE-KMS', 'Use S3 Transfer Acceleration', 'Use a VPC endpoint', 'Use bucket versioning'] }), 'stem-echo'));
  // generic words (company, data, instance, use…) are no cue
  assert.equal(has(mk({ stem: 'A company uses EC2 instances and stores data. Which option is BEST?', options: ['Use instance data compression', 'Pick Spot', 'Pick Savings Plans', 'Pick Reserved'] }), 'stem-echo'), false);
});

test('absolute-terms (medium): always/never/only/all/none/guarantee in a distractor but not in the key', () => {
  const q = mk({ options: ['Enable S3 Versioning', 'Glacier is always cheapest', 'Use EBS only', 'Never delete objects'] });
  const f = lintQuestion(q).filter((x) => x.code === 'absolute-terms');
  assert.deepEqual(f.map((x) => x.option), ['B', 'C', 'D']);
  assert.ok(f.every((x) => x.severity === 'medium'));
  // the key uses one too → no cue; compound names are no absolute claims
  assert.equal(has(mk({ options: ['Only allow the ALB security group', 'Glacier is always cheapest', 'Use EBS', 'Use EFS'] }), 'absolute-terms'), false);
  assert.equal(has(mk({ options: ['Immutable', 'Rolling', 'All at once', 'EMR always-on cluster with read-only access'] }), 'absolute-terms'), false);
  assert.equal(has(mk({ options: ['Spot Instances', 'On-Demand', 'Dedicated Hosts', 'Reserved Instances (3-year, All Upfront)'] }), 'absolute-terms'), false);
});

test('negative-stem (medium): NOT / EXCEPT / LEAST without emphasis', () => {
  for (const stem of [
    'Kinesis Data Firehose can deliver to many targets. Which destination is not supported?',
    'All of the following improve availability except which design?',
    'A company wants to analyze logs ad-hoc using SQL with the least setup. Which service?',
    'Which of these services does not support resource-based policies?',
    'Which AWS service cannot encrypt data at rest?',
  ]) {
    const f = lintQuestion(mk({ stem })).find((x) => x.code === 'negative-stem');
    assert.ok(f, stem);
    assert.equal(f.severity, 'medium');
  }
  for (const stem of [
    'Which destination is NOT natively supported by Kinesis Data Firehose?',
    'Which design meets the requirement with the LEAST operational overhead?',
    'Which destination is **not** supported?',
    'Which AWS service CANNOT encrypt data at rest?',
    'Instances must not be reachable from the internet. Which solution meets the requirement?', // a requirement, not a negative question
    'Which combination keeps messages durable where a failed consumer does not lose messages?', // negation inside a clause
    'The workload needs at least two AZs and at-least-once delivery. Which design?',
    'Grant access following the principle of least privilege. Which IAM feature?',
  ]) {
    assert.equal(has(mk({ stem }), 'negative-stem'), false, stem);
  }
});

test('grammar-cue (medium): a trailing a/an that only the correct option fits', () => {
  const opts = ['Application Load Balancer', 'Network Load Balancer', 'Gateway Load Balancer', 'Classic Load Balancer'];
  const f = lintQuestion(mk({ stem: 'To route HTTP requests by path, the company should deploy an', options: opts })).find((x) => x.code === 'grammar-cue')!;
  assert.ok(f);
  assert.equal(f.option, 'A');
  assert.match(f.message, /còn B, C, D thì không/);
  // "a" rules out "Application Load Balancer" — still a cue (helps eliminate), reported on the key
  const partial = lintQuestion(mk({ stem: 'To spread TCP traffic, the company should deploy a', options: opts, answer: ['B'] })).find((x) => x.code === 'grammar-cue')!;
  assert.equal(partial.option, 'B');
  assert.match(partial.message, /còn A thì không/);
  // the key itself does not fit the article: a grammar slip, not a cue
  assert.equal(has(mk({ stem: 'To route HTTP requests by path, the company should deploy a', options: opts, answer: ['A'] }), 'grammar-cue'), false);
  assert.equal(has(mk({ stem: 'Which load balancer routes HTTP requests by path?', options: opts }), 'grammar-cue'), false);
  assert.equal(has(mk({ stem: 'The data should be stored in an', options: ['S3 bucket', 'EBS volume', 'EFS file system', 'RDS database'] }), 'grammar-cue'), false); // all take "an"
  assert.equal(articleFor('S3 bucket'), 'an');
  assert.equal(articleFor('EC2 instance'), 'an');
  assert.equal(articleFor('NAT gateway'), 'a');
  assert.equal(articleFor('unique key'), 'a');
  assert.equal(articleFor('hourly snapshot'), 'an');
  assert.equal(articleFor('Amazon S3'), 'an');
  assert.equal(articleFor('VPC endpoint'), 'a');
});

test('overlapping-options (medium): one option contains another whole option, or numeric ranges overlap', () => {
  const f = lintQuestion(mk({ options: ['Use Amazon SQS standard queues', 'Use Amazon SQS standard queues and Amazon SNS', 'Use Amazon MQ', 'Use Amazon Kinesis'] })).find((x) => x.code === 'overlapping-options')!;
  assert.ok(f);
  assert.equal(f.option, 'B');
  assert.ok(has(mk({ options: ['1–5 minutes', '3–10 minutes', '15–30 minutes', '60–90 minutes'] }), 'overlapping-options'));
  // AWS names that extend a shorter name are different things, disjoint ranges are fine
  assert.equal(has(mk({ options: ['Egress-only internet gateway', 'Internet gateway', 'NAT gateway', 'Transit gateway'] }), 'overlapping-options'), false);
  assert.equal(has(mk({ options: ['1–5 minutes', '6–10 minutes', '15–30 minutes', '60–90 minutes'] }), 'overlapping-options'), false);
});

test('short-explanation (low): explanations under 15 words, or none', () => {
  const f = lintQuestion(mk({ explanation: 'AZ failure + automatic failover = Multi-AZ.' })).find((x) => x.code === 'short-explanation')!;
  assert.equal(f.severity, 'low');
  assert.match(f.message, /từ/);
  assert.equal(lintQuestion(mk({ explanation: '' })).find((x) => x.code === 'short-explanation')!.message, 'Chưa có giải thích');
  assert.equal(has(mk(), 'short-explanation'), false);
});

test('flaws come worst first; newFlaws reports only codes new on the same option', () => {
  const q = mk({ options: ['Enable S3 Versioning on the bucket now', 'Use EBS only', 'Use EBS only', 'All of the above'], explanation: 'Short.' });
  const f = lintQuestion(q);
  const rank = { high: 0, medium: 1, low: 2 };
  assert.ok(f.every((x, i) => i === 0 || rank[f[i - 1].severity] <= rank[x.severity]), f.map((x) => x.severity).join(','));
  assert.equal(f[0].severity, 'high');
  assert.equal(f.at(-1)!.code, 'short-explanation');

  const before = lintQuestion(mk({ options: ['Enable S3 Versioning', 'Use EBS only', 'Use EFS', 'Use S3 Glacier'] }));
  const sameAgain = lintQuestion(mk({ options: ['Enable S3 Versioning', 'Use EBS only', 'Use EFS file systems', 'Use S3 Glacier'] }));
  assert.deepEqual(newFlaws(before, sameAgain), []);
  const moved = lintQuestion(mk({ options: ['Enable S3 Versioning', 'Use EBS', 'Use EFS only', 'Use S3 Glacier'] }));
  assert.deepEqual(newFlaws(before, moved).map((x) => `${x.code}|${x.option}`), ['absolute-terms|C']);
  const broken = lintQuestion(mk({ options: ['Enable S3 Versioning', 'Use EBS only', 'Use EFS', 'None of the above'] }));
  assert.deepEqual(newFlaws(before, broken).filter((x) => x.severity === 'high').map((x) => x.code), ['all-none-above']);
  assert.deepEqual(newFlaws(broken, before), []); // fixing a flaw is never "new"
});

// ── bank summary ────────────────────────────────────────────────────────────

let bankSeq = 0;
function bankOf(qs: LintInput[], statuses: Record<string, string> = {}): BankState {
  const blocks = qs.map((q) =>
    [
      `## Q ${q.id}`,
      '- domain: resilient',
      '- topic: database',
      '- difficulty: easy',
      '- time: 45',
      ...(statuses[q.id] ? [`- status: ${statuses[q.id]}`] : []),
      '',
      q.stem,
      '',
      ...q.options.map((o) => `- ${o.key}. ${o.text}`),
      '',
      `**Answer:** ${q.answer.join(', ')}`,
      '',
      `**Explanation:** ${q.explanation}`,
      '',
    ].join('\n'),
  );
  const text = `---\npack: lint-pack\ntitle: Lint pack\norigin: manual\n---\n\n# Lint pack\n\n${blocks.join('\n---\n\n')}`;
  const { questions, pack, problems } = parsePack(text, 'bank/packs/manual/lint.md', tax);
  return { version: `lint-test-${++bankSeq}`, taxonomy: tax, packs: [pack], questions, byId: new Map(questions.map((q) => [q.id, q])), problems };
}

test('lintBank: per-rule counts over active questions, ids, worst first, cached by bank version', () => {
  const bank = bankOf(
    [
      mk({ id: 'l-clean' }),
      mk({ id: 'l-dup', options: ['Use Amazon SQS', 'Use Amazon SNS', 'use amazon sqs', 'Use Amazon MQ'] }),
      mk({ id: 'l-short', explanation: 'Because.' }),
      mk({ id: 'l-retired', options: ['None of the above', 'Use B', 'Use C', 'Use D'] }),
    ],
    { 'l-retired': 'retired' },
  );
  const s = lintBank(bank);
  assert.equal(s.checked, 3);
  assert.equal(s.flagged, 2);
  assert.equal(s.byCode['duplicate-options'].count, 1);
  assert.equal(s.byCode['duplicate-options'].severity, 'high');
  assert.equal(s.byCode['all-none-above'].count, 0, 'retired questions are not linted');
  assert.equal(Object.keys(s.byCode).length, LINT_RULES.length, 'every rule is listed, clean ones with 0');
  assert.deepEqual(s.ids?.['short-explanation'], ['l-short']);
  assert.deepEqual(s.bySeverity, { high: 1, medium: 0, low: 1 });
  assert.deepEqual(s.questions.map((x) => x.id), ['l-dup', 'l-short']);
  assert.equal(lintBank(bank), s, 'same bank version → cached summary');
  assert.notEqual(lintBank(bank, { cache: false }), s);
  const other = bankOf([mk({ id: 'l-other', explanation: 'x' })]);
  assert.equal(lintBank(other).checked, 1, 'another version recomputes');
  assert.deepEqual(lintQuestionsFor(bank, 'duplicate-options').map((x) => x.id), ['l-dup']);
  assert.equal(lintQuestionsFor(bank).length, 2);
});

test('real bank (read-only): no question has a high-severity flaw, the summary stays fast', () => {
  const bank = loadBank();
  const t = performance.now();
  const s = lintBank(bank, { cache: false });
  assert.ok(performance.now() - t < 2000, 'lint of the whole bank < 2 s');
  assert.ok(s.checked > 100);
  assert.equal(s.bySeverity?.high ?? 0, 0, JSON.stringify(Object.fromEntries(Object.entries(s.byCode).filter(([, v]) => v.severity === 'high' && v.count))));
  // medium cues are real but must not flag the whole bank
  for (const r of LINT_RULES.filter((x) => x.severity === 'medium')) assert.ok(s.byCode[r.code].count < s.checked * 0.6, `${r.code}: ${s.byCode[r.code].count}`);
});

// ── validate --lint ─────────────────────────────────────────────────────────

function lintHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-lint-'));
  tmpDirs.push(home);
  fs.mkdirSync(path.join(home, 'bank', 'packs', 'manual'), { recursive: true });
  fs.copyFileSync(path.join(TRAINER_ROOT, 'bank', 'taxonomy.yaml'), path.join(home, 'bank', 'taxonomy.yaml'));
  const qs = [mk({ id: 'v-clean' }), mk({ id: 'v-above', options: ['Use Amazon S3', 'Use Amazon EBS', 'Use Amazon EFS', 'All of the above'] }), mk({ id: 'v-short', explanation: 'Because.' })];
  const blocks = qs.map((q) =>
    [`## Q ${q.id}`, '- domain: resilient', '- topic: database', '- difficulty: easy', '- time: 45', '', q.stem, '', ...q.options.map((o) => `- ${o.key}. ${o.text}`), '', `**Answer:** ${q.answer.join(', ')}`, '', `**Explanation:** ${q.explanation}`, ''].join('\n'),
  );
  fs.writeFileSync(path.join(home, 'bank', 'packs', 'manual', 'v.md'), `---\npack: v-pack\ntitle: V\norigin: manual\n---\n\n# V\n\n${blocks.join('\n---\n\n')}`);
  return home;
}

function validate(home: string, ...args: string[]) {
  const r = spawnSync(process.execPath, ['scripts/validate.ts', ...args], { cwd: TRAINER_ROOT, env: { ...process.env, TRAINER_HOME: home, NODE_OPTIONS: '' }, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test('validate --lint prints a summary + list, --json carries it, --lint=<code> filters; exit code follows parse errors only', () => {
  const home = lintHome();
  const json = validate(home, '--lint', '--json');
  assert.equal(json.code, 0, json.err);
  const data = JSON.parse(json.out);
  assert.equal(data.lint.checked, 3);
  assert.deepEqual(
    data.lint.questions.map((q: { id: string }) => q.id),
    ['v-above', 'v-short'],
  );
  assert.equal(data.lint.rules.find((r: { code: string }) => r.code === 'all-none-above').count, 1);

  const text = validate(home, '--lint');
  assert.equal(text.code, 0);
  assert.match(text.out, /🩺 Lint/);
  assert.match(text.out, /❗ bank\/packs\/manual\/v\.md:\d+ \[v-above\] all-none-above \(D\)/);
  assert.doesNotMatch(text.out, /\[v-short\] short-explanation/, 'low flaws are hidden without --warnings');
  assert.match(text.out, /all-none-above\s+1/);
  assert.match(text.out, /1 câu lỗi nặng/);
  assert.match(validate(home, '--lint', '--warnings').out, /\[v-short\] short-explanation/);

  const only = validate(home, '--lint=short-explanation');
  assert.match(only.out, /\[v-short\] short-explanation/);
  assert.doesNotMatch(only.out, /all-none-above/);
  assert.equal(validate(home, '--lint=nope').code, 2);
  assert.doesNotMatch(validate(home).out, /🩺 Lint/, 'plain validate is unchanged');
});

// ── [γ] exam scope + sealed exclusion ───────────────────────────────────────

test('exam scope (taxonomy scope: out): oos-answer (medium) for a correct option, oos-distractor (low) per distractor — only with the taxonomy', () => {
  const ans = mk({ options: ['Store the code in AWS CodeCommit', 'Store the code in Amazon S3', 'Store the code on Amazon EFS', 'Store the code on an EBS volume'], answer: ['A'] });
  const flaws = lintQuestion(ans, tax);
  const f = flaws.find((x) => x.code === 'oos-answer');
  assert.ok(f, JSON.stringify(flaws));
  assert.equal(f.severity, 'medium');
  assert.equal(f.option, 'A');
  assert.match(f.message, /ngoài phạm vi đề thi \(CodeCommit\)/);
  assert.ok(!flaws.some((x) => x.code === 'oos-distractor'), 'an off-exam question is not flagged again per distractor');
  assert.ok(!has(ans, 'oos-answer'), 'without the taxonomy the scope rules do not run');

  const dis = mk({ options: ['Convert the DB instance to a Multi-AZ deployment', 'Move the database to Amazon Lightsail', 'Run the database on AWS IoT Greengrass devices', 'Add two read replicas behind a Route 53 record'] });
  const d = lintQuestion(dis, tax).filter((x) => x.code === 'oos-distractor');
  assert.deepEqual(d.map((x) => [x.option, x.severity]), [['B', 'low'], ['C', 'low']]);
  assert.match(d[0].message, /\(Lightsail\)/);
  assert.match(d[1].message, /\(IoT Core\)/);
  // in scope, or merely unlisted (CodePipeline): no scope flaw
  const unlisted = mk({ options: ['Convert the DB instance to a Multi-AZ deployment', 'Orchestrate the release with AWS CodePipeline', 'Take hourly snapshots and restore them elsewhere', 'Add two read replicas behind a Route 53 record'] });
  assert.deepEqual(lintQuestion(unlisted, tax).filter((x) => x.code.startsWith('oos-')), []);
  // an AI edit that brings out-of-scope distractors: new (warning-level) flaws for the pipeline
  assert.deepEqual(newFlaws(lintQuestion(mk(), tax), lintQuestion(dis, tax)).map((x) => x.code).filter((c) => c.startsWith('oos-')), ['oos-distractor', 'oos-distractor']);
  assert.deepEqual(
    LINT_RULES.filter((r) => r.code.startsWith('oos-')).map((r) => [r.code, r.severity]),
    [['oos-answer', 'medium'], ['oos-distractor', 'low']],
  );
});

test('lintBank / lintQuestionsFor leave `exclude` (sealed questions) out of every count and list; the cache keys on it', () => {
  const bank = bankOf([mk({ id: 'e-short', explanation: 'Because.' }), mk({ id: 'e-short2', explanation: 'Because.' }), mk({ id: 'e-clean' })]);
  const all = lintBank(bank);
  assert.equal(all.byCode['short-explanation'].count, 2);
  const ex = lintBank(bank, { exclude: new Set(['e-short2']) });
  assert.equal(ex.checked, 2);
  assert.equal(ex.byCode['short-explanation'].count, 1);
  assert.deepEqual(ex.ids?.['short-explanation'], ['e-short']);
  assert.notEqual(ex, all);
  assert.equal(lintBank(bank, { exclude: new Set(['e-short2']) }), ex, 'same exclusion → cached');
  assert.deepEqual(lintQuestionsFor(bank, 'short-explanation', new Set(['e-short2'])).map((x) => x.id), ['e-short']);
  assert.deepEqual(lintQuestionsFor(bank, 'short-explanation').map((x) => x.id), ['e-short', 'e-short2']);
});

test('validate --lint lists the exam-scope rules: an out-of-scope answer (medium) and distractor (low, with --warnings)', () => {
  const home = lintHome();
  const block = (id: string, options: string[], answer: string) =>
    [`## Q ${id}`, '- domain: resilient', '- topic: devtools', '- difficulty: easy', '- time: 45', '', 'A team needs a managed place for its source code and builds. Which service should it use?', '', ...options.map((o, i) => `- ${'ABCD'[i]}. ${o}`), '', `**Answer:** ${answer}`, '', `**Explanation:** ${LONG_EXPLANATION}`, ''].join('\n');
  fs.writeFileSync(
    path.join(home, 'bank', 'packs', 'manual', 'oos.md'),
    `---\npack: oos-pack\ntitle: OOS\norigin: manual\n---\n\n# OOS\n\n${block('v-oos', ['Use AWS CodeCommit repositories', 'Use Amazon S3 buckets with versioning', 'Use Amazon EFS file systems', 'Use Amazon EBS volumes'], 'A')}\n---\n\n${block('v-oos-d', ['Use Amazon S3 buckets with versioning', 'Use Amazon Lightsail instances', 'Use Amazon EFS file systems', 'Use Amazon EBS volumes'], 'A')}`,
  );
  const out = validate(home, '--lint', '--warnings').out;
  assert.match(out, /⚠️ +bank\/packs\/manual\/oos\.md:\d+ \[v-oos\] oos-answer \(A\): Đáp án đúng nêu dịch vụ ngoài phạm vi đề thi \(CodeCommit\)/);
  assert.match(out, /· bank\/packs\/manual\/oos\.md:\d+ \[v-oos-d\] oos-distractor \(B\)/);
  assert.match(out, /medium +oos-answer +1 +Đáp án là dịch vụ ngoài phạm vi đề/);
  assert.match(out, /low +oos-distractor +1/);
});

// ── [v5 γ1] qualifier families + stale facts ───────────────────────────────

test('family-options (medium): members share one option set (letters may differ) and ask a different final question', () => {
  const opts = ['Use Amazon S3 Standard-IA', 'Use Amazon S3 Glacier Deep Archive', 'Use Amazon EFS One Zone', 'Use Amazon EBS gp3 volumes'];
  const scenario = 'A media company keeps 40 TB of video masters that are read twice a year and must be retrievable within hours.';
  const cost = mk({ id: 'f-cost', stem: `${scenario} Which solution is the MOST cost-effective?`, options: opts, answer: ['B'] });
  const fast = mk({ id: 'f-fast', stem: `${scenario} Which solution offers the LOWEST retrieval latency?`, options: [opts[2], opts[0], opts[1], opts[3]], answer: ['B'] });
  const odd = mk({ id: 'f-odd', stem: `${scenario} Which solution needs the LEAST operational effort?`, options: [...opts.slice(0, 3), 'Use Amazon FSx for Lustre'], answer: ['A'] });
  const twin = mk({ id: 'f-twin', stem: `${scenario} Which solution is the MOST cost-effective?`, options: opts, answer: ['B'] });
  assert.deepEqual(familyFlaws(cost, [cost, fast]), [], 'same set in another order, another final question');
  const f = familyFlaws(odd, [cost, fast, odd]);
  assert.deepEqual(f.map((x) => [x.code, x.severity]), [['family-options', 'medium']]);
  assert.match(f[0].message, /f-cost/);
  assert.match(familyFlaws(twin, [cost, twin])[0].message, /giống hệt f-cost/);
  assert.deepEqual(familyFlaws(cost, [cost]), [], 'a lone member is never flagged');
  // lintQuestion runs it only with the family context; lintBank / lintContext find the members
  assert.ok(!codes(odd).includes('family-options'));
  assert.ok(lintQuestion(odd, undefined, { family: [cost, fast, odd] }).some((x) => x.code === 'family-options'));
  const bank = { questions: [cost, fast, odd].map((x) => ({ ...x, family: 'storage-tier', status: 'active' })) } as unknown as BankState;
  assert.equal(lintContext(bank, { id: 'f-odd', family: 'storage-tier' })?.family?.length, 3);
  assert.equal(lintContext(bank, { id: 'f-odd' }), undefined);
});

test('stale-fact (medium): taxonomy currency facts flag the old wording, `unless` the current one is used', () => {
  const t = { ...tax, currency: [{ id: 'firehose', pattern: 'Kinesis (Data )?Firehose', unless: 'Amazon Data Firehose', fact: 'renamed', since: '2024-02-09', url: 'https://aws.amazon.com/x' }] };
  const old = mk({ options: ['Stream the logs to Kinesis Data Firehose', 'Use Amazon EFS', 'Use Amazon SQS', 'Use AWS Glue'] });
  const f = lintQuestion(old, t).find((x) => x.code === 'stale-fact')!;
  assert.equal(f.severity, 'medium');
  assert.match(f.message, /firehose.*2024-02-09.*https:\/\/aws\.amazon\.com\/x/);
  const current = mk({ options: ['Stream the logs to Amazon Data Firehose (formerly Kinesis Data Firehose)', 'Use Amazon EFS', 'Use Amazon SQS', 'Use AWS Glue'] });
  assert.ok(!lintQuestion(current, t).some((x) => x.code === 'stale-fact'));
  assert.ok(!lintQuestion(old, { ...tax, currency: [{ id: 'bad', pattern: '(', fact: '', since: '', url: '' }] }).some((x) => x.code === 'stale-fact'), 'a broken pattern is no rule');
});

test('the real taxonomy currency list: every entry compiles, is dated and cites an official AWS page', () => {
  assert.ok((tax.currency ?? []).length >= 8);
  for (const c of tax.currency ?? []) {
    assert.match(c.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.doesNotThrow(() => new RegExp(c.pattern, 'i'), c.id);
    if (c.unless) assert.doesNotThrow(() => new RegExp(c.unless!, 'i'), c.id);
    assert.match(c.since, /^\d{4}-\d{2}-\d{2}$/, c.id);
    for (const u of c.url.split(' · ')) assert.match(u, /^https:\/\/(aws\.amazon\.com|docs\.aws\.amazon\.com)\//, `${c.id}: ${u}`);
    assert.ok(c.fact.length > 10, c.id);
  }
});
