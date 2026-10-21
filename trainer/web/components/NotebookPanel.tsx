// [v5 τ] Tài liệu → "📒 Sổ lỗi": the learner's misconceptions (coach/notebook/<domain>.md) — view, filter, delete, merge,
// and "📒 Cập nhật sổ" (one AI call over the wrong / unsure answers not covered yet). Evidence ids never include a sealed
// question (the server filters them).
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import { useData, useFetch } from '../lib/store.tsx';
import { href } from '../lib/router.ts';
import { fmtDateTime, fmtDuration } from '../lib/format.ts';
import { Chip, Empty, ErrorBox, Loading, Seg, toast } from './ui.tsx';
import { fmtUsd } from './insights.tsx';
import type { NotebookEntry, NotebookRunInfo, NotebookView } from '../../shared/types.ts';
import '../styles-tutor.css';

type Sort = 'hot' | 'count' | 'new';

// an update in flight survives leaving the tab (the server finishes and writes the files)
let updating: { started: number; promise: Promise<{ run: NotebookRunInfo; view: NotebookView }> } | undefined;

/** "SQS ⟷ SNS" → the pair page (#/pair?a=&b=). */
export function contrastPair(contrast: string | undefined): [string, string] | undefined {
  const parts = (contrast ?? '').split('⟷').map((s) => s.trim()).filter(Boolean);
  return parts.length === 2 ? [parts[0], parts[1]] : undefined;
}

function refLink(ref: string): string {
  const [file, anchor] = ref.split('#');
  return href(`/notes?f=${encodeURIComponent(file)}${anchor ? `&a=${encodeURIComponent(anchor)}` : ''}`);
}

function runLine(r: NotebookRunInfo): string {
  const when = r.at ? `${fmtDateTime(r.at)} · ` : '';
  if (r.status === 'error') return `${when}⚠️ ${r.error ?? 'lỗi'}`;
  if (r.status === 'skipped') return `${when}${r.summary ?? 'Không có gì mới'}`;
  const counts = `${r.answers ?? 0} câu → ${r.added?.length ?? 0} mục mới, ${r.updated?.length ?? 0} mục cập nhật${r.more ? ` · còn ${r.more} câu cho lần sau` : ''}`;
  return `${when}${counts}${r.costUsd ? ` · ${fmtUsd(r.costUsd)}` : ''}`;
}

export function NotebookPanel({ focus }: { focus?: string }) {
  const { domain } = useData();
  const { data, error, loading, reload } = useFetch<NotebookView>('/api/notebook');
  const [q, setQ] = useState('');
  const [dom, setDom] = useState<string>('');
  const [sort, setSort] = useState<Sort>('hot');
  const [picked, setPicked] = useState<string[]>([]);
  const [into, setInto] = useState('');
  const [busy, setBusy] = useState<number | undefined>(updating?.started);
  const [now, setNow] = useState(() => Date.now());
  const [err, setErr] = useState<string>();
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (updating) watch(updating.promise);
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [busy]);
  useEffect(() => {
    if (focus && data) setTimeout(() => document.getElementById(`nb-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  }, [focus, data]);

  const watch = (p: Promise<{ run: NotebookRunInfo; view: NotebookView }>) =>
    p.then(
      ({ run }) => {
        toast(run.status === 'success' ? `📒 Sổ lỗi: ${runLine(run)}` : run.summary ?? 'Không có gì mới');
        if (alive.current) {
          setBusy(undefined);
          reload();
        }
      },
      (e: Error) => {
        if (alive.current) {
          setBusy(undefined);
          setErr(e.message);
        } else toast(`📒 Cập nhật sổ lỗi thất bại: ${e.message}`);
      },
    );

  const update = () => {
    if (updating) return;
    const promise = api.post<{ run: NotebookRunInfo; view: NotebookView }>('/api/notebook/update').finally(() => (updating = undefined));
    updating = { started: Date.now(), promise };
    setErr(undefined);
    setBusy(updating.started);
    setNow(Date.now());
    void watch(promise);
  };

  const remove = async (e: NotebookEntry) => {
    if (!window.confirm(`Xoá mục “${e.title || e.key}” khỏi sổ lỗi?`)) return;
    try {
      await api.post('/api/notebook/delete', { key: e.key });
      setPicked((p) => p.filter((k) => k !== e.key));
      reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  };

  const merge = async () => {
    const target = picked.includes(into) ? into : picked[0];
    try {
      await api.post('/api/notebook/merge', { keys: picked, into: target });
      toast(`🔗 Đã gộp ${picked.length} mục`);
      setPicked([]);
      reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  };

  const entries = data?.entries ?? [];
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.domain, (m.get(e.domain) ?? 0) + 1);
    return m;
  }, [entries]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = entries.filter((e) => (!dom || e.domain === dom) && (!needle || [e.title, e.misconception, e.rule, e.contrast, ...e.cues, ...e.qids].join(' ').toLowerCase().includes(needle)));
    const by: Record<Sort, (a: NotebookEntry, b: NotebookEntry) => number> = {
      hot: (a, b) => Number(b.confident) - Number(a.confident) || b.count - a.count || b.updated.localeCompare(a.updated),
      count: (a, b) => b.count - a.count || b.updated.localeCompare(a.updated),
      new: (a, b) => b.updated.localeCompare(a.updated) || b.count - a.count,
    };
    return [...list].sort(by[sort]);
  }, [entries, q, dom, sort]);

  if (loading && !data) return <Loading />;
  const hot = entries.filter((e) => e.confident).length;

  return (
    <div className="stack">
      <div className="card stack sm">
        <div className="row between">
          <div className="small">
            <b>{entries.length}</b> mục{hot ? <> · 🔥 {hot} sai dù chắc chắn</> : null}
            {data?.through && <span className="muted"> · đã gom tới bài làm lúc {fmtDateTime(data.through)}</span>}
          </div>
          <div className="row">
            <a className="btn ghost sm" href={href('/listen?mode=briefing')} title="Nghe đọc các quy tắc trong sổ (không dùng AI)">
              🎧 Nghe bản tin
            </a>
            <button
              className="btn primary sm"
              onClick={update}
              disabled={!!busy || !data?.enabled || !data?.pending || data.running}
              title={data?.enabled ? 'Một lượt AI gom các câu sai / chưa chắc mới thành từng hiểu nhầm' : data?.reason}
            >
              {busy ? (
                <>
                  <span className="spinner" /> Đang cập nhật… {fmtDuration((now - busy) / 1000)}
                </>
              ) : (
                <>📒 Cập nhật sổ{data?.pending ? ` (${data.pending} câu mới)` : ''}</>
              )}
            </button>
          </div>
        </div>
        <div className="tiny muted ins-wrap">
          AI gom câu bạn làm sai / chưa chắc thành từng hiểu nhầm: điều bạn đã nghĩ, quy tắc đúng, dấu hiệu trong đề, cặp dễ nhầm và câu bằng chứng. 🧑‍🏫 Gia sư cũng ghi quy
          tắc chốt vào đây. Sổ là Markdown trong <code>trainer/coach/notebook/</code> — sửa chữ thoải mái, đồng bộ cùng coach/.
          {data && !data.enabled && data.reason ? <> Cập nhật bằng AI chưa chạy được ở đây: {data.reason}</> : null}
        </div>
        {data?.lastRun && <div className="tiny muted ins-wrap">Lần cập nhật gần nhất: {runLine(data.lastRun)}</div>}
      </div>
      <ErrorBox error={err ?? error} />
      {entries.length > 0 && (
        <div className="nb-toolbar">
          <input type="search" placeholder="Lọc theo chữ, dịch vụ, mã câu…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Lọc sổ lỗi" />
          <Seg
            value={sort}
            onChange={setSort}
            items={[
              { id: 'hot', label: '🔥 trước' },
              { id: 'count', label: 'Lặp nhiều' },
              { id: 'new', label: 'Mới' },
            ]}
          />
        </div>
      )}
      {entries.length > 0 && (
        <div className="row" style={{ gap: 6 }}>
          <Chip on={!dom} onClick={() => setDom('')} count={entries.length}>
            Tất cả
          </Chip>
          {[...counts.keys()].sort().map((d) => (
            <Chip key={d} on={dom === d} onClick={() => setDom(dom === d ? '' : d)} count={counts.get(d)}>
              {domain(d)?.label_vi ?? d}
            </Chip>
          ))}
        </div>
      )}
      {!entries.length ? (
        <Empty icon="📒" title="Sổ lỗi còn trống">
          Làm bài, rồi bấm “📒 Cập nhật sổ” — hoặc mở 🧑‍🏫 Gia sư ở một câu sai: quy tắc chốt của gia sư cũng được lưu vào đây.
        </Empty>
      ) : (
        <div className="nb-list">
          {shown.map((e) => {
            const pair = contrastPair(e.contrast);
            const on = picked.includes(e.key);
            return (
              <article key={e.key} id={`nb-${e.key}`} className={`card nb-entry ${on ? 'selected' : ''}`}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <h3>
                    {e.confident && <span title="Sai dù chắc chắn — ưu tiên ôn">🔥 </span>}
                    {e.title || e.key}
                  </h3>
                  <div className="nb-meta">
                    <span className="badge">{domain(e.domain)?.label_vi ?? e.domain}</span>
                    <span className="badge accent" title="Số lần hiểu nhầm này xuất hiện">
                      ×{e.count}
                    </span>
                    {e.source === 'tutor' && <span className="badge">🧑‍🏫</span>}
                  </div>
                </div>
                <div className="nb-line">
                  ❌ <b>Bạn nghĩ:</b> {e.misconception}
                </div>
                <div className="nb-line">
                  ✅ <b>Thực ra:</b> {e.rule}
                </div>
                {e.cues.length > 0 && (
                  <div className="nb-meta small">
                    🔎 Dấu hiệu trong đề:
                    {e.cues.map((c) => (
                      <span key={c} className="badge">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                {e.contrast && (
                  <div className="nb-line small">
                    🔀 <b>Dễ nhầm:</b> {e.contrast}
                    {pair && (
                      <>
                        {' '}
                        · <a href={href(`/pair?a=${encodeURIComponent(pair[0])}&b=${encodeURIComponent(pair[1])}`)}>so sánh</a>
                      </>
                    )}
                  </div>
                )}
                {e.refs.length > 0 && (
                  <div className="nb-meta small">
                    📚 Đọc lại:
                    {e.refs.map((r) => (
                      <a key={r} href={refLink(r)}>
                        {r}
                      </a>
                    ))}
                  </div>
                )}
                <div className="row between">
                  <div className="nb-meta small">
                    🧾
                    {e.qids.length ? (
                      e.qids.map((id) => (
                        <a key={id} href={href(`/bank?q=${encodeURIComponent(id)}`)} title="Mở câu trong Ngân hàng">
                          <code>{id}</code>
                        </a>
                      ))
                    ) : (
                      <span className="muted">—</span>
                    )}
                    {e.updated && <span className="tiny muted">· {e.updated}</span>}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <label className="small row" style={{ gap: 4 }} title="Chọn để gộp với mục khác">
                      <input type="checkbox" checked={on} onChange={() => setPicked((p) => (on ? p.filter((k) => k !== e.key) : [...p, e.key]))} /> Gộp
                    </label>
                    <button className="btn ghost sm danger" onClick={() => void remove(e)} aria-label={`Xoá ${e.title || e.key}`}>
                      🗑️ Xoá
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {!shown.length && <div className="small muted">Không có mục nào khớp bộ lọc.</div>}
        </div>
      )}
      {picked.length > 0 && (
        <div className="nb-merge-bar small">
          {picked.length < 2 ? (
            <span>Chọn thêm ít nhất 1 mục để gộp.</span>
          ) : (
            <>
              <span>Gộp {picked.length} mục vào:</span>
              <select value={picked.includes(into) ? into : picked[0]} onChange={(e) => setInto(e.target.value)} aria-label="Mục giữ lại">
                {picked.map((k) => (
                  <option key={k} value={k}>
                    {entries.find((e) => e.key === k)?.title || k}
                  </option>
                ))}
              </select>
              <button className="btn primary sm" onClick={() => void merge()}>
                🔗 Gộp
              </button>
            </>
          )}
          <button className="btn ghost sm" onClick={() => setPicked([])}>
            Bỏ chọn
          </button>
        </div>
      )}
    </div>
  );
}
