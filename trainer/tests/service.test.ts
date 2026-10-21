// [v5] π `npm run service`: the generated launchd / systemd / Windows files and the restart-looping launcher (with a fake
// server script). Nothing is installed: no launchctl, systemctl or schtasks call. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as svc from '../scripts/service.ts';

const spec = svc.serviceSpec({
  node: '/opt/homebrew/bin/node',
  script: "/Users/me/aws docs/trainer/scripts/service.ts",
  appDir: '/Users/me/aws docs/trainer',
  dataDir: '/Users/me/aws docs/trainer',
  port: 3003,
  log: '/Users/me/aws docs/trainer/.local/service.log',
  home: '/Users/me',
});

test('launchd agent: the launcher at login, again after a crash, log in .local/', () => {
  const plist = svc.servicePlist(spec);
  assert.match(plist, /<key>Label<\/key><string>com\.saa-trainer\.app<\/string>/);
  assert.match(plist, /<string>\/opt\/homebrew\/bin\/node<\/string>\n {4}<string>\/Users\/me\/aws docs\/trainer\/scripts\/service\.ts<\/string>\n {4}<string>run<\/string>/);
  assert.match(plist, /<key>RunAtLoad<\/key><true\/>/);
  assert.match(plist, /<key>KeepAlive<\/key>\n {2}<dict><key>SuccessfulExit<\/key><false\/><\/dict>/, 'restarted after a crash, not after a clean stop');
  assert.match(plist, /<key>WorkingDirectory<\/key><string>\/Users\/me\/aws docs\/trainer<\/string>/);
  assert.match(plist, /<key>PORT<\/key><string>3003<\/string>/);
  assert.ok(!plist.includes('TRAINER_HOME'), 'data in the app folder: no TRAINER_HOME');
  assert.ok(!plist.includes('StartCalendarInterval'));
  assert.match(plist, /<key>StandardOutPath<\/key><string>\/Users\/me\/aws docs\/trainer\/\.local\/service\.log<\/string>/);
  const elsewhere = svc.servicePlist({ ...spec, dataDir: '/data/a&b' });
  assert.match(elsewhere, /<key>TRAINER_HOME<\/key><string>\/data\/a&amp;b<\/string>/, 'escaped XML');
});

test('systemd user unit: quoted paths, restart on failure, enabled for the default target', () => {
  const unit = svc.systemdUnit({ ...spec, dataDir: '/srv/50%' });
  assert.match(unit, /^ExecStart="\/opt\/homebrew\/bin\/node" "\/Users\/me\/aws docs\/trainer\/scripts\/service\.ts" "run"$/m);
  assert.match(unit, /^WorkingDirectory=\/Users\/me\/aws docs\/trainer$/m, 'path settings are not quoted (systemd keeps the quotes)');
  const pct = svc.systemdUnit({ ...spec, appDir: '/srv/100% app', log: '/srv/50%.log' });
  assert.match(pct, /^WorkingDirectory=\/srv\/100%% app$/m);
  assert.match(pct, /^StandardOutput=append:\/srv\/50%%\.log$/m);
  assert.match(pct, /^StandardError=append:\/srv\/50%%\.log$/m);
  assert.match(unit, /^Restart=on-failure$/m);
  assert.match(unit, /^Environment="TRAINER_HOME=\/srv\/50%%"$/m, '% is a systemd specifier');
  assert.match(unit, /^WantedBy=default\.target$/m);
});

test('systemd-analyze verify accepts the unit (when systemd is installed)', { skip: spawnSync('systemd-analyze', ['--version']).status === 0 ? false : 'systemd-analyze not installed' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-unit-'));
  try {
    const app = path.join(dir, 'my app');
    fs.mkdirSync(path.join(app, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(app, 'scripts', 'service.ts'), '');
    const file = path.join(dir, 'saa-trainer.service');
    fs.writeFileSync(file, svc.systemdUnit({ ...spec, node: process.execPath, script: path.join(app, 'scripts', 'service.ts'), appDir: app, dataDir: app, log: path.join(dir, 'service.log') }));
    const r = spawnSync('systemd-analyze', ['verify', '--user', file], { encoding: 'utf8' });
    assert.ok(!/bad-setting|not absolute|Failed to/i.test(r.stderr), r.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Windows: hidden .vbs → .cmd with the log, a logon task', () => {
  const win = svc.serviceSpec({ node: 'C:\\Program Files\\nodejs\\node.exe', script: 'C:\\r\\trainer\\scripts\\service.ts', appDir: 'C:\\r\\trainer', dataDir: 'C:\\r\\trainer', port: 4000, log: 'C:\\r\\trainer\\.local\\50%.log', home: 'C:\\Users\\Me' });
  const files = svc.serviceFiles(win, 'win32');
  assert.deepEqual(files.map((f) => path.win32.basename(f.path)), ['trainer-service.cmd', 'trainer-service.vbs']);
  const cmd = files[0].content;
  assert.match(cmd, /\r\nset "PORT=4000"\r\n/);
  assert.match(cmd, /cd \/d "C:\\r\\trainer"\r\n"C:\\Program Files\\nodejs\\node\.exe" "C:\\r\\trainer\\scripts\\service\.ts" run >> "C:\\r\\trainer\\\.local\\50%%\.log" 2>&1\r\n$/);
  assert.match(files[1].content, /CreateObject\("WScript\.Shell"\)\.Run """.*trainer-service\.cmd""", 0, False/);
  const task = svc.windowsServiceTask(files[1].path);
  assert.deepEqual(task.slice(0, 8), ['/Create', '/F', '/SC', 'ONLOGON', '/RL', 'LIMITED', '/TN', 'SAA-Trainer-App']);
  assert.match(task[9], /^wscript\.exe ".*trainer-service\.vbs"$/);
  assert.equal(svc.serviceFiles(spec, 'darwin')[0].path, '/Users/me/Library/LaunchAgents/com.saa-trainer.app.plist');
  assert.equal(svc.serviceFiles(spec, 'linux')[0].path, '/Users/me/.config/systemd/user/saa-trainer.service');
});

test('stable node path: a PATH symlink to the running binary beats the versioned real path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-node-'));
  try {
    const real = path.join(dir, 'Cellar', 'node', '24.1', 'bin', 'node');
    fs.mkdirSync(path.dirname(real), { recursive: true });
    fs.writeFileSync(real, '');
    fs.mkdirSync(path.join(dir, 'bin'));
    fs.symlinkSync(real, path.join(dir, 'bin', 'node'));
    assert.equal(svc.stableNode(real, [path.join(dir, 'nothing'), path.join(dir, 'bin')].join(path.delimiter)), path.join(dir, 'bin', 'node'));
    assert.equal(svc.stableNode(real, path.join(dir, 'nothing')), real);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('launcher loop: exit 75 → install deps → run again (no browser, launcher env); 0 ends; a busy port is waited for', { skip: process.platform === 'win32' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-loop-'));
  try {
    const entry = path.join(dir, 'server.mjs');
    fs.writeFileSync(
      entry,
      "import fs from 'node:fs';\n" +
        "const f = new URL('./runs.log', import.meta.url);\n" +
        "fs.appendFileSync(f, `run OPEN=${process.env.OPEN} LAUNCHER=${process.env.TRAINER_LAUNCHER} SERVICE=${process.env.TRAINER_SERVICE}\\n`);\n" +
        "process.exit(fs.readFileSync(f, 'utf8').trim().split('\\n').length < 3 ? 75 : 0);\n",
    );
    let deps = 0;
    let busy = 2; // the port answers twice (another instance), then is free
    const logs: string[] = [];
    const code = await svc.launcherLoop({
      node: process.execPath,
      entry,
      cwd: dir,
      env: { PATH: process.env.PATH },
      ensureDeps: () => (deps++, true),
      alreadyServed: async () => busy-- > 0,
      waitMs: 10,
      log: (s) => logs.push(s),
    });
    assert.equal(code, 0);
    const runs = fs.readFileSync(path.join(dir, 'runs.log'), 'utf8').trim().split('\n');
    assert.deepEqual(runs, Array(3).fill('run OPEN=0 LAUNCHER=1 SERVICE=1'));
    assert.equal(deps, 3, 'deps checked before every start');
    assert.equal(logs.filter((l) => /chờ nó tắt/.test(l)).length, 1, 'the wait is logged once');
    assert.equal(logs.filter((l) => /khởi động lại/.test(l)).length, 2);

    // quick restart loops are capped
    fs.writeFileSync(entry, 'process.exit(75)');
    assert.equal(await svc.launcherLoop({ node: process.execPath, entry, cwd: dir, env: {}, maxQuick: 3, log: () => undefined }), 1);
    // failing deps stop the loop before the server runs
    assert.equal(await svc.launcherLoop({ node: process.execPath, entry, cwd: dir, env: {}, ensureDeps: () => false, log: () => undefined }), 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureDeps: npm install only when package-lock.json differs from the stamp start.sh writes', { skip: process.platform === 'win32' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-deps-'));
  try {
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{"v":1}');
    const npm = path.join(dir, 'fake-npm');
    fs.writeFileSync(npm, '#!/bin/sh\necho "$@" >> npm.log\nmkdir -p node_modules\n');
    fs.chmodSync(npm, 0o755);
    const log = console.log;
    console.log = () => undefined;
    try {
      assert.equal(svc.ensureDeps(dir, npm), true);
      assert.equal(fs.readFileSync(path.join(dir, 'npm.log'), 'utf8').trim(), 'install --no-audit --no-fund');
      assert.equal(svc.ensureDeps(dir, npm), true);
      assert.equal(fs.readFileSync(path.join(dir, 'npm.log'), 'utf8').trim().split('\n').length, 1, 'stamp matches: no second install');
      fs.writeFileSync(path.join(dir, 'package-lock.json'), '{"v":2}');
      svc.ensureDeps(dir, npm);
      assert.equal(fs.readFileSync(path.join(dir, 'npm.log'), 'utf8').trim().split('\n').length, 2);
    } finally {
      console.log = log;
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
