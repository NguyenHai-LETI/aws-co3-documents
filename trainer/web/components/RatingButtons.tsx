// 👍 / 👎 for AI-quality feedback → appended to bank/ratings.md (the coach fixes or retires low-rated questions).
import { useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import { updateShared, useShared } from '../lib/store.tsx';
import { Modal, toast } from './ui.tsx';
import { useEscLayer } from './insights.tsx';
import type { RatingItem } from '../../shared/types.ts';

const RATINGS_URL = '/api/ratings';

export interface RatingAgg {
  up: number;
  down: number;
  last?: RatingItem; // latest unresolved vote
  notes: (RatingItem & { resolution?: string })[];
}

type Entry = RatingItem & { resolution?: string };
const aggCache = new WeakMap<RatingItem[], Map<string, RatingAgg>>();

/** Chronological order: date, then line in bank/ratings.md (append-only). */
const older = (a: RatingItem, b: RatingItem) => a.date.localeCompare(b.date) || (a.line ?? 0) - (b.line ?? 0);
const voteKey = (r: Entry) => `${r.date}|${r.qid}|${r.value}|${r.note ?? ''}`;

/** Same rule as the server: one vote per question per day (latest wins); resolved ratings don't count. */
function aggregate(items: RatingItem[]): Map<string, RatingAgg> {
  const hit = aggCache.get(items);
  if (hit) return hit;
  const sorted = ([...items] as Entry[]).sort(older);
  const resolved = new Set(sorted.filter((r) => r.resolution).map(voteKey));
  const daily = new Map<string, Entry>();
  const m = new Map<string, RatingAgg>();
  const agg = (qid: string) => {
    let a = m.get(qid);
    if (!a) m.set(qid, (a = { up: 0, down: 0, notes: [] }));
    return a;
  };
  for (const r of sorted) {
    const a = agg(r.qid);
    if (r.note || r.resolution) a.notes.push(r);
    if (r.resolution || resolved.has(voteKey(r))) continue;
    daily.set(`${r.qid}|${r.date}`, r);
    a.last = r;
  }
  for (const r of daily.values()) agg(r.qid)[r.value]++;
  aggCache.set(items, m);
  return m;
}

/** All ratings (one shared request for the whole page). */
export function useRatings(): { byQid: Map<string, RatingAgg>; available: boolean } {
  const { data, status } = useShared<RatingItem[]>(RATINGS_URL);
  const byQid = useMemo(() => aggregate(Array.isArray(data) ? data : []), [data]);
  return { byQid, available: status !== 404 };
}

const DOWN_REASONS = ['Đáp án gây tranh cãi', 'Giải thích chưa thuyết phục', 'Quá dễ / lộ đáp án', 'Trùng với câu khác', 'Kiến thức cũ / sai', 'Đề khó hiểu'];

export function RatingButtons({ qid }: { qid: string }) {
  const { byQid } = useRatings();
  const agg = byQid.get(qid);
  const [busy, setBusy] = useState(false);
  const [downOpen, setDownOpen] = useState(false);
  const [note, setNote] = useState('');
  useEscLayer(downOpen, () => setDownOpen(false));

  const send = async (value: 'up' | 'down', text?: string) => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // local, like the server
    if (value === 'up' && agg?.last?.value === 'up' && agg.last.date === today) {
      toast('Bạn đã 👍 câu này hôm nay rồi.');
      return;
    }
    setBusy(true);
    try {
      const item = await api.post<RatingItem>(RATINGS_URL, { qid, value, note: text?.trim() || undefined });
      const saved: RatingItem = item && typeof item === 'object' && 'qid' in item ? item : { line: Number.MAX_SAFE_INTEGER, date: today, qid, value, note: text };
      updateShared<RatingItem[]>(RATINGS_URL, (prev) => [...(Array.isArray(prev) ? prev : []), saved]);
      toast(value === 'up' ? '👍 Đã ghi nhận — cảm ơn!' : '👎 Đã ghi vào bank/ratings.md — AI Coach sẽ xem lại câu này.');
      setDownOpen(false);
      setNote('');
    } catch (e) {
      toast(`Không lưu được đánh giá: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const last = agg?.last?.value;
  return (
    <>
      <span className="ins-rate" role="group" aria-label="Đánh giá chất lượng câu hỏi">
        <button
          type="button"
          className={`btn ghost sm ${last === 'up' ? 'on' : ''}`}
          disabled={busy}
          aria-pressed={last === 'up'}
          title="Câu hỏi tốt (ghi vào bank/ratings.md)"
          onClick={() => send('up')}
        >
          👍{agg?.up ? <span className="num">{agg.up}</span> : null}
        </button>
        <button
          type="button"
          className={`btn ghost sm ${last === 'down' ? 'on' : ''}`}
          disabled={busy}
          aria-pressed={last === 'down'}
          title="Câu hỏi chưa tốt — AI Coach sẽ sửa hoặc loại"
          onClick={() => setDownOpen(true)}
        >
          👎{agg?.down ? <span className="num">{agg.down}</span> : null}
        </button>
      </span>

      <Modal open={downOpen} onClose={() => setDownOpen(false)} title={<>👎 Câu <code>{qid}</code> chưa tốt?</>}>
        <div className="stack">
          <div className="small dim">
            Ghi chú giúp AI Coach biết nên sửa gì (tùy chọn). Mỗi ngày tính 1 phiếu; câu bị 👎 từ 2 ngày trở lên (nhiều hơn 👍) sẽ được AI Coach sửa hoặc loại khỏi ngân hàng.
          </div>
          <div className="row" style={{ gap: 6 }}>
            {DOWN_REASONS.map((r) => (
              <button key={r} type="button" className={`chip ${note === r ? 'on' : ''}`} onClick={() => setNote(r)}>
                {r}
              </button>
            ))}
          </div>
          <textarea rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: đáp án B và C đều đúng nếu dùng Aurora Global Database…" />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={() => setDownOpen(false)}>
              Hủy
            </button>
            <button className="btn primary" disabled={busy} onClick={() => send('down', note)}>
              Gửi 👎
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
