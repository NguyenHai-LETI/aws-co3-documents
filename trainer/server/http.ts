// Shared HTTP plumbing: route registry, JSON helpers, SSE broadcast. Route modules in server/routes/*
// register themselves with `route()` (imported for side effects by server/index.ts).
import http from 'node:http';
import zlib from 'node:zlib';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Peer address on this machine (127.0.0.0/8, ::1, IPv4-mapped loopback). Never derived from headers. */
export function isLoopback(addr: string | undefined): boolean {
  if (!addr) return false;
  const a = addr.startsWith('::ffff:') ? addr.slice(7) : addr;
  return a === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(a);
}

/** The request comes from this machine (the trusted side of LAN mode: token, QR, LAN toggle). */
export function isLocalRequest(req: http.IncomingMessage): boolean {
  return isLoopback(req.socket.remoteAddress);
}

const GZIP_MIN = 16_384;

/** Accept-Encoding allows gzip: listed (or `*`) without `q=0`. */
export function acceptsGzip(header: string | string[] | undefined): boolean {
  let star = false;
  for (const part of String(header ?? '').split(',')) {
    const [name, ...params] = part.split(';').map((x) => x.trim().toLowerCase());
    const q = params.find((x) => x.startsWith('q='));
    const ok = !q || Number(q.slice(2)) > 0;
    if (name === 'gzip') return ok;
    if (name === '*') star = ok;
  }
  return star;
}

/** Large payloads (bank ≈ 650 KB, states, stats, Anki files) go gzip-compressed (~6× smaller, ~4 ms at level 3). */
function wantsGzip(res: http.ServerResponse, size: number): boolean {
  return size > GZIP_MIN && acceptsGzip(res.req?.headers['accept-encoding']);
}

export function json(res: http.ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  const headers: http.OutgoingHttpHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Accept-Encoding' };
  if (wantsGzip(res, text.length)) {
    const gz = zlib.gzipSync(text, { level: 3 });
    res.writeHead(status, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': gz.length });
    res.end(gz);
    return;
  }
  res.writeHead(status, headers);
  res.end(text);
}

/** A non-JSON route result (file download). Return it from a handler instead of a plain object. */
export class RawResponse {
  body: string | Buffer;
  type: string;
  headers: Record<string, string>;
  constructor(body: string | Buffer, type: string, headers: Record<string, string> = {}) {
    this.body = body;
    this.type = type;
    this.headers = headers;
  }
}

/** `Content-Disposition: attachment` with an ASCII fallback and the UTF-8 name (RFC 6266 / 5987). */
export function attachment(filename: string): Record<string, string> {
  const ascii = filename.normalize('NFKD').replace(/[^\w.-]+/g, '_');
  return { 'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}` };
}

export function sendRaw(res: http.ServerResponse, out: RawResponse) {
  const body = typeof out.body === 'string' ? Buffer.from(out.body, 'utf8') : out.body;
  const headers: http.OutgoingHttpHeaders = { 'Content-Type': out.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Accept-Encoding', ...out.headers };
  if (wantsGzip(res, body.length)) {
    const gz = zlib.gzipSync(body, { level: 3 });
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': gz.length });
    res.end(gz);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': body.length });
  res.end(body);
}

export async function readBody<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 5_000_000) throw new HttpError(413, 'Body too large');
    chunks.push(c as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

export type Handler = (req: http.IncomingMessage, url: URL, params: string[]) => Promise<unknown> | unknown;
export const routes: { method: string; re: RegExp; fn: Handler }[] = [];
/** Register an API route. Pattern params like `/api/results/:id` arrive (still URI-encoded) in `params`. */
export function route(method: string, pattern: string, fn: Handler): void {
  routes.push({ method, re: new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$'), fn });
}

// ── Server-Sent Events ──────────────────────────────────────────────────────
export const sseClients = new Set<http.ServerResponse>();
/** Push an event to every open browser tab (`useServerEvent(name, …)` on the web side). */
export function broadcast(event: string, data: unknown): void {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of sseClients) c.write(msg);
}
