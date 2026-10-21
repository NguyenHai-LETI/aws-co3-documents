// [P] Global full-text search (questions + notes) shown above every page. `/` focuses it; ↑ ↓ choose, Enter opens,
// Esc closes. Questions open in the Bank (#/bank?q=<id>), note sections in Tài liệu (#/notes?f=<file>&a=<heading>).
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import { navigate } from '../lib/router.ts';
import type { SearchHit, SearchResponse } from '../../shared/types.ts';

type Scope = 'all' | 'questions' | 'notes';
const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'questions', label: 'Câu hỏi' },
  { id: 'notes', label: 'Tài liệu' },
];
const LIMIT = 8;
const DEBOUNCE_MS = 140;

/** «match» markers of the server snippet → <mark>. */
function Highlight({ text }: { text: string }) {
  const parts = text.split(/[«»]/);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

function hitHref(h: SearchHit): string {
  if (h.kind === 'question') return `/bank?q=${encodeURIComponent(h.id)}`;
  return `/notes?f=${encodeURIComponent(h.id)}${h.anchor ? `&a=${encodeURIComponent(h.anchor)}` : ''}`;
}

const STATUS_LABEL: Record<string, string> = { draft: 'nháp', retired: 'đã loại' };

/** Typing in a field (or a contenteditable) — the "/" shortcut must not steal the key there. */
function typingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function SearchBox() {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [res, setRes] = useState<SearchResponse>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const listId = useId();

  // "/" anywhere (outside form fields) focuses the box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return;
      e.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // close when clicking / tapping outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // debounced query; only the latest response is shown
  useEffect(() => {
    const text = q.trim();
    if (!text) {
      setRes(undefined);
      setError(undefined);
      setLoading(false);
      return;
    }
    const my = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .get<SearchResponse>(`/api/search?q=${encodeURIComponent(text)}&scope=${scope}&limit=${LIMIT}`)
        .then((r) => {
          if (my !== seq.current) return;
          setRes(r);
          setError(undefined);
          setActive(0);
        })
        .catch((e: Error) => my === seq.current && setError(e.message))
        .finally(() => my === seq.current && setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q, scope]);

  const hits = res?.hits ?? [];
  const groups = useMemo(
    () =>
      [
        { kind: 'question' as const, title: '❓ Câu hỏi', total: res?.total?.questions, items: hits.filter((h) => h.kind === 'question') },
        { kind: 'note' as const, title: '📖 Tài liệu', total: res?.total?.notes, items: hits.filter((h) => h.kind === 'note') },
      ].filter((g) => g.items.length),
    [hits, res],
  );
  const flat = groups.flatMap((g) => g.items); // keyboard order = display order

  const go = (h: SearchHit | undefined) => {
    if (!h) return;
    setOpen(false);
    input.current?.blur();
    navigate(hitHref(h));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (flat.length) setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (open && q) setOpen(false);
      else {
        setQ('');
        input.current?.blur();
      }
    }
  };

  // keep the active row visible while moving with the keyboard
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, listId]);

  const show = open && !!q.trim();
  let n = -1;
  return (
    <div className="sb" ref={box} role="search">
      <div className={`sb-field ${show ? 'open' : ''}`}>
        <span className="sb-icon" aria-hidden>
          🔎
        </span>
        <input
          ref={input}
          type="search"
          value={q}
          placeholder="Tìm câu hỏi, tài liệu, dịch vụ…"
          aria-label="Tìm kiếm câu hỏi và tài liệu"
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={show && flat.length ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading ? <span className="spinner sb-spin" aria-hidden /> : <kbd className="kbd sb-kbd" title="Nhấn / để tìm">/</kbd>}
      </div>
      {show && (
        <div className="sb-panel">
          <div className="sb-head">
            <div className="seg sb-scope" role="group" aria-label="Phạm vi tìm">
              {SCOPES.map((s) => (
                <button key={s.id} type="button" className={scope === s.id ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => setScope(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
            {res && <span className="tiny muted sb-meta">{res.engine === 'fts5' ? 'FTS5' : 'quét'} · {res.tookMs} ms</span>}
          </div>
          <div className="sb-list" id={listId} role="listbox" aria-label="Kết quả tìm kiếm">
            {error ? (
              <div className="sb-empty small">Không tìm được: {error}</div>
            ) : !res && loading ? (
              <div className="sb-empty small muted">Đang tìm…</div>
            ) : res && !flat.length ? (
              <div className="sb-empty small muted">Không thấy kết quả cho “{q.trim()}”. Thử từ khác, bỏ dấu hoặc tên dịch vụ (vd “dynamodb stream”).</div>
            ) : (
              groups.map((g) => (
                <div key={g.kind} className="sb-group" role="group" aria-label={g.title}>
                  <div className="sb-group-head">
                    <span>{g.title}</span>
                    <span className="tiny muted">{g.total && g.total > g.items.length ? `${g.items.length}/${g.total}` : g.items.length}</span>
                  </div>
                  {g.items.map((h) => {
                    n++;
                    const i = n;
                    return (
                      <a
                        key={`${h.kind}:${h.id}:${h.anchor ?? ''}`}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === active}
                        className={`sb-item ${i === active ? 'active' : ''} ${h.status && h.status !== 'active' ? 'sb-off' : ''}`}
                        href={`#${hitHref(h)}`}
                        onMouseMove={() => setActive(i)}
                        onClick={(e) => {
                          e.preventDefault();
                          go(h);
                        }}
                      >
                        <span className="sb-item-head">
                          {h.kind === 'question' ? <code className="sb-id">{h.id}</code> : <b className="sb-title">{h.title}</b>}
                          {h.status && STATUS_LABEL[h.status] && <span className="badge">{STATUS_LABEL[h.status]}</span>}
                          {h.sub && <span className="sb-sub tiny muted">{h.sub}</span>}
                        </span>
                        <span className="sb-snippet small">
                          <Highlight text={h.snippet} />
                        </span>
                      </a>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="sb-foot tiny muted">
            <span>
              <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> chọn · <kbd className="kbd">Enter</kbd> mở · <kbd className="kbd">Esc</kbd> đóng
            </span>
            <span className="sb-foot-hint">không cần gõ dấu — “do ben” tìm cả “độ bền”</span>
          </div>
        </div>
      )}
    </div>
  );
}
