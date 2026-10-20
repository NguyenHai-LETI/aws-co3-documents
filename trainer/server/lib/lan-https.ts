// [v5] π HTTPS for LAN devices (config server.https). The LAN listener keeps its one port: a connection that starts with
// a TLS handshake is served over HTTPS with the configured certificate, anything else stays plain HTTP. This machine
// (127.0.0.1, a secure context already) never needs it.
//   mkcert    — certificate files you made yourself (server.https_cert / https_key, default .local/certs/lan.pem +
//               lan-key.pem): `mkcert -cert-file … -key-file … <host>.local <LAN IP>`; the phone must trust mkcert's CA.
//   tailscale — `tailscale cert` for <machine>.<tailnet>.ts.net into .local/certs (Let's Encrypt, 90 days), renewed
//               before it ends; phones on the tailnet reach the app from anywhere (4G too). The name lands in public
//               Certificate Transparency logs.
// Nothing here installs anything: no CA, no system certificate store, no Tailscale setting.
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';

export type HttpsMode = 'off' | 'tailscale' | 'mkcert';

export interface CertInfo {
  context: tls.SecureContext;
  dns: string[]; // DNS subject alternative names (wildcards included)
  ips: string[]; // IP subject alternative names
  validFrom: Date;
  validTo: Date;
  certFile: string;
  keyFile: string;
  sig: string; // files' mtime + size: reload when it changes
}

const DAY_MS = 86_400_000;
/**
 * tailscale: ask for a new certificate when this few days are left (Let's Encrypt certificates last 90 days and
 * `tailscale cert` hands back its cached one until its own renewal window, roughly the last third).
 */
export const RENEW_BEFORE_DAYS = 14;

/** config server.https → mode (`false`, '' or anything unknown = off). */
export function httpsModeOf(v: unknown): HttpsMode {
  return v === 'tailscale' || v === 'mkcert' ? v : 'off';
}

/** Certificate + key paths for a mode. mkcert: configured files (relative to the data folder) or the defaults. */
export function certFiles(mode: HttpsMode, server: { https_cert?: string; https_key?: string }, dataDir: string): { cert: string; key: string } {
  const dir = path.join(dataDir, '.local', 'certs');
  if (mode === 'tailscale') return { cert: path.join(dir, 'tailscale.crt'), key: path.join(dir, 'tailscale.key') };
  const pick = (v: string | undefined, def: string) => (v && v.trim() ? path.resolve(dataDir, v.trim()) : path.join(dir, def));
  return { cert: pick(server.https_cert, 'lan.pem'), key: pick(server.https_key, 'lan-key.pem') };
}

export function fileSig(files: string[]): string {
  return files
    .map((f) => {
      try {
        const st = fs.statSync(f);
        return `${st.mtimeMs}:${st.size}`;
      } catch {
        return '-';
      }
    })
    .join('|');
}

/** "DNS:a.example, IP Address:192.168.1.5" → names. */
export function parseSan(san: string | undefined): { dns: string[]; ips: string[] } {
  const dns: string[] = [];
  const ips: string[] = [];
  for (const part of String(san ?? '').split(',')) {
    const m = part.trim().match(/^(DNS|IP Address):(.+)$/i);
    if (!m) continue;
    const v = m[2].trim().toLowerCase();
    if (m[1].toUpperCase() === 'DNS') dns.push(v.replace(/\.$/, ''));
    else if (net.isIP(v)) ips.push(v);
  }
  return { dns, ips };
}

/** Reads and checks a certificate + key; `error` (Vietnamese) when HTTPS cannot be served with them. */
export function readCert(certFile: string, keyFile: string, now: Date = new Date()): { cert?: CertInfo; error?: string } {
  let certPem: Buffer;
  let keyPem: Buffer;
  try {
    certPem = fs.readFileSync(certFile);
  } catch {
    return { error: `Chưa có chứng chỉ ${certFile}` };
  }
  try {
    keyPem = fs.readFileSync(keyFile);
  } catch {
    return { error: `Chưa có khoá riêng ${keyFile}` };
  }
  let x509: crypto.X509Certificate;
  try {
    x509 = new crypto.X509Certificate(certPem);
  } catch (e) {
    return { error: `Không đọc được chứng chỉ ${certFile}: ${(e as Error).message}` };
  }
  const validFrom = new Date(x509.validFrom);
  const validTo = new Date(x509.validTo);
  if (validTo.getTime() <= now.getTime()) return { error: `Chứng chỉ đã hết hạn ngày ${validTo.toISOString().slice(0, 10)}` };
  let context: tls.SecureContext;
  try {
    const key = crypto.createPrivateKey(keyPem);
    if (!x509.checkPrivateKey(key)) return { error: 'Khoá riêng không khớp với chứng chỉ' };
    context = tls.createSecureContext({ cert: certPem, key: keyPem, minVersion: 'TLSv1.2' });
  } catch (e) {
    return { error: `Không dùng được chứng chỉ / khoá: ${(e as Error).message}` };
  }
  const { dns, ips } = parseSan(x509.subjectAltName);
  return { cert: { context, dns, ips, validFrom, validTo, certFile, keyFile, sig: fileSig([certFile, keyFile]) } };
}

/** tailscale: get a (new) certificate when there is none or it ends within RENEW_BEFORE_DAYS days. */
export function needsRenewal(cert: Pick<CertInfo, 'validTo'> | undefined, now: Date = new Date()): boolean {
  if (!cert) return true;
  return cert.validTo.getTime() - now.getTime() <= RENEW_BEFORE_DAYS * DAY_MS;
}

/** The tailscale CLI: TRAINER_TAILSCALE_BIN (tests: a fake) > `tailscale` on PATH > the macOS app's binary. */
export function tailscaleBin(): string {
  if (process.env.TRAINER_TAILSCALE_BIN) return process.env.TRAINER_TAILSCALE_BIN;
  const mac = '/Applications/Tailscale.app/Contents/MacOS/Tailscale';
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    for (const name of process.platform === 'win32' ? ['tailscale.exe', 'tailscale'] : ['tailscale']) {
      if (dir && fs.existsSync(path.join(dir, name))) return path.join(dir, name);
    }
  }
  return process.platform === 'darwin' && fs.existsSync(mac) ? mac : 'tailscale';
}

/** `tailscale cert` arguments: the certificate and key go to our files, never to the working directory. */
export function tailscaleCertArgs(name: string, certFile: string, keyFile: string): string[] {
  return ['cert', '--cert-file', certFile, '--key-file', keyFile, name];
}

function run(bin: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 4_000_000, env: { ...process.env, LC_ALL: 'C' } }, (err, stdout, stderr) => {
      if (err) reject(new Error(String(stderr || err.message).trim().split('\n').slice(-2).join(' ') || err.message));
      else resolve(stdout);
    });
  });
}

/** This machine's tailnet name (`tailscale status --json` → Self.DNSName), e.g. "mac.tail1234.ts.net". */
export async function tailscaleName(bin: string = tailscaleBin()): Promise<string> {
  const out = await run(bin, ['status', '--json'], 15_000);
  let name = '';
  try {
    name = String((JSON.parse(out) as { Self?: { DNSName?: string } }).Self?.DNSName ?? '');
  } catch {
    throw new Error('tailscale status --json trả về dữ liệu không đọc được');
  }
  name = name.replace(/\.$/, '').toLowerCase();
  if (!/\.ts\.net$/.test(name)) throw new Error('Máy này chưa có tên MagicDNS *.ts.net — bật MagicDNS và HTTPS Certificates trong trang quản trị Tailscale');
  return name;
}

/** `tailscale cert` into our files (the directory is created 0700). */
export async function tailscaleCert(name: string, certFile: string, keyFile: string, bin: string = tailscaleBin()): Promise<void> {
  fs.mkdirSync(path.dirname(certFile), { recursive: true, mode: 0o700 });
  await run(bin, tailscaleCertArgs(name, certFile, keyFile), 90_000);
  try {
    fs.chmodSync(keyFile, 0o600);
  } catch {
    // Windows: ACL-based
  }
}

/**
 * Hands a new LAN connection to `onPlain` (plain HTTP) or, when it opens with a TLS handshake and a certificate is
 * loaded, to `onTls` with a server-side TLSSocket. A client that sends nothing is dropped after 15 s; so is a TLS
 * handshake that does not finish.
 */
export function sniff(socket: net.Socket, context: () => tls.SecureContext | undefined, onPlain: (s: net.Socket) => void, onTls: (s: tls.TLSSocket) => void): void {
  const idle = setTimeout(() => socket.destroy(), 15_000);
  socket.once('error', () => socket.destroy());
  socket.once('close', () => clearTimeout(idle));
  socket.once('readable', () => {
    clearTimeout(idle);
    const head = socket.read(1) as Buffer | null;
    if (!head) {
      socket.destroy();
      return;
    }
    socket.unshift(head);
    const ctx = head[0] === 0x16 ? context() : undefined;
    if (!ctx) {
      onPlain(socket);
      return;
    }
    const secure = new tls.TLSSocket(socket, { isServer: true, secureContext: ctx, ALPNProtocols: ['http/1.1'] });
    const handshake = setTimeout(() => secure.destroy(), 15_000);
    secure.once('secure', () => clearTimeout(handshake));
    secure.once('close', () => clearTimeout(handshake));
    secure.on('error', () => secure.destroy());
    onTls(secure);
  });
}
