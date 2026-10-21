// End-to-end regressions of review R2 against the real server (sandbox with two sealed forms, free port):
//   #2 two sessions of one sealed form / "Mở sớm" during a session → only the first submit is "điểm trên câu mới"
//   #3 the fresh split counts never-viewed scored answers as wrong, and a rushed mock gets no split
//   #6 the onboarding plan's sealed session is pinned to the form its title names
// Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { buildTest, rng, seedHistory, wrongKeys } from '../helpers/learner.ts';
import type { AnswerInput, Attempt, OnboardingPlanResponse, ProgressResponse, Question, ResultAnnotations, TestSession } from '../../shared/types.ts';

let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;
const T = { timeout: 180_000 };
const DAY = 86_400_000;

const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

before(
  async () => {
    sb = makeSandbox();
    const cfgFile = path.join(sb.home, 'config.yaml');
    fs.writeFileSync(cfgFile, fs.readFileSync(cfgFile, 'utf8').replace(/^(\s+sealed_forms:\s*)\d+/m, '$12'));
    const notRepo = path.join(sb.root, 'not-a-repo');
    fs.mkdirSync(notRepo);
    srv = await startServer({ home: sb.home, repo: notRepo });
    api = apiClient(srv.base);
    await seedHistory(api); // readiness exists before the sealed sittings
  },
  { timeout: 180_000 },
);

after(async () => {
  await srv?.stop();
  if (process.env.E2E_KEEP) console.log(`sandbox kept: ${sb?.root}`);
  else sb?.cleanup();
});

async function submit(session: TestSession, answers: AnswerInput[], daysAgo: number, timedOut = false): Promise<Attempt> {
  const finished = Date.now() - daysAgo * DAY;
  const timeUsed = answers.reduce((s, a) => s + a.t, 0) + 30;
  const r = await api.post<{ attempt: Attempt }>('/api/results', { session, answers, startedAt: new Date(finished - timeUsed * 1000).toISOString(), finishedAt: new Date(finished).toISOString(), timedOut, timeUsed });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.attempt;
}
const annotations = async (id: string) => (await api.get<{ annotations: ResultAnnotations }>(`/api/results/${encodeURIComponent(id)}`)).body.annotations;
const progress = async () => (await api.get<ProgressResponse>('/api/progress')).body;
const answersAt = (qs: Question[], acc: number, seed: number, t = 60): AnswerInput[] => {
  const r = rng(seed);
  return qs.map((q) => ({ q: q.id, pick: r() < acc ? q.answer : [wrongKeys(q)[0]], t }));
};

test('#2 two sessions of one sealed form: the first submit is the only "điểm trên câu mới"', T, async () => {
  const a = await buildTest(api, { mode: 'sealed' });
  const b = await buildTest(api, { mode: 'sealed' }); // a second tab, or abandoned and restarted
  assert.deepEqual([a.session.sealedForm, b.session.sealedForm], ['S1', 'S1']);
  const first = await submit(a.session, answersAt(a.questions, 0.6, 3), 2);
  const second = await submit(b.session, answersAt(b.questions, 0.95, 4), 1);
  assert.equal(first.sealedForm, 'S1');
  assert.deepEqual([second.mode, second.sealedForm], ['sealed', undefined], 'a retake keeps mode sealed, without sealed_form');
  assert.doesNotMatch(fs.readFileSync(path.join(sb.home, second.file), 'utf8'), /sealed_form/);
  const p = await progress();
  assert.deepEqual(p.external.filter((e) => e.internal).map((e) => [e.source, e.attempt, e.score]), [['Đề niêm phong S1', first.id, first.score]]);
  const s1 = p.sealed!.find((f) => f.id === 'S1')!;
  assert.deepEqual([s1.status, s1.attempt, s1.score], ['used', first.id, first.score]);
  assert.equal((await annotations(first.id)).sealedOfficial, 'S1');
  const retake = await annotations(second.id);
  assert.equal(retake.sealedOfficial, undefined);
  assert.equal(retake.fresh?.seenBefore, retake.fresh?.total, 'every scored question of the retake was seen in the first sitting');
});

test('#2 "Mở sớm" while a sealed session runs, then submit: no sealed_form, no calibration point', T, async () => {
  const t = await buildTest(api, { mode: 'sealed' });
  assert.equal(t.session.sealedForm, 'S2');
  const rel = await api.post('/api/sealed/release', { form: 'S2' });
  assert.equal(rel.status, 200, JSON.stringify(rel.body));
  const att = await submit(t.session, answersAt(t.questions, 0.5, 5), 0.5);
  assert.equal(att.sealedForm, undefined);
  const p = await progress();
  const s2 = p.sealed!.find((f) => f.id === 'S2')!;
  assert.deepEqual([s2.status, s2.attempt, s2.score], ['released', undefined, undefined]);
  assert.equal(p.external.filter((e) => e.internal).length, 1, 'still only the S1 sitting');
  assert.equal((await annotations(att.id)).sealedOfficial, undefined);
});

test('#3 a timed-out mock: never-viewed scored answers count as wrong in the fresh split; a rushed mock has no split', T, async () => {
  const before = (await api.get<{ states: Record<string, unknown> }>('/api/state')).body.states;
  const t = await buildTest(api, { mode: 'exam', pearson: true });
  const pilots = new Set(t.session.unscored ?? []);
  const answers = t.questions.map((q, i): AnswerInput => (i >= 35 ? { q: q.id, pick: [], t: 0 } : { q: q.id, pick: i % 3 ? q.answer : [wrongKeys(q)[0]], t: 70 }));
  const att = await submit(t.session, answers, 0, true);
  const ann = await annotations(att.id);
  const scored = att.answers.filter((r) => r.scored !== false);
  const blank = (q: string) => ann.unviewed.includes(q);
  const firstTimeBlank = scored.filter((r) => blank(r.q) && !before[r.q]).length;
  const expected = {
    total: scored.length,
    seenBefore: scored.filter((r) => (blank(r.q) ? !!before[r.q] : (ann.exposure[r.q] ?? 0) >= 2)).length,
    answers: scored.filter((r) => !blank(r.q) && ann.exposure[r.q] === 1).length + firstTimeBlank,
    correct: scored.filter((r) => !blank(r.q) && ann.exposure[r.q] === 1 && r.ok).length,
  };
  assert.ok(firstTimeBlank > 0, 'fixture: blank first-time questions');
  assert.deepEqual(ann.fresh, expected);
  assert.equal(ann.fresh!.seenBefore + ann.fresh!.answers, ann.fresh!.total, 'every scored answer is classified');
  assert.ok(pilots.size === 15);
  // rushed: median 2 s per answer → not part of the history, no split (not "đã gặp 0/50 · không có câu mới")
  const r = await buildTest(api, { mode: 'exam', pearson: true });
  const rushed = await submit(r.session, r.questions.map((q) => ({ q: q.id, pick: q.answer, t: 2 })), 0);
  assert.equal(rushed.rushed, true);
  assert.equal((await annotations(rushed.id)).fresh, undefined);
});

test('#6 onboarding: the sealed session of the plan names its form and starts exactly that form', T, async () => {
  const created = await api.post<{ created?: string[] }>('/api/sealed/create', { forms: 1, size: 20 });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const form = created.body.created![0];
  await api.post('/api/goal', { examDate: dayKey(Date.now() + 10 * DAY) }); // the only sealed form is due within the week
  const diag = await buildTest(api, { mode: 'diagnostic' });
  const att = await submit(diag.session, answersAt(diag.questions, 0.6, 9), 0);
  const res = await api.post<OnboardingPlanResponse>('/api/onboarding/plan', { attemptId: att.id });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const last = res.body.plan.sessions.at(-1)!;
  assert.deepEqual([last.filter?.mode, last.filter?.form], ['sealed', form]);
  assert.match(last.title, new RegExp(form));
  const started = await api.post<{ session: TestSession }>('/api/tests', { mode: 'coach', plan: `${res.body.plan.id}#${last.id}` });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  assert.equal(started.body.session.sealedForm, form, 'the plan session builds the form it names (the web app confirms it before starting)');
});
