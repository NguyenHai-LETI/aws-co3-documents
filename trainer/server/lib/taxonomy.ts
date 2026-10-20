import fs from 'node:fs';
import YAML from 'yaml';
import { TAXONOMY_FILE } from '../config.ts';
import { detectServices } from './classify.ts';
import { DEFAULT_RUBRIC } from '../../shared/timing.ts';
import type { DomainId, Taxonomy } from '../../shared/types.ts';

let cache: { mtime: number; tax: Taxonomy } | undefined;

export function loadTaxonomy(): Taxonomy {
  const mtime = fs.statSync(TAXONOMY_FILE).mtimeMs;
  if (cache && cache.mtime === mtime) return cache.tax;
  const raw = YAML.parse(fs.readFileSync(TAXONOMY_FILE, 'utf8')) as Taxonomy;
  const tax: Taxonomy = {
    ...raw,
    timing: { ...DEFAULT_RUBRIC, ...(raw.timing ?? {}) },
    services: raw.services ?? {},
    features: raw.features ?? {},
    tasks: raw.tasks ?? [],
    keywords: raw.keywords ?? {},
  };
  cache = { mtime, tax };
  return tax;
}

const DOMAIN_ALIASES: Record<string, DomainId> = {
  secure: 'secure', security: 'secure', d1: 'secure', '1': 'secure',
  resilient: 'resilient', resilience: 'resilient', d2: 'resilient', '2': 'resilient',
  performance: 'performance', 'high-performing': 'performance', performing: 'performance', d3: 'performance', '3': 'performance',
  cost: 'cost', 'cost-optimized': 'cost', d4: 'cost', '4': 'cost',
};

export function normalizeDomain(v: string | undefined): DomainId | undefined {
  if (!v) return undefined;
  return DOMAIN_ALIASES[v.trim().toLowerCase()];
}

// ── exam scope (B5): taxonomy services marked `scope: out` = the official out-of-scope list ─────────────────

const oosMemo = new WeakMap<Taxonomy, Set<string>>();

/** Taxonomy service names the official SAA-C03 guide lists as out of scope (`scope: out`). */
export function outOfScopeSet(tax: Taxonomy): Set<string> {
  let s = oosMemo.get(tax);
  if (!s) {
    s = new Set(Object.entries(tax.services ?? {}).filter(([, d]) => d?.scope === 'out').map(([name]) => name));
    oosMemo.set(tax, s);
  }
  return s;
}

/** Out-of-scope services named in `text` (same match rules as `services` tagging; longest match wins on overlaps). */
export function outOfScopeIn(text: string, tax: Taxonomy): string[] {
  const oos = outOfScopeSet(tax);
  if (!oos.size || !text) return [];
  return detectServices(text, tax).filter((name) => oos.has(name));
}
