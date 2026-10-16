// Validates every pack in bank/packs/ against bank/SCHEMA.md.
// Usage: node trainer/scripts/validate.ts [path-substring ...] [--warnings] [--json] [--fill-time]
//   - exit code 1 when there is at least one error (in the selected files)
//   - pass a substring (e.g. "packs/ai/2026-10-16") to report only matching files (warnings included)
//   - --fill-time inserts "- time: N" (SCHEMA.md §4 rubric) into questions that have no time
import fs from 'node:fs';
import path from 'node:path';
import { TRAINER_DIR } from '../server/config.ts';
import { loadBank } from '../server/lib/bank.ts';

const args = process.argv.slice(2);
const showWarnings = args.includes('--warnings');
const asJson = args.includes('--json');
const fillTime = args.includes('--fill-time');
const filters = args.filter((a) => !a.startsWith('--')).map((f) => f.replace(/^(\.\/)?trainer\//, ''));
const match = (file: string) => !filters.length || filters.some((f) => file.includes(f));

if (fillTime) {
  const bank = loadBank();
  const byFile = new Map<string, { line: number; time: number }[]>();
  for (const q of bank.questions) {
    if (!q.timeEstimated || !match(q.file)) continue;
    byFile.set(q.file, [...(byFile.get(q.file) ?? []), { line: q.line, time: q.time }]);
  }
  for (const [file, items] of byFile) {
    const abs = path.join(TRAINER_DIR, file);
    const lines = fs.readFileSync(abs, 'utf8').split('\n');
    for (const it of items.sort((a, b) => b.line - a.line)) {
      let i = it.line; // heading is at index line-1; metadata starts at index line
      while (i < lines.length && !lines[i].trim()) i++;
      while (i < lines.length && /^\s*[-*]\s+[A-Za-z_][A-Za-z0-9_]*\s*:/.test(lines[i]) && !/^\s*[-*]\s+[A-H][.)]\s/.test(lines[i])) i++;
      const insert = [`- time: ${it.time}`];
      if (i < lines.length && lines[i].trim()) insert.push('');
      lines.splice(i, 0, ...insert);
    }
    fs.writeFileSync(abs, lines.join('\n'));
    console.log(`⏱  ${file}: đã điền time cho ${items.length} câu`);
  }
}

const bank = loadBank();
const problems = bank.problems.filter((p) => match(p.file));
const errors = problems.filter((p) => p.level === 'error');
const warnings = problems.filter((p) => p.level === 'warning');
const packs = bank.packs.filter((p) => match(p.file));

if (asJson) {
  console.log(JSON.stringify({ packs: packs.length, questions: packs.reduce((s, p) => s + p.count, 0), errors, warnings }, null, 2));
} else {
  for (const p of errors) console.log(`❌ ${p.file}:${p.line}${p.qid ? ` [${p.qid}]` : ''} ${p.message}`);
  if (showWarnings || filters.length) for (const p of warnings) console.log(`⚠️  ${p.file}:${p.line}${p.qid ? ` [${p.qid}]` : ''} ${p.message}`);
  console.log(
    `\n${errors.length ? '✗' : '✓'} ${packs.length} pack · ${packs.reduce((s, p) => s + p.count, 0)} câu hợp lệ · ${errors.length} lỗi · ${warnings.length} cảnh báo` +
      (warnings.length && !showWarnings && !filters.length ? ' (thêm --warnings để xem)' : ''),
  );
}
process.exit(errors.length ? 1 : 0);
