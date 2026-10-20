// [v5] π Per-device LAN tokens (.local/lan-devices.json: git-ignored, per machine, never synced). A device that opens the
// app with the access code (QR code / typed) is paired: it gets its own random token in an HttpOnly cookie, valid for
// 30 days, listed in 🧰 Công cụ with its name and last visit, revocable on its own. The file keeps a SHA-256 of each
// token, never the token. Devices signed in before v5 carry the old shared cookie (an HMAC of the access code): they
// count as one "legacy" entry (revocable, 30 days at most) and get a token of their own on their next visit.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const DEVICE_DAYS = 30;
export const LEGACY_ID = 'legacy';
const DAY_MS = 86_400_000;
export const MAX_DEVICES = 40; // active paired devices; pairing beyond this is refused (nothing active is ever evicted)
export const LEGACY_UPGRADES = 10; // pre-v5 cookies swapped for tokens of their own, at most (a client ignoring Set-Cookie)
const KEEP_GONE_DAYS = 7; // revoked / expired entries stay listed this long
const SEEN_WRITE_MS = 10 * 60_000; // lastSeen reaches the file at most this often per device
const ID_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

export interface StoredDevice {
  id: string;
  name: string;
  created: string; // ISO
  expires: string; // ISO
  hash?: string; // SHA-256 (base64url) of the device's secret; absent for the legacy entry
  legacy?: boolean;
  upgrades?: number; // legacy entry: devices that got their own token from the shared cookie
  revoked?: string; // ISO
  lastSeen?: string; // ISO
  ip?: string;
  ua?: string;
}

/** Too many active paired devices: revoke some first. */
export class DeviceLimitError extends Error {}

export type VerifyResult = { device: StoredDevice; reason?: undefined } | { device?: StoredDevice; reason: 'unknown' | 'revoked' | 'expired' };

/** "iPhone · Safari" from a user agent (same rules as the LanCard helper). */
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

/** A device name typed by the learner: one line, ≤ 60 characters. */
export function cleanDeviceName(v: unknown): string {
  return typeof v === 'string'
    ? v
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60)
    : '';
}

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('base64url');

/** Constant-time comparison of two secrets of any length (hash both, compare the digests). */
export function sameSecret(a: string, b: string): boolean {
  return crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(), crypto.createHash('sha256').update(b).digest());
}

function newId(): string {
  return [...crypto.randomBytes(8)].map((b) => ID_ALPHABET[b & 31]).join('');
}

export class DeviceStore {
  readonly file: string;
  private now: () => number;
  private cache: { sig: string; list: StoredDevice[] } | undefined;
  private seen = new Map<string, { at: number; ip?: string; ua?: string }>();

  constructor(file: string, now: () => number = Date.now) {
    this.file = file;
    this.now = now;
  }

  private sig(): string {
    try {
      const st = fs.statSync(this.file);
      return `${st.mtimeMs}:${st.size}:${st.ino}`;
    } catch {
      return '-';
    }
  }

  /** Stored entries (file re-read only when it changed), oldest first. */
  private read(): StoredDevice[] {
    const sig = this.sig();
    if (this.cache?.sig === sig) return this.cache.list;
    let list: StoredDevice[] = [];
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8')) as { devices?: unknown };
      if (Array.isArray(raw.devices)) {
        list = raw.devices.filter((d): d is StoredDevice => !!d && typeof d === 'object' && typeof (d as StoredDevice).id === 'string' && typeof (d as StoredDevice).expires === 'string');
      }
    } catch {
      // no file yet / unreadable → no paired devices (pairing again rewrites it)
    }
    this.cache = { sig, list };
    return list;
  }

  private write(list: StoredDevice[]): void {
    const now = this.now();
    // entries revoked / expired for a week are dropped — never the legacy entry: its revocation or expiry is the
    // tombstone that keeps the old shared cookie refused (otherwise a later visit would re-create it with 30 fresh days)
    const keep = list.filter((d) => {
      if (d.legacy) return true;
      const gone = d.revoked ? Date.parse(d.revoked) : Date.parse(d.expires) <= now ? Date.parse(d.expires) : undefined;
      return gone === undefined || now - gone < KEEP_GONE_DAYS * DAY_MS;
    });
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const tmp = `${this.file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, devices: keep }, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(tmp, this.file);
    try {
      fs.chmodSync(this.file, 0o600);
    } catch {
      // Windows: permissions are ACL-based
    }
    this.cache = { sig: this.sig(), list: keep };
  }

  /** Entries with the latest visit merged in, newest first (what 🧰 Công cụ lists). */
  list(): StoredDevice[] {
    return this.read()
      .map((d) => {
        const s = this.seen.get(d.id);
        return s && (!d.lastSeen || Date.parse(d.lastSeen) < s.at) ? { ...d, lastSeen: new Date(s.at).toISOString(), ip: s.ip ?? d.ip, ua: s.ua ?? d.ua } : d;
      })
      .reverse();
  }

  /** A new device with its own token (`<id>.<secret>`, 128 random bits), valid DEVICE_DAYS days. */
  pair(info: { ip?: string; ua?: string; name?: string } = {}): { device: StoredDevice; token: string } {
    const now = this.now();
    const active = this.read().filter((d) => !d.legacy && !d.revoked && Date.parse(d.expires) > now).length;
    if (active >= MAX_DEVICES) throw new DeviceLimitError(`Đã có ${active} thiết bị đang dùng mã — thu hồi bớt ở 🧰 Công cụ trên máy chạy app rồi quét lại.`);
    const secret = crypto.randomBytes(16).toString('base64url');
    const device: StoredDevice = {
      id: newId(),
      name: cleanDeviceName(info.name) || deviceName(info.ua),
      created: new Date(now).toISOString(),
      expires: new Date(now + DEVICE_DAYS * DAY_MS).toISOString(),
      hash: sha(secret),
      lastSeen: new Date(now).toISOString(),
      ...(info.ip ? { ip: info.ip } : {}),
      ...(info.ua ? { ua: info.ua.slice(0, 200) } : {}),
    };
    this.write([...this.read(), device]);
    return { device, token: `${device.id}.${secret}` };
  }

  /** The device a cookie token belongs to — or why it is refused. */
  verify(token: string): VerifyResult {
    const dot = token.indexOf('.');
    if (dot < 1) return { reason: 'unknown' };
    const id = token.slice(0, dot);
    const d = this.read().find((x) => x.id === id && !x.legacy);
    if (!d?.hash || !sameSecret(sha(token.slice(dot + 1)), d.hash)) return { reason: 'unknown' };
    return this.state(d);
  }

  /** Revoked / expired check for a known entry. */
  state(d: StoredDevice): VerifyResult {
    if (d.revoked) return { device: d, reason: 'revoked' };
    if (Date.parse(d.expires) <= this.now()) return { device: d, reason: 'expired' };
    return { device: d };
  }

  /**
   * The legacy entry for pre-v5 cookies, created on their first visit (`create`) and valid DEVICE_DAYS days from then —
   * the old cookie itself lasted 30 days, so none can outlive it.
   */
  legacy(create: boolean): StoredDevice | undefined {
    const found = this.read().find((d) => d.legacy);
    if (found || !create) return found;
    const now = this.now();
    const d: StoredDevice = {
      id: LEGACY_ID,
      name: 'Thiết bị đăng nhập trước bản v5 (mã cũ dùng chung)',
      created: new Date(now).toISOString(),
      expires: new Date(now + DEVICE_DAYS * DAY_MS).toISOString(),
      legacy: true,
    };
    this.write([...this.read(), d]);
    return d;
  }

  /**
   * A device carrying the pre-v5 shared cookie gets a token of its own — at most LEGACY_UPGRADES times in all (a client
   * that ignores Set-Cookie would otherwise pair a new device on every page load). Undefined = keep using the legacy entry.
   */
  upgradeLegacy(info: { ip?: string; ua?: string }): { device: StoredDevice; token: string } | undefined {
    const legacy = this.read().find((d) => d.legacy);
    if (!legacy || (legacy.upgrades ?? 0) >= LEGACY_UPGRADES) return undefined;
    let paired: { device: StoredDevice; token: string };
    try {
      paired = this.pair(info);
    } catch {
      return undefined;
    }
    this.write(this.read().map((d) => (d.legacy ? { ...d, upgrades: (d.upgrades ?? 0) + 1 } : d)));
    return paired;
  }

  /** A visit: remembered in memory, written to the file at most every 10 minutes per device. */
  touch(id: string, info: { ip?: string; ua?: string }): void {
    const now = this.now();
    this.seen.set(id, { at: now, ip: info.ip, ua: info.ua?.slice(0, 200) });
    const list = this.read();
    const i = list.findIndex((d) => d.id === id);
    if (i < 0) return;
    const last = list[i].lastSeen ? Date.parse(list[i].lastSeen!) : 0;
    if (now - last < SEEN_WRITE_MS) return;
    const next = list.slice();
    next[i] = { ...list[i], lastSeen: new Date(now).toISOString(), ...(info.ip ? { ip: info.ip } : {}), ...(info.ua ? { ua: info.ua.slice(0, 200) } : {}) };
    try {
      this.write(next);
    } catch {
      // best effort: the visit stays in memory
    }
  }

  /** Refuse one device from now on. False = unknown or already revoked. */
  revoke(id: string): boolean {
    const list = this.read();
    const i = list.findIndex((d) => d.id === id && !d.revoked);
    if (i < 0) return false;
    const next = list.slice();
    next[i] = { ...list[i], revoked: new Date(this.now()).toISOString() };
    this.write(next);
    return true;
  }

  /** Every device signed out (new access code). Returns how many were active. */
  revokeAll(): number {
    const now = this.now();
    let n = 0;
    const next = this.read().map((d) => {
      if (d.revoked) return d;
      if (Date.parse(d.expires) > now) n++;
      return { ...d, revoked: new Date(now).toISOString() };
    });
    if (next.length) this.write(next);
    return n;
  }

  rename(id: string, name: string): boolean {
    const clean = cleanDeviceName(name);
    const list = this.read();
    const i = list.findIndex((d) => d.id === id);
    if (i < 0 || !clean) return false;
    const next = list.slice();
    next[i] = { ...list[i], name: clean };
    this.write(next);
    return true;
  }
}
