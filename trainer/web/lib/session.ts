// The in-progress test lives in localStorage so a reload/closed tab can resume it.
// It is a per-browser convenience only — the result is written to results/*.md on submit.
// Finished tests go through an outbox (also localStorage) until the server confirmed them — see "outbox" below.
import { useSyncExternalStore } from 'react';
import { api, ApiError, isRetryable } from './api.ts';
import type { AnswerInput, Attempt, BuildTestRequest, Question, SubmitRequest, TestSession } from '../../shared/types.ts';

export type ReviewFilter = 'all' | 'flagged' | 'unanswered';

export interface ActiveTest {
  session: TestSession;
  questions: Question[];
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
  warned: Record<string, number>; // time warnings already fired ("15" / "5" minutes → epoch ms)
  current: number;
  startedAt: number; // epoch ms
  pausedAt?: number; // epoch ms while paused
  pausedTotal: number; // ms
  /** options requested when the test was built — fallback when the server does not echo them in the session */
  opts?: { pearson?: boolean; recallFirst?: boolean };
  stage?: 'review'; // pearson: the end-of-exam review screen is open
  reviewIds?: string[]; // pearson: question ids being stepped through from the review screen
  reachedEnd?: boolean; // pearson: the review screen has been opened at least once
}

const KEY = 'trainer.activeTest.v1'; // unchanged so a test started before v2 still resumes

const obj = <T,>(v: unknown): Record<string, T> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, T>) : {});

/** Fills fields added after v1 so older saved tests keep working. */
function normalize(raw: unknown): ActiveTest | undefined {
  const r = raw as Partial<ActiveTest> | null;
  if (!r || typeof r !== 'object' || !r.session || !Array.isArray(r.questions) || !r.questions.length) return undefined;
  const current = Math.max(0, Math.min(r.questions.length - 1, Number(r.current) || 0));
  return {
    ...r,
    session: { ...r.session, questions: r.session.questions ?? r.questions.map((q) => ({ id: q.id })), notes: r.session.notes ?? [] },
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
}

export function loadActive(): ActiveTest | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

export function saveActive(t: ActiveTest): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // storage full / disabled — the test still works in memory
  }
}

export function clearActive(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
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
    opts: req ? { pearson: !!req.pearson && req.mode === 'exam', recallFirst: !!req.recallFirst } : undefined,
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

/** Seconds elapsed excluding pauses. */
export function elapsedSeconds(t: ActiveTest, now = Date.now()): number {
  const pausedNow = t.pausedAt ? now - t.pausedAt : 0;
  return Math.max(0, (now - t.startedAt - t.pausedTotal - pausedNow) / 1000);
}

export function remainingSeconds(t: ActiveTest, now = Date.now()): number | undefined {
  if (!t.session.timeLimit) return undefined;
  return t.session.timeLimit - elapsedSeconds(t, now);
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
 */
export function reconcileActive(t: ActiveTest, byId: Map<string, Question>): ReconcileResult {
  const res: ReconcileResult = { test: t, remapped: [], reset: [], missing: [] };
  if (!byId.size) return res;
  let changed = false;
  const answers = { ...t.answers };
  const elim = { ...t.elim };
  const revealed = { ...t.revealed };
  const why = { ...t.why };
  const orders = new Map<string, string[] | undefined>(); // id → new display order (undefined = bank order)
  const questions = t.questions.map((q) => {
    const cur = byId.get(q.id);
    if (!cur) {
      res.missing.push(q.id);
      return q;
    }
    if (q.hash && q.hash === cur.hash) {
      // same stem/options/answer — pick up metadata edits (explanation, hint, task…) silently
      if (JSON.stringify(q) === JSON.stringify(cur)) return q;
      changed = true;
      return cur;
    }
    changed = true;
    const map = keyMapByText(q, cur);
    const ref = t.session.questions.find((r) => r.id === q.id);
    if (map) {
      if ([...map].some(([a, b]) => a !== b)) {
        const remap = (keys?: string[]) => (keys ?? []).map((k) => map.get(k)).filter((k): k is string => !!k);
        if (answers[q.id]) answers[q.id] = remap(answers[q.id]);
        if (elim[q.id]) elim[q.id] = remap(elim[q.id]);
        if (ref?.order) orders.set(q.id, remap(ref.order));
        res.remapped.push(q.id);
      }
    } else {
      if (answers[q.id]?.length || elim[q.id]?.length || revealed[q.id]) res.reset.push(q.id);
      delete answers[q.id];
      delete elim[q.id];
      delete revealed[q.id];
      delete why[q.id];
      if (ref?.order) orders.set(q.id, undefined);
    }
    return cur;
  });
  if (!changed) return res;
  const refs = t.session.questions.map((r) => {
    if (!orders.has(r.id)) return r;
    const order = orders.get(r.id);
    return order ? { ...r, order } : { id: r.id };
  });
  res.test = { ...t, questions, answers, elim, revealed, why, session: { ...t.session, questions: refs } };
  return res;
}

/** Answers payload for POST /api/results (optional extras only when present). */
export function buildAnswers(t: ActiveTest): AnswerInput[] {
  return t.questions.map((q) => {
    const pick = t.answers[q.id] ?? [];
    const elim = (t.elim[q.id] ?? []).filter((k) => !pick.includes(k));
    const recall = (t.recall[q.id] ?? '').trim().slice(0, 300);
    const why = (t.why[q.id] ?? '').trim().slice(0, 500);
    const rt = Math.round(t.read?.[q.id] ?? 0);
    return {
      q: q.id,
      pick,
      t: Math.round(t.spent[q.id] ?? 0),
      flag: t.flags[q.id] || undefined,
      unsure: t.unsure[q.id] || undefined,
      elim: elim.length ? elim : undefined,
      recall: recall || undefined,
      hinted: t.hinted[q.id] || undefined,
      why: why && pick.length ? why : undefined,
      rt: rt > 0 ? rt : undefined,
    };
  });
}

/** POST /api/results body. `finishedAt` is fixed here once: retries of this submit send exactly the same request. */
export function buildSubmitRequest(t: ActiveTest, timedOut: boolean, now = Date.now()): SubmitRequest {
  return {
    session: t.session,
    answers: buildAnswers(t),
    startedAt: new Date(t.startedAt).toISOString(),
    finishedAt: new Date(now).toISOString(),
    timedOut,
    timeUsed: Math.round(t.session.timeLimit && timedOut ? t.session.timeLimit : elapsedSeconds(t, now)),
  };
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
}

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

export type SendOutcome = { attempt: Attempt } | { error: string; retryable: boolean };

const sending = new Map<string, Promise<SendOutcome>>();

/** Sends one queued submit (one request per session at a time); removes it from the outbox once the server answered. */
export function sendQueued(sessionId: string, now = Date.now()): Promise<SendOutcome> {
  const running = sending.get(sessionId);
  if (running) return running;
  const entry = entries().find((e) => e.req.session.sessionId === sessionId);
  if (!entry) return Promise.resolve({ error: 'Không còn bài này trong hàng chờ.', retryable: false });
  patchEntry(sessionId, (e) => ({ ...e, tries: e.tries + 1, lastTry: now }));
  const p = api
    .post<{ attempt: Attempt }>('/api/results', entry.req, { timeoutMs: SUBMIT_TIMEOUT_MS })
    .then((r): SendOutcome => {
      dropFromOutbox(sessionId);
      return { attempt: r.attempt };
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
      if ('attempt' in r) sent.push({ sessionId: sid, title: e.req.session.title, attempt: r.attempt });
      else if (r.retryable) break; // server unreachable: the others would fail the same way
    }
    return sent;
  })().finally(() => {
    if (flushing === run) flushing = undefined;
  });
  if (!opts.explicit) flushing = run;
  return run;
}
