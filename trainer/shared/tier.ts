// [v6] Question tiers — how close a question is to a real SAA-C03 item (SCHEMA §6b):
//   A = exam-grade: exam-like length (stem ≥ timing.long_form_min_words, full-sentence options — shared/realism.ts) and a
//       decision criterion (a qualifier group in `requirements`, or a closing question that names the requirements)
//   B = short scenario: some context and sentence options, below the exam-grade bar (or exam-like without a criterion)
//   C = drill: recognition questions (one-line stems, bare service names)
// Mock exams and sealed forms prefer tier A; tier C stays for spaced repetition / flashcards.
// Shared by the server (Question.tier, selection, sealed forms, coverage) and the web (filters, badges) — pure, no runtime
// imports besides realism.ts / timing.ts.
import { isExamLike, type RealismQuestion, type RealismTaxonomy } from './realism.ts';
import { countWords } from './timing.ts';
import type { Question, Tier } from './types.ts';

export type { Tier };

/** Tier B floor: a stem of at least this many words… */
export const TIER_B_STEM_WORDS = 30;
/** …and options of at least this many words on average. */
export const TIER_B_OPTION_WORDS = 5;

/** A closing question that names the requirements ("Which solution will meet these requirements?"). */
const LEAD_IN_CRITERION = /\brequirements?\b/i;

export type TierQuestion = RealismQuestion & Pick<Question, 'requirements'>;

/** The sentence that asks the question: the last one with a "?" (else the last sentence of the stem). */
export function leadIn(stem: string): string {
  const sentences = stem
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.?!])\s+/);
  return sentences.filter((s) => s.includes('?')).pop() ?? sentences.pop() ?? '';
}

/** The stem states a decision criterion: a qualifier group (MOST cost-effective, LEAST operational overhead…) or a lead-in naming the requirements. */
export function hasCriterion(q: TierQuestion): boolean {
  return (q.requirements?.length ?? 0) > 0 || LEAD_IN_CRITERION.test(leadIn(q.stem));
}

export function questionTier(q: TierQuestion, tax?: RealismTaxonomy): Tier {
  if (isExamLike(q, tax)) return hasCriterion(q) ? 'A' : 'B';
  const stem = typeof q.words === 'number' && q.words >= 0 ? q.words : countWords(q.stem);
  const options = q.options.length ? q.options.reduce((s, o) => s + countWords(o.text), 0) / q.options.length : 0;
  return stem >= TIER_B_STEM_WORDS && options >= TIER_B_OPTION_WORDS ? 'B' : 'C';
}

/** [v6] The computed Question.tier, else (older payload, hand-built question) the rule itself. */
export function tierOf(q: TierQuestion & { tier?: Tier }, tax?: RealismTaxonomy): Tier {
  return q.tier ?? questionTier(q, tax);
}

/** [v6] Preference of mocks and sealed forms: 0 = tier A, 1 = the other exam-like questions, 2 = the rest. */
export function examRank(q: TierQuestion & { tier?: Tier }, tax?: RealismTaxonomy): 0 | 1 | 2 {
  return tierOf(q, tax) === 'A' ? 0 : isExamLike(q, tax) ? 1 : 2;
}
