// Two-machine sync (server/lib/sync.ts) against throwaway repos: a local bare remote + clones "a" and "b".
// Never touches the real repository. Run: npm run test:e2e
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { appendFile, git, isolateGitConfig, makeGitWorld, writeFile, type GitWorld } from '../helpers/git.ts';
import { TRAINER_ROOT } from '../helpers/paths.ts';
import {
  AUTO_SYNC_BUSY_RETRY_MS,
  AUTO_SYNC_MAX_BACKOFF_MS,
  AUTO_SYNC_MAX_FAILURES,
  AutoSync,
  appDirOf,
  explainGitError,
  hasUnpushed,
  onSyncDone,
  redact,
  runSync,
  syncDisabledReason,
  syncStatus,
  type AutoSyncDeps,
  type SyncOptions,
  type SyncRunResult,
  type SyncSource,
} from '../../server/lib/sync.ts';
import { isCodePath } from '../../server/lib/version.ts';

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

// ── app code received from the other machine (→ SSE `update`, restart banner) ─

test('app code paths: server/, shared/, web/ and the package / build files — not data, scripts or docs', () => {
  for (const p of ['server/lib/sync.ts', 'shared/types.ts', 'web/App.tsx', 'package.json', 'package-lock.json', 'index.html', 'vite.config.ts']) assert.equal(isCodePath(p), true, p);
  for (const p of ['results/2026/10/x.md', 'bank/packs/a.md', 'coach/plans/p.md', 'scripts/sync.ts', 'README.md', 'config.yaml', 'tests/x.test.ts']) assert.equal(isCodePath(p), false, p);
  assert.equal(appDirOf(['trainer/results', 'trainer/coach/', 'trainer\\bank']), 'trainer');
  assert.equal(appDirOf(['results', 'coach']), '');
  assert.equal(appDirOf(['a/results', 'b/coach']), '');
});

test('received app code is reported (codeFiles) — received data, notes and docs, and local edits are not', async () => {
  const w = world();
  const a = w.clone('a');
  const b = w.clone('b');
  writeFile(b, 'trainer/server/new-route.ts', 'export const y = 2;\n');
  writeFile(b, 'trainer/web/App.tsx', 'export {};\n');
  writeFile(b, 'trainer/package-lock.json', '{ "lockfileVersion": 3 }\n');
  writeFile(b, 'trainer/README.md', '# docs\n');
  writeFile(b, 'notes-outside-the-app.md', '# notes\n');
  writeFile(b, 'trainer/results/2026/10/2026-10-16_150000_quick.md', '---\nid: from-b\n---\n');
  git(b, 'add', '-A');
  git(b, 'commit', '-q', '-m', 'code + data from B');
  git(b, 'push', '-q', 'origin', 'main');

  writeFile(a, 'trainer/results/2026/10/2026-10-16_151000_quick.md', '---\nid: from-a\n---\n'); // A's own commit gets rebased
  appendFile(a, 'trainer/server/code.ts', '// local, uncommitted code edit\n');
  const seen: SyncRunResult[] = [];
  const off = onSyncDone((r) => seen.push(r));
  try {
    const r = await sync(a, 'mac-a');
    assert.equal(r.ok, true, r.message);
    assert.equal(r.received, 1);
    assert.deepEqual([...(r.codeFiles ?? [])].sort(), ['trainer/package-lock.json', 'trainer/server/new-route.ts', 'trainer/web/App.tsx']);
    assert.equal(r.source, 'manual');
    assert.equal(seen.length, 1, 'listeners hear every real sync');
    assert.deepEqual(seen[0].codeFiles, r.codeFiles);

    const again = await sync(a, 'mac-a');
    assert.equal(again.codeFiles, undefined, 'nothing received → nothing to restart for');
    const dry = await sync(a, 'mac-a', { dryRun: true });
    assert.equal(dry.ok, true);
    assert.equal(seen.length, 2, 'dry runs are not reported');
  } finally {
    off();
  }
});

// ── push-only (shutdown) ─────────────────────────────────────────────────────

test('push-only (shutdown): commit + push without a pull; when the other machine pushed first, the commit stays local', async () => {
  const w = world();
  const a = w.clone('a');
  const b = w.clone('b');
  writeFile(a, 'trainer/results/2026/10/2026-10-16_140000_quick.md', '---\nid: a1\n---\n');
  const r1 = await sync(a, 'mac-a', { pushOnly: true, source: 'shutdown' });
  assert.equal(r1.ok, true, r1.message);
  assert.equal(r1.pushed, 1);
  assert.equal(r1.source, 'shutdown');
  assert.deepEqual(r1.steps.map((s) => s.cmd.split(' ')[1]), ['add', 'commit', 'push'], 'no pull');

  writeFile(b, 'trainer/results/2026/10/2026-10-16_141000_quick.md', '---\nid: b1\n---\n');
  assert.equal((await sync(b, 'mac-b')).ok, true);
  writeFile(a, 'trainer/results/2026/10/2026-10-16_142000_quick.md', '---\nid: a2\n---\n');
  const r2 = await sync(a, 'mac-a', { pushOnly: true });
  assert.equal(r2.ok, false);
  assert.match(r2.message, /Máy kia vừa đẩy/);
  assert.equal(r2.committed, 1, 'committed locally (a restore point)');
  assert.ok(!r2.steps.some((s) => s.cmd.startsWith('git pull')), 'never pulls');
  assert.equal(fs.existsSync(path.join(a, '.git', 'rebase-merge')), false);
  assert.equal(git(a, 'status', '--porcelain', '--', 'trainer'), '');
  assert.equal(await hasUnpushed({ repoDir: a, dataPaths: DATA }), true, 'the local commit is still to push');

  const r3 = await sync(a, 'mac-a'); // the next normal sync (e.g. the startup pull) brings both together
  assert.equal(r3.ok, true, r3.message);
  assert.equal(r3.received, 1);
  assert.equal(r3.pushed, 1);
  assert.equal(await hasUnpushed({ repoDir: a, dataPaths: DATA }), false);
});

test('status: age of unpushed data (uncommitted file or local commit), stale after 24 h; lastRun / lastOkAt', async () => {
  const w = world();
  const a = w.clone('a');
  assert.equal(await hasUnpushed({ repoDir: a, dataPaths: DATA }), false);
  const old = Date.now() - 30 * 3600_000;
  const f = writeFile(a, 'trainer/results/2026/10/2026-10-14_080000_quick.md', '---\nid: old\n---\n');
  fs.utimesSync(f, old / 1000, old / 1000);
  let st = await syncStatus({ repoDir: a, dataPaths: DATA, fetch: false });
  assert.equal(st.dirtyData, 1);
  assert.equal(st.stale, true);
  assert.ok(Math.abs(Date.parse(st.unpushedSince ?? '') - old) < 2000, st.unpushedSince);
  assert.equal(await hasUnpushed({ repoDir: a, dataPaths: DATA }), true);

  // committed but not pushed (e.g. a sync whose push failed): the commit's date counts
  git(a, 'add', '-A');
  process.env.GIT_COMMITTER_DATE = new Date(Date.now() - 2 * 3600_000).toISOString();
  try {
    git(a, 'commit', '-q', '-m', 'trainer: sync từ mac-a (push failed)');
  } finally {
    delete process.env.GIT_COMMITTER_DATE;
  }
  st = await syncStatus({ repoDir: a, dataPaths: DATA, fetch: false });
  assert.equal(st.dirtyData, 0);
  assert.equal(st.ahead, 1);
  assert.equal(st.stale, false, '2 h old commit: not stale yet');
  assert.ok(st.unpushedSince);

  const r = await sync(a, 'mac-a');
  assert.equal(r.ok, true, r.message);
  st = await syncStatus({ repoDir: a, dataPaths: DATA, fetch: false });
  assert.equal(st.unpushedSince, undefined);
  assert.equal(st.stale, undefined);
  assert.equal(st.lastRun?.ok, true);
  assert.equal(st.lastRun?.source, 'manual');
  assert.ok(st.lastOkAt && Date.now() - Date.parse(st.lastOkAt) < 60_000);
});

// ── auto sync scheduling (fake clock: no real timers, no git) ────────────────

function fakeAuto(opts: { delayMs?: number } = {}) {
  let now = 1_000_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const runs: SyncSource[] = [];
  const env = { mode: 'idle' as 'idle' | 'off', delayMs: opts.delayMs ?? 4 * 60_000, busy: undefined as string | undefined, disabled: undefined as string | undefined };
  let outcome: (source: SyncSource) => SyncRunResult = () => ({ ok: true, message: 'Đã đồng bộ — không có gì mới.', steps: [], host: 'h' });
  const deps: AutoSyncDeps = {
    now: () => now,
    setTimer: (fn, ms) => {
      timers.set(++seq, { at: now + ms, fn });
      return seq;
    },
    clearTimer: (t) => void timers.delete(t as number),
    run: async (source) => {
      runs.push(source);
      return outcome(source);
    },
    settings: () => ({ mode: env.mode, delayMs: env.delayMs }),
    busy: () => env.busy,
    disabled: () => env.disabled,
  };
  const auto = new AutoSync(deps);
  return {
    auto,
    runs,
    env,
    timers,
    setOutcome: (fn: typeof outcome) => (outcome = fn),
    /** Moves the clock and fires the timers that came due (then lets the run settle). */
    async advance(ms: number) {
      now += ms;
      for (const [id, t] of [...timers].sort((x, y) => x[1].at - y[1].at)) {
        if (t.at > now) continue;
        timers.delete(id);
        t.fn();
      }
      await auto.idle();
    },
    due: () => {
      const s = auto.status();
      return s.dueAt ? Date.parse(s.dueAt) - now : undefined;
    },
  };
}

test('auto sync: a submit schedules a quiet sync after the delay; a new test cancels it; the next submit schedules again', async () => {
  const f = fakeAuto();
  f.auto.noteSubmit();
  assert.equal(f.due(), 4 * 60_000);
  assert.equal(f.auto.status().reason, 'submit');
  await f.advance(4 * 60_000 - 1);
  assert.deepEqual(f.runs, []);
  await f.advance(1);
  assert.deepEqual(f.runs, ['auto']);
  assert.equal(f.auto.status().last?.ok, true);
  assert.equal(f.auto.status().last?.source, 'auto');
  assert.equal(f.due(), undefined, 'nothing pending after a success');

  f.auto.noteSubmit();
  await f.advance(60_000);
  f.auto.noteTestBuilt(); // the learner started another test: no sync mid-test
  assert.equal(f.due(), undefined);
  await f.advance(10 * 60_000);
  assert.deepEqual(f.runs, ['auto']);
  f.auto.noteSubmit(); // …until the next submit
  await f.advance(4 * 60_000);
  assert.deepEqual(f.runs, ['auto', 'auto']);
});

test('auto sync: never while busy (coach / another sync) — retried a minute later; off / impossible → nothing', async () => {
  const f = fakeAuto();
  f.env.busy = 'AI Coach đang chạy.';
  f.auto.noteSubmit();
  await f.advance(4 * 60_000);
  assert.deepEqual(f.runs, []);
  assert.equal(f.due(), AUTO_SYNC_BUSY_RETRY_MS);
  f.env.busy = undefined;
  await f.advance(AUTO_SYNC_BUSY_RETRY_MS);
  assert.deepEqual(f.runs, ['auto']);

  f.env.mode = 'off';
  f.auto.noteSubmit();
  assert.equal(f.due(), undefined, 'sync.auto: off');
  assert.equal(f.auto.status().mode, 'off');
  f.env.mode = 'idle';
  f.auto.noteSubmit();
  f.env.mode = 'off'; // config edited before the timer fired
  await f.advance(4 * 60_000);
  assert.deepEqual(f.runs, ['auto']);
  f.env.mode = 'idle';
  f.env.disabled = 'Đồng bộ đang tắt: … TRAINER_HOME';
  f.auto.noteSubmit();
  assert.equal(f.due(), undefined, 'sandbox / not a repo');
  assert.equal(await f.auto.startup(), undefined);
  assert.match(f.auto.status().disabled ?? '', /TRAINER_HOME/);
});

test('auto sync: failures back off exponentially (capped), stop after a few tries; a manual success clears the backoff', async () => {
  const f = fakeAuto({ delayMs: 2 * 60_000 });
  f.setOutcome(() => ({ ok: false, message: 'Đồng bộ thất bại ở bước git pull.', hint: 'Không kết nối được tới GitHub', steps: [], host: 'h' }));
  f.auto.noteSubmit();
  await f.advance(2 * 60_000);
  assert.equal(f.runs.length, 1);
  assert.equal(f.auto.status().failures, 1);
  assert.equal(f.auto.status().reason, 'retry');
  assert.equal(f.due(), 4 * 60_000, '2′ × 2');
  assert.equal(f.auto.status().last?.hint, 'Không kết nối được tới GitHub');
  await f.advance(4 * 60_000);
  assert.equal(f.due(), 8 * 60_000);
  f.auto.noteSubmit(); // a submit during the backoff keeps the longer wait
  assert.equal(f.due(), 8 * 60_000);
  await f.advance(8 * 60_000);
  assert.equal(f.auto.status().failures, 3);
  while (f.auto.status().failures < AUTO_SYNC_MAX_FAILURES) {
    const wait = f.due();
    assert.ok(wait !== undefined && wait <= AUTO_SYNC_MAX_BACKOFF_MS, `capped wait: ${wait}`);
    await f.advance(wait);
  }
  assert.equal(f.runs.length, AUTO_SYNC_MAX_FAILURES);
  assert.equal(f.due(), undefined, 'gives up until the next submit');

  f.setOutcome(() => ({ ok: true, message: 'ok', steps: [], host: 'h' }));
  f.auto.noteSubmit();
  assert.ok((f.due() ?? 0) >= 60 * 60_000 - 1, 'still backing off');
  f.auto.noteExternal({ ok: false });
  assert.ok(f.due() !== undefined, 'a failed manual sync changes nothing');
  f.auto.noteExternal({ ok: true }); // ⇅ Đồng bộ succeeded meanwhile
  assert.equal(f.auto.status().failures, 0);
  assert.ok(f.due() !== undefined, 'a pending submit sync stays');
  f.auto.noteSubmit();
  assert.equal(f.due(), 2 * 60_000, 'back to the normal delay');
});

test('auto sync: the startup pull runs at once and is not cancelled by building a test; when busy it is retried', async () => {
  const f = fakeAuto();
  const r = await f.auto.startup();
  assert.equal(r?.ok, true);
  assert.deepEqual(f.runs, ['startup']);
  assert.equal(f.auto.status().last?.source, 'startup');

  f.env.busy = 'Đang có một lượt đồng bộ khác.';
  assert.equal(await f.auto.startup(), undefined, 'busy: skipped for now');
  assert.equal(f.auto.status().reason, 'startup');
  f.auto.noteTestBuilt(); // the first test of the day still gets the other machine's results
  assert.equal(f.due(), AUTO_SYNC_BUSY_RETRY_MS);
  f.env.busy = undefined;
  await f.advance(AUTO_SYNC_BUSY_RETRY_MS);
  assert.deepEqual(f.runs, ['startup', 'startup']);
});

// ── pre-push gate (.githooks/pre-push + npm run hooks:install), in a throwaway clone ─

test('pre-push hook: code pushes run the check, data / notes / docs pushes pass, a failing check blocks; hooks:install sets core.hooksPath', async () => {
  const w = world();
  const a = w.clone('a');
  const hooks = path.join(a, 'trainer', '.githooks');
  fs.mkdirSync(hooks, { recursive: true });
  fs.copyFileSync(path.join(TRAINER_ROOT, '.githooks', 'pre-push'), path.join(hooks, 'pre-push'));
  fs.chmodSync(path.join(hooks, 'pre-push'), 0o644); // hooks:install makes it executable
  // the exact `npm run hooks:install` command, run in the clone's trainer/ (never in the real repo)
  const install = JSON.parse(fs.readFileSync(path.join(TRAINER_ROOT, 'package.json'), 'utf8')).scripts['hooks:install'] as string;
  const out = execSync(install, { cwd: path.join(a, 'trainer'), encoding: 'utf8' });
  assert.match(out, /core\.hooksPath = trainer\/\.githooks/);
  assert.equal(git(a, 'config', '--get', 'core.hooksPath'), 'trainer/.githooks');
  assert.ok((fs.statSync(path.join(hooks, 'pre-push')).mode & 0o111) !== 0, 'executable');
  git(a, 'add', '-A');
  git(a, 'commit', '-q', '-m', 'add the hook'); // a code-ish file under trainer/ — pushed below with --no-verify
  git(a, 'push', '-q', '--no-verify', 'origin', 'main');

  const marker = path.join(w.root, 'checks.log');
  const ran = () => (fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').trim().split('\n').filter(Boolean).length : 0);
  const pushWith = (cmd: string, files: Record<string, string>) => {
    for (const [rel, content] of Object.entries(files)) writeFile(a, rel, content);
    git(a, 'add', '-A');
    git(a, 'commit', '-q', '-m', `change ${Object.keys(files).join(', ')}`);
    process.env.TRAINER_HOOK_CMD = cmd;
    try {
      git(a, 'push', '-q', 'origin', 'main');
      return true;
    } catch {
      return false;
    } finally {
      delete process.env.TRAINER_HOOK_CMD;
    }
  };
  const check = `echo ran >> "${marker}"`;
  assert.equal(pushWith(check, { 'trainer/results/2026/10/2026-10-16_160000_quick.md': '---\nid: d\n---\n', 'trainer/bank/issues.md': '# Issues\n' }), true);
  assert.equal(ran(), 0, 'data-only push: no check');
  assert.equal(pushWith(check, { 'notes-outside-the-app.md': '# notes\n', 'trainer/README.md': '# readme\n' }), true);
  assert.equal(ran(), 0, 'notes / docs: no check');
  assert.equal(pushWith(check, { 'trainer/server/code.ts': 'export const x = 2;\n' }), true);
  assert.equal(ran(), 1, 'code push: the check ran once');

  const remoteBefore = git(w.remote, 'rev-parse', 'main');
  assert.equal(pushWith('exit 1', { 'trainer/shared/types.ts': 'export type X = 1;\n' }), false, 'a failing check blocks the push');
  assert.equal(git(w.remote, 'rev-parse', 'main'), remoteBefore, 'nothing reached the remote');
  git(a, 'push', '-q', '--no-verify', 'origin', 'main'); // the documented escape hatch
  assert.equal(git(w.remote, 'rev-parse', 'main'), git(a, 'rev-parse', 'HEAD'));
});
