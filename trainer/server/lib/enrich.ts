// ENRICH routine helpers: which questions still need maintenance (explanation, hint, classification,
// option-length balance, weak distractors), the batch file handed to the AI (coach/enrich/<runId>-batch.md), long-form
// targets (short questions the learner meets/misses often) and the progress counters for the UI.
// [γ] B9: the "upcoming" tier — questions the learner is about to meet (next plan sessions, reviews due by tomorrow, the
// next never-seen questions in mode 'new' order) — is enriched first, so the first encounter already has a full
// explanation. Sealed questions are never long-form originals (nothing may leak through a variant).
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, ENRICH_DIR, PATCHES_DIR, REPO_DIR, RUNS_DIR, type AppConfig } from '../config.ts';
import type { BankState } from './bank.ts';
import { correctIsLongest } from './patch.ts';
import { DAY_MS, localIso } from './time.ts';
import { reviewQueue } from './stats.ts';
import { sealedIds } from './sealed.ts';
import { newOrder } from '../../shared/filters.ts';
import { countWords } from '../../shared/timing.ts';
import type { OptionStats } from './quality.ts';
import type { Attempt, CoachRunInfo, DistractorReport, EnrichStatus, Plan, Question, QuestionState, VerifyVerdict } from '../../shared/types.ts';

export type EnrichTodo = 'explain' | 'hint' | 'classify' | 'balance' | 'distractors';
/** Default work of a batch (pending per question). `distractors` runs only when asked for (data-driven, see distractorReport). */
export const ENRICH_TODOS: readonly EnrichTodo[] = ['explain', 'hint', 'classify', 'balance'];
export const ALL_TODOS: readonly EnrichTodo[] = [...ENRICH_TODOS, 'distractors'];
export const MIN_EXPLANATION_WORDS = 25;
export const MAX_BATCH = 60;
export const MAX_LONGFORM = 20;

const TODO_LABEL: Record<EnrichTodo, string> = {
  explain: 'explain — viết lại giải thích (EN + từng distractor theo nội dung + 🇻🇳)',
  hint: 'hint — 1 dòng gợi ý tiếng Việt, không lộ đáp án',
  classify: 'classify — domain + task + services/tags + concept',
  balance: 'balance — đáp án đúng dài hơn mọi distractor ≥ 15 %: viết lại distractor cho cân',
  distractors: 'distractors — phương án nhiễu quá dễ loại (số liệu 📊 ở từng câu): viết lại cho hợp lý, giữ đáp án và ý của câu',
};

/** Work still pending for one question (ENRICH.md). */
export function pendingTodos(q: Question): Exclude<EnrichTodo, 'distractors'>[] {
  const out: Exclude<EnrichTodo, 'distractors'>[] = [];
  if (!q.enriched || countWords(q.explanation) < MIN_EXPLANATION_WORDS) out.push('explain');
  if (!q.hint) out.push('hint');
  if (!q.enriched) out.push('classify');
  if (correctIsLongest(q.options, q.answer)) out.push('balance');
  return out;
}

/**
 * `tasks` may mix todo kinds ("explain,hint", "distractors") and exam-guide task ids ("2.2") to narrow the batch.
 * `explicit` = todo kinds were named (otherwise the four default kinds).
 */
export function parseTasks(tasks: unknown): { todos: EnrichTodo[]; examTasks: string[]; explicit: boolean } {
  const list = (Array.isArray(tasks) ? tasks.map(String) : typeof tasks === 'string' ? tasks.split(',') : []).map((t) => t.trim().toLowerCase()).filter(Boolean);
  const todos = [...new Set(list.filter((t): t is EnrichTodo => (ALL_TODOS as readonly string[]).includes(t)))];
  const examTasks = list.filter((t) => /^[1-4]\.[1-9]$/.test(t));
  return { todos: todos.length ? todos : [...ENRICH_TODOS], examTasks, explicit: todos.length > 0 };
}

/** Explicit question ids from params (array or comma list), trimmed, unique, at most MAX_BATCH. */
export function idList(v: unknown): string[] {
  const list = Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(',') : [];
  return [...new Set(list.map((x) => x.trim()).filter(Boolean))].slice(0, MAX_BATCH);
}

const clampInt = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, n)) : dflt;
};

export interface BatchItem {
  q: Question;
  todo: EnrichTodo[];
  tier: 'upcoming' | 'wrong' | 'seen' | 'unseen';
  state?: QuestionState;
}

const TIER_RANK = { upcoming: -1, wrong: 0, seen: 1, unseen: 2 } as const;

function domainWeight(bank: BankState, q: Question): number {
  return bank.taxonomy.domains.find((d) => d.id === q.domain)?.weight ?? 0;
}

const tierOf = (s: QuestionState | undefined): BatchItem['tier'] => (s?.everWrong ? 'wrong' : s && s.attempts > 0 ? 'seen' : 'unseen');

export interface UpcomingInput {
  bank: BankState;
  states: Map<string, QuestionState>;
  attempts: Attempt[];
  plans: Plan[]; // newest first (loadPlans)
  cfg: AppConfig;
  now?: number;
  sealed?: ReadonlySet<string>; // default: the current sealed forms
  newCount?: number; // next never-seen questions to include (default practice.default_count)
}

/**
 * Questions the learner is about to meet, soonest first: the questions of the newest plan's sessions not done yet, the
 * reviews due by tomorrow (reviewQueue with now = tomorrow, daily cap applied), then the next never-seen questions in
 * mode 'new' order (newOrder). Active only; sealed questions — and out-of-scope ones when practice.exclude_out_of_scope —
 * are left out, as the practice modes do.
 */
export function upcomingIds(input: UpcomingInput): string[] {
  const { bank, states, attempts, cfg } = input;
  const sealed = input.sealed ?? sealedIds();
  const dropOos = cfg.practice?.exclude_out_of_scope !== false;
  const pool = bank.questions.filter((q) => q.status === 'active' && !sealed.has(q.id) && !(dropOos && q.outOfScope));
  const inPool = new Set(pool.map((q) => q.id));
  const out: string[] = [];
  const add = (id: string) => {
    if (inPool.has(id) && !out.includes(id)) out.push(id);
  };
  for (const s of input.plans[0]?.sessions ?? []) if (!s.done?.length) for (const id of s.questions ?? []) add(id);
  const now = input.now ?? Date.now();
  for (const q of reviewQueue(pool, states, attempts, cfg, now + DAY_MS).today) add(q.id);
  const unseen = pool.filter((q) => !states.get(q.id)?.attempts);
  for (const q of newOrder(unseen, bank.taxonomy.domains).slice(0, Math.max(0, input.newCount ?? cfg.practice?.default_count ?? 20))) add(q.id);
  return out;
}

/**
 * Picks the next ENRICH batch: non-retired questions with pending work, ordered by learner relevance (about to be met >
 * answered wrong before > seen > unseen), then exam weight of the domain, then how often they were missed; ties stay
 * grouped by topic so one batch shares notes. Upcoming questions keep their `upcoming` order (soonest first).
 * - `upcoming`: upcomingIds() — their tier is 'upcoming'; `onlyUpcoming` keeps nothing else (coach.enrich_after_analyze).
 * - `ids`: explicit questions, in that order, bypassing the scoring — todo = the requested kinds (all of them),
 *   or each question's pending work (`explain` when nothing is pending: a re-check was asked for).
 * - `distractors` without ids: questions whose weak distractors `report` (distractorReport) lists, most struck first.
 */
export function selectBatch(
  bank: BankState,
  states: Map<string, QuestionState>,
  opts: { size?: number; tasks?: unknown; ids?: string[]; report?: DistractorReport; upcoming?: string[]; onlyUpcoming?: boolean } = {},
): BatchItem[] {
  const { todos, examTasks, explicit } = parseTasks(opts.tasks);
  const size = clampInt(opts.size, 1, MAX_BATCH, 20);
  const soon = new Map((opts.upcoming ?? []).map((id, i) => [id, i] as const)); // qid → position in the upcoming list
  const tier = (q: Question, s: QuestionState | undefined): BatchItem['tier'] => (soon.has(q.id) ? 'upcoming' : tierOf(s));
  if (opts.ids?.length) {
    return opts.ids
      .map((id) => bank.byId.get(id))
      .filter((q): q is Question => !!q && q.status !== 'retired')
      .slice(0, MAX_BATCH)
      .map((q) => {
        const pending = pendingTodos(q);
        const todo = explicit ? todos : pending.length ? pending : (['explain'] as EnrichTodo[]);
        return { q, todo, tier: tier(q, states.get(q.id)), state: states.get(q.id) };
      });
  }
  const weak = new Map<string, number>(); // qid → strike-outs of its weak distractors
  if (todos.includes('distractors')) for (const w of opts.report?.weakDistractors ?? []) weak.set(w.id, (weak.get(w.id) ?? 0) + w.elims);
  const items: BatchItem[] = [];
  for (const q of bank.questions) {
    if (q.status === 'retired') continue;
    if (opts.onlyUpcoming && !soon.has(q.id)) continue;
    if (examTasks.length && !examTasks.includes(q.task ?? '')) continue;
    const todo = [...pendingTodos(q), ...(weak.has(q.id) ? (['distractors'] as EnrichTodo[]) : [])].filter((t) => todos.includes(t));
    if (!todo.length) continue;
    const s = states.get(q.id);
    items.push({ q, todo, tier: tier(q, s), state: s });
  }
  if (weak.size) {
    // a distractor batch: the questions the learner rules out most easily first
    items.sort((a, b) => (weak.get(b.q.id) ?? -1) - (weak.get(a.q.id) ?? -1) || a.q.id.localeCompare(b.q.id, 'en', { numeric: true }));
    return items.filter((i) => i.todo.includes('distractors')).slice(0, size);
  }
  const wrong = (s?: QuestionState) => (s ? s.attempts - s.correct : 0);
  items.sort(
    (a, b) =>
      TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
      (soon.get(a.q.id) ?? 0) - (soon.get(b.q.id) ?? 0) || // upcoming: soonest first
      domainWeight(bank, b.q) - domainWeight(bank, a.q) ||
      wrong(b.state) - wrong(a.state) ||
      (b.state?.attempts ?? 0) - (a.state?.attempts ?? 0) ||
      a.q.topic.localeCompare(b.q.topic) ||
      a.q.id.localeCompare(b.q.id, 'en', { numeric: true }),
  );
  return items.slice(0, size);
}

// ── long-form targets ───────────────────────────────────────────────────────

export interface LongformTarget {
  q: Question;
  state?: QuestionState;
  variants: string[]; // existing variant ids
  score: number;
}

/**
 * Short questions worth an exam-length variant: met/missed often, high exam weight, and no long-form
 * variant yet (max 3 variants per original, SCHEMA §5). At most 2 per topic unless the pool runs dry.
 * Never a sealed question (a variant would leak it) nor an out-of-scope one (the exam does not ask it).
 */
export function longformTargets(bank: BankState, states: Map<string, QuestionState>, count = 5, sealed: ReadonlySet<string> = sealedIds()): LongformTarget[] {
  const n = clampInt(count, 1, MAX_LONGFORM, 5);
  const variants = new Map<string, Question[]>();
  for (const v of bank.questions) for (const o of v.variantOf) variants.set(o, [...(variants.get(o) ?? []), v]);
  const pool: LongformTarget[] = [];
  for (const q of bank.questions) {
    if (q.status !== 'active' || q.longForm || q.outOfScope || sealed.has(q.id)) continue;
    const vs = variants.get(q.id) ?? [];
    if (vs.length >= 3 || vs.some((v) => v.longForm)) continue;
    const s = states.get(q.id);
    const wrong = s ? s.attempts - s.correct : 0;
    const usage = (s?.attempts ?? 0) + wrong * 3 + (s?.lastOk === false ? 2 : 0) + (s?.lastUnsure ? 1 : 0);
    const diff = q.difficulty === 'hard' ? 1.1 : q.difficulty === 'easy' ? 0.85 : 1;
    pool.push({ q, state: s, variants: vs.map((v) => v.id), score: Math.round((usage + 0.5) * (domainWeight(bank, q) / 30) * diff * 1000) / 1000 });
  }
  pool.sort((a, b) => b.score - a.score || a.q.id.localeCompare(b.q.id, 'en', { numeric: true }));
  const picked: LongformTarget[] = [];
  const perTopic = new Map<string, number>();
  for (const t of pool) {
    if (picked.length >= n) break;
    if ((perTopic.get(t.q.topic) ?? 0) >= 2) continue;
    picked.push(t);
    perTopic.set(t.q.topic, (perTopic.get(t.q.topic) ?? 0) + 1);
  }
  for (const t of pool) {
    if (picked.length >= n) break;
    if (!picked.includes(t)) picked.push(t);
  }
  return picked;
}

// ── status ──────────────────────────────────────────────────────────────────

// Run records are read on every AI Coach request: keep them parsed, keyed by the directory mtime (the runner saves a
// record with a rename, so every write bumps it) — records of runs still marked running are re-checked by file mtime.
const runFiles = new Map<string, { mtimeMs: number; info?: CoachRunInfo }>();
let runList: { dir: string; mtimeMs: number; list: CoachRunInfo[] } | undefined;

function readRunFile(file: string): CoachRunInfo | undefined {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8')) as CoachRunInfo;
    return j && typeof j.id === 'string' && typeof j.startedAt === 'string' ? j : undefined;
  } catch {
    return undefined; // partial write or foreign file
  }
}

/** Run records in coach/runs/*.json, newest first (cached; do not mutate). */
export function readRunInfos(limit = Infinity): CoachRunInfo[] {
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(RUNS_DIR).mtimeMs;
  } catch {
    return [];
  }
  const live = runList?.list.some((r) => r.status === 'running');
  if (!runList || runList.dir !== RUNS_DIR || runList.mtimeMs !== mtimeMs || live) {
    const names = fs
      .readdirSync(RUNS_DIR)
      .filter((x) => x.endsWith('.json'))
      .sort()
      .reverse();
    const list: CoachRunInfo[] = [];
    for (const name of names) {
      const file = path.join(RUNS_DIR, name);
      let entry = runFiles.get(file);
      if (!entry || !entry.info || entry.info.status === 'running') {
        let m = 0;
        try {
          m = fs.statSync(file).mtimeMs;
        } catch {
          continue;
        }
        if (!entry || entry.mtimeMs !== m) runFiles.set(file, (entry = { mtimeMs: m, info: readRunFile(file) }));
      }
      if (entry.info) list.push(entry.info);
    }
    const keep = new Set(names.map((n) => path.join(RUNS_DIR, n)));
    for (const f of runFiles.keys()) if (!keep.has(f)) runFiles.delete(f);
    runList = { dir: RUNS_DIR, mtimeMs, list };
  }
  return Number.isFinite(limit) ? runList.list.slice(0, limit) : runList.list;
}

export function enrichStatus(bank: BankState, runs: CoachRunInfo[] = readRunInfos(200), sealed: ReadonlySet<string> = sealedIds()): EnrichStatus & { longFormCandidates: number } {
  const qs = bank.questions.filter((q) => q.status !== 'retired');
  const pending = { explain: 0, hint: 0, classify: 0, balance: 0 };
  for (const q of qs) for (const t of pendingTodos(q)) pending[t]++;
  const variants = new Map<string, Question[]>();
  for (const v of bank.questions) for (const o of v.variantOf) variants.set(o, [...(variants.get(o) ?? []), v]);
  const longFormCandidates = qs.filter((q) => q.status === 'active' && !q.longForm && !q.outOfScope && !sealed.has(q.id) && !(variants.get(q.id) ?? []).some((v) => v.longForm)).length;
  return {
    total: qs.length,
    enriched: qs.filter((q) => q.enriched).length,
    pending,
    longForm: qs.filter((q) => q.longForm).length,
    lastRun: runs.find((r) => r.task === 'enrich' || r.task === 'longform'),
    longFormCandidates,
  };
}

// ── batch files ─────────────────────────────────────────────────────────────

/** Path as the AI sees it (cwd = repo root), forward slashes; absolute when outside the repo (TRAINER_HOME copies). */
export function repoRel(abs: string): string {
  const r = path.relative(REPO_DIR, abs);
  return (r.startsWith('..') || path.isAbsolute(r) ? abs : r).split(path.sep).join('/');
}

export function batchPath(runId: string): string {
  return path.join(ENRICH_DIR, `${runId}-batch.md`);
}

export function patchPath(runId: string): string {
  return path.join(PATCHES_DIR, `${runId}.yaml`);
}

function notesFor(bank: BankState, q: Question): string[] {
  const topic = bank.taxonomy.topics.find((t) => t.id === q.topic)?.notes ?? [];
  return [...new Set([...q.refs.map((r) => r.split('#')[0]), ...topic])].filter(Boolean);
}

function learnerLine(s: QuestionState | undefined): string {
  if (!s || !s.attempts) return 'chưa làm';
  const picks = Object.entries(s.wrongPicks ?? {})
    .map(([k, n]) => `${k}×${n}`)
    .join(', ');
  return `sai ${s.attempts - s.correct}/${s.attempts} lượt${picks ? ` · đã chọn sai: ${picks}` : ''}${s.lastOk === false ? ' · lần gần nhất sai' : ''}`;
}

function questionSection(bank: BankState, q: Question, opts: { n: number; title: string; lengths: boolean; state?: QuestionState; extra?: string[] }): string[] {
  const o: string[] = [];
  const v = (x: string | undefined) => (x ? `\`${x}\`` : '—');
  o.push('---', '', `## ${opts.n}. \`${q.id}\` — ${opts.title}`, '');
  o.push(`- base: \`${q.hash}\` · file: \`${fileForAi(q)}\` (dòng ${q.line})`);
  o.push(
    `- hiện tại: domain ${v(q.domain)} · task ${v(q.task)} · topic ${v(q.topic)} · difficulty ${v(q.difficulty)} · time ${q.time}s · services ${q.services.length ? q.services.map((s) => `\`${s}\``).join(', ') : '—'} · tags ${q.tags.length ? q.tags.map((s) => `\`${s}\``).join(', ') : '—'}`,
  );
  o.push(`- concept: ${q.concept ?? '—'} · hint: ${q.hint ?? '—'} · enriched: ${q.enriched ?? '—'}${q.variantOf.length ? ` · variant_of: ${q.variantOf.join(', ')}` : ''}`);
  o.push(`- người học: ${learnerLine(opts.state)} · notes: ${notesFor(bank, q).map((n) => `\`${n}\``).join(', ') || '—'}`);
  for (const e of opts.extra ?? []) o.push(`- ${e}`);
  o.push('', `**Stem** (${q.words} từ):`, '', q.stem.trim(), '', `**Options**${opts.lengths ? ' (số ký tự)' : ''}:`, '');
  for (const opt of q.options) {
    const ok = q.answer.includes(opt.key);
    o.push(`- ${opt.key}. ${opt.text}${opts.lengths ? `  ⟨${opt.text.length}⟩` : ''}${ok ? '  ✅' : ''}`);
  }
  o.push('', `**Answer:** ${q.answer.join(', ')}`, '', `**Explanation hiện tại** (${countWords(q.explanation)} từ):`, '', q.explanation.trim() || '_(trống)_', '');
  return o;
}

/** Latest "vì sao bạn chọn?" notes per question (newest first, ≤ `max` each) — explanations should answer them. */
export function learnerNotes(attempts: Attempt[], ids: Iterable<string>, max = 2): Map<string, string[]> {
  const want = new Set(ids);
  const out = new Map<string, string[]>();
  for (let i = attempts.length - 1; i >= 0; i--) {
    for (const r of attempts[i].answers) {
      if (!r.why || !want.has(r.q)) continue;
      const list = out.get(r.q) ?? [];
      if (list.length >= max) continue;
      list.push(`đã chọn ${r.pick || '—'} (đúng: ${r.key}): “${r.why.replace(/\s+/g, ' ').trim().slice(0, 300)}”`);
      out.set(r.q, list);
    }
  }
  return out;
}

/** Path of the question's pack relative to the repo root (what the AI opens). */
export function fileForAi(q: Question): string {
  return repoRel(path.join(DATA_DIR, q.file));
}

function taskTable(bank: BankState): string[] {
  return bank.taxonomy.tasks.map((t) => `- \`${t.id}\` (${t.domain}) ${t.label} — ${t.label_vi}`);
}

/**
 * 📊 lines for the `distractors` todo: per-option picks / strike-outs on the current version of the question
 * (quality.ts optionStats), the weak distractors and confidently repeated wrong picks (distractorReport).
 */
export function distractorLines(q: Question, report: DistractorReport | undefined, stats?: OptionStats): string[] {
  const out: string[] = [];
  if (stats?.exposures) {
    const per = q.options
      .filter((o) => !q.answer.includes(o.key))
      .map((o) => `${o.key} chọn ${stats.options[o.key]?.picks ?? 0} · gạch ${stats.options[o.key]?.elims ?? 0}`)
      .join('; ');
    out.push(`📊 ${stats.exposures} lượt trả lời phiên bản hiện tại (đúng ${stats.correct}) — phương án nhiễu: ${per}`);
  }
  const weak = report?.weakDistractors.filter((w) => w.id === q.id) ?? [];
  if (weak.length) {
    const opt = (k: string) => q.options.find((o) => o.key === k)?.text ?? '?';
    out.push(
      `📊 phương án nhiễu yếu (chưa ai chọn, hay bị gạch): ${weak.map((w) => `${w.key} “${opt(w.key).slice(0, 60)}” — gặp ${w.exposures} lần, bị gạch ${w.elims} lần`).join('; ')} → viết lại cho hợp lý (service/tính năng thật, cùng “dáng” và độ dài với đáp án đúng)`,
    );
  }
  for (const s of report?.suspectedKeys.filter((x) => x.id === q.id) ?? []) {
    out.push(`⚠️ người học chọn ${s.pick} ${s.times} lần (${s.confident} lần chắc chắn) dù đáp án là ${s.key}${s.note ? ` — ${s.note}` : ''} → kiểm tra lại đáp án (đổi chỉ khi chắc chắn, kèm reason)`);
  }
  if (!out.length) out.push('📊 chưa đủ dữ liệu làm bài — viết lại các phương án nhiễu dễ loại nhất (service/tính năng có thật, cùng “dáng” và độ dài với đáp án đúng)');
  return out;
}

/** 🧪 line when the blind-solve model disagreed with the key (latestVerdicts of verify.ts). */
export function verdictLines(q: Question, verdicts: Record<string, VerifyVerdict> | undefined): string[] {
  const v = verdicts?.[q.id];
  if (!v || v.hash !== q.hash || v.decision === 'approved' || (v.outcome !== 'mismatch' && v.outcome !== 'ambiguous')) return [];
  const what = v.outcome === 'ambiguous' ? `cho là câu MƠ HỒ (chọn ${v.picked ?? '—'})` : `chọn ${v.picked ?? '—'} thay vì ${v.key ?? q.answer.join('')}`;
  return [`🧪 model giải mù (${v.model ?? '?'}, tin cậy ${v.confidence ?? '?'}) ${what}: “${v.reason ?? ''}” → kiểm tra đề/đáp án; sửa đề cho rõ, đổi đáp án (kèm reason) hoặc giữ nguyên nếu model sai`];
}

/**
 * Writes coach/enrich/<runId>-batch.md for an ENRICH batch; returns the absolute path. `mode: 'json'` = the app runs the
 * batch with structured output (the AI answers in JSON, the app writes the patch); 'files' = the AI writes the patch.
 */
export function writeBatchFile(
  runId: string,
  items: BatchItem[],
  bank: BankState,
  opts: {
    todos?: EnrichTodo[];
    notes?: Map<string, string[]>;
    report?: DistractorReport;
    stats?: Map<string, OptionStats>;
    verdicts?: Record<string, VerifyVerdict>;
    mode?: 'json' | 'files';
    note?: string; // the learner's instruction for this batch
  } = {},
): string {
  const todos = opts.todos ?? [...ENRICH_TODOS];
  const json = opts.mode === 'json';
  const file = batchPath(runId);
  const patch = repoRel(patchPath(runId));
  const o: string[] = [
    '---',
    'kind: enrich-batch',
    `run_id: ${runId}`,
    `created: ${localIso()}`,
    `size: ${items.length}`,
    `todo: [${todos.join(', ')}]`,
    `patch: ${patch}`,
    `mode: ${json ? 'json' : 'files'}`,
    '---',
    '',
    `# 🧰 Lô ENRICH \`${runId}\` — ${items.length} câu`,
    '',
    '> File tự sinh bởi trainer app — đầu vào cho phần **A** của `trainer/coach/ENRICH.md` (đọc file đó trước).',
    ...(json
      ? [
          '> **Chế độ app (JSON):** trả kết quả bằng JSON (`items`: mỗi câu bên dưới đúng **một** item, khoá như patch SCHEMA §8;',
          `> \`base\` do app tự điền). Không ghi file, không chạy lệnh — app ghi \`${patch}\`, kiểm tra từng item và báo lỗi để bạn sửa một lần.`,
        ]
      : [
          `> Viết patch vào \`${patch}\` (khung ở cuối file này), rồi chạy \`node trainer/scripts/apply-patch.ts ${patch}\``,
          '> và sửa/chạy lại đến khi không còn ❌. Mỗi câu bên dưới phải có đúng **một** item trong patch.',
        ]),
    '',
    '**Todo:**',
    ...todos.map((t) => `- ${TODO_LABEL[t]}`),
    '',
    ...(opts.note ? [`**Ghi chú của người học cho lô này:** ${opts.note}`, ''] : []),
    '**Task statements (exam guide) — `task` phải cùng domain:**',
    ...taskTable(bank),
    '',
  ];
  items.forEach((it, i) => {
    const why = (opts.notes?.get(it.q.id) ?? []).map((w) => `🗣️ người học ${w} → giải thích phải gỡ đúng hiểu lầm này`);
    const extra = [...why, ...(it.todo.includes('distractors') ? distractorLines(it.q, opts.report, opts.stats?.get(it.q.id)) : []), ...verdictLines(it.q, opts.verdicts)];
    const title = `todo: ${it.todo.join(' · ')}${it.tier === 'upcoming' ? ' · ⏭ người học sắp gặp câu này' : ''}`;
    o.push(...questionSection(bank, it.q, { n: i + 1, title, lengths: it.todo.includes('balance') || it.todo.includes('distractors'), state: it.state, extra }));
  });
  if (!json) {
    o.push('---', '', '## Khung patch', '', '```yaml', `run_id: ${runId}`, 'items:');
    for (const it of items) {
      // quoted: YAML reads an unquoted hash such as 46794516e3 or 9e114 as a number
      o.push(`  - id: "${it.q.id}"        # ${it.todo.join(', ')}`, `    base: "${it.q.hash}"`);
    }
    o.push('```', '');
  } else {
    o.push('---', '', `**Id cần trả về (${items.length}):** ${items.map((it) => `\`${it.q.id}\``).join(', ')}`, '');
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, o.join('\n'));
  return file;
}

export interface LongformPlan {
  count: number;
  packFile: string; // repo-relative, contains <slug>
  packId: string;
  idPrefix: string; // question ids: <idPrefix><nn>
}

/** Writes coach/enrich/<runId>-batch.md listing long-form targets; returns the absolute path. */
export function writeLongformFile(runId: string, targets: LongformTarget[], bank: BankState, plan: LongformPlan): string {
  const file = batchPath(runId);
  const minWords = bank.taxonomy.timing.long_form_min_words ?? 55;
  const o: string[] = [
    '---',
    'kind: longform-batch',
    `run_id: ${runId}`,
    `created: ${localIso()}`,
    `count: ${plan.count}`,
    `pack_file: ${plan.packFile}`,
    `pack_id: ${plan.packId}`,
    `id_prefix: ${plan.idPrefix}`,
    '---',
    '',
    `# 📏 Câu dài chuẩn đề thi \`${runId}\` — ${plan.count} câu`,
    '',
    '> File tự sinh bởi trainer app — đầu vào cho phần **B** của `trainer/coach/ENRICH.md` (đọc file đó trước).',
    `> Viết **${plan.count}** câu mới (mỗi câu là biến thể dài của một câu gốc bên dưới, \`variant_of: <id gốc>\`) vào pack mới`,
    `> \`${plan.packFile}\` (thay \`<slug>\` bằng 2–4 từ kebab-case), pack id \`${plan.packId}\`, id câu \`${plan.idPrefix}01\`, \`${plan.idPrefix}02\`, …`,
    `> Stem 60–120 từ (≥ ${minWords} từ mới được tính là câu dài). Sau đó chạy \`node trainer/scripts/validate.ts ${plan.packFile.replace(/^trainer\//, '').replace(/^bank\//, '')} --fill-time\`.`,
    '',
    '**Task statements (exam guide):**',
    ...taskTable(bank),
    '',
  ];
  targets.forEach((t, i) => {
    o.push(
      ...questionSection(bank, t.q, {
        n: i + 1,
        title: `câu gốc (điểm ưu tiên ${t.score})`,
        lengths: false,
        state: t.state,
        extra: [`biến thể đã có: ${t.variants.length ? t.variants.join(', ') : 'chưa có'} (tối đa 3)`],
      }),
    );
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, o.join('\n'));
  return file;
}
