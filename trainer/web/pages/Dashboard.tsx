import { useState } from 'react';
import { api } from '../lib/api.ts';
import { useData, useFetch } from '../lib/store.tsx';
import { href, navigate } from '../lib/router.ts';
import { startTest } from '../lib/start.ts';
import { loadActive } from '../lib/session.ts';
import { fmtDateTime, fmtDuration, fmtRelative } from '../lib/format.ts';
import { AttemptBadges, ReadinessCard } from '../components/insights.tsx';
import { toast } from '../components/ui.tsx';
import { ExamCountdown } from '../components/progress/ExamCountdown.tsx';
import { useProgress } from '../components/progress/useProgress.ts';
import { Onboarding, onboardingSkipped, setOnboardingSkipped } from '../components/onboarding/Onboarding.tsx';
import { DIAGNOSTIC_PART, DIAGNOSTIC_TITLE, isDiagnostic, isDiagnosticPart, scoreTone } from '../components/onboarding/rules.ts';
import { useStudyStart } from '../components/onboarding/useStudyStart.ts';
import { MODE_INFO } from '../../shared/labels.ts';
import type { AttemptSummary, OnboardingPlanResponse, PlansResponse, ResultsPage, StatsResponse } from '../../shared/types.ts';

const RECENT = 6;

function ActionCard({ icon, title, desc, cta, onClick, tone }: { icon: string; title: string; desc: string; cta: string; onClick: () => void; tone?: 'accent' }) {
  return (
    <button className={`mode-card lrn-action ${tone === 'accent' ? 'on' : ''}`} onClick={onClick} title={`${title}\n${desc}`}>
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
  // paginated APIs: only the newest attempts and the latest plan summary (no Markdown bodies) — older servers answer
  // `?limit=` with the full legacy array, which is handled too
  const { data: page } = useFetch<ResultsPage | AttemptSummary[]>(`/api/results?limit=${RECENT}`);
  const { data: plans, reload: reloadPlans } = useFetch<PlansResponse>('/api/plans?limit=1');
  const { data: progress, error: progressError } = useProgress();
  const studyStart = useStudyStart();
  const [skipped, setSkipped] = useState(onboardingSkipped);
  const [planning, setPlanning] = useState(false);
  const active = loadActive();
  if (!meta) return null;
  const results = Array.isArray(page) ? page.slice(0, RECENT) : page?.items;
  const totalResults = Array.isArray(page) ? page.length : page?.total;
  const c = state?.counts ?? {};
  const T = stats?.totals;
  const plan = plans?.plans[0];
  const nextSession = plan?.sessions.find((s) => !s.done?.length);
  const weakest = (stats?.byTopic ?? []).filter((b) => b.attempts >= 5).sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);
  const firstTime = totalResults === 0; // no flash of the onboarding box while loading
  const dueToday = c.srs ?? 0;
  const backlog = c.backlog ?? T?.backlog ?? 0;
  // first day: the onboarding wizard (once the goal is known, so it never jumps from step 1 to step 2)
  const wizard = firstTime && !skipped;
  const wizardReady = !!progress || !!progressError;
  // after the diagnostic: its second half (split 2 × 14), then the week-1 plan
  const recent = results ?? [];
  const lastDiag = recent.find((a) => isDiagnostic(a));
  const needSecondHalf = recent.filter((a) => isDiagnosticPart(a)).length === 1 && !recent.some((a) => isDiagnostic(a) && !isDiagnosticPart(a));
  const onboardingPlan = plan?.trigger === 'onboarding';
  const planAfterDiag = !!plan && !!lastDiag && new Date(plan.created).getTime() >= new Date(lastDiag.finished).getTime();
  const offerPlan = !!lastDiag && !needSecondHalf && !planAfterDiag;
  const makePlan = async () => {
    if (!lastDiag) return;
    setPlanning(true);
    try {
      const r = await api.post<OnboardingPlanResponse>('/api/onboarding/plan', { attemptId: lastDiag.id });
      toast(r.created ? `🗓️ Đã lập kế hoạch tuần 1 (${r.plan.sessions.length} phiên).` : '🗓️ Kế hoạch tuần 1 hôm nay đã có.');
      reloadPlans();
    } catch (e) {
      toast(`Không lập được kế hoạch: ${(e as Error).message}`);
    } finally {
      setPlanning(false);
    }
  };

  const head = (
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
  );

  // first day: only the wizard (no competing "what to do today" cards on an empty history)
  if (wizard) {
    return (
      <div>
        {head}
        {active && (
          <div className="ins-wrap alert info row between" style={{ marginBottom: 16 }}>
            <span>
              ⏯️ Bạn đang làm dở <b>{active.session.title}</b> · {Object.keys(active.answers).length}/{active.questions.length} câu
            </span>
            <button className="btn primary sm" onClick={() => navigate('/run')}>
              Làm tiếp
            </button>
          </div>
        )}
        {wizardReady && (
          <Onboarding
            goal={progress?.goal}
            onSkip={() => {
              setSkipped(true);
              toast('Đã ẩn hướng dẫn — mở lại ở hộp “Bắt đầu thế nào?”.');
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {head}

      {firstTime && (
        <section className="card pad-lg" style={{ background: 'var(--accent-soft)', borderColor: 'transparent' }}>
          <div className="row between">
            <h2 style={{ fontSize: 18 }}>Bắt đầu thế nào?</h2>
            <button
              className="btn ghost sm"
              onClick={() => {
                setOnboardingSkipped(false);
                setSkipped(false);
              }}
            >
              🧭 Mở lại hướng dẫn 3 bước
            </button>
          </div>
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
            <button className="btn" onClick={() => startTest({ mode: 'exam', pearson: true })}>
              🎯 Thi thử 65 câu
            </button>
          </div>
        </section>
      )}

      <section className="split-l">
        <div className="stack">
          {T && T.answers ? (
            <ReadinessCard totals={T} compact>
              <div className="small dim">
                Đúng {T.accuracy}% · {T.answers} câu · độ phủ {Math.round((T.distinctSeen / Math.max(1, T.bankActive)) * 100)}% · 🔥 {T.streakDays} ngày
              </div>
              {(dueToday > 0 || backlog > 0) && (
                <div className="small dim">
                  🧠 Ôn hôm nay <b className="num">{dueToday}</b>
                  {backlog > 0 && (
                    <>
                      {' '}
                      · tồn đọng <b className="num">{backlog}</b> <span className="muted">(tối đa {meta.srs.daily_limit} câu/ngày)</span>
                    </>
                  )}
                </div>
              )}
              <a className="small" href={href('/stats')}>
                Xem thống kê chi tiết →
              </a>
            </ReadinessCard>
          ) : (
            <div className="card stack">
              <div className="small muted">Mức sẵn sàng thi</div>
              <div className="small muted">
                Chưa có dữ liệu — làm bài đầu tiên để ước tính.
                {T?.rushedAttempts ? ` (${T.rushedAttempts} bài làm vội không được tính.)` : ''}
              </div>
            </div>
          )}
          <ExamCountdown />
        </div>

        <div className="stack">
          <b>Hôm nay nên làm gì?</b>
          <div className="grid auto">
            {active && (
              <ActionCard tone="accent" icon="⏯️" title="Tiếp tục bài đang làm" desc={`${active.session.title} · ${Object.keys(active.answers).length}/${active.questions.length} câu`} cta="Làm tiếp" onClick={() => navigate('/run')} />
            )}
            {needSecondHalf && (
              <ActionCard
                tone={active ? undefined : 'accent'}
                icon="🧭"
                title={`Chẩn đoán phần 2/2 · ${DIAGNOSTIC_PART} câu`}
                desc="Mỗi mục exam guide thêm 1 câu khác — bản đồ xuất phát đủ 2 câu/mục, kế hoạch tuần 1 chính xác hơn."
                cta="Làm phần 2"
                onClick={() => void startTest({ mode: 'diagnostic', count: DIAGNOSTIC_PART, title: `${DIAGNOSTIC_TITLE} · phần 2/2` })}
              />
            )}
            {offerPlan && (
              <ActionCard
                tone={active ? undefined : 'accent'}
                icon="🗓️"
                title="Lập kế hoạch tuần 1"
                desc="Từ bài chẩn đoán: vá các mục ✗ trọng số cao, ôn xen kẽ — tự lập, không cần AI."
                cta={planning ? 'Đang lập…' : 'Lập kế hoạch'}
                onClick={() => !planning && void makePlan()}
              />
            )}
            {nextSession && plan && (
              <ActionCard
                tone={active || needSecondHalf || offerPlan ? undefined : 'accent'}
                icon={onboardingPlan ? '🗓️' : '🤖'}
                title={nextSession.title}
                desc={nextSession.why ?? (onboardingPlan ? 'Phiên trong kế hoạch tuần 1' : `Phiên trong kế hoạch AI ${fmtRelative(plan.created)}`)}
                cta={`${nextSession.questions?.length ?? nextSession.filter?.count ?? ''} câu`}
                onClick={() => startTest({ mode: 'coach', plan: `${plan.id}#${nextSession.id}` })}
              />
            )}
            {dueToday > 0 && (
              <ActionCard
                icon="🧠"
                title={`Ôn ${dueToday} câu đến hạn hôm nay`}
                desc={backlog > 0 ? `Câu dễ quên nhất trước · còn ${backlog} câu tồn đọng sang các ngày sau (giới hạn ${meta.srs.daily_limit}/ngày).` : 'Ôn đúng lúc sắp quên — hiệu quả nhất để nhớ lâu.'}
                cta="Ôn ngay"
                onClick={() => startTest({ mode: 'srs', count: Math.min(meta.srs.daily_limit || 30, dueToday) })}
              />
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
            <h2>{onboardingPlan ? '🗓️ Kế hoạch tuần 1' : '🤖 Kế hoạch AI Coach'}</h2>
            {onboardingPlan && lastDiag ? (
              <a className="small" href={href(`/result/${encodeURIComponent(lastDiag.id)}`)}>
                🧭 Bản đồ xuất phát →
              </a>
            ) : (
              <a className="small" href={href('/coach')}>
                Mở AI Coach →
              </a>
            )}
          </div>
          {!plan ? (
            <div className="small muted">
              Chưa có kế hoạch. Sau vài bài test, vào AI Coach bấm <b>Phân tích ngay</b> (hoặc để lịch chạy tự động vài lần/ngày).
            </div>
          ) : (
            <div className="stack sm">
              <div className="small dim">
                {fmtDateTime(plan.created)} · {plan.summary ?? plan.id}
                {onboardingPlan && <span className="muted"> · tự lập từ bài chẩn đoán (không dùng AI)</span>}
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
              {results.map((a) => (
                <a key={a.id} href={href(`/result/${encodeURIComponent(a.id)}`)} className="row between nowrap small" style={{ color: 'inherit' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {MODE_INFO[a.mode]?.icon} {a.title} <span className="muted">· {fmtDateTime(a.finished)} · {fmtDuration(a.timeUsed)}</span>
                  </span>
                  <span className="row nowrap" style={{ gap: 4 }}>
                    <AttemptBadges a={a} />
                    <span className={`badge ${scoreTone(a, studyStart)}`}>{a.score}%</span>
                  </span>
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
