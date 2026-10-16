// "⇅ Đồng bộ" (sidebar footer): commit learning data → git pull --rebase → git push, for learners who
// study on two machines sharing one repo. Status pills: ↑ commits to push, ↓ commits to pull, ● changed data files.
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, ApiError } from '../lib/api.ts';
import { useData } from '../lib/store.tsx';
import { fmtDateTime, fmtRelative } from '../lib/format.ts';
import { Modal, toast } from './ui.tsx';
import { KvRow, hostListed } from './insights.tsx';
import type { SyncResult } from '../../shared/types.ts';

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
}

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

  const modal = (
    <Modal open={open} onClose={() => setOpen(false)} title="⇅ Đồng bộ giữa các máy">
      <div className="stack ins-wrap">
        <div className="small dim">
          Lưu dữ liệu học (kết quả, coach, ngân hàng câu hỏi) lên git: <b>commit → pull --rebase → push</b>. Dùng khi học trên 2 máy với cùng một repo — các file nhật ký
          (báo lỗi, đánh giá, hỏi AI) được gộp tự động.
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
              {st.lastSync ? `Lần đồng bộ gần nhất: ${fmtDateTime(st.lastSync.at)} (${fmtRelative(st.lastSync.at)})` : 'Chưa có lần đồng bộ nào trên nhánh này.'}
              {st.fetchedAt ? ` · đã kiểm tra remote ${fmtRelative(st.fetchedAt)}` : ''}
              {st.remoteUrl ? ` · ${st.remoteUrl}` : ''}
            </div>
          </>
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
        title={unsupported ? 'Server chưa hỗ trợ đồng bộ' : st?.error ? st.error : 'Đồng bộ dữ liệu học qua git (học trên 2 máy)'}
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
          </>
        )}
        {(st?.syncing || busy === 'sync') && <span className="spinner" style={{ width: 12, height: 12 }} />}
        {problem && <span className="ins-pill warn">⚠</span>}
      </button>
      {/* portal: the sidebar is sticky (its own stacking context) — rendered inside it, positioned marks
          of the main column would paint over the modal */}
      {open && createPortal(modal, document.body)}
    </>
  );
}
