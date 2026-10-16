// Throwaway git worlds for sync tests: a bare "GitHub" remote plus clones that play the two machines.
// Everything runs with the developer's global/system git config switched off (no keychain helper, no signing).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from './paths.ts';

/** Git config isolation for this process and every git it spawns (runSync inherits process.env). */
export function isolateGitConfig(): void {
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  process.env.GIT_CONFIG_GLOBAL = process.platform === 'win32' ? 'NUL' : '/dev/null';
  delete process.env.GIT_DIR;
  delete process.env.GIT_WORK_TREE;
  delete process.env.GIT_INDEX_FILE;
}

export function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} (in ${cwd}) failed:\n${r.stderr}${r.stdout}`);
  return r.stdout.trim();
}

/** Local identity + no signing, so commits work on CI runners without a global git config. */
export function configureRepo(dir: string, name: string): void {
  git(dir, 'config', 'user.name', `trainer-test ${name}`);
  git(dir, 'config', 'user.email', `${name}@example.invalid`);
  git(dir, 'config', 'commit.gpgsign', 'false');
  git(dir, 'config', 'core.autocrlf', 'false');
}

export function writeFile(root: string, rel: string, content: string): string {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

export function appendFile(root: string, rel: string, content: string): void {
  fs.appendFileSync(path.join(root, rel), content);
}

/** The repo-root .gitattributes being tested (union merge for append-only logs). */
export function realGitattributes(): string {
  try {
    return fs.readFileSync(path.join(REPO_ROOT, '.gitattributes'), 'utf8');
  } catch {
    return '';
  }
}

export interface GitWorld {
  root: string;
  remote: string; // bare repo (stands in for GitHub)
  clone(name: string): string; // a new machine: fresh clone with its own identity
  cleanup(): void;
}

/**
 * root/remote.git ← seeded with `files` (plus the real .gitattributes and trainer/.gitignore rules).
 * `files` maps repo-relative paths to contents.
 */
export function makeGitWorld(files: Record<string, string>, prefix = 'trainer-sync-'): GitWorld {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  const remote = path.join(root, 'remote.git');
  git(root, 'init', '-q', '--bare', '-b', 'main', remote);
  const seed = path.join(root, 'seed');
  git(root, 'init', '-q', '-b', 'main', seed);
  configureRepo(seed, 'seed');
  writeFile(seed, '.gitattributes', realGitattributes());
  writeFile(seed, 'trainer/.gitignore', 'node_modules/\ncoach/runs/\ncoach/.lock\ncoach/snapshot.md\n');
  for (const [rel, content] of Object.entries(files)) writeFile(seed, rel, content);
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'init');
  git(seed, 'remote', 'add', 'origin', remote);
  git(seed, 'push', '-q', '-u', 'origin', 'main');
  return {
    root,
    remote,
    clone(name: string) {
      const dir = path.join(root, name);
      git(root, 'clone', '-q', remote, dir);
      configureRepo(dir, name);
      return dir;
    },
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
