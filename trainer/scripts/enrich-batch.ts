// Prepares an ENRICH batch without running the AI (for /trainer-enrich in Claude Code, or by hand — interactive mode:
// the AI writes the patch / pack file itself): writes coach/enrich/<run_id>-batch.md and prints where they must go.
// Usage:
//   node trainer/scripts/enrich-batch.ts [--size 20] [--tasks explain,hint,classify,balance,distractors] [--run-id <id>]
//   node trainer/scripts/enrich-batch.ts --ids 03-v2-01,05-v1-12 [--tasks distractors] [--note "…"] [--run-id <id>]
//   node trainer/scripts/enrich-batch.ts --longform [--count 5] [--run-id <id>]
//   node trainer/scripts/enrich-batch.ts --twins [--count 10] [--ids a,b --kind surface|contrast] [--run-id <id>]   (TWINS.md)
//   node trainer/scripts/enrich-batch.ts --family [--count 2] [--topic …] [--task 2.2] [--requirement cost] [--run-id <id>]   (FAMILY.md)
//   node trainer/scripts/enrich-batch.ts --status [--json]
import path from 'node:path';
import { PACKS_DIR } from '../server/config.ts';
import { context } from '../server/context.ts';
import { distractorReport, optionStats } from '../server/lib/quality.ts';
import { latestVerdicts } from '../server/lib/verify.ts';
import { stampParts } from '../server/lib/time.ts';
import { MAX_FAMILIES, MAX_TWINS, familyFocus, familySeeds, twinsTargets, writeFamilyFile, writeTwinsFile } from '../server/lib/twins.ts';
import { TWIN_KINDS, type TwinKind } from '../server/lib/ai-output.ts';
import { MAX_BATCH, MAX_LONGFORM, enrichStatus, idList, learnerNotes, longformTargets, parseTasks, patchPath, repoRel, selectBatch, upcomingIds, writeBatchFile, writeLongformFile } from '../server/lib/enrich.ts';

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

const { cfg, bank, attempts, states, plans } = context(); // re-graded attempts: answer-key fixes count against the new key

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

const s = stampParts();
const longform = flag('longform');
const twins = flag('twins');
const family = flag('family');
const runId = opt('run-id') ?? `${s.date}_${s.time}_${longform ? 'longform' : twins ? 'twins' : family ? 'family' : 'enrich'}`;
if (!/^[\w-]+$/.test(runId)) {
  console.error('✗ --run-id chỉ gồm chữ, số, "_" và "-"');
  process.exit(2);
}

const hhmm = s.time.slice(0, 4);
const aiPlan = (word: string, ids: string) => ({
  packFile: `${repoRel(path.join(PACKS_DIR, 'ai'))}/${s.date}-${hhmm}-${word}-<slug>.md`,
  packId: `ai-${s.date}-${hhmm}-${word}`,
  idPrefix: `ai-${s.compact}-${hhmm}-${ids}`,
});

if (twins) {
  const kind = opt('kind') as TwinKind | undefined;
  if (kind && !(TWIN_KINDS as readonly string[]).includes(kind)) {
    console.error(`✗ --kind phải là ${TWIN_KINDS.join(' | ')}`);
    process.exit(2);
  }
  const targets = twinsTargets(bank, states, { count: int(opt('count'), cfg.coach.twins_per_run, MAX_TWINS), ids: idList(opt('ids')), kind });
  if (!targets.length) {
    console.log('✓ Không có câu nào cần câu song sinh lúc này.');
    process.exit(0);
  }
  const plan = { count: targets.length, ...aiPlan('twins', 'tw') };
  const file = writeTwinsFile(runId, targets, bank, plan);
  console.log(`🪞 ${targets.length} câu gốc → ${repoRel(file)}`);
  console.log(`   run_id: ${runId}`);
  console.log(`   pack mới: ${plan.packFile} (pack id ${plan.packId}, id câu ${plan.idPrefix}01…)`);
  console.log('   Tiếp theo: làm theo trainer/coach/TWINS.md (chế độ tương tác).');
  process.exit(0);
}

if (family) {
  let focus;
  try {
    focus = familyFocus({ topic: opt('topic'), task: opt('task'), requirement: opt('requirement') }, bank);
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(2);
  }
  const plan = { count: int(opt('count'), 2, MAX_FAMILIES), ...aiPlan('family', 'fa'), familyPrefix: `ai-${s.compact}-${hhmm}-f` };
  const file = writeFamilyFile(runId, bank, plan, focus, familySeeds(bank, focus));
  console.log(`🎯 ${plan.count} họ câu → ${repoRel(file)}`);
  console.log(`   run_id: ${runId}`);
  console.log(`   pack mới: ${plan.packFile} (pack id ${plan.packId}, id câu ${plan.idPrefix}01…, id họ ${plan.familyPrefix}1…)`);
  console.log('   Tiếp theo: làm theo trainer/coach/FAMILY.md (chế độ tương tác).');
  process.exit(0);
}

if (longform) {
  const targets = longformTargets(bank, states, int(opt('count'), 5, MAX_LONGFORM));
  if (!targets.length) {
    console.log('✓ Không còn câu ngắn nào cần biến thể dài.');
    process.exit(0);
  }
  const plan = { count: targets.length, ...aiPlan('longform', 'lf') };
  const file = writeLongformFile(runId, targets, bank, plan);
  console.log(`📏 ${targets.length} câu gốc → ${repoRel(file)}`);
  console.log(`   run_id: ${runId}`);
  console.log(`   pack mới: ${plan.packFile} (pack id ${plan.packId}, id câu ${plan.idPrefix}01…)`);
  console.log('   Tiếp theo: làm theo trainer/coach/ENRICH.md phần B.');
} else {
  const { todos } = parseTasks(opt('tasks'));
  const distractors = todos.includes('distractors');
  const report = distractors ? distractorReport(bank, attempts) : undefined;
  const ids = idList(opt('ids'));
  // same order as the app's ENRICH runs: questions the learner is about to meet first (B9)
  const upcoming = ids.length ? [] : upcomingIds({ bank, states, attempts, plans, cfg });
  const items = selectBatch(bank, states, { size: int(opt('size'), cfg.coach.enrich_batch_size, MAX_BATCH), tasks: opt('tasks'), ids, report, upcoming });
  if (!items.length) {
    console.log('✓ Không còn câu nào cần ENRICH cho lựa chọn này.');
    process.exit(0);
  }
  const file = writeBatchFile(runId, items, bank, {
    todos,
    notes: learnerNotes(attempts, items.map((i) => i.q.id)),
    report,
    stats: distractors ? optionStats(bank, attempts) : undefined,
    verdicts: latestVerdicts(bank),
    mode: 'files',
    note: opt('note'),
  });
  const patch = repoRel(patchPath(runId));
  console.log(`🧰 ${items.length} câu → ${repoRel(file)}`);
  console.log(`   run_id: ${runId}`);
  console.log(`   patch: ${patch}`);
  console.log(`   Tiếp theo: làm theo trainer/coach/ENRICH.md phần A, rồi: node trainer/scripts/apply-patch.ts ${patch}`);
}
