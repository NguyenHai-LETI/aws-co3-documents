import { useEffect, useMemo, useState } from 'react';
import { useFetch } from '../lib/store.tsx';
import { href, navigate } from '../lib/router.ts';
import { Markdown } from '../lib/markdown.tsx';
import { Empty, ErrorBox, Loading, Tabs, copyText, toast } from '../components/ui.tsx';
import { NotebookPanel } from '../components/NotebookPanel.tsx';

interface NoteInfo {
  file: string;
  title: string;
  size: number;
  group: string;
}

/** #/notes — study notes (📖 Tài liệu) and [v5 τ] the mistake notebook (📒 Sổ lỗi, `?tab=notebook`, `&k=<entry key>`). */
export function Notes({ query }: { query: URLSearchParams }) {
  const tab = query.get('tab') === 'notebook' ? 'notebook' : 'docs';
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{tab === 'notebook' ? '📒 Sổ lỗi' : '📖 Tài liệu'}</h1>
          <p>{tab === 'notebook' ? 'Những hiểu nhầm của riêng bạn, gom từ câu sai / chưa chắc — tài liệu ôn 48 giờ cuối.' : 'Các file lý thuyết trong repo.'}</p>
        </div>
      </div>
      <Tabs
        value={tab}
        onChange={(t) => navigate(t === 'notebook' ? '/notes?tab=notebook' : '/notes')}
        items={[
          { id: 'docs', label: '📖 Tài liệu' },
          { id: 'notebook', label: '📒 Sổ lỗi' },
        ]}
      />
      {tab === 'notebook' ? <NotebookPanel focus={query.get('k') ?? undefined} /> : <Docs query={query} />}
    </div>
  );
}

function Docs({ query }: { query: URLSearchParams }) {
  const file = query.get('f') ?? '';
  const { data: notes } = useFetch<NoteInfo[]>('/api/notes');
  const { data, error, loading } = useFetch<{ path: string; content: string }>(file ? `/api/note?path=${encodeURIComponent(file)}` : null, [file]);
  const [q, setQ] = useState('');
  const list = useMemo(() => (notes ?? []).filter((n) => !q || `${n.file} ${n.title}`.toLowerCase().includes(q.toLowerCase())), [notes, q]);

  const anchor = query.get('a');
  useEffect(() => {
    if (anchor && data) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [data, anchor]);
  const base = file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : '';

  const content = data?.content.replace(/^---\n[\s\S]*?\n---\n/, (fm) => '```yaml\n' + fm.replace(/^---\n|---\n$/g, '') + '```\n');

  return (
    <div className="split-nav">
      <aside className="card stack sm sticky-side" style={{ position: 'sticky', top: 16, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
        <b>📖 Tài liệu</b>
        <input type="search" placeholder="Lọc…" value={q} onChange={(e) => setQ(e.target.value)} />
        {list.map((n) => (
          <a key={n.file} href={href(`/notes?f=${encodeURIComponent(n.file)}`)} className={`nav-link small ${n.file === file ? 'active' : ''}`} style={{ padding: '5px 8px' }} title={n.title}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.file}</span>
          </a>
        ))}
      </aside>
      <div>
        {!file ? (
          <Empty icon="📖" title="Chọn một tài liệu ở cột trái">
            Các file lý thuyết trong repo — câu hỏi trong ngân hàng liên kết tới đây qua mục “Ôn lại”.
          </Empty>
        ) : loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} />
        ) : (
          <div className="card pad-lg">
            <div className="row between" style={{ marginBottom: 12 }}>
              <code>{file}</code>
              <button
                className="btn ghost sm"
                onClick={async () => {
                  if (await copyText(file)) toast('Đã copy đường dẫn');
                }}
              >
                📋 Copy path
              </button>
            </div>
            <Markdown text={content ?? ''} anchors base={base} />
          </div>
        )}
      </div>
    </div>
  );
}
