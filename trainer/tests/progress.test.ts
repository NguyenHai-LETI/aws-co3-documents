// Unit tests for the v3 learning engine: item versioning (re-grading), FSRS-6 personal parameters (training set,
// parameter resolution, optimizer fallback + a real optimizer run when the optional package is installed), the
// exam-date forecast, the review workload, external scores + calibration, goal / external files. Run: npm test
// Uses a throw-away data root (TRAINER_HOME) with a generated pack — never the real bank/results.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from '../server/config.ts';
import type { AnswerRecord, Attempt, DomainId, ExternalScore, QuestionState } from '../shared/types.ts';

const TRAINER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-progress-'));
fs.mkdirSync(path.join(HOME, 'bank', 'packs', 'manual'), { recursive: true });
fs.copyFileSync(path.join(TRAINER, 'bank', 'taxonomy.yaml'), path.join(HOME, 'bank', 'taxonomy.yaml'));
process.env.TRAINER_HOME = HOME; // must be set before config.ts is imported (dynamic imports below)
after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const { DATA_DIR, RESULTS_DIR, SNAPSHOT_FILE, PLANS_DIR } = await import('../server/config.ts');
// Without process isolation another test file may have loaded config.ts first — then never write: skip.
const it = DATA_DIR === HOME ? test : test.skip;

const fsrs = await import('../server/lib/fsrs.ts');
const stats = await import('../server/lib/stats.ts');
const results = await import('../server/lib/results.ts');
const { regradeAttempts, regradeAnswer, countRegraded } = await import('../server/lib/regrade.ts');
const opt = await import('../server/lib/fsrs-optimize.ts');
const fc = await import('../server/lib/forecast.ts');
const prog = await import('../server/lib/progress.ts');
const { loadBank } = await import('../server/lib/bank.ts');
const { serializePack } = await import('../server/lib/pack-format.ts');
const { stringifyFrontMatter, splitFrontMatter } = await import('../server/lib/frontmatter.ts');
const onboarding = await import('../server/lib/onboarding.ts');
const { loadPlans } = await import('../server/lib/plans.ts');

const DAY = 86_400_000;
const NOW = Date.now();

function makeCfg(srs: Partial<AppConfig['srs']> = {}): AppConfig {
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
    srs: { algorithm: 'fsrs', desired_retention: 0.9, daily_limit: 50, mastered_stability_days: 21, intervals_days: [1, 3, 7, 14, 30], mastered_box: 4, weights: [], optimize: 'manual', optimize_min_reviews: 400, exam_aware: false, final_review_days: 7, new_cutoff_days: 10, load_balance: false, final_retention: 0, leech_lapses: 3, sibling_swap_days: 7, ...srs },
    practice: { default_count: 20, quick_count: 10, shuffle_options: true, exclude_out_of_scope: false, today_minutes: 25, relearn: true },
    exam: { sealed_forms: 0, sealed_size: 50 },
    stats: { rushed_median_seconds: 5, recency_half_life_days: 14, recognized_wpm: 300 },
    quality: { embeddings: 'off', ollama_url: '', embedding_model: '', semantic_threshold: 0.88, longform_target_per_task: 12 },
    server: { lan: false, lan_admin: false, https: 'off', https_cert: '', https_key: '' },
    export: { anki_deck: 'test', ankiconnect_url: '' },
    cache: { sqlite: false },
    sync: { data_paths: [], before_ai: false, after_ai: false, auto: 'off', auto_delay_minutes: 4 },
  };
}
const cfg = makeCfg();

// ── generated bank: 10 questions per domain, answer key A, two exam-guide tasks per domain (odd / even) ──
const DOMAINS: DomainId[] = ['secure', 'resilient', 'performance', 'cost'];
const TASKS: Record<DomainId, [string, string]> = { secure: ['1.1', '1.2'], resilient: ['2.1', '2.2'], performance: ['3.1', '3.2'], cost: ['4.1', '4.2'] };
const drafts = DOMAINS.flatMap((d) =>
  Array.from({ length: 10 }, (_, i) => ({
    id: `${d.slice(0, 3)}-${String(i + 1).padStart(2, '0')}`,
    stem: `Scenario ${i + 1} for ${d}: a company needs a design that meets the requirement. Which option should it choose?`,
    options: ['A', 'B', 'C', 'D'].map((key, k) => ({ key, text: `Choice ${key} number ${k + 1} for case ${i + 1} in ${d}` })),
    answer: ['A'],
    explanation: 'The chosen design fits the scenario.',
    domain: d,
    topic: 'storage',
    difficulty: 'medium' as const,
    time: 60,
    task: TASKS[d][i % 2],
  })),
);
const PACK = path.join(HOME, 'bank', 'packs', 'manual', 'progress-test.md');
fs.writeFileSync(PACK, serializePack({ pack: 'progress-test', title: 'Progress test', origin: 'manual' }, '', drafts, (x) => stringifyFrontMatter(x)));
const bank = loadBank();
const ids = bank.questions.map((q) => q.id);

function ans(q: string, ok: boolean, extra: Partial<AnswerRecord> = {}): AnswerRecord {
  return { q, pick: ok ? 'A' : 'B', key: 'A', ok, t: 60, est: 60, ...extra };
}
let seq = 0;
function attempt(daysAgo: number, answers: AnswerRecord[], extra: Partial<Attempt> = {}): Attempt {
  return { id: `a${++seq}`, mode: 'custom', finished: new Date(NOW - daysAgo * DAY).toISOString(), answers, ...extra } as Attempt;
}

// ── item versioning ─────────────────────────────────────────────────────────

it('regradeAttempts: answers graded with an old key count against the current key; annotated copies, input untouched, idempotent', () => {
  const q = ids[0];
  const old = attempt(5, [ans(q, true, { key: 'B', pick: 'B' }), ans(ids[1], true)]); // was right with key B, the key is now A
  const lucky = attempt(4, [{ q, pick: 'A', key: 'C', ok: false, t: 40, est: 60 }]); // was wrong, A is now the key
  const same = attempt(3, [ans(q, true), ans(ids[2], false)]);
  const list = [old, lucky, same];
  const out = regradeAttempts(list, bank);
  assert.notEqual(out, list, 'a new array when something was re-graded or annotated');
  // v4: every viewed answer of a non-rushed attempt carries its exposure (1 = first time the question was answered)
  assert.deepEqual(out[0].answers[0], { ...old.answers[0], key: 'A', ok: false, regraded: true, exposure: 1 });
  assert.deepEqual(out[1].answers[0], { ...lucky.answers[0], key: 'A', ok: true, regraded: true, exposure: 2 });
  assert.deepEqual(out[2].answers, [{ ...same.answers[0], exposure: 3 }, { ...same.answers[1], exposure: 1 }]);
  assert.equal(old.answers[0].ok, true, 'the input is never mutated');
  assert.equal(old.answers[0].exposure, undefined);
  assert.equal(regradeAttempts(list, bank), out, 'cached by input identity + bank version');
  assert.equal(regradeAttempts(out, bank), out, 'an annotated history comes back as the same array (idempotent)');
  const copy = [...out];
  const again = regradeAttempts(copy, bank);
  assert.equal(again, copy, 'nothing left to re-grade or annotate → the same array');
  assert.ok(again.every((a, i) => a === out[i] && a.answers.every((r, j) => r === out[i].answers[j])), 'unchanged attempts and answers keep their identity');
  // formatting differences of the stored key are not a key change; unknown questions are not re-graded
  assert.equal(regradeAnswer(ans(q, true, { key: 'a' }), 'A').regraded, undefined);
  const gone = ans('not-in-bank', true, { key: 'B', pick: 'B' });
  assert.deepEqual(regradeAttempts([attempt(1, [gone])], bank)[0].answers[0], { ...gone, exposure: 1 });
  // learning computations see the re-graded answers
  assert.equal(countRegraded(out), 2);
  assert.equal(countRegraded([...out, { ...out[0], rushed: true }]), 2, 'rushed attempts are not counted');
  const st = stats.computeStates(out, cfg, NOW).get(q)!;
  assert.equal(st.correct, 2, 'lucky (now right) + same; old (now wrong)');
  assert.equal(st.lapses ?? 0, 0, 'first answer is wrong after re-grading → no lapse');
  const s = stats.computeStats(out, bank, stats.computeStates(out, cfg, NOW), cfg, NOW);
  assert.equal(s.regraded, 2);
});

// ── FSRS-6 personal parameters ──────────────────────────────────────────────

it('training set: rushed attempts and unseen blanks (no pick, t = 0) are not reviews; whole local days between answers', () => {
  const q = ids[3];
  const set = opt.trainingSet([
    attempt(10, [ans(q, true), ans(ids[4], false, { pick: '', t: 0 })]),
    attempt(10, [ans(q, false)]), // same day → delta 0, not an item
    attempt(7, [ans(q, true, { unsure: true })], { rushed: true }),
    attempt(6, [ans(q, true, { t: 20 }), ans(ids[4], false, { pick: '', t: 35 })]), // a blank with time spent is a lapse
  ]);
  assert.equal(set.reviews, 4);
  assert.equal(set.excluded, 1);
  assert.equal(set.items, 1, 'only the review 4 days later makes an optimizer item');
  const card = set.cards.find((c) => c.length === 3)!;
  assert.deepEqual(card, [[3, 0], [1, 0], [4, 4]]);
  assert.ok(set.cards.some((c) => c.length === 1 && c[0][0] === 1), 'the blank with time spent → grade 1');
});

it('parameters: config srs.weights > personal (adopted) > defaults; union-merged file → newest valid line', () => {
  const file = opt.PARAMS_FILE;
  fs.rmSync(file, { force: true });
  assert.equal(opt.resolveFsrsParams(cfg).source, 'default');
  const w = [...fsrs.FSRS_WEIGHTS].map((x, i) => (i === 0 ? 0.3 : x));
  const rec = (at: string, adopted: boolean, weights = w) => JSON.stringify({ weights, adopted, optimizedAt: at, reviews: 500, items: 300, metrics: { logLoss: 0.3, rmse: 0.05, defaultLogLoss: 0.32, defaultRmse: 0.06 }, binding: '0.5.0' });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // two machines' lines after a union merge + a broken line: the newest valid one wins
  fs.writeFileSync(file, [rec('2026-01-01T10:00:00+07:00', true, [...fsrs.FSRS_WEIGHTS]), '{"weights": [1,2', rec('2026-02-01T10:00:00+07:00', true)].join('\n') + '\n');
  const p = opt.resolveFsrsParams(cfg);
  assert.equal(p.source, 'personal');
  assert.equal(p.weights[0], 0.3);
  assert.equal(p.record?.optimizedAt, '2026-02-01T10:00:00+07:00');
  // states use the personal parameters: first "again" → S0 = w0
  const st = stats.computeStates([attempt(1, [ans(ids[5], false)])], cfg, NOW).get(ids[5])!;
  assert.equal(st.stability, 0.3);
  // optimize: off ignores personal parameters; hand-set weights win; invalid ones are reported and skipped
  assert.equal(opt.resolveFsrsParams(makeCfg({ optimize: 'off' })).source, 'default');
  const hand = [...fsrs.FSRS_WEIGHTS].map((x, i) => (i === 0 ? 0.25 : x));
  const c = opt.resolveFsrsParams(makeCfg({ weights: hand }));
  assert.deepEqual([c.source, c.weights[0]], ['config', 0.25]);
  const bad = opt.resolveFsrsParams(makeCfg({ weights: [1, 2, 3] }));
  assert.equal(bad.source, 'personal');
  assert.match(bad.note ?? '', /không hợp lệ/);
  assert.equal(opt.resolveFsrsParams(makeCfg({ weights: fsrs.FSRS_WEIGHTS.slice(0, 19) })).source, 'config', 'FSRS-5 vectors are migrated');
  // a run that did not beat the defaults is stored but not used
  fs.writeFileSync(file, rec('2026-03-01T10:00:00+07:00', false) + '\n');
  const nd = opt.resolveFsrsParams(cfg);
  assert.equal(nd.source, 'default');
  assert.match(nd.note ?? '', /mặc định/);
  fs.rmSync(file, { force: true });
});

it('auto re-optimization: needs auto mode, enough reviews, ≥ 7 days and ≥ 20 % more reviews than the last run', () => {
  const auto = makeCfg({ optimize: 'auto', optimize_min_reviews: 10 });
  const set = { cards: [[[3, 0], [3, 2]]] as [number, number][][], reviews: 120, items: 50, excluded: 0 };
  const avail = opt.optimizerAvailable().available;
  const rec = (daysAgo: number, reviews: number) => ({ weights: [...fsrs.FSRS_WEIGHTS], adopted: true, optimizedAt: new Date(NOW - daysAgo * DAY).toISOString(), reviews, items: 1, metrics: { logLoss: 0, rmse: 0, defaultLogLoss: 0, defaultRmse: 0 }, binding: '' });
  assert.equal(opt.autoOptimizeDue(auto, set, undefined, NOW), avail, 'first run (when the optimizer is installed)');
  assert.equal(opt.autoOptimizeDue(makeCfg({ optimize: 'manual', optimize_min_reviews: 10 }), set, undefined, NOW), false);
  assert.equal(opt.autoOptimizeDue(makeCfg({ optimize: 'auto', optimize_min_reviews: 500 }), set, undefined, NOW), false, 'too few reviews');
  assert.equal(opt.autoOptimizeDue(auto, set, rec(3, 50), NOW), false, 'less than a week ago');
  assert.equal(opt.autoOptimizeDue(auto, set, rec(8, 110), NOW), false, 'history grew < 20 %');
  assert.equal(opt.autoOptimizeDue(auto, set, rec(8, 100), NOW), avail, '≥ 7 days and +20 %');
  assert.equal(opt.autoOptimizeDue(makeCfg({ optimize: 'auto', optimize_min_reviews: 10, weights: [...fsrs.FSRS_WEIGHTS] }), set, undefined, NOW), false, 'hand-set weights win anyway');
});

it('optimizer missing → "unavailable", defaults, the button explains why', async () => {
  process.env.TRAINER_NO_FSRS_OPTIMIZER = '1';
  try {
    const atts = [attempt(3, [ans(ids[6], true)]), attempt(1, [ans(ids[6], true)])];
    const info = opt.fsrsInfo(makeCfg({ optimize_min_reviews: 1 }), atts);
    assert.equal(info.optimizer, 'unavailable');
    assert.equal(info.params, 'default');
    assert.equal(info.version, 'fsrs-6');
    assert.equal(info.weights.length, 21);
    assert.equal(info.historyReviews, 2);
    assert.match(info.blocked ?? '', /bộ tối ưu/i);
    await assert.rejects(opt.startOptimize(atts, makeCfg({ optimize_min_reviews: 1 })), (e: Error & { status?: number }) => e.status === 409);
    assert.equal(opt.maybeAutoOptimize(atts, makeCfg({ optimize: 'auto', optimize_min_reviews: 1 })), false);
  } finally {
    delete process.env.TRAINER_NO_FSRS_OPTIMIZER;
  }
});

/** A simulated learner: every question reviewed several times days apart, recall following an FSRS-like curve. */
function simulatedHistory(cards: number, seed = 5): Attempt[] {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const byDay = new Map<number, AnswerRecord[]>();
  for (let c = 0; c < cards; c++) {
    const q = ids[c % ids.length];
    let day = 120 - Math.floor(rnd() * 10);
    let stab = 1.5;
    for (let k = 0; k < 7 && day > 0; k++) {
      const ok = rnd() < (k === 0 ? 0.65 : 0.85);
      const list = byDay.get(day) ?? [];
      list.push(ans(`${q}`, ok, { t: ok && rnd() < 0.3 ? 20 : 60 }));
      byDay.set(day, list);
      stab = ok ? stab * 2.4 : Math.max(0.5, stab * 0.4);
      day -= Math.max(1, Math.round(stab * (0.6 + rnd())));
    }
  }
  // one attempt per day; a question appears at most once per attempt
  return [...byDay].map(([d, list]) => attempt(d, [...new Map(list.map((r) => [r.q, r])).values()]));
}

it('optimizer run in a child process writes results/fsrs-params.json (skipped without the optional package)', { timeout: 120_000 }, async (t) => {
  if (!opt.optimizerAvailable().available) return t.skip('optional @open-spaced-repetition/binding not installed');
  fs.rmSync(opt.PARAMS_FILE, { force: true });
  fs.rmSync(SNAPSHOT_FILE, { force: true }); // nothing else in this process schedules the coach snapshot
  const history = simulatedHistory(400);
  const c = makeCfg({ optimize_min_reviews: 50 });
  const set = opt.trainingSet(history);
  assert.ok(set.reviews >= 50 && set.items > 0, `${set.reviews} reviews / ${set.items} items`);
  const run = opt.startOptimize(history, c);
  assert.equal(opt.startOptimize(history, c), run, 'a second click joins the running optimization');
  assert.equal(opt.fsrsInfo(c, history).running, true);
  const done = await run;
  assert.ok(done, 'enough day-spaced reviews → parameters');
  const rec = done;
  assert.equal(rec.weights.length, 21);
  assert.equal(rec.reviews, set.reviews);
  assert.ok(rec.items > 0 && rec.binding);
  for (const k of ['logLoss', 'rmse', 'defaultLogLoss', 'defaultRmse'] as const) assert.ok(Number.isFinite(rec.metrics[k]), k);
  assert.equal(rec.adopted, rec.metrics.logLoss < rec.metrics.defaultLogLoss);
  const lines = fs.readFileSync(opt.PARAMS_FILE, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1, 'one JSON object per line');
  assert.deepEqual(JSON.parse(lines[0]), rec);
  const info = opt.fsrsInfo(c, history);
  assert.equal(info.running, false);
  assert.equal(info.optimizedAt, rec.optimizedAt);
  assert.equal(info.params, rec.adopted ? 'personal' : 'default');
  // new parameters → memory levels change → the coach snapshot is rebuilt (debounced ~3 s, off the request path)
  for (let i = 0; i < 60 && !fs.existsSync(SNAPSHOT_FILE); i++) await new Promise((r) => setTimeout(r, 200));
  assert.ok(fs.existsSync(SNAPSHOT_FILE), 'coach/snapshot.md rewritten after the optimization');
  fs.rmSync(opt.PARAMS_FILE, { force: true });
});

it('optimizer with too little day-spaced data: "not enough data" outcome, nothing written, defaults stay', { timeout: 60_000 }, async (t) => {
  if (!opt.optimizerAvailable().available) return t.skip('optional @open-spaced-repetition/binding not installed');
  fs.rmSync(opt.PARAMS_FILE, { force: true });
  const tiny = [attempt(9, [ans(ids[0], true), ans(ids[1], false)]), attempt(4, [ans(ids[0], true), ans(ids[1], true)])];
  const c = makeCfg({ optimize_min_reviews: 1 });
  assert.equal(await opt.startOptimize(tiny, c), undefined);
  const info = opt.fsrsInfo(c, tiny);
  assert.equal(info.lastOutcome, 'not-enough-data');
  assert.equal(info.lastError, undefined);
  assert.equal(info.note, opt.NOT_ENOUGH_DATA_NOTE);
  assert.equal(info.params, 'default');
  assert.equal(fs.existsSync(opt.PARAMS_FILE), false);
});

// ── forecast, workload, calibration ─────────────────────────────────────────

it('forecast math: seen → R on the exam day (stop now / on schedule), unseen → first-try accuracy, domain weights', () => {
  const sched = fsrs.scheduler();
  const today = fsrs.localDay(NOW);
  const m = { stability: 10, difficulty: 5, lastDay: today - 3 };
  const f = fc.questionForecast(m, today + 30, today, sched);
  assert.ok(Math.abs(f.stop - fsrs.retrievability(33, 10)) < 1e-9, 'stop now = R(33 days, S)');
  assert.ok(f.reviews >= 1 && f.schedule >= 0.9 - 1e-9 && f.schedule > f.stop, `on schedule ${f.schedule} ≥ desired retention`);
  // exam before the next due date: no review, both equal
  const soon = fc.questionForecast(m, today + 2, today, sched);
  assert.deepEqual([soon.reviews, soon.schedule], [0, soon.stop]);
  assert.equal(fc.laplace({ n: 8, ok: 6 }), 0.7);
  assert.equal(fc.laplace(undefined), 0.5);

  // one secure question seen (remembered well), everything else unseen
  const secure = bank.questions.filter((q) => q.domain === 'secure');
  const history = [attempt(2, [ans(secure[0].id, true)]), attempt(1, [ans(secure[0].id, true), ans(secure[1].id, false)])];
  const states = stats.computeStates(history, cfg, NOW);
  const exam = fsrs.dayKey(today + 20);
  const out = fc.forecastExam(states, bank, history, exam, { weights: fsrs.FSRS_WEIGHTS, desiredRetention: 0.9, now: NOW });
  assert.equal(out.examDate, exam);
  assert.equal(out.daysLeft, 20);
  assert.equal(out.seen, 2);
  assert.equal(out.active, 40);
  assert.equal(out.coverage, 5);
  const sec = out.byDomain.find((d) => d.domain === 'secure')!;
  const first = fc.laplace({ n: 2, ok: 1 }); // first tries in secure: 1 right, 1 wrong
  const r0 = fsrs.retrievability(today + 20 - fsrs.localDay(NOW - DAY), states.get(secure[0].id)!.stability!);
  const r1 = fsrs.retrievability(today + 20 - fsrs.localDay(NOW - DAY), states.get(secure[1].id)!.stability!);
  assert.ok(Math.abs(sec.ifStopNow - Math.round(((r0 + r1 + 8 * first) / 10) * 1000) / 10) <= 0.1, `secure ${sec.ifStopNow}`);
  assert.ok(sec.onSchedule >= sec.ifStopNow);
  const other = out.byDomain.find((d) => d.domain === 'cost')!;
  assert.equal(other.ifStopNow, 50, 'no data → Laplace prior 50 %');
  const total = out.byDomain.reduce((s, d) => s + (d.weight ?? 0), 0);
  const expected = out.byDomain.reduce((s, d) => s + ((d.weight ?? 0) / total) * d.ifStopNow, 0);
  assert.ok(Math.abs(out.ifStopNow - expected) <= 0.1, 'weighted by the exam domain weights');
  assert.match(out.note ?? '', /ngân hàng/);
  // a past exam date is forecast for today, with a note
  const past = fc.forecastExam(states, bank, history, fsrs.dayKey(today - 3), { weights: fsrs.FSRS_WEIGHTS, desiredRetention: 0.9, now: NOW });
  assert.equal(past.daysLeft, -3);
  assert.match(past.note ?? '', /đã qua/);
});

it('workload: reviews due per local day, overdue ones on the first day', () => {
  const today = fsrs.localDay(NOW);
  const st = (id: string, dueDay: number): [string, QuestionState] => [id, { id, attempts: 1, correct: 1, everWrong: false, streak: 1, box: 2, avgTime: 30, slowCount: 0, wrongPicks: {}, dueAt: new Date(fsrs.dayStartMs(dueDay)).toISOString() }];
  const states = new Map([st(ids[0], today - 2), st(ids[1], today), st(ids[2], today + 1), st(ids[3], today + 1), st(ids[4], today + 40), st('gone', today)]);
  const w = fc.workloadDays(states, bank.questions, 30, NOW);
  assert.equal(w.length, 30);
  assert.equal(w[0].date, fsrs.dayKey(today));
  assert.deepEqual([w[0].due, w[0].overdue, w[1].due], [2, 1, 2]);
  assert.equal(w.reduce((s, d) => s + d.due, 0), 4, 'beyond the horizon / unknown questions left out');
});

it('workload horizon: today … exam day, at most 60 days; no exam date or a past one → 30 days', () => {
  const atts = regradeAttempts(simulatedHistory(40, 13), bank);
  const states = stats.computeStates(atts, cfg, NOW);
  const today = fsrs.localDay(NOW);
  const len = (examIn?: number) => {
    prog.saveGoal({ examDate: examIn === undefined ? null : fsrs.dayKey(today + examIn) }, 720);
    const p = prog.computeProgress({ cfg, bank, attempts: [...atts], states }, NOW);
    return { days: p.workload.length, last: p.workload.at(-1)!.date };
  };
  for (const d of [0, 1, 30, 58, 59]) assert.deepEqual(len(d), { days: d + 1, last: fsrs.dayKey(today + d) }, `exam in ${d} days → until the exam`);
  for (const d of [60, 61, 90, 400]) assert.equal(len(d).days, prog.WORKLOAD_MAX_DAYS, `exam in ${d} days → capped`);
  assert.equal(len(-3).days, prog.WORKLOAD_DAYS, 'past exam date');
  assert.equal(len(undefined).days, prog.WORKLOAD_DAYS, 'no exam date');
});

it('calibration: offset = mean(score − readiness on that date) over the last 5; readinessAt re-runs the readiness', () => {
  const ext = (date: string, score: number, readinessAtDate?: number): ExternalScore => ({ id: `${date}_x`, date, source: 'x', score, readinessAtDate, file: '' });
  const scores = [ext('2026-01-01', 90, 50), ext('2026-02-01', 70, 60), ext('2026-03-01', 72, 70), ext('2026-04-01', 75, 70), ext('2026-05-01', 80, 72), ext('2026-06-01', 81, 75), ext('2026-07-01', 99)];
  const c = fc.calibrate(scores, 68)!;
  assert.equal(c.samples, 5, 'last 5 with a readiness (the newest has none)');
  assert.equal(c.offset, 6.2, '(6 + 8 + 5 + 2 + 10) / 5 — the oldest score falls outside the last 5');
  assert.equal(c.adjustedReadiness, 74.2);
  assert.equal(c.readiness, 68);
  assert.equal(fc.calibrate([ext('2026-01-01', 80)], 60), undefined);
  assert.equal(fc.calibrate([ext('2026-01-01', 100, 10)], 95)!.adjustedReadiness, 100, 'clamped to 100');
  // readinessAt(now) equals the stats readiness; later attempts are ignored for an earlier date
  const history = [attempt(10, ids.slice(0, 20).map((q, i) => ans(q, i % 3 > 0))), attempt(2, ids.slice(10, 40).map((q, i) => ans(q, i % 4 > 0)))];
  const s = stats.computeStats(history, bank, stats.computeStates(history, cfg, NOW), cfg, NOW);
  const now = stats.readinessAt(history, bank, cfg, NOW);
  assert.equal(now.readiness, s.totals.readiness);
  assert.equal(now.answers, 50);
  const before = stats.readinessAt(history, bank, cfg, NOW - 5 * DAY);
  assert.equal(before.answers, 20);
  assert.equal(before.readiness, stats.computeReadiness(history[0].answers.map((r) => ({ domain: bank.byId.get(r.q)!.domain, ok: r.ok, ageDays: 5, longForm: false, difficulty: 'medium' as const })), bank.taxonomy.domains, bank.taxonomy.exam.pass_pct, 14).readiness);
});

// ── goal + external files, progress payload ─────────────────────────────────

it('goal.md: set, keep, clear; external scores: validation, slug ids, delete; neither is loaded as an attempt', () => {
  assert.deepEqual(prog.loadGoal(), {});
  const g = prog.saveGoal({ examDate: '2026-12-15', targetScaled: 800 }, 720);
  assert.deepEqual(g, { examDate: '2026-12-15', targetScaled: 800 });
  const text = fs.readFileSync(prog.GOAL_FILE, 'utf8');
  assert.match(text, /^kind: goal$/m);
  assert.match(text, /^exam_date: "?2026-12-15"?$/m);
  assert.match(text, /^target_scaled: 800$/m);
  assert.deepEqual(prog.saveGoal({ targetScaled: 850 }, 720), { examDate: '2026-12-15', targetScaled: 850 }, 'missing field = keep');
  assert.deepEqual(prog.saveGoal({ targetScaled: null }, 720), { examDate: '2026-12-15' }, 'null = clear');
  assert.throws(() => prog.saveGoal({ examDate: '2026-02-30' }, 720), /Ngày thi/);
  assert.throws(() => prog.saveGoal({ targetScaled: 1200 }, 720), /100 đến 1000/);
  prog.saveGoal({ examDate: '' }, 720);
  assert.equal(fs.existsSync(prog.GOAL_FILE), false, 'nothing left → file removed');

  const today = fsrs.dayKey(fsrs.localDay(NOW));
  const a = prog.addExternal({ date: today, source: 'Tutorials Dojo – Đề số 2', score: 78.25, note: 'timed | review' }, NOW);
  assert.equal(a.id, `${today}_tutorials-dojo-de-so-2`);
  assert.equal(a.score, 78.3);
  const b = prog.addExternal({ date: today, source: 'Tutorials Dojo – Đề số 2', scaled: 765 }, NOW);
  assert.equal(b.id, `${today}_tutorials-dojo-de-so-2-2`, 'unique ids');
  assert.deepEqual([b.score, b.scaled], [76.5, 765], 'only the scaled score → percent = scaled / 10');
  assert.throws(() => prog.addExternal({ date: fsrs.dayKey(fsrs.localDay(NOW) + 2), source: 'x', score: 70 }, NOW), /tương lai/);
  assert.throws(() => prog.addExternal({ date: today, source: ' ', score: 70 }, NOW), /nguồn/);
  assert.throws(() => prog.addExternal({ date: today, source: 'x' }, NOW), /Cần điểm/);
  assert.throws(() => prog.addExternal({ date: today, source: 'x', score: 120 }, NOW), /0 đến 100/);
  const listed = prog.loadExternal();
  assert.deepEqual(listed.map((s) => s.id).sort(), [a.id, b.id].sort());
  assert.equal(listed.find((s) => s.id === a.id)?.note, 'timed | review');
  // app-owned files under results/ are not attempts
  prog.saveGoal({ examDate: '2026-12-15' }, 720);
  const real = results.gradeAndSave(
    { session: { sessionId: 's', mode: 'custom', title: 'T', feedback: 'exam', timeLimit: 0, estimateTotal: 60, timingPreset: 'standard', questions: [{ id: ids[0] }], selection: { mode: 'custom' }, createdAt: new Date(NOW).toISOString(), notes: [] }, answers: [{ q: ids[0], pick: ['A'], t: 30 }], startedAt: new Date(NOW - 60_000).toISOString(), finishedAt: new Date(NOW).toISOString(), timedOut: false, timeUsed: 30 },
    bank,
  );
  const loaded = results.loadAttempts(cfg);
  assert.deepEqual(loaded.map((x) => x.id), [real.id]);
  fs.rmSync(path.join(HOME, real.file));
  assert.throws(() => prog.deleteExternal('../goal'), /không hợp lệ/);
  assert.throws(() => prog.deleteExternal('nope'), (e: Error & { status?: number }) => e.status === 404);
  prog.deleteExternal(a.id);
  assert.deepEqual(prog.loadExternal().map((s) => s.id), [b.id]);
  prog.deleteExternal(b.id);
  prog.saveGoal({ examDate: null }, 720);
  assert.equal(fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.md')).length, 0);
});

it('computeProgress: forecast for the goal date, workload until the exam, external readiness + calibration', () => {
  const history = simulatedHistory(120, 9).filter((a) => Date.parse(a.finished) < NOW - 3 * DAY);
  const atts = regradeAttempts(history, bank);
  const states = stats.computeStates(atts, cfg, NOW);
  const today = fsrs.localDay(NOW);
  prog.saveGoal({ examDate: fsrs.dayKey(today + 14) }, 720);
  const early = prog.addExternal({ date: fsrs.dayKey(today - 130), source: 'Before any app data', score: 60 }, NOW);
  const recent = prog.addExternal({ date: fsrs.dayKey(today - 1), source: 'Official practice', score: 80, scaled: 790 }, NOW);
  const p = prog.computeProgress({ cfg, bank, attempts: atts, states }, NOW);
  assert.equal(p.today, fsrs.dayKey(today));
  assert.equal(p.goal.examDate, fsrs.dayKey(today + 14));
  assert.equal(p.goal.targetScaled, bank.taxonomy.exam.pass_scaled, 'default target = pass mark');
  assert.ok(p.forecast && p.forecast.daysLeft === 14);
  assert.ok(p.forecast.onSchedule >= p.forecast.ifStopNow);
  assert.equal(p.workload.length, 15, 'today … exam day');
  assert.equal(p.workload.reduce((s, d) => s + d.due, 0) <= bank.questions.length, true);
  const e1 = p.external.find((e) => e.id === early.id)!;
  const e2 = p.external.find((e) => e.id === recent.id)!;
  assert.equal(e1.readinessAtDate, undefined, 'no app evidence before that date');
  assert.equal(typeof e2.readinessAtDate, 'number');
  assert.equal(p.external[0].id, recent.id, 'newest first');
  const c = p.externalCalibration!;
  assert.equal(c.samples, 1);
  assert.equal(c.offset, Math.round((80 - e2.readinessAtDate!) * 10) / 10);
  assert.equal(p.fsrs.version, 'fsrs-6');
  assert.equal(p.regraded, 0);
  assert.equal(prog.computeProgress({ cfg, bank, attempts: atts, states }, NOW).forecast, p.forecast, 'memoized per data state');
  // review queue on Leitner boxes: the forecast still uses FSRS memory (same numbers), the workload uses the boxes
  const leitner = makeCfg({ algorithm: 'leitner' });
  const lp = prog.computeProgress({ cfg: leitner, bank, attempts: [...atts], states: stats.computeStates(atts, leitner, NOW) }, NOW);
  assert.deepEqual(lp.forecast, p.forecast);
  assert.equal(lp.fsrs.version, 'leitner');
  assert.equal(lp.workload.length, 15);
  prog.deleteExternal(early.id);
  prog.deleteExternal(recent.id);
  prog.saveGoal({ examDate: null }, 720);
});

// ── v4: goal fields (A2/B7), exam-day checklist (B7), sealed forms + internal calibration (A1), onboarding plan (A2) ──

it('goal.md v4 fields: minutes, rest days, study/exam time, delivery, ESL, checklist merged per item; validation; round trip', () => {
  fs.rmSync(prog.GOAL_FILE, { force: true });
  const g = prog.saveGoal(
    { examDate: '2026-12-15', minutesPerDay: 45, restDays: [6, 0, 6], studyTime: '7:05', examTime: '09:30', delivery: 'online', esl: true, checklist: { esl: true, booked: false, 'not-an-item': true } },
    720,
  );
  assert.deepEqual(g, { examDate: '2026-12-15', minutesPerDay: 45, restDays: [0, 6], studyTime: '07:05', examTime: '09:30', delivery: 'online', esl: true, checklist: { esl: true } });
  const text = fs.readFileSync(prog.GOAL_FILE, 'utf8');
  for (const re of [/^minutes_per_day: 45$/m, /^study_time: "?07:05"?$/m, /^exam_time: "?09:30"?$/m, /^delivery: online$/m, /^esl: true$/m, /^checklist:\n {2}- esl$/m, /^rest_days:\n {2}- 0\n {2}- 6$/m]) {
    assert.match(text, re);
  }
  assert.match(text, /Ngày nghỉ: CN, T7/);
  // checklist: merged item by item (true = ticked, false = unticked, ids not sent keep their state)
  assert.deepEqual(prog.saveGoal({ checklist: { booked: true, 'id-name': true } }, 720).checklist, { booked: true, esl: true, 'id-name': true });
  assert.deepEqual(prog.saveGoal({ checklist: { esl: false, booked: true, 'id-name': false } }, 720).checklist, { booked: true });
  // missing = keep, null / '' / false = clear
  const kept = prog.saveGoal({ targetScaled: 800 }, 720);
  assert.deepEqual([kept.minutesPerDay, kept.delivery, kept.esl], [45, 'online', true]);
  const cleared = prog.saveGoal({ esl: false, delivery: null, restDays: [], studyTime: '', checklist: null }, 720);
  assert.deepEqual(cleared, { examDate: '2026-12-15', targetScaled: 800, minutesPerDay: 45, examTime: '09:30' });
  const bad: [Record<string, unknown>, RegExp][] = [
    [{ minutesPerDay: 2 }, /phút/],
    [{ minutesPerDay: 'x' }, /phút/],
    [{ restDays: [7] }, /Ngày nghỉ/],
    [{ restDays: [0, 1, 2, 3, 4, 5, 6] }, /ít nhất một ngày/],
    [{ studyTime: '25:00' }, /Giờ học/],
    [{ examTime: '9h' }, /Giờ thi/],
    [{ delivery: 'home' }, /online/],
    [{ esl: 'maybe' }, /esl/],
    [{ checklist: ['esl'] }, /checklist/],
  ];
  for (const [input, re] of bad) assert.throws(() => prog.saveGoal(input, 720), (e: Error & { status?: number }) => e.status === 400 && re.test(e.message), JSON.stringify(input));
  assert.equal(prog.loadGoal().minutesPerDay, 45, 'a rejected update changes nothing');
  // an unquoted 20:30 read by a YAML 1.1 tool (sexagesimal 1230) still means 20:30; checklist ids of a newer version survive
  fs.writeFileSync(prog.GOAL_FILE, '---\nkind: goal\nstudy_time: 1230\nchecklist: [esl, from-the-future]\n---\n');
  assert.deepEqual(prog.loadGoal(), { studyTime: '20:30', checklist: { esl: true, 'from-the-future': true } });
  assert.deepEqual(prog.saveGoal({ checklist: { esl: false, 'from-the-future': false } }, 720).checklist, { 'from-the-future': true }, 'unknown ids are not touched');
  prog.saveGoal({ studyTime: null, checklist: null }, 720);
  assert.equal(fs.existsSync(prog.GOAL_FILE), false, 'nothing left → file removed');
});

it('exam-day checklist: due dates from the exam date, overdue items, delivery-specific items, ESL requested after booking', () => {
  const today = fsrs.localDay(NOW);
  const exam = fsrs.dayKey(today + 10);
  const list = prog.examChecklist({ examDate: exam }, NOW);
  assert.deepEqual(list.map((c) => c.id), ['esl', 'booked', 'id-name', 'rehearsal', 'reschedule', 'system-test', 'after'], 'no delivery chosen → the online items');
  const by = Object.fromEntries(list.map((c) => [c.id, c]));
  assert.deepEqual([by.esl.due, by.esl.overdue], [fsrs.dayKey(today - 20), true]);
  assert.deepEqual([by['id-name'].due, by['id-name'].overdue], [fsrs.dayKey(today - 4), true]);
  assert.deepEqual([by.rehearsal.due, by.rehearsal.overdue], [fsrs.dayKey(today + 3), undefined]);
  assert.deepEqual([by.reschedule.due, by['system-test'].due, by.after.due], [fsrs.dayKey(today + 9), fsrs.dayKey(today + 9), exam]);
  assert.ok(list.every((c) => c.label && c.dueText && c.hint && c.done === false));
  assert.ok(list.filter((c) => c.link).every((c) => /^https:\/\/(aws\.amazon\.com|www\.pearsonvue\.com)\//.test(c.link!)), 'official links only');
  const center = prog.examChecklist({ examDate: exam, delivery: 'center', checklist: { esl: true, 'id-name': true } }, NOW);
  assert.ok(center.some((c) => c.id === 'center') && !center.some((c) => c.id === 'system-test'));
  const cb = Object.fromEntries(center.map((c) => [c.id, c]));
  assert.deepEqual([cb.esl.done, cb.esl.overdue, cb['id-name'].done, cb['id-name'].overdue], [true, undefined, true, undefined], 'done items are never overdue');
  // booked without the ESL extension: it only applies to later registrations → overdue even without an exam date
  const noDate = prog.examChecklist({ checklist: { booked: true } }, NOW);
  assert.ok(noDate.every((c) => c.due === undefined));
  assert.deepEqual([noDate.find((c) => c.id === 'esl')!.overdue, noDate.find((c) => c.id === 'booked')!.done], [true, true]);
});

it('sealed forms: suggested dates ≈ exam − 21 / − 7 (never before today, none without a future exam date), score of a used form', () => {
  assert.deepEqual([0, 1].map((i) => prog.sealedOffset(i, 2)), [21, 7]);
  assert.deepEqual([0, 1, 2].map((i) => prog.sealedOffset(i, 3)), [21, 14, 7]);
  assert.equal(prog.sealedOffset(0, 1), 7);
  const today = fsrs.localDay(NOW);
  const state = {
    size: 10,
    forms: [
      { id: 'S1', ids: ids.slice(0, 10), status: 'sealed' as const },
      { id: 'S2', ids: ids.slice(10, 20), status: 'sealed' as const },
    ],
  };
  const far = prog.sealedProgress(state, [], { examDate: fsrs.dayKey(today + 60) }, NOW);
  assert.deepEqual(far.map((f) => [f.id, f.status, f.count, f.suggested, f.due]), [['S1', 'sealed', 10, fsrs.dayKey(today + 39), false], ['S2', 'sealed', 10, fsrs.dayKey(today + 53), false]]);
  assert.ok(far.every((f) => !('ids' in f)), 'no question ids');
  const near = prog.sealedProgress(state, [], { examDate: fsrs.dayKey(today + 10) }, NOW);
  assert.deepEqual(near.map((f) => [f.suggested, f.due]), [[fsrs.dayKey(today), true], [fsrs.dayKey(today + 3), false]], 'exam − 21 already passed → today');
  assert.ok(prog.sealedProgress(state, [], {}, NOW).every((f) => f.suggested === undefined), 'no exam date');
  assert.ok(prog.sealedProgress(state, [], { examDate: fsrs.dayKey(today - 1) }, NOW).every((f) => f.suggested === undefined), 'exam date passed');
  const a = attempt(2, ids.slice(0, 10).map((q, i) => ans(q, i < 7)), { sealedForm: 'S1', score: 70, scaled: 700, total: 10, correct: 7, file: 'results/x.md' });
  const forms = [{ ...state.forms[0], status: 'used' as const, attempt: a.id, usedAt: a.finished }, { ...state.forms[1], status: 'released' as const }];
  const used = prog.sealedProgress({ ...state, forms }, [a], { examDate: fsrs.dayKey(today + 10) }, NOW);
  assert.deepEqual(used.map((f) => [f.status, f.score, f.scaled, f.attempt, f.suggested]), [['used', 70, 700, a.id, undefined], ['released', undefined, undefined, undefined, undefined]]);
  // R2 #2: only the sitting sealed.md records is the form's score — not the latest attempt carrying sealed_form
  assert.equal(prog.sealedProgress({ ...state, forms: [{ ...state.forms[0], status: 'used' as const }] }, [a], {}, NOW)[0].score, undefined);
  const retake = attempt(1, ids.slice(0, 10).map((q) => ans(q, true)), { sealedForm: 'S1', score: 100, scaled: 1000, total: 10, correct: 10 });
  assert.equal(prog.sealedProgress({ ...state, forms }, [a, retake], {}, NOW)[0].score, 70, 'a later sitting of the same form does not replace it');
});

it('R2 #5 sealed forms: suggested dates are spread over the forms that are still sealed', () => {
  const today = fsrs.localDay(NOW);
  const exam = today + 42;
  const mk = (id: string, status: 'sealed' | 'used' | 'released') => ({ id, status, ids: ['a', 'b'] });
  const dates = (forms: ReturnType<typeof mk>[]) => prog.sealedProgress({ forms, size: 2 }, [], { examDate: fsrs.dayKey(exam) }, NOW).map((f) => `${f.id}:${f.suggested ? exam - fsrs.dayOfKey(f.suggested)! : '-'}`);
  assert.deepEqual(dates([mk('S1', 'sealed'), mk('S2', 'sealed')]), ['S1:21', 'S2:7']);
  assert.deepEqual(dates([mk('S1', 'used'), mk('S2', 'used'), mk('S3', 'sealed'), mk('S4', 'sealed')]), ['S1:-', 'S2:-', 'S3:21', 'S4:7'], 'new forms after used ones start at T−21');
  assert.deepEqual(dates([mk('S1', 'used'), mk('S2', 'used'), mk('S3', 'sealed')]), ['S1:-', 'S2:-', 'S3:7'], 'one form left → the last check, T−7');
  assert.deepEqual(dates([mk('S1', 'released'), mk('S2', 'sealed'), mk('S3', 'sealed'), mk('S4', 'sealed')]), ['S1:-', 'S2:21', 'S3:14', 'S4:7']);
});

/** results/sealed.md fixture in the sealed.ts format (tmp + rename: a new inode, so every reader re-parses). */
function writeSealedFixture(forms: Record<string, unknown>[]): string {
  const file = path.join(RESULTS_DIR, 'sealed.md');
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(`${file}.tmp`, stringifyFrontMatter({ kind: 'sealed', size: 20, forms }) + '\n# 🔒 Đề niêm phong (test)\n');
  fs.renameSync(`${file}.tmp`, file);
  return file;
}

it('computeProgress v4: the sitting sealed.md records is the only internal calibration point; checklist, studyStart, goal echo', () => {
  const history = simulatedHistory(120, 21).filter((a) => Date.parse(a.finished) < NOW - 3 * DAY);
  const sealedAttempt = attempt(2, ids.slice(0, 20).map((q, i) => ans(q, i % 2 === 0)), { sealedForm: 'S1', score: 50, scaled: 500, total: 20, correct: 10, file: 'results/2026/10/sealed-exam.md' });
  // R2 #2: a second sitting of S1 written before the fix (it still carries sealed_form) — never a calibration point
  const retake = attempt(1, ids.slice(0, 20).map((q) => ans(q, true)), { sealedForm: 'S1', score: 100, scaled: 1000, total: 20, correct: 20, file: 'results/2026/10/sealed-retake.md' });
  const rushedEarly = attempt(300, [ans(ids[0], true, { t: 1 })], { rushed: true });
  const sealedFile = writeSealedFixture([
    { id: 'S1', status: 'used', used_at: sealedAttempt.finished, attempt_id: sealedAttempt.id, ids: ids.slice(0, 20) },
    { id: 'S2', status: 'sealed', ids: ids.slice(20, 40) },
  ]);
  const atts = regradeAttempts([rushedEarly, ...history, sealedAttempt, retake], bank, cfg);
  const states = stats.computeStates(atts, cfg, NOW);
  prog.saveGoal({ examDate: fsrs.dayKey(fsrs.localDay(NOW) + 30), delivery: 'center', checklist: { booked: true } }, 720);
  const p = prog.computeProgress({ cfg, bank, attempts: atts, states }, NOW);
  const internal = p.external.filter((e) => e.internal);
  assert.equal(internal.length, 1);
  const e = internal[0];
  assert.deepEqual([e.id, e.source, e.score, e.scaled, e.attempt, e.file], [`sealed-${sealedAttempt.id}`, 'Đề niêm phong S1', 50, 500, sealedAttempt.id, sealedAttempt.file]);
  assert.equal(e.date, fsrs.dayKey(fsrs.localDay(Date.parse(sealedAttempt.finished))));
  const before = stats.readinessAt(atts.filter((a) => a.id !== sealedAttempt.id), bank, cfg, Date.parse(sealedAttempt.finished));
  assert.ok(before.answers >= prog.MIN_CALIBRATION_ANSWERS);
  assert.equal(e.readinessAtDate, before.readiness, 'the readiness just before the sealed exam, its own answers left out');
  assert.deepEqual([p.externalCalibration?.samples, p.externalCalibration?.offset], [1, Math.round((50 - before.readiness) * 10) / 10]);
  assert.throws(() => prog.deleteExternal(e.id), (err: Error & { status?: number }) => err.status === 404, 'internal points cannot be deleted');
  const first = Math.min(...history.map((a) => Date.parse(a.finished)));
  assert.equal(p.studyStart, fsrs.dayKey(fsrs.localDay(first)), 'the first NON-rushed attempt');
  assert.deepEqual(p.goal, { examDate: fsrs.dayKey(fsrs.localDay(NOW) + 30), targetScaled: 720, delivery: 'center', checklist: { booked: true } });
  assert.ok(p.checklist?.some((c) => c.id === 'center' && c.due) && p.checklist.find((c) => c.id === 'booked')!.done);
  assert.equal(p.checklistChecked, prog.CHECKLIST_CHECKED);
  assert.deepEqual(p.sealed?.map((f) => [f.id, f.status, f.attempt, f.score]), [['S1', 'used', sealedAttempt.id, 50], ['S2', 'sealed', undefined, undefined]]);
  assert.equal(p.sealed?.[1].suggested, fsrs.dayKey(fsrs.localDay(NOW) + 30 - 7), 'the only form still sealed → exam − 7');
  // nothing recorded in sealed.md (e.g. a form released before the submit) → no calibration point at all
  writeSealedFixture([{ id: 'S1', status: 'released', ids: ids.slice(0, 20) }]);
  assert.deepEqual(prog.computeProgress({ cfg, bank, attempts: atts, states }, NOW).external.filter((x) => x.internal), []);
  fs.rmSync(sealedFile, { force: true });
  assert.equal(prog.computeProgress({ cfg, bank, attempts: [], states: new Map() }, NOW).studyStart, undefined);
  prog.saveGoal({ examDate: null, delivery: null, checklist: null }, 720);
});

it('onboarding: week-1 plan from the diagnostic halves — weakest tasks first, spaced review, end-of-week mock; one file per day', () => {
  fs.rmSync(PLANS_DIR, { recursive: true, force: true });
  const today = fsrs.dayKey(fsrs.localDay(NOW));
  const byTask = (t: string) => bank.questions.filter((q) => q.task === t);
  // a 2 × 14 style split: 1.1 and 2.1 missed, 3.1 half right, the rest right
  const half1 = attempt(1, [...byTask('1.1').slice(0, 2).map((q) => ans(q.id, false)), ...byTask('2.1').slice(0, 2).map((q) => ans(q.id, false)), ...byTask('3.1').slice(0, 2).map((q, i) => ans(q.id, i === 0))], { mode: 'diagnostic', diagnostic: true });
  const half2 = attempt(0.5, ['1.2', '2.2', '3.2', '4.1', '4.2'].flatMap((t) => byTask(t).slice(0, 2).map((q) => ans(q.id, true))), { mode: 'diagnostic', diagnostic: true });
  const later = attempt(0.2, [ans(byTask('4.1')[4].id, false)]); // a practice test after the diagnostic is not part of it
  const atts = regradeAttempts([half1, half2, later], bank, cfg);
  const ctx = { cfg, bank, attempts: atts, states: stats.computeStates(atts, cfg, NOW) };
  const r = onboarding.onboardingPlan(ctx, { now: NOW });
  assert.equal(r.created, true);
  const t = Object.fromEntries(r.tasks.map((x) => [x.task, x]));
  assert.deepEqual(['1.1', '2.1', '3.1', '4.1', '1.3'].map((k) => t[k].status), ['weak', 'weak', 'partial', 'ok', 'untested']);
  assert.deepEqual([t['1.1'].answers, t['1.1'].correct, t['4.1'].answers], [2, 0, 2], 'only the diagnostic counts');
  assert.equal(r.tasks.length, bank.taxonomy.tasks.length);
  assert.deepEqual(r.tasks.map((x) => x.priority), [...r.tasks.map((x) => x.priority)].sort((a, b) => b - a), 'weakest first');
  const tax = bank.taxonomy;
  const weight = (d: string) => tax.domains.find((x) => x.id === d)!.weight / tax.domains.reduce((s, x) => s + x.weight, 0) / tax.tasks.filter((x) => x.domain === d).length;
  assert.equal(t['2.1'].priority, Math.round(1000 * weight('resilient') * (1 - 1 / 4)) / 10);
  assert.equal(t['1.3'].priority, Math.round(1000 * weight('secure') * 0.5) / 10, 'untested → prior 1/2');
  // the plan file: coach plan schema, trigger onboarding
  const plan = r.plan;
  assert.deepEqual([plan.id, plan.file, plan.trigger], [`plan-${today}-onboarding`, `coach/plans/${today}-onboarding.md`, 'onboarding']);
  assert.ok(plan.sessions.length >= 4 && plan.sessions.length <= 6, `${plan.sessions.length} sessions`);
  const fixes = plan.sessions.filter((s) => s.questions?.length);
  assert.deepEqual(fixes.map((s) => s.title.split(' · ')[0]), ['Vá task 2.1', 'Vá task 1.1', 'Vá task 2.2'], 'highest priority tasks that have questions (1.3 has none here)');
  const s1 = fixes[0];
  assert.ok(s1.questions!.every((id) => bank.byId.get(id)!.task === '2.1'));
  assert.deepEqual(new Set(s1.questions), new Set(byTask('2.1').map((q) => q.id)));
  const seenInDiagnostic = new Set(half1.answers.map((a) => a.q));
  assert.ok(s1.questions!.slice(0, 3).every((id) => !seenInDiagnostic.has(id)), 'never-seen questions first');
  assert.equal(s1.feedback, 'practice');
  const review = plan.sessions.find((s) => s.filter?.mode === 'srs')!;
  assert.ok(review && review.feedback === 'practice');
  const mock = plan.sessions.at(-1)!;
  assert.deepEqual([mock.filter?.mode, mock.filter?.pearson, mock.feedback], ['exam', true, 'exam'], 'end-of-week Pearson mock');
  const abs = path.join(PLANS_DIR, `${today}-onboarding.md`);
  const text = fs.readFileSync(abs, 'utf8');
  const fm = splitFrontMatter(text);
  assert.deepEqual([fm.data.kind, fm.data.source_attempts], ['plan', [half1.id, half2.id]]);
  assert.match(fm.body, /## 2\. Bản đồ xuất phát/);
  assert.match(fm.body, /\| 1\.1 · .* \| 0\/2 \| ✗ cần vá \|/);
  assert.equal(loadPlans(atts)[0].id, plan.id, 'newest plan → shown on the Dashboard');
  // same day, same diagnostic → the stored plan, untouched
  const mtime = fs.statSync(abs).mtimeMs;
  const again = onboarding.onboardingPlan(ctx, { now: NOW + 60_000 });
  assert.equal(again.created, false);
  assert.deepEqual(again.plan, plan);
  assert.equal(fs.statSync(abs).mtimeMs, mtime);
  assert.equal(fs.readdirSync(PLANS_DIR).filter((f) => f.endsWith('.md')).length, 1);
  // a third diagnostic part changes the source → today's file is rewritten (still one file)
  const half3 = attempt(0.1, byTask('1.1').slice(2, 4).map((q) => ans(q.id, true)), { mode: 'diagnostic', diagnostic: true });
  const atts3 = regradeAttempts([half1, half2, later, half3], bank, cfg);
  const r3 = onboarding.onboardingPlan({ ...ctx, attempts: atts3, states: stats.computeStates(atts3, cfg, NOW) }, { now: NOW + 120_000 });
  assert.equal(r3.created, true);
  assert.deepEqual(splitFrontMatter(fs.readFileSync(abs, 'utf8')).data.source_attempts, [half1.id, half2.id, half3.id]);
  assert.equal(r3.tasks.find((x) => x.task === '1.1')!.status, 'partial');
  assert.equal(fs.readdirSync(PLANS_DIR).filter((f) => f.endsWith('.md')).length, 1);
  // explicit attempt id: unknown → 404; a non-diagnostic attempt is used on its own
  assert.throws(() => onboarding.onboardingPlan(ctx, { attemptId: 'nope', now: NOW }), (e: Error & { status?: number }) => e.status === 404);
  assert.deepEqual(onboarding.diagnosticSource(atts, later.id).map((a) => a.id), [later.id]);
  assert.deepEqual(onboarding.diagnosticSource(atts, half2.id).map((a) => a.id), [half1.id, half2.id]);
  assert.deepEqual(onboarding.diagnosticSource(atts, half1.id).map((a) => a.id), [half1.id, half2.id], 'either part finds the other, oldest first');
  assert.deepEqual(onboarding.diagnosticSource([later]).map((a) => a.id), [later.id], 'no diagnostic → what there is');
  fs.rmSync(PLANS_DIR, { recursive: true, force: true });
});

it('R2 #6 onboarding: when the first sealed form is due this week, the plan session is pinned to that form', () => {
  fs.rmSync(PLANS_DIR, { recursive: true, force: true });
  const today = fsrs.localDay(NOW);
  const sealedFile = writeSealedFixture([
    { id: 'S1', status: 'used', ids: ids.slice(0, 10) },
    { id: 'S2', status: 'sealed', ids: ids.slice(10, 20) },
    { id: 'S3', status: 'sealed', ids: ids.slice(20, 30) },
  ]);
  prog.saveGoal({ examDate: fsrs.dayKey(today + 10) }, 720);
  try {
    const diag = attempt(0.5, ids.slice(30, 40).map((q, i) => ans(q, i % 2 === 0)), { mode: 'diagnostic', diagnostic: true });
    const atts = regradeAttempts([diag], bank, cfg);
    const r = onboarding.onboardingPlan({ cfg, bank, attempts: atts, states: stats.computeStates(atts, cfg, NOW) }, { now: NOW });
    const last = r.plan.sessions.at(-1)!;
    assert.deepEqual([last.filter?.mode, last.filter?.form], ['sealed', 'S2'], 'the form the title names (the next sealed one), not "whichever is next" at start time');
    assert.match(last.title, /S2/);
    assert.ok(!r.plan.sessions.some((s) => s.questions?.some((id) => ids.slice(10, 30).includes(id))), 'no sealed question in the plan');
  } finally {
    fs.rmSync(sealedFile, { force: true });
    fs.rmSync(PLANS_DIR, { recursive: true, force: true });
    prog.saveGoal({ examDate: null }, 720);
  }
});
