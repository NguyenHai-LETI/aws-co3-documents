// Unit tests for server/lib/insights.ts — confusion pairs normalised by co-occurrence, on synthetic learners written
// against a generated bank: a learner without real confusions gets (almost) no confirmed pairs, planted confusions are
// recovered, same-root pairs merge, drill sets, noise filters (rushed, never viewed, other question versions). Run: npm test
// Uses a throw-away data root (TRAINER_HOME) — never the real bank/results.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnswerRecord, Attempt, Question } from '../shared/types.ts';
import type { QuestionDraft } from '../server/lib/pack-format.ts';

const TRAINER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-insights-'));
fs.mkdirSync(path.join(HOME, 'bank', 'packs', 'manual'), { recursive: true });
fs.copyFileSync(path.join(TRAINER, 'bank', 'taxonomy.yaml'), path.join(HOME, 'bank', 'taxonomy.yaml'));
process.env.TRAINER_HOME = HOME; // must be set before config.ts is imported (dynamic imports below)
after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const { DATA_DIR } = await import('../server/config.ts');
// Without process isolation another test file may have loaded config.ts first — then never write: skip.
const it = DATA_DIR === HOME ? test : test.skip;

const insights = await import('../server/lib/insights.ts');
const { loadBank } = await import('../server/lib/bank.ts');
const { serializePack } = await import('../server/lib/pack-format.ts');
const { stringifyFrontMatter } = await import('../server/lib/frontmatter.ts');
const { regradeAttempts } = await import('../server/lib/regrade.ts');
const { computeStates, computeStats } = await import('../server/lib/stats.ts');
const { loadConfig } = await import('../server/config.ts');

const DAY = 86_400_000;
const NOW = Date.now();

// ── generated bank: every option names one service; planted pairs get dedicated questions ─────────────
const SERVICES = ['SQS', 'SNS', 'Kinesis', 'EventBridge', 'Step Functions', 'Athena', 'EMR', 'Glue', 'Redshift', 'DynamoDB', 'Aurora', 'ElastiCache', 'CloudTrail', 'CloudWatch', 'GuardDuty', 'Macie', 'Inspector', 'DataSync', 'DMS', 'Transfer Family', 'KMS', 'Secrets Manager', 'Cognito', 'Lambda'];
const PLANTED: [string, string][] = [['SNS', 'SQS'], ['CloudTrail', 'CloudWatch'], ['EMR', 'Athena'], ['DataSync', 'DMS']];
const LETTERS = ['A', 'B', 'C', 'D'];

/** Park–Miller LCG: same seed → same learner on every machine. */
function rng(seed: number): () => number {
  let s = seed * 7919 + 13;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
// DMS options also name the cdc-replication feature → a planted DataSync ⟶ DMS confusion has a same-root twin
const optionText = (svc: string, i: number) => (svc === 'DMS' ? `Use AWS DMS with change data capture (CDC) for case ${i}` : `Use ${svc} for case ${i}`);
const svcOf = new Map<string, string>(); // `${qid}|${key}` → service named by that option

const drafts: QuestionDraft[] = [];
{
  const r = rng(99);
  const add = (key: string, lure?: string) => {
    const n = drafts.length + 1;
    const others = SERVICES.filter((s) => s !== key && s !== lure);
    const svcs = [key, ...(lure ? [lure] : [])];
    while (svcs.length < 4) {
      const s = others[Math.floor(r() * others.length)];
      if (!svcs.includes(s)) svcs.push(s);
    }
    for (let i = svcs.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [svcs[i], svcs[j]] = [svcs[j], svcs[i]];
    }
    const id = `ins-${String(n).padStart(3, '0')}`;
    svcs.forEach((s, k) => svcOf.set(`${id}|${LETTERS[k]}`, s));
    drafts.push({
      id,
      stem: `Case ${n}: a company needs a solution for its workload. Which option meets the requirement?`,
      options: svcs.map((s, k) => ({ key: LETTERS[k], text: optionText(s, n) })),
      answer: [LETTERS[svcs.indexOf(key)]],
      explanation: 'The chosen service fits the case.',
      domain: 'resilient',
      topic: 'integration',
      difficulty: 'medium',
      time: 60,
    });
  };
  for (const [x, y] of PLANTED) {
    for (let i = 0; i < 8; i++) add(y, x); // key Y with lure X
    for (let i = 0; i < 4; i++) add(x, y); // the reverse (drill sets interleave both)
  }
  for (let i = 0; i < 120; i++) add(SERVICES[Math.floor(r() * SERVICES.length)]);
}
fs.writeFileSync(
  path.join(HOME, 'bank', 'packs', 'manual', 'insights-test.md'),
  serializePack({ pack: 'insights-test', title: 'Insights test', origin: 'manual' }, '', drafts, (x) => stringifyFrontMatter(x)),
);
const bank = loadBank();
const keySvc = (q: Question) => svcOf.get(`${q.id}|${q.answer[0]}`)!;

/**
 * A learner answering 30 random questions a day for `days` days, right 65 % of the time, a random distractor when wrong.
 * `planted`: when the key names Y and a distractor names X of a planted pair, picks X first with probability `lureP`.
 */
function simulate(seed: number, planted: boolean, opts: { days?: number; perDay?: number; lureP?: number } = {}): Attempt[] {
  const rnd = rng(seed);
  const { days = 40, perDay = 30, lureP = 0.35 } = opts;
  const out: Attempt[] = [];
  for (let d = days; d >= 1; d--) {
    const picked = new Set<number>();
    while (picked.size < perDay) picked.add(Math.floor(rnd() * bank.questions.length));
    const answers = [...picked].map((i): AnswerRecord => {
      const q = bank.questions[i];
      const key = q.answer.join('');
      const distractors = q.options.filter((o) => !q.answer.includes(o.key));
      let pick = '';
      if (planted) {
        for (const [x, y] of PLANTED) {
          const lure = distractors.find((o) => svcOf.get(`${q.id}|${o.key}`) === x);
          if (keySvc(q) === y && lure && rnd() < lureP) pick = lure.key;
        }
      }
      if (!pick) pick = rnd() < 0.65 ? key : distractors[Math.floor(rnd() * distractors.length)].key;
      return { q: q.id, pick, key, ok: pick === key, t: Math.round(30 + rnd() * 60), est: 60, h: q.hash };
    });
    out.push({ id: `s${seed}-d${d}`, mode: 'custom', finished: new Date(NOW - d * DAY).toISOString(), answers, rushed: false } as Attempt);
  }
  return out;
}

const plantedLabels = new Set(PLANTED.map(([x, y]) => `${x} ⟶ ${y}`));
const found = (pairs: { picked: string; correct: string; merged?: string[] }[]) => pairs.flatMap((p) => [`${p.picked} ⟶ ${p.correct}`, ...(p.merged ?? [])]);
const none = { sealed: new Set<string>() };

it('synthetic bank: every option names its service (term detection works on the fixture)', () => {
  assert.deepEqual(bank.problems.filter((p) => p.level === 'error'), []);
  assert.equal(bank.questions.length, PLANTED.length * 12 + 120);
  for (const q of bank.questions.slice(0, 20)) {
    const t = insights.questionTerms(q, bank.taxonomy);
    assert.ok(t.key.has(keySvc(q)), `${q.id}: key names ${keySvc(q)}`);
    assert.equal(t.lures.length, 3, `${q.id}: 3 distractors offer pairs`);
  }
  const dms = bank.questions.find((q) => keySvc(q) === 'DMS')!;
  assert.ok(insights.questionTerms(dms, bank.taxonomy).key.has('cdc-replication'), 'DMS options name the CDC feature too');
});

it('null learner (no real confusions): (almost) no confirmed pairs', () => {
  let total = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const pairs = insights.confusionPairs(simulate(seed, false), bank, none);
    assert.ok(pairs.length <= 1, `seed ${seed}: ${found(pairs).join(', ')}`);
    total += pairs.length;
  }
  assert.ok(total <= 2, `false positives over 6 seeds: ${total}`);
});

it('planted confusions are recovered (≥ 3 of 4 per seed), nothing else is flagged; same-root pairs merge', () => {
  let recovered = 0;
  for (const seed of [1, 2, 3, 4]) {
    const pairs = insights.confusionPairs(simulate(seed, true), bank, none);
    const labels = found(pairs);
    const heads = pairs.map((p) => `${p.picked} ⟶ ${p.correct}`);
    assert.ok(heads.every((l) => plantedLabels.has(l)), `seed ${seed}: only planted heads (${heads.join(', ')})`);
    const hits = [...plantedLabels].filter((l) => labels.includes(l)).length;
    assert.ok(hits >= 3, `seed ${seed}: ${hits}/4 planted pairs (${labels.join(', ')})`);
    recovered += hits;
    for (const p of pairs) {
      assert.ok(p.picks >= insights.CONFUSION_RULES.minPicks && p.questions >= insights.CONFUSION_RULES.minQuestions);
      assert.ok(p.low > insights.CONFUSION_RULES.lift * p.base, `${p.picked} ⟶ ${p.correct}: low ${p.low} > 2 × base ${p.base}`);
      assert.ok(p.rate >= p.low && p.rate === Math.round((1000 * p.picks) / p.exposures) / 1000);
    }
    const dms = pairs.find((p) => p.picked === 'DataSync');
    if (dms) assert.deepEqual([dms.correct, dms.merged], ['DMS', ['DataSync ⟶ cdc-replication']], 'the service pair heads its feature twin');
    assert.deepEqual(pairs, [...pairs].sort((a, b) => b.low - a.low || b.picks - a.picks), 'strongest first');
  }
  assert.ok(recovered >= 13, `recall over 4 seeds: ${recovered}/16`);
});

it('drill set: questions naming both terms, key-Y and key-X interleaved; sealed and out-of-scope questions left out', () => {
  const pairs = insights.confusionPairs(simulate(2, true), bank, none);
  const sns = pairs.find((p) => p.picked === 'SNS' && p.correct === 'SQS')!;
  assert.ok(sns, 'SNS ⟶ SQS confirmed for seed 2');
  const both = bank.questions.filter((q) => q.options.some((o) => svcOf.get(`${q.id}|${o.key}`) === 'SNS') && q.options.some((o) => svcOf.get(`${q.id}|${o.key}`) === 'SQS'));
  assert.deepEqual(new Set(sns.ids), new Set(both.map((q) => q.id)), 'every question naming both');
  assert.equal(keySvc(bank.byId.get(sns.ids[0])!), 'SQS', 'starts with a question whose key is the one the learner misses');
  assert.equal(keySvc(bank.byId.get(sns.ids[1])!), 'SNS', 'then one whose key is the lure');
  // sealed / out-of-scope questions never enter a drill set
  const sealed = new Set([sns.ids[0]]);
  const oos = sns.ids[1];
  const byId = new Map(bank.byId);
  byId.set(oos, { ...bank.byId.get(oos)!, outOfScope: true });
  const b2 = { ...bank, byId, questions: bank.questions.map((q) => byId.get(q.id)!) };
  const again = insights.confusionPairs(simulate(2, true), b2, { sealed }).find((p) => p.picked === 'SNS')!;
  assert.ok(!again.ids.includes(sns.ids[0]) && !again.ids.includes(oos), 'sealed + out-of-scope left out');
  assert.equal(insights.confusionPairs(simulate(2, true), b2, { sealed, excludeOutOfScope: false }).find((p) => p.picked === 'SNS')!.ids.includes(oos), true);
});

it('noise is ignored: rushed attempts, never-viewed blanks, answers given to another version of the options', () => {
  const base = simulate(3, false);
  const before = insights.confusionPairs(base, bank, none);
  // a rushed click-through that always picks the SNS lure, blanks everywhere, picks on outdated versions
  const lureQs = bank.questions.filter((q) => keySvc(q) === 'SQS' && q.options.some((o) => svcOf.get(`${q.id}|${o.key}`) === 'SNS'));
  const lurePick = (q: Question) => q.options.find((o) => svcOf.get(`${q.id}|${o.key}`) === 'SNS')!.key;
  const noisy = [
    ...base,
    ...Array.from({ length: 5 }, (_, i) => ({ id: `rushed-${i}`, mode: 'quick', finished: new Date(NOW - (i + 1) * 3_600_000).toISOString(), rushed: true, answers: lureQs.map((q) => ({ q: q.id, pick: lurePick(q), key: q.answer[0], ok: false, t: 2, est: 60, h: q.hash })) }) as Attempt),
    { id: 'blanks', mode: 'srs', finished: new Date(NOW - 7_200_000).toISOString(), answers: bank.questions.map((q) => ({ q: q.id, pick: '', key: q.answer[0], ok: false, t: 0, est: 60, h: q.hash })) } as Attempt,
    ...Array.from({ length: 5 }, (_, i) => ({ id: `old-${i}`, mode: 'custom', finished: new Date(NOW - (50 + i) * DAY).toISOString(), answers: lureQs.map((q) => ({ q: q.id, pick: lurePick(q), key: q.answer[0], ok: false, t: 50, est: 60, h: 'old-version' })) }) as Attempt),
  ];
  const after = insights.confusionPairs(noisy, bank, none);
  assert.deepEqual(found(after), found(before), 'same pairs');
  assert.equal(after.length, 0);
  // the same picks on the current version DO make a confirmed pair
  const real = [...base, ...noisy.filter((a) => a.id.startsWith('old-')).map((a) => ({ ...a, answers: a.answers.map((r) => ({ ...r, h: bank.byId.get(r.q)!.hash })) }))];
  assert.ok(found(insights.confusionPairs(real, bank, none)).includes('SNS ⟶ SQS'));
});

it('lower bound: shrinks towards the base rate, needs evidence; computeStats shows the top 10', () => {
  const lb = (p: number, e: number) => insights.rateLowerBound(p, e, 0.12);
  assert.ok(lb(4, 8) < lb(8, 16) && lb(8, 16) < lb(16, 32), 'more evidence at the same rate → higher lower bound');
  assert.ok(lb(4, 8) < 0.5 && lb(0, 10) < 0.12);
  assert.equal(insights.rateLowerBound(0, 0, 0), 0);
  // stats wiring: StatsResponse.confusions (learning view of the history)
  const cfg = loadConfig();
  const atts = regradeAttempts(simulate(5, true), bank, cfg);
  const s = computeStats(atts, bank, computeStates(atts, cfg, NOW), cfg, NOW, none);
  assert.ok(s.confusions && s.confusions.length >= 3 && s.confusions.length <= 10);
  assert.deepEqual(s.confusions, insights.confusionPairs(atts, bank, { sealed: new Set(), excludeOutOfScope: cfg.practice.exclude_out_of_scope }).slice(0, 10));
  assert.deepEqual(insights.confusionPairs([], bank, none), []);
});
