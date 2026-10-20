// [v5 σ] "▶ Học hôm nay" (Design C1): one session that fills a minute budget with recent errors, FSRS reviews, the
// weakest exam-guide tasks and new questions (or, close to the exam, final-review questions), interleaved by topic.
// Deterministic: the same data, local date and budget give the same set (seed = date + budget + data version).
// GET /api/today previews this composition (TodayPreview); POST /api/tests {mode: 'today'} builds it (select.ts).
//
// Budget: minutes = request > goal.minutesPerDay > practice.today_minutes, capped by the exam phase (ExamPhaseInfo
// .maxMinutes: light 30′, exam day 10′) → seconds. A question costs est × pace (learnerPace). A question fits a share when
// at least half of it does (used + cost/2 ≤ cap), so a session ends within half a question of its budget.
// Fill order:
//   1. retry  ≤ 20 % — questions whose latest answer (3 days back, today excluded) was wrong / unsure / hinted; a miss in
//      a retest ("cần học lại", 7 days) first, then confident errors, other errors, unsure right answers;
//   2. review ≤ 50 % — FSRS due, (1 − R) × domain weight first, within srs.daily_limit (reviewQueue().remaining); paused
//      leeches skipped; a mature due question may be served as an unseen sibling (ref.for, select-rules.ts swapFor);
//   3. phase — consolidate: the final-review queue (advanceQueue) replaces new questions; light / exam day: only retry and
//      confident errors (any age) fill the (capped) budget;
//   4. the rest ≈ 50/50 — weak: the weakest exam-guide tasks by shrunk accuracy (task → domain → overall prior, C8),
//      not-yet-mastered questions of one task after the other; new: never seen, within today's NewQuota
//      (perDay − doneToday), domains ordered by weight × coverage deficit. Each takes what the other leaves;
//   5. anything left — quick practice (seeded, not-yet-mastered first). Weak / quick may serve never-seen questions
//      beyond the quota (e.g. past the new-question cutoff) unless the phase forbids new ones or the quota is paused.
// Value model: with ≥ VALUE_MODEL_ANSWERS viewed answers, ties inside a share go to the cheaper question and reviews are
// ranked by value per minute ((1 − R) × weight ÷ cost); before that the fixed priority alone (Design C1).
// Session rules: one question per sibling cluster, never a question answered today nor a sibling of one, interleaved by
// topic, practice feedback with in-session relearning (select.ts sets them on the session).
import type { BankState } from './bank.ts';
import { isDue, isMastered, isParkedLeech, reviewQueue } from './stats.ts';
import { isAnswer } from './regrade.ts';
import { ONBOARDING_TRIGGER } from './onboarding.ts';
import { SPRINT_TRIGGER } from './sprint.ts';
import { DAY_MS } from './time.ts';
import { PRIOR_K, estimate } from '../../shared/evidence.ts';
import { compareDue, newOrder, stableHash } from '../../shared/filters.ts';
import { countWords } from '../../shared/timing.ts';
import {
  baseRate,
  dayOf,
  daysBefore,
  depsOf,
  goalOf,
  heldBack,
  interleave,
  isFirstView,
  nowOf,
  onePerCluster,
  pools,
  seededWeightedOrder,
  sessionRules,
  swapFor,
  type SelectCtx,
  type SessionRules,
} from './select-rules.ts';
import type { AnswerRecord, Attempt, ExamPhaseInfo, NewQuota, Plan, Question, TestMode, TodayMix, TodayPreview } from '../../shared/types.ts';

export const TODAY_DEFAULT_MINUTES = 25;
export const TODAY_MAX_MINUTES = 240;
/** Shares of the budget (Design C1). */
export const RETRY_SHARE = 0.2;
export const REVIEW_SHARE = 0.5;
/** Retry window (days before today) and the longer one for retest misses. */
export const RETRY_DAYS = 3;
export const RETEST_MISS_DAYS = 7;
/** Viewed answers before the value model replaces the fixed priority. */
export const VALUE_MODEL_ANSWERS = 200;
/** A coach plan session younger than this (and not done) is offered before today's mix (TodayMix.coach). */
export const COACH_FRESH_DAYS = 3;
/** Final-review ids asked from advanceQueue (more than any budget can hold). */
const ADVANCE_LIMIT = 300;
/** Micro / listen candidates: stems of at most this many words. */
export const MICRO_MAX_WORDS = 40;

export type TodayShare = 'retry' | 'review' | 'weak' | 'new' | 'advance' | 'extra';

export interface TodayItem {
  q: Question; // the question served
  share: TodayShare;
  for?: string; // sibling substitution: the due question this one stands in for
}

export interface TodayPlan {
  minutes: number; // budget after the phase cap
  items: TodayItem[]; // session order (interleaved by topic)
  mix: TodayMix;
  label: string; // "25′ · 28 câu (12 ôn · 6 làm lại · 10 vá task 1.2)"
  phase?: ExamPhaseInfo;
  quota?: NewQuota;
  notes: string[]; // why something is held back (Vietnamese)
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** The learner's daily study goal in minutes: goal.minutesPerDay, else practice.today_minutes. */
export function dailyGoalMinutes(ctx: SelectCtx): number {
  const g = goalOf(ctx).minutesPerDay;
  const v = typeof g === 'number' && g > 0 ? g : ctx.cfg.practice?.today_minutes;
  return clamp(Math.round(typeof v === 'number' && v > 0 ? v : TODAY_DEFAULT_MINUTES), 1, TODAY_MAX_MINUTES);
}

/** Budget of a "today" session: the request when it is a positive number, else the daily goal. */
export function todayMinutes(ctx: SelectCtx, requested?: number): number {
  const r = Number(requested);
  return requested !== undefined && requested !== null && Number.isFinite(r) && r > 0 ? clamp(Math.round(r), 1, TODAY_MAX_MINUTES) : dailyGoalMinutes(ctx);
}

/** "25′ · 28 câu (12 ôn · 6 làm lại · 10 vá task 1.2)". */
export function todayLabel(mix: TodayMix, count: number): string {
  const weakWhat = mix.weakTasks?.length ? `task ${mix.weakTasks.join(', ')}` : 'điểm yếu';
  const parts = [
    mix.review ? `${mix.review} ôn` : '',
    mix.retry ? `${mix.retry} làm lại` : '',
    mix.weak ? `${mix.weak} vá ${weakWhat}` : '',
    mix.new ? `${mix.new} mới` : '',
    mix.advance ? `${mix.advance} ôn chốt` : '',
    mix.extra ? `${mix.extra} luyện thêm` : '',
  ].filter(Boolean);
  return `${mix.minutes}′ · ${count} câu${parts.length ? ` (${parts.join(' · ')})` : ''}`;
}

// ── history helpers ─────────────────────────────────────────────────────────

interface LastAnswer {
  r: AnswerRecord;
  at: number;
  day: string;
  mode: TestMode;
}

const digestMemo = new WeakMap<Attempt[], string>();

/**
 * Content digest of the history (attempt ids + answer counts, sorted): part of the "today" seed, so the same data gives
 * the same set on every machine (file mtimes are not content).
 */
export function historyDigest(attempts: Attempt[]): string {
  let d = digestMemo.get(attempts);
  if (d === undefined) {
    const parts = attempts.map((a) => `${a.id}:${a.answers.length}`).sort();
    d = `${attempts.length}.${stableHash(parts.join('|'), 'history').toString(36)}`;
    digestMemo.set(attempts, d);
  }
  return d;
}

const lastMemo = new WeakMap<Attempt[], Map<string, LastAnswer>>();

/** Latest first-attempt answer of every question (non-rushed attempts, chronological; memoized per attempts array). */
function lastAnswers(attempts: Attempt[]): Map<string, LastAnswer> {
  const hit = lastMemo.get(attempts);
  if (hit) return hit;
  const out = new Map<string, LastAnswer>();
  const ordered = attempts
    .map((a, i) => ({ a, i, at: Date.parse(a.finished) }))
    .filter((x) => !x.a.rushed && Number.isFinite(x.at))
    .sort((x, y) => x.at - y.at || x.i - y.i);
  for (const { a, at } of ordered) {
    const day = dayOf(at);
    for (const r of a.answers) if (isFirstView(r)) out.set(r.q, { r, at, day, mode: a.mode });
  }
  lastMemo.set(attempts, out);
  return out;
}

/** Wrong with a pick, not marked unsure, no hint: the errors worth correcting first (hypercorrection). */
const confidentError = (r: AnswerRecord) => !r.ok && !!r.pick && !r.unsure && !r.hinted;

/**
 * Retry candidates, best first: retest misses (RETEST_MISS_DAYS) → confident errors → other errors → unsure / hinted right
 * answers of the last RETRY_DAYS days; `anyAge` adds older confident errors last (light phase). Latest answer counts.
 */
function retryCandidates(ctx: SelectCtx, rules: SessionRules, eligible: (q: Question) => boolean, anyAge: boolean): Question[] {
  const from = daysBefore(rules.today, RETRY_DAYS);
  const fromRetest = daysBefore(rules.today, RETEST_MISS_DAYS);
  const out: { q: Question; tier: number; at: number }[] = [];
  for (const [id, x] of lastAnswers(ctx.attempts ?? [])) {
    if (x.day >= rules.today) continue;
    const q = ctx.bank.byId.get(id);
    if (!q || !eligible(q)) continue;
    const r = x.r;
    let tier: number | undefined;
    if (x.mode === 'retest' && !r.ok && x.day >= fromRetest) tier = 0;
    else if (x.day >= from) tier = !r.ok ? (confidentError(r) ? 1 : 2) : r.unsure || r.hinted ? 3 : undefined;
    else if (anyAge && confidentError(r)) tier = 4;
    if (tier !== undefined) out.push({ q, tier, at: x.at });
  }
  return out.sort((a, b) => a.tier - b.tier || b.at - a.at || (a.q.id < b.q.id ? -1 : 1)).map((e) => e.q);
}

/** Viewed answers behind the states (non-rushed): the value model needs VALUE_MODEL_ANSWERS of them. */
function viewedAnswers(ctx: SelectCtx): number {
  let n = 0;
  for (const s of ctx.states.values()) n += s.attempts;
  return n;
}

/** Domain id → exam weight fraction. */
function domainWeights(bank: BankState): Map<string, number> {
  const total = bank.taxonomy.domains.reduce((s, d) => s + d.weight, 0) || 1;
  return new Map(bank.taxonomy.domains.map((d) => [d.id, d.weight / total]));
}

/**
 * The newest AI-coach plan session younger than COACH_FRESH_DAYS that is not done yet ("<planId>#<sessionId>"). Plans the
 * app writes itself (sprint / final week, onboarding) are calendars, not fresh coach advice: never offered here.
 */
export function freshCoachSession(plans: Plan[], now: number): string | undefined {
  for (const p of plans) {
    if (p.trigger === SPRINT_TRIGGER || p.trigger === ONBOARDING_TRIGGER) continue;
    const at = Date.parse(p.created);
    if (!Number.isFinite(at) || now - at > COACH_FRESH_DAYS * DAY_MS) continue;
    const s = p.sessions.find((x) => !x.done?.length);
    if (s) return `${p.id}#${s.id}`;
  }
  return undefined;
}

/** Studied today: viewed answers and Σ (t + rt) of non-rushed attempts; goal met at the daily goal minutes. */
export function doneToday(ctx: SelectCtx, today: string, goalMinutes: number): TodayPreview['done'] {
  let answers = 0;
  let seconds = 0;
  for (const a of ctx.attempts ?? []) {
    if (a.rushed || !a.finished || dayOf(Date.parse(a.finished)) !== today) continue;
    for (const r of a.answers) {
      // time of every record (relearning retries and opened blanks took time too); answers = real first answers only
      seconds += Math.max(0, r.t || 0) + Math.max(0, r.rt || 0);
      if (isAnswer(r)) answers++;
    }
  }
  return { answers, minutes: Math.round(seconds / 60), goalMet: answers > 0 && seconds >= goalMinutes * 60 };
}

// ── weak tasks (C8) ─────────────────────────────────────────────────────────

interface WeakGroup {
  key: string; // task id ("1.2") or "topic:<id>" when the bank has no task labels
  task?: string;
  rate: number; // shrunk accuracy
  n: number;
}

/**
 * Exam-guide tasks (or topics when no question carries a task) from the weakest shrunk accuracy up: task → its domain →
 * the learner's overall rate (prior strength PRIOR_K), more evidence first on ties, then exam weight.
 */
function weakGroups(ctx: SelectCtx, pool: Question[]): WeakGroup[] {
  const tax = ctx.bank.taxonomy;
  const byTask = pool.some((q) => q.task);
  const groupOf = (q: Question) => (byTask ? q.task : `topic:${q.topic}`);
  const agg = new Map<string, { n: number; c: number }>();
  const dom = new Map<string, { n: number; c: number }>();
  const add = (m: Map<string, { n: number; c: number }>, k: string, n: number, c: number) => {
    const g = m.get(k);
    if (g) {
      g.n += n;
      g.c += c;
    } else m.set(k, { n, c });
  };
  for (const s of ctx.states.values()) {
    const q = ctx.bank.byId.get(s.id);
    if (!q || !s.attempts) continue;
    const g = groupOf(q);
    if (g) add(agg, g, s.attempts, s.correct);
    add(dom, q.domain, s.attempts, s.correct);
  }
  const p0 = baseRate(ctx.states);
  const domRate = (d: string) => {
    const g = dom.get(d);
    return g ? estimate(g.c, g.n, { p: p0, k: PRIOR_K }).shrunk : p0;
  };
  const weight = domainWeights(ctx.bank);
  const keys = new Set<string>();
  for (const q of pool) {
    const g = groupOf(q);
    if (g) keys.add(g);
  }
  const taskDomain = new Map((tax.tasks ?? []).map((t) => [t.id, t.domain as string]));
  const out: (WeakGroup & { w: number })[] = [];
  for (const key of keys) {
    const g = agg.get(key);
    const domain = byTask ? taskDomain.get(key) : undefined;
    const prior = domain ? domRate(domain) : p0;
    out.push({ key, ...(byTask ? { task: key } : {}), rate: g ? estimate(g.c, g.n, { p: prior, k: PRIOR_K }).shrunk : prior, n: g?.n ?? 0, w: domain ? (weight.get(domain) ?? 0) : 0 });
  }
  return out.sort((a, b) => a.rate - b.rate || b.n - a.n || b.w - a.w || (a.key < b.key ? -1 : 1));
}

// ── the composer ────────────────────────────────────────────────────────────

const planMemo = new WeakMap<SelectCtx, Map<string, TodayPlan>>();

/** What "Học hôm nay" serves now for `budgetMinutes` (see the header). Memoized per context, budget and goal. */
export function composeToday(ctx: SelectCtx, budgetMinutes?: number): TodayPlan {
  const deps = depsOf(ctx);
  const now = nowOf(ctx);
  const rules = sessionRules(ctx);
  const today = rules.today;
  const goal = goalOf(ctx);
  const requested = todayMinutes(ctx, budgetMinutes);
  const paused = deps.paused(today);
  const held = heldBack(ctx);
  const memoKey = [today, requested, goal.examDate ?? '', held.size, [...paused].sort().join(',')].join('|');
  let memo = planMemo.get(ctx);
  const hit = memo?.get(memoKey);
  if (hit) return hit;

  const cfg = ctx.cfg;
  const tax = ctx.bank.taxonomy;
  const notes: string[] = [];
  const phase = cfg.srs?.exam_aware === false ? undefined : deps.phase(goal, today, cfg);
  let minutes = requested;
  if (phase?.maxMinutes !== undefined) {
    // the phase cap is per day: minutes already studied today count against it
    const left = Math.max(0, phase.maxMinutes - doneToday(ctx, today, 0).minutes);
    if (left < minutes) {
      minutes = left;
      notes.push(
        left > 0
          ? `Giai đoạn “${phase.label}”: tối đa ${phase.maxMinutes}′ mỗi ngày — hôm nay còn ${left}′.`
          : `Giai đoạn “${phase.label}”: đã học đủ ${phase.maxMinutes}′ hôm nay — nghỉ ngơi là phần ôn tốt nhất lúc này.`,
      );
    }
  }
  const rawPace = Number(deps.pace(ctx.attempts ?? []));
  const pace = Number.isFinite(rawPace) && rawPace > 0 ? clamp(rawPace, 0.3, 3) : 1;
  const cost = (q: Question) => Math.max(1, q.time) * pace;
  const budget = minutes * 60;
  const valueModel = viewedAnswers(ctx) >= VALUE_MODEL_ANSWERS;
  const weight = domainWeights(ctx.bank);
  // same data → same set on every machine: bank content version + a digest of the history (never file mtimes)
  const seed = `today:${today}|${minutes}|${ctx.bank.version}|${historyDigest(ctx.attempts ?? [])}`;

  // eligible: practice pool (active, not sealed, in scope), not answered today, no sibling answered today, not parked
  const { inScope } = pools(ctx);
  const eligible = (q: Question) => !rules.answered.has(q.id) && !rules.buried(q.id) && !isParkedLeech(ctx.states.get(q.id), today, paused);
  const pool = inScope.filter(eligible);
  const poolIds = new Set(pool.map((q) => q.id));
  const minCost = pool.reduce((m, q) => Math.min(m, cost(q)), Infinity);

  // new-question allowance: the phase and today's quota (exam-schedule.ts) — unlimited without an exam plan
  const quota = cfg.srs?.exam_aware === false ? undefined : deps.quota(ctx, goal, today);
  let newLeft = Infinity;
  if (phase && !phase.newQuestions) newLeft = 0;
  if (quota) newLeft = Math.min(newLeft, Math.max(0, quota.perDay - quota.doneToday));
  // the daily quota sizes the "new" share; weak / quick practice may still meet never-seen questions (past the new-question
  // cutoff the quota is 0, yet an empty session helps nobody) — unless new questions are forbidden outright: a phase
  // without new questions, or a review backlog above 2 × srs.daily_limit (the quota's own pause rule)
  const limit = cfg.srs?.daily_limit ?? 0;
  const heavyBacklog = limit > 0 && pool.reduce((n, q) => n + (isDue(ctx.states.get(q.id), now) ? 1 : 0), 0) > 2 * limit;
  const freshAllowed = !(phase && !phase.newQuestions) && !heavyBacklog;
  if (quota?.paused) notes.push(quota.paused);
  else if (phase && !phase.newQuestions && phase.id !== 'exam-day') notes.push(`Giai đoạn “${phase.label}”: không thêm câu mới.`);

  const items: TodayItem[] = [];
  const usedKeys = new Set<string>();
  let used = 0;
  /** Adds questions of `list` (best first) while they fit `cap` seconds; returns the seconds spent. */
  const take = (list: readonly Question[], share: TodayShare, cap: number, opts: { max?: number; swap?: boolean; force?: boolean } = {}): number => {
    let spent = 0;
    let n = 0;
    for (const q of list) {
      if (opts.max !== undefined && n >= opts.max) break;
      if (!opts.force && (cap - spent < minCost / 2 || budget - used < minCost / 2)) break;
      const k = rules.key(q.id);
      if (usedKeys.has(k)) continue;
      let served = q;
      let forId: string | undefined;
      if (opts.swap) {
        const sub = swapFor(ctx, rules, q, (id) => poolIds.has(id));
        if (sub) {
          served = sub;
          forId = q.id;
        }
      }
      const fresh = !forId && !ctx.states.has(served.id);
      if (fresh && (share === 'new' ? newLeft <= 0 : !freshAllowed)) continue;
      const c = cost(served);
      if (!opts.force && (spent + c / 2 > cap || used + c / 2 > budget)) continue;
      items.push({ q: served, share, ...(forId ? { for: forId } : {}) });
      usedKeys.add(k);
      spent += c;
      used += c;
      n++;
      if (fresh && share === 'new') newLeft--;
    }
    return spent;
  };

  const st = (q: Question) => ctx.states.get(q.id);
  const due = (q: Question) => isDue(st(q), now);
  const light = phase?.id === 'light' || phase?.id === 'exam-day';
  const lists: { list: Question[]; share: TodayShare; swap?: boolean }[] = [];
  let remaining = 0;
  let dueCount = 0;
  if (budget > 0 && pool.length) {
    if (light) {
      // light / exam day: only recent errors and confident errors of any age (Design C2)
      const retry = retryCandidates(ctx, rules, (q) => poolIds.has(q.id), true);
      lists.push({ list: retry, share: 'retry' });
      take(retry, 'retry', budget);
    } else {
      // 1. retry
      const retry = retryCandidates(ctx, rules, (q) => poolIds.has(q.id), false);
      lists.push({ list: retry, share: 'retry' });
      take(retry, 'retry', RETRY_SHARE * budget);
      // 2. review (srs.daily_limit through reviewQueue().remaining)
      const queue = reviewQueue(pool, ctx.states, ctx.attempts ?? [], cfg, now);
      remaining = queue.remaining;
      dueCount = queue.due.length;
      const score = (q: Question) => (1 - (st(q)?.retrievability ?? 0)) * (weight.get(q.domain) ?? 0.25);
      const review = [...queue.due].sort(
        (a, b) => (valueModel ? score(b) / cost(b) - score(a) / cost(a) : score(b) - score(a)) || compareDue(st(a), st(b)) || (a.id < b.id ? -1 : 1),
      );
      if (remaining > 0) lists.push({ list: review, share: 'review', swap: true });
      take(review, 'review', REVIEW_SHARE * budget, { max: remaining, swap: true });
      if (queue.due.length && !remaining) notes.push(`Đã ôn đủ ${cfg.srs.daily_limit} câu đến hạn hôm nay (srs.daily_limit) — phần còn lại để dành cho ngày mai.`);

      // 4. weak tasks / new (or final review in consolidate) — each takes what the other leaves
      const groups = weakGroups(ctx, pool);
      const groupKey = (q: Question) => (groups[0]?.task !== undefined ? q.task : `topic:${q.topic}`);
      const tier = (q: Question) => (st(q)?.lastOk === false ? 0 : st(q) ? 1 : 2);
      const weakList: Question[] = [];
      const byGroup = new Map<string, Question[]>();
      for (const q of pool) {
        if (due(q) || isMastered(st(q), cfg)) continue;
        const g = groupKey(q);
        if (!g) continue;
        const l = byGroup.get(g);
        if (l) l.push(q);
        else byGroup.set(g, [q]);
      }
      for (const g of groups) {
        const l = byGroup.get(g.key) ?? [];
        l.sort(
          (a, b) =>
            tier(a) - tier(b) ||
            (tier(a) === 1 ? (st(a)?.retrievability ?? 1) - (st(b)?.retrievability ?? 1) : 0) ||
            (valueModel ? cost(a) - cost(b) : 0) ||
            stableHash(a.id, seed) - stableHash(b.id, seed) ||
            (a.id < b.id ? -1 : 1),
        );
        weakList.push(...l);
      }
      lists.push({ list: weakList, share: 'weak' });
      const rest = budget - used;
      take(weakList, 'weak', rest / 2);
      const consolidate = phase?.id === 'consolidate';
      let second: Question[];
      if (consolidate) {
        second = deps
          .advance(ctx, goal, today, ADVANCE_LIMIT)
          .map((id) => ctx.bank.byId.get(id))
          .filter((q): q is Question => !!q && poolIds.has(q.id) && !due(q));
      } else {
        // domains ordered by exam weight × coverage deficit (share of the domain's practice questions never seen)
        const total = new Map<string, number>();
        const unseen = new Map<string, number>();
        for (const q of inScope) {
          total.set(q.domain, (total.get(q.domain) ?? 0) + 1);
          if (!ctx.states.has(q.id)) unseen.set(q.domain, (unseen.get(q.domain) ?? 0) + 1);
        }
        const domains = tax.domains.map((d) => ({ id: d.id, weight: d.weight * ((unseen.get(d.id) ?? 0) / Math.max(1, total.get(d.id) ?? 0)) }));
        second = newLeft > 0 ? newOrder(pool.filter((q) => !ctx.states.has(q.id)), domains) : [];
      }
      lists.push({ list: second, share: consolidate ? 'advance' : 'new' });
      take(second, consolidate ? 'advance' : 'new', budget - used);
      take(weakList, 'weak', budget - used);
      // 5. quick practice for what is left: not-yet-mastered first (seeded), never-seen ones only within the quota
      const extra = seededWeightedOrder(
        pool.filter((q) => !due(q)),
        (q) => q.id,
        (q) => (isMastered(st(q), cfg) ? 0.3 : 1),
        seed,
      );
      lists.push({ list: extra, share: 'extra' });
      take(extra, 'extra', budget - used);
    }
  }
  // a budget smaller than half of every question still gets one question (the first candidate)
  // (same rules as `take`: its share, the sibling swap, the new-question allowance; no review once the daily cap is used)
  if (!items.length && budget > 0) {
    for (const l of lists) if (take(l.list, l.share, Infinity, { max: 1, swap: l.swap, force: true }) > 0) break;
  }
  if (!items.length && budget > 0 && !dueCount && !remaining) {
    // nothing at all: say why
    if (!pool.length) notes.push('Không còn câu nào để học hôm nay: câu đã làm hôm nay và câu anh em của chúng được để dành cho ngày mai.');
  }

  const ordered = interleave(items, (x) => x.q.topic);
  const count = (s: TodayShare) => ordered.filter((x) => x.share === s).length;
  const weakTasks: string[] = [];
  for (const x of ordered) if (x.share === 'weak' && x.q.task && !weakTasks.includes(x.q.task)) weakTasks.push(x.q.task);
  weakTasks.sort();
  const coach = freshCoachSession(ctx.plans, now);
  const extraN = count('extra');
  const mix: TodayMix = {
    minutes,
    seconds: Math.round(used),
    pace: Math.round(pace * 100) / 100,
    review: count('review'),
    retry: count('retry'),
    weak: count('weak'),
    new: count('new'),
    advance: count('advance'),
    swapped: ordered.filter((x) => x.for).length,
    ...(extraN ? { extra: extraN } : {}),
    ...(coach ? { coach } : {}),
    ...(weakTasks.length && count('weak') ? { weakTasks } : {}),
  };
  const plan: TodayPlan = { minutes, items: ordered, mix, label: todayLabel(mix, ordered.length), ...(phase ? { phase } : {}), ...(quota ? { quota } : {}), notes };
  if (!memo) planMemo.set(ctx, (memo = new Map()));
  memo.set(memoKey, plan);
  return plan;
}

/** GET /api/today?minutes=N — what "▶ Học hôm nay" would build now (no minutes: the daily goal). */
export function previewToday(ctx: SelectCtx, minutes?: number): TodayPreview {
  const plan = composeToday(ctx, minutes);
  const today = dayOf(nowOf(ctx));
  return {
    minutes: plan.minutes,
    count: plan.items.length,
    mix: plan.mix,
    label: plan.label,
    ...(plan.phase ? { phase: plan.phase.id } : {}),
    done: doneToday(ctx, today, dailyGoalMinutes(ctx)),
    ...(plan.notes.length ? { note: plan.notes.join(' ') } : {}),
  };
}

// ── micro candidates (D4: micro API, listen mode, MCP quiz) ─────────────────

const microMemo = new WeakMap<SelectCtx, { key: string; ids: string[] }>();

/**
 * Short practice questions for one-question breaks (π micro API, τ listen mode): stems of ≤ MICRO_MAX_WORDS words from
 * the practice pool (never sealed / draft / out of scope), not answered today, no sibling answered today, not a parked
 * leech, one per sibling cluster. Order: due (lowest recall first) → seen but not yet mastered (last answer wrong first,
 * then lowest recall) → never seen (newOrder, within today's new-question quota). Deterministic.
 */
export function microCandidates(ctx: SelectCtx, max: number): string[] {
  const n = Math.max(0, Math.min(500, Math.round(Number(max) || 0)));
  if (!n) return [];
  const rules = sessionRules(ctx);
  const deps = depsOf(ctx);
  const paused = deps.paused(rules.today);
  const key = `${rules.today}|${heldBack(ctx).size}|${[...paused].sort().join(',')}`;
  const hit = microMemo.get(ctx);
  if (hit?.key === key) return hit.ids.slice(0, n);
  const now = nowOf(ctx);
  const st = (q: Question) => ctx.states.get(q.id);
  const short = pools(ctx).inScope.filter(
    (q) => (typeof q.words === 'number' ? q.words : countWords(q.stem)) <= MICRO_MAX_WORDS && !rules.answered.has(q.id) && !rules.buried(q.id) && !isParkedLeech(ctx.states.get(q.id), rules.today, paused),
  );
  const tie = (a: Question, b: Question) => stableHash(a.id, `micro:${rules.today}`) - stableHash(b.id, `micro:${rules.today}`) || (a.id < b.id ? -1 : 1);
  const due = short.filter((q) => isDue(st(q), now)).sort((a, b) => compareDue(st(a), st(b)) || tie(a, b));
  const learning = short
    .filter((q) => st(q) && !isDue(st(q), now) && !isMastered(st(q), ctx.cfg))
    .sort((a, b) => Number(st(b)!.lastOk === false) - Number(st(a)!.lastOk === false) || (st(a)!.retrievability ?? 1) - (st(b)!.retrievability ?? 1) || tie(a, b));
  const goal = goalOf(ctx);
  const quota = ctx.cfg.srs?.exam_aware === false ? undefined : deps.quota(ctx, goal, rules.today);
  const allowance = quota ? Math.max(0, quota.perDay - quota.doneToday) : Infinity;
  const fresh = allowance > 0 ? newOrder(short.filter((q) => !st(q)), ctx.bank.taxonomy.domains) : [];
  const ordered = onePerCluster([...due, ...learning, ...(Number.isFinite(allowance) ? fresh.slice(0, allowance) : fresh)], (q) => rules.key(q.id));
  const ids = ordered.map((q) => q.id);
  microMemo.set(ctx, { key, ids });
  return ids.slice(0, n);
}
