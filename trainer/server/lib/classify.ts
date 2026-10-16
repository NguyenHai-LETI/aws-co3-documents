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


// ── Exam-guide task statements (1.1 … 4.4) ──────────────────────────────────
// Heuristic only (the ENRICH routine refines it with AI). The domain picks the task family; then
// performance/cost use the service family of the correct option(s) first, then the stem, then the
// metadata; secure/resilient score cue words/services/tags (resilient weighs the stem's requirement
// wording — "highly available" vs "decouple" — more, because the options mostly name services).

export interface TaskInput {
  stem: string;
  options: { key: string; text: string }[];
  answer: string[];
  domain: string;
  topic?: string;
  services?: string[];
  tags?: string[];
}

/** Coarse service family used for the performance (3.x) and cost (4.x) tasks. */
type Kind = 'storage' | 'compute' | 'integration' | 'database' | 'network' | 'api' | 'analytics' | 'migration';

const KIND_BY_TOPIC: Record<string, Kind> = {
  storage: 'storage',
  compute: 'compute',
  integration: 'integration',
  database: 'database',
  networking: 'network',
  api: 'api',
  analytics: 'analytics',
  migration: 'migration',
};

// services whose taxonomy topic is too coarse (or "other") for the task mapping
const KIND_BY_SERVICE: Record<string, Kind> = {
  'AWS Backup': 'storage',
  'Storage Gateway': 'storage',
  DMS: 'database',
  SCT: 'database',
  EMR: 'compute',
  'Local Zones': 'network',
  Wavelength: 'network',
  Outposts: 'compute',
  WorkSpaces: 'compute',
  'AppStream 2.0': 'compute',
  'IoT Core': 'analytics',
  'Compute Optimizer': 'compute',
};

const KIND_BY_TAG: [RegExp, Kind][] = [
  [/^(s3-|sse-|ebs-|fsx-|sgw-|snapshots$|instance-store$|client-side-encryption$)/, 'storage'],
  [/^(spot-|reserved-|savings-|on-demand-|dedicated-|capacity-|placement-|efa$|ec2-|launch-|asg-|scaling-|user-data$|ami$|lambda-|right-sizing$|serverless-cost$)/, 'compute'],
  [/^(sqs-|sns-|fan-out$|decoupling$|orchestration$|event-driven$)/, 'integration'],
  [/^(multi-az$|read-replicas$|aurora-|dynamodb-|ttl$|pitr$|automated-backups$|db-|iam-db-auth$|connection-pooling$|caching-strategies$|redis-vs-memcached$|sharding$)/, 'database'],
  [/^(subnets$|security-groups$|nacl$|egress-only-igw$|elastic-ip$|ipv6$|hybrid-dns$|vpc-sharing$|dx-|route53-|alias-records$|cloudfront-|signed-urls-cookies$|elb-|tls-termination$|data-transfer-cost$)/, 'network'],
  [/^(streaming-ingestion$|data-lake$|etl$|columnar-formats$|redshift-spectrum$|kinesis-)/, 'analytics'],
  [/^(cdc-replication$|heterogeneous-migration$|offline-transfer$)/, 'migration'],
];

const KIND_WORDS: [Kind, RegExp][] = [
  ['storage', /\b(storage class(es)?|object storage|file (system|share)s?|block storage|archiv\w*|buckets?|volumes?|IOPS|lifecycle)\b/i],
  ['compute', /\b(instances?|servers?|compute|vCPUs?|containers?|fleet|Spot|Reserved|Savings Plans?|batch jobs?|functions?)\b/i],
  ['database', /\b(databases?|DB|tables?|SQL|NoSQL|relational|read replicas?|cach(e|ing)|key-value|queries)\b/i],
  ['network', /\b(latency|edge locations?|CDN|global(ly)? (users|customers|audience)|DNS|bandwidth|data transfer|egress|NAT|VPCs?|load balanc\w+|connectivity)\b/i],
  ['analytics', /\b(stream(s|ing)?|ingest\w*|real[- ]time|clickstreams?|ETL|transform\w*|data lakes?|analytics|big data|dashboards?)\b/i],
  ['migration', /\b(migrat\w+|transfer (\d+ )?(TB|PB|terabytes|petabytes)|on-premises data)\b/i],
];

const TASK_BY_KIND: Record<'performance' | 'cost', Record<Kind, string>> = {
  performance: { storage: '3.1', compute: '3.2', integration: '3.2', database: '3.3', network: '3.4', api: '3.4', analytics: '3.5', migration: '3.5' },
  cost: { storage: '4.1', compute: '4.2', integration: '4.2', api: '4.2', database: '4.3', network: '4.4', migration: '4.4', analytics: '4.1' },
};
const KIND_PRIORITY: Kind[] = ['compute', 'storage', 'database', 'network', 'analytics', 'migration', 'integration', 'api'];

interface TaskCue {
  task: string;
  services: string[];
  tags: RegExp;
  words: RegExp; // must use the `g` flag (counted with String#match)
}

const SECURE_CUES: TaskCue[] = [
  {
    task: '1.3',
    services: ['KMS', 'CloudHSM', 'Macie', 'ACM', 'AWS Backup', 'Lake Formation'],
    tags: /^(sse-|client-side-encryption$|envelope-encryption$|key-rotation$|encryption-|s3-object-lock$|db-encryption$|s3-versioning$|pitr$|automated-backups$)/,
    words: /\b(en|de)crypt\w*|\bKMS\b|CloudHSM|Macie|\bACM\b|Certificate Manager|\bSSE-[A-Z]+|key rotation|rotat\w+ (the )?(encryption )?keys?|customer[- ]managed keys?|Object Lock|\bWORM\b|Vault Lock|MFA Delete|retention|retain\w*|sensitive data|\bPII\b|personally identifiable|classif\w+ (the )?data|\bTLS\b|\bSSL\b|\bHTTPS\b|in transit|at rest|complian\w+|governance|(column|row)[- ]level/gi,
  },
  {
    task: '1.1',
    services: ['IAM', 'IAM Identity Center', 'STS', 'Organizations', 'Control Tower', 'RAM', 'Directory Service'],
    tags: /^(iam-roles$|iam-policies$|permission-boundaries$|scp$|least-privilege$|mfa$|cross-account-access$|federation$)/,
    words: /\bIAM\b|\bSTS\b|AssumeRole|\bOrganizations\b|\bSCPs?\b|service control polic\w*|federat\w*|\bSAML\b|\bOIDC\b|cross-account|\bMFA\b|multi-factor|Identity Center|single sign-on|\bSSO\b|Resource Access Manager|AWS RAM|least[- ]privilege|permissions? boundar\w*|root user|access keys?|identity provider|Active Directory|Control Tower/gi,
  },
  {
    task: '1.2',
    services: ['WAF', 'Shield', 'GuardDuty', 'Inspector', 'Cognito', 'Secrets Manager', 'Network Firewall', 'Firewall Manager', 'Security Hub', 'Detective', 'PrivateLink', 'VPC Endpoint'],
    tags: /^(security-groups$|nacl$|ddos-protection$|web-attacks$|threat-detection$|bastion-host$|cloudfront-origin-security$|signed-urls-cookies$|s3-presigned-url$)/,
    words: /\bWAF\b|\bShield\b|GuardDuty|Inspector|Cognito|Secrets Manager|Parameter Store|security groups?|network ACLs?|\bNACLs?\b|DDoS|SQL injection|cross-site scripting|\bXSS\b|bastion|VPC endpoints?|PrivateLink|Network Firewall|Firewall Manager|malicious|threats?|vulnerabilit\w+|credentials?|pre-?signed|signed (URL|cookie)s?|Origin Access/gi,
  },
];

const RESILIENT_CUES: TaskCue[] = [
  {
    task: '2.1',
    services: ['SQS', 'SNS', 'EventBridge', 'Step Functions', 'Amazon MQ', 'SWF', 'API Gateway', 'Lambda', 'Fargate', 'ECS', 'EKS', 'App Runner', 'EC2 Auto Scaling'],
    tags: /^(decoupling$|fan-out$|sqs-|sns-|event-driven$|orchestration$|lambda-concurrency$|scaling-policies$|asg-)/,
    words: /decoupl\w*|loosely coupled|queues?\b|queuing|asynchronous(ly)?|event-driven|fan[- ]?out|publish|subscri\w+|serverless|Auto Scaling|scal(e|es|ing) (out|in|automatically|horizontally)|horizontal(ly)? scal\w*|scalab\w+|stateless|microservices?|buffer\w*|spik(e|es|y)|bursts?|overwhelm\w*|workflows?|orchestrat\w*/gi,
  },
  {
    task: '2.2',
    services: ['Route 53', 'AWS Backup', 'Elastic Disaster Recovery', 'RDS Proxy'],
    tags: /^(multi-az$|multi-region$|aurora-global-database$|dynamodb-global-tables$|pitr$|automated-backups$|snapshots$|dr-|rto-rpo$|high-availability$|route53-health-checks$|s3-replication$|dx-resiliency$)/,
    words: /highly available|high availability|toleran\w*|failover|fail over|failures?|disaster|\bDR\b|\bRTO\b|\bRPO\b|backups?\b|restore|snapshots?|replicat\w*|Multi-AZ|Availability Zones?|\bAZs?\b|multi-Region|cross-Region|another Region|second(ary)? Region|outage|surviv\w*|redundan\w*|durab\w*|pilot light|warm standby|active[- ](active|passive)|health checks?|self-heal\w*|recover\w*/gi,
  },
];

interface Layer {
  text: string;
  services: string[];
  lead: string[]; // first-named service of each text part (counts more)
  tags: string[];
  topic?: string;
  weight: number; // multiplier for services/tags (the metadata layer counts less)
  wordWeight: number; // multiplier for cue words
}

function kindOfService(name: string, tax: Taxonomy): Kind | undefined {
  return KIND_BY_SERVICE[name] ?? KIND_BY_TOPIC[tax.services[name]?.topic ?? ''];
}

function kindOfTag(tag: string): Kind | undefined {
  return KIND_BY_TAG.find(([re]) => re.test(tag))?.[1];
}

function scoreKinds(layer: Layer, tax: Taxonomy): Map<Kind, number> {
  const s = new Map<Kind, number>();
  const add = (k: Kind | undefined, w: number) => {
    if (k) s.set(k, (s.get(k) ?? 0) + w);
  };
  for (const name of layer.services) add(kindOfService(name, tax), (layer.lead.includes(name) ? 3 : 2) * layer.weight);
  for (const t of layer.tags) add(kindOfTag(t), layer.weight);
  if (layer.text) for (const [k, re] of KIND_WORDS) if (re.test(layer.text)) add(k, 0.5 * layer.wordWeight);
  if (layer.topic) add(KIND_BY_TOPIC[layer.topic], 1);
  return s;
}

function scoreCues(layer: Layer, cues: TaskCue[]): Map<string, number> {
  const s = new Map<string, number>();
  for (const c of cues) {
    let n = 0;
    for (const name of layer.services) if (c.services.includes(name)) n += 2 * layer.weight;
    for (const t of layer.tags) if (c.tags.test(t)) n += layer.weight;
    const hits = layer.text ? (layer.text.match(c.words)?.length ?? 0) : 0;
    if (hits) n += (1 + Math.min(2, hits - 1) * 0.5) * layer.wordWeight; // 1st cue word 1, each extra 0.5 (max +1)
    if (n) s.set(c.task, n);
  }
  return s;
}

/** Unique best key of a score map (restricted to `pool`), or the tied best keys. */
function best<K>(scores: Map<K, number>, pool?: K[]): K[] {
  let out: K[] = [];
  let max = 0;
  for (const k of pool ?? [...scores.keys()]) {
    const v = scores.get(k) ?? 0;
    if (v > max) [out, max] = [[k], v];
    else if (v === max && v > 0) out.push(k);
  }
  return out;
}

/** The first layer with a unique best candidate wins; ties carry over (restricted) to the next layer. */
function decide<K>(scored: Map<K, number>[], priority: K[]): K | undefined {
  let candidates: K[] | undefined;
  for (const scores of scored) {
    const top = best(scores, candidates);
    if (top.length === 1) return top[0];
    if (top.length > 1) candidates = top;
  }
  return candidates ? (priority.find((k) => candidates.includes(k)) ?? candidates[0]) : undefined;
}

function sum<K>(...maps: Map<K, number>[]): Map<K, number> {
  const out = new Map<K, number>();
  for (const m of maps) for (const [k, v] of m) out.set(k, (out.get(k) ?? 0) + v);
  return out;
}

/**
 * Best-guess exam-guide task statement (`task` metadata, taxonomy.yaml → tasks) for a question.
 * Undefined when the domain is unknown or the taxonomy has no tasks for it.
 */
export function guessTask(q: TaskInput, tax: Taxonomy): string | undefined {
  const domain = q.domain as DomainId;
  const valid = (tax.tasks ?? []).filter((t) => t.domain === domain).map((t) => t.id);
  if (!valid.length) return undefined;
  // correct options sorted by text: the result must not depend on the option order (answer rebalance)
  const correctTexts = q.options.filter((o) => q.answer.includes(o.key)).map((o) => o.text).sort();
  const perOption = correctTexts.map((t) => detectServices(t, tax));
  const correctText = correctTexts.join('\n');
  const correct: Layer = {
    text: correctText,
    services: [...new Set(perOption.flat())],
    lead: perOption.map((x) => x[0]).filter(Boolean),
    tags: detectFeatures(correctText, tax),
    weight: 1,
    wordWeight: 1,
  };
  const stemServices = detectServices(q.stem, tax);
  const stem: Layer = { text: q.stem, services: stemServices, lead: stemServices.slice(0, 1), tags: detectFeatures(q.stem, tax), weight: 1, wordWeight: 1 };
  const meta: Layer = { text: '', services: q.services ?? [], lead: (q.services ?? []).slice(0, 1), tags: q.tags ?? [], topic: q.topic, weight: 0.5, wordWeight: 0 };
  let task: string | undefined;
  if (domain === 'secure') {
    task = decide([correct, stem, meta].map((l) => scoreCues(l, SECURE_CUES)), ['1.3', '1.1', '1.2']) ?? '1.2';
  } else if (domain === 'resilient') {
    const options = scoreCues(correct, RESILIENT_CUES);
    const requirement = scoreCues({ ...stem, wordWeight: 2 }, RESILIENT_CUES);
    task = decide([sum(options, requirement), scoreCues(meta, RESILIENT_CUES)], ['2.1', '2.2']) ?? (q.topic === 'integration' ? '2.1' : '2.2');
  } else if (domain === 'performance' || domain === 'cost') {
    const kind = decide([correct, stem, meta].map((l) => scoreKinds(l, tax)), KIND_PRIORITY);
    task = kind ? TASK_BY_KIND[domain][kind] : domain === 'performance' ? '3.2' : '4.2';
  }
  return task && valid.includes(task) ? task : valid[0];
}
