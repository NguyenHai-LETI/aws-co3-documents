// [γ] Sealed forms end to end on the real server with a sandbox copy of the bank (exam.sealed_forms: 2 × 20): the forms
// are held back at start, GET /api/sealed never carries a question id, sealed questions are hidden from search (words and
// exact id), the Anki export, every quality list and the coach snapshot; POST /api/sealed/release | create with their
// Vietnamese refusals; numbering continues after released forms. (The sealed exam itself — form + 15 pilots, used once —
// is covered by tests/e2e/select.test.ts.) Review R2: the Notes page / raw file routes never reveal a sealed question,
// a broken sealed.md fails closed (ids stay hidden, error reported, writes refused), the snapshot names none.
// A git sandbox, so /api/note paths (relative to the repo root) stay inside it. Never touches trainer/results or port
// 3003. Run: npm run test:e2e
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiClient, makeSandbox, startServer } from '../helpers/server.ts';
import type { AnkiPreview, BankQuality, Question, SealedStatus, SearchResponse } from '../../shared/types.ts';

const T = { timeout: 120_000 };
const sb = makeSandbox({ git: true });
const cfgFile = path.join(sb.home, 'config.yaml');
fs.writeFileSync(cfgFile, fs.readFileSync(cfgFile, 'utf8').replace(/^(\s+sealed_forms:\s*)\d+/m, '$12').replace(/^(\s+sealed_size:\s*)\d+/m, '$120'));
const server = await startServer({ home: sb.home, repo: sb.repo });
const api = apiClient(server.base);
after(async () => {
  await server.stop();
  sb.cleanup();
});

const SEALED_FILE = path.join(sb.home, 'results', 'sealed.md');
const bankNow = async () => (await api.get<{ questions: Question[]; packs: { id: string; file: string }[]; sealed?: string[] }>('/api/bank')).body;
const searchIds = async (q: string) => (await api.get<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}&scope=questions&limit=50`)).body.hits.map((h) => h.id);
/** Three distinctive words of a stem (≥ 6 letters) — enough to find it by full-text search. */
const wordsOf = (q: Question) => [...new Set(q.stem.match(/[A-Za-z]{6,}/g) ?? [])].slice(0, 3).join(' ');

test('the server holds the forms back at start: /api/sealed, /api/meta and /api/bank agree, never a question id in the status', T, async () => {
  const st = (await api.get<SealedStatus>('/api/sealed')).body;
  assert.deepEqual(st, {
    forms: [
      { id: 'S1', status: 'sealed', count: 20 },
      { id: 'S2', status: 'sealed', count: 20 },
    ],
    size: 20,
    file: 'results/sealed.md',
    sealed: 40,
  });
  assert.ok(fs.existsSync(SEALED_FILE), 'written into the sandbox data root');
  assert.match(server.logs(), /🔒 2 đề niêm phong \(40 câu\) đang được giữ riêng/);
  const meta = (await api.get('/api/meta')).body;
  assert.deepEqual(meta.sealed, st.forms);
  const bank = await bankNow();
  assert.equal(bank.sealed?.length, 40);
  const text = JSON.stringify(st);
  for (const id of bank.sealed ?? []) assert.ok(!text.includes(id));
});

test('sealed questions are hidden: search (words + exact id), Anki export, quality lists, lint drill-down and the coach snapshot', T, async () => {
  const bank = await bankNow();
  const sealed = new Set(bank.sealed);
  const one = bank.questions.find((q) => sealed.has(q.id))!;
  const free = bank.questions.find((q) => q.status === 'active' && !sealed.has(q.id))!;
  assert.ok(!(await searchIds(one.id)).includes(one.id), 'exact id');
  assert.ok(!(await searchIds(wordsOf(one))).includes(one.id), `words "${wordsOf(one)}"`);
  assert.ok((await searchIds(free.id)).includes(free.id), 'a practice question is found as before');

  const pre = (await api.post<AnkiPreview>('/api/export/anki?preview=1', { scope: 'ids', ids: [one.id, free.id] })).body;
  assert.equal(pre.count, 1);
  assert.deepEqual(pre.missing, [], 'a sealed id is skipped, not reported missing');
  const allCount = (await api.post<AnkiPreview>('/api/export/anki?preview=1', { scope: 'all' })).body.count;
  assert.equal(allCount, bank.questions.filter((q) => q.status === 'active' && !sealed.has(q.id)).length);

  const q = (await api.get<BankQuality>('/api/quality')).body;
  assert.equal(q.sealed, 40);
  assert.equal(q.total, bank.questions.filter((x) => x.status === 'active').length - 40);
  const listed = [
    ...Object.values(q.lint?.ids ?? {}).flat(),
    ...(q.lint?.questions ?? []).map((x) => x.id),
    ...q.duplicates.flatMap((d) => [d.a, d.b]),
    ...q.lowRated,
    ...(q.scope?.answer ?? []).map((x) => x.id),
    ...(q.scope?.distractor ?? []).map((x) => x.id),
  ];
  assert.ok(listed.length > 0);
  assert.deepEqual(listed.filter((id) => sealed.has(id)), []);
  const drill = (await api.get<{ questions: { id: string }[] }>('/api/quality/lint?code=short-explanation&limit=2000')).body.questions;
  assert.ok(drill.length > 0 && !drill.some((x) => sealed.has(x.id)));

  // R2 #3: a 👎 and a "Hỏi AI" entry recorded for the question (as if before it was sealed) must not be named either
  assert.equal((await api.post('/api/ratings', { qid: one.id, value: 'down', note: 'đáp án gây tranh cãi' })).status, 200);
  fs.mkdirSync(path.join(sb.home, 'coach', 'qa'), { recursive: true });
  fs.writeFileSync(path.join(sb.home, 'coach', 'qa', `${one.id}.md`), `# 💬 Hỏi AI — \`${one.id}\`\n\n<!-- qa {"at":"${new Date().toISOString()}","q":"tại sao?","pick":"B"} -->\n### ❓ hôm qua · đã chọn B\n\n> tại sao?\n\n**🤖 Trả lời:**\n\nVì đáp án đúng là dịch vụ X.\n`);
  assert.equal((await api.post('/api/snapshot')).status, 200);
  const snap = fs.readFileSync(path.join(sb.home, 'coach', 'snapshot.md'), 'utf8');
  assert.match(snap, /## 16\. Đề niêm phong/);
  assert.match(snap, /- S1: 🔒 đang niêm phong · 20 câu/);
  assert.match(snap, /40 câu đang được giữ riêng: \*\*không\*\* dùng làm câu gốc/);
  assert.match(snap, /🔒 40 câu đang niêm phong — không tính/);
  assert.equal([...sealed].filter((id) => new RegExp(`(?<![\\w-])${id}(?![\\w-])`).test(snap)).length, 0, 'no sealed id is named in the snapshot');
});

test('[R2 #1] the Notes page and /api/file never reveal a sealed question; the study notes and result reports still open', T, async () => {
  const bank = await bankNow();
  const sealed = new Set(bank.sealed);
  const note = (p: string) => api.get<{ content: string; error?: string }>(`/api/note?path=${encodeURIComponent(p)}`);
  const leaks = (text: string, qs: Question[]) => qs.filter((q) => text.replace(/\s+/g, ' ').includes(q.stem.replace(/\s+/g, ' ').slice(0, 60))).length;
  // Ngân hàng → Bộ đề → 📄: every pack that holds a sealed question shows a placeholder instead
  let packs = 0;
  for (const p of bank.packs) {
    const inPack = bank.questions.filter((q) => q.pack === p.id && sealed.has(q.id));
    if (!inPack.length) continue;
    packs++;
    const r = await note(`trainer/${p.file}`);
    assert.equal(r.status, 200);
    assert.equal(leaks(r.body.content, inPack), 0, `sealed stems readable in ${p.file}`);
    assert.equal(r.body.content.split('🔒 Câu đang niêm phong').length - 1, inPack.length);
    const open = bank.questions.find((q) => q.pack === p.id && !sealed.has(q.id) && q.status === 'active');
    if (open) assert.equal(leaks(r.body.content, [open]), 1, 'the other questions of the pack stay readable');
  }
  assert.ok(packs > 0);
  // the list itself, ENRICH batches and the practice-exam sources: refused (403, Vietnamese reason)
  for (const p of ['trainer/results/sealed.md', 'trainer/coach/enrich/x-batch.md', 'practice-exams/01-compute-services-exam.md']) {
    if (p.includes('enrich')) {
      fs.mkdirSync(path.join(sb.home, 'coach', 'enrich'), { recursive: true });
      fs.writeFileSync(path.join(sb.home, 'coach', 'enrich', 'x-batch.md'), '# batch\n');
    }
    if (p.startsWith('practice-exams')) {
      fs.mkdirSync(path.join(sb.repo!, 'practice-exams'), { recursive: true });
      fs.writeFileSync(path.join(sb.repo!, p), '# Exam\n\n1. A question and its key.\n');
    }
    const r = await note(p);
    assert.equal(r.status, 403, p);
    assert.match(r.body.error ?? '', /🔒/);
  }
  assert.equal((await api.get('/api/file?path=results/sealed.md')).status, 403);
  // a result report (Kết quả → 📄) still opens, without the sections of sealed questions
  const one = [...sealed][0];
  const free = bank.questions.find((q) => q.status === 'active' && !sealed.has(q.id))!;
  fs.mkdirSync(path.join(sb.home, 'results', '2026', '10'), { recursive: true });
  fs.writeFileSync(path.join(sb.home, 'results', '2026', '10', 'r.md'), `# Bài\n\n### 1. \`${one}\`\n\n> câu kín\n\n### 2. \`${free.id}\`\n\n> câu mở\n`);
  const rep = await note('trainer/results/2026/10/r.md');
  assert.equal(rep.status, 200);
  assert.ok(!rep.body.content.includes(one) && !rep.body.content.includes('câu kín') && rep.body.content.includes('câu mở'));
  assert.equal((await api.get('/api/file?path=results/2026/10/r.md')).body.content, rep.body.content);
  // study notes at the repo root are served as they are
  fs.writeFileSync(path.join(sb.repo!, '03-db.md'), '# DB notes\n\nRDS Multi-AZ.\n');
  assert.equal((await note('03-db.md')).body.content, '# DB notes\n\nRDS Multi-AZ.\n');
});

test('[R2 #2] a broken sealed.md fails closed: every id it lists stays hidden, /api/sealed + /api/meta report it, nothing is written', T, async () => {
  const before = fs.readFileSync(SEALED_FILE, 'utf8');
  const sealedBefore = ((await bankNow()).sealed ?? []).slice().sort();
  const lines = before.split('\n');
  const at = lines.findIndex((l) => l.startsWith('  - id: S1'));
  const broken = [...lines.slice(0, at), '<<<<<<< HEAD', ...lines.slice(at, at + 3), '=======', ...lines.slice(at, at + 3), '>>>>>>> other', ...lines.slice(at + 3)].join('\n');
  fs.writeFileSync(SEALED_FILE, broken);
  try {
    const st = (await api.get<SealedStatus>('/api/sealed')).body;
    assert.match(st.error ?? '', /results\/sealed\.md đang lỗi: còn dấu xung đột git/);
    assert.equal(st.sealed, 40);
    assert.deepEqual(((await bankNow()).sealed ?? []).slice().sort(), sealedBefore, 'the same questions stay hidden');
    assert.match((await api.get('/api/meta')).body.sealedError ?? '', /Cách sửa: mở file/);
    for (const [p, body] of [['/api/sealed/release', { form: 'S1' }], ['/api/sealed/create', {}]] as const) {
      const r = await api.post<{ error: string }>(p, body);
      assert.equal(r.status, 409, p);
      assert.match(r.body.error, /đang lỗi/);
    }
    assert.equal(fs.readFileSync(SEALED_FILE, 'utf8'), broken, 'nothing written');
  } finally {
    fs.writeFileSync(SEALED_FILE, before);
  }
  assert.equal((await api.get<SealedStatus>('/api/sealed')).body.error, undefined);
});

test('release / create: Vietnamese refusals, "Mở sớm" brings the questions back, new forms continue the numbering without earlier questions', T, async () => {
  const err = async (p: string, body: unknown) => {
    const r = await api.post<{ error: string }>(p, body);
    return [r.status, r.body.error];
  };
  assert.deepEqual(await err('/api/sealed/release', {}), [400, 'Thiếu mã đề (form), ví dụ “S1”.']);
  assert.deepEqual(await err('/api/sealed/release', { form: 'S9' }), [404, 'Không có đề niêm phong “S9”.']);
  assert.deepEqual(await err('/api/sealed/create', {}), [409, 'Đang có đề niêm phong chưa làm (S1, S2) — làm hoặc mở sớm các đề đó trước khi tạo đề mới.']);
  assert.deepEqual(await err('/api/sealed/create', { forms: 'two' }), [400, 'forms / size phải là số']);

  const firstSealed = (await bankNow()).sealed ?? [];
  const r = await api.post<SealedStatus>('/api/sealed/release', { form: 'S1' });
  assert.equal(r.status, 200);
  assert.equal(r.body.released, 'S1');
  assert.equal(r.body.sealed, 20);
  assert.equal(r.body.forms[0].status, 'released');
  assert.match(r.body.forms[0].releasedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
  const nowSealed = new Set((await bankNow()).sealed);
  const back = firstSealed.find((id) => !nowSealed.has(id))!;
  assert.ok((await searchIds(back)).includes(back), 'a released question is searchable again');
  assert.deepEqual(await err('/api/sealed/release', { form: 'S1' }), [409, 'Đề S1 không còn niêm phong (đã làm hoặc đã mở sớm).']);
  assert.equal((await api.post<SealedStatus>('/api/sealed/release', { form: 'S2' })).body.sealed, 0);

  const c = await api.post<SealedStatus>('/api/sealed/create', { forms: 1, size: 10 });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.deepEqual(c.body.created, ['S3']);
  assert.equal(c.body.sealed, 10);
  assert.deepEqual(
    c.body.forms.map((f) => `${f.id}:${f.status}:${f.count}`),
    ['S1:released:20', 'S2:released:20', 'S3:sealed:10'],
  );
  const s3 = new Set((await bankNow()).sealed);
  assert.equal(s3.size, 10);
  assert.ok(![...s3].some((id) => firstSealed.includes(id)), 'questions of earlier forms are never sealed again');
  assert.match(fs.readFileSync(SEALED_FILE, 'utf8'), /\| S3 \| 🔒 niêm phong \| 10 \|/);
});
