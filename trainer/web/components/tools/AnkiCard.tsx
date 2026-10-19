// [X] 🗂️ Xuất sang Anki: scope + filters → a TSV file for Anki's importer, or a direct push through AnkiConnect.
// Deep links: #/tools?anki=wrong · #/tools?anki=ids&ids=a,b,c · #/tools?anki=filter&domains=secure&topics=database
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api.ts';
import { useData } from '../../lib/store.tsx';
import { Chip, ErrorBox, Spinner, toast, toggle } from '../ui.tsx';
import type { AnkiExportRequest, AnkiPreview, AnkiPushResult, AnkiStatus, Difficulty, DomainId, SelectionFilters } from '../../../shared/types.ts';

type Scope = AnkiExportRequest['scope'];

const SCOPES: { id: Scope; label: string; desc: string }[] = [
  { id: 'all', label: '🗂️ Tất cả', desc: 'Mọi câu đang dùng trong ngân hàng.' },
  { id: 'filter', label: '🔎 Theo bộ lọc', desc: 'Chọn domain, chủ đề, task, độ khó, bộ đề hoặc từ khóa.' },
  { id: 'wrong', label: '❌ Câu sai', desc: 'Câu mà lần làm gần nhất bạn trả lời sai.' },
  { id: 'due', label: '🧠 Đến hạn ôn', desc: 'Câu đến hạn ôn theo FSRS (không giới hạn số câu mỗi ngày).' },
  { id: 'flagged', label: '🚩 Cờ / chưa chắc', desc: 'Câu cắm cờ hoặc đánh dấu “chưa chắc” ở lần làm gần nhất.' },
  { id: 'ids', label: '📌 Danh sách id', desc: 'Dán id câu hỏi, cách nhau bởi dấu phẩy, khoảng trắng hoặc xuống dòng.' },
];

function fromQuery(q: URLSearchParams) {
  const list = (k: string) => {
    const v = q.get(k)?.split(',').map((s) => s.trim()).filter(Boolean);
    return v?.length ? v : undefined;
  };
  const scope = q.get('anki') as Scope | null;
  return {
    scope: SCOPES.some((s) => s.id === scope) ? scope! : undefined,
    ids: list('ids')?.join('\n'),
    deck: q.get('deck') ?? undefined,
    filters: { domains: list('domains') as DomainId[] | undefined, topics: list('topics'), tasks: list('tasks'), packs: list('packs') } as SelectionFilters,
  };
}

/** "Basic" — or the stock basic type under another name in a localized Anki. */
function defaultModel(models?: string[]): string {
  if (!models?.length || models.includes('Basic')) return 'Basic';
  return models.find((m) => /basic|cơ bản|einfach|basique|básico/i.test(m) && !/revers|đảo|type|gõ|cloze|optional/i.test(m)) ?? 'Basic';
}

function activeFilterCount(f: SelectionFilters): number {
  return (['domains', 'topics', 'tasks', 'difficulties', 'packs'] as const).reduce((n, k) => n + (f[k]?.length ?? 0), 0) + (f.search?.trim() ? 1 : 0);
}

function FilterPanel({ filters, set }: { filters: SelectionFilters; set: (patch: Partial<SelectionFilters>) => void }) {
  const { meta, bank } = useData();
  const active = useMemo(() => (bank?.questions ?? []).filter((q) => q.status === 'active'), [bank]);
  if (!meta || !bank) return null;
  const count = (pred: (q: (typeof active)[number]) => boolean) => active.filter(pred).length;
  return (
    <div className="stack sm tl-filters">
      <div className="stack sm">
        <b className="small">Domain</b>
        <div className="row tl-chips">
          {meta.domains.map((d) => (
            <Chip key={d.id} on={filters.domains?.includes(d.id)} onClick={() => set({ domains: toggle(filters.domains, d.id) })} count={count((q) => q.domain === d.id)}>
              {d.code} · {d.label_vi}
            </Chip>
          ))}
        </div>
      </div>
      <div className="stack sm">
        <b className="small">Chủ đề</b>
        <div className="row tl-chips">
          {meta.topics.map((t) => {
            const n = count((q) => q.topic === t.id);
            if (!n && !filters.topics?.includes(t.id)) return null;
            return (
              <Chip key={t.id} on={filters.topics?.includes(t.id)} onClick={() => set({ topics: toggle(filters.topics, t.id) })} count={n}>
                {t.icon} {t.label}
              </Chip>
            );
          })}
        </div>
      </div>
      {(meta.tasks?.length ?? 0) > 0 && (
        <div className="stack sm">
          <b className="small">Task (exam guide)</b>
          <div className="row tl-chips">
            {meta.tasks.map((t) => (
              <Chip key={t.id} on={filters.tasks?.includes(t.id)} onClick={() => set({ tasks: toggle(filters.tasks, t.id) })} count={count((q) => q.task === t.id)}>
                <span title={`${t.label} — ${t.label_vi}`}>{t.id}</span>
              </Chip>
            ))}
          </div>
        </div>
      )}
      <div className="stack sm">
        <b className="small">Độ khó</b>
        <div className="row tl-chips">
          {meta.difficulties.map((d) => (
            <Chip key={d.id} on={filters.difficulties?.includes(d.id)} onClick={() => set({ difficulties: toggle(filters.difficulties, d.id as Difficulty) })} count={count((q) => q.difficulty === d.id)}>
              {d.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid c2 tl-opts">
        <label className="field">
          Bộ đề
          <select value={filters.packs?.[0] ?? ''} onChange={(e) => set({ packs: e.target.value ? [e.target.value] : [] })}>
            <option value="">Tất cả bộ đề</option>
            {bank.packs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.activeCount})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Từ khóa
          <input type="search" value={filters.search ?? ''} onChange={(e) => set({ search: e.target.value })} placeholder="vd: Multi-AZ, PrivateLink…" />
        </label>
      </div>
      {activeFilterCount(filters) > 0 && (
        <div>
          <button className="btn ghost sm" onClick={() => set({ domains: [], topics: [], tasks: [], difficulties: [], packs: [], search: '' })}>
            ✕ Bỏ lọc
          </button>
        </div>
      )}
    </div>
  );
}

/** POST download: the response is a file, so it goes through fetch + a temporary object URL. */
async function downloadFile(req: AnkiExportRequest): Promise<string> {
  const r = await fetch('/api/export/anki', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Trainer': '1' }, body: JSON.stringify(req) });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      msg = ((await r.json()) as { error?: string }).error ?? msg;
    } catch {
      // not JSON
    }
    throw new Error(msg);
  }
  const blob = await r.blob();
  const cd = r.headers.get('Content-Disposition') ?? '';
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1];
  const name = utf8 ? decodeURIComponent(utf8) : (/filename="([^"]+)"/i.exec(cd)?.[1] ?? 'anki-saa-c03.txt');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
  return name;
}

export function AnkiCard({ query }: { query: URLSearchParams }) {
  const { version } = useData();
  const [init] = useState(() => fromQuery(query));
  const [scope, setScope] = useState<Scope>(init.scope ?? 'all');
  const [filters, setFilters] = useState<SelectionFilters>(init.filters);
  const [idsText, setIdsText] = useState(init.ids ?? '');
  const [everWrong, setEverWrong] = useState(false);
  const [deck, setDeck] = useState<string | undefined>(init.deck);
  const [model, setModel] = useState<string>();
  const [explain, setExplain] = useState(true);
  const [status, setStatus] = useState<AnkiStatus>();
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<AnkiPreview>();
  const [previewError, setPreviewError] = useState<string>();
  const [busy, setBusy] = useState<'download' | 'push'>();
  const [result, setResult] = useState<AnkiPushResult>();
  const [error, setError] = useState<string>();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (init.scope) ref.current?.scrollIntoView({ block: 'start' });
  }, [init.scope]);

  // A new #/tools?anki=… link while the page is open (e.g. from Stats or the bank) re-applies it.
  const queryKey = query.toString();
  const lastQuery = useRef(queryKey);
  useEffect(() => {
    if (lastQuery.current === queryKey) return;
    lastQuery.current = queryKey;
    const next = fromQuery(query);
    if (!next.scope) return;
    setScope(next.scope);
    setFilters(next.filters);
    if (next.ids) setIdsText(next.ids);
    if (next.deck) setDeck(next.deck);
    ref.current?.scrollIntoView({ block: 'start' });
  }, [queryKey, query]);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await api.get<AnkiStatus>('/api/export/anki/status'));
    } catch {
      setStatus(undefined);
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    void check();
  }, [check]);

  const ids = useMemo(() => [...new Set(idsText.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))], [idsText]);
  const deckName = deck?.trim() || status?.deck || 'AWS SAA-C03';
  const modelName = model ?? defaultModel(status?.models);
  const narrowable = scope === 'wrong' || scope === 'due' || scope === 'flagged';
  const req = useMemo<AnkiExportRequest>(
    () => ({
      scope,
      ...(scope === 'filter' || narrowable ? { filters } : {}),
      ...(scope === 'ids' ? { ids } : {}),
      ...(scope === 'wrong' && everWrong ? { everWrong: true } : {}),
      deck: deckName,
      model: modelName,
      includeExplanation: explain,
    }),
    [scope, narrowable, filters, ids, everWrong, deckName, modelName, explain],
  );
  const reqKey = JSON.stringify(req);

  // A push result belongs to the request it was made for.
  useEffect(() => setResult(undefined), [reqKey]);

  // How many notes + one rendered card (debounced while typing / clicking filters; again when the data changes).
  useEffect(() => {
    if (scope === 'ids' && !ids.length) {
      setPreview({ count: 0, missing: [], deck: deckName });
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      api
        .post<AnkiPreview>('/api/export/anki?preview=1', req)
        .then((p) => {
          if (!alive) return;
          setPreview(p);
          setPreviewError(undefined);
        })
        .catch((e: Error) => alive && setPreviewError(e.message));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey, version]);

  const download = async () => {
    setBusy('download');
    setError(undefined);
    try {
      const name = await downloadFile(req);
      toast(`Đã tải ${name} — mở Anki → File → Import`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };
  const push = async () => {
    setBusy('push');
    setError(undefined);
    setResult(undefined);
    try {
      const r = await api.post<AnkiPushResult>('/api/export/anki?push=1', req);
      setResult(r);
      if (r.ok) toast(`Anki: thêm ${r.added} · cập nhật ${r.updated}`);
      void check();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  const set = (patch: Partial<SelectionFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const scopeInfo = SCOPES.find((s) => s.id === scope)!;
  const nFilters = activeFilterCount(filters);
  const count = preview?.count;

  return (
    <section className="card tl-card stack" id="anki" ref={ref}>
      <div className="card-head">
        <h2>🗂️ Xuất sang Anki</h2>
        {status && <span className={`badge ${status.available ? 'good' : ''}`}>{status.available ? '● AnkiConnect sẵn sàng' : '○ Anki chưa kết nối'}</span>}
      </div>
      <p className="tl-lead small dim">
        Mỗi câu thành một thẻ Anki: <b>mặt trước</b> = đề + các lựa chọn, <b>mặt sau</b> = đáp án đúng (+ giải thích), tag theo domain / chủ đề / task / service. Xuất lại sau khi câu
        được sửa (ENRICH, sửa đáp án) → thẻ cũ được <b>cập nhật</b>, giữ nguyên lịch ôn trong Anki.
      </p>
      <div className="tl-anki">
        <div className="stack tl-anki-form">
          <div className="stack sm">
            <b className="small">Phạm vi</b>
            <div className="row tl-chips" role="group" aria-label="Phạm vi xuất">
              {SCOPES.map((s) => (
                <Chip key={s.id} on={scope === s.id} onClick={() => setScope(s.id)}>
                  {s.label}
                </Chip>
              ))}
            </div>
            <div className="tiny muted">{scopeInfo.desc}</div>
          </div>
          {scope === 'wrong' && (
            <label className="check-line small">
              <input type="checkbox" checked={everWrong} onChange={(e) => setEverWrong(e.target.checked)} />
              <span>Gồm cả câu từng sai (lần gần nhất đã đúng)</span>
            </label>
          )}
          {scope === 'ids' && (
            <label className="field">
              Id câu hỏi
              <textarea rows={4} value={idsText} onChange={(e) => setIdsText(e.target.value)} placeholder="01-v2-28, 03-v1-05…" className="mono small" spellCheck={false} />
            </label>
          )}
          {scope === 'filter' && <FilterPanel filters={filters} set={set} />}
          {narrowable && (
            <details className="tl-more" open={nFilters > 0}>
              <summary>
                Lọc thêm (tùy chọn){nFilters > 0 && <span className="badge accent">{nFilters}</span>}
              </summary>
              <FilterPanel filters={filters} set={set} />
            </details>
          )}
          <div className="grid c2 tl-opts">
            <label className="field">
              Deck
              <input type="text" value={deck ?? status?.deck ?? ''} onChange={(e) => setDeck(e.target.value)} placeholder="AWS SAA-C03" list="tl-anki-decks" />
              {status?.decks?.length ? (
                <datalist id="tl-anki-decks">
                  {status.decks.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              ) : null}
            </label>
            <label className="field">
              Loại ghi chú (note type)
              {status?.models?.length ? (
                <select value={modelName} onChange={(e) => setModel(e.target.value)}>
                  {!status.models.includes(modelName) && <option value={modelName}>{modelName}</option>}
                  {status.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" value={modelName} onChange={(e) => setModel(e.target.value)} />
              )}
            </label>
          </div>
          <label className="check-line small">
            <input type="checkbox" checked={explain} onChange={(e) => setExplain(e.target.checked)} />
            <span>Kèm giải thích ở mặt sau</span>
          </label>
        </div>

        <aside className="stack tl-anki-side">
          <div className="tl-count">
            <span className="tl-count-n num">{count ?? '…'}</span> <span className="dim">thẻ</span>
            <div className="tiny muted">
              vào deck <b className="tl-break">{deckName}</b> · loại ghi chú <b>{modelName}</b>
            </div>
          </div>
          {previewError && <div className="alert bad small">⚠️ {previewError}</div>}
          {preview?.missing.length ? (
            <div className="alert warn small">
              Không tìm thấy {preview.missing.length} id: <span className="mono tl-break">{preview.missing.slice(0, 8).join(', ')}</span>
              {preview.missing.length > 8 ? '…' : ''}
            </div>
          ) : null}
          <button className="btn primary" disabled={!count || !!busy} onClick={() => void download()}>
            {busy === 'download' ? <Spinner /> : '⬇️'} Tải file cho Anki (.txt)
          </button>
          <button className="btn" disabled={!count || !!busy} onClick={() => void push()} title="Cần Anki đang mở + add-on AnkiConnect">
            {busy === 'push' ? <Spinner /> : '📤'} Đẩy thẳng vào Anki
          </button>
          <div className="tiny muted tl-status">
            {checking ? (
              <>
                <Spinner /> Đang kiểm tra AnkiConnect…
              </>
            ) : status?.available ? (
              <>✅ AnkiConnect đang chạy (API v{status.version}) · {status.decks?.length ?? 0} deck</>
            ) : (
              <>⚪ {status?.error ?? 'Chưa kết nối được AnkiConnect.'}</>
            )}{' '}
            <button className="btn ghost sm" onClick={() => void check()} disabled={checking}>
              Kiểm tra lại
            </button>
          </div>
          {!checking && status && !status.available && status.hint && <div className="tiny dim">{status.hint}</div>}
          <ErrorBox error={error} />
          {result && (
            <div className={`alert small ${result.ok ? 'good' : result.added + result.updated > 0 ? 'warn' : 'bad'}`} role="status">
              <div>
                {result.ok ? '✅' : '⚠️'} Deck <b>{result.deck}</b>: thêm <b>{result.added}</b> · cập nhật <b>{result.updated}</b>
                {result.duplicates ? ` · bỏ qua ${result.duplicates} thẻ trùng mặt trước` : ''}
                {result.failed ? ` · lỗi ${result.failed}` : ''}
              </div>
              {result.errors.length > 0 && (
                <ul className="tl-errors">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
              {result.hint && <div className="tl-hint">{result.hint}</div>}
            </div>
          )}
        </aside>
      </div>

      {preview?.sample && (
        <details className="tl-more">
          <summary>
            👁 Xem trước thẻ đầu tiên <span className="mono muted small">{preview.sample.id}</span>
          </summary>
          <div className="tl-cards">
            <div className="tl-anki-card">
              <div className="tiny muted">Mặt trước</div>
              <div dangerouslySetInnerHTML={{ __html: preview.sample.front }} />
            </div>
            <div className="tl-anki-card">
              <div className="tiny muted">Mặt sau</div>
              <div dangerouslySetInnerHTML={{ __html: preview.sample.back }} />
            </div>
          </div>
          <div className="tiny muted tl-break">Tags: {preview.sample.tags.join(' ')}</div>
        </details>
      )}

      <details className="tl-tips">
        <summary>📥 Cách nhập vào Anki</summary>
        <ol>
          <li>
            <b>Tải file</b> rồi mở Anki trên máy tính (bản ≥ 2.1.55) → <b>File → Import…</b> → chọn file <code>.txt</code> vừa tải.
          </li>
          <li>
            Anki tự đọc phần đầu file: loại ghi chú, deck, cột GUID và cột tag. Ở mục <b>Existing notes / Ghi chú đã có</b> chọn <b>Update</b> → <b>Import</b>.
          </li>
          <li>Xuất lại sau này (vd sau khi ENRICH sửa giải thích): import file mới → thẻ cũ được cập nhật theo GUID, không bị nhân đôi, lịch ôn giữ nguyên.</li>
          <li>
            <b>Đẩy thẳng</b> không cần file: cài add-on <b>AnkiConnect</b> (Tools → Add-ons → Get Add-ons… → mã <code>2055492159</code>), khởi động lại Anki và để Anki mở khi bấm
            nút. Thẻ đã đẩy trước đó được nhận ra nhờ tag <code>SAA-C03::id::…</code> và được cập nhật.
          </li>
          <li>Điện thoại (AnkiMobile / AnkiDroid): nhập trên máy tính rồi đồng bộ qua AnkiWeb.</li>
          <li>
            Lọc trong Anki (Browse) theo tag <code>SAA-C03::domain::…</code>, <code>::topic::…</code>, <code>::task::…</code>, <code>::service::…</code>.
          </li>
        </ol>
      </details>
    </section>
  );
}
