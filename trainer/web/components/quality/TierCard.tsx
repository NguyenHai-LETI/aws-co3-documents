// [v6] Bank → 📐 Chất lượng → 📐 Tổng quan: "🏷️ Tầng câu hỏi" — active questions per tier (A exam-grade · B short scenario ·
// C drill), overall and per domain, against the tier-A target: 280 exam-grade questions, split by exam weight
// D1 84 · D2 73 · D3 67 · D4 56. Counted here from the bank payload (Question.tier, else shared/tier.ts) over the same
// questions as every quality number: active, sealed ones left out. A count opens exactly those questions in the list.
import { useMemo } from 'react';
import { useData } from '../../lib/store.tsx';
import { ChartCard, Meter, StackBar } from '../charts.tsx';
import { TIERS, TIER_INFO } from '../TierBadge.tsx';
import { tierOf } from '../../../shared/tier.ts';
import type { DomainId, Tier } from '../../../shared/types.ts';

/** Tier-A questions the bank aims for, and their split by exam domain weight (30 / 26 / 24 / 20 %). */
export const TIER_A_TARGET = 280;
export const TIER_A_DOMAIN_TARGETS: Record<DomainId, number> = { secure: 84, resilient: 73, performance: 67, cost: 56 };
/** Ordinal ramp, one hue light → dark (styles-quality.css --tier-a/b/c, light and dark steps validated separately). */
const TIER_COLOR: Record<Tier, string> = { A: 'var(--tier-a)', B: 'var(--tier-b)', C: 'var(--tier-c)' };

type Counts = Record<Tier, number>;
const zero = (): Counts => ({ A: 0, B: 0, C: 0 });

export function TierCard({ onTier }: { onTier: (tier: Tier, domain?: DomainId) => void }) {
  const { meta, bank } = useData();
  const counts = useMemo(() => {
    const sealed = new Set(bank?.sealed ?? []);
    const all = zero();
    const byDomain = new Map<string, Counts>();
    for (const q of bank?.questions ?? []) {
      if (q.status !== 'active' || sealed.has(q.id)) continue;
      const t = tierOf(q, meta);
      all[t]++;
      const d = byDomain.get(q.domain) ?? zero();
      d[t]++;
      byDomain.set(q.domain, d);
    }
    return { all, byDomain };
  }, [bank, meta]);
  if (!meta || !bank) return null;
  const { all, byDomain } = counts;
  const total = all.A + all.B + all.C;
  const missing = Math.max(0, TIER_A_TARGET - all.A);
  const rows = meta.domains.map((d) => ({
    d,
    c: byDomain.get(d.id) ?? zero(),
    target: TIER_A_DOMAIN_TARGETS[d.id] ?? Math.round((TIER_A_TARGET * d.weight) / 100),
  }));

  return (
    <ChartCard
      title="🏷️ Tầng câu hỏi"
      subtitle={`${total} câu active · A giống đề thật · B tình huống ngắn · C câu ôn nhanh`}
      table={{
        head: ['Domain', 'Tầng A', 'Mục tiêu A', 'Tầng B', 'Tầng C'],
        rows: [...rows.map(({ d, c, target }) => [`${d.code} ${d.label_vi}`, c.A, target, c.B, c.C]), ['Tổng', all.A, TIER_A_TARGET, all.B, all.C]],
      }}
    >
      <div className="tier-body">
        <div className="stack sm">
          <StackBar segments={TIERS.map((t) => ({ label: `${TIER_INFO[t].label} · ${TIER_INFO[t].short}`, value: all[t], color: TIER_COLOR[t] }))} />
          <div className="row" style={{ gap: 6 }}>
            {TIERS.map((t) => (
              <button key={t} type="button" className="chip" onClick={() => onTier(t)} title={`${TIER_INFO[t].title} — bấm để xem các câu này`}>
                Xem {TIER_INFO[t].label} <span className="n">{all[t]}</span>
              </button>
            ))}
          </div>
          <div className="stack sm tier-target">
            <div className="row between small">
              <b>Tầng A so với mục tiêu</b>
              <span className="num">
                {all.A}/{TIER_A_TARGET}
              </span>
            </div>
            <Meter value={all.A} max={TIER_A_TARGET} label={`Tầng A: ${all.A}/${TIER_A_TARGET} câu`} />
            <div className="tiny muted">
              {missing ? `Còn thiếu ${missing} câu tầng A` : '✓ Đủ mục tiêu tầng A'} — thi thử “Chỉ dùng câu tầng A” và đề niêm phong lấy câu tầng A; tầng C dùng để ôn ngắt quãng.
            </div>
          </div>
        </div>
        <div className="tier-doms" role="list" aria-label="Tầng câu hỏi theo domain">
          {rows.map(({ d, c, target }) => (
            <div key={d.id} className="tier-dom" role="listitem">
              <span className="small tier-dom-name" title={`${d.code} · ${d.label} — ${d.label_vi}`}>
                {d.code} · {d.label_vi}
              </span>
              <button type="button" className="ins-linkish small num" onClick={() => onTier('A', d.id)} title={`Xem ${c.A} câu tầng A của ${d.code} (mục tiêu ${target})`}>
                {c.A >= target ? '✓ ' : ''}A {c.A}/{target}
              </button>
              <Meter value={c.A} max={target} label={`${d.code}: ${c.A}/${target} câu tầng A`} />
              <span className="tiny muted tier-dom-bc">
                <button type="button" className="ins-linkish" onClick={() => onTier('B', d.id)} title={`Xem ${c.B} câu tầng B của ${d.code}`}>
                  B {c.B}
                </button>{' '}
                ·{' '}
                <button type="button" className="ins-linkish" onClick={() => onTier('C', d.id)} title={`Xem ${c.C} câu tầng C của ${d.code}`}>
                  C {c.C}
                </button>
                {c.A < target ? ` · còn thiếu ${target - c.A} câu tầng A` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
