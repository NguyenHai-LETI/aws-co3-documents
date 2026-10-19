// Bank → 📐 Chất lượng → 🧪 Giải mù bằng model thứ hai: summary (BankQuality.verification = verifySummary), the review
// queue (mismatch / ambiguous verdicts waiting for a decision: Duyệt · Sửa bằng ENRICH · Báo lỗi · Loại) and runs for
// the AI-written questions not verified yet, the questions changed since their verdict, a pack or the current selection.
// Works while [D]'s /api/verify endpoints are missing (404): the summary shows zeros and the buttons explain why.
import { useState } from 'react';
import { useData, useShared } from '../../lib/store.tsx';
import { fmtDate } from '../../lib/format.ts';
import { Empty } from '../ui.tsx';
import { OptionLine, QRef, decideVerdict, startEnrich, startVerify, useAiReady } from './common.tsx';
import type { VerifyOutcome, VerifySummary, VerifyVerdict } from '../../../shared/types.ts';

interface VerifyApi extends VerifySummary {
  latest: Record<string, VerifyVerdict>;
}

/** Latest verdict per question (GET /api/verify, shared by every section); undefined while unsupported. */
export function useVerifyLatest(): Record<string, VerifyVerdict> | undefined {
  return useShared<VerifyApi>('/api/verify').data?.latest;
}

const OUTCOME: Record<VerifyOutcome, { icon: string; label: string; cls: string }> = {
  ok: { icon: '✅', label: 'khớp', cls: 'good' },
  mismatch: { icon: '❌', label: 'lệch đáp án', cls: 'bad' },
  ambiguous: { icon: '⚠️', label: 'mơ hồ', cls: 'warn' },
  error: { icon: '💥', label: 'lỗi', cls: '' },
};
const CONFIDENCE: Record<string, string> = { high: 'tin cậy cao', medium: 'tin cậy vừa', low: 'tin cậy thấp' };

/** "🔎 ❌ lệch đáp án" — dimmed and marked (cũ) when the question changed after the verdict. */
export function VerdictBadge({ v, current }: { v: VerifyVerdict; current?: string }) {
  const o = OUTCOME[v.outcome];
  const stale = !!current && v.hash !== current;
  const title = `Giải mù ${v.date}${v.model ? ` · ${v.model}` : ''}${v.picked ? ` · model chọn ${v.picked}` : ''}${v.key ? ` · đáp án ${v.key}` : ''}${stale ? ' · câu đã sửa sau đó' : ''}`;
  return (
    <span className={`badge ${stale ? '' : o.cls}`} title={title}>
      🔎 {o.icon} {o.label}
      {stale ? ' (cũ)' : v.decision === 'approved' ? ' · đã duyệt' : ''}
    </span>
  );
}

function VerdictCard({ v, onOpen, onIssue, onDone }: { v: VerifyVerdict; onOpen: (id: string) => void; onIssue: (id: string) => void; onDone: () => void }) {
  const { byId } = useData();
  const ai = useAiReady();
  const [busy, setBusy] = useState(false);
  const q = byId.get(v.qid);
  const act = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    if (await fn()) onDone();
    setBusy(false);
  };
  // decisions carry the reviewed version; "stale" (409: the question changed since) reloads the queue too
  const decide = (d: 'approve' | 'retire') => act(async () => (await decideVerdict(v.qid, d, v.hash)) !== 'error');
  return (
    <div className="qq-item qq-verdict stack sm">
      <QRef id={v.qid} onOpen={onOpen} full extra={<VerdictBadge v={v} current={q?.hash} />} />
      {q ? (
        <div className="qq-opts">
          {q.options.map((o) => (
            <OptionLine key={o.key} q={q} k={o.key}>
              {q.answer.includes(o.key) && <span className="badge good">✓ đáp án</span>}
              {v.picked?.includes(o.key) && <span className="badge accent">🤖 model chọn</span>}
            </OptionLine>
          ))}
        </div>
      ) : (
        <div className="small muted">Câu không còn trong ngân hàng.</div>
      )}
      {v.reason && (
        <div className="small ins-wrap">
          <b>Lý do của model:</b> {v.reason}
        </div>
      )}
      <div className="tiny muted">
        {[v.model, v.confidence ? CONFIDENCE[v.confidence] : '', fmtDate(v.at ?? v.date), q?.status === 'draft' ? '📝 đang ở draft (không vào bài test) — duyệt để dùng lại' : ''].filter(Boolean).join(' · ')}
      </div>
      <div className="row">
        <button className="btn primary sm" disabled={busy} onClick={() => decide('approve')} title="Đáp án trong ngân hàng đúng — giữ nguyên câu">
          👍 Duyệt (giữ đáp án)
        </button>
        <button className="btn sm" disabled={busy || !ai.ready} title={ai.why ?? 'AI viết lại giải thích + phương án nhiễu, có lý do của model kiểm tra'} onClick={() => act(() => startEnrich([v.qid], 'explain,distractors'))}>
          🧹 Sửa bằng ENRICH
        </button>
        <button className="btn sm" onClick={() => onIssue(v.qid)}>
          🚩 Báo lỗi
        </button>
        <button
          className="btn sm danger"
          disabled={busy}
          onClick={() => window.confirm(`Loại câu ${v.qid} khỏi ngân hàng (status: retired)? Kết quả cũ vẫn giữ nguyên.`) && decide('retire')}
        >
          🗑️ Loại
        </button>
      </div>
    </div>
  );
}

export function VerifySection({
  summary,
  selected,
  onOpen,
  onIssue,
  onChanged,
}: {
  summary?: VerifySummary;
  selected: string[];
  onOpen: (id: string) => void;
  onIssue: (id: string) => void;
  onChanged: () => void;
}) {
  const { bank } = useData();
  const ai = useAiReady();
  const api = useShared<VerifyApi>('/api/verify');
  const [pack, setPack] = useState('');
  const [busy, setBusy] = useState(false);
  const s = summary ?? api.data ?? { verified: 0, ok: 0, review: 0, stale: 0, pending: [] };
  const unsupported = api.status === 404;
  const packs = (bank?.packs ?? []).filter((p) => p.activeCount > 0);
  const run = async (params: { ids?: string[]; pack?: string; scope?: string }, label: string) => {
    setBusy(true);
    if (await startVerify(params, label)) ai.reload();
    setBusy(false);
  };
  const done = () => {
    onChanged();
    api.reload();
  };
  const disabled = busy || !ai.ready || unsupported;

  return (
    <div className="stack">
      <div className="card stack sm">
        <div className="card-head qq-head" style={{ marginBottom: 0 }}>
          <h2>🧪 Giải mù bằng model thứ hai</h2>
          <span className="small muted mono">trainer/bank/verify.md</span>
        </div>
        <div className="small dim">
          Một model khác (<code>coach.models.verify</code>) giải câu hỏi chỉ từ đề + phương án — không thấy đáp án, giải thích hay gợi ý — rồi app so với đáp án trong ngân hàng. Lệch
          hoặc mơ hồ → chờ bạn duyệt; câu AI viết bị lệch được tạm chuyển <i>draft</i> (không vào bài test) cho tới khi duyệt.
        </div>
        {unsupported && <div className="ins-wrap alert small">Server chưa hỗ trợ giải mù (cần bản server mới) — các nút chạy bên dưới sẽ báo lỗi.</div>}
        <div className="ins-qkpis qq-vkpis">
          <div className="kpi">
            <div className="label">Đã kiểm</div>
            <div className="value num">{s.verified}</div>
            <div className="sub">câu có kết quả cho phiên bản hiện tại</div>
          </div>
          <div className="kpi">
            <div className="label">✅ Khớp đáp án</div>
            <div className="value num">{s.ok}</div>
            <div className="sub">{s.verified ? `${Math.round((100 * s.ok) / s.verified)}% số câu đã kiểm` : '—'}</div>
          </div>
          <div className="kpi">
            <div className="label">Chờ duyệt</div>
            <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
              <span className="value num">{s.review}</span>
              {s.review > 0 && <span className="badge warn">⚠ cần xem</span>}
            </div>
            <div className="sub">lệch đáp án hoặc mơ hồ</div>
          </div>
          <div className="kpi">
            <div className="label">Kết quả cũ</div>
            <div className="value num">{s.stale}</div>
            <div className="sub">câu đã sửa sau lần giải mù</div>
          </div>
        </div>
        <div className="divider" style={{ margin: '4px 0' }} />
        <b className="small">Chạy giải mù (tối đa 60 câu mỗi lượt)</b>
        <div className="row">
          <button className="btn sm" disabled={disabled} title={ai.why} onClick={() => run({ scope: 'unverified-ai' }, 'các câu AI viết chưa kiểm')}>
            🤖 Câu AI viết chưa kiểm
          </button>
          <button className="btn sm" disabled={disabled || !s.stale} title={ai.why} onClick={() => run({ scope: 'changed' }, 'các câu đã sửa')}>
            ✏️ Câu đã sửa sau lần kiểm ({s.stale})
          </button>
          {selected.length > 0 && (
            <button className="btn sm" disabled={disabled} title={ai.why} onClick={() => run({ ids: selected.slice(0, 60) }, `${Math.min(60, selected.length)} câu đang chọn`)}>
              ☑ {Math.min(60, selected.length)} câu đang chọn
            </button>
          )}
        </div>
        <div className="row">
          <select value={pack} onChange={(e) => setPack(e.target.value)} aria-label="Bộ đề để giải mù" className="qq-pack">
            <option value="">— Chọn bộ đề —</option>
            {packs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.activeCount})
              </option>
            ))}
          </select>
          <button className="btn sm" disabled={disabled || !pack} title={ai.why} onClick={() => run({ pack }, `bộ đề ${pack}`)}>
            📦 Giải mù bộ đề
          </button>
        </div>
        {!ai.ready && !unsupported && <div className="ins-wrap alert info small">⏸ {ai.why}</div>}
        <div className="tiny muted">Chọn câu ở tab “Câu hỏi” (ô ☑) để giải mù đúng các câu đó. Chi phí tính chung vào AI Coach.</div>
      </div>

      <div className="card">
        <div className="card-head qq-head">
          <h2>Hàng chờ duyệt ({s.pending.length})</h2>
          <span className="small muted">mới nhất trước</span>
        </div>
        {!s.pending.length ? (
          <Empty icon="✅" title="Không có câu nào chờ duyệt">
            {s.verified ? 'Mọi câu đã giải mù đều khớp đáp án hoặc đã được bạn duyệt.' : 'Chưa giải mù câu nào — chạy ở trên, hoặc để AI Coach tự kiểm câu mới sau mỗi lượt sinh/sửa câu.'}
          </Empty>
        ) : (
          <div className="qq-list">
            {s.pending.map((v) => (
              <VerdictCard key={`${v.qid}-${v.line ?? v.date}`} v={v} onOpen={onOpen} onIssue={onIssue} onDone={done} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
