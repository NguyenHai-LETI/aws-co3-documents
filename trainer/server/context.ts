// Per-request snapshot of everything derived from disk (owned by the learning engine), memoized by data versions:
// requests between two data changes share one object (states and plans are computed once, not per request).
// Key = dataVersions(): bank, results (same loadAttempts() array), plans, the personal FSRS parameter file, config.yaml
// and the local day (retrievability / due dates move with the calendar).
// `attempts` includes rushed attempts (flagged `rushed`); states/stats ignore them.
import path from 'node:path';
import { CONFIG_FILE, RESULTS_DIR, loadConfig, type AppConfig } from './config.ts';
import { loadBank, type BankState } from './lib/bank.ts';
import { attemptsVersion, loadAttempts, loadedAttemptsVersion } from './lib/results.ts';
import { regradeAttempts } from './lib/regrade.ts';
import { computeStates, computeStats } from './lib/stats.ts';
import { loadPlans, plansVersion } from './lib/plans.ts';
import { fileSig } from './lib/index-db.ts';
import { localDateKey } from './lib/time.ts';
import type { Attempt, DataVersions, Plan, QuestionState, StatsResponse } from '../shared/types.ts';

/** Personal FSRS parameters ([L] optimizer output) — a change must recompute the memory states. */
export const FSRS_PARAMS_FILE = path.join(RESULTS_DIR, 'fsrs-params.json');

export interface Ctx {
  cfg: AppConfig;
  bank: BankState;
  attempts: Attempt[];
  states: Map<string, QuestionState>;
  plans: Plan[];
  planById: Map<string, Plan>; // first (= newest) plan per id, like the list and buildTest
  /** The dataVersions() this context was computed from (SSE `data`, /api/meta, /api/state). */
  versions: DataVersions;
  /** Identifies this data state (stable while nothing changed) — key for caches of derived responses. */
  key: string;
}

const sig = (file: string) => fileSig(file) || '-';

let cfgMemo: { sig: string; cfg: AppConfig } | undefined;
/** config.yaml, parsed again only when the file changed (edits still apply without a restart). */
export function currentConfig(): AppConfig {
  const s = sig(CONFIG_FILE);
  if (cfgMemo?.sig !== s) cfgMemo = { sig: s, cfg: loadConfig() };
  return cfgMemo.cfg;
}

/**
 * Versions of everything the pages show: bank, results, plans, the FSRS parameter file, config.yaml and the local day.
 * The SSE poller (server/index.ts) pushes them; a change of anything but the bank / plans makes states and counts stale.
 */
export function dataVersions(): DataVersions {
  return { bank: loadBank().version, results: attemptsVersion(), plans: plansVersion(), params: sig(FSRS_PARAMS_FILE), config: sig(CONFIG_FILE), day: localDateKey(new Date()) };
}

let memo: { cfg: AppConfig; bank: BankState; raw: Attempt[]; key: string; ctx: Ctx } | undefined;
let generation = 0;

export function context(): Ctx {
  const cfg = currentConfig();
  const bank = loadBank();
  const raw = loadAttempts(cfg); // same array while no result file changed
  // same fields and formats as dataVersions(), without a second scan of results/
  const versions: DataVersions = { bank: bank.version, results: loadedAttemptsVersion(), plans: plansVersion(), params: sig(FSRS_PARAMS_FILE), config: cfgMemo?.sig ?? sig(CONFIG_FILE), day: localDateKey(new Date()) };
  const key = JSON.stringify(versions);
  if (memo && memo.cfg === cfg && memo.bank === bank && memo.raw === raw && memo.key === key) return memo.ctx;
  const attempts = regradeAttempts(raw, bank, cfg); // regraded against fixed keys + unviewed/exposure/recognized annotations
  const states = computeStates(attempts, cfg);
  const plans = loadPlans(attempts);
  const planById = new Map<string, Plan>();
  for (const p of plans) if (!planById.has(p.id)) planById.set(p.id, p); // duplicate ids: the newest wins, as in the list
  const ctx: Ctx = { cfg, bank, attempts, states, plans, planById, versions, key: `${bank.version}.${versions.plans}.${++generation}` };
  memo = { cfg, bank, raw, key, ctx };
  return ctx;
}

const STATS_REFRESH_MS = 5 * 60_000;
let statsMemo: { key: string; value: StatsResponse } | undefined;
/**
 * GET /api/stats and the coach snapshot share one computeStats() per data state, recomputed at least every 5 minutes
 * (due counts move with the clock even when no file changes).
 */
export function contextStats(ctx: Ctx = context()): StatsResponse {
  const key = `${ctx.key}@${Math.floor(Date.now() / STATS_REFRESH_MS)}`;
  if (statsMemo?.key !== key) statsMemo = { key, value: computeStats(ctx.attempts, ctx.bank, ctx.states, ctx.cfg) };
  return statsMemo.value;
}
