// [L] Stats → "🎯 Ngày thi & dự báo": exam date + target score (+ study budget), the forecast for the exam day (if study
// stops now / if due reviews are done on time), per-domain forecast, review workload until the exam, [β2] the exam-day
// checklist and the sealed forms, external practice-exam scores (+ sealed calibration points) with the calibration.
import { useEffect, useState } from 'react';
import { useData } from '../../lib/store.tsx';
import { KvRow, passTone } from '../insights.tsx';
import { toast } from '../ui.tsx';
import { scaledScore } from '../../../shared/scoring.ts';
import { ForecastDomains, ForecastLegend, ForecastTrack } from './ForecastViz.tsx';
import { WorkloadChart } from './Workload.tsx';
import { ExternalScores } from './ExternalScores.tsx';
import { ExamChecklist } from './ExamChecklist.tsx';
import { SealedPanel } from './SealedPanel.tsx';
import { GoNoGoCard } from './GoNoGo.tsx';
import { capacityRows } from '../learning/rules.ts';
import { StudyBudgetFields, budgetFromGoal, budgetPayload, budgetText, restDaysText, type StudyBudget } from '../onboarding/Onboarding.tsx';
import { daysLeftText, fmtDay, postProgress, todayKey } from './useProgress.ts';
import type { ExamForecast, ExamGoal, ProgressResponse } from '../../../shared/types.ts';

/** [β2] Daily study budget (minutes, rest days, preferred time) — set during onboarding, edited here. */
function BudgetForm({ goal }: { goal: ExamGoal }) {
  const [b, setB] = useState<StudyBudget>(() => budgetFromGoal(goal));
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify([goal.minutesPerDay, goal.restDays, goal.studyTime]);
  useEffect(() => setB(budgetFromGoal(goal)), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(budgetPayload(b)) !== JSON.stringify(budgetPayload(budgetFromGoal(goal)));
  const summary = goal.minutesPerDay ? `${goal.minutesPerDay}′/ngày · ${restDaysText(goal.restDays)}${goal.studyTime ? ` · ${goal.studyTime}` : ''}` : 'chưa đặt';
  const save = async () => {
    setBusy(true);
    try {
      await postProgress('/api/goal', budgetPayload(b));
      toast('⏱ Đã lưu lịch học.');
    } catch (e) {
      toast(`Không lưu được: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="lrn-budget">
      <summary className="small">
        ⏱ Lịch học: <b>{summary}</b>
      </summary>
      <form
        className="stack sm lrn-budget-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <StudyBudgetFields value={b} onChange={setB} idPrefix="goal" />
        <div className="row between">
          <span className="tiny muted">{budgetText(b, goal.examDate)}</span>
          <button className="btn primary sm" type="submit" disabled={busy || !dirty || (!!b.minutes.trim() && Number(b.minutes) < 5)}>
            Lưu lịch học
          </button>
        </div>
      </form>
    </details>
  );
}

function GoalForm({ goal, passScaled }: { goal: ExamGoal; passScaled: number }) {
  const [date, setDate] = useState(goal.examDate ?? '');
  const [target, setTarget] = useState(String(goal.targetScaled ?? passScaled));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setDate(goal.examDate ?? '');
    setTarget(String(goal.targetScaled ?? passScaled));
  }, [goal.examDate, goal.targetScaled, passScaled]);
  const dirty = date !== (goal.examDate ?? '') || Number(target) !== (goal.targetScaled ?? passScaled);
  const save = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      await postProgress('/api/goal', body);
      toast(done);
    } catch (e) {
      toast(`Không lưu được: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="lrn-goal-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ examDate: date || null, targetScaled: target.trim() ? Number(target) : null }, '🎯 Đã lưu mục tiêu thi.');
      }}
    >
      <label>
        <span className="tiny muted">Ngày thi</span>
        <input type="date" value={date} min={todayKey()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label>
        <span className="tiny muted">Điểm mục tiêu /1000</span>
        <input type="number" inputMode="numeric" min={100} max={1000} step={10} value={target} onChange={(e) => setTarget(e.target.value)} />
      </label>
      <div className="row lrn-goal-actions">
        <button className="btn primary sm" type="submit" disabled={busy || !dirty}>
          Lưu
        </button>
        {goal.examDate && (
          <button className="btn ghost sm" type="button" disabled={busy} onClick={() => void save({ examDate: null }, 'Đã bỏ ngày thi.')}>
            Bỏ ngày thi
          </button>
        )}
      </div>
    </form>
  );
}

function ForecastSummary({ f, targetScaled, passScaled, goalMinutes }: { f: ExamForecast; targetScaled: number; passScaled: number; goalMinutes?: number }) {
  const caps = capacityRows(f, goalMinutes); // [μ v5] capacity-constrained forecast
  const sched = scaledScore(f.onSchedule);
  const stop = scaledScore(f.ifStopNow);
  const gap = targetScaled - sched;
  const tone = passTone(gap <= 0 ? 1 : sched >= passScaled ? 0.6 : 0);
  const perDay = f.daysLeft > 0 && f.reviewsUntilExam ? Math.round((f.reviewsUntilExam / f.daysLeft) * 10) / 10 : undefined;
  return (
    <div className="stack sm">
      <div className="small muted">Dự báo điểm vào ngày thi ({fmtDay(f.examDate)})</div>
      <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
        <span className="ins-stat lg">{sched}</span>
        <span className="muted">/ 1000 nếu ôn đúng lịch</span>
        <span className={`badge ${tone.cls}`} title={`Mục tiêu ${targetScaled}/1000`}>
          {tone.icon} {gap <= 0 ? `đạt mục tiêu ${targetScaled}` : `thiếu ${gap} điểm so với mục tiêu`}
        </span>
      </div>
      <ForecastTrack stop={f.ifStopNow} schedule={f.onSchedule} target={targetScaled / 10} />
      <ForecastLegend target={targetScaled / 10} targetLabel={`mục tiêu ${targetScaled}`} />
      <div className="small dim">
        Nếu dừng học hôm nay: <b className="num">{stop}</b>/1000 ({f.ifStopNow}%) · ôn đúng lịch: {f.onSchedule}%
      </div>
      <div className="stack sm small">
        <KvRow k="Độ phủ ngân hàng" title="Câu đã gặp ít nhất 1 lần / câu đang dùng">
          {f.coverage}%{f.active ? ` (${f.seen ?? 0}/${f.active})` : ''}
        </KvRow>
        {f.firstTry !== undefined && (
          <KvRow k="Đúng ngay lần đầu" title="Ước tính cho các câu bạn chưa làm (Laplace)">
            {f.firstTry}%
          </KvRow>
        )}
        {f.reviewsUntilExam !== undefined && f.daysLeft > 0 && (
          <KvRow k="Lượt ôn tới ngày thi" title="Số lần ôn đến hạn nếu theo đúng lịch FSRS (mỗi câu đã gặp)">
            {f.reviewsUntilExam}
            {perDay !== undefined ? ` (~${perDay}/ngày)` : ''}
          </KvRow>
        )}
      </div>
      {(f.examAware !== undefined || caps.length > 0) && (
        <div className="stack sm small lrn-forecast-more">
          {f.examAware !== undefined && (
            <KvRow k="Theo lịch bám ngày thi" title="Có ôn chốt trước ngày thi và hạn mức câu mới mỗi ngày (srs.exam_aware)">
              {scaledScore(f.examAware)}/1000 ({f.examAware}%)
            </KvRow>
          )}
          {caps.length > 0 && (
            <div>
              <div className="muted">Nếu mỗi ngày chỉ học:</div>
              <div className="lrn-cap-rows">
                {caps.map((c) => (
                  <span key={c.minutes} className={c.goal ? 'good' : ''} title={`~${c.reviewsPerDay} lượt ôn/ngày`}>
                    {c.minutes}′ → <b className="num">{c.scaled}</b>
                    {c.goal ? ' 🎯' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {f.note && <div className="tiny muted">ℹ️ {f.note}</div>}
    </div>
  );
}

export function ExamSection({ progress, readiness }: { progress: ProgressResponse; readiness?: number }) {
  const { meta } = useData();
  if (!meta) return null;
  const { goal, forecast } = progress;
  const passScaled = meta.exam.pass_scaled;
  const targetScaled = goal.targetScaled ?? passScaled;
  return (
    <section id="exam-goal" className="lrn-section">
      <h2 className="ins-section-title">🎯 Ngày thi & dự báo</h2>
      <div className="split-l">
        <div className="card stack">
          <div className="row between">
            <b>Mục tiêu</b>
            {forecast && <span className={`badge ${forecast.daysLeft < 0 ? 'warn' : 'accent'}`}>{daysLeftText(forecast.daysLeft)}</span>}
          </div>
          <GoalForm goal={goal} passScaled={passScaled} />
          <BudgetForm goal={goal} />
          {forecast && !forecast.seen ? (
            <div className="small muted">Chưa làm câu nào — dự báo điểm cho ngày {fmtDay(forecast.examDate)} sẽ có ngay sau bài test đầu tiên.</div>
          ) : forecast ? (
            <ForecastSummary f={forecast} targetScaled={targetScaled} passScaled={passScaled} goalMinutes={goal.minutesPerDay} />
          ) : (
            <div className="small muted">
              Đặt ngày thi để xem đếm ngược, dự báo điểm vào đúng ngày đó (nếu dừng học hôm nay / nếu ôn đúng lịch) và số lượt ôn cần làm tới ngày thi.
            </div>
          )}
        </div>
        <div className="stack">
          {forecast && !!forecast.seen && <ForecastDomains forecast={forecast} domains={meta.domains} passPct={meta.exam.pass_pct} />}
          <WorkloadChart days={progress.workload} dailyLimit={meta.srs.daily_limit} examDate={goal.examDate} />
        </div>
      </div>
      {progress.goNoGo && (
        <div className="lrn-gap">
          <GoNoGoCard g={progress.goNoGo} />
        </div>
      )}
      <div className="grid c2 lrn-gap lrn-align-start">
        <ExamChecklist progress={progress} />
        <SealedPanel progress={progress} />
      </div>
      <div className="lrn-gap">
        <ExternalScores scores={progress.external} calibration={progress.externalCalibration} readiness={readiness} />
      </div>
      <div className="tiny muted lrn-method">
        Cách tính: câu đã gặp → xác suất còn nhớ (FSRS-6) vào ngày thi; “ôn đúng lịch” = mọi lượt ôn đến hạn trước ngày thi được làm đúng hạn và trả lời đúng (cận
        trên). Câu chưa gặp → tỉ lệ đúng ngay lần đầu của bạn theo domain. Gộp theo trọng số đề {meta.domains.map((d) => `${d.code} ${d.weight}%`).join(' · ')}. Dự báo
        đo khả năng nhớ câu trong ngân hàng — đề thật có câu mới, nên hãy đối chiếu với điểm thi thử bên ngoài. Điểm /1000 là quy đổi xấp xỉ (AWS không công bố thang
        điểm).
      </div>
    </section>
  );
}
