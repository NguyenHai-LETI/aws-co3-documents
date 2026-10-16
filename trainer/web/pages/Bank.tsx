import { useEffect, useMemo, useState } from 'react';
import { useData, useFetch } from '../lib/store.tsx';
import { href, navigate } from '../lib/router.ts';
import { startTest } from '../lib/start.ts';
import { fmtDate, fmtDateTime, fmtRelative } from '../lib/format.ts';
import { QuestionMeta, QuestionView } from '../components/QuestionView.tsx';
import { IssueDialog } from '../components/IssueDialog.tsx';
import { Drawer, Empty, Tabs } from '../components/ui.tsx';
import { applyFilters, isDueState } from '../../shared/filters.ts';
import type { IssueItem, PackOrigin, Question, QuestionState, SelectionFilters } from '../../shared/types.ts';

type Tab = 'questions' | 'packs' | 'health' | 'issues';
type Progress = '' | 'unseen' | 'wrong' | 'due' | 'mastered' | 'flagged';
const PAGE = 40;
const ORIGIN_LABEL: Record<PackOrigin, string> = { imported: '📚 Đề gốc', ai: '🤖 AI', doc: '📄 Tài liệu', manual: '✍️ Thủ công' };

function boxLabel(s?: QuestionState) {
  if (!s) return <span className="badge">mới</span>;
  if (s.lastOk === false) return <span className="badge bad">sai</span>;
  return <span className={`badge ${s.box >= 4 ? 'good' : 'accent'}`}>box {s.box}</span>;
}

function QuestionDrawer({ q, onClose, onIssue }: { q: Question | undefined; onClose: () => void; onIssue: (id: string) => void }) {
  const { state, bank } = useData();
  const [reveal, setReveal] = useState(false);
  useEffect(() => setReveal(false), [q?.id]);
  if (!q) return null;
  const s = state?.states[q.id];
  const variants = (bank?.questions ?? []).filter((x) => x.variantOf.includes(q.id));
  return (
    <Drawer open onClose={onClose}>
      <div className="stack">
        <QuestionView q={q} picked={[]} reveal={reveal} showMeta />
        {!reveal && (
          <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setReveal(true)}>
            👁 Hiện đáp án & giải thích
          </button>
        )}
        <div className="row">
          <button className="btn primary sm" onClick={() => startTest({ mode: 'ids', ids: [q.id, ...variants.map((v) => v.id)], title: `Luyện ${q.id}${variants.length ? ` + ${variants.length} biến thể` : ''}`, feedback: 'practice' })}>
            ▶ Luyện câu này{variants.length ? ` + ${variants.length} biến thể` : ''}
          </button>
          <button className="btn sm" onClick={() => onIssue(q.id)}>
            🐞 Báo lỗi
          </button>
        </div>
        <div className="card flat stack sm small">
          <b>Lịch sử của bạn</b>
          {s ? (
            <>
              <div>
                Đã làm <b>{s.attempts}</b> lần · đúng {s.correct} · lần cuối {fmtDateTime(s.lastAt)} ({s.lastOk ? '✓ đúng' : '✗ sai'}
                {s.lastPick ? `, chọn ${s.lastPick}` : ''})
              </div>
              <div>
                Box Leitner <b>{s.box}</b>
                {s.dueAt ? ` · ôn lại ${isDueState(s) ? 'ngay (đến hạn)' : fmtRelative(s.dueAt)}` : ''} · TG trung bình {s.avgTime}s (chuẩn {q.time}s)
              </div>
              {Object.keys(s.wrongPicks).length > 0 && (
                <div>
                  Đáp án sai hay chọn:{' '}
                  {Object.entries(s.wrongPicks)
                    .map(([k, n]) => `${k} ×${n}`)
                    .join(', ')}
                </div>
              )}
            </>
          ) : (
            <div className="muted">Chưa làm câu này.</div>
          )}
        </div>
        <div className="card flat stack sm small">
          <b>Metadata</b>
          <QuestionMeta q={q} />
          <div>Services: {q.services.join(', ') || '—'}</div>
          <div>Tags: {q.tags.join(', ') || '—'}</div>
          {q.concept && <div>Concept: {q.concept}</div>}
          {q.variantOf.length > 0 && (
            <div>
              Biến thể của:{' '}
              {q.variantOf.map((v) => (
                <a key={v} href={href(`/bank?q=${encodeURIComponent(v)}`)} style={{ marginRight: 8 }}>
                  <code>{v}</code>
                </a>
              ))}
            </div>
          )}
          {variants.length > 0 && (
            <div>
              Có {variants.length} biến thể:{' '}
              {variants.map((v) => (
                <a key={v.id} href={href(`/bank?q=${encodeURIComponent(v.id)}`)} style={{ marginRight: 8 }}>
                  <code>{v.id}</code>
                </a>
              ))}
            </div>
          )}
          <div>
            Pack: <code>{q.pack}</code> · trạng thái {q.status} · {q.timeEstimated ? `thời gian ước lượng tự động ${q.time}s` : `thời gian ${q.time}s`}
          </div>
          <div className="mono tiny">
            trainer/{q.file}:{q.line}
          </div>
          {q.source && <div className="tiny muted">Nguồn: {q.source}</div>}
          {q.created && <div className="tiny muted">Tạo: {q.created}</div>}
        </div>
      </div>
    </Drawer>
  );
}

export function BankPage({ query }: { query: URLSearchParams }) {
  const { meta, bank, state, byId } = useData();
  const [tab, setTab] = useState<Tab>('questions');
  const [filters, setFilters] = useState<SelectionFilters>({});
  const [status, setStatus] = useState<'active' | 'draft' | 'retired' | 'all'>('active');
  const [progress, setProgress] = useState<Progress>('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [issueFor, setIssueFor] = useState<string>();
  const openId = query.get('q') ?? undefined;
  const { data: issues } = useFetch<IssueItem[]>(tab === 'issues' ? '/api/issues' : null, [tab]);

  const states = state?.states ?? {};
  const list = useMemo(() => {
    let qs = bank?.questions ?? [];
    if (status !== 'all') qs = qs.filter((q) => q.status === status);
    qs = applyFilters(qs, filters);
    if (progress === 'unseen') qs = qs.filter((q) => !states[q.id]);
    if (progress === 'wrong') qs = qs.filter((q) => states[q.id]?.lastOk === false);
    if (progress === 'due') qs = qs.filter((q) => isDueState(states[q.id]));
    if (progress === 'mastered') qs = qs.filter((q) => (states[q.id]?.box ?? 0) >= (meta?.srs.mastered_box ?? 4));
    if (progress === 'flagged') qs = qs.filter((q) => states[q.id]?.lastFlag || states[q.id]?.lastUnsure);
    return qs;
  }, [bank, filters, status, progress, states, meta]);
  useEffect(() => setPage(0), [filters, status, progress]);

  if (!meta || !bank) return null;
  const set = (patch: Partial<SelectionFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const pageItems = list.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.ceil(list.length / PAGE);
  const errors = bank.problems.filter((p) => p.level === 'error');
  const warnings = bank.problems.filter((p) => p.level === 'warning');
  const openIssues = (issues ?? []).filter((i) => i.open).length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>🗂️ Ngân hàng câu hỏi</h1>
          <p>
            {bank.questions.length} câu trong {bank.packs.length} pack · nguồn sự thật là các file Markdown trong <code>trainer/bank/packs/</code> (định dạng: <code>bank/SCHEMA.md</code>).
          </p>
        </div>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'questions', label: `Câu hỏi (${list.length})` },
          { id: 'packs', label: `Bộ đề (${bank.packs.length})` },
          { id: 'health', label: `Kiểm tra định dạng ${errors.length ? `❗${errors.length}` : '✓'}` },
          { id: 'issues', label: `Báo lỗi${meta.openIssues ? ` (${meta.openIssues} mở)` : ''}` },
        ]}
      />

      {tab === 'questions' && (
        <div className="stack">
          <div className="row">
            <input type="search" placeholder="Tìm id, nội dung, service…" value={filters.search ?? ''} onChange={(e) => set({ search: e.target.value })} style={{ minWidth: 240, flex: 1 }} />
            <select value={filters.topics?.[0] ?? ''} onChange={(e) => set({ topics: e.target.value ? [e.target.value] : [] })}>
              <option value="">Mọi chủ đề</option>
              {meta.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
            <select value={filters.domains?.[0] ?? ''} onChange={(e) => set({ domains: e.target.value ? [e.target.value as never] : [] })}>
              <option value="">Mọi domain</option>
              {meta.domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} {d.label_vi}
                </option>
              ))}
            </select>
            <select value={filters.packs?.[0] ?? ''} onChange={(e) => set({ packs: e.target.value ? [e.target.value] : [] })} style={{ maxWidth: 220 }}>
              <option value="">Mọi bộ đề</option>
              {bank.packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <select value={filters.origins?.[0] ?? ''} onChange={(e) => set({ origins: e.target.value ? [e.target.value as PackOrigin] : [] })}>
              <option value="">Mọi nguồn</option>
              {Object.entries(ORIGIN_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select value={progress} onChange={(e) => setProgress(e.target.value as Progress)}>
              <option value="">Mọi tiến độ</option>
              <option value="unseen">Chưa làm</option>
              <option value="wrong">Đang sai</option>
              <option value="due">Đến hạn ôn</option>
              <option value="flagged">Cờ / chưa chắc</option>
              <option value="mastered">Đã thuộc</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="retired">Retired</option>
              <option value="all">Tất cả trạng thái</option>
            </select>
          </div>
          {selected.length > 0 && (
            <div className="alert info row between">
              <span>
                Đã chọn <b>{selected.length}</b> câu
              </span>
              <div className="row">
                <button className="btn sm" onClick={() => setSelected([])}>
                  Bỏ chọn
                </button>
                <button className="btn primary sm" onClick={() => startTest({ mode: 'ids', ids: selected, title: `Bộ chọn tay (${selected.length} câu)` })}>
                  ▶ Tạo test từ {selected.length} câu
                </button>
              </div>
            </div>
          )}
          <div className="card" style={{ padding: 6 }}>
            {!pageItems.length ? (
              <Empty icon="🔎" title="Không có câu nào khớp bộ lọc" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>
                        <input
                          type="checkbox"
                          aria-label="Chọn cả trang"
                          checked={pageItems.every((q) => selected.includes(q.id))}
                          onChange={(e) => setSelected((s) => (e.target.checked ? [...new Set([...s, ...pageItems.map((q) => q.id)])] : s.filter((id) => !pageItems.some((q) => q.id === id))))}
                        />
                      </th>
                      <th>Câu hỏi</th>
                      <th>Chủ đề</th>
                      <th className="num">⏱</th>
                      <th>Tiến độ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((q) => {
                      const s = states[q.id];
                      const t = meta.topics.find((x) => x.id === q.topic);
                      return (
                        <tr key={q.id} className="click" onClick={() => navigate(`/bank?q=${encodeURIComponent(q.id)}`)}>
                          <td onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.includes(q.id)} onChange={() => setSelected((sel) => (sel.includes(q.id) ? sel.filter((x) => x !== q.id) : [...sel, q.id]))} />
                          </td>
                          <td>
                            <div className="tiny muted mono">
                              {q.id} {q.origin !== 'imported' && <span className="badge accent">{ORIGIN_LABEL[q.origin]}</span>}
                            </div>
                            <div className="small" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {q.stem}
                            </div>
                          </td>
                          <td className="small nowrap">
                            {t?.icon} {t?.label ?? q.topic}
                          </td>
                          <td className="num small">{q.time}s</td>
                          <td className="nowrap">
                            {boxLabel(s)} {s && <span className="tiny muted">{s.correct}/{s.attempts}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {pages > 1 && (
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                ← Trước
              </button>
              <span className="small muted">
                Trang {page + 1}/{pages}
              </span>
              <button className="btn sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                Sau →
              </button>
              <button className="btn sm" onClick={() => startTest({ mode: 'ids', ids: list.slice(0, 200).map((q) => q.id), title: 'Bộ lọc ngân hàng', shuffleQuestions: true })}>
                ▶ Test với {Math.min(200, list.length)} câu đang lọc
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'packs' && (
        <div className="card" style={{ padding: 6 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Bộ đề</th>
                  <th>Nguồn</th>
                  <th className="num">Câu</th>
                  <th>Đã làm</th>
                  <th>Tạo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bank.packs.map((p) => {
                  const qs = bank.questions.filter((q) => q.pack === p.id);
                  const seen = qs.filter((q) => states[q.id]).length;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div>{p.title}</div>
                        <div className="tiny muted mono">trainer/{p.file}</div>
                      </td>
                      <td className="small nowrap">{ORIGIN_LABEL[p.origin]}</td>
                      <td className="num">{p.activeCount}</td>
                      <td className="small nowrap">
                        {seen}/{qs.length}
                      </td>
                      <td className="small nowrap">{p.created ? fmtDate(p.created) : '—'}</td>
                      <td className="nowrap">
                        <button className="btn sm" onClick={() => startTest({ mode: 'pack', filters: { packs: [p.id] } })}>
                          ▶ Làm
                        </button>{' '}
                        <a className="btn ghost sm" href={href(`/notes?f=${encodeURIComponent('trainer/' + p.file)}`)}>
                          📄
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'health' && (
        <div className="stack">
          <div className={`alert ${errors.length ? 'bad' : 'good'}`}>
            {errors.length ? `❗ ${errors.length} lỗi — các câu lỗi bị bỏ qua (không xuất hiện trong test).` : '✓ Không có lỗi định dạng.'} {warnings.length} cảnh báo. Kiểm tra bằng lệnh <code>npm run validate -- --warnings</code>.
          </div>
          <div className="card" style={{ padding: 6 }}>
            {!bank.problems.length ? (
              <Empty icon="✅" title="Ngân hàng sạch" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mức</th>
                      <th>Vị trí</th>
                      <th>Vấn đề</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...errors, ...warnings].slice(0, 400).map((p, i) => (
                      <tr key={i}>
                        <td>{p.level === 'error' ? <span className="badge bad">lỗi</span> : <span className="badge warn">cảnh báo</span>}</td>
                        <td className="mono tiny">
                          {p.file}:{p.line}
                          {p.qid && byId.has(p.qid) ? (
                            <>
                              {' '}
                              <a href={href(`/bank?q=${encodeURIComponent(p.qid)}`)}>{p.qid}</a>
                            </>
                          ) : p.qid ? (
                            ` ${p.qid}`
                          ) : null}
                        </td>
                        <td className="small">{p.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'issues' && (
        <div className="stack">
          <div className="small muted">
            Báo lỗi từ màn hình kết quả được ghi vào <code>trainer/bank/issues.md</code>. AI Coach xử lý các mục đang mở ở lần phân tích kế tiếp ({openIssues} mở).
          </div>
          <div className="card" style={{ padding: 6 }}>
            {!issues?.length ? (
              <Empty icon="🐞" title="Chưa có báo lỗi nào" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Trạng thái</th>
                      <th>Ngày</th>
                      <th>Câu</th>
                      <th>Loại</th>
                      <th>Nội dung / xử lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map((i) => (
                      <tr key={i.line}>
                        <td>{i.open ? <span className="badge warn">mở</span> : <span className="badge good">đã xử lý</span>}</td>
                        <td className="small nowrap">{i.date}</td>
                        <td>
                          <a href={href(`/bank?q=${encodeURIComponent(i.qid)}`)} className="mono small">
                            {i.qid}
                          </a>
                        </td>
                        <td className="small">{i.type}</td>
                        <td className="small">
                          {i.note}
                          {i.resolution && <div className="good">→ {i.resolution}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <QuestionDrawer q={openId ? byId.get(openId) : undefined} onClose={() => navigate('/bank', { replace: true })} onIssue={setIssueFor} />
      <IssueDialog qid={issueFor} onClose={() => setIssueFor(undefined)} />
    </div>
  );
}
