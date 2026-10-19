// End-to-end checks of the bank-quality API ([Q]) on the real server with a sandbox copy of the bank: lint drill-down,
// distractor analytics from real submissions (item versioning: a rewritten option starts clean), semantic duplicates
// through a fake Ollama (background job, polling, on-disk vector cache, merge with lexical pairs) and the config
// switch. Never touches trainer/results, port 3003 or a real Ollama. Run: npm run test:e2e
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { buildTest } from '../helpers/learner.ts';
import { startFakeOllama, type FakeOllama } from '../helpers/fake-ollama.ts';
import type { AnswerInput, BankQuality, Question, SemanticStatus, DuplicatePair } from '../../shared/types.ts';

let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;
let ollama: FakeOllama;
let bank: Question[] = [];
const T = { timeout: 120_000 };

// Two paraphrases (different words, same meaning) that the lexical check cannot pair; the fake model maps every text
// mentioning "flamingo" to one vector, like a real embedding model would map both to the same meaning.
const PACK = `---
pack: e2e-semantic
title: E2E semantic duplicates
origin: manual
---

# E2E semantic duplicates

## Q e2e-sem-01
- domain: secure
- topic: database
- difficulty: medium
- time: 60

A flamingo-themed bank needs an immutable journal of every payment whose history can be verified cryptographically. Which database fits?

- A. Amazon QLDB with its journal
- B. Amazon DynamoDB with streams
- C. Amazon Aurora PostgreSQL cluster
- D. Amazon Neptune graph database

**Answer:** A

**Explanation:** QLDB keeps an append-only journal with a cryptographic digest, so every change can be verified later; DynamoDB streams, Aurora and Neptune keep no verifiable history.

---

## Q e2e-sem-02
- domain: secure
- topic: database
- difficulty: medium
- time: 60

Auditors of the flamingo lender demand a tamper-evident record of transactions that they can check with hashes. What should store it?

- A. Amazon Neptune graph database
- B. Amazon Quantum Ledger Database
- C. Amazon ElastiCache for Redis
- D. Amazon Redshift data warehouse

**Answer:** B

**Explanation:** The ledger database keeps an append-only journal whose digest proves no entry was changed; Neptune, ElastiCache and Redshift do not offer a cryptographically verifiable history.
`;

function setQuality(patch: Record<string, unknown>) {
  const file = path.join(sb.home, 'config.yaml');
  const cfg = YAML.parse(fs.readFileSync(file, 'utf8')) as Record<string, Record<string, unknown>>;
  cfg.quality = { ...cfg.quality, ...patch };
  fs.writeFileSync(file, YAML.stringify(cfg));
}

before(
  async () => {
    sb = makeSandbox();
    ollama = await startFakeOllama({ concept: (t) => (/flamingo/i.test(t) ? 'verifiable-ledger' : undefined) });
    setQuality({ embeddings: 'auto', ollama_url: ollama.url, embedding_model: 'fake-embed', semantic_threshold: 0.88 });
    fs.writeFileSync(path.join(sb.home, 'bank', 'packs', 'manual', 'e2e-semantic.md'), PACK);
    srv = await startServer({ home: sb.home });
    api = apiClient(srv.base);
    bank = (await api.get<{ questions: Question[] }>('/api/bank')).body.questions.filter((q) => q.status === 'active');
  },
  { timeout: 90_000 },
);

after(async () => {
  await srv?.stop();
  await ollama?.close();
  if (process.env.E2E_KEEP) console.log(`sandbox kept: ${sb?.root}`);
  else sb?.cleanup();
});

async function quality(): Promise<BankQuality> {
  const r = await api.get<BankQuality>('/api/quality');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}

async function waitFor<V>(what: string, fn: () => Promise<V | undefined | false>, ms = 45_000): Promise<V> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timeout waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** Builds an "ids" test and submits it `daysAgo` days ago with the given answers (40 s each — not rushed). */
async function submit(ids: string[], answer: (q: Question) => Partial<AnswerInput>, daysAgo: number) {
  const { session, questions } = await buildTest(api, { mode: 'ids', ids, shuffleQuestions: false });
  const finished = Date.now() - daysAgo * 86_400_000;
  const answers = questions.map((q) => ({ q: q.id, pick: [], t: 40, ...answer(q) }) as AnswerInput);
  const timeUsed = answers.reduce((s, a) => s + a.t, 0);
  const r = await api.post('/api/results', { session, answers, startedAt: new Date(finished - timeUsed * 1000).toISOString(), finishedAt: new Date(finished).toISOString(), timedOut: false, timeUsed });
  assert.equal(r.status, 200, r.body?.error);
}

test('lint: summary in /api/quality, uncapped drill-down per rule, unknown rule → 400', T, async () => {
  const q = await quality();
  assert.ok(q.lint, 'BankQuality.lint');
  assert.equal(q.lint.checked, q.total);
  assert.ok(q.lint.questions.length <= 20);
  for (const code of ['longest-correct', 'stem-echo', 'absolute-terms', 'negative-stem', 'all-none-above', 'duplicate-options', 'choose-count', 'letter-ref', 'short-explanation']) {
    assert.ok(q.lint.byCode[code], `rule ${code} listed`);
  }
  assert.equal(q.lint.byCode['longest-correct'].count, q.correctLongest, 'one correct-longest rule for metric and lint');
  assert.equal(q.lint.bySeverity?.high, 0, 'the real bank has no high-severity flaw');

  const short = await api.get('/api/quality/lint?code=short-explanation&limit=2000');
  assert.equal(short.status, 200);
  assert.equal(short.body.total, q.lint.byCode['short-explanation'].count);
  assert.deepEqual(short.body.questions.map((x: { id: string }) => x.id).sort(), [...(q.lint.ids?.['short-explanation'] ?? [])].sort());
  assert.ok(short.body.questions.every((x: { flaws: { code: string }[] }) => x.flaws.some((f) => f.code === 'short-explanation')));
  assert.ok(Array.isArray(short.body.rules) && short.body.rules.length >= 10);
  assert.equal((await api.get('/api/quality/lint?code=nope')).status, 400);
  const all = await api.get('/api/quality/lint?limit=5');
  assert.equal(all.body.questions.length, 5);
  assert.equal(all.body.total, q.lint.flagged);
});

test('distractors: struck-out options never picked + the same wrong pick → report; a rewritten option starts clean', T, async () => {
  const singles = bank.filter((q) => q.answer.length === 1 && q.options.length === 4 && q.origin === 'imported');
  const [x, y] = [singles[3], singles[4]];
  const xWeak = x.options.find((o) => !x.answer.includes(o.key))!.key;
  const yWrong = y.options.find((o) => !y.answer.includes(o.key))!.key;
  for (const day of [3, 2, 1]) {
    await submit([x.id, y.id], (q) => (q.id === x.id ? { pick: x.answer, elim: [xWeak] } : { pick: [yWrong], why: day === 1 ? 'e2e: mình chắc đáp án này đúng' : undefined }), day);
  }
  const d = (await quality()).distractors!;
  assert.deepEqual(d.weakDistractors.find((w) => w.id === x.id), { id: x.id, key: xWeak, exposures: 3, elims: 3 });
  const s = d.suspectedKeys.find((k) => k.id === y.id);
  assert.ok(s, 'suspected key');
  assert.deepEqual([s.key, s.pick, s.times, s.confident], [y.answer.join(''), yWrong, 3, 3]);
  assert.match(s.note, /mình chắc đáp án này đúng/);
  assert.ok((d.analysed ?? 0) >= 2 && (d.answers ?? 0) >= 6);

  // rewrite the weak distractor in the (sandbox) pack: its hash changes, answers to the old version stop counting
  const file = path.join(sb.home, x.file);
  const old = x.options.find((o) => o.key === xWeak)!.text;
  const text = fs.readFileSync(file, 'utf8');
  const line = `- ${xWeak}. ${old}`;
  assert.ok(text.includes(line), 'option line found');
  fs.writeFileSync(file, text.replace(line, `- ${xWeak}. ${old} (rewritten by the e2e test to be more plausible)`));
  const after = await waitFor('bank reload', async () => {
    const q = await quality();
    return q.distractors && !q.distractors.weakDistractors.some((w) => w.id === x.id) ? q : undefined;
  });
  assert.ok(after.distractors!.suspectedKeys.some((k) => k.id === y.id), 'other questions keep their numbers');
});

test('semantic duplicates: background job via (fake) Ollama, vector cache on disk, merged with lexical pairs', T, async () => {
  await quality(); // schedules the job for the current bank version
  const done = await waitFor('semantic job', async () => {
    const r = await api.get<{ status: SemanticStatus; pairs: DuplicatePair[] }>('/api/quality/semantic');
    return r.body.status.state === 'done' && r.body.status.version === (await quality()).version ? r.body : undefined;
  });
  assert.equal(done.status.provider, 'ollama');
  assert.equal(done.status.available, true);
  assert.equal(done.status.model, 'fake-embed');
  assert.equal(done.status.embedded, bank.length);
  assert.ok(done.pairs.some((p) => p.a === 'e2e-sem-01' && p.b === 'e2e-sem-02' && p.kind === 'semantic'), JSON.stringify(done.pairs.slice(0, 5)));
  assert.ok(fs.existsSync(path.join(sb.home, '.cache', 'embeddings-fake-embed.json')), 'vectors cached in <data>/.cache');

  const q = await quality();
  assert.deepEqual(q.semantic?.state, 'done');
  const kinds = new Set(q.duplicates.map((p) => p.kind));
  assert.ok(kinds.has('semantic') && kinds.has('lexical'), [...kinds].join(','));
  assert.ok(q.duplicates.some((p) => p.a === 'e2e-sem-01' && p.b === 'e2e-sem-02' && p.kind === 'semantic'));
  assert.ok(q.duplicates.length <= 50);

  // "Tính lại": re-probes and re-compares, every vector comes from the cache
  const embedCalls = ollama.embedCalls();
  const started = await api.post<SemanticStatus & { status?: SemanticStatus }>('/api/quality/semantic', {});
  assert.equal(started.status, 200);
  await waitFor('recompute', async () => {
    const r = await api.get<{ status: SemanticStatus }>('/api/quality/semantic');
    return r.body.status.state === 'done' && r.body.status.checkedAt !== done.status.checkedAt;
  });
  assert.equal(ollama.embedCalls(), embedCalls, 'nothing re-embedded');
  assert.equal((await api.post('/api/ratings', { qid: 'e2e-sem-02', value: 'down', note: 'e2e: trùng với e2e-sem-01' })).status, 200);
});

test('blind-solve verdicts in bank/verify.md → BankQuality.verification + the review queue in the coach snapshot', T, async () => {
  const q = bank.find((x) => x.answer.length === 1 && x.origin === 'imported' && x.id !== 'e2e-sem-01')!;
  const wrong = q.options.find((o) => !q.answer.includes(o.key))!.key;
  const data = { at: new Date().toISOString(), hash: q.hash, outcome: 'mismatch', picked: wrong, key: q.answer.join(''), confidence: 'high', model: 'opus', run: 'e2e', reason: 'e2e: phương án kia rẻ hơn mà vẫn đáp ứng yêu cầu' };
  const line = `- ${data.at.slice(0, 10)} · \`${q.id}\` · ❌ lệch đáp án <!-- verify ${JSON.stringify(data)} -->`;
  fs.writeFileSync(path.join(sb.home, 'bank', 'verify.md'), `# 🧪 Giải mù\n\n<!-- verify-log -->\n${line}\n`);
  const v = await waitFor('verdict', async () => {
    const r = (await quality()).verification;
    return r && r.review >= 1 ? r : undefined;
  });
  assert.equal(v.pending[0].qid, q.id);
  assert.equal(v.pending[0].picked, wrong);
  assert.equal((await api.post('/api/snapshot', {})).status, 200);
  const snap = (await api.get<{ content: string }>('/api/snapshot')).body.content;
  assert.match(snap, /### 🧪 Giải mù/);
  assert.ok(snap.includes(`\`${q.id}\` ❌ lệch đáp án — model chọn ${wrong}`), snap.slice(snap.indexOf('### 🧪 Giải mù'), snap.indexOf('### 🧪 Giải mù') + 600));
  assert.match(snap, /phương án kia rẻ hơn/);
});

test('semantic duplicates off (config) → provider off, button refused, only lexical pairs', T, async () => {
  setQuality({ embeddings: 'off' });
  const q = await quality();
  assert.equal(q.semantic?.provider, 'off');
  assert.ok(q.duplicates.every((p) => p.kind !== 'semantic'));
  const r = await api.post('/api/quality/semantic', {});
  assert.equal(r.status, 409);
  assert.match(r.body.error, /quality\.embeddings/);
  assert.ok(q.verification && typeof q.verification.review === 'number', 'blind-solve summary present');
});
