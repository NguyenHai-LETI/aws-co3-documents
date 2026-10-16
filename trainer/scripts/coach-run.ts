// Runs the AI coach once from the command line / a scheduler (launchd, cron).
// Usage:
//   node trainer/scripts/coach-run.ts                 # analyze (skips when there is no new result)
//   node trainer/scripts/coach-run.ts --force         # analyze even without new results
//   node trainer/scripts/coach-run.ts --trigger schedule
//   node trainer/scripts/coach-run.ts --generate --sources 03-database-services.md --count 15 --focus "RDS Proxy"
import { loadConfig } from '../server/config.ts';
import { loadBank } from '../server/lib/bank.ts';
import { loadAttempts } from '../server/lib/results.ts';
import { loadPlans } from '../server/lib/plans.ts';
import { loadIssues } from '../server/lib/issues.ts';
import { newDataSince, writeSnapshot } from '../server/lib/snapshot.ts';
import { coachRunner, findClaude } from '../server/lib/coach-runner.ts';
import type { CoachRunInfo } from '../shared/types.ts';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const cfg = loadConfig();
const task = flag('generate') ? 'generate' : 'analyze';
const trigger = (opt('trigger') ?? 'cli') as CoachRunInfo['trigger'];
const stamp = () => new Date().toLocaleString('sv-SE');

const claude = findClaude(cfg, true);
if (!claude.available) {
  console.error(`[${stamp()}] ✗ ${claude.hint}`);
  process.exit(2);
}

const bank = loadBank();
const snap = writeSnapshot(bank, cfg);
if (task === 'analyze' && !flag('force') && cfg.coach.skip_if_no_new_results) {
  const attempts = loadAttempts();
  const fresh = newDataSince(loadPlans(attempts)[0], attempts);
  const openIssues = loadIssues().filter((i) => i.open).length;
  if (!fresh.attempts && !openIssues) {
    console.log(`[${stamp()}] ⏭  Không có bài làm mới hay issue mở kể từ kế hoạch gần nhất — bỏ qua (dùng --force để chạy).`);
    process.exit(0);
  }
}
console.log(`[${stamp()}] snapshot: ${snap.attempts} bài / ${snap.answers} câu · Claude Code ${claude.version}`);

const params: Record<string, unknown> =
  task === 'generate'
    ? {
        sources: (opt('sources') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
        count: Number(opt('count') ?? 15),
        topic: opt('topic'),
        difficulty: opt('difficulty'),
        focus: opt('focus'),
        slug: opt('slug'),
      }
    : { note: opt('note') };

coachRunner.on('event', (ev) => {
  const prefix = { start: '▶', tool: '  ·', text: '  ✎', result: '✔', error: '  ✗', stderr: '  !', end: '■' }[ev.kind as string] ?? '-';
  console.log(`${prefix} ${ev.text}`);
});
coachRunner.on('done', (info: CoachRunInfo) => {
  console.log(`[${stamp()}] ${info.status}${info.costUsd ? ` · $${info.costUsd.toFixed(3)}` : ''}`);
  process.exit(info.status === 'success' ? 0 : 1);
});
process.on('SIGINT', () => coachRunner.cancel());
process.on('SIGTERM', () => coachRunner.cancel());

try {
  coachRunner.start(task, trigger, params);
} catch (e) {
  console.error(`[${stamp()}] ✗ ${(e as Error).message}`);
  process.exit(1);
}
