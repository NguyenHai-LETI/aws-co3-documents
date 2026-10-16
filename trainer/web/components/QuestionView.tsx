import { InlineMarkdown, Markdown } from '../lib/markdown.tsx';
import { useData } from '../lib/store.tsx';
import { href } from '../lib/router.ts';
import { multiLabel } from '../../shared/scoring.ts';
import type { Question } from '../../shared/types.ts';

export function letterFor(index: number): string {
  return String.fromCharCode(65 + index);
}

interface Props {
  q: Question;
  index?: number;
  total?: number;
  order?: string[]; // display order of original keys (shuffled options)
  picked: string[];
  onPick?: (key: string) => void;
  reveal?: boolean;
  showMeta?: boolean;
  compact?: boolean;
}

export function QuestionMeta({ q, extra }: { q: Question; extra?: React.ReactNode }) {
  const { topic, domain, meta } = useData();
  const t = topic(q.topic);
  const d = domain(q.domain);
  const diff = meta?.difficulties.find((x) => x.id === q.difficulty)?.label ?? q.difficulty;
  return (
    <div className="row small" style={{ gap: 6 }}>
      <span className="badge">{t ? `${t.icon} ${t.label}` : q.topic}</span>
      {d && <span className="badge" title={d.label}>{d.code} · {d.label_vi}</span>}
      <span className="badge">{diff}</span>
      <span className="badge" title="Thời gian chuẩn ước lượng">⏱ {q.time}s</span>
      {q.origin !== 'imported' && <span className="badge accent">{q.origin === 'ai' ? '🤖 AI' : q.origin === 'doc' ? '📄 Tài liệu' : '✍️ Thủ công'}</span>}
      {q.variantOf.length > 0 && <span className="badge accent" title={`Biến thể của ${q.variantOf.join(', ')}`}>↻ biến thể</span>}
      {extra}
    </div>
  );
}

export function QuestionView({ q, index, total, order, picked, onPick, reveal, showMeta = true, compact }: Props) {
  const { topic } = useData();
  const keys = order && order.length === q.options.length ? order : q.options.map((o) => o.key);
  const multi = q.answer.length > 1;
  const correct = reveal && picked.length > 0 && picked.length === q.answer.length && picked.every((k) => q.answer.includes(k));
  const notes = topic(q.topic)?.notes ?? [];
  const displayOf = (key: string) => (order ? letterFor(keys.indexOf(key)) : key);

  return (
    <div>
      {(index !== undefined || showMeta) && (
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            {index !== undefined && (
              <span className="badge accent num">
                Câu {index + 1}
                {total ? ` / ${total}` : ''}
              </span>
            )}
            <span className="tiny muted mono">{q.id}</span>
          </div>
          {showMeta && <QuestionMeta q={q} />}
        </div>
      )}
      <div className="q-stem" style={compact ? { fontSize: 15 } : undefined}>
        <Markdown text={q.stem} />
      </div>
      {multi && (
        <div className="q-hint">
          ☑ Chọn {q.answer.length} đáp án (Choose {multiLabel(q.answer.length)})
        </div>
      )}
      <div className="opts">
        {keys.map((key, i) => {
          const opt = q.options.find((o) => o.key === key)!;
          const isPicked = picked.includes(key);
          const isAnswer = q.answer.includes(key);
          let cls = '';
          let mark = '';
          if (reveal) {
            if (isAnswer && isPicked) [cls, mark] = ['correct', '✓ bạn chọn đúng'];
            else if (isAnswer) [cls, mark] = ['correct missed', '✓ đáp án đúng'];
            else if (isPicked) [cls, mark] = ['wrong', '✗ bạn chọn'];
          } else if (isPicked) cls = 'selected';
          return (
            <button
              key={key}
              type="button"
              className={`opt ${multi ? 'multi' : ''} ${cls}`}
              onClick={() => onPick?.(key)}
              disabled={!onPick}
              aria-pressed={isPicked}
            >
              <span className="key">{order ? letterFor(i) : key}</span>
              <span className="text">
                <InlineMarkdown text={opt.text} />
              </span>
              {mark && <span className={`mark ${cls.startsWith('wrong') ? 'bad' : 'good'}`}>{mark}</span>}
            </button>
          );
        })}
      </div>
      {reveal && (
        <div className={`explain ${correct ? 'good' : 'bad'}`}>
          <h4>
            {picked.length === 0 ? '⏭ Bỏ trống' : correct ? '✅ Chính xác' : '❌ Chưa đúng'} — đáp án: {q.answer.map(displayOf).join(', ')}
            {order && <span className="tiny muted"> (gốc: {q.answer.join(', ')})</span>}
          </h4>
          {q.explanation ? <Markdown text={q.explanation} /> : <span className="muted">Chưa có giải thích.</span>}
          {notes.length > 0 && (
            <div className="tiny" style={{ marginTop: 8 }}>
              📖 Ôn lại:{' '}
              {notes.map((n, i) => (
                <span key={n}>
                  {i > 0 && ' · '}
                  <a href={href(`/notes?f=${encodeURIComponent(n)}`)}>{n}</a>
                </span>
              ))}
              {q.refs.filter((r) => !notes.includes(r)).map((r) => (
                <span key={r}>
                  {' · '}
                  <a href={href(`/notes?f=${encodeURIComponent(r.split('#')[0])}`)}>{r}</a>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
