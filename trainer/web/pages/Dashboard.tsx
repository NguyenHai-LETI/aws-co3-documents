import { useData, useFetch } from '../lib/store.tsx';
import { href, navigate } from '../lib/router.ts';
import { startTest } from '../lib/start.ts';
import { loadActive } from '../lib/session.ts';
import { fmtDateTime, fmtDuration, fmtRelative } from '../lib/format.ts';
import { Meter } from '../components/charts.tsx';
import { MODE_INFO } from '../../shared/labels.ts';
import type { AttemptSummary, Plan, StatsResponse } from '../../shared/types.ts';

function ActionCard({ icon, title, desc, cta, onClick, tone }: { icon: string; title: string; desc: string; cta: string; onClick: () => void; tone?: 'accent' }) {
  return (
    <button className={`mode-card ${tone === 'accent' ? 'on' : ''}`} onClick={onClick}>
      <span className="t">
        {icon} {title}
      </span>
      <span className="d">{desc}</span>
      <span className="n" style={{ color: 'var(--accent-text)', fontWeight: 600 }}>
        {cta} →
      </span>
    </button>
  );
}

export function Dashboard() {
  const { meta, state } = useData();
  const { data: stats } = useFetch<StatsResponse>('/api/stats');
  const { data: results } = useFetch<AttemptSummary[]>('/api/results');
  const { data: plans } = useFetch<{ plans: Plan[]; newSince: { attempts: number } }>('/api/plans');
  const active = loadActive();
  if (!meta) return null;
  const c = state?.counts ?? {};
  const T = stats?.totals;
  const plan = plans?.plans[0];
  const nextSession = plan?.sessions.find((s) => !s.done?.length);
  const weakest = (stats?.byTopic ?? []).filter((b) => b.attempts >= 5).sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);
  const firstTime = !results?.length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Chào bạn 👋</h1>
          <p>
            {meta.exam.name} · {meta.exam.questions} câu / {meta.exam.duration_min} phút · đỗ ≥ {meta.exam.pass_scaled}/1000
          </p>
        </div>
        <div className="row">
          <a className="btn primary" href={href('/new')}>
            ✍️ Tạo bài test
          </a>
        </div>
      </div>

      {firstTime && (
        <section className="card pad-lg" style={{ background: 'var(--accent-soft)', borderColor: 'transparent' }}>
          <h2 style={{ fontSize: 18 }}>Bắt đầu thế nào?</h2>
          <ol className="small" style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
            <li>
              Làm 1 bài <b>⚡ Luyện nhanh</b> hoặc chọn <b>📚 Theo chủ đề</b> để làm quen — mỗi câu có thời gian chuẩn, đồng hồ chạy theo tổng thời gian.
            </li>
            <li>Kết quả lưu thành file .md trong <code>trainer/results/</code>; xem giải thích từng câu ngay sau khi nộp.</li>
            <li>
              Vào <b>🤖 AI Coach</b> → “Phân tích ngay”: Claude đọc kết quả, sinh câu biến thể cho phần yếu và lập kế hoạch luyện tiếp.
            </li>
          </ol>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={() => startTest({ mode: 'quick', feedback: 'practice' })}>
              ⚡ Luyện nhanh 10 câu
            </button>
            <button className="btn" onClick={() => startTest({ mode: 'exam' })}>
              🎯 Thi thử 65 câu
            </button>
          </div>
        </section>
      )}

      <section className="split-l">
        <div className="card stack">
          <div className="small muted">Mức sẵn sàng thi</div>
          {T && T.answers ? (
            <>
              <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
                <span className="hero-figure">{T.readinessScaled}</span>
                <span className="muted">/ 1000</span>
              </div>
              <Meter value={T.readiness} target={meta.exam.pass_pct} />
              <div className="small dim">
                Đúng {T.accuracy}% · {T.answers} câu · độ phủ {Math.round((T.distinctSeen / Math.max(1, T.bankActive)) * 100)}% · 🔥 {T.streakDays} ngày
              </div>
              <a className="small" href={href('/stats')}>
                Xem thống kê chi tiết →
              </a>
            </>
          ) : (
            <div className="small muted">Chưa có dữ liệu — làm bài đầu tiên để ước tính.</div>
          )}
        </div>

        <div className="stack">
          <b>Hôm nay nên làm gì?</b>
          <div className="grid auto">
            {active && (
              <ActionCard tone="accent" icon="⏯️" title="Tiếp tục bài đang làm" desc={`${active.session.title} · ${Object.keys(active.answers).length}/${active.questions.length} câu`} cta="Làm tiếp" onClick={() => navigate('/run')} />
            )}
            {nextSession && plan && (
              <ActionCard
                tone={active ? undefined : 'accent'}
                icon="🤖"
                title={nextSession.title}
                desc={nextSession.why ?? `Phiên trong kế hoạch AI ${fmtRelative(plan.created)}`}
                cta={`${nextSession.questions?.length ?? nextSession.filter?.count ?? ''} câu`}
                onClick={() => startTest({ mode: 'coach', plan: `${plan.id}#${nextSession.id}` })}
              />
            )}
            {(c.srs ?? 0) > 0 && (
              <ActionCard icon="🧠" title={`Ôn ${c.srs} câu đến hạn`} desc="Ôn đúng lúc sắp quên — hiệu quả nhất để nhớ lâu." cta="Ôn ngay" onClick={() => startTest({ mode: 'srs', count: Math.min(30, c.srs) })} />
            )}
            {(c['retry-wrong'] ?? 0) > 0 && (
              <ActionCard icon="🔁" title={`Làm lại ${c['retry-wrong']} câu sai`} desc="Các câu lần gần nhất bạn trả lời sai." cta="Làm lại" onClick={() => startTest({ mode: 'retry-wrong', count: Math.min(25, c['retry-wrong']), feedback: 'practice' })} />
            )}
            <ActionCard icon="💪" title="Củng cố điểm yếu" desc="Ưu tiên chủ đề/khái niệm tỉ lệ đúng thấp." cta="20 câu" onClick={() => startTest({ mode: 'weak', count: 20 })} />
            {(c.new ?? 0) > 0 && <ActionCard icon="🆕" title={`${c.new} câu chưa làm`} desc="Mở rộng độ phủ ngân hàng câu hỏi." cta="20 câu mới" onClick={() => startTest({ mode: 'new', count: 20 })} />}
            <ActionCard icon="⚡" title="Luyện nhanh" desc="10 câu, xem đáp án ngay từng câu." cta="Bắt đầu" onClick={() => startTest({ mode: 'quick', feedback: 'practice' })} />
            <ActionCard icon="🎯" title="Thi thử SAA-C03" desc={`${meta.exam.questions} câu theo trọng số domain.`} cta="Vào thi" onClick={() => navigate('/new?mode=exam')} />
          </div>
        </div>
      </section>

      <section className="grid c2">
        <div className="card">
          <div className="card-head">
            <h2>🤖 Kế hoạch AI Coach</h2>
            <a className="small" href={href('/coach')}>
              Mở AI Coach →
            </a>
          </div>
          {!plan ? (
            <div className="small muted">
              Chưa có kế hoạch. Sau vài bài test, vào AI Coach bấm <b>Phân tích ngay</b> (hoặc để lịch chạy tự động vài lần/ngày).
            </div>
          ) : (
            <div className="stack sm">
              <div className="small dim">
                {fmtDateTime(plan.created)} · {plan.summary ?? plan.id}
              </div>
              {plan.sessions.map((s) => (
                <div key={s.id} className="row between nowrap small">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.done?.length ? '✅' : '⬜'} {s.title}
                  </span>
                  {s.done?.length ? (
                    <span className="badge good">{s.done[s.done.length - 1].score}%</span>
                  ) : (
                    <button className="btn sm" onClick={() => startTest({ mode: 'coach', plan: `${plan.id}#${s.id}` })}>
                      Bắt đầu
                    </button>
                  )}
                </div>
              ))}
              {plans && plans.newSince.attempts > 0 && <div className="tiny muted">Có {plans.newSince.attempts} bài mới từ khi lập kế hoạch — nên phân tích lại.</div>}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>🕘 Bài gần đây</h2>
            <a className="small" href={href('/history')}>
              Tất cả →
            </a>
          </div>
          {!results?.length ? (
            <div className="small muted">Chưa có bài nào.</div>
          ) : (
            <div className="stack sm">
              {results.slice(0, 6).map((a) => (
                <a key={a.id} href={href(`/result/${encodeURIComponent(a.id)}`)} className="row between nowrap small" style={{ color: 'inherit' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {MODE_INFO[a.mode]?.icon} {a.title} <span className="muted">· {fmtDateTime(a.finished)} · {fmtDuration(a.timeUsed)}</span>
                  </span>
                  <span className={`badge ${a.passed ? 'good' : 'bad'}`}>{a.score}%</span>
                </a>
              ))}
            </div>
          )}
          {weakest.length > 0 && (
            <>
              <div className="divider" />
              <div className="small muted" style={{ marginBottom: 6 }}>
                Chủ đề yếu nhất
              </div>
              <div className="row">
                {weakest.map((b) => (
                  <button key={b.key} className="chip" onClick={() => navigate(`/new?mode=topic&topics=${b.key}`)}>
                    {b.label} <span className="n">{b.accuracy}%</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
