// [v5 γ1] End-to-end checks of the content routes on the real server with a sandbox copy of the bank: confusable groups
// (GET /api/pairs), the pair page material (GET /api/pairs/compare — always 200), the exam guide coverage
// (GET /api/exam-guide), the computed Question.cluster / skills in /api/bank, the drawer extras of
// GET /api/quality/lint?id= (siblings, family), the 📒 notebook in the notes list / note route / search, notebook rule
// cards (Anki preview) and the Anki review import against a fake AnkiConnect (idempotent). Never touches port 3003.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type ApiClient, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { startFakeAnki, type FakeAnki } from '../helpers/fake-anki.ts';
import type { AnkiImportResult, AnkiPreview, ConfusableGroup, GuideCoverage, PairCompare, Question, SearchResponse } from '../../shared/types.ts';

let sb: Sandbox;
let srv: ServerHandle;
let api: ApiClient;
let anki: FakeAnki;
const T = { timeout: 120_000 };

const NOTEBOOK = `# 📒 Sổ lỗi · Kiến trúc bền vững

## 🔥 SQS không tự fan-out
<!-- nb {"key":"sqs-fanout-e2e","count":2,"confident":true,"updated":"2026-10-19","qids":[],"refs":[]} -->

- ❌ **Bạn nghĩ:** Một hàng đợi SQS gửi được một message tới nhiều dịch vụ cùng lúc
- ✅ **Thực ra:** Muốn fan-out thì đặt SNS topic trước nhiều hàng đợi SQS (zebrafanout)
- 🔀 **Dễ nhầm:** SNS ⟷ SQS
`;

before(async () => {
  sb = makeSandbox();
  fs.mkdirSync(path.join(sb.home, 'coach', 'notebook'), { recursive: true });
  fs.writeFileSync(path.join(sb.home, 'coach', 'notebook', 'resilient.md'), NOTEBOOK);
  anki = await startFakeAnki();
  const cfgFile = path.join(sb.home, 'config.yaml');
  const cfg = fs.readFileSync(cfgFile, 'utf8');
  fs.writeFileSync(cfgFile, cfg.replace(/ankiconnect_url: "[^"]*"/, `ankiconnect_url: "${anki.url}"`));
  srv = await startServer({ home: sb.home });
  api = apiClient(srv.base);
}, T);

after(async () => {
  await srv?.stop();
  await anki?.close();
  sb?.cleanup();
});

test('GET /api/pairs: confusable groups of the real bank (2–4 services, ≥ 8 competing questions), learner progress shape', T, async () => {
  const r = await api.get<ConfusableGroup[]>('/api/pairs');
  assert.equal(r.status, 200);
  assert.ok(r.body.length >= 3, `${r.body.length} groups`);
  for (const g of r.body) {
    assert.ok(g.services.length >= 2 && g.services.length <= 4, g.id);
    assert.ok(g.questions >= 8, `${g.id}: ${g.questions}`);
    assert.deepEqual(g.learner, { answers: 0, correct: 0, last10: 0, separated: false }, 'a fresh learner');
  }
  assert.ok(r.body.some((g) => g.services.includes('SQS') && g.services.includes('SNS')));
});

test('GET /api/pairs/compare: notes sections naming both (preferred files first, Markdown); unknown / empty pairs are 200 + empty', T, async () => {
  const r = await api.get<PairCompare>('/api/pairs/compare?a=SNS&b=SQS');
  assert.equal(r.status, 200);
  assert.ok(r.body.excerpts.length >= 2 && r.body.excerpts.length <= 4);
  assert.equal(r.body.excerpts[0].file, 'Q-service-comparisons.md');
  assert.match(r.body.excerpts[0].text, /^#{2,4} .*SQS/m, 'the section as Markdown, heading included');
  assert.ok(r.body.excerpts.every((x) => x.anchor && x.heading));
  assert.ok(r.body.questions >= 8);
  assert.equal(r.body.progress.separated, false);
  for (const qs of ['?a=SNS', '?a=&b=', '?a=Nope&b=Nada', '?a=SQS&b=SQS']) {
    const e = await api.get<PairCompare>(`/api/pairs/compare${qs}`);
    assert.equal(e.status, 200, qs);
    assert.deepEqual(e.body.excerpts, [], qs);
  }
  const f = await api.get<PairCompare>('/api/pairs/compare?a=security-groups&b=nacl');
  assert.ok(f.body.excerpts.length >= 1, 'feature tags (ConfusionPair terms) work too');
});

test('GET /api/exam-guide: 189 official bullets, 14 tasks, coverage of the practice pool; /api/bank carries cluster + skills', T, async () => {
  const g = await api.get<GuideCoverage>('/api/exam-guide');
  assert.equal(g.status, 200);
  assert.equal(g.body.bullets.length, 189);
  assert.equal(g.body.tasks.length, 14);
  assert.ok(g.body.total > 600);
  assert.ok(g.body.bullets.every((b) => b.need >= 0 && b.need <= 2 && b.answers === 0));
  assert.deepEqual(g.body.multi.target, [0.2, 0.3]);
  assert.ok(g.body.tasks.every((t) => t.target === 20)); // [v6] config.yaml quality.longform_target_per_task (14 tasks × 20 ≈ 280 tier A)
  const bank = await api.get<{ questions: Question[] }>('/api/bank');
  const clustered = bank.body.questions.filter((q) => q.cluster);
  assert.ok(clustered.length > 100, `${clustered.length} questions with siblings`);
  const sizes = new Map<string, number>();
  for (const q of clustered) sizes.set(q.cluster!, (sizes.get(q.cluster!) ?? 0) + 1);
  assert.ok(Math.max(...sizes.values()) <= 6, 'no chained giant cluster');
  assert.ok(bank.body.questions.some((q) => q.skills?.length && q.skillsGuessed));
  // drawer extras: why siblings, family members
  const one = clustered[0];
  const lint = await api.get<{ id: string; siblings: { id: string; kinds: string[] }[]; family: string[] }>(`/api/quality/lint?id=${encodeURIComponent(one.id)}`);
  assert.ok(lint.body.siblings.length >= 1);
  assert.ok(lint.body.siblings.every((l) => sizes.has(one.cluster!) && l.kinds.length));
  assert.deepEqual(lint.body.family, []);
});

test('📒 notebook: listed as a note, served through the note route, found by search, exported as Anki rule cards', T, async () => {
  const notes = await api.get<{ file: string; group: string }[]>('/api/notes');
  const nb = notes.body.find((n) => n.group === 'notebook');
  assert.equal(nb?.file, 'trainer/coach/notebook/resilient.md');
  const note = await api.get<{ content: string }>(`/api/note?path=${encodeURIComponent(nb!.file)}`);
  assert.equal(note.status, 200);
  assert.match(note.body.content, /zebrafanout/);
  assert.equal((await api.get(`/api/note?path=${encodeURIComponent('trainer/coach/notebook/../../config.md')}`)).status, 404);
  const s = await api.get<SearchResponse>('/api/search?q=zebrafanout&scope=notes');
  assert.ok(s.body.hits.some((h) => h.id === nb!.file), JSON.stringify(s.body.hits));
  const p = await api.post<AnkiPreview>('/api/export/anki?preview=1', { scope: 'notebook' });
  assert.equal(p.status, 200);
  assert.equal(p.body.count, 1);
  assert.match(p.body.sample!.back, /SNS topic/);
});

test('Anki review import: reviews since the last import → one anki attempt (grade = button), idempotent, nothing twice', T, async () => {
  const bank = await api.get<{ questions: Question[]; sealed: string[] }>('/api/bank');
  const ids = bank.body.questions.filter((q) => q.status === 'active' && !bank.body.sealed.includes(q.id)).slice(0, 2).map((q) => q.id);
  const pushed = await api.post('/api/export/anki?push=1', { scope: 'ids', ids });
  assert.equal(pushed.status, 200);
  const noteOf = (id: string) => anki.notes.find((n) => n.tags.some((t) => t.toLowerCase() === `saa-c03::id::${id}`))!.id;
  const now = Date.now();
  anki.review(noteOf(ids[0]), 3, now - 60_000, 15_000);
  anki.review(noteOf(ids[1]), 1, now - 50_000, 9_000);
  anki.review(noteOf(ids[1]), 3, now - 40_000, 7_000); // same day again → a relearn step
  const r = await api.post<AnkiImportResult>('/api/export/anki/import', {});
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.ok, r.body.reviews, r.body.imported, r.body.skipped], [true, 3, 3, 0]);
  assert.ok(r.body.attempt);
  const res = await api.get<{ attempt: { mode: string; source?: string; answers: { q: string; grade?: number; ok: boolean; relearn?: boolean }[] } }>(`/api/results/${encodeURIComponent(r.body.attempt!)}`);
  assert.equal(res.body.attempt.mode, 'anki');
  assert.equal(res.body.attempt.source, 'anki');
  assert.deepEqual(res.body.attempt.answers.map((a) => [a.q, a.grade, a.ok, !!a.relearn]), [[ids[0], 3, true, false], [ids[1], 1, false, false], [ids[1], 3, true, true]]);
  const again = await api.post<AnkiImportResult>('/api/export/anki/import', {});
  assert.deepEqual([again.body.ok, again.body.reviews, again.body.imported], [true, 0, 0], 'the same range is never imported twice');
});
