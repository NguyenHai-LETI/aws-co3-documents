// [v5 γ1] Confusable services (C4):
//   GET /api/pairs                → ConfusableGroup[] — groups of services competing in the bank (one in the key, another in
//                                   a distractor) + the learner's confirmed confusions, with progress ("đã tách được")
//   GET /api/pairs/compare?a=&b=  → PairCompare — notes sections whose heading names both (Q-service-comparisons.md,
//                                   14-so-sanh-services.md, F-so-sanh-database-theo-dac-diem.md, M-keywords-mapping.md
//                                   first; Markdown, sealed guard as every note), practice questions where they compete,
//                                   progress over the last 10 contrast answers. Always 200: an unknown / empty pair gets
//                                   empty excerpts. a / b = taxonomy service names (or feature tags, as in ConfusionPair).
import { route } from '../http.ts';
import { context } from '../context.ts';
import { confusableGroups, pairStats, termsNamedIn } from '../lib/confusables.ts';
import { headingSections } from '../lib/search.ts';
import type { ConfusableGroup, PairCompare, Taxonomy } from '../../shared/types.ts';

const PREFERRED = ['Q-service-comparisons.md', '14-so-sanh-services.md', 'F-so-sanh-database-theo-dac-diem.md', 'M-keywords-mapping.md'];
const MAX_EXCERPTS = 4;
const MAX_CHARS = 4000;

let groupsMemo: { key: string; value: ConfusableGroup[] } | undefined;

route('GET', '/api/pairs', () => {
  const ctx = context();
  if (groupsMemo?.key !== ctx.key) groupsMemo = { key: ctx.key, value: confusableGroups(ctx.bank, ctx.attempts) };
  return groupsMemo.value;
});

/** A heading names a term: a service / feature the taxonomy recognises in it, else the term itself as a whole word. */
function names(heading: string, term: string, tax: Taxonomy, found: Set<string>): boolean {
  if (found.has(term)) return true;
  if (tax.services[term] || tax.features[term]) return false;
  const t = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${t}(?![\\p{L}\\p{N}])`, 'iu').test(heading);
}

/** Markdown cut at a line boundary. */
function clip(md: string, max = MAX_CHARS): string {
  if (md.length <= max) return md;
  const cut = md.slice(0, max);
  const at = cut.lastIndexOf('\n');
  return `${(at > max / 2 ? cut.slice(0, at) : cut).trimEnd()}\n\n…`;
}

route('GET', '/api/pairs/compare', (_req, url) => {
  const a = (url.searchParams.get('a') ?? '').trim().slice(0, 80);
  const b = (url.searchParams.get('b') ?? '').trim().slice(0, 80);
  const ctx = context();
  const empty: PairCompare = { a, b, excerpts: [], questions: 0, progress: { answers: 0, correct: 0, last10: 0, separated: false } };
  if (!a || !b || a === b) return empty;
  const tax = ctx.bank.taxonomy;
  const rank = (file: string) => {
    const i = PREFERRED.indexOf(file);
    return i < 0 ? PREFERRED.length : i;
  };
  const sections = headingSections((heading) => {
    const found = termsNamedIn(heading, tax);
    return names(heading, a, tax, found) && names(heading, b, tax, found);
  });
  const excerpts = sections
    .map((s, i) => ({ s, i }))
    .sort((x, y) => rank(x.s.file) - rank(y.s.file) || x.i - y.i)
    .slice(0, MAX_EXCERPTS)
    .map(({ s }) => ({ file: s.file, heading: s.heading, anchor: s.anchor, text: clip(s.md) }));
  return { ...empty, excerpts, ...pairStats(ctx.bank, a, b, ctx.attempts) };
});
