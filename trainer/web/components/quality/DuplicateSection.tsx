// Bank → 📐 Chất lượng → 👯 Câu trùng: lexical near-duplicates + semantic ones from a local embedding model (Ollama,
// server/lib/embeddings.ts). Shows the provider status with install / pull hints, recomputes on demand and polls the
// background job while it runs (GET /api/quality/semantic) — the server never embeds inside a request.
import { useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import { useData } from '../../lib/store.tsx';
import { href } from '../../lib/router.ts';
import { fmtDateTime } from '../../lib/format.ts';
import { copyText, toast } from '../ui.tsx';
import type { DuplicatePair, SemanticStatus } from '../../../shared/types.ts';

const INSTALL = ['brew install ollama', 'ollama serve', 'ollama pull embeddinggemma'];

function SemanticCard({ status, onRecompute, busy }: { status?: SemanticStatus; onRecompute: () => void; busy: boolean }) {
  if (!status) return <div className="ins-wrap alert small">Server chưa hỗ trợ tìm câu trùng theo nghĩa (cần bản server mới) — đang so khớp theo từ khoá.</div>;
  const s = status;
  const model = s.model ?? 'embeddinggemma';
  // Ollama missing → the three install steps; only the model missing → just the pull; other errors → the server hint
  const install = !s.hint || /brew install/.test(s.hint);
  const steps = install ? INSTALL.map((c) => (c.startsWith('ollama pull') ? `ollama pull ${model}` : c)) : /ollama pull/.test(s.hint ?? '') ? [`ollama pull ${model}`] : [];
  const recompute = (
    <button className="btn sm" disabled={busy || s.state === 'running'} onClick={onRecompute}>
      {s.state === 'running' ? '⏳ Đang tính…' : s.available ? '↻ Tính lại' : '↻ Kiểm tra lại'}
    </button>
  );
  if (s.provider === 'off') {
    return (
      <div className="qq-sem row between">
        <span className="small">
          🧠 Tìm trùng theo nghĩa: <b>đang tắt</b> — chỉ so khớp từ khoá. Bật: <code>config.yaml → quality.embeddings: auto</code>
        </span>
      </div>
    );
  }
  return (
    <div className={`qq-sem stack sm ${s.available ? 'ok' : ''}`}>
      <div className="row between">
        <span className="small">
          {s.state === 'running' ? (
            <>
              <span className="spinner" /> Đang tính embedding bằng Ollama · <b>{model}</b>
              {typeof s.total === 'number' ? ` · ${s.total} câu` : ''}…
            </>
          ) : s.available ? (
            <>
              🧠 Trùng theo nghĩa: <span className="badge good">✓ Ollama · {model}</span> {s.embedded ?? 0}/{s.total ?? 0} câu đã nhúng · ngưỡng cosine {s.threshold ?? '—'} · {s.pairs ?? 0}{' '}
              cặp
              {s.checkedAt ? <span className="muted"> · tính lúc {fmtDateTime(s.checkedAt)}</span> : null}
            </>
          ) : (
            <>
              🧠 Trùng theo nghĩa: <span className={`badge ${s.state === 'error' ? 'bad' : 'warn'}`}>{s.state === 'error' ? '✗ lỗi' : 'ℹ chưa có Ollama'}</span> — đang so khớp theo từ khoá.
              {s.error && <span className="ins-wrap"> {s.error}.</span>}
            </>
          )}
        </span>
        {recompute}
      </div>
      {!s.available && s.state !== 'running' && (
        <div className="small dim stack sm">
          {install ? (
            <span>Cài Ollama để tìm câu trùng theo nghĩa ngay trên máy (không gửi dữ liệu ra ngoài) — bấm để sao chép từng lệnh:</span>
          ) : (
            <span className="ins-wrap">{s.hint}</span>
          )}
          {steps.length > 0 && (
            <div className="row qq-cmds">
              {steps.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  className="qq-cmd mono tiny"
                  title="Bấm để sao chép"
                  onClick={async () => toast((await copyText(c)) ? `Đã sao chép: ${c}` : 'Không sao chép được')}
                >
                  {steps.length > 1 && <span className="muted">{i + 1}.</span>} {c}
                </button>
              ))}
            </div>
          )}
          {install && <span className="tiny muted">Windows / Linux: tải ở ollama.com/download. Xong bấm “Kiểm tra lại” — app tự nhúng các câu ở chế độ nền.</span>}
        </div>
      )}
    </div>
  );
}

export function DuplicateSection({ pairs, semantic, onOpenPair, onChanged }: { pairs: DuplicatePair[]; semantic?: SemanticStatus; onOpenPair: (p: DuplicatePair) => void; onChanged: () => void }) {
  const { byId } = useData();
  const [status, setStatus] = useState<SemanticStatus | undefined>(semantic);
  const [kind, setKind] = useState<'all' | 'lexical' | 'semantic'>('all');
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setStatus(semantic), [semantic]);

  // the job runs in the background: poll until it finishes, then reload the quality report
  const running = status?.state === 'running';
  useEffect(() => {
    if (!running) return;
    let alive = true;
    const t = setInterval(async () => {
      try {
        const r = await api.get<{ status: SemanticStatus }>('/api/quality/semantic');
        if (!alive) return;
        setStatus(r.status);
        if (r.status.state !== 'running') onChanged();
      } catch {
        // transient — keep polling
      }
    }, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [running, onChanged]);

  const recompute = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ status: SemanticStatus }>('/api/quality/semantic', {});
      setStatus(r.status);
    } catch (e) {
      toast(`Không chạy được: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const semanticCount = pairs.filter((p) => p.kind === 'semantic').length;
  const list = pairs.filter((p) => kind === 'all' || (p.kind ?? 'lexical') === kind);
  const variantPair = (p: DuplicatePair) => !!byId.get(p.a)?.variantOf.includes(p.b) || !!byId.get(p.b)?.variantOf.includes(p.a);

  return (
    <div className="card stack sm">
      <div className="card-head qq-head" style={{ marginBottom: 0 }}>
        <h2>👯 Câu gần trùng ({pairs.length})</h2>
        <div className="seg" role="group" aria-label="Lọc theo cách tìm">
          {(
            [
              ['all', `Tất cả ${pairs.length}`],
              ['lexical', `🔤 Từ khoá ${pairs.length - semanticCount}`],
              ['semantic', `🧠 Theo nghĩa ${semanticCount}`],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <SemanticCard status={status} onRecompute={recompute} busy={busy} />
      {!list.length ? (
        <div className="small muted">✓ Không thấy cặp câu nào gần trùng{kind !== 'all' ? ' theo cách này' : ''}.</div>
      ) : (
        <>
          <div className="qq-list" role="list">
            {(all ? list : list.slice(0, 12)).map((d) => (
              <div
                key={`${d.a}-${d.b}`}
                role="listitem"
                className="qq-item qq-pair"
                onClick={() => onOpenPair(d)}
                title="Bấm để so sánh hai câu"
              >
                <div className="row between">
                  <span className="row" style={{ gap: 6 }}>
                    <b className="num">{Math.round(d.score * 100)}%</b>
                    <span className="badge" title={d.kind === 'semantic' ? 'Tìm bằng model embedding (cosine của đề + đáp án đúng)' : 'Trùng từ khoá của đề + đáp án đúng'}>
                      {d.kind === 'semantic' ? '🧠 theo nghĩa' : '🔤 từ khoá'}
                    </span>
                    {variantPair(d) && <span className="badge accent">↻ biến thể</span>}
                  </span>
                  <button
                    className="btn ghost sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPair(d);
                    }}
                  >
                    So sánh
                  </button>
                </div>
                <div className="qq-pair-cols">
                  {[d.a, d.b].map((id) => (
                    <div key={id} className="small">
                      <a href={href(`/bank?q=${encodeURIComponent(id)}`)} className="mono tiny" onClick={(e) => e.stopPropagation()}>
                        {id}
                      </a>
                      <div className="ins-clamp muted">{byId.get(id)?.stem ?? '(không còn trong ngân hàng)'}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {list.length > 12 && (
            <button className="btn ghost sm" onClick={() => setAll((v) => !v)}>
              {all ? 'Thu gọn' : `Xem tất cả ${list.length} cặp`}
            </button>
          )}
        </>
      )}
      <div className="tiny muted">Trùng thật? Bấm 👎 (lý do “Trùng với câu khác”) ở một câu để AI Coach gộp hoặc loại, hoặc đặt <code>- status: retired</code> trong file pack.</div>
    </div>
  );
}
