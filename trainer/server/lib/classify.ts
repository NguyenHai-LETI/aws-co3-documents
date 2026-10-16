// Heuristics used by the importer (and as hints by the validator) to tag questions with
// AWS services, concept tags and an exam domain. The AI coach can refine tags later.
import type { DomainId, Taxonomy } from '../../shared/types.ts';

interface Matcher {
  name: string;
  topic?: string;
  re: RegExp;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegex(pattern: string, caseSensitive: boolean): RegExp {
  const prefix = pattern.endsWith('*');
  const core = prefix ? pattern.slice(0, -1) : pattern;
  const body = escapeRe(core).replace(/\s+/g, '\\s+');
  const tail = prefix ? '[A-Za-z0-9-]*' : '(?![A-Za-z0-9])';
  return new RegExp(`(?<![A-Za-z0-9])${body}${tail}`, caseSensitive ? 'g' : 'gi');
}

const matcherCache = new WeakMap<Taxonomy, { services: Matcher[]; features: Matcher[] }>();

function matchers(tax: Taxonomy) {
  let m = matcherCache.get(tax);
  if (m) return m;
  const services: Matcher[] = [];
  for (const [name, def] of Object.entries(tax.services)) {
    for (const p of def.match ?? []) {
      // single-word service names are proper nouns → case-sensitive; phrases are not
      services.push({ name, topic: def.topic, re: buildRegex(p, !/\s/.test(p.replace(/\*$/, ''))) });
    }
  }
  const features: Matcher[] = [];
  for (const [name, patterns] of Object.entries(tax.features)) {
    for (const p of patterns ?? []) {
      const core = p.replace(/\*$/, '');
      const acronym = /^[A-Z0-9-]+$/.test(core) && /[A-Z]/.test(core);
      features.push({ name, re: buildRegex(p, acronym) });
    }
  }
  m = { services, features };
  matcherCache.set(tax, m);
  return m;
}

interface Hit {
  name: string;
  start: number;
  end: number;
}

/** Return matcher names found in `text`, longest match wins on overlaps, ordered by position. */
function detect(text: string, list: Matcher[]): string[] {
  const hits: Hit[] = [];
  for (const m of list) {
    m.re.lastIndex = 0;
    for (const x of text.matchAll(m.re)) {
      hits.push({ name: m.name, start: x.index ?? 0, end: (x.index ?? 0) + x[0].length });
    }
  }
  hits.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const taken: Hit[] = [];
  for (const h of hits) {
    if (taken.some((t) => h.start < t.end && t.start < h.end && t.name !== h.name)) continue;
    taken.push(h);
  }
  taken.sort((a, b) => a.start - b.start);
  return [...new Set(taken.map((h) => h.name))];
}

export function detectServices(text: string, tax: Taxonomy): string[] {
  return detect(text, matchers(tax).services);
}

export function detectFeatures(text: string, tax: Taxonomy): string[] {
  return detect(text, matchers(tax).features);
}

export function serviceTopic(service: string, tax: Taxonomy): string | undefined {
  return tax.services[service]?.topic;
}

/** Majority topic of the given services (first one wins ties). */
export function topicFromServices(services: string[], tax: Taxonomy): string | undefined {
  const count = new Map<string, number>();
  for (const s of services) {
    const t = serviceTopic(s, tax);
    if (t) count.set(t, (count.get(t) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [t, n] of count) if (n > bestN) [best, bestN] = [t, n];
  return best;
}

const DOMAIN_RULES: Record<DomainId, [RegExp, number][]> = {
  cost: [
    [/\bcost[- ]effective(ly)?\b/i, 6],
    [/\b(MOST|LEAST)\s+(cost|expensive)/i, 6],
    [/\bcheap(est|er)?\b/i, 5],
    [/\b(lowest|lower|reduce|reducing|minimi[sz]e|optimi[sz]e|cut|save|saving)\s+(the\s+)?(storage\s+|compute\s+|data transfer\s+)?(cost|costs|spend|bill)/i, 6],
    [/\bcosts?\b/i, 2],
    [/\b(pricing|budget|billing|discount|upfront)\b/i, 2],
  ],
  secure: [
    [/\bsecur(e|ely|ity)\b/i, 3],
    [/\bencrypt/i, 3],
    [/\bleast[- ]privilege/i, 4],
    [/\b(permission|authori[sz]|authenticat|credential|access keys?|secret)/i, 2],
    [/\b(complian|audit|regulat|governance)/i, 2],
    [/\b(attack|DDoS|malicious|threat|vulnerab|unauthori[sz]ed|exploit|injection|compromised)/i, 3],
    [/\b(IAM|KMS|WAF|MFA|SCPs?)\b|Cognito|GuardDuty|Macie|Inspector|Shield|Secrets Manager|CloudHSM|Firewall/, 2],
    [/\b(private(ly)?|not (be )?exposed|without (traversing|going over) the (public )?internet)\b/i, 1],
  ],
  resilient: [
    [/\bhighly available|high availability\b/i, 4],
    [/\bfault[- ]toleran/i, 4],
    [/\b(failover|fail over|outage|disaster|RTO|RPO|resilien|durab|redundan)/i, 3],
    [/\brecover/i, 2],
    [/\bMulti-AZ\b|\bmulti-Region\b|\bcross-Region\b|\banother Region\b/i, 2],
    [/\b(backup|back up|restore|replicat)/i, 2],
    [/\b(decoupl|loosely coupled|retry|retries|dead-letter|DLQ|lost|losing|loss)/i, 3],
    [/\bsurviv/i, 3],
  ],
  performance: [
    [/\b(performance|performant|latency|throughput|IOPS)\b/i, 3],
    [/\b(fast(er|est)?|quick(ly)?|speed|accelerat)/i, 2],
    [/\b(cach(e|ing)|in-memory)\b/i, 2],
    [/\b(scal(e|es|ing|able)|elastic(ally)?)\b/i, 1],
    [/\b(real[- ]time|milliseconds?|microseconds?|low[- ]latency)/i, 3],
    [/\b(read-heavy|spiky|burst|HPC|high-performance|concurren)/i, 2],
  ],
};

const DOMAIN_ORDER: DomainId[] = ['cost', 'secure', 'resilient', 'performance'];

/** Keyword scoring; `fallback` gets a bonus so ambiguous questions lean towards the chapter's domain. */
export function classifyDomain(text: string, fallback: DomainId, fallbackBonus = 1): DomainId {
  const scores = new Map<DomainId, number>();
  for (const d of DOMAIN_ORDER) {
    let s = d === fallback ? fallbackBonus : 0;
    for (const [re, w] of DOMAIN_RULES[d]) if (re.test(text)) s += w;
    scores.set(d, s);
  }
  let best = fallback;
  let bestScore = scores.get(fallback) ?? 0;
  for (const d of DOMAIN_ORDER) {
    const s = scores.get(d) ?? 0;
    if (s > bestScore) [best, bestScore] = [d, s];
  }
  return best;
}
