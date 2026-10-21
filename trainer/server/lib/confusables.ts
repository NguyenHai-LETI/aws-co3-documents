// [v5 γ1] Confusable services: names that compete in the same question — one named by the correct option, another by a
// distractor (taxonomy.services match terms, classify.ts) — grouped into 2–4 service groups, plus the learner's own
// confirmed confusions (insights.ts confusionPairs). Feeds mode 'discriminate' (select.ts contrastPool), GET /api/pairs,
// GET /api/pairs/compare and the pair page (#/pair?a=&b=). Only the practice pool counts: active, not sealed, in scope.
//
// Pairs: a bank pair needs ≥ CONFUSABLE_RULES.minQuestions competing questions; a confirmed learner confusion between
// two services joins with ≥ learnerMinQuestions (flagged `confused`). Groups: every pair not yet inside a group seeds one
// (the learner's pairs first, then by competing questions); it grows with the service most connected to it (summed
// competing questions over listed pairs) up to maxServices. A service may sit in several groups.
// Progress ("đã tách được"): contrast answers = viewed first-try answers (no relearn / skipped record) on questions where
// two of the services compete; last10 = % correct over the last ≤ 10; separated = ≥ 10 answers and last10 ≥ 80.
import { detectFeatures, detectServices } from './classify.ts';
import { confusionPairs } from './insights.ts';
import { isUnviewed } from './regrade.ts';
import { sealedIds, sealedKey } from './sealed.ts';
import type { BankState } from './bank.ts';
import type { AnswerRecord, Attempt, ConfusableGroup, PairCompare, Question, Taxonomy } from '../../shared/types.ts';

export const CONFUSABLE_RULES = {
  minQuestions: 8, // competing questions for a bank pair
  learnerMinQuestions: 3, // …for a confusion confirmed from the learner's answers (something to drill)
  maxServices: 4,
  window: 10, // progress over the last N contrast answers
  separatedPct: 80,
  separatedMin: 10, // answers before "đã tách được" can be said
};

// ── services per question ─────────────────────────────────────────────────

export interface OptionServices {
  key: string[]; // services named by the correct option(s)
  lures: string[]; // services named by distractors and not by the key
}

const svcMemo = new WeakMap<Taxonomy, WeakMap<Question, OptionServices>>();

/** Services the options name (memoized per question object and taxonomy). */
export function optionServices(q: Question, tax: Taxonomy): OptionServices {
  let byQ = svcMemo.get(tax);
  if (!byQ) svcMemo.set(tax, (byQ = new WeakMap()));
  let s = byQ.get(q);
  if (s) return s;
  const key = new Set<string>();
  const lure = new Set<string>();
  for (const o of q.options) for (const name of detectServices(o.text, tax)) (q.answer.includes(o.key) ? key : lure).add(name);
  s = { key: [...key], lures: [...lure].filter((x) => !key.has(x)) };
  byQ.set(q, s);
  return s;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

/** Unordered service pairs competing in a question (one in the key, the other only in a distractor). */
function competing(q: Question, tax: Taxonomy): string[] {
  const s = optionServices(q, tax);
  const out = new Set<string>();
  for (const a of s.key) for (const b of s.lures) out.add(pairKey(a, b));
  return [...out];
}

/** Two of `services` compete in the question. */
function competesIn(q: Question, tax: Taxonomy, services: ReadonlySet<string>): boolean {
  const s = optionServices(q, tax);
  return s.key.some((a) => services.has(a)) && s.lures.some((b) => services.has(b));
}

function practicePool(bank: BankState, sealed: ReadonlySet<string> = sealedIds()): Question[] {
  return bank.questions.filter((q) => q.status === 'active' && !q.outOfScope && !sealed.has(q.id));
}

/**
 * Practice questions where at least two of `services` compete (one in the key, another in a distractor), in bank order,
 * with the service named by the correct option (the first of `services` in the key — for alternating order).
 */
export function contrastPool(bank: BankState, services: string[]): { question: Question; answerService: string }[] {
  const want = [...new Set(services.map((s) => s.trim()).filter(Boolean))];
  const set = new Set(want);
  if (set.size < 2) return [];
  const out: { question: Question; answerService: string }[] = [];
  for (const q of practicePool(bank)) {
    if (!competesIn(q, bank.taxonomy, set)) continue;
    const key = new Set(optionServices(q, bank.taxonomy).key);
    out.push({ question: q, answerService: want.find((s) => key.has(s))! });
  }
  return out;
}

// ── groups ──────────────────────────────────────────────────────────────────

interface BankPairs {
  key: string;
  counts: Map<string, number>; // pair key → competing practice questions
  byPair: Map<string, string[]>; // pair key → question ids
}

const pairsMemo = new WeakMap<BankState, BankPairs>();

function bankPairs(bank: BankState): BankPairs {
  const key = `${bank.version}|${sealedKey()}`;
  const hit = pairsMemo.get(bank);
  if (hit?.key === key) return hit;
  const counts = new Map<string, number>();
  const byPair = new Map<string, string[]>();
  for (const q of practicePool(bank)) {
    for (const k of competing(q, bank.taxonomy)) {
      counts.set(k, (counts.get(k) ?? 0) + 1);
      const l = byPair.get(k);
      if (l) l.push(q.id);
      else byPair.set(k, [q.id]);
    }
  }
  const value = { key, counts, byPair };
  pairsMemo.set(bank, value);
  return value;
}

const slug = (services: string[]) =>
  [...services]
    .sort()
    .map((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .join('--');

interface Progress {
  answers: number;
  correct: number;
  last10: number;
  separated: boolean;
}

function progressOf(oks: boolean[]): Progress {
  const last = oks.slice(-CONFUSABLE_RULES.window);
  const last10 = last.length ? Math.round((100 * last.filter(Boolean).length) / last.length) : 0;
  return {
    answers: oks.length,
    correct: oks.filter(Boolean).length,
    last10,
    separated: oks.length >= CONFUSABLE_RULES.separatedMin && last10 >= CONFUSABLE_RULES.separatedPct,
  };
}

/** A first-try answer the learner saw (not a relearn retry, not a skipped blank). */
const counted = (r: AnswerRecord) => !isUnviewed(r) && !r.relearn && !r.skipped;

/** Chronological contrast answers (ok flags) per set of question ids. */
function answersOn(attempts: readonly Attempt[], sets: ReadonlySet<string>[]): boolean[][] {
  const out = sets.map(() => [] as boolean[]);
  const of = new Map<string, number[]>();
  sets.forEach((s, i) => {
    for (const id of s) {
      const l = of.get(id);
      if (l) l.push(i);
      else of.set(id, [i]);
    }
  });
  const ordered = attempts.filter((a) => !a.rushed).sort((a, b) => Date.parse(a.finished) - Date.parse(b.finished) || a.id.localeCompare(b.id));
  for (const a of ordered) {
    for (const r of a.answers) {
      const groups = of.get(r.q);
      if (!groups || !counted(r)) continue;
      for (const g of groups) out[g].push(!!r.ok);
    }
  }
  return out;
}

/**
 * Confusable groups of the bank, the learner's confusions and their groups first, then most competing questions.
 * With `attempts` (the learning view: regradeAttempts output): confirmed confusions join and every group gets `learner`.
 */
export function confusableGroups(bank: BankState, attempts?: readonly Attempt[]): ConfusableGroup[] {
  const tax = bank.taxonomy;
  const { counts, byPair } = bankPairs(bank);
  const listed = new Map<string, { a: string; b: string; n: number; confused?: boolean }>();
  for (const [k, n] of counts) {
    if (n < CONFUSABLE_RULES.minQuestions) continue;
    const [a, b] = k.split('\u0000');
    listed.set(k, { a, b, n });
  }
  if (attempts?.length) {
    let confirmed: ReturnType<typeof confusionPairs> = [];
    try {
      confirmed = confusionPairs(attempts as Attempt[], bank);
    } catch {
      // the learner part is optional: the bank pairs still list
    }
    for (const c of confirmed) {
      if (!tax.services[c.picked] || !tax.services[c.correct] || c.picked === c.correct) continue;
      const k = pairKey(c.picked, c.correct);
      const n = counts.get(k) ?? 0;
      if (n < CONFUSABLE_RULES.learnerMinQuestions) continue;
      const [a, b] = k.split('\u0000');
      listed.set(k, { a, b, n, confused: true });
    }
  }
  const neighbours = new Map<string, Map<string, number>>();
  for (const p of listed.values()) {
    for (const [x, y] of [
      [p.a, p.b],
      [p.b, p.a],
    ]) {
      const m = neighbours.get(x) ?? new Map<string, number>();
      m.set(y, p.n);
      neighbours.set(x, m);
    }
  }
  const seeds = [...listed.entries()].sort(([ka, a], [kb, b]) => Number(!!b.confused) - Number(!!a.confused) || b.n - a.n || (ka < kb ? -1 : 1));
  const covered = new Set<string>();
  const groups: { services: string[]; pairs: { a: string; b: string; n: number; confused?: boolean }[] }[] = [];
  for (const [k, seed] of seeds) {
    if (covered.has(k)) continue;
    const g = [seed.a, seed.b];
    while (g.length < CONFUSABLE_RULES.maxServices) {
      let best: string | undefined;
      let bestScore = 0;
      const cands = new Set(g.flatMap((s) => [...(neighbours.get(s)?.keys() ?? [])]).filter((c) => !g.includes(c)));
      for (const c of [...cands].sort()) {
        const score = g.reduce((sum, s) => sum + (neighbours.get(c)?.get(s) ?? 0), 0);
        if (score > bestScore) [best, bestScore] = [c, score];
      }
      if (!best) break;
      g.push(best);
    }
    const pairs = [...listed.values()].filter((p) => g.includes(p.a) && g.includes(p.b));
    for (const p of pairs) covered.add(pairKey(p.a, p.b));
    pairs.sort((p, q) => q.n - p.n || pairKey(p.a, p.b).localeCompare(pairKey(q.a, q.b)));
    // services: most connected first
    const weight = (s: string) => pairs.reduce((sum, p) => sum + (p.a === s || p.b === s ? p.n : 0), 0);
    groups.push({ services: [...g].sort((x, y) => weight(y) - weight(x) || x.localeCompare(y)), pairs });
  }
  const sets = groups.map((g) => {
    const ids = new Set<string>();
    const sv = new Set(g.services);
    for (const [k, qs] of byPair) {
      const [a, b] = k.split('\u0000');
      if (sv.has(a) && sv.has(b)) for (const id of qs) ids.add(id);
    }
    return ids;
  });
  const progress = attempts ? answersOn(attempts, sets) : undefined;
  return groups
    .map((g, i) => {
      const out: ConfusableGroup = { id: slug(g.services), services: g.services, questions: sets[i].size, pairs: g.pairs };
      if (g.pairs.some((p) => p.confused)) out.confused = true;
      if (progress) out.learner = progressOf(progress[i]);
      return out;
    })
    .sort((a, b) => Number(!!b.confused) - Number(!!a.confused) || b.questions - a.questions || a.id.localeCompare(b.id));
}

// ── one pair (GET /api/pairs/compare) ────────────────────────────────────────

const nameRes = new WeakMap<Taxonomy, { name: string; res: RegExp[] }[]>();

/** Canonical service names written plainly ("Config", "AWS Config", "Backup"): a heading rarely uses the match terms only. */
function plainNames(tax: Taxonomy): { name: string; res: RegExp[] }[] {
  let m = nameRes.get(tax);
  if (m) return m;
  m = Object.keys(tax.services).map((name) => {
    const forms = [...new Set([name, name.replace(/^(?:AWS|Amazon)\s+/, '')])].filter((n) => n.length >= 3);
    const res = forms.map((n) => new RegExp(`(?<![A-Za-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}(?![A-Za-z0-9])`, /\s/.test(n) ? 'i' : ''));
    return { name, res };
  });
  nameRes.set(tax, m);
  return m;
}

const namedMemo = new WeakMap<Taxonomy, Map<string, Set<string>>>();

/** Services and feature tags a text (a notes heading) names: match terms, plus canonical service names written plainly. */
export function termsNamedIn(text: string, tax: Taxonomy): Set<string> {
  let m = namedMemo.get(tax);
  if (!m || m.size > 20_000) namedMemo.set(tax, (m = new Map()));
  let found = m.get(text);
  if (found) return found;
  found = new Set<string>([...detectServices(text, tax), ...detectFeatures(text, tax)]);
  for (const { name, res } of plainNames(tax)) if (!found.has(name) && res.some((re) => re.test(text))) found.add(name);
  m.set(text, found);
  return found;
}

/** Practice questions + learner progress for one pair (the excerpts come from the notes, routes/pairs.ts). */
export function pairStats(bank: BankState, a: string, b: string, attempts?: readonly Attempt[]): Pick<PairCompare, 'questions' | 'progress'> {
  const set = new Set([a, b]);
  const ids = set.size === 2 ? new Set(practicePool(bank).filter((q) => competesIn(q, bank.taxonomy, set)).map((q) => q.id)) : new Set<string>();
  const oks = attempts?.length && ids.size ? answersOn(attempts, [ids])[0] : [];
  return { questions: ids.size, progress: progressOf(oks) };
}
