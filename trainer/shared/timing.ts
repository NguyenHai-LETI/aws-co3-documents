import type { Difficulty, TimingRubric } from './types.ts';

export const DEFAULT_RUBRIC: TimingRubric = {
  official_seconds_per_question: 120,
  words_per_minute: 130,
  think_seconds: { easy: 30, medium: 40, hard: 55 },
  multi_bonus_seconds: { '2': 20, '3': 30 },
  min_seconds: 45,
  max_seconds: 180,
  round_to: 5,
};

/** Words to read per real SAA-C03 item (stem + options): the official sample questions average ≈ 115 (shared/realism.ts). */
export const REFERENCE_WORDS_PER_QUESTION = 115;
/** AWS ESL +30 accommodation: 130′ → 160′ (applied as × ESL_MINUTES / EXAM_MINUTES to the exam-pace clocks). */
export const EXAM_MINUTES = 130;
export const ESL_MINUTES = 160;

export function countWords(text: string): number {
  const m = text.replace(/[`*_>#|[\]()]/g, ' ').match(/[\p{L}\p{N}][\p{L}\p{N}'’.\-/@]*/gu);
  return m ? m.length : 0;
}

/**
 * Estimated seconds to answer one question, calibrated to the SAA-C03 pace
 * (130 min / 65 questions ≈ 120 s for a full-length ~170-word question).
 */
export function estimateQuestionTime(
  q: { stem: string; options: { text: string }[]; answer: string[]; difficulty: Difficulty },
  rubric: TimingRubric = DEFAULT_RUBRIC,
): number {
  const words = countWords(q.stem) + q.options.reduce((s, o) => s + countWords(o.text), 0);
  const read = (words * 60) / rubric.words_per_minute;
  const think = rubric.think_seconds[q.difficulty] ?? rubric.think_seconds.medium;
  const n = q.answer.length;
  const multi = n >= 2 ? (rubric.multi_bonus_seconds[String(Math.min(n, 3))] ?? 0) : 0;
  const raw = read + think + multi;
  const rounded = Math.round(raw / rubric.round_to) * rubric.round_to;
  return Math.min(rubric.max_seconds, Math.max(rubric.min_seconds, rounded));
}

export interface TimingPreset {
  id: string;
  label: string;
  hint: string;
  factor: number; // multiplier applied to Σ estimates; 0 = untimed
}

export const TIMING_PRESETS: TimingPreset[] = [
  { id: 'standard', label: 'Chuẩn ×1.0', hint: 'Tổng thời gian ước lượng của các câu', factor: 1 },
  { id: 'strict', label: 'Áp lực ×0.8', hint: 'Luyện tốc độ — ít hơn 20% thời gian', factor: 0.8 },
  { id: 'esl', label: 'ESL +30′ ×1.23', hint: 'Như chế độ ESL của AWS (130′ → 160′)', factor: ESL_MINUTES / EXAM_MINUTES },
  { id: 'relaxed', label: 'Thoải mái ×1.5', hint: 'Dành cho lúc mới học chủ đề', factor: 1.5 },
  {
    id: 'realistic',
    label: 'Theo tải đọc đề thật',
    hint: `130′ theo số chữ phải đọc so với đề thật (≈ ${REFERENCE_WORDS_PER_QUESTION} từ/câu) — không ít hơn Σ chuẩn, tối đa 2′/câu`,
    factor: -3,
  },
  { id: 'official', label: 'Chuẩn đề thật', hint: '2 phút/câu như kỳ thi thật (130′/65 câu)', factor: -1 },
  { id: 'custom', label: 'Tự nhập phút', hint: 'Nhập số phút cụ thể', factor: -2 },
  { id: 'untimed', label: 'Không giới hạn', hint: 'Đồng hồ chỉ đếm lên, không tự nộp', factor: 0 },
];

/** Presets that run at the real exam's pace — the ones the ESL +30 accommodation scales (× 160/130). */
export const EXAM_PACE_PRESETS = ['realistic', 'official'];

/** Default clock of a mode: the honest reading-load clock for full mocks and sealed forms, Σ estimates otherwise. */
export function defaultTimingPreset(mode: string): string {
  return mode === 'exam' || mode === 'sealed' ? 'realistic' : 'standard';
}

// round UP to 30 s (the epsilon keeps exact products such as 7800 × 160/130 = 9600 from drifting one step up)
const roundUp30 = (s: number) => Math.ceil(s / 30 - 1e-9) * 30;

/**
 * Time limit in seconds (0 = untimed).
 * - factor presets: Σ estimates × factor, rounded up to 30 s (never below 1 minute)
 * - `official`: 2 minutes per question (130′ / 65)
 * - `realistic`: the real exam's pace applied to this test's reading load — 2′ × words / 115 per question
 *   (`opts.words` = words of stems + options), clamped to [Σ estimates, 2′ per question]
 * - `opts.esl`: ESL +30 accommodation, × 160/130 on `realistic` and `official`
 */
export function computeTimeLimit(
  estimateTotal: number,
  questionCount: number,
  preset: string,
  minutes?: number,
  rubric: TimingRubric = DEFAULT_RUBRIC,
  opts: { words?: number; esl?: boolean } = {},
): number {
  const p = TIMING_PRESETS.find((x) => x.id === preset) ?? TIMING_PRESETS[0];
  if (p.id === 'untimed') return 0;
  const esl = (s: number) => (opts.esl ? (s * ESL_MINUTES) / EXAM_MINUTES : s);
  const perQuestion = rubric.official_seconds_per_question;
  if (p.id === 'official') return opts.esl ? roundUp30(esl(questionCount * perQuestion)) : questionCount * perQuestion;
  if (p.id === 'realistic') {
    const cap = questionCount * perQuestion;
    const reading = ((opts.words ?? 0) * perQuestion) / REFERENCE_WORDS_PER_QUESTION;
    return Math.max(60, roundUp30(esl(Math.min(cap, Math.max(estimateTotal, reading)))));
  }
  if (p.id === 'custom') return Math.max(60, Math.round((minutes ?? 30) * 60));
  // never shorter than the standard estimate
  return Math.max(60, roundUp30(estimateTotal * p.factor));
}

export function fmtDuration(totalSeconds: number, opts: { long?: boolean } = {}): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (opts.long) {
    if (h) return `${h} giờ ${m} phút`;
    if (m) return sec ? `${m} phút ${sec}s` : `${m} phút`;
    return `${sec}s`;
  }
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
