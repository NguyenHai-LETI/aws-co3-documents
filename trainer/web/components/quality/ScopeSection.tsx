// [γ] Bank → 📐 Chất lượng → 🎯 Phạm vi đề thi: questions naming services the official SAA-C03 guide lists as out of scope
// (taxonomy `scope: out`). A correct option out of scope = the exam never asks it → retire (POST /api/quality/retire for the
// versions shown); only distractors out of scope = easy give-aways → ENRICH "distractors" with explicit ids.
import { useState } from 'react';
import { api } from '../../lib/api.ts';
import { useData } from '../../lib/store.tsx';
import { toast } from '../ui.tsx';
import { OptionLine, QRef, startEnrich, useAiReady } from './common.tsx';
import type { ScopeReport } from '../../../shared/types.ts';

const GUIDE = 'https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/saa-03-out-of-scope-services.html';
const ENRICH_MAX = 20;
const RETIRE_MAX = 60;

function ServiceBadges({ services }: { services: string[] }) {
  return (
    <>
      {services.map((s) => (
        <span key={s} className="badge warn" title="Dịch vụ ngoài phạm vi đề thi SAA-C03">
          ⛔ {s}
        </span>
      ))}
    </>
  );
}

export function ScopeSection({ report, onOpen, onChanged }: { report?: ScopeReport; onOpen: (id: string) => void; onChanged: () => void }) {
  const { byId, refresh } = useData();
  const ai = useAiReady();
  const [pickA, setPickA] = useState<string[]>([]);
  const [pickD, setPickD] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [allServices, setAllServices] = useState(false);
  if (!report) return <div className="ins-wrap alert small">Server chưa có báo cáo phạm vi đề thi (cần bản server mới).</div>;

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const allA = report.answer.map((x) => x.id);
  const allD = report.distractor.map((x) => x.id);
  const used = report.services.filter((s) => s.answers || s.distractors);
  const shownServices = allServices ? report.services : used;

  const retire = async () => {
    const ids = pickA.slice(0, RETIRE_MAX);
    if (!ids.length) return;
    if (!window.confirm(`Loại (status: retired) ${ids.length} câu có đáp án ngoài phạm vi đề thi?\nCâu không bị xoá — chỉ ngừng xuất hiện khi luyện; muốn dùng lại thì sửa status trong file pack.`)) return;
    setBusy(true);
    try {
      const r = await api.post<{ retired: string[]; failed: { id: string; errors: string[] }[] }>('/api/quality/retire', { items: ids.map((id) => ({ id, hash: byId.get(id)?.hash })) });
      toast(`🗑️ Đã loại ${r.retired.length} câu${r.failed.length ? ` · ${r.failed.length} câu chưa loại được: ${r.failed[0].errors[0] ?? ''}` : ''}`);
      setPickA([]);
      await refresh();
      onChanged();
    } catch (e) {
      toast(`Không loại được: ${(e as Error).message}`);
    }
    setBusy(false);
  };

  const enrich = async () => {
    const ids = pickD.slice(0, ENRICH_MAX);
    if (!ids.length) return;
    setBusy(true);
    const names = [...new Set(report.distractor.filter((x) => ids.includes(x.id)).flatMap((x) => x.options.flatMap((o) => o.services)))];
    const note = `Thay các phương án nhiễu nêu dịch vụ ngoài phạm vi đề thi SAA-C03 (${names.slice(0, 8).join(', ')}) bằng dịch vụ trong phạm vi hay bị nhầm với đáp án đúng (lint oos-distractor).`;
    if (await startEnrich(ids, 'distractors', note)) {
      ai.reload();
      setPickD([]);
    }
    setBusy(false);
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head qq-head">
          <h2>🎯 Phạm vi đề thi</h2>
          <a className="small" href={GUIDE} target="_blank" rel="noreferrer">
            Danh sách ngoài phạm vi chính thức ↗
          </a>
        </div>
        <div className="small dim stack sm">
          <span>
            Đề thật SAA-C03 không hỏi các dịch vụ nằm trong danh sách <b>ngoài phạm vi</b> chính thức (taxonomy <code>scope: out</code>). Câu có đáp án là dịch vụ
            đó luyện sai trọng tâm; dùng chúng làm phương án nhiễu thì quá dễ loại.
          </span>
          <span>
            {report.answer.length ? (
              report.excluded ? (
                <>
                  {report.answer.length} câu có đáp án ngoài phạm vi đang <b>bị loại khỏi các chế độ luyện</b> (<code>practice.exclude_out_of_scope</code>) — vẫn làm được qua
                  “Theo bộ đề” hoặc danh sách id.
                </>
              ) : (
                <>
                  {report.answer.length} câu có đáp án ngoài phạm vi <b>vẫn xuất hiện</b> khi luyện (<code>practice.exclude_out_of_scope: false</code>).
                </>
              )
            ) : (
              '✓ Không câu nào có đáp án là dịch vụ ngoài phạm vi.'
            )}
          </span>
        </div>
        {shownServices.length > 0 && (
          <div className="row sc-services" role="list" aria-label="Dịch vụ ngoài phạm vi">
            {shownServices.map((s) => (
              <span key={s.name} role="listitem" className="sc-service small" title={s.aliases?.length ? `Tên chính thức: ${s.aliases.join(', ')}` : undefined}>
                <b>{s.name}</b>
                {s.answers || s.distractors ? (
                  <span className="muted">
                    {s.answers ? ` · ${s.answers} đáp án` : ''}
                    {s.distractors ? ` · ${s.distractors} nhiễu` : ''}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        )}
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setAllServices((v) => !v)}>
          {allServices ? 'Chỉ hiện dịch vụ đang có trong ngân hàng' : `Xem cả ${report.services.length} dịch vụ ngoài phạm vi`}
        </button>
      </div>

      <div className="grid c2">
        <div className="card stack sm">
          <div className="card-head qq-head" style={{ marginBottom: 0 }}>
            <h2>⛔ Đáp án ngoài phạm vi ({report.answer.length})</h2>
          </div>
          <div className="small dim">Đề thật không hỏi các câu này → loại (retire). Viết lại thành câu có đáp án trong phạm vi thì sửa tay trong file pack.</div>
          {!report.answer.length ? (
            <div className="small muted">✓ Không có.</div>
          ) : (
            <>
              <div className="row">
                <label className="row small" style={{ gap: 6 }}>
                  <input type="checkbox" checked={pickA.length === allA.length} onChange={(e) => setPickA(e.target.checked ? allA : [])} aria-label="Chọn tất cả câu có đáp án ngoài phạm vi" />
                  Chọn tất cả
                </label>
                <span className="spacer" />
                <button className="btn sm" disabled={busy || !pickA.length} onClick={retire}>
                  🗑️ Loại (retire){pickA.length ? ` ${Math.min(RETIRE_MAX, pickA.length)} câu` : ''}
                </button>
              </div>
              <div className="qq-list">
                {report.answer.map((x) => (
                  <div key={x.id} className="qq-item qq-check">
                    <input type="checkbox" checked={pickA.includes(x.id)} onChange={() => toggle(pickA, setPickA, x.id)} aria-label={`Chọn ${x.id}`} />
                    <QRef id={x.id} onOpen={onOpen} extra={<ServiceBadges services={x.services} />} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card stack sm">
          <div className="card-head qq-head" style={{ marginBottom: 0 }}>
            <h2>😴 Phương án nhiễu ngoài phạm vi ({report.distractor.length})</h2>
          </div>
          <div className="small dim">Người học loại ngay các phương án này → AI viết lại bằng dịch vụ trong phạm vi hay bị nhầm, giữ nguyên đáp án đúng.</div>
          {!report.distractor.length ? (
            <div className="small muted">✓ Không có.</div>
          ) : (
            <>
              <div className="row">
                <label className="row small" style={{ gap: 6 }}>
                  <input type="checkbox" checked={pickD.length === allD.length} onChange={(e) => setPickD(e.target.checked ? allD : [])} aria-label="Chọn tất cả câu có phương án nhiễu ngoài phạm vi" />
                  Chọn tất cả
                </label>
                <span className="spacer" />
                <button className="btn primary sm" disabled={busy || !pickD.length || !ai.ready} title={ai.why ?? `ENRICH “distractors” cho tối đa ${ENRICH_MAX} câu`} onClick={enrich}>
                  🧹 Thay phương án nhiễu{pickD.length ? ` (${Math.min(ENRICH_MAX, pickD.length)} câu)` : ''}
                </button>
              </div>
              <div className="qq-list">
                {report.distractor.map((x) => (
                  <div key={x.id} className="qq-item qq-check">
                    <input type="checkbox" checked={pickD.includes(x.id)} onChange={() => toggle(pickD, setPickD, x.id)} aria-label={`Chọn ${x.id}`} />
                    <div className="stack sm" style={{ minWidth: 0 }}>
                      <QRef id={x.id} onOpen={onOpen} />
                      {x.options.map((o) => (
                        <OptionLine key={o.key} q={byId.get(x.id)} k={o.key}>
                          <ServiceBadges services={o.services} />
                        </OptionLine>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
