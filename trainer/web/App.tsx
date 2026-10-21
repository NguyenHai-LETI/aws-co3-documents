import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { useRoute, href, navigate } from './lib/router.ts';
import { useData, useServerEvent } from './lib/store.tsx';
import { api } from './lib/api.ts';
import { DIFFERS_NOTE, flushOutbox, loadActive, useOutbox, useRemoteActive } from './lib/session.ts';
import { ToastHost, Loading, ErrorBox, toast } from './components/ui.tsx';
import { SyncButton } from './components/SyncButton.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { NewTest } from './pages/NewTest.tsx';
import { Runner } from './pages/Runner.tsx';
import { ResultPage } from './pages/Result.tsx';
import { History } from './pages/History.tsx';
import { LanBadge } from './components/tools/LanBadge.tsx';
import { SearchBox } from './components/SearchBox.tsx';

// [v5] π Pages outside the study loop load on demand (smaller first load in the production build). A chunk that fails to
// load (the app was updated and rebuilt meanwhile) reloads the page once.
const RELOAD_FLAG = 'trainer.chunkReload';
function lazyPage<P extends object>(load: () => Promise<Record<string, unknown>>, name: string) {
  return lazy(async () => {
    try {
      const m = await load();
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        // storage unavailable
      }
      return { default: m[name] as ComponentType<P> };
    } catch (e) {
      let reloaded = true;
      try {
        reloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
        sessionStorage.setItem(RELOAD_FLAG, '1');
      } catch {
        // storage unavailable: never loop
      }
      if (!reloaded) window.location.reload();
      throw e;
    }
  });
}
const Stats = lazyPage<object>(() => import('./pages/Stats.tsx'), 'Stats');
const BankPage = lazyPage<{ query: URLSearchParams }>(() => import('./pages/Bank.tsx'), 'BankPage');
const Coach = lazyPage<object>(() => import('./pages/Coach.tsx'), 'Coach');
const Notes = lazyPage<{ query: URLSearchParams }>(() => import('./pages/Notes.tsx'), 'Notes');
const Tools = lazyPage<object>(() => import('./pages/Tools.tsx'), 'Tools');
const Pair = lazyPage<{ query: URLSearchParams }>(() => import('./pages/Pair.tsx'), 'Pair');
const Listen = lazyPage<object>(() => import('./pages/Listen.tsx'), 'Listen');

/** [v5] π Due reviews on the installed app's icon (Dock / taskbar; Chrome / Edge, installed PWA, secure context). */
function useAppBadge(due: number | undefined) {
  useEffect(() => {
    if (due === undefined) return;
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge) return;
    (due > 0 ? nav.setAppBadge(due) : (nav.clearAppBadge?.() ?? nav.setAppBadge(0))).catch(() => undefined);
  }, [due]);
}

type Theme = 'light' | 'dark';

/**
 * Dark by default; the sidebar button switches to light and back (stored per browser). Anything but an explicit 'light' —
 * nothing stored yet, or the old 'system' value — is dark. index.html applies the same rule before React loads (no flash).
 */
function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem('trainer.theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1a1a19' : '#2a78d6');
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
    const note = sent.some((x) => x.differs) ? ` ${DIFFERS_NOTE}` : ''; // [v5] ρ: another device submitted it first, with other answers
    toast((sent.length === 1 ? `✓ Đã nộp bài đang chờ: ${sent[0].title}` : `✓ Đã nộp ${sent.length} bài đang chờ`) + note);
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
  { path: '/listen', icon: '🎧', label: 'Nghe' }, // [v5] τ listen mode
  { path: '/tools', icon: '🧰', label: 'Công cụ' },
];

/** [v5] π Pages that only drive admin routes: hidden from LAN devices in the practice scope (server.lan_admin off). */
const ADMIN_PAGES = new Set(['/coach']);

export function App() {
  const route = useRoute();
  const { meta, state, error, refresh } = useData();
  const [theme, setTheme] = useTheme();
  const top = `/${route.parts[0] ?? ''}`;
  const focus = top === '/run';
  const active = loadActive();
  const outbox = useOutboxRetry(top, refresh);
  const { remote } = useRemoteActive(!active && !outbox.length); // [v5] ρ: a test left open on another device
  const { status: code, restart, restarting } = useCodeUpdate(meta, focus && !!active);
  useAppBadge(state?.counts.srs);
  const practiceOnly = meta?.access?.scope === 'practice';

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
  else if (top === '/pair') page = <Pair query={route.query} />; // [v5] μ
  else if (top === '/listen') page = <Listen />; // [v5] τ
  else page = <Dashboard />;
  page = <Suspense fallback={<Loading text="Đang tải trang…" />}>{page}</Suspense>;

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
        {remote && !active && !focus && (
          <a className="nav-link nav-resume" href={href('/run')}>
            <span className="ico">⏯️</span> Tiếp tục bài trên {remote.device}
          </a>
        )}
        {outbox.length > 0 && !active && !focus && (
          <a className="nav-link nav-resume" href={href('/run')} title="Bài đã làm xong nhưng chưa gửi được tới máy chủ — app tự nộp lại khi có kết nối">
            <span className="ico">⏳</span> {outbox.length} bài chờ nộp
          </a>
        )}
        {NAV.filter((n) => !(practiceOnly && ADMIN_PAGES.has(n.path))).map((n) => (
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
          {!practiceOnly && <SyncButton />}
          <div className="row nowrap ins-foot-row">
            <button
              type="button"
              className="btn ghost sm theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              title={theme === 'dark' ? 'Đang dùng giao diện tối — bấm để chuyển sang sáng' : 'Đang dùng giao diện sáng — bấm để chuyển sang tối'}
            >
              {theme === 'dark' ? '☀️ Sáng' : '🌙 Tối'}
            </button>
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
