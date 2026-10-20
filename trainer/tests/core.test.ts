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
    models: { analyze: '', generate: '', enrich: '', ask: '', verify: '', tutor: '', notebook: '' },
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
    structured_output: true,
      enrich_after_analyze: false,
    idle_tasks: ['enrich'],
    twins_per_run: 10,
    tutor_daily_turns: 40,
    verify: { auto: false, auto_draft: false, batch_size: 10, grounded: false, local_model: '' },
  },
  srs: { algorithm: 'leitner', desired_retention: 0.9, daily_limit: 50, mastered_stability_days: 21, intervals_days: [1, 3, 7, 14, 30], mastered_box: 4, weights: [], optimize: 'off', optimize_min_reviews: 400, exam_aware: false, final_review_days: 7, new_cutoff_days: 10, load_balance: false, final_retention: 0, leech_lapses: 3, sibling_swap_days: 7 },
  practice: { default_count: 20, quick_count: 10, shuffle_options: true, exclude_out_of_scope: false, today_minutes: 25, relearn: true },
    exam: { sealed_forms: 0, sealed_size: 50 },
  stats: { rushed_median_seconds: 5, recency_half_life_days: 14, recognized_wpm: 300 },
  quality: { embeddings: 'off', ollama_url: '', embedding_model: '', semantic_threshold: 0.88, longform_target_per_task: 12 },
  server: { lan: false, lan_admin: false, https: 'off', https_cert: '', https_key: '' },
  export: { anki_deck: 'test', ankiconnect_url: '' },
  cache: { sqlite: false },
  sync: { data_paths: [], before_ai: false, after_ai: false, auto: 'off', auto_delay_minutes: 4 },
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

// ── [v5 ρ] runner & results ─────────────────────────────────────────────────

const session = await import('../web/lib/session.ts');
const runner = await import('../web/lib/runner.ts');
const results = await import('../server/lib/results.ts');
import type { Question, SubmitRequest, TestSession } from '../shared/types.ts';

function fakeQ(id: string, answer = ['B'], extra: Partial<Question> = {}): Question {
  return {
    id,
    stem: `Stem of ${id}. Which solution meets these requirements MOST cost-effectively?`,
    options: ['A', 'B', 'C', 'D'].map((k) => ({ key: k, text: `Option ${k} of ${id}` })),
    answer,
    time: 60,
    hash: `h-${id}`,
    ...extra,
  } as Question;
}

function fakeTest(n: number, extra: Partial<TestSession> = {}) {
  const questions = Array.from({ length: n }, (_, i) => fakeQ(`q${i}`));
  const s: TestSession = {
    sessionId: 'sess-1',
    mode: 'quick',
    title: 'Luyện nhanh',
    feedback: 'practice',
    timeLimit: 0,
    estimateTotal: 600,
    questions: questions.map((q) => ({ id: q.id, order: ['D', 'C', 'B', 'A'] })),
    notes: [],
    relearn: true,
    ...extra,
  } as TestSession;
  return session.startActive(s, questions);
}

test('relearn: a missed question is queued 3–6 questions later (at the end when fewer are left), once, options rotated', () => {
  const t = fakeTest(10);
  assert.equal(session.isRelearn(t), true);
  const gap = session.relearnGap('q0');
  assert.ok(gap >= 3 && gap <= 6);
  const a = session.queueRelearn(t, 'q0');
  const slotId = 'q0' + session.RELEARN_SUFFIX;
  assert.equal(a.questions.findIndex((q) => q.id === slotId), 1 + gap, `${gap} questions in between`);
  assert.equal(a.questions.length, 11);
  const order = a.relearn![slotId].order;
  assert.deepEqual([...order].sort(), ['A', 'B', 'C', 'D']);
  assert.ok(order.every((k, i) => k !== ['D', 'C', 'B', 'A'][i]), `every option moves: ${order.join('')}`);
  assert.equal(session.queueRelearn(a, 'q0'), a, 'one retry per question');
  assert.equal(session.queueRelearn(a, slotId), a, 'a retry is never re-queued');
  assert.equal(session.baseId(slotId), 'q0');
  const late = session.queueRelearn({ ...t, current: 8 }, 'q8');
  assert.equal(late.questions[late.questions.length - 1].id, 'q8' + session.RELEARN_SUFFIX, 'near the end: last');
  assert.deepEqual(session.progressOf(a), { answered: 0, total: 10, relearnDone: 0, relearnTotal: 1 });
  assert.equal(session.isRelearn({ ...t, session: { ...t.session, feedback: 'exam' } }), false, 'practice feedback only');
});

test('early stop: never viewed left out, viewed blanks skipped, retries sent as relearn answers of the base question', () => {
  let t = session.queueRelearn(fakeTest(6), 'q0');
  const slotId = 'q0' + session.RELEARN_SUFFIX;
  t = {
    ...t,
    answers: { q0: ['A'], q1: ['B'], [slotId]: ['B'] },
    spent: { q0: 20, q1: 15, q2: 8, q3: 1, [slotId]: 6 },
    flags: { q4: true },
    recall: { [slotId]: 'nhớ ra' },
    why: { q0: 'Nhầm hai dịch vụ', [slotId]: 'không gửi' },
  };
  assert.equal(session.wasViewed(t, 'q3'), false, `< ${session.VIEWED_SECONDS} s is not a look`);
  assert.equal(session.wasViewed(t, 'q4'), true, 'flagged = looked at');
  assert.deepEqual(session.stopSummary(t), { answered: 2, skipped: 2, unseen: 2, planned: 6, relearnOpen: 0 });
  const req = session.buildSubmitRequest(t, false, Date.now(), { stoppedEarly: true });
  assert.equal(req.stoppedEarly, true);
  const byQ = (q: string, relearn = false) => req.answers.find((a) => a.q === q && !!a.relearn === relearn);
  assert.deepEqual(req.answers.map((a) => `${a.q}${a.relearn ? '+r' : ''}${a.skipped ? '·skip' : ''}`).sort(), ['q0', 'q0+r', 'q1', 'q2·skip', 'q4·skip']);
  assert.equal(byQ('q0', true)?.recall, 'nhớ ra');
  assert.equal(byQ('q0', true)?.why, undefined, 'the note belongs to the first attempt');
  assert.equal(byQ('q0')?.why, 'Nhầm hai dịch vụ');
  // a plain submit keeps every question (blanks graded wrong) and still no unanswered retry
  const plain = session.buildSubmitRequest({ ...t, answers: { q0: ['A'] } }, false);
  assert.equal(plain.stoppedEarly, undefined);
  assert.deepEqual(plain.answers.map((a) => a.q), ['q0', 'q1', 'q2', 'q3', 'q4', 'q5']);
  // honest measurements never stop early
  const exam = { ...t, session: { ...t.session, mode: 'exam' as const } };
  assert.equal(session.canStopEarly(exam), false);
  assert.equal(session.buildSubmitRequest(exam, false, Date.now(), { stoppedEarly: true }).stoppedEarly, undefined);
  assert.equal(session.canStopEarly({ ...t, session: { ...t.session, sealedForm: 'S1' } }), false);
  assert.equal(session.canStopEarly({ ...t, session: { ...t.session, mode: 'diagnostic' } }), false);
});

test('reconcile: a relearn retry follows its question when the bank moves the options', () => {
  let t = session.queueRelearn(fakeTest(4), 'q0');
  const slotId = 'q0' + session.RELEARN_SUFFIX;
  t = { ...t, answers: { [slotId]: ['A'] } };
  const moved = { ...fakeQ('q0'), hash: 'h-new', options: [...fakeQ('q0').options].reverse().map((o, i) => ({ key: 'ABCD'[i], text: o.text })), answer: ['C'] };
  const byId = new Map(t.questions.filter((q) => !session.isRelearnId(q.id)).map((q) => [q.id, q.id === 'q0' ? moved : q]));
  const r = session.reconcileActive(t, byId);
  assert.deepEqual(r.remapped, ['q0'], 'listed once');
  assert.deepEqual(r.test.answers[slotId], ['D'], 'pick follows the option text');
  assert.equal(r.test.questions.find((q) => q.id === slotId)?.hash, 'h-new');
  assert.equal(r.test.relearn![slotId].order.length, 4);
  assert.ok(r.test.session.questions.every((x) => !session.isRelearnId(x.id)), 'slots never become session refs');
});

test('why chips: labels joined with "; ", chips first in WHY_CHIPS order, toggling keeps the learner’s words', () => {
  const on = runner.toggleWhyChip('', 'Nhầm hai dịch vụ');
  assert.equal(on, 'Nhầm hai dịch vụ');
  const two = runner.toggleWhyChip(`${on}; tưởng SNS lưu tin`, 'Đọc sót yêu cầu (rẻ nhất / ít vận hành…)');
  assert.equal(two, 'Đọc sót yêu cầu (rẻ nhất / ít vận hành…); Nhầm hai dịch vụ; tưởng SNS lưu tin');
  assert.equal(runner.toggleWhyChip(two, 'Nhầm hai dịch vụ'), 'Đọc sót yêu cầu (rẻ nhất / ít vận hành…); tưởng SNS lưu tin');
  assert.deepEqual([...runner.whyChipsOn(two)].length, 2);
});

test('runner helpers: compare pair for discriminate sessions, final question of a family member', () => {
  const q = { answer: ['A'], options: [{ key: 'A', text: 'Use an Amazon SQS queue' }, { key: 'B', text: 'Publish to an SNS topic' }, { key: 'C', text: 'Use Kinesis' }] };
  assert.deepEqual(runner.comparePair(q, ['B'], ['SNS', 'SQS']), ['SQS', 'SNS']);
  assert.deepEqual(runner.comparePair(q, ['A'], ['SQS', 'EventBridge', 'SNS']), ['SQS', 'SNS'], 'right answer: the service in a distractor');
  assert.deepEqual(runner.comparePair({ answer: ['C'], options: q.options }, [], ['Snow Family', 'DataSync']), ['Snow Family', 'DataSync'], 'nothing named: the pair itself');
  assert.equal(runner.finalAsk('A company runs **X**. It needs Y. Which solution meets these requirements with the LEAST operational overhead?'), 'Which solution meets these requirements with the LEAST operational overhead?');
});

test('grading: early stop, relearn retries and ref.for on the real bank (pure, nothing written)', async () => {
  const { loadBank } = await import('../server/lib/bank.ts');
  const bank = loadBank();
  const { sealedIds } = await import('../server/lib/sealed.ts');
  const sealed = sealedIds();
  const open = bank.questions.filter((q) => q.status === 'active' && q.answer.length === 1 && !sealed.has(q.id));
  // the first question has an active, unsealed cluster mate (Question.cluster, filled by loadBank)
  const head = open.find((q) => q.cluster && open.some((x) => x.id !== q.id && x.cluster === q.cluster))!;
  const mate = open.find((x) => x.id !== head.id && x.cluster === head.cluster)!;
  const qs = [head, ...open.filter((q) => q.id !== head.id && q.id !== mate.id && q.cluster !== head.cluster).slice(0, 4)];
  const wrong = (q: Question) => [q.options.find((o) => !q.answer.includes(o.key))!.key];
  const s = { sessionId: 'x', mode: 'quick', title: 't', feedback: 'practice', timeLimit: 0, estimateTotal: 0, notes: [], questions: qs.map((q, i) => ({ id: q.id, ...(i === 0 ? { for: mate.id } : {}) })) } as unknown as TestSession;
  const req: SubmitRequest = {
    session: s,
    answers: [
      { q: qs[0].id, pick: qs[0].answer, t: 30 },
      { q: qs[1].id, pick: wrong(qs[1]), t: 40 },
      { q: qs[1].id, pick: qs[1].answer, t: 5 }, // a retry sent without the relearn flag: never replaces the first attempt
      { q: qs[1].id, pick: qs[1].answer, t: 9, relearn: true },
      { q: qs[2].id, pick: [], t: 12 },
    ],
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    timedOut: false,
    timeUsed: 91,
    stoppedEarly: true,
  };
  const g = results.gradeSubmission(req, bank);
  assert.deepEqual(g.records.map((r) => [r.q === qs[1].id && r.relearn ? 'retry' : r.skipped ? 'skip' : r.ok ? 'ok' : 'wrong']).flat(), ['ok', 'wrong', 'retry', 'skip']);
  assert.deepEqual([g.total, g.correct, g.score, g.planned, g.unseen, g.skipped], [2, 1, 50, 5, 2, 1]);
  assert.equal(g.records[0].for, mate.id, 'a cluster mate is kept');
  // anything else is dropped: an unrelated question, and a sealed one even when linked by variant_of (ids never printed)
  assert.equal(results.cleanFor(qs[4].id, head, bank), undefined, 'unrelated question dropped');
  const sealedId = [...sealed][0];
  if (sealedId) assert.ok(results.cleanFor(sealedId, { ...head, variantOf: [sealedId] }, bank) === undefined, 'a sealed question is never named');
  assert.equal(g.questions.length, g.records.length, 'questions parallel to records');
  assert.equal(results.isGraded(g.records[2]), false);
  assert.equal(results.isGraded(g.records[3]), false);
  // without stoppedEarly: every ref graded, the blank counts wrong
  const full = results.gradeSubmission({ ...req, stoppedEarly: undefined }, bank);
  assert.deepEqual([full.total, full.correct, full.planned], [5, 1, undefined]);
  assert.equal(results.canStopEarly({ mode: 'exam' }), false);
  assert.equal(results.canStopEarly({ mode: 'quick', pearson: true }), false);
  assert.equal(results.canStopEarly({ mode: 'today' }), true);
});

test('self-graded attempts (Anki / listen) are never flagged rushed; their graded answers count in the median', () => {
  const graded = [1, 2, 3].map((g) => ({ pick: '', t: 2, grade: (g + 1) as 2 | 3 | 4 }));
  assert.equal(results.attemptMedianTime(graded), 2, 'grade answers count as answered');
  assert.equal(results.attemptMedianTime([{ pick: 'A', t: 3 }, { pick: 'A', t: 1, relearn: true }]), 3, 'relearn retries are left out');
  assert.equal(results.isRushed(2, 5), true, 'the app runner: a 2 s median is click-through');
  assert.equal(results.isRushed(2, 5, 'anki'), false);
  assert.equal(results.isRushed(0, 5, 'listen'), false);
  assert.equal(results.isRushed(2, 5, 'micro'), true, 'micro answers are picked in the app');
});
