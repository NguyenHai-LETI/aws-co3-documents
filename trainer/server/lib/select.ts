// Builds a test session (ordered question list + time limit) for every test mode.
// Pools: practice modes never serve questions held back in a sealed form (sealed.ts), nor — practice.exclude_out_of_scope —
// questions whose answer is an out-of-scope service (explicit pack / ids requests keep those). A sealed exam serves one
// form (+ pilots from the practice pool). Every session carries its realism (shared/realism.ts).
// [v5 σ] Session rules (select-rules.ts, Design C3): one question per sibling cluster and the siblings of today's answers
// buried, in every mode except explicit lists (ids / pack / coach questions), retest and qualifier families (discriminate
// keeps one per cluster without burying); sibling substitution in srs + today (ref.for). "Học hôm nay" = today.ts;
// discriminate / qualifier / yesterday / retest = select-modes.ts. Mocks take ≥ 50 % exam-like questions per domain when
// the pool allows (C5). Practice-feedback sessions get in-session relearning (session.relearn, practice.relearn).
import crypto from 'node:crypto';
import { HttpError } from '../http.ts';
import { isMastered, isParkedLeech, reviewQueue } from './stats.ts';
import { ATTEMPT_SOURCES } from './results.ts';
import { ONBOARDING_TRIGGER } from './onboarding.ts';
import { SPRINT_TRIGGER } from './sprint.ts';
import { DAY_MS } from './time.ts';
import { MODE_INFO, REQUIREMENT_INFO } from '../../shared/labels.ts';
import { EXAM_PACE_PRESETS, computeTimeLimit, defaultTimingPreset } from '../../shared/timing.ts';
import { applyFilters, hasFilters, newOrder, retestIds, stableHash, taskQuotas } from '../../shared/filters.ts';
import { isExamLike, testRealism } from '../../shared/realism.ts';
import {
  depsOf,
  goalOf,
  nowOf,
  onePerCluster,
  pools,
  sealedForms,
  sessionRules,
  swapFor,
  variantFamilies,
  weakWeight,
  type SelectCtx,
  type SessionRules,
} from './select-rules.ts';
import { composeToday } from './today.ts';
import {
  DISCRIMINATE_DEFAULT,
  YESTERDAY_MAX,
  discriminatePick,
  qualifierFamilies,
  qualifierPick,
  requirementSingles,
  retestPick,
  yesterdayList,
} from './select-modes.ts';
import type {
  AttemptSource,
  BuildTestRequest,
  Difficulty,
  DomainDef,
  Question,
  SealedForm,
  SelectionFilters,
  Taxonomy,
  TestSession,
  TodayMix,
} from '../../shared/types.ts';

export type { SelectCtx, SelectDeps } from './select-rules.ts';
export { variantFamilies } from './select-rules.ts';
export { previewToday, microCandidates } from './today.ts';

export const PEARSON_TITLE = 'Thi thử SAA-C03 · mô phỏng Pearson VUE';
/** Unscored pilot items in a real 65-question SAA-C03 exam. */
export const PILOT_ITEMS = 15;
/** First-day diagnostic: questions per exam-guide task (14 tasks → 28). */
export const DIAGNOSTIC_PER_TASK = 2;
/** [v5] Share of each domain's quota a mock fills with exam-like questions first, when the pool has them (Design C5). */
export const EXAM_LIKE_SHARE = 0.5;

/** [v5] Modes whose feedback defaults to "xem đáp án ngay". */
const PRACTICE_MODES: string[] = ['quick', 'today', 'discriminate', 'qualifier', 'yesterday', 'retest'];
/** [v5] Modes that set their own title (no "Theo chủ đề: …" suffix from the filters). */
const OWN_TITLE: string[] = ['pack', 'coach', 'diagnostic', 'today', 'discriminate', 'yesterday', 'retest'];
/** [v5] Modes that ignore the content filters. */
const UNFILTERED: string[] = ['ids', 'coach', 'sealed', 'today', 'discriminate', 'yesterday', 'retest'];
/** [v5] Attempt kinds created outside the runner (createAttempt): never built here. */
const NOT_BUILT: string[] = ['anki', 'listen', 'micro'];

type Ctx = SelectCtx;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Weighted sampling without replacement (Efraimidis–Spirakis); n = items.length gives a full weighted order. */
function weightedSample<T>(items: T[], weight: (x: T) => number, n: number): T[] {
  return items
    .map((x) => ({ x, k: Math.pow(Math.random(), 1 / Math.max(1e-6, weight(x))) }))
    .sort((a, b) => b.k - a.k)
    .slice(0, n)
    .map((e) => e.x);
}

const sealedNote = (n: number) => `${n} câu đang niêm phong đã được bỏ qua.`;

/** Largest-remainder split of `n` questions over the exam domain weights. */
export function domainQuotas(n: number, domains: DomainDef[]): Map<string, number> {
  const total = domains.reduce((s, d) => s + d.weight, 0) || 1;
  const quotas = domains.map((d) => {
    const exact = (n * d.weight) / total;
    return { id: d.id, want: Math.floor(exact), frac: exact % 1 };
  });
  let rest = n - quotas.reduce((s, q) => s + q.want, 0);
  for (const q of [...quotas].sort((a, b) => b.frac - a.frac)) if (rest-- > 0) q.want++;
  return new Map(quotas.map((q) => [q.id, q.want]));
}

/** Day number of the last answer (-1 = never seen). */
function seenDayOf(states: Ctx['states'], q: Question): number {
  const s = states.get(q.id);
  return s?.lastAt ? Math.floor(new Date(s.lastAt).getTime() / DAY_MS) : -1;
}

interface PickOptions {
  taken?: Question[]; // questions already in the test (their clusters are excluded)
  deterministic?: boolean; // stable hash tie-breaks instead of random ones (previews)
  key?: (q: Question) => string; // sibling cluster of a question (default: its variant family)
}

/**
 * Picks questions per domain proportionally to exam weights. Inside a domain quota, at least EXAM_LIKE_SHARE of it goes to
 * exam-like questions (long scenario stem, full-sentence options — shared/realism.ts) when the pool has them; then the
 * general preference: never seen, then exam-like, then least recently seen (by day), then long-form stems; random among
 * equals. Never two questions of one sibling cluster (an original and its variant, two rephrasings).
 */
function examPick(pool: Question[], n: number, ctx: Ctx, opts: PickOptions = {}): Question[] {
  const tax = ctx.bank.taxonomy;
  const families = variantFamilies(ctx.bank);
  const family = opts.key ?? ((q: Question) => families.get(q.id) ?? q.id);
  const ties = opts.deterministic ? (list: Question[]) => [...list].sort((a, b) => stableHash(a.id, 'exam') - stableHash(b.id, 'exam')) : shuffle;
  const preferred = (list: Question[]) =>
    ties(list)
      .map((q) => ({ q, seen: seenDayOf(ctx.states, q), exam: isExamLike(q, tax) }))
      .sort((a, b) => Number(a.seen >= 0) - Number(b.seen >= 0) || Number(b.exam) - Number(a.exam) || a.seen - b.seen || Number(b.q.longForm) - Number(a.q.longForm))
      .map((e) => e.q);
  const picked: Question[] = [];
  const used = new Set<string>();
  const usedFamilies = new Set((opts.taken ?? []).map(family));
  const take = (list: Question[], want: number): number => {
    let k = 0;
    for (const q of list) {
      if (k >= want) break;
      if (used.has(q.id) || usedFamilies.has(family(q))) continue;
      picked.push(q);
      used.add(q.id);
      usedFamilies.add(family(q));
      k++;
    }
    return k;
  };
  for (const [domain, want] of domainQuotas(n, tax.domains)) {
    const inDomain = preferred(pool.filter((x) => x.domain === domain));
    const examLike = take(
      inDomain.filter((q) => isExamLike(q, tax)),
      Math.ceil(want * EXAM_LIKE_SHARE),
    );
    take(inDomain, want - examLike);
  }
  if (picked.length < n) take(preferred(pool.filter((q) => !used.has(q.id))), n - picked.length);
  return opts.deterministic ? picked : shuffle(picked);
}

/**
 * Chooses the unscored pilot items of a Pearson-style exam so that the scored part keeps the official
 * domain weights (65 → 19/17/16/13, scored 50 → 15/13/12/10, pilots 4/4/4/3); random within a domain.
 */
export function pickPilots(picked: Question[], pilots: number, domains: DomainDef[]): string[] {
  if (pilots <= 0 || !picked.length) return [];
  const scoredQuota = domainQuotas(Math.max(0, picked.length - pilots), domains);
  const byDomain = new Map<string, Question[]>();
  for (const q of shuffle(picked)) byDomain.set(q.domain, [...(byDomain.get(q.domain) ?? []), q]);
  let surplus: Question[] = [];
  const scored: Question[] = [];
  for (const [domain, list] of byDomain) {
    const keep = scoredQuota.get(domain) ?? 0;
    scored.push(...list.slice(0, keep));
    surplus.push(...list.slice(keep));
  }
  surplus = shuffle(surplus);
  if (surplus.length > pilots) surplus = surplus.slice(0, pilots);
  else if (surplus.length < pilots) surplus.push(...shuffle(scored).slice(0, pilots - surplus.length));
  return surplus.map((q) => q.id);
}

/** Pilots of a sealed exam: as many per scored item as in the real exam (50 scored → 15). */
function sealedPilotCount(scored: number, tax: Taxonomy): number {
  const scoredPerExam = Math.max(1, tax.exam.questions - PILOT_ITEMS);
  return Math.min(PILOT_ITEMS, Math.round((scored * PILOT_ITEMS) / scoredPerExam));
}

/** Active questions of a form, in form order (unknown, draft or retired ids are left out). */
function formQuestions(ctx: Ctx, form: SealedForm): Question[] {
  return [...new Set(form.ids)].map((id) => ctx.bank.byId.get(id)).filter((q): q is Question => !!q && q.status === 'active');
}

/** The form a sealed exam uses: `req.form`, else the first form still sealed. HTTP 404/409 with a Vietnamese reason. */
function chooseForm(ctx: Ctx, wanted: string | undefined): SealedForm {
  const forms = sealedForms(ctx);
  const open = forms.filter((f) => f.status === 'sealed');
  if (wanted) {
    const form = forms.find((f) => f.id === wanted);
    if (!form) throw new HttpError(404, `Không tìm thấy đề niêm phong “${wanted}”.`);
    if (form.status !== 'sealed') {
      const why = form.status === 'used' ? 'đã được làm' : 'đã được mở sớm';
      const other = open.length ? ` Còn đề ${open.map((f) => f.id).join(', ')} chưa làm.` : '';
      throw new HttpError(409, `Đề niêm phong ${form.id} ${why} — mỗi đề chỉ đo được một lần, các câu của nó đã trở lại ngân hàng luyện.${other}`);
    }
    return form;
  }
  if (open[0]) return open[0];
  throw new HttpError(
    409,
    forms.length
      ? `Không còn đề niêm phong nào chưa làm (${forms.map((f) => f.id).join(', ')} đã làm hoặc đã mở sớm). Tạo đề mới bằng \`npm run seal -- --forms 1\` khi ngân hàng còn đủ câu bạn chưa gặp.`
      : 'Chưa có đề niêm phong nào. Tạo bằng lệnh `npm run seal -- --forms 2` (hoặc đặt exam.sealed_forms trong config.yaml rồi khởi động lại app).',
  );
}

const DIFFICULTY_RANK: Record<Difficulty, number> = { medium: 0, hard: 1, easy: 2 };

/**
 * First-day diagnostic: an even share of `n` questions for every exam-guide task (28 → 2 per task 1.1–4.4; 14 → 1 per
 * task, so two sittings of 14 cover different questions). A remainder goes to the tasks of the heaviest domains first.
 * Preference: never seen, then least recently seen, then medium difficulty (the most informative), then a stable hash —
 * the same bank and history always give the same questions. Never two questions of one sibling cluster.
 */
function diagnosticPick(pool: Question[], n: number, ctx: Ctx, family: (q: Question) => string): { picked: Question[]; short: string[]; perTask: Set<number> } {
  const tax = ctx.bank.taxonomy;
  const tasks = tax.tasks ?? [];
  const quotas = taskQuotas(n, tasks, tax.domains);
  const picked: Question[] = [];
  const short: string[] = [];
  const perTask = new Set<number>();
  const usedFamilies = new Set<string>();
  for (const t of tasks) {
    const want = quotas.get(t.id) ?? 0;
    perTask.add(want);
    if (!want) continue;
    const ranked = pool
      .filter((q) => q.task === t.id)
      .map((q) => ({ q, seen: seenDayOf(ctx.states, q), diff: DIFFICULTY_RANK[q.difficulty] ?? 1, h: stableHash(q.id, 'diagnostic') }))
      .sort((a, b) => Number(a.seen >= 0) - Number(b.seen >= 0) || a.seen - b.seen || a.diff - b.diff || a.h - b.h || (a.q.id < b.q.id ? -1 : 1));
    let k = 0;
    for (const { q } of ranked) {
      if (k >= want) break;
      if (usedFamilies.has(family(q))) continue;
      picked.push(q);
      usedFamilies.add(family(q));
      k++;
    }
    if (k < want) short.push(`${t.id} (${k}/${want})`);
  }
  return { picked, short, perTask };
}

interface ReviewPick {
  served: Question[]; // in review order; a mature question may be replaced by an unseen sibling
  forOf: Map<string, string>; // served id → the due question it stands in for
  due: number; // due questions eligible today (siblings of today's answers and parked leeches left out)
  unique: number; // …one per sibling cluster
  remaining: number; // reviews still allowed today (srs.daily_limit)
  backlog: number; // due questions not offered today
}

/**
 * Mode 'srs' (and its count): due questions, lowest recall probability first, without siblings of today's answers and
 * parked leeches, one per sibling cluster, within srs.daily_limit; a mature one (stability ≥ srs.sibling_swap_days) is
 * served as a cluster mate never answered (ref.for, Design C3).
 */
function reviewPick(ctx: Ctx, pool: Question[], rules: SessionRules): ReviewPick {
  const paused = depsOf(ctx).paused(rules.today);
  const eligible = pool.filter((q) => !rules.buried(q.id) && !isParkedLeech(ctx.states.get(q.id), rules.today, paused));
  const queue = reviewQueue(eligible, ctx.states, ctx.attempts ?? [], ctx.cfg, nowOf(ctx));
  const unique = onePerCluster(queue.due, (q) => rules.key(q.id));
  const today = unique.slice(0, queue.remaining);
  const ids = new Set(eligible.map((q) => q.id));
  const served: Question[] = [];
  const forOf = new Map<string, string>();
  for (const q of today) {
    const sub = swapFor(ctx, rules, q, (id) => ids.has(id));
    if (sub) {
      served.push(sub);
      forOf.set(sub.id, q.id);
    } else served.push(q);
  }
  return { served, forOf, due: queue.due.length, unique: unique.length, remaining: queue.remaining, backlog: Math.max(0, queue.due.length - today.length) };
}

function validSource(s: unknown): AttemptSource | undefined {
  return typeof s === 'string' && (ATTEMPT_SOURCES as readonly string[]).includes(s) ? (s as AttemptSource) : undefined;
}

export function buildTest(req: BuildTestRequest, ctx: Ctx): TestSession {
  const { bank, states, cfg } = ctx;
  const tax = bank.taxonomy;
  const notes: string[] = [];
  const mode = req.mode;
  if (NOT_BUILT.includes(mode)) throw new HttpError(400, `Chế độ “${MODE_INFO[mode]?.label ?? mode}” không tạo bài test — câu trả lời được ghi qua tính năng riêng của nó.`);
  const sealedMode = mode === 'sealed';
  const pearson = sealedMode || (!!req.pearson && mode === 'exam');
  const { active, practice, inScope, held } = pools(ctx);
  const rules = sessionRules(ctx);
  const key = (q: Question) => rules.key(q.id);
  const unburied = (list: Question[]) => list.filter((q) => !rules.buried(q.id));
  /** Design C3: siblings of today's answers buried, one question per cluster (first = preferred). */
  const ruled = (list: Question[]) => onePerCluster(unburied(list), key);
  // explicit packs keep out-of-scope questions; the other filter-based modes draw from the in-scope pool
  const pool = applyFilters(mode === 'pack' ? practice : inScope, req.filters);
  const defaultCount =
    mode === 'exam'
      ? tax.exam.questions
      : mode === 'quick'
        ? cfg.practice.quick_count
        : mode === 'diagnostic'
          ? DIAGNOSTIC_PER_TASK * (tax.tasks?.length ?? 0)
          : mode === 'discriminate'
            ? DISCRIMINATE_DEFAULT
            : mode === 'yesterday'
              ? YESTERDAY_MAX
              : cfg.practice.default_count;
  const asked = Number(req.count);
  let count = pearson && !sealedMode ? tax.exam.questions : Math.max(1, Math.min(500, req.count !== undefined && Number.isFinite(asked) ? Math.round(asked) : defaultCount));
  let picked: Question[] = [];
  let title = req.title ?? (pearson && !sealedMode ? PEARSON_TITLE : (MODE_INFO[mode]?.label ?? mode));
  let feedback = pearson ? 'exam' : (req.feedback ?? (PRACTICE_MODES.includes(mode) ? 'practice' : 'exam'));
  let keepOrder = false;
  const plan = req.plan;
  // full mocks and sealed forms run on the honest reading-load clock unless the learner picked another one
  let timingPreset = req.timing?.preset ?? (mode === 'exam' || sealedMode ? defaultTimingPreset(mode) : undefined);
  let unscored: string[] | undefined;
  let sealedForm: string | undefined;
  let diagnostic = false;
  let countNote = !['pack', 'ids', 'coach', 'sealed', 'diagnostic', 'today', 'retest', 'yesterday'].includes(mode);
  // [v5]
  let forOf: Map<string, string> | undefined;
  let budgetMinutes: number | undefined;
  let mix: TodayMix | undefined;
  let contrast: string[] | undefined;
  let retestOf: string | undefined;
  let forceShuffleOptions = false;
  let phaseId: TestSession['phase'];

  const lastAtDesc = (a: Question, b: Question) => (states.get(b.id)?.lastAt ?? '').localeCompare(states.get(a.id)?.lastAt ?? '');

  switch (mode) {
    case 'exam':
      picked = examPick(unburied(pool), count, ctx, { key });
      break;
    case 'sealed': {
      // the form's questions are the scored items; pilots come from the practice pool like the real exam's 15
      const form = chooseForm(ctx, typeof req.form === 'string' && req.form.trim() ? req.form.trim().slice(0, 40) : undefined);
      const scored = formQuestions(ctx, form);
      const lost = new Set(form.ids).size - scored.length;
      if (!scored.length) throw new HttpError(409, `Đề niêm phong ${form.id} không còn câu nào dùng được (đã bị xoá, chuyển draft hoặc retired).`);
      if (lost) notes.push(`${lost} câu của đề ${form.id} không còn dùng được (đã bị xoá, chuyển draft hoặc retired) — đề còn ${scored.length} câu tính điểm.`);
      const pilots = examPick(unburied(inScope), sealedPilotCount(scored.length, tax), ctx, { taken: scored, key });
      picked = shuffle([...scored, ...pilots]);
      unscored = pilots.map((q) => q.id);
      sealedForm = form.id;
      if (!req.title) title = `🔒 Đề niêm phong ${form.id} · mô phỏng Pearson VUE`;
      count = picked.length;
      keepOrder = true; // already shuffled
      break;
    }
    case 'diagnostic': {
      const d = diagnosticPick(unburied(pool), count, ctx, key);
      picked = d.picked;
      diagnostic = true;
      if (!picked.length) notes.push('Chưa có câu nào được gắn mục exam guide (task 1.1–4.4) — chạy `npm run classify-tasks` hoặc ENRICH để phân loại.');
      else if (d.short.length) notes.push(`Chưa đủ câu cho task ${d.short.join(', ')} — bài chẩn đoán có ${picked.length} câu.`);
      const per = d.perTask.size === 1 ? [...d.perTask][0] : 0;
      if (!req.title) title = `${MODE_INFO.diagnostic.label} (${picked.length} câu${per ? ` · ${per} câu/task` : ''})`;
      count = picked.length;
      break;
    }
    case 'pack': {
      const packId = req.filters?.packs?.[0];
      const pack = bank.packs.find((p) => p.id === packId);
      if (pack && !req.title) title = `Bộ đề: ${pack.title}`;
      picked = pool.filter((q) => !packId || q.pack === packId);
      const sealedInPack = held.size ? applyFilters(active, req.filters).filter((q) => held.has(q.id) && (!packId || q.pack === packId)).length : 0;
      if (sealedInPack) notes.push(sealedNote(sealedInPack));
      keepOrder = !req.shuffleQuestions;
      count = picked.length;
      break;
    }
    case 'retry-wrong':
      picked = ruled(pool.filter((q) => states.get(q.id)?.lastOk === false).sort(lastAtDesc));
      break;
    case 'srs': {
      // due questions, lowest recall probability first, capped by srs.daily_limit (minus today's reviews)
      const r = reviewPick(ctx, pool, rules);
      picked = r.served;
      forOf = r.forOf;
      const overLimit = Math.max(0, r.unique - r.remaining);
      if (r.due && !r.remaining) {
        notes.push(`Bạn đã ôn đủ ${cfg.srs.daily_limit} câu hôm nay (giới hạn srs.daily_limit) — ${r.due} câu đến hạn được để dành cho ngày mai.`);
      } else if (overLimit) {
        notes.push(`Giới hạn ôn ${cfg.srs.daily_limit} câu/ngày: hôm nay còn ${r.served.length} câu, ${overLimit} câu tồn chuyển sang ngày sau.`);
      }
      if (r.due > r.unique) notes.push(`${r.due - r.unique} câu đến hạn là câu anh em của câu khác trong bài — để dành cho ngày mai.`);
      if (r.forOf.size) notes.push(`${r.forOf.size} câu đã thuộc được hỏi bằng một câu anh em chưa gặp (cùng khái niệm, cách hỏi khác).`);
      break;
    }
    case 'new':
      // deterministic, domain-balanced order: the app knows which questions come next (ENRICH prepares them first)
      picked = ruled(
        newOrder(
          pool.filter((q) => !states.has(q.id)),
          tax.domains,
        ),
      ).slice(0, count);
      break;
    case 'flagged':
      picked = ruled(pool.filter((q) => states.get(q.id)?.lastFlag || states.get(q.id)?.lastUnsure).sort(lastAtDesc));
      break;
    case 'slow':
      picked = ruled(pool.filter((q) => (states.get(q.id)?.slowCount ?? 0) > 0).sort((a, b) => states.get(b.id)!.avgTime / b.time - states.get(a.id)!.avgTime / a.time));
      break;
    case 'weak':
      // C8: weakness from accuracies shrunk toward the learner's own rate (select-rules.ts weakWeight)
      picked = ruled(weightedSample(pool, weakWeight(ctx), pool.length)).slice(0, count);
      break;
    case 'coach':
    case 'ids': {
      let ids = req.ids ?? [];
      if (mode === 'coach' && plan) {
        const [planId, sessionId] = plan.split('#');
        const p = ctx.plans.find((x) => x.id === planId);
        const s = p?.sessions.find((x) => x.id === sessionId);
        if (!p || !s) notes.push(`Không tìm thấy phiên ${plan} trong kế hoạch AI.`);
        if (s) {
          // plans the app writes itself (sprint / final week, onboarding) are no AI-coach advice: no 🤖
          const label = p && (p.trigger === SPRINT_TRIGGER || p.trigger === ONBOARDING_TRIGGER) ? s.title : `🤖 ${s.title}`;
          if (!req.title) title = label;
          if (s.feedback && !req.feedback) feedback = s.feedback;
          if (s.timing && !timingPreset) timingPreset = s.timing;
          if (s.questions?.length) ids = s.questions;
          else if (s.filter) {
            const sub = buildTest(
              {
                ...s.filter,
                title: req.title ?? label,
                feedback: req.feedback ?? s.filter.feedback ?? s.feedback,
                timing: req.timing ?? s.filter.timing ?? (s.timing ? { preset: s.timing } : undefined),
                shuffleOptions: req.shuffleOptions ?? s.filter.shuffleOptions,
                recallFirst: req.recallFirst ?? s.filter.recallFirst,
              },
              ctx,
            );
            // [v5] a filter session keeps its own mode (today, retest, sealed, exam… — the result page, readiness and the
            // retest rules key on it); `plan` alone marks the plan session done (plans.ts indexes attempts by `plan`)
            return { ...sub, plan, selection: { ...req } };
          }
        }
      }
      const unique = [...new Set(ids)];
      const missing = unique.filter((id) => !bank.byId.has(id));
      if (missing.length) notes.push(`${missing.length} câu không còn trong ngân hàng: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
      const retired = unique.filter((id) => bank.byId.get(id)?.status === 'retired');
      if (retired.length) notes.push(`Bỏ qua ${retired.length} câu đã retired.`);
      // drafts wait for review (e.g. drafted by the blind-solve check right after the plan was written) — never served,
      // whether the ids come from an AI plan or a list (nothing in the request tells an explicit Bank pick apart)
      const drafts = unique.filter((id) => bank.byId.get(id)?.status === 'draft');
      if (drafts.length) notes.push(`${drafts.length} câu đang chờ duyệt (draft) đã được bỏ qua.`);
      // sealed questions only ever appear in their sealed exam (a list may still name them: an old plan, a link)
      const sealedSkipped = unique.filter((id) => held.has(id) && bank.byId.get(id)?.status === 'active');
      if (sealedSkipped.length) notes.push(sealedNote(sealedSkipped.length));
      picked = unique.map((id) => bank.byId.get(id)).filter((q): q is Question => !!q && q.status === 'active' && !held.has(q.id));
      keepOrder = !req.shuffleQuestions;
      count = picked.length;
      countNote = false;
      break;
    }
    case 'quick':
      picked = ruled(weightedSample(pool, (q) => (isMastered(states.get(q.id), cfg) ? 0.3 : 1), pool.length)).slice(0, count);
      break;
    // ── [v5] ───────────────────────────────────────────────────────────────
    case 'today': {
      const t = composeToday(ctx, req.budgetMinutes);
      picked = t.items.map((x) => x.q);
      forOf = new Map(t.items.filter((x) => x.for).map((x) => [x.q.id, x.for!]));
      notes.push(...t.notes);
      budgetMinutes = t.minutes;
      mix = t.mix;
      if (t.phase) phaseId = t.phase.id;
      if (!req.title) title = `${MODE_INFO.today.label} · ${t.minutes}′`;
      // the runner shows a soft budget timer (session.budgetMinutes) — never an auto-submit
      if (!timingPreset) timingPreset = 'untimed';
      keepOrder = true;
      count = picked.length;
      if (!picked.length && !t.notes.length) notes.push('Hôm nay không còn câu nào phù hợp cho “Học hôm nay” (câu đã làm hôm nay và câu anh em của chúng để dành cho ngày mai).');
      break;
    }
    case 'discriminate': {
      const d = discriminatePick(ctx, rules, new Set(inScope.map((q) => q.id)), req, count);
      picked = d.picked;
      notes.push(...d.notes);
      contrast = d.services;
      if (!req.title && d.services.length) title = `${MODE_INFO.discriminate.icon} ${MODE_INFO.discriminate.label}: ${d.services.join(' ⟷ ')}`;
      keepOrder = true;
      break;
    }
    case 'qualifier': {
      const qp = qualifierPick(ctx, rules, pool, count);
      picked = qp.picked;
      notes.push(...qp.notes);
      keepOrder = true;
      break;
    }
    case 'yesterday': {
      picked = yesterdayList(ctx, rules, new Set(inScope.map((q) => q.id))).slice(0, count);
      if (!picked.length) notes.push('Không có câu sai / chưa chắc / phải xem gợi ý nào hôm qua cần ôn lại (hoặc đã làm lại hôm nay).');
      if (!req.title) title = `${MODE_INFO.yesterday.icon} ${MODE_INFO.yesterday.label} (${picked.length} câu)`;
      keepOrder = true;
      break;
    }
    case 'retest': {
      const r = retestPick(ctx, held, req.retestOf);
      picked = r.picked;
      notes.push(...r.notes);
      retestOf = r.attempt.id;
      if (!req.title) title = `${MODE_INFO.retest.icon} ${MODE_INFO.retest.label}: ${r.attempt.title}`;
      forceShuffleOptions = true;
      count = picked.length;
      break;
    }
    case 'topic':
    case 'custom':
    default:
      picked = ruled(shuffle(pool));
  }

  if (!req.title && !pearson && !OWN_TITLE.includes(mode)) title = describeSelection(title, mode, req, ctx);
  if (picked.length > count) picked = picked.slice(0, count);
  if (!keepOrder && mode !== 'exam' && mode !== 'weak') {
    if (req.shuffleQuestions !== false) picked = shuffle(picked);
  }
  const wanted = pearson ? count : req.count;
  if (countNote && wanted && picked.length < wanted) notes.push(`Chỉ có ${picked.length} câu phù hợp (bạn yêu cầu ${wanted}).`);
  if (!pool.length && !UNFILTERED.includes(mode)) notes.push('Bộ lọc không khớp câu nào.');
  // say so when a filter the learner chose lost questions to practice.exclude_out_of_scope (unfiltered modes stay quiet)
  if (inScope !== practice && !['pack', 'ids', 'coach', 'sealed'].includes(mode) && !UNFILTERED.includes(mode) && hasFilters(req.filters)) {
    const dropped = applyFilters(practice, req.filters).filter((q) => q.outOfScope).length;
    if (dropped) notes.push(`Bỏ qua ${dropped} câu có đáp án là dịch vụ ngoài phạm vi đề thi (practice.exclude_out_of_scope).`);
  }

  const realism = testRealism(picked, tax);
  const estimateTotal = picked.reduce((s, q) => s + q.time, 0);
  const preset = timingPreset ?? 'standard';
  // ESL +30 (× 160/130) on the exam-pace clocks: the request decides, otherwise the learner's goal (goal.esl)
  const goal = goalOf(ctx);
  const esl = EXAM_PACE_PRESETS.includes(preset) && (typeof req.timing?.esl === 'boolean' ? req.timing.esl : goal.esl === true);
  const timeLimit = computeTimeLimit(estimateTotal, picked.length, preset, req.timing?.minutes, tax.timing, { words: realism.words, esl });
  const shuffleOptions = forceShuffleOptions || (req.shuffleOptions ?? cfg.practice.shuffle_options ?? true);
  if (pearson && !sealedMode) {
    const pilots = Math.min(PILOT_ITEMS, Math.round((picked.length * PILOT_ITEMS) / Math.max(1, tax.exam.questions)));
    unscored = pickPilots(picked, pilots, tax.domains);
  }
  // in-session relearning (Design C7): practice feedback, never in mocks / sealed forms / the diagnostic
  const relearn = feedback === 'practice' && !pearson && !['exam', 'sealed', 'diagnostic'].includes(mode) && (req.relearn ?? cfg.practice?.relearn ?? true) !== false;
  if (!phaseId && cfg.srs?.exam_aware !== false) phaseId = depsOf(ctx).phase(goal, rules.today, cfg)?.id;
  const source = validSource(req.source);

  return {
    sessionId: crypto.randomUUID(),
    mode,
    title,
    feedback,
    timeLimit,
    estimateTotal,
    timingPreset: preset,
    questions: picked.map((q) => {
      const f = forOf?.get(q.id);
      return {
        id: q.id,
        ...(shuffleOptions ? { order: shuffle(q.options.map((o) => o.key)) } : {}),
        ...(f ? { for: f } : {}),
      };
    }),
    selection: { ...req, ids: mode === 'ids' || mode === 'coach' ? req.ids : undefined, ...(sealedForm ? { form: sealedForm } : {}) },
    plan,
    createdAt: new Date().toISOString(),
    notes,
    realism,
    ...(pearson ? { pearson: true, unscored: unscored ?? [] } : {}),
    ...(sealedForm ? { sealedForm } : {}),
    ...(diagnostic ? { diagnostic: true } : {}),
    ...(req.recallFirst ? { recallFirst: true } : {}),
    ...(budgetMinutes !== undefined ? { budgetMinutes } : {}),
    ...(mix ? { mix } : {}),
    ...(relearn ? { relearn: true } : {}),
    ...(retestOf ? { retestOf } : {}),
    ...(contrast?.length ? { contrast } : {}),
    ...(phaseId ? { phase: phaseId } : {}),
    ...(source ? { source } : {}),
  };
}

/** Human title such as "Theo chủ đề: Database, Networking" or "Tùy chỉnh: S3 · hard". */
function describeSelection(base: string, mode: string, req: BuildTestRequest, ctx: Ctx): string {
  const f = req.filters ?? {};
  const tax = ctx.bank.taxonomy;
  const parts: string[] = [];
  if (f.topics?.length) parts.push(f.topics.map((t) => tax.topics.find((x) => x.id === t)?.label ?? t).join(', '));
  if (f.domains?.length) parts.push(f.domains.map((d) => tax.domains.find((x) => x.id === d)?.code ?? d).join('+'));
  if (f.tasks?.length) parts.push(`task ${f.tasks.slice(0, 4).join(', ')}`);
  if (f.requirements?.length) parts.push(f.requirements.map((r) => REQUIREMENT_INFO[r]?.label ?? r).join('/'));
  if (f.services?.length) parts.push(f.services.slice(0, 3).join(', '));
  if (f.tags?.length) parts.push(f.tags.slice(0, 3).join(', '));
  if (f.difficulties?.length) parts.push(f.difficulties.map((d) => tax.difficulties.find((x) => x.id === d)?.label ?? d).join('/'));
  if (f.packs?.length) parts.push(f.packs.length === 1 ? (ctx.bank.packs.find((p) => p.id === f.packs![0])?.title ?? f.packs[0]) : `${f.packs.length} bộ đề`);
  if (f.search) parts.push(`“${f.search}”`);
  if (mode === 'exam') return `${base} (${req.count ?? tax.exam.questions} câu)`;
  return parts.length ? `${base}: ${parts.join(' · ')}` : base;
}

/** Realism + Σ estimates of a previewed selection as `<key>.items|words|total|estimate[|pilots]` counters. */
function addPreview(out: Record<string, number>, key: string, qs: Question[], tax: Taxonomy, pilots = 0): void {
  const r = testRealism(qs, tax);
  out[`${key}.items`] = r.items;
  out[`${key}.words`] = r.words;
  out[`${key}.total`] = r.total;
  out[`${key}.estimate`] = qs.reduce((s, q) => s + q.time, 0);
  if (pilots) out[`${key}.pilots`] = pilots;
}

const countsMemo = new WeakMap<Ctx, { key: string; counts: Record<string, number> }>();

/**
 * Pool sizes for every mode, shown on the "new test" screen (sealed and — practice.exclude_out_of_scope — out-of-scope
 * questions excluded everywhere). `srs` = due questions offered today (after srs.daily_limit and the sibling rules),
 * `backlog` = the rest of the due questions, `srsRemaining` = reviews still allowed today (pass to
 * `modePool(…, { srsLimit })` on the web). `sealed` / `outOfScope` = active questions held back / left out; `examLike` =
 * exam-like questions in the pool.
 * Previews (stable tie-breaks): `exam.*` = what a full mock would serve now, `sealed.<form>.*` = each form still sealed
 * with its pilots — `.items` exam-like, `.words` to read, `.total` questions, `.estimate` Σ seconds, `.pilots`.
 * [v5] `yesterday` = what mode 'yesterday' serves (≤ YESTERDAY_MAX; `.all` uncapped, `.estimate` Σ s) · `qualifier` =
 * family members + requirement questions available (`.families`) · `discriminate` = confusable groups · `retest` = the
 * correction set of the latest attempt. Unfiltered counts are memoized per data state (context.ts) and day.
 */
export function modeCounts(ctx: Ctx, filters?: SelectionFilters): Record<string, number> {
  const rules = sessionRules(ctx);
  const deps = depsOf(ctx);
  const memoKey = hasFilters(filters)
    ? undefined
    : [
        rules.today,
        sealedForms(ctx)
          .map((f) => `${f.id}:${f.status}`)
          .join(','),
        [...deps.paused(rules.today)].sort().join(','),
      ].join('|');
  if (memoKey !== undefined) {
    const hit = countsMemo.get(ctx);
    if (hit?.key === memoKey) return { ...hit.counts };
  }
  const tax = ctx.bank.taxonomy;
  const { active, practice, inScope, held } = pools(ctx);
  const key = (q: Question) => rules.key(q.id);
  const unburied = (list: Question[]) => list.filter((q) => !rules.buried(q.id));
  const pool = applyFilters(inScope, filters);
  const s = ctx.states;
  const review = reviewPick(ctx, pool, rules);
  const yesterday = yesterdayList(ctx, rules, new Set(inScope.map((q) => q.id)));
  const families = qualifierFamilies(pool);
  const familyMembers = [...families.values()].reduce((n, m) => n + m.length, 0);
  let latest: (typeof ctx.attempts & {})[number] | undefined;
  for (const a of ctx.attempts ?? []) if (!a.rushed && (!latest || a.finished > latest.finished)) latest = a;
  const out: Record<string, number> = {
    all: pool.length,
    'retry-wrong': pool.filter((q) => s.get(q.id)?.lastOk === false).length,
    srs: review.served.length,
    backlog: review.backlog,
    srsRemaining: review.remaining,
    new: pool.filter((q) => !s.has(q.id)).length,
    flagged: pool.filter((q) => s.get(q.id)?.lastFlag || s.get(q.id)?.lastUnsure).length,
    slow: pool.filter((q) => (s.get(q.id)?.slowCount ?? 0) > 0).length,
    estimateSeconds: pool.reduce((sum, q) => sum + q.time, 0),
    sealed: active.length - practice.length,
    outOfScope: practice.length - inScope.length,
    examLike: pool.filter((q) => isExamLike(q, tax)).length,
    // [v5]
    yesterday: Math.min(YESTERDAY_MAX, yesterday.length),
    'yesterday.all': yesterday.length,
    'yesterday.estimate': yesterday.slice(0, YESTERDAY_MAX).reduce((sum, q) => sum + q.time, 0),
    qualifier: familyMembers + requirementSingles(ctx, rules, pool, `qualifier:${rules.today}`).length,
    'qualifier.families': families.size,
    discriminate: deps.confusableGroups(ctx.bank).length,
    retest: latest ? retestIds(latest.answers).length : 0,
  };
  addPreview(out, 'exam', examPick(unburied(pool), tax.exam.questions, ctx, { deterministic: true, key }), tax);
  if (held.size) {
    for (const form of sealedForms(ctx)) {
      if (form.status !== 'sealed') continue;
      const scored = formQuestions(ctx, form);
      const pilots = examPick(unburied(inScope), sealedPilotCount(scored.length, tax), ctx, { taken: scored, deterministic: true, key });
      addPreview(out, `sealed.${form.id}`, [...scored, ...pilots], tax, pilots.length);
    }
  }
  if (memoKey !== undefined) countsMemo.set(ctx, { key: memoKey, counts: out });
  return { ...out };
}
