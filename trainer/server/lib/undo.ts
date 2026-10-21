// [v5] γ2 — one-click undo of an AI run (9-09).
// Before an AI run's patch, new pack or file-mode edit reaches the bank, the previous version of every question block it
// touches is kept in coach/patches/<run>.before.json, with a signature of the version the run produced, plus the ids the
// run created:
//   { run, task, created, updated, questions: { <qid>: { file, before, beforeSig, afterSig, at } }, createdIds, packs }
// Writers: patch.ts (every applied item of a patch that has a run id), ai-output.ts writePack (created ids) and the
// coach runner (file-mode runs: a capture of every block before the CLI starts, diffed afterwards).
// POST /api/coach/runs/:id/undo restores a block only while the question is still exactly the version the run produced
// (signature over every stored field: a later manual or AI edit is a conflict and stays untouched) and retires the
// questions the run created (status: retired — ids are kept, old results still point at them). Each undo is appended to
// coach/patches/<run>.undo.json and noted in the run record (coach/runs/<run>.json); both are data and sync like coach/.
// This module must not import the coach runner, context or stats (patch.ts → undo.ts is on the readiness import path).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, PATCHES_DIR, RUNS_DIR } from '../config.ts';
import { loadBank, type BankState } from './bank.ts';
import { blockTexts, bodyStartIndex, findBlock, normalizedText, writePackText } from './blocks.ts';
import { parsePack, serializeQuestion, toDraft } from './pack-format.ts';
import { localIso } from './time.ts';
import type { Question, Taxonomy, UndoInfo, UndoResult } from '../../shared/types.ts';

/** afterSig of a question the run left unparsable (file mode): undo puts the previous block back. */
export const MISSING_SIG = 'missing';
const RUN_RE = /^[\w-]+$/;

export interface PreImageEntry {
  file: string; // pack path relative to the data root
  before: string; // the block before the run (heading … last content line, LF)
  beforeSig: string; // signature of that version
  afterSig: string; // signature of the version the run produced (latest change of the run)
  at: string; // ISO time of the run's last change to the question
}

export interface PreImage {
  run: string;
  task: string;
  created: string; // ISO time of the first record
  updated: string;
  questions: Record<string, PreImageEntry>;
  createdIds: string[];
  packs: string[]; // packs the run wrote
}

export interface PreImageInput {
  id: string;
  file: string;
  before: string;
  beforeSig: string;
  afterSig: string;
}

/** Refusals of POST /api/coach/runs/:id/undo (status = HTTP status). */
export class UndoError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ── signatures ──────────────────────────────────────────────────────────────

const sigCache = new WeakMap<Question, string>();

/**
 * Signature of everything stored for a question (stem, options, key, explanation and every metadata line, status):
 * the block as the app would write it. Formatting-only differences do not count; computed fields (guessed skills,
 * requirements…) never do.
 */
export function questionSig(q: Question): string {
  let s = sigCache.get(q);
  if (!s) {
    s = crypto.createHash('sha1').update(serializeQuestion(toDraft(q))).digest('hex').slice(0, 12);
    sigCache.set(q, s);
  }
  return s;
}

// ── the pre-image store ─────────────────────────────────────────────────────

export const preImagePath = (run: string) => path.join(PATCHES_DIR, `${run}.before.json`);
export const undoLogPath = (run: string) => path.join(PATCHES_DIR, `${run}.undo.json`);

/** Task of a run from its id (`<date>_<time>_<task>[-n][-verify]`); 'patch' for anything else (apply-patch by hand). */
export function taskOfRun(run: string): string {
  return /_(analyze|generate|enrich|longform|verify|twins|family)(?:-\d+)?(?:-verify)?$/.exec(run)?.[1] ?? 'patch';
}

function writeJsonAtomic(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1) + '\n');
  fs.renameSync(tmp, file);
}

export function loadPreImage(run: string): PreImage | undefined {
  if (!RUN_RE.test(run)) return undefined;
  try {
    const p = JSON.parse(fs.readFileSync(preImagePath(run), 'utf8')) as Partial<PreImage>;
    if (!p || typeof p !== 'object' || typeof p.questions !== 'object' || !p.questions) return undefined;
    return {
      run,
      task: typeof p.task === 'string' ? p.task : taskOfRun(run),
      created: String(p.created ?? ''),
      updated: String(p.updated ?? p.created ?? ''),
      questions: p.questions,
      createdIds: Array.isArray(p.createdIds) ? p.createdIds.map(String) : [],
      packs: Array.isArray(p.packs) ? p.packs.map(String) : [],
    };
  } catch {
    return undefined;
  }
}

function openPreImage(run: string, task: string | undefined, at: string): PreImage {
  return loadPreImage(run) ?? { run, task: task ?? taskOfRun(run), created: at, updated: at, questions: {}, createdIds: [], packs: [] };
}

/**
 * Records the previous version of questions a run is changing. The first record of a question within a run keeps its
 * `before` (the version before the run); later changes by the same run only move `afterSig`. Questions the run created
 * are skipped: undo retires them.
 */
export function recordPreImages(run: string, entries: PreImageInput[], opts: { task?: string; at?: string } = {}): void {
  if (!RUN_RE.test(run) || !entries.length) return;
  const at = opts.at ?? localIso();
  const p = openPreImage(run, opts.task, at);
  const created = new Set(p.createdIds);
  let dirty = false;
  for (const e of entries) {
    if (created.has(e.id)) continue;
    const old = p.questions[e.id];
    if (old) {
      if (old.afterSig === e.afterSig) continue;
      old.afterSig = e.afterSig;
      old.at = at;
    } else {
      if (e.beforeSig === e.afterSig) continue; // nothing stored changed
      p.questions[e.id] = { file: e.file, before: e.before, beforeSig: e.beforeSig, afterSig: e.afterSig, at };
    }
    dirty = true;
  }
  if (!dirty) return;
  p.updated = at;
  writeJsonAtomic(preImagePath(run), p);
}

/** Records questions a run wrote into a new (or its own) pack. */
export function recordCreated(run: string, ids: string[], pack: string, opts: { task?: string; at?: string } = {}): void {
  if (!RUN_RE.test(run) || !ids.length) return;
  const at = opts.at ?? localIso();
  const p = openPreImage(run, opts.task, at);
  const before = p.createdIds.length + p.packs.length;
  for (const id of ids) if (!p.createdIds.includes(id)) p.createdIds.push(id);
  if (pack && !p.packs.includes(pack)) p.packs.push(pack);
  if (p.createdIds.length + p.packs.length === before) return;
  p.updated = at;
  writeJsonAtomic(preImagePath(run), p);
}

// ── file-mode runs: capture before, diff after ──────────────────────────────

export interface CapturedBlock {
  file: string;
  text: string;
  sig: string;
}

/** Every question block of the bank as it is on disk now (the runner calls this before a file-mode CLI phase). */
export function captureBlocks(bank: BankState): Map<string, CapturedBlock> {
  const out = new Map<string, CapturedBlock>();
  const files = new Map<string, Map<string, string>>();
  for (const q of bank.questions) {
    let texts = files.get(q.file);
    if (!texts) {
      try {
        texts = blockTexts(fs.readFileSync(path.join(DATA_DIR, q.file), 'utf8'));
      } catch {
        texts = new Map();
      }
      files.set(q.file, texts);
    }
    const text = texts.get(q.id);
    if (text !== undefined) out.set(q.id, { file: q.file, text, sig: questionSig(q) });
  }
  return out;
}

/**
 * What a run changed between `before` (captureBlocks) and `after`: changed questions get a pre-image, new ids are
 * recorded as created, questions that disappeared (a broken block) get a pre-image that undo can put back.
 */
export function recordRunDiff(run: string, before: Map<string, CapturedBlock>, after: BankState, task?: string): { changed: string[]; created: string[] } {
  const changed: PreImageInput[] = [];
  const createdByFile = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const q of after.questions) {
    seen.add(q.id);
    const prev = before.get(q.id);
    if (!prev) {
      createdByFile.set(q.file, [...(createdByFile.get(q.file) ?? []), q.id]);
      continue;
    }
    const sig = questionSig(q);
    if (sig !== prev.sig) changed.push({ id: q.id, file: prev.file, before: prev.text, beforeSig: prev.sig, afterSig: sig });
  }
  for (const [id, prev] of before) if (!seen.has(id)) changed.push({ id, file: prev.file, before: prev.text, beforeSig: prev.sig, afterSig: MISSING_SIG });
  for (const [file, ids] of createdByFile) recordCreated(run, ids, file, { task });
  recordPreImages(run, changed, { task });
  return { changed: changed.map((c) => c.id), created: [...createdByFile.values()].flat() };
}

// ── undo ────────────────────────────────────────────────────────────────────

interface Rewrite {
  id: string;
  lines: string[]; // the new block
  check: (q: Question) => boolean; // the re-parsed block is what we meant to write
  appendIfMissing?: boolean; // [R3] the run deleted the whole block: put it back at the end of its pack
}

/**
 * Replaces blocks of one pack, one at a time: each candidate text is re-parsed and must keep every question of the pack
 * and pass `check`; a block that does not is left as it is (conflict). Written atomically once.
 */
function rewriteBlocks(fileRel: string, items: Rewrite[], tax: Taxonomy, done: string[], conflicts: UndoResult['conflicts']): void {
  const abs = path.join(DATA_DIR, fileRel);
  let raw: string;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch {
    for (const it of items) conflicts.push({ id: it.id, reason: `không đọc được file ${fileRel}` });
    return;
  }
  const { text: original, crlf } = normalizedText(raw);
  let text = original;
  for (const it of items) {
    const lines = text.split('\n');
    const blk = findBlock(lines, it.id, bodyStartIndex(text));
    if (!blk && !it.appendIfMissing) {
      conflicts.push({ id: it.id, reason: 'không còn block câu hỏi này trong pack' });
      continue;
    }
    const before = parsePack(text, fileRel, tax);
    const candidate = blk
      ? [...lines.slice(0, blk.start), ...it.lines, ...lines.slice(blk.end)].join('\n')
      : `${text.replace(/\s+$/, '')}\n\n---\n\n${it.lines.join('\n')}\n`;
    const after = parsePack(candidate, fileRel, tax);
    const q2 = after.questions.find((q) => q.id === it.id);
    const others = (qs: Question[]) => qs.filter((q) => q.id !== it.id).map((q) => q.id).join(',');
    if (!q2 || others(after.questions) !== others(before.questions) || !it.check(q2)) {
      conflicts.push({ id: it.id, reason: 'bản cũ không đọc lại được đúng trong pack hiện tại — giữ nguyên' });
      continue;
    }
    text = candidate;
    done.push(it.id);
  }
  if (text !== original) writePackText(abs, text, crlf);
}

/**
 * Undoes an AI run (or one question of it, `qid`): restores each changed question that is still exactly the version the
 * run produced, retires the questions it created. Questions already back to their previous version (or retired) are
 * skipped silently, so a second undo returns empty lists.
 */
export function undoRun(run: string, opts: { qid?: string; now?: Date } = {}): UndoResult {
  if (!RUN_RE.test(run)) throw new UndoError('Mã lượt chạy không hợp lệ.', 400);
  const pre = loadPreImage(run);
  if (!pre) throw new UndoError('Lượt này không có bản lưu trước khi sửa (chạy trước v5, hoặc không đổi câu nào) — không hoàn tác được.', 404);
  const qid = opts.qid?.trim() || undefined;
  if (qid && !pre.questions[qid] && !pre.createdIds.includes(qid)) throw new UndoError(`Lượt ${run} không sửa hay tạo câu ${qid}.`, 400);
  const bank = loadBank();
  const result: UndoResult = { run, restored: [], retired: [], conflicts: [] };

  // 1. changed questions → their previous version, per pack
  const restore = new Map<string, Rewrite[]>();
  for (const [id, e] of Object.entries(pre.questions)) {
    if (qid && id !== qid) continue;
    const q = bank.byId.get(id);
    if (!q && e.afterSig !== MISSING_SIG) {
      result.conflicts.push({ id, reason: 'câu không còn trong ngân hàng (hoặc đang lỗi định dạng)' });
      continue;
    }
    if (q) {
      const sig = questionSig(q);
      if (sig === e.beforeSig) continue; // already the previous version
      if (sig !== e.afterSig) {
        result.conflicts.push({ id, reason: 'câu đã thay đổi sau lượt AI này (sửa tay hoặc lượt khác) — giữ nguyên' });
        continue;
      }
      if (q.file !== e.file) {
        result.conflicts.push({ id, reason: `câu đã chuyển sang file khác (${q.file})` });
        continue;
      }
    }
    const list = restore.get(e.file) ?? [];
    list.push({ id, lines: e.before.split('\n'), check: (q2) => questionSig(q2) === e.beforeSig, appendIfMissing: !q && e.afterSig === MISSING_SIG });
    restore.set(e.file, list);
  }
  for (const [file, items] of restore) rewriteBlocks(file, items, bank.taxonomy, result.restored, result.conflicts);

  // 2. created questions → status: retired (ids and content kept)
  const retire = new Map<string, Rewrite[]>();
  for (const id of pre.createdIds) {
    if (qid && id !== qid) continue;
    const q = bank.byId.get(id);
    if (!q || q.status === 'retired') continue;
    const block = serializeQuestion({ ...toDraft(q), status: 'retired' }).replace(/\n+$/, '');
    const list = retire.get(q.file) ?? [];
    list.push({ id, lines: block.split('\n'), check: (q2) => q2.status === 'retired' });
    retire.set(q.file, list);
  }
  for (const [file, items] of retire) rewriteBlocks(file, items, bank.taxonomy, result.retired, result.conflicts);

  const at = localIso(opts.now ?? new Date());
  if (result.restored.length || result.retired.length || result.conflicts.length) {
    const entry = { at, ...(qid ? { qid } : {}), ...result };
    appendUndoLog(run, entry);
    noteRunRecord(run, entry);
  }
  return result;
}

function appendUndoLog(run: string, entry: Record<string, unknown>): void {
  let list: unknown[] = [];
  try {
    const j = JSON.parse(fs.readFileSync(undoLogPath(run), 'utf8')) as unknown;
    if (Array.isArray(j)) list = j;
  } catch {
    // first undo of this run
  }
  list.push(entry);
  writeJsonAtomic(undoLogPath(run), list);
}

/** The run record (coach/runs/<run>.json) keeps the last undo in `outcome.undo` — atomic rename like the runner's saves. */
function noteRunRecord(run: string, entry: UndoResult & { at: string; qid?: string }): void {
  const file = path.join(RUNS_DIR, `${run}.json`);
  let info: Record<string, unknown>;
  try {
    info = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch {
    return; // apply-patch by hand: no run record
  }
  if (!info || typeof info !== 'object') return;
  const outcome = info.outcome && typeof info.outcome === 'object' ? (info.outcome as Record<string, unknown>) : {};
  info.outcome = { ...outcome, undo: entry };
  const tmp = path.join(RUNS_DIR, `.${run}.${process.pid}.undo.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(info, null, 2));
  fs.renameSync(tmp, file);
}

// ── what can be undone (Coach run list, Bank question panel) ────────────────

interface IndexEntry {
  run: string;
  task: string;
  at: string;
  created: boolean;
  afterSig?: string;
}

interface PreImageIndex {
  key: string;
  byQid: Map<string, IndexEntry[]>;
  runs: Map<string, PreImage>;
}

let indexMemo: PreImageIndex | undefined;

/** Every pre-image, parsed once per change of coach/patches (writes are atomic renames, which bump the directory). */
function preImageIndex(): PreImageIndex {
  let key: string;
  try {
    key = `${PATCHES_DIR}:${fs.statSync(PATCHES_DIR).mtimeMs}`;
  } catch {
    return { key: 'none', byQid: new Map(), runs: new Map() };
  }
  if (indexMemo?.key === key) return indexMemo;
  const byQid = new Map<string, IndexEntry[]>();
  const runs = new Map<string, PreImage>();
  for (const name of fs.readdirSync(PATCHES_DIR)) {
    if (!name.endsWith('.before.json') || name.startsWith('.')) continue;
    const p = loadPreImage(name.slice(0, -'.before.json'.length));
    if (!p) continue;
    runs.set(p.run, p);
    const add = (id: string, e: IndexEntry) => byQid.set(id, [...(byQid.get(id) ?? []), e]);
    for (const [id, e] of Object.entries(p.questions)) add(id, { run: p.run, task: p.task, at: e.at, created: false, afterSig: e.afterSig });
    for (const id of p.createdIds) add(id, { run: p.run, task: p.task, at: p.created, created: true });
  }
  for (const list of byQid.values()) list.sort((a, b) => b.at.localeCompare(a.at) || b.run.localeCompare(a.run));
  indexMemo = { key, byQid, runs };
  return indexMemo;
}

const undoable = (e: IndexEntry, q: Question) => (e.created ? q.status !== 'retired' : questionSig(q) === e.afterSig);

/** The newest AI change of a question that can still be undone (GET /api/coach/undo-info), or null. */
export function undoInfo(qid: string, bank: BankState = loadBank()): UndoInfo | null {
  const q = bank.byId.get(qid);
  if (!q) return null;
  for (const e of preImageIndex().byQid.get(qid) ?? []) {
    if (undoable(e, q)) return { run: e.run, at: e.at, task: e.task, ...(e.created ? { created: true } : {}) };
  }
  return null;
}

let countsMemo: { key: string; counts: Map<string, { changed: number; created: number }> } | undefined;

/** Per run: questions an undo would restore / retire right now (only runs with something left to undo). */
export function undoableCounts(bank: BankState = loadBank()): Map<string, { changed: number; created: number }> {
  const idx = preImageIndex();
  const key = `${bank.version}|${idx.key}`;
  if (countsMemo?.key === key) return countsMemo.counts;
  const counts = new Map<string, { changed: number; created: number }>();
  for (const p of idx.runs.values()) {
    let changed = 0;
    let created = 0;
    for (const [id, e] of Object.entries(p.questions)) {
      const q = bank.byId.get(id);
      if (q ? questionSig(q) === e.afterSig : e.afterSig === MISSING_SIG) changed++;
    }
    for (const id of p.createdIds) {
      const q = bank.byId.get(id);
      if (q && q.status !== 'retired') created++;
    }
    if (changed || created) counts.set(p.run, { changed, created });
  }
  countsMemo = { key, counts };
  return counts;
}
