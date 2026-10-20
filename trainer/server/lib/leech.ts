// [v5 · λ] Leeches ("câu dai dẳng"): lapses ≥ srs.leech_lapses, or wrong ≥ 3 times on ≥ 2 days, until answered right
// twice in a row on two different days — derived from the answer history by computeStates (QuestionState.leech); nothing
// is stored but the learner's notes / pauses in results/leeches.md:
//   - YYYY-MM-DD · <id> · pause N · note: …
// Append-only lines (merge=union in .gitattributes, so two devices can both append); the latest line per id wins (latest
// date, then the later line). Each line carries the full state: `pause N` parks the leech for N days from that date
// (that day included, N ≤ 3; 0 = not parked), `note` is the learner's memory aid (the coach reads it). A parked leech is
// left out of reviews and "Học hôm nay" (stats.ts reviewQueue, select.ts). GET /api/leeches · POST /api/leeches/:id.
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS_DIR } from '../config.ts';
import type { Ctx } from '../context.ts';
import type { BankState } from './bank.ts';
import { dayKey, dayOfKey } from './fsrs.ts';
import { isUnviewed } from './regrade.ts';
import { questionTerms } from './insights.ts';
import { sealedIds } from './sealed.ts';
import { localDateKey } from './time.ts';
import type { Attempt, LeechItem, QuestionState } from '../../shared/types.ts';

export const LEECHES_FILE = path.join(RESULTS_DIR, 'leeches.md');
/** Longest pause (days) and note (characters). */
export const LEECH_PAUSE_MAX = 3;
export const LEECH_NOTE_MAX = 300;
/** Wrong answers on at least this many distinct days (with ≥ LEECH_WRONG_MIN wrong answers) make a leech too. */
export const LEECH_WRONG_MIN = 3;
export const LEECH_WRONG_DAYS = 2;
/** Right answers on this many distinct days in a row (since the last wrong one) take a question off the list. */
export const LEECH_RECOVER_DAYS = 2;
/** LeechItem.why: the learner's most recent "vì sao chọn" notes. */
const WHY_SHOWN = 5;
const STEM_CHARS = 140;

const HEADER = [
  '# 🐌 Câu dai dẳng — ghi chú & tạm gác',
  '',
  '_File do app quản lý (Thống kê → Câu dai dẳng). Mỗi dòng là trạng thái mới nhất của một câu: dòng mới hơn thắng; chỉ thêm, không sửa._',
  '',
].join('\n');

/** Thrown for invalid POST /api/leeches input (→ HTTP status). */
export class LeechError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface LeechNote {
  id: string;
  date: string; // YYYY-MM-DD of the line
  pause: number; // days parked from `date` (0 = not parked)
  note: string;
  pausedUntil?: string; // date + pause − 1 (pause > 0)
}

const LINE = /^-\s+(\d{4}-\d{2}-\d{2})\s+·\s+(\S+)\s+·\s+pause\s+(\d+)\s+·\s+note:\s?(.*)$/;

/** One-line, length-limited note text (· and line breaks would break the line format). */
export function cleanLeechNote(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\s+/g, ' ').trim().slice(0, LEECH_NOTE_MAX).trim();
}

/** Latest note / pause per id from the text of results/leeches.md (malformed lines are skipped). */
export function parseLeechNotes(text: string): Map<string, LeechNote> {
  const out = new Map<string, LeechNote>();
  for (const raw of text.split(/\r?\n/)) {
    const m = LINE.exec(raw.trim());
    if (!m) continue;
    const day = dayOfKey(m[1]);
    if (day === undefined) continue;
    const prev = out.get(m[2]);
    if (prev && prev.date > m[1]) continue; // an older line appended later (another device's clock / a union merge)
    const pause = Math.min(LEECH_PAUSE_MAX, Number(m[3]) || 0);
    const n: LeechNote = { id: m[2], date: m[1], pause, note: m[4].trim() };
    if (pause > 0) n.pausedUntil = dayKey(day + pause - 1);
    out.set(m[2], n);
  }
  return out;
}

let memo: { sig: string; notes: Map<string, LeechNote> } | undefined;

function fileSig(): string {
  try {
    const st = fs.statSync(LEECHES_FILE);
    return `${st.mtimeMs}:${st.size}:${st.ino}`;
  } catch {
    return '';
  }
}

/** Latest note / pause per id (results/leeches.md, re-read only when the file changed). Shared map — do not mutate. */
export function loadLeechNotes(): Map<string, LeechNote> {
  const sig = fileSig();
  if (memo?.sig === sig) return memo.notes;
  const notes = sig ? parseLeechNotes(fs.readFileSync(LEECHES_FILE, 'utf8')) : new Map<string, LeechNote>();
  memo = { sig, notes };
  return notes;
}

/** Ids of leeches paused through `today` (YYYY-MM-DD). */
export function pausedLeeches(today: string): Set<string> {
  const out = new Set<string>();
  for (const n of loadLeechNotes().values()) if (n.pausedUntil && n.pausedUntil >= today) out.add(n.id);
  return out;
}

/** Marks the parked leeches in `states` (QuestionState.leechPausedUntil) — context() calls it once per data state. */
export function applyLeechPauses(states: Map<string, QuestionState>, today: string, notes: Map<string, LeechNote> = loadLeechNotes()): void {
  for (const n of notes.values()) {
    const s = states.get(n.id);
    if (s?.leech && n.pausedUntil && n.pausedUntil >= today) s.leechPausedUntil = n.pausedUntil;
  }
}

/** Appends one state line for `id` (creates the file with its header first). */
function appendLine(line: string): void {
  fs.mkdirSync(path.dirname(LEECHES_FILE), { recursive: true });
  const exists = fs.existsSync(LEECHES_FILE);
  let prefix = '';
  if (!exists) prefix = HEADER + '\n';
  else {
    const text = fs.readFileSync(LEECHES_FILE, 'utf8');
    if (text && !text.endsWith('\n')) prefix = '\n';
  }
  fs.appendFileSync(LEECHES_FILE, prefix + line + '\n');
  memo = undefined;
}

// ── the list ────────────────────────────────────────────────────────────────

interface Detail {
  wrong: number;
  wrongDays: Set<string>;
  picks: Record<string, number>;
  why: string[];
  lastAt?: string;
}

/** Wrong answers, wrong days, wrong picks and "why" notes of `ids` (learning view, non-rushed, first attempts only). */
function details(attempts: Attempt[], ids: Set<string>): Map<string, Detail> {
  const out = new Map<string, Detail>();
  const ordered = attempts
    .filter((a) => !a.rushed)
    .map((a, i) => ({ a, i, at: Date.parse(a.finished) || 0 }))
    .sort((x, y) => x.at - y.at || x.i - y.i);
  for (const { a } of ordered) {
    const day = localDateKey(a.finished);
    for (const r of a.answers) {
      if (!ids.has(r.q) || isUnviewed(r) || r.skipped || r.relearn) continue;
      let d = out.get(r.q);
      if (!d) out.set(r.q, (d = { wrong: 0, wrongDays: new Set(), picks: {}, why: [] }));
      d.lastAt = a.finished;
      if (r.ok) continue;
      d.wrong++;
      d.wrongDays.add(day);
      for (const k of r.pick) if (!r.key.includes(k)) d.picks[k] = (d.picks[k] ?? 0) + 1;
      if (r.why) d.why.push(r.why);
    }
  }
  return out;
}

/** Most likely confusion of a leech: services of its most-picked wrong option vs the key's ([picked, correct]). */
function likelyPair(bank: BankState, id: string, picks: Record<string, number>): string[] | undefined {
  const q = bank.byId.get(id);
  const top = Object.entries(picks).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  if (!q || !top) return undefined;
  const lure = questionTerms(q, bank.taxonomy).lures.find((l) => l.key === top);
  const pair = lure?.pairs.find((p) => bank.taxonomy.services[p.split('\u0000')[0]]) ?? lure?.pairs[0];
  return pair ? pair.split('\u0000') : undefined;
}

const listMemo = new WeakMap<Map<string, QuestionState>, { sig: string; list: LeechItem[] }>();

/** Current leeches of the practice bank (sealed questions never listed), worst first: lapses, wrong answers, recency. */
export function leeches(ctx: Pick<Ctx, 'bank' | 'attempts' | 'states'>): LeechItem[] {
  const notes = loadLeechNotes();
  const sealed = sealedIds();
  const sig = `${fileSig()}|${ctx.bank.version}|${sealed.size}`;
  const hit = listMemo.get(ctx.states);
  if (hit?.sig === sig) return hit.list;
  const today = localDateKey(new Date());
  const ids = new Set<string>();
  for (const s of ctx.states.values()) if (s.leech && !sealed.has(s.id) && ctx.bank.byId.get(s.id)?.status === 'active') ids.add(s.id);
  const info = details(ctx.attempts, ids);
  const list: LeechItem[] = [];
  for (const id of ids) {
    const s = ctx.states.get(id)!;
    const q = ctx.bank.byId.get(id)!;
    const d = info.get(id) ?? { wrong: s.attempts - s.correct, wrongDays: new Set<string>(), picks: {}, why: [] };
    const n = notes.get(id);
    const item: LeechItem = {
      id,
      lapses: s.lapses ?? 0,
      wrong: d.wrong,
      wrongDays: d.wrongDays.size,
      picks: d.picks,
      why: d.why.slice(-WHY_SHOWN).reverse(),
      topic: q.topic,
      stem: q.stem.length > STEM_CHARS ? `${q.stem.slice(0, STEM_CHARS - 1).trimEnd()}…` : q.stem,
    };
    if (d.lastAt ?? s.lastAt) item.lastAt = d.lastAt ?? s.lastAt;
    if (n?.pausedUntil && n.pausedUntil >= today) item.pausedUntil = n.pausedUntil;
    if (n?.note) item.note = n.note;
    const pair = likelyPair(ctx.bank, id, d.picks);
    if (pair) item.pair = pair;
    list.push(item);
  }
  list.sort((a, b) => b.lapses - a.lapses || b.wrong - a.wrong || (b.lastAt ?? '').localeCompare(a.lastAt ?? '') || a.id.localeCompare(b.id));
  listMemo.set(ctx.states, { sig, list });
  return list;
}

/**
 * POST /api/leeches/:id {note?, pauseDays?}: appends the new state line. Missing fields keep their value (a running pause
 * keeps its end date); `pauseDays` 0 = un-park, 1…LEECH_PAUSE_MAX = park from today. Parking needs a current leech.
 */
export function saveLeechNote(ctx: Pick<Ctx, 'bank' | 'states'>, id: string, input: { note?: unknown; pauseDays?: unknown }, now = Date.now()): LeechNote {
  const q = ctx.bank.byId.get(id);
  if (!q || sealedIds().has(id)) throw new LeechError(404, 'Không tìm thấy câu hỏi này.');
  const today = localDateKey(new Date(now));
  const todayDay = dayOfKey(today)!;
  const cur = loadLeechNotes().get(id);
  let pause = 0;
  if (cur?.pausedUntil && cur.pausedUntil >= today) pause = Math.min(LEECH_PAUSE_MAX, dayOfKey(cur.pausedUntil)! - todayDay + 1);
  if (input.pauseDays !== undefined && input.pauseDays !== null && input.pauseDays !== '') {
    const n = Number(input.pauseDays);
    if (!Number.isInteger(n) || n < 0 || n > LEECH_PAUSE_MAX) throw new LeechError(400, `Chỉ tạm gác được 0–${LEECH_PAUSE_MAX} ngày.`);
    if (n > 0 && !ctx.states.get(id)?.leech) throw new LeechError(400, 'Chỉ tạm gác được câu đang nằm trong danh sách câu dai dẳng.');
    pause = n;
  }
  const note = input.note !== undefined ? cleanLeechNote(input.note) : (cur?.note ?? '');
  if (input.note === undefined && (input.pauseDays === undefined || input.pauseDays === null || input.pauseDays === '')) throw new LeechError(400, 'Cần ghi chú (note) hoặc số ngày tạm gác (pauseDays).');
  appendLine(`- ${today} · ${id} · pause ${pause} · note: ${note}`);
  return loadLeechNotes().get(id) ?? { id, date: today, pause, note };
}
