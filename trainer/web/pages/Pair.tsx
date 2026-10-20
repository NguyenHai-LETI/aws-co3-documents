// [μ v5] #/pair?a=SNS&b=SQS — one confusable pair (Design C4): comparison sections from the notes whose heading names both
// (GET /api/pairs/compare, Q-service-comparisons.md first), the learner's progress on the pair ("đã tách được" = ≥ 80 % over
// the last 10 contrast answers) and "🔀 Luyện phân biệt" (mode 'discriminate', the correct service alternating). Without
// a / b: the confusable groups of the bank (GET /api/pairs), the learner's own confusions first. Linked from Stats (cặp hay
// nhầm, câu dai dẳng), the Result page and the runner's feedback.
import { useFetch } from '../lib/store.tsx';
import { href } from '../lib/router.ts';
import { startTest } from '../lib/start.ts';
import { Markdown } from '../lib/markdown.tsx';
import { Empty, ErrorBox, Loading } from '../components/ui.tsx';
import { Meter } from '../components/charts.tsx';
import { pairHref, separationText } from '../components/learning/rules.ts';
import type { ConfusableGroup, PairCompare } from '../../shared/types.ts';

function GroupList({ groups, current }: { groups: ConfusableGroup[]; current?: [string, string] }) {
  const same = (x: { a: string; b: string }) => !!current && ((x.a === current[0] && x.b === current[1]) || (x.a === current[1] && x.b === current[0]));
  return (
    <div className="lrn-pair-groups">
      {groups.map((g) => (
        <div key={g.id} className="lrn-pair-group">
          <div className="row between">
            <b className="small">
              {g.confused ? '⚠ ' : ''}
              {g.services.join(' · ')}
            </b>
            <span className="tiny muted">{g.questions} câu</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {g.pairs.map((p) => (
              <a key={`${p.a}|${p.b}`} className={`chip ${same(p) ? 'on' : ''}`} href={href(pairHref(p.a, p.b))} title={`${p.n} câu có ${p.a} và ${p.b} cạnh tranh nhau${p.confused ? ' · bạn hay nhầm cặp này' : ''}`}>
                {p.confused ? '⚠ ' : ''}
                {p.a} ⟷ {p.b} <span className="n">{p.n}</span>
              </a>
            ))}
          </div>
          {g.learner && g.learner.answers > 0 && (
            <div className={`tiny ${g.learner.separated ? 'good' : 'muted'}`}>
              {g.learner.separated ? '✓ đã tách được' : `${g.learner.answers} câu đã làm · ${Math.round(g.learner.last10)}% trong 10 câu gần nhất`}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function Pair({ query }: { query: URLSearchParams }) {
  const a = (query.get('a') ?? '').trim();
  const b = (query.get('b') ?? '').trim();
  const has = !!a && !!b;
  const { data: cmp, error, loading } = useFetch<PairCompare>(has ? `/api/pairs/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}` : null, [a, b]);
  const { data: groups } = useFetch<ConfusableGroup[]>('/api/pairs');
  const list = Array.isArray(groups) ? [...groups].sort((x, y) => Number(!!y.confused) - Number(!!x.confused) || y.questions - x.questions) : [];

  if (!has) {
    return (
      <div className="lrn-pair">
        <div className="page-head">
          <div>
            <h1>🔀 Cặp dịch vụ hay nhầm</h1>
            <p>Các dịch vụ cùng xuất hiện ở đáp án và phương án nhiễu trong ngân hàng — chọn một cặp để xem bảng so sánh và luyện phân biệt.</p>
          </div>
        </div>
        {!groups ? (
          <Loading />
        ) : list.length ? (
          <div className="card">
            <GroupList groups={list} />
          </div>
        ) : (
          <Empty icon="🔀" title="Chưa có nhóm dịch vụ dễ nhầm nào" />
        )}
      </div>
    );
  }

  const sep = separationText(cmp?.progress);
  const others = list.filter((g) => g.services.includes(a) || g.services.includes(b));
  const p = cmp?.progress;
  return (
    <div className="lrn-pair">
      <div className="page-head">
        <div>
          <div className="small muted">
            <a href={href('/pair')}>← Các cặp hay nhầm</a> · <a href={href('/stats')}>Thống kê</a>
          </div>
          <h1 style={{ marginTop: 6 }}>
            🔀 {a} ⟷ {b}
          </h1>
        </div>
        <div className="row">
          <button
            className="btn primary"
            disabled={!!cmp && cmp.questions < 2}
            title={cmp && cmp.questions < 2 ? 'Ngân hàng chưa có đủ câu để luyện cặp này' : 'Câu có cả hai dịch vụ cạnh tranh nhau, đáp án luân phiên, xem đáp án ngay'}
            onClick={() => void startTest({ mode: 'discriminate', contrast: [a, b] })}
          >
            🔀 Luyện phân biệt{cmp ? ` (${cmp.questions} câu)` : ''}
          </button>
        </div>
      </div>
      <ErrorBox error={error} />
      {loading && !cmp ? (
        <Loading />
      ) : (
        <div className="split-r lrn-pair-grid">
          <div className="stack" style={{ minWidth: 0 }}>
            {cmp && cmp.excerpts.length > 0 ? (
              cmp.excerpts.map((x) => (
                <div key={`${x.file}#${x.anchor}`} className="card lrn-pair-excerpt">
                  <div className="row between" style={{ marginBottom: 4 }}>
                    {/^\s*#/.test(x.text) ? <span /> : <b className="small">{x.heading}</b>}
                    <a className="tiny" href={href(`/notes?f=${encodeURIComponent(x.file)}${x.anchor ? `&a=${encodeURIComponent(x.anchor)}` : ''}`)}>
                      📖 {x.file.split('/').pop()} →
                    </a>
                  </div>
                  <Markdown text={x.text} base={x.file.includes('/') ? x.file.slice(0, x.file.lastIndexOf('/') + 1) : ''} />
                </div>
              ))
            ) : (
              <div className="card small muted">Chưa tìm thấy mục nào trong tài liệu nhắc cả {a} và {b} — dùng ô tìm kiếm (/) để tra thêm.</div>
            )}
          </div>
          <div className="stack sticky-side">
            <div className="card stack sm">
              <b>Tiến bộ của bạn</b>
              {p && p.answers > 0 && <Meter value={p.last10} target={80} label="Tỉ lệ đúng 10 câu gần nhất (mốc 80%)" />}
              {p && p.answers >= 10 && (
                <div className="small dim">
                  {p.correct}/{p.answers} câu đúng · {Math.round(p.last10)}% trong 10 câu gần nhất (mốc 80%)
                </div>
              )}
              <div className={`small ${sep.cls}`}>{sep.text}</div>
              {cmp && (
                <div className="tiny muted">
                  {cmp.questions} câu luyện trong ngân hàng có {a} và {b} cạnh tranh nhau.
                </div>
              )}
            </div>
            {others.length > 0 && (
              <div className="card">
                <b className="small">Cùng nhóm</b>
                <GroupList groups={others} current={[a, b]} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
