// [μ v5] Dashboard banner of the exam phase (Design C2): PHASE_INFO title + description, the server's rules for the
// phase (ExamPhaseInfo.rules), its span, and from T−14 the sprint / final-week plan (POST /api/plan/sprint: deterministic
// and idempotent per day; the plan then shows in the plan card, where "Bắt đầu" works unchanged).
import { useState } from 'react';
import { api } from '../../lib/api.ts';
import { href } from '../../lib/router.ts';
import { toast } from '../ui.tsx';
import { phaseSpan, sprintOffered } from '../learning/rules.ts';
import { localKey } from '../onboarding/rules.ts';
import { PHASE_INFO } from '../../../shared/labels.ts';
import type { ExamPhaseInfo, PlanSummary } from '../../../shared/types.ts';

/** Today's sprint plan already exists (plan.trigger 'sprint', created today). */
export const sprintToday = (plan: PlanSummary | undefined) => !!plan && plan.trigger === 'sprint' && localKey(new Date(plan.created)) === localKey();

export function PhaseBanner({ phase, plan, onPlan }: { phase: ExamPhaseInfo; plan?: PlanSummary; onPlan?: () => void }) {
  const [busy, setBusy] = useState(false);
  const info = PHASE_INFO[phase.id];
  const offer = sprintOffered(phase.daysLeft);
  const hasSprint = sprintToday(plan);
  const sprint = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ plan?: PlanSummary; created?: boolean }>('/api/plan/sprint', {});
      const n = r.plan?.sessions.length;
      toast(r.created ? `🏁 Đã lập kế hoạch nước rút${n ? ` (${n} phiên)` : ''} — xem ở thẻ kế hoạch bên dưới.` : '🏁 Kế hoạch nước rút hôm nay đã có — xem ở thẻ kế hoạch bên dưới.');
      onPlan?.();
    } catch (e) {
      toast(`Không lập được kế hoạch nước rút: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={`card lrn-phase ${phase.id === 'build' ? 'quiet' : ''}`} aria-label="Giai đoạn ôn thi">
      <div className="lrn-phase-head">
        <b className="lrn-phase-title">
          {info?.icon ?? '🎯'} Giai đoạn: {phase.label || info?.label || phase.id}
        </b>
        <span className="badge accent">{phaseSpan(phase)}</span>
        {offer &&
          (hasSprint ? (
            <span className="small good">✓ Đã có kế hoạch nước rút hôm nay</span>
          ) : (
            <button className="btn sm primary" disabled={busy} onClick={() => void sprint()} title="Tự lập (không dùng AI) kế hoạch các ngày còn lại theo định dạng kế hoạch của AI Coach">
              {busy ? 'Đang lập…' : phase.daysLeft <= 7 ? '🏁 Lập kế hoạch tuần cuối' : '🏁 Lập kế hoạch nước rút'}
            </button>
          ))}
      </div>
      {info?.desc && <div className="small dim">{info.desc}</div>}
      {phase.rules.length > 0 && (
        <ul className="lrn-phase-rules small">
          {phase.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {phase.id === 'after' && (
        <a className="small" href={href('/stats?focus=exam')}>
          Cập nhật ngày thi →
        </a>
      )}
    </section>
  );
}
