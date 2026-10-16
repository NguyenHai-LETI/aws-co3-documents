import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PACKS_DIR, TAXONOMY_FILE, rel } from '../config.ts';
import { loadTaxonomy } from './taxonomy.ts';
import { parsePack, type ParsedPack } from './pack-format.ts';
import type { BankProblem, Pack, Question, Taxonomy } from '../../shared/types.ts';

export interface BankState {
  version: string;
  taxonomy: Taxonomy;
  packs: Pack[];
  questions: Question[];
  byId: Map<string, Question>;
  problems: BankProblem[];
}

const fileCache = new Map<string, { sig: string; parsed: ParsedPack }>();
let bankCache: BankState | undefined;

export function listMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listMarkdownFiles(p));
    else if (e.isFile() && e.name.endsWith('.md') && e.name.toLowerCase() !== 'readme.md') out.push(p);
  }
  return out.sort();
}

/** Loads every pack, re-parsing only files whose mtime/size changed. Cheap enough to call per request. */
export function loadBank(): BankState {
  const tax = loadTaxonomy();
  const taxSig = String(fs.statSync(TAXONOMY_FILE).mtimeMs);
  const files = listMarkdownFiles(PACKS_DIR);
  const sigs = files.map((f) => {
    const st = fs.statSync(f);
    return `${f}:${st.mtimeMs}:${st.size}`;
  });
  const version = crypto.createHash('sha1').update(taxSig + '|' + sigs.join('|')).digest('hex').slice(0, 12);
  if (bankCache && bankCache.version === version) return bankCache;

  const packs: Pack[] = [];
  const questions: Question[] = [];
  const byId = new Map<string, Question>();
  const problems: BankProblem[] = [];
  const packIds = new Map<string, string>();

  files.forEach((abs, i) => {
    const sig = `${taxSig}|${sigs[i]}`;
    let entry = fileCache.get(abs);
    if (!entry || entry.sig !== sig) {
      entry = { sig, parsed: parsePack(fs.readFileSync(abs, 'utf8'), rel(abs), tax) };
      fileCache.set(abs, entry);
    }
    const { pack, questions: qs, problems: pr } = entry.parsed;
    problems.push(...pr);
    const dupPack = packIds.get(pack.id);
    if (dupPack) problems.push({ level: 'error', file: pack.file, line: 1, message: `Duplicate pack id "${pack.id}" (also in ${dupPack})` });
    packIds.set(pack.id, pack.file);
    let kept = 0;
    for (const q of qs) {
      const prev = byId.get(q.id);
      if (prev) {
        problems.push({ level: 'error', file: q.file, line: q.line, qid: q.id, message: `Duplicate question id (first defined in ${prev.file}:${prev.line}) — this copy is ignored` });
        continue;
      }
      byId.set(q.id, q);
      questions.push(q);
      kept++;
    }
    packs.push({ ...pack, count: kept, activeCount: qs.filter((q) => q.status === 'active' && byId.get(q.id) === q).length });
  });

  for (const q of questions) {
    for (const v of q.variantOf) {
      if (!byId.has(v)) problems.push({ level: 'warning', file: q.file, line: q.line, qid: q.id, message: `variant_of "${v}" does not exist` });
    }
  }
  for (const [abs] of fileCache) if (!files.includes(abs)) fileCache.delete(abs);

  bankCache = { version, taxonomy: tax, packs, questions, byId, problems };
  return bankCache;
}

export function activeQuestions(bank: BankState): Question[] {
  return bank.questions.filter((q) => q.status === 'active');
}
