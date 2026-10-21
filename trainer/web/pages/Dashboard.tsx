import { useState } from 'react';
import { api } from '../lib/api.ts';
import { useData, useFetch } from '../lib/store.tsx';
import { href, navigate } from '../lib/router.ts';
import { startTest } from '../lib/start.ts';
import { deviceId, loadActive, progressOf, useRemoteActive } from '../lib/session.ts';
import { fmtDateTime, fmtDuration, fmtRelative } from '../lib/format.ts';
import { AttemptBadges, ReadinessCard } from '../components/insights.tsx';
import { toast } from '../components/ui.tsx';
import { ExamCountdown } from '../components/progress/ExamCountdown.tsx';
import { PhaseBanner } from '../components/progress/PhaseBanner.tsx';
import { useProgress } from '../components/progress/useProgress.ts';
import { TodayHero } from '../components/learning/TodayHero.tsx';
import { evidenceNote, intervalText, weakestTopics } from '../components/learning/rules.ts';
import { Onboarding, onboardingSkipped, setOnboardingSkipped } from '../components/onboarding/Onboarding.tsx';
import { DIAGNOSTIC_PART, DIAGNOSTIC_TITLE, isDiagnostic, isDiagnosticPart, scoreTone } from '../components/onboarding/rules.ts';
import { useStudyStart } from '../components/onboarding/useStudyStart.ts';
import { MODE_INFO } from '../../shared/labels.ts';
import type { AttemptSummary, OnboardingPlanResponse, PlansResponse, ResultsPage, StatsResponse, TodayPreview } from '../../shared/types.ts';

const RECENT = 6;
const MORE_KEY = 'trainer.dash.more'; // "Tự chọn khác…" open / closed (per browser)

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

function loadMoreOpen(): boolean {
  try {
    return localStorage.getItem(MORE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMoreOpen(open: boolean) {
  try {
    localStorage.setItem(MORE_KEY, open ? '1' : '0');
  } catch {
    // private window: the default (closed) is fine
  }
}

/** [μ v5] Next to the hero: "☀️ Ôn lại N lỗi hôm qua" (mode yesterday) and the leech counter ("câu dai dẳng"). */
function SideQuests({ counts, leeches, className }: { counts: Record<string, number>; leeches: number; className: string }) {
  const yesterday = counts.yesterday ?? 0;
  if (!yesterday && !leeches) return null;
  const minutes = counts['yesterday.estimate'] ? Math.max(1, Math.round(counts['yesterday.estimate'] / 60)) : undefined;
  return (
    <div className={`grid auto lrn-quests ${className}`}>
      {yesterday > 0 && (
        <ActionCard
          icon="☀️"
          title={`Ôn lại ${yesterday} lỗi hôm qua`}
          desc={`Câu sai / chưa chắc / phải xem gợi ý hôm qua — gặp lại sau một giấc ngủ giúp nhớ lâu hơn${minutes ? ` (~${minutes}′)` : ''}.`}
          cta="Ôn ngay"
          onClick={() => void startTest({ mode: 'yesterday' })}
        />
      )}
      {leeches > 0 && (
        <ActionCard
          icon="🔂"
          title={`${leeches} câu dai dẳng`}
          desc="Sai đi sai lại — xem lịch sử lựa chọn, cặp hay nhầm, ghi mẹo nhớ, nhờ AI viết câu tương phản hoặc tạm gác."
          cta="Mở danh sách"
          onClick={() => navigate('/stats?focus=leeches')}
        />
      )}
    </div>
  );
}

export function Dashboard() {
  const { meta, state } = useData();
  const { data: stats } = useFetch<StatsResponse>('/api/stats');
  // paginated APIs: only the newest attempts and the latest plan summary (no Markdown bodies) — older servers answer
  // `?limit=` with the full legacy array, which is handled too
  const { data: page } = useFetch<ResultsPage | AttemptSummary[]>(`/api/results?limit=${RECENT}`);
  const { data: plans, reload: reloadPlans } = useFetch<PlansResponse>('/api/plans?limit=1');
  // [μ v5] "Học hôm nay": without the route (older server) the action cards stay unfolded
  const today = useFetch<TodayPreview>('/api/today');
  const { data: progress, error: progressError } = useProgress();
  const studyStart = useStudyStart();
  const [skipped, setSkipped] = useState(onboardingSkipped);
  const [planning, setPlanning] = useState(false);
  const [moreOpen, setMoreOpen] = useState(loadMoreOpen);
  const active = loadActive();
  // [μ v5] an unfinished test mirrored from another device (ρ: PUT /api/active) when this browser has none
  const { remote } = useRemoteActive(!active);
  const remoteHere = !active && remote && remote.deviceId !== deviceId() ? remote : undefined;
  if (!meta) return null;
  const results = Array.isArray(page) ? page.slice(0, RECENT) : page?.items;
  const totalResults = Array.isArray(page) ? page.length : page?.total;
  const c = state?.counts ?? {};
  const T = stats?.totals;
  const plan = plans?.plans[0];
  const nextSession = plan?.sessions.find((s) => !s.done?.length);
  const weak = weakestTopics(stats?.byTopic ?? []);
  const firstTime = totalResults === 0; // no flash of the onboarding box while loading
  const dueToday = c.srs ?? 0;
  const backlog = c.backlog ?? T?.backlog ?? 0;
  const todayAvailable = !today.error || !!today.data;
  // first day: the onboarding wizard (once the goal is known, so it never jumps from step 1 to step 2)
  const wizard = firstTime && !skipped;
  const wizardReady = !!progress || !!progressError;
  // after the diagnostic: its second half (split 2 × 14), then the week-1 plan
  const recent = results ?? [];
  const lastDiag = recent.find((a) => isDiagnostic(a));
  const needSecondHalf = recent.filter((a) => isDiagnosticPart(a)).length === 1 && !recent.some((a) => isDiagnostic(a) && !isDiagnosticPart(a));
  const onboardingPlan = plan?.trigger === 'onboarding';
  const sprintPlan = plan?.trigger === 'sprint';
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

  const activeProgress = active ? progressOf(active) : undefined;
  const resume = active ? (
    <div className="ins-wrap alert info row between lrn-resume">
      <span>
        ⏯️ Bạn đang làm dở <b>{active.session.title}</b> · {activeProgress?.answered}/{activeProgress?.total} câu
      </span>
      <button className="btn primary sm" onClick={() => navigate('/run')}>
        Làm tiếp
      </button>
    </div>
  ) : remoteHere ? (
    <div className="ins-wrap alert info row between lrn-resume">
      <span>
        ⏯️ Bạn đang làm dở <b>{remoteHere.title}</b>
        {remoteHere.total ? ` · ${remoteHere.answered ?? 0}/${remoteHere.total} câu` : ''} · trên {remoteHere.device || 'thiết bị khác'}{' '}
        <span className="muted">· {fmtRelative(remoteHere.updatedAt)}</span>
      </span>
      <button className="btn primary sm" onClick={() => navigate('/run')}>
        Làm tiếp ở đây
      </button>
    </div>
  ) : null;

  // first day: only the wizard (no competing "what to do today" cards on an empty history)
  if (wizard) {
    return (
      <div>
        {head}
        {resume}
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

  // onboarding next steps stay in sight (time-limited); everything else is "Tự chọn khác…" once today's hero exists
  const steps = [
    needSecondHalf && (
      <ActionCard
        key="diag2"
        tone="accent"
        icon="🧭"
        title={`Chẩn đoán phần 2/2 · ${DIAGNOSTIC_PART} câu`}
        desc="Mỗi mục exam guide thêm 1 câu khác — bản đồ xuất phát đủ 2 câu/mục, kế hoạch tuần 1 chính xác hơn."
        cta="Làm phần 2"
        onClick={() => void startTest({ mode: 'diagnostic', count: DIAGNOSTIC_PART, title: `${DIAGNOSTIC_TITLE} · phần 2/2` })}
      />
    ),
    offerPlan && (
      <ActionCard
        key="plan1"
        tone="accent"
        icon="🗓️"
        title="Lập kế hoạch tuần 1"
        desc="Từ bài chẩn đoán: vá các mục ✗ trọng số cao, ôn xen kẽ — tự lập, không cần AI."
        cta={planning ? 'Đang lập…' : 'Lập kế hoạch'}
        onClick={() => !planning && void makePlan()}
      />
    ),
  ].filter(Boolean);

  const cards = [
    nextSession && plan && (
      <ActionCard
        key="plan"
        tone={todayAvailable || active || steps.length ? undefined : 'accent'}
        icon={onboardingPlan ? '🗓️' : sprintPlan ? '🏁' : '🤖'}
        title={nextSession.title}
        desc={nextSession.why ?? (onboardingPlan ? 'Phiên trong kế hoạch tuần 1' : sprintPlan ? 'Phiên trong kế hoạch nước rút' : `Phiên trong kế hoạch AI ${fmtRelative(plan.created)}`)}
        cta={`${nextSession.questions?.length ?? nextSession.filter?.count ?? ''} câu`}
        onClick={() => startTest({ mode: 'coach', plan: `${plan.id}#${nextSession.id}` })}
      />
    ),
    dueToday > 0 && (
      <ActionCard
        key="srs"
        icon="🧠"
        title={`Ôn ${dueToday} câu đến hạn hôm nay`}
        desc={backlog > 0 ? `Câu dễ quên nhất trước · còn ${backlog} câu tồn đọng sang các ngày sau (giới hạn ${meta.srs.daily_limit}/ngày).` : 'Ôn đúng lúc sắp quên — hiệu quả nhất để nhớ lâu.'}
        cta="Ôn ngay"
        onClick={() => startTest({ mode: 'srs', count: Math.min(meta.srs.daily_limit || 30, dueToday) })}
      />
    ),
    (c['retry-wrong'] ?? 0) > 0 && (
      <ActionCard
        key="retry"
        icon="🔁"
        title={`Làm lại ${c['retry-wrong']} câu sai`}
        desc="Các câu lần gần nhất bạn trả lời sai."
        cta="Làm lại"
        onClick={() => startTest({ mode: 'retry-wrong', count: Math.min(25, c['retry-wrong']), feedback: 'practice' })}
      />
    ),
    <ActionCard key="weak" icon="💪" title="Củng cố điểm yếu" desc="Ưu tiên chủ đề/khái niệm tỉ lệ đúng thấp." cta="20 câu" onClick={() => startTest({ mode: 'weak', count: 20 })} />,
    (c.new ?? 0) > 0 && <ActionCard key="new" icon="🆕" title={`${c.new} câu chưa làm`} desc="Mở rộng độ phủ ngân hàng câu hỏi." cta="20 câu mới" onClick={() => startTest({ mode: 'new', count: 20 })} />,
    todayAvailable && (
      <ActionCard key="discriminate" icon={MODE_INFO.discriminate.icon} title={MODE_INFO.discriminate.label} desc={MODE_INFO.discriminate.desc} cta="Chọn cặp" onClick={() => navigate('/new?mode=discriminate')} />
    ),
    todayAvailable && <ActionCard key="qualifier" icon={MODE_INFO.qualifier.icon} title={MODE_INFO.qualifier.label} desc={MODE_INFO.qualifier.desc} cta="Luyện" onClick={() => navigate('/new?mode=qualifier')} />,
    <ActionCard key="quick" icon="⚡" title="Luyện nhanh" desc="10 câu, xem đáp án ngay từng câu." cta="Bắt đầu" onClick={() => startTest({ mode: 'quick', feedback: 'practice' })} />,
    <ActionCard key="exam" icon="🎯" title="Thi thử SAA-C03" desc={`${meta.exam.questions} câu theo trọng số domain.`} cta="Vào thi" onClick={() => navigate('/new?mode=exam')} />,
  ].filter(Boolean);

  return (
    <div>
      {head}
      {resume}

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

      {progress?.phase && <PhaseBanner phase={progress.phase} plan={plan} onPlan={reloadPlans} />}

      {/* desktop: readiness + countdown | today; ≤ 960 px one column: today, countdown, readiness, the rest (styles-learning.css) */}
      <section className="lrn-dash">
        <div className="lrn-dash-side">
          <div className="lrn-o-ready">
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
          </div>
          <ExamCountdown className="lrn-o-count" />
        </div>

        <div className="lrn-dash-main">
          {steps.length > 0 && <div className="grid auto lrn-o-steps">{steps}</div>}
          {todayAvailable && <TodayHero className="lrn-o-hero" counts={c} progress={progress} plans={plans?.plans} />}
          <SideQuests className="lrn-o-quests" counts={c} leeches={stats?.leeches ?? 0} />
          {todayAvailable ? (
            <details
              className="lrn-more lrn-o-more"
              open={moreOpen}
              onToggle={(e) => {
                const open = (e.currentTarget as HTMLDetailsElement).open;
                setMoreOpen(open);
                saveMoreOpen(open);
              }}
            >
              <summary>
                <b>Tự chọn khác…</b> <span className="small muted">ôn đến hạn, làm lại câu sai, phân biệt, thi thử…</span>
              </summary>
              <div className="grid auto">{cards}</div>
            </details>
          ) : (
            <div className="stack lrn-o-more">
              <b>Hôm nay nên làm gì?</b>
              <div className="grid auto">{cards}</div>
            </div>
          )}
        </div>
      </section>

      <section className="grid c2">
        <div className="card">
          <div className="card-head">
            <h2>{onboardingPlan ? '🗓️ Kế hoạch tuần 1' : sprintPlan ? '🏁 Kế hoạch nước rút' : '🤖 Kế hoạch AI Coach'}</h2>
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
                {sprintPlan && <span className="muted"> · tự lập theo ngày thi (không dùng AI)</span>}
              </div>
              {plan.sessions.map((s) => (
                <div key={s.id} className="row between nowrap small">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.title}>
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
          {(weak.list.length > 0 || (weak.shielded && (T?.answers ?? 0) > 0)) && (
            <>
              <div className="divider" />
              <div className="small muted" style={{ marginBottom: 6 }}>
                Chủ đề yếu nhất{weak.shielded ? ' (thấp hơn rõ rệt so với mức chung của bạn)' : ''}
              </div>
              {weak.list.length ? (
                <div className="row">
                  {weak.list.map((b) => (
                    <button
                      key={b.key}
                      className="chip"
                      title={`${b.correct}/${b.attempts} đúng${intervalText(b) ? ` · khoảng 80%: ${intervalText(b)}` : ''}${evidenceNote(b) ? ` · ${evidenceNote(b)!.text}` : ''} — bấm để luyện`}
                      onClick={() => navigate(`/new?mode=topic&topics=${b.key}`)}
                    >
                      {b.label} <span className="n">{b.accuracy}% · {b.attempts}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="small muted">Chưa chủ đề nào thấp hơn rõ rệt — cần thêm câu trả lời trước khi kết luận chủ đề nào yếu.</div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
