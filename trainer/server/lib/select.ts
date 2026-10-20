// Builds a test session (ordered question list + time limit) for every test mode.
// Pools: practice modes never serve questions held back in a sealed form (sealed.ts), nor — practice.exclude_out_of_scope —
// questions whose answer is an out-of-scope service (explicit pack / ids requests keep those). A sealed exam serves one
// form (+ pilots from the practice pool). Every session carries its realism (shared/realism.ts).
import crypto from 'node:crypto';
import type { AppConfig } from '../config.ts';
import { HttpError } from '../http.ts';
import type { BankState } from './bank.ts';
import { isMastered, reviewQueue } from './stats.ts';
import { loadSealed, sealedIds } from './sealed.ts';
import { loadGoal } from './progress.ts';
import { DAY_MS } from './time.ts';
import { MODE_INFO, REQUIREMENT_INFO } from '../../shared/labels.ts';
import { EXAM_PACE_PRESETS, computeTimeLimit, defaultTimingPreset } from '../../shared/timing.ts';
import { applyFilters, hasFilters, newOrder, stableHash, taskQuotas } from '../../shared/filters.ts';
import { isExamLike, testRealism } from '../../shared/realism.ts';
import type {
  Attempt,
  BuildTestRequest,
  Difficulty,
  DomainDef,
  ExamGoal,
  Plan,
  Question,
  QuestionState,
  SealedForm,
  SealedState,
  SelectionFilters,
  Taxonomy,
  TestSession,
} from '../../shared/types.ts';

export const PEARSON_TITLE = 'Thi thử SAA-C03 · mô phỏng Pearson VUE';
/** Unscored pilot items in a real 65-question SAA-C03 exam. */
export const PILOT_ITEMS = 15;
/** First-day diagnostic: questions per exam-guide task (14 tasks → 28). */
export const DIAGNOSTIC_PER_TASK = 2;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Weighted sampling without replacement (Efraimidis–Spirakis). */
function weightedSample<T>(items: T[], weight: (x: T) => number, n: number): T[] {
  return items
    .map((x) => ({ x, k: Math.pow(Math.random(), 1 / Math.max(1e-6, weight(x))) }))
    .sort((a, b) => b.k - a.k)
    .slice(0, n)
    .map((e) => e.x);
}

export interface SelectCtx {
  bank: BankState;
  states: Map<string, QuestionState>;
  cfg: AppConfig;
  plans: Plan[];
  attempts?: Attempt[]; // needed for the SRS daily cap (answers already given today)
  sealed?: SealedState; // sealed forms — default: sealed.ts (sealedIds / loadSealed); unit tests pass their own
  goal?: ExamGoal; // learner goal — default: progress.ts loadGoal (goal.esl → the ESL clock by default)
}
type Ctx = SelectCtx;

/** Ids held back in forms that are still sealed (hidden from every practice mode). */
function heldBack(ctx: Ctx): Set<string> {
  if (ctx.sealed) return new Set(ctx.sealed.forms.filter((f) => f.status === 'sealed').flatMap((f) => f.ids));
  return sealedIds();
}

function sealedForms(ctx: Ctx): SealedForm[] {
  return (ctx.sealed ?? loadSealed()).forms;
}

function goalOf(ctx: Ctx): ExamGoal {
  if (ctx.goal) return ctx.goal;
  try {
    return loadGoal();
  } catch {
    return {};
  }
}

/** Active questions → not sealed (practice) → in scope (what filter-based practice modes draw from). */
function pools(ctx: Ctx): { active: Question[]; practice: Question[]; inScope: Question[]; held: Set<string> } {
  const held = heldBack(ctx);
  const active = ctx.bank.questions.filter((q) => q.status === 'active');
  const practice = held.size ? active.filter((q) => !held.has(q.id)) : active;
  const inScope = (ctx.cfg.practice?.exclude_out_of_scope ?? true) ? practice.filter((q) => !q.outOfScope) : practice;
  return { active, practice, inScope, held };
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

const familyMemo = new WeakMap<readonly Question[], Map<string, string>>();

/**
 * Variant families: connected components of the `variant_of` links (either direction, sibling variants included),
 * as question id → family id (questions without links are their own family and are not in the map). A mock never
 * takes two questions of one family — the second would be answered from short-term memory of the first.
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

/** Day number of the last answer (-1 = never seen). */
function seenDayOf(states: Map<string, QuestionState>, q: Question): number {
  const s = states.get(q.id);
  return s?.lastAt ? Math.floor(new Date(s.lastAt).getTime() / DAY_MS) : -1;
}

interface PickOptions {
  taken?: Question[]; // questions already in the test (their variant families are excluded)
  deterministic?: boolean; // stable hash tie-breaks instead of random ones (previews)
}

/**
 * Picks questions per domain proportionally to exam weights. Preference: never seen, then exam-like (long scenario stem,
 * full-sentence options — shared/realism.ts), then least recently seen (by day), then long-form stems; random among
 * equals. Never two questions of one variant family (an original and its variant, or two variants of one original).
 */
function examPick(pool: Question[], n: number, ctx: Ctx, opts: PickOptions = {}): Question[] {
  const tax = ctx.bank.taxonomy;
  const families = variantFamilies(ctx.bank);
  const family = (q: Question) => families.get(q.id) ?? q.id;
  const ties = opts.deterministic ? (list: Question[]) => [...list].sort((a, b) => stableHash(a.id, 'exam') - stableHash(b.id, 'exam')) : shuffle;
  const preferred = (list: Question[]) =>
    ties(list)
      .map((q) => ({ q, seen: seenDayOf(ctx.states, q), exam: isExamLike(q, tax) }))
      .sort((a, b) => Number(a.seen >= 0) - Number(b.seen >= 0) || Number(b.exam) - Number(a.exam) || a.seen - b.seen || Number(b.q.longForm) - Number(a.q.longForm))
      .map((e) => e.q);
  const picked: Question[] = [];
  const used = new Set<string>();
  const usedFamilies = new Set((opts.taken ?? []).map(family));
  const take = (list: Question[], want: number) => {
    let k = 0;
    for (const q of list) {
      if (k >= want) break;
      if (used.has(q.id) || usedFamilies.has(family(q))) continue;
      picked.push(q);
      used.add(q.id);
      usedFamilies.add(family(q));
      k++;
    }
  };
  for (const [domain, want] of domainQuotas(n, tax.domains)) take(preferred(pool.filter((x) => x.domain === domain)), want);
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
 * the same bank and history always give the same questions. Never two questions of one variant family.
 */
function diagnosticPick(pool: Question[], n: number, ctx: Ctx): { picked: Question[]; short: string[]; perTask: Set<number> } {
  const tax = ctx.bank.taxonomy;
  const tasks = tax.tasks ?? [];
  const families = variantFamilies(ctx.bank);
  const family = (q: Question) => families.get(q.id) ?? q.id;
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

function weakPick(pool: Question[], n: number, ctx: Ctx): Question[] {
  // accuracy per topic and per tag from history; unseen dimensions count as 60 % (unknown ≠ strong)
  const agg = new Map<string, { t: number; c: number }>();
  const add = (k: string, ok: boolean) => {
    const g = agg.get(k) ?? { t: 0, c: 0 };
    g.t++;
    if (ok) g.c++;
    agg.set(k, g);
  };
  for (const s of ctx.states.values()) {
    const q = ctx.bank.byId.get(s.id);
    if (!q) continue;
    for (let i = 0; i < s.attempts; i++) {
      const ok = i < s.correct;
      add(`topic:${q.topic}`, ok);
      for (const t of q.tags) add(`tag:${t}`, ok);
      for (const sv of q.services) add(`svc:${sv}`, ok);
    }
  }
  const accOf = (k: string) => {
    const g = agg.get(k);
    return g && g.t >= 2 ? g.c / g.t : 0.6;
  };
  const weight = (q: Question) => {
    const s = ctx.states.get(q.id);
    const dims = [accOf(`topic:${q.topic}`), ...q.tags.map((t) => accOf(`tag:${t}`)), ...q.services.map((sv) => accOf(`svc:${sv}`))];
    const weakness = 1 - Math.min(...dims);
    let w = 0.2 + 3 * weakness;
    if (s?.lastOk === false) w += 2;
    if (s?.lastUnsure) w += 1;
    if (isMastered(s, ctx.cfg)) w *= 0.25;
    if (!s) w *= 0.8;
    return w;
  };
  return weightedSample(pool, weight, n);
}

export function buildTest(req: BuildTestRequest, ctx: Ctx): TestSession {
  const { bank, states, cfg } = ctx;
  const tax = bank.taxonomy;
  const notes: string[] = [];
  const mode = req.mode;
  const sealedMode = mode === 'sealed';
  const pearson = sealedMode || (!!req.pearson && mode === 'exam');
  const { active, practice, inScope, held } = pools(ctx);
  // explicit packs keep out-of-scope questions; the other filter-based modes draw from the in-scope pool
  const pool = applyFilters(mode === 'pack' ? practice : inScope, req.filters);
  const defaultCount =
    mode === 'exam' ? tax.exam.questions : mode === 'quick' ? cfg.practice.quick_count : mode === 'diagnostic' ? DIAGNOSTIC_PER_TASK * (tax.tasks?.length ?? 0) : cfg.practice.default_count;
  const asked = Number(req.count);
  let count = pearson && !sealedMode ? tax.exam.questions : Math.max(1, Math.min(500, req.count !== undefined && Number.isFinite(asked) ? Math.round(asked) : defaultCount));
  let picked: Question[] = [];
  let title = req.title ?? (pearson && !sealedMode ? PEARSON_TITLE : (MODE_INFO[mode]?.label ?? mode));
  let feedback = pearson ? 'exam' : (req.feedback ?? (mode === 'quick' ? 'practice' : 'exam'));
  let keepOrder = false;
  const plan = req.plan;
  // full mocks and sealed forms run on the honest reading-load clock unless the learner picked another one
  let timingPreset = req.timing?.preset ?? (mode === 'exam' || sealedMode ? defaultTimingPreset(mode) : undefined);
  let unscored: string[] | undefined;
  let sealedForm: string | undefined;
  let diagnostic = false;
  let countNote = !['pack', 'ids', 'coach', 'sealed', 'diagnostic'].includes(mode);

  const lastAtDesc = (a: Question, b: Question) => (states.get(b.id)?.lastAt ?? '').localeCompare(states.get(a.id)?.lastAt ?? '');

  switch (mode) {
    case 'exam':
      picked = examPick(pool, count, ctx);
      break;
    case 'sealed': {
      // the form's questions are the scored items; pilots come from the practice pool like the real exam's 15
      const form = chooseForm(ctx, typeof req.form === 'string' && req.form.trim() ? req.form.trim().slice(0, 40) : undefined);
      const scored = formQuestions(ctx, form);
      const lost = new Set(form.ids).size - scored.length;
      if (!scored.length) throw new HttpError(409, `Đề niêm phong ${form.id} không còn câu nào dùng được (đã bị xoá, chuyển draft hoặc retired).`);
      if (lost) notes.push(`${lost} câu của đề ${form.id} không còn dùng được (đã bị xoá, chuyển draft hoặc retired) — đề còn ${scored.length} câu tính điểm.`);
      const pilots = examPick(inScope, sealedPilotCount(scored.length, tax), ctx, { taken: scored });
      picked = shuffle([...scored, ...pilots]);
      unscored = pilots.map((q) => q.id);
      sealedForm = form.id;
      if (!req.title) title = `🔒 Đề niêm phong ${form.id} · mô phỏng Pearson VUE`;
      count = picked.length;
      keepOrder = true; // already shuffled
      break;
    }
    case 'diagnostic': {
      const d = diagnosticPick(pool, count, ctx);
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
      picked = pool.filter((q) => states.get(q.id)?.lastOk === false).sort(lastAtDesc);
      break;
    case 'srs': {
      // due questions, lowest recall probability first, capped by srs.daily_limit (minus today's SRS answers)
      const queue = reviewQueue(pool, states, ctx.attempts ?? [], cfg);
      picked = queue.today;
      if (queue.due.length && !queue.today.length) {
        notes.push(`Bạn đã ôn đủ ${cfg.srs.daily_limit} câu hôm nay (giới hạn srs.daily_limit) — ${queue.due.length} câu đến hạn được để dành cho ngày mai.`);
      } else if (queue.backlog) {
        notes.push(`Giới hạn ôn ${cfg.srs.daily_limit} câu/ngày: hôm nay còn ${queue.today.length} câu, ${queue.backlog} câu tồn chuyển sang ngày sau.`);
      }
      break;
    }
    case 'new':
      // deterministic, domain-balanced order: the app knows which questions come next (ENRICH prepares them first)
      picked = newOrder(
        pool.filter((q) => !states.has(q.id)),
        tax.domains,
      ).slice(0, count);
      break;
    case 'flagged':
      picked = pool.filter((q) => states.get(q.id)?.lastFlag || states.get(q.id)?.lastUnsure).sort(lastAtDesc);
      break;
    case 'slow':
      picked = pool
        .filter((q) => (states.get(q.id)?.slowCount ?? 0) > 0)
        .sort((a, b) => states.get(b.id)!.avgTime / b.time - states.get(a.id)!.avgTime / a.time);
      break;
    case 'weak':
      picked = weakPick(pool, count, ctx);
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
          if (!req.title) title = `🤖 ${s.title}`;
          if (s.feedback && !req.feedback) feedback = s.feedback;
          if (s.timing && !timingPreset) timingPreset = s.timing;
          if (s.questions?.length) ids = s.questions;
          else if (s.filter) {
            const sub = buildTest(
              {
                ...s.filter,
                title: req.title ?? `🤖 ${s.title}`,
                feedback: req.feedback ?? s.filter.feedback ?? s.feedback,
                timing: req.timing ?? s.filter.timing ?? (s.timing ? { preset: s.timing } : undefined),
                shuffleOptions: req.shuffleOptions ?? s.filter.shuffleOptions,
                recallFirst: req.recallFirst ?? s.filter.recallFirst,
              },
              ctx,
            );
            return { ...sub, mode: 'coach', plan, selection: { ...req } };
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
      picked = weightedSample(pool, (q) => (isMastered(states.get(q.id), cfg) ? 0.3 : 1), count);
      break;
    case 'topic':
    case 'custom':
    default:
      picked = shuffle(pool);
  }

  if (!req.title && !pearson && !['pack', 'coach', 'diagnostic'].includes(mode)) title = describeSelection(title, mode, req, ctx);
  if (picked.length > count) picked = picked.slice(0, count);
  if (!keepOrder && mode !== 'exam' && mode !== 'weak') {
    if (req.shuffleQuestions !== false) picked = shuffle(picked);
  }
  const wanted = pearson ? count : req.count;
  if (countNote && wanted && picked.length < wanted) notes.push(`Chỉ có ${picked.length} câu phù hợp (bạn yêu cầu ${wanted}).`);
  if (!pool.length && !['ids', 'coach', 'sealed'].includes(mode)) notes.push('Bộ lọc không khớp câu nào.');
  // say so when a filter the learner chose lost questions to practice.exclude_out_of_scope (unfiltered modes stay quiet)
  if (inScope !== practice && !['pack', 'ids', 'coach', 'sealed'].includes(mode) && hasFilters(req.filters)) {
    const dropped = applyFilters(practice, req.filters).filter((q) => q.outOfScope).length;
    if (dropped) notes.push(`Bỏ qua ${dropped} câu có đáp án là dịch vụ ngoài phạm vi đề thi (practice.exclude_out_of_scope).`);
  }

  const realism = testRealism(picked, tax);
  const estimateTotal = picked.reduce((s, q) => s + q.time, 0);
  const preset = timingPreset ?? 'standard';
  // ESL +30 (× 160/130) on the exam-pace clocks: the request decides, otherwise the learner's goal (goal.esl)
  const esl = EXAM_PACE_PRESETS.includes(preset) && (typeof req.timing?.esl === 'boolean' ? req.timing.esl : goalOf(ctx).esl === true);
  const timeLimit = computeTimeLimit(estimateTotal, picked.length, preset, req.timing?.minutes, tax.timing, { words: realism.words, esl });
  const shuffleOptions = req.shuffleOptions ?? cfg.practice.shuffle_options ?? true;
  if (pearson && !sealedMode) {
    const pilots = Math.min(PILOT_ITEMS, Math.round((picked.length * PILOT_ITEMS) / Math.max(1, tax.exam.questions)));
    unscored = pickPilots(picked, pilots, tax.domains);
  }

  return {
    sessionId: crypto.randomUUID(),
    mode,
    title,
    feedback,
    timeLimit,
    estimateTotal,
    timingPreset: preset,
    questions: picked.map((q) => ({
      id: q.id,
      ...(shuffleOptions ? { order: shuffle(q.options.map((o) => o.key)) } : {}),
    })),
    selection: { ...req, ids: mode === 'ids' || mode === 'coach' ? req.ids : undefined, ...(sealedForm ? { form: sealedForm } : {}) },
    plan,
    createdAt: new Date().toISOString(),
    notes,
    realism,
    ...(pearson ? { pearson: true, unscored: unscored ?? [] } : {}),
    ...(sealedForm ? { sealedForm } : {}),
    ...(diagnostic ? { diagnostic: true } : {}),
    ...(req.recallFirst ? { recallFirst: true } : {}),
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

/**
 * Pool sizes for every mode, shown on the "new test" screen (sealed and — practice.exclude_out_of_scope — out-of-scope
 * questions excluded everywhere). `srs` = due questions offered today (after srs.daily_limit), `backlog` = the rest of
 * the due questions, `srsRemaining` = reviews still allowed today (pass to `modePool(…, { srsLimit })` on the web).
 * `sealed` / `outOfScope` = active questions held back / left out; `examLike` = exam-like questions in the pool.
 * Previews (stable tie-breaks): `exam.*` = what a full mock would serve now, `sealed.<form>.*` = each form still sealed
 * with its pilots — `.items` exam-like, `.words` to read, `.total` questions, `.estimate` Σ seconds, `.pilots`.
 */
export function modeCounts(ctx: Ctx, filters?: SelectionFilters): Record<string, number> {
  const tax = ctx.bank.taxonomy;
  const { active, practice, inScope, held } = pools(ctx);
  const pool = applyFilters(inScope, filters);
  const s = ctx.states;
  const queue = reviewQueue(pool, s, ctx.attempts ?? [], ctx.cfg);
  const out: Record<string, number> = {
    all: pool.length,
    'retry-wrong': pool.filter((q) => s.get(q.id)?.lastOk === false).length,
    srs: queue.today.length,
    backlog: queue.backlog,
    srsRemaining: queue.remaining,
    new: pool.filter((q) => !s.has(q.id)).length,
    flagged: pool.filter((q) => s.get(q.id)?.lastFlag || s.get(q.id)?.lastUnsure).length,
    slow: pool.filter((q) => (s.get(q.id)?.slowCount ?? 0) > 0).length,
    estimateSeconds: pool.reduce((sum, q) => sum + q.time, 0),
    sealed: active.length - practice.length,
    outOfScope: practice.length - inScope.length,
    examLike: pool.filter((q) => isExamLike(q, tax)).length,
  };
  addPreview(out, 'exam', examPick(pool, tax.exam.questions, ctx, { deterministic: true }), tax);
  if (held.size) {
    for (const form of sealedForms(ctx)) {
      if (form.status !== 'sealed') continue;
      const scored = formQuestions(ctx, form);
      const pilots = examPick(inScope, sealedPilotCount(scored.length, tax), ctx, { taken: scored, deterministic: true });
      addPreview(out, `sealed.${form.id}`, [...scored, ...pilots], tax, pilots.length);
    }
  }
  return out;
}
