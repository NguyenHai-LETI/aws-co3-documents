// [v5] π HTTPS helpers (server/lib/lan-https.ts): config modes, certificate files, SAN parsing, certificate checks with
// openssl self-signed certificates in a temp folder, monthly renewal rule, tailscale arguments. Nothing is installed.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import * as h from '../server/lib/lan-https.ts';

const HAS_OPENSSL = spawnSync('openssl', ['version']).status === 0;

/** Self-signed certificate for `san` valid `days` days (negative = already expired is not possible with -days; use fake clock). */
function selfSigned(dir: string, san: string, name = 'lan'): { cert: string; key: string } {
  const cert = path.join(dir, `${name}.pem`);
  const key = path.join(dir, `${name}-key.pem`);
  const r = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '2', '-subj', '/CN=trainer.test', '-addext', `subjectAltName=${san}`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return { cert, key };
}

test('modes and file locations', () => {
  assert.equal(h.httpsModeOf('mkcert'), 'mkcert');
  assert.equal(h.httpsModeOf('tailscale'), 'tailscale');
  for (const v of ['off', false, '', undefined, 'yes']) assert.equal(h.httpsModeOf(v), 'off');
  assert.deepEqual(h.certFiles('mkcert', {}, '/data'), { cert: '/data/.local/certs/lan.pem', key: '/data/.local/certs/lan-key.pem' });
  assert.deepEqual(h.certFiles('mkcert', { https_cert: 'certs/a.pem', https_key: '/abs/a-key.pem' }, '/data'), { cert: '/data/certs/a.pem', key: '/abs/a-key.pem' });
  assert.deepEqual(h.certFiles('tailscale', { https_cert: 'ignored' }, '/data'), { cert: '/data/.local/certs/tailscale.crt', key: '/data/.local/certs/tailscale.key' });
  assert.deepEqual(h.tailscaleCertArgs('mac.tail1.ts.net', '/c.crt', '/c.key'), ['cert', '--cert-file', '/c.crt', '--key-file', '/c.key', 'mac.tail1.ts.net']);
  assert.deepEqual(h.parseSan('DNS:Mac.local, IP Address:192.168.1.5, DNS:mac.tail1.ts.net., email:x@y, IP Address:fe80::1'), { dns: ['mac.local', 'mac.tail1.ts.net'], ips: ['192.168.1.5', 'fe80::1'] });
});

test('[R3] renewal: only when missing or ending within 14 days (tailscale returns its cached certificate before that)', () => {
  const now = new Date('2026-10-20T00:00:00Z');
  const day = 86_400_000;
  assert.equal(h.needsRenewal(undefined, now), true);
  assert.equal(h.needsRenewal({ validTo: new Date(now.getTime() + 85 * day) }, now), false);
  assert.equal(h.needsRenewal({ validTo: new Date(now.getTime() + 20 * day) }, now), false, 'a cached cert with 20 days left does not loop');
  assert.equal(h.needsRenewal({ validTo: new Date(now.getTime() + 13 * day) }, now), true);
});

test('readCert: loads a matching pair, explains missing files, a wrong key and an expired certificate', { skip: HAS_OPENSSL ? false : 'openssl missing' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-cert-'));
  try {
    const a = selfSigned(dir, 'DNS:mac.local,IP:192.168.1.5', 'a');
    const r = h.readCert(a.cert, a.key, new Date());
    assert.equal(r.error, undefined);
    assert.deepEqual(r.cert!.dns, ['mac.local']);
    assert.deepEqual(r.cert!.ips, ['192.168.1.5']);
    assert.ok(r.cert!.validTo.getTime() > Date.now());
    assert.match(h.readCert(path.join(dir, 'none.pem'), a.key).error!, /Chưa có chứng chỉ/);
    assert.match(h.readCert(a.cert, path.join(dir, 'none.pem')).error!, /Chưa có khoá riêng/);
    const b = selfSigned(dir, 'DNS:x.local', 'b');
    assert.match(h.readCert(a.cert, b.key).error!, /không khớp/);
    assert.match(h.readCert(a.cert, a.key, new Date(Date.now() + 10 * 86_400_000)).error!, /hết hạn/);
    fs.writeFileSync(path.join(dir, 'junk.pem'), 'junk');
    assert.match(h.readCert(path.join(dir, 'junk.pem'), a.key).error!, /Không đọc được/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('sniff: TLS by the first byte on one port, plain HTTP otherwise', { skip: HAS_OPENSSL ? false : 'openssl missing' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-sniff-'));
  const a = selfSigned(dir, 'DNS:trainer.test,IP:127.0.0.1');
  const ctx = h.readCert(a.cert, a.key).cert!.context;
  const seen: string[] = [];
  const server = net.createServer((s) =>
    h.sniff(
      s,
      () => ctx,
      (p) => p.once('data', (d) => (seen.push(`plain:${d.toString()[0]}`), p.end('plain'))), // the peeked byte comes back first
      (t) => t.once('data', (d) => (seen.push(`tls:${d.toString()}`), t.end('secure'))),
    ),
  );
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as net.AddressInfo).port;
  try {
    const plain = await new Promise<string>((resolve) => {
      const c = net.connect(port, '127.0.0.1', () => c.write('GET / HTTP/1.0\r\n\r\n'));
      let out = '';
      c.on('data', (d) => (out += d));
      c.on('end', () => resolve(out));
    });
    assert.equal(plain, 'plain');
    const secure = await new Promise<string>((resolve, reject) => {
      const c = tls.connect({ port, host: '127.0.0.1', servername: 'trainer.test', ca: fs.readFileSync(a.cert) }, () => c.write('hello'));
      let out = '';
      c.on('data', (d) => (out += d));
      c.on('end', () => resolve(out));
      c.on('error', reject);
    });
    assert.equal(secure, 'secure', 'the certificate verifies against its own CA');
    assert.deepEqual(seen, ['plain:G', 'tls:hello']);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
