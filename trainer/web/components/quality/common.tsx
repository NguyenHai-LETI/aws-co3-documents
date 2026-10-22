// Shared bits of the Bank → 📐 Chất lượng sections ([Q]): severity badges, question references and the AI actions
// (ENRICH with explicit ids, blind-solve runs, verdict decisions) — they degrade gracefully while the server lacks them.
import type { ReactNode } from 'react';
import { api, ApiError } from '../../lib/api.ts';
import { useData, useShared } from '../../lib/store.tsx';
import { InlineMarkdown, Markdown } from '../../lib/markdown.tsx';
import { toast } from '../ui.tsx';
import type { CoachRunInfo, LintSeverity, Question } from '../../../shared/types.ts';

export const SEVERITY: Record<LintSeverity, { icon: string; label: string; cls: string; title: string }> = {
  high: { icon: '❗', label: 'nặng', cls: 'bad', title: 'Câu hỏng hoặc lộ đáp án — patch AI làm phát sinh lỗi này bị từ chối' },
  medium: { icon: '⚠', label: 'vừa', cls: 'warn', title: 'Gợi ý giúp đoán mò, hoặc lỗi văn phong đề thi' },
  low: { icon: '·', label: 'nhẹ', cls: '', title: 'Việc bảo trì (ENRICH)' },
};

/** Severity as icon + label (never colour alone). */
export function SeverityBadge({ severity }: { severity: LintSeverity }) {
  const s = SEVERITY[severity];
  return (
    <span className={`badge ${s.cls}`} title={s.title}>
      {s.icon} {s.label}
    </span>
  );
}

interface CoachLite {
  status?: { running?: CoachRunInfo; lockedBy?: { pid: number; runId: string } };
  blocked?: string | null;
}

/** Can an AI action start now? Claude CLI found, no run in progress, coach not blocked (TRAINER_HOME guard). */
export function useAiReady(): { ready: boolean; why?: string; reload: () => void } {
  const { meta } = useData();
  const coach = useShared<CoachLite>('/api/coach');
  const running = !!(coach.data?.status?.running || coach.data?.status?.lockedBy);
  const why = !meta?.claude?.available
    ? 'Chưa tìm thấy Claude Code CLI — xem hướng dẫn ở trang AI Coach.'
    : running
      ? 'Đang có một lượt AI chạy — đợi xong rồi chạy tiếp.'
      : (coach.data?.blocked ?? undefined);
  return { ready: !why, why, reload: coach.reload };
}

const errorText = (e: unknown, what: string) =>
  e instanceof ApiError && e.status === 404 ? `Server chưa hỗ trợ ${what} (cần bản server mới).` : `Không chạy được: ${(e as Error).message}`;

/**
 * ENRICH exactly these questions (explicit ids bypass batch scoring) with the given todos ("distractors",
 * "explain,distractors"…); `note` (≤ 300 chars) is shown to the AI in the batch header — e.g. which lint flaw to fix.
 */
export async function startEnrich(ids: string[], tasks: string, note?: string): Promise<boolean> {
  try {
    await api.post<{ run: CoachRunInfo }>('/api/coach/run', { task: 'enrich', params: { ids, tasks, ...(note ? { note: note.slice(0, 300) } : {}) } });
    toast(`🧹 Đã bắt đầu ENRICH ${ids.length} câu — xem log ở AI Coach.`);
    return true;
  } catch (e) {
    toast(errorText(e, 'ENRICH theo danh sách câu'));
    return false;
  }
}

/**
 * Blind-solve by a second model: explicit ids, a pack, or a scope ('unverified-ai' | 'changed' | 'new' | …); `what` names
 * the kind of run in the toast ([v6] scope 'cues' = "dò" — the choices-only cue probe).
 */
export async function startVerify(params: { ids?: string[]; pack?: string; scope?: string }, label: string, what = 'giải mù'): Promise<boolean> {
  try {
    await api.post<{ run: CoachRunInfo }>('/api/verify/run', params);
    toast(`🔎 Đã bắt đầu ${what} ${label} — xem log ở AI Coach.`);
    return true;
  } catch (e) {
    toast(errorText(e, what));
    return false;
  }
}

/**
 * Learner decision on a blind-solve verdict: keep the key (approve) or retire the question. `hash` = the version that
 * was reviewed — the server answers 409 when the question changed since, and the queue has to be reloaded.
 */
export async function decideVerdict(qid: string, decision: 'approve' | 'retire', hash?: string): Promise<'ok' | 'stale' | 'error'> {
  try {
    await api.post('/api/verify/decision', { qid, decision, ...(hash ? { hash } : {}) });
    toast(decision === 'approve' ? `👍 Đã duyệt ${qid} — giữ đáp án hiện tại.` : `🗑️ Đã loại ${qid} (status: retired).`);
    return 'ok';
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      toast('Câu đã thay đổi — tải lại hàng chờ');
      return 'stale';
    }
    toast(errorText(e, 'duyệt kết quả giải mù'));
    return 'error';
  }
}

/** Question id (opens the drawer) + its stem, clamped to two lines (`full`: the whole stem, Markdown). */
export function QRef({ id, onOpen, extra, full }: { id: string; onOpen: (id: string) => void; extra?: ReactNode; full?: boolean }) {
  const { byId } = useData();
  const q = byId.get(id);
  return (
    <div className="qq-ref">
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="ins-linkish mono tiny" onClick={() => onOpen(id)} title="Mở câu hỏi">
          {id}
        </button>
        {extra}
      </div>
      {full && q ? <Markdown className="small qq-stem" text={q.stem} /> : <div className="small ins-clamp">{q?.stem ?? '(không còn trong ngân hàng)'}</div>}
    </div>
  );
}

/** One option as "B · text" (Markdown inline), optional marker badges. */
export function OptionLine({ q, k, children }: { q?: Question; k: string; children?: ReactNode }) {
  const text = q?.options.find((o) => o.key === k)?.text;
  return (
    <div className="qq-opt small">
      <span className="qq-key">{k}</span>
      <span className="qq-opt-text">{text ? <InlineMarkdown text={text} /> : <span className="muted">(không có phương án {k})</span>}</span>
      {children}
    </div>
  );
}

/** Option texts for a multi-key pick ("BD" → both lines). */
export function OptionLines({ q, keys, children }: { q?: Question; keys: string; children?: (k: string) => ReactNode }) {
  return (
    <>
      {[...keys].map((k) => (
        <OptionLine key={k} q={q} k={k}>
          {children?.(k)}
        </OptionLine>
      ))}
    </>
  );
}
