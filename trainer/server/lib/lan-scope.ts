// [v5] π LAN least privilege: which API routes a device on the local network may call.
//   practice — studying: build / submit tests, why / retry notes, ratings, issues, the active-test mirror, leeches, goal,
//              plans, listen, micro — and every GET that only reads.
//   admin    — AI runs and the tutor, sync / restart, verification, the FSRS optimizer, quality jobs, sealed forms,
//              external scores, Anki (AnkiConnect), snapshot writes, and the GETs that start work (git fetch, Claude CLI
//              probe, AnkiConnect, snapshot rebuild). LAN devices get 403 + a Vietnamese reason unless server.lan_admin
//              (config.yaml, or the 🧰 Công cụ toggle on this machine).
//   local    — LAN access itself (toggle, access code, paired devices, the admin toggle, certificates): this machine only,
//              whatever server.lan_admin says.
// This machine (loopback) may call everything. Every registered route has an entry here (tests/lan-scope.test.ts lists
// the ones missing); a route without one falls back to practice for a GET outside the admin areas, admin otherwise.
import type { LanScope } from '../../shared/types.ts';

export type RouteScope = 'practice' | 'admin' | 'local';

/** `METHOD /pattern` with every `:param` written as `:` (owners name their params differently). */
export function routeKey(method: string, pattern: string): string {
  return `${method.toUpperCase()} ${pattern.replace(/:\w+/g, ':')}`;
}

const PRACTICE_GET = [
  // core & content (read)
  '/api/meta', '/api/bank', '/api/issues', '/api/notes', '/api/note', '/api/file', '/api/search', '/api/update',
  // learning (read)
  '/api/state', '/api/results', '/api/results/:', '/api/stats', '/api/plans', '/api/plans/:', '/api/progress', '/api/sealed',
  // quality & AI (read only: status, logs, verdicts)
  '/api/quality', '/api/quality/lint', '/api/quality/semantic', '/api/ratings', '/api/verify', '/api/enrich/status', '/api/qa/:',
  '/api/coach/undo-info',
  // LAN status (token, QR and devices are only sent to this machine)
  '/api/lan',
  // [v5] today · leeches · active test · pairs · notebook · listen · micro · exam guide
  '/api/today', '/api/leeches', '/api/active', '/api/pairs', '/api/pairs/compare', '/api/notebook', '/api/listen/next',
  '/api/micro/next', '/api/micro/status', '/api/exam-guide', '/api/tutor',
];

/** GETs that start work or reach outside the app: git fetch, the Claude CLI probe, AnkiConnect, a snapshot rebuild. */
const ADMIN_GET = ['/api/snapshot', '/api/sync/status', '/api/coach', '/api/coach/runs/:', '/api/export/anki/status'];

const PRACTICE_WRITE = [
  'POST /api/tests', 'POST /api/counts', 'POST /api/results', 'POST /api/results/:/why', 'POST /api/results/:/retry',
  'POST /api/ratings', 'POST /api/issues', 'PUT /api/active', 'DELETE /api/active', 'POST /api/leeches/:', 'POST /api/goal',
  'POST /api/plan/sprint', 'POST /api/onboarding/plan', 'POST /api/listen/finish', 'POST /api/micro/answer',
];

const ADMIN_WRITE = [
  'POST /api/coach/run', 'POST /api/coach/cancel', 'POST /api/coach/runs/:/undo', 'POST /api/ask', 'POST /api/snapshot',
  'POST /api/sync', 'POST /api/restart', 'POST /api/verify/run', 'POST /api/verify/decision', 'POST /api/fsrs/optimize',
  'POST /api/quality/semantic', 'POST /api/quality/retire', 'POST /api/sealed/release', 'POST /api/sealed/create',
  'POST /api/external', 'POST /api/external/:/delete', 'POST /api/export/anki', 'POST /api/export/anki/import',
  'POST /api/notebook/update', 'POST /api/notebook/delete', 'POST /api/notebook/merge', 'POST /api/tutor/start', 'POST /api/tutor/turn',
  'POST /api/tutor/end',
];

const LOCAL_WRITE = ['POST /api/lan', 'POST /api/lan/rotate', 'POST /api/lan/admin', 'POST /api/lan/devices/:', 'POST /api/lan/devices/:/revoke', 'POST /api/lan/https/renew'];

const TABLE = new Map<string, RouteScope>([
  ...PRACTICE_GET.map((p) => [routeKey('GET', p), 'practice'] as const),
  ...ADMIN_GET.map((p) => [routeKey('GET', p), 'admin'] as const),
  ...PRACTICE_WRITE.map((k) => [routeKey(k.split(' ')[0], k.split(' ')[1]), 'practice'] as const),
  ...ADMIN_WRITE.map((k) => [routeKey(k.split(' ')[0], k.split(' ')[1]), 'admin'] as const),
  ...LOCAL_WRITE.map((k) => [routeKey(k.split(' ')[0], k.split(' ')[1]), 'local'] as const),
]);

/** Areas where an unlisted route is admin even for a GET (AI, tutor, sync, verification, Anki, LAN, sealed forms …). */
const ADMIN_AREAS = /^\/api\/(coach|tutor|ask|sync|restart|verify\/|fsrs|sealed\/|external|export|lan|snapshot|quality\/(semantic|retire)|notebook\/(update|delete|merge))(\/|$)/;

/** Has this route an explicit entry? (tests/lan-scope.test.ts: every registered route must.) */
export function isClassified(method: string, pattern: string): boolean {
  return TABLE.has(routeKey(method, pattern));
}

/** Scope of a registered route (method + pattern as passed to `route()`). */
export function routeScope(method: string, pattern: string): RouteScope {
  const known = TABLE.get(routeKey(method, pattern));
  if (known) return known;
  if (/^\/api\/lan(\/|$)/.test(pattern) && method.toUpperCase() !== 'GET') return 'local';
  return method.toUpperCase() === 'GET' && !ADMIN_AREAS.test(pattern) ? 'practice' : 'admin';
}

/** May a client with this access level call a route of this scope? */
export function scopeAllows(route: RouteScope, client: LanScope): boolean {
  if (client === 'local') return true;
  if (route === 'local') return false;
  return route === 'practice' || client === 'admin';
}

/** Vietnamese 403 reason for a LAN device. */
export function scopeRefusal(route: RouteScope): string {
  return route === 'local'
    ? 'Chỉ thao tác được trên máy chạy app (bật / tắt LAN, mã truy cập, thiết bị, quyền quản trị).'
    : '🔒 Thiết bị trong mạng LAN chỉ có quyền luyện tập — AI, đồng bộ, kiểm duyệt câu hỏi và cài đặt chỉ dùng trên máy chạy app. ' +
        'Cần dùng từ điện thoại: trên máy chạy app mở 🧰 Công cụ → 📱 Mở trên điện thoại → bật “Cho phép quản trị từ điện thoại”.';
}

/** Every classified key (tests: entries that match no registered route are reported, not failed). */
export function classifiedKeys(): string[] {
  return [...TABLE.keys()];
}
