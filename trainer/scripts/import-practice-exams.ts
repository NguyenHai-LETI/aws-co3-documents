// Migration: practice-exams/*-exam[-v2].md + *-answers[-v2].txt → bank/packs/imported/*.md
// Usage: node scripts/import-practice-exams.ts [--merge | --force] [--dry-run] [--keep-order] [--only <file substring>] [--src <dir>]
// Existing pack files are never overwritten without --force (they may contain fixes made later).
// --merge (for /trainer-import): appends source questions whose id is not in the pack yet and reports
// existing questions whose source differs (stem / options / answer) — it never rewrites them, and it
// refuses a file whose questions were renumbered (ids are positional: 03-v2-31 = Q31 of the V2 file).
// Options get the same canonical order as scripts/rebalance-answers.ts (correct letters spread evenly;
// --keep-order keeps the source order) and letter references in explanations become option text.
// When --force changes the letters of questions that already existed, a migration record is written
// and result files are remapped (server/lib/migrations.ts).
import fs from 'node:fs';
import path from 'node:path';
import { PACKS_DIR, REPO_DIR, rel } from '../server/config.ts';
import { loadTaxonomy } from '../server/lib/taxonomy.ts';
import { classifyDomain, detectFeatures, detectServices, guessTask, topicFromServices } from '../server/lib/classify.ts';
import { assignTargets, canonicalLayout, isIdentity, isPositional, mappingByText, migrateResults, replaceLetterRefs, writeMigration } from '../server/lib/migrations.ts';
import { parsePack, serializePack, serializeQuestion, type QuestionDraft } from '../server/lib/pack-format.ts';
import { stringifyFrontMatter } from '../server/lib/frontmatter.ts';
import { localDateKey } from '../server/lib/time.ts';
import { estimateQuestionTime } from '../shared/timing.ts';
import type { Difficulty, DomainId, Question } from '../shared/types.ts';

const argv = process.argv.slice(2);
const args = new Set(argv);
const FORCE = args.has('--force');
const MERGE = args.has('--merge');
const DRY = args.has('--dry-run');
const KEEP_ORDER = args.has('--keep-order');
const srcArg = argv.includes('--src') ? argv[argv.indexOf('--src') + 1] : undefined;
const SRC_DIR = srcArg ? path.resolve(srcArg) : path.join(REPO_DIR, 'practice-exams');
const OUT_DIR = path.join(PACKS_DIR, 'imported');
if (FORCE && MERGE) {
  console.error('Chọn --merge (chỉ thêm câu mới) hoặc --force (ghi đè cả pack), không dùng cả hai.');
  process.exit(2);
}

const CHAPTERS: Record<string, { topic: string | null; domain: DomainId; bonus: number }> = {
  '01': { topic: 'compute', domain: 'performance', bonus: 1 },
  '02': { topic: 'storage', domain: 'performance', bonus: 1 },
  '03': { topic: 'database', domain: 'resilient', bonus: 1 },
  '04': { topic: 'networking', domain: 'performance', bonus: 1 },
  '05': { topic: 'security', domain: 'secure', bonus: 3 },
  '06': { topic: 'management', domain: 'secure', bonus: 1 },
  '07': { topic: 'integration', domain: 'resilient', bonus: 2 },
  '08': { topic: 'devtools', domain: 'resilient', bonus: 1 },
  '09': { topic: 'analytics', domain: 'performance', bonus: 1 },
  '10': { topic: 'migration', domain: 'performance', bonus: 1 },
  '11': { topic: 'api', domain: 'performance', bonus: 1 },
  '12': { topic: 'ml', domain: 'performance', bonus: 1 },
  '13': { topic: 'other', domain: 'resilient', bonus: 1 },
  '14': { topic: null, domain: 'performance', bonus: 1 }, // service comparisons → topic from services
  '15': { topic: 'resilience', domain: 'resilient', bonus: 3 },
  '16': { topic: 'cost', domain: 'cost', bonus: 3 },
  '17': { topic: null, domain: 'secure', bonus: 1 }, // gap services → topic from services
};

interface RawQ {
  n: number;
  stem: string;
  options: { key: string; text: string }[];
  part?: string; // A = applied (medium), B, C… = harder parts (hard)
}

function parseExam(text: string): { title: string; questions: RawQ[] } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let title = '';
  let part: string | undefined;
  const questions: RawQ[] = [];
  let cur: RawQ | undefined;
  for (const line of lines) {
    if (!title && line.startsWith('# ')) title = line.slice(2).trim();
    const ph = line.match(/^##\s+Part\s+([A-Z])\b/i);
    if (ph) part = ph[1].toUpperCase();
    const qm = line.match(/^\*\*(\d+)\.\*\*\s+(.*)$/);
    if (qm) {
      cur = { n: Number(qm[1]), stem: qm[2].trim(), options: [], part };
      questions.push(cur);
      continue;
    }
    const om = line.match(/^- ([A-H])\.\s+(.*)$/);
    if (om && cur) cur.options.push({ key: om[1], text: om[2].trim() });
  }
  return { title, questions };
}

function parseAnswers(text: string): Map<number, { keys: string[]; explanation: string }> {
  const map = new Map<number, { keys: string[]; explanation: string }>();
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const m = line.match(/^(\d+)_([A-H]+)\s*-\s*(.*)$/);
    if (m) map.set(Number(m[1]), { keys: [...m[2]].sort(), explanation: m[3].trim() });
  }
  return map;
}

function cleanTitle(h1: string, ch: string, version: string): string {
  const core = h1
    .replace(/^[^A-Za-z]+/, '')
    .replace(/Practice Exam\s+\d+\s*[—–-]\s*/i, '')
    .replace(/\(SAA-C03\)/i, '')
    .replace(/·\s*V\d+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${ch} · ${core} · ${version.toUpperCase()}`;
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const textsOf = (opts: { key: string; text: string }[], keys?: string[]) =>
  opts
    .filter((o) => !keys || keys.includes(o.key))
    .map((o) => norm(o.text))
    .sort()
    .join('\n');

/** What the source question changes compared with the bank copy (letters ignored: the bank order is canonical). */
function sourceDiff(d: QuestionDraft, q: Question): string[] {
  const out: string[] = [];
  if (norm(d.stem) !== norm(q.stem)) out.push('đề');
  if (textsOf(d.options) !== textsOf(q.options)) out.push('lựa chọn');
  if (textsOf(d.options, d.answer) !== textsOf(q.options, q.answer)) out.push('đáp án');
  // an ENRICH-ed explanation is meant to differ from the one-line source explanation
  if (!q.enriched && norm(d.explanation) !== norm(q.explanation)) out.push('giải thích');
  return out;
}

/** --merge: append the new questions to an existing pack, report the ones whose source changed. */
function mergeIntoPack(f: string, outFile: string, drafts: QuestionDraft[], report: string[]): number {
  const before = fs.readFileSync(outFile, 'utf8');
  const current = parsePack(before, rel(outFile), tax).questions;
  const byId = new Map(current.map((q) => [q.id, q]));
  const idByStem = new Map(current.map((q) => [norm(q.stem), q.id]));
  const moved = drafts.filter((d) => idByStem.has(norm(d.stem)) && idByStem.get(norm(d.stem)) !== d.id);
  if (moved.length) {
    const ex = moved.slice(0, 3).map((d) => `${d.source?.split('#')[1] ?? d.id} = \`${idByStem.get(norm(d.stem))}\``);
    report.push(
      `✗ ${f}: câu trong nguồn đã bị đánh số lại (${ex.join(', ')}) — KHÔNG gộp file này. Id câu theo số thứ tự (kết quả cũ tham chiếu id), nên chỉ thêm câu mới vào CUỐI đề; đưa số thứ tự về như cũ rồi chạy lại.`,
    );
    return 0;
  }
  for (const d of drafts) {
    const q = byId.get(d.id);
    const diff = q ? sourceDiff(d, q) : [];
    if (q && diff.length) report.push(`~ ${d.id} [base ${q.hash}]${q.enriched ? ' (đã ENRICH)' : ''}: nguồn khác ngân hàng ở ${diff.join(', ')} — ${d.source}`);
  }
  const today = localDateKey(new Date());
  const fresh = drafts.filter((d) => !byId.has(d.id)).map((d) => ({ ...d, created: today }));
  if (!fresh.length) return 0;
  let next = `${before.replace(/\s+$/, '')}\n\n---\n\n${fresh.map(serializeQuestion).join('\n---\n\n')}`;
  if (before.includes('\r\n')) next = next.replace(/\r?\n/g, '\r\n'); // keep the file's line endings
  const parsed = parsePack(next, rel(outFile), tax);
  const errors = parsed.problems.filter((p) => p.level === 'error' && fresh.some((d) => d.id === p.qid));
  if (parsed.questions.length !== current.length + fresh.length || errors.length) {
    report.push(`✗ ${f}: bản gộp không đọc lại được (${errors.map((e) => `${e.qid}: ${e.message}`).join('; ') || 'số câu không khớp'}) — không ghi.`);
    return 0;
  }
  if (!DRY) fs.writeFileSync(outFile, next);
  console.log(`${DRY ? '(dry run) ' : ''}+ ${rel(outFile)}: thêm ${fresh.length} câu — ${fresh.map((d) => d.id).join(', ')}`);
  return fresh.length;
}

const tax = loadTaxonomy();
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : undefined; // e.g. "03-database" or "-exam-v2"
const files = fs
  .readdirSync(SRC_DIR)
  .filter((f) => /^\d{2}-.+-exam(-v2)?\.md$/.test(f) && (!only || f.includes(only)))
  .sort();
if (!DRY) fs.mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
let added = 0; // --merge: questions appended / packs created
const report: string[] = [];
const layoutChanges = new Map<string, { map: Record<string, string>; before: string; after: string }>();
for (const f of files) {
  const m = f.match(/^(\d{2})-(.+)-exam(-v2)?\.md$/)!;
  const [ch, slug, v2] = [m[1], m[2], m[3]];
  const version = v2 ? 'v2' : 'v1';
  const ansFile = `${ch}-${slug}-answers${v2 ?? ''}.txt`;
  const chapter = CHAPTERS[ch];
  if (!chapter) {
    report.push(`skip ${f}: unknown chapter ${ch}`);
    continue;
  }
  const exam = parseExam(fs.readFileSync(path.join(SRC_DIR, f), 'utf8'));
  const answers = parseAnswers(fs.readFileSync(path.join(SRC_DIR, ansFile), 'utf8'));

  const drafts: QuestionDraft[] = [];
  for (const q of exam.questions) {
    const a = answers.get(q.n);
    if (!a) {
      report.push(`${f} Q${q.n}: no answer in ${ansFile}`);
      continue;
    }
    const correctText = q.options.filter((o) => a.keys.includes(o.key)).map((o) => o.text).join(' ');
    const servicesCorrect = detectServices(correctText, tax);
    const services = [...new Set([...servicesCorrect, ...detectServices(q.stem, tax)])];
    const tags = detectFeatures(`${q.stem} ${correctText}`, tax);
    const topic = chapter.topic ?? topicFromServices(servicesCorrect, tax) ?? topicFromServices(services, tax) ?? 'other';
    const domain = classifyDomain(`${q.stem} ${correctText}`, chapter.domain, chapter.bonus);
    let difficulty: Difficulty = version === 'v1' ? 'easy' : q.part && q.part !== 'A' ? 'hard' : 'medium';
    if (a.keys.length > 1 && difficulty === 'easy') difficulty = 'medium';
    const time = estimateQuestionTime({ stem: q.stem, options: q.options, answer: a.keys, difficulty }, tax.timing);
    drafts.push({
      id: `${ch}-${version}-${String(q.n).padStart(2, '0')}`,
      stem: q.stem,
      options: q.options,
      answer: a.keys,
      explanation: a.explanation,
      domain,
      topic,
      services,
      tags,
      difficulty,
      time,
      source: `practice-exams/${f}#Q${q.n}`,
    });
  }

  const packId = `saa-${ch}-${slug}-${version}`;
  // exam-guide task + the canonical layout of scripts/rebalance-answers.ts (a re-import never undoes it)
  const targets = assignTargets(drafts, packId);
  for (const d of drafts) {
    d.task = guessTask(d, tax);
    if (KEEP_ORDER || isPositional(d)) continue;
    d.explanation = replaceLetterRefs(d.explanation, d.options).text;
    const layout = canonicalLayout(d, targets.get(d.id));
    d.options = layout.options;
    d.answer = layout.answer;
  }
  const title = cleanTitle(exam.title, ch, version);
  const outFile = path.join(OUT_DIR, `${ch}-${slug}-${version}.md`);
  if (MERGE && fs.existsSync(outFile)) {
    added += mergeIntoPack(f, outFile, drafts, report);
    continue;
  }
  const intro = [
    `> Imported from \`practice-exams/${f}\` + \`${ansFile}\` by \`scripts/import-practice-exams.ts\`.`,
    `> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.`,
    `> Never rename question ids: results in \`trainer/results/\` reference them.`,
  ].join('\n');
  const text = serializePack(
    { pack: packId, title, origin: 'imported', source: `practice-exams/${f}`, created: new Date().toISOString().slice(0, 10) },
    intro,
    drafts,
    (d) => stringifyFrontMatter(d),
  );

  // round-trip check: the generated file must parse back to the same questions
  const parsed = parsePack(text, rel(outFile), tax);
  for (const p of parsed.problems) report.push(`${p.level.toUpperCase()} ${p.file}:${p.line} ${p.qid ?? ''} ${p.message}`);
  if (parsed.questions.length !== drafts.length) report.push(`ROUND-TRIP MISMATCH ${f}: ${drafts.length} → ${parsed.questions.length}`);

  total += drafts.length;
  if (fs.existsSync(outFile) && FORCE) {
    // letters of existing questions that move → migration record, so result files follow
    const fresh = new Map(parsed.questions.map((q) => [q.id, q]));
    for (const old of parsePack(fs.readFileSync(outFile, 'utf8'), rel(outFile), tax).questions) {
      const now = fresh.get(old.id);
      if (!now) continue;
      const map = mappingByText(old.options, now.options);
      if (!map) report.push(`${old.id}: option texts changed in the source — stored results keep their letters`);
      else if (!isIdentity(map)) layoutChanges.set(old.id, { map, before: old.answer.join(''), after: now.answer.join('') });
    }
  }
  if (DRY) continue;
  if (fs.existsSync(outFile) && !FORCE) {
    report.push(`exists, kept: ${rel(outFile)} (use --force to overwrite)`);
    continue;
  }
  fs.writeFileSync(outFile, text);
  console.log(`✓ ${rel(outFile)}  ${drafts.length} questions`);
  if (MERGE) added += drafts.length;
}

if (MERGE) {
  console.log(`\nGộp ${files.length} file đề: +${added} câu mới${DRY ? ' (dry run — chưa ghi gì)' : ''}.`);
  const others = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.md') && !/^\d{2}-.+-exam(-v2)?\.md$/.test(f) && !/^(README|00-)/i.test(f));
  if (others.length) report.push(`ℹ️  Không phải đề trắc nghiệm (import bỏ qua — dùng làm nguồn cho /trainer-generate được): ${others.join(', ')}`);
} else console.log(`\nImported ${total} questions from ${files.length} exam files${DRY ? ' (dry run)' : ''}.`);
if (layoutChanges.size) {
  if (DRY) console.log(`${layoutChanges.size} existing question(s) would change option letters (a migration record would be written).`);
  else {
    const rec = writeMigration('import-layout', {
      kind: 'import-layout',
      note: 'Re-import changed the option order of existing questions (scripts/import-practice-exams.ts --force): old → new letters.',
      questions: Object.fromEntries([...layoutChanges].map(([id, c]) => [id, c.map])),
      answers: Object.fromEntries([...layoutChanges].map(([id, c]) => [id, [c.before, c.after] as [string, string]])),
    });
    const m = migrateResults();
    console.log(`Migration ${rec.id}: ${layoutChanges.size} question(s) changed letters · ${m.migrated} result file(s) remapped.`);
  }
}
if (report.length) console.log('\n' + report.join('\n'));
