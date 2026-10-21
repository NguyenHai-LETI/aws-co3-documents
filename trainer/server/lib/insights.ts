// [β1] Learner-level insights computed from the learning view of the history (regradeAttempts output).
//
// Confusion pairs (StatsResponse.confusions, coach snapshot §9), normalised by co-occurrence:
//   Every answered question (viewed, non-rushed, same version of the question as today) offers one opportunity per
//   (term X in a distractor, term Y in the key) pair — X/Y = services + features detected in the option texts (classify.ts),
//   X not in the key, Y not in that distractor. Picking that distractor = one pick of X ⟶ Y.
//   rate(X ⟶ Y) = picks / exposures · base = Σ picks / Σ exposures over every pair (the learner's own wrong-pick rate).
//   Confirmed when picks ≥ 4, picks come from ≥ 3 distinct questions and the lower end of the 80 % interval of the rate
//   (posterior Beta(picks + 4·base, misses + 4·(1 − base)), normal approximation) is > 2 × base.
//   Pairs with the same root (same lure or same key term, mostly the same questions) are merged into the strongest one.
//   Drill set = active bank questions whose options name both terms (sealed / out-of-scope left out), key-Y and key-X
//   questions interleaved.
// Synthetic check (tests/insights.test.ts): a learner with no real confusions gets ~0 pairs, planted ones are found.
import type { BankState } from './bank.ts';
import { detectFeatures, detectServices } from './classify.ts';
import { isUnviewed } from './regrade.ts';
import { sealedIds } from './sealed.ts';
import { compareRates } from '../../shared/evidence.ts'; // [v5] transfer warnings only with evidence
import type { Attempt, ConfusionPair, Question, Taxonomy, TransferStats } from '../../shared/types.ts';

export const CONFUSION_RULES = {
  minPicks: 4, // picks of X when the key was Y
  minQuestions: 3, // distinct questions behind those picks
  lift: 2, // lower bound of the rate must exceed lift × base
  z: 1.2816, // lower end of the 80 % interval
  priorStrength: 4, // Beta prior centred on the base rate, worth this many exposures
  mergeOverlap: 0.5, // Jaccard overlap of the questions behind two pairs that share a term → same root
  drillMax: 30, // questions in a drill set
};

export interface ConfusionOptions {
  sealed?: Set<string>; // left out of drill sets (default: sealedIds())
  excludeOutOfScope?: boolean; // leave out-of-scope questions out of drill sets (default true)
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;
const label = (x: string, y: string) => `${x} ⟶ ${y}`;
const byId = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

// ── option terms (per question version and taxonomy) ─────────────────────────

export interface QuestionTerms {
  all: Set<string>; // terms named by any option
  key: Set<string>; // terms named by the correct option(s)
  lures: { key: string; pairs: string[] }[]; // per distractor: the pair keys "X\u0000Y" it offers
}

const termCache = new WeakMap<Taxonomy, WeakMap<Question, QuestionTerms>>();
// detection is the expensive part (hundreds of patterns per text): memoized per option text while the taxonomy stays the
// same, so a bank reload (new Question objects) only scans the options that changed
const textCache = new WeakMap<Taxonomy, Map<string, string[]>>();
const TEXT_CACHE_MAX = 50_000;

function termsOf(text: string, tax: Taxonomy): string[] {
  let m = textCache.get(tax);
  if (!m || m.size > TEXT_CACHE_MAX) textCache.set(tax, (m = new Map()));
  let t = m.get(text);
  if (!t) {
    t = [...new Set([...detectServices(text, tax), ...detectFeatures(text, tax)])];
    m.set(text, t);
  }
  return t;
}

/** Terms named by a question's options (cached per question version and taxonomy). */
export function questionTerms(q: Question, tax: Taxonomy): QuestionTerms {
  let byQ = termCache.get(tax);
  if (!byQ) termCache.set(tax, (byQ = new WeakMap()));
  let t = byQ.get(q);
  if (t) return t;
  const opt = new Map(q.options.map((o) => [o.key, termsOf(o.text, tax)]));
  const key = new Set(q.answer.flatMap((k) => opt.get(k) ?? []));
  const lures: QuestionTerms['lures'] = [];
  for (const o of q.options) {
    if (q.answer.includes(o.key)) continue;
    const mine = opt.get(o.key) ?? [];
    const pairs: string[] = [];
    for (const x of mine) {
      if (key.has(x)) continue;
      for (const y of key) if (!mine.includes(y)) pairs.push(`${x}\u0000${y}`);
    }
    if (pairs.length) lures.push({ key: o.key, pairs });
  }
  t = { all: new Set([...opt.values()].flat()), key, lures };
  byQ.set(q, t);
  return t;
}

// ── pair tallies (memoized per history array + bank version) ────────────────

interface PairTally {
  exposures: number;
  picks: number;
  questions: Set<string>; // questions behind the picks
}

const tallyCache = new WeakMap<Attempt[], { version: string; pairs: Map<string, PairTally>; base: number }>();

/**
 * Exposures and picks of every (lure term, key term) pair. Answers are first folded per question (answers on the current
 * version, picks per option), so the pair maps are touched once per question instead of once per answer. A history that
 * cannot hold a confirmed pair yet (too few wrong picks) skips the term scan altogether.
 */
function tallyPairs(attempts: Attempt[], bank: BankState): { pairs: Map<string, PairTally>; base: number } {
  const hit = tallyCache.get(attempts);
  if (hit && hit.version === bank.version) return hit;
  const perQ = new Map<string, { q: Question; n: number; picked: Map<string, number> }>();
  let wrongPicks = 0;
  for (const a of attempts) {
    if (a.rushed || a.mode === 'retest') continue; // [v5] retests re-ask just-corrected questions
    for (const r of a.answers) {
      if (!r.pick || isUnviewed(r) || r.relearn || r.skipped || r.grade !== undefined) continue;
      const q = bank.byId.get(r.q);
      if (!q || (r.h && r.h !== q.hash)) continue; // another version of the options was on screen
      let e = perQ.get(q.id);
      if (!e) perQ.set(q.id, (e = { q, n: 0, picked: new Map() }));
      e.n++;
      for (const k of r.pick) {
        if (q.answer.includes(k)) continue;
        e.picked.set(k, (e.picked.get(k) ?? 0) + 1);
        wrongPicks++;
      }
    }
  }
  const pairs = new Map<string, PairTally>();
  let exposures = 0;
  let picks = 0;
  const pickedQuestions = [...perQ.values()].filter((e) => e.picked.size).length;
  if (wrongPicks >= CONFUSION_RULES.minPicks && pickedQuestions >= CONFUSION_RULES.minQuestions) {
    for (const { q, n, picked } of perQ.values()) {
      for (const lure of questionTerms(q, bank.taxonomy).lures) {
        const chosen = picked.get(lure.key) ?? 0;
        for (const k of lure.pairs) {
          let p = pairs.get(k);
          if (!p) pairs.set(k, (p = { exposures: 0, picks: 0, questions: new Set() }));
          p.exposures += n;
          exposures += n;
          if (chosen) {
            p.picks += chosen;
            p.questions.add(q.id);
            picks += chosen;
          }
        }
      }
    }
  }
  const out = { version: bank.version, pairs, base: exposures ? picks / exposures : 0 };
  tallyCache.set(attempts, out);
  return out;
}

/** Lower end of the 80 % interval of a pick rate, shrunk towards the learner's base rate. */
export function rateLowerBound(picks: number, exposures: number, base: number, rules = CONFUSION_RULES): number {
  const a = picks + rules.priorStrength * base;
  const b = Math.max(0, exposures - picks) + rules.priorStrength * (1 - base);
  if (a + b <= 0) return 0;
  const mean = a / (a + b);
  const sd = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)));
  return Math.max(0, mean - rules.z * sd);
}

// ── drill sets ───────────────────────────────────────────────────────────────

/** Active questions naming both terms (excluding sealed / out-of-scope), key-Y and key-X questions interleaved. */
function drillSet(bank: BankState, x: string, y: string, opts: Required<ConfusionOptions>, max: number): string[] {
  const yKey: string[] = [];
  const xKey: string[] = [];
  const neither: string[] = [];
  for (const q of bank.questions) {
    if (q.status !== 'active' || opts.sealed.has(q.id) || (opts.excludeOutOfScope && q.outOfScope)) continue;
    const t = questionTerms(q, bank.taxonomy);
    if (!t.all.has(x) || !t.all.has(y)) continue;
    if (t.key.has(y) && !t.key.has(x)) yKey.push(q.id);
    else if (t.key.has(x) && !t.key.has(y)) xKey.push(q.id);
    else neither.push(q.id);
  }
  for (const l of [yKey, xKey, neither]) l.sort(byId);
  const out: string[] = [];
  for (let i = 0; i < Math.max(yKey.length, xKey.length); i++) {
    if (i < yKey.length) out.push(yKey[i]);
    if (i < xKey.length) out.push(xKey[i]);
  }
  return [...out, ...neither].slice(0, max);
}

// ── confirmed pairs ──────────────────────────────────────────────────────────

/** Service/feature confusions confirmed against the learner's own baseline (normalised by co-occurrence), strongest first. */
export function confusionPairs(attempts: Attempt[], bank: BankState, options: ConfusionOptions = {}): ConfusionPair[] {
  const rules = CONFUSION_RULES;
  const opts: Required<ConfusionOptions> = { sealed: options.sealed ?? sealedIds(), excludeOutOfScope: options.excludeOutOfScope ?? true };
  const { pairs, base } = tallyPairs(attempts, bank);
  if (!(base > 0)) return [];
  const confirmed: { x: string; y: string; t: PairTally; low: number }[] = [];
  for (const [k, t] of pairs) {
    if (t.picks < rules.minPicks || t.questions.size < rules.minQuestions) continue;
    const low = rateLowerBound(t.picks, t.exposures, base, rules);
    if (low <= rules.lift * base) continue;
    const [x, y] = k.split('\u0000');
    confirmed.push({ x, y, t, low });
  }
  // strongest first; on ties service names lead feature terms (the head of a merged root is the readable one)
  const services = (c: (typeof confirmed)[number]) => (bank.taxonomy.services[c.x] ? 1 : 0) + (bank.taxonomy.services[c.y] ? 1 : 0);
  confirmed.sort((a, b) => b.low - a.low || b.t.picks - a.t.picks || services(b) - services(a) || label(a.x, a.y).localeCompare(label(b.x, b.y)));
  // same root: shares the lure or the key term and mostly the same questions (feature terms co-occur with services)
  const jaccard = (a: Set<string>, b: Set<string>) => {
    let n = 0;
    for (const v of a) if (b.has(v)) n++;
    return n / (a.size + b.size - n || 1);
  };
  const clusters: { head: (typeof confirmed)[number]; members: string[] }[] = [];
  for (const c of confirmed) {
    const home = clusters.find((h) => (h.head.x === c.x || h.head.y === c.y) && jaccard(h.head.t.questions, c.t.questions) >= rules.mergeOverlap);
    if (home) home.members.push(label(c.x, c.y));
    else clusters.push({ head: c, members: [] });
  }
  return clusters.map(({ head: { x, y, t, low }, members }) => {
    const pair: ConfusionPair = {
      picked: x,
      correct: y,
      picks: t.picks,
      exposures: t.exposures,
      questions: t.questions.size,
      rate: round3(t.picks / t.exposures),
      low: round3(low),
      base: round3(base),
      ids: drillSet(bank, x, y, opts, rules.drillMax),
    };
    if (members.length) pair.merged = members;
    return pair;
  });
}

// ── [v5 · λ] transfer metric ─────────────────────────────────────────────────
//
// Transfer = the first answer to a question whose sibling (same cluster, Question.cluster from γ1's clusterIndex) had
// last been answered right — the concept carried over to a new wording. Repeat = any later answer to the same question.
// Both counted over stats samples (no skipped / relearn / retest / self-graded answers) of the last TRANSFER_DAYS days;
// the "answered right before" history uses every real answer since the beginning. A warning ("đang thuộc mặt chữ") is
// only raised when the evidence shield says repeats are really above transfers (compareRates verdict 'above').

/** TransferStats window (days). */
export const TRANSFER_DAYS = 30;
const DAY = 86_400_000;

type Tally = { answers: number; correct: number };
const tally = (t: Tally, ok: boolean) => {
  t.answers++;
  if (ok) t.correct++;
};
const pct1 = (t: Tally) => (t.answers ? Math.round((1000 * t.correct) / t.answers) / 10 : 0);

const transferMemo = new WeakMap<Attempt[], { key: string; value: TransferStats }>();

/** First tries on a sibling of a question already answered right vs repeats of the same question, by topic. */
export function transferStats(attempts: Attempt[], bank: BankState, opts: { now?: number; sealed?: Set<string> } = {}): TransferStats {
  const now = opts.now ?? Date.now();
  const key = `${bank.version}|${Math.floor(now / DAY)}`;
  const hit = transferMemo.get(attempts);
  if (hit?.key === key) return hit.value;
  const since = now - TRANSFER_DAYS * DAY;
  const ordered = attempts
    .filter((a) => !a.rushed)
    .map((a, i) => ({ a, i, at: Date.parse(a.finished) || 0 }))
    .sort((x, y) => x.at - y.at || x.i - y.i);
  const lastOk = new Map<string, boolean>(); // per question: was its latest real answer right?
  const rightInCluster = new Map<string, Set<string>>(); // cluster → members whose latest answer is right
  const out: TransferStats = { days: TRANSFER_DAYS, transfer: { answers: 0, correct: 0 }, repeat: { answers: 0, correct: 0 }, byTopic: [], warnings: [] };
  const topics = new Map<string, { transfer: Tally; repeat: Tally }>();
  for (const { a, at } of ordered) {
    const sample = at >= since && a.mode !== 'retest' && a.source !== 'anki' && a.source !== 'listen';
    for (const r of a.answers) {
      if (r.relearn || r.skipped || isUnviewed(r)) continue;
      const q = bank.byId.get(r.q);
      const ok = r.grade !== undefined ? r.grade >= 3 : r.ok;
      const cluster = q?.cluster;
      if (q && sample && r.grade === undefined && !opts.sealed?.has(r.q)) {
        const t = topics.get(q.topic) ?? { transfer: { answers: 0, correct: 0 }, repeat: { answers: 0, correct: 0 } };
        topics.set(q.topic, t);
        if ((r.exposure ?? (lastOk.has(r.q) ? 2 : 1)) > 1) {
          tally(out.repeat, ok);
          tally(t.repeat, ok);
        } else if (cluster && [...(rightInCluster.get(cluster) ?? [])].some((id) => id !== r.q)) {
          tally(out.transfer, ok);
          tally(t.transfer, ok);
        }
      }
      lastOk.set(r.q, ok);
      if (cluster) {
        let set = rightInCluster.get(cluster);
        if (!set) rightInCluster.set(cluster, (set = new Set()));
        if (ok) set.add(r.q);
        else set.delete(r.q);
      }
    }
  }
  const label = (id: string) => {
    const t = bank.taxonomy.topics.find((x) => x.id === id);
    return t ? `${t.icon} ${t.label}` : id;
  };
  out.byTopic = [...topics]
    .filter(([, t]) => t.transfer.answers > 0)
    .map(([topic, t]) => {
      const row: TransferStats['byTopic'][number] = { topic, label: label(topic), transfer: t.transfer, repeat: t.repeat };
      if (t.repeat.answers) row.gap = Math.round((pct1(t.repeat) - pct1(t.transfer)) * 10) / 10;
      return row;
    })
    .sort((x, y) => (y.gap ?? -999) - (x.gap ?? -999) || x.topic.localeCompare(y.topic));
  const memorizing = (rep: Tally, tr: Tally) => compareRates(rep.correct, rep.answers, tr.correct, tr.answers).verdict === 'above';
  if (memorizing(out.repeat, out.transfer))
    out.warnings.push(`Có thể bạn đang thuộc mặt chữ: đúng ${pct1(out.repeat)}% khi gặp lại câu cũ nhưng chỉ ${pct1(out.transfer)}% ở lần đầu gặp câu anh em (${out.transfer.answers} câu).`);
  for (const row of out.byTopic) {
    if (memorizing(row.repeat, row.transfer))
      out.warnings.push(`${row.label}: đúng ${pct1(row.repeat)}% câu lặp lại nhưng ${pct1(row.transfer)}% câu anh em lần đầu — học theo khái niệm thay vì nhớ đáp án.`);
  }
  transferMemo.set(attempts, { key, value: out });
  return out;
}
