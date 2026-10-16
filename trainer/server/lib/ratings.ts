// bank/ratings.md — 👍/👎 the learner gives questions (append-only; `merge=union` across machines).
//   - 2026-10-16 · `ai-20261016-1830-02` · down · B và C đều đúng
// The coach may append ` → ✅ YYYY-MM-DD coach: …` to a line once the question was fixed or retired;
// such a rating stays in the file but no longer counts. One vote per question per day (latest wins).
import fs from 'node:fs';
import { RATINGS_FILE } from '../config.ts';
import { localDateKey } from './time.ts';
import type { RatingItem } from '../../shared/types.ts';

const HEADER = `# 👍👎 Question ratings

Đánh giá câu hỏi do người học bấm 👍/👎 (màn hình kết quả, ngân hàng câu hỏi). File chỉ ghi thêm (append-only).
AI Coach xử lý câu bị 👎 nhiều (snapshot §14): sửa câu (giữ nguyên id) hoặc đặt \`status: retired\`, rồi thêm
\` → ✅ YYYY-MM-DD coach: …\` vào cuối các dòng đã xử lý (dòng có \`→\` không còn được tính).

Định dạng 1 dòng: \`- YYYY-MM-DD · \\\`question-id\\\` · up|down · ghi chú\`

<!-- ratings -->
`;

const LINE = /^- (\d{4}-\d{2}-\d{2}) · `([^`]+)` · (up|down)(?: · (.*))?\s*$/;

export interface RatingEntry extends RatingItem {
  resolution?: string; // text after " → " (handled by the coach)
}

export function loadRatings(file: string = RATINGS_FILE): RatingEntry[] {
  if (!fs.existsSync(file)) return [];
  const items: RatingEntry[] = [];
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const m = line.match(LINE);
      if (!m) return;
      const [note, resolution] = (m[4] ?? '').split(/\s+→\s+/, 2);
      const item: RatingEntry = { line: i + 1, date: m[1], qid: m[2], value: m[3] as 'up' | 'down' };
      if (note.trim()) item.note = note.trim();
      if (resolution?.trim()) item.resolution = resolution.trim();
      items.push(item);
    });
  return items;
}

export function ensureRatingsFile(file: string = RATINGS_FILE): void {
  if (!fs.existsSync(file)) fs.writeFileSync(file, HEADER);
}

export function addRating(qid: string, value: 'up' | 'down', note?: string, file: string = RATINGS_FILE): RatingEntry {
  ensureRatingsFile(file);
  const clean = (note ?? '').replace(/\s+/g, ' ').replace(/→/g, '->').replace(/`/g, "'").trim().slice(0, 300);
  const line = `- ${localDateKey(new Date())} · \`${qid}\` · ${value}${clean ? ` · ${clean}` : ''}`;
  const text = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, (text.endsWith('\n') || !text ? text : text + '\n') + line + '\n');
  return loadRatings(file).reverse().find((x) => x.qid === qid)!;
}

export function ratingsMtime(file: string = RATINGS_FILE): number {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Votes per question: one per question per day (the latest line of the day wins), resolved ratings
 * excluded — also the unresolved copy of a line that a union merge kept next to its resolved copy.
 */
export function aggregateRatings(items: RatingEntry[]): Record<string, { up: number; down: number }> {
  const key = (r: RatingEntry) => `${r.date}|${r.qid}|${r.value}|${r.note ?? ''}`;
  const resolved = new Set(items.filter((r) => r.resolution).map(key));
  const daily = new Map<string, RatingEntry>();
  for (const r of items) daily.set(`${r.qid}|${r.date}`, r);
  const out: Record<string, { up: number; down: number }> = {};
  for (const r of daily.values()) {
    if (r.resolution || resolved.has(key(r))) continue;
    const v = (out[r.qid] ??= { up: 0, down: 0 });
    v[r.value]++;
  }
  return out;
}

/** Questions the learner keeps rating 👎: down ≥ 2 and more downs than ups. */
export function lowRatedIds(votes: Record<string, { up: number; down: number }>): string[] {
  return Object.entries(votes)
    .filter(([, v]) => v.down >= 2 && v.down > v.up)
    .sort((a, b) => b[1].down - b[1].up - (a[1].down - a[1].up) || a[0].localeCompare(b[0]))
    .map(([id]) => id);
}
