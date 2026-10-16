import fs from 'node:fs';
import YAML from 'yaml';
import { TAXONOMY_FILE } from '../config.ts';
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
