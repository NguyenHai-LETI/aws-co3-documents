// Types shared by the server (Node, native TS) and the web UI (Vite).
// Keep this file free of runtime imports so both sides can use it.

export type DomainId = 'secure' | 'resilient' | 'performance' | 'cost';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionStatus = 'active' | 'draft' | 'retired';
export type PackOrigin = 'imported' | 'ai' | 'doc' | 'manual';

export interface Option {
  key: string; // 'A'..'H'
  text: string;
}

export interface Question {
  id: string;
  pack: string;
  stem: string; // Markdown
  options: Option[];
  answer: string[]; // sorted option keys
  explanation: string; // Markdown
  domain: DomainId;
  topic: string;
  services: string[];
  tags: string[];
  difficulty: Difficulty;
  time: number; // estimated seconds to answer
  timeEstimated: boolean; // true when `time` was missing and computed by the rubric
  status: QuestionStatus;
  origin: PackOrigin;
  variantOf: string[];
  concept?: string;
  refs: string[];
  created?: string;
  source?: string;
  task?: string; // exam-guide task statement, e.g. "2.2" (taxonomy.tasks)
  hint?: string; // one-line nudge shown on demand in practice mode (never reveals the answer)
  enriched?: string; // YYYY-MM-DD when the ENRICH routine last improved this question
  words: number; // computed: words in the stem
  longForm: boolean; // computed: stem ≥ timing.long_form_min_words (exam-realistic length)
  hash: string; // computed: short hash of stem + options + answer (patch base check, change detection)
  file: string; // path relative to trainer/
  line: number;
}

export interface Pack {
  id: string;
  title: string;
  file: string;
  origin: PackOrigin;
  exam: string;
  description?: string;
  source?: string;
  created?: string;
  generatedBy?: string;
  count: number;
  activeCount: number;
}

export interface BankProblem {
  level: 'error' | 'warning';
  file: string;
  line: number;
  qid?: string;
  message: string;
}

// ── Taxonomy ────────────────────────────────────────────────────────────────

export interface DomainDef {
  id: DomainId;
  code: string;
  weight: number;
  label: string;
  label_vi: string;
}

export interface TopicDef {
  id: string;
  icon: string;
  label: string;
  notes: string[];
}

export interface TimingRubric {
  official_seconds_per_question: number;
  words_per_minute: number;
  think_seconds: Record<Difficulty, number>;
  multi_bonus_seconds: Record<string, number>;
  min_seconds: number;
  max_seconds: number;
  round_to: number;
  long_form_min_words?: number;
}

export interface TaskDef {
  id: string; // "1.1" … "4.4"
  domain: DomainId;
  label: string;
  label_vi: string;
}

export interface Taxonomy {
  exam: {
    code: string;
    name: string;
    questions: number;
    duration_min: number;
    esl_extra_min: number;
    pass_scaled: number;
    pass_pct: number;
  };
  domains: DomainDef[];
  difficulties: { id: Difficulty; label: string }[];
  topics: TopicDef[];
  timing: TimingRubric;
  services: Record<string, { topic: string; match: string[] }>;
  features: Record<string, string[]>;
  tasks: TaskDef[];
  keywords: Record<string, string[]>; // category → phrases to highlight (qualifier, cost, ops, resilient, performance, secure)
}

// ── Tests & attempts ────────────────────────────────────────────────────────

export type TestMode =
  | 'exam' // full mock exam, weighted by domain
  | 'topic' // pick topics
  | 'pack' // replay one pack (original order)
  | 'custom' // every filter exposed
  | 'retry-wrong' // last attempt was wrong
  | 'srs' // spaced-repetition review due today
  | 'new' // never attempted
  | 'flagged' // flagged or answered "unsure"
  | 'weak' // local heuristic: weakest topics/tags first
  | 'slow' // answered slower than the estimate
  | 'quick' // 10-question sprint
  | 'coach' // session from an AI coach plan
  | 'ids'; // explicit list (review page, bank selection)

export type FeedbackMode = 'exam' | 'practice';

export interface SelectionFilters {
  packs?: string[];
  topics?: string[];
  domains?: DomainId[];
  difficulties?: Difficulty[];
  origins?: PackOrigin[];
  services?: string[];
  tags?: string[];
  tasks?: string[];
  search?: string;
}

export interface BuildTestRequest {
  mode: TestMode;
  count?: number;
  filters?: SelectionFilters;
  ids?: string[];
  plan?: string; // "<planId>#<sessionId>"
  title?: string;
  feedback?: FeedbackMode;
  timing?: { preset: string; minutes?: number };
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean; // default: config practice.shuffle_options (true)
  pearson?: boolean; // exam simulation 2.0: 15 unscored items, end review screen, no pause, official timing
  recallFirst?: boolean; // hide options until the learner writes what they think the answer is
}

export interface TestQuestionRef {
  id: string;
  order?: string[]; // display order of option keys when options are shuffled
}

export interface TestSession {
  sessionId: string;
  mode: TestMode;
  title: string;
  feedback: FeedbackMode;
  timeLimit: number; // seconds, 0 = untimed
  estimateTotal: number; // Σ question.time
  timingPreset: string;
  questions: TestQuestionRef[];
  selection: BuildTestRequest;
  plan?: string;
  createdAt: string;
  notes: string[]; // warnings for the UI (missing ids, pool smaller than requested, …)
  pearson?: boolean;
  unscored?: string[]; // ids of pilot (unscored) questions — only revealed after the test
  recallFirst?: boolean;
}

export interface AnswerInput {
  q: string;
  pick: string[]; // chosen option keys (original keys, not display letters)
  t: number; // seconds spent on the question
  flag?: boolean;
  unsure?: boolean;
  elim?: string[]; // option keys the learner struck out
  recall?: string; // recall-first: what the learner wrote before seeing the options
  hinted?: boolean; // the hint was opened
  why?: string; // learner's reason for the chosen answer (written after seeing it was wrong)
}

export interface SubmitRequest {
  session: TestSession;
  answers: AnswerInput[];
  startedAt: string;
  finishedAt: string;
  timedOut: boolean;
  timeUsed: number;
}

export interface AnswerRecord {
  q: string;
  pick: string; // "B" or "BD"; "" = unanswered
  key: string; // correct keys at grading time
  ok: boolean;
  t: number;
  est: number;
  flag?: boolean;
  unsure?: boolean;
  elim?: string; // struck option keys, e.g. "CD"
  recall?: string;
  recallHit?: boolean; // recall text matched the correct option (services/features/keywords)
  hinted?: boolean;
  why?: string;
  scored?: boolean; // false = pilot (unscored) question in a pearson exam
}

export interface Attempt {
  id: string;
  mode: TestMode;
  title: string;
  feedback: FeedbackMode;
  started: string;
  finished: string;
  timeLimit: number;
  timeUsed: number;
  timedOut: boolean;
  total: number;
  answered: number;
  correct: number;
  score: number; // percentage 0..100, 1 decimal
  scaled: number; // 100..1000 approximation of the SAA scale
  passed: boolean;
  plan?: string;
  selection?: unknown;
  answers: AnswerRecord[];
  file: string;
  layout?: number; // 2 = written after the answer-position rebalance (letters match the current bank)
  pearson?: boolean;
  pilotTotal?: number; // unscored questions (pearson); total/correct/score cover scored ones only
  pilotCorrect?: number;
  rushed?: boolean; // computed on load: median time per answer below stats.rushed_median_seconds
  medianTime?: number; // computed on load
}

export type AttemptSummary = Omit<Attempt, 'answers' | 'selection'> & {
  domains: Record<string, { total: number; correct: number }>;
  topics: Record<string, { total: number; correct: number }>;
};

// ── Derived learning state ──────────────────────────────────────────────────

export interface QuestionState {
  id: string;
  attempts: number;
  correct: number;
  lastAt?: string;
  lastOk?: boolean;
  lastPick?: string;
  lastUnsure?: boolean;
  lastFlag?: boolean;
  everWrong: boolean;
  streak: number; // consecutive correct (confident) answers, newest first
  box: number; // memory level 0 (new) .. 5 — FSRS stability bucket (or Leitner box when srs.algorithm = leitner)
  dueAt?: string; // ISO date when the question should be reviewed again
  avgTime: number;
  slowCount: number; // attempts slower than 1.5 × estimate
  wrongPicks: Record<string, number>;
  stability?: number; // FSRS: days until recall probability drops to 90 %
  fsrsDifficulty?: number; // FSRS difficulty 1..10
  retrievability?: number; // FSRS: estimated recall probability now (0..1)
  lastGrade?: 1 | 2 | 3 | 4; // FSRS grade of the last answer (again/hard/good/easy)
  lapses?: number;
  elimCorrect?: number; // times the learner struck out the correct option
}

export interface Bucket {
  key: string;
  label: string;
  attempts: number;
  correct: number;
  accuracy: number; // 0..100
  questions: number; // distinct questions attempted
  bank: number; // questions available in the bank
  avgTime: number;
  avgEst: number;
}

export interface StatsResponse {
  totals: {
    attempts: number;
    answers: number;
    correct: number;
    accuracy: number;
    distinctSeen: number;
    bankActive: number;
    mastered: number;
    due: number;
    wrongOpen: number;
    flagged: number;
    studySeconds: number;
    streakDays: number;
    readiness: number; // weighted accuracy estimate 0..100
    readinessScaled: number;
    readinessConfidence: 'low' | 'medium' | 'high';
    readinessLow: number; // 90 % interval (percent)
    readinessHigh: number;
    passProbability: number; // 0..1 — P(readiness ≥ pass_pct) under a normal approximation
    dueToday: number; // due reviews after the daily cap (srs.daily_limit)
    backlog: number; // due reviews beyond today's cap
    rushedAttempts: number; // attempts excluded as noise
    longFormShare: number; // % of answers on long-form (exam-length) questions
  };
  byDomain: Bucket[];
  byTopic: Bucket[];
  byDifficulty: Bucket[];
  byService: Bucket[];
  byTag: Bucket[];
  byTask: Bucket[];
  boxes: number[]; // questions per memory level 0..5 (labels in boxLabels)
  boxLabels: string[];
  calibration: { sure: { answers: number; correct: number }; unsure: { answers: number; correct: number }; hinted: { answers: number; correct: number } };
  elimination: { answersWithElim: number; correctEliminated: number; questions: string[] };
  recall: { answers: number; hits: number; hitAccuracy: number; missAccuracy: number };
  lengthSplit: { long: { answers: number; correct: number }; short: { answers: number; correct: number } };
  rushed: { id: string; title: string; finished: string; medianTime: number }[];
  trend: { id: string; finished: string; score: number; total: number; mode: TestMode; title: string }[];
  daily: { date: string; answers: number; correct: number; seconds: number }[];
  mostMissed: { id: string; wrong: number; attempts: number; topic: string; stem: string }[];
}

// ── AI coach ────────────────────────────────────────────────────────────────

export interface PlanSession {
  id: string;
  title: string;
  why?: string;
  feedback?: FeedbackMode;
  questions?: string[];
  filter?: BuildTestRequest;
  timing?: string;
  done?: { attemptId: string; score: number; finished: string }[];
}

export interface Plan {
  id: string;
  file: string;
  created: string;
  trigger?: string;
  summary?: string;
  newPacks: string[];
  sessions: PlanSession[];
  body: string; // Markdown without front matter
}

export type CoachTask = 'analyze' | 'generate' | 'enrich' | 'longform';

export interface CoachRunInfo {
  id: string;
  task: CoachTask;
  trigger: 'manual' | 'schedule' | 'cli';
  status: 'running' | 'success' | 'error' | 'cancelled' | 'skipped';
  startedAt: string;
  finishedAt?: string;
  costUsd?: number;
  summary?: string;
  error?: string;
  params?: Record<string, unknown>;
}

export interface CoachEvent {
  runId: string;
  at: string;
  kind: 'start' | 'tool' | 'text' | 'result' | 'error' | 'stderr' | 'end';
  text: string;
}

export interface IssueItem {
  line: number;
  open: boolean;
  date: string;
  qid: string;
  type: string;
  note: string;
  resolution?: string;
}

// ── Bank quality, ratings, AI helpers, sync ─────────────────────────────────

export interface RatingItem {
  line: number;
  date: string;
  qid: string;
  value: 'up' | 'down';
  note?: string;
}

export interface DuplicatePair {
  a: string;
  b: string;
  score: number; // 0..1 similarity
}

export interface BankQuality {
  version: string; // bank version the numbers were computed for
  singleAnswer: number; // questions with exactly one correct option
  letters: Record<string, number>; // correct-letter distribution of single-answer questions
  lettersByOrigin: Record<string, Record<string, number>>;
  correctLongest: number; // questions whose (a) correct option is the longest one by ≥ 15 %
  medianStemWords: number;
  longForm: number;
  shortExplanations: number; // explanation < 15 words
  withHint: number;
  withTask: number;
  enriched: number;
  total: number;
  duplicates: DuplicatePair[];
  ratings: Record<string, { up: number; down: number }>;
  lowRated: string[]; // ids with down ≥ 2 and down > up
  variantEffect: { originals: number; fixedAfterVariant: number; examples: string[] };
}

export interface EnrichStatus {
  total: number;
  enriched: number;
  pending: { explain: number; hint: number; classify: number; balance: number };
  longForm: number;
  lastRun?: CoachRunInfo;
}

export interface CostSummary {
  days: number;
  runs: number;
  costUsd: number;
  byTask: Record<string, { runs: number; costUsd: number }>;
  asks: { count: number; costUsd: number };
}

export interface QaEntry {
  at: string;
  question: string;
  answer: string;
  pick?: string;
  costUsd?: number;
}

export interface SyncStep {
  cmd: string;
  ok: boolean;
  output: string;
}

export interface SyncResult {
  ok: boolean;
  message: string;
  steps: SyncStep[];
  host: string;
}

export interface ClaudeStatus {
  available: boolean;
  path?: string;
  version?: string;
  source?: string;
  hint?: string;
  auth?: { loggedIn: boolean; method?: string; plan?: string };
}
