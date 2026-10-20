// [v5] γ2 — "↩️ Hoàn tác" end to end: an ENRICH run and a generate run (fake Claude CLI) leave pre-images; the Coach list
// shows what can be undone; POST /api/coach/runs/:id/undo restores / retires; a later edit is a conflict; undo-info for
// the Bank panel; refusals. Sandbox repo, never a real model. Run: npm run test:e2e
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer } from '../helpers/server.ts';
import { TRAINER_ROOT } from '../helpers/paths.ts';
import type { CoachEvent, CoachRunInfo, CoachRunOutcome, Question, UndoInfo, UndoResult } from '../../shared/types.ts';

type Run = CoachRunInfo & { outcome?: CoachRunOutcome; undoable?: { changed: number; created: number } };

const sb = makeSandbox({ git: true });
const home = sb.home;
const cfgFile = path.join(home, 'config.yaml');
fs.writeFileSync(cfgFile, fs.readFileSync(cfgFile, 'utf8').replace('before_ai: true', 'before_ai: false').replace('after_ai: true', 'after_ai: false'));

const ids = fs
  .readFileSync(path.join(home, 'bank', 'packs', 'imported', '03-database-services-v1.md'), 'utf8')
  .split(/\n(?=## Q )/)
  .map((b) => /^## Q (\S+)/.exec(b)?.[1])
  .filter((x): x is string => !!x)
  .slice(0, 3);
const [A, B, C] = ids;

const server = await startServer({
  home,
  repo: sb.repo,
  env: { TRAINER_ALLOW_COACH: '1', CLAUDE_BIN: path.join(TRAINER_ROOT, 'tests/helpers/fake-claude.mjs'), FAKE_SLOW_VERIFY_MS: '0', FAKE_SLOW_FILE_MS: '2500' },
});
const api = apiClient(server.base);
after(async () => {
  await server.stop();
  sb.cleanup();
});

async function runAi(task: string, params: Record<string, unknown>): Promise<Run> {
  const r = await api.post<{ run: Run }>('/api/coach/run', { task, params });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const deadline = Date.now() + 90_000;
  for (;;) {
    const events = (await api.get<{ events: CoachEvent[] }>(`/api/coach/runs/${encodeURIComponent(r.body.run.id)}`)).body.events;
    if (events.some((e) => e.kind === 'end')) break;
    if (Date.now() > deadline) throw new Error(events.map((e) => e.text).join('\n'));
    await new Promise((res) => setTimeout(res, 150));
  }
  return (await api.get<{ runs: Run[] }>('/api/coach')).body.runs.find((x) => x.id === r.body.run.id)!;
}
const question = async (id: string) => (await api.get<{ questions: Question[] }>('/api/bank')).body.questions.find((q) => q.id === id)!;

test('ENRICH run → Coach list offers the undo → undo restores the previous versions; the Bank panel info follows', async () => {
  const before = await question(A);
  const run = await runAi('enrich', { ids: [A, B], tasks: 'explain,hint' });
  assert.equal(run.status, 'success');
  assert.deepEqual(run.undoable, { changed: 2, created: 0 });
  assert.notEqual((await question(A)).explanation, before.explanation);
  const info = (await api.get<UndoInfo | null>(`/api/coach/undo-info?qid=${A}`)).body;
  assert.equal(info?.run, run.id);
  assert.equal(info?.task, 'enrich');
  assert.ok(fs.existsSync(path.join(home, 'coach', 'patches', `${run.id}.before.json`)));

  const u = await api.post<UndoResult>(`/api/coach/runs/${run.id}/undo`, { qid: A });
  assert.equal(u.status, 200, JSON.stringify(u.body));
  assert.deepEqual(u.body, { run: run.id, restored: [A], retired: [], conflicts: [] });
  const restored = await question(A);
  assert.equal(restored.explanation, before.explanation);
  assert.equal(restored.enriched, before.enriched);
  assert.equal((await api.get<UndoInfo | null>(`/api/coach/undo-info?qid=${A}`)).body, null);
  const rest = await api.post<UndoResult>(`/api/coach/runs/${run.id}/undo`, {});
  assert.deepEqual(rest.body.restored, [B]);
  const rec = (await api.get<{ runs: Run[] }>('/api/coach')).body.runs.find((x) => x.id === run.id)!;
  assert.deepEqual(rec.outcome?.undo?.restored, [B]);
  assert.equal(rec.undoable, undefined, 'nothing left to undo');
  assert.ok(fs.existsSync(path.join(home, 'coach', 'patches', `${run.id}.undo.json`)));
});

test('a question edited after the run is a conflict (untouched); generate run → undo retires its new questions', async () => {
  const run = await runAi('enrich', { ids: [C], tasks: 'hint' });
  assert.equal(run.status, 'success');
  const retire = await api.post('/api/quality/retire', { items: [{ id: C }] }); // a later change by the learner
  assert.equal(retire.status, 200, JSON.stringify(retire.body));
  const u = await api.post<UndoResult>(`/api/coach/runs/${run.id}/undo`, {});
  assert.equal(u.body.restored.length, 0);
  assert.equal(u.body.conflicts[0].id, C);
  assert.equal((await question(C)).status, 'retired');

  const g = await runAi('generate', { sources: ['03-database-services.md'], count: 2 });
  assert.equal(g.status, 'success');
  const created = (await api.get<{ questions: Question[] }>('/api/bank')).body.questions.filter((q) => q.file === g.outcome?.pack).map((q) => q.id);
  assert.equal(created.length, 2);
  assert.deepEqual(g.undoable, { changed: 0, created: 2 });
  assert.equal((await api.get<UndoInfo | null>(`/api/coach/undo-info?qid=${created[0]}`)).body?.created, true);
  const ug = await api.post<UndoResult>(`/api/coach/runs/${g.id}/undo`, {});
  assert.deepEqual(ug.body.retired, created);
  for (const id of created) assert.equal((await question(id)).status, 'retired');
});

test('refusals: unknown run 404, a question the run did not touch 400, undo-info without qid 400, busy 409', async () => {
  assert.equal((await api.post('/api/coach/runs/2026-01-01_000000_enrich/undo', {})).status, 404);
  const run = (await api.get<{ runs: Run[] }>('/api/coach')).body.runs.find((r) => r.task === 'enrich')!;
  assert.equal((await api.post(`/api/coach/runs/${run.id}/undo`, { qid: 'not-in-run' })).status, 400);
  assert.equal((await api.post(`/api/coach/runs/${run.id}/undo`, { qid: 5 })).status, 400);
  assert.equal((await api.get('/api/coach/undo-info')).status, 400);
  // a held coach lock (another process running coach) → 409
  const lock = path.join(home, 'coach', '.lock');
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, runId: 'other-run' }));
  try {
    const busy = await api.post<{ error: string }>(`/api/coach/runs/${run.id}/undo`, {});
    assert.equal(busy.status, 409);
    assert.match(busy.body.error, /đợi xong rồi hoàn tác/);
  } finally {
    fs.rmSync(lock, { force: true });
  }
});

test('[R3] while a file-mode run edits the bank, learner decisions wait (409) — its undo can never revert them; afterwards they go through', async () => {
  const r = await api.post<{ run: Run }>('/api/coach/run', { task: 'analyze', params: {} });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const lock = JSON.parse(fs.readFileSync(path.join(home, 'coach', '.lock'), 'utf8')) as { bankWrites?: boolean };
  assert.equal(lock.bankWrites, true, 'file-mode runs mark the lock');
  const busy = await api.post<{ error: string }>('/api/verify/decision', { qid: A, decision: 'approve' });
  assert.equal(busy.status, 409);
  assert.match(busy.body.error, /AI đang sửa ngân hàng trực tiếp/);
  for (const deadline = Date.now() + 60_000; ; ) {
    const ev = (await api.get<{ events: CoachEvent[] }>(`/api/coach/runs/${r.body.run.id}`)).body.events;
    if (ev.some((e) => e.kind === 'end')) break;
    if (Date.now() > deadline) throw new Error('analyze did not finish');
    await new Promise((res) => setTimeout(res, 150));
  }
  const after = await api.post<{ error: string }>('/api/verify/decision', { qid: A, decision: 'approve' });
  assert.notEqual(after.status, 409, 'no run: the decision is handled (400 here: never blind-solved)');
});

test('[R3] a malformed % in a run id is a client error (400 / 404), never a 500', async () => {
  for (const id of ['%E0%A4%A', 'run%ZZ', 'x%']) {
    const g = await api.get(`/api/coach/runs/${id}`);
    const u = await api.post(`/api/coach/runs/${id}/undo`, {});
    assert.ok(g.status >= 400 && g.status < 500, `GET ${id} → ${g.status}`);
    assert.ok(u.status >= 400 && u.status < 500, `POST ${id} → ${u.status}`);
  }
});
