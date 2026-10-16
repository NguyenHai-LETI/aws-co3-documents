import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

/** trainer/ — where the code lives. */
export const TRAINER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Data root (bank, results, coach, inbox, config). Override with TRAINER_HOME (used by e2e tests). */
export const DATA_DIR = process.env.TRAINER_HOME ? path.resolve(process.env.TRAINER_HOME) : TRAINER_DIR;
/** Repo root (notes, practice-exams, git). Override with TRAINER_REPO. */
export const REPO_DIR = process.env.TRAINER_REPO ? path.resolve(process.env.TRAINER_REPO) : path.resolve(TRAINER_DIR, '..');

export const BANK_DIR = path.join(DATA_DIR, 'bank');
export const PACKS_DIR = path.join(BANK_DIR, 'packs');
export const TAXONOMY_FILE = path.join(BANK_DIR, 'taxonomy.yaml');
export const ISSUES_FILE = path.join(BANK_DIR, 'issues.md');
export const RATINGS_FILE = path.join(BANK_DIR, 'ratings.md');
export const MIGRATIONS_DIR = path.join(BANK_DIR, 'migrations');
export const RESULTS_DIR = path.join(DATA_DIR, 'results');
export const COACH_DIR = path.join(DATA_DIR, 'coach');
export const PLANS_DIR = path.join(COACH_DIR, 'plans');
export const RUNS_DIR = path.join(COACH_DIR, 'runs');
export const PATCHES_DIR = path.join(COACH_DIR, 'patches');
export const ENRICH_DIR = path.join(COACH_DIR, 'enrich');
export const QA_DIR = path.join(COACH_DIR, 'qa');
export const SNAPSHOT_FILE = path.join(COACH_DIR, 'snapshot.md');
export const PROFILE_FILE = path.join(COACH_DIR, 'learner-profile.md');
export const INBOX_DIR = path.join(DATA_DIR, 'inbox');
export const CONFIG_FILE = path.join(DATA_DIR, 'config.yaml');

export const HOST = '127.0.0.1';
export const PORT = Number(process.env.PORT ?? 3003);

/** Path relative to the data root with forward slashes (stable ids for files). */
export function rel(abs: string, base: string = DATA_DIR): string {
  return path.relative(base, abs).split(path.sep).join('/');
}

export interface AppConfig {
  coach: {
    model: string; // default model for every task ('' = Claude Code default)
    models: { analyze: string; generate: string; enrich: string; ask: string }; // per-task override ('' = use `model`)
    effort: string;
    max_budget_usd: number;
    skip_if_no_new_results: boolean;
    schedule: string[];
    claude_bin: string;
    use_api_key: boolean;
    hosts: string[]; // hostnames allowed to run SCHEDULED coach runs ([] = any machine)
    enrich_on_idle: boolean; // scheduled run without new data → run one ENRICH batch instead
    enrich_batch_size: number;
    max_runs_per_day: number; // safety cap for scheduled runs
  };
  srs: {
    algorithm: 'fsrs' | 'leitner';
    desired_retention: number; // FSRS target recall probability
    daily_limit: number; // max reviews offered per day
    mastered_stability_days: number; // FSRS stability ≥ this = mastered
    intervals_days: number[]; // Leitner only
    mastered_box: number; // Leitner only
  };
  practice: { default_count: number; quick_count: number; shuffle_options: boolean };
  stats: { rushed_median_seconds: number; recency_half_life_days: number };
  sync: { data_paths: string[] };
}

const DEFAULT_CONFIG: AppConfig = {
  coach: {
    model: '',
    models: { analyze: '', generate: '', enrich: '', ask: '' },
    effort: '',
    max_budget_usd: 0,
    skip_if_no_new_results: true,
    schedule: ['08:30', '12:30', '21:00'],
    claude_bin: '',
    use_api_key: false,
    hosts: [],
    enrich_on_idle: true,
    enrich_batch_size: 20,
    max_runs_per_day: 6,
  },
  srs: { algorithm: 'fsrs', desired_retention: 0.9, daily_limit: 50, mastered_stability_days: 21, intervals_days: [1, 3, 7, 14, 30], mastered_box: 4 },
  practice: { default_count: 20, quick_count: 10, shuffle_options: true },
  stats: { rushed_median_seconds: 5, recency_half_life_days: 14 },
  sync: { data_paths: ['trainer/results', 'trainer/coach', 'trainer/bank'] },
};

export function loadConfig(): AppConfig {
  let raw: Partial<AppConfig> = {};
  try {
    raw = (YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) ?? {}) as Partial<AppConfig>;
  } catch {
    // missing or invalid config → defaults
  }
  const coach = { ...DEFAULT_CONFIG.coach, ...(raw.coach ?? {}) };
  coach.models = { ...DEFAULT_CONFIG.coach.models, ...((raw.coach as Partial<AppConfig['coach']> | undefined)?.models ?? {}) };
  return {
    coach,
    srs: { ...DEFAULT_CONFIG.srs, ...(raw.srs ?? {}) },
    practice: { ...DEFAULT_CONFIG.practice, ...(raw.practice ?? {}) },
    stats: { ...DEFAULT_CONFIG.stats, ...(raw.stats ?? {}) },
    sync: { ...DEFAULT_CONFIG.sync, ...(raw.sync ?? {}) },
  };
}
