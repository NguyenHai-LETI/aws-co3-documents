// Golden parse test. The parsers of the two permanent Markdown formats — question packs (bank/packs/**) and result files
// (results/**) — must keep producing exactly what they produced when the golden files were written: a different parse
// changes what every stored file means (item hashes `h` in results, the FSRS replay, stats, the coach snapshot). Such a
// change must be deliberate: add a migration when old files need one, then refresh the golden files and review the diff:
//   GOLDEN_UPDATE=1 node --test tests/golden.test.ts   →   git diff tests/fixtures/golden
// Fixtures (tests/fixtures/golden/home, copied to a temp TRAINER_HOME): a frozen copy of the real bank as committed on
// 2026-10-20 (748 questions + taxonomy), a pack of format edge cases, and result files of every stored generation
// (legacy layout 1 with BOM/CRLF, migrated layout 2, v4 sealed/Pearson/diagnostic/rt, a broken file, non-attempt files).
// The live bank and results are never read. Fields computed from the taxonomy by newer code (requirements, outOfScope)
// are left out on purpose: they are classifications, not parsing.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Attempt, Pack, Question } from '../shared/types.ts';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'golden');
const BANK_GOLDEN = path.join(FIXTURES, 'bank.golden.txt');
const JSON_GOLDEN = path.join(FIXTURES, 'golden.json');
const UPDATE = process.env.GOLDEN_UPDATE === '1';

// a throwaway copy: rewriting result files (round trip) and any cache stay out of the fixtures
const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-golden-')));
fs.cpSync(path.join(FIXTURES, 'home'), home, { recursive: true });
process.env.TRAINER_HOME = home; // read by server/config.ts when it is first imported (below)
process.env.TRAINER_REPO = home;
const { loadConfig } = await import('../server/config.ts');
const { loadBank } = await import('../server/lib/bank.ts');
const { loadAttempts, rewriteAttempt } = await import('../server/lib/results.ts');
const { splitFrontMatter } = await import('../server/lib/frontmatter.ts');

after(() => fs.rmSync(home, { recursive: true, force: true }));

const sha = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T; // drops undefined, like the stored YAML would

/** Everything the parser reads from a question block (+ what it derives from the text alone). */
const QUESTION_FIELDS = [
  'id', 'pack', 'stem', 'options', 'answer', 'explanation', 'domain', 'topic', 'services', 'tags', 'difficulty', 'time', 'timeEstimated',
  'status', 'origin', 'variantOf', 'concept', 'refs', 'created', 'source', 'task', 'hint', 'enriched', 'words', 'longForm', 'hash', 'file', 'line',
] as const;
const META_FIELDS = QUESTION_FIELDS.filter((k) => !['id', 'stem', 'options', 'answer', 'explanation', 'hash'].includes(k));

function questionView(q: Question): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of QUESTION_FIELDS) if (q[k] !== undefined) out[k] = q[k];
  return plain(out);
}

/** One line per question; long texts as short hashes, so `git diff` after a refresh shows which part changed. */
function digestLine(q: Question): string {
  const meta: Record<string, unknown> = {};
  for (const k of META_FIELDS) if (q[k] !== undefined) meta[k] = q[k];
  return [q.id, `hash=${q.hash}`, `key=${q.answer.join('')}`, `stem=${sha(q.stem)}`, `options=${sha(JSON.stringify(q.options))}`, `expl=${sha(q.explanation)}`, `meta=${sha(JSON.stringify(meta))}`, `L${q.line}`, `W${q.words}`, `T${q.time}`].join(' ');
}

const packView = (p: Pack) => plain(p);

const bank = loadBank();
const digest = bank.questions.map(digestLine);
const sampleIds = [
  ...bank.questions.filter((q) => q.pack === 'golden-edge-cases').map((q) => q.id),
  ...['01-v1-01', '01-v2-01'].filter((id) => bank.byId.has(id)),
  ...bank.questions.filter((q) => q.origin === 'ai').slice(0, 1).map((q) => q.id),
  ...bank.questions.filter((q) => q.origin === 'imported' && q.answer.length > 1).slice(0, 1).map((q) => q.id),
];

interface Golden {
  note: string;
  questions: number;
  packs: unknown[];
  problems: unknown[];
  samples: Record<string, unknown>;
  attempts: unknown[];
  roundtrip: Record<string, { data: unknown; notes: string[] }>;
}

const current: Golden = {
  note: 'Written by GOLDEN_UPDATE=1 node --test tests/golden.test.ts — review `git diff` before committing a refresh.',
  questions: bank.questions.length,
  packs: bank.packs.map(packView),
  problems: plain(bank.problems),
  samples: Object.fromEntries(sampleIds.map((id) => [id, questionView(bank.byId.get(id)!)])),
  attempts: [],
  roundtrip: {},
};

const expectedJson = (): Golden | undefined => (fs.existsSync(JSON_GOLDEN) ? (JSON.parse(fs.readFileSync(JSON_GOLDEN, 'utf8')) as Golden) : undefined);
const golden = expectedJson();
const missing = 'golden files missing — run: GOLDEN_UPDATE=1 node --test tests/golden.test.ts';
const refresh = 'If the change is intended: add a migration for old files if needed, then GOLDEN_UPDATE=1 node --test tests/golden.test.ts and review git diff tests/fixtures/golden.';

if (UPDATE) {
  after(() => {
    fs.writeFileSync(BANK_GOLDEN, ['# id hash key stem options expl meta Lline Wwords Ttime — see tests/golden.test.ts', ...digest, ''].join('\n'));
    fs.writeFileSync(JSON_GOLDEN, JSON.stringify(current, null, 1) + '\n');
    console.log(`golden files written: ${path.relative(process.cwd(), BANK_GOLDEN)}, ${path.relative(process.cwd(), JSON_GOLDEN)}`);
  });
}

test('bank: every question of the fixture packs parses as recorded (bank.golden.txt)', () => {
  assert.ok(bank.questions.length > 740, `fixture bank loaded (${bank.questions.length} questions)`);
  if (UPDATE) return;
  assert.ok(fs.existsSync(BANK_GOLDEN), missing);
  const want = fs.readFileSync(BANK_GOLDEN, 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
  const byId = (lines: string[]) => new Map(lines.map((l) => [l.split(' ')[0], l]));
  const w = byId(want);
  const g = byId(digest);
  const diffs: string[] = [];
  for (const [id, line] of w) if (g.get(id) !== line) diffs.push(`${id}\n    golden: ${line}\n    now:    ${g.get(id) ?? '(missing)'}`);
  for (const [id, line] of g) if (!w.has(id)) diffs.push(`${id}\n    golden: (missing)\n    now:    ${line}`);
  assert.equal(diffs.length, 0, `${diffs.length} question(s) parse differently:\n  ${diffs.slice(0, 8).join('\n  ')}\n${refresh}`);
  assert.deepEqual(digest.map((l) => l.split(' ')[0]), want.map((l) => l.split(' ')[0]), 'question order (files sorted, blocks in file order)');
});

test('bank: packs and format problems (errors / warnings of Ngân hàng → Kiểm tra định dạng) as recorded', () => {
  if (UPDATE) return;
  assert.ok(golden, missing);
  assert.equal(current.questions, golden.questions);
  assert.deepEqual(current.packs, golden.packs, `packs differ. ${refresh}`);
  assert.deepEqual(current.problems, golden.problems, `format problems differ. ${refresh}`);
});

test('bank: sample questions field by field (edge cases, both import generations, AI pack, multi-answer)', () => {
  assert.ok(sampleIds.length >= 8, `samples found: ${sampleIds.join(', ')}`);
  if (UPDATE) return;
  assert.ok(golden, missing);
  assert.deepEqual(Object.keys(current.samples), Object.keys(golden.samples), 'sample ids');
  for (const id of Object.keys(golden.samples)) assert.deepEqual(current.samples[id], golden.samples[id], `question ${id} parses differently. ${refresh}`);
});

test('results: every stored generation of result files parses as recorded (non-attempt and broken files are skipped)', () => {
  const attempts = loadAttempts(loadConfig());
  current.attempts = attempts.map((a: Attempt) => plain(a));
  assert.ok(attempts.length >= 6, `fixture results loaded (${attempts.length})`);
  if (UPDATE) return;
  assert.ok(golden, missing);
  assert.deepEqual(
    current.attempts.map((a) => (a as Attempt).file),
    golden.attempts.map((a) => (a as Attempt).file),
    'the same files are attempts (goal.md, external/, sealed.md and the broken file are not)',
  );
  for (const [i, a] of golden.attempts.entries()) assert.deepEqual(current.attempts[i], a, `${(a as Attempt).file} parses differently. ${refresh}`);
});

test('results: rewriting a result file keeps its front matter as recorded (unknown keys, migration notes)', () => {
  for (const a of loadAttempts(loadConfig())) {
    assert.equal(rewriteAttempt(a.file, () => {}), true, `rewrite ${a.file}`);
    const fm = splitFrontMatter(fs.readFileSync(path.join(home, a.file), 'utf8'));
    current.roundtrip[a.file] = { data: plain(fm.data), notes: fm.body.split('\n').filter((l) => /^>\s?ℹ/u.test(l)) };
  }
  if (UPDATE) return;
  assert.ok(golden, missing);
  assert.deepEqual(Object.keys(current.roundtrip), Object.keys(golden.roundtrip));
  for (const [file, want] of Object.entries(golden.roundtrip)) assert.deepEqual(current.roundtrip[file], want, `${file}: rewritten front matter differs. ${refresh}`);
});
