// [μ v5] Result page "🩹 Chữa N câu" (Design C7): a stepper over the attempt's retest set — wrong answers and right but
// unsure ones, confident errors first (hypercorrection). Each step: "thử lại trước khi xem" (the old wrong pick struck
// out, POST /api/results/:id/retry → retry / retryOk, display only, never changes the score), then the explanation with
// the original pick vs the key, the "vì sao chọn" note (WHY_CHIPS) and 🤖 Hỏi AI / 🧑‍🏫 Gia sư (τ's AskDialog). At the end
// "Kiểm tra lại ngay" = a retest of the same set (σ: mode 'retest', options reshuffled). Progress is kept per attempt in
// this browser, so the stepper can be left and resumed later.
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { api } from '../../lib/api.ts';
import { startTest } from '../../lib/start.ts';
import { QuestionView } from '../QuestionView.tsx';
import { AskDialog } from '../AskDialog.tsx';
import { TaskBadge } from '../insights.tsx';
import { toast } from '../ui.tsx';
import { WhyNote } from './WhyNote.tsx';
import { FIX_KIND_INFO, correctionSteps, retryCorrect, togglePick, versionOf, type FixKind } from './rules.ts';
import type { AnswerRecord, Question } from '../../../shared/types.ts';

/** τ's tutor tab (mode / context) — passed through until AskDialog's own props declare them. */
type AskProps = Parameters<typeof AskDialog>[0] & {
  mode?: 'ask' | 'tutor';
  context?: { why?: string; elim?: string; unsure?: boolean; hinted?: boolean; attemptId?: string };
};
const Ask = AskDialog as unknown as ComponentType<AskProps>;

interface Row {
  r: AnswerRecord;
  q: Question | null;
  n: number; // question number in the result
}

interface Saved {
  i: number; // current step
  seen: string[]; // question ids revealed
}

const KEY = (id: string) => `trainer.fix.${id}`;

function loadSaved(id: string): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(id)) ?? 'null') as Saved | null;
    if (v && typeof v.i === 'number' && Array.isArray(v.seen)) return v;
  } catch {
    // nothing saved / storage blocked
  }
  return { i: 0, seen: [] };
}

function save(id: string, s: Saved) {
  try {
    localStorage.setItem(KEY(id), JSON.stringify(s));
  } catch {
    // private window: progress lives for this visit only
  }
}

/** Steps of the stepper (same set as the retest), for the "🩹 Chữa N câu" button. */
export function useCorrectionSteps(rows: Row[]) {
  return useMemo(() => correctionSteps(rows.map(({ r, q }) => ({ r, known: !!q, okNow: q ? versionOf(r, q).nowOk : undefined }))), [rows]);
}

export function Correction({ attemptId, rows, why, onWhy, onClose }: { attemptId: string; rows: Row[]; why: Record<string, string>; onWhy: (q: string, why: string) => void; onClose: () => void }) {
  const steps = useCorrectionSteps(rows);
  const [state, setState] = useState<Saved>(() => loadSaved(attemptId));
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [retries, setRetries] = useState<Record<string, { retry: string; ok: boolean }>>({});
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<{ q: Question; r: AnswerRecord; mode: 'ask' | 'tutor' }>();
  useEffect(() => save(attemptId, state), [attemptId, state]);
  const total = steps.length;
  const done = state.i >= total;
  const step = done ? undefined : steps[Math.min(state.i, total - 1)];
  const row = step ? rows[step.index] : undefined;
  const q = row?.q ?? undefined;
  const r = row?.r;
  const retryOf = (x: AnswerRecord) => retries[x.q] ?? (x.retry !== undefined ? { retry: x.retry, ok: !!x.retryOk } : undefined);
  const revealed = !!r && (state.seen.includes(r.q) || !!retryOf(r));
  const go = (i: number) => setState((s) => ({ ...s, i: Math.max(0, Math.min(total, i)) }));
  const reveal = (id: string) => setState((s) => (s.seen.includes(id) ? s : { ...s, seen: [...s.seen, id] }));

  const check = async () => {
    if (!r || !q) return;
    const pick = picks[r.q] ?? [];
    setBusy(true);
    try {
      const res = await api.post<{ retry?: string; retryOk?: boolean; answer?: AnswerRecord }>(`/api/results/${encodeURIComponent(attemptId)}/retry`, { q: r.q, pick });
      const retry = res.retry ?? res.answer?.retry ?? pick.join('');
      const ok = res.retryOk ?? res.answer?.retryOk ?? retryCorrect(pick, q);
      setRetries((x) => ({ ...x, [r.q]: { retry, ok } }));
    } catch (e) {
      // display only: grade locally when the server cannot store it
      setRetries((x) => ({ ...x, [r.q]: { retry: pick.join(''), ok: retryCorrect(pick, q) } }));
      toast(`Không lưu được lần thử lại: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      reveal(r.q);
    }
  };

  const tried = steps.map((s) => retryOf(rows[s.index].r)).filter(Boolean) as { ok: boolean }[];
  const counts = steps.reduce<Record<FixKind, number>>((acc, s) => ({ ...acc, [s.kind]: acc[s.kind] + 1 }), { confident: 0, wrong: 0, unsure: 0 });

  return (
    <section className="card lrn-fix" id="fix" aria-label="Chữa bài">
      <div className="lrn-fix-head">
        <h2>🩹 Chữa {total} câu</h2>
        <div className="lrn-fix-dots" aria-hidden="true">
          {steps.map((s, i) => (
            <button
              key={s.index}
              type="button"
              tabIndex={-1}
              className={`lrn-fix-dot ${s.kind} ${i === state.i ? 'on' : ''} ${state.seen.includes(rows[s.index].r.q) ? 'seen' : ''}`}
              title={`Câu ${rows[s.index].n} · ${FIX_KIND_INFO[s.kind].label}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button className="btn ghost sm" onClick={onClose}>
          Đóng (làm tiếp sau)
        </button>
      </div>
      {!done && step && r && q ? (
        <div className="stack">
          <div className="row" style={{ gap: 6 }}>
            <span className="badge accent num">
              {state.i + 1}/{total}
            </span>
            <span className={`badge ${step.kind === 'unsure' ? 'warn' : 'bad'}`} title={FIX_KIND_INFO[step.kind].title}>
              {FIX_KIND_INFO[step.kind].icon} {FIX_KIND_INFO[step.kind].label}
            </span>
            <span className="small muted">Câu {row!.n} trong bài</span>
            <TaskBadge id={q.task} />
          </div>
          {!revealed ? (
            <>
              <div className="small dim">
                {step.kind === 'unsure'
                  ? 'Lần trước bạn đúng nhưng chưa chắc. Chọn lại trước khi xem giải thích.'
                  : r.pick
                    ? <>Thử lại trước khi xem giải thích — lựa chọn lần trước (<b>{r.pick}</b>) đã được gạch.</>
                    : 'Lần trước bạn bỏ trống. Chọn thử trước khi xem giải thích.'}
              </div>
              <QuestionView
                q={q}
                picked={picks[r.q] ?? []}
                onPick={(k) => setPicks((x) => ({ ...x, [r.q]: togglePick(x[r.q] ?? [], k, q.answer.length > 1) }))}
                elim={step.kind !== 'unsure' && r.pick ? [...r.pick] : []}
                showMeta={false}
                compact
              />
              <div className="row">
                <button className="btn primary" disabled={busy || (picks[r.q]?.length ?? 0) !== q.answer.length} onClick={() => void check()}>
                  Kiểm tra
                </button>
                <button className="btn ghost" onClick={() => reveal(r.q)}>
                  Bỏ qua, xem giải thích
                </button>
              </div>
            </>
          ) : (
            <>
              {retryOf(r) && (
                <div className={`small ${retryOf(r)!.ok ? 'good' : 'bad'}`}>
                  {retryOf(r)!.ok ? '✓' : '✗'} Lần thử lại: <b>{retryOf(r)!.retry || '—'}</b> {retryOf(r)!.ok ? '— đúng rồi.' : '— vẫn chưa đúng, đọc kỹ giải thích dưới đây.'}
                  <span className="muted"> (chỉ để tự kiểm tra, không đổi điểm bài)</span>
                </div>
              )}
              <QuestionView q={q} picked={[...r.pick]} reveal showMeta={false} compact elim={r.elim ? [...r.elim] : []} recall={r.recall || undefined} />
              {step.kind !== 'unsure' && <WhyNote key={r.q} attemptId={attemptId} r={r} value={why[r.q] ?? r.why} onSaved={(w) => onWhy(r.q, w)} open />}
              <div className="row">
                <button className="btn sm" onClick={() => setAsk({ q, r, mode: 'ask' })} title="Hỏi Claude về câu này (lưu vào coach/qa/)">
                  🤖 Hỏi AI
                </button>
                <button className="btn sm" onClick={() => setAsk({ q, r, mode: 'tutor' })} title="Gia sư hỏi gợi mở để bạn tự tìm ra chỗ sai">
                  🧑‍🏫 Gia sư
                </button>
              </div>
            </>
          )}
          <div className="row between lrn-fix-nav">
            <button className="btn" disabled={state.i === 0} onClick={() => go(state.i - 1)}>
              ← Câu trước
            </button>
            <button className="btn primary" onClick={() => go(state.i + 1)}>
              {state.i + 1 < total ? 'Câu tiếp →' : 'Xong ✓'}
            </button>
          </div>
        </div>
      ) : (
        <div className="stack sm">
          <div>
            ✓ Đã xem lại <b>{state.seen.length}/{total}</b> câu
            {counts.confident ? ` · ${counts.confident} lỗi sai dù chắc chắn` : ''}
            {tried.length ? ` · thử lại đúng ${tried.filter((t) => t.ok).length}/${tried.length}` : ''}.
          </div>
          <div className="small dim">
            Kiểm tra lại ngay các câu này (đáp án được xáo) để chốt lại — câu vẫn sai sẽ được ưu tiên trong Học hôm nay. Bài kiểm tra lại không tính vào mức sẵn sàng.
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => void startTest({ mode: 'retest', retestOf: attemptId })}>
              🩹 Kiểm tra lại ngay
            </button>
            <button className="btn ghost" onClick={() => go(0)}>
              Xem lại từ đầu
            </button>
            <button className="btn ghost" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      )}
      <Ask
        q={ask?.q}
        pick={ask?.r.pick}
        mode={ask?.mode}
        context={ask ? { why: why[ask.r.q] ?? ask.r.why, elim: ask.r.elim, unsure: ask.r.unsure, hinted: ask.r.hinted, attemptId } : undefined}
        onClose={() => setAsk(undefined)}
      />
    </section>
  );
}
