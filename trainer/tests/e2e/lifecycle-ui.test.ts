// [v5] π Production UI on this machine (`npm start` = TRAINER_UI dist, the default outside test sandboxes): the built
// index.html with the manifest, lazy page chunks, the service worker and icons, immutable hashed assets, no Vite dev
// server (no /@vite/client, no HMR socket), and /api/meta `access`. The build is made once per sandbox (~0.3–1 s).
// Run: npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type Sandbox, type ServerHandle } from '../helpers/server.ts';

const T = { timeout: 120_000 };
let sb: Sandbox;
let srv: ServerHandle;

function get(p: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: srv.port, path: p, agent: false, headers: { Host: `127.0.0.1:${srv.port}`, ...headers } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

before(async () => {
  sb = makeSandbox();
  srv = await startServer({ home: sb.home, env: { TRAINER_UI: 'dist' } });
}, T);

after(async () => {
  await srv?.stop();
  sb?.cleanup();
});

test('this machine gets the production build: manifest, lazy chunks, service worker, immutable assets', T, async () => {
  const page = await get('/');
  assert.equal(page.status, 200);
  assert.equal(page.headers['cache-control'], 'no-cache');
  assert.ok(!page.body.includes('/web/main.tsx') && !page.body.includes('/@vite/client'), 'not the dev server');
  assert.match(page.body, /<link rel="manifest" href="\/manifest\.webmanifest">/);
  const entry = /src="(\/assets\/index-[^"]+\.js)"/.exec(page.body)?.[1];
  assert.ok(entry, 'built entry script');
  const js = await get(entry!, { 'Accept-Encoding': 'gzip' });
  assert.equal(js.status, 200);
  assert.match(js.headers['cache-control'] ?? '', /immutable/);
  assert.equal(js.headers['content-encoding'], 'gzip');
  const assets = fs.readdirSync(path.join(sb.home, '.cache', 'lan-ui', 'assets'));
  for (const name of ['Bank', 'Coach', 'Stats', 'Tools', 'Notes']) assert.ok(assets.some((a) => a.startsWith(`${name}-`)), `lazy chunk for ${name}`);
  const manifest = await get('/manifest.webmanifest');
  assert.equal(manifest.status, 200);
  assert.match(manifest.headers['content-type'] ?? '', /application\/manifest\+json/);
  const m = JSON.parse(manifest.body);
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some((i: { sizes: string }) => i.sizes === '512x512') && m.icons.some((i: { sizes: string }) => i.sizes === '192x192'));
  for (const icon of ['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png']) {
    const r = await get(icon);
    assert.equal(r.status, 200, icon);
    assert.equal(r.headers['content-type'], 'image/png');
  }
  const sw = await get('/sw.js');
  assert.equal(sw.status, 200);
  assert.equal(sw.headers['cache-control'], 'no-cache', 'the service worker is always revalidated');
  assert.match(sw.body, /startsWith\('\/api\/'\)/, 'never caches the API');
  for (const p of ['/@vite/client', '/web/main.tsx', '/node_modules/react/package.json', '/server/config.ts']) assert.equal((await get(p)).status, 404, `${p} not served in dist mode`);
  // [R3] no other method reaches a file server (the Vite dev server answered POSTs with raw files)
  for (const p of ['/config.yaml', '/results/sealed.md', '/coach/COACH.md', '/server/lib/lan.ts', '/', '/index.html']) {
    const r = await new Promise<number>((resolve, reject) => {
      const q = http.request({ host: '127.0.0.1', port: srv.port, path: p, method: 'POST', agent: false, headers: { Host: `127.0.0.1:${srv.port}` } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      q.on('error', reject);
      q.end('x');
    });
    assert.equal(r, 405, `POST ${p}`);
  }
  assert.ok(!/vite/i.test(srv.logs()), 'the dev server was never started');
  const stamp = fs.readFileSync(path.join(sb.home, '.cache', 'lan-ui', '.source-stamp'), 'utf8');
  assert.match(stamp, /^\d+:[0-9a-f]{16}$/);
});

test('/api/meta access (this machine, dist) and no HMR socket without a dev server', T, async () => {
  const meta = (await apiClient(srv.base).get('/api/meta')).body;
  assert.deepEqual(meta.access, { local: true, scope: 'local', lanAdmin: false, ui: 'dist', secure: true });
  const status = await new Promise<number>((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: srv.port,
      path: '/',
      agent: false,
      headers: { Host: `127.0.0.1:${srv.port}`, Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Protocol': 'vite-hmr' },
    });
    req.on('upgrade', (_res, socket) => {
      socket.destroy();
      resolve(101);
    });
    req.on('response', (res) => resolve(res.statusCode ?? 0));
    req.on('error', () => resolve(0)); // socket destroyed: refused
    req.end();
    setTimeout(() => reject(new Error('upgrade hung')), 5000).unref();
  });
  assert.notEqual(status, 101, 'no HMR in dist mode');
  assert.ok(!/vite/i.test(srv.logs().split('\n').filter((l) => /error/i.test(l)).join('\n')), srv.logs());
});
