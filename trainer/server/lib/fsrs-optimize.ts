// [L] Personal FSRS-6 parameters fitted to the learner's own review history.
// - Training set: per question the chronological (grade, whole days since the previous answer) pairs from non-rushed
//   attempts; answers with no pick and t = 0 were never looked at (not real reviews) and are left out.
//   [v5 λ] Same rules as computeStates: skipped blanks of a stopped-early test are left out; a self-grade (`grade`:
//   listen, Anki) is the grade; answers from chat / micro breaks get no speed-based grade; relearning retries and retest
//   answers are same-day steps graded at most "good" (reviewGrade). A sibling's `for` credit is NOT a review of the
//   original here: the optimizer only sees answers to the question itself.
// - Optimizer: @open-spaced-repetition/binding (fsrs-rs, optional native package) in a CHILD PROCESS — never on a
//   request, and an invalid item makes the native code abort its whole process (Rust panic), which must not be the server.
// - Result: results/fsrs-params.json (synced by git with the results). One JSON object per line, newest line wins, so a
//   `merge=union` git attribute can keep both machines' lines instead of stopping the sync with a conflict.
// - Parameters in use: config srs.weights > personal (when they fit better than the defaults) > FSRS-6 defaults.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { RESULTS_DIR, type AppConfig } from '../config.ts';
import { FSRS_WEIGHTS, clampRetention, localDay, normalizeWeights, reviewGrade } from './fsrs.ts';
import { localIso } from './time.ts';
import type { Attempt, FsrsInfo } from '../../shared/types.ts';

export const PARAMS_FILE = path.join(RESULTS_DIR, 'fsrs-params.json');
const THIS_FILE = fileURLToPath(import.meta.url);
const CHILD_FLAG = '--fsrs-optimize-child';
const DAY_MS = 86_400_000;
const CHILD_TIMEOUT_MS = 10 * 60_000;
/** Auto mode: re-optimize at most this often, and only when the history grew by AUTO_GROWTH. */
export const AUTO_MIN_AGE_DAYS = 7;
export const AUTO_GROWTH = 1.2;

export interface FsrsMetrics {
  logLoss: number;
  rmse: number;
  defaultLogLoss: number;
  defaultRmse: number;
}

/** One optimization run as stored in results/fsrs-params.json. */
export interface FsrsParamsRecord {
  weights: number[];
  adopted: boolean; // personal parameters predict the history better (lower log loss) than the defaults → used
  optimizedAt: string;
  reviews: number; // real reviews in the training history
  items: number; // FSRS training items built from them
  metrics: FsrsMetrics;
  binding: string; // @open-spaced-repetition/binding version
  host?: string;
}

const round = (x: number, d = 6) => Math.round(x * 10 ** d) / 10 ** d;

// ── training set ────────────────────────────────────────────────────────────

export interface TrainingSet {
  cards: [number, number][][]; // per question: [grade 1–4, whole days since the previous review (0 for the first)]
  reviews: number;
  items: number; // reviews after the first one of a question that are ≥ 1 day later (= optimizer items)
  excluded: number; // answers left out: no pick and t = 0 (no self-grade), or [v5] skipped blanks
}

const trainingCache = new WeakMap<Attempt[], TrainingSet>();

/** Same chronological order as computeStates (finish time, then file order). */
export function trainingSet(attempts: Attempt[]): TrainingSet {
  const hit = trainingCache.get(attempts);
  if (hit) return hit;
  const ordered = attempts
    .filter((a) => !a.rushed)
    .map((a, i) => ({ a, i, at: Date.parse(a.finished) || 0 }))
    .sort((x, y) => x.at - y.at || x.i - y.i);
  const byQ = new Map<string, { last: number; seq: [number, number][] }>();
  let reviews = 0;
  let items = 0;
  let excluded = 0;
  for (const { a, at } of ordered) {
    const day = localDay(at);
    const timed = !a.source && a.mode !== 'retest';
    for (const r of a.answers) {
      if ((!r.pick && !r.t && !r.grade) || r.skipped) {
        excluded++;
        continue;
      }
      const prev = byQ.get(r.q);
      const delta = prev ? Math.max(0, day - prev.last) : 0;
      if (prev && delta > 0) items++;
      const entry = prev ?? { last: day, seq: [] };
      entry.seq.push([reviewGrade(r, { timed: timed && !r.relearn, cap: r.relearn || a.mode === 'retest' ? 3 : undefined }), delta]);
      entry.last = day;
      byQ.set(r.q, entry);
      reviews++;
    }
  }
  const set: TrainingSet = { cards: [...byQ.values()].map((e) => e.seq), reviews, items, excluded };
  trainingCache.set(attempts, set);
  return set;
}

// ── params file ─────────────────────────────────────────────────────────────

function validRecord(x: unknown): x is FsrsParamsRecord {
  const r = x as FsrsParamsRecord;
  return !!r && typeof r === 'object' && Array.isArray(r.weights) && !!normalizeWeights(r.weights) && typeof r.optimizedAt === 'string' && Number.isFinite(Date.parse(r.optimizedAt));
}

let fileCache: { sig: string; record?: FsrsParamsRecord } | undefined;

/** Newest valid record of results/fsrs-params.json (several lines can exist after a union merge). */
export function loadParamsRecord(file = PARAMS_FILE): FsrsParamsRecord | undefined {
  let sig = '';
  try {
    const st = fs.statSync(file);
    sig = `${file}:${st.mtimeMs}:${st.size}`;
  } catch {
    return undefined;
  }
  if (fileCache?.sig === sig) return fileCache.record;
  let record: FsrsParamsRecord | undefined;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as unknown;
      if (validRecord(r) && (!record || Date.parse(r.optimizedAt) > Date.parse(record.optimizedAt))) record = r;
    } catch {
      // half-merged or hand-edited line — ignore it
    }
  }
  fileCache = { sig, record };
  return record;
}

export function saveParamsRecord(record: FsrsParamsRecord, file = PARAMS_FILE): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(record) + '\n');
  fs.renameSync(tmp, file);
  fileCache = undefined;
}

// ── parameters in use ───────────────────────────────────────────────────────

export interface ResolvedParams {
  weights: readonly number[];
  source: 'default' | 'personal' | 'config';
  record?: FsrsParamsRecord;
  note?: string;
}

let configCache: { raw: string; weights?: number[] } | undefined;
function configWeights(raw: unknown): number[] | undefined {
  const key = JSON.stringify(raw ?? null);
  if (configCache?.raw !== key) configCache = { raw: key, weights: normalizeWeights(raw) };
  return configCache.weights;
}

/** config srs.weights > personal (optimize ≠ off and adopted) > FSRS-6 defaults. Cheap: the file is cached by mtime. */
export function resolveFsrsParams(cfg: AppConfig): ResolvedParams {
  const record = loadParamsRecord();
  let note: string | undefined;
  const raw = cfg.srs.weights;
  if (Array.isArray(raw) && raw.length) {
    const w = configWeights(raw);
    if (w) return { weights: w, source: 'config', record };
    note = `srs.weights trong config.yaml không hợp lệ (cần 21 số của FSRS-6, có ${raw.length}) — đang dùng tham số khác.`;
  }
  if (cfg.srs.optimize !== 'off' && record?.adopted) {
    const w = normalizeWeights(record.weights);
    if (w) return { weights: w, source: 'personal', record, note };
  }
  if (record && !record.adopted && cfg.srs.optimize !== 'off') {
    note ??= 'Lần tối ưu gần nhất không dự đoán tốt hơn tham số mặc định — vẫn dùng mặc định.';
  }
  return { weights: FSRS_WEIGHTS, source: 'default', record, note };
}

// ── optimizer availability (optional native package) ───────────────────────

let probe: { available: boolean; version?: string; error?: string } | undefined;

/** Loads the binding's JS wrapper + native addon once (no computation in this process). TRAINER_NO_FSRS_OPTIMIZER=1 → off. */
export function optimizerAvailable(): { available: boolean; version?: string; error?: string } {
  if (process.env.TRAINER_NO_FSRS_OPTIMIZER === '1') return { available: false, error: 'TRAINER_NO_FSRS_OPTIMIZER=1' };
  if (probe) return probe;
  try {
    const req = createRequire(import.meta.url);
    const mod = req('@open-spaced-repetition/binding') as { computeParameters?: unknown };
    if (typeof mod.computeParameters !== 'function') throw new Error('computeParameters missing');
    probe = { available: true, version: bindingVersion(req.resolve('@open-spaced-repetition/binding')) };
  } catch (e) {
    probe = { available: false, error: (e as Error).message.split('\n')[0] };
  }
  return probe;
}

function bindingVersion(entry: string): string | undefined {
  for (let dir = path.dirname(entry); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const pj = path.join(dir, 'package.json');
    if (!fs.existsSync(pj)) continue;
    try {
      const p = JSON.parse(fs.readFileSync(pj, 'utf8')) as { name?: string; version?: string };
      if (p.name === '@open-spaced-repetition/binding') return p.version;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// ── running the optimizer ───────────────────────────────────────────────────

interface ChildOutput {
  weights?: number[];
  metrics?: FsrsMetrics;
  items?: number;
  binding?: string;
  notEnoughData?: boolean; // fsrs-rs NotEnoughData (too few / too uniform reviews) — not an error
  error?: string;
}

export type OptimizeOutcome = 'adopted' | 'kept-default' | 'not-enough-data' | 'error';
export const NOT_ENOUGH_DATA_NOTE =
  'Chưa đủ dữ liệu để tối ưu: bộ tối ưu cần thêm lượt ôn cách nhau ≥ 1 ngày (cả lượt ôn lại lần đầu lẫn các lần sau). Lịch ôn vẫn dùng tham số hiện tại.';

let running: Promise<FsrsParamsRecord | undefined> | undefined;
let lastError: string | undefined;
let lastOutcome: OptimizeOutcome | undefined;
let lastAutoAttempt = 0;

export function optimizerState(): { running: boolean; lastError?: string; lastOutcome?: OptimizeOutcome } {
  return { running: !!running, lastError, lastOutcome };
}

export class OptimizeError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Why an optimization cannot start now (undefined = it can). */
export function optimizeBlocker(cfg: AppConfig, set: TrainingSet): string | undefined {
  if (cfg.srs.algorithm === 'leitner') return 'srs.algorithm = leitner — FSRS không được dùng.';
  if (cfg.srs.optimize === 'off') return 'srs.optimize = off trong config.yaml.';
  const opt = optimizerAvailable();
  if (!opt.available) return `Chưa cài được bộ tối ưu FSRS (@open-spaced-repetition/binding): ${opt.error ?? 'không tải được'}.`;
  if (set.reviews < cfg.srs.optimize_min_reviews) return `Cần ít nhất ${cfg.srs.optimize_min_reviews} lượt ôn (hiện có ${set.reviews}).`;
  if (!set.items) return 'Chưa có lượt ôn nào cách lần trước ≥ 1 ngày.';
  return undefined;
}

/**
 * Starts (or joins) a background optimization: the training set goes to a child process, the result is written to
 * results/fsrs-params.json. The promise settles when the child is done (undefined = not enough data, nothing written);
 * callers on a request path must not await it.
 */
export function startOptimize(attempts: Attempt[], cfg: AppConfig): Promise<FsrsParamsRecord | undefined> {
  if (running) return running;
  const set = trainingSet(attempts);
  const blocked = optimizeBlocker(cfg, set);
  if (blocked) return Promise.reject(new OptimizeError(409, blocked));
  lastError = undefined;
  lastOutcome = undefined;
  const p = runChild({ cards: set.cards, defaults: [...FSRS_WEIGHTS] })
    .then((out) => {
      if (out.notEnoughData) {
        lastOutcome = 'not-enough-data';
        return undefined;
      }
      if (!out.weights || !out.metrics) throw new Error(out.error ?? 'Bộ tối ưu không trả về tham số.');
      const weights = normalizeWeights(out.weights);
      if (!weights) throw new Error('Bộ tối ưu trả về tham số không hợp lệ.');
      const m = out.metrics;
      const record: FsrsParamsRecord = {
        weights: weights.map((x) => round(x)),
        adopted: m.logLoss < m.defaultLogLoss,
        optimizedAt: localIso(new Date()),
        reviews: set.reviews,
        items: out.items ?? set.items,
        metrics: { logLoss: round(m.logLoss), rmse: round(m.rmse), defaultLogLoss: round(m.defaultLogLoss), defaultRmse: round(m.defaultRmse) },
        binding: out.binding ?? optimizerAvailable().version ?? '',
        host: os.hostname(),
      };
      saveParamsRecord(record);
      lastOutcome = record.adopted ? 'adopted' : 'kept-default';
      refreshSnapshot();
      return record;
    })
    .catch((e: Error) => {
      lastError = e.message;
      lastOutcome = 'error';
      throw e;
    })
    .finally(() => {
      running = undefined;
    });
  running = p;
  p.catch(() => undefined); // the caller may not listen (auto mode)
  return p;
}

/**
 * New parameters change memory levels and due dates → coach/snapshot.md must be rebuilt (debounced, off the request
 * path). Imported lazily: snapshot.ts → context.ts → stats.ts → this module would be an import cycle, and the optimizer
 * child process must not load the whole server.
 */
function refreshSnapshot(): void {
  import('./snapshot.ts')
    .then((m) => m.scheduleSnapshot())
    .catch((e: Error) => console.error(`snapshot after FSRS optimization: ${e.message}`));
}

/** Auto mode: re-optimize in the background at most weekly and only when the history grew ≥ 20 %. Never throws. */
export function autoOptimizeDue(cfg: AppConfig, set: TrainingSet, record: FsrsParamsRecord | undefined, now = Date.now()): boolean {
  if (cfg.srs.optimize !== 'auto' || running) return false;
  if (configWeights(cfg.srs.weights)) return false; // hand-set parameters win anyway
  if (optimizeBlocker(cfg, set)) return false;
  if (now - lastAutoAttempt < DAY_MS) return false; // one try per day and process (e.g. after a failure)
  if (!record) return true;
  return now - Date.parse(record.optimizedAt) >= AUTO_MIN_AGE_DAYS * DAY_MS && set.reviews >= AUTO_GROWTH * record.reviews;
}

export function maybeAutoOptimize(attempts: Attempt[], cfg: AppConfig, now = Date.now()): boolean {
  try {
    const set = trainingSet(attempts);
    if (!autoOptimizeDue(cfg, set, loadParamsRecord(), now)) return false;
    lastAutoAttempt = now;
    startOptimize(attempts, cfg).catch((e: Error) => console.error(`FSRS auto-optimize failed: ${e.message}`));
    return true;
  } catch (e) {
    console.error('FSRS auto-optimize check failed', e);
    return false;
  }
}

function runChild(input: { cards: [number, number][][]; defaults: number[] }): Promise<ChildOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [THIS_FILE, CHILD_FLAG], { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), CHILD_TIMEOUT_MS);
    child.stdout.on('data', (b: Buffer) => (out += b.toString()));
    child.stderr.on('data', (b: Buffer) => (err = (err + b.toString()).slice(-4000)));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const last = out.trim().split('\n').pop() ?? '';
      try {
        const parsed = JSON.parse(last) as ChildOutput;
        if (code === 0) return resolve(parsed);
        if (parsed.error) return reject(new Error(parsed.error));
      } catch {
        // no JSON line (crash) — report the exit status and stderr
      }
      const why = err.split('\n').find((l) => /panicked|Error|error/.test(l))?.trim();
      reject(new Error(`Bộ tối ưu dừng bất thường (${signal ?? `mã ${code}`})${why ? `: ${why.slice(0, 300)}` : ''}`));
    });
    child.stdin.on('error', () => undefined); // child died before reading everything
    child.stdin.end(JSON.stringify(input));
  });
}

// ── FsrsInfo for the UI ─────────────────────────────────────────────────────

export function fsrsInfo(cfg: AppConfig, attempts: Attempt[]): FsrsInfo {
  const p = resolveFsrsParams(cfg);
  const set = trainingSet(attempts);
  const opt = optimizerAvailable();
  const st = optimizerState();
  const rec = p.record;
  return {
    version: cfg.srs.algorithm === 'leitner' ? 'leitner' : 'fsrs-6',
    params: p.source,
    weights: p.weights.map((x) => round(x, 4)),
    desiredRetention: clampRetention(cfg.srs.desired_retention),
    optimizedAt: rec?.optimizedAt,
    reviews: rec?.reviews,
    minReviews: cfg.srs.optimize_min_reviews,
    metrics: rec?.metrics,
    optimizer: opt.available ? 'available' : 'unavailable',
    mode: cfg.srs.optimize,
    historyReviews: set.reviews,
    trainingItems: set.items,
    adopted: rec?.adopted,
    running: st.running,
    lastError: st.lastError,
    lastOutcome: st.lastOutcome,
    blocked: optimizeBlocker(cfg, set),
    note: st.lastOutcome === 'not-enough-data' ? NOT_ENOUGH_DATA_NOTE : p.note,
    binding: rec?.binding ?? opt.version,
  };
}

// ── child process: node server/lib/fsrs-optimize.ts --fsrs-optimize-child < input.json ──

async function childMain(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { cards: [number, number][][]; defaults: number[] };
  const b = await import('@open-spaced-repetition/binding');
  const items: InstanceType<typeof b.FSRSBindingItem>[] = [];
  for (const card of input.cards) {
    const reviews = card.map(([g, d], i) => new b.FSRSBindingReview(Math.min(4, Math.max(1, Math.round(g))), i === 0 ? 0 : Math.max(0, Math.round(d))));
    // like Anki: one item per review after the first that is ≥ 1 day later, holding every review up to it
    for (let k = 1; k < reviews.length; k++) if (reviews[k].deltaT > 0) items.push(new b.FSRSBindingItem(reviews.slice(0, k + 1)));
  }
  const notEnough = (e: unknown) => /NotEnoughData/i.test(String((e as Error)?.message ?? e));
  let weights: number[];
  let mine: { logLoss: number; rmseBins: number };
  let base: { logLoss: number; rmseBins: number };
  try {
    if (!items.length) throw new Error('NotEnoughData');
    weights = await b.computeParameters(items, { enableShortTerm: true, numRelearningSteps: 1 });
    mine = new b.FSRSBinding(weights).evaluate(items);
    base = new b.FSRSBinding(input.defaults).evaluate(items);
  } catch (e) {
    if (!notEnough(e)) throw e;
    process.stdout.write(JSON.stringify({ notEnoughData: true, items: items.length } satisfies ChildOutput) + '\n');
    return;
  }
  const out: ChildOutput = {
    weights,
    items: items.length,
    metrics: { logLoss: mine.logLoss, rmse: mine.rmseBins, defaultLogLoss: base.logLoss, defaultRmse: base.rmseBins },
    binding: bindingVersion(createRequire(import.meta.url).resolve('@open-spaced-repetition/binding')),
  };
  process.stdout.write(JSON.stringify(out) + '\n');
}

if (process.argv.includes(CHILD_FLAG) && process.argv[1] && path.resolve(process.argv[1]) === THIS_FILE) {
  childMain().then(
    () => process.exit(0),
    (e: Error) => {
      process.stdout.write(JSON.stringify({ error: e.message } satisfies ChildOutput) + '\n');
      process.exit(1);
    },
  );
}
