import type { AppConfig } from '../config.ts';
import type { BankState } from './bank.ts';
import { DAY_MS, localDateKey } from './time.ts';
import { pct, scaledScore } from '../../shared/scoring.ts';
import type { Attempt, Bucket, Question, QuestionState, StatsResponse } from '../../shared/types.ts';

/**
 * Leitner spaced repetition, recomputed from the full answer history (no database):
 *   wrong            → box 1 (review tomorrow)
 *   correct + unsure → stays (min box 1), streak reset
 *   correct          → first time: box 2, else box + 1 (max 5)
 *   due = last answer + intervals[box - 1] days
 */
export function computeStates(attempts: Attempt[], cfg: AppConfig): Map<string, QuestionState> {
  const states = new Map<string, QuestionState>();
  const timeSum = new Map<string, number>();
  for (const a of attempts) {
    for (const r of a.answers) {
      let s = states.get(r.q);
      if (!s) {
        s = { id: r.q, attempts: 0, correct: 0, everWrong: false, streak: 0, box: 0, avgTime: 0, slowCount: 0, wrongPicks: {} };
        states.set(r.q, s);
      }
      s.attempts++;
      timeSum.set(r.q, (timeSum.get(r.q) ?? 0) + r.t);
      if (r.est && r.t > r.est * 1.5) s.slowCount++;
      if (r.ok) {
        s.correct++;
        if (r.unsure) {
          s.box = Math.max(1, s.box);
          s.streak = 0;
        } else {
          s.box = s.box === 0 ? 2 : Math.min(5, s.box + 1);
          s.streak++;
        }
      } else {
        s.everWrong = true;
        s.box = 1;
        s.streak = 0;
        if (r.pick) s.wrongPicks[r.pick] = (s.wrongPicks[r.pick] ?? 0) + 1;
      }
      s.lastAt = a.finished;
      s.lastOk = r.ok;
      s.lastPick = r.pick;
      s.lastUnsure = !!r.unsure;
      s.lastFlag = !!r.flag;
    }
  }
  const intervals = cfg.srs.intervals_days;
  for (const s of states.values()) {
    s.avgTime = Math.round((timeSum.get(s.id) ?? 0) / Math.max(1, s.attempts));
    if (s.lastAt && s.box > 0) {
      const days = intervals[Math.min(s.box, intervals.length) - 1] ?? 1;
      s.dueAt = new Date(new Date(s.lastAt).getTime() + days * DAY_MS).toISOString();
    }
  }
  return states;
}

export function isDue(s: QuestionState | undefined, now = Date.now()): boolean {
  return !!s?.dueAt && new Date(s.dueAt).getTime() <= now;
}

export function isMastered(s: QuestionState | undefined, cfg: AppConfig): boolean {
  return !!s && s.box >= cfg.srs.mastered_box;
}

interface Acc {
  attempts: number;
  correct: number;
  qs: Set<string>;
  time: number;
  est: number;
}

function bucketize(
  map: Map<string, Acc>,
  bankCount: Map<string, number>,
  label: (k: string) => string,
): Bucket[] {
  const keys = new Set([...map.keys(), ...bankCount.keys()]);
  return [...keys].map((key) => {
    const a = map.get(key) ?? { attempts: 0, correct: 0, qs: new Set<string>(), time: 0, est: 0 };
    return {
      key,
      label: label(key),
      attempts: a.attempts,
      correct: a.correct,
      accuracy: pct(a.correct, a.attempts),
      questions: a.qs.size,
      bank: bankCount.get(key) ?? 0,
      avgTime: a.attempts ? Math.round(a.time / a.attempts) : 0,
      avgEst: a.attempts ? Math.round(a.est / a.attempts) : 0,
    };
  });
}

export function computeStats(attempts: Attempt[], bank: BankState, states: Map<string, QuestionState>, cfg: AppConfig): StatsResponse {
  const tax = bank.taxonomy;
  const active = bank.questions.filter((q) => q.status === 'active');
  const dims: Record<string, (q: Question) => string[]> = {
    domain: (q) => [q.domain],
    topic: (q) => [q.topic],
    difficulty: (q) => [q.difficulty],
    service: (q) => q.services,
    tag: (q) => q.tags,
  };
  const acc: Record<string, Map<string, Acc>> = {};
  const bankCount: Record<string, Map<string, number>> = {};
  for (const d of Object.keys(dims)) {
    acc[d] = new Map();
    bankCount[d] = new Map();
  }
  for (const q of active) for (const [d, f] of Object.entries(dims)) for (const k of f(q)) bankCount[d].set(k, (bankCount[d].get(k) ?? 0) + 1);

  let answers = 0;
  let correct = 0;
  let studySeconds = 0;
  const daily = new Map<string, { answers: number; correct: number; seconds: number }>();
  const recentCut = Date.now() - 30 * DAY_MS;
  const recentDomain = new Map<string, { t: number; c: number }>();
  for (const a of attempts) {
    const day = localDateKey(a.finished);
    const dd = daily.get(day) ?? { answers: 0, correct: 0, seconds: 0 };
    dd.seconds += a.timeUsed;
    studySeconds += a.timeUsed;
    const recent = new Date(a.finished).getTime() >= recentCut;
    for (const r of a.answers) {
      answers++;
      dd.answers++;
      if (r.ok) {
        correct++;
        dd.correct++;
      }
      const q = bank.byId.get(r.q);
      if (!q) continue;
      for (const [d, f] of Object.entries(dims)) {
        for (const k of f(q)) {
          const x = acc[d].get(k) ?? { attempts: 0, correct: 0, qs: new Set<string>(), time: 0, est: 0 };
          x.attempts++;
          if (r.ok) x.correct++;
          x.qs.add(r.q);
          x.time += r.t;
          x.est += r.est;
          acc[d].set(k, x);
        }
      }
      if (recent) {
        const g = recentDomain.get(q.domain) ?? { t: 0, c: 0 };
        g.t++;
        if (r.ok) g.c++;
        recentDomain.set(q.domain, g);
      }
    }
    daily.set(day, dd);
  }

  // readiness = exam-weighted accuracy over the last 30 days (falls back to all-time per domain)
  const byDomain = bucketize(acc.domain, bankCount.domain, (k) => {
    const d = tax.domains.find((x) => x.id === k);
    return d ? `${d.code} · ${d.label_vi}` : k;
  }).sort((a, b) => tax.domains.findIndex((d) => d.id === a.key) - tax.domains.findIndex((d) => d.id === b.key));
  let readiness = 0;
  let weightSeen = 0;
  let minSample = Infinity;
  for (const d of tax.domains) {
    const r = recentDomain.get(d.id);
    const all = acc.domain.get(d.id);
    const [t, c] = r && r.t >= 10 ? [r.t, r.c] : all ? [all.attempts, all.correct] : [0, 0];
    minSample = Math.min(minSample, t);
    if (t) {
      readiness += (d.weight * c) / t;
      weightSeen += d.weight;
    }
  }
  readiness = weightSeen ? Math.round((readiness / weightSeen) * 1000) / 10 : 0;
  const confidence = minSample >= 40 ? 'high' : minSample >= 15 ? 'medium' : 'low';

  // study streak: consecutive days with activity ending today or yesterday
  let streakDays = 0;
  const today = new Date();
  for (let i = 0; i < 400; i++) {
    const key = localDateKey(new Date(today.getTime() - i * DAY_MS));
    if (daily.has(key)) streakDays++;
    else if (i > 0) break;
  }

  const stateList = [...states.values()].filter((s) => bank.byId.get(s.id)?.status === 'active');
  const boxes = [0, 0, 0, 0, 0, 0];
  for (const q of active) boxes[states.get(q.id)?.box ?? 0]++;

  const topicLabel = (k: string) => {
    const t = tax.topics.find((x) => x.id === k);
    return t ? `${t.icon} ${t.label}` : k;
  };
  const diffLabel = (k: string) => tax.difficulties.find((x) => x.id === k)?.label ?? k;

  const mostMissed = stateList
    .filter((s) => s.attempts - s.correct > 0)
    .sort((a, b) => b.attempts - b.correct - (a.attempts - a.correct) || (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
    .slice(0, 15)
    .map((s) => {
      const q = bank.byId.get(s.id)!;
      return { id: s.id, wrong: s.attempts - s.correct, attempts: s.attempts, topic: q.topic, stem: q.stem.slice(0, 160) };
    });

  return {
    totals: {
      attempts: attempts.length,
      answers,
      correct,
      accuracy: pct(correct, answers),
      distinctSeen: stateList.length,
      bankActive: active.length,
      mastered: stateList.filter((s) => s.box >= cfg.srs.mastered_box).length,
      due: stateList.filter((s) => isDue(s)).length,
      wrongOpen: stateList.filter((s) => s.lastOk === false).length,
      flagged: stateList.filter((s) => s.lastFlag || s.lastUnsure).length,
      studySeconds,
      streakDays,
      readiness,
      readinessScaled: scaledScore(readiness),
      readinessConfidence: confidence,
    },
    byDomain,
    byTopic: bucketize(acc.topic, bankCount.topic, topicLabel).sort((a, b) => b.bank - a.bank),
    byDifficulty: bucketize(acc.difficulty, bankCount.difficulty, diffLabel),
    byService: bucketize(acc.service, bankCount.service, (k) => k).filter((b) => b.attempts > 0).sort((a, b) => b.attempts - a.attempts),
    byTag: bucketize(acc.tag, bankCount.tag, (k) => k).filter((b) => b.attempts > 0).sort((a, b) => b.attempts - a.attempts),
    boxes,
    trend: attempts.slice(-40).map((a) => ({ id: a.id, finished: a.finished, score: a.score, total: a.total, mode: a.mode, title: a.title })),
    daily: [...daily].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
    mostMissed,
  };
}
