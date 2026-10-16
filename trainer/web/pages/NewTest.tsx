import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../lib/store.tsx';
import { startTest } from '../lib/start.ts';
import { Chip, Seg, toggle } from '../components/ui.tsx';
import { fmtDuration } from '../lib/format.ts';
import { MODE_INFO, FEEDBACK_INFO } from '../../shared/labels.ts';
import { TIMING_PRESETS, computeTimeLimit } from '../../shared/timing.ts';
import { applyFilters, modePool } from '../../shared/filters.ts';
import type { BuildTestRequest, Difficulty, DomainId, FeedbackMode, PackOrigin, SelectionFilters, TestMode } from '../../shared/types.ts';

const MODES: TestMode[] = ['exam', 'topic', 'pack', 'srs', 'retry-wrong', 'weak', 'new', 'flagged', 'slow', 'quick', 'custom'];
const ORIGINS: { id: PackOrigin; label: string }[] = [
  { id: 'imported', label: '📚 Đề gốc (V1/V2)' },
  { id: 'ai', label: '🤖 AI sinh' },
  { id: 'doc', label: '📄 Từ tài liệu' },
  { id: 'manual', label: '✍️ Thủ công' },
];
const PILOT = 15; // unscored pilot items in a Pearson-style exam (like the real SAA-C03)

interface Init {
  mode?: TestMode;
  count?: number;
  filters: SelectionFilters;
  pearson?: boolean;
  recall?: boolean;
  feedback?: FeedbackMode;
}

/** `#/new` query: mode, count, topics, domains, packs, services, tags, tasks, pearson=1, recall=1, feedback. */
function parseQuery(q: URLSearchParams): Init {
  const list = (k: string) => {
    const v = q.get(k)?.split(',').map((s) => s.trim()).filter(Boolean);
    return v?.length ? v : undefined;
  };
  const flag = (k: string) => {
    const v = q.get(k);
    return v === null ? undefined : !['0', 'false', 'no', 'off'].includes(v.toLowerCase());
  };
  const mode = q.get('mode') as TestMode | null;
  const count = Number(q.get('count'));
  const fb = q.get('feedback');
  return {
    mode: mode && MODES.includes(mode) ? mode : undefined,
    count: Number.isFinite(count) && count > 0 ? Math.round(count) : undefined,
    filters: {
      topics: list('topics'),
      domains: list('domains') as DomainId[] | undefined,
      packs: list('packs'),
      services: list('services'),
      tags: list('tags'),
      tasks: list('tasks'),
    },
    pearson: flag('pearson'),
    recall: flag('recall'),
    feedback: fb === 'practice' || fb === 'exam' ? fb : undefined,
  };
}

const shortTask = (label: string) => label.split(' (')[0];

export function NewTest({ query }: { query: URLSearchParams }) {
  const { meta, bank, state } = useData();
  const queryKey = query.toString();
  const init = useMemo(() => parseQuery(query), [query]);
  const [mode, setMode] = useState<TestMode>(init.mode ?? 'topic');
  const [filters, setFilters] = useState<SelectionFilters>(init.filters);
  const [count, setCount] = useState<number>(init.count ?? meta?.practice.default_count ?? 20);
  const [feedback, setFeedback] = useState<FeedbackMode>(init.feedback ?? 'exam');
  const [timing, setTiming] = useState('standard');
  const [minutes, setMinutes] = useState(30);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(() => meta?.practice?.shuffle_options ?? true);
  const [pearson, setPearson] = useState<boolean>(init.pearson ?? true);
  const [recallFirst, setRecallFirst] = useState<boolean>(init.recall ?? false);
  const [busy, setBusy] = useState(false);
  const [serviceQuery, setServiceQuery] = useState('');
  const firstMode = useRef(true);
  const autoTiming = useRef(false);
  const lastQuery = useRef(queryKey);

  // A new #/new?… link while the page is open (e.g. Stats → "luyện task 2.2") re-applies the query.
  useEffect(() => {
    if (lastQuery.current === queryKey) return;
    lastQuery.current = queryKey;
    if (init.mode) setMode(init.mode);
    setFilters(init.filters);
    if (init.count) setCount(init.count);
    if (init.pearson !== undefined) setPearson(init.pearson);
    if (init.recall !== undefined) setRecallFirst(init.recall);
    if (init.feedback) setFeedback(init.feedback);
  }, [queryKey, init]);

  useEffect(() => {
    const first = firstMode.current;
    firstMode.current = false;
    if (mode === 'quick' && !(first && init.feedback)) setFeedback('practice');
    if (first && init.count) return; // an explicit ?count= wins on the first render
    if (mode === 'exam') setCount(meta?.exam.questions ?? 65);
    else if (mode === 'quick') setCount(meta?.practice.quick_count ?? 10);
    else if (count === (meta?.exam.questions ?? 65)) setCount(meta?.practice.default_count ?? 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Pearson simulation defaults to the official clock (2 min/question); undo only what we changed ourselves.
  const pearsonOn = mode === 'exam' && pearson;
  useEffect(() => {
    if (pearsonOn && timing === 'standard') {
      setTiming('official');
      autoTiming.current = true;
    } else if (!pearsonOn && timing === 'official' && autoTiming.current) {
      setTiming('standard');
      autoTiming.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pearsonOn]);

  const active = useMemo(() => (bank?.questions ?? []).filter((q) => q.status === 'active'), [bank]);
  const states = state?.states ?? {};
  const srsLimit = state?.counts.srsRemaining; // today's review allowance after srs.daily_limit
  const backlog = state?.counts.backlog ?? 0;
  const effectiveFilters: SelectionFilters = mode === 'pack' ? { packs: filters.packs?.slice(0, 1) } : mode === 'exam' ? {} : filters;
  const filterKey = JSON.stringify(effectiveFilters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pool = useMemo(() => applyFilters(active, effectiveFilters), [active, filterKey]);
  const mPool = useMemo(() => modePool(mode, pool, states, { srsLimit }), [mode, pool, states, srsLimit]);
  const examN = meta?.exam.questions ?? 65;
  const n = pearsonOn ? Math.min(examN, mPool.length) : mode === 'pack' ? mPool.length : Math.min(count, mPool.length);
  const avg = mPool.length ? mPool.reduce((s, q) => s + q.time, 0) / mPool.length : 0;
  const estimate = Math.round(avg * n);
  const limit = computeTimeLimit(estimate, n, timing, minutes, meta?.timing);
  const countsByMode = useMemo(() => {
    const all = active;
    return Object.fromEntries(MODES.map((m) => [m, modePool(m, all, states, { srsLimit }).length]));
  }, [active, states, srsLimit]);
  const taskCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of active) if (q.task) m.set(q.task, (m.get(q.task) ?? 0) + 1);
    return m;
  }, [active]);

  if (!meta || !bank) return null;
  const set = (patch: Partial<SelectionFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const topicCount = (id: string) => active.filter((q) => q.topic === id).length;
  const showTopicFilter = !['exam', 'pack'].includes(mode);
  const showAdvanced = mode === 'custom';
  const tasks = meta.tasks ?? [];
  const showTasks = tasks.length > 0 && showTopicFilter && (showAdvanced || (filters.tasks?.length ?? 0) > 0);
  const classified = taskCounts.size > 0;

  const start = async () => {
    setBusy(true);
    const req: BuildTestRequest = {
      mode,
      count: mode === 'pack' ? undefined : pearsonOn ? examN : count,
      filters: effectiveFilters,
      feedback: pearsonOn ? 'exam' : feedback,
      timing: { preset: timing, minutes },
      shuffleOptions,
      ...(mode === 'exam' ? { pearson } : {}),
      ...(recallFirst ? { recallFirst: true } : {}),
    };
    await startTest(req);
    setBusy(false);
  };

  const services = (meta.services ?? []).filter((s) => !serviceQuery || s.name.toLowerCase().includes(serviceQuery.toLowerCase()));
  const scored = Math.max(0, n - PILOT);

  return (
    <div className="new-test">
      <div className="page-head">
        <div>
          <h1>✍️ Tạo bài test</h1>
          <p>Chọn chế độ, lọc câu hỏi, đặt thời gian — đồng hồ chạy theo tổng thời gian chuẩn của các câu được chọn.</p>
        </div>
      </div>

      <section>
        <div className="grid auto">
          {MODES.map((m) => {
            const info = MODE_INFO[m];
            const c = countsByMode[m];
            const disabled = ['retry-wrong', 'srs', 'flagged', 'slow'].includes(m) && !c;
            return (
              <button key={m} className={`mode-card ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)} style={disabled ? { opacity: 0.55 } : undefined}>
                <span className="t">
                  {info.icon} {info.label}
                </span>
                <span className="d">{info.desc}</span>
                <span className="n">
                  {m === 'exam'
                    ? `${meta.exam.questions} câu · ${meta.exam.duration_min}′ thi thật`
                    : m === 'srs'
                      ? `${c} câu đến hạn hôm nay${backlog ? ` · ${backlog} câu dồn sang ngày sau` : ''}`
                      : `${c} câu khả dụng`}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="split-r">
        <div className="card stack">
          {mode === 'exam' && (
            <>
              <label className={`toggle-card ${pearson ? 'on' : ''}`}>
                <input type="checkbox" checked={pearson} onChange={(e) => setPearson(e.target.checked)} />
                <span className="stack sm">
                  <b>🏛 Mô phỏng Pearson VUE (khuyến nghị)</b>
                  <span className="small dim">
                    {meta.exam.questions} câu = {Math.max(0, meta.exam.questions - PILOT)} tính điểm + {PILOT} câu thử nghiệm <b>không tính điểm và không báo trước</b> (như đề thật) ·
                    đồng hồ {meta.exam.duration_min}′ không tạm dừng · cảnh báo khi còn 15′ và 5′ · cuối bài có <b>màn hình xem lại</b> (lọc câu cắm cờ / chưa trả lời) trước khi
                    “Kết thúc bài thi”.
                  </span>
                </span>
              </label>
              <div className="alert info">
                Phân bổ theo trọng số đề thật: {meta.domains.map((d) => `${d.code} ${d.weight}%`).join(' · ')}. Ưu tiên câu bạn lâu chưa gặp
                {pearson ? ' và câu dài chuẩn thi thật' : ''}. Kết quả quy đổi thang 1000 (đỗ ≥ {meta.exam.pass_scaled}).
              </div>
            </>
          )}

          {mode === 'pack' && (
            <label className="field">
              Bộ đề
              <select value={filters.packs?.[0] ?? ''} onChange={(e) => set({ packs: e.target.value ? [e.target.value] : [] })}>
                <option value="">— Chọn bộ đề —</option>
                {ORIGINS.map((o) => {
                  const packs = bank.packs.filter((p) => p.origin === o.id);
                  if (!packs.length) return null;
                  return (
                    <optgroup key={o.id} label={o.label}>
                      {packs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.activeCount} câu)
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </label>
          )}

          {showTopicFilter && (
            <div className="stack sm">
              <div className="row between">
                <b className="small">Chủ đề {mode !== 'topic' && <span className="muted">(tùy chọn)</span>}</b>
                {filters.topics?.length ? (
                  <button className="btn ghost sm" onClick={() => set({ topics: [] })}>
                    Bỏ chọn
                  </button>
                ) : null}
              </div>
              <div className="row" style={{ gap: 6 }}>
                {meta.topics.map((t) => (
                  <Chip key={t.id} on={filters.topics?.includes(t.id)} onClick={() => set({ topics: toggle(filters.topics, t.id) })} count={topicCount(t.id)}>
                    {t.icon} {t.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {(showAdvanced || mode === 'weak' || mode === 'topic') && (
            <div className="stack sm">
              <b className="small">Domain</b>
              <div className="row" style={{ gap: 6 }}>
                {meta.domains.map((d) => (
                  <Chip key={d.id} on={filters.domains?.includes(d.id)} onClick={() => set({ domains: toggle(filters.domains, d.id) })}>
                    {d.code} · {d.label_vi}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {showTopicFilter && (filters.tags?.length ?? 0) > 0 && (
            <div className="stack sm">
              <div className="row between">
                <b className="small">Tag đang lọc</b>
                <button className="btn ghost sm" onClick={() => set({ tags: [] })}>
                  Bỏ chọn
                </button>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {filters.tags!.map((tg) => (
                  <Chip key={tg} on onClick={() => set({ tags: toggle(filters.tags, tg) })} count={active.filter((q) => q.tags.includes(tg)).length}>
                    {tg} ✕
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {showTasks && (
            <div className="stack sm">
              <div className="row between">
                <b className="small">
                  Task (exam guide 1.1–4.4) {filters.tasks?.length ? <span className="badge accent">{filters.tasks.length}</span> : null}
                </b>
                {filters.tasks?.length ? (
                  <button className="btn ghost sm" onClick={() => set({ tasks: [] })}>
                    Bỏ chọn
                  </button>
                ) : null}
              </div>
              {!classified && (
                <div className="tiny muted">
                  Chưa có câu nào được gắn task — chạy <code>npm run classify-tasks</code> hoặc ENRICH để phân loại.
                </div>
              )}
              <div className="task-groups">
                {meta.domains.map((d) => {
                  const list = tasks.filter((x) => x.domain === d.id);
                  if (!list.length) return null;
                  return (
                    <div key={d.id} className="task-group">
                      <span className="task-dom" title={`${d.label} — ${d.label_vi}`}>
                        {d.code}
                      </span>
                      <div className="row" style={{ gap: 6 }}>
                        {list.map((x) => {
                          const on = !!filters.tasks?.includes(x.id);
                          return (
                            <button
                              key={x.id}
                              type="button"
                              className={`chip task-chip ${on ? 'on' : ''}`}
                              aria-pressed={on}
                              title={`${x.id} ${x.label} — ${x.label_vi}`}
                              onClick={() => set({ tasks: toggle(filters.tasks, x.id) })}
                            >
                              <b className="num">{x.id}</b> {shortTask(x.label_vi)} <span className="n">{taskCounts.get(x.id) ?? 0}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(showAdvanced || mode === 'topic') && (
            <div className="stack sm">
              <b className="small">Độ khó</b>
              <div className="row" style={{ gap: 6 }}>
                {meta.difficulties.map((d) => (
                  <Chip key={d.id} on={filters.difficulties?.includes(d.id)} onClick={() => set({ difficulties: toggle(filters.difficulties, d.id as Difficulty) })}>
                    {d.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {showAdvanced && (
            <>
              <div className="stack sm">
                <b className="small">Nguồn câu hỏi</b>
                <div className="row" style={{ gap: 6 }}>
                  {ORIGINS.map((o) => (
                    <Chip key={o.id} on={filters.origins?.includes(o.id)} onClick={() => set({ origins: toggle(filters.origins, o.id) })} count={active.filter((q) => q.origin === o.id).length}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="stack sm">
                <div className="row between">
                  <b className="small">Service {filters.services?.length ? <span className="badge accent">{filters.services.length}</span> : null}</b>
                  <input type="search" placeholder="Tìm service…" value={serviceQuery} onChange={(e) => setServiceQuery(e.target.value)} className="svc-search" />
                </div>
                <div className="row" style={{ gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {services.map((s) => {
                    const c = active.filter((q) => q.services.includes(s.name)).length;
                    if (!c && !filters.services?.includes(s.name)) return null;
                    return (
                      <Chip key={s.name} on={filters.services?.includes(s.name)} onClick={() => set({ services: toggle(filters.services, s.name) })} count={c}>
                        {s.name}
                      </Chip>
                    );
                  })}
                </div>
              </div>
              <label className="field">
                Từ khóa (stem, đáp án, service, tag)
                <input type="search" value={filters.search ?? ''} onChange={(e) => set({ search: e.target.value })} placeholder="ví dụ: Multi-AZ, PrivateLink, cost-effective…" />
              </label>
            </>
          )}
        </div>

        <div className="card stack sticky-side" style={{ position: 'sticky', top: 16 }}>
          <div>
            <div className="small muted">Bài test</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {MODE_INFO[mode].icon} {MODE_INFO[mode].label}
            </div>
            {pearsonOn && <div className="small nt-accent">🏛 Mô phỏng Pearson VUE</div>}
          </div>

          {mode !== 'pack' && !pearsonOn && (
            <label className="field">
              Số câu
              <div className="row nowrap">
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, Math.min(mode === 'exam' ? 130 : 100, mPool.length || 1))}
                  value={Math.min(count, Math.max(1, mPool.length))}
                  onChange={(e) => setCount(Number(e.target.value))}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} style={{ width: 70 }} />
              </div>
            </label>
          )}

          {pearsonOn ? (
            <div className="field-static small">
              <span className="dim">Chấm điểm</span>
              <b>
                {FEEDBACK_INFO.exam.icon} {FEEDBACK_INFO.exam.label} (như thi thật)
              </b>
            </div>
          ) : (
            <label className="field">
              Chấm điểm
              <Seg value={feedback} onChange={setFeedback} items={(['exam', 'practice'] as FeedbackMode[]).map((f) => ({ id: f, label: `${FEEDBACK_INFO[f].icon} ${FEEDBACK_INFO[f].label}`, title: FEEDBACK_INFO[f].desc }))} />
            </label>
          )}

          <label className="field">
            Thời gian
            <select
              value={timing}
              onChange={(e) => {
                autoTiming.current = false;
                setTiming(e.target.value);
              }}
            >
              {TIMING_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {p.hint}
                </option>
              ))}
            </select>
            {timing === 'custom' && (
              <div className="row nowrap">
                <input type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} style={{ width: 80 }} /> phút
              </div>
            )}
          </label>

          <div className="stack sm">
            <label className="check-line small">
              <input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} />
              <span>Xáo thứ tự đáp án (chống nhớ vị trí)</span>
            </label>
            <label className="check-line small" title="Ẩn các lựa chọn cho tới khi bạn viết ra đáp án mình nghĩ — luyện nhớ chủ động (active recall)">
              <input type="checkbox" checked={recallFirst} onChange={(e) => setRecallFirst(e.target.checked)} />
              <span>
                🧠 Nhớ lại trước <span className="muted">— tự viết đáp án trước khi xem lựa chọn</span>
              </span>
            </label>
          </div>

          <div className="divider" style={{ margin: '4px 0' }} />
          <div className="stack sm small">
            <div className="row between">
              <span className="muted">Số câu sẽ làm</span>
              <b className="num">
                {n}
                {pearsonOn
                  ? n >= examN
                    ? ` (${scored} + ${PILOT} thử nghiệm)`
                    : ` / ${examN} (ngân hàng chỉ có ${mPool.length})`
                  : mode !== 'pack' && mPool.length < count
                    ? ` / ${count} (chỉ có ${mPool.length})`
                    : ''}
              </b>
            </div>
            <div className="row between">
              <span className="muted" title="Tổng thời gian chuẩn ước lượng của các câu">
                Σ thời gian chuẩn
              </span>
              <b className="num">≈ {fmtDuration(estimate, { long: true })}</b>
            </div>
            <div className="row between">
              <span className="muted">Đồng hồ</span>
              <b className="num">
                {limit ? fmtDuration(limit, { long: true }) : 'không giới hạn'}
                {pearsonOn && limit ? ' · không tạm dừng' : ''}
              </b>
            </div>
          </div>
          <button className="btn primary lg" disabled={busy || n === 0 || (mode === 'pack' && !filters.packs?.length)} onClick={start}>
            {busy ? 'Đang tạo…' : pearsonOn ? '▶ Bắt đầu thi thử' : '▶ Bắt đầu'}
          </button>
          {n === 0 && <div className="small muted">Không có câu nào khớp — đổi chế độ hoặc bỏ bớt bộ lọc.</div>}
          <div className="tiny muted shortcut-help">
            Phím tắt khi làm bài: <span className="kbd">1</span>–<span className="kbd">5</span> chọn · <span className="kbd">Shift</span>+<span className="kbd">1</span>–<span className="kbd">5</span> gạch bỏ
            (hoặc chuột phải) · <span className="kbd">←</span>
            <span className="kbd">→</span> chuyển câu · <span className="kbd">F</span> cắm cờ · <span className="kbd">U</span> chưa chắc · <span className="kbd">H</span> gợi ý (chế độ xem
            đáp án ngay) · <span className="kbd">K</span> tô từ khóa
          </div>
        </div>
      </section>
    </div>
  );
}
