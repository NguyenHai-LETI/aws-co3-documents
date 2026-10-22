import { useMemo, type ReactNode } from 'react';
import { InlineMarkdown, Markdown, renderMarkdown } from '../lib/markdown.tsx';
import { useData } from '../lib/store.tsx';
import { href } from '../lib/router.ts';
import { highlightWithCategories, keywordLabel } from '../lib/keywords.ts';
import { multiLabel } from '../../shared/scoring.ts';
import { TierBadge } from './TierBadge.tsx';
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
  /** Option keys the learner struck out — shown struck; in reveal mode a struck correct option is flagged.
   *  A result-file string such as "CD" is accepted too. */
  elim?: string[] | string;
  /** Interactive strike toggle (✕ button / right-click on the option). */
  onStrike?: (key: string) => void;
  /** Keyword categories → phrases to tint in the stem (meta.keywords); null/undefined = off. */
  highlight?: Record<string, string[]> | null;
  /** Recall-first: what the learner wrote before seeing the options ("Bạn đã nghĩ: …"). */
  recall?: string;
  /** Recall-first gate: hide the options (the runner shows its own input instead). */
  hideOptions?: boolean;
  /** Extra content between the stem and the options (hint, recall input…). */
  beforeOptions?: ReactNode;
  /** Show the exam-guide task badge in the meta row. */
  showTask?: boolean;
  /** [v5] Extra badge after "Câu N / M" (e.g. "🔁 Học lại" for an in-session relearn retry). */
  tag?: ReactNode;
  /** [v5] Question id to show (a relearn slot shows the id of the question it repeats). */
  idText?: string;
}

export function QuestionMeta({ q, extra, task }: { q: Question; extra?: React.ReactNode; task?: boolean }) {
  const { topic, domain, meta } = useData();
  const t = topic(q.topic);
  const d = domain(q.domain);
  const diff = meta?.difficulties.find((x) => x.id === q.difficulty)?.label ?? q.difficulty;
  const taskDef = task && q.task ? meta?.tasks?.find((x) => x.id === q.task) : undefined;
  return (
    <div className="row small" style={{ gap: 6 }}>
      <span className="badge">{t ? `${t.icon} ${t.label}` : q.topic}</span>
      {d && <span className="badge" title={d.label}>{d.code} · {d.label_vi}</span>}
      {task && q.task && (
        <span className="badge" title={taskDef ? `${taskDef.label} — ${taskDef.label_vi}` : undefined}>
          Task {q.task}
        </span>
      )}
      <span className="badge">{diff}</span>
      <TierBadge q={q} />
      <span className="badge" title="Thời gian chuẩn ước lượng">⏱ {q.time}s</span>
      {q.origin !== 'imported' && <span className="badge accent">{q.origin === 'ai' ? '🤖 AI' : q.origin === 'doc' ? '📄 Tài liệu' : '✍️ Thủ công'}</span>}
      {q.variantOf.length > 0 && <span className="badge accent" title={`Biến thể của ${q.variantOf.join(', ')}`}>↻ biến thể</span>}
      {extra}
    </div>
  );
}

export function QuestionView({
  q,
  index,
  total,
  order,
  picked,
  onPick,
  reveal,
  showMeta = true,
  compact,
  elim,
  onStrike,
  highlight,
  recall,
  hideOptions,
  beforeOptions,
  showTask,
  tag,
  idText,
}: Props) {
  const { topic } = useData();
  const keys = order && order.length === q.options.length ? order : q.options.map((o) => o.key);
  const multi = q.answer.length > 1;
  const correct = reveal && picked.length > 0 && picked.length === q.answer.length && picked.every((k) => q.answer.includes(k));
  const notes = topic(q.topic)?.notes ?? [];
  const displayOf = (key: string) => (keys !== order ? key : letterFor(keys.indexOf(key)));
  const struckSet = new Set(typeof elim === 'string' ? [...elim] : (elim ?? []));
  const stem = useMemo(() => highlightWithCategories(renderMarkdown(q.stem ?? ''), highlight), [q.stem, highlight]);
  const recallText = recall?.trim();

  return (
    <div className="qv">
      {(index !== undefined || showMeta || tag) && (
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            {index !== undefined && (
              <span className="badge accent num">
                Câu {index + 1}
                {total ? ` / ${total}` : ''}
              </span>
            )}
            {tag}
            <span className="tiny muted mono">{idText ?? q.id}</span>
          </div>
          {showMeta && <QuestionMeta q={q} task={showTask} />}
        </div>
      )}
      <div className="q-stem" style={compact ? { fontSize: 15 } : undefined}>
        <div className="md" dangerouslySetInnerHTML={{ __html: stem.html }} />
      </div>
      {highlight && stem.cats.length > 0 && (
        <div className="kw-legend" aria-label="Chú thích tô sáng">
          <span aria-hidden="true">🖍</span>
          {stem.cats.map((c) => (
            <mark key={c} className={`kw kw-${c}`}>
              {keywordLabel(c)}
            </mark>
          ))}
        </div>
      )}
      {multi && (
        <div className="q-hint">
          ☑ Chọn {q.answer.length} đáp án (Choose {multiLabel(q.answer.length)})
        </div>
      )}
      {beforeOptions}
      {recallText && !hideOptions && (
        <div className="recall-note">
          <span className="recall-label">🧠 Bạn đã nghĩ:</span> <span className="recall-text">{recallText}</span>
        </div>
      )}
      {!hideOptions && (
        <div className={`opts ${onStrike ? 'can-strike' : ''}`}>
          {keys.map((key, i) => {
            const opt = q.options.find((o) => o.key === key);
            if (!opt) return null;
            const isPicked = picked.includes(key);
            const isAnswer = q.answer.includes(key);
            const struck = struckSet.has(key) && !isPicked;
            const letter = keys === order ? letterFor(i) : key;
            let cls = '';
            let mark = '';
            if (reveal) {
              if (isAnswer && isPicked) [cls, mark] = ['correct', '✓ bạn chọn đúng'];
              else if (isAnswer) [cls, mark] = ['correct missed', '✓ đáp án đúng'];
              else if (isPicked) [cls, mark] = ['wrong', '✗ bạn chọn'];
            } else if (isPicked) cls = 'selected';
            const struckCorrect = reveal && struck && isAnswer;
            return (
              <div key={key} className={`opt-row ${struck ? 'is-struck' : ''}`}>
                <button
                  type="button"
                  className={`opt ${multi ? 'multi' : ''} ${cls} ${struck ? 'struck' : ''}`}
                  onClick={() => onPick?.(key)}
                  onContextMenu={
                    onStrike
                      ? (e) => {
                          e.preventDefault();
                          onStrike(key);
                        }
                      : undefined
                  }
                  disabled={!onPick}
                  aria-pressed={isPicked}
                >
                  <span className="key">{letter}</span>
                  <span className="text">
                    <InlineMarkdown text={opt.text} />
                  </span>
                  {(mark || struckCorrect) && (
                    <span className="marks">
                      {mark && <span className={`mark ${cls.startsWith('wrong') ? 'bad' : 'good'}`}>{mark}</span>}
                      {struckCorrect && (
                        <span className="mark bad elim-bad" title="Bạn đã gạch bỏ (loại trừ) chính đáp án đúng này">
                          ⚠ đã loại nhầm
                        </span>
                      )}
                    </span>
                  )}
                </button>
                {onStrike && (
                  <button
                    type="button"
                    className={`opt-strike ${struck ? 'on' : ''}`}
                    onClick={() => onStrike(key)}
                    aria-pressed={struck}
                    aria-label={struck ? `Bỏ loại trừ phương án ${letter}` : `Loại trừ phương án ${letter}`}
                    title={struck ? 'Bỏ gạch (Shift+số hoặc chuột phải)' : `Gạch bỏ phương án ${letter} (Shift+${i + 1} hoặc chuột phải)`}
                  >
                    {struck ? '↺' : '✕'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {reveal && !hideOptions && (
        <div className={`explain ${correct ? 'good' : 'bad'}`}>
          <h4>
            {picked.length === 0 ? '⏭ Bỏ trống' : correct ? '✅ Chính xác' : '❌ Chưa đúng'} — đáp án: {q.answer.map(displayOf).join(', ')}
            {keys === order && <span className="tiny muted"> (gốc: {q.answer.join(', ')})</span>}
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
