// Shared building blocks for the insight pages (result, stats, bank quality, coach, dashboard, history):
// readiness with a 90 % interval, a single-hue column chart, attempt/task badges and the ENRICH panel.
// Charts follow the same rules as charts.tsx: one hue, hairline target, status colour only with icon + label.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api.ts';
import { useData, useFetch } from '../lib/store.tsx';
import { navigate } from '../lib/router.ts';
import { fmtDateTime, fmtRelative } from '../lib/format.ts';
import { scaledScore } from '../../shared/scoring.ts';
import { BarList, Meter } from './charts.tsx';
import { toast } from './ui.tsx';
import type { AttemptSummary, CoachRunInfo, EnrichStatus, StatsResponse } from '../../shared/types.ts';

// ── small helpers ─────────────────────────────────────────────────────────

/** Percentage with one decimal (0 when the denominator is 0). */
export const pctOf = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

export function fmtUsd(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '—';
  if (v === 0) return '$0';
  if (v < 0.01) return '< $0.01';
  return `$${v.toFixed(2)}`;
}

export const COACH_TASK_LABEL: Record<string, string> = {
  analyze: '🔍 Phân tích',
  generate: '✨ Sinh câu hỏi',
  enrich: '🧹 ENRICH',
  longform: '📏 Câu dài',
  ask: '🤖 Hỏi AI',
  verify: '🧪 Giải mù',
};

export const ENRICH_JOBS = [
  { id: 'explain', label: 'Giải thích', desc: 'Vì sao đúng (EN) + từng phương án nhiễu + tóm tắt 🇻🇳', feature: 'shortexpl' },
  { id: 'hint', label: 'Gợi ý', desc: 'Một dòng gợi ý tiếng Việt, không lộ đáp án', feature: 'nohint' },
  { id: 'classify', label: 'Phân loại', desc: 'Domain + task 1.1–4.4 + services/tags + concept', feature: 'notenriched' },
  { id: 'balance', label: 'Cân độ dài', desc: 'Viết lại phương án nhiễu để đáp án đúng không “dài nhất”', feature: 'longest' },
] as const;

/** Same rule as the server's coach.hosts check: case-insensitive, full or short hostname. */
export function hostListed(host: string | undefined, list: string[] | undefined): boolean {
  const l = (list ?? []).map((h) => String(h).trim().toLowerCase()).filter(Boolean);
  if (!l.length) return true;
  const h = (host ?? '').trim().toLowerCase();
  const short = h.split('.')[0];
  return l.some((x) => x === h || x === short || x.split('.')[0] === short);
}

export function KvRow({ k, children, title }: { k: ReactNode; children: ReactNode; title?: string }) {
  return (
    <div className="row between nowrap ins-kv" title={title}>
      <span className="muted">{k}</span>
      <b className="num">{children}</b>
    </div>
  );
}

/**
 * Esc closes only this layer: our dialogs open above the bank drawer, which also closes on Esc
 * (a window capture listener runs before the bubble-phase listeners of Drawer/Modal).
 */
export function useEscLayer(open: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      ref.current();
    };
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }, [open]);
}

// ── badges ────────────────────────────────────────────────────────────────

/** Pearson-simulation and rushed-attempt markers for result lists and headers. */
export function AttemptBadges({ a }: { a: Partial<Pick<AttemptSummary, 'pearson' | 'rushed' | 'medianTime' | 'pilotTotal'>> }) {
  return (
    <>
      {a.pearson && (
        <span className="badge accent" title={`Mô phỏng Pearson VUE${a.pilotTotal ? `: ${a.pilotTotal} câu thử nghiệm không tính điểm` : ''}, review cuối bài, không tạm dừng`}>
          🎓 Pearson
        </span>
      )}
      {a.rushed && (
        <span className="badge warn" title={`Thời gian trung vị ${a.medianTime ?? '?'}s/câu — quá nhanh nên không tính vào thống kê, mức sẵn sàng và lịch ôn`}>
          ⚡ làm vội
        </span>
      )}
    </>
  );
}

/** Exam-guide task statement badge ("📋 2.2") with the statement as tooltip. */
export function TaskBadge({ id }: { id?: string }) {
  const { task } = useData();
  if (!id) return null;
  const t = task(id);
  return (
    <span className="badge" title={t ? `Task ${t.id}: ${t.label} — ${t.label_vi}` : `Task ${id}`}>
      📋 {id}
    </span>
  );
}

export function passTone(p: number): { cls: 'good' | 'warn' | 'bad'; icon: string } {
  if (p >= 0.8) return { cls: 'good', icon: '✓' };
  if (p >= 0.5) return { cls: 'warn', icon: '⚠' };
  return { cls: 'bad', icon: '✗' };
}

/** Pass probability as a status badge (icon + label, never colour alone). */
export function PassChance({ p }: { p?: number }) {
  if (typeof p !== 'number' || !Number.isFinite(p)) return null;
  const t = passTone(p);
  const pct = p < 0.01 ? '< 1' : p > 0.99 ? '> 99' : String(Math.round(p * 100));
  return (
    <span className={`badge ${t.cls}`} title="Xác suất mức sẵn sàng thật ≥ ngưỡng đỗ (xấp xỉ phân phối chuẩn từ dữ liệu của bạn)">
      {t.icon} {pct}% khả năng đỗ
    </span>
  );
}

// ── readiness with uncertainty ───────────────────────────────────────────

/** Estimate (dot) + 90 % interval (band) on a 0..max track, with the pass mark as a hairline. */
export function IntervalMeter({ value, low, high, target, max = 100, legend = true }: { value: number; low?: number; high?: number; target?: number; max?: number; legend?: boolean }) {
  const pos = (v: number) => Math.max(0, Math.min(100, (v / max) * 100));
  const band = typeof low === 'number' && typeof high === 'number' && high >= low;
  const aria = `Ước tính ${value}%${band ? `, khoảng 90%: ${low}–${high}%` : ''}${target !== undefined ? `, ngưỡng đỗ ${target}%` : ''}`;
  return (
    <div>
      <div className="ins-imeter" role="img" aria-label={aria}>
        {band && <span className="ins-imeter-band" style={{ left: `${pos(low)}%`, width: `${Math.max(0.8, pos(high) - pos(low))}%` }} />}
        {target !== undefined && <i className="ins-imeter-target" style={{ left: `${pos(target)}%` }} />}
        <b className="ins-imeter-dot" style={{ left: `${pos(value)}%` }} />
      </div>
      {legend && (
        <div className="legend ins-imeter-legend">
          <span>
            <span className="ins-sw-dot" />
            ước tính {value}%
          </span>
          {band && (
            <span>
              <span className="sw ins-sw-band" />
              khoảng 90%
            </span>
          )}
          {target !== undefined && (
            <span>
              <span className="ins-sw-line" />
              ngưỡng đỗ {target}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const CONF_VI: Record<string, string> = { low: 'thấp', medium: 'vừa', high: 'cao' };

/** Readiness v2: scaled score, 90 % interval, pass probability, confidence (falls back to v1 fields). */
export function ReadinessCard({ totals: T, compact, children }: { totals: StatsResponse['totals']; compact?: boolean; children?: ReactNode }) {
  const { meta } = useData();
  if (!meta) return null;
  const passPct = meta.exam.pass_pct;
  const v2 = typeof T.readinessLow === 'number' && typeof T.readinessHigh === 'number';
  const gap = Math.round((passPct - T.readiness) * 10) / 10;
  return (
    <div className="card stack">
      <div className="small muted">Mức sẵn sàng thi (ước tính)</div>
      <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
        <span className="hero-figure">{T.readinessScaled}</span>
        <span className="muted">/ 1000</span>
        {v2 && <PassChance p={T.passProbability} />}
      </div>
      {v2 ? <IntervalMeter value={T.readiness} low={T.readinessLow} high={T.readinessHigh} target={passPct} /> : <Meter value={T.readiness} target={passPct} label="Mức sẵn sàng" />}
      <div className="small dim">
        {v2 && (
          <>
            Khoảng 90%:{' '}
            <b className="num">
              {scaledScore(T.readinessLow)}–{scaledScore(T.readinessHigh)}
            </b>{' '}
            ·{' '}
          </>
        )}
        {T.readiness >= passPct ? '✓ ước tính trên ngưỡng đỗ' : `còn ${gap} điểm % tới ngưỡng ${passPct}%`} · độ tin cậy <b>{CONF_VI[T.readinessConfidence] ?? T.readinessConfidence}</b>
      </div>
      {!compact && (
        <div className="tiny muted">
          Trung bình có trọng số theo 4 domain (30/26/24/20). Kết quả gần đây nặng hơn (cũ dần thì giảm nửa trọng số), câu dài ×1.5, câu khó ×1.2; bài làm vội bị bỏ qua.
          Khoảng 90% hẹp lại khi bạn làm nhiều câu hơn ở mọi domain.
        </div>
      )}
      {children}
    </div>
  );
}

// ── column chart (few ordered categories, single hue) ─────────────────────

export interface ColumnItem {
  key: string;
  label: ReactNode;
  value: number; // in the units of `max`
  valueText?: string; // label on the cap
  detail?: ReactNode; // tooltip lines
  ariaLabel?: string;
}

/** Vertical columns ≤ 24 px, value on the cap, optional target hairline, hover/focus tooltip. */
export function ColumnChart({ items, max = 100, target, targetLabel, height = 120 }: { items: ColumnItem[]; max?: number; target?: number; targetLabel?: string; height?: number }) {
  const [hover, setHover] = useState<number>();
  const pos = (v: number) => Math.max(0, Math.min(100, (v / Math.max(max, 1e-9)) * 100));
  const cols = { gridTemplateColumns: `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))` };
  return (
    <div className="ins-cols">
      <div className="ins-cols-plot" style={{ height }}>
        {target !== undefined && (
          <div className="ins-cols-target" style={{ bottom: `${pos(target)}%` }}>
            <span>{targetLabel ?? target}</span>
          </div>
        )}
        <div className="ins-cols-bands" style={cols}>
          {items.map((it, i) => (
            <div
              key={it.key}
              className={`ins-cols-band ${hover === i ? 'on' : ''}`}
              tabIndex={0}
              aria-label={it.ariaLabel}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(undefined)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(undefined)}
            >
              <span className="ins-cols-bar" style={{ height: `${pos(it.value)}%` }} />
              <span className="ins-cols-val" style={{ bottom: `calc(${pos(it.value)}% + 3px)` }}>
                {it.valueText ?? it.value}
              </span>
              {hover === i && it.detail && (
                // first/last column: anchor the tooltip to the plot edge so it never leaves the card on phones
                <div
                  className="tooltip"
                  style={{
                    top: `calc(${100 - pos(it.value)}% - 20px)`,
                    ...(i === 0 && items.length > 1
                      ? { left: 0, transform: 'translate(0, calc(-100% - 12px))' }
                      : i === items.length - 1 && items.length > 1
                        ? { left: 'auto', right: 0, transform: 'translate(0, calc(-100% - 12px))' }
                        : { left: '50%' }),
                  }}
                >
                  {it.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="ins-cols-x" style={cols}>
        {items.map((it) => (
          <span key={it.key}>{it.label}</span>
        ))}
      </div>
    </div>
  );
}

// ── ENRICH (bank maintenance) status + run buttons ────────────────────────

interface CoachStatusLite {
  status?: { running?: CoachRunInfo; lockedBy?: { pid: number; runId: string } };
  blocked?: string | null;
}

/**
 * ENRICH progress, pending work per job and buttons to start an enrich batch / long-form generation.
 * Pass `running`/`blocked` when the page already has GET /api/coach; otherwise the panel fetches it.
 */
export function EnrichPanel({ running, blocked, onStarted }: { running?: boolean; blocked?: string | null; onStarted?: (run: CoachRunInfo) => void }) {
  const { meta } = useData();
  const { data: st, error, status, loading } = useFetch<EnrichStatus>('/api/enrich/status');
  const coach = useFetch<CoachStatusLite>(running === undefined ? '/api/coach' : null);
  const isRunning = running ?? !!(coach.data?.status?.running || coach.data?.status?.lockedBy);
  const blockedWhy = running === undefined ? coach.data?.blocked : blocked;
  const [size, setSize] = useState(20);
  const [jobs, setJobs] = useState<string[]>(ENRICH_JOBS.map((j) => j.id));
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const claudeOk = !!meta?.claude?.available;

  const run = async (task: 'enrich' | 'longform', params: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await api.post<{ run: CoachRunInfo }>('/api/coach/run', { task, params });
      toast(task === 'enrich' ? '🧹 Đã bắt đầu lượt ENRICH — xem log ở AI Coach.' : '📏 Đã bắt đầu sinh câu dài — xem log ở AI Coach.');
      onStarted?.(r.run);
      coach.reload();
    } catch (e) {
      toast(`Không chạy được: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !st) return <div className="small muted">Đang tải trạng thái ENRICH…</div>;
  if (!st) {
    return (
      <div className="ins-wrap alert small">
        {status === 404 ? 'Server chưa hỗ trợ ENRICH (cần bản server mới).' : `Không đọc được trạng thái ENRICH${error ? `: ${error}` : ''}.`}
      </div>
    );
  }
  const pending = st.pending ?? { explain: 0, hint: 0, classify: 0, balance: 0 };
  const candidates = (st as EnrichStatus & { longFormCandidates?: number }).longFormCandidates; // optional server extra
  const total = Math.max(1, st.total);
  const last = st.lastRun;
  const disabled = busy || isRunning || !claudeOk || !!blockedWhy;

  return (
    <div className="stack">
      <div className="split-l ins-enrich">
        <div className="stack sm">
          <div className="row between">
            <b>Tiến độ ENRICH</b>
            <span className="small num">
              {st.enriched}/{st.total} câu · {pctOf(st.enriched, st.total)}%
            </span>
          </div>
          <Meter value={pctOf(st.enriched, st.total)} label="Tỉ lệ câu đã ENRICH" />
          <div className="small stack sm">
            <KvRow k="📜 Câu dài (giống đề thật)" title="Đề đủ dài như đề thi thật">
              {st.longForm} · {pctOf(st.longForm, st.total)}%
            </KvRow>
            {typeof candidates === 'number' && (
              <KvRow k="Câu nên có bản dài" title="Câu ngắn bạn gặp/sai nhiều, trọng số cao, chưa có biến thể dài">
                {candidates}
              </KvRow>
            )}
          </div>
          {last ? (
            <div className="small dim">
              Lượt gần nhất: {fmtDateTime(last.startedAt)} ({fmtRelative(last.startedAt)}) ·{' '}
              <span className={`badge ${last.status === 'success' ? 'good' : last.status === 'error' ? 'bad' : ''}`}>
                {last.status === 'success' ? '✓' : last.status === 'error' ? '✗' : '•'} {last.status}
              </span>
              {last.summary && <div className="tiny muted ins-clamp ins-wrap">{last.summary}</div>}
            </div>
          ) : (
            <div className="small muted">Chưa có lượt ENRICH nào.</div>
          )}
        </div>
        <div className="stack sm">
          <b className="small">Còn cần xử lý (bấm để xem các câu)</b>
          <BarList
            max={total}
            items={ENRICH_JOBS.map((j) => ({
              key: j.id,
              label: j.label,
              value: pending[j.id] ?? 0,
              valueText: `${pending[j.id] ?? 0} câu`,
              title: j.desc,
              onClick: () => navigate(`/bank?feature=${j.feature}`),
            }))}
          />
        </div>
      </div>

      <div className="divider" style={{ margin: '2px 0' }} />
      <div className="grid c2">
        <div className="stack sm">
          <b className="small">🧹 Chạy 1 lượt ENRICH</b>
          <div className="row" style={{ gap: 6 }}>
            {ENRICH_JOBS.map((j) => (
              <label key={j.id} className="chip" title={j.desc} style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={jobs.includes(j.id)} onChange={() => setJobs((x) => (x.includes(j.id) ? x.filter((y) => y !== j.id) : [...x, j.id]))} />
                {j.label} <span className="n">{pending[j.id] ?? 0}</span>
              </label>
            ))}
          </div>
          <div className="row">
            <label className="row small" style={{ gap: 6 }}>
              Số câu
              <input type="number" min={1} max={60} value={size} onChange={(e) => setSize(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} style={{ width: 72 }} />
            </label>
            <button className="btn primary" disabled={disabled || !jobs.length} onClick={() => run('enrich', { size, tasks: jobs })}>
              🧹 Chạy ENRICH {size} câu
            </button>
          </div>
        </div>
        <div className="stack sm">
          <b className="small">📏 Sinh câu dài (giống đề thật)</b>
          <div className="small dim">AI viết biến thể 60–120 từ cho các câu bạn gặp nhiều/sai nhiều mà chưa có bản dài.</div>
          <div className="row">
            <label className="row small" style={{ gap: 6 }}>
              Số câu
              <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} style={{ width: 72 }} />
            </label>
            <button className="btn" disabled={disabled} onClick={() => run('longform', { count })}>
              📏 Sinh {count} câu dài
            </button>
          </div>
        </div>
      </div>
      {isRunning && <div className="ins-wrap alert info small">⏳ Đang có một lượt AI Coach chạy — đợi xong rồi chạy tiếp.</div>}
      {blockedWhy && <div className="ins-wrap alert info small">⏸ {blockedWhy}</div>}
      {!claudeOk && <div className="ins-wrap alert warn small">⚠️ Chưa tìm thấy Claude Code CLI — xem hướng dẫn ở trang AI Coach.</div>}
      <div className="tiny muted">
        ENRICH chạy dần theo lịch (khi không có bài làm mới) hoặc bằng nút ở đây. AI ghi thay đổi thành patch trong <code>trainer/coach/patches/</code>, app kiểm tra
        hash + validator trước khi áp dụng — câu lỗi được hoàn tác.
      </div>
    </div>
  );
}
