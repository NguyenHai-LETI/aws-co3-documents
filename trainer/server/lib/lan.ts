// LAN access (opt-in: config server.lan, `npm start -- --lan`, LAN=1, or the 🧰 Công cụ toggle): a second listener on
// the local network so a phone on the same Wi-Fi can use the app. This machine (loopback) works exactly as before.
// Every other device needs the access token: first visit /?t=<token> (the QR code) → HttpOnly SameSite=Strict cookie
// (30 days) → the normal app; without it, API → 401 JSON and pages → a small "Nhập mã truy cập" form. The token is
// 128 random bits in .local/lan-token (git-ignored, per machine), compared in constant time, and only ever shown to
// loopback clients (Tools page, terminal QR when stdout is a terminal) — never to LAN devices, never in logs.
import crypto from 'node:crypto';
import fs from 'node:fs';
import type http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { Duplex } from 'node:stream';
import QRCode from 'qrcode';
import { CONFIG_FILE, DATA_DIR, PORT, loadConfig } from '../config.ts';
import { isLocalRequest, json } from '../http.ts';
import { ensureLanUi, lanUiMode } from './lan-ui.ts';
import type { LanInfo, LanSource } from '../../shared/types.ts';

export const LAN_TOKEN_FILE = path.join(DATA_DIR, '.local', 'lan-token');
export const LAN_COOKIE = `trainer_lan_${PORT}`; // per port: two instances on one machine keep separate sessions
const COOKIE_DAYS = 30;
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'; // Crockford base32 — no i/l/o/u, easy to read off a screen
const ACCESS_HINT = 'Cần mã truy cập — trên máy chạy app mở 🧰 Công cụ → 📱 Mở trên điện thoại, quét mã QR rồi tải lại trang.';

let app: http.Server | undefined; // the app's server — LAN connections are handed to it
let listeners: net.Server[] = [];
let bound: string[] = []; // ['0.0.0.0'] or one address per interface (when the OS refuses the wildcard next to 127.0.0.1)
let attemptFor: string | undefined; // LAN addresses at the last attempt to open the listeners (undefined: none yet)
const sockets = new Set<net.Socket>(); // LAN connections (closed on disable / token change)
let enabled = false;
let override: boolean | undefined; // Tools page toggle — until a restart or a config.yaml server.lan change
let listenError: string | undefined;
let token: { value: string; mtimeMs: number } | undefined;
const devices = new Map<string, { at: number; ua?: string }>();
let failures = 0;
let cfgSeen: { mtimeMs: number; lan: boolean } | undefined;
let timer: NodeJS.Timeout | undefined;
let chain: Promise<void> = Promise.resolve();

// ── token & cookie ──────────────────────────────────────────────────────────

/** 128 random bits as 26 base32 characters. */
export function newToken(): string {
  let out = '';
  let acc = 0;
  let bits = 0;
  for (const b of crypto.randomBytes(16)) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(acc >>> bits) & 31];
    }
    acc &= (1 << bits) - 1;
  }
  if (bits) out += ALPHABET[(acc << (5 - bits)) & 31];
  return out;
}

/** Typed codes: case, spaces and dashes ignored; i/l read as 1, o as 0 (Crockford). */
export function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[il]/g, '1')
    .replace(/o/g, '0')
    .replace(/[^0-9a-z]/g, '');
}

/** "abcde-fghjk-mnpqr-stvwx-yz0123" — groups of 5, a short tail joins the last group. */
export function formatToken(t: string): string {
  const groups = t.match(/.{1,5}/g) ?? [];
  if (groups.length > 1 && groups[groups.length - 1].length < 3) groups[groups.length - 2] += groups.pop();
  return groups.join('-');
}

function writeToken(): string {
  const value = newToken();
  fs.mkdirSync(path.dirname(LAN_TOKEN_FILE), { recursive: true, mode: 0o700 });
  fs.writeFileSync(LAN_TOKEN_FILE, value + '\n', { mode: 0o600 });
  try {
    fs.chmodSync(LAN_TOKEN_FILE, 0o600);
  } catch {
    // Windows: permissions are ACL-based
  }
  token = { value, mtimeMs: fs.statSync(LAN_TOKEN_FILE).mtimeMs };
  return value;
}

/** Current token (re-read when the file changes); `create` makes one when missing or too short to be safe. */
function readToken(create: boolean): string | undefined {
  try {
    const st = fs.statSync(LAN_TOKEN_FILE);
    if (token?.mtimeMs === st.mtimeMs) return token.value;
    const value = normalizeToken(fs.readFileSync(LAN_TOKEN_FILE, 'utf8'));
    if (value.length >= 20) {
      token = { value, mtimeMs: st.mtimeMs };
      return value;
    }
  } catch {
    // no token yet
  }
  token = undefined;
  return create ? writeToken() : undefined;
}

function cookieValue(tok: string): string {
  return crypto.createHmac('sha256', tok).update('trainer-lan-cookie-v1').digest('base64url');
}

/** Constant-time comparison of two secrets of any length (hash both, compare the digests). */
function sameSecret(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function readCookie(req: http.IncomingMessage): string | undefined {
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === LAN_COOKIE) return part.slice(i + 1).trim();
  }
  return undefined;
}

function hasValidCookie(req: http.IncomingMessage): boolean {
  const tok = readToken(false);
  const c = readCookie(req);
  return !!tok && !!c && sameSecret(c, cookieValue(tok));
}

// ── addresses & hosts ───────────────────────────────────────────────────────

function hostBase(): string {
  return os
    .hostname()
    .toLowerCase()
    .replace(/\.local\.?$/, '');
}

/**
 * The name LAN devices may use besides the IPs: Bonjour/mDNS `<host>.local` (also given to Vite's host check). The bare
 * host name is not accepted — it resolves through search domains / LLMNR / NetBIOS, which are easy to spoof.
 */
export function lanHostNames(): string[] {
  return [`${hostBase()}.local`];
}

let addrCache: { at: number; list: string[] } | undefined;
/** Non-internal IPv4 addresses, Wi-Fi / Ethernet first (the QR code uses the first one). */
export function lanAddresses(): string[] {
  if (addrCache && Date.now() - addrCache.at < 5000) return addrCache.list;
  const rank = (name: string) =>
    /^(en0|en1|eth\d|wlan\d|wl|wi-?fi|ethernet)/i.test(name) ? 0 : /^(bridge|docker|veth|vmnet|vbox|utun|tun|tap|awdl|llw|zt|tailscale|wg)/i.test(name) ? 2 : 1;
  const found: { ip: string; r: number }[] = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) found.push({ ip: a.address, r: rank(name) });
    }
  }
  const list = [...new Set(found.sort((x, y) => x.r - y.r).map((x) => x.ip))];
  addrCache = { at: Date.now(), list };
  return list;
}

/** Addresses LAN devices can actually reach (all of them with the wildcard listener, else the bound ones). */
function reachable(): string[] {
  return bound.includes('0.0.0.0') ? lanAddresses() : bound;
}

export function lanUrls(): string[] {
  return [...reachable().map((ip) => `http://${ip}:${PORT}`), `http://${hostBase()}.local:${PORT}`];
}

/**
 * Host header allow-list (DNS-rebinding defence). This machine (loopback peer): only localhost / 127.0.0.1 — a page
 * that gets one of the LAN names rebound to 127.0.0.1 must not pass for "this machine". LAN devices: only while LAN
 * access is on, and only `<host>.local` or an address they can reach (they still need the cookie).
 */
export function hostAllowed(hostHeader: string | undefined, local: boolean): boolean {
  const host = (hostHeader ?? '').toLowerCase();
  if (local) return host === `localhost:${PORT}` || host === `127.0.0.1:${PORT}`;
  if (!enabled) return false;
  const i = host.lastIndexOf(':');
  if (i < 0 || host.slice(i + 1) !== String(PORT)) return false;
  const name = host.slice(0, i);
  return lanHostNames().includes(name) || reachable().includes(name);
}

// ── enable / disable ────────────────────────────────────────────────────────

function envLan(): boolean | undefined {
  const v = (process.env.LAN ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return undefined;
}

function configuredLan(): boolean {
  try {
    return loadConfig().server?.lan === true;
  } catch {
    return false;
  }
}

/** Without the Tools page toggle: --lan > LAN=1/0 > config.yaml server.lan. */
function natural(): { on: boolean; source: LanSource } {
  if (process.argv.includes('--lan')) return { on: true, source: 'cli' };
  const env = envLan();
  if (env !== undefined) return { on: env, source: 'env' };
  return configuredLan() ? { on: true, source: 'config' } : { on: false, source: 'off' };
}

function desired(): { on: boolean; source: LanSource } {
  return override !== undefined ? { on: override, source: 'runtime' } : natural();
}

function listenOn(address: string): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const s = net.createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      if (app) app.emit('connection', socket);
      else socket.destroy();
    });
    s.once('error', reject);
    s.listen(PORT, address, () => {
      s.off('error', reject);
      s.on('error', (e) => console.error('LAN listener error', e));
      resolve(s);
    });
  });
}

async function openListeners(): Promise<void> {
  try {
    listeners = [await listenOn('0.0.0.0')];
    bound = ['0.0.0.0'];
    return;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== 'EADDRINUSE' && code !== 'EADDRNOTAVAIL') throw e;
  }
  // Linux (and some Windows setups) refuse 0.0.0.0 next to our own 127.0.0.1 listener on the same port.
  const opened: net.Server[] = [];
  const ok: string[] = [];
  let last: unknown = new Error('Không tìm thấy địa chỉ mạng LAN (máy đã kết nối Wi-Fi / Ethernet chưa?)');
  for (const ip of lanAddresses()) {
    try {
      opened.push(await listenOn(ip));
      ok.push(ip);
    } catch (e) {
      last = e;
    }
  }
  if (!opened.length) throw last;
  listeners = opened;
  bound = ok;
}

function dropConnections() {
  for (const s of sockets) s.destroy();
  sockets.clear();
}

function closeListeners() {
  for (const s of listeners) s.close();
  listeners = [];
  bound = [];
  dropConnections();
}

/**
 * Re-open the LAN listeners because this machine's addresses changed since the last attempt? Per-address listeners
 * follow the interfaces (0.0.0.0 covers new ones by itself); a failed attempt (no network yet at startup, Wi-Fi gone in
 * per-address mode) is retried on the new addresses. Pure — exported for tests.
 */
export function shouldReopen(s: { enabled: boolean; wildcard: boolean; want: boolean; failed: boolean; attemptedFor: string | undefined; current: string }): boolean {
  if (s.attemptedFor === undefined || s.attemptedFor === s.current) return false;
  if (s.enabled) return !s.wildcard;
  return s.want && s.failed;
}

function addressesChanged(): boolean {
  const current = lanAddresses().join();
  if (attemptFor === undefined || attemptFor === current) return false; // cheap exit before reading config.yaml
  return shouldReopen({ enabled, wildcard: bound.includes('0.0.0.0'), want: desired().on, failed: listenError !== undefined, attemptedFor: attemptFor, current });
}

function describe(e: unknown): string {
  const code = (e as NodeJS.ErrnoException).code;
  if (code === 'EADDRINUSE') return `cổng ${PORT} trên mạng LAN đang bị chương trình khác dùng`;
  if (code === 'EACCES' || code === 'EPERM') return `không có quyền mở cổng ${PORT} trên mạng LAN`;
  return (e as Error).message;
}

/** Brings the listeners in line with the desired state (serialized: toggles, config changes, interface changes). */
function applyLan(announce = true): Promise<void> {
  chain = chain
    .then(async () => {
      const want = desired().on;
      if (want && addressesChanged()) {
        closeListeners(); // rebind below on the new addresses
        enabled = false;
      }
      if (want && !enabled) {
        attemptFor = lanAddresses().join();
        try {
          readToken(true);
          await openListeners();
          enabled = true;
          listenError = undefined;
          void ensureLanUi(); // warm the phone build in the background
          if (announce) console.log(`  📱 LAN: ${lanUrls().join(' · ')} — thiết bị khác cần mã truy cập (🧰 Công cụ)`);
        } catch (e) {
          listenError = describe(e);
          if (announce) console.error(`  ✗ LAN: ${listenError}`);
        }
      } else if (!want && enabled) {
        closeListeners();
        enabled = false;
        console.log('  📱 LAN: đã tắt — chỉ máy này truy cập được');
      } else if (!want) {
        listenError = undefined;
      }
    })
    .catch((e) => console.error('LAN apply failed', e));
  return chain;
}

/** A config.yaml `server.lan` edit takes effect within seconds (and ends a Tools page override). */
function checkConfig() {
  let mtimeMs = -1;
  try {
    mtimeMs = fs.statSync(CONFIG_FILE).mtimeMs;
  } catch {
    // no config file → defaults
  }
  if (cfgSeen?.mtimeMs !== mtimeMs) {
    const lan = configuredLan();
    const changed = cfgSeen !== undefined && cfgSeen.lan !== lan;
    cfgSeen = { mtimeMs, lan };
    if (changed) {
      override = undefined;
      void applyLan();
      return;
    }
  }
  if (addressesChanged()) void applyLan();
}

/** Called once the app listens on 127.0.0.1: opens the LAN listener when enabled and watches config.yaml. */
export async function startLan(server: http.Server): Promise<void> {
  app = server;
  checkConfig();
  await applyLan(false); // the startup banner (lanBanner) prints the outcome
  timer ??= setInterval(checkConfig, 5000);
  timer.unref();
}

export function stopLan() {
  if (timer) clearInterval(timer);
  timer = undefined;
  closeListeners();
  enabled = false;
}

export function lanEnabled(): boolean {
  return enabled;
}

/** Tools page toggle (this machine only). Lasts until a restart or a config.yaml server.lan change. */
export async function setLanEnabled(on: boolean): Promise<void> {
  override = on === natural().on ? undefined : on;
  await applyLan();
}

/** New token: every LAN device (page, SSE stream, HMR socket) is disconnected and must scan the new QR code. */
export function rotateLanToken(): void {
  writeToken();
  dropConnections();
  devices.clear();
  failures = 0;
}

// ── request gate ────────────────────────────────────────────────────────────

const PAGE_STYLE =
  ":root{color-scheme:light dark;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
  'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f4f1;color:#0b0b0b}' +
  'main{box-sizing:border-box;width:calc(100% - 32px);max-width:400px;margin:24px 16px;padding:24px;border-radius:14px;background:#fcfcfb;border:1px solid rgba(11,11,11,.1)}' +
  'h1{font-size:20px;margin:0 0 8px}p{color:#52514e;line-height:1.5;margin:8px 0}form{display:flex;gap:8px;margin-top:16px}' +
  'input{flex:1;min-width:0;font:15px ui-monospace,Menlo,Consolas,monospace;padding:10px 12px;border-radius:9px;border:1px solid rgba(11,11,11,.2);background:#fff;color:inherit}' +
  'button{font:inherit;font-weight:600;padding:10px 16px;border-radius:9px;border:0;background:#2a78d6;color:#fff}.err{color:#b3261e}' +
  '@media (prefers-color-scheme:dark){body{background:#0d0d0d;color:#f0efec}main{background:#1a1a19;border-color:rgba(255,255,255,.1)}p{color:#c3c2b7}input{background:#232321;border-color:rgba(255,255,255,.2)}.err{color:#ef7d7d}}';

function shell(title: string, body: string, head = ''): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${title}</title>${head}<style>${PAGE_STYLE}</style></head><body><main>${body}</main></body></html>`;
}

function loginPage(error?: string): string {
  return shell(
    'Nhập mã truy cập · SAA-C03 Trainer',
    '<h1>🔐 Nhập mã truy cập</h1><p>Trainer đang mở cho mạng LAN. Trên máy chạy app, mở <b>🧰 Công cụ → 📱 Mở trên điện thoại</b> rồi quét mã QR bằng camera — hoặc nhập mã hiển thị ở đó.</p>' +
      (error ? `<p class="err">${error}</p>` : '') +
      '<form method="get" action="/"><input name="t" placeholder="xxxxx-xxxxx-xxxxx-xxxxx-xxxxxx" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Mã truy cập" required><button type="submit">Mở</button></form>',
  );
}

function sendPage(res: http.ServerResponse, status: number, html: string, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(html);
}

function remember(req: http.IncomingMessage) {
  const ip = (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
  devices.delete(ip);
  devices.set(ip, { at: Date.now(), ua: String(req.headers['user-agent'] ?? '').slice(0, 200) || undefined });
  if (devices.size > 12) devices.delete(devices.keys().next().value as string);
}

/**
 * First visit with the token (QR code / typed into the form): cookie + client-side redirect to the same URL without
 * `t`. Not a 302: a SameSite=Strict cookie set during a redirect chain that started on another site (chat app, mail)
 * is not sent on the redirected request — a same-origin navigation from this page always carries it.
 */
function landing(req: http.IncomingMessage, res: http.ServerResponse, url: URL, typed: string) {
  const tok = readToken(false);
  if (!tok || !sameSecret(normalizeToken(typed), tok)) {
    failures++;
    sendPage(res, 401, loginPage('Mã truy cập không đúng hoặc đã được đổi — xem lại trên máy chạy app.'));
    return;
  }
  remember(req);
  const next = new URL(url.href);
  next.searchParams.delete('t');
  const target = '/' + (next.pathname + next.search).replace(/^\/+/, ''); // "//evil.example" would leave the origin
  const js = JSON.stringify(target).replace(/</g, '\\u003c');
  const attr = target.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  sendPage(
    res,
    200,
    shell('SAA-C03 Trainer', `<h1>✅ Đã xác nhận thiết bị</h1><p>Đang mở trainer…</p><script>location.replace(${js} + location.hash)</script>`, `<noscript><meta http-equiv="refresh" content="0;url=${attr}"></noscript>`),
    { 'Set-Cookie': `${LAN_COOKIE}=${cookieValue(tok)}; Path=/; Max-Age=${COOKIE_DAYS * 86_400}; HttpOnly; SameSite=Strict` },
  );
}

/** Never served to anyone (whatever the case or %-encoding): the access token, caches, git internals, env files. */
const SECRET_PATH = /(^|\/)(\.local|\.cache|\.git|\.ssh|\.env[^/]*)(\/|$)/i;
/** LAN devices get no dot-files at all, except Vite's pre-bundled dependencies (node_modules/.vite, LAN_UI=dev). */
const LAN_DOT_PATH = /(^|\/)\.(?!vite(\/|$))[^/]*/i;

function forbiddenPath(pathname: string, local: boolean): boolean {
  let p: string;
  try {
    p = decodeURIComponent(pathname).replace(/\\/g, '/');
  } catch {
    return true;
  }
  return SECRET_PATH.test(p) || (!local && LAN_DOT_PATH.test(p));
}

/** Path of an upgrade request ('' when unparsable). Vite answers its HMR socket and ping on "/" only. */
export function upgradePath(req: http.IncomingMessage): string {
  try {
    return new URL(req.url ?? '/', 'http://localhost').pathname;
  } catch {
    return '';
  }
}

/** Runs before every HTTP request; false = already answered (403 foreign host, 404 secret path, 401 no access code, token landing). */
export function gateRequest(req: http.IncomingMessage, res: http.ServerResponse, url: URL): boolean {
  const api = url.pathname.startsWith('/api/');
  const local = isLocalRequest(req);
  if (!hostAllowed(req.headers.host, local)) {
    if (api) json(res, 403, { error: 'Forbidden host' });
    else sendPage(res, 403, shell('403', '<h1>403</h1><p>Host không được phép.</p>'));
    return false;
  }
  if (forbiddenPath(url.pathname, local)) {
    if (api) json(res, 404, { error: 'Not found' });
    else sendPage(res, 404, shell('404', '<h1>404</h1>'));
    return false;
  }
  if (local) return true;
  if (!enabled) {
    // a connection accepted before LAN access was turned off
    if (api) json(res, 403, { error: 'LAN access is off' });
    else sendPage(res, 403, shell('403', '<h1>📴 Đã tắt truy cập LAN</h1><p>Bật lại trên máy chạy app (🧰 Công cụ).</p>'));
    return false;
  }
  const typed = url.searchParams.get('t');
  if (typed !== null && !api && (req.method === 'GET' || req.method === 'HEAD')) {
    landing(req, res, url, typed);
    return false;
  }
  if (hasValidCookie(req)) {
    remember(req);
    return true;
  }
  if (api) json(res, 401, { error: ACCESS_HINT });
  else sendPage(res, 401, loginPage());
  return false;
}

/**
 * Same rules for websocket upgrades (Vite HMR); false = answered and closed. After an upgrade Node applies no timeouts,
 * so a rejected socket is destroyed once the answer is written (and after 2 s at the latest) — a client that never
 * closes its side cannot keep it open.
 */
export function gateUpgrade(req: http.IncomingMessage, socket: Duplex): boolean {
  const reject = (status: string) => {
    socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`, () => socket.destroy());
    setTimeout(() => socket.destroy(), 2000).unref();
    return false;
  };
  const local = isLocalRequest(req);
  if (!hostAllowed(req.headers.host, local) || forbiddenPath(upgradePath(req) || '/', local)) return reject('403 Forbidden');
  if (local) return true;
  if (!enabled) return reject('403 Forbidden');
  // Vite's liveness ping on "/" opens and closes at once — it lets a page whose session ended reload into the form.
  if (req.headers['sec-websocket-protocol'] === 'vite-ping' && upgradePath(req) === '/') return true;
  return hasValidCookie(req) || reject('401 Unauthorized');
}

// ── info & banner ───────────────────────────────────────────────────────────

/** `GET /api/lan`: status for everyone; token, QR, devices and controls only for this machine. */
export async function lanInfo(req: http.IncomingMessage): Promise<LanInfo> {
  const local = isLocalRequest(req);
  const d = desired();
  const info: LanInfo = { enabled, urls: enabled ? lanUrls() : [], local, source: d.source, configured: configuredLan(), ui: lanUiMode() };
  if (listenError && d.on) info.error = listenError;
  if (!enabled) info.hint = 'Bật ở đây (đến khi khởi động lại app), hoặc lâu dài: server.lan: true trong config.yaml · npm start -- --lan · LAN=1 npm start';
  if (!local || !enabled) return info;
  const tok = readToken(true)!;
  const primary = info.urls[0];
  info.tokenUrl = `${primary}/?t=${tok}`;
  info.qrSvg = await QRCode.toString(info.tokenUrl, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
  info.token = formatToken(tok);
  info.devices = [...devices.entries()].reverse().map(([ip, v]) => ({ ip, at: new Date(v.at).toISOString(), ua: v.ua }));
  info.failures = failures;
  return info;
}

/** Startup lines: LAN URLs always; the QR code (it carries the token) only on an interactive terminal, never in logs. */
export async function lanBanner(): Promise<string> {
  if (!enabled) return listenError ? `     📱 LAN: ✗ ${listenError}\n` : '';
  const urls = lanUrls();
  let s = `     📱 LAN: ${urls.join(' · ')}\n        thiết bị khác cần mã truy cập — quét QR (🧰 Công cụ trên máy này)\n`;
  if (process.stdout.isTTY) {
    const qr = await QRCode.toString(`${urls[0]}/?t=${readToken(true)}`, { type: 'terminal', small: true });
    s += `\n     Quét bằng camera điện thoại (cùng Wi-Fi):\n${qr.replace(/^/gm, '     ')}\n`;
  }
  return s;
}
