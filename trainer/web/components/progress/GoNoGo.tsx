// [μ v5] Stats → 🎯 Ngày thi: "Thi hay dời?" from 14 days before the exam (λ's GoNoGo — advice, never a decision): the
// three checks (two fresh scores ≥ 80 %, calibrated readiness ≥ target, no domain forecast < 65 %) with ✓ / ✗ / ?, the
// verdict, the last moment to reschedule and AWS's rules.
import { checkGlyph, deadlineText, goNoGoBadge } from '../learning/rules.ts';
import type { GoNoGo } from '../../../shared/types.ts';

export function GoNoGoCard({ g }: { g: GoNoGo }) {
  const badge = goNoGoBadge(g.verdict);
  const deadline = deadlineText(g.deadline);
  return (
    <div className="card stack sm" id="exam-gonogo">
      <div className="row between">
        <h2 style={{ margin: 0 }}>🧭 Thi hay dời?</h2>
        <span className={`badge ${badge.cls}`}>{badge.text}</span>
      </div>
      <ul className="lrn-gonogo-checks small">
        {g.checks.map((c) => (
          <li key={c.id}>
            <span className={`lrn-check ${c.ok === true ? 'ok' : c.ok === false ? 'no' : ''}`} aria-label={c.ok === true ? 'đạt' : c.ok === false ? 'chưa đạt' : 'chưa đủ dữ liệu'}>
              {checkGlyph(c.ok)}
            </span>
            <span>
              <b>{c.label}</b> <span className="dim">— {c.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {g.note && <div className="small dim">{g.note}</div>}
      {deadline && (
        <div className="small">
          ⏰ Hạn chót để dời lịch: <b>{deadline}</b>
        </div>
      )}
      {!/24 giờ/.test(g.note ?? '') && (
      <div className="tiny muted">
        Chỉ là lời khuyên dựa trên dữ liệu của bạn. Quy định AWS: dời hoặc huỷ lịch chậm nhất 24 giờ trước giờ thi, mỗi lịch dời tối đa 2 lần; nếu trượt phải chờ 14
        ngày mới thi lại và trả lại toàn bộ lệ phí.
      </div>
      )}
    </div>
  );
}
