// Bank quality metrics (#2, #14): correct-letter distribution, "correct option is the longest",
// stem/explanation length, hints/tasks/enrichment coverage, near-duplicates, 👍/👎 ratings and
// whether practicing a variant fixed the original question. Numbers cover active questions.
import crypto from 'node:crypto';
import type { BankState } from './bank.ts';
import { aggregateRatings, loadRatings, lowRatedIds, ratingsMtime, type RatingEntry } from './ratings.ts';
import { countWords } from '../../shared/timing.ts';
import type { Attempt, BankQuality, DuplicatePair, Question } from '../../shared/types.ts';

const LONGEST_RATIO = 1.15;
const SHORT_EXPLANATION_WORDS = 15;
const DUP_WORDS = 0.8; // Jaccard of significant words (stem + correct option)
const DUP_TRIGRAMS = 0.6; // Jaccard of word trigrams
const MAX_DUPLICATES = 50;

/** (A) correct option is longer than every distractor by ≥ 15 % — length gives the answer away. */
export function correctIsLongest(q: Pick<Question, 'options' | 'answer'>, ratio = LONGEST_RATIO): boolean {
  if (q.options.length < 3 || !q.answer.length) return false;
  const len = (keys: (k: string) => boolean) => Math.max(0, ...q.options.filter((o) => keys(o.key)).map((o) => o.text.trim().length));
  const correct = len((k) => q.answer.includes(k));
  const other = len((k) => !q.answer.includes(k));
  return other > 0 && correct >= other * ratio;
}

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
        pairs.push({ a: p, b: q, score: Math.round(Math.max(w, t) * 100) / 100 });
      }
    }
  }
  return pairs.sort((p, q) => q.score - p.score || p.a.localeCompare(q.a) || p.b.localeCompare(q.b)).slice(0, limit);
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

// ── metrics ─────────────────────────────────────────────────────────────────

let cache: { key: string; value: BankQuality } | undefined;

function attemptsKey(attempts: Attempt[]): string {
  return crypto
    .createHash('sha1')
    .update(attempts.map((a) => `${a.id}:${a.answers.length}:${a.rushed ? 1 : 0}`).join('|'))
    .digest('hex');
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

export function computeQuality(bank: BankState, attempts: Attempt[], ratings?: RatingEntry[]): BankQuality {
  const key = ratings ? '' : `${bank.version}|${attemptsKey(attempts)}|${ratingsMtime()}`;
  if (key && cache?.key === key) return cache.value;

  const active = bank.questions.filter((q) => q.status === 'active');
  const singles = active.filter((q) => q.answer.length === 1);
  const letters: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  const lettersByOrigin: Record<string, Record<string, number>> = {};
  for (const q of singles) {
    const l = q.answer[0];
    letters[l] = (letters[l] ?? 0) + 1;
    const o = (lettersByOrigin[q.origin] ??= { A: 0, B: 0, C: 0, D: 0 });
    o[l] = (o[l] ?? 0) + 1;
  }
  const votes = aggregateRatings(ratings ?? loadRatings());
  const cycles = variantCycles(bank, attempts);
  const fixed = cycles.filter((c) => c.ok).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const value: BankQuality = {
    version: bank.version,
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
    duplicates: findDuplicates(active),
    ratings: votes,
    lowRated: lowRatedIds(votes).filter((id) => bank.byId.has(id) && bank.byId.get(id)!.status !== 'retired'),
    variantEffect: { originals: cycles.length, fixedAfterVariant: fixed.length, examples: fixed.slice(0, 10).map((c) => c.id) },
  };
  if (key) cache = { key, value };
  return value;
}

// ── snapshot section ────────────────────────────────────────────────────────

const pctOf = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);

/** "## 14. Chất lượng ngân hàng" for coach/snapshot.md — only what the coach should act on. */
export function qualitySnapshotLines(bank: BankState, attempts: Attempt[]): string[] {
  const q = computeQuality(bank, attempts);
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
    o.push('', `### Câu gần trùng nhau (${q.duplicates.length}${q.duplicates.length >= MAX_DUPLICATES ? '+' : ''}) — gộp/retire bớt hoặc viết lại cho khác tình huống`, '');
    for (const d of q.duplicates.slice(0, 10)) o.push(`- \`${d.a}\` ≈ \`${d.b}\` (${d.score})`);
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
  o.push('');
  return o;
}
