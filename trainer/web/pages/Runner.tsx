import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearActive, elapsedSeconds, loadActive, remainingSeconds, saveActive, type ActiveTest } from '../lib/session.ts';
import { api } from '../lib/api.ts';
import { navigate, href } from '../lib/router.ts';
import { fmtDuration } from '../lib/format.ts';
import { QuestionView } from '../components/QuestionView.tsx';
import { Empty, Modal, toast } from '../components/ui.tsx';
import { isCorrect } from '../../shared/scoring.ts';
import { MODE_INFO, FEEDBACK_INFO } from '../../shared/labels.ts';
import type { Attempt, SubmitRequest } from '../../shared/types.ts';

export function Runner() {
  const [t, setT] = useState<ActiveTest | undefined>(() => loadActive());
  const [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const activeSince = useRef<number>(Date.now());
  const submittedRef = useRef(false);

  // ── per-question time accounting ─────────────────────────────────────────
  const flushTime = useCallback((state: ActiveTest): ActiveTest => {
    const q = state.questions[state.current];
    if (!q || state.pausedAt || document.hidden) {
      activeSince.current = Date.now();
      return state;
    }
    const add = (Date.now() - activeSince.current) / 1000;
    activeSince.current = Date.now();
    if (add <= 0) return state;
    return { ...state, spent: { ...state.spent, [q.id]: (state.spent[q.id] ?? 0) + add } };
  }, []);

  const update = useCallback(
    (fn: (s: ActiveTest) => ActiveTest) =>
      setT((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        saveActive(next);
        return next;
      }),
    [],
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    const onVis = () => update((s) => flushTime(s));
    document.addEventListener('visibilitychange', onVis);
    const onUnload = () => {
      setT((prev) => {
        if (prev) saveActive(flushTime(prev));
        return prev;
      });
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [flushTime, update]);

  const go = useCallback(
    (i: number) =>
      update((s) => {
        const flushed = flushTime(s);
        return { ...flushed, current: Math.max(0, Math.min(s.questions.length - 1, i)) };
      }),
    [flushTime, update],
  );

  const submit = useCallback(
    async (timedOut = false) => {
      if (!t || submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      const final = flushTime(t);
      const req: SubmitRequest = {
        session: final.session,
        answers: final.questions.map((q) => ({
          q: q.id,
          pick: final.answers[q.id] ?? [],
          t: Math.round(final.spent[q.id] ?? 0),
          flag: final.flags[q.id] || undefined,
          unsure: final.unsure[q.id] || undefined,
        })),
        startedAt: new Date(final.startedAt).toISOString(),
        finishedAt: new Date().toISOString(),
        timedOut,
        timeUsed: Math.round(final.session.timeLimit && timedOut ? final.session.timeLimit : elapsedSeconds(final)),
      };
      try {
        const { attempt } = await api.post<{ attempt: Attempt }>('/api/results', req);
        clearActive();
        if (timedOut) toast('⏰ Hết giờ — bài đã được nộp tự động.');
        navigate(`/result/${encodeURIComponent(attempt.id)}`, { replace: true });
      } catch (e) {
        submittedRef.current = false;
        setSubmitting(false);
        toast(`Nộp bài lỗi: ${(e as Error).message} — bài vẫn được lưu tạm, thử lại.`);
      }
    },
    [t, flushTime],
  );

  const remaining = t ? remainingSeconds(t, now) : undefined;
  useEffect(() => {
    if (t && remaining !== undefined && remaining <= 0 && !t.pausedAt) void submit(true);
  }, [remaining, t, submit]);

  const q = t?.questions[t.current];
  const ref = t?.session.questions[t.current];
  const practice = t?.session.feedback === 'practice';
  const revealed = !!(q && t?.revealed[q.id]);
  const picked = (q && t?.answers[q.id]) || [];
  const canPause = t ? t.session.mode !== 'exam' : false;

  const pick = useCallback(
    (key: string) =>
      update((s) => {
        const cq = s.questions[s.current];
        if (!cq || s.revealed[cq.id]) return s;
        const cur = s.answers[cq.id] ?? [];
        const multi = cq.answer.length > 1;
        let next: string[];
        if (multi) next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
        else next = cur[0] === key ? [] : [key];
        return { ...s, answers: { ...s.answers, [cq.id]: next } };
      }),
    [update],
  );

  const check = useCallback(() => {
    if (!q) return;
    update((s) => ({ ...s, revealed: { ...s.revealed, [q.id]: true } }));
  }, [q, update]);

  const togglePause = useCallback(() => {
    update((s) => {
      if (s.pausedAt) return { ...s, pausedTotal: s.pausedTotal + (Date.now() - s.pausedAt), pausedAt: undefined };
      return { ...flushTime(s), pausedAt: Date.now() };
    });
    activeSince.current = Date.now();
  }, [flushTime, update]);

  // ── keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!t || !q || confirm || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const keys = ref?.order ?? q.options.map((o) => o.key);
      const k = e.key.toLowerCase();
      const idx = /^[1-8]$/.test(k) ? Number(k) - 1 : /^[a-h]$/.test(k) && k !== 'f' ? k.charCodeAt(0) - 97 : -1;
      if (idx >= 0 && idx < keys.length) {
        e.preventDefault();
        pick(keys[idx]);
      } else if (e.key === 'ArrowRight' || (e.key === 'Enter' && (!practice || revealed))) {
        e.preventDefault();
        if (t.current < t.questions.length - 1) go(t.current + 1);
        else setConfirm(true);
      } else if (e.key === 'Enter' && practice && !revealed && picked.length) {
        e.preventDefault();
        check();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(t.current - 1);
      } else if (k === 'f') {
        update((s) => ({ ...s, flags: { ...s.flags, [q.id]: !s.flags[q.id] } }));
      } else if (k === 'u') {
        update((s) => ({ ...s, unsure: { ...s.unsure, [q.id]: !s.unsure[q.id] } }));
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [t, q, ref, confirm, practice, revealed, picked.length, pick, go, check, update]);

  const answeredCount = useMemo(() => (t ? t.questions.filter((x) => (t.answers[x.id] ?? []).length > 0).length : 0), [t]);

  if (!t || !q) {
    return (
      <div className="runner">
        <Empty icon="📝" title="Không có bài test nào đang làm">
          <a className="btn primary" href={href('/new')} style={{ marginTop: 12 }}>
            ✍️ Tạo bài test
          </a>
        </Empty>
      </div>
    );
  }

  const elapsed = elapsedSeconds(t, now);
  const limit = t.session.timeLimit;
  const timerCls = remaining === undefined ? '' : remaining <= 120 ? 'danger' : remaining <= limit * 0.15 ? 'warn' : '';
  const spentHere = (t.spent[q.id] ?? 0) + (t.pausedAt || document.hidden ? 0 : (now - activeSince.current) / 1000);
  const expected = t.questions.filter((x) => (t.answers[x.id] ?? []).length > 0).reduce((s, x) => s + x.time, 0);
  const paceDiff = elapsed - expected;
  const unanswered = t.questions.length - answeredCount;
  const flagged = Object.values(t.flags).filter(Boolean).length;
  const navItems = t.questions.map((x, i) => ({ x, i })).filter(({ x }) => !onlyOpen || !(t.answers[x.id] ?? []).length || t.flags[x.id]);

  return (
    <div>
      <div className="runner-bar">
        <div className="inner">
          <a className="btn ghost sm" href={href('/')} title="Lưu & thoát (bài được giữ lại để làm tiếp)" onClick={() => canPause && !t.pausedAt && togglePause()}>
            ← Thoát
          </a>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="runner-title">
              {MODE_INFO[t.session.mode]?.icon} {t.session.title}
            </div>
            <div className="tiny muted runner-title-sub">
              {FEEDBACK_INFO[t.session.feedback].label} · đã trả lời {answeredCount}/{t.questions.length}
              {flagged ? ` · 🚩 ${flagged}` : ''}
            </div>
          </div>
          <div className="pace" title="So với tổng thời gian chuẩn của các câu đã trả lời">
            {answeredCount > 0 && (paceDiff > 15 ? `🐢 chậm ${fmtDuration(paceDiff)}` : paceDiff < -15 ? `⏩ nhanh ${fmtDuration(-paceDiff)}` : '✓ đúng nhịp')}
          </div>
          {canPause && (
            <button className="btn sm" onClick={togglePause} title="Tạm dừng">
              ⏸
            </button>
          )}
          <div className={`timer ${timerCls}`} title={limit ? `Giới hạn ${fmtDuration(limit)} · chuẩn ${fmtDuration(t.session.estimateTotal)}` : 'Không giới hạn'}>
            ⏱ {remaining !== undefined ? fmtDuration(remaining) : fmtDuration(elapsed)}
          </div>
          <button className="btn primary" onClick={() => setConfirm(true)} disabled={submitting}>
            Nộp bài
          </button>
        </div>
        <div className="inner">
          <div className="progress-line" style={{ flex: 1 }}>
            <span style={{ width: `${limit ? Math.min(100, (elapsed / limit) * 100) : (answeredCount / t.questions.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="runner">
        <div className="runner-grid">
          <div className="card pad-lg">
            <QuestionView
              q={q}
              index={t.current}
              total={t.questions.length}
              order={ref?.order}
              picked={picked}
              onPick={revealed ? undefined : pick}
              reveal={practice && revealed}
              showMeta={practice && revealed}
            />
            <div className="divider" />
            <div className="row between">
              <div className="row">
                <button className={`chip ${t.flags[q.id] ? 'on' : ''}`} onClick={() => update((s) => ({ ...s, flags: { ...s.flags, [q.id]: !s.flags[q.id] } }))}>
                  🚩 Cắm cờ <span className="kbd">F</span>
                </button>
                <button className={`chip ${t.unsure[q.id] ? 'on' : ''}`} onClick={() => update((s) => ({ ...s, unsure: { ...s.unsure, [q.id]: !s.unsure[q.id] } }))} title="Đánh dấu đoán/chưa chắc — câu đúng nhưng chưa chắc vẫn được ôn lại sớm">
                  🤔 Chưa chắc <span className="kbd">U</span>
                </button>
                <span className={`small ${spentHere > q.time ? 'warn' : 'muted'}`} title="Thời gian ở câu này / thời gian chuẩn">
                  ⏱ {fmtDuration(spentHere)} / {fmtDuration(q.time)}
                </span>
              </div>
              <div className="row">
                <button className="btn" onClick={() => go(t.current - 1)} disabled={t.current === 0}>
                  ← Trước
                </button>
                {practice && !revealed ? (
                  <button className="btn primary" onClick={check} disabled={!picked.length}>
                    Kiểm tra <span className="kbd">↵</span>
                  </button>
                ) : t.current < t.questions.length - 1 ? (
                  <button className="btn primary" onClick={() => go(t.current + 1)}>
                    Tiếp → <span className="kbd">↵</span>
                  </button>
                ) : (
                  <button className="btn primary" onClick={() => setConfirm(true)}>
                    Nộp bài ✓
                  </button>
                )}
              </div>
            </div>
          </div>

          <aside className="card stack sm" style={{ position: 'sticky', top: 92 }}>
            <div className="row between">
              <b className="small">Danh sách câu</b>
              <label className="tiny row" style={{ gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> chưa làm/cờ
              </label>
            </div>
            <div className="qnav">
              {navItems.map(({ x, i }) => {
                const ans = t.answers[x.id] ?? [];
                let cls = ans.length ? 'answered' : '';
                if (practice && t.revealed[x.id]) cls = isCorrect(ans, x.answer) ? 'correct' : 'wrong';
                return (
                  <button key={x.id} className={`${cls} ${i === t.current ? 'current' : ''}`} onClick={() => go(i)} title={x.id}>
                    {i + 1}
                    {(t.flags[x.id] || t.unsure[x.id]) && <span className="flag">{t.flags[x.id] ? '🚩' : '🤔'}</span>}
                  </button>
                );
              })}
            </div>
            <div className="tiny muted">
              Chuẩn: {fmtDuration(t.session.estimateTotal)} · {limit ? `giới hạn ${fmtDuration(limit)}` : 'không giới hạn'}
            </div>
            {t.session.notes.length > 0 && <div className="alert warn tiny">{t.session.notes.join(' ')}</div>}
          </aside>
        </div>
      </div>

      {t.pausedAt && (
        <div className="paused-cover">
          <div className="stack" style={{ alignItems: 'center' }}>
            <div style={{ fontSize: 46 }}>⏸</div>
            <h2>Đã tạm dừng</h2>
            <div className="muted">Đồng hồ dừng, câu hỏi được ẩn.</div>
            <button className="btn primary lg" onClick={togglePause}>
              ▶ Tiếp tục
            </button>
          </div>
        </div>
      )}

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Nộp bài?">
        <div className="stack">
          <div>
            Đã trả lời <b>{answeredCount}</b>/{t.questions.length} câu
            {unanswered > 0 && <span className="bad"> · còn {unanswered} câu bỏ trống (tính là sai)</span>}
            {flagged > 0 && <span> · 🚩 {flagged} câu cắm cờ</span>}.
          </div>
          {remaining !== undefined && <div className="small muted">Còn lại {fmtDuration(remaining)}.</div>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirm(false)}>
              Làm tiếp
            </button>
            <button className="btn primary" disabled={submitting} onClick={() => submit(false)}>
              {submitting ? 'Đang nộp…' : 'Nộp bài & xem kết quả'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
