// [v5] Pure helpers of the test runner (web/pages/Runner.tsx), kept apart so they can be unit-tested in Node.
import { WHY_CHIPS } from '../../shared/labels.ts';
import type { Question } from '../../shared/types.ts';

/** [v5] The final question of a stem (the sentence with "?", else the last one): what a qualifier family varies. */
export function finalAsk(stem: string): string {
  const plain = stem
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = plain.split(/(?<=[.?!])\s+/).filter(Boolean);
  const ask = [...sentences].reverse().find((s) => s.includes('?')) ?? sentences[sentences.length - 1] ?? plain;
  return ask.length > 180 ? `…${ask.slice(-179)}` : ask;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * [v5] Discriminate sessions: the pair to compare after an answer — the contrasted service named in the correct option,
 * against the one in the learner's wrong pick (else one named in a distractor, else the next contrasted service).
 */
export function comparePair(q: Pick<Question, 'options' | 'answer'>, picked: string[], contrast: string[]): [string, string] {
  const named = (keys: string[]) =>
    contrast.filter((svc) => {
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(svc)}([^\\p{L}\\p{N}]|$)`, 'iu');
      return keys.some((k) => re.test(q.options.find((o) => o.key === k)?.text ?? ''));
    });
  const a = named(q.answer)[0] ?? contrast[0];
  const wrongPicked = named(picked.filter((k) => !q.answer.includes(k)));
  const distractors = named(q.options.map((o) => o.key).filter((k) => !q.answer.includes(k)));
  const b = [...wrongPicked, ...distractors, ...contrast].find((s) => s !== a) ?? contrast[1] ?? a;
  return [a, b];
}

// ── [v5] why chips: WHY_CHIPS labels in a "vì sao chọn" note, joined with "; " (chips first, then the learner's words) ──

const LABELS = WHY_CHIPS.map((c) => c.label);

function parts(text: string): string[] {
  return text
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** WHY_CHIPS labels present in a note. */
export function whyChipsOn(text: string): Set<string> {
  return new Set(parts(text).filter((p) => LABELS.includes(p)));
}

/** Pure: adds or removes a chip label in a note ("Nhầm hai dịch vụ; tưởng SNS lưu tin nhắn"). */
export function toggleWhyChip(text: string, label: string): string {
  const all = parts(text);
  const on = new Set(all.filter((p) => LABELS.includes(p)));
  if (on.has(label)) on.delete(label);
  else on.add(label);
  return [...LABELS.filter((l) => on.has(l)), ...all.filter((p) => !LABELS.includes(p))].join('; ');
}
