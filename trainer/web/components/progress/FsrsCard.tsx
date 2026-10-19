// [L] FSRS-6 parameters in use (default / personal / config.yaml), optimizer status and the "Tối ưu tham số FSRS" button.
// The optimizer runs in a background process on the server: the card polls GET /api/progress while it runs and tells
// the page when the parameters changed (memory states, due dates and the forecast are recomputed).
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.ts';
import { fmtDateTime } from '../../lib/format.ts';
import { KvRow } from '../insights.tsx';
import { Spinner, toast } from '../ui.tsx';
import { reloadProgress, setProgressFsrs } from './useProgress.ts';
import type { FsrsInfo } from '../../../shared/types.ts';

const SOURCE: Record<FsrsInfo['params'], { label: string; cls: string; title: string }> = {
  default: { label: 'mặc định', cls: '', title: 'Tham số FSRS-6 mặc định (huấn luyện trên dữ liệu ôn tập của hàng nghìn người dùng)' },
  personal: { label: '✓ cá nhân', cls: 'good', title: 'Tham số tối ưu riêng theo lịch sử làm bài của bạn' },
  config: { label: 'config.yaml', cls: 'accent', title: 'Bộ tham số đặt tay trong config.yaml → srs.weights' },
};
const MODE: Record<string, { label: string; title: string }> = {
  auto: { label: 'tự động · hàng tuần', title: 'srs.optimize: auto — tối ưu lại trong nền tối đa 1 lần/tuần khi lịch sử ôn tăng ≥ 20%' },
  manual: { label: 'thủ công', title: 'srs.optimize: manual — chỉ khi bạn bấm nút bên dưới' },
  off: { label: 'tắt', title: 'srs.optimize: off — không dùng tham số cá nhân' },
};

const f3 = (x?: number) => (typeof x === 'number' && Number.isFinite(x) ? x.toFixed(3) : '—');
const pct1 = (x?: number) => (typeof x === 'number' && Number.isFinite(x) ? `${Math.round(x * 1000) / 10}%` : '—');

export function FsrsCard({ info, onParamsChanged }: { info?: FsrsInfo; onParamsChanged?: () => void }) {
  const [starting, setStarting] = useState(false);
  const [pending, setPending] = useState(false); // a run we started or saw running, not reported yet
  const running = !!info?.running;
  const latest = useRef({ info, onParamsChanged });
  latest.current = { info, onParamsChanged };

  useEffect(() => {
    if (running) setPending(true);
  }, [running]);
  // poll while the background optimization runs; when it ends, report and let the page refetch states/stats
  useEffect(() => {
    if (!pending) return undefined;
    if (running) {
      const t = setInterval(() => void reloadProgress(), 2000);
      return () => clearInterval(t);
    }
    setPending(false);
    const { info: done, onParamsChanged: changed } = latest.current;
    const outcome = done?.lastOutcome;
    if (outcome === 'error' || done?.lastError) toast(`Tối ưu FSRS lỗi: ${done?.lastError ?? 'không rõ'}`);
    else if (outcome === 'not-enough-data') toast('Chưa đủ dữ liệu để tối ưu — vẫn dùng tham số hiện tại.');
    else if (outcome === 'adopted') toast('✓ Đã tối ưu — lịch ôn dùng tham số cá nhân.');
    else toast('Đã tối ưu — tham số mặc định vẫn khớp dữ liệu của bạn hơn, nên được giữ.');
    if (outcome === 'adopted' || outcome === 'kept-default') changed?.();
    return undefined;
  }, [pending, running]);

  if (!info) return null;
  const src = SOURCE[info.params] ?? SOURCE.default;
  const m = info.metrics;
  const optimize = async () => {
    setStarting(true);
    try {
      // the answer says `running: true` → shown at once; the effect above polls until the run is over
      setProgressFsrs(await api.post<FsrsInfo>('/api/fsrs/optimize'));
    } catch (e) {
      toast(`Không tối ưu được: ${(e as Error).message}`);
    } finally {
      setStarting(false);
    }
  };
  const leitner = info.version === 'leitner';
  return (
    <div className="card stack">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <h2>⚙️ Tham số FSRS</h2>
        <span className={`badge ${src.cls}`} title={src.title}>
          {src.label}
        </span>
      </div>
      <div className="stack sm small">
        <KvRow k="Thuật toán">{leitner ? 'Leitner (srs.algorithm)' : 'FSRS-6 · ts-fsrs'}</KvRow>
        <KvRow k="Xác suất nhớ mục tiêu">{Math.round(info.desiredRetention * 100)}%</KvRow>
        <KvRow
          k="Dữ liệu để tối ưu"
          title="Lượt trả lời bộ tối ưu dùng để học tham số: không tính bài làm vội và câu bỏ trống chưa xem (lịch ôn vẫn tính câu bỏ trống là trả lời sai) · lượt cách lần trước ≥ 1 ngày tạo thành mẫu huấn luyện"
        >
          {info.historyReviews ?? 0} lượt{info.trainingItems !== undefined ? ` · ${info.trainingItems} cách ≥ 1 ngày` : ''}
        </KvRow>
        <KvRow k="Tối ưu tham số" title={MODE[info.mode ?? '']?.title}>
          {MODE[info.mode ?? '']?.label ?? info.mode ?? '—'}
        </KvRow>
        {info.optimizedAt && (
          <KvRow k="Lần tối ưu gần nhất" title={info.binding ? `@open-spaced-repetition/binding ${info.binding}` : undefined}>
            {fmtDateTime(info.optimizedAt)} · {info.reviews ?? 0} lượt
          </KvRow>
        )}
      </div>
      {m && (
        <div className="table-wrap">
          <table className="table lrn-metrics">
            <thead>
              <tr>
                <th title="Đo trên lịch sử của bạn — càng thấp càng tốt">Sai số dự đoán</th>
                <th className="num">Cá nhân</th>
                <th className="num">Mặc định</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="small" title="Log loss: phạt dự đoán tự tin mà sai">Log loss</td>
                <td className={`num small ${(m.logLoss ?? 0) < (m.defaultLogLoss ?? 0) ? 'good' : ''}`}>{f3(m.logLoss)}</td>
                <td className="num small">{f3(m.defaultLogLoss)}</td>
              </tr>
              <tr>
                <td className="small" title="RMSE (bins): chênh lệch trung bình giữa xác suất nhớ dự đoán và tỉ lệ nhớ thực tế">RMSE</td>
                <td className={`num small ${(m.rmse ?? 0) < (m.defaultRmse ?? 0) ? 'good' : ''}`}>{pct1(m.rmse)}</td>
                <td className="num small">{pct1(m.defaultRmse)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {info.note && <div className="small dim">ℹ️ {info.note}</div>}
      {info.lastError && !running && <div className="ins-wrap alert warn small">⚠ Lần tối ưu gần nhất lỗi: {info.lastError}</div>}
      {info.optimizer === 'unavailable' && (
        <div className="small dim">
          Bộ tối ưu (gói tùy chọn <code>@open-spaced-repetition/binding</code>) chưa có trên máy này — lịch ôn vẫn chạy với tham số {info.params === 'config' ? 'trong config.yaml' : 'mặc định'}. Cài lại bằng{' '}
          <code>npm install</code> trong <code>trainer/</code>.
        </div>
      )}
      <div className="row">
        <button className="btn sm primary" disabled={running || starting || !!info.blocked} title={info.blocked} onClick={() => void optimize()}>
          {running || starting ? (
            <>
              <Spinner /> Đang tối ưu…
            </>
          ) : (
            '🎛️ Tối ưu tham số FSRS'
          )}
        </button>
        {info.blocked && !running && <span className="tiny muted">{info.blocked}</span>}
      </div>
      {info.params === 'config' && <div className="tiny muted">Đang dùng srs.weights đặt tay — xoá dòng đó trong config.yaml để dùng tham số cá nhân.</div>}
      <details className="lrn-weights">
        <summary className="tiny muted">21 tham số đang dùng (w0–w20)</summary>
        <code className="tiny">{info.weights.map((w) => (Math.round(w * 10000) / 10000).toString()).join(', ')}</code>
      </details>
    </div>
  );
}
