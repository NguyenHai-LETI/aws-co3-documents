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
  shuffleOptions?: boolean;
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
}

export interface AnswerInput {
  q: string;
  pick: string[]; // chosen option keys (original keys, not display letters)
  t: number; // seconds spent on the question
  flag?: boolean;
  unsure?: boolean;
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
  box: number; // Leitner box 0 (new) .. 5 (mastered for a long time)
  dueAt?: string; // ISO date when the question should be reviewed again
  avgTime: number;
  slowCount: number; // attempts slower than 1.5 × estimate
  wrongPicks: Record<string, number>;
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
  };
  byDomain: Bucket[];
  byTopic: Bucket[];
  byDifficulty: Bucket[];
  byService: Bucket[];
  byTag: Bucket[];
  boxes: number[]; // count per Leitner box 0..5
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

export interface CoachRunInfo {
  id: string;
  task: 'analyze' | 'generate';
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

export interface ClaudeStatus {
  available: boolean;
  path?: string;
  version?: string;
  source?: string;
  hint?: string;
  auth?: { loggedIn: boolean; method?: string; plan?: string };
}
