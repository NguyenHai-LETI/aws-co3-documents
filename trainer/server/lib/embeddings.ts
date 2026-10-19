// Semantic near-duplicates with a local embedding model (workstream [Q]). Provider: Ollama on this machine
// (`POST {ollama_url}/api/embed {model, input: […]}`); nothing leaves the computer. Vectors are cached per model in
// <data>/.cache/embeddings-<model>.json (git-ignored), keyed by a hash of the embedded text = stem + correct option(s),
// so only new or edited questions are embedded again. The job runs in the background — started when the bank version
// changes (computeQuality schedules it) or by the "Tính lại" button — and never inside a request: callers read the
// last result with semanticState(). Lexical duplicates (quality.ts) stay the fallback when Ollama is not installed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, loadConfig, type AppConfig } from '../config.ts';
import type { BankState } from './bank.ts';
import type { DuplicatePair, Question, SemanticStatus } from '../../shared/types.ts';

export const EMBED_CACHE_DIR = path.join(DATA_DIR, '.cache');
const BATCH_SIZE = 32;
const EMBED_TIMEOUT_MS = 120_000; // the first call loads the model into memory
const PROBE_TIMEOUT_MS = 3_000;
const RETRY_UNAVAILABLE_MS = 5 * 60_000; // Ollama missing: probe again at most every 5 minutes (or on the button)
export const MAX_SEMANTIC_PAIRS = 50;

// ── Ollama client ───────────────────────────────────────────────────────────

export type EmbedFailure = 'unreachable' | 'model-missing' | 'timeout' | 'bad-response';

export class EmbeddingError extends Error {
  kind: EmbedFailure;
  hint: string;
  constructor(kind: EmbedFailure, message: string, hint: string) {
    super(message);
    this.kind = kind;
    this.hint = hint;
  }
}

export const installHint = (model: string) =>
  `Cài Ollama để tìm câu trùng theo nghĩa ngay trên máy: brew install ollama → chạy ollama serve → tải model ollama pull ${model} (Windows/Linux: https://ollama.com/download).`;
export const pullHint = (model: string) => `Ollama đang chạy nhưng chưa có model “${model}”: chạy ollama pull ${model}.`;

export interface OllamaOptions {
  url: string; // e.g. http://127.0.0.1:11434
  model: string;
  timeoutMs?: number;
  batchSize?: number;
}

const endpoint = (url: string, p: string) => url.replace(/\/+$/, '') + p;

async function call(opts: OllamaOptions, p: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(endpoint(opts.url, p), { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new EmbeddingError('timeout', `Ollama không trả lời sau ${Math.round(timeoutMs / 1000)} giây (${opts.url})`, `Kiểm tra ollama serve còn chạy; máy yếu thì thử model nhỏ hơn (quality.embedding_model).`);
    }
    throw new EmbeddingError('unreachable', `Không kết nối được Ollama tại ${opts.url}${err.cause?.code ? ` (${err.cause.code})` : ''}`, installHint(opts.model));
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  const error = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : '';
  if (!res.ok) {
    if (res.status === 404 && /not found|pull/i.test(error)) throw new EmbeddingError('model-missing', `Ollama chưa có model “${opts.model}”`, pullHint(opts.model));
    throw new EmbeddingError('bad-response', `Ollama trả lỗi HTTP ${res.status}${error ? `: ${error}` : ''}`, `Xem log của ollama serve; thử ollama pull ${opts.model}.`);
  }
  return body;
}

/** True when `have` (from /api/tags, e.g. "embeddinggemma:latest") is the configured model. */
export function sameModel(have: string, want: string): boolean {
  const norm = (m: string) => (m.includes(':') ? m : `${m}:latest`).toLowerCase();
  return norm(have) === norm(want);
}

/** Local models (GET /api/tags). Throws EmbeddingError('unreachable') when Ollama does not run. */
export async function ollamaModels(opts: OllamaOptions): Promise<string[]> {
  const body = (await call(opts, '/api/tags', { method: 'GET' }, Math.min(opts.timeoutMs ?? PROBE_TIMEOUT_MS, PROBE_TIMEOUT_MS))) as { models?: { name?: string; model?: string }[] } | undefined;
  return (body?.models ?? []).map((m) => String(m.name ?? m.model ?? '')).filter(Boolean);
}

/** Embeddings for `texts`, in batches (POST /api/embed). Order is preserved. */
export async function ollamaEmbed(texts: string[], opts: OllamaOptions): Promise<number[][]> {
  const size = Math.max(1, opts.batchSize ?? BATCH_SIZE);
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += size) {
    const input = texts.slice(i, i + size);
    const body = (await call(
      opts,
      '/api/embed',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: opts.model, input, truncate: true }) },
      opts.timeoutMs ?? EMBED_TIMEOUT_MS,
    )) as { embeddings?: unknown } | undefined;
    const vecs = body?.embeddings;
    if (!Array.isArray(vecs) || vecs.length !== input.length || vecs.some((v) => !Array.isArray(v) || !v.length || v.some((x) => typeof x !== 'number'))) {
      throw new EmbeddingError('bad-response', 'Ollama trả về embedding không hợp lệ (kiểm tra model có phải model embedding không)', `Dùng model embedding, vd ollama pull embeddinggemma hoặc nomic-embed-text.`);
    }
    out.push(...(vecs as number[][]));
  }
  return out;
}

// ── vectors ─────────────────────────────────────────────────────────────────

/** What is compared: the question as asked + its correct option(s), plain text. */
export function embeddingText(q: Pick<Question, 'stem' | 'options' | 'answer'>): string {
  const correct = q.options.filter((o) => q.answer.includes(o.key)).map((o) => o.text.trim());
  return `${q.stem}\n${correct.join('\n')}`
    .replace(/[`*_>#|]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

export const textKey = (text: string) => crypto.createHash('sha1').update(text).digest('hex').slice(0, 16);

/** Unit-length copy (cosine similarity = dot product). */
export function normalize(v: ArrayLike<number>): Float32Array {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

export function vectorCacheFile(model: string, dir = EMBED_CACHE_DIR): string {
  return path.join(dir, `embeddings-${model.replace(/[^A-Za-z0-9._-]+/g, '_')}.json`);
}

interface VectorFile {
  model: string;
  dims: number;
  vectors: Record<string, string>; // textKey → base64 Float32Array (normalized)
}

export function readVectorCache(file: string, model: string): Map<string, Float32Array> {
  const out = new Map<string, Float32Array>();
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8')) as VectorFile;
    if (j.model !== model || !j.vectors || typeof j.vectors !== 'object') return out;
    for (const [k, b64] of Object.entries(j.vectors)) {
      const buf = Buffer.from(b64, 'base64');
      if (buf.length && buf.length % 4 === 0 && buf.length / 4 === j.dims) out.set(k, new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)));
    }
  } catch {
    // missing or corrupt cache → embed again
  }
  return out;
}

export function writeVectorCache(file: string, model: string, vectors: Map<string, Float32Array>): void {
  const dims = vectors.values().next().value?.length ?? 0;
  const data: VectorFile = { model, dims, vectors: {} };
  for (const [k, v] of vectors) if (v.length === dims) data.vectors[k] = Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}

const tick = () => new Promise<void>((r) => setImmediate(r));

/**
 * Pairs with cosine ≥ threshold, best first (vectors must be normalized). O(n²·d): yields to the event loop every few
 * rows so a large bank never blocks the server for long.
 */
export async function similarPairs(items: { id: string; vec: Float32Array }[], threshold: number, limit = MAX_SEMANTIC_PAIRS): Promise<DuplicatePair[]> {
  const pairs: DuplicatePair[] = [];
  for (let x = 0; x < items.length; x++) {
    const a = items[x].vec;
    for (let y = x + 1; y < items.length; y++) {
      const b = items[y].vec;
      if (a.length !== b.length) continue;
      let dot = 0;
      for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
      if (dot >= threshold) {
        const [p, q] = items[x].id < items[y].id ? [items[x].id, items[y].id] : [items[y].id, items[x].id];
        pairs.push({ a: p, b: q, score: Math.round(Math.min(1, dot) * 100) / 100, kind: 'semantic' });
      }
    }
    if (x % 40 === 39) await tick();
  }
  return pairs.sort((p, q) => q.score - p.score || p.a.localeCompare(q.a) || p.b.localeCompare(q.b)).slice(0, limit);
}

export interface SemanticRunOptions extends OllamaOptions {
  threshold: number;
  cacheDir?: string;
  limit?: number;
}

export interface SemanticResult {
  pairs: DuplicatePair[];
  embedded: number; // questions with a vector
  fetched: number; // texts sent to Ollama this run (0 = everything came from the cache)
}

/** Embeds the questions whose text is not cached yet, saves the cache (current texts only) and returns semantic pairs. */
export async function computeSemantic(questions: Pick<Question, 'id' | 'stem' | 'options' | 'answer'>[], opts: SemanticRunOptions): Promise<SemanticResult> {
  const file = vectorCacheFile(opts.model, opts.cacheDir);
  const cached = readVectorCache(file, opts.model);
  const items = questions.map((q) => {
    const text = embeddingText(q);
    return { id: q.id, text, key: textKey(text) };
  });
  const missing = [...new Map(items.filter((it) => !cached.has(it.key)).map((it) => [it.key, it.text]))];
  if (missing.length) {
    const vecs = await ollamaEmbed(
      missing.map(([, text]) => text),
      opts,
    );
    missing.forEach(([key], i) => cached.set(key, normalize(vecs[i])));
  }
  const keep = new Map(items.filter((it) => cached.has(it.key)).map((it) => [it.key, cached.get(it.key)!]));
  if (missing.length || keep.size !== cached.size) writeVectorCache(file, opts.model, keep);
  const withVec = items.filter((it) => keep.has(it.key)).map((it) => ({ id: it.id, vec: keep.get(it.key)! }));
  return { pairs: await similarPairs(withVec, opts.threshold, opts.limit), embedded: withVec.length, fetched: missing.length };
}

/**
 * Lexical pairs + semantic pairs not already found lexically (a pair found both ways keeps its lexical entry), best
 * first, at most `limit` (the "Câu gần trùng" list and the snapshot show ≤ 50).
 */
export function mergeDuplicates(lexical: DuplicatePair[], semantic: DuplicatePair[], keep?: (id: string) => boolean, limit = MAX_SEMANTIC_PAIRS): DuplicatePair[] {
  const seen = new Set(lexical.map((p) => `${p.a}|${p.b}`));
  const out = lexical.map((p) => ({ ...p, kind: p.kind ?? ('lexical' as const) }));
  for (const p of semantic) {
    const key = p.a < p.b ? `${p.a}|${p.b}` : `${p.b}|${p.a}`;
    if (seen.has(key) || (keep && (!keep(p.a) || !keep(p.b)))) continue;
    seen.add(key);
    out.push({ ...p, kind: 'semantic' });
  }
  return out.sort((p, q) => q.score - p.score || p.a.localeCompare(q.a) || p.b.localeCompare(q.b)).slice(0, limit);
}

// ── background job ──────────────────────────────────────────────────────────

interface JobState {
  key?: string; // bank version | model | threshold of the last finished run
  pairs: DuplicatePair[];
  status: SemanticStatus;
  running?: Promise<void>;
  again?: { bank: BankState; cfg: AppConfig; cacheDir?: string }; // requested while running
  failedAt?: number; // last unavailable / failed run (retry throttle)
}

let job: JobState = { pairs: [], status: { provider: 'lexical', available: false, state: 'idle' } };

const offStatus = (): SemanticStatus => ({
  provider: 'off',
  available: false,
  state: 'idle',
  hint: 'Đang tắt — bật trong config.yaml → quality.embeddings: auto (cần Ollama trên máy).',
});

/** Last semantic result + provider status. Cheap: reads memory only. */
export function semanticState(cfg: AppConfig = loadConfig()): { pairs: DuplicatePair[]; status: SemanticStatus } {
  if (cfg.quality.embeddings === 'off') return { pairs: [], status: offStatus() };
  return { pairs: job.pairs, status: { ...job.status, threshold: cfg.quality.semantic_threshold, model: cfg.quality.embedding_model } };
}

/** Test helper: forget the in-memory job state. */
export function resetSemanticJob(): void {
  job = { pairs: [], status: { provider: 'lexical', available: false, state: 'idle' } };
}

/**
 * Starts the background job when the bank version, model or threshold changed since the last run (or `force`).
 * Returns the running job's promise (tests await it; the server never does). Never throws.
 */
export function scheduleSemantic(bank: BankState, cfg: AppConfig = loadConfig(), opts: { force?: boolean; cacheDir?: string } = {}): Promise<void> | undefined {
  const q = cfg.quality;
  if (q.embeddings === 'off') return undefined;
  const key = `${bank.version}|${q.embedding_model}|${q.semantic_threshold}|${q.ollama_url}`;
  if (job.running) {
    if (opts.force || key !== job.key) job.again = { bank, cfg, cacheDir: opts.cacheDir };
    return job.running;
  }
  const stale = key !== job.key || job.status.state === 'idle';
  const retry = job.failedAt !== undefined && Date.now() - job.failedAt >= RETRY_UNAVAILABLE_MS; // Ollama may run by now
  if (!opts.force && !stale && !retry) return undefined;
  job.running = runJob(bank, cfg, key, opts.cacheDir).finally(() => {
    job.running = undefined;
    const next = job.again;
    job.again = undefined;
    if (next) void scheduleSemantic(next.bank, next.cfg, { cacheDir: next.cacheDir });
  });
  return job.running;
}

async function runJob(bank: BankState, cfg: AppConfig, key: string, cacheDir?: string): Promise<void> {
  const q = cfg.quality;
  const opts: SemanticRunOptions = { url: q.ollama_url, model: q.embedding_model, threshold: q.semantic_threshold, cacheDir };
  const active = bank.questions.filter((x) => x.status === 'active');
  const provider = q.embeddings === 'ollama' ? 'ollama' : job.status.available ? 'ollama' : 'lexical';
  job.status = { ...job.status, provider, state: 'running', total: active.length, error: undefined };
  try {
    const models = await ollamaModels(opts);
    if (!models.some((m) => sameModel(m, opts.model))) throw new EmbeddingError('model-missing', `Ollama chưa có model “${opts.model}”`, pullHint(opts.model));
    job.status = { ...job.status, provider: 'ollama', available: true, hint: undefined };
    const r = await computeSemantic(active, opts);
    job.pairs = r.pairs;
    job.failedAt = undefined;
    job.status = { provider: 'ollama', available: true, state: 'done', embedded: r.embedded, total: active.length, pairs: r.pairs.length, version: bank.version, checkedAt: new Date().toISOString() };
  } catch (e) {
    const err = e instanceof EmbeddingError ? e : new EmbeddingError('bad-response', (e as Error).message, installHint(opts.model));
    job.failedAt = Date.now();
    // auto mode without Ollama is the normal case on a fresh machine: lexical fallback, not an error
    const quiet = q.embeddings === 'auto' && err.kind === 'unreachable';
    job.pairs = err.kind === 'unreachable' || err.kind === 'model-missing' ? [] : job.pairs;
    job.status = {
      provider: q.embeddings === 'ollama' || err.kind !== 'unreachable' ? 'ollama' : 'lexical',
      available: false,
      state: quiet ? 'done' : 'error',
      total: active.length,
      embedded: countCached(active, opts),
      pairs: job.pairs.length,
      hint: err.hint,
      error: quiet ? undefined : err.message,
      version: bank.version,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    job.key = key;
  }
}

function countCached(questions: Question[], opts: SemanticRunOptions): number {
  const cached = readVectorCache(vectorCacheFile(opts.model, opts.cacheDir), opts.model);
  if (!cached.size) return 0;
  return questions.filter((q) => cached.has(textKey(embeddingText(q)))).length;
}
