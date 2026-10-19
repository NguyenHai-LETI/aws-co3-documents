// AI coach runs sync themselves (config sync.before_ai / sync.after_ai): two sandbox machines share a bare remote and
// the coach is a fake Claude CLI (tests/helpers/fake-claude.mjs). Never touches the real repo or a real model.
// Run: npm run test:e2e
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type ServerHandle } from '../helpers/server.ts';
import { configureRepo, git } from '../helpers/git.ts';
import { rng, takeTest } from '../helpers/learner.ts';
import { TRAINER_ROOT } from '../helpers/paths.ts';
import type { CoachEvent, CoachRunInfo } from '../../shared/types.ts';

const COACH_ENV = { TRAINER_ALLOW_COACH: '1', CLAUDE_BIN: path.join(TRAINER_ROOT, 'tests/helpers/fake-claude.mjs') };
const DATA = ['trainer/results', 'trainer/coach', 'trainer/bank'];

const cleanups: (() => unknown)[] = [];
after(async () => {
  for (const c of cleanups.reverse()) await c();
});

/** Machine A = the sandbox repo, machine B = a second clone of the same bare remote ("GitHub"). */
function twoMachines() {
  const sb = makeSandbox({ git: true });
  cleanups.push(() => sb.cleanup());
  const b = path.join(sb.root, 'machine-b');
  git(sb.root, 'clone', '-q', sb.remote!, b);
  configureRepo(b, 'machine-b');
  return { a: sb.repo!, b, remote: sb.remote! };
}

async function server(repo: string, env: Record<string, string> = {}): Promise<{ s: ServerHandle; api: ApiClient }> {
  const s = await startServer({ home: path.join(repo, 'trainer'), repo, env });
  cleanups.push(() => s.stop());
  return { s, api: apiClient(s.base) };
}

/** Machine B practises and pushes its result. */
async function otherMachinePractises(b: string, seed: number) {
  const { api, s } = await server(b);
  await takeTest(api, { mode: 'quick' }, { daysAgo: 0.01, rand: rng(seed) });
  const r = await api.post('/api/sync', {});
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  await s.stop();
}

async function runCoach(api: ApiClient): Promise<{ run: CoachRunInfo; log: string }> {
  const r = await api.post<{ run: CoachRunInfo }>('/api/coach/run', { task: 'analyze' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const id = r.body.run.id;
  const deadline = Date.now() + 90_000;
  for (;;) {
    const events = (await api.get<{ events: CoachEvent[] }>(`/api/coach/runs/${encodeURIComponent(id)}`)).body.events;
    if (events.some((e) => e.kind === 'end')) {
      const runs = (await api.get<{ runs: CoachRunInfo[] }>('/api/coach')).body.runs;
      return { run: runs.find((x) => x.id === id)!, log: events.map((e) => e.text).join('\n') };
    }
    if (Date.now() > deadline) throw new Error(`run ${id} did not finish:\n${events.map((e) => e.text).join('\n')}`);
    await new Promise((res) => setTimeout(res, 200));
  }
}

const onRemote = (remote: string, rel: string) => spawnSync('git', ['show', `main:${rel}`], { cwd: remote, encoding: 'utf8' }).stdout;

test('analyze syncs first (the AI sees the other machine’s results), then pushes what it wrote', async () => {
  const { a, b, remote } = twoMachines();
  await otherMachinePractises(b, 3);
  const { api } = await server(a, COACH_ENV);
  await takeTest(api, { mode: 'quick' }, { daysAgo: 0.005, rand: rng(4) }); // A's own result, not synced yet

  const { run, log } = await runCoach(api);
  assert.equal(run.status, 'success', log);
  assert.match(log, /⇅ Đồng bộ trước khi chạy AI: Đã đồng bộ: .*nhận 1 commit từ máy khác/);
  assert.match(log, /Snapshot: 2 bài/);
  assert.match(log, /⇅ Đồng bộ sau khi chạy AI: Đã đồng bộ: commit 1 file dữ liệu, đẩy 1 commit/);
  // what the "AI" saw when it ran: both machines' results, on disk and in the snapshot
  const profile = fs.readFileSync(path.join(a, 'trainer/coach/learner-profile.md'), 'utf8');
  assert.match(profile, /results_on_disk: 2\nsnapshot_attempts: 2/);
  // its output is on the remote already, nothing left to commit
  assert.match(onRemote(remote, 'trainer/coach/learner-profile.md'), /snapshot_attempts: 2/);
  assert.equal(git(a, 'status', '--porcelain', '--', ...DATA), '');
  // machine B gets the AI output with its next sync
  const { api: apiB } = await server(b);
  assert.match((await apiB.post('/api/sync', {})).body.message, /nhận 2 commit từ máy khác/);
  assert.match(fs.readFileSync(path.join(b, 'trainer/coach/learner-profile.md'), 'utf8'), /snapshot_attempts: 2/);

  const coach = (await api.get('/api/coach')).body;
  assert.deepEqual(coach.sync, { beforeAi: true, afterAi: true });
  assert.deepEqual((await api.get('/api/meta')).body.syncAi, { before: true, after: true });
});

test('a failed sync never blocks the AI: it runs on this machine’s data and the log says why', async () => {
  const { a } = twoMachines();
  git(a, 'remote', 'set-url', 'origin', path.join(path.dirname(a), 'gone.git'));
  const { api } = await server(a, COACH_ENV);
  const { run, log } = await runCoach(api);
  assert.equal(run.status, 'success', log);
  assert.match(log, /⚠️ Không đồng bộ được trước khi chạy AI: .*AI vẫn chạy với dữ liệu trên máy này\./);
  assert.match(log, /⚠️ Không đồng bộ được sau khi chạy AI: .*Kết quả AI vẫn nằm trên máy này/);
  assert.ok(fs.existsSync(path.join(a, 'trainer/coach/learner-profile.md')));
});

test('sync.before_ai / sync.after_ai = false → the run leaves git alone', async () => {
  const { a, remote } = twoMachines();
  const cfgFile = path.join(a, 'trainer/config.yaml');
  const cfg = fs.readFileSync(cfgFile, 'utf8');
  assert.match(cfg, /before_ai: true[\s\S]*after_ai: true/);
  fs.writeFileSync(cfgFile, cfg.replace('before_ai: true', 'before_ai: false').replace('after_ai: true', 'after_ai: false'));
  const head = git(remote, 'rev-parse', 'main');
  const { api } = await server(a, COACH_ENV);
  const { run, log } = await runCoach(api);
  assert.equal(run.status, 'success', log);
  assert.doesNotMatch(log, /⇅|Không đồng bộ/);
  assert.equal(git(remote, 'rev-parse', 'main'), head, 'nothing pushed');
  assert.match(git(a, 'status', '--porcelain', '--', 'trainer/coach'), /learner-profile\.md/, 'AI output stays uncommitted');
  assert.deepEqual((await api.get('/api/coach')).body.sync, { beforeAi: false, afterAi: false });
});

test('coach-run.ts syncs before checking for new data: a result from the other machine triggers the analysis', async () => {
  const { a, b, remote } = twoMachines();
  await otherMachinePractises(b, 5);
  // machine A has no result of its own and no open issue: without the sync the run would be skipped
  const env: NodeJS.ProcessEnv = { ...process.env, TRAINER_HOME: path.join(a, 'trainer'), TRAINER_REPO: a, ...COACH_ENV };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'ANTHROPIC_API_KEY']) delete env[k];
  const r = spawnSync(process.execPath, ['scripts/coach-run.ts'], { cwd: TRAINER_ROOT, env, encoding: 'utf8', timeout: 120_000 });
  const out = r.stdout + r.stderr;
  assert.equal(r.status, 0, out);
  assert.match(out, /⇅ Đồng bộ trước khi chạy AI: Đã đồng bộ: nhận 1 commit từ máy khác/);
  assert.doesNotMatch(out, /bỏ qua/);
  assert.match(out, /Snapshot: 1 bài/);
  assert.match(out, /⇅ Đồng bộ sau khi chạy AI: Đã đồng bộ: commit 1 file dữ liệu, đẩy 1 commit/);
  assert.match(onRemote(remote, 'trainer/coach/learner-profile.md'), /results_on_disk: 1\nsnapshot_attempts: 1/);
});
