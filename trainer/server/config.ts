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
    models: { analyze: string; generate: string; enrich: string; ask: string; verify: string; tutor: string; notebook: string }; // per-task override ('' = use `model`)
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
    structured_output: boolean; // generate / enrich / longform return JSON (--json-schema) and the app writes the files
    enrich_after_analyze: boolean; // after an analyze run, enrich ~10 questions the learner is about to meet
    idle_tasks: string[]; // [v5] scheduled run with nothing new to analyze: what to do instead, first that has work (enrich | longform | twins | audit | notebook)
    twins_per_run: number; // [v5] paraphrase / contrast siblings written per 'twins' run
    tutor_daily_turns: number; // [v5] Socratic tutor: AI replies per day, the opening question included (0 = off)
    verify: {
      auto: boolean; // blind-solve new and just-edited questions after AI runs
      auto_draft: boolean; // mismatch / ambiguous verdict on an AI-written question → status: draft until reviewed
      batch_size: number; // questions per verifier call
      grounded: boolean; // [v5] disputed / stale-flagged questions: fact-check against AWS documentation (WebFetch limited to AWS domains)
      local_model: string; // [v5] Ollama chat model for a third, different-family vote ('' = off) — tie-breaker only
    };
  };
  srs: {
    algorithm: 'fsrs' | 'leitner';
    desired_retention: number; // FSRS target recall probability
    daily_limit: number; // max reviews offered per day
    mastered_stability_days: number; // FSRS stability ≥ this = mastered
    intervals_days: number[]; // Leitner only
    mastered_box: number; // Leitner only
    weights: number[]; // FSRS-6 parameters set by hand ([] = personal parameters if optimized, else defaults)
    optimize: 'auto' | 'manual' | 'off'; // fit personal FSRS parameters from the review history
    optimize_min_reviews: number; // reviews needed before optimizing
    exam_aware: boolean; // [v5] with goal.examDate: final review period, new-question quota, phases
    final_review_days: number; // [v5] reviews falling after exam − 2 move into [exam − N, exam − 2] when recall on exam day < 0.9
    new_cutoff_days: number; // [v5] every new question seen by exam − N days (daily quota)
    load_balance: boolean; // [v5] spread due dates (±5 % of the interval) to the lightest day — deterministic
    final_retention: number; // [v5] desired retention in the last 14 days (0 = keep desired_retention)
    leech_lapses: number; // [v5] lapses that make a question a leech ("câu dai dẳng")
    sibling_swap_days: number; // [v5] a due question with stability ≥ N days is served as an unseen sibling (transfer)
  };
  practice: {
    default_count: number;
    quick_count: number;
    shuffle_options: boolean;
    exclude_out_of_scope: boolean;
    today_minutes: number; // [v5] "Học hôm nay" budget when goal.minutesPerDay is not set
    relearn: boolean; // [v5] practice-feedback sessions re-ask wrong / hinted questions 3–6 questions later
  };
  exam: { sealed_forms: number; sealed_size: number }; // sealed forms: questions held back from practice to measure readiness on unseen items
  stats: { rushed_median_seconds: number; recency_half_life_days: number; recognized_wpm: number };
  quality: {
    embeddings: 'auto' | 'ollama' | 'off'; // semantic duplicates with a local embedding model (auto = Ollama when it runs)
    ollama_url: string;
    embedding_model: string;
    semantic_threshold: number; // cosine similarity ≥ this = likely duplicate
    longform_target_per_task: number; // [v5] exam-like (long scenario) questions wanted per exam-guide task
  };
  server: {
    lan: boolean; // also listen on the local network (phone access with an access token)
    lan_admin: boolean; // [v5] phones may also run AI / sync / verify / settings (false = practice scope only)
    https: 'off' | 'tailscale' | 'mkcert'; // [v5] HTTPS listener for LAN devices
    https_cert: string; // [v5] mkcert: certificate / key files ('' = .local/certs/)
    https_key: string;
  };
  export: {
    anki_deck: string;
    ankiconnect_url: string;
  };
  cache: {
    sqlite: boolean; // rebuildable SQLite index (parse cache + full-text search) in trainer/.cache/ (git-ignored)
  };
  sync: {
    data_paths: string[];
    before_ai: boolean; // AI coach runs sync first, so the AI sees results / bank changes from the other machine
    after_ai: boolean; // ...and push what a successful run wrote (plans, packs, patches, profile) right away
    auto: 'idle' | 'off'; // sync on its own a few minutes after a submitted test (and pull at start / push at shutdown)
    auto_delay_minutes: number;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  coach: {
    model: '',
    models: { analyze: '', generate: '', enrich: '', ask: '', verify: '', tutor: '', notebook: '' },
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
    structured_output: true,
    enrich_after_analyze: false,
    idle_tasks: ['enrich'],
    twins_per_run: 10,
    tutor_daily_turns: 40,
    verify: { auto: true, auto_draft: true, batch_size: 10, grounded: true, local_model: '' },
  },
  srs: {
    algorithm: 'fsrs',
    desired_retention: 0.9,
    daily_limit: 50,
    mastered_stability_days: 21,
    intervals_days: [1, 3, 7, 14, 30],
    mastered_box: 4,
    weights: [],
    optimize: 'auto',
    optimize_min_reviews: 400,
    exam_aware: true,
    final_review_days: 7,
    new_cutoff_days: 10,
    load_balance: true,
    final_retention: 0,
    leech_lapses: 3,
    sibling_swap_days: 7,
  },
  practice: { default_count: 20, quick_count: 10, shuffle_options: true, exclude_out_of_scope: true, today_minutes: 25, relearn: true },
  exam: { sealed_forms: 2, sealed_size: 50 },
  stats: { rushed_median_seconds: 5, recency_half_life_days: 14, recognized_wpm: 300 },
  quality: { embeddings: 'auto', ollama_url: 'http://127.0.0.1:11434', embedding_model: 'embeddinggemma', semantic_threshold: 0.88, longform_target_per_task: 12 },
  server: { lan: false, lan_admin: false, https: 'off', https_cert: '', https_key: '' },
  export: { anki_deck: 'AWS SAA-C03', ankiconnect_url: 'http://127.0.0.1:8765' },
  cache: { sqlite: true },
  sync: { data_paths: ['trainer/results', 'trainer/coach', 'trainer/bank'], before_ai: true, after_ai: true, auto: 'idle', auto_delay_minutes: 4 },
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
  coach.verify = { ...DEFAULT_CONFIG.coach.verify, ...((raw.coach as Partial<AppConfig['coach']> | undefined)?.verify ?? {}) };
  return {
    coach,
    srs: { ...DEFAULT_CONFIG.srs, ...(raw.srs ?? {}) },
    practice: { ...DEFAULT_CONFIG.practice, ...(raw.practice ?? {}) },
    exam: { ...DEFAULT_CONFIG.exam, ...(raw.exam ?? {}) },
    stats: { ...DEFAULT_CONFIG.stats, ...(raw.stats ?? {}) },
    quality: { ...DEFAULT_CONFIG.quality, ...(raw.quality ?? {}) },
    server: { ...DEFAULT_CONFIG.server, ...(raw.server ?? {}) },
    export: { ...DEFAULT_CONFIG.export, ...(raw.export ?? {}) },
    cache: { ...DEFAULT_CONFIG.cache, ...(raw.cache ?? {}) },
    sync: { ...DEFAULT_CONFIG.sync, ...(raw.sync ?? {}) },
  };
}
