// Bank → 📐 Chất lượng → 🩺 Lỗi viết câu: deterministic item-writing flaws (server/lib/lint.ts) per rule, then the
// flagged questions of one rule (GET /api/quality/lint?code=…, uncapped), open a question, filter the question list,
// or let ENRICH fix the rules it has a todo for (explicit ids).
import { useEffect, useState } from 'react';
import { useFetch } from '../../lib/store.tsx';
import { navigate } from '../../lib/router.ts';
import { pctOf } from '../insights.tsx';
import { QRef, SeverityBadge, startEnrich, useAiReady } from './common.tsx';
import type { LintFlaw, LintSeverity, LintSummary } from '../../../shared/types.ts';

interface RuleInfo {
  code: string;
  severity: LintSeverity;
  label: string;
  fix: string;
}
interface LintList {
  code?: string;
  rules: RuleInfo[];
  total: number;
  questions: { id: string; flaws: LintFlaw[] }[];
}

/** Rules an ENRICH todo can repair (the batch gets exactly these ids). */
export const LINT_ENRICH: Record<string, { tasks: string; label: string }> = {
  'longest-correct': { tasks: 'balance', label: 'cân độ dài phương án' },
  'stem-echo': { tasks: 'distractors', label: 'viết lại phương án nhiễu' },
  'absolute-terms': { tasks: 'distractors', label: 'viết lại phương án nhiễu' },
  'overlapping-options': { tasks: 'distractors', label: 'viết lại phương án nhiễu' },
  'letter-ref': { tasks: 'explain', label: 'viết lại giải thích' },
  'short-explanation': { tasks: 'explain', label: 'viết lại giải thích' },
  'oos-distractor': { tasks: 'distractors', label: 'thay phương án nhiễu ngoài phạm vi' },
};
/** [γ] Rules handled in Bank → Chất lượng → 🎯 Phạm vi đề thi (retire / ENRICH with the out-of-scope services named). */
const SCOPE_RULES = new Set(['oos-answer', 'oos-distractor']);
const ENRICH_MAX = 20;
const PAGE = 25;

export function LintSection({ lint, rule, onRule, onOpen }: { lint?: LintSummary; rule?: string; onRule: (code?: string) => void; onOpen: (id: string) => void }) {
  const list = useFetch<LintList>(rule ? `/api/quality/lint?code=${encodeURIComponent(rule)}&limit=2000` : null, [rule]);
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const ai = useAiReady();
  useEffect(() => setShown(PAGE), [rule]);

  if (!lint) return <div className="ins-wrap alert small">Server chưa có kiểm tra lỗi viết câu (cần bản server mới).</div>;
  const rules = Object.entries(lint.byCode).map(([code, r]) => ({ code, ...r }));
  const info = list.data?.rules.find((r) => r.code === rule);
  const current = rules.find((r) => r.code === rule);
  const sev = lint.bySeverity ?? { high: 0, medium: 0, low: 0 };
  const enrich = rule ? LINT_ENRICH[rule] : undefined;
  const ids = list.data?.questions.map((x) => x.id) ?? [];

  const fix = async () => {
    if (!enrich) return;
    setBusy(true);
    const note = `Sửa lỗi viết câu “${current?.label ?? rule}” (lint ${rule}) mà npm run validate -- --lint báo ở từng câu. ${info?.fix ?? ''}`;
    if (await startEnrich(ids.slice(0, ENRICH_MAX), enrich.tasks, note)) ai.reload();
    setBusy(false);
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head qq-head">
          <h2>🩺 Lỗi viết câu hỏi</h2>
          <span className="small muted">
            {lint.checked} câu active · <code className="nowrap">npm run validate -- --lint</code>
          </span>
        </div>
        <div className="small dim" style={{ marginBottom: 10 }}>
          Kiểm tra tự động theo nguyên tắc viết câu trắc nghiệm (SCHEMA §6): câu hỏng hoặc có “mẹo” giúp đoán đáp án mà không cần kiến thức AWS. Patch AI làm phát sinh lỗi{' '}
          <b>nặng</b> mới bị từ chối; lỗi vừa/nhẹ chỉ cảnh báo.
        </div>
        <div className="row qq-sevrow">
          {(['high', 'medium', 'low'] as LintSeverity[]).map((s) => (
            <span key={s} className="small">
              <SeverityBadge severity={s} /> <b className="num">{sev[s]}</b> câu{s === 'low' ? ' chỉ có lỗi nhẹ' : ''}
            </span>
          ))}
        </div>
        <div className="qq-rules" role="list">
          {rules.map((r) => (
            <button
              key={r.code}
              type="button"
              role="listitem"
              className={`qq-rule ${rule === r.code ? 'on' : ''} ${r.count ? '' : 'zero'}`}
              onClick={() => onRule(rule === r.code ? undefined : r.code)}
              disabled={!r.count}
              aria-pressed={rule === r.code}
              title={r.count ? 'Xem các câu mắc lỗi này' : 'Không câu nào mắc lỗi này'}
            >
              <SeverityBadge severity={r.severity} />
              <span className="qq-rule-name">
                <span>{r.label}</span> <code className="tiny muted">{r.code}</code>
              </span>
              <span className="qq-rule-bar" aria-hidden="true">
                <span style={{ width: `${Math.min(100, pctOf(r.count, lint.checked))}%` }} />
              </span>
              <span className="qq-rule-n num">{r.count ? r.count : '✓ 0'}</span>
            </button>
          ))}
        </div>
      </div>

      {rule && current && (
        <div className="card" id="qq-lint-detail">
          <div className="card-head qq-head">
            <div>
              <h2>
                <SeverityBadge severity={current.severity} /> {current.label} <span className="muted num">({current.count})</span>
              </h2>
              {info && <div className="small dim" style={{ marginTop: 4 }}>💡 Cách sửa: {info.fix}</div>}
            </div>
            <button className="btn ghost sm" onClick={() => onRule(undefined)} aria-label="Đóng danh sách">
              ✕
            </button>
          </div>
          <div className="row" style={{ marginBottom: 10 }}>
            <button className="btn sm" onClick={() => navigate(`/bank?lint=${encodeURIComponent(rule)}`)}>
              ▶ Mở {current.count} câu trong tab Câu hỏi
            </button>
            {enrich && (
              <button className="btn sm" disabled={busy || !ai.ready || !ids.length} title={ai.why ?? `ENRICH “${enrich.tasks}” cho ${Math.min(ENRICH_MAX, ids.length)} câu đầu danh sách`} onClick={fix}>
                🧹 ENRICH {enrich.label} ({Math.min(ENRICH_MAX, ids.length)} câu đầu)
              </button>
            )}
            {SCOPE_RULES.has(rule) && (
              <button className="btn sm" onClick={() => navigate('/bank?tab=quality&sec=scope')}>
                🎯 Mở mục Phạm vi đề thi
              </button>
            )}
            {!enrich && !SCOPE_RULES.has(rule) && <span className="tiny muted">Lỗi này cần sửa tay trong file pack (hoặc 🐞 báo lỗi để AI Coach xử lý).</span>}
          </div>
          {list.loading && !list.data ? (
            <div className="small muted">Đang tải danh sách…</div>
          ) : list.error ? (
            <div className="ins-wrap alert warn small">Không tải được danh sách: {list.error}</div>
          ) : (
            <div className="qq-list">
              {(list.data?.questions ?? []).slice(0, shown).map((x) => {
                const mine = x.flaws.filter((f) => f.code === rule);
                const others = [...new Set(x.flaws.filter((f) => f.code !== rule).map((f) => f.code))];
                return (
                  <div key={x.id} className="qq-item">
                    <QRef id={x.id} onOpen={onOpen} extra={others.length > 0 && <span className="tiny muted">+ {others.join(', ')}</span>} />
                    {mine.map((f, i) => (
                      <div key={i} className="small qq-flaw">
                        {f.option && <span className="qq-key">{f.option}</span>}
                        <span className="ins-wrap">{f.message}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {(list.data?.questions.length ?? 0) > shown && (
                <button className="btn ghost sm" onClick={() => setShown((n) => n + PAGE * 2)}>
                  Xem thêm ({(list.data?.questions.length ?? 0) - shown} câu)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
