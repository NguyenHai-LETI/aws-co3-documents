// Read-only access to the study notes (Markdown files in the repo root + trainer/inbox)
// so questions can link to theory, the generator form can list sources and the search box can find sections.
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { INBOX_DIR, REPO_DIR } from '../config.ts';

export interface NoteInfo {
  file: string; // relative to repo root
  title: string;
  size: number;
  group: 'notes' | 'practice' | 'inbox' | 'other';
}

const titleCache = new Map<string, { sig: string; title: string }>();

/** First "# heading" of a Markdown file (cached by mtime + size: the list is requested often). */
function titleOf(abs: string, st: fs.Stats): string {
  const sig = `${st.mtimeMs}:${st.size}`;
  const hit = titleCache.get(abs);
  if (hit?.sig === sig) return hit.title;
  let title = path.basename(abs);
  try {
    const fd = fs.openSync(abs, 'r');
    try {
      const buf = Buffer.alloc(2000);
      const n = fs.readSync(fd, buf, 0, buf.length, 0);
      const m = buf.toString('utf8', 0, n).match(/^#\s+(.+)$/m);
      if (m) title = m[1].trim();
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    // unreadable → file name
  }
  titleCache.set(abs, { sig, title });
  return title;
}

function statFile(abs: string): fs.Stats | undefined {
  try {
    const st = fs.statSync(abs);
    return st.isFile() ? st : undefined;
  } catch {
    return undefined;
  }
}

export function listNotes(): NoteInfo[] {
  const out: NoteInfo[] = [];
  const add = (abs: string, file: string, group: NoteInfo['group'], md = true) => {
    const st = statFile(abs);
    if (st) out.push({ file, title: md ? titleOf(abs, st) : path.basename(abs), size: st.size, group });
  };
  for (const f of fs.readdirSync(REPO_DIR).sort()) {
    if (f.endsWith('.md')) add(path.join(REPO_DIR, f), f, f === 'README.md' || f === 'SUMMARY.md' ? 'other' : 'notes');
  }
  for (const dir of ['highlight']) {
    const d = path.join(REPO_DIR, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).sort()) if (f.endsWith('.md')) add(path.join(d, f), `${dir}/${f}`, 'other');
  }
  if (fs.existsSync(INBOX_DIR)) {
    for (const f of fs.readdirSync(INBOX_DIR).sort()) {
      if (f.startsWith('.') || f.toLowerCase() === 'readme.md') continue;
      add(path.join(INBOX_DIR, f), `trainer/inbox/${f}`, 'inbox', f.endsWith('.md'));
    }
  }
  return out;
}

/** Absolute path of a note given relative to the repo root, refusing anything outside it (undefined = not a note). */
export function notePath(relPath: string): string | undefined {
  const abs = path.resolve(REPO_DIR, relPath);
  if (!abs.startsWith(REPO_DIR + path.sep) || !/\.(md|txt)$/i.test(abs)) return undefined;
  if (abs.includes(`${path.sep}node_modules${path.sep}`) || abs.includes(`${path.sep}.git${path.sep}`)) return undefined;
  return statFile(abs) ? abs : undefined;
}

/** Returns Markdown content for a note path relative to the repo root, refusing anything outside it. */
export function readNote(relPath: string): string | undefined {
  const abs = notePath(relPath);
  return abs ? fs.readFileSync(abs, 'utf8') : undefined;
}

// ── sections (search) ───────────────────────────────────────────────────────

export interface NoteSection {
  heading: string; // heading as plain text ('' = text before the first heading)
  anchor: string; // id the Notes page gives the heading (web/lib/markdown.tsx slug) — '' for the intro
  text: string; // plain text of the section (Markdown syntax removed)
}

/** Same slug as web/lib/markdown.tsx (applied to the heading's rendered inline HTML), so `&a=` scrolls to it. */
export function headingSlug(text: string): string {
  const inner = marked.parseInline(text, { async: false }) as string;
  return inner
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Inline Markdown → plain text: links keep their label, code its content; emphasis, HTML and table pipes are dropped. */
export function plainInline(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`*_~|]+/g, ' ')
    .replace(/[\u2500-\u259F]+/g, ' ') // box-drawing diagrams
    .replace(/[«»]/g, '"') // the search snippets mark matches with « »
    .replace(/\s+/g, ' ')
    .trim();
}

/** Markdown → searchable plain text (block markers — headings, quotes, list bullets, rules, fences — dropped too). */
export function plainText(md: string): string {
  return plainInline(
    md
      .replace(/^\s*```.*$/gm, ' ')
      .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/gm, '')
      .replace(/^\s*:?-{3,}:?\s*$/gm, ' '),
  );
}

const HEADING = /^(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;

/**
 * Splits a note at its h1–h4 headings (the levels the Notes page anchors); h5/h6 stay inside their section. Fenced
 * code blocks and the front matter are not scanned for headings.
 */
export function splitSections(md: string): NoteSection[] {
  const lines = md.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) i = end + 1;
  }
  const out: NoteSection[] = [];
  let cur: { heading: string; anchor: string; body: string[] } = { heading: '', anchor: '', body: [] }; // heading: raw Markdown
  const push = () => {
    const text = plainText(cur.body.join('\n'));
    if (cur.heading || text) out.push({ heading: plainInline(cur.heading), anchor: cur.anchor, text });
  };
  let fence = '';
  for (; i < lines.length; i++) {
    const line = lines[i];
    const f = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = '';
      cur.body.push(line);
      continue;
    }
    const h = !fence && line.match(HEADING);
    if (h && h[1].length <= 4) {
      push();
      const heading = h[2].trim();
      cur = { heading, anchor: headingSlug(heading), body: [] };
      continue;
    }
    cur.body.push(line);
  }
  push();
  return out;
}
