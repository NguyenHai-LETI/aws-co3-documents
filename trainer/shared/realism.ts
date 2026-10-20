// [α] Realism of a test: how close its questions are to real SAA-C03 items (long scenario stem, full-sentence options) and
// how much there is to read compared with a real exam of the same length. Shared by the server (session.realism,
// examPick preference, the 'realistic' clock) and the web (NewTest and Result badges) so both apply the same rule.
// No runtime imports besides timing.ts (pure) — usable on both sides.
import { REFERENCE_WORDS_PER_QUESTION, countWords } from './timing.ts';
import type { Question, TestRealism } from './types.ts';

/** Words to read per real SAA-C03 item (stem + options): the official sample questions average ≈ 115. */
export { REFERENCE_WORDS_PER_QUESTION };
/** Exam-like options are full sentences: at least this many words on average (not bare service names). */
export const EXAM_LIKE_OPTION_WORDS = 8;
/** Stem threshold when the taxonomy has no `timing.long_form_min_words` (same default as Question.longForm). */
export const EXAM_LIKE_STEM_WORDS = 55;
/** A test is "optimistic" below either share: exam-like items / questions, words read / words of a real exam. */
export const REALISM_MIN_ITEMS_SHARE = 0.5;
export const REALISM_MIN_WORDS_SHARE = 0.7;

/** What the realism rule reads from a question (the full Question works; `words` = computed stem words). */
export type RealismQuestion = Pick<Question, 'stem' | 'options'> & { words?: number };
/** Taxonomy subset (server: bank.taxonomy · web: meta, whose `timing` carries long_form_min_words). */
export type RealismTaxonomy = { timing?: { long_form_min_words?: number } };

interface Counted {
  stem: number;
  options: number; // Σ words of the options
  n: number; // number of options
}

// Question objects are immutable once parsed (server) or fetched (web): count each one once.
const counted = new WeakMap<object, Counted>();

function countOf(q: RealismQuestion): Counted {
  let c = counted.get(q);
  if (!c) {
    const stem = typeof q.words === 'number' && q.words >= 0 ? q.words : countWords(q.stem);
    c = { stem, options: q.options.reduce((s, o) => s + countWords(o.text), 0), n: q.options.length };
    counted.set(q, c);
  }
  return c;
}

/** Words to read for one question: stem + every option. */
export function questionWords(q: RealismQuestion): number {
  const c = countOf(q);
  return c.stem + c.options;
}

/** Exam-like = stem ≥ timing.long_form_min_words (55) words and options of ≥ 8 words on average. */
export function isExamLike(q: RealismQuestion, tax?: RealismTaxonomy): boolean {
  const c = countOf(q);
  const minStem = tax?.timing?.long_form_min_words ?? EXAM_LIKE_STEM_WORDS;
  return c.stem >= minStem && c.n > 0 && c.options / c.n >= EXAM_LIKE_OPTION_WORDS;
}

/** Realism of a set of questions: exam-like items, words to read and the words of a real exam with as many questions. */
export function testRealism(qs: RealismQuestion[], tax?: RealismTaxonomy): TestRealism {
  let items = 0;
  let words = 0;
  for (const q of qs) {
    if (isExamLike(q, tax)) items++;
    words += questionWords(q);
  }
  return { items, total: qs.length, words, referenceWords: qs.length * REFERENCE_WORDS_PER_QUESTION };
}

/** Low realism → the score (and the pace) is optimistic compared with the real exam ("điểm lạc quan"). */
export function realismLow(r: TestRealism | undefined): boolean {
  if (!r || r.total <= 0) return false;
  const ref = r.referenceWords || r.total * REFERENCE_WORDS_PER_QUESTION;
  return r.items / r.total < REALISM_MIN_ITEMS_SHARE || r.words / ref < REALISM_MIN_WORDS_SHARE;
}

/** 7475 → "7.475" (Vietnamese thousands separator, independent of the runtime's Intl data). */
export function fmtThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Badge text: "Giống đề thật 3/65 · 2.300/7.475 từ". */
export function realismText(r: TestRealism): string {
  return `Giống đề thật ${r.items}/${r.total} · ${fmtThousands(r.words)}/${fmtThousands(r.referenceWords)} từ`;
}

/** Tooltip explaining the badge numbers. */
export function realismTitle(r: TestRealism, tax?: RealismTaxonomy): string {
  const minStem = tax?.timing?.long_form_min_words ?? EXAM_LIKE_STEM_WORDS;
  return (
    `${r.items}/${r.total} câu giống đề thật (đề ≥ ${minStem} từ, phương án trung bình ≥ ${EXAM_LIKE_OPTION_WORDS} từ) · ` +
    `phải đọc ${fmtThousands(r.words)} từ, đề thật cùng số câu ≈ ${fmtThousands(r.referenceWords)} từ (${REFERENCE_WORDS_PER_QUESTION} từ/câu)`
  );
}

/** Shown next to the badge when realismLow(r). */
export const REALISM_LOW_HINT = `Điểm lạc quan: bài này ít câu tình huống dài và ít chữ hơn đề thật (≈ ${REFERENCE_WORDS_PER_QUESTION} từ/câu) — điểm và nhịp độ thường cao hơn khi thi thật.`;
