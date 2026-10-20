// [μ v5] Stats → "🔂 Câu dai dẳng" (Design C7, leech clinic): questions answered wrong again and again (λ: lapses ≥
// srs.leech_lapses, or wrong ≥ 3 times on ≥ 2 days). Per question: the history of picks vs the key, struck-out correct
// options, the learner's "vì sao chọn" notes, the likely confused pair (→ #/pair), the notes to re-read, 🤖 Hỏi AI,
// "✨ câu tương phản" (γ2 task twins, on demand), a memory aid and "Tạm gác 3 ngày" (results/leeches.md through
// POST /api/leeches/:id; paused leeches are left out of reviews and "Học hôm nay").
import { useState } from 'react';
import { api } from '../../lib/api.ts';
import { useData, useFetch } from '../../lib/store.tsx';
import { href } from '../../lib/router.ts';
import { startTest } from '../../lib/start.ts';
import { AskDialog } from '../AskDialog.tsx';
import { toast } from '../ui.tsx';
import { dayMonth, pairHref } from './rules.ts';
import type { LeechItem, Question } from '../../../shared/types.ts';

const SHOWN = 8;

function LeechCard({ l, q, onChanged, onAsk }: { l: LeechItem; q?: Question; onChanged: () => void; onAsk: (q: Question, pick?: string) => void }) {
  const { state, topic, meta } = useData();
  const [note, setNote] = useState(l.note ?? '');
  const [busy, setBusy] = useState(false);
  const elimCorrect = state?.states[l.id]?.elimCorrect ?? 0;
  const t = topic(q?.topic ?? l.topic);
  const picks = Object.entries(l.picks).sort((a, b) => b[1] - a[1]);
  const notes = [...(t?.notes ?? []), ...(q?.refs ?? []).filter((r) => !(t?.notes ?? []).includes(r))].slice(0, 3);
  const paused = !!l.pausedUntil;
  const claudeOk = meta?.claude?.available !== false;
  const post = async (body: { note?: string; pauseDays?: number }, done: string) => {
    setBusy(true);
    try {
      await api.post(`/api/leeches/${encodeURIComponent(l.id)}`, body);
      toast(done);
      onChanged();
    } catch (e) {
      toast(`Không lưu được: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const contrast = async () => {
    setBusy(true);
    try {
      await api.post('/api/coach/run', { task: 'twins', params: { ids: [l.id], kind: 'contrast' } });
      toast('✨ Đã nhờ AI viết câu tương phản — theo dõi ở trang AI Coach; câu mới qua kiểm tra rồi mới vào ngân hàng.');
    } catch (e) {
      toast(`Không chạy được: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`lrn-leech ${paused ? 'paused' : ''}`}>
      <div className="row between lrn-leech-head">
        <span className="row" style={{ gap: 6 }}>
          <a className="mono small" href={href(`/bank?q=${encodeURIComponent(l.id)}`)}>
            {l.id}
          </a>
          {t && <span className="badge">{t.icon} {t.label}</span>}
          <span className="small dim">
            sai {l.wrong} lần · {l.wrongDays} ngày{l.lapses ? ` · quên ${l.lapses} lần` : ''}
          </span>
          {paused && <span className="badge warn">⏸ tạm gác tới {dayMonth(l.pausedUntil!)}</span>}
        </span>
      </div>
      <div className="small lrn-leech-stem">{l.stem}</div>
      <div className="small dim lrn-leech-facts">
        {picks.length > 0 && (
          <span>
            Đã chọn sai: {picks.map(([k, n]) => `${k} ×${n}`).join(' · ')}
            {q ? <> — đáp án đúng <b>{q.answer.join(', ')}</b></> : null}
          </span>
        )}
        {elimCorrect > 0 && <span className="bad">✂️ gạch nhầm đáp án đúng {elimCorrect} lần</span>}
        {l.pair && l.pair.length === 2 && (
          <a href={href(pairHref(l.pair[1], l.pair[0]))} title="Có thể bạn đang nhầm hai dịch vụ này — xem bảng so sánh">
            🔀 {l.pair[0]} ⟷ {l.pair[1]}
          </a>
        )}
        {notes.map((n) => (
          <a key={n} href={href(`/notes?f=${encodeURIComponent(n.split('#')[0])}${n.includes('#') ? `&a=${encodeURIComponent(n.split('#')[1])}` : ''}`)}>
            📖 {n.split('/').pop()}
          </a>
        ))}
      </div>
      {l.why.length > 0 && (
        <ul className="small lrn-leech-why">
          {l.why.slice(0, 3).map((w, i) => (
            <li key={i}>“{w}”</li>
          ))}
        </ul>
      )}
      <div className="row lrn-leech-actions">
        <input type="text" maxLength={300} value={note} placeholder="Mẹo nhớ của bạn (vd: SQS = kéo, SNS = đẩy)" onChange={(e) => setNote(e.target.value)} aria-label={`Mẹo nhớ cho ${l.id}`} />
        <button className="btn sm" disabled={busy || note.trim() === (l.note ?? '')} onClick={() => void post({ note: note.trim() }, '📝 Đã lưu mẹo nhớ.')}>
          Lưu
        </button>
        {q && (
          <button className="btn sm ghost" onClick={() => onAsk(q, picks[0]?.[0])}>
            🤖 Hỏi AI
          </button>
        )}
        <button className="btn sm ghost" disabled={busy || !claudeOk} onClick={() => void contrast()} title={claudeOk ? 'AI viết 1–2 câu cùng khái niệm nhưng đổi yêu cầu để phương án bạn hay chọn trở thành đúng' : 'Chưa có Claude Code CLI'}>
          ✨ Câu tương phản
        </button>
        {paused ? (
          <button className="btn sm ghost" disabled={busy} onClick={() => void post({ pauseDays: 0 }, '▶ Câu này quay lại lịch ôn.')}>
            ▶ Bỏ tạm gác
          </button>
        ) : (
          <button className="btn sm ghost" disabled={busy} onClick={() => void post({ pauseDays: 3 }, '⏸ Tạm gác 3 ngày — câu này không vào lịch ôn / Học hôm nay tới lúc đó.')}>
            ⏸ Tạm gác 3 ngày
          </button>
        )}
      </div>
    </div>
  );
}

export function LeechSection() {
  const { byId } = useData();
  const { data, reload } = useFetch<LeechItem[]>('/api/leeches');
  const [all, setAll] = useState(false);
  const [ask, setAsk] = useState<{ q: Question; pick?: string }>();
  const list = data;
  if (!Array.isArray(list)) return <section id="leeches" />;
  const active = list.filter((l) => !l.pausedUntil);
  const shown = all ? list : list.slice(0, SHOWN);
  return (
    <section id="leeches" className="lrn-section">
      <div className="card stack">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <div>
            <h2>🔂 Câu dai dẳng</h2>
            <div className="small muted" style={{ marginTop: 2 }}>
              Câu sai đi sai lại — đổi cách học thay vì ôn lại y nguyên: so sánh cặp hay nhầm, ghi mẹo nhớ, câu tương phản. Ra khỏi danh sách khi đúng 2 lần liên tiếp ở 2 ngày khác nhau.
            </div>
          </div>
          {active.length > 0 && (
            <button className="btn sm primary" onClick={() => void startTest({ mode: 'ids', ids: active.map((l) => l.id).filter((id) => byId.has(id)), title: `Câu dai dẳng (${active.length})`, feedback: 'practice', shuffleOptions: true })}>
              Luyện {active.length} câu
            </button>
          )}
        </div>
        {!list.length ? (
          <div className="small muted">✓ Chưa có câu nào sai đi sai lại.</div>
        ) : (
          <div className="lrn-leech-list">
            {shown.map((l) => (
              <LeechCard
                key={l.id}
                l={l}
                q={byId.get(l.id)}
                onAsk={(q, pick) => setAsk({ q, pick })}
                onChanged={reload}
              />
            ))}
          </div>
        )}
        {list.length > SHOWN && (
          <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setAll((v) => !v)}>
            {all ? 'Thu gọn' : `Xem thêm ${list.length - SHOWN} câu`}
          </button>
        )}
      </div>
      <AskDialog q={ask?.q} pick={ask?.pick} onClose={() => setAsk(undefined)} />
    </section>
  );
}
