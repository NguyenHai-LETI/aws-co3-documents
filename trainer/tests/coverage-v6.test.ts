// [v6] Coverage report additions: tier A/B/C vs the 280 tier-A target (domain weight → task bullets), the multiple-response
// share within tier A, and the `scope: legacy` services section; plus the v6 taxonomy currency entries on sample wording.
// Run: npm test — works on in-memory banks; the real taxonomy / exam guide are only read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTaxonomy } from '../server/lib/taxonomy.ts';
import { parsePack } from '../server/lib/pack-format.ts';
import { apportion, computeCoverage, coverageMarkdown, guideBulletsByTask, legacyCoverage, tierCoverage, TIER_TARGET } from '../server/lib/coverage.ts';
import type { BankState } from '../server/lib/bank.ts';
import type { Question, Taxonomy } from '../shared/types.ts';

const tax = loadTaxonomy();

function bankOf(blocks: string[], t: Taxonomy = tax): BankState {
  const text = `---\npack: t-pack\ntitle: T\norigin: manual\n---\n\n# T\n\n${blocks.join('\n---\n\n')}`;
  const { questions } = parsePack(text, 'bank/packs/manual/t.md', t);
  return { version: 't', taxonomy: t, packs: [], questions, byId: new Map(questions.map((q) => [q.id, q])), problems: [] };
}

const LONG_STEM =
  'A retail company runs its order service on Amazon EC2 instances behind an Application Load Balancer in two Availability Zones. ' +
  'Traffic doubles every Friday evening and the operations team must keep the checkout page responsive while the database stays ' +
  'within its connection limits during the peak. The company wants to avoid rewriting the application and prefers managed services ' +
  'that need little day-to-day administration. Which solution will meet these requirements?';
const LONG_OPTS = [
  'Put Amazon RDS Proxy in front of the database and point the application to the proxy endpoint',
  'Increase the instance size of the database every Friday with a scheduled maintenance window',
  'Move the checkout page to Amazon S3 static website hosting with a CloudFront distribution',
  'Add read replicas in a second Region and route all writes through Route 53 failover records',
  'Enable Multi-AZ on the database so the standby instance can serve the extra connections',
];

/** A question block; `long` = exam-grade stem + sentence options (tier A), else a one-line drill (tier C). */
function block(id: string, opts: { domain?: string; task?: string; long?: boolean; multi?: boolean; options?: string[]; answer?: string; status?: string; stem?: string }) {
  const options = opts.options ?? (opts.long ? LONG_OPTS.slice(0, opts.multi ? 5 : 4) : ['RDS Proxy', 'Bigger instance', 'S3 website', 'Read replica']);
  return [
    `## Q ${id}`,
    `- domain: ${opts.domain ?? 'performance'}`,
    ...(opts.task === '' ? [] : [`- task: ${opts.task ?? '3.3'}`]),
    '- topic: database',
    '- difficulty: medium',
    '- time: 90',
    ...(opts.status ? [`- status: ${opts.status}`] : []),
    '',
    opts.stem ?? (opts.long ? LONG_STEM + (opts.multi ? ' (Select TWO.)' : '') : 'Which service pools database connections?'),
    '',
    ...options.map((o, i) => `- ${'ABCDE'[i]}. ${o}`),
    '',
    `**Answer:** ${opts.answer ?? (opts.multi ? 'A, B' : 'A')}`,
    '',
    '**Explanation:** The first option fits the requirement; the others miss the connection limit or add needless operational work.',
    '',
  ].join('\n');
}

test('apportion: largest remainder, sums to the total, ties go to the earlier item', () => {
  assert.deepEqual(apportion(280, [30, 26, 24, 20]), [84, 73, 67, 56]);
  assert.deepEqual(apportion(84, [11, 10, 11]), [29, 26, 29]);
  assert.deepEqual(apportion(73, [23, 20]), [39, 34]);
  assert.deepEqual(apportion(67, [5, 10, 13, 8, 14]), [7, 13, 17, 11, 19]);
  assert.deepEqual(apportion(56, [21, 15, 14, 14]), [19, 13, 12, 12]);
  assert.deepEqual(apportion(3, [1, 1, 1, 1]), [1, 1, 1, 0]);
  assert.deepEqual(apportion(10, [0, 0]), [0, 0]);
  assert.deepEqual(apportion(0, [1, 2]), [0, 0]);
});

test('tier targets: 280 split 84/73/67/56 by domain weight, then by the exam-guide bullets of each task', () => {
  const t = tierCoverage([], tax);
  assert.equal(t.target, TIER_TARGET.poolA);
  assert.deepEqual(t.domains.map((d) => [d.code, d.target]), [['D1', 84], ['D2', 73], ['D3', 67], ['D4', 56]]);
  const bullets = guideBulletsByTask();
  assert.equal([...bullets.values()].reduce((s, n) => s + n, 0), 189, 'official guide: 189 bullets');
  for (const d of t.domains) {
    const own = t.tasks.filter((x) => x.domain === d.id);
    assert.equal(own.reduce((s, x) => s + x.target, 0), d.target, `${d.code}: task targets add up`);
    assert.equal(own.reduce((s, x) => s + x.bullets, 0), d.bullets);
  }
  const task = Object.fromEntries(t.tasks.map((x) => [x.id, x.target]));
  assert.deepEqual([task['1.1'], task['2.2'], task['3.1'], task['4.1']], [29, 34, 7, 19]);
  // no guide → equal split within the domain
  const flat = tierCoverage([], tax, 280, new Map());
  assert.deepEqual(flat.tasks.filter((x) => x.domain === 'resilient').map((x) => x.target), [37, 36]);
});

test('tier counts: q.tier wins, the rule fills in; MR share within tier A; retired / out-of-scope not counted', () => {
  const bank = bankOf([
    block('a1', { long: true }),
    block('a2', { long: true, multi: true }),
    block('a3', { long: true, domain: 'secure', task: '1.2' }),
    block('a4', { long: true, task: '' }),
    block('c1', {}),
    block('r1', { long: true, status: 'retired' }),
  ]);
  const q = (id: string) => bank.byId.get(id)!;
  q('a2').answer = ['A', 'B'];
  const oos: Question = { ...q('a1'), id: 'o1', outOfScope: true };
  const forced: Question = { ...q('c1'), id: 'f1', tier: 'B' }; // stored tier wins over the rule
  const t = tierCoverage([...bank.questions, oos, forced], tax, 8, new Map([['3.3', 1]]));
  assert.equal(t.pool, 6);
  assert.deepEqual(t.counts, { A: 4, B: 1, C: 1 });
  assert.equal(t.need, 4);
  assert.deepEqual(t.multiA, { count: 1, share: 0.25, target: [0.25, 0.3] });
  const perf = t.domains.find((d) => d.id === 'performance')!;
  assert.equal(perf.A, 3);
  assert.equal(perf.multiA, 1);
  assert.equal(t.tasks.find((x) => x.id === '3.3')!.A, 2);
  assert.equal(t.tasks.find((x) => x.id === '1.2')!.A, 1);
  assert.equal(t.noTaskA, 1, 'a4 has no task: counted in its domain only');
});

test('legacy section: key / distractor-only / anywhere per scope: legacy service; sealed ids never listed', () => {
  const t: Taxonomy = { ...tax, services: { ...tax.services, Kendra: { topic: 'ml', match: ['Kendra'], scope: 'legacy' }, QLDB: { topic: 'database', match: ['QLDB'], scope: 'legacy' } } };
  const bank = bankOf(
    [
      block('k1', { options: ['Amazon Kendra', 'Amazon Comprehend', 'Amazon Athena', 'Amazon Lex'] }),
      block('k2', { options: ['Amazon Comprehend', 'Amazon Kendra', 'Amazon Athena', 'Amazon Lex'] }),
      block('k3', { options: ['Amazon Kendra', 'Amazon QLDB', 'Amazon Athena', 'Amazon Lex'] }),
      block('n1', { stem: 'Teams used Amazon QLDB before. Which service pools database connections?' }),
      block('x1', {}),
      block('r1', { options: ['Amazon Kendra', 'B', 'C', 'D'], status: 'retired' }),
    ],
    t,
  );
  const l = legacyCoverage(bank.questions, t, new Set(['k3']));
  assert.equal(l.key, 2);
  assert.equal(l.distractor, 1);
  assert.equal(l.anywhere, 4);
  assert.equal(l.sealedHidden, 1);
  const kendra = l.services.find((s) => s.name === 'Kendra')!;
  assert.deepEqual([kendra.key, kendra.distractor, kendra.anywhere, kendra.ids], [2, 1, 3, ['k1']]);
  const qldb = l.services.find((s) => s.name === 'QLDB')!;
  assert.deepEqual([qldb.key, qldb.distractor, qldb.anywhere], [0, 1, 2]);
  const md = coverageMarkdown(computeCoverage(bank, '2026-10-22', { sealed: new Set(['k3']), guide: false }));
  assert.match(md, /## 6\. Tầng câu \(A \/ B \/ C\) so với mục tiêu/);
  assert.match(md, /## 7\. Dịch vụ bị gỡ khỏi phạm vi đề \(legacy\)/);
  assert.match(md, /\| Kendra \| 2 \| 1 \| 3 \| `k1` … \|/);
  assert.doesNotMatch(md, /`k3`/, 'a sealed id never appears');
  assert.match(md, /1 câu đang niêm phong không được liệt kê/);
  assert.equal(legacyCoverage(bank.questions, { ...t, services: {} }).services.length, 0, 'no legacy service → empty section');
});

test('the real taxonomy: the 12 v6 legacy services, renamed aliases and the in-scope services added', () => {
  const legacy = Object.entries(tax.services).filter(([, d]) => d.scope === 'legacy').map(([n]) => n).sort();
  assert.deepEqual(legacy, ['AppSync', 'Application Discovery Service', 'Audit Manager', 'Data Pipeline', 'Elastic Transcoder', 'Forecast', 'Fraud Detector', 'Kendra', 'Migration Hub', 'Pinpoint', 'Proton', 'QLDB']);
  assert.ok(tax.services['Application Migration Service'].aliases?.includes('AWS Transform MGN'));
  assert.ok(tax.services['Security Hub'].aliases?.includes('AWS Security Hub CSPM'));
  for (const n of ['Data Exchange', 'Device Farm', 'ECS Anywhere', 'EKS Anywhere', 'EKS Distro', 'VMware Cloud on AWS', 'Managed Grafana', 'Well-Architected Tool', 'AWS CLI'])
    assert.ok(tax.services[n] && !tax.services[n].scope, n);
});

/** Stale / current wording per v6 currency entry (stem + options + explanation, like lint `stale-fact`). */
const SAMPLES: [id: string, stale: string, current: string][] = [
  ['s3-sse-s3-by-default', 'S3 objects are not encrypted by default, so enable default encryption on the bucket.', 'Enable default encryption with SSE-KMS on the bucket.'],
  ['s3-object-max-50tb', 'The maximum object size in S3 is 5 TB.', 'A single PUT uploads up to 5 GB; use multipart upload.'],
  ['cloudfront-oai-legacy', 'Use an Origin Access Identity to restrict the bucket.', 'Use Origin Access Control (OAC), which replaces the legacy OAI.'],
  ['public-ipv4-charge', 'Elastic IP addresses are free while attached to a running instance.', 'Elastic IP addresses incur an hourly charge.'],
  ['nlb-security-groups', 'Network Load Balancers do not support security groups.', 'The NLB security group allows traffic from the clients.'],
  ['alb-mutual-tls', 'ALB does not support mutual TLS, so mTLS requires an NLB with TCP passthrough.', 'Use an ALB with mTLS in verify mode and a trust store.'],
  ['ebs-gp3-64tib-80k-iops', 'gp3 volumes max out at 16,000 IOPS; more than 16,000 IOPS needs io2.', 'gp2 volumes max out at 16,000 IOPS.'],
  ['privatelink-cross-region', 'PrivateLink only works within the same Region.', 'Gateway endpoints only work within the same Region.'],
  ['rds-15-read-replicas', 'RDS supports up to 5 read replicas.', 'RDS supports up to 5 cross-Region read replicas.'],
  ['aurora-global-database-10-regions', 'Aurora Global Database supports up to 5 secondary Regions.', 'Aurora Global Database supports up to 10 secondary Regions.'],
  ['kms-rotation-period', 'AWS managed keys rotate every three years.', 'AWS managed keys rotate every year.'],
  ['database-savings-plans', 'Savings Plans do not apply to RDS; only Reserved Instances discount RDS.', 'Compute Savings Plans do not apply to RDS.'],
  ['lambda-tmp-10gb', 'Lambda /tmp storage is limited to 512 MB.', 'Lambda /tmp defaults to 512 MB.'],
  ['snowball-edge-closed', '80 TB, limited bandwidth, deadline = Snowball Edge.', 'Use a Snowball Edge device to ship the data offline instead of the network.'],
  ['iam-identity-center-rename', 'Use AWS SSO for workforce access.', 'Use IAM Identity Center (formerly AWS SSO).'],
  ['timestream-liveanalytics-closed', 'Time-series IoT metrics = Amazon Timestream.', 'Time-series IoT metrics = Amazon Timestream for InfluxDB.'],
  ['aurora-serverless-v2-scale-to-zero', 'Aurora Serverless v2 cannot scale to zero; the minimum is 0.5 ACU.', 'Aurora Serverless v2 scales in 0.5 ACU increments.'],
];

test('v6 currency entries: each flags its stale sample and leaves the current wording alone', () => {
  const byId = new Map((tax.currency ?? []).map((c) => [c.id, c]));
  assert.ok(byId.size >= 60);
  for (const [id, stale, current] of SAMPLES) {
    const c = byId.get(id);
    assert.ok(c, id);
    const hit = (s: string) => new RegExp(c.pattern, 'i').test(s) && !(c.unless && new RegExp(c.unless, 'i').test(s));
    assert.ok(hit(stale), `${id} flags: ${stale}`);
    assert.ok(!hit(current), `${id} leaves alone: ${current}`);
  }
});
