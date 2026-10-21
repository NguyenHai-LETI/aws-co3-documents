// Unit tests for leeches ("câu dai dẳng", λ): the rule in computeStates (enter / exit), results/leeches.md (latest line
// per id wins, pauses ≤ 3 days), parked leeches left out of the review queue, the list and the save rules.
// Uses a throw-away data root (TRAINER_HOME) with a generated pack — never the real bank/results.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from '../server/config.ts';
import type { AnswerRecord, Attempt } from '../shared/types.ts';

const TRAINER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-leech-'));
fs.mkdirSync(path.join(HOME, 'bank', 'packs', 'manual'), { recursive: true });
fs.copyFileSync(path.join(TRAINER, 'bank', 'taxonomy.yaml'), path.join(HOME, 'bank', 'taxonomy.yaml'));
process.env.TRAINER_HOME = HOME;
after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const { DATA_DIR } = await import('../server/config.ts');
const it = DATA_DIR === HOME ? test : test.skip;

const stats = await import('../server/lib/stats.ts');
const leech = await import('../server/lib/leech.ts');
const { regradeAttempts } = await import('../server/lib/regrade.ts');
const { loadBank } = await import('../server/lib/bank.ts');
const { serializePack } = await import('../server/lib/pack-format.ts');
const { stringifyFrontMatter } = await import('../server/lib/frontmatter.ts');
const { localDateKey } = await import('../server/lib/time.ts');

const DAY = 86_400_000;
const NOW = Date.now();
const today = localDateKey(new Date(NOW));
const dayKeyAgo = (n: number) => localDateKey(new Date(NOW - n * DAY));

const cfg = {
  srs: { algorithm: 'fsrs', desired_retention: 0.9, daily_limit: 50, mastered_stability_days: 21, intervals_days: [1, 3, 7, 14, 30], mastered_box: 4, weights: [], optimize: 'off', optimize_min_reviews: 400, exam_aware: false, final_review_days: 7, new_cutoff_days: 10, load_balance: false, final_retention: 0, leech_lapses: 3, sibling_swap_days: 7 },
  practice: { default_count: 20, quick_count: 10, shuffle_options: true, exclude_out_of_scope: false, today_minutes: 25, relearn: true },
  stats: { rushed_median_seconds: 5, recency_half_life_days: 14, recognized_wpm: 300 },
} as unknown as AppConfig;

const drafts = Array.from({ length: 6 }, (_, i) => ({
  id: `lee-${i + 1}`,
  stem: `A company wants to decouple order processing number ${i}. Which service fits best?`,
  options: [
    { key: 'A', text: 'Amazon SQS standard queue' },
    { key: 'B', text: 'Amazon SNS topic' },
    { key: 'C', text: 'Amazon Kinesis Data Streams' },
    { key: 'D', text: 'AWS Step Functions' },
  ],
  answer: ['A'],
  explanation: 'SQS decouples.',
  domain: 'resilient',
  topic: 'integration',
  difficulty: 'medium' as const,
  time: 60,
  task: '2.1',
}));
fs.writeFileSync(path.join(HOME, 'bank', 'packs', 'manual', 'leech-test.md'), serializePack({ pack: 'leech-test', title: 'Leech test', origin: 'manual' }, '', drafts, (x) => stringifyFrontMatter(x)));
const bank = loadBank();

const ans = (q: string, ok: boolean, extra: Partial<AnswerRecord> = {}): AnswerRecord => ({ q, pick: ok ? 'A' : 'B', key: 'A', ok, t: 60, est: 60, ...extra });
let seq = 0;
const at = (daysAgo: number, answers: AnswerRecord[], extra: Partial<Attempt> = {}): Attempt =>
  ({ id: `l${++seq}`, mode: 'custom', finished: new Date(NOW - daysAgo * DAY).toISOString(), answers, ...extra }) as Attempt;

it('leech rule: lapses ≥ leech_lapses, or ≥ 3 wrong on ≥ 2 days; out after sure-right answers on 2 different days', () => {
  const q = 'lee-1';
  // right, then 3 lapses → leech
  const lapses = [at(10, [ans(q, true)]), at(8, [ans(q, false)]), at(7, [ans(q, true)]), at(6, [ans(q, false)]), at(5, [ans(q, true)]), at(4, [ans(q, false)])];
  assert.equal(stats.computeStates(lapses, cfg, NOW).get(q)!.leech, true);
  assert.equal(stats.computeStates(lapses, { ...cfg, srs: { ...cfg.srs, leech_lapses: 0 } }, NOW).get(q)!.leech, undefined, 'leech_lapses 0 = off');
  // never right: 3 wrong on 2 days → leech; on one day → not
  const twoDays = [at(3, [ans('lee-2', false)]), at(3, [ans('lee-2', false)]), at(2, [ans('lee-2', false)])];
  assert.equal(stats.computeStates(twoDays, cfg, NOW).get('lee-2')!.leech, true);
  const oneDay = [at(2, [ans('lee-3', false)]), at(2, [ans('lee-3', false)]), at(2, [ans('lee-3', false)])];
  assert.equal(stats.computeStates(oneDay, cfg, NOW).get('lee-3')!.leech, undefined);
  // recovery: right twice on the same day is not enough, a second day is
  const sameDay = [...twoDays, at(1, [ans('lee-2', true)]), at(1, [ans('lee-2', true)])];
  assert.equal(stats.computeStates(sameDay, cfg, NOW).get('lee-2')!.leech, true);
  const recovered = [...sameDay, at(0, [ans('lee-2', true)])];
  assert.equal(stats.computeStates(recovered, cfg, NOW).get('lee-2')!.leech, undefined);
  // a hinted right answer does not count toward recovery; a wrong one restarts it
  const hinted = [...twoDays, at(1, [ans('lee-2', true)]), at(0, [ans('lee-2', true, { hinted: true })])];
  assert.equal(stats.computeStates(hinted, cfg, NOW).get('lee-2')!.leech, true);
  // relearning retries never count (neither as wrong nor as right)
  const relearn = [at(3, [ans('lee-4', false), ans('lee-4', false, { relearn: true })]), at(2, [ans('lee-4', false), ans('lee-4', true, { relearn: true })])];
  const s4 = stats.computeStates(relearn, cfg, NOW).get('lee-4')!;
  assert.equal(s4.attempts, 2);
  assert.equal(s4.leech, undefined, '2 wrong answers only');
});

it('leeches.md: latest line per id wins (date, then order); pause N days from that date; malformed lines ignored', () => {
  const text = [
    '# header',
    `- ${dayKeyAgo(1)} · lee-1 · pause 3 · note: SQS ≠ SNS`,
    `- ${dayKeyAgo(5)} · lee-1 · pause 0 · note: older line appended later`,
    `- ${today} · lee-2 · pause 1 · note:`,
    `- ${today} · lee-2 · pause 2 · note: second today`,
    '- garbage line',
    `- ${today} · lee-3 · pause 9 · note: capped`,
  ].join('\n');
  const notes = leech.parseLeechNotes(text);
  assert.equal(notes.get('lee-1')!.note, 'SQS ≠ SNS');
  assert.equal(notes.get('lee-1')!.pausedUntil, localDateKey(new Date(NOW + DAY)), 'yesterday + 3 days − 1');
  assert.equal(notes.get('lee-2')!.pause, 2);
  assert.equal(notes.get('lee-2')!.note, 'second today');
  assert.equal(notes.get('lee-3')!.pause, 3);
  assert.equal(notes.size, 3);
});

it('parked leeches are left out of the review queue; the list shows picks, why, pair; save rules', () => {
  const q = 'lee-5';
  const history = regradeAttempts(
    [at(9, [ans(q, true)]), at(8, [ans(q, false, { pick: 'B', why: 'nghĩ SNS cũng xếp hàng' })]), at(6, [ans(q, true)]), at(5, [ans(q, false, { pick: 'B' })]), at(4, [ans(q, true)]), at(3, [ans(q, false, { pick: 'C' })]), at(2, [ans('lee-6', true)])],
    bank,
    cfg,
  );
  const states = stats.computeStates(history, cfg, NOW);
  assert.equal(states.get(q)!.leech, true);
  const ctx = { bank, attempts: history, states };
  const pool = bank.questions;
  assert.ok(stats.reviewQueue(pool, states, history, cfg, NOW).due.some((x) => x.id === q), 'due before parking');
  const list = leech.leeches(ctx);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, q);
  assert.equal(list[0].lapses, 3);
  assert.equal(list[0].wrong, 3);
  assert.equal(list[0].wrongDays, 3);
  assert.deepEqual(list[0].picks, { B: 2, C: 1 });
  assert.deepEqual(list[0].why, ['nghĩ SNS cũng xếp hàng']);
  assert.deepEqual(list[0].pair, ['SNS', 'SQS'], 'taxonomy service names');
  // save: pause a leech 3 days, then a note keeps the pause; un-park with 0
  assert.throws(() => leech.saveLeechNote(ctx, 'nope', { note: 'x' }), /Không tìm thấy/);
  assert.throws(() => leech.saveLeechNote(ctx, q, { pauseDays: 4 }), /0–3/);
  assert.throws(() => leech.saveLeechNote(ctx, 'lee-6', { pauseDays: 2 }), /câu dai dẳng/);
  assert.throws(() => leech.saveLeechNote(ctx, q, {}), /note/);
  const saved = leech.saveLeechNote(ctx, q, { pauseDays: 3, note: '  SQS = hàng đợi,\n SNS = phát tin ' }, NOW);
  assert.equal(saved.note, 'SQS = hàng đợi, SNS = phát tin');
  assert.equal(saved.pausedUntil, localDateKey(new Date(NOW + 2 * DAY)));
  assert.ok(leech.pausedLeeches(today).has(q));
  assert.ok(!stats.reviewQueue(pool, states, history, cfg, NOW).due.some((x) => x.id === q), 'parked → not due');
  leech.applyLeechPauses(states, today);
  assert.equal(states.get(q)!.leechPausedUntil, saved.pausedUntil);
  assert.equal(leech.leeches(ctx)[0].pausedUntil, saved.pausedUntil);
  const kept = leech.saveLeechNote(ctx, q, { note: 'mẹo mới' }, NOW);
  assert.equal(kept.pausedUntil, saved.pausedUntil, 'a note keeps the running pause');
  const un = leech.saveLeechNote(ctx, q, { pauseDays: 0 }, NOW);
  assert.equal(un.pausedUntil, undefined);
  assert.equal(un.note, 'mẹo mới');
  assert.ok(!leech.pausedLeeches(today).has(q));
  const lines = fs.readFileSync(leech.LEECHES_FILE, 'utf8').split('\n').filter((l) => l.startsWith('- '));
  assert.equal(lines.length, 3, 'append-only');
  assert.match(lines[0], new RegExp(`^- ${today} · ${q} · pause 3 · note: SQS`));
});

it('R1 #4: retest misses (minutes after the explanation) are no lapses and no leech evidence', () => {
  const q = 'lee-6';
  const history = [at(6, [ans(q, true)]), at(5, [ans(q, false)]), at(5, [ans(q, false)], { mode: 'retest', retestOf: 'x' }), at(4, [ans(q, false)], { mode: 'retest', retestOf: 'y' }), at(3, [ans(q, false)], { mode: 'retest', retestOf: 'z' })];
  const s = stats.computeStates(history, cfg, NOW).get(q)!;
  assert.equal(s.lapses, 1, 'only the real miss');
  assert.equal(s.leech, undefined);
  assert.equal(s.attempts, 5, 'retests are still answers');
});
