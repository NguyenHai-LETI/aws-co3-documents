// Unit tests for the pure rules behind the v4 learning screens (web/components/onboarding/rules.ts): no pass/fail verdict
// on the diagnostic and on short practice tests during the first week, diagnostic halves, the starting map per exam-guide
// task, "fix first" order, first vs repeat exposure on a result, the next exam-day checklist item.
// [μ v5] + web/components/learning/rules.ts: today budget chips / composition / progress, phase · new-question · catch-up
// lines, the statistical shield (bucket evidence, Wilson / Newcombe gaps behind the stamina, calibration, length and
// exposure notes), correction steps and "đính chính", attempt badges, the pair progress line, go / no-go, capacity rows.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIAGNOSTIC_PART,
  FIRST_WEEK_DAYS,
  SHORT_TEST,
  dayNumber,
  dueIn,
  fixFirst,
  freshSplit,
  isDiagnostic,
  isDiagnosticPart,
  isExamLike,
  localKey,
  nextChecklistItem,
  noVerdict,
  scoreTone,
  taskCells,
  viewed,
} from '../web/components/onboarding/rules.ts';
import type { AnswerRecord, ChecklistItem, ResultAnnotations, TaskDef, TestMode } from '../shared/types.ts';

const start = '2026-10-01';
const at = (days: number, hour = 10) => new Date(2026, 9, 1 + days, hour, 0, 0).toISOString(); // local time
const attempt = (mode: TestMode, total: number, days: number, extra: Record<string, unknown> = {}) => ({ mode, total, finished: at(days), passed: false, ...extra });

test('dayNumber: YYYY-MM-DD keys and ISO times map to the same local day', () => {
  assert.equal(dayNumber('2026-10-05') - dayNumber('2026-10-01'), 4);
  assert.equal(dayNumber(at(4, 23)), dayNumber('2026-10-05'));
  assert.equal(dayNumber(at(4, 0)), dayNumber('2026-10-05'));
  assert.equal(localKey(new Date(2026, 0, 9, 12)), '2026-01-09');
});

test('noVerdict: diagnostic is always a starting point, exam-like results always get a verdict', () => {
  assert.equal(noVerdict(attempt('diagnostic', 28, 0), start), 'diagnostic');
  assert.equal(noVerdict(attempt('ids', 14, 30, { diagnostic: true }), start), 'diagnostic');
  for (const a of [attempt('exam', 65, 0), attempt('quick', 10, 0, { pearson: true }), attempt('sealed', 50, 0), attempt('ids', 10, 0, { sealedForm: 'S1' })]) {
    assert.equal(noVerdict(a, start), undefined, a.mode);
    assert.equal(noVerdict(a, undefined), undefined, 'no need to wait for the study start');
  }
});

test('noVerdict: [v5] a retest and self-graded sources are never a pass/fail sample', () => {
  assert.equal(noVerdict(attempt('retest', 26, 30, { retestOf: 'x' }), start), 'not-sample');
  for (const source of ['anki', 'listen', 'micro']) assert.equal(noVerdict(attempt('quick', 40, 30, { source }), start), 'not-sample', source);
  assert.equal(noVerdict(attempt('quick', 40, 30, { source: 'chat' }), start), undefined, 'a chat quiz is graded on real picks');
});

test('noVerdict: short practice tests get no verdict during the first 7 days only', () => {
  for (let d = 0; d < FIRST_WEEK_DAYS; d++) assert.equal(noVerdict(attempt('quick', 10, d), start), 'first-week', `day ${d}`);
  assert.equal(noVerdict(attempt('quick', 10, FIRST_WEEK_DAYS), start), undefined, 'day 7 = second week');
  assert.equal(noVerdict(attempt('topic', SHORT_TEST - 1, 2), start), 'first-week');
  assert.equal(noVerdict(attempt('srs', SHORT_TEST, 2), start), undefined, 'not a short test');
  assert.equal(noVerdict(attempt('quick', 10, 2), undefined), 'pending', 'study start still loading');
  assert.equal(noVerdict(attempt('quick', 10, 2), null), 'first-week', 'nothing counted yet = first day');
  // an ISO study start works like a date key
  assert.equal(noVerdict(attempt('quick', 10, 6), at(0, 22)), 'first-week');
});

test('scoreTone: neutral badge without a verdict, good / bad otherwise', () => {
  assert.equal(scoreTone(attempt('quick', 10, 1), start), '');
  assert.equal(scoreTone(attempt('quick', 10, 9), start), 'bad');
  assert.equal(scoreTone({ ...attempt('quick', 10, 9), passed: true }, start), 'good');
  assert.equal(scoreTone(attempt('exam', 65, 1), start), 'bad');
  assert.equal(scoreTone(attempt('diagnostic', 28, 1), start), '');
});

test('diagnostic halves and exam-like modes', () => {
  assert.ok(isDiagnostic({ mode: 'diagnostic' }));
  assert.ok(isDiagnostic({ mode: 'ids', diagnostic: true }));
  assert.ok(!isDiagnostic({ mode: 'quick' }));
  assert.ok(isDiagnosticPart({ mode: 'diagnostic', total: DIAGNOSTIC_PART }));
  assert.ok(!isDiagnosticPart({ mode: 'diagnostic', total: 28 }));
  assert.ok(!isDiagnosticPart({ mode: 'quick', total: 10 }));
  assert.ok(isExamLike({ mode: 'exam' }) && isExamLike({ mode: 'sealed' }) && isExamLike({ mode: 'custom', pearson: true }));
  assert.ok(!isExamLike({ mode: 'diagnostic' }));
});

const TASKS: TaskDef[] = [
  { id: '1.1', domain: 'secure', label: 'a', label_vi: 'a' },
  { id: '1.2', domain: 'secure', label: 'b', label_vi: 'b' },
  { id: '2.1', domain: 'resilient', label: 'c', label_vi: 'c' },
  { id: '3.1', domain: 'performance', label: 'd', label_vi: 'd' },
  { id: '4.1', domain: 'cost', label: 'e', label_vi: 'e' },
];
const rec = (q: string, ok: boolean, extra: Partial<AnswerRecord> = {}): AnswerRecord => ({ q, pick: ok ? 'A' : 'B', key: 'A', ok, t: 30, est: 45, ...extra });

test('taskCells: ✓ all right · ~ some right · ✗ none right · – no viewed answer', () => {
  const rows = [
    { r: rec('a1', true), q: { task: '1.1' } },
    { r: rec('a2', true), q: { task: '1.1' } },
    { r: rec('b1', true), q: { task: '1.2' } },
    { r: rec('b2', false), q: { task: '1.2' } },
    { r: rec('c1', false), q: { task: '2.1' } },
    { r: rec('c2', false, { pick: '', t: 0 }), q: { task: '2.1' } }, // never viewed: not counted
    { r: rec('d1', false, { pick: '', t: 0 }), q: { task: '3.1' } }, // never viewed → untested
    { r: rec('e1', true, { scored: false }), q: { task: '4.1' } }, // pilot: not counted
    { r: rec('x1', true), q: null }, // question no longer in the bank
    { r: rec('x2', true), q: {} }, // no task
  ];
  const cells = taskCells(rows, TASKS);
  assert.deepEqual(
    cells.map((c) => [c.t.id, c.status, `${c.correct}/${c.answers}`]),
    [
      ['1.1', 'ok', '2/2'],
      ['1.2', 'partial', '1/2'],
      ['2.1', 'weak', '0/1'],
      ['3.1', 'untested', '0/0'],
      ['4.1', 'untested', '0/0'],
    ],
  );
  assert.ok(viewed({ pick: '', t: 12 }), 'skipped after reading = viewed (counts as wrong)');
  assert.ok(!viewed({ pick: '', t: 0 }));
});

test('fixFirst: nothing-right tasks first, heavier exam domains first, at most n', () => {
  const weights: Record<string, number> = { secure: 30, resilient: 26, performance: 24, cost: 20 };
  const cell = (id: string, domain: TaskDef['domain'], status: 'ok' | 'partial' | 'weak' | 'untested') => ({ t: { id, domain, label: id, label_vi: id }, answers: 2, correct: 0, status });
  const order = fixFirst(
    [cell('4.1', 'cost', 'weak'), cell('1.2', 'secure', 'partial'), cell('2.1', 'resilient', 'weak'), cell('1.1', 'secure', 'ok'), cell('3.1', 'performance', 'untested')],
    (d) => weights[d] ?? 0,
  ).map((c) => c.t.id);
  assert.deepEqual(order, ['2.1', '4.1', '1.2']);
  assert.equal(fixFirst([cell('4.1', 'cost', 'weak'), cell('2.1', 'resilient', 'weak')], (d) => weights[d], 1).length, 1);
});

test('freshSplit: the server split when present, else counted from the exposure map (pilots excluded)', () => {
  const answers = [rec('a', true), rec('b', false), rec('c', true), rec('d', true, { scored: false }), rec('e', false, { pick: '', t: 0 })];
  assert.equal(freshSplit({ answers }), undefined, 'no annotations (older server)');
  const ann: ResultAnnotations = { exposure: { a: 1, b: 1, c: 3, d: 1 }, recognized: ['c'], unviewed: ['e'] };
  assert.equal(freshSplit({ answers }, ann), undefined, 'no server split (e.g. a rushed attempt) → nothing shown, not re-derived from the exposure map');
  assert.deepEqual(freshSplit({ answers }, { ...ann, fresh: { total: 4, seenBefore: 1, answers: 3, correct: 1 } }), { total: 4, seenBefore: 1, answers: 3, correct: 1 }, 'a server split counting the never-viewed e as a wrong first try passes through unchanged');
  const fresh = { total: 50, seenBefore: 12, answers: 38, correct: 27 };
  assert.deepEqual(freshSplit({ answers }, { ...ann, fresh }), fresh);
});

const item = (id: string, extra: Partial<ChecklistItem> = {}): ChecklistItem => ({ id, label: id, done: false, dueText: 'trước khi đặt lịch', ...extra });

test('nextChecklistItem: overdue first, then the earliest due date, undated last; done items skipped', () => {
  assert.equal(nextChecklistItem(undefined), undefined);
  assert.equal(nextChecklistItem([item('a', { done: true })]), undefined);
  const list = [item('undated'), item('later', { due: '2026-11-20' }), item('soon', { due: '2026-11-02' }), item('old', { due: '2026-10-01', overdue: true }), item('done', { due: '2026-10-02', done: true })];
  assert.equal(nextChecklistItem(list)?.id, 'old');
  assert.equal(nextChecklistItem(list.filter((i) => i.id !== 'old'))?.id, 'soon');
  assert.equal(nextChecklistItem([item('undated'), item('second')])?.id, 'undated', 'server order kept without dates');
});

test('dueIn: days left, today, overdue', () => {
  const now = new Date(2026, 9, 20, 18, 30);
  assert.equal(dueIn('2026-10-25', now), 'còn 5 ngày');
  assert.equal(dueIn('2026-10-20', now), 'hôm nay');
  assert.equal(dueIn('2026-10-18', now), 'quá hạn 2 ngày');
});

// ── [μ v5] web/components/learning/rules.ts ─────────────────────────────────

import {
  attemptBadges,
  budgetOptions,
  calibrationNote,
  capacityRows,
  catchUpLine,
  checkGlyph,
  correctionSteps,
  correctionsOf,
  deadlineText,
  isGraded,
  numberAnswers,
  evidenceNote,
  exposureNote,
  goNoGoBadge,
  intervalText,
  lengthNote,
  mixParts,
  needMoreBelow,
  newQuotaLine,
  pairHref,
  parseSessionRef,
  phaseSpan,
  rateGap,
  separationText,
  sprintOffered,
  staminaNote,
  todayProgress,
  togglePick,
  undecidedText,
  versionOf,
  weakSort,
  weakestTopics,
  upperBound,
} from '../web/components/learning/rules.ts';
import type { Bucket, NewQuota } from '../shared/types.ts';

test('budgetOptions: 5/10/25/45 + the learner budget, capped by the phase', () => {
  assert.deepEqual(budgetOptions(25), [5, 10, 25, 45]);
  assert.deepEqual(budgetOptions(20), [5, 10, 20, 25, 45]);
  assert.deepEqual(budgetOptions(undefined), [5, 10, 25, 45]);
  assert.deepEqual(budgetOptions(25, 30), [5, 10, 25, 30], 'light phase: 30′ cap replaces 45');
  assert.deepEqual(budgetOptions(40, 30), [5, 10, 25, 30]);
  assert.deepEqual(budgetOptions(45, 45), [5, 10, 25, 45]);
});

test('mixParts: fixed order, empty parts dropped, swapped siblings and the quick top-up shown', () => {
  const mix = { minutes: 25, seconds: 1400, pace: 1, review: 12, retry: 6, weak: 10, new: 0, advance: 0, swapped: 0, weakTasks: ['1.2'] };
  assert.deepEqual(mixParts({ count: 28, mix }), ['12 ôn', '6 làm lại', '10 vá task 1.2']);
  assert.deepEqual(mixParts({ count: 31, mix: { ...mix, swapped: 2, new: 3 } }), ['12 ôn (2 câu anh em)', '6 làm lại', '10 vá task 1.2', '3 mới']);
  assert.deepEqual(mixParts({ count: 30, mix: { ...mix, weakTasks: [], advance: 1 } }), ['12 ôn', '6 làm lại', '10 vá task yếu', '1 ôn trước hạn', '1 luyện thêm']);
  assert.deepEqual(mixParts({ count: 12, mix: undefined }), [], 'no mix (older server) → headline only');
});

test('todayProgress: minutes against the daily goal, goal met from the server', () => {
  assert.deepEqual(todayProgress({ answers: 12, minutes: 14.4, goalMet: false }, 25), { pct: 58, text: 'Hôm nay đã học 12 câu · 14′ / 25′', met: false });
  assert.deepEqual(todayProgress({ answers: 30, minutes: 31, goalMet: true }, 25).pct, 100);
  assert.equal(todayProgress({ answers: 30, minutes: 31, goalMet: true }, 25).met, true);
  assert.equal(todayProgress(undefined, 25).text, 'Hôm nay chưa học câu nào · mục tiêu 25′');
});

test('parseSessionRef: "<plan>#<session>"', () => {
  assert.deepEqual(parseSessionRef('2026-10-19_0712_coach#s2'), { plan: '2026-10-19_0712_coach', session: 's2' });
  for (const bad of [undefined, '', 'plan', '#s1', 'plan#']) assert.equal(parseSessionRef(bad), undefined, String(bad));
});

test('newQuotaLine / catchUpLine / phaseSpan / sprintOffered', () => {
  const q: NewQuota = { perDay: 18, unseen: 360, cutoff: '2026-11-25', daysLeft: 20, doneToday: 0 };
  assert.equal(newQuotaLine(undefined, 3), undefined);
  assert.deepEqual(newQuotaLine(q, 34), { text: 'Hôm nay: 34 ôn + 18 mới → phủ 100 % trước 25/11', paused: false });
  assert.equal(newQuotaLine({ ...q, doneToday: 6 }, 34)?.text, 'Hôm nay: 34 ôn + 18 mới (đã làm 6) → phủ 100 % trước 25/11');
  assert.equal(newQuotaLine({ ...q, doneToday: 18 }, 34)?.text, 'Hôm nay: 34 ôn + 18 mới ✓ → phủ 100 % trước 25/11');
  assert.deepEqual(newQuotaLine({ ...q, paused: 'tồn đọng 140 > 2 × 50' }, 50), { text: 'Hôm nay: 50 ôn · ⏸ tạm dừng câu mới — tồn đọng 140 > 2 × 50', paused: true });
  assert.equal(newQuotaLine({ ...q, unseen: 0 }, 5)?.text, 'Hôm nay: 5 ôn · ✓ đã gặp hết câu trong ngân hàng');
  assert.equal(catchUpLine(undefined), undefined);
  assert.equal(catchUpLine({ backlog: 0, days: 3, perDay: 10 }), undefined);
  assert.match(catchUpLine({ backlog: 120, days: 3, perDay: 40 }) ?? '', /tồn 120 lượt ôn — ôn khoảng 40 câu\/ngày trong 3 ngày/);
  assert.equal(phaseSpan({ daysLeft: 12, from: '2026-11-03', to: '2026-11-09' }), 'T−12 · 03/11 → 09/11');
  assert.equal(phaseSpan({ daysLeft: 1, from: '2026-11-19', to: '2026-11-19' }), 'T−1 · 19/11');
  assert.equal(phaseSpan({ daysLeft: 0 }), 'thi hôm nay');
  assert.equal(phaseSpan({ daysLeft: -3 }), 'đã thi 3 ngày trước');
  assert.deepEqual([15, 14, 7, 1, 0, -1, undefined].map(sprintOffered), [false, true, true, true, false, false, false]);
});

const bucket = (key: string, attempts: number, accuracy: number, extra: Partial<Bucket> = {}): Bucket => ({
  key,
  label: key,
  attempts,
  correct: Math.round((attempts * accuracy) / 100),
  accuracy,
  questions: attempts,
  bank: 50,
  avgTime: 40,
  avgEst: 45,
  ...extra,
});

test('evidence: verdict texts, interval, weak lists by the pessimistic bound', () => {
  assert.equal(undecidedText(12), 'chưa đủ dữ liệu — cần ~12 câu nữa');
  assert.equal(undecidedText(0), 'chưa đủ dữ liệu');
  assert.deepEqual(evidenceNote({ verdict: 'below' }), { text: 'thấp hơn mức chung của bạn', tone: 'bad' });
  assert.deepEqual(evidenceNote({ verdict: 'unknown', needMore: 9 }), { text: 'chưa đủ dữ liệu — cần ~9 câu nữa', tone: 'dim' });
  assert.equal(evidenceNote({}), undefined, 'older server: no shield fields');
  assert.equal(intervalText({ lo: 31.4, hi: 60.2 }), '31–60%');
  assert.equal(intervalText({ lo: 31 }), undefined);
  // 3/3 wrong (raw 0 %) has a wide interval; 40 answers at 55 % are surely weaker
  const rows = [bucket('tiny', 3, 0, { lo: 12 }), bucket('solid', 40, 55, { lo: 44 }), bucket('mid', 12, 50, { lo: 30 }), bucket('none', 0, 0)];
  assert.deepEqual(weakSort(rows).map((b) => b.key), ['tiny', 'mid', 'solid']);
  assert.deepEqual(weakSort([bucket('a', 5, 40), bucket('b', 9, 40), bucket('c', 5, 20)]).map((b) => b.key), ['c', 'b', 'a'], 'no bounds: raw accuracy, more answers first on ties');
});

test('weakestTopics: only confirmed-below topics with the shield, the v4 rule without it', () => {
  const shielded = [bucket('db', 20, 50, { lo: 38, verdict: 'below' }), bucket('net', 4, 25, { lo: 20, verdict: 'unknown', needMore: 8 }), bucket('sec', 30, 45, { lo: 35, verdict: 'below' })];
  assert.deepEqual(weakestTopics(shielded), { list: [shielded[2], shielded[0]], shielded: true });
  const old = [bucket('db', 20, 50), bucket('net', 4, 25), bucket('sec', 30, 45)];
  assert.deepEqual(weakestTopics(old).list.map((b) => b.key), ['sec', 'db'], 'v4: ≥ 5 answers, lowest accuracy');
  assert.equal(weakestTopics(old).shielded, false);
});

test('rateGap / upperBound / needMoreBelow: the shared shield (evidence.ts compareRates) behind the notes', () => {
  const g = rateGap({ correct: 56, answers: 70 }, { correct: 48, answers: 80 });
  assert.equal(g.diff, 20, 'raw difference in points');
  assert.ok(g.lo > 0 && g.lo < g.diff && g.hi > g.diff, `${g.lo} … ${g.hi}`);
  assert.equal(g.verdict, 'higher');
  assert.equal(g.needMore, undefined, 'decided');
  assert.equal(rateGap({ correct: 6, answers: 16 }, { correct: 15, answers: 16 }).verdict, 'lower');
  assert.equal(rateGap({ correct: 304, answers: 400 }, { correct: 300, answers: 400 }).verdict, 'same', 'surely within ± 10 points');
  const even = rateGap({ correct: 8, answers: 16 }, { correct: 8, answers: 16 });
  assert.equal(even.verdict, 'unknown');
  assert.ok((even.needMore ?? 0) > 0, 'even halves still need answers before "same"');
  const small = rateGap({ correct: 12, answers: 16 }, { correct: 9, answers: 16 });
  assert.equal(small.verdict, 'unknown');
  assert.ok(small.needMore && small.needMore > 0, 'a concrete target');
  const bigger = rateGap({ correct: 13, answers: 16 }, { correct: 8, answers: 16 });
  assert.ok((bigger.needMore ?? 0) < (small.needMore ?? 0), 'a larger gap needs fewer answers');
  assert.equal(rateGap({ correct: 0, answers: 0 }, { correct: 5, answers: 5 }).verdict, 'unknown', 'no answers → no verdict');
  assert.equal(rateGap({ correct: 4, answers: 4 }, { correct: 0, answers: 4 }).verdict, 'unknown', '< 5 answers a side never decides');
  assert.ok(upperBound({ correct: 28, answers: 40 }) < 80, '70 % on 40 answers: surely below 80 %');
  assert.ok(upperBound({ correct: 9, answers: 12 }) > 80, '75 % on 12 answers: could still be 80 %');
  assert.ok(needMoreBelow({ correct: 9, answers: 12 }, 80)! > 0);
  assert.equal(needMoreBelow({ correct: 9, answers: 10 }, 80), undefined, 'already above the threshold');
});

const quarter = (correct: number, answers: number, avgT = 90) => ({ correct, answers, acc: Math.round((correct / answers) * 1000) / 10, avgT });

test('staminaNote: warning / praise only when the quarter gap excludes 0', () => {
  assert.equal(staminaNote([quarter(15, 16), quarter(12, 16), quarter(10, 16), quarter(6, 16)]).cls, 'warn');
  const unclear = staminaNote([quarter(12, 16), quarter(11, 16), quarter(10, 16), quarter(9, 16)]);
  assert.equal(unclear.cls, 'dim', '18.75 points on 16 answers each is within noise');
  assert.match(unclear.text, /chưa đủ dữ liệu/);
  assert.equal(staminaNote([quarter(10, 16), quarter(10, 16), quarter(10, 16), quarter(10, 16)]).cls, 'dim', 'even: described, never praised');
  assert.match(staminaNote([quarter(10, 16, 100), quarter(10, 16), quarter(10, 16), quarter(10, 16, 50)]).text, /nhanh hơn hẳn/);
  assert.match(staminaNote([quarter(5, 16), quarter(9, 16), quarter(12, 16), quarter(15, 16)]).text, /tốt hơn về cuối/);
});

test('calibrationNote / lengthNote / exposureNote: verdicts behind the shield', () => {
  assert.equal(calibrationNote({ sure: { correct: 0, answers: 0 }, unsure: { correct: 0, answers: 0 } }), undefined);
  assert.equal(calibrationNote({ sure: { correct: 28, answers: 40 }, unsure: { correct: 5, answers: 10 } })?.cls, 'warn', '70 % on 40 sure answers');
  const maybe = calibrationNote({ sure: { correct: 9, answers: 12 }, unsure: { correct: 3, answers: 6 } });
  assert.equal(maybe?.cls, 'dim');
  assert.match(maybe?.text ?? '', /chưa đủ dữ liệu — cần ~\d+ câu nữa/);
  assert.equal(calibrationNote({ sure: { correct: 45, answers: 50 }, unsure: { correct: 10, answers: 20 } })?.cls, 'good');
  assert.equal(calibrationNote({ sure: { correct: 360, answers: 400 }, unsure: { correct: 372, answers: 400 } })?.cls, '', 'unsure as good as sure, with evidence');
  assert.match(calibrationNote({ sure: { correct: 45, answers: 50 }, unsure: { correct: 0, answers: 0 } })?.text ?? '', /Chưa có câu nào đánh dấu/);

  assert.equal(lengthNote({ short: { correct: 80, answers: 100 }, long: { correct: 55, answers: 100 } }, 50)?.cls, 'warn');
  assert.match(lengthNote({ short: { correct: 9, answers: 12 }, long: { correct: 7, answers: 12 } }, 50)?.text ?? '', /chưa đủ dữ liệu/);
  assert.equal(lengthNote({ short: { correct: 9, answers: 12 }, long: { correct: 9, answers: 12 } }, 20)?.examLink, true);
  assert.equal(lengthNote({ short: { correct: 9, answers: 12 }, long: { correct: 9, answers: 12 } }, 50), undefined);

  assert.equal(exposureNote({ first: { correct: 5, answers: 8 }, repeat: { correct: 9, answers: 10 } }).text, 'Cần ≥ 10 câu mỗi nhóm để so sánh.');
  assert.equal(exposureNote({ first: { correct: 50, answers: 100 }, repeat: { correct: 80, answers: 100 } }).cls, 'warn');
  assert.equal(exposureNote({ first: { correct: 300, answers: 400 }, repeat: { correct: 304, answers: 400 } }).cls, 'good');
  assert.match(exposureNote({ first: { correct: 6, answers: 12 }, repeat: { correct: 8, answers: 12 } }).text, /Câu gặp lại cao hơn câu mới 17 điểm — chưa đủ dữ liệu — cần ~\d+ câu nữa/);
  assert.match(exposureNote({ first: { correct: 6, answers: 12 }, repeat: { correct: 9, answers: 12 } }).text, /khoảng 80%: \+0\.\d … \+46 điểm/, 'bounds under 1 point keep a decimal');
});

const ans = (q: string, ok: boolean, extra: Partial<AnswerRecord> = {}): AnswerRecord => ({ q, pick: ok ? 'A' : 'B', key: 'A', ok, t: 30, est: 45, ...extra });

test('correctionSteps: confident errors first, then other wrong, then right-but-unsure; never-viewed / skipped / relearn out', () => {
  const rows = [
    { r: ans('a', true), known: true },
    { r: ans('b', false, { unsure: true }), known: true },
    { r: ans('c', false), known: true }, // confident error
    { r: ans('d', true, { unsure: true }), known: true },
    { r: ans('e', false, { pick: '', t: 0 }), known: true }, // never viewed
    { r: ans('f', false, { pick: '', t: 12, skipped: true }), known: true }, // stopped early
    { r: ans('g', false, { relearn: true }), known: true }, // in-session retry
    { r: ans('h', false, { hinted: true }), known: true },
    { r: ans('i', false), known: false }, // no longer in the bank
    { r: ans('j', false, { pick: '', t: 20 }), known: true }, // read, left blank
    { r: ans('k', false), known: true }, // confident error
    { r: ans('l', false), known: true, okNow: true }, // key fixed since: this pick is right now
  ];
  assert.deepEqual(
    correctionSteps(rows).map((s) => `${rows[s.index].r.q}:${s.kind}`),
    ['c:confident', 'k:confident', 'b:wrong', 'h:wrong', 'j:wrong', 'd:unsure'],
  );
  assert.deepEqual(togglePick(['A'], 'B', false), ['B']);
  assert.deepEqual(togglePick(['B'], 'B', false), []);
  assert.deepEqual(togglePick(['A'], 'C', true), ['A', 'C']);
  assert.deepEqual(togglePick(['A', 'C'], 'A', true), ['C']);
});

test('versionOf / correctionsOf: fixed keys, the answers learnt on the old key first', () => {
  const q = (answer: string[], hash = 'h1') => ({ answer, hash });
  assert.deepEqual(versionOf(ans('a', true, { key: 'A', h: 'h1' }), q(['A'])), { keyChanged: false, nowOk: true, edited: false });
  assert.deepEqual(versionOf(ans('a', true, { key: 'A', h: 'h0' }), q(['A'])), { keyChanged: false, nowOk: true, edited: true });
  assert.deepEqual(versionOf(ans('a', true, { key: 'A' }), q(['C'])), { keyChanged: true, nowOk: false, edited: false });
  const rows = [
    { r: ans('x', false, { pick: 'C', key: 'B' }), q: q(['C']), n: 1 }, // wrong then, right now
    { r: ans('y', true, { pick: 'A', key: 'A' }), q: q(['D']), n: 2 }, // learnt the old key
    { r: ans('z', true), q: q(['A']), n: 3 }, // unchanged
    { r: ans('w', true, { pick: 'A', key: 'A', relearn: true }), q: q(['D']), n: 4 }, // relearn record
    { r: ans('v', false), q: null, n: 5 },
  ];
  assert.deepEqual(correctionsOf(rows), [
    { n: 2, q: 'y', oldKey: 'A', newKey: 'D', wasOk: true, nowOk: false },
    { n: 1, q: 'x', oldKey: 'B', newKey: 'C', wasOk: false, nowOk: true },
  ]);
});

test('attemptBadges: Pearson, rushed, "5/50 · dừng sớm", retest, sources', () => {
  assert.deepEqual(attemptBadges({}), []);
  assert.deepEqual(
    attemptBadges({ stoppedEarly: true, total: 5, planned: 50 }).map((b) => b.text),
    ['⏹ 5/50 · dừng sớm'],
  );
  assert.deepEqual(attemptBadges({ stoppedEarly: true }).map((b) => b.text), ['⏹ dừng sớm']);
  assert.deepEqual(attemptBadges({ mode: 'retest', retestOf: 'x' }).map((b) => b.key), ['retest']);
  assert.deepEqual(
    (['anki', 'listen', 'micro', 'chat'] as const).map((source) => attemptBadges({ source })[0].text),
    ['🃏 Anki', '🎧 Nghe', '☕ nhanh', '💬 chat'],
  );
  assert.deepEqual(attemptBadges({ pearson: true, rushed: true, pilotTotal: 15 }).map((b) => b.cls), ['accent', 'warn']);
});

test('pair page: link, progress line', () => {
  assert.equal(pairHref('SNS', 'Step Functions'), '/pair?a=SNS&b=Step%20Functions');
  assert.equal(separationText(undefined).cls, 'dim');
  assert.equal(separationText({ answers: 12, correct: 11, last10: 90, separated: true }).cls, 'good');
  assert.match(separationText({ answers: 4, correct: 3, last10: 75, separated: false }).text, /cần ~6 câu nữa/);
  assert.equal(separationText({ answers: 14, correct: 9, last10: 60, separated: false }).cls, 'warn');
});

test('go / no-go badge, deadline, capacity rows', () => {
  assert.deepEqual(goNoGoBadge('go'), { cls: 'good', text: '✓ Giữ lịch thi' });
  assert.equal(goNoGoBadge('reschedule').cls, 'warn');
  assert.equal(goNoGoBadge('unknown').cls, '');
  assert.deepEqual([true, false, null].map(checkGlyph), ['✓', '✗', '?']);
  const now = new Date(2026, 10, 10, 9, 0);
  assert.equal(deadlineText(new Date(2026, 10, 14, 8, 30).toISOString(), now), '14/11 08:30 · còn 3 ngày');
  assert.equal(deadlineText(new Date(2026, 10, 10, 20, 0).toISOString(), now), '10/11 20:00 · còn 11 giờ');
  assert.equal(deadlineText(new Date(2026, 10, 9, 8, 0).toISOString(), now), '09/11 08:00 · đã qua');
  assert.equal(deadlineText(undefined, now), undefined);
  assert.deepEqual(
    capacityRows({ capacity: [{ minutesPerDay: 45, expected: 76.4, reviewsPerDay: 60 }, { minutesPerDay: 10, expected: 69, reviewsPerDay: 14 }] }, 45),
    [
      { minutes: 10, pct: 69, scaled: 690, reviewsPerDay: 14, goal: false },
      { minutes: 45, pct: 76.4, scaled: 764, reviewsPerDay: 60, goal: true },
    ],
  );
  assert.deepEqual(capacityRows({}), []);
});

test('numberAnswers / isGraded: relearn retries keep their question number, never count as questions', () => {
  const recs = [ans('a', false), ans('b', true), ans('c', true), ans('a', true, { relearn: true }), ans('d', false, { pick: '', t: 9, skipped: true }), ans('e', true, { scored: false }), ans('x', true, { relearn: true })];
  assert.deepEqual(numberAnswers(recs), [1, 2, 3, 1, 4, 5, 0], 'the retry of a shows 1 (not 3), first attempts 1..5');
  assert.deepEqual(recs.map(isGraded), [true, true, true, false, false, false, false]);
});
