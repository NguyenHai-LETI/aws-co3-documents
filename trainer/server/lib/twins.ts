// [v5] γ2 — anti-rote AI content (6-01, 3-01, 4-03, 5-03): which questions get a "twin" and what the `twins` / `family`
// tasks read (coach/enrich/<runId>-batch.md).
// Twins = siblings written by AI with `variant_of` = the original:
//   surface   same concept and requirement, other context / industry / numbers / wording (memorised wording stops helping)
//   contrast  one requirement changes so that a former distractor becomes right (the learner must re-read the scenario)
// Targets (when no ids are given): active practice questions due for review within TWIN_HORIZON_DAYS (or overdue) that the
// learner answered ≥ 2 times and whose sibling cluster (clusters.ts) has no member they have not met yet — sibling
// substitution (select.ts) then gets an unseen question to serve. Explicit `ids` (+ `kind`, e.g. the leech clinic's
// "✨ câu tương phản") bypass the scoring. Never a sealed question (a twin would leak it), out-of-scope, retired or draft,
// nor an original that already has 3 variants (SCHEMA §5).
// Families = one long scenario + one shared option set + 2–4 final questions asking for different requirements (cost,
// ops, resilient, performance, secure) with different keys (`family: <id>`, qualifier mode, lint family-options).
import fs from 'node:fs';
import path from 'node:path';
import type { BankState } from './bank.ts';
import { clusterIndex, siblingsOf } from './clusters.ts';
import { sealedIds } from './sealed.ts';
import { DAY_MS, localIso } from './time.ts';
import { batchPath, questionSection, taskTable } from './enrich.ts';
import { FAMILY_ASKS, type TwinKind } from './ai-output.ts';
import { REQUIREMENT_INFO } from '../../shared/labels.ts';
import type { Bucket, Question, QuestionState } from '../../shared/types.ts';

export const TWIN_HORIZON_DAYS = 7;
export const MAX_TWINS = 20;
export const MAX_FAMILIES = 5;

export interface TwinTarget {
  q: Question;
  state?: QuestionState;
  kind: TwinKind;
  variants: string[]; // existing variants (variant_of → this question)
  siblings: string[]; // other members of its cluster
  why: string; // Vietnamese, for the batch file
}

const clampInt = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, n)) : dflt;
};

/** A repeated, specific confusion → contrast twin; otherwise a surface paraphrase. */
export function autoKind(s: QuestionState | undefined): TwinKind {
  if (!s) return 'surface';
  if (s.leech || (s.lapses ?? 0) >= 2 || Object.values(s.wrongPicks ?? {}).some((n) => n >= 2)) return 'contrast';
  return 'surface';
}

export interface TwinOptions {
  count?: number;
  ids?: string[];
  kind?: TwinKind;
  now?: number;
  sealed?: ReadonlySet<string>;
  horizonDays?: number;
}

/** Originals for a `twins` run (see the header), soonest due first, then exam weight of the domain, then id. */
export function twinsTargets(bank: BankState, states: Map<string, QuestionState>, opts: TwinOptions = {}): TwinTarget[] {
  const n = clampInt(opts.count, 1, MAX_TWINS, 10);
  const sealed = opts.sealed ?? sealedIds();
  const index = clusterIndex(bank);
  const variants = new Map<string, string[]>();
  for (const v of bank.questions) if (v.status !== 'retired') for (const o of v.variantOf) variants.set(o, [...(variants.get(o) ?? []), v.id]);
  const eligible = (q: Question | undefined): q is Question => !!q && q.status === 'active' && !q.outOfScope && !sealed.has(q.id);
  // [R3] the batch file is synced and read by the AI: never name a sealed sibling / variant there
  const visible = (ids: string[]) => ids.filter((id) => !sealed.has(id));
  const make = (q: Question, kind: TwinKind, why: string): TwinTarget => ({ q, state: states.get(q.id), kind, variants: visible(variants.get(q.id) ?? []), siblings: visible(siblingsOf(index, q.id)), why });
  if (opts.ids?.length) {
    return [...new Set(opts.ids)]
      .map((id) => bank.byId.get(id))
      .filter(eligible)
      .slice(0, MAX_TWINS)
      .map((q) => make(q, opts.kind ?? autoKind(states.get(q.id)), 'bạn chọn câu này'));
  }
  const now = opts.now ?? Date.now();
  const horizon = now + (opts.horizonDays ?? TWIN_HORIZON_DAYS) * DAY_MS;
  const weight = (q: Question) => bank.taxonomy.domains.find((d) => d.id === q.domain)?.weight ?? 0;
  const pool: { t: TwinTarget; due: number }[] = [];
  for (const q of bank.questions) {
    if (!eligible(q)) continue;
    const s = states.get(q.id);
    if (!s || s.attempts < 2 || !s.dueAt) continue;
    const due = Date.parse(s.dueAt);
    if (!Number.isFinite(due) || due > horizon) continue;
    if ((variants.get(q.id) ?? []).length >= 3) continue;
    // a cluster member the learner has not met yet can already stand in for it (sibling substitution)
    const unseen = siblingsOf(index, q.id).some((id) => eligible(bank.byId.get(id)) && !(states.get(id)?.attempts ?? 0));
    if (unseen) continue;
    const kind = autoKind(s);
    const when = due <= now ? 'đã đến hạn ôn' : `đến hạn ôn ${s.dueAt.slice(0, 10)}`;
    pool.push({ t: make(q, kind, `${when} · đã làm ${s.attempts} lần${kind === 'contrast' ? ' · hay nhầm cùng một phương án' : ''}`), due });
  }
  pool.sort((a, b) => a.due - b.due || weight(b.t.q) - weight(a.t.q) || a.t.q.id.localeCompare(b.t.q.id, 'en', { numeric: true }));
  return pool.slice(0, n).map((p) => p.t);
}

export interface BatchPackPlan {
  count: number;
  packFile: string; // repo-relative, contains <slug>
  packId: string;
  idPrefix: string; // question ids <idPrefix><nn>
  familyPrefix?: string; // family ids <familyPrefix><n>
}

const KIND_TEXT: Record<TwinKind, string> = {
  surface: 'surface — DIỄN ĐẠT LẠI: giữ khái niệm, yêu cầu và đáp án đúng (về nội dung); đổi bối cảnh, ngành, số liệu, câu chữ, thứ tự lựa chọn',
  contrast: 'contrast — TƯƠNG PHẢN: đổi MỘT yêu cầu của tình huống để một phương án nhiễu (của câu gốc) trở thành đúng; đáp án đúng phải khác câu gốc',
};

/** coach/enrich/<runId>-batch.md for a twins run; returns the absolute path. */
export function writeTwinsFile(runId: string, targets: TwinTarget[], bank: BankState, plan: BatchPackPlan): string {
  const file = batchPath(runId);
  const o: string[] = [
    '---',
    'kind: twins-batch',
    `run_id: ${runId}`,
    `created: ${localIso()}`,
    `count: ${plan.count}`,
    `pack_file: ${plan.packFile}`,
    `pack_id: ${plan.packId}`,
    `id_prefix: ${plan.idPrefix}`,
    '---',
    '',
    `# 🪞 Câu song sinh \`${runId}\` — ${plan.count} câu`,
    '',
    '> File tự sinh bởi trainer app — đầu vào của `trainer/coach/TWINS.md` (đọc file đó trước).',
    `> Viết **${plan.count}** câu mới, mỗi câu gốc bên dưới đúng MỘT câu song sinh theo loại ghi ở câu đó, \`variant_of: [<id gốc>]\`.`,
    `> Pack mới \`${plan.packFile}\` (thay \`<slug>\`), pack id \`${plan.packId}\`, id câu \`${plan.idPrefix}01\`, \`${plan.idPrefix}02\`, …`,
    '',
    '**Loại câu song sinh:**',
    ...Object.values(KIND_TEXT).map((t) => `- ${t}`),
    '',
    '**Task statements (exam guide):**',
    ...taskTable(bank),
    '',
  ];
  targets.forEach((t, i) => {
    o.push(
      ...questionSection(bank, t.q, {
        n: i + 1,
        title: `câu gốc · loại: **${t.kind}**`,
        lengths: false,
        state: t.state,
        extra: [
          `loại: ${KIND_TEXT[t.kind]}`,
          `vì sao: ${t.why}`,
          `biến thể đã có: ${t.variants.length ? t.variants.join(', ') : 'chưa có'} · câu anh em: ${t.siblings.length ? t.siblings.join(', ') : 'không có'} (đừng chép lại các câu này)`,
        ],
      }),
    );
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, o.join('\n'));
  return file;
}

// ── families ────────────────────────────────────────────────────────────────

export interface FamilyFocus {
  topic?: string;
  task?: string;
  requirement?: string; // one of FAMILY_ASKS
}

/** Validated focus of a family run (params.topic | task | requirement); throws a Vietnamese message on a bad value. */
export function familyFocus(params: Record<string, unknown>, bank: BankState): FamilyFocus {
  const s = (k: string) => (typeof params[k] === 'string' && (params[k] as string).trim() ? (params[k] as string).trim() : undefined);
  const focus: FamilyFocus = { topic: s('topic'), task: s('task'), requirement: s('requirement') };
  if (focus.topic && !bank.taxonomy.topics.some((t) => t.id === focus.topic)) throw new Error(`topic "${focus.topic}" không có trong taxonomy.yaml`);
  if (focus.task && !bank.taxonomy.tasks.some((t) => t.id === focus.task)) throw new Error(`task "${focus.task}" không có (1.1 … 4.4)`);
  if (focus.requirement && !(FAMILY_ASKS as readonly string[]).includes(focus.requirement)) throw new Error(`requirement "${focus.requirement}" không hợp lệ (${FAMILY_ASKS.join(' | ')})`);
  return focus;
}

/** Style examples for a family run: active, non-sealed questions of the focus whose stem names a requirement (long ones first). */
export function familySeeds(bank: BankState, focus: FamilyFocus, sealed: ReadonlySet<string> = sealedIds(), n = 5): Question[] {
  const asks = (q: Question) => (q.requirements ?? []).filter((r) => (FAMILY_ASKS as readonly string[]).includes(r));
  return bank.questions
    .filter((q) => q.status === 'active' && !sealed.has(q.id) && !q.outOfScope && asks(q).length > 0)
    .filter((q) => (!focus.topic || q.topic === focus.topic) && (!focus.task || q.task === focus.task) && (!focus.requirement || asks(q).includes(focus.requirement)))
    .sort((a, b) => Number(b.longForm) - Number(a.longForm) || b.words - a.words || a.id.localeCompare(b.id, 'en', { numeric: true }))
    .slice(0, n);
}

/** coach/enrich/<runId>-batch.md for a family run; returns the absolute path. */
export function writeFamilyFile(runId: string, bank: BankState, plan: BatchPackPlan, focus: FamilyFocus, seeds: Question[], weak: Bucket[] = []): string {
  const file = batchPath(runId);
  const kw = bank.taxonomy.keywords ?? {};
  const focusLines = [
    focus.topic ? `- topic: \`${focus.topic}\` (${bank.taxonomy.topics.find((t) => t.id === focus.topic)?.label ?? ''})` : '',
    focus.task ? `- task: \`${focus.task}\` (${bank.taxonomy.tasks.find((t) => t.id === focus.task)?.label ?? ''})` : '',
    focus.requirement ? `- yêu cầu phải có trong mỗi họ: \`${focus.requirement}\` (${REQUIREMENT_INFO[focus.requirement]?.label ?? ''})` : '',
  ].filter(Boolean);
  const o: string[] = [
    '---',
    'kind: family-batch',
    `run_id: ${runId}`,
    `created: ${localIso()}`,
    `count: ${plan.count}`,
    `pack_file: ${plan.packFile}`,
    `pack_id: ${plan.packId}`,
    `id_prefix: ${plan.idPrefix}`,
    `family_prefix: ${plan.familyPrefix ?? ''}`,
    '---',
    '',
    `# 🎯 Họ câu đổi yêu cầu \`${runId}\` — ${plan.count} họ`,
    '',
    '> File tự sinh bởi trainer app — đầu vào của `trainer/coach/FAMILY.md` (đọc file đó trước).',
    `> Viết **${plan.count}** họ câu: mỗi họ một tình huống + một bộ 4–5 lựa chọn dùng chung + 2–4 câu hỏi cuối khác yêu cầu, khác đáp án.`,
    `> Pack mới \`${plan.packFile}\` (thay \`<slug>\`), pack id \`${plan.packId}\`, id câu \`${plan.idPrefix}01\`…, id họ \`${plan.familyPrefix ?? ''}1\`, \`${plan.familyPrefix ?? ''}2\`, …`,
    '',
    '**Trọng tâm:**',
    ...(focusLines.length ? focusLines : ['- (không chỉ định) — chọn tình huống theo điểm yếu bên dưới và trọng số domain']),
    '',
    '**Yêu cầu (`ask`) và từ khoá nhận diện (taxonomy.yaml → keywords):**',
    ...FAMILY_ASKS.map((a) => `- \`${a}\` ${REQUIREMENT_INFO[a]?.icon ?? ''} ${REQUIREMENT_INFO[a]?.label ?? ''}: ${(kw[a] ?? []).slice(0, 8).join(', ')}`),
    '',
    ...(weak.length
      ? ['**Người học theo loại yêu cầu (độ chính xác):**', ...weak.map((b) => `- ${b.label}: ${b.correct}/${b.attempts} đúng (${b.accuracy}%)${b.verdict === 'below' ? ' · yếu (có bằng chứng)' : ''}`), '']
      : []),
    '**Task statements (exam guide):**',
    ...taskTable(bank),
    '',
    ...(seeds.length ? ['**Ví dụ văn phong trong ngân hàng (KHÔNG chép, không dùng làm câu gốc):**', ...seeds.map((q) => `- \`${q.id}\` (${(q.requirements ?? []).join(', ')}): ${q.stem.replace(/\s+/g, ' ').slice(0, 220)}`), ''] : []),
  ];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, o.join('\n'));
  return file;
}
