import type { Question, QuestionState, SelectionFilters } from './types.ts';

export function applyFilters(qs: Question[], f: SelectionFilters = {}): Question[] {
  const has = (arr?: unknown[]) => Array.isArray(arr) && arr.length > 0;
  const search = f.search?.trim().toLowerCase();
  return qs.filter((q) => {
    if (has(f.packs) && !f.packs!.includes(q.pack)) return false;
    if (has(f.topics) && !f.topics!.includes(q.topic)) return false;
    if (has(f.domains) && !f.domains!.includes(q.domain)) return false;
    if (has(f.difficulties) && !f.difficulties!.includes(q.difficulty)) return false;
    if (has(f.origins) && !f.origins!.includes(q.origin)) return false;
    if (has(f.services) && !q.services.some((s) => f.services!.includes(s))) return false;
    if (has(f.tags) && !q.tags.some((t) => f.tags!.includes(t))) return false;
    if (search) {
      const hay = `${q.id} ${q.stem} ${q.options.map((o) => o.text).join(' ')} ${q.services.join(' ')} ${q.tags.join(' ')} ${q.concept ?? ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

export function isDueState(s: QuestionState | undefined, now = Date.now()): boolean {
  return !!s?.dueAt && new Date(s.dueAt).getTime() <= now;
}

/** Pool of questions a mode would draw from (before count/sampling). */
export function modePool(mode: string, pool: Question[], states: Record<string, QuestionState>): Question[] {
  switch (mode) {
    case 'retry-wrong':
      return pool.filter((q) => states[q.id]?.lastOk === false);
    case 'srs':
      return pool.filter((q) => isDueState(states[q.id]));
    case 'new':
      return pool.filter((q) => !states[q.id]);
    case 'flagged':
      return pool.filter((q) => states[q.id]?.lastFlag || states[q.id]?.lastUnsure);
    case 'slow':
      return pool.filter((q) => (states[q.id]?.slowCount ?? 0) > 0);
    default:
      return pool;
  }
}
