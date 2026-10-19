// A fake Ollama HTTP server for the semantic-duplicate tests ([Q]): GET /api/tags, POST /api/embed. Ollama is not
// needed (nor installed on the dev machine). Vectors are deterministic: texts with the same `concept` key share one
// vector (cosine 1 — "same meaning, different words"), every other text gets a pseudo-random unit vector seeded by
// its content (unrelated texts stay far below the semantic threshold).
import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeOllamaOptions {
  models?: string[]; // names served by /api/tags (default ['fake-embed:latest'])
  dims?: number;
  concept?: (text: string) => string | undefined; // texts with the same concept get the same vector
  delayMs?: number; // delay every /api/embed answer (timeouts)
  badEmbed?: boolean; // answer /api/embed with a wrong number of vectors
}

export interface FakeOllama {
  url: string;
  requests: { method: string; path: string; body?: { model?: string; input?: string[] } }[];
  embedCalls(): number;
  embedded(): string[]; // every text sent to /api/embed, in order
  close(): Promise<void>;
}

/** Deterministic pseudo-random vector for a seed (not normalized: the client normalizes). */
export function fakeVector(seed: string, dims = 64): number[] {
  const out: number[] = [];
  let block = crypto.createHash('sha256').update(seed).digest();
  for (let i = 0; out.length < dims; i++) {
    if (i * 4 + 4 > block.length) {
      block = crypto.createHash('sha256').update(block).digest();
      i = 0;
    }
    out.push(block.readInt32LE(i * 4) / 2 ** 31);
  }
  return out;
}

export async function startFakeOllama(opts: FakeOllamaOptions = {}): Promise<FakeOllama> {
  const models = opts.models ?? ['fake-embed:latest'];
  const dims = opts.dims ?? 64;
  const requests: FakeOllama['requests'] = [];
  const has = (m: string) => models.some((x) => x === m || x === `${m}:latest`);
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let body: { model?: string; input?: string[] } | undefined;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        body = undefined;
      }
      requests.push({ method: req.method ?? '', path: req.url ?? '', body });
      const send = (status: number, data: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      };
      if (req.method === 'GET' && req.url === '/api/tags') return send(200, { models: models.map((name) => ({ name, model: name, size: 1 })) });
      if (req.method === 'GET' && req.url === '/api/version') return send(200, { version: '0.0.0-fake' });
      if (req.method === 'POST' && req.url === '/api/embed') {
        const model = String(body?.model ?? '');
        if (!has(model)) return send(404, { error: `model "${model}" not found, try pulling it first` });
        const input = Array.isArray(body?.input) ? body.input : [String(body?.input ?? '')];
        const embeddings = input.map((t) => fakeVector(opts.concept?.(t) ?? `text:${t}`, dims));
        const answer = () => send(200, { model, embeddings: opts.badEmbed ? embeddings.slice(1) : embeddings });
        if (opts.delayMs) setTimeout(answer, opts.delayMs);
        else answer();
        return;
      }
      send(404, { error: 'not found' });
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    embedCalls: () => requests.filter((r) => r.path === '/api/embed').length,
    embedded: () => requests.filter((r) => r.path === '/api/embed').flatMap((r) => r.body?.input ?? []),
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}
