// Full-text search over the question bank and the study notes (GET /api/search → the global search box).
// SQLite FTS5 in .cache/trainer.db (tokenizer `unicode61 remove_diacritics 2`, prefix indexes), refreshed incrementally:
// questions when the bank version changes, notes per file (mtime + size). Without SQLite / FTS5 the same documents are
// scanned in memory with the same matching rules. Vietnamese: the tokenizer removes diacritics, but "đ" is a letter of its
// own in Unicode, so it is folded to "d" before indexing and in queries ("dap an" finds "đáp án"). Snippets are cut from
// the original text here (not with snippet()), so they keep the Vietnamese spelling.
// Questions of a sealed form ([γ] sealed.ts) are never indexed nor found — not even by their exact id.
import fs from 'node:fs';
import { loadBank, type BankState } from './bank.ts';
import { listNotes, notePath, plainText, splitSections } from './notes.ts';
import { ftsAvailable, getMeta, setMeta, stmt, transaction, withDb } from './index-db.ts';
import { sealedIds, sealedKey } from './sealed.ts';
import type { Question, SearchHit, SearchResponse } from '../../shared/types.ts';
import type { DatabaseSync } from 'node:sqlite';

export type SearchScope = 'all' | 'questions' | 'notes';

const MAX_TOKENS = 8;
const SNIPPET_WORDS = 22;
/** Bump when what gets indexed changes (sections, plain text, fields): every note / question is indexed again. */
const INDEX_VERSION = 1;
const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu;

// ── folding & query building ────────────────────────────────────────────────

/** "đ"/"Đ" → "d"/"D": the one Vietnamese letter the unicode61 tokenizer does not fold (FTS input). */
export function foldD(s: string): string {
  return s.replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/** Comparison key of a word: no diacritics, đ → d, lower case. */
export function foldKey(s: string): string {
  return s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/đ/g, 'd');
}

/**
 * A folded query word. `prefix`: also matches longer words — the last word (still being typed) and words of ≥ 3
 * characters; shorter ones must match whole words, so "an" does not find "and" / "analytics".
 */
export interface QueryToken {
  t: string;
  prefix: boolean;
}

/** Folded query words (runs of letters / digits), at most 8, without duplicates. */
export function queryTokens(q: string): QueryToken[] {
  const ws: string[] = [];
  for (const w of foldKey(q).match(/[\p{L}\p{N}]+/gu) ?? []) if (!ws.includes(w) && ws.length < MAX_TOKENS) ws.push(w);
  return ws.map((t, i) => ({ t, prefix: t.length >= 3 || i === ws.length - 1 }));
}

export type MatchMode = 'phrase' | 'and' | 'or';

/**
 * FTS5 MATCH expression. Tokens contain letters and digits only and are always quoted, so user input never reaches the
 * query syntax. phrase = the words in this order (last one as prefix) · and = every word · or = any word of ≥ 3 letters.
 */
export function ftsMatch(tokens: QueryToken[], mode: MatchMode = 'and'): string {
  const term = (x: QueryToken) => `"${x.t}"${x.prefix ? '*' : ''}`;
  if (mode === 'phrase') return `"${tokens.map((x) => x.t).join(' ')}"${tokens.at(-1)?.prefix ? '*' : ''}`;
  if (mode === 'or') return tokens.filter((x) => x.t.length >= 3).map(term).join(' OR ');
  return tokens.map(term).join(' ');
}

const tokenHits = (key: string, tokens: QueryToken[]) => tokens.findIndex((x) => (x.prefix ? key.startsWith(x.t) : key === x.t));

// ── snippets ────────────────────────────────────────────────────────────────

interface Word {
  start: number;
  end: number;
  hit: number; // index of the matching query token, -1 = none
}

function words(text: string, tokens: QueryToken[]): Word[] {
  const out: Word[] = [];
  for (const m of text.matchAll(WORD_RE)) out.push({ start: m.index, end: m.index + m[0].length, hit: tokenHits(foldKey(m[0]), tokens) });
  return out;
}

/** Distinct query tokens found in a text. */
function tokensIn(text: string, tokens: QueryToken[]): number {
  return new Set(words(text, tokens).filter((w) => w.hit >= 0).map((w) => w.hit)).size;
}

/**
 * A window of `maxWords` words of the original text around the densest cluster of query words, matches wrapped in
 * «…», cut ends marked with "…". Without any match: the beginning of the text.
 */
export function makeSnippet(text: string, tokens: QueryToken[], maxWords = SNIPPET_WORDS): string {
  const ws = words(text, tokens);
  if (!ws.length) return text.slice(0, 160).trim();
  let start = 0;
  let best = [-1, -1];
  for (let i = 0; i < ws.length; i++) {
    if (ws[i].hit < 0) continue;
    const from = Math.max(0, i - 4); // a little context before the first match
    const win = ws.slice(from, from + maxWords).filter((w) => w.hit >= 0);
    const score = [new Set(win.map((w) => w.hit)).size, win.length];
    if (score[0] > best[0] || (score[0] === best[0] && score[1] > best[1])) {
      best = score;
      start = from;
    }
  }
  const end = Math.min(ws.length, start + maxWords);
  let out = '';
  let pos = ws[start].start;
  for (let k = start; k < end; k++) {
    if (ws[k].hit < 0) continue;
    out += `${text.slice(pos, ws[k].start)}«${text.slice(ws[k].start, ws[k].end)}»`;
    pos = ws[k].end;
  }
  out += text.slice(pos, end < ws.length ? ws[end - 1].end : text.length); // the end of the text keeps its punctuation
  return `${start > 0 ? '…' : ''}${out.replace(/\s+/g, ' ').trim()}${end < ws.length ? '…' : ''}`;
}

// ── documents ───────────────────────────────────────────────────────────────

interface QuestionDoc {
  q: Question;
  fields: string[]; // stem, options, explanation, concept/hint — plain text, original spelling
  tags: string; // id, topic, domain, task, pack, services, tags
}

const qDocsMemo = new WeakMap<BankState, { key: string; docs: QuestionDoc[] }>();
/** Searchable questions: the whole bank minus the sealed ones (memo per bank object and sealed set). */
function questionDocs(bank: BankState): QuestionDoc[] {
  const key = sealedKey();
  let hit = qDocsMemo.get(bank);
  if (!hit || hit.key !== key) {
    const sealed = sealedIds();
    const docs = bank.questions
      .filter((q) => !sealed.has(q.id))
      .map((q) => ({
        q,
        fields: [plainText(q.stem), q.options.map((o) => plainText(o.text)).join(' · '), plainText(q.explanation), [q.concept, q.hint].filter(Boolean).join(' · ')],
        tags: [q.id, q.topic, q.domain, q.task ?? '', q.pack, ...q.services, ...q.tags].join(' '),
      }));
    qDocsMemo.set(bank, (hit = { key, docs }));
  }
  return hit.docs;
}

interface NoteFile {
  file: string; // relative to the repo root (Notes page `f=`)
  abs: string;
  sig: string;
  title: string;
}

function noteFiles(): NoteFile[] {
  const out: NoteFile[] = [];
  for (const n of listNotes()) {
    if (!/\.(md|txt)$/i.test(n.file)) continue;
    const abs = notePath(n.file);
    if (!abs) continue;
    try {
      const st = fs.statSync(abs);
      out.push({ file: n.file, abs, sig: `${st.mtimeMs}:${st.size}:v${INDEX_VERSION}`, title: n.title });
    } catch {
      // vanished
    }
  }
  return out;
}

interface NoteDoc {
  file: string;
  title: string;
  heading: string;
  anchor: string;
  text: string;
}

const noteDocsMemo = new Map<string, { sig: string; docs: NoteDoc[] }>();
function noteDocs(n: NoteFile): NoteDoc[] {
  const hit = noteDocsMemo.get(n.abs);
  if (hit?.sig === n.sig) return hit.docs;
  let docs: NoteDoc[] = [];
  try {
    docs = splitSections(fs.readFileSync(n.abs, 'utf8')).map((s) => ({ file: n.file, title: n.title, heading: s.heading, anchor: s.anchor, text: s.text }));
  } catch {
    // unreadable → no sections
  }
  noteDocsMemo.set(n.abs, { sig: n.sig, docs });
  return docs;
}

// ── hits ────────────────────────────────────────────────────────────────────

function questionHit(bank: BankState, d: QuestionDoc, tokens: QueryToken[], score: number): SearchHit {
  // show the field that contains most query words (stem first on ties)
  let field = d.fields[0];
  let most = tokensIn(field, tokens);
  for (const f of d.fields.slice(1)) {
    const n = f ? tokensIn(f, tokens) : 0;
    if (n > most) [field, most] = [f, n];
  }
  const topic = bank.taxonomy.topics.find((t) => t.id === d.q.topic);
  return {
    kind: 'question',
    id: d.q.id,
    title: d.q.id,
    snippet: makeSnippet(field, tokens),
    score: Math.round(score * 1000) / 1000,
    sub: [topic ? `${topic.icon} ${topic.label}` : d.q.topic, d.q.pack].join(' · '),
    status: d.q.status,
  };
}

function noteHit(d: { file: string; title: string; heading: string; anchor: string; text: string }, tokens: QueryToken[], score: number): SearchHit {
  return {
    kind: 'note',
    id: d.file,
    title: d.heading || d.title,
    snippet: makeSnippet(d.text || d.heading, tokens),
    score: Math.round(score * 1000) / 1000,
    anchor: d.anchor || undefined,
    sub: d.heading && d.title !== d.heading ? `${d.title} · ${d.file}` : d.file,
  };
}

/** Exact question id typed into the box → that question first (never a sealed one). */
function exactId(bank: BankState, q: string): Question | undefined {
  const id = q.trim();
  const hit = bank.byId.get(id) ?? bank.questions.find((x) => x.id.toLowerCase() === id.toLowerCase());
  return hit && !sealedIds().has(hit.id) ? hit : undefined;
}

// Retired / draft questions stay findable (the Bank page shows them) but rank below active ones.
const statusWeight = (q: Question) => (q.status === 'active' ? 1 : 0.6);

// ── FTS5 ────────────────────────────────────────────────────────────────────

function refreshQuestions(db: DatabaseSync, bank: BankState): void {
  const version = `${bank.version}:${sealedKey()}:v${INDEX_VERSION}`; // a form sealed / used / released → re-index
  if (getMeta(db, 'q_bank') === version) return;
  transaction(db, () => {
    db.exec('DELETE FROM q_fts');
    const ins = stmt(db, 'INSERT INTO q_fts (id, stem, body, tags) VALUES (?, ?, ?, ?)');
    for (const d of questionDocs(bank)) ins.run(d.q.id, foldD(d.fields[0]), foldD(d.fields.slice(1).join(' — ')), foldD(d.tags));
    setMeta(db, 'q_bank', version);
  });
}

/** Re-indexes added / changed notes, drops removed ones; returns the current note files. */
function refreshNotes(db: DatabaseSync): NoteFile[] {
  const files = noteFiles();
  const known = new Map((stmt(db, 'SELECT path, sig FROM n_files').all() as unknown as { path: string; sig: string }[]).map((r) => [r.path, r.sig]));
  const changed = files.filter((n) => known.get(n.file) !== n.sig);
  const present = new Set(files.map((n) => n.file));
  const removed = [...known.keys()].filter((p) => !present.has(p));
  if (!changed.length && !removed.length) return files;
  transaction(db, () => {
    const delRows = stmt(db, 'DELETE FROM n_fts WHERE path = ?');
    const delFile = stmt(db, 'DELETE FROM n_files WHERE path = ?');
    for (const p of removed) {
      delRows.run(p);
      delFile.run(p);
    }
    const ins = stmt(db, 'INSERT INTO n_fts (path, anchor, orig_heading, orig_text, heading, body) VALUES (?, ?, ?, ?, ?, ?)');
    const put = stmt(db, 'INSERT OR REPLACE INTO n_files (path, sig) VALUES (?, ?)');
    for (const n of changed) {
      delRows.run(n.file);
      for (const d of noteDocs(n)) ins.run(n.file, d.anchor, d.heading, d.text, foldD(d.heading), foldD(d.text));
      put.run(n.file, n.sig);
    }
  });
  return files;
}

/** Builds / refreshes the FTS index (also run in the background shortly after the server starts). */
export function warmSearchIndex(bank: BankState = loadBank()): boolean {
  if (!ftsAvailable()) return false;
  return withDb(
    (db) => {
      refreshQuestions(db, bank);
      refreshNotes(db);
      return true;
    },
    false,
  );
}

interface Ranked<T> {
  items: { row: T; score: number }[];
  total: number;
}

/**
 * bm25-ranked rows: exact phrase matches first, then rows with every word (`and`), or any word (`or`, used only when
 * nothing matched at all). `key` identifies a row (no duplicates between the phrase and the word query).
 */
function ftsRun<T>(db: DatabaseSync, table: 'q_fts' | 'n_fts', select: string, rank: string, key: (r: T) => string, tokens: QueryToken[], limit: number, mode: 'and' | 'or'): Ranked<T> {
  const run = (match: string, n: number) => (stmt(db, `SELECT ${select}, ${rank} AS rank FROM ${table} WHERE ${table} MATCH ? ORDER BY rank LIMIT ?`).all(match, n) as unknown as (T & { rank: number })[]);
  const match = ftsMatch(tokens, mode);
  if (!match) return { items: [], total: 0 };
  const total = (stmt(db, `SELECT count(*) AS n FROM ${table} WHERE ${table} MATCH ?`).get(match) as { n: number }).n;
  if (!total) return { items: [], total: 0 };
  const items: { row: T; score: number }[] = [];
  const seen = new Set<string>();
  const add = (rows: (T & { rank: number })[], bonus: number) => {
    for (const row of rows) {
      if (items.length >= limit || seen.has(key(row))) continue;
      seen.add(key(row));
      items.push({ row, score: bonus - row.rank });
    }
  };
  if (mode === 'and' && tokens.length > 1) add(run(ftsMatch(tokens, 'phrase'), limit), 100);
  add(run(match, limit * 2), 0);
  return { items, total };
}

function searchFts(bank: BankState, q: string, tokens: QueryToken[], scope: SearchScope, limit: number, mode: 'and' | 'or'): Omit<SearchResponse, 'q' | 'tookMs'> | undefined {
  return withDb(
    (db) => {
      refreshQuestions(db, bank);
      const hits: SearchHit[] = [];
      const total = { questions: 0, notes: 0 };
      if (scope !== 'notes') {
        const docs = new Map(questionDocs(bank).map((d) => [d.q.id, d]));
        const r = ftsRun<{ id: string }>(db, 'q_fts', 'id', 'bm25(q_fts, 0, 4.0, 1.0, 2.0)', (x) => x.id, tokens, limit * 2, mode);
        const ranked = r.items
          .map((x) => ({ d: docs.get(x.row.id), score: x.score }))
          .filter((x): x is { d: QuestionDoc; score: number } => !!x.d)
          .map((x) => ({ ...x, score: x.score * statusWeight(x.d.q) }))
          .sort((a, b) => b.score - a.score);
        const exact = exactId(bank, q);
        if (exact) {
          const i = ranked.findIndex((x) => x.d.q === exact);
          if (i > 0) ranked.unshift(...ranked.splice(i, 1));
          else if (i < 0) ranked.unshift({ d: docs.get(exact.id)!, score: (ranked[0]?.score ?? 1) + 1 });
        }
        hits.push(...ranked.slice(0, limit).map((x) => questionHit(bank, x.d, tokens, x.score)));
        total.questions = Math.max(r.total, exact ? 1 : 0);
      }
      if (scope !== 'questions') {
        const titles = new Map(refreshNotes(db).map((n) => [n.file, n.title]));
        type Row = { path: string; anchor: string; orig_heading: string; orig_text: string; rid: number };
        const r = ftsRun<Row>(db, 'n_fts', 'rowid AS rid, path, anchor, orig_heading, orig_text', 'bm25(n_fts, 0, 0, 0, 0, 5.0, 1.0)', (x) => String(x.rid), tokens, limit, mode);
        hits.push(...r.items.map((x) => noteHit({ file: x.row.path, title: titles.get(x.row.path) ?? x.row.path, heading: x.row.orig_heading, anchor: x.row.anchor, text: x.row.orig_text }, tokens, x.score)));
        total.notes = r.total;
      }
      return { hits, engine: 'fts5' as const, total };
    },
    undefined,
  );
}

// ── fallback: in-memory scan ────────────────────────────────────────────────

/** Folded " word word … " string: `includes(' ' + token)` = some word starts with the token. */
const keyCache = new WeakMap<object, string[]>();
function keysOf(doc: object, texts: () => string[]): string[] {
  let k = keyCache.get(doc);
  if (!k) keyCache.set(doc, (k = texts().map((t) => ` ${(foldKey(t).match(/[\p{L}\p{N}]+/gu) ?? []).join(' ')} `)));
  return k;
}

function occurrences(hay: string, needle: string): number {
  let n = 0;
  for (let i = hay.indexOf(needle); i >= 0 && n < 3; i = hay.indexOf(needle, i + needle.length)) n++;
  return n;
}

/**
 * Same rules as the FTS query: Σ field weight × occurrences (≤ 3) per token; 0 when a word is missing (`and`) or when no
 * word of ≥ 3 letters occurs (`or`); +100 when the words occur as a phrase (ranked first, like the FTS phrase query).
 */
function scanScore(keys: string[], weights: number[], tokens: QueryToken[], mode: 'and' | 'or'): number {
  let score = 0;
  for (const x of mode === 'or' ? tokens.filter((t) => t.t.length >= 3) : tokens) {
    let s = 0;
    keys.forEach((k, i) => (s += weights[i] * occurrences(k, x.prefix ? ` ${x.t}` : ` ${x.t} `)));
    if (!s && mode === 'and') return 0;
    score += s;
  }
  if (score && mode === 'and' && tokens.length > 1) {
    const phrase = ` ${tokens.map((x) => x.t).join(' ')}${tokens.at(-1)!.prefix ? '' : ' '}`;
    if (keys.some((k) => k.includes(phrase))) score += 100;
  }
  return score;
}

function scanRank<T extends object>(docs: T[], keys: (d: T) => string[], weights: number[], tokens: QueryToken[], limit: number, mode: 'and' | 'or', weight: (d: T) => number = () => 1): Ranked<T> {
  const scored = docs.map((row) => ({ row, score: scanScore(keys(row), weights, tokens, mode) * weight(row) })).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return { items: scored.slice(0, limit), total: scored.length };
}

function searchScan(bank: BankState, q: string, tokens: QueryToken[], scope: SearchScope, limit: number, mode: 'and' | 'or'): Omit<SearchResponse, 'q' | 'tookMs'> {
  const hits: SearchHit[] = [];
  const total = { questions: 0, notes: 0 };
  if (scope !== 'notes') {
    const r = scanRank(questionDocs(bank), (d) => keysOf(d, () => [...d.fields, d.tags]), [4, 1, 1, 1, 2], tokens, limit, mode, (d) => statusWeight(d.q));
    const exact = exactId(bank, q);
    const items = r.items.filter((x) => x.row.q !== exact);
    if (exact) items.unshift({ row: questionDocs(bank).find((d) => d.q === exact)!, score: (r.items[0]?.score ?? 1) + 1 });
    hits.push(...items.slice(0, limit).map((x) => questionHit(bank, x.row, tokens, x.score)));
    total.questions = Math.max(r.total, exact ? 1 : 0);
  }
  if (scope !== 'questions') {
    const docs = noteFiles().flatMap(noteDocs);
    const r = scanRank(docs, (d) => keysOf(d, () => [d.heading, d.text]), [5, 1], tokens, limit, mode);
    hits.push(...r.items.map((x) => noteHit(x.row, tokens, x.score)));
    total.notes = r.total;
  }
  return { hits, engine: 'fallback', total };
}

// ── entry point ─────────────────────────────────────────────────────────────

/**
 * Searches questions and/or notes. `limit` applies per kind (scope "all" returns up to `limit` questions and up to
 * `limit` note sections, each group ranked best first). An empty query returns no hits.
 */
export function search(q: string, opts: { scope?: SearchScope; limit?: number; fts?: boolean } = {}): SearchResponse {
  const t0 = performance.now();
  const scope = opts.scope ?? 'all';
  const limit = Math.min(50, Math.max(1, Math.round(opts.limit ?? 20)));
  const tokens = queryTokens(q);
  const bank = loadBank();
  const fts = opts.fts !== false && ftsAvailable();
  const run = (mode: 'and' | 'or') => (fts ? searchFts(bank, q, tokens, scope, limit, mode) : undefined) ?? searchScan(bank, q, tokens, scope, limit, mode);
  let out: Omit<SearchResponse, 'q' | 'tookMs'> = { hits: [], engine: fts ? 'fts5' : 'fallback', total: { questions: 0, notes: 0 } };
  if (tokens.length) {
    out = run('and');
    // nothing has every word anywhere → any word (the groups never mix exact results with loose ones)
    if (!out.hits.length && tokens.length > 1) out = run('or');
  }
  return { q, ...out, tookMs: Math.round((performance.now() - t0) * 10) / 10 };
}
