// [v5 γ1] Question drawer block: sibling cluster ("nhóm anh em" + why), qualifier family, exam-guide bullets (skills) and
// "↩️ Hoàn tác" of the last AI change (γ2: GET /api/coach/undo-info?qid= · POST /api/coach/runs/:id/undo {qid}).
// Sealed questions are never named (the server filters them, the UI too). Renders nothing when there is nothing to say.
import { useState } from 'react';
import { api, ApiError } from '../../lib/api.ts';
import { useData, useFetch, useShared } from '../../lib/store.tsx';
import { href } from '../../lib/router.ts';
import { fmtDateTime } from '../../lib/format.ts';
import { Spinner, toast } from '../ui.tsx';
import type { GuideCoverage, Question, UndoResult } from '../../../shared/types.ts';

interface Link {
  id: string;
  kinds: string[];
  score: number;
}

const KIND_VI: Record<string, string> = {
  variant: 'biến thể (variant_of)',
  duplicate: 'gần trùng chữ',
  semantic: 'trùng nghĩa',
  'same-key': 'cùng chủ đề + cùng đáp án',
  similar: 'đề giống nhau',
};

const TASK_VI: Record<string, string> = { enrich: 'ENRICH', longform: 'câu dài', generate: 'sinh câu', verify: 'giải mù', twins: 'câu song sinh', family: 'họ câu', analyze: 'phân tích' };

function QLink({ id }: { id: string }) {
  return (
    <a href={href(`/bank?q=${encodeURIComponent(id)}`)} className="qr-link">
      <code>{id}</code>
    </a>
  );
}

/** "↩️ Hoàn tác lượt AI" — hidden when γ2's undo-info route is missing (404) or there is no AI change to undo. */
function UndoButton({ q }: { q: Question }) {
  const info = useFetch<{ run: string; at: string; task: string; created?: boolean } | null>(`/api/coach/undo-info?qid=${encodeURIComponent(q.id)}`, [q.id, q.hash]);
  const [busy, setBusy] = useState(false);
  const d = info.data;
  if (!d || info.status === 404 || !d.run) return null;
  const undo = async () => {
    const what = d.created ? `chuyển câu ${q.id} sang retired (câu do lượt AI này tạo ra)` : `khôi phục câu ${q.id} về bản trước lượt AI`;
    if (!window.confirm(`↩️ Hoàn tác lượt ${TASK_VI[d.task] ?? d.task} (${fmtDateTime(d.at)}): ${what}?`)) return;
    setBusy(true);
    try {
      const r = await api.post<UndoResult>(`/api/coach/runs/${encodeURIComponent(d.run)}/undo`, { qid: q.id });
      if (r.conflicts.length) toast(`Không hoàn tác được: ${r.conflicts.map((c) => c.reason).join(' · ')}`);
      else toast(r.retired.length ? `Đã chuyển ${r.retired.length} câu sang retired` : `Đã khôi phục ${r.restored.length} câu`);
      info.reload();
    } catch (e) {
      toast(e instanceof ApiError && e.status === 409 ? `Chưa hoàn tác được: ${e.message}` : `Không hoàn tác được: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="row qr-undo">
      <span className="dim">
        🤖 Sửa lần cuối bởi lượt AI <b>{TASK_VI[d.task] ?? d.task}</b> · {fmtDateTime(d.at)}
      </span>
      <button className="btn sm" disabled={busy} onClick={() => void undo()} title="Khôi phục câu về bản trước lượt AI này (câu AI tạo mới → retired)">
        {busy ? <Spinner /> : '↩️'} Hoàn tác
      </button>
    </div>
  );
}

export function QuestionRelations({ q }: { q: Question }) {
  const { bank } = useData();
  const sealed = new Set(bank?.sealed ?? []);
  const lint = useFetch<{ id: string; siblings?: Link[]; family?: string[] }>(`/api/quality/lint?id=${encodeURIComponent(q.id)}`, [q.id, q.hash]);
  const guide = useShared<GuideCoverage>(q.skills?.length ? '/api/exam-guide' : null);
  const links = (lint.data?.id === q.id ? (lint.data.siblings ?? []) : []).filter((l) => !sealed.has(l.id));
  const others = q.cluster ? (bank?.questions ?? []).filter((x) => x.cluster === q.cluster && x.id !== q.id && !sealed.has(x.id)) : [];
  const linked = new Set(links.map((l) => l.id));
  const family = (lint.data?.id === q.id ? (lint.data.family ?? []) : []).filter((id) => !sealed.has(id));
  const bullets = new Map((guide.data?.bullets ?? []).map((b) => [b.id, b]));
  return (
    <div className="card flat stack sm small qr-card">
      <b>🧬 Quan hệ & đề cương</b>
      {others.length > 0 ? (
        <div className="stack sm">
          <div>
            👪 <b>Nhóm anh em</b> ({others.length + 1} câu) — một phiên chỉ ra một câu của nhóm; làm một câu thì các câu còn lại được để sang hôm sau.
          </div>
          <ul className="qr-list">
            {links.map((l) => (
              <li key={l.id}>
                <QLink id={l.id} /> <span className="muted">{l.kinds.map((k) => KIND_VI[k] ?? k).join(' · ')}{l.kinds.includes('variant') ? '' : ` (${Math.round(l.score * 100)}%)`}</span>
              </li>
            ))}
            {others
              .filter((x) => !linked.has(x.id))
              .map((x) => (
                <li key={x.id}>
                  <QLink id={x.id} /> <span className="muted">cùng nhóm (qua câu khác)</span>
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <div className="muted">👪 Không có câu anh em (không biến thể, không câu gần trùng).</div>
      )}
      {q.family && (
        <div>
          🎯 <b>Họ câu</b> <code>{q.family}</code>: cùng tình huống, cùng phương án, khác yêu cầu cuối
          {family.length ? (
            <>
              {' '}— {family.map((id) => <QLink key={id} id={id} />)}
            </>
          ) : (
            ' — chưa có câu cùng họ.'
          )}
        </div>
      )}
      {q.skills?.length ? (
        <div className="stack sm">
          <div>
            🗺️ <b>Mục đề cương</b>
            {q.skillsGuessed ? <span className="badge" title="Đoán từ từ khoá — ENRICH classify ghi `skills:` để chắc hơn">đoán</span> : <span className="badge good">đã gắn</span>}
          </div>
          <ul className="qr-list">
            {q.skills.map((id) => (
              <li key={id}>
                <a href={href(`/bank?skill=${encodeURIComponent(id)}`)}>
                  <code>{id}</code>
                </a>{' '}
                <span className="dim">{bullets.get(id)?.text ?? ''}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="muted">🗺️ Chưa gắn mục đề cương nào.</div>
      )}
      <UndoButton q={q} />
    </div>
  );
}
