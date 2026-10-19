import { useEffect, useMemo, useRef, useState } from 'react';
import { useData, useFetch, useServerEvent } from '../lib/store.tsx';
import { api } from '../lib/api.ts';
import { href } from '../lib/router.ts';
import { startTest } from '../lib/start.ts';
import { fmtDateTime, fmtDuration, fmtRelative } from '../lib/format.ts';
import { Markdown } from '../lib/markdown.tsx';
import { Chip, Empty, Modal, Seg, Tabs, copyText, toast, toggle } from '../components/ui.tsx';
import { BarList } from '../components/charts.tsx';
import { COACH_TASK_LABEL, EnrichPanel, KvRow, fmtUsd, hostListed } from '../components/insights.tsx';
import type { ClaudeStatus, CoachEvent, CoachRunInfo, CostSummary, EnrichStatus, Plan, PlanSession } from '../../shared/types.ts';

type ModelMap = { analyze: string; generate: string; enrich: string; ask: string };

interface CoachInfo {
  claude: ClaudeStatus;
  status: { running?: CoachRunInfo; lockedBy?: { pid: number; runId: string } };
  runs: CoachRunInfo[];
  newSince: { attempts: number; answers: number };
  profile: string;
  coworkPrompt: string;
  schedule: string[];
  costs?: CostSummary; // API-equivalent cost of recent runs + asks (costUsd includes asks; subscription users are not billed this)
  enrich?: EnrichStatus;
  models?: ModelMap; // resolved per-task models ('' = Claude Code default)
  host?: string;
  hostAllowed?: boolean; // this machine may run SCHEDULED coach runs (coach.hosts)
  blocked?: string | null; // why coach runs are refused here (TRAINER_HOME test mode)
  sync?: { beforeAi: boolean; afterAi: boolean }; // config sync.before_ai / after_ai
}

const MODEL_ROWS: { id: keyof ModelMap; label: string }[] = [
  { id: 'analyze', label: '🔍 Phân tích & kế hoạch' },
  { id: 'generate', label: '✨ Sinh câu hỏi' },
  { id: 'enrich', label: '🧹 ENRICH / câu dài' },
  { id: 'ask', label: '🤖 Hỏi AI' },
];

/** Cost of recent coach runs and asks, in API-equivalent dollars, plus the resolved model per task. */
function CostPanel({ costs, models }: { costs?: CostSummary; models?: ModelMap }) {
  const rows = Object.entries(costs?.byTask ?? {}).map(([k, v]) => ({ key: k, label: COACH_TASK_LABEL[k] ?? k, runs: v.runs, cost: v.costUsd }));
  if (costs?.asks?.count) rows.push({ key: 'ask', label: COACH_TASK_LABEL.ask, runs: costs.asks.count, cost: costs.asks.costUsd });
  rows.sort((a, b) => b.cost - a.cost);
  const max = Math.max(0.0001, ...rows.map((r) => r.cost));
  return (
    <div className="grid c2">
      <div className="card stack">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <h2>💰 Chi phí {costs?.days ?? 30} ngày (quy đổi API)</h2>
        </div>
        {!costs ? (
          <div className="small muted">Server chưa báo chi phí (cần bản server mới).</div>
        ) : (
          <>
            <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
              <span className="ins-stat lg">{fmtUsd(costs.costUsd)}</span>
              <span className="small muted">
                {costs.runs} lượt chạy · {costs.asks?.count ?? 0} câu hỏi AI
              </span>
            </div>
            {rows.length ? (
              <BarList max={max} items={rows.map((r) => ({ key: r.key, label: r.label, value: r.cost, valueText: `${fmtUsd(r.cost)} · ${r.runs}`, title: `${r.runs} lượt · ${fmtUsd(r.cost)}` }))} />
            ) : (
              <div className="small muted">Chưa có lượt chạy nào trong khoảng này.</div>
            )}
          </>
        )}
        <div className="tiny muted">
          Số liệu do Claude Code báo theo <b>giá API</b>. Khi đăng nhập bằng gói claude.ai (Pro/Max) đây chỉ là chi phí quy đổi để so sánh — không bị trừ tiền; chỉ khi dùng API
          key mới bị tính thật (giới hạn bằng <code>coach.max_budget_usd</code>).
        </div>
      </div>
      <div className="card stack">
        <h2>🧠 Model theo tác vụ</h2>
        {models ? (
          <div className="stack sm small">
            {MODEL_ROWS.map((m) => (
              <KvRow key={m.id} k={m.label}>
                {models[m.id] ? <code>{models[m.id]}</code> : <span className="muted">mặc định của Claude Code</span>}
              </KvRow>
            ))}
          </div>
        ) : (
          <div className="small muted">Server chưa báo model theo tác vụ.</div>
        )}
        <div className="tiny muted">
          Đổi trong <code>trainer/config.yaml</code> → <code>coach.model</code> (mặc định cho mọi tác vụ) và <code>coach.models.analyze | generate | enrich | ask</code> (ghi đè
          từng tác vụ, vd <code>sonnet</code> cho việc khối lượng lớn, <code>opus</code> cho phân tích).
        </div>
      </div>
    </div>
  );
}

interface NoteInfo {
  file: string;
  title: string;
  size: number;
  group: 'notes' | 'practice' | 'inbox' | 'other';
}

const STATUS_BADGE: Record<CoachRunInfo['status'], string> = {
  running: 'accent',
  success: 'good',
  error: 'bad',
  cancelled: 'warn',
  skipped: '',
};

function Console({ events, live }: { events: CoachEvent[]; live?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [events.length]);
  if (!events.length) return <div className="console muted">{live ? 'Đang khởi động Claude Code…' : 'Chưa có log.'}</div>;
  const icon: Record<string, string> = { start: '▶', tool: '·', text: '✎', result: '✔', error: '✗', stderr: '!', end: '■' };
  return (
    <div className="console" ref={ref} aria-live="polite">
      {events.map((e, i) => (
        <div key={i} className={`ev ${e.kind}`}>
          <span className="muted">{new Date(e.at).toLocaleTimeString('vi-VN', { hour12: false })}</span> {icon[e.kind] ?? '-'} {e.text}
        </div>
      ))}
    </div>
  );
}

function SessionCard({ plan, s }: { plan: Plan; s: PlanSession }) {
  const { byId } = useData();
  const ids = s.questions ?? [];
  const missing = ids.filter((id) => !byId.has(id)).length;
  const est = ids.reduce((sum, id) => sum + (byId.get(id)?.time ?? 0), 0);
  const last = s.done?.[s.done.length - 1];
  return (
    <div className={`session-card ${last ? 'done' : ''}`}>
      <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <span className="title">{s.title}</span>
        {last ? <span className="badge good">✓ {last.score}%</span> : <span className="badge">{s.id}</span>}
      </div>
      {s.why && <div className="small dim">{s.why}</div>}
      <div className="tiny muted">
        {ids.length ? `${ids.length} câu · ≈ ${fmtDuration(est, { long: true })}` : s.filter ? `Bộ lọc: ${s.filter.mode}${s.filter.count ? ` · ${s.filter.count} câu` : ''}` : ''}
        {s.feedback ? ` · ${s.feedback === 'practice' ? 'xem đáp án ngay' : 'chấm cuối bài'}` : ''}
        {missing ? ` · ⚠️ ${missing} id không tồn tại` : ''}
      </div>
      <div className="row">
        <button className="btn primary sm" onClick={() => startTest({ mode: 'coach', plan: `${plan.id}#${s.id}` })}>
          {last ? '↻ Làm lại' : '▶ Bắt đầu'}
        </button>
        {s.done && s.done.length > 0 && (
          <a className="small" href={href(`/result/${encodeURIComponent(last!.attemptId)}`)}>
            Xem kết quả
          </a>
        )}
      </div>
    </div>
  );
}

function GenerateForm({ disabled, onStarted }: { disabled: boolean; onStarted: () => void }) {
  const { meta } = useData();
  const { data: notes } = useFetch<NoteInfo[]>('/api/notes');
  const [sources, setSources] = useState<string[]>([]);
  const [count, setCount] = useState(15);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('mixed');
  const [focus, setFocus] = useState('');
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => {
    const g: Record<string, NoteInfo[]> = {};
    for (const n of notes ?? []) (g[n.group] ??= []).push(n);
    return g;
  }, [notes]);
  const run = async () => {
    setBusy(true);
    try {
      await api.post('/api/coach/run', {
        task: 'generate',
        params: {
          sources,
          count,
          topic,
          focus,
          difficulty: { mixed: 'medium 50%, hard 35%, easy 15%', easy: 'easy 60%, medium 40%', hard: 'hard 70%, medium 30%' }[difficulty],
        },
      });
      onStarted();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <div className="small dim">
        Chọn tài liệu làm nguồn (notes trong repo hoặc file bạn thả vào <code>trainer/inbox/</code> — md, txt, pdf). Claude đọc tài liệu, viết câu hỏi theo{' '}
        <code>bank/SCHEMA.md</code>, chạy validator rồi lưu thành pack mới trong <code>bank/packs/docs/</code>.
      </div>
      {(['inbox', 'notes', 'other'] as const).map((g) =>
        groups[g]?.length ? (
          <div key={g} className="stack sm">
            <b className="small">{{ inbox: '📥 Inbox', notes: '📚 Notes', other: '📎 Khác', practice: '' }[g]}</b>
            <div className="row" style={{ gap: 6, maxHeight: 160, overflowY: 'auto' }}>
              {groups[g].map((n) => (
                <Chip key={n.file} on={sources.includes(n.file)} onClick={() => setSources((s) => toggle(s, n.file))}>
                  <span title={n.title}>{n.file}</span>
                </Chip>
              ))}
            </div>
          </div>
        ) : null,
      )}
      <div className="grid c3">
        <label className="field">
          Số câu
          <input type="number" min={3} max={60} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        <label className="field">
          Chủ đề
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">Tự xác định</option>
            {meta?.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Độ khó
          <Seg value={difficulty} onChange={setDifficulty} items={[{ id: 'easy', label: 'Dễ' }, { id: 'mixed', label: 'Trộn' }, { id: 'hard', label: 'Khó' }]} />
        </label>
      </div>
      <label className="field">
        Trọng tâm (tùy chọn)
        <input type="text" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="ví dụ: so sánh Multi-AZ vs Read Replica, giới hạn Lambda, chiến lược DR…" />
      </label>
      <div className="row">
        <button className="btn primary" disabled={disabled || busy || (!sources.length && !topic && !focus)} onClick={run}>
          ✨ Sinh {count} câu hỏi
        </button>
        {!sources.length && !topic && !focus && <span className="small muted">Chọn ít nhất 1 tài liệu, chủ đề hoặc trọng tâm.</span>}
      </div>
    </div>
  );
}

export function Coach() {
  const { meta, refresh } = useData();
  const { data: info, reload } = useFetch<CoachInfo>('/api/coach');
  const { data: planData } = useFetch<{ plans: Plan[]; newSince: { attempts: number } }>('/api/plans');
  const [events, setEvents] = useState<CoachEvent[]>([]);
  const [viewRun, setViewRun] = useState<string>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'plan' | 'generate' | 'enrich' | 'history' | 'profile' | 'costs' | 'setup'>('plan');
  const [showPrompt, setShowPrompt] = useState(false);
  const [planIdx, setPlanIdx] = useState(0);
  const running = info?.status.running;

  useEffect(() => {
    if (running) {
      setViewRun(running.id);
      api.get<{ events: CoachEvent[] }>(`/api/coach/runs/${encodeURIComponent(running.id)}`).then((r) => setEvents(r.events)).catch(() => undefined);
    }
  }, [running?.id]);

  useEffect(() => {
    if (!viewRun && !running && info?.runs.length) setViewRun(info.runs[0].id);
  }, [info, viewRun, running]);

  useEffect(() => {
    if (!viewRun || viewRun === running?.id) return;
    api.get<{ events: CoachEvent[] }>(`/api/coach/runs/${encodeURIComponent(viewRun)}`).then((r) => setEvents(r.events)).catch(() => undefined);
  }, [viewRun]);

  useServerEvent<CoachEvent>('coach', (ev) => {
    if (ev.kind === 'start' && ev.runId !== viewRun) {
      setViewRun(ev.runId);
      setEvents([ev]);
      reload();
      return;
    }
    if (ev.runId === viewRun || !viewRun) setEvents((prev) => [...prev, ev]);
  });
  useServerEvent<CoachRunInfo>('coach-done', (r) => {
    reload();
    void refresh();
    const what = r.task === 'enrich' ? 'ENRICH' : r.task === 'longform' ? 'Sinh câu dài' : r.task === 'generate' ? 'Sinh câu hỏi' : 'AI Coach';
    toast(
      r.status === 'success'
        ? `✅ ${what} đã xong — ${r.task === 'analyze' ? 'kế hoạch & ' : ''}ngân hàng đã cập nhật.`
        : r.status === 'skipped'
          ? `⏭ ${what}: ${r.summary ?? 'không còn việc để làm'}`
          : `${what} kết thúc: ${r.status}`,
    );
  });

  const analyze = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ run: CoachRunInfo }>('/api/coach/run', { task: 'analyze', params: note ? { note } : {} });
      setViewRun(r.run.id);
      setEvents([]);
      reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    await api.post('/api/coach/cancel');
    reload();
  };

  if (!meta) return null;
  const plans = planData?.plans ?? [];
  const plan = plans[planIdx];
  const claude = info?.claude;
  const viewing = info?.runs.find((r) => r.id === viewRun) ?? running;
  const coachHosts = meta.coachHosts ?? [];
  const host = info?.host ?? meta.host;
  const hostExcluded = info?.hostAllowed !== undefined ? !info.hostAllowed : !hostListed(host, coachHosts);
  const blocked = info?.blocked || undefined;
  const costs = info?.costs;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>🤖 AI Coach</h1>
          <p>Claude đọc kết quả của bạn → tìm điểm yếu & hiểu nhầm → bổ sung câu hỏi biến thể/mở rộng vào ngân hàng → lập kế hoạch luyện tiếp.</p>
        </div>
      </div>

      <section className="split-l">
        <div className="card stack">
          <div className="row between">
            <b>Phân tích & lập kế hoạch</b>
            {claude && <span className={`badge ${claude.available ? 'good' : 'warn'}`}>{claude.available ? `Claude ${claude.version?.split(' ')[0] ?? ''}` : 'Chưa có CLI'}</span>}
          </div>
          <div className="small dim">
            {info ? (
              <>
                Kể từ kế hoạch gần nhất: <b>{info.newSince.attempts}</b> bài mới / {info.newSince.answers} câu.
                {meta.openIssues ? ` ${meta.openIssues} báo lỗi đang mở.` : ''}
              </>
            ) : (
              '…'
            )}
          </div>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú cho coach (tùy chọn): ví dụ “tuần sau thi, tập trung domain 1”" />
          {running ? (
            <div className="row">
              <span className="spinner" />{' '}
              <span className="small">
                Đang chạy {COACH_TASK_LABEL[running.task] ?? ''} · bắt đầu {fmtRelative(running.startedAt)}…
              </span>
              <span className="spacer" />
              <button className="btn danger sm" onClick={cancel}>
                ■ Dừng
              </button>
            </div>
          ) : (
            <button className="btn primary lg" disabled={busy || !claude?.available || !!info?.status.lockedBy || !!blocked} onClick={analyze}>
              🔍 Phân tích ngay
            </button>
          )}
          {info?.status.lockedBy && !running && <div className="ins-wrap alert warn small">Một tiến trình khác (lịch tự động / CLI) đang chạy coach: {info.status.lockedBy.runId}</div>}
          {claude && !claude.available && <div className="ins-wrap alert warn small">{claude.hint}</div>}
          {blocked && <div className="ins-wrap alert info small">⏸ {blocked}</div>}
          {hostExcluded && (
            <div className="ins-wrap alert warn small">
              ⚠️ Máy này (<code>{host}</code>) không nằm trong <code>coach.hosts</code> ({coachHosts.join(', ')}) — lịch tự động sẽ bỏ qua AI Coach ở đây. Bấm tay vẫn chạy
              được; đổi trong <code>trainer/config.yaml</code>.
            </div>
          )}
          {info?.sync && (info.sync.beforeAi || info.sync.afterAi) && (
            <div className="tiny muted ins-wrap" title="Đổi trong trainer/config.yaml → sync.before_ai / sync.after_ai">
              ⇅ Tự đồng bộ {info.sync.beforeAi && info.sync.afterAi ? 'trước và sau' : info.sync.beforeAi ? 'trước' : 'sau'} mỗi lượt AI (phân tích, sinh câu, ENRICH) —{' '}
              {info.sync.beforeAi ? 'AI thấy cả bài làm của máy kia' : 'kết quả AI được đẩy lên ngay'}.
            </div>
          )}
          <div className="row">
            <button className="btn sm" onClick={() => setShowPrompt(true)}>
              📋 Prompt cho Claude Cowork
            </button>
            <button className="btn ghost sm" onClick={() => setTab('setup')}>
              ⏰ Chạy định kỳ
            </button>
          </div>
          {claude?.available && claude.auth && !claude.auth.loggedIn && (
            <div className="ins-wrap alert warn small">Claude Code chưa đăng nhập — mở terminal chạy <code>claude</code> rồi <code>/login</code>.</div>
          )}
          {claude?.available && (
            <div className="tiny muted" title={claude.path}>
              CLI: {claude.source}
              {claude.auth?.loggedIn ? ` · đăng nhập ${claude.auth.method ?? ''}${claude.auth.plan ? ` (${claude.auth.plan})` : ''}` : ''}
              {info?.models?.analyze ? ` · model phân tích: ${info.models.analyze}` : ''}
            </div>
          )}
          {costs && (
            <button type="button" className="ins-linkish small" onClick={() => setTab('costs')} title="Chi phí theo giá API do Claude Code báo — gói claude.ai không bị trừ số này">
              💰 {costs.days} ngày: <b>{fmtUsd(costs.costUsd)}</b> quy đổi API · {costs.runs} lượt
              {costs.asks?.count ? ` · ${costs.asks.count} câu hỏi AI` : ''} →
            </button>
          )}
        </div>

        <div className="card stack">
          <div className="row between">
            <b>
              Log {viewing ? <span className="mono tiny muted">{viewing.id}</span> : null}
            </b>
            {viewing && <span className={`badge ${STATUS_BADGE[viewing.status]}`}>{viewing.status}</span>}
          </div>
          <Console events={events} live={!!running} />
          {viewing?.summary && viewing.status !== 'running' && (
            <div className="ins-wrap alert good small">
              <Markdown text={viewing.summary} />
            </div>
          )}
          {viewing?.error && <div className="ins-wrap alert bad small">Lỗi: {viewing.error}</div>}
        </div>
      </section>

      <section>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'plan', label: `🧭 Kế hoạch${plans.length ? ` (${plans.length})` : ''}` },
            { id: 'generate', label: '✨ Sinh câu hỏi từ tài liệu' },
            { id: 'enrich', label: `🧹 ENRICH${info?.enrich ? ` (${info.enrich.enriched}/${info.enrich.total})` : ''}` },
            { id: 'profile', label: '👤 Hồ sơ người học' },
            { id: 'history', label: `🗒️ Lượt chạy (${info?.runs.length ?? 0})` },
            { id: 'costs', label: '💰 Chi phí & model' },
            { id: 'setup', label: '⚙️ Tự động hoá' },
          ]}
        />

        {tab === 'plan' &&
          (!plan ? (
            <Empty icon="🧭" title="Chưa có kế hoạch nào">
              Làm vài bài test rồi bấm <b>Phân tích ngay</b>. Kế hoạch được lưu ở <code>trainer/coach/plans/</code>.
            </Empty>
          ) : (
            <div className="stack">
              <div className="row between">
                <div>
                  <b>{plan.summary ?? plan.id}</b>
                  <div className="small muted ins-wrap">
                    {fmtDateTime(plan.created)} · {plan.trigger ?? 'manual'} · <code>trainer/{plan.file}</code>
                    {plan.newPacks.length ? ` · pack mới: ${plan.newPacks.join(', ')}` : ''}
                  </div>
                </div>
                {plans.length > 1 && (
                  <select value={planIdx} onChange={(e) => setPlanIdx(Number(e.target.value))}>
                    {plans.map((p, i) => (
                      <option key={p.id} value={i}>
                        {i === 0 ? '★ ' : ''}
                        {fmtDateTime(p.created)} — {p.id}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {plan.sessions.length > 0 && (
                <div className="grid auto">
                  {plan.sessions.map((s) => (
                    <SessionCard key={s.id} plan={plan} s={s} />
                  ))}
                </div>
              )}
              <div className="card pad-lg">
                <Markdown text={plan.body} base={`trainer/${plan.file.slice(0, plan.file.lastIndexOf('/') + 1)}`} />
              </div>
            </div>
          ))}

        {tab === 'generate' && (
          <div className="card">
            <GenerateForm
              disabled={!!running || !claude?.available || !!blocked}
              onStarted={() => {
                setEvents([]);
                reload();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        )}

        {tab === 'enrich' && (
          <div className="card stack">
            <div className="small dim">
              <b>ENRICH</b> là quy trình bảo trì ngân hàng chạy dần (mặc định khi lịch tự động không có bài làm mới): viết lại giải thích theo chuẩn (vì sao đúng + từng phương án
              nhiễu + tóm tắt 🇻🇳), thêm gợi ý, phân loại domain/task, cân độ dài phương án; và sinh <b>câu dài</b> giống đề thật cho các câu bạn hay gặp/sai.
            </div>
            <EnrichPanel
              running={!!running || !!info?.status.lockedBy}
              blocked={blocked}
              onStarted={(r) => {
                setViewRun(r.id);
                setEvents([]);
                reload();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        )}

        {tab === 'costs' && <CostPanel costs={costs} models={info?.models} />}

        {tab === 'profile' && (
          <div className="card pad-lg">
            {info?.profile ? <Markdown text={info.profile} base="trainer/coach/" /> : <Empty icon="👤" title="Chưa có hồ sơ">AI Coach tạo <code>trainer/coach/learner-profile.md</code> ở lần phân tích đầu tiên và cập nhật dần.</Empty>}
          </div>
        )}

        {tab === 'history' && (
          <div className="card" style={{ padding: 6 }}>
            {!info?.runs.length ? (
              <Empty icon="🗒️" title="Chưa có lượt chạy nào" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Bắt đầu</th>
                      <th>Việc</th>
                      <th>Kích hoạt</th>
                      <th>Trạng thái</th>
                      <th className="num">Chi phí</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {info.runs.map((r) => (
                      <tr key={r.id}>
                        <td className="small nowrap">{fmtDateTime(r.startedAt)}</td>
                        <td className="small">
                          {COACH_TASK_LABEL[r.task] ?? r.task}
                          {r.params && typeof r.params.size === 'number' ? <span className="tiny muted"> · {r.params.size} câu</span> : null}
                          {r.params && typeof r.params.count === 'number' ? <span className="tiny muted"> · {r.params.count} câu</span> : null}
                        </td>
                        <td className="small">{r.trigger}</td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                        </td>
                        <td className="num small">{r.costUsd ? `$${r.costUsd.toFixed(3)}` : '—'}</td>
                        <td>
                          <button
                            className="btn ghost sm"
                            onClick={() => {
                              setViewRun(r.id);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            Xem log
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'setup' && (
          <div className="grid c2 ins-wrap">
            <div className="card stack">
              <h2>⏰ Chạy tự động trên máy</h2>
              <div className="small dim">
                Chạy <code>claude -p</code> headless vào các giờ cố định (macOS launchd · Linux cron · Windows Task Scheduler). Không có bài làm/báo lỗi mới → bỏ qua phân tích và
                chạy 1 lượt ENRICH thay thế. Giờ chạy: <code>trainer/config.yaml</code> → <code>coach.schedule</code> (hiện tại: {info?.schedule?.join(', ') ?? '—'}).
              </div>
              <pre className="console" style={{ margin: 0 }}>{`cd trainer
npm run schedule -- install     # cài lịch
npm run schedule -- status      # xem trạng thái
npm run schedule -- uninstall   # gỡ
npm run coach                   # chạy 1 lần ngay (bỏ qua nếu không có dữ liệu mới)
npm run coach -- --force        # luôn chạy
npm run coach -- --enrich --size 20   # 1 lượt ENRICH
npm run coach -- --longform --count 5 # sinh 5 câu dài`}</pre>
              <div className="tiny muted">
                Máy cần bật. Log: trainer/coach/runs/.{' '}
                {coachHosts.length ? (
                  <>
                    Lịch chỉ chạy trên: <b>{coachHosts.join(', ')}</b>
                    {hostExcluded ? ` — máy này (${host}) sẽ bỏ qua.` : ' (gồm máy này).'}
                  </>
                ) : (
                  <>
                    Dùng 2 máy? Đặt <code>coach.hosts: [{host || 'tên-máy'}]</code> để chỉ một máy chạy lịch, máy còn lại chỉ “⇅ Đồng bộ”.
                  </>
                )}
              </div>
            </div>
            <div className="card stack">
              <h2>🧑‍💻 Claude Cowork / Claude Code</h2>
              <ol className="small ins-wrap" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                <li>
                  Mở Cowork, chọn thư mục repo <code>{meta.paths.repo}</code>.
                </li>
                <li>Dán prompt (nút bên dưới) hoặc chỉ cần: “Thực hiện quy trình trong trainer/coach/COACH.md”.</li>
                <li>
                  Chạy định kỳ: thanh bên <b>Scheduled</b> → <b>New task</b> → <i>Set up manually</i> → chọn tần suất (hằng giờ / hằng ngày / ngày làm việc…), chọn thư mục repo, dán prompt. Task dùng file local chỉ chạy khi máy bật và Claude Desktop đang mở.
                </li>
                <li>
                  Trong Claude Code (VS Code/terminal): gõ <code>/trainer-coach</code> hoặc <code>/trainer-generate</code>.
                </li>
              </ol>
              <div className="tiny muted">
                Cowork không thể được kích hoạt từ app khác, nên nút “Phân tích ngay” dùng Claude Code CLI. Lượt chạy ngoài app không có log ở đây; app tự nhận kế hoạch/pack mới khi file thay đổi. Snapshot được cập nhật sau mỗi bài nộp — có thể bấm “Cập nhật snapshot” cho chắc.
              </div>
              <div className="row">
                <button className="btn sm" onClick={() => setShowPrompt(true)}>
                  📋 Xem / copy prompt
                </button>
                <button
                  className="btn sm"
                  onClick={async () => {
                    await api.post('/api/snapshot');
                    toast('Đã cập nhật trainer/coach/snapshot.md');
                  }}
                >
                  📸 Cập nhật snapshot
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <Modal open={showPrompt} onClose={() => setShowPrompt(false)} title="Prompt cho Claude Cowork" wide>
        <div className="stack">
          <div className="small dim">Dùng khi chạy coach bên ngoài app (Cowork, Claude Code, Claude Desktop). Thư mục làm việc phải là gốc repo.</div>
          <pre className="console" style={{ margin: 0, maxHeight: 320 }}>
            {info?.coworkPrompt ?? '…'}
          </pre>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn primary"
              onClick={async () => {
                if (info && (await copyText(info.coworkPrompt))) toast('Đã copy prompt');
              }}
            >
              📋 Copy
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
