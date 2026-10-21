// [v5] π HTTPS for LAN devices against real sandbox servers: server.https mkcert (openssl self-signed files in the sandbox's
// .local/certs) and tailscale (a fake `tailscale` CLI that writes an openssl certificate — the real one is never called).
// Same port for HTTP and HTTPS, Secure cookie over TLS, the certificate's names in the Host allow-list for LAN devices
// only, HTTPS URLs + QR for this machine. Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import type { LanInfo } from '../../shared/types.ts';

const T = { timeout: 120_000 };
const IP = Object.values(os.networkInterfaces())
  .flat()
  .find((a) => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))?.address;
const HOSTNAME = os.hostname().toLowerCase().replace(/\.local\.?$/, '');
const SKIP = !IP ? 'no LAN IPv4 address' : spawnSync('openssl', ['version']).status !== 0 ? 'openssl missing' : process.platform === 'win32' ? 'shell fake CLI' : false;

let sb: Sandbox;
let srv: ServerHandle;
let tsb: Sandbox;
let tsrv: ServerHandle;
let fakeDir: string;
const TS_NAME = 'trainer-mac.tail9.ts.net';

function openssl(cert: string, key: string, san: string) {
  fs.mkdirSync(path.dirname(cert), { recursive: true });
  const r = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '30', '-subj', '/CN=trainer', '-addext', `subjectAltName=${san}`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

function req(o: { tls: boolean; port: number; path: string; host?: string; servername?: string; headers?: Record<string, string>; addr?: string }): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const mod = o.tls ? https : http;
    const r = mod.request(
      { host: o.addr ?? IP, port: o.port, path: o.path, agent: false, rejectUnauthorized: false, servername: o.servername, headers: { Host: o.host ?? `${o.addr ?? IP}:${o.port}`, ...o.headers } },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      },
    );
    r.on('error', reject);
    r.end();
  });
}

async function until(fn: () => Promise<boolean>, ms: number, what: string) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timeout: ${what}`);
}

before(async () => {
  if (SKIP) return;
  sb = makeSandbox();
  openssl(path.join(sb.home, '.local', 'certs', 'lan.pem'), path.join(sb.home, '.local', 'certs', 'lan-key.pem'), `DNS:${HOSTNAME}.local,IP:${IP}`);
  fs.writeFileSync(path.join(sb.home, 'config.yaml'), fs.readFileSync(path.join(sb.home, 'config.yaml'), 'utf8').replace(/^(\s+https:\s*)off\b/m, '$1mkcert'));
  // a fake tailscale CLI: status --json → our name; cert → an openssl certificate for it, 20 days left (like the
  // cached certificate tailscale hands back until its own renewal window)
  fakeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-ts-'));
  const fake = path.join(fakeDir, 'tailscale');
  fs.writeFileSync(
    fake,
    `#!/bin/sh\necho "$@" >> "${fakeDir}/calls.log"\nif [ "$1" = status ]; then echo '{"Self":{"DNSName":"${TS_NAME}."}}'; exit 0; fi\n` +
      `if [ "$1" = cert ]; then openssl req -x509 -newkey rsa:2048 -nodes -keyout "$5" -out "$3" -days 20 -subj /CN=${TS_NAME} -addext "subjectAltName=DNS:$6" 2>/dev/null; exit $?; fi\nexit 1\n`,
  );
  fs.chmodSync(fake, 0o755);
  tsb = makeSandbox();
  fs.writeFileSync(path.join(tsb.home, 'config.yaml'), fs.readFileSync(path.join(tsb.home, 'config.yaml'), 'utf8').replace(/^(\s+https:\s*)off\b/m, '$1tailscale'));
  [srv, tsrv] = await Promise.all([startServer({ home: sb.home, env: { LAN: '1' } }), startServer({ home: tsb.home, env: { LAN: '1', TRAINER_TAILSCALE_BIN: fake } })]);
}, T);

after(async () => {
  await Promise.all([srv?.stop(), tsrv?.stop()]);
  sb?.cleanup();
  tsb?.cleanup();
  if (fakeDir) fs.rmSync(fakeDir, { recursive: true, force: true });
});

test('mkcert: HTTPS and HTTP on the same LAN port, Secure cookie over TLS, a secure context for the page', { ...T, skip: SKIP }, async () => {
  const api = apiClient(srv.base);
  const info = (await api.get<LanInfo>('/api/lan')).body;
  assert.equal(info.https?.mode, 'mkcert');
  assert.equal(info.https?.active, true, info.https?.error);
  assert.ok(info.https?.urls.includes(`https://${IP}:${srv.port}`), JSON.stringify(info.https));
  assert.ok(info.https?.urls.includes(`https://${HOSTNAME}.local:${srv.port}`));
  assert.equal(info.https?.certFile, '.local/certs/lan.pem');
  assert.ok(info.https?.tokenUrl?.startsWith(`https://`) && info.https.qrSvg?.startsWith('<svg'));
  await until(async () => /🔒 HTTPS: https:\/\//.test(srv.logs()), 20_000, 'startup banner lists the HTTPS URLs');

  assert.equal((await req({ tls: false, port: srv.port, path: '/api/meta' })).status, 401, 'plain HTTP still answers');
  assert.equal((await req({ tls: true, port: srv.port, path: '/api/meta' })).status, 401, 'HTTPS needs the code too');
  const tok = fs.readFileSync(path.join(sb.home, '.local', 'lan-token'), 'utf8').trim();
  const landing = await req({ tls: true, port: srv.port, path: `/?t=${tok}` });
  assert.equal(landing.status, 200);
  const set = String(landing.headers['set-cookie']?.[0]);
  assert.ok(set.split('; ').includes('Secure'), set);
  const cookie = set.split(';')[0];
  const meta = await req({ tls: true, port: srv.port, path: '/api/meta', headers: { Cookie: cookie } });
  assert.equal(meta.status, 200);
  assert.deepEqual({ secure: JSON.parse(meta.body).access.secure, scope: JSON.parse(meta.body).access.scope }, { secure: true, scope: 'practice' });
  const page = await req({ tls: true, port: srv.port, path: '/', headers: { Cookie: cookie } });
  assert.equal(page.status, 200, 'the built UI over HTTPS');
  assert.equal(JSON.parse((await req({ tls: false, port: srv.port, path: '/api/meta', headers: { Cookie: cookie } })).body).access.secure, false);
});

test('tailscale: the app runs `tailscale cert` for its tailnet name, serves it, allows that Host for LAN devices only', { ...T, skip: SKIP }, async () => {
  const api = apiClient(tsrv.base);
  await until(async () => !!(await api.get<LanInfo>('/api/lan')).body.https?.active, 30_000, 'tailscale certificate loaded');
  const info = (await api.get<LanInfo>('/api/lan')).body;
  assert.deepEqual(info.https?.urls, [`https://${TS_NAME}:${tsrv.port}`]);
  assert.ok(info.https?.renewedAt);
  assert.equal(info.https?.certFile, '.local/certs/tailscale.crt');
  const calls = fs.readFileSync(path.join(fakeDir, 'calls.log'), 'utf8').trim().split('\n');
  assert.equal(calls[0], 'status --json');
  assert.match(calls[1], new RegExp(`^cert --cert-file .*/\\.local/certs/tailscale\\.crt --key-file .*/\\.local/certs/tailscale\\.key ${TS_NAME.replace(/\./g, '\\.')}$`));
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(tsb.home, '.local', 'certs', 'tailscale.key')).mode & 0o777, 0o600);
  const viaName = await req({ tls: true, port: tsrv.port, path: '/api/meta', host: `${TS_NAME}:${tsrv.port}`, servername: TS_NAME });
  assert.equal(viaName.status, 401, 'tailnet name accepted from a LAN device (still needs the code)');
  const proxied = await req({ tls: false, addr: '127.0.0.1', port: tsrv.port, path: '/api/meta', host: `${TS_NAME}:${tsrv.port}` });
  assert.equal(proxied.status, 403, 'from this machine (e.g. `tailscale serve`): only localhost names');
  // [R3] no renewal loop: a certificate with 20 days left is not asked for again on every 5 s config check
  await new Promise((r) => setTimeout(r, 11_000));
  assert.equal(fs.readFileSync(path.join(fakeDir, 'calls.log'), 'utf8').trim().split('\n').filter((l) => l.startsWith('cert')).length, 1, 'one `tailscale cert` only');
  // renew on demand (this machine only)
  const renewed = await api.post<LanInfo>('/api/lan/https/renew');
  assert.equal(renewed.status, 200);
  assert.equal(fs.readFileSync(path.join(fakeDir, 'calls.log'), 'utf8').trim().split('\n').filter((l) => l.startsWith('cert')).length, 2);
});
