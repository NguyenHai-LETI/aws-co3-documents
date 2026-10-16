// Read-only access to the study notes (Markdown files in the repo root + trainer/inbox)
// so questions can link to theory and the generator form can list sources.
import fs from 'node:fs';
import path from 'node:path';
import { INBOX_DIR, REPO_DIR } from '../config.ts';

export interface NoteInfo {
  file: string; // relative to repo root
  title: string;
  size: number;
  group: 'notes' | 'practice' | 'inbox' | 'other';
}

function titleOf(abs: string): string {
  try {
    const head = fs.readFileSync(abs, 'utf8').slice(0, 2000);
    const m = head.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : path.basename(abs);
  } catch {
    return path.basename(abs);
  }
}

export function listNotes(): NoteInfo[] {
  const out: NoteInfo[] = [];
  for (const f of fs.readdirSync(REPO_DIR).sort()) {
    if (!f.endsWith('.md')) continue;
    const abs = path.join(REPO_DIR, f);
    out.push({ file: f, title: titleOf(abs), size: fs.statSync(abs).size, group: f === 'README.md' || f === 'SUMMARY.md' ? 'other' : 'notes' });
  }
  for (const dir of ['highlight']) {
    const d = path.join(REPO_DIR, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).sort()) {
      if (f.endsWith('.md')) out.push({ file: `${dir}/${f}`, title: titleOf(path.join(d, f)), size: fs.statSync(path.join(d, f)).size, group: 'other' });
    }
  }
  if (fs.existsSync(INBOX_DIR)) {
    for (const f of fs.readdirSync(INBOX_DIR).sort()) {
      if (f.startsWith('.') || f.toLowerCase() === 'readme.md') continue;
      const abs = path.join(INBOX_DIR, f);
      if (!fs.statSync(abs).isFile()) continue;
      out.push({ file: `trainer/inbox/${f}`, title: f.endsWith('.md') ? titleOf(abs) : f, size: fs.statSync(abs).size, group: 'inbox' });
    }
  }
  return out;
}

/** Returns Markdown content for a note path relative to the repo root, refusing anything outside it. */
export function readNote(relPath: string): string | undefined {
  const abs = path.resolve(REPO_DIR, relPath);
  if (!abs.startsWith(REPO_DIR + path.sep) || !/\.(md|txt)$/i.test(abs)) return undefined;
  if (abs.includes(`${path.sep}node_modules${path.sep}`) || abs.includes(`${path.sep}.git${path.sep}`)) return undefined;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return undefined;
  return fs.readFileSync(abs, 'utf8');
}
