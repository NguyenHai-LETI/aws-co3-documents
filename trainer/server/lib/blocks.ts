// [v5] γ2 — question blocks inside a pack file: `## Q <id>` up to the next `#` / `##` heading, without the trailing blank
// lines and `---` separator. One definition for every block-level rewrite: AI patches (patch.ts), pre-images and undo
// (undo.ts), and the runner's capture of what a file-mode run changed.
import fs from 'node:fs';
import path from 'node:path';

export const BLOCK_HEADING = /^#{1,2}\s/;
export const Q_HEADING = /^##\s+Q:?\s+(\S+)/;
const SEPARATOR = /^\s*(---|\*\*\*|___)\s*$/;

/** Index of the first body line (after the YAML front matter), 0 when there is none. */
export function bodyStartIndex(text: string): number {
  if (!text.startsWith('---\n')) return 0;
  const end = text.indexOf('\n---', 4);
  if (end < 0) return 0;
  return text.slice(0, end + 4).split('\n').length;
}

/** End of a block that starts at `start` and runs until `stop` (exclusive): trailing blanks / separators dropped. */
function trimEnd(lines: string[], start: number, stop: number): number {
  let end = stop;
  while (end > start + 1 && (!lines[end - 1].trim() || SEPARATOR.test(lines[end - 1]))) end--;
  return end;
}

/** Line range [start, end) of a question block's content (heading … last content line, without trailing blanks / `---`). */
export function findBlock(lines: string[], id: string, bodyStart = 0): { start: number; end: number } | undefined {
  let start = -1;
  for (let i = bodyStart; i < lines.length; i++) {
    if (start < 0) {
      const m = lines[i].match(Q_HEADING);
      if (m && m[1] === id) start = i;
      continue;
    }
    if (BLOCK_HEADING.test(lines[i])) return { start, end: trimEnd(lines, start, i) };
  }
  if (start < 0) return undefined;
  return { start, end: trimEnd(lines, start, lines.length) };
}

/** Pack text with LF line ends and no BOM, plus what to put back when writing it. */
export function normalizedText(raw: string): { text: string; crlf: boolean } {
  return { text: raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n'), crlf: raw.includes('\r\n') };
}

/** Every question block of a pack (first block per id, like findBlock), keyed by id — text as in the file (LF). */
export function blockTexts(raw: string): Map<string, string> {
  const { text } = normalizedText(raw);
  const lines = text.split('\n');
  const out = new Map<string, string>();
  let cur: { id: string; start: number } | undefined;
  const close = (stop: number) => {
    if (cur && !out.has(cur.id)) out.set(cur.id, lines.slice(cur.start, trimEnd(lines, cur.start, stop)).join('\n'));
    cur = undefined;
  };
  for (let i = bodyStartIndex(text); i < lines.length; i++) {
    if (!BLOCK_HEADING.test(lines[i])) continue;
    close(i);
    const m = lines[i].match(Q_HEADING);
    if (m) cur = { id: m[1], start: i };
  }
  close(lines.length);
  return out;
}

/** Writes a pack atomically (temp file + rename), restoring CRLF line ends when the file used them. */
export function writePackText(abs: string, text: string, crlf = false): void {
  const out = crlf ? text.replace(/\n/g, '\r\n') : text;
  const tmp = path.join(path.dirname(abs), `.${path.basename(abs)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, out);
  fs.renameSync(tmp, abs);
}
