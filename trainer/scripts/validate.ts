// Validates every pack in bank/packs/ against bank/SCHEMA.md.
// Usage: node trainer/scripts/validate.ts [path-substring ...] [--warnings] [--json] [--fill-time] [--lint[=code,…]]
//   - exit code 1 when there is at least one error (in the selected files); lint findings never change the exit code
//   - pass a substring (e.g. "packs/ai/2026-10-16") to report only matching files (warnings included)
//   - --fill-time inserts "- time: N" (SCHEMA.md §4 rubric) into questions that have no time
//   - --lint also checks item-writing flaws (server/lib/lint.ts): summary per rule + the flagged questions
//     (high + medium; low too with --warnings or a path filter); --lint=stem-echo,longest-correct limits the rules
import fs from 'node:fs';
import path from 'node:path';
import { TRAINER_DIR } from '../server/config.ts';
import { loadBank } from '../server/lib/bank.ts';
import { LINT_RULES, lintContext, lintQuestion } from '../server/lib/lint.ts';
import type { LintFlaw, LintSeverity } from '../shared/types.ts';

const args = process.argv.slice(2);
const showWarnings = args.includes('--warnings');
const asJson = args.includes('--json');
const fillTime = args.includes('--fill-time');
const lintArg = args.find((a) => a === '--lint' || a.startsWith('--lint='));
const lintCodes = lintArg?.includes('=') ? lintArg.split('=')[1].split(',').map((c) => c.trim()).filter(Boolean) : [];
const filters = args.filter((a) => !a.startsWith('--')).map((f) => f.replace(/^(\.\/)?trainer\//, ''));
const match = (file: string) => !filters.length || filters.some((f) => file.includes(f));

const unknown = lintCodes.filter((c) => !LINT_RULES.some((r) => r.code === c));
if (unknown.length) {
  console.error(`✗ Không có luật lint: ${unknown.join(', ')} (có: ${LINT_RULES.map((r) => r.code).join(', ')})`);
  process.exit(2);
}

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

// ── lint (active questions of the selected files) ──
interface LintRow {
  id: string;
  file: string;
  line: number;
  flaws: LintFlaw[];
}
const SEV_ICON: Record<LintSeverity, string> = { high: '❗', medium: '⚠️ ', low: '·' };
const lintRows: LintRow[] = [];
if (lintArg) {
  for (const q of bank.questions) {
    if (q.status !== 'active' || !match(q.file)) continue;
    const flaws = lintQuestion(q, bank.taxonomy, lintContext(bank, q)).filter((f) => !lintCodes.length || lintCodes.includes(f.code));
    if (flaws.length) lintRows.push({ id: q.id, file: q.file, line: q.line, flaws });
  }
}
const lintCount = (code: string) => lintRows.filter((r) => r.flaws.some((f) => f.code === code)).length;
const checked = bank.questions.filter((q) => q.status === 'active' && match(q.file)).length;

if (asJson) {
  const out: Record<string, unknown> = { packs: packs.length, questions: packs.reduce((s, p) => s + p.count, 0), errors, warnings };
  if (lintArg) {
    out.lint = {
      checked,
      flagged: lintRows.length,
      rules: LINT_RULES.filter((r) => !lintCodes.length || lintCodes.includes(r.code)).map((r) => ({ ...r, count: lintCount(r.code) })),
      questions: lintRows,
    };
  }
  console.log(JSON.stringify(out, null, 2));
} else {
  for (const p of errors) console.log(`❌ ${p.file}:${p.line}${p.qid ? ` [${p.qid}]` : ''} ${p.message}`);
  if (showWarnings || filters.length) for (const p of warnings) console.log(`⚠️  ${p.file}:${p.line}${p.qid ? ` [${p.qid}]` : ''} ${p.message}`);
  if (lintArg) {
    const showLow = showWarnings || filters.length > 0 || lintCodes.length > 0;
    let hiddenLow = 0;
    console.log(`\n🩺 Lint — lỗi viết câu hỏi (${checked} câu active${filters.length ? ' trong các file đã chọn' : ''})`);
    for (const r of lintRows) {
      const shown = r.flaws.filter((f) => showLow || f.severity !== 'low');
      if (shown.length < r.flaws.length) hiddenLow++;
      for (const f of shown) console.log(`${SEV_ICON[f.severity]} ${r.file}:${r.line} [${r.id}] ${f.code}${f.option ? ` (${f.option})` : ''}: ${f.message}`);
    }
    console.log('\n  Mức    Luật                  Câu  Mô tả');
    for (const rule of LINT_RULES) {
      if (lintCodes.length && !lintCodes.includes(rule.code)) continue;
      const n = lintCount(rule.code);
      console.log(`  ${rule.severity.padEnd(6)} ${rule.code.padEnd(20)} ${String(n).padStart(4)}  ${rule.label}${n ? ` — ${rule.fix}` : ' ✓'}`);
    }
    const worst = (sev: LintSeverity) => lintRows.filter((r) => r.flaws[0].severity === sev).length; // flaws are sorted worst first
    console.log(
      `\n${worst('high') ? '❗' : '✓'} lint (${checked} câu active): ${worst('high')} câu lỗi nặng · ${worst('medium')} câu lỗi vừa · ${worst('low')} câu chỉ có lỗi nhẹ` +
        (hiddenLow && !showLow ? ` — lỗi nhẹ (low) đang ẩn, thêm --warnings để xem` : ''),
    );
  }
  console.log(
    `\n${errors.length ? '✗' : '✓'} ${packs.length} pack · ${packs.reduce((s, p) => s + p.count, 0)} câu hợp lệ · ${errors.length} lỗi · ${warnings.length} cảnh báo` +
      (warnings.length && !showWarnings && !filters.length ? ' (thêm --warnings để xem)' : ''),
  );
}
process.exit(errors.length ? 1 : 0);
