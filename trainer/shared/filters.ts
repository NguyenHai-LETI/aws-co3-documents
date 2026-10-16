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
    if (has(f.tasks) && !(q.task && f.tasks!.includes(q.task))) return false;
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

/** "Mastered": FSRS stability ≥ srs.mastered_stability_days, or Leitner box ≥ srs.mastered_box (pass `meta.srs` on the web). */
export function isMasteredState(
  s: QuestionState | undefined,
  srs: { algorithm?: string; mastered_stability_days: number; mastered_box: number },
): boolean {
  if (!s) return false;
  if (srs.algorithm === 'leitner') return s.box >= srs.mastered_box;
  return (s.stability ?? 0) >= srs.mastered_stability_days;
}

/** Review order: lowest recall probability first (FSRS), otherwise the longest overdue first. */
export function compareDue(a: QuestionState | undefined, b: QuestionState | undefined): number {
  const ra = a?.retrievability;
  const rb = b?.retrievability;
  if (ra !== undefined && rb !== undefined && ra !== rb) return ra - rb;
  return (a?.dueAt ?? '').localeCompare(b?.dueAt ?? '');
}

/**
 * Pool of questions a mode would draw from (before count/sampling).
 * `srsLimit` (e.g. `/api/state` → `counts.srsRemaining`) caps the SRS pool to today's review allowance.
 */
export function modePool(mode: string, pool: Question[], states: Record<string, QuestionState>, opts: { srsLimit?: number } = {}): Question[] {
  switch (mode) {
    case 'retry-wrong':
      return pool.filter((q) => states[q.id]?.lastOk === false);
    case 'srs': {
      const due = pool.filter((q) => isDueState(states[q.id])).sort((a, b) => compareDue(states[a.id], states[b.id]));
      return opts.srsLimit !== undefined && opts.srsLimit >= 0 ? due.slice(0, opts.srsLimit) : due;
    }
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
