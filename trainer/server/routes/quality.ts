// Bank quality routes (owner: [Q] question quality; v4 [γ]: sealed questions hidden, exam scope, retire):
//   GET  /api/quality                 → BankQuality (letters, correct-longest, coverage, duplicates lexical + semantic,
//                                        ratings, variant effect, lint, distractors, semantic status, blind-solve summary,
//                                        sealed count, exam-scope report) — sealed questions are left out of every list
//   GET  /api/quality/lint[?code=…]   → { code?, rules, total, questions: {id, flaws}[] } — every flagged question (drill-down)
//   GET  /api/quality/lint?id=<qid>   → { id, flaws } — one question (question drawer)
//   GET  /api/quality/semantic        → { status: SemanticStatus, pairs: DuplicatePair[] } (UI polls while it runs)
//   POST /api/quality/semantic        → start the semantic-duplicate job now (re-probe Ollama, embed, compare)
//   POST /api/quality/retire          {items: [{id, hash}], reason?} → { retired: string[], failed: {id, errors}[] } —
//                                        `status: retired` for the versions the learner looked at (🎯 Phạm vi đề thi)
//   GET  /api/ratings[?qid=…]         → RatingItem[] (newest first)
//   POST /api/ratings                 {qid, value: 'up'|'down', note?} → RatingItem
import { HttpError, readBody, route } from '../http.ts';
import { loadConfig } from '../config.ts';
import { loadBank } from '../lib/bank.ts';
import { loadAttempts } from '../lib/results.ts';
import { regradeAttempts } from '../lib/regrade.ts';
import { computeQuality } from '../lib/quality.ts';
import { LINT_RULES, lintQuestion, lintQuestionsFor } from '../lib/lint.ts';
import { scheduleSemantic, semanticState } from '../lib/embeddings.ts';
import { addRating, loadRatings } from '../lib/ratings.ts';
import { scheduleSnapshot } from '../lib/snapshot.ts';
import { sealedIds } from '../lib/sealed.ts';
import { applyPatchItems } from '../lib/patch.ts';

const MAX_RETIRE = 60;

route('GET', '/api/quality', () => {
  const cfg = loadConfig();
  const bank = loadBank();
  return computeQuality(bank, regradeAttempts(loadAttempts(cfg), bank, cfg));
});

route('GET', '/api/quality/lint', (_req, url) => {
  const id = url.searchParams.get('id');
  if (id) {
    const bank = loadBank();
    const q = bank.byId.get(id);
    if (!q) throw new HttpError(404, 'Unknown question id');
    return { id, flaws: lintQuestion(q, bank.taxonomy) };
  }
  const code = url.searchParams.get('code') || undefined;
  if (code && !LINT_RULES.some((r) => r.code === code)) throw new HttpError(400, `Unknown lint rule "${code}"`);
  const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get('limit')) || 500));
  const questions = lintQuestionsFor(loadBank(), code, sealedIds());
  return { code, rules: LINT_RULES, total: questions.length, questions: questions.slice(0, limit) };
});

route('GET', '/api/quality/semantic', () => semanticState());

route('POST', '/api/quality/semantic', () => {
  const cfg = loadConfig();
  if (cfg.quality.embeddings === 'off') throw new HttpError(409, 'Tìm câu trùng theo nghĩa đang tắt (config.yaml → quality.embeddings: off)');
  void scheduleSemantic(loadBank(), cfg, { force: true }); // background; the UI polls GET /api/quality/semantic
  return semanticState(cfg);
});

route('POST', '/api/quality/retire', async (req) => {
  const body = await readBody<{ items?: unknown }>(req);
  const items = Array.isArray(body.items) ? (body.items as { id?: unknown; hash?: unknown }[]) : [];
  const list = items.filter((x) => x && typeof x.id === 'string' && x.id.trim()).map((x) => ({ id: String(x.id).trim(), hash: typeof x.hash === 'string' ? x.hash : undefined }));
  if (!list.length) throw new HttpError(400, 'items phải là danh sách {id, hash}');
  if (list.length > MAX_RETIRE) throw new HttpError(400, `Tối đa ${MAX_RETIRE} câu mỗi lần`);
  const bank = loadBank();
  const unknown = list.filter((x) => !bank.byId.has(x.id)).map((x) => x.id);
  if (unknown.length) throw new HttpError(400, `Không có câu hỏi: ${unknown.slice(0, 5).join(', ')}`);
  // base = the version the learner looked at: a question edited since then is skipped (reported), never retired blindly
  const r = applyPatchItems(
    list.map((x) => ({ id: x.id, base: x.hash ?? bank.byId.get(x.id)!.hash, status: 'retired' })),
    { label: '(chất lượng · retire)' },
  );
  if (r.error) throw new HttpError(500, r.error);
  const retired = r.items.filter((i) => i.status === 'applied' || i.status === 'unchanged').map((i) => i.id);
  const failed = r.items
    .filter((i) => i.status !== 'applied' && i.status !== 'unchanged')
    .map((i) => ({ id: i.id, errors: i.status === 'skipped' ? ['Câu đã thay đổi sau khi bạn xem — tải lại rồi quyết định lại.'] : i.errors }));
  if (retired.length) scheduleSnapshot();
  return { retired, failed };
});

route('GET', '/api/ratings', (_req, url) => {
  const qid = url.searchParams.get('qid');
  const items = loadRatings().reverse();
  return qid ? items.filter((r) => r.qid === qid) : items;
});

route('POST', '/api/ratings', async (req) => {
  const body = await readBody<{ qid?: string; value?: string; note?: unknown }>(req);
  if (!body.qid || !loadBank().byId.has(body.qid)) throw new HttpError(400, 'Unknown question id');
  if (body.value !== 'up' && body.value !== 'down') throw new HttpError(400, "value must be 'up' or 'down'");
  const item = addRating(body.qid, body.value, typeof body.note === 'string' ? body.note : undefined);
  scheduleSnapshot(); // ratings are a snapshot section (debounced, off the request path)
  return item;
});
