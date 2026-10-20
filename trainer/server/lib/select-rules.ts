// [v5 σ] Selection rules shared by every test mode (select.ts) and "Học hôm nay" (today.ts):
//   • pools: active → practice (not held back in a sealed form) → in scope (practice.exclude_out_of_scope);
//   • sibling clusters (clusters.ts, Design C3): at most one question per cluster per session, and the siblings of a
//     question answered today are buried until tomorrow. Exceptions: explicit ids / pack / coach lists, retest and
//     qualifier families. Discriminate keeps one per cluster but does not bury (its pair pools are small);
//   • sibling substitution (srs + today): a mature due question (stability ≥ srs.sibling_swap_days) is served as a
//     cluster mate never answered, with `ref.for` = the original (FSRS credits both — stats.ts);
//   • topic interleaving, seeded deterministic ranks, and weak-practice weights on shrunk rates (shared/evidence.ts, C8);
//   • the λ / γ1 helpers behind injectable `deps`: unit tests pass small fakes, the server uses the real functions.
import type { AppConfig } from '../config.ts';
import type { BankState } from './bank.ts';
import { clusterIndex, type ClusterIndex } from './clusters.ts';
import { confusableGroups, contrastPool } from './confusables.ts';
import { advanceQueue, examPhase, newQuota } from './exam-schedule.ts';
import { pausedLeeches } from './leech.ts';
import { loadGoal } from './progress.ts';
import { isUnviewed } from './regrade.ts';
import { loadSealed, sealedIds } from './sealed.ts';
import { answeredOn, isMastered, learnerPace } from './stats.ts';
import { localDateKey } from './time.ts';
import { PRIOR_K, estimate } from '../../shared/evidence.ts';
import { stableHash } from '../../shared/filters.ts';
import type {
  AnswerRecord,
  Attempt,
  ConfusableGroup,
  DataVersions,
  ExamGoal,
  ExamPhaseInfo,
  NewQuota,
  Plan,
  Question,
  QuestionState,
  SealedForm,
  SealedState,
} from '../../shared/types.ts';

/** The λ / γ1 helpers selection relies on (Design C1–C4). `SelectCtx.deps` overrides any of them (unit tests). */
export interface SelectDeps {
  /** Learner speed: median t / est of recent answers, 1 = the estimate (stats.ts learnerPace). */
  pace(attempts: Attempt[]): number;
  /** Ids answered (viewed) on a local day, incl. the originals siblings stood in for (stats.ts answeredOn). */
  answeredOn(attempts: Attempt[], day: string): Set<string>;
  /** Exam phase on a local day (exam-schedule.ts examPhase; undefined without an exam date or with srs.exam_aware off). */
  phase(goal: ExamGoal, today: string, cfg: AppConfig): ExamPhaseInfo | undefined;
  /** Today's new-question quota (exam-schedule.ts newQuota). */
  quota(ctx: SelectCtx, goal: ExamGoal, today: string): NewQuota | undefined;
  /** Final-review ("ôn chốt") queue: not-yet-due ids, lowest recall on exam day first (exam-schedule.ts advanceQueue). */
  advance(ctx: SelectCtx, goal: ExamGoal, today: string, limit: number): string[];
  /** Leeches the learner parked through a local day (leech.ts pausedLeeches). */
  paused(today: string): Set<string>;
  /** Questions where two of `services` compete, with the service of the correct option (confusables.ts). */
  contrastPool(bank: BankState, services: string[]): { question: Question; answerService: string }[];
  /** Confusable service groups (the learner's confirmed confusions first when `attempts` are given — confusables.ts). */
  confusableGroups(bank: BankState, attempts?: Attempt[]): ConfusableGroup[];
}

export interface SelectCtx {
  bank: BankState;
  states: Map<string, QuestionState>;
  cfg: AppConfig;
  plans: Plan[];
  attempts?: Attempt[]; // needed for the SRS daily cap, today's answers, retry / yesterday / retest
  sealed?: SealedState; // sealed forms — default: sealed.ts (sealedIds / loadSealed); unit tests pass their own
  goal?: ExamGoal; // learner goal — default: progress.ts loadGoal (goal.esl, minutesPerDay, examDate)
  // [v5]
  now?: number; // clock in ms (default Date.now()): the local date decides "today", due dates and the phase
  clusters?: ClusterIndex; // sibling clusters — default: clusters.ts clusterIndex(bank)
  deps?: Partial<SelectDeps>; // λ / γ1 helpers — default: the real ones
  versions?: DataVersions; // server context: data versions (part of the deterministic "today" seed)
}

/** What the exam-schedule helpers read (exam-schedule.ts ScheduleCtx). */
const scheduleCtx = (ctx: SelectCtx) => ({ cfg: ctx.cfg, bank: ctx.bank, attempts: ctx.attempts ?? [], states: ctx.states });

const DEFAULT_DEPS: SelectDeps = {
  pace: learnerPace,
  answeredOn,
  phase: examPhase,
  quota: (ctx, goal, today) => newQuota(scheduleCtx(ctx), goal, today),
  advance: (ctx, goal, today, limit) => advanceQueue(scheduleCtx(ctx), goal, today, limit),
  paused: pausedLeeches,
  contrastPool,
  confusableGroups,
};

export function depsOf(ctx: SelectCtx): SelectDeps {
  return ctx.deps ? { ...DEFAULT_DEPS, ...ctx.deps } : DEFAULT_DEPS;
}

export function nowOf(ctx: SelectCtx): number {
  return typeof ctx.now === 'number' && Number.isFinite(ctx.now) ? ctx.now : Date.now();
}

/** Local YYYY-MM-DD of a time in ms. */
export const dayOf = (ms: number): string => localDateKey(new Date(ms));

/** A first-attempt answer the learner saw: no in-session relearning retry, no skipped or never-viewed blank. */
export function isFirstView(r: AnswerRecord): boolean {
  return !r.relearn && !r.skipped && (!isUnviewed(r) || !!r.grade);
}

/** Local YYYY-MM-DD `n` calendar days before `day` (DST-safe: noon arithmetic). */
export function daysBefore(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d - n, 12));
}

// ── pools ───────────────────────────────────────────────────────────────────

/** Ids held back in forms that are still sealed (hidden from every practice mode). */
export function heldBack(ctx: SelectCtx): Set<string> {
  if (ctx.sealed) return new Set(ctx.sealed.forms.filter((f) => f.status === 'sealed').flatMap((f) => f.ids));
  return sealedIds();
}

export function sealedForms(ctx: SelectCtx): SealedForm[] {
  return (ctx.sealed ?? loadSealed()).forms;
}

export function goalOf(ctx: SelectCtx): ExamGoal {
  if (ctx.goal) return ctx.goal;
  try {
    return loadGoal();
  } catch {
    return {};
  }
}

export interface Pools {
  active: Question[];
  practice: Question[]; // not held back in a sealed form
  inScope: Question[]; // …and not answered by an out-of-scope service (practice.exclude_out_of_scope)
  held: Set<string>;
}

/** Active questions → not sealed (practice) → in scope (what filter-based practice modes draw from). */
export function pools(ctx: SelectCtx): Pools {
  const held = heldBack(ctx);
  const active = ctx.bank.questions.filter((q) => q.status === 'active');
  const practice = held.size ? active.filter((q) => !held.has(q.id)) : active;
  const inScope = (ctx.cfg.practice?.exclude_out_of_scope ?? true) ? practice.filter((q) => !q.outOfScope) : practice;
  return { active, practice, inScope, held };
}

// ── variant families + sibling clusters ─────────────────────────────────────

const familyMemo = new WeakMap<readonly Question[], Map<string, string>>();

/**
 * Variant families: connected components of the `variant_of` links (either direction, sibling variants included),
 * as question id → family id (questions without links are their own family and are not in the map). Sibling clusters
 * (clusters.ts) contain these links; this map stays for callers that only want explicit variants.
 */
export function variantFamilies(bank: Pick<BankState, 'questions'>): Map<string, string> {
  const hit = familyMemo.get(bank.questions);
  if (hit) return hit;
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    for (;;) {
      const p = parent.get(x);
      if (p === undefined || p === x) return x;
      const gp = parent.get(p);
      if (gp !== undefined && gp !== p) parent.set(x, gp); // path halving
      x = p;
    }
  };
  for (const q of bank.questions) {
    for (const v of q.variantOf ?? []) {
      if (!v || v === q.id) continue;
      const a = find(q.id);
      const b = find(v);
      if (a !== b) parent.set(a < b ? b : a, a < b ? a : b); // the smaller id is the root: deterministic
    }
  }
  const families = new Map<string, string>();
  for (const id of parent.keys()) families.set(id, find(id));
  familyMemo.set(bank.questions, families);
  return families;
}

/** Sibling clusters of the bank: `ctx.clusters` (tests) or clusters.ts (memoized per bank object and version). */
export function clustersOf(ctx: SelectCtx): ClusterIndex {
  return ctx.clusters ?? clusterIndex(ctx.bank);
}

/** Today's view of the clusters: what was answered today and which siblings that buries. */
export interface SessionRules {
  today: string; // local YYYY-MM-DD
  answered: Set<string>; // answered (viewed) today, incl. originals a sibling stood in for
  key(id: string): string; // sibling cluster of a question (itself when it has no sibling)
  members(id: string): string[]; // its cluster, the question included (bank order)
  buried(id: string): boolean; // a cluster mate was answered today and this question was not
}

interface Groups {
  of: Map<string, string>; // question id → group key
  members: Map<string, string[]>; // group key → ids (bank order)
}

const groupMemo = new WeakMap<ClusterIndex, { questions: readonly Question[]; groups: Groups }>();

/**
 * Selection groups = sibling clusters merged with the variant families: two variants of an original that was deleted
 * are still siblings for selection (clusters.ts only links existing questions). Memoized per cluster index and bank.
 */
function selectionGroups(ctx: SelectCtx, index: ClusterIndex): Groups {
  const hit = groupMemo.get(index);
  if (hit?.questions === ctx.bank.questions) return hit.groups;
  const families = variantFamilies(ctx.bank);
  const famCluster = new Map<string, string>(); // variant family → first cluster seen
  const alias = new Map<string, string>(); // cluster → representative cluster
  const rep = (c: string): string => {
    let r = c;
    while (alias.has(r) && alias.get(r) !== r) r = alias.get(r)!;
    return r;
  };
  for (const q of ctx.bank.questions) {
    const fam = families.get(q.id) ?? q.id; // a family root is not a key of the map
    const c = rep(index.of.get(q.id) ?? q.id);
    const prev = famCluster.get(fam);
    if (prev === undefined) famCluster.set(fam, c);
    else {
      const p = rep(prev);
      if (p !== c) alias.set(c < p ? p : c, c < p ? c : p);
    }
  }
  const of = new Map<string, string>();
  const members = new Map<string, string[]>();
  for (const q of ctx.bank.questions) {
    if (of.has(q.id)) continue;
    const k = rep(index.of.get(q.id) ?? q.id);
    of.set(q.id, k);
    const l = members.get(k);
    if (l) l.push(q.id);
    else members.set(k, [q.id]);
  }
  const groups = { of, members };
  groupMemo.set(index, { questions: ctx.bank.questions, groups });
  return groups;
}

const rulesMemo = new WeakMap<SelectCtx, SessionRules>();

export function sessionRules(ctx: SelectCtx): SessionRules {
  const today = dayOf(nowOf(ctx));
  const hit = rulesMemo.get(ctx);
  if (hit?.today === today) return hit;
  const answered = depsOf(ctx).answeredOn(ctx.attempts ?? [], today);
  const groups = selectionGroups(ctx, clustersOf(ctx));
  const key = (id: string) => groups.of.get(id) ?? id;
  const members = (id: string) => groups.members.get(key(id)) ?? [id];
  const hot = new Set<string>();
  for (const id of answered) hot.add(key(id));
  const rules: SessionRules = { today, answered, key, members, buried: (id) => !answered.has(id) && hot.has(key(id)) };
  rulesMemo.set(ctx, rules);
  return rules;
}

/** Keeps the first item of every cluster (`used` = clusters already in the session; it is updated). */
export function onePerCluster<T>(items: readonly T[], key: (x: T) => string, used: Set<string> = new Set()): T[] {
  const out: T[] = [];
  for (const x of items) {
    const k = key(x);
    if (used.has(k)) continue;
    used.add(k);
    out.push(x);
  }
  return out;
}

/** Hash seed of the substitute choice: the same unseen sibling stands in for a question on every day. */
const SWAP_SEED = 'sibling-swap-v1';

/**
 * Sibling substitution (Design C3): a due question whose FSRS stability reached srs.sibling_swap_days is served as a
 * cluster mate never answered (and `eligible`: in the session's pool, not buried, not taken) — the first such mate in a
 * stable hash order. Undefined = serve the question itself.
 */
export function swapFor(ctx: SelectCtx, rules: SessionRules, q: Question, eligible: (id: string) => boolean): Question | undefined {
  const days = ctx.cfg.srs?.sibling_swap_days ?? 0;
  const s = ctx.states.get(q.id);
  if (!(days > 0) || !s || !((s.stability ?? 0) >= days)) return undefined;
  let best: string | undefined;
  let bestRank = Infinity;
  for (const id of rules.members(q.id)) {
    if (id === q.id || ctx.states.has(id) || !eligible(id)) continue;
    const rank = stableHash(id, SWAP_SEED);
    if (rank < bestRank || (rank === bestRank && best !== undefined && id < best)) {
      best = id;
      bestRank = rank;
    }
  }
  return best === undefined ? undefined : ctx.bank.byId.get(best);
}

// ── deterministic order ─────────────────────────────────────────────────────

/** A uniform number in (0, 1) from a stable hash: the same for one (id, seed) on every machine and in every run. */
export function seededUnit(id: string, seed: string): number {
  return (stableHash(id, seed) + 0.5) / 4294967296;
}

/** Weighted order without replacement (Efraimidis–Spirakis) on seeded uniforms: deterministic for one seed. */
export function seededWeightedOrder<T>(items: readonly T[], id: (x: T) => string, weight: (x: T) => number, seed: string): T[] {
  return items
    .map((x) => ({ x, id: id(x), k: Math.log(seededUnit(id(x), seed)) / Math.max(1e-6, weight(x)) }))
    .sort((a, b) => b.k - a.k || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((e) => e.x);
}

/**
 * Interleaves `items` (given in priority order) so that no two neighbours share a topic when that can be avoided: the
 * next item is the highest-priority one of another topic, unless a topic has to be placed now for the rest to stay
 * arrangeable. Without any other topic left, the order stays as given.
 */
export function interleave<T>(items: readonly T[], topic: (x: T) => string): T[] {
  const rest = [...items];
  const count = new Map<string, number>();
  for (const x of rest) count.set(topic(x), (count.get(topic(x)) ?? 0) + 1);
  const out: T[] = [];
  let last: string | undefined;
  while (rest.length) {
    const n = rest.length - 1; // items left after this pick
    // largest counts (two topics) to test "the rest stays arrangeable" in O(1) per candidate
    let t1: string | undefined;
    let c1 = 0;
    let c2 = 0;
    for (const [t, c] of count) {
      if (c > c1) {
        c2 = c1;
        c1 = c;
        t1 = t;
      } else if (c > c2) c2 = c;
    }
    // after placing topic X: X may fill at most ⌊n/2⌋ of the remaining slots (not the first), any other topic ⌈n/2⌉
    const feasible = (x: string) => (count.get(x) ?? 0) - 1 <= Math.floor(n / 2) && (t1 === x ? c2 : c1) <= Math.ceil(n / 2);
    let pick = -1;
    for (let i = 0; i < rest.length; i++) {
      const t = topic(rest[i]);
      if (t !== last && feasible(t)) {
        pick = i;
        break;
      }
    }
    if (pick < 0) pick = rest.findIndex((x) => topic(x) !== last);
    if (pick < 0) pick = 0;
    const [x] = rest.splice(pick, 1);
    const t = topic(x);
    count.set(t, (count.get(t) ?? 1) - 1);
    if (!count.get(t)) count.delete(t);
    out.push(x);
    last = t;
  }
  return out;
}

// ── weak practice on shrunk rates (C8) ──────────────────────────────────────

/** The learner's overall first-answer rate from the states (0.6 without any answer: unknown ≠ strong). */
export function baseRate(states: Map<string, QuestionState>): number {
  let n = 0;
  let c = 0;
  for (const s of states.values()) {
    n += s.attempts;
    c += s.correct;
  }
  return n > 0 ? c / n : 0.6;
}

/**
 * Weak-practice weight of a question (mode 'weak'): accuracy per topic, tag and service shrunk toward the learner's
 * own base rate (Beta prior, k = PRIOR_K; a service also leans on its taxonomy topic — shared/evidence.ts), the weakest
 * dimension counts. Last answer wrong / unsure and not-yet-mastered questions weigh more; never-seen ones a bit less.
 */
export function weakWeight(ctx: SelectCtx): (q: Question) => number {
  const tax = ctx.bank.taxonomy;
  const agg = new Map<string, { n: number; c: number }>();
  const add = (k: string, n: number, c: number) => {
    const g = agg.get(k);
    if (g) {
      g.n += n;
      g.c += c;
    } else agg.set(k, { n, c });
  };
  for (const s of ctx.states.values()) {
    const q = ctx.bank.byId.get(s.id);
    if (!q || !s.attempts) continue;
    add(`topic:${q.topic}`, s.attempts, s.correct);
    for (const t of q.tags) add(`tag:${t}`, s.attempts, s.correct);
    for (const sv of q.services) add(`svc:${sv}`, s.attempts, s.correct);
  }
  const p0 = baseRate(ctx.states);
  const memo = new Map<string, number>();
  const rate = (k: string, prior: number): number => {
    const hit = memo.get(k);
    if (hit !== undefined) return hit;
    const g = agg.get(k);
    const v = g ? estimate(g.c, g.n, { p: prior, k: PRIOR_K }).shrunk : prior;
    memo.set(k, v);
    return v;
  };
  const topicRate = (t: string) => rate(`topic:${t}`, p0);
  return (q) => {
    const s = ctx.states.get(q.id);
    const dims = [
      topicRate(q.topic),
      ...q.tags.map((t) => rate(`tag:${t}`, p0)),
      ...q.services.map((sv) => {
        const parent = tax.services?.[sv]?.topic;
        return rate(`svc:${sv}`, parent ? topicRate(parent) : p0);
      }),
    ];
    let w = 0.2 + 3 * (1 - Math.min(...dims));
    if (s?.lastOk === false) w += 2;
    if (s?.lastUnsure) w += 1;
    if (isMastered(s, ctx.cfg)) w *= 0.25;
    if (!s) w *= 0.8;
    return w;
  };
}
