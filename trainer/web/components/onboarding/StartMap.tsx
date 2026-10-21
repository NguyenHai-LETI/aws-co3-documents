// [β2] "Bản đồ xuất phát": the diagnostic result as a starting point, not a pass/fail — per exam-guide task ✓ / ~ / ✗
// (status colour always with its glyph and the n/m label), a per-domain summary, the tasks to fix first, then the
// deterministic week-1 plan (POST /api/onboarding/plan) or the second half of a split diagnostic. Both halves of a
// 2 × 14 diagnostic are merged.
import { useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import { useData, useFetch } from '../../lib/store.tsx';
import { href, navigate } from '../../lib/router.ts';
import { startTest } from '../../lib/start.ts';
import { ChartCard } from '../charts.tsx';
import { pctOf } from '../insights.tsx';
import { toast } from '../ui.tsx';
import { DIAGNOSTIC_PART, DIAGNOSTIC_TITLE, dayNumber, fixFirst, isDiagnosticPart, taskCells, type TaskStatus as Status } from './rules.ts';
import type { AnswerRecord, Attempt, OnboardingPlanResponse, PlansResponse, Question, ResultsPage } from '../../../shared/types.ts';

interface Row {
  r: AnswerRecord;
  q: Question | null;
}

export const STATUS_INFO: Record<Status, { glyph: string; label: string; cls: string }> = {
  ok: { glyph: '✓', label: 'đúng hết', cls: 'ok' },
  partial: { glyph: '~', label: 'đúng một phần', cls: 'partial' },
  weak: { glyph: '✗', label: 'sai hết', cls: 'weak' },
  untested: { glyph: '–', label: 'chưa làm', cls: 'untested' },
};

const shortLabel = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '');

export function StatusChip({ status }: { status: Status }) {
  const s = STATUS_INFO[status];
  return (
    <span className={`lrn-st ${s.cls}`} aria-label={s.label} title={s.label}>
      {s.glyph}
    </span>
  );
}

export function StartMap({ attempt, questions }: { attempt: Attempt; questions: (Question | null)[] }) {
  const { meta, refresh } = useData();
  const part = isDiagnosticPart(attempt);
  // the other half of a split diagnostic (closest in time, within a week)
  const { data: list } = useFetch<ResultsPage>(part ? '/api/results?mode=diagnostic&limit=10' : null);
  const other = useMemo(() => {
    const day = dayNumber(attempt.finished);
    return (list?.items ?? [])
      .filter((x) => x.id !== attempt.id && isDiagnosticPart(x) && Math.abs(dayNumber(x.finished) - day) <= 7)
      .sort((a, b) => Math.abs(dayNumber(a.finished) - day) - Math.abs(dayNumber(b.finished) - day))[0];
  }, [list, attempt.id, attempt.finished]);
  const { data: otherData } = useFetch<{ attempt: Attempt; questions: (Question | null)[] }>(other ? `/api/results/${encodeURIComponent(other.id)}` : null);
  const { data: plans } = useFetch<PlansResponse>('/api/plans?limit=1');
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const own: Row[] = attempt.answers.map((r, i) => ({ r, q: questions[i] ?? null }));
    if (!otherData) return own;
    return [...own, ...otherData.attempt.answers.map((r, i) => ({ r, q: otherData.questions[i] ?? null }))];
  }, [attempt, questions, otherData]);
  if (!meta) return null;
  const grid = taskCells(rows, meta.tasks ?? []);
  const merged = !!otherData;
  // a lone "phần 2/2" (its first half older than a week) must not offer the second half again
  const half2 = /phần 2\/2/.test(attempt.title);
  const ctaReady = !part || list !== undefined; // no flash of the wrong next step while the halves load
  const secondHalfMissing = part && !other && list !== undefined && !half2;
  const counted = grid.reduce((s, c) => s + c.answers, 0);
  const right = grid.reduce((s, c) => s + c.correct, 0);
  const toFix = fixFirst(grid, (domain) => meta.domains.find((d) => d.id === domain)?.weight ?? 0);
  const plan = plans?.plans[0];
  // an onboarding plan written after this attempt (a plan from half 1 is offered again once half 2 is done)
  const planReady = plan?.trigger === 'onboarding' && new Date(plan.created).getTime() >= new Date(attempt.finished).getTime();

  const makePlan = async () => {
    setBusy(true);
    try {
      const r = await api.post<OnboardingPlanResponse>('/api/onboarding/plan', { attemptId: attempt.id });
      toast(r.created ? `🗓️ Đã lập kế hoạch tuần 1 (${r.plan.sessions.length} phiên) — xem ở Tổng quan.` : '🗓️ Kế hoạch tuần 1 hôm nay đã có — mở Tổng quan.');
      await refresh();
      navigate('/');
    } catch (e) {
      toast(`Không lập được kế hoạch: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const startSecondHalf = () => void startTest({ mode: 'diagnostic', count: DIAGNOSTIC_PART, title: `${DIAGNOSTIC_TITLE} · phần 2/2` });

  return (
    <ChartCard
      title="🧭 Bản đồ xuất phát"
      subtitle={
        <>
          {merged ? 'Gộp 2 phần chẩn đoán · ' : part ? `Phần ${half2 ? 2 : 1}/2 · ` : ''}
          Đúng <b className="num">{right}/{counted}</b> câu ({pctOf(right, counted)}%) — điểm xuất phát để lập kế hoạch, không phải điểm thi. Mỗi mục chỉ{' '}
          {part && !merged ? '1 câu' : '2 câu'} nên kết quả còn <b>sơ bộ</b>.
        </>
      }
      table={{
        head: ['Task', 'Nội dung', 'Domain', 'Đúng', 'Đánh giá'],
        rows: grid.map((c) => [c.t.id, shortLabel(c.t.label_vi), meta.domains.find((d) => d.id === c.t.domain)?.code ?? c.t.domain, `${c.correct}/${c.answers}`, STATUS_INFO[c.status].label]),
      }}
    >
      <div className="grid c2 lrn-map">
        {meta.domains.map((d) => {
          const own = grid.filter((c) => c.t.domain === d.id);
          if (!own.length) return null;
          const n = own.reduce((s, c) => s + c.answers, 0);
          const ok = own.reduce((s, c) => s + c.correct, 0);
          return (
            <div key={d.id} className="lrn-map-domain">
              <div className="row between lrn-map-dhead">
                <span className="small">
                  <b>{d.code}</b> {d.label_vi} <span className="muted">· {d.weight}% đề</span>
                </span>
                <span className="small num nowrap">
                  <b>
                    {ok}/{n}
                  </b>{' '}
                  <span className="muted">{n ? `${pctOf(ok, n)}%` : ''}</span>
                </span>
              </div>
              {own.map((c) => (
                <button
                  key={c.t.id}
                  type="button"
                  className="lrn-map-row"
                  title={`${c.t.id} ${c.t.label}\n${c.t.label_vi}\n${c.correct}/${c.answers} đúng — bấm để luyện riêng mục này`}
                  onClick={() => navigate(`/new?mode=custom&tasks=${encodeURIComponent(c.t.id)}`)}
                >
                  <StatusChip status={c.status} />
                  <b className="num">{c.t.id}</b>
                  <span className="lrn-map-label">{shortLabel(c.t.label_vi)}</span>
                  <span className="num small nowrap">{c.answers ? `${c.correct}/${c.answers}` : '–'}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="legend lrn-map-legend" aria-label="Chú thích">
        {(['ok', 'partial', 'weak', 'untested'] as Status[]).map((s) => (
          <span key={s}>
            <StatusChip status={s} /> {STATUS_INFO[s].label}
          </span>
        ))}
      </div>
      {toFix.length > 0 && (
        <div className="row lrn-map-fix small">
          <span className="muted">Cần vá trước:</span>
          {toFix.map((c) => (
            <button key={c.t.id} type="button" className="chip" title={c.t.label_vi} onClick={() => navigate(`/new?mode=custom&tasks=${encodeURIComponent(c.t.id)}`)}>
              <StatusChip status={c.status} /> <b className="num">{c.t.id}</b> <span className="lrn-chip-label">{shortLabel(c.t.label_vi)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="divider" />
      <div className="row between lrn-map-cta">
        <div className="small dim lrn-map-cta-text">
          {secondHalfMissing
            ? `Còn phần 2/2 (${DIAGNOSTIC_PART} câu, mỗi mục 1 câu khác) — làm xong để bản đồ đủ 2 câu/mục.`
            : 'Kế hoạch tuần 1 tự lập từ bản đồ này (không cần AI): vá các mục ✗ có trọng số cao, ôn xen kẽ, nhắc thi thử cuối tuần.'}
        </div>
        <div className="row" style={ctaReady ? undefined : { visibility: 'hidden' }}>
          {secondHalfMissing && (
            <button className="btn primary" onClick={startSecondHalf}>
              ▶ Làm phần 2/2 · {DIAGNOSTIC_PART} câu
            </button>
          )}
          {planReady && !secondHalfMissing ? (
            <a className="btn primary" href={href('/')}>
              ✓ Xem kế hoạch tuần 1 →
            </a>
          ) : (
            <button className={`btn ${secondHalfMissing ? '' : 'primary'}`} disabled={busy} onClick={() => void makePlan()}>
              🗓️ Lập kế hoạch tuần 1{secondHalfMissing ? ' ngay' : ''}
            </button>
          )}
          {meta.claude?.available && !secondHalfMissing && (
            <a className="btn ghost" href={href('/coach')} title="Tuỳ chọn: Claude đọc kết quả và lập kế hoạch chi tiết hơn">
              🤖 Nhờ AI Coach
            </a>
          )}
        </div>
      </div>
    </ChartCard>
  );
}
