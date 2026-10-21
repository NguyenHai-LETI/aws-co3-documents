// [v5 γ1] Sibling clusters: questions that test the same thing in other words — the single definition of "siblings"
// (sealed-form eligibility, selection: one question per cluster per session + bury today's siblings + sibling
// substitution, the transfer metric, twins targets, the Bank's "nhóm anh em").
//
// Links between two non-retired questions (retired questions are nobody's sibling):
//   variant    — `variant_of` in either direction (explicit; always merged)
//   duplicate  — lexical near-duplicates (stem + correct option: significant words ≥ 0.8 or word trigrams ≥ 0.6, quality.ts)
//   semantic   — semantic duplicates from the local embedding job (embeddings.ts, when quality.embeddings is on)
//   same-key   — same topic + same correct-option text + stem word overlap (Jaccard of words ≥ 3 letters) ≥ 0.25
//   similar    — stem word overlap ≥ 0.5 AND (same topic or same correct-option text)
// Anti-chaining (plain union-find would chain templated stems into one giant cluster):
//   • `similar` needs the same topic or the same key: short boilerplate ("Which two are TRUE about …? (Choose TWO)")
//     overlaps ≥ 0.5 across unrelated topics;
//   • hub guard: a question with more than CLUSTER_RULES.hubMax textual partners has templated text — none of its
//     textual links count (its `variant_of` links still do); so has one whose stem overlaps ≥ 0.25 with more than
//     JOIN_CAPS.maxPartners stems (or whose probe meets more than JOIN_CAPS.maxCandidates candidates): the similarity join
//     stops there, which keeps a templated 5,000-question bank near-linear (no 12.5 M pairs to enumerate);
//   • textual links are merged strongest first and never grow a cluster beyond CLUSTER_RULES.maxSize members.
// Real bank (2026-10-20, 748 questions): 133 clusters holding 287 questions, max 5 (five rephrasings of "centralized
// backups → AWS Backup"); plain union-find without the guards gave a 6-question chain of unrelated "Which two are TRUE …".
// No question of the existing sealed forms has a sibling under this definition.
// Memoized per bank object + version + semantic pairs; the computed `Question.cluster` is set for questions whose
// cluster has ≥ 2 members (absent = no sibling). Cluster id = the smallest member id.
import { CONFIG_FILE, loadConfig, type AppConfig } from '../config.ts';
import { fileSig } from './index-db.ts';
import { semanticState } from './embeddings.ts';
import { Dict, JOIN_CAPS, keyText, lexicalPairs, similarJoin, stemWords } from './similarity.ts';
import type { BankState } from './bank.ts';
import type { Question } from '../../shared/types.ts';

export const CLUSTER_RULES = {
  similarStem: 0.5, // stem word overlap that links two questions (same topic or same key)
  sameKeyStem: 0.25, // …or this much with the same topic and the same correct option text (rephrased V1/V2 twins)
  hubMax: 8, // a question resembling more questions than this is templated text, not a sibling
  maxSize: 6, // textual links never grow a cluster beyond this
};

export type ClusterLinkKind = 'variant' | 'duplicate' | 'semantic' | 'same-key' | 'similar';

export interface ClusterLink {
  id: string; // the other question
  kinds: ClusterLinkKind[];
  score: number; // 0..1 strength of the evidence (variant_of = 1)
}

export interface ClusterIndex {
  version: string; // bank version the index was built from
  of: Map<string, string>; // question id → cluster id (every question; a singleton or a retired question is its own cluster)
  members: Map<string, string[]>; // cluster id → question ids, stable order (bank order)
  links: Map<string, ClusterLink[]>; // question id → direct links inside its cluster (Bank: why they are siblings)
}

type Q = Pick<Question, 'id' | 'stem' | 'options' | 'answer' | 'variantOf' | 'status'> & { topic?: string };

interface Edge {
  a: number;
  b: number;
  kinds: Set<ClusterLinkKind>;
  score: number;
}

/**
 * Clusters of `questions` (output in input order) with extra duplicate pairs (semantic). Pure: no I/O.
 * Unknown ids in `pairs` and links to retired questions are ignored.
 */
export function buildClusters(questions: readonly Q[], pairs: readonly { a: string; b: string; score?: number }[] = [], version = ''): ClusterIndex {
  const live: number[] = [];
  questions.forEach((q, i) => {
    if (q.status !== 'retired') live.push(i);
  });
  const pos = new Map<string, number>(); // id → index in `questions` (first wins)
  questions.forEach((q, i) => {
    if (!pos.has(q.id)) pos.set(q.id, i);
  });
  const isLive = (i: number | undefined): i is number => i !== undefined && questions[i].status !== 'retired';
  const edges = new Map<string, Edge>();
  const link = (x: number, y: number, kind: ClusterLinkKind, score: number) => {
    if (x === y) return;
    const [a, b] = x < y ? [x, y] : [y, x];
    const k = `${a}|${b}`;
    const e = edges.get(k);
    if (e) {
      e.kinds.add(kind);
      e.score = Math.max(e.score, score);
    } else edges.set(k, { a, b, kinds: new Set([kind]), score });
  };

  // explicit links
  for (const i of live) {
    for (const v of questions[i].variantOf ?? []) {
      const j = pos.get(v);
      if (isLive(j)) link(i, j, 'variant', 1);
    }
  }
  for (const p of pairs) {
    const [i, j] = [pos.get(p.a), pos.get(p.b)];
    if (isLive(i) && isLive(j)) link(i, j, 'semantic', Math.min(1, p.score ?? 0.9));
  }
  // textual links among the live questions
  const qs = live.map((i) => questions[i]);
  const dict = new Dict();
  const words = qs.map((q) => stemWords(q.stem ?? '', dict));
  const keys = qs.map((q) => keyText(q));
  const sameTopic = (x: number, y: number) => qs[x].topic === qs[y].topic;
  const sameKey = (x: number, y: number) => !!keys[x] && keys[x] === keys[y];
  const join = similarJoin(words, CLUSTER_RULES.sameKeyStem, JOIN_CAPS);
  const joinHubs = new Set([...join.hubs].map((x) => live[x])); // templated stems: over the join caps
  for (const [x, y, jac] of join.pairs) {
    if (jac >= CLUSTER_RULES.similarStem && (sameTopic(x, y) || sameKey(x, y))) link(live[x], live[y], 'similar', jac);
    if (sameTopic(x, y) && sameKey(x, y)) link(live[x], live[y], 'same-key', 0.5 + jac / 2);
  }
  const local = new Map(qs.map((q, x) => [q.id, x]));
  for (const p of lexicalPairs(qs)) link(live[local.get(p.a)!], live[local.get(p.b)!], 'duplicate', p.score);

  // hub guard: count textual partners
  const textual = (e: Edge) => [...e.kinds].some((k) => k !== 'variant');
  const partners = new Map<number, number>();
  for (const e of edges.values()) {
    if (!textual(e)) continue;
    partners.set(e.a, (partners.get(e.a) ?? 0) + 1);
    partners.set(e.b, (partners.get(e.b) ?? 0) + 1);
  }
  const hub = (i: number) => joinHubs.has(i) || (partners.get(i) ?? 0) > CLUSTER_RULES.hubMax;
  const usable = (e: Edge): Edge | undefined => {
    if (!hub(e.a) && !hub(e.b)) return e;
    return e.kinds.has('variant') ? { ...e, kinds: new Set<ClusterLinkKind>(['variant']), score: 1 } : undefined;
  };

  // union-find: variant_of first (no cap), then textual links strongest first, capped
  const parent = questions.map((_, i) => i);
  const size = questions.map(() => 1);
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  const unite = (x: number, y: number, cap: number): void => {
    let [a, b] = [find(x), find(y)];
    if (a === b || size[a] + size[b] > cap) return;
    if (size[a] < size[b]) [a, b] = [b, a];
    parent[b] = a;
    size[a] += size[b];
  };
  const kept = [...edges.values()].map(usable).filter((e): e is Edge => !!e);
  for (const e of kept) if (e.kinds.has('variant')) unite(e.a, e.b, Infinity);
  const ids = (e: Edge) => `${questions[e.a].id}|${questions[e.b].id}`;
  const rest = kept.filter((e) => !e.kinds.has('variant')).sort((p, q) => q.score - p.score || (ids(p) < ids(q) ? -1 : ids(p) > ids(q) ? 1 : 0));
  for (const e of rest) unite(e.a, e.b, CLUSTER_RULES.maxSize);

  // ids: the smallest member id; members in input order
  const groups = new Map<number, string[]>();
  questions.forEach((q, i) => {
    if (pos.get(q.id) !== i) return; // a duplicate id (the bank reports it) keeps the first copy
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(q.id);
    else groups.set(r, [q.id]);
  });
  const of = new Map<string, string>();
  const members = new Map<string, string[]>();
  for (const g of groups.values()) {
    const cid = g.reduce((m, id) => (id < m ? id : m), g[0]);
    members.set(cid, g);
    for (const id of g) of.set(id, cid);
  }
  const links = new Map<string, ClusterLink[]>();
  for (const e of kept) {
    if (find(e.a) !== find(e.b)) continue; // a capped link that did not make it
    const kinds = [...e.kinds].sort();
    const score = Math.round(e.score * 100) / 100;
    for (const [x, y] of [
      [e.a, e.b],
      [e.b, e.a],
    ]) {
      const l = links.get(questions[x].id);
      const item = { id: questions[y].id, kinds, score };
      if (l) l.push(item);
      else links.set(questions[x].id, [item]);
    }
  }
  for (const l of links.values()) l.sort((p, q) => q.score - p.score || (p.id < q.id ? -1 : 1));
  return { version, of, members, links };
}

// ── memo per bank ───────────────────────────────────────────────────────────

let cfgMemo: { sig: string; cfg: AppConfig } | undefined;
/** config.yaml re-read only when the file changes (clusterIndex runs on every bank load). */
function currentConfig(): AppConfig {
  const sig = fileSig(CONFIG_FILE);
  if (!cfgMemo || cfgMemo.sig !== sig) cfgMemo = { sig, cfg: loadConfig() };
  return cfgMemo.cfg;
}

const memo = new WeakMap<object, { key: string; index: ClusterIndex }>();

/**
 * Clusters of the bank (semantic pairs of the embedding job included when it is on). Memoized per bank object, bank
 * version and semantic pairs; sets the computed `Question.cluster` on the bank's questions.
 */
export function clusterIndex(bank: Pick<BankState, 'version' | 'questions'>): ClusterIndex {
  const pairs = semanticState(currentConfig()).pairs;
  const key = `${bank.version}|${pairs.map((p) => `${p.a}~${p.b}`).join(',')}`;
  const hit = memo.get(bank);
  if (hit && hit.key === key) return hit.index;
  const index = buildClusters(bank.questions, pairs, bank.version);
  for (const q of bank.questions) {
    const cid = index.of.get(q.id);
    if (cid && (index.members.get(cid)?.length ?? 0) > 1) q.cluster = cid;
    else delete q.cluster;
  }
  memo.set(bank, { key, index });
  return index;
}

/** Other members of the cluster of `id` (empty for a singleton or an unknown id). */
export function siblingsOf(index: ClusterIndex, id: string): string[] {
  const c = index.of.get(id);
  return c ? (index.members.get(c) ?? []).filter((x) => x !== id) : [];
}

/** Ids of every question that has at least one sibling. */
export function clusteredIds(index: ClusterIndex): Set<string> {
  const out = new Set<string>();
  for (const m of index.members.values()) if (m.length > 1) for (const id of m) out.add(id);
  return out;
}
