// Core read-only routes: metadata, bank, notes, files, issues.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, REPO_DIR, TRAINER_DIR, SNAPSHOT_FILE, rel } from '../config.ts';
import { HttpError, readBody, route } from '../http.ts';
import { context } from '../context.ts';
import { loadBank } from '../lib/bank.ts';
import { addIssue, loadIssues } from '../lib/issues.ts';
import { findClaude } from '../lib/coach-runner.ts';
import { listNotes, readNote } from '../lib/notes.ts';
import os from 'node:os';

route('GET', '/api/meta', () => {
  const { cfg, bank, attempts, plans } = context();
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
  };
});

route('GET', '/api/bank', () => {
  const bank = loadBank();
  return { version: bank.version, packs: bank.packs, questions: bank.questions, problems: bank.problems };
});

route('GET', '/api/issues', () => loadIssues().reverse());

route('POST', '/api/issues', async (req) => {
  const body = await readBody<{ qid?: string; type?: string; note?: string }>(req);
  if (!body.qid || !loadBank().byId.has(body.qid)) throw new HttpError(400, 'Unknown question id');
  return addIssue(body.qid, body.type ?? 'other', (body.note ?? '').slice(0, 1000));
});

route('GET', '/api/notes', () => listNotes());

route('GET', '/api/note', (_req, url) => {
  const p = url.searchParams.get('path') ?? '';
  const content = readNote(p);
  if (content === undefined) throw new HttpError(404, 'Note not found');
  return { path: p, content };
});

/** Raw Markdown of any file under the data root (result reports, plans, snapshot, packs). */
route('GET', '/api/file', (_req, url) => {
  const p = url.searchParams.get('path') ?? '';
  const abs = path.resolve(DATA_DIR, p);
  if (!abs.startsWith(DATA_DIR + path.sep) || !abs.endsWith('.md') || abs.includes(`${path.sep}node_modules${path.sep}`) || !fs.existsSync(abs)) {
    throw new HttpError(404, 'File not found');
  }
  return { path: rel(abs), content: fs.readFileSync(abs, 'utf8') };
});

route('GET', '/api/snapshot', () => ({ content: fs.existsSync(SNAPSHOT_FILE) ? fs.readFileSync(SNAPSHOT_FILE, 'utf8') : '' }));
