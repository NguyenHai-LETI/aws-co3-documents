// Unit tests for the Anki export: TSV format (headers, stable GUIDs, escaping), card HTML, tags, scope selection,
// and the AnkiConnect push against an in-memory fake add-on. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { ANKI_TAG_ROOT, ID_TAG, ankiStatus, ankiTsv, cardBack, cardFront, cardTags, mdToHtml, noteGuid, pushToAnki, searchTerm, selectForAnki } from '../server/lib/anki.ts';
import { loadBank } from '../server/lib/bank.ts';
import { startFakeAnki } from './helpers/fake-anki.ts';
import type { AnkiExportRequest, Question, QuestionState } from '../shared/types.ts';

function q(id: string, over: Partial<Question> = {}): Question {
  return {
    id,
    pack: 'p1',
    stem: `Stem of ${id}. Which solution meets the requirements?`,
    options: [
      { key: 'A', text: `Option A of ${id}` },
      { key: 'B', text: `Option B of ${id}` },
      { key: 'C', text: `Option C of ${id}` },
      { key: 'D', text: `Option D of ${id}` },
    ],
    answer: ['B'],
    explanation: `Because B. **Bold** reason for ${id}.`,
    domain: 'resilient',
    topic: 'database',
    services: ['RDS'],
    tags: [],
    difficulty: 'medium',
    time: 80,
    timeEstimated: false,
    status: 'active',
    origin: 'imported',
    variantOf: [],
    refs: [],
    task: '2.2',
    words: 10,
    longForm: false,
    hash: `h-${id}`,
    file: 'bank/packs/x.md',
    line: 1,
    ...over,
  };
}

const opts = { deck: 'AWS SAA-C03', model: 'Basic', includeExplanation: true };
const rowsOf = (tsv: string) => tsv.trimEnd().split('\n').filter((l) => !l.startsWith('#'));

// ── TSV format ──────────────────────────────────────────────────────────────

test('TSV starts with the Anki file headers and has one guid·front·back·tags row per question', () => {
  const tsv = ankiTsv([q('a-1'), q('a-2')], opts);
  const lines = tsv.split('\n');
  assert.deepEqual(lines.slice(0, 6), ['#separator:tab', '#html:true', '#notetype:Basic', '#deck:AWS SAA-C03', '#guid column:1', '#tags column:4']);
  assert.ok(tsv.endsWith('\n'));
  const rows = rowsOf(tsv);
  assert.equal(rows.length, 2);
  for (const [i, row] of rows.entries()) {
    const cols = row.split('\t');
    assert.equal(cols.length, 4, 'exactly 4 tab-separated columns');
    assert.equal(cols[0], noteGuid(`a-${i + 1}`));
    assert.ok(cols[1].includes(`Stem of a-${i + 1}`));
    assert.ok(cols[2].includes('Đáp án: B'));
    assert.ok(cols[3].split(' ').includes(`${ID_TAG}a-${i + 1}`));
  }
});

test('GUID is stable per question id (re-import updates) and differs between questions', () => {
  assert.equal(noteGuid('03-v1-05'), noteGuid('03-v1-05'));
  assert.notEqual(noteGuid('03-v1-05'), noteGuid('03-v1-06'));
  assert.ok(!noteGuid('x').startsWith('#'), 'a leading # would make Anki read the row as a comment');
  const before = ankiTsv([q('a-1')], opts);
  assert.equal(ankiTsv([q('a-1')], opts), before, 'deterministic output');
  const edited = ankiTsv([q('a-1', { stem: 'A rewritten stem', answer: ['C'] })], opts);
  assert.notEqual(edited, before);
  assert.equal(rowsOf(edited)[0].split('\t')[0], rowsOf(before)[0].split('\t')[0], 'same GUID after the question is edited');
});

test('fields are escaped single-line HTML: no raw markup from the bank, no tabs, newlines or double quotes', () => {
  const nasty = q('x-1', {
    stem: 'Use <script>alert(1)</script> & "quotes"\twith a tab\nand a soft-wrapped line.',
    options: [
      { key: 'A', text: '<img src=x onerror=alert(1)>' },
      { key: 'B', text: "Host affinity set to \"Host\" and 'single'" },
    ],
    answer: ['B'],
    explanation: 'Line one\n\n- item <b>one</b>\n- item\ttwo\n> 🇻🇳 tóm tắt',
  });
  const row = rowsOf(ankiTsv([nasty], opts))[0];
  assert.equal(row.split('\t').length, 4, 'tabs inside fields would add columns');
  assert.ok(!row.includes('\n') && !row.includes('\r'));
  assert.ok(!row.includes('"'), 'a double quote can start a quoted CSV field in Anki’s importer');
  assert.ok(!/<script|<img/i.test(row), 'bank text is never emitted as markup');
  assert.ok(row.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;'));
  assert.ok(row.includes('&quot;Host&quot; and &#39;single&#39;'));
  assert.ok(row.includes('&lt;b&gt;one&lt;/b&gt;'));
});

test('Markdown subset: paragraphs, bold, code, lists, quotes, safe links only', () => {
  assert.equal(mdToHtml('A healthcare company runs\nPostgreSQL on RDS.'), '<p>A healthcare company runs PostgreSQL on RDS.</p>');
  assert.equal(mdToHtml('**Host** and `aws s3 ls` and *maybe*'), '<p><b>Host</b> and <code>aws s3 ls</code> and <i>maybe</i></p>');
  assert.equal(mdToHtml('Why:\n- Multi-AZ: sync standby\n- Read replica: async\n  continued\n> 🇻🇳 Ghi nhớ'), '<p>Why:</p><ul><li>Multi-AZ: sync standby</li><li>Read replica: async continued</li></ul><blockquote><p>🇻🇳 Ghi nhớ</p></blockquote>');
  assert.equal(mdToHtml('1. first\n2. second'), '<ol><li>first</li><li>second</li></ol>');
  assert.equal(mdToHtml('### Note\ntext'), '<p><b>Note</b></p><p>text</p>');
  assert.equal(mdToHtml('```\nline 1\n  line 2\n```'), '<pre><code>line 1<br>  line 2</code></pre>');
  assert.equal(mdToHtml('[docs](https://docs.aws.amazon.com/x?a=1&b=2)'), "<p><a href='https://docs.aws.amazon.com/x?a=1&amp;b=2'>docs</a></p>");
  assert.ok(!mdToHtml('[x](javascript:alert(1))').includes('<a'), 'only http(s) links become anchors');
  assert.equal(mdToHtml('snake_case_name and a*b*c'), '<p>snake_case_name and a*b*c</p>');
});

test('back: correct option(s) and the explanation only when asked', () => {
  const multi = q('m-1', { answer: ['A', 'C'], explanation: 'Both are needed.' });
  const back = cardBack(multi, true);
  assert.ok(back.includes('Đáp án đúng: A, C'));
  assert.ok(back.includes('Option A of m-1') && back.includes('Option C of m-1') && !back.includes('Option B of m-1'));
  assert.ok(back.includes('Both are needed.'));
  assert.ok(back.includes('m-1'), 'question id footer');
  assert.ok(!cardBack(multi, false).includes('Both are needed.'));
  const front = cardFront(multi);
  for (const k of ['A', 'B', 'C', 'D']) assert.ok(front.includes(`<b>${k}.</b> Option ${k} of m-1`));
  assert.ok(!front.includes('Both are needed.'), 'no answer on the front');
});

test('tags: domain, topic, task, services (spaces → _) and the id tag', () => {
  const tags = cardTags(q('t-1', { services: ['Route 53', 'S3', 'S3'], task: '1.3', domain: 'secure', topic: 'networking' }));
  assert.deepEqual(tags, [
    `${ANKI_TAG_ROOT}::domain::secure`,
    `${ANKI_TAG_ROOT}::topic::networking`,
    `${ANKI_TAG_ROOT}::task::1.3`,
    `${ANKI_TAG_ROOT}::service::Route_53`,
    `${ANKI_TAG_ROOT}::service::S3`,
    `${ID_TAG}t-1`,
  ]);
  assert.ok(!cardTags(q('t-2', { task: undefined })).some((t) => t.includes('::task::')));
  assert.ok(tags.every((t) => !/\s|"/.test(t)));
});

test('the deck and note type headers stay on one line', () => {
  const tsv = ankiTsv([q('a-1')], { deck: 'AWS\tSAA\nC03::Sai', model: 'Basic\r\nX', includeExplanation: false });
  assert.ok(tsv.includes('#deck:AWS SAA C03::Sai\n'));
  assert.ok(tsv.includes('#notetype:Basic X\n'));
});

// ── scope selection ─────────────────────────────────────────────────────────

test('scopes: all / filter / ids / wrong / due / flagged', () => {
  const qs = [
    q('s-1', { domain: 'secure' }),
    q('s-2', { domain: 'cost' }),
    q('s-3', { domain: 'secure' }),
    q('s-4', { status: 'draft' }),
    q('s-5', { status: 'retired' }),
    q('s-6', { domain: 'performance' }),
  ];
  const bank = { questions: qs, byId: new Map(qs.map((x) => [x.id, x])) };
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
  const st = (id: string, over: Partial<QuestionState>): QuestionState => ({ id, attempts: 1, correct: 0, everWrong: false, streak: 0, box: 1, avgTime: 30, slowCount: 0, wrongPicks: {}, ...over });
  const states: Record<string, QuestionState> = {
    's-1': st('s-1', { lastOk: false, everWrong: true, dueAt: past }),
    's-2': st('s-2', { lastOk: true, everWrong: true, dueAt: future, lastFlag: true }),
    's-3': st('s-3', { lastOk: true, dueAt: past, lastUnsure: true }),
    's-6': st('s-6', { lastOk: false, everWrong: true, dueAt: future }),
  };
  const ids = (r: AnkiExportRequest) => selectForAnki(r, bank, states).questions.map((x) => x.id);
  assert.deepEqual(ids({ scope: 'all' }), ['s-1', 's-2', 's-3', 's-6'], 'active questions only');
  assert.deepEqual(ids({ scope: 'all', filters: { domains: ['secure'] } }), ['s-1', 's-2', 's-3', 's-6'], '"all" ignores filters');
  assert.deepEqual(ids({ scope: 'filter', filters: { domains: ['secure'] } }), ['s-1', 's-3']);
  assert.deepEqual(ids({ scope: 'wrong' }), ['s-1', 's-6'], 'last answer wrong');
  assert.deepEqual(ids({ scope: 'wrong', everWrong: true }), ['s-1', 's-2', 's-6'], 'ever wrong');
  assert.deepEqual(ids({ scope: 'wrong', filters: { domains: ['performance'] } }), ['s-6'], 'filters narrow the practice scopes');
  assert.deepEqual(ids({ scope: 'due' }).sort(), ['s-1', 's-3']);
  assert.deepEqual(ids({ scope: 'flagged' }), ['s-2', 's-3'], 'flagged or unsure');
  const sel = selectForAnki({ scope: 'ids', ids: ['s-3', 'nope', 's-5', 's-4', 's-3', ' s-1 '] }, bank, states);
  assert.deepEqual(
    sel.questions.map((x) => x.id),
    ['s-3', 's-4', 's-1'],
    'requested order, de-duplicated, drafts allowed',
  );
  assert.deepEqual(sel.missing, ['nope', 's-5'], 'unknown and retired ids are reported');
});

test('every active question of the real bank exports cleanly (read-only)', () => {
  const bank = loadBank();
  const active = bank.questions.filter((x) => x.status === 'active');
  assert.ok(active.length > 100);
  const rows = rowsOf(ankiTsv(active, opts));
  assert.equal(rows.length, active.length);
  const guids = new Set<string>();
  for (const row of rows) {
    const cols = row.split('\t');
    assert.equal(cols.length, 4, `4 columns: ${cols[0]}`);
    assert.ok(!row.includes('"'), `no double quote: ${cols[0]}`);
    assert.ok(cols[1].length > 20 && cols[2].length > 20);
    guids.add(cols[0]);
  }
  assert.equal(guids.size, active.length, 'unique GUIDs');
});

test('Anki search terms escape quotes, backslashes and wildcards', () => {
  assert.equal(searchTerm('deck', 'AWS SAA-C03'), '"deck:AWS SAA-C03"');
  assert.equal(searchTerm('deck', 'My_deck *1* "q" \\'), '"deck:My\\_deck \\*1\\* \\"q\\" \\\\"');
  assert.equal(searchTerm('tag', `${ID_TAG}*`, true), `"tag:${ID_TAG}*"`);
});

// ── AnkiConnect ─────────────────────────────────────────────────────────────

test('AnkiConnect push: adds, then updates the same notes, duplicate scope = deck', async () => {
  const anki = await startFakeAnki();
  try {
    const qs = [q('p-1'), q('p-2'), q('p-3')];
    const first = await pushToAnki(anki.url, qs, opts);
    assert.deepEqual({ ok: first.ok, added: first.added, updated: first.updated, duplicates: first.duplicates, failed: first.failed }, { ok: true, added: 3, updated: 0, duplicates: 0, failed: 0 });
    assert.ok(anki.decks.has('AWS SAA-C03'), 'createDeck');
    assert.equal(anki.notes.length, 3);
    assert.ok(anki.notes.every((n) => n.deck === 'AWS SAA-C03' && n.model === 'Basic' && n.fields.Front.includes('Stem of') && n.tags.some((t) => t.startsWith(ID_TAG))));

    // edited question + explanation now excluded → the same notes are updated in place (review history kept)
    const second = await pushToAnki(anki.url, [q('p-1', { stem: 'Rewritten stem p-1' }), q('p-2'), q('p-3')], { ...opts, includeExplanation: false });
    assert.deepEqual({ ok: second.ok, added: second.added, updated: second.updated }, { ok: true, added: 0, updated: 3 });
    assert.equal(anki.notes.length, 3);
    const p1 = anki.notes.find((n) => n.tags.includes(`${ID_TAG}p-1`))!;
    assert.ok(p1.fields.Front.includes('Rewritten stem p-1'));
    assert.ok(!p1.fields.Back.includes('Bold'), 'explanation removed on update');

    // a note with the same front from elsewhere (no id tag) is a duplicate in this deck — but not in another deck
    anki.notes.push({ id: 1, deck: 'AWS SAA-C03', model: 'Basic', fields: { Front: cardFront(q('p-4')), Back: 'manual' }, tags: [] });
    const third = await pushToAnki(anki.url, [q('p-4'), q('p-5')], opts);
    assert.deepEqual({ ok: third.ok, added: third.added, duplicates: third.duplicates }, { ok: true, added: 1, duplicates: 1 });
    const other = await pushToAnki(anki.url, [q('p-1')], { ...opts, deck: 'Other deck' });
    assert.deepEqual({ added: other.added, updated: other.updated }, { added: 1, updated: 0 }, 'per-deck identity');
  } finally {
    await anki.close();
  }
});

test('AnkiConnect push: a missing note type and the api key are reported with hints', async () => {
  const anki = await startFakeAnki({ models: { 'Cơ bản': ['Mặt trước', 'Mặt sau'] } });
  try {
    const r = await pushToAnki(anki.url, [q('n-1')], opts);
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /Basic/);
    assert.match(r.hint ?? '', /Cơ bản/, 'lists the note types Anki has');
    const ok = await pushToAnki(anki.url, [q('n-1')], { ...opts, model: 'Cơ bản' });
    assert.equal(ok.added, 1, 'fields are mapped by position (localized names)');
    assert.ok(anki.notes[0].fields['Mặt trước'].includes('Stem of n-1'));
  } finally {
    await anki.close();
  }
  const locked = await startFakeAnki({ apiKey: 'secret' });
  try {
    const r = await pushToAnki(locked.url, [q('n-1')], opts);
    assert.equal(r.ok, false);
    assert.match(r.hint ?? '', /apiKey/);
  } finally {
    await locked.close();
  }
});

async function closedPort(): Promise<number> {
  const s = net.createServer();
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  const { port } = s.address() as net.AddressInfo;
  await new Promise<void>((r) => s.close(() => r()));
  return port;
}

test('Anki not running: push and status explain how to get AnkiConnect (add-on 2055492159)', async () => {
  const url = `http://127.0.0.1:${await closedPort()}`;
  const r = await pushToAnki(url, [q('z-1')], opts);
  assert.equal(r.ok, false);
  assert.equal(r.added + r.updated, 0);
  assert.match(r.errors[0], /Không kết nối được AnkiConnect/);
  assert.match(r.hint ?? '', /2055492159/);
  const s = await ankiStatus(url, 'AWS SAA-C03');
  assert.deepEqual({ available: s.available, deck: s.deck }, { available: false, deck: 'AWS SAA-C03' });
  assert.match(s.hint ?? '', /2055492159/);
});

test('AnkiConnect status lists decks and note types', async () => {
  const anki = await startFakeAnki();
  try {
    const s = await ankiStatus(anki.url, 'My deck');
    assert.equal(s.available, true);
    assert.equal(s.version, 6);
    assert.ok(s.models?.includes('Basic') && s.decks?.includes('Default'));
  } finally {
    await anki.close();
  }
});

test('an endpoint that is not AnkiConnect is reported as such', async () => {
  const http = await import('node:http');
  const srv = http.createServer((_req, res) => res.end('<html>hello</html>'));
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  try {
    const url = `http://127.0.0.1:${(srv.address() as net.AddressInfo).port}`;
    const s = await ankiStatus(url, 'd');
    assert.equal(s.available, false);
    assert.match(s.error ?? '', /không phải AnkiConnect/);
  } finally {
    srv.close();
  }
});

test('[γ] sealed questions are never exported: every scope leaves them out, an explicit id is skipped without being "missing"', () => {
  const qs = [q('k-1'), q('k-2'), q('k-3', { domain: 'secure' }), q('k-4', { status: 'retired' })];
  const bank = { questions: qs, byId: new Map(qs.map((x) => [x.id, x])) };
  const st = (id: string): QuestionState => ({ id, attempts: 1, correct: 0, everWrong: true, lastOk: false, streak: 0, box: 1, avgTime: 30, slowCount: 0, wrongPicks: {} });
  const states: Record<string, QuestionState> = { 'k-1': st('k-1'), 'k-2': st('k-2') };
  const sealed = new Set(['k-2', 'k-3']);
  const ids = (r: AnkiExportRequest) => selectForAnki(r, bank, states, sealed).questions.map((x) => x.id);
  assert.deepEqual(ids({ scope: 'all' }), ['k-1']);
  assert.deepEqual(ids({ scope: 'filter', filters: { domains: ['secure'] } }), []);
  assert.deepEqual(ids({ scope: 'wrong' }), ['k-1']);
  const sel = selectForAnki({ scope: 'ids', ids: ['k-3', 'k-1', 'k-4', 'nope'] }, bank, states, sealed);
  assert.deepEqual(sel.questions.map((x) => x.id), ['k-1']);
  assert.deepEqual(sel.missing, ['k-4', 'nope'], 'sealed ids are skipped silently (the Anki card explains why)');
  assert.deepEqual(selectForAnki({ scope: 'all' }, bank, states, new Set()).questions.map((x) => x.id), ['k-1', 'k-2', 'k-3'], 'nothing sealed → as before');
});
