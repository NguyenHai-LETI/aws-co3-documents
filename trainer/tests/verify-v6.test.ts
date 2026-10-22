// [v6] Blind solve with shuffled options + the choices-only cue probe: option orders and the mapping back to bank letters,
// the probe's prompt / outcome / ledger line, probe lines never counted as blind-solve results, cue targets, and both kinds
// of run through the coach runner and scripts/coach-run.ts with the fake Claude CLI (tests/helpers/fake-claude.mjs) on a
// temporary TRAINER_HOME. FAKE_VERIFY overrides carry `shown: true`: their letters are the prompt's (already shuffled)
// letters, so they are passed through as they are. Never calls a model. Run: npm test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CoachEvent, CoachRunInfo, CoachRunOutcome, CueProbe, Question, VerifyVerdict } from '../shared/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const TRAINER_ROOT = path.resolve(here, '..');
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-verify-v6-')));
const home = path.join(root, 'home');
const repo = path.join(root, 'repo');
for (const d of ['bank/packs/ai', 'bank/packs/imported', 'results', 'coach/runs', 'coach/patches', 'coach/enrich']) fs.mkdirSync(path.join(home, d), { recursive: true });
fs.mkdirSync(repo, { recursive: true });
fs.copyFileSync(path.join(TRAINER_ROOT, 'bank', 'taxonomy.yaml'), path.join(home, 'bank', 'taxonomy.yaml'));
fs.writeFileSync(
  path.join(home, 'config.yaml'),
  [
    'coach:',
    '  models: { verify: opus }',
    '  verify: { auto: true, auto_draft: true, batch_size: 10, grounded: false, probe_model: haiku }',
    'quality:',
    '  embeddings: off',
    "  exam_spec_since: '2026-10-20'",
    'exam: { sealed_forms: 0 }',
    'sync: { before_ai: false, after_ai: false, auto: off }',
    '',
  ].join('\n'),
);
const LOG = path.join(root, 'fake-claude.log');
Object.assign(process.env, {
  TRAINER_HOME: home,
  TRAINER_REPO: repo,
  TRAINER_ALLOW_COACH: '1',
  CLAUDE_BIN: path.join(TRAINER_ROOT, 'tests', 'helpers', 'fake-claude.mjs'),
  FAKE_CLAUDE_LOG: LOG,
});
for (const k of ['FAKE_VERIFY', 'FAKE_BAD', 'FAKE_RESULT_ERROR', 'ANTHROPIC_API_KEY']) delete process.env[k];
after(() => fs.rmSync(root, { recursive: true, force: true }));

const { loadBank } = await import('../server/lib/bank.ts');
const verify = await import('../server/lib/verify.ts');
const runner = await import('../server/lib/coach-runner.ts');
const { verifiedForSealing } = await import('../server/lib/sealed.ts');

// ── the bank: AI questions (exam_spec_since 2026-10-20), an older one, a draft, a retired one, an imported one ──────

interface Spec {
  id: string;
  created: string;
  options: string[];
  answer: string; // "A" or "A, C"
  status?: string;
}
const OPTS = (topic: string) => [
  `Deploy the ${topic} as a Multi-AZ deployment with a synchronous standby`,
  `Create a read replica of the ${topic} in another Region and promote it by hand`,
  `Copy automated snapshots of the ${topic} every hour to another Availability Zone`,
  `Export the ${topic} tables nightly to Amazon S3 with AWS Glue jobs`,
];
const AI: Spec[] = [
  { id: 'v6-01', created: '2026-10-21', options: OPTS('orders DB'), answer: 'A' },
  { id: 'v6-02', created: '2026-10-22', options: [...OPTS('billing DB'), 'Place an Amazon RDS Proxy in front of the billing DB'], answer: 'A, C' },
  { id: 'v6-03', created: '2026-10-21', options: OPTS('catalog DB'), answer: 'B' },
  { id: 'v6-04', created: '2026-10-01', options: OPTS('ledger DB'), answer: 'C' },
  { id: 'v6-05', created: '2026-10-21', options: OPTS('session DB'), answer: 'D', status: 'draft' },
  { id: 'v6-06', created: '2026-10-21', options: OPTS('archive DB'), answer: 'A', status: 'retired' },
];
const block = (s: Spec) =>
  [
    `## Q ${s.id}`,
    '- domain: resilient',
    '- topic: database',
    '- difficulty: medium',
    '- time: 60',
    `- created: ${s.created}`,
    ...(s.status ? [`- status: ${s.status}`] : []),
    '- concept: SECRET-CONCEPT',
    '- hint: SECRET-HINT gợi ý',
    '',
    `STEM-${s.id}: a company needs its relational database to fail over automatically inside one AWS Region without application changes${s.answer.includes(',') ? ' (Choose TWO.)' : ''}. Which solution meets the requirement?`,
    '',
    ...s.options.map((t, i) => `- ${'ABCDEFGH'[i]}. ${t}`),
    '',
    `**Answer:** ${s.answer}`,
    '',
    `**Explanation:** SECRET-EXPLANATION ${s.id}`,
  ].join('\n');
const pack = (id: string, origin: string, specs: Spec[]) => `---\npack: ${id}\ntitle: ${id}\norigin: ${origin}\n---\n\n# ${id}\n\n${specs.map(block).join('\n\n---\n\n')}\n`;
fs.writeFileSync(path.join(home, 'bank', 'packs', 'ai', 'v6-ai.md'), pack('v6-ai', 'ai', AI));
fs.writeFileSync(path.join(home, 'bank', 'packs', 'imported', 'v6-imp.md'), pack('v6-imp', 'imported', [{ id: 'imp-01', created: '2026-10-21', options: OPTS('stock DB'), answer: 'B' }]));

const q = (id: string): Question => loadBank().byId.get(id)!;
const letterOf = (order: readonly string[], key: string) => 'ABCDEFGH'[order.indexOf(key)];
const lettersOf = (order: readonly string[], keys: string) => [...keys].map((k) => letterOf(order, k));
const ledgerText = () => (fs.existsSync(verify.VERIFY_FILE) ? fs.readFileSync(verify.VERIFY_FILE, 'utf8') : '');
const jsonOf = (line: string) => JSON.parse(/<!-- verify (\{.*\}) -->/.exec(line)![1]) as Record<string, unknown>;

// ── shuffled blind solve ────────────────────────────────────────────────────

test('[v6] shuffled blind solve: an order per question hash + attempt, letters re-assigned in the prompt, picks and option references mapped back to bank letters', () => {
  const q1 = q('v6-01');
  const o0 = verify.optionOrder(q1, 'solve#0');
  assert.deepEqual([...o0].sort(), ['A', 'B', 'C', 'D'], 'a permutation of the bank keys');
  assert.deepEqual(verify.optionOrder(q1, 'solve#0'), o0, 'deterministic');
  assert.ok(['solve#1', 'solve#2', 'solve#3', 'solve#4'].some((s) => verify.optionOrder(q1, s).join('') !== o0.join('')), 'a retry sees another order');
  assert.ok(['h1', 'h2', 'h3', 'h4'].some((h) => verify.optionOrder({ ...q1, hash: h }, 'solve#0').join('') !== o0.join('')), 'tied to the version (hash)');
  // the order is spread: over many versions every key shows up under every letter
  const seenAt = new Set<string>();
  for (let i = 0; i < 200; i++) verify.optionOrder({ ...q1, hash: `x${i}` }, 'solve#0').forEach((k, j) => seenAt.add(`${k}${j}`));
  assert.equal(seenAt.size, 16);

  // the attempt = earlier blind answers of this version (errors too); decisions, fact-checks, other versions do not count
  const v = (more: Partial<VerifyVerdict>): VerifyVerdict => ({ date: '2026-10-22', qid: q1.id, hash: q1.hash, outcome: 'error', ...more });
  assert.deepEqual(verify.blindOrders([q1], []).get(q1.id), o0);
  const ledger = [v({}), v({ outcome: 'ok', decision: 'approved' }), v({ outcome: 'ok', check: 'grounded', fact: 'correct' }), v({ hash: 'old', outcome: 'ok' }), v({ qid: 'v6-03', outcome: 'ok' })];
  assert.deepEqual(verify.blindOrders([q1], ledger).get(q1.id), verify.optionOrder(q1, 'solve#1'));

  // prompt: the options in that order under A, B, C, D — never the key, explanation, hint or concept
  const orders = new Map([[q1.id, o0]]);
  const prompt = verify.verifyPrompt([q1], 'r-v6', orders);
  const shown = [...prompt.matchAll(/^- ([A-H])\. (.*)$/gm)].map((m) => [m[1], m[2]]);
  assert.deepEqual(
    shown,
    o0.map((k, i) => ['ABCD'[i], q1.options.find((o) => o.key === k)!.text]),
  );
  assert.doesNotMatch(prompt, /SECRET|\*\*Answer/);
  assert.match(prompt, /NỘI DUNG[^\n]*đã được xáo ngẫu nhiên/, 'reasons name options by content');
  assert.doesNotMatch(verify.verifyPrompt([q1], 'r-v6'), /đã được xáo/, 'no orders → bank order (local vote, older callers)');
  assert.match(verify.verifyPrompt([q1], 'r-v6'), /- A\. Deploy the orders DB as a Multi-AZ/);

  // answers in the shown letters → bank letters; the order rides along
  const wrong = o0.find((k) => k !== 'A')!;
  const out = (answer: string[], reason = 'r') => ({ results: [{ id: q1.id, answer, confidence: 'high', ambiguous: false, reason }] });
  const [ok] = verify.verdictsFor([q1], out([letterOf(o0, 'A')], `Phương án ${letterOf(o0, wrong)} chậm hơn; VPC A và bản ghi A không liên quan`), { runId: 'r1', model: 'opus', orders });
  assert.deepEqual([ok.outcome, ok.picked, ok.key, ok.order], ['ok', 'A', 'A', o0.join('')]);
  assert.ok(ok.reason!.startsWith(`Phương án ${wrong} chậm hơn; VPC A và bản ghi A không liên quan`), 'option references mapped, other letters kept');
  // a bare letter may still be an option reference: the order the solver saw is spelled out (unless it is the bank order)
  if (o0.join('') !== 'ABCD') assert.match(ok.reason!, /\(model thấy: A=[A-D], B=[A-D], C=[A-D], D=[A-D]\)$/);
  const [miss] = verify.verdictsFor([q1], out([letterOf(o0, wrong)]), { runId: 'r1', model: 'opus', orders });
  assert.deepEqual([miss.outcome, miss.picked, miss.key], ['mismatch', wrong, 'A']);
  assert.equal(verify.verdictsFor([q1], out(['E']), { runId: 'r1', orders })[0].outcome, 'error', 'a letter past the shown options is no answer');
  assert.equal(verify.verdictsFor([q1], { results: [] }, { runId: 'r1', orders })[0].order, o0.join(''), 'an unanswered question keeps what was shown');
  const q2 = q('v6-02');
  const m0 = verify.optionOrder(q2, 'solve#0');
  const [multi] = verify.verdictsFor([q2], { results: [{ id: q2.id, answer: lettersOf(m0, 'CA'), ambiguous: false }] }, { runId: 'r1', orders: new Map([[q2.id, m0]]) });
  assert.deepEqual([multi.outcome, multi.picked], ['ok', 'AC']);
  // without an order: bank letters as before, no `order`
  const plain = verify.judge(q1, { answer: ['A'], ambiguous: false });
  assert.equal(plain.outcome, 'ok');
  assert.ok(!('order' in plain));

  // ledger line: picks / key in bank letters, the order in the JSON, round-trip
  const line = verify.formatVerdict(miss);
  assert.match(line, new RegExp(`· ❌ lệch đáp án \\(model ${wrong} · đáp án A\\) · opus`));
  assert.equal(jsonOf(line).order, o0.join(''));
  const back = verify.parseVerdicts(line)[0];
  assert.deepEqual([back.picked, back.key, back.order], [wrong, 'A', o0.join('')]);
  assert.equal(verify.parseVerdicts(line.replace(/"order":"[A-H]+"/, '"order":"ZZ"'))[0].order, undefined, 'a malformed order is dropped');

  // option references written in shown letters → bank letters (lists too); bare letters are left alone but the shown order
  // is spelled out after the reason (a bare "B" may still mean an option)
  const ord = ['C', 'A', 'D', 'B']; // shown A = C, B = A, C = D, D = B
  assert.equal(verify.remapLetterRefs('Phương án B và D cùng đúng; đáp án C sai, option A thiếu HA, lựa chọn B/C, choices A, D', ord), 'Phương án A và B cùng đúng; đáp án D sai, option C thiếu HA, lựa chọn A/D, choices C, B');
  const bare = 'VPC A peering với VPC B; bản ghi A alias trỏ tới ALB; Phương ánh sáng';
  assert.equal(verify.remapLetterRefs(bare, ord), `${bare} (model thấy: A=C, B=A, C=D, D=B)`);
  assert.equal(verify.remapLetterRefs('Read replicas không có failover tự động', ord), 'Read replicas không có failover tự động');
});

// ── choices-only cue probe: orders, prompt, outcome, ledger line ───────────

test('[v6] cue probe: two shuffles with the key on other letters, a prompt with the options only, cue = both runs exactly the key, ledger line', () => {
  const q1 = q('v6-01');
  const q2 = q('v6-02');
  const [o1, o2] = verify.probeOrders(q1, 0);
  assert.deepEqual(verify.probeOrders(q1, 0), [o1, o2], 'deterministic');
  assert.notEqual(o1.indexOf('A'), o2.indexOf('A'), 'the key sits on another letter in run 2');
  assert.ok([1, 2, 3, 4].some((n) => verify.probeOrders(q1, n)[0].join('') !== o1.join('')), 'a re-probe shuffles again');
  for (let i = 0; i < 300; i++) {
    for (const base of [q1, q2]) {
      const x = { ...base, hash: `h${i}` };
      const [a, b] = verify.probeOrders(x, 0);
      const at = (o: string[]) => x.answer.map((k) => o.indexOf(k)).sort().join();
      assert.notEqual(at(a), at(b), `key positions differ (${x.id} ${x.hash})`);
      assert.deepEqual([...b].sort(), [...x.options.map((o) => o.key)].sort());
    }
  }

  // the prompt: neutral labels, how many to pick, the options in the run's order — no stem, id, key or metadata
  const [m1] = verify.probeOrders(q2, 0);
  const items = [
    { q: q1, label: verify.probeLabel(1, 1), order: o1 },
    { q: q2, label: verify.probeLabel(1, 2), order: m1 },
  ];
  const prompt = verify.probePrompt(items, 'r-p');
  assert.match(prompt, /## 1\. `p1-1` — chọn 1\n\n- A\. /);
  assert.match(prompt, /## 2\. `p1-2` — chọn 2\n\n- A\. [^\n]*\n- B\. [^\n]*\n- C\. [^\n]*\n- D\. [^\n]*\n- E\. /);
  assert.ok(prompt.includes(`- A. ${q1.options.find((o) => o.key === o1[0])!.text}`));
  assert.doesNotMatch(prompt, /STEM-|v6-0|SECRET|\*\*Answer|resilient|medium/, 'options only');
  assert.match(prompt, /NỘI DUNG/);
  assert.deepEqual(Object.keys(verify.PROBE_SCHEMA.properties.results.items.properties), ['id', 'answer', 'reason']);

  // answers by label → bank letters, giveaway references mapped back
  const got = verify.probeAnswers(items, {
    results: [
      { id: 'p1-1', answer: [letterOf(o1, 'A')], reason: `phương án ${letterOf(o1, 'A')} là phương án duy nhất có Multi-AZ` },
      { id: '`p1-2`', answer: lettersOf(m1, 'CA') },
      { id: 'v6-01', answer: ['B'] },
    ],
  });
  assert.deepEqual(got.get(q1.id), { picked: 'A', order: o1, reason: 'phương án A là phương án duy nhất có Multi-AZ' });
  assert.equal(got.get(q2.id)!.picked, 'AC');
  assert.equal(verify.probeAnswers(items, { results: [] }).size, 0);

  // outcome: exactly the key twice → cue; anything else → clean; not settled → undefined
  assert.equal(verify.judgeProbe('A', ['A', 'A']), 'cue');
  assert.equal(verify.judgeProbe('A', ['A', 'C']), 'clean');
  assert.equal(verify.judgeProbe('A', ['C']), 'clean', 'the first run missed: settled without run 2');
  assert.equal(verify.judgeProbe('A', ['A']), undefined, 'run 2 still due');
  assert.equal(verify.judgeProbe('A', ['A', '']), undefined, 'run 2 gave no valid answer');
  assert.equal(verify.judgeProbe('A', ['', 'A']), undefined);
  assert.equal(verify.judgeProbe('AC', ['AC', 'AC']), 'cue');
  assert.equal(verify.judgeProbe('AC', ['A', 'AC']), 'clean', 'exactly the key, not a part of it');

  // records + the ledger line
  const now = new Date();
  const cue = verify.probeRecord(q1, [{ picked: 'A', order: o1, reason: 'Phương án đúng là duy nhất nhắc Multi-AZ' }, { picked: 'A', order: o2 }], { model: 'claude-haiku-4-5', runId: 'r-p', now })!;
  assert.deepEqual({ ...cue, at: undefined, date: undefined }, {
    at: undefined,
    date: undefined,
    qid: 'v6-01',
    hash: q1.hash,
    probe: 'choices-only',
    outcome: 'cue',
    picks: ['A', 'A'],
    key: 'A',
    model: 'claude-haiku-4-5',
    runId: 'r-p',
    orders: [o1.join(''), o2.join('')],
    reason: 'Phương án đúng là duy nhất nhắc Multi-AZ',
  });
  const clean = verify.probeRecord(q2, [{ picked: 'B', order: m1, reason: 'đoán' }], { runId: 'r-p', now })!;
  assert.deepEqual([clean.outcome, clean.picks, clean.orders, clean.reason], ['clean', ['B'], [m1.join('')], undefined]);
  assert.equal(verify.probeRecord(q1, [{ picked: 'A', order: o1 }], { runId: 'r-p' }), undefined, 'not settled → no line');
  assert.equal(verify.probeRecord(q1, [{ picked: '', order: o1 }], { runId: 'r-p' }), undefined, 'no valid answer → no line');

  const fixed = { ...cue, date: '2026-10-22', at: '2026-10-22T10:00:00+07:00', reason: 'Lý do --> có <!-- và\nxuống dòng' };
  const line = verify.formatProbe(fixed);
  assert.equal(line.split('\n').length, 1);
  assert.match(line, /^- 2026-10-22 · `v6-01` · 🎯 phương án lộ đáp án — đoán được không cần đọc đề \(2 lần đều chọn A\) · claude-haiku-4-5 — Lý do có và xuống dòng <!-- verify \{.*\} -->$/);
  assert.deepEqual(jsonOf(line), {
    at: '2026-10-22T10:00:00+07:00',
    hash: q1.hash,
    probe: 'choices-only',
    outcome: 'cue',
    picks: ['A', 'A'],
    key: 'A',
    model: 'claude-haiku-4-5',
    run: 'r-p',
    orders: [o1.join(''), o2.join('')],
    reason: 'Lý do có và xuống dòng',
  });
  assert.match(verify.formatProbe({ ...clean, date: '2026-10-22' }), /^- 2026-10-22 · `v6-02` · 🎯 dò phương án \(không có đề\): không lộ đáp án \(lần 1 chọn B · đáp án AC\) <!-- verify \{.*"probe":"choices-only","outcome":"clean","picks":\["B"\].*\} -->$/);

  // parsing: probe lines come back as probes, never as verdicts (an app without probes skips them too: no blind outcome)
  const parsed = verify.parseLedger(`# h\n\n<!-- verify-log -->\n${line}\n`);
  assert.deepEqual(parsed.verdicts, []);
  assert.deepEqual(parsed.probes, [{ ...fixed, line: 4, reason: 'Lý do có và xuống dòng' }]);
  assert.deepEqual(verify.parseVerdicts(line), []);
  const forged = line.replace('"outcome":"cue"', '"outcome":"ok"');
  assert.deepEqual(verify.parseLedger(forged), { verdicts: [], probes: [] }, 'a probe line with a blind-solve outcome is no verdict either');
  assert.equal(verify.isProbeRecord({ probe: 'something-new' }), true);
  assert.equal(verify.isProbeRecord({ check: 'grounded' }), false);
});

// ── probe lines are never blind-solve results ──────────────────────────────

test('[v6] probe lines never count as blind-solve results (summary, review queue, readiness, sealed eligibility, targets, audit); VerifySummary.cues lists them', () => {
  fs.rmSync(verify.VERIFY_FILE, { force: true });
  const bank = loadBank();
  const h = (id: string) => bank.byId.get(id)!.hash;
  const p = (qid: string, outcome: 'cue' | 'clean', at: string, more: Partial<CueProbe> = {}): CueProbe => ({
    date: at.slice(0, 10),
    at,
    qid,
    hash: h(qid),
    probe: 'choices-only',
    outcome,
    picks: outcome === 'cue' ? ['A', 'A'] : ['B'],
    key: 'A',
    runId: 'r-probe',
    ...more,
  });
  verify.appendProbes([
    p('v6-01', 'cue', '2026-10-22T09:00:00+07:00'),
    p('v6-02', 'clean', '2026-10-22T09:00:00+07:00'),
    p('v6-03', 'cue', '2026-10-22T09:00:00+07:00', { hash: 'old-version' }),
    p('v6-05', 'cue', '2026-10-22T10:00:00+07:00'),
    p('v6-06', 'cue', '2026-10-22T10:00:00+07:00'), // retired: left out
  ]);
  // forged lines a buggy writer could leave: blind-solve outcomes on probe lines must still never count
  const forged = (qid: string, outcome: string) => `- 2026-10-22 · \`${qid}\` · x <!-- verify {"at":"2026-10-22T11:00:00+07:00","hash":"${h(qid)}","outcome":"${outcome}","picked":"C","key":"A","probe":"choices-only"} -->\n`;
  fs.appendFileSync(verify.VERIFY_FILE, forged('v6-04', 'ok') + forged('v6-03', 'mismatch') + forged('imp-01', 'ok'));
  assert.match(ledgerText(), /^# 🧪 Giải mù câu hỏi[\s\S]*Dòng 🎯[\s\S]*<!-- verify-log -->\n- 2026-10-22 · `v6-01` · 🎯 phương án lộ đáp án/);
  assert.equal(verify.loadVerdicts().length, 0);
  assert.equal(verify.loadProbes().length, 5);

  const b = loadBank();
  const s = verify.verifySummary(b);
  assert.deepEqual({ ...s, cues: undefined }, { verified: 0, ok: 0, review: 0, stale: 0, pending: [], disputed: 0, grounded: 0, cues: undefined }, 'no verified / ok / review / disputed count');
  assert.deepEqual({ ...s.cues!, items: s.cues!.items.map((x) => x.qid) }, { probed: 3, cue: 2, clean: 1, stale: 1, items: ['v6-05', 'v6-01'] }, 'current versions, newest first; retired left out');
  assert.deepEqual(verify.latestVerdicts(b), {}, 'nothing to show as a verdict');
  assert.equal(verify.disputedIds(b).size, 0, 'readiness: no key in doubt');
  for (const id of ['v6-01', 'v6-04']) assert.equal(verifiedForSealing(b.byId.get(id)!, verify.latestVerdicts(b)[id]), false, `${id}: a probe does not make an AI question sealable`);
  assert.deepEqual(verify.verifyTargets(b, {}, verify.loadVerdicts(), new Set()).ids, ['v6-02', 'v6-01', 'v6-03', 'v6-05', 'v6-04'], 'still unverified AI questions');
  assert.deepEqual(verify.verifyTargets(b, { scope: 'changed' }, verify.loadVerdicts(), new Set()).ids, [], 'never solved → not "changed"');
  assert.deepEqual(verify.auditStatus(b, [], verify.loadVerdicts(), new Set()).audited, 0, 'the import audit still has imp-01 to do');
  assert.ok(verify.auditTargets(b, {}, verify.loadVerdicts(), new Set()).ids.includes('imp-01'));
  assert.deepEqual(verify.draftCandidates(verify.loadVerdicts(), b), []);
  assert.deepEqual(verify.reactivate(verify.loadVerdicts(), 'r-probe'), { reactivated: [], errors: [] });

  // a sealed question is left out of the cue summary (its cue line shows the key twice)
  const sealedFile = path.join(home, 'results', 'sealed.md');
  fs.writeFileSync(sealedFile, '---\nkind: sealed\nsize: 1\nforms:\n  - id: S1\n    status: sealed\n    ids: [v6-01]\n---\n');
  try {
    const c = verify.verifySummary(loadBank()).cues!;
    assert.deepEqual({ ...c, items: c.items.map((x) => x.qid) }, { probed: 2, cue: 1, clean: 1, stale: 1, items: ['v6-05'] });
  } finally {
    fs.rmSync(sealedFile, { force: true });
  }
  assert.equal(verify.verifySummary(loadBank()).cues!.cue, 2, 'released again');
  fs.rmSync(verify.VERIFY_FILE, { force: true });
  assert.equal(verify.verifySummary(loadBank()).cues, undefined, 'no probe → no `cues`');
});

// ── cue targets ─────────────────────────────────────────────────────────────

test('[v6] cue targets: exam-grade AI questions not probed for their current version; --ids / --pack override; sealed, retired, imported, older left out; MAX_VERIFY', () => {
  const b = loadBank();
  const none = new Set<string>();
  assert.deepEqual(verify.cueTargets(b, {}, { since: '2026-10-20' }, [], none).ids, ['v6-02', 'v6-01', 'v6-03'], 'active ai / doc created ≥ since, newest first');
  assert.deepEqual(verify.cueTargets(b, {}, { since: '' }, [], none).ids, ['v6-02', 'v6-01', 'v6-03', 'v6-04'], "'' = any date");
  assert.deepEqual(verify.cueTargets(b, {}, { since: 'nope' }, [], none).ids, ['v6-02', 'v6-01', 'v6-03', 'v6-04'], 'a malformed date = any date');
  assert.deepEqual(verify.cueTargets(b, {}, { since: '2026-10-20' }, [], new Set(['v6-01'])).ids, ['v6-02', 'v6-03'], 'sealed: never by default');
  const probe = (qid: string, hash: string): CueProbe => ({ date: '2026-10-22', qid, hash, probe: 'choices-only', outcome: 'clean', picks: ['B'] });
  assert.deepEqual(verify.cueTargets(b, {}, { since: '2026-10-20' }, [probe('v6-01', b.byId.get('v6-01')!.hash), probe('v6-03', 'old')], none).ids, ['v6-02', 'v6-03'], 'probed for this version → done; an older version → again');
  assert.deepEqual(verify.cueTargets(b, { ids: ['v6-05', 'v6-06', 'nope', 'imp-01', 'v6-05'] }, {}, [probe('v6-05', b.byId.get('v6-05')!.hash)], new Set(['imp-01'])).ids, ['v6-05', 'imp-01'], 'explicit ids: drafts, imported, sealed, already probed — never retired / unknown');
  assert.deepEqual(verify.cueTargets(b, { pack: 'v6-ai' }, { since: '2026-10-20' }, [], none).ids, ['v6-02', 'v6-01', 'v6-03', 'v6-05', 'v6-04'], 'a pack: every non-retired question of it');
  assert.deepEqual(verify.cueTargets(b, { pack: 'v6-imp' }, {}, [], none).ids, ['imp-01']);
  const many = Array.from({ length: 70 }, (_, i) => ({ ...b.byId.get('v6-01')!, id: `m-${i}`, hash: `m${i}` }));
  const big = { ...b, questions: many, byId: new Map(many.map((x) => [x.id, x])) };
  const t = verify.cueTargets(big, {}, { since: '2026-10-20' }, [], none);
  assert.deepEqual([t.ids.length, t.total], [verify.MAX_VERIFY, 70]);
  assert.deepEqual(verify.cueTargets(big, { ids: many.map((x) => x.id) }, {}, [], none).ids.length, verify.MAX_VERIFY);
  assert.ok(verify.VERIFY_SCOPES.includes('cues'));
});

// ── through the coach runner with the fake Claude CLI ───────────────────────

interface Call {
  argv: string[];
}
const calls = (): Call[] => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Call) : []);
const flag = (c: Call, name: string) => (c.argv.includes(name) ? c.argv[c.argv.indexOf(name) + 1] : undefined);
const events: CoachEvent[] = [];
runner.coachRunner.on('event', (ev: CoachEvent) => events.push(ev));
type Run = CoachRunInfo & { outcome?: CoachRunOutcome };

async function runVerify(params: Record<string, unknown>, fake: Record<string, unknown>): Promise<{ run: Run; log: string; calls: Call[] }> {
  process.env.FAKE_VERIFY = JSON.stringify(fake);
  const before = calls().length;
  const from = events.length;
  const done = new Promise<Run>((resolve) => runner.coachRunner.once('done', (info: Run) => resolve(info)));
  runner.coachRunner.start('verify', 'cli', params, { syncBefore: false, syncAfter: false });
  const run = await done;
  delete process.env.FAKE_VERIFY;
  return { run, log: events.slice(from).map((e) => e.text).join('\n'), calls: calls().slice(before) };
}

test('[v6] runner: the blind solve shows shuffled options and records the picks in bank letters', async () => {
  fs.rmSync(verify.VERIFY_FILE, { force: true });
  const [q1, q3] = [q('v6-01'), q('v6-03')];
  const orders = verify.blindOrders([q1, q3]);
  const o1 = orders.get(q1.id)!;
  const o3 = orders.get(q3.id)!;
  const wrong = o3.find((k) => k !== 'B')!;
  const { run, log, calls: cs } = await runVerify({ ids: [q1.id, q3.id] }, { [q1.id]: { answer: [letterOf(o1, 'A')], shown: true }, [q3.id]: { answer: [letterOf(o3, wrong)], shown: true, reason: 'Model thứ hai chọn khác' } });
  assert.equal(run.status, 'success', log);
  assert.deepEqual(run.outcome!.verify, { checked: 2, ok: 1, mismatch: 1, ambiguous: 0, error: 0, drafted: [q3.id] });
  assert.match(log, /🧪 Giải mù 2 câu · model opus \(dự phòng sonnet\) · 1 lượt gọi — model chỉ thấy đề \+ lựa chọn \(đã xáo thứ tự\)/);
  assert.match(log, new RegExp(`❌ v6-03: model chọn ${wrong}, đáp án B — Model thứ hai chọn khác`));
  assert.equal(cs.length, 1);
  const prompt = flag(cs[0], '-p')!;
  const section = prompt.split(/\n(?=## \d+\. `)/).find((s) => s.includes('`v6-01`'))!;
  assert.deepEqual(
    [...section.matchAll(/^- ([A-H])\. (.*)$/gm)].map((m) => m[2]),
    o1.map((k) => q1.options.find((o) => o.key === k)!.text),
    'shown in the shuffled order',
  );
  const lines = ledgerText().split('\n').filter((l) => /^- \d{4}-\d{2}-\d{2} · `/.test(l));
  const solved = lines.filter((l) => !/"decision"/.test(l)).map(jsonOf);
  assert.deepEqual(
    solved.map((d) => [d.outcome, d.picked, d.key, d.order]),
    [
      ['ok', 'A', 'A', o1.join('')],
      ['mismatch', wrong, 'B', o3.join('')],
    ],
  );
  // solving the same version again shows another order (the earlier answer counts as an attempt)
  assert.deepEqual(verify.blindOrders([q1]).get(q1.id), verify.optionOrder(q1, 'solve#1'));
});

test('[v6] runner: scope cues — options only to the probe model, run 2 only for first-run hits, cue / clean lines, nothing drafted or counted as verified', async () => {
  const [q2, q1, q3] = [q('v6-02'), q('v6-01'), q('v6-03')];
  assert.equal(q3.status, 'draft', 'drafted by the blind solve above');
  const before = verify.verifySummary(loadBank());
  // n = position in the run: v6-02 → 1, v6-01 → 2, v6-03 → 3
  const [a1, a2] = verify.probeOrders(q2, 0);
  const [b1, b2] = verify.probeOrders(q1, 0);
  const [c1] = verify.probeOrders(q3, 0);
  const fake = {
    'p1-1': { answer: lettersOf(a1, 'AC'), shown: true, reason: `phương án ${letterOf(a1, 'A')} và ${letterOf(a1, 'C')} dài nhất` },
    'p2-1': { answer: lettersOf(a2, 'AC'), shown: true },
    'p1-2': { answer: [letterOf(b1, 'A')], shown: true },
    'p2-2': { answer: [letterOf(b2, 'B')], shown: true },
    'p1-3': { answer: [letterOf(c1, 'C')], shown: true },
  };
  const { run, log, calls: cs } = await runVerify({ scope: 'cues', ids: [q2.id, q1.id, q3.id] }, fake);
  assert.equal(run.status, 'success', log);
  assert.equal(run.params?.scope, 'cues');
  assert.deepEqual(run.outcome!.cues, { checked: 3, cue: 1, clean: 2, error: 0, flagged: ['v6-02'] });
  assert.equal(run.outcome!.verify, undefined, 'no blind-solve numbers');
  assert.match(log, /Giải mù câu hỏi \(model thứ hai\) · 3 câu · 🎯 dò phương án lộ đáp án · Claude Code [\d.]+ · model haiku/);
  assert.match(log, /🎯 Dò phương án lộ đáp án 3 câu · model haiku \(dự phòng sonnet\)/);
  assert.match(log, /🎯 v6-02: phương án lộ đáp án — đoán được không cần đọc đề \(2 lần đều chọn AC\) — phương án A và C dài nhất/);
  assert.match(log, /🎯 Dò 3\/3 câu chỉ bằng phương án: 1 lộ đáp án · 2 không lộ — sửa phương án ở Ngân hàng → Chất lượng → 🧪/);
  assert.equal(run.summary, log.split('\n').find((l) => l.startsWith('🎯 Dò 3/3')));

  // the calls: run 1 with the three items, run 2 only with the two first-run hits — the probe model, no tools, no stem
  assert.equal(cs.length, 2);
  for (const c of cs) {
    assert.equal(flag(c, '--model'), 'haiku');
    assert.equal(flag(c, '--fallback-model'), 'sonnet');
    assert.equal(flag(c, '--tools'), '');
    assert.equal(flag(c, '--permission-mode'), 'dontAsk');
    assert.ok(c.argv.includes('--strict-mcp-config') && c.argv.includes('--no-session-persistence'));
    assert.ok(!c.argv.includes('--effort') && !c.argv.includes('--allowedTools'));
    assert.deepEqual(Object.keys(JSON.parse(flag(c, '--json-schema')!).properties.results.items.properties), ['id', 'answer', 'reason']);
    assert.doesNotMatch(flag(c, '-p')!, /STEM-|v6-0|SECRET|\*\*Answer/);
  }
  assert.deepEqual([...flag(cs[0], '-p')!.matchAll(/^## \d+\. `([^`]+)`/gm)].map((m) => m[1]), ['p1-1', 'p1-2', 'p1-3']);
  assert.deepEqual([...flag(cs[1], '-p')!.matchAll(/^## \d+\. `([^`]+)`/gm)].map((m) => m[1]), ['p2-1', 'p2-2']);

  // the ledger: one 🎯 line per question, bank letters, tied to the hash; nothing drafted, no decision
  const probes = verify.loadProbes();
  assert.deepEqual(
    probes.map((x) => [x.qid, x.outcome, x.picks, x.key, x.hash === q(x.qid).hash, x.orders?.length, x.runId === run.id, x.model]),
    [
      ['v6-03', 'clean', ['C'], 'B', true, 1, true, 'haiku'],
      ['v6-02', 'cue', ['AC', 'AC'], 'AC', true, 2, true, 'haiku'],
      ['v6-01', 'clean', ['A', 'B'], 'A', true, 2, true, 'haiku'],
    ],
  );
  assert.equal(probes[1].reason, 'phương án A và C dài nhất');
  assert.match(ledgerText(), /`v6-02` · 🎯 phương án lộ đáp án — đoán được không cần đọc đề \(2 lần đều chọn AC\) · haiku — phương án A và C dài nhất <!-- verify \{[^\n]*"probe":"choices-only"/);
  assert.deepEqual([q('v6-02').status, q('v6-01').status, q('v6-03').status], ['active', 'active', 'draft'], 'no auto-draft on cue, no reactivation');
  assert.ok(!fs.existsSync(path.join(home, 'coach', 'patches', `${run.id}-verify.yaml`)));
  const after = verify.verifySummary(loadBank());
  assert.deepEqual([after.verified, after.ok, after.review, after.stale, after.pending.map((x) => x.qid)], [before.verified, before.ok, before.review, before.stale, before.pending.map((x) => x.qid)], 'blind-solve numbers unchanged');
  assert.deepEqual({ ...after.cues!, items: after.cues!.items.map((x) => x.qid) }, { probed: 3, cue: 1, clean: 2, stale: 0, items: ['v6-02'] });

  // the default scope now: v6-01 / v6-02 probed for this version, v6-03 is a draft → nothing to do
  assert.throws(() => runner.coachRunner.start('verify', 'cli', { scope: 'cues' }, { syncBefore: false, syncAfter: false }), (e: Error) => e instanceof runner.NothingToDoError && /Không có câu nào cần dò phương án lộ đáp án/.test(e.message));
  // the probe model: coach.verify.probe_model, '' → the verify model
  const cfg = (await import('../server/config.ts')).loadConfig();
  assert.equal(runner.probeModel(cfg), 'haiku');
  assert.equal(runner.probeModel({ ...cfg, coach: { ...cfg.coach, verify: { ...cfg.coach.verify, probe_model: '' } } }), 'opus');
  assert.ok(!runner.probeArgs('P', { ...cfg, coach: { ...cfg.coach, verify: { ...cfg.coach.verify, probe_model: 'sonnet' } } }).includes('--fallback-model'));
});

test('[v6] runner: a first-run hit whose second run gives no valid answer stays unprobed (error, no line)', async () => {
  fs.rmSync(verify.VERIFY_FILE, { force: true });
  const q4 = q('v6-04');
  const [o1] = verify.probeOrders(q4, 0);
  // p1-1 = the key → run 2 is due, but its call answers nothing usable → no line, counted as an error
  const { run, log, calls: cs } = await runVerify({ scope: 'cues', ids: [q4.id] }, { 'p1-1': { answer: [letterOf(o1, 'C')], shown: true }, 'p2-1': { answer: ['H'], shown: true } });
  assert.equal(cs.length, 2);
  assert.equal(run.status, 'error', log);
  assert.deepEqual(run.outcome!.cues, { checked: 0, cue: 0, clean: 0, error: 1, flagged: [] });
  assert.match(log, /Không dò được câu nào/);
  assert.deepEqual(verify.loadProbes(), []);
});

// ── scripts/coach-run.ts --verify --scope cues ──────────────────────────────

function coachRun(args: string[], fake: Record<string, unknown> = {}): { code: number | null; out: string } {
  const env: NodeJS.ProcessEnv = { ...process.env, FAKE_VERIFY: JSON.stringify(fake) };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS']) delete env[k];
  const r = spawnSync(process.execPath, ['scripts/coach-run.ts', ...args], { cwd: TRAINER_ROOT, env, encoding: 'utf8', timeout: 120_000 });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

test('[v6] coach-run.ts --verify --scope cues: runs the probe, a mistyped or missing scope fails clearly (exit 2), nothing to do exits 0', () => {
  const bad = coachRun(['--verify', '--scope', 'cue']);
  assert.equal(bad.code, 2, bad.out);
  assert.match(bad.out, /--scope không hợp lệ: cue \(new \| unverified-ai \| changed \| audit \| grounded \| cues\)/);
  const empty = coachRun(['--verify', '--scope', '--ids', 'v6-04']);
  assert.equal(empty.code, 2, empty.out);
  assert.match(empty.out, /--scope cần một giá trị/);
  assert.equal(verify.loadProbes().length, 0, 'nothing ran');

  const q4 = q('v6-04');
  const [o1] = verify.probeOrders(q4, 0);
  const ok = coachRun(['--verify', '--scope', 'cues', '--ids', 'v6-04'], { 'p1-1': { answer: [letterOf(o1, 'A')], shown: true } });
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /· 1 câu · 🎯 dò phương án lộ đáp án · Claude Code [\d.]+ · model haiku/);
  assert.match(ok.out, /✔ 🎯 Dò 1\/1 câu chỉ bằng phương án: 0 lộ đáp án · 1 không lộ/);
  assert.deepEqual(verify.loadProbes().map((p) => [p.qid, p.outcome, p.picks]), [['v6-04', 'clean', ['A']]]);

  fs.rmSync(verify.VERIFY_FILE, { force: true });
  const pack = coachRun(['--verify', '--scope', 'cues', '--pack', 'v6-imp'], { 'p1-1': { answer: ['A'], shown: true } });
  assert.equal(pack.code, 0, pack.out);
  assert.deepEqual(verify.loadProbes().map((p) => p.qid), ['imp-01'], '--pack overrides the default targets');
  const none = coachRun(['--verify', '--scope', 'cues', '--pack', 'v6-imp']);
  assert.equal(none.code, 0, none.out);
  assert.match(none.out, /✓ Không có câu nào cần dò phương án lộ đáp án/);
});
