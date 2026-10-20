// [L] Dashboard: days left until the exam + the forecast for that day, or a nudge to set the exam date.
// [β2] + the next exam-day checklist item and when to take the next sealed form.
import { href } from '../../lib/router.ts';
import { useData } from '../../lib/store.tsx';
import { scaledScore } from '../../../shared/scoring.ts';
import { ForecastLegend, ForecastTrack } from './ForecastViz.tsx';
import { NextChecklistLine } from './ExamChecklist.tsx';
import { NextSealedLine, useSealedForms } from './SealedPanel.tsx';
import { daysLeftText, fmtDay, useProgress } from './useProgress.ts';
import type { ProgressResponse } from '../../../shared/types.ts';

function NextSteps({ p }: { p: ProgressResponse }) {
  const forms = useSealedForms(p);
  const lines = [<NextChecklistLine key="ck" items={p.checklist} />, <NextSealedLine key="sf" forms={forms} />];
  if (!p.checklist?.some((i) => !i.done) && !forms.some((f) => f.status === 'sealed')) return null;
  return <div className="lrn-next-list">{lines}</div>;
}

export function ExamCountdown() {
  const { meta } = useData();
  const { data: p } = useProgress();
  if (!meta || !p) return null; // older server without /api/progress → nothing
  const f = p.forecast;
  const target = p.goal.targetScaled ?? meta.exam.pass_scaled;
  if (!f) {
    return (
      <div className="card stack sm lrn-countdown">
        <div className="small muted">🎯 Ngày thi</div>
        <div className="small">Chưa đặt ngày thi. Đặt ngày để xem đếm ngược và dự báo điểm vào đúng ngày đó.</div>
        <a className="small" href={href('/stats?focus=exam')}>
          Đặt ngày thi →
        </a>
        <NextSteps p={p} />
      </div>
    );
  }
  const sched = scaledScore(f.onSchedule);
  const head = (
    <div className="row between nowrap">
      <span className="small muted">🎯 Thi ngày {fmtDay(f.examDate)}</span>
      <span className={`badge ${f.daysLeft < 0 ? 'warn' : 'accent'}`}>{daysLeftText(f.daysLeft)}</span>
    </div>
  );
  if (!f.seen) {
    return (
      <div className="card stack sm lrn-countdown">
        {head}
        <div className="small muted">Dự báo điểm cho ngày thi sẽ có ngay sau bài test đầu tiên.</div>
        <NextSteps p={p} />
      </div>
    );
  }
  return (
    <div className="card stack sm lrn-countdown">
      {head}
      <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
        <span className="ins-stat">{sched}</span>
        <span className="small muted">/ 1000 dự báo nếu ôn đúng lịch</span>
      </div>
      <ForecastTrack stop={f.ifStopNow} schedule={f.onSchedule} target={target / 10} />
      <ForecastLegend target={target / 10} targetLabel={`mục tiêu ${target}`} />
      <div className="small dim">
        Dừng học hôm nay: {scaledScore(f.ifStopNow)} · {sched >= target ? `✓ đang trên mục tiêu ${target}` : `thiếu ${target - sched} điểm so với mục tiêu`}
        {f.daysLeft > 0 && f.reviewsUntilExam ? ` · ~${Math.round((f.reviewsUntilExam / f.daysLeft) * 10) / 10} lượt ôn/ngày` : ''}
      </div>
      <NextSteps p={p} />
      <a className="small" href={href('/stats?focus=exam')}>
        Xem dự báo chi tiết →
      </a>
    </div>
  );
}
