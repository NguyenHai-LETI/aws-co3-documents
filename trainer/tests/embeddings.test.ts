// Unit tests for semantic near-duplicates (server/lib/embeddings.ts) against a fake Ollama HTTP server: client errors
// and hints, batching, the on-disk vector cache, pair search, the background job and its status. Run: npm test
import { after, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  EmbeddingError,
  computeSemantic,
  embeddingText,
  normalize,
  ollamaEmbed,
  ollamaModels,
  readVectorCache,
  resetSemanticJob,
  sameModel,
  scheduleSemantic,
  semanticState,
  similarPairs,
  textKey,
  vectorCacheFile,
} from '../server/lib/embeddings.ts';
import { freePort } from './helpers/server.ts';
import { fakeVector, startFakeOllama, type FakeOllama } from './helpers/fake-ollama.ts';
import { loadConfig, type AppConfig } from '../server/config.ts';
import type { BankState } from '../server/lib/bank.ts';
import type { Question } from '../shared/types.ts';

const tmpDirs: string[] = [];
const fakes: FakeOllama[] = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-embed-'));
  tmpDirs.push(d);
  return d;
};
async function fake(opts: Parameters<typeof startFakeOllama>[0] = {}) {
  const f = await startFakeOllama(opts);
  fakes.push(f);
  return f;
}
afterEach(() => resetSemanticJob());
after(async () => {
  for (const f of fakes) await f.close();
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

const concept = (t: string) => (/flamingo/i.test(t) ? 'ledger-concept' : undefined); // paraphrases share a vector

function q(id: string, stem: string, correct: string, status: Question['status'] = 'active'): Question {
  return {
    id,
    stem,
    options: [
      { key: 'A', text: correct },
      { key: 'B', text: `Wrong one for ${id}` },
      { key: 'C', text: `Wrong two for ${id}` },
      { key: 'D', text: `Wrong three for ${id}` },
    ],
    answer: ['A'],
    status,
  } as Question;
}

const QUESTIONS = [
  q('s-1', 'A flamingo bank needs an immutable, cryptographically verifiable journal of every transaction. Which database?', 'Amazon QLDB'),
  q('s-2', 'Which service gives the flamingo lender a tamper-evident history whose entries can be verified with cryptography?', 'Amazon Quantum Ledger Database'),
  q('s-3', 'Users far away see high latency for static assets. What improves it?', 'Amazon CloudFront'),
  q('s-4', 'A batch job can be interrupted and must be as cheap as possible. Which purchase option?', 'EC2 Spot Instances'),
];

let seq = 0;
const bankOf = (questions: Question[]): BankState => ({ version: `embed-test-${++seq}`, questions, byId: new Map(questions.map((x) => [x.id, x])) }) as unknown as BankState;

function cfgFor(url: string, patch: Partial<AppConfig['quality']> = {}): AppConfig {
  const base = loadConfig();
  return { ...base, quality: { ...base.quality, embeddings: 'auto', ollama_url: url, embedding_model: 'fake-embed', semantic_threshold: 0.88, ...patch } };
}

test('model names: "embeddinggemma" is "embeddinggemma:latest", other tags differ', () => {
  assert.ok(sameModel('embeddinggemma:latest', 'embeddinggemma'));
  assert.ok(sameModel('EmbeddingGemma', 'embeddinggemma:latest'));
  assert.equal(sameModel('nomic-embed-text:v1.5', 'nomic-embed-text'), false);
});

test('embedding text = stem + correct option(s), Markdown stripped; cache file per model', () => {
  const t = embeddingText({ stem: 'Which **service** is `best`?', options: [{ key: 'A', text: 'Amazon S3' }, { key: 'B', text: 'Amazon EBS' }, { key: 'C', text: 'Amazon EFS' }], answer: ['A', 'C'] });
  assert.equal(t, 'Which service is best ?\nAmazon S3\nAmazon EFS');
  assert.equal(path.basename(vectorCacheFile('nomic-embed-text:v1.5', '/x')), 'embeddings-nomic-embed-text_v1.5.json');
  assert.equal(textKey('a'), textKey('a'));
  const n = normalize([3, 4]);
  assert.ok(Math.abs(n[0] - 0.6) < 1e-6 && Math.abs(n[1] - 0.8) < 1e-6);
});

test('Ollama client: models, batched embeddings in order, clear errors with install / pull hints', async () => {
  const f = await fake({ concept });
  assert.deepEqual(await ollamaModels({ url: f.url, model: 'fake-embed' }), ['fake-embed:latest']);
  const texts = ['one', 'two', 'three', 'four', 'five'];
  const vecs = await ollamaEmbed(texts, { url: f.url, model: 'fake-embed', batchSize: 2 });
  assert.equal(f.embedCalls(), 3);
  assert.deepEqual(vecs[3], fakeVector('text:four'));
  assert.deepEqual(f.requests.find((r) => r.path === '/api/embed')?.body, { model: 'fake-embed', input: ['one', 'two'], truncate: true } as never);

  await assert.rejects(ollamaEmbed(['x'], { url: f.url, model: 'not-pulled' }), (e: EmbeddingError) => e.kind === 'model-missing' && /ollama pull not-pulled/.test(e.hint));

  const closed = `http://127.0.0.1:${await freePort()}`;
  await assert.rejects(ollamaModels({ url: closed, model: 'embeddinggemma' }), (e: EmbeddingError) => {
    return e instanceof EmbeddingError && e.kind === 'unreachable' && /brew install ollama/.test(e.hint) && /ollama pull embeddinggemma/.test(e.hint) && /ollama serve/.test(e.hint);
  });

  const slow = await fake({ delayMs: 400 });
  await assert.rejects(ollamaEmbed(['x'], { url: slow.url, model: 'fake-embed', timeoutMs: 80 }), (e: EmbeddingError) => e.kind === 'timeout');
  const bad = await fake({ badEmbed: true });
  await assert.rejects(ollamaEmbed(['x', 'y'], { url: bad.url, model: 'fake-embed' }), (e: EmbeddingError) => e.kind === 'bad-response');
});

test('similarPairs: cosine ≥ threshold, best first, capped, ids ordered', async () => {
  const v = (xs: number[]) => normalize(xs);
  const items = [
    { id: 'b', vec: v([1, 0, 0]) },
    { id: 'a', vec: v([0.99, 0.1, 0]) },
    { id: 'c', vec: v([0, 1, 0]) },
    { id: 'd', vec: v([1, 0.02, 0]) },
  ];
  const pairs = await similarPairs(items, 0.9);
  assert.deepEqual(pairs.map((p) => `${p.a}-${p.b}:${p.score}`), ['a-d:1', 'b-d:1', 'a-b:0.99']); // 2-decimal scores, ties by id
  assert.ok(pairs.every((p) => p.kind === 'semantic' && p.score <= 1));
  assert.equal((await similarPairs(items, 0.9, 1)).length, 1);
  assert.deepEqual(await similarPairs(items, 0.9999), []);
});

test('computeSemantic: paraphrases become a semantic pair; vectors are cached on disk and only new texts are embedded', async () => {
  const f = await fake({ concept });
  const dir = tmp();
  const opts = { url: f.url, model: 'fake-embed', threshold: 0.88, cacheDir: dir };
  const r1 = await computeSemantic(QUESTIONS, opts);
  assert.deepEqual(r1.pairs, [{ a: 's-1', b: 's-2', score: 1, kind: 'semantic' }]);
  assert.equal(r1.embedded, 4);
  assert.equal(r1.fetched, 4);
  const file = vectorCacheFile('fake-embed', dir);
  assert.equal(readVectorCache(file, 'fake-embed').size, 4);
  assert.equal(readVectorCache(file, 'other-model').size, 0, 'a cache of another model is ignored');

  const calls = f.embedCalls();
  const r2 = await computeSemantic(QUESTIONS, opts);
  assert.equal(r2.fetched, 0);
  assert.equal(f.embedCalls(), calls, 'everything came from the cache');
  assert.deepEqual(r2.pairs, r1.pairs);

  // edit one question: only its text is embedded again, the stale vector is pruned from the file
  const edited = [...QUESTIONS.slice(0, 3), q('s-4', 'A fault-tolerant batch job must run at the lowest cost. Which purchase option?', 'EC2 Spot Instances')];
  const r3 = await computeSemantic(edited, opts);
  assert.equal(r3.fetched, 1);
  assert.deepEqual(f.embedded().slice(-1), [embeddingText(edited[3])]);
  assert.equal(readVectorCache(file, 'fake-embed').size, 4);

  // a corrupt cache file is rebuilt
  fs.writeFileSync(file, '{not json');
  assert.equal((await computeSemantic(QUESTIONS, opts)).fetched, 4);
});

test('background job: runs once per bank version, reports status, re-runs on force or a new version', async () => {
  const f = await fake({ concept });
  const dir = tmp();
  const cfg = cfgFor(f.url);
  const bank = bankOf([...QUESTIONS, q('s-5', 'Retired flamingo copy of the ledger question?', 'Amazon QLDB', 'retired')]);
  assert.equal(semanticState(cfg).status.state, 'idle');
  const run = scheduleSemantic(bank, cfg, { cacheDir: dir });
  assert.ok(run, 'first call starts the job');
  assert.equal(semanticState(cfg).status.state, 'running');
  await run;
  const s = semanticState(cfg);
  assert.equal(s.status.provider, 'ollama');
  assert.equal(s.status.available, true);
  assert.equal(s.status.state, 'done');
  assert.equal(s.status.embedded, 4, 'retired questions are not embedded');
  assert.equal(s.status.total, 4);
  assert.equal(s.status.pairs, 1);
  assert.equal(s.status.version, bank.version);
  assert.equal(s.status.model, 'fake-embed');
  assert.equal(s.status.threshold, 0.88);
  assert.deepEqual(s.pairs.map((p) => `${p.a}-${p.b}-${p.kind}`), ['s-1-s-2-semantic']);

  const tags = () => f.requests.filter((r) => r.path === '/api/tags').length;
  const before = tags();
  assert.equal(scheduleSemantic(bank, cfg, { cacheDir: dir }), undefined, 'same bank version → nothing to do');
  await scheduleSemantic(bank, cfg, { cacheDir: dir, force: true });
  assert.equal(tags(), before + 1, 'force re-probes');
  await scheduleSemantic(bankOf(QUESTIONS), cfg, { cacheDir: dir });
  assert.equal(tags(), before + 2, 'a new bank version re-runs');
  assert.equal(f.embedCalls(), 1, 'vectors came from the cache after the first run');

  // a threshold change re-runs too and filters differently
  await scheduleSemantic(bankOf(QUESTIONS), cfgFor(f.url, { semantic_threshold: 1.01 }), { cacheDir: dir });
  assert.equal(semanticState(cfgFor(f.url, { semantic_threshold: 1.01 })).pairs.length, 0);
});

test('background job without Ollama: auto → lexical fallback with an install hint; ollama → error; off → nothing', async () => {
  const closed = `http://127.0.0.1:${await freePort()}`;
  const bank = bankOf(QUESTIONS);
  await scheduleSemantic(bank, cfgFor(closed), { cacheDir: tmp() });
  let s = semanticState(cfgFor(closed)).status;
  assert.deepEqual([s.provider, s.available, s.state, s.error], ['lexical', false, 'done', undefined]);
  assert.match(s.hint ?? '', /brew install ollama.*ollama serve.*ollama pull fake-embed/);

  resetSemanticJob();
  await scheduleSemantic(bank, cfgFor(closed, { embeddings: 'ollama' }), { cacheDir: tmp() });
  s = semanticState(cfgFor(closed, { embeddings: 'ollama' })).status;
  assert.deepEqual([s.provider, s.available, s.state], ['ollama', false, 'error']);
  assert.match(s.error ?? '', /Không kết nối được Ollama/);

  resetSemanticJob();
  const f = await fake({ models: ['something-else:latest'] });
  await scheduleSemantic(bank, cfgFor(f.url), { cacheDir: tmp() });
  s = semanticState(cfgFor(f.url)).status;
  assert.deepEqual([s.provider, s.available, s.state], ['ollama', false, 'error']);
  assert.match(s.hint ?? '', /ollama pull fake-embed/);
  assert.equal(f.embedCalls(), 0, 'no embedding request without the model');

  resetSemanticJob();
  const off = cfgFor(closed, { embeddings: 'off' });
  assert.equal(scheduleSemantic(bank, off), undefined);
  assert.deepEqual([semanticState(off).status.provider, semanticState(off).pairs.length], ['off', 0]);
});
