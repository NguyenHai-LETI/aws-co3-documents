export function normalizeKeys(keys: Iterable<string>): string {
  return [...new Set([...keys].map((k) => k.trim().toUpperCase()).filter(Boolean))].sort().join('');
}

/** All-or-nothing grading, like the real exam (multiple-response needs every key). */
export function isCorrect(pick: Iterable<string>, answer: Iterable<string>): boolean {
  const p = normalizeKeys(pick);
  return p.length > 0 && p === normalizeKeys(answer);
}

export function pct(correct: number, total: number): number {
  return total ? Math.round((correct / total) * 1000) / 10 : 0;
}

/** Rough mapping to the SAA 100–1000 scale (pass 720 ≈ 72 %). AWS does not publish the real curve. */
export function scaledScore(percent: number): number {
  return Math.max(100, Math.min(1000, Math.round(percent * 10)));
}

export function multiLabel(n: number): string {
  return ['', '', 'TWO', 'THREE', 'FOUR'][n] ?? String(n);
}
