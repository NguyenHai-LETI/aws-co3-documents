// Unit tests for the full-text search: Vietnamese folding (diacritics + đ), safe FTS5 query building, snippets in the
// original spelling, note sections whose anchors equal the Notes page heading ids, FTS5 and fallback scan agreeing,
// incremental refresh (notes by mtime, questions by bank version) and a corrupt index rebuilt. Run: npm test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const TRAINER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-search-')));
const HOME = path.join(ROOT, 'home');
const REPO = path.join(ROOT, 'repo');
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
fs.mkdirSync(path.join(HOME, 'bank', 'packs', 'manual'), { recursive: true });
fs.mkdirSync(REPO, { recursive: true });
fs.copyFileSync(path.join(TRAINER, 'bank', 'taxonomy.yaml'), path.join(HOME, 'bank', 'taxonomy.yaml'));
fs.writeFileSync(path.join(HOME, 'config.yaml'), 'cache:\n  sqlite: true\n');
process.env.TRAINER_HOME = HOME; // before config.ts is imported (dynamic imports below)
process.env.TRAINER_REPO = REPO;

const { DATA_DIR } = await import('../server/config.ts');
const it = DATA_DIR === HOME ? test : test.skip;

const { serializePack } = await import('../server/lib/pack-format.ts');
const { stringifyFrontMatter } = await import('../server/lib/frontmatter.ts');
const { headingSlug, splitSections, plainText } = await import('../server/lib/notes.ts');
const S = await import('../server/lib/search.ts');
const { closeIndexDb, ftsAvailable, INDEX_DB_FILE } = await import('../server/lib/index-db.ts');

// ── fixture: 8 questions + 2 notes ──────────────────────────────────────────
const Q = (id: string, stem: string, options: string[], answer: string, extra: Record<string, unknown> = {}) => ({
  id,
  stem,
  options: options.map((text, i) => ({ key: 'ABCD'[i], text })),
  answer: [answer],
  explanation: 'Explanation for the scenario.',
  domain: 'performance',
  topic: 'database',
  difficulty: 'medium' as const,
  time: 60,
  ...extra,
});
const drafts = [
  Q('db-01', 'An application must react to every item change in a DynamoDB table within seconds. What should be used?', ['DynamoDB Streams with AWS Lambda', 'Amazon SQS FIFO', 'Scheduled full table scans', 'AWS Glue crawlers'], 'A'),
  Q('db-02', 'A relational database needs automatic failover to a standby in another Availability Zone.', ['RDS Multi-AZ deployment', 'RDS read replica in the same AZ', 'Manual snapshots', 'ElastiCache'], 'A'),
  Q('db-03', 'Which storage class gives the lowest cost for archives restored within 12 hours?', ['S3 Glacier Deep Archive', 'S3 Standard', 'S3 Intelligent-Tiering', 'EBS gp3'], 'A', { explanation: 'Deep Archive: độ bền 11 số 9, chi phí thấp nhất.' }),
  Q('db-04', 'Stream processing of click events with replay for 7 days.', ['Kinesis Data Streams', 'Kinesis Data Firehose only', 'SNS', 'SES'], 'A'),
  Q('db-05', 'An analyst wants an and/or filter on reports.', ['Athena', 'Redshift', 'QuickSight', 'EMR'], 'C'),
  Q('db-06', 'Cache hot reads for a DynamoDB table with microsecond latency.', ['DynamoDB Accelerator (DAX)', 'CloudFront', 'Global tables', 'S3 Transfer Acceleration'], 'A', { status: 'retired' }),
  Q('db-07', 'Đáp án nào giúp cân bằng tải cho ứng dụng web?', ['Application Load Balancer', 'Route 53 simple routing', 'NAT gateway', 'Internet gateway'], 'A'),
  Q('db-08', 'Which service decouples producers and consumers with a queue?', ['Amazon SQS', 'Amazon EFS', 'Amazon EBS', 'AWS Batch'], 'A'),
];
const PACK = path.join(HOME, 'bank', 'packs', 'manual', 'search-test.md');
const writePack = (qs: typeof drafts) => fs.writeFileSync(PACK, serializePack({ pack: 'search-test', title: 'Search test', origin: 'manual' }, '', qs, (x) => stringifyFrontMatter(x)));
writePack(drafts);

const NOTE = [
  '---',
  'title: front matter # not a heading',
  '---',
  'Giới thiệu về **lưu trữ** trên AWS.',
  '',
  '# Lưu trữ S3',
  '',
  '## Độ bền (Durability) — `11 9s`',
  'S3 có độ bền 99.999999999% nhờ lưu nhiều bản sao trong nhiều AZ.',
  '',
  '```bash',
  '# not a heading inside code',
  'aws s3 cp file s3://bucket/',
  '```',
  '',
  '##### Ghi chú nhỏ',
  'Mức h5 vẫn thuộc mục "Độ bền".',
  '',
  '## S3 & Glacier',
  'Glacier Deep Archive: truy xuất trong 12 giờ, chi phí thấp nhất.',
  '',
  '### 2. **DynamoDB Streams**',
  'Change data capture, giữ 24 giờ, kích hoạt Lambda.',
  '',
  '## Đáp Án',
  'Đáp án chi tiết ở cuối file.',
].join('\n');
fs.writeFileSync(path.join(REPO, '02-storage.md'), NOTE);
fs.writeFileSync(path.join(REPO, '04-networking.md'), '# Mạng\n\n## Cân bằng tải (ELB)\nApplication Load Balancer định tuyến theo path và host.\n');

/** The Notes page heading ids: web/lib/markdown.tsx renders with marked and slugs the inner HTML. */
function webSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}
function webAnchors(md: string): string[] {
  const html = marked.parse(md, { async: false }) as string;
  return [...html.matchAll(/<h([1-4])>(.*?)<\/h\1>/g)].map((m) => webSlug(m[2]));
}

const ids = (r: { hits: { kind: string; id: string; anchor?: string }[] }, kind: string) => r.hits.filter((h) => h.kind === kind).map((h) => (kind === 'note' ? `${h.id}#${h.anchor ?? ''}` : h.id));

// ── query building ──────────────────────────────────────────────────────────

test('query tokens: diacritics and đ folded, duplicates dropped, at most 8; short words match whole words except the last', () => {
  assert.deepEqual(S.queryTokens('Đáp ÁN  dịch-vụ S3 s3'), [
    { t: 'dap', prefix: true },
    { t: 'an', prefix: false },
    { t: 'dich', prefix: true },
    { t: 'vu', prefix: false },
    { t: 's3', prefix: true },
  ]);
  assert.equal(S.queryTokens('a b c d e f g h i j k').length, 8);
  assert.deepEqual(S.queryTokens('  !!! '), []);
  assert.equal(S.foldKey('Độ BỀN Đường'), 'do ben duong');
  assert.equal(S.foldD('Đáp đúng'), 'Dáp dúng');
});

test('FTS5 expressions quote every token — operators and quotes typed by the user stay plain words', () => {
  const t = S.queryTokens('" OR 1=1 NEAR(x y) col:val * AND -z');
  assert.ok(t.every((x) => /^[\p{L}\p{N}]+$/u.test(x.t)));
  const and = S.ftsMatch(t, 'and');
  assert.match(and, /^("[\p{L}\p{N}]+"\*? ?)+$/u, and);
  assert.equal(S.ftsMatch(S.queryTokens('dynamodb str'), 'phrase'), '"dynamodb str"*');
  assert.equal(S.ftsMatch(S.queryTokens('cân bằng tải'), 'and'), '"can"* "bang"* "tai"*');
  assert.equal(S.ftsMatch(S.queryTokens('an dap s3 x'), 'or'), '"dap"*', 'OR keeps words of ≥ 3 letters');
});

test('snippets keep the original spelling, mark matches with «» and cut long texts around the best cluster', () => {
  const tk = S.queryTokens('do ben');
  assert.equal(S.makeSnippet('S3 có độ bền 99.999999999%', tk), 'S3 có «độ» «bền» 99.999999999%');
  const long = `${'mở đầu '.repeat(30)}Glacier Deep Archive rẻ nhất ${'kết thúc '.repeat(30)}`;
  const s = S.makeSnippet(long, S.queryTokens('glacier deep'), 12);
  assert.ok(s.startsWith('…') && s.endsWith('…'), s);
  assert.ok(s.includes('«Glacier» «Deep» Archive'), s);
  assert.equal(S.makeSnippet('Nothing matches here', S.queryTokens('zzz')), 'Nothing matches here');
  assert.ok(!S.makeSnippet('the analysts and an engineer', S.queryTokens('an dap')).includes('«and»'), '"an" (not last) does not light up "and"');
});

// ── note sections ───────────────────────────────────────────────────────────

test('note sections: anchors equal the Notes page heading ids; front matter and code blocks are not headings; h5 stays inside', () => {
  const secs = splitSections(NOTE);
  assert.deepEqual(
    secs.map((s) => s.anchor),
    ['', ...webAnchors(NOTE.replace(/^---\n[\s\S]*?\n---\n/, ''))],
    'same ids as web/lib/markdown.tsx',
  );
  assert.deepEqual(
    secs.map((s) => s.heading),
    ['', 'Lưu trữ S3', 'Độ bền (Durability) — 11 9s', 'S3 & Glacier', '2. DynamoDB Streams', 'Đáp Án'],
  );
  assert.equal(secs[0].text, 'Giới thiệu về lưu trữ trên AWS.');
  const durability = secs.find((s) => s.heading.startsWith('Độ bền'))!;
  assert.ok(durability.text.includes('aws s3 cp'), 'code is searchable text');
  assert.ok(durability.text.includes('Ghi chú nhỏ') && durability.text.includes('Mức h5'), 'h5 belongs to its section');
  for (const h of ['S3 & Glacier', 'Độ bền (Durability) — `11 9s`', '🎯 Storage **Class** [link](x.md)', 'Đáp Án']) assert.equal(headingSlug(h), webAnchors(`## ${h}`)[0], h);
  assert.equal(plainText('**bold** `code` [label](u.md) ![img](i.png) | a | b |'), 'bold code label img a b');
});

// ── search ──────────────────────────────────────────────────────────────────

it('the index is built with FTS5 (Node’s SQLite) in .cache/trainer.db', () => {
  assert.equal(ftsAvailable(), true);
  assert.equal(S.warmSearchIndex(), true);
  assert.ok(fs.existsSync(INDEX_DB_FILE) && INDEX_DB_FILE.startsWith(path.join(HOME, '.cache')));
});

it('FTS5 and the fallback scan find the same things (Vietnamese without diacritics, đ, prefixes, ids, scope, limit)', () => {
  const both = (q: string, opts: Parameters<typeof S.search>[1] = {}) => {
    const a = S.search(q, opts);
    const b = S.search(q, { ...opts, fts: false });
    assert.equal(a.engine, 'fts5');
    assert.equal(b.engine, 'fallback');
    return [a, b] as const;
  };
  for (const [fts, scan] of [both('do ben'), both('độ bền')]) {
    for (const r of [fts, scan]) {
      assert.equal(ids(r, 'note')[0], '02-storage.md#do-ben-durability-11-9s', `${r.engine}: "${r.q}" → the Độ bền section first`);
      assert.ok(r.hits.find((h) => h.kind === 'note')!.snippet.includes('«độ» «bền»'));
      assert.deepEqual(ids(r, 'question'), ['db-03'], `${r.engine}: the explanation of db-03 says "độ bền"`);
    }
  }
  for (const r of both('dap an')) {
    assert.ok(ids(r, 'note').includes('02-storage.md#dap-an'), `${r.engine}: đ folded`);
    assert.deepEqual(ids(r, 'question'), ['db-07']);
    assert.ok(!r.hits.some((h) => h.id === 'db-05'), '"an" (not the last word) must not match "and"');
  }
  for (const r of both('dynamodb str')) {
    assert.equal(ids(r, 'question')[0], 'db-01', `${r.engine}: phrase "DynamoDB Streams" first`);
    assert.ok(ids(r, 'note').includes('02-storage.md#2-dynamodb-streams'));
  }
  for (const r of both('db-04')) assert.equal(r.hits[0].id, 'db-04', `${r.engine}: exact id first`);
  for (const r of both('cân bằng tải')) assert.ok(ids(r, 'note').includes('04-networking.md#can-bang-tai-elb'));
  for (const r of both('glacier', { scope: 'notes' })) assert.ok(r.hits.length && r.hits.every((h) => h.kind === 'note'));
  for (const r of both('dynamodb', { scope: 'questions', limit: 1 })) {
    assert.equal(r.hits.length, 1);
    assert.ok(r.total!.questions >= 2, 'total counts matches beyond the limit');
  }
  for (const r of both('dynamodb accelerator')) {
    const dax = r.hits.find((h) => h.id === 'db-06');
    assert.ok(dax && dax.status === 'retired', `${r.engine}: retired questions stay findable, flagged`);
  }
  for (const r of both('zzqx')) assert.equal(r.hits.length, 0);
  for (const r of both('   ')) assert.equal(r.hits.length, 0);
  const q = S.search('kinesis replay');
  assert.equal(q.hits[0].kind, 'question');
  assert.match(q.hits[0].sub ?? '', /search-test/);
  assert.ok(q.tookMs >= 0);
});

it('no word in common with everything → any word (OR) for all groups; a group never mixes in loose matches', () => {
  const r = S.search('glacier xylophone');
  assert.ok(r.hits.length > 0, 'OR fallback when nothing has both words');
  const exact = S.search('glacier archive');
  assert.ok(exact.hits.every((h) => /glacier/i.test(h.snippet + h.title)), 'AND results only');
});

it('the index follows edits: notes by mtime/size, questions by bank version, deleted files disappear', () => {
  fs.appendFileSync(path.join(REPO, '04-networking.md'), '\n## Xylophone routing\nMột mục mới về định tuyến.\n');
  assert.deepEqual(ids(S.search('xylophone'), 'note'), ['04-networking.md#xylophone-routing']);
  writePack([...drafts, Q('db-09', 'A quokka workload needs burstable compute.', ['T3 instances', 'C7g', 'M7i', 'R7g'], 'A')]);
  assert.deepEqual(ids(S.search('quokka'), 'question'), ['db-09']);
  fs.rmSync(path.join(REPO, '04-networking.md'));
  assert.deepEqual(ids(S.search('xylophone'), 'note'), []);
  assert.deepEqual(ids(S.search('xylophone', { fts: false }), 'note'), []);
});

it('a corrupt index database is rebuilt on the next search', () => {
  closeIndexDb();
  for (const f of [`${INDEX_DB_FILE}-wal`, `${INDEX_DB_FILE}-shm`]) fs.rmSync(f, { force: true });
  fs.writeFileSync(INDEX_DB_FILE, 'garbage '.repeat(500));
  const r = S.search('do ben');
  assert.equal(r.engine, 'fts5');
  assert.equal(ids(r, 'note')[0], '02-storage.md#do-ben-durability-11-9s');
});

it('[γ] sealed questions are neither indexed nor found — by words or by exact id, FTS5 and fallback — until their form is used', () => {
  const file = path.join(HOME, 'results', 'sealed.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const seal = (status: string) => fs.writeFileSync(file, `---\nkind: sealed\nsize: 1\nforms:\n  - id: S1\n    status: ${status}\n    ids: [db-02]\n---\n`);
  const found = (q: string, fts: boolean) => S.search(q, { scope: 'questions', fts }).hits.some((h) => h.id === 'db-02');
  for (const fts of [true, false]) assert.ok(found('automatic failover standby', fts), `visible before sealing (fts ${fts})`);
  seal('sealed');
  try {
    for (const fts of [true, false]) {
      assert.equal(found('automatic failover standby', fts), false, `words (fts ${fts})`);
      assert.equal(found('db-02', fts), false, `exact id (fts ${fts})`);
      assert.equal(S.search('automatic failover standby', { scope: 'questions', fts }).total?.questions, 0, 'not counted either');
    }
    seal('used'); // the form was taken: its questions are searchable again (the index refreshes on the sealed set)
    for (const fts of [true, false]) assert.ok(found('automatic failover standby', fts), `visible after use (fts ${fts})`);
  } finally {
    fs.rmSync(file, { force: true });
  }
});
