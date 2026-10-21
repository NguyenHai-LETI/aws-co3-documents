// [v5] γ2 — AI Coach → "🪞 Song sinh & họ câu": start a `twins` run (paraphrase / contrast siblings of questions due soon)
// or a `family` run (qualifier families: same scenario + options, another final question). Both on demand only.
import { useState } from 'react';
import { useData } from '../../lib/store.tsx';
import { api } from '../../lib/api.ts';
import { Seg, toast } from '../ui.tsx';
import { REQUIREMENT_INFO } from '../../../shared/labels.ts';
import type { CoachRunInfo } from '../../../shared/types.ts';

const ASKS = ['cost', 'ops', 'resilient', 'performance', 'secure'] as const;

async function start(task: 'twins' | 'family', params: Record<string, unknown>): Promise<CoachRunInfo | undefined> {
  try {
    const r = await api.post<{ run: CoachRunInfo }>('/api/coach/run', { task, params });
    toast(task === 'twins' ? '🪞 Đã bắt đầu sinh câu song sinh — xem log ở trên.' : '🎯 Đã bắt đầu sinh họ câu — xem log ở trên.');
    return r.run;
  } catch (e) {
    toast(`Không chạy được: ${(e as Error).message}`);
    return undefined;
  }
}

export function AntiRotePanel({ disabled, candidates, perRun, onStarted }: { disabled: boolean; candidates?: number; perRun?: number; onStarted: (run: CoachRunInfo) => void }) {
  const { meta } = useData();
  const [count, setCount] = useState(perRun ?? 10);
  const [kind, setKind] = useState('auto');
  const [families, setFamilies] = useState(2);
  const [topic, setTopic] = useState('');
  const [task, setTask] = useState('');
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (t: 'twins' | 'family', params: Record<string, unknown>) => {
    setBusy(true);
    const run = await start(t, params);
    setBusy(false);
    if (run) onStarted(run);
  };
  return (
    <div className="grid c2">
      <div className="card stack">
        <h2>🪞 Câu song sinh (chống học vẹt)</h2>
        <div className="small dim ins-wrap">
          Với các câu bạn sắp ôn lại (đã làm ≥ 2 lần, đến hạn trong 7 ngày) mà chưa có câu anh em nào bạn chưa gặp, AI viết một câu cùng khái niệm:{' '}
          <b>diễn đạt lại</b> (bối cảnh, số liệu, câu chữ khác) hoặc <b>tương phản</b> (đổi một yêu cầu để đáp án đổi). Khi ôn, app hỏi bằng câu anh em này thay vì câu
          bạn đã thuộc mặt chữ. Mỗi câu qua kiểm tra định dạng, lint và giải mù như mọi câu AI.
        </div>
        <div className="small">
          {candidates === undefined ? '…' : candidates ? (
            <>
              <b>{candidates}</b> câu đang cần câu song sinh.
            </>
          ) : (
            'Chưa có câu nào cần — câu sắp ôn đều đã có câu anh em chưa gặp (hoặc bạn chưa ôn câu nào 2 lần).'
          )}
        </div>
        <div className="row">
          <label className="row small" style={{ gap: 6 }}>
            Số câu
            <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} style={{ width: 72 }} />
          </label>
          <Seg value={kind} onChange={setKind} items={[{ id: 'auto', label: 'Tự chọn' }, { id: 'surface', label: 'Diễn đạt lại' }, { id: 'contrast', label: 'Tương phản' }]} />
        </div>
        <div className="row">
          <button className="btn primary" disabled={disabled || busy || candidates === 0} onClick={() => go('twins', { count, ...(kind === 'auto' ? {} : { kind }) })}>
            ✨ Sinh {count} câu song sinh
          </button>
        </div>
        <div className="tiny muted">
          “Tự chọn”: câu bạn hay nhầm cùng một phương án → tương phản, còn lại → diễn đạt lại. Câu đang niêm phong không bao giờ được dùng làm câu gốc. Chạy theo lịch khi{' '}
          <code>coach.idle_tasks</code> có <code>twins</code>.
        </div>
      </div>
      <div className="card stack">
        <h2>🎯 Họ câu đổi yêu cầu</h2>
        <div className="small dim ins-wrap">
          Một tình huống dài + một bộ lựa chọn dùng chung, 2–4 câu hỏi cuối khác nhau (<i>MOST cost-effectively</i> / <i>LEAST operational overhead</i> / <i>MOST secure</i>…)
          — mỗi câu một đáp án khác. Luyện đúng kỹ năng đọc yêu cầu; dùng ở chế độ 🎯 Đọc yêu cầu.
        </div>
        <div className="grid c3">
          <label className="field">
            Chủ đề
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">Tự chọn</option>
              {meta?.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Task
            <select value={task} onChange={(e) => setTask(e.target.value)}>
              <option value="">Tự chọn</option>
              {(meta?.tasks ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} {t.label_vi ?? t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Yêu cầu phải có
            <select value={ask} onChange={(e) => setAsk(e.target.value)}>
              <option value="">Tự chọn</option>
              {ASKS.map((a) => (
                <option key={a} value={a}>
                  {REQUIREMENT_INFO[a]?.icon} {REQUIREMENT_INFO[a]?.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          <label className="row small" style={{ gap: 6 }}>
            Số họ
            <input type="number" min={1} max={5} value={families} onChange={(e) => setFamilies(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} style={{ width: 72 }} />
          </label>
          <button
            className="btn primary"
            disabled={disabled || busy}
            onClick={() => go('family', { count: families, ...(topic ? { topic } : {}), ...(task ? { task } : {}), ...(ask ? { requirement: ask } : {}) })}
          >
            ✨ Sinh {families} họ câu
          </button>
        </div>
        <div className="tiny muted">Mỗi câu trong họ được giải mù riêng; câu lệch đáp án chuyển nháp chờ bạn duyệt. Prompt: <code>trainer/coach/FAMILY.md</code>.</div>
      </div>
    </div>
  );
}
