// Thin fetch wrapper. Every mutating request carries X-Trainer: 1 (the server rejects
// cross-site POSTs without it, which protects the "run AI coach" endpoint).
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json', 'X-Trainer': '1' } : method === 'GET' ? {} : { 'X-Trainer': '1' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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
  post: <T>(url: string, body: unknown = {}) => request<T>('POST', url, body),
};
