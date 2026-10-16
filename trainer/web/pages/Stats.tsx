import { useState } from 'react';
import { useData, useFetch } from '../lib/store.tsx';
import { href, navigate } from '../lib/router.ts';
import { compact, fmtDateTime, fmtDuration } from '../lib/format.ts';
import { BarList, ChartCard, Heatmap, Kpi, LineChart, Meter, StackBar } from '../components/charts.tsx';
import { Empty, ErrorBox, Loading, Seg } from '../components/ui.tsx';
import type { Bucket, StatsResponse } from '../../shared/types.ts';

function WeakTable({ rows, kind }: { rows: Bucket[]; kind: 'services' | 'tags' }) {
  if (!rows.length) return <div className="small muted">Cần ít nhất 3 lượt trả lời cho mỗi mục.</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{kind === 'services' ? 'Service' : 'Khái niệm (tag)'}</th>
            <th className="num">Lượt</th>
            <th style={{ width: '34%' }}>Tỉ lệ đúng</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.key}>
              <td className="small">{b.label}</td>
              <td className="num small">{b.attempts}</td>
              <td>
                <div className="row nowrap" style={{ gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <Meter value={b.accuracy} target={72} />
                  </div>
                  <span className="num small">{b.accuracy}%</span>
                </div>
              </td>
              <td>
                <button className="btn ghost sm" onClick={() => navigate(`/new?mode=custom&${kind}=${encodeURIComponent(b.key)}`)}>
                  Luyện →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Stats() {
  const { meta } = useData();
  const { data: s, error, loading } = useFetch<StatsResponse>('/api/stats');
  const [topicSort, setTopicSort] = useState<'weak' | 'bank'>('weak');
  if (loading && !s) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!s || !meta) return null;
  const T = s.totals;
  if (!T.answers) {
    return (
      <div>
        <div className="page-head">
          <h1>📊 Thống kê</h1>
        </div>
        <Empty icon="📈" title="Chưa có dữ liệu">
          Làm vài bài test để thấy thống kê theo domain, chủ đề, service, tốc độ và lịch ôn tập.
        </Empty>
      </div>
    );
  }
  const passPct = meta.exam.pass_pct;
  const topics = [...s.byTopic].filter((b) => b.bank > 0).sort((a, b) => (topicSort === 'weak' ? (a.attempts ? a.accuracy : 101) - (b.attempts ? b.accuracy : 101) : b.bank - a.bank));
  const weakServices = [...s.byService].filter((b) => b.attempts >= 3).sort((a, b) => a.accuracy - b.accuracy).slice(0, 12);
  const weakTags = [...s.byTag].filter((b) => b.attempts >= 3).sort((a, b) => a.accuracy - b.accuracy).slice(0, 12);
  const boxLabels = ['Chưa học', 'Box 1 · mai ôn', 'Box 2 · 3 ngày', 'Box 3 · 7 ngày', 'Box 4 · 14 ngày', 'Box 5 · 30 ngày'];
  const boxColors = ['var(--seq-0)', 'var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)'];
  const speed = [...s.byTopic].filter((b) => b.attempts >= 3).sort((a, b) => b.avgTime / Math.max(1, b.avgEst) - a.avgTime / Math.max(1, a.avgEst));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>📊 Thống kê</h1>
          <p>Tính trực tiếp từ {T.attempts} file kết quả .md — không dùng database.</p>
        </div>
      </div>

      <section className="split-l">
        <div className="card stack">
          <div className="small muted">Mức sẵn sàng thi (ước tính)</div>
          <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
            <span className="hero-figure">{T.readinessScaled}</span>
            <span className="muted">/ 1000</span>
          </div>
          <Meter value={T.readiness} target={passPct} label="Readiness" />
          <div className="small dim">
            {T.readiness >= passPct ? '✓ Trên ngưỡng đỗ' : `Còn ${Math.round((passPct - T.readiness) * 10) / 10} điểm % tới ngưỡng ${passPct}%`} · độ tin cậy:{' '}
            <b>{{ low: 'thấp', medium: 'vừa', high: 'cao' }[T.readinessConfidence]}</b>
          </div>
          <div className="tiny muted">Trung bình có trọng số theo 4 domain (30/26/24/20), ưu tiên 30 ngày gần nhất. Độ tin cậy tăng khi mỗi domain có ≥ 40 câu.</div>
        </div>
        <div className="kpis">
          <Kpi label="Câu đã trả lời" value={compact(T.answers)} sub={`${T.attempts} bài test`} />
          <Kpi label="Tỉ lệ đúng" value={`${T.accuracy}%`} sub={`${T.correct} câu đúng`} />
          <Kpi label="Độ phủ ngân hàng" value={`${Math.round((T.distinctSeen / Math.max(1, T.bankActive)) * 100)}%`} sub={`${T.distinctSeen}/${T.bankActive} câu đã gặp`} />
          <Kpi label="Đã thuộc (box ≥ 4)" value={T.mastered} sub="theo lịch Leitner" />
          <Kpi label="Đến hạn ôn" value={T.due} sub={<a href={href('/new?mode=srs')}>Ôn ngay →</a>} />
          <Kpi label="Đang sai" value={T.wrongOpen} sub={<a href={href('/new?mode=retry-wrong')}>Làm lại →</a>} />
          <Kpi label="Chuỗi ngày học" value={`${T.streakDays} 🔥`} sub="ngày liên tiếp" />
          <Kpi label="Thời gian học" value={fmtDuration(T.studySeconds, { long: true })} sub="tổng thời gian làm bài" />
        </div>
      </section>

      <section className="grid c2">
        <ChartCard
          title="Điểm từng bài"
          subtitle="Vạch ngang = ngưỡng đỗ 72%"
          table={{ head: ['Bài', 'Ngày', 'Câu', 'Điểm %'], rows: s.trend.map((t) => [t.title, fmtDateTime(t.finished), t.total, t.score]) }}
        >
          <LineChart
            target={passPct}
            points={s.trend.map((t) => ({ label: fmtDateTime(t.finished).split(' ')[0], value: t.score, detail: `${t.title} · ${t.total} câu`, onClick: () => navigate(`/result/${encodeURIComponent(t.id)}`) }))}
          />
        </ChartCard>
        <ChartCard
          title="Theo domain"
          subtitle="Tỉ lệ đúng · vạch = ngưỡng 72%"
          table={{ head: ['Domain', 'Lượt', 'Đúng', '%', 'Đã gặp/Ngân hàng'], rows: s.byDomain.map((b) => [b.label, b.attempts, b.correct, b.accuracy, `${b.questions}/${b.bank}`]) }}
        >
          <BarList
            target={passPct}
            items={s.byDomain.map((b) => ({
              key: b.key,
              label: b.label,
              value: b.accuracy,
              muted: !b.attempts,
              valueText: b.attempts ? `${b.accuracy}% · ${b.attempts}` : 'chưa làm',
              onClick: () => navigate(`/new?mode=weak&domains=${b.key}`),
              title: `${b.correct}/${b.attempts} đúng · đã gặp ${b.questions}/${b.bank} câu — bấm để củng cố`,
            }))}
          />
          <div className="tiny muted" style={{ marginTop: 10 }}>
            Trọng số đề thật: {meta.domains.map((d) => `${d.code} ${d.weight}%`).join(' · ')}
          </div>
        </ChartCard>
      </section>

      <section>
        <ChartCard
          title="Theo chủ đề"
          subtitle="Tỉ lệ đúng và độ phủ — bấm 1 dòng để luyện chủ đề đó"
          actions={<Seg value={topicSort} onChange={setTopicSort} items={[{ id: 'weak', label: 'Yếu trước' }, { id: 'bank', label: 'Nhiều câu' }]} />}
          table={{ head: ['Chủ đề', 'Lượt', '%', 'Đã gặp/Ngân hàng', 'TG TB/chuẩn'], rows: topics.map((b) => [b.label, b.attempts, b.accuracy, `${b.questions}/${b.bank}`, `${b.avgTime}s/${b.avgEst}s`]) }}
        >
          <BarList
            target={passPct}
            items={topics.map((b) => ({
              key: b.key,
              label: b.label,
              value: b.accuracy,
              muted: !b.attempts,
              valueText: b.attempts ? `${b.accuracy}% · ${b.questions}/${b.bank}` : `0/${b.bank}`,
              onClick: () => navigate(`/new?mode=topic&topics=${b.key}`),
              title: `${b.correct}/${b.attempts} đúng · đã gặp ${b.questions}/${b.bank} câu`,
            }))}
          />
        </ChartCard>
      </section>

      <section className="grid c2">
        <div className="card">
          <h2>🧠 Lịch ôn ngắt quãng (Leitner)</h2>
          <StackBar segments={s.boxes.map((v, i) => ({ label: boxLabels[i], value: v, color: boxColors[i] }))} />
          <div className="small muted" style={{ marginTop: 10 }}>
            Sai → về box 1 (ôn ngày mai). Đúng chắc chắn → lên 1 box (khoảng cách {meta.srs.intervals_days.join(' → ')} ngày). “Chưa chắc” không được lên box.
          </div>
        </div>
        <div className="card">
          <h2>📅 Hoạt động 18 tuần</h2>
          <Heatmap days={s.daily} />
        </div>
      </section>

      <section className="grid c2">
        <div className="card">
          <h2>⚠️ Service yếu nhất</h2>
          <WeakTable rows={weakServices} kind="services" />
        </div>
        <div className="card">
          <h2>🧩 Khái niệm yếu nhất</h2>
          <WeakTable rows={weakTags} kind="tags" />
        </div>
      </section>

      <section className="grid c2">
        <div className="card">
          <h2>🐢 Tốc độ theo chủ đề</h2>
          {!speed.length ? (
            <div className="small muted">Chưa đủ dữ liệu.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Chủ đề</th>
                    <th className="num">TB bạn</th>
                    <th className="num">Chuẩn</th>
                    <th className="num">Tỉ lệ</th>
                  </tr>
                </thead>
                <tbody>
                  {speed.map((b) => {
                    const r = Math.round((b.avgTime / Math.max(1, b.avgEst)) * 100) / 100;
                    return (
                      <tr key={b.key}>
                        <td className="small">{b.label}</td>
                        <td className="num small">{b.avgTime}s</td>
                        <td className="num small">{b.avgEst}s</td>
                        <td className={`num small ${r > 1.2 ? 'warn' : r < 0.8 ? 'good' : ''}`}>{r > 1.2 ? '▲ ' : r < 0.8 ? '▼ ' : ''}×{r}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <h2>❌ Sai nhiều nhất</h2>
          {!s.mostMissed.length ? (
            <div className="small muted">Chưa có.</div>
          ) : (
            <div className="stack sm">
              {s.mostMissed.slice(0, 8).map((m) => (
                <a key={m.id} href={href(`/bank?q=${encodeURIComponent(m.id)}`)} className="row nowrap small" style={{ color: 'inherit', gap: 10 }}>
                  <span className="badge bad num">
                    {m.wrong}/{m.attempts}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <code>{m.id}</code> {m.stem}
                  </span>
                </a>
              ))}
              <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/new?mode=retry-wrong')}>
                🔁 Làm lại các câu đang sai
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
