// Core read-only routes: metadata, bank, notes, files, issues.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, REPO_DIR, TRAINER_DIR, SNAPSHOT_FILE, rel } from '../config.ts';
import { HttpError, readBody, route } from '../http.ts';
import { context } from '../context.ts';
import { loadBank } from '../lib/bank.ts';
import { addIssue, loadIssues } from '../lib/issues.ts';
import { findClaude } from '../lib/coach-runner.ts';
import { guardFile, listNotes, notePath } from '../lib/notes.ts';
import { ensureSnapshot, scheduleSnapshot } from '../lib/snapshot.ts';
import { loadSealed, sealedError, sealedIds } from '../lib/sealed.ts';
import { codeVersion } from '../lib/version.ts';
import os from 'node:os';

route('GET', '/api/meta', () => {
  const { cfg, bank, attempts, plans, versions } = context();
  const issues = loadIssues();
  return {
    exam: bank.taxonomy.exam,
    domains: bank.taxonomy.domains,
    topics: bank.taxonomy.topics,
    difficulties: bank.taxonomy.difficulties,
    tasks: bank.taxonomy.tasks,
    keywords: bank.taxonomy.keywords,
    timing: bank.taxonomy.timing,
    services: Object.entries(bank.taxonomy.services).map(([name, d]) => ({ name, topic: d.topic })),
    packs: bank.packs,
    bankVersion: bank.version,
    versions, // {bank, results, plans} — same values as the SSE `data` event
    problems: { errors: bank.problems.filter((p) => p.level === 'error').length, warnings: bank.problems.filter((p) => p.level === 'warning').length },
    openIssues: issues.filter((i) => i.open).length,
    practice: cfg.practice,
    srs: cfg.srs,
    attempts: attempts.length,
    latestPlan: plans[0] ? { id: plans[0].id, created: plans[0].created } : null,
    claude: findClaude(cfg),
    paths: { trainer: TRAINER_DIR, repo: REPO_DIR, data: DATA_DIR },
    host: os.hostname(),
    coachHosts: cfg.coach.hosts,
    syncAi: { before: cfg.sync.before_ai, after: cfg.sync.after_ai }, // AI Coach runs sync before / after themselves
    sealed: loadSealed().forms.map(({ ids, ...f }) => ({ ...f, count: ids.length })), // never the question ids
    sealedError: sealedError(), // [γ] results/sealed.md broken: what to fix (its ids stay hidden, nothing is written meanwhile)
    codeVersion: codeVersion(), // code the server process runs (the UI offers a restart when a sync brings newer code)
    launcher: process.env.TRAINER_LAUNCHER === '1', // started by start.sh/.bat/.command (can restart itself)
  };
});

route('GET', '/api/bank', () => {
  const bank = loadBank();
  // sealed questions stay in the payload (a sealed exam renders them) but the UI hides them everywhere else
  return { version: bank.version, packs: bank.packs, questions: bank.questions, problems: bank.problems, sealed: [...sealedIds()] };
});

route('GET', '/api/issues', () => loadIssues().reverse());

route('POST', '/api/issues', async (req) => {
  const body = await readBody<{ qid?: string; type?: string; note?: string }>(req);
  if (!body.qid || !loadBank().byId.has(body.qid)) throw new HttpError(400, 'Unknown question id');
  const item = addIssue(body.qid, body.type ?? 'other', (body.note ?? '').slice(0, 1000));
  scheduleSnapshot(); // open issues are a snapshot section
  return item;
});

route('GET', '/api/notes', () => listNotes());

/** A note (study notes, inbox, packs, result reports…) — sealed questions hidden or the file refused ([γ] guardFile). */
route('GET', '/api/note', (_req, url) => {
  const p = url.searchParams.get('path') ?? '';
  const abs = notePath(p);
  if (!abs) throw new HttpError(404, 'Note not found');
  const g = guardFile(abs);
  if (g.refused !== undefined) throw new HttpError(403, g.refused);
  return { path: p, content: g.content };
});

/** Raw Markdown of any file under the data root (result reports, plans, snapshot, packs) — same sealed guard as /api/note. */
route('GET', '/api/file', (_req, url) => {
  const p = url.searchParams.get('path') ?? '';
  const abs = path.resolve(DATA_DIR, p);
  if (!abs.startsWith(DATA_DIR + path.sep) || !abs.endsWith('.md') || abs.includes(`${path.sep}node_modules${path.sep}`) || !fs.existsSync(abs)) {
    throw new HttpError(404, 'File not found');
  }
  const g = guardFile(abs);
  if (g.refused !== undefined) throw new HttpError(403, g.refused);
  return { path: rel(abs), content: g.content };
});

/** coach/snapshot.md — rebuilt first when stale (a scheduled write is pending or the data changed since it was written). */
route('GET', '/api/snapshot', () => {
  ensureSnapshot();
  return { content: fs.existsSync(SNAPSHOT_FILE) ? fs.readFileSync(SNAPSHOT_FILE, 'utf8') : '' };
});
