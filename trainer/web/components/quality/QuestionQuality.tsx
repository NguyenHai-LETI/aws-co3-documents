// Question drawer block ([Q]): item-writing flaws of this question (GET /api/quality/lint?id=…), its latest
// blind-solve verdict (GET /api/verify → latest) and [v6] its choices-only cue probe when the options gave the key away
// (GET /api/verify → cues). Renders nothing when all are clean / unavailable.
import { useFetch } from '../../lib/store.tsx';
import { SeverityBadge } from './common.tsx';
import { VerdictBadge, useCue, useVerifyLatest } from './VerifySection.tsx';
import type { LintFlaw, Question } from '../../../shared/types.ts';

export function QuestionQuality({ q }: { q: Question }) {
  const lint = useFetch<{ id: string; flaws: LintFlaw[] }>(`/api/quality/lint?id=${encodeURIComponent(q.id)}`, [q.id, q.hash]);
  const verdict = useVerifyLatest()?.[q.id];
  const cue = useCue(q);
  const flaws = lint.data?.id === q.id ? lint.data.flaws : [];
  if (!flaws.length && !verdict && !cue) return null;
  return (
    <div className="card flat stack sm small">
      <b>🩺 Chất lượng câu hỏi</b>
      {flaws.map((f, i) => (
        <div key={i} className="row qq-dflaw">
          <SeverityBadge severity={f.severity} />
          <span className="ins-wrap" style={{ minWidth: 0 }}>
            {f.message} <code className="tiny muted">{f.code}</code>
          </span>
        </div>
      ))}
      {verdict && (
        <div className="stack sm">
          <div className="row" style={{ gap: 6 }}>
            <VerdictBadge v={verdict} current={q.hash} />
            <span className="tiny muted">
              {verdict.picked ? `model chọn ${verdict.picked}` : ''}
              {verdict.key ? ` · đáp án lúc kiểm ${verdict.key}` : ''}
              {verdict.model ? ` · ${verdict.model}` : ''} · {verdict.date}
            </span>
          </div>
          {verdict.reason && <div className="dim ins-wrap">{verdict.reason}</div>}
        </div>
      )}
      {cue && (
        <div className="row qq-dflaw">
          <span className="badge warn" title="Chỉ nhìn phương án (không có đề), model vẫn chọn đúng đáp án ở cả hai lần xáo">
            🕵️ lộ đáp án
          </span>
          <span className="ins-wrap" style={{ minWidth: 0 }}>
            Chỉ nhìn phương án đã đoán trúng {cue.key ?? 'đáp án'}
            {cue.reason ? ` — ${cue.reason}` : ''} <span className="tiny muted">{cue.date}</span>
          </span>
        </div>
      )}
    </div>
  );
}
