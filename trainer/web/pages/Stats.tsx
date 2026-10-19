import { useEffect, useState } from 'react';
import { useData, useFetch } from '../lib/store.tsx';
import { href, navigate, useRoute } from '../lib/router.ts';
import { startTest } from '../lib/start.ts';
import { compact, fmtDateTime, fmtDuration } from '../lib/format.ts';
import { BarList, ChartCard, Heatmap, Kpi, LineChart, Meter, StackBar } from '../components/charts.tsx';
import { ReadinessCard, pctOf } from '../components/insights.tsx';
import { Empty, ErrorBox, Loading, Seg } from '../components/ui.tsx';
import { ExamSection } from '../components/progress/ExamSection.tsx';
import { FsrsCard } from '../components/progress/FsrsCard.tsx';
import { useProgress } from '../components/progress/useProgress.ts';
import type { Bucket, StatsResponse } from '../../shared/types.ts';

const FSRS_LABELS = ['Chưa học', 'Mức 1 · < 1 ngày', 'Mức 2 · 1–7 ngày', 'Mức 3 · 7–21 ngày', 'Mức 4 · 21–60 ngày', 'Mức 5 · ≥ 60 ngày'];
const LEITNER_LABELS = ['Chưa học', 'Box 1 · mai ôn', 'Box 2 · 3 ngày', 'Box 3 · 7 ngày', 'Box 4 · 14 ngày', 'Box 5 · 30 ngày'];
const BOX_COLORS = ['var(--seq-0)', 'var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)'];

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

type Pair = { answers: number; correct: number };
const acc = (x?: Pair) => (x ? pctOf(x.correct, x.answers) : 0);

function Calibration({ c }: { c: StatsResponse['calibration'] }) {
  const rows = [
    { key: 'sure', label: '😎 Chắc chắn', v: c.sure, title: 'Trả lời mà không đánh dấu “chưa chắc” và không mở gợi ý' },
    { key: 'unsure', label: '🤔 Chưa chắc', v: c.unsure, title: 'Câu bạn đánh dấu “chưa chắc”' },
    { key: 'hinted', label: '💡 Dùng gợi ý', v: c.hinted, title: 'Câu bạn mở gợi ý (chế độ luyện tập)' },
  ];
  const sure = acc(c.sure);
  const unsure = acc(c.unsure);
  let note: { cls: string; text: string } | undefined;
  if (c.sure.answers >= 15 && sure < 80)
    note = { cls: 'warn', text: `⚠ Tự tin quá mức: khi “chắc chắn” bạn chỉ đúng ${sure}%. Đề thật hay có phương án gần đúng — khi còn phân vân giữa 2 phương án, đánh dấu 🤔 để được ôn lại sớm.` };
  else if (c.unsure.answers >= 10 && unsure >= sure - 5)
    note = { cls: '', text: `ℹ️ Câu “chưa chắc” bạn vẫn đúng ${unsure}% — gần bằng lúc chắc chắn. Bạn đang đánh giá thấp mình; tin vào phương pháp loại trừ hơn.` };
  else if (c.sure.answers >= 15 && c.unsure.answers >= 5)
    note = { cls: 'good', text: `✓ Bạn tự đánh giá khá chuẩn: chắc chắn → đúng ${sure}%, chưa chắc → đúng ${unsure}%.` };
  return (
    <ChartCard
      title="🎯 Độ tự tin vs kết quả"
      subtitle="Tỉ lệ đúng theo cảm giác lúc trả lời"
      table={{ head: ['Nhóm', 'Câu', 'Đúng', '%'], rows: rows.map((r) => [r.label, r.v.answers, r.v.correct, acc(r.v)]) }}
    >
      <BarList
        items={rows.map((r) => ({
          key: r.key,
          label: r.label,
          value: acc(r.v),
          muted: !r.v.answers,
          valueText: r.v.answers ? `${acc(r.v)}% · ${r.v.answers}` : 'chưa có',
          title: `${r.title}: ${r.v.correct}/${r.v.answers} đúng`,
        }))}
      />
      {note && <div className={`small ${note.cls}`} style={{ marginTop: 10 }}>{note.text}</div>}
    </ChartCard>
  );
}

function Elimination({ e }: { e: StatsResponse['elimination'] }) {
  const { byId } = useData();
  const ids = (e.questions ?? []).filter((id) => byId.has(id));
  return (
    <div className="card stack sm">
      <h2>✂️ Gạch bỏ phương án</h2>
      {!e.answersWithElim ? (
        <div className="small muted">
          Chưa dùng gạch bỏ. Khi làm bài, bấm ✕ cạnh phương án (hoặc chuột phải / Shift + số) để loại trừ — như giấy nháp ở phòng thi; app ghi lại lần bạn lỡ gạch đáp án
          đúng.
        </div>
      ) : (
        <>
          <div className="row ins-stat-row">
            <div>
              <div className="ins-stat">{e.answersWithElim}</div>
              <div className="tiny muted">câu có gạch bỏ</div>
            </div>
            <div>
              <div className="ins-stat">{e.correctEliminated}</div>
              <div className="tiny muted">lần gạch nhầm đáp án đúng ({pctOf(e.correctEliminated, e.answersWithElim)}%)</div>
            </div>
          </div>
          {e.correctEliminated > 0 ? (
            <div className="ins-wrap alert warn small">⚠ Bạn từng loại nhầm đáp án đúng — đọc lại yêu cầu đề (đặc biệt NOT / LEAST / MOST) trước khi gạch.</div>
          ) : (
            <div className="small good">✓ Chưa lần nào gạch nhầm đáp án đúng.</div>
          )}
          {ids.length > 0 && (
            <>
              <div className="row" style={{ gap: 6 }}>
                {ids.slice(0, 12).map((id) => (
                  <a key={id} className="badge mono" href={href(`/bank?q=${encodeURIComponent(id)}`)}>
                    {id}
                  </a>
                ))}
                {ids.length > 12 && <span className="tiny muted">+{ids.length - 12}</span>}
              </div>
              <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => startTest({ mode: 'ids', ids, title: `Câu từng gạch nhầm đáp án đúng (${ids.length})`, feedback: 'practice' })}>
                🔁 Luyện lại {ids.length} câu này
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Recall({ r }: { r: StatsResponse['recall'] }) {
  return (
    <div className="card stack sm">
      <h2>🧠 Nhớ trước khi xem lựa chọn</h2>
      {!r.answers ? (
        <div className="small muted">
          Chưa dùng chế độ <b>Recall-first</b>: tự viết đáp án trước khi thấy các phương án — cách luyện nhớ chủ động hiệu quả nhất.{' '}
          <a href={href('/new?mode=custom&recall=1')}>Thử ngay →</a>
        </div>
      ) : (
        <>
          <div className="small dim">
            <b className="num">
              {r.hits}/{r.answers}
            </b>{' '}
            lần bạn nghĩ trúng ý đáp án trước khi xem lựa chọn ({pctOf(r.hits, r.answers)}%).
          </div>
          <BarList
            target={72}
            items={[
              { key: 'hit', label: 'Nghĩ trúng → đúng', value: r.hitAccuracy, valueText: `${r.hitAccuracy}%`, title: 'Tỉ lệ chọn đúng khi điều bạn nghĩ trước trùng ý đáp án' },
              { key: 'miss', label: 'Nghĩ chưa trúng → đúng', value: r.missAccuracy, valueText: `${r.missAccuracy}%`, title: 'Tỉ lệ chọn đúng khi điều bạn nghĩ trước không trùng đáp án' },
            ]}
          />
          <div className="tiny muted">Nghĩ trúng mà vẫn chọn sai → dễ bị phương án “nghe hay hơn” đánh lừa; nghĩ chưa trúng mà vẫn đúng → nhờ loại trừ.</div>
        </>
      )}
    </div>
  );
}

function LengthSplit({ l, share, minWords, passPct }: { l: StatsResponse['lengthSplit']; share: number; minWords: number; passPct: number }) {
  const long = acc(l.long);
  const short = acc(l.short);
  const rows = [
    { key: 'long', label: `📜 Câu dài (≥ ${minWords} từ)`, v: l.long },
    { key: 'short', label: '📝 Câu ngắn', v: l.short },
  ];
  return (
    <ChartCard
      title="📏 Câu dài vs câu ngắn"
      subtitle={`Đề thật phần lớn là câu dài · ${share}% số câu bạn làm là câu dài`}
      table={{ head: ['Loại', 'Câu', 'Đúng', '%'], rows: rows.map((r) => [r.label, r.v.answers, r.v.correct, acc(r.v)]) }}
    >
      <BarList
        target={passPct}
        items={rows.map((r) => ({ key: r.key, label: r.label, value: acc(r.v), muted: !r.v.answers, valueText: r.v.answers ? `${acc(r.v)}% · ${r.v.answers}` : 'chưa có' }))}
      />
      {l.long.answers >= 10 && l.short.answers >= 10 && short - long >= 10 ? (
        <div className="small warn" style={{ marginTop: 10 }}>
          ⚠ Câu dài kéo điểm xuống {Math.round(short - long)} điểm — đọc câu hỏi cuối đề trước để biết cần tìm gì, rồi mới đọc bối cảnh.
        </div>
      ) : share < 30 ? (
        <div className="small dim" style={{ marginTop: 10 }}>
          ℹ️ Bạn mới làm {share}% câu dài. Chế độ <a href={href('/new?mode=exam')}>🎯 Thi thử</a> ưu tiên câu dài như đề thật.
        </div>
      ) : null}
    </ChartCard>
  );
}

export function Stats() {
  const { meta, refresh } = useData();
  const route = useRoute();
  const { data: s, error, loading, reload } = useFetch<StatsResponse>('/api/stats');
  const { data: progress } = useProgress();
  const [topicSort, setTopicSort] = useState<'weak' | 'bank'>('weak');
  const focus = route.query.get('focus');
  // Dashboard "Đặt ngày thi →" opens #/stats?focus=exam
  useEffect(() => {
    if (focus === 'exam' && progress) document.getElementById('exam-goal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focus, !!progress, !!s]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading && !s) return <Loading />;
  if (error && !s) return <ErrorBox error={error} />;
  if (!s || !meta) return null;
  const T = s.totals;
  const rushed = s.rushed ?? [];
  // new personal FSRS parameters → memory levels, due dates and review counts change
  const paramsChanged = () => {
    reload();
    void refresh();
  };
  const regraded = s.regraded ?? progress?.regraded ?? 0;
  const rushedNote = rushed.length > 0 && (
    <div className="ins-wrap alert info small" style={{ marginBottom: 16 }}>
      ⚡ <b>{rushed.length} bài làm vội</b> không được tính vào thống kê, mức sẵn sàng và lịch ôn (thời gian trung vị mỗi câu quá ngắn):{' '}
      {rushed.slice(0, 5).map((r, i) => (
        <span key={r.id}>
          {i ? ' · ' : ''}
          <a href={href(`/result/${encodeURIComponent(r.id)}`)}>{r.title}</a>{' '}
          <span className="muted">
            ({fmtDateTime(r.finished)}, {r.medianTime}s/câu)
          </span>
        </span>
      ))}
      {rushed.length > 5 ? ` · +${rushed.length - 5} bài` : ''}
    </div>
  );
  if (!T.answers) {
    return (
      <div>
        <div className="page-head">
          <h1>📊 Thống kê</h1>
        </div>
        {rushedNote}
        <Empty icon="📈" title="Chưa có dữ liệu">
          Làm vài bài test để thấy thống kê theo domain, task, chủ đề, service, tốc độ và lịch ôn tập.
        </Empty>
        {progress && <ExamSection progress={progress} />}
      </div>
    );
  }
  const passPct = meta.exam.pass_pct;
  const fsrs = meta.srs.algorithm !== 'leitner';
  const v2 = typeof T.dueToday === 'number';
  const dueToday = v2 ? T.dueToday : T.due;
  const topics = [...s.byTopic].filter((b) => b.bank > 0).sort((a, b) => (topicSort === 'weak' ? (a.attempts ? a.accuracy : 101) - (b.attempts ? b.accuracy : 101) : b.bank - a.bank));
  const weakServices = [...s.byService].filter((b) => b.attempts >= 3).sort((a, b) => a.accuracy - b.accuracy).slice(0, 12);
  const weakTags = [...s.byTag].filter((b) => b.attempts >= 3).sort((a, b) => a.accuracy - b.accuracy).slice(0, 12);
  const boxLabels = s.boxLabels?.length === s.boxes.length ? s.boxLabels : fsrs ? FSRS_LABELS : LEITNER_LABELS;
  const speed = [...s.byTopic].filter((b) => b.attempts >= 3).sort((a, b) => b.avgTime / Math.max(1, b.avgEst) - a.avgTime / Math.max(1, a.avgEst));
  const tasks = meta.tasks ?? [];
  const byTask = s.byTask;
  const taskRows = tasks.map((t) => ({ t, b: byTask?.find((x) => x.key === t.id) }));
  const noTaskData = !!byTask && taskRows.every((x) => !x.b?.bank);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>📊 Thống kê</h1>
          <p>
            Tính trực tiếp từ {T.attempts} file kết quả .md — không dùng database.
            {T.rushedAttempts ? ` Đã bỏ qua ${T.rushedAttempts} bài làm vội.` : ''}
          </p>
        </div>
      </div>
      {rushedNote}
      {regraded > 0 && (
        <div className="ins-wrap alert info small" style={{ marginBottom: 16 }}>
          ↻ <b>{regraded} câu trả lời được chấm lại</b> theo đáp án đã sửa trong ngân hàng (file kết quả giữ nguyên) — thống kê, mức sẵn sàng và lịch ôn tính theo đáp án hiện
          tại.
        </div>
      )}

      <section className="split-l">
        <ReadinessCard totals={T} />
        <div className="kpis">
          <Kpi label="Câu đã trả lời" value={compact(T.answers)} sub={`${T.attempts} bài test`} />
          <Kpi label="Tỉ lệ đúng" value={`${T.accuracy}%`} sub={`${T.correct} câu đúng`} />
          <Kpi label="Độ phủ ngân hàng" value={`${Math.round((T.distinctSeen / Math.max(1, T.bankActive)) * 100)}%`} sub={`${T.distinctSeen}/${T.bankActive} câu đã gặp`} />
          <Kpi label="Đã thuộc" value={T.mastered} sub={fsrs ? `trí nhớ bền ≥ ${meta.srs.mastered_stability_days} ngày` : `box ≥ ${meta.srs.mastered_box}`} />
          <Kpi
            label={v2 ? 'Ôn hôm nay' : 'Đến hạn ôn'}
            value={dueToday}
            sub={
              <>
                {dueToday ? <a href={href('/new?mode=srs')}>Ôn ngay →</a> : 'đã ôn xong 🎉'}
                {v2 && T.backlog > 0 && (
                  <span title={`Vượt giới hạn ${meta.srs.daily_limit} câu/ngày — dời sang các ngày sau`}> · tồn {T.backlog}</span>
                )}
              </>
            }
          />
          <Kpi label="Đang sai" value={T.wrongOpen} sub={<a href={href('/new?mode=retry-wrong')}>Làm lại →</a>} />
          <Kpi label="Chuỗi ngày học" value={`${T.streakDays} 🔥`} sub="ngày liên tiếp" />
          <Kpi label="Thời gian học" value={fmtDuration(T.studySeconds, { long: true })} sub="tổng thời gian làm bài" />
        </div>
      </section>

      {progress && <ExamSection progress={progress} readiness={T.readiness} />}

      <section className="grid c2">
        <ChartCard
          title="Điểm từng bài"
          subtitle={`Vạch ngang = ngưỡng đỗ ${passPct}%`}
          table={{ head: ['Bài', 'Ngày', 'Câu', 'Điểm %'], rows: s.trend.map((t) => [t.title, fmtDateTime(t.finished), t.total, t.score]) }}
        >
          <LineChart
            target={passPct}
            points={s.trend.map((t) => ({ label: fmtDateTime(t.finished).split(' ')[0], value: t.score, detail: `${t.title} · ${t.total} câu`, onClick: () => navigate(`/result/${encodeURIComponent(t.id)}`) }))}
          />
        </ChartCard>
        <ChartCard
          title="Theo domain"
          subtitle={`Tỉ lệ đúng · vạch = ngưỡng ${passPct}%`}
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

      {byTask && tasks.length > 0 && (
        <section>
          <ChartCard
            title="📋 Theo task của Exam Guide"
            subtitle="Tỉ lệ đúng theo 14 task statement (1.1–4.4) — bấm 1 dòng để luyện riêng task đó"
            table={{
              head: ['Task', 'Nội dung', 'Lượt', '%', 'Đã gặp/Ngân hàng'],
              rows: taskRows.map(({ t, b }) => [t.id, t.label_vi, b?.attempts ?? 0, b?.accuracy ?? 0, `${b?.questions ?? 0}/${b?.bank ?? 0}`]),
            }}
          >
            {noTaskData && (
              <div className="ins-wrap alert small" style={{ marginBottom: 10 }}>
                Chưa có câu nào được gắn task. Chạy <code>npm run classify-tasks -- --apply</code> hoặc một lượt ENRICH (phân loại) ở trang AI Coach.
              </div>
            )}
            <BarList
              target={passPct}
              items={taskRows.map(({ t, b }) => ({
                key: t.id,
                label: (
                  <>
                    <b className="num">{t.id}</b> {t.label_vi.replace(/\s*\([^)]*\)\s*$/, '')}
                  </>
                ),
                value: b?.accuracy ?? 0,
                muted: !b?.attempts,
                valueText: b?.attempts ? `${b.accuracy}% · ${b.attempts}` : `0/${b?.bank ?? 0}`,
                onClick: () => navigate(`/new?mode=custom&tasks=${encodeURIComponent(t.id)}`),
                title: `${t.id} ${t.label}\n${t.label_vi}\n${b ? `${b.correct}/${b.attempts} đúng · đã gặp ${b.questions}/${b.bank} câu` : 'chưa có câu nào'} — bấm để luyện`,
              }))}
            />
          </ChartCard>
        </section>
      )}

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

      <section className="grid c2 lrn-align-start">
        <div className="stack">
          <div className="card stack">
            <div className="card-head" style={{ marginBottom: 0 }}>
              <h2>🧠 Mức ghi nhớ {fsrs ? '(FSRS)' : '(Leitner)'}</h2>
              {dueToday > 0 && (
                <button className="btn primary sm" onClick={() => startTest({ mode: 'srs', count: Math.min(dueToday, meta.srs.daily_limit || dueToday) })}>
                  Ôn {dueToday} câu
                </button>
              )}
            </div>
            <StackBar segments={s.boxes.map((v, i) => ({ label: boxLabels[i] ?? `Mức ${i}`, value: v, color: BOX_COLORS[i] ?? 'var(--seq-5)' }))} />
            <div className="row ins-stat-row">
              <div>
                <div className="ins-stat">{dueToday}</div>
                <div className="tiny muted">ôn hôm nay</div>
              </div>
              {v2 && (
                <div>
                  <div className="ins-stat">{T.backlog}</div>
                  <div className="tiny muted">tồn đọng</div>
                </div>
              )}
              <div>
                <div className="ins-stat">{T.mastered}</div>
                <div className="tiny muted">đã thuộc</div>
              </div>
            </div>
            <div className="small muted">
              {fsrs
                ? `FSRS-6 ước lượng độ bền trí nhớ của từng câu và hẹn ôn khi xác suất còn nhớ xuống ~${Math.round((meta.srs.desired_retention || 0.9) * 100)}% (tính theo ngày: câu đến hạn từ đầu ngày). Sai → độ bền giảm mạnh; đúng nhanh & chắc → tăng nhiều; chưa chắc, dùng gợi ý hay gạch nhầm → tăng ít; làm lại trong cùng ngày → thay đổi ít. Mỗi ngày tối đa ${meta.srs.daily_limit} câu (câu dễ quên nhất trước), phần dư thành tồn đọng.`
                : `Sai → về box 1 (ôn ngày mai). Đúng chắc chắn → lên 1 box (khoảng cách ${meta.srs.intervals_days.join(' → ')} ngày). “Chưa chắc” không được lên box.`}
            </div>
          </div>
          {progress?.fsrs && (
            <div className="card">
              <h2>📅 Hoạt động 18 tuần</h2>
              <Heatmap days={s.daily} />
            </div>
          )}
        </div>
        {progress?.fsrs ? (
          <FsrsCard info={progress.fsrs} onParamsChanged={paramsChanged} />
        ) : (
          <div className="card">
            <h2>📅 Hoạt động 18 tuần</h2>
            <Heatmap days={s.daily} />
          </div>
        )}
      </section>

      {(s.calibration || s.elimination || s.recall || s.lengthSplit) && (
        <section>
          <h2 className="ins-section-title">🧭 Thói quen làm bài</h2>
          <div className="grid c2">
            {s.calibration && <Calibration c={s.calibration} />}
            {s.lengthSplit && <LengthSplit l={s.lengthSplit} share={T.longFormShare ?? 0} minWords={meta.timing.long_form_min_words ?? 55} passPct={passPct} />}
            {s.elimination && <Elimination e={s.elimination} />}
            {s.recall && <Recall r={s.recall} />}
          </div>
        </section>
      )}

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
                        <td className={`num small ${r > 1.2 ? 'warn' : r < 0.8 ? 'good' : ''}`}>
                          {r > 1.2 ? '▲ ' : r < 0.8 ? '▼ ' : ''}×{r}
                        </td>
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
