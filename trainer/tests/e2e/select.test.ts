// End-to-end selection scenarios against the real server (sandbox copy of the bank, free port, POST /api/tests):
// diagnostic, realism + the reading-load clock, the deterministic "new" order, the variant rule of mocks, requirement and
// out-of-scope filters, and sealed forms — 409 without a form; the whole sealed flow on a second sandbox that holds
// forms back (exam.sealed_forms: 2). Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { buildTest, rng, wrongKeys } from '../helpers/learner.ts';
import { isExamLike, testRealism } from '../../shared/realism.ts';
import { newOrder, practicePool } from '../../shared/filters.ts';
import { computeTimeLimit } from '../../shared/timing.ts';
import type { AnswerInput, Attempt, Question, QuestionState, TestSession } from '../../shared/types.ts';

const T = { timeout: 180_000 };

interface Env {
  sb: Sandbox;
  srv: ServerHandle;
  api: ApiClient;
  meta: any;
  bank: Question[]; // every question (status included)
  sealed: Set<string>;
}

async function boot(configure?: (cfgText: string) => string): Promise<Env> {
  const sb = makeSandbox();
  if (configure) {
    const file = path.join(sb.home, 'config.yaml');
    fs.writeFileSync(file, configure(fs.readFileSync(file, 'utf8')));
  }
  const srv = await startServer({ home: sb.home });
  const api = apiClient(srv.base);
  const meta = (await api.get('/api/meta')).body;
  const b = (await api.get<{ questions: Question[]; sealed?: string[] }>('/api/bank')).body;
  return { sb, srv, api, meta, bank: b.questions, sealed: new Set(b.sealed ?? []) };
}

async function shutdown(env: Env | undefined) {
  await env?.srv.stop();
  if (process.env.E2E_KEEP) console.log(`sandbox kept: ${env?.sb.root}`);
  else env?.sb.cleanup();
}

async function submit(api: ApiClient, session: TestSession, questions: Question[], seed = 5): Promise<Attempt> {
  const rand = rng(seed);
  const answers = questions.map((q): AnswerInput => ({ q: q.id, pick: rand() < 0.7 ? q.answer : [wrongKeys(q)[0]], t: Math.max(8, Math.round(q.time * 0.8)) }));
  const timeUsed = answers.reduce((s, a) => s + a.t, 0);
  const finished = Date.now();
  const r = await api.post<{ attempt: Attempt; error?: string }>('/api/results', {
    session,
    answers,
    startedAt: new Date(finished - timeUsed * 1000).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    timedOut: false,
    timeUsed,
  });
  assert.equal(r.status, 200, `submit: ${r.body?.error}`);
  return r.body.attempt;
}

/** Variant families (connected components of variant_of), like server/lib/select.ts variantFamilies. */
function families(bank: Question[]): (id: string) => string {
  const parent = new Map<string, string>();
  const find = (x: string): string => (parent.has(x) && parent.get(x) !== x ? find(parent.get(x)!) : x);
  for (const q of bank) {
    for (const v of q.variantOf ?? []) {
      const a = find(q.id);
      const b = find(v);
      if (a !== b) parent.set(a < b ? b : a, a < b ? a : b);
    }
  }
  return (id) => find(id);
}

const ids = (s: TestSession) => s.questions.map((r) => r.id);

/**
 * [v5] What the selection rules leave of `list` (in order): siblings of questions answered today buried, one question per
 * sibling cluster (`Question.cluster` from /api/bank, else the variant family).
 */
function ruled(list: Question[], bank: Question[], states: Record<string, QuestionState>): Question[] {
  const family = families(bank);
  const key = (q: Question) => q.cluster ?? `v:${family(q.id)}`;
  const today = new Date().toLocaleDateString('en-CA');
  const answered = new Set(Object.values(states).filter((s) => s.lastAt && new Date(s.lastAt).toLocaleDateString('en-CA') === today).map((s) => s.id));
  const hot = new Set(bank.filter((q) => answered.has(q.id)).map(key));
  const used = new Set<string>();
  return list.filter((q) => {
    if (!answered.has(q.id) && hot.has(key(q))) return false;
    if (used.has(key(q))) return false;
    used.add(key(q));
    return true;
  });
}

// ── a fresh learner, no sealed forms (the sandbox default) ──────────────────

let env: Env;
let byId: Map<string, Question>;
let pool: Question[]; // what practice modes draw from

before(
  async () => {
    env = await boot();
    byId = new Map(env.bank.map((q) => [q.id, q]));
    pool = practicePool(env.bank, { sealed: env.sealed, excludeOutOfScope: env.meta.practice.exclude_out_of_scope ?? true });
  },
  { timeout: 90_000 },
);
after(() => shutdown(env));

test('sealed exam without any sealed form → 409 with a Vietnamese reason', T, async () => {
  assert.deepEqual(env.meta.sealed ?? [], [], 'sandboxes start with exam.sealed_forms: 0');
  const r = await env.api.post<{ error: string }>('/api/tests', { mode: 'sealed' });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /Chưa có đề niêm phong/);
  const unknown = await env.api.post<{ error: string }>('/api/tests', { mode: 'sealed', form: 'S7' });
  assert.equal(unknown.status, 404);
});

test('Pearson mock: reading-load clock by default, realism on the session, exam-like preferred, no variant pairs', T, async () => {
  const { session, questions } = await buildTest(env.api, { mode: 'exam', pearson: true });
  assert.equal(session.questions.length, 65);
  assert.equal(session.timingPreset, 'realistic');
  assert.deepEqual(session.realism, testRealism(questions, env.meta), 'session.realism = the served questions');
  assert.equal(session.timeLimit, computeTimeLimit(session.estimateTotal, 65, 'realistic', undefined, env.meta.timing, { words: session.realism!.words }));
  assert.ok(session.timeLimit >= session.estimateTotal && session.timeLimit <= 65 * 120);
  const family = families(env.bank);
  const fams = ids(session).map(family);
  assert.equal(new Set(fams).size, fams.length, 'never a question together with its variant relative');
  // never-seen exam-like questions come first in every domain quota (one per variant family)
  const states = (await env.api.get<{ states: Record<string, QuestionState> }>('/api/state')).body.states;
  for (const d of env.meta.domains as { id: string }[]) {
    const fresh = new Set(pool.filter((q) => q.domain === d.id && !states[q.id] && isExamLike(q, env.meta)).map((q) => family(q.id)));
    if (fresh.size > 13) continue; // more than the smallest quota: not every family can be in one mock
    for (const f of fresh) assert.equal(ids(session).filter((id) => family(id) === f).length, 1, `exam-like family ${f} (${d.id}) served once`);
  }
  // explicit clocks: official = 2′/question, ESL × 160/130
  assert.equal((await buildTest(env.api, { mode: 'exam', pearson: true, timing: { preset: 'official' } })).session.timeLimit, 65 * 120);
  assert.equal((await buildTest(env.api, { mode: 'exam', pearson: true, timing: { preset: 'official', esl: true } })).session.timeLimit, 160 * 60);
});

test("mode 'new': the first N questions of the deterministic, domain-balanced newOrder", T, async () => {
  const states = (await env.api.get<{ states: Record<string, QuestionState> }>('/api/state')).body.states;
  const expected = ruled(
    newOrder(
      pool.filter((q) => !states[q.id]),
      env.meta.domains,
    ),
    env.bank,
    states,
  )
    .slice(0, 12)
    .map((q) => q.id);
  const a = await buildTest(env.api, { mode: 'new', count: 12, shuffleQuestions: false });
  const b = await buildTest(env.api, { mode: 'new', count: 12, shuffleQuestions: false });
  assert.deepEqual(ids(a.session), expected);
  assert.deepEqual(ids(b.session), expected, 'the same questions on every build');
  assert.equal(a.session.realism?.total, 12);
});

test('diagnostic: 28 = 2 per task, deterministic; 2×14 sittings cover different questions', T, async () => {
  const tasks = (env.meta.tasks as { id: string }[]).map((t) => t.id);
  const perTask = (qs: Question[]) => {
    const m: Record<string, number> = {};
    for (const q of qs) m[q.task!] = (m[q.task!] ?? 0) + 1;
    return m;
  };
  const full = await buildTest(env.api, { mode: 'diagnostic' });
  assert.equal(full.session.diagnostic, true);
  assert.equal(full.session.feedback, 'exam');
  assert.equal(full.session.questions.length, 2 * tasks.length);
  assert.deepEqual(perTask(full.questions), Object.fromEntries(tasks.map((t) => [t, 2])));
  const again = await buildTest(env.api, { mode: 'diagnostic' });
  assert.deepEqual(new Set(ids(again.session)), new Set(ids(full.session)), 'deterministic selection');
  // first sitting: 1 per task → answered → the second sitting gets the other 14
  const first = await buildTest(env.api, { mode: 'diagnostic', count: 14 });
  assert.deepEqual(perTask(first.questions), Object.fromEntries(tasks.map((t) => [t, 1])));
  const attempt = await submit(env.api, first.session, first.questions);
  assert.equal(attempt.diagnostic, true, 'stored with the attempt');
  assert.equal(attempt.mode, 'diagnostic');
  const second = await buildTest(env.api, { mode: 'diagnostic', count: 14 });
  assert.deepEqual(perTask(second.questions), Object.fromEntries(tasks.map((t) => [t, 1])));
  assert.ok(!ids(second.session).some((id) => ids(first.session).includes(id)), 'disjoint halves');
  assert.ok(ids(second.session).every((id) => byId.get(id)!.status === 'active'));
});

test('requirements filter (once the bank tags requirements)', T, async (t) => {
  const tagged = pool.filter((q) => q.requirements?.includes('cost'));
  if (!tagged.length) return t.skip('no question carries `requirements` yet (bank.ts computes them from taxonomy.keywords)');
  const states = (await env.api.get<{ states: Record<string, QuestionState> }>('/api/state')).body.states;
  const { session, questions } = await buildTest(env.api, { mode: 'custom', count: 500, filters: { requirements: ['cost'] } });
  assert.equal(session.questions.length, ruled(tagged, env.bank, states).length, '[v5] one per sibling cluster, today’s siblings buried');
  assert.ok(questions.every((q) => q.requirements?.includes('cost')));
  assert.match(session.title, /Chi phí/);
});

test('practice.exclude_out_of_scope (once the bank flags out-of-scope answers)', T, async (t) => {
  const oos = env.bank.filter((q) => q.status === 'active' && q.outOfScope);
  if (!oos.length) return t.skip('no question is flagged `outOfScope` yet (taxonomy scope: out)');
  if (env.meta.practice.exclude_out_of_scope === false) return t.skip('practice.exclude_out_of_scope is off in config.yaml');
  const custom = await buildTest(env.api, { mode: 'custom', count: 500 });
  assert.ok(!custom.questions.some((q) => q.outOfScope), 'custom');
  const exam = await buildTest(env.api, { mode: 'exam', pearson: true });
  assert.ok(!exam.questions.some((q) => q.outOfScope), 'exam');
  const list = await buildTest(env.api, { mode: 'ids', ids: oos.slice(0, 3).map((q) => q.id) });
  assert.equal(list.session.questions.length, Math.min(3, oos.length), 'an explicit list keeps them');
  const pack = oos[0].pack;
  const packTest = await buildTest(env.api, { mode: 'pack', filters: { packs: [pack] } });
  assert.ok(packTest.questions.some((q) => q.outOfScope), 'an explicit pack keeps them');
  const counts = (await env.api.get('/api/state')).body.counts;
  assert.equal(counts.outOfScope, oos.filter((q) => !env.sealed.has(q.id)).length);
});

test('/api/state counts: exclusion counters and the full-mock preview', T, async () => {
  const counts = (await env.api.get<{ counts: Record<string, number> }>('/api/state')).body.counts;
  assert.equal(counts.sealed, 0);
  assert.equal(typeof counts.outOfScope, 'number');
  assert.equal(counts.all, pool.length);
  assert.equal(counts['exam.total'], 65);
  assert.ok(counts['exam.words'] > 0 && counts['exam.estimate'] > 0);
  assert.equal(counts.examLike, pool.filter((q) => isExamLike(q, env.meta)).length);
});

test('goal.esl turns ESL on by default for the exam-pace clocks (once the goal stores it)', T, async (t) => {
  const r = await env.api.post('/api/goal', { esl: true });
  if (r.status !== 200 || r.body?.goal?.esl !== true) return t.skip('POST /api/goal does not store `esl` yet');
  try {
    assert.equal((await buildTest(env.api, { mode: 'exam', pearson: true, timing: { preset: 'official' } })).session.timeLimit, 160 * 60);
    assert.equal((await buildTest(env.api, { mode: 'exam', pearson: true, timing: { preset: 'official', esl: false } })).session.timeLimit, 65 * 120);
  } finally {
    await env.api.post('/api/goal', { esl: false });
  }
});

// ── sealed forms held back (exam.sealed_forms: 2) ───────────────────────────

test('sealed forms: hidden from practice, a sealed exam = form + 15 pilots, used once, then back in practice', T, async (t) => {
  const s = await boot((cfg) => cfg.replace(/^(\s+sealed_forms:\s*)\d+/m, '$12'));
  try {
    const forms = (s.meta.sealed ?? []) as { id: string; status: string; count: number }[];
    if (!forms.length) return t.skip('the server did not create sealed forms (server/lib/sealed.ts ensureSealed)');
    assert.ok(forms.every((f) => f.status === 'sealed') && forms.length === 2, JSON.stringify(forms));
    assert.equal(s.sealed.size, forms.reduce((n, f) => n + f.count, 0), '/api/bank lists every sealed id');

    // practice never serves them
    for (const req of [{ mode: 'custom', count: 500 }, { mode: 'exam', pearson: true }, { mode: 'new', count: 500 }, { mode: 'diagnostic' }] as const) {
      const b = await buildTest(s.api, req);
      assert.ok(!ids(b.session).some((id) => s.sealed.has(id)), `${req.mode} served a sealed question`);
    }
    const some = [...s.sealed].slice(0, 3);
    const free = s.bank.find((q) => q.status === 'active' && !s.sealed.has(q.id))!;
    const list = await buildTest(s.api, { mode: 'ids', ids: [...some, free.id] });
    assert.deepEqual(ids(list.session), [free.id]);
    assert.ok(list.session.notes.includes(`${some.length} câu đang niêm phong đã được bỏ qua.`), list.session.notes.join(' | '));
    const counts = (await s.api.get<{ counts: Record<string, number> }>('/api/state')).body.counts;
    assert.equal(counts.sealed, s.sealed.size);
    assert.equal(counts[`sealed.${forms[0].id}.total`], forms[0].count + counts[`sealed.${forms[0].id}.pilots`]);

    // the sealed exam: the first form's questions are the scored items, 15 pilots from the practice pool
    const exam = await buildTest(s.api, { mode: 'sealed' });
    const { session, questions } = exam;
    assert.equal(session.sealedForm, forms[0].id);
    assert.equal(session.pearson, true);
    assert.equal(session.timingPreset, 'realistic');
    const pilots = new Set(session.unscored);
    const scored = ids(session).filter((id) => !pilots.has(id));
    assert.equal(scored.length, forms[0].count);
    assert.equal(pilots.size, 15);
    assert.ok(scored.every((id) => s.sealed.has(id)), 'scored items are sealed questions');
    assert.ok([...pilots].every((id) => !s.sealed.has(id)), 'pilots come from the practice pool');

    const attempt = await submit(s.api, session, questions, 9);
    assert.equal(attempt.sealedForm, forms[0].id);
    assert.equal(attempt.total, forms[0].count, 'scored over the form only');
    const after = (await s.api.get('/api/meta')).body.sealed as { id: string; status: string }[];
    assert.equal(after.find((f) => f.id === forms[0].id)?.status, 'used');
    const again = await s.api.post<{ error: string }>('/api/tests', { mode: 'sealed', form: forms[0].id });
    assert.equal(again.status, 409);
    assert.match(again.body.error, /đã được làm/);
    // its questions are back in practice; the next sealed exam uses the other form
    const back = await buildTest(s.api, { mode: 'ids', ids: scored.slice(0, 5) });
    assert.deepEqual(ids(back.session), scored.slice(0, 5));
    const next = await buildTest(s.api, { mode: 'sealed' });
    assert.equal(next.session.sealedForm, forms[1].id);
  } finally {
    await shutdown(s);
  }
});
