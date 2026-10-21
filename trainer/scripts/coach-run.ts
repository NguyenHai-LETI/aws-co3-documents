// Runs the AI coach once from the command line / a scheduler (launchd, cron, Task Scheduler — npm run schedule).
// Usage:
//   node trainer/scripts/coach-run.ts                       # analyze (skips when there is no new result / open issue)
//   node trainer/scripts/coach-run.ts --force               # analyze even without new results
//   node trainer/scripts/coach-run.ts --trigger schedule    # scheduled run: coach.hosts, max_runs_per_day, enrich_on_idle
//   node trainer/scripts/coach-run.ts --generate --sources 03-database-services.md --count 15 --focus "RDS Proxy"
//   node trainer/scripts/coach-run.ts --enrich [--size 20] [--tasks explain,hint,classify,balance,distractors] [--batches 3]
//   node trainer/scripts/coach-run.ts --enrich --ids 03-v2-01,05-v1-12 [--tasks distractors] [--note "…"]
//   node trainer/scripts/coach-run.ts --longform [--count 5]
//   node trainer/scripts/coach-run.ts --verify [--ids a,b | --pack <pack-id> | --scope unverified-ai|new|changed|audit|grounded]
//   node trainer/scripts/coach-run.ts --twins [--count 10] [--ids a,b --kind surface|contrast]
//   node trainer/scripts/coach-run.ts --family [--count 2] [--topic database] [--task 2.2] [--requirement cost]
//   node trainer/scripts/coach-run.ts --generate --skills 3.5.s7,4.4.k2 [--count 6]   |   --longform --skills 2.2.s3
// [v5] A scheduled run without new results does the first coach.idle_tasks entry that has work (enrich | longform |
// twins | audit | notebook); the default [enrich] is one ENRICH batch, as before. coach.enrich_on_idle: false = nothing.
// With coach.enrich_after_analyze, a successful analyze is followed by a small ENRICH run over the questions the learner
// is about to meet; the process waits for it (exit code = the analyze run's).
import os from 'node:os';
import { loadConfig } from '../server/config.ts';
import { context } from '../server/context.ts';
import { loadBank } from '../server/lib/bank.ts';
import { VERIFY_SCOPES } from '../server/lib/verify.ts';
import { loadIssues } from '../server/lib/issues.ts';
import { newDataSince } from '../server/lib/snapshot.ts';
import { aiSyncLine, syncForAi } from '../server/lib/sync.ts';
import { NothingToDoError, coachGuard, coachRunner, findClaude, hostAllowed, scheduledRunsToday, startIdle } from '../server/lib/coach-runner.ts';
import type { CoachRunInfo, CoachTask } from '../shared/types.ts';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const stamp = () => new Date().toLocaleString('sv-SE');
const log = (msg: string) => console.log(`[${stamp()}] ${msg}`);
const int = (v: string | undefined, dflt: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(max, n) : dflt;
};

const cfg = loadConfig();
let task: CoachTask = flag('generate')
  ? 'generate'
  : flag('enrich')
    ? 'enrich'
    : flag('longform')
      ? 'longform'
      : flag('verify')
        ? 'verify'
        : flag('twins')
          ? 'twins'
          : flag('family')
            ? 'family'
            : 'analyze';
let idle = false; // [v5] scheduled run without new results → coach.idle_tasks
const trigger = (opt('trigger') ?? 'cli') as CoachRunInfo['trigger'];
const maxPerDay = cfg.coach.max_runs_per_day;

const blocked = coachGuard();
if (blocked) {
  console.error(`[${stamp()}] ✗ ${blocked}`);
  process.exit(2);
}

if (trigger === 'schedule') {
  if (!hostAllowed(cfg)) {
    log(`⏭  Máy "${os.hostname()}" không nằm trong coach.hosts (${cfg.coach.hosts.join(', ')}) — bỏ qua lượt chạy theo lịch.`);
    process.exit(0);
  }
  const today = scheduledRunsToday();
  if (maxPerDay > 0 && today >= maxPerDay) {
    log(`⏭  Hôm nay đã có ${today} lượt chạy theo lịch (coach.max_runs_per_day = ${maxPerDay}) — bỏ qua.`);
    process.exit(0);
  }
}

const claude = findClaude(cfg, true);
if (!claude.available) {
  console.error(`[${stamp()}] ✗ ${claude.hint}`);
  process.exit(2);
}

// Sync first (sync.before_ai): results that arrived from the other machine count as new data below.
if (cfg.sync.before_ai) log(aiSyncLine(await syncForAi('before')));

if (task === 'analyze' && !flag('force') && cfg.coach.skip_if_no_new_results) {
  const { attempts, plans } = context(); // re-graded attempts (answer-key fixes count against the new key)
  const fresh = newDataSince(plans[0], attempts);
  const openIssues = loadIssues().filter((i) => i.open).length;
  if (!fresh.attempts && !openIssues) {
    if (trigger === 'schedule' && cfg.coach.enrich_on_idle) {
      log(`ℹ️  Không có bài làm mới hay issue mở — chạy việc lúc rảnh (coach.idle_tasks: ${cfg.coach.idle_tasks.join(', ')}).`);
      idle = true;
    } else {
      log('⏭  Không có bài làm mới hay issue mở kể từ kế hoạch gần nhất — bỏ qua (dùng --force để chạy).');
      process.exit(0);
    }
  }
}

log(`Claude Code ${claude.version} · ${claude.source}`); // analyze: the runner writes the snapshot right before the CLI starts

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const params: Record<string, unknown> =
  task === 'generate'
    ? {
        sources: (opt('sources') ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        count: int(opt('count'), 15, 60),
        topic: opt('topic'),
        difficulty: opt('difficulty'),
        focus: opt('focus'),
        slug: opt('slug'),
        ...(opt('skills') ? { skills: list(opt('skills')) } : {}),
      }
    : task === 'enrich'
      ? {
          size: int(opt('size'), cfg.coach.enrich_batch_size, 60),
          ...(opt('tasks') ? { tasks: opt('tasks') } : {}),
          ...(opt('ids') ? { ids: list(opt('ids')) } : {}),
          ...(opt('note') ? { note: opt('note') } : {}),
        }
      : task === 'longform'
        ? { count: int(opt('count'), 5, 20), ...(opt('skills') ? { skills: list(opt('skills')) } : {}) }
        : task === 'twins'
          ? { count: int(opt('count'), cfg.coach.twins_per_run, 20), ...(opt('ids') ? { ids: list(opt('ids')) } : {}), ...(opt('kind') ? { kind: opt('kind') } : {}) }
          : task === 'family'
            ? { count: int(opt('count'), 2, 5), ...(opt('topic') ? { topic: opt('topic') } : {}), ...(opt('task') ? { task: opt('task') } : {}), ...(opt('requirement') ? { requirement: opt('requirement') } : {}) }
            : task === 'verify'
          ? { ...(opt('ids') ? { ids: list(opt('ids')) } : {}), ...(opt('pack') ? { pack: opt('pack') } : {}), ...(opt('scope') ? { scope: opt('scope') } : {}) }
          : { note: opt('note') };
const batches = task === 'enrich' && flag('enrich') && !opt('ids') ? int(opt('batches'), 1, 20) : 1;

if (task === 'verify') {
  // a typo must not look like "nothing to verify" (exit 0) or silently become another scope
  if (opt('scope') && !(VERIFY_SCOPES as readonly string[]).includes(opt('scope')!)) {
    console.error(`[${stamp()}] ✗ --scope không hợp lệ: ${opt('scope')} (${VERIFY_SCOPES.join(' | ')})`);
    process.exit(2);
  }
  const pack = opt('pack');
  if (pack && !loadBank().packs.some((p) => p.id === pack || p.file === pack)) {
    console.error(`[${stamp()}] ✗ Không có pack "${pack}" (dùng pack id, vd ai-2026-10-16-1757-longform, hoặc đường dẫn bank/packs/…)`);
    process.exit(2);
  }
  if (flag('ids') && !opt('ids')) {
    console.error(`[${stamp()}] ✗ --ids cần danh sách id, vd --ids 03-v2-01,05-v1-12`);
    process.exit(2);
  }
}

let finished = 0;
const runOnce = () => {
  if (idle) return void runIdle();
  if (trigger === 'schedule' && finished > 0 && maxPerDay > 0 && scheduledRunsToday() >= maxPerDay) {
    log(`⏭  Đạt giới hạn ${maxPerDay} lượt chạy theo lịch hôm nay — dừng.`);
    process.exit(0);
  }
  try {
    const info = coachRunner.start(task, trigger, params, { syncBefore: false }); // synced above
    if (batches > 1) log(`▶ Lượt ${finished + 1}/${batches}: ${info.id}`);
  } catch (e) {
    if (e instanceof NothingToDoError) {
      log(`✓ ${e.message}`);
      process.exit(0);
    }
    console.error(`[${stamp()}] ✗ ${(e as Error).message}`);
    process.exit(1);
  }
};

coachRunner.on('event', (ev) => {
  const prefix = { start: '▶', tool: '  ·', text: '  ✎', result: '✔', error: '  ✗', stderr: '  !', end: '■' }[ev.kind as string] ?? '-';
  console.log(`${prefix} ${ev.text}`);
});
let mainStatus: CoachRunInfo['status'] | undefined; // exit code = the requested runs' outcome (not a follow-up's)
coachRunner.on('followup', (f: { after: string; run?: CoachRunInfo; skipped?: string }) => {
  log(f.run ? `▶ ENRICH câu sắp gặp sau phân tích (coach.enrich_after_analyze): ${f.run.id}` : `✓ Không chạy ENRICH sau phân tích: ${f.skipped ?? ''}`);
});
coachRunner.on('done', (info: CoachRunInfo) => {
  log(`${info.status}${info.costUsd ? ` · $${info.costUsd.toFixed(3)}` : ''}`);
  if (!info.params?.after) {
    finished++;
    mainStatus = info.status;
    if (info.status === 'success' && finished < batches) return void setTimeout(runOnce, 1500);
  }
  // a follow-up run starts right after 'done' (coach.enrich_after_analyze) — then wait for its own 'done'
  setImmediate(() => {
    if (coachRunner.current) return;
    process.exit(mainStatus === 'success' || mainStatus === 'skipped' ? 0 : 1); // skipped = nothing left after the sync
  });
});
/** [v5] coach.idle_tasks: the first idle task with work (a coach run, or the notebook update which ends here). */
async function runIdle() {
  try {
    const r = await startIdle(coachRunner, trigger, cfg, log, { syncBefore: false }); // synced above
    if (r.kind === 'run') return; // 'done' handles the exit
    if (r.kind === 'notebook') {
      log(`${r.status === 'error' ? '✗' : '✓'} ${r.step.label}: ${r.summary ?? r.error ?? r.status}`);
      process.exit(r.status === 'error' ? 1 : 0);
    }
    log('✓ Không có việc lúc rảnh nào cần làm.');
    process.exit(0);
  } catch (e) {
    console.error(`[${stamp()}] ✗ ${(e as Error).message}`);
    process.exit(1);
  }
}

process.on('SIGINT', () => coachRunner.cancel() || process.exit(130));
process.on('SIGTERM', () => coachRunner.cancel() || process.exit(143));

runOnce();
