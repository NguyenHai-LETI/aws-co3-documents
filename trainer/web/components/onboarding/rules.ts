// [β2] Pure rules of the v4 learning screens (no React, no fetch — unit-tested in tests/learning-ui.test.ts): when a
// score gets a pass/fail verdict, the diagnostic test (2 questions per exam-guide task, or 2 parts × 1 per task), the
// starting map per task, first vs repeat exposure on a result, the next exam-day checklist item.
import type { AnswerRecord, Attempt, AttemptSummary, BuildTestRequest, ChecklistItem, OnboardingTask, ResultAnnotations, TaskDef, TestSession } from '../../../shared/types.ts';

/** Fewer scored questions than this = a short practice test (no pass/fail verdict during the first week). */
export const SHORT_TEST = 30;
/** Days counted from the first study day (day 0) during which short practice tests get no verdict. */
export const FIRST_WEEK_DAYS = 7;
/** Diagnostic: 2 questions per exam-guide task 1.1–4.4 (14 tasks); split = 2 parts of 1 question per task. */
export const DIAGNOSTIC_FULL = 28;
export const DIAGNOSTIC_PART = 14;
export const DIAGNOSTIC_TITLE = 'Chẩn đoán đầu vào';

type AttemptLike = Pick<AttemptSummary, 'mode' | 'total' | 'finished'> & { pearson?: boolean; diagnostic?: boolean; sealedForm?: string };

export const isDiagnostic = (a: Pick<AttemptLike, 'mode' | 'diagnostic'>) => !!a.diagnostic || a.mode === 'diagnostic';
/** One half of a diagnostic split 2 × 14. */
export const isDiagnosticPart = (a: Pick<AttemptLike, 'mode' | 'diagnostic' | 'total'>) => isDiagnostic(a) && a.total <= DIAGNOSTIC_PART;
/** Scored like the real exam: full mock, Pearson simulation, sealed form. */
export const isExamLike = (a: Pick<AttemptLike, 'mode' | 'pearson' | 'sealedForm'>) => a.mode === 'exam' || a.mode === 'sealed' || !!a.pearson || !!a.sealedForm;

/** Local calendar day number of an ISO time or a YYYY-MM-DD key (no time-zone shift for keys). */
export function dayNumber(isoOrKey: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoOrKey);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
  const d = new Date(isoOrKey);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
}

/** Local date of `now` as YYYY-MM-DD. */
export function localKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Why a result shows no pass/fail verdict: the diagnostic is a starting point; short practice tests (not exam-like)
 * during the first 7 days of study are for getting used to the app. 'pending' = the study start is still loading
 * (undefined); null = nothing counted yet, i.e. this is the first day.
 */
export function noVerdict(a: AttemptLike, studyStart: string | undefined | null): 'diagnostic' | 'first-week' | 'pending' | undefined {
  if (isDiagnostic(a)) return 'diagnostic';
  if (isExamLike(a) || a.total >= SHORT_TEST) return undefined;
  if (studyStart === undefined) return 'pending';
  if (studyStart === null) return 'first-week';
  return dayNumber(a.finished) - dayNumber(studyStart) < FIRST_WEEK_DAYS ? 'first-week' : undefined;
}

/** Badge class for a score in result lists: neutral when the attempt gets no verdict. */
export function scoreTone(a: AttemptLike & { passed: boolean }, studyStart: string | undefined | null): 'good' | 'bad' | '' {
  return noVerdict(a, studyStart) ? '' : a.passed ? 'good' : 'bad';
}

// ── starting map: per exam-guide task ✓ / ~ / ✗ ─────────────────────────────

export type TaskStatus = OnboardingTask['status'];
export interface TaskCell {
  t: TaskDef;
  answers: number;
  correct: number;
  status: TaskStatus;
}

/** Never viewed: no pick and no time (not counted, same rule as the server). */
export const viewed = (r: Pick<AnswerRecord, 'pick' | 't'>) => !!r.pick || r.t > 0;

/** Scored, viewed answers per task (same statuses as POST /api/onboarding/plan). */
export function taskCells(rows: { r: AnswerRecord; q: { task?: string } | null }[], tasks: TaskDef[]): TaskCell[] {
  const by = new Map<string, { answers: number; correct: number }>();
  for (const { r, q } of rows) {
    if (!q?.task || r.scored === false || !viewed(r)) continue;
    const c = by.get(q.task) ?? { answers: 0, correct: 0 };
    c.answers++;
    if (r.ok) c.correct++;
    by.set(q.task, c);
  }
  return tasks.map((t) => {
    const c = by.get(t.id) ?? { answers: 0, correct: 0 };
    const status: TaskStatus = !c.answers ? 'untested' : c.correct === c.answers ? 'ok' : c.correct === 0 ? 'weak' : 'partial';
    return { t, ...c, status };
  });
}

/** Tasks to fix first: nothing right before partly right, heavier exam domains first. */
export function fixFirst(cells: TaskCell[], weightOf: (domain: string) => number, n = 5): TaskCell[] {
  return cells
    .filter((c) => c.status === 'weak' || c.status === 'partial')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'weak' ? -1 : 1) || weightOf(b.t.domain) - weightOf(a.t.domain))
    .slice(0, n);
}

// ── result: first vs repeat exposure ────────────────────────────────────────

/**
 * Scored answers seen before vs first time — the server's `fresh` only. It counts never-viewed answers as wrong (first
 * time unless answered earlier), which the exposure map alone cannot tell, and it is absent for a rushed attempt: no
 * split is shown then.
 */
export function freshSplit(_a: Pick<Attempt, 'answers'>, ann?: ResultAnnotations): ResultAnnotations['fresh'] {
  return ann?.fresh;
}

// ── sealed forms: one measurement each ──────────────────────────────────────

/**
 * The sealed form to confirm before a test starts ('' = the next sealed form), or undefined when no confirmation is due.
 * Without `session` (before building): a `sealed` request. With the built session: any other request that turned out to
 * be a sealed exam — an AI / onboarding plan session (mode coach) whose filter is a sealed form.
 */
export function sealedToConfirm(req: Pick<BuildTestRequest, 'mode' | 'form'>, session?: Pick<TestSession, 'sealedForm'>): string | undefined {
  if (!session) return req.mode === 'sealed' ? (req.form ?? '') : undefined;
  return req.mode !== 'sealed' && session.sealedForm ? session.sealedForm : undefined;
}

// ── exam-day checklist ──────────────────────────────────────────────────────

/** The next thing to do: overdue first, then the earliest due date, then undated items in server order. */
export function nextChecklistItem(items: ChecklistItem[] | undefined): ChecklistItem | undefined {
  const open = (items ?? []).filter((i) => !i.done);
  return [...open].sort((a, b) => Number(!!b.overdue) - Number(!!a.overdue) || (a.due ?? '9999').localeCompare(b.due ?? '9999'))[0];
}

/** "còn 5 ngày" / "hôm nay" / "quá hạn 2 ngày" for a YYYY-MM-DD due date. */
export function dueIn(due: string, now = new Date()): string {
  const n = dayNumber(due) - dayNumber(localKey(now));
  return n > 0 ? `còn ${n} ngày` : n === 0 ? 'hôm nay' : `quá hạn ${-n} ngày`;
}
