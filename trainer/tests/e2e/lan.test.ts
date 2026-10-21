// LAN access end-to-end against real servers in sandboxes: Host allow-list, access code → cookie, 401s for devices
// without it, websocket upgrades, runtime toggle, code rotation, config.yaml changes, the production UI for LAN
// devices, and the LAN=1 startup banner. "LAN" requests go to this machine's own LAN IPv4 address, so their source
// address is that IP (not loopback) — exactly what a phone looks like to the server. Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { shouldReopen } from '../../server/lib/lan.ts';
import type { LanInfo } from '../../shared/types.ts';

const T = { timeout: 120_000 };
const IP = Object.values(os.networkInterfaces())
  .flat()
  .find((a) => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))?.address;
const HOSTNAME = os.hostname().toLowerCase().replace(/\.local\.?$/, '');
const NO_LAN = IP ? false : 'this machine has no LAN IPv4 address';

interface Raw {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/** Plain HTTP with a chosen Host header (fetch cannot set it) to `addr` — 127.0.0.1 (this machine) or the LAN IP. */
function raw(addr: string, port: number, p: string, o: { method?: string; host?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Raw> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: addr, port, path: p, method: o.method ?? 'GET', agent: false, headers: { Host: o.host ?? `${addr}:${port}`, ...o.headers } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end(o.body);
  });
}

/** Websocket handshake: resolves with 101 when upgraded, else the HTTP status the server answered with. */
function upgrade(addr: string, port: number, o: { host?: string; protocol?: string; cookie?: string } = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: addr,
      port,
      path: '/',
      agent: false,
      headers: {
        Host: o.host ?? `${addr}:${port}`,
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': Buffer.from('trainer-lan-test').toString('base64'),
        'Sec-WebSocket-Protocol': o.protocol ?? 'vite-hmr',
        ...(o.cookie ? { Cookie: o.cookie } : {}),
      },
    });
    req.on('upgrade', (res, socket) => {
      socket.destroy();
      resolve(res.statusCode ?? 0);
    });
    req.on('response', (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end();
  });
}

/** Open SSE stream from a LAN device; `closed` settles when the server drops the connection. */
function openStream(port: number, cookie: string): Promise<{ status: number; closed: Promise<void>; abort(): void }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: IP, port, path: '/api/events', agent: false, headers: { Host: `${IP}:${port}`, Cookie: cookie } }, (res) => {
      const closed = new Promise<void>((r) => {
        res.on('close', () => r());
        res.on('error', () => r());
      });
      res.resume();
      resolve({ status: res.statusCode ?? 0, closed, abort: () => req.destroy() });
    });
    req.on('error', reject);
    req.end();
  });
}

const refused = (addr: string, port: number) =>
  raw(addr, port, '/api/meta').then(
    () => false,
    (e: NodeJS.ErrnoException) => e.code === 'ECONNREFUSED',
  );

const within = <X>(p: Promise<X>, ms: number, what: string) => Promise.race([p, new Promise<never>((_, j) => setTimeout(() => j(new Error(`timeout: ${what}`)), ms))]);

async function until(fn: () => Promise<boolean>, ms: number, what: string) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timeout waiting for ${what}`);
}

let sb: Sandbox;
let srv: ServerHandle; // starts with LAN off
let api: ApiClient;
let sbEnv: Sandbox;
let srvEnv: ServerHandle; // LAN=1
const tokenFile = () => path.join(sb.home, '.local', 'lan-token');
const lanInfo = async () => (await api.get<LanInfo>('/api/lan')).body;
let cookie = '';

before(
  async () => {
    sb = makeSandbox();
    sbEnv = makeSandbox();
    [srv, srvEnv] = await Promise.all([startServer({ home: sb.home }), startServer({ home: sbEnv.home, env: { LAN: '1' } })]);
    api = apiClient(srv.base);
  },
  { timeout: 120_000 },
);

after(async () => {
  await Promise.all([srv?.stop(), srvEnv?.stop()]);
  sb?.cleanup();
  sbEnv?.cleanup();
});

test('LAN off (default): only localhost hosts, nothing listens on the LAN, no token', T, async () => {
  for (const p of ['/api/meta', '/']) {
    assert.equal((await raw('127.0.0.1', srv.port, p, { host: `evil.example:${srv.port}` })).status, 403, `foreign host ${p}`);
    if (IP) assert.equal((await raw('127.0.0.1', srv.port, p, { host: `${IP}:${srv.port}` })).status, 403, `LAN host while off ${p}`);
  }
  assert.equal((await raw('127.0.0.1', srv.port, '/api/meta', { host: `localhost:${srv.port}` })).status, 200);
  if (IP) assert.ok(await refused(IP, srv.port), 'no LAN listener');
  const info = await lanInfo();
  assert.equal(info.enabled, false);
  assert.equal(info.local, true);
  assert.deepEqual(info.urls, []);
  assert.equal(info.tokenUrl ?? info.qrSvg ?? info.token, undefined);
  assert.ok(info.hint?.includes('server.lan'));
  assert.ok(!fs.existsSync(tokenFile()), 'no token until LAN access is turned on');
  assert.equal((await raw('127.0.0.1', srv.port, '/', { host: `127.0.0.1:${srv.port}` })).status, 200, 'this machine still gets the app');
});

test('runtime toggle (this machine): LAN listener + access code, QR, token file 0600', { ...T, skip: NO_LAN }, async () => {
  const r = await api.post<LanInfo>('/api/lan', { enabled: true });
  assert.equal(r.status, 200);
  const info = r.body;
  assert.equal(info.enabled, true);
  assert.equal(info.source, 'runtime');
  assert.ok(info.urls.includes(`http://${IP}:${srv.port}`), `urls ${info.urls}`);
  assert.ok(info.urls.includes(`http://${HOSTNAME}.local:${srv.port}`));
  const tok = fs.readFileSync(tokenFile(), 'utf8').trim();
  assert.match(tok, /^[0-9a-hjkmnp-tv-z]{26}$/, '128-bit base32 token');
  if (process.platform !== 'win32') assert.equal(fs.statSync(tokenFile()).mode & 0o777, 0o600);
  assert.equal(info.tokenUrl, `${info.urls[0]}/?t=${tok}`);
  assert.ok(info.qrSvg?.startsWith('<svg'));
  assert.equal(info.token?.replace(/-/g, ''), tok);
  assert.equal((await raw(IP!, srv.port, '/api/meta')).status, 401, 'reachable from the LAN, but locked');
  assert.equal((await api.post('/api/lan', { enabled: 'yes' })).status, 400);
});

test('LAN device without the code: 401 JSON for the API, the access form for pages', { ...T, skip: NO_LAN }, async () => {
  const tok = fs.readFileSync(tokenFile(), 'utf8').trim();
  const a = await raw(IP!, srv.port, '/api/meta');
  assert.equal(a.status, 401);
  assert.match(a.headers['content-type'] ?? '', /json/);
  assert.match(JSON.parse(a.body).error, /mã truy cập/);
  const page = await raw(IP!, srv.port, '/');
  assert.equal(page.status, 401);
  assert.match(page.body, /Nhập mã truy cập/);
  assert.match(page.body, /<form method="get" action="\/"><input name="t"/);
  const post = await raw(IP!, srv.port, '/api/tests', { method: 'POST', headers: { 'X-Trainer': '1', 'Content-Type': 'application/json' }, body: '{"mode":"quick"}' });
  assert.equal(post.status, 401);
  const lan = await raw(IP!, srv.port, '/api/lan');
  assert.equal(lan.status, 401);
  for (const x of [a, page, post, lan]) assert.ok(!x.body.includes(tok), 'never leaks the token');
});

test('wrong code → 401 without a cookie (counted for this machine)', { ...T, skip: NO_LAN }, async () => {
  const r = await raw(IP!, srv.port, '/?t=abcde-fghjk-mnpqr-stvwx-yz0123');
  assert.equal(r.status, 401);
  assert.equal(r.headers['set-cookie'], undefined);
  assert.match(r.body, /không đúng/);
  assert.ok(((await lanInfo()).failures ?? 0) >= 1);
});

test('right code (QR link or typed) → a token of its own in an HttpOnly SameSite=Strict cookie for 30 days, redirect without the code', { ...T, skip: NO_LAN }, async () => {
  const tok = fs.readFileSync(tokenFile(), 'utf8').trim();
  const typed = (await lanInfo()).token!.toUpperCase(); // grouped + upper case, as someone would type it
  const r = await raw(IP!, srv.port, `/?x=1&t=${encodeURIComponent(typed)}`);
  assert.equal(r.status, 200);
  const set = String(r.headers['set-cookie']?.[0] ?? '');
  assert.match(set, new RegExp(`^trainer_lan_${srv.port}=[0-9a-z]{8}\\.[A-Za-z0-9_-]{22}; `), 'per-device token <id>.<secret>');
  assert.ok(!set.includes('Secure'), 'plain HTTP: no Secure attribute');
  for (const attr of ['Path=/', 'Max-Age=2592000', 'HttpOnly', 'SameSite=Strict']) assert.ok(set.split('; ').includes(attr), `${attr} in ${set}`);
  assert.ok(!set.includes(tok), 'the cookie is not the token');
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.equal(r.headers['referrer-policy'], 'no-referrer');
  assert.ok(r.body.includes('location.replace("/?x=1" + location.hash)'), 'client-side redirect to the same URL without t');
  assert.ok(!r.body.includes(tok) && !r.body.toLowerCase().includes(typed.toLowerCase()), 'the page does not echo the code');
  cookie = set.split(';')[0];
});

test('with the cookie: app + API work; token, QR and controls stay on this machine', { ...T, skip: NO_LAN }, async () => {
  assert.ok(cookie, 'cookie from the previous step');
  const C = { Cookie: cookie };
  assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: C })).status, 200);
  assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: C, host: `${HOSTNAME}.local:${srv.port}` })).status, 200, '<host>.local');
  assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: C, host: `evil.example:${srv.port}` })).status, 403, 'DNS rebinding');
  assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: C, host: `${IP}:1` })).status, 403, 'other port');
  const tampered = cookie.slice(0, -1) + (cookie.endsWith('A') ? 'B' : 'A');
  assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: tampered } })).status, 401);
  assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: cookie.replace(`trainer_lan_${srv.port}`, 'trainer_lan_1') } })).status, 401, 'cookie of another instance');

  const info = JSON.parse((await raw(IP!, srv.port, '/api/lan', { headers: C })).body) as LanInfo;
  assert.equal(info.enabled, true);
  assert.equal(info.local, false);
  for (const k of ['tokenUrl', 'qrSvg', 'token', 'devices', 'failures'] as const) assert.equal(info[k], undefined, `${k} not sent to LAN devices`);

  const json = { ...C, 'Content-Type': 'application/json' };
  assert.equal((await raw(IP!, srv.port, '/api/tests', { method: 'POST', headers: json, body: '{"mode":"quick"}' })).status, 403, 'X-Trainer rule still applies');
  assert.equal((await raw(IP!, srv.port, '/api/tests', { method: 'POST', headers: { ...json, 'X-Trainer': '1' }, body: '{"mode":"quick"}' })).status, 200);
  for (const [p, body] of [
    ['/api/lan/rotate', '{}'],
    ['/api/lan', '{"enabled":false}'],
  ]) {
    const r = await raw(IP!, srv.port, p, { method: 'POST', headers: { ...json, 'X-Trainer': '1' }, body });
    assert.equal(r.status, 403, `${p} is for this machine only`);
  }
  const local = await lanInfo();
  assert.ok(local.devices?.some((d) => d.ip === IP), 'device listed for this machine');
});

test('[v5] practice scope: LAN devices study, admin routes answer 403 with the reason; /api/meta says so', { ...T, skip: NO_LAN }, async () => {
  const C = { Cookie: cookie };
  const json = { ...C, 'Content-Type': 'application/json', 'X-Trainer': '1' };
  for (const [method, p, body] of [
    ['POST', '/api/sync', '{}'],
    ['POST', '/api/coach/run', '{"task":"analyze"}'],
    ['POST', '/api/ask', '{}'],
    ['POST', '/api/fsrs/optimize', '{}'],
    ['GET', '/api/coach', undefined],
    ['GET', '/api/sync/status', undefined],
    ['GET', '/api/snapshot', undefined],
    ['GET', '/api/export/anki/status', undefined],
  ] as const) {
    const r = await raw(IP!, srv.port, p, { method, headers: method === 'GET' ? C : json, body });
    assert.equal(r.status, 403, `${method} ${p}`);
    const b = JSON.parse(r.body);
    assert.equal(b.scope, 'admin');
    assert.match(b.error, /chỉ có quyền luyện tập/);
  }
  for (const [p, body] of [
    ['/api/lan/admin', '{"enabled":true}'],
    ['/api/lan/devices/x/revoke', '{}'],
  ]) {
    const r = await raw(IP!, srv.port, p, { method: 'POST', headers: json, body });
    assert.equal(r.status, 403, `${p} is for this machine only`);
    assert.equal(JSON.parse(r.body).scope, 'local');
  }
  assert.equal((await raw(IP!, srv.port, '/api/counts', { method: 'POST', headers: json, body: '{}' })).status, 200, 'practice POST');
  for (const p of ['/api/stats', '/api/progress', '/api/plans', '/api/search?q=s3']) assert.equal((await raw(IP!, srv.port, p, { headers: C })).status, 200, `GET ${p}`);
  const meta = JSON.parse((await raw(IP!, srv.port, '/api/meta', { headers: C })).body);
  assert.deepEqual({ local: meta.access.local, scope: meta.access.scope, lanAdmin: meta.access.lanAdmin, secure: meta.access.secure }, { local: false, scope: 'practice', lanAdmin: false, secure: false });
  assert.equal(typeof JSON.parse((await raw(IP!, srv.port, '/api/meta', { headers: C })).body).claude.available, 'boolean', '[R3] cached Claude status only (no probe for LAN clients)');
  const mine = (await api.get('/api/meta')).body;
  assert.equal(mine.access.scope, 'local');
  assert.equal(mine.access.secure, true);
  const info = JSON.parse((await raw(IP!, srv.port, '/api/lan', { headers: C })).body) as LanInfo;
  assert.equal(info.scope, 'practice');
  assert.ok(info.device?.current && info.device.id === cookie.split('=')[1].split('.')[0], 'the device sees its own entry');
  assert.equal(info.paired, undefined, 'no device list for LAN devices');
});

test('[v5] server.lan_admin toggle (this machine only): LAN devices may use admin routes until it is turned off', { ...T, skip: NO_LAN }, async () => {
  const C = { Cookie: cookie };
  const on = await api.post<LanInfo>('/api/lan/admin', { enabled: true });
  assert.equal(on.status, 200);
  assert.deepEqual(on.body.admin, { enabled: true, source: 'runtime' });
  assert.equal((await raw(IP!, srv.port, '/api/coach', { headers: C })).status, 200, 'admin GET allowed now');
  assert.equal(JSON.parse((await raw(IP!, srv.port, '/api/meta', { headers: C })).body).access.scope, 'admin');
  const json = { ...C, 'Content-Type': 'application/json', 'X-Trainer': '1' };
  assert.equal((await raw(IP!, srv.port, '/api/lan/rotate', { method: 'POST', headers: json, body: '{}' })).status, 403, 'LAN access itself stays local-only');
  assert.equal((await api.post('/api/lan/admin', { enabled: 'yes' })).status, 400);
  const off = await api.post<LanInfo>('/api/lan/admin', { enabled: false });
  assert.deepEqual(off.body.admin, { enabled: false, source: 'off' });
  assert.equal((await raw(IP!, srv.port, '/api/coach', { headers: C })).status, 403);
});

test('[v5] paired devices: listed for this machine, revoked one by one (open streams close), expired ones refused', { ...T, skip: NO_LAN }, async () => {
  const tok = fs.readFileSync(tokenFile(), 'utf8').trim();
  const devFile = path.join(sb.home, '.local', 'lan-devices.json');
  if (process.platform !== 'win32') assert.equal(fs.statSync(devFile).mode & 0o777, 0o600);
  const stored = fs.readFileSync(devFile, 'utf8');
  assert.ok(!stored.includes(cookie.split('.')[1]), 'only a hash of the secret is stored');
  // a second device (another user agent)
  const second = await raw(IP!, srv.port, `/?t=${tok}`, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1' } });
  const cookie2 = String(second.headers['set-cookie']?.[0]).split(';')[0];
  const id2 = cookie2.split('=')[1].split('.')[0];
  // scanning again on a paired device keeps its entry
  const again = await raw(IP!, srv.port, `/?t=${tok}`, { headers: { Cookie: cookie2 } });
  assert.equal(again.status, 200);
  assert.equal(again.headers['set-cookie'], undefined, 'no new token for a paired device');
  let info = (await api.get<LanInfo>('/api/lan')).body;
  const entry = info.paired?.find((d) => d.id === id2);
  assert.equal(entry?.name, 'iPhone · Safari');
  assert.ok(entry && Date.parse(entry.expires) - Date.parse(entry.created) === 30 * 86_400_000, '30-day expiry');
  assert.equal(info.paired?.filter((d) => d.id === id2).length, 1);
  // rename
  info = (await api.post<LanInfo>(`/api/lan/devices/${id2}`, { name: 'Điện thoại của tôi' })).body;
  assert.equal(info.paired?.find((d) => d.id === id2)?.name, 'Điện thoại của tôi');
  // revoke closes its open stream, the other device keeps working
  const stream = await openStream(srv.port, cookie2);
  assert.equal(stream.status, 200);
  info = (await api.post<LanInfo>(`/api/lan/devices/${id2}/revoke`)).body;
  assert.ok(info.paired?.find((d) => d.id === id2)?.revoked);
  await within(stream.closed, 5000, 'revoked device stream closed');
  const refused = await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: cookie2 } });
  assert.equal(refused.status, 401);
  assert.match(JSON.parse(refused.body).error, /thu hồi/);
  assert.match((await raw(IP!, srv.port, '/', { headers: { Cookie: cookie2 } })).body, /thu hồi/, 'the page says why');
  assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: cookie } })).status, 200, 'other device unaffected');
  assert.equal((await api.post(`/api/lan/devices/${id2}/revoke`)).status, 404, 'already revoked');
  // [R3] a malformed %-escape is a client error (the gate answers 404 for the path; route params are checked again → 400)
  for (const [m, p] of [['POST', '/api/lan/devices/%E0%A4%A/revoke'], ['GET', '/api/results/%zz'], ['POST', '/api/lan/devices/%/x']] as const) {
    const st = (m === 'GET' ? await api.get(p) : await api.post(p)).status;
    assert.ok(st === 400 || st === 404, `${m} ${p} → ${st}`);
  }
  // expiry (the file is the source of truth: an entry past its date is refused)
  const third = await raw(IP!, srv.port, `/?t=${tok}`);
  const cookie3 = String(third.headers['set-cookie']?.[0]).split(';')[0];
  const id3 = cookie3.split('=')[1].split('.')[0];
  assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: cookie3 } })).status, 200);
  const data = JSON.parse(fs.readFileSync(devFile, 'utf8'));
  for (const d of data.devices) if (d.id === id3) d.expires = new Date(Date.now() - 1000).toISOString();
  fs.writeFileSync(devFile, JSON.stringify(data));
  const expired = await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: cookie3 } });
  assert.equal(expired.status, 401);
  assert.match(JSON.parse(expired.body).error, /hết hạn/);
});

test('[v5] pre-v5 cookie (HMAC of the code) still works as the "legacy" device and is swapped for a token of its own on a page load', { ...T, skip: NO_LAN }, async () => {
  const tok = fs.readFileSync(tokenFile(), 'utf8').trim();
  const legacy = `trainer_lan_${srv.port}=${crypto.createHmac('sha256', tok).update('trainer-lan-cookie-v1').digest('base64url')}`;
  const apiCall = await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: legacy } });
  assert.equal(apiCall.status, 200, 'API calls of an open page keep working');
  assert.equal(apiCall.headers['set-cookie'], undefined, 'no upgrade on API calls (a burst would mint several devices)');
  const page = await raw(IP!, srv.port, '/', { headers: { Cookie: legacy, Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' } });
  assert.equal(page.status, 200);
  const upgraded = String(page.headers['set-cookie']?.[0] ?? '');
  assert.match(upgraded, new RegExp(`^trainer_lan_${srv.port}=[0-9a-z]{8}\\.[A-Za-z0-9_-]{22}; `));
  const info = (await api.get<LanInfo>('/api/lan')).body;
  const entry = info.paired?.find((d) => d.legacy);
  assert.ok(entry, 'legacy entry listed');
  await api.post(`/api/lan/devices/${entry!.id}/revoke`);
  assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: legacy } })).status, 401, 'revoking the legacy entry refuses every old cookie');
  assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: upgraded.split(';')[0] } })).status, 200, 'the upgraded device keeps its own token');
});

test('LAN devices get the production build (gzip, immutable assets); this machine keeps the dev server', { ...T, skip: NO_LAN }, async () => {
  const page = await raw(IP!, srv.port, '/', { headers: { Cookie: cookie } });
  assert.equal(page.status, 200);
  const asset = /src="(\/assets\/[^"]+\.js)"/.exec(page.body)?.[1];
  assert.ok(asset, 'built index.html');
  assert.ok(!page.body.includes('/web/main.tsx'));
  const js = await raw(IP!, srv.port, asset!, { headers: { Cookie: cookie, 'Accept-Encoding': 'gzip' } });
  assert.equal(js.status, 200);
  assert.equal(js.headers['content-encoding'], 'gzip');
  assert.match(js.headers['cache-control'] ?? '', /immutable/);
  assert.equal((await raw(IP!, srv.port, asset!)).status, 401, 'assets need the cookie too');
  const local = await raw('127.0.0.1', srv.port, '/');
  assert.ok(local.body.includes('/web/main.tsx'), 'dev server (HMR) on this machine');
  // with the build in place the dev server (sources, node_modules, /@fs) is not reachable from the network at all
  for (const p of ['/@vite/client', '/web/main.tsx', '/server/config.ts', '/node_modules/react/package.json', `/@fs${path.join(sb.home, 'config.yaml')}`]) {
    assert.equal((await raw(IP!, srv.port, p, { headers: { Cookie: cookie } })).status, 404, `${p} not served to LAN devices`);
  }
  // [R3] other methods never reach a file server, whatever the path (dev server POST leak)
  for (const p of ['/config.yaml', '/results/sealed.md', '/coach/COACH.md', '/server/lib/lan.ts', '/']) {
    const r = await raw(IP!, srv.port, p, { method: 'POST', headers: { Cookie: cookie }, body: 'x' });
    assert.equal(r.status, 405, `POST ${p}`);
    assert.ok(r.body.length < 100, 'no file content');
  }
});

test('websocket upgrades (Vite HMR) pass the same gate', { ...T, skip: NO_LAN }, async () => {
  assert.equal(await upgrade('127.0.0.1', srv.port), 101, 'this machine');
  assert.equal(await upgrade('127.0.0.1', srv.port, { host: `evil.example:${srv.port}` }), 403);
  assert.equal(await upgrade(IP!, srv.port), 401, 'LAN without the cookie');
  assert.equal(await upgrade(IP!, srv.port, { cookie }), 101, 'LAN with the cookie');
  assert.equal(await upgrade(IP!, srv.port, { protocol: 'vite-ping' }), 101, 'liveness ping (lets an expired page reload into the form)');
  assert.equal(await upgrade(IP!, srv.port, { cookie, host: `evil.example:${srv.port}` }), 403);
});

test('DNS rebinding: from this machine only localhost / 127.0.0.1 count — never its LAN names', { ...T, skip: NO_LAN }, async () => {
  const tok = fs.readFileSync(tokenFile(), 'utf8').trim();
  const json = { 'X-Trainer': '1', 'Content-Type': 'application/json' };
  for (const host of [`${HOSTNAME}.local:${srv.port}`, `${HOSTNAME}:${srv.port}`, `${IP}:${srv.port}`]) {
    const info = await raw('127.0.0.1', srv.port, '/api/lan', { host });
    assert.equal(info.status, 403, `GET /api/lan with Host ${host}`);
    assert.ok(!info.body.includes(tok));
    assert.equal((await raw('127.0.0.1', srv.port, '/api/lan/rotate', { method: 'POST', host, headers: json, body: '{}' })).status, 403, `rotate with Host ${host}`);
    assert.equal((await raw('127.0.0.1', srv.port, '/', { host })).status, 403, `page with Host ${host}`);
    assert.equal(await upgrade('127.0.0.1', srv.port, { host }), 403, `upgrade with Host ${host}`);
  }
  assert.equal(fs.readFileSync(tokenFile(), 'utf8').trim(), tok, 'not rotated');
  // a LAN device may use the IP or <host>.local (with the cookie) — not the bare host name, not localhost
  assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: cookie }, host: `${HOSTNAME}:${srv.port}` })).status, 403);
  assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: cookie }, host: `localhost:${srv.port}` })).status, 403);
});

test('secrets are never served (token, caches, git, env) — any case or encoding, any client; no CORS', { ...T, skip: NO_LAN }, async () => {
  const tok = fs.readFileSync(tokenFile(), 'utf8').trim();
  const paths = ['/.local/lan-token', '/.local/lan-token?raw', '/.LOCAL/lan-token', '/%2elocal/lan-token', '/web/%2e%2e/.local/lan-token', '/.local%5clan-token', `/@fs${tokenFile()}`, `/@fs${tokenFile()}?raw`, '/.cache/trainer.db', '/.git/config', '/.env'];
  const origin = { Origin: 'http://localhost:5555' }; // a page on another localhost port
  for (const p of paths) {
    const local = await raw('127.0.0.1', srv.port, p, { host: `localhost:${srv.port}`, headers: origin });
    assert.ok([403, 404].includes(local.status), `${p} from this machine → ${local.status}`);
    const lan = await raw(IP!, srv.port, p, { headers: { Cookie: cookie } });
    assert.ok([403, 404].includes(lan.status), `${p} from a LAN device → ${lan.status}`);
    assert.ok(!local.body.includes(tok) && !lan.body.includes(tok), `${p} never returns the token`);
  }
  for (const p of ['/web/main.tsx', '/index.html', '/api/meta']) {
    const r = await raw('127.0.0.1', srv.port, p, { host: `localhost:${srv.port}`, headers: origin });
    assert.equal(r.status, 200, p);
    assert.equal(r.headers['access-control-allow-origin'], undefined, `${p}: no Access-Control-Allow-Origin`);
  }
});

test('rejected upgrades are closed: no half-open sockets, no hanging pings, no crash on reset', { ...T, skip: NO_LAN }, async () => {
  const handshake = (p: string, protocol: string) =>
    `GET ${p} HTTP/1.1\r\nHost: ${IP}:${srv.port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Protocol: ${protocol}\r\n\r\n`;
  // a client that never closes its side: the server still drops the socket (a later write is answered with a reset)
  const half = net.connect({ port: srv.port, host: IP, allowHalfOpen: true }, () => half.write(handshake('/', 'vite-hmr')));
  let answer = '';
  half.on('data', (b: Buffer) => (answer += b.toString()));
  const dropped = new Promise<void>((resolve) => {
    half.on('close', () => resolve());
    half.on('error', () => resolve());
  });
  await new Promise((r) => setTimeout(r, 2600)); // past the 2 s destroy timer
  assert.match(answer, /^HTTP\/1\.1 401/);
  // the first write draws a reset from the closed server side, a following one fails (the client no longer reads)
  const poke = setInterval(() => half.writable && half.write('still there?'), 200);
  try {
    await within(dropped, 3000, 'server-side socket of a rejected upgrade is gone');
  } finally {
    clearInterval(poke);
    half.destroy();
  }
  // liveness pings are only answered on "/" — elsewhere they are closed at once instead of hanging
  const ping = net.connect(srv.port, IP!, () => ping.write(handshake('/nope', 'vite-ping')));
  ping.on('error', () => undefined);
  ping.resume();
  await within(new Promise<void>((r) => ping.on('close', () => r())), 3000, 'ping on /nope closed');
  // clients resetting right after the handshake must not take the server down (unhandled socket 'error')
  for (let i = 0; i < 60; i++) {
    const s = net.connect(srv.port, IP!, () => {
      s.write(handshake(i % 2 ? '/' : '/x', i % 3 ? 'vite-hmr' : 'other'));
      setImmediate(() => s.resetAndDestroy());
    });
    s.on('error', () => undefined);
  }
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal(srv.proc.exitCode, null, 'server process alive');
  assert.equal((await api.get('/api/meta')).status, 200);
});

test('no open redirect after a valid code', { ...T, skip: NO_LAN }, async () => {
  const tok = fs.readFileSync(tokenFile(), 'utf8').trim();
  for (const p of [`/.//evil.example/x?t=${tok}`, `//evil.example/?t=${tok}`, `/\\evil.example/?t=${tok}`, `/%2F%2Fevil.example/?t=${tok}`]) {
    const r = await raw(IP!, srv.port, p);
    assert.equal(r.status, 200, p);
    const target = JSON.parse(/location\.replace\(("[^"]*")/.exec(r.body)?.[1] ?? '""') as string;
    assert.ok(target.startsWith('/') && !/^\/[/\\]/.test(target), `${p} → ${target}`);
    assert.equal(new URL(target, 'http://trainer.test').host, 'trainer.test', `${p} stays on this origin`);
  }
});

test('per-address mode re-opens when the addresses change — also after a failed attempt (no network yet)', () => {
  const s = { enabled: false, wildcard: false, want: true, failed: true, attemptedFor: '' as string | undefined, current: '192.168.1.5' };
  assert.equal(shouldReopen(s), true, 'started before the network was up → retry once an address appears');
  assert.equal(shouldReopen({ ...s, current: '' }), false, 'nothing changed');
  assert.equal(shouldReopen({ ...s, attemptedFor: undefined }), false, 'never attempted');
  assert.equal(shouldReopen({ ...s, failed: false }), false, 'turned off on purpose');
  assert.equal(shouldReopen({ ...s, want: false }), false, 'not wanted');
  assert.equal(shouldReopen({ ...s, enabled: true, failed: false, attemptedFor: '10.0.0.2', current: '' }), true, 'Wi-Fi gone: per-address listeners follow');
  assert.equal(shouldReopen({ ...s, enabled: true, failed: false, attemptedFor: '10.0.0.2', current: '10.0.0.2' }), false);
  assert.equal(shouldReopen({ ...s, enabled: true, wildcard: true, failed: false, attemptedFor: '10.0.0.2', current: '10.0.0.3' }), false, '0.0.0.0 covers new addresses');
});

test('rotating the code signs every LAN device out (open streams are closed)', { ...T, skip: NO_LAN }, async () => {
  const before = fs.readFileSync(tokenFile(), 'utf8').trim();
  const stream = await openStream(srv.port, cookie);
  assert.equal(stream.status, 200);
  const r = await api.post<LanInfo>('/api/lan/rotate');
  assert.equal(r.status, 200);
  await within(stream.closed, 5000, 'SSE stream closed after rotation');
  const after = fs.readFileSync(tokenFile(), 'utf8').trim();
  assert.notEqual(after, before);
  assert.equal(r.body.token?.replace(/-/g, ''), after);
  assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: cookie } })).status, 401, 'old cookie rejected');
  assert.equal((await raw(IP!, srv.port, `/?t=${before}`)).status, 401, 'old code rejected');
  const fresh = await raw(IP!, srv.port, `/?t=${after}`);
  assert.equal(fresh.status, 200);
  cookie = String(fresh.headers['set-cookie']?.[0]).split(';')[0];
  assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: cookie } })).status, 200);
});

test('turning LAN access off closes the listener and open LAN connections', { ...T, skip: NO_LAN }, async () => {
  const stream = await openStream(srv.port, cookie);
  const r = await api.post<LanInfo>('/api/lan', { enabled: false });
  assert.equal(r.body.enabled, false);
  await within(stream.closed, 5000, 'SSE stream closed after disabling');
  assert.ok(await refused(IP!, srv.port));
  assert.equal((await raw('127.0.0.1', srv.port, '/api/meta', { host: `${IP}:${srv.port}` })).status, 403, 'LAN host names dropped from the allow-list');
  assert.equal((await api.get('/api/meta')).status, 200, 'this machine unaffected');
});

test('config.yaml server.lan takes effect while running (and ends the page toggle)', { ...T, skip: NO_LAN }, async () => {
  const cfgFile = path.join(sb.home, 'config.yaml');
  const original = fs.readFileSync(cfgFile, 'utf8');
  assert.match(original, /\n {2}lan: false/);
  try {
    fs.writeFileSync(cfgFile, original.replace(/\n {2}lan: false/, '\n  lan: true'));
    await until(async () => (await lanInfo()).enabled, 15_000, 'LAN on from config.yaml');
    const info = await lanInfo();
    assert.equal(info.source, 'config');
    assert.equal(info.configured, true);
    assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: cookie } })).status, 200, 'same code as before');
  } finally {
    fs.writeFileSync(cfgFile, original);
  }
  await until(async () => !(await lanInfo()).enabled, 15_000, 'LAN off again');
  assert.ok(await refused(IP!, srv.port));
});

test('0.0.0.0 taken → one listener per LAN address (the Linux path, forced here)', { ...T, skip: NO_LAN }, async (t) => {
  assert.equal((await lanInfo()).enabled, false, 'LAN off after the previous step');
  // Something else on 0.0.0.0:<port> that answers 418. Linux refuses this bind next to the app's 127.0.0.1 listener —
  // there the normal steps above already ran through the per-address fallback.
  const squatter = net.createServer((s) => s.end('HTTP/1.1 418 Teapot\r\nContent-Length: 0\r\nConnection: close\r\n\r\n'));
  const took = await new Promise<boolean>((resolve) => {
    squatter.once('error', () => resolve(false));
    squatter.listen(srv.port, '0.0.0.0', () => resolve(true));
  });
  if (!took) return t.skip('this OS does not allow 0.0.0.0 next to 127.0.0.1 on one port');
  try {
    const info = (await api.post<LanInfo>('/api/lan', { enabled: true })).body;
    assert.equal(info.enabled, true, info.error);
    assert.ok(info.urls.includes(`http://${IP}:${srv.port}`));
    assert.equal((await raw(IP!, srv.port, '/api/meta')).status, 401, 'the specific address wins over the squatter');
    assert.equal((await raw(IP!, srv.port, '/api/meta', { headers: { Cookie: cookie } })).status, 200);
    // the 5 s interface check must not rebind (which would drop every LAN connection)
    const stream = await openStream(srv.port, cookie);
    let dropped = false;
    void stream.closed.then(() => (dropped = true));
    await new Promise((r) => setTimeout(r, 6500));
    assert.equal(dropped, false, 'stable listeners in per-address mode');
    stream.abort();
  } finally {
    await api.post('/api/lan', { enabled: false });
    await new Promise<void>((r) => squatter.close(() => r()));
  }
});

test('LAN=1 at startup: listener up, banner lists the URLs, the token never reaches the logs', { ...T, skip: NO_LAN }, async () => {
  const envApi = apiClient(srvEnv.base);
  const info = (await envApi.get<LanInfo>('/api/lan')).body;
  assert.equal(info.enabled, true);
  assert.equal(info.source, 'env');
  const tok = fs.readFileSync(path.join(sbEnv.home, '.local', 'lan-token'), 'utf8').trim();
  const logs = srvEnv.logs();
  assert.ok(logs.includes(`📱 LAN: http://${IP}:${srvEnv.port}`), logs);
  assert.ok(!logs.includes(tok), 'no QR / token in non-terminal output');
  assert.equal((await raw(IP!, srvEnv.port, '/api/meta')).status, 401);
  assert.notEqual(tok, fs.existsSync(tokenFile()) ? fs.readFileSync(tokenFile(), 'utf8').trim() : '', 'one token per data folder');
  // back off at runtime → source 'runtime'
  const off = (await envApi.post<LanInfo>('/api/lan', { enabled: false })).body;
  assert.deepEqual({ enabled: off.enabled, source: off.source }, { enabled: false, source: 'runtime' });
  assert.ok(await refused(IP!, srvEnv.port));
});
