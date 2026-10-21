// [β2] Sealed forms (A1): each form's status, the suggested date (≈ exam − 21 days for the first, ≈ exam − 7 for the
// last), "Làm đề niêm phong" (a Pearson simulation on questions never shown in practice → "điểm trên câu mới"),
// "Mở sớm" (POST /api/sealed/release) and "Tạo đề niêm phong" when no form is held back. Never shows question ids.
import { useState } from 'react';
import { api } from '../../lib/api.ts';
import { useData } from '../../lib/store.tsx';
import { href } from '../../lib/router.ts';
import { startTest } from '../../lib/start.ts';
import { fmtDate } from '../../lib/format.ts';
import { toast } from '../ui.tsx';
import { dueIn } from '../onboarding/rules.ts';
import { fmtDay, reloadProgress } from './useProgress.ts';
import type { ProgressResponse, SealedFormProgress, SealedStatus } from '../../../shared/types.ts';

/** Forms from /api/progress (with suggested dates and scores), else the bare list from /api/meta. */
export function useSealedForms(progress?: ProgressResponse): SealedFormProgress[] {
  const { meta } = useData();
  return progress?.sealed ?? meta?.sealed ?? [];
}

export const nextSealedForm = (forms: SealedFormProgress[]) => forms.find((f) => f.status === 'sealed');

export async function takeSealed(f: Pick<SealedFormProgress, 'id' | 'count'>): Promise<void> {
  const ok = window.confirm(
    `Bắt đầu đề niêm phong ${f.id}?\n\nNhư thi thật: ${f.count} câu tính điểm + câu thử nghiệm không tính điểm, không tạm dừng, đồng hồ theo tải đọc đề thật. ` +
      'Mỗi đề chỉ làm được một lần — hãy dành đủ thời gian liền mạch.',
  );
  if (ok) await startTest({ mode: 'sealed', form: f.id });
}

function StatusBadges({ f }: { f: SealedFormProgress }) {
  if (f.status === 'used') return <span className="badge good">✓ đã làm{f.usedAt ? ` ${fmtDate(f.usedAt)}` : ''}</span>;
  if (f.status === 'released') return <span className="badge">🔓 đã mở sớm</span>;
  return (
    <>
      <span className="badge accent">🔒 đang niêm phong</span>
      {f.due && <span className="badge warn">⏰ đến lúc làm</span>}
    </>
  );
}

export function SealedPanel({ progress }: { progress: ProgressResponse }) {
  const { refresh, meta } = useData();
  const broken = meta?.sealedError; // [γ] results/sealed.md unreadable: questions stay hidden, nothing can be created / opened
  const forms = useSealedForms(progress);
  const [busy, setBusy] = useState<string>();
  const next = nextSealedForm(forms);
  const examDate = progress.goal.examDate;

  const after = async () => {
    await Promise.all([refresh(), reloadProgress()]);
  };
  const release = async (f: SealedFormProgress) => {
    const ok = window.confirm(`Mở sớm đề ${f.id}?\n\n${f.count} câu sẽ trở lại luyện tập và đề này không còn dùng để đo điểm trên câu mới. Không hoàn tác được.`);
    if (!ok) return;
    setBusy(f.id);
    try {
      await api.post<SealedStatus>('/api/sealed/release', { form: f.id });
      toast(`🔓 Đã mở đề ${f.id} — ${f.count} câu trở lại luyện tập.`);
      await after();
    } catch (e) {
      toast(`Không mở được: ${(e as Error).message}`);
    } finally {
      setBusy(undefined);
    }
  };
  const create = async () => {
    const ok = window.confirm(
      'Tạo đề niêm phong mới?\n\nApp giữ lại các câu bạn chưa gặp (cân theo domain và mục exam guide): chúng bị ẩn khỏi mọi chế độ luyện, tìm kiếm, Anki và danh sách Ngân hàng cho tới khi bạn làm đề hoặc mở sớm.',
    );
    if (!ok) return;
    setBusy('create');
    try {
      const r = await api.post<SealedStatus>('/api/sealed/create', {});
      toast(`🔒 Đã niêm phong ${(r.created ?? []).join(', ') || 'đề mới'}${r.size ? ` (${r.size} câu/đề)` : ''}.${r.notes?.length ? ` ${r.notes.join(' ')}` : ''}`);
      await after();
    } catch (e) {
      toast(`Không tạo được: ${(e as Error).message}`);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="card stack" id="sealed-forms">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>🔒 Đề niêm phong</h2>
          <div className="small muted" style={{ marginTop: 2 }}>
            Câu chưa từng gặp, giữ riêng để đo “điểm trên câu mới”
          </div>
        </div>
        {!next && !broken && (
          <button className="btn sm" disabled={busy === 'create'} onClick={() => void create()}>
            🔒 Tạo đề niêm phong
          </button>
        )}
      </div>
      {broken && (
        <div className="alert bad small ins-wrap" role="alert">
          ⛔ {broken}
        </div>
      )}
      <div className="small dim">
        Câu trong đề niêm phong không xuất hiện khi luyện tập, tìm kiếm, Anki hay trong Ngân hàng. Làm như thi thật (mô phỏng Pearson, thêm câu thử nghiệm) để có{' '}
        <b>điểm trên câu mới</b> — thước đo trung thực nhất vì đề thật toàn câu bạn chưa gặp. Làm xong (hoặc mở sớm) thì câu trở lại luyện tập.
      </div>
      {!forms.length ? (
        broken ? null : <div className="small muted">Chưa có đề niêm phong nào. Bấm “Tạo đề niêm phong” để giữ lại các câu chưa gặp ngay từ bây giờ.</div>
      ) : (
        <div className="lrn-sealed-list" role="list">
          {forms.map((f) => (
            <div key={f.id} role="listitem" className={`lrn-sealed-item ${f.status}`}>
              <div className="lrn-sealed-main">
                <div className="row" style={{ gap: 6 }}>
                  <b>{f.id}</b>
                  <span className="small muted">· {f.count} câu</span>
                  <StatusBadges f={f} />
                </div>
                {f.status === 'sealed' && (
                  <div className="tiny muted">
                    {f.suggested
                      ? `Gợi ý làm ngày ${fmtDay(f.suggested)} (${dueIn(f.suggested)})`
                      : examDate
                        ? 'Làm khi đã ôn được phần lớn ngân hàng.'
                        : 'Đặt ngày thi để có ngày gợi ý (≈ 3 tuần và 1 tuần trước ngày thi).'}
                  </div>
                )}
                {f.status === 'used' && (
                  <div className="small">
                    {typeof f.score === 'number' ? (
                      <>
                        Điểm trên câu mới <b className="num">{f.score}%</b>
                        {typeof f.scaled === 'number' && <span className="muted"> · {f.scaled}/1000</span>}
                      </>
                    ) : (
                      <span className="muted">Đã làm</span>
                    )}
                    {f.attempt && (
                      <>
                        {' '}
                        · <a href={href(`/result/${encodeURIComponent(f.attempt)}`)}>xem kết quả →</a>
                      </>
                    )}
                  </div>
                )}
              </div>
              {f.status === 'sealed' && (
                <div className="row lrn-sealed-actions">
                  <button className={`btn sm ${f === next ? 'primary' : ''}`} disabled={!!busy} onClick={() => void takeSealed(f)}>
                    ▶ Làm đề niêm phong
                  </button>
                  <button className="btn ghost sm" disabled={!!busy} onClick={() => void release(f)} title="Đưa các câu của đề này trở lại luyện tập (không đo điểm)">
                    Mở sớm
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Dashboard line: when to take the next sealed form (with a start button once it is due). */
export function NextSealedLine({ forms }: { forms: SealedFormProgress[] }) {
  const f = nextSealedForm(forms);
  if (!f) return null;
  return (
    <div className="lrn-next small">
      <span aria-hidden>🔒</span>
      <span className="lrn-next-main">
        <a href={href('/stats?focus=sealed')}>Đề niêm phong {f.id}</a>{' '}
        <span className={`tiny ${f.due ? 'warn' : 'muted'}`}>{f.suggested ? `· gợi ý ${fmtDay(f.suggested)} (${dueIn(f.suggested)})` : `· ${f.count} câu chưa gặp`}</span>
      </span>
      {f.due && (
        <button className="btn primary sm" onClick={() => void takeSealed(f)}>
          Làm ngay
        </button>
      )}
    </div>
  );
}
