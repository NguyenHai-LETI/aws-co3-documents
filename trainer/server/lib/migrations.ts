// Bank data migrations (owner: bank & quality).
// - Answer-position rebalance: a canonical option order per question (seeded by the question id,
//   independent of the current order → idempotent) that spreads correct letters evenly; option-letter
//   references in explanations are rewritten as option text.
// - migrateResults(): rewrites option letters in result files written before a layout change
//   (bank/migrations/*.json) so they match the current bank. Idempotent; called at server start.
// - Pack-file helpers that rewrite single question blocks / metadata lines and keep everything else.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, MIGRATIONS_DIR, RESULTS_DIR } from '../config.ts';
import { listMarkdownFiles } from './bank.ts';
import { asStringList, splitFrontMatter, stringifyFrontMatter } from './frontmatter.ts';
import { fileSig } from './index-db.ts';
import { resultParses } from './results.ts';
import { LETTER_REF_RE, parsePack, serializeQuestion, toDraft } from './pack-format.ts';
import { localIso, stampParts } from './time.ts';
import type { Option, Question, Taxonomy } from '../../shared/types.ts';

// ── migration records ───────────────────────────────────────────────────────

export interface MigrationRecord {
  id: string; // file name without .json, e.g. 2026-10-16-rebalance-answers
  applied: string; // ISO time the packs were rewritten — results graded before it used the old letters
  kind: string; // 'rebalance-answers' | 'import-layout'
  note?: string;
  questions: Record<string, Record<string, string>>; // qid → { old letter: new letter }
  answers?: Record<string, [string, string]>; // qid → [old answer, new answer] — detects the layout of a result file
}

export function loadMigrations(dir: string = MIGRATIONS_DIR): MigrationRecord[] {
  if (!fs.existsSync(dir)) return [];
  const out: MigrationRecord[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as MigrationRecord;
      if (r && typeof r.id === 'string' && typeof r.applied === 'string' && r.questions && typeof r.questions === 'object') out.push(r);
      else console.warn(`migration ${f}: missing id/applied/questions — ignored`);
    } catch (e) {
      console.warn(`migration ${f}: ${(e as Error).message} — ignored`);
    }
  }
  return out.sort((a, b) => Date.parse(a.applied) - Date.parse(b.applied) || a.id.localeCompare(b.id));
}

/** Writes bank/migrations/<date>-<name>[-n].json and returns the stored record. */
export function writeMigration(
  name: string,
  rec: Omit<MigrationRecord, 'id' | 'applied'>,
  opts: { dir?: string; applied?: Date } = {},
): MigrationRecord {
  const dir = opts.dir ?? MIGRATIONS_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const when = opts.applied ?? new Date();
  const base = `${stampParts(when).date}-${name}`;
  let id = base;
  for (let i = 2; fs.existsSync(path.join(dir, `${id}.json`)); i++) id = `${base}-${i}`;
  const full: MigrationRecord = { id, applied: localIso(when), ...rec };
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(full, null, 2) + '\n');
  return full;
}

// ── canonical answer layout ─────────────────────────────────────────────────

const sha = (s: string) => crypto.createHash('sha1').update(s).digest('hex');
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

export interface LayoutInput {
  id: string;
  options: Option[];
  answer: string[];
}

export interface Layout {
  options: Option[]; // re-keyed A, B, C… in the new order
  answer: string[];
  mapping: Record<string, string>; // old key → new key
  changed: boolean;
}

// Options that point at other options ("Both A and C", "All of the above") must keep their positions.
const POSITIONAL_WORDS = /\b(?:all|none|both|either|neither) of (?:the )?(?:above|below|these|the options|the following)\b/i;
const POSITIONAL_LETTERS = /\b(?:[Oo]ptions?|[Aa]nswers?|[Cc]hoices?)\s+[A-H]\b|\b[A-H]\s+(?:and|or|&)\s+[A-H]\b/;

export function isPositional(q: LayoutInput): boolean {
  return q.options.some((o) => POSITIONAL_WORDS.test(o.text) || POSITIONAL_LETTERS.test(o.text));
}

/**
 * Target slot (0-based) of the correct option for every single-answer question of a pack:
 * per option count, a round-robin over the questions ordered by sha1(id), starting at a slot
 * derived from the pack id — even spread, deterministic, independent of file order.
 */
export function assignTargets(questions: LayoutInput[], packId: string): Map<string, number> {
  const groups = new Map<number, LayoutInput[]>();
  for (const q of questions) {
    if (q.answer.length !== 1 || q.options.length < 2 || isPositional(q)) continue;
    const g = groups.get(q.options.length) ?? [];
    g.push(q);
    groups.set(q.options.length, g);
  }
  const out = new Map<string, number>();
  for (const [n, qs] of groups) {
    const ordered = [...qs].sort((a, b) => sha(a.id).localeCompare(sha(b.id)) || a.id.localeCompare(b.id));
    const start = parseInt(sha(`${packId}#${n}`).slice(0, 8), 16) % n;
    ordered.forEach((q, i) => out.set(q.id, (start + i) % n));
  }
  return out;
}

/**
 * Canonical order: distractors (or, for multiple-response questions, all options) sorted by
 * sha1(id + option text) — a seeded permutation that does not depend on the current order, so
 * re-running gives the same layout. A single correct option is placed at `target`.
 */
export function canonicalLayout(q: LayoutInput, target?: number): Layout {
  const rank = new Map(q.options.map((o) => [o, sha(`${q.id}\n${norm(o.text)}`)]));
  const byRank = (a: Option, b: Option) => rank.get(a)!.localeCompare(rank.get(b)!) || a.key.localeCompare(b.key);
  const correct = q.answer.length === 1 ? q.options.find((o) => o.key === q.answer[0]) : undefined;
  let order: Option[];
  if (correct && target !== undefined) {
    order = q.options.filter((o) => o !== correct).sort(byRank);
    order.splice(Math.max(0, Math.min(target, order.length)), 0, correct);
  } else {
    order = [...q.options].sort(byRank);
  }
  const pairs: [string, string][] = [];
  const options = order.map((o, i) => {
    const key = String.fromCharCode(65 + i);
    pairs.push([o.key, key]);
    return { key, text: o.text };
  });
  const mapping = Object.fromEntries(pairs.sort(([a], [b]) => a.localeCompare(b)));
  const answer = q.answer.map((k) => mapping[k] ?? k).sort();
  return { options, answer, mapping, changed: !isIdentity(mapping) };
}

/** old key → new key by matching option texts; undefined when the option sets differ. */
export function mappingByText(before: Option[], after: Option[]): Record<string, string> | undefined {
  if (before.length !== after.length) return undefined;
  const free = new Map<string, string[]>();
  for (const o of after) free.set(norm(o.text), [...(free.get(norm(o.text)) ?? []), o.key]);
  const mapping: Record<string, string> = {};
  for (const o of before) {
    const keys = free.get(norm(o.text));
    const k = keys?.includes(o.key) ? o.key : keys?.[0]; // identical texts: keep the key if possible
    if (!k) return undefined;
    keys!.splice(keys!.indexOf(k), 1);
    mapping[o.key] = k;
  }
  return mapping;
}

export const isIdentity = (m: Record<string, string>) => Object.entries(m).every(([a, b]) => a === b);

// ── option-letter references in explanations ───────────────────────────────

function quoteOption(text: string, max = 90): string {
  let t = text.replace(/\s+/g, ' ').trim();
  if (t.length > max) {
    const cut = t.slice(0, max);
    t = (cut.lastIndexOf(' ') > max * 0.6 ? cut.slice(0, cut.lastIndexOf(' ')) : cut).replace(/[\s,;:.]+$/, '') + '…';
  }
  return `“${t}”`;
}

/** Explanation text as the validator checks it (an embedded "**Answer:** B" line is fine). */
export const hasLetterRef = (explanation: string) => LETTER_REF_RE.test(explanation.replace(/\*\*Answer:?\*\*.*$/m, ''));

/**
 * Replaces option-letter references ("- A: …", "(B)", "option C", "cheapest = A", "answers A and D")
 * with the quoted option text, so the explanation survives any option order. Only capital letters
 * that exist as options are replaced (a lowercase "(a)" is more likely an enumeration).
 */
export function replaceLetterRefs(text: string, options: Option[]): { text: string; replaced: number } {
  const byKey = new Map(options.map((o) => [o.key, o.text]));
  let replaced = 0;
  const sub = (letter: string): string | undefined => {
    const t = byKey.get(letter);
    if (t === undefined) return undefined;
    replaced++;
    return quoteOption(t);
  };
  let out = text;
  // 1. line labels: "- A: …", "A) …", "(B) …", "* C — …"
  out = out.replace(/(^|\n)([ \t]*(?:[-*][ \t]*)?)\(?([A-H])(\)[ \t]*[:.–—-]?|[ \t]*[:.)–—-])(?=\s)/g, (m, nl: string, lead: string, letter: string, tail: string) => {
    const t = sub(letter);
    if (t === undefined) return m;
    const p = tail.replace(/^\)/, '').trim();
    return `${nl}${lead}${t}${!p || p === '.' || p === ':' ? ':' : ` ${p}`}`;
  });
  // 2. "option B", "answers A and C", "đáp án D"
  out = out.replace(
    /(?<![\p{L}\p{N}])((?:[Oo]ptions?|OPTIONS?|[Aa]nswers?|ANSWERS?|[Cc]hoices?|[Đđ]áp án)\s+)([A-H](?:\s*(?:,|and|or|&|\/)\s*[A-H])*)(?![\p{L}\p{N}])/gu,
    (m, word: string, letters: string) => {
      const keys = letters.match(/[A-H]/g) ?? [];
      if (!keys.every((k) => byKey.has(k))) return m;
      return word + letters.replace(/[A-H]/g, (k) => sub(k)!);
    },
  );
  // 3. "cheapest = A"
  out = out.replace(/=(\s*)([A-H])(?![\p{L}\p{N}_])/gu, (m, sp: string, letter: string) => {
    const t = sub(letter);
    return t === undefined ? m : `=${sp}${t}`;
  });
  // 4. "(A)" inside a sentence
  out = out.replace(/\(([A-H])\)/g, (m, letter: string) => {
    const t = sub(letter);
    return t === undefined ? m : `(${t})`;
  });
  return { text: out, replaced };
}

// ── pack files: question blocks ─────────────────────────────────────────────

const Q_HEADING = /^##\s+Q:?\s+(\S+)(.*)$/;
const OTHER_HEADING = /^#{1,2}\s/;
const SEPARATOR = /^\s*(---|\*\*\*|___)\s*$/;
const META_LINE = /^\s*[-*]\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/;
const OPTION_LINE = /^\s*[-*]\s+(?:\[([ xX])\]\s+)?([A-H])[.)]\s+(.*)$/;

export interface BlockSpan {
  id: string;
  start: number; // line index of "## Q id"
  end: number; // last content line (trailing blank lines and "---" separators excluded)
}

/** Lines (LF) of a pack file and the span of every question block, in file order. */
export function questionBlocks(text: string): { lines: string[]; blocks: BlockSpan[] } {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  let i = 0;
  if (src.startsWith('---\n')) {
    const end = src.indexOf('\n---', 4); // same rule as splitFrontMatter
    if (end >= 0) i = src.slice(0, end + 1).split('\n').length;
  }
  const blocks: BlockSpan[] = [];
  let cur: BlockSpan | undefined;
  for (; i < lines.length; i++) {
    const m = lines[i].match(Q_HEADING);
    if (m) {
      cur = { id: m[1].trim(), start: i, end: i };
      blocks.push(cur);
    } else if (OTHER_HEADING.test(lines[i])) {
      cur = undefined;
    } else if (cur && lines[i].trim() && !SEPARATOR.test(lines[i])) {
      cur.end = i;
    }
  }
  return { lines, blocks };
}

/** First block per id (later duplicates are ignored by the bank too). */
function firstBlocks(blocks: BlockSpan[]): BlockSpan[] {
  const seen = new Set<string>();
  return blocks.filter((b) => !seen.has(b.id) && seen.add(b.id));
}

/** Replaces whole question blocks (heading … explanation); front matter, intro and separators stay. */
export function replaceQuestionBlocks(text: string, replacements: Map<string, string>): { text: string; replaced: string[] } {
  const { lines, blocks } = questionBlocks(text);
  const replaced: string[] = [];
  for (const b of firstBlocks(blocks).reverse()) {
    const r = replacements.get(b.id);
    if (r === undefined) continue;
    lines.splice(b.start, b.end - b.start + 1, ...r.replace(/\s+$/, '').split('\n'));
    replaced.push(b.id);
  }
  return { text: lines.join('\n'), replaced: replaced.reverse() };
}

/**
 * Sets one metadata line `- key: value` for several questions of a pack (value per id). An existing
 * line is updated in place; otherwise the line goes after `- domain:` (or at the end of the metadata).
 */
export function setQuestionMeta(text: string, key: string, values: Map<string, string>): { text: string; changed: string[] } {
  const { lines, blocks } = questionBlocks(text);
  const changed: string[] = [];
  for (const b of firstBlocks(blocks).reverse()) {
    const value = values.get(b.id);
    if (value === undefined) continue;
    let j = b.start + 1;
    while (j <= b.end && !lines[j].trim()) j++;
    let insertAt = b.start + 1;
    let afterDomain = -1;
    let done = false;
    for (; j <= b.end; j++) {
      const m = lines[j].match(META_LINE);
      if (!m || OPTION_LINE.test(lines[j])) break;
      const k = m[1].toLowerCase();
      if (k === key) {
        const next = `${lines[j].slice(0, lines[j].indexOf(':') + 1)} ${value}`;
        if (next !== lines[j]) {
          lines[j] = next;
          changed.push(b.id);
        }
        done = true;
        break;
      }
      if (k === 'domain') afterDomain = j + 1;
      insertAt = j + 1;
    }
    if (done) continue;
    lines.splice(afterDomain > 0 ? afterDomain : insertAt, 0, `- ${key}: ${value}`);
    changed.push(b.id);
  }
  return { text: lines.join('\n'), changed: changed.reverse() };
}

// ── rebalance one pack ──────────────────────────────────────────────────────

export interface RebalanceChange {
  id: string;
  mapping: Record<string, string>; // old → new (identity when only the explanation changed)
  before: string; // answer before, e.g. "A" or "AB"
  after: string;
  explanationRefs: number; // letter references replaced in the explanation
}

export interface RebalanceResult {
  text: string;
  packId: string;
  questions: Question[]; // parsed questions (before)
  changes: RebalanceChange[];
  positional: string[]; // kept in place: options refer to other options
  unresolved: string[]; // still refers to option letters after the rewrite (fix by hand)
  problems: string[]; // verification failures — do not write the file when non-empty
}

/** Rewrites the question blocks of one pack with the canonical layout (pure: no I/O). */
export function rebalancePackText(text: string, file: string, tax: Taxonomy): RebalanceResult {
  const parsed = parsePack(text, file, tax);
  const seen = new Set<string>();
  const questions = parsed.questions.filter((q) => !seen.has(q.id) && seen.add(q.id));
  const targets = assignTargets(questions, parsed.pack.id);
  const changes: RebalanceChange[] = [];
  const positional: string[] = [];
  const unresolved: string[] = [];
  const replacements = new Map<string, string>();
  for (const q of questions) {
    const refs = replaceLetterRefs(q.explanation, q.options); // same call as the importer → identical output
    if (hasLetterRef(refs.text)) unresolved.push(q.id);
    const fixed = isPositional(q);
    if (fixed) positional.push(q.id);
    const layout = fixed ? undefined : canonicalLayout(q, targets.get(q.id));
    if (!layout?.changed && refs.text === q.explanation) continue;
    const draft = toDraft(q);
    if (layout) {
      draft.options = layout.options;
      draft.answer = layout.answer;
    }
    draft.explanation = refs.text;
    replacements.set(q.id, serializeQuestion(draft));
    const mapping = layout?.mapping ?? Object.fromEntries(q.options.map((o) => [o.key, o.key]));
    changes.push({ id: q.id, mapping, before: q.answer.join(''), after: (layout?.answer ?? q.answer).join(''), explanationRefs: refs.replaced });
  }
  const out = replaceQuestionBlocks(text, replacements);

  // verification: same questions, same option texts, same correct texts, no new errors
  const problems: string[] = [];
  const again = parsePack(out.text, file, tax);
  const errors = (p: typeof parsed) => p.problems.filter((x) => x.level === 'error').length;
  if (errors(again) > errors(parsed)) problems.push(`${file}: rewrite introduced ${errors(again) - errors(parsed)} error(s)`);
  const after = new Map(again.questions.map((q) => [q.id, q]));
  const texts = (q: Question, keys?: string[]) => q.options.filter((o) => !keys || keys.includes(o.key)).map((o) => norm(o.text)).sort().join('\n');
  for (const q of questions) {
    const a = after.get(q.id);
    if (!a) problems.push(`${q.id}: missing after rewrite`);
    else if (texts(a) !== texts(q)) problems.push(`${q.id}: option texts changed`);
    else if (texts(a, a.answer) !== texts(q, q.answer)) problems.push(`${q.id}: correct option changed`);
  }
  if (again.questions.length !== parsed.questions.length) problems.push(`${file}: ${parsed.questions.length} → ${again.questions.length} questions`);
  return { text: out.text, packId: parsed.pack.id, questions, changes, positional, unresolved, problems };
}

/** Letter distribution of the correct option of single-answer questions (+ multi-answer key combos). */
export function letterDistribution(questions: { answer: string[] }[]): { single: Record<string, number>; multi: Record<string, number> } {
  const single: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  const multi: Record<string, number> = {};
  for (const q of questions) {
    if (q.answer.length === 1) single[q.answer[0]] = (single[q.answer[0]] ?? 0) + 1;
    else if (q.answer.length > 1) multi[q.answer.join('')] = (multi[q.answer.join('')] ?? 0) + 1;
  }
  return { single, multi };
}

// ── results ─────────────────────────────────────────────────────────────────

export const layoutNote = (id: string) => `> ℹ️ Ký tự đáp án đã chuyển theo bố cục mới (${id})`;

/** Remaps a key string ("BD") through old → new letters; result sorted like normalizeKeys(). */
export function remapKeys(keys: string, map: Record<string, string>): string {
  return [...new Set([...keys].map((k) => map[k] ?? k))].sort().join('');
}

const normKeys = (v: unknown) => [...new Set(String(v ?? '').toUpperCase().match(/[A-H]/g) ?? [])].sort().join('');

/**
 * Was this result file graded with the layout before migration `m`? Decided by the answer records
 * whose correct letters moved (key = old answer vs new answer). Without such records: written by the
 * old code (no `layout ≥ 2`) and finished before the migration was applied.
 */
function gradedBefore(answers: Record<string, unknown>[], m: MigrationRecord, finished: number, layout: number): boolean {
  let before = 0;
  let after = 0;
  for (const a of answers) {
    const pair = m.answers?.[String(a.q)];
    if (!pair || pair[0] === pair[1]) continue;
    const key = normKeys(a.key);
    if (key === pair[0]) before++;
    else if (key === pair[1]) after++;
  }
  if (before !== after) return before > after;
  return layout < 2 && !(finished >= Date.parse(m.applied));
}

const attemptAnswers = (data: Record<string, unknown>) => (data.answers as unknown[]).filter((a): a is Record<string, unknown> => !!a && typeof a === 'object');

/**
 * Applies every pending migration to the front matter of one attempt (mutates `data`); returns the applied ids.
 * A migration changes the letters, so later migrations are decided on the already remapped answers.
 */
function applyMigrations(data: Record<string, unknown>, migrations: MigrationRecord[]): string[] {
  const answers = attemptAnswers(data);
  const done = asStringList(data.migrations);
  const layout = Number(data.layout) || 0;
  const finished = Date.parse(String(data.finished ?? ''));
  const applied: string[] = [];
  for (const m of migrations) {
    if (done.includes(m.id) || !answers.some((a) => m.questions[String(a.q)])) continue;
    if (!gradedBefore(answers, m, finished, layout)) continue;
    for (const a of answers) {
      const map = m.questions[String(a.q)];
      if (!map) continue;
      a.pick = remapKeys(String(a.pick ?? ''), map);
      a.key = remapKeys(String(a.key ?? ''), map);
      if (typeof a.elim === 'string') a.elim = remapKeys(a.elim, map);
      else if (Array.isArray(a.elim)) a.elim = a.elim.map((k) => map[String(k)] ?? String(k));
    }
    applied.push(m.id);
  }
  return applied;
}

/**
 * Would applyMigrations() change this file? Read-only, so it can run on the shared parse cache: nothing is remapped
 * before the first migration that applies, hence the first `gradedBefore` hit decides exactly.
 */
function needsMigration(data: Record<string, unknown>, migrations: MigrationRecord[]): boolean {
  if (data.kind !== 'attempt' || !Array.isArray(data.answers)) return false;
  const answers = attemptAnswers(data);
  const done = asStringList(data.migrations);
  const layout = Number(data.layout) || 0;
  const finished = Date.parse(String(data.finished ?? ''));
  return migrations.some((m) => !done.includes(m.id) && answers.some((a) => m.questions[String(a.q)]) && gradedBefore(answers, m, finished, layout));
}

/**
 * Rewrites `pick`, `key`, `elim` letters of result files graded before a layout migration, sets
 * `layout: 2`, records the migration id in `migrations:` (idempotence) and appends a note to the body.
 * The check runs on the shared parse cache (no YAML parse when the SQLite cache knows the file, and the parse done
 * here is reused by loadAttempts() at startup); only files that change are read and parsed again.
 */
export function migrateResults(opts: { resultsDir?: string; migrationsDir?: string } = {}): { migrated: number; files: string[] } {
  const migrations = loadMigrations(opts.migrationsDir ?? MIGRATIONS_DIR);
  if (!migrations.length) return { migrated: 0, files: [] };
  const files: string[] = [];
  const entries = listMarkdownFiles(opts.resultsDir ?? RESULTS_DIR).map((abs) => ({ abs, sig: fileSig(abs) }));
  resultParses.prefetch(entries);
  for (const { abs, sig } of entries) {
    if (!sig) continue;
    const cached = resultParses.get(abs, sig).data;
    if (!abs.startsWith(DATA_DIR + path.sep)) resultParses.forget(abs); // temp dirs (tests): nothing will reuse it
    if (!cached || !needsMigration(cached, migrations)) continue;
    let text: string;
    try {
      text = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const fm = splitFrontMatter(text);
    if (fm.error || !fm.hasFrontMatter || fm.data.kind !== 'attempt' || !Array.isArray(fm.data.answers)) continue;
    const data = fm.data;
    const done = asStringList(data.migrations);
    const layout = Number(data.layout) || 0;
    const applied = applyMigrations(data, migrations);
    if (!applied.length) continue;

    // keep key order; new keys go right before the (long) answers list
    const out: Record<string, unknown> = {};
    const extra = { layout: Math.max(2, layout), migrations: [...done, ...applied] };
    for (const [k, v] of Object.entries(data)) {
      if (k === 'answers') {
        if (!('layout' in data)) out.layout = extra.layout;
        if (!('migrations' in data)) out.migrations = extra.migrations;
      }
      out[k] = k === 'layout' ? extra.layout : k === 'migrations' ? extra.migrations : v;
    }
    const body = `${fm.body.replace(/\s+$/, '')}\n\n${applied.map(layoutNote).join('\n\n')}\n`;
    const tmp = `${abs}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, stringifyFrontMatter(out, ['answers']) + body);
    fs.renameSync(tmp, abs);
    resultParses.drop(abs); // rewritten: the stored parse is outdated
    files.push(abs);
  }
  resultParses.flush(); // parses done here are stored for the next start
  return { migrated: files.length, files };
}
