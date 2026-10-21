// [β2] Exam-day checklist (B7): ESL +30, booking, ID name, reschedule deadline, OnVUE system test or test centre,
// rehearsal at the exam hour, after the exam. Items and due dates come from the server (relative to the exam date),
// ticks are saved in results/goal.md. On top, the booking details: ESL timing (goal.esl), delivery, exam time.
import { useEffect, useState } from 'react';
import { href } from '../../lib/router.ts';
import { Seg, toast } from '../ui.tsx';
import { dayNumber, dueIn, nextChecklistItem } from '../onboarding/rules.ts';
import { fmtDay, fmtDayShort, postProgress, todayKey } from './useProgress.ts';
import type { ChecklistItem, ExamGoal, ProgressResponse } from '../../../shared/types.ts';

type Delivery = NonNullable<ExamGoal['delivery']>;

const DELIVERY_HINT: Record<Delivery | '', string> = {
  online: 'OnVUE: chạy system test trên đúng máy và mạng sẽ thi, 1 màn hình, bàn trống, không được nghỉ giữa giờ, check-in sớm 30′.',
  center: 'Trung tâm thi: ít rủi ro mạng/máy; được nghỉ ngoài lịch nhưng đồng hồ vẫn chạy; giấy tờ phải khớp tên đăng ký.',
  '': 'Chọn hình thức thi để checklist hiện đúng việc cần làm.',
};

export function DueText({ item }: { item: ChecklistItem }) {
  if (item.done) return <span className="tiny good">✓ xong</span>;
  if (!item.due) return <span className="tiny muted">{item.dueText}</span>;
  return (
    <span className={`tiny ${item.overdue ? 'bad' : dayNumber(item.due) - dayNumber(todayKey()) <= 3 ? 'warn' : 'muted'}`} title={item.dueText}>
      {item.overdue ? '⚠ ' : ''}hạn {fmtDayShort(item.due)} · {dueIn(item.due)}
    </span>
  );
}

async function saveGoal(body: Record<string, unknown>, done?: string): Promise<boolean> {
  try {
    await postProgress('/api/goal', body);
    if (done) toast(done);
    return true;
  } catch (e) {
    toast(`Không lưu được: ${(e as Error).message}`);
    return false;
  }
}

function BookingFields({ goal }: { goal: ExamGoal }) {
  const [time, setTime] = useState(goal.examTime ?? '');
  useEffect(() => setTime(goal.examTime ?? ''), [goal.examTime]);
  const delivery: Delivery | '' = goal.delivery ?? '';
  return (
    <div className="stack sm lrn-booking">
      <label className="row lrn-check-line small">
        <input type="checkbox" checked={!!goal.esl} onChange={(e) => void saveGoal({ esl: e.target.checked }, e.target.checked ? '⏱ Thi thử dùng thời gian ESL (+30′).' : 'Đã tắt thời gian ESL.')} />
        <span>
          Thi bằng tiếng Anh với <b>ESL +30′</b> (130′ → 160′) — thi thử trong app dùng thời gian ESL
        </span>
      </label>
      <div className="row lrn-booking-row">
        <Seg<Delivery | ''>
          value={delivery}
          onChange={(v) => v && v !== delivery && void saveGoal({ delivery: v }, v === 'online' ? '💻 Thi online (OnVUE).' : '🏢 Thi ở trung tâm.')}
          items={[
            { id: 'online', label: '💻 Online (OnVUE)', title: 'Thi tại nhà qua Pearson VUE OnVUE' },
            { id: 'center', label: '🏢 Trung tâm thi', title: 'Thi tại trung tâm khảo thí Pearson VUE' },
          ]}
        />
        <label className="row nowrap small" style={{ gap: 6 }}>
          <span className="muted">Giờ thi</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => time !== (goal.examTime ?? '') && void saveGoal({ examTime: time || null }, time ? `🕘 Giờ thi ${time} — tổng duyệt vào đúng giờ này.` : 'Đã bỏ giờ thi.')}
          />
        </label>
      </div>
      <div className="tiny muted">{DELIVERY_HINT[delivery]}</div>
    </div>
  );
}

export function ExamChecklist({ progress }: { progress: ProgressResponse }) {
  const items = progress.checklist;
  const [busy, setBusy] = useState<string>();
  if (!items) return null; // older server: no checklist
  const goal = progress.goal;
  const done = items.filter((i) => i.done).length;
  const toggle = async (it: ChecklistItem) => {
    setBusy(it.id);
    // "đã xin ESL +30" ticked → practise with the ESL clock too
    const body: Record<string, unknown> = { checklist: { [it.id]: !it.done } };
    if (it.id === 'esl' && !it.done && !goal.esl) body.esl = true;
    await saveGoal(body);
    setBusy(undefined);
  };
  return (
    <div className="card stack" id="exam-checklist">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>✅ Checklist ngày thi</h2>
          <div className="small muted" style={{ marginTop: 2 }}>
            {goal.examDate ? `Hạn tính theo ngày thi ${fmtDay(goal.examDate)}` : 'Đặt ngày thi để có hạn cụ thể cho từng việc'}
          </div>
        </div>
        <span className={`badge ${done === items.length ? 'good' : ''}`}>
          {done === items.length ? '✓ ' : ''}
          {done}/{items.length} xong
        </span>
      </div>
      <BookingFields goal={goal} />
      <div className="lrn-ck-list" role="list">
        {items.map((it) => (
          <div key={it.id} role="listitem" className={`lrn-ck-item ${it.done ? 'done' : ''}`}>
            <input type="checkbox" id={`ck-${it.id}`} checked={it.done} disabled={busy === it.id} onChange={() => void toggle(it)} />
            <label htmlFor={`ck-${it.id}`} className="lrn-ck-main">
              <span className="small">{it.label}</span>
              {it.hint && <span className="tiny muted">{it.hint}</span>}
            </label>
            <div className="lrn-ck-side">
              <DueText item={it} />
              {it.link && (
                <a className="tiny" href={it.link} target="_blank" rel="noreferrer" title="Trang chính sách chính thức">
                  chính thức ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="tiny muted">
        Chính sách của AWS / Pearson VUE có thể thay đổi — luôn đối chiếu trang chính thức{progress.checklistChecked ? ` (app kiểm tra ngày ${fmtDay(progress.checklistChecked)})` : ''}.
      </div>
    </div>
  );
}

/** Dashboard line: the next checklist item (with its due date), linking to the full checklist. */
export function NextChecklistLine({ items }: { items?: ChecklistItem[] }) {
  const it = nextChecklistItem(items);
  if (!it) return null;
  return (
    <a className="lrn-next small" href={href('/stats?focus=checklist')} title="Mở checklist ngày thi">
      <span aria-hidden>☑</span>
      <span className="lrn-next-main">
        <span className="lrn-next-label">{it.label}</span> <DueText item={it} />
      </span>
    </a>
  );
}
