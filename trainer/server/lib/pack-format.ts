// Parser + serializer for question packs (bank/packs/**/*.md). The format is specified in
// bank/SCHEMA.md — keep both in sync. The parser is deliberately lenient about cosmetics
// (bold markers, blockquotes, checkboxes) and strict about content (ids, keys, metadata).
import path from 'node:path';
import crypto from 'node:crypto';
import { asString, asStringList, splitFrontMatter } from './frontmatter.ts';
import { normalizeDomain } from './taxonomy.ts';
import { countWords, estimateQuestionTime } from '../../shared/timing.ts';
import type {
  BankProblem,
  Difficulty,
  Option,
  Pack,
  PackOrigin,
  Question,
  QuestionStatus,
  Taxonomy,
} from '../../shared/types.ts';

export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const Q_HEADING = /^##\s+Q:?\s+(\S+)(.*)$/;
const OTHER_HEADING = /^#{1,2}\s/;
const META_LINE = /^\s*[-*]\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/;
const OPTION_LINE = /^\s*[-*]\s+(?:\[([ xX])\]\s+)?([A-H])[.)]\s+(.*)$/;
const CHOOSE_RE = /\((?:Choose|Select)\s+(TWO|THREE|FOUR|2|3|4)\)/i;

export const META_KEYS = [
  'domain',
  'topic',
  'services',
  'tags',
  'difficulty',
  'time',
  'variant_of',
  'concept',
  'refs',
  'status',
  'created',
  'source',
  'task',
  'hint',
  'enriched',
] as const;

/** Short content hash of what a learner sees + the key — used as `base` in AI patches and to detect edits. */
export function questionHash(stem: string, options: Option[], answer: string[]): string {
  const src = `${stem.trim()}\n${options.map((o) => `${o.key}. ${o.text.trim()}`).join('\n')}\n${[...answer].sort().join('')}`;
  return crypto.createHash('sha1').update(src).digest('hex').slice(0, 10);
}

/** Option-letter references in an explanation break when options are shuffled for display. */
export const LETTER_REF_RE = /(^|\n)\s*[-*]?\s*\(?[A-H]\)?\s*[:.)–—-]\s|\b(?:[Oo]ption|[Aa]nswer|[Cc]hoice|[Đđ]áp án)\s+[A-H]\b|=\s*[A-H]\b(?![’'])|\([A-H]\)/; // uppercase letters only — "answer a few" is prose

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const STATUSES: QuestionStatus[] = ['active', 'draft', 'retired'];
const ORIGINS: PackOrigin[] = ['imported', 'ai', 'doc', 'manual'];

export interface ParsedPack {
  pack: Pack;
  questions: Question[];
  problems: BankProblem[];
}

function originFromPath(file: string): PackOrigin {
  const parts = file.split('/');
  const dir = parts[parts.length - 2] ?? '';
  if (dir === 'ai') return 'ai';
  if (dir === 'docs') return 'doc';
  if (dir === 'imported') return 'imported';
  return 'manual';
}

/** Accepts `90`, `90s`, `1m30s`, `1:30`. */
export function parseSeconds(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  let m = s.match(/^(\d+)\s*s?$/);
  if (m) return Number(m[1]);
  m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(?:(\d+)\s*m(?:in)?)?\s*(?:(\d+)\s*s)?$/);
  if (m && (m[1] || m[2])) return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
  return undefined;
}

function cleanLine(line: string): string {
  return line.replace(/^\s*>\s?/, '').replace(/\*\*|__/g, '').trim();
}

function parseAnswerValue(value: string): string[] {
  const m = value.trim().match(/^([A-H](?:(?:\s*[,&/+;]\s*|\s+and\s+|\s+)?[A-H])*)(?![A-Za-z])/);
  if (!m) return [];
  return [...new Set(m[1].match(/[A-H]/g) ?? [])].sort();
}

function trimBlank(lines: string[]): string[] {
  let a = 0;
  let b = lines.length;
  while (a < b && !lines[a].trim()) a++;
  while (b > a && (!lines[b - 1].trim() || /^\s*(---|\*\*\*|___)\s*$/.test(lines[b - 1]))) b--;
  return lines.slice(a, b);
}

interface RawBlock {
  id: string;
  line: number;
  lines: string[];
}

export function parsePack(text: string, file: string, tax: Taxonomy): ParsedPack {
  const problems: BankProblem[] = [];
  const fm = splitFrontMatter(text);
  const fileBase = path.basename(file, '.md');
  if (fm.error) problems.push({ level: 'error', file, line: 1, message: fm.error });
  if (!fm.hasFrontMatter) problems.push({ level: 'warning', file, line: 1, message: 'Missing front matter (pack/title/origin) — using file name as pack id' });

  const d = fm.data;
  const packId = asString(d.pack) ?? fileBase;
  if (!ID_RE.test(packId)) problems.push({ level: 'error', file, line: 1, message: `Invalid pack id "${packId}" (kebab-case a-z0-9)` });
  const originRaw = asString(d.origin) as PackOrigin | undefined;
  const origin: PackOrigin = originRaw && ORIGINS.includes(originRaw) ? originRaw : originFromPath(file);
  if (originRaw && !ORIGINS.includes(originRaw)) problems.push({ level: 'warning', file, line: 1, message: `Unknown origin "${originRaw}" → ${origin}` });
  const defaults = (d.defaults && typeof d.defaults === 'object' ? d.defaults : {}) as Record<string, unknown>;

  // ── split body into question blocks
  const lines = fm.body.split('\n');
  const blocks: RawBlock[] = [];
  let current: RawBlock | undefined;
  let h1: string | undefined;
  lines.forEach((line, i) => {
    const lineNo = fm.bodyLine + i;
    const qh = line.match(Q_HEADING);
    if (qh) {
      current = { id: qh[1].trim(), line: lineNo, lines: [] };
      blocks.push(current);
      return;
    }
    if (OTHER_HEADING.test(line)) {
      if (!h1 && /^#\s/.test(line)) h1 = line.replace(/^#\s+/, '').trim();
      current = undefined;
      return;
    }
    current?.lines.push(line);
  });

  const title = asString(d.title) ?? h1 ?? fileBase;
  const questions: Question[] = [];
  for (const b of blocks) {
    const q = parseBlock(b, { file, packId, origin, defaults, tax, problems });
    if (q) questions.push(q);
  }
  if (!blocks.length) problems.push({ level: 'warning', file, line: 1, message: 'No questions found (expected headings like "## Q my-id-01")' });
  const singles = questions.filter((q) => q.answer.length === 1);
  if (origin !== 'imported' && singles.length >= 8) {
    const counts = new Map<string, number>();
    for (const q of singles) counts.set(q.answer[0], (counts.get(q.answer[0]) ?? 0) + 1);
    const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (n / singles.length > 0.45) problems.push({ level: 'warning', file, line: 1, message: `Correct answers are skewed: ${top} in ${n}/${singles.length} single-answer questions — spread them across A–D` });
  }

  const pack: Pack = {
    id: packId,
    title,
    file,
    origin,
    exam: asString(d.exam) ?? 'SAA-C03',
    description: asString(d.description),
    source: asString(d.source),
    created: asString(d.created)?.slice(0, 10),
    generatedBy: asString(d.generated_by),
    count: questions.length,
    activeCount: questions.filter((q) => q.status === 'active').length,
  };
  return { pack, questions, problems };
}

interface Ctx {
  file: string;
  packId: string;
  origin: PackOrigin;
  defaults: Record<string, unknown>;
  tax: Taxonomy;
  problems: BankProblem[];
}

function parseBlock(b: RawBlock, ctx: Ctx): Question | undefined {
  const { file, tax, problems } = ctx;
  const err = (message: string, line = b.line) => problems.push({ level: 'error', file, line, qid: b.id, message });
  const warn = (message: string, line = b.line) => problems.push({ level: 'warning', file, line, qid: b.id, message });

  if (!ID_RE.test(b.id) || b.id.length < 3 || b.id.length > 60) err(`Invalid question id "${b.id}" (kebab-case a-z0-9, 3–60 chars)`);

  const meta: Record<string, string> = {};
  const stem: string[] = [];
  const options: (Option & { checked: boolean })[] = [];
  const between: number[] = [];
  const explanation: string[] = [];
  let answer: string[] | undefined;
  let answerLine = 0;
  let quoted = false;
  let phase: 'meta' | 'stem' | 'options' | 'after' | 'explanation' = 'meta';

  b.lines.forEach((line, i) => {
    const lineNo = b.line + 1 + i;
    if (phase === 'meta') {
      if (!line.trim() && !Object.keys(meta).length) return;
      const mm = line.match(META_LINE);
      if (mm && !OPTION_LINE.test(line)) {
        const key = mm[1].toLowerCase();
        if (!(META_KEYS as readonly string[]).includes(key)) warn(`Unknown metadata key "${key}"`, lineNo);
        meta[key] = mm[2].trim();
        return;
      }
      if (!line.trim()) {
        phase = 'stem';
        return;
      }
      phase = 'stem';
    }
    if (phase === 'stem') {
      const om = line.match(OPTION_LINE);
      if (om) {
        phase = 'options';
      } else {
        stem.push(line);
        return;
      }
    }
    if (phase === 'options') {
      const om = line.match(OPTION_LINE);
      if (om) {
        options.push({ key: om[2], text: om[3].trim(), checked: om[1]?.toLowerCase() === 'x' });
        return;
      }
      if (!line.trim()) return;
      if (/^\s{2,}\S/.test(line) && options.length) {
        options[options.length - 1].text += ' ' + line.trim();
        return;
      }
      phase = 'after';
    }
    if (phase === 'after') {
      const c = cleanLine(line);
      const am = c.match(/^(answer|correct answer|correct|đáp án)\s*[:：]\s*(.*)$/i);
      if (am && !answer) {
        answer = parseAnswerValue(am[2]);
        answerLine = lineNo;
        quoted = /^\s*>/.test(line);
        phase = 'explanation';
        return;
      }
      const em = c.match(/^(explanation|giải thích)\s*[:：]\s*(.*)$/i);
      if (em) {
        quoted = /^\s*>/.test(line);
        if (em[2]) explanation.push(em[2]);
        phase = 'explanation';
        return;
      }
      if (line.trim() && !/^\s*(---|\*\*\*|___)\s*$/.test(line)) between.push(lineNo);
      return;
    }
    // explanation
    let l = line;
    if (quoted) l = l.replace(/^\s*>\s?/, '');
    if (!explanation.length || explanation.every((x) => !x.trim())) {
      const em = cleanLine(l).match(/^(explanation|giải thích|why)\s*[:：]\s*(.*)$/i);
      if (em) {
        if (em[2]) explanation.push(em[2]);
        return;
      }
    }
    explanation.push(l);
  });

  if (between.length) warn(`Unexpected text between options and the answer line (line ${between[0]}) — check option format "- A. text"`, between[0]);

  const stemText = trimBlank(stem).join('\n').trim();
  if (!stemText) err('Empty question stem');

  if (options.length < 2) err(`Expected at least 2 options "- A. text" (found ${options.length})`);
  else if (options.length < 3) warn('Only 2 options — SAA-C03 questions have 4 (single) or 5+ (multiple-response)');
  options.forEach((o, i) => {
    const expected = String.fromCharCode(65 + i);
    if (o.key !== expected) err(`Option keys must be consecutive A, B, C…: got "${o.key}" at position ${i + 1}`);
    if (!o.text) err(`Option ${o.key} is empty`);
  });

  if (!answer || !answer.length) {
    const checked = options.filter((o) => o.checked).map((o) => o.key);
    if (checked.length) answer = checked.sort();
  }
  if (!answer || !answer.length) err('Missing answer line "**Answer:** B"', answerLine || b.line);
  const keys = new Set(options.map((o) => o.key));
  for (const a of answer ?? []) if (!keys.has(a)) err(`Answer "${a}" is not one of the options`, answerLine || b.line);

  const choose = stemText.match(CHOOSE_RE);
  if (choose && answer?.length) {
    const want = { TWO: 2, THREE: 3, FOUR: 4, '2': 2, '3': 3, '4': 4 }[choose[1].toUpperCase() as 'TWO'] ?? 0;
    if (want !== answer.length) err(`Stem says "${choose[0]}" but the answer has ${answer.length} key(s): ${answer.join(', ')}`, answerLine || b.line);
  } else if (answer && answer.length > 1) {
    warn('Multiple-response question should say "(Choose TWO)" / "(Choose THREE)" in the stem');
  }

  const explanationText = trimBlank(explanation).join('\n').trim();
  if (!explanationText) warn('Missing explanation (**Explanation:** …) — learners rely on it in the review screen');

  // ── metadata (question overrides pack defaults)
  const get = (k: string): string | undefined => meta[k] ?? asString(ctx.defaults[k]);
  const getList = (k: string): string[] => (k in meta ? asStringList(meta[k]) : asStringList(ctx.defaults[k]));

  const domain = normalizeDomain(get('domain'));
  if (!domain) err(`Missing/invalid domain "${get('domain') ?? ''}" (secure | resilient | performance | cost)`);
  const topic = get('topic') ?? '';
  if (!tax.topics.some((t) => t.id === topic)) err(`Missing/unknown topic "${topic}" (see taxonomy.yaml topics)`);
  const difficulty = (get('difficulty') ?? 'medium').toLowerCase() as Difficulty;
  if (!DIFFICULTIES.includes(difficulty)) err(`Invalid difficulty "${difficulty}" (easy | medium | hard)`);
  const status = (get('status') ?? 'active').toLowerCase() as QuestionStatus;
  if (!STATUSES.includes(status)) err(`Invalid status "${status}" (active | draft | retired)`);

  const services = getList('services');
  for (const s of services) if (!tax.services[s]) warn(`Service "${s}" is not in taxonomy.yaml (stats still work; add it there for topic mapping)`);
  const tags = getList('tags');
  for (const t of tags) if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t)) warn(`Tag "${t}" should be kebab-case`);

  const opts: Option[] = options.map(({ key, text }) => ({ key, text }));
  const timeRaw = get('time');
  let time = parseSeconds(timeRaw);
  const rubricTime = estimateQuestionTime({ stem: stemText, options: opts, answer: answer ?? [], difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : 'medium' }, tax.timing);
  let timeEstimated = false;
  if (timeRaw && time === undefined) err(`Invalid time "${timeRaw}" (seconds, e.g. 90)`);
  if (time === undefined) {
    time = rubricTime;
    timeEstimated = true;
    if (!timeRaw) warn(`Missing "time" — estimated ${rubricTime}s by the rubric`);
  } else if (time < 20 || time > 600) {
    err(`time ${time}s is out of range 20–600`);
  } else if (time > rubricTime * 2 || time < rubricTime / 2) {
    warn(`time ${time}s is far from the rubric estimate ${rubricTime}s (SCHEMA.md §4)`);
  }

  const task = get('task');
  if (task) {
    const def = tax.tasks?.find((t) => t.id === task);
    if (!def) err(`Unknown task "${task}" (taxonomy.yaml → tasks: 1.1 … 4.4)`);
    else if (domain && def.domain !== domain) warn(`task ${task} belongs to domain ${def.domain}, but domain is ${domain}`);
  }
  if (explanationText && LETTER_REF_RE.test(explanationText.replace(/\*\*Answer:?\*\*.*$/m, ''))) {
    warn('Explanation refers to option letters (A/B/…) — options can be shuffled; refer to the option content instead');
  }
  const single = answer?.length === 1 ? answer[0] : undefined;
  if (ctx.origin !== 'imported' && single && options.length >= 3) {
    const len = (k: string) => options.find((o) => o.key === k)?.text.length ?? 0;
    const correct = len(single);
    const others = options.filter((o) => o.key !== single).map((o) => o.text.length);
    if (others.length && correct > Math.max(...others) * 1.3 && correct - Math.max(...others) >= 15) {
      warn('Correct option is much longer than every distractor (length gives the answer away) — balance option lengths');
    }
  }

  if (!domain || !answer?.length || options.length < 2 || !stemText) return undefined;

  const words = countWords(stemText);
  return {
    id: b.id,
    pack: ctx.packId,
    stem: stemText,
    options: opts,
    answer,
    explanation: explanationText,
    domain,
    topic,
    services,
    tags,
    difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : 'medium',
    time,
    timeEstimated,
    status: STATUSES.includes(status) ? status : 'active',
    origin: ctx.origin,
    variantOf: getList('variant_of'),
    concept: get('concept'),
    refs: getList('refs'),
    created: get('created'),
    source: get('source'),
    task: task || undefined,
    hint: get('hint') || undefined,
    enriched: get('enriched') || undefined,
    words,
    longForm: words >= (tax.timing.long_form_min_words ?? 55),
    hash: questionHash(stemText, opts, answer ?? []),
    file,
    line: b.line,
  };
}

// ── serializer ──────────────────────────────────────────────────────────────

export interface QuestionDraft {
  id: string;
  stem: string;
  options: Option[];
  answer: string[];
  explanation: string;
  domain: string;
  topic: string;
  services?: string[];
  tags?: string[];
  difficulty: Difficulty;
  time: number;
  variantOf?: string[];
  concept?: string;
  refs?: string[];
  status?: QuestionStatus;
  created?: string;
  source?: string;
  task?: string;
  hint?: string;
  enriched?: string;
}

export function serializeQuestion(q: QuestionDraft): string {
  const out: string[] = [`## Q ${q.id}`];
  out.push(`- domain: ${q.domain}`);
  if (q.task) out.push(`- task: ${q.task}`);
  out.push(`- topic: ${q.topic}`);
  if (q.services?.length) out.push(`- services: ${q.services.join(', ')}`);
  if (q.tags?.length) out.push(`- tags: ${q.tags.join(', ')}`);
  out.push(`- difficulty: ${q.difficulty}`);
  out.push(`- time: ${q.time}`);
  if (q.variantOf?.length) out.push(`- variant_of: ${q.variantOf.join(', ')}`);
  if (q.concept) out.push(`- concept: ${q.concept}`);
  if (q.refs?.length) out.push(`- refs: ${q.refs.join(', ')}`);
  if (q.hint) out.push(`- hint: ${q.hint.replace(/\s+/g, ' ').trim()}`);
  if (q.status && q.status !== 'active') out.push(`- status: ${q.status}`);
  if (q.created) out.push(`- created: ${q.created}`);
  if (q.enriched) out.push(`- enriched: ${q.enriched}`);
  if (q.source) out.push(`- source: ${q.source}`);
  out.push('', q.stem.trim(), '');
  for (const o of q.options) out.push(`- ${o.key}. ${o.text.trim()}`);
  out.push('', `**Answer:** ${q.answer.join(', ')}`, '');
  const [first, ...rest] = q.explanation.trim().split('\n');
  out.push(`**Explanation:** ${first ?? ''}`);
  if (rest.length) out.push(...rest);
  return out.join('\n') + '\n';
}

export function serializePack(
  meta: { pack: string; title: string; origin: PackOrigin; exam?: string; source?: string; created?: string; description?: string; generated_by?: string },
  intro: string,
  questions: QuestionDraft[],
  stringifyFm: (data: Record<string, unknown>) => string,
): string {
  const data: Record<string, unknown> = { pack: meta.pack, title: meta.title, exam: meta.exam ?? 'SAA-C03', origin: meta.origin };
  if (meta.source) data.source = meta.source;
  if (meta.created) data.created = meta.created;
  if (meta.generated_by) data.generated_by = meta.generated_by;
  if (meta.description) data.description = meta.description;
  const parts = [stringifyFm(data), `# ${meta.title}`, ''];
  if (intro.trim()) parts.push(intro.trim(), '');
  parts.push(questions.map(serializeQuestion).join('\n---\n\n'));
  return parts.join('\n');
}

/** Converts a parsed question back to a serializable draft (defaults become explicit metadata). */
export function toDraft(q: Question): QuestionDraft {
  return {
    id: q.id,
    stem: q.stem,
    options: q.options.map((o) => ({ ...o })),
    answer: [...q.answer],
    explanation: q.explanation,
    domain: q.domain,
    topic: q.topic,
    services: [...q.services],
    tags: [...q.tags],
    difficulty: q.difficulty,
    time: q.time,
    variantOf: [...q.variantOf],
    concept: q.concept,
    refs: [...q.refs],
    status: q.status,
    created: q.created,
    source: q.source,
    task: q.task,
    hint: q.hint,
    enriched: q.enriched,
  };
}
