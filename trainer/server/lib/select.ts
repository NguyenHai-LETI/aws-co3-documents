// Builds a test session (ordered question list + time limit) for every test mode.
import crypto from 'node:crypto';
import type { AppConfig } from '../config.ts';
import type { BankState } from './bank.ts';
import { isDue } from './stats.ts';
import type { Plan } from '../../shared/types.ts';
import { MODE_INFO } from '../../shared/labels.ts';
import { computeTimeLimit } from '../../shared/timing.ts';
import { applyFilters } from '../../shared/filters.ts';
import type { BuildTestRequest, Question, QuestionState, SelectionFilters, TestSession } from '../../shared/types.ts';

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
}

/** Picks questions per domain proportionally to exam weights, least-recently-seen first. */
function examPick(pool: Question[], n: number, ctx: Ctx): Question[] {
  const domains = ctx.bank.taxonomy.domains;
  const quotas = domains.map((d) => ({ id: d.id, want: Math.floor((n * d.weight) / 100), frac: ((n * d.weight) / 100) % 1 }));
  let rest = n - quotas.reduce((s, q) => s + q.want, 0);
  for (const q of [...quotas].sort((a, b) => b.frac - a.frac)) if (rest-- > 0) q.want++;
  const freshness = (q: Question) => {
    const s = ctx.states.get(q.id);
    return s?.lastAt ? new Date(s.lastAt).getTime() : 0; // never seen = 0 = freshest
  };
  const picked: Question[] = [];
  const used = new Set<string>();
  for (const quota of quotas) {
    const cands = shuffle(pool.filter((q) => q.domain === quota.id)).sort((a, b) => freshness(a) - freshness(b));
    for (const q of cands.slice(0, quota.want)) {
      picked.push(q);
      used.add(q.id);
    }
  }
  if (picked.length < n) {
    const fill = shuffle(pool.filter((q) => !used.has(q.id))).sort((a, b) => freshness(a) - freshness(b));
    picked.push(...fill.slice(0, n - picked.length));
  }
  return shuffle(picked);
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
    if (s && s.box >= ctx.cfg.srs.mastered_box) w *= 0.25;
    if (!s) w *= 0.8;
    return w;
  };
  return weightedSample(pool, weight, n);
}

export function buildTest(req: BuildTestRequest, ctx: Ctx): TestSession {
  const { bank, states, cfg } = ctx;
  const notes: string[] = [];
  const mode = req.mode;
  const active = bank.questions.filter((q) => q.status === 'active');
  let pool = applyFilters(active, req.filters);
  let count = Math.max(1, Math.min(500, req.count ?? (mode === 'exam' ? bank.taxonomy.exam.questions : mode === 'quick' ? cfg.practice.quick_count : cfg.practice.default_count)));
  let picked: Question[] = [];
  let title = req.title ?? MODE_INFO[mode]?.label ?? mode;
  let feedback = req.feedback ?? (mode === 'quick' ? 'practice' : 'exam');
  let keepOrder = false;
  let plan = req.plan;
  let timingPreset = req.timing?.preset;

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
      const now = Date.now();
      const overdue = (q: Question) => now - new Date(states.get(q.id)!.dueAt!).getTime();
      picked = pool.filter((q) => isDue(states.get(q.id), now)).sort((a, b) => overdue(b) - overdue(a));
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
        .sort((a, b) => (states.get(b.id)!.avgTime / b.time) - (states.get(a.id)!.avgTime / a.time));
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
      picked = weightedSample(pool, (q) => ((states.get(q.id)?.box ?? 0) >= cfg.srs.mastered_box ? 0.3 : 1), count);
      break;
    case 'topic':
    case 'custom':
    default:
      picked = shuffle(pool);
  }

  if (!req.title && mode !== 'pack' && mode !== 'coach') title = describeSelection(title, mode, req, ctx);
  if (picked.length > count) picked = picked.slice(0, count);
  if (!keepOrder && mode !== 'exam' && mode !== 'weak') {
    if (req.shuffleQuestions !== false) picked = shuffle(picked);
  }
  if (req.count && picked.length < req.count && !['pack', 'ids', 'coach'].includes(mode)) {
    notes.push(`Chỉ có ${picked.length} câu phù hợp (bạn yêu cầu ${req.count}).`);
  }
  if (!pool.length) notes.push('Bộ lọc không khớp câu nào.');

  const estimateTotal = picked.reduce((s, q) => s + q.time, 0);
  const preset = timingPreset ?? 'standard';
  const timeLimit = computeTimeLimit(estimateTotal, picked.length, preset, req.timing?.minutes, bank.taxonomy.timing);

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
      ...(req.shuffleOptions ? { order: shuffle(q.options.map((o) => o.key)) } : {}),
    })),
    selection: { ...req, ids: mode === 'ids' || mode === 'coach' ? req.ids : undefined },
    plan,
    createdAt: new Date().toISOString(),
    notes,
  };
}

/** Human title such as "Theo chủ đề: Database, Networking" or "Tùy chỉnh: S3 · hard". */
function describeSelection(base: string, mode: string, req: BuildTestRequest, ctx: Ctx): string {
  const f = req.filters ?? {};
  const tax = ctx.bank.taxonomy;
  const parts: string[] = [];
  if (f.topics?.length) parts.push(f.topics.map((t) => tax.topics.find((x) => x.id === t)?.label ?? t).join(', '));
  if (f.domains?.length) parts.push(f.domains.map((d) => tax.domains.find((x) => x.id === d)?.code ?? d).join('+'));
  if (f.services?.length) parts.push(f.services.slice(0, 3).join(', '));
  if (f.tags?.length) parts.push(f.tags.slice(0, 3).join(', '));
  if (f.difficulties?.length) parts.push(f.difficulties.map((d) => tax.difficulties.find((x) => x.id === d)?.label ?? d).join('/'));
  if (f.packs?.length) parts.push(f.packs.length === 1 ? (ctx.bank.packs.find((p) => p.id === f.packs![0])?.title ?? f.packs[0]) : `${f.packs.length} bộ đề`);
  if (f.search) parts.push(`“${f.search}”`);
  if (mode === 'exam') return `${base} (${req.count ?? tax.exam.questions} câu)`;
  return parts.length ? `${base}: ${parts.join(' · ')}` : base;
}

/** Pool sizes for every mode, shown on the "new test" screen. */
export function modeCounts(ctx: Ctx, filters?: SelectionFilters): Record<string, number> {
  const pool = applyFilters(ctx.bank.questions.filter((q) => q.status === 'active'), filters);
  const s = ctx.states;
  return {
    all: pool.length,
    'retry-wrong': pool.filter((q) => s.get(q.id)?.lastOk === false).length,
    srs: pool.filter((q) => isDue(s.get(q.id))).length,
    new: pool.filter((q) => !s.has(q.id)).length,
    flagged: pool.filter((q) => s.get(q.id)?.lastFlag || s.get(q.id)?.lastUnsure).length,
    slow: pool.filter((q) => (s.get(q.id)?.slowCount ?? 0) > 0).length,
    estimateSeconds: pool.reduce((sum, q) => sum + q.time, 0),
  };
}
