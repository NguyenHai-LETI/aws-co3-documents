// [X] 📱 Mở trên điện thoại: LAN access status, QR code + access code (this machine only), toggle, rotate, tips.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import { fmtRelative } from '../../lib/format.ts';
import { ErrorBox, Spinner, copyText, toast } from '../ui.tsx';
import { announceLan } from './LanBadge.tsx';
import type { LanInfo, LanSource } from '../../../shared/types.ts';

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

function Tips() {
  return (
    <details className="tl-tips">
      <summary>💡 Điện thoại không mở được?</summary>
      <ul>
        <li>
          Điện thoại và máy này phải <b>cùng một mạng Wi-Fi</b> (không dùng 4G/5G). Wi-Fi khách / quán cà phê thường chặn các thiết bị nói chuyện với nhau (“AP isolation”) —
          dùng Wi-Fi nhà hoặc điểm phát của chính máy này.
        </li>
        <li>
          <b>macOS</b>: nếu bật tường lửa (Cài đặt hệ thống → Mạng → Tường lửa) và có hỏi “cho phép <code>node</code> nhận kết nối đến?” → chọn <b>Cho phép</b>.{' '}
          <b>Windows</b>: hộp thoại Windows Defender Firewall → tick <b>Private networks</b> → Allow access.
        </li>
        <li>
          Tên <code>.local</code> không chạy trên một số máy Android — dùng địa chỉ IP (mã QR đã dùng IP). Đổi mạng Wi-Fi thì IP đổi: mở lại trang này để lấy QR mới.
        </li>
        <li>Quét QR một lần là đủ: trình duyệt nhớ quyền truy cập 30 ngày. Thêm vào màn hình chính (Safari: Chia sẻ → Thêm vào MH chính · Chrome: ⋮ → Thêm vào màn hình chính) để mở như app.</li>
        <li>
          Ai có mã truy cập dùng được <b>mọi chức năng</b> (kể cả chạy AI Coach và đồng bộ git) — chỉ quét trên thiết bị của bạn. Lỡ chia sẻ → <b>Đổi mã</b>: mọi thiết bị đang
          đăng nhập phải quét lại.
        </li>
      </ul>
    </details>
  );
}

export function LanCard() {
  const [info, setInfoState] = useState<LanInfo>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
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
  const rotate = () => {
    if (!window.confirm('Đổi mã truy cập? Mọi điện thoại / máy khác đang dùng trainer qua mạng LAN sẽ phải quét mã QR mới.')) return;
    void run(() => api.post<LanInfo>('/api/lan/rotate'), 'Đã đổi mã truy cập');
  };
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
    return (
      <section className="card tl-card stack">
        {head}
        <div className="alert info">📱 Bạn đang mở trainer từ một thiết bị khác trong mạng LAN. Bật / tắt và đổi mã truy cập chỉ làm được trên máy chạy app.</div>
        {info.urls.length > 0 && (
          <div className="stack sm">
            <b className="small">Địa chỉ của trainer</b>
            <ul className="tl-urls">
              {info.urls.map((u) => (
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
          Trainer đang chỉ mở cho máy này (<code>127.0.0.1</code>). Bật truy cập LAN để học trên điện thoại cùng Wi-Fi: quét mã QR một lần là vào được — mọi thiết bị khác đều cần{' '}
          <b>mã truy cập</b>.
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
        <Tips />
      </section>
    );
  }

  return (
    <section className="card tl-card stack">
      {head}
      <ErrorBox error={error} />
      <div className="tl-lan">
        <figure className="tl-qr">
          {info.qrSvg ? <div className="tl-qr-img" role="img" aria-label="Mã QR mở trainer trên điện thoại" dangerouslySetInnerHTML={{ __html: info.qrSvg }} /> : null}
          <figcaption className="tiny muted">Quét bằng camera điện thoại (cùng Wi-Fi)</figcaption>
        </figure>
        <div className="stack sm tl-lan-side">
          <div className="stack sm">
            <b className="small">Địa chỉ trong mạng LAN</b>
            <ul className="tl-urls">
              {info.urls.map((u) => (
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
          <div className="row">
            <button className="btn sm" disabled={busy} onClick={rotate} title="Tạo mã mới — các thiết bị đang dùng phải quét lại">
              🔄 Đổi mã truy cập
            </button>
            <button className="btn sm danger" disabled={busy} onClick={() => void toggle(false)}>
              ⏹ Tắt truy cập LAN
            </button>
          </div>
          <div className="tiny muted">
            {info.source ? SOURCE[info.source](true) : ''}
            {info.ui === 'dist' ? ' · điện thoại nhận bản giao diện đã đóng gói (tải nhanh hơn ~4×)' : ' · điện thoại dùng dev server (chậm hơn)'}
          </div>
          {(info.devices?.length ?? 0) > 0 && (
            <div className="stack sm">
              <b className="small">Thiết bị đã dùng mã</b>
              <ul className="tl-devices">
                {info.devices!.map((d) => (
                  <li key={d.ip} className="small">
                    <span>{deviceName(d.ua)}</span> <span className="mono muted">{d.ip}</span> <span className="muted">· {fmtRelative(d.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(info.failures ?? 0) > 0 && (
            <div className="alert warn small">⚠️ Có {info.failures} lần nhập sai mã truy cập kể từ khi app khởi động. Nếu không phải bạn, bấm “Đổi mã truy cập”.</div>
          )}
        </div>
      </div>
      <Tips />
    </section>
  );
}
