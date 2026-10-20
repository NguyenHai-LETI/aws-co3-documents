// Server lifecycle (server/index.ts): the SSE `data` event follows every data version (config.yaml, personal FSRS
// parameters, …) and the shutdown signals never lose the debounced coach snapshot. v4 [δ]: code updates (SSE `hello` /
// `update`, restart with exit code 75, the start.sh loop) and the quiet auto sync (startup pull before the sealed forms
// are prepared, push after a submit, none mid-test, push at shutdown) — git worlds are throwaway sandboxes. Run:
// npm run test:e2e (Started with pipes, like CI: no terminal — the "terminal closed" SIGHUP path is checked by hand.)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { apiClient, freePort, makeSandbox, startServer, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { buildTest, takeTest } from '../helpers/learner.ts';
import { configureRepo, git } from '../helpers/git.ts';
import { TRAINER_ROOT } from '../helpers/paths.ts';

const T = { timeout: 120_000 };
const sandboxes: Sandbox[] = [];
const servers: ServerHandle[] = [];
after(async () => {
  await Promise.all(servers.map((s) => s.stop()));
  for (const s of sandboxes) s.cleanup();
});

async function boot() {
  const sb = makeSandbox();
  sandboxes.push(sb);
  const srv = await startServer({ home: sb.home });
  servers.push(srv);
  return { sb, srv, api: apiClient(srv.base) };
}

const exited = (srv: ServerHandle) =>
  new Promise<number | null>((resolve) => {
    if (srv.proc.exitCode !== null) return resolve(srv.proc.exitCode);
    srv.proc.once('exit', (code) => resolve(code));
  });

/** SSE client collecting `data` events. */
function listen(base: string) {
  const events: Record<string, string>[] = [];
  const req = http.get(`${base}/api/events`, (res) => {
    let buf = '';
    res.setEncoding('utf8');
    res.on('data', (chunk: string) => {
      buf += chunk;
      let i: number;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (/^event: data$/m.test(block)) events.push(JSON.parse(/^data: (.*)$/m.exec(block)![1]));
      }
    });
  });
  req.on('error', () => undefined);
  return { events, close: () => req.destroy() };
}

async function waitFor<X>(fn: () => X | undefined, ms: number, what: string): Promise<X> {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v !== undefined) return v;
    if (Date.now() > end) throw new Error(`timeout: ${what}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

test('SSE `data` follows config.yaml and the personal FSRS parameters (and carries the day)', T, async () => {
  const { sb, srv } = await boot();
  const sse = listen(srv.base);
  try {
    await new Promise((r) => setTimeout(r, 3500)); // the poller records the current versions once a client is connected
    const cfgFile = path.join(sb.home, 'config.yaml');
    fs.appendFileSync(cfgFile, '\n# touched by lifecycle.test.ts\n');
    const a = await waitFor(() => sse.events.at(-1), 8000, 'data event after a config.yaml edit');
    for (const k of ['bank', 'results', 'plans', 'params', 'config', 'day']) assert.ok(k in a, `versions carry ${k}: ${JSON.stringify(a)}`);
    assert.match(a.day, /^\d{4}-\d{2}-\d{2}$/);
    const n = sse.events.length;
    fs.writeFileSync(path.join(sb.home, 'results', 'fsrs-params.json'), '');
    const b = await waitFor(() => (sse.events.length > n ? sse.events.at(-1) : undefined), 8000, 'data event after fsrs-params.json appeared');
    assert.notEqual(b.params, a.params);
    assert.equal(b.config, a.config);
  } finally {
    sse.close();
  }
});

test('SIGTERM inside the snapshot debounce: the snapshot is written before the process exits', T, async () => {
  const { sb, srv, api } = await boot();
  const snap = path.join(sb.home, 'coach', 'snapshot.md');
  await takeTest(api, { mode: 'quick' });
  const pending = !fs.existsSync(snap); // debounced: not written by the request itself
  srv.proc.kill('SIGTERM');
  assert.equal(await exited(srv), 0);
  assert.ok(fs.existsSync(snap), 'flushed on shutdown');
  if (!pending) console.log('# note: the snapshot was already written before the signal — flush not exercised');
});

test('SIGHUP without a terminal (nohup / service): snapshot written, server keeps serving; double SIGINT exits once', T, async () => {
  const { sb, srv, api } = await boot();
  const snap = path.join(sb.home, 'coach', 'snapshot.md');
  await takeTest(api, { mode: 'quick' });
  srv.proc.kill('SIGHUP');
  await waitFor(() => (fs.existsSync(snap) ? true : undefined), 1500, 'snapshot written on SIGHUP (before the 3 s debounce)');
  assert.equal((await api.get('/api/meta')).status, 200, 'still serving');
  srv.proc.kill('SIGINT');
  srv.proc.kill('SIGINT');
  assert.equal(await exited(srv), 0);
  assert.ok(!/failed/i.test(srv.logs()), srv.logs());
});

// ── [δ] code updates, restart, auto sync ──────────────────────────────────────

/** SSE client collecting every named event: { event, data }. */
function listenAll(base: string) {
  const events: { event: string; data: any }[] = [];
  const req = http.get(`${base}/api/events`, (res) => {
    let buf = '';
    res.setEncoding('utf8');
    res.on('data', (chunk: string) => {
      buf += chunk;
      let i: number;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const ev = /^event: (.+)$/m.exec(block)?.[1];
        const data = /^data: (.*)$/m.exec(block)?.[1];
        if (ev && data) events.push({ event: ev, data: JSON.parse(data) });
      }
    });
  });
  req.on('error', () => undefined);
  return { events, of: (name: string) => events.filter((e) => e.event === name).map((e) => e.data), close: () => req.destroy() };
}

/** A git sandbox (data inside a throwaway repo with a bare remote) + a second machine cloned from that remote. */
function gitSandbox(configEdit?: (text: string) => string) {
  const sb = makeSandbox({ git: true });
  sandboxes.push(sb);
  if (configEdit) {
    const cfg = path.join(sb.home, 'config.yaml');
    fs.writeFileSync(cfg, configEdit(fs.readFileSync(cfg, 'utf8')));
    git(sb.repo!, 'commit', '-q', '-am', 'sandbox config');
    git(sb.repo!, 'push', '-q', 'origin', 'main');
  }
  const other = path.join(sb.root, 'other-machine');
  git(sb.root, 'clone', '-q', sb.remote!, other);
  configureRepo(other, 'other');
  return { sb, other };
}

function pushFrom(dir: string, files: Record<string, string>, message: string) {
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', message);
  git(dir, 'push', '-q', 'origin', 'main');
}

test('code update: SSE hello carries the frozen codeVersion; a sync receiving app code → SSE `update` + GET /api/update; restart needs the launcher', T, async () => {
  const { sb, other } = gitSandbox();
  const srv = await startServer({ home: sb.home, repo: sb.repo });
  servers.push(srv);
  const api = apiClient(srv.base);
  const meta = (await api.get('/api/meta')).body;
  assert.match(meta.codeVersion, /^[0-9a-f]{12}$/, 'codeVersion in /api/meta');
  assert.equal(meta.launcher, false);
  const sse = listenAll(srv.base);
  try {
    const hello = await waitFor(() => sse.of('hello')[0], 8000, 'hello event on connect');
    assert.equal(hello.codeVersion, meta.codeVersion);
    assert.equal(hello.update, undefined, 'no update yet');

    pushFrom(other, { 'trainer/server/new-feature.ts': 'export const feature = 1;\n', 'trainer/package-lock.json': '{ "lockfileVersion": 3 }\n', 'notes-outside-the-app.md': '# notes\n' }, 'code from the other machine');
    const r = await api.post('/api/sync', {});
    assert.equal(r.body.ok, true, r.body.message);
    assert.deepEqual([...r.body.codeFiles].sort(), ['trainer/package-lock.json', 'trainer/server/new-feature.ts']);
    const upd = await waitFor(() => sse.of('update')[0], 8000, 'SSE update');
    assert.deepEqual([...upd.update.files].sort(), ['trainer/package-lock.json', 'trainer/server/new-feature.ts']);
    assert.equal(upd.update.lockChanged, true);
    assert.equal(upd.codeVersion, meta.codeVersion, 'the running process keeps its version');
    const s = await waitFor(() => sse.of('sync').find((x) => x.source === 'manual'), 8000, 'SSE sync');
    assert.equal(s.ok, true);
    assert.equal(s.received, 1);

    const st = (await api.get('/api/update')).body;
    assert.equal(st.codeVersion, meta.codeVersion);
    assert.equal(st.launcher, false);
    assert.equal(st.watch, false);
    assert.ok(st.update.at);
    const restart = await api.post('/api/restart', {});
    assert.equal(restart.status, 409);
    assert.match(restart.body.error, /npm start/);
    assert.equal((await api.get('/api/meta')).status, 200, 'still running');
  } finally {
    sse.close();
  }
});

test('restart: started by a launcher (TRAINER_LAUNCHER=1) → POST /api/restart answers, then the process exits with code 75', T, async () => {
  const sb = makeSandbox();
  sandboxes.push(sb);
  const srv = await startServer({ home: sb.home, env: { TRAINER_LAUNCHER: '1' } });
  servers.push(srv);
  const api = apiClient(srv.base);
  assert.equal((await api.get('/api/meta')).body.launcher, true);
  assert.equal((await api.get('/api/update')).body.launcher, true);
  const r = await api.post('/api/restart', {});
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.restarting, true);
  assert.equal(await exited(srv), 75, 'the launcher runs the server again on 75');
  const marker = path.join(sb.home, '.cache', 'restart.json');
  assert.ok(fs.existsSync(marker), 'state handed to the next process (LAN access on/off)');
  assert.equal(JSON.parse(fs.readFileSync(marker, 'utf8')).lan, false);
  const next = await startServer({ home: sb.home }); // what the launcher does next
  servers.push(next);
  assert.equal(fs.existsSync(marker), false, 'consumed at startup');
});

test('start.sh: exit code 75 → npm install when package-lock.json changed → the server runs again (no second browser tab); 0 ends', T, async () => {
  // a copy of the launcher next to a fake server, in a temp dir (never the real trainer/)
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-launcher-')));
  sandboxes.push({ root, home: root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) });
  fs.copyFileSync(path.join(TRAINER_ROOT, 'start.sh'), path.join(root, 'start.sh'));
  fs.mkdirSync(path.join(root, 'server'));
  fs.mkdirSync(path.join(root, 'node_modules'));
  fs.mkdirSync(path.join(root, 'bin'));
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{"v":1}\n');
  fs.writeFileSync(path.join(root, 'node_modules', '.trainer-lock.json'), '{"v":1}\n'); // installed: no npm at the first start
  // fake server: 1st run = a sync changed the lock, then "restart me" (75); 2nd run = Ctrl+C (0)
  fs.writeFileSync(
    path.join(root, 'server', 'index.ts'),
    [
      "import fs from 'node:fs';",
      "const n = fs.existsSync('runs.log') ? fs.readFileSync('runs.log', 'utf8').split('\\n').filter(Boolean).length : 0;",
      "fs.appendFileSync('runs.log', `run OPEN=${process.env.OPEN} LAUNCHER=${process.env.TRAINER_LAUNCHER} args=${process.argv.slice(2).join(',')}\\n`);",
      "if (n === 0) { fs.writeFileSync('package-lock.json', '{\"v\":2}\\n'); process.exit(75); }",
      'process.exit(0);',
    ].join('\n'),
  );
  fs.writeFileSync(path.join(root, 'bin', 'npm'), `#!/bin/sh\necho "npm $*" >> "${path.join(root, 'npm.log')}"\n`, { mode: 0o755 });
  const port = await freePort(); // nothing listens there → "not running yet"
  const code = await new Promise<number | null>((resolve) => {
    const p = spawn('bash', [path.join(root, 'start.sh'), '--lan'], {
      cwd: root,
      env: { ...process.env, PORT: String(port), TRAINER_NPM: path.join(root, 'bin', 'npm'), TRAINER_PAUSE: '', LAN: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    p.stdout.on('data', (b) => (out += b));
    p.stderr.on('data', (b) => (out += b));
    p.on('exit', (c) => {
      if (c !== 0) console.log(out);
      resolve(c);
    });
  });
  assert.equal(code, 0);
  const runs = fs.readFileSync(path.join(root, 'runs.log'), 'utf8').trim().split('\n');
  assert.deepEqual(runs, ['run OPEN=1 LAUNCHER=1 args=--lan', 'run OPEN=0 LAUNCHER=1 args=--lan']);
  assert.deepEqual(fs.readFileSync(path.join(root, 'npm.log'), 'utf8').trim().split('\n'), ['npm install --no-audit --no-fund'], 'installed once, after the lock changed');
  assert.equal(fs.readFileSync(path.join(root, 'node_modules', '.trainer-lock.json'), 'utf8'), '{"v":2}\n', 'install stamp updated');
});

test('auto sync (sync.auto: idle): startup pull BEFORE the sealed forms are prepared, quiet push after a submit, none mid-test, push at shutdown', T, async () => {
  const { sb, other } = gitSandbox((t) => t.replace(/^(\s+auto:\s*)off\b/m, '$1idle').replace(/^(\s+auto_delay_minutes:\s*)[\d.]+/m, '$10.03').replace(/^(\s+sealed_forms:\s*)\d+/m, '$12'));
  // the other machine created (and pushed) the sealed forms first: this machine must adopt them, not make its own
  const bank = fs.readdirSync(path.join(sb.home, 'bank', 'packs', 'imported')).length;
  assert.ok(bank > 0);
  const sealed = [
    '---',
    'kind: sealed',
    'size: 3',
    'forms:',
    '  - id: S1',
    '    status: sealed',
    '    ids: [ 01-v1-01, 01-v1-02, 01-v1-03 ]',
    '  - id: S2',
    '    status: sealed',
    '    ids: [ 04-v1-01, 04-v1-02, 04-v1-03 ]',
    '---',
    '',
    '# 🔒 Đề niêm phong (từ máy kia)',
    '',
  ].join('\n');
  pushFrom(other, { 'trainer/results/sealed.md': sealed }, 'trainer: sync từ other (sealed forms)');
  const sealedFile = path.join(sb.home, 'results', 'sealed.md');
  assert.equal(fs.existsSync(sealedFile), false);

  const srv = await startServer({ home: sb.home, repo: sb.repo });
  servers.push(srv);
  const api = apiClient(srv.base);
  assert.equal(fs.readFileSync(sealedFile, 'utf8'), sealed, 'pulled before ensureSealed — no forms of its own, no conflict');
  const st = (await api.get('/api/sync/status?fetch=0')).body;
  assert.equal(st.auto.mode, 'idle');
  assert.equal(st.auto.last?.source, 'startup');
  assert.equal(st.auto.last?.ok, true, st.auto.last?.message);
  assert.equal(git(sb.repo!, 'status', '--porcelain', '--', 'trainer/results'), '');

  const remoteHead = () => git(sb.remote!, 'rev-parse', 'main');
  const before = remoteHead();
  const first = await takeTest(api, { mode: 'quick' });
  const pushed = await waitFor(() => (remoteHead() !== before ? true : undefined), 20_000, 'quiet sync ~2 s after the submit');
  assert.ok(pushed);
  assert.match(git(sb.remote!, 'show', '--name-only', '--format=%s', 'main'), new RegExp(first.attempt.file.replace(/^results\//, 'trainer/results/').replace(/[.]/g, '\\.')));
  const auto = (await api.get('/api/sync/status?fetch=0')).body.auto;
  assert.equal(auto.last.source, 'auto');
  assert.equal(auto.last.ok, true);
  assert.equal(auto.failures, 0);

  const second = await takeTest(api, { mode: 'quick' });
  await buildTest(api, { mode: 'quick' }); // the learner went straight into the next test
  const afterSecond = remoteHead();
  await new Promise((r) => setTimeout(r, 4000)); // > auto_delay (1.8 s)
  assert.equal(remoteHead(), afterSecond, 'no sync while a test is in progress');
  assert.equal((await api.get('/api/sync/status?fetch=0')).body.auto.dueAt, undefined);

  srv.proc.kill('SIGTERM');
  assert.equal(await exited(srv), 0);
  assert.notEqual(remoteHead(), afterSecond, 'pushed at shutdown');
  assert.match(git(sb.remote!, 'show', '--name-only', '--format=%s', 'main'), new RegExp(second.attempt.file.replace(/^results\//, 'trainer/results/').replace(/[.]/g, '\\.')));
  assert.equal(git(sb.repo!, 'status', '--porcelain', '--', 'trainer/results'), '', 'nothing left behind');
});
