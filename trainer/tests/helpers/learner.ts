// A deterministic simulated learner: builds a test through the API, answers it and submits with past timestamps.
import type { ApiClient } from './server.ts';
import type { AnswerInput, Attempt, BuildTestRequest, Question, TestSession } from '../../shared/types.ts';

const DAY = 86_400_000;

/** Park–Miller LCG: same seed → same answers on every machine. */
export function rng(seed = 7): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const ACC_BY_TOPIC: Record<string, number> = { database: 0.55, networking: 0.6, security: 0.8, compute: 0.75, storage: 0.7 };

export interface TakeOptions {
  daysAgo?: number; // finished N days ago
  acc?: number; // probability of a correct answer (default by topic)
  speed?: number; // multiplier of the question estimate (default 0.6–1.7 random)
  rand?: () => number;
  extra?: (q: Question, ok: boolean, i: number) => Partial<AnswerInput>; // v2 fields: elim, recall, hinted, why…
}

export interface Taken {
  session: TestSession;
  questions: Question[];
  answers: AnswerInput[];
  attempt: Attempt;
}

export async function buildTest(api: ApiClient, req: BuildTestRequest): Promise<{ session: TestSession; questions: Question[] }> {
  const r = await api.post<{ session: TestSession; questions: Question[]; error?: string }>('/api/tests', req);
  if (!r.ok) throw new Error(`POST /api/tests ${JSON.stringify(req)} → ${r.status} ${r.body?.error ?? ''}`);
  return r.body;
}

export function wrongKeys(q: Question): string[] {
  return q.options.map((o) => o.key).filter((k) => !q.answer.includes(k));
}

export async function takeTest(api: ApiClient, req: BuildTestRequest, opts: TakeOptions = {}): Promise<Taken> {
  const rand = opts.rand ?? rng();
  const { session, questions } = await buildTest(api, req);
  const finished = Date.now() - (opts.daysAgo ?? 0) * DAY;
  const answers = questions.map((q, i): AnswerInput => {
    const ok = rand() < (opts.acc ?? ACC_BY_TOPIC[q.topic] ?? 0.68);
    const wrongs = wrongKeys(q);
    const pick = ok ? q.answer : q.answer.length > 1 ? [q.answer[0], wrongs[0]] : [wrongs[Math.floor(rand() * wrongs.length)]];
    const t = Math.max(1, Math.round(q.time * (opts.speed ?? 0.6 + rand() * 1.1)));
    return { q: q.id, pick, t, ...(ok && rand() < 0.12 ? { unsure: true } : {}), ...(rand() < 0.05 ? { flag: true } : {}), ...opts.extra?.(q, ok, i) };
  });
  const timeUsed = answers.reduce((s, a) => s + a.t, 0);
  const r = await api.post<{ attempt: Attempt; error?: string }>('/api/results', {
    session,
    answers,
    startedAt: new Date(finished - timeUsed * 1000).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    timedOut: false,
    timeUsed,
  });
  if (!r.ok) throw new Error(`POST /api/results → ${r.status} ${r.body?.error ?? ''}`);
  return { session, questions, answers, attempt: r.body.attempt };
}

/** A small history (a week of practice) so dashboards, stats and SRS pools have content. */
export async function seedHistory(api: ApiClient): Promise<Attempt[]> {
  const rand = rng(11);
  const out: Attempt[] = [];
  out.push((await takeTest(api, { mode: 'topic', count: 15, filters: { topics: ['database'] } }, { daysAgo: 6, rand })).attempt);
  out.push((await takeTest(api, { mode: 'exam', timing: { preset: 'official' } }, { daysAgo: 4, rand })).attempt);
  out.push((await takeTest(api, { mode: 'retry-wrong', count: 10, feedback: 'practice' }, { daysAgo: 2, acc: 0.8, rand })).attempt);
  out.push((await takeTest(api, { mode: 'quick' }, { daysAgo: 1, rand })).attempt);
  return out;
}
