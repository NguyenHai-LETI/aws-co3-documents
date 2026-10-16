// Two-machine sync from the terminal: commit trainer data (config.yaml → sync.data_paths), pull --rebase, push.
// Usage:
//   node trainer/scripts/sync.ts              # sync now
//   node trainer/scripts/sync.ts --dry-run    # show what would be committed / received / pushed (fetch only)
//   node trainer/scripts/sync.ts --status     # branch, ahead/behind, uncommitted data files
//   node trainer/scripts/sync.ts --force      # sync even while an AI coach run is in progress
// Exit code 1 when the sync failed (the message explains what to do).
import { runSync, syncStatus } from '../server/lib/sync.ts';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const stamp = () => new Date().toLocaleString('sv-SE');

if (flag('help') || flag('h')) {
  console.log('npm run sync [-- --dry-run | --status | --force]');
  process.exit(0);
}

if (flag('status')) {
  const s = await syncStatus({ fetch: !flag('no-fetch'), maxAgeMs: 0 });
  console.log(`Máy: ${s.host}`);
  if (s.branch) console.log(`Nhánh: ${s.branch}${s.remote ? ` ⇄ ${s.remote}${s.remoteUrl ? ` (${s.remoteUrl})` : ''}` : ''}`);
  if (s.remote) console.log(`Chưa đẩy: ${s.ahead} commit · chưa nhận: ${s.behind} commit${s.fetchedAt ? ` (kiểm tra lúc ${new Date(s.fetchedAt).toLocaleString('sv-SE')})` : ''}`);
  console.log(`File dữ liệu chưa commit: ${s.dirtyData}`);
  for (const f of s.dirtyFiles ?? []) console.log(`  · ${f}`);
  if (s.lastSync) console.log(`Lần đồng bộ gần nhất: ${s.lastSync.subject} (${s.lastSync.at})`);
  if (s.error) console.log(`⚠️  ${s.error}`);
  process.exit(s.error && s.disabled ? 1 : 0);
}

const r = await runSync({ dryRun: flag('dry-run'), force: flag('force') });
for (const s of r.steps) {
  console.log(`${s.ok ? '✓' : '✗'} ${s.cmd}`);
  if (s.output) console.log(s.output.replace(/^/gm, '    '));
}
console.log(`[${stamp()}] ${r.ok ? '✔' : '✗'} ${r.message}`);
if (r.conflicts?.length) console.log(`Xung đột: ${r.conflicts.join(', ')}`);
if (r.hint) console.log(`💡 ${r.hint}`);
process.exit(r.ok ? 0 : 1);
