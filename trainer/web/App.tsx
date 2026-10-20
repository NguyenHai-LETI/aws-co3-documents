import { useCallback, useEffect, useRef, useState } from 'react';
import { useRoute, href, navigate } from './lib/router.ts';
import { useData, useServerEvent } from './lib/store.tsx';
import { api } from './lib/api.ts';
import { flushOutbox, loadActive, useOutbox } from './lib/session.ts';
import { ToastHost, Loading, ErrorBox, toast } from './components/ui.tsx';
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
import { Tools } from './pages/Tools.tsx';
import { LanBadge } from './components/tools/LanBadge.tsx';
import { SearchBox } from './components/SearchBox.tsx';

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

/** GET /api/update and the SSE `hello` / `update` events (server/lib/version.ts). */
interface UpdateStatus {
  codeVersion: string;
  launcher: boolean; // started by start.command / start.sh / start.bat → POST /api/restart works
  watch: boolean; // npm run dev restarts by itself
  update?: { at: string; files: string[]; lockChanged: boolean };
}

const OUTBOX_RETRY_MS = 30_000;
const UPDATE_POLL_MS = 60_000;
const RESTART_WAIT_MS = 180_000; // npm install after a lock change can take a while

/**
 * Code updates: a sync that brought newer app code → banner (restart via the launcher, or by hand), and the page reloads
 * itself when the server now runs another codeVersion than the one it was loaded with — never in the middle of a test
 * (it waits until the learner leaves the runner).
 */
function useCodeUpdate(meta: { codeVersion?: string } | undefined, inTest: boolean) {
  const loadedWith = useRef<string>(undefined);
  const [status, setStatus] = useState<UpdateStatus>();
  const [reloadDue, setReloadDue] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const consider = useCallback((s: Partial<UpdateStatus> | undefined) => {
    if (!s?.codeVersion) return;
    if (!loadedWith.current) loadedWith.current = s.codeVersion;
    else if (s.codeVersion !== loadedWith.current) setReloadDue(true);
    if (typeof s.launcher === 'boolean') setStatus(s as UpdateStatus);
  }, []);

  useEffect(() => consider(meta?.codeVersion ? { codeVersion: meta.codeVersion } : undefined), [meta?.codeVersion, consider]);
  useServerEvent<UpdateStatus>('hello', consider); // every SSE (re)connection — also right after a restart
  useServerEvent<UpdateStatus>('update', consider);
  useEffect(() => {
    // fallback for a missed event (sleeping laptop, proxy): ask now and then
    const check = () => {
      api
        .get<UpdateStatus>('/api/update')
        .then(consider)
        .catch(() => undefined);
    };
    check();
    const id = setInterval(() => !document.hidden && check(), UPDATE_POLL_MS);
    const onVisible = () => !document.hidden && check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [consider]);

  useEffect(() => {
    if (reloadDue && !inTest) window.location.reload();
  }, [reloadDue, inTest]);

  const restart = useCallback(async () => {
    setRestarting(true);
    try {
      await api.post('/api/restart', {});
    } catch (e) {
      setRestarting(false);
      toast(`Không khởi động lại được: ${(e as Error).message}`);
      return;
    }
    toast('↻ Đang khởi động lại app… trang sẽ tự tải lại.');
    const until = Date.now() + RESTART_WAIT_MS;
    const poll = async () => {
      try {
        const s = await api.get<UpdateStatus>('/api/update');
        // the new process: another code version, or no pending update any more
        if (s.codeVersion !== loadedWith.current || !s.update) {
          window.location.reload();
          return;
        }
      } catch {
        // restarting (npm install, startup) — keep waiting
      }
      if (Date.now() < until) setTimeout(() => void poll(), 1500);
      else {
        setRestarting(false);
        toast('App chưa chạy lại — xem cửa sổ Terminal của app.');
      }
    };
    setTimeout(() => void poll(), 1500);
  }, []);

  return { status, restart, restarting };
}

/**
 * Finished tests that could not be submitted (no connection) wait in the outbox: sent again on page load, `online`, tab
 * focus, a new SSE connection (the server is back) and every 30 s while the page is visible.
 */
function useOutboxRetry(top: string, refresh: () => Promise<void>) {
  const entries = useOutbox();
  const waiting = entries.filter((e) => !e.permanent).length;
  const topRef = useRef(top);
  topRef.current = top;
  const flush = useCallback(async () => {
    const sent = await flushOutbox();
    if (!sent.length) return;
    void refresh();
    toast(sent.length === 1 ? `✓ Đã nộp bài đang chờ: ${sent[0].title}` : `✓ Đã nộp ${sent.length} bài đang chờ`);
    if (topRef.current === '/run' && !loadActive()) navigate(`/result/${encodeURIComponent(sent[sent.length - 1].attempt.id)}`, { replace: true });
  }, [refresh]);
  useEffect(() => {
    if (!waiting) return;
    void flush();
    const id = setInterval(() => !document.hidden && void flush(), OUTBOX_RETRY_MS);
    const now = () => void flush();
    const onVisible = () => !document.hidden && void flush();
    window.addEventListener('online', now);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', now);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [waiting, flush]);
  useServerEvent('hello', () => {
    if (waiting) void flush();
  });
  return entries;
}

const NAV = [
  { path: '/', icon: '🏠', label: 'Tổng quan' },
  { path: '/new', icon: '✍️', label: 'Tạo bài test' },
  { path: '/history', icon: '🕘', label: 'Lịch sử' },
  { path: '/stats', icon: '📊', label: 'Thống kê' },
  { path: '/coach', icon: '🤖', label: 'AI Coach' },
  { path: '/bank', icon: '🗂️', label: 'Ngân hàng câu hỏi' },
  { path: '/notes', icon: '📖', label: 'Tài liệu' },
  { path: '/tools', icon: '🧰', label: 'Công cụ' },
];

export function App() {
  const route = useRoute();
  const { meta, state, error, refresh } = useData();
  const [theme, setTheme] = useTheme();
  const top = `/${route.parts[0] ?? ''}`;
  const focus = top === '/run';
  const active = loadActive();
  const outbox = useOutboxRetry(top, refresh);
  const { status: code, restart, restarting } = useCodeUpdate(meta, focus && !!active);

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
  else if (top === '/tools') page = <Tools />;
  else page = <Dashboard />;

  const counts: Record<string, number | undefined> = {
    '/bank': meta?.problems.errors || undefined,
    '/coach': meta?.openIssues || undefined,
  };
  const offline = !!error && /không kết nối được máy chủ|máy chủ không trả lời/.test(error);
  const update = code?.update && !code.watch && !active ? code.update : undefined; // never offered in the middle of a test

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
        {outbox.length > 0 && !active && !focus && (
          <a className="nav-link nav-resume" href={href('/run')} title="Bài đã làm xong nhưng chưa gửi được tới máy chủ — app tự nộp lại khi có kết nối">
            <span className="ico">⏳</span> {outbox.length} bài chờ nộp
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
            <LanBadge host={meta?.host} />
          </div>
        </div>
      </nav>
      {focus ? (
        page
      ) : (
        <main className="main">
          <ErrorBox error={error && (offline ? 'Mất kết nối tới máy chủ — kiểm tra app còn chạy (cửa sổ Terminal) rồi tải lại trang.' : `Không kết nối được server: ${error}`)} />
          {update && code && (
            <div className="alert info row between" role="status" style={{ marginBottom: 16 }}>
              <span style={{ minWidth: 0, flex: '1 1 260px' }}>
                🔄 <b>Ứng dụng vừa được cập nhật</b> — lần đồng bộ vừa rồi nhận code mới từ máy kia ({update.files.length} file
                {update.lockChanged ? ', có thư viện mới' : ''}).{' '}
                {code.launcher ? (
                  'Khởi động lại để dùng bản mới (bài đang làm và bài chờ nộp được giữ nguyên).'
                ) : (
                  <>
                    Tắt app (Ctrl+C trong cửa sổ Terminal) rồi chạy lại <code>{update.lockChanged ? 'npm install && npm start' : 'npm start'}</code>.
                  </>
                )}
              </span>
              {code.launcher && (
                <button type="button" className="btn sm primary" onClick={() => void restart()} disabled={restarting}>
                  {restarting ? (
                    <>
                      <span className="spinner" /> Đang khởi động lại…
                    </>
                  ) : (
                    '↻ Khởi động lại'
                  )}
                </button>
              )}
            </div>
          )}
          <SearchBox />
          {page}
        </main>
      )}
      <ToastHost />
    </div>
  );
}
