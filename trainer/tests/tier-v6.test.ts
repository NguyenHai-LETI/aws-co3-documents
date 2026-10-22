// [v6] Question tiers (shared/tier.ts) and what selection does with them: the tier boundaries (A via a qualifier group
// or a lead-in naming the requirements, B exam-like without a criterion, B short scenario, C drill), the `tiers` filter
// (shared/filters.ts, custom mode), mocks preferring tier A then the other exam-like questions inside the domain quotas,
// a mock with `tiers: ['A']` (full when the bank allows, topped up from the other tiers with a note when it does not;
// never a variant pair, a sealed or an out-of-scope question) and the tier counters of modeCounts.
// In-memory bank + fake context; throw-away data root (TRAINER_HOME) holding a copy of the taxonomy. Run: npm test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from '../server/config.ts';
import type { BankState } from '../server/lib/bank.ts';
import type { SelectCtx } from '../server/lib/select.ts';
import type { DomainId, Question, SealedState, TestSession } from '../shared/types.ts';

const TRAINER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-tier-'));
fs.mkdirSync(path.join(HOME, 'bank', 'packs'), { recursive: true });
fs.copyFileSync(path.join(TRAINER, 'bank', 'taxonomy.yaml'), path.join(HOME, 'bank', 'taxonomy.yaml'));
fs.writeFileSync(path.join(HOME, 'config.yaml'), 'cache:\n  sqlite: false\nquality:\n  embeddings: off\nsync:\n  auto: off\n');
process.env.TRAINER_HOME = HOME; // before config.ts is imported (dynamic imports below)
after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const { DATA_DIR, loadConfig } = await import('../server/config.ts');
const it = DATA_DIR === HOME ? test : test.skip; // another file loaded config.ts first: the taxonomy must be ours

const select = await import('../server/lib/select.ts');
const { loadTaxonomy } = await import('../server/lib/taxonomy.ts');
const { applyFilters, hasFilters } = await import('../shared/filters.ts');
const { TIER_B_OPTION_WORDS, TIER_B_STEM_WORDS, examRank, hasCriterion, leadIn, questionTier, tierOf } = await import('../shared/tier.ts');
const { countWords } = await import('../shared/timing.ts');

const tax = loadTaxonomy();
const DOMAINS: DomainId[] = ['secure', 'resilient', 'performance', 'cost'];
const QUOTA: Record<DomainId, number> = { secure: 19, resilient: 17, performance: 16, cost: 13 };

function cfgWith(practice: Partial<AppConfig['practice']> = {}): AppConfig {
  const c = loadConfig();
  return { ...c, practice: { ...c.practice, exclude_out_of_scope: true, ...practice }, exam: { sealed_forms: 0, sealed_size: 50 }, cache: { sqlite: false } };
}

// ── made-up words: stems share no vocabulary (no lexical sibling clusters), no taxonomy keyword can match ──────────
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
const plain = (n: number) => Array.from({ length: n }, (_, k) => `w${k}`).join(' ');
const opts = (texts: string[]) => texts.map((text, i) => ({ key: 'ABCDE'[i], text }));

/** Kinds of question: A (exam-like + lead-in naming the requirements) · Bx (exam-like, no criterion) · Bs (short scenario) · C (drill). */
type Kind = 'A' | 'Bx' | 'Bs' | 'C';
let seq = 0;

function mk(id: string, domain: DomainId, kind: Kind, o: Partial<Question> = {}): Question {
  const base = 1000 + seq++ * 100;
  const stem =
    kind === 'A'
      ? `${words(base, 58)}. Which solution meets these requirements?`
      : kind === 'Bx'
        ? `${words(base, 58)}. Which design should the team choose?`
        : kind === 'Bs'
          ? `${words(base, 32)}. Which design should the team choose?`
          : `${words(base, 10)}. Which service fits?`;
  const options = opts(
    [0, 1, 2, 3].map((k) =>
      kind === 'A' || kind === 'Bx' ? `Configure ${words(base + 70 + k * 10, 8)}` : kind === 'Bs' ? `Use ${words(base + 70 + k * 10, 5)}` : word(base + 70 + k),
    ),
  );
  const w = countWords(stem);
  const q: Question = {
    id,
    pack: 'p-main',
    stem,
    options,
    answer: ['A'],
    explanation: 'Because.',
    domain,
    topic: 'compute',
    services: [],
    tags: [],
    difficulty: 'medium',
    time: 60,
    timeEstimated: false,
    status: 'active',
    origin: 'manual',
    variantOf: [],
    refs: [],
    words: w,
    longForm: w >= 55,
    requirements: [],
    hash: id,
    file: 'bank/packs/manual/p.md',
    line: 1,
    ...o,
  };
  return { ...q, tier: questionTier(q, tax) }; // as bank.ts computes it
}

function makeBank(qs: Question[]): BankState {
  return {
    version: `tier-${qs.length}-${seq}`,
    taxonomy: tax,
    packs: [{ id: 'p-main', title: 'Main', file: 'x', origin: 'manual', exam: 'SAA-C03', count: qs.length, activeCount: qs.length }],
    questions: qs,
    byId: new Map(qs.map((q) => [q.id, q])),
    problems: [],
  };
}

/** `n[kind]` questions of each kind in every domain (ids `<d>-<kind>-<i>`), with per-domain overrides. */
function bankOf(n: Partial<Record<Kind, number>>, per: Partial<Record<DomainId, Partial<Record<Kind, number>>>> = {}): Question[] {
  return DOMAINS.flatMap((d) =>
    (['A', 'Bx', 'Bs', 'C'] as Kind[]).flatMap((kind) => Array.from({ length: per[d]?.[kind] ?? n[kind] ?? 0 }, (_, i) => mk(`${d.slice(0, 3)}-${kind}-${i}`, d, kind))),
  );
}

const NO_FORMS: SealedState = { forms: [], size: 0 };
const ctxOf = (bank: BankState, o: Partial<SelectCtx> = {}): SelectCtx => ({ bank, states: new Map(), cfg: cfgWith(), plans: [], sealed: NO_FORMS, goal: {}, ...o });
const ids = (s: TestSession) => s.questions.map((r) => r.id);
const kindOf = (id: string) => id.split('-')[1] as Kind;
const inDomain = (s: TestSession, bank: BankState, d: DomainId) => ids(s).filter((id) => bank.byId.get(id)!.domain === d);

// ── the rule ────────────────────────────────────────────────────────────────

it('questionTier: A needs exam-like length AND a decision criterion (a qualifier group or a lead-in naming the requirements)', () => {
  const q = (stem: string, optionWords: number, requirements: string[] = []) => ({ stem, options: opts([0, 1, 2, 3].map((k) => `${k} ${plain(optionWords - 1)}`)), requirements });
  const long = (lead: string) => `${plain(55)} ${lead}`; // 55 + the lead-in words
  // A via the lead-in, A via requirements (a qualifier group anywhere in the stem)
  assert.equal(questionTier(q(long('Which solution will meet these requirements?'), 8)), 'A');
  assert.equal(questionTier(q(long('Which design should the team choose?'), 8, ['cost'])), 'A');
  assert.equal(questionTier(q(long('Which combination of steps meets the requirement? (Choose TWO.)'), 8)), 'A', '"(Choose TWO.)" after the question');
  // B: exam-like without any criterion
  assert.equal(questionTier(q(long('Which design should the team choose?'), 8)), 'B');
  assert.equal(questionTier(q(`The requirements are strict. ${plain(55)} Which design should the team choose?`, 8)), 'B', '"requirements" outside the lead-in is no criterion');
  // exam-like boundaries: stem ≥ 55 words, options ≥ 8 words on average — below either, a criterion does not make A
  assert.equal(questionTier(q(`${plain(50)} Which solution meets these requirements?`, 8)), 'A', 'stem 55 words: exam-like');
  assert.equal(questionTier(q(`${plain(49)} Which solution meets these requirements?`, 8)), 'B', 'stem 54 words: short scenario');
  assert.equal(questionTier(q(long('Which solution meets these requirements?'), 7)), 'B', 'options of 7 words: short scenario');
  // B short scenario: stem ≥ TIER_B_STEM_WORDS, options ≥ TIER_B_OPTION_WORDS on average; below → C
  const stemOf = (n: number) => `${plain(n - 6)} Which design should the team choose?`;
  assert.equal(TIER_B_STEM_WORDS, 30);
  assert.equal(TIER_B_OPTION_WORDS, 5);
  assert.equal(questionTier(q(stemOf(30), 5)), 'B');
  assert.equal(questionTier(q(stemOf(29), 5)), 'C', 'stem one word short');
  assert.equal(questionTier({ stem: stemOf(30), options: opts(['a b c d e', 'a b c d e', 'a b c d e', 'a b c d']), requirements: [] }), 'C', 'options 4.75 words on average');
  // C: a one-line recognition question with bare service names, criterion or not
  assert.equal(questionTier({ stem: 'Which service stores objects at the lowest cost?', options: opts(['Amazon S3', 'Amazon EBS', 'Amazon EFS', 'AWS Backup']), requirements: ['cost'] }), 'C');
  assert.equal(questionTier({ stem: 'Which service meets these requirements?', options: [], requirements: [] }), 'C', 'no options');
  // computed `words` wins over counting; the taxonomy threshold (timing.long_form_min_words) is honoured
  const short = q(`${plain(40)} Which solution meets these requirements?`, 8);
  assert.equal(questionTier(short), 'B');
  assert.equal(questionTier({ ...short, words: 60 }), 'A', 'Question.words (computed stem words) is used when present');
  assert.equal(questionTier(short, { timing: { long_form_min_words: 40 } }), 'A');
  // the lead-in = the last sentence with a "?", else the last sentence
  assert.equal(leadIn('A company runs X. Which option is best? (Select TWO.)'), 'Which option is best?');
  assert.equal(leadIn('A company runs X.\n\nSelect the option that meets the requirements.'), 'Select the option that meets the requirements.');
  assert.equal(hasCriterion({ stem: 'Choose the option that meets the requirements.', options: [] }), true);
  // tierOf: the computed field when present (server), else the rule (older payloads, hand-built questions)
  assert.equal(tierOf({ ...short, tier: 'C' }), 'C');
  assert.equal(tierOf(short), 'B');
  // examRank (mocks, sealed forms): tier A · other exam-like · the rest
  assert.deepEqual(
    [q(long('Which solution meets these requirements?'), 8), q(long('Which design should the team choose?'), 8), short, q(plain(10), 1)].map((x) => examRank(x)),
    [0, 1, 2, 2],
  );
});

it('tiers filter: any of the chosen tiers (computed tier, else the rule); hasFilters sees it; custom mode applies it and names it', () => {
  const qs = bankOf({ A: 3, Bx: 2, Bs: 2, C: 4 });
  assert.equal(applyFilters(qs, { tiers: ['A'] }).length, 12);
  assert.ok(applyFilters(qs, { tiers: ['A'] }).every((q) => kindOf(q.id) === 'A'));
  assert.equal(applyFilters(qs, { tiers: ['B'] }).length, 16, 'B = exam-like without a criterion + short scenarios');
  assert.equal(applyFilters(qs, { tiers: ['A', 'C'] }).length, 28);
  assert.equal(applyFilters(qs, { tiers: [] }).length, qs.length, 'empty = no filter');
  const bare = qs.map(({ tier: _t, ...q }) => q as Question); // no computed field: the rule decides
  assert.deepEqual(applyFilters(bare, { tiers: ['A'] }).map((q) => q.id), applyFilters(qs, { tiers: ['A'] }).map((q) => q.id));
  assert.deepEqual(applyFilters(qs, { tiers: ['A'], domains: ['cost'] }).map((q) => q.id), ['cos-A-0', 'cos-A-1', 'cos-A-2']);
  assert.equal(hasFilters({ tiers: ['A'] }), true);
  assert.equal(hasFilters({ tiers: [] }), false);
  const bank = makeBank(qs);
  const s = select.buildTest({ mode: 'custom', count: 200, filters: { tiers: ['B'] } }, ctxOf(bank));
  assert.equal(s.questions.length, 16);
  assert.ok(ids(s).every((id) => ['Bx', 'Bs'].includes(kindOf(id))));
  assert.equal(s.title, 'Tùy chỉnh: tầng B');
  // outside a mock the filter is a plain filter: nothing matches → nothing served, no top-up
  const none = select.buildTest({ mode: 'custom', count: 20, filters: { tiers: ['A'] } }, ctxOf(makeBank(bankOf({ Bx: 3, C: 3 }))));
  assert.equal(none.questions.length, 0);
  assert.ok(none.notes.includes('Bộ lọc không khớp câu nào.'), none.notes.join(' | '));
});

// ── mocks ───────────────────────────────────────────────────────────────────

it('Pearson mock: tier A first, then the other exam-like questions, inside the 19/17/16/13 domain quotas', () => {
  // 10 A + 10 exam-like B + 20 drills per domain, nothing seen: every A is served, B fills the rest, no drill
  const bank = makeBank(bankOf({ A: 10, Bx: 10, C: 20 }));
  for (let run = 0; run < 5; run++) {
    const s = select.buildTest({ mode: 'exam', pearson: true }, ctxOf(bank));
    assert.equal(s.questions.length, 65);
    for (const d of DOMAINS) {
      const got = inDomain(s, bank, d);
      assert.equal(got.length, QUOTA[d], `${d} quota`);
      assert.equal(got.filter((id) => kindOf(id) === 'A').length, 10, `${d}: every tier A question`);
      assert.equal(got.filter((id) => kindOf(id) === 'Bx').length, QUOTA[d] - 10, `${d}: the other exam-like questions fill the rest`);
    }
    assert.equal(s.realism?.items, 65);
    assert.equal(s.notes.length, 0, s.notes.join(' | '));
  }
  // among the rest (beyond the exam-like questions), short scenarios come before drills
  const thin = makeBank(bankOf({ A: 2, Bs: 20, C: 20 }));
  const t = select.buildTest({ mode: 'exam', pearson: true }, ctxOf(thin));
  assert.equal(ids(t).filter((id) => kindOf(id) === 'A').length, 8);
  assert.equal(ids(t).filter((id) => kindOf(id) === 'C').length, 0, 'tier B short scenarios before drills');
  // preview = what the mock serves; tier counters of the pool
  const c = select.modeCounts(ctxOf(bank));
  assert.equal(c['exam.total'], 65);
  assert.equal(c['exam.tierA'], 40);
  assert.equal(c['exam.items'], 65);
  assert.deepEqual([c.tierA, c.tierB, c.tierC], [40, 40, 80]);
  assert.equal(c.examLike, 80);
});

it('mock with tiers: ["A"]: all tier A when the bank allows — the domain mix, no variant pair, never sealed or out of scope', () => {
  const qs = bankOf({ A: 22, Bx: 5, C: 5 });
  // a variant pair of tier A, a sealed and an out-of-scope tier-A question in the cost domain
  const extra = [
    mk('cos-A-var', 'cost', 'A', { variantOf: ['cos-A-0'] }),
    mk('cos-A-sealed', 'cost', 'A'),
    mk('cos-A-oos', 'cost', 'A', { outOfScope: true }),
  ];
  const bank = makeBank([...qs, ...extra]);
  const sealed: SealedState = { forms: [{ id: 'S1', status: 'sealed', ids: ['cos-A-sealed'] }], size: 1 };
  for (const cfg of [cfgWith(), cfgWith({ exclude_out_of_scope: false })]) {
    for (let run = 0; run < 10; run++) {
      const s = select.buildTest({ mode: 'exam', pearson: true, filters: { tiers: ['A'] } }, ctxOf(bank, { sealed, cfg }));
      assert.equal(s.questions.length, 65);
      assert.ok(ids(s).every((id) => kindOf(id) === 'A'), 'only tier A');
      for (const d of DOMAINS) assert.equal(inDomain(s, bank, d).length, QUOTA[d], `${d} quota`);
      assert.ok(!(ids(s).includes('cos-A-0') && ids(s).includes('cos-A-var')), 'never an original with its variant');
      assert.ok(!ids(s).includes('cos-A-sealed'), 'never a sealed question');
      assert.ok(!ids(s).includes('cos-A-oos'), 'never an out-of-scope answer, whatever practice.exclude_out_of_scope says');
      assert.equal(s.pearson, true);
      assert.equal(s.unscored?.length, 15);
      assert.equal(s.title, select.PEARSON_TITLE);
      assert.ok(!s.notes.some((n) => n.includes('tier')), s.notes.join(' | '));
    }
  }
  // a shorter non-Pearson mock with the filter: the same rule
  const twenty = select.buildTest({ mode: 'exam', count: 20, filters: { tiers: ['A'] } }, ctxOf(bank, { sealed }));
  assert.equal(twenty.questions.length, 20);
  assert.ok(ids(twenty).every((id) => kindOf(id) === 'A'));
  assert.equal(twenty.title, 'Thi thử SAA-C03 (20 câu)');
});

it('mock with tiers: ["A"] and too few of them: topped up from the other tiers of the same filters, with a Vietnamese note', () => {
  // cost has 5 tier A questions (quota 13): 8 more come from cost's exam-like B questions, the domain mix stays
  const bank = makeBank(bankOf({ A: 20, Bx: 10, C: 10 }, { cost: { A: 5 } }));
  const s = select.buildTest({ mode: 'exam', pearson: true, filters: { tiers: ['A'] } }, ctxOf(bank));
  assert.equal(s.questions.length, 65);
  for (const d of DOMAINS) assert.equal(inDomain(s, bank, d).length, QUOTA[d], `${d} quota kept`);
  const cost = inDomain(s, bank, 'cost');
  assert.equal(cost.filter((id) => kindOf(id) === 'A').length, 5, 'every cost tier A question');
  assert.equal(cost.filter((id) => kindOf(id) === 'Bx').length, 8, 'then the exam-like B questions of cost (not a drill)');
  assert.ok(
    s.notes.includes('Ngân hàng chưa đủ câu tầng A cho bài thi thử: 57/65 câu là tầng A, 8 câu tầng B cùng bộ lọc được thêm vào (ưu tiên câu giống đề thật, giữ trọng số domain).'),
    s.notes.join(' | '),
  );
  assert.ok(!s.notes.some((n) => n.startsWith('Chỉ có')), 'the mock is full');
  // the other filters still apply to the top-up
  const sec = select.buildTest({ mode: 'exam', count: 30, filters: { tiers: ['A'], domains: ['cost'] } }, ctxOf(bank));
  assert.ok(ids(sec).every((id) => bank.byId.get(id)!.domain === 'cost'));
  assert.equal(sec.questions.length, 25, '5 A + 10 B + 10 C of cost');
  assert.ok(sec.notes.some((n) => n.startsWith('Ngân hàng chưa đủ câu tầng A cho bài thi thử: 5/25 câu là tầng A, 20 câu tầng B/C cùng bộ lọc')), sec.notes.join(' | '));
  assert.ok(sec.notes.includes('Chỉ có 25 câu phù hợp (bạn yêu cầu 30).'), sec.notes.join(' | '));
  // no tier A at all: the mock is built from the other tiers and says so (not "the filter matches nothing")
  const none = makeBank(bankOf({ Bx: 10, C: 20 }));
  const n = select.buildTest({ mode: 'exam', pearson: true, filters: { tiers: ['A'] } }, ctxOf(none));
  assert.equal(n.questions.length, 65);
  assert.ok(n.notes.includes('Chưa có câu tầng A nào khớp bộ lọc — bài thi thử dùng 65 câu tầng B/C cùng bộ lọc (ưu tiên câu giống đề thật, giữ trọng số domain).'), n.notes.join(' | '));
  assert.ok(!n.notes.includes('Bộ lọc không khớp câu nào.'));
  // the counters: the strict pool (`all`) vs the mock preview (topped up)
  const c = select.modeCounts(ctxOf(bank), { tiers: ['A'] });
  assert.equal(c.all, 65);
  assert.equal(c['exam.total'], 65);
  assert.equal(c['exam.tierA'], 57);
  assert.deepEqual([c.tierA, c.tierB, c.tierC], [65, 0, 0]);
});
