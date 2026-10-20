import type { AnswerRecord, DomainId, Question, QuestionState, SelectionFilters } from './types.ts';

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
    if (has(f.requirements) && !(q.requirements ?? []).some((r) => f.requirements!.includes(r))) return false;
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

/**
 * [v5] The correction set of an attempt — what the result page's "🩹 Chữa N câu" stepper walks through and mode 'retest'
 * asks again: first-attempt answers (no relearning retry, not skipped) that the learner saw (a pick or time spent) and got
 * wrong, or got right while unsure. Confident errors (a pick, no unsure, no hint) first, then the other errors, then the
 * unsure right answers; each question once, in answer order within a group.
 */
export function retestIds(answers: readonly Pick<AnswerRecord, 'q' | 'ok' | 'pick' | 't' | 'unsure' | 'hinted' | 'relearn' | 'skipped'>[]): string[] {
  const tiers: string[][] = [[], [], []];
  const seen = new Set<string>();
  for (const r of answers) {
    if (r.relearn || r.skipped || seen.has(r.q) || (!r.pick && !(r.t > 0))) continue;
    seen.add(r.q);
    if (!r.ok) tiers[r.pick && !r.unsure && !r.hinted ? 0 : 1].push(r.q);
    else if (r.unsure) tiers[2].push(r.q);
  }
  return tiers.flat();
}

/** Any content filter set (packs, topics, domains, …, requirements, search)? Empty = the whole pool. */
export function hasFilters(f: SelectionFilters | undefined): boolean {
  if (!f) return false;
  return Object.entries(f).some(([k, v]) => (k === 'search' ? typeof v === 'string' && v.trim() !== '' : Array.isArray(v) && v.length > 0));
}

/** What practice modes may serve — every mode except a sealed exam (see practicePool). */
export interface PracticeScope {
  sealed?: Iterable<string>; // ids held back in sealed forms (/api/bank `sealed`, server sealed.ts sealedIds())
  excludeOutOfScope?: boolean; // config practice.exclude_out_of_scope (explicit pack / ids requests keep these questions)
}

/**
 * Questions practice modes may serve: active, not held back in a sealed form and — with `excludeOutOfScope`
 * (practice.exclude_out_of_scope) — not answered by an out-of-scope service. Shared by the server (select.ts) and the
 * web (NewTest counts) so the numbers on screen match the test that gets built.
 */
export function practicePool<T extends Pick<Question, 'id' | 'status'> & { outOfScope?: boolean }>(qs: readonly T[], scope: PracticeScope = {}): T[] {
  const sealed = scope.sealed instanceof Set ? (scope.sealed as Set<string>) : new Set(scope.sealed ?? []);
  return qs.filter((q) => q.status === 'active' && !sealed.has(q.id) && !(scope.excludeOutOfScope && q.outOfScope));
}

/**
 * Even split of `n` questions over the exam-guide tasks (diagnostic: 28 → 2 per task 1.1–4.4, 14 → 1 per task); a
 * remainder goes to the tasks of the heaviest domains first, then in task order. Shared by select.ts and NewTest.
 */
export function taskQuotas(
  n: number,
  tasks: readonly { id: string; domain: string }[],
  domains: readonly { id: string; weight: number }[],
): Map<string, number> {
  const out = new Map<string, number>();
  if (!tasks.length) return out;
  const weight = new Map(domains.map((d) => [d.id, d.weight]));
  const base = Math.floor(Math.max(0, n) / tasks.length);
  const extra = new Set(
    tasks
      .map((t, i) => ({ t, i }))
      .sort((a, b) => (weight.get(b.t.domain) ?? 0) - (weight.get(a.t.domain) ?? 0) || a.i - b.i)
      .slice(0, Math.max(0, n) % tasks.length)
      .map((e) => e.t.id),
  );
  for (const t of tasks) out.set(t.id, base + (extra.has(t.id) ? 1 : 0));
  return out;
}

/** FNV-1a (32 bit) of `seed:text` — a stable pseudo-random rank: the same on every machine and in every run. */
export function stableHash(text: string, seed = ''): number {
  const s = seed ? `${seed}:${text}` : text;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** SAA-C03 domain weights (bank/taxonomy.yaml) — newOrder's default when the caller passes no taxonomy domains. */
export const EXAM_DOMAIN_WEIGHTS: readonly { id: DomainId; weight: number }[] = [
  { id: 'secure', weight: 30 },
  { id: 'resilient', weight: 26 },
  { id: 'performance', weight: 24 },
  { id: 'cost', weight: 20 },
];

const NEW_ORDER_SEED = 'new-order-v1';

/**
 * Order in which never-seen questions are served: mode 'new' takes the first N, the ENRICH "upcoming" tier looks at the
 * next ones. Deterministic and stable — within a domain questions follow a seeded hash of their id (adding questions
 * never reorders the existing ones) and domains are interleaved by exam weight (30/26/24/20 → about 3/3/2/2 in every 10);
 * a domain that runs out leaves its slots to the others. Pass `bank.taxonomy.domains` for the configured weights;
 * questions of an unknown domain (or without one) come last, in hash order. Callers pass the never-seen questions.
 */
export function newOrder<T extends Pick<Question, 'id'> & { domain?: string }>(
  qs: readonly T[],
  domains: readonly { id: string; weight: number }[] = EXAM_DOMAIN_WEIGHTS,
): T[] {
  const rank = new Map(qs.map((q) => [q, stableHash(q.id, NEW_ORDER_SEED)] as const));
  const byRank = (a: T, b: T) => rank.get(a)! - rank.get(b)! || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const known = domains.filter((d) => d.weight > 0);
  const lists = known.map((d) => qs.filter((q) => q.domain === d.id).sort(byRank));
  const rest = qs.filter((q) => !known.some((d) => d.id === q.domain)).sort(byRank);
  const total = known.reduce((s, d) => s + d.weight, 0);
  const taken = known.map(() => 0);
  const out: T[] = [];
  const target = qs.length - rest.length;
  while (out.length < target) {
    // the domain furthest behind its share of the first k slots (ties: the heavier domain, then taxonomy order)
    const k = out.length + 1;
    let best = -1;
    let bestDeficit = -Infinity;
    for (let i = 0; i < known.length; i++) {
      if (taken[i] >= lists[i].length) continue;
      const deficit = (k * known[i].weight) / total - taken[i];
      if (best < 0 || deficit > bestDeficit + 1e-9 || (deficit > bestDeficit - 1e-9 && known[i].weight > known[best].weight)) {
        best = i;
        bestDeficit = deficit;
      }
    }
    out.push(lists[best][taken[best]++]);
  }
  return out.concat(rest);
}
