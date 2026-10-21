// Unit tests for the sealed forms (A1, server/lib/sealed.ts) and the computed bank fields of v4 (requirements, outOfScope):
// deterministic file, stratification by domain weight + task, exclusions (out of scope, drafts, siblings, open issues,
// high-severity lint, earlier forms), never-seen first, longer stems first, multiple-response balance, used / released
// transitions, refusals (409 / 422 / 404 / 400), the no-op at exam.sealed_forms = 0, gradeAndSave → markFormUsed and the
// `npm run seal` CLI (never prints a question id). Throw-away data root only (TRAINER_HOME). Run: npm test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Attempt, Question, SubmitRequest } from '../shared/types.ts';

const TRAINER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-sealed-')));
const HOME = path.join(ROOT, 'home');
const REPO = path.join(ROOT, 'repo'); // repo root with study notes + practice-exams sources (never the real repo)
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
fs.mkdirSync(path.join(REPO, 'practice-exams'), { recursive: true });
fs.mkdirSync(path.join(HOME, 'bank', 'packs', 'manual'), { recursive: true });
fs.mkdirSync(path.join(HOME, 'results'), { recursive: true });
fs.copyFileSync(path.join(TRAINER, 'bank', 'taxonomy.yaml'), path.join(HOME, 'bank', 'taxonomy.yaml'));
const CONFIG = 'exam:\n  sealed_forms: 0\n  sealed_size: 20\ncache:\n  sqlite: false\nquality:\n  embeddings: off\nsync:\n  auto: off\n';
fs.writeFileSync(path.join(HOME, 'config.yaml'), CONFIG);
process.env.TRAINER_HOME = HOME; // before config.ts is imported (dynamic imports below)
process.env.TRAINER_REPO = REPO;

const { DATA_DIR, loadConfig } = await import('../server/config.ts');
const it = DATA_DIR === HOME ? test : test.skip; // never write next to the real results/

const { serializePack } = await import('../server/lib/pack-format.ts');
const { stringifyFrontMatter } = await import('../server/lib/frontmatter.ts');
const { loadBank, stemRequirements, isNegativeStem, correctOutOfScope } = await import('../server/lib/bank.ts');
const { addIssue } = await import('../server/lib/issues.ts');
const S = await import('../server/lib/sealed.ts');
const results = await import('../server/lib/results.ts');
const N = await import('../server/lib/notes.ts');
const { addRating } = await import('../server/lib/ratings.ts');
const { appendQa, qaSnapshotLines } = await import('../server/lib/ask.ts');
const { qualitySnapshotLines } = await import('../server/lib/quality.ts');
const { buildSnapshot } = await import('../server/lib/snapshot.ts');

// ── fixture: 14 tasks × 7 questions with lexically unrelated stems, + questions every exclusion rule must catch ──────
const SYL = ['ka', 'lo', 'mi', 'nu', 'pe', 'ra', 'si', 'to', 'va', 'ze', 'bo', 'du', 'fi', 'gu', 'ha', 'je'];
/** A made-up word unique to `n` (≥ 3 letters): stems built from them share no vocabulary. */
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
  status?: 'active' | 'draft' | 'retired';
  variantOf?: string[];
}

function draft(i: number, domain: string, task: string, opts: { long?: boolean; multi?: boolean; id?: string } = {}): Draft {
  const base = 1000 + i * 100;
  const stem = `${words(base, opts.long ? 58 : 14)}. Which option meets the requirement?${opts.multi ? ' (Choose TWO)' : ''}`;
  const n = opts.multi ? 5 : 4;
  const options = Array.from({ length: n }, (_, k) => ({ key: 'ABCDE'[k], text: `Use ${word(base + 70 + k)} with ${word(base + 80 + k)}` }));
  return { id: opts.id ?? `g-${String(i).padStart(3, '0')}`, stem, options, answer: opts.multi ? ['A', 'C'] : ['B'], explanation: EXPLANATION, domain, topic: 'storage', difficulty: 'medium', time: 60, task };
}

const taxonomy = (await import('../server/lib/taxonomy.ts')).loadTaxonomy();
const drafts: Draft[] = [];
let n = 0;
for (const t of taxonomy.tasks) {
  for (let k = 0; k < 7; k++) drafts.push(draft(n++, t.domain, t.id, { long: k === 6, multi: k % 3 === 1 }));
}
const special = (i: number, id: string, patch: Partial<Draft> = {}): Draft => ({ ...draft(i, 'secure', '1.1', { id }), ...patch });
const SPECIAL: Draft[] = [
  special(900, 'x-oos', { options: [{ key: 'A', text: 'Use Amazon S3 for the artifacts' }, { key: 'B', text: 'Store the code in AWS CodeCommit' }, { key: 'C', text: 'Use Amazon EFS for the code' }, { key: 'D', text: 'Use Amazon EBS snapshots for the code' }] }),
  special(901, 'x-draft', { status: 'draft' }),
  special(902, 'x-retired', { status: 'retired' }),
  special(903, 'x-var-orig'),
  special(904, 'x-var-copy', { variantOf: ['x-var-orig'] }),
  special(905, 'x-sib-a'),
  { ...special(905, 'x-sib-b'), options: draft(906, 'secure', '1.1').options }, // same stem as x-sib-a, other options
  special(907, 'x-issue'),
  special(908, 'x-dup-opts', { options: [{ key: 'A', text: 'Use the same thing' }, { key: 'B', text: 'Use the same thing' }, { key: 'C', text: `Use ${word(99901)}` }, { key: 'D', text: `Use ${word(99902)}` }] }),
];
const EXCLUDED = ['x-oos', 'x-draft', 'x-retired', 'x-var-orig', 'x-var-copy', 'x-sib-a', 'x-sib-b', 'x-issue', 'x-dup-opts'];
fs.writeFileSync(
  path.join(HOME, 'bank', 'packs', 'manual', 'sealed-fixture.md'),
  serializePack({ pack: 'sealed-fixture', title: 'Sealed fixture', origin: 'manual' }, '', [...drafts, ...SPECIAL] as never, (x) => stringifyFrontMatter(x)),
);
addIssue('x-issue', 'wrong-answer', 'Đáp án có vẻ sai');

const cfgWith = (exam: { sealed_forms: number; sealed_size: number }) => ({ ...loadConfig(), exam });
const bankNow = () => loadBank();
const SEALED = () => path.join(HOME, 'results', 'sealed.md');
const attemptOf = (id: string, ids: string[], extra: Partial<Attempt> = {}): Attempt =>
  ({
    id,
    mode: 'custom',
    title: id,
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
    file: `${id}.md`,
    ...extra,
  }) as Attempt;

// ── computed bank fields (B4 / B5) ─────────────────────────────────────────

it('requirements: taxonomy.keywords groups on the stem (ALL-CAPS words exact), NOT/EXCEPT questions are "negative"', () => {
  const tax = bankNow().taxonomy;
  assert.deepEqual(stemRequirements('Which option is the MOST cost-effective, highly available design with low latency?', tax), ['cost', 'resilient', 'performance']);
  assert.deepEqual(stemRequirements('Which solution has the LEAST operational overhead?', tax), ['ops'], 'LEAST operational overhead is an ops requirement, not a negation');
  assert.deepEqual(stemRequirements('The data must be **encrypted at rest**. Which service?', tax), ['secure'], 'Markdown emphasis does not hide a phrase');
  assert.deepEqual(stemRequirements('A team stores photos. Which service fits?', tax), []);
  assert.deepEqual(stemRequirements('Which TWO services are NOT supported targets? (Choose TWO)', tax), ['negative']);
  assert.deepEqual(stemRequirements('All of the following are valid EXCEPT:', tax), ['negative']);
  assert.ok(isNegativeStem('Which option is LEAST likely to succeed?', tax));
  assert.equal(isNegativeStem('The bucket must NOT be public. Which design meets the requirement?', tax), false, 'a NOT constraint outside the question sentence');
  assert.equal(isNegativeStem('Which design does not need servers?', tax), false, 'lowercase "not" is no exam-style negative');
  assert.deepEqual(stemRequirements('MOST cost-effective option', { ...tax, keywords: {} }), [], 'no keyword groups → nothing');
});

it('outOfScope: a correct option naming a `scope: out` service; loadBank fills requirements and outOfScope', () => {
  const tax = bankNow().taxonomy;
  const opts = (texts: string[]) => texts.map((text, i) => ({ key: 'ABCD'[i], text }));
  assert.deepEqual(correctOutOfScope({ options: opts(['AWS CodeCommit', 'Amazon S3']), answer: ['A'] }, tax), ['CodeCommit']);
  assert.deepEqual(correctOutOfScope({ options: opts(['AWS CodeCommit', 'Amazon S3']), answer: ['B'] }, tax), [], 'only a distractor');
  assert.deepEqual(correctOutOfScope({ options: opts(['Ingest the IoT sensor data with Kinesis Data Streams', 'x']), answer: ['A'] }, tax), [], 'IoT devices are no AWS IoT service');
  assert.deepEqual(correctOutOfScope({ options: opts(['Register the devices in AWS IoT Core', 'x']), answer: ['A'] }, tax), ['IoT Core']);
  assert.deepEqual(correctOutOfScope({ options: opts(['Orchestrate with AWS CodePipeline', 'x']), answer: ['A'] }, tax), [], 'unlisted ≠ out of scope');
  const bank = bankNow();
  assert.equal(bank.byId.get('x-oos')!.outOfScope, true);
  assert.equal(bank.byId.get('g-000')!.outOfScope, undefined);
  assert.deepEqual(bank.byId.get('g-000')!.requirements, []);
});

// ── siblings, quotas ────────────────────────────────────────────────────────

it('siblingIds: variant_of in either direction, similar stems (≥ 0.5, or ≥ 0.25 with the same key), extra pairs; retired questions are nobody’s sibling', () => {
  const q = (id: string, stem: string, key: string, extra: Partial<Question> = {}) =>
    ({ id, stem, options: [{ key: 'A', text: key }, { key: 'B', text: `other ${id}` }], answer: ['A'], variantOf: [], status: 'active', ...extra }) as Question;
  const qs = [
    q('a', 'alpha bravo charlie delta echo foxtrot golf hotel', 'Amazon S3'),
    q('b', 'alpha bravo charlie delta echo foxtrot india juliet', 'Amazon EFS'), // 6/10 = 0.6 → siblings
    q('c', 'kilo lima mike november alpha bravo oscar papa', 'Amazon SQS'),
    q('d', 'kilo lima mike quebec romeo sierra tango uniform', 'Amazon SQS'), // 3/13 ≈ 0.23 < 0.25 → no
    q('e', 'victor whiskey xray yankee zulu alpha bravo charlie', 'Amazon SNS'),
    q('f', 'victor whiskey xray yankee one two three four', 'Amazon SNS'), // 4/12 ≈ 0.33 + same key → siblings
    q('g', 'gamma delta', 'Lambda', { variantOf: ['h'] }),
    q('h', 'epsilon zeta', 'Fargate'),
    q('i', 'theta iota', 'ECS', { variantOf: ['j'] }),
    q('j', 'kappa lambda', 'EKS', { status: 'retired' }),
    q('k', 'mu nu', 'ECR'),
    q('l', 'xi omicron', 'RDS'),
  ];
  const sib = S.siblingIds(qs, [{ a: 'k', b: 'l' }, { a: 'k', b: 'nope' }]);
  assert.deepEqual([...sib].sort(), ['a', 'b', 'e', 'f', 'g', 'h', 'k', 'l']);
});

it('domainQuotas: exam weights with the largest remainder (50 → 15/13/12/10, 20 → 6/5/5/4, 10 → 3/3/2/2)', () => {
  const tax = bankNow().taxonomy;
  const q = (size: number) => [...S.domainQuotas(size, tax).values()];
  assert.deepEqual(q(50), [15, 13, 12, 10]);
  assert.deepEqual(q(20), [6, 5, 5, 4]);
  assert.deepEqual(q(10), [3, 3, 2, 2]);
  assert.equal(q(37).reduce((a, b) => a + b, 0), 37);
});

// ── creation ───────────────────────────────────────────────────────────────

it('exam.sealed_forms = 0: ensureSealed is a no-op — nothing written, nothing hidden', () => {
  const state = S.ensureSealed(bankNow(), [], loadConfig());
  assert.deepEqual(state.forms, []);
  assert.equal(fs.existsSync(SEALED()), false);
  assert.equal(S.sealedIds().size, 0);
  assert.deepEqual(S.sealedStatus(), { forms: [], size: 0, sealed: 0 });
});

it('ensureSealed creates the forms once: deterministic file (no timestamps), stratified by domain and task, exclusions applied', () => {
  const cfg = cfgWith({ sealed_forms: 2, sealed_size: 20 });
  const state = S.ensureSealed(bankNow(), [], cfg);
  assert.deepEqual(state.forms.map((f) => [f.id, f.status, f.ids.length]), [['S1', 'sealed', 20], ['S2', 'sealed', 20]]);
  const text = fs.readFileSync(SEALED(), 'utf8');
  assert.match(text, /^---\nkind: sealed\nsize: 20\nforms:\n {2}- id: S1\n {4}status: sealed\n {4}ids: \[/);
  assert.doesNotMatch(text, /used_at|released_at|\d{4}-\d{2}-\d{2}T/, 'no timestamp at creation');
  assert.doesNotMatch(text.split('\n---')[0], /\battempt\b/, 'results.ts skips the file without parsing it as an attempt');
  // a second machine (or a reset) with the same bank and history writes the same bytes
  S.resetSealed();
  S.ensureSealed(bankNow(), [], cfg);
  assert.equal(fs.readFileSync(SEALED(), 'utf8'), text);
  // an existing file is never touched again, whatever the config says
  S.ensureSealed(bankNow(), [], cfgWith({ sealed_forms: 3, sealed_size: 30 }));
  assert.equal(fs.readFileSync(SEALED(), 'utf8'), text);

  const bank = bankNow();
  const all = state.forms.flatMap((f) => f.ids);
  assert.equal(new Set(all).size, 40, 'no question in two forms');
  for (const id of EXCLUDED) assert.ok(!all.includes(id), `${id} is never sealed`);
  for (const f of state.forms) {
    const qs = f.ids.map((id) => bank.byId.get(id)!);
    const by = (k: (q: Question) => string) => qs.reduce<Record<string, number>>((m, q) => ((m[k(q)] = (m[k(q)] ?? 0) + 1), m), {});
    assert.deepEqual(by((q) => q.domain), { secure: 6, resilient: 5, performance: 5, cost: 4 }, `${f.id} domain mix`);
    const tasks = by((q) => q.task!);
    for (const d of bank.taxonomy.domains) {
      const counts = bank.taxonomy.tasks.filter((t) => t.domain === d.id).map((t) => tasks[t.id] ?? 0);
      assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `${f.id} ${d.id}: tasks round-robin ${counts}`);
    }
  }
  const multi = state.forms.map((f) => f.ids.filter((id) => bank.byId.get(id)!.answer.length > 1).length);
  assert.ok(Math.abs(multi[0] - multi[1]) <= 1, `multiple-response balanced ${multi}`);
  // longer stems first: the long-form question of every task bucket is its first pick
  const long = bank.questions.filter((q) => q.longForm && q.id.startsWith('g-')).map((q) => q.id);
  assert.equal(long.length, 14);
  for (const id of long) assert.ok(all.includes(id), `long-form ${id} sealed`);
});

it('eligibleForSealing reports why questions were left out', () => {
  const e = S.eligibleForSealing(bankNow(), loadConfig());
  assert.deepEqual(e.excluded, { inactive: 2, earlier: 0, outOfScope: 1, siblings: 4, quality: 2, unverified: 0 });
  assert.equal(e.pool.length, drafts.length);
});

it('[v5] an AI-written question is sealed only once a second model confirmed the key of its current version', () => {
  const ai = { origin: 'ai' as const, hash: 'h1' };
  const v = (x: Record<string, unknown>) => ({ qid: 'q', at: '', model: '', hash: 'h1', outcome: 'ok', ...x }) as never;
  assert.equal(S.verifiedForSealing({ origin: 'imported', hash: 'h1' }, undefined), true, 'imported questions need no verdict');
  assert.equal(S.verifiedForSealing(ai, undefined), false, 'never blind-solved');
  assert.equal(S.verifiedForSealing(ai, v({})), true);
  assert.equal(S.verifiedForSealing(ai, v({ hash: 'old' })), false, 'verdict of an older version');
  assert.equal(S.verifiedForSealing(ai, v({ outcome: 'mismatch' })), false);
  assert.equal(S.verifiedForSealing(ai, v({ outcome: 'mismatch', decision: 'approved' })), true, 'the learner approved the key');
  assert.equal(S.verifiedForSealing(ai, v({ outcome: 'ambiguous', grounded: { hash: 'h1', outcome: 'ok', check: 'grounded', fact: 'correct' } })), true);
  assert.equal(S.verifiedForSealing({ origin: 'doc', hash: 'h1' }, undefined), false, 'generated from notes = AI-written');

  const bank = bankNow();
  const target = bank.questions.find((q) => S.eligibleForSealing(bank, loadConfig(), new Set(), {}).pool.some((p) => p.id === q.id))!;
  const aiBank = { ...bank, questions: bank.questions.map((q) => (q.id === target.id ? { ...q, origin: 'ai' as const } : q)) } as typeof bank;
  const without = S.eligibleForSealing(aiBank, loadConfig(), new Set(), {});
  assert.equal(without.excluded.unverified, 1);
  assert.ok(!without.pool.some((q) => q.id === target.id));
  const verified = S.eligibleForSealing(aiBank, loadConfig(), new Set(), { [target.id]: v({ qid: target.id, hash: target.hash }) });
  assert.equal(verified.excluded.unverified, 0);
  assert.ok(verified.pool.some((q) => q.id === target.id));
});

it('reading: sealedIds / sealedKey / formIds; the status route shape never carries a question id', () => {
  const st = S.loadSealed();
  const ids = S.sealedIds();
  assert.equal(ids.size, 40);
  assert.match(S.sealedKey(), /^[0-9a-f]{12}$/);
  assert.deepEqual(S.formIds('S2'), st.forms[1].ids);
  assert.deepEqual(S.formIds('S9'), []);
  const status = S.sealedStatus();
  assert.deepEqual(status, { forms: [{ id: 'S1', status: 'sealed', count: 20 }, { id: 'S2', status: 'sealed', count: 20 }], size: 20, file: 'results/sealed.md', sealed: 40 });
  const json = JSON.stringify(status);
  for (const id of ids) assert.ok(!json.includes(id));
});

it('never-seen questions first; seen ones only fill what the unseen cannot; longer stems first', () => {
  const bank = bankNow();
  const pool = S.eligibleForSealing(bank, loadConfig()).pool;
  const t11 = pool.filter((q) => q.task === '1.1');
  // seen: every 1.1 question but two → a form asking 4 secure questions per task gets those two first
  const seen = new Set(t11.slice(0, -2).map((q) => q.id));
  const forms = S.pickForms(pool, 1, 20, bank.taxonomy, seen);
  const picked11 = forms[0].filter((q) => q.task === '1.1').map((q) => q.id);
  assert.equal(picked11.length, 2);
  for (const q of t11.slice(-2)) assert.ok(picked11.includes(q.id), `${q.id} (never seen) is picked`);
  // nothing seen when the unseen pool can fill every slot
  const none = S.pickForms(pool, 2, 20, bank.taxonomy, new Set([t11[0].id]));
  assert.ok(!none.flat().some((q) => q.id === t11[0].id));
  // the long stem of a task bucket comes before the short ones
  const longOne = pool.find((q) => q.task === '2.1' && q.longForm)!;
  assert.ok(S.pickForms(pool, 1, 10, bank.taxonomy, new Set())[0].some((q) => q.id === longOne.id));
  // all seen → the forms still fill (second pass)
  assert.equal(S.pickForms(pool, 1, 20, bank.taxonomy, new Set(pool.map((q) => q.id)))[0].length, 20);
});

// ── transitions ────────────────────────────────────────────────────────────

it('markFormUsed: sealed → used (questions return), no-op for unknown / used forms; releaseForm: 400 / 404 / 409 / released', () => {
  const s1 = S.formIds('S1');
  S.markFormUsed('S1', 'att-1', '2026-11-01T10:00:00+07:00');
  let st = S.loadSealed();
  assert.deepEqual(st.forms[0], { id: 'S1', ids: s1, status: 'used', usedAt: '2026-11-01T10:00:00+07:00', attempt: 'att-1' });
  assert.equal(S.sealedIds().size, 20);
  assert.ok(!s1.some((id) => S.sealedIds().has(id)));
  const before = fs.readFileSync(SEALED(), 'utf8');
  assert.match(before, /used_at: "?2026-11-01T10:00:00\+07:00"?\n {4}attempt_id: att-1/);
  S.markFormUsed('S1', 'att-2', '2026-11-02T10:00:00+07:00'); // second submit keeps the first use
  S.markFormUsed('S7', 'att-3', '2026-11-02T10:00:00+07:00');
  assert.equal(fs.readFileSync(SEALED(), 'utf8'), before);

  const err = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return [(e as InstanceType<typeof S.SealedError>).status, (e as Error).message];
    }
    return undefined;
  };
  assert.deepEqual(err(() => S.releaseForm('')), [400, 'Thiếu mã đề (form), ví dụ “S1”.']);
  assert.deepEqual(err(() => S.releaseForm('S9')), [404, 'Không có đề niêm phong “S9”.']);
  assert.deepEqual(err(() => S.releaseForm('S1')), [409, 'Đề S1 không còn niêm phong (đã làm hoặc đã mở sớm).']);
  assert.deepEqual(err(() => S.createForms(bankNow(), [], loadConfig(), { forms: 1, size: 10 })), [409, 'Đang có đề niêm phong chưa làm (S2) — làm hoặc mở sớm các đề đó trước khi tạo đề mới.']);
  const released = S.releaseForm('S2');
  assert.equal(released.status, 'released');
  assert.match(released.releasedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
  st = S.loadSealed();
  assert.deepEqual(st.forms.map((f) => f.status), ['used', 'released']);
  assert.equal(S.sealedIds().size, 0);
  assert.equal(S.sealedKey(), '');
});

it('new forms after use: numbering continues, questions of earlier forms are never re-picked; 422 when the bank cannot fill them', () => {
  const earlier = new Set(S.loadSealed().forms.flatMap((f) => f.ids));
  const r = S.createForms(bankNow(), [], loadConfig(), { forms: 2, size: 20 });
  assert.deepEqual(r.created, ['S3', 'S4']);
  assert.ok(!r.state.forms.slice(2).flatMap((f) => f.ids).some((id) => earlier.has(id)), 'history excluded');
  assert.equal(r.excluded.earlier, 40);
  assert.deepEqual(S.loadSealed().forms.map((f) => `${f.id}:${f.status}`), ['S1:used', 'S2:released', 'S3:sealed', 'S4:sealed']);
  S.releaseForm('S3');
  S.releaseForm('S4');
  // 98 eligible − 80 used in four forms = 18 → two forms of ≥ 10 cannot be filled
  assert.throws(
    () => S.createForms(bankNow(), [], loadConfig(), { forms: 2, size: 20 }),
    (e: Error & { status?: number }) => e.status === 422 && e.message === 'Không đủ câu để niêm phong: cần ít nhất 10 câu đủ điều kiện cho mỗi đề, hiện chỉ có 18.',
  );
  // one form takes what is left, with a note
  const one = S.createForms(bankNow(), [], loadConfig(), { forms: 1, size: 20 });
  assert.deepEqual(one.created, ['S5']);
  assert.equal(one.state.forms[4].ids.length, 18);
  assert.match(one.notes[0], /^Đề S5 chỉ có 18\/20 câu/);
});

it('after a reset the numbering continues past every sealed_form of the attempt files', () => {
  S.resetSealed();
  assert.equal(fs.existsSync(SEALED()), false);
  const r = S.createForms(bankNow(), [attemptOf('a1', [], { sealedForm: 'S7' })], loadConfig(), { forms: 1, size: 10 });
  assert.deepEqual(r.created, ['S8']);
});

it('a broken sealed.md fails closed: every id it lists stays hidden, the error is reported, nothing is written until it is fixed', () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    S.resetSealed(); // S8 of the previous test
    S.createForms(bankNow(), [], loadConfig(), { forms: 2, size: 10 });
    const good = fs.readFileSync(SEALED(), 'utf8');
    const s1 = S.formIds('S1');
    const s2 = S.formIds('S2');
    const status = (e: unknown) => (e as { status?: number }).status;
    const refusedAll = () => {
      for (const fn of [() => S.createForms(bankNow(), [], loadConfig(), {}), () => S.releaseForm('S1'), () => S.resetSealed()]) {
        assert.throws(fn, (e) => status(e) === 409 && /results\/sealed\.md đang lỗi/.test((e as Error).message));
      }
    };
    // a git conflict left in the file (two machines changed it): both sides stay hidden, not "no forms"
    const lines = good.split('\n');
    const head = lines.findIndex((l) => l.startsWith('  - id: S1'));
    const conflict = [...lines.slice(0, head), '<<<<<<< HEAD', ...lines.slice(head, head + 3), '=======', '  - id: S1', '    status: used', `    ids: [ ${s1.join(', ')} ]`, '>>>>>>> other', ...lines.slice(head + 3)].join('\n');
    fs.writeFileSync(SEALED(), conflict);
    assert.deepEqual([...S.sealedIds()].sort(), [...s1, ...s2].sort(), 'every id on an `ids:` line stays hidden');
    assert.deepEqual(S.loadSealed().forms, [], 'no form is usable for a sealed exam');
    const st = S.sealedStatus();
    assert.equal(st.sealed, 20);
    assert.match(st.error ?? '', /^results\/sealed\.md đang lỗi: còn dấu xung đột git/);
    assert.match(st.error ?? '', /20 câu có trong file vẫn được giữ kín/);
    assert.match(st.error ?? '', /npm run seal -- --reset --force/);
    refusedAll();
    S.markFormUsed('S1', 'att-x', '2026-11-01T10:00:00+07:00'); // the submit path: no throw, no write
    S.ensureSealed(bankNow(), [], cfgWith({ sealed_forms: 2, sealed_size: 20 }));
    assert.equal(fs.readFileSync(SEALED(), 'utf8'), conflict, 'never overwritten automatically');

    // hand edits: a duplicate or missing form id, an unknown status, a YAML error — each one is an error, ids stay hidden
    for (const [label, text, why] of [
      ['duplicate id', good.replace('- id: S1\n', '- id: S2\n'), /id đề trùng: S2/],
      ['missing id', good.replace('  - id: S1\n    status: sealed\n', '  - status: sealed\n'), /đề thứ 1 thiếu id/],
      ['unknown status', good.replace('status: sealed', 'status: opened'), /status của S1 không hợp lệ/],
      ['YAML error', good.replace('kind: sealed', 'kind: [sealed'), /YAML|front matter/],
    ] as const) {
      fs.writeFileSync(SEALED(), text);
      assert.match(S.sealedStatus().error ?? '', why, label);
      assert.deepEqual([...S.sealedIds()].sort(), [...s1, ...s2].sort(), `${label}: ids stay hidden`);
      refusedAll();
    }
    // block-style id lists are found too
    assert.deepEqual(S.idsInText('forms:\n  - id: S1\n    ids:\n      - a-1\n      - "b-2"\n  - id: S2\n    ids: [c-3,\n      d-4]\n'), ['a-1', 'b-2', 'c-3', 'd-4']);
    // the deliberate way out: --reset --force
    S.resetSealed({ force: true });
    assert.equal(fs.existsSync(SEALED()), false);
    assert.equal(S.sealedStatus().error, undefined);
  } finally {
    console.warn = warn;
  }
});

it('gradeAndSave of a sealed exam marks its form used (results.ts → markFormUsed)', () => {
  S.createForms(bankNow(), [], loadConfig(), { forms: 1, size: 10 });
  const form = S.loadSealed().forms[0];
  const bank = bankNow();
  const now = new Date().toISOString();
  const req: SubmitRequest = {
    session: {
      sessionId: 'sealed-session',
      mode: 'sealed',
      title: `Đề niêm phong ${form.id}`,
      feedback: 'exam',
      timeLimit: 0,
      estimateTotal: 600,
      timingPreset: 'official',
      questions: form.ids.map((id) => ({ id })),
      selection: { mode: 'sealed', form: form.id },
      createdAt: now,
      notes: [],
      sealedForm: form.id,
    },
    answers: form.ids.map((id) => ({ q: id, pick: bank.byId.get(id)!.answer, t: 40 })),
    startedAt: now,
    finishedAt: now,
    timedOut: false,
    timeUsed: 400,
  };
  const attempt = results.gradeAndSave(req, bank);
  const used = S.loadSealed().forms[0];
  assert.equal(used.status, 'used');
  assert.equal(used.attempt, attempt.id);
  assert.equal(S.sealedIds().size, 0, 'its questions are back in the practice pool');
  S.resetSealed();
});

// ── npm run seal ───────────────────────────────────────────────────────────

it('npm run seal: status, create, release, reset — exit codes, and never a question id on screen', () => {
  const run = (...args: string[]) => spawnSync(process.execPath, ['scripts/seal.ts', ...args], { cwd: TRAINER, env: { ...process.env, TRAINER_HOME: HOME, NODE_OPTIONS: '' }, encoding: 'utf8' });
  const ids = bankNow().questions.map((q) => q.id);
  const clean = (out: string) => !ids.some((id) => new RegExp(`(?<![\\w-])${id}(?![\\w-])`).test(out));
  let r = run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Chưa có đề niêm phong/);
  r = run('--forms', '2', '--size', '12');
  assert.equal(r.status, 0, r.stderr);
  // numbering continues after the sealed_form of the attempt file written by the gradeAndSave test (S1)
  assert.match(r.stdout, /✓ Đã tạo S2, S3 từ \d+ câu đủ điều kiện/);
  assert.match(r.stdout, /S2 +🔒 niêm phong +12 câu/);
  assert.match(r.stdout, /Đang giữ riêng 24 câu/);
  assert.ok(clean(r.stdout), 'no question id printed');
  r = run('--forms', '1');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Đang có đề niêm phong chưa làm \(S2, S3\)/);
  r = run('--release', 'S2');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /✓ Đã mở sớm S2: 12 câu trở lại/);
  assert.match(r.stdout, /S2 +🔓 đã mở sớm/);
  r = run('--release', 'S2');
  assert.equal(r.status, 1);
  assert.equal(run('--release').status, 2);
  assert.equal(run('--forms', 'abc').status, 2);
  assert.equal(run('--bogus').status, 2);
  r = run('--reset', '--forms', '0');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Đã xoá mọi đề niêm phong/);
  assert.equal(fs.existsSync(SEALED()), false);
  assert.ok(clean(r.stdout));
});

// ── review R2: nothing served or summarised may reveal a sealed question ───

/** Seals exactly these fixture questions (one hand-written form). */
const sealOnly = (ids: string[], status = 'sealed') =>
  fs.writeFileSync(SEALED(), `---\nkind: sealed\nsize: ${ids.length}\nforms:\n  - id: S1\n    status: ${status}\n    ids: [ ${ids.join(', ')} ]\n---\n`);

it('[R2 #1] served files: sealed.md never; ENRICH batches and practice-exams refused while sealed; pack blocks → placeholder; other trainer files redacted; study notes as they are', () => {
  const bank = bankNow();
  const stemOf = (id: string) => bank.byId.get(id)!.stem.slice(0, 40);
  const data = (p: string) => path.join(HOME, p);
  sealOnly(['g-001', 'g-002']);
  assert.match(N.guardFile(SEALED()).refused ?? '', /Danh sách đề niêm phong không mở trong app/);

  fs.mkdirSync(data('coach/enrich'), { recursive: true });
  fs.writeFileSync(data('coach/enrich/r1-batch.md'), `## 1. \`g-001\`\n\n${stemOf('g-001')}\n`);
  fs.writeFileSync(path.join(REPO, 'practice-exams', '01-x-exam.md'), '# Exam\n\n1. A question with its key.\n');
  assert.match(N.guardFile(data('coach/enrich/r1-batch.md')).refused ?? '', /có thể chứa câu đang niêm phong/);
  assert.ok(N.guardFile(path.join(REPO, 'practice-exams', '01-x-exam.md')).refused);

  const pack = N.guardFile(data('bank/packs/manual/sealed-fixture.md')).content ?? '';
  for (const id of ['g-001', 'g-002']) {
    assert.ok(!pack.includes(`## Q ${id}`) && !pack.includes(stemOf(id)), 'sealed block replaced');
  }
  assert.equal(pack.split('🔒 Câu đang niêm phong').length - 1, 2);
  assert.ok(pack.startsWith('---\npack: sealed-fixture') && pack.includes('## Q g-003') && pack.includes(stemOf('g-003')), 'the rest of the pack stays');

  const report = [
    '---', 'kind: attempt', 'answers:', '  - { q: "g-001", pick: A }', '  - { q: "g-003", pick: B }', '---', '# Bài', '',
    '| # | Câu |', '|---|---|', '| 1 | `g-001` |', '| 2 | `g-003` |', '',
    '## ❌ Câu sai', '', '### 1. `g-001` · storage', '', `> ${stemOf('g-001')}`, '- Đáp án đúng: B', '', '### 2. `g-003` · storage', '', `> ${stemOf('g-003')}`, '',
  ].join('\n');
  fs.mkdirSync(data('results/2026/10'), { recursive: true });
  fs.writeFileSync(data('results/2026/10/r.md'), report);
  const r = N.guardFile(data('results/2026/10/r.md')).content ?? '';
  assert.ok(!r.includes('g-001') && !r.includes(stemOf('g-001')) && !r.includes('Đáp án đúng: B'), 'section, row and front matter line of the sealed question gone');
  assert.ok(r.includes('### 2. `g-003`') && r.includes(stemOf('g-003')), 'other questions stay');
  assert.match(r, /Đã ẩn 3 mục nhắc tới câu đang niêm phong/);
  fs.mkdirSync(data('coach/qa'), { recursive: true });
  fs.writeFileSync(data('coach/qa/g-001.md'), '# 💬 Hỏi AI — `g-001`\n\n### ❓ hôm qua\n\n> vì sao?\n\nVì đáp án đúng là B.\n');
  assert.doesNotMatch(N.guardFile(data('coach/qa/g-001.md')).content ?? '', /đáp án đúng là B/);

  fs.writeFileSync(path.join(REPO, '03-db.md'), '# DB\nMentions g-001 by chance.\n');
  assert.equal(N.guardFile(path.join(REPO, '03-db.md')).content, '# DB\nMentions g-001 by chance.\n', 'study notes are not touched');
  assert.equal(N.readNote('03-db.md'), '# DB\nMentions g-001 by chance.\n');

  sealOnly(['g-001', 'g-002'], 'used'); // nothing sealed any more: everything but the list itself is served again
  assert.match(N.guardFile(data('coach/enrich/r1-batch.md')).content ?? '', /g-001/);
  assert.ok(N.guardFile(path.join(REPO, 'practice-exams', '01-x-exam.md')).content);
  assert.ok(N.guardFile(SEALED()).refused);
  S.resetSealed();
});

it('[R2 #3] the coach snapshot never names a sealed question: a 👎, a Q&A or a bank error recorded before it was sealed', () => {
  addRating('g-004', 'down', 'đáp án gây tranh cãi');
  appendQa('g-004', { at: new Date().toISOString(), question: 'tại sao?', answer: 'Vì đáp án đúng là dịch vụ X.' });
  assert.match(qualitySnapshotLines(bankNow(), [], { background: false }).join('\n'), /`g-004` 👎/, 'named while it is in practice');
  assert.match(qaSnapshotLines(bankNow()).join('\n'), /`g-004`/);
  sealOnly(['g-004']);
  // a second copy of the id in another pack → a bank error naming it (§13)
  const dup = path.join(HOME, 'bank', 'packs', 'manual', 'dup.md');
  fs.writeFileSync(dup, serializePack({ pack: 'dup-pack', title: 'Dup', origin: 'manual' }, '', [draft(950, 'secure', '1.1', { id: 'g-004' })] as never, (x) => stringifyFrontMatter(x)));
  try {
    assert.doesNotMatch(qualitySnapshotLines(bankNow(), [], { background: false }).join('\n'), /g-004/);
    assert.doesNotMatch(qaSnapshotLines(bankNow()).join('\n'), /g-004/);
    assert.ok(bankNow().problems.some((p) => p.level === 'error' && p.qid === 'g-004'), 'the fixture has a bank error naming the sealed id');
    const text = buildSnapshot(bankNow(), loadConfig()).text;
    assert.ok(!text.includes('g-004'), 'not named anywhere in the snapshot');
    assert.match(text.slice(text.indexOf('## 13.'), text.indexOf('## 14.')), /1 lỗi/);
  } finally {
    fs.rmSync(dup);
    fs.rmSync(path.join(HOME, 'bank', 'ratings.md'), { force: true });
    fs.rmSync(path.join(HOME, 'coach', 'qa', 'g-004.md'), { force: true });
    S.resetSealed();
  }
});

it('[R2 β1-#2b] snapshot §16: only the sitting sealed.md recorded (form.attempt) scores — an attempt merely tagged with the form does not', () => {
  const sitting = results.loadAttempts(loadConfig()).find((a) => a.sealedForm === 'S1'); // written by the gradeAndSave test
  assert.ok(sitting, 'fixture: an attempt file tagged sealed_form S1');
  const write = (attempt?: string) =>
    fs.writeFileSync(SEALED(), `---\nkind: sealed\nsize: 1\nforms:\n  - id: S1\n    status: used\n    used_at: 2026-11-01T10:00:00+07:00\n${attempt ? `    attempt_id: ${attempt}\n` : ''}    ids: [ g-010 ]\n---\n`);
  const sec16 = () => {
    const text = buildSnapshot(bankNow(), loadConfig()).text;
    return text.slice(text.indexOf('## 16.'));
  };
  try {
    write();
    assert.match(sec16(), /- S1: ✅ đã làm [^\n]* · 1 câu/);
    assert.doesNotMatch(sec16(), /điểm trên câu mới \*\*/, 'no official sitting recorded → no score');
    write(sitting.id);
    assert.match(sec16(), new RegExp(`- S1: ✅ đã làm [^\\n]*điểm trên câu mới \\*\\*${sitting.score}%\\*\\*`));
  } finally {
    S.resetSealed();
  }
});
