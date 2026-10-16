// Prepares an ENRICH batch without running the AI (for /trainer-enrich in Claude Code, or by hand):
// writes coach/enrich/<run_id>-batch.md and prints where the patch / new pack must go.
// Usage:
//   node trainer/scripts/enrich-batch.ts [--size 20] [--tasks explain,hint,classify,balance] [--run-id <id>]
//   node trainer/scripts/enrich-batch.ts --longform [--count 5] [--run-id <id>]
//   node trainer/scripts/enrich-batch.ts --status [--json]
import path from 'node:path';
import { PACKS_DIR, loadConfig } from '../server/config.ts';
import { loadBank } from '../server/lib/bank.ts';
import { loadAttempts } from '../server/lib/results.ts';
import { computeStates } from '../server/lib/stats.ts';
import { stampParts } from '../server/lib/time.ts';
import { MAX_BATCH, MAX_LONGFORM, enrichStatus, learnerNotes, longformTargets, parseTasks, patchPath, repoRel, selectBatch, writeBatchFile, writeLongformFile } from '../server/lib/enrich.ts';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const int = (v: string | undefined, dflt: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(max, n) : dflt;
};

const cfg = loadConfig();
const bank = loadBank();

if (flag('status')) {
  const st = enrichStatus(bank);
  if (flag('json')) console.log(JSON.stringify(st, null, 2));
  else {
    console.log(`ENRICH: ${st.enriched}/${st.total} câu đã xử lý · câu dài ${st.longForm} (còn ${st.longFormCandidates} câu ngắn chưa có biến thể dài)`);
    console.log(`Còn cần: explain ${st.pending.explain} · hint ${st.pending.hint} · classify ${st.pending.classify} · balance ${st.pending.balance}`);
    if (st.lastRun) console.log(`Lượt gần nhất: ${st.lastRun.id} · ${st.lastRun.status}`);
  }
  process.exit(0);
}

const attempts = loadAttempts();
const states = computeStates(attempts, cfg);
const s = stampParts();
const longform = flag('longform');
const runId = opt('run-id') ?? `${s.date}_${s.time}_${longform ? 'longform' : 'enrich'}`;
if (!/^[\w-]+$/.test(runId)) {
  console.error('✗ --run-id chỉ gồm chữ, số, "_" và "-"');
  process.exit(2);
}

if (longform) {
  const targets = longformTargets(bank, states, int(opt('count'), 5, MAX_LONGFORM));
  if (!targets.length) {
    console.log('✓ Không còn câu ngắn nào cần biến thể dài.');
    process.exit(0);
  }
  const hhmm = s.time.slice(0, 4);
  const plan = {
    count: targets.length,
    packFile: `${repoRel(path.join(PACKS_DIR, 'ai'))}/${s.date}-${hhmm}-longform-<slug>.md`,
    packId: `ai-${s.date}-${hhmm}-longform`,
    idPrefix: `ai-${s.compact}-${hhmm}-lf`,
  };
  const file = writeLongformFile(runId, targets, bank, plan);
  console.log(`📏 ${targets.length} câu gốc → ${repoRel(file)}`);
  console.log(`   run_id: ${runId}`);
  console.log(`   pack mới: ${plan.packFile} (pack id ${plan.packId}, id câu ${plan.idPrefix}01…)`);
  console.log('   Tiếp theo: làm theo trainer/coach/ENRICH.md phần B.');
} else {
  const { todos } = parseTasks(opt('tasks'));
  const items = selectBatch(bank, states, { size: int(opt('size'), cfg.coach.enrich_batch_size, MAX_BATCH), tasks: opt('tasks') });
  if (!items.length) {
    console.log('✓ Không còn câu nào cần ENRICH cho lựa chọn này.');
    process.exit(0);
  }
  const file = writeBatchFile(runId, items, bank, { todos, notes: learnerNotes(attempts, items.map((i) => i.q.id)) });
  const patch = repoRel(patchPath(runId));
  console.log(`🧰 ${items.length} câu → ${repoRel(file)}`);
  console.log(`   run_id: ${runId}`);
  console.log(`   patch: ${patch}`);
  console.log(`   Tiếp theo: làm theo trainer/coach/ENRICH.md phần A, rồi: node trainer/scripts/apply-patch.ts ${patch}`);
}
