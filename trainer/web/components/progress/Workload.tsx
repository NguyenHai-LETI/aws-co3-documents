// [L] Reviews falling due per day (FSRS / Leitner due dates as they stand today; overdue ones count today).
// Single-hue columns ≤ 24 px with a 4 px rounded cap, selective value labels (today + the busiest day), the daily review
// cap as a hairline when it is in range, per-column hover/focus tooltip and a table twin.
import { useState } from 'react';
import { ChartCard } from '../charts.tsx';
import { fmtDay, fmtDayShort, weekday } from './useProgress.ts';
import type { WorkloadDay } from '../../../shared/types.ts';

export function WorkloadChart({ days, dailyLimit, examDate }: { days: WorkloadDay[]; dailyLimit: number; examDate?: string }) {
  const [hover, setHover] = useState<number>();
  if (!days.length) return null;
  const total = days.reduce((s, d) => s + d.due, 0);
  const peak = Math.max(...days.map((d) => d.due));
  const peakIdx = days.findIndex((d) => d.due === peak);
  // the cap line only when it is within the plotted range (else it would flatten every column)
  const showCap = dailyLimit > 0 && peak >= dailyLimit * 0.5;
  const max = Math.max(1, peak, showCap ? dailyLimit : 0);
  const h = (v: number) => (v / max) * 100;
  const last = days[days.length - 1].date;
  const untilExam = !!examDate && last === examDate;
  const overdue = days[0].overdue ?? 0;
  const labelEvery = days.length > 21 ? 7 : days.length > 10 ? 3 : 1;
  const busy = days.filter((d) => dailyLimit > 0 && d.due > dailyLimit).length;
  return (
    <ChartCard
      title="📆 Lịch ôn sắp tới"
      subtitle={`${total} lượt ôn đến hạn trong ${days.length} ngày${untilExam ? ' (tới ngày thi)' : ''} · trung bình ${Math.round((total / days.length) * 10) / 10} câu/ngày`}
      table={{ head: ['Ngày', 'Thứ', 'Câu đến hạn'], rows: days.map((d, i) => [fmtDay(d.date), weekday(d.date), i === 0 && overdue ? `${d.due} (quá hạn ${overdue})` : d.due]) }}
    >
      {!total ? (
        <div className="small muted">Chưa có câu nào đến hạn trong khoảng này — làm thêm bài để FSRS lên lịch ôn.</div>
      ) : (
        <div className="lrn-wl">
          <div className="lrn-wl-plot">
            {showCap && (
              <div className="lrn-wl-cap" style={{ bottom: `${h(dailyLimit)}%` }}>
                <span>giới hạn {dailyLimit}/ngày</span>
              </div>
            )}
            <div className="lrn-wl-cols" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
              {days.map((d, i) => (
                <div
                  key={d.date}
                  className={`lrn-wl-band ${hover === i ? 'on' : ''}`}
                  tabIndex={0}
                  aria-label={`${weekday(d.date)} ${fmtDay(d.date)}: ${d.due} câu đến hạn`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(undefined)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(undefined)}
                >
                  {d.due > 0 && <span className={`lrn-wl-bar ${i === 0 && overdue ? 'today' : ''}`} style={{ height: `${Math.max(2, h(d.due))}%` }} />}
                  {(i === 0 || i === peakIdx) && d.due > 0 && (
                    <span className="lrn-wl-val" style={{ bottom: `calc(${h(d.due)}% + 3px)` }}>
                      {d.due}
                    </span>
                  )}
                  {hover === i && (
                    <div
                      className="tooltip"
                      style={{
                        top: `calc(${100 - h(d.due)}% - 18px)`,
                        ...(i < 3 ? { left: 0, transform: 'translate(0, calc(-100% - 10px))' } : i > days.length - 4 ? { left: 'auto', right: 0, transform: 'translate(0, calc(-100% - 10px))' } : { left: '50%' }),
                      }}
                    >
                      <div className="tv">{d.due} câu</div>
                      <div className="tl">
                        {i === 0 ? 'Hôm nay' : weekday(d.date)} · {fmtDay(d.date)}
                        {d.date === examDate ? ' · 🎯 ngày thi' : ''}
                      </div>
                      {i === 0 && overdue > 0 && <div className="tl">gồm {overdue} câu quá hạn</div>}
                      {dailyLimit > 0 && d.due > dailyLimit && <div className="tl">vượt giới hạn {dailyLimit}/ngày → phần dư dời sang hôm sau</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="lrn-wl-x" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((d, i) => (
              <span key={d.date}>{i === 0 ? 'Nay' : d.date === examDate ? '🎯' : i % labelEvery === 0 && i < days.length - 2 ? fmtDayShort(d.date) : ''}</span>
            ))}
          </div>
          {(overdue > 0 || busy > 0) && (
            <div className="small dim" style={{ marginTop: 8 }}>
              {overdue > 0 && <>Hôm nay gồm {overdue} câu quá hạn. </>}
              {busy > 0 && <>⚠ {busy} ngày vượt giới hạn {dailyLimit} câu/ngày — phần dư thành tồn đọng.</>}
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}
