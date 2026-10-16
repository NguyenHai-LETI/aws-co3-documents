import { useEffect, useState } from 'react';
import { useRoute, href } from './lib/router.ts';
import { useData } from './lib/store.tsx';
import { loadActive } from './lib/session.ts';
import { ToastHost, Loading, ErrorBox } from './components/ui.tsx';
import { SyncButton } from './components/SyncButton.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { NewTest } from './pages/NewTest.tsx';
import { Runner } from './pages/Runner.tsx';
import { ResultPage } from './pages/Result.tsx';
import { History } from './pages/History.tsx';
import { Stats } from './pages/Stats.tsx';
import { BankPage } from './pages/Bank.tsx';
import { Coach } from './pages/Coach.tsx';
import { Notes } from './pages/Notes.tsx';

type Theme = 'system' | 'light' | 'dark';

function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem('trainer.theme');
      return t === 'light' || t === 'dark' ? t : 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('trainer.theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);
  return [theme, setTheme];
}

const NAV = [
  { path: '/', icon: '🏠', label: 'Tổng quan' },
  { path: '/new', icon: '✍️', label: 'Tạo bài test' },
  { path: '/history', icon: '🕘', label: 'Lịch sử' },
  { path: '/stats', icon: '📊', label: 'Thống kê' },
  { path: '/coach', icon: '🤖', label: 'AI Coach' },
  { path: '/bank', icon: '🗂️', label: 'Ngân hàng câu hỏi' },
  { path: '/notes', icon: '📖', label: 'Tài liệu' },
];

export function App() {
  const route = useRoute();
  const { meta, state, error } = useData();
  const [theme, setTheme] = useTheme();
  const top = `/${route.parts[0] ?? ''}`;
  const focus = top === '/run';
  const active = loadActive();

  let page: React.ReactNode;
  if (!meta && !error) page = <Loading text="Đang nạp ngân hàng câu hỏi…" />;
  else if (top === '/new') page = <NewTest query={route.query} />;
  else if (top === '/run') page = <Runner />;
  else if (top === '/result') page = <ResultPage id={route.parts[1] ?? ''} />;
  else if (top === '/history') page = <History />;
  else if (top === '/stats') page = <Stats />;
  else if (top === '/bank') page = <BankPage query={route.query} />;
  else if (top === '/coach') page = <Coach />;
  else if (top === '/notes') page = <Notes query={route.query} />;
  else page = <Dashboard />;

  const counts: Record<string, number | undefined> = {
    '/bank': meta?.problems.errors || undefined,
    '/coach': meta?.openIssues || undefined,
  };

  return (
    <div className={`app ${focus ? 'focus' : ''}`}>
      <nav className="sidebar" aria-label="Điều hướng chính">
        <div className="brand">
          <div className="logo">☁️</div>
          <div>
            SAA-C03 Trainer
            <small>{meta ? `${meta.packs.reduce((s, p) => s + p.activeCount, 0)} câu · ${meta.attempts} bài` : '…'}</small>
          </div>
        </div>
        {active && !focus && (
          <a className="nav-link nav-resume" href={href('/run')}>
            <span className="ico">⏯️</span> Tiếp tục bài đang làm
          </a>
        )}
        {NAV.map((n) => (
          <a key={n.path} className={`nav-link ${top === n.path ? 'active' : ''}`} href={href(n.path)}>
            <span className="ico">{n.icon}</span>
            {n.label}
            {counts[n.path] ? <span className="count">{counts[n.path]}</span> : null}
            {n.path === '/new' && state?.counts.srs ? (
              <span className="count" title={`Câu đến hạn ôn hôm nay${state.counts.backlog ? ` (+${state.counts.backlog} tồn đọng)` : ''}`}>
                {state.counts.srs}
              </span>
            ) : null}
          </a>
        ))}
        <div className="sidebar-foot ins-foot">
          <SyncButton />
          <div className="row nowrap ins-foot-row">
            <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} aria-label="Giao diện sáng/tối" title="Giao diện: theo hệ thống, sáng hoặc tối" style={{ padding: '3px 6px', fontSize: 12 }}>
              <option value="system">🖥 Hệ thống</option>
              <option value="light">☀️ Sáng</option>
              <option value="dark">🌙 Tối</option>
            </select>
            <span className="spacer" />
            <span title={`Chỉ chạy ở máy bạn (127.0.0.1)${meta?.host ? ` · máy: ${meta.host}` : ''}`}>🔒 local</span>
          </div>
        </div>
      </nav>
      {focus ? (
        page
      ) : (
        <main className="main">
          <ErrorBox error={error && `Không kết nối được server: ${error}`} />
          {page}
        </main>
      )}
      <ToastHost />
    </div>
  );
}
