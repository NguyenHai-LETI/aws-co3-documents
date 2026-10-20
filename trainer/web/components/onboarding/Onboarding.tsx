// [β2] First-day onboarding on the Dashboard (no result yet): ① exam goal + study budget → ② diagnostic test
// (2 questions per exam-guide task, or 2 × 14) → ③ "Bản đồ xuất phát" + week-1 plan on the diagnostic result
// (StartMap.tsx). Skippable — remembered in this browser; the wizard never shows once a result exists.
import { useMemo, useState } from 'react';
import { useData } from '../../lib/store.tsx';
import { startTest } from '../../lib/start.ts';
import { toast } from '../ui.tsx';
import { daysLeftText, fmtDay, postProgress, todayKey } from '../progress/useProgress.ts';
import { DIAGNOSTIC_FULL, DIAGNOSTIC_PART, DIAGNOSTIC_TITLE, dayNumber } from './rules.ts';
import type { ExamGoal } from '../../../shared/types.ts';

const SKIP_KEY = 'trainer.onboarding.skipped';
const GOAL_KEY = 'trainer.onboarding.goal'; // goal step finished in this browser
/** Suggested target: the bank-based forecast is optimistic, so aim above the 720 pass mark. */
export const SUGGESTED_TARGET = 780;
const MINUTE_CHOICES = [15, 30, 45, 60, 90];
/** Monday first, as Vietnamese calendars show it (values: 0 = Sunday … 6 = Saturday). */
const WEEK = [
  { d: 1, label: 'T2' },
  { d: 2, label: 'T3' },
  { d: 3, label: 'T4' },
  { d: 4, label: 'T5' },
  { d: 5, label: 'T6' },
  { d: 6, label: 'T7' },
  { d: 0, label: 'CN' },
];

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    // private window / blocked storage: the wizard simply shows again
  }
}

export const onboardingSkipped = () => readFlag(SKIP_KEY);
export const setOnboardingSkipped = (on: boolean) => writeFlag(SKIP_KEY, on);

/** The learner went through the goal step (on this or another machine — the goal file is synced). */
export const goalStarted = (g?: ExamGoal) =>
  !!g && (!!g.examDate || g.minutesPerDay !== undefined || !!g.studyTime || !!g.restDays?.length || g.esl !== undefined || !!g.delivery);

const pad = (n: number) => String(n).padStart(2, '0');
function addDaysKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const restDaysText = (days?: number[]) =>
  days?.length
    ? `nghỉ ${WEEK.filter((w) => days.includes(w.d))
        .map((w) => w.label)
        .join(', ')}`
    : 'học cả tuần';

// ── study budget fields (also used by Stats → 🎯 Ngày thi: "Lịch học") ───────

export interface StudyBudget {
  minutes: string;
  restDays: number[];
  studyTime: string;
}

export const budgetFromGoal = (g?: ExamGoal, defaults = false): StudyBudget => ({
  minutes: g?.minutesPerDay !== undefined ? String(g.minutesPerDay) : defaults ? '30' : '',
  restDays: g?.restDays ?? (defaults ? [0] : []),
  studyTime: g?.studyTime ?? '',
});

export const budgetPayload = (b: StudyBudget) => ({
  minutesPerDay: b.minutes.trim() ? Math.round(Number(b.minutes)) : null,
  restDays: b.restDays,
  studyTime: b.studyTime || null,
});

/** ≈ hours per week (and until the exam) for a daily budget and rest days. */
export function budgetText(b: StudyBudget, examDate?: string): string {
  const min = Number(b.minutes);
  if (!Number.isFinite(min) || min <= 0) return '';
  const perWeek = (min * (7 - b.restDays.length)) / 60;
  const parts = [`≈ ${Math.round(perWeek * 10) / 10} giờ/tuần`];
  if (examDate) {
    const days = dayNumber(examDate) - dayNumber(todayKey());
    if (days > 0) parts.push(`≈ ${Math.round((perWeek * days) / 7)} giờ tới ngày thi`);
  }
  return parts.join(' · ');
}

export function StudyBudgetFields({ value, onChange, idPrefix }: { value: StudyBudget; onChange: (b: StudyBudget) => void; idPrefix: string }) {
  const set = (patch: Partial<StudyBudget>) => onChange({ ...value, ...patch });
  return (
    <>
      <div className="lrn-field">
        <span className="tiny muted" id={`${idPrefix}-min`}>
          Mỗi ngày học (phút)
        </span>
        <div className="row lrn-chips" role="group" aria-labelledby={`${idPrefix}-min`}>
          {MINUTE_CHOICES.map((m) => (
            <button key={m} type="button" className={`chip ${Number(value.minutes) === m ? 'on' : ''}`} aria-pressed={Number(value.minutes) === m} onClick={() => set({ minutes: String(m) })}>
              {m}′
            </button>
          ))}
          <input
            type="number"
            inputMode="numeric"
            min={5}
            max={600}
            step={5}
            value={value.minutes}
            aria-label="Số phút mỗi ngày"
            placeholder="phút"
            className="lrn-num-sm"
            onChange={(e) => set({ minutes: e.target.value })}
          />
        </div>
      </div>
      <div className="lrn-field">
        <span className="tiny muted" id={`${idPrefix}-rest`}>
          Ngày nghỉ (không xếp phiên học)
        </span>
        <div className="row lrn-chips lrn-week" role="group" aria-labelledby={`${idPrefix}-rest`}>
          {WEEK.map((w) => {
            const on = value.restDays.includes(w.d);
            return (
              <button
                key={w.d}
                type="button"
                className={`chip ${on ? 'on' : ''}`}
                aria-pressed={on}
                title={on ? `${w.label}: nghỉ` : `${w.label}: học`}
                onClick={() => set({ restDays: on ? value.restDays.filter((x) => x !== w.d) : [...value.restDays, w.d].sort() })}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>
      <label className="lrn-field">
        <span className="tiny muted">Giờ học ưa thích</span>
        <input type="time" value={value.studyTime} onChange={(e) => set({ studyTime: e.target.value })} />
      </label>
    </>
  );
}

// ── step 1: goal ─────────────────────────────────────────────────────────────

function GoalStep({ goal, onSaved, onSkip }: { goal?: ExamGoal; onSaved: () => void; onSkip: () => void }) {
  const { meta } = useData();
  const pass = meta?.exam.pass_scaled ?? 720;
  const [date, setDate] = useState(goal?.examDate ?? '');
  const [noDate, setNoDate] = useState(!!goal && goalStarted(goal) && !goal.examDate);
  // the server reports the default (pass mark) when no target was saved: suggest a safer one
  const [target, setTarget] = useState(String(goal?.targetScaled && goal.targetScaled !== pass ? goal.targetScaled : SUGGESTED_TARGET));
  const [budget, setBudget] = useState<StudyBudget>(() => budgetFromGoal(goal, true));
  // new learner: ESL suggested (SAA-C03 has no Vietnamese version); editing a saved goal keeps the learner's choice
  const [esl, setEsl] = useState(goal && goalStarted(goal) ? !!goal.esl : true);
  const [busy, setBusy] = useState(false);
  const examDate = noDate ? undefined : date || undefined;
  const left = examDate ? dayNumber(examDate) - dayNumber(todayKey()) : undefined;
  const t = Number(target);
  const valid = (!!examDate || noDate) && Number.isFinite(t) && t >= 100 && t <= 1000 && Number(budget.minutes) >= 5;

  const save = async () => {
    setBusy(true);
    try {
      await postProgress('/api/goal', { examDate: examDate ?? null, targetScaled: Math.round(t), esl, ...budgetPayload(budget) });
      writeFlag(GOAL_KEY, true);
      toast('🎯 Đã lưu mục tiêu — tiếp theo: bài chẩn đoán.');
      onSaved();
    } catch (e) {
      toast(`Không lưu được: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void save();
      }}
    >
      <div className="lrn-onb-grid">
        <div className="lrn-field">
          <span className="tiny muted" id="onb-date">
            Ngày thi
          </span>
          <div className="row lrn-chips" role="group" aria-labelledby="onb-date">
            <input
              type="date"
              value={noDate ? '' : date}
              min={todayKey()}
              disabled={noDate}
              aria-label="Ngày thi"
              onChange={(e) => {
                setDate(e.target.value);
                setNoDate(false);
              }}
            />
            {[6, 8].map((w) => {
              const key = addDaysKey(w * 7);
              return (
                <button
                  key={w}
                  type="button"
                  className={`chip ${!noDate && date === key ? 'on' : ''}`}
                  title={`Thi ngày ${fmtDay(key)}`}
                  onClick={() => {
                    setDate(key);
                    setNoDate(false);
                  }}
                >
                  +{w} tuần
                </button>
              );
            })}
            <button type="button" className={`chip ${noDate ? 'on' : ''}`} aria-pressed={noDate} onClick={() => setNoDate((v) => !v)}>
              Chưa đặt lịch
            </button>
          </div>
          <span className="tiny muted">
            {noDate
              ? 'Gợi ý: ôn 6–8 tuần rồi đặt lịch. Đặt ngày sau ở Thống kê → 🎯 Ngày thi để có đếm ngược và dự báo.'
              : left !== undefined
                ? `${fmtDay(examDate)} · ${daysLeftText(left)}${left < 28 ? ' — khá gấp: ưu tiên phần trọng số cao' : ''}`
                : 'Chưa có lịch? Chọn “+6/+8 tuần” làm ngày dự kiến, đổi lại bất cứ lúc nào.'}
          </span>
        </div>
        <label className="lrn-field">
          <span className="tiny muted">Điểm mục tiêu /1000</span>
          <input type="number" inputMode="numeric" min={100} max={1000} step={10} value={target} className="lrn-num" onChange={(e) => setTarget(e.target.value)} />
          <span className="tiny muted">
            Gợi ý ≥ {SUGGESTED_TARGET}: điểm đỗ là {pass}, nhưng dự báo từ ngân hàng câu hỏi thường lạc quan hơn đề thật.
          </span>
        </label>
        <StudyBudgetFields value={budget} onChange={setBudget} idPrefix="onb" />
      </div>
      <label className="row lrn-check-line small">
        <input type="checkbox" checked={esl} onChange={(e) => setEsl(e.target.checked)} />
        <span>
          Thi bằng tiếng Anh với <b>ESL +30′</b> (130′ → 160′) — đề SAA-C03 không có tiếng Việt; nhớ xin trong tài khoản AWS Certification <b>trước khi đặt lịch</b>.
          Thi thử trong app dùng thời gian ESL.
        </span>
      </label>
      <div className="row between">
        <div className="small dim">{valid ? budgetText(budget, examDate) : !examDate && !noDate ? 'Chọn ngày thi (hoặc “Chưa đặt lịch”) để tiếp tục.' : 'Kiểm tra điểm mục tiêu (100–1000) và số phút mỗi ngày (≥ 5).'}</div>
        <div className="row">
          <button type="button" className="btn ghost" onClick={onSkip}>
            Bỏ qua hướng dẫn
          </button>
          <button className="btn primary" type="submit" disabled={busy || !valid}>
            Lưu & tiếp tục →
          </button>
        </div>
      </div>
    </form>
  );
}

// ── step 2: diagnostic ───────────────────────────────────────────────────────

function DiagnosticStep({ onEditGoal, onSkip }: { onEditGoal: () => void; onSkip: () => void }) {
  const { bank } = useData();
  // ≈ minutes for the diagnostic: mean estimated time of the eligible questions (active, classified, not held back)
  const perQuestion = useMemo(() => {
    const sealed = new Set(bank?.sealed ?? []);
    const qs = (bank?.questions ?? []).filter((q) => q.status === 'active' && q.task && !q.outOfScope && !sealed.has(q.id));
    return qs.length ? qs.reduce((s, q) => s + q.time, 0) / qs.length : 55;
  }, [bank]);
  const full = Math.max(1, Math.round((DIAGNOSTIC_FULL * perQuestion) / 60));
  const half = Math.max(1, Math.round((DIAGNOSTIC_PART * perQuestion) / 60));
  return (
    <div className="stack">
      <div className="small">
        <b>2 câu cho mỗi mục exam guide 1.1–4.4 ({DIAGNOSTIC_FULL} câu)</b>, ưu tiên câu bạn chưa gặp. Chấm cuối bài và <b>không xét đạt/chưa đạt</b> — mục đích là biết bạn
        đang ở đâu: làm sai ngay từ đầu rồi đọc giải thích vẫn giúp nhớ lâu hơn. Không biết thì cứ chọn phương án hợp lý nhất, đừng tra tài liệu.
      </div>
      <div className="row">
        <button className="btn primary" onClick={() => void startTest({ mode: 'diagnostic' })}>
          ▶ Làm bài chẩn đoán · {DIAGNOSTIC_FULL} câu (~{full}′)
        </button>
        <button className="btn" onClick={() => void startTest({ mode: 'diagnostic', count: DIAGNOSTIC_PART, title: `${DIAGNOSTIC_TITLE} · phần 1/2` })}>
          Chia 2 lần × {DIAGNOSTIC_PART} câu (~{half}′/lần)
        </button>
      </div>
      <div className="row between">
        <button type="button" className="btn ghost sm" onClick={onEditGoal}>
          ← Sửa mục tiêu
        </button>
        <button type="button" className="btn ghost sm" onClick={onSkip}>
          Bỏ qua hướng dẫn
        </button>
      </div>
    </div>
  );
}

// ── wizard ───────────────────────────────────────────────────────────────────

const STEPS = ['Mục tiêu', 'Bài chẩn đoán', 'Bản đồ xuất phát'];

export function Onboarding({ goal, onSkip }: { goal?: ExamGoal; onSkip: () => void }) {
  const { meta } = useData();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(() => readFlag(GOAL_KEY));
  const step = (goalStarted(goal) || saved) && !editing ? 1 : 0;
  const skip = () => {
    setOnboardingSkipped(true);
    onSkip();
  };
  const target = goal?.targetScaled ?? meta?.exam.pass_scaled;
  return (
    <section className="card pad-lg lrn-onb" aria-labelledby="onb-title">
      <h2 id="onb-title">🚀 Bắt đầu trong 3 bước</h2>
      <div className="small muted">Khoảng 5 phút thiết lập + một bài chẩn đoán ngắn — sau đó app tự lập kế hoạch tuần đầu, không cần AI.</div>
      <ol className="lrn-steps" aria-label="Các bước bắt đầu">
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step ? 'on' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="lrn-step-n">{i < step ? '✓' : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      {step === 0 ? (
        <GoalStep
          goal={goal}
          onSaved={() => {
            setSaved(true);
            setEditing(false);
          }}
          onSkip={skip}
        />
      ) : (
        <>
          <div className="lrn-onb-done small">
            <span>
              ✓ <b>Mục tiêu:</b> {goal?.examDate ? `thi ${fmtDay(goal.examDate)} (${daysLeftText(dayNumber(goal.examDate) - dayNumber(todayKey()))})` : 'chưa đặt ngày thi'} · {target}/1000
              {goal?.minutesPerDay ? ` · ${goal.minutesPerDay}′/ngày · ${restDaysText(goal.restDays)}` : ''}
              {goal?.esl ? ' · ESL +30′' : ''}
            </span>
          </div>
          <DiagnosticStep onEditGoal={() => setEditing(true)} onSkip={skip} />
        </>
      )}
      <div className="tiny muted lrn-onb-next">
        ③ Sau khi nộp bài chẩn đoán: <b>Bản đồ xuất phát</b> ✓ / ~ / ✗ theo 14 mục exam guide và nút <b>Lập kế hoạch tuần 1</b>.
      </div>
    </section>
  );
}
