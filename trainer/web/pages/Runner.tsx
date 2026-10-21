import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  DIFFERS_NOTE,
  RELEARN_SUFFIX,
  adoptMirror,
  baseId,
  buildSubmitRequest,
  canPause as canPauseTest,
  canStopEarly,
  checkRemote,
  clearActive,
  displayOrder,
  dropFromOutbox,
  dropMirror,
  elapsedSeconds,
  fetchMirror,
  flushOutbox,
  isPearson,
  isRecallFirst,
  isRelearn,
  isRelearnId,
  keepLocalOver,
  loadActive,
  onMirrorRefused,
  progressOf,
  queueRelearn,
  queueSubmit,
  reconcileActive,
  remainingSeconds,
  saveActive,
  sendQueued,
  stopSummary,
  useOutbox,
  useRemoteActive,
  type ActiveTest,
  type MirrorInfo,
  type OutboxEntry,
  type RemoteActive,
  type ReviewFilter,
} from '../lib/session.ts';
import { navigate, href } from '../lib/router.ts';
import { fmtDateTime, fmtDuration } from '../lib/format.ts';
import { useData } from '../lib/store.tsx';
import { InlineMarkdown } from '../lib/markdown.tsx';
import { QuestionView } from '../components/QuestionView.tsx';
import { WhyChips } from '../components/WhyChips.tsx';
import { Empty, Modal, toast } from '../components/ui.tsx';
import { isCorrect } from '../../shared/scoring.ts';
import { MODE_INFO, FEEDBACK_INFO, REQUIREMENT_INFO } from '../../shared/labels.ts';
import { comparePair, finalAsk } from '../lib/runner.ts';
import type { Question } from '../../shared/types.ts';

const HL_KEY = 'trainer.highlight';
const WARN_MINUTES = [15, 5];
const BANNER_MS = 20_000;
const REMOTE_POLL_MS = 20_000; // [v5] "did another device continue this test?" (one small GET)

function readHighlightPref(): boolean {
  try {
    return localStorage.getItem(HL_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeHighlightPref(on: boolean) {
  try {
    localStorage.setItem(HL_KEY, on ? '1' : '0');
  } catch {
    // ignore
  }
}

/** Enter that should submit a single-line-ish textarea (not Shift+Enter, not while an IME — e.g. Telex — is composing). */
function isSubmitEnter(e: ReactKeyboardEvent): boolean {
  return e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229;
}

function isTypingTarget(el: EventTarget | null): boolean {
  const h = el as HTMLElement | null;
  if (!h) return false;
  const tag = h.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || h.isContentEditable;
}

/**
 * Pure: adds `add` seconds to the current question (not while paused or on the review screen). Once "Kiểm tra" showed
 * the feedback (practice) the answer time `t` is frozen: later seconds — reading the explanation, writing "vì sao", coming
 * back to it — are reading time `rt`, so a learner who reads explanations is not graded "slow" by FSRS and the stats.
 */
function credit(s: ActiveTest, add: number): ActiveTest {
  const q = s.questions[s.current];
  if (!q || !(add > 0) || s.pausedAt || s.stage === 'review') return s;
  if (s.revealed[q.id]) return { ...s, read: { ...s.read, [q.id]: (s.read?.[q.id] ?? 0) + add } };
  return { ...s, spent: { ...s.spent, [q.id]: (s.spent[q.id] ?? 0) + add } };
}

export function Runner() {
  const { meta, byId, refresh, error: dataError } = useData();
  const [t, setT] = useState<ActiveTest | undefined>(() => loadActive());
  const outbox = useOutbox(); // finished tests waiting for the server ("⏳ chờ nộp")
  const [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState(false); // classic "Nộp bài?" dialog
  const [endConfirm, setEndConfirm] = useState(false); // pearson "Kết thúc bài thi?"
  const [submitting, setSubmitting] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [hl, setHl] = useState(readHighlightPref);
  const [banner, setBanner] = useState<{ min: number; until: number }>();
  const [bankFresh, setBankFresh] = useState(false);
  const [bankNotice, setBankNotice] = useState<string>();
  const [stopOpen, setStopOpen] = useState(false); // [v5] "⏹ Dừng ở đây?"
  const [conflict, setConflict] = useState<RemoteActive>(); // [v5] another device changed this test too
  const [resumedFrom, setResumedFrom] = useState<string>(); // [v5] taken over from another device (pause cover line)
  const lastNotice = useRef('');
  const activeSince = useRef<number>(Date.now());
  const submittedRef = useRef(false);
  const checking = useRef(false);
  const recallRef = useRef<HTMLTextAreaElement>(null);
  // [v5] an unfinished test mirrored by another device, offered when this browser has none
  const { remote, reload: reloadRemote } = useRemoteActive(!t && !outbox.length);

  const tRef = useRef(t);
  tRef.current = t;

  // ── [v5] resume on another device ─────────────────────────────────────────
  // The browser copy is primary. When another device continued this test (its mirror is newer than the version this copy
  // is based on) the newer progress is taken over — or, when this copy changed too, the learner chooses.
  const takeRemote = useCallback((m: RemoteActive, how: 'resume' | 'newer') => {
    const next = adoptMirror(m);
    submittedRef.current = false;
    activeSince.current = Date.now();
    setT(next);
    setConflict(undefined);
    setResumedFrom(m.device ?? 'thiết bị khác');
    if (how === 'newer') {
      const p = progressOf(next);
      toast(`⏯ Đã lấy tiến độ mới hơn từ ${m.device ?? 'thiết bị khác'} (${p.answered}/${p.total} câu).`);
    }
  }, []);

  const runCheck = useCallback(async () => {
    const cur = tRef.current;
    if (!cur || submittedRef.current || checking.current) return;
    checking.current = true;
    try {
      const r = await checkRemote(cur);
      const now = tRef.current;
      if (!now || submittedRef.current || now.session.sessionId !== cur.session.sessionId) return;
      if (r.kind === 'submitted') {
        submittedRef.current = true;
        clearActive();
        setT(undefined);
        toast('✓ Bài này đã được nộp trên thiết bị khác.');
        navigate(`/result/${encodeURIComponent(r.attemptId)}`, { replace: true });
      } else if (r.kind === 'adopt') takeRemote(r.remote, 'newer');
      else if (r.kind === 'conflict') setConflict(r.remote);
    } catch {
      // offline / server restarting: this browser's copy simply stays the one in use
    } finally {
      checking.current = false;
    }
  }, [takeRemote]);

  const hasTest = !!t;
  useEffect(() => {
    if (!hasTest) return;
    void runCheck();
    const onBack = () => {
      if (!document.hidden) void runCheck();
    };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    const id = setInterval(onBack, REMOTE_POLL_MS);
    const off = onMirrorRefused(() => void runCheck());
    return () => {
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
      clearInterval(id);
      off();
    };
  }, [hasTest, runCheck]);

  const resumeRemote = useCallback(async () => {
    const m = await fetchMirror().catch(() => null);
    if (!m) {
      toast('Bài đó không còn để làm tiếp (đã nộp hoặc đã bỏ).');
      reloadRemote();
      return;
    }
    takeRemote(m, 'resume');
  }, [takeRemote, reloadRemote]);

  const discardRemote = useCallback(
    (info: MirrorInfo) => {
      if (!window.confirm(`Bỏ bài “${info.title}” đang làm dở trên ${info.device ?? 'thiết bị khác'}? Các câu chưa nộp sẽ không được lưu.`)) return;
      dropMirror(info.sessionId);
      reloadRemote();
    },
    [reloadRemote],
  );

  const keepMine = useCallback(() => {
    const cur = tRef.current;
    if (cur && conflict) keepLocalOver(conflict, cur);
    setConflict(undefined);
  }, [conflict]);

  // ── per-question time accounting ─────────────────────────────────────────
  // State updaters must stay pure (StrictMode runs them twice), so elapsed time is measured
  // here, outside them, and handed to the pure credit().
  const lap = useCallback((): number => {
    const nowMs = Date.now();
    const add = (nowMs - activeSince.current) / 1000;
    activeSince.current = nowMs;
    return add > 0 ? add : 0;
  }, []);

  const update = useCallback(
    (fn: (s: ActiveTest) => ActiveTest) =>
      setT((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        if (next !== prev) saveActive(next);
        return next;
      }),
    [],
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    const onVis = () => {
      if (document.hidden) {
        const add = lap(); // the page was visible until now
        update((s) => credit(s, add));
      } else activeSince.current = Date.now(); // time while hidden is not counted
    };
    const persist = () => {
      const cur = tRef.current;
      if (cur && !submittedRef.current) saveActive(credit(cur, document.hidden ? 0 : lap()));
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', persist);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', persist);
      persist(); // leaving the runner inside the app (← Thoát, sidebar)
    };
  }, [lap, update]);

  // ── keep the saved test in step with the bank (rebalanced / edited questions) ──
  // Compare only against a bank fetched now: a stale client copy must never "refresh" a newer test.
  useEffect(() => {
    let alive = true;
    void refresh().finally(() => alive && setBankFresh(true));
    return () => {
      alive = false;
    };
  }, [refresh]);

  useEffect(() => {
    const cur = tRef.current;
    if (!bankFresh || dataError || !cur || !byId.size || submittedRef.current) return; // never against a stale copy
    const r = reconcileActive(cur, byId);
    if (r.test !== cur) update((s) => reconcileActive(s, byId).test);
    const parts: string[] = [];
    if (r.remapped.length) parts.push(`${r.remapped.length} câu đã đổi thứ tự lựa chọn — đáp án bạn đã chọn/gạch được giữ theo nội dung`);
    if (r.reset.length) parts.push(`${r.reset.length} câu có lựa chọn đã được sửa nên câu trả lời của bạn ở đó đã được xoá để làm lại`);
    if (r.missing.length) parts.push(`${r.missing.length} câu không còn trong ngân hàng (sẽ không được chấm)`);
    const msg = parts.length ? `Ngân hàng câu hỏi vừa được cập nhật: ${parts.join('; ')}.` : '';
    if (msg && msg !== lastNotice.current) setBankNotice(msg);
    lastNotice.current = msg || lastNotice.current;
  }, [bankFresh, dataError, byId, update]);

  const pearson = t ? isPearson(t) : false;
  const recallFirst = t ? isRecallFirst(t) : false;
  const reviewing = t?.stage === 'review';

  // ── navigation (index / id / pearson review list) ────────────────────────
  const goIndex = useCallback(
    (i: number) => {
      const add = lap();
      update((s) => ({ ...credit(s, add), stage: undefined, current: Math.max(0, Math.min(s.questions.length - 1, i)) }));
    },
    [lap, update],
  );

  const goId = useCallback(
    (id: string, reviewIds?: string[]) => {
      const add = lap();
      update((s) => {
        const i = s.questions.findIndex((x) => x.id === id);
        return { ...credit(s, add), stage: undefined, current: i >= 0 ? i : s.current, ...(reviewIds ? { reviewIds } : {}) };
      });
    },
    [lap, update],
  );

  const openReview = useCallback(() => {
    const add = lap();
    update((s) => ({ ...credit(s, add), stage: 'review', reviewIds: undefined, reachedEnd: true }));
  }, [lap, update]);

  const next = useCallback(() => {
    if (!t) return;
    const cq = t.questions[t.current];
    if (t.reviewIds?.length && cq) {
      const pos = t.reviewIds.indexOf(cq.id);
      if (pos >= 0 && pos < t.reviewIds.length - 1) goId(t.reviewIds[pos + 1]);
      else openReview();
      return;
    }
    if (t.current < t.questions.length - 1) goIndex(t.current + 1);
    else if (pearson) openReview();
    else setConfirm(true);
  }, [t, pearson, goId, goIndex, openReview]);

  const prev = useCallback(() => {
    if (!t) return;
    const cq = t.questions[t.current];
    if (t.reviewIds?.length && cq) {
      const pos = t.reviewIds.indexOf(cq.id);
      if (pos > 0) goId(t.reviewIds[pos - 1]);
      return;
    }
    goIndex(t.current - 1);
  }, [t, goId, goIndex]);

  // ── submit ────────────────────────────────────────────────────────────────
  // Write-ahead: the finished test goes to the outbox before the request, so neither a closed tab nor a lost response can
  // lose it. No answer from the server → it stays "⏳ chờ nộp" and App.tsx sends the same request again (same finishedAt;
  // the server returns the stored attempt when an earlier try did arrive). A refusal (4xx) brings the test back.
  // [v5] `stoppedEarly` ("⏹ Dừng ở đây"): only the part done is stored; questions never viewed go back to the queues.
  const submit = useCallback(
    async (timedOut = false, stoppedEarly = false) => {
      if (!t || submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      const final = credit(t, document.hidden ? 0 : lap());
      const req = buildSubmitRequest(final, timedOut, Date.now(), { stoppedEarly });
      const sid = req.session.sessionId;
      queueSubmit(req);
      clearActive();
      dropMirror(sid); // another device must not offer to resume it (the server also drops it once the submit arrives)
      const r = await sendQueued(sid);
      if ('attempt' in r) {
        if (r.differs) toast(DIFFERS_NOTE);
        else if (timedOut) toast('⏰ Hết giờ — bài đã được nộp tự động.');
        else if (req.stoppedEarly) toast('⏹ Đã lưu phần đã làm — câu chưa xem vẫn ở trong hàng chờ.');
        navigate(`/result/${encodeURIComponent(r.attempt.id)}`, { replace: true });
        return;
      }
      if (r.retryable) {
        setT(undefined); // the runner now shows the waiting submit
        setSubmitting(false);
        toast(`${timedOut ? '⏰ Hết giờ — ' : ''}⏳ Chưa gửi được bài (${r.error}) — bài đã được lưu, app sẽ tự nộp lại khi có kết nối.`);
        return;
      }
      dropFromOutbox(sid);
      saveActive(final);
      submittedRef.current = false;
      setSubmitting(false);
      update(() => final); // keep the credited time for the retry
      toast(`Nộp bài lỗi: ${r.error} — bài vẫn được giữ, thử lại.`);
    },
    [t, lap, update],
  );

  const remaining = t ? remainingSeconds(t, now) : undefined;
  useEffect(() => {
    if (t && remaining !== undefined && remaining <= 0 && !t.pausedAt) void submit(true);
  }, [remaining, t, submit]);

  // ── 15-minute / 5-minute warnings (any timed test long enough to need them) ─
  useEffect(() => {
    if (!t || remaining === undefined || remaining <= 0 || t.pausedAt) return;
    const limit = t.session.timeLimit;
    const due = WARN_MINUTES.filter((m) => limit > m * 60 + 60 && remaining <= m * 60 && !t.warned[String(m)]);
    if (!due.length) return;
    const at = Date.now();
    update((s) => ({ ...s, warned: { ...s.warned, ...Object.fromEntries(due.map((m) => [String(m), at])) } }));
    setBanner({ min: Math.min(...due), until: at + BANNER_MS });
  }, [remaining, t, update]);

  // [v5] "⏹ Dừng ở đây" before any answer = abandon (nothing to store; the questions stay in the queues)
  const abandon = useCallback(() => {
    const cur = tRef.current;
    if (!cur) return;
    submittedRef.current = true;
    clearActive();
    dropMirror(cur.session.sessionId);
    setStopOpen(false);
    setT(undefined);
    toast('Đã bỏ bài — các câu vẫn ở trong hàng chờ.');
    navigate('/', { replace: true });
  }, []);

  const q = t?.questions[t.current];
  const refById = useMemo(() => new Map((t?.session.questions ?? []).map((r) => [r.id, r])), [t?.session]);
  const slot = !!q && isRelearnId(q.id); // [v5] in-session relearn retry of an earlier question
  const ref = q ? refById.get(baseId(q.id)) : undefined;
  const order = t && q ? displayOrder(t, q) : undefined;
  const displayKeys = q ? (order ?? q.options.map((o) => o.key)) : [];
  const practice = t?.session.feedback === 'practice';
  const revealed = !!(q && t?.revealed[q.id]);
  const picked = (q && t?.answers[q.id]) || [];
  const canPause = t ? canPauseTest(t) : false;
  const stoppable = t ? canStopEarly(t) : false;
  // recall-first sessions and relearn retries keep the options hidden until the learner recalls (or taps "Hiện lựa chọn")
  const gate = !!(t && q && (recallFirst || slot) && !t.recallShown[q.id] && !revealed && !picked.length);
  const numbers = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const x of t?.questions ?? []) if (!isRelearnId(x.id)) m.set(x.id, ++n);
    return m;
  }, [t?.questions]);
  const numberOf = (id: string) => numbers.get(baseId(id)) ?? 0;
  const hinted = !!(q && t?.hinted[q.id]);
  const keywords = meta?.keywords && Object.keys(meta.keywords).length ? meta.keywords : null;

  // ── answer actions ────────────────────────────────────────────────────────
  const pick = useCallback(
    (key: string) =>
      update((s) => {
        const cq = s.questions[s.current];
        if (!cq || s.revealed[cq.id] || s.stage === 'review') return s;
        const cur = s.answers[cq.id] ?? [];
        const multi = cq.answer.length > 1;
        let nextPick: string[];
        if (multi) nextPick = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
        else nextPick = cur[0] === key ? [] : [key];
        const struck = s.elim[cq.id] ?? [];
        // choosing a struck option un-strikes it
        const elim = nextPick.includes(key) && struck.includes(key) ? { ...s.elim, [cq.id]: struck.filter((k) => k !== key) } : s.elim;
        return { ...s, answers: { ...s.answers, [cq.id]: nextPick }, elim };
      }),
    [update],
  );

  const strike = useCallback(
    (key: string) =>
      update((s) => {
        const cq = s.questions[s.current];
        if (!cq || s.revealed[cq.id] || s.stage === 'review') return s;
        const struck = s.elim[cq.id] ?? [];
        const on = !struck.includes(key);
        const cur = s.answers[cq.id] ?? [];
        return {
          ...s,
          elim: { ...s.elim, [cq.id]: on ? [...struck, key] : struck.filter((k) => k !== key) },
          // a struck option cannot stay selected
          answers: on && cur.includes(key) ? { ...s.answers, [cq.id]: cur.filter((k) => k !== key) } : s.answers,
        };
      }),
    [update],
  );

  const check = useCallback(() => {
    if (!q) return;
    const add = lap(); // the answer time ends here — the seconds that follow are reading time (rt)
    update((s) => {
      const n: ActiveTest = { ...credit(s, add), revealed: { ...s.revealed, [q.id]: true } };
      // [v5] in-session relearning: a wrong or hinted answer comes back 3–6 questions later (once)
      const missed = !isCorrect(s.answers[q.id] ?? [], q.answer) || !!s.hinted[q.id];
      return isRelearn(s) && !isRelearnId(q.id) && missed ? queueRelearn(n, q.id) : n;
    });
  }, [q, lap, update]);

  const toggleFlag = useCallback(() => {
    if (q) update((s) => ({ ...s, flags: { ...s.flags, [q.id]: !s.flags[q.id] } }));
  }, [q, update]);

  const toggleUnsure = useCallback(() => {
    if (q) update((s) => ({ ...s, unsure: { ...s.unsure, [q.id]: !s.unsure[q.id] } }));
  }, [q, update]);

  const openHint = useCallback(() => {
    if (!q || !q.hint || !practice || revealed) return;
    update((s) => ({ ...s, hinted: { ...s.hinted, [q.id]: true } }));
  }, [q, practice, revealed, update]);

  const showOptions = useCallback(() => {
    if (q) update((s) => ({ ...s, recallShown: { ...s.recallShown, [q.id]: true } }));
  }, [q, update]);

  const toggleHl = useCallback(() => {
    const v = !hl;
    setHl(v);
    writeHighlightPref(v);
  }, [hl]);

  const togglePause = useCallback(() => {
    const nowMs = Date.now();
    const add = lap(); // credited only when pausing; on resume the lap simply restarts
    update((s) => (s.pausedAt ? { ...s, pausedTotal: s.pausedTotal + (nowMs - s.pausedAt), pausedAt: undefined } : { ...credit(s, add), pausedAt: nowMs }));
  }, [lap, update]);

  // recall-first: put the cursor in the guess box when a gated question opens
  useEffect(() => {
    if (gate && !reviewing) recallRef.current?.focus({ preventScroll: true });
  }, [gate, q?.id, reviewing]);

  // ── keyboard shortcuts (ignored while typing or when a dialog is open) ───
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    onKey.current = (e: KeyboardEvent) => {
      if (!t || !q || confirm || endConfirm || submitting || t.pausedAt || reviewing) return;
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const canAnswer = !revealed && !gate;
      if (e.shiftKey) {
        // Shift + 1–8 (or Shift + A–H) strikes an option out
        const d = /^(?:Digit|Numpad)([1-8])$/.exec(e.code);
        const l = /^Key([A-H])$/.exec(e.code);
        const idx = d ? Number(d[1]) - 1 : l ? l[1].charCodeAt(0) - 65 : -1;
        if (idx >= 0 && idx < displayKeys.length && canAnswer) {
          e.preventDefault();
          strike(displayKeys[idx]);
        }
        return;
      }
      const k = e.key.toLowerCase();
      const idx = /^[1-8]$/.test(k) ? Number(k) - 1 : /^[a-g]$/.test(k) && k !== 'f' ? k.charCodeAt(0) - 97 : -1;
      if (idx >= 0) {
        if (canAnswer && idx < displayKeys.length) {
          e.preventDefault();
          pick(displayKeys[idx]);
        }
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Enter') {
        if (gate) {
          e.preventDefault();
          recallRef.current?.focus();
        } else if (practice && !revealed) {
          if (picked.length) {
            e.preventDefault();
            check();
          }
        } else {
          e.preventDefault();
          next();
        }
      } else if (k === 'f') toggleFlag();
      else if (k === 'u') toggleUnsure();
      else if (k === 'h') openHint();
      else if (k === 'k') toggleHl();
    };
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // [v5] counts over the session's own questions (relearn retries are extra, shown as 🔁 done/queued)
  const prog = useMemo(() => (t ? progressOf(t) : { answered: 0, total: 0, relearnDone: 0, relearnTotal: 0 }), [t]);
  const answeredCount = prog.answered;

  if (!t || !q) {
    return (
      <div className="runner">
        {outbox.length ? (
          <PendingSubmits entries={outbox} />
        ) : remote ? (
          <RemoteResume info={remote} onResume={() => void resumeRemote()} onDiscard={() => discardRemote(remote)} />
        ) : (
          <Empty icon="📝" title="Không có bài test nào đang làm">
            <a className="btn primary" href={href('/new')} style={{ marginTop: 12 }}>
              ✍️ Tạo bài test
            </a>
          </Empty>
        )}
      </div>
    );
  }

  const elapsed = elapsedSeconds(t, now);
  const limit = t.session.timeLimit;
  const timerCls = remaining === undefined ? '' : remaining <= 120 ? 'danger' : remaining <= limit * 0.15 ? 'warn' : '';
  const live = t.pausedAt || document.hidden || reviewing ? 0 : (now - activeSince.current) / 1000; // not credited yet
  const spentHere = (t.spent[q.id] ?? 0) + (revealed ? 0 : live); // frozen once "Kiểm tra" showed the feedback
  const expected = t.questions.filter((x) => (t.answers[x.id] ?? []).length > 0).reduce((s, x) => s + x.time, 0);
  const reading = Object.values(t.read ?? {}).reduce((s, x) => s + x, 0) + (revealed ? live : 0); // practice: rt
  const paceDiff = elapsed - reading - expected;
  const unanswered = prog.total - answeredCount;
  const stop = stopSummary(t);
  // [v5] mode "today": a soft budget (σ builds it untimed) — past it, "Hết phiên — nộp phần đã làm"
  const budgetMin = t.session.budgetMinutes && t.session.budgetMinutes > 0 && !limit ? t.session.budgetMinutes : 0;
  const overBudget = budgetMin > 0 && elapsed >= budgetMin * 60;
  const showBudget = overBudget && !t.warned.budget && !t.pausedAt;
  const finishBudget = () => {
    if (!answeredCount) setStopOpen(true);
    else void submit(false, stoppable && unanswered > 0);
  };
  const relearnQueued = !slot && !!t.relearn?.[q.id + RELEARN_SUFFIX];
  const contrast = t.session.mode === 'discriminate' && (t.session.contrast?.length ?? 0) >= 2 ? t.session.contrast! : undefined;
  const pair = contrast && practice && revealed ? comparePair(q, picked, contrast) : undefined;
  const flagged = t.questions.filter((x) => t.flags[x.id]).length;
  const navItems = t.questions.map((x, i) => ({ x, i })).filter(({ x }) => !onlyOpen || !(t.answers[x.id] ?? []).length || t.flags[x.id]);
  const reviewPos = t.reviewIds?.length ? t.reviewIds.indexOf(q.id) : -1;
  const inReviewList = reviewPos >= 0 && !!t.reviewIds;
  const wrongPick = practice && revealed && picked.length > 0 && !isCorrect(picked, q.answer) && !slot;
  const showBanner = banner && now < banner.until;
  const recallValue = t.recall[q.id] ?? '';

  let primary: { label: string; kbd?: boolean; onClick: () => void; disabled?: boolean };
  if (practice && !revealed) primary = { label: 'Kiểm tra', kbd: true, onClick: check, disabled: !picked.length };
  else if (inReviewList) {
    primary =
      reviewPos < t.reviewIds!.length - 1
        ? { label: `Tiếp (${reviewPos + 2}/${t.reviewIds!.length}) →`, kbd: true, onClick: next }
        : { label: '☰ Về màn hình xem lại', kbd: true, onClick: openReview };
  } else if (t.current < t.questions.length - 1) primary = { label: 'Tiếp →', kbd: true, onClick: next };
  else if (pearson) primary = { label: '☰ Màn hình xem lại', kbd: true, onClick: openReview };
  else primary = { label: 'Nộp bài ✓', onClick: () => setConfirm(true) };
  const prevDisabled = inReviewList ? reviewPos <= 0 : t.current === 0;

  const hintBox = hinted && q.hint ? (
    <div className="hint-box" role="note">
      <span className="hint-ico" aria-hidden="true">
        💡
      </span>
      <span>
        <b>Gợi ý:</b> <InlineMarkdown text={q.hint} />
      </span>
    </div>
  ) : null;

  const recallBox = gate ? (
    <div className="recall-box">
      <label htmlFor="recall-input" className="recall-q">
        {slot ? '🔁 Học lại — bạn nhớ đáp án là gì?' : '🧠 Nhớ lại trước — bạn nghĩ đáp án là gì?'}
      </label>
      <textarea
        id="recall-input"
        ref={recallRef}
        rows={2}
        maxLength={300}
        value={recallValue}
        placeholder={slot ? 'Gõ ý chính: service, tính năng… (các lựa chọn đang ẩn)' : 'Viết ngắn: service, tính năng hoặc ý chính… (các lựa chọn đang ẩn)'}
        onChange={(e) => update((s) => ({ ...s, recall: { ...s.recall, [q.id]: e.target.value } }))}
        onKeyDown={(e) => {
          if (isSubmitEnter(e)) {
            e.preventDefault();
            showOptions();
          }
        }}
      />
      <div className="row between recall-actions">
        <span className="tiny muted kbd-hint">
          <span className="kbd">↵</span> hiện lựa chọn · <span className="kbd">Shift</span>+<span className="kbd">↵</span> xuống dòng
        </span>
        <button type="button" className={`btn sm ${recallValue.trim() ? 'primary' : ''}`} onClick={showOptions}>
          {slot ? 'Hiện lựa chọn ↵' : recallValue.trim() ? 'Hiện các lựa chọn ↵' : 'Bỏ qua, hiện lựa chọn'}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className={`runner-page ${pearson ? 'pearson' : ''}`}>
      <div className="runner-bar">
        <div className="inner">
          <a
            className="btn ghost sm"
            href={href('/')}
            title={canPause ? 'Lưu & thoát (bài được giữ lại và tạm dừng)' : 'Thoát (bài được giữ lại — đồng hồ vẫn chạy như thi thật)'}
            onClick={() => canPause && !t.pausedAt && togglePause()}
          >
            ← Thoát
          </a>
          <div className="runner-head">
            <div className="runner-title">
              {MODE_INFO[t.session.mode]?.icon} {t.session.title}
            </div>
            <div className="tiny muted runner-title-sub">
              {pearson ? '🏛 Pearson VUE · ' : ''}
              {FEEDBACK_INFO[t.session.feedback]?.label ?? t.session.feedback} · đã trả lời {answeredCount}/{prog.total}
              {prog.relearnTotal ? ` · 🔁 học lại ${prog.relearnDone}/${prog.relearnTotal}` : ''}
              {flagged ? ` · 🚩 ${flagged}` : ''}
              {recallFirst ? ' · 🧠 nhớ lại trước' : ''}
            </div>
          </div>
          <div className="pace" title="So với tổng thời gian chuẩn của các câu đã trả lời">
            {answeredCount > 0 && (paceDiff > 15 ? `🐢 chậm ${fmtDuration(paceDiff)}` : paceDiff < -15 ? `⏩ nhanh ${fmtDuration(-paceDiff)}` : '✓ đúng nhịp')}
          </div>
          {keywords && (
            <button
              type="button"
              className={`btn sm hl-toggle ${hl ? 'on' : ''}`}
              onClick={toggleHl}
              aria-pressed={hl}
              title={hl ? 'Đang tô sáng từ khóa trong đề — bấm để tắt (K)' : 'Tô sáng từ khóa trong đề: MOST/LEAST/NOT, chi phí, vận hành, HA… (K)'}
            >
              🖍<span className="hl-label"> Từ khóa</span>
            </button>
          )}
          {canPause && (
            <button className="btn sm" onClick={togglePause} title="Tạm dừng">
              ⏸
            </button>
          )}
          <div
            className={`timer ${timerCls || (overBudget ? 'warn' : '')}`}
            title={limit ? `Giới hạn ${fmtDuration(limit)} · chuẩn ${fmtDuration(t.session.estimateTotal)}` : budgetMin ? `Quỹ hôm nay ${budgetMin} phút (mềm — hết quỹ vẫn làm tiếp được)` : 'Không giới hạn'}
          >
            ⏱ {remaining !== undefined ? fmtDuration(remaining) : fmtDuration(elapsed)}
            {budgetMin > 0 && <span className="timer-budget"> / {budgetMin}′</span>}
          </div>
          {stoppable && (
            <button
              type="button"
              className="btn sm stop-btn"
              onClick={() => setStopOpen(true)}
              disabled={submitting}
              aria-label="Dừng ở đây"
              title="Dừng ở đây — lưu phần đã làm, câu chưa xem quay lại hàng chờ (không tính sai)"
            >
              ⏹<span className="hide-sm"> Dừng</span>
            </button>
          )}
          {pearson ? (
            <button className="btn primary" onClick={reviewing ? () => setEndConfirm(true) : openReview} disabled={submitting} title="Màn hình xem lại → Kết thúc bài thi">
              {reviewing ? 'Kết thúc' : '☰ Xem lại'}
            </button>
          ) : (
            <button className="btn primary" onClick={() => setConfirm(true)} disabled={submitting}>
              Nộp bài
            </button>
          )}
        </div>
        <div className="inner">
          <div className="progress-line" style={{ flex: 1 }}>
            <span style={{ width: `${limit ? Math.min(100, (elapsed / limit) * 100) : (answeredCount / Math.max(1, prog.total)) * 100}%` }} />
          </div>
        </div>
        {showBudget && (
          <div className="inner">
            <div className="time-warn budget-warn" role="status">
              <span>
                ⏰ <b>Hết phiên {budgetMin}′</b> — nộp phần đã làm
                {unanswered > 0 && stoppable ? ` (${answeredCount} câu); câu chưa xem quay lại hàng chờ.` : '.'}
              </span>
              <span className="row nowrap budget-actions">
                <button type="button" className="btn sm primary" onClick={finishBudget} disabled={submitting}>
                  Nộp phần đã làm
                </button>
                <button type="button" className="btn ghost sm" onClick={() => update((s) => ({ ...s, warned: { ...s.warned, budget: Date.now() } }))}>
                  Làm tiếp
                </button>
              </span>
            </div>
          </div>
        )}
        {showBanner && (
          <div className="inner">
            <div className={`time-warn ${banner.min <= 5 ? 'urgent' : ''}`} role="alert">
              <span>
                ⏰ Còn <b>{banner.min} phút</b>
                {unanswered > 0 ? ` — ${unanswered} câu chưa trả lời: đừng để trống, đoán vẫn hơn bỏ.` : ' — dành thời gian xem lại câu cắm cờ.'}
              </span>
              <button type="button" className="btn ghost sm" onClick={() => setBanner(undefined)} aria-label="Đóng cảnh báo">
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="runner">
        {bankNotice && (
          <div className="alert info bank-notice" role="status">
            <span>ℹ️ {bankNotice}</span>
            <button type="button" className="btn ghost sm" onClick={() => setBankNotice(undefined)} aria-label="Đóng thông báo">
              ✕
            </button>
          </div>
        )}
        <div className={`runner-grid ${pearson ? 'solo' : ''}`}>
          {reviewing ? (
            <ReviewScreen
              t={t}
              filter={reviewFilter}
              onFilter={setReviewFilter}
              onOpen={(id, ids) => goId(id, ids)}
              onEnd={() => setEndConfirm(true)}
              remaining={remaining}
            />
          ) : (
            <div className="card pad-lg">
              {inReviewList && (
                <div className="review-nav-note">
                  <span>
                    ☰ Đang xem lại {reviewPos + 1}/{t.reviewIds!.length}
                  </span>
                  <button type="button" className="btn ghost sm" onClick={openReview}>
                    Về màn hình xem lại
                  </button>
                </div>
              )}
              <QuestionView
                q={q}
                index={slot ? undefined : numberOf(q.id) - 1}
                total={prog.total}
                tag={
                  slot ? (
                    <span className="badge warn relearn-badge" title="Hỏi lại câu bạn vừa sai / phải xem gợi ý — không tính điểm">
                      🔁 Học lại · câu {numberOf(q.id)}
                    </span>
                  ) : undefined
                }
                idText={baseId(q.id)}
                order={order}
                picked={picked}
                onPick={revealed || gate ? undefined : pick}
                onStrike={revealed || gate ? undefined : strike}
                elim={t.elim[q.id]}
                highlight={hl ? keywords : null}
                recall={recallFirst || slot ? recallValue : undefined}
                hideOptions={gate}
                beforeOptions={
                  hintBox || recallBox ? (
                    <>
                      {hintBox}
                      {recallBox}
                    </>
                  ) : undefined
                }
                reveal={practice && revealed}
                showMeta={practice && revealed}
                showTask
              />
              {practice && revealed && (
                <AfterAnswer t={t} q={q} slot={slot} queued={relearnQueued} forId={slot ? undefined : ref?.for} pair={pair} />
              )}
              {wrongPick && (
                <div className="why-box">
                  <label htmlFor="why-input">
                    ✍️ Vì sao bạn chọn đáp án này? <span className="muted">(tùy chọn — AI Coach dùng để tìm lỗ hổng tư duy)</span>
                  </label>
                  <WhyChips value={t.why[q.id] ?? ''} onChange={(v) => update((s) => ({ ...s, why: { ...s.why, [q.id]: v.slice(0, 500) } }))} />
                  <textarea
                    id="why-input"
                    rows={2}
                    maxLength={500}
                    value={t.why[q.id] ?? ''}
                    placeholder="vd: tưởng Multi-AZ giúp tăng hiệu năng đọc…"
                    onChange={(e) => update((s) => ({ ...s, why: { ...s.why, [q.id]: e.target.value } }))}
                    onKeyDown={(e) => {
                      if (isSubmitEnter(e)) {
                        e.preventDefault();
                        next();
                      }
                    }}
                  />
                  <div className="tiny muted kbd-hint">
                    <span className="kbd">↵</span> lưu & sang câu tiếp · <span className="kbd">Shift</span>+<span className="kbd">↵</span> xuống dòng
                  </div>
                </div>
              )}
              <div className="divider" />
              <div className="row between runner-actions">
                <div className="row runner-tools">
                  <button className={`chip ${t.flags[q.id] ? 'on' : ''}`} onClick={toggleFlag} aria-pressed={!!t.flags[q.id]} title="Đánh dấu để xem lại">
                    🚩 Cắm cờ <span className="kbd">F</span>
                  </button>
                  <button
                    className={`chip ${t.unsure[q.id] ? 'on' : ''}`}
                    onClick={toggleUnsure}
                    aria-pressed={!!t.unsure[q.id]}
                    title="Đánh dấu đoán/chưa chắc — câu đúng nhưng chưa chắc vẫn được ôn lại sớm"
                  >
                    🤔 Chưa chắc <span className="kbd">U</span>
                  </button>
                  {practice && (!revealed || hinted) && (
                    <button
                      type="button"
                      className={`chip hint-chip ${hinted ? 'on' : ''} ${!q.hint ? 'is-disabled' : ''}`}
                      onClick={openHint}
                      aria-disabled={!q.hint || revealed}
                      aria-pressed={hinted}
                      title={
                        !q.hint
                          ? 'Câu này chưa có gợi ý — ENRICH sẽ bổ sung dần'
                          : hinted
                            ? 'Đã mở gợi ý — câu dùng gợi ý sẽ được ôn lại sớm hơn'
                            : 'Gợi ý một ý (không lộ đáp án) — câu dùng gợi ý sẽ được ôn lại sớm hơn'
                      }
                    >
                      💡 Gợi ý <span className="kbd">H</span>
                    </button>
                  )}
                  <span
                    className={`small q-time ${spentHere > q.time ? 'warn' : 'muted'}`}
                    title={
                      revealed
                        ? 'Thời gian trả lời (chốt lúc bấm Kiểm tra) / thời gian chuẩn — thời gian đọc giải thích sau đó không bị tính là làm chậm'
                        : 'Thời gian ở câu này / thời gian chuẩn'
                    }
                  >
                    ⏱ {fmtDuration(spentHere)} / {fmtDuration(q.time)}
                  </span>
                </div>
                <div className="row runner-nav">
                  <button className="btn" onClick={prev} disabled={prevDisabled}>
                    ← Trước
                  </button>
                  {pearson && t.reachedEnd && !inReviewList && (
                    <button className="btn" onClick={openReview} title="Màn hình xem lại">
                      ☰<span className="hide-sm"> Xem lại</span>
                    </button>
                  )}
                  <button className="btn primary" onClick={primary.onClick} disabled={primary.disabled}>
                    {primary.label} {primary.kbd && <span className="kbd">↵</span>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!pearson && (
            <aside className="card stack sm runner-side">
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
                  const again = isRelearnId(x.id);
                  return (
                    <button
                      key={x.id}
                      className={`${cls} ${i === t.current ? 'current' : ''} ${again ? 'relearn' : ''}`}
                      onClick={() => goIndex(i)}
                      title={again ? `Học lại câu ${numberOf(x.id)} (${baseId(x.id)})` : x.id}
                    >
                      {again ? `🔁${numberOf(x.id)}` : numberOf(x.id)}
                      {(t.flags[x.id] || t.unsure[x.id]) && <span className="flag">{t.flags[x.id] ? '🚩' : '🤔'}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="tiny muted">
                Chuẩn: {fmtDuration(t.session.estimateTotal)} · {limit ? `giới hạn ${fmtDuration(limit)}` : 'không giới hạn'}
              </div>
              {t.session.notes.length > 0 && <div className="alert warn tiny">{t.session.notes.join(' ')}</div>}
              <div className="tiny muted runner-keys">
                <span className="kbd">1</span>–<span className="kbd">5</span> chọn · <span className="kbd">Shift</span>+<span className="kbd">1</span> gạch bỏ (hoặc chuột phải)
                {practice ? (
                  <>
                    {' '}
                    · <span className="kbd">H</span> gợi ý
                  </>
                ) : null}
                {keywords ? (
                  <>
                    {' '}
                    · <span className="kbd">K</span> tô từ khóa
                  </>
                ) : null}
              </div>
            </aside>
          )}
        </div>
      </div>

      {t.pausedAt && (
        <div className="paused-cover">
          <div className="stack" style={{ alignItems: 'center' }}>
            <div style={{ fontSize: 46 }}>⏸</div>
            <h2>{resumedFrom ? 'Sẵn sàng làm tiếp' : 'Đã tạm dừng'}</h2>
            <div className="muted">Đồng hồ dừng, câu hỏi được ẩn.</div>
            {resumedFrom && (
              <div className="small resume-note">
                ⏯ Làm tiếp bài từ <b>{resumedFrom}</b> — đã trả lời {answeredCount}/{prog.total} câu; thời gian chuyển máy không bị tính.
              </div>
            )}
            <button className="btn primary lg" onClick={togglePause}>
              ▶ Tiếp tục
            </button>
          </div>
        </div>
      )}

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Nộp bài?">
        <div className="stack">
          <div>
            Đã trả lời <b>{answeredCount}</b>/{prog.total} câu
            {unanswered > 0 && <span className="bad"> · còn {unanswered} câu bỏ trống (tính là sai)</span>}
            {flagged > 0 && <span> · 🚩 {flagged} câu cắm cờ</span>}.
          </div>
          {stop.relearnOpen > 0 && <div className="small muted">🔁 {stop.relearnOpen} câu học lại chưa làm — bỏ qua cũng không sao (không tính điểm).</div>}
          {stoppable && unanswered > 0 && answeredCount > 0 && (
            <div className="small stop-alt">
              Chưa làm hết? <b>⏹ Dừng ở đây</b> chỉ lưu {answeredCount} câu đã làm — câu chưa làm không bị tính sai và quay lại hàng chờ.
            </div>
          )}
          {remaining !== undefined && <div className="small muted">Còn lại {fmtDuration(remaining)}.</div>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirm(false)}>
              Làm tiếp
            </button>
            {stoppable && unanswered > 0 && answeredCount > 0 && (
              <button className="btn" disabled={submitting} onClick={() => submit(false, true)}>
                ⏹ Dừng & lưu phần đã làm
              </button>
            )}
            <button className="btn primary" disabled={submitting} onClick={() => submit(false)}>
              {submitting ? 'Đang nộp…' : 'Nộp bài & xem kết quả'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={stopOpen} onClose={() => setStopOpen(false)} title="⏹ Dừng ở đây?">
        {stop.answered > 0 ? (
          <div className="stack">
            <div>
              Lưu <b>{stop.answered}</b> câu đã làm — điểm tính trên {stop.answered} câu này
              {stop.unseen > 0 && (
                <>
                  , <b>{stop.unseen}</b> câu chưa xem quay lại hàng chờ (không bị tính sai)
                </>
              )}
              .
            </div>
            {stop.skipped > 0 && <div className="small muted">{stop.skipped} câu đã mở nhưng để trống được ghi là “bỏ qua”: không chấm, sẽ được hỏi lại sau.</div>}
            {stop.relearnOpen > 0 && <div className="small muted">🔁 {stop.relearnOpen} câu học lại chưa làm được bỏ qua.</div>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setStopOpen(false)}>
                Làm tiếp
              </button>
              <button className="btn primary" disabled={submitting} onClick={() => submit(false, true)}>
                {submitting ? 'Đang lưu…' : '⏹ Dừng & lưu phần đã làm'}
              </button>
            </div>
          </div>
        ) : (
          <div className="stack">
            <div>Bạn chưa trả lời câu nào — không có gì để lưu. Các câu của bài này vẫn ở trong hàng chờ.</div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setStopOpen(false)}>
                Làm tiếp
              </button>
              <button className="btn danger" onClick={abandon}>
                🗑 Bỏ bài này
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!conflict} onClose={() => setConflict(undefined)} title="⏯ Bài này vừa được làm tiếp ở thiết bị khác">
        {conflict && (
          <div className="stack">
            <div>
              <b>{conflict.device ?? 'Thiết bị khác'}</b> đã làm tiếp bài này lúc {fmtDateTime(conflict.updatedAt)}: đã trả lời{' '}
              <b>{progressOf(conflict.test).answered}</b>/{progressOf(conflict.test).total} câu. Bản trên máy này: <b>{answeredCount}</b>/{prog.total} câu.
            </div>
            <div className="small muted">Chọn một bản để làm tiếp — bản còn lại sẽ được thay thế.</div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={keepMine}>
                Giữ bản trên máy này
              </button>
              <button className="btn primary" onClick={() => takeRemote(conflict, 'newer')}>
                ⏯ Lấy tiến độ từ {conflict.device ?? 'thiết bị khác'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={endConfirm} onClose={() => setEndConfirm(false)} title="Kết thúc bài thi?">
        <div className="stack">
          <div>
            Sau khi kết thúc, bạn <b>không thể quay lại</b> sửa đáp án — bài được chấm ngay.
          </div>
          <div>
            Đã trả lời <b>{answeredCount}</b>/{prog.total} câu
            {unanswered > 0 && <span className="bad"> · {unanswered} câu chưa trả lời (tính là sai)</span>}
            {flagged > 0 && <span> · 🚩 {flagged} câu cắm cờ</span>}.
          </div>
          {remaining !== undefined && <div className="small muted">Còn lại {fmtDuration(remaining)}.</div>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn"
              onClick={() => {
                setEndConfirm(false);
                if (!reviewing) openReview();
              }}
            >
              Quay lại xem lại
            </button>
            <button className="btn primary" disabled={submitting} onClick={() => submit(false)}>
              {submitting ? 'Đang nộp…' : 'Kết thúc & chấm điểm'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * [v5] Notes under a checked practice answer: relearn (this retry does not count / this question comes back), the sibling
 * substitution (`for`), the discriminate compare link, and the qualifier-family table after a family's 2nd member.
 */
function AfterAnswer({ t, q, slot, queued, forId, pair }: { t: ActiveTest; q: Question; slot: boolean; queued: boolean; forId?: string; pair?: [string, string] }) {
  // questions between this one and its relearn retry (the retry lands at the end when fewer are left)
  const queuedIn = t.questions.findIndex((x) => x.id === q.id + RELEARN_SUFFIX) - t.questions.findIndex((x) => x.id === q.id) - 1;
  const family = !slot && q.family ? t.questions.filter((x) => !isRelearnId(x.id) && x.family === q.family && t.revealed[x.id]) : [];
  const notes = [
    slot && (
      <div key="slot" className="after-note relearn-note">
        🔁 Lần hỏi lại này không tính điểm — nhớ lại ngay sau khi sai giúp nhớ lâu hơn.
      </div>
    ),
    queued && (
      <div key="queued" className="after-note relearn-note">
        🔁 Câu này sẽ được hỏi lại {queuedIn > 0 ? `sau ${queuedIn} câu nữa` : 'ngay sau câu này'} — lựa chọn được ẩn, bạn nhớ lại ý chính trước.
      </div>
    ),
    forId && (
      <div key="for" className="after-note for-note">
        ↔ Câu anh em của câu bạn đã thuộc (<span className="mono">{forId}</span>): trả lời ở đây được tính là lượt ôn cho cả hai câu.
      </div>
    ),
    pair && pair[0] !== pair[1] && (
      <div key="pair" className="after-note">
        <a className="btn sm pair-link" href={href(`/pair?a=${encodeURIComponent(pair[0])}&b=${encodeURIComponent(pair[1])}`)}>
          🔀 So sánh {pair[0]} ⟷ {pair[1]}
        </a>
      </div>
    ),
  ].filter(Boolean);
  if (!notes.length && family.length < 2) return null;
  return (
    <div className="after-answer">
      {notes}
      {family.length >= 2 && <FamilyTable t={t} members={family} current={q.id} />}
    </div>
  );
}

/** [v5] Qualifier family: the same scenario and options, a different final question → a different answer. */
function FamilyTable({ t, members, current }: { t: ActiveTest; members: Question[]; current: string }) {
  const answerText = (m: Question) =>
    m.answer
      .map((k) => m.options.find((o) => o.key === k)?.text ?? k)
      .map((x) => (x.length > 110 ? `${x.slice(0, 109)}…` : x))
      .join(' + ');
  return (
    <div className="family-table">
      <div className="small">
        <b>🎯 Cùng tình huống, đổi yêu cầu</b> — chỉ câu hỏi cuối khác nhau, đáp án đổi theo:
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Yêu cầu</th>
              <th>Đáp án</th>
              <th>Bạn</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className={m.id === current ? 'current' : ''}>
                <td>
                  {(m.requirements ?? []).map((r) => (
                    <span key={r} title={REQUIREMENT_INFO[r]?.label}>
                      {REQUIREMENT_INFO[r]?.icon ?? ''}{' '}
                    </span>
                  ))}
                  {finalAsk(m.stem)}
                </td>
                <td>
                  <InlineMarkdown text={answerText(m)} />
                </td>
                <td>{isCorrect(t.answers[m.id] ?? [], m.answer) ? '✓' : '✗'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** [v5] This browser has no test, another device left one unfinished: resume it here (or drop it). */
function RemoteResume({ info, onResume, onDiscard }: { info: MirrorInfo; onResume: () => void; onDiscard: () => void }) {
  const mode = info.mode ? MODE_INFO[info.mode as keyof typeof MODE_INFO] : undefined;
  return (
    <div className="card pad-lg stack remote-resume">
      <div>
        <h2>⏯ Bài đang làm dở trên {info.device ?? 'thiết bị khác'}</h2>
        <p className="small dim" style={{ marginTop: 6 }}>
          {mode?.icon} <b>{info.title}</b>
          {info.total ? ` · đã trả lời ${info.answered ?? 0}/${info.total} câu` : ''} · cập nhật {fmtDateTime(info.updatedAt)}
        </p>
        <p className="small muted" style={{ marginTop: 4 }}>
          Làm tiếp trên máy này: bài mở ở trạng thái tạm dừng, thời gian chuyển máy không bị tính.
        </p>
      </div>
      <div className="row">
        <button type="button" className="btn primary" onClick={onResume}>
          ▶ Làm tiếp trên máy này
        </button>
        <button type="button" className="btn ghost" onClick={onDiscard}>
          🗑 Bỏ bài đó
        </button>
        <a className="btn ghost" href={href('/new')}>
          ✍️ Tạo bài mới
        </a>
      </div>
    </div>
  );
}

/** Finished tests the server has not confirmed yet (no connection when submitting). They are sent again automatically. */
function PendingSubmits({ entries }: { entries: OutboxEntry[] }) {
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    const sent = await flushOutbox({ explicit: true });
    setBusy(false);
    if (sent.some((x) => x.differs)) toast(DIFFERS_NOTE);
    if (sent.length) navigate(`/result/${encodeURIComponent(sent[sent.length - 1].attempt.id)}`, { replace: true });
    else toast('Vẫn chưa gửi được — app sẽ tự thử lại khi có kết nối.');
  };
  const discard = (e: OutboxEntry) => {
    if (window.confirm(`Bỏ bài “${e.req.session.title}”? Các câu trả lời của bài này sẽ không được lưu.`)) dropFromOutbox(e.req.session.sessionId);
  };
  return (
    <div className="card pad-lg stack pending-submits">
      <div>
        <h2>⏳ Bài đang chờ nộp</h2>
        <p className="small dim" style={{ marginTop: 6 }}>
          Chưa gửi được tới máy chủ (mất mạng, hoặc app đang khởi động lại). Bài đã được lưu trên trình duyệt này và sẽ <b>tự nộp lại</b> khi có kết nối
          hoặc khi mở lại trang — không cần làm lại, giờ nộp giữ nguyên.
        </p>
      </div>
      {entries.map((e) => {
        const answered = e.req.answers.filter((a) => a.pick.length > 0 && !a.relearn).length;
        const planned = new Set(e.req.session.questions.map((r) => r.id)).size;
        return (
          <div key={e.req.session.sessionId} className={`alert ${e.permanent ? 'bad' : 'warn'} stack sm`}>
            <div>
              <b>
                {MODE_INFO[e.req.session.mode]?.icon} {e.req.session.title}
              </b>{' '}
              <span className="small">
                · đã trả lời {answered}/{planned} câu{e.req.stoppedEarly ? ' · ⏹ dừng sớm' : ''} · xong lúc {fmtDateTime(e.req.finishedAt)}
              </span>
            </div>
            <div className="tiny">
              {e.error ? `Lần gửi gần nhất: ${e.error}` : 'Đang gửi…'}
              {e.tries ? ` · đã thử ${e.tries} lần` : ''}
              {e.permanent ? ' · máy chủ từ chối nên app không tự gửi lại — bấm “Thử nộp lại ngay” hoặc bỏ bài' : ''}
            </div>
            <div className="row">
              <button type="button" className="btn ghost sm" onClick={() => discard(e)}>
                🗑 Bỏ bài này
              </button>
            </div>
          </div>
        );
      })}
      <div className="row">
        <button type="button" className="btn primary" onClick={() => void retry()} disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" /> Đang nộp…
            </>
          ) : (
            '🔁 Thử nộp lại ngay'
          )}
        </button>
        <a className="btn ghost" href={href('/')}>
          ← Về Tổng quan
        </a>
      </div>
    </div>
  );
}

const FILTER_LABEL: Record<ReviewFilter, string> = { all: 'Tất cả', flagged: '🚩 Cắm cờ', unanswered: '⬜ Chưa trả lời' };
const FILTER_REVIEW: Record<ReviewFilter, string> = { all: 'tất cả', flagged: 'câu cắm cờ', unanswered: 'câu chưa trả lời' };

/** Pearson VUE-style end-of-exam review: status grid, filters, review navigation, end exam. */
function ReviewScreen({
  t,
  filter,
  onFilter,
  onOpen,
  onEnd,
  remaining,
}: {
  t: ActiveTest;
  filter: ReviewFilter;
  onFilter: (f: ReviewFilter) => void;
  onOpen: (id: string, ids: string[]) => void;
  onEnd: () => void;
  remaining?: number;
}) {
  const items = t.questions.map((x, i) => ({ id: x.id, i, answered: (t.answers[x.id] ?? []).length > 0, flagged: !!t.flags[x.id], unsure: !!t.unsure[x.id] }));
  const lists: Record<ReviewFilter, typeof items> = {
    all: items,
    flagged: items.filter((x) => x.flagged),
    unanswered: items.filter((x) => !x.answered),
  };
  const shown = lists[filter];
  const ids = shown.map((x) => x.id);
  const answered = items.length - lists.unanswered.length;
  return (
    <div className="card pad-lg review-screen">
      <div className="review-head">
        <h2>☰ Màn hình xem lại</h2>
        <div className="small muted">
          Đã trả lời <b className="num">{answered}</b>/{items.length} · <span className={lists.unanswered.length ? 'bad' : ''}>{lists.unanswered.length} chưa trả lời</span> · 🚩 {lists.flagged.length} cắm cờ
          {remaining !== undefined && <> · ⏱ còn {fmtDuration(remaining)}</>}
        </div>
        <p className="small dim">
          Bấm một câu để mở lại. Khi xem lại theo danh sách, nút <b>Tiếp</b> chỉ đi qua các câu trong danh sách rồi quay về màn hình này. Bấm <b>Kết thúc bài thi</b> khi đã sẵn sàng nộp.
        </p>
      </div>
      {t.session.notes.length > 0 && <div className="alert warn tiny">{t.session.notes.join(' ')}</div>}
      <div className="seg review-filter" role="tablist" aria-label="Lọc câu">
        {(Object.keys(FILTER_LABEL) as ReviewFilter[]).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => onFilter(f)}>
            {FILTER_LABEL[f]} <span className="n num">{lists[f].length}</span>
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="review-grid">
          {shown.map((x) => (
            <button
              key={x.id}
              type="button"
              className={`review-tile ${x.answered ? 'answered' : 'open'} ${x.flagged ? 'flagged' : ''}`}
              onClick={() => onOpen(x.id, ids)}
              title={`Câu ${x.i + 1}: ${x.answered ? 'đã trả lời' : 'chưa trả lời'}${x.flagged ? ' · cắm cờ' : ''}${x.unsure ? ' · chưa chắc' : ''}`}
            >
              <span className="n num">{x.i + 1}</span>
              <span className="st">{x.answered ? 'đã làm' : 'chưa làm'}</span>
              {(x.flagged || x.unsure) && (
                <span className="fl" aria-hidden="true">
                  {x.flagged ? '🚩' : '🤔'}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="empty small">{filter === 'flagged' ? 'Không có câu nào cắm cờ.' : 'Bạn đã trả lời tất cả các câu. 👍'}</div>
      )}
      <div className="review-actions">
        <button type="button" className="btn" disabled={!shown.length} onClick={() => shown.length && onOpen(shown[0].id, ids)}>
          ▶ Xem lại {FILTER_REVIEW[filter]}
        </button>
        <span className="spacer" />
        <button type="button" className="btn primary" onClick={onEnd}>
          Kết thúc bài thi
        </button>
      </div>
    </div>
  );
}
