// [v5 γ1] The official SAA-C03 exam guide as data: bank/exam-guide/SAA-C03.yaml (domain → task → "Knowledge of" / "Skills in"
// bullets, transcribed verbatim with the source URLs + fetch date; in / out-of-scope service lists). Bullet ids by position:
// "<task>.k<n>" / "<task>.s<n>" (e.g. 3.5.s7).
//
// Question `skills`: a stored `skills:` (ENRICH classify) wins; otherwise bank.ts calls assignSkills() → guessSkills(), a
// conservative keyword heuristic over bank/exam-guide/SAA-C03-cues.yaml (ours, not official): only bullets of the question's
// own `task`; each cue regex is tested on the stem + correct option(s); a cue weighs ln((N+1)/(m+1)) where m of the task's N
// questions match it (clipped to [0.3, 3]: a word in almost every question of the task barely counts); bullets scoring
// ≥ GUESS.threshold are kept, best first, at most GUESS.maxPerQuestion (Question.skillsGuessed = true).
//
// Coverage (Quality → 🗺️ Đề cương, snapshot, γ2's longform / generate targets) over the practice pool (active, not sealed):
// per bullet questions / exam-like (longForm) / need (target 2 exam-like per bullet), per task exam-like vs
// quality.longform_target_per_task, multiple-response share vs 20–30 %, "Choose THREE" count, learner first answers.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { BANK_DIR, CONFIG_FILE, loadConfig, type AppConfig } from '../config.ts';
import { fileSig } from './index-db.ts';
import { sealedIds } from './sealed.ts';
import type { BankState } from './bank.ts';
import type { Attempt, DomainId, GuideBullet, GuideBulletCoverage, GuideCoverage, GuideTaskCoverage, Question } from '../../shared/types.ts';

export const GUIDE_DIR = path.join(BANK_DIR, 'exam-guide');
export const GUIDE_FILE = path.join(GUIDE_DIR, 'SAA-C03.yaml');
export const CUES_FILE = path.join(GUIDE_DIR, 'SAA-C03-cues.yaml');

export const GUESS = { threshold: 0.6, maxPerQuestion: 3, minWeight: 0.3, maxWeight: 3 };
export const COVERAGE_TARGET = { longFormPerBullet: 2, multi: [0.2, 0.3] as [number, number] };

export type ExamGuideBullet = GuideBullet;
export type BulletCoverage = GuideBulletCoverage;

export interface ExamGuide {
  exam: string; // "SAA-C03"
  title?: string;
  version?: string;
  fetched?: string; // YYYY-MM-DD
  sources: string[]; // URLs
  bullets: ExamGuideBullet[];
  tasks: { id: string; title: string; domain: DomainId }[];
  responseTypes: string[];
  inScope: Record<string, string[]>;
  outOfScope: Record<string, string[]>;
}

export interface TaskDeficit {
  task: string;
  longForm: number;
  target: number; // quality.longform_target_per_task
  need: number;
}

const EMPTY: ExamGuide = { exam: 'SAA-C03', sources: [], bullets: [], tasks: [], responseTypes: [], inScope: {}, outOfScope: {} };
const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));
const strList = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const lists = (v: unknown): Record<string, string[]> =>
  v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, strList(x)])) : {};

/** Pure parse of the guide YAML (unknown shapes → empty parts). */
export function parseExamGuide(text: string): ExamGuide {
  const d = (YAML.parse(text) ?? {}) as Record<string, unknown>;
  const bullets: ExamGuideBullet[] = [];
  const tasks: ExamGuide['tasks'] = [];
  for (const dom of Array.isArray(d.domains) ? (d.domains as Record<string, unknown>[]) : []) {
    for (const t of Array.isArray(dom?.tasks) ? (dom.tasks as Record<string, unknown>[]) : []) {
      const id = str(t?.id);
      if (!/^[1-4]\.[1-9]$/.test(id)) continue;
      tasks.push({ id, title: str(t.title), domain: str(dom.id) as DomainId });
      strList(t.knowledge).forEach((text, i) => bullets.push({ id: `${id}.k${i + 1}`, task: id, kind: 'knowledge', text }));
      strList(t.skills).forEach((text, i) => bullets.push({ id: `${id}.s${i + 1}`, task: id, kind: 'skill', text }));
    }
  }
  return {
    exam: str(d.exam) || 'SAA-C03',
    title: str(d.title) || undefined,
    version: str(d.version) || undefined,
    fetched: str(d.fetched) || undefined,
    sources: strList(d.sources),
    bullets,
    tasks,
    responseTypes: strList(d.response_types),
    inScope: lists(d.in_scope),
    outOfScope: lists(d.out_of_scope),
  };
}

let guideMemo: { sig: string; guide: ExamGuide } | undefined;

/** The exam guide (re-read when the file changes; missing or unreadable → empty). */
export function loadExamGuide(): ExamGuide {
  const sig = fileSig(GUIDE_FILE);
  if (guideMemo?.sig === sig) return guideMemo.guide;
  let guide = EMPTY;
  if (sig) {
    try {
      guide = parseExamGuide(fs.readFileSync(GUIDE_FILE, 'utf8'));
    } catch (e) {
      console.warn(`  ⚠️ ${GUIDE_FILE}: ${(e as Error).message}`);
    }
  }
  guideMemo = { sig, guide };
  return guide;
}

/** Signature of the guide + cue files: part of the bank version (a change re-guesses every question's skills). */
export function guideSig(): string {
  return `${fileSig(GUIDE_FILE)}|${fileSig(CUES_FILE)}`;
}

// ── keyword guess ───────────────────────────────────────────────────────────

export type Cues = Map<string, RegExp[]>; // bullet id → regexes

/** Pure parse of the cue YAML: `"<bullet id>": [regex, …]` (a bad regex is skipped). */
export function parseCues(text: string): Cues {
  const d = (YAML.parse(text) ?? {}) as Record<string, unknown>;
  const out: Cues = new Map();
  for (const [id, v] of Object.entries(d)) {
    const res: RegExp[] = [];
    for (const src of strList(v)) {
      try {
        res.push(new RegExp(src, 'i'));
      } catch {
        // a broken pattern is no cue
      }
    }
    out.set(id, res);
  }
  return out;
}

let cuesMemo: { sig: string; cues: Cues } | undefined;

export function loadCues(): Cues {
  const sig = fileSig(CUES_FILE);
  if (cuesMemo?.sig === sig) return cuesMemo.cues;
  let cues: Cues = new Map();
  if (sig) {
    try {
      cues = parseCues(fs.readFileSync(CUES_FILE, 'utf8'));
    } catch (e) {
      console.warn(`  ⚠️ ${CUES_FILE}: ${(e as Error).message}`);
    }
  }
  cuesMemo = { sig, cues };
  return cues;
}

type GuessInput = Pick<Question, 'id' | 'stem' | 'options' | 'answer' | 'task' | 'status'>;

const matchText = (q: GuessInput) => `${q.stem}\n${q.options.filter((o) => q.answer.includes(o.key)).map((o) => o.text).join('\n')}`;

/**
 * Keyword guess of the bullets each question covers (see the header). Pure: guide + cues in, id → bullet ids out (questions
 * without a task, retired ones, or with no bullet above the threshold get none).
 */
export function guessSkills(questions: readonly GuessInput[], guide: ExamGuide, cues: Cues): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const byTask = new Map<string, GuessInput[]>();
  for (const q of questions) {
    if (q.status === 'retired' || !q.task) continue;
    const l = byTask.get(q.task);
    if (l) l.push(q);
    else byTask.set(q.task, [q]);
  }
  for (const [task, qs] of byTask) {
    const bullets = guide.bullets.filter((b) => b.task === task && cues.get(b.id)?.length);
    if (!bullets.length) continue;
    const texts = qs.map(matchText);
    // per cue: which questions match it → IDF weight within the task
    const hits = bullets.map((b) => cues.get(b.id)!.map((re) => texts.map((t) => re.test(t))));
    const n = qs.length;
    const weight = (m: number) => Math.min(GUESS.maxWeight, Math.max(GUESS.minWeight, Math.log((n + 1) / (m + 1))));
    const weights = hits.map((perCue) => perCue.map((row) => weight(row.filter(Boolean).length)));
    qs.forEach((q, i) => {
      const scored: { id: string; score: number; order: number }[] = [];
      bullets.forEach((b, k) => {
        let s = 0;
        hits[k].forEach((row, c) => {
          if (row[i]) s += weights[k][c];
        });
        if (s >= GUESS.threshold) scored.push({ id: b.id, score: s, order: k });
      });
      if (!scored.length) return;
      scored.sort((x, y) => y.score - x.score || x.order - y.order);
      out.set(q.id, scored.slice(0, GUESS.maxPerQuestion).map((x) => x.id));
    });
  }
  return out;
}

/**
 * bank.ts: stored `skills:` win; every other question gets the keyword guess (skillsGuessed) or nothing. Mutates the
 * questions (computed fields). Returns stored ids the guide does not know (bank warnings).
 */
export function assignSkills(questions: Question[]): { unknown: { q: Question; id: string }[] } {
  const guide = loadExamGuide();
  const known = new Set(guide.bullets.map((b) => b.id));
  const unknown: { q: Question; id: string }[] = [];
  const open: Question[] = [];
  for (const q of questions) {
    if (q.skills?.length && !q.skillsGuessed) {
      if (known.size) for (const id of q.skills) if (!known.has(id)) unknown.push({ q, id });
      continue;
    }
    delete q.skills;
    delete q.skillsGuessed;
    open.push(q);
  }
  if (guide.bullets.length) {
    const byId = new Map(open.map((q) => [q.id, q]));
    for (const [id, skills] of guessSkills(open, guide, loadCues())) {
      const q = byId.get(id);
      if (!q) continue;
      q.skills = skills;
      q.skillsGuessed = true;
    }
  }
  return { unknown };
}

/** Bullets a question covers (stored or guessed — bank.ts fills `skills`). */
export function skillsOf(q: Pick<Question, 'skills'>): string[] {
  return q.skills ?? [];
}

// ── coverage ────────────────────────────────────────────────────────────────

let cfgMemo: { sig: string; cfg: AppConfig } | undefined;
function currentConfig(): AppConfig {
  const sig = fileSig(CONFIG_FILE);
  if (cfgMemo?.sig !== sig) cfgMemo = { sig, cfg: loadConfig() };
  return cfgMemo.cfg;
}

function practicePool(bank: Pick<BankState, 'questions'>, sealed: ReadonlySet<string> = sealedIds()): Question[] {
  return bank.questions.filter((q) => q.status === 'active' && !sealed.has(q.id));
}

/** First viewed, first-try answer per question (chronological, non-rushed): the learner's first-exposure accuracy. */
function firstAnswers(attempts: readonly Attempt[]): Map<string, boolean> {
  const out = new Map<string, boolean>();
  const ordered = attempts.filter((a) => !a.rushed).sort((a, b) => Date.parse(a.finished) - Date.parse(b.finished) || a.id.localeCompare(b.id));
  for (const a of ordered) {
    for (const r of a.answers) {
      if (out.has(r.q) || r.relearn || r.skipped || (!r.pick && !(r.t > 0))) continue;
      out.set(r.q, !!r.ok);
    }
  }
  return out;
}

/** Per-bullet coverage of the practice pool (guide order), with first-answer accuracy when `attempts` are given. */
export function bulletCoverage(bank: Pick<BankState, 'questions'>, attempts?: readonly Attempt[]): BulletCoverage[] {
  const guide = loadExamGuide();
  const pool = practicePool(bank);
  const first = attempts ? firstAnswers(attempts) : undefined;
  const by = new Map<string, Question[]>();
  for (const q of pool) {
    for (const s of skillsOf(q)) {
      const l = by.get(s);
      if (l) l.push(q);
      else by.set(s, [q]);
    }
  }
  return guide.bullets.map((b) => {
    const qs = by.get(b.id) ?? [];
    const longForm = qs.filter((q) => q.longForm).length;
    const row: BulletCoverage = { ...b, questions: qs.length, stored: qs.filter((q) => !q.skillsGuessed).length, longForm, need: Math.max(0, COVERAGE_TARGET.longFormPerBullet - longForm) };
    if (first) {
      const seen = qs.filter((q) => first.has(q.id));
      row.answers = seen.length;
      row.correct = seen.filter((q) => first.get(q.id)).length;
    }
    return row;
  });
}

/** Exam-like (long-form) questions missing per task, biggest gap first — γ2's longform / generate targets. */
export function taskDeficits(bank: Pick<BankState, 'questions'>, target = currentConfig().quality?.longform_target_per_task ?? 12): TaskDeficit[] {
  const guide = loadExamGuide();
  const pool = practicePool(bank);
  const ids = guide.tasks.length ? guide.tasks.map((t) => t.id) : [...new Set(pool.map((q) => q.task).filter((t): t is string => !!t))].sort();
  return ids
    .map((task) => {
      const longForm = pool.filter((q) => q.task === task && q.longForm).length;
      return { task, longForm, target, need: Math.max(0, target - longForm) };
    })
    .sort((a, b) => b.need - a.need || a.task.localeCompare(b.task, 'en', { numeric: true }));
}

const CHOOSE_THREE = /\((?:choose|select)\s+(?:three|3)\.?\)/i;

/** GET /api/exam-guide: the guide + coverage of the practice pool. */
export function guideCoverage(bank: Pick<BankState, 'questions'>, attempts?: readonly Attempt[]): GuideCoverage {
  const guide = loadExamGuide();
  const pool = practicePool(bank);
  const bullets = bulletCoverage(bank, attempts);
  const target = currentConfig().quality?.longform_target_per_task ?? 12;
  const tasks: GuideTaskCoverage[] = guide.tasks.map((t) => {
    const qs = pool.filter((q) => q.task === t.id);
    const longForm = qs.filter((q) => q.longForm).length;
    const own = bullets.filter((b) => b.task === t.id);
    return {
      id: t.id,
      title: t.title,
      domain: t.domain,
      questions: qs.length,
      longForm,
      target,
      need: Math.max(0, target - longForm),
      multi: qs.filter((q) => q.answer.length > 1).length,
      bullets: own.length,
      uncovered: own.filter((b) => !b.questions).length,
    };
  });
  const multi = pool.filter((q) => q.answer.length > 1).length;
  return {
    exam: guide.exam,
    title: guide.title ?? guide.exam,
    ...(guide.fetched ? { fetched: guide.fetched } : {}),
    sources: guide.sources,
    responseTypes: guide.responseTypes,
    bullets,
    tasks,
    total: pool.length,
    multi: { count: multi, share: pool.length ? Math.round((1000 * multi) / pool.length) / 1000 : 0, target: COVERAGE_TARGET.multi },
    chooseThree: pool.filter((q) => q.answer.length === 3 || CHOOSE_THREE.test(q.stem)).length,
    guessed: pool.filter((q) => q.skillsGuessed).length,
    untagged: pool.filter((q) => !q.skills?.length).length,
    inScope: guide.inScope,
    outOfScope: guide.outOfScope,
  };
}
