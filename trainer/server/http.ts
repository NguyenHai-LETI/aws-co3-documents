// Shared HTTP plumbing: route registry, JSON helpers, SSE broadcast. Route modules in server/routes/*
// register themselves with `route()` (imported for side effects by server/index.ts).
import http from 'node:http';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(res: http.ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
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
