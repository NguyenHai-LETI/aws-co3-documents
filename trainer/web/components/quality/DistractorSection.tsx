// Bank → 📐 Chất lượng → 🎯 Phương án nhiễu: option analytics from the learner's own answers (distractorReport):
// distractors nobody picks and everybody strikes out (→ ENRICH "distractors" with explicit ids) and the same wrong
// option picked confidently again and again (→ blind-solve by a second model, or report the key).
import { useMemo, useState } from 'react';
import { useData } from '../../lib/store.tsx';
import { OptionLine, OptionLines, QRef, startEnrich, startVerify, useAiReady } from './common.tsx';
import { VerdictBadge, useVerifyLatest } from './VerifySection.tsx';
import type { DistractorReport } from '../../../shared/types.ts';

export function DistractorSection({ report, onOpen, onIssue }: { report?: DistractorReport; onOpen: (id: string) => void; onIssue: (id: string) => void }) {
  const { byId } = useData();
  const ai = useAiReady();
  const latest = useVerifyLatest();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // weak options grouped by question, report order (most struck out first)
  const weak = useMemo(() => {
    const m = new Map<string, NonNullable<DistractorReport>['weakDistractors']>();
    for (const w of report?.weakDistractors ?? []) m.set(w.id, [...(m.get(w.id) ?? []), w]);
    return [...m];
  }, [report]);

  if (!report) return <div className="ins-wrap alert small">Server chưa có phân tích phương án nhiễu (cần bản server mới).</div>;
  const suspected = report.suspectedKeys;
  const allWeak = weak.map(([id]) => id);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    if (await fn()) ai.reload();
    setBusy(false);
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head qq-head">
          <h2>🎯 Phương án nhiễu — từ bài làm của bạn</h2>
          <span className="small muted">
            {report.analysed ?? 0} câu đã gặp ≥ {report.minExposures} lần · {report.answers ?? 0} lượt trả lời
          </span>
        </div>
        <div className="small dim">
          Chỉ tính bài không làm vội và câu trả lời cho <b>phiên bản hiện tại</b> của câu hỏi — sửa phương án thì số liệu của câu đó tính lại từ đầu. Mẹo: khi làm bài, gạch
          (✕) các phương án bạn loại ngay — app nhờ đó biết phương án nào quá dễ.
        </div>
      </div>

      <div className="grid c2">
        <div className="card stack sm">
          <div className="card-head qq-head" style={{ marginBottom: 0 }}>
            <h2>😴 Phương án nhiễu quá dễ ({report.weakDistractors.length})</h2>
          </div>
          <div className="small dim">Chưa lần nào được chọn và bị gạch ít nhất một nửa số lần gặp → AI viết lại cho hấp dẫn hơn, giữ nguyên đáp án đúng.</div>
          {!weak.length ? (
            <div className="small muted">✓ Chưa thấy phương án nhiễu nào quá dễ (cần câu đã gặp ≥ {report.minExposures} lần).</div>
          ) : (
            <>
              <div className="row">
                <label className="row small" style={{ gap: 6 }}>
                  <input type="checkbox" checked={picked.length === allWeak.length} onChange={(e) => setPicked(e.target.checked ? allWeak : [])} aria-label="Chọn tất cả" />
                  Chọn tất cả
                </label>
                <span className="spacer" />
                <button className="btn primary sm" disabled={busy || !picked.length || !ai.ready} title={ai.why} onClick={() => run(() => startEnrich(picked, 'distractors'))}>
                  🧹 Viết lại phương án nhiễu{picked.length ? ` (${picked.length} câu)` : ''}
                </button>
              </div>
              <div className="qq-list">
                {weak.map(([id, opts]) => (
                  <div key={id} className="qq-item qq-check">
                    <input type="checkbox" checked={picked.includes(id)} onChange={() => toggle(id)} aria-label={`Chọn ${id}`} />
                    <div className="stack sm" style={{ minWidth: 0 }}>
                      <QRef id={id} onOpen={onOpen} />
                      {opts.map((w) => (
                        <OptionLine key={w.key} q={byId.get(id)} k={w.key}>
                          <span className="badge" title={`${w.exposures} lần gặp, chưa lần nào chọn`}>
                            ✕ {w.elims}/{w.exposures}
                          </span>
                        </OptionLine>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card stack sm">
          <div className="card-head qq-head" style={{ marginBottom: 0 }}>
            <h2>🤨 Nghi sai đáp án ({suspected.length})</h2>
            {suspected.length > 1 && (
              <button className="btn sm" disabled={busy || !ai.ready} title={ai.why} onClick={() => run(() => startVerify({ ids: suspected.map((s) => s.id) }, `${suspected.length} câu`))}>
                🔎 Giải mù cả {suspected.length}
              </button>
            )}
          </div>
          <div className="small dim">Cùng một phương án sai được chọn chắc chắn (không “chưa chắc”, không gợi ý, không cắm cờ) ≥ 2 lần và ít nhất ⅓ số lần trả lời — đáp án trong ngân hàng có thể sai, hoặc đề mơ hồ.</div>
          {!suspected.length ? (
            <div className="small muted">✓ Không có câu nào bị nghi sai đáp án.</div>
          ) : (
            <div className="qq-list">
              {suspected.map((s) => {
                const q = byId.get(s.id);
                const v = latest?.[s.id];
                return (
                  <div key={`${s.id}-${s.pick}`} className="qq-item stack sm">
                    <QRef id={s.id} onOpen={onOpen} extra={v && <VerdictBadge v={v} current={q?.hash} />} />
                    <OptionLines q={q} keys={s.key}>
                      {() => <span className="badge good">✓ đáp án</span>}
                    </OptionLines>
                    <OptionLines q={q} keys={[...s.pick].filter((k) => !s.key.includes(k)).join('')}>
                      {() => (
                        <span className="badge bad" title={`Bạn chọn ${s.pick} (đáp án ${s.key})`}>
                          bạn chọn{s.pick.length > 1 ? ` ${s.pick}` : ''} {s.times}× ({s.confident} chắc)
                        </span>
                      )}
                    </OptionLines>
                    <div className="tiny muted ins-wrap">{s.note}</div>
                    <div className="row">
                      <button className="btn sm" disabled={busy || !ai.ready} title={ai.why ?? 'Model thứ hai giải câu này mà không xem đáp án'} onClick={() => run(() => startVerify({ ids: [s.id] }, s.id))}>
                        🔎 Giải mù
                      </button>
                      <button className="btn sm" onClick={() => onIssue(s.id)}>
                        🚩 Báo lỗi đáp án
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
