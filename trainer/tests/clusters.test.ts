// [v5 γ1] Unit tests for the sibling clusters (server/lib/clusters.ts) and the similarity join (server/lib/similarity.ts):
// the prefix-filtered join equals brute force; each link rule; the anti-chaining guards (boilerplate across topics, hub
// guard, size cap); retired questions; memo + Question.cluster; lexicalPairs = the v3 duplicate rule. Pure functions only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLUSTER_RULES, buildClusters, clusterIndex, clusteredIds, siblingsOf } from '../server/lib/clusters.ts';
import { JOIN_CAPS, jaccard, lexicalPairs, similarJoin, similarPairs } from '../server/lib/similarity.ts';
import type { Question } from '../shared/types.ts';

type Q = Pick<Question, 'id' | 'stem' | 'options' | 'answer' | 'variantOf' | 'status'> & { topic?: string; cluster?: string };
const q = (id: string, stem: string, key: string, extra: Partial<Q> = {}): Q => ({
  id,
  stem,
  options: [
    { key: 'A', text: key },
    { key: 'B', text: `other ${id}` },
  ],
  answer: ['A'],
  variantOf: [],
  status: 'active',
  topic: 'storage',
  ...extra,
});

// a deterministic pseudo-random generator (no flaky tests)
function rng(seed: number) {
  let x = seed;
  return () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
}

test('similarPairs: exactly the brute-force pairs for random sets at several thresholds', () => {
  const r = rng(7);
  const sets = Array.from({ length: 160 }, () => [...new Set(Array.from({ length: 2 + Math.floor(r() * 14) }, () => Math.floor(r() * 40)))]);
  for (const t of [0.25, 0.5, 0.6, 0.8, 1]) {
    const want = new Set<string>();
    for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) if (jaccard([...sets[i]].sort((a, b) => a - b), [...sets[j]].sort((a, b) => a - b)) >= t) want.add(`${i}|${j}`);
    const got = new Set(similarPairs(sets, t).map(([i, j]) => `${i}|${j}`));
    assert.deepEqual([...got].sort(), [...want].sort(), `threshold ${t}`);
  }
  assert.throws(() => similarPairs(sets, 0));
  assert.deepEqual(similarPairs([[], [1]], 0.5), []);
});

test('lexicalPairs: significant words ≥ 0.8 or trigrams ≥ 0.6 of stem + key, best first', () => {
  const qs = [
    q('d-1', 'A company stores invoices in a bucket and must keep every version of every object for audits', 'Enable S3 Versioning'),
    q('d-2', 'A company stores invoices in a bucket and must keep every version of every object for audits.', 'Enable S3 Versioning'),
    q('d-3', 'Lambda functions exhaust database connections during spikes', 'RDS Proxy'),
  ];
  const pairs = lexicalPairs(qs);
  assert.deepEqual(pairs.map((p) => [p.a, p.b]), [['d-1', 'd-2']]);
  assert.equal(pairs[0].score, 1);
});

test('links: variant_of either way, similar stems with the same topic or key, same topic + key at ≥ 0.25, extra pairs', () => {
  const qs = [
    q('a', 'alpha bravo charlie delta echo foxtrot golf hotel', 'Amazon S3'),
    q('b', 'alpha bravo charlie delta echo foxtrot india juliet', 'Amazon EFS'), // 0.6, same topic → similar
    q('c', 'kilo lima mike november alpha bravo oscar papa', 'Amazon SQS'),
    q('d', 'kilo lima mike quebec romeo sierra tango uniform', 'Amazon SQS'), // 0.23 → nothing
    q('e', 'victor whiskey xray yankee zulu alpha bravo charlie', 'Amazon SNS'),
    q('f', 'victor whiskey xray yankee one two three four', 'Amazon SNS'), // 0.33 + same key + topic → same-key
    q('g', 'gamma delta', 'Lambda', { variantOf: ['h'] }),
    q('h', 'epsilon zeta', 'Fargate'),
    q('i', 'theta iota', 'ECS', { variantOf: ['j'] }),
    q('j', 'kappa lambda', 'EKS', { status: 'retired' }), // retired: nobody's sibling
    q('k', 'mu nu', 'ECR'),
    q('l', 'xi omicron', 'RDS'),
  ];
  const idx = buildClusters(qs, [{ a: 'k', b: 'l' }, { a: 'k', b: 'nope' }], 'v1');
  assert.deepEqual([...clusteredIds(idx)].sort(), ['a', 'b', 'e', 'f', 'g', 'h', 'k', 'l']);
  assert.deepEqual(siblingsOf(idx, 'b'), ['a']);
  assert.deepEqual(siblingsOf(idx, 'c'), []);
  assert.deepEqual(siblingsOf(idx, 'nope'), []);
  assert.equal(idx.of.get('b'), 'a', 'cluster id = smallest member id');
  assert.equal(idx.of.get('j'), 'j', 'a retired question is its own cluster');
  const kinds = (x: string, y: string) => idx.links.get(x)?.find((l) => l.id === y)?.kinds;
  assert.deepEqual(kinds('a', 'b'), ['similar']);
  assert.deepEqual(kinds('e', 'f'), ['same-key']);
  assert.deepEqual(kinds('g', 'h'), ['variant']);
  assert.deepEqual(kinds('k', 'l'), ['semantic']);
});

test('anti-chaining: boilerplate across topics is no sibling, the same key across topics is', () => {
  const stem = (x: string) => `Which two statements about ${x} are TRUE? (Choose TWO)`;
  const qs = [
    q('t-1', stem('NAT Gateway'), 'It scales automatically', { topic: 'networking' }),
    q('t-2', stem('AWS WAF'), 'It can rate-limit requests', { topic: 'security' }),
    q('t-3', stem('API Gateway'), 'It can throttle requests', { topic: 'api' }),
    q('k-1', 'A company wants centralized policy based backups across EBS RDS DynamoDB EFS', 'AWS Backup', { topic: 'other' }),
    q('k-2', 'A company wants centralized policy based backups across EBS RDS DynamoDB and FSx', 'AWS Backup', { topic: 'resilience' }),
  ];
  const idx = buildClusters(qs);
  assert.deepEqual(siblingsOf(idx, 't-1'), [], 'unrelated "Which two … TRUE" questions');
  assert.deepEqual(siblingsOf(idx, 'k-1'), ['k-2'], 'same key → siblings even when the topics differ');
});

test('anti-chaining: a templated stem (hub) links nothing textually; clusters never grow past maxSize; variant_of still counts', () => {
  const tpl = Array.from({ length: 30 }, (_, i) => q(`s-${String(i).padStart(2, '0')}`, `Scenario for secure workloads a company needs a storage design which option meets the requirement`, `Use option ${i}`));
  tpl[3].variantOf = ['s-04'];
  const idx = buildClusters(tpl);
  assert.deepEqual(siblingsOf(idx, 's-00'), []);
  assert.deepEqual(siblingsOf(idx, 's-03'), ['s-04'], 'variant_of survives the hub guard');
  // a chain of 9 rephrasings, each linked to the next only: capped at maxSize
  const words = Array.from({ length: 40 }, (_, i) => `w${i}x`);
  const chain = Array.from({ length: 9 }, (_, i) => q(`c-${i}`, words.slice(i * 2, i * 2 + 8).join(' '), 'Same key'));
  const ci = buildClusters(chain);
  const biggest = Math.max(...[...ci.members.values()].map((m) => m.length));
  assert.ok(biggest <= CLUSTER_RULES.maxSize, `largest cluster ${biggest}`);
  assert.ok(biggest > 1);
});

test('clusterIndex: memo per bank object + version, fills Question.cluster only for clusters of ≥ 2', () => {
  const bank = { version: 'v-test', questions: [q('m-1', 'alpha bravo charlie delta echo', 'X'), q('m-2', 'alpha bravo charlie delta foxtrot', 'Y'), q('m-3', 'zulu yankee', 'Z')] as Question[] };
  const a = clusterIndex(bank);
  assert.equal(clusterIndex(bank), a, 'same bank object + version → memo');
  assert.equal(bank.questions[0].cluster, 'm-1');
  assert.equal(bank.questions[1].cluster, 'm-1');
  assert.equal(bank.questions[2].cluster, undefined);
  const other = { ...bank, version: 'v-test-2', questions: bank.questions.map((x) => ({ ...x })) };
  assert.notEqual(clusterIndex(other), a);
});

test('similarJoin caps: a set over maxPartners / maxCandidates is a hub — no pair, never indexed; others stay exact', () => {
  const sets = [...Array.from({ length: 20 }, () => [1, 2, 3, 4]), [7, 8, 9], [7, 8, 10]];
  const capped = similarJoin(sets, 0.5, { maxPartners: 5 });
  assert.ok(capped.hubs.size >= 14, `${capped.hubs.size} hubs`);
  assert.ok(capped.pairs.every(([i, j]) => !capped.hubs.has(i) && !capped.hubs.has(j)));
  assert.ok(capped.pairs.some(([i, j]) => i === 20 && j === 21), 'the non-templated pair is still found');
  assert.equal(similarJoin(sets, 0.5, { maxCandidates: 3 }).hubs.size > 0, true);
});

test('perf: a templated 5,000-question bank clusters near-linearly (the 2026 review measured 4.6 s before the caps)', () => {
  const qs = Array.from({ length: 5000 }, (_, i) =>
    q(`p-${i}`, `Scenario ${i} company workload ${i % 97} region ${i % 13} needs option ${i % 31} choice?`, `Answer ${i % 7}`, { topic: ['storage', 'compute', 'database'][i % 3] }),
  );
  const t0 = performance.now();
  const idx = buildClusters(qs);
  const ms = performance.now() - t0;
  assert.ok(ms < 1500, `buildClusters took ${Math.round(ms)} ms (target ≈ 150 ms; generous for a loaded CI machine)`);
  assert.equal(Math.max(...[...idx.members.values()].map((m) => m.length)), 1, 'templated stems are no siblings');
  assert.ok(JOIN_CAPS.maxPartners >= 100);
});
