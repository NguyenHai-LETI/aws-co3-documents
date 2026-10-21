// [v5] The unfinished test mirrored on the server so another device (the phone over LAN) can resume it:
// .local/active.json (git-ignored, per machine, never synced). The server stamps every accepted copy with its own clock
// (`updatedAt` = the mirror's version, never a device's clock); a device writes the same test over another device's copy
// only when it has seen that version (`base`). Removed on submit / abandon (and by POST /api/results for its session, in
// case the client's DELETE never arrived); a PUT for a submitted session is refused (routes/active.ts).
// GET / PUT / DELETE /api/active (routes/active.ts). The browser copy (web/lib/session.ts) stays the primary one.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../config.ts';

export interface ActiveMirror {
  updatedAt: string; // ISO, server clock: the version of this copy (strictly increasing over accepted writes)
  changedAt?: number; // epoch ms, the writer's own clock: orders the writes of one device (never compared across devices)
  device?: string; // short label of the writer ("💻 máy tính", "📱 điện thoại")
  deviceId?: string; // random id of the writer's browser: a device recognizes its own mirror
  test: unknown; // web/lib/session.ts ActiveTest (opaque to the server apart from session.sessionId / title)
}

/** A mirror without its (large) test, e.g. the answer to a refused PUT or GET ?info=1. */
export interface ActiveMirrorInfo {
  updatedAt: string;
  device?: string;
  deviceId?: string;
  sessionId: string;
  title: string;
  mode?: string;
  answered?: number; // questions of the session answered (relearn retries not counted)
  total?: number; // questions of the session
}

export const ACTIVE_FILE = path.join(DATA_DIR, '.local', 'active.json');

const MAX_LABEL = 40;

/** session.sessionId + title of a mirrored ActiveTest, or undefined when it does not look like one. */
export function mirrorSession(test: unknown): { sessionId: string; title: string } | undefined {
  if (!test || typeof test !== 'object' || Array.isArray(test)) return undefined;
  const t = test as { session?: unknown; questions?: unknown };
  const s = t.session as { sessionId?: unknown; title?: unknown; questions?: unknown } | undefined;
  if (!s || typeof s !== 'object' || typeof s.sessionId !== 'string' || !s.sessionId || s.sessionId.length > 200) return undefined;
  if (!Array.isArray(s.questions) || !s.questions.length || !Array.isArray(t.questions) || !t.questions.length) return undefined;
  return { sessionId: s.sessionId, title: typeof s.title === 'string' ? s.title.slice(0, 200) : '' };
}

function label(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL) : undefined;
}

export function mirrorInfo(m: ActiveMirror): ActiveMirrorInfo {
  const s = mirrorSession(m.test);
  const t = m.test as { session?: { mode?: unknown; questions?: { id?: unknown }[] }; answers?: Record<string, unknown> };
  const ids = new Set((t.session?.questions ?? []).map((r) => String(r?.id ?? '')));
  const answered = Object.entries(t.answers && typeof t.answers === 'object' ? t.answers : {}).filter(([id, v]) => ids.has(id) && Array.isArray(v) && v.length > 0).length;
  return {
    updatedAt: m.updatedAt,
    device: m.device,
    deviceId: m.deviceId,
    sessionId: s?.sessionId ?? '',
    title: s?.title ?? '',
    mode: typeof t.session?.mode === 'string' ? t.session.mode : undefined,
    answered,
    total: ids.size,
  };
}

/** The mirrored test, if any (a missing, unreadable or malformed file = none). */
export function loadActiveMirror(): ActiveMirror | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(ACTIVE_FILE, 'utf8'));
  } catch {
    return undefined;
  }
  const m = raw as Partial<ActiveMirror> | null;
  if (!m || typeof m !== 'object' || typeof m.updatedAt !== 'string' || !Number.isFinite(Date.parse(m.updatedAt)) || !mirrorSession(m.test)) return undefined;
  const changedAt = Number(m.changedAt);
  return { updatedAt: m.updatedAt, ...(changedAt > 0 ? { changedAt } : {}), device: label(m.device), deviceId: label(m.deviceId), test: m.test };
}

function writeAtomic(text: string): void {
  fs.mkdirSync(path.dirname(ACTIVE_FILE), { recursive: true });
  const tmp = `${ACTIVE_FILE}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, ACTIVE_FILE);
}

export interface SaveMirrorResult {
  saved: boolean;
  /**
   * Why nothing was written: 'conflict' = another device changed this test after the version this copy is based on
   * (`base`) — the writer must choose (take theirs / keep mine); 'older' = an earlier change of the same device arrived
   * late; 'submitted' = the test was submitted already (routes/active.ts).
   */
  refused?: 'older' | 'conflict' | 'submitted';
  active: ActiveMirrorInfo | null; // what is stored now
}

/**
 * PUT /api/active: `{changedAt?, base?, device, deviceId, test}`. The server stamps an accepted copy with its own clock
 * (strictly after the stored version), so devices whose clocks disagree still order correctly:
 * - another test than the stored one: accepted (the latest test touched is the one offered elsewhere);
 * - the same test from the same device: accepted unless it is an earlier change arriving late (`changedAt`, its own clock);
 * - the same test from another device: accepted only when `base` (the version it last synced with or took over) is the
 *   stored version — else it was made without seeing that device's progress: refused as a conflict.
 * Throws on a body that is not an unfinished test.
 */
export function saveActiveMirror(body: unknown, now = Date.now()): SaveMirrorResult {
  const b = (body ?? {}) as Partial<ActiveMirror> & { base?: unknown };
  const session = mirrorSession(b.test);
  if (!session) throw new Error('Không phải một bài đang làm (thiếu session hoặc câu hỏi).');
  const changedAt = Number(b.changedAt) > 0 ? Math.round(Number(b.changedAt)) : undefined;
  const deviceId = label(b.deviceId);
  const stored = loadActiveMirror();
  const storedAt = stored ? Date.parse(stored.updatedAt) : 0;
  if (stored && mirrorSession(stored.test)?.sessionId === session.sessionId) {
    if (deviceId && stored.deviceId === deviceId) {
      if (changedAt && stored.changedAt && changedAt < stored.changedAt) return { saved: false, refused: 'older', active: mirrorInfo(stored) };
    } else {
      const base = typeof b.base === 'string' ? Date.parse(b.base) : NaN;
      if (!(Number.isFinite(base) && base >= storedAt)) return { saved: false, refused: 'conflict', active: mirrorInfo(stored) };
    }
  }
  const incoming: ActiveMirror = {
    updatedAt: new Date(Math.max(now, storedAt + 1)).toISOString(),
    ...(changedAt ? { changedAt } : {}),
    device: label(b.device),
    deviceId,
    test: b.test,
  };
  writeAtomic(JSON.stringify(incoming));
  return { saved: true, active: mirrorInfo(incoming) };
}

/** DELETE /api/active (submit / abandon): removes the mirror — only the one of `sessionId` when given. */
export function clearActiveMirror(sessionId?: string): boolean {
  const stored = loadActiveMirror();
  if (!stored && !fs.existsSync(ACTIVE_FILE)) return false;
  if (sessionId && stored && mirrorSession(stored.test)?.sessionId !== sessionId) return false;
  try {
    fs.rmSync(ACTIVE_FILE, { force: true });
    return true;
  } catch {
    return false;
  }
}
