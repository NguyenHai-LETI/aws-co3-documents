// Runs the AI coach automatically a few times a day (times: trainer/config.yaml → coach.schedule).
//   macOS   → launchd agent ~/Library/LaunchAgents/com.saa-trainer.coach.plist (log: coach/runs/launchd.log)
//   Linux   → a marked block in the user's crontab                              (log: coach/runs/schedule.log)
//   Windows → Task Scheduler, one daily task per time "SAA-Trainer-Coach-HHMM"  (log: coach/runs/schedule.log)
// Usage: npm run schedule -- install | status | run | uninstall
// Each run = `node trainer/scripts/coach-run.ts --trigger schedule` (host check, daily cap, skip/ENRICH when idle).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_DIR, RUNS_DIR, TRAINER_DIR, loadConfig } from '../server/config.ts';

export const LABEL = 'com.saa-trainer.coach';
export const CRON_BEGIN = '# >>> saa-trainer coach (npm run schedule) >>>';
export const CRON_END = '# <<< saa-trainer coach <<<';
export const WIN_PREFIX = 'SAA-Trainer-Coach';

export interface ScheduleTime {
  h: number;
  m: number;
  hhmm: string; // "08:30"
}

/** "8:30" / "08:30" → sorted unique times; anything else is reported as invalid. */
export function parseTimes(list: unknown): { times: ScheduleTime[]; invalid: string[] } {
  const times = new Map<string, ScheduleTime>();
  const invalid: string[] = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})$/);
    const h = m ? Number(m[1]) : -1;
    const min = m ? Number(m[2]) : -1;
    if (!m || h > 23 || min > 59) {
      invalid.push(String(raw));
      continue;
    }
    const hhmm = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    times.set(hhmm, { h, m: min, hhmm });
  }
  return { times: [...times.values()].sort((a, b) => a.hhmm.localeCompare(b.hhmm)), invalid };
}

export const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface JobSpec {
  node: string; // absolute node binary
  script: string; // absolute path of scripts/coach-run.ts
  repo: string; // working directory (repo root)
  log: string;
  times: ScheduleTime[];
  home?: string;
}

/** A launchd agent ([v5] shared by the coach schedule and `npm run service`). */
export interface LaunchdJob {
  label: string;
  args: string[]; // ProgramArguments (absolute program first)
  cwd: string;
  env: Record<string, string>;
  log: string; // stdout + stderr
  calendar?: ScheduleTime[]; // StartCalendarInterval
  runAtLoad?: boolean; // start at login / when loaded
  keepAlive?: boolean; // run again when it exits with an error (not after a clean exit)
  throttleSeconds?: number;
}

export function launchdPlist(j: LaunchdJob): string {
  const args = j.args.map((a) => `\n    <string>${xml(a)}</string>`).join('');
  const env = Object.entries(j.env)
    .map(([k, v]) => `\n    <key>${xml(k)}</key><string>${xml(v)}</string>`)
    .join('');
  const cal = j.calendar
    ? `\n  <key>StartCalendarInterval</key>\n  <array>${j.calendar.map((t) => `\n      <dict><key>Hour</key><integer>${t.h}</integer><key>Minute</key><integer>${t.m}</integer></dict>`).join('')}\n  </array>`
    : '';
  const life =
    (j.runAtLoad ? '\n  <key>RunAtLoad</key><true/>' : '') +
    (j.keepAlive ? '\n  <key>KeepAlive</key>\n  <dict><key>SuccessfulExit</key><false/></dict>' : '') +
    (j.throttleSeconds ? `\n  <key>ThrottleInterval</key><integer>${j.throttleSeconds}</integer>` : '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${xml(j.label)}</string>
  <key>ProgramArguments</key>
  <array>${args}
  </array>
  <key>WorkingDirectory</key><string>${xml(j.cwd)}</string>
  <key>EnvironmentVariables</key>
  <dict>${env}
  </dict>${cal}${life}
  <key>StandardOutPath</key><string>${xml(j.log)}</string>
  <key>StandardErrorPath</key><string>${xml(j.log)}</string>
</dict>
</plist>
`;
}

/** launchd agent — same content as the former scripts/schedule.sh. */
export function plistXml(o: JobSpec & { label?: string; home: string }): string {
  return launchdPlist({
    label: o.label ?? LABEL,
    args: [o.node, o.script, '--trigger', 'schedule'],
    cwd: o.repo,
    env: { PATH: `${path.posix.dirname(o.node)}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`, HOME: o.home },
    log: o.log,
    calendar: o.times,
  });
}

/** POSIX single-quoting, with `%` escaped for cron (cron turns an unescaped % into a newline). */
export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`.replace(/%/g, '\\%');

/** The crontab block (between marker lines) for Linux. */
export function cronBlock(o: JobSpec): string {
  const pathEnv = `${path.posix.dirname(o.node)}:/usr/local/bin:/usr/bin:/bin`;
  const lines = o.times.map(
    (t) => `${t.m} ${t.h} * * * cd ${shq(o.repo)} && PATH=${shq(pathEnv)} ${shq(o.node)} ${shq(o.script)} --trigger schedule >> ${shq(o.log)} 2>&1`,
  );
  return [CRON_BEGIN, '# AI Coach SAA-C03 — giờ chạy lấy từ trainer/config.yaml (sửa rồi chạy lại: npm run schedule -- install)', ...lines, CRON_END].join('\n');
}

/** Replaces (or with `block = null` removes) our marked block in a crontab text; other lines are kept as is. */
export function mergeCrontab(existing: string, block: string | null): string {
  const out: string[] = [];
  let inside = false;
  for (const line of existing.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.trim() === CRON_BEGIN) {
      inside = true;
      continue;
    }
    if (inside) {
      if (line.trim() === CRON_END) inside = false;
      continue;
    }
    out.push(line);
  }
  while (out.length && !out[out.length - 1].trim()) out.pop();
  if (block) out.push(...(out.length ? [''] : []), block);
  return out.length ? out.join('\n') + '\n' : '';
}

/** Batch wrapper the Windows tasks run (keeps /TR short and redirects output to the log). */
export function windowsWrapper(o: Omit<JobSpec, 'times'>): string {
  const q = (s: string) => `"${s.replace(/%/g, '%%')}"`;
  return [
    '@echo off',
    'rem AI Coach SAA-C03 — tạo bởi "npm run schedule -- install" (giờ chạy: trainer/config.yaml → coach.schedule)',
    'chcp 65001 >nul',
    `cd /d ${q(o.repo)}`,
    `${q(o.node)} ${q(o.script)} --trigger schedule >> ${q(o.log)} 2>&1`,
    '',
  ].join('\r\n');
}

/** One `schtasks /Create` per time. */
export function windowsTasks(wrapper: string, times: ScheduleTime[]): { name: string; args: string[] }[] {
  return times.map((t) => {
    const name = `${WIN_PREFIX}-${t.hhmm.replace(':', '')}`;
    return { name, args: ['/Create', '/F', '/SC', 'DAILY', '/ST', t.hhmm, '/TN', name, '/TR', `"${wrapper}"`] };
  });
}

/** Rows of `schtasks /Query /FO CSV /NH` that belong to us. */
export function parseSchtasksCsv(text: string): { name: string; next: string; status: string }[] {
  const rows: { name: string; next: string; status: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cells = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"'));
    if (cells.length < 2) continue;
    const name = cells[0].replace(/^\\/, '');
    if (name.startsWith(WIN_PREFIX) && !rows.some((r) => r.name === name)) rows.push({ name, next: cells[1] ?? '', status: cells[2] ?? '' });
  }
  return rows;
}

// ── side effects ────────────────────────────────────────────────────────────

function tail(file: string, n = 15): void {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').trimEnd().split('\n');
  console.log('--- log gần nhất ---');
  console.log(lines.slice(-n).join('\n'));
}

function hostNote(): void {
  const hosts = (loadConfig().coach.hosts ?? []).map((h) => String(h).trim().toLowerCase()).filter(Boolean);
  const h = os.hostname().toLowerCase();
  if (hosts.length && !hosts.some((x) => x === h || x.split('.')[0] === h.split('.')[0])) {
    console.log(`⚠️  Máy này (${os.hostname()}) không nằm trong coach.hosts [${hosts.join(', ')}] — các lượt theo lịch sẽ tự bỏ qua.`);
  }
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function mac(cmd: string, spec: JobSpec): void {
  const plist = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
  const domain = `gui/${process.getuid?.() ?? 501}`;
  const timesText = spec.times.map((t) => t.hhmm).join(' ');
  if (cmd === 'install') {
    if (!spec.times.length) fail('coach.schedule trong trainer/config.yaml chưa có giờ hợp lệ (vd ["08:30", "21:00"])');
    fs.mkdirSync(path.dirname(plist), { recursive: true });
    fs.mkdirSync(path.dirname(spec.log), { recursive: true });
    fs.writeFileSync(plist, plistXml({ ...spec, home: os.homedir() }));
    spawnSync('launchctl', ['bootout', domain, plist], { stdio: 'ignore' });
    const r = spawnSync('launchctl', ['bootstrap', domain, plist], { encoding: 'utf8' });
    if (r.status !== 0) fail(`launchctl bootstrap thất bại: ${(r.stderr || r.stdout || '').trim()}`);
    console.log(`✓ Đã cài lịch AI Coach: ${timesText} (sửa giờ ở trainer/config.yaml rồi chạy lại install)`);
    console.log(`  plist: ${plist}`);
    console.log(`  log:   ${spec.log}`);
    hostNote();
  } else if (cmd === 'uninstall') {
    spawnSync('launchctl', ['bootout', domain, plist], { stdio: 'ignore' });
    fs.rmSync(plist, { force: true });
    console.log('✓ Đã gỡ lịch AI Coach');
  } else if (cmd === 'run') {
    const r = spawnSync('launchctl', ['kickstart', '-k', `${domain}/${LABEL}`], { encoding: 'utf8' });
    if (r.status !== 0) fail(`Chưa cài lịch hoặc launchd chưa nạp job (${(r.stderr || '').trim()}) — chạy: npm run schedule -- install`);
    console.log(`▶ Đã kích hoạt — xem log: tail -f ${spec.log}`);
  } else {
    if (!fs.existsSync(plist)) {
      console.log('✗ Chưa cài lịch. Chạy: npm run schedule -- install');
      return;
    }
    console.log(`✓ Lịch đã cài (${plist}) — giờ chạy theo config: ${timesText}`);
    const r = spawnSync('launchctl', ['print', `${domain}/${LABEL}`], { encoding: 'utf8' });
    const info = (r.stdout ?? '').split('\n').filter((l) => /state =|last exit code|runs =/.test(l));
    console.log(info.length ? info.join('\n') : '  (launchd chưa nạp job — chạy lại install)');
    hostNote();
    tail(spec.log);
  }
}

function linux(cmd: string, spec: JobSpec): void {
  const read = () => {
    const r = spawnSync('crontab', ['-l'], { encoding: 'utf8' });
    if (r.error) fail(`Không chạy được crontab (${r.error.message}) — cài cron hoặc tự thêm dòng lịch`);
    return r.status === 0 ? r.stdout : ''; // "no crontab for <user>" → empty
  };
  const write = (text: string) => {
    const r = spawnSync('crontab', ['-'], { input: text, encoding: 'utf8' });
    if (r.status !== 0) fail(`crontab - thất bại: ${(r.stderr || '').trim()}`);
  };
  if (cmd === 'install') {
    if (!spec.times.length) fail('coach.schedule trong trainer/config.yaml chưa có giờ hợp lệ');
    fs.mkdirSync(path.dirname(spec.log), { recursive: true });
    write(mergeCrontab(read(), cronBlock(spec)));
    console.log(`✓ Đã cài lịch AI Coach vào crontab: ${spec.times.map((t) => t.hhmm).join(' ')} (sửa giờ ở trainer/config.yaml rồi chạy lại install)`);
    console.log(`  log: ${spec.log}`);
    hostNote();
  } else if (cmd === 'uninstall') {
    write(mergeCrontab(read(), null));
    console.log('✓ Đã gỡ lịch AI Coach khỏi crontab');
  } else if (cmd === 'run') {
    fs.mkdirSync(path.dirname(spec.log), { recursive: true });
    const fd = fs.openSync(spec.log, 'a');
    spawn(spec.node, [spec.script, '--trigger', 'schedule'], { cwd: spec.repo, detached: true, stdio: ['ignore', fd, fd] }).unref();
    console.log(`▶ Đã chạy nền — xem log: tail -f ${spec.log}`);
  } else {
    const text = read();
    const start = text.indexOf(CRON_BEGIN);
    if (start < 0) {
      console.log('✗ Chưa cài lịch. Chạy: npm run schedule -- install');
      return;
    }
    const end = text.indexOf(CRON_END, start);
    console.log('✓ Lịch trong crontab:');
    console.log(text.slice(start, end < 0 ? undefined : end + CRON_END.length));
    hostNote();
    tail(spec.log);
  }
}

function windows(cmd: string, spec: JobSpec): void {
  const wrapper = path.join(path.dirname(spec.log), 'coach-schedule.cmd');
  const list = () => parseSchtasksCsv(spawnSync('schtasks', ['/Query', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true }).stdout ?? '');
  const schtasks = (args: string[]) => spawnSync('schtasks', args, { encoding: 'utf8', windowsHide: true });
  if (cmd === 'install') {
    if (!spec.times.length) fail('coach.schedule trong trainer/config.yaml chưa có giờ hợp lệ');
    fs.mkdirSync(path.dirname(spec.log), { recursive: true });
    fs.writeFileSync(wrapper, windowsWrapper(spec));
    for (const t of list()) schtasks(['/Delete', '/TN', t.name, '/F']);
    for (const t of windowsTasks(wrapper, spec.times)) {
      const r = schtasks(t.args);
      if (r.status !== 0) fail(`schtasks /Create ${t.name} thất bại: ${(r.stderr || r.stdout || '').trim()}`);
    }
    console.log(`✓ Đã tạo ${spec.times.length} tác vụ Task Scheduler (${WIN_PREFIX}-HHMM): ${spec.times.map((t) => t.hhmm).join(' ')}`);
    console.log(`  lệnh: ${wrapper}`);
    console.log(`  log:  ${spec.log}`);
    console.log('  (máy phải bật và bạn đang đăng nhập Windows vào giờ chạy)');
    hostNote();
  } else if (cmd === 'uninstall') {
    const tasks = list();
    for (const t of tasks) schtasks(['/Delete', '/TN', t.name, '/F']);
    fs.rmSync(wrapper, { force: true });
    console.log(`✓ Đã gỡ ${tasks.length} tác vụ AI Coach`);
  } else if (cmd === 'run') {
    const first = list()[0];
    if (!first) fail('Chưa cài lịch. Chạy: npm run schedule -- install');
    const r = schtasks(['/Run', '/TN', first.name]);
    if (r.status !== 0) fail(`schtasks /Run thất bại: ${(r.stderr || r.stdout || '').trim()}`);
    console.log(`▶ Đã kích hoạt ${first.name} — log: ${spec.log}`);
  } else {
    const tasks = list();
    if (!tasks.length) {
      console.log('✗ Chưa cài lịch. Chạy: npm run schedule -- install');
      return;
    }
    console.log(`✓ ${tasks.length} tác vụ: giờ theo config ${spec.times.map((t) => t.hhmm).join(' ')}`);
    for (const t of tasks) console.log(`  ${t.name} · lần tới: ${t.next} · ${t.status}`);
    hostNote();
    tail(spec.log);
  }
}

export function main(cmd = 'status'): void {
  if (!['install', 'status', 'run', 'uninstall'].includes(cmd)) {
    console.error('Dùng: npm run schedule -- install|status|run|uninstall');
    process.exit(1);
  }
  const { times, invalid } = parseTimes(loadConfig().coach.schedule);
  if (invalid.length) console.warn(`⚠️  Bỏ qua giờ không hợp lệ trong coach.schedule: ${invalid.join(', ')} (định dạng HH:MM)`);
  const spec: JobSpec = {
    node: process.execPath,
    script: path.join(TRAINER_DIR, 'scripts', 'coach-run.ts'),
    repo: REPO_DIR,
    log: path.join(RUNS_DIR, process.platform === 'darwin' ? 'launchd.log' : 'schedule.log'),
    times,
  };
  if (process.platform === 'darwin') mac(cmd, spec);
  else if (process.platform === 'win32') windows(cmd, spec);
  else linux(cmd, spec);
}

const self = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? (() => { try { return fs.realpathSync(process.argv[1]); } catch { return path.resolve(process.argv[1]); } })() : '';
if (invoked === self) main(process.argv[2]);
