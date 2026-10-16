import YAML from 'yaml';

export interface FrontMatter {
  data: Record<string, unknown>;
  body: string;
  /** 1-based line number of the first body line in the original text. */
  bodyLine: number;
  error?: string;
  hasFrontMatter: boolean;
}

export function splitFrontMatter(text: string): FrontMatter {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!src.startsWith('---\n')) return { data: {}, body: src, bodyLine: 1, hasFrontMatter: false };
  const end = src.indexOf('\n---', 4);
  if (end < 0) return { data: {}, body: src, bodyLine: 1, error: 'Front matter is not closed with ---', hasFrontMatter: false };
  const yamlText = src.slice(4, end);
  const afterFence = src.indexOf('\n', end + 1);
  const body = afterFence < 0 ? '' : src.slice(afterFence + 1);
  const bodyLine = yamlText.split('\n').length + 3;
  try {
    const parsed = YAML.parse(yamlText);
    const data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    return { data, body, bodyLine, hasFrontMatter: true };
  } catch (e) {
    return { data: {}, body, bodyLine, error: `Invalid YAML front matter: ${(e as Error).message.split('\n')[0]}`, hasFrontMatter: true };
  }
}

/**
 * Serialize front matter. Arrays listed in `flowItems` are written one flow-map per line,
 * e.g. `answers:` → `  - { q: "03-v2-001", pick: B, ok: true }`, which keeps result files compact.
 */
export function stringifyFrontMatter(data: Record<string, unknown>, flowItems: string[] = []): string {
  const doc = new YAML.Document(data);
  for (const key of flowItems) {
    const seq = doc.get(key, true);
    if (YAML.isSeq(seq)) {
      for (const item of seq.items) if (YAML.isMap(item)) item.flow = true;
    }
  }
  return `---\n${doc.toString({ lineWidth: 0, flowCollectionPadding: true })}---\n`;
}

export function asString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export function asStringList(v: unknown): string[] {
  if (v === undefined || v === null || v === '') return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}
