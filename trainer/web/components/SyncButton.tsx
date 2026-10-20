// "⇅ Đồng bộ" (sidebar footer): commit learning data → git pull --rebase → git push, for learners who
// study on two machines sharing one repo. Status pills: ↑ commits to push, ↓ commits to pull, ● changed data files,
// ⏳ data waiting > 24 h to be pushed; right side: when the last sync succeeded. The server also syncs on its own
// (config sync.auto: idle — a few minutes after a submitted test, at startup, at shutdown); SSE `sync` refreshes this.
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, ApiError } from '../lib/api.ts';
import { useData, useServerEvent } from '../lib/store.tsx';
import { fmtDateTime, fmtRelative } from '../lib/format.ts';
import { Modal, toast } from './ui.tsx';
import { KvRow, hostListed } from './insights.tsx';
import type { SyncResult } from '../../shared/types.ts';

type SyncSource = 'manual' | 'auto' | 'startup' | 'shutdown' | 'ai';

interface SyncRecord {
  at: string;
  ok: boolean;
  message: string;
  hint?: string;
  source: SyncSource;
}

/** GET /api/sync/status (contract fields + optional extras the server may add). */
export interface SyncStatus {
  host: string;
  branch: string;
  remote: string;
  ahead: number;
  behind: number;
  dirtyData: number | string[] | boolean;
  error?: string;
  remoteUrl?: string;
  dirtyFiles?: string[];
  fetchedAt?: string;
  lastSync?: { at: string; subject: string };
  syncing?: boolean;
  disabled?: boolean; // sync impossible here (test sandbox, not a git repo, …)
  lastRun?: SyncRecord; // last sync of the server process (any source)
  lastOkAt?: string; // last successful sync of the server process
  unpushedSince?: string; // oldest data change not on the remote yet
  stale?: boolean; // unpushedSince older than 24 h
  auto?: {
    mode: 'idle' | 'off';
    delayMinutes: number;
    disabled?: string;
    dueAt?: string;
    reason?: 'submit' | 'retry' | 'startup';
    running?: boolean;
    failures: number;
    last?: SyncRecord;
  };
}

const SOURCE_LABEL: Record<SyncSource, string> = { manual: 'bấm tay', auto: 'tự động', startup: 'khi mở app', shutdown: 'khi tắt app', ai: 'cùng AI Coach' };

/** Newest successful sync known: this server process, or the newest "trainer: sync" commit (either machine). */
function lastSyncAt(st: SyncStatus | undefined): string | undefined {
  const times = [st?.lastOkAt, st?.lastSync?.at].filter((x): x is string => !!x);
  return times.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Age without "trước": "26 giờ", "2 ngày". */
const age = (iso: string) => fmtRelative(iso).replace(/ trước$/, '');

type RunResult = SyncResult & { hint?: string; conflicts?: string[]; dryRun?: boolean; migrated?: number };

function dirtyCount(d: SyncStatus['dirtyData'] | undefined): number {
  if (Array.isArray(d)) return d.length;
  if (typeof d === 'number') return d;
  return d ? 1 : 0;
}

// Fallback hints for raw git errors when the server sent no `hint`.
const HINTS: [RegExp, string][] = [
  [/\b403\b|permission to .* denied|denied to|write access/i, 'Tài khoản Git trên máy này không có quyền ghi vào repo: thêm tài khoản làm collaborator, hoặc tạo token (PAT) có quyền “Contents: Read and write”.'],
  [/authentication failed|could not read username|terminal prompts disabled|invalid username or password|\b401\b/i, 'Máy này chưa đăng nhập Git: chạy `git pull` một lần trong Terminal (nhập username + token) hoặc `gh auth login`, rồi thử lại.'],
  [/conflict|could not apply|merge failed/i, 'Xung đột khi gộp thay đổi từ máy kia: mở Terminal ở thư mục repo, chạy `git pull --rebase`, sửa xung đột rồi `git push`.'],
  [/could not resolve host|unable to access|network is unreachable|timed out|timeout|connection reset/i, 'Không kết nối được remote (mạng hoặc quá thời gian chờ). Kiểm tra mạng rồi bấm đồng bộ lại.'],
  [/no upstream|no tracking information|has no upstream/i, 'Nhánh hiện tại chưa có upstream: chạy một lần `git push -u origin <tên-nhánh>` trong Terminal.'],
  [/not a git repository/i, 'Thư mục này không phải git repo — đồng bộ cần repo đã clone từ GitHub/GitLab.'],
  [/non-fast-forward|fetch first|\[rejected\]/i, 'Remote có commit mới hơn — bấm “Đồng bộ ngay” lần nữa (app kéo về trước khi đẩy lên).'],
];

export function syncHints(text: string | undefined): string[] {
  if (!text) return [];
  return HINTS.filter(([re]) => re.test(text)).map(([, h]) => h);
}

function HintList({ hints }: { hints: string[] }) {
  if (!hints.length) return null;
  return (
    <ul className="ins-sync-hints small">
      {hints.map((h) => (
        <li key={h}>💡 {h}</li>
      ))}
    </ul>
  );
}

export function SyncButton() {
  const { meta, refresh } = useData();
  const [st, setSt] = useState<SyncStatus>();
  const [stErr, setStErr] = useState<{ msg: string; status?: number }>();
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'sync' | 'dry'>();
  const [result, setResult] = useState<RunResult>();

  /** `remote` = also fetch from the remote (the server does that at most once a minute). */
  const check = useCallback(async (remote: boolean) => {
    setChecking(true);
    try {
      setSt(await api.get<SyncStatus>(`/api/sync/status${remote ? '' : '?fetch=0'}`));
      setStErr(undefined);
    } catch (e) {
      setStErr({ msg: (e as Error).message, status: e instanceof ApiError ? e.status : undefined });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check(false);
    const t = setInterval(() => void check(true), 10 * 60_000);
    return () => clearInterval(t);
  }, [check]);
  // a sync finished on the server (auto sync after a test, at startup, the AI coach, another tab) → fresh pills
  useServerEvent('sync', () => void check(false));

  const run = async (dryRun: boolean) => {
    setBusy(dryRun ? 'dry' : 'sync');
    setResult(undefined);
    try {
      const r = await api.post<RunResult>('/api/sync', dryRun ? { dryRun: true } : {});
      setResult(r);
      if (r.ok && !dryRun) {
        toast('⇅ Đã đồng bộ xong');
        void refresh();
      }
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message, steps: [], host: st?.host ?? meta?.host ?? '' });
    } finally {
      setBusy(undefined);
      void check(false);
    }
  };

  const unsupported = stErr?.status === 404;
  const disabled = !!st?.disabled;
  const dirty = dirtyCount(st?.dirtyData);
  const files = st?.dirtyFiles ?? (Array.isArray(st?.dirtyData) ? st.dirtyData : []);
  const host = st?.host || meta?.host || '';
  const coachHosts = meta?.coachHosts ?? [];
  const problem = !disabled && (st?.error || (stErr && !unsupported));
  const resultHints = result && !result.ok ? (result.hint ? [result.hint] : syncHints([result.message, ...result.steps.filter((s) => !s.ok).map((s) => s.output)].join('\n'))) : [];
  const lastAt = lastSyncAt(st);
  const stale = !disabled && !!st?.stale && !!st.unpushedSince;
  const auto = st?.auto;

  const modal = (
    <Modal open={open} onClose={() => setOpen(false)} title="⇅ Đồng bộ giữa các máy">
      <div className="stack ins-wrap">
        <div className="small dim">
          Lưu dữ liệu học (kết quả, coach, ngân hàng câu hỏi) lên git: <b>commit → pull --rebase → push</b>. Dùng khi học trên 2 máy với cùng một repo — các file nhật ký
          (báo lỗi, đánh giá, hỏi AI) được gộp tự động.
          {meta?.syncAi && (meta.syncAi.before || meta.syncAi.after) && (
            <> AI Coach cũng tự đồng bộ {meta.syncAi.before && meta.syncAi.after ? 'trước và sau' : meta.syncAi.before ? 'trước' : 'sau'} mỗi lượt chạy.</>
          )}
        </div>
        {unsupported ? (
          <div className="ins-wrap alert small">Server này chưa hỗ trợ đồng bộ (cần bản server mới).</div>
        ) : stErr ? (
          <div className="ins-wrap alert bad small">⚠️ Không đọc được trạng thái git: {stErr.msg}</div>
        ) : !st ? (
          <div className="row small muted">
            <span className="spinner" /> Đang kiểm tra trạng thái git…
          </div>
        ) : disabled ? (
          <div className="ins-wrap alert info small">⏸ {st.error ?? 'Đồng bộ không khả dụng ở đây.'}</div>
        ) : (
          <>
            <div className="ins-sync-grid small">
              <KvRow k="Máy này">{st.host || host || '—'}</KvRow>
              <KvRow k="Nhánh">{st.branch || '—'}</KvRow>
              <KvRow k="Remote" title={st.remoteUrl}>
                {st.remote || '—'}
              </KvRow>
              <KvRow k="Commit chưa đẩy lên">{st.ahead ?? 0}</KvRow>
              <KvRow k="Commit mới trên remote">{st.behind ?? 0}</KvRow>
              <KvRow k="File dữ liệu thay đổi">{dirty}</KvRow>
            </div>
            <div className="tiny muted ins-wrap">
              {lastAt ? `Đồng bộ lần cuối: ${fmtDateTime(lastAt)} (${fmtRelative(lastAt)})` : 'Chưa có lần đồng bộ nào trên nhánh này.'}
              {st.lastRun && !st.lastRun.ok ? ` · lần thử gần nhất (${SOURCE_LABEL[st.lastRun.source]}, ${fmtRelative(st.lastRun.at)}) lỗi: ${st.lastRun.message}` : ''}
              {st.fetchedAt ? ` · đã kiểm tra remote ${fmtRelative(st.fetchedAt)}` : ''}
              {st.remoteUrl ? ` · ${st.remoteUrl}` : ''}
            </div>
            {stale && st.unpushedSince && (
              <div className="ins-wrap alert warn small" role="status">
                ⏳ Có dữ liệu học chưa đẩy lên GitHub từ <b>{fmtDateTime(st.unpushedSince)}</b> ({fmtRelative(st.unpushedSince)}) — máy kia chưa thấy các bài
                này. Bấm <b>⇅ Đồng bộ ngay</b>.
              </div>
            )}
          </>
        )}
        {auto && !auto.disabled && !disabled && !unsupported && (
          <div className="tiny muted ins-wrap">
            {auto.mode === 'idle' ? (
              <>
                ⇅ <b>Tự đồng bộ khi rảnh: bật</b> — {auto.delayMinutes} phút sau mỗi bài nộp (nếu chưa bắt đầu bài mới), kéo về khi mở app, đẩy lên khi tắt app.
                {auto.running ? ' Đang tự đồng bộ…' : auto.dueAt ? ` Lần tới: ${hhmm(auto.dueAt)}${auto.reason === 'retry' ? ' (thử lại sau lỗi)' : ''}.` : ''}
                {auto.last ? ` Lần tự đồng bộ gần nhất (${SOURCE_LABEL[auto.last.source]}, ${fmtRelative(auto.last.at)}): ${auto.last.ok ? '✓' : '✗'} ${auto.last.message}` : ''}
                {auto.failures > 1 ? ` · lỗi ${auto.failures} lần liền` : ''} Tắt: <code>sync.auto: off</code> trong <code>trainer/config.yaml</code>.
              </>
            ) : (
              <>
                Tự đồng bộ khi rảnh đang tắt — chỉ đồng bộ khi bấm nút này hoặc khi AI Coach chạy. Bật: <code>sync.auto: idle</code> trong <code>trainer/config.yaml</code>.
              </>
            )}
          </div>
        )}
        {checking && st && (
          <div className="tiny muted row" style={{ gap: 6 }}>
            <span className="spinner" style={{ width: 12, height: 12 }} /> đang kiểm tra lại…
          </div>
        )}
        {st?.error && !disabled && (
          <div className="ins-wrap alert warn small">
            ⚠️ {st.error}
            <HintList hints={syncHints(st.error)} />
          </div>
        )}
        {files.length > 0 && (
          <details className="small">
            <summary>{dirty} file dữ liệu sẽ được commit</summary>
            <pre className="console ins-sync-files">{files.join('\n')}</pre>
          </details>
        )}
        <div className="tiny muted">
          {coachHosts.length ? (
            hostListed(host, coachHosts) ? (
              <>
                ✓ Máy này ({host}) nằm trong <code>coach.hosts</code> — AI Coach theo lịch chạy ở đây.
              </>
            ) : (
              <>
                ⚠️ AI Coach theo lịch chỉ chạy trên <b>{coachHosts.join(', ')}</b>; máy này ({host}) bỏ qua lượt theo lịch (vẫn bấm chạy tay được).
              </>
            )
          ) : (
            <>
              Lịch AI Coach đang chạy trên mọi máy. Dùng 2 máy? Đặt <code>coach.hosts: [{host || 'tên-máy'}]</code> trong <code>trainer/config.yaml</code> để chỉ một máy
              chạy lịch.
            </>
          )}
        </div>
        {result && (
          <div className="stack sm">
            <div className={`ins-wrap alert small ${result.ok ? 'good' : 'bad'}`}>
              {result.ok ? '✓' : '✗'} {result.message || (result.ok ? 'Đã đồng bộ.' : 'Đồng bộ thất bại.')}
              {result.conflicts && result.conflicts.length > 0 && <div className="mono tiny">{result.conflicts.join(', ')}</div>}
              {!!result.migrated && <div className="tiny">↻ Đã chuyển {result.migrated} file kết quả nhận về sang bố cục đáp án mới.</div>}
              <HintList hints={resultHints} />
            </div>
            {result.steps.length > 0 && (
              <div className="ins-sync-steps">
                {result.steps.map((s, i) => (
                  <details key={i} open={!s.ok}>
                    <summary className="small">
                      <span className={s.ok ? 'good' : 'bad'}>{s.ok ? '✓' : '✗'}</span> <code>{s.cmd}</code>
                    </summary>
                    {s.output ? <pre className="console">{s.output}</pre> : <div className="tiny muted">(không có output)</div>}
                  </details>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="row between">
          <span className="tiny muted ins-wrap">
            Hoặc trong terminal: <code>npm run sync</code>
          </span>
          <div className="row">
            <button className="btn ghost" onClick={() => void check(true)} disabled={checking || !!busy}>
              ↻ Kiểm tra lại
            </button>
            <button className="btn" onClick={() => void run(true)} disabled={!!busy || unsupported || disabled} title="Xem trước sẽ commit/nhận/đẩy gì — không thay đổi gì">
              {busy === 'dry' ? <span className="spinner" /> : '🔍'} Chạy thử
            </button>
            <button className="btn primary" onClick={() => void run(false)} disabled={!!busy || unsupported || disabled || !!st?.syncing}>
              {busy === 'sync' ? (
                <>
                  <span className="spinner" /> Đang đồng bộ…
                </>
              ) : (
                '⇅ Đồng bộ ngay'
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );

  return (
    <>
      <button
        type="button"
        className={`btn sm ins-sync-btn ${disabled || unsupported ? 'off' : ''}`}
        onClick={() => {
          setOpen(true);
          void check(true);
        }}
        title={
          unsupported
            ? 'Server chưa hỗ trợ đồng bộ'
            : st?.error
              ? st.error
              : stale && st?.unpushedSince
                ? `Có dữ liệu chưa đẩy lên GitHub từ ${fmtDateTime(st.unpushedSince)} (${fmtRelative(st.unpushedSince)}) — máy kia chưa thấy các bài này. Bấm để đồng bộ.`
                : `Đồng bộ dữ liệu học qua git (học trên 2 máy)${lastAt ? ` · lần cuối ${fmtDateTime(lastAt)} (${fmtRelative(lastAt)})` : ''}`
        }
      >
        <span>⇅ Đồng bộ</span>
        {st && !st.error && (
          <>
            {st.ahead > 0 && (
              <span className="ins-pill" title={`${st.ahead} commit chưa đẩy lên remote`}>
                ↑{st.ahead}
              </span>
            )}
            {st.behind > 0 && (
              <span className="ins-pill" title={`${st.behind} commit mới trên remote chưa kéo về`}>
                ↓{st.behind}
              </span>
            )}
            {dirty > 0 && (
              <span className="ins-pill" title={`${dirty} file dữ liệu thay đổi chưa commit`}>
                ●{dirty}
              </span>
            )}
            {stale && st.unpushedSince && (
              <span className="ins-pill warn" title={`Dữ liệu chưa đẩy lên GitHub từ ${fmtRelative(st.unpushedSince)}`}>
                ⏳ {age(st.unpushedSince)}
              </span>
            )}
          </>
        )}
        {(st?.syncing || auto?.running || busy === 'sync') && <span className="spinner" style={{ width: 12, height: 12 }} />}
        {problem && <span className="ins-pill warn">⚠</span>}
        {!disabled && !unsupported && lastAt && !stale && (
          <span className="tiny muted" style={{ marginLeft: 'auto', fontWeight: 400 }}>
            {fmtRelative(lastAt)}
          </span>
        )}
      </button>
      {/* portal: the sidebar is sticky (its own stacking context) — rendered inside it, positioned marks
          of the main column would paint over the modal */}
      {open && createPortal(modal, document.body)}
    </>
  );
}
