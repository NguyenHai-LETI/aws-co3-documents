import { useEffect, useMemo, useState } from 'react';
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

function parseQuery(q: URLSearchParams): Partial<BuildTestRequest> & { filters: SelectionFilters } {
  const list = (k: string) => q.get(k)?.split(',').filter(Boolean);
  return {
    mode: (q.get('mode') as TestMode) || undefined,
    count: q.get('count') ? Number(q.get('count')) : undefined,
    filters: {
      topics: list('topics'),
      domains: list('domains') as DomainId[] | undefined,
      packs: list('packs'),
      services: list('services'),
      tags: list('tags'),
    },
  };
}

export function NewTest({ query }: { query: URLSearchParams }) {
  const { meta, bank, state } = useData();
  const init = useMemo(() => parseQuery(query), [query]);
  const [mode, setMode] = useState<TestMode>(init.mode ?? 'topic');
  const [filters, setFilters] = useState<SelectionFilters>(init.filters);
  const [count, setCount] = useState<number>(init.count ?? meta?.practice.default_count ?? 20);
  const [feedback, setFeedback] = useState<FeedbackMode>('exam');
  const [timing, setTiming] = useState('standard');
  const [minutes, setMinutes] = useState(30);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serviceQuery, setServiceQuery] = useState('');

  useEffect(() => {
    if (mode === 'exam') setCount(meta?.exam.questions ?? 65);
    else if (mode === 'quick') {
      setCount(meta?.practice.quick_count ?? 10);
      setFeedback('practice');
    } else if (count === (meta?.exam.questions ?? 65)) setCount(meta?.practice.default_count ?? 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const active = useMemo(() => (bank?.questions ?? []).filter((q) => q.status === 'active'), [bank]);
  const states = state?.states ?? {};
  const effectiveFilters: SelectionFilters = mode === 'pack' ? { packs: filters.packs?.slice(0, 1) } : mode === 'exam' ? {} : filters;
  const pool = useMemo(() => applyFilters(active, effectiveFilters), [active, JSON.stringify(effectiveFilters)]);
  const mPool = useMemo(() => modePool(mode, pool, states), [mode, pool, states]);
  const n = mode === 'pack' ? mPool.length : Math.min(count, mPool.length);
  const avg = mPool.length ? mPool.reduce((s, q) => s + q.time, 0) / mPool.length : 0;
  const estimate = Math.round(avg * n);
  const limit = computeTimeLimit(estimate, n, timing, minutes, meta?.timing);
  const countsByMode = useMemo(() => {
    const all = active;
    return Object.fromEntries(MODES.map((m) => [m, modePool(m, all, states).length]));
  }, [active, states]);

  if (!meta || !bank) return null;
  const set = (patch: Partial<SelectionFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const topicCount = (id: string) => active.filter((q) => q.topic === id).length;
  const showTopicFilter = !['exam', 'pack'].includes(mode);
  const showAdvanced = mode === 'custom';

  const start = async () => {
    setBusy(true);
    await startTest({
      mode,
      count: mode === 'pack' ? undefined : count,
      filters: effectiveFilters,
      feedback,
      timing: { preset: timing, minutes },
      shuffleOptions,
    });
    setBusy(false);
  };

  const services = (meta.services ?? []).filter((s) => !serviceQuery || s.name.toLowerCase().includes(serviceQuery.toLowerCase()));

  return (
    <div>
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
                  {m === 'exam' ? `${meta.exam.questions} câu · ${meta.exam.duration_min}′ thi thật` : `${c} câu khả dụng`}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="split-r">
        <div className="card stack">
          {mode === 'exam' && (
            <div className="alert info">
              Phân bổ theo trọng số đề thật:{' '}
              {meta.domains.map((d) => `${d.code} ${d.weight}%`).join(' · ')}. Ưu tiên câu bạn lâu chưa gặp. Kết quả quy đổi thang 1000 (đỗ ≥ {meta.exam.pass_scaled}).
            </div>
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
                  <input type="search" placeholder="Tìm service…" value={serviceQuery} onChange={(e) => setServiceQuery(e.target.value)} style={{ width: 200 }} />
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
          </div>

          {mode !== 'pack' && (
            <label className="field">
              Số câu
              <div className="row nowrap">
                <input type="range" min={1} max={Math.max(1, Math.min(mode === 'exam' ? 130 : 100, mPool.length || 1))} value={Math.min(count, Math.max(1, mPool.length))} onChange={(e) => setCount(Number(e.target.value))} style={{ flex: 1 }} />
                <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} style={{ width: 70 }} />
              </div>
            </label>
          )}

          <label className="field">
            Chấm điểm
            <Seg value={feedback} onChange={setFeedback} items={(['exam', 'practice'] as FeedbackMode[]).map((f) => ({ id: f, label: `${FEEDBACK_INFO[f].icon} ${FEEDBACK_INFO[f].label}`, title: FEEDBACK_INFO[f].desc }))} />
          </label>

          <label className="field">
            Thời gian
            <select value={timing} onChange={(e) => setTiming(e.target.value)}>
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

          <label className="row small" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} /> Xáo thứ tự đáp án (chống nhớ vị trí)
          </label>

          <div className="divider" style={{ margin: '4px 0' }} />
          <div className="stack sm small">
            <div className="row between">
              <span className="muted">Số câu sẽ làm</span>
              <b className="num">
                {n}
                {mode !== 'pack' && mPool.length < count ? ` / ${count} (chỉ có ${mPool.length})` : ''}
              </b>
            </div>
            <div className="row between">
              <span className="muted" title="Tổng thời gian chuẩn ước lượng của các câu">Σ thời gian chuẩn</span>
              <b className="num">≈ {fmtDuration(estimate, { long: true })}</b>
            </div>
            <div className="row between">
              <span className="muted">Đồng hồ</span>
              <b className="num">{limit ? fmtDuration(limit, { long: true }) : 'không giới hạn'}</b>
            </div>
          </div>
          <button className="btn primary lg" disabled={busy || n === 0 || (mode === 'pack' && !filters.packs?.length)} onClick={start}>
            {busy ? 'Đang tạo…' : '▶ Bắt đầu'}
          </button>
          {n === 0 && <div className="small muted">Không có câu nào khớp — đổi chế độ hoặc bỏ bớt bộ lọc.</div>}
          <div className="tiny muted">
            Phím tắt khi làm bài: <span className="kbd">1</span>–<span className="kbd">5</span> chọn đáp án · <span className="kbd">←</span>
            <span className="kbd">→</span> chuyển câu · <span className="kbd">F</span> cắm cờ · <span className="kbd">U</span> chưa chắc
          </div>
        </div>
      </section>
    </div>
  );
}
