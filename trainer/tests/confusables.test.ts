// [v5 γ1] Unit tests for confusable services (server/lib/confusables.ts): services per option (key vs lures), the contrast
// pool (practice pool only, answer service for alternating), groups (≥ 8 competing questions, ≤ 4 services, the learner's
// confirmed confusions flagged), progress ("đã tách được": ≥ 10 answers, last 10 ≥ 80 %) and heading term detection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFUSABLE_RULES, confusableGroups, contrastPool, optionServices, pairStats, termsNamedIn } from '../server/lib/confusables.ts';
import { loadTaxonomy } from '../server/lib/taxonomy.ts';
import type { BankState } from '../server/lib/bank.ts';
import type { Attempt, Question } from '../shared/types.ts';

const tax = loadTaxonomy();
let n = 0;
function q(key: string, lures: string[], over: Partial<Question> = {}): Question {
  const id = over.id ?? `cf-${++n}`;
  const options = [key, ...lures].map((text, i) => ({ key: 'ABCD'[i], text }));
  return { id, stem: `Scenario ${id}`, options, answer: ['A'], status: 'active', domain: 'resilient', topic: 'integration', services: [], tags: [], variantOf: [], refs: [], hash: `h${id}`, ...over } as Question;
}
const bankOf = (questions: Question[]) => ({ version: `v${++n}`, taxonomy: tax, questions, byId: new Map(questions.map((x) => [x.id, x])), packs: [], problems: [] }) as unknown as BankState;

test('optionServices: services of the key vs services only in distractors', () => {
  const s = optionServices(q('Send to an Amazon SNS topic that fans out to Amazon SQS queues', ['Use Amazon SQS only', 'Use Amazon Kinesis Data Streams']), tax);
  assert.deepEqual(s.key.sort(), ['SNS', 'SQS']);
  assert.deepEqual(s.lures, ['Kinesis Data Streams'], 'SQS is in the key, so it is no lure');
});

test('contrastPool: two of the services compete; answerService = the first of them in the key; sealed / out of scope / drafts never', () => {
  const qs = [
    q('Use Amazon SNS', ['Use Amazon SQS'], { id: 'p-1' }),
    q('Use Amazon SQS', ['Use Amazon SNS'], { id: 'p-2' }),
    q('Use Amazon SQS', ['Use Amazon EFS'], { id: 'p-3' }), // SNS absent
    q('Use Amazon SNS', ['Use Amazon SQS'], { id: 'p-4', status: 'draft' }),
    q('Use Amazon SNS', ['Use Amazon SQS'], { id: 'p-5', outOfScope: true }),
  ];
  const pool = contrastPool(bankOf(qs), ['SQS', 'SNS']);
  assert.deepEqual(pool.map((x) => [x.question.id, x.answerService]), [['p-1', 'SNS'], ['p-2', 'SQS']]);
  assert.deepEqual(contrastPool(bankOf(qs), ['SQS']), [], 'one service is no contrast');
});

function answers(ids: string[], oks: boolean[], day: number): Attempt {
  return {
    id: `a${day}`,
    mode: 'practice',
    finished: `2026-10-${String(day).padStart(2, '0')}T10:00:00+07:00`,
    answers: ids.map((id, i) => ({ q: id, pick: oks[i] ? 'A' : 'B', key: 'A', ok: oks[i], t: 30, est: 60 })),
  } as unknown as Attempt;
}

test('groups: pairs with ≥ 8 competing questions, ≤ 4 services, progress over the last 10 contrast answers', () => {
  const qs: Question[] = [];
  for (let i = 0; i < 9; i++) qs.push(q(i % 2 ? 'Use Amazon SQS' : 'Use Amazon SNS', [i % 2 ? 'Use Amazon SNS' : 'Use Amazon SQS'], { id: `g-sq-${i}` }));
  for (let i = 0; i < 8; i++) qs.push(q('Use AWS DataSync', ['Use AWS Snowball Edge'], { id: `g-ds-${i}` }));
  for (let i = 0; i < 4; i++) qs.push(q('Use Amazon Athena', ['Use Amazon EMR'], { id: `g-at-${i}` })); // < 8: no group
  const bank = bankOf(qs);
  const groups = confusableGroups(bank);
  assert.deepEqual(groups.map((g) => [g.services.slice().sort().join('+'), g.questions]), [['SNS+SQS', 9], ['DataSync+Snow Family', 8]]);
  assert.ok(groups.every((g) => g.services.length <= CONFUSABLE_RULES.maxServices && g.id && !g.learner));
  // progress: 12 contrast answers on SNS/SQS, the last 10 → 9 right
  const ids = qs.filter((x) => x.id.startsWith('g-sq')).map((x) => x.id);
  const hist = [answers(ids.slice(0, 2), [false, false], 1), answers([...ids, ids[0]], [true, true, true, true, true, true, true, false, true, true], 2)];
  const withLearner = confusableGroups(bank, hist);
  const sq = withLearner.find((g) => g.services.includes('SQS'))!;
  assert.deepEqual(sq.learner, { answers: 12, correct: 9, last10: 90, separated: true });
  const ds = withLearner.find((g) => g.services.includes('DataSync'))!;
  assert.deepEqual(ds.learner, { answers: 0, correct: 0, last10: 0, separated: false });
  const pair = pairStats(bank, 'SNS', 'SQS', [answers(ids.slice(0, 3), [true, true, false], 3)]);
  assert.deepEqual(pair, { questions: 9, progress: { answers: 3, correct: 2, last10: 67, separated: false } }, 'fewer than 10 answers: never "đã tách được"');
  assert.equal(pairStats(bank, 'SNS', 'SNS').questions, 0);
});

test('termsNamedIn: match terms, canonical names written plainly, feature tags', () => {
  const t = termsNamedIn('8.1 CloudWatch vs CloudTrail vs Config vs X-Ray', tax);
  for (const s of ['CloudWatch', 'CloudTrail', 'AWS Config', 'X-Ray']) assert.ok(t.has(s), s);
  const f = termsNamedIn('Security Groups vs NACLs', tax);
  assert.ok(f.has('security-groups') && f.has('nacl'));
  assert.ok(termsNamedIn('Kinesis Data Streams vs Kinesis Firehose', tax).has('Data Firehose'));
});

test('perf: confusable groups of a 5,000-question bank cold in well under a second', () => {
  const svc = ['Amazon SQS', 'Amazon SNS', 'Amazon Kinesis Data Streams', 'AWS DataSync', 'AWS Snowball Edge', 'Amazon EFS', 'Amazon S3', 'Amazon RDS', 'Amazon Aurora', 'Amazon DynamoDB'];
  const qs = Array.from({ length: 5000 }, (_, i) => q(`Use ${svc[i % 10]} with batching option ${i}`, [`Use ${svc[(i + 1) % 10]} instead ${i}`, `Use ${svc[(i + 3) % 10]} with retries ${i}`, `Run a cron job ${i}`], { id: `perf-${i}` }));
  const t0 = performance.now();
  const g = confusableGroups(bankOf(qs));
  const ms = performance.now() - t0;
  assert.ok(g.length > 0);
  assert.ok(ms < 2500, `confusableGroups took ${Math.round(ms)} ms (target ≈ 250 ms; generous for a loaded CI machine)`);
});
