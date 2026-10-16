export { fmtDuration } from '../../shared/timing.ts';

const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtRelative(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const m = Math.round(abs / 60000);
  let s: string;
  if (m < 1) s = 'vừa xong';
  else if (m < 60) s = `${m} phút`;
  else if (m < 60 * 24) s = `${Math.round(m / 60)} giờ`;
  else s = `${Math.round(m / 1440)} ngày`;
  if (s === 'vừa xong') return s;
  return future ? `còn ${s}` : `${s} trước`;
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function plural(n: number, word: string): string {
  return `${n.toLocaleString('vi-VN')} ${word}`;
}
