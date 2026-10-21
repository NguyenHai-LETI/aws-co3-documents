// [v5 τ] 🎧 listen mode: speakable text, the "🇻🇳" summary, the next-items fallback (due first, short stems, never sealed /
// draft / out of scope / answered today) and finish → a 'listen' attempt with self-grades (idempotent). Run: npm test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-listen-')));
fs.mkdirSync(path.join(home, 'bank', 'packs', 'manual'), { recursive: true });
fs.copyFileSync(path.join(here, '..', 'bank', 'taxonomy.yaml'), path.join(home, 'bank', 'taxonomy.yaml'));
fs.mkdirSync(path.join(home, 'results'), { recursive: true });
fs.writeFileSync(path.join(home, 'config.yaml'), 'exam:\n  sealed_forms: 0\nsync:\n  auto: off\nsrs:\n  load_balance: false\n');
const block = (id: string, stem: string, extra = '') =>
  [`## Q ${id}`, '- domain: resilient', '- topic: database', '- difficulty: medium', '- time: 60', ...(extra ? [extra] : []), '', stem, '', '- A. Read Replicas', '- B. **Multi-AZ** deployment', '- C. Snapshots', '- D. Backups', '', '**Answer:** B', '', '**Explanation:** **Multi-AZ** gives [automatic failover](https://docs.aws.amazon.com).\nSecond line.\n\n- Read Replicas: scale reads.\n\n> 🇻🇳 Failover tự động → Multi-AZ.', '', '---', ''].join('\n');
const long = Array.from({ length: 45 }, (_, i) => `word${i}`).join(' ');
fs.writeFileSync(
  path.join(home, 'bank', 'packs', 'manual', 'li.md'),
  [
    '---\npack: li-pack\ntitle: Listen pack\norigin: manual\n---\n\n# Listen pack\n',
    block('li-01', 'Which RDS feature fails over automatically?'),
    block('li-02', 'Which RDS feature gives a standby in another AZ?'),
    block('li-03', 'Which feature keeps a synchronous standby?'),
    block('li-04', `Long stem ${long}?`),
    block('li-05', 'A draft question?', '- status: draft'),
    block('li-06', 'A sealed question about failover?'),
  ].join('\n'),
);
fs.writeFileSync(path.join(home, 'results', 'sealed.md'), '---\nkind: sealed\nsize: 1\nforms:\n  - id: S1\n    status: sealed\n    ids: [ li-06 ]\n---\n');
process.env.TRAINER_HOME = home;
after(() => fs.rmSync(home, { recursive: true, force: true }));

const L = await import('../server/lib/listen.ts');
const { context } = await import('../server/context.ts');
const { loadAttempts } = await import('../server/lib/results.ts');

test('speakable text: Markdown stripped, first paragraph + the 🇻🇳 line', () => {
  assert.equal(L.plainText('**Multi-AZ** gives [failover](https://x) and `code`\n- item'), 'Multi-AZ gives failover and code item');
  const q = context().bank.byId.get('li-01')!;
  const { en, vi } = L.splitExplanation(q.explanation);
  assert.equal(en, 'Multi-AZ gives automatic failover. Second line.');
  assert.equal(vi, 'Failover tự động → Multi-AZ.');
  const item = L.listenItem(q, false);
  assert.equal(item.options[1].text, 'Multi-AZ deployment');
  assert.deepEqual(item.answer, ['B']);
});

test('next items: σ microCandidates (short, active, not sealed), stable order, then nothing answered today', () => {
  const ctx = context();
  const n = L.listenNext(ctx, 10);
  assert.equal(n.source, 'micro');
  assert.ok(n.items.length >= 1);
  for (const i of n.items) assert.ok(['li-01', 'li-02', 'li-03'].includes(i.id), `${i.id} is in the listening pool`);
  assert.deepEqual(L.listenNext(ctx, 10).items.map((i) => i.id), n.items.map((i) => i.id), 'deterministic');
  assert.ok(L.listenNext(ctx, 1).items.length === 1);
  // grade one of them today → not served again today
  const r = L.finishListen({ sessionId: 'listen:test-session-1', items: [{ q: n.items[0].id, grade: 2, t: 14 }] }, ctx.bank);
  assert.equal(r.total, 1);
  assert.ok(!L.listenNext(context(), 10).items.some((i) => i.id === n.items[0].id));
});

test('finish: self-grades → a listen attempt (no pick, ok = grade ≥ 3), sealed / unknown / bad grades dropped, idempotent', () => {
  const ctx = context();
  assert.throws(() => L.finishListen({ sessionId: 'listen:empty-session', items: [{ q: 'li-06', grade: 4, t: 1 }] }, ctx.bank), /Chưa có câu nào được chấm/);
  const body = {
    sessionId: 'listen:test-session-2',
    started: '2026-10-20T07:00:00+07:00',
    finished: '2026-10-20T07:05:00+07:00',
    items: [
      { q: 'li-02', grade: 1, t: 20 },
      { q: 'li-03', grade: 4, t: 9999 },
      { q: 'li-02', grade: 3, t: 25 },
      { q: 'li-06', grade: 4, t: 5 },
      { q: 'nope', grade: 3, t: 5 },
      { q: 'li-01', grade: 7, t: 5 },
    ],
  };
  const r = L.finishListen(body as never, ctx.bank);
  assert.equal(r.total, 2);
  assert.equal(r.correct, 2);
  const a = loadAttempts().find((x) => x.id === r.id)!;
  assert.equal(a.mode, 'listen');
  assert.equal(a.source, 'listen');
  assert.equal(a.sessionId, 'listen:test-session-2');
  assert.deepEqual(
    a.answers.map((x) => [x.q, x.pick, x.grade, x.ok, x.t]),
    [
      ['li-03', '', 4, true, 900],
      ['li-02', '', 3, true, 25],
    ],
  );
  const text = fs.readFileSync(path.join(home, a.file), 'utf8');
  assert.ok(!text.includes('li-06'), 'a sealed id is never written');
  const again = L.finishListen(body as never, ctx.bank);
  assert.equal(again.id, r.id);
  assert.equal(again.duplicate, true);
});

test('[R2] finish: future dates clamped to now, a missing / bad session id refused, draft questions refused', () => {
  const ctx = context();
  const r = L.finishListen({ sessionId: 'listen:future-0001', started: '2030-01-01T10:00:00Z', finished: '2030-01-01T10:05:00Z', items: [{ q: 'li-01', grade: 3, t: 5 }] }, ctx.bank);
  assert.equal(r.file.split('/')[1], String(new Date().getFullYear()), 'filed under this year, not 2030');
  const a = loadAttempts().find((x) => x.id === r.id)!;
  assert.ok(Date.parse(a.finished) <= Date.now() && Date.parse(a.started) <= Date.parse(a.finished));
  for (const sessionId of [undefined, 'listen:has.dot.123', 'other:abcdef']) {
    assert.throws(() => L.finishListen({ sessionId, items: [{ q: 'li-02', grade: 2, t: 5 }] } as never, ctx.bank), /sessionId/);
  }
  assert.throws(() => L.finishListen({ sessionId: 'listen:draft-00001', items: [{ q: 'li-05', grade: 4, t: 5 }] }, ctx.bank), /Chưa có câu nào/);
});
