import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

export const TRAINER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_DIR = path.resolve(TRAINER_DIR, '..');

export const BANK_DIR = path.join(TRAINER_DIR, 'bank');
export const PACKS_DIR = path.join(BANK_DIR, 'packs');
export const TAXONOMY_FILE = path.join(BANK_DIR, 'taxonomy.yaml');
export const ISSUES_FILE = path.join(BANK_DIR, 'issues.md');
export const RESULTS_DIR = path.join(TRAINER_DIR, 'results');
export const COACH_DIR = path.join(TRAINER_DIR, 'coach');
export const PLANS_DIR = path.join(COACH_DIR, 'plans');
export const RUNS_DIR = path.join(COACH_DIR, 'runs');
export const SNAPSHOT_FILE = path.join(COACH_DIR, 'snapshot.md');
export const PROFILE_FILE = path.join(COACH_DIR, 'learner-profile.md');
export const INBOX_DIR = path.join(TRAINER_DIR, 'inbox');
export const CONFIG_FILE = path.join(TRAINER_DIR, 'config.yaml');

export const HOST = '127.0.0.1';
export const PORT = Number(process.env.PORT ?? 3003);

/** Path relative to trainer/ with forward slashes (stable ids for files). */
export function rel(abs: string, base: string = TRAINER_DIR): string {
  return path.relative(base, abs).split(path.sep).join('/');
}

export interface AppConfig {
  coach: {
    model: string;
    effort: string;
    max_budget_usd: number;
    skip_if_no_new_results: boolean;
    schedule: string[];
    claude_bin: string;
    use_api_key: boolean;
  };
  srs: { intervals_days: number[]; mastered_box: number };
  practice: { default_count: number; quick_count: number };
}

const DEFAULT_CONFIG: AppConfig = {
  coach: { model: '', effort: '', max_budget_usd: 0, skip_if_no_new_results: true, schedule: ['08:30', '12:30', '21:00'], claude_bin: '', use_api_key: false },
  srs: { intervals_days: [1, 3, 7, 14, 30], mastered_box: 4 },
  practice: { default_count: 20, quick_count: 10 },
};

export function loadConfig(): AppConfig {
  let raw: Partial<AppConfig> = {};
  try {
    raw = (YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) ?? {}) as Partial<AppConfig>;
  } catch {
    // missing or invalid config → defaults
  }
  return {
    coach: { ...DEFAULT_CONFIG.coach, ...(raw.coach ?? {}) },
    srs: { ...DEFAULT_CONFIG.srs, ...(raw.srs ?? {}) },
    practice: { ...DEFAULT_CONFIG.practice, ...(raw.practice ?? {}) },
  };
}
