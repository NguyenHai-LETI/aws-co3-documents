// [L] Exam goal, external practice-exam scores and the learning-progress payload (GET /api/progress).
// App-owned Markdown files next to the results (synced by git; loadAttempts skips them: `kind` is not `attempt`):
//   results/goal.md                         front matter: kind: goal, exam_date (YYYY-MM-DD), target_scaled, updated
//   results/external/<date>_<slug>.md       front matter: kind: external, date, source, score (%), scaled?, note?, created
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS_DIR, rel, type AppConfig } from '../config.ts';
import type { BankState } from './bank.ts';
import { asString, splitFrontMatter, stringifyFrontMatter } from './frontmatter.ts';
import { localIso } from './time.ts';
import { dayKey, dayOfKey, dayStartMs, localDay } from './fsrs.ts';
import { computeStates, readinessAt } from './stats.ts';
import { fsrsInfo, resolveFsrsParams } from './fsrs-optimize.ts';
import { calibrate, forecastExam, workloadDays } from './forecast.ts';
import { countRegraded } from './regrade.ts';
import { scaledScore } from '../../shared/scoring.ts';
import type { Attempt, ExamForecast, ExamGoal, ExternalScore, ProgressResponse, QuestionState } from '../../shared/types.ts';

export const GOAL_FILE = path.join(RESULTS_DIR, 'goal.md');
export const EXTERNAL_DIR = path.join(RESULTS_DIR, 'external');
/** An external score enters the calibration only when the app had this many answers before its date. */
export const MIN_CALIBRATION_ANSWERS = 20;
/** Workload horizon without an exam date (with one: today … exam day, at most WORKLOAD_MAX_DAYS). */
export const WORKLOAD_DAYS = 30;
export const WORKLOAD_MAX_DAYS = 60;
const SOURCE_MAX = 120;
const NOTE_MAX = 500;

/** Invalid input for a progress route (→ HTTP 400 / 404). */
export class ProgressError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const fileSig = (abs: string) => {
  try {
    const st = fs.statSync(abs);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return '';
  }
};

function writeAtomic(abs: string, text: string): void {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, abs);
}

/** YYYY-MM-DD string of a YAML value (plain scalars may arrive as Date with other YAML schemas). */
function dateValue(v: unknown): string | undefined {
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : asString(v)?.trim();
  return s && dayOfKey(s) !== undefined ? s : undefined;
}

function scaledValue(v: unknown): number | undefined {
  const n = Number(v);
  return v !== undefined && v !== null && v !== '' && Number.isFinite(n) && n >= 100 && n <= 1000 ? Math.round(n) : undefined;
}

// ── goal ────────────────────────────────────────────────────────────────────

let goalCache: { sig: string; goal: ExamGoal } | undefined;

export function loadGoal(): ExamGoal {
  const sig = fileSig(GOAL_FILE);
  if (goalCache?.sig === sig) return goalCache.goal;
  let goal: ExamGoal = {};
  if (sig) {
    const fm = splitFrontMatter(fs.readFileSync(GOAL_FILE, 'utf8'));
    if (!fm.error && fm.data.kind === 'goal') {
      const examDate = dateValue(fm.data.exam_date);
      const targetScaled = scaledValue(fm.data.target_scaled);
      if (examDate) goal.examDate = examDate;
      if (targetScaled !== undefined) goal.targetScaled = targetScaled;
    }
  }
  goalCache = { sig, goal };
  return goal;
}

/**
 * Updates the goal: a missing field keeps its value, null / '' clears it. Nothing left → the file is removed.
 * `examDate` YYYY-MM-DD, `targetScaled` 100–1000.
 */
export function saveGoal(input: { examDate?: unknown; targetScaled?: unknown }, passScaled: number): ExamGoal {
  const cur = loadGoal();
  const next: ExamGoal = { ...cur };
  if (input.examDate !== undefined) {
    if (input.examDate === null || input.examDate === '') delete next.examDate;
    else {
      const d = dateValue(input.examDate);
      if (!d) throw new ProgressError(400, 'Ngày thi không hợp lệ (định dạng YYYY-MM-DD).');
      next.examDate = d;
    }
  }
  if (input.targetScaled !== undefined) {
    if (input.targetScaled === null || input.targetScaled === '') delete next.targetScaled;
    else {
      const t = scaledValue(input.targetScaled);
      if (t === undefined) throw new ProgressError(400, 'Điểm mục tiêu phải từ 100 đến 1000.');
      next.targetScaled = t;
    }
  }
  if (!next.examDate && next.targetScaled === undefined) {
    fs.rmSync(GOAL_FILE, { force: true });
  } else {
    const data: Record<string, unknown> = { kind: 'goal', exam_date: next.examDate, target_scaled: next.targetScaled, updated: localIso() };
    for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
    const target = next.targetScaled ?? passScaled;
    const body = [
      '# 🎯 Mục tiêu thi',
      '',
      next.examDate ? `- Ngày thi: **${next.examDate}**` : '- Ngày thi: _(chưa đặt)_',
      `- Điểm mục tiêu: **${target}**/1000${next.targetScaled === undefined ? ' (mặc định = điểm đỗ)' : ''}`,
      '',
      '_File do app quản lý — sửa trong app: Thống kê → 🎯 Ngày thi & dự báo._',
      '',
    ].join('\n');
    writeAtomic(GOAL_FILE, stringifyFrontMatter(data) + '\n' + body);
  }
  goalCache = undefined;
  return loadGoal();
}

// ── external practice-exam scores ───────────────────────────────────────────

let extCache: { sig: string; scores: ExternalScore[] } | undefined;

function externalFiles(): string[] {
  try {
    return fs
      .readdirSync(EXTERNAL_DIR)
      .filter((f) => f.endsWith('.md') && !f.startsWith('.') && !f.startsWith('_'))
      .sort();
  } catch {
    return [];
  }
}

/** Stored external scores, newest first (readinessAtDate not filled in). */
export function loadExternal(): ExternalScore[] {
  const files = externalFiles();
  const sig = files.map((f) => `${f}:${fileSig(path.join(EXTERNAL_DIR, f))}`).join('|');
  if (extCache?.sig === sig) return extCache.scores;
  const scores: ExternalScore[] = [];
  for (const f of files) {
    const abs = path.join(EXTERNAL_DIR, f);
    const fm = splitFrontMatter(fs.readFileSync(abs, 'utf8'));
    if (fm.error || fm.data.kind !== 'external') continue;
    const date = dateValue(fm.data.date);
    const score = Number(fm.data.score);
    if (!date || !Number.isFinite(score)) continue;
    const s: ExternalScore = {
      id: f.slice(0, -3),
      date,
      source: asString(fm.data.source)?.trim() || 'Đề thi thử',
      score: round1(Math.min(100, Math.max(0, score))),
      file: rel(abs),
    };
    const scaled = scaledValue(fm.data.scaled);
    if (scaled !== undefined) s.scaled = scaled;
    const note = asString(fm.data.note)?.trim();
    if (note) s.note = note;
    scores.push(s);
  }
  scores.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  extCache = { sig, scores };
  return scores;
}

/** ASCII slug of a source name ("Tutorials Dojo – Set 2" → "tutorials-dojo-set-2"). */
export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '') || 'thi-thu'
  );
}

/**
 * Logs one external score. `score` = percent (0–100); with only `scaled` (100–1000) the percent is scaled / 10 — the
 * app's own rough mapping. `date` YYYY-MM-DD, not in the future.
 */
export function addExternal(input: { date?: unknown; source?: unknown; score?: unknown; scaled?: unknown; note?: unknown }, now = Date.now()): ExternalScore {
  const date = dateValue(input.date);
  if (!date) throw new ProgressError(400, 'Ngày làm bài không hợp lệ (định dạng YYYY-MM-DD).');
  if ((dayOfKey(date) ?? 0) > localDay(now)) throw new ProgressError(400, 'Ngày làm bài không được ở tương lai.');
  const source = String(input.source ?? '').replace(/\s+/g, ' ').trim().slice(0, SOURCE_MAX);
  if (!source) throw new ProgressError(400, 'Cần tên đề / nguồn (vd “AWS Official Practice Exam”).');
  const hasScore = input.score !== undefined && input.score !== null && input.score !== '';
  const scoreNum = Number(input.score);
  if (hasScore && !(Number.isFinite(scoreNum) && scoreNum >= 0 && scoreNum <= 100)) throw new ProgressError(400, 'Điểm % phải từ 0 đến 100.');
  const hasScaled = input.scaled !== undefined && input.scaled !== null && input.scaled !== '';
  const scaled = scaledValue(input.scaled);
  if (hasScaled && scaled === undefined) throw new ProgressError(400, 'Điểm quy đổi phải từ 100 đến 1000.');
  if (!hasScore && scaled === undefined) throw new ProgressError(400, 'Cần điểm % hoặc điểm quy đổi /1000.');
  const score = round1(hasScore ? scoreNum : (scaled ?? 0) / 10);
  const note = String(input.note ?? '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);

  const base = `${date}_${slugify(source)}`;
  let id = base;
  for (let i = 2; fs.existsSync(path.join(EXTERNAL_DIR, `${id}.md`)); i++) id = `${base}-${i}`;
  const abs = path.join(EXTERNAL_DIR, `${id}.md`);
  const data: Record<string, unknown> = { kind: 'external', date, source, score, scaled, note: note || undefined, created: localIso(new Date(now)) };
  for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
  const body = [
    `# 📝 Điểm thi thử bên ngoài — ${source}`,
    '',
    '| | |',
    '|---|---|',
    `| Ngày làm | ${date} |`,
    `| Điểm | **${score}%**${scaled !== undefined ? ` · ${scaled}/1000` : ` (≈ ${scaledScore(score)}/1000 theo quy đổi của app)`} |`,
    ...(note ? [`| Ghi chú | ${note.replace(/\|/g, '/')} |`] : []),
    '',
    '_File do app quản lý (Thống kê → 🎯 Ngày thi & dự báo). Mức sẵn sàng của app vào ngày này được so với điểm này để hiệu chỉnh._',
    '',
  ].join('\n');
  writeAtomic(abs, stringifyFrontMatter(data) + '\n' + body);
  extCache = undefined;
  return loadExternal().find((s) => s.id === id) ?? { id, date, source, score, scaled, note: note || undefined, file: rel(abs) };
}

export function deleteExternal(id: string): void {
  if (!/^[\w.-]+$/.test(id) || id.startsWith('.')) throw new ProgressError(400, 'Mã điểm không hợp lệ.');
  const abs = path.join(EXTERNAL_DIR, `${id}.md`);
  const fm = fs.existsSync(abs) ? splitFrontMatter(fs.readFileSync(abs, 'utf8')) : undefined;
  if (!fm || fm.data.kind !== 'external') throw new ProgressError(404, 'Không tìm thấy điểm này.');
  fs.rmSync(abs);
  extCache = undefined;
}

// ── GET /api/progress ───────────────────────────────────────────────────────

export interface ProgressCtx {
  cfg: AppConfig;
  bank: BankState;
  attempts: Attempt[]; // regraded (regradeAttempts), rushed ones flagged
  states: Map<string, QuestionState>;
}

type Heavy = Omit<ProgressResponse, 'fsrs'>;
const memo = new WeakMap<Attempt[], { key: string; value: Heavy }>();

/** Goal, forecast, workload, external scores + calibration (memoized per data version and day), FSRS info (fresh). */
export function computeProgress(ctx: ProgressCtx, now = Date.now()): ProgressResponse {
  const { cfg, bank, attempts } = ctx;
  const goal = loadGoal();
  const external = loadExternal();
  const today = localDay(now);
  const params = resolveFsrsParams(cfg);
  const key = JSON.stringify([bank.version, today, goal, external.map((e) => [e.id, e.date, e.score]), params.weights, cfg.srs, cfg.stats]);
  let heavy = memo.get(attempts);
  if (!heavy || heavy.key !== key) {
    heavy = { key, value: computeHeavy(ctx, goal, external, params.weights, now) };
    memo.set(attempts, heavy);
  }
  return { ...heavy.value, fsrs: fsrsInfo(cfg, attempts) };
}

function computeHeavy(ctx: ProgressCtx, goal: ExamGoal, stored: ExternalScore[], weights: readonly number[], now: number): Heavy {
  const { cfg, bank, attempts } = ctx;
  const today = localDay(now);
  // the forecast needs FSRS memory even when the review queue runs on Leitner boxes
  const fsrsStates = cfg.srs.algorithm === 'leitner' ? computeStates(attempts, { ...cfg, srs: { ...cfg.srs, algorithm: 'fsrs' } }, now, weights) : ctx.states;
  let forecast: ExamForecast | undefined;
  if (goal.examDate) forecast = forecastExam(fsrsStates, bank, attempts, goal.examDate, { weights, desiredRetention: cfg.srs.desired_retention, now });
  // until the exam (today … exam day), at most WORKLOAD_MAX_DAYS; no exam date or a past one → WORKLOAD_DAYS
  const days = forecast && forecast.daysLeft >= 0 ? Math.min(forecast.daysLeft + 1, WORKLOAD_MAX_DAYS) : WORKLOAD_DAYS;
  const workload = workloadDays(ctx.states, bank.questions, days, now);

  const external = stored.map((s) => {
    const day = dayOfKey(s.date);
    if (day === undefined) return s;
    const r = readinessAt(attempts, bank, cfg, dayStartMs(day + 1) - 1);
    return r.answers >= MIN_CALIBRATION_ANSWERS ? { ...s, readinessAtDate: r.readiness } : s;
  });
  const current = readinessAt(attempts, bank, cfg, now);
  return {
    today: dayKey(today),
    workload,
    goal: { examDate: goal.examDate, targetScaled: goal.targetScaled ?? bank.taxonomy.exam.pass_scaled },
    forecast,
    external,
    externalCalibration: current.answers ? calibrate(external, current.readiness) : undefined,
    regraded: countRegraded(attempts),
  };
}
