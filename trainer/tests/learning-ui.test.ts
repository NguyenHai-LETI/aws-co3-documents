// Unit tests for the pure rules behind the v4 learning screens (web/components/onboarding/rules.ts): no pass/fail verdict
// on the diagnostic and on short practice tests during the first week, diagnostic halves, the starting map per exam-guide
// task, "fix first" order, first vs repeat exposure on a result, the next exam-day checklist item. Run: npm test
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
  assert.deepEqual(freshSplit({ answers }, ann), { total: 4, seenBefore: 1, answers: 2, correct: 1 });
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
