import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PLANS_DIR, rel } from '../config.ts';
import { asString, asStringList, splitFrontMatter } from './frontmatter.ts';
import { listMarkdownFiles } from './bank.ts';
import type { Attempt, BuildTestRequest, Difficulty, DomainId, FeedbackMode, Plan, PlanSession, TestMode } from '../../shared/types.ts';

const cache = new Map<string, { sig: string; plan?: Plan }>();

function toSession(raw: Record<string, unknown>, i: number): PlanSession {
  const filter = raw.filter && typeof raw.filter === 'object' ? (raw.filter as Record<string, unknown>) : undefined;
  return {
    id: asString(raw.id) ?? `s${i + 1}`,
    title: asString(raw.title) ?? `Phiên ${i + 1}`,
    why: asString(raw.why),
    feedback: raw.feedback === 'practice' ? 'practice' : raw.feedback === 'exam' ? 'exam' : undefined,
    timing: asString(raw.timing),
    questions: raw.questions ? asStringList(raw.questions) : undefined,
    filter: filter
      ? ({
          mode: (asString(filter.mode) ?? 'custom') as TestMode,
          count: filter.count ? Number(filter.count) : undefined,
          filters: {
            topics: filter.topics ? asStringList(filter.topics) : undefined,
            domains: filter.domains ? (asStringList(filter.domains) as DomainId[]) : undefined,
            tags: filter.tags ? asStringList(filter.tags) : undefined,
            services: filter.services ? asStringList(filter.services) : undefined,
            packs: filter.packs ? asStringList(filter.packs) : undefined,
            difficulties: filter.difficulties ? (asStringList(filter.difficulties) as Difficulty[]) : undefined,
          },
          feedback: (asString(filter.feedback) as FeedbackMode | undefined) ?? undefined,
          timing: raw.timing ? { preset: String(raw.timing) } : undefined,
        } as BuildTestRequest)
      : undefined,
  };
}

export function plansVersion(): string {
  const sig = listMarkdownFiles(PLANS_DIR)
    .map((f) => {
      const st = fs.statSync(f);
      return `${f}:${st.mtimeMs}:${st.size}`;
    })
    .join('|');
  return crypto.createHash('sha1').update(sig).digest('hex').slice(0, 12);
}

export function loadPlans(attempts: Attempt[] = []): Plan[] {
  const files = listMarkdownFiles(PLANS_DIR);
  const plans: Plan[] = [];
  for (const abs of files) {
    const st = fs.statSync(abs);
    const sig = `${st.mtimeMs}:${st.size}`;
    let e = cache.get(abs);
    if (!e || e.sig !== sig) {
      const fm = splitFrontMatter(fs.readFileSync(abs, 'utf8'));
      const d = fm.data;
      const sessions = Array.isArray(d.sessions) ? (d.sessions as Record<string, unknown>[]).filter((s) => s && typeof s === 'object').map(toSession) : [];
      e = {
        sig,
        plan: {
          id: asString(d.id) ?? path.basename(abs, '.md'),
          file: rel(abs),
          created: asString(d.created) ?? new Date(st.mtimeMs).toISOString(),
          trigger: asString(d.trigger),
          summary: asString(d.summary),
          newPacks: asStringList(d.new_packs),
          sessions,
          body: fm.body,
        },
      };
      cache.set(abs, e);
    }
    if (e.plan) plans.push(e.plan);
  }
  plans.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  // attach completion info (attempt.plan = "<planId>#<sessionId>")
  return plans.map((p) => ({
    ...p,
    sessions: p.sessions.map((s) => ({
      ...s,
      done: attempts
        .filter((a) => a.plan === `${p.id}#${s.id}`)
        .map((a) => ({ attemptId: a.id, score: a.score, finished: a.finished })),
    })),
  }));
}
