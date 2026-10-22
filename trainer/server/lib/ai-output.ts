// Structured output for the AI tasks that write to the bank — generate, enrich (ENRICH maintenance batch) and longform.
// With `coach.structured_output: true` the CLI runs with read-only tools and `--json-schema`: the model answers through
// its StructuredOutput tool and the app does the writing, so every file is produced by our serializers and checked first:
//   enrich            → coach/patches/<runId>.yaml (audit trail, SCHEMA.md §8) → applyPatch (base, field rules, re-parse,
//                       option letters, lint)
//   generate/longform → one new pack written with serializePack after per-question checks (schema, parse, option
//                       letters, hint, lint, ids)
// The runner sends the failures back once (`--resume <session_id>`); whatever still fails is skipped and reported.
// [v5] γ2: `twins` (paraphrase / contrast siblings of questions due soon, `variant_of` = the original) and `family`
// (qualifier families: one scenario + one shared option set, 2–4 final questions with different requirements and keys,
// `family: <id>`) are packs too; generate / longform may target exam-guide bullets (`skills`). Questions a pack adds are
// recorded for "↩️ Hoàn tác" (undo.ts) before the pack is written.
// [v6] New medium / hard questions are exam-spec (lint.ts isExamSpec): the exam-spec lint rules come back from checkDraft
// as warnings (never a rejection — only high-severity flaws reject); a rejected question carries its medium ones into
// the repair round (ItemFailure.warnings, examSpecWarnings) so the model fixes them along the way.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { PACKS_DIR, REPO_DIR, rel } from '../config.ts';
import { stemRequirements, type BankState } from './bank.ts';
import { stringifyFrontMatter } from './frontmatter.ts';
import { correctIsLongest, hintReveals, lintDelta, type LintFn } from './patch.ts';
import { LINT_RULES, familyFlaws } from './lint.ts';
import { CHOOSE_RE, ID_RE, LETTER_REF_RE, SKILL_ID_RE, parsePack, serializePack, type QuestionDraft } from './pack-format.ts';
import { normalizeDomain } from './taxonomy.ts';
import { recordCreated } from './undo.ts';
import { countWords, estimateQuestionTime } from '../../shared/timing.ts';
import type { Difficulty, PackOrigin, Question, Taxonomy } from '../../shared/types.ts';

export const MIN_EXPLANATION_WORDS = 25; // same bar as ENRICH `explain`
export const MAX_NEW_QUESTIONS = 60;

// ── JSON schemas (`--json-schema`) ──────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const DOMAINS = ['secure', 'resilient', 'performance', 'cost'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const strList = (description?: string) => ({ type: 'array', items: { type: 'string' }, ...(description ? { description } : {}) });

/** ENRICH: one item per batch question, keys = patch items of SCHEMA.md §8 (`base` is filled in by the app). */
export const ENRICH_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      description: 'Đúng một item cho mỗi câu trong lô. Item chỉ có `id` = đã duyệt, không cần đổi gì.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          set: {
            type: 'object',
            description: 'Chỉ các metadata cần đổi',
            properties: {
              domain: { type: 'string', enum: DOMAINS },
              task: { type: 'string', description: 'task statement 1.1–4.4, cùng domain' },
              topic: { type: 'string' },
              services: strList('tên chuẩn trong taxonomy.yaml → services, ≤ 4'),
              tags: strList('kebab-case, ≤ 4'),
              difficulty: { type: 'string', enum: DIFFICULTIES },
              concept: { type: 'string' },
              refs: strList(),
              hint: { type: 'string', description: '1 dòng tiếng Việt ≤ 140 ký tự, không lộ đáp án' },
              variant_of: strList(),
              skills: strList('mục đề cương (exam guide) câu thật sự kiểm tra, vd "3.5.s7" — 1–3 mục'),
            },
            additionalProperties: false,
          },
          explanation: { type: 'string', description: 'giải thích mới (Markdown, gọi lựa chọn bằng nội dung, không bằng chữ cái)' },
          options: {
            type: 'object',
            description: 'chỉ các lựa chọn cần thay nội dung, vd { "A": "…" } — không thêm/bớt lựa chọn',
            properties: Object.fromEntries(LETTERS.map((k) => [k, { type: 'string' }])),
            additionalProperties: false,
          },
          stem: { type: 'string', description: 'hiếm: đề đã sửa (tối thiểu)' },
          answer: { type: 'array', items: { type: 'string', enum: LETTERS }, description: 'hiếm: đáp án mới — bắt buộc kèm reason' },
          reason: { type: 'string', description: 'bằng chứng khi đổi answer' },
          status: { type: 'string', enum: ['active', 'draft', 'retired'] },
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
    summary: { type: 'string', description: '2–4 dòng tóm tắt tiếng Việt' },
  },
  required: ['items', 'summary'],
  additionalProperties: false,
} as const;

const QUESTION_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'chỉ ghi ở vòng sửa lỗi: id app đã gán cho câu' },
    domain: { type: 'string', enum: DOMAINS },
    task: { type: 'string', description: 'task statement 1.1–4.4, cùng domain' },
    topic: { type: 'string', description: 'topic id trong taxonomy.yaml' },
    services: strList('tên chuẩn trong taxonomy.yaml → services'),
    tags: strList('kebab-case'),
    difficulty: { type: 'string', enum: DIFFICULTIES },
    variant_of: strList('id câu gốc (câu dài: bắt buộc)'),
    concept: { type: 'string' },
    refs: strList('file notes nguồn, vd 03-database-services.md#rds-proxy'),
    skills: strList('mục đề cương (exam guide) câu kiểm tra, vd "3.5.s7" — 1–3 mục; lượt có danh sách mục: ít nhất một mục trong đó'),
    hint: { type: 'string', description: '1 dòng tiếng Việt ≤ 140 ký tự, không lộ đáp án' },
    stem: { type: 'string', description: 'đề tiếng Anh; câu nhiều đáp án ghi "(Choose TWO)"' },
    options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 6, description: 'nội dung các lựa chọn theo thứ tự A, B, C…, không ghi tiền tố "A."' },
    answer: { type: 'array', items: { type: 'string', enum: LETTERS.slice(0, 6) }, minItems: 1, maxItems: 3 },
    explanation: { type: 'string', description: 'vì sao đúng + mỗi distractor một dòng theo nội dung + dòng "> 🇻🇳 …"' },
  },
  required: ['domain', 'task', 'topic', 'services', 'tags', 'difficulty', 'concept', 'hint', 'stem', 'options', 'answer', 'explanation'],
  additionalProperties: false,
} as const;

const PACK_META_SCHEMA = {
  type: 'object',
  properties: {
    slug: { type: 'string', description: '2–4 từ kebab-case mô tả chủ đề' },
    title: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['slug', 'title'],
  additionalProperties: false,
} as const;

/** generate / longform: pack meta + new questions (ids, time, created/enriched are set by the app). */
export const PACK_SCHEMA = {
  type: 'object',
  properties: {
    pack: PACK_META_SCHEMA,
    questions: { type: 'array', items: QUESTION_SCHEMA },
    summary: { type: 'string', description: '3–5 dòng tóm tắt tiếng Việt' },
  },
  required: ['pack', 'questions', 'summary'],
  additionalProperties: false,
} as const;

export const TWIN_KINDS = ['surface', 'contrast'] as const;
export type TwinKind = (typeof TWIN_KINDS)[number];

/** [v5] twins: one sibling per original of the batch — `variant_of` = [original], `kind` = what the batch asked for. */
export const TWINS_SCHEMA = {
  type: 'object',
  properties: {
    pack: PACK_META_SCHEMA,
    questions: {
      type: 'array',
      items: {
        ...QUESTION_SCHEMA,
        properties: {
          ...QUESTION_SCHEMA.properties,
          variant_of: strList('[id câu gốc] — đúng một câu gốc của lô'),
          kind: { type: 'string', enum: [...TWIN_KINDS], description: 'surface = diễn đạt lại (cùng khái niệm, cùng yêu cầu); contrast = đổi một yêu cầu để một phương án nhiễu thành đúng' },
        },
        required: [...QUESTION_SCHEMA.required, 'variant_of', 'kind'],
      },
    },
    summary: { type: 'string', description: '2–4 dòng tóm tắt tiếng Việt' },
  },
  required: ['pack', 'questions', 'summary'],
  additionalProperties: false,
} as const;

/** Requirement categories a family member may ask for (taxonomy.keywords groups, shared/labels.ts REQUIREMENTS minus negative). */
export const FAMILY_ASKS = ['cost', 'ops', 'resilient', 'performance', 'secure'] as const;

const FAMILY_MEMBER_SCHEMA = {
  type: 'object',
  properties: {
    ask: { type: 'string', enum: [...FAMILY_ASKS], description: 'yêu cầu câu hỏi cuối nhấn mạnh: cost | ops | resilient | performance | secure' },
    question: { type: 'string', description: 'CHỈ câu hỏi cuối (tiếng Anh) có qualifier rõ, vd "Which solution meets these requirements MOST cost-effectively?"' },
    answer: { type: 'array', items: { type: 'string', enum: LETTERS.slice(0, 5) }, minItems: 1, maxItems: 2 },
    explanation: { type: 'string', description: 'vì sao lựa chọn này thắng VỚI YÊU CẦU NÀY + các lựa chọn khác theo nội dung + dòng "> 🇻🇳 …"' },
    hint: { type: 'string', description: '1 dòng tiếng Việt ≤ 140 ký tự, không lộ đáp án' },
    domain: { type: 'string', enum: DOMAINS, description: 'tuỳ chọn: domain riêng của câu này (mặc định của họ)' },
    task: { type: 'string', description: 'tuỳ chọn: task riêng của câu này, cùng domain' },
  },
  required: ['ask', 'question', 'answer', 'explanation', 'hint'],
  additionalProperties: false,
} as const;

/** [v5] family: qualifier families — the app writes one question per member (stem = scenario + final question). */
export const FAMILY_SCHEMA = {
  type: 'object',
  properties: {
    pack: PACK_META_SCHEMA,
    families: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'chỉ ghi ở vòng sửa lỗi: id họ app đã gán' },
          domain: { type: 'string', enum: DOMAINS },
          task: { type: 'string', description: 'task statement 1.1–4.4, cùng domain' },
          topic: { type: 'string', description: 'topic id trong taxonomy.yaml' },
          services: strList('tên chuẩn trong taxonomy.yaml → services'),
          tags: strList('kebab-case'),
          difficulty: { type: 'string', enum: DIFFICULTIES },
          concept: { type: 'string' },
          refs: strList('file notes nguồn'),
          skills: strList('mục đề cương (exam guide), vd "2.2.s3"'),
          scenario: { type: 'string', description: 'tình huống chung tiếng Anh 50–110 từ (công ty, kiến trúc, ràng buộc) — KHÔNG có câu hỏi cuối' },
          options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 5, description: 'bộ lựa chọn dùng chung (nội dung theo thứ tự A, B, C…, không tiền tố "A.") — mỗi lựa chọn là giải pháp chạy được' },
          members: { type: 'array', items: FAMILY_MEMBER_SCHEMA, minItems: 2, maxItems: 4 },
        },
        required: ['domain', 'task', 'topic', 'services', 'tags', 'difficulty', 'concept', 'scenario', 'options', 'members'],
        additionalProperties: false,
      },
    },
    summary: { type: 'string', description: '2–4 dòng tóm tắt tiếng Việt' },
  },
  required: ['pack', 'families', 'summary'],
  additionalProperties: false,
} as const;

export type StructuredTask = 'generate' | 'enrich' | 'longform' | 'twins' | 'family';
export const STRUCTURED_TASKS: readonly string[] = ['generate', 'enrich', 'longform', 'twins', 'family'];
/** Tasks whose answer is a new pack (questions, or families → questions). */
export type PackTask = Exclude<StructuredTask, 'enrich'>;

export function schemaFor(task: StructuredTask): Record<string, unknown> {
  return task === 'enrich' ? ENRICH_SCHEMA : task === 'twins' ? TWINS_SCHEMA : task === 'family' ? FAMILY_SCHEMA : PACK_SCHEMA;
}

/** The structured answer of a CLI `result` line: `structured_output`, else the JSON text in `result` (``` fences ok). */
export function structuredOutput(result: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!result) return undefined;
  const asObject = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined);
  const parse = (s: string) => {
    const t = s.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, '$1');
    try {
      return asObject(JSON.parse(t));
    } catch {
      return undefined;
    }
  };
  const so = result.structured_output;
  if (asObject(so)) return so as Record<string, unknown>;
  if (typeof so === 'string') return parse(so);
  return typeof result.result === 'string' ? parse(result.result) : undefined;
}

export interface ItemFailure {
  id: string;
  errors: string[];
  label?: string; // what the id refers to (new questions: start of the stem)
  warnings?: string[]; // [v6] non-blocking flaws to fix along the way (examSpecWarnings of the rejected question)
}

/** [v6] Medium exam-spec lint rules (stem-short, options-bare, no-criterion, explanation-coverage). */
const SPEC_REPAIR_CODES = new Set(LINT_RULES.filter((r) => r.examSpec && r.severity === 'medium').map((r) => r.code));

/** [v6] The medium exam-spec flaws among checkDraft warnings ("lint: … [stem-short]") — what ItemFailure.warnings carries. */
export function examSpecWarnings(warnings: readonly string[]): string[] {
  return warnings.filter((w) => SPEC_REPAIR_CODES.has(/^lint: [\s\S]*\[([a-z]+(?:-[a-z]+)*)(?: · [A-H])?\]$/.exec(w)?.[1] ?? ''));
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Drops what a structured answer uses for "no change": undefined/null, blank strings, empty lists and maps. */
export function prune(v: unknown): unknown {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') return v.trim() ? v : undefined;
  if (Array.isArray(v)) {
    const a = v.map(prune).filter((x) => x !== undefined);
    return a.length ? a : undefined;
  }
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const p = prune(x);
      if (p !== undefined) o[k] = p;
    }
    return Object.keys(o).length ? o : undefined;
  }
  return v;
}

// ── ENRICH: items → audit patch ─────────────────────────────────────────────

/**
 * Patch items from the model's answer: batch questions only (first item per id), `base` = the hash recorded when the
 * batch was written, empty values dropped. Batch questions without an item come back as failures (the repair round
 * asks for them).
 */
export function enrichItems(output: Record<string, unknown> | undefined, bases: Record<string, string>): { items: Record<string, unknown>[]; failures: ItemFailure[]; ignored: string[] } {
  const raw = Array.isArray(output?.items) ? (output!.items as unknown[]) : [];
  const items: Record<string, unknown>[] = [];
  const ignored: string[] = [];
  const seen = new Set<string>();
  for (const it of raw) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) continue;
    const id = String((it as Record<string, unknown>).id ?? '').trim();
    if (!Object.hasOwn(bases, id) || seen.has(id)) {
      ignored.push(id || '?');
      continue;
    }
    seen.add(id);
    const { id: _id, base: _base, ...rest } = (prune(it) ?? {}) as Record<string, unknown>;
    items.push({ id, base: bases[id], ...rest });
  }
  const failures = Object.keys(bases)
    .filter((id) => !seen.has(id))
    .map((id) => ({ id, errors: ['thiếu item cho câu này — trả về { id } nếu câu không cần đổi, hoặc các thay đổi'] }));
  return { items, failures, ignored };
}

/** Replaces / adds the items of `failed` ids with the repaired ones (other ids in the repair answer are ignored). */
export function mergeRepaired(items: Record<string, unknown>[], repaired: Record<string, unknown> | undefined, failed: string[], bases: Record<string, string>): { items: Record<string, unknown>[]; fixed: string[] } {
  const only = Object.fromEntries(failed.filter((id) => Object.hasOwn(bases, id)).map((id) => [id, bases[id]]));
  const fresh = enrichItems(repaired, only).items;
  const byId = new Map(fresh.map((it) => [String(it.id), it]));
  const out = items.map((it) => byId.get(String(it.id)) ?? it);
  for (const it of fresh) if (!items.some((x) => x.id === it.id)) out.push(it);
  return { items: out, fixed: fresh.map((it) => String(it.id)) };
}

/** Writes coach/patches/<runId>.yaml (block literals for explanations / stems, atomic). */
export function writePatchFile(file: string, runId: string, items: Record<string, unknown>[]): void {
  const text = `# Patch do app ghi từ kết quả JSON của lượt ${runId} (coach.structured_output) — định dạng SCHEMA.md §8.\n${YAML.stringify({ run_id: runId, items }, { lineWidth: 0 })}`;
  writeAtomic(file, text);
}

function writeAtomic(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

// ── generate / longform: questions → new pack ───────────────────────────────

export interface PackTarget {
  kind: PackTask;
  runId: string;
  today: string; // YYYY-MM-DD
  sources?: string[]; // generate: files the questions come from
  slug?: string; // generate: slug suggested by the learner
  packFile?: string; // longform / twins / family: repo-relative path with <slug> (prepared with the batch)
  packId?: string; // longform / twins / family
  idPrefix?: string; // longform / twins / family: question ids <idPrefix><nn>
  originals?: string[]; // longform / twins: the questions to write variants of
  batch?: string; // longform / twins / family: batch file (front matter `source`)
  skills?: string[]; // [v5] generate / longform: exam-guide bullets the run targets (params.skills)
  twinKinds?: Record<string, TwinKind>; // [v5] twins: what the batch asked for per original
  familyPrefix?: string; // [v5] family: family ids <familyPrefix><n>
}

export interface PackPlan {
  kind: PackTask;
  packId: string;
  file: string; // absolute
  origin: PackOrigin;
  meta: { pack: string; title: string; origin: PackOrigin; created: string; generated_by: string; source?: string; description?: string };
  idOf: (i: number) => string;
  familyOf: (i: number) => string; // [v5] family task: id of the i-th family
}

/** Pack naming of the tasks that write variants of prepared questions (longform, twins) or families. */
const BATCH_PACKS: Record<Exclude<PackTask, 'generate'>, { word: string; slug: string; title: string; description: string; ids: string }> = {
  longform: { word: 'longform', slug: 'cau-dai', title: 'Câu dài chuẩn đề thi', description: 'Biến thể dài (55–130 từ) của các câu ngắn hay gặp/hay sai', ids: 'lf' },
  twins: { word: 'twins', slug: 'song-sinh', title: 'Câu song sinh', description: 'Câu song sinh (diễn đạt lại / tương phản) của các câu sắp ôn — chống học vẹt', ids: 'tw' },
  family: { word: 'family', slug: 'ho-cau', title: 'Họ câu đổi yêu cầu', description: 'Cùng tình huống, cùng lựa chọn — câu hỏi cuối (yêu cầu) khác nhau thì đáp án khác nhau', ids: 'fa' },
};

/** kebab-case slug from free text (Vietnamese diacritics removed), ≤ 40 chars. */
export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

const nn = (i: number) => String(i + 1).padStart(2, '0');
const str = (v: unknown) => (typeof v === 'string' ? oneLine(v) : '');

/** Pack id, file, front matter and question ids for the new pack (unique in the bank and on disk). */
export function planPack(t: PackTarget, out: Record<string, unknown> | undefined, bank: BankState): PackPlan {
  const meta = (out?.pack && typeof out.pack === 'object' ? out.pack : {}) as Record<string, unknown>;
  const taken = (packId: string, file: string) => bank.packs.some((p) => p.id === packId) || fs.existsSync(file) || bank.questions.some((q) => q.id.startsWith(`${packId}-`));
  if (t.kind === 'generate') {
    const base = slugify(str(meta.slug)) || slugify(t.slug ?? '') || slugify(path.basename(t.sources?.[0] ?? '', path.extname(t.sources?.[0] ?? ''))) || 'tai-lieu';
    let slug = base;
    for (let n = 2; taken(`doc-${slug}`, path.join(PACKS_DIR, 'docs', `${t.today}-${slug}.md`)); n++) slug = `${base}-${n}`;
    const packId = `doc-${slug}`;
    return {
      kind: 'generate',
      packId,
      file: path.join(PACKS_DIR, 'docs', `${t.today}-${slug}.md`),
      origin: 'doc',
      meta: {
        pack: packId,
        title: str(meta.title) || `Tài liệu · ${slug}`,
        origin: 'doc',
        created: t.today,
        generated_by: t.runId,
        ...(t.sources?.length ? { source: t.sources.join(', ') } : {}),
        ...(str(meta.description) ? { description: str(meta.description) } : {}),
      },
      idOf: (i) => `${packId}-${nn(i)}`,
      familyOf: (i) => `${packId}-f${i + 1}`,
    };
  }
  const info = BATCH_PACKS[t.kind];
  const slug = slugify(str(meta.slug)) || info.slug;
  const template = t.packFile ?? `${path.join(PACKS_DIR, 'ai')}/${t.today}-${info.word}-<slug>.md`;
  let file = path.resolve(REPO_DIR, template.replace('<slug>', slug));
  for (let n = 2; fs.existsSync(file); n++) file = path.resolve(REPO_DIR, template.replace('<slug>', `${slug}-${n}`));
  const basePack = t.packId ?? `ai-${t.today}-${info.word}`;
  let packId = basePack;
  for (let n = 2; bank.packs.some((p) => p.id === packId); n++) packId = `${basePack}-${n}`;
  const title = str(meta.title);
  const idPrefix = t.idPrefix ?? `${packId}-${info.ids}`;
  const familyPrefix = t.familyPrefix ?? `${idPrefix.replace(new RegExp(`-?${info.ids}$`), '')}-f`;
  return {
    kind: t.kind,
    packId,
    file,
    origin: 'ai',
    meta: {
      pack: packId,
      title: /^AI ·/.test(title) ? title : `AI · ${info.title} · ${title || slug}`,
      origin: 'ai',
      created: t.today,
      generated_by: t.runId,
      ...(t.batch ? { source: t.batch } : {}),
      description: info.description,
    },
    idOf: (i) => `${idPrefix}${nn(i)}`,
    familyOf: (i) => `${familyPrefix}${i + 1}`,
  };
}

const HEADING = /^#{1,2}\s/;
const OPTION_LIKE = /^\s*[-*]\s+(?:\[[ xX]\]\s+)?[A-H][.)]\s+/;
const CHOOSE_N: Record<string, number> = { TWO: 2, THREE: 3, FOUR: 4, '2': 2, '3': 3, '4': 4 };

function list(v: unknown): string[] {
  const a = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  return [...new Set(a.map((x) => oneLine(String(x))).filter(Boolean))];
}

export interface DraftContext {
  tax: Taxonomy;
  today: string;
  kind: PackTask;
  originals?: string[]; // longform / twins: allowed variant_of ids
  bank?: BankState;
  skills?: string[]; // [v5] bullets the run targets (generate: each question must name one of them)
  knownSkills?: ReadonlySet<string>; // [v5] bullets of the exam guide (empty = guide not loaded: only the id format is checked)
  family?: string; // [v5] family task: the family id of this member
}

/** [v5] Exam-guide bullets a question names: valid ids only (lower-case, unique); unknown / malformed ones are warned and dropped. */
export function skillList(v: unknown, known: ReadonlySet<string> | undefined, warnings: string[]): string[] {
  const out: string[] = [];
  for (const s of list(v).map((x) => x.toLowerCase())) {
    if (!SKILL_ID_RE.test(s)) warnings.push(`skills "${s}" không đúng dạng mục đề cương (<task>.k<n> / <task>.s<n>) — bỏ qua`);
    else if (known?.size && !known.has(s)) warnings.push(`skills "${s}" không có trong đề cương (bank/exam-guide) — bỏ qua`);
    else if (!out.includes(s)) out.push(s);
  }
  return out;
}

/** One new question from the structured answer → serializable draft + schema errors (no I/O). */
export function draftOf(raw: unknown, id: string, ctx: DraftContext): { draft?: QuestionDraft; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { errors: ['câu hỏi phải là một object'], warnings };
  const r = raw as Record<string, unknown>;
  const { tax } = ctx;

  const domain = normalizeDomain(str(r.domain));
  if (!domain) errors.push(`domain "${str(r.domain)}" không hợp lệ (secure | resilient | performance | cost)`);
  const topic = str(r.topic);
  if (!tax.topics.some((t) => t.id === topic)) errors.push(`topic "${topic}" không có trong taxonomy.yaml → topics`);
  const difficulty = str(r.difficulty).toLowerCase() as Difficulty;
  if (!DIFFICULTIES.includes(difficulty)) errors.push(`difficulty "${str(r.difficulty)}" không hợp lệ (easy | medium | hard)`);
  const task = str(r.task);
  const def = tax.tasks.find((t) => t.id === task);
  if (!task) errors.push('thiếu task (exam guide 1.1–4.4)');
  else if (!def) errors.push(`task "${task}" không có trong taxonomy.yaml → tasks (1.1 … 4.4)`);
  else if (domain && def.domain !== domain) errors.push(`task ${task} thuộc domain ${def.domain} nhưng domain là ${domain} — sửa cho khớp`);

  const stem = typeof r.stem === 'string' ? r.stem.replace(/\r\n?/g, '\n').trim() : '';
  if (!stem) errors.push('stem rỗng');
  else if (stem.split('\n').some((l) => HEADING.test(l) || OPTION_LIKE.test(l))) errors.push('stem không được chứa heading # / ## hay dòng dạng lựa chọn "- A. …"');
  const options = (Array.isArray(r.options) ? r.options : []).map((o, i) => ({
    key: LETTERS[i] ?? '?',
    text: oneLine(String(o ?? '')).replace(/^\(?[A-H][.):]\s+/, ''),
  }));
  if (options.length < 4 || options.length > 6) errors.push(`cần 4–6 lựa chọn (có ${options.length})`);
  options.forEach((o) => !o.text && errors.push(`lựa chọn ${o.key} rỗng`));
  const answer = [...new Set(list(r.answer).map((k) => k.toUpperCase()))].sort();
  if (!answer.length) errors.push('thiếu answer');
  for (const k of answer) if (!options.some((o) => o.key === k)) errors.push(`answer ${k} không phải một lựa chọn`);
  const choose = stem.match(CHOOSE_RE);
  if (answer.length > 1 && (!choose || CHOOSE_N[choose[1].toUpperCase()] !== answer.length)) errors.push(`câu ${answer.length} đáp án phải ghi "(Choose ${answer.length === 2 ? 'TWO' : 'THREE'})" trong đề`);
  if (answer.length === 1 && choose) errors.push(`đề ghi "${choose[0]}" nhưng chỉ có 1 đáp án`);
  if (answer.length === 1 && options.length !== 4) warnings.push(`câu 1 đáp án nên có đúng 4 lựa chọn (có ${options.length})`);

  const explanation = typeof r.explanation === 'string' ? r.explanation.replace(/\r\n?/g, '\n').trim() : '';
  if (!explanation) errors.push('explanation rỗng');
  else if (explanation.split('\n').some((l) => HEADING.test(l))) errors.push('explanation không được chứa heading # / ## (dùng ### hoặc chữ đậm)');
  else if (/^\s*\*\*(Answer|Explanation)\b/im.test(explanation)) errors.push('explanation không được chứa dòng **Answer:** / **Explanation:**');
  else if (LETTER_REF_RE.test(explanation)) errors.push('explanation nhắc tới chữ cái đáp án (vd "option B", "(C)", "= D", dòng bắt đầu "A:"/"A.") — app xáo thứ tự đáp án: gọi lựa chọn bằng nội dung');
  else {
    const words = countWords(explanation);
    if (words < MIN_EXPLANATION_WORDS) warnings.push(`explanation chỉ ${words} từ (nên ≥ ${MIN_EXPLANATION_WORDS})`);
    if (!/🇻🇳/.test(explanation)) warnings.push('explanation thiếu dòng tóm tắt "> 🇻🇳 …"');
  }

  const hint = str(r.hint);
  if (!hint) warnings.push('thiếu hint');
  else if (hintReveals(hint, options, answer)) errors.push('hint làm lộ đáp án (chứa nguyên văn đáp án đúng hoặc chữ cái) — chỉ gợi hướng suy nghĩ');
  else if (hint.length > 200) warnings.push(`hint dài ${hint.length} ký tự — nên ≤ 140`);

  const variantOf = list(r.variant_of);
  if (ctx.kind === 'longform' || ctx.kind === 'twins') {
    const what = ctx.kind === 'longform' ? 'câu dài' : 'câu song sinh';
    if (!variantOf.length) errors.push(`${what} phải có variant_of = id câu gốc`);
    else if (ctx.kind === 'twins' && variantOf.length > 1) errors.push(`câu song sinh chỉ có một câu gốc (variant_of: ${variantOf.join(', ')})`);
    else if (ctx.originals && variantOf.some((v) => !ctx.originals!.includes(v))) errors.push(`variant_of ${variantOf.join(', ')} không phải câu gốc của lô (${ctx.originals.join(', ')})`);
    const min = tax.timing.long_form_min_words ?? 55;
    if (ctx.kind === 'longform' && stem && countWords(stem) < min) errors.push(`đề chỉ ${countWords(stem)} từ — câu dài cần ≥ ${min} từ (nên 70–100, tối đa 130)`);
  } else if (ctx.kind === 'family') {
    if (variantOf.length) warnings.push('câu trong họ không ghi variant_of — bỏ qua');
  } else if (ctx.bank) {
    for (const v of variantOf) if (!ctx.bank.byId.has(v)) warnings.push(`variant_of "${v}" không có trong ngân hàng`);
  }
  // [v5] exam-guide bullets: a run that targets bullets wants each new question on one of them
  const skills = skillList(r.skills, ctx.knownSkills, warnings);
  if (ctx.skills?.length && !skills.some((s) => ctx.skills!.includes(s))) {
    if (ctx.kind === 'generate') errors.push(`câu phải nhắm ít nhất một mục đề cương của lượt này (skills: ${ctx.skills.join(', ')})`);
    else warnings.push(`câu không ghi mục đề cương nào của lượt này (${ctx.skills.join(', ')})`);
  }
  if (!ID_RE.test(id) || id.length > 60) errors.push(`id "${id}" không hợp lệ`);
  if (errors.length || !domain) return { errors, warnings };

  const draft: QuestionDraft = {
    id,
    stem,
    options,
    answer,
    explanation,
    domain,
    topic,
    services: list(r.services),
    tags: list(r.tags),
    difficulty,
    time: estimateQuestionTime({ stem, options, answer, difficulty }, tax.timing),
    variantOf: ctx.kind === 'family' ? [] : variantOf,
    concept: str(r.concept) || undefined,
    refs: list(r.refs),
    task,
    hint: hint || undefined,
    created: ctx.today,
    // fully written (explanation + hint + task) → ENRICH need not pick it up again
    enriched: hint && countWords(explanation) >= MIN_EXPLANATION_WORDS ? ctx.today : undefined,
    ...(skills.length ? { skills } : {}),
    ...(ctx.family ? { family: ctx.family } : {}),
  };
  return { draft, errors, warnings };
}

// ── [v5] twins: sibling checks ──────────────────────────────────────────────

const words = (s: string) => new Set((s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((w) => !/^\d+$/.test(w)));

/** Word overlap of two texts (Jaccard over words of ≥ 3 letters). */
export function wordOverlap(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let common = 0;
  for (const w of x) if (y.has(w)) common++;
  return common / (x.size + y.size - common);
}

const keyText = (q: Pick<QuestionDraft, 'options' | 'answer'>) =>
  q.answer
    .map((k) => q.options.find((o) => o.key === k)?.text ?? '')
    .map((t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim())
    .sort()
    .join(' | ');

export const SURFACE_MAX_OVERLAP = 0.6; // a paraphrase sharing more of the original's stem words is a copy

/**
 * A twin against its original: a `surface` twin must really be reworded (stem word overlap < SURFACE_MAX_OVERLAP); a
 * `contrast` twin must move the key (its correct option text differs from the original's — one changed requirement
 * makes a former distractor right).
 */
export function twinChecks(d: QuestionDraft, original: Question | undefined, kind: TwinKind, said?: unknown): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (said !== undefined && said !== kind) warnings.push(`kind "${String(said)}" khác loại lô yêu cầu (${kind}) — kiểm tra theo ${kind}`);
  if (!original) return { errors, warnings };
  const overlap = wordOverlap(d.stem, original.stem);
  if (kind === 'surface' && overlap >= SURFACE_MAX_OVERLAP) {
    errors.push(`đề trùng ${Math.round(overlap * 100)}% từ với câu gốc — câu song sinh "diễn đạt lại" phải đổi bối cảnh / ngành / số liệu / câu chữ (giữ khái niệm và yêu cầu)`);
  }
  if (kind === 'contrast' && keyText(d) === keyText(original)) {
    errors.push('câu tương phản phải đổi đáp án đúng: đổi MỘT yêu cầu của tình huống để một phương án nhiễu (của câu gốc) trở thành đúng');
  }
  if (d.options.length !== original.options.length || d.answer.length !== original.answer.length) {
    warnings.push(`câu gốc có ${original.options.length} lựa chọn / ${original.answer.length} đáp án — câu song sinh nên giữ đúng dạng đó (có ${d.options.length} / ${d.answer.length})`);
  }
  if (kind === 'surface' && keyText(d) !== keyText(original) && wordOverlap(keyText(d), keyText(original)) < 0.2) {
    warnings.push('câu "diễn đạt lại" có đáp án khác hẳn câu gốc — kiểm tra vẫn cùng khái niệm');
  }
  return { errors, warnings };
}

// ── [v5] family: one scenario, one option set, 2–4 final questions ──────────

export interface FamilyMemberDraft {
  id: string;
  draft?: QuestionDraft;
  errors: string[];
  warnings: string[];
}

export interface FamilyBuild {
  id: string; // family id
  label?: string; // start of the scenario (log)
  members: FamilyMemberDraft[];
  errors: string[]; // family-level (options, members, answers)
  warnings: string[];
}

const QUALIFIER_WORD = /\b(MOST|LEAST|BEST|FASTEST|CHEAPEST|LOWEST|HIGHEST|FEWEST)\b/;

/**
 * A family from the structured answer → one draft per member: stem = scenario + final question, options shared, its
 * own key / explanation / hint, `family: <id>`. Family rules: 2–4 members, distinct shared options, every final question
 * names a requirement (qualifier), no two members ask the same requirement and no two share a key (only the final
 * question may change the answer). Member ids come from `idOf(n)` — consecutive over the whole pack.
 */
export function familyDrafts(raw: unknown, familyId: string, firstIndex: number, idOf: (i: number) => string, ctx: Omit<DraftContext, 'kind' | 'family'>): FamilyBuild {
  const out: FamilyBuild = { id: familyId, members: [], errors: [], warnings: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    out.errors.push('họ câu phải là một object');
    return out;
  }
  const r = raw as Record<string, unknown>;
  const scenario = typeof r.scenario === 'string' ? r.scenario.replace(/\r\n?/g, '\n').trim() : '';
  out.label = stemLabelOf(scenario);
  if (!scenario) out.errors.push('scenario rỗng');
  else if (/\?\s*$/.test(scenario)) out.warnings.push('scenario kết thúc bằng câu hỏi — câu hỏi cuối thuộc về từng câu (members[].question)');
  const options = (Array.isArray(r.options) ? r.options : []).map((o) => oneLine(String(o ?? '')).replace(/^\(?[A-H][.):]\s+/, ''));
  if (options.length < 4 || options.length > 5) out.errors.push(`họ câu cần 4–5 lựa chọn dùng chung (có ${options.length})`);
  const norm = options.map((o) => o.toLowerCase());
  if (new Set(norm).size !== norm.length) out.errors.push('hai lựa chọn trùng nhau');
  const members = Array.isArray(r.members) ? (r.members as unknown[]) : [];
  if (members.length < 2 || members.length > 4) out.errors.push(`họ câu cần 2–4 câu (có ${members.length})`);
  const keys = new Map<string, number>();
  const asks = new Map<string, number>();
  members.slice(0, 4).forEach((m, i) => {
    const id = idOf(firstIndex + i);
    const mm = m && typeof m === 'object' && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
    const question = typeof mm.question === 'string' ? oneLine(mm.question) : '';
    const member: FamilyMemberDraft = { id, errors: [], warnings: [] };
    if (!question) member.errors.push('thiếu câu hỏi cuối (question)');
    const ask = str(mm.ask);
    const found = question ? stemRequirements(question, ctx.tax).filter((c) => (FAMILY_ASKS as readonly string[]).includes(c)) : [];
    if (question && !found.length && !QUALIFIER_WORD.test(question)) member.errors.push(`câu hỏi cuối không nêu yêu cầu (vd MOST cost-effectively / LEAST operational overhead / MOST secure): “${question.slice(0, 80)}”`);
    else if (ask && found.length && !found.includes(ask)) member.warnings.push(`ask "${ask}" nhưng câu hỏi cuối nghiêng về ${found.join(', ')}`);
    if (ask) {
      if (asks.has(ask)) member.errors.push(`trùng yêu cầu "${ask}" với câu thứ ${(asks.get(ask) ?? 0) + 1} của họ — mỗi câu một yêu cầu khác`);
      else asks.set(ask, i);
    }
    const d = draftOf(
      {
        domain: mm.domain ?? r.domain,
        task: mm.task ?? r.task,
        topic: r.topic,
        services: r.services,
        tags: r.tags,
        difficulty: r.difficulty,
        concept: r.concept,
        refs: r.refs,
        skills: r.skills,
        hint: mm.hint,
        stem: `${scenario} ${question}`.trim(),
        options,
        answer: mm.answer,
        explanation: mm.explanation,
      },
      id,
      { ...ctx, kind: 'family', family: familyId },
    );
    member.errors.push(...d.errors);
    member.warnings.push(...d.warnings);
    member.draft = d.draft;
    if (d.draft) {
      const k = d.draft.answer.join('');
      if (keys.has(k)) member.errors.push(`cùng đáp án ${k} với câu thứ ${(keys.get(k) ?? 0) + 1} của họ — câu hỏi cuối khác phải dẫn tới đáp án khác`);
      else keys.set(k, i);
    }
    out.members.push(member);
  });
  // lint family-options (γ1): members of a family must share the option set — high-severity flaws reject the member
  const drafted = out.members.filter((m) => m.draft);
  if (drafted.length > 1) {
    const family = drafted.map((m) => ({ id: m.id, stem: m.draft!.stem, options: m.draft!.options, answer: m.draft!.answer }));
    for (const m of drafted) {
      try {
        for (const f of familyFlaws({ ...family.find((x) => x.id === m.id)!, explanation: m.draft!.explanation }, family)) {
          (f.severity === 'high' ? m.errors : m.warnings).push(`lint: ${f.message} [${f.code}]`);
        }
      } catch {
        // a crashing linter never blocks a family
      }
    }
  }
  return out;
}

const stemLabelOf = (s: string) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t ? `“${t.length > 70 ? t.slice(0, 69) + '…' : t}”` : undefined;
};

/**
 * Checks one draft the way the bank will read it: serialized alone into a pack and re-parsed (parser errors and option
 * letters in the explanation are errors), linted (new high-severity flaws are errors, the rest warnings), and its id
 * must be free in the bank. "Correct option longest" stays a warning: ENRICH `balance` picks such questions up later.
 */
export function checkDraft(d: QuestionDraft, plan: PackPlan, bank: BankState, lint?: LintFn): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (bank.byId.has(d.id)) errors.push(`id ${d.id} đã có trong ngân hàng`);
  const parsed = parsePack(packText(plan, [d]), rel(plan.file), bank.taxonomy);
  for (const p of parsed.problems.filter((x) => x.qid === d.id)) {
    if (p.level === 'error' || /option letters/i.test(p.message)) errors.push(p.message);
    else if (!/Missing "time"/.test(p.message)) warnings.push(p.message);
  }
  const q = parsed.questions.find((x) => x.id === d.id);
  if (!q) {
    if (!errors.length) errors.push('câu không parse được sau khi ghi (kiểm tra stem/explanation)');
    return { errors, warnings };
  }
  const flaws = lintDelta(undefined, q, bank.taxonomy, lint);
  const letters = errors.some((e) => /option letters/i.test(e));
  errors.push(...flaws.errors.filter((e) => !(letters && e.includes('[letter-ref'))));
  warnings.push(...flaws.warnings);
  if (correctIsLongest(q.options, q.answer) && !flaws.warnings.some((w) => w.includes('[longest-correct'))) {
    warnings.push('đáp án đúng dài hơn mọi distractor ≥ 15 % — ENRICH “balance” sẽ cân lại');
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings.filter((w) => !(/much longer/i.test(w) && flaws.warnings.some((x) => x.includes('[longest-correct')))))] };
}

function packText(plan: PackPlan, drafts: QuestionDraft[]): string {
  return serializePack(plan.meta, '', drafts, (data) => stringifyFrontMatter(data));
}

/**
 * Writes the new pack (atomic) and returns its path relative to the data root. [v5] The run's created ids are recorded
 * first (coach/patches/<run>.before.json) so "↩️ Hoàn tác" can retire them.
 */
export function writePack(plan: PackPlan, drafts: QuestionDraft[]): string {
  try {
    recordCreated(plan.meta.generated_by, drafts.map((d) => d.id), rel(plan.file), { task: plan.kind });
  } catch {
    // the undo record never blocks the pack — the run log still lists the new questions
  }
  writeAtomic(plan.file, packText(plan, drafts));
  return rel(plan.file);
}

// ── repair round ────────────────────────────────────────────────────────────

/** Follow-up prompt for `--resume <session_id>`: the failures per id, corrected items only, same schema. */
export function repairPrompt(task: StructuredTask, runId: string, failures: ItemFailure[]): string {
  const what = task === 'enrich' ? 'item' : task === 'family' ? 'họ câu' : 'câu';
  const lines = [
    `Ứng dụng đã kiểm tra kết quả JSON của bạn: ${failures.length} ${what} bị từ chối và CHƯA được ghi vào ngân hàng.`,
    `Sửa CHỈ các ${what} dưới đây rồi trả lại bằng JSON cùng schema — chỉ gồm các ${what} đã sửa, mỗi ${what} ghi đúng \`id\` ở đầu dòng.`,
    `Các ${what} khác đã được chấp nhận: không gửi lại.`,
    task === 'enrich'
      ? 'Câu "thiếu item": trả { id } nếu câu không cần đổi, hoặc các thay đổi. `base` do app tự điền.'
      : task === 'family'
        ? 'Mỗi họ sửa lại phải đủ các trường như lần đầu (scenario, options dùng chung, 2–4 members) và có `id` = id họ ở đầu dòng; `pack` giữ như cũ.'
        : 'Mỗi câu sửa lại phải đủ các trường như lần đầu và có `id` = id ở đầu dòng; `pack` giữ như cũ.',
    '',
    ...failures.map((f) => `- \`${f.id}\`${f.label ? ` (${f.label})` : ''}: ${f.errors.join(' | ')}${f.warnings?.length ? ` — nên sửa luôn (không chặn): ${f.warnings.join(' | ')}` : ''}`),
    '',
    'Nhắc lại: gọi lựa chọn bằng NỘI DUNG (không "option B", "(C)", "= D", dòng bắt đầu "A:"/"A."), task cùng domain, hint không lộ đáp án,',
    'đáp án đúng không dài hơn hẳn các distractor, câu nhiều đáp án ghi "(Choose TWO)".',
    ...(task === 'twins' ? ['Câu song sinh: variant_of = đúng một câu gốc của lô; "surface" đổi bối cảnh/câu chữ (giữ khái niệm), "contrast" đổi một yêu cầu để đáp án đổi.'] : []),
    ...(task === 'family' ? ['Họ câu: các câu hỏi cuối nêu yêu cầu khác nhau (MOST cost-effectively / LEAST operational overhead / MOST secure…) và có đáp án khác nhau.'] : []),
    '',
    `- run_id: ${runId}`,
  ];
  return lines.join('\n');
}
