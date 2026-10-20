// Bank → 📐 Chất lượng → 🧪 Giải mù bằng model thứ hai: summary (BankQuality.verification = verifySummary), the review
// queue (mismatch / ambiguous verdicts waiting for a decision: Duyệt · Sửa bằng ENRICH · Báo lỗi · Loại) and runs for
// the AI-written questions not verified yet, the questions changed since their verdict, a pack or the current selection.
// Works while [D]'s /api/verify endpoints are missing (404): the summary shows zeros and the buttons explain why.
// [v5] γ2: 🔗 fact-checks against AWS documentation (verdict + quotes + links) shown on the cards, "🔗 Kiểm chứng có nguồn"
// for the grounded queue or one card, and the import audit (progress, next questions, "🧾 Kiểm toán 10 câu nhập").
import { useState } from 'react';
import { useData, useShared } from '../../lib/store.tsx';
import { fmtDate } from '../../lib/format.ts';
import { Empty } from '../ui.tsx';
import { OptionLine, QRef, decideVerdict, startEnrich, startVerify, useAiReady } from './common.tsx';
import type { FactVerdict, VerifyOutcome, VerifySummary, VerifyVerdict } from '../../../shared/types.ts';

interface VerifyApi extends VerifySummary {
  latest: Record<string, VerifyVerdict>;
}

/** [v5] Import audit: progress + the questions the next audit run takes. */
function AuditCard({ s, disabled, why, onRun, onOpen }: { s: VerifySummary; disabled: boolean; why?: string; onRun: () => void; onOpen: (id: string) => void }) {
  const a = s.audit;
  if (!a) return null;
  const pct = a.imported ? Math.round((100 * a.audited) / a.imported) : 0;
  return (
    <div className="card stack sm">
      <div className="card-head qq-head" style={{ marginBottom: 0 }}>
        <h2>🧾 Kiểm toán câu nhập</h2>
        <span className="small muted num">
          {a.audited}/{a.imported} câu · {pct}%
        </span>
      </div>
      <div className="small dim ins-wrap">
        Câu nhập từ đề luyện chưa từng được giải mù. Mỗi lượt kiểm toán 10 câu — câu bạn sắp gặp trước, rồi câu nhiều đáp án, câu có kiến thức có thể đã cũ. Câu lệch
        được kiểm chứng bằng tài liệu AWS (nếu bật) và chờ bạn quyết định; câu nhập không bao giờ tự chuyển nháp.
      </div>
      <div className="row">
        <button className="btn sm" disabled={disabled || !a.next.length} title={why} onClick={onRun}>
          🧾 Kiểm toán {Math.min(10, a.next.length)} câu nhập
        </button>
        <span className="tiny muted">Chạy theo lịch khi <code>coach.idle_tasks</code> có <code>audit</code>.</span>
      </div>
      {a.next.length > 0 && (
        <details className="small">
          <summary>Lượt kế tiếp ({a.next.length} câu)</summary>
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            {a.next.map((id) => (
              <button key={id} type="button" className="ins-linkish mono tiny" onClick={() => onOpen(id)}>
                {id}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
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
const FACT: Record<FactVerdict, { icon: string; label: string; cls: string }> = {
  correct: { icon: '✅', label: 'tài liệu xác nhận đáp án', cls: 'good' },
  wrong: { icon: '❌', label: 'tài liệu cho thấy đáp án sai', cls: 'bad' },
  outdated: { icon: '⏳', label: 'kiến thức lỗi thời', cls: 'warn' },
  ambiguous: { icon: '⚠️', label: 'tài liệu chưa đủ để quyết', cls: 'warn' },
};

/** [v5] The fact-check of a question against AWS documentation: verdict, answer by the docs, quotes with links. */
function GroundedBlock({ g, current }: { g: VerifyVerdict; current?: string }) {
  const f = FACT[g.fact ?? 'ambiguous'];
  const stale = !!current && g.hash !== current;
  return (
    <div className="stack sm qq-grounded">
      <div className="row small" style={{ gap: 6 }}>
        <span className={`badge ${stale ? '' : f.cls}`}>
          🔗 {f.icon} {f.label}
          {stale ? ' (cũ)' : ''}
        </span>
        {g.picked && <span className="tiny muted">theo tài liệu: {g.picked}</span>}
        <span className="tiny muted">{[g.model, fmtDate(g.at ?? g.date)].filter(Boolean).join(' · ')}</span>
      </div>
      {g.reason && <div className="small ins-wrap">{g.reason}</div>}
      {(g.citations ?? []).map((c, i) => (
        <blockquote key={i} className="small ins-wrap" style={{ margin: 0 }}>
          “{c.quote}”{' '}
          <a href={c.url} target="_blank" rel="noreferrer noopener" className="tiny">
            {c.url.replace(/^https:\/\//, '').slice(0, 70)}
          </a>
        </blockquote>
      ))}
    </div>
  );
}

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

function VerdictCard({ v, onOpen, onIssue, onDone, grounded }: { v: VerifyVerdict; onOpen: (id: string) => void; onIssue: (id: string) => void; onDone: () => void; grounded?: boolean }) {
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
      {v.reason && !v.check && (
        <div className="small ins-wrap">
          <b>Lý do của model:</b> {v.reason}
        </div>
      )}
      {(v.check === 'grounded' ? v : v.grounded) && <GroundedBlock g={v.check === 'grounded' ? v : v.grounded!} current={q?.hash} />}
      {v.local && v.local.hash === q?.hash && (
        <div className="tiny muted">
          🖥️ model local ({v.local.model}): {v.local.outcome === 'ok' ? 'khớp đáp án' : `chọn ${v.local.picked ?? '—'}`}
          {v.local.confidence ? ` · ${CONFIDENCE[v.local.confidence]}` : ''}
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
        {grounded && !(v.check === 'grounded' || (v.grounded && v.grounded.hash === q?.hash)) && (
          <button
            className="btn sm"
            disabled={busy || !ai.ready}
            title={ai.why ?? 'Claude đọc tài liệu AWS chính thức (docs.aws.amazon.com, aws.amazon.com) và trả kết luận kèm trích dẫn'}
            onClick={() => act(() => startVerify({ ids: [v.qid], scope: 'grounded' }, `câu ${v.qid} bằng tài liệu AWS`))}
          >
            🔗 Kiểm chứng
          </button>
        )}
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
  // the live summary (GET /api/verify) carries the v5 extras (audit, grounded queue) that BankQuality.verification lacks
  const s: VerifySummary = { ...(summary ?? {}), ...(api.data ?? summary ?? { verified: 0, ok: 0, review: 0, stale: 0, pending: [] }) };
  const groundedOn = !!s.groundedEnabled;
  const queue = s.groundedQueue ?? [];
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
          {s.disputed !== undefined && (
            <div className="kpi">
              <div className="label">Đáp án đang bị nghi</div>
              <div className="value num">{s.disputed}</div>
              <div className="sub">không tính vào mức sẵn sàng tới khi bạn quyết định</div>
            </div>
          )}
          {s.grounded !== undefined && (
            <div className="kpi">
              <div className="label">🔗 Đã kiểm chứng tài liệu</div>
              <div className="value num">{s.grounded}</div>
              <div className="sub">{queue.length ? `${queue.length} câu chờ kiểm chứng` : 'không còn câu chờ'}</div>
            </div>
          )}
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
        {s.groundedEnabled !== undefined && (
          <div className="row">
            <button
              className="btn sm"
              disabled={disabled || !groundedOn || !queue.length}
              title={groundedOn ? (ai.why ?? 'Claude chỉ được tìm / đọc tài liệu AWS chính thức, trả kết luận + trích dẫn; không đổi đáp án') : 'Đang tắt: config.yaml → coach.verify.grounded'}
              onClick={() => run({ scope: 'grounded' }, `${Math.min(10, queue.length)} câu bằng tài liệu AWS`)}
            >
              🔗 Kiểm chứng có nguồn ({Math.min(10, queue.length)} câu nghi)
            </button>
            <span className="tiny muted">
              {groundedOn ? 'câu lệch / mơ hồ, câu bị báo sai đáp án / lỗi thời, kiến thức có thể đã cũ — chỉ đọc docs.aws.amazon.com, aws.amazon.com' : 'tắt (coach.verify.grounded: false)'}
            </span>
          </div>
        )}
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
              <VerdictCard key={`${v.qid}-${v.line ?? v.date}`} v={v} onOpen={onOpen} onIssue={onIssue} onDone={done} grounded={groundedOn} />
            ))}
          </div>
        )}
      </div>

      <AuditCard s={s} disabled={disabled} why={ai.why} onRun={() => void run({ scope: 'audit' }, '10 câu nhập')} onOpen={onOpen} />
    </div>
  );
}
