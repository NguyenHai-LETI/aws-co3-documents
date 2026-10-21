// Bank coverage vs the SAA-C03 exam guide (for /trainer-coverage): share of each domain vs its exam
// weight, questions per task statement, taxonomy services without (or with few) questions, and questions
// whose qualifier points at another domain — likely misclassified; ENRICH `classify` re-checks those
// (scripts/enrich-batch.ts --ids). Counts use active questions only.
import type { BankState } from './bank.ts';
import { localDateKey } from './time.ts';
import type { DomainId, Question } from '../../shared/types.ts';

/** A task is "thin" below this share of its expected count (bank total × domain weight ÷ tasks of the domain). */
export const THIN_TASK_RATIO = 0.5;
const THIN_SERVICE = 2;
const MAX_MISFITS = 60;

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

export function computeCoverage(bank: BankState, today: string = localDateKey(new Date())): Coverage {
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

  const misfits = active.map(misfit).filter((m): m is Misfit => !!m);
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
  return out.join('\n') + '\n';
}
