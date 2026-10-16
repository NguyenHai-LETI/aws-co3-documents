// Permanent answer-position rebalance of question packs (feature #1).
// The imported practice exams keep the correct answer mostly at A/B. This rewrites every question of
// the selected packs with a canonical option order: correct letters spread evenly per pack (round-robin
// over a seeded order), distractors in a seeded order (seed = question id + option text, so re-running
// changes nothing), and option-letter references in explanations become option text.
//
// Usage: node scripts/rebalance-answers.ts [--apply] [--all] [--pack <substring>] [--verbose]
//   (default) dry run — prints the before/after letter distribution, writes nothing
//   --apply   rewrite the packs, write bank/migrations/<date>-rebalance-answers.json, then remap the
//             letters stored in result files (migrateResults — also runs at every server start)
//   --all     every pack (default: packs with origin: imported)
// Try it on a copy first: TRAINER_HOME=/path/to/copy node scripts/rebalance-answers.ts --apply
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, MIGRATIONS_DIR, loadConfig, rel } from '../server/config.ts';
import { loadBank } from '../server/lib/bank.ts';
import { hasLetterRef, letterDistribution, migrateResults, rebalancePackText, writeMigration, type RebalanceResult } from '../server/lib/migrations.ts';
import { loadIssues } from '../server/lib/issues.ts';
import { writeSnapshot } from '../server/lib/snapshot.ts';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ALL = args.includes('--all');
const VERBOSE = args.includes('--verbose');
const packFilter = args.includes('--pack') ? args[args.indexOf('--pack') + 1] : undefined;

const bank = loadBank();
const errors = bank.problems.filter((p) => p.level === 'error');
if (errors.length) {
  console.error(`✗ Ngân hàng đang có ${errors.length} lỗi — sửa trước (npm run validate), không rebalance trên dữ liệu lỗi.`);
  process.exit(1);
}
const packs = bank.packs.filter((p) => (ALL || p.origin === 'imported') && (!packFilter || p.file.includes(packFilter)));
console.log(`Dữ liệu: ${DATA_DIR}`);
console.log(`Packs: ${packs.length}${ALL ? ' (tất cả)' : ' (origin: imported)'}${packFilter ? ` · lọc "${packFilter}"` : ''}`);
if (!packs.length) process.exit(0);

const results: (RebalanceResult & { abs: string; file: string })[] = [];
for (const p of packs) {
  const abs = path.join(DATA_DIR, p.file);
  const r = rebalancePackText(fs.readFileSync(abs, 'utf8'), p.file, bank.taxonomy);
  results.push({ ...r, abs, file: p.file });
}

// ── distribution before/after (questions the bank actually uses: first copy of each id)
const files = new Set(packs.map((p) => p.file));
const before = bank.questions.filter((q) => files.has(q.file));
const afterAnswer = new Map<string, string[]>();
for (const r of results) for (const c of r.changes) afterAnswer.set(c.id, [...c.after]);
const after = before.map((q) => ({ answer: afterAnswer.get(q.id) ?? q.answer }));

const fmt = (d: Record<string, number>) => {
  const n = Object.values(d).reduce((s, x) => s + x, 0) || 1;
  return Object.entries(d)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k} ${String(v).padStart(3)} (${((100 * v) / n).toFixed(1).padStart(4)}%)`)
    .join('  ');
};
const multi = (d: Record<string, number>) =>
  Object.entries(d)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}:${v}`)
    .join(' ') || '—';
const b = letterDistribution(before);
const a = letterDistribution(after);
const singles = before.filter((q) => q.answer.length === 1).length;
console.log(`Câu hỏi: ${before.length} · 1 đáp án: ${singles} · nhiều đáp án: ${before.length - singles}\n`);
console.log(`Đáp án đúng (câu 1 đáp án)  trước: ${fmt(b.single)}`);
console.log(`                            sau:   ${fmt(a.single)}`);
console.log(`Tổ hợp đáp án (nhiều đáp án) trước: ${multi(b.multi)}`);
console.log(`                             sau:   ${multi(a.multi)}\n`);

const changes = results.flatMap((r) => r.changes);
const moved = changes.filter((c) => Object.entries(c.mapping).some(([x, y]) => x !== y));
const refs = changes.filter((c) => c.explanationRefs > 0);
const positional = results.flatMap((r) => r.positional);
const unresolved = results.flatMap((r) => r.unresolved);
const problems = results.flatMap((r) => r.problems);
console.log(`Đổi thứ tự lựa chọn: ${moved.length} câu · đáp án đúng đổi chữ cái: ${moved.filter((c) => c.before !== c.after).length} câu`);
console.log(`Giải thích nhắc chữ cái → đổi thành nội dung: ${refs.length} câu${refs.length ? ` (${refs.map((c) => c.id).join(', ')})` : ''}`);
if (positional.length) console.log(`Giữ nguyên vị trí (lựa chọn nhắc tới lựa chọn khác): ${positional.join(', ')}`);
if (unresolved.length) console.log(`⚠️  Vẫn còn nhắc chữ cái trong giải thích (sửa tay): ${unresolved.join(', ')}`);
if (VERBOSE) {
  for (const c of changes) {
    const map = Object.entries(c.mapping).map(([x, y]) => `${x}→${y}`).join(' ');
    console.log(`  ${c.id.padEnd(14)} ${c.before.padEnd(2)} → ${c.after.padEnd(2)}  ${map}${c.explanationRefs ? `  (+${c.explanationRefs} tham chiếu chữ cái)` : ''}`);
  }
}
if (problems.length) {
  console.error(`\n✗ Kiểm tra sau khi viết lại thất bại — không ghi gì:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

// open issues that quote option letters of re-ordered questions need a human look after --apply
const movedIds = new Set(moved.map((c) => c.id));
const letterIssues = loadIssues().filter((i) => i.open && movedIds.has(i.qid) && /(^|[^\p{L}\p{N}])[A-H]([^\p{L}\p{N}]|$)/u.test(i.note));
if (letterIssues.length) {
  console.log(`\nℹ️  Issue đang mở có nhắc chữ cái đáp án (chữ cái cũ, trước rebalance): ${letterIssues.map((i) => `${i.qid} (dòng ${i.line})`).join(', ')}`);
}

const touched = results.filter((r) => r.changes.length);
if (!touched.length) {
  console.log('\n✓ Không có gì để đổi (đã rebalance trước đó).');
  process.exit(0);
}
if (!APPLY) {
  console.log(`\nDry run — chưa ghi gì. Chạy lại với --apply để ghi ${touched.length} pack + bản ghi migration và chuyển đổi kết quả cũ.`);
  process.exit(0);
}

for (const r of touched) fs.writeFileSync(r.abs, r.text);
console.log(`\n✓ Đã ghi ${touched.length} pack`);
if (moved.length) {
  const rec = writeMigration('rebalance-answers', {
    kind: 'rebalance-answers',
    note: `Answer-position rebalance of ${ALL ? 'all' : 'imported'} packs (scripts/rebalance-answers.ts): old → new option letters per question.`,
    questions: Object.fromEntries(moved.map((c) => [c.id, c.mapping])),
    answers: Object.fromEntries(moved.map((c) => [c.id, [c.before, c.after] as [string, string]])),
  });
  console.log(`✓ Migration: ${rel(path.join(MIGRATIONS_DIR, `${rec.id}.json`))} (${moved.length} câu)`);
  const m = migrateResults();
  console.log(`✓ Kết quả đã chuyển chữ cái: ${m.migrated} file`);
}
const check = loadBank();
const stillRefs = check.questions.filter((q) => files.has(q.file) && hasLetterRef(q.explanation)).length;
console.log(`✓ Kiểm tra lại: ${check.problems.filter((p) => p.level === 'error').length} lỗi · ${stillRefs} câu còn nhắc chữ cái trong giải thích`);
try {
  writeSnapshot(check, loadConfig()); // the coach snapshot quotes options by letter
  console.log('✓ Đã cập nhật coach/snapshot.md');
} catch (e) {
  console.warn(`⚠️  Không cập nhật được snapshot (${(e as Error).message}) — chạy: npm run snapshot`);
}
