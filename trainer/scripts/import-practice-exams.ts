// One-off migration: practice-exams/*-exam[-v2].md + *-answers[-v2].txt → bank/packs/imported/*.md
// Usage: node scripts/import-practice-exams.ts [--force] [--dry-run] [--keep-order]
// Existing pack files are never overwritten without --force (they may contain fixes made later).
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
import { parsePack, serializePack, type QuestionDraft } from '../server/lib/pack-format.ts';
import { stringifyFrontMatter } from '../server/lib/frontmatter.ts';
import { estimateQuestionTime } from '../shared/timing.ts';
import type { Difficulty, DomainId } from '../shared/types.ts';

const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const DRY = args.has('--dry-run');
const KEEP_ORDER = args.has('--keep-order');
const SRC_DIR = path.join(REPO_DIR, 'practice-exams');
const OUT_DIR = path.join(PACKS_DIR, 'imported');

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
  part?: 'A' | 'B';
}

function parseExam(text: string): { title: string; questions: RawQ[] } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let title = '';
  let part: 'A' | 'B' | undefined;
  const questions: RawQ[] = [];
  let cur: RawQ | undefined;
  for (const line of lines) {
    if (!title && line.startsWith('# ')) title = line.slice(2).trim();
    const ph = line.match(/^##\s+Part\s+([AB])\b/i);
    if (ph) part = ph[1].toUpperCase() as 'A' | 'B';
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

const tax = loadTaxonomy();
const files = fs.readdirSync(SRC_DIR).filter((f) => /^\d{2}-.+-exam(-v2)?\.md$/.test(f)).sort();
if (!DRY) fs.mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
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
    let difficulty: Difficulty = version === 'v1' ? 'easy' : q.part === 'B' ? 'hard' : 'medium';
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
}

console.log(`\nImported ${total} questions from ${files.length} exam files${DRY ? ' (dry run)' : ''}.`);
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
