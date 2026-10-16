import { useEffect, useMemo, useRef, useState } from 'react';
import { useData, useFetch, useServerEvent } from '../lib/store.tsx';
import { api } from '../lib/api.ts';
import { href } from '../lib/router.ts';
import { startTest } from '../lib/start.ts';
import { fmtDateTime, fmtDuration, fmtRelative } from '../lib/format.ts';
import { Markdown } from '../lib/markdown.tsx';
import { Chip, Empty, Modal, Seg, Tabs, copyText, toast, toggle } from '../components/ui.tsx';
import type { ClaudeStatus, CoachEvent, CoachRunInfo, Plan, PlanSession } from '../../shared/types.ts';

interface CoachInfo {
  claude: ClaudeStatus;
  status: { running?: CoachRunInfo; lockedBy?: { pid: number; runId: string } };
  runs: CoachRunInfo[];
  newSince: { attempts: number; answers: number };
  profile: string;
  coworkPrompt: string;
  schedule: string[];
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
  const [tab, setTab] = useState<'plan' | 'generate' | 'history' | 'profile' | 'setup'>('plan');
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
    toast(r.status === 'success' ? '✅ AI Coach đã xong — kế hoạch & ngân hàng đã cập nhật.' : `AI Coach kết thúc: ${r.status}`);
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
              <span className="spinner" /> <span className="small">Đang chạy {fmtRelative(running.startedAt)}…</span>
              <span className="spacer" />
              <button className="btn danger sm" onClick={cancel}>
                ■ Dừng
              </button>
            </div>
          ) : (
            <button className="btn primary lg" disabled={busy || !claude?.available || !!info?.status.lockedBy} onClick={analyze}>
              🔍 Phân tích ngay
            </button>
          )}
          {info?.status.lockedBy && !running && <div className="alert warn small">Một tiến trình khác (lịch tự động / CLI) đang chạy coach: {info.status.lockedBy.runId}</div>}
          {claude && !claude.available && <div className="alert warn small">{claude.hint}</div>}
          <div className="row">
            <button className="btn sm" onClick={() => setShowPrompt(true)}>
              📋 Prompt cho Claude Cowork
            </button>
            <button className="btn ghost sm" onClick={() => setTab('setup')}>
              ⏰ Chạy định kỳ
            </button>
          </div>
          {claude?.available && claude.auth && !claude.auth.loggedIn && (
            <div className="alert warn small">Claude Code chưa đăng nhập — mở terminal chạy <code>claude</code> rồi <code>/login</code>.</div>
          )}
          {claude?.available && (
            <div className="tiny muted" title={claude.path}>
              CLI: {claude.source}
              {claude.auth?.loggedIn ? ` · đăng nhập ${claude.auth.method ?? ''}${claude.auth.plan ? ` (${claude.auth.plan})` : ''}` : ''}
            </div>
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
            <div className="alert good small">
              <Markdown text={viewing.summary} />
            </div>
          )}
          {viewing?.error && <div className="alert bad small">Lỗi: {viewing.error}</div>}
        </div>
      </section>

      <section>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'plan', label: `🧭 Kế hoạch${plans.length ? ` (${plans.length})` : ''}` },
            { id: 'generate', label: '✨ Sinh câu hỏi từ tài liệu' },
            { id: 'profile', label: '👤 Hồ sơ người học' },
            { id: 'history', label: `🗒️ Lượt chạy (${info?.runs.length ?? 0})` },
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
                  <div className="small muted">
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
              disabled={!!running || !claude?.available}
              onStarted={() => {
                setEvents([]);
                reload();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        )}

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
                        <td className="small">{r.task === 'analyze' ? '🔍 Phân tích' : '✨ Sinh câu hỏi'}</td>
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
          <div className="grid c2">
            <div className="card stack">
              <h2>⏰ Chạy tự động trên máy (macOS launchd)</h2>
              <div className="small dim">
                Chạy <code>claude -p</code> headless vào các giờ cố định. Lượt chạy tự bỏ qua nếu không có bài làm mới hoặc báo lỗi mới (tiết kiệm token). Giờ chạy cấu hình ở <code>trainer/config.yaml</code> →{' '}
                <code>coach.schedule</code> (hiện tại: {info?.schedule.join(', ') ?? '—'}).
              </div>
              <pre className="console" style={{ margin: 0 }}>{`cd trainer
npm run schedule -- install     # cài lịch
npm run schedule -- status      # xem trạng thái
npm run schedule -- uninstall   # gỡ
npm run coach                   # chạy 1 lần ngay (bỏ qua nếu không có dữ liệu mới)
npm run coach -- --force        # luôn chạy`}</pre>
              <div className="tiny muted">Máy cần bật (launchd chạy bù khi máy thức dậy). Log: trainer/coach/runs/.</div>
            </div>
            <div className="card stack">
              <h2>🧑‍💻 Claude Cowork / Claude Code</h2>
              <ol className="small" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
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
