// [X] Sidebar footer badge: "🔒 local" normally, "📶 LAN" (link to 🧰 Công cụ) while other devices can connect.
import { useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import { href } from '../../lib/router.ts';
import type { LanInfo } from '../../../shared/types.ts';

const EVENT = 'trainer:lan';

/** The Tools page reports every LAN state it receives, so the badge follows the toggle without refetching. */
export function announceLan(info: LanInfo) {
  window.dispatchEvent(new CustomEvent<LanInfo>(EVENT, { detail: info }));
}

export function LanBadge({ host }: { host?: string }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    api
      .get<LanInfo>('/api/lan')
      .then((d) => alive && setEnabled(d.enabled))
      .catch(() => undefined);
    const on = (e: Event) => setEnabled(!!(e as CustomEvent<LanInfo>).detail?.enabled);
    window.addEventListener(EVENT, on);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, on);
    };
  }, []);
  if (enabled) {
    return (
      <a href={href('/tools')} className="tl-badge-lan" title={`Đang mở cho mạng LAN (thiết bị khác cần mã truy cập)${host ? ` · máy: ${host}` : ''}`}>
        📶 LAN
      </a>
    );
  }
  return <span title={`Chỉ chạy ở máy bạn (127.0.0.1)${host ? ` · máy: ${host}` : ''}`}>🔒 local</span>;
}
