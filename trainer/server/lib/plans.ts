// Coach plans (coach/plans/*.md): front matter `sessions` + the Markdown analysis. Each file is parsed once per version
// (memory → SQLite parse cache → YAML); the list is kept newest first and session completion (`done`) comes from an
// index of attempts by "<planId>#<sessionId>" (one pass over the attempts instead of one per session).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PLANS_DIR, rel } from '../config.ts';
import { asString, asStringList, splitFrontMatter } from './frontmatter.ts';
import { listMarkdownFiles } from './bank.ts';
import { ParseCache, statSig } from './index-db.ts';
import type { Attempt, BuildTestRequest, Difficulty, DomainId, FeedbackMode, Plan, PlanSession, PlanSummary, TestMode } from '../../shared/types.ts';

/** Bump when the stored parse of a plan file changes shape. */
const PLAN_PARSE_VERSION = 1;
const planParses = new ParseCache('plan', PLAN_PARSE_VERSION, (text) => {
  const fm = splitFrontMatter(text); // invalid YAML → a plan without sessions (id/created from the file), as before
  return { data: fm.data, body: fm.body };
});

const cache = new Map<string, { sig: string; plan: Plan }>();
let listMemo: { version: string; plans: Plan[] } | undefined;
let doneMemo: { list: Plan[]; attempts: Attempt[]; plans: Plan[] } | undefined;

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

function toPlan(d: Record<string, unknown>, body: string, abs: string, mtimeMs: number): Plan {
  const sessions = Array.isArray(d.sessions) ? (d.sessions as Record<string, unknown>[]).filter((s) => s && typeof s === 'object').map(toSession) : [];
  return {
    id: asString(d.id) ?? path.basename(abs, '.md'),
    file: rel(abs),
    created: asString(d.created) ?? new Date(mtimeMs).toISOString(),
    trigger: asString(d.trigger),
    summary: asString(d.summary),
    newPacks: asStringList(d.new_packs),
    sessions,
    body,
  };
}

/** One stat pass over coach/plans/: files, signatures (statSig) and the short version hash. */
function scanPlans(): { files: string[]; sigs: string[]; version: string } {
  const files = listMarkdownFiles(PLANS_DIR);
  const sigs = files.map((f) => {
    try {
      return statSig(fs.statSync(f));
    } catch {
      return '';
    }
  });
  const version = crypto.createHash('sha1').update(files.map((f, i) => `${f}:${sigs[i]}`).join('|')).digest('hex').slice(0, 12);
  return { files, sigs, version };
}

export function plansVersion(): string {
  return scanPlans().version;
}

/** Every plan, newest first, without completion info. The same array is returned while no plan file changed. */
export function loadPlanList(): Plan[] {
  const { files, sigs, version } = scanPlans();
  if (listMemo?.version === version) return listMemo.plans;
  planParses.prefetch(files.map((abs, i) => ({ abs, sig: sigs[i] })).filter((e) => e.sig && cache.get(e.abs)?.sig !== e.sig));
  const plans: Plan[] = [];
  files.forEach((abs, i) => {
    if (!sigs[i]) return;
    let e = cache.get(abs);
    if (!e || e.sig !== sigs[i]) {
      const p = planParses.get(abs, sigs[i]);
      e = { sig: sigs[i], plan: toPlan(p.data ?? {}, p.body ?? '', abs, Number(sigs[i].split(':')[0])) };
      cache.set(abs, e);
      planParses.forget(abs);
    }
    plans.push(e.plan);
  });
  const present = new Set(files);
  let removed = false;
  for (const abs of cache.keys()) {
    if (!present.has(abs)) {
      cache.delete(abs);
      removed = true;
    }
  }
  planParses.flush(removed ? present : undefined);
  plans.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  listMemo = { version, plans };
  return plans;
}

/** Plans newest first with `done` per session (attempt.plan = "<planId>#<sessionId>", oldest attempt first). */
export function loadPlans(attempts: Attempt[] = []): Plan[] {
  const list = loadPlanList();
  if (doneMemo?.list === list && doneMemo.attempts === attempts) return doneMemo.plans;
  const byRef = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (!a.plan) continue;
    const l = byRef.get(a.plan);
    if (l) l.push(a);
    else byRef.set(a.plan, [a]);
  }
  const plans = list.map((p) => ({
    ...p,
    sessions: p.sessions.map((s) => ({
      ...s,
      done: (byRef.get(`${p.id}#${s.id}`) ?? []).map((a) => ({ attemptId: a.id, score: a.score, finished: a.finished })),
    })),
  }));
  doneMemo = { list, attempts, plans };
  return plans;
}

/** A plan without its Markdown body (list views; the body comes from GET /api/plans/:id). */
export function planSummary(p: Plan): PlanSummary {
  const { body: _body, ...rest } = p;
  return rest;
}
