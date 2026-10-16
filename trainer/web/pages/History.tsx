import { useMemo, useState } from 'react';
import { useFetch } from '../lib/store.tsx';
import { navigate } from '../lib/router.ts';
import { fmtDateTime, fmtDuration } from '../lib/format.ts';
import { ChartCard, LineChart, Meter } from '../components/charts.tsx';
import { Empty, ErrorBox, Loading } from '../components/ui.tsx';
import { MODE_INFO } from '../../shared/labels.ts';
import type { AttemptSummary, TestMode } from '../../shared/types.ts';

export function History() {
  const { data, error, loading } = useFetch<AttemptSummary[]>('/api/results');
  const [mode, setMode] = useState<string>('');
  const [q, setQ] = useState('');
  const list = useMemo(
    () => (data ?? []).filter((a) => (!mode || a.mode === mode) && (!q || a.title.toLowerCase().includes(q.toLowerCase()))),
    [data, mode, q],
  );
  if (loading && !data) return <Loading />;
  const modes = [...new Set((data ?? []).map((a) => a.mode))];
  const trend = [...list].reverse().slice(-40);
  const totalTime = list.reduce((s, a) => s + a.timeUsed, 0);
  const avg = list.length ? Math.round((list.reduce((s, a) => s + a.score, 0) / list.length) * 10) / 10 : 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>🕘 Lịch sử làm bài</h1>
          <p>
            Mỗi bài là 1 file Markdown trong <code>trainer/results/</code>. {list.length} bài · điểm TB {avg}% · tổng {fmtDuration(totalTime, { long: true })}.
          </p>
        </div>
        <div className="row">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="">Mọi chế độ</option>
            {modes.map((m) => (
              <option key={m} value={m}>
                {MODE_INFO[m as TestMode]?.label ?? m}
              </option>
            ))}
          </select>
          <input type="search" placeholder="Tìm theo tiêu đề…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <ErrorBox error={error} />
      {!list.length ? (
        <Empty icon="📭" title="Chưa có bài làm nào">
          Bắt đầu ở mục <a href="#/new">Tạo bài test</a>.
        </Empty>
      ) : (
        <div className="stack">
          {trend.length > 1 && (
            <ChartCard
              title="Điểm theo thời gian"
              subtitle={`${trend.length} bài gần nhất — vạch ngang là ngưỡng đỗ 72%`}
              table={{ head: ['Bài', 'Ngày', 'Điểm %'], rows: trend.map((a) => [a.title, fmtDateTime(a.finished), a.score]) }}
            >
              <LineChart
                target={72}
                points={trend.map((a) => ({
                  label: fmtDateTime(a.finished).split(' ')[0],
                  value: a.score,
                  detail: `${a.title} · ${a.correct}/${a.total}`,
                  onClick: () => navigate(`/result/${encodeURIComponent(a.id)}`),
                }))}
              />
            </ChartCard>
          )}
          <div className="card" style={{ padding: 6 }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Chế độ</th>
                    <th>Tiêu đề</th>
                    <th style={{ width: 200 }}>Điểm</th>
                    <th className="num">Đúng</th>
                    <th className="num">Thời gian</th>
                    <th>KQ</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id} className="click" onClick={() => navigate(`/result/${encodeURIComponent(a.id)}`)}>
                      <td className="nowrap small">{fmtDateTime(a.finished)}</td>
                      <td className="nowrap small">
                        {MODE_INFO[a.mode]?.icon} {MODE_INFO[a.mode]?.label ?? a.mode}
                      </td>
                      <td>{a.title}</td>
                      <td>
                        <div className="row nowrap" style={{ gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <Meter value={a.score} target={72} />
                          </div>
                          <b className="num small">{a.score}%</b>
                        </div>
                      </td>
                      <td className="num">
                        {a.correct}/{a.total}
                      </td>
                      <td className="num small">
                        {fmtDuration(a.timeUsed)}
                        {a.timedOut ? ' ⏰' : ''}
                      </td>
                      <td>
                        <span className={`badge ${a.passed ? 'good' : 'bad'}`}>{a.passed ? '✓ Đạt' : '✗'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
