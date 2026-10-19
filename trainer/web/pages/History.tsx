import { useEffect, useState } from 'react';
import { useFetch } from '../lib/store.tsx';
import { navigate, useRoute } from '../lib/router.ts';
import { fmtDateTime, fmtDuration } from '../lib/format.ts';
import { ChartCard, LineChart, Meter } from '../components/charts.tsx';
import { AttemptBadges } from '../components/insights.tsx';
import { Empty, ErrorBox, Loading } from '../components/ui.tsx';
import { MODE_INFO } from '../../shared/labels.ts';
import type { ResultsPage, TestMode } from '../../shared/types.ts';

const PAGE = 50;

/** History filters live in the URL (#/history?page=2&mode=srs&q=…&hide=1): back from a result returns to the same page. */
function setQuery(patch: Record<string, string | number | undefined>, current: URLSearchParams) {
  const p = new URLSearchParams(current);
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === '' || v === 0) p.delete(k);
    else p.set(k, String(v));
  }
  const qs = p.toString();
  navigate(`/history${qs ? `?${qs}` : ''}`, { replace: true });
}

export function History() {
  const { query } = useRoute();
  const page = Math.max(0, Number(query.get('page') ?? 1) - 1) || 0;
  const mode = query.get('mode') ?? '';
  const q = query.get('q') ?? '';
  const hideRushed = query.get('hide') === '1';
  const [typed, setTyped] = useState(q);
  useEffect(() => setTyped(q), [q]);
  // title search: update the URL (→ refetch) once typing pauses
  useEffect(() => {
    if (typed === q) return;
    const t = setTimeout(() => setQuery({ q: typed.trim() || undefined, page: undefined }, query), 300);
    return () => clearTimeout(t);
  }, [typed, q, query]);

  const params = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) });
  if (mode) params.set('mode', mode);
  if (q) params.set('q', q);
  if (hideRushed) params.set('rushed', '0');
  const { data, error, loading } = useFetch<ResultsPage>(`/api/results?${params}`, [], { keep: true });

  if (loading && !data) return <Loading />;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const skipped = total - (data?.counted ?? 0);
  const trend = data?.trend ?? [];
  const filtered = !!(mode || q || hideRushed);
  const pager = pages > 1 && (
    <div className="row" style={{ justifyContent: 'center' }}>
      <button className="btn sm" disabled={page === 0} onClick={() => setQuery({ page: page }, query)}>
        ← Mới hơn
      </button>
      <span className="small muted">
        Trang {page + 1}/{pages} · bài {page * PAGE + 1}–{Math.min(total, page * PAGE + PAGE)} / {total}
      </span>
      <button className="btn sm" disabled={page >= pages - 1} onClick={() => setQuery({ page: page + 2 }, query)}>
        Cũ hơn →
      </button>
    </div>
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>🕘 Lịch sử làm bài</h1>
          <p>
            Mỗi bài là 1 file Markdown trong <code>trainer/results/</code>. {total} bài · điểm TB {data?.avgScore ?? 0}%{skipped ? ' (không tính bài làm vội)' : ''} · tổng{' '}
            {fmtDuration(data?.timeUsed ?? 0, { long: true })}.
          </p>
        </div>
        <div className="row">
          <select value={mode} onChange={(e) => setQuery({ mode: e.target.value || undefined, page: undefined }, query)} aria-label="Lọc theo chế độ">
            <option value="">Mọi chế độ</option>
            {(data?.modes ?? []).map((m) => (
              <option key={m} value={m}>
                {MODE_INFO[m as TestMode]?.label ?? m}
              </option>
            ))}
            {(data?.pearson ?? 0) > 0 && <option value="pearson">🎓 Mô phỏng Pearson VUE</option>}
          </select>
          <input type="search" placeholder="Tìm theo tiêu đề…" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Tìm theo tiêu đề" />
          {(data?.rushed ?? 0) > 0 && (
            <label className="row small nowrap" style={{ gap: 6 }}>
              <input type="checkbox" checked={hideRushed} onChange={(e) => setQuery({ hide: e.target.checked ? 1 : undefined, page: undefined }, query)} /> Ẩn {data?.rushed} bài làm vội
            </label>
          )}
        </div>
      </div>
      <ErrorBox error={error} />
      {!total ? (
        filtered ? (
          <Empty icon="🔎" title="Không có bài nào khớp bộ lọc">
            <a href="#/history">Bỏ lọc</a>
          </Empty>
        ) : (
          <Empty icon="📭" title="Chưa có bài làm nào">
            Bắt đầu ở mục <a href="#/new">Tạo bài test</a>.
          </Empty>
        )
      ) : (
        <div className="stack">
          {trend.length > 1 && (
            <ChartCard
              title="Điểm theo thời gian"
              subtitle={`${trend.length} bài gần nhất — vạch ngang là ngưỡng đỗ 72%${skipped ? ` · bỏ qua ${skipped} bài làm vội` : ''}`}
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
          {pager}
          <div className="card" style={{ padding: 6, opacity: loading ? 0.6 : 1 }} aria-busy={loading}>
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
                  {(data?.items ?? []).map((a) => (
                    <tr key={a.id} className={`click ${a.rushed ? 'ins-row-dim' : ''}`} onClick={() => navigate(`/result/${encodeURIComponent(a.id)}`)}>
                      <td className="nowrap small">{fmtDateTime(a.finished)}</td>
                      <td className="nowrap small">
                        {MODE_INFO[a.mode]?.icon} {MODE_INFO[a.mode]?.label ?? a.mode}
                      </td>
                      <td>
                        {a.title}
                        {(a.pearson || a.rushed) && (
                          <div className="row" style={{ gap: 4, marginTop: 2 }}>
                            <AttemptBadges a={a} />
                          </div>
                        )}
                      </td>
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
                        {a.pilotTotal ? (
                          <div className="tiny muted" title="Câu thử nghiệm (không tính điểm)">
                            +{a.pilotCorrect ?? 0}/{a.pilotTotal} 🧪
                          </div>
                        ) : null}
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
          {pager}
        </div>
      )}
    </div>
  );
}
