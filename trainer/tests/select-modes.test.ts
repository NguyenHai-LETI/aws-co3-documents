// [v5 σ] Unit tests for the session rules and focused modes (server/lib/select-rules.ts, select-modes.ts, select.ts):
// one question per sibling cluster + today's siblings buried in every mode (exceptions: ids / pack / coach lists, retest,
// qualifier families; discriminate does not bury), modes discriminate / qualifier / yesterday / retest, their modeCounts,
// retestIds, weak picks on shrunk rates, session fields (relearn, source, phase) and the modes that are never built.
// In-memory bank + fake λ / γ1 helpers — never the real bank or results. Run: npm test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from '../server/config.ts';
import type { BankState } from '../server/lib/bank.ts';
import type { ClusterIndex } from '../server/lib/clusters.ts';
import type { SelectCtx, SelectDeps } from '../server/lib/select.ts';
import type { AnswerRecord, Attempt, ConfusableGroup, DomainId, Question, QuestionState, TestSession } from '../shared/types.ts';

const TRAINER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-modes-'));
fs.mkdirSync(path.join(HOME, 'bank', 'packs'), { recursive: true });
fs.copyFileSync(path.join(TRAINER, 'bank', 'taxonomy.yaml'), path.join(HOME, 'bank', 'taxonomy.yaml'));
process.env.TRAINER_HOME = HOME;
after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const { DATA_DIR } = await import('../server/config.ts');
const it = DATA_DIR === HOME ? test : test.skip;

const select = await import('../server/lib/select.ts');
const rules = await import('../server/lib/select-rules.ts');
const modes = await import('../server/lib/select-modes.ts');
const { retestIds } = await import('../shared/filters.ts');
const { loadTaxonomy } = await import('../server/lib/taxonomy.ts');

const tax = loadTaxonomy();
const DAY = 86_400_000;
const NOW = new Date(2026, 9, 20, 10, 0, 0).getTime();
const DOMAINS: DomainId[] = ['secure', 'resilient', 'performance', 'cost'];
const TOPICS = ['compute', 'storage', 'database', 'networking'];
const REQS = ['cost', 'ops', 'resilient', 'performance', 'secure'];

function makeCfg(practice: Partial<AppConfig['practice']> = {}): AppConfig {
  return {
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
    srs: { algorithm: 'fsrs', desired_retention: 0.9, daily_limit: 500, mastered_stability_days: 21, intervals_days: [1, 3, 7, 14, 30], mastered_box: 4, weights: [], optimize: 'off', optimize_min_reviews: 400, exam_aware: true, final_review_days: 7, new_cutoff_days: 10, load_balance: false, final_retention: 0, leech_lapses: 3, sibling_swap_days: 7 },
    practice: { default_count: 20, quick_count: 10, shuffle_options: true, exclude_out_of_scope: true, today_minutes: 25, relearn: true, ...practice },
    exam: { sealed_forms: 0, sealed_size: 50 },
    stats: { rushed_median_seconds: 5, recency_half_life_days: 14, recognized_wpm: 300 },
    quality: { embeddings: 'off', ollama_url: '', embedding_model: '', semantic_threshold: 0.88, longform_target_per_task: 12 },
    server: { lan: false, lan_admin: false, https: 'off', https_cert: '', https_key: '' },
    export: { anki_deck: 'test', ankiconnect_url: '' },
    cache: { sqlite: false },
    sync: { data_paths: [], before_ai: false, after_ai: false, auto: 'off', auto_delay_minutes: 4 },
  };
}

const qid = (i: number) => `m${String(i).padStart(3, '0')}`;
function mk(i: number, o: Partial<Question> = {}): Question {
  const id = qid(i);
  return {
    id,
    pack: 'p',
    stem: `Case ${id}?`,
    options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Option ${key}` })),
    answer: ['A'],
    explanation: '',
    domain: DOMAINS[i % 4],
    topic: TOPICS[i % 4],
    services: [],
    tags: [],
    difficulty: 'medium',
    time: 60,
    timeEstimated: false,
    status: 'active',
    origin: 'manual',
    variantOf: [],
    refs: [],
    words: 2,
    longForm: false,
    hash: id,
    file: 'x.md',
    line: 1,
    requirements: i <= 50 ? [REQS[i % 5]] : undefined,
    ...o,
  };
}
const makeBank = (qs: Question[]): BankState => ({ version: `t${qs.length}`, taxonomy: tax, packs: [], questions: qs, byId: new Map(qs.map((q) => [q.id, q])), problems: [] });
const BANK = makeBank(Array.from({ length: 100 }, (_, i) => mk(i + 1)));

function clusters(bank: BankState, groups: string[][] = []): ClusterIndex {
  const of = new Map<string, string>();
  const members = new Map<string, string[]>();
  for (const g of groups) {
    const c = [...g].sort()[0];
    members.set(c, g);
    for (const x of g) of.set(x, c);
  }
  for (const q of bank.questions) if (!of.has(q.id)) (of.set(q.id, q.id), members.set(q.id, [q.id]));
  return { version: bank.version, of, members, links: new Map() };
}

function st(id: string, o: Partial<QuestionState> = {}): [string, QuestionState] {
  return [id, { id, attempts: 1, correct: 1, everWrong: false, streak: 1, box: 2, avgTime: 50, slowCount: 0, wrongPicks: {}, lastAt: new Date(NOW - 3 * DAY).toISOString(), lastOk: true, stability: 3, retrievability: 0.95, dueAt: new Date(NOW + 5 * DAY).toISOString(), ...o }];
}
const ans = (q: string, ok: boolean, extra: Partial<AnswerRecord> = {}): AnswerRecord => ({ q, pick: ok ? 'A' : 'B', key: 'A', ok, t: 40, est: 60, ...extra });
let n = 0;
const attempt = (daysAgo: number, answers: AnswerRecord[], extra: Partial<Attempt> = {}): Attempt =>
  ({ id: `att-${++n}`, mode: 'custom', title: `Bài ${n}`, finished: new Date(NOW - daysAgo * DAY).toISOString(), answers, ...extra }) as Attempt;

interface Opts {
  bank?: BankState;
  states?: [string, QuestionState][];
  attempts?: Attempt[];
  deps?: Partial<SelectDeps>;
  groups?: string[][];
  cfg?: AppConfig;
  sealed?: SelectCtx['sealed'];
}
function ctxOf(o: Opts = {}): SelectCtx {
  const bank = o.bank ?? BANK;
  return {
    bank,
    states: new Map(o.states ?? []),
    cfg: o.cfg ?? makeCfg(),
    plans: [],
    attempts: o.attempts ?? [],
    sealed: o.sealed ?? { forms: [], size: 0 },
    goal: {},
    now: NOW,
    clusters: clusters(bank, o.groups),
    deps: { pace: () => 1, phase: () => undefined, quota: () => undefined, advance: () => [], paused: () => new Set(), contrastPool: () => [], confusableGroups: () => [], ...o.deps },
  };
}
const ids = (s: TestSession) => s.questions.map((r) => r.id);

// ── cluster rules in every mode ─────────────────────────────────────────────

it('every filter mode: one question per cluster, siblings of today’s answers buried; explicit lists exempt', () => {
  const groups = [[qid(1), qid(2), qid(3)], [qid(10), qid(11)], [qid(20), qid(21)]];
  const states = [st(qid(1), { lastOk: false, lastFlag: true, slowCount: 2, avgTime: 200 }), st(qid(2), { lastOk: false, lastFlag: true, slowCount: 2, avgTime: 200 }), st(qid(10), { lastOk: false })];
  const attempts = [attempt(0, [ans(qid(20), true)])];
  const ctx = ctxOf({ groups, states, attempts });
  for (const mode of ['custom', 'topic', 'quick', 'weak', 'new', 'retry-wrong', 'flagged', 'slow', 'exam', 'qualifier'] as const) {
    for (let run = 0; run < 3; run++) {
      const s = select.buildTest({ mode, count: 500 }, ctx);
      const keys = ids(s).map((x) => ctx.clusters!.of.get(x));
      assert.equal(new Set(keys).size, keys.length, `${mode}: two questions of one cluster`);
      assert.ok(!ids(s).includes(qid(21)), `${mode}: sibling of a question answered today`);
    }
  }
  assert.deepEqual(ids(select.buildTest({ mode: 'retry-wrong' }, ctx)).length, 2, 'q1/q2 one cluster + q10');
  // explicit lists keep siblings
  assert.deepEqual(ids(select.buildTest({ mode: 'ids', ids: [qid(1), qid(2), qid(21)] }, ctx)), [qid(1), qid(2), qid(21)]);
  // the question answered today itself is not buried (retry right after a test)
  const retry = ctxOf({ groups, states: [st(qid(20), { lastOk: false })], attempts });
  assert.deepEqual(ids(select.buildTest({ mode: 'retry-wrong' }, retry)), [qid(20)]);
  // variants of a deleted original are siblings too
  const vb = makeBank([...BANK.questions.slice(0, 40), mk(200, { variantOf: ['gone'] }), mk(201, { variantOf: ['gone'] })]);
  const v = select.buildTest({ mode: 'custom', count: 500 }, ctxOf({ bank: vb }));
  assert.ok(!(ids(v).includes(qid(200)) && ids(v).includes(qid(201))));
});

it('srs: buried siblings, one per cluster (note), modeCounts srs = served; anki / listen / micro are not built', () => {
  const due = (id: string, r: number) => st(id, { retrievability: r, dueAt: new Date(NOW - DAY).toISOString() });
  const ctx = ctxOf({ groups: [[qid(1), qid(2)], [qid(5), qid(6)]], states: [due(qid(1), 0.5), due(qid(2), 0.6), due(qid(3), 0.7), due(qid(5), 0.8)], attempts: [attempt(0, [ans(qid(6), true)])] });
  const s = select.buildTest({ mode: 'srs', shuffleQuestions: false }, ctx);
  assert.deepEqual(new Set(ids(s)), new Set([qid(1), qid(3)]));
  assert.match(s.notes.join(' '), /1 câu đến hạn là câu anh em/);
  const c = select.modeCounts(ctx);
  assert.equal(c.srs, 2);
  assert.equal(c.backlog, 1, 'q2 waits (q5 is buried, not due today)');
  for (const mode of ['anki', 'listen', 'micro'] as const) assert.throws(() => select.buildTest({ mode }, ctx), (e: Error & { status?: number }) => e.status === 400);
});

it('session fields: relearn on practice feedback only, source validated, phase from the exam schedule', () => {
  const ctx = ctxOf({ deps: { phase: () => ({ id: 'build', label: 'Xây nền', daysLeft: 30, rules: [], newQuestions: true }) } });
  assert.equal(select.buildTest({ mode: 'quick' }, ctx).relearn, true);
  assert.equal(select.buildTest({ mode: 'custom', feedback: 'practice' }, ctx).relearn, true);
  assert.equal(select.buildTest({ mode: 'custom' }, ctx).relearn, undefined, 'exam feedback');
  assert.equal(select.buildTest({ mode: 'exam', feedback: 'practice' }, ctx).relearn, undefined, 'never in mocks');
  assert.equal(select.buildTest({ mode: 'quick', relearn: false }, ctx).relearn, undefined);
  assert.equal(select.buildTest({ mode: 'quick' }, ctxOf({ cfg: makeCfg({ relearn: false }) })).relearn, undefined);
  assert.equal(select.buildTest({ mode: 'quick', source: 'chat' }, ctx).source, 'chat');
  assert.equal(select.buildTest({ mode: 'quick', source: 'evil' as never }, ctx).source, undefined);
  assert.equal(select.buildTest({ mode: 'quick' }, ctx).phase, 'build');
  assert.equal(select.buildTest({ mode: 'quick' }, ctxOf()).phase, undefined);
});

// ── discriminate ────────────────────────────────────────────────────────────

it('discriminate: the correct service alternates, one per cluster, default 12, default group = first not separated', () => {
  const pool = (_b: BankState, services: string[]) =>
    BANK.questions.slice(0, 40).map((q, i) => ({ question: q, answerService: i < 30 ? services[0] : services[1] }));
  const groups: ConfusableGroup[] = [
    { id: 'g1', services: ['SNS', 'SQS'], questions: 30, pairs: [], learner: { answers: 10, correct: 9, last10: 9, separated: true } },
    { id: 'g2', services: ['Athena', 'EMR'], questions: 20, pairs: [] },
  ];
  const ctx = ctxOf({ groups: [[qid(1), qid(3)]], deps: { contrastPool: pool, confusableGroups: () => groups } });
  const s = select.buildTest({ mode: 'discriminate', contrast: ['SNS', 'SQS'] }, ctx);
  assert.equal(s.questions.length, 12);
  assert.deepEqual(s.contrast, ['SNS', 'SQS']);
  assert.equal(s.feedback, 'practice');
  assert.equal(s.title, '🔀 Phân biệt: SNS ⟷ SQS');
  const service = (id: string) => (BANK.questions.findIndex((q) => q.id === id) < 30 ? 'SNS' : 'SQS');
  const order = ids(s).map(service);
  for (let i = 1; i < order.length; i++) assert.notEqual(order[i], order[i - 1], `alternates at ${i}`);
  assert.ok(!(ids(s).includes(qid(1)) && ids(s).includes(qid(3))), 'one per cluster');
  // once one service runs out the rest follows
  assert.equal(select.buildTest({ mode: 'discriminate', contrast: ['SNS', 'SQS'], count: 40 }, ctx).questions.length, 39);
  // no contrast → the first group not separated yet
  assert.deepEqual(select.buildTest({ mode: 'discriminate' }, ctx).contrast, ['Athena', 'EMR']);
  assert.match(select.buildTest({ mode: 'discriminate', contrast: ['SNS', 'SQS'] }, ctxOf()).notes.join(' '), /Chưa có câu luyện nào/);
  assert.match(select.buildTest({ mode: 'discriminate' }, ctxOf()).notes.join(' '), /Chưa tìm thấy cặp/);
  assert.deepEqual(modes.cleanContrast([' SNS ', 'SNS', '', 3, 'SQS', 'a', 'b', 'c']), ['SNS', 'SQS', 'a', 'b']);
});

// ── qualifier ───────────────────────────────────────────────────────────────

it('qualifier: families first with members ≥ 5 apart, then balanced requirement questions; squeezed only when nothing else', () => {
  const famQs = BANK.questions.map((q, i) => (i >= 60 && i < 69 ? { ...q, family: `F${Math.floor((i - 60) / 3)}`, requirements: undefined } : q));
  const bank = makeBank(famQs);
  const s = select.buildTest({ mode: 'qualifier', count: 20 }, ctxOf({ bank, groups: [famQs.slice(60, 63).map((q) => q.id)] }));
  assert.equal(s.questions.length, 20);
  assert.equal(s.feedback, 'practice');
  const pos = new Map<string, number[]>();
  ids(s).forEach((id, i) => {
    const f = bank.byId.get(id)!.family;
    if (f) pos.set(f, [...(pos.get(f) ?? []), i]);
  });
  assert.equal(pos.size, 3, 'three families, members together in one session (exempt from one per cluster)');
  for (const [f, p] of pos) {
    assert.equal(p.length, 3, `${f} complete`);
    for (let i = 1; i < p.length; i++) assert.ok(p[i] - p[i - 1] >= 5, `${f}: members ${p} at least 5 apart`);
  }
  const singles = ids(s).filter((id) => !bank.byId.get(id)!.family);
  const cats = singles.map((id) => bank.byId.get(id)!.requirements![0]);
  assert.ok(cats.every((c) => REQS.includes(c)));
  assert.ok(new Set(cats.slice(0, 5)).size === 5, 'balanced: the first five singles cover the five categories');
  // spaceFamilies alone: two families of 2, nothing else → squeezed
  const fam = (p: string) => [mk(1, { id: `${p}1` }), mk(2, { id: `${p}2` })];
  const r = modes.spaceFamilies([fam('a'), fam('b')], [], 10, 5, (q) => q.id);
  assert.deepEqual(r.order.map((q) => q.id), ['a1', 'b1', 'a2', 'b2']);
  assert.equal(r.squeezed, 2);
  // no family can finish in a short session → only singles
  assert.deepEqual(modes.spaceFamilies([[mk(1), mk(2), mk(3)]], [mk(4), mk(5)], 3, 5, (q) => q.id).order.map((q) => q.id), [qid(4), qid(5)]);
  // fallback note without families; counts
  assert.match(select.buildTest({ mode: 'qualifier' }, ctxOf()).notes.join(' '), /chưa có họ câu/);
  const c = select.modeCounts(ctxOf({ bank }));
  assert.equal(c['qualifier.families'], 3);
  assert.ok(c.qualifier >= 9 + 40);
});

// ── yesterday ───────────────────────────────────────────────────────────────

it('yesterday: wrong / unsure / hinted yesterday, confident errors first, not answered today, cap 8; counts', () => {
  const y = 1; // NOW 10:00 − 1 day = yesterday 10:00
  const attempts = [
    attempt(y, [ans(qid(1), true, { unsure: true }), ans(qid(2), false, { unsure: true }), ans(qid(3), false), ans(qid(4), true), ans(qid(5), true, { hinted: true })]),
    attempt(y, [ans(qid(6), false, { relearn: true }), ans(qid(7), false, { skipped: true, pick: '', t: 3 })]),
    attempt(y, [ans(qid(8), false), ...Array.from({ length: 10 }, (_, i) => ans(qid(20 + i), false))]),
    attempt(2, [ans(qid(9), false)]),
    attempt(0, [ans(qid(8), true)]), // done again today
  ];
  const ctx = ctxOf({ attempts });
  const all = modes.yesterdayList(ctx, rules.sessionRules(ctx), new Set(BANK.questions.map((q) => q.id))).map((q) => q.id);
  assert.ok(!all.includes(qid(4)) && !all.includes(qid(6)) && !all.includes(qid(7)) && !all.includes(qid(9)) && !all.includes(qid(8)));
  assert.ok(all.indexOf(qid(3)) < all.indexOf(qid(2)), `confident error before an unsure error: ${all}`);
  assert.ok(all.indexOf(qid(2)) < all.indexOf(qid(1)) && all.indexOf(qid(2)) < all.indexOf(qid(5)), 'errors before unsure / hinted right answers');
  const s = select.buildTest({ mode: 'yesterday' }, ctx);
  assert.equal(s.questions.length, 8);
  assert.equal(s.feedback, 'practice');
  assert.equal(s.title, `☀️ Ôn lại lỗi hôm qua (8 câu)`);
  const c = select.modeCounts(ctx);
  assert.equal(c.yesterday, 8);
  assert.equal(c['yesterday.all'], all.length);
  assert.equal(c['yesterday.estimate'], 8 * 60);
  assert.match(select.buildTest({ mode: 'yesterday' }, ctxOf()).notes.join(' '), /Không có câu sai/);
});

// ── retest ──────────────────────────────────────────────────────────────────

it('retestIds + retest: wrong + unsure of one attempt, confident errors first, options always reshuffled', () => {
  const answers: AnswerRecord[] = [
    ans(qid(1), true, { unsure: true }),
    ans(qid(2), false, { unsure: true }),
    ans(qid(3), false),
    ans(qid(4), true),
    ans(qid(5), false, { pick: '', t: 0 }), // never viewed
    ans(qid(6), false, { pick: '', t: 20 }), // viewed blank
    ans(qid(7), false, { skipped: true }),
    ans(qid(3), true, { relearn: true }),
    ans(qid(8), false, { hinted: true }),
  ];
  assert.deepEqual(retestIds(answers), [qid(3), qid(2), qid(6), qid(8), qid(1)]);
  const a = attempt(0, answers, { title: 'Ôn 20 câu' });
  const ctx = ctxOf({ attempts: [a], sealed: { forms: [{ id: 'S1', ids: [qid(8)], status: 'sealed' }], size: 1 } });
  const s = select.buildTest({ mode: 'retest', retestOf: a.id, shuffleOptions: false }, ctx);
  assert.deepEqual(new Set(ids(s)), new Set([qid(3), qid(2), qid(6), qid(1)]), 'sealed q8 skipped');
  assert.match(s.notes.join(' '), /Bỏ qua 1 câu/);
  assert.equal(s.retestOf, a.id);
  assert.equal(s.feedback, 'practice');
  assert.ok(s.questions.every((r) => r.order?.length === 4), 'options reshuffled even with shuffleOptions: false');
  assert.equal(s.title, '🩹 Kiểm tra lại sau khi chữa: Ôn 20 câu');
  assert.equal(select.modeCounts(ctx).retest, 5, 'latest attempt');
  assert.throws(() => select.buildTest({ mode: 'retest' }, ctx), (e: Error & { status?: number }) => e.status === 400);
  assert.throws(() => select.buildTest({ mode: 'retest', retestOf: 'nope' }, ctx), (e: Error & { status?: number }) => e.status === 404);
});

// ── weak picks (C8) ─────────────────────────────────────────────────────────

it('weakWeight: shrunk rates — one wrong answer is not a weakness, a large weak bucket is', () => {
  // topic compute: 0/1 · storage: 8/40 · database: 60/60 (raises the learner's base rate)
  const bank = makeBank([
    mk(1, { topic: 'compute' }),
    mk(2, { topic: 'storage' }),
    mk(3, { topic: 'database' }),
    mk(10, { topic: 'compute' }),
    mk(11, { topic: 'storage' }),
  ]);
  const states = new Map<string, QuestionState>([
    st(qid(1), { attempts: 1, correct: 0 }),
    st(qid(2), { attempts: 40, correct: 8 }),
    st(qid(3), { attempts: 60, correct: 60 }),
  ]);
  const w = rules.weakWeight({ ...ctxOf({ bank }), states });
  assert.ok(w(bank.byId.get(qid(11))!) > w(bank.byId.get(qid(10))!), 'storage (8/40) weaker than compute (0/1)');
  assert.ok(rules.baseRate(states) > 0.6);
});
