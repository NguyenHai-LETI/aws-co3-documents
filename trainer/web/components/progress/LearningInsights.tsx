// [β2] Stats cards for honest measurement (v4): first vs repeat exposure (memorisation gap, recognition), accuracy by
// what the stem asks for (requirement categories vs the "no requirement" baseline) and confirmed service confusions
// with a drill per pair. Single-hue bars with the pass mark (or the learner's base rate) as a hairline, a table twin
// on every chart (ChartCard), status colour only with an icon + text.
import { useData } from '../../lib/store.tsx';
import { href, navigate } from '../../lib/router.ts';
import { exposureNote, pairHref, rateGap, ratePct, undecidedText } from '../learning/rules.ts';
import { startTest } from '../../lib/start.ts';
import { BarList, ChartCard } from '../charts.tsx';
import { pctOf } from '../insights.tsx';
import { REQUIREMENTS, REQUIREMENT_INFO } from '../../../shared/labels.ts';
import type { Bucket, ConfusionPair, ExposureSplit, TransferStats } from '../../../shared/types.ts';

type Pair = { answers: number; correct: number };
const acc = (x: Pair) => pctOf(x.correct, x.answers);
const MIN_SPLIT = 10; // answers per side before comparing first vs repeat

// ── first vs repeat exposure ────────────────────────────────────────────────

export function ExposureCard({ e, passPct }: { e: ExposureSplit; passPct: number }) {
  const note = exposureNote(e, MIN_SPLIT);
  const recShare = pctOf(e.recognized, e.repeat.answers);
  const rows = [
    { key: 'first', label: '🆕 Lần đầu gặp', v: e.first, title: 'Câu bạn trả lời lần đầu tiên — gần với đề thật nhất (đề thật toàn câu mới)' },
    { key: 'repeat', label: '🔁 Gặp lại', v: e.repeat, title: 'Câu bạn đã trả lời ít nhất một lần trước đó' },
  ];
  return (
    <ChartCard
      title="🔁 Câu mới vs câu gặp lại"
      subtitle={`${e.days} ngày gần đây · tỉ lệ đúng khi gặp một câu lần đầu so với khi gặp lại · vạch = ngưỡng đỗ ${passPct}%`}
      table={{
        head: ['Nhóm', 'Câu', 'Đúng', '%'],
        rows: [...rows.map((r) => [r.label, r.v.answers, r.v.correct, acc(r.v)]), ['⚡ Nhận diện (gặp lại, nhanh hơn tốc độ đọc)', e.recognized, e.recognized, recShare]],
      }}
    >
      <BarList
        target={passPct}
        items={rows.map((r) => ({
          key: r.key,
          label: r.label,
          value: acc(r.v),
          muted: !r.v.answers,
          valueText: r.v.answers ? `${acc(r.v)}% · ${r.v.answers}` : 'chưa có',
          title: `${r.title}: ${r.v.correct}/${r.v.answers} đúng`,
        }))}
      />
      <div className="stack sm" style={{ marginTop: 10 }}>
        <div className={`small ${note.cls}`}>{note.text}</div>
        {e.repeat.answers > 0 && (
          <div className="small dim" title="Gặp lại và trả lời đúng nhanh hơn thời gian đọc đề + phương án ở tốc độ stats.recognized_wpm">
            {e.recognized ? (
              <>
                ⚡ <b className="num">{recShare}%</b> lượt gặp lại ({e.recognized}) đúng nhanh hơn tốc độ đọc đề — nhiều khả năng nhận ra đáp án thay vì suy luận. Các lượt này
                không được chấm “Dễ” và chỉ tính nhẹ vào mức sẵn sàng.
              </>
            ) : (
              '⚡ Chưa có lượt gặp lại nào đúng nhanh hơn tốc độ đọc đề (dấu hiệu nhớ mặt đáp án).'
            )}
          </div>
        )}
      </div>
    </ChartCard>
  );
}

// ── accuracy by requirement ─────────────────────────────────────────────────

export function RequirementCard({ buckets, passPct }: { buckets: Bucket[]; passPct: number }) {
  const { meta } = useData();
  const by = new Map(buckets.map((b) => [b.key, b]));
  const keys = [...REQUIREMENTS, ...buckets.map((b) => b.key).filter((k) => !(REQUIREMENTS as readonly string[]).includes(k))];
  const base = by.get('none');
  const rows = keys.map((k) => ({ k, b: by.get(k), info: REQUIREMENT_INFO[k] }));
  const answered = rows.some((r) => r.k !== 'none' && r.b?.attempts);
  // the requirement furthest below the baseline (≥ 10 answers each)
  const weakest = base && base.attempts >= 10 ? rows.filter((r) => r.k !== 'none' && (r.b?.attempts ?? 0) >= 10).sort((a, b) => a.b!.accuracy - b.b!.accuracy)[0] : undefined;
  const gap = weakest && base ? Math.round(base.accuracy - weakest.b!.accuracy) : 0;
  // [v5] the shortfall vs the "no requirement" baseline only counts when its interval excludes 0 (statistical shield)
  const g = weakest && base ? rateGap({ correct: base.correct, answers: base.attempts }, { correct: weakest.b!.correct, answers: weakest.b!.attempts }) : undefined;
  const example = weakest ? meta?.keywords?.[weakest.k]?.[0] : undefined;
  return (
    <ChartCard
      title="🎯 Theo tiêu chí đề"
      subtitle="Tỉ lệ đúng theo điều đề hỏi (MOST cost-effective, LEAST operational overhead, highly available…) — bấm 1 dòng để luyện"
      table={{
        head: ['Tiêu chí', 'Lượt', 'Đúng', '%', 'Đã gặp/Ngân hàng'],
        rows: rows.map(({ k, b, info }) => [info ? info.label : (b?.label ?? k), b?.attempts ?? 0, b?.correct ?? 0, b?.accuracy ?? 0, `${b?.questions ?? 0}/${b?.bank ?? 0}`]),
      }}
    >
      <BarList
        target={passPct}
        items={rows.map(({ k, b, info }) => ({
          key: k,
          label: info ? `${info.icon} ${info.label}` : <span className="muted">{b?.label ?? k}</span>,
          value: b?.accuracy ?? 0,
          muted: !b?.attempts,
          valueText: b?.attempts ? `${b.accuracy}% · ${b.attempts}` : `0/${b?.bank ?? 0}`,
          title: `${info?.desc ?? 'Câu không nêu tiêu chí nào — mốc để so sánh'}\n${b ? `${b.correct}/${b.attempts} đúng · đã gặp ${b.questions}/${b.bank} câu` : 'chưa có câu nào'}${info ? ' — bấm để luyện' : ''}`,
          onClick: info ? () => navigate(`/new?mode=custom&requirements=${encodeURIComponent(k)}`) : undefined,
        }))}
      />
      {!answered ? (
        <div className="small dim" style={{ marginTop: 10 }}>
          Chưa có câu trả lời nào trên câu có tiêu chí. Câu ngắn trong ngân hàng ít khi nêu tiêu chí — câu dài (ENRICH) và chế độ 🎯 Thi thử có nhiều hơn.
        </div>
      ) : weakest && gap >= 10 && g?.verdict !== 'higher' ? (
        <div className="small dim" style={{ marginTop: 10 }}>
          Câu hỏi về <b>{weakest.info?.label ?? weakest.k}</b> thấp hơn câu không nêu tiêu chí {gap} điểm — {undecidedText(g?.needMore)}.
        </div>
      ) : weakest && gap >= 10 ? (
        <div className="small warn" style={{ marginTop: 10 }}>
          ⚠ Câu hỏi về <b>{weakest.info?.label ?? weakest.k}</b> thấp hơn câu không nêu tiêu chí {gap} điểm — đọc kỹ cụm {example ? `“${example}”` : 'tiêu chí'} trước khi chọn,
          loại phương án chạy được nhưng không thoả tiêu chí; bấm dòng đó để luyện riêng.
        </div>
      ) : null}
    </ChartCard>
  );
}

// ── confirmed confusions ────────────────────────────────────────────────────

const ratio = (p: ConfusionPair) => (p.base > 0 ? p.rate / p.base : 0);
const fmtRatio = (x: number) => (x >= 10 ? String(Math.round(x)) : String(Math.round(x * 10) / 10));
const pct = (x: number) => Math.round(x * 1000) / 10;

export function ConfusionCard({ pairs }: { pairs: ConfusionPair[] }) {
  const { byId, bank } = useData();
  const sealed = new Set(bank?.sealed ?? []);
  const base = pairs[0]?.base ?? 0;
  const drillIds = (p: ConfusionPair) => p.ids.filter((id) => byId.has(id) && !sealed.has(id));
  return (
    <ChartCard
      title="🔀 Cặp hay nhầm"
      subtitle={
        pairs.length
          ? `Tỉ lệ chọn nhầm khi cả hai cùng xuất hiện · vạch = mức nhầm nền của bạn (${pct(base)}%)`
          : 'Service/khái niệm bạn hay chọn nhầm, đã so với số lần cặp đó cùng xuất hiện'
      }
      table={
        pairs.length
          ? {
              head: ['Chọn nhầm', 'Đáp án đúng', 'Lần chọn', 'Lần cùng xuất hiện', 'Tỉ lệ %', 'Cận dưới 80% %', 'Mức nền %', 'Số câu', 'Câu luyện'],
              rows: pairs.map((p) => [p.picked, p.correct, p.picks, p.exposures, pct(p.rate), pct(p.low), pct(p.base), p.questions, drillIds(p).length]),
            }
          : undefined
      }
    >
      {!pairs.length ? (
        <div className="small muted">
          Chưa có cặp nào được xác nhận. Một cặp chỉ hiện khi bạn chọn nhầm ≥ 4 lần trên ≥ 3 câu khác nhau và tỉ lệ nhầm cao rõ rệt (gấp hơn 2 lần mức nhầm nền của bạn) —
          thường cần vài tuần làm bài.
        </div>
      ) : (
        <div className="lrn-cf-list">
          {pairs.map((p) => {
            const ids = drillIds(p);
            return (
              <div key={`${p.picked}>${p.correct}`} className="lrn-cf-row">
                <div className="lrn-cf-text small">
                  Chọn <b>{p.picked}</b> khi đáp án là <b>{p.correct}</b>
                  <span className="muted">
                    {' '}
                    · <span className="num">{p.picks}/{p.exposures}</span> lần · {p.questions} câu
                  </span>
                  {p.merged?.length ? <div className="tiny muted">gộp cả: {p.merged.join(', ')}</div> : null}
                </div>
                <div className="lrn-cf-bar bar-track" role="img" aria-label={`Chọn nhầm ${pct(p.rate)}%, mức nền ${pct(p.base)}%`}>
                  <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, p.rate * 100))}%` }} />
                  <div className="bar-target" style={{ left: `${Math.max(0, Math.min(100, p.base * 100))}%` }} />
                </div>
                <div className="lrn-cf-val small num nowrap" title={`Cận dưới (80%) của tỉ lệ: ${pct(p.low)}%`}>
                  <b>{pct(p.rate)}%</b> <span className="muted">· gấp {fmtRatio(ratio(p))}×</span>
                </div>
                <div className="row nowrap lrn-cf-btn">
                <a className="btn ghost sm" href={href(pairHref(p.correct, p.picked))} title={`So sánh ${p.correct} và ${p.picked}: trích notes, tiến bộ của bạn, luyện phân biệt`}>
                  So sánh ⟷
                </a>
                <button
                  className="btn sm"
                  disabled={!ids.length}
                  title={`Luyện ${ids.length} câu có cả ${p.picked} và ${p.correct} trong các phương án (xen kẽ câu đáp án là mỗi bên)`}
                  onClick={() => void startTest({ mode: 'ids', ids, title: `Cặp hay nhầm: ${p.picked} ⟷ ${p.correct}`, feedback: 'practice' })}
                >
                  Luyện cặp này ({ids.length})
                </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}

// ── [μ v5] transfer: first try on a sibling vs repeats (anti-rote, Design C3) ──────────────────────

export function TransferCard({ t, passPct }: { t: TransferStats; passPct: number }) {
  const rows = [
    { key: 'transfer', label: '🧬 Câu anh em lần đầu', v: t.transfer, title: 'Lần đầu gặp một câu cùng cụm với câu bạn đã trả lời đúng — đo hiểu khái niệm' },
    { key: 'repeat', label: '🔁 Gặp lại đúng câu cũ', v: t.repeat, title: 'Trả lời lại chính câu đã gặp — có thể nhờ nhớ mặt chữ' },
  ];
  const g = rateGap(t.repeat, t.transfer);
  const topics = t.byTopic.filter((x) => x.transfer.answers > 0);
  return (
    <ChartCard
      title="🧬 Chuyển giao: hiểu khái niệm hay thuộc mặt chữ"
      subtitle={`${t.days} ngày gần đây · tỉ lệ đúng lần đầu gặp câu anh em so với gặp lại đúng câu cũ · vạch = ngưỡng đỗ ${passPct}%`}
      table={{
        head: ['Chủ đề', 'Anh em lần đầu', 'Đúng', 'Gặp lại', 'Đúng', 'Chênh (điểm)'],
        rows: [
          ...rows.map((r) => [r.label, r.v.answers, ratePct(r.v), '', '', '']),
          ...t.byTopic.map((x) => [x.label, x.transfer.answers, ratePct(x.transfer), x.repeat.answers, ratePct(x.repeat), x.gap ?? '']),
        ],
      }}
    >
      <BarList
        target={passPct}
        items={rows.map((r) => ({
          key: r.key,
          label: r.label,
          value: ratePct(r.v),
          muted: !r.v.answers,
          valueText: r.v.answers ? `${ratePct(r.v)}% · ${r.v.answers}` : 'chưa có',
          title: `${r.title}: ${r.v.correct}/${r.v.answers} đúng`,
        }))}
      />
      <div className="stack sm" style={{ marginTop: 10 }}>
        {!t.transfer.answers ? (
          <div className="small dim">
            Chưa gặp câu anh em nào sau khi đã trả lời đúng câu gốc. Khi ôn đến hạn, app thay câu đã thuộc bằng câu anh em chưa gặp (🧬) để đo điều này.
          </div>
        ) : g.verdict === 'higher' ? (
          <div className="small warn">
            ⚠ Gặp lại câu cũ cao hơn câu anh em {Math.round(g.diff)} điểm — một phần là nhớ mặt chữ. Ôn bằng câu anh em / câu tương phản thay vì làm lại đúng câu cũ.
          </div>
        ) : g.verdict === 'same' || g.verdict === 'lower' ? (
          <div className="small good">✓ Câu anh em lần đầu đúng ngang câu gặp lại — bạn đang hiểu khái niệm, không chỉ nhớ đáp án.</div>
        ) : (
          <div className="small dim">
            Câu anh em {ratePct(t.transfer)}% · gặp lại {ratePct(t.repeat)}% — {undecidedText(g.needMore)}.
          </div>
        )}
        {t.warnings.map((w) => (
          <div key={w} className="small warn">
            ⚠ {w}
          </div>
        ))}
        {topics.length > 0 && (
          <div className="tiny muted">
            Theo chủ đề:{' '}
            {topics.slice(0, 6).map((x, i) => (
              <span key={x.topic}>
                {i > 0 && ' · '}
                {x.label} {ratePct(x.transfer)}% ({x.transfer.answers}) vs {ratePct(x.repeat)}%
              </span>
            ))}
          </div>
        )}
      </div>
    </ChartCard>
  );
}
