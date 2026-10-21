// Full-text search over questions and notes (SQLite FTS5 index, fallback scan when unavailable).
//   GET /api/search?q=<words>&scope=all|questions|notes&limit=20 → SearchResponse (limit per kind, best first)
import { HttpError, route } from '../http.ts';
import { search, warmSearchIndex, type SearchScope } from '../lib/search.ts';

const SCOPES: SearchScope[] = ['all', 'questions', 'notes'];

route('GET', '/api/search', (_req, url) => {
  const q = (url.searchParams.get('q') ?? '').slice(0, 200);
  const scope = (url.searchParams.get('scope') ?? 'all') as SearchScope;
  if (!SCOPES.includes(scope)) throw new HttpError(400, `scope must be one of ${SCOPES.join(' | ')}`);
  const limit = Number(url.searchParams.get('limit') ?? 20);
  return search(q, { scope, limit: Number.isFinite(limit) ? limit : 20 });
});

// Build / refresh the index shortly after start, so the first search does not pay for it.
setTimeout(() => {
  try {
    warmSearchIndex();
  } catch (e) {
    console.error('search index failed', e);
  }
}, 1500).unref();
