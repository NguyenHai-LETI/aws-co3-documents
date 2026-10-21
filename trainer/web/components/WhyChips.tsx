// [v5] One-tap reasons for a wrong answer (shared/labels.ts WHY_CHIPS) in a "vì sao chọn" note: the Runner's why-box and
// the Result page's correction stepper write the same vocabulary — each chip's `label`, joined with "; " (chips first, in
// WHY_CHIPS order, then the learner's own words) — so the AI coach reads one format.
import { WHY_CHIPS } from '../../shared/labels.ts';
import { toggleWhyChip, whyChipsOn } from '../lib/runner.ts';

export { toggleWhyChip, whyChipsOn };

export function WhyChips({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const on = whyChipsOn(value);
  return (
    <div className="why-chips" role="group" aria-label="Lý do chọn sai — chạm để thêm vào ghi chú">
      {WHY_CHIPS.map((c) => (
        <button key={c.id} type="button" className={`chip ${on.has(c.label) ? 'on' : ''}`} aria-pressed={on.has(c.label)} onClick={() => onChange(toggleWhyChip(value, c.label))}>
          {c.label}
        </button>
      ))}
    </div>
  );
}
