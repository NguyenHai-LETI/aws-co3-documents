// AI bulk edits to existing questions (ENRICH / coach / blind-solve decisions): coach/patches/<runId>.yaml (or items
// built in memory) → validated, block-level rewrites of the packs. Format: bank/SCHEMA.md §8. Every item is checked
// against the question's content hash (`base`), re-serialized with serializeQuestion(), re-parsed and re-linted
// (lint.ts: a new high-severity item-writing flaw rejects the item, other new flaws are warnings); an item that
// introduces errors is reverted and reported, the others are kept.
// [v5] γ2: a patch with a run id (or `preImage`) saves the previous version of every block it rewrites in
// coach/patches/<run>.before.json before the pack is replaced — "↩️ Hoàn tác" of that run restores it (undo.ts).
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { DATA_DIR, rel } from '../config.ts';
import { asStringList } from './frontmatter.ts';
import { loadBank } from './bank.ts';
import { correctIsLongest as longestRule, lintQuestion, newFlaws } from './lint.ts';
import { LETTER_REF_RE, SKILL_ID_RE, parsePack, questionHash, serializeQuestion, toDraft, type QuestionDraft } from './pack-format.ts';
import { loadMigrations, type MigrationRecord } from './migrations.ts';
import { normalizeDomain } from './taxonomy.ts';
import { localIso, stampParts } from './time.ts';
import { bodyStartIndex, findBlock, normalizedText, writePackText } from './blocks.ts';
import { questionSig, recordPreImages, type PreImageInput } from './undo.ts';
import { countWords, estimateQuestionTime } from '../../shared/timing.ts';
import type { BankProblem, Difficulty, LintFlaw, Option, Question, QuestionStatus, Taxonomy } from '../../shared/types.ts';

export { findBlock } from './blocks.ts';

export interface PatchItemResult {
  id: string;
  status: 'applied' | 'unchanged' | 'skipped' | 'failed';
  changes: string[]; // e.g. ["explanation", "hint", "task 2.2", "options A, C"]
  errors: string[];
  warnings: string[];
  file?: string; // pack file relative to the data root
  hash?: string; // content hash after the item (new `base` for later patches)
}

export interface PatchResult {
  patch: string; // patch file (relative to the data root when inside it)
  runId?: string;
  dryRun: boolean;
  items: PatchItemResult[];
  applied: number;
  unchanged: number;
  skipped: number;
  failed: number;
  files: string[]; // packs written (or that would be written in a dry run)
  error?: string; // fatal: unreadable / invalid patch file
}

/** Item-writing-flaw checker (lint.ts `lintQuestion`); injectable so tests can use a stand-in rule. */
export type LintFn = (q: Question, tax: Taxonomy) => LintFlaw[];

export interface ApplyOptions {
  dryRun?: boolean;
  today?: string; // YYYY-MM-DD for `enriched` (tests)
  lint?: LintFn; // default lintQuestion
  preImage?: string | false; // [v5] run whose undo file gets the previous versions (default: the patch's run id; false = none)
}

const SET_KEYS = ['domain', 'task', 'topic', 'services', 'tags', 'difficulty', 'time', 'concept', 'refs', 'hint', 'variant_of', 'status', 'skills', 'family'] as const;
const ITEM_KEYS = ['id', 'base', 'set', 'explanation', 'options', 'stem', 'answer', 'reason', 'status'];
const STATUSES: QuestionStatus[] = ['active', 'draft', 'retired'];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const BLOCK_HEADING = /^#{1,2}\s/;
const FAMILY_RE = /^[a-z0-9][a-z0-9-]*$/;
const OPTION_LIKE = /^\s*[-*]\s+(?:\[[ xX]\]\s+)?[A-H][.)]\s+/;
const MIN_EXPLANATION_WORDS = 25;

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();
const str = (v: unknown): string | undefined => (v === undefined || v === null ? undefined : typeof v === 'string' ? v : String(v));

function parseKeys(v: unknown): string[] {
  const raw = Array.isArray(v) ? v.map(String).join(',') : String(v ?? '');
  return [...new Set(raw.toUpperCase().match(/[A-H]/g) ?? [])].sort();
}

/** True when the (a) correct option is ≥ 15 % longer than every distractor — lint.ts rule (one rule everywhere). */
export function correctIsLongest(options: { key: string; text: string }[], answer: string[]): boolean {
  return longestRule({ options, answer });
}

/** A hint must not give the answer away: no verbatim correct option, no option letter. */
export function hintReveals(hint: string, options: Option[], answer: string[]): boolean {
  const h = hint.toLowerCase();
  const verbatim = answer.some((k) => {
    const t = options.find((o) => o.key === k)?.text.toLowerCase().replace(/[.。]+$/, '').trim() ?? '';
    return t.length >= 8 && h.includes(t);
  });
  return verbatim || /(?:đáp án|lựa chọn|phương án|option|answer|choice)\s+[A-H](?![\p{L}\p{N}])/iu.test(hint);
}

const flawText = (f: LintFlaw) => `${f.message} [${f.code}${f.option ? ` · ${f.option}` : ''}]`;

/**
 * Flaws an edit introduces (lint.ts): high severity → errors (the edit is rejected), the rest → warnings.
 * `before` = undefined for a brand-new question (every flaw is new). A crashing linter never blocks an edit.
 */
export function lintDelta(before: Question | undefined, after: Question, tax: Taxonomy, lint: LintFn = lintQuestion): { errors: string[]; warnings: string[] } {
  let added: LintFlaw[];
  try {
    added = newFlaws(before ? lint(before, tax) : [], lint(after, tax));
  } catch (e) {
    return { errors: [], warnings: [`lint không chạy được: ${(e as Error).message}`] };
  }
  return {
    errors: added.filter((f) => f.severity === 'high').map((f) => `lint (mức cao): ${flawText(f)}`),
    warnings: added.filter((f) => f.severity !== 'high').map((f) => `lint: ${flawText(f)}`),
  };
}

/** Problems for one question id, keyed without line numbers (lines shift when a block grows). */
function problemSet(problems: BankProblem[], qid: string, level: 'error' | 'warning'): Set<string> {
  return new Set(problems.filter((p) => p.qid === qid && p.level === level).map((p) => p.message));
}

interface Built {
  draft: QuestionDraft;
  changes: string[];
  errors: string[];
  warnings: string[];
  hashFieldsTouched: boolean;
  statusOnly: boolean;
}

/** Applies one patch item to a draft of the current question (no I/O). */
function buildDraft(cur: Question, item: Record<string, unknown>, tax: Taxonomy): Built {
  const d = toDraft(cur);
  const changes: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let hashFieldsTouched = false;
  let otherTouched = false;
  let statusTouched = false;

  // metadata: `set: {…}` plus the same keys written at item level (a common slip)
  const set: Record<string, unknown> = {};
  if (item.set !== undefined) {
    if (!item.set || typeof item.set !== 'object' || Array.isArray(item.set)) errors.push('`set` phải là một map (vd set: { task: "2.2", hint: "…" })');
    else Object.assign(set, item.set);
  }
  for (const k of Object.keys(item)) {
    if (ITEM_KEYS.includes(k)) continue;
    if ((SET_KEYS as readonly string[]).includes(k)) set[k] = item[k];
    else errors.push(`Khoá không hợp lệ "${k}" (dùng: ${ITEM_KEYS.join(', ')}; metadata trong set: ${SET_KEYS.join(', ')})`);
  }
  if (item.status !== undefined) set.status = item.status;

  for (const [k, v] of Object.entries(set)) {
    if (!(SET_KEYS as readonly string[]).includes(k)) {
      errors.push(`set.${k} không được hỗ trợ (cho phép: ${SET_KEYS.join(', ')})`);
      continue;
    }
    const s = str(v);
    switch (k) {
      case 'domain': {
        const dom = normalizeDomain(s);
        if (!dom) errors.push(`domain "${s ?? ''}" không hợp lệ (secure | resilient | performance | cost)`);
        else if (dom !== d.domain) {
          d.domain = dom;
          changes.push(`domain ${dom}`);
        }
        break;
      }
      case 'task': {
        const t = (s ?? '').trim();
        if (!t) {
          if (d.task) {
            d.task = undefined;
            changes.push('task (xoá)');
          }
        } else if (!tax.tasks.some((x) => x.id === t)) errors.push(`task "${t}" không có trong taxonomy.yaml → tasks (1.1 … 4.4)`);
        else if (t !== d.task) {
          d.task = t;
          changes.push(`task ${t}`);
        }
        break;
      }
      case 'topic':
        if (s && s !== d.topic) {
          d.topic = s.trim();
          changes.push(`topic ${d.topic}`);
        }
        break;
      case 'services':
      case 'tags':
      case 'refs':
      case 'variant_of': {
        const list = asStringList(v);
        const field = k === 'variant_of' ? 'variantOf' : k;
        const before = (d[field as 'services'] ?? []).join(',');
        if (list.join(',') !== before) {
          (d as unknown as Record<string, string[]>)[field] = list;
          changes.push(`${k} ${list.join(', ') || '(trống)'}`);
        }
        break;
      }
      case 'difficulty': {
        const diff = (s ?? '').trim().toLowerCase() as Difficulty;
        if (!DIFFICULTIES.includes(diff)) errors.push(`difficulty "${s ?? ''}" không hợp lệ (easy | medium | hard)`);
        else if (diff !== d.difficulty) {
          d.difficulty = diff;
          changes.push(`difficulty ${diff}`);
        }
        break;
      }
      case 'time': {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 20 || n > 600) errors.push(`time "${s ?? ''}" phải là số giây nguyên 20–600`);
        else if (n !== d.time) {
          d.time = n;
          changes.push(`time ${n}`);
        }
        break;
      }
      case 'concept': {
        const c = oneLine(s ?? '');
        if (c !== (d.concept ?? '')) {
          d.concept = c || undefined;
          changes.push('concept');
        }
        break;
      }
      case 'hint': {
        const h = oneLine(s ?? '');
        if (h !== (d.hint ?? '')) {
          d.hint = h || undefined;
          changes.push(h ? 'hint' : 'hint (xoá)');
        }
        if (h.length > 200) warnings.push(`hint dài ${h.length} ký tự — nên ≤ 160 (1 dòng ngắn)`);
        break;
      }
      case 'status': {
        const st = (s ?? '').trim().toLowerCase() as QuestionStatus;
        if (!STATUSES.includes(st)) errors.push(`status "${s ?? ''}" không hợp lệ (active | draft | retired)`);
        else if (st !== (d.status ?? 'active')) {
          d.status = st;
          statusTouched = true;
          changes.push(`status ${st}`);
          continue;
        }
        break;
      }
      case 'skills': {
        // [v5] exam-guide bullets (ENRICH classify): a stored list replaces any guess; [] clears it
        const list = [...new Set(asStringList(v).map((x) => x.trim().toLowerCase()))];
        const bad = list.filter((x) => !SKILL_ID_RE.test(x));
        if (bad.length) errors.push(`skills ${bad.join(', ')} không hợp lệ (mục đề cương dạng <task>.k<n> / <task>.s<n>, vd 3.5.s7)`);
        else if (list.join(',') !== (d.skills ?? []).join(',')) {
          d.skills = list.length ? list : undefined;
          changes.push(`skills ${list.join(', ') || '(xoá)'}`);
        }
        break;
      }
      case 'family': {
        const f = (s ?? '').trim();
        if (f && !FAMILY_RE.test(f)) errors.push(`family "${f}" không hợp lệ (id kebab-case a-z0-9)`);
        else if (f !== (d.family ?? '')) {
          d.family = f || undefined;
          changes.push(f ? `family ${f}` : 'family (xoá)');
        }
        break;
      }
    }
    if (k !== 'status') otherTouched = true;
  }

  if (item.explanation !== undefined) {
    otherTouched = true;
    const e = (str(item.explanation) ?? '').replace(/\r\n?/g, '\n').trim();
    if (!e) errors.push('explanation rỗng');
    else if (e.split('\n').some((l) => BLOCK_HEADING.test(l))) errors.push('explanation không được chứa heading # / ## (dùng ### hoặc chữ đậm)');
    else if (/^\s*\*\*(Answer|Explanation)\b/im.test(e)) errors.push('explanation không được chứa dòng **Answer:** / **Explanation:** (chỉ ghi nội dung giải thích)');
    else if (e !== d.explanation.trim()) {
      d.explanation = e;
      changes.push('explanation');
    }
  }

  if (item.options !== undefined) {
    otherTouched = true;
    if (!item.options || typeof item.options !== 'object' || Array.isArray(item.options)) errors.push('`options` phải là map { A: "…", C: "…" }');
    else {
      const changed: string[] = [];
      for (const [rawKey, v] of Object.entries(item.options as Record<string, unknown>)) {
        const key = rawKey.trim().toUpperCase();
        const opt = d.options.find((o) => o.key === key);
        const text = oneLine(str(v) ?? '');
        if (!opt) errors.push(`options.${rawKey}: câu không có lựa chọn ${key} (chỉ được thay nội dung, không thêm/bớt lựa chọn)`);
        else if (!text) errors.push(`options.${key} rỗng`);
        else if (text !== opt.text) {
          opt.text = text;
          changed.push(key);
        }
      }
      if (changed.length) {
        hashFieldsTouched = true;
        changes.push(`options ${changed.join(', ')}`);
      }
    }
  }

  if (item.stem !== undefined) {
    otherTouched = true;
    const s = (str(item.stem) ?? '').replace(/\r\n?/g, '\n').trim();
    if (!s) errors.push('stem rỗng');
    else if (s.split('\n').some((l) => BLOCK_HEADING.test(l) || OPTION_LIKE.test(l))) errors.push('stem không được chứa heading # / ## hay dòng dạng lựa chọn "- A. …"');
    else if (s !== d.stem.trim()) {
      d.stem = s;
      hashFieldsTouched = true;
      changes.push('stem');
    }
  }

  if (item.answer !== undefined) {
    otherTouched = true;
    const keys = parseKeys(item.answer);
    const reason = oneLine(str(item.reason) ?? '');
    if (!keys.length) errors.push('answer không hợp lệ (vd answer: [B] hoặc [A, C])');
    else if (keys.some((k) => !d.options.some((o) => o.key === k))) errors.push(`answer ${keys.join(', ')} có khoá không nằm trong các lựa chọn`);
    else if (keys.join('') !== d.answer.join('')) {
      if (!reason) errors.push('Đổi đáp án bắt buộc có `reason: "…"` (bằng chứng/nguồn)');
      else {
        d.answer = keys;
        hashFieldsTouched = true;
        changes.push(`answer ${d.answer.join(', ')} (${reason})`);
      }
    }
  }

  // explicit time stays; a rubric-derived time follows the new content
  if (!('time' in set) && (hashFieldsTouched || changes.some((c) => c.startsWith('difficulty')))) {
    const before = estimateQuestionTime({ stem: cur.stem, options: cur.options, answer: cur.answer, difficulty: cur.difficulty }, tax.timing);
    if (cur.timeEstimated || cur.time === before) {
      const after = estimateQuestionTime({ stem: d.stem, options: d.options, answer: d.answer, difficulty: d.difficulty }, tax.timing);
      if (after !== d.time) {
        d.time = after;
        changes.push(`time ${after}`);
      }
    }
  }

  // classification consistency
  if (d.task) {
    const def = tax.tasks.find((t) => t.id === d.task);
    if (def && def.domain !== d.domain) errors.push(`task ${d.task} thuộc domain ${def.domain} nhưng domain là ${d.domain} — sửa cho khớp`);
  }

  return { draft: d, changes, errors, warnings, hashFieldsTouched, statusOnly: statusTouched && !otherTouched };
}

/** Quality checks on the new content that the parser does not treat as errors. */
function contentChecks(cur: Question, d: QuestionDraft, changes: string[], errors: string[], warnings: string[]): void {
  const changed = (f: string) => changes.some((c) => c === f || c.startsWith(`${f} `));
  if (changed('explanation')) {
    const words = countWords(d.explanation);
    if (words < MIN_EXPLANATION_WORDS) warnings.push(`explanation chỉ ${words} từ (nên ≥ ${MIN_EXPLANATION_WORDS}: vì sao đúng + từng distractor + 🇻🇳)`);
    if (!/🇻🇳/.test(d.explanation)) warnings.push('explanation thiếu dòng tóm tắt "> 🇻🇳 …"');
  }
  if (d.hint && (changed('hint') || changed('options') || changed('answer')) && hintReveals(d.hint, d.options, d.answer)) {
    errors.push('hint làm lộ đáp án (chứa nguyên văn đáp án đúng hoặc chữ cái) — chỉ gợi hướng suy nghĩ');
  }
  if (changed('options') && correctIsLongest(d.options, d.answer)) warnings.push('đáp án đúng vẫn dài hơn mọi distractor ≥ 15 % — cân lại độ dài');
  if (changed('answer') && d.answer.length !== cur.answer.length) warnings.push(`số đáp án đổi ${cur.answer.length} → ${d.answer.length}: kiểm tra "(Choose N)" trong đề`);
}

/**
 * A patch prepared before an answer-position migration (bank/migrations/*.json, e.g. the rebalance) uses the old
 * option letters. Undo the recorded re-lettering step by step (newest first); when that reproduces one of `hashes`,
 * return old key → current key so the item's `options` / `answer` can be re-keyed. Otherwise undefined.
 */
export function migrationRemap(cur: Question, hashes: string[], migrations: MigrationRecord[]): { map: Record<string, string>; via: string[] } | undefined {
  let opts = cur.options.map((o) => ({ ...o }));
  let ans = [...cur.answer];
  let toCurrent: Record<string, string> = Object.fromEntries(cur.options.map((o) => [o.key, o.key]));
  const via: string[] = [];
  for (const m of [...migrations].reverse()) {
    const raw = m.questions?.[cur.id];
    if (!raw) continue;
    const map: Record<string, string> = Object.fromEntries(opts.map((o) => [o.key, raw[o.key] ?? o.key])); // old → newer
    const text = new Map(opts.map((o) => [o.key, o.text]));
    const prev = opts.map((o) => ({ key: o.key, text: text.get(map[o.key]) }));
    if (prev.some((o) => o.text === undefined) || new Set(Object.values(map)).size !== opts.length) return undefined;
    const inv = Object.fromEntries(Object.entries(map).map(([o, n]) => [n, o]));
    ans = ans.map((k) => inv[k] ?? k).sort();
    opts = prev as { key: string; text: string }[];
    toCurrent = Object.fromEntries(Object.entries(map).map(([o, n]) => [o, toCurrent[n] ?? n]));
    via.push(m.id);
    if (hashes.includes(questionHash(cur.stem, opts, ans))) return { map: toCurrent, via };
  }
  return undefined;
}

function rekeyItem(item: Record<string, unknown>, map: Record<string, string>): Record<string, unknown> {
  const out = { ...item };
  if (item.options && typeof item.options === 'object' && !Array.isArray(item.options)) {
    out.options = Object.fromEntries(Object.entries(item.options as Record<string, unknown>).map(([k, v]) => [map[k.trim().toUpperCase()] ?? k, v]));
  }
  if (item.answer !== undefined) out.answer = parseKeys(item.answer).map((k) => map[k] ?? k);
  return out;
}

function readPatch(abs: string): { runId?: string; items: Record<string, unknown>[]; error?: string } {
  let raw: unknown;
  try {
    raw = YAML.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    return { items: [], error: `Không đọc được patch YAML: ${(e as Error).message.split('\n')[0]}` };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { items: [], error: 'Patch phải là một map có khoá `items:`' };
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.items)) return { items: [], error: 'Thiếu danh sách `items:`' };
  const items = r.items.map((x) => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : { __invalid: x }));
  return { runId: str(r.run_id), items };
}

/**
 * Applies a patch file to the bank. Items are processed per pack in order; each is verified (base hash, field rules,
 * re-parse + lint of the pack) and reverted on failure. Packs are rewritten atomically unless `dryRun`.
 */
export function applyPatch(file: string, opts: ApplyOptions = {}): PatchResult {
  const abs = path.resolve(file);
  const shown = abs.startsWith(DATA_DIR + path.sep) ? rel(abs) : abs;
  if (!fs.existsSync(abs)) return { ...emptyResult(shown, opts), error: `Không tìm thấy file patch: ${file}` };
  const parsed = readPatch(abs);
  if (parsed.error) return { ...emptyResult(shown, opts), runId: parsed.runId, error: parsed.error };
  return applyPatchItems(parsed.items, { ...opts, label: shown, runId: parsed.runId, ledgerFile: ledgerPath(abs) });
}

function emptyResult(label: string, opts: ApplyOptions): PatchResult {
  return { patch: label, dryRun: !!opts.dryRun, items: [], applied: 0, unchanged: 0, skipped: 0, failed: 0, files: [] };
}

/**
 * Same as applyPatch for items built in memory (structured AI output, blind-solve decisions). `ledgerFile` lets a
 * re-run recognise items it already applied; without it every item is checked against its `base` only.
 */
export function applyPatchItems(items: Record<string, unknown>[], opts: ApplyOptions & { label?: string; runId?: string; ledgerFile?: string } = {}): PatchResult {
  const result: PatchResult = { ...emptyResult(opts.label ?? '(patch)', opts), runId: opts.runId };
  const today = opts.today ?? stampParts().date;
  const bank = loadBank();
  const tax = bank.taxonomy;
  const ledgerFile = opts.ledgerFile;
  const ledger = ledgerFile ? readLedger(ledgerFile) : {};
  const ledgerBefore = JSON.stringify(ledger);
  let migrations: MigrationRecord[] = [];
  try {
    migrations = loadMigrations();
  } catch {
    // no/unreadable migration records → stale items are simply skipped
  }

  // group items by pack, keeping patch order
  const byFile = new Map<string, { item: Record<string, unknown>; res: PatchItemResult }[]>();
  const seen = new Set<string>();
  items.forEach((item, i) => {
    const id = str(item.id)?.trim() ?? '';
    const res: PatchItemResult = { id: id || `#${i + 1}`, status: 'failed', changes: [], errors: [], warnings: [] };
    result.items.push(res);
    if ('__invalid' in item) res.errors.push('item phải là một map (id, base, …)');
    else if (item.id !== undefined && typeof item.id !== 'string') res.errors.push(`id phải là chuỗi trong ngoặc kép (YAML đọc ${String(item.id)} thành số): id: "…"`);
    else if (item.base !== undefined && typeof item.base !== 'string') {
      res.errors.push(`base phải là chuỗi trong ngoặc kép — YAML đọc hash không có dấu ngoặc (vd 46794516e3) thành số ${String(item.base)}: viết base: "<hash>"`);
    } else if (!id) res.errors.push('item thiếu `id`');
    else if (seen.has(id)) res.errors.push('id lặp lại trong patch — gộp các thay đổi vào một item');
    else if (!bank.byId.has(id)) res.errors.push('id không tồn tại trong ngân hàng (hoặc câu đang lỗi định dạng)');
    if (res.errors.length) return;
    seen.add(id);
    const q = bank.byId.get(id)!;
    res.file = q.file;
    byFile.set(q.file, [...(byFile.get(q.file) ?? []), { item, res }]);
  });

  // [v5] previous versions go to coach/patches/<run>.before.json before a pack is replaced (undo.ts)
  const preRun = opts.preImage === false ? undefined : (opts.preImage ?? opts.runId);
  for (const [fileRel, entries] of byFile) {
    const packAbs = path.join(DATA_DIR, fileRel);
    const { text: normalized, crlf } = normalizedText(fs.readFileSync(packAbs, 'utf8'));
    let text = normalized;
    let dirty = false;
    const preImages: PreImageInput[] = [];

    for (const { item, res } of entries) {
      const before = parsePack(text, fileRel, tax);
      const cur = before.questions.find((q) => q.id === res.id);
      if (!cur) {
        res.errors.push('không tìm thấy câu trong pack (lỗi định dạng?)');
        continue;
      }
      const base = str(item.base)?.trim();
      if (!base) {
        res.errors.push(`thiếu \`base\` (hash hiện tại: ${cur.hash})`);
        continue;
      }
      let effective = item;
      if (base !== cur.hash && ledger[res.id] === cur.hash) {
        // re-running the same patch (after fixing other items, file-mode post-check, repair round): this item produced the
        // current version and nothing changed since → done. Never apply it again: its letters may follow an older answer
        // layout that the first run re-keyed, and re-applying them to the new layout would swap option texts.
        res.status = 'unchanged';
        res.hash = cur.hash;
        continue;
      }
      if (base !== cur.hash) {
        const remap = migrationRemap(cur, [base, ledger[res.id]].filter(Boolean), migrations);
        if (!remap) {
          res.status = 'skipped';
          res.errors.push(
            `base ${base} ≠ hash hiện tại ${cur.hash} — câu đã đổi sau khi tạo lô (người dùng sửa, hoặc đổi vị trí đáp án): đọc lại câu trong pack; nếu thay đổi vẫn đúng với nội dung hiện tại thì cập nhật base (kiểm tra lại chữ cái trong options/answer theo thứ tự hiện tại), không thì bỏ item`,
          );
          continue;
        }
        effective = rekeyItem(item, remap.map);
        const moved = Object.entries(remap.map).filter(([a, b]) => a !== b);
        if (moved.length && (item.options !== undefined || item.answer !== undefined)) {
          res.warnings.push(`patch theo bố cục đáp án cũ (${remap.via.join(', ')}) — đã đổi khoá ${moved.map(([a, b]) => `${a}→${b}`).join(' ')}`);
        }
      }
      const built = buildDraft(cur, effective, tax);
      res.changes = built.changes;
      res.warnings.push(...built.warnings);
      res.errors.push(...built.errors);
      if (res.errors.length) continue;
      contentChecks(cur, built.draft, built.changes, res.errors, res.warnings);
      if (res.errors.length) continue;

      const d = built.draft;
      if (!built.statusOnly && d.enriched !== today) {
        d.enriched = today;
        if (!built.changes.length) built.changes.push('đã duyệt');
      }
      const lines = text.split('\n');
      const blk = findBlock(lines, res.id, bodyStartIndex(text));
      if (!blk) {
        res.errors.push('không định vị được block câu hỏi trong pack');
        continue;
      }
      const newBlock = serializeQuestion(d).replace(/\n+$/, '').split('\n');
      const oldBlock = lines.slice(blk.start, blk.end);
      if (newBlock.join('\n') === oldBlock.join('\n')) {
        res.status = 'unchanged';
        res.hash = cur.hash;
        ledger[res.id] = cur.hash;
        continue;
      }
      const candidate = [...lines.slice(0, blk.start), ...newBlock, ...lines.slice(blk.end)].join('\n');
      const after = parsePack(candidate, fileRel, tax);
      const q2 = after.questions.find((q) => q.id === res.id);
      const idsBefore = before.questions.map((q) => q.id).join(',');
      const idsAfter = after.questions.map((q) => q.id).join(',');
      const newErrors = [...problemSet(after.problems, res.id, 'error')].filter((m) => !problemSet(before.problems, res.id, 'error').has(m));
      const oldWarn = problemSet(before.problems, res.id, 'warning');
      const newWarnings = [...problemSet(after.problems, res.id, 'warning')].filter((m) => !oldWarn.has(m));
      if (!q2 || idsAfter !== idsBefore) newErrors.push('sau khi ghi, pack không còn parse đúng block này (kiểm tra stem/explanation)');
      const explanationChanged = built.changes.includes('explanation');
      if (explanationChanged && q2 && LETTER_REF_RE.test(q2.explanation.replace(/\*\*Answer:?\*\*.*$/m, ''))) {
        newErrors.push('explanation nhắc tới chữ cái đáp án (vd "option B", "answer a", "(C)", "= D", dòng bắt đầu "A:"/"A.") — app xáo thứ tự đáp án: gọi lựa chọn bằng nội dung');
      }
      // item-writing flaws (lint.ts) this item introduces: high severity → rejected, others → warnings
      const lint = q2 ? lintDelta(cur, q2, tax, opts.lint) : { errors: [], warnings: [] };
      const lettersReported = newErrors.some((e) => e.startsWith('explanation nhắc tới chữ cái'));
      newErrors.push(...lint.errors.filter((e) => !(lettersReported && e.includes('[letter-ref'))));
      if (newErrors.length) {
        res.errors.push(...newErrors);
        continue; // reverted: `text` stays as before this item
      }
      res.warnings.push(...newWarnings.filter((m) => !/option letters/i.test(m)), ...lint.warnings);
      text = candidate;
      dirty = true;
      res.status = 'applied';
      res.hash = q2!.hash;
      ledger[res.id] = q2!.hash;
      if (preRun) preImages.push({ id: res.id, file: fileRel, before: oldBlock.join('\n'), beforeSig: questionSig(cur), afterSig: questionSig(q2!) });
    }

    if (dirty) {
      result.files.push(fileRel);
      if (!opts.dryRun) {
        if (preRun && preImages.length) {
          try {
            recordPreImages(preRun, preImages, { at: localIso() });
          } catch (e) {
            // an undo record must never block the edit itself — but say so
            for (const p of preImages) result.items.find((r) => r.id === p.id)?.warnings.push(`không lưu được bản trước khi sửa (↩️ hoàn tác): ${(e as Error).message}`);
          }
        }
        writePackText(packAbs, text, crlf);
      }
    }
  }

  for (const r of result.items) {
    if (r.status === 'failed' && !r.errors.length) r.errors.push('lỗi không xác định');
    result[r.status]++;
  }
  if (!opts.dryRun && ledgerFile && JSON.stringify(ledger) !== ledgerBefore) {
    try {
      fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1) + '\n');
    } catch {
      // the ledger only helps re-runs; never fail the patch because of it
    }
  }
  return result;
}

/** `<patch>.applied.json`: qid → content hash produced by this patch (lets a re-run recognise its own edits). */
export function ledgerPath(patchAbs: string): string {
  return patchAbs.replace(/\.ya?ml$/i, '') + '.applied.json';
}

/** A follow-up apply (repair round) laid over the first result: per question id the later result wins. */
export function combineResults(first: PatchResult, later: PatchResult): PatchResult {
  const byId = new Map(first.items.map((it) => [it.id, it]));
  for (const it of later.items) byId.set(it.id, it);
  const items = [...byId.values()];
  const count = (s: PatchItemResult['status']) => items.filter((i) => i.status === s).length;
  return {
    ...first,
    items,
    applied: count('applied'),
    unchanged: count('unchanged'),
    skipped: count('skipped'),
    failed: count('failed'),
    files: [...new Set([...first.files, ...later.files])],
    error: later.error ?? first.error,
  };
}

function readLedger(file: string): Record<string, string> {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Human-readable report lines (CLI + coach run log). */
export function formatPatchResult(r: PatchResult): string[] {
  const out: string[] = [];
  if (r.error) {
    out.push(`❌ ${r.error}`);
    return out;
  }
  const icon = { applied: '✅', unchanged: '➖', skipped: '⏭ ', failed: '❌' } as const;
  for (const it of r.items) {
    const detail =
      it.status === 'applied' ? it.changes.join(' · ') : it.status === 'unchanged' ? 'không đổi (đã áp dụng trước đó)' : it.errors.join(' | ');
    out.push(`${icon[it.status]} ${it.id}  ${detail}${it.hash && it.status === 'applied' ? `  → base mới ${it.hash}` : ''}`);
    for (const w of it.warnings) out.push(`   ⚠️  ${w}`);
  }
  out.push(
    '',
    `${r.failed || r.skipped ? '✗' : '✓'} ${r.dryRun ? '[dry-run] ' : ''}${r.applied} áp dụng · ${r.unchanged} không đổi · ${r.skipped} bỏ qua · ${r.failed} lỗi` +
      (r.files.length ? ` → ${r.files.join(', ')}` : ''),
  );
  if (r.skipped && r.skipped >= Math.max(2, r.items.length / 2)) {
    out.push('ℹ️  Phần lớn item bị bỏ qua vì base: lô này được tạo trước khi ngân hàng đổi (vd đổi vị trí đáp án) — nên tạo lô ENRICH mới thay vì sửa base từng câu.');
  }
  return out;
}
