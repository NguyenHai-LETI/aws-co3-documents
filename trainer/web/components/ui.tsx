import { useEffect, useState, type ReactNode } from 'react';

export function Spinner() {
  return <span className="spinner" aria-label="Đang tải" />;
}

export function Loading({ text = 'Đang tải…' }: { text?: string }) {
  return (
    <div className="empty">
      <Spinner /> <span style={{ marginLeft: 8 }}>{text}</span>
    </div>
  );
}

export function Empty({ icon = '🗂️', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>{title}</div>
      {children && <div className="small" style={{ marginTop: 6 }}>{children}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="alert bad">⚠️ {error}</div>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="drawer-back" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="row between" style={{ marginBottom: 8 }}>
          <span />
          <button className="btn ghost sm" onClick={onClose} aria-label="Đóng">
            ✕ Đóng
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button key={it.id} role="tab" aria-selected={value === it.id} className={value === it.id ? 'on' : ''} onClick={() => onChange(it.id)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Seg<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode; title?: string }[] }) {
  return (
    <div className="seg">
      {items.map((it) => (
        <button key={it.id} type="button" title={it.title} className={value === it.id ? 'on' : ''} onClick={() => onChange(it.id)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ on, onClick, children, count, title }: { on?: boolean; onClick?: () => void; children: ReactNode; count?: number; title?: string }) {
  return (
    <button type="button" className={`chip ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={!!on} title={title}>
      {children}
      {count !== undefined && <span className="n">{count}</span>}
    </button>
  );
}

export function toggle<T>(list: T[] | undefined, v: T): T[] {
  const l = list ?? [];
  return l.includes(v) ? l.filter((x) => x !== v) : [...l, v];
}

let toastSetter: ((t: string | undefined) => void) | undefined;
export function toast(text: string) {
  toastSetter?.(text);
}
export function ToastHost() {
  const [text, setText] = useState<string>();
  useEffect(() => {
    toastSetter = setText;
    return () => {
      toastSetter = undefined;
    };
  }, []);
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setText(undefined), 2600);
    return () => clearTimeout(t);
  }, [text]);
  return text ? <div className="toast" role="status">{text}</div> : null;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
