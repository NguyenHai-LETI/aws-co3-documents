// [v5 σ] Unit tests for "▶ Học hôm nay" (server/lib/today.ts): budget arithmetic and pace, the shares (retry ≤ 20 %,
// review ≤ 50 % within srs.daily_limit, weak / new halves, quick fill), determinism, exam phases, the new-question quota,
// sibling clusters (one per cluster, never a question answered today nor a sibling of one), sibling substitution,
// parked leeches, interleaving, the fresh coach session, the value model, the preview and micro candidates.
// In-memory bank + fake λ / γ1 helpers (SelectCtx.deps / clusters) — never the real bank or results. Run: npm test
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
import type { AnswerRecord, Attempt, DomainId, ExamPhaseInfo, Plan, Question, QuestionState } from '../shared/types.ts';

const TRAINER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-today-'));
fs.mkdirSync(path.join(HOME, 'bank', 'packs'), { recursive: true });
fs.copyFileSync(path.join(TRAINER, 'bank', 'taxonomy.yaml'), path.join(HOME, 'bank', 'taxonomy.yaml'));
process.env.TRAINER_HOME = HOME; // before config.ts is imported (dynamic imports below)
after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const { DATA_DIR } = await import('../server/config.ts');
const it = DATA_DIR === HOME ? test : test.skip;

const today = await import('../server/lib/today.ts');
const select = await import('../server/lib/select.ts');
const rules = await import('../server/lib/select-rules.ts');
const { loadTaxonomy } = await import('../server/lib/taxonomy.ts');

const tax = loadTaxonomy();
const DAY = 86_400_000;
const NOW = new Date(2026, 9, 20, 10, 0, 0).getTime(); // local 2026-10-20 10:00
const DOMAINS: DomainId[] = ['secure', 'resilient', 'performance', 'cost'];
const TOPICS = ['compute', 'storage', 'database', 'networking', 'security', 'integration'];

function makeCfg(srs: Partial<AppConfig['srs']> = {}, practice: Partial<AppConfig['practice']> = {}): AppConfig {
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
      verify: { auto: false, auto_draft: false, batch_size: 10, grounded: false, local_model: '', probe_model: 'haiku' },
    },
    srs: {
      algorithm: 'fsrs',
      desired_retention: 0.9,
      daily_limit: 500,
      mastered_stability_days: 21,
      intervals_days: [1, 3, 7, 14, 30],
      mastered_box: 4,
      weights: [],
      optimize: 'off',
      optimize_min_reviews: 400,
      exam_aware: true,
      final_review_days: 7,
      new_cutoff_days: 10,
      load_balance: false,
      final_retention: 0,
      leech_lapses: 3,
      sibling_swap_days: 7,
      ...srs,
    },
    practice: { default_count: 20, quick_count: 10, shuffle_options: true, exclude_out_of_scope: true, today_minutes: 25, relearn: true, ...practice },
    exam: { sealed_forms: 0, sealed_size: 50 },
    stats: { rushed_median_seconds: 5, recency_half_life_days: 14, recognized_wpm: 300 },
    quality: { embeddings: 'off', ollama_url: '', embedding_model: '', semantic_threshold: 0.88, longform_target_per_task: 12, exam_spec_since: '2026-10-22' },
    server: { lan: false, lan_admin: false, https: 'off', https_cert: '', https_key: '' },
    export: { anki_deck: 'test', ankiconnect_url: '' },
    cache: { sqlite: false },
    sync: { data_paths: [], before_ai: false, after_ai: false, auto: 'off', auto_delay_minutes: 4 },
  };
}

const tasksOf = (d: DomainId) => tax.tasks.filter((t) => t.domain === d).map((t) => t.id);

/** 120 questions: domains round robin, 6 topics, tasks of the domain, 60 s each, short distinct stems. */
function mk(i: number, o: Partial<Question> = {}): Question {
  const id = `q${String(i).padStart(3, '0')}`;
  const domain = DOMAINS[i % 4];
  const stem = o.stem ?? `Case ${id} about item ${i * 7} needs a design choice?`;
  return {
    id,
    pack: 'p',
    stem,
    options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Option ${key} ${id}` })),
    answer: ['A'],
    explanation: '',
    domain,
    topic: TOPICS[i % TOPICS.length],
    services: [],
    tags: [],
    difficulty: 'medium',
    time: 60,
    timeEstimated: false,
    status: 'active',
    origin: 'manual',
    variantOf: [],
    refs: [],
    task: tasksOf(domain)[Math.floor(i / 4) % tasksOf(domain).length],
    words: stem.split(/\s+/).length,
    longForm: false,
    hash: id,
    file: 'x.md',
    line: 1,
    ...o,
  };
}

function makeBank(qs: Question[]): BankState {
  return { version: `t-${qs.length}`, taxonomy: tax, packs: [], questions: qs, byId: new Map(qs.map((q) => [q.id, q])), problems: [] };
}

const BANK = makeBank(Array.from({ length: 120 }, (_, i) => mk(i + 1)));
const id = (i: number) => `q${String(i).padStart(3, '0')}`;

/** Cluster index from explicit groups (every other question alone). */
function clusters(bank: BankState, groups: string[][] = []): ClusterIndex {
  const of = new Map<string, string>();
  const members = new Map<string, string[]>();
  for (const g of groups) {
    const c = [...g].sort()[0];
    members.set(c, g);
    for (const x of g) of.set(x, c);
  }
  for (const q of bank.questions) {
    if (of.has(q.id)) continue;
    of.set(q.id, q.id);
    members.set(q.id, [q.id]);
  }
  return { version: bank.version, of, members, links: new Map() };
}

/** A seen question: last answer `daysAgo` days ago; due when `due` (R given), else due in 10 days. */
function st(qid: string, o: Partial<QuestionState> & { due?: boolean; daysAgo?: number } = {}): [string, QuestionState] {
  const { due, daysAgo = 5, ...rest } = o;
  return [
    qid,
    {
      id: qid,
      attempts: 1,
      correct: 1,
      everWrong: false,
      streak: 1,
      box: 2,
      avgTime: 50,
      slowCount: 0,
      wrongPicks: {},
      lastAt: new Date(NOW - daysAgo * DAY).toISOString(),
      lastOk: true,
      stability: 3,
      retrievability: due ? 0.7 : 0.95,
      dueAt: new Date(due ? NOW - DAY : NOW + 10 * DAY).toISOString(),
      ...rest,
    },
  ];
}

const ans = (q: string, ok: boolean, extra: Partial<AnswerRecord> = {}): AnswerRecord => ({ q, pick: ok ? 'A' : 'B', key: 'A', ok, t: 50, est: 60, ...extra });
let attemptN = 0;
function attempt(daysAgo: number, answers: AnswerRecord[], extra: Partial<Attempt> = {}): Attempt {
  return { id: `a${++attemptN}`, mode: 'custom', title: 't', finished: new Date(NOW - daysAgo * DAY).toISOString(), answers, ...extra } as Attempt;
}

const BASE_DEPS: Partial<SelectDeps> = {
  pace: () => 1,
  phase: () => undefined,
  quota: () => undefined,
  advance: () => [],
  paused: () => new Set(),
  contrastPool: () => [],
  confusableGroups: () => [],
};

interface Opts {
  bank?: BankState;
  states?: [string, QuestionState][];
  attempts?: Attempt[];
  deps?: Partial<SelectDeps>;
  groups?: string[][];
  cfg?: AppConfig;
  plans?: Plan[];
  now?: number;
  goal?: SelectCtx['goal'];
}
function ctxOf(o: Opts = {}): SelectCtx {
  const bank = o.bank ?? BANK;
  return {
    bank,
    states: new Map(o.states ?? []),
    cfg: o.cfg ?? makeCfg(),
    plans: o.plans ?? [],
    attempts: o.attempts ?? [],
    sealed: { forms: [], size: 0 },
    goal: o.goal ?? {},
    now: o.now ?? NOW,
    clusters: clusters(bank, o.groups),
    deps: { ...BASE_DEPS, ...o.deps },
  };
}

const served = (p: { items: { q: Question }[] }) => p.items.map((x) => x.q.id);
const shareOf = (p: { items: { q: Question; share: string }[] }, s: string) => p.items.filter((x) => x.share === s).map((x) => x.q.id);

// ── budget ──────────────────────────────────────────────────────────────────

it('budget: minutes × 60 filled within half a question; pace scales the cost; request > goal > config', () => {
  const p = today.composeToday(ctxOf(), 25);
  assert.equal(p.minutes, 25);
  assert.equal(p.mix.pace, 1);
  assert.ok(Math.abs(p.mix.seconds - 1500) <= 30, `seconds ${p.mix.seconds}`);
  assert.equal(p.items.length, p.mix.seconds / 60);
  const slow = today.composeToday(ctxOf({ deps: { pace: () => 1.5 } }), 25);
  assert.equal(slow.mix.pace, 1.5);
  assert.ok(Math.abs(slow.mix.seconds - 1500) <= 45);
  assert.ok(slow.items.length < p.items.length, 'a slower learner gets fewer questions');
  assert.equal(today.composeToday(ctxOf({ goal: { minutesPerDay: 10 } })).minutes, 10, 'goal.minutesPerDay');
  assert.equal(today.composeToday(ctxOf({ cfg: makeCfg({}, { today_minutes: 15 }) })).minutes, 15, 'practice.today_minutes');
  assert.equal(today.composeToday(ctxOf({ goal: { minutesPerDay: 10 } }), 45).minutes, 45, 'the request wins');
  assert.equal(today.todayMinutes(ctxOf(), Number.NaN), 25);
  assert.equal(today.todayMinutes(ctxOf(), 9999), today.TODAY_MAX_MINUTES);
  // a tiny budget still gets one question
  const tiny = today.composeToday(ctxOf({ bank: makeBank(BANK.questions.map((q) => ({ ...q, time: 180 }))) }), 1);
  assert.equal(tiny.items.length, 1);
});

it('shares: retry ≤ 20 %, review ≤ 50 % (within srs.daily_limit), the rest weak / new; mix + label', () => {
  // 10 wrong yesterday (not due), 30 due reviews, the others never seen
  const wrongIds = Array.from({ length: 10 }, (_, i) => id(i + 1));
  const dueIds = Array.from({ length: 30 }, (_, i) => id(i + 11));
  const states = [...wrongIds.map((x) => st(x, { lastOk: false, daysAgo: 1 })), ...dueIds.map((x) => st(x, { due: true }))];
  const attempts = [attempt(1, wrongIds.map((x) => ans(x, false)))];
  const p = today.composeToday(ctxOf({ states, attempts }), 25);
  const retry = shareOf(p, 'retry');
  const review = shareOf(p, 'review');
  assert.ok(retry.length > 0 && retry.length * 60 <= 0.2 * 1500 + 30, `retry ${retry.length}`);
  assert.ok(retry.every((x) => wrongIds.includes(x)));
  assert.ok(review.length > 0 && review.length * 60 <= 0.5 * 1500 + 30, `review ${review.length}`);
  assert.ok(review.every((x) => dueIds.includes(x)));
  assert.ok(p.mix.weak + p.mix.new > 0, 'the rest goes to weak / new');
  assert.equal(p.mix.retry, retry.length);
  assert.equal(p.mix.review, review.length);
  assert.equal(p.items.length, p.mix.retry + p.mix.review + p.mix.weak + p.mix.new + p.mix.advance + (p.mix.extra ?? 0));
  assert.match(p.label, /^25′ · \d+ câu \(\d+ ôn · \d+ làm lại/);
  if (p.mix.weak) assert.ok(p.mix.weakTasks?.length, 'weak tasks named');
  // srs.daily_limit caps the review share (note says so when it is reached)
  const capped = today.composeToday(ctxOf({ states, attempts, cfg: makeCfg({ daily_limit: 3 }) }), 25);
  assert.equal(shareOf(capped, 'review').length, 3);
  const none = today.composeToday(
    ctxOf({ states, attempts: [...attempts, attempt(0, [ans(id(100), true), ans(id(101), true)], { mode: 'srs' })], cfg: makeCfg({ daily_limit: 2 }) }),
    25,
  );
  assert.equal(none.mix.review, 0);
  assert.match(none.notes.join(' '), /Đã ôn đủ 2 câu/);
});

it('retry: latest answer counts; retest misses first, then confident errors; unsure / hinted right answers last', () => {
  const states = [id(1), id(2), id(3), id(4), id(5)].map((x) => st(x, { daysAgo: 1 }));
  const attempts = [
    attempt(2, [ans(id(1), false), ans(id(5), false)]), // q1 then fixed yesterday; q5 wrong 2 days ago
    attempt(1, [ans(id(1), true), ans(id(2), true, { unsure: true }), ans(id(3), false, { unsure: true })]),
    attempt(1, [ans(id(4), false)], { mode: 'retest' }),
    attempt(6, [ans(id(6), false)]), // too old
  ];
  const p = today.composeToday(ctxOf({ states, attempts }), 45);
  const retry = shareOf(p, 'retry');
  assert.ok(!retry.includes(id(1)), 'fixed by a later answer');
  assert.ok(!retry.includes(id(6)), 'older than 3 days');
  // order inside the share: retest miss (q4) → confident error (q5) → other error (q3) → unsure right (q2)
  const plan = today.composeToday(ctxOf({ states, attempts }), 45);
  const order = plan.items.filter((x) => x.share === 'retry').map((x) => x.q.id);
  assert.deepEqual(new Set(order), new Set([id(4), id(5), id(3), id(2)]));
});

it('determinism: same data + date + budget → same set; never a question answered today, nor its sibling; one per cluster', () => {
  const states = Array.from({ length: 20 }, (_, i) => st(id(i + 1), { due: true }));
  const groups = [[id(1), id(2)], [id(3), id(4)], [id(50), id(51)]];
  const attempts = [attempt(0, [ans(id(3), true)]), attempt(0, [ans(id(50), true)])];
  const a = today.composeToday(ctxOf({ states, attempts, groups }), 25);
  const b = today.composeToday(ctxOf({ states, attempts, groups }), 25);
  assert.deepEqual(served(a), served(b), 'same set and order');
  assert.ok(!served(a).includes(id(3)), 'answered today');
  assert.ok(!served(a).includes(id(4)), 'sibling of a question answered today');
  assert.ok(!served(a).includes(id(51)), 'never-seen sibling of a question answered today');
  assert.ok(!(served(a).includes(id(1)) && served(a).includes(id(2))), 'one question per cluster');
  const other = today.composeToday(ctxOf({ states, attempts, groups }), 10);
  assert.ok(other.items.length < a.items.length);
  assert.equal(new Set(served(a)).size, a.items.length);
});

it('sibling substitution: a mature due question is served as an unseen cluster mate (ref.for)', () => {
  const states = [st(id(10), { due: true, stability: 30 }), st(id(20), { due: true, stability: 3 })];
  const groups = [[id(10), id(11), id(12)], [id(20), id(21)]];
  const p = today.composeToday(ctxOf({ states, groups }), 25);
  const swap = p.items.find((x) => x.for === id(10));
  assert.ok(swap && [id(11), id(12)].includes(swap.q.id), JSON.stringify(p.items.map((x) => [x.q.id, x.for])));
  assert.equal(swap.share, 'review');
  assert.ok(!served(p).includes(id(10)));
  assert.ok(served(p).includes(id(20)), 'stability below srs.sibling_swap_days: served itself');
  assert.equal(p.mix.swapped, 1);
  const off = today.composeToday(ctxOf({ states, groups, cfg: makeCfg({ sibling_swap_days: 0 }) }), 25);
  assert.ok(served(off).includes(id(10)) && off.mix.swapped === 0, 'sibling_swap_days 0 = off');
  // the same choice every time (stable hash), and srs mode does the same
  assert.equal(today.composeToday(ctxOf({ states, groups }), 25).items.find((x) => x.for === id(10))?.q.id, swap.q.id);
  const s = select.buildTest({ mode: 'srs' }, ctxOf({ states, groups }));
  assert.deepEqual(
    s.questions.filter((r) => r.for).map((r) => [r.id, r.for]),
    [[swap.q.id, id(10)]],
  );
});

it('parked leeches are skipped; the new-question quota limits never-seen questions (paused → none, with the reason)', () => {
  const states = Array.from({ length: 6 }, (_, i) => st(id(i + 1), { due: true, leech: i < 2 }));
  const p = today.composeToday(ctxOf({ states, deps: { paused: () => new Set([id(1), id(2), id(3)]) } }), 25);
  assert.ok(!served(p).includes(id(1)) && !served(p).includes(id(2)));
  assert.ok(served(p).includes(id(3)), 'R1: a parked id that recovered (no longer a leech) is served again');
  const micro = select.microCandidates(ctxOf({ states, deps: { paused: () => new Set([id(1), id(3)]) } }), 200);
  assert.ok(!micro.includes(id(1)) && micro.includes(id(3)), 'micro: same parked-leech rule');
  const fresh = (x: { items: { q: Question; for?: string }[] }) => x.items.filter((i) => !states.some(([s]) => s === i.q.id)).length;
  const quota = { perDay: 5, unseen: 100, cutoff: '2026-11-01', daysLeft: 12, doneToday: 2 };
  const q = today.composeToday(ctxOf({ states, deps: { quota: () => quota } }), 25);
  assert.equal(q.mix.new, 3, 'perDay − doneToday never-seen questions in the new share');
  // past the new-question cutoff (quota 0, not paused) in the measure phase: weak / quick practice still fill a big budget
  const cutoff = { ...quota, perDay: 0, doneToday: 0, paused: 'Đã qua mốc câu mới.' };
  const past = today.composeToday(ctxOf({ deps: { quota: () => cutoff, phase: () => phase('measure') } }), 240);
  assert.equal(past.mix.new, 0);
  assert.ok(past.items.length > 50 && past.mix.weak + (past.mix.extra ?? 0) === past.items.length, JSON.stringify(past.mix));
  // a review backlog above 2 × srs.daily_limit: no never-seen question anywhere in the session
  const backlog = Array.from({ length: 30 }, (_, i) => st(id(i + 1), { due: true }));
  const paused = today.composeToday(ctxOf({ states: backlog, cfg: makeCfg({ daily_limit: 10 }), deps: { quota: () => ({ ...quota, perDay: 0, paused: 'Đang tồn 120 câu đến hạn.' }) } }), 25);
  assert.equal(paused.items.filter((i) => !backlog.some(([s]) => s === i.q.id)).length, 0);
  // a phase without new questions: none either
  const consol = today.composeToday(ctxOf({ states, deps: { phase: () => phase('consolidate', { newQuestions: false }) } }), 25);
  assert.equal(fresh(consol), 0);
  assert.equal(paused.mix.new, 0);
  assert.match(paused.notes.join(' '), /Đang tồn 120 câu/);
});

const phase = (id: ExamPhaseInfo['id'], o: Partial<ExamPhaseInfo> = {}): ExamPhaseInfo => ({ id, label: id, daysLeft: 5, rules: [], newQuestions: true, ...o });

it('phases: consolidate → final review replaces new questions; light / exam day → retry + confident errors only, capped', () => {
  const seenIds = Array.from({ length: 40 }, (_, i) => id(i + 1));
  const states = seenIds.map((x) => st(x));
  const advance = seenIds.slice(10, 30);
  const c = today.composeToday(ctxOf({ states, deps: { phase: () => phase('consolidate', { newQuestions: false }), advance: () => advance } }), 25);
  assert.equal(c.phase?.id, 'consolidate');
  assert.equal(c.mix.new, 0);
  assert.ok(c.mix.advance > 0);
  assert.ok(shareOf(c, 'advance').every((x) => advance.includes(x)));
  assert.ok(c.items.every((x) => states.some(([s]) => s === x.q.id)), 'no never-seen question');
  // light: 30′ at most, only recent errors and confident errors of any age
  const errStates = [st(id(1), { lastOk: false, daysAgo: 1 }), st(id(2), { lastOk: false, daysAgo: 20 }), st(id(3), { due: true })];
  const attempts = [attempt(1, [ans(id(1), false, { unsure: true })]), attempt(20, [ans(id(2), false)])];
  const l = today.composeToday(ctxOf({ states: errStates, attempts, deps: { phase: () => phase('light', { newQuestions: false, maxMinutes: 30 }) } }), 45);
  assert.equal(l.minutes, 30);
  assert.deepEqual(new Set(served(l)), new Set([id(1), id(2)]), 'no review, no new question');
  assert.match(l.notes.join(' '), /tối đa 30′/);
  const day = today.composeToday(ctxOf({ states: errStates, attempts, deps: { phase: () => phase('exam-day', { newQuestions: false, maxMinutes: 10 }) } }));
  assert.equal(day.minutes, 10);
  assert.ok(day.items.every((x) => x.share === 'retry'));
  // srs.exam_aware: false → no phase at all
  const off = today.composeToday(ctxOf({ states, cfg: makeCfg({ exam_aware: false }), deps: { phase: () => phase('consolidate', { newQuestions: false }) } }), 25);
  assert.equal(off.phase, undefined);
});

it('interleaving: no two neighbours share a topic when the mix allows it', () => {
  const p = today.composeToday(ctxOf(), 45);
  const topics = p.items.map((x) => x.q.topic);
  for (let i = 1; i < topics.length; i++) assert.notEqual(topics[i], topics[i - 1], `positions ${i - 1}/${i}`);
  // the helper: feasible arrangements keep priority order where they can
  const items = ['a1', 'a2', 'a3', 'b1', 'c1'].map((x) => ({ x, t: x[0] }));
  const out = rules.interleave(items, (e) => e.t).map((e) => e.x);
  assert.deepEqual(out, ['a1', 'b1', 'a2', 'c1', 'a3']);
  assert.deepEqual(rules.interleave([{ t: 'a' }, { t: 'a' }], (e) => e.t).length, 2, 'unavoidable neighbours stay');
});

it('coach session ≤ 3 days old and not done → mix.coach; value model after 200 answers prefers cheaper reviews', () => {
  const plan = (days: number, done = false): Plan => ({
    id: `p${days}`,
    file: '',
    created: new Date(NOW - days * DAY).toISOString(),
    newPacks: [],
    body: '',
    sessions: [{ id: 's1', title: 'x', questions: [id(1)], ...(done ? { done: [{ attemptId: 'a', score: 1, finished: '' }] } : {}) }],
  });
  assert.equal(today.composeToday(ctxOf({ plans: [plan(1)] }), 10).mix.coach, 'p1#s1');
  assert.equal(today.composeToday(ctxOf({ plans: [plan(5)] }), 10).mix.coach, undefined);
  assert.equal(today.composeToday(ctxOf({ plans: [plan(1, true)] }), 10).mix.coach, undefined);
  // R1: plans the app writes itself (sprint calendar, onboarding) are never offered as a fresh AI-coach session
  assert.equal(today.composeToday(ctxOf({ plans: [{ ...plan(1), trigger: 'sprint' }] }), 10).mix.coach, undefined);
  assert.equal(today.composeToday(ctxOf({ plans: [{ ...plan(1), trigger: 'onboarding' }] }), 10).mix.coach, undefined);
  assert.equal(today.composeToday(ctxOf({ plans: [{ ...plan(1), trigger: 'sprint' }, { ...plan(2), id: 'ai' }] }), 10).mix.coach, 'ai#s1');
  // two due reviews, same recall / domain: q001 costs 150 s, q005 30 s; daily_limit 1
  const bank = makeBank(BANK.questions.map((q) => (q.id === id(1) ? { ...q, time: 150 } : q.id === id(5) ? { ...q, time: 30 } : q)));
  const due = [st(id(1), { due: true }), st(id(5), { due: true })];
  const cfg = makeCfg({ daily_limit: 1 });
  const fixed = today.composeToday(ctxOf({ bank, states: due, cfg }), 25);
  assert.deepEqual(shareOf(fixed, 'review'), [id(1)], 'fixed priority: lowest recall, then due date, then id');
  const veteran = [...due, st(id(120), { attempts: 250, correct: 200, stability: 60 })];
  const value = today.composeToday(ctxOf({ bank, states: veteran, cfg }), 25);
  assert.deepEqual(shareOf(value, 'review'), [id(5)], 'value per minute');
});

it('previewToday: count, label, phase, done today and the goal; microCandidates', () => {
  const attempts = [attempt(0, [ans(id(1), true, { t: 600, rt: 60 }), ans(id(2), false, { t: 540 })])];
  const ctx = ctxOf({ attempts, goal: { minutesPerDay: 20 } });
  const pv = today.previewToday(ctx);
  assert.equal(pv.minutes, 20);
  assert.equal(pv.count, pv.mix.review + pv.mix.retry + pv.mix.weak + pv.mix.new + pv.mix.advance + (pv.mix.extra ?? 0));
  assert.equal(pv.label, today.todayLabel(pv.mix, pv.count));
  assert.deepEqual(pv.done, { answers: 2, minutes: 20, goalMet: true });
  assert.equal(today.previewToday(ctxOf({ attempts, goal: { minutesPerDay: 30 } })).done.goalMet, false);
  assert.equal(today.previewToday(ctxOf(), 5).minutes, 5);
  // micro: short stems only, due first, never sealed / draft / out of scope, not answered today, one per cluster
  const qs = BANK.questions.map((q, i) => {
    if (i < 10) return { ...q, words: 60 };
    if (q.id === id(30)) return { ...q, status: 'draft' as const };
    if (q.id === id(31)) return { ...q, outOfScope: true };
    return q;
  });
  const bank = makeBank(qs);
  const states = [st(id(40), { due: true, retrievability: 0.5 }), st(id(41), { due: true, retrievability: 0.3 }), st(id(42), { lastOk: false }), st(id(5), { due: true })];
  const mctx: SelectCtx = { ...ctxOf({ bank, states, attempts: [attempt(0, [ans(id(43), true)])], groups: [[id(43), id(44)], [id(50), id(51)]] }), sealed: { forms: [{ id: 'S1', ids: [id(60)], status: 'sealed' }], size: 1 } };
  const m = select.microCandidates(mctx, 200);
  assert.deepEqual(m.slice(0, 3), [id(41), id(40), id(42)], 'due (lowest recall first), then learning');
  assert.ok(!m.includes(id(5)), 'stem longer than 40 words');
  for (const x of [id(30), id(31), id(60), id(43), id(44)]) assert.ok(!m.includes(x), `${x} excluded`);
  assert.ok(!(m.includes(id(50)) && m.includes(id(51))), 'one per cluster');
  assert.deepEqual(select.microCandidates(mctx, 3), m.slice(0, 3));
  assert.deepEqual(select.microCandidates({ ...mctx }, 200), m, 'deterministic');
  assert.deepEqual(select.microCandidates(mctx, 0), []);
  const capped = select.microCandidates({ ...mctx, deps: { ...mctx.deps, quota: () => ({ perDay: 2, unseen: 90, cutoff: '', daysLeft: 9, doneToday: 0 }) } }, 200);
  assert.equal(capped.length, 3 + 2, 'never-seen questions within the quota');
});

it("mode 'today' via buildTest: session fields, order and the same set as the preview", () => {
  const states = Array.from({ length: 10 }, (_, i) => st(id(i + 1), { due: true }));
  const ctx = ctxOf({ states, deps: { phase: () => phase('measure') } });
  const s = select.buildTest({ mode: 'today', budgetMinutes: 25 }, ctx);
  const plan = today.composeToday(ctx, 25);
  assert.deepEqual(s.questions.map((r) => r.id), served(plan), 'interleaved order kept');
  assert.equal(s.title, 'Học hôm nay · 25′');
  assert.equal(s.feedback, 'practice');
  assert.equal(s.relearn, true);
  assert.equal(s.timeLimit, 0, 'untimed: the runner keeps a soft budget timer');
  assert.equal(s.budgetMinutes, 25);
  assert.deepEqual(s.mix, plan.mix);
  assert.equal(s.phase, 'measure');
  assert.equal(today.previewToday(ctx, 25).count, s.questions.length);
  assert.equal(select.buildTest({ mode: 'today' }, ctxOf({ goal: { minutesPerDay: 10 } })).budgetMinutes, 10);
  assert.equal(select.buildTest({ mode: 'today', relearn: false }, ctx).relearn, undefined);
  assert.equal(select.buildTest({ mode: 'today' }, ctxOf({ cfg: makeCfg({}, { relearn: false }) })).relearn, undefined);
});

it('R1 regressions: tiny-budget fallback keeps shares and the daily cap; done counts real answers; light cap per day; seed from content', () => {
  // 1′ budget, 180 s questions, daily review cap used up → the fallback serves no review
  const bank = makeBank(BANK.questions.map((q) => ({ ...q, time: 180 })));
  const states = [st(id(1), { due: true }), st(id(2), { due: true })];
  const used = [attempt(0.04, [ans(id(3), true)], { mode: 'srs' })];
  const p = today.composeToday(ctxOf({ bank, states, attempts: used, cfg: makeCfg({ daily_limit: 1 }) }), 1);
  assert.equal(p.items.length, 1);
  assert.notEqual(p.items[0].share, 'review');
  // the fallback labels its pick with the list it came from (weak here: seen, wrong, not due)
  const w = today.composeToday(ctxOf({ bank, states: [st(id(5), { lastOk: false })], cfg: makeCfg({ daily_limit: 0 }) }), 1);
  assert.equal(w.items.length, 1);
  assert.ok(['weak', 'new'].includes(w.items[0].share), w.items[0].share);
  // doneToday: relearning retries and skipped blanks take time but are no answers
  const a = attempt(0.01, [ans(id(1), false, { t: 60 }), ans(id(1), true, { relearn: true, t: 30 }), ans(id(2), false, { pick: '', t: 30, skipped: true })]);
  assert.deepEqual(today.doneToday(ctxOf({ attempts: [a] }), '2026-10-20', 25), { answers: 1, minutes: 2, goalMet: false });
  // light phase: 30′ per day — 20′ already studied leaves 10′; 30′ studied leaves nothing
  const lightDeps = { phase: () => phase('light', { newQuestions: false, maxMinutes: 30 }) };
  const errs = [st(id(1), { lastOk: false, daysAgo: 1 })];
  const errAttempts = [attempt(1, [ans(id(1), false)])];
  const studied = (min: number) => attempt(0.02, [ans(id(90), true, { t: min * 60 })]);
  assert.equal(today.composeToday(ctxOf({ states: errs, attempts: [...errAttempts, studied(20)], deps: lightDeps }), 45).minutes, 10);
  const full = today.composeToday(ctxOf({ states: errs, attempts: [...errAttempts, studied(30)], deps: lightDeps }), 45);
  assert.equal(full.minutes, 0);
  assert.equal(full.items.length, 0);
  assert.match(full.notes.join(' '), /đã học đủ 30′/);
  // seed from content: the same history in another order / without file versions → the same set
  const hist = [attempt(3, [ans(id(7), true)]), attempt(2, [ans(id(8), true)])];
  const one = today.composeToday({ ...ctxOf({ attempts: hist }), versions: { bank: 'x', results: 'mtime-1', plans: '' } }, 25);
  const two = today.composeToday({ ...ctxOf({ attempts: [...hist].reverse() }), versions: { bank: 'y', results: 'mtime-2', plans: '' } }, 25);
  assert.deepEqual(served(one), served(two));
  assert.equal(today.historyDigest(hist), today.historyDigest([...hist].reverse()));
  assert.notEqual(today.historyDigest(hist), today.historyDigest(hist.slice(1)));
});

it('R2: a plan filter session keeps its own mode (plan set for done-tracking); app-written plans get no 🤖', () => {
  const plans: Plan[] = [
    { id: 'sp', file: '', created: new Date(NOW).toISOString(), trigger: 'sprint', newPacks: [], body: '', sessions: [{ id: 't6', title: 'T−6 · Học hôm nay', filter: { mode: 'today', budgetMinutes: 10 } }] },
    { id: 'ai', file: '', created: new Date(NOW).toISOString(), newPacks: [], body: '', sessions: [{ id: 's1', title: 'Vá S3', filter: { mode: 'topic', count: 5 } }, { id: 's2', title: 'Danh sách', questions: [id(1), id(2)] }] },
  ];
  const t = select.buildTest({ mode: 'coach', plan: 'sp#t6' }, ctxOf({ plans }));
  assert.equal(t.mode, 'today');
  assert.equal(t.plan, 'sp#t6');
  assert.equal(t.title, 'T−6 · Học hôm nay');
  assert.equal(t.budgetMinutes, 10);
  const f = select.buildTest({ mode: 'coach', plan: 'ai#s1' }, ctxOf({ plans }));
  assert.equal(f.mode, 'topic');
  assert.equal(f.plan, 'ai#s1');
  assert.equal(f.title, '🤖 Vá S3');
  const l = select.buildTest({ mode: 'coach', plan: 'ai#s2' }, ctxOf({ plans }));
  assert.equal(l.mode, 'coach', 'id lists stay coach sessions');
  assert.equal(l.title, '🤖 Danh sách');
});
