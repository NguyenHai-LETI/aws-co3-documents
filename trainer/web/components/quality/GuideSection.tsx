// [v5 γ1] Bank → 📐 Chất lượng → 🗺️ Đề cương: the official SAA-C03 exam guide (189 Knowledge / Skills bullets, verbatim —
// bank/exam-guide/SAA-C03.yaml) against the practice pool (GET /api/exam-guide): questions per bullet, exam-like (long)
// questions, the learner's first-answer accuracy, what is missing (≥ 2 exam-like per bullet, quality.longform_target_per_task
// per task, 20–30 % multiple-response, some "Choose THREE"). "✨ Sinh cho ô trống" starts an AI run aimed at the chosen
// bullets: POST /api/coach/run {task: generate | longform, params: {skills}} (γ2 honours params.skills; lint + blind-solve).
import { useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import { useFetch } from '../../lib/store.tsx';
import { href } from '../../lib/router.ts';
import { Chip, Spinner, toast } from '../ui.tsx';
import { useAiReady } from './common.tsx';
import type { CoachRunInfo, GuideBulletCoverage, GuideCoverage } from '../../../shared/types.ts';

const MAX_PICK = 10;
type View = 'gaps' | 'all';

const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);

/** Heat class of a bullet: no question · questions but no exam-like one · covered. */
function heat(b: GuideBulletCoverage): string {
  if (!b.questions) return 'gd-none';
  if (b.need) return 'gd-thin';
  return 'gd-ok';
}

function BulletRow({ b, picked, onPick }: { b: GuideBulletCoverage; picked: boolean; onPick: () => void }) {
  const acc = b.answers ? `${pct(b.correct ?? 0, b.answers)}% (${b.correct}/${b.answers})` : '—';
  return (
    <li className={`gd-bullet ${heat(b)}`}>
      <label className="gd-pick" title="Chọn để sinh câu cho mục này">
        <input type="checkbox" checked={picked} onChange={onPick} />
      </label>
      <div className="gd-text">
        <code className="gd-id">{b.id}</code> <span className={`badge ${b.kind === 'skill' ? 'accent' : ''}`}>{b.kind === 'skill' ? 'Skill' : 'Knowledge'}</span> {b.text}
      </div>
      <div className="gd-nums small">
        <a href={href(`/bank?skill=${encodeURIComponent(b.id)}`)} title="Xem các câu của mục này">
          {b.questions} câu
        </a>
        <span title="Câu chuẩn thi (đề dài) / mục tiêu 2">📜 {b.longForm}/2</span>
        <span title="Đúng ngay lần đầu gặp">🎯 {acc}</span>
      </div>
    </li>
  );
}

export function GuideSection() {
  const { data, error, loading } = useFetch<GuideCoverage>('/api/exam-guide');
  const ai = useAiReady();
  const [view, setView] = useState<View>('gaps');
  const [picked, setPicked] = useState<string[]>([]);
  const [task, setTask] = useState<'longform' | 'generate'>('generate');
  const [busy, setBusy] = useState(false);
  const byTask = useMemo(() => {
    const m = new Map<string, GuideBulletCoverage[]>();
    for (const b of data?.bullets ?? []) m.set(b.task, [...(m.get(b.task) ?? []), b]);
    return m;
  }, [data]);
  if (loading && !data) return <div className="empty">Đang tải đề cương…</div>;
  if (!data) return <div className="ins-wrap alert small">{error ? `Không tải được đề cương: ${error}` : 'Server chưa có đề cương (cần bản server mới).'}</div>;
  if (!data.bullets.length) return <div className="ins-wrap alert small">Chưa có file bank/exam-guide/SAA-C03.yaml.</div>;

  const covered = data.bullets.filter((b) => b.questions).length;
  const examLike = data.bullets.filter((b) => !b.need).length;
  const empty = data.bullets.filter((b) => !b.questions).map((b) => b.id);
  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_PICK ? p : [...p, id]));
  const multiOk = data.multi.share >= data.multi.target[0] && data.multi.share <= data.multi.target[1];

  const generate = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      await api.post<{ run: CoachRunInfo }>('/api/coach/run', { task, params: { skills: picked, count: Math.min(10, Math.max(picked.length * 2, 4)) } });
      toast(`✨ Đã bắt đầu ${task === 'longform' ? 'sinh câu dài' : 'sinh câu'} cho ${picked.length} mục đề cương — xem log ở AI Coach.`);
      setPicked([]);
    } catch (e) {
      toast(`Không chạy được: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="card stack sm">
        <div className="card-head">
          <h2>🗺️ Đề cương chính thức SAA-C03</h2>
          <span className="tiny muted">
            chép nguyên văn {data.fetched ? `ngày ${data.fetched}` : ''} ·{' '}
            {data.sources.slice(1, 5).map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noreferrer">
                D{i + 1}{' '}
              </a>
            ))}
          </span>
        </div>
        <div className="grid c4 gd-kpis">
          <div className="kpi">
            <div className="label">Mục có câu hỏi</div>
            <div className="value">
              {covered}/{data.bullets.length}
            </div>
            <div className="sub">{empty.length} mục chưa có câu nào</div>
          </div>
          <div className="kpi">
            <div className="label">Mục đủ ≥ 2 câu chuẩn thi</div>
            <div className="value">{examLike}</div>
            <div className="sub">câu dài (đề ≥ 55 từ) giống đề thật</div>
          </div>
          <div className="kpi">
            <div className="label">Câu nhiều đáp án</div>
            <div className="value">{Math.round(data.multi.share * 100)}%</div>
            <div className="sub">
              {multiOk ? '✓' : '⚠'} mục tiêu {data.multi.target[0] * 100}–{data.multi.target[1] * 100}% · Choose THREE: {data.chooseThree}
            </div>
          </div>
          <div className="kpi">
            <div className="label">Gắn mục bằng đoán từ khoá</div>
            <div className="value">{data.guessed}</div>
            <div className="sub">{data.untagged} câu chưa gắn mục nào · ENRICH classify ghi `skills:` cho chắc</div>
          </div>
        </div>
        <div className="tiny muted">
          Màu: <span className="gd-legend gd-none">chưa có câu</span> <span className="gd-legend gd-thin">có câu nhưng thiếu câu chuẩn thi</span>{' '}
          <span className="gd-legend gd-ok">đủ ≥ 2 câu chuẩn thi</span>. Câu niêm phong không được tính.
        </div>
      </div>

      <div className="card stack sm gd-gen">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <b>✨ Sinh cho ô trống</b>
          <span className="small dim">
            Đã chọn {picked.length}/{MAX_PICK} mục
          </span>
          <button className="btn ghost sm" onClick={() => setPicked(empty.slice(0, MAX_PICK))} disabled={!empty.length}>
            Chọn {Math.min(MAX_PICK, empty.length)} mục trống
          </button>
          {picked.length > 0 && (
            <button className="btn ghost sm" onClick={() => setPicked([])}>
              Bỏ chọn
            </button>
          )}
          <span className="spacer" />
          <select value={task} onChange={(e) => setTask(e.target.value as 'longform' | 'generate')} aria-label="Loại lượt AI">
            <option value="generate">Sinh câu mới (GENERATE)</option>
            <option value="longform">Câu dài chuẩn thi (longform)</option>
          </select>
          <button className="btn primary sm" disabled={!picked.length || busy || !ai.ready} title={ai.why} onClick={() => void generate()}>
            {busy ? <Spinner /> : '✨'} Sinh cho ô trống
          </button>
        </div>
        <div className="tiny muted ins-wrap gd-why">Lượt AI chạy khi bạn bấm (tốn quota) · câu mới qua lint + giải mù như mọi câu AI · {ai.why ?? 'sẵn sàng'}</div>
      </div>

      <div className="row qq-nav" role="group" aria-label="Hiển thị mục đề cương">
        <Chip on={view === 'gaps'} onClick={() => setView('gaps')}>
          Chỉ mục còn thiếu
        </Chip>
        <Chip on={view === 'all'} onClick={() => setView('all')}>
          Tất cả {data.bullets.length} mục
        </Chip>
      </div>

      {data.tasks.map((t) => {
        const rows = (byTask.get(t.id) ?? []).filter((b) => view === 'all' || b.need > 0);
        return (
          <details key={t.id} className="card gd-task" open={t.uncovered > 0}>
            <summary className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <b>Task {t.id}</b> <span className="gd-task-title">{t.title}</span>
              <span className="spacer" />
              <span className="small dim">
                {t.questions} câu · 📜 {t.longForm}/{t.target} câu dài · {t.multi} nhiều đáp án · {t.uncovered ? <b className="bad">{t.uncovered} mục trống</b> : 'đủ mục'}
              </span>
            </summary>
            {rows.length ? (
              <ul className="gd-list">
                {rows.map((b) => (
                  <BulletRow key={b.id} b={b} picked={picked.includes(b.id)} onPick={() => togglePick(b.id)} />
                ))}
              </ul>
            ) : (
              <div className="small muted">Mọi mục của task đã đủ câu chuẩn thi.</div>
            )}
          </details>
        );
      })}
    </div>
  );
}
