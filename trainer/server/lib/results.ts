// Attempts are stored as one Markdown file per finished test under results/YYYY/MM/.
// Front matter = machine-readable record (the app recomputes everything from it);
// body = human/AI-readable report (score, per-question table, wrong answers with explanations).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, RESULTS_DIR, loadConfig, rel, type AppConfig } from '../config.ts';
import { asString, splitFrontMatter, stringifyFrontMatter } from './frontmatter.ts';
import { listMarkdownFiles, loadBank, type BankState } from './bank.ts';
import { ParseCache, statSig, type FileParse } from './index-db.ts';
import { detectFeatures, detectServices } from './classify.ts';
import { fmtLocal, localIso, stampParts } from './time.ts';
import { isCorrect, normalizeKeys, pct, scaledScore } from '../../shared/scoring.ts';
import { fmtDuration } from '../../shared/timing.ts';
import { FEEDBACK_INFO, MODE_INFO } from '../../shared/labels.ts';
import type { AnswerInput, AnswerRecord, Attempt, AttemptPoint, AttemptSummary, Question, ResultsPage, SubmitRequest, Taxonomy, TestMode } from '../../shared/types.ts';

/** Result files written from v2 on: option letters match the bank after the answer-position rebalance. */
export const RESULT_LAYOUT = 2;
export const RECALL_MAX_CHARS = 300;
export const WHY_MAX_CHARS = 500;

const fileCache = new Map<string, { sig: string; attempt?: Attempt }>();
let listCache: { version: string; threshold: number; attempts: Attempt[] } | undefined;

/** Bump when parseResultFile changes what it extracts (stored parse-cache rows are then ignored). */
const RESULT_PARSE_VERSION = 1;

/**
 * Front matter of a results/ file. Files whose front matter cannot be an attempt (goal.md, external/*.md, notes…) are
 * recognized without a YAML parse: the word "attempt" does not occur in their front matter.
 */
export function parseResultFile(text: string): FileParse {
  const src = text.replace(/^﻿/, '');
  if (!/^---\r?\n/.test(src)) return { data: null };
  const end = src.indexOf('\n---', 4);
  if (end < 0 || !/\battempt\b/.test(src.slice(0, end))) return { data: null };
  const fm = splitFrontMatter(src);
  return { data: fm.error ? null : fm.data };
}

/** Parsed front matter of result files: memory → SQLite (.cache/trainer.db) → YAML. Shared with migrateResults(). */
export const resultParses = new ParseCache('result', RESULT_PARSE_VERSION, parseResultFile);

/** One stat pass over results/: files, their signatures (statSig) and a version hash of both. */
function scanResults(): { files: string[]; sigs: string[]; version: string } {
  const files = listMarkdownFiles(RESULTS_DIR);
  const sigs = files.map((f) => {
    try {
      return statSig(fs.statSync(f));
    } catch {
      return ''; // deleted while listing
    }
  });
  const version = crypto.createHash('sha1').update(files.map((f, i) => f + sigs[i]).join('|')).digest('hex');
  return { files, sigs, version };
}

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/** One-line, length-limited free text (recall / why notes). */
export function cleanNote(v: unknown, max: number): string {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\s+/g, ' ').trim().slice(0, max).trim();
}

function rawAnswers(data: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(data.answers) ? (data.answers as unknown[]).filter((a): a is Record<string, unknown> => !!a && typeof a === 'object' && !!(a as Record<string, unknown>).q) : [];
}

function toAnswer(a: Record<string, unknown>): AnswerRecord {
  const r: AnswerRecord = {
    q: String(a.q),
    pick: String(a.pick ?? ''),
    key: String(a.key ?? ''),
    ok: a.ok === true,
    t: num(a.t),
    est: num(a.est),
  };
  if (a.flag === true) r.flag = true;
  if (a.unsure === true) r.unsure = true;
  const elim = a.elim ? normalizeKeys(String(a.elim)) : '';
  if (elim) r.elim = elim;
  const recall = cleanNote(a.recall, RECALL_MAX_CHARS);
  if (recall) {
    r.recall = recall;
    r.recallHit = a.recallHit === true;
  }
  if (a.hinted === true) r.hinted = true;
  const why = cleanNote(a.why, WHY_MAX_CHARS);
  if (why) r.why = why;
  if (a.scored === false) r.scored = false;
  if (typeof a.h === 'string' && a.h) r.h = a.h;
  return r;
}

/** Median seconds per *answered* question (0 when nothing was answered). */
export function attemptMedianTime(answers: Pick<AnswerRecord, 'pick' | 't'>[]): number {
  const ts = answers.filter((r) => r.pick).map((r) => r.t).sort((a, b) => a - b);
  if (!ts.length) return 0;
  const m = ts.length >> 1;
  return ts.length % 2 ? ts[m] : (ts[m - 1] + ts[m]) / 2;
}

/** Click-through attempts are noise: excluded from states, stats, readiness, SRS and the coach snapshot. */
export function isRushed(medianTime: number, thresholdSeconds: number): boolean {
  return thresholdSeconds > 0 && medianTime < thresholdSeconds;
}

function toAttempt(data: Record<string, unknown>, file: string): Attempt | undefined {
  if (data.kind !== 'attempt' || !Array.isArray(data.answers)) return undefined;
  const answers = rawAnswers(data).map(toAnswer);
  const attempt: Attempt = {
    id: asString(data.id) ?? path.basename(file, '.md'),
    mode: (asString(data.mode) ?? 'custom') as TestMode,
    title: asString(data.title) ?? '',
    feedback: data.feedback === 'practice' ? 'practice' : 'exam',
    started: asString(data.started) ?? '',
    finished: asString(data.finished) ?? '',
    timeLimit: num(data.time_limit),
    timeUsed: num(data.time_used),
    timedOut: data.timed_out === true,
    total: num(data.total, answers.length),
    answered: num(data.answered),
    correct: num(data.correct),
    score: num(data.score),
    scaled: num(data.scaled),
    passed: data.passed === true,
    plan: asString(data.plan),
    selection: data.selection,
    answers,
    file,
  };
  if (data.layout !== undefined) attempt.layout = num(data.layout);
  if (data.pearson === true) {
    attempt.pearson = true;
    attempt.pilotTotal = num(data.pilot_total);
    attempt.pilotCorrect = num(data.pilot_correct);
  }
  attempt.medianTime = attemptMedianTime(answers);
  attempt.rushed = false;
  return attempt;
}

/**
 * Every attempt (oldest first). The same array is returned while no result file changed (callers memoize on its
 * identity); changed files are re-read only — from the SQLite parse cache when another process already parsed them.
 */
export function loadAttempts(cfg: AppConfig = loadConfig()): Attempt[] {
  const threshold = cfg.stats.rushed_median_seconds;
  const useSqlite = cfg.cache?.sqlite !== false;
  const { files, sigs, version } = scanResults();
  if (listCache?.version === version && listCache.threshold === threshold) return listCache.attempts;
  const misses = files.map((abs, i) => ({ abs, sig: sigs[i] })).filter((e) => e.sig && fileCache.get(e.abs)?.sig !== e.sig);
  resultParses.prefetch(misses, useSqlite);
  const attempts: Attempt[] = [];
  files.forEach((abs, i) => {
    if (!sigs[i]) return;
    let e = fileCache.get(abs);
    if (!e || e.sig !== sigs[i]) {
      const p = resultParses.get(abs, sigs[i], useSqlite);
      e = { sig: sigs[i], attempt: p.data ? toAttempt(p.data, rel(abs)) : undefined };
      fileCache.set(abs, e);
      resultParses.forget(abs); // the Attempt is kept instead of the raw front matter
    }
    // shallow copy: `rushed` depends on the current threshold, cached parses stay untouched
    if (e.attempt) attempts.push({ ...e.attempt, rushed: isRushed(e.attempt.medianTime ?? 0, threshold) });
  });
  const present = new Set(files);
  let removed = false;
  for (const abs of fileCache.keys()) {
    if (!present.has(abs)) {
      fileCache.delete(abs);
      removed = true;
    }
  }
  resultParses.flush(removed ? present : undefined, useSqlite);
  attempts.sort((a, b) => a.finished.localeCompare(b.finished));
  listCache = { version, threshold, attempts };
  return attempts;
}

/** Short version of the results directory (changes whenever a result file is added, edited or removed). */
export function attemptsVersion(): string {
  return scanResults().version.slice(0, 12);
}

/** attemptsVersion() as of the last loadAttempts() call (no second scan right after loading). */
export function loadedAttemptsVersion(): string {
  return listCache ? listCache.version.slice(0, 12) : attemptsVersion();
}

/** Same as `attempts.find((a) => a.id === id)` (first match wins), indexed once per loadAttempts() array. */
const byIdMemo = new WeakMap<Attempt[], Map<string, Attempt>>();
export function attemptById(attempts: Attempt[], id: string): Attempt | undefined {
  let m = byIdMemo.get(attempts);
  if (!m) {
    m = new Map();
    for (const a of attempts) if (!m.has(a.id)) m.set(a.id, a);
    byIdMemo.set(attempts, m);
  }
  return m.get(id);
}

/** Per-domain/topic tallies cover scored answers only (pilot items of a Pearson exam are left out, like the score). */
export function summarize(a: Attempt, bank: BankState): AttemptSummary {
  const domains: AttemptSummary['domains'] = {};
  const topics: AttemptSummary['topics'] = {};
  for (const r of a.answers) {
    if (r.scored === false) continue;
    const q = bank.byId.get(r.q);
    if (!q) continue;
    (domains[q.domain] ??= { total: 0, correct: 0 }).total++;
    (topics[q.topic] ??= { total: 0, correct: 0 }).total++;
    if (r.ok) {
      domains[q.domain].correct++;
      topics[q.topic].correct++;
    }
  }
  const { answers: _a, selection: _s, ...rest } = a;
  return { ...rest, domains, topics };
}

// ── history pages (GET /api/results?limit=&offset=…) ─────────────────────────

const TREND_POINTS = 40;
const round1 = (x: number) => Math.round(x * 10) / 10;

/** One page of the history (newest first) + the numbers the History page shows about the whole filtered set. */
export function resultsPage(attempts: Attempt[], bank: BankState, opts: { limit: number; offset: number; mode?: string; q?: string; hideRushed?: boolean }): ResultsPage {
  const newest = [...attempts].reverse();
  const words = (opts.q ?? '').toLowerCase().trim();
  const matching = newest.filter((a) => {
    if (opts.mode === 'pearson') {
      if (!a.pearson) return false;
    } else if (opts.mode && a.mode !== opts.mode) return false;
    return !words || a.title.toLowerCase().includes(words);
  });
  const filtered = opts.hideRushed ? matching.filter((a) => !a.rushed) : matching;
  const counted = filtered.filter((a) => !a.rushed);
  const trend: AttemptPoint[] = counted
    .slice(0, TREND_POINTS)
    .reverse()
    .map((a) => ({ id: a.id, finished: a.finished, title: a.title, score: a.score, correct: a.correct, total: a.total }));
  return {
    items: filtered.slice(opts.offset, opts.offset + opts.limit).map((a) => summarize(a, bank)),
    total: filtered.length,
    offset: opts.offset,
    limit: opts.limit,
    modes: [...new Set(newest.map((a) => a.mode))] as TestMode[],
    pearson: newest.filter((a) => a.pearson).length,
    rushed: matching.filter((a) => a.rushed).length,
    counted: counted.length,
    avgScore: counted.length ? round1(counted.reduce((s, a) => s + a.score, 0) / counted.length) : 0,
    timeUsed: filtered.reduce((s, a) => s + a.timeUsed, 0),
    trend,
  };
}

// ── recall-first matching ───────────────────────────────────────────────────

const STOPWORDS = new Set(
  (
    'the and for with from that this these those into onto than then there their they them which what when where who whom how why ' +
    'can could should would will shall may might must does did not are was were been being its use used uses using amazon aws ' +
    'service services solution solutions company application applications data each all any some more most less least only also via per ' +
    'such other new existing configure configured create created set based between both same different one two three need needs ' +
    'make provide run store stored'
  ).split(' '),
);

/** Lower-cased content words (stopwords and 1–2 letter tokens dropped, naive plural folding). */
function contentWords(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? []) {
    let w = raw.replace(/-+$/, '');
    if (STOPWORDS.has(w) || (w.length < 3 && !/\d/.test(w))) continue;
    if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    out.add(w);
  }
  return out;
}

const canonCache = new WeakMap<Taxonomy, Map<string, string>>();
/** Single-word service/feature patterns by lower case, so "sqs" / "dynamodb" in a recall still match. */
function canonicalWords(tax: Taxonomy): Map<string, string> {
  let m = canonCache.get(tax);
  if (m) return m;
  m = new Map();
  const patterns = [...Object.values(tax.services).flatMap((d) => d.match ?? []), ...Object.values(tax.features).flat()];
  for (const p of patterns) if (!/[\s*]/.test(p)) m.set(p.toLowerCase(), p);
  canonCache.set(tax, m);
  return m;
}

function terms(text: string, tax: Taxonomy): Set<string> {
  return new Set([...detectServices(text, tax).map((s) => `svc:${s}`), ...detectFeatures(text, tax).map((f) => `feat:${f}`)]);
}

/**
 * Does the learner's recall (written before the options were shown) point at the correct option(s)?
 * Hit = shares a service/feature, or ≥ 2 content words (not taken from the stem), with the correct option(s),
 * and no wrong option overlaps more. Terms/words present in every option are ignored (they discriminate nothing).
 */
export function recallMatches(recall: string, q: Pick<Question, 'stem' | 'options' | 'answer'>, tax: Taxonomy): boolean {
  if (!recall.trim() || q.options.length < 2) return false;
  const canon = canonicalWords(tax);
  const normalized = recall.replace(/[\p{L}\p{N}][\p{L}\p{N}@-]*/gu, (tok) => canon.get(tok.toLowerCase()) ?? tok);
  const rTerms = new Set([...terms(recall, tax), ...terms(normalized, tax)]);
  const stemWords = contentWords(q.stem);
  const rWords = new Set([...contentWords(recall)].filter((w) => !stemWords.has(w)));
  const opts = q.options.map((o) => ({ key: o.key, terms: terms(o.text, tax), words: contentWords(o.text) }));
  const common = (pick: (o: (typeof opts)[number]) => Set<string>) => new Set([...pick(opts[0])].filter((x) => opts.every((o) => pick(o).has(x))));
  const commonTerms = common((o) => o.terms);
  const commonWords = common((o) => o.words);
  const overlap = (set: Set<string>, mine: Set<string>, ignore: Set<string>) => [...set].filter((x) => mine.has(x) && !ignore.has(x)).length;
  const correct = opts.filter((o) => q.answer.includes(o.key));
  const cTerms = overlap(new Set(correct.flatMap((o) => [...o.terms])), rTerms, commonTerms);
  const cWords = overlap(new Set(correct.flatMap((o) => [...o.words])), rWords, commonWords);
  if (cTerms < 1 && cWords < 2) return false;
  const score = (t: number, w: number) => 3 * t + w;
  const mine = score(cTerms, cWords);
  return opts.filter((o) => !q.answer.includes(o.key)).every((o) => score(overlap(o.terms, rTerms, commonTerms), overlap(o.words, rWords, commonWords)) <= mine);
}

// ── grading & writing ───────────────────────────────────────────────────────

export interface GradedSubmission {
  records: AnswerRecord[];
  questions: Question[];
  total: number; // scored questions
  answered: number;
  correct: number;
  score: number;
  pearson: boolean;
  pilotTotal: number;
  pilotCorrect: number;
}

function toRecord(q: Question, a: AnswerInput | undefined, pilot: boolean, tax: Taxonomy): AnswerRecord {
  const pickArr = Array.isArray(a?.pick) ? a.pick.map(String) : [];
  const pick = normalizeKeys(pickArr);
  const keys = new Set(q.options.map((o) => o.key));
  const r: AnswerRecord = {
    q: q.id,
    pick,
    key: normalizeKeys(q.answer),
    ok: isCorrect(pickArr, q.answer),
    t: Math.max(0, Math.round(Number(a?.t) || 0)),
    est: q.time,
  };
  if (a?.flag) r.flag = true;
  if (a?.unsure) r.unsure = true;
  const elim = normalizeKeys((Array.isArray(a?.elim) ? a.elim : []).map(String)).split('').filter((k) => keys.has(k) && !pick.includes(k)).join('');
  if (elim) r.elim = elim;
  const recall = cleanNote(a?.recall, RECALL_MAX_CHARS);
  if (recall) {
    r.recall = recall;
    r.recallHit = recallMatches(recall, q, tax);
  }
  if (a?.hinted) r.hinted = true;
  const why = cleanNote(a?.why, WHY_MAX_CHARS);
  if (why) r.why = why;
  if (pilot) r.scored = false;
  r.h = q.hash; // which version of the question was answered (item versioning)
  return r;
}

/** Grades a submission without touching the disk. Pearson pilot items are recorded with `scored: false`. */
export function gradeSubmission(req: SubmitRequest, bank: BankState): GradedSubmission {
  const { session } = req;
  const pearson = !!session.pearson;
  const pilots = new Set(pearson ? (session.unscored ?? []) : []);
  const byQ = new Map((req.answers ?? []).filter((a) => a && a.q).map((a) => [a.q, a]));
  const records: AnswerRecord[] = [];
  const questions: Question[] = [];
  const seen = new Set<string>();
  for (const ref of session.questions) {
    const q = bank.byId.get(ref.id);
    if (!q || seen.has(q.id)) continue;
    seen.add(q.id);
    records.push(toRecord(q, byQ.get(ref.id), pilots.has(q.id), bank.taxonomy));
    questions.push(q);
  }
  const scored = records.filter((r) => r.scored !== false);
  const pilot = records.filter((r) => r.scored === false);
  const correct = scored.filter((r) => r.ok).length;
  return {
    records,
    questions,
    total: scored.length,
    answered: scored.filter((r) => r.pick).length,
    correct,
    score: pct(correct, scored.length),
    pearson,
    pilotTotal: pilot.length,
    pilotCorrect: pilot.filter((r) => r.ok).length,
  };
}

const ANSWER_KEYS = ['q', 'pick', 'key', 'ok', 't', 'est', 'flag', 'unsure', 'elim', 'recall', 'recallHit', 'hinted', 'why', 'scored', 'h', 'regraded'];

/** Compact front-matter form of an answer (+ unknown keys of the previous version of the record). */
function answerData(r: AnswerRecord, prev?: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = { q: r.q, pick: r.pick, key: r.key, ok: r.ok, t: r.t, est: r.est };
  if (r.flag) o.flag = true;
  if (r.unsure) o.unsure = true;
  if (r.elim) o.elim = r.elim;
  if (r.recall) {
    o.recall = r.recall;
    o.recallHit = !!r.recallHit;
  }
  if (r.hinted) o.hinted = true;
  if (r.why) o.why = r.why;
  if (r.scored === false) o.scored = false;
  if (r.h) o.h = r.h;
  for (const [k, v] of Object.entries(prev ?? {})) if (!ANSWER_KEYS.includes(k) && v !== undefined) o[k] = v;
  return o;
}

const TOP_KEYS = [
  'id', 'kind', 'layout', 'mode', 'title', 'feedback', 'started', 'finished', 'time_limit', 'time_used', 'timed_out', 'estimate_total', 'timing',
  'total', 'answered', 'correct', 'score', 'scaled', 'passed', 'pearson', 'pilot_total', 'pilot_correct', 'plan', 'selection', 'answers',
];

/** Front matter for an attempt; keys of `prev` the app does not know are preserved (before `answers`). */
function frontMatterData(a: Attempt, prev: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const prevAnswers = new Map(rawAnswers(prev).map((x) => [String(x.q), x]));
  const known: Record<string, unknown> = {
    id: a.id,
    kind: 'attempt',
    layout: a.layout,
    mode: a.mode,
    title: a.title,
    feedback: a.feedback,
    started: a.started,
    finished: a.finished,
    time_limit: a.timeLimit,
    time_used: a.timeUsed,
    timed_out: a.timedOut,
    estimate_total: extra.estimate_total ?? prev.estimate_total,
    timing: extra.timing ?? prev.timing,
    total: a.total,
    answered: a.answered,
    correct: a.correct,
    score: a.score,
    scaled: a.scaled,
    passed: a.passed,
    pearson: a.pearson ? true : undefined,
    pilot_total: a.pearson ? (a.pilotTotal ?? 0) : undefined,
    pilot_correct: a.pearson ? (a.pilotCorrect ?? 0) : undefined,
    plan: a.plan,
    selection: a.selection,
  };
  const out: Record<string, unknown> = {};
  for (const k of TOP_KEYS) if (k !== 'answers' && known[k] !== undefined) out[k] = known[k];
  for (const [k, v] of Object.entries(prev)) if (!TOP_KEYS.includes(k) && v !== undefined) out[k] = v;
  out.answers = a.answers.map((r) => answerData(r, prevAnswers.get(r.q)));
  return out;
}

export function gradeAndSave(req: SubmitRequest, bank: BankState): Attempt {
  const { session } = req;
  const cfg = loadConfig();
  const g = gradeSubmission(req, bank);
  const finished = new Date(req.finishedAt || Date.now());
  const started = new Date(req.startedAt || finished);
  const parts = stampParts(finished);
  const mode = session.mode;
  let id = `${parts.compact}-${parts.time}-${mode}`;
  const dir = path.join(RESULTS_DIR, parts.year, parts.month);
  fs.mkdirSync(dir, { recursive: true });
  let file = path.join(dir, `${parts.date}_${parts.time}_${mode}.md`);
  for (let i = 2; fs.existsSync(file); i++) {
    id = `${parts.compact}-${parts.time}-${mode}-${i}`;
    file = path.join(dir, `${parts.date}_${parts.time}_${mode}-${i}.md`);
  }
  const passPct = bank.taxonomy.exam.pass_pct;
  const { ids: _ids, ...selection } = session.selection ?? { mode };
  const medianTime = attemptMedianTime(g.records);
  const attempt: Attempt = {
    id,
    mode,
    title: session.title,
    feedback: session.feedback,
    started: localIso(started),
    finished: localIso(finished),
    timeLimit: session.timeLimit,
    timeUsed: Math.round(Number(req.timeUsed) || 0),
    timedOut: !!req.timedOut,
    total: g.total,
    answered: g.answered,
    correct: g.correct,
    score: g.score,
    scaled: scaledScore(g.score),
    passed: g.score >= passPct,
    plan: session.plan,
    selection,
    answers: g.records,
    file: rel(file),
    layout: RESULT_LAYOUT,
    ...(g.pearson ? { pearson: true, pilotTotal: g.pilotTotal, pilotCorrect: g.pilotCorrect } : {}),
    medianTime,
    rushed: isRushed(medianTime, cfg.stats.rushed_median_seconds),
  };
  const data = frontMatterData(attempt, {}, { estimate_total: session.estimateTotal, timing: session.timingPreset });
  writeAtomic(file, stringifyFrontMatter(data, ['answers']) + '\n' + renderBody(attempt, g.questions, bank, session.estimateTotal, cfg));
  resultParses.drop(file, cfg.cache?.sqlite !== false); // a stored row of a deleted file with the same name must not come back
  return attempt;
}

/**
 * Re-writes a result file after `mutate` changed the attempt (e.g. a "why" note): front matter keeps keys the
 * app does not know, the report body is re-rendered (info notes like "> ℹ️ …" from migrations are kept).
 * `fileRel` = `Attempt.file` (relative to the data root). Returns false when the file is missing/not an attempt.
 */
export function rewriteAttempt(fileRel: string, mutate: (a: Attempt) => void): boolean {
  const abs = path.resolve(DATA_DIR, fileRel);
  if (!abs.startsWith(RESULTS_DIR + path.sep) || !abs.endsWith('.md') || !fs.existsSync(abs)) return false;
  const fm = splitFrontMatter(fs.readFileSync(abs, 'utf8'));
  if (fm.error) return false;
  const attempt = toAttempt(fm.data, rel(abs));
  if (!attempt) return false;
  mutate(attempt);
  const cfg = loadConfig();
  attempt.medianTime = attemptMedianTime(attempt.answers);
  attempt.rushed = isRushed(attempt.medianTime, cfg.stats.rushed_median_seconds);
  const bank = loadBank();
  const data = frontMatterData(attempt, fm.data);
  const infoNotes = fm.body.split('\n').filter((l) => /^>\s?ℹ/u.test(l));
  let body = renderBody(attempt, attempt.answers.map((r) => bank.byId.get(r.q)), bank, num(fm.data.estimate_total), cfg);
  if (infoNotes.length) body = body.replace(/\n*$/, '\n\n') + infoNotes.join('\n\n') + '\n';
  writeAtomic(abs, stringifyFrontMatter(data, ['answers']) + '\n' + body);
  fileCache.delete(abs);
  resultParses.drop(abs, cfg.cache?.sqlite !== false); // never serve the previous parse to another process
  listCache = undefined;
  return true;
}

/** Write via a temp file + rename so readers (SSE version poll, coach) never see a half-written result. */
function writeAtomic(abs: string, text: string): void {
  const tmp = `${abs}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, abs);
}

// ── report body ─────────────────────────────────────────────────────────────

function letterText(q: Question, keys: string): string {
  if (!keys) return '_(bỏ trống)_';
  return [...keys].map((k) => `**${k}.** ${q.options.find((o) => o.key === k)?.text ?? '?'}`).join('<br>');
}

function oneLine(s: string, max = 140): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

function cell(s: string): string {
  return s.replace(/\|/g, '/');
}

function renderBody(a: Attempt, questions: (Question | undefined)[], bank: BankState, estimateTotal: number, cfg: AppConfig): string {
  const tax = bank.taxonomy;
  const mode = MODE_INFO[a.mode] ?? MODE_INFO.custom;
  const verdict = a.passed ? '✅ ĐẠT' : '❌ CHƯA ĐẠT';
  const out: string[] = [];
  out.push(`# ${verdict} · ${a.correct}/${a.total} câu (${a.score}%) — ${a.title}`, '');
  out.push('| | |', '|---|---|');
  out.push(`| Chế độ | ${mode.icon} ${mode.label} · ${FEEDBACK_INFO[a.feedback].label}${a.pearson ? ' · 🧪 mô phỏng Pearson VUE' : ''} |`);
  out.push(`| Bắt đầu → Nộp | ${fmtLocal(a.started)} → ${fmtLocal(a.finished)}${a.timedOut ? ' · ⏰ hết giờ, tự nộp' : ''} |`);
  out.push(`| Thời gian | ${fmtDuration(a.timeUsed)}${a.timeLimit ? ` / giới hạn ${fmtDuration(a.timeLimit)}` : ' (không giới hạn)'} · chuẩn ước lượng ${fmtDuration(estimateTotal)} |`);
  out.push(`| Điểm quy đổi | **${a.scaled}** / 1000 (đỗ ≥ ${tax.exam.pass_scaled}) · đã trả lời ${a.answered}/${a.total} |`);
  if (a.pearson) {
    out.push(`| Câu tính điểm | ${a.total} câu tính điểm + ${a.pilotTotal ?? 0} câu thử nghiệm (không tính điểm) · thử nghiệm đúng ${a.pilotCorrect ?? 0}/${a.pilotTotal ?? 0} |`);
  }
  if (a.rushed) {
    out.push(`| ⚡ Làm vội | trung vị ${a.medianTime ?? 0}s/câu < ${cfg.stats.rushed_median_seconds}s — bài này không được tính vào thống kê, lịch ôn và phân tích |`);
  }
  if (a.plan) out.push(`| Kế hoạch AI | \`${a.plan}\` |`);
  out.push('');

  const rows = a.answers.map((r, i) => ({ r, q: questions[i], n: i + 1 }));
  const group = (key: (q: Question) => string, label: (k: string) => string, title: string) => {
    const m = new Map<string, { t: number; c: number }>();
    for (const { r, q } of rows) {
      if (!q || r.scored === false) continue;
      const k = key(q);
      const g = m.get(k) ?? { t: 0, c: 0 };
      g.t++;
      if (r.ok) g.c++;
      m.set(k, g);
    }
    out.push(`## ${title}${a.pearson ? ' (câu tính điểm)' : ''}`, '', '| | Đúng | Tỉ lệ |', '|---|---|---|');
    for (const [k, g] of [...m].sort((x, y) => x[1].c / x[1].t - y[1].c / y[1].t)) out.push(`| ${label(k)} | ${g.c}/${g.t} | ${pct(g.c, g.t)}% |`);
    out.push('');
  };
  group((q) => q.domain, (k) => {
    const d = tax.domains.find((x) => x.id === k);
    return d ? `${d.code} ${d.label}` : k;
  }, 'Theo domain');
  group((q) => q.topic, (k) => {
    const t = tax.topics.find((x) => x.id === k);
    return t ? `${t.icon} ${t.label}` : k;
  }, 'Theo chủ đề');

  const struck = (r: AnswerRecord) => !!r.elim && [...r.elim].some((k) => r.key.includes(k));
  out.push('## Chi tiết từng câu', '', '| # | Câu | Chủ đề | Chọn | Đáp án | KQ | Thời gian (làm/chuẩn) | Ghi chú |', '|---|---|---|---|---|---|---|---|');
  for (const { r, q, n } of rows) {
    const notes = [
      r.scored === false ? '🧪 thử nghiệm' : '',
      r.flag ? '🚩' : '',
      r.unsure ? '🤔 chưa chắc' : '',
      r.t > r.est * 1.5 ? '🐢 chậm' : '',
      r.hinted ? '💡 gợi ý' : '',
      r.elim ? `✂️ gạch ${r.elim}${struck(r) ? ' ⚠️ gạch nhầm đáp án đúng' : ''}` : '',
      r.recall ? `🧠 recall ${r.recallHit ? '✓' : '✗'}` : '',
      r.why ? '✍️ có ghi chú' : '',
    ].filter(Boolean).join(' ');
    out.push(`| ${n} | \`${r.q}\` | ${q?.topic ?? '?'} | ${r.pick || '—'} | ${r.key} | ${r.ok ? '✅' : '❌'} | ${r.t}s / ${r.est}s | ${notes} |`);
  }
  out.push('');

  const wrong = rows.filter((x) => !x.r.ok);
  if (wrong.length) {
    out.push(`## ❌ Câu sai (${wrong.length}) — xem lại`, '');
    for (const { r, q, n } of wrong) {
      if (!q) {
        out.push(`### ${n}. \`${r.q}\``, '', '_(câu này không còn trong ngân hàng)_', '');
        continue;
      }
      out.push(`### ${n}. \`${q.id}\` · ${q.topic}${q.services.length ? ' · ' + q.services.slice(0, 3).join(', ') : ''}${r.scored === false ? ' · 🧪 thử nghiệm (không tính điểm)' : ''}`, '');
      out.push(`> ${oneLine(q.stem, 400)}`, '');
      if (r.recall) out.push(`- Bạn nghĩ trước khi xem lựa chọn: “${r.recall}” — ${r.recallHit ? 'khớp đáp án đúng' : 'không khớp đáp án đúng'}`);
      out.push(`- Bạn chọn: ${letterText(q, r.pick)}`);
      out.push(`- Đáp án đúng: ${letterText(q, r.key)}`);
      if (r.elim) out.push(`- Bạn đã gạch bỏ: ${letterText(q, r.elim)}${struck(r) ? ' — ⚠️ gạch nhầm đáp án đúng' : ''}`);
      if (r.hinted) out.push('- 💡 Đã mở gợi ý');
      if (r.why) out.push(`- Vì sao bạn chọn: “${r.why}”`);
      if (q.explanation) out.push(`- Giải thích: ${oneLine(q.explanation, 600)}`);
      out.push('');
    }
  }
  const unsure = rows.filter((x) => x.r.ok && (x.r.unsure || x.r.flag || x.r.hinted));
  if (unsure.length) {
    out.push(`## 🤔 Đúng nhưng chưa chắc / cắm cờ / dùng gợi ý (${unsure.length})`, '');
    for (const { r, q } of unsure) {
      const why = [r.unsure ? 'chưa chắc' : '', r.flag ? 'cắm cờ' : '', r.hinted ? 'dùng gợi ý' : ''].filter(Boolean).join(', ');
      out.push(`- \`${r.q}\` (${why}) — ${q ? oneLine(q.stem, 120) : '?'}`);
    }
    out.push('');
  }
  const recalls = rows.filter((x) => x.r.recall);
  if (recalls.length) {
    const hits = recalls.filter((x) => x.r.recallHit);
    out.push(`## 🧠 Nhớ trước khi xem lựa chọn (${hits.length}/${recalls.length} khớp)`, '', '| # | Câu | Bạn nghĩ | Khớp | KQ |', '|---|---|---|---|---|');
    for (const { r, n } of recalls) out.push(`| ${n} | \`${r.q}\` | ${cell(oneLine(r.recall ?? '', 120))} | ${r.recallHit ? '✓' : '✗'} | ${r.ok ? '✅' : '❌'} |`);
    out.push('');
  }
  return out.join('\n');
}
