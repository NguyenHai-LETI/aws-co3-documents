// Bank quality routes (owner: bank & quality):
//   GET  /api/quality          → BankQuality (letters, correct-longest, coverage, duplicates, ratings, variant effect)
//   GET  /api/ratings[?qid=…]  → RatingItem[] (newest first)
//   POST /api/ratings          {qid, value: 'up'|'down', note?} → RatingItem
import { HttpError, readBody, route } from '../http.ts';
import { loadBank } from '../lib/bank.ts';
import { loadAttempts } from '../lib/results.ts';
import { computeQuality } from '../lib/quality.ts';
import { addRating, loadRatings } from '../lib/ratings.ts';

route('GET', '/api/quality', () => computeQuality(loadBank(), loadAttempts()));

route('GET', '/api/ratings', (_req, url) => {
  const qid = url.searchParams.get('qid');
  const items = loadRatings().reverse();
  return qid ? items.filter((r) => r.qid === qid) : items;
});

route('POST', '/api/ratings', async (req) => {
  const body = await readBody<{ qid?: string; value?: string; note?: unknown }>(req);
  if (!body.qid || !loadBank().byId.has(body.qid)) throw new HttpError(400, 'Unknown question id');
  if (body.value !== 'up' && body.value !== 'down') throw new HttpError(400, "value must be 'up' or 'down'");
  return addRating(body.qid, body.value, typeof body.note === 'string' ? body.note : undefined);
});
