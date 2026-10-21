// [v5] π LAN least privilege: every registered API route has an explicit scope (practice / admin / local), and the
// scope rules hold. Route modules are imported against an empty temp data folder (nothing real is read). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-scope-'));
process.env.TRAINER_HOME = home;
const { routes } = await import('../server/http.ts');
const scope = await import('../server/lib/lan-scope.ts');
for (const f of fs.readdirSync(path.join(import.meta.dirname, '..', 'server', 'routes')).filter((f) => f.endsWith('.ts')).sort()) {
  await import(`../server/routes/${f}`);
}

test('every registered route is classified (practice / admin / local)', () => {
  assert.ok(routes.length > 50, `routes registered: ${routes.length}`);
  const missing = routes.filter((r) => !scope.isClassified(r.method, r.pattern)).map((r) => `${r.method} ${r.pattern}`);
  assert.deepEqual(missing, [], `add these to server/lib/lan-scope.ts:\n${missing.join('\n')}`);
  const registered = new Set(routes.map((r) => scope.routeKey(r.method, r.pattern)));
  const stale = scope.classifiedKeys().filter((k) => !registered.has(k));
  if (stale.length) console.log(`# classified but not registered (yet): ${stale.join(' · ')}`);
});

test('the spec lists: practice writes, admin areas, local-only LAN controls', () => {
  for (const k of ['POST /api/tests', 'POST /api/counts', 'POST /api/results', 'POST /api/results/:id/why', 'POST /api/results/:id/retry', 'POST /api/ratings', 'POST /api/issues', 'PUT /api/active', 'DELETE /api/active', 'POST /api/leeches/:id', 'POST /api/goal', 'POST /api/plan/sprint', 'POST /api/onboarding/plan', 'POST /api/listen/finish', 'POST /api/micro/answer']) {
    const [m, p] = k.split(' ');
    assert.equal(scope.routeScope(m, p), 'practice', k);
  }
  for (const k of ['POST /api/coach/run', 'POST /api/ask', 'POST /api/tutor/start', 'POST /api/notebook/update', 'POST /api/sync', 'POST /api/restart', 'POST /api/verify/run', 'POST /api/fsrs/optimize', 'POST /api/quality/semantic', 'POST /api/quality/retire', 'POST /api/sealed/create', 'POST /api/external', 'POST /api/export/anki', 'GET /api/snapshot', 'GET /api/sync/status', 'GET /api/coach', 'GET /api/export/anki/status']) {
    const [m, p] = k.split(' ');
    assert.equal(scope.routeScope(m, p), 'admin', k);
  }
  for (const k of ['POST /api/lan', 'POST /api/lan/rotate', 'POST /api/lan/admin', 'POST /api/lan/devices/:id/revoke']) {
    const [m, p] = k.split(' ');
    assert.equal(scope.routeScope(m, p), 'local', k);
  }
  assert.equal(scope.routeScope('GET', '/api/lan'), 'practice', 'status only (the badge on phones)');
  assert.equal(scope.routeScope('GET', '/api/results/:x'), 'practice', 'param names do not matter');
});

test('unlisted routes: read-only GET → practice, admin areas and every write → admin, LAN writes → local', () => {
  assert.equal(scope.routeScope('GET', '/api/something/new'), 'practice');
  assert.equal(scope.routeScope('GET', '/api/coach/new-thing'), 'admin');
  assert.equal(scope.routeScope('GET', '/api/tutor/x'), 'admin');
  assert.equal(scope.routeScope('POST', '/api/something/new'), 'admin');
  assert.equal(scope.routeScope('DELETE', '/api/something'), 'admin');
  assert.equal(scope.routeScope('POST', '/api/lan/new'), 'local');
});

test('who may call what', () => {
  assert.equal(scope.scopeAllows('local', 'local'), true);
  assert.equal(scope.scopeAllows('admin', 'local'), true);
  assert.equal(scope.scopeAllows('practice', 'practice'), true);
  assert.equal(scope.scopeAllows('admin', 'practice'), false);
  assert.equal(scope.scopeAllows('admin', 'admin'), true);
  assert.equal(scope.scopeAllows('local', 'admin'), false, 'LAN controls never from a LAN device');
  assert.match(scope.scopeRefusal('admin'), /quyền luyện tập/);
  assert.match(scope.scopeRefusal('local'), /máy chạy app/);
});

process.on('exit', () => fs.rmSync(home, { recursive: true, force: true }));

test('[R3] route params: a malformed %-escape is detected (400), a valid one decodes', async () => {
  const { decodable, decodeParam } = await import('../server/http.ts');
  assert.equal(decodable('a%20b'), true);
  assert.equal(decodable('%E0%A4%A'), false);
  assert.equal(decodeParam('a%20b'), 'a b');
  assert.throws(() => decodeParam('%zz'), (e: Error & { status?: number }) => e.status === 400);
});
