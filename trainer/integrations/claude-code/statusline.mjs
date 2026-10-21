#!/usr/bin/env node
// [v5] π Claude Code status line for the SAA-C03 Trainer: "📚 12 câu đến hạn · sẵn sàng 63 % · ☕ 3/4".
// Prints nothing when the app is not running. No AI call, no quota; the app answers from memory in a few ms.
//
// Setup (~/.claude/settings.json or the project's .claude/settings.json; forward slashes on Windows too):
//   "statusLine": { "type": "command", "command": "node /path/to/trainer/integrations/claude-code/statusline.mjs", "refreshInterval": 60 }
// Options: --port 4000 (or TRAINER_PORT / PORT) · --prefix "SAA " · --plain (no colours).
// Already have a status line? Call this script from yours and print both lines.
//
// Claude Code passes session JSON on stdin (ignored here) and runs the command after each reply (debounced 300 ms);
// the answer is cached for 20 s in your own cache folder ($XDG_CACHE_HOME or ~/.cache, %LOCALAPPDATA% on Windows) so busy
// sessions do not ask the app every time. Control characters from the app are stripped before printing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const port = Number(opt('port') ?? process.env.TRAINER_PORT ?? process.env.PORT ?? 3003) || 3003;
const prefix = opt('prefix') ?? '';
const plain = args.includes('--plain') || !!process.env.NO_COLOR;
const cacheRoot = process.platform === 'win32' ? process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local') : process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
const cacheDir = path.join(cacheRoot, 'saa-trainer');
const cacheFile = path.join(cacheDir, `status-${port}.json`);
/** One line of text: no escape sequences or control characters from whatever answered on the port. */
const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').trim().slice(0, 200);
const TTL_MS = 20_000;

if (!process.stdin.isTTY) {
  process.stdin.resume();
  process.stdin.on('data', () => undefined);
  process.stdin.on('error', () => undefined);
}

function show(line) {
  if (!line) return;
  process.stdout.write(`${plain ? '' : '\x1b[36m'}${prefix}${line}${plain ? '' : '\x1b[0m'}\n`);
}

async function main() {
  try {
    const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (Date.now() - c.at < TTL_MS) return show(clean(c.line));
  } catch {
    // no cache yet
  }
  let line = '';
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/micro/status`, { signal: AbortSignal.timeout(800) });
    if (r.ok) line = clean((await r.json()).line);
  } catch {
    // app not running: print nothing
  }
  try {
    fs.mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
    const tmp = `${cacheFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ at: Date.now(), line }), { mode: 0o600 });
    fs.renameSync(tmp, cacheFile); // readers never see a half-written file
  } catch {
    // no writable cache folder: no cache
  }
  show(line);
}

main().finally(() => process.exit(0));
