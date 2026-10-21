// [μ v5] "▶ Học hôm nay" (Design C1): one primary action that fills a minute budget. GET /api/today previews the
// deterministic mix for the default budget (goal.minutesPerDay, else practice.today_minutes) or a chip (5 / 10 / 25 / 45
// + the learner's own; the light phase caps at 30′). A fresh AI-coach session (mix.coach) is offered first. Under it:
// today's progress ("Đã đạt mục tiêu hôm nay ✓" + "Thêm 10 câu"), the new-question line and the catch-up advice.
// `TodayAfter` is the Result page's line after a today session. A server without /api/today renders nothing (the
// Dashboard then keeps its v4 action cards unfolded).
import { useState } from 'react';
import { useFetch } from '../../lib/store.tsx';
import { startTest } from '../../lib/start.ts';
import { Meter } from '../charts.tsx';
import { EXTRA_MINUTES, budgetOptions, catchUpLine, mixParts, newQuotaLine, parseSessionRef, todayProgress } from './rules.ts';
import type { Plan, PlanSummary, ProgressResponse, TodayPreview } from '../../../shared/types.ts';

/** The default-budget preview (`base`) and, when a chip asks for another budget, that preview. */
export function useToday(minutes?: number) {
  const base = useFetch<TodayPreview>('/api/today');
  const want = minutes !== undefined && base.data && minutes !== base.data.minutes ? `/api/today?minutes=${minutes}` : null;
  const chosen = useFetch<TodayPreview>(want, [], { keep: true });
  return {
    base: base.data,
    preview: (want ? chosen.data : undefined) ?? base.data,
    switching: !!want && chosen.loading,
    unavailable: !base.data && !!base.error, // 404 on an older server, or an error: fall back to the v4 cards
  };
}

/** Session title + size of a plan session ("<plan>#<session>"), from the plan list or fetched by id. */
function useSession(ref: string | undefined, plans: PlanSummary[] | undefined): { title: string; count?: number } | undefined {
  const parsed = parseSessionRef(ref);
  const listed = parsed ? plans?.find((p) => p.id === parsed.plan) : undefined;
  const { data: fetched } = useFetch<Plan>(parsed && plans && !listed ? `/api/plans/${encodeURIComponent(parsed.plan)}` : null);
  if (!parsed) return undefined;
  const s = (listed ?? fetched)?.sessions.find((x) => x.id === parsed.session);
  return { title: s?.title ?? 'Phiên AI Coach', count: s ? (s.questions?.length ?? s.filter?.count) : undefined };
}

async function startToday(budgetMinutes: number | undefined, setBusy: (b: boolean) => void) {
  setBusy(true);
  try {
    await startTest({ mode: 'today', ...(budgetMinutes ? { budgetMinutes } : {}) });
  } finally {
    setBusy(false);
  }
}

export function TodayHero({ counts, progress, plans, className = '' }: { counts: Record<string, number>; progress?: ProgressResponse; plans?: PlanSummary[]; className?: string }) {
  const [minutes, setMinutes] = useState<number>();
  const [busy, setBusy] = useState(false);
  const t = useToday(minutes);
  const p = t.preview;
  const coach = useSession(p?.mix?.coach, plans);
  if (t.unavailable) return null;

  const goal = t.base?.minutes ?? 25;
  const chips = budgetOptions(goal, progress?.phase?.maxMinutes);
  const selected = p?.minutes ?? goal;
  const prog = todayProgress(t.base?.done, goal);
  const parts = p ? mixParts(p) : [];
  const catchUp = catchUpLine(progress?.catchUp);
  // the backlog reason once: the catch-up line says it when present, so the paused quota only names the pause
  const quotaInfo = progress?.newQuota && catchUp && progress.newQuota.paused ? { ...progress.newQuota, paused: 'ôn bớt tồn đọng trước (xem dưới)' } : progress?.newQuota;
  const quota = newQuotaLine(quotaInfo, counts.srs ?? 0);
  const note = p?.note && p.note !== progress?.newQuota?.paused && !(catchUp && /tồn/.test(p.note)) ? p.note : undefined;
  const catchUpCount = Math.min(counts.srs ?? 0, progress?.catchUp?.perDay ?? 0);

  return (
    <section className={`card lrn-today ${className}`} aria-labelledby="lrn-today-title" aria-busy={!p || t.switching}>
      <div className="lrn-today-head">
        <h2 id="lrn-today-title">▶ Học hôm nay</h2>
        <div className="row lrn-today-chips" role="radiogroup" aria-label="Thời lượng phiên (phút)">
          {chips.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={m === selected}
              className={`chip ${m === selected ? 'on' : ''}`}
              title={m === goal ? `${m} phút — mục tiêu mỗi ngày của bạn` : `${m} phút`}
              onClick={() => setMinutes(m)}
            >
              {m}′{m === goal ? ' 🎯' : ''}
            </button>
          ))}
        </div>
      </div>

      {!p ? (
        <div className="small muted lrn-today-wait">Đang ghép phiên hôm nay…</div>
      ) : (
        <div className="stack sm" style={{ opacity: t.switching ? 0.6 : 1 }}>
          {prog.met && (
            <div className="lrn-today-met">
              ✓ <b>Đã đạt mục tiêu hôm nay</b>
              <span className="muted"> · {prog.text.replace(/^Hôm nay đã học /, '')}</span>
            </div>
          )}
          <div className="lrn-today-figure">
            <b className="num">
              {p.minutes}′ · {p.count} câu
            </b>
            {parts.length > 0 && <span className="dim"> ({parts.join(' · ')})</span>}
          </div>
          {coach && (
            <div className="lrn-today-coach">
              <span>
                🤖 Phiên AI Coach còn mới: <b>{coach.title}</b>
                {coach.count ? <span className="muted"> · {coach.count} câu</span> : null} — nên làm trước.
              </span>
              <button className="btn primary sm" disabled={busy} onClick={() => p.mix.coach && void startTest({ mode: 'coach', plan: p.mix.coach })}>
                Làm phiên này
              </button>
            </div>
          )}
          <div className="row lrn-today-actions">
            {prog.met ? (
              <>
                <button className="btn primary" disabled={busy} onClick={() => void startToday(EXTRA_MINUTES, setBusy)} title={`Thêm một phiên hôm nay ~${EXTRA_MINUTES} phút`}>
                  ＋ Thêm {EXTRA_MINUTES} câu
                </button>
                {p.count > 0 && (
                  <button className="btn" disabled={busy} onClick={() => void startToday(p.minutes, setBusy)}>
                    ▶ Học thêm {p.minutes}′
                  </button>
                )}
              </>
            ) : (
              <button className={`btn lg ${coach ? '' : 'primary'}`} disabled={busy || !p.count} onClick={() => void startToday(p.minutes, setBusy)}>
                ▶ Bắt đầu · {p.minutes}′
              </button>
            )}
            {!prog.met && (
              <div className="lrn-today-progress" title="Thời gian đã học hôm nay so với mục tiêu mỗi ngày">
                <Meter value={prog.pct} label="Tiến độ hôm nay" />
                <span className="tiny muted">{prog.text}</span>
              </div>
            )}
          </div>
          {!p.count && <div className="small muted">Không còn câu nào hợp với phiên này — thử thời lượng khác, hoặc chọn bên dưới.</div>}
          {note && <div className="tiny muted">ℹ️ {note}</div>}
        </div>
      )}

      {(quota || catchUp) && (
        <div className="lrn-today-foot">
          {quota && <div className={`small ${quota.paused ? 'warn' : 'dim'}`}>🆕 {quota.text}</div>}
          {catchUp && (
            <div className="small warn lrn-today-catchup">
              <span>📥 {catchUp}</span>
              {catchUpCount > 0 && (
                <button className="btn sm" onClick={() => void startTest({ mode: 'srs', count: catchUpCount })}>
                  Ôn {catchUpCount} câu
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Result page of a today session: goal met → "✓ Đã đạt mục tiêu hôm nay" + "Thêm 10 câu"; otherwise the rest of today's budget. */
export function TodayAfter() {
  const t = useToday();
  const [busy, setBusy] = useState(false);
  const p = t.base;
  if (!p) return null;
  const prog = todayProgress(p.done, p.minutes);
  const left = Math.max(5, Math.ceil(p.minutes - (p.done?.minutes ?? 0)));
  return (
    <div className={`ins-wrap alert ${prog.met ? 'good' : 'info'} lrn-today-after`}>
      <span>{prog.met ? <><b>✓ Đã đạt mục tiêu hôm nay</b> — {prog.text.replace(/^Hôm nay đã học /, '')}.</> : <>{prog.text} — còn khoảng {left}′.</>}</span>
      {p.count > 0 && (
        <button className="btn primary sm" disabled={busy} onClick={() => void startToday(prog.met ? EXTRA_MINUTES : left, setBusy)}>
          {prog.met ? `＋ Thêm ${EXTRA_MINUTES} câu` : `▶ Học tiếp ${left}′`}
        </button>
      )}
    </div>
  );
}
