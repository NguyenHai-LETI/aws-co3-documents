import { useMemo, useState } from 'react';
import { useData, useFetch } from '../lib/store.tsx';
import { api } from '../lib/api.ts';
import { href, navigate } from '../lib/router.ts';
import { startTest } from '../lib/start.ts';
import { fmtDateTime, fmtDuration } from '../lib/format.ts';
import { QuestionView } from '../components/QuestionView.tsx';
import { IssueDialog } from '../components/IssueDialog.tsx';
import { AskDialog } from '../components/AskDialog.tsx';
import { RatingButtons } from '../components/RatingButtons.tsx';
import { AttemptBadges, ColumnChart, KvRow, TaskBadge, pctOf } from '../components/insights.tsx';
import { BarList, ChartCard, Meter } from '../components/charts.tsx';
import { Empty, ErrorBox, Loading, Tabs, toast } from '../components/ui.tsx';
import { StartMap } from '../components/onboarding/StartMap.tsx';
import { freshSplit, isDiagnostic, isExamLike, noVerdict } from '../components/onboarding/rules.ts';
import { useStudyStart } from '../components/onboarding/useStudyStart.ts';
import { MODE_INFO, FEEDBACK_INFO } from '../../shared/labels.ts';
import { isCorrect, normalizeKeys } from '../../shared/scoring.ts';
import { REALISM_LOW_HINT, realismLow, realismText, realismTitle } from '../../shared/realism.ts';
import type { AnswerRecord, Attempt, AttemptSummary, BuildTestRequest, Question, ResultAnnotations } from '../../shared/types.ts';

type Filter = 'all' | 'wrong' | 'right' | 'flag' | 'slow' | 'pilot' | 'elim';

/** The learner struck out (one of) the correct option(s). */
const struckCorrect = (r: AnswerRecord) => !!r.elim && [...r.elim].some((k) => r.key.includes(k));
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/**
 * Item versioning: the result keeps the key the answer was graded with (`key`) and the question version (`h`).
 * keyChanged → statistics, readiness and the review schedule count this answer against the current key (`nowOk`);
 * edited → the question text/options changed since, the key did not.
 */
function versionOf(r: AnswerRecord, q: Question): { keyChanged: boolean; nowOk: boolean; edited: boolean } {
  const now = normalizeKeys(q.answer);
  const keyChanged = !!r.regraded || (!!r.key && normalizeKeys([...r.key].filter((c) => /[a-z]/i.test(c))) !== now);
  return { keyChanged, nowOk: isCorrect([...r.pick], q.answer), edited: !keyChanged && !!r.h && !!q.hash && r.h !== q.hash };
}

// ── stamina: accuracy + pace per quarter of an exam ─────────────────────────

interface Quarter {
  n: number;
  from: number;
  to: number;
  answers: number;
  correct: number;
  acc: number;
  avgT: number;
  avgEst: number;
}

function quarters(answers: AnswerRecord[]): Quarter[] {
  const n = answers.length;
  if (n < 12) return [];
  return [0, 1, 2, 3].map((i) => {
    const from = Math.round((i * n) / 4);
    const to = Math.round(((i + 1) * n) / 4);
    const part = answers.slice(from, to);
    const correct = part.filter((r) => r.ok).length;
    return { n: i + 1, from: from + 1, to, answers: part.length, correct, acc: pctOf(correct, part.length), avgT: Math.round(avg(part.map((r) => r.t))), avgEst: Math.round(avg(part.map((r) => r.est))) };
  });
}

function staminaNote(qs: Quarter[]): { cls: string; text: string } {
  const first = qs[0];
  const last = qs[qs.length - 1];
  const drop = Math.round(first.acc - last.acc);
  if (drop >= 15) return { cls: 'warn', text: `⚠ Độ chính xác giảm ${drop} điểm từ phần đầu tới phần cuối — dấu hiệu mệt/mất tập trung. Luyện thêm bài thi đủ 65 câu để tăng sức bền.` };
  if (first.avgT > 0 && last.avgT < first.avgT * 0.6)
    return { cls: 'warn', text: `⚠ Phần cuối bạn làm nhanh hơn hẳn (${first.avgT}s → ${last.avgT}s/câu) — có thể đang chạy đua với đồng hồ. Giữ nhịp ~2 phút/câu ngay từ đầu.` };
  if (drop <= -15) return { cls: '', text: `📈 Bạn làm tốt hơn về cuối (+${-drop} điểm) — có thể khởi động chậm; làm vài câu dễ trước để vào nhịp.` };
  return { cls: 'good', text: '✓ Độ chính xác khá đều giữa các phần — sức bền tốt.' };
}

function Stamina({ answers }: { answers: AnswerRecord[] }) {
  const qs = quarters(answers);
  if (!qs.length) return null;
  const note = staminaNote(qs);
  return (
    <ChartCard
      title="🔋 Sức bền theo từng phần bài"
      subtitle="Tỉ lệ đúng mỗi phần tư bài thi (theo thứ tự làm) · vạch ngang = ngưỡng đỗ 72%"
      table={{ head: ['Phần', 'Câu', 'Đúng', '%', 'TG TB (s)', 'Chuẩn (s)'], rows: qs.map((q) => [`Phần ${q.n}`, `${q.from}–${q.to}`, `${q.correct}/${q.answers}`, q.acc, q.avgT, q.avgEst]) }}
    >
      <ColumnChart
        target={72}
        targetLabel="72%"
        items={qs.map((q) => ({
          key: String(q.n),
          value: q.acc,
          valueText: `${Math.round(q.acc)}%`,
          ariaLabel: `Phần ${q.n}, câu ${q.from} đến ${q.to}: đúng ${q.acc}%, trung bình ${q.avgT} giây mỗi câu`,
          label: (
            <>
              <b>Phần {q.n}</b>
              <span className="tiny muted">
                câu {q.from}–{q.to}
              </span>
              <span className="tiny">⏱ {q.avgT}s/câu</span>
            </>
          ),
          detail: (
            <>
              <div className="tv">{q.acc}%</div>
              <div className="tl">
                Phần {q.n} · câu {q.from}–{q.to}
              </div>
              <div className="tl">
                {q.correct}/{q.answers} đúng · TB {q.avgT}s/câu (chuẩn {q.avgEst}s)
              </div>
            </>
          ),
        }))}
      />
      <div className={`small ${note.cls}`} style={{ marginTop: 10 }}>
        {note.text}
      </div>
    </ChartCard>
  );
}

/** Per-answer item-versioning note: re-graded against a fixed key, or only a light "edited since" hint. */
function VersionNote({ r, q, v }: { r: AnswerRecord; q: Question; v?: ReturnType<typeof versionOf> }) {
  if (v?.keyChanged) {
    const knownOldKey = !!r.key && normalizeKeys([...r.key]) !== normalizeKeys(q.answer);
    return (
      <div className="ins-wrap alert warn small" style={{ marginTop: 10 }}>
        ↻{' '}
        {knownOldKey ? (
          <>
            Đáp án lúc chấm là <b>{r.key}</b>, ngân hàng hiện tại là <b>{q.answer.join(', ')}</b> (câu đã được sửa sau bài này)
          </>
        ) : (
          'Đáp án của câu này đã được sửa sau bài làm'
        )}{' '}
        — thống kê, mức sẵn sàng và lịch ôn chấm lại câu này là <b>{v.nowOk ? 'đúng' : 'sai'}</b>
        {v.nowOk !== r.ok ? ` (lúc chấm: ${r.ok ? 'đúng' : 'sai'})` : ''}. File kết quả giữ nguyên.
      </div>
    );
  }
  if (v?.edited) {
    return (
      <div className="tiny muted" style={{ marginTop: 8 }} title={`Phiên bản lúc làm: ${r.h} · hiện tại: ${q.hash}`}>
        ✎ Câu đã được chỉnh sửa sau bài này (đề / phương án) — đáp án đúng không đổi.
      </div>
    );
  }
  return null;
}

// ── "why did you pick this?" note on wrong answers ────────────────────────

const WHY_CHIPS = ['Đọc sót từ khoá (NOT, LEAST, MOST…)', 'Nhầm giữa hai service', 'Chưa biết kiến thức này', 'Phương án sai nghe hợp lý hơn', 'Hiểu sai yêu cầu đề', 'Đoán vì hết giờ'];

function WhyNote({ attemptId, r, value, onSaved }: { attemptId: string; r: AnswerRecord; value?: string; onSaved: (why: string) => void }) {
  const [editing, setEditing] = useState(!value);
  const [text, setText] = useState(value ?? '');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  const save = async () => {
    const why = text.trim().slice(0, 500);
    if (why === (value ?? '')) return setEditing(!why);
    setBusy(true);
    try {
      await api.post(`/api/results/${encodeURIComponent(attemptId)}/why`, { q: r.q, why });
      onSaved(why);
      setEditing(!why);
      toast(why ? '📝 Đã lưu lý do — AI Coach sẽ đọc khi phân tích.' : 'Đã xoá ghi chú.');
    } catch (e) {
      toast(`Không lưu được ghi chú: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  if (value && !editing) {
    return (
      <div className="ins-why saved small">
        <span>
          📝 <b>Lý do bạn chọn {r.pick}:</b> {value}
        </span>
        <button
          className="btn ghost sm"
          onClick={() => {
            setText(value);
            setEditing(true);
          }}
        >
          Sửa
        </button>
      </div>
    );
  }
  return (
    <div className="ins-why small">
      <label htmlFor={`why-${r.q}`}>
        ✍️ Vì sao bạn chọn <b>{r.pick}</b>? <span className="muted">(tùy chọn — giúp AI Coach hiểu vì sao sai)</span>
      </label>
      <div className="row nowrap" style={{ gap: 8 }}>
        <input
          id={`why-${r.q}`}
          type="text"
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setActive(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
          }}
          placeholder="vd: tưởng Multi-AZ giúp tăng hiệu năng đọc"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button className="btn sm primary" disabled={busy || text.trim() === (value ?? '')} onClick={() => void save()} title={value && !text.trim() ? 'Xoá ghi chú' : undefined}>
          {value && !text.trim() ? 'Xoá' : 'Lưu'}
        </button>
        {value && (
          <button className="btn sm ghost" onClick={() => setEditing(false)}>
            Hủy
          </button>
        )}
      </div>
      {(active || text) && (
        <div className="row" style={{ gap: 6 }}>
          {WHY_CHIPS.map((c) => (
            <button key={c} type="button" className="chip" onMouseDown={(e) => e.preventDefault()} onClick={() => setText((t) => (t.trim() ? `${t.trim()}; ${c}` : c))}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────

export function ResultPage({ id }: { id: string }) {
  const { meta, topic } = useData();
  const { data, error, loading } = useFetch<{ attempt: Attempt; summary: AttemptSummary; questions: (Question | null)[]; annotations?: ResultAnnotations }>(
    id ? `/api/results/${encodeURIComponent(id)}` : null,
    [id],
  );
  const studyStart = useStudyStart();
  const [filter, setFilter] = useState<Filter>('all');
  const [issueFor, setIssueFor] = useState<string>();
  const [askFor, setAskFor] = useState<{ q: Question; pick?: string }>();
  const [why, setWhy] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    if (!data) return [];
    return data.attempt.answers.map((r, i) => ({ r, q: data.questions[i], n: i + 1 }));
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;
  if (!data || !meta) return null;
  const { attempt: a, summary } = data;
  const wrongIds = rows.filter((x) => !x.r.ok && x.q).map((x) => x.r.q);
  const isSlow = (r: AnswerRecord) => !!r.est && r.t > r.est * 1.5;
  const tests: Record<Filter, (r: AnswerRecord) => boolean> = {
    all: () => true,
    wrong: (r) => !r.ok,
    right: (r) => r.ok,
    flag: (r) => !!(r.flag || r.unsure),
    slow: isSlow,
    pilot: (r) => r.scored === false,
    elim: struckCorrect,
  };
  const count = (f: Filter) => rows.filter((x) => tests[f](x.r)).length;
  const shown = rows.filter(({ r }) => tests[filter](r));
  const ans = a.answers;
  const avgT = Math.round(avg(ans.map((r) => r.t)));
  const avgEst = Math.round(avg(ans.map((r) => r.est)));
  const blank = ans.filter((r) => !r.pick).length;
  const pilots = a.pilotTotal ?? ans.filter((r) => r.scored === false).length;
  const pilotCorrect = a.pilotCorrect ?? ans.filter((r) => r.scored === false && r.ok).length;
  const elimWrong = ans.filter(struckCorrect).length;
  const hinted = ans.filter((r) => r.hinted);
  const recall = ans.filter((r) => r.recall);
  const unsure = ans.filter((r) => r.unsure);
  // answers graded against a key that has been fixed since: how the statistics count them now
  const versions = rows.map(({ r, q }) => (q ? versionOf(r, q) : undefined));
  const okNow = (i: number) => (versions[i]?.keyChanged ? versions[i]!.nowOk : rows[i].r.ok);
  const whyCount = ans.filter((r, i) => !okNow(i) && (why[r.q] ?? r.why)).length;
  const wrongPicked = ans.filter((r, i) => !okNow(i) && r.pick).length;
  const showStamina = (a.mode === 'exam' || a.pearson) && ans.length >= 20;
  const regraded = rows.filter((_, i) => versions[i]?.keyChanged).length;
  const flipped = rows.filter(({ r }, i) => versions[i]?.keyChanged && okNow(i) !== r.ok).length;
  const scoredNowCorrect = rows.filter(({ r }, i) => r.scored !== false && okNow(i)).length;
  // v4: never-viewed answers (no pick, no time), recognition, first vs repeat exposure, realism, verdict rules
  const ann = data.annotations;
  const unviewed = new Set(ann?.unviewed ?? ans.filter((r) => !r.pick && !r.t).map((r) => r.q));
  const recognized = new Set(ann?.recognized ?? []);
  const diag = isDiagnostic(a);
  // "điểm trên câu mới" only for the sitting results/sealed.md records for its form (the first submit); another sitting
  // of a sealed form (a second session, or one opened early with "Mở sớm") is a retake of known questions
  const sealedForm = ann?.sealedOfficial;
  const sealedRetake = a.mode === 'sealed' && !sealedForm;
  const fresh = (a.mode === 'exam' || a.pearson) && !sealedForm && !a.rushed ? freshSplit(a, ann) : undefined;
  const freshPct = fresh?.answers ? Math.round((fresh.correct / fresh.answers) * 1000) / 10 : undefined;
  const realism = isExamLike(a) ? a.realism : undefined;
  const lowRealism = realismLow(realism);
  const nv = noVerdict(a, studyStart);

  const retry = (ids: string[], title: string) => startTest({ mode: 'ids', ids, title, feedback: 'practice', timing: { preset: 'standard' }, shuffleOptions: true });
  const again = () => {
    const sel = (a.selection ?? {}) as BuildTestRequest;
    if (a.mode === 'ids' || a.mode === 'coach' || a.mode === 'pack') {
      void startTest({ mode: 'ids', ids: ans.map((r) => r.q), title: `Làm lại: ${a.title}`, feedback: a.feedback, timing: { preset: 'standard' } });
    } else void startTest({ ...sel, mode: a.mode, count: ans.length });
  };

  const tabItems: { id: Filter; label: string }[] = [
    { id: 'all', label: `Tất cả (${rows.length})` },
    { id: 'wrong', label: `❌ Sai (${count('wrong')})` },
    { id: 'right', label: `✅ Đúng (${count('right')})` },
    { id: 'flag', label: `🚩 Cờ / chưa chắc (${count('flag')})` },
    { id: 'slow', label: `🐢 Chậm (${count('slow')})` },
  ];
  if (pilots) tabItems.push({ id: 'pilot', label: `🧪 Thử nghiệm (${count('pilot')})` });
  if (elimWrong) tabItems.push({ id: 'elim', label: `✂️ Loại nhầm (${elimWrong})` });

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="small muted">
            <a href={href('/history')}>← Lịch sử</a> · {MODE_INFO[a.mode]?.icon} {MODE_INFO[a.mode]?.label} · {FEEDBACK_INFO[a.feedback]?.label} · {fmtDateTime(a.finished)}
          </div>
          <h1 className="row" style={{ marginTop: 6, gap: 10 }}>
            <span>{a.title}</span>
            <AttemptBadges a={a} />
            {sealedForm && (
              <span className="badge accent" title={`Đề niêm phong ${sealedForm}: câu chưa từng xuất hiện khi luyện tập`}>
                🔒 điểm trên câu mới
              </span>
            )}
            {sealedRetake && (
              <span className="badge" title="Làm lại câu của một đề niêm phong đã làm hoặc đã mở sớm — không tính là điểm trên câu mới">
                🔁 làm lại đề niêm phong
              </span>
            )}
            {realism && (
              <span className={`badge ${lowRealism ? 'warn' : ''}`} title={realismTitle(realism, meta)}>
                {lowRealism ? '⚠' : '📜'} {realismText(realism)}
              </span>
            )}
          </h1>
        </div>
        <div className="row">
          {wrongIds.length > 0 && (
            <button className={`btn ${diag ? '' : 'primary'}`} onClick={() => retry(wrongIds, `Làm lại ${wrongIds.length} câu sai — ${a.title}`)}>
              🔁 Làm lại {wrongIds.length} câu sai
            </button>
          )}
          {sealedForm || sealedRetake ? (
            <button className="btn" onClick={() => navigate('/new?mode=exam')} title="Đề niêm phong chỉ làm một lần — thi thử Pearson trên ngân hàng thường">
              🎯 Thi thử khác
            </button>
          ) : (
            !diag && (
              <button className="btn" onClick={again}>
                ↻ Làm bài tương tự
              </button>
            )
          )}
          <a className="btn ghost" href={href(`/notes?f=${encodeURIComponent('trainer/' + a.file)}`)} title={a.file}>
            📄 File .md
          </a>
        </div>
      </div>

      {a.rushed && (
        <div className="ins-wrap alert warn" style={{ marginBottom: 16 }}>
          ⚡ <b>Bài làm vội</b> — thời gian trung vị {a.medianTime ?? '?'}s/câu, dưới ngưỡng tối thiểu nên <b>không được tính</b> vào thống kê, mức sẵn sàng và lịch ôn (file kết quả vẫn
          được lưu). Ngưỡng ở <code>trainer/config.yaml</code> → <code>stats.rushed_median_seconds</code>.
        </div>
      )}
      {sealedRetake && (
        <div className="ins-wrap alert" style={{ marginBottom: 16 }}>
          🔁 <b>Làm lại đề niêm phong — câu đã gặp, không tính là điểm trên câu mới.</b> Đề này đã được làm (hoặc mở sớm) trước bài này, nên điểm
          chỉ là một bài thi thử thường; điểm trên câu mới của đề là lần nộp đầu tiên.
        </div>
      )}
      {sealedForm && (
        <div className="ins-wrap alert info" style={{ marginBottom: 16 }}>
          🔒 <b>Đề niêm phong {sealedForm} — điểm trên câu mới.</b> {a.total} câu tính điểm chưa từng xuất hiện khi bạn luyện tập, nên đây là ước tính
          trung thực nhất về năng lực với câu mới như đề thật. Điểm này nằm trong <a href={href('/stats?focus=exam')}>danh sách điểm thi thử</a> như một điểm hiệu chỉnh nội
          bộ; các câu của đề nay đã trở lại ngân hàng luyện tập.
        </div>
      )}
      {unviewed.size > 0 && !a.rushed && (
        <div className="ins-wrap alert small" style={{ marginBottom: 16 }}>
          👁️ <b>{unviewed.size} câu chưa xem</b> — không tính vào lịch ôn/thống kê (trong điểm bài này vẫn tính là sai).
        </div>
      )}
      {diag && (
        <section style={{ marginBottom: 22 }}>
          <StartMap attempt={a} questions={data.questions} />
        </section>
      )}

      <section className="split-l">
        <div className="card stack">
          <div className="small muted">
            {sealedForm ? 'Điểm trên câu mới' : diag ? 'Điểm xuất phát' : 'Kết quả'}
            {a.pearson || sealedForm ? ' (chỉ câu tính điểm)' : ''}
          </div>
          <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
            <span className="hero-figure">{a.score}%</span>
            {!nv ? (
              <span className={`badge ${a.passed ? 'good' : 'bad'}`}>{a.passed ? '✓ Đạt' : '✗ Chưa đạt'}</span>
            ) : nv === 'diagnostic' ? (
              <span className="badge accent" title="Bài chẩn đoán đo điểm xuất phát theo từng mục exam guide — không xét đạt/chưa đạt">
                🧭 không xét đạt
              </span>
            ) : nv === 'first-week' ? (
              <span className="badge" title="Trong 7 ngày đầu học, bài ngắn (không phải thi thử) chỉ để làm quen — không xét đạt/chưa đạt">
                🌱 tuần đầu · không xét đạt
              </span>
            ) : null}
          </div>
          <Meter value={a.score} target={nv ? undefined : meta.exam.pass_pct} label="Điểm" />
          <div className="small dim">
            {a.correct}/{a.total} câu đúng
            {!nv && (
              <>
                {' '}
                · quy đổi <b>{a.scaled}</b>/1000 (đỗ ≥ {meta.exam.pass_scaled})
              </>
            )}
          </div>
          {nv === 'first-week' && <div className="tiny muted">Tuần đầu: bài ngắn để làm quen, chưa nói lên khả năng đỗ — điểm đạt/chưa đạt dành cho bài thi thử đủ dài.</div>}
          {fresh && fresh.total > 0 && (
            <div
              className={`small ${freshPct !== undefined && fresh.seenBefore * 2 >= fresh.total && a.score - freshPct >= 10 ? 'warn' : 'dim'}`}
              title="Câu đã gặp trước đây dễ đúng hơn nhờ nhớ — điểm phần câu mới gần với đề thật hơn"
            >
              🔁 Đã gặp <b className="num">{fresh.seenBefore}/{fresh.total}</b> câu
              {freshPct !== undefined ? (
                <>
                  {' '}
                  · điểm phần câu mới <b className="num">{freshPct}%</b>{' '}
                  <span className="muted">
                    ({fresh.correct}/{fresh.answers})
                  </span>
                </>
              ) : (
                ' · không có câu mới'
              )}
            </div>
          )}
          {lowRealism && <div className="small warn">⚠ {REALISM_LOW_HINT}</div>}
          {pilots > 0 && (
            <div className="ins-wrap alert info small">
              🧪 <b>
                {a.total} tính điểm + {pilots} thử nghiệm
              </b>{' '}
              — như đề thật, câu thử nghiệm không tính điểm và bạn không biết trước câu nào. Bạn đúng {pilotCorrect}/{pilots} câu thử nghiệm.
            </div>
          )}
          <div className="divider" style={{ margin: '4px 0' }} />
          <div className="stack sm small">
            <KvRow k="Thời gian làm">
              {fmtDuration(a.timeUsed)}
              {a.timeLimit ? ` / ${fmtDuration(a.timeLimit)}` : ''}
              {a.timedOut ? ' ⏰' : ''}
            </KvRow>
            <KvRow k="TB mỗi câu (bạn / chuẩn)">
              {avgT}s / {avgEst}s
            </KvRow>
            <KvRow k="Bỏ trống">
              {blank}
              {unviewed.size > 0 && <span className="muted" title="Không chọn, 0 giây — không tính vào lịch ôn/thống kê"> · {unviewed.size} chưa xem</span>}
            </KvRow>
            {unsure.length > 0 && (
              <KvRow k="🤔 Chưa chắc → đúng" title="Bạn đánh dấu “chưa chắc” — bao nhiêu câu trong số đó thực ra đúng">
                {unsure.filter((r) => r.ok).length}/{unsure.length}
              </KvRow>
            )}
            {hinted.length > 0 && (
              <KvRow k="💡 Dùng gợi ý → đúng">
                {hinted.filter((r) => r.ok).length}/{hinted.length}
              </KvRow>
            )}
            {recall.length > 0 && (
              <KvRow k="🧠 Nghĩ đúng trước khi xem lựa chọn" title="Recall-first: câu trả lời bạn tự nghĩ trùng ý với đáp án đúng">
                {recall.filter((r) => r.recallHit).length}/{recall.length}
              </KvRow>
            )}
            {elimWrong > 0 && (
              <KvRow k="✂️ Gạch nhầm đáp án đúng">
                <span className="bad">{elimWrong}</span>
              </KvRow>
            )}
            {wrongPicked > 0 && (
              <KvRow k="📝 Câu sai đã ghi lý do" title="Ghi “vì sao bạn chọn” để AI Coach hiểu lỗi sai">
                {whyCount}/{wrongPicked}
              </KvRow>
            )}
            {regraded > 0 && (
              <KvRow k="↻ Đáp án đã sửa" title="Đáp án của các câu này đã được sửa sau bài làm — thống kê, mức sẵn sàng và lịch ôn chấm lại theo đáp án hiện tại; file kết quả giữ nguyên">
                {regraded} câu{flipped ? ` · nay ${scoredNowCorrect}/${a.total} đúng` : ''}
              </KvRow>
            )}
            {a.plan && (
              <KvRow k="Kế hoạch AI">
                <a href={href('/coach')} className="mono tiny">
                  {a.plan}
                </a>
              </KvRow>
            )}
          </div>
        </div>

        <div className="grid c2">
          <div className="card">
            <h2>Theo domain</h2>
            <BarList
              target={meta.exam.pass_pct}
              items={meta.domains
                .filter((d) => summary.domains[d.id])
                .map((d) => {
                  const g = summary.domains[d.id];
                  const v = Math.round((g.correct / Math.max(1, g.total)) * 100);
                  return { key: d.id, label: `${d.code} ${d.label_vi}`, value: v, valueText: `${g.correct}/${g.total} · ${v}%` };
                })}
            />
          </div>
          <div className="card">
            <h2>Theo chủ đề</h2>
            <BarList
              target={meta.exam.pass_pct}
              items={Object.entries(summary.topics)
                .sort((x, y) => x[1].correct / Math.max(1, x[1].total) - y[1].correct / Math.max(1, y[1].total))
                .map(([k, g]) => {
                  const v = Math.round((g.correct / Math.max(1, g.total)) * 100);
                  const t = topic(k);
                  return {
                    key: k,
                    label: t ? `${t.icon} ${t.label}` : k,
                    value: v,
                    valueText: `${g.correct}/${g.total} · ${v}%`,
                    title: 'Bấm để luyện thêm chủ đề này',
                    onClick: () => navigate(`/new?mode=topic&topics=${k}`),
                  };
                })}
            />
          </div>
        </div>
      </section>

      {showStamina && (
        <section>
          <Stamina answers={ans} />
        </section>
      )}

      <section>
        <Tabs value={filter} onChange={setFilter} items={tabItems} />
        {shown.length === 0 && <Empty icon="🎉" title="Không có câu nào trong mục này" />}
        <div className="stack">
          {shown.map(({ r, q, n }) =>
            q ? (
              <div key={`${r.q}-${n}`} className="card" id={`q-${n}`}>
                <div className="row between ins-qhead">
                  <div className="row" style={{ gap: 6 }}>
                    <span className={`badge ${r.ok ? 'good' : 'bad'}`}>
                      {r.ok ? '✓' : '✗'} Câu {n}
                    </span>
                    {r.scored === false && (
                      <span className="badge accent" title="Câu thử nghiệm (unscored) — không tính vào điểm">
                        🧪 thử nghiệm
                      </span>
                    )}
                    {versions[n - 1]?.keyChanged && (
                      <span className="badge warn" title="Đáp án đã được sửa sau bài này — thống kê tính theo đáp án hiện tại">
                        ↻ chấm lại: {versions[n - 1]!.nowOk ? 'đúng' : 'sai'}
                      </span>
                    )}
                    {unviewed.has(r.q) && (
                      <span className="badge" title="Không chọn, 0 giây — không tính vào lịch ôn/thống kê (vẫn tính là sai trong điểm bài này)">
                        👁️ chưa xem
                      </span>
                    )}
                    {recognized.has(r.q) && (
                      <span className="badge" title="Gặp lại và trả lời đúng nhanh hơn thời gian đọc đề — có thể bạn nhận ra đáp án thay vì suy luận; lượt này không được chấm “Dễ” và chỉ tính nhẹ vào mức sẵn sàng">
                        ⚡ nhận diện
                      </span>
                    )}
                    {r.flag && <span className="badge warn">🚩 cờ</span>}
                    {r.unsure && <span className="badge warn">🤔 chưa chắc</span>}
                    {r.hinted && (
                      <span className="badge" title="Đã mở gợi ý khi làm câu này">
                        💡 đã xem gợi ý
                      </span>
                    )}
                    {struckCorrect(r) && (
                      <span className="badge bad" title={`Bạn đã gạch bỏ ${r.elim} — trong đó có đáp án đúng`}>
                        ✂️ loại nhầm đáp án đúng
                      </span>
                    )}
                    {r.recall && (
                      <span className={`badge ${r.recallHit ? 'good' : ''}`} title={`Bạn đã nghĩ: ${r.recall}`}>
                        🧠 {r.recallHit ? '✓ nghĩ đúng trước khi xem' : 'nghĩ chưa trúng'}
                      </span>
                    )}
                    <TaskBadge id={q.task} />
                    <span className={`small ${isSlow(r) ? 'warn' : 'muted'}`}>
                      ⏱ {r.t}s / chuẩn {r.est}s
                    </span>
                  </div>
                  <div className="row ins-qactions">
                    <RatingButtons qid={q.id} />
                    <button className="btn ghost sm" onClick={() => setAskFor({ q, pick: r.pick })} title="Hỏi Claude về câu này (lưu vào coach/qa/)">
                      🤖 Hỏi AI
                    </button>
                    <a className="btn ghost sm" href={href(`/bank?q=${encodeURIComponent(q.id)}`)}>
                      🗂️ Lịch sử
                    </a>
                    <button className="btn ghost sm" onClick={() => setIssueFor(q.id)}>
                      🐞 Báo lỗi
                    </button>
                  </div>
                </div>
                <QuestionView q={q} picked={[...r.pick]} reveal showMeta compact elim={r.elim ? [...r.elim] : []} recall={r.recall || undefined} />
                {((!okNow(n - 1) && !!r.pick) || !!(why[r.q] ?? r.why)) && (
                  <WhyNote attemptId={a.id} r={r} value={why[r.q] ?? r.why} onSaved={(w) => setWhy((x) => ({ ...x, [r.q]: w }))} />
                )}
                <VersionNote r={r} q={q} v={versions[n - 1]} />
              </div>
            ) : (
              <div key={`${r.q}-${n}`} className="card small muted">
                Câu {n}: <code>{r.q}</code> không còn trong ngân hàng (chọn {r.pick || '—'}, đáp án {r.key}).
              </div>
            ),
          )}
        </div>
      </section>
      <IssueDialog qid={issueFor} onClose={() => setIssueFor(undefined)} />
      <AskDialog q={askFor?.q} pick={askFor?.pick} onClose={() => setAskFor(undefined)} />
    </div>
  );
}
