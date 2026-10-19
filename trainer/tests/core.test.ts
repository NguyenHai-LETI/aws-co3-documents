// Unit tests for the Markdown formats and learning logic. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BANK_DIR } from '../server/config.ts';
import { loadTaxonomy } from '../server/lib/taxonomy.ts';
import { parsePack, serializePack, type QuestionDraft } from '../server/lib/pack-format.ts';
import { splitFrontMatter, stringifyFrontMatter } from '../server/lib/frontmatter.ts';
import { computeStates, isDue } from '../server/lib/stats.ts';
import { estimateQuestionTime, computeTimeLimit } from '../shared/timing.ts';
import { isCorrect, scaledScore } from '../shared/scoring.ts';
import type { AppConfig } from '../server/config.ts';
import type { Attempt } from '../shared/types.ts';

const tax = loadTaxonomy();
const cfg: AppConfig = {
  coach: {
    model: '',
    models: { analyze: '', generate: '', enrich: '', ask: '' },
    effort: '',
    max_budget_usd: 0,
    skip_if_no_new_results: true,
    schedule: [],
    claude_bin: '',
    use_api_key: false,
    hosts: [],
    enrich_on_idle: false,
    enrich_batch_size: 20,
    max_runs_per_day: 6,
  },
  srs: { algorithm: 'leitner', desired_retention: 0.9, daily_limit: 50, mastered_stability_days: 21, intervals_days: [1, 3, 7, 14, 30], mastered_box: 4 },
  practice: { default_count: 20, quick_count: 10, shuffle_options: true },
  stats: { rushed_median_seconds: 5, recency_half_life_days: 14 },
  sync: { data_paths: [], before_ai: false, after_ai: false },
};

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

test('time rubric matches the SCHEMA.md §4 examples', () => {
  const opts = (n: number, each: number) => Array.from({ length: n }, () => ({ text: words(each) }));
  // 40 words easy single → 50 s
  assert.equal(estimateQuestionTime({ stem: words(20), options: opts(4, 5), answer: ['A'], difficulty: 'easy' }, tax.timing), 50);
  // 170 words medium single → 120 s (the official SAA pace)
  assert.equal(estimateQuestionTime({ stem: words(110), options: opts(4, 15), answer: ['A'], difficulty: 'medium' }, tax.timing), 120);
  // 220 words hard, choose two → 175 s
  assert.equal(estimateQuestionTime({ stem: words(145), options: opts(5, 15), answer: ['A', 'B'], difficulty: 'hard' }, tax.timing), 175);
  // clamped to [45, 180]
  assert.equal(estimateQuestionTime({ stem: 'x', options: opts(2, 1), answer: ['A'], difficulty: 'easy' }, tax.timing), 45);
});

test('test time limit = Σ estimates × preset', () => {
  assert.equal(computeTimeLimit(1000, 10, 'standard'), 1020); // rounded up to 30 s
  assert.equal(computeTimeLimit(1000, 10, 'untimed'), 0);
  assert.equal(computeTimeLimit(1000, 65, 'official'), 65 * 120);
  assert.equal(computeTimeLimit(1000, 10, 'custom', 25), 1500);
});

test('grading is all-or-nothing and order-insensitive', () => {
  assert.equal(isCorrect(['B'], ['B']), true);
  assert.equal(isCorrect(['D', 'B'], ['B', 'D']), true);
  assert.equal(isCorrect(['B'], ['B', 'D']), false);
  assert.equal(isCorrect([], ['A']), false);
  assert.equal(scaledScore(72), 720);
});

test('the examples in bank/SCHEMA.md parse without errors', () => {
  const schema = fs.readFileSync(path.join(BANK_DIR, 'SCHEMA.md'), 'utf8');
  const blocks = [...schema.matchAll(/```markdown\n(## Q [\s\S]*?)```/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 2, 'expected question examples in SCHEMA.md');
  const pack = `---\npack: schema-examples\ntitle: Examples\norigin: manual\n---\n\n${blocks.join('\n---\n\n')}`;
  const { questions, problems } = parsePack(pack, 'bank/packs/manual/schema-examples.md', tax);
  assert.deepEqual(problems.filter((p) => p.level === 'error'), []);
  assert.equal(questions.length, blocks.length);
  assert.deepEqual(questions[1].answer, ['A', 'B']);
  assert.ok(questions[0].explanation.includes('synchronous standby'));
});

test('pack serializer round-trips through the parser', () => {
  const drafts: QuestionDraft[] = [
    {
      id: 'rt-01',
      stem: 'Which service? Note: colons, "quotes" and `code` are fine.',
      options: [
        { key: 'A', text: 'Amazon S3: Standard' },
        { key: 'B', text: 'Amazon EFS' },
        { key: 'C', text: 'Amazon EBS' },
        { key: 'D', text: 'Amazon FSx for Lustre' },
      ],
      answer: ['D'],
      explanation: 'HPC scratch = FSx for Lustre.\n- A: object storage.',
      domain: 'performance',
      topic: 'storage',
      services: ['FSx'],
      tags: ['fsx-lustre'],
      difficulty: 'medium',
      time: 60,
      variantOf: ['02-v1-01'],
    },
  ];
  const text = serializePack({ pack: 'rt-pack', title: 'RT', origin: 'manual' }, '', drafts, (d) => stringifyFrontMatter(d));
  const { questions, problems } = parsePack(text, 'bank/packs/manual/rt.md', tax);
  assert.deepEqual(problems.filter((p) => p.level === 'error'), []);
  assert.equal(questions[0].options[0].text, 'Amazon S3: Standard');
  assert.equal(questions[0].explanation, drafts[0].explanation);
  assert.deepEqual(questions[0].variantOf, ['02-v1-01']);
  assert.equal(questions[0].time, 60);
});

test('parser reports format errors with line numbers', () => {
  const bad = `---\npack: bad\norigin: manual\n---\n\n## Q bad-01\n- domain: nowhere\n- topic: storage\n- difficulty: medium\n- time: 60\n\nWhich two? (Choose TWO)\n\n- A. one\n- C. three\n\n**Answer:** A\n`;
  const { problems, questions } = parsePack(bad, 'bank/packs/manual/bad.md', tax);
  const msgs = problems.map((p) => p.message).join('\n');
  assert.match(msgs, /invalid domain/i);
  assert.match(msgs, /consecutive/);
  assert.match(msgs, /Choose TWO/);
  assert.equal(questions.length, 0);
  assert.ok(problems.every((p) => p.line >= 6));
});

test('front matter flow items keep result files compact and parseable', () => {
  const fm = stringifyFrontMatter({ id: 'x', answers: [{ q: '03-v2-01', pick: '', key: 'B', ok: false }] }, ['answers']);
  assert.match(fm, /- \{ q: 03-v2-01, pick: "", key: B, ok: false \}/);
  const back = splitFrontMatter(fm + '\nbody');
  assert.equal((back.data.answers as { pick: string }[])[0].pick, '');
});

test('Leitner boxes: wrong → 1, first confident correct → 2, unsure does not promote', () => {
  const at = (days: number, answers: Attempt['answers']): Attempt =>
    ({ id: String(days), finished: new Date(Date.now() - days * 86400000).toISOString(), answers }) as Attempt;
  const r = (q: string, ok: boolean, unsure = false) => ({ q, pick: ok ? 'A' : 'B', key: 'A', ok, t: 30, est: 60, unsure });
  const states = computeStates(
    [at(10, [r('a', true), r('b', false), r('c', true, true)]), at(5, [r('a', true), r('b', true)])],
    cfg,
  );
  assert.equal(states.get('a')!.box, 3);
  assert.equal(states.get('b')!.box, 2);
  assert.equal(states.get('c')!.box, 1);
  assert.equal(isDue(states.get('a')), false); // box 3 → 7 days after 5 days ago
  assert.equal(isDue(states.get('b')), true); // box 2 → 3 days after 5 days ago
  assert.deepEqual(states.get('b')!.wrongPicks, { B: 1 });
});

test('the real bank loads without errors', async () => {
  const { loadBank } = await import('../server/lib/bank.ts');
  const bank = loadBank();
  assert.ok(bank.questions.length >= 745);
  assert.deepEqual(bank.problems.filter((p) => p.level === 'error'), []);
});
