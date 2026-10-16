// Per-request snapshot of everything derived from disk (owned by the learning engine).
// `attempts` includes rushed attempts (flagged `rushed`); states/stats ignore them.
import { loadConfig } from './config.ts';
import { loadBank } from './lib/bank.ts';
import { loadAttempts } from './lib/results.ts';
import { computeStates } from './lib/stats.ts';
import { loadPlans } from './lib/plans.ts';

export function context() {
  const cfg = loadConfig();
  const bank = loadBank();
  const attempts = loadAttempts(cfg);
  const states = computeStates(attempts, cfg);
  const plans = loadPlans(attempts);
  return { cfg, bank, attempts, states, plans };
}

export type Ctx = ReturnType<typeof context>;
