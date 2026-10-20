// [X] 📱 Mở trên điện thoại: LAN access status, QR code + access code (this machine only), toggle, rotate, tips.
// [v5] π paired devices (30-day tokens, rename / revoke), "admin from the phone" toggle (practice scope by default),
// HTTPS status (server.https: tailscale | mkcert) with its own QR code.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import { fmtRelative } from '../../lib/format.ts';
import { ErrorBox, Spinner, copyText, toast } from '../ui.tsx';
import { announceLan } from './LanBadge.tsx';
import type { LanDevice, LanHttps, LanInfo, LanSource } from '../../../shared/types.ts';

const SOURCE: Record<LanSource, (on: boolean) => string> = {
  runtime: (on) => (on ? 'Bật tạm thời từ trang này — tự tắt khi khởi động lại app' : 'Đã tắt tạm thời từ trang này — khởi động lại app sẽ theo cấu hình'),
  cli: () => 'Bật bằng lệnh npm start -- --lan',
  env: (on) => (on ? 'Bật bằng biến môi trường LAN=1' : 'Tắt bằng biến môi trường LAN=0'),
  config: () => 'Bật lâu dài trong config.yaml → server.lan: true',
  off: () => 'Mặc định: chỉ máy này truy cập được (config.yaml → server.lan: false)',
};

/** "iPhone · Safari" from a user agent. */
export function deviceName(ua?: string): string {
  if (!ua) return 'Thiết bị';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Thiết bị';
  const browser = /EdgA?\/|EdgiOS/.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /CriOS|Chrome\//.test(ua)
        ? 'Chrome'
        : /FxiOS|Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : '';
  return browser ? `${os} · ${browser}` : os;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

/** Active / expired / revoked, for the device list. */
function deviceState(d: LanDevice): { label: string; tone: '' | 'good' | 'bad' | 'warn' } {
  if (d.revoked) return { label: 'đã thu hồi', tone: 'bad' };
  if (Date.parse(d.expires) <= Date.now()) return { label: 'hết hạn', tone: 'warn' };
  return { label: `hết hạn ${fmtDate(d.expires)}`, tone: 'good' };
}

function Tips() {
  return (
    <details className="tl-tips">
      <summary>💡 Điện thoại không mở được?</summary>
      <ul>
        <li>
          Điện thoại và máy này phải <b>cùng một mạng Wi-Fi</b> (không dùng 4G/5G — trừ khi dùng Tailscale, xem HTTPS). Wi-Fi khách / quán cà phê thường chặn các thiết bị nói
          chuyện với nhau (“AP isolation”) — dùng Wi-Fi nhà hoặc điểm phát của chính máy này.
        </li>
        <li>
          <b>macOS</b>: nếu bật tường lửa (Cài đặt hệ thống → Mạng → Tường lửa) và có hỏi “cho phép <code>node</code> nhận kết nối đến?” → chọn <b>Cho phép</b>.{' '}
          <b>Windows</b>: hộp thoại Windows Defender Firewall → tick <b>Private networks</b> → Allow access.
        </li>
        <li>
          Tên <code>.local</code> không chạy trên một số máy Android — dùng địa chỉ IP (mã QR đã dùng IP). Đổi mạng Wi-Fi thì IP đổi: mở lại trang này để lấy QR mới.
        </li>
        <li>
          Quét QR một lần: mỗi thiết bị có <b>mã riêng 30 ngày</b>, hết hạn thì quét lại. Thêm vào màn hình chính (Safari: Chia sẻ → Thêm vào MH chính · Chrome: ⋮ → Thêm vào màn hình
          chính) để mở như app.
        </li>
        <li>
          Điện thoại mặc định chỉ <b>luyện tập</b> (làm bài, nộp bài, xem thống kê, tài liệu). AI Coach, đồng bộ git, kiểm duyệt và cài đặt chỉ dùng trên máy này, trừ khi bật “Cho phép
          quản trị từ điện thoại”. Lỡ chia sẻ mã → <b>Đổi mã</b>: mọi thiết bị phải quét lại; mất máy → <b>Thu hồi</b> riêng thiết bị đó.
        </li>
      </ul>
    </details>
  );
}

function HttpsNote({ https }: { https?: LanHttps }) {
  if (!https || https.mode === 'off') {
    return (
      <div className="tiny muted">
        🔒 HTTPS (cài app PWA trên điện thoại, học qua 4G với Tailscale): đặt <code>server.https: tailscale</code> hoặc <code>mkcert</code> trong <code>config.yaml</code>.
      </div>
    );
  }
  return (
    <div className="stack sm">
      <b className="small">
        🔒 HTTPS ({https.mode}) {https.active ? <span className="badge good">đang bật</span> : <span className="badge warn">chưa sẵn sàng</span>}
      </b>
      {https.active && (
        <div className="tiny muted">
          Chứng chỉ: {(https.names ?? []).join(', ')}
          {https.validTo ? ` · hết hạn ${fmtDate(https.validTo)}` : ''}
          {https.renewedAt ? ` · lấy lúc ${fmtRelative(https.renewedAt)}` : ''}
        </div>
      )}
      {https.error && <div className="tiny">{https.error}</div>}
      {https.hint && <div className="tiny muted">{https.hint}</div>}
    </div>
  );
}

function Devices({ list, busy, onRevoke, onRename }: { list: LanDevice[]; busy: boolean; onRevoke: (d: LanDevice) => void; onRename: (d: LanDevice) => void }) {
  if (!list.length) return <div className="tiny muted">Chưa có thiết bị nào quét mã. Thiết bị quét QR sẽ hiện ở đây — mỗi thiết bị một mã riêng, thu hồi được từng cái.</div>;
  return (
    <ul className="tl-devices">
      {list.map((d) => {
        const st = deviceState(d);
        const active = !d.revoked && st.tone === 'good';
        return (
          <li key={d.id} className="small row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              {d.legacy ? '🕰️ ' : '📱 '}
              {d.name}
            </span>
            <span className={`badge ${st.tone}`}>{st.label}</span>
            {d.lastSeen && <span className="muted">· {fmtRelative(d.lastSeen)}</span>}
            {d.ip && <span className="mono muted">{d.ip}</span>}
            <span className="spacer" />
            {!d.legacy && active && (
              <button className="btn ghost sm" disabled={busy} onClick={() => onRename(d)} aria-label={`Đổi tên ${d.name}`}>
                ✏️
              </button>
            )}
            {active && (
              <button className="btn sm danger" disabled={busy} onClick={() => onRevoke(d)}>
                Thu hồi
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function LanCard() {
  const [info, setInfoState] = useState<LanInfo>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<'http' | 'https'>('https');
  const setInfo = useCallback((next: LanInfo) => {
    setInfoState(next);
    announceLan(next); // sidebar badge
  }, []);

  const load = useCallback(async () => {
    try {
      setInfo(await api.get<LanInfo>('/api/lan'));
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [setInfo]);

  useEffect(() => {
    void load();
  }, [load]);

  // Devices appear here as they connect: refresh while the page is open on this machine.
  const live = !!info?.local && info.enabled;
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [live, load]);

  const run = async (fn: () => Promise<LanInfo>, done?: string) => {
    setBusy(true);
    try {
      setInfo(await fn());
      setError(undefined);
      if (done) toast(done);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (enabled: boolean) => run(() => api.post<LanInfo>('/api/lan', { enabled }), enabled ? 'Đã mở truy cập trong mạng LAN' : 'Đã tắt truy cập LAN');
  const setAdmin = (enabled: boolean) => {
    if (enabled && !window.confirm('Cho phép điện thoại dùng cả AI Coach, đồng bộ git, kiểm duyệt câu hỏi và cài đặt (tốn hạn mức Claude của bạn)? Có hiệu lực đến khi khởi động lại app.')) return;
    void run(() => api.post<LanInfo>('/api/lan/admin', { enabled }), enabled ? 'Điện thoại có quyền quản trị' : 'Điện thoại chỉ còn quyền luyện tập');
  };
  const rotate = () => {
    if (!window.confirm('Đổi mã truy cập? Mọi điện thoại / máy khác đang dùng trainer qua mạng LAN sẽ phải quét mã QR mới.')) return;
    void run(() => api.post<LanInfo>('/api/lan/rotate'), 'Đã đổi mã truy cập');
  };
  const revoke = (d: LanDevice) => {
    if (!window.confirm(`Thu hồi quyền truy cập của “${d.name}”? Thiết bị đó phải quét lại mã QR.`)) return;
    void run(() => api.post<LanInfo>(`/api/lan/devices/${encodeURIComponent(d.id)}/revoke`), `Đã thu hồi ${d.name}`);
  };
  const rename = (d: LanDevice) => {
    const name = window.prompt('Tên thiết bị', d.name);
    if (!name || name.trim() === d.name) return;
    void run(() => api.post<LanInfo>(`/api/lan/devices/${encodeURIComponent(d.id)}`, { name: name.trim() }), 'Đã đổi tên');
  };
  const renew = () => void run(() => api.post<LanInfo>('/api/lan/https/renew'), 'Đã lấy lại chứng chỉ');
  const copy = async (text: string, what: string) => {
    if (await copyText(text)) toast(`Đã chép ${what}`);
  };

  const head = (
    <div className="card-head">
      <h2>📱 Mở trên điện thoại</h2>
      {info && (
        <span className={`badge ${info.enabled ? 'good' : ''}`} title={info.source ? SOURCE[info.source](info.enabled) : undefined}>
          {info.enabled ? '● Đang mở trong mạng LAN' : '○ Chỉ máy này'}
        </span>
      )}
    </div>
  );

  if (!info) {
    return (
      <section className="card tl-card" aria-busy={!error}>
        {head}
        {error ? <ErrorBox error={error} /> : <Spinner />}
      </section>
    );
  }

  if (!info.local) {
    const admin = info.scope === 'admin';
    return (
      <section className="card tl-card stack">
        {head}
        <div className="alert info">
          📱 Bạn đang mở trainer từ một thiết bị khác trong mạng LAN —{' '}
          {admin ? (
            <>
              có <b>quyền quản trị</b> (máy chạy app đang cho phép).
            </>
          ) : (
            <>
              chế độ <b>luyện tập</b>: làm bài, xem kết quả, thống kê, tài liệu. AI Coach, đồng bộ, kiểm duyệt và cài đặt chỉ dùng trên máy chạy app.
            </>
          )}{' '}
          Bật / tắt LAN, mã truy cập và danh sách thiết bị chỉ làm được trên máy chạy app.
        </div>
        {info.device && (
          <div className="small">
            Thiết bị này: <b>{info.device.name}</b> · mã riêng hết hạn {fmtDate(info.device.expires)} (sau đó quét lại QR)
          </div>
        )}
        {info.urls.length > 0 && (
          <div className="stack sm">
            <b className="small">Địa chỉ của trainer</b>
            <ul className="tl-urls">
              {[...(info.https?.urls ?? []), ...info.urls].map((u) => (
                <li key={u} className="mono small">
                  {u}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="small dim">Mẹo: thêm trang này vào màn hình chính (Safari: Chia sẻ → Thêm vào MH chính · Chrome: ⋮ → Thêm vào màn hình chính) để mở như một app.</div>
      </section>
    );
  }

  if (!info.enabled) {
    return (
      <section className="card tl-card stack">
        {head}
        <p className="tl-lead">
          Trainer đang chỉ mở cho máy này (<code>127.0.0.1</code>). Bật truy cập LAN để học trên điện thoại cùng Wi-Fi: quét mã QR một lần là vào được — mỗi thiết bị nhận{' '}
          <b>mã riêng 30 ngày</b>, mặc định chỉ có quyền luyện tập.
        </p>
        <ErrorBox error={info.error ? `Không mở được cổng LAN: ${info.error}` : error} />
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={() => void toggle(true)}>
            {busy ? <Spinner /> : '📶'} Bật truy cập LAN
          </button>
          <span className="small muted">{info.source ? SOURCE[info.source](false) : ''}</span>
        </div>
        <div className="tiny muted">
          Nút này bật đến khi khởi động lại app. Bật lâu dài: <code>server.lan: true</code> trong <code>config.yaml</code> · <code>npm start -- --lan</code> ·{' '}
          <code>LAN=1 npm start</code>.
        </div>
        {(info.paired?.length ?? 0) > 0 && (
          <div className="stack sm">
            <b className="small">Thiết bị đã ghép</b>
            <Devices list={info.paired!} busy={busy} onRevoke={revoke} onRename={rename} />
          </div>
        )}
        <HttpsNote https={info.https} />
        <Tips />
      </section>
    );
  }

  const https = info.https;
  const useHttps = qr === 'https' && !!https?.active && !!https.qrSvg;
  const qrSvg = useHttps ? https!.qrSvg : info.qrSvg;
  const admin = info.admin ?? { enabled: false, source: 'off' as const };

  return (
    <section className="card tl-card stack">
      {head}
      <ErrorBox error={error} />
      <div className="tl-lan">
        <figure className="tl-qr">
          {qrSvg ? <div className="tl-qr-img" role="img" aria-label="Mã QR mở trainer trên điện thoại" dangerouslySetInnerHTML={{ __html: qrSvg }} /> : null}
          {https?.active && https.qrSvg ? (
            <div className="seg" role="group" aria-label="Kiểu kết nối trong mã QR" style={{ marginTop: 6 }}>
              <button type="button" className={useHttps ? '' : 'on'} onClick={() => setQr('http')}>
                Wi-Fi (HTTP)
              </button>
              <button type="button" className={useHttps ? 'on' : ''} onClick={() => setQr('https')}>
                🔒 HTTPS
              </button>
            </div>
          ) : null}
          <figcaption className="tiny muted">{useHttps ? 'Quét bằng camera (HTTPS — cài được như app)' : 'Quét bằng camera điện thoại (cùng Wi-Fi)'}</figcaption>
        </figure>
        <div className="stack sm tl-lan-side">
          <div className="stack sm">
            <b className="small">Địa chỉ trong mạng LAN</b>
            <ul className="tl-urls">
              {[...(https?.urls ?? []), ...info.urls].map((u) => (
                <li key={u}>
                  <span className="mono small">{u}</span>
                  <button className="btn ghost sm" onClick={() => void copy(u, 'địa chỉ')} aria-label={`Chép ${u}`}>
                    📋
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {info.token && (
            <div className="stack sm">
              <b className="small">Mã truy cập (nhập tay nếu không quét được QR)</b>
              <div className="tl-token-row">
                <code className="tl-token">{info.token}</code>
                <button className="btn ghost sm" onClick={() => void copy(info.token!, 'mã truy cập')} aria-label="Chép mã truy cập">
                  📋
                </button>
              </div>
            </div>
          )}
          <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={admin.enabled} disabled={busy} onChange={(e) => setAdmin(e.target.checked)} style={{ marginTop: 3, flex: 'none' }} />
            <span style={{ minWidth: 0 }}>
              🔓 <b>Cho phép quản trị từ điện thoại</b>
              <span className="tiny muted" style={{ display: 'block' }}>
                {admin.enabled
                  ? admin.source === 'config'
                    ? 'Đang bật lâu dài (config.yaml → server.lan_admin: true): điện thoại dùng được AI, đồng bộ, kiểm duyệt, cài đặt.'
                    : 'Đang bật đến khi khởi động lại app: điện thoại dùng được AI, đồng bộ, kiểm duyệt, cài đặt.'
                  : 'Tắt (mặc định): điện thoại chỉ luyện tập — AI, đồng bộ, kiểm duyệt và cài đặt chỉ dùng trên máy này.'}
              </span>
            </span>
          </label>
          <div className="row">
            <button className="btn sm" disabled={busy} onClick={rotate} title="Tạo mã mới — mọi thiết bị phải quét lại">
              🔄 Đổi mã truy cập
            </button>
            {https?.mode === 'tailscale' && (
              <button className="btn sm" disabled={busy} onClick={renew} title="Chạy tailscale cert ngay (bình thường app tự gia hạn hằng tháng)">
                🔒 Lấy lại chứng chỉ
              </button>
            )}
            <button className="btn sm danger" disabled={busy} onClick={() => void toggle(false)}>
              ⏹ Tắt truy cập LAN
            </button>
          </div>
          <div className="tiny muted">
            {info.source ? SOURCE[info.source](true) : ''}
            {info.ui === 'dist' ? ' · điện thoại nhận bản giao diện đã đóng gói (tải nhanh hơn ~4×)' : ' · chưa dựng được giao diện cho điện thoại (xem cửa sổ Terminal của app)'}
          </div>
          <div className="stack sm">
            <b className="small">Thiết bị đã ghép</b>
            <Devices list={info.paired ?? []} busy={busy} onRevoke={revoke} onRename={rename} />
          </div>
          {(info.failures ?? 0) > 0 && (
            <div className="alert warn small">⚠️ Có {info.failures} lần nhập sai mã truy cập kể từ khi app khởi động. Nếu không phải bạn, bấm “Đổi mã truy cập”.</div>
          )}
          <HttpsNote https={https} />
        </div>
      </div>
      <Tips />
    </section>
  );
}
