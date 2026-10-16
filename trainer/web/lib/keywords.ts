// Keyword highlighting for question stems ("read the qualifier" aid — MOST/LEAST/NOT, cost, ops, HA…).
// Categories and phrases come from taxonomy.yaml → keywords (served as meta.keywords).
//
// Matching rules: one regex for all phrases, longest phrase first, whole words only.
// A word written in ALL CAPS (MOST, NOT, RPO…) is case-sensitive; every other word is case-insensitive,
// so "MOST cost-effective" needs the capitalised MOST but any casing of "cost-effective".
// A trailing `*` means prefix match (decoupl* → decouple, decoupled, decoupling).

export type KeywordMap = Record<string, string[]>;

interface Matcher {
  re: RegExp | null;
  cats: string[]; // capture group i+1 → category
}

/** Vietnamese labels for the legend; unknown categories fall back to their id. */
export const KEYWORD_LABELS: Record<string, string> = {
  qualifier: 'Từ hạn định (MOST/LEAST/NOT…)',
  cost: 'Chi phí',
  ops: 'Vận hành',
  resilient: 'Bền vững / HA',
  performance: 'Hiệu năng',
  secure: 'Bảo mật',
};

export function keywordLabel(cat: string): string {
  return KEYWORD_LABELS[cat] ?? cat;
}

/** Category id safe for a CSS class name. */
export function keywordClass(cat: string): string {
  return cat.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'other';
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const isCapsWord = (w: string) => /^[A-Z][A-Z0-9]+$/.test(w);

function wordPattern(word: string): string {
  if (isCapsWord(word)) return escapeRe(word);
  // case-insensitive without the `i` flag: [cC][oO]… keeps ALL-CAPS words exact in the same regex
  return [...word].map((ch) => (/[a-z]/i.test(ch) ? `[${ch.toLowerCase()}${ch.toUpperCase()}]` : escapeRe(ch))).join('');
}

function phrasePattern(phrase: string): string | null {
  let p = phrase.trim();
  if (!p) return null;
  const prefix = p.endsWith('*');
  if (prefix) p = p.slice(0, -1).trim();
  const words = p.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return words.map(wordPattern).join('\\s+') + (prefix ? '[\\p{L}\\p{N}]*' : '');
}

const cache = new WeakMap<KeywordMap, Matcher>();

function matcherFor(keywords: KeywordMap): Matcher {
  const hit = cache.get(keywords);
  if (hit) return hit;
  const seen = new Set<string>();
  const entries: { phrase: string; cat: string; src: string }[] = [];
  for (const [cat, phrases] of Object.entries(keywords ?? {})) {
    for (const phrase of Array.isArray(phrases) ? phrases : []) {
      if (typeof phrase !== 'string') continue;
      const src = phrasePattern(phrase);
      const id = phrase.trim();
      if (!src || seen.has(id)) continue; // first category wins for duplicates
      seen.add(id);
      entries.push({ phrase: id, cat: keywordClass(cat), src });
    }
  }
  entries.sort((a, b) => b.phrase.length - a.phrase.length);
  let re: RegExp | null = null;
  if (entries.length) {
    try {
      re = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${entries.map((e) => `(${e.src})`).join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
    } catch {
      re = null; // malformed taxonomy entry — highlighting silently off
    }
  }
  const m = { re, cats: entries.map((e) => e.cat) };
  cache.set(keywords, m);
  return m;
}

// Content of these elements is never highlighted.
const SKIP_TAG = /^<(\/?)(code|pre|a|mark|kbd|script|style|textarea)\b/i;

/**
 * Wraps keyword matches in `<mark class="kw kw-<cat>">`. `text` is sanitized HTML (rendered Markdown)
 * or plain text without markup; only text between tags is touched. Also returns the categories found.
 */
export function highlightWithCategories(text: string, keywords: KeywordMap | null | undefined): { html: string; cats: string[] } {
  if (!text || !keywords) return { html: text ?? '', cats: [] };
  const m = matcherFor(keywords);
  const re = m.re;
  if (!re) return { html: text, cats: [] };
  const found = new Set<string>();
  const mark = (segment: string) =>
    segment.replace(re, (...args: unknown[]) => {
      const match = args[0] as string;
      let cat = 'other';
      for (let i = 0; i < m.cats.length; i++) {
        if (args[i + 1] !== undefined) {
          cat = m.cats[i];
          break;
        }
      }
      found.add(cat);
      return `<mark class="kw kw-${cat}">${match}</mark>`;
    });
  let skip = 0;
  let out = '';
  for (const part of text.split(/(<[^>]*>)/)) {
    if (!part) continue;
    if (part.startsWith('<') && part.endsWith('>')) {
      const t = SKIP_TAG.exec(part);
      if (t && !part.endsWith('/>')) skip = Math.max(0, skip + (t[1] ? -1 : 1));
      out += part;
    } else out += skip ? part : mark(part);
  }
  return { html: out, cats: [...found] };
}

/** `highlightKeywords(html, keywords)` → HTML with `<mark class="kw kw-<cat>">` around keyword matches. */
export function highlightKeywords(text: string, keywords: KeywordMap | null | undefined): string {
  return highlightWithCategories(text, keywords).html;
}
