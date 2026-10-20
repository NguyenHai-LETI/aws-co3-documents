// [μ v5] "Vì sao bạn chọn …?" on a wrong answer of a finished test (result page card and the correction stepper):
// one-tap WHY_CHIPS (ρ's WhyChips: chip labels joined with "; ", then the learner's words) + free text →
// POST /api/results/:id/why (rewrites the result file; the AI coach reads it). Moved here from Result.tsx.
import { useState } from 'react';
import { api } from '../../lib/api.ts';
import { toast } from '../ui.tsx';
import { WhyChips } from '../WhyChips.tsx';
import type { AnswerRecord } from '../../../shared/types.ts';

export function WhyNote({ attemptId, r, value, onSaved, open }: { attemptId: string; r: AnswerRecord; value?: string; onSaved: (why: string) => void; open?: boolean }) {
  const [editing, setEditing] = useState(!value);
  const [text, setText] = useState(value ?? '');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(!!open);
  const save = async (next = text) => {
    const why = next.trim().slice(0, 500);
    if (why === (value ?? '')) return setEditing(!why);
    setBusy(true);
    try {
      await api.post(`/api/results/${encodeURIComponent(attemptId)}/why`, { q: r.q, why });
      onSaved(why);
      setEditing(!why);
      toast(why ? '📝 Đã lưu lý do — AI Coach sẽ đọc khi phân tích.' : 'Đã xoá ghi chú.');
    } catch (e) {
      toast(`Không lưu được ghi chú: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  if (value && !editing) {
    return (
      <div className="ins-why saved small">
        <span>
          📝 <b>Lý do bạn chọn {r.pick}:</b> {value}
        </span>
        <button
          className="btn ghost sm"
          onClick={() => {
            setText(value);
            setEditing(true);
            setActive(true);
          }}
        >
          Sửa
        </button>
      </div>
    );
  }
  return (
    <div className="ins-why small">
      <label htmlFor={`why-${attemptId}-${r.q}`}>
        ✍️ Vì sao bạn chọn <b>{r.pick || '(bỏ trống)'}</b>? <span className="muted">(chạm một lý do hoặc tự viết — giúp AI Coach hiểu vì sao sai)</span>
      </label>
      {(active || !!text) && <WhyChips value={text} onChange={setText} />}
      <div className="row nowrap" style={{ gap: 8 }}>
        <input
          id={`why-${attemptId}-${r.q}`}
          type="text"
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setActive(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
          }}
          placeholder="vd: tưởng Multi-AZ giúp tăng hiệu năng đọc"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button className="btn sm primary" disabled={busy || text.trim() === (value ?? '')} onClick={() => void save()} title={value && !text.trim() ? 'Xoá ghi chú' : undefined}>
          {value && !text.trim() ? 'Xoá' : 'Lưu'}
        </button>
        {value && (
          <button className="btn sm ghost" onClick={() => setEditing(false)}>
            Hủy
          </button>
        )}
      </div>
    </div>
  );
}
