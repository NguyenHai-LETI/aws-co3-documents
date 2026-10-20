// Unit tests for the performance layer: SQLite parse cache (kept across processes, invalidated per file, corrupt
// database rebuilt, `cache.sqlite: false`), one parse per file at startup (migrateResults + loadAttempts), non-attempt
// files under results/, context() memoization, plan completion index, debounced coach snapshot (re-graded answers,
// identical confusion pairs) and history pages. Throw-away data roots only (TRAINER_HOME). Run: npm test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnswerRecord, Attempt, DomainId, SubmitRequest, TestSession } from '../shared/types.ts';

const TRAINER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-perf-')));
const HOME = path.join(ROOT, 'home');
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

// ── fixture: a small bank with service names in the options, a layout migration, config with the SQLite cache on ──
const SERVICES = ['Amazon S3 with lifecycle rules', 'Amazon EFS', 'Amazon DynamoDB global tables', 'Amazon RDS Multi-AZ'];
function makeHome(home: string, sqlite: boolean) {
  fs.mkdirSync(path.join(home, 'bank', 'packs', 'manual'), { recursive: true });
  fs.mkdirSync(path.join(home, 'bank', 'migrations'), { recursive: true });
  fs.mkdirSync(path.join(home, 'coach', 'plans'), { recursive: true });
  fs.copyFileSync(path.join(TRAINER, 'bank', 'taxonomy.yaml'), path.join(home, 'bank', 'taxonomy.yaml'));
  fs.writeFileSync(path.join(home, 'config.yaml'), `cache:\n  sqlite: ${sqlite}\nstats:\n  rushed_median_seconds: 5\n`);
  // a migration that touches q-01 (results written now are graded after it → nothing to rewrite, every file is checked)
  fs.writeFileSync(
    path.join(home, 'bank', 'migrations', '2020-01-01-test.json'),
    JSON.stringify({ id: '2020-01-01-test', applied: '2020-01-01T00:00:00+07:00', kind: 'rebalance-answers', questions: { 'q-01': { A: 'B', B: 'A' } }, answers: { 'q-01': ['A', 'B'] } }),
  );
}
makeHome(HOME, true);
process.env.TRAINER_HOME = HOME; // must be set before config.ts is imported (dynamic imports below)

const { DATA_DIR, loadConfig } = await import('../server/config.ts');
// Without process isolation another test file may have loaded config.ts first — then writing here is unsafe: skip.
const it = DATA_DIR === HOME ? test : test.skip;

const { serializePack } = await import('../server/lib/pack-format.ts');
const { stringifyFrontMatter } = await import('../server/lib/frontmatter.ts');
const { loadBank } = await import('../server/lib/bank.ts');
const results = await import('../server/lib/results.ts');
const { context, contextStats, dataVersions, FSRS_PARAMS_FILE } = await import('../server/context.ts');
const { withDb, stmt } = await import('../server/lib/index-db.ts');
const plans = await import('../server/lib/plans.ts');
const snapshot = await import('../server/lib/snapshot.ts');
const { detectFeatures, detectServices } = await import('../server/lib/classify.ts');
const { confusionPairs } = await import('../server/lib/insights.ts');

const DOMAINS: DomainId[] = ['secure', 'resilient', 'performance', 'cost'];
const drafts = Array.from({ length: 12 }, (_, i) => ({
  id: `q-${String(i + 1).padStart(2, '0')}`,
  stem: `Case ${i + 1}: a company stores order data and needs a durable design. Which option meets the requirement?`,
  options: ['A', 'B', 'C', 'D'].map((key, k) => ({ key, text: SERVICES[(k + i) % 4] })),
  answer: [['A', 'B', 'C', 'D'][(i + 1) % 4]],
  explanation: 'The chosen service fits the access pattern described in the scenario.',
  domain: DOMAINS[i % 4],
  topic: 'storage',
  difficulty: 'medium' as const,
  time: 60,
}));
fs.writeFileSync(path.join(HOME, 'bank', 'packs', 'manual', 'perf-test.md'), serializePack({ pack: 'perf-test', title: 'Perf test', origin: 'manual' }, '', drafts, (x) => stringifyFrontMatter(x)));

function session(ids: string[], extra: Partial<TestSession> = {}): TestSession {
  return { sessionId: 's', mode: 'custom', title: 'Perf', feedback: 'exam', timeLimit: 0, estimateTotal: 600, timingPreset: 'standard', questions: ids.map((id) => ({ id })), selection: { mode: 'custom' }, createdAt: new Date().toISOString(), notes: [], ...extra };
}
/** Submits through gradeAndSave (the POST /api/results path); `wrong` ids get the first wrong option. */
function submit(ids: string[], wrong: string[] = [], daysAgo = 0, extra: Partial<TestSession> = {}): Attempt {
  const bank = loadBank();
  const finished = new Date(Date.now() - daysAgo * 86_400_000 - Math.floor(Math.random() * 1000) * 60_000);
  const req: SubmitRequest = {
    session: session(ids, extra),
    answers: ids.map((id) => {
      const q = bank.byId.get(id)!;
      return { q: id, pick: wrong.includes(id) ? [q.options.find((o) => !q.answer.includes(o.key))!.key] : q.answer, t: 40 };
    }),
    startedAt: new Date(finished.getTime() - 600_000).toISOString(),
    finishedAt: finished.toISOString(),
    timedOut: false,
    timeUsed: 600,
  };
  return results.gradeAndSave(req, bank);
}

/** Runs a fresh Node process on the data root: optional migrateResults(), then loadAttempts(); reports parse counts. */
const PROBE = path.join(ROOT, 'probe.ts');
fs.writeFileSync(
  PROBE,
  `const T = process.env.PROBE_TRAINER;
const { loadConfig } = await import(T + '/server/config.ts');
const { migrateResults } = await import(T + '/server/lib/migrations.ts');
const { loadAttempts, resultParses } = await import(T + '/server/lib/results.ts');
const { indexDbStatus, INDEX_DB_FILE } = await import(T + '/server/lib/index-db.ts');
if (process.argv[2] === 'startup') migrateResults();
const attempts = loadAttempts(loadConfig());
console.log(JSON.stringify({ attempts: attempts.length, ids: attempts.map((a) => a.id), picks: Object.fromEntries(attempts.map((a) => [a.file, a.answers.map((r) => r.pick).join(',')])), parsed: resultParses.parsed, db: indexDbStatus(), dbFile: INDEX_DB_FILE }));
`,
);
function probe(home: string, mode = 'startup'): { attempts: number; ids: string[]; picks: Record<string, string>; parsed: number; db: string; dbFile: string } {
  const r = spawnSync(process.execPath, [PROBE, mode], { env: { ...process.env, TRAINER_HOME: home, PROBE_TRAINER: TRAINER, NODE_OPTIONS: '' }, encoding: 'utf8', timeout: 60_000 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').at(-1)!);
}

const ids = drafts.map((d) => d.id);
const resultFiles = () => fs.readdirSync(path.join(HOME, 'results'), { recursive: true }).map(String).filter((f) => f.endsWith('.md'));

// ── parse cache ─────────────────────────────────────────────────────────────

it('fixture: a bank without errors and a history of 6 result files', () => {
  assert.deepEqual(loadBank().problems.filter((p) => p.level === 'error'), []);
  for (let i = 0; i < 6; i++) submit(ids.slice(i, i + 6), [ids[i]], 6 - i);
  assert.equal(resultFiles().length, 6);
});

it('startup parses each result file once (migrateResults + loadAttempts share it), the next process none', () => {
  const first = probe(HOME);
  assert.equal(first.attempts, 6);
  assert.equal(first.db, '', 'SQLite cache in use');
  assert.equal(first.parsed, 6, 'one YAML parse per file — not one in migrateResults and another in loadAttempts');
  assert.ok(fs.existsSync(first.dbFile) && first.dbFile.startsWith(path.join(HOME, '.cache')));
  const second = probe(HOME);
  assert.equal(second.attempts, 6);
  assert.equal(second.parsed, 0, 'every file comes from .cache/trainer.db');
  assert.deepEqual(second.ids, first.ids);
});

it('a changed result file is parsed again (signature = mtime + size + parser version), the others are not', () => {
  const file = path.join(HOME, 'results', resultFiles()[0]);
  fs.appendFileSync(file, '\n<!-- edited -->\n');
  const r = probe(HOME);
  assert.equal(r.parsed, 1);
  assert.equal(r.attempts, 6);
});

it('a same-size edit whose mtime was restored (coarse-mtime file systems, touch -r) is still seen by the next process', () => {
  const rel = resultFiles()[1];
  const file = path.join(HOME, 'results', rel);
  fs.utimesSync(file, 1750000000, 1750000000); // whole-second mtime, as HFS+ / FAT / SMB store it
  const before = probe(HOME);
  const old = before.picks[`results/${rel}`];
  assert.ok(old, 'probe sees the file');
  const text = fs.readFileSync(file, 'utf8');
  const m = /pick: ([A-D]),/.exec(text)!;
  const swapped = text.replace(m[0], `pick: ${m[1] === 'A' ? 'B' : 'A'},`);
  assert.equal(swapped.length, text.length, 'same size');
  fs.writeFileSync(file, swapped); // in place: same inode
  fs.utimesSync(file, 1750000000, 1750000000); // same mtime again — only ctime moves
  assert.equal(fs.statSync(file).mtimeMs, 1750000000_000);
  const after = probe(HOME);
  assert.notEqual(after.picks[`results/${rel}`], old, 'the edit is visible — not the stored parse of the old content');
  assert.equal(after.parsed, 1);
});

it('rewriting a result (why note) drops its stored parse row', () => {
  const a = results.loadAttempts(loadConfig())[0];
  const stored = () => withDb((db) => (stmt(db, 'SELECT count(*) AS n FROM files WHERE path = ?').get(a.file) as { n: number }).n, -1);
  assert.equal(stored(), 1, 'cached by the probes');
  assert.equal(results.rewriteAttempt(a.file, (x) => void (x.answers[0].why = 'ghi chú mới')), true);
  assert.equal(stored(), 0);
  assert.equal(probe(HOME).picks[a.file] !== undefined, true);
  assert.equal(results.loadAttempts(loadConfig()).find((x) => x.id === a.id)?.answers[0].why, 'ghi chú mới');
});

it('non-attempt files under results/ (goal, external scores, notes) are skipped — cheaply when "attempt" is absent', () => {
  fs.mkdirSync(path.join(HOME, 'results', 'external'), { recursive: true });
  const goal = '---\nkind: goal\nexam_date: 2026-12-01\ntarget_scaled: 800\n---\n\nMục tiêu thi.\n';
  const ext = '---\nkind: external\ndate: 2026-10-01\nsource: AWS Official Practice\nscore: 78\nnote: second attempt after review\n---\n';
  fs.writeFileSync(path.join(HOME, 'results', 'goal.md'), goal);
  fs.writeFileSync(path.join(HOME, 'results', 'external', '2026-10-01_aws.md'), ext);
  fs.writeFileSync(path.join(HOME, 'results', 'notes.md'), '# ghi chú\n\nkhông có front matter\n');
  assert.deepEqual(results.parseResultFile(goal), { data: null }, 'no "attempt" in the front matter → not parsed');
  assert.deepEqual(results.parseResultFile('# no front matter'), { data: null });
  assert.equal(results.parseResultFile(ext).data?.kind, 'external', '"attempt" in a note → parsed, still not an attempt');
  assert.equal(results.loadAttempts(loadConfig()).length, 6);
  const r = probe(HOME);
  assert.equal(r.attempts, 6);
  assert.ok(r.parsed <= 3, `only the new files are read (${r.parsed})`);
  assert.equal(probe(HOME).parsed, 0, 'and cached as "not an attempt" afterwards');
});

it('a corrupt cache database is deleted and rebuilt; results load as before', () => {
  const db = path.join(HOME, '.cache', 'trainer.db');
  for (const f of [`${db}-wal`, `${db}-shm`]) fs.rmSync(f, { force: true });
  fs.writeFileSync(db, 'this is not a database '.repeat(200));
  const r = probe(HOME);
  assert.equal(r.attempts, 6);
  assert.equal(r.db, '');
  assert.equal(r.parsed, resultFiles().length, 'rebuilt from the Markdown files (attempts + the non-attempt files)');
  assert.equal(fs.readFileSync(db).subarray(0, 15).toString(), 'SQLite format 3');
  assert.equal(probe(HOME).parsed, 0);
});

it('cache.sqlite: false → no database file, memory only', () => {
  const home2 = path.join(ROOT, 'home-nocache');
  makeHome(home2, false);
  fs.cpSync(path.join(HOME, 'bank', 'packs'), path.join(home2, 'bank', 'packs'), { recursive: true });
  fs.cpSync(path.join(HOME, 'results'), path.join(home2, 'results'), { recursive: true });
  const r = probe(home2);
  assert.equal(r.attempts, 6);
  assert.equal(r.db, 'cache.sqlite: false');
  assert.ok(!fs.existsSync(path.join(home2, '.cache')), 'nothing written');
  assert.equal(probe(home2).parsed, r.parsed, 'every process parses again');
});

// ── context(), plans ────────────────────────────────────────────────────────

it('context() is memoized by data versions: same object until a result, plan or config.yaml changes', () => {
  const a = context();
  assert.equal(context(), a, 'nothing changed → same context');
  assert.equal(a.versions.results, results.attemptsVersion());
  assert.equal(a.versions.bank, a.bank.version);
  submit(ids.slice(0, 3));
  const b = context();
  assert.notEqual(b, a, 'new result file');
  assert.equal(b.attempts.length, a.attempts.length + 1);
  assert.equal(context(), b);
  fs.writeFileSync(path.join(HOME, 'coach', 'plans', 'p1.md'), `---\nid: p1\ncreated: ${new Date().toISOString()}\nsessions:\n  - id: s1\n    title: "Phiên 1"\n    questions: [q-01, q-02]\n---\n\n# Kế hoạch\n`);
  const c = context();
  assert.notEqual(c, b, 'new plan file');
  assert.equal(c.planById.get('p1')?.sessions[0].title, 'Phiên 1');
  fs.appendFileSync(path.join(HOME, 'config.yaml'), 'practice:\n  quick_count: 7\n');
  const d = context();
  assert.notEqual(d, c, 'config.yaml changed');
  assert.equal(d.cfg.practice.quick_count, 7);
  assert.equal(contextStats(d), contextStats(d), 'stats computed once per data state');
});

it('plan completion comes from an index of attempts by plan session (same result as the per-session scan)', () => {
  submit(['q-01', 'q-02'], [], 0, { mode: 'coach', plan: 'p1#s1' });
  submit(['q-01', 'q-02'], ['q-02'], 0, { mode: 'coach', plan: 'p1#s1' });
  const ctx = context();
  const done = ctx.planById.get('p1')!.sessions[0].done!;
  const expected = ctx.attempts.filter((a) => a.plan === 'p1#s1').map((a) => ({ attemptId: a.id, score: a.score, finished: a.finished }));
  assert.equal(done.length, 2);
  assert.deepEqual(done, expected);
  assert.equal(plans.planSummary(ctx.planById.get('p1')!).sessions.length, 1);
  assert.ok(!('body' in plans.planSummary(ctx.planById.get('p1')!)), 'summary without the Markdown body');
});

it('duplicate plan ids: planById keeps the newest plan, like the list and buildTest', () => {
  const mk = (file: string, created: string, title: string) =>
    fs.writeFileSync(path.join(HOME, 'coach', 'plans', file), `---\nid: dup\ncreated: ${created}\nsessions:\n  - id: s1\n    title: "${title}"\n---\n\n# ${title}\n`);
  mk('dup-a.md', '2026-01-01T08:00:00+07:00', 'cũ');
  mk('dup-b.md', '2026-01-02T08:00:00+07:00', 'mới');
  const ctx = context();
  assert.equal(ctx.plans.find((p) => p.id === 'dup')?.sessions[0].title, 'mới');
  assert.equal(ctx.planById.get('dup'), ctx.plans.find((p) => p.id === 'dup'));
  for (const f of ['dup-a.md', 'dup-b.md']) fs.rmSync(path.join(HOME, 'coach', 'plans', f));
});

it('dataVersions() = context().versions and moves with the FSRS parameters, config.yaml and the day', () => {
  const v1 = context().versions;
  assert.deepEqual(dataVersions(), v1);
  assert.ok(v1.params && v1.config && /^\d{4}-\d{2}-\d{2}$/.test(v1.day ?? ''));
  fs.writeFileSync(FSRS_PARAMS_FILE, `${JSON.stringify({ weights: [], optimizedAt: new Date().toISOString() })}\n`);
  const v2 = context().versions;
  assert.notEqual(v2.params, v1.params, 'fsrs-params.json');
  assert.equal(v2.results, v1.results, 'a .json file is not a result');
  fs.appendFileSync(path.join(HOME, 'config.yaml'), '# edited\n');
  const v3 = context().versions;
  assert.notEqual(v3.config, v2.config, 'config.yaml');
  assert.deepEqual(dataVersions(), v3);
  fs.rmSync(FSRS_PARAMS_FILE);
});

// ── coach snapshot ──────────────────────────────────────────────────────────

it('scheduleSnapshot() writes after the debounce, off the request path; stale data is detected and rebuilt', async () => {
  snapshot.flushSnapshot();
  const file = path.join(HOME, 'coach', 'snapshot.md');
  fs.rmSync(file, { force: true });
  snapshot.scheduleSnapshot(30);
  snapshot.scheduleSnapshot(30); // debounced: one write
  assert.ok(!fs.existsSync(file), 'not written synchronously');
  assert.equal(snapshot.snapshotStale(), true);
  await new Promise((r) => setTimeout(r, 120));
  assert.ok(fs.existsSync(file));
  assert.equal(snapshot.snapshotStale(), false);
  submit(ids.slice(2, 5));
  assert.equal(snapshot.snapshotStale(), true, 'a new result makes it stale');
  assert.equal(snapshot.ensureSnapshot(), true);
  assert.equal(snapshot.ensureSnapshot(), false, 'fresh now');
  fs.writeFileSync(FSRS_PARAMS_FILE, `${JSON.stringify({ weights: [], optimizedAt: new Date().toISOString() })}\n`);
  assert.equal(snapshot.snapshotStale(), true, 'new personal FSRS parameters change the memory levels');
  assert.equal(snapshot.ensureSnapshot(), true);
  fs.rmSync(FSRS_PARAMS_FILE);
  snapshot.ensureSnapshot();
});

it('the snapshot counts answers against the current key (regradeAttempts); §9 lists only confirmed confusion pairs, never the raw per-answer labels', () => {
  // an answer graded with an old key: pick = today's correct option, stored key/ok from before the fix
  const q = loadBank().byId.get('q-12')!;
  const oldKey = q.options.find((o) => !q.answer.includes(o.key))!.key;
  const finished = new Date(Date.now() - 3_600_000).toISOString();
  const data = { id: 'old-key', kind: 'attempt', layout: 2, mode: 'custom', title: 'old key', feedback: 'exam', started: finished, finished, time_limit: 0, time_used: 60, timed_out: false, total: 1, answered: 1, correct: 0, score: 0, scaled: 100, passed: false, answers: [{ q: 'q-12', pick: q.answer.join(''), key: oldKey, ok: false, t: 40, est: 60 }] };
  fs.mkdirSync(path.join(HOME, 'results', '2026', '01'), { recursive: true });
  fs.writeFileSync(path.join(HOME, 'results', '2026', '01', 'old-key.md'), stringifyFrontMatter(data, ['answers']));
  const bank = loadBank();
  const text = snapshot.buildSnapshot(bank, loadConfig()).text;
  const wrongSection = text.slice(text.indexOf('## 7.'), text.indexOf('## 8.'));
  assert.ok(!wrongSection.includes('`q-12`'), 'q-12 was answered with the (current) correct option → not "wrong"');

  // §9 (v4): the pairs insights.confusionPairs confirms against the learner's base rate, with their evidence — the old
  // raw "picked ⟶ correct" count of every wrong answer is gone (it turned scattered slips into "repeated confusions")
  const ctx = context();
  const raw = new Set<string>();
  for (const a of ctx.attempts.filter((x) => !x.rushed)) {
    for (const r of a.answers as AnswerRecord[]) {
      if (r.ok || !r.pick) continue;
      const qq = bank.byId.get(r.q)!;
      const t = (keys: string) => qq.options.filter((x) => keys.includes(x.key)).map((x) => x.text).join(' ');
      const wrongKeys = [...r.pick].filter((k) => !qq.answer.includes(k)).join('');
      const pickedAll = [...detectServices(t(wrongKeys), bank.taxonomy), ...detectFeatures(t(wrongKeys), bank.taxonomy)];
      const rightAll = [...detectServices(t(qq.answer.join('')), bank.taxonomy), ...detectFeatures(t(qq.answer.join('')), bank.taxonomy)];
      const picked = pickedAll.filter((x) => !rightAll.includes(x));
      const right = rightAll.filter((x) => !pickedAll.includes(x));
      if (picked.length > 1 || right.length > 1) raw.add(`${picked.slice(0, 2).join(' + ')} ⟶ ${right.slice(0, 2).join(' + ')}`); // a combined label = the old format
    }
  }
  const section9 = text.slice(text.indexOf('## 9.'), text.indexOf('## 10.'));
  assert.match(section9, /^## 9\. Cặp hay nhầm/);
  const confirmed = confusionPairs(ctx.attempts.filter((x) => !x.rushed), bank, { sealed: new Set() });
  for (const p of confirmed) assert.ok(section9.includes(`| ${p.picked} ⟶ ${p.correct}`) && section9.includes(`| ${p.picks}/${p.exposures} |`), `confirmed pair ${p.picked} ⟶ ${p.correct}`);
  if (!confirmed.length) assert.match(section9, /Chưa có cặp nào đủ bằng chứng/);
  for (const label of raw) assert.ok(!section9.includes(label), `no raw per-answer label: ${label}`);
});

// ── history pages ───────────────────────────────────────────────────────────

it('history pages: newest first, filters by mode / Pearson / title words, hide rushed, trend and totals', () => {
  const bank = loadBank();
  const mk = (i: number, extra: Partial<Attempt> = {}): Attempt =>
    ({ id: `h${i}`, mode: i % 2 ? 'srs' : 'quick', title: i % 3 ? `Bài ${i}` : `Ôn tập ${i}`, finished: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00+07:00`, score: 50 + i, correct: i, total: 20, timeUsed: 100, answers: [], file: `r${i}.md`, rushed: i === 7, ...extra }) as Attempt;
  const list = Array.from({ length: 10 }, (_, i) => mk(i, i === 4 ? { pearson: true, mode: 'exam' } : {}));
  const p = results.resultsPage(list, bank, { limit: 3, offset: 0 });
  assert.deepEqual(p.items.map((a) => a.id), ['h9', 'h8', 'h7']);
  assert.equal(p.total, 10);
  assert.equal(p.rushed, 1);
  assert.equal(p.counted, 9);
  assert.equal(p.pearson, 1);
  assert.deepEqual(new Set(p.modes), new Set(['srs', 'quick', 'exam']));
  assert.equal(p.trend.length, 9);
  assert.equal(p.trend.at(-1)?.id, 'h9', 'trend oldest first, ends with the newest');
  assert.equal(p.avgScore, Math.round(((list.reduce((s, a) => s + a.score, 0) - list[7].score) / 9) * 10) / 10);
  assert.deepEqual(results.resultsPage(list, bank, { limit: 3, offset: 9 }).items.map((a) => a.id), ['h0']);
  assert.deepEqual(results.resultsPage(list, bank, { limit: 50, offset: 0, mode: 'pearson' }).items.map((a) => a.id), ['h4']);
  assert.ok(results.resultsPage(list, bank, { limit: 50, offset: 0, mode: 'srs' }).items.every((a) => a.mode === 'srs'));
  assert.deepEqual(results.resultsPage(list, bank, { limit: 50, offset: 0, q: 'ÔN TẬP' }).items.map((a) => a.id), ['h9', 'h6', 'h3', 'h0']);
  const hidden = results.resultsPage(list, bank, { limit: 50, offset: 0, hideRushed: true });
  assert.equal(hidden.total, 9);
  assert.equal(hidden.rushed, 1, 'the checkbox still knows how many are hidden');
  assert.ok(!hidden.items.some((a) => a.rushed));
  assert.ok(!('answers' in p.items[0]), 'summaries only');
});

it('attemptById matches find() (first match) and loadedAttemptsVersion() needs no second scan', () => {
  const all = results.loadAttempts(loadConfig());
  for (const a of all) assert.equal(results.attemptById(all, a.id), all.find((x) => x.id === a.id));
  assert.equal(results.attemptById(all, 'nope'), undefined);
  assert.equal(results.loadedAttemptsVersion(), results.attemptsVersion());
});
