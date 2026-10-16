// Tags questions with their exam-guide task statement (`- task: 2.2`, taxonomy.yaml → tasks) using the
// heuristic in server/lib/classify.ts (guessTask). The ENRICH routine refines tasks with AI later.
//
// Usage: node scripts/classify-tasks.ts [--apply] [--force] [--pack <substring>] [--sample N]
//   (default) dry run — distribution of the tasks that would be written, writes nothing
//   --apply   insert `- task:` into questions that have none (only that line changes in the pack)
//   --force   recompute every question, also those that already have a task
//   --sample  print N example questions per guessed task (for a quick sanity check)
// Try it on a copy first: TRAINER_HOME=/path/to/copy node scripts/classify-tasks.ts --apply
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, loadConfig } from '../server/config.ts';
import { loadBank } from '../server/lib/bank.ts';
import { guessTask } from '../server/lib/classify.ts';
import { setQuestionMeta } from '../server/lib/migrations.ts';
import { writeSnapshot } from '../server/lib/snapshot.ts';
import type { Question } from '../shared/types.ts';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FORCE = args.includes('--force');
const valueOf = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const packFilter = valueOf('--pack');
const sample = Number(valueOf('--sample') ?? 0);

const bank = loadBank();
const tax = bank.taxonomy;
if (!tax.tasks?.length) {
  console.error('✗ taxonomy.yaml chưa có danh sách tasks (1.1 … 4.4).');
  process.exit(1);
}
const selected = bank.questions.filter((q) => !packFilter || q.file.includes(packFilter));
const todo: { q: Question; task: string }[] = [];
let kept = 0;
let unchanged = 0;
for (const q of selected) {
  if (q.task && !FORCE) {
    kept++;
    continue;
  }
  const task = guessTask(q, tax);
  if (!task) continue;
  if (task === q.task) unchanged++;
  else todo.push({ q, task });
}

const finalTask = new Map(selected.map((q) => [q.id, q.task]));
for (const t of todo) finalTask.set(t.q.id, t.task);
const count = (pred: (id: string, task?: string) => boolean) => [...finalTask].filter(([id, t]) => pred(id, t)).length;
const newByTask = new Map<string, number>();
for (const t of todo) newByTask.set(t.task, (newByTask.get(t.task) ?? 0) + 1);

console.log(`Dữ liệu: ${DATA_DIR}`);
console.log(`Câu hỏi: ${selected.length}${packFilter ? ` (lọc "${packFilter}")` : ''} · đã có task (giữ nguyên): ${kept} · sẽ ghi: ${todo.length}${FORCE ? ` · tính lại không đổi: ${unchanged}` : ''}\n`);
console.log('Task  Domain        Sẽ ghi  Tổng sau   %     Mục tiêu');
for (const def of tax.tasks) {
  const total = count((_id, t) => t === def.id);
  const pctTotal = selected.length ? ((100 * total) / selected.length).toFixed(1) : '0.0';
  console.log(`${def.id.padEnd(5)} ${def.domain.padEnd(12)} ${String(newByTask.get(def.id) ?? 0).padStart(6)}  ${String(total).padStart(8)}  ${pctTotal.padStart(5)}%  ${def.label_vi}`);
}
const none = count((_id, t) => !t);
if (none) console.log(`(chưa có task: ${none})`);

if (sample > 0) {
  for (const def of tax.tasks) {
    const items = todo.filter((t) => t.task === def.id).slice(0, sample);
    if (!items.length) continue;
    console.log(`\n── ${def.id} ${def.label}`);
    for (const { q } of items) {
      const correct = q.options.filter((o) => q.answer.includes(o.key)).map((o) => o.text).join(' / ');
      console.log(`  ${q.id.padEnd(14)} ${q.stem.replace(/\s+/g, ' ').slice(0, 110)}\n  ${''.padEnd(14)} ✓ ${correct.slice(0, 100)}`);
    }
  }
}

if (!todo.length) {
  console.log('\n✓ Không có gì để ghi.');
  process.exit(0);
}
if (!APPLY) {
  console.log(`\nDry run — chưa ghi gì. Chạy lại với --apply để ghi \`- task:\` vào ${todo.length} câu.`);
  process.exit(0);
}

const byFile = new Map<string, Map<string, string>>();
for (const { q, task } of todo) {
  const m = byFile.get(q.file) ?? new Map<string, string>();
  m.set(q.id, task);
  byFile.set(q.file, m);
}
let written = 0;
for (const [file, values] of byFile) {
  const abs = path.join(DATA_DIR, file);
  const out = setQuestionMeta(fs.readFileSync(abs, 'utf8'), 'task', values);
  if (!out.changed.length) continue;
  fs.writeFileSync(abs, out.text);
  written += out.changed.length;
}
const check = loadBank();
const mismatch = check.problems.filter((p) => /^task /.test(p.message) || /Unknown task/.test(p.message)).length;
console.log(`\n✓ Đã ghi task cho ${written} câu trong ${byFile.size} pack · kiểm tra lại: ${check.problems.filter((p) => p.level === 'error').length} lỗi · ${mismatch} cảnh báo task/domain`);
try {
  writeSnapshot(check, loadConfig()); // snapshot has a per-task table
} catch (e) {
  console.warn(`⚠️  Không cập nhật được snapshot (${(e as Error).message}) — chạy: npm run snapshot`);
}
