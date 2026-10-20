// [L] Scores from official / third-party practice exams (results/external/*.md) next to the app readiness on the same
// date, and the calibration that follows: offset = mean(score − readiness) over the last 5 → adjusted readiness.
// [β2] Used sealed forms appear here too (internal: true): "điểm trên câu mới", linked to the result, not deletable.
import { useState } from 'react';
import { href } from '../../lib/router.ts';
import { toast } from '../ui.tsx';
import { scaledScore } from '../../../shared/scoring.ts';
import { fmtDay, postProgress, signed, todayKey } from './useProgress.ts';
import type { ExternalCalibration, ExternalScore } from '../../../shared/types.ts';

const SOURCES = [
  'AWS Official Practice Exam (Skill Builder)',
  'AWS Official Practice Question Set',
  'Tutorials Dojo',
  'Udemy – Stephane Maarek',
  'Whizlabs',
  'Đề thi thật',
];

function AddScoreForm({ onDone }: { onDone: () => void }) {
  const [date, setDate] = useState(todayKey());
  const [source, setSource] = useState('');
  const [score, setScore] = useState('');
  const [scaled, setScaled] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await postProgress('/api/external', { date, source, score: score.trim() || undefined, scaled: scaled.trim() || undefined, note: note.trim() || undefined });
      toast('📝 Đã lưu điểm thi thử — dùng để hiệu chỉnh mức sẵn sàng.');
      onDone();
    } catch (e) {
      toast(`Không lưu được: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="lrn-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label>
        <span className="tiny muted">Ngày làm</span>
        <input type="date" value={date} max={todayKey()} required onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="lrn-form-wide">
        <span className="tiny muted">Đề / nguồn</span>
        <input type="text" list="lrn-sources" value={source} maxLength={120} required placeholder="vd AWS Official Practice Exam" onChange={(e) => setSource(e.target.value)} />
        <datalist id="lrn-sources">
          {SOURCES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <label>
        <span className="tiny muted">Điểm %</span>
        <input type="number" inputMode="decimal" min={0} max={100} step={0.1} value={score} placeholder="78" onChange={(e) => setScore(e.target.value)} />
      </label>
      <label>
        <span className="tiny muted">hoặc /1000</span>
        <input type="number" inputMode="numeric" min={100} max={1000} step={1} value={scaled} placeholder="780" onChange={(e) => setScaled(e.target.value)} />
      </label>
      <label className="lrn-form-wide">
        <span className="tiny muted">Ghi chú (tùy chọn)</span>
        <input type="text" value={note} maxLength={500} placeholder="vd làm đủ 130 phút, không xem tài liệu" onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="row lrn-form-actions">
        <button className="btn primary sm" type="submit" disabled={busy || !source.trim() || (!score.trim() && !scaled.trim())}>
          Lưu điểm
        </button>
        <button className="btn ghost sm" type="button" onClick={onDone}>
          Hủy
        </button>
      </div>
    </form>
  );
}

export function ExternalScores({ scores, calibration, readiness }: { scores: ExternalScore[]; calibration?: ExternalCalibration; readiness?: number }) {
  const [adding, setAdding] = useState(false);
  const remove = async (s: ExternalScore) => {
    if (!window.confirm(`Xoá điểm “${s.source}” ngày ${fmtDay(s.date)}?`)) return;
    try {
      await postProgress(`/api/external/${encodeURIComponent(s.id)}/delete`);
      toast('Đã xoá.');
    } catch (e) {
      toast(`Không xoá được: ${(e as Error).message}`);
    }
  };
  return (
    <div className="card stack">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>📝 Điểm thi thử bên ngoài{scores.some((s) => s.internal) ? ' & đề niêm phong' : ''}</h2>
          <div className="small muted" style={{ marginTop: 2 }}>
            Đề chính thức / bên thứ ba và đề niêm phong (câu chưa gặp) — so với mức sẵn sàng của app cùng ngày
          </div>
        </div>
        {!adding && (
          <button className="btn sm" onClick={() => setAdding(true)}>
            ＋ Thêm điểm
          </button>
        )}
      </div>
      {adding && <AddScoreForm onDone={() => setAdding(false)} />}
      {!scores.length ? (
        !adding && (
          <div className="small muted">
            Chưa có. Sau mỗi lần làm đề thi thử chính thức (AWS Skill Builder) hoặc của Tutorials Dojo, ghi điểm vào đây: app so với mức sẵn sàng của chính nó vào ngày
            đó để biết mình đang ước tính lạc quan hay bi quan.
          </div>
        )
      ) : (
        <div className="lrn-ext-list" role="list">
          {scores.map((s) => {
            const diff = typeof s.readinessAtDate === 'number' ? s.score - s.readinessAtDate : undefined;
            return (
              <div key={s.id} className={`lrn-ext-item ${s.internal ? 'internal' : ''}`} role="listitem">
                <div className="lrn-ext-main">
                  <div className="small row" style={{ gap: 6 }}>
                    <b>{s.source}</b>
                    {s.internal && (
                      <span className="badge accent" title="Đề niêm phong của app: câu chưa từng gặp khi luyện — điểm hiệu chỉnh nội bộ">
                        🔒 câu mới
                      </span>
                    )}
                  </div>
                  <div className="tiny muted">
                    {fmtDay(s.date)}
                    {s.note ? ` · ${s.note}` : ''}
                    {s.internal && s.attempt && (
                      <>
                        {' · '}
                        <a href={href(`/result/${encodeURIComponent(s.attempt)}`)}>xem kết quả →</a>
                      </>
                    )}
                  </div>
                </div>
                <div className="lrn-ext-nums">
                  <div className="small nowrap">
                    <b className="num">{s.score}%</b>
                    {s.scaled !== undefined && <span className="tiny muted"> · {s.scaled}/1000</span>}
                  </div>
                  <div className="tiny muted nowrap" title="Mức sẵn sàng của app tính trên các bài làm tới hết ngày đó">
                    {diff === undefined ? 'app: chưa đủ dữ liệu' : `app ${s.readinessAtDate}% · chênh ${signed(diff)}`}
                  </div>
                </div>
                {s.internal ? (
                  <span className="lrn-ext-spacer" aria-hidden />
                ) : (
                  <button className="btn ghost sm" title="Xoá điểm này" aria-label={`Xoá điểm ${s.source} ngày ${fmtDay(s.date)}`} onClick={() => void remove(s)}>
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {calibration ? (
        <div className="lrn-calib small">
          <div>
            Điểm thật {calibration.offset >= 0 ? 'cao hơn' : 'thấp hơn'} mức sẵn sàng của app trung bình <b className="num">{signed(calibration.offset)} điểm %</b> ({calibration.samples}{' '}
            lần gần nhất).
          </div>
          <div className="tiny muted">Mức sẵn sàng hiệu chỉnh</div>
          <div>
            <span className="ins-stat">{scaledScore(calibration.adjustedReadiness)}</span>{' '}
            <span className="muted">
              / 1000 · {calibration.adjustedReadiness}%{typeof readiness === 'number' ? ` (app: ${readiness}%)` : ''}
            </span>
          </div>
          {calibration.samples < 3 && <div className="tiny muted">Mới {calibration.samples} lần — ước tính còn thô, ghi thêm điểm để chính xác hơn.</div>}
        </div>
      ) : (
        scores.length > 0 && <div className="tiny muted">Cần ít nhất 1 điểm vào ngày app đã có ≥ 20 câu trả lời để hiệu chỉnh.</div>
      )}
    </div>
  );
}
