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

/** [v6] How close a question is to a real SAA-C03 item (shared/tier.ts): A exam-grade · B short scenario · C drill. */
export type Tier = 'A' | 'B' | 'C';

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
  tier?: Tier; // [v6] computed (shared/tier.ts): A exam-grade · B short scenario · C drill
  hash: string; // computed: short hash of stem + options + answer (patch base check, change detection)
  requirements?: string[]; // computed: requirement categories the stem asks for (taxonomy.keywords groups: cost, ops, resilient, performance, secure, negative)
  outOfScope?: boolean; // computed: a correct option names a service the official exam guide lists as out of scope
  skills?: string[]; // [v5] exam-guide Knowledge/Skills bullets, e.g. "3.5.s7" (bank/exam-guide/SAA-C03.yaml; stored `skills:` or computed)
  skillsGuessed?: boolean; // [v5] computed: `skills` came from the keyword heuristic (nothing stored) — toDraft() never writes them back
  family?: string; // [v5] qualifier family id: same scenario + same options, a different final question (stored `family:`)
  cluster?: string; // [v5] computed: sibling cluster id (variant_of ∪ near-duplicates ∪ same topic + key + similar stem) — clusters.ts
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
  services: Record<string, { topic: string; match: string[]; scope?: 'in' | 'out' | 'legacy'; aliases?: string[] }>; // [γ] scope: out = official out-of-scope list · [v6] legacy = dropped from the official in-scope list or retired with no in-scope successor (treated like out) · aliases = official / renamed names
  features: Record<string, string[]>;
  tasks: TaskDef[];
  keywords: Record<string, string[]>; // category → phrases to highlight (qualifier, cost, ops, resilient, performance, secure)
  currency?: CurrencyFact[]; // [v5 γ1] facts that changed (renames, retirements, new limits) — lint `stale-fact`
}

/** [v5 γ1] taxonomy.yaml `currency:` — a fact AWS changed, verified on an official AWS page (lint `stale-fact`). */
export interface CurrencyFact {
  id: string; // kebab-case
  pattern: string; // JavaScript regex (case-insensitive) over stem + options + explanation: text that states the old fact
  unless?: string; // regex: the text already uses the current wording (e.g. the new name) → not flagged
  fact: string; // Vietnamese: what is true now
  since: string; // YYYY-MM-DD the change took effect (or was announced)
  url: string; // official AWS source
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
  | 'diagnostic' // first-day diagnostic: 2 questions per exam-guide task
  // [v5]
  | 'today' // "Học hôm nay": a minute budget filled with reviews, recent errors, weak tasks and new questions, interleaved
  | 'discriminate' // "Phân biệt": questions where confusable services compete, the correct service alternating
  | 'qualifier' // "Đọc yêu cầu": qualifier families / requirement words, members of a family spaced apart
  | 'yesterday' // "Ôn lại lỗi hôm qua": yesterday's wrong / unsure / hinted answers (≈ 5′)
  | 'retest' // "Kiểm tra lại sau khi chữa": the questions just corrected on a result page (not a readiness sample)
  | 'anki' // reviews imported from Anki (self-graded, outside the app)
  | 'listen' // "🎧 Nghe": questions read aloud, self-graded
  | 'micro' // one-question breaks (Claude Code status line / micro API), one result file per day

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
  tiers?: Tier[]; // [v6] Question.tier (A exam-grade · B short scenario · C drill)
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
  // [v5]
  budgetMinutes?: number; // mode 'today': study budget in minutes (default goal.minutesPerDay, else practice.today_minutes)
  contrast?: string[]; // mode 'discriminate': 2–4 confusable service names (confusables.ts canonical names)
  retestOf?: string; // mode 'retest': attempt id whose corrected questions are asked again
  relearn?: boolean; // in-session relearning: wrong / hinted answers come back 3–6 questions later (default practice.relearn in practice-feedback modes)
  source?: AttemptSource; // who asks (MCP chat quiz, micro, listen) — copied to the attempt
}

export interface TestQuestionRef {
  id: string;
  order?: string[]; // display order of option keys when options are shuffled
  for?: string; // [v5] sibling substitution: this question stands in for a mature item due today (FSRS credits both)
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
  // [v5]
  budgetMinutes?: number; // mode 'today'
  mix?: TodayMix; // mode 'today': how the questions were chosen
  relearn?: boolean; // the runner re-queues wrong / hinted answers (in-session relearning)
  retestOf?: string; // mode 'retest'
  contrast?: string[]; // mode 'discriminate': the services being told apart
  phase?: ExamPhaseId; // exam phase on the day the session was built (goal.examDate)
  source?: AttemptSource;
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
  // [v5]
  relearn?: boolean; // an in-session retry of a question answered wrong earlier in the same session (not a first attempt)
  skipped?: boolean; // opened but left blank when the learner stopped early ("⏹ Dừng ở đây"): stored, not graded
  grade?: 1 | 2 | 3 | 4; // self-graded answer (listen mode / Anki import): the FSRS grade itself
}

export interface SubmitRequest {
  session: TestSession;
  answers: AnswerInput[];
  startedAt: string;
  finishedAt: string;
  timedOut: boolean;
  timeUsed: number;
  stoppedEarly?: boolean; // [v5] "⏹ Dừng ở đây": never-viewed refs are dropped, viewed blanks are stored as skipped
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
  seenBefore?: boolean; // computed, never-viewed answers only: the question had been answered (viewed) before this attempt
  // [v5] stored
  for?: string; // sibling substitution: the answer also counts as a review of this (mature) question
  relearn?: boolean; // in-session retry after a wrong / hinted first attempt: not a first attempt, not in the score
  skipped?: boolean; // opened but left blank when the learner stopped early: not graded, not a review
  grade?: 1 | 2 | 3 | 4; // self-graded (listen / Anki): used as the FSRS grade; `ok` = grade ≥ 3
  retry?: string; // result-page "thử lại trước khi xem giải thích": the second pick (display only, never a review)
  retryOk?: boolean;
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
  // [v5] stored
  planned?: number; // questions in the session when the learner stopped early (total/answered cover the part done)
  stoppedEarly?: boolean;
  source?: AttemptSource; // undefined = the app's own runner
  budgetMinutes?: number; // mode 'today'
  phase?: ExamPhaseId;
  retestOf?: string; // mode 'retest'
}

/**
 * [v5] Where an attempt's answers come from. Non-app answers are excluded from speed statistics (chat latency, reading aloud);
 * self-graded ones (anki, listen) are also excluded from readiness / pass probability (no recorded pick).
 */
export type AttemptSource = 'chat' | 'micro' | 'listen' | 'anki';

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
  leech?: boolean; // [v5] lapses ≥ srs.leech_lapses, or wrong ≥ 3 times on ≥ 2 days, until right twice in a row on 2 days
  leechPausedUntil?: string; // [v5] YYYY-MM-DD: the learner parked this leech (≤ 3 days, results/leeches.md)
  reviewedAt?: string; // [v5 λ] last FSRS review when it is later than lastAt: a sibling answered in its place (AnswerRecord.for)
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
  // [v5] statistical shield (shared/evidence.ts): accuracy shrunk toward the learner's own base rate + 80 % interval
  shrunk?: number; // 0..100
  lo?: number; // 0..100
  hi?: number; // 0..100
  verdict?: EvidenceVerdict; // vs the learner's base rate
  needMore?: number; // answers still needed before a verdict is likely (0 = enough data)
}

/** [v5] Is a bucket really below / above the learner's base rate? 'unknown' = the interval still includes it. */
export type EvidenceVerdict = 'below' | 'above' | 'same' | 'unknown';

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
  // [v5]
  transfer?: TransferStats; // first try on a sibling of a question already answered right vs repeats (memorisation check)
  leeches?: number; // questions currently flagged as leeches (list: GET /api/leeches)
  pace?: number; // learner speed: median t / est of recent viewed answers (1 = the estimate; today's budget uses it)
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

export type CoachTask = 'analyze' | 'generate' | 'enrich' | 'longform' | 'verify' | 'twins' | 'family'; // [v5] twins = paraphrase / contrast siblings, family = qualifier families

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
  // [v5] τ — a 🧑‍🏫 tutor dialog: `answer` = the transcript (Markdown), `question` = a one-line label
  kind?: 'tutor'; // undefined = a "🤖 Hỏi AI" question
  turns?: number; // learner turns
  calls?: number; // AI replies (the daily cap counts them)
  outcome?: TutorOutcome;
  rule?: string; // the closing rule (also in the notebook)
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
  examAware?: number; // [v5] expected % with the exam-aware schedule (final review period, new-question quota)
  capacity?: { minutesPerDay: number; expected: number; reviewsPerDay: number }[]; // [v5] expected % if only N minutes/day are studied
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
  // [v5] exam-aware plan (needs goal.examDate)
  phase?: ExamPhaseInfo;
  newQuota?: NewQuota;
  goNoGo?: GoNoGo; // shown from 14 days before the exam
  catchUp?: { backlog: number; days: number; perDay: number }; // behind schedule: clear the backlog in `days` days at `perDay` reviews
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
  // scored answers: seen before vs first time (as graded; never-viewed ones count as wrong, first time unless the question
  // was answered before). Absent for a rushed attempt (not part of the exposure history) — show no split then.
  fresh?: { total: number; seenBefore: number; answers: number; correct: number };
  sealedOfficial?: string; // form id when results/sealed.md records this attempt as that form's sitting — the only "điểm trên câu mới"
  // [v5 λ] new cases
  stoppedEarly?: { planned: number; answered: number; skipped: number }; // "⏹ Dừng ở đây": session size, graded answers, viewed blanks
  skipped?: string[]; // viewed but left blank when the learner stopped early: not graded, not reviews
  relearn?: { q: string; ok: boolean }[]; // in-session relearning retries (out of the score, readiness and first-try stats)
  for?: Record<string, string>; // served question → the mature question it stood in for ("câu anh em của …"; FSRS credits both)
  retest?: { of: string; title?: string; misses: string[] }; // mode retest: the attempt it re-checks + questions still wrong ("cần học lại")
  retested?: string[]; // ids of the retest attempts that re-checked this attempt (newest first)
  notReadiness?: string; // Vietnamese: why this attempt is not a readiness sample (retest, self-graded Anki / listen)
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
  // [v5] γ2 — other kinds of check in the same ledger (undefined = blind-solve: no tools, no key)
  check?: 'grounded' | 'local'; // grounded = fact-check against AWS documentation (WebFetch / WebSearch limited to AWS domains); local = Ollama vote (tie-breaker only, never changes a key)
  fact?: FactVerdict; // grounded: the key judged against the documentation
  citations?: VerifyCitation[]; // grounded: documentation quotes backing `fact`
  grounded?: VerifyVerdict; // shown verdicts (latestVerdicts, review queue): the newest grounded fact-check of the question — compare `hash`
  local?: VerifyVerdict; // shown verdicts: the newest local-model vote — compare `hash`
}

/** [v5] Grounded fact-check verdict on the bank's key: correct · wrong (another option is right) · outdated (fact changed since) · ambiguous. */
export type FactVerdict = 'correct' | 'wrong' | 'outdated' | 'ambiguous';

/** [v5] A quote from an AWS documentation page (docs.aws.amazon.com / aws.amazon.com only). */
export interface VerifyCitation {
  url: string;
  quote: string;
}

/** [v5] Import audit: imported questions blind-solved so far, and the ones the next audit run takes. */
export interface AuditStatus {
  imported: number; // active imported questions in the practice pool (not sealed, not out of scope)
  audited: number; // …with a blind-solve verdict for their current version
  next: string[]; // the next audit run (≤ 10): questions the learner meets next first, then multiple-response, then stale-flagged
}

export interface VerifySummary {
  verified: number; // questions whose latest verdict matches their current hash
  ok: number;
  review: number; // mismatch / ambiguous waiting for a decision
  stale: number; // verdict exists but the question changed afterwards
  pending: VerifyVerdict[]; // review queue, newest first
  disputed?: number; // [v5] key in doubt (blind-solve / fact-check mismatch or ambiguous, undecided) — left out of readiness
  grounded?: number; // [v5] questions fact-checked against AWS documentation for their current version
  groundedQueue?: string[]; // [v5] questions waiting for a grounded fact-check (review queue, open wrong-key / outdated issues, local-model disagreements, stale facts)
  groundedEnabled?: boolean; // [v5] coach.verify.grounded
  audit?: AuditStatus; // [v5] import audit
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
  // [v5] γ2
  grounded?: { checked: number; correct: number; wrong: number; outdated: number; ambiguous: number; error: number; citations: number }; // fact-check against AWS documentation
  local?: { checked: number; disagree: number; error?: string }; // coach.verify.local_model votes (tie-breaker)
  families?: number; // family task: qualifier families written (questions = members)
  undo?: UndoResult & { at: string; qid?: string }; // the last "↩️ Hoàn tác" of this run
}

/** [v5] GET /api/coach/undo-info?qid= — the newest AI run that changed / created the question and can still be undone for it. */
export interface UndoInfo {
  run: string;
  at: string; // ISO time the run changed the question
  task: string; // CoachTask, or 'patch' (apply-patch outside the app)
  created?: boolean; // the run wrote this question (undo retires it); otherwise it restores the previous version
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
  // [v5] π — least privilege, per-device tokens, HTTPS
  scope?: LanScope; // what the requesting client may do
  admin?: { enabled: boolean; source: 'runtime' | 'config' | 'off' }; // server.lan_admin: LAN devices may also use admin routes
  paired?: LanDevice[]; // devices paired with the access code, newest first (this machine only)
  device?: LanDevice; // the LAN device making this request
  https?: LanHttps;
}

/** [v5] Access level of a request: this machine, or a LAN device limited to practice (default) or allowed admin routes. */
export type LanScope = 'local' | 'practice' | 'admin';

/** [v5] A device paired with the LAN access code (.local/lan-devices.json): its own cookie, 30-day expiry, revocable. */
export interface LanDevice {
  id: string;
  name: string; // "iPhone · Safari" (from the user agent when it paired; can be renamed)
  created: string; // ISO
  expires: string; // ISO — created + 30 days, then the device scans the QR code again
  lastSeen?: string; // ISO
  ip?: string;
  ua?: string;
  legacy?: boolean; // the cookie shared by every device signed in before v5 (upgraded to its own token on the next visit)
  revoked?: string; // ISO — refused since then
  current?: boolean; // the device making this request
}

/** [v5] HTTPS for LAN devices (config server.https: tailscale | mkcert) — same port, TLS detected per connection. */
export interface LanHttps {
  mode: 'off' | 'tailscale' | 'mkcert';
  active: boolean; // a valid certificate is loaded: LAN devices can use https:// on the app's port
  urls: string[]; // https://<name>:<port> for the names the certificate covers
  names?: string[]; // certificate subject alternative names
  validTo?: string; // ISO
  certFile?: string; // shown relative to the data folder when inside it
  keyFile?: string;
  renewedAt?: string; // tailscale: last successful `tailscale cert`
  error?: string; // why HTTPS is not active (Vietnamese)
  hint?: string; // what to do next (Vietnamese)
  tokenUrl?: string; // first-visit URL over HTTPS (this machine only)
  qrSvg?: string;
}

/** [v5] GET /api/meta `access`: who is asking and how this page is served. */
export interface MetaAccess {
  local: boolean; // this machine (loopback)
  scope: LanScope;
  lanAdmin: boolean; // server.lan_admin in effect (LAN devices may use admin routes)
  ui: 'dist' | 'dev'; // production build or the Vite dev server (npm run dev)
  secure: boolean; // a secure context: this machine, or a LAN device over HTTPS (service worker, app badge)
}

/** [v5] GET /api/micro/next — one short question without its answer (micro API, Claude Code mod / status line). */
export interface MicroQuestion {
  id: string;
  stem: string;
  options: { key: string; label: string; text: string }[]; // display order; label A, B, C … · key = the bank's option key
  choose: number; // options to pick
  topic: string;
  topicLabel?: string;
  due: boolean; // an FSRS review due today (else a question not mastered yet)
}

export interface MicroNext {
  question: MicroQuestion | null;
  remaining: number; // candidates left after this one
  today: { answered: number; correct: number }; // micro answers today
  note?: string; // why there is no question (Vietnamese)
}

/** POST /api/micro/answer {q, pick, t} — graded, appended to today's micro attempt (`sessionId` micro:<date>). */
export interface MicroAnswerResult {
  ok: boolean;
  pick: string; // bank keys, e.g. "BD"
  key: string; // bank keys of the answer
  keyLabels: string; // the answer in the display letters of the question as served
  correct: { label: string; text: string }[];
  explanation: string; // one line
  attempt: string; // today's micro attempt id
  today: { answered: number; correct: number };
  repeat?: boolean; // the question was already answered today: stored as a same-day relearn record, out of the score
}

/** GET /api/micro/status — one line for the Claude Code status line ("📚 12 câu đến hạn · sẵn sàng 63 %"). */
export interface MicroStatus {
  due: number; // reviews due today (after the daily limit)
  backlog: number; // due beyond today's limit
  readiness: number | null; // % — null until there is enough data
  today: { answered: number; correct: number };
  line: string;
}

export interface AnkiExportRequest {
  scope: 'filter' | 'ids' | 'wrong' | 'due' | 'flagged' | 'all' | 'notebook'; // [v5 γ1] notebook = rule cards of the 📒 mistake notebook
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
  error?: string; // results/sealed.md cannot be read: every id it lists stays hidden, nothing is written — what to fix (Vietnamese)
  released?: string; // POST /api/sealed/release: the form just opened
  created?: string[]; // POST /api/sealed/create: the new form ids
  notes?: string[]; // POST /api/sealed/create: warnings (a form came out smaller than asked, …)
}

// ── [v5] waves C + D contracts (main) ───────────────────────────────────────

/** Mode 'today': where the questions of the session come from (counts), and the budget they fill. */
export interface TodayMix {
  minutes: number; // budget
  seconds: number; // Σ est × pace of the chosen questions
  pace: number; // learner speed used (median t / est, 1 = estimate)
  review: number; // FSRS reviews due (lowest recall first × domain weight)
  retry: number; // wrong / unsure / hinted in the last 1–3 days (incl. "cần học lại" after a retest)
  weak: number; // weakest exam-guide tasks (shrunk accuracy)
  new: number; // never seen, within today's new-question quota
  advance: number; // final-review period: not due yet, lowest recall on exam day
  swapped: number; // reviews served as an unseen sibling (TestQuestionRef.for)
  extra?: number; // quick random practice that filled what was left of the budget (fill step 5)
  coach?: string; // "<planId>#<sessionId>": a fresh AI-coach session not done yet — suggested before today's mix
  weakTasks?: string[]; // tasks patched, e.g. ["1.2"]
}

/** GET /api/today?minutes=N — what "▶ Học hôm nay" would build now (deterministic: same data + date + budget → same set). */
export interface TodayPreview {
  minutes: number;
  count: number;
  mix: TodayMix;
  label: string; // "25′ · 28 câu (12 ôn · 6 làm lại · 10 vá task 1.2)"
  phase?: ExamPhaseId;
  done: { answers: number; minutes: number; goalMet: boolean }; // studied today (viewed answers, Σ t + rt)
  note?: string; // why something is held back (new questions paused: backlog, phase …)
}

/** Exam phases by days left (goal.examDate): build > 14 · measure 14…8 · consolidate 7…3 · light 2…1 · exam-day 0 · after < 0. */
export type ExamPhaseId = 'build' | 'measure' | 'consolidate' | 'light' | 'exam-day' | 'after';

export interface ExamPhaseInfo {
  id: ExamPhaseId;
  label: string; // Vietnamese: "Đo & vá", "Củng cố", "Nhẹ" …
  daysLeft: number;
  from?: string; // YYYY-MM-DD the phase started / starts
  to?: string; // YYYY-MM-DD last day of the phase
  rules: string[]; // one-line Vietnamese rules shown in the banner ("Không thêm câu mới", "≤ 30′ mỗi ngày" …)
  newQuestions: boolean; // new questions allowed in this phase
  maxMinutes?: number; // daily cap in this phase (light: 30)
}

/** New questions per day so every eligible question is seen before exam − srs.new_cutoff_days. */
export interface NewQuota {
  perDay: number;
  unseen: number; // eligible questions never answered (active, practice pool, not sealed)
  cutoff: string; // YYYY-MM-DD
  daysLeft: number; // days until the cutoff (≥ 1)
  doneToday: number; // new questions answered today
  paused?: string; // Vietnamese reason when new questions are paused (backlog > 2 × daily limit, consolidate phase …)
}

/** "Thi hay dời?" — advice from 14 days before the exam (heuristic, never a decision). */
export interface GoNoGo {
  verdict: 'go' | 'reschedule' | 'unknown';
  checks: { id: 'fresh' | 'readiness' | 'domains'; label: string; ok: boolean | null; detail: string }[];
  deadline?: string; // ISO local time: last moment to reschedule (exam time − 24 h)
  note?: string;
}

/** First try on a sibling of a question already answered right ("transfer") vs repeats of the same question. */
export interface TransferStats {
  days: number; // window
  transfer: { answers: number; correct: number };
  repeat: { answers: number; correct: number };
  byTopic: { topic: string; label: string; transfer: { answers: number; correct: number }; repeat: { answers: number; correct: number }; gap?: number }[];
  warnings: string[]; // Vietnamese, only when the evidence shield allows it ("Có thể bạn đang thuộc mặt chữ ở chủ đề X")
}

/** GET /api/leeches — questions answered wrong again and again ("câu dai dẳng"). */
export interface LeechItem {
  id: string;
  lapses: number;
  wrong: number;
  wrongDays: number; // distinct days with a wrong answer
  lastAt?: string;
  pausedUntil?: string; // YYYY-MM-DD
  note?: string; // learner's memory aid (results/leeches.md)
  picks: Record<string, number>; // option key → times picked wrong
  why: string[]; // learner's recent "vì sao chọn" notes
  topic: string;
  stem: string; // first ~140 chars
  pair?: string[]; // most likely confused services [picked, correct]
}

/** GET /api/pairs — confusable service groups (option co-occurrence in the bank + the learner's confusions). */
export interface ConfusableGroup {
  id: string; // stable slug of the sorted services
  services: string[]; // 2–4 canonical names
  questions: number; // bank questions where they compete (one in the key, another in a distractor)
  pairs: { a: string; b: string; n: number; confused?: boolean }[]; // [v5 γ1] confused = a confusion pair confirmed from your own answers (insights.ts)
  confused?: boolean; // [v5 γ1] the group holds a pair you confuse (listed even when it competes in < 8 questions)
  // last10 = % correct (0..100) over the last ≤ 10 contrast answers; separated ("đã tách được") = ≥ 10 answers and last10 ≥ 80
  learner?: { answers: number; correct: number; last10: number; separated: boolean };
}

/** GET /api/pairs/compare?a=&b= — comparison material for one pair (notes excerpts, bank, progress). */
export interface PairCompare {
  a: string;
  b: string;
  excerpts: { file: string; heading: string; anchor: string; text: string }[]; // notes sections naming both (Q-service-comparisons.md first)
  questions: number; // practice questions where they compete (sealed excluded)
  progress: { answers: number; correct: number; last10: number; separated: boolean }; // same meaning as ConfusableGroup.learner
}

/** POST /api/coach/runs/:id/undo {qid?} — restore the questions an AI run changed, retire the ones it created. */
export interface UndoResult {
  run: string;
  restored: string[];
  retired: string[];
  conflicts: { id: string; reason: string }[]; // changed again since the run (hash differs): not touched
}

/** [v5] One entry of the learner's mistake notebook (coach/notebook/<domain>.md, written by the 📒 notebook task). */
export interface NotebookEntry {
  key: string; // stable slug (merge key), e.g. "sqs-vs-sns-fanout"
  domain: string; // DomainId
  misconception: string; // "❌ Bạn nghĩ …"
  rule: string; // "✅ Thực ra … vì …" — one rule to remember
  cues: string[]; // words in a stem that should trigger the rule
  contrast?: string; // "X ⟷ Y"
  qids: string[]; // evidence: questions answered wrong / unsure (never sealed)
  refs: string[]; // notes links (file#anchor)
  confident: boolean; // 🔥 wrong although sure
  count: number; // times the misconception showed up
  updated: string; // YYYY-MM-DD
  // [v5] τ — `misconception` / `rule` are stored as plain sentences, without the "❌ Bạn nghĩ" / "✅ Thực ra" labels
  title?: string; // short heading of the entry (≤ ~10 words), e.g. "SQS không fan-out — cần SNS"
  file?: string; // computed: data-root-relative file holding the entry (coach/notebook/<domain>.md)
  source?: 'ai' | 'tutor' | 'manual'; // who created the entry (📒 notebook task, 🧑‍🏫 tutor closing rule, the learner)
}

// ── [v5] τ — 🧑‍🏫 Socratic tutor, 📒 mistake notebook, 🎧 listen mode ─────────────────────────────

/** How a tutor dialog ended: the learner found the answer, it was revealed after the turn limit / "tôi chịu", the daily cap
 *  was hit (bank explanation shown, no AI), or the learner left before the end. */
export type TutorOutcome = 'found' | 'revealed' | 'gave-up' | 'capped' | 'ended';

export interface TutorMessage {
  role: 'tutor' | 'learner';
  text: string; // Markdown
  at: string; // ISO local
}

/** Tutor replies used today vs coach.tutor_daily_turns (every AI reply counts, the opening question included). */
export interface TutorUsage {
  used: number;
  limit: number; // 0 = tutor switched off
  remaining: number;
}

/** POST /api/tutor/start|turn|end — one Socratic dialog about one question (server/lib/tutor.ts). */
export interface TutorDialog {
  id: string;
  qid: string;
  messages: TutorMessage[];
  learnerTurns: number;
  revealAfter: number; // the key is revealed in the reply to this learner turn (or after "tôi chịu")
  maxTurns: number; // learner turns per dialog
  status: 'open' | 'closed';
  busy?: boolean; // a reply is being written
  outcome?: TutorOutcome;
  pickOk?: boolean; // the learner's original pick was right (unsure) — the key is not hidden then
  answer?: string[]; // the key (original option keys) — only once revealed
  rule?: string; // closing one-line rule (saved to the notebook)
  notebookKey?: string; // NotebookEntry.key the rule was merged into
  usage: TutorUsage;
  costUsd?: number;
}

/** GET /api/tutor?qid= — usage + why the tutor is unavailable (CLI missing, test sandbox, switched off) + an open dialog. */
export interface TutorStatus {
  enabled: boolean;
  reason?: string; // Vietnamese, when !enabled
  usage: TutorUsage;
  revealAfter: number;
  maxTurns: number;
  dialog?: TutorDialog; // the open (or just closed) dialog about `qid`
  sealed?: boolean; // `qid` is held back in a sealed form: the tutor refuses it
}

/** GET /api/notebook — the 📒 Sổ lỗi tab. */
export interface NotebookView {
  entries: NotebookEntry[]; // newest first; evidence ids never include a sealed question
  pending: number; // wrong / unsure answers not covered yet (what "📒 Cập nhật sổ" would send)
  through?: string; // ISO: newest answer covered by the last update
  running: boolean;
  enabled: boolean; // the AI update can run here (CLI found, not a test sandbox)
  reason?: string; // Vietnamese, when !enabled
  lastRun?: NotebookRunInfo;
}

/** POST /api/notebook/update and the idle runner (`updateNotebook()`, coach.idle_tasks: notebook). */
export interface NotebookRunInfo {
  status: 'success' | 'skipped' | 'error';
  at?: string; // ISO local
  trigger?: string;
  summary?: string;
  error?: string;
  answers?: number; // wrong / unsure answers sent to the AI
  added?: string[]; // new entry keys
  updated?: string[]; // merged entry keys
  more?: number; // answers still waiting (the batch was capped)
  costUsd?: number;
  model?: string;
}

/** GET /api/listen/next — short questions to read aloud (practice pool only, never sealed / draft / out of scope). */
export interface ListenItem {
  id: string;
  stem: string; // plain text (Markdown stripped)
  options: Option[];
  answer: string[];
  explanation: string; // plain text: the first paragraph of the bank explanation (English)
  vi?: string; // the "🇻🇳 …" summary line of the explanation, when there is one
  domain: DomainId;
  topic: string;
  due: boolean; // an FSRS review due now
}

export interface ListenNext {
  items: ListenItem[];
  source: 'micro' | 'fallback'; // select.ts microCandidates, or τ's fallback while it returns nothing
}

/** POST /api/listen/finish — one self-graded listening session (stored as mode 'listen', source 'listen'). */
export interface ListenFinishRequest {
  sessionId: string; // "listen:<uuid>" — a second submit of the same session returns the stored attempt
  started?: string;
  finished?: string;
  items: { q: string; grade: 1 | 2 | 3 | 4; t: number }[];
}

export interface ListenFinishResponse {
  id: string; // Attempt.id
  file: string;
  total: number;
  correct: number; // grade ≥ 3
  duplicate?: boolean; // the session was already stored
}

// ── [v5 γ1] exam guide (bank/exam-guide/SAA-C03.yaml) · coverage map · Anki review import ─────────────────────────

/** One official Knowledge / Skills bullet ("3.5.s7" = task 3.5, 7th "Skills in" bullet; "k" = "Knowledge of"). */
export interface GuideBullet {
  id: string;
  task: string; // "3.5"
  kind: 'knowledge' | 'skill';
  text: string; // verbatim from the official page
}

/** Coverage of one bullet by the practice pool (active, not sealed). */
export interface GuideBulletCoverage extends GuideBullet {
  questions: number; // questions tagged with the bullet (stored `skills:` or the keyword guess)
  stored: number; // …of which with a stored `skills:` (ENRICH classify)
  longForm: number; // exam-like (stem ≥ timing.long_form_min_words) questions
  need: number; // exam-like questions still wanted (target 2 per bullet; 0 = covered)
  answers?: number; // learner: first answers on these questions
  correct?: number;
}

export interface GuideTaskCoverage {
  id: string; // "1.1"
  title: string; // verbatim task statement
  domain: DomainId;
  questions: number;
  longForm: number;
  target: number; // quality.longform_target_per_task
  need: number; // exam-like questions still wanted for the task
  multi: number; // multiple-response questions
  bullets: number; // bullets of the task
  uncovered: number; // bullets without any question
}

/** GET /api/exam-guide — the official guide as data + how the bank covers it (Quality → 🗺️ Đề cương). */
export interface GuideCoverage {
  exam: string;
  title: string;
  fetched?: string; // YYYY-MM-DD the pages were transcribed
  sources: string[];
  responseTypes: string[];
  bullets: GuideBulletCoverage[];
  tasks: GuideTaskCoverage[];
  total: number; // practice-pool questions
  multi: { count: number; share: number; target: [number, number] }; // multiple-response share (0..1) vs the 20–30 % target
  chooseThree: number; // "(Choose THREE)" questions
  guessed: number; // questions whose skills are a keyword guess (no stored `skills:`)
  untagged: number; // questions without any bullet
  inScope: Record<string, string[]>; // official in-scope services by category
  outOfScope: Record<string, string[]>;
}

/** POST /api/export/anki/import — reviews done in Anki (AnkiConnect cardReviews) stored as an 'anki' attempt. */
export interface AnkiImportResult {
  ok: boolean;
  deck: string;
  reviews: number; // reviews read from Anki since the last import
  imported: number; // answers written (reviews of questions in the bank, not sealed)
  skipped: number; // reviews of unknown / sealed questions or cards without the id tag
  from?: number; // review-id range written
  to?: number;
  attempt?: string; // Attempt.id written
  duplicate?: boolean; // that range was imported before (nothing written)
  error?: string;
  hint?: string;
}
