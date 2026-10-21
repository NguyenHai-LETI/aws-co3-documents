// The in-progress test lives in localStorage so a reload/closed tab can resume it — the result is written to
// results/*.md on submit. Finished tests go through an outbox (also localStorage) until the server confirmed them — see
// "outbox" below. [v5] The browser copy is also mirrored on the server (debounced PUT /api/active) so another device can
// resume it — see "mirror" below; the browser copy stays the primary one.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { api, ApiError, isRetryable } from './api.ts';
import type { AnswerInput, Attempt, BuildTestRequest, Question, SubmitRequest, TestSession } from '../../shared/types.ts';

export type ReviewFilter = 'all' | 'flagged' | 'unanswered';

/** [v5] An in-session relearn retry: question `of` asked again under the slot id `<of>~relearn`, options reordered. */
export interface RelearnSlot {
  of: string;
  order: string[];
}

export interface ActiveTest {
  session: TestSession;
  questions: Question[]; // [v5] relearn slots are copies of a question under their slot id (see "in-session relearning")
  answers: Record<string, string[]>;
  flags: Record<string, boolean>;
  unsure: Record<string, boolean>;
  revealed: Record<string, boolean>; // practice mode: answer checked
  spent: Record<string, number>; // seconds per question until it was answered (t; frozen by "Kiểm tra" in practice)
  read: Record<string, number>; // practice: seconds spent on the question after "Kiểm tra" showed the feedback (rt)
  elim: Record<string, string[]>; // option keys struck out per question
  recall: Record<string, string>; // recall-first: what the learner wrote before seeing the options
  recallShown: Record<string, boolean>; // recall-first: options unlocked for this question
  hinted: Record<string, boolean>; // practice: hint opened
  why: Record<string, string>; // practice: reason for a wrong pick
  warned: Record<string, number>; // time warnings already fired ("15" / "5" minutes, [v5] "budget" → epoch ms)
  current: number;
  startedAt: number; // epoch ms
  pausedAt?: number; // epoch ms while paused
  pausedTotal: number; // ms
  /** options requested when the test was built — fallback when the server does not echo them in the session */
  opts?: { pearson?: boolean; recallFirst?: boolean; relearn?: boolean };
  stage?: 'review'; // pearson: the end-of-exam review screen is open
  reviewIds?: string[]; // pearson: question ids being stepped through from the review screen
  reachedEnd?: boolean; // pearson: the review screen has been opened at least once
  relearn?: Record<string, RelearnSlot>; // [v5] slot id → the retry of a question answered wrong / with the hint
  savedAt?: number; // [v5] epoch ms of the last local change (set by saveActive): the mirror's updatedAt
}

const KEY = 'trainer.activeTest.v1'; // unchanged so a test started before v2 still resumes

const obj = <T,>(v: unknown): Record<string, T> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, T>) : {});

/** [v5] Relearn slots of a stored test (malformed entries dropped). */
function slotsOf(v: unknown): Record<string, RelearnSlot> {
  const out: Record<string, RelearnSlot> = {};
  for (const [id, s] of Object.entries(obj<Partial<RelearnSlot>>(v))) {
    if (s && typeof s.of === 'string' && id === s.of + RELEARN_SUFFIX) out[id] = { of: s.of, order: Array.isArray(s.order) ? s.order.map(String) : [] };
  }
  return out;
}

/** Fills fields added after v1 so older saved tests keep working. */
function normalize(raw: unknown): ActiveTest | undefined {
  const r = raw as Partial<ActiveTest> | null;
  if (!r || typeof r !== 'object' || !r.session || !Array.isArray(r.questions) || !r.questions.length) return undefined;
  const current = Math.max(0, Math.min(r.questions.length - 1, Number(r.current) || 0));
  const out: ActiveTest = {
    ...r,
    session: { ...r.session, questions: r.session.questions ?? r.questions.filter((q) => !isRelearnId(q.id)).map((q) => ({ id: q.id })), notes: r.session.notes ?? [] },
    questions: r.questions,
    answers: obj(r.answers),
    flags: obj(r.flags),
    unsure: obj(r.unsure),
    revealed: obj(r.revealed),
    spent: obj(r.spent),
    read: obj(r.read),
    elim: obj(r.elim),
    recall: obj(r.recall),
    recallShown: obj(r.recallShown),
    hinted: obj(r.hinted),
    why: obj(r.why),
    warned: obj(r.warned),
    current,
    startedAt: Number(r.startedAt) || Date.now(),
    pausedTotal: Number(r.pausedTotal) || 0,
  };
  const slots = slotsOf(r.relearn);
  if (Object.keys(slots).length) out.relearn = slots;
  else delete out.relearn;
  if (Number(r.savedAt) > 0) out.savedAt = Number(r.savedAt);
  return out;
}

export function loadActive(): ActiveTest | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

/** Stores the test in this browser (stamped with `savedAt`) and schedules its mirror on the server. */
export function saveActive(t: ActiveTest): void {
  const stamped: ActiveTest = { ...t, savedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(stamped));
  } catch {
    // storage full / disabled — the test still works in memory
  }
  queueMirror(stamped);
}

export function clearActive(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(SYNC_KEY);
  } catch {
    // ignore
  }
}

/** [v5] `savedAt` of the stored test (0 when none). */
export function activeSavedAt(): number {
  return loadActive()?.savedAt ?? 0;
}

export function startActive(session: TestSession, questions: Question[], req?: BuildTestRequest): ActiveTest {
  const t: ActiveTest = {
    session,
    questions,
    answers: {},
    flags: {},
    unsure: {},
    revealed: {},
    spent: {},
    read: {},
    elim: {},
    recall: {},
    recallShown: {},
    hinted: {},
    why: {},
    warned: {},
    current: 0,
    startedAt: Date.now(),
    pausedTotal: 0,
    opts: req ? { pearson: !!req.pearson && req.mode === 'exam', recallFirst: !!req.recallFirst, ...(req.relearn !== undefined ? { relearn: !!req.relearn } : {}) } : undefined,
  };
  saveActive(t);
  return t;
}

/** Pearson VUE simulation (review screen, no pause) — from the session, or the request if the server ignored it. */
export function isPearson(t: ActiveTest): boolean {
  return !!(t.session.pearson ?? t.opts?.pearson);
}

/** Recall-first: options stay hidden until the learner writes a guess. */
export function isRecallFirst(t: ActiveTest): boolean {
  return !!(t.session.recallFirst ?? t.opts?.recallFirst);
}

/** The clock can be paused (and is paused when the test moves to another device) — never in a mock exam. */
export function canPause(t: ActiveTest): boolean {
  return !isPearson(t) && t.session.mode !== 'exam';
}

/**
 * [v5] "⏹ Dừng ở đây" is offered in every mode except the honest measurements (mock / Pearson, sealed forms, diagnostic) —
 * same rule as the server's canStopEarly (server/lib/results.ts).
 */
export function canStopEarly(t: ActiveTest): boolean {
  const s = t.session;
  return !isPearson(t) && !s.sealedForm && !s.diagnostic && s.mode !== 'exam' && s.mode !== 'sealed' && s.mode !== 'diagnostic';
}

/** Seconds elapsed excluding pauses. */
export function elapsedSeconds(t: ActiveTest, now = Date.now()): number {
  const pausedNow = t.pausedAt ? now - t.pausedAt : 0;
  return Math.max(0, (now - t.startedAt - t.pausedTotal - pausedNow) / 1000);
}

export function remainingSeconds(t: ActiveTest, now = Date.now()): number | undefined {
  if (!t.session.timeLimit) return undefined;
  return t.session.timeLimit - elapsedSeconds(t, now);
}

// ── [v5] in-session relearning ──────────────────────────────────────────────
// In a practice session with `relearn`, a wrong (or hinted) answer comes back 3–6 questions later (or at the end) as a
// slot: a copy of the question under the id `<id>~relearn`, so every per-question map (answers, spent, revealed, recall…)
// works unchanged. Its options stay hidden until the learner recalls the answer or taps "Hiện lựa chọn", and come in
// another order. One retry per question. It is submitted as an extra answer `{q: <id>, relearn: true}` when answered;
// the first attempt stays the graded one (the server stores the retry right after it, out of the score).

export const RELEARN_SUFFIX = '~relearn';

export function isRelearnId(id: string): boolean {
  return id.endsWith(RELEARN_SUFFIX);
}

/** The bank id of a question entry (a relearn slot → the question it repeats). */
export function baseId(id: string): string {
  return isRelearnId(id) ? id.slice(0, -RELEARN_SUFFIX.length) : id;
}

/** Wrong / hinted answers come back later in this session (practice feedback only). */
export function isRelearn(t: ActiveTest): boolean {
  return t.session.feedback === 'practice' && !!(t.session.relearn ?? t.opts?.relearn);
}

/** FNV-1a: small, stable spreading of ids (the same question always comes back after the same gap). */
function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Questions between an answer and its relearn retry: 3–6. */
export function relearnGap(id: string): number {
  return 3 + (hashOf(id) % 4);
}

/** Display order of a question entry: the session's shuffled order, a relearn slot's own order, else the bank order. */
export function displayOrder(t: ActiveTest, q: Question): string[] | undefined {
  const order = isRelearnId(q.id) ? t.relearn?.[q.id]?.order : t.session.questions.find((r) => r.id === q.id)?.order;
  return order && order.length === q.options.length ? order : undefined;
}

/**
 * Pure: queues the retry of question `qid` (an original question, not queued yet) `relearnGap` questions after its position
 * — or at the end. The options are rotated so every one of them moves.
 */
export function queueRelearn(t: ActiveTest, qid: string): ActiveTest {
  const slotId = qid + RELEARN_SUFFIX;
  if (isRelearnId(qid) || t.relearn?.[slotId] || t.questions.some((x) => x.id === slotId)) return t;
  const pos = t.questions.findIndex((x) => x.id === qid);
  if (pos < 0) return t;
  const q = t.questions[pos];
  const shown = displayOrder(t, q) ?? q.options.map((o) => o.key);
  const k = shown.length > 1 ? 1 + (hashOf(qid) % (shown.length - 1)) : 0;
  const order = [...shown.slice(k), ...shown.slice(0, k)];
  const at = Math.min(t.questions.length, Math.max(pos, t.current) + 1 + relearnGap(qid));
  return {
    ...t,
    questions: [...t.questions.slice(0, at), { ...q, id: slotId }, ...t.questions.slice(at)],
    relearn: { ...(t.relearn ?? {}), [slotId]: { of: qid, order } },
  };
}

/** Answered / total over the session's own questions + relearn retries done / queued (headline counts). */
export function progressOf(t: ActiveTest): { answered: number; total: number; relearnDone: number; relearnTotal: number } {
  let answered = 0;
  let total = 0;
  let relearnDone = 0;
  let relearnTotal = 0;
  for (const q of t.questions) {
    const has = (t.answers[q.id] ?? []).length > 0;
    if (isRelearnId(q.id)) {
      relearnTotal++;
      if (has) relearnDone++;
    } else {
      total++;
      if (has) answered++;
    }
  }
  return { answered, total, relearnDone, relearnTotal };
}

// ── [v5] early stop ─────────────────────────────────────────────────────────

/** Seconds on a question that count as having looked at it (a stop sends viewed blanks as `skipped`). */
export const VIEWED_SECONDS = 2;

/** The learner looked at this question entry: an answer, any interaction, or a few seconds on it. */
export function wasViewed(t: ActiveTest, id: string): boolean {
  return (
    (t.answers[id] ?? []).length > 0 ||
    (t.spent[id] ?? 0) >= VIEWED_SECONDS ||
    (t.read?.[id] ?? 0) > 0 ||
    !!t.revealed[id] ||
    !!t.recall[id]?.trim() ||
    (t.elim[id] ?? []).length > 0 ||
    !!t.flags[id] ||
    !!t.unsure[id] ||
    !!t.hinted[id]
  );
}

/** "⏹ Dừng ở đây" copy: answered (stored + graded), viewed blanks (stored as skipped), never viewed (back to the queues). */
export function stopSummary(t: ActiveTest): { answered: number; skipped: number; unseen: number; planned: number; relearnOpen: number } {
  const s = { answered: 0, skipped: 0, unseen: 0, planned: 0, relearnOpen: 0 };
  for (const q of t.questions) {
    const has = (t.answers[q.id] ?? []).length > 0;
    if (isRelearnId(q.id)) {
      if (!has) s.relearnOpen++;
      continue;
    }
    s.planned++;
    if (has) s.answered++;
    else if (wasViewed(t, q.id)) s.skipped++;
    else s.unseen++;
  }
  return s;
}

// ── keeping a saved test in step with the bank ─────────────────────────────
// Picks/strikes/display order are stored as the question's option keys. When the bank changes under a
// saved test (e.g. the answer-position rebalance permutes options, ENRICH rewrites distractors), the
// keys must follow the option *text*, or a pick would silently point at another option and be graded wrong.

export interface ReconcileResult {
  test: ActiveTest; // same object when nothing changed
  remapped: string[]; // options moved: picks / strikes / display order now follow the option text
  reset: string[]; // option texts changed: the learner's answer for these questions was cleared
  missing: string[]; // no longer in the bank (the server skips them when grading)
}

const normText = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Old option key → current key, matched by option text; null when the option set is not the same. */
function keyMapByText(old: Question, cur: Question): Map<string, string> | null {
  if (!Array.isArray(old.options) || old.options.length !== cur.options.length) return null;
  const byText = new Map<string, string>();
  for (const o of cur.options) {
    const k = normText(o.text);
    if (byText.has(k)) return null; // duplicate texts — ambiguous
    byText.set(k, o.key);
  }
  const map = new Map<string, string>();
  for (const o of old.options) {
    const k = byText.get(normText(o.text ?? ''));
    if (!k) return null;
    map.set(o.key, k);
  }
  return new Set(map.values()).size === map.size ? map : null;
}

/**
 * Pure: compares the saved questions with the current bank (`hash`, or option texts for saves made before
 * questions had a hash) and returns the test updated to the bank's version of every question.
 * [v5] Relearn slots follow the question they repeat (lists name each bank question once).
 */
export function reconcileActive(t: ActiveTest, byId: Map<string, Question>): ReconcileResult {
  const res: ReconcileResult = { test: t, remapped: [], reset: [], missing: [] };
  if (!byId.size) return res;
  let changed = false;
  const answers = { ...t.answers };
  const elim = { ...t.elim };
  const revealed = { ...t.revealed };
  const why = { ...t.why };
  const orders = new Map<string, string[] | undefined>(); // entry id → new display order (undefined = bank order)
  const note = (list: string[], id: string) => !list.includes(id) && list.push(id);
  const questions = t.questions.map((q) => {
    const bid = baseId(q.id);
    const found = byId.get(bid);
    if (!found) {
      note(res.missing, bid);
      return q;
    }
    const cur = q.id === bid ? found : { ...found, id: q.id };
    if (q.hash && q.hash === cur.hash) {
      // same stem/options/answer — pick up metadata edits (explanation, hint, task…) silently
      if (JSON.stringify(q) === JSON.stringify(cur)) return q;
      changed = true;
      return cur;
    }
    changed = true;
    const map = keyMapByText(q, cur);
    const order = isRelearnId(q.id) ? t.relearn?.[q.id]?.order : t.session.questions.find((r) => r.id === q.id)?.order;
    if (map) {
      if ([...map].some(([a, b]) => a !== b)) {
        const remap = (keys?: string[]) => (keys ?? []).map((k) => map.get(k)).filter((k): k is string => !!k);
        if (answers[q.id]) answers[q.id] = remap(answers[q.id]);
        if (elim[q.id]) elim[q.id] = remap(elim[q.id]);
        if (order) orders.set(q.id, remap(order));
        note(res.remapped, bid);
      }
    } else {
      if (answers[q.id]?.length || elim[q.id]?.length || revealed[q.id]) note(res.reset, bid);
      delete answers[q.id];
      delete elim[q.id];
      delete revealed[q.id];
      delete why[q.id];
      if (order) orders.set(q.id, undefined);
    }
    return cur;
  });
  if (!changed) return res;
  const refs = t.session.questions.map((r) => {
    if (!orders.has(r.id)) return r;
    const order = orders.get(r.id);
    const { order: _old, ...rest } = r;
    return order ? { ...rest, order } : rest;
  });
  let relearn = t.relearn;
  if (relearn && [...orders.keys()].some(isRelearnId)) {
    relearn = { ...relearn };
    for (const [id, order] of orders) {
      const slot = relearn[id];
      if (slot) relearn[id] = { ...slot, order: order ?? [] };
    }
  }
  res.test = { ...t, questions, answers, elim, revealed, why, session: { ...t.session, questions: refs }, ...(relearn ? { relearn } : {}) };
  return res;
}

/**
 * Answers payload for POST /api/results (optional extras only when present).
 * [v5] Relearn retries go as `{q, relearn: true}` when answered (never as blanks). `stoppedEarly`: questions never looked
 * at are left out (they stay in the queues) and viewed blanks are sent as `skipped`.
 */
export function buildAnswers(t: ActiveTest, opts: { stoppedEarly?: boolean } = {}): AnswerInput[] {
  const out: AnswerInput[] = [];
  for (const q of t.questions) {
    const pick = t.answers[q.id] ?? [];
    const slot = isRelearnId(q.id);
    if (slot && !pick.length) continue;
    if (!slot && opts.stoppedEarly && !pick.length && !wasViewed(t, q.id)) continue;
    const elim = (t.elim[q.id] ?? []).filter((k) => !pick.includes(k));
    const recall = (t.recall[q.id] ?? '').trim().slice(0, 300);
    const why = (t.why[q.id] ?? '').trim().slice(0, 500);
    const rt = Math.round(t.read?.[q.id] ?? 0);
    const a: AnswerInput = {
      q: baseId(q.id),
      pick,
      t: Math.round(t.spent[q.id] ?? 0),
      flag: t.flags[q.id] || undefined,
      unsure: t.unsure[q.id] || undefined,
      elim: elim.length ? elim : undefined,
      recall: recall || undefined,
      hinted: t.hinted[q.id] || undefined,
      why: why && pick.length && !slot ? why : undefined,
      rt: rt > 0 ? rt : undefined,
    };
    if (slot) a.relearn = true;
    else if (opts.stoppedEarly && !pick.length) a.skipped = true;
    out.push(a);
  }
  return out;
}

/**
 * POST /api/results body. `finishedAt` is fixed here once: retries of this submit send exactly the same request.
 * [v5] `stoppedEarly` ("⏹ Dừng ở đây", modes where canStopEarly): only the part done is stored and scored.
 */
export function buildSubmitRequest(t: ActiveTest, timedOut: boolean, now = Date.now(), opts: { stoppedEarly?: boolean } = {}): SubmitRequest {
  const stoppedEarly = !!opts.stoppedEarly && canStopEarly(t);
  return {
    session: t.session,
    answers: buildAnswers(t, { stoppedEarly }),
    startedAt: new Date(t.startedAt).toISOString(),
    finishedAt: new Date(now).toISOString(),
    timedOut,
    timeUsed: Math.round(t.session.timeLimit && timedOut ? t.session.timeLimit : elapsedSeconds(t, now)),
    ...(stoppedEarly ? { stoppedEarly: true } : {}),
  };
}

// ── [v5] mirror: resume the unfinished test on another device ───────────────
// Every local save schedules a PUT /api/active ~3 s later (debounced; sent at once when the page is hidden) carrying
// `changedAt` (this device's clock, orders its own writes) and `base` = the mirror version this browser last synced with.
// The server stamps each accepted copy with its own clock (.local/active.json, never synced) and refuses a copy of the
// same test from another device that never saw the stored version ('conflict') or of a submitted test ('submitted'). A browser with no test of its own offers to resume the mirror (Runner); one
// whose copy of the same test is behind takes the newer progress — or asks, when it changed its own copy meanwhile.
// Submit / abandon remove the mirror. Best effort: offline nothing is mirrored and the browser copy works as before.

/** GET /api/active?info=1 — a mirror without its test. */
export interface MirrorInfo {
  updatedAt: string;
  device?: string;
  deviceId?: string;
  sessionId: string;
  title: string;
  mode?: string;
  answered?: number;
  total?: number;
}

/** GET /api/active — the mirrored test. */
export interface RemoteActive {
  updatedAt: string;
  device?: string;
  deviceId?: string;
  test: ActiveTest;
}

export interface MirrorPut {
  saved: boolean;
  refused?: 'older' | 'conflict' | 'submitted';
  active: MirrorInfo | null;
}

const DEVICE_KEY = 'trainer.deviceId';
const SYNC_KEY = 'trainer.activeSync.v1'; // {sessionId, local, version}: what the mirror holds of this browser's copy
export const MIRROR_DELAY_MS = 3000;
const MIRROR_RETRY_MS = 15_000;

let mirrorOn = typeof window !== 'undefined' && typeof document !== 'undefined';
let mirrorDelay = MIRROR_DELAY_MS;

/** Turns the mirror on / off and sets its debounce (tests drive it in Node, where it starts off). */
export function configureMirror(c: { enabled?: boolean; delayMs?: number }): void {
  if (c.enabled !== undefined) mirrorOn = c.enabled;
  if (c.delayMs !== undefined) mirrorDelay = c.delayMs;
}

function randomId(): string {
  try {
    const b = new Uint8Array(8);
    globalThis.crypto.getRandomValues(b); // also over plain-HTTP LAN (randomUUID needs a secure context)
    return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch {
    return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  }
}

let memDeviceId: string | undefined;
/** Random id of this browser (localStorage): a device recognizes the mirror it wrote itself. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return (memDeviceId ??= randomId());
  }
}

/** "💻 máy tính" / "📱 điện thoại" / "📱 máy tính bảng" — what another device calls this one. */
export function deviceLabel(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  const touchMac = /Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1; // iPadOS
  if (/iPad|Tablet/i.test(ua) || touchMac) return '📱 máy tính bảng';
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return '📱 điện thoại';
  return '💻 máy tính';
}

interface SyncState {
  sessionId: string;
  local: number; // savedAt of the last copy the server stored (or that was taken from it)
  version: string; // the mirror's updatedAt for that copy
}

function readSync(sessionId: string): SyncState | undefined {
  try {
    const s = JSON.parse(localStorage.getItem(SYNC_KEY) ?? 'null') as SyncState | null;
    return s && s.sessionId === sessionId && typeof s.version === 'string' ? s : undefined;
  } catch {
    return undefined;
  }
}

function writeSync(s: SyncState): void {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(s));
  } catch {
    // ignore: the next check treats the copy as never synced
  }
}

let pending: ActiveTest | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let holds = 0; // remote checks in flight: nothing is sent meanwhile
let failures = 0;
const refusalListeners = new Set<(r: MirrorPut, t: ActiveTest) => void>();

function arm(delay: number): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flushMirror(), delay);
  (timer as { unref?: () => void }).unref?.();
}

function queueMirror(t: ActiveTest): void {
  if (!mirrorOn) return;
  pending = t;
  failures = 0;
  arm(mirrorDelay);
}

/** Sends the waiting copy now (page hidden, tests). Resolves with the server's answer (undefined: nothing sent). */
export async function flushMirror(): Promise<MirrorPut | undefined> {
  if (timer) clearTimeout(timer);
  timer = undefined;
  const t = pending;
  if (!t || !mirrorOn) return undefined;
  if (holds > 0) {
    arm(mirrorDelay); // a remote check is looking: send after it
    return undefined;
  }
  pending = undefined;
  const sessionId = t.session.sessionId;
  const local = t.savedAt ?? Date.now();
  const base = readSync(sessionId)?.version;
  try {
    // the server stamps the version with its own clock; `changedAt` only orders this device's own writes
    const r = await api.put<MirrorPut>('/api/active', { changedAt: local, base, device: deviceLabel(), deviceId: deviceId(), test: t }, { timeoutMs: 20_000 });
    if (r.saved && r.active) writeSync({ sessionId, local, version: r.active.updatedAt });
    else for (const fn of refusalListeners) fn(r, t);
    return r;
  } catch {
    // no connection / server restarting: once more a little later unless a newer copy is waiting already
    if (!pending && failures++ < 3) {
      pending = t;
      arm(MIRROR_RETRY_MS);
    }
    return undefined;
  }
}

/** Called when the server keeps another copy (a newer one, or another device's progress on this test). */
export function onMirrorRefused(fn: (r: MirrorPut, t: ActiveTest) => void): () => void {
  refusalListeners.add(fn);
  return () => refusalListeners.delete(fn);
}

/** Submit / abandon: forget the waiting copy of this test and remove its mirror (best effort). */
export function dropMirror(sessionId: string): void {
  if (pending?.session.sessionId === sessionId) {
    pending = undefined;
    if (timer) clearTimeout(timer);
    timer = undefined;
  }
  try {
    if (readSync(sessionId)) localStorage.removeItem(SYNC_KEY);
  } catch {
    // ignore
  }
  if (mirrorOn) void api.del(`/api/active?session=${encodeURIComponent(sessionId)}`).catch(() => undefined);
}

/** The mirrored test with its questions (GET /api/active), null when there is none. */
export async function fetchMirror(): Promise<RemoteActive | null> {
  const r = await api.get<{ active: { updatedAt: string; device?: string; deviceId?: string; test: unknown } | null }>('/api/active');
  const test = r?.active ? normalize(r.active.test) : undefined;
  return test && r.active ? { updatedAt: r.active.updatedAt, device: r.active.device, deviceId: r.active.deviceId, test } : null;
}

/** GET /api/active?info=1[&session=] — who changed which test when; `submitted` = that session was already submitted. */
export async function fetchMirrorInfo(sessionId?: string): Promise<{ active: MirrorInfo | null; submitted?: string }> {
  return api.get<{ active: MirrorInfo | null; submitted?: string }>(`/api/active?info=1${sessionId ? `&session=${encodeURIComponent(sessionId)}` : ''}`);
}

async function holding<T>(p: () => Promise<T>): Promise<T> {
  holds++;
  try {
    return await p();
  } finally {
    holds--;
  }
}

export type RemoteCheck =
  | { kind: 'none' }
  | { kind: 'submitted'; attemptId: string } // finished on another device
  | { kind: 'adopt'; remote: RemoteActive } // newer progress elsewhere and nothing new here: take it
  | { kind: 'conflict'; remote: RemoteActive }; // both copies changed: the learner chooses

/**
 * Did another device continue this test? Holds this browser's mirror writes while it looks (a stale copy must not
 * overwrite newer progress). Cheap when nothing changed (one small GET).
 */
export function checkRemote(t: ActiveTest): Promise<RemoteCheck> {
  if (!mirrorOn) return Promise.resolve({ kind: 'none' });
  const sid = t.session.sessionId;
  return holding(async (): Promise<RemoteCheck> => {
    const info = await fetchMirrorInfo(sid);
    if (info.submitted) return { kind: 'submitted', attemptId: info.submitted };
    const m = info.active;
    if (!m || m.sessionId !== sid || m.deviceId === deviceId()) return { kind: 'none' };
    const sync = readSync(sid);
    if (sync && !(Date.parse(m.updatedAt) > Date.parse(sync.version))) return { kind: 'none' };
    const remote = await fetchMirror();
    if (!remote || remote.test.session.sessionId !== sid) return { kind: 'none' };
    const saved = activeSavedAt();
    // never synced here (offline since it started, storage cleared): both copies may hold answers — ask
    const unsynced = sync ? saved > sync.local : true;
    return unsynced ? { kind: 'conflict', remote } : { kind: 'adopt', remote };
  });
}

/**
 * Takes the mirrored copy as this browser's test (resume here). A pausable test arrives paused at the time of its last
 * change elsewhere (the gap between devices is not study time); a mock exam's clock keeps running, like the real one.
 */
export function adoptMirror(m: RemoteActive, now = Date.now()): ActiveTest {
  let t = m.test;
  const at = Date.parse(m.updatedAt);
  if (canPause(t) && !t.pausedAt) t = { ...t, pausedAt: Math.min(now, Number.isFinite(at) ? at : now) };
  writeSync({ sessionId: t.session.sessionId, local: 0, version: m.updatedAt });
  saveActive(t); // this browser is the writer now
  return loadActive() ?? t;
}

/** "Giữ bản trên máy này": this copy replaces the other device's progress on the next write. */
export function keepLocalOver(m: RemoteActive | MirrorInfo, t: ActiveTest): void {
  writeSync({ sessionId: t.session.sessionId, local: 0, version: m.updatedAt });
  saveActive(t);
}

/**
 * The mirror of an unfinished test (info only), for pages that offer "⏯ Tiếp tục bài đang làm" when this browser has no
 * test of its own (Runner, and e.g. the Dashboard / sidebar). Re-checked when the page becomes visible again.
 */
export function useRemoteActive(enabled = true): { remote: MirrorInfo | null | undefined; reload: () => void } {
  const [remote, setRemote] = useState<MirrorInfo | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled || !mirrorOn) {
      setRemote(undefined);
      return;
    }
    let alive = true;
    fetchMirrorInfo()
      .then((r) => alive && setRemote(r.active))
      .catch(() => alive && setRemote(null));
    const again = () => {
      if (!document.hidden) setTick((n) => n + 1);
    };
    document.addEventListener('visibilitychange', again);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', again);
    };
  }, [enabled, tick]);
  return { remote, reload: () => setTick((n) => n + 1) };
}

if (mirrorOn) {
  // the learner is leaving this device (tab hidden, phone locked, page closed): the latest copy goes out now
  const now = () => {
    if (pending) void flushMirror();
  };
  document.addEventListener('visibilitychange', () => document.hidden && now());
  window.addEventListener('pagehide', now);
}

// ── outbox: finished tests waiting for the server ───────────────────────────
// Submitting stores the request here first (write-ahead) and removes it once the server confirmed. A submit that got no
// answer (Wi-Fi drop, server restarting for an update, LAN code expired) stays as "⏳ chờ nộp" and is sent again on
// `online`, page load, tab focus and every 30 s while the page is open (App.tsx) — the same request each time (same
// finishedAt), and the server returns the attempt it already stored for that sessionId when an earlier try did arrive.
// No Background Sync: Safari on iOS has none.

export interface OutboxEntry {
  req: SubmitRequest;
  queuedAt: number; // epoch ms
  tries: number;
  lastTry?: number;
  error?: string; // last failure, for the "⏳ chờ nộp" view
  permanent?: boolean; // the server refused it (4xx other than 401/408/429): not retried automatically
}

export interface SentSubmit {
  sessionId: string;
  title: string;
  attempt: Attempt;
  differs?: boolean; // [v5] another copy of this test was stored first with other answers: these were not saved
}

/**
 * [v5] Toast text when a submit came back `differs` (another device submitted the same test first, with other answers —
 * e.g. this one waited offline in the outbox while the other resumed the mirrored test).
 */
export const DIFFERS_NOTE =
  '⚠️ Bài này đã được nộp trước đó từ thiết bị khác với câu trả lời khác — kết quả hiển thị là bản đã lưu, câu trả lời gửi từ đây không được lưu thêm.';

const OUTBOX_KEY = 'trainer.outbox.v1';
export const SUBMIT_TIMEOUT_MS = 20_000;

let outboxSnap: OutboxEntry[] | undefined;
const outboxListeners = new Set<() => void>();

function readOutbox(): OutboxEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((e): e is OutboxEntry => !!e && typeof e === 'object' && !!(e as OutboxEntry).req?.session?.sessionId) : [];
  } catch {
    return [];
  }
}

export function loadOutbox(): OutboxEntry[] {
  outboxSnap ??= readOutbox();
  return outboxSnap;
}

let storageOk = true; // false after a failed write (storage full / disabled): this tab's memory is the outbox then

function writeOutbox(list: OutboxEntry[]): void {
  outboxSnap = list;
  try {
    if (list.length) localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
    else localStorage.removeItem(OUTBOX_KEY);
    storageOk = true;
  } catch {
    storageOk = false; // the entries live in memory until the page closes — still sent from here
  }
  for (const fn of outboxListeners) fn();
}

/** The current entries: storage (another tab may have changed it), or this tab's memory when storage failed. */
function entries(): OutboxEntry[] {
  return storageOk ? readOutbox() : (outboxSnap ?? []);
}

function patchEntry(sessionId: string, fn: (e: OutboxEntry) => OutboxEntry): void {
  writeOutbox(entries().map((e) => (e.req.session.sessionId === sessionId ? fn(e) : e)));
}

/** Stores a finished test before sending it (replaces an older entry of the same session). */
export function queueSubmit(req: SubmitRequest, now = Date.now()): OutboxEntry {
  const entry: OutboxEntry = { req, queuedAt: now, tries: 0 };
  writeOutbox([...entries().filter((e) => e.req.session.sessionId !== req.session.sessionId), entry]);
  return entry;
}

export function dropFromOutbox(sessionId: string): void {
  writeOutbox(entries().filter((e) => e.req.session.sessionId !== sessionId));
}

function subscribeOutbox(fn: () => void): () => void {
  outboxListeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === OUTBOX_KEY || e.key === null) {
      const stored = readOutbox();
      // memory-only entries of this tab (its storage writes failed) are kept
      const mine = storageOk ? [] : (outboxSnap ?? []).filter((x) => !stored.some((y) => y.req.session.sessionId === x.req.session.sessionId));
      outboxSnap = [...stored, ...mine];
      fn();
    }
  };
  window.addEventListener('storage', onStorage); // another tab queued / sent one
  return () => {
    outboxListeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

/** Entries waiting in this browser (re-renders when they change, also from another tab). */
export function useOutbox(): OutboxEntry[] {
  return useSyncExternalStore(subscribeOutbox, loadOutbox, loadOutbox);
}

export type SendOutcome = { attempt: Attempt; differs?: boolean } | { error: string; retryable: boolean };

const sending = new Map<string, Promise<SendOutcome>>();

/** Sends one queued submit (one request per session at a time); removes it from the outbox once the server answered. */
export function sendQueued(sessionId: string, now = Date.now()): Promise<SendOutcome> {
  const running = sending.get(sessionId);
  if (running) return running;
  const entry = entries().find((e) => e.req.session.sessionId === sessionId);
  if (!entry) return Promise.resolve({ error: 'Không còn bài này trong hàng chờ.', retryable: false });
  patchEntry(sessionId, (e) => ({ ...e, tries: e.tries + 1, lastTry: now }));
  const p = api
    .post<{ attempt: Attempt; differs?: boolean }>('/api/results', entry.req, { timeoutMs: SUBMIT_TIMEOUT_MS })
    .then((r): SendOutcome => {
      dropFromOutbox(sessionId);
      return r.differs ? { attempt: r.attempt, differs: true } : { attempt: r.attempt };
    })
    .catch((e: unknown): SendOutcome => {
      const retryable = isRetryable(e);
      const msg = e instanceof Error ? e.message : String(e);
      const error = e instanceof ApiError && e.status === 401 ? `${msg} — mở lại trang và nhập mã truy cập` : msg;
      patchEntry(sessionId, (x) => ({ ...x, error, permanent: !retryable || undefined }));
      return { error, retryable };
    })
    .finally(() => sending.delete(sessionId));
  sending.set(sessionId, p);
  return p;
}

let flushing: Promise<SentSubmit[]> | undefined;

/**
 * Sends the waiting entries and resolves with the submits that went through. Automatic flushes (App.tsx) skip permanent
 * refusals and entries already in flight (the runner's own first try reports itself); `explicit` (the learner's "Thử nộp
 * lại ngay") sends refused ones too and waits for those in flight.
 */
export function flushOutbox(opts: { explicit?: boolean } = {}): Promise<SentSubmit[]> {
  if (flushing && !opts.explicit) return flushing;
  const run = (async () => {
    const sent: SentSubmit[] = [];
    for (const e of entries()) {
      const sid = e.req.session.sessionId;
      if (!opts.explicit && (e.permanent || sending.has(sid))) continue;
      const r = await sendQueued(sid);
      if ('attempt' in r) sent.push({ sessionId: sid, title: e.req.session.title, attempt: r.attempt, ...(r.differs ? { differs: true } : {}) });
      else if (r.retryable) break; // server unreachable: the others would fail the same way
    }
    return sent;
  })().finally(() => {
    if (flushing === run) flushing = undefined;
  });
  if (!opts.explicit) flushing = run;
  return run;
}
