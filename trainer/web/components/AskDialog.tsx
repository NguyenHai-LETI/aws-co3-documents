// "🤖 Hỏi AI về câu này": a read-only Claude Code answer in Vietnamese, logged to coach/qa/<qid>.md
// (the coach reads these to see what confuses the learner).
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import { useData, useFetch } from '../lib/store.tsx';
import { Markdown } from '../lib/markdown.tsx';
import { fmtDateTime, fmtDuration } from '../lib/format.ts';
import { Modal, toast } from './ui.tsx';
import { fmtUsd, useEscLayer } from './insights.tsx';
import type { QaEntry, Question } from '../../shared/types.ts';

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

/** Previous questions to the AI about one question (newest last). */
export function QaHistory({ qid, extra = NONE, empty }: { qid: string; extra?: QaEntry[]; empty?: string }) {
  const { data } = useFetch<QaEntry[]>(`/api/qa/${encodeURIComponent(qid)}`);
  const list = useMemo(() => {
    const base = Array.isArray(data) ? data : [];
    return [...base, ...extra.filter((e) => !base.some((b) => sameEntry(b, e)))];
  }, [data, extra]);
  if (!list.length) return empty ? <div className="small muted">{empty}</div> : null;
  return (
    <div className="ins-qa-list">
      {list.map((e) => (
        <div key={`${e.at}-${e.question}`} className="ins-qa">
          <div className="ins-qa-q">
            🙋 {e.question}
            {e.pick && <span className="badge"> đã chọn {e.pick}</span>}
          </div>
          <div className="ins-qa-a">
            <Markdown text={e.answer} base="trainer/coach/qa/" />
          </div>
          <div className="tiny muted">
            {fmtDateTime(e.at)}
            {e.costUsd ? ` · ${fmtUsd(e.costUsd)} (quy đổi API)` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Modal for asking Claude about one question. `pick` = the learner's choice (original keys). */
export function AskDialog({ q, pick, onClose }: { q: Question | undefined; pick?: string; onClose: () => void }) {
  const { meta } = useData();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<{ question: string; started: number }>();
  const [answers, setAnswers] = useState<QaEntry[]>([]);
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const qid = q?.id;
  const cur = useRef(qid);
  cur.current = qid;
  useEscLayer(!!q, onClose);

  const attach = (id: string, p: Pending) => {
    setBusy({ question: p.question, started: p.started });
    p.promise.then(
      (entry) => {
        if (cur.current !== id) return;
        setAnswers((a) => [...a, entry]);
        setBusy(undefined);
      },
      (e: Error) => {
        if (cur.current !== id) return;
        setError(e.message);
        setBusy(undefined);
      },
    );
  };

  useEffect(() => {
    setAnswers([]);
    setError(undefined);
    setBusy(undefined);
    setText('');
    if (!qid) return;
    const p = pending.get(qid);
    if (p) attach(qid, p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qid]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const submit = (raw: string) => {
    const question = raw.trim();
    if (!q || !question || pending.has(q.id)) return;
    const id = q.id;
    const promise = api.post<QaEntry>('/api/ask', { qid: id, question, pick: pick || undefined }).finally(() => pending.delete(id));
    const p: Pending = { question, started: Date.now(), promise };
    pending.set(id, p);
    setText('');
    setError(undefined);
    setNow(Date.now());
    attach(id, p);
    promise.then(
      () => cur.current !== id && toast(`🤖 AI đã trả lời câu hỏi về ${id} — mở lại “Hỏi AI” để xem.`),
      (e: Error) => cur.current !== id && toast(`Hỏi AI thất bại (${id}): ${e.message}`),
    );
  };

  const claudeOk = meta?.claude?.available !== false;
  const wrongPick = !!pick && !!q && pick !== q.answer.join('');
  const prompts = [
    'Vì sao đáp án đúng là đúng?',
    ...(wrongPick ? [`Vì sao lựa chọn ${pick} của tôi chưa đúng?`] : []),
    'So sánh nhanh các phương án',
    'Từ khoá nào trong đề quyết định đáp án?',
    'Khi nào phương án khác mới đúng?',
  ];

  return (
    <Modal
      open={!!q}
      onClose={onClose}
      wide
      title={
        <>
          🤖 Hỏi AI về câu <code>{qid}</code>
        </>
      }
    >
      {q && (
        <div className="stack ins-wrap">
          <div className="small dim ins-clamp">{q.stem}</div>
          <div className="ins-qa-scroll">
            <QaHistory qid={q.id} extra={answers} empty={busy ? undefined : 'Chưa có câu hỏi nào về câu này.'} />
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
              Claude chỉ đọc (không sửa file), có thể tra notes trong repo; trả lời ≤ 220 từ. Lưu ở <code>trainer/coach/qa/{q.id}.md</code> để AI Coach biết bạn
              còn vướng gì.
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
        </div>
      )}
    </Modal>
  );
}
