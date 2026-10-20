// [β2] Stats cards for honest measurement (v4): first vs repeat exposure (memorisation gap, recognition), accuracy by
// what the stem asks for (requirement categories vs the "no requirement" baseline) and confirmed service confusions
// with a drill per pair. Single-hue bars with the pass mark (or the learner's base rate) as a hairline, a table twin
// on every chart (ChartCard), status colour only with an icon + text.
import { useData } from '../../lib/store.tsx';
import { navigate } from '../../lib/router.ts';
import { startTest } from '../../lib/start.ts';
import { BarList, ChartCard } from '../charts.tsx';
import { pctOf } from '../insights.tsx';
import { REQUIREMENTS, REQUIREMENT_INFO } from '../../../shared/labels.ts';
import type { Bucket, ConfusionPair, ExposureSplit } from '../../../shared/types.ts';

type Pair = { answers: number; correct: number };
const acc = (x: Pair) => pctOf(x.correct, x.answers);
const MIN_SPLIT = 10; // answers per side before comparing first vs repeat

// ── first vs repeat exposure ────────────────────────────────────────────────

export function ExposureCard({ e, passPct }: { e: ExposureSplit; passPct: number }) {
  const first = acc(e.first);
  const repeat = acc(e.repeat);
  const gap = Math.round(repeat - first);
  const enough = e.first.answers >= MIN_SPLIT && e.repeat.answers >= MIN_SPLIT;
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
        {!enough ? (
          <div className="small dim">Cần ≥ {MIN_SPLIT} câu mỗi nhóm trong {e.days} ngày để so sánh.</div>
        ) : gap >= 10 ? (
          <div className="small warn">
            ⚠ Câu gặp lại cao hơn câu mới <b>{gap} điểm</b> — một phần điểm đến từ việc nhớ câu. Đề thật toàn câu mới: ưu tiên câu chưa làm, câu dài và đề niêm phong để đo
            đúng.
          </div>
        ) : gap <= 3 ? (
          <div className="small good">✓ Câu mới và câu gặp lại gần như nhau — điểm phản ánh hiểu bài, không phải nhớ đáp án.</div>
        ) : (
          <div className="small dim">Câu gặp lại cao hơn câu mới {gap} điểm — bình thường khi đang ôn; theo dõi để khoảng cách không nới rộng.</div>
        )}
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
                <button
                  className="btn sm lrn-cf-btn"
                  disabled={!ids.length}
                  title={`Luyện ${ids.length} câu có cả ${p.picked} và ${p.correct} trong các phương án (xen kẽ câu đáp án là mỗi bên)`}
                  onClick={() => void startTest({ mode: 'ids', ids, title: `Cặp hay nhầm: ${p.picked} ⟷ ${p.correct}`, feedback: 'practice' })}
                >
                  Luyện cặp này ({ids.length})
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}
