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

const { DATA_DIR, RESULTS_DIR, SNAPSHOT_FILE } = await import('../server/config.ts');
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
const { stringifyFrontMatter } = await import('../server/lib/frontmatter.ts');

const DAY = 86_400_000;
const NOW = Date.now();

function makeCfg(srs: Partial<AppConfig['srs']> = {}): AppConfig {
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
      verify: { auto: false, auto_draft: false, batch_size: 10 },
    },
    srs: { algorithm: 'fsrs', desired_retention: 0.9, daily_limit: 50, mastered_stability_days: 21, intervals_days: [1, 3, 7, 14, 30], mastered_box: 4, weights: [], optimize: 'manual', optimize_min_reviews: 400, ...srs },
    practice: { default_count: 20, quick_count: 10, shuffle_options: true },
    stats: { rushed_median_seconds: 5, recency_half_life_days: 14 },
    quality: { embeddings: 'off', ollama_url: '', embedding_model: '', semantic_threshold: 0.88 },
    server: { lan: false },
    export: { anki_deck: 'test', ankiconnect_url: '' },
    cache: { sqlite: false },
    sync: { data_paths: [], before_ai: false, after_ai: false },
  };
}
const cfg = makeCfg();

// ── generated bank: 10 questions per domain, answer key A ───────────────────
const DOMAINS: DomainId[] = ['secure', 'resilient', 'performance', 'cost'];
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

it('regradeAttempts: answers graded with an old key count against the current key; copies only, identity kept', () => {
  const q = ids[0];
  const old = attempt(5, [ans(q, true, { key: 'B', pick: 'B' }), ans(ids[1], true)]); // was right with key B, the key is now A
  const lucky = attempt(4, [{ q, pick: 'A', key: 'C', ok: false, t: 40, est: 60 }]); // was wrong, A is now the key
  const same = attempt(3, [ans(q, true), ans(ids[2], false)]);
  const list = [old, lucky, same];
  const out = regradeAttempts(list, bank);
  assert.notEqual(out, list, 'a new array when something was re-graded');
  assert.equal(out[2], same, 'unchanged attempts keep their identity');
  assert.equal(out[0].answers[1], old.answers[1], 'unchanged answers keep their identity');
  assert.deepEqual(out[0].answers[0], { ...old.answers[0], key: 'A', ok: false, regraded: true });
  assert.deepEqual(out[1].answers[0], { ...lucky.answers[0], key: 'A', ok: true, regraded: true });
  assert.equal(old.answers[0].ok, true, 'the input is never mutated');
  assert.equal(regradeAttempts(list, bank), out, 'cached by input identity + bank version');
  const clean = [same];
  assert.equal(regradeAttempts(clean, bank), clean, 'nothing to re-grade → the same array');
  // formatting differences of the stored key are not a key change; unknown questions stay as they are
  assert.equal(regradeAnswer(ans(q, true, { key: 'a' }), 'A').regraded, undefined);
  const gone = ans('not-in-bank', true, { key: 'B', pick: 'B' });
  assert.equal(regradeAttempts([attempt(1, [gone])], bank)[0].answers[0], gone);
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
