// Bank quality metrics (#2, #14): correct-letter distribution, "correct option is the longest", stem/explanation
// length, hints/tasks/enrichment coverage, near-duplicates (lexical + semantic), 👍/👎 ratings, whether practicing a
// variant fixed the original question, item-writing lint (lint.ts), option-level analytics from the learner's answers
// (distractorReport) and blind-solve verdicts (verify.ts). Numbers cover active questions.
// Every part is cached by what it depends on: the bank version (metrics, lint, lexical duplicates), the answers
// (variant effect, distractors), ratings.md / verify.md; semantic duplicates come from a background job (embeddings.ts).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BANK_DIR, loadConfig } from '../config.ts';
import type { BankState } from './bank.ts';
import { aggregateRatings, loadRatings, lowRatedIds, ratingsMtime, type RatingEntry } from './ratings.ts';
import { LINT_RULES, SHORT_EXPLANATION_WORDS, correctIsLongest, lintBank } from './lint.ts';
import { mergeDuplicates, scheduleSemantic, semanticState } from './embeddings.ts';
import { verifySummary } from './verify.ts';
import { countWords } from '../../shared/timing.ts';
import type { AnswerRecord, Attempt, BankQuality, DistractorReport, DuplicatePair, LintSeverity, Question, VerifySummary } from '../../shared/types.ts';

export { correctIsLongest } from './lint.ts'; // one rule for metric, lint, filter (moved to lint.ts)

const DUP_WORDS = 0.8; // Jaccard of significant words (stem + correct option)
const DUP_TRIGRAMS = 0.6; // Jaccard of word trigrams
const MAX_DUPLICATES = 50;
export const MIN_EXPOSURES = 3; // distractor analytics: answers to the current version before an option is judged
const MAX_WEAK = 60;
const MAX_SUSPECTED = 40;
const VERIFY_FILE = path.join(BANK_DIR, 'verify.md');

// ── near-duplicates ─────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  (
    'a an the and or but if then than to of in on at by for with from into onto over under as is are was were be been being ' +
    'it its this that these those which what who whom whose when where how all any each both few more other some such no nor ' +
    'only own same so too very can will just should must would could may might do does did has have had having we you they ' +
    'their them our your i me my he she his her there here also per via use uses using used need needs needed require requires ' +
    'required requirement requirements want wants company companies solution solutions architect aws amazon meet meets best ' +
    'following provide provides option options choose'
  ).split(' '),
);

function tokens(text: string): string[] {
  return text.toLowerCase().replace(/[`*_>#|[\]()"“”'’.,;:!?/\\]+/g, ' ').match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? [];
}

interface Signature {
  id: string;
  words: number[]; // sorted unique ids of significant words
  trigrams: number[]; // sorted unique ids of word trigrams
}

function jaccard(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  let i = 0;
  let j = 0;
  let inter = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      inter++;
      i++;
      j++;
    } else if (a[i] < b[j]) i++;
    else j++;
  }
  return inter / (a.length + b.length - inter);
}

/** Near-duplicate pairs among `questions` (stem + correct option(s)), best first. */
export function findDuplicates(questions: Pick<Question, 'id' | 'stem' | 'options' | 'answer'>[], limit = MAX_DUPLICATES): DuplicatePair[] {
  const dict = new Map<string, number>();
  const idOf = (s: string) => {
    let n = dict.get(s);
    if (n === undefined) dict.set(s, (n = dict.size));
    return n;
  };
  const uniqSorted = (xs: number[]) => [...new Set(xs)].sort((x, y) => x - y);
  const sigs: Signature[] = questions.map((q) => {
    const correct = q.options.filter((o) => q.answer.includes(o.key)).map((o) => o.text).sort().join(' ');
    const all = tokens(`${q.stem} ${correct}`);
    const tri: number[] = [];
    for (let i = 0; i + 2 < all.length; i++) tri.push(idOf(`${all[i]} ${all[i + 1]} ${all[i + 2]}`));
    return { id: q.id, words: uniqSorted(all.filter((w) => !STOPWORDS.has(w)).map((w) => idOf(w))), trigrams: uniqSorted(tri) };
  });
  const pairs: DuplicatePair[] = [];
  for (let x = 0; x < sigs.length; x++) {
    for (let y = x + 1; y < sigs.length; y++) {
      const a = sigs[x];
      const b = sigs[y];
      const wr = Math.min(a.words.length, b.words.length) / Math.max(a.words.length, b.words.length, 1);
      const tr = Math.min(a.trigrams.length, b.trigrams.length) / Math.max(a.trigrams.length, b.trigrams.length, 1);
      const w = wr >= DUP_WORDS ? jaccard(a.words, b.words) : 0; // size ratio bounds the Jaccard index
      const t = tr >= DUP_TRIGRAMS ? jaccard(a.trigrams, b.trigrams) : 0;
      if (w >= DUP_WORDS || t >= DUP_TRIGRAMS) {
        const [p, q] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
        pairs.push({ a: p, b: q, score: Math.round(Math.max(w, t) * 100) / 100, kind: 'lexical' });
      }
    }
  }
  return pairs.sort((p, q) => q.score - p.score || p.a.localeCompare(q.a) || p.b.localeCompare(q.b)).slice(0, limit);
}

/** Lexical pairs among the active questions — depends on the bank only, so it is cached by bank version (not by answers). */
export function lexicalDuplicates(bank: BankState): DuplicatePair[] {
  return cached('lexical', bank.version || undefined, () => findDuplicates(bank.questions.filter((q) => q.status === 'active')));
}

// ── variant effectiveness ───────────────────────────────────────────────────

interface VariantCycle {
  id: string; // original question
  ok: boolean; // answer on the first retry after a variant
  at: string;
}

/**
 * For originals that have variants: the first cycle "original answered wrong → a variant answered →
 * original answered again". Rushed attempts are ignored.
 */
export function variantCycles(bank: Pick<BankState, 'questions' | 'byId'>, attempts: Attempt[]): VariantCycle[] {
  const variantsOf = new Map<string, Set<string>>();
  for (const q of bank.questions) for (const o of q.variantOf) if (bank.byId.has(o) && o !== q.id) variantsOf.set(o, (variantsOf.get(o) ?? new Set()).add(q.id));
  if (!variantsOf.size) return [];
  const originalsOf = new Map<string, string[]>();
  for (const [o, vs] of variantsOf) for (const v of vs) originalsOf.set(v, [...(originalsOf.get(v) ?? []), o]);

  const state = new Map<string, 'wrong' | 'variant' | 'done'>();
  const cycles: VariantCycle[] = [];
  const ordered = attempts.filter((a) => !a.rushed).sort((a, b) => Date.parse(a.finished) - Date.parse(b.finished) || a.id.localeCompare(b.id));
  for (const a of ordered) {
    for (const r of a.answers) {
      if (variantsOf.has(r.q)) {
        const s = state.get(r.q);
        if (s === 'variant' && r.pick) {
          cycles.push({ id: r.q, ok: r.ok, at: a.finished });
          state.set(r.q, 'done');
        } else if (s !== 'done' && s !== 'variant') {
          if (!r.ok) state.set(r.q, 'wrong');
          else state.delete(r.q); // fixed without a variant: no cycle
        }
      }
      if (r.pick) for (const o of originalsOf.get(r.q) ?? []) if (state.get(o) === 'wrong') state.set(o, 'variant');
    }
  }
  return cycles;
}

// ── option-level analytics: picks / strike-outs per option ─────────────────

export interface OptionStats {
  id: string;
  exposures: number; // answers (a pick or a strike-out) to the current version, non-rushed attempts
  correct: number;
  options: Record<string, { picks: number; elims: number }>;
  wrong: Record<string, { times: number; confident: number; why: string[] }>; // wrong picks ("B", "BD")
}

/** The answer was given to the question as it reads now: same hash (`h`), or — older answers — same key, no edit since. */
function currentVersion(r: AnswerRecord, q: Question, key: string, editedSince: boolean): boolean {
  if (r.h) return r.h === q.hash;
  return !editedSince && !r.regraded && r.key === key;
}

/**
 * Per question and option: how often it was picked / struck out, from non-rushed attempts and only for answers to the
 * current version of the question (a rewritten distractor starts with a clean slate). Confident = not unsure, not hinted,
 * not flagged.
 */
export function optionStats(bank: Pick<BankState, 'byId'>, attempts: Attempt[]): Map<string, OptionStats> {
  // answers carry `h` since item versioning: an older hash proves an edit, so hash-less (older) answers are stale too
  const edited = new Set<string>();
  for (const a of attempts) for (const r of a.answers) if (r.h && bank.byId.get(r.q) && bank.byId.get(r.q)!.hash !== r.h) edited.add(r.q);
  const out = new Map<string, OptionStats>();
  for (const a of attempts) {
    if (a.rushed) continue;
    for (const r of a.answers) {
      const q = bank.byId.get(r.q);
      if (!q || (!r.pick && !r.elim)) continue;
      const key = q.answer.join('');
      if (!currentVersion(r, q, key, edited.has(q.id))) continue;
      let s = out.get(q.id);
      if (!s) {
        s = { id: q.id, exposures: 0, correct: 0, options: Object.fromEntries(q.options.map((o) => [o.key, { picks: 0, elims: 0 }])), wrong: {} };
        out.set(q.id, s);
      }
      s.exposures++;
      for (const k of r.pick) if (s.options[k]) s.options[k].picks++;
      for (const k of r.elim ?? '') if (s.options[k]) s.options[k].elims++;
      if (!r.pick) continue;
      if (r.pick === key) {
        s.correct++;
        continue;
      }
      const w = (s.wrong[r.pick] ??= { times: 0, confident: 0, why: [] });
      w.times++;
      if (!r.unsure && !r.hinted && !r.flag) w.confident++;
      if (r.why) w.why.push(r.why);
    }
  }
  return out;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Option-level analytics from the learner's answers: distractors never picked but struck out in at least half of the
 * exposures (too easy to rule out → ENRICH "distractors" rewrite) and the same wrong option picked ≥ 2 times with
 * ≥ 2 confident answers — and in at least a third of the answers, so occasional slips on a question answered dozens of
 * times do not count (the key may be wrong → verify / report).
 */
export function distractorReport(bank: BankState, attempts: Attempt[], minExposures = MIN_EXPOSURES): DistractorReport {
  const weak: DistractorReport['weakDistractors'] = [];
  const suspected: DistractorReport['suspectedKeys'] = [];
  let analysed = 0;
  let answers = 0;
  for (const s of optionStats(bank, attempts).values()) {
    const q = bank.byId.get(s.id);
    if (!q || q.status === 'retired') continue;
    answers += s.exposures;
    const key = q.answer.join('');
    if (s.exposures >= minExposures) {
      analysed++;
      for (const o of q.options) {
        const st = s.options[o.key];
        if (q.answer.includes(o.key) || !st || st.picks > 0) continue;
        if (st.elims >= 2 && st.elims * 2 >= s.exposures) weak.push({ id: q.id, key: o.key, exposures: s.exposures, elims: st.elims });
      }
    }
    for (const [pick, w] of Object.entries(s.wrong)) {
      if (w.times < Math.max(2, Math.ceil(s.exposures / 3)) || w.confident < 2) continue;
      const why = [...new Set(w.why)].slice(-2).map((x) => `“${clip(x.replace(/\s+/g, ' '), 120)}”`);
      suspected.push({
        id: q.id,
        key,
        pick,
        times: w.times,
        confident: w.confident,
        note:
          `Chọn ${pick} ${w.times}/${s.exposures} lần (${w.confident} lần chắc chắn, không gợi ý) thay vì ${key}` +
          (s.correct ? ` · đúng ${s.correct} lần` : ' · chưa lần nào chọn đúng') +
          (why.length ? ` · lý do đã ghi: ${why.join(' | ')}` : ''),
      });
    }
  }
  weak.sort((a, b) => b.elims - a.elims || b.exposures - a.exposures || a.id.localeCompare(b.id) || a.key.localeCompare(b.key));
  suspected.sort((a, b) => b.confident - a.confident || b.times - a.times || a.id.localeCompare(b.id));
  return { minExposures, weakDistractors: weak.slice(0, MAX_WEAK), suspectedKeys: suspected.slice(0, MAX_SUSPECTED), analysed, answers };
}

// ── metrics ─────────────────────────────────────────────────────────────────

const slots = new Map<string, { key: string; value: unknown }>();

/** Memo per part: recomputed only when `key` changes; `key` undefined = no caching (explicit test inputs). */
function cached<T>(slot: string, key: string | undefined, compute: () => T): T {
  if (key === undefined) return compute();
  const hit = slots.get(slot);
  if (hit && hit.key === key) return hit.value as T;
  const value = compute();
  slots.set(slot, { key, value });
  return value;
}

function attemptsKey(attempts: Attempt[]): string {
  return crypto
    .createHash('sha1')
    .update(attempts.map((a) => `${a.id}:${a.answers.length}:${a.rushed ? 1 : 0}`).join('|'))
    .digest('hex');
}

function mtime(file: string): number {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

type BankMetrics = Pick<
  BankQuality,
  'singleAnswer' | 'letters' | 'lettersByOrigin' | 'correctLongest' | 'medianStemWords' | 'longForm' | 'shortExplanations' | 'withHint' | 'withTask' | 'enriched' | 'total'
>;

function bankMetrics(active: Question[]): BankMetrics {
  const singles = active.filter((q) => q.answer.length === 1);
  const letters: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  const lettersByOrigin: Record<string, Record<string, number>> = {};
  for (const q of singles) {
    const l = q.answer[0];
    letters[l] = (letters[l] ?? 0) + 1;
    const o = (lettersByOrigin[q.origin] ??= { A: 0, B: 0, C: 0, D: 0 });
    o[l] = (o[l] ?? 0) + 1;
  }
  return {
    singleAnswer: singles.length,
    letters,
    lettersByOrigin,
    correctLongest: active.filter((q) => correctIsLongest(q)).length,
    medianStemWords: median(active.map((q) => q.words)),
    longForm: active.filter((q) => q.longForm).length,
    shortExplanations: active.filter((q) => countWords(q.explanation) < SHORT_EXPLANATION_WORDS).length,
    withHint: active.filter((q) => q.hint).length,
    withTask: active.filter((q) => q.task).length,
    enriched: active.filter((q) => q.enriched).length,
    total: active.length,
  };
}

const EMPTY_VERIFY: VerifySummary = { verified: 0, ok: 0, review: 0, stale: 0, pending: [] };

function safeVerify(bank: BankState): VerifySummary {
  try {
    return verifySummary(bank) ?? EMPTY_VERIFY;
  } catch (e) {
    console.error('verifySummary failed', e);
    return EMPTY_VERIFY;
  }
}

/**
 * Everything the "Chất lượng" tab and the coach snapshot show. Explicit `ratings` (tests) disable every cache and the
 * background semantic job; otherwise each part is memoized and the semantic job is (re)scheduled when the bank changed.
 */
export function computeQuality(bank: BankState, attempts: Attempt[], ratings?: RatingEntry[], opts: { background?: boolean } = {}): BankQuality {
  const pure = ratings !== undefined;
  const v = pure ? undefined : bank.version;
  const cfg = loadConfig();
  const active = bank.questions.filter((q) => q.status === 'active');
  const metrics = cached('metrics', v, () => bankMetrics(active));
  const lexical = pure ? findDuplicates(active) : lexicalDuplicates(bank);
  const learning = cached('learning', pure ? undefined : `${bank.version}|${attemptsKey(attempts)}`, () => ({
    cycles: variantCycles(bank, attempts),
    distractors: distractorReport(bank, attempts),
  }));
  const votes = cached('ratings', pure ? undefined : String(ratingsMtime()), () => aggregateRatings(ratings ?? loadRatings()));
  const verification = cached('verify', pure ? undefined : `${bank.version}|${mtime(VERIFY_FILE)}`, () => safeVerify(bank));
  if (opts.background ?? !pure) scheduleSemantic(bank, cfg); // no-op unless the bank / model changed
  const sem = semanticState(cfg);
  const activeIds = new Set(active.map((q) => q.id));
  const fixed = learning.cycles.filter((c) => c.ok).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return {
    version: bank.version,
    ...metrics,
    duplicates: mergeDuplicates(lexical, sem.pairs, (id) => activeIds.has(id)),
    ratings: votes,
    lowRated: lowRatedIds(votes).filter((id) => bank.byId.has(id) && bank.byId.get(id)!.status !== 'retired'),
    variantEffect: { originals: learning.cycles.length, fixedAfterVariant: fixed.length, examples: fixed.slice(0, 10).map((c) => c.id) },
    lint: lintBank(bank, { cache: !pure }),
    distractors: learning.distractors,
    semantic: sem.status,
    verification,
  };
}

// ── snapshot section ────────────────────────────────────────────────────────

const pctOf = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);
const SEVERITY_VI: Record<LintSeverity, string> = { high: 'nặng', medium: 'vừa', low: 'nhẹ' };

function optionText(q: Question | undefined, keys: string): string {
  if (!q) return '';
  const texts = [...keys].map((k) => q.options.find((o) => o.key === k)?.text.trim()).filter(Boolean) as string[];
  return texts.length ? ` “${clip(texts.join(' + '), 70)}”` : '';
}

/** "## 14. Chất lượng ngân hàng" for coach/snapshot.md — only what the coach should act on. */
export function qualitySnapshotLines(bank: BankState, attempts: Attempt[], opts: { background?: boolean } = {}): string[] {
  const q = computeQuality(bank, attempts, undefined, opts);
  const o: string[] = ['## 14. Chất lượng ngân hàng', ''];
  const letters = Object.entries(q.letters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k} ${pctOf(v, q.singleAnswer)}%`)
    .join(' · ');
  const top = Math.max(0, ...Object.values(q.letters));
  o.push(`- Vị trí đáp án đúng (câu 1 đáp án): ${letters}${top > q.singleAnswer * 0.4 ? ' — ⚠️ lệch, câu mới phải rải đều A–D' : ''}`);
  for (const [origin, d] of Object.entries(q.lettersByOrigin)) {
    const n = Object.values(d).reduce((s, x) => s + x, 0);
    const max = Object.entries(d).sort((a, b) => b[1] - a[1])[0];
    if (n >= 8 && max && max[1] / n > 0.4) o.push(`  - origin \`${origin}\`: ${max[0]} chiếm ${pctOf(max[1], n)}% (${n} câu) — lệch`);
  }
  o.push(
    `- Đáp án đúng dài nhất (≥ 15 %): **${q.correctLongest}**/${q.total} câu (${pctOf(q.correctLongest, q.total)}%) — ENRICH \`balance\` viết lại distractor cho cân độ dài`,
    `- Giải thích ngắn (< ${SHORT_EXPLANATION_WORDS} từ): ${q.shortExplanations} · có gợi ý: ${q.withHint} · có task: ${q.withTask} · đã ENRICH: ${q.enriched} · câu dài chuẩn thi: ${q.longForm} (${pctOf(q.longForm, q.total)}%, trung vị đề ${q.medianStemWords} từ)`,
  );

  // item-writing flaws (lint.ts)
  const lint = q.lint;
  if (lint) {
    o.push('', `### 🩺 Lỗi viết câu hỏi (lint — \`npm run validate -- --lint\`)`, '');
    for (const sev of ['high', 'medium', 'low'] as LintSeverity[]) {
      const rules = LINT_RULES.filter((r) => r.severity === sev);
      const parts = rules.map((r) => ({ r, n: lint.byCode[r.code]?.count ?? 0 })).filter((x) => x.n > 0);
      if (!parts.length) {
        if (sev === 'high') o.push(`- Nặng: 0 câu ✓`);
        continue;
      }
      o.push(`- ${sev === 'high' ? '❗ ' : ''}${SEVERITY_VI[sev][0].toUpperCase()}${SEVERITY_VI[sev].slice(1)}: ${parts.map((x) => `${x.r.label} ${x.n}`).join(' · ')}`);
      if (sev === 'high') {
        for (const { r } of parts) o.push(`  - \`${r.code}\`: ${(lint.ids?.[r.code] ?? []).slice(0, 8).map((id) => `\`${id}\``).join(', ')} → ${r.fix}`);
      }
    }
    o.push(`- Câu mới / sửa câu: tránh các lỗi trên (SCHEMA §6) — patch làm phát sinh lỗi *nặng* mới bị từ chối.`);
  }

  // option analytics from the learner's answers
  const dr = q.distractors;
  if (dr && (dr.weakDistractors.length || dr.suspectedKeys.length)) {
    o.push('', `### 🎯 Phương án nhiễu — từ bài làm của bạn (câu gặp ≥ ${dr.minExposures} lần)`, '');
    if (dr.weakDistractors.length) {
      o.push(`- Phương án nhiễu quá dễ (chưa chọn lần nào, hay bị gạch) — ENRICH \`distractors\` viết lại cho hấp dẫn (giữ nguyên đáp án đúng):`);
      for (const w of dr.weakDistractors.slice(0, 10)) o.push(`  - \`${w.id}\` ${w.key}${optionText(bank.byId.get(w.id), w.key)} — gạch ${w.elims}/${w.exposures} lần`);
    }
    if (dr.suspectedKeys.length) {
      o.push(`- Nghi đáp án sai (cùng một phương án sai được chọn chắc chắn nhiều lần) — kiểm tra lại bằng notes; sai thì sửa \`answer\` + \`reason\`, mơ hồ thì viết lại hoặc retire:`);
      for (const s of dr.suspectedKeys.slice(0, 10)) {
        const qq = bank.byId.get(s.id);
        o.push(`  - \`${s.id}\` đáp án ${s.key}${optionText(qq, s.key)} · ${s.note.replace(/^Chọn (\S+)/, `chọn $1${optionText(qq, s.pick)}`)}`);
      }
    }
  }

  const ratings = loadRatings();
  const downs = ratings.filter((r) => r.value === 'down' && !r.resolution);
  o.push('', `### 👎 Câu bị đánh giá thấp — \`trainer/bank/ratings.md\``, '');
  if (!q.lowRated.length && !downs.length) o.push('_Chưa có._');
  for (const id of q.lowRated.slice(0, 15)) {
    const v = q.ratings[id];
    const notes = ratings.filter((r) => r.qid === id && r.note && !r.resolution).map((r) => r.note);
    o.push(`- **\`${id}\`** 👎 ${v.down} / 👍 ${v.up} · \`${bank.byId.get(id)?.file ?? '?'}\`${notes.length ? ` — ${notes.slice(-3).join(' | ')}` : ''} → sửa hoặc \`status: retired\``);
  }
  // other recent 👎 (one per question, newest first) — single votes still carry useful notes
  const low = new Set(q.lowRated);
  const recent = new Map<string, RatingEntry[]>();
  for (const r of [...downs].reverse()) if (!low.has(r.qid)) recent.set(r.qid, [...(recent.get(r.qid) ?? []), r]);
  for (const [id, rs] of [...recent].slice(0, 8)) {
    const notes = [...new Set(rs.map((r) => r.note).filter(Boolean))];
    o.push(`- \`${id}\` 👎 ${rs[0].date}${notes.length ? ` — ${notes.slice(0, 3).join(' | ')}` : ''} · \`${bank.byId.get(id)?.file ?? '?'}\``);
  }

  if (q.duplicates.length) {
    const semantic = q.duplicates.filter((d) => d.kind === 'semantic').length;
    o.push(
      '',
      `### Câu gần trùng nhau (${q.duplicates.length}${q.duplicates.length >= MAX_DUPLICATES ? '+' : ''}${semantic ? `, ${semantic} theo nghĩa` : ''}) — gộp/retire bớt hoặc viết lại cho khác tình huống`,
      '',
    );
    for (const d of q.duplicates.slice(0, 10)) o.push(`- \`${d.a}\` ≈ \`${d.b}\` (${d.score}${d.kind === 'semantic' ? ', theo nghĩa' : ''})`);
  }
  const ve = q.variantEffect;
  if (ve.originals) {
    const cycles = variantCycles(bank, attempts);
    const failed = cycles.filter((c) => !c.ok).map((c) => `\`${c.id}\``);
    o.push(
      '',
      `### Hiệu quả câu biến thể`,
      '',
      `- ${ve.fixedAfterVariant}/${ve.originals} câu gốc làm đúng ở lần làm lại đầu tiên sau khi luyện biến thể${ve.examples.length ? ` (vd ${ve.examples.slice(0, 5).map((x) => `\`${x}\``).join(', ')})` : ''}`,
    );
    if (failed.length) o.push(`- Vẫn sai sau biến thể (cần cách giải thích khác): ${failed.slice(0, 10).join(', ')}`);
  }

  const vs = q.verification;
  if (vs && (vs.verified || vs.review || vs.stale)) {
    o.push('', `### 🧪 Giải mù (model thứ hai trả lời không xem đáp án) — \`trainer/bank/verify.md\``, '');
    o.push(`- ${vs.verified} câu đã kiểm · ${vs.ok} khớp đáp án · **${vs.review}** chờ duyệt (lệch / mơ hồ) · ${vs.stale} kết quả cũ (câu đã sửa sau đó)`);
    if (vs.pending.length) {
      o.push(`- Chờ duyệt — đọc lại đề + notes: đáp án sai thì sửa \`answer\` + \`reason\`, đề mơ hồ thì viết lại cho chỉ một đáp án đúng, không cứu được thì \`status: retired\`:`);
      const OUTCOME_VI: Record<string, string> = { mismatch: '❌ lệch đáp án', ambiguous: '⚠️ mơ hồ', error: '💥 lỗi', ok: '✅ khớp' };
      for (const p of vs.pending.slice(0, 15)) {
        const qq = bank.byId.get(p.qid);
        const pick = p.picked ? `model chọn ${p.picked}${optionText(qq, p.picked)}${p.confidence ? ` (tin cậy ${({ high: 'cao', medium: 'vừa', low: 'thấp' } as Record<string, string>)[p.confidence] ?? p.confidence})` : ''}` : '';
        const key = p.key ? `đáp án ${p.key}${optionText(qq, p.key)}` : '';
        o.push(`  - \`${p.qid}\` ${OUTCOME_VI[p.outcome] ?? p.outcome}${qq?.status === 'draft' ? ' · đang draft' : ''} — ${[pick, key].filter(Boolean).join(' · ')}${p.reason ? ` — ${clip(p.reason.replace(/\s+/g, ' '), 160)}` : ''}`);
      }
      if (vs.pending.length > 15) o.push(`  - … và ${vs.pending.length - 15} câu nữa (Ngân hàng → Chất lượng → 🧪 Giải mù)`);
    }
  }
  o.push('');
  return o;
}
