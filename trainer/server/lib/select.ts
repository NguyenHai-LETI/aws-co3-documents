// Builds a test session (ordered question list + time limit) for every test mode.
import crypto from 'node:crypto';
import type { AppConfig } from '../config.ts';
import type { BankState } from './bank.ts';
import { isMastered, reviewQueue } from './stats.ts';
import { DAY_MS } from './time.ts';
import { MODE_INFO } from '../../shared/labels.ts';
import { computeTimeLimit } from '../../shared/timing.ts';
import { applyFilters } from '../../shared/filters.ts';
import type { Attempt, BuildTestRequest, DomainDef, Plan, Question, QuestionState, SelectionFilters, TestSession } from '../../shared/types.ts';

export const PEARSON_TITLE = 'Thi thử SAA-C03 · mô phỏng Pearson VUE';
/** Unscored pilot items in a real 65-question SAA-C03 exam. */
export const PILOT_ITEMS = 15;

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

interface Ctx {
  bank: BankState;
  states: Map<string, QuestionState>;
  cfg: AppConfig;
  plans: Plan[];
  attempts?: Attempt[]; // needed for the SRS daily cap (answers already given today)
}

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

/**
 * Picks questions per domain proportionally to exam weights. Preference: never seen, then least recently seen
 * (by day), then long-form (exam-length) stems; random among equals.
 */
function examPick(pool: Question[], n: number, ctx: Ctx): Question[] {
  const quotas = domainQuotas(n, ctx.bank.taxonomy.domains);
  const seenDay = (q: Question) => {
    const s = ctx.states.get(q.id);
    return s?.lastAt ? Math.floor(new Date(s.lastAt).getTime() / DAY_MS) : -1; // never seen = freshest
  };
  const preferred = (list: Question[]) => shuffle(list).sort((a, b) => seenDay(a) - seenDay(b) || Number(b.longForm) - Number(a.longForm));
  const picked: Question[] = [];
  const used = new Set<string>();
  for (const [domain, want] of quotas) {
    for (const q of preferred(pool.filter((x) => x.domain === domain)).slice(0, want)) {
      picked.push(q);
      used.add(q.id);
    }
  }
  if (picked.length < n) picked.push(...preferred(pool.filter((q) => !used.has(q.id))).slice(0, n - picked.length));
  return shuffle(picked);
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
  const pearson = !!req.pearson && mode === 'exam';
  const active = bank.questions.filter((q) => q.status === 'active');
  const pool = applyFilters(active, req.filters);
  let count = pearson
    ? tax.exam.questions
    : Math.max(1, Math.min(500, req.count ?? (mode === 'exam' ? tax.exam.questions : mode === 'quick' ? cfg.practice.quick_count : cfg.practice.default_count)));
  let picked: Question[] = [];
  let title = req.title ?? (pearson ? PEARSON_TITLE : (MODE_INFO[mode]?.label ?? mode));
  let feedback = pearson ? 'exam' : (req.feedback ?? (mode === 'quick' ? 'practice' : 'exam'));
  let keepOrder = false;
  const plan = req.plan;
  let timingPreset = req.timing?.preset ?? (pearson ? 'official' : undefined);

  const lastAtDesc = (a: Question, b: Question) => (states.get(b.id)?.lastAt ?? '').localeCompare(states.get(a.id)?.lastAt ?? '');

  switch (mode) {
    case 'exam':
      picked = examPick(pool, count, ctx);
      break;
    case 'pack': {
      const packId = req.filters?.packs?.[0];
      const pack = bank.packs.find((p) => p.id === packId);
      if (pack && !req.title) title = `Bộ đề: ${pack.title}`;
      picked = pool.filter((q) => !packId || q.pack === packId);
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
      picked = shuffle(pool.filter((q) => !states.has(q.id)));
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
      const missing = ids.filter((id) => !bank.byId.has(id));
      if (missing.length) notes.push(`${missing.length} câu không còn trong ngân hàng: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
      const retired = ids.filter((id) => bank.byId.get(id)?.status === 'retired');
      if (retired.length) notes.push(`Bỏ qua ${retired.length} câu đã retired.`);
      picked = [...new Set(ids)].map((id) => bank.byId.get(id)).filter((q): q is Question => !!q && q.status !== 'retired');
      keepOrder = !req.shuffleQuestions;
      count = picked.length;
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

  if (!req.title && !pearson && mode !== 'pack' && mode !== 'coach') title = describeSelection(title, mode, req, ctx);
  if (picked.length > count) picked = picked.slice(0, count);
  if (!keepOrder && mode !== 'exam' && mode !== 'weak') {
    if (req.shuffleQuestions !== false) picked = shuffle(picked);
  }
  const wanted = pearson ? count : req.count;
  if (wanted && picked.length < wanted && !['pack', 'ids', 'coach'].includes(mode)) {
    notes.push(`Chỉ có ${picked.length} câu phù hợp (bạn yêu cầu ${wanted}).`);
  }
  if (!pool.length) notes.push('Bộ lọc không khớp câu nào.');

  const estimateTotal = picked.reduce((s, q) => s + q.time, 0);
  const preset = timingPreset ?? 'standard';
  const timeLimit = computeTimeLimit(estimateTotal, picked.length, preset, req.timing?.minutes, tax.timing);
  const shuffleOptions = req.shuffleOptions ?? cfg.practice.shuffle_options ?? true;
  const pilots = pearson ? Math.min(PILOT_ITEMS, Math.round((picked.length * PILOT_ITEMS) / Math.max(1, tax.exam.questions))) : 0;

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
    selection: { ...req, ids: mode === 'ids' || mode === 'coach' ? req.ids : undefined },
    plan,
    createdAt: new Date().toISOString(),
    notes,
    ...(pearson ? { pearson: true, unscored: pickPilots(picked, pilots, tax.domains) } : {}),
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
  if (f.services?.length) parts.push(f.services.slice(0, 3).join(', '));
  if (f.tags?.length) parts.push(f.tags.slice(0, 3).join(', '));
  if (f.difficulties?.length) parts.push(f.difficulties.map((d) => tax.difficulties.find((x) => x.id === d)?.label ?? d).join('/'));
  if (f.packs?.length) parts.push(f.packs.length === 1 ? (ctx.bank.packs.find((p) => p.id === f.packs![0])?.title ?? f.packs[0]) : `${f.packs.length} bộ đề`);
  if (f.search) parts.push(`“${f.search}”`);
  if (mode === 'exam') return `${base} (${req.count ?? tax.exam.questions} câu)`;
  return parts.length ? `${base}: ${parts.join(' · ')}` : base;
}

/**
 * Pool sizes for every mode, shown on the "new test" screen.
 * `srs` = due questions offered today (after srs.daily_limit), `backlog` = the rest of the due questions,
 * `srsRemaining` = reviews still allowed today (pass to `modePool(…, { srsLimit })` on the web).
 */
export function modeCounts(ctx: Ctx, filters?: SelectionFilters): Record<string, number> {
  const pool = applyFilters(ctx.bank.questions.filter((q) => q.status === 'active'), filters);
  const s = ctx.states;
  const queue = reviewQueue(pool, s, ctx.attempts ?? [], ctx.cfg);
  return {
    all: pool.length,
    'retry-wrong': pool.filter((q) => s.get(q.id)?.lastOk === false).length,
    srs: queue.today.length,
    backlog: queue.backlog,
    srsRemaining: queue.remaining,
    new: pool.filter((q) => !s.has(q.id)).length,
    flagged: pool.filter((q) => s.get(q.id)?.lastFlag || s.get(q.id)?.lastUnsure).length,
    slow: pool.filter((q) => (s.get(q.id)?.slowCount ?? 0) > 0).length,
    estimateSeconds: pool.reduce((sum, q) => sum + q.time, 0),
  };
}
