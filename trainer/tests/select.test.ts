// Unit tests for test selection (workstream α): sealed forms, diagnostic, realism + the realistic clock, requirement and
// out-of-scope filters, the deterministic "new" order and the variant rule of mock exams. Run: npm test
// In-memory bank + fake context (sealed forms and goal passed in) — never the real bank/results.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from '../server/config.ts';
import type { BankState } from '../server/lib/bank.ts';
import type { SelectCtx } from '../server/lib/select.ts';
import type { BuildTestRequest, DomainId, Question, QuestionState, SealedState, TestMode, TestSession } from '../shared/types.ts';

const TRAINER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-select-'));
fs.mkdirSync(path.join(HOME, 'bank', 'packs'), { recursive: true });
fs.copyFileSync(path.join(TRAINER, 'bank', 'taxonomy.yaml'), path.join(HOME, 'bank', 'taxonomy.yaml'));
process.env.TRAINER_HOME = HOME; // before config.ts is imported (dynamic imports below)
after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const { DATA_DIR } = await import('../server/config.ts');
// without process isolation another file may have loaded config.ts first (real data root): nothing here writes, but the
// taxonomy must be ours — skip then
const it = DATA_DIR === HOME ? test : test.skip;

const select = await import('../server/lib/select.ts');
const { loadTaxonomy } = await import('../server/lib/taxonomy.ts');
const { applyFilters, newOrder, practicePool, taskQuotas } = await import('../shared/filters.ts');
const { computeTimeLimit, countWords } = await import('../shared/timing.ts');
const realism = await import('../shared/realism.ts');

const tax = loadTaxonomy();
const DAY = 86_400_000;
const NOW = Date.now();
const DOMAINS: DomainId[] = ['secure', 'resilient', 'performance', 'cost'];
const SHORT: Record<DomainId, string> = { secure: 'sec', resilient: 'res', performance: 'per', cost: 'cos' };

function makeCfg(practice: Partial<AppConfig['practice']> = {}): AppConfig {
  return {
    coach: {
      model: '',
      models: { analyze: '', generate: '', enrich: '', ask: '', verify: '' },
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
      verify: { auto: false, auto_draft: false, batch_size: 10 },
    },
    srs: { algorithm: 'fsrs', desired_retention: 0.9, daily_limit: 500, mastered_stability_days: 21, intervals_days: [1, 3, 7, 14, 30], mastered_box: 4, weights: [], optimize: 'off', optimize_min_reviews: 400 },
    practice: { default_count: 20, quick_count: 10, shuffle_options: true, exclude_out_of_scope: true, ...practice },
    exam: { sealed_forms: 0, sealed_size: 50 },
    stats: { rushed_median_seconds: 5, recency_half_life_days: 14, recognized_wpm: 300 },
    quality: { embeddings: 'off', ollama_url: '', embedding_model: '', semantic_threshold: 0.88 },
    server: { lan: false },
    export: { anki_deck: 'test', ankiconnect_url: '' },
    cache: { sqlite: false },
    sync: { data_paths: [], before_ai: false, after_ai: false, auto: 'off', auto_delay_minutes: 4 },
  };
}
const cfg = makeCfg();

const words = (n: number, w = 'w') => Array.from({ length: n }, (_, i) => `${w}${i}`).join(' ');
const examStem = (id: string) => `A company operates workload ${id} across two Regions. ${words(58)} Which solution meets these requirements?`;
const examOptions = (id: string) => ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Configure ${key} for ${id} ${words(8, 'x')}` }));

function mk(id: string, domain: DomainId, task: string | undefined, o: Partial<Question> = {}): Question {
  const stem = o.stem ?? `Scenario ${id}: a team needs a design. Which option meets the requirement?`;
  const w = countWords(stem);
  return {
    id,
    pack: 'p-main',
    stem,
    options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Option ${key} for ${id}` })),
    answer: ['A'],
    explanation: 'Because.',
    domain,
    topic: 'compute',
    services: [],
    tags: [],
    difficulty: 'medium',
    time: 60,
    timeEstimated: false,
    status: 'active',
    origin: 'manual',
    variantOf: [],
    refs: [],
    task,
    words: w,
    longForm: w >= 55,
    hash: id,
    file: 'bank/packs/manual/p.md',
    line: 1,
    ...o,
  };
}

/** Exam-like variant of `mk` (long scenario stem + full-sentence options). */
const mkExam = (id: string, domain: DomainId, task: string | undefined, o: Partial<Question> = {}) => mk(id, domain, task, { stem: examStem(id), options: examOptions(id), ...o });

function makeBank(qs: Question[]): BankState {
  return {
    version: `test-${qs.length}`,
    taxonomy: tax,
    packs: [
      { id: 'p-main', title: 'Main', file: 'x', origin: 'manual', exam: 'SAA-C03', count: qs.length, activeCount: qs.length },
      { id: 'p-dev', title: 'Developer Tools', file: 'y', origin: 'imported', exam: 'SAA-C03', count: 0, activeCount: 0 },
    ],
    questions: qs,
    byId: new Map(qs.map((q) => [q.id, q])),
    problems: [],
  };
}

const tasksOf = (d: DomainId) => tax.tasks.filter((t) => t.domain === d).map((t) => t.id);

// ── the standard bank: 40 questions per domain, tasks round-robin, every 8th one exam-like ─────────────────────────
// variant families: sec-02 → sec-01 (direct), res-02 + res-03 → res-01 (siblings), per-05 + per-06 → missing original
// out of scope: cos-30 … cos-33 (pack p-dev) · requirements on some questions · one draft and one retired question
const standard: Question[] = DOMAINS.flatMap((d) =>
  Array.from({ length: 40 }, (_, i) => {
    const id = `${SHORT[d]}-${String(i + 1).padStart(2, '0')}`;
    const task = tasksOf(d)[i % tasksOf(d).length];
    const o: Partial<Question> = {};
    if (i % 8 === 7) Object.assign(o, { stem: examStem(id), options: examOptions(id) });
    if (i % 5 === 0) o.requirements = ['cost'];
    if (i % 7 === 3) o.requirements = ['ops', 'negative'];
    return mk(id, d, task, o);
  }),
).map((q) => {
  // (rebuilt through mkExam so that the computed `words` / `longForm` match the long stem)
  if (q.id === 'sec-02') return mkExam(q.id, q.domain, q.task, { requirements: q.requirements, variantOf: ['sec-01'] });
  if (q.id === 'res-02' || q.id === 'res-03') return mkExam(q.id, q.domain, q.task, { requirements: q.requirements, variantOf: ['res-01'] });
  if (q.id === 'per-05' || q.id === 'per-06') return { ...q, variantOf: ['per-original-gone'] };
  if (['cos-30', 'cos-31', 'cos-32', 'cos-33'].includes(q.id)) return { ...q, outOfScope: true, pack: 'p-dev' };
  if (q.id === 'sec-39') return { ...q, status: 'draft' as const };
  if (q.id === 'sec-40') return { ...q, status: 'retired' as const };
  return q;
});
const bank = makeBank(standard);
const S1 = ['sec-10', 'sec-11', 'res-10', 'res-11', 'res-12', 'per-10', 'per-11', 'per-12', 'cos-10', 'cos-11'];
const S2 = ['sec-20', 'res-20', 'per-20', 'cos-20'];
const sealedState: SealedState = {
  forms: [
    { id: 'S1', ids: S1, status: 'sealed' },
    { id: 'S2', ids: S2, status: 'used', usedAt: new Date(NOW - DAY).toISOString(), attempt: 'a1' },
  ],
  size: 10,
};
const held = new Set(S1);
const OOS = new Set(['cos-30', 'cos-31', 'cos-32', 'cos-33']);

function ctxOf(o: Partial<SelectCtx> = {}): SelectCtx {
  return { bank, states: new Map(), cfg, plans: [], sealed: sealedState, goal: {}, ...o };
}

function seen(ids: string[], o: Partial<QuestionState> = {}, daysAgo = 2): Map<string, QuestionState> {
  return new Map(
    ids.map((id) => [id, { id, attempts: 1, correct: 1, everWrong: false, streak: 1, box: 1, avgTime: 30, slowCount: 0, wrongPicks: {}, lastAt: new Date(NOW - daysAgo * DAY).toISOString(), ...o }]),
  );
}

const ids = (s: TestSession) => s.questions.map((r) => r.id);
const family = (id: string) => select.variantFamilies(bank).get(id) ?? id;
const build = (req: BuildTestRequest, o: Partial<SelectCtx> = {}) => select.buildTest(req, ctxOf(o));

// ── newOrder ────────────────────────────────────────────────────────────────

it('newOrder: deterministic, interleaved by exam weight, stable within a domain, unknown domains last', () => {
  const qs = DOMAINS.flatMap((d) => Array.from({ length: 100 }, (_, i) => ({ id: `${d}-${i}`, domain: d })));
  const a = newOrder(qs, tax.domains).map((q) => q.id);
  assert.deepEqual(newOrder([...qs].reverse(), tax.domains).map((q) => q.id), a, 'input order does not matter');
  assert.deepEqual(newOrder(qs).map((q) => q.id), a, 'default weights = taxonomy weights');
  const mix = (k: number) => {
    const m: Record<string, number> = {};
    for (const id of a.slice(0, k)) m[id.split('-')[0]] = (m[id.split('-')[0]] ?? 0) + 1;
    return m;
  };
  assert.deepEqual(mix(10), { secure: 3, resilient: 3, performance: 2, cost: 2 });
  assert.deepEqual(mix(50), { secure: 15, resilient: 13, performance: 12, cost: 10 });
  assert.notDeepEqual(
    a.filter((id) => id.startsWith('secure-')),
    qs.filter((q) => q.domain === 'secure').map((q) => q.id),
    'within a domain: hash order, not id order',
  );
  // adding questions never reorders the existing ones of a domain
  const more = [...qs, ...DOMAINS.flatMap((d) => Array.from({ length: 30 }, (_, i) => ({ id: `${d}-new${i}`, domain: d })))];
  const b = newOrder(more, tax.domains).map((q) => q.id);
  for (const d of DOMAINS) {
    assert.deepEqual(
      b.filter((id) => id.startsWith(`${d}-`) && !id.includes('new')),
      a.filter((id) => id.startsWith(`${d}-`)),
      `${d}: relative order kept`,
    );
  }
  // a domain that runs out leaves its slots to the others
  const fewCost = [...qs.filter((q) => q.domain !== 'cost'), ...qs.filter((q) => q.domain === 'cost').slice(0, 2)];
  const c = newOrder(fewCost, tax.domains).map((q) => q.id);
  assert.equal(c.length, fewCost.length);
  assert.equal(c.slice(10).filter((id) => id.startsWith('cost-')).length, 0, 'both cost questions come early');
  // questions of an unknown domain (or without one) come last
  const odd = newOrder([...qs.slice(0, 5), { id: 'x-other', domain: 'other' }, { id: 'x-none' }] as { id: string; domain?: string }[], tax.domains);
  assert.deepEqual(odd.slice(-2).map((q) => q.id).sort(), ['x-none', 'x-other']);
});

it("mode 'new' serves the first N never-seen questions of newOrder (sealed and out-of-scope left out)", () => {
  const states = seen(['sec-03', 'res-04', 'per-07']);
  const s = build({ mode: 'new', count: 12, shuffleQuestions: false }, { states });
  const expected = newOrder(
    practicePool(bank.questions, { sealed: held, excludeOutOfScope: true }).filter((q) => !states.has(q.id)),
    tax.domains,
  )
    .slice(0, 12)
    .map((q) => q.id);
  assert.deepEqual(ids(s), expected);
  assert.deepEqual(new Set(ids(build({ mode: 'new', count: 12 }, { states }))), new Set(expected), 'the same questions on every build (display order shuffled)');
});

// ── sealed forms ────────────────────────────────────────────────────────────

it('sealed questions never appear outside their sealed exam: every mode, counts, ids/coach/pack with a note', () => {
  const sealedStates = seen(S1, { lastOk: false, lastFlag: true, slowCount: 2, avgTime: 200, dueAt: new Date(NOW - DAY).toISOString(), retrievability: 0.2 }, 3);
  const modes: TestMode[] = ['topic', 'custom', 'quick', 'new', 'weak', 'exam', 'diagnostic', 'retry-wrong', 'flagged', 'slow', 'srs'];
  for (const mode of modes) {
    for (let run = 0; run < 4; run++) {
      const s = build({ mode, count: 500 }, { states: sealedStates });
      assert.ok(!ids(s).some((id) => held.has(id)), `${mode} served a sealed question`);
    }
  }
  const pearson = build({ mode: 'exam', pearson: true });
  assert.ok(!ids(pearson).some((id) => held.has(id)), 'Pearson exam');

  const list = build({ mode: 'ids', ids: ['sec-10', 'sec-12', 'res-10', 'sec-13'] });
  assert.deepEqual(ids(list), ['sec-12', 'sec-13']);
  assert.ok(list.notes.includes('2 câu đang niêm phong đã được bỏ qua.'), list.notes.join(' | '));
  const plan = { id: 'p1', file: '', created: '', newPacks: [], body: '', sessions: [{ id: 's1', title: 'Vá lỗi', questions: ['per-10', 'per-13'] }] };
  const coach = build({ mode: 'coach', plan: 'p1#s1' }, { plans: [plan] });
  assert.deepEqual(ids(coach), ['per-13']);
  assert.match(coach.notes.join(' '), /1 câu đang niêm phong đã được bỏ qua/);
  const pack = build({ mode: 'pack', filters: { packs: ['p-main'] } });
  assert.ok(!ids(pack).some((id) => held.has(id)));
  assert.ok(pack.notes.includes(`${S1.length} câu đang niêm phong đã được bỏ qua.`), pack.notes.join(' | '));

  // a used form's questions are back in practice
  assert.ok(S2.every((id) => ids(build({ mode: 'custom', count: 500 })).includes(id)), 'used form → practice');

  const counts = select.modeCounts(ctxOf({ states: sealedStates }));
  const active = bank.questions.filter((q) => q.status === 'active');
  assert.equal(counts.sealed, S1.length);
  assert.equal(counts.all, active.length - S1.length - OOS.size);
  for (const k of ['retry-wrong', 'flagged', 'slow', 'srs']) assert.equal(counts[k], 0, `${k}: only sealed questions were eligible`);
  assert.equal(counts.new, active.length - S1.length - OOS.size);
});

it('sealed exam: the form as scored items + pilots from the practice pool, Pearson flags, honest clock', () => {
  const s = build({ mode: 'sealed' });
  assert.equal(s.mode, 'sealed');
  assert.equal(s.sealedForm, 'S1');
  assert.equal(s.pearson, true);
  assert.equal(s.feedback, 'exam');
  assert.equal(s.timingPreset, 'realistic');
  assert.match(s.title, /Đề niêm phong S1/);
  assert.equal((s.selection as BuildTestRequest).form, 'S1');
  const pilots = new Set(s.unscored);
  assert.equal(pilots.size, 3, '10 scored → 3 pilots (15 per 50)');
  assert.deepEqual(new Set(ids(s).filter((id) => !pilots.has(id))), held, 'scored = the form');
  for (const id of pilots) {
    const q = bank.byId.get(id)!;
    assert.ok(!held.has(id) && q.status === 'active' && !q.outOfScope, `pilot ${id} from the practice pool`);
  }
  assert.equal(s.realism?.total, 13);
  assert.ok(s.timeLimit >= s.estimateTotal && s.timeLimit <= 13 * 120);
  // explicit form · used / unknown form · nothing left · no forms at all
  assert.equal(build({ mode: 'sealed', form: 'S1' }).sealedForm, 'S1');
  assert.equal(build({ mode: 'sealed', form: ' S1 ' }).sealedForm, 'S1', 'trimmed');
  assert.equal(build({ mode: 'sealed', form: '' }).sealedForm, 'S1', 'empty = the next sealed form');
  const status = (e: unknown) => (e as { status?: number }).status;
  assert.throws(() => build({ mode: 'sealed', form: 'S2' }), (e: Error) => status(e) === 409 && /S2 đã được làm/.test(e.message));
  assert.throws(() => build({ mode: 'sealed', form: 'S9' }), (e: Error) => status(e) === 404);
  const allUsed: SealedState = { forms: sealedState.forms.map((f) => ({ ...f, status: 'used' as const })), size: 10 };
  assert.throws(() => build({ mode: 'sealed' }, { sealed: allUsed }), (e: Error) => status(e) === 409 && /Không còn đề niêm phong/.test(e.message));
  assert.throws(() => build({ mode: 'sealed' }, { sealed: { forms: [], size: 0 } }), (e: Error) => status(e) === 409 && /Chưa có đề niêm phong/.test(e.message));
  // ids of the form that are no longer active are left out with a note
  const b2 = makeBank(standard.map((q) => (q.id === 'res-11' ? { ...q, status: 'retired' as const } : q)));
  const partial = select.buildTest({ mode: 'sealed' }, ctxOf({ bank: b2 }));
  assert.equal(partial.questions.length - partial.unscored!.length, S1.length - 1);
  assert.match(partial.notes.join(' '), /1 câu của đề S1 không còn dùng được/);
});

it('sealed exam of 50: 15 pilots keeping the domain mix 4/4/4/3, never a variant relative of a scored item', () => {
  const big = DOMAINS.flatMap((d) => Array.from({ length: 60 }, (_, i) => mk(`${SHORT[d]}${i}`, d, tasksOf(d)[i % tasksOf(d).length])));
  const form = DOMAINS.flatMap((d, k) => big.filter((q) => q.domain === d).slice(0, [15, 13, 12, 10][k])).map((q) => q.id);
  // relatives of scored items sit in the practice pool: they must never be drawn as pilots
  const relatives = form.slice(0, 20).map((id, i) => mk(`rel-${i}`, bank.taxonomy.domains[i % 4].id, undefined, { variantOf: [id] }));
  const b = makeBank([...big, ...relatives]);
  const ctx = ctxOf({ bank: b, sealed: { forms: [{ id: 'S1', ids: form, status: 'sealed' }], size: 50 } });
  for (let run = 0; run < 10; run++) {
    const s = select.buildTest({ mode: 'sealed' }, ctx);
    assert.equal(s.questions.length, 65);
    assert.equal(s.unscored?.length, 15);
    const mix: Record<string, number> = {};
    for (const id of s.unscored!) mix[b.byId.get(id)!.domain] = (mix[b.byId.get(id)!.domain] ?? 0) + 1;
    assert.deepEqual(mix, { secure: 4, resilient: 4, performance: 4, cost: 3 });
    assert.ok(!s.unscored!.some((id) => id.startsWith('rel-')), 'no pilot is a variant of a scored item');
  }
});

// ── diagnostic ──────────────────────────────────────────────────────────────

it('diagnostic: 2 per task (28), deterministic, unseen first, exam feedback; sealed / out-of-scope excluded', () => {
  const s = build({ mode: 'diagnostic' });
  assert.equal(s.questions.length, 28);
  assert.equal(s.diagnostic, true);
  assert.equal(s.feedback, 'exam');
  assert.equal(s.timingPreset, 'standard');
  assert.equal(s.title, 'Chẩn đoán đầu vào (28 câu · 2 câu/task)');
  const perTask: Record<string, number> = {};
  for (const id of ids(s)) perTask[bank.byId.get(id)!.task!] = (perTask[bank.byId.get(id)!.task!] ?? 0) + 1;
  assert.deepEqual(Object.keys(perTask).sort(), tax.tasks.map((t) => t.id).sort());
  assert.ok(Object.values(perTask).every((n) => n === 2));
  assert.ok(!ids(s).some((id) => held.has(id) || OOS.has(id)));
  assert.equal(new Set(ids(s).map(family)).size, 28, 'never two questions of one variant family');
  for (let run = 0; run < 3; run++) assert.deepEqual(new Set(ids(build({ mode: 'diagnostic' }))), new Set(ids(s)), 'same questions every time');
  assert.equal(build({ mode: 'diagnostic', count: 'x' as unknown as number }).questions.length, 28, 'a malformed count falls back to the default');
  // never-seen questions come first
  const t11 = bank.questions.filter((q) => q.task === '1.1' && q.status === 'active' && !held.has(q.id)).map((q) => q.id);
  const states = seen(t11.slice(0, t11.length - 2));
  const fresh = ids(build({ mode: 'diagnostic' }, { states })).filter((id) => bank.byId.get(id)!.task === '1.1');
  assert.deepEqual(new Set(fresh), new Set(t11.slice(-2)));
});

it('diagnostic split 2×14: count 14 = 1 per task, the second sitting gets 14 other questions', () => {
  const first = build({ mode: 'diagnostic', count: 14 });
  assert.equal(first.questions.length, 14);
  assert.equal(new Set(ids(first).map((id) => bank.byId.get(id)!.task)).size, 14, 'one question per task');
  assert.equal(first.title, 'Chẩn đoán đầu vào (14 câu · 1 câu/task)');
  const second = build({ mode: 'diagnostic', count: 14 }, { states: seen(ids(first), {}, 0) });
  assert.equal(second.questions.length, 14);
  assert.equal(new Set(ids(second).map((id) => bank.byId.get(id)!.task)).size, 14);
  assert.ok(!ids(second).some((id) => ids(first).includes(id)), 'disjoint halves');
  // remainder: 16 → 2 extra questions for the tasks of the heaviest domain (D1)
  const q16 = taskQuotas(16, tax.tasks, tax.domains);
  assert.equal([...q16.values()].reduce((a, b) => a + b, 0), 16);
  assert.deepEqual([...q16].filter(([, n]) => n === 2).map(([t]) => t), ['1.1', '1.2']);
});

it('diagnostic: tasks without enough questions are reported, not filled from other tasks', () => {
  const thin = makeBank(standard.filter((q) => q.task !== '4.3' || q.id === 'cos-03'));
  const s = select.buildTest({ mode: 'diagnostic' }, ctxOf({ bank: thin }));
  assert.equal(s.questions.length, 27);
  assert.match(s.notes.join(' '), /Chưa đủ câu cho task 4\.3 \(1\/2\) — bài chẩn đoán có 27 câu\./);
  const none = select.buildTest({ mode: 'diagnostic' }, ctxOf({ bank: makeBank(standard.map((q) => ({ ...q, task: undefined }))) }));
  assert.equal(none.questions.length, 0);
  assert.match(none.notes.join(' '), /classify-tasks/);
});

// ── realism ─────────────────────────────────────────────────────────────────

it('realism: the exam-like rule, test realism and its badge text', () => {
  const longShort = mk('ls', 'secure', '1.1', { stem: examStem('ls') });
  const shortLong = mk('sl', 'secure', '1.1', { options: examOptions('sl') });
  const exam = mkExam('ex', 'secure', '1.1');
  assert.equal(realism.isExamLike(exam, tax), true);
  assert.equal(realism.isExamLike(longShort, tax), false, 'options must be full sentences');
  assert.equal(realism.isExamLike(shortLong, tax), false, 'the stem must be long');
  assert.equal(realism.isExamLike(exam, { timing: { long_form_min_words: 500 } }), false, 'threshold from the taxonomy');
  const r = realism.testRealism([exam, longShort, shortLong], tax);
  const expectedWords = [exam, longShort, shortLong].reduce((s, q) => s + countWords(q.stem) + q.options.reduce((t, o) => t + countWords(o.text), 0), 0);
  assert.deepEqual(r, { items: 1, total: 3, words: expectedWords, referenceWords: 345 });
  assert.equal(realism.realismText({ items: 3, total: 65, words: 2300, referenceWords: 7475 }), 'Giống đề thật 3/65 · 2.300/7.475 từ');
  assert.equal(realism.realismLow({ items: 3, total: 65, words: 2300, referenceWords: 7475 }), true);
  assert.equal(realism.realismLow({ items: 60, total: 65, words: 7000, referenceWords: 7475 }), false);
  assert.equal(realism.realismLow({ items: 60, total: 65, words: 4000, referenceWords: 7475 }), true, 'too little to read');
  assert.equal(realism.realismLow(undefined), false);
  assert.match(realism.realismTitle(r, tax), /1\/3 câu giống đề thật/);
  // every session carries its realism
  for (const mode of ['topic', 'exam', 'quick', 'diagnostic', 'sealed'] as TestMode[]) {
    const s = build({ mode, count: 30 });
    const qs = ids(s).map((id) => bank.byId.get(id)!);
    assert.deepEqual(s.realism, realism.testRealism(qs, tax), `${mode}: session.realism`);
  }
});

it('examPick prefers never-seen, then exam-like questions inside each domain quota', () => {
  const qs = DOMAINS.flatMap((d) => Array.from({ length: 30 }, (_, i) => (i < 6 ? mkExam(`${SHORT[d]}-e${i}`, d, undefined) : mk(`${SHORT[d]}-s${i}`, d, undefined))));
  const b = makeBank(qs);
  for (let run = 0; run < 5; run++) {
    const s = select.buildTest({ mode: 'exam', pearson: true }, ctxOf({ bank: b, sealed: { forms: [], size: 0 } }));
    const picked = new Set(ids(s));
    for (const q of qs) if (q.id.includes('-e')) assert.ok(picked.has(q.id), `exam-like ${q.id} preferred`);
    assert.equal(s.realism?.items, 24);
  }
  // a never-seen short question beats an exam-like one seen before
  const states = seen(qs.filter((q) => q.domain === 'cost' && q.id.includes('-e')).map((q) => q.id), {}, 30);
  const s = select.buildTest({ mode: 'exam', count: 65 }, ctxOf({ bank: b, states, sealed: { forms: [], size: 0 } }));
  const cost = ids(s).filter((id) => id.startsWith('cos-'));
  assert.equal(cost.length, 13);
  assert.ok(cost.every((id) => id.includes('-s')), 'cost quota filled with never-seen questions first');
});

// ── variant families ────────────────────────────────────────────────────────

it('a mock never holds a question together with its variant_of relative (either direction, siblings too)', () => {
  const fam = select.variantFamilies(bank);
  assert.equal(fam.get('sec-02'), fam.get('sec-01') ?? 'sec-01');
  assert.equal(family('res-02'), family('res-03'));
  assert.equal(family('res-03'), family('res-01'));
  assert.equal(family('per-05'), family('per-06'), 'siblings of a missing original');
  assert.notEqual(family('sec-03'), family('sec-01'));
  for (let run = 0; run < 30; run++) {
    const s = build(run % 2 ? { mode: 'exam', pearson: true } : { mode: 'exam', count: 120 });
    const f = ids(s).map(family);
    assert.equal(new Set(f).size, f.length, `run ${run}: two questions of one family`);
  }
  // exam-like variants are preferred → their originals are the ones left out
  const s = build({ mode: 'exam', pearson: true });
  assert.ok(ids(s).includes('sec-02') && !ids(s).includes('sec-01'));
  assert.equal(ids(s).filter((id) => ['res-01', 'res-02', 'res-03'].includes(id)).length, 1);
  // the quota cannot force a pair: a domain of 3 questions, two of them one family → 2 picked, rest from other domains
  const tiny = makeBank([
    mk('a1', 'secure', undefined),
    mk('a2', 'secure', undefined, { variantOf: ['a1'] }),
    mk('a3', 'secure', undefined),
    ...Array.from({ length: 20 }, (_, i) => mk(`b${i}`, 'resilient', undefined)),
  ]);
  const t = select.buildTest({ mode: 'exam', count: 10 }, ctxOf({ bank: tiny, sealed: { forms: [], size: 0 } }));
  assert.equal(t.questions.length, 10);
  assert.ok(!(ids(t).includes('a1') && ids(t).includes('a2')));
});

// ── clocks ──────────────────────────────────────────────────────────────────

it('realistic clock: reading load at the exam pace, clamped to [Σ estimates, 2′/question]; ESL × 160/130', () => {
  const R = (est: number, n: number, w: number, esl = false) => computeTimeLimit(est, n, 'realistic', undefined, tax.timing, { words: w, esl });
  assert.equal(R(600, 10, 300), 600, 'short items → Σ estimates');
  assert.equal(R(600, 10, 900), 960, '900 words × 120 s / 115 = 939 s → 960');
  assert.equal(R(600, 10, 1150), 1200, 'real-exam reading load → 2′/question');
  assert.equal(R(600, 10, 5000), 1200, 'never above 2′/question');
  assert.equal(R(600, 10, 900, true), 1170, '939 s × 160/130 = 1156 s → 1170');
  assert.equal(computeTimeLimit(1000, 65, 'official'), 65 * 120);
  assert.equal(computeTimeLimit(1000, 65, 'official', undefined, tax.timing, { esl: true }), 160 * 60, 'ESL: 130′ → 160′');
  assert.equal(computeTimeLimit(1000, 10, 'standard', undefined, tax.timing, { esl: true }), 1020, 'ESL scales only the exam-pace clocks');
  // defaults: full mocks and sealed forms → realistic; other modes → standard; an explicit preset wins
  const exam = build({ mode: 'exam', pearson: true });
  assert.equal(exam.timingPreset, 'realistic');
  assert.equal(exam.timeLimit, computeTimeLimit(exam.estimateTotal, 65, 'realistic', undefined, tax.timing, { words: exam.realism!.words }));
  assert.equal(build({ mode: 'exam', count: 20 }).timingPreset, 'realistic');
  assert.equal(build({ mode: 'topic', count: 10 }).timingPreset, 'standard');
  assert.equal(build({ mode: 'exam', pearson: true, timing: { preset: 'official' } }).timeLimit, 65 * 120);
  // goal.esl → ESL by default; the request can switch it off; never on the other clocks
  assert.equal(build({ mode: 'exam', pearson: true, timing: { preset: 'official' } }, { goal: { esl: true } }).timeLimit, 160 * 60);
  assert.equal(build({ mode: 'exam', pearson: true, timing: { preset: 'official', esl: false } }, { goal: { esl: true } }).timeLimit, 65 * 120);
  assert.equal(build({ mode: 'exam', pearson: true, timing: { preset: 'official', esl: true } }).timeLimit, 160 * 60);
  const stringy = { preset: 'official', esl: 'false' as unknown as boolean }; // not a boolean → the goal decides
  assert.equal(build({ mode: 'exam', pearson: true, timing: stringy }).timeLimit, 65 * 120);
  assert.equal(build({ mode: 'exam', pearson: true, timing: stringy }, { goal: { esl: true } }).timeLimit, 160 * 60);
  const plain = build({ mode: 'topic', count: 10, timing: { preset: 'standard' } }, { goal: { esl: true } });
  assert.equal(plain.timeLimit, computeTimeLimit(plain.estimateTotal, 10, 'standard'));
  const sealedEsl = build({ mode: 'sealed' }, { goal: { esl: true } });
  assert.equal(sealedEsl.timeLimit, computeTimeLimit(sealedEsl.estimateTotal, 13, 'realistic', undefined, tax.timing, { words: sealedEsl.realism!.words, esl: true }));
});

// ── filters: requirements, out of scope ─────────────────────────────────────

it('requirements filter: any of the chosen categories; the title names them', () => {
  const active = bank.questions.filter((q) => q.status === 'active');
  const cost = applyFilters(active, { requirements: ['cost'] });
  assert.ok(cost.length > 0 && cost.every((q) => q.requirements?.includes('cost')));
  const either = applyFilters(active, { requirements: ['cost', 'negative'] });
  assert.equal(either.length, active.filter((q) => q.requirements?.some((r) => r === 'cost' || r === 'negative')).length);
  assert.equal(applyFilters(active, { requirements: [] }).length, active.length, 'empty = no filter');
  const s = build({ mode: 'custom', count: 200, filters: { requirements: ['ops'] } });
  assert.ok(s.questions.length > 0 && ids(s).every((id) => bank.byId.get(id)!.requirements?.includes('ops')));
  assert.equal(s.title, 'Tùy chỉnh: Vận hành');
});

it('practice.exclude_out_of_scope: left out of every mode except explicit packs and ids lists', () => {
  for (const mode of ['topic', 'custom', 'exam', 'new', 'quick', 'weak', 'diagnostic'] as TestMode[]) {
    assert.ok(!ids(build({ mode, count: 500 })).some((id) => OOS.has(id)), `${mode} served an out-of-scope question`);
  }
  assert.deepEqual(new Set(ids(build({ mode: 'pack', filters: { packs: ['p-dev'] } }))), OOS, 'an explicit pack keeps them');
  assert.deepEqual(ids(build({ mode: 'ids', ids: ['cos-30', 'cos-01'] })), ['cos-30', 'cos-01'], 'an explicit list keeps them');
  const off = select.buildTest({ mode: 'custom', count: 500 }, ctxOf({ cfg: makeCfg({ exclude_out_of_scope: false }) }));
  assert.ok([...OOS].every((id) => ids(off).includes(id)), 'setting off → included');
  // a filter that lost questions to the setting says so; unfiltered modes stay quiet
  const topic = build({ mode: 'topic', count: 50, filters: { domains: ['cost'] } });
  assert.ok(topic.notes.includes('Bỏ qua 4 câu có đáp án là dịch vụ ngoài phạm vi đề thi (practice.exclude_out_of_scope).'), topic.notes.join(' | '));
  assert.ok(!build({ mode: 'quick' }).notes.some((n) => n.includes('phạm vi')));
  assert.equal(select.modeCounts(ctxOf()).outOfScope, OOS.size);
  assert.equal(select.modeCounts(ctxOf({ cfg: makeCfg({ exclude_out_of_scope: false }) })).outOfScope, 0);
});

// ── modeCounts previews ─────────────────────────────────────────────────────

it('modeCounts: exam and sealed-form previews (stable), exam-like count', () => {
  const c = select.modeCounts(ctxOf());
  assert.deepEqual(select.modeCounts(ctxOf()), c, 'previews do not change between calls');
  assert.equal(c['exam.total'], 65);
  assert.equal(c['exam.estimate'], 65 * 60);
  assert.ok(c['exam.words'] > 0);
  const examLike = bank.questions.filter((q) => q.status === 'active' && !held.has(q.id) && !OOS.has(q.id) && realism.isExamLike(q, tax));
  assert.equal(c.examLike, examLike.length);
  // every exam-like question of a different family fits the quotas here → all of them previewed
  assert.equal(c['exam.items'], new Set(examLike.map((q) => family(q.id))).size);
  assert.equal(c['sealed.S1.total'], 13);
  assert.equal(c['sealed.S1.pilots'], 3);
  assert.equal(c['sealed.S1.estimate'], 13 * 60);
  assert.equal(c['sealed.S2.total'], undefined, 'used forms have no preview');
  const none = select.modeCounts(ctxOf({ sealed: { forms: [], size: 0 } }));
  assert.equal(none.sealed, 0);
  assert.equal(Object.keys(none).filter((k) => k.startsWith('sealed.')).length, 0);
});
