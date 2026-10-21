// [v5 γ1] Unit tests for the exam guide (server/lib/exam-guide.ts + bank/exam-guide/*.yaml) and the `skills` / `family`
// metadata (pack-format.ts): the transcribed guide (189 bullets, ids by position, verbatim spot checks, sources), the cue
// file, the keyword guess (own task only, rarity-weighted, ≤ 3), stored skills win, toDraft never writes a guess,
// coverage + task deficits. Pure functions + read-only files (the real guide YAML).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GUESS, guessSkills, parseCues, parseExamGuide } from '../server/lib/exam-guide.ts';
import { parsePack, serializeQuestion, toDraft } from '../server/lib/pack-format.ts';
import { loadTaxonomy } from '../server/lib/taxonomy.ts';
import { TRAINER_ROOT } from './helpers/paths.ts';
import type { Question } from '../shared/types.ts';

const GUIDE = parseExamGuide(fs.readFileSync(path.join(TRAINER_ROOT, 'bank', 'exam-guide', 'SAA-C03.yaml'), 'utf8'));
const CUES = parseCues(fs.readFileSync(path.join(TRAINER_ROOT, 'bank', 'exam-guide', 'SAA-C03-cues.yaml'), 'utf8'));

test('the transcribed guide: 189 bullets over 14 tasks, ids by position, sources + fetch date, scope lists', () => {
  assert.equal(GUIDE.bullets.length, 189);
  assert.equal(GUIDE.tasks.length, 14);
  const per = (t: string) => {
    const b = GUIDE.bullets.filter((x) => x.task === t);
    return [b.filter((x) => x.kind === 'knowledge').length, b.filter((x) => x.kind === 'skill').length];
  };
  assert.deepEqual(
    GUIDE.tasks.map((t) => [t.id, ...per(t.id)]),
    [['1.1', 5, 6], ['1.2', 6, 4], ['1.3', 4, 7], ['2.1', 16, 7], ['2.2', 12, 8], ['3.1', 3, 2], ['3.2', 6, 4], ['3.3', 8, 5], ['3.4', 4, 4], ['3.5', 7, 7], ['4.1', 11, 10], ['4.2', 9, 6], ['4.3', 9, 5], ['4.4', 7, 7]],
  );
  const text = (id: string) => GUIDE.bullets.find((b) => b.id === id)?.text;
  assert.equal(text('1.1.k5'), 'The AWS shared responsibility model');
  assert.equal(text('3.5.s7'), 'Transforming data between formats (for example, .csv to .parquet)');
  assert.equal(text('4.4.s3'), 'Configuring appropriate network routes to minimize network transfer costs (for example, Region to Region, Availability Zone to Availability Zone, private to public, AWS Global Accelerator, VPC endpoints)');
  assert.equal(GUIDE.tasks.find((t) => t.id === '2.2')?.title, 'Design highly available and/or fault-tolerant architectures');
  assert.deepEqual([...new Set(GUIDE.tasks.map((t) => t.domain))], ['secure', 'resilient', 'performance', 'cost']);
  assert.equal(GUIDE.fetched, '2026-10-20');
  assert.equal(GUIDE.sources.length, 7);
  for (const u of GUIDE.sources) assert.match(u, /^https:\/\/docs\.aws\.amazon\.com\/aws-certification\/latest\/solutions-architect-associate-03\//);
  assert.equal(GUIDE.responseTypes.length, 2);
  assert.ok(Object.values(GUIDE.outOfScope).flat().includes('AWS CodeCommit'));
  assert.ok(Object.values(GUIDE.inScope).flat().includes('Amazon Quick'));
  assert.deepEqual(parseExamGuide('nothing: here').bullets, []);
});

test('cue file: only known bullet ids, every regex compiles, most bullets have cues', () => {
  const ids = new Set(GUIDE.bullets.map((b) => b.id));
  for (const id of CUES.keys()) assert.ok(ids.has(id), `unknown bullet ${id}`);
  const withCues = GUIDE.bullets.filter((b) => (CUES.get(b.id)?.length ?? 0) > 0).length;
  assert.ok(withCues >= 180, `${withCues} bullets with cues`);
  assert.equal(parseCues("'1.1.k1': ['(', 'ok']").get('1.1.k1')?.length, 1, 'a broken regex is skipped');
});

const mkq = (id: string, task: string, stem: string, key = 'Use the managed service'): Question =>
  ({ id, task, stem, status: 'active', options: [{ key: 'A', text: key }, { key: 'B', text: 'Something else' }], answer: ['A'] }) as unknown as Question;

test('guessSkills: own task only, rare cues weigh more, at most 3 bullets, nothing without a task', () => {
  const qs = [
    mkq('g-1', '4.1', 'The bucket owner wants the downloaders to pay for the data transfer. What should the company enable?', 'Enable Requester Pays on the S3 bucket'),
    ...Array.from({ length: 12 }, (_, i) => mkq(`g-s${i}`, '4.1', `A company stores reports in Amazon S3 number ${i}. Which storage class is the most cost-effective?`, 'S3 Standard-IA')),
    mkq('g-2', '1.1', 'The bucket owner wants the downloaders to pay for the data transfer. What should the company enable?', 'Enable Requester Pays on the S3 bucket'),
    mkq('g-3', '', 'Requester Pays'),
  ];
  const g = guessSkills(qs, GUIDE, CUES);
  assert.equal(g.get('g-1')?.[0], '4.1.k1', 'Requester Pays → 4.1.k1');
  assert.ok(!g.get('g-2')?.includes('4.1.k1'), 'a 1.1 question never gets a 4.1 bullet');
  assert.equal(g.get('g-3'), undefined, 'no task → no guess');
  for (const v of g.values()) assert.ok(v.length <= GUESS.maxPerQuestion);
  assert.ok(g.get('g-s0')?.includes('4.1.s8'), 'storage class → 4.1.s8');
});

test('pack format: `skills:` / `family:` parse + serialize; toDraft keeps stored skills only', () => {
  const tax = loadTaxonomy();
  const text = [
    '---',
    'pack: t-skills',
    'title: T',
    'origin: manual',
    '---',
    '',
    '## Q t-skill-01',
    '- domain: cost',
    '- task: 4.1',
    '- topic: storage',
    '- difficulty: medium',
    '- time: 60',
    '- skills: 4.1.K1, 4.1.s5, 4.1.k1, bad-id',
    '- family: tier-choice',
    '',
    'Which option lets the downloaders pay for the requests and data transfer?',
    '',
    '- A. Enable Requester Pays',
    '- B. Enable versioning',
    '- C. Use a lifecycle rule',
    '- D. Use S3 Transfer Acceleration',
    '',
    '**Answer:** A',
    '',
    '**Explanation:** Requester Pays makes the requester pay for requests and transfer; the other options change storage behaviour or speed instead.',
  ].join('\n');
  const p = parsePack(text, 'bank/packs/manual/t.md', tax);
  const q = p.questions[0];
  assert.deepEqual(q.skills, ['4.1.k1', '4.1.s5', 'bad-id']);
  assert.equal(q.family, 'tier-choice');
  assert.ok(p.problems.some((x) => x.level === 'warning' && /Invalid skill id "bad-id"/.test(x.message)));
  const out = serializeQuestion(toDraft(q));
  assert.match(out, /- variant_of|- skills: 4\.1\.k1, 4\.1\.s5, bad-id\n- family: tier-choice/);
  const guessed = { ...q, skills: ['4.1.k9'], skillsGuessed: true };
  assert.doesNotMatch(serializeQuestion(toDraft(guessed)), /- skills:/, 'a keyword guess is never written to a pack');
  assert.match(serializeQuestion(toDraft(guessed)), /- family: tier-choice/);
});
