// [v6] Computed Question.tier on a real parse (requirements first), `scope: legacy` treated as out everywhere
// (Question.outOfScope, practice pool, sealed eligibility, the taxonomy helpers) and `npm run seal -- --add`
// (sealed.ts addForm): one more form while S1/S2 are sealed, never-seen questions only, `--tier A`, AI-written questions
// only with a verified key, a per-domain refusal or a smaller form with allowShort, the 5-sealed-forms cap and the CLI
// (exit codes, never a question id on screen). Throw-away data root only (TRAINER_HOME). Run: npm test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import type { Attempt, Taxonomy } from '../shared/types.ts';

const TRAINER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-sealed-v6-')));
const HOME = path.join(ROOT, 'home');
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
fs.mkdirSync(path.join(HOME, 'bank', 'packs', 'manual'), { recursive: true });
fs.mkdirSync(path.join(HOME, 'bank', 'packs', 'ai'), { recursive: true });
fs.mkdirSync(path.join(HOME, 'results'), { recursive: true });
// the real taxonomy with AWS Data Pipeline marked `scope: legacy` (dropped from the official in-scope list)
const rawTax = YAML.parse(fs.readFileSync(path.join(TRAINER, 'bank', 'taxonomy.yaml'), 'utf8')) as Taxonomy;
rawTax.services['Data Pipeline'] = { ...rawTax.services['Data Pipeline'], topic: rawTax.services['Data Pipeline']?.topic ?? 'analytics', match: ['Data Pipeline'], scope: 'legacy' };
fs.writeFileSync(path.join(HOME, 'bank', 'taxonomy.yaml'), YAML.stringify(rawTax));
fs.writeFileSync(path.join(HOME, 'config.yaml'), "exam:\n  sealed_forms: 0\n  sealed_size: 10\ncache:\n  sqlite: false\nquality:\n  embeddings: off\n  exam_spec_since: ''\nsync:\n  auto: off\n");
process.env.TRAINER_HOME = HOME; // before config.ts is imported (dynamic imports below)
process.env.TRAINER_REPO = ROOT;

const { DATA_DIR, loadConfig } = await import('../server/config.ts');
const it = DATA_DIR === HOME ? test : test.skip; // never write next to the real results/

const { serializePack } = await import('../server/lib/pack-format.ts');
const { stringifyFrontMatter } = await import('../server/lib/frontmatter.ts');
const { loadBank, correctOutOfScope } = await import('../server/lib/bank.ts');
const T = await import('../server/lib/taxonomy.ts');
const S = await import('../server/lib/sealed.ts');
const { appendVerdicts } = await import('../server/lib/verify.ts');
const { practicePool } = await import('../shared/filters.ts');

// ── fixture: 14 tasks × 10 questions with unrelated made-up words (4 drills, 1 exam-like without criterion, 5 tier A) ──
const SYL = ['ka', 'lo', 'mi', 'nu', 'pe', 'ra', 'si', 'to', 'va', 'ze', 'bo', 'du', 'fi', 'gu', 'ha', 'je'];
const word = (n: number) => {
  let s = '';
  let x = n;
  do {
    s += SYL[x % 16];
    x = Math.floor(x / 16);
  } while (x > 0);
  return `${s}q`;
};
const words = (base: number, n: number) => Array.from({ length: n }, (_, k) => word(base + k)).join(' ');
const EXPLANATION = 'The chosen design meets the stated requirement directly, and every other option misses one constraint of the scenario described above.';

type Kind = 'A' | 'Bx' | 'C';
interface Draft {
  id: string;
  stem: string;
  options: { key: string; text: string }[];
  answer: string[];
  explanation: string;
  domain: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  time: number;
  task?: string;
}

function draft(i: number, id: string, domain: string, task: string, kind: Kind, stemPrefix = ''): Draft {
  const base = 1000 + i * 100;
  const stem =
    kind === 'C'
      ? `${words(base, 14)}. Which option meets the requirement?`
      : `${stemPrefix}${words(base, 58)}. ${kind === 'A' ? 'Which option meets these requirements?' : 'Which option should the team choose?'}`;
  const options = Array.from({ length: 4 }, (_, k) => ({ key: 'ABCD'[k], text: kind === 'C' ? `Use ${word(base + 70 + k)} with ${word(base + 80 + k)}` : `Use ${words(base + 60 + k * 10, 9)}` }));
  return { id, stem, options, answer: ['B'], explanation: EXPLANATION, domain, topic: 'storage', difficulty: 'medium', time: 60, task };
}

const tax0 = T.loadTaxonomy();
const KINDS: Kind[] = ['C', 'C', 'C', 'C', 'Bx', 'A', 'A', 'A', 'A', 'A'];
const drafts: Draft[] = [];
let n = 0;
for (const t of tax0.tasks) KINDS.forEach((kind, k) => drafts.push(draft(n++, `m-${t.id.replace('.', '')}-${k}`, t.domain, t.id, kind)));
const opt4 = (texts: string[]) => texts.map((text, k) => ({ key: 'ABCD'[k], text }));
const SPECIAL: Draft[] = [
  // a legacy service as the answer (off-exam) / only in a distractor (still in scope)
  { ...draft(900, 'x-legacy', 'resilient', '2.1', 'C'), options: opt4(['Use Amazon EFS for the reports', 'Orchestrate the nightly jobs with AWS Data Pipeline', 'Use Amazon EBS snapshots', 'Use Amazon FSx']) },
  { ...draft(901, 'x-legacy-distractor', 'resilient', '2.1', 'C'), options: opt4(['Orchestrate the nightly jobs with AWS Data Pipeline', 'Use AWS Step Functions for the jobs', 'Use Amazon EBS snapshots', 'Use Amazon FSx']) },
  // tier A through a qualifier group in the stem (requirements), the closing question names no requirement
  draft(902, 'x-req', 'cost', '4.1', 'Bx', 'The team wants the MOST cost-effective design. '),
];
fs.writeFileSync(
  path.join(HOME, 'bank', 'packs', 'manual', 'v6-fixture.md'),
  serializePack({ pack: 'v6-fixture', title: 'v6 fixture', origin: 'manual' }, '', [...drafts, ...SPECIAL] as never, (x) => stringifyFrontMatter(x)),
);
const AI = ['ai-ok', 'ai-old', 'ai-mismatch', 'ai-none'];
fs.writeFileSync(
  path.join(HOME, 'bank', 'packs', 'ai', 'v6-ai.md'),
  serializePack({ pack: 'v6-ai', title: 'v6 AI', origin: 'ai' }, '', AI.map((id, k) => draft(950 + k, id, 'secure', '1.1', 'A')) as never, (x) => stringifyFrontMatter(x)),
);

const cfg = () => loadConfig();
const bankNow = () => loadBank();
const SEALED = () => path.join(HOME, 'results', 'sealed.md');
/** Hand-written tier-A questions of a domain, bank order. */
const tierA = (domain: string) => drafts.filter((d) => d.domain === domain && KINDS[Number(d.id.split('-')[2])] === 'A').map((d) => d.id);
const seenAttempt = (ids: string[]): Attempt =>
  ({
    id: 'a-seen',
    mode: 'custom',
    title: 'seen',
    feedback: 'exam',
    started: '2026-10-01T10:00:00+07:00',
    finished: '2026-10-01T10:10:00+07:00',
    timeLimit: 0,
    timeUsed: 600,
    timedOut: false,
    total: ids.length,
    answered: ids.length,
    correct: 0,
    score: 0,
    scaled: 100,
    passed: false,
    answers: ids.map((q) => ({ q, pick: 'A', key: 'B', ok: false, t: 30, est: 60 })),
    file: 'a-seen.md',
  }) as Attempt;
const byDomain = (bank: ReturnType<typeof bankNow>, ids: string[]) => ids.reduce<Record<string, number>>((m, id) => ((m[bank.byId.get(id)!.domain] = (m[bank.byId.get(id)!.domain] ?? 0) + 1), m), {});
const status = (e: unknown) => (e as { status?: number }).status;
const err = (fn: () => unknown): [number | undefined, string] | undefined => {
  try {
    fn();
  } catch (e) {
    return [status(e), (e as Error).message];
  }
  return undefined;
};

// ── computed fields ─────────────────────────────────────────────────────────

it('loadBank computes Question.tier after requirements (a qualifier group in the stem is a criterion)', () => {
  const bank = bankNow();
  assert.equal(bank.problems.filter((p) => p.level === 'error').length, 0, JSON.stringify(bank.problems.slice(0, 3)));
  assert.equal(bank.byId.get('m-11-0')!.tier, 'C');
  assert.equal(bank.byId.get('m-11-4')!.tier, 'B', 'exam-like, no criterion');
  assert.equal(bank.byId.get('m-11-5')!.tier, 'A', 'the closing question names the requirements');
  const req = bank.byId.get('x-req')!;
  assert.deepEqual(req.requirements, ['cost']);
  assert.equal(req.tier, 'A', '“MOST cost-effective” in the stem');
  assert.equal(bank.questions.filter((q) => q.tier === 'A').length, 14 * 5 + 1 + AI.length);
  assert.ok(bank.questions.every((q) => q.tier !== undefined));
});

// ── scope: legacy ───────────────────────────────────────────────────────────

it('scope: legacy behaves like out: helpers, Question.outOfScope, the practice pool and sealed eligibility', () => {
  const bank = bankNow();
  const tax = bank.taxonomy;
  assert.equal(T.serviceScope(tax, 'Data Pipeline'), 'legacy');
  assert.equal(T.serviceScope(tax, 'data pipeline'), 'legacy', 'case-insensitive');
  assert.equal(T.serviceScope(tax, 'AWS Data Pipeline'), 'legacy', 'the official name (exam guide spelling)');
  assert.equal(T.serviceScope(tax, 'CodeCommit'), 'out');
  assert.equal(T.serviceScope(tax, 'Amazon IVS'), 'out', 'an alias');
  assert.equal(T.serviceScope(tax, 'No Such Service'), undefined);
  assert.ok(T.legacySet(tax).has('Data Pipeline') && !T.legacySet(tax).has('CodeCommit'));
  assert.ok(T.outOfScopeSet(tax).has('Data Pipeline') && T.outOfScopeSet(tax).has('CodeCommit'), 'legacy ⊂ out of scope');
  assert.deepEqual(T.outOfScopeIn('Orchestrate the jobs with AWS Data Pipeline', tax), ['Data Pipeline']);
  assert.deepEqual(correctOutOfScope(bank.byId.get('x-legacy')!, tax), ['Data Pipeline']);
  assert.equal(bank.byId.get('x-legacy')!.outOfScope, true);
  assert.equal(bank.byId.get('x-legacy-distractor')!.outOfScope, undefined, 'only a distractor');
  const pool = practicePool(bank.questions, { excludeOutOfScope: true });
  assert.ok(!pool.some((q) => q.id === 'x-legacy') && pool.some((q) => q.id === 'x-legacy-distractor'));
  const e = S.eligibleForSealing(bank, cfg());
  assert.equal(e.excluded.outOfScope, 1);
  assert.ok(!e.pool.some((q) => q.id === 'x-legacy'));
});

// ── npm run seal -- --add ───────────────────────────────────────────────────

it('addForm: one more form while S1/S2 are sealed — tier A only, never-seen only, AI-written only with a verified key', () => {
  const bank = bankNow();
  // two sealed forms of drills (hand-written, like a file created earlier)
  const drills = drafts.filter((d) => d.id.endsWith('-0') || d.id.endsWith('-1')).map((d) => d.id);
  const s1 = drills.slice(0, 4);
  const s2 = drills.slice(4, 8);
  fs.writeFileSync(SEALED(), `---\nkind: sealed\nsize: 4\nforms:\n  - id: S1\n    status: sealed\n    ids: [ ${s1.join(', ')} ]\n  - id: S2\n    status: sealed\n    ids: [ ${s2.join(', ')} ]\n---\n`);
  assert.equal(S.sealedIds().size, 8);
  // verdicts: only ai-ok has a blind solve that agrees with the key of its current version
  const h = (id: string) => bank.byId.get(id)!.hash;
  const v = (qid: string, hash: string, outcome: 'ok' | 'mismatch') => ({ date: '2026-10-22', at: '2026-10-22T10:00:00+07:00', qid, hash, outcome, model: 'test' });
  appendVerdicts([v('ai-ok', h('ai-ok'), 'ok'), v('ai-old', 'deadbeef', 'ok'), v('ai-mismatch', h('ai-mismatch'), 'mismatch')]);
  // seen: every hand-written tier-A secure question but two → the secure quota (3) needs ai-ok
  const secureA = tierA('secure');
  assert.equal(secureA.length, 15);
  const unseen = secureA.slice(-2);
  const attempts = [seenAttempt(secureA.slice(0, -2))];

  const r = S.addForm(bank, attempts, cfg(), { tier: 'A', size: 10 });
  assert.deepEqual(r.created, ['S3']);
  assert.equal(r.size, 10);
  const st = S.loadSealed();
  assert.deepEqual(st.forms.map((f) => [f.id, f.status]), [['S1', 'sealed'], ['S2', 'sealed'], ['S3', 'sealed']]);
  assert.deepEqual(st.forms[0].ids, s1, 'S1 untouched');
  assert.deepEqual(st.forms[1].ids, s2, 'S2 untouched');
  assert.equal(st.size, 4, 'the file keeps the size of its forms');
  const s3 = st.forms[2].ids;
  assert.equal(S.sealedIds().size, 18);
  assert.deepEqual(byDomain(bank, s3), { secure: 3, resilient: 3, performance: 2, cost: 2 });
  assert.ok(s3.every((id) => bank.byId.get(id)!.tier === 'A'), 'tier A only');
  assert.ok(!s3.some((id) => s1.includes(id) || s2.includes(id)));
  assert.ok(s3.includes('ai-ok') && unseen.every((id) => s3.includes(id)), 'the verified AI question + the two never-seen ones');
  assert.ok(!s3.some((id) => secureA.slice(0, -2).includes(id)), 'never a seen question');
  for (const id of ['ai-old', 'ai-mismatch', 'ai-none']) assert.ok(!s3.includes(id), `${id}: no verified key for its current version`);
  assert.equal(r.excluded.unverified, 3);
  assert.equal(r.excluded.seen, 13);
  assert.equal(r.excluded.earlier, 8);
  assert.equal(r.excluded.outOfScope, 1);
  const nonA = S.eligibleForSealing(bank, cfg(), new Set([...s1, ...s2])).pool.filter((q) => q.tier !== 'A').length;
  assert.equal(r.excluded.tier, nonA);
  assert.deepEqual(r.notes, []);
});

it('addForm: a domain short of eligible questions → 422 with what is missing per domain, nothing written; allowShort → a smaller form with the same weights', () => {
  const bank = bankNow();
  const before = fs.readFileSync(SEALED(), 'utf8');
  // tier A left: secure 13 (15 − 2 in S3) · resilient 7 (10 − 3) · performance 23 · cost 19 (18 + x-req); 50 → 15/13/12/10
  assert.deepEqual(err(() => S.addForm(bank, [], cfg(), { tier: 'A', size: 50 })), [
    422,
    'Không đủ câu đủ điều kiện để thêm một đề 50 câu (chỉ câu tầng A): D1 thiếu 2 câu (có 13/15), D2 thiếu 6 câu (có 7/13). Viết thêm câu cho các domain đó, giảm --size, hoặc thêm --allow-short để tạo đề nhỏ hơn vẫn giữ trọng số domain.',
  ]);
  assert.equal(fs.readFileSync(SEALED(), 'utf8'), before, 'refused: nothing written');
  // the largest form every domain can fill: 29 → 9/7/7/6 (30 would ask resilient for 8)
  const r = S.addForm(bank, [], cfg(), { tier: 'A', size: 50, allowShort: true });
  assert.deepEqual(r.created, ['S4']);
  assert.equal(r.size, 29);
  const s4 = S.formIds('S4');
  assert.deepEqual(byDomain(bank, s4), { secure: 9, resilient: 7, performance: 7, cost: 6 });
  assert.ok(s4.every((id) => bank.byId.get(id)!.tier === 'A'));
  assert.deepEqual(r.notes, ['Đề S4 có 29/50 câu (chỉ câu tầng A): D1 thiếu 2 câu (có 13/15), D2 thiếu 6 câu (có 7/13) — đề nhỏ hơn vẫn giữ trọng số domain.']);
  const earlier = new Set(S.loadSealed().forms.slice(0, 3).flatMap((f) => f.ids));
  assert.ok(!s4.some((id) => earlier.has(id)), 'never a question of another form');
  // not even the smallest form: refused, also with allowShort (resilient has no tier-A question left)
  assert.deepEqual(err(() => S.addForm(bank, [], cfg(), { tier: 'A', size: 10, allowShort: true })), [422, 'Không đủ câu đủ điều kiện cho cả một đề 10 câu (chỉ câu tầng A): D2 thiếu 3 câu (có 0/3).']);
});

it('sealed forms prefer tier A inside each task bucket (after never-seen), then the other exam-like questions', () => {
  const bank = bankNow();
  const [c, b, a] = ['m-31-0', 'm-31-4', 'm-31-5'].map((id) => bank.byId.get(id)!);
  assert.deepEqual([c.tier, b.tier, a.tier], ['C', 'B', 'A']);
  assert.deepEqual(S.pickForms([c, b, a], 1, 10, bank.taxonomy, new Set())[0].map((q) => q.id), ['m-31-5', 'm-31-4', 'm-31-0']);
  assert.deepEqual(S.pickForms([c, b, a], 1, 10, bank.taxonomy, new Set([a.id]))[0].map((q) => q.id), ['m-31-4', 'm-31-0', 'm-31-5'], 'never-seen first');
});

it('addForm: without --tier any eligible question (tier A first in every task); at most 5 forms sealed at once', () => {
  const bank = bankNow();
  const history = new Set(S.loadSealed().forms.flatMap((f) => f.ids));
  const tasksWithA = new Set(S.eligibleForSealing(bank, cfg(), history).pool.filter((q) => q.tier === 'A').map((q) => q.task));
  const r = S.addForm(bank, [], cfg(), { size: 10 });
  assert.deepEqual(r.created, ['S5']);
  const s5 = S.formIds('S5').map((id) => bank.byId.get(id)!);
  assert.deepEqual(byDomain(bank, s5.map((q) => q.id)), { secure: 3, resilient: 3, performance: 2, cost: 2 });
  assert.ok(s5.some((q) => q.tier !== 'A'), 'resilient has no tier A left: other tiers fill its quota');
  for (const q of s5) if (tasksWithA.has(q.task)) assert.equal(q.tier, 'A', `task ${q.task} still had a tier-A question`);
  assert.equal(r.excluded.tier, 0);
  const sealedNow = S.loadSealed().forms.filter((f) => f.status === 'sealed').map((f) => f.id);
  assert.deepEqual(sealedNow, ['S1', 'S2', 'S3', 'S4', 'S5']);
  assert.deepEqual(err(() => S.addForm(bank, [], cfg(), { size: 10 })), [
    409,
    'Đang có 5 đề niêm phong chưa làm (S1, S2, S3, S4, S5) — tối đa 5 đề cùng lúc: làm hoặc mở sớm bớt một đề trước khi thêm.',
  ]);
  // createForms keeps its rule: no new batch while a form is sealed
  assert.equal(err(() => S.createForms(bank, [], cfg(), { forms: 1, size: 10 }))?.[0], 409);
});

it('npm run seal -- --add: exit codes, usage errors, refusals — never a question id on screen', () => {
  S.releaseForm('S5'); // room for one more sealed form
  const run = (...args: string[]) => spawnSync(process.execPath, ['scripts/seal.ts', ...args], { cwd: TRAINER, env: { ...process.env, TRAINER_HOME: HOME, NODE_OPTIONS: '' }, encoding: 'utf8' });
  const ids = bankNow().questions.map((q) => q.id);
  const clean = (out: string) => !ids.some((id) => new RegExp(`(?<![\\w-])${id}(?![\\w-])`).test(out));
  let r = run('--add', '--size', '10');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /✓ Đã thêm S6 \(10 câu\) từ \d+ câu đủ điều kiện \(loại: 0 đã gặp khi luyện · 1 ngoài phạm vi \/ legacy · /);
  assert.match(r.stdout, /S6 +🔒 niêm phong +10 câu/);
  assert.match(r.stdout, /S5 +🔓 đã mở sớm/);
  assert.ok(clean(r.stdout + r.stderr), 'no question id printed');
  // five sealed again → refused (exit 1)
  r = run('--add', '--tier', 'a', '--size', '10');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /tối đa 5 đề cùng lúc/);
  S.releaseForm('S6');
  // tier A, too large: refused with the per-domain shortage
  r = run('--add', '--tier', 'A', '--size', '60');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^✗ Không đủ câu đủ điều kiện để thêm một đề 60 câu \(chỉ câu tầng A\): D1 thiếu \d+ câu \(có \d+\/18\), D2 thiếu 16 câu \(có 0\/16\)/);
  assert.ok(clean(r.stdout + r.stderr));
  // usage errors (exit 2)
  for (const args of [['--add', '--tier', 'X'], ['--add', '--tier'], ['--tier', 'A'], ['--allow-short'], ['--add', '--forms', '1'], ['--add', '--release', 'S1'], ['--add', '--reset']]) {
    const u = run(...args);
    assert.equal(u.status, 2, `${args.join(' ')} → ${u.stdout}${u.stderr}`);
    assert.match(u.stderr, /Dùng: npm run seal -- .*--add \[--tier A\]/);
  }
  // the other commands are unchanged
  r = run('--status');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /S4 +🔒 niêm phong +29 câu/);
  assert.ok(clean(r.stdout));
});
