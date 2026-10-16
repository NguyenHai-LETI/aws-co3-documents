// The in-progress test lives in localStorage so a reload/closed tab can resume it.
// It is a per-browser convenience only — the result is written to results/*.md on submit.
import type { Question, TestSession } from '../../shared/types.ts';

export interface ActiveTest {
  session: TestSession;
  questions: Question[];
  answers: Record<string, string[]>;
  flags: Record<string, boolean>;
  unsure: Record<string, boolean>;
  revealed: Record<string, boolean>; // practice mode: answer checked
  spent: Record<string, number>; // seconds per question
  current: number;
  startedAt: number; // epoch ms
  pausedAt?: number; // epoch ms while paused
  pausedTotal: number; // ms
}

const KEY = 'trainer.activeTest.v1';

export function loadActive(): ActiveTest | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActiveTest) : undefined;
  } catch {
    return undefined;
  }
}

export function saveActive(t: ActiveTest): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // storage full / disabled — the test still works in memory
  }
}

export function clearActive(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function startActive(session: TestSession, questions: Question[]): ActiveTest {
  const t: ActiveTest = {
    session,
    questions,
    answers: {},
    flags: {},
    unsure: {},
    revealed: {},
    spent: {},
    current: 0,
    startedAt: Date.now(),
    pausedTotal: 0,
  };
  saveActive(t);
  return t;
}

/** Seconds elapsed excluding pauses. */
export function elapsedSeconds(t: ActiveTest, now = Date.now()): number {
  const pausedNow = t.pausedAt ? now - t.pausedAt : 0;
  return Math.max(0, (now - t.startedAt - t.pausedTotal - pausedNow) / 1000);
}

export function remainingSeconds(t: ActiveTest, now = Date.now()): number | undefined {
  if (!t.session.timeLimit) return undefined;
  return t.session.timeLimit - elapsedSeconds(t, now);
}
