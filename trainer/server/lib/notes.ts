// Read-only access to the study notes (Markdown files in the repo root + trainer/inbox)
// so questions can link to theory, the generator form can list sources and the search box can find sections.
// [γ] guardFile(): what the Notes page (/api/note) and the raw file route (/api/file) may show while questions are sealed.
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { DATA_DIR, INBOX_DIR, REPO_DIR, TRAINER_DIR } from '../config.ts';
import { sealedIds, sealedKey } from './sealed.ts';

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

/** Returns Markdown content for a note path relative to the repo root, refusing anything outside it (sealed questions hidden). */
export function readNote(relPath: string): string | undefined {
  const abs = notePath(relPath);
  return abs ? guardFile(abs).content : undefined;
}

// ── [γ] sealed questions never leak through a served file ───────────────────

export interface GuardedFile {
  content?: string; // what may be shown (sealed parts removed)
  refused?: string; // why the file is not served at all (Vietnamese)
}

const SEALED_PLACEHOLDER = '> 🔒 Câu đang niêm phong — nội dung được ẩn tới khi bạn làm đề niêm phong hoặc mở sớm (Thống kê → Đề niêm phong).';
const REFUSE_LIST = '🔒 Danh sách đề niêm phong không mở trong app — xem trạng thái ở Thống kê → Đề niêm phong (hoặc `npm run seal`).';
const REFUSE_SEALED = '🔒 File này có thể chứa câu đang niêm phong (đề, đáp án, giải thích) — mở lại sau khi bạn làm đề niêm phong hoặc mở sớm.';

/** Path of `abs` inside the trainer data root (forward slashes), or undefined. Both roots: TRAINER_HOME copies + the repo's trainer/. */
function dataRel(abs: string): string | undefined {
  for (const root of new Set([DATA_DIR, TRAINER_DIR])) {
    if (abs.startsWith(root + path.sep)) return path.relative(root, abs).split(path.sep).join('/');
  }
  return undefined;
}

let reMemo: { key: string; re: RegExp } | undefined;
/** Whole-word match of any sealed id (cached per sealed set). */
function sealedRe(sealed: Set<string>): RegExp {
  const key = sealedKey();
  if (reMemo?.key !== key) {
    const alt = [...sealed].sort((a, b) => b.length - a.length).map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    reMemo = { key, re: new RegExp(`(?<![\\w-])(?:${alt})(?![\\w-])`) };
  }
  return reMemo.re;
}

/** A pack file with every sealed question block (`## Q <id>` up to the next `#` / `##` heading) replaced by a placeholder. */
export function stripSealedBlocks(text: string, sealed: Set<string>): string {
  const out: string[] = [];
  let hiding = false;
  for (const line of text.split('\n')) {
    const h = /^(#{1,2})[ \t]+(.*)$/.exec(line);
    if (h) {
      const q = h[1] === '##' ? /^Q[ \t]+(\S+)/.exec(h[2]) : null;
      hiding = !!q && sealed.has(q[1]);
      if (hiding) {
        out.push(SEALED_PLACEHOLDER, '');
        continue;
      }
    }
    if (!hiding) out.push(line);
  }
  return out.join('\n');
}

/**
 * Any other Markdown: a section whose heading names a sealed id is dropped up to the next heading of the same or a higher
 * level (result reports: `### 3. \`id\`` + stem + answer), any other line naming one too (ledgers, tables, front matter).
 */
export function redactSealedLines(text: string, re: RegExp): string {
  const out: string[] = [];
  let skip = 0;
  let hidden = 0;
  for (const line of text.split('\n')) {
    const h = /^(#{1,6})[ \t]/.exec(line);
    if (skip && h && h[1].length <= skip) skip = 0;
    if (skip) continue;
    if (re.test(line)) {
      hidden++;
      if (h) skip = h[1].length;
      continue;
    }
    out.push(line);
  }
  if (hidden) out.push('', `> 🔒 Đã ẩn ${hidden} mục nhắc tới câu đang niêm phong.`);
  return out.join('\n');
}

/**
 * What /api/note and /api/file may show of a file. `results/sealed.md` is never served. While any question is sealed:
 * coach/enrich/** (batch files hold whole question blocks) and practice-exams/** (the imported questions with their
 * keys) are refused, pack files get each sealed question block replaced by a placeholder, and any other trainer data
 * file loses the sections / lines that name a sealed id (verify.md, issues.md, ratings.md, coach/qa, plans, result
 * reports…). Study notes outside trainer/ are served as they are. Refused files are never read.
 */
export function guardFile(abs: string): GuardedFile {
  const inData = dataRel(abs);
  if (inData === 'results/sealed.md') return { refused: REFUSE_LIST };
  const sealed = sealedIds();
  const repoRel = path.relative(REPO_DIR, abs).split(path.sep).join('/');
  if (sealed.size && (inData?.startsWith('coach/enrich/') || repoRel.startsWith('practice-exams/'))) return { refused: REFUSE_SEALED };
  const text = fs.readFileSync(abs, 'utf8');
  if (!sealed.size || inData === undefined) return { content: text };
  if (inData.startsWith('bank/packs/')) return { content: stripSealedBlocks(text, sealed) };
  return { content: redactSealedLines(text, sealedRe(sealed)) };
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
