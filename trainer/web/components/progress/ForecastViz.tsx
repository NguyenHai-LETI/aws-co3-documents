// [L] Exam-day forecast marks: one track per row, a hollow dot = "if study stops today", a filled dot = "if every due
// review is done on time", the gap between them as a light band, the target as a hairline. One hue in two validated
// shades (--seq-2 / --seq-4) + shape, a legend, values as text, a table twin through ChartCard.
import { useState } from 'react';
import { ChartCard } from '../charts.tsx';
import type { DomainDef, ExamForecast } from '../../../shared/types.ts';

const pos = (v: number) => Math.max(0, Math.min(100, v));

export function ForecastLegend({ target, targetLabel }: { target?: number; targetLabel?: string }) {
  return (
    <div className="legend lrn-legend">
      <span>
        <span className="lrn-key-dot stop" />
        nếu dừng học hôm nay
      </span>
      <span>
        <span className="lrn-key-dot sched" />
        nếu ôn đúng lịch
      </span>
      {target !== undefined && (
        <span>
          <span className="ins-sw-line" />
          {targetLabel ?? `mục tiêu ${target}%`}
        </span>
      )}
    </div>
  );
}

/** A single 0–100 % track with the two forecasts and a target hairline. */
export function ForecastTrack({ stop, schedule, target, label }: { stop: number; schedule: number; target?: number; label?: string }) {
  const lo = Math.min(stop, schedule);
  const hi = Math.max(stop, schedule);
  return (
    <div className="lrn-track" role="img" aria-label={label ?? `Nếu dừng học hôm nay ${stop}%, nếu ôn đúng lịch ${schedule}%${target !== undefined ? `, mục tiêu ${target}%` : ''}`}>
      <span className="lrn-track-band" style={{ left: `${pos(lo)}%`, width: `${Math.max(0, pos(hi) - pos(lo))}%` }} />
      {target !== undefined && <i className="lrn-track-target" style={{ left: `${pos(target)}%` }} />}
      <b className="lrn-dot stop" style={{ left: `${pos(stop)}%` }} />
      <b className="lrn-dot sched" style={{ left: `${pos(schedule)}%` }} />
    </div>
  );
}

/** Forecast per exam domain (same marks), with weight, coverage and first-try accuracy in the tooltip and table. */
export function ForecastDomains({ forecast, domains, passPct }: { forecast: ExamForecast; domains: DomainDef[]; passPct: number }) {
  const [hover, setHover] = useState<string>();
  const rows = forecast.byDomain.map((r) => ({ r, d: domains.find((x) => x.id === r.domain) }));
  return (
    <ChartCard
      title="Dự báo theo domain"
      subtitle={`Tỉ lệ đúng dự kiến vào ngày thi · vạch = ngưỡng đỗ ${passPct}%`}
      table={{
        head: ['Domain', 'Trọng số %', 'Độ phủ %', 'Đúng lần đầu %', 'Dừng hôm nay %', 'Ôn đúng lịch %'],
        rows: rows.map(({ r, d }) => [d ? `${d.code} · ${d.label_vi}` : r.domain, r.weight ?? d?.weight ?? 0, r.coverage ?? 0, r.firstTry ?? 0, r.ifStopNow, r.onSchedule]),
      }}
    >
      <div className="lrn-rows">
        {rows.map(({ r, d }) => (
          <div
            key={r.domain}
            className={`lrn-row ${hover === r.domain ? 'on' : ''}`}
            tabIndex={0}
            onPointerEnter={() => setHover(r.domain)}
            onPointerLeave={() => setHover(undefined)}
            onFocus={() => setHover(r.domain)}
            onBlur={() => setHover(undefined)}
          >
            <div className="lrn-row-label">
              {d ? (
                <>
                  <b>{d.code}</b> {d.label_vi}
                </>
              ) : (
                r.domain
              )}
            </div>
            <ForecastTrack stop={r.ifStopNow} schedule={r.onSchedule} target={passPct} label={`${d?.label_vi ?? r.domain}: dừng hôm nay ${r.ifStopNow}%, ôn đúng lịch ${r.onSchedule}%`} />
            <div className="lrn-row-value">
              <b className="num">{r.onSchedule}%</b> <span className="muted num">{r.ifStopNow}%</span>
            </div>
            {hover === r.domain && (
              <div className="tooltip lrn-row-tip">
                <div className="tv">{r.onSchedule}%</div>
                <div className="tl">
                  <span className="key-line" style={{ background: 'var(--seq-4)' }} />
                  ôn đúng lịch
                </div>
                <div className="tl">
                  <span className="key-line" style={{ background: 'var(--seq-2)' }} />
                  dừng học hôm nay: {r.ifStopNow}%
                </div>
                <div className="tl">
                  trọng số đề {r.weight ?? d?.weight}% · đã gặp {r.coverage ?? 0}% câu · đúng lần đầu {r.firstTry ?? 0}%
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <ForecastLegend target={passPct} targetLabel={`ngưỡng đỗ ${passPct}%`} />
    </ChartCard>
  );
}
