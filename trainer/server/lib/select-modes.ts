// [v5 σ] Pickers of the focused practice modes (select.ts buildTest / modeCounts):
//   discriminate (C4) — questions where confusable services compete (confusables.ts contrastPool), the correct service
//                       alternating; one question per sibling cluster (siblings of today's answers are not buried here:
//                       a pair's pool is small); default DISCRIMINATE_DEFAULT questions;
//   qualifier    (C6) — qualifier families first (same scenario and options, another final question), members at least
//                       FAMILY_GAP positions apart; then questions asking for a requirement (cost / ops / resilient /
//                       performance / secure), balanced and interleaved, one per sibling cluster;
//   yesterday    (C7) — yesterday's wrong / unsure / hinted answers not answered again today (≈ 5′, YESTERDAY_MAX);
//   retest       (C7) — the correction set of one attempt (shared/filters.ts retestIds), options reshuffled.
import { HttpError } from '../http.ts';
import { attemptById } from './results.ts';
import { isMastered } from './stats.ts';
import { retestIds, stableHash } from '../../shared/filters.ts';
import { dayOf, daysBefore, depsOf, isFirstView, onePerCluster, type SelectCtx, type SessionRules } from './select-rules.ts';
import type { AnswerRecord, Attempt, BuildTestRequest, Question } from '../../shared/types.ts';

export const DISCRIMINATE_DEFAULT = 12;
export const DISCRIMINATE_MAX_SERVICES = 4;
export const YESTERDAY_MAX = 8;
/** Members of one qualifier family are at least this many positions apart in a session. */
export const FAMILY_GAP = 5;
/** Requirement categories the qualifier fallback balances (the negative NOT / EXCEPT category is not one). */
export const QUALIFIER_REQUIREMENTS = ['cost', 'ops', 'resilient', 'performance', 'secure'] as const;

/** Practice preference: last answer wrong → never seen → lowest recall → stable hash (deterministic per seed). */
function practiceOrder(ctx: SelectCtx, seed: string): (a: Question, b: Question) => number {
  const rank = (q: Question) => {
    const s = ctx.states.get(q.id);
    if (!s) return 1;
    if (s.lastOk === false) return 0;
    return isMastered(s, ctx.cfg) ? 3 : 2;
  };
  return (a, b) =>
    rank(a) - rank(b) ||
    (ctx.states.get(a.id)?.retrievability ?? 1) - (ctx.states.get(b.id)?.retrievability ?? 1) ||
    stableHash(a.id, seed) - stableHash(b.id, seed) ||
    (a.id < b.id ? -1 : 1);
}

// ── discriminate ────────────────────────────────────────────────────────────

/** 2–4 distinct non-empty names (services or feature tags, as GET /api/pairs returns them). */
export function cleanContrast(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    const s = typeof x === 'string' ? x.trim().slice(0, 80) : '';
    if (s && !out.includes(s)) out.push(s);
  }
  return out.slice(0, DISCRIMINATE_MAX_SERVICES);
}

export interface DiscriminatePick {
  picked: Question[];
  services: string[];
  notes: string[];
  available: number; // questions in the pool for these services (one per cluster)
}

/**
 * Mode 'discriminate': `contrast` (2–4 names) or, without it, the first confusable group not yet separated. Questions of
 * the practice pool where two of them compete, ordered so the correct service alternates (round robin over the services,
 * each list in practice order), one per sibling cluster, at most `count`.
 */
export function discriminatePick(ctx: SelectCtx, rules: SessionRules, practice: Set<string>, req: BuildTestRequest, count: number): DiscriminatePick {
  const deps = depsOf(ctx);
  const notes: string[] = [];
  let services = cleanContrast(req.contrast);
  if (services.length < 2) {
    const groups = deps.confusableGroups(ctx.bank, ctx.attempts);
    const g = groups.find((x) => !x.learner?.separated) ?? groups[0];
    if (!g) return { picked: [], services: [], notes: ['Chưa tìm thấy cặp dịch vụ dễ nhầm nào trong ngân hàng (cần ≥ 8 câu mà hai dịch vụ cạnh tranh nhau).'], available: 0 };
    services = g.services.slice(0, DISCRIMINATE_MAX_SERVICES);
  }
  const order = practiceOrder(ctx, `discriminate:${rules.today}:${services.join('+')}`);
  const lists = new Map<string, Question[]>(services.map((s) => [s, []]));
  for (const e of deps.contrastPool(ctx.bank, services)) {
    if (!practice.has(e.question.id) || e.question.status !== 'active') continue;
    lists.get(e.answerService)?.push(e.question);
  }
  for (const l of lists.values()) l.sort(order);
  // round robin over the services: the correct answer alternates while more than one service has questions left
  const used = new Set<string>();
  const next = new Map(services.map((s) => [s, 0]));
  const alternated: Question[] = [];
  for (;;) {
    let progressed = false;
    for (const s of services) {
      const l = lists.get(s)!;
      let i = next.get(s)!;
      while (i < l.length && used.has(rules.key(l[i].id))) i++;
      if (i < l.length) {
        used.add(rules.key(l[i].id));
        alternated.push(l[i]);
        i++;
        progressed = true;
      }
      next.set(s, i);
    }
    if (!progressed) break;
  }
  if (!alternated.length) notes.push(`Chưa có câu luyện nào mà ${services.join(' và ')} cạnh tranh nhau (câu niêm phong / ngoài phạm vi không tính).`);
  return { picked: alternated.slice(0, count), services, notes, available: alternated.length };
}

// ── qualifier ───────────────────────────────────────────────────────────────

/**
 * Places qualifier families (members in order) and single questions into at most `n` positions: a started family's next
 * member as soon as it is `gap` positions after the previous one (oldest first), else a new family that can still finish
 * inside the session, else a single question (a cluster already in the session is skipped), else — nothing else left —
 * the waiting family member closest to the gap (`squeezed` counts these). Families that cannot finish are left out.
 */
export function spaceFamilies(families: Question[][], singles: Question[], n: number, gap: number, key: (q: Question) => string): { order: Question[]; squeezed: number } {
  const order: Question[] = [];
  const last = families.map(() => -Infinity);
  const next = families.map(() => 0);
  const usedKeys = new Set<string>();
  let si = 0;
  let squeezed = 0;
  let fi = 0; // next family not started yet
  for (let pos = 0; pos < n; pos++) {
    let f = -1;
    for (let i = 0; i < families.length; i++) {
      if (next[i] === 0 || next[i] >= families[i].length || pos - last[i] < gap) continue;
      if (f < 0 || last[i] < last[f]) f = i;
    }
    if (f < 0) {
      while (fi < families.length && pos + gap * (families[fi].length - 1) > n - 1) fi++;
      if (fi < families.length) f = fi++;
    }
    if (f >= 0) {
      const q = families[f][next[f]++];
      last[f] = pos;
      order.push(q);
      usedKeys.add(key(q));
      continue;
    }
    while (si < singles.length && usedKeys.has(key(singles[si]))) si++;
    if (si < singles.length) {
      const q = singles[si++];
      usedKeys.add(key(q));
      order.push(q);
      continue;
    }
    // nothing else: the waiting member with the largest gap (spacing shorter than `gap`)
    let w = -1;
    for (let i = 0; i < families.length; i++) if (next[i] > 0 && next[i] < families[i].length && (w < 0 || last[i] < last[w])) w = i;
    if (w < 0) break;
    order.push(families[w][next[w]++]);
    last[w] = pos;
    squeezed++;
  }
  return { order, squeezed };
}

export interface QualifierPick {
  picked: Question[];
  families: number; // families served (≥ 2 members)
  notes: string[];
}

/** Qualifier families of a pool: family id → active members (bank order), families with ≥ 2 members only. */
export function qualifierFamilies(pool: readonly Question[]): Map<string, Question[]> {
  const fams = new Map<string, Question[]>();
  for (const q of pool) {
    if (!q.family) continue;
    const l = fams.get(q.family);
    if (l) l.push(q);
    else fams.set(q.family, [q]);
  }
  for (const [id, l] of fams) if (l.length < 2) fams.delete(id);
  return fams;
}

/** Requirement questions of the fallback, balanced: round robin over QUALIFIER_REQUIREMENTS, each in practice order. */
export function requirementSingles(ctx: SelectCtx, rules: SessionRules, pool: readonly Question[], seed: string): Question[] {
  const order = practiceOrder(ctx, seed);
  const lists = QUALIFIER_REQUIREMENTS.map((r) => pool.filter((q) => !q.family && !rules.buried(q.id) && (q.requirements ?? []).includes(r)).sort(order));
  const out: Question[] = [];
  const seen = new Set<string>();
  const idx = lists.map(() => 0);
  for (;;) {
    let progressed = false;
    lists.forEach((l, i) => {
      while (idx[i] < l.length && seen.has(l[idx[i]].id)) idx[i]++;
      if (idx[i] < l.length) {
        seen.add(l[idx[i]].id);
        out.push(l[idx[i]++]);
        progressed = true;
      }
    });
    if (!progressed) break;
  }
  return onePerCluster(out, (q) => rules.key(q.id));
}

/**
 * Mode 'qualifier': families first (fresh families, then the least recently seen; families with a member answered today
 * wait), spaced FAMILY_GAP apart, then requirement questions (balanced, one per cluster) — `count` positions at most.
 */
export function qualifierPick(ctx: SelectCtx, rules: SessionRules, pool: readonly Question[], count: number): QualifierPick {
  const notes: string[] = [];
  const seed = `qualifier:${rules.today}`;
  const fams = [...qualifierFamilies(pool).values()].filter((m) => !m.some((q) => rules.answered.has(q.id)));
  const lastSeen = (m: Question[]) => m.reduce((x, q) => (ctx.states.get(q.id)?.lastAt ?? '') > x ? (ctx.states.get(q.id)?.lastAt ?? '') : x, '');
  fams.sort((a, b) => Number(!!lastSeen(a)) - Number(!!lastSeen(b)) || lastSeen(a).localeCompare(lastSeen(b)) || stableHash(a[0].family!, seed) - stableHash(b[0].family!, seed));
  const singles = requirementSingles(ctx, rules, pool, seed);
  const { order, squeezed } = spaceFamilies(fams, singles, count, FAMILY_GAP, (q) => rules.key(q.id));
  const served = new Set(order.map((q) => q.family).filter(Boolean));
  if (!fams.length) notes.push('Ngân hàng chưa có họ câu “cùng tình huống, đổi yêu cầu” — bài gồm các câu hỏi có tiêu chí (chi phí, vận hành, sẵn sàng, hiệu năng, bảo mật), xen kẽ nhau. Họ câu do AI Coach tạo (tác vụ family).');
  if (squeezed) notes.push(`Ngân hàng chưa đủ câu để giãn ${squeezed} câu cùng họ cách nhau ≥ ${FAMILY_GAP} câu.`);
  return { picked: order, families: served.size, notes };
}

// ── yesterday ───────────────────────────────────────────────────────────────

/**
 * Mode 'yesterday': questions whose last first-attempt answer yesterday (local date) was wrong, unsure or hinted — not
 * answered again today, no sibling answered today, in the practice pool; confident errors first, then other errors, then
 * unsure / hinted right answers (latest first); one per sibling cluster. The whole list (callers cap it).
 */
export function yesterdayList(ctx: SelectCtx, rules: SessionRules, inPool: Set<string>): Question[] {
  const yday = daysBefore(rules.today, 1);
  const last = new Map<string, { r: AnswerRecord; at: number }>();
  for (const a of ctx.attempts ?? []) {
    if (a.rushed || !a.finished) continue;
    const at = Date.parse(a.finished);
    if (!Number.isFinite(at) || dayOf(at) !== yday) continue;
    for (const r of a.answers) {
      if (!isFirstView(r)) continue;
      const cur = last.get(r.q);
      if (!cur || cur.at <= at) last.set(r.q, { r, at });
    }
  }
  const out: { q: Question; tier: number; at: number }[] = [];
  for (const [id, { r, at }] of last) {
    if (r.ok && !r.unsure && !r.hinted) continue;
    if (!inPool.has(id) || rules.answered.has(id) || rules.buried(id)) continue;
    const q = ctx.bank.byId.get(id);
    if (!q) continue;
    out.push({ q, tier: !r.ok ? (r.pick && !r.unsure && !r.hinted ? 0 : 1) : 2, at });
  }
  out.sort((a, b) => a.tier - b.tier || b.at - a.at || (a.q.id < b.q.id ? -1 : 1));
  return onePerCluster(
    out.map((e) => e.q),
    (q) => rules.key(q.id),
  );
}

// ── retest ──────────────────────────────────────────────────────────────────

export interface RetestPick {
  attempt: Attempt;
  picked: Question[];
  notes: string[];
}

/**
 * Mode 'retest': the correction set of attempt `retestOf` (wrong + unsure first attempts, confident errors first —
 * retestIds) as it stands in the bank now: drafts, retired and still-sealed questions are skipped with a note.
 */
export function retestPick(ctx: SelectCtx, held: Set<string>, retestOf: unknown): RetestPick {
  const id = typeof retestOf === 'string' ? retestOf.trim().slice(0, 200) : '';
  if (!id) throw new HttpError(400, 'Thiếu mã bài làm cần kiểm tra lại (retestOf).');
  const attempt = attemptById(ctx.attempts ?? [], id);
  if (!attempt) throw new HttpError(404, `Không tìm thấy bài làm “${id}”.`);
  const notes: string[] = [];
  const ids = retestIds(attempt.answers);
  const picked: Question[] = [];
  let gone = 0;
  let skipped = 0;
  for (const qid of ids) {
    const q = ctx.bank.byId.get(qid);
    if (!q) gone++;
    else if (q.status !== 'active' || held.has(qid)) skipped++;
    else picked.push(q);
  }
  if (!ids.length) notes.push('Bài làm này không có câu sai hay chưa chắc để kiểm tra lại.');
  if (gone) notes.push(`${gone} câu không còn trong ngân hàng.`);
  if (skipped) notes.push(`Bỏ qua ${skipped} câu đang chờ duyệt, đã retired hoặc đang niêm phong.`);
  return { attempt, picked, notes };
}
