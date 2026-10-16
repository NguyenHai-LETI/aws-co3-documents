const pad = (n: number, w = 2) => String(Math.floor(Math.abs(n))).padStart(w, '0');

/** ISO-8601 in local time with offset, e.g. 2026-10-16T14:20:31+07:00 (readable in Markdown). */
export function localIso(d: Date = new Date()): string {
  const off = -d.getTimezoneOffset();
  const local = new Date(d.getTime() + off * 60000);
  return `${local.toISOString().slice(0, 19)}${off >= 0 ? '+' : '-'}${pad(off / 60)}:${pad(off % 60)}`;
}

/** Local date parts for file names: { date: '2026-10-16', time: '142031', compact: '20261016' } */
export function stampParts(d: Date = new Date()) {
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return { date, time, compact: date.replace(/-/g, ''), year: String(d.getFullYear()), month: pad(d.getMonth() + 1) };
}

export function localDateKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtLocal(iso: string): string {
  const d = new Date(iso);
  return `${localDateKey(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const DAY_MS = 86_400_000;
