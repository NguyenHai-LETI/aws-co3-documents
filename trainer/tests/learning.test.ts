// Unit tests for the learning engine: FSRS, daily review cap, readiness v2, rushed attempts,
// Pearson-style exams, recall-first matching, result rewriting. Run: npm test
// Uses a throw-away data root (TRAINER_HOME) with a generated pack — never the real bank/results.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from '../server/config.ts';
import type { Attempt, AnswerRecord, DomainId, Question, QuestionState, SubmitRequest, TestSession } from '../shared/types.ts';

const TRAINER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-learning-'));
fs.mkdirSync(path.join(HOME, 'bank', 'packs', 'manual'), { recursive: true });
fs.copyFileSync(path.join(TRAINER, 'bank', 'taxonomy.yaml'), path.join(HOME, 'bank', 'taxonomy.yaml'));
process.env.TRAINER_HOME = HOME; // must be set before config.ts is imported (dynamic imports below)
after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const { DATA_DIR } = await import('../server/config.ts');
// Without process isolation (node --test --test-isolation=none) another test file may have loaded config.ts
// first — then the data root is the real trainer/ and these tests must not write anything: skip them.
const it = DATA_DIR === HOME ? test : test.skip;

const fsrs = await import('../server/lib/fsrs.ts');
const stats = await import('../server/lib/stats.ts');
const results = await import('../server/lib/results.ts');
const select = await import('../server/lib/select.ts');
const { loadTaxonomy } = await import('../server/lib/taxonomy.ts');
const { loadBank } = await import('../server/lib/bank.ts');
const { serializePack } = await import('../server/lib/pack-format.ts');
const { splitFrontMatter, stringifyFrontMatter } = await import('../server/lib/frontmatter.ts');
const { applyFilters, modePool } = await import('../shared/filters.ts');

const DAY = 86_400_000;
const NOW = Date.now();
const tax = loadTaxonomy();

function makeCfg(srs: Partial<AppConfig['srs']> = {}, statsCfg: Partial<AppConfig['stats']> = {}): AppConfig {
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
    srs: { algorithm: 'fsrs', desired_retention: 0.9, daily_limit: 50, mastered_stability_days: 21, intervals_days: [1, 3, 7, 14, 30], mastered_box: 4, weights: [], optimize: 'off', optimize_min_reviews: 400, ...srs },
    practice: { default_count: 20, quick_count: 10, shuffle_options: true },
    stats: { rushed_median_seconds: 5, recency_half_life_days: 14, ...statsCfg },
    quality: { embeddings: 'off', ollama_url: '', embedding_model: '', semantic_threshold: 0.88 },
    server: { lan: false },
    export: { anki_deck: 'test', ankiconnect_url: '' },
    cache: { sqlite: false },
    sync: { data_paths: [], before_ai: false, after_ai: false },
  };
}
const cfg = makeCfg();

// ── generated bank on disk: 25 questions per domain, every 5th one long-form, tasks set ──────────────
const DOMAINS: DomainId[] = ['secure', 'resilient', 'performance', 'cost'];
const TASK: Record<DomainId, string> = { secure: '1.3', resilient: '2.2', performance: '3.1', cost: '4.1' };
const LONG = ' The workload runs in two AWS Regions, stores regulated customer records, receives unpredictable traffic spikes during month-end processing, and the operations team is small, so the solution must remain simple to operate while meeting the stated recovery and compliance objectives for the business.';
const drafts = DOMAINS.flatMap((d) =>
  Array.from({ length: 25 }, (_, i) => ({
    id: `${d.slice(0, 3)}-${String(i + 1).padStart(2, '0')}`,
    stem: `Scenario ${i + 1} for ${d}: a company needs a storage design. Which option meets the requirement?${(i + 1) % 5 === 0 ? LONG : ''}`,
    options: ['A', 'B', 'C', 'D'].map((key, k) => ({ key, text: `Choice ${key} number ${k + 1} for case ${i + 1}` })),
    answer: [['A', 'B', 'C', 'D'][i % 4]],
    explanation: 'The chosen design fits the scenario.',
    domain: d,
    topic: 'storage',
    difficulty: (['easy', 'medium', 'hard'] as const)[i % 3],
    time: 60,
    task: TASK[d],
  })),
);
fs.writeFileSync(
  path.join(HOME, 'bank', 'packs', 'manual', 'learning-test.md'),
  serializePack({ pack: 'learning-test', title: 'Learning test', origin: 'manual' }, '', drafts, (x) => stringifyFrontMatter(x)),
);
const bank = loadBank();

function ans(q: string, ok: boolean, extra: Partial<AnswerRecord> = {}): AnswerRecord {
  return { q, pick: ok ? 'A' : 'B', key: 'A', ok, t: 60, est: 60, ...extra };
}
function attempt(daysAgo: number, answers: AnswerRecord[], extra: Partial<Attempt> = {}): Attempt {
  return { id: `a${daysAgo}-${Math.random()}`, mode: 'custom', finished: new Date(NOW - daysAgo * DAY).toISOString(), answers, ...extra } as Attempt;
}

// ── FSRS ────────────────────────────────────────────────────────────────────

it('bank fixture parses cleanly', () => {
  assert.deepEqual(bank.problems.filter((p) => p.level === 'error'), []);
  assert.equal(bank.questions.length, 100);
  assert.equal(bank.questions.filter((q) => q.longForm).length, 20);
});

it('FSRS forgetting curve and interval', () => {
  assert.equal(fsrs.retrievability(0, 5), 1);
  assert.ok(Math.abs(fsrs.retrievability(5, 5) - 0.9) < 1e-7, 'R(S, S) = 90 %');
  assert.ok(fsrs.retrievability(10, 5) < fsrs.retrievability(5, 5));
  assert.ok(Math.abs(fsrs.intervalDays(7.3, 0.9) - 7.3) < 1e-6, 'I(S, 0.9) = S');
  assert.ok(fsrs.intervalDays(10, 0.95) < fsrs.intervalDays(10, 0.9), 'higher retention → shorter interval');
  assert.ok(Math.abs(fsrs.retrievability(fsrs.intervalDays(4, 0.85), 4) - 0.85) < 1e-6);
  // scheduled intervals are whole days ≥ 1, rounded like ts-fsrs (no fuzz)
  assert.equal(fsrs.nextIntervalDays(7.3, 0.9), 7);
  assert.equal(fsrs.nextIntervalDays(0.2, 0.9), 1);
  assert.equal(fsrs.nextIntervalDays(10, 0.85), Math.round(fsrs.intervalDays(10, 0.85)));
  // FSRS-6 forgetting curve: R = (1 + F·t/S)^(−w20) with F chosen so that R(S, S) = 0.9
  const w20 = fsrs.FSRS_WEIGHTS[20];
  const F = Math.pow(0.9, -1 / w20) - 1;
  assert.ok(Math.abs(fsrs.retrievability(30, 4) - Math.pow(1 + (F * 30) / 4, -w20)) < 1e-7);
});

it('FSRS-6 update rules: default weights, ordering, spacing, short-term, bounds', () => {
  assert.equal(fsrs.FSRS_WEIGHTS.length, 21, 'FSRS-6 has 21 parameters');
  assert.deepEqual([1, 2, 3, 4].map((g) => fsrs.review(undefined, g as 1 | 2 | 3 | 4, 0).stability), [0.212, 1.2931, 2.3065, 8.2956]);
  const first = fsrs.review(undefined, 3, 0);
  const t = Math.round(first.stability); // reviewed when R ≈ 90 %
  const [again, hard, good, easy] = ([1, 2, 3, 4] as const).map((g) => fsrs.review(first, g, t));
  assert.ok(again.stability < first.stability && first.stability < hard.stability && hard.stability < good.stability && good.stability < easy.stability);
  assert.ok(again.difficulty > first.difficulty && easy.difficulty < first.difficulty);
  // spacing effect: a later successful recall strengthens memory more
  assert.ok(fsrs.review(first, 3, 10).stability > fsrs.review(first, 3, 2).stability);
  // same day (0 days): FSRS-6 short-term rule — "good" never lowers stability, "again" does
  assert.ok(fsrs.review(first, 3, 0).stability >= first.stability);
  assert.ok(fsrs.review(first, 1, 0).stability < first.stability);
  // difficulty stays within 1..10
  let m = fsrs.review(undefined, 1, 0);
  for (let i = 0; i < 30; i++) m = fsrs.review(m, 1, 1);
  assert.ok(m.difficulty <= 10 && m.difficulty >= 1 && m.stability > 0);
});

it('FSRS-6 replay equals ts-fsrs FSRSAlgorithm (and fsrs-rs nextStates when the optimizer package is installed)', async () => {
  const { FSRSAlgorithm, generatorParameters } = await import('ts-fsrs');
  const custom = [0.5, 1.5, 3, 9, 6.2, 0.7, 2.6, 0.01, 1.7, 0.15, 0.8, 1.5, 0.07, 0.3, 1.6, 0.55, 1.9, 0.5, 0.1, 0.07, 0.2];
  // (grade, whole days since the previous answer) — includes same-day re-answers and lapses
  const seq: [1 | 2 | 3 | 4, number][] = [[3, 0], [1, 2], [3, 0], [2, 1], [3, 4], [4, 11], [1, 40], [3, 1], [3, 0], [4, 9]];
  for (const w of [fsrs.FSRS_WEIGHTS, custom]) {
    const ref = new FSRSAlgorithm(generatorParameters({ w: [...w], enable_short_term: true, enable_fuzz: false }));
    let mine: { stability: number; difficulty: number } | undefined;
    let theirs: { stability: number; difficulty: number } | null = null;
    for (const [g, d] of seq) {
      mine = fsrs.review(mine, g, d, w);
      theirs = ref.next_state(theirs, theirs ? d : 0, g);
      assert.ok(Math.abs(mine.stability - theirs.stability) < 1e-9 && Math.abs(mine.difficulty - theirs.difficulty) < 1e-9, `step ${g}/${d}`);
    }
  }
  // the same history through computeStates (day-scale: whole local days between attempts)
  const cfg6 = makeCfg();
  const days = [40, 38, 38, 37, 33, 22];
  const grades: AnswerRecord[] = [ans('r', true), ans('r', false), ans('r', true), ans('r', true, { unsure: true }), ans('r', true, { t: 20 }), ans('r', true)];
  const atts = days.map((d, i) => attempt(d, [grades[i]]));
  const s = stats.computeStates(atts, cfg6, NOW).get('r')!;
  let m: { stability: number; difficulty: number } | undefined;
  let prevDay: number | undefined;
  for (const a of atts) {
    const day = fsrs.localDay(Date.parse(a.finished));
    m = fsrs.review(m, fsrs.gradeAnswer(a.answers[0]), prevDay === undefined ? 0 : day - prevDay);
    prevDay = day;
  }
  assert.equal(s.stability, Math.round(m!.stability * 100) / 100);
  assert.equal(s.fsrsDifficulty, Math.round(m!.difficulty * 100) / 100);
  assert.equal(s.dueAt, new Date(fsrs.dayStartMs(prevDay! + fsrs.nextIntervalDays(m!.stability))).toISOString(), 'due at the start of the due day');
  // independent implementation (Rust fsrs-rs via the optional binding): same memory states
  let binding: typeof import('@open-spaced-repetition/binding') | undefined;
  try {
    binding = await import('@open-spaced-repetition/binding');
  } catch {
    binding = undefined; // optional package not installed on this platform
  }
  if (binding) {
    const rs = new binding.FSRSBinding([...fsrs.FSRS_WEIGHTS]);
    let mem: InstanceType<typeof binding.BindingMemoryState> | undefined;
    let mine: { stability: number; difficulty: number } | undefined;
    const pick = (n: InstanceType<typeof binding.BindingNextStates>, g: number) => [n.again, n.hard, n.good, n.easy][g - 1].memory;
    for (const [g, d] of seq) {
      const next = pick(rs.nextStates(mem ?? null, 0.9, mem ? d : 0), g);
      mine = fsrs.review(mine, g, d);
      assert.ok(Math.abs(next.stability - mine.stability) / mine.stability < 1e-3, `fsrs-rs S ${next.stability} vs ${mine.stability}`);
      assert.ok(Math.abs(next.difficulty - mine.difficulty) < 1e-3, `fsrs-rs D ${next.difficulty} vs ${mine.difficulty}`);
      mem = new binding.BindingMemoryState(next.stability, next.difficulty);
    }
  }
});

it('answer grades: wrong 1 · unsure/hinted/struck-correct/slow 2 · fast 4 · else 3', () => {
  const base = { ok: true, pick: 'A', key: 'A', t: 60, est: 60 };
  assert.equal(fsrs.gradeAnswer({ ...base, ok: false, pick: 'B' }), 1);
  assert.equal(fsrs.gradeAnswer({ ...base, ok: false, pick: '' }), 1);
  assert.equal(fsrs.gradeAnswer({ ...base, unsure: true, t: 10 }), 2);
  assert.equal(fsrs.gradeAnswer({ ...base, hinted: true }), 2);
  assert.equal(fsrs.gradeAnswer({ ...base, elim: 'AC' }), 2);
  assert.equal(fsrs.gradeAnswer({ ...base, elim: 'CD' }), 3);
  assert.equal(fsrs.gradeAnswer({ ...base, t: 91 }), 2);
  assert.equal(fsrs.gradeAnswer({ ...base, t: 29 }), 4);
  assert.equal(fsrs.gradeAnswer({ ...base, t: 30 }), 3);
  assert.equal(fsrs.gradeAnswer({ ...base, t: 0 }), 3, 'missing time is not "easy"');
});

it('FSRS states: memory levels, due dates, mastery, lapses; rushed attempts ignored', () => {
  const states = stats.computeStates(
    [
      attempt(60, [ans('x', true), ans('y', true), ans('z', false)]),
      attempt(55, [ans('x', true), ans('z', true)]),
      attempt(30, [ans('x', true), ans('y', false)]),
      attempt(1, [ans('x', false), ans('y', false), ans('z', false)], { rushed: true }),
    ],
    cfg,
    NOW,
  );
  const x = states.get('x')!;
  assert.equal(x.attempts, 3, 'rushed attempt ignored');
  assert.equal(x.lastGrade, 3);
  assert.ok(x.stability! > 21, `x stability ${x.stability}`);
  assert.ok(stats.isMastered(x, cfg));
  assert.equal(x.box, fsrs.memoryLevel(x.stability));
  assert.ok(x.box >= 4);
  // due = start of the local day (last answer day + round(S) days) at 90 % retention
  const lastDay = fsrs.localDay(NOW - 30 * DAY);
  const due = new Date(x.dueAt!);
  assert.equal(due.getHours() + due.getMinutes(), 0, 'due at local midnight');
  assert.ok(Math.abs(fsrs.localDay(due.getTime()) - lastDay - x.stability!) <= 0.51, `due ${x.dueAt} vs S ${x.stability}`);
  assert.ok(x.retrievability! > 0.5 && x.retrievability! < 1);
  assert.ok(Math.abs(x.retrievability! - fsrs.retrievability(fsrs.localDay(NOW) - lastDay, x.stability!)) < 0.002, 'R at today, whole days');
  const y = states.get('y')!;
  assert.equal(y.lapses, 1);
  assert.equal(y.lastGrade, 1);
  assert.ok(y.stability! < 2.3065, `a lapse drops S below the first "good" (${y.stability})`);
  assert.ok(!stats.isMastered(y, cfg));
  assert.ok(stats.isDue(y, NOW));
  assert.equal(states.get('z')!.lapses ?? 0, 0, 'wrong before the first correct answer is not a lapse');
  // Leitner mastery still uses boxes
  const leitner = makeCfg({ algorithm: 'leitner' });
  const ls = stats.computeStates([attempt(9, [ans('x', true)]), attempt(5, [ans('x', true)]), attempt(1, [ans('x', true)])], leitner, NOW);
  assert.equal(ls.get('x')!.box, 4);
  assert.ok(stats.isMastered(ls.get('x'), leitner));
  assert.equal(ls.get('x')!.stability, undefined);
  assert.deepEqual(stats.boxLabels(leitner).slice(0, 2), ['Chưa học', 'Box 1 · 1 ngày']);
  assert.equal(stats.boxLabels(cfg).length, 6);
});

it('struck-correct answers are counted per question', () => {
  const states = stats.computeStates([attempt(3, [ans('x', false, { elim: 'A' })]), attempt(2, [ans('x', true, { elim: 'CD' })])], cfg, NOW);
  assert.equal(states.get('x')!.elimCorrect, 1);
});

// ── daily review cap ────────────────────────────────────────────────────────

it('daily cap: lowest retrievability first, limited by srs.daily_limit minus today’s SRS answers', () => {
  const qs = bank.questions.slice(0, 10);
  const states = new Map<string, QuestionState>(
    qs.map((q, i) => [q.id, { id: q.id, attempts: 1, correct: 1, everWrong: false, streak: 1, box: 2, avgTime: 30, slowCount: 0, wrongPicks: {}, dueAt: new Date(NOW - DAY).toISOString(), retrievability: 0.5 + i / 100 }]),
  );
  const small = makeCfg({ daily_limit: 6 });
  const doneToday = attempt(0, [ans('a', true), ans('b', true)], { mode: 'srs' });
  const doneOtherMode = attempt(0, [ans('c', true)], { mode: 'topic' });
  const rushedSrs = attempt(0, [ans('d', true)], { mode: 'srs', rushed: true });
  const yesterday = attempt(1.5, [ans('e', true)], { mode: 'srs' });
  const atts = [yesterday, doneToday, doneOtherMode, rushedSrs];
  assert.equal(stats.srsAnswersToday(atts, NOW), 2);
  const queue = stats.reviewQueue([...qs].reverse(), states, atts, small, NOW);
  assert.equal(queue.due.length, 10);
  assert.equal(queue.remaining, 4);
  assert.deepEqual(queue.today.map((q) => q.id), qs.slice(0, 4).map((q) => q.id));
  assert.equal(queue.backlog, 6);
  // srs mode serves today's share only; the web pool helper can apply the same cap
  const session = select.buildTest({ mode: 'srs', count: 50 }, { bank, states, cfg: small, plans: [], attempts: atts });
  assert.deepEqual(new Set(session.questions.map((r) => r.id)), new Set(qs.slice(0, 4).map((q) => q.id)));
  assert.ok(session.notes.some((n) => n.includes('6 câu tồn')));
  const counts = select.modeCounts({ bank, states, cfg: small, plans: [], attempts: atts });
  assert.equal(counts.srs, 4);
  assert.equal(counts.backlog, 6);
  assert.equal(counts.srsRemaining, 4);
  const web = modePool('srs', bank.questions, Object.fromEntries(states), { srsLimit: counts.srsRemaining });
  assert.deepEqual(web.map((q) => q.id), qs.slice(0, 4).map((q) => q.id));
  // cap reached → nothing today, with an explanation
  const full = select.buildTest({ mode: 'srs' }, { bank, states, cfg: makeCfg({ daily_limit: 2 }), plans: [], attempts: atts });
  assert.equal(full.questions.length, 0);
  assert.match(full.notes.join(' '), /đã ôn đủ/);
});

// ── readiness v2 ────────────────────────────────────────────────────────────

const item = (domain: string, ok: boolean, ageDays = 0, longForm = false, difficulty: 'easy' | 'medium' | 'hard' = 'medium') => ({ domain, ok, ageDays, longForm, difficulty });
function sample(nPerDomain: number, acc: number, ageDays = 0) {
  return DOMAINS.flatMap((d) => Array.from({ length: nPerDomain }, (_, i) => item(d, i < Math.round(nPerDomain * acc), ageDays)));
}

it('readiness v2: interval contains the estimate and narrows with evidence', () => {
  const r20 = stats.computeReadiness(sample(20, 0.75), tax.domains, 72, 14);
  const r200 = stats.computeReadiness(sample(200, 0.75), tax.domains, 72, 14);
  for (const r of [r20, r200]) assert.ok(r.low <= r.readiness && r.readiness <= r.high);
  assert.ok(r200.high - r200.low < r20.high - r20.low);
  assert.ok(Math.abs(r200.readiness - 75) < 1, `≈ 75 % (${r200.readiness})`);
  assert.equal(r20.confidence, 'low');
  assert.equal(r200.confidence, 'high');
  assert.ok(stats.computeReadiness(sample(60, 0.75), tax.domains, 72, 14).confidence === 'medium');
  assert.deepEqual(stats.computeReadiness([], tax.domains, 72, 14), { readiness: 0, low: 0, high: 0, sigma: 0, passProbability: 0, confidence: 'low' });
});

it('readiness v2: pass probability, recency and long-form weighting', () => {
  const weak = stats.computeReadiness(sample(100, 0.6), tax.domains, 72, 14);
  const strong = stats.computeReadiness(sample(100, 0.85), tax.domains, 72, 14);
  assert.ok(weak.passProbability < 0.05 && strong.passProbability > 0.95, `${weak.passProbability} / ${strong.passProbability}`);
  const atPass = stats.computeReadiness(sample(100, 0.72), tax.domains, 72, 14);
  assert.ok(Math.abs(atPass.passProbability - 0.5) < 0.15, `≈ 50 % at the pass mark (${atPass.passProbability})`);
  // improving learner: old answers wrong, recent answers right → recent evidence dominates
  const improving = stats.computeReadiness([...sample(40, 0.3, 60), ...sample(40, 0.9, 1)], tax.domains, 72, 14);
  const declining = stats.computeReadiness([...sample(40, 0.9, 60), ...sample(40, 0.3, 1)], tax.domains, 72, 14);
  assert.ok(improving.readiness > 75 && declining.readiness < 45, `${improving.readiness} / ${declining.readiness}`);
  // long-form/hard answers weigh more than short/easy ones
  const mixed = (longOk: boolean) =>
    DOMAINS.flatMap((d) => [
      ...Array.from({ length: 20 }, () => item(d, longOk, 0, true, 'hard')),
      ...Array.from({ length: 20 }, () => item(d, !longOk, 0, false, 'easy')),
    ]);
  assert.ok(stats.computeReadiness(mixed(true), tax.domains, 72, 14).readiness > 60);
  assert.ok(stats.computeReadiness(mixed(false), tax.domains, 72, 14).readiness < 40);
  assert.ok(Math.abs(stats.answerWeight({ ageDays: 14, longForm: true, difficulty: 'hard' }, 14) - 0.5 * 1.5 * 1.2) < 1e-12);
  assert.ok(Math.abs(stats.normalCdf(0) - 0.5) < 1e-7 && Math.abs(stats.normalCdf(1.645) - 0.95) < 1e-3 && Math.abs(stats.normalCdf(-1.96) - 0.025) < 1e-3);
});

// ── rushed attempts, Pearson grading, result files ──────────────────────────

function session(ids: string[], extra: Partial<TestSession> = {}): TestSession {
  return {
    sessionId: 's',
    mode: 'custom',
    title: 'Test',
    feedback: 'exam',
    timeLimit: 0,
    estimateTotal: ids.length * 60,
    timingPreset: 'standard',
    questions: ids.map((id) => ({ id })),
    selection: { mode: 'custom' },
    createdAt: new Date(NOW).toISOString(),
    notes: [],
    ...extra,
  };
}
function submit(s: TestSession, pick: (q: Question, i: number) => Partial<SubmitRequest['answers'][number]>, finishedDaysAgo = 0): SubmitRequest {
  const finished = new Date(NOW - finishedDaysAgo * DAY);
  return {
    session: s,
    answers: s.questions.map((r, i) => {
      const q = bank.byId.get(r.id)!;
      return { q: q.id, pick: q.answer, t: 40, ...pick(q, i) };
    }),
    startedAt: new Date(finished.getTime() - 600_000).toISOString(),
    finishedAt: finished.toISOString(),
    timedOut: false,
    timeUsed: 600,
  };
}

it('rushed detection: median answered time below the threshold', () => {
  assert.equal(results.attemptMedianTime([{ pick: 'A', t: 3 }, { pick: 'B', t: 9 }, { pick: '', t: 0 }, { pick: 'C', t: 4 }]), 4);
  assert.equal(results.attemptMedianTime([{ pick: 'A', t: 3 }, { pick: 'B', t: 9 }]), 6);
  assert.equal(results.attemptMedianTime([{ pick: '', t: 50 }]), 0);
  assert.equal(results.isRushed(4, 5), true);
  assert.equal(results.isRushed(5, 5), false);
  assert.equal(results.isRushed(0, 0), false, 'threshold 0 disables the filter');
  const ids = bank.questions.slice(0, 6).map((q) => q.id);
  const fast = results.gradeAndSave(submit(session(ids), () => ({ t: 2 }), 2), bank);
  const slow = results.gradeAndSave(submit(session(ids), (_q, i) => ({ t: 30 + i }), 1), bank);
  assert.equal(fast.rushed, true);
  assert.equal(slow.rushed, false);
  const loaded = results.loadAttempts(cfg);
  assert.equal(loaded.find((a) => a.id === fast.id)?.rushed, true);
  assert.equal(loaded.find((a) => a.id === slow.id)?.medianTime, 32.5);
  assert.equal(results.loadAttempts(makeCfg({}, { rushed_median_seconds: 0 })).find((a) => a.id === fast.id)?.rushed, false);
  const s = stats.computeStats(loaded, bank, stats.computeStates(loaded, cfg, NOW), cfg, NOW);
  assert.equal(s.totals.rushedAttempts, 1);
  assert.equal(s.totals.attempts, loaded.length - 1);
  assert.equal(s.rushed[0].id, fast.id);
  for (const f of [fast, slow]) fs.rmSync(path.join(HOME, f.file));
});

it('Pearson exam: 65 questions, 15 pilots keeping the scored domain mix, official timing', () => {
  const states = new Map<string, QuestionState>();
  const s = select.buildTest({ mode: 'exam', pearson: true, count: 10, timing: undefined }, { bank, states, cfg, plans: [] });
  assert.equal(s.questions.length, 65);
  assert.equal(s.pearson, true);
  assert.equal(s.unscored?.length, 15);
  assert.equal(s.feedback, 'exam');
  assert.equal(s.timingPreset, 'official');
  assert.equal(s.timeLimit, 65 * 120);
  assert.equal(s.title, select.PEARSON_TITLE);
  assert.ok(s.questions.every((r) => r.order?.length === 4), 'options shuffled by default');
  const scored: Record<string, number> = {};
  const all: Record<string, number> = {};
  for (const r of s.questions) {
    const d = bank.byId.get(r.id)!.domain;
    all[d] = (all[d] ?? 0) + 1;
    if (!s.unscored!.includes(r.id)) scored[d] = (scored[d] ?? 0) + 1;
  }
  assert.deepEqual(all, { secure: 19, resilient: 17, performance: 16, cost: 13 });
  assert.deepEqual(scored, { secure: 15, resilient: 13, performance: 12, cost: 10 });
  // every long-form question is preferred when nothing has been seen yet
  const longIds = bank.questions.filter((q) => q.longForm).map((q) => q.id);
  assert.ok(longIds.every((id) => s.questions.some((r) => r.id === id)), 'long-form preferred');
  // non-pearson exam keeps the requested size and has no pilots
  const plain = select.buildTest({ mode: 'exam', count: 20, shuffleOptions: false }, { bank, states, cfg, plans: [] });
  assert.equal(plain.questions.length, 20);
  assert.equal(plain.unscored, undefined);
  assert.ok(plain.questions.every((r) => !r.order));
});

it('explicit ids and AI-plan sessions never serve draft (awaiting review) or retired questions — with a note', () => {
  const [d, r, ok, ok2] = bank.questions.slice(20, 24);
  const byId = new Map(bank.byId);
  byId.set(d.id, { ...d, status: 'draft' });
  byId.set(r.id, { ...r, status: 'retired' });
  const b2 = { ...bank, byId, questions: bank.questions.map((q) => byId.get(q.id)!) };
  const s = select.buildTest({ mode: 'ids', ids: [d.id, r.id, ok.id, ok.id, ok2.id] }, { bank: b2, states: new Map(), cfg, plans: [] });
  assert.deepEqual(s.questions.map((x) => x.id), [ok.id, ok2.id]);
  assert.ok(s.notes.includes('1 câu đang chờ duyệt (draft) đã được bỏ qua.'), s.notes.join(' | '));
  assert.ok(s.notes.includes('Bỏ qua 1 câu đã retired.'));
  const plan = { id: 'p1', file: '', created: '', newPacks: [], body: '', sessions: [{ id: 's1', title: 'Vá lỗi', questions: [d.id, ok.id] }] };
  const c = select.buildTest({ mode: 'coach', plan: 'p1#s1' }, { bank: b2, states: new Map(), cfg, plans: [plan] });
  assert.deepEqual(c.questions.map((x) => x.id), [ok.id]);
  assert.match(c.notes.join(' '), /chờ duyệt \(draft\)/);
  // filter-based modes never had drafts in their pool
  assert.ok(!select.buildTest({ mode: 'custom', count: 200 }, { bank: b2, states: new Map(), cfg, plans: [] }).questions.some((x) => x.id === d.id));
});

it('exam picks prefer never seen, then least recently seen', () => {
  const secure = bank.questions.filter((q) => q.domain === 'secure');
  const states = new Map<string, QuestionState>(
    secure.slice(0, 10).map((q, i) => [q.id, { id: q.id, attempts: 1, correct: 1, everWrong: false, streak: 1, box: 2, avgTime: 30, slowCount: 0, wrongPicks: {}, lastAt: new Date(NOW - (i + 1) * DAY).toISOString() }]),
  );
  const s = select.buildTest({ mode: 'exam', count: 65 }, { bank, states, cfg, plans: [] });
  const picked = new Set(s.questions.map((r) => r.id));
  for (const q of secure.slice(10)) assert.ok(picked.has(q.id), `unseen ${q.id} picked`);
  // 19 secure slots = 15 unseen + the 4 seen longest ago (indexes 6..9)
  assert.deepEqual(secure.slice(0, 10).map((q) => picked.has(q.id)), [false, false, false, false, false, false, true, true, true, true]);
});

it('Pearson grading: score over scored items only, pilots stored as scored:false', () => {
  const ids = bank.questions.filter((_, i) => i % 2 === 0).slice(0, 20).map((q) => q.id);
  const pilots = ids.slice(0, 5);
  const req = submit(session(ids, { mode: 'exam', pearson: true, unscored: pilots, title: select.PEARSON_TITLE }), (q, i) =>
    i < 5 ? { pick: q.answer } : i < 9 ? { pick: [q.options.find((o) => !q.answer.includes(o.key))!.key] } : {},
  );
  const g = results.gradeSubmission(req, bank);
  assert.equal(g.total, 15);
  assert.equal(g.correct, 11);
  assert.equal(g.score, 73.3);
  assert.equal(g.pilotTotal, 5);
  assert.equal(g.pilotCorrect, 5);
  assert.equal(g.records.filter((r) => r.scored === false).length, 5);
  const a = results.gradeAndSave(req, bank);
  assert.equal(a.passed, true);
  assert.equal(a.layout, 2);
  const text = fs.readFileSync(path.join(HOME, a.file), 'utf8');
  assert.match(text, /^layout: 2$/m);
  assert.match(text, /^pearson: true$/m);
  assert.match(text, /^pilot_total: 5$/m);
  assert.match(text, /^pilot_correct: 5$/m);
  assert.match(text, /scored: false/);
  assert.match(text, /15 câu tính điểm \+ 5 câu thử nghiệm/);
  const back = results.loadAttempts(cfg).find((x) => x.id === a.id)!;
  assert.deepEqual([back.total, back.correct, back.pilotTotal, back.pilotCorrect, back.pearson], [15, 11, 5, 5, true]);
  const sum = results.summarize(back, bank);
  assert.equal(Object.values(sum.domains).reduce((n, d) => n + d.total, 0), 15, 'summary covers scored answers');
  // a non-pearson session ignores `unscored`
  const plain = results.gradeSubmission({ ...req, session: { ...req.session, pearson: false } }, bank);
  assert.equal(plain.total, 20);
  assert.equal(plain.pilotTotal, 0);
  fs.rmSync(path.join(HOME, a.file));
});

it('answer extras are normalized: elim, recall (300), why (500), hinted', () => {
  const q = bank.questions[0];
  const wrong = q.options.find((o) => !q.answer.includes(o.key))!.key;
  const req = submit(session([q.id]), () => ({
    pick: [wrong],
    elim: ['d', q.answer[0], wrong, 'Z', q.answer[0]],
    recall: `  ${'x'.repeat(400)}  `,
    why: ' nhầm \n\n   giữa hai lựa chọn ' + 'y'.repeat(600),
    hinted: true,
  }));
  const r = results.gradeSubmission(req, bank).records[0];
  assert.equal(r.elim, [...new Set(['D', q.answer[0]])].filter((k) => k !== wrong).sort().join(''), 'valid keys, no picked key, sorted');
  assert.equal(r.recall!.length, 300);
  assert.equal(r.why!.length, 500);
  assert.ok(r.why!.startsWith('nhầm giữa hai lựa chọn'));
  assert.equal(r.hinted, true);
  assert.equal(r.recallHit, false);
  const empty = results.gradeSubmission(submit(session([q.id]), () => ({ recall: '   ', why: '', elim: [] })), bank).records[0];
  assert.deepEqual(Object.keys(empty).sort(), ['est', 'h', 'key', 'ok', 'pick', 'q', 't']);
  assert.equal(empty.h, q.hash, 'the answered version of the question is recorded');
});

it('recallHit: services/features (any case) or ≥ 2 content words; ties with a wrong option still count; stem words ignored', () => {
  const q = {
    stem: 'A company must decouple an order service from a payment service so that orders are not lost when the payment service is unavailable. Which solution meets these requirements?',
    options: [
      { key: 'A', text: 'Place an Amazon SQS queue between the services and process messages asynchronously' },
      { key: 'B', text: 'Publish each order to an Amazon SNS topic that the payment service subscribes to' },
      { key: 'C', text: 'Call the payment service synchronously with exponential backoff retries' },
      { key: 'D', text: 'Write orders to an Amazon Kinesis data stream with a single shard' },
    ],
    answer: ['A'],
  };
  assert.equal(results.recallMatches('SQS', q, tax), true);
  assert.equal(results.recallMatches('dùng sqs để tách rời', q, tax), true, 'lower-case service name');
  assert.equal(results.recallMatches('SNS topic', q, tax), false);
  assert.equal(results.recallMatches('SQS hoặc SNS', q, tax), true, 'tie → not more with a wrong option');
  assert.equal(results.recallMatches('SQS? không, SNS topic subscribe', q, tax), false, 'a wrong option overlaps more');
  assert.equal(results.recallMatches('a queue, process messages asynchronously', q, tax), true, '≥ 2 content words');
  assert.equal(results.recallMatches('order payment service', q, tax), false, 'words copied from the stem do not count');
  assert.equal(results.recallMatches('', q, tax), false);
  const s3 = {
    stem: 'Which S3 storage class is cheapest for data accessed once a quarter that needs millisecond retrieval?',
    options: [
      { key: 'A', text: 'S3 Standard' },
      { key: 'B', text: 'S3 Glacier Instant Retrieval' },
      { key: 'C', text: 'S3 Glacier Deep Archive' },
      { key: 'D', text: 'S3 Intelligent-Tiering' },
    ],
    answer: ['B'],
  };
  assert.equal(results.recallMatches('S3', s3, tax), false, 'S3 appears in every option → no signal');
  assert.equal(results.recallMatches('glacier instant retrieval', s3, tax), true);
});

it('rewriteAttempt keeps unknown keys and info notes, re-renders the body; why notes reach states/snapshot inputs', () => {
  const ids = bank.questions.slice(10, 14).map((q) => q.id);
  const a = results.gradeAndSave(
    submit(session(ids), (q, i) => (i === 1 ? { pick: [q.options.find((o) => !q.answer.includes(o.key))!.key], elim: [q.answer[0]] } : {})),
    bank,
  );
  const abs = path.join(HOME, a.file);
  const fm = splitFrontMatter(fs.readFileSync(abs, 'utf8'));
  fm.data.custom_key = 'keep me';
  (fm.data.answers as Record<string, unknown>[])[1].legacy = 7;
  fs.writeFileSync(abs, stringifyFrontMatter(fm.data, ['answers']) + '\n' + fm.body + '\n> ℹ️ Ký tự đáp án đã chuyển theo bố cục mới (test-migration)\n');
  const target = ids[1];
  assert.equal(results.rewriteAttempt(a.file, (x) => (x.answers.find((r) => r.q === target)!.why = 'Tưởng SNS bền hơn')), true);
  const text = fs.readFileSync(abs, 'utf8');
  const back = splitFrontMatter(text);
  assert.equal(back.data.custom_key, 'keep me');
  assert.equal((back.data.answers as Record<string, unknown>[])[1].legacy, 7);
  assert.equal((back.data.answers as Record<string, unknown>[])[1].why, 'Tưởng SNS bền hơn');
  assert.equal(back.data.layout, 2);
  assert.match(back.body, /Vì sao bạn chọn: “Tưởng SNS bền hơn”/);
  assert.match(back.body, /gạch nhầm đáp án đúng/);
  assert.match(back.body, /> ℹ️ Ký tự đáp án đã chuyển theo bố cục mới \(test-migration\)/);
  const loaded = results.loadAttempts(cfg).find((x) => x.id === a.id)!;
  assert.equal(loaded.answers[1].why, 'Tưởng SNS bền hơn');
  assert.equal(loaded.answers[1].elim, bank.byId.get(target)!.answer[0]);
  assert.equal(results.rewriteAttempt('results/does-not-exist.md', () => {}), false);
  assert.equal(results.rewriteAttempt('../config.yaml', () => {}), false);
  fs.rmSync(abs);
});

it('stats v2 fields: by task, calibration, elimination, recall, length split', () => {
  const sec = bank.questions.filter((q) => q.domain === 'secure');
  const long = sec.find((q) => q.longForm)!;
  const short = sec.find((q) => !q.longForm)!;
  const atts = [
    attempt(2, [
      { ...ans(long.id, true), key: long.answer.join(''), pick: long.answer.join('') },
      { ...ans(short.id, false), key: short.answer.join(''), elim: short.answer[0], recall: 'x', recallHit: false },
    ]),
    attempt(1, [
      { ...ans(short.id, true, { unsure: true }), key: short.answer.join(''), pick: short.answer.join(''), recall: 'y', recallHit: true },
      { ...ans(long.id, true, { hinted: true }), key: long.answer.join(''), pick: long.answer.join('') },
    ]),
    attempt(0.5, [ans(long.id, false)], { rushed: true, title: 'vội', medianTime: 1 }),
  ];
  const states = stats.computeStates(atts, cfg, NOW);
  const s = stats.computeStats(atts, bank, states, cfg, NOW);
  assert.equal(s.totals.answers, 4);
  assert.equal(s.totals.rushedAttempts, 1);
  assert.equal(s.rushed[0].medianTime, 1);
  assert.deepEqual(s.calibration, { sure: { answers: 2, correct: 1 }, unsure: { answers: 1, correct: 1 }, hinted: { answers: 1, correct: 1 } });
  assert.deepEqual(s.elimination, { answersWithElim: 1, correctEliminated: 1, questions: [short.id] });
  assert.deepEqual(s.recall, { answers: 2, hits: 1, hitAccuracy: 100, missAccuracy: 0 });
  assert.deepEqual(s.lengthSplit, { long: { answers: 2, correct: 2 }, short: { answers: 2, correct: 1 } });
  assert.equal(s.totals.longFormShare, 50);
  const t13 = s.byTask.find((b) => b.key === '1.3')!;
  assert.equal(t13.attempts, 4);
  assert.equal(t13.bank, 25);
  assert.ok(t13.label.startsWith('1.3 · '));
  assert.equal(s.byTask.length, tax.tasks.length);
  assert.equal(s.boxes.reduce((n, x) => n + x, 0), bank.questions.length);
  assert.equal(s.boxLabels.length, 6);
  assert.ok(s.totals.readinessLow <= s.totals.readiness && s.totals.readiness <= s.totals.readinessHigh);
});

it('tasks filter', () => {
  assert.equal(applyFilters(bank.questions, { tasks: ['1.3', '4.1'] }).length, 50);
  assert.equal(applyFilters(bank.questions, { tasks: ['9.9'] }).length, 0);
  assert.equal(applyFilters(bank.questions, { tasks: [] }).length, 100);
});
