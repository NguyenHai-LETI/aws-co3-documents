// Hand-rolled SVG/HTML charts following the dataviz method: thin marks, hairline grid,
// single-hue series, hover tooltips, and a table view as the accessible twin of each chart.
import { useEffect, useRef, useState, type ReactNode } from 'react';

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => setW(Math.max(200, es[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export interface ChartCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  table?: { head: string[]; rows: (string | number)[][] };
  actions?: ReactNode;
  children: ReactNode;
}

/** Card with a title and a chart ⇄ table toggle. */
export function ChartCard({ title, subtitle, table, actions, children }: ChartCardProps) {
  const [asTable, setAsTable] = useState(false);
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <div className="small muted" style={{ marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div className="row">
          {actions}
          {table && (
            <button className="btn ghost sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
              {asTable ? '📈 Biểu đồ' : '▦ Bảng'}
            </button>
          )}
        </div>
      </div>
      {asTable && table ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>{table.head.map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={typeof c === 'number' ? 'num' : ''}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ── line chart (single series, 0–100 %, optional target line) ─────────────

export interface LinePoint {
  label: string; // x label (short)
  value: number;
  detail?: string; // tooltip secondary line
  onClick?: () => void;
}

export function LineChart({ points, target, height = 220, yMax = 100, unit = '%' }: { points: LinePoint[]; target?: number; height?: number; yMax?: number; unit?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number>();
  const pad = { l: 34, r: 14, t: 12, b: 26 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const n = points.length;
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (Math.max(0, Math.min(yMax, v)) / yMax) * ih;
  const ticks = [0, 25, 50, 75, 100].map((t) => (t * yMax) / 100);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = n ? `${path} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : '';
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!n) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round(((px - pad.l) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div className="chart" ref={ref}>
      <svg
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(undefined)}
        onClick={() => hover !== undefined && points[hover]?.onClick?.()}
        style={{ cursor: hover !== undefined && points[hover]?.onClick ? 'pointer' : 'default' }}
        role="img"
        aria-label={`Biểu đồ đường ${n} điểm`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'axis' : 'gridline'} x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
            <text className="tick" x={pad.l - 8} y={y(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {target !== undefined && (
          <g>
            <line className="target-line" x1={pad.l} x2={width - pad.r} y1={y(target)} y2={y(target)} />
            <text className="target-label" x={pad.l + 6} y={y(target) - 5} textAnchor="start">
              Đỗ {target}
              {unit}
            </text>
          </g>
        )}
        {n > 0 && <path d={area} fill="var(--series-1)" opacity={0.1} />}
        {n > 0 && <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {hover !== undefined && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--axis)" strokeWidth={1} />}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={hover === i ? 5.5 : 4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={`l${i}`} className="tick" x={x(i)} y={height - 6} textAnchor="middle">
              {p.label}
            </text>
          ) : null,
        )}
        {n > 0 && (
          <text x={x(n - 1)} y={y(points[n - 1].value) - 10} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--text-1)">
            {points[n - 1].value}
            {unit}
          </text>
        )}
      </svg>
      {hover !== undefined && points[hover] && (
        <div className="tooltip" style={{ left: x(hover), top: y(points[hover].value) }}>
          <div className="tv">
            {points[hover].value}
            {unit}
          </div>
          <div className="tl">
            <span className="key-line" style={{ background: 'var(--series-1)' }} />
            {points[hover].label}
          </div>
          {points[hover].detail && <div className="tl">{points[hover].detail}</div>}
        </div>
      )}
    </div>
  );
}

// ── horizontal bar list (0–100 %) ─────────────────────────────────────────

export interface BarItem {
  key: string;
  label: ReactNode;
  value: number; // 0..100
  valueText?: string;
  title?: string;
  muted?: boolean; // no data yet
  onClick?: () => void;
}

export function BarList({ items, target, max = 100 }: { items: BarItem[]; target?: number; max?: number }) {
  return (
    <div className="barlist">
      {items.map((it) => (
        <div
          key={it.key}
          className={`bar-row ${it.onClick ? 'link' : ''}`}
          title={it.title}
          onClick={it.onClick}
          role={it.onClick ? 'button' : undefined}
          tabIndex={it.onClick ? 0 : undefined}
          onKeyDown={(e) => it.onClick && e.key === 'Enter' && it.onClick()}
        >
          <div className="bar-label">{it.label}</div>
          <div className="bar-track">
            {!it.muted && <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, (it.value / max) * 100))}%` }} />}
            {it.muted && <div className="bar-fill" style={{ width: '100%', background: 'var(--surface-3)', borderRadius: 4 }} />}
            {target !== undefined && <div className="bar-target" style={{ left: `${(target / max) * 100}%` }} />}
          </div>
          <div className="bar-value">{it.valueText ?? `${it.value}%`}</div>
        </div>
      ))}
    </div>
  );
}

// ── stacked bar (part-to-whole) ───────────────────────────────────────────

export function StackBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="stackbar" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.label} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
          ))}
      </div>
      <div className="legend">
        {segments.map((s) => (
          <span key={s.label}>
            <span className="sw" style={{ background: s.color }} />
            {s.label} <b className="num" style={{ color: 'var(--text-1)' }}>{s.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── activity heatmap (calendar, sequential blue) ──────────────────────────

export function Heatmap({ days, weeks = 18 }: { days: { date: string; answers: number; correct: number }[]; weeks?: number }) {
  const map = new Map(days.map((d) => [d.date, d]));
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (weeks * 7 - 1) - ((today.getDay() + 6) % 7));
  const cells: { date: string; n: number; c: number; future: boolean }[] = [];
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  for (let d = new Date(start); cells.length < weeks * 7 + 7; d.setDate(d.getDate() + 1)) {
    const k = key(d);
    const v = map.get(k);
    cells.push({ date: k, n: v?.answers ?? 0, c: v?.correct ?? 0, future: d > today });
    if (d > today && d.getDay() === 0) break;
  }
  const max = Math.max(1, ...cells.map((c) => c.n));
  const step = (n: number) => (n === 0 ? 'var(--seq-0)' : `var(--seq-${Math.min(5, 1 + Math.floor((n / max) * 4.999))})`);
  return (
    <div>
      <div className="heatmap" role="img" aria-label="Lịch hoạt động">
        {cells.map((c) => (
          <div key={c.date} title={`${c.date}: ${c.n} câu${c.n ? ` · đúng ${Math.round((c.c / c.n) * 100)}%` : ''}`} style={{ background: c.future ? 'transparent' : step(c.n) }} />
        ))}
      </div>
      <div className="legend">
        <span>Ít</span>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="sw" style={{ background: i === 0 ? 'var(--seq-0)' : `var(--seq-${i})`, marginRight: 0 }} />
        ))}
        <span>Nhiều (tối đa {max} câu/ngày)</span>
      </div>
    </div>
  );
}

export function Meter({ value, max = 100, target, label }: { value: number; max?: number; target?: number; label?: string }) {
  return (
    <div className="meter" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <span style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
      {target !== undefined && <i className="target" style={{ left: `${(target / max) * 100}%` }} />}
    </div>
  );
}

export function Kpi({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
