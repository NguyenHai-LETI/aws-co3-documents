// [v5] π Runs the trainer in the background, started at login, so it is always there (desktop app via the browser's
// "Cài đặt ứng dụng", phone over LAN, Claude Code status line / MCP) without a Terminal window.
//   macOS   → launchd agent ~/Library/LaunchAgents/com.saa-trainer.app.plist (RunAtLoad, restarted after a crash)
//   Linux   → systemd user unit ~/.config/systemd/user/saa-trainer.service (Restart=on-failure)
//   Windows → Task Scheduler task "SAA-Trainer-App" at logon, running a hidden .vbs → .cmd (Startup folder fallback)
// Usage: npm run service -- install | uninstall | status | run | print
// Every unit runs `node scripts/service.ts run`: the restart-looping launcher (like start.sh): exit code 75 ("restart for
// an update") → npm install when package-lock.json changed → the server again; it waits instead of crash-looping while
// another instance already serves the port (e.g. `npm start` in a terminal). Log: <data>/.local/service.log.
// `print` shows the files and commands `install` would use, without touching the system.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR, PORT, TRAINER_DIR } from '../server/config.ts';
import { launchdPlist } from './schedule.ts';

export const SERVICE_LABEL = 'com.saa-trainer.app';
export const SYSTEMD_UNIT = 'saa-trainer.service';
export const WIN_TASK = 'SAA-Trainer-App';
const RESTART_CODE = 75;

export interface ServiceSpec {
  node: string; // absolute node binary (a stable symlink when one points to the running node)
  script: string; // absolute scripts/service.ts
  appDir: string; // trainer/ (working directory)
  dataDir: string; // TRAINER_HOME when it differs from appDir
  port: number;
  log: string;
  home: string;
  pathEnv: string;
}

/** `node` on PATH that resolves to the running binary (Homebrew / nvm upgrades keep the symlink valid), else execPath. */
export function stableNode(execPath: string = process.execPath, pathEnv: string = process.env.PATH ?? ''): string {
  let real = execPath;
  try {
    real = fs.realpathSync(execPath);
  } catch {
    // keep execPath
  }
  for (const dir of pathEnv.split(path.delimiter)) {
    const cand = path.join(dir, process.platform === 'win32' ? 'node.exe' : 'node');
    try {
      if (dir && fs.realpathSync(cand) === real) return cand;
    } catch {
      // not there
    }
  }
  return execPath;
}

export function serviceSpec(o: Partial<ServiceSpec> = {}): ServiceSpec {
  const node = o.node ?? stableNode();
  const home = o.home ?? os.homedir();
  return {
    node,
    script: o.script ?? path.join(TRAINER_DIR, 'scripts', 'service.ts'),
    appDir: o.appDir ?? TRAINER_DIR,
    dataDir: o.dataDir ?? DATA_DIR,
    port: o.port ?? PORT,
    log: o.log ?? path.join(o.dataDir ?? DATA_DIR, '.local', 'service.log'),
    home,
    pathEnv: o.pathEnv ?? [path.dirname(node), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'].join(':'),
  };
}

function envOf(s: ServiceSpec): Record<string, string> {
  const env: Record<string, string> = { PATH: s.pathEnv, HOME: s.home, PORT: String(s.port) };
  if (path.resolve(s.dataDir) !== path.resolve(s.appDir)) env.TRAINER_HOME = s.dataDir;
  return env;
}

/** macOS launchd agent: at login, again after a crash (not after a clean stop), 10 s between attempts. */
export function servicePlist(s: ServiceSpec): string {
  return launchdPlist({ label: SERVICE_LABEL, args: [s.node, s.script, 'run'], cwd: s.appDir, env: envOf(s), log: s.log, runAtLoad: true, keepAlive: true, throttleSeconds: 10 });
}

/** systemd: quote an ExecStart word (spaces, quotes, backslashes, `%` specifiers, `$` expansion). */
const sdq = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/%/g, '%%').replace(/\$/g, '$$$$')}"`;

/** systemd: a path value (WorkingDirectory=, append:) — unquoted, spaces allowed, `%` specifiers escaped. */
const sdpath = (v: string) => v.replace(/%/g, '%%');

/** Linux systemd user unit (`systemctl --user enable --now`). */
export function systemdUnit(s: ServiceSpec): string {
  const env = Object.entries(envOf(s)).map(([k, v]) => `Environment=${sdq(`${k}=${v}`)}`);
  return [
    '[Unit]',
    'Description=AWS SAA-C03 Trainer (npm run service)',
    'After=network-online.target',
    '',
    '[Service]',
    'Type=simple',
    `WorkingDirectory=${sdpath(s.appDir)}`, // a path setting: never quoted (systemd would read the quotes as part of it)
    `ExecStart=${[s.node, s.script, 'run'].map(sdq).join(' ')}`,
    ...env,
    'Restart=on-failure',
    'RestartSec=10',
    `StandardOutput=append:${sdpath(s.log)}`,
    `StandardError=append:${sdpath(s.log)}`,
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n');
}

const winq = (v: string) => `"${v.replace(/%/g, '%%')}"`;

/** Windows: the .cmd the task runs (env, then the launcher with output into the log). */
export function windowsServiceCmd(s: ServiceSpec): string {
  const env = envOf(s);
  return [
    '@echo off',
    'rem SAA-C03 Trainer chạy nền — tạo bởi "npm run service -- install" (gỡ: npm run service -- uninstall)',
    'chcp 65001 >nul',
    `set "PORT=${env.PORT}"`,
    ...(env.TRAINER_HOME ? [`set "TRAINER_HOME=${env.TRAINER_HOME.replace(/%/g, '%%')}"`] : []),
    `cd /d ${winq(s.appDir)}`,
    `${winq(s.node)} ${winq(s.script)} run >> ${winq(s.log)} 2>&1`,
    '',
  ].join('\r\n');
}

/** Windows: runs the .cmd without a console window. */
export function windowsServiceVbs(cmdFile: string): string {
  return ["' SAA-C03 Trainer: chạy " + cmdFile + ' không mở cửa sổ', `CreateObject("WScript.Shell").Run """${cmdFile.replace(/"/g, '""')}""", 0, False`, ''].join('\r\n');
}

/** `schtasks /Create` at logon for this user. */
export function windowsServiceTask(vbsFile: string): string[] {
  return ['/Create', '/F', '/SC', 'ONLOGON', '/RL', 'LIMITED', '/TN', WIN_TASK, '/TR', `wscript.exe "${vbsFile}"`];
}

export function serviceFiles(s: ServiceSpec, platform: NodeJS.Platform = process.platform): { path: string; content: string }[] {
  if (platform === 'darwin') return [{ path: path.join(s.home, 'Library', 'LaunchAgents', `${SERVICE_LABEL}.plist`), content: servicePlist(s) }];
  if (platform === 'win32') {
    const dir = path.join(s.dataDir, '.local', 'service');
    const cmd = path.join(dir, 'trainer-service.cmd');
    return [
      { path: cmd, content: windowsServiceCmd(s) },
      { path: path.join(dir, 'trainer-service.vbs'), content: windowsServiceVbs(cmd) },
    ];
  }
  return [{ path: path.join(s.home, '.config', 'systemd', 'user', SYSTEMD_UNIT), content: systemdUnit(s) }];
}

// ── the launcher loop (`run`) ──────────────────────────────────────────────

export interface LoopOptions {
  node: string;
  entry: string; // server/index.ts
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** npm install when package-lock.json changed; false = failed (the loop stops). */
  ensureDeps?: () => boolean;
  /** Another process already answers on the port (wait instead of failing with EADDRINUSE). */
  alreadyServed?: () => Promise<boolean>;
  waitMs?: number;
  quickWindowMs?: number; // a run shorter than this that asks for a restart counts as "quick"
  maxQuick?: number;
  log?: (s: string) => void;
}

/** Runs the server until it exits with anything but 75. Resolves with the exit code for the service manager. */
export async function launcherLoop(o: LoopOptions): Promise<number> {
  const log = o.log ?? ((s: string) => console.log(s));
  let quick = 0;
  let stopping = false;
  let child: ReturnType<typeof spawn> | undefined;
  const stop = () => {
    stopping = true;
    child?.kill('SIGTERM');
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  try {
    for (;;) {
      let announced = false;
      while (!stopping && o.alreadyServed && (await o.alreadyServed())) {
        if (!announced) log(`${new Date().toISOString()} · cổng đã có app khác chạy (npm start?) — chờ nó tắt rồi chạy nền`);
        announced = true;
        await new Promise((r) => setTimeout(r, o.waitMs ?? 30_000));
      }
      if (stopping) return 0;
      if (o.ensureDeps && !o.ensureDeps()) return 1;
      const started = Date.now();
      log(`${new Date().toISOString()} · khởi động trainer`);
      const code = await new Promise<number>((resolve) => {
        child = spawn(o.node, [o.entry], { cwd: o.cwd, env: { ...o.env, TRAINER_LAUNCHER: '1', TRAINER_SERVICE: '1', OPEN: '0' }, stdio: 'inherit' });
        child.on('exit', (c, sig) => resolve(c ?? (sig ? 1 : 0)));
        child.on('error', () => resolve(1));
      });
      child = undefined;
      if (stopping) return 0;
      if (code !== RESTART_CODE) {
        log(`${new Date().toISOString()} · trainer dừng (mã ${code})`);
        return code;
      }
      quick = Date.now() - started < (o.quickWindowMs ?? 60_000) ? quick + 1 : 1;
      if (quick > (o.maxQuick ?? 20)) {
        log('✗ Server xin khởi động lại quá nhiều lần liên tiếp — dừng.');
        return 1;
      }
      log(`${new Date().toISOString()} · ↻ khởi động lại để dùng bản mới`);
    }
  } finally {
    process.off('SIGTERM', stop);
    process.off('SIGINT', stop);
  }
}

/** npm install when node_modules is missing or package-lock.json changed since the last install (same stamp as start.sh). */
export function ensureDeps(appDir: string, npm: string = process.env.TRAINER_NPM ?? (process.platform === 'win32' ? 'npm.cmd' : 'npm')): boolean {
  const lock = path.join(appDir, 'package-lock.json');
  const stamp = path.join(appDir, 'node_modules', '.trainer-lock.json');
  const same = (() => {
    try {
      return fs.readFileSync(lock).equals(fs.readFileSync(stamp));
    } catch {
      return false;
    }
  })();
  if (same && fs.existsSync(path.join(appDir, 'node_modules'))) return true;
  console.log('→ Cài thư viện (npm install)…');
  const r = spawnSync(npm, ['install', '--no-audit', '--no-fund'], { cwd: appDir, stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' }, shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error('✗ npm install thất bại — kiểm tra mạng.');
    return false;
  }
  try {
    fs.copyFileSync(lock, stamp);
  } catch {
    // next start installs again
  }
  return true;
}

async function answers(port: number): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/meta`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

// ── install / uninstall / status ───────────────────────────────────────────

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function writeFiles(files: { path: string; content: string }[]) {
  for (const f of files) {
    fs.mkdirSync(path.dirname(f.path), { recursive: true });
    fs.writeFileSync(f.path, f.content);
  }
}

function tail(file: string, n = 12) {
  if (!fs.existsSync(file)) return;
  console.log('--- log gần nhất ---');
  console.log(fs.readFileSync(file, 'utf8').trimEnd().split('\n').slice(-n).join('\n'));
}

async function status(s: ServiceSpec, files: { path: string }[]) {
  const installed = files.every((f) => fs.existsSync(f.path));
  console.log(installed ? `✓ Đã cài chạy nền: ${files.map((f) => f.path).join(', ')}` : '✗ Chưa cài chạy nền. Cài: npm run service -- install');
  if (process.platform === 'darwin') {
    const r = spawnSync('launchctl', ['print', `gui/${process.getuid?.() ?? 501}/${SERVICE_LABEL}`], { encoding: 'utf8' });
    const lines = (r.stdout ?? '').split('\n').filter((l) => /state =|pid =|last exit code/.test(l));
    if (installed) console.log(lines.length ? lines.join('\n') : '  (launchd chưa nạp — chạy lại install)');
  } else if (process.platform === 'win32') {
    const r = spawnSync('schtasks', ['/Query', '/TN', WIN_TASK, '/FO', 'LIST'], { encoding: 'utf8', windowsHide: true });
    if (r.status === 0) console.log(r.stdout.trim());
  } else {
    const r = spawnSync('systemctl', ['--user', 'is-active', SYSTEMD_UNIT], { encoding: 'utf8' });
    if (installed) console.log(`  systemd: ${(r.stdout || r.stderr || '').trim()}`);
  }
  console.log((await answers(s.port)) ? `✓ App đang trả lời: http://localhost:${s.port}` : `✗ Không có app nào trả lời ở cổng ${s.port}`);
  tail(s.log);
}

function install(s: ServiceSpec, files: { path: string; content: string }[]) {
  fs.mkdirSync(path.dirname(s.log), { recursive: true });
  writeFiles(files);
  if (process.platform === 'darwin') {
    const domain = `gui/${process.getuid?.() ?? 501}`;
    spawnSync('launchctl', ['bootout', domain, files[0].path], { stdio: 'ignore' });
    const r = spawnSync('launchctl', ['bootstrap', domain, files[0].path], { encoding: 'utf8' });
    if (r.status !== 0) fail(`launchctl bootstrap thất bại: ${(r.stderr || r.stdout || '').trim()}`);
  } else if (process.platform === 'win32') {
    const r = spawnSync('schtasks', windowsServiceTask(files[1].path), { encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) {
      // creating a logon task can need admin rights: the Startup folder works for this user without them
      const startup = path.join(process.env.APPDATA ?? path.join(s.home, 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'SAA-Trainer.vbs');
      fs.copyFileSync(files[1].path, startup);
      console.log(`  (schtasks: ${(r.stderr || r.stdout || '').trim()} — dùng thư mục Startup thay thế: ${startup})`);
    }
    spawn('wscript.exe', [files[1].path], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } else {
    for (const args of [['--user', 'daemon-reload'], ['--user', 'enable', '--now', SYSTEMD_UNIT]]) {
      const r = spawnSync('systemctl', args, { encoding: 'utf8' });
      if (r.status !== 0) fail(`systemctl ${args.join(' ')} thất bại: ${(r.stderr || '').trim()}`);
    }
    console.log('  (muốn chạy cả khi chưa đăng nhập: loginctl enable-linger $USER)');
  }
  console.log(`✓ Trainer chạy nền, tự mở khi đăng nhập: http://localhost:${s.port} (log: ${s.log})`);
  console.log('  Trong Chrome / Edge: ⋮ → Cài đặt ứng dụng (Install) để mở như app có icon, số câu đến hạn hiện trên icon.');
}

function uninstall(s: ServiceSpec, files: { path: string }[]) {
  if (process.platform === 'darwin') spawnSync('launchctl', ['bootout', `gui/${process.getuid?.() ?? 501}`, files[0].path], { stdio: 'ignore' });
  else if (process.platform === 'win32') {
    spawnSync('schtasks', ['/Delete', '/TN', WIN_TASK, '/F'], { stdio: 'ignore', windowsHide: true });
    fs.rmSync(path.join(process.env.APPDATA ?? path.join(s.home, 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'SAA-Trainer.vbs'), { force: true });
  } else spawnSync('systemctl', ['--user', 'disable', '--now', SYSTEMD_UNIT], { stdio: 'ignore' });
  for (const f of files) fs.rmSync(f.path, { force: true });
  console.log('✓ Đã gỡ chạy nền (app đang chạy nền đã dừng; mở lại bằng npm start khi cần)');
}

export async function main(cmd = 'status'): Promise<void> {
  const s = serviceSpec();
  const files = serviceFiles(s);
  if (cmd === 'run') {
    const code = await launcherLoop({ node: process.execPath, entry: path.join(s.appDir, 'server', 'index.ts'), cwd: s.appDir, env: process.env, ensureDeps: () => ensureDeps(s.appDir), alreadyServed: () => answers(s.port) });
    process.exit(code);
  }
  if (cmd === 'print') {
    for (const f of files) console.log(`── ${f.path}\n${f.content}`);
    if (process.platform === 'win32') console.log(`── schtasks ${windowsServiceTask(files[1].path).join(' ')}`);
    return;
  }
  if (cmd === 'install') return install(s, files);
  if (cmd === 'uninstall') return uninstall(s, files);
  if (cmd === 'status') return status(s, files);
  console.error('Dùng: npm run service -- install | uninstall | status | print | run');
  process.exit(1);
}

const self = fileURLToPath(import.meta.url);
const invoked = process.argv[1]
  ? (() => {
      try {
        return fs.realpathSync(process.argv[1]);
      } catch {
        return path.resolve(process.argv[1]);
      }
    })()
  : '';
if (invoked === self) void main(process.argv[2]);
