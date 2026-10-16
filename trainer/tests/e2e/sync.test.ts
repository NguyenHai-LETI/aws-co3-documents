// Two-machine sync (server/lib/sync.ts) against throwaway repos: a local bare remote + clones "a" and "b".
// Never touches the real repository. Run: npm run test:e2e
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { appendFile, git, isolateGitConfig, makeGitWorld, writeFile, type GitWorld } from '../helpers/git.ts';
import { explainGitError, redact, runSync, syncDisabledReason, syncStatus, type SyncOptions } from '../../server/lib/sync.ts';

isolateGitConfig();

const DATA = ['trainer/results', 'trainer/coach', 'trainer/bank'];
const SEED: Record<string, string> = {
  'trainer/bank/issues.md': '# Issues\n\n- [ ] 2026-10-01 · `q-01` · typo · seed\n',
  'trainer/bank/ratings.md': '# Ratings\n\n- 2026-10-01 · `q-01` · up · seed\n',
  'trainer/coach/learner-profile.md': '# Learner profile\n\nfocus: networking\n',
  'trainer/results/2026/10/2026-10-01_090000_quick.md': '---\nid: seed\n---\n',
  'trainer/server/code.ts': 'export const x = 1;\n',
};

const worlds: GitWorld[] = [];
after(() => {
  for (const w of worlds) w.cleanup();
});
function world(): GitWorld {
  const w = makeGitWorld(SEED);
  worlds.push(w);
  return w;
}
const sync = (repoDir: string, host: string, extra: Partial<SyncOptions> = {}) =>
  runSync({ repoDir, host, dataPaths: DATA, force: true, now: new Date('2026-10-16T10:30:00'), ...extra });
const subject = (dir: string, ref = 'HEAD') => git(dir, 'log', '-1', '--format=%s', ref);
const exists = (dir: string, rel: string) => fs.existsSync(path.join(dir, rel));
const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), 'utf8');

test('commits only the data folders, pushes, and the other machine receives it', async () => {
  const w = world();
  const a = w.clone('a');
  const b = w.clone('b');

  writeFile(a, 'trainer/results/2026/10/2026-10-16_100000_exam.md', '---\nid: from-a\n---\n');
  appendFile(a, 'trainer/bank/issues.md', '- [ ] 2026-10-16 · `q-02` · wrong-key · from A\n');
  writeFile(a, 'trainer/coach/runs/run.log', 'ignored by .gitignore\n');
  appendFile(a, 'trainer/server/code.ts', '// local code edit, not data\n');

  const ra = await sync(a, 'mac-a');
  assert.equal(ra.ok, true, ra.message);
  assert.equal(ra.committed, 2);
  assert.equal(ra.pushed, 1);
  assert.equal(ra.host, 'mac-a');
  assert.deepEqual(ra.steps.map((s) => s.cmd.split(' ')[1]), ['add', 'commit', 'pull', 'push']);
  assert.ok(ra.steps.every((s) => s.ok));
  assert.equal(subject(w.remote, 'main'), 'trainer: sync từ mac-a 2026-10-16 10:30');
  const files = git(a, 'show', '--name-only', '--format=', 'HEAD').split('\n');
  assert.deepEqual(files.sort(), ['trainer/bank/issues.md', 'trainer/results/2026/10/2026-10-16_100000_exam.md']);
  assert.match(git(a, 'status', '--porcelain', '--', 'trainer/server'), /M trainer\/server\/code\.ts/, 'code edits stay uncommitted');

  // machine B appended to the same log at the same spot → union merge keeps both lines
  writeFile(b, 'trainer/results/2026/10/2026-10-16_101500_quick.md', '---\nid: from-b\n---\n');
  appendFile(b, 'trainer/bank/issues.md', '- [ ] 2026-10-16 · `q-03` · typo · from B\n');
  const rb = await sync(b, 'mac-b');
  assert.equal(rb.ok, true, rb.message);
  assert.equal(rb.received, 1);
  assert.equal(rb.pushed, 1);
  assert.ok(exists(b, 'trainer/results/2026/10/2026-10-16_100000_exam.md'));
  const issues = read(b, 'trainer/bank/issues.md');
  assert.match(issues, /from A/);
  assert.match(issues, /from B/);

  // back on A: nothing to commit, B's commit arrives
  const ra2 = await sync(a, 'mac-a');
  assert.equal(ra2.ok, true, ra2.message);
  assert.equal(ra2.committed, 0);
  assert.equal(ra2.received, 1);
  assert.equal(ra2.pushed, 0);
  assert.ok(exists(a, 'trainer/results/2026/10/2026-10-16_101500_quick.md'));
  assert.match(read(a, 'trainer/bank/issues.md'), /from B/);
  assert.match(read(a, 'trainer/server/code.ts'), /local code edit/, 'autostash restored the unrelated edit');

  const st = await syncStatus({ repoDir: a, host: 'mac-a', dataPaths: DATA });
  assert.equal(st.branch, 'main');
  assert.equal(st.remote, 'origin/main');
  assert.equal(st.ahead, 0);
  assert.equal(st.behind, 0);
  assert.equal(st.dirtyData, 0);
  assert.equal(st.error, undefined);
  assert.match(st.lastSync?.subject ?? '', /^trainer: sync từ mac-b/);
});

test('ratings and Q&A logs merge with union too; deletions are synced', async () => {
  const w = world();
  const a = w.clone('a');
  const b = w.clone('b');
  appendFile(a, 'trainer/bank/ratings.md', '- 2026-10-16 · `q-05` · down · A\n');
  writeFile(a, 'trainer/coach/qa/q-05.md', '# q-05\n\n## A asks\n');
  fs.rmSync(path.join(a, 'trainer/results/2026/10/2026-10-01_090000_quick.md'));
  assert.equal((await sync(a, 'mac-a')).ok, true);

  appendFile(b, 'trainer/bank/ratings.md', '- 2026-10-16 · `q-06` · up · B\n');
  writeFile(b, 'trainer/coach/qa/q-05.md', '# q-05\n\n## B asks\n');
  const rb = await sync(b, 'mac-b');
  assert.equal(rb.ok, true, rb.message);
  assert.match(read(b, 'trainer/bank/ratings.md'), /q-05[\s\S]*q-06|q-06[\s\S]*q-05/);
  const qa = read(b, 'trainer/coach/qa/q-05.md');
  assert.match(qa, /A asks/);
  assert.match(qa, /B asks/);
  assert.equal(exists(b, 'trainer/results/2026/10/2026-10-01_090000_quick.md'), false, 'deleted result removed on the other machine');
});

test('a real conflict aborts the rebase and keeps the local commit', async () => {
  const w = world();
  const a = w.clone('a');
  const b = w.clone('b');
  writeFile(a, 'trainer/coach/learner-profile.md', '# Learner profile\n\nfocus: databases (A)\n');
  assert.equal((await sync(a, 'mac-a')).ok, true);

  writeFile(b, 'trainer/coach/learner-profile.md', '# Learner profile\n\nfocus: security (B)\n');
  const rb = await sync(b, 'mac-b');
  assert.equal(rb.ok, false);
  assert.deepEqual(rb.conflicts, ['trainer/coach/learner-profile.md']);
  assert.match(rb.message, /Xung đột/);
  assert.match(rb.hint ?? '', /an toàn/);
  assert.ok(rb.steps.some((s) => s.cmd === 'git rebase --abort' && s.ok));
  assert.equal(fs.existsSync(path.join(b, '.git', 'rebase-merge')), false, 'no rebase left in progress');
  assert.equal(subject(b), 'trainer: sync từ mac-b 2026-10-16 10:30', 'local sync commit kept');
  assert.match(read(b, 'trainer/coach/learner-profile.md'), /security \(B\)/);
  const st = await syncStatus({ repoDir: b, dataPaths: DATA });
  assert.equal(st.ahead, 1);
  assert.equal(st.behind, 1);
});

test('dry run reports without committing, pulling or pushing', async () => {
  const w = world();
  const a = w.clone('a');
  const b = w.clone('b');
  writeFile(b, 'trainer/results/2026/10/2026-10-16_120000_srs.md', '---\nid: b\n---\n');
  assert.equal((await sync(b, 'mac-b')).ok, true);

  writeFile(a, 'trainer/results/2026/10/2026-10-16_121000_weak.md', '---\nid: a\n---\n');
  const head = git(a, 'rev-parse', 'HEAD');
  const remoteHead = git(w.remote, 'rev-parse', 'main');
  const r = await sync(a, 'mac-a', { dryRun: true });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.dryRun, true);
  assert.match(r.message, /sẽ commit 1 file/);
  assert.match(r.message, /nhận 1 commit/);
  assert.equal(git(a, 'rev-parse', 'HEAD'), head);
  assert.equal(git(w.remote, 'rev-parse', 'main'), remoteHead);
  assert.match(git(a, 'status', '--porcelain'), /\?\? trainer\/results\//);
  const st = await syncStatus({ repoDir: a, dataPaths: DATA });
  assert.equal(st.behind, 1);
  assert.equal(st.dirtyData, 1);
  assert.deepEqual(st.dirtyFiles, ['trainer/results/2026/10/2026-10-16_121000_weak.md']);

  const real = await sync(a, 'mac-a');
  assert.equal(real.ok, true, real.message);
  assert.equal(real.received, 1, 'counted even though the dry run already fetched');
  assert.equal(real.pushed, 1);
  assert.match(real.message, /nhận 1 commit/);
});

test('after the pull, results graded with the old answer layout are remapped (migrateResults) and synced', async () => {
  const w = world();
  const a = w.clone('a');
  const b = w.clone('b');
  const oldLayout = (id: string) =>
    [
      '---',
      'kind: attempt',
      `id: ${id}`,
      'mode: quick',
      'finished: 2026-10-15T09:10:00+07:00',
      'answers:',
      '  - { q: q-01, pick: A, key: A, ok: true, t: 30, est: 45 }',
      '  - { q: q-02, pick: B, key: C, ok: false, t: 40, est: 45, elim: D }',
      '---',
      '',
      `# ${id}`,
      '',
    ].join('\n');
  // machine B studied before the rebalance and has not synced since
  writeFile(b, 'trainer/results/2026/10/2026-10-15_091000_quick.md', oldLayout('b-old'));
  // machine A rebalanced the bank → migration record (old letter → new letter)
  const record = {
    id: '2026-10-16-rebalance-answers',
    applied: '2026-10-16T08:00:00+07:00',
    kind: 'rebalance-answers',
    questions: { 'q-01': { A: 'C', B: 'A', C: 'B', D: 'D' }, 'q-02': { A: 'B', B: 'D', C: 'A', D: 'C' } },
    answers: { 'q-01': ['A', 'C'], 'q-02': ['C', 'A'] },
  };
  writeFile(a, 'trainer/bank/migrations/2026-10-16-rebalance-answers.json', JSON.stringify(record, null, 2) + '\n');
  const ra = await sync(a, 'mac-a', { dataDir: path.join(a, 'trainer') });
  assert.equal(ra.ok, true, ra.message);
  assert.equal(ra.migrated, 0);

  const rb = await sync(b, 'mac-b', { dataDir: path.join(b, 'trainer') });
  assert.equal(rb.ok, true, rb.message);
  assert.equal(rb.migrated, 1);
  assert.equal(rb.pushed, 2, 'the sync commit + the migration commit');
  const step = rb.steps.find((s) => s.cmd === 'migrateResults');
  assert.ok(step?.ok && /^1 file/.test(step.output), JSON.stringify(step));
  assert.match(rb.message, /chuyển 1 file kết quả/);
  const pushed = git(w.remote, 'show', 'main:trainer/results/2026/10/2026-10-15_091000_quick.md');
  assert.match(pushed, /layout: 2/);
  assert.match(pushed, /q: q-01, pick: C, key: C/);
  assert.match(pushed, /q: q-02, pick: D, key: A, .*elim: C/);
  assert.match(pushed, /Ký tự đáp án đã chuyển/);
  assert.match(subject(w.remote, 'main'), /\(chuyển ký tự đáp án\)$/);
  assert.equal(git(b, 'status', '--porcelain', '--', 'trainer'), '', 'nothing left uncommitted');

  const again = await sync(b, 'mac-b', { dataDir: path.join(b, 'trainer') });
  assert.equal(again.ok, true);
  assert.equal(again.migrated, 0, 'idempotent');
  assert.ok(!again.steps.some((s) => s.cmd === 'migrateResults'));
});

test('migration is skipped when the data dir is not inside the synced repo', async () => {
  const w = world();
  const a = w.clone('a');
  const r = await sync(a, 'mac-a'); // dataDir = DATA_DIR (the real trainer/, outside this temp repo)
  assert.equal(r.ok, true, r.message);
  assert.equal(r.migrated, 0);
  assert.ok(!r.steps.some((s) => s.cmd === 'migrateResults'));
});

test('nothing to do → ok without a commit (ignored, missing and outside paths are skipped)', async () => {
  const w = world();
  const a = w.clone('a');
  writeFile(a, 'trainer/coach/runs/run.log', 'git-ignored\n');
  const r = await sync(a, 'mac-a', { dataPaths: [...DATA, 'trainer/coach/runs', 'trainer/does-not-exist', '../outside', '.'] });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.committed, 0);
  assert.equal(r.pushed, 0);
  assert.match(r.message, /không có gì mới/);
  assert.equal(subject(w.remote, 'main'), 'init');
});

// ── never hang on credentials / network ─────────────────────────────────────

async function fakeRemote(handler: http.RequestListener): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  const sockets = new Set<import('node:net').Socket>();
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/owner/repo.git`,
    close: () =>
      new Promise<void>((r) => {
        for (const s of sockets) s.destroy();
        server.close(() => r());
      }),
  };
}

async function againstFakeRemote(handler: http.RequestListener, extra: Partial<SyncOptions> = {}) {
  const w = world();
  const a = w.clone('a');
  const fake = await fakeRemote(handler);
  try {
    git(a, 'remote', 'set-url', 'origin', fake.url);
    writeFile(a, 'trainer/results/2026/10/2026-10-16_130000_quick.md', '---\nid: x\n---\n');
    const t0 = Date.now();
    const r = await sync(a, 'mac-a', extra);
    return { r, ms: Date.now() - t0, a };
  } finally {
    await fake.close();
  }
}

test('missing credentials fail fast with the Keychain hint (no prompt)', async () => {
  const { r, ms, a } = await againstFakeRemote((_req, res) => {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="GitHub"' });
    res.end('auth required');
  });
  assert.equal(r.ok, false);
  assert.ok(ms < 20_000, `took ${ms} ms`);
  assert.match(r.message, /git pull/);
  assert.match(r.hint ?? '', /Keychain/);
  assert.match(r.hint ?? '', /Personal Access Token/);
  assert.equal(r.committed, 1, 'local commit is made before talking to GitHub');
  assert.equal(subject(a), 'trainer: sync từ mac-a 2026-10-16 10:30');
});

test('403 explains collaborator / token permissions', async () => {
  const { r } = await againstFakeRemote((_req, res) => {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Permission to owner/repo.git denied to other-user.');
  });
  assert.equal(r.ok, false);
  assert.match(r.hint ?? '', /403/);
  assert.match(r.hint ?? '', /collaborator/);
});

test('a hung remote is killed after the step timeout', async () => {
  const { r, ms } = await againstFakeRemote(() => {
    // never answer
  }, { timeoutMs: 1500 });
  assert.equal(r.ok, false);
  assert.ok(ms < 15_000, `took ${ms} ms`);
  assert.match(r.hint ?? '', /quá lâu/);
  const pull = r.steps.find((s) => s.cmd.startsWith('git pull'));
  assert.ok(pull && !pull.ok && /đã dừng/.test(pull.output));
});

// ── preconditions ───────────────────────────────────────────────────────────

test('outside a git repo, without upstream, or detached HEAD → clear message, nothing changed', async () => {
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-nogit-'));
  try {
    const r = await sync(plain, 'mac-a');
    assert.equal(r.ok, false);
    assert.match(r.hint ?? '', /không phải repo git/);
    const st = await syncStatus({ repoDir: plain, dataPaths: DATA });
    assert.equal(st.disabled, true);
    assert.ok(st.error);
  } finally {
    fs.rmSync(plain, { recursive: true, force: true });
  }

  const w = world();
  const a = w.clone('a');
  git(a, 'switch', '-q', '-c', 'feature');
  const r2 = await sync(a, 'mac-a');
  assert.equal(r2.ok, false);
  assert.match(r2.message, /chưa có upstream/);
  assert.match(r2.hint ?? '', /git push -u origin/);
  assert.equal(r2.steps.length, 0, 'stops before git add');

  git(a, 'switch', '-q', '--detach', 'main');
  const r3 = await sync(a, 'mac-a');
  assert.equal(r3.ok, false);
  assert.match(r3.message, /detached HEAD/);
});

test('a test sandbox (TRAINER_HOME outside the repo) never syncs', () => {
  assert.match(syncDisabledReason('/repo', '/tmp/sandbox') ?? '', /TRAINER_HOME/);
  assert.equal(syncDisabledReason('/repo', '/repo/trainer'), undefined);
});

test('error hints and credential redaction', () => {
  assert.match(explainGitError("fatal: could not read Username for 'https://github.com': terminal prompts disabled") ?? '', /Keychain/);
  assert.match(
    explainGitError("remote: Permission to me/repo.git denied to friend.\nfatal: unable to access 'https://github.com/me/repo.git/': The requested URL returned error: 403") ?? '',
    /friend[\s\S]*collaborator/,
  );
  assert.match(explainGitError("fatal: unable to access 'https://github.com/x/': Could not resolve host: github.com") ?? '', /mạng/);
  assert.match(explainGitError('remote: Invalid username or token. Password authentication is not supported for Git operations.') ?? '', /token/i);
  assert.match(explainGitError('', { timedOut: true }) ?? '', /quá lâu/);
  assert.match(explainGitError('Author identity unknown\n*** Please tell me who you are.') ?? '', /user\.email/);
  assert.equal(redact('https://me:ghp_secret@github.com/me/repo.git'), 'https://***@github.com/me/repo.git');
});
