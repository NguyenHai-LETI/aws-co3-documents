// [v5 τ] 🧑‍🏫 tutor + 📒 notebook routes against the real server on a sandbox, with the fake CLI
// (tests/helpers/fake-claude-tutor.mjs): GET /api/tutor, POST /api/tutor/start|turn|end (hidden key, reveal after 3 turns,
// turn cap, daily cap, sealed refusal, transcript in /api/qa), GET /api/notebook, POST /api/notebook/update|delete|merge.
// Never touches the real repo or a real model. Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { buildTest, wrongKeys } from '../helpers/learner.ts';
import { TRAINER_ROOT } from '../helpers/paths.ts';
import type { AnswerInput, NotebookRunInfo, NotebookView, QaEntry, Question, TutorDialog, TutorStatus } from '../../shared/types.ts';

const T = { timeout: 120_000 };
let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;
let LOG: string;
let qs: Question[];

before(
  async () => {
    sb = makeSandbox();
    const cfg = path.join(sb.home, 'config.yaml');
    fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace(/^(\s+tutor_daily_turns:\s*)\d+/m, '$18'));
    LOG = path.join(sb.root, 'fake-claude.log');
    srv = await startServer({
      home: sb.home,
      env: { TRAINER_ALLOW_COACH: '1', CLAUDE_BIN: path.join(TRAINER_ROOT, 'tests/helpers/fake-claude-tutor.mjs'), FAKE_CLAUDE_LOG: LOG, FAKE_TUTOR_DIR: path.join(sb.root, 'sessions') },
    });
    api = apiClient(srv.base);
    const bank = (await api.get<{ questions: Question[] }>('/api/bank')).body.questions;
    qs = bank.filter((q) => q.status === 'active' && q.answer.length === 1 && q.options.length === 4).slice(0, 8);
  },
  { timeout: 90_000 },
);
after(async () => {
  await srv?.stop();
  sb?.cleanup();
});

const calls = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as { argv: string[]; stdin: string }) : []);
const flag = (argv: string[], name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const wrong = (q: Question) => wrongKeys(q)[0];

test('tutor: status, hidden key, reveal after 3 turns, transcript in coach/qa, rule in the notebook, turn cap', T, async () => {
  const q = qs[0];
  const s = (await api.get<TutorStatus>(`/api/tutor?qid=${q.id}`)).body;
  assert.equal(s.enabled, true, s.reason);
  assert.deepEqual(s.usage, { used: 0, limit: 8, remaining: 8 });
  assert.equal(s.revealAfter, 3);

  const start = await api.post<TutorDialog>('/api/tutor/start', { qid: q.id, pick: wrong(q), why: 'nghe quen' });
  assert.equal(start.status, 200, JSON.stringify(start.body));
  const id = start.body.id;
  assert.equal(start.body.answer, undefined);
  assert.equal((await api.get<TutorStatus>(`/api/tutor?qid=${q.id}`)).body.dialog?.id, id, 'GET resumes the open dialog');
  for (const text of ['Vì nó nghe quen', 'Có lẽ vì chi phí?']) {
    const r = await api.post<TutorDialog>('/api/tutor/turn', { id, text });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.answer, undefined, 'still hidden');
  }
  const last = await api.post<TutorDialog>('/api/tutor/turn', { id, text: 'Tôi vẫn chưa nghĩ ra' });
  assert.equal(last.body.status, 'closed');
  assert.equal(last.body.outcome, 'revealed');
  assert.deepEqual(last.body.answer, q.answer);
  assert.equal(last.body.usage.used, 4);
  assert.equal((await api.post('/api/tutor/turn', { id, text: 'nữa' })).status, 409, 'turn cap');

  const c = calls();
  assert.equal(c.length, 4);
  for (const x of c) {
    assert.equal(flag(x.argv, '--tools'), '', 'no tools');
    assert.equal(flag(x.argv, '--model'), 'sonnet', 'coach.models.tutor of the sandbox config');
    assert.match(flag(x.argv, '--system-prompt-file') ?? '', /coach[\\/]TUTOR\.md$/);
  }
  assert.ok(!c[0].argv.includes('--resume'));
  assert.equal(new Set(c.slice(1).map((x) => flag(x.argv, '--resume'))).size, 1);

  const qa = (await api.get<QaEntry[]>(`/api/qa/${q.id}`)).body;
  assert.equal(qa.length, 1);
  assert.equal(qa[0].kind, 'tutor');
  assert.equal(qa[0].outcome, 'revealed');
  assert.match(qa[0].answer, /🙋 Tôi vẫn chưa nghĩ ra/);
  const nb = (await api.get<NotebookView>('/api/notebook')).body;
  const e = nb.entries.find((x) => x.key === `fake-rule-${q.id}`);
  assert.ok(e, 'closing rule in the notebook');
  assert.deepEqual(e.qids, [q.id]);
  assert.ok(fs.existsSync(path.join(sb.home, 'coach', 'notebook', `${q.domain}.md`)));
});

test('tutor: "tôi chịu", end, sealed refusal, daily cap', T, async () => {
  const g = (await api.post<TutorDialog>('/api/tutor/start', { qid: qs[1].id, pick: wrong(qs[1]) })).body;
  const g1 = (await api.post<TutorDialog>('/api/tutor/turn', { id: g.id, text: 'tôi chịu' })).body;
  assert.equal(g1.outcome, 'gave-up');
  assert.deepEqual(g1.answer, qs[1].answer);

  fs.writeFileSync(path.join(sb.home, 'results', 'sealed.md'), `---\nkind: sealed\nsize: 1\nforms:\n  - id: S1\n    status: sealed\n    ids: [ ${qs[2].id} ]\n---\n`);
  try {
    const before = calls().length;
    const r = await api.post<{ error: string }>('/api/tutor/start', { qid: qs[2].id });
    assert.equal(r.status, 403);
    assert.match(r.body.error, /niêm phong/);
    assert.equal(calls().length, before, 'nothing sent to the AI');
    assert.equal((await api.get<TutorStatus>(`/api/tutor?qid=${qs[2].id}`)).body.sealed, true);
  } finally {
    fs.rmSync(path.join(sb.home, 'results', 'sealed.md'));
  }

  // used: 4 (first dialog) + 2 = 6 of 8
  const d = (await api.post<TutorDialog>('/api/tutor/start', { qid: qs[3].id, pick: wrong(qs[3]) })).body;
  const d1 = (await api.post<TutorDialog>('/api/tutor/turn', { id: d.id, text: 'không rõ' })).body;
  assert.equal(d1.usage.remaining, 0);
  const n = calls().length;
  const d2 = (await api.post<TutorDialog>('/api/tutor/turn', { id: d.id, text: 'vẫn chưa' })).body;
  assert.equal(d2.outcome, 'capped');
  assert.equal(calls().length, n, 'no AI call past the cap');
  assert.equal((await api.post('/api/tutor/start', { qid: qs[4].id })).status, 429);
  assert.equal((await api.post('/api/tutor/end', { id: d.id })).status, 409, 'already closed');
});

test('notebook: update from submitted answers (merge, skipped), delete and merge entries', T, async () => {
  const { session, questions } = await buildTest(api, { mode: 'quick', count: 6 });
  const answers = questions.map((q, i): AnswerInput => ({ q: q.id, pick: i < 4 ? [wrongKeys(q)[0]] : q.answer, t: 30, ...(i === 4 ? { unsure: true } : {}) }));
  const sub = await api.post('/api/results', { session, answers, startedAt: new Date(Date.now() - 300_000).toISOString(), finishedAt: new Date().toISOString(), timedOut: false, timeUsed: 180 });
  assert.equal(sub.status, 200, JSON.stringify(sub.body));
  const v0 = (await api.get<NotebookView>('/api/notebook')).body;
  assert.equal(v0.pending, 5);
  assert.equal(v0.enabled, true);

  const before = calls().length;
  const up = await api.post<{ run: NotebookRunInfo; view: NotebookView }>('/api/notebook/update');
  assert.equal(up.status, 200, JSON.stringify(up.body));
  assert.equal(up.body.run.status, 'success');
  assert.equal(up.body.run.answers, 5);
  assert.equal(up.body.view.pending, 0);
  const c = calls().slice(before);
  assert.equal(c.length, 1);
  assert.equal(flag(c[0].argv, '--tools'), '');
  assert.ok(c[0].argv.includes('--no-session-persistence'));
  const keys = up.body.view.entries.map((e) => e.key);
  assert.ok(keys.some((k) => k.startsWith('fake-') && k !== 'fake-bogus'));
  assert.ok(!keys.includes('fake-bogus'));
  const again = await api.post<{ run: NotebookRunInfo }>('/api/notebook/update');
  assert.equal(again.body.run.status, 'skipped');

  const all = up.body.view.entries.map((e) => e.key);
  assert.ok(all.length >= 2, all.join(','));
  const m = await api.post<{ view: NotebookView }>('/api/notebook/merge', { keys: all.slice(0, 2) });
  assert.equal(m.status, 200, JSON.stringify(m.body));
  assert.ok(!m.body.view.entries.some((e) => e.key === all[1]));
  assert.equal((await api.post('/api/notebook/merge', { keys: ['only-one'] })).status, 400);
  const del = await api.post<NotebookView>('/api/notebook/delete', { key: all[0] });
  assert.equal(del.status, 200);
  assert.ok(!del.body.entries.some((e) => e.key === all[0]));
  assert.equal((await api.post('/api/notebook/delete', { key: all[0] })).status, 404);
  assert.match(fs.readFileSync(path.join(sb.home, 'coach', 'notebook', 'README.md'), 'utf8'), /<!-- notebook \{"through":"/);
});
