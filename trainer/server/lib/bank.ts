import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PACKS_DIR, TAXONOMY_FILE, rel } from '../config.ts';
import { loadTaxonomy, outOfScopeIn } from './taxonomy.ts';
import { parsePack, type ParsedPack } from './pack-format.ts';
import type { BankProblem, Pack, Question, Taxonomy } from '../../shared/types.ts';

// ── computed fields: requirement categories (B4) and exam scope (B5) ────────────────────────────────────────

/** Requirement category of a negative question (NOT / EXCEPT / LEAST likely…) — not a taxonomy.keywords group. */
export const NEGATIVE_REQUIREMENT = 'negative';

interface RequirementMatcher {
  re: RegExp | null;
  cats: string[]; // capture group i + 1 → category
  order: string[]; // categories in taxonomy order (output order)
}

const reqMemo = new WeakMap<Taxonomy, RequirementMatcher>();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const WB_BEFORE = '(?<![\\p{L}\\p{N}_])';
const WB_AFTER = '(?![\\p{L}\\p{N}_])';

/** Same rules as the stem highlighter (web/lib/keywords.ts): an ALL-CAPS word is case-sensitive, any other word is not. */
function keywordWord(word: string): string {
  if (/^[A-Z][A-Z0-9]+$/.test(word)) return escapeRe(word);
  return [...word].map((ch) => (/[a-z]/i.test(ch) ? `[${ch.toLowerCase()}${ch.toUpperCase()}]` : escapeRe(ch))).join('');
}

function keywordPhrase(phrase: string): string | null {
  let p = phrase.trim();
  const prefix = p.endsWith('*');
  if (prefix) p = p.slice(0, -1).trim();
  const words = p.split(/\s+/).filter(Boolean);
  return words.length ? words.map(keywordWord).join('\\s+') + (prefix ? '[\\p{L}\\p{N}]*' : '') : null;
}

/** One regex over every taxonomy.keywords phrase except the `qualifier` group, longest phrase first. */
function requirementMatcher(tax: Taxonomy): RequirementMatcher {
  let m = reqMemo.get(tax);
  if (m) return m;
  const seen = new Set<string>();
  const entries: { phrase: string; cat: string; src: string }[] = [];
  const order: string[] = [];
  for (const [cat, phrases] of Object.entries(tax.keywords ?? {})) {
    if (cat === 'qualifier' || !Array.isArray(phrases)) continue;
    order.push(cat);
    for (const phrase of phrases) {
      if (typeof phrase !== 'string') continue;
      const src = keywordPhrase(phrase);
      if (!src || seen.has(phrase.trim())) continue; // first category wins, like the highlighter
      seen.add(phrase.trim());
      entries.push({ phrase: phrase.trim(), cat, src });
    }
  }
  entries.sort((a, b) => b.phrase.length - a.phrase.length);
  let re: RegExp | null = null;
  try {
    re = entries.length ? new RegExp(`${WB_BEFORE}(?:${entries.map((e) => `(${e.src})`).join('|')})${WB_AFTER}`, 'gu') : null;
  } catch {
    re = null; // malformed taxonomy phrase — no requirement categories rather than a broken bank
  }
  m = { re, cats: entries.map((e) => e.cat), order };
  reqMemo.set(tax, m);
  return m;
}

/** The sentence that asks the question: the last one with a "?", else the last sentence. */
function askedSentence(text: string): string {
  const parts = text.replace(/\s+/g, ' ').match(/[^.?!]+(?:[.?!]+|$)/g) ?? [text];
  const asked = parts.filter((p) => p.includes('?'));
  return (asked.length ? asked[asked.length - 1] : (parts[parts.length - 1] ?? '')).trim();
}

const NOT_IN_QUESTION = new RegExp(`\\b(?:[Ww]hich|[Ww]hat|[Ww]ho|[Hh]ow)\\b[^?]*?${WB_BEFORE}NOT${WB_AFTER}`, 'u');
const EXCEPT_RE = new RegExp(`${WB_BEFORE}EXCEPT${WB_AFTER}`, 'u');
// "LEAST likely / suitable / appropriate…" asks for the worst option; "LEAST operational overhead / cost / effort" is a
// requirement to optimise (ops / cost), not a negative question
const LEAST_NEGATIVE = new RegExp(`${WB_BEFORE}LEAST\\s+(?:likely|suitable|appropriate|accurate|correct|effective|useful|helpful|relevant|recommended|desirable|important|probable|valid|true)${WB_AFTER}`, 'u');

/** A negative question (the taxonomy `qualifier` words NOT / EXCEPT / LEAST used as a negation, written in capitals as on the exam). */
export function isNegativeStem(stem: string, tax: Taxonomy): boolean {
  const q = new Set(tax.keywords?.qualifier ?? []);
  const text = stem.replace(/[*`]/g, '');
  if (q.has('EXCEPT') && EXCEPT_RE.test(text)) return true;
  if (q.has('NOT') && NOT_IN_QUESTION.test(askedSentence(text))) return true;
  return q.has('LEAST') && LEAST_NEGATIVE.test(text);
}

/**
 * What the stem asks the answer to optimise: taxonomy.keywords groups found in the stem (cost, ops, resilient,
 * performance, secure — whole words, ALL-CAPS words case-sensitive) + `negative` for NOT / EXCEPT questions. [] = none.
 */
export function stemRequirements(stem: string, tax: Taxonomy): string[] {
  const m = requirementMatcher(tax);
  const text = (stem ?? '').replace(/[*`]/g, '');
  const found = new Set<string>();
  if (m.re) {
    for (const x of text.matchAll(m.re)) {
      const i = x.findIndex((g, k) => k > 0 && g !== undefined);
      if (i > 0) found.add(m.cats[i - 1]);
    }
  }
  const out = m.order.filter((c) => found.has(c));
  if (isNegativeStem(text, tax)) out.push(NEGATIVE_REQUIREMENT);
  return out;
}

/** Out-of-scope services (taxonomy `scope: out`) named by the correct option(s) of a question. */
export function correctOutOfScope(q: Pick<Question, 'options' | 'answer'>, tax: Taxonomy): string[] {
  const text = q.options.filter((o) => q.answer.includes(o.key)).map((o) => o.text).join('\n');
  return outOfScopeIn(text, tax);
}

/** Fills the computed fields that depend on the taxonomy (once per parse: the taxonomy is part of the file signature). */
function annotate(q: Question, tax: Taxonomy): void {
  q.requirements = stemRequirements(q.stem, tax);
  if (correctOutOfScope(q, tax).length) q.outOfScope = true;
  else delete q.outOfScope;
}

export interface BankState {
  version: string;
  taxonomy: Taxonomy;
  packs: Pack[];
  questions: Question[];
  byId: Map<string, Question>;
  problems: BankProblem[];
}

const fileCache = new Map<string, { sig: string; parsed: ParsedPack }>();
let bankCache: BankState | undefined;

export function listMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listMarkdownFiles(p));
    else if (e.isFile() && e.name.endsWith('.md') && e.name.toLowerCase() !== 'readme.md') out.push(p);
  }
  return out.sort();
}

/** Loads every pack, re-parsing only files whose mtime/size changed. Cheap enough to call per request. */
export function loadBank(): BankState {
  const tax = loadTaxonomy();
  const taxSig = String(fs.statSync(TAXONOMY_FILE).mtimeMs);
  const files = listMarkdownFiles(PACKS_DIR);
  const sigs = files.map((f) => {
    const st = fs.statSync(f);
    return `${f}:${st.mtimeMs}:${st.size}`;
  });
  const version = crypto.createHash('sha1').update(taxSig + '|' + sigs.join('|')).digest('hex').slice(0, 12);
  if (bankCache && bankCache.version === version) return bankCache;

  const packs: Pack[] = [];
  const questions: Question[] = [];
  const byId = new Map<string, Question>();
  const problems: BankProblem[] = [];
  const packIds = new Map<string, string>();

  files.forEach((abs, i) => {
    const sig = `${taxSig}|${sigs[i]}`;
    let entry = fileCache.get(abs);
    if (!entry || entry.sig !== sig) {
      entry = { sig, parsed: parsePack(fs.readFileSync(abs, 'utf8'), rel(abs), tax) };
      for (const q of entry.parsed.questions) annotate(q, tax);
      fileCache.set(abs, entry);
    }
    const { pack, questions: qs, problems: pr } = entry.parsed;
    problems.push(...pr);
    const dupPack = packIds.get(pack.id);
    if (dupPack) problems.push({ level: 'error', file: pack.file, line: 1, message: `Duplicate pack id "${pack.id}" (also in ${dupPack})` });
    packIds.set(pack.id, pack.file);
    let kept = 0;
    for (const q of qs) {
      const prev = byId.get(q.id);
      if (prev) {
        problems.push({ level: 'error', file: q.file, line: q.line, qid: q.id, message: `Duplicate question id (first defined in ${prev.file}:${prev.line}) — this copy is ignored` });
        continue;
      }
      byId.set(q.id, q);
      questions.push(q);
      kept++;
    }
    packs.push({ ...pack, count: kept, activeCount: qs.filter((q) => q.status === 'active' && byId.get(q.id) === q).length });
  });

  for (const q of questions) {
    for (const v of q.variantOf) {
      if (!byId.has(v)) problems.push({ level: 'warning', file: q.file, line: q.line, qid: q.id, message: `variant_of "${v}" does not exist` });
    }
  }
  for (const [abs] of fileCache) if (!files.includes(abs)) fileCache.delete(abs);

  bankCache = { version, taxonomy: tax, packs, questions, byId, problems };
  return bankCache;
}

export function activeQuestions(bank: BankState): Question[] {
  return bank.questions.filter((q) => q.status === 'active');
}
