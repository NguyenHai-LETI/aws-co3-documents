import { useMemo, useState } from 'react';
import { useData, useFetch } from '../lib/store.tsx';
import { href, navigate } from '../lib/router.ts';
import { startTest } from '../lib/start.ts';
import { fmtDateTime, fmtDuration } from '../lib/format.ts';
import { QuestionView } from '../components/QuestionView.tsx';
import { IssueDialog } from '../components/IssueDialog.tsx';
import { BarList, Meter } from '../components/charts.tsx';
import { Empty, ErrorBox, Loading, Tabs } from '../components/ui.tsx';
import { MODE_INFO, FEEDBACK_INFO } from '../../shared/labels.ts';
import type { Attempt, AttemptSummary, BuildTestRequest, Question } from '../../shared/types.ts';

type Filter = 'all' | 'wrong' | 'right' | 'flag' | 'slow';

export function ResultPage({ id }: { id: string }) {
  const { meta, topic } = useData();
  const { data, error, loading } = useFetch<{ attempt: Attempt; summary: AttemptSummary; questions: (Question | null)[] }>(id ? `/api/results/${encodeURIComponent(id)}` : null, [id]);
  const [filter, setFilter] = useState<Filter>('all');
  const [issueFor, setIssueFor] = useState<string>();

  const rows = useMemo(() => {
    if (!data) return [];
    return data.attempt.answers.map((r, i) => ({ r, q: data.questions[i], n: i + 1 }));
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data || !meta) return null;
  const { attempt: a, summary } = data;
  const wrongIds = rows.filter((x) => !x.r.ok && x.q).map((x) => x.r.q);
  const shown = rows.filter(({ r }) => {
    if (filter === 'wrong') return !r.ok;
    if (filter === 'right') return r.ok;
    if (filter === 'flag') return r.flag || r.unsure;
    if (filter === 'slow') return r.est && r.t > r.est * 1.5;
    return true;
  });
  const counts = {
    wrong: rows.filter((x) => !x.r.ok).length,
    right: rows.filter((x) => x.r.ok).length,
    flag: rows.filter((x) => x.r.flag || x.r.unsure).length,
    slow: rows.filter((x) => x.r.est && x.r.t > x.r.est * 1.5).length,
  };
  const avgT = a.answers.length ? Math.round(a.answers.reduce((s, r) => s + r.t, 0) / a.answers.length) : 0;
  const avgEst = a.answers.length ? Math.round(a.answers.reduce((s, r) => s + r.est, 0) / a.answers.length) : 0;

  const retry = (ids: string[], title: string) =>
    startTest({ mode: 'ids', ids, title, feedback: 'practice', timing: { preset: 'standard' }, shuffleOptions: true });
  const again = () => {
    const sel = (a.selection ?? {}) as BuildTestRequest;
    if (a.mode === 'ids' || a.mode === 'coach' || a.mode === 'pack') {
      void startTest({ mode: 'ids', ids: a.answers.map((r) => r.q), title: `Làm lại: ${a.title}`, feedback: a.feedback, timing: { preset: 'standard' } });
    } else void startTest({ ...sel, mode: a.mode, count: a.total });
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="small muted">
            <a href={href('/history')}>← Lịch sử</a> · {MODE_INFO[a.mode]?.icon} {MODE_INFO[a.mode]?.label} · {FEEDBACK_INFO[a.feedback].label} · {fmtDateTime(a.finished)}
          </div>
          <h1 style={{ marginTop: 6 }}>{a.title}</h1>
        </div>
        <div className="row">
          {wrongIds.length > 0 && (
            <button className="btn primary" onClick={() => retry(wrongIds, `Làm lại ${wrongIds.length} câu sai — ${a.title}`)}>
              🔁 Làm lại {wrongIds.length} câu sai
            </button>
          )}
          <button className="btn" onClick={again}>
            ↻ Làm bài tương tự
          </button>
          <a className="btn ghost" href={href(`/notes?f=${encodeURIComponent('trainer/' + a.file)}`)} title={a.file}>
            📄 File .md
          </a>
        </div>
      </div>

      <section className="split-l">
        <div className="card stack">
          <div className="small muted">Kết quả</div>
          <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
            <span className="hero-figure">{a.score}%</span>
            <span className={`badge ${a.passed ? 'good' : 'bad'}`}>{a.passed ? '✓ Đạt' : '✗ Chưa đạt'}</span>
          </div>
          <Meter value={a.score} target={meta.exam.pass_pct} label="Điểm" />
          <div className="small dim">
            {a.correct}/{a.total} câu đúng · quy đổi <b>{a.scaled}</b>/1000 (đỗ ≥ {meta.exam.pass_scaled})
          </div>
          <div className="divider" style={{ margin: '4px 0' }} />
          <div className="stack sm small">
            <div className="row between">
              <span className="muted">Thời gian làm</span>
              <b className="num">
                {fmtDuration(a.timeUsed)}
                {a.timeLimit ? ` / ${fmtDuration(a.timeLimit)}` : ''}
                {a.timedOut ? ' ⏰' : ''}
              </b>
            </div>
            <div className="row between">
              <span className="muted">TB mỗi câu (bạn / chuẩn)</span>
              <b className="num">
                {avgT}s / {avgEst}s
              </b>
            </div>
            <div className="row between">
              <span className="muted">Bỏ trống</span>
              <b className="num">{a.total - a.answered}</b>
            </div>
            {a.plan && (
              <div className="row between">
                <span className="muted">Kế hoạch AI</span>
                <a href={href('/coach')} className="mono tiny">
                  {a.plan}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="grid c2">
          <div className="card">
            <h2>Theo domain</h2>
            <BarList
              target={meta.exam.pass_pct}
              items={meta.domains
                .filter((d) => summary.domains[d.id])
                .map((d) => {
                  const g = summary.domains[d.id];
                  const v = Math.round((g.correct / g.total) * 100);
                  return { key: d.id, label: `${d.code} ${d.label_vi}`, value: v, valueText: `${g.correct}/${g.total} · ${v}%` };
                })}
            />
          </div>
          <div className="card">
            <h2>Theo chủ đề</h2>
            <BarList
              target={meta.exam.pass_pct}
              items={Object.entries(summary.topics)
                .sort((x, y) => x[1].correct / x[1].total - y[1].correct / y[1].total)
                .map(([k, g]) => {
                  const v = Math.round((g.correct / g.total) * 100);
                  const t = topic(k);
                  return {
                    key: k,
                    label: t ? `${t.icon} ${t.label}` : k,
                    value: v,
                    valueText: `${g.correct}/${g.total} · ${v}%`,
                    title: 'Bấm để luyện thêm chủ đề này',
                    onClick: () => navigate(`/new?mode=topic&topics=${k}`),
                  };
                })}
            />
          </div>
        </div>
      </section>

      <section>
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { id: 'all', label: `Tất cả (${rows.length})` },
            { id: 'wrong', label: `❌ Sai (${counts.wrong})` },
            { id: 'right', label: `✅ Đúng (${counts.right})` },
            { id: 'flag', label: `🚩 Cờ / chưa chắc (${counts.flag})` },
            { id: 'slow', label: `🐢 Chậm (${counts.slow})` },
          ]}
        />
        {shown.length === 0 && <Empty icon="🎉" title="Không có câu nào trong mục này" />}
        <div className="stack">
          {shown.map(({ r, q, n }) =>
            q ? (
              <div key={r.q} className="card" id={`q-${n}`}>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className={`badge ${r.ok ? 'good' : 'bad'}`}>
                      {r.ok ? '✓' : '✗'} Câu {n}
                    </span>
                    {r.flag && <span className="badge warn">🚩 cờ</span>}
                    {r.unsure && <span className="badge warn">🤔 chưa chắc</span>}
                    <span className={`small ${r.t > r.est * 1.5 ? 'warn' : 'muted'}`}>
                      ⏱ {r.t}s / chuẩn {r.est}s
                    </span>
                  </div>
                  <div className="row">
                    <a className="btn ghost sm" href={href(`/bank?q=${encodeURIComponent(q.id)}`)}>
                      🗂️ Lịch sử câu
                    </a>
                    <button className="btn ghost sm" onClick={() => setIssueFor(q.id)}>
                      🐞 Báo lỗi
                    </button>
                  </div>
                </div>
                <QuestionView q={q} picked={[...r.pick]} reveal showMeta compact />
                {r.key !== q.answer.join('') && (
                  <div className="alert warn small" style={{ marginTop: 10 }}>
                    ℹ️ Đáp án lúc chấm là <b>{r.key}</b>, ngân hàng hiện tại là <b>{q.answer.join(', ')}</b> (câu đã được sửa sau bài này).
                  </div>
                )}
              </div>
            ) : (
              <div key={r.q} className="card small muted">
                Câu {n}: <code>{r.q}</code> không còn trong ngân hàng (chọn {r.pick || '—'}, đáp án {r.key}).
              </div>
            ),
          )}
        </div>
      </section>
      <IssueDialog qid={issueFor} onClose={() => setIssueFor(undefined)} />
    </div>
  );
}
