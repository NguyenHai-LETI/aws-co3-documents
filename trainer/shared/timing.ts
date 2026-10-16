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
  { id: 'esl', label: 'ESL +30′ ×1.23', hint: 'Như chế độ ESL của AWS (130′ → 160′)', factor: 160 / 130 },
  { id: 'relaxed', label: 'Thoải mái ×1.5', hint: 'Dành cho lúc mới học chủ đề', factor: 1.5 },
  { id: 'official', label: 'Chuẩn đề thật', hint: '2 phút/câu như kỳ thi thật (130′/65 câu)', factor: -1 },
  { id: 'custom', label: 'Tự nhập phút', hint: 'Nhập số phút cụ thể', factor: -2 },
  { id: 'untimed', label: 'Không giới hạn', hint: 'Đồng hồ chỉ đếm lên, không tự nộp', factor: 0 },
];

export function computeTimeLimit(
  estimateTotal: number,
  questionCount: number,
  preset: string,
  minutes?: number,
  rubric: TimingRubric = DEFAULT_RUBRIC,
): number {
  const p = TIMING_PRESETS.find((x) => x.id === preset) ?? TIMING_PRESETS[0];
  if (p.id === 'untimed') return 0;
  if (p.id === 'official') return questionCount * rubric.official_seconds_per_question;
  if (p.id === 'custom') return Math.max(60, Math.round((minutes ?? 30) * 60));
  // round UP to 30 s so the limit is never shorter than the standard estimate
  return Math.max(60, Math.ceil((estimateTotal * p.factor) / 30) * 30);
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
