// Thin fetch wrapper. Every mutating request carries X-Trainer: 1 (the server rejects
// cross-site POSTs without it, which protects the "run AI coach" endpoint).
export class ApiError extends Error {
  /** HTTP status; 0 = no answer at all (network down, server restarting, timeout). */
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface RequestOptions {
  /** Give up after this many ms (→ ApiError 0) instead of waiting for a hung connection (flaky phone Wi-Fi). */
  timeoutMs?: number;
}

async function request<T>(method: string, url: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json', 'X-Trainer': '1' } : method === 'GET' ? {} : { 'X-Trainer': '1' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
    });
  } catch (e) {
    const name = (e as Error | undefined)?.name;
    // "Failed to fetch" / "Load failed" / "NetworkError…" depending on the browser → one Vietnamese message
    throw new ApiError(0, name === 'TimeoutError' || name === 'AbortError' ? 'máy chủ không trả lời kịp' : 'không kết nối được máy chủ');
  }
  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : `HTTP ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

/**
 * The same request may succeed later: no answer (network, timeout, server restarting), a temporary server error, or a
 * LAN session that needs the access code again. Other 4xx answers will not change by retrying.
 */
export function isRetryable(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  return e.status === 0 || e.status === 401 || e.status === 408 || e.status === 429 || e.status >= 500;
}

// Identical GETs started together (React StrictMode runs every effect twice in `npm start`'s dev build; several
// components asking for the same URL on mount) share one request. The window is short so a GET issued after a change
// never receives a response that was requested before it.
const SHARE_MS = 40;
const inflight = new Map<string, { at: number; promise: Promise<unknown> }>();

function sharedGet<T>(url: string): Promise<T> {
  const now = performance.now();
  const hit = inflight.get(url);
  if (hit && now - hit.at < SHARE_MS) return hit.promise as Promise<T>;
  const promise = request<T>('GET', url).finally(() => {
    if (inflight.get(url)?.promise === promise) inflight.delete(url);
  });
  inflight.set(url, { at: now, promise });
  return promise;
}

export const api = {
  get: <T>(url: string) => sharedGet<T>(url),
  post: <T>(url: string, body: unknown = {}, opts?: RequestOptions) => request<T>('POST', url, body, opts),
  /** [v5] e.g. PUT /api/active (the unfinished test mirrored for another device) */
  put: <T>(url: string, body: unknown = {}, opts?: RequestOptions) => request<T>('PUT', url, body, opts),
  /** [v5] e.g. DELETE /api/active?session=… */
  del: <T>(url: string, opts?: RequestOptions) => request<T>('DELETE', url, undefined, opts),
};
