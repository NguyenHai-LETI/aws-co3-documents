// "🤖 Hỏi AI về câu này": a read-only Claude Code answer in Vietnamese, logged to coach/qa/<qid>.md
// (the coach reads these to see what confuses the learner).
// [v5 τ] Second tab "🧑‍🏫 Gia sư": a Socratic dialog (POST /api/tutor/start|turn|end) — guiding questions, the key only after
// 3 replies or "tôi chịu", a closing rule saved to the 📒 notebook. Open it directly with `mode="tutor"` (Result stepper).
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import { useData, useFetch } from '../lib/store.tsx';
import { href } from '../lib/router.ts';
import { InlineMarkdown, Markdown } from '../lib/markdown.tsx';
import { fmtDateTime, fmtDuration } from '../lib/format.ts';
import { Loading, Modal, Tabs, toast } from './ui.tsx';
import { fmtUsd, useEscLayer } from './insights.tsx';
import type { QaEntry, Question, TutorDialog, TutorStatus } from '../../shared/types.ts';
import '../styles-tutor.css';

/** Which tab the dialog opens on. */
export type AskMode = 'ask' | 'tutor';

/** [v5 τ] The learner's answer for the tutor (original option keys). `attemptId`: the server fills what is missing from it. */
export interface AskContext {
  why?: string;
  elim?: string;
  unsure?: boolean;
  hinted?: boolean;
  attemptId?: string;
}

interface Pending {
  question: string;
  started: number;
  promise: Promise<QaEntry>;
}
// In-flight questions survive closing the dialog: the server keeps working and logs the answer.
const pending = new Map<string, Pending>();

const NONE: QaEntry[] = [];

function sameEntry(a: QaEntry, b: QaEntry) {
  return a.at === b.at && a.question === b.question;
}

/** Previous questions to the AI (and 🧑‍🏫 tutor dialogs) about one question (newest last). `kind` filters one of the two. */
export function QaHistory({ qid, extra = NONE, empty, kind }: { qid: string; extra?: QaEntry[]; empty?: string; kind?: 'ask' | 'tutor' }) {
  const { data } = useFetch<QaEntry[]>(`/api/qa/${encodeURIComponent(qid)}`);
  const list = useMemo(() => {
    const base = Array.isArray(data) ? data : [];
    const all = [...base, ...extra.filter((e) => !base.some((b) => sameEntry(b, e)))];
    return kind ? all.filter((e) => (kind === 'tutor') === (e.kind === 'tutor')) : all;
  }, [data, extra, kind]);
  if (!list.length) return empty ? <div className="small muted">{empty}</div> : null;
  return (
    <div className="ins-qa-list">
      {list.map((e) => (
        <div key={`${e.at}-${e.question}`} className="ins-qa">
          <div className="ins-qa-q">
            {e.kind === 'tutor' ? '🧑‍🏫' : '🙋'} {e.question}
            {e.pick && <span className="badge"> đã chọn {e.pick}</span>}
          </div>
          {e.kind === 'tutor' ? (
            <details>
              <summary className="small">{e.rule ? <>📌 {e.rule}</> : 'Xem hội thoại'}</summary>
              <div className="ins-qa-a">
                <Markdown text={e.answer} base="trainer/coach/qa/" />
              </div>
            </details>
          ) : (
            <div className="ins-qa-a">
              <Markdown text={e.answer} base="trainer/coach/qa/" />
            </div>
          )}
          <div className="tiny muted">
            {fmtDateTime(e.at)}
            {e.costUsd ? ` · ${fmtUsd(e.costUsd)} (quy đổi API)` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Modal for asking Claude about one question. `pick` = the learner's choice (original keys). `mode` = the tab it opens on;
 * `context` = the rest of the learner's answer for the tutor.
 */
export function AskDialog({ q, pick, onClose, mode = 'ask', context }: { q: Question | undefined; pick?: string; onClose: () => void; mode?: AskMode; context?: AskContext }) {
  const [tab, setTab] = useState<AskMode>(mode);
  const qid = q?.id;
  useEffect(() => setTab(mode), [qid, mode]);
  useEscLayer(!!q, onClose);
  return (
    <Modal
      open={!!q}
      onClose={onClose}
      wide
      title={
        <>
          {tab === 'tutor' ? '🧑‍🏫 Gia sư' : '🤖 Hỏi AI'} · câu <code>{qid}</code>
        </>
      }
    >
      {q && (
        <div className="stack ins-wrap">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'ask', label: '🤖 Hỏi AI' },
              { id: 'tutor', label: '🧑‍🏫 Gia sư' },
            ]}
          />
          {tab === 'ask' ? <AskPanel key={q.id} q={q} pick={pick} onClose={onClose} /> : <TutorPanel key={q.id} q={q} pick={pick} context={context} onClose={onClose} />}
        </div>
      )}
    </Modal>
  );
}

// ── 🤖 Hỏi AI ───────────────────────────────────────────────────────────────

function AskPanel({ q, pick, onClose }: { q: Question; pick?: string; onClose: () => void }) {
  const { meta } = useData();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<{ question: string; started: number }>();
  const [answers, setAnswers] = useState<QaEntry[]>([]);
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const attach = (p: Pending) => {
    setBusy({ question: p.question, started: p.started });
    p.promise.then(
      (entry) => {
        if (!alive.current) return;
        setAnswers((a) => [...a, entry]);
        setBusy(undefined);
      },
      (e: Error) => {
        if (!alive.current) return;
        setError(e.message);
        setBusy(undefined);
      },
    );
  };

  useEffect(() => {
    const p = pending.get(q.id);
    if (p) attach(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const submit = (raw: string) => {
    const question = raw.trim();
    if (!question || pending.has(q.id)) return;
    const id = q.id;
    const promise = api.post<QaEntry>('/api/ask', { qid: id, question, pick: pick || undefined }).finally(() => pending.delete(id));
    const p: Pending = { question, started: Date.now(), promise };
    pending.set(id, p);
    setText('');
    setError(undefined);
    setNow(Date.now());
    attach(p);
    promise.then(
      () => !alive.current && toast(`🤖 AI đã trả lời câu hỏi về ${id} — mở lại “Hỏi AI” để xem.`),
      (e: Error) => !alive.current && toast(`Hỏi AI thất bại (${id}): ${e.message}`),
    );
  };

  const claudeOk = meta?.claude?.available !== false;
  const wrongPick = !!pick && pick !== q.answer.join('');
  const prompts = [
    'Vì sao đáp án đúng là đúng?',
    ...(wrongPick ? [`Vì sao lựa chọn ${pick} của tôi chưa đúng?`] : []),
    'So sánh nhanh các phương án',
    'Từ khoá nào trong đề quyết định đáp án?',
    'Khi nào phương án khác mới đúng?',
  ];

  return (
    <>
      <div className="small dim ins-clamp">{q.stem}</div>
      <div className="ins-qa-scroll">
        <QaHistory qid={q.id} extra={answers} kind="ask" empty={busy ? undefined : 'Chưa có câu hỏi nào về câu này.'} />
        {busy && (
          <div className="ins-qa pending" aria-live="polite">
            <div className="ins-qa-q">🙋 {busy.question}</div>
            <div className="row small" style={{ gap: 8 }}>
              <span className="spinner" /> Claude đang trả lời… <b className="num">{fmtDuration((now - busy.started) / 1000)}</b>
            </div>
            <div className="tiny muted">Thường mất 30 giây – 4 phút. Có thể đóng hộp thoại: câu trả lời vẫn được lưu và hiện lại khi mở.</div>
          </div>
        )}
      </div>
      {error && <div className="ins-wrap alert bad small">⚠️ {error}</div>}
      {!claudeOk && <div className="ins-wrap alert warn small">⚠️ Chưa tìm thấy Claude Code CLI trên máy này. {meta?.claude?.hint}</div>}
      <div className="row" style={{ gap: 6 }}>
        {prompts.map((p) => (
          <button key={p} type="button" className="chip" onClick={() => setText(p)} disabled={!!busy}>
            {p}
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        maxLength={500}
        value={text}
        disabled={!!busy}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(text);
        }}
        placeholder="Hỏi gì cũng được về câu này… (Ctrl/⌘ + Enter để gửi)"
      />
      <div className="row between">
        <span className="tiny muted ins-wrap" style={{ flex: '1 1 260px' }}>
          Claude chỉ đọc (không sửa file), có thể tra notes trong repo; trả lời ≤ 220 từ. Lưu ở <code>trainer/coach/qa/{q.id}.md</code> để AI Coach biết bạn còn
          vướng gì.
        </span>
        <div className="row">
          <button className="btn ghost" onClick={onClose}>
            Đóng
          </button>
          <button className="btn primary" disabled={!!busy || !text.trim() || !claudeOk} onClick={() => submit(text)}>
            Gửi câu hỏi
          </button>
        </div>
      </div>
    </>
  );
}

// ── 🧑‍🏫 Gia sư ─────────────────────────────────────────────────────────────

interface TutorPending {
  label: string; // the learner's text (or "Bắt đầu")
  started: number;
  promise: Promise<TutorDialog>;
}
// A reply in flight survives closing the dialog (the server finishes the turn; reopening shows it).
const tutorPending = new Map<string, TutorPending>();

const OUTCOME: Record<string, string> = {
  found: '🎉 Bạn tự tìm ra đáp án',
  revealed: '🔓 Gia sư nêu đáp án sau 3 lượt',
  'gave-up': '🏳️ Bạn xin xem đáp án',
  capped: '⏳ Hết lượt gia sư hôm nay',
  ended: '⏹ Đã dừng hội thoại',
};

function TutorPanel({ q, pick, context, onClose }: { q: Question; pick?: string; context?: AskContext; onClose: () => void }) {
  const [status, setStatus] = useState<TutorStatus>();
  const [dialog, setDialog] = useState<TutorDialog>();
  const [busy, setBusy] = useState<{ label: string; started: number }>();
  const [error, setError] = useState<string>();
  const [text, setText] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const alive = useRef(true);
  const chat = useRef<HTMLDivElement>(null);

  const attach = (p: TutorPending) => {
    setBusy({ label: p.label, started: p.started });
    setNow(Date.now());
    p.promise.then(
      (d) => {
        if (!alive.current) return;
        setDialog(d);
        setStatus((s) => (s ? { ...s, usage: d.usage } : s));
        setBusy(undefined);
      },
      (e: Error) => {
        if (!alive.current) return;
        setError(e.message);
        setBusy(undefined);
      },
    );
  };

  useEffect(() => {
    alive.current = true;
    api
      .get<TutorStatus>(`/api/tutor?qid=${encodeURIComponent(q.id)}`)
      .then((s) => {
        if (!alive.current) return;
        setStatus(s);
        if (s.dialog) setDialog(s.dialog);
      })
      .catch((e: Error) => alive.current && setError(e.message));
    const p = tutorPending.get(q.id);
    if (p) attach(p);
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [busy]);

  useEffect(() => {
    chat.current?.scrollTo({ top: chat.current.scrollHeight, behavior: 'smooth' });
  }, [dialog?.messages.length, busy]);

  const run = (label: string, call: () => Promise<TutorDialog>) => {
    if (tutorPending.has(q.id)) return;
    const id = q.id;
    const promise = call().finally(() => tutorPending.delete(id));
    const p: TutorPending = { label, started: Date.now(), promise };
    tutorPending.set(id, p);
    setError(undefined);
    attach(p);
    promise.then(
      () => !alive.current && toast(`🧑‍🏫 Gia sư đã trả lời về câu ${id} — mở lại để xem.`),
      (e: Error) => !alive.current && toast(`Gia sư (${id}): ${e.message}`),
    );
  };

  const start = () =>
    run('', () =>
      api.post<TutorDialog>('/api/tutor/start', {
        qid: q.id,
        ...(pick ? { pick } : {}),
        ...(context?.why ? { why: context.why } : {}),
        ...(context?.elim ? { elim: context.elim } : {}),
        ...(typeof context?.unsure === 'boolean' ? { unsure: context.unsure } : {}),
        ...(typeof context?.hinted === 'boolean' ? { hinted: context.hinted } : {}),
        ...(context?.attemptId ? { attemptId: context.attemptId } : {}),
      }),
    );
  const send = (giveUp = false) => {
    if (!dialog) return;
    const t = text.trim();
    if (!t && !giveUp) return;
    const id = dialog.id;
    setText('');
    run(t || '🏳️ Tôi chịu', () => api.post<TutorDialog>('/api/tutor/turn', { id, text: t, ...(giveUp ? { giveUp: true } : {}) }));
  };
  const end = () => {
    if (!dialog) return;
    const id = dialog.id;
    run('⏹', () => api.post<TutorDialog>('/api/tutor/end', { id }));
  };

  if (!status && !error) return <Loading text="Đang mở gia sư…" />;
  const usage = dialog?.usage ?? status?.usage;
  const open = dialog?.status === 'open';
  const closed = dialog?.status === 'closed';
  const keyText = (dialog?.answer ?? []).map((k) => q.options.find((o) => o.key === k)?.text ?? k);
  const pickText = pick ? q.options.filter((o) => pick.includes(o.key)).map((o) => o.text) : [];
  const turn = (dialog?.learnerTurns ?? 0) + 1;
  const reveal = dialog?.revealAfter ?? status?.revealAfter ?? 3;

  return (
    <>
      <div className="small dim ins-clamp">{q.stem}</div>
      {!dialog && (
        <div className="stack sm">
          <div className="alert info small">
            🧑‍🏫 Gia sư <b>không nói ngay đáp án</b>: AI hỏi dẫn dắt để bạn tự tìm ra chỗ suy luận chưa đúng. Đáp án hiện sau <b>{reveal} lượt</b> trả lời
            (hoặc khi bạn bấm “🏳️ Tôi chịu”), rồi gia sư chốt <b>một quy tắc</b> và lưu vào 📒 Sổ lỗi.
          </div>
          {(pickText.length > 0 || context?.why || context?.unsure) && (
            <div className="tu-ctx small">
              {pickText.length > 0 && (
                <span className="badge">
                  Bạn đã chọn: <InlineMarkdown text={pickText.join(' + ')} />
                </span>
              )}
              {context?.unsure && <span className="badge warn">chưa chắc</span>}
              {context?.why && <span className="badge">Vì sao: {context.why}</span>}
            </div>
          )}
          {status && !status.enabled && <div className="alert warn small ins-wrap">⚠️ {status.reason}</div>}
          <QaHistory qid={q.id} kind="tutor" />
        </div>
      )}
      {dialog && (
        <div className="tu-chat" ref={chat} aria-live="polite">
          {dialog.messages.map((m, i) => (
            <div key={`${m.at}-${i}`} className={`tu-msg ${m.role}`}>
              <span className="tu-avatar" aria-hidden>
                {m.role === 'tutor' ? '🧑‍🏫' : '🙋'}
              </span>
              <div className="tu-bubble">{m.role === 'tutor' ? <Markdown text={m.text} /> : m.text}</div>
            </div>
          ))}
          {busy && busy.label && busy.label !== '⏹' && (
            <div className="tu-msg learner">
              <span className="tu-avatar" aria-hidden>
                🙋
              </span>
              <div className="tu-bubble">{busy.label}</div>
            </div>
          )}
        </div>
      )}
      {busy && (
        <div className="tu-msg pending">
          <span className="tu-avatar" aria-hidden>
            🧑‍🏫
          </span>
          <div className="tu-bubble small">
            <span className="spinner" /> Gia sư đang nghĩ… <b className="num">{fmtDuration((now - busy.started) / 1000)}</b>
            <div className="tiny muted">Thường 10–60 giây. Có thể đóng hộp thoại: lượt này vẫn được ghi lại.</div>
          </div>
        </div>
      )}
      {closed && (
        <div className="stack sm">
          <div className="small">
            <b>{OUTCOME[dialog!.outcome ?? 'ended']}</b>
            {dialog!.costUsd ? <span className="tiny muted"> · {fmtUsd(dialog!.costUsd)} (quy đổi API)</span> : null}
          </div>
          {keyText.length > 0 && (
            <div className="tu-answer">
              ✅ Đáp án đúng: <InlineMarkdown text={keyText.join(' + ')} />
            </div>
          )}
          {dialog!.rule && (
            <div className="tu-rule">
              📌 <b>Quy tắc:</b> {dialog!.rule}
              <div className="tiny" style={{ marginTop: 4 }}>
                Đã lưu vào{' '}
                <a href={href(`/notes?tab=notebook${dialog!.notebookKey ? `&k=${encodeURIComponent(dialog!.notebookKey)}` : ''}`)} onClick={onClose}>
                  📒 Sổ lỗi
                </a>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <div className="ins-wrap alert bad small">⚠️ {error}</div>}
      {open && (
        <div className="tu-composer stack sm">
          <div className="tiny muted">
            {dialog!.pickOk
              ? `Bạn đã chọn đúng — gia sư kiểm tra lập luận (tối đa ${reveal} lượt).`
              : `Lượt ${Math.min(turn, reveal)}/${reveal} — đáp án hiện sau lượt ${reveal}, hoặc khi bạn bấm “Tôi chịu”.`}
          </div>
          <textarea
            rows={3}
            maxLength={1000}
            value={text}
            disabled={!!busy}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
            }}
            placeholder="Trả lời gia sư… (Ctrl/⌘ + Enter để gửi; trên điện thoại có thể đọc chính tả bằng bàn phím)"
          />
        </div>
      )}
      <div className="row between">
        <span className="tiny muted ins-wrap" style={{ flex: '1 1 220px' }}>
          {usage ? `Hôm nay còn ${usage.remaining}/${usage.limit} lượt gia sư.` : ''} Hội thoại lưu ở <code>trainer/coach/qa/{q.id}.md</code>.
        </span>
        <div className="tu-actions">
          <button className="btn ghost" onClick={onClose}>
            Đóng
          </button>
          {!dialog || closed ? (
            <button className="btn primary" onClick={start} disabled={!!busy || !status?.enabled || (usage?.remaining ?? 0) <= 0}>
              {closed ? '🧑‍🏫 Hội thoại mới' : '🧑‍🏫 Bắt đầu với gia sư'}
            </button>
          ) : (
            <>
              <button className="btn ghost" onClick={end} disabled={!!busy} title="Dừng — hội thoại vẫn được lưu cho AI Coach">
                ⏹ Kết thúc
              </button>
              <button className="btn" onClick={() => send(true)} disabled={!!busy || !!dialog.pickOk}>
                🏳️ Tôi chịu
              </button>
              <button className="btn primary" onClick={() => send()} disabled={!!busy || !text.trim()}>
                Gửi
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
