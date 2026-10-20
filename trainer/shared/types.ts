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
  requirements?: string[]; // computed: requirement categories the stem asks for (taxonomy.keywords groups: cost, ops, resilient, performance, secure, negative)
  outOfScope?: boolean; // computed: a correct option names a service the official exam guide lists as out of scope
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
  services: Record<string, { topic: string; match: string[]; scope?: 'in' | 'out'; aliases?: string[] }>; // [γ] scope: out = official out-of-scope list · aliases = official / renamed names
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
  | 'ids' // explicit list (review page, bank selection)
  | 'sealed' // one sealed form: questions never seen in practice, scored as "điểm trên câu mới"
  | 'diagnostic'; // first-day diagnostic: 2 questions per exam-guide task

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
  requirements?: string[]; // Question.requirements categories
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
  timing?: { preset: string; minutes?: number; esl?: boolean }; // esl: × 160/130 on realistic/official (default: goal.esl)
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean; // default: config practice.shuffle_options (true)
  pearson?: boolean; // exam simulation 2.0: 15 unscored items, end review screen, no pause, official timing
  recallFirst?: boolean; // hide options until the learner writes what they think the answer is
  form?: string; // mode 'sealed': sealed form id (e.g. "S1")
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
  sealedForm?: string; // mode 'sealed': the form these questions come from
  realism?: TestRealism; // how close the test is to the real exam (long scenario items, reading load)
  diagnostic?: boolean; // first-day diagnostic (2 per task)
}

export interface TestRealism {
  items: number; // exam-like questions (long scenario stem, full-sentence options)
  total: number; // questions in the test
  words: number; // words to read (stems + options)
  referenceWords: number; // words of a real exam of the same length (≈ 115 per question)
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
  rt?: number; // practice mode: seconds spent reading the feedback after "Kiểm tra" (not part of t)
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
  h?: string; // Question.hash when graded (item versioning — tells which version of the question was answered)
  regraded?: boolean; // computed on load, never stored: `ok` re-evaluated because the answer key changed since
  rt?: number; // practice mode: seconds spent reading the feedback after answering (excluded from t)
  unviewed?: boolean; // computed: no pick and t = 0 — the question was never shown long enough to answer (not a review)
  exposure?: number; // computed: 1 = first time this question was answered, 2 = second time, …
  recognized?: boolean; // computed: a repeat answered correctly faster than reading the question (likely recognition)
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
  sessionId?: string; // TestSession.sessionId — submitting the same session twice returns the stored attempt
  sealedForm?: string; // mode 'sealed'
  realism?: TestRealism;
  diagnostic?: boolean;
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
  regraded?: number; // answers re-graded because the answer key changed after they were given
  fsrs?: FsrsInfo; // scheduler version + parameters in use
  workload?: WorkloadDay[]; // reviews falling due per day (next 30 days, or until the exam)
  goal?: ExamGoal;
  forecast?: ExamForecast; // expected score on the exam date
  external?: ExternalScore[]; // scores logged from official / third-party practice exams
  externalCalibration?: ExternalCalibration;
  unviewed?: number; // answers never viewed (excluded from learning stats; still wrong in the test score)
  exposure?: ExposureSplit; // first-time vs repeat accuracy (memorisation gap)
  byRequirement?: Bucket[]; // accuracy by what the stem asks for (cost, ops, resilient, performance, secure, negative)
  confusions?: ConfusionPair[]; // confirmed service confusions (normalised by co-occurrence)
}

export interface ExposureSplit {
  days: number; // window (recent days)
  first: { answers: number; correct: number }; // first exposure to a question
  repeat: { answers: number; correct: number }; // second+ exposure
  recognized: number; // repeat answers flagged as recognition (faster than reading)
}

export interface ConfusionPair {
  picked: string; // service/feature term the learner chose (in a distractor)
  correct: string; // term in the correct option
  picks: number; // times the distractor with `picked` was chosen when `correct` was the key
  exposures: number; // times both appeared that way in answered questions
  questions: number; // distinct questions behind the picks
  rate: number; // picks / exposures
  low: number; // lower bound (80 %) of the rate
  base: number; // learner's overall wrong-pick rate (baseline)
  ids: string[]; // bank questions containing both terms (drill set)
  merged?: string[]; // [β1] pairs with the same root folded into this one ("DataSync ⟶ cdc-replication")
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

export type CoachTask = 'analyze' | 'generate' | 'enrich' | 'longform' | 'verify';

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
  kind?: 'lexical' | 'semantic'; // how the pair was found (default lexical)
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
  lint?: LintSummary; // deterministic item-writing-flaw checks
  distractors?: DistractorReport; // option pick / strike-out analytics from the learner's answers
  semantic?: SemanticStatus; // local embedding provider used for semantic duplicates
  verification?: VerifySummary; // blind-solve verdicts (second model answers without the key)
  sealed?: number; // [γ] questions held back in sealed forms — left out of every number and list above
  scope?: ScopeReport; // [γ] questions that name services the exam guide lists as out of scope
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

// ═══ v3 contracts — each block is owned by one workstream; add types only inside your own block ═══

// ── [P] performance, cache & search ─────────────────────────────────────────

export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

/** A score point of the history chart. */
export interface AttemptPoint {
  id: string;
  finished: string;
  title: string;
  score: number;
  correct: number;
  total: number;
}

/**
 * GET /api/results?limit=&offset=[&mode=<TestMode|pearson>&q=<title words>&rushed=0] — one page of the (filtered)
 * history, newest first, plus what the History page shows about the whole filtered set.
 */
export interface ResultsPage extends Page<AttemptSummary> {
  modes: TestMode[]; // modes present in the whole history (filter menu)
  pearson: number; // Pearson simulations in the whole history
  rushed: number; // rushed attempts matching mode/q (shown even when hidden with rushed=0)
  counted: number; // non-rushed attempts in the filtered set
  avgScore: number; // mean score of the counted attempts
  timeUsed: number; // seconds over the filtered set
  trend: AttemptPoint[]; // last 40 counted attempts of the filtered set, oldest first
}

export type PlanSummary = Omit<Plan, 'body'>;

/** GET /api/plans (newest first) — with ?limit=&offset= only that slice, plus total/offset/limit. */
export interface PlansResponse {
  plans: PlanSummary[];
  newSince: { attempts: number; answers: number };
  total?: number;
  offset?: number;
  limit?: number;
}

/** Data versions pushed by the SSE `data` event and returned in /api/meta and /api/state (`versions`). */
export interface DataVersions {
  bank: string;
  results: string;
  plans: string;
  params?: string; // results/fsrs-params.json (personal FSRS parameters)
  config?: string; // config.yaml
  day?: string; // local date (due counts, retrievability)
}

export interface SearchHit {
  kind: 'question' | 'note';
  id: string; // question id, or note path relative to the repo
  title: string;
  snippet: string; // plain text with «…» around matches
  score: number;
  anchor?: string; // note heading slug
  sub?: string; // secondary line: topic · pack (question) or note title (note section)
  status?: QuestionStatus; // question status (draft / retired are shown dimmed)
}

export interface SearchResponse {
  q: string;
  hits: SearchHit[];
  engine: 'fts5' | 'fallback';
  tookMs: number;
  total?: { questions: number; notes: number }; // matches before the limit (per kind)
}
// ── [P] end ──

// ── [L] learning engine, forecast & calibration ─────────────────────────────

export interface FsrsInfo {
  version: 'fsrs-6' | 'leitner';
  params: 'default' | 'personal' | 'config'; // config = srs.weights in config.yaml
  weights: number[];
  desiredRetention: number;
  optimizedAt?: string;
  reviews?: number; // reviews used by the last optimization
  minReviews: number; // srs.optimize_min_reviews
  metrics?: { logLoss?: number; rmse?: number; defaultLogLoss?: number; defaultRmse?: number };
  optimizer: 'available' | 'unavailable'; // optional native optimizer package installed?
  mode?: 'auto' | 'manual' | 'off'; // srs.optimize
  historyReviews?: number; // reviews in the optimizer's training set now (rushed attempts and never-viewed blanks left out, like the scheduler)
  trainingItems?: number; // optimizer items they make (reviews ≥ 1 day after the previous answer)
  adopted?: boolean; // the last optimization predicts the history better than the defaults → used
  running?: boolean; // an optimization is running in the background
  lastError?: string;
  lastOutcome?: 'adopted' | 'kept-default' | 'not-enough-data' | 'error'; // last run in this server process
  blocked?: string; // why the optimizer cannot run now (Vietnamese), undefined = it can
  note?: string;
  binding?: string; // optimizer package version
}

export interface WorkloadDay {
  date: string; // YYYY-MM-DD
  due: number;
  overdue?: number; // first day only: reviews already overdue (included in `due`)
}

export interface ExamGoal {
  examDate?: string; // YYYY-MM-DD
  targetScaled?: number; // default taxonomy exam.pass_scaled
  minutesPerDay?: number; // study budget (onboarding)
  restDays?: number[]; // 0 = Sunday … 6 = Saturday
  studyTime?: string; // HH:MM preferred study time (reminders)
  examTime?: string; // HH:MM booked exam time (rehearsal at the same hour)
  delivery?: 'online' | 'center'; // Pearson VUE OnVUE or test centre
  esl?: boolean; // ESL +30 accommodation requested (exam taken in English)
  checklist?: Record<string, boolean>; // exam-day checklist items ticked by the learner
}

export interface ExamForecast {
  examDate: string;
  daysLeft: number;
  ifStopNow: number; // expected % on exam day with no further study
  onSchedule: number; // expected % if due reviews are done on time
  byDomain: { domain: string; ifStopNow: number; onSchedule: number; coverage?: number; firstTry?: number; weight?: number }[];
  coverage: number; // % of the active bank seen at least once
  note?: string;
  seen?: number; // active questions answered at least once
  active?: number; // active questions in the bank
  firstTry?: number; // % first-attempt accuracy (Laplace prior) — the estimate used for unseen questions
  reviewsUntilExam?: number; // reviews falling due between today and the exam (on-schedule plan)
}

export interface ExternalScore {
  id: string;
  date: string; // YYYY-MM-DD
  source: string; // e.g. "AWS Official Practice Exam"
  score: number; // percent 0..100
  scaled?: number; // 100..1000 when known
  readinessAtDate?: number; // app readiness on that date (computed)
  note?: string;
  file: string;
  internal?: boolean; // a used sealed form of this app ("điểm trên câu mới"), not an external exam — cannot be deleted
  attempt?: string; // internal: the attempt id (results/…)
}

export interface ExternalCalibration {
  samples: number;
  offset: number; // mean(external score − readiness on that date), percent points
  adjustedReadiness: number;
  readiness?: number; // current app readiness the offset is applied to
}

/** GET /api/progress (and the body of the progress POST routes). */
export interface ProgressResponse {
  today: string; // YYYY-MM-DD, server local date
  fsrs: FsrsInfo;
  workload: WorkloadDay[];
  goal: ExamGoal;
  forecast?: ExamForecast; // needs goal.examDate
  external: ExternalScore[]; // newest first (external scores + used sealed forms with internal: true)
  externalCalibration?: ExternalCalibration;
  regraded?: number; // answers re-graded against a changed answer key (non-rushed attempts)
  sealed?: SealedFormProgress[]; // sealed forms (no question ids), in form order
  checklist?: ChecklistItem[]; // exam-day checklist (due dates need goal.examDate)
  checklistChecked?: string; // YYYY-MM-DD the official policy links were last checked
  studyStart?: string; // YYYY-MM-DD of the first non-rushed attempt
}

/** One sealed form as GET /api/progress shows it: status, size, when to take it, score once used. */
export interface SealedFormProgress {
  id: string; // "S1"
  status: 'sealed' | 'used' | 'released';
  count: number; // scored questions in the form
  suggested?: string; // YYYY-MM-DD (status sealed + goal.examDate): form 1 ≈ exam − 21 days, last form ≈ exam − 7, never before today
  due?: boolean; // suggested date reached and the form is still sealed
  usedAt?: string; // ISO time the form was taken
  attempt?: string; // attempt id that used it
  score?: number; // % on the form's scored questions (status used)
  scaled?: number;
}

/** Exam-day logistics (ESL +30, booking, ID, reschedule deadline, OnVUE system test, …). Ticks live in results/goal.md. */
export interface ChecklistItem {
  id: string; // stable: esl, booked, id-name, reschedule, system-test, center, rehearsal, after
  label: string; // Vietnamese, one line
  done: boolean;
  due?: string; // YYYY-MM-DD relative to goal.examDate
  dueText: string; // when, in words ("trước khi đặt lịch", "1 ngày trước ngày thi")
  overdue?: boolean; // due date passed and not done
  link?: string; // official policy page
  hint?: string; // one-line detail
}

/** POST /api/onboarding/plan {attemptId?} — the deterministic week-1 plan (coach/plans/<date>-onboarding.md). */
export interface OnboardingPlanResponse {
  plan: PlanSummary; // trigger 'onboarding'
  created: boolean; // false = today's plan for the same diagnostic already existed (returned unchanged)
  tasks: OnboardingTask[]; // per exam-guide task, weakest (highest priority) first
}

export interface OnboardingTask {
  task: string; // "1.1" … "4.4"
  label: string;
  domain: string;
  answers: number; // diagnostic answers (viewed)
  correct: number;
  status: 'ok' | 'partial' | 'weak' | 'untested'; // all right · some right · none right · no answer
  priority: number; // task weight × (1 − smoothed accuracy)
}

/** GET /api/results/:id → `annotations` (computed from the history; the stored attempt is returned as graded). */
export interface ResultAnnotations {
  exposure: Record<string, number>; // qid → 1 = first time answered, 2 = second time, … (viewed answers of non-rushed attempts)
  recognized: string[]; // repeats answered right faster than reading the question (likely recognition)
  unviewed: string[]; // never viewed (no pick, no time): not reviews, left out of stats — still wrong in the score
  fresh?: { total: number; seenBefore: number; answers: number; correct: number }; // scored answers: seen before vs first time (as graded)
}
// ── [L] end ──

// ── [Q] question quality: lint, distractors, semantic duplicates ────────────

export type LintSeverity = 'high' | 'medium' | 'low';

export interface LintFlaw {
  code: string; // stable id: 'stem-echo' | 'longest-correct' | 'absolute-terms' | 'negative-stem' | 'all-none-above' | 'duplicate-options' | …
  severity: LintSeverity;
  message: string; // Vietnamese, one line
  option?: string; // option key the flaw is about
}

export interface LintSummary {
  checked: number;
  flagged: number; // questions with ≥ 1 flaw
  byCode: Record<string, { severity: LintSeverity; label: string; count: number }>; // every rule, count = questions
  questions: { id: string; flaws: LintFlaw[] }[]; // worst first, capped
  bySeverity?: Record<LintSeverity, number>; // questions by their worst flaw
  ids?: Record<string, string[]>; // rule code → every flagged question id (uncapped)
}

export interface DistractorReport {
  minExposures: number;
  weakDistractors: { id: string; key: string; exposures: number; elims: number }[]; // never picked, often struck out
  suspectedKeys: { id: string; key: string; pick: string; times: number; confident: number; note: string }[];
  analysed?: number; // questions answered ≥ minExposures times (current version, non-rushed attempts)
  answers?: number; // answers counted
}

export interface SemanticStatus {
  provider: 'ollama' | 'lexical' | 'off';
  model?: string;
  available: boolean;
  embedded?: number; // questions with a cached embedding
  hint?: string; // how to enable semantic duplicates on this machine
  state?: 'idle' | 'running' | 'done' | 'error'; // background job
  total?: number; // active questions to embed
  pairs?: number; // semantic pairs found (cosine ≥ threshold)
  threshold?: number;
  version?: string; // bank version the semantic pairs belong to
  checkedAt?: string; // ISO time of the last run / probe
  error?: string; // last failure, Vietnamese
}
// ── [Q] end ──

// ── [D] AI pipeline: structured output & blind-solve verification ───────────

export type VerifyOutcome = 'ok' | 'mismatch' | 'ambiguous' | 'error';

export interface VerifyVerdict {
  line?: number; // line in bank/verify.md
  date: string; // YYYY-MM-DD
  qid: string;
  hash: string; // Question.hash the verdict applies to (stale once the question changes)
  outcome: VerifyOutcome;
  model?: string;
  picked?: string; // verifier's keys, e.g. "B" or "BD"
  key?: string; // answer key at verification time
  confidence?: 'high' | 'medium' | 'low';
  reason?: string;
  decision?: 'approved' | 'retired' | 'drafted';
  runId?: string;
  at?: string; // ISO time (orders lines that a union merge interleaved)
}

export interface VerifySummary {
  verified: number; // questions whose latest verdict matches their current hash
  ok: number;
  review: number; // mismatch / ambiguous waiting for a decision
  stale: number; // verdict exists but the question changed afterwards
  pending: VerifyVerdict[]; // review queue, newest first
}

/** Extra fields of an AI run record (`/api/coach` runs, coach/runs/<id>.json) beyond CoachRunInfo. */
export interface CoachRunOutcome {
  structured?: boolean; // generate / enrich / longform answered in JSON (coach.structured_output)
  repaired?: number; // items / questions fixed by the repair round (--resume)
  rejected?: { id: string; errors: string[] }[]; // still failing after the repair round → not written
  // enrich: final apply of coach/patches/<runId>.yaml
  patch?: string | null;
  updated?: number;
  skipped?: number;
  failed?: number;
  missing?: string[];
  // generate / longform: the new pack
  pack?: string | null;
  questions?: number;
  longForm?: number;
  errors?: number;
  // blind-solve (verify runs, or the auto phase after a run that added / changed questions)
  verify?: { checked: number; ok: number; mismatch: number; ambiguous: number; error: number; drafted: string[]; reactivated?: string[]; remaining?: number };
}
// ── [D] end ──

// ── [X] LAN access & Anki export ────────────────────────────────────────────

export type LanSource = 'runtime' | 'cli' | 'env' | 'config' | 'off';

export interface LanInfo {
  enabled: boolean;
  urls: string[]; // http://<ip>:<port>
  tokenUrl?: string; // first-visit URL carrying the access token (only shown on this machine)
  qrSvg?: string;
  hint?: string;
  local?: boolean; // the request comes from this machine (only then: token, QR, controls)
  source?: LanSource; // what decided the current state: Tools page toggle, --lan, LAN=1, config server.lan
  configured?: boolean; // config.yaml server.lan
  token?: string; // access code grouped for typing (this machine only)
  error?: string; // LAN listener failure (port in use, …)
  ui?: 'dist' | 'dev'; // what LAN devices get: production build (fast on phones) or the Vite dev server
  devices?: { ip: string; at: string; ua?: string }[]; // devices that used the access code recently (this machine only)
  failures?: number; // wrong access codes since the server started (this machine only)
}

export interface AnkiExportRequest {
  scope: 'filter' | 'ids' | 'wrong' | 'due' | 'flagged' | 'all';
  filters?: SelectionFilters;
  ids?: string[];
  deck?: string;
  includeExplanation?: boolean;
  everWrong?: boolean; // scope 'wrong': also questions answered wrong before (default: last answer wrong)
  model?: string; // Anki note type (default "Basic"; first two fields = front / back)
}

/** `POST /api/export/anki?preview=1` — how many notes a request exports, plus one rendered card. */
export interface AnkiPreview {
  count: number;
  missing: string[]; // scope 'ids': ids not in the bank (or retired)
  deck: string;
  sample?: { id: string; front: string; back: string; tags: string[] };
}

/** `GET /api/export/anki/status` — export defaults and whether AnkiConnect answers. */
export interface AnkiStatus {
  url: string; // AnkiConnect endpoint (config export.ankiconnect_url)
  deck: string; // default deck (config export.anki_deck)
  available: boolean;
  version?: number; // AnkiConnect API version
  decks?: string[];
  models?: string[];
  error?: string;
  hint?: string;
}

/** `POST /api/export/anki?push=1` — AnkiConnect push outcome (HTTP 200 with ok:false when Anki is unreachable). */
export interface AnkiPushResult {
  ok: boolean;
  deck: string;
  model?: string;
  total: number;
  added: number;
  updated: number; // notes this app pushed before (matched by the SAA-C03::id::<qid> tag), fields refreshed
  duplicates: number; // same front already in the deck from elsewhere — skipped
  failed: number;
  errors: string[];
  hint?: string;
}
// ── [X] end ──

// ═══ v4 contracts (waves A + B) ═══

export interface SealedForm {
  id: string; // "S1", "S2"
  ids: string[]; // question ids (scored items of the sealed exam)
  status: 'sealed' | 'used' | 'released';
  usedAt?: string; // ISO time the form was taken (status used)
  attempt?: string; // attempt id that used it
  releasedAt?: string; // [γ] ISO time the learner opened the form early (status released)
}

export interface SealedState {
  forms: SealedForm[];
  size: number; // questions per form
  file?: string; // path relative to the data root (results/sealed.md)
}

// ── [γ] sealed forms API (GET /api/sealed, POST /api/sealed/release | create) — never any question id ──

/** One sealed form without its question ids (same shape as /api/meta `sealed`, plus releasedAt). */
export interface SealedFormSummary {
  id: string;
  status: SealedForm['status'];
  count: number; // questions in the form
  usedAt?: string;
  attempt?: string;
  releasedAt?: string;
}

/** [γ] Bank → Chất lượng → 🎯 Phạm vi đề thi: active questions (not sealed) naming out-of-scope services. */
export interface ScopeReport {
  services: { name: string; topic: string; aliases?: string[]; answers: number; distractors: number }[]; // taxonomy services with scope: out
  answer: { id: string; services: string[] }[]; // a correct option names an out-of-scope service (Question.outOfScope)
  distractor: { id: string; options: { key: string; services: string[] }[] }[]; // only distractors do (correct options in scope)
  excluded: boolean; // config practice.exclude_out_of_scope: `answer` questions are left out of practice modes
}

/** Body of GET /api/sealed and of the release / create routes (which add `released` / `created`). */
export interface SealedStatus {
  forms: SealedFormSummary[];
  size: number; // questions per form (0 = no forms)
  file?: string; // results/sealed.md when it exists
  sealed: number; // questions held back right now (forms with status 'sealed')
  released?: string; // POST /api/sealed/release: the form just opened
  created?: string[]; // POST /api/sealed/create: the new form ids
  notes?: string[]; // POST /api/sealed/create: warnings (a form came out smaller than asked, …)
}
