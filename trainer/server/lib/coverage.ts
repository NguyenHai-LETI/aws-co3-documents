// Bank coverage vs the SAA-C03 exam guide (for /trainer-coverage): share of each domain vs its exam
// weight, questions per task statement, taxonomy services without (or with few) questions, and questions
// whose qualifier points at another domain — likely misclassified; ENRICH `classify` re-checks those
// (scripts/enrich-batch.ts --ids). Counts use active questions only.
// [v5] Questions held back in sealed forms are never listed by id (the report is synced and read by the coach), and the
// official exam guide (bank/exam-guide, 189 Knowledge/Skills bullets) adds per-task / per-bullet coverage — the same numbers as
// Ngân hàng → Chất lượng → 🗺️ Đề cương.
// [v6] Two more sections: question tiers (shared/tier.ts: A exam-grade · B short scenario · C drill) vs the tier-A pool target
// (TIER_TARGET: 280, split by domain weight, then by the exam-guide bullets of each task; multiple-response share within tier A),
// and the services marked `scope: legacy` in the taxonomy (dropped from the official in-scope list / retired with no in-scope
// successor): how many active questions name them in a correct option, only in a wrong option, or anywhere.
import type { BankState } from './bank.ts';
import { localDateKey } from './time.ts';
import { sealedIds } from './sealed.ts';
import { guideCoverage, loadExamGuide } from './exam-guide.ts';
import { detectServices } from './classify.ts';
import { questionTier } from '../../shared/tier.ts';
import type { DomainId, GuideTaskCoverage, Question, Taxonomy, Tier } from '../../shared/types.ts';

/** A task is "thin" below this share of its expected count (bank total × domain weight ÷ tasks of the domain). */
export const THIN_TASK_RATIO = 0.5;
const THIN_SERVICE = 2;
const MAX_MISFITS = 60;
/** [v6] Exam-grade (tier A) pool target and the multiple-response share wanted within it. */
export const TIER_TARGET = { poolA: 280, multiInA: [0.25, 0.3] as [number, number] };
const MAX_LEGACY_IDS = 12;

/** [v6] Tier A / B / C counts. */
export interface TierCounts {
  A: number;
  B: number;
  C: number;
}

export interface TierRow extends TierCounts {
  id: string;
  label: string;
  bullets: number; // exam-guide Knowledge + Skills bullets (the task-split weight)
  target: number; // tier-A questions wanted
  need: number; // tier-A questions still missing (0 at / above the target)
  multiA: number; // multiple-response questions among the tier-A ones
}

export interface TierCoverage {
  pool: number; // active, in-scope questions (sealed ones included: counts only)
  target: number;
  counts: TierCounts;
  need: number;
  multiA: { count: number; share: number; target: [number, number] }; // share of tier A, 0–1
  domains: (TierRow & { code: string; weight: number })[];
  tasks: (TierRow & { domain: DomainId })[];
  noTaskA: number; // tier-A questions without a task (counted in their domain only)
}

export interface LegacyServiceCoverage {
  name: string;
  topic: string;
  key: number; // active questions whose correct option names the service
  distractor: number; // …named by a wrong option only
  anywhere: number; // …named anywhere (stem, options, explanation, `services`)
  ids: string[]; // key questions not held back in a sealed form (first MAX_LEGACY_IDS)
}

export interface LegacyCoverage {
  services: LegacyServiceCoverage[];
  key: number; // distinct active questions with a legacy service in a correct option
  distractor: number; // …with one only in a wrong option
  anywhere: number;
  sealedHidden: number; // key questions held back in a sealed form (counted, never listed)
}

export interface DomainCoverage {
  id: DomainId;
  code: string;
  label: string;
  weight: number; // % of the exam
  count: number;
  share: number; // % of the bank
  missing: number; // questions to add to this domain alone to reach its weight (0 when at/above it)
  unenriched: number; // not reviewed by ENRICH yet: the domain/task may still move
}

export interface TaskCoverage {
  id: string;
  domain: DomainId;
  label: string;
  count: number;
  expected: number;
  longForm: number;
  hard: number;
  thin: boolean;
}

export interface Misfit {
  id: string;
  hash: string;
  from: DomainId;
  to: DomainId;
  qualifier: string;
}

export interface Coverage {
  date: string;
  total: number;
  enriched: number;
  noTask: number;
  domains: DomainCoverage[];
  tasks: TaskCoverage[];
  services: { none: Record<string, string[]>; thin: { name: string; count: number }[] };
  misfits: Misfit[];
  misfitsTotal: number;
  sealedHidden: number; // [v5] misfits left out because the question is held back in a sealed form
  tiers: TierCoverage; // [v6]
  legacy: LegacyCoverage; // [v6]
  guide?: {
    // [v5] official exam guide coverage (practice pool: active, not sealed, in scope)
    fetched?: string;
    bullets: number;
    uncovered: { id: string; task: string; text: string }[]; // bullets without any question
    needLong: number; // bullets that still want exam-like (long) questions
    tasks: GuideTaskCoverage[];
    multi: { count: number; share: number; target: [number, number] };
    chooseThree: number;
    guessed: number;
  };
}

export interface CoverageOptions {
  sealed?: ReadonlySet<string>; // default: the forms still sealed (sealed.ts)
  guide?: boolean; // default true: include the exam-guide section
  tierTarget?: number; // [v6] default TIER_TARGET.poolA
  bullets?: ReadonlyMap<string, number>; // [v6] task → exam-guide bullets (default: bank/exam-guide)
}

/** [v6] Largest-remainder split of `total` in proportion to `weights`: integers summing to `total` (ties: earlier first). */
export function apportion(total: number, weights: readonly number[]): number[] {
  const n = Math.max(0, Math.round(total));
  const w = weights.map((x) => (x > 0 ? x : 0));
  const sum = w.reduce((s, x) => s + x, 0);
  if (!n || !sum) return w.map(() => 0);
  const exact = w.map((x) => (n * x) / sum);
  const out = exact.map((x) => Math.floor(x));
  let left = n - out.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

/** [v6] Exam-guide bullets (Knowledge + Skills) per task. */
export function guideBulletsByTask(): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of loadExamGuide().bullets) m.set(b.task, (m.get(b.task) ?? 0) + 1);
  return m;
}

const tierOf = (q: Question, tax: Taxonomy): Tier => q.tier ?? questionTier(q, tax);

/**
 * [v6] Tier counts of the active in-scope questions vs the tier-A target: `target` split by domain weight, then within a domain
 * by the exam-guide bullets of each task (equal split when the guide is missing).
 */
export function tierCoverage(questions: readonly Question[], tax: Taxonomy, target = TIER_TARGET.poolA, bullets: ReadonlyMap<string, number> = guideBulletsByTask()): TierCoverage {
  const pool = questions.filter((q) => q.status === 'active' && !q.outOfScope);
  const tier = new Map(pool.map((q) => [q, tierOf(q, tax)] as const));
  const counts = (qs: readonly Question[]): TierCounts => {
    const c: TierCounts = { A: 0, B: 0, C: 0 };
    for (const q of qs) c[tier.get(q)!]++;
    return c;
  };
  const multiA = (qs: readonly Question[]) => qs.filter((q) => tier.get(q) === 'A' && q.answer.length > 1).length;
  const row = (id: string, label: string, qs: readonly Question[], goal: number, nBullets: number): TierRow => {
    const c = counts(qs);
    return { id, label, bullets: nBullets, ...c, target: goal, need: Math.max(0, goal - c.A), multiA: multiA(qs) };
  };
  const domainGoals = apportion(target, tax.domains.map((d) => d.weight));
  const domains: TierCoverage['domains'] = [];
  const tasks: TierCoverage['tasks'] = [];
  tax.domains.forEach((d, i) => {
    const own = tax.tasks.filter((t) => t.domain === d.id);
    const weights = own.map((t) => bullets.get(t.id) ?? 0);
    const goals = apportion(domainGoals[i], weights.some((x) => x > 0) ? weights : own.map(() => 1));
    const total = weights.reduce((s, x) => s + x, 0);
    domains.push({ ...row(d.id, d.label_vi, pool.filter((q) => q.domain === d.id), domainGoals[i], total), code: d.code, weight: d.weight });
    own.forEach((t, k) => tasks.push({ ...row(t.id, t.label_vi, pool.filter((q) => q.task === t.id), goals[k], weights[k]), domain: t.domain }));
  });
  const all = counts(pool);
  const m = multiA(pool);
  return {
    pool: pool.length,
    target,
    counts: all,
    need: Math.max(0, target - all.A),
    multiA: { count: m, share: all.A ? Math.round((1000 * m) / all.A) / 1000 : 0, target: TIER_TARGET.multiInA },
    domains,
    tasks,
    noTaskA: pool.filter((q) => !q.task && tier.get(q) === 'A').length,
  };
}

/** [v6] Active questions naming a `scope: legacy` service: in a correct option, in a wrong option only, anywhere. */
export function legacyCoverage(questions: readonly Question[], tax: Taxonomy, sealed: ReadonlySet<string> = new Set()): LegacyCoverage {
  const names = Object.entries(tax.services ?? {})
    .filter(([, d]) => d?.scope === 'legacy')
    .map(([n]) => n);
  const legacy = new Set(names);
  const rows = new Map(names.map((n): [string, LegacyServiceCoverage] => [n, { name: n, topic: tax.services[n].topic, key: 0, distractor: 0, anywhere: 0, ids: [] }]));
  const out: LegacyCoverage = { services: [], key: 0, distractor: 0, anywhere: 0, sealedHidden: 0 };
  if (!legacy.size) return out;
  const named = (text: string) => new Set(detectServices(text, tax).filter((s) => legacy.has(s)));
  const hidden = new Set<string>();
  for (const q of questions) {
    if (q.status !== 'active') continue;
    const inKey = named(q.options.filter((o) => q.answer.includes(o.key)).map((o) => o.text).join('\n'));
    const inWrong = named(q.options.filter((o) => !q.answer.includes(o.key)).map((o) => o.text).join('\n'));
    const any = named([q.stem, q.explanation].join('\n'));
    for (const s of [...inKey, ...inWrong, ...q.services.filter((x) => legacy.has(x))]) any.add(s);
    if (!any.size) continue;
    out.anywhere++;
    if (inKey.size) out.key++;
    else if (inWrong.size) out.distractor++;
    for (const s of any) {
      const r = rows.get(s)!;
      r.anywhere++;
      if (inKey.has(s)) {
        r.key++;
        if (sealed.has(q.id)) hidden.add(q.id);
        else if (r.ids.length < MAX_LEGACY_IDS) r.ids.push(q.id);
      } else if (inWrong.has(s)) r.distractor++;
    }
  }
  out.services = [...rows.values()].sort((a, b) => b.key - a.key || b.anywhere - a.anywhere || a.name.localeCompare(b.name));
  out.sealedHidden = hidden.size;
  return out;
}

// ENRICH.md A4: the qualifier the question asks for decides the domain.
const QUALIFIERS: { domain: DomainId; re: RegExp }[] = [
  {
    domain: 'cost',
    re: /\b(?:most|more) cost[- ]effective\b|\b(?:lowest|least|lower|minimal|minimum) (?:possible |overall )?costs?\b|\bleast expensive\b|\bcheapest\b|\b(?:minimi[sz]e|reduce|cut|optimi[sz]e) (?:the |its |their |overall |storage |compute )?costs?\b/i,
  },
  { domain: 'secure', re: /\bmost secure\b|\bleast[- ]privilege\b/i },
];

function misfit(q: Question): Misfit | undefined {
  for (const { domain, re } of QUALIFIERS) {
    const m = q.stem.match(re);
    if (m) return domain === q.domain ? undefined : { id: q.id, hash: q.hash, from: q.domain, to: domain, qualifier: m[0] };
  }
  return undefined;
}

const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : 0);

export function computeCoverage(bank: BankState, today: string = localDateKey(new Date()), opts: CoverageOptions = {}): Coverage {
  const sealed = opts.sealed ?? sealedIds();
  const { taxonomy: tax } = bank;
  const active = bank.questions.filter((q) => q.status === 'active');
  const total = active.length;

  const domains = tax.domains.map((d): DomainCoverage => {
    const qs = active.filter((q) => q.domain === d.id);
    const w = d.weight / 100;
    return {
      id: d.id,
      code: d.code,
      label: d.label_vi,
      weight: d.weight,
      count: qs.length,
      share: pct(qs.length, total),
      missing: w < 1 ? Math.max(0, Math.ceil((w * total - qs.length) / (1 - w))) : 0,
      unenriched: qs.filter((q) => !q.enriched).length,
    };
  });

  const tasks = tax.tasks.map((t): TaskCoverage => {
    const qs = active.filter((q) => q.task === t.id);
    const weight = tax.domains.find((d) => d.id === t.domain)?.weight ?? 0;
    const siblings = tax.tasks.filter((x) => x.domain === t.domain).length || 1;
    const expected = Math.round((total * weight) / 100 / siblings);
    return {
      id: t.id,
      domain: t.domain,
      label: t.label_vi,
      count: qs.length,
      expected,
      longForm: qs.filter((q) => q.longForm).length,
      hard: qs.filter((q) => q.difficulty === 'hard').length,
      thin: qs.length < expected * THIN_TASK_RATIO,
    };
  });

  const perService = new Map<string, number>();
  for (const q of active) for (const s of q.services) perService.set(s, (perService.get(s) ?? 0) + 1);
  const none: Record<string, string[]> = {};
  const thin: { name: string; count: number }[] = [];
  for (const [name, def] of Object.entries(tax.services)) {
    const n = perService.get(name) ?? 0;
    if (!n) (none[def.topic] ??= []).push(name);
    else if (n <= THIN_SERVICE) thin.push({ name, count: n });
  }
  thin.sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));

  const allMisfits = active.map(misfit).filter((m): m is Misfit => !!m);
  const misfits = allMisfits.filter((m) => !sealed.has(m.id));
  let guide: Coverage['guide'];
  if (opts.guide !== false) {
    const g = guideCoverage(bank);
    if (g.bullets.length)
      guide = {
        fetched: g.fetched,
        bullets: g.bullets.length,
        uncovered: g.bullets.filter((b) => !b.questions).map((b) => ({ id: b.id, task: b.task, text: b.text })),
        needLong: g.bullets.filter((b) => b.need > 0).length,
        tasks: g.tasks,
        multi: g.multi,
        chooseThree: g.chooseThree,
        guessed: g.guessed,
      };
  }
  return {
    date: today,
    total,
    enriched: active.filter((q) => q.enriched).length,
    noTask: active.filter((q) => !q.task).length,
    domains,
    tasks,
    services: { none, thin },
    misfits: misfits.slice(0, MAX_MISFITS),
    misfitsTotal: misfits.length,
    sealedHidden: allMisfits.length - misfits.length,
    tiers: tierCoverage(bank.questions, tax, opts.tierTarget ?? TIER_TARGET.poolA, opts.bullets ?? guideBulletsByTask()),
    legacy: legacyCoverage(bank.questions, tax, sealed),
    ...(guide ? { guide } : {}),
  };
}

export function coverageMarkdown(c: Coverage): string {
  const code = (id: DomainId) => c.domains.find((d) => d.id === id)?.code ?? id;
  const out: string[] = [
    `# 📐 Độ phủ ngân hàng câu hỏi — ${c.date}`,
    '',
    `${c.total} câu active · ${c.enriched} câu đã qua ENRICH (domain/task đã được AI soát) · ${c.noTask} câu chưa gắn task`,
    '',
    '## 1. Domain so với trọng số đề thi',
    '',
    '| Domain | Trọng số đề | Số câu | Tỉ lệ ngân hàng | Chênh | Chưa ENRICH |',
    '|---|---:|---:|---:|---|---:|',
    ...c.domains.map(
      (d) =>
        `| ${d.code} ${d.label} | ${d.weight}% | ${d.count} | ${d.share}% | ${d.missing ? `thiếu ~${d.missing} câu` : d.share - d.weight >= 1 ? `dư ${Math.round(d.share - d.weight)} điểm %` : 'đủ'} | ${d.unenriched} |`,
    ),
    '',
    '“Thiếu ~N câu” = số câu cần thêm riêng cho domain đó để đạt trọng số. Domain/task của câu chưa ENRICH được gán bằng từ khoá nên còn có thể đổi.',
    '',
    '## 2. Task statement (exam guide)',
    '',
    '| Task | Số câu | Kỳ vọng | Câu dài | Hard | |',
    '|---|---:|---:|---:|---:|---|',
    ...c.tasks.map((t) => `| ${t.id} ${t.label} | ${t.count} | ${t.expected} | ${t.longForm} | ${t.hard} | ${t.thin ? '⚠️ mỏng' : ''} |`),
    '',
    `Kỳ vọng = tổng số câu × trọng số domain ÷ số task của domain; ⚠️ khi dưới ${Math.round(THIN_TASK_RATIO * 100)} % kỳ vọng.`,
    '',
    '## 3. Service trong taxonomy chưa có / có ít câu',
    '',
  ];
  const noneCount = Object.values(c.services.none).reduce((s, l) => s + l.length, 0);
  out.push(`**Chưa có câu nào (${noneCount}):**`, '');
  for (const [topic, names] of Object.entries(c.services.none).sort(([a], [b]) => a.localeCompare(b))) out.push(`- ${topic}: ${names.join(', ')}`);
  out.push('', `**Chỉ 1–${THIN_SERVICE} câu (${c.services.thin.length}):** ${c.services.thin.map((s) => `${s.name} (${s.count})`).join(', ') || '—'}`, '');
  out.push('## 4. Câu có thể phân loại sai (qualifier trong đề ≠ domain)', '');
  if (!c.misfitsTotal) out.push('Không có.');
  else {
    out.push(
      `${c.misfitsTotal} câu${c.misfitsTotal > c.misfits.length ? ` (liệt kê ${c.misfits.length})` : ''}. Gợi ý theo qualifier — kiểm tra lại mục tiêu chính của đề trước khi đổi; ENRICH \`classify\` xử lý: \`node trainer/scripts/enrich-batch.ts --ids <id,…>\`.`,
      '',
      '| Câu | Domain → gợi ý | Qualifier | base |',
      '|---|---|---|---|',
      ...c.misfits.map((m) => `| \`${m.id}\` | ${code(m.from)} → ${code(m.to)} | ${m.qualifier} | ${m.hash} |`),
    );
  }
  if (c.sealedHidden) out.push('', `(${c.sealedHidden} câu đang niêm phong không được liệt kê.)`);
  const g = c.guide;
  if (g) {
    const pctOf = (x: number) => Math.round(x * 100);
    out.push(
      '',
      `## 5. Đề cương chính thức (${g.bullets} mục Knowledge/Skills${g.fetched ? `, lấy ngày ${g.fetched}` : ''})`,
      '',
      'Tính trên các câu luyện được (active, không niêm phong, trong phạm vi đề). Cùng số liệu với Ngân hàng → Chất lượng → 🗺️ Đề cương.',
      '',
      '| Task | Số câu | Câu dài / mục tiêu | Nhiều đáp án | Mục chưa có câu |',
      '|---|---:|---:|---:|---:|',
      ...g.tasks.map((t) => `| ${t.id} | ${t.questions} | ${t.longForm} / ${t.target}${t.need ? ' ⚠️' : ''} | ${t.multi} | ${t.uncovered} / ${t.bullets} |`),
      '',
      `Câu nhiều đáp án: ${g.multi.count} (${pctOf(g.multi.share)} %, mục tiêu ${pctOf(g.multi.target[0])}–${pctOf(g.multi.target[1])} %) · "Choose/Select THREE": ${g.chooseThree} · ` +
        `${g.needLong} mục còn thiếu câu dài · ${g.guessed} câu có \`skills\` chỉ là đoán theo từ khoá (ENRICH \`classify\` ghi chính thức).`,
      '',
      `**Mục chưa có câu nào (${g.uncovered.length}):**`,
      '',
      ...(g.uncovered.length ? g.uncovered.map((b) => `- \`${b.id}\` ${b.text.length > 140 ? `${b.text.slice(0, 139)}…` : b.text}`) : ['- —']),
      '',
      'Sinh câu nhắm đúng mục: `npm run coach -- --generate --skills <id,…> --count 6` (hoặc `--longform --skills …` cho câu dài), hoặc nút "✨ Sinh cho ô trống" ở 🗺️ Đề cương.',
    );
  }
  out.push('', ...tierMarkdown(c.tiers), '', ...legacyMarkdown(c.legacy));
  return out.join('\n') + '\n';
}

const pct100 = (x: number) => Math.round(x * 1000) / 10;

/** [v6] Section 6: tiers vs the tier-A target. */
export function tierMarkdown(t: TierCoverage): string[] {
  const [lo, hi] = t.multiA.target;
  const share = t.multiA.share;
  const flag = !t.counts.A ? '' : share < lo ? ' ⚠️ dưới mục tiêu' : share > hi ? ' ⚠️ trên mục tiêu' : '';
  return [
    '## 6. Tầng câu (A / B / C) so với mục tiêu',
    '',
    'Tầng A = giống đề thật (đề dài, phương án là câu đầy đủ, có tiêu chí quyết định) · B = tình huống ngắn · C = câu ôn nhanh (SCHEMA §6b).',
    `Tính trên ${t.pool} câu active trong phạm vi đề (gồm cả câu đang niêm phong). Mục tiêu ${t.target} câu tầng A: chia theo trọng số domain, ` +
      'rồi theo số mục đề cương (Knowledge + Skills) của từng task.',
    '',
    `**Tổng:** tầng A ${t.counts.A} / ${t.target} (${t.need ? `thiếu ${t.need}` : 'đủ'}) · B ${t.counts.B} · C ${t.counts.C} · ` +
      `nhiều đáp án trong tầng A: ${t.multiA.count} (${pct100(share)} %, mục tiêu ${pct100(lo)}–${pct100(hi)} %)${flag}`,
    '',
    '| Domain | Mục tiêu A | A | Thiếu | B | C | Nhiều đáp án (A) |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...t.domains.map((d) => `| ${d.code} ${d.label} (${d.weight}%) | ${d.target} | ${d.A} | ${d.need} | ${d.B} | ${d.C} | ${d.multiA} |`),
    '',
    '| Task | Mục đề cương | Mục tiêu A | A | Thiếu | B | C | Nhiều đáp án (A) |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...t.tasks.map((x) => `| ${x.id} ${x.label} | ${x.bullets} | ${x.target} | ${x.A} | ${x.need}${x.need && x.A < x.target / 2 ? ' ⚠️' : ''} | ${x.B} | ${x.C} | ${x.multiA} |`),
    ...(t.noTaskA ? ['', `(${t.noTaskA} câu tầng A chưa gắn task — chỉ tính ở domain.)`] : []),
    '',
    'Thiếu tầng A: sinh câu chuẩn đề (`npm run coach -- --generate --skills <id,…>`) hoặc nâng câu ngắn sẵn có (`npm run coach -- --longform --skills <id,…>`).',
  ];
}

/** [v6] Section 7: services marked `scope: legacy`. */
export function legacyMarkdown(l: LegacyCoverage): string[] {
  const out = ['## 7. Dịch vụ bị gỡ khỏi phạm vi đề (legacy)', ''];
  if (!l.services.length) return [...out, 'Không có service nào `scope: legacy` trong taxonomy.'];
  out.push(
    'Service `scope: legacy` trong taxonomy: bị gỡ khỏi danh sách in-scope chính thức của SAA-C03 hoặc đã ngừng mà không có kế nhiệm trong phạm vi — ' +
      'app coi như `scope: out` (câu có đáp án nêu chúng bị loại khỏi luyện, thi thử và đề niêm phong).',
    '',
    `${l.key} câu có đáp án nêu dịch vụ legacy · ${l.distractor} câu chỉ nêu ở phương án nhiễu · ${l.anywhere} câu nhắc tới (đề, phương án, giải thích).`,
    '',
    '| Dịch vụ | Đáp án | Chỉ phương án nhiễu | Nhắc tới | Câu có đáp án legacy |',
    '|---|---:|---:|---:|---|',
    ...l.services.map((s) => `| ${s.name} | ${s.key} | ${s.distractor} | ${s.anywhere} | ${s.ids.map((id) => `\`${id}\``).join(', ')}${s.key > s.ids.length ? ' …' : ''} |`),
    '',
    'Xử lý: đáp án legacy → retire hoặc viết lại cho dịch vụ trong phạm vi; chỉ phương án nhiễu → ENRICH `--tasks distractors` thay phương án.',
  );
  if (l.sealedHidden) out.push('', `(${l.sealedHidden} câu đang niêm phong không được liệt kê.)`);
  return out;
}
