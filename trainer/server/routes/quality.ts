// Bank quality routes (owner: [Q] question quality):
//   GET  /api/quality                 → BankQuality (letters, correct-longest, coverage, duplicates lexical + semantic,
//                                        ratings, variant effect, lint, distractors, semantic status, blind-solve summary)
//   GET  /api/quality/lint[?code=…]   → { code?, rules, total, questions: {id, flaws}[] } — every flagged question (drill-down)
//   GET  /api/quality/lint?id=<qid>   → { id, flaws } — one question (question drawer)
//   GET  /api/quality/semantic        → { status: SemanticStatus, pairs: DuplicatePair[] } (UI polls while it runs)
//   POST /api/quality/semantic        → start the semantic-duplicate job now (re-probe Ollama, embed, compare)
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

route('GET', '/api/quality', () => {
  const cfg = loadConfig();
  const bank = loadBank();
  return computeQuality(bank, regradeAttempts(loadAttempts(cfg), bank));
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
  const questions = lintQuestionsFor(loadBank(), code);
  return { code, rules: LINT_RULES, total: questions.length, questions: questions.slice(0, limit) };
});

route('GET', '/api/quality/semantic', () => semanticState());

route('POST', '/api/quality/semantic', () => {
  const cfg = loadConfig();
  if (cfg.quality.embeddings === 'off') throw new HttpError(409, 'Tìm câu trùng theo nghĩa đang tắt (config.yaml → quality.embeddings: off)');
  void scheduleSemantic(loadBank(), cfg, { force: true }); // background; the UI polls GET /api/quality/semantic
  return semanticState(cfg);
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
