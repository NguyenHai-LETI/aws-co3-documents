import { useEffect, useMemo, useState } from 'react';
import { useData, useFetch } from '../lib/store.tsx';
import { href, navigate } from '../lib/router.ts';
import { startTest } from '../lib/start.ts';
import { fmtDate, fmtDateTime, fmtRelative } from '../lib/format.ts';
import { QuestionMeta, QuestionView } from '../components/QuestionView.tsx';
import { IssueDialog } from '../components/IssueDialog.tsx';
import { AskDialog, QaHistory } from '../components/AskDialog.tsx';
import { RatingButtons, useRatings } from '../components/RatingButtons.tsx';
import { ChartCard } from '../components/charts.tsx';
import { ColumnChart, EnrichPanel, TaskBadge, pctOf } from '../components/insights.tsx';
import { Chip, Drawer, Empty, Modal, Tabs } from '../components/ui.tsx';
import { LintSection } from '../components/quality/LintSection.tsx';
import { DistractorSection } from '../components/quality/DistractorSection.tsx';
import { DuplicateSection } from '../components/quality/DuplicateSection.tsx';
import { VerifySection } from '../components/quality/VerifySection.tsx';
import { ScopeSection } from '../components/quality/ScopeSection.tsx';
import { QuestionQuality } from '../components/quality/QuestionQuality.tsx';
import { QuestionRelations } from '../components/quality/QuestionRelations.tsx';
import { GuideSection } from '../components/quality/GuideSection.tsx';
import { TierCard } from '../components/quality/TierCard.tsx';
import { startVerify, useAiReady } from '../components/quality/common.tsx';
import { TIERS, TIER_INFO, TierBadge, isTier, tierReason } from '../components/TierBadge.tsx';
import { applyFilters, isDueState, isMasteredState } from '../../shared/filters.ts';
import { tierOf } from '../../shared/tier.ts';
import { countWords } from '../../shared/timing.ts';
import type { BankQuality, DomainId, DuplicatePair, IssueItem, PackOrigin, Question, QuestionState, SelectionFilters, Tier } from '../../shared/types.ts';
import type { Meta } from '../lib/store.tsx';

type Tab = 'questions' | 'packs' | 'quality' | 'health' | 'issues';
const TABS: Tab[] = ['questions', 'packs', 'quality', 'health', 'issues'];
type QSec = 'overview' | 'lint' | 'distractors' | 'dups' | 'verify' | 'scope' | 'guide'; // sections of the 📐 Chất lượng tab (?sec=)
const QSECS: QSec[] = ['overview', 'lint', 'distractors', 'dups', 'verify', 'scope', 'guide'];
type Progress = '' | 'unseen' | 'wrong' | 'due' | 'mastered' | 'flagged';
type Feature = '' | 'long' | 'short' | 'hint' | 'nohint' | 'enriched' | 'notenriched' | 'notask' | 'shortexpl' | 'longest';
const FEATURES: { id: Feature; label: string }[] = [
  { id: '', label: 'Mọi đặc điểm' },
  { id: 'long', label: '📜 Câu dài (đề thật)' },
  { id: 'short', label: 'Câu ngắn' },
  { id: 'nohint', label: 'Chưa có gợi ý' },
  { id: 'hint', label: '💡 Có gợi ý' },
  { id: 'notenriched', label: 'Chưa ENRICH' },
  { id: 'enriched', label: '✨ Đã ENRICH' },
  { id: 'notask', label: 'Chưa gắn task' },
  { id: 'shortexpl', label: 'Giải thích ngắn (< 15 từ)' },
  { id: 'longest', label: 'Đáp án đúng dài nhất' },
];
const PAGE = 40;
const ORIGIN_LABEL: Record<PackOrigin, string> = { imported: '📚 Đề gốc', ai: '🤖 AI', doc: '📄 Tài liệu', manual: '✍️ Thủ công' };
const LEVEL_LABEL = ['mới', '< 1 ngày', '1–7 ngày', '7–21 ngày', '21–60 ngày', '≥ 60 ngày'];

/** A correct option is longer than every distractor by ≥ 15 % — a guessable tell (same rule as server/lib/lint.ts correctIsLongest). */
function correctLongest(q: Question): boolean {
  if (q.options.length < 3 || !q.answer.length) return false;
  const longest = (pick: (k: string) => boolean) => Math.max(0, ...q.options.filter((o) => pick(o.key)).map((o) => o.text.trim().length));
  const right = longest((k) => q.answer.includes(k));
  const other = longest((k) => !q.answer.includes(k));
  return other > 0 && right >= other * 1.15;
}

const FEATURE_TEST: Record<Exclude<Feature, ''>, (q: Question) => boolean> = {
  long: (q) => !!q.longForm,
  short: (q) => !q.longForm,
  hint: (q) => !!q.hint,
  nohint: (q) => !q.hint,
  enriched: (q) => !!q.enriched,
  notenriched: (q) => !q.enriched,
  notask: (q) => !q.task,
  shortexpl: (q) => countWords(q.explanation ?? '') < 15,
  longest: correctLongest,
};

/** Mastered = FSRS stability ≥ srs.mastered_stability_days (Leitner: box ≥ mastered_box) — same rule as the server. */
const mastered = (s: QuestionState | undefined, meta: Meta | undefined) => !!meta && isMasteredState(s, meta.srs);

function ProgressBadge({ s, meta }: { s?: QuestionState; meta?: Meta }) {
  if (!s) return <span className="badge">mới</span>;
  if (s.lastOk === false) return <span className="badge bad">✗ sai</span>;
  const done = mastered(s, meta);
  return (
    <span className={`badge ${done ? 'good' : 'accent'}`} title={`Mức ghi nhớ ${s.box} (${LEVEL_LABEL[s.box] ?? ''})${typeof s.stability === 'number' ? ` · độ bền ${s.stability.toFixed(1)} ngày` : ''}`}>
      {done ? '✓ ' : ''}mức {s.box}
    </span>
  );
}

/** [γ] A sealed question opened by id (link, issue list…): its content stays hidden until the form is taken or opened early. */
function SealedDrawer({ onClose }: { onClose: () => void }) {
  return (
    <Drawer open onClose={onClose}>
      <div className="stack">
        <div className="sc-locked stack sm">
          <div className="sc-lock-icon" aria-hidden="true">
            🔒
          </div>
          <b>Câu này đang niêm phong</b>
          <div className="small dim">
            Câu thuộc một đề niêm phong — được giữ kín (không luyện, không tìm kiếm, không xuất Anki) để điểm của đề đo năng lực trên câu bạn chưa từng gặp. Làm đề
            niêm phong hoặc “Mở sớm” ở trang Thống kê thì câu trở lại ngân hàng.
          </div>
          <div>
            <a className="btn sm" href={href('/stats')} onClick={onClose}>
              📊 Đến trang Thống kê
            </a>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function QuestionDrawer({ q, onClose, onIssue, onAsk }: { q: Question | undefined; onClose: () => void; onIssue: (id: string) => void; onAsk: (q: Question) => void }) {
  const { state, bank, meta, task } = useData();
  const [reveal, setReveal] = useState(false);
  useEffect(() => setReveal(false), [q?.id]);
  if (!q) return null;
  const sealed = new Set(bank?.sealed ?? []);
  if (sealed.has(q.id)) return <SealedDrawer onClose={onClose} />;
  const s = state?.states[q.id];
  const variants = (bank?.questions ?? []).filter((x) => x.variantOf.includes(q.id) && !sealed.has(x.id));
  const t = task(q.task);
  return (
    <Drawer open onClose={onClose}>
      <div className="stack">
        <QuestionView q={q} picked={[]} reveal={reveal} showMeta />
        {!reveal && (
          <div className="row">
            <button className="btn" onClick={() => setReveal(true)}>
              👁 Hiện đáp án & giải thích
            </button>
            {q.hint && (
              <details className="ins-hint">
                <summary>💡 Gợi ý</summary>
                <div className="small">{q.hint}</div>
              </details>
            )}
          </div>
        )}
        {reveal && q.hint && (
          <div className="small dim">
            💡 <b>Gợi ý:</b> {q.hint}
          </div>
        )}
        <div className="row">
          <button className="btn primary sm" onClick={() => startTest({ mode: 'ids', ids: [q.id, ...variants.map((v) => v.id)], title: `Luyện ${q.id}${variants.length ? ` + ${variants.length} biến thể` : ''}`, feedback: 'practice' })}>
            ▶ Luyện câu này{variants.length ? ` + ${variants.length} biến thể` : ''}
          </button>
          <button className="btn sm" onClick={() => onAsk(q)}>
            🤖 Hỏi AI
          </button>
          <button className="btn sm" onClick={() => onIssue(q.id)}>
            🐞 Báo lỗi
          </button>
          <span className="spacer" />
          <RatingButtons qid={q.id} />
        </div>
        <RatingNotes qid={q.id} />
        <div className="card flat stack sm small">
          <b>Lịch sử của bạn</b>
          {s ? (
            <>
              <div>
                Đã làm <b>{s.attempts}</b> lần · đúng {s.correct} · lần cuối {fmtDateTime(s.lastAt)} ({s.lastOk ? '✓ đúng' : '✗ sai'}
                {s.lastPick ? `, chọn ${s.lastPick}` : ''})
              </div>
              <div>
                Mức ghi nhớ <b>{s.box}</b> ({LEVEL_LABEL[s.box] ?? '—'}){mastered(s, meta) ? ' · ✓ đã thuộc' : ''}
                {s.dueAt ? ` · ôn lại ${isDueState(s) ? 'ngay (đến hạn)' : fmtRelative(s.dueAt)}` : ''} · TG trung bình {s.avgTime}s (chuẩn {q.time}s)
              </div>
              {typeof s.stability === 'number' && (
                <div className="muted">
                  FSRS: độ bền {s.stability.toFixed(1)} ngày
                  {typeof s.retrievability === 'number' ? ` · khả năng còn nhớ ${Math.round(s.retrievability * 100)}%` : ''}
                  {typeof s.fsrsDifficulty === 'number' ? ` · độ khó ${s.fsrsDifficulty.toFixed(1)}/10` : ''}
                  {s.lapses ? ` · quên ${s.lapses} lần` : ''}
                </div>
              )}
              {!!s.elimCorrect && <div className="bad">✂️ Đã {s.elimCorrect} lần gạch nhầm đáp án đúng</div>}
              {Object.keys(s.wrongPicks).length > 0 && (
                <div>
                  Đáp án sai hay chọn:{' '}
                  {Object.entries(s.wrongPicks)
                    .map(([k, n]) => `${k} ×${n}`)
                    .join(', ')}
                </div>
              )}
            </>
          ) : (
            <div className="muted">Chưa làm câu này.</div>
          )}
        </div>
        <QuestionQuality q={q} />
        <QuestionRelations q={q} />
        <div className="card flat stack sm small">
          <b>🤖 Hỏi đáp với AI</b>
          <QaHistory qid={q.id} empty="Chưa hỏi AI về câu này — bấm “🤖 Hỏi AI” ở trên." />
        </div>
        <div className="card flat stack sm small">
          <b>Metadata</b>
          <QuestionMeta q={q} extra={<TaskBadge id={q.task} />} />
          {t && (
            <div>
              Task {t.id}: {t.label_vi} <span className="muted">— {t.label}</span>
            </div>
          )}
          <div>Services: {q.services.join(', ') || '—'}</div>
          <div>Tags: {q.tags.join(', ') || '—'}</div>
          {q.concept && <div>Concept: {q.concept}</div>}
          <div>
            Đề {q.words ?? countWords(q.stem)} từ{q.longForm ? ' · 📜 câu dài (giống đề thật)' : ''} · gợi ý: {q.hint ? 'có' : 'chưa'} · ENRICH: {q.enriched ?? 'chưa'}
          </div>
          <div>🏷️ {tierReason(q, meta)}</div>
          {q.variantOf.some((v) => !sealed.has(v)) && (
            <div>
              Biến thể của:{' '}
              {q.variantOf.filter((v) => !sealed.has(v)).map((v) => (
                <a key={v} href={href(`/bank?q=${encodeURIComponent(v)}`)} style={{ marginRight: 8 }}>
                  <code>{v}</code>
                </a>
              ))}
            </div>
          )}
          {variants.length > 0 && (
            <div>
              Có {variants.length} biến thể:{' '}
              {variants.map((v) => (
                <a key={v.id} href={href(`/bank?q=${encodeURIComponent(v.id)}`)} style={{ marginRight: 8 }}>
                  <code>{v.id}</code>
                </a>
              ))}
            </div>
          )}
          <div>
            Pack: <code>{q.pack}</code> · trạng thái {q.status} · {q.timeEstimated ? `thời gian ước lượng tự động ${q.time}s` : `thời gian ${q.time}s`}
          </div>
          <div className="mono tiny ins-wrap">
            trainer/{q.file}:{q.line}
            {q.hash ? ` · hash ${q.hash}` : ''}
          </div>
          {q.source && <div className="tiny muted">Nguồn: {q.source}</div>}
          {q.created && <div className="tiny muted">Tạo: {q.created}</div>}
        </div>
      </div>
    </Drawer>
  );
}

function RatingNotes({ qid }: { qid: string }) {
  const { byQid } = useRatings();
  const agg = byQid.get(qid);
  if (!agg || (!agg.up && !agg.down)) return null;
  return (
    <div className="small dim">
      Đánh giá: 👍 {agg.up} · 👎 {agg.down} <span className="muted">(mỗi ngày tính 1 phiếu)</span>
      {agg.notes.length > 0 && (
        <ul className="ins-rate-notes">
          {agg.notes.slice(-5).map((r) => (
            <li key={`${r.line}-${r.date}-${r.note}`}>
              {r.value === 'up' ? '👍' : '👎'} <span className="muted">{r.date}</span> {r.note}
              {r.resolution && <span className="good"> → {r.resolution}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 📐 quality tab ─────────────────────────────────────────────────────────

function QTile({ label, value, sub, onClick, status }: { label: string; value: string | number; sub?: string; onClick?: () => void; status?: 'warn' | 'good' }) {
  const body = (
    <>
      <div className="label">{label}</div>
      <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
        <span className="value">{value}</span>
        {status === 'warn' ? <span className="badge warn">⚠ cần xử lý</span> : status === 'good' ? <span className="badge good">✓ tốt</span> : null}
      </div>
      {sub && <div className="sub">{sub}</div>}
    </>
  );
  return onClick ? (
    <button type="button" className="kpi ins-kpi-btn" onClick={onClick} title="Bấm để xem các câu này">
      {body}
    </button>
  ) : (
    <div className="kpi">{body}</div>
  );
}

function shareRows(letters: Record<string, number>) {
  const keys = Object.keys(letters).filter((k) => /^[A-H]$/.test(k)).sort();
  const total = keys.reduce((s, k) => s + (letters[k] ?? 0), 0);
  return { keys, total, share: (k: string) => pctOf(letters[k] ?? 0, total) };
}

function QualityTab({
  sec,
  onSec,
  rule,
  onRule,
  selected,
  onFeature,
  onTier,
  onOpenPair,
  onOpen,
  onIssue,
}: {
  sec: QSec;
  onSec: (s: QSec) => void;
  rule?: string;
  onRule: (code?: string) => void;
  selected: string[];
  onFeature: (f: Feature) => void;
  onTier: (tier: Tier, domain?: DomainId) => void;
  onOpenPair: (p: DuplicatePair) => void;
  onOpen: (id: string) => void;
  onIssue: (id: string) => void;
}) {
  const { meta } = useData();
  const { data: qd, error, status, loading, reload } = useFetch<BankQuality>('/api/quality');
  if (!meta) return null;
  if (loading && !qd) return <div className="empty">Đang tính chất lượng ngân hàng…</div>;
  if (!qd) {
    return (
      <div className="stack">
        <div className="ins-wrap alert small">{status === 404 ? 'Server chưa hỗ trợ báo cáo chất lượng (cần bản server mới).' : `Không tính được chất lượng ngân hàng${error ? `: ${error}` : ''}.`}</div>
        <div className="card">
          <EnrichPanel />
        </div>
      </div>
    );
  }
  const lintIssues = (qd.lint?.bySeverity?.high ?? 0) + (qd.lint?.bySeverity?.medium ?? 0);
  const nav: { id: QSec; label: string; count?: number }[] = [
    { id: 'overview', label: '📐 Tổng quan' },
    { id: 'lint', label: '🩺 Lỗi viết câu', count: qd.lint ? lintIssues : undefined },
    { id: 'distractors', label: '🎯 Phương án nhiễu', count: qd.distractors ? qd.distractors.weakDistractors.length + qd.distractors.suspectedKeys.length : undefined },
    { id: 'dups', label: '👯 Câu trùng', count: qd.duplicates.length },
    { id: 'verify', label: '🧪 Giải mù', count: qd.verification?.review },
    { id: 'scope', label: '🎯 Phạm vi đề thi', count: qd.scope ? qd.scope.answer.length + qd.scope.distractor.length : undefined },
    { id: 'guide', label: '🗺️ Đề cương' }, // [v5 γ1]
  ];
  return (
    <div className="stack">
      <div className="row qq-nav" role="group" aria-label="Mục chất lượng">
        {nav.map((n) => (
          <Chip key={n.id} on={sec === n.id} onClick={() => onSec(n.id)} count={n.count}>
            {n.label}
          </Chip>
        ))}
      </div>
      {sec === 'overview' && <QualityOverview qd={qd} onFeature={onFeature} onTier={onTier} onSec={onSec} />}
      {sec === 'lint' && <LintSection lint={qd.lint} rule={rule} onRule={onRule} onOpen={onOpen} />}
      {sec === 'distractors' && <DistractorSection report={qd.distractors} onOpen={onOpen} onIssue={onIssue} />}
      {sec === 'dups' && <DuplicateSection pairs={qd.duplicates} semantic={qd.semantic} onOpenPair={onOpenPair} onChanged={reload} />}
      {sec === 'verify' && <VerifySection summary={qd.verification} selected={selected} onOpen={onOpen} onIssue={onIssue} onChanged={reload} />}
      {sec === 'scope' && <ScopeSection report={qd.scope} onOpen={onOpen} onChanged={reload} />}
      {sec === 'guide' && <GuideSection />}
    </div>
  );
}

function QualityOverview({
  qd,
  onFeature,
  onTier,
  onSec,
}: {
  qd: BankQuality;
  onFeature: (f: Feature) => void;
  onTier: (tier: Tier, domain?: DomainId) => void;
  onSec: (s: QSec) => void;
}) {
  const { meta, byId } = useData();
  const { byQid } = useRatings();
  if (!meta) return null;
  const total = Math.max(1, qd.total);
  const { keys, total: singleTotal, share } = shareRows(qd.letters ?? {});
  const coreKeys = keys.filter((k) => 'ABCD'.includes(k));
  const target = Math.round(1000 / Math.max(1, coreKeys.length || keys.length)) / 10;
  const worst = keys.reduce<{ k: string; v: number } | undefined>((w, k) => (!w || share(k) > w.v ? { k, v: share(k) } : w), undefined);
  const skewed = !!worst && singleTotal >= 20 && worst.v > target + 10;
  const longestPct = pctOf(qd.correctLongest, total);
  const origins = Object.entries(qd.lettersByOrigin ?? {}).filter(([, l]) => Object.values(l).some((n) => n > 0));
  const ratingTotals = Object.values(qd.ratings ?? {}).reduce((acc, r) => ({ up: acc.up + r.up, down: acc.down + r.down }), { up: 0, down: 0 });
  const ve = qd.variantEffect ?? { originals: 0, fixedAfterVariant: 0, examples: [] };
  const minWords = meta.timing.long_form_min_words ?? 55;
  const sev = qd.lint?.bySeverity;
  const dr = qd.distractors;
  const vs = qd.verification;
  const sem = qd.semantic;
  const sc = qd.scope;
  const semantic = qd.duplicates.filter((d) => d.kind === 'semantic').length;

  return (
    <div className="stack">
      {!!qd.sealed && (
        <div className="small muted sc-sealed-note">
          🔒 {qd.sealed} câu đang niêm phong không được tính trong mọi số liệu và danh sách của mục Chất lượng.
        </div>
      )}
      <div className="ins-qkpis">
        <QTile
          label="📜 Câu dài (giống đề thật)"
          value={`${pctOf(qd.longForm, total)}%`}
          sub={`${qd.longForm}/${qd.total} câu có đề ≥ ${minWords} từ · trung vị ${qd.medianStemWords} từ (đề thật ~60–120)`}
          status={pctOf(qd.longForm, total) < 30 ? 'warn' : undefined}
          onClick={() => onFeature('long')}
        />
        <QTile
          label="Đáp án đúng dài nhất"
          value={`${longestPct}%`}
          sub={`${qd.correctLongest}/${qd.total} câu · dài hơn mọi phương án nhiễu ≥ 15% — dễ đoán theo độ dài`}
          status={longestPct > 30 ? 'warn' : undefined}
          onClick={() => onFeature('longest')}
        />
        <QTile label="Giải thích ngắn" value={qd.shortExplanations} sub="< 15 từ — cần ENRICH" status={qd.shortExplanations > total * 0.2 ? 'warn' : undefined} onClick={() => onFeature('shortexpl')} />
        <QTile label="💡 Có gợi ý" value={`${pctOf(qd.withHint, total)}%`} sub={`${qd.withHint}/${qd.total} câu`} onClick={() => onFeature('nohint')} />
        <QTile label="📋 Gắn task 1.1–4.4" value={`${pctOf(qd.withTask, total)}%`} sub={`${qd.withTask}/${qd.total} câu`} onClick={() => onFeature('notask')} />
        <QTile label="✨ Đã ENRICH" value={`${pctOf(qd.enriched, total)}%`} sub={`${qd.enriched}/${qd.total} câu`} onClick={() => onFeature('notenriched')} />
      </div>

      <div className="stack sm">
        <b className="small">Việc cần làm (bấm để xem chi tiết)</b>
        <div className="qq-todo">
          <QTile
            label="🩺 Lỗi viết câu"
            value={sev ? sev.high + sev.medium : '—'}
            sub={sev ? `câu có lỗi nặng/vừa · ${sev.high ? `❗ ${sev.high} câu lỗi nặng` : '✓ không có lỗi nặng'} · ${sev.low} câu chỉ lỗi nhẹ` : 'server chưa hỗ trợ'}
            status={sev ? (sev.high ? 'warn' : undefined) : undefined}
            onClick={() => onSec('lint')}
          />
          <QTile
            label="🎯 Phương án nhiễu"
            value={dr ? dr.weakDistractors.length : '—'}
            sub={dr ? `phương án quá dễ · ${dr.suspectedKeys.length} câu nghi sai đáp án` : 'server chưa hỗ trợ'}
            status={dr?.suspectedKeys.length ? 'warn' : undefined}
            onClick={() => onSec('distractors')}
          />
          <QTile
            label="👯 Câu gần trùng"
            value={qd.duplicates.length}
            sub={`${semantic} theo nghĩa · ${sem?.available ? `🧠 ${sem.model ?? 'Ollama'}` : sem?.provider === 'off' ? 'tìm theo nghĩa đang tắt' : 'chưa có Ollama — chỉ từ khoá'}`}
            onClick={() => onSec('dups')}
          />
          <QTile
            label="🧪 Giải mù"
            value={vs ? vs.review : '—'}
            sub={vs ? `chờ duyệt · ${vs.verified} câu đã kiểm · ${vs.ok} khớp${vs.cues?.cue ? ` · 🕵️ ${vs.cues.cue} câu lộ đáp án` : ''}` : 'server chưa hỗ trợ'}
            status={vs?.review ? 'warn' : undefined}
            onClick={() => onSec('verify')}
          />
          <QTile
            label="🎯 Phạm vi đề thi"
            value={sc ? sc.answer.length : '—'}
            sub={sc ? `câu có đáp án ngoài phạm vi · ${sc.distractor.length} câu có phương án nhiễu ngoài phạm vi` : 'server chưa hỗ trợ'}
            status={sc?.answer.length ? 'warn' : undefined}
            onClick={() => onSec('scope')}
          />
        </div>
      </div>

      <TierCard onTier={onTier} />

      <div className="grid c2">
        <ChartCard
          title="🔤 Vị trí đáp án đúng"
          subtitle={`${singleTotal} câu 1 đáp án · vạch = chia đều ${target}%`}
          table={{ head: ['Ký tự', 'Số câu', '%'], rows: keys.map((k) => [k, qd.letters[k] ?? 0, share(k)]) }}
        >
          {keys.length ? (
            <ColumnChart
              target={target}
              targetLabel={`${target}%`}
              max={Math.max(50, ...keys.map(share))}
              items={keys.map((k) => ({
                key: k,
                label: <b>{k}</b>,
                value: share(k),
                valueText: `${Math.round(share(k))}%`,
                ariaLabel: `Đáp án ${k}: ${qd.letters[k]} câu, ${share(k)}%`,
                detail: (
                  <>
                    <div className="tv">{share(k)}%</div>
                    <div className="tl">
                      Đáp án đúng là {k}: {qd.letters[k]} câu
                    </div>
                  </>
                ),
              }))}
            />
          ) : (
            <div className="small muted">Chưa có dữ liệu.</div>
          )}
          <div className={`small ${skewed ? 'warn' : 'good'}`} style={{ marginTop: 10 }}>
            {skewed
              ? (
                <>
                  ⚠ Đáp án đúng dồn vào {worst!.k} ({worst!.v}%) — dễ đoán theo vị trí. Chạy <code className="nowrap">npm run rebalance -- --apply</code> (khi làm bài, phương án vẫn
                  được xáo trộn mặc định).
                </>
              )
              : '✓ Vị trí đáp án đúng phân bố khá đều.'}
          </div>
          {origins.length > 1 && (
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="table ins-compact">
                <thead>
                  <tr>
                    <th>Nguồn</th>
                    {keys.map((k) => (
                      <th key={k} className="num">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {origins.map(([o, l]) => {
                    const sr = shareRows(l);
                    return (
                      <tr key={o}>
                        <td className="small nowrap">
                          {ORIGIN_LABEL[o as PackOrigin] ?? o} <span className="tiny muted">({sr.total})</span>
                        </td>
                        {keys.map((k) => {
                          const v = sr.share(k);
                          const hi = sr.total >= 20 && v > target + 10;
                          return (
                            <td key={k} className={`num small ${hi ? 'warn' : ''}`} title={`${l[k] ?? 0} câu`}>
                              {hi ? '▲ ' : ''}
                              {Math.round(v)}%
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        <div className="card stack sm">
          <h2>👍👎 Đánh giá & hiệu quả biến thể</h2>
          <div className="row ins-stat-row">
            <div>
              <div className="ins-stat">👍 {ratingTotals.up}</div>
              <div className="tiny muted">lượt khen</div>
            </div>
            <div>
              <div className="ins-stat">👎 {ratingTotals.down}</div>
              <div className="tiny muted">lượt chê</div>
            </div>
            <div>
              <div className="ins-stat">{Object.keys(qd.ratings ?? {}).length}</div>
              <div className="tiny muted">câu được đánh giá</div>
            </div>
          </div>
          <b className="small">Câu bị chê nhiều (👎 ≥ 2 và nhiều hơn 👍)</b>
          {qd.lowRated?.length ? (
            <div className="stack sm">
              {qd.lowRated.slice(0, 10).map((id) => {
                const r = qd.ratings[id] ?? { up: 0, down: 0 };
                const note = byQid.get(id)?.notes.filter((n) => n.value === 'down').slice(-1)[0]?.note;
                return (
                  <a key={id} href={href(`/bank?q=${encodeURIComponent(id)}`)} className="row nowrap small" style={{ color: 'inherit', gap: 8 }}>
                    <span className="badge bad num">👎 {r.down}</span>
                    <code>{id}</code>
                    <span className="muted ins-ellipsis">{note ?? byId.get(id)?.stem.slice(0, 120) ?? ''}</span>
                  </a>
                );
              })}
              <div className="tiny muted">AI Coach sửa hoặc loại (retired) các câu này ở lần phân tích tới.</div>
            </div>
          ) : (
            <div className="small muted">Chưa có câu nào bị chê nhiều. Bấm 👍/👎 ở màn hình kết quả để AI biết câu nào cần sửa.</div>
          )}
          <div className="divider" style={{ margin: '6px 0' }} />
          <b className="small">Câu biến thể có giúp không?</b>
          {ve.originals ? (
            <div className="small">
              <b className="num">
                {ve.fixedAfterVariant}/{ve.originals}
              </b>{' '}
              câu gốc từng sai → làm biến thể → sau đó làm đúng câu gốc ({pctOf(ve.fixedAfterVariant, ve.originals)}%).
              {ve.examples?.length > 0 && (
                <div className="row" style={{ gap: 6, marginTop: 6 }}>
                  {ve.examples.slice(0, 8).map((id) => (
                    <a key={id} className="badge mono" href={href(`/bank?q=${encodeURIComponent(id)}`)}>
                      {id}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="small muted">Chưa đủ dữ liệu: cần câu gốc đã sai, rồi làm câu biến thể, rồi gặp lại câu gốc.</div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>🧹 ENRICH — bảo trì ngân hàng bằng AI</h2>
        <EnrichPanel />
      </div>
    </div>
  );
}

function PairModal({ pair, onClose }: { pair?: DuplicatePair; onClose: () => void }) {
  const { byId } = useData();
  return (
    <Modal open={!!pair} onClose={onClose} wide title={pair ? `👯 Cặp gần trùng · giống ${Math.round(pair.score * 100)}%` : ''}>
      {pair && (
        <div className="stack">
          <div className="grid c2">
            {[pair.a, pair.b].map((id) => {
              const q = byId.get(id);
              return q ? (
                <div key={id} className="stack sm ins-pair">
                  <QuestionView q={q} picked={[]} showMeta={false} compact />
                  <div className="small">
                    Đáp án: <b>{q.answer.join(', ')}</b> · <code>{q.id}</code> · {ORIGIN_LABEL[q.origin]}
                  </div>
                  <a className="small" href={href(`/bank?q=${encodeURIComponent(id)}`)} onClick={onClose}>
                    Mở trong ngân hàng →
                  </a>
                </div>
              ) : (
                <div key={id} className="small muted">
                  <code>{id}</code> không còn trong ngân hàng.
                </div>
              );
            })}
          </div>
          <div className="small muted">Trùng thật? Bấm 👎 (lý do “Trùng với câu khác”) ở một câu để AI Coach gộp hoặc loại, hoặc đặt <code>- status: retired</code> trong file pack.</div>
        </div>
      )}
    </Modal>
  );
}

/** Selection bar: blind-solve the selected questions with the second model (max 60 per run). */
function VerifySelectedButton({ ids }: { ids: string[] }) {
  const ai = useAiReady();
  const [busy, setBusy] = useState(false);
  const n = Math.min(60, ids.length);
  return (
    <button
      className="btn sm"
      disabled={busy || !ai.ready}
      title={ai.why ?? 'Model thứ hai giải các câu này mà không xem đáp án (kết quả ở Chất lượng → 🧪 Giải mù)'}
      onClick={async () => {
        setBusy(true);
        if (await startVerify({ ids: ids.slice(0, 60) }, `${n} câu đang chọn`)) ai.reload();
        setBusy(false);
      }}
    >
      🔎 Giải mù {n} câu
    </button>
  );
}

// ── page ──────────────────────────────────────────────────────────────────

export function BankPage({ query }: { query: URLSearchParams }) {
  const { meta, bank, state, byId, task } = useData();
  const qTab = query.get('tab');
  const qFeature = query.get('feature');
  const qTask = query.get('task');
  const qSec = query.get('sec');
  const qRule = query.get('rule');
  const qLint = query.get('lint');
  const [tab, setTab] = useState<Tab>(() => (TABS.includes(qTab as Tab) ? (qTab as Tab) : qLint ? 'questions' : qSec || qRule ? 'quality' : 'questions'));
  const [qsec, setQsec] = useState<QSec>(() => (QSECS.includes(qSec as QSec) ? (qSec as QSec) : qRule ? 'lint' : 'overview'));
  const [rule, setRule] = useState<string | undefined>(qRule ?? undefined); // lint rule open in 🩺 Lỗi viết câu
  const [lintCode, setLintCode] = useState<string | undefined>(qLint ?? undefined); // question list filtered by a lint rule
  const qSkill = query.get('skill');
  const [skill, setSkill] = useState<string | undefined>(qSkill ?? undefined); // [v5 γ1] questions of one exam-guide bullet
  const qTier = query.get('tier')?.toUpperCase(); // [v6] ?tier=A
  const [filters, setFilters] = useState<SelectionFilters>(() => ({ ...(qTask ? { tasks: [qTask] } : {}), ...(isTier(qTier) ? { tiers: [qTier] } : {}) }));
  const [status, setStatus] = useState<'active' | 'draft' | 'retired' | 'all'>('active');
  const [progress, setProgress] = useState<Progress>('');
  const [feature, setFeature] = useState<Feature>(() => (FEATURES.some((f) => f.id === qFeature) ? (qFeature as Feature) : ''));
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [issueFor, setIssueFor] = useState<string>();
  const [askFor, setAskFor] = useState<Question>();
  const [pair, setPair] = useState<DuplicatePair>();
  const openId = query.get('q') ?? undefined;
  const { data: issues } = useFetch<IssueItem[]>(tab === 'issues' ? '/api/issues' : null, [tab]);

  // deep links: #/bank?tab=quality · ?feature=nohint · ?task=2.2 · ?sec=verify · ?rule=stem-echo · ?lint=stem-echo
  useEffect(() => {
    if (qTab && TABS.includes(qTab as Tab)) setTab(qTab as Tab);
  }, [qTab]);
  useEffect(() => {
    if (qSec && QSECS.includes(qSec as QSec)) {
      setQsec(qSec as QSec);
      setTab('quality');
    }
  }, [qSec]);
  useEffect(() => {
    if (qRule) {
      setRule(qRule);
      setQsec('lint');
      setTab('quality');
    }
  }, [qRule]);
  useEffect(() => {
    if (qLint) {
      setLintCode(qLint);
      setTab('questions');
    }
  }, [qLint]);
  const lintList = useFetch<{ rules: { code: string; label: string }[]; questions: { id: string }[] }>(lintCode ? `/api/quality/lint?code=${encodeURIComponent(lintCode)}&limit=2000` : null, [lintCode]);
  const lintIds = useMemo(() => (lintList.data ? new Set(lintList.data.questions.map((x) => x.id)) : undefined), [lintList.data]);
  const lintLabel = lintList.data?.rules.find((r) => r.code === lintCode)?.label ?? lintCode;
  useEffect(() => {
    if (qFeature && FEATURES.some((f) => f.id === qFeature)) {
      setFeature(qFeature as Feature);
      setTab('questions');
    }
  }, [qFeature]);
  useEffect(() => {
    if (qSkill) {
      setSkill(qSkill);
      setTab('questions');
    }
  }, [qSkill]);
  useEffect(() => {
    if (qTask) {
      setFilters((f) => ({ ...f, tasks: [qTask] }));
      setTab('questions');
    }
  }, [qTask]);
  useEffect(() => {
    if (isTier(qTier)) {
      setFilters((f) => ({ ...f, tiers: [qTier] }));
      setTab('questions');
    }
  }, [qTier]);

  const states = state?.states ?? {};
  // [γ] sealed questions are hidden from every list until their form is taken or opened early (only their count shows)
  const sealedSet = useMemo(() => new Set(bank?.sealed ?? []), [bank]);
  const list = useMemo(() => {
    let qs = (bank?.questions ?? []).filter((q) => !sealedSet.has(q.id));
    if (status !== 'all') qs = qs.filter((q) => q.status === status);
    qs = applyFilters(qs, { ...filters, tasks: undefined, tiers: undefined }); // tasks (supports "none") and tiers handled below
    const taskSel = filters.tasks ?? [];
    if (taskSel.length) qs = qs.filter((q) => (taskSel.includes('none') ? !q.task : !!q.task && taskSel.includes(q.task)));
    const tierSel = filters.tiers ?? [];
    if (tierSel.length) qs = qs.filter((q) => tierSel.includes(tierOf(q, meta))); // Question.tier, else the shared rule
    if (feature) qs = qs.filter(FEATURE_TEST[feature]);
    if (lintCode && lintIds) qs = qs.filter((q) => lintIds.has(q.id));
    if (skill) qs = qs.filter((q) => q.skills?.includes(skill));
    if (progress === 'unseen') qs = qs.filter((q) => !states[q.id]);
    if (progress === 'wrong') qs = qs.filter((q) => states[q.id]?.lastOk === false);
    if (progress === 'due') qs = qs.filter((q) => isDueState(states[q.id]));
    if (progress === 'mastered') qs = qs.filter((q) => mastered(states[q.id], meta));
    if (progress === 'flagged') qs = qs.filter((q) => states[q.id]?.lastFlag || states[q.id]?.lastUnsure);
    return qs;
  }, [bank, sealedSet, filters, status, progress, feature, states, meta, lintCode, lintIds, skill]);
  useEffect(() => setPage(0), [filters, status, progress, feature, lintCode, skill]);

  if (!meta || !bank) return null;
  const set = (patch: Partial<SelectionFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const pageItems = list.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.ceil(list.length / PAGE);
  const errors = bank.problems.filter((p) => p.level === 'error');
  const warnings = bank.problems.filter((p) => p.level === 'warning');
  const openIssues = (issues ?? []).filter((i) => i.open).length;
  const tasks = meta.tasks ?? [];
  const filtered = !!(
    filters.search ||
    filters.topics?.length ||
    filters.domains?.length ||
    filters.packs?.length ||
    filters.origins?.length ||
    filters.tasks?.length ||
    filters.tiers?.length ||
    feature ||
    progress ||
    lintCode ||
    skill ||
    status !== 'active'
  );
  // a question opened from the quality tab comes back to the same section when the drawer closes
  const qualityPath = () => `/bank?tab=quality&sec=${qsec}${qsec === 'lint' && rule ? `&rule=${encodeURIComponent(rule)}` : ''}`;
  const openFromQuality = (id: string) => navigate(`${qualityPath()}&q=${encodeURIComponent(id)}`);
  const goFeature = (f: Feature) => {
    setFeature(f);
    setTab('questions');
    window.scrollTo({ top: 0 });
  };
  // [v6] 🏷️ Tầng câu hỏi card → exactly the questions it counted (active, one tier, optionally one domain)
  const goTier = (t: Tier, d?: DomainId) => {
    setFilters({ tiers: [t], ...(d ? { domains: [d] } : {}) });
    setFeature('');
    setProgress('');
    setStatus('active');
    setLintCode(undefined);
    setSkill(undefined);
    setTab('questions');
    window.scrollTo({ top: 0 });
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>🗂️ Ngân hàng câu hỏi</h1>
          <p>
            {bank.questions.length} câu trong {bank.packs.length} pack · nguồn sự thật là các file Markdown trong <code>trainer/bank/packs/</code> (định dạng: <code>bank/SCHEMA.md</code>).
          </p>
          {sealedSet.size > 0 && (
            <p className="small sc-sealed-note">
              <a href={href('/stats')} className="badge" title="Đề niêm phong: câu chưa từng gặp, giữ riêng để đo điểm trên câu mới">
                🔒 {sealedSet.size} câu đang niêm phong
              </a>
              <span className="muted">ẩn khỏi danh sách, tìm kiếm và Anki cho tới khi bạn làm đề hoặc mở sớm (trang Thống kê).</span>
            </p>
          )}
        </div>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'questions', label: `Câu hỏi (${list.length})` },
          { id: 'packs', label: `Bộ đề (${bank.packs.length})` },
          { id: 'quality', label: '📐 Chất lượng' },
          { id: 'health', label: `Kiểm tra định dạng ${errors.length ? `❗${errors.length}` : '✓'}` },
          { id: 'issues', label: `Báo lỗi${meta.openIssues ? ` (${meta.openIssues} mở)` : ''}` },
        ]}
      />

      {tab === 'questions' && (
        <div className="stack">
          <div className="row ins-filters">
            <input type="search" placeholder="Tìm id, nội dung, service…" value={filters.search ?? ''} onChange={(e) => set({ search: e.target.value })} style={{ minWidth: 220, flex: 1 }} />
            <select value={filters.topics?.[0] ?? ''} onChange={(e) => set({ topics: e.target.value ? [e.target.value] : [] })}>
              <option value="">Mọi chủ đề</option>
              {meta.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
            <select value={filters.domains?.[0] ?? ''} onChange={(e) => set({ domains: e.target.value ? [e.target.value as never] : [] })}>
              <option value="">Mọi domain</option>
              {meta.domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} {d.label_vi}
                </option>
              ))}
            </select>
            {tasks.length > 0 && (
              <select value={filters.tasks?.[0] ?? ''} onChange={(e) => set({ tasks: e.target.value ? [e.target.value] : [] })} style={{ maxWidth: 230 }} aria-label="Task">
                <option value="">Mọi task</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} {t.label_vi.replace(/\s*\([^)]*\)\s*$/, '')}
                  </option>
                ))}
                <option value="none">— Chưa gắn task</option>
              </select>
            )}
            <select value={filters.packs?.[0] ?? ''} onChange={(e) => set({ packs: e.target.value ? [e.target.value] : [] })} style={{ maxWidth: 220 }}>
              <option value="">Mọi bộ đề</option>
              {bank.packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <select value={filters.origins?.[0] ?? ''} onChange={(e) => set({ origins: e.target.value ? [e.target.value as PackOrigin] : [] })}>
              <option value="">Mọi nguồn</option>
              {Object.entries(ORIGIN_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select value={filters.tiers?.[0] ?? ''} onChange={(e) => set({ tiers: isTier(e.target.value) ? [e.target.value] : [] })} aria-label="Tầng câu hỏi" title="A giống đề thật · B tình huống ngắn · C câu ôn nhanh">
              <option value="">Mọi tầng</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  🏷️ {TIER_INFO[t].label} — {TIER_INFO[t].short}
                </option>
              ))}
            </select>
            <select value={feature} onChange={(e) => setFeature(e.target.value as Feature)} aria-label="Đặc điểm">
              {FEATURES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <select value={progress} onChange={(e) => setProgress(e.target.value as Progress)}>
              <option value="">Mọi tiến độ</option>
              <option value="unseen">Chưa làm</option>
              <option value="wrong">Đang sai</option>
              <option value="due">Đến hạn ôn</option>
              <option value="flagged">Cờ / chưa chắc</option>
              <option value="mastered">Đã thuộc</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="retired">Retired</option>
              <option value="all">Tất cả trạng thái</option>
            </select>
            {lintCode && (
              <button type="button" className="chip on" onClick={() => setLintCode(undefined)} title="Bỏ lọc theo lỗi viết câu">
                🩺 {lintLabel}
                {lintList.loading && !lintIds ? ' …' : ''} ✕
              </button>
            )}
            {skill && (
              <button type="button" className="chip on" onClick={() => setSkill(undefined)} title="Bỏ lọc theo mục đề cương">
                🗺️ {skill} ✕
              </button>
            )}
            {filtered && (
              <button
                className="btn ghost sm"
                onClick={() => {
                  setSkill(undefined);
                  setFilters({});
                  setFeature('');
                  setProgress('');
                  setStatus('active');
                  setLintCode(undefined);
                }}
              >
                ✕ Bỏ lọc
              </button>
            )}
          </div>
          {selected.length > 0 && (
            <div className="ins-wrap alert info row between">
              <span>
                Đã chọn <b>{selected.length}</b> câu
              </span>
              <div className="row">
                <button className="btn sm" onClick={() => setSelected([])}>
                  Bỏ chọn
                </button>
                <VerifySelectedButton ids={selected} />
                <button className="btn primary sm" onClick={() => startTest({ mode: 'ids', ids: selected, title: `Bộ chọn tay (${selected.length} câu)` })}>
                  ▶ Tạo test từ {selected.length} câu
                </button>
              </div>
            </div>
          )}
          <div className="card" style={{ padding: 6 }}>
            {!pageItems.length ? (
              <Empty icon="🔎" title="Không có câu nào khớp bộ lọc" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>
                        <input
                          type="checkbox"
                          aria-label="Chọn cả trang"
                          checked={pageItems.every((q) => selected.includes(q.id))}
                          onChange={(e) => setSelected((s) => (e.target.checked ? [...new Set([...s, ...pageItems.map((q) => q.id)])] : s.filter((id) => !pageItems.some((q) => q.id === id))))}
                        />
                      </th>
                      <th>Câu hỏi</th>
                      <th>Chủ đề</th>
                      <th className="num">⏱</th>
                      <th>Tiến độ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((q) => {
                      const s = states[q.id];
                      const t = meta.topics.find((x) => x.id === q.topic);
                      return (
                        <tr key={q.id} className="click" onClick={() => navigate(`/bank?q=${encodeURIComponent(q.id)}`)}>
                          <td onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.includes(q.id)} onChange={() => setSelected((sel) => (sel.includes(q.id) ? sel.filter((x) => x !== q.id) : [...sel, q.id]))} />
                          </td>
                          <td>
                            <div className="tiny muted mono row" style={{ gap: 4 }}>
                              <span>{q.id}</span>
                              {q.origin !== 'imported' && <span className="badge accent">{ORIGIN_LABEL[q.origin]}</span>}
                              {q.task && (
                                <span className="badge" title={task(q.task)?.label_vi}>
                                  📋 {q.task}
                                </span>
                              )}
                              <TierBadge q={q} />
                              {q.longForm && (
                                <span className="badge" title="Câu dài, giống đề thật">
                                  📜
                                </span>
                              )}
                              {q.hint && (
                                <span className="badge" title="Có gợi ý">
                                  💡
                                </span>
                              )}
                            </div>
                            <div className="small ins-clamp">{q.stem}</div>
                          </td>
                          <td className="small nowrap">
                            {t?.icon} {t?.label ?? q.topic}
                          </td>
                          <td className="num small">{q.time}s</td>
                          <td className="nowrap">
                            <ProgressBadge s={s} meta={meta} /> {s && <span className="tiny muted">{s.correct}/{s.attempts}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {pages > 1 && (
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                ← Trước
              </button>
              <span className="small muted">
                Trang {page + 1}/{pages}
              </span>
              <button className="btn sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                Sau →
              </button>
            </div>
          )}
          {list.length > 0 && (filtered || pages > 1) && (
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn sm" onClick={() => startTest({ mode: 'ids', ids: list.slice(0, 200).map((q) => q.id), title: 'Bộ lọc ngân hàng', shuffleQuestions: true })}>
                ▶ Test với {Math.min(200, list.length)} câu đang lọc
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'packs' && (
        <div className="card" style={{ padding: 6 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Bộ đề</th>
                  <th>Nguồn</th>
                  <th className="num">Câu</th>
                  <th>Đã làm</th>
                  <th>Tạo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bank.packs.map((p) => {
                  const qs = bank.questions.filter((q) => q.pack === p.id);
                  const seen = qs.filter((q) => states[q.id]).length;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div>{p.title}</div>
                        <div className="tiny muted mono ins-wrap">trainer/{p.file}</div>
                      </td>
                      <td className="small nowrap">{ORIGIN_LABEL[p.origin]}</td>
                      <td className="num">{p.activeCount}</td>
                      <td className="small nowrap">
                        {seen}/{qs.length}
                      </td>
                      <td className="small nowrap">{p.created ? fmtDate(p.created) : '—'}</td>
                      <td className="nowrap">
                        <button className="btn sm" onClick={() => startTest({ mode: 'pack', filters: { packs: [p.id] } })}>
                          ▶ Làm
                        </button>{' '}
                        <a className="btn ghost sm" href={href(`/notes?f=${encodeURIComponent('trainer/' + p.file)}`)}>
                          📄
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'quality' && (
        <QualityTab
          sec={qsec}
          onSec={setQsec}
          rule={rule}
          onRule={setRule}
          selected={selected}
          onFeature={goFeature}
          onTier={goTier}
          onOpenPair={setPair}
          onOpen={openFromQuality}
          onIssue={setIssueFor}
        />
      )}

      {tab === 'health' && (
        <div className="stack">
          <div className={`alert ${errors.length ? 'bad' : 'good'}`}>
            {errors.length ? `❗ ${errors.length} lỗi — các câu lỗi bị bỏ qua (không xuất hiện trong test).` : '✓ Không có lỗi định dạng.'} {warnings.length} cảnh báo. Kiểm tra bằng lệnh <code>npm run validate -- --warnings</code>.
          </div>
          <div className="card" style={{ padding: 6 }}>
            {!bank.problems.length ? (
              <Empty icon="✅" title="Ngân hàng sạch" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mức</th>
                      <th>Vị trí</th>
                      <th>Vấn đề</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...errors, ...warnings].slice(0, 400).map((p, i) => (
                      <tr key={i}>
                        <td>{p.level === 'error' ? <span className="badge bad">lỗi</span> : <span className="badge warn">cảnh báo</span>}</td>
                        <td className="mono tiny ins-wrap">
                          {p.file}:{p.line}
                          {p.qid && byId.has(p.qid) ? (
                            <>
                              {' '}
                              <a href={href(`/bank?q=${encodeURIComponent(p.qid)}`)}>{p.qid}</a>
                            </>
                          ) : p.qid ? (
                            ` ${p.qid}`
                          ) : null}
                        </td>
                        <td className="small">{p.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'issues' && (
        <div className="stack">
          <div className="small muted">
            Báo lỗi từ màn hình kết quả được ghi vào <code>trainer/bank/issues.md</code>. AI Coach xử lý các mục đang mở ở lần phân tích kế tiếp ({openIssues} mở).
          </div>
          <div className="card" style={{ padding: 6 }}>
            {!issues?.length ? (
              <Empty icon="🐞" title="Chưa có báo lỗi nào" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Trạng thái</th>
                      <th>Ngày</th>
                      <th>Câu</th>
                      <th>Loại</th>
                      <th>Nội dung / xử lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map((i) => (
                      <tr key={i.line}>
                        <td>{i.open ? <span className="badge warn">mở</span> : <span className="badge good">đã xử lý</span>}</td>
                        <td className="small nowrap">{i.date}</td>
                        <td>
                          <a href={href(`/bank?q=${encodeURIComponent(i.qid)}`)} className="mono small">
                            {i.qid}
                          </a>
                        </td>
                        <td className="small">{i.type}</td>
                        <td className="small">
                          {i.note}
                          {i.resolution && <div className="good">→ {i.resolution}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <QuestionDrawer
        q={openId ? byId.get(openId) : undefined}
        onClose={() => navigate(tab === 'questions' ? '/bank' : tab === 'quality' ? qualityPath() : `/bank?tab=${tab}`, { replace: true })}
        onIssue={setIssueFor}
        onAsk={setAskFor}
      />
      <IssueDialog qid={issueFor} onClose={() => setIssueFor(undefined)} />
      <AskDialog q={askFor} onClose={() => setAskFor(undefined)} />
      <PairModal pair={pair} onClose={() => setPair(undefined)} />
    </div>
  );
}
