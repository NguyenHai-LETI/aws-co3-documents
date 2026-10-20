// Unit tests for the v5 exam-aware schedule (λ): phases, new-question quota, final-review (advance) queue, catch-up,
// go / no-go, the due-date planner (load balancing ON here — it is off in sandboxes and the other test configs,
// final-review clamp, final_retention ramp), computeStates replay stability, the examAware / capacity forecast lines and
// the sprint plan. Uses a throw-away data root (TRAINER_HOME) with a generated pack — never the real bank/results.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from '../server/config.ts';
import type { AnswerRecord, Attempt, DomainId, ExamGoal } from '../shared/types.ts';

const TRAINER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-schedule-'));
fs.mkdirSync(path.join(HOME, 'bank', 'packs', 'manual'), { recursive: true });
fs.copyFileSync(path.join(TRAINER, 'bank', 'taxonomy.yaml'), path.join(HOME, 'bank', 'taxonomy.yaml'));
process.env.TRAINER_HOME = HOME;
after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const { DATA_DIR, PLANS_DIR } = await import('../server/config.ts');
const it = DATA_DIR === HOME ? test : test.skip;

const fsrs = await import('../server/lib/fsrs.ts');
const stats = await import('../server/lib/stats.ts');
const sched = await import('../server/lib/exam-schedule.ts');
const { DuePlanner } = await import('../server/lib/due-planner.ts');
const fc = await import('../server/lib/forecast.ts');
const sprint = await import('../server/lib/sprint.ts');
const prog = await import('../server/lib/progress.ts');
const { regradeAttempts } = await import('../server/lib/regrade.ts');
const { loadBank } = await import('../server/lib/bank.ts');
const { serializePack } = await import('../server/lib/pack-format.ts');
const { stringifyFrontMatter, splitFrontMatter } = await import('../server/lib/frontmatter.ts');

const DAY = 86_400_000;
const NOW = Date.now();
const TODAY = fsrs.localDay(NOW);
const key = (offset: number) => fsrs.dayKey(TODAY + offset);

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
    srs: { algorithm: 'fsrs', desired_retention: 0.9, daily_limit: 50, mastered_stability_days: 21, intervals_days: [1, 3, 7, 14, 30], mastered_box: 4, weights: [], optimize: 'off', optimize_min_reviews: 400, exam_aware: true, final_review_days: 7, new_cutoff_days: 10, load_balance: false, final_retention: 0, leech_lapses: 3, sibling_swap_days: 7, ...srs },
    practice: { default_count: 20, quick_count: 10, shuffle_options: true, exclude_out_of_scope: false, today_minutes: 25, relearn: true },
    exam: { sealed_forms: 0, sealed_size: 50 },
    stats: { rushed_median_seconds: 5, recency_half_life_days: 14, recognized_wpm: 300 },
    quality: { embeddings: 'off', ollama_url: '', embedding_model: '', semantic_threshold: 0.88, longform_target_per_task: 12 },
    server: { lan: false, lan_admin: false, https: 'off', https_cert: '', https_key: '' },
    export: { anki_deck: 'test', ankiconnect_url: '' },
    cache: { sqlite: false },
    sync: { data_paths: [], before_ai: false, after_ai: false, auto: 'off', auto_delay_minutes: 4 },
  } as AppConfig;
}
const cfg = makeCfg();

// ── generated bank: 15 questions per domain, key A ──
const DOMAINS: DomainId[] = ['secure', 'resilient', 'performance', 'cost'];
const drafts = DOMAINS.flatMap((d, di) =>
  Array.from({ length: 15 }, (_, i) => ({
    id: `${d.slice(0, 3)}-${String(i + 1).padStart(2, '0')}`,
    stem: `Case ${i + 1} of ${d}: ${['latency', 'archive', 'failover', 'budget'][di]} constraint number ${i * 7 + di} with distinct wording ${d}${i}. Which option?`,
    options: ['A', 'B', 'C', 'D'].map((k, n) => ({ key: k, text: `Option ${k} ${n} for ${d} item ${i}` })),
    answer: ['A'],
    explanation: 'Because.',
    domain: d,
    topic: 'storage',
    difficulty: 'medium' as const,
    time: 60,
    task: `${di + 1}.1`,
  })),
);
fs.writeFileSync(path.join(HOME, 'bank', 'packs', 'manual', 'schedule-test.md'), serializePack({ pack: 'schedule-test', title: 'Schedule test', origin: 'manual' }, '', drafts, (x) => stringifyFrontMatter(x)));
const bank = loadBank();
const ids = bank.questions.map((q) => q.id);

const ans = (q: string, ok: boolean, extra: Partial<AnswerRecord> = {}): AnswerRecord => ({ q, pick: ok ? 'A' : 'B', key: 'A', ok, t: 60, est: 60, ...extra });
let seq = 0;
const attempt = (daysAgo: number, answers: AnswerRecord[], extra: Partial<Attempt> = {}): Attempt =>
  ({ id: `s${++seq}`, mode: 'custom', title: 't', finished: new Date(NOW - daysAgo * DAY).toISOString(), answers, score: 0, total: answers.length, ...extra }) as Attempt;
function ctxOf(history: Attempt[], c: AppConfig = cfg, goal?: ExamGoal) {
  const attempts = regradeAttempts(history, bank, c);
  return { cfg: c, bank, attempts, states: stats.computeStates(attempts, c, NOW, undefined, { goal }) };
}

// ── phases ──────────────────────────────────────────────────────────────────

it('examPhase: build > 14 · measure 14…8 · consolidate 7…3 · light 2…1 · exam-day 0 · after < 0; off without a date or exam_aware', () => {
  const at = (left: number) => sched.examPhase({ examDate: key(left) }, key(0), cfg)!;
  assert.deepEqual([20, 15, 14, 8, 7, 3, 2, 1, 0, -1].map((d) => at(d).id), ['build', 'build', 'measure', 'measure', 'consolidate', 'consolidate', 'light', 'light', 'exam-day', 'after']);
  assert.equal(at(20).daysLeft, 20);
  assert.equal(at(20).to, key(5));
  assert.equal(at(10).from, key(0 + 10 - 14));
  assert.equal(at(5).newQuestions, false);
  assert.equal(at(9).newQuestions, true);
  assert.equal(at(2).maxMinutes, 30);
  assert.ok(at(2).rules.length && at(5).rules.some((r) => /câu mới/.test(r)));
  assert.equal(at(5).label, 'Củng cố');
  assert.equal(sched.examPhase({}, key(0), cfg), undefined);
  assert.equal(sched.examPhase({ examDate: key(5) }, key(0), makeCfg({ exam_aware: false })), undefined);
});

// ── new-question quota ──────────────────────────────────────────────────────

it('newQuota: unseen ÷ days to the cutoff, stable during the day, paused in consolidate or with a big backlog', () => {
  const history = [attempt(3, ids.slice(0, 10).map((q) => ans(q, true))), attempt(0, ids.slice(10, 14).map((q) => ans(q, true)))];
  const ctx = ctxOf(history);
  const q = sched.newQuota(ctx, { examDate: key(30) }, key(0))!;
  assert.equal(q.unseen, 60 - 14);
  assert.equal(q.doneToday, 4);
  assert.equal(q.daysLeft, 20);
  assert.equal(q.cutoff, key(20));
  assert.equal(q.perDay, Math.ceil((46 + 4) / 20), 'unseen as of this morning');
  assert.equal(q.paused, undefined);
  const late = sched.newQuota(ctx, { examDate: key(12) }, key(0))!;
  assert.equal(late.daysLeft, 2);
  const cons = sched.newQuota(ctx, { examDate: key(5) }, key(0))!;
  assert.equal(cons.perDay, 0);
  assert.match(cons.paused!, /Củng cố/);
  assert.equal(sched.newQuota(ctx, { examDate: key(-1) }, key(0)), undefined, 'after the exam');
  assert.equal(sched.newQuota(ctx, {}, key(0)), undefined);
  // backlog > 2 × daily_limit → paused
  const small = makeCfg({ daily_limit: 4 });
  const backlog = ctxOf([attempt(40, ids.slice(0, 20).map((x) => ans(x, false)))], small);
  const p = sched.newQuota(backlog, { examDate: key(30) }, key(0))!;
  assert.equal(p.perDay, 0);
  assert.match(p.paused!, /tồn 20/);
});

it('catchUpOf: behind schedule only; extra spread over 2–7 days, never past exam − 2', () => {
  assert.equal(sched.catchUpOf(40, 50), undefined);
  assert.deepEqual(sched.catchUpOf(180, 50), { backlog: 180, days: 6, perDay: 50 + Math.ceil(130 / 6) });
  assert.equal(sched.catchUpOf(600, 50)!.days, 7);
  assert.equal(sched.catchUpOf(60, 50)!.days, 2);
  assert.equal(sched.catchUpOf(600, 50, 5)!.days, 3);
  assert.equal(sched.catchUpOf(10, 0), undefined);
});

// ── go / no-go ──────────────────────────────────────────────────────────────

it('goNoGoFrom: from T−14 only; go / reschedule / unknown; deadline = exam time − 24 h; AWS rules in the note', () => {
  const fresh = (score: number) => ({ date: key(-1), finished: new Date(NOW - DAY).toISOString(), label: 'S1', score, answers: 50, official: true });
  const forecast = { byDomain: [{ domain: 'secure', onSchedule: 80, ifStopNow: 70 }, { domain: 'cost', onSchedule: 70, ifStopNow: 60 }], seen: 40 } as never;
  const base = { today: key(0), passScaled: 720, forecast, readiness: { value: 78, answers: 300 } };
  assert.equal(sched.goNoGoFrom({ ...base, goal: { examDate: key(20) }, fresh: [fresh(85), fresh(82)] }), undefined, 'too early');
  const go = sched.goNoGoFrom({ ...base, goal: { examDate: key(10), examTime: '09:30' }, fresh: [fresh(85), fresh(82)] })!;
  assert.equal(go.verdict, 'go');
  assert.equal(go.deadline, `${key(9)}T09:30`);
  assert.match(go.note!, /24 giờ/);
  assert.match(go.note!, /14 ngày/);
  const no = sched.goNoGoFrom({ ...base, goal: { examDate: key(10) }, fresh: [fresh(85), fresh(70)] })!;
  assert.equal(no.verdict, 'reschedule');
  assert.equal(no.checks.find((c) => c.id === 'fresh')!.ok, false);
  const unknown = sched.goNoGoFrom({ ...base, goal: { examDate: key(10) }, fresh: [fresh(85)] })!;
  assert.equal(unknown.verdict, 'unknown');
  const lowDomain = sched.goNoGoFrom({ ...base, forecast: { byDomain: [{ domain: 'cost', onSchedule: 60, ifStopNow: 50 }], seen: 4 } as never, goal: { examDate: key(3) }, fresh: [fresh(85), fresh(90)] })!;
  assert.equal(lowDomain.checks.find((c) => c.id === 'domains')!.ok, false);
  const lowReady = sched.goNoGoFrom({ ...base, readiness: { value: 60, answers: 300, calibrated: 65 }, goal: { examDate: key(3) }, fresh: [fresh(85), fresh(90)] })!;
  assert.equal(lowReady.checks.find((c) => c.id === 'readiness')!.ok, false);
  assert.equal(sched.goNoGoFrom({ ...base, readiness: { value: 90, answers: 10 }, goal: { examDate: key(3) }, fresh: [] })!.checks.find((c) => c.id === 'readiness')!.ok, null);
});

it('freshScores: official sealed sittings and the first-time split of mocks with ≥ 20 first-time answers', () => {
  const mock = attempt(2, ids.slice(0, 25).map((q, i) => ans(q, i < 20)), { mode: 'exam', pearson: true });
  const small = attempt(1, ids.slice(30, 40).map((q) => ans(q, true)), { mode: 'exam' });
  const list = sched.freshScores(regradeAttempts([mock, small], bank, cfg), { forms: [], size: 50 } as never);
  assert.equal(list.length, 1);
  assert.equal(list[0].score, 80);
  assert.equal(list[0].answers, 25);
  assert.equal(list[0].official, false);
});

// ── due-date planner ────────────────────────────────────────────────────────

const W = fsrs.FSRS_WEIGHTS;
it('DuePlanner: off → day + interval; load balancing within ±5 % (≥ 1 day), ties to the earliest day; deterministic', () => {
  const off = new DuePlanner({ srs: { desired_retention: 0.9, load_balance: false, exam_aware: true, final_review_days: 7, final_retention: 0 }, weights: W, today: 0 });
  assert.equal(off.active, false);
  assert.equal(off.plan('a', 100, 10), 100 + fsrs.nextIntervalDays(10, 0.9, W));
  const run = () => {
    const p = new DuePlanner({ srs: { desired_retention: 0.9, load_balance: true, exam_aware: true, final_review_days: 7, final_retention: 0 }, weights: W, today: 0 });
    return Array.from({ length: 30 }, (_, i) => p.plan(`q${i}`, 100, 40));
  };
  const dues = run();
  const I = fsrs.nextIntervalDays(40, 0.9, W);
  const delta = Math.max(1, Math.round(0.05 * I));
  assert.ok(dues.every((d) => Math.abs(d - (100 + I)) <= delta), 'within the window');
  assert.equal(dues[0], 100 + I - delta, 'ties → earliest day');
  const counts = new Map<number, number>();
  for (const d of dues) counts.set(d, (counts.get(d) ?? 0) + 1);
  assert.ok(Math.max(...counts.values()) <= Math.ceil(30 / (2 * delta + 1)), 'evenly spread');
  assert.deepEqual(run(), dues, 'deterministic');
  // short intervals are not moved
  const p = new DuePlanner({ srs: { desired_retention: 0.9, load_balance: true, exam_aware: true, final_review_days: 7, final_retention: 0 }, weights: W, today: 0 });
  assert.equal(p.plan('x', 10, 2), 10 + fsrs.nextIntervalDays(2, 0.9, W));
});

it('DuePlanner: final-review clamp into [exam − 7, exam − 2] when recall on exam day < 0.9; final_retention ramp', () => {
  const srs = { desired_retention: 0.9, load_balance: false, exam_aware: true, final_review_days: 7, final_retention: 0 };
  const exam = 50;
  const p = new DuePlanner({ srs, weights: W, today: 30, examDay: exam });
  // S = 13 reviewed on day 36: natural due 49 > 48 and R(14 days) < 0.9 → clamped
  assert.ok(fsrs.retrievability(exam - 36, 13, W) < 0.9);
  const due = p.plan('a', 36, 13);
  assert.ok(due >= exam - 7 && due <= exam - 2, `${due}`);
  // well remembered on exam day → untouched
  assert.ok(fsrs.retrievability(exam - 36, 60, W) >= 0.9);
  assert.equal(p.plan('b', 36, 60), 36 + fsrs.nextIntervalDays(60, 0.9, W));
  // window empty (reviewed at exam − 2) → untouched
  assert.equal(p.plan('c', 48, 13), 48 + fsrs.nextIntervalDays(13, 0.9, W));
  // the exam is past → no clamp
  const past = new DuePlanner({ srs, weights: W, today: 60, examDay: exam });
  assert.equal(past.plan('a', 36, 13), 36 + fsrs.nextIntervalDays(13, 0.9, W));
  // ramp: base before exam − 14, final on exam day, linear in between (0.005 steps)
  const ramp = new DuePlanner({ srs: { ...srs, final_retention: 0.95 }, weights: W, today: 0, examDay: 100 });
  assert.equal(ramp.retentionOn(80), 0.9);
  assert.equal(ramp.retentionOn(86), 0.9);
  assert.equal(ramp.retentionOn(93), 0.925);
  assert.equal(ramp.retentionOn(100), 0.95);
  assert.equal(ramp.finalRecall, 0.95);
  assert.ok(ramp.plan('r', 95, 20) - 95 < fsrs.nextIntervalDays(20, 0.9, W), 'higher retention → shorter interval');
});

it('computeStates with load balancing ON: spreads same-day dues, and earlier due dates never move when new results arrive', () => {
  const bal = makeCfg({ load_balance: true });
  const history = [attempt(6, ids.slice(0, 40).map((q) => ans(q, true))), attempt(3, ids.slice(0, 40).map((q) => ans(q, true)))];
  const plain = stats.computeStates(history, makeCfg(), NOW);
  const spread = stats.computeStates(history, bal, NOW);
  const perDay = (m: Map<string, { dueAt?: string }>) => {
    const c = new Map<string, number>();
    for (const s of m.values()) c.set(s.dueAt!, (c.get(s.dueAt!) ?? 0) + 1);
    return c;
  };
  assert.equal(perDay(plain).size, 1, 'without balancing every due falls on one day');
  assert.ok(perDay(spread).size >= 3 && Math.max(...perDay(spread).values()) < 40, 'balanced over several days');
  // stability: appending today's answers to other questions changes nothing for the earlier ones
  const later = [...history, attempt(0, ids.slice(40, 50).map((q) => ans(q, true)))];
  const again = stats.computeStates(later, bal, NOW);
  for (const q of ids.slice(0, 40)) assert.equal(again.get(q)!.dueAt, spread.get(q)!.dueAt, q);
  assert.deepEqual([...stats.computeStates(history, bal, NOW)].map(([k, s]) => [k, s.dueAt]), [...spread].map(([k, s]) => [k, s.dueAt]), 'deterministic');
});

it('computeStates with an exam ahead: every due date is ≤ exam − 2 or the question is still recalled on exam day', () => {
  const goal = { examDate: key(12) };
  const history: Attempt[] = [];
  for (const [i, d] of [40, 30, 22, 15, 9, 5, 2].entries()) history.push(attempt(d, ids.slice(i * 5, i * 5 + 25).map((q) => ans(q, true))));
  const states = stats.computeStates(history, cfg, NOW, undefined, { goal });
  const exam = TODAY + 12;
  let clamped = 0;
  const free = stats.computeStates(history, cfg, NOW);
  for (const s of states.values()) {
    const due = fsrs.localDay(Date.parse(s.dueAt!));
    const last = fsrs.localDay(Date.parse(s.lastAt!));
    const r = fsrs.retrievability(exam - last, s.stability!, W);
    assert.ok(due <= exam - 2 || r >= 0.9 - 0.005, `${s.id}: due ${due - TODAY}, R(exam) ${r}`);
    if (s.dueAt !== free.get(s.id)!.dueAt) clamped++;
  }
  assert.ok(clamped > 0, 'some due dates moved into the final-review window');
});

// ── advance queue ───────────────────────────────────────────────────────────

it('advanceQueue: not-yet-due questions with the lowest recall on exam day first; none without an exam ahead', () => {
  const history = [attempt(4, ids.slice(0, 20).map((q) => ans(q, true))), attempt(2, ids.slice(0, 20).map((q) => ans(q, true))), attempt(1, ids.slice(20, 30).map((q) => ans(q, true))), attempt(15, ids.slice(30, 35).map((q) => ans(q, false)))];
  const ctx = ctxOf(history);
  const goal = { examDate: key(10) };
  const list = sched.advanceQueue(ctx, goal, key(0), 50);
  assert.ok(list.length > 0);
  for (const id of list) assert.ok(!stats.isDue(ctx.states.get(id)!, NOW), `${id} not due`);
  const recall = (id: string) => {
    const m = fc.memoryOf(ctx.states.get(id))!;
    return fsrs.retrievability(TODAY + 10 - m.lastDay, m.stability, W);
  };
  assert.ok(list.every((id) => recall(id) < 0.9));
  assert.ok(recall(list[0]) <= recall(list.at(-1)!) + 0.05, 'lowest recall first (× domain weight)');
  assert.deepEqual(sched.advanceQueue(ctx, goal, key(0), 50), list, 'deterministic');
  assert.deepEqual(sched.advanceQueue(ctx, {}, key(0), 50), []);
  assert.equal(sched.advanceQueue(ctx, goal, key(0), 3).length, Math.min(3, list.length));
});

// ── forecast lines ──────────────────────────────────────────────────────────

it('forecastExam: examAware ≥ the plain schedule; capacity grows with minutes per day and includes the goal minutes', () => {
  const history = [attempt(20, ids.slice(0, 30).map((q, i) => ans(q, i % 4 !== 0))), attempt(10, ids.slice(0, 30).map((q) => ans(q, true)))];
  const ctx = ctxOf(history);
  const f = fc.forecastExam(ctx.states, bank, ctx.attempts, key(40), {
    weights: W,
    desiredRetention: 0.9,
    now: NOW,
    policy: { srs: cfg.srs, minutesPerDay: 30, pace: 1 },
  });
  assert.ok(f.examAware! >= f.onSchedule - 0.5, `${f.examAware} vs ${f.onSchedule}`);
  assert.deepEqual(f.capacity!.map((c) => c.minutesPerDay), [10, 20, 30, 45]);
  const exp = f.capacity!.map((c) => c.expected);
  for (let i = 1; i < exp.length; i++) assert.ok(exp[i] >= exp[i - 1] - 0.2, `${exp}`);
  assert.ok(f.capacity!.every((c) => c.reviewsPerDay >= 0 && c.expected > 0 && c.expected <= 100));
  const off = fc.forecastExam(ctx.states, bank, ctx.attempts, key(40), { weights: W, desiredRetention: 0.9, now: NOW, policy: { srs: makeCfg({ exam_aware: false }).srs } });
  assert.equal(off.examAware, undefined);
  assert.equal(off.capacity, undefined);
});

it('computeProgress: phase, newQuota, catch-up and go / no-go from the goal; examAware forecast', () => {
  const history = [attempt(4, ids.slice(0, 20).map((q) => ans(q, true)), { mode: 'exam' })];
  const ctx = ctxOf(history);
  const p = prog.computeProgress(ctx, NOW, { examDate: key(9) });
  assert.equal(p.phase?.id, 'measure');
  assert.ok(p.newQuota && p.newQuota.unseen === 40);
  assert.ok(p.goNoGo && ['go', 'reschedule', 'unknown'].includes(p.goNoGo.verdict));
  assert.equal(typeof p.forecast?.examAware, 'number');
  assert.equal(p.catchUp, undefined);
  const none = prog.computeProgress(ctx, NOW, {});
  assert.equal(none.phase, undefined);
  assert.equal(none.goNoGo, undefined);
  assert.equal(sched.goNoGo(ctx, { examDate: key(9) }, key(0))?.verdict, p.goNoGo!.verdict);
});

// ── sprint plan ─────────────────────────────────────────────────────────────

it('sprint plan: deterministic sessions T−14 … T−1, one file per day (idempotent), 400 without an exam within 14 days', () => {
  const history = [attempt(2, ids.slice(0, 20).map((q) => ans(q, true)))];
  const ctx = ctxOf(history);
  const goal = { examDate: key(12), examTime: '09:00' };
  const sessions = sprint.sprintSessions(ctx, goal, NOW);
  assert.deepEqual(sprint.sprintSessions(ctx, goal, NOW), sessions, 'deterministic');
  assert.ok(sessions.every((s) => s.day >= key(0) && s.day < key(12)));
  assert.equal(new Set(sessions.map((s) => s.id)).size, sessions.length, 'unique session ids');
  assert.ok(sessions.some((s) => (s.filter as { pearson?: boolean })?.pearson && s.day === key(2)), 'T−10 mock');
  assert.ok(sessions.some((s) => s.day === key(5) && (s.filter as { mode?: string })?.mode === 'exam'), 'T−7 rehearsal');
  assert.ok(sessions.filter((s) => s.day >= key(10)).every((s) => (s.filter as { mode?: string })?.mode === 'today'), 'light days');
  const r1 = sprint.sprintPlan(ctx, { now: NOW, goal });
  assert.equal(r1.created, true);
  assert.equal(r1.plan.trigger, 'sprint');
  assert.equal(r1.plan.sessions.length, sessions.length);
  const file = path.join(PLANS_DIR, `${key(0)}-sprint.md`);
  const text = fs.readFileSync(file, 'utf8');
  assert.equal(splitFrontMatter(text).data.trigger, 'sprint');
  assert.match(text, /T−0 \| 🏁 Ngày thi/);
  const r2 = sprint.sprintPlan(ctx, { now: NOW, goal });
  assert.equal(r2.created, false);
  assert.equal(fs.readFileSync(file, 'utf8'), text, 'unchanged');
  assert.throws(() => sprint.sprintPlan(ctx, { now: NOW, goal: { examDate: key(30) } }), /14 ngày/);
  assert.throws(() => sprint.sprintPlan(ctx, { now: NOW, goal: {} }), /ngày thi/);
  assert.throws(() => sprint.sprintPlan(ctx, { now: NOW, goal: { examDate: key(-2) } }), /đã qua/);
});

// ── review R1 / R2 regressions ──────────────────────────────────────────────

it('R1 #1 + #9: past the new-question cutoff the quota is 0 with a reason; a swapped sibling (`for`) is not a new question', () => {
  const ctx = ctxOf([attempt(5, ids.slice(0, 10).map((q) => ans(q, true))), attempt(0, [ans(ids[20], true), ans(ids[21], true, { for: ids[0] })])]);
  const q = sched.newQuota(ctx, { examDate: key(9) }, key(0))!;
  assert.equal(q.perDay, 0);
  assert.match(q.paused!, /mốc câu mới/);
  const open = sched.newQuota(ctx, { examDate: key(30) }, key(0))!;
  assert.equal(open.doneToday, 1, 'the sibling answered for a due question is a review');
});

it('R1 #7: go / no-go once the reschedule deadline (exam time − 24 h) has passed says the window is closed', () => {
  const fresh = (score: number) => ({ date: key(-1), finished: new Date(NOW - DAY).toISOString(), label: 'S1', score, answers: 50, official: true });
  const input = { today: key(0), passScaled: 720, readiness: { value: 60, answers: 300 }, fresh: [fresh(60), fresh(65)] };
  const examDay = sched.goNoGoFrom({ ...input, goal: { examDate: key(0) } })!;
  assert.match(examDay.note!, /Đã qua hạn dời lịch/);
  assert.doesNotMatch(examDay.note!, /cân nhắc dời/);
  const eve = sched.goNoGoFrom({ ...input, goal: { examDate: key(1), examTime: '09:00' }, now: fsrs.dayStartMs(TODAY) + 10 * 3_600_000 })!;
  assert.match(eve.note!, /Đã qua hạn dời lịch/, '10:00 on the eve of a 09:00 exam');
  const before = sched.goNoGoFrom({ ...input, goal: { examDate: key(1), examTime: '09:00' }, now: fsrs.dayStartMs(TODAY) + 8 * 3_600_000 })!;
  assert.match(before.note!, /cân nhắc dời lịch trước/);
});

it('R1 #8: DuePlanner caches one scheduler per retention (30k plans stay fast) with the same intervals', () => {
  const p = new DuePlanner({ srs: { desired_retention: 0.9, load_balance: false, exam_aware: true, final_review_days: 7, final_retention: 0.95 }, weights: W, today: 0, examDay: 400 });
  const t0 = performance.now();
  for (let i = 0; i < 30_000; i++) p.plan(`q${i}`, i % 390, 1 + (i % 50));
  assert.ok(performance.now() - t0 < 1500, `${performance.now() - t0} ms`);
  const fresh = new DuePlanner({ srs: { desired_retention: 0.9, load_balance: false, exam_aware: true, final_review_days: 7, final_retention: 0 }, weights: W, today: 0 });
  assert.equal(fresh.plan('x', 10, 20), 10 + fsrs.nextIntervalDays(20, 0.9, W));
});

it('R1 #2 #3 #10 + R2: sprint forms get their own days (never ≤ T−3), yesterday only after a mock of the plan, advance one per cluster, a changed exam date rewrites the plan', () => {
  const sealedFile = path.join(HOME, 'results', 'sealed.md');
  fs.mkdirSync(path.dirname(sealedFile), { recursive: true });
  fs.writeFileSync(sealedFile, stringifyFrontMatter({ kind: 'sealed', size: 10, forms: [{ id: 'S1', status: 'sealed', ids: ids.slice(40, 50) }, { id: 'S2', status: 'sealed', ids: ids.slice(50, 60) }] }) + '\n# test\n');
  try {
    const history = [attempt(4, ids.slice(0, 20).map((q) => ans(q, true))), attempt(2, ids.slice(0, 20).map((q) => ans(q, true))), attempt(1, ids.slice(20, 30).map((q) => ans(q, true)))];
    const ctx = ctxOf(history);
    const mode = (s: { filter?: Record<string, unknown> }) => s.filter?.mode;
    // T−6: both forms overdue → S1 today, S2 two days later (T−4); T−5 = yesterday's errors after S1
    const six = sprint.sprintSessions(ctx, { examDate: key(6) }, NOW);
    const forms = six.filter((s) => mode(s) === 'sealed');
    assert.deepEqual(forms.map((s) => [s.day, s.filter!.form]), [[key(0), 'S1'], [key(2), 'S2']]);
    assert.ok(six.some((s) => s.day === key(1) && mode(s) === 'yesterday'));
    assert.ok(!six.some((s) => s.day === key(0) && mode(s) === 'yesterday'), 'no mock before the plan started');
    // T−3: no form fits (≥ 4 days left needed), nothing heavy on light days
    const three = sprint.sprintSessions(ctx, { examDate: key(3) }, NOW);
    assert.ok(!three.some((s) => mode(s) === 'sealed' || mode(s) === 'exam'));
    assert.ok(!three.some((s) => mode(s) === 'yesterday'));
    // R2: same day, exam date changed → the plan is rewritten
    const a = sprint.sprintPlan(ctx, { now: NOW, goal: { examDate: key(7) } });
    const b = sprint.sprintPlan(ctx, { now: NOW, goal: { examDate: key(7) } });
    assert.equal(b.created, false);
    const c = sprint.sprintPlan(ctx, { now: NOW, goal: { examDate: key(3) } });
    assert.equal(c.created, true, 'goal changed → rewritten');
    assert.notDeepEqual(c.plan.sessions.map((s) => s.title), a.plan.sessions.map((s) => s.title));
    assert.equal(sprint.sprintPlan(ctx, { now: NOW, goal: { examDate: key(3), examTime: '08:00' } }).created, true, 'exam time changed too');
  } finally {
    fs.rmSync(sealedFile, { force: true });
  }
  {
    const history = [attempt(4, ids.slice(0, 20).map((q) => ans(q, true))), attempt(2, ids.slice(0, 20).map((q) => ans(q, true))), attempt(1, ids.slice(20, 30).map((q) => ans(q, true)))];
    const ctx = ctxOf(history);
    // consolidate today: the advance session exists, one question per sibling cluster
    const clustered = { ...bank, byId: new Map(bank.questions.map((q) => [q.id, ids.slice(0, 30).includes(q.id) ? { ...q, cluster: 'c-' + (ids.indexOf(q.id) % 2) } : q])) } as typeof bank;
    const five = sprint.sprintSessions({ ...ctx, bank: clustered }, { examDate: key(5) }, NOW);
    const adv = five.find((s) => s.questions);
    assert.ok(sched.advanceQueue(ctx, { examDate: key(5) }, key(0), 50).length > 2, 'fixture has advance candidates');
    {
      assert.ok(adv, 'advance session on today’s consolidate day');
      assert.ok(adv!.questions!.length <= 2, 'one per cluster (2 clusters)');
    }
  }
});
