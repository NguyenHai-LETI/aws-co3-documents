// [v5 γ1] Set-similarity helpers shared by the sibling clusters (clusters.ts) and the lexical near-duplicates
// (quality.ts): word signatures of a question and an exact Jaccard similarity join with prefix filtering (AllPairs), so
// finding every pair above a threshold stays near-linear on a 5,000-question bank instead of comparing all n² pairs.
// Pure functions, no I/O.
import type { Question } from '../../shared/types.ts';

/** Jaccard index of two sorted arrays of unique integers (0 when either is empty). */
export function jaccard(a: readonly number[], b: readonly number[]): number {
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

/** A dictionary that numbers strings in first-seen order (one per scan, so signatures compare as sorted int arrays). */
export class Dict {
  private map = new Map<string, number>();
  id(s: string): number {
    let n = this.map.get(s);
    if (n === undefined) this.map.set(s, (n = this.map.size));
    return n;
  }
}

const uniqSorted = (xs: number[]) => [...new Set(xs)].sort((x, y) => x - y);

/** Stem words of ≥ 3 letters (a-z0-9, lower case) as sorted ids — the sibling rule of the sealed forms (v4) and clusters. */
export function stemWords(text: string, dict: Dict): number[] {
  const ids: number[] = [];
  for (const w of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) if (w.length >= 3) ids.push(dict.id(w));
  return uniqSorted(ids);
}

/** The correct option text(s), normalised and sorted ('' when none): "same key" for the sibling rule. */
export function keyText(q: Pick<Question, 'options' | 'answer'>): string {
  return q.options
    .filter((o) => q.answer.includes(o.key))
    .map((o) => o.text.trim().toLowerCase().replace(/\s+/g, ' '))
    .sort()
    .join(' | ');
}

// ── lexical near-duplicates (quality.ts): significant words + word trigrams of stem + correct option(s) ─────────────

export const DUP_WORDS = 0.8; // Jaccard of significant words (stem + correct option)
export const DUP_TRIGRAMS = 0.6; // Jaccard of word trigrams

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

export interface LexicalSignature {
  words: number[]; // sorted unique ids of significant words
  trigrams: number[]; // sorted unique ids of word trigrams
}

export function lexicalSignature(q: Pick<Question, 'stem' | 'options' | 'answer'>, dict: Dict): LexicalSignature {
  const correct = q.options.filter((o) => q.answer.includes(o.key)).map((o) => o.text).sort().join(' ');
  const all = tokens(`${q.stem} ${correct}`);
  const tri: number[] = [];
  for (let i = 0; i + 2 < all.length; i++) tri.push(dict.id(`${all[i]} ${all[i + 1]} ${all[i + 2]}`));
  return { words: uniqSorted(all.filter((w) => !STOPWORDS.has(w)).map((w) => dict.id(w))), trigrams: uniqSorted(tri) };
}

/**
 * Near-duplicate pairs (stem + correct option): significant-word Jaccard ≥ 0.8 or trigram Jaccard ≥ 0.6. `score` = the
 * larger index (an index whose size ratio is under its threshold counts 0, as in v3). Every pair, best first — except for
 * templated text over the join caps (JOIN_CAPS), which pairs with nothing.
 */
export function lexicalPairs<T extends Pick<Question, 'id' | 'stem' | 'options' | 'answer'>>(questions: readonly T[], caps: JoinCaps = JOIN_CAPS): { a: string; b: string; score: number }[] {
  const dict = new Dict();
  const sigs = questions.map((q) => lexicalSignature(q, dict));
  const found = new Map<string, [number, number]>();
  for (const [i, j] of similarJoin(sigs.map((s) => s.words), DUP_WORDS, caps).pairs) found.set(`${i}|${j}`, [i, j]);
  for (const [i, j] of similarJoin(sigs.map((s) => s.trigrams), DUP_TRIGRAMS, caps).pairs) found.set(`${i}|${j}`, [i, j]);
  const out: { a: string; b: string; score: number }[] = [];
  for (const [x, y] of found.values()) {
    const a = sigs[x];
    const b = sigs[y];
    const wr = Math.min(a.words.length, b.words.length) / Math.max(a.words.length, b.words.length, 1);
    const tr = Math.min(a.trigrams.length, b.trigrams.length) / Math.max(a.trigrams.length, b.trigrams.length, 1);
    const w = wr >= DUP_WORDS ? jaccard(a.words, b.words) : 0;
    const t = tr >= DUP_TRIGRAMS ? jaccard(a.trigrams, b.trigrams) : 0;
    if (w < DUP_WORDS && t < DUP_TRIGRAMS) continue;
    const [p, q] = questions[x].id < questions[y].id ? [questions[x].id, questions[y].id] : [questions[y].id, questions[x].id];
    out.push({ a: p, b: q, score: Math.round(Math.max(w, t) * 100) / 100 });
  }
  return out.sort((p, q) => q.score - p.score || p.a.localeCompare(q.a) || p.b.localeCompare(q.b));
}

// ── similarity join ─────────────────────────────────────────────────────────

export interface JoinCaps {
  maxPartners?: number; // a set matching more sets than this is templated text: no pairs at all (a "hub")
  maxCandidates?: number; // …or one whose probe examines more candidates than this
}

/** Defaults for the bank joins: far above any real question (2026-10-20 bank: ≤ 24 partners — the caps never trigger, results are exact). */
export const JOIN_CAPS: Required<JoinCaps> = { maxPartners: 150, maxCandidates: 3000 };

/**
 * Every pair of sets with Jaccard ≥ `threshold` (0 < threshold ≤ 1) as [i, j, jaccard], i < j — exact (no false
 * negatives, no false positives) for every set that is no hub. Prefix filtering: with tokens in one global order (rarest
 * first), two sets whose Jaccard reaches t share a token within the first |s| − ⌈t·|s|⌉ + 1 tokens of each; sets are
 * processed by size, so a candidate also needs |y| ≥ t·|x|. Input sets are arrays of unique integers (any order).
 * `caps`: a set over a cap is reported in `hubs` and takes part in no pair (never indexed) — templated text would otherwise
 * make the output, and the time, quadratic.
 */
export function similarJoin(sets: readonly (readonly number[])[], threshold: number, caps: JoinCaps = {}): { pairs: [number, number, number][]; hubs: Set<number> } {
  if (!(threshold > 0 && threshold <= 1)) throw new RangeError(`threshold must be in (0, 1], got ${threshold}`);
  const maxPartners = caps.maxPartners ?? Infinity;
  const maxCandidates = caps.maxCandidates ?? Infinity;
  const sorted = sets.map((s) => [...new Set(s)].sort((x, y) => x - y));
  const freq = new Map<number, number>();
  for (const s of sorted) for (const x of s) freq.set(x, (freq.get(x) ?? 0) + 1);
  const rare = (x: number, y: number) => freq.get(x)! - freq.get(y)! || x - y;
  const order = sorted.map((_, i) => i).filter((i) => sorted[i].length).sort((a, b) => sorted[a].length - sorted[b].length || a - b);
  const index = new Map<number, number[]>(); // token → sets (already processed) holding it in their prefix
  const out: [number, number, number][] = [];
  const hubs = new Set<number>();
  const EPS = 1e-9; // t·n in floating point (0.6 × 5 = 3.0000000000000004) must not shorten a prefix
  const seen = new Uint32Array(sorted.length); // probe stamp per set (cheaper than a Set per probe)
  let stamp = 0;
  for (const x of order) {
    const xs = sorted[x];
    const n = xs.length;
    const byRarity = [...xs].sort(rare);
    const prefix = n - Math.ceil(threshold * n - EPS) + 1;
    const minSize = threshold * n - EPS;
    stamp++;
    const mine: [number, number, number][] = [];
    let examined = 0;
    let hub = false;
    probe: for (let p = 0; p < prefix; p++) {
      const list = index.get(byRarity[p]);
      if (!list) continue;
      for (const y of list) {
        if (seen[y] === stamp) continue;
        seen[y] = stamp;
        if (sorted[y].length < minSize) continue;
        if (++examined > maxCandidates) {
          hub = true;
          break probe;
        }
        const j = jaccard(xs, sorted[y]);
        if (j < threshold) continue;
        mine.push(x < y ? [x, y, j] : [y, x, j]);
        if (mine.length > maxPartners) {
          hub = true;
          break probe;
        }
      }
    }
    if (hub) {
      hubs.add(x);
      continue;
    }
    for (const pr of mine) out.push(pr);
    for (let p = 0; p < prefix; p++) {
      const list = index.get(byRarity[p]);
      if (list) list.push(x);
      else index.set(byRarity[p], [x]);
    }
  }
  return { pairs: out, hubs };
}

/** similarJoin without caps: every pair (tests, small inputs). */
export function similarPairs(sets: readonly (readonly number[])[], threshold: number): [number, number, number][] {
  return similarJoin(sets, threshold).pairs;
}
