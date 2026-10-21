// Rebuildable SQLite index in <data>/.cache/trainer.db (git-ignored, never synced): a parse cache for the Markdown files
// (results, plans) and the full-text search tables (search.ts). `node:sqlite` is feature-detected; when it is missing,
// switched off (config `cache.sqlite: false`) or the database is unusable, callers fall back to in-memory caches — the
// Markdown files stay the only source of truth, so deleting .cache/ is always safe. A corrupt database is deleted and
// rebuilt; a busy database (another process writing) is skipped for that call; any other error disables the cache for
// this process.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, loadConfig, rel } from '../config.ts';
import type { DatabaseSync, StatementSync } from 'node:sqlite';

export const CACHE_DIR = path.join(DATA_DIR, '.cache');
export const INDEX_DB_FILE = path.join(CACHE_DIR, 'trainer.db');
/** Bump when the stored layout changes: the tables below are dropped and rebuilt. */
const SCHEMA_VERSION = '1';
/** Every table any schema version created (dropped on a version change; FTS shadow tables go with their table). */
const TABLES = ['files', 'q_fts', 'n_fts', 'n_files'];

interface DbState {
  db?: DatabaseSync;
  fts: boolean; // FTS5 compiled into this SQLite build
  error?: string;
}

let state: DbState | undefined;
let warned = false;

function sqliteModule(): typeof import('node:sqlite') | undefined {
  // Node ≤ 23 prints an ExperimentalWarning when node:sqlite is first loaded — the cache is optional, keep the console clean
  const emit = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    if (!/sqlite/i.test(String(warning))) (emit as (...a: unknown[]) => void).call(process, warning, ...rest);
  }) as typeof process.emitWarning;
  try {
    return process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite') | undefined;
  } catch {
    return undefined;
  } finally {
    process.emitWarning = emit;
  }
}

const message = (e: unknown) => String((e as Error)?.message ?? e);
const isCorrupt = (e: unknown) => /malformed|not a database|corrupt|SQLITE_CORRUPT|SQLITE_NOTADB|file is encrypted/i.test(message(e));
const isBusy = (e: unknown) => /database is locked|database table is locked|SQLITE_BUSY|SQLITE_LOCKED/i.test(message(e));

function removeDbFiles(): void {
  for (const f of [INDEX_DB_FILE, `${INDEX_DB_FILE}-wal`, `${INDEX_DB_FILE}-shm`, `${INDEX_DB_FILE}-journal`]) fs.rmSync(f, { force: true });
}

function hasFts5(db: DatabaseSync): boolean {
  try {
    db.exec('CREATE VIRTUAL TABLE temp.fts5_probe USING fts5(x); DROP TABLE temp.fts5_probe;');
    return true;
  } catch {
    return false;
  }
}

function createSchema(db: DatabaseSync, fts: boolean): void {
  db.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  const row = db.prepare("SELECT v FROM meta WHERE k = 'schema'").get() as { v?: string } | undefined;
  if (row?.v !== SCHEMA_VERSION) {
    for (const t of TABLES) db.exec(`DROP TABLE IF EXISTS ${t}`);
    db.exec('DELETE FROM meta');
  }
  // parse cache: front matter as JSON (`data` NULL = not a file of this kind), body only where the caller needs it
  db.exec('CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, kind TEXT NOT NULL, sig TEXT NOT NULL, data TEXT, body TEXT)');
  db.exec('CREATE INDEX IF NOT EXISTS files_kind ON files(kind)');
  if (fts) {
    // search.ts: diacritics removed by the tokenizer (đ → d is folded before indexing); prefix indexes for as-you-type
    db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS q_fts USING fts5(id UNINDEXED, stem, body, tags, tokenize = 'unicode61 remove_diacritics 2', prefix = '2 3')");
    // notes: one row per h1–h4 section; `orig_*` keep the original spelling for the hit title and snippet
    db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS n_fts USING fts5(path UNINDEXED, anchor UNINDEXED, orig_heading UNINDEXED, orig_text UNINDEXED, heading, body, tokenize = 'unicode61 remove_diacritics 2', prefix = '2 3')");
    db.exec('CREATE TABLE IF NOT EXISTS n_files (path TEXT PRIMARY KEY, sig TEXT NOT NULL)');
  }
  db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('schema', ?)").run(SCHEMA_VERSION);
}

function open(): DbState {
  const sqlite = sqliteModule();
  if (!sqlite?.DatabaseSync) return { fts: false, error: 'node:sqlite không có trong bản Node này' };
  for (let attempt = 0; ; attempt++) {
    let db: DatabaseSync | undefined;
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      db = new sqlite.DatabaseSync(INDEX_DB_FILE);
      db.exec('PRAGMA busy_timeout = 1000');
      db.exec('PRAGMA journal_mode = WAL');
      db.exec('PRAGMA synchronous = NORMAL');
      const fts = hasFts5(db);
      createSchema(db, fts);
      return { db, fts };
    } catch (e) {
      try {
        db?.close();
      } catch {
        // already closed
      }
      if (attempt === 0 && isCorrupt(e)) {
        removeDbFiles(); // corrupt → delete and rebuild from the Markdown files
        continue;
      }
      return { fts: false, error: message(e) };
    }
  }
}

function enabledInConfig(): boolean {
  try {
    return loadConfig().cache?.sqlite !== false;
  } catch {
    return true;
  }
}

/** The shared connection, or undefined (disabled / unavailable → callers use memory only). */
export function indexDb(useSqlite: boolean = enabledInConfig()): DatabaseSync | undefined {
  if (!useSqlite) return undefined;
  state ??= open();
  if (state.error && !warned) {
    warned = true;
    console.warn(`  ⚠️ Bộ nhớ đệm SQLite tắt (${state.error}) — dùng bộ nhớ trong.`);
  }
  return state.db;
}

/** FTS5 tables exist (SQLite build with FTS5 and the cache enabled). */
export function ftsAvailable(useSqlite?: boolean): boolean {
  return !!indexDb(useSqlite) && !!state?.fts;
}

/** Why the SQLite cache is not used ('' = in use). */
export function indexDbStatus(useSqlite: boolean = enabledInConfig()): string {
  if (!useSqlite) return 'cache.sqlite: false';
  indexDb(useSqlite);
  return state?.error ?? '';
}

/**
 * Runs `fn` against the database. Busy (another process writing) → `fallback` for this call only; corrupt → the file
 * is deleted and rebuilt on the next call; any other error disables the cache for this process.
 */
export function withDb<T>(fn: (db: DatabaseSync) => T, fallback: T, useSqlite?: boolean): T {
  const db = indexDb(useSqlite);
  if (!db) return fallback;
  try {
    return fn(db);
  } catch (e) {
    try {
      if (db.isTransaction) db.exec('ROLLBACK');
    } catch {
      // nothing to roll back
    }
    if (isBusy(e)) return fallback;
    try {
      db.close();
    } catch {
      // already closed
    }
    if (isCorrupt(e)) {
      removeDbFiles();
      state = undefined; // reopened (empty) on the next call
    } else {
      state = { fts: false, error: message(e) };
      warned = false;
    }
    return fallback;
  }
}

/** Runs `fn` inside one transaction (much faster for bulk writes). */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw e;
  }
}

/** Closes the connection (tests; the server keeps it open for its lifetime). */
export function closeIndexDb(): void {
  try {
    state?.db?.close();
  } catch {
    // already closed
  }
  state = undefined;
  warned = false;
}

export function getMeta(db: DatabaseSync, k: string): string | undefined {
  return (stmt(db, 'SELECT v FROM meta WHERE k = ?').get(k) as { v?: string } | undefined)?.v;
}

export function setMeta(db: DatabaseSync, k: string, v: string): void {
  stmt(db, 'INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').run(k, v);
}

const statements = new WeakMap<DatabaseSync, Map<string, StatementSync>>();
/** Prepared statement, compiled once per connection. */
export function stmt(db: DatabaseSync, sql: string): StatementSync {
  let m = statements.get(db);
  if (!m) statements.set(db, (m = new Map()));
  let s = m.get(sql);
  if (!s) m.set(sql, (s = db.prepare(sql)));
  return s;
}

// ── parse cache ─────────────────────────────────────────────────────────────

/** What a parser extracted from one file. `data: null` = not a file of this kind (cached too, so it is skipped cheaply). */
export interface FileParse {
  data: Record<string, unknown> | null;
  body?: string;
}

interface Row {
  path: string;
  sig: string;
  data: string | null;
  body: string | null;
}

/**
 * Memory → SQLite → parser cache for one kind of Markdown file. Key = data-root relative path; signature = statSig() of
 * the file + the parser version (a parser change invalidates the stored rows). Files outside the data root (unit tests
 * on temp dirs) are cached in memory only.
 */
export class ParseCache {
  readonly kind: string;
  readonly version: number;
  private parse: (text: string, abs: string) => FileParse;
  private mem = new Map<string, { sig: string; parse: FileParse }>();
  private pending: { path: string; sig: string; parse: FileParse }[] = [];
  parsed = 0; // files read + parsed from disk by this process (benchmarks / tests)

  constructor(kind: string, version: number, parse: (text: string, abs: string) => FileParse) {
    this.kind = kind;
    this.version = version;
    this.parse = parse;
  }

  private dbSig(sig: string): string {
    return `${sig}:v${this.version}`;
  }

  private persistent(abs: string): boolean {
    return abs.startsWith(DATA_DIR + path.sep);
  }

  /** Bulk-loads the stored rows of files that are not in memory yet (one query instead of one per file). */
  prefetch(entries: { abs: string; sig: string }[], useSqlite?: boolean): void {
    const missing = entries.filter((e) => this.mem.get(e.abs)?.sig !== e.sig && this.persistent(e.abs));
    if (!missing.length) return;
    withDb(
      (db) => {
        const rows = new Map<string, Row>();
        if (missing.length > 64) {
          for (const r of stmt(db, 'SELECT path, sig, data, body FROM files WHERE kind = ?').all(this.kind) as unknown as Row[]) rows.set(r.path, r);
        } else {
          const one = stmt(db, 'SELECT path, sig, data, body FROM files WHERE path = ?');
          for (const e of missing) {
            const r = one.get(rel(e.abs)) as Row | undefined;
            if (r) rows.set(r.path, r);
          }
        }
        for (const e of missing) {
          const r = rows.get(rel(e.abs));
          if (!r || r.sig !== this.dbSig(e.sig)) continue;
          let data: Record<string, unknown> | null = null;
          try {
            data = r.data === null ? null : (JSON.parse(r.data) as Record<string, unknown>);
          } catch {
            continue; // damaged row → parse the file again
          }
          this.mem.set(e.abs, { sig: e.sig, parse: r.body === null ? { data } : { data, body: r.body } });
        }
      },
      undefined,
      useSqlite,
    );
  }

  /** Parsed content of `abs` (signature `sig` from the caller's stat); reads + parses the file only on a full miss. */
  get(abs: string, sig: string, useSqlite?: boolean): FileParse {
    const hit = this.mem.get(abs);
    if (hit?.sig === sig) return hit.parse;
    if (this.persistent(abs)) {
      this.prefetch([{ abs, sig }], useSqlite);
      const again = this.mem.get(abs);
      if (again?.sig === sig) return again.parse;
    }
    let parse: FileParse;
    try {
      parse = this.parse(fs.readFileSync(abs, 'utf8'), abs);
    } catch {
      return { data: null }; // vanished between listing and reading — not cached
    }
    this.parsed++;
    this.mem.set(abs, { sig, parse });
    if (this.persistent(abs)) this.pending.push({ path: rel(abs), sig: this.dbSig(sig), parse });
    return parse;
  }

  /** Drops the in-memory copy (the caller keeps a derived object; the stored row stays for the next process). */
  forget(abs: string): void {
    this.mem.delete(abs);
  }

  /** The app rewrote this file: forget it everywhere (memory, pending writes, the stored row). */
  drop(abs: string, useSqlite?: boolean): void {
    this.mem.delete(abs);
    if (!this.persistent(abs)) return;
    const key = rel(abs);
    this.pending = this.pending.filter((w) => w.path !== key);
    withDb((db) => stmt(db, 'DELETE FROM files WHERE path = ?').run(key), undefined, useSqlite);
  }

  /** Stores the rows parsed since the last flush (one transaction); with `present`, also deletes rows of removed files. */
  flush(present?: Set<string>, useSqlite?: boolean): void {
    const writes = this.pending;
    this.pending = [];
    if (present) for (const abs of this.mem.keys()) if (!present.has(abs)) this.mem.delete(abs);
    if (!writes.length && !present) return;
    withDb(
      (db) =>
        transaction(db, () => {
          const put = stmt(db, 'INSERT OR REPLACE INTO files (path, kind, sig, data, body) VALUES (?, ?, ?, ?, ?)');
          for (const w of writes) put.run(w.path, this.kind, w.sig, w.parse.data === null ? null : JSON.stringify(w.parse.data), w.parse.body ?? null);
          if (present) {
            const keep = new Set([...present].filter((a) => this.persistent(a)).map((a) => rel(a)));
            const del = stmt(db, 'DELETE FROM files WHERE path = ?');
            for (const r of stmt(db, 'SELECT path FROM files WHERE kind = ?').all(this.kind) as unknown as { path: string }[]) if (!keep.has(r.path)) del.run(r.path);
          }
        }),
      undefined,
      useSqlite,
    );
  }
}

/**
 * Signature of a file version: mtime, size, inode and ctime. mtime + size alone miss a same-size edit whose mtime was
 * restored (whole-second mtimes on HFS+/FAT/SMB, `touch -r`, mtime-preserving copies); a rewrite through tmp + rename
 * always gets a new inode, and utimes() itself moves ctime. The first number stays mtimeMs (callers read it back).
 */
export function statSig(st: fs.Stats): string {
  return `${st.mtimeMs}:${st.size}:${st.ino}:${st.ctimeMs}`;
}

/** statSig() of a file, '' when it does not exist. */
export function fileSig(abs: string): string {
  try {
    return statSig(fs.statSync(abs));
  } catch {
    return '';
  }
}
