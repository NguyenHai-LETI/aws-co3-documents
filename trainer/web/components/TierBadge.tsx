// [v6] Question tiers on the web (shared/tier.ts): A exam-grade · B short scenario · C drill. The badge "Tầng A/B/C", the
// labels used by the filters (Bank list, 🛠️ Tùy chỉnh, 🎯 Thi thử) and the quality card, and why a question sits in its
// tier. The tier itself is shared tierOf(): the server's Question.tier, else the same rule on the payload.
import { useData } from '../lib/store.tsx';
import { hasCriterion, questionTier, tierOf } from '../../shared/tier.ts';
import { EXAM_LIKE_OPTION_WORDS, EXAM_LIKE_STEM_WORDS, type RealismTaxonomy } from '../../shared/realism.ts';
import { countWords } from '../../shared/timing.ts';
import type { Question, Tier } from '../../shared/types.ts';

export const TIERS: readonly Tier[] = ['A', 'B', 'C'];

export const TIER_INFO: Record<Tier, { label: string; short: string; title: string; cls: string }> = {
  A: { label: 'Tầng A', short: 'giống đề thật', title: 'Tầng A — giống đề thật: tình huống dài, phương án là câu đầy đủ, có tiêu chí (MOST cost-effective…)', cls: 'accent' },
  B: { label: 'Tầng B', short: 'tình huống ngắn', title: 'Tầng B — tình huống ngắn: có bối cảnh nhưng chưa đạt chuẩn đề thật', cls: '' },
  C: { label: 'Tầng C', short: 'câu ôn nhanh', title: 'Tầng C — câu ôn nhanh: hỏi nhận diện, phương án ngắn (để ôn ngắt quãng)', cls: '' },
};

export const isTier = (v: unknown): v is Tier => v === 'A' || v === 'B' || v === 'C';

/** "Tầng A" badge with a short tooltip. */
export function TierBadge({ q }: { q: Question }) {
  const { meta } = useData();
  const t = TIER_INFO[tierOf(q, meta)];
  return (
    <span className={`badge ${t.cls}`} title={t.title}>
      {t.label}
    </span>
  );
}

/** 7.9 → "7,9" · 8 → "8" (floored to one decimal by the caller, so "8" never stands for 7.96 below the threshold). */
const words = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

/**
 * Bank → question detail: the tier, the numbers its rule reads (stem words, average option words, a decision criterion)
 * and what tier A still needs — only the tier when the server's tier differs from the shared rule (nothing to explain).
 */
export function tierReason(q: Question, tax?: RealismTaxonomy): string {
  const t = tierOf(q, tax);
  if (t !== questionTier(q, tax)) return `${TIER_INFO[t].label} (${TIER_INFO[t].short}).`;
  const stem = typeof q.words === 'number' && q.words >= 0 ? q.words : countWords(q.stem);
  const opt = q.options.length ? q.options.reduce((s, o) => s + countWords(o.text), 0) / q.options.length : 0;
  const minStem = tax?.timing?.long_form_min_words ?? EXAM_LIKE_STEM_WORDS;
  const criterion = hasCriterion(q);
  const facts = `đề ${stem} từ · phương án trung bình ${words(Math.floor(opt * 10) / 10)} từ · ${criterion ? 'có' : 'chưa có'} tiêu chí`;
  if (t === 'A') return `${TIER_INFO.A.label} (${TIER_INFO.A.short}): ${facts}.`;
  const need = [
    stem < minStem ? `đề ≥ ${minStem} từ` : '',
    opt < EXAM_LIKE_OPTION_WORDS ? `phương án trung bình ≥ ${EXAM_LIKE_OPTION_WORDS} từ` : '',
    criterion ? '' : 'một tiêu chí (MOST cost-effective… hoặc “…these requirements?”)',
  ].filter(Boolean);
  return `${TIER_INFO[t].label} (${TIER_INFO[t].short}): ${facts} — lên tầng A cần ${need.join(', ')}.`;
}
