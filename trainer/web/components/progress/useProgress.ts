// [L] GET /api/progress shared by the Dashboard and the Stats page (one request per data version), POST helpers that
// put the server's fresh ProgressResponse straight into the shared cache, and date helpers for YYYY-MM-DD keys.
import { api } from '../../lib/api.ts';
import { loadShared, updateShared, useShared } from '../../lib/store.tsx';
import type { FsrsInfo, ProgressResponse } from '../../../shared/types.ts';

export const PROGRESS_URL = '/api/progress';

export function useProgress() {
  return useShared<ProgressResponse>(PROGRESS_URL);
}

/** POST a progress route (goal / external score) and show its result everywhere at once. */
export async function postProgress(url: string, body: unknown = {}): Promise<ProgressResponse> {
  const p = await api.post<ProgressResponse>(url, body);
  updateShared<ProgressResponse>(PROGRESS_URL, () => p);
  return p;
}

export function reloadProgress(): Promise<void> {
  return loadShared(PROGRESS_URL);
}

/** Show a fresh FsrsInfo (POST /api/fsrs/optimize answer) without refetching the whole payload. */
export function setProgressFsrs(fsrs: FsrsInfo): void {
  updateShared<ProgressResponse | undefined>(PROGRESS_URL, (prev) => (prev ? { ...prev, fsrs } : prev));
}

// ── dates as YYYY-MM-DD keys (no time zone shifts) ───────────────────────────

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function parts(key: string): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
}

/** 2026-12-15 → 15/12/2026 */
export function fmtDay(key?: string): string {
  if (!key) return '—';
  const [y, m, d] = parts(key);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/** 2026-12-15 → 15/12 */
export function fmtDayShort(key: string): string {
  const [, m, d] = parts(key);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** Vietnamese weekday abbreviation (T2 … T7, CN). */
export function weekday(key: string): string {
  const [y, m, d] = parts(key);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function daysLeftText(n: number): string {
  if (n < 0) return `đã qua ${-n} ngày`;
  if (n === 0) return 'thi hôm nay!';
  return `còn ${n} ngày`;
}

/** Local date of this browser as YYYY-MM-DD (date inputs, defaults). */
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Signed percent-point text: +4.2 / −3 / 0. */
export function signed(x: number, digits = 1): string {
  const v = Math.round(x * 10 ** digits) / 10 ** digits;
  return v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0';
}
