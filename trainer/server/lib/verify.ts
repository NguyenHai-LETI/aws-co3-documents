// Blind-solve verification: a second model (coach.models.verify, default opus) answers questions from the stem and the
// options only — never the key, explanation, hint or concept — with every tool disabled and `--json-schema`; the app
// compares its answer with the key (the CLI side lives in coach-runner.ts, task 'verify' and the auto phase after runs).
// Verdicts go to bank/verify.md, one line per verdict or decision, append-only and `merge=union` between machines:
//   - 2026-10-19 · `doc-rds-01` · ❌ lệch đáp án (model C · đáp án B) · opus · tin cậy cao — … <!-- verify {…} -->
// The visible part is for people; the JSON in the trailing comment is the data (reason included).
// [v5] γ2 — two more kinds of line in the same ledger (`check` in the JSON):
//   grounded  a fact-check of the key against AWS documentation (WebFetch / WebSearch limited to AWS domains, see
//             factcheck.ts): `fact` correct | wrong | outdated | ambiguous + `citations` [{url, quote}]. Shown next to the
//             blind-solve verdict; wrong / outdated / ambiguous puts the question in the review queue. Never changes a key.
//   local     a vote of a local Ollama model (coach.verify.local_model) during the import audit — a tie-breaker that
//             only sends a question to the grounded queue, never into review by itself.
// disputedIds() = questions whose key is in doubt (review queue, unless a newer fact-check confirmed the key) — λ leaves
// them out of readiness. This module stays free of context / stats imports (stats.ts imports disputedIds).
// [v6] The blind solver sees each question's options in a shuffled order (letters re-assigned A, B, C…; deterministic from
// the question hash + the number of earlier answers for that version, so a retry sees another order): LLM solvers favour
// some positions (Zheng et al. 2023), and a key position skewed by the writer would bias the verdict. Its picks are
// mapped back, so `picked` / `key` stay bank letters; `order` keeps what it saw.
// [v6] A third kind of line: the choices-only cue probe (`"probe":"choices-only"`, verify scope 'cues') — a cheap model
// sees ONLY the options (no stem, no id) and guesses; right twice under two shuffles = the options give the key away
// (Balepur et al. 2024). Parsed apart from the verdicts (loadProbes), so no blind-solve consumer can ever count one.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { BANK_DIR, PATCHES_DIR } from '../config.ts';
import { loadBank, type BankState } from './bank.ts';
import { sealedIds, sealedKey } from './sealed.ts';
import { applyPatch, applyPatchItems } from './patch.ts';
import { lintBank } from './lint.ts';
import { loadIssues } from './issues.ts';
import { ID_RE } from './pack-format.ts';
import { localDateKey, localIso } from './time.ts';
import type { AuditStatus, CueProbe, CueSummary, FactVerdict, IssueItem, ProbeOutcome, Question, VerifyCitation, VerifyOutcome, VerifySummary, VerifyVerdict } from '../../shared/types.ts';

export const VERIFY_FILE = path.join(BANK_DIR, 'verify.md');
export const MAX_VERIFY = 60; // questions per verify run
export const MAX_AUDIT = 10; // [v5] imported questions per audit run
export const MAX_GROUNDED = 10; // [v5] questions per grounded fact-check run
export const MAX_PROMPT_CHARS = 24_000; // one verifier call (Windows command lines stop at 32k characters)
export type VerifyScope = 'new' | 'unverified-ai' | 'changed' | 'audit' | 'grounded' | 'cues';
export const VERIFY_SCOPES: readonly VerifyScope[] = ['new', 'unverified-ai', 'changed', 'audit', 'grounded', 'cues'];
/** Issue types that make a question a grounded fact-check target. */
export const GROUNDED_ISSUE_TYPES = ['wrong-key', 'outdated'];
export const FACTS: readonly FactVerdict[] = ['correct', 'wrong', 'outdated', 'ambiguous'];

/** `--json-schema` of a verifier call. */
export const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          answer: { type: 'array', minItems: 1, items: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] }, description: 'chữ cái lựa chọn đúng nhất (đúng số đáp án đề yêu cầu)' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          ambiguous: { type: 'boolean', description: 'true: ≥ 2 lựa chọn cùng bảo vệ được, đề thiếu dữ kiện, hoặc không lựa chọn nào đúng' },
          reason: { type: 'string', description: '1–2 câu tiếng Việt; nêu lựa chọn theo nội dung, không dùng chữ cái' },
        },
        required: ['id', 'answer', 'confidence', 'ambiguous', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['results'],
  additionalProperties: false,
} as const;

/** Input problems (unknown question, nothing to decide on) — routes answer 400. */
export class VerifyInputError extends Error {}
/** The question changed since the learner looked at it — routes answer 409. */
export class VerifyConflictError extends Error {}

const AUTO_APPROVE = 'tự dùng lại: giải mù lại khớp đáp án';

// ── ledger: bank/verify.md ──────────────────────────────────────────────────

const HEADER = `# 🧪 Giải mù câu hỏi (blind-solve)

Model thứ hai (\`coach.models.verify\`) giải câu mới / câu vừa sửa mà **không** thấy đáp án, giải thích hay gợi ý; app so với
đáp án trong ngân hàng: ✅ khớp · ❌ lệch đáp án · ⚠️ mơ hồ (≥ 2 lựa chọn cùng đúng, thiếu dữ kiện) · 💥 lỗi.
Câu lệch / mơ hồ chờ bạn quyết định ở *Ngân hàng → Chất lượng* (👍 duyệt · 🗑️ loại); câu do AI viết được tự chuyển
\`status: draft\` cho tới khi duyệt (\`coach.verify.auto_draft\`). Câu nhập từ đề gốc không bao giờ bị tự chuyển draft.

File chỉ ghi thêm (append-only, \`merge=union\` giữa hai máy): mỗi dòng là một lần giải hoặc một quyết định; phần
\`<!-- verify {…} -->\` ở cuối dòng là dữ liệu cho app — đừng sửa tay. Dòng 🎯 là phép dò "chỉ nhìn phương án" (không có đề,
\`"probe":"choices-only"\`): đoán trúng đáp án cả hai lần = phương án lộ đáp án — không phải kết quả giải mù.

<!-- verify-log -->
`;

const LINE = /^- (\d{4}-\d{2}-\d{2}) · `([^`]+)` · .*<!-- verify (\{.*\}) -->\s*$/;
const OUTCOMES: VerifyOutcome[] = ['ok', 'mismatch', 'ambiguous', 'error'];
const DECISIONS = ['approved', 'retired', 'drafted'] as const;
const CONFIDENCES = ['high', 'medium', 'low'] as const;

const OUTCOME_LABEL: Record<VerifyOutcome, string> = { ok: '✅ khớp', mismatch: '❌ lệch đáp án', ambiguous: '⚠️ mơ hồ', error: '💥 lỗi' };
const DECISION_LABEL: Record<NonNullable<VerifyVerdict['decision']>, string> = { approved: '👍 đã duyệt', retired: '🗑️ đã loại (retired)', drafted: '📝 tự chuyển draft' };
const CONFIDENCE_LABEL = { high: 'tin cậy cao', medium: 'tin cậy vừa', low: 'tin cậy thấp' } as const;
export const FACT_LABEL: Record<FactVerdict, string> = { correct: '✅ đúng theo tài liệu', wrong: '❌ sai theo tài liệu', outdated: '⏳ kiến thức lỗi thời', ambiguous: '⚠️ tài liệu chưa đủ để quyết' };
export const MAX_CITATIONS = 3;
export const MAX_QUOTE = 300;

const clean = (s: unknown, max: number) => {
  const t = String(s ?? '')
    .replace(/<!--|-->/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
};

/** [v5] A page the grounded check may cite: https on docs.aws.amazon.com / aws.amazon.com (and their subdomains). */
export function awsDocUrl(url: unknown): string | undefined {
  try {
    const u = new URL(String(url ?? '').trim());
    if (u.protocol !== 'https:') return undefined;
    const h = u.hostname.toLowerCase();
    return h === 'aws.amazon.com' || h.endsWith('.aws.amazon.com') ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** [v5] Citations as stored: AWS documentation URLs only, short single-line quotes, at most MAX_CITATIONS. */
export function cleanCitations(v: unknown): VerifyCitation[] {
  const out: VerifyCitation[] = [];
  for (const c of Array.isArray(v) ? v : []) {
    if (!c || typeof c !== 'object') continue;
    const url = awsDocUrl((c as Record<string, unknown>).url);
    const quote = clean((c as Record<string, unknown>).quote, MAX_QUOTE);
    if (url && quote && !out.some((x) => x.url === url && x.quote === quote)) out.push({ url, quote });
    if (out.length >= MAX_CITATIONS) break;
  }
  return out;
}

/** One ledger line (verdict or decision). */
export function formatVerdict(v: VerifyVerdict): string {
  const conf = v.confidence ? ` · ${CONFIDENCE_LABEL[v.confidence]}` : '';
  const head = v.decision
    ? v.decision === 'approved' && v.runId
      ? '✅ tự dùng lại (giải mù khớp)'
      : DECISION_LABEL[v.decision]
    : v.check === 'grounded'
      ? `🔗 kiểm chứng tài liệu AWS: ${FACT_LABEL[v.fact ?? 'ambiguous']}${v.picked || v.key ? ` (tài liệu ${v.picked || '—'} · đáp án ${v.key || '—'})` : ''}${v.model ? ` · ${v.model}` : ''}${v.citations?.length ? ` · ${v.citations.length} trích dẫn` : ''}`
      : v.check === 'local'
        ? `🖥️ phiếu model local: ${OUTCOME_LABEL[v.outcome]}${v.picked || v.key ? ` (model ${v.picked || '—'} · đáp án ${v.key || '—'})` : ''}${v.model ? ` · ${v.model}` : ''}${conf}`
        : `${OUTCOME_LABEL[v.outcome]}${v.picked || v.key ? ` (model ${v.picked || '—'} · đáp án ${v.key || '—'})` : ''}${v.model ? ` · ${v.model}` : ''}${conf}`;
  const why = clean(v.reason, 160);
  const data = {
    at: v.at,
    hash: v.hash,
    outcome: v.outcome,
    picked: v.picked,
    key: v.key,
    confidence: v.confidence,
    model: v.model,
    run: v.runId,
    decision: v.decision,
    reason: v.reason ? clean(v.reason, 600) : undefined,
    check: v.check,
    fact: v.check === 'grounded' ? v.fact : undefined,
    citations: v.check === 'grounded' && v.citations?.length ? cleanCitations(v.citations) : undefined,
    order: v.order && ORDER_RE.test(v.order) ? v.order : undefined,
  };
  return `- ${v.date} · \`${v.qid}\` · ${head}${why ? ` — ${why}` : ''} <!-- verify ${ledgerJson(data)} -->`;
}

const ledgerJson = (data: Record<string, unknown>) => JSON.stringify(data).replace(/--/g, '-\\u002d'); // keeps "-->" out of the comment
const ORDER_RE = /^[A-H]{2,8}$/;

/**
 * [v6] A cue-probe line (any `probe` in its JSON) — never a blind-solve verdict. parseLedger() routes these lines to
 * loadProbes(), byQuestion() skips anything carrying one: verified counts, the review queue, auto-draft / reactivation,
 * sealed eligibility, readiness and the verify targets only ever see blind solves, fact-checks, local votes, decisions.
 */
export function isProbeRecord(d: unknown): boolean {
  return !!d && typeof d === 'object' && (d as Record<string, unknown>).probe !== undefined && (d as Record<string, unknown>).probe !== null;
}

/** Every verdict / decision line of a ledger text, oldest first — [v6] cue-probe lines left out (parseLedger). */
export function parseVerdicts(text: string): VerifyVerdict[] {
  return parseLedger(text).verdicts;
}

/** [v6] Both kinds of line of a ledger text, each oldest first: verdicts / decisions, and the cue-probe lines. */
export function parseLedger(text: string): { verdicts: VerifyVerdict[]; probes: CueProbe[] } {
  const out: VerifyVerdict[] = [];
  const probes: CueProbe[] = [];
  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((line, i) => {
      const m = line.match(LINE);
      if (!m || !ID_RE.test(m[2])) return;
      let d: Record<string, unknown>;
      try {
        d = JSON.parse(m[3]) as Record<string, unknown>;
      } catch {
        return;
      }
      if (isProbeRecord(d)) {
        const p = parseProbe(d, m[1], m[2], i + 1);
        if (p) probes.push(p);
        return;
      }
      if (typeof d.hash !== 'string' || !OUTCOMES.includes(d.outcome as VerifyOutcome)) return;
      const s = (k: string) => (typeof d[k] === 'string' && d[k] ? (d[k] as string) : undefined);
      const v: VerifyVerdict = { line: i + 1, date: m[1], qid: m[2], hash: d.hash, outcome: d.outcome as VerifyOutcome };
      if (s('at')) v.at = s('at');
      if (s('model')) v.model = s('model');
      if (s('picked')) v.picked = s('picked');
      if (s('key')) v.key = s('key');
      if ((CONFIDENCES as readonly string[]).includes(String(d.confidence))) v.confidence = d.confidence as VerifyVerdict['confidence'];
      if (s('reason')) v.reason = s('reason');
      if ((DECISIONS as readonly string[]).includes(String(d.decision))) v.decision = d.decision as VerifyVerdict['decision'];
      if (s('run')) v.runId = s('run');
      if (d.check === 'grounded' || d.check === 'local') v.check = d.check;
      if (v.check === 'grounded') {
        v.fact = (FACTS as readonly string[]).includes(String(d.fact)) ? (d.fact as FactVerdict) : 'ambiguous';
        const cites = cleanCitations(d.citations);
        if (cites.length) v.citations = cites;
      }
      if (typeof d.order === 'string' && ORDER_RE.test(d.order)) v.order = d.order;
      out.push(v);
    });
  // newest last: union merges may interleave the two machines' lines, so order by time, then by line
  const t = (v: { at?: string; date: string }) => Date.parse(v.at ?? `${v.date}T00:00:00`) || 0;
  const byTime = (a: { at?: string; date: string; line?: number }, b: { at?: string; date: string; line?: number }) => t(a) - t(b) || (a.line ?? 0) - (b.line ?? 0);
  return { verdicts: out.sort(byTime), probes: probes.sort(byTime) };
}

let ledgerCache: { sig: string; verdicts: VerifyVerdict[]; probes: CueProbe[] } | undefined;

function ledgerSig(): string {
  try {
    const st = fs.statSync(VERIFY_FILE);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return 'none';
  }
}

function readLedger(): { verdicts: VerifyVerdict[]; probes: CueProbe[] } {
  const sig = ledgerSig();
  if (ledgerCache?.sig === sig) return ledgerCache;
  ledgerCache = { sig, ...(sig === 'none' ? { verdicts: [], probes: [] } : parseLedger(fs.readFileSync(VERIFY_FILE, 'utf8'))) };
  return ledgerCache;
}

/** Every verdict / decision in bank/verify.md, oldest first (cached by file mtime + size) — [v6] never a cue-probe line. */
export function loadVerdicts(): VerifyVerdict[] {
  return readLedger().verdicts;
}

/** [v6] Every cue-probe line in bank/verify.md, oldest first (same cache as loadVerdicts). */
export function loadProbes(): CueProbe[] {
  return readLedger().probes;
}

function appendLines(lines: string[]): void {
  if (!lines.length) return;
  if (!fs.existsSync(VERIFY_FILE)) {
    fs.mkdirSync(path.dirname(VERIFY_FILE), { recursive: true });
    fs.writeFileSync(VERIFY_FILE, HEADER);
  }
  const text = fs.readFileSync(VERIFY_FILE, 'utf8');
  fs.appendFileSync(VERIFY_FILE, (text.endsWith('\n') || !text ? '' : '\n') + lines.map((l) => l + '\n').join(''));
}

export function appendVerdicts(vs: VerifyVerdict[]): void {
  appendLines(vs.map(formatVerdict));
}

/** [v6] Cue-probe lines → bank/verify.md (same append-only ledger). */
export function appendProbes(ps: CueProbe[]): void {
  appendLines(ps.map(formatProbe));
}

// ── summary ─────────────────────────────────────────────────────────────────

interface QuestionVerdicts {
  solve?: VerifyVerdict; // latest blind solve of the current version — 'error' answers never count as a verdict
  decision?: VerifyVerdict; // latest decision on the current version
  lastSolve?: VerifyVerdict; // latest non-error blind solve of any version (shown while the current one is unsolved)
  lastDecision?: VerifyVerdict; // latest decision on any version
  grounded?: VerifyVerdict; // [v5] latest fact-check against AWS documentation of the current version
  lastGrounded?: VerifyVerdict; // [v5] …of any version
  local?: VerifyVerdict; // [v5] latest local-model vote of the current version (non-error)
  lastLocal?: VerifyVerdict;
}

function byQuestion(bank: BankState, verdicts: VerifyVerdict[]): Map<string, QuestionVerdicts> {
  const out = new Map<string, QuestionVerdicts>();
  for (const v of verdicts) {
    const q = bank.byId.get(v.qid);
    if (!q || isProbeRecord(v)) continue; // [v6] a cue probe is never a verdict (parseLedger keeps them apart already)
    const e = out.get(v.qid) ?? {};
    out.set(v.qid, e);
    if (v.decision) {
      e.lastDecision = v;
      if (v.hash === q.hash) e.decision = v;
      continue;
    }
    if (v.outcome === 'error') continue; // no answer is not a verdict: the question stays to be verified
    if (v.check === 'grounded') {
      e.lastGrounded = v;
      if (v.hash === q.hash) e.grounded = v;
      continue;
    }
    if (v.check === 'local') {
      e.lastLocal = v;
      if (v.hash === q.hash) e.local = v;
      continue;
    }
    e.lastSolve = v;
    if (v.hash === q.hash) e.solve = v;
  }
  return out;
}

/** Sent to draft by the blind-solve and not decided on since (whatever version): stays queued until approve / retire. */
function verifierDrafted(q: Question, e: QuestionVerdicts | undefined): boolean {
  return q.status === 'draft' && e?.lastDecision?.decision === 'drafted';
}

const timeOf = (v: VerifyVerdict | undefined) => (v ? Date.parse(v.at ?? `${v.date}T00:00:00`) || 0 : 0);
const decided = (e: QuestionVerdicts) => e.decision?.decision === 'approved' || e.decision?.decision === 'retired';

/** [v5] The current version's fact-check found a problem (wrong / outdated / ambiguous) after the last decision on it. */
function groundedFlag(e: QuestionVerdicts): boolean {
  const g = e.grounded;
  return !!g && g.fact !== 'correct' && !(decided(e) && timeOf(e.decision) >= timeOf(g));
}

function needsReview(q: Question, e: QuestionVerdicts): boolean {
  if (verifierDrafted(q, e)) return true;
  if (groundedFlag(e)) return true;
  return !!e.solve && (e.solve.outcome === 'mismatch' || e.solve.outcome === 'ambiguous') && !decided(e);
}

const bare = ({ decision: _d, grounded: _g, local: _l, ...rest }: VerifyVerdict): VerifyVerdict => rest;

/**
 * The verdict shown for a question: the current version's blind solve, else the newest older one (compare `hash`),
 * decision merged; [v5] the newest fact-check / local vote ride along as `grounded` / `local` (or stand alone when the
 * question was never blind-solved).
 */
function shown(q: Question, e: QuestionVerdicts): VerifyVerdict | undefined {
  const blind = e.solve ?? e.lastSolve ?? (verifierDrafted(q, e) ? e.lastDecision : undefined);
  const g = e.grounded ?? e.lastGrounded;
  const l = e.local ?? e.lastLocal;
  const v = blind ?? g ?? l;
  if (!v) return undefined;
  const current = v === e.solve || v === e.grounded || v === e.local;
  const decision = verifierDrafted(q, e) ? 'drafted' : current ? e.decision?.decision : undefined;
  return { ...bare(v), ...(decision ? { decision } : {}), ...(g && g !== v ? { grounded: bare(g) } : {}), ...(l && l !== v ? { local: bare(l) } : {}) };
}

/** Latest verdict per question (current version first, else the newest one — compare `hash` to spot a stale one), decision merged. */
export function latestVerdicts(bank: BankState, verdicts: VerifyVerdict[] = loadVerdicts()): Record<string, VerifyVerdict> {
  const out: Record<string, VerifyVerdict> = {};
  for (const [qid, e] of byQuestion(bank, verdicts)) {
    const v = shown(bank.byId.get(qid)!, e);
    if (v) out[qid] = v;
  }
  return out;
}

let summaryCache: { key: string; value: VerifySummary } | undefined;

/**
 * Verdict counts + review queue for the current bank (latest verdict per question, stale when the hash changed).
 * The queue holds mismatch / ambiguous versions nobody approved or retired, and every question the blind-solve sent
 * to draft until someone decides — even when it was edited or re-verified OK since (approve then reactivates it).
 * [v6] `cues` (once anything was probed): the choices-only cue probe of the current versions, sealed questions left out.
 */
export function verifySummary(bank: BankState): VerifySummary {
  const key = `${bank.version}|${ledgerSig()}|${sealedKey()}`;
  if (summaryCache?.key === key) return summaryCache.value;
  const value: VerifySummary = { verified: 0, ok: 0, review: 0, stale: 0, pending: [], disputed: 0, grounded: 0 };
  for (const [qid, e] of byQuestion(bank, loadVerdicts())) {
    const q = bank.byId.get(qid)!;
    if (q.status === 'retired') continue;
    if (e.solve) {
      value.verified++;
      if (e.solve.outcome === 'ok') value.ok++;
    } else if (e.lastSolve) value.stale++;
    if (e.grounded) value.grounded!++;
    if (disputed(q, e)) value.disputed!++;
    const v = needsReview(q, e) ? shown(q, e) : undefined;
    if (v) {
      value.review++;
      value.pending.push(v);
    }
  }
  const t = (v: VerifyVerdict) => Date.parse(v.at ?? v.date) || 0;
  value.pending.sort((a, b) => t(b) - t(a) || (b.line ?? 0) - (a.line ?? 0));
  const cues = cueSummary(bank, loadProbes(), sealedIds());
  if (cues) value.cues = cues;
  summaryCache = { key, value };
  return value;
}

// ── [v5] disputed keys ──────────────────────────────────────────────────────

/** In the review queue, unless the newest check of the current version is a fact-check that confirmed the key. */
function disputed(q: Question, e: QuestionVerdicts): boolean {
  if (!needsReview(q, e)) return false;
  const g = e.grounded;
  return !(g && g.fact === 'correct' && timeOf(g) >= timeOf(e.solve));
}

let disputedCache: { key: string; ids: Set<string> } | undefined;

/**
 * Questions whose key is in doubt right now: the latest blind-solve or fact-check of the current version says
 * mismatch / ambiguous / wrong / outdated (or the blind-solve sent it to draft) and nobody decided since — unless a newer
 * fact-check confirmed the key. Retired questions are left out. λ keeps them out of readiness. Cached by bank version
 * + ledger file.
 */
export function disputedIds(bank: BankState = loadBank()): Set<string> {
  const key = `${bank.version}|${ledgerSig()}`;
  if (disputedCache?.key === key) return disputedCache.ids;
  const ids = new Set<string>();
  for (const [qid, e] of byQuestion(bank, loadVerdicts())) {
    const q = bank.byId.get(qid)!;
    if (q.status !== 'retired' && disputed(q, e)) ids.add(qid);
  }
  disputedCache = { key, ids };
  return ids;
}

// ── what to verify ──────────────────────────────────────────────────────────

export interface VerifyParams {
  ids?: unknown;
  pack?: unknown;
  scope?: unknown;
}

/**
 * Questions for a verify run: explicit `ids`, or a `pack` and/or a `scope` (default 'unverified-ai'):
 *   new           never verified, not imported from the practice exams
 *   unverified-ai written by AI (origin ai / doc) without a verdict for the current version
 *   changed       verified before, edited since (no verdict for the current version)
 * Retired questions are never verified; sealed ones only when named explicitly. At most MAX_VERIFY, AI-written first, newest first.
 */
export function verifyTargets(
  bank: BankState,
  params: VerifyParams,
  verdicts: VerifyVerdict[] = loadVerdicts(),
  sealed: ReadonlySet<string> = sealedIds(),
): { ids: string[]; total: number } {
  const usable = (q: Question | undefined): q is Question => !!q && q.status !== 'retired';
  if (Array.isArray(params.ids)) {
    const ids = [...new Set(params.ids.map((x) => String(x).trim()))].filter((id) => usable(bank.byId.get(id)));
    return { ids: ids.slice(0, MAX_VERIFY), total: ids.length };
  }
  const per = byQuestion(bank, verdicts);
  const everSolved = new Set([...per].filter(([, e]) => e.lastSolve).map(([qid]) => qid)); // error answers do not count
  const scope = (VERIFY_SCOPES as readonly string[]).includes(String(params.scope)) ? (params.scope as VerifyScope) : params.pack ? undefined : 'unverified-ai';
  const pack = typeof params.pack === 'string' && params.pack ? params.pack : undefined;
  const pool = bank.questions.filter((q) => {
    if (!usable(q) || sealed.has(q.id)) return false; // [γ] a pack / scope run never touches a sealed question
    if (pack && q.pack !== pack && q.file !== pack) return false;
    const current = !!per.get(q.id)?.solve;
    if (scope === 'new') return q.origin !== 'imported' && !everSolved.has(q.id);
    if (scope === 'unverified-ai') return (q.origin === 'ai' || q.origin === 'doc') && !current;
    if (scope === 'changed') return everSolved.has(q.id) && !current;
    return true;
  });
  const rank = (q: Question) => (q.origin === 'ai' || q.origin === 'doc' ? 0 : 1);
  pool.sort((a, b) => rank(a) - rank(b) || (b.created ?? '').localeCompare(a.created ?? '') || a.id.localeCompare(b.id, 'en', { numeric: true }));
  return { ids: pool.slice(0, MAX_VERIFY).map((q) => q.id), total: pool.length };
}

// ── [v5] import audit & grounded fact-check targets ─────────────────────────

const byNumericId = (a: Question, b: Question) => a.id.localeCompare(b.id, 'en', { numeric: true });
const domainWeight = (bank: BankState, q: Question) => bank.taxonomy.domains.find((d) => d.id === q.domain)?.weight ?? 0;

/** Questions lint flags as stale facts (taxonomy `currency:`, rule `stale-fact`) — the cached bank lint, sealed excluded. */
export function staleFactIds(bank: BankState, sealed: ReadonlySet<string> = sealedIds()): Set<string> {
  try {
    return new Set(lintBank(bank, { exclude: sealed }).ids?.['stale-fact'] ?? []);
  } catch {
    return new Set();
  }
}

/** Active imported questions of the practice pool (not sealed, not out of scope) — what the import audit covers. */
function auditPool(bank: BankState, sealed: ReadonlySet<string>): Question[] {
  return bank.questions.filter((q) => q.status === 'active' && q.origin === 'imported' && !q.outOfScope && !sealed.has(q.id));
}

/**
 * Import audit (7-06): imported questions without a blind-solve verdict for their current version, MAX_AUDIT per run.
 * Order: the questions the learner meets next (`upcoming`, enrich.ts upcomingIds — soonest first), then
 * multiple-response, then stale-fact flagged, then exam weight of the domain, then id.
 */
export function auditTargets(
  bank: BankState,
  opts: { upcoming?: string[]; limit?: number } = {},
  verdicts: VerifyVerdict[] = loadVerdicts(),
  sealed: ReadonlySet<string> = sealedIds(),
): { ids: string[]; total: number } {
  const per = byQuestion(bank, verdicts);
  const stale = staleFactIds(bank, sealed);
  const soon = new Map((opts.upcoming ?? []).map((id, i) => [id, i] as const));
  const pool = auditPool(bank, sealed).filter((q) => !per.get(q.id)?.solve);
  const rank = (q: Question) => (soon.has(q.id) ? 0 : q.answer.length > 1 ? 1 : stale.has(q.id) ? 2 : 3);
  pool.sort((a, b) => rank(a) - rank(b) || (soon.get(a.id) ?? 0) - (soon.get(b.id) ?? 0) || domainWeight(bank, b) - domainWeight(bank, a) || byNumericId(a, b));
  const limit = Math.max(1, Math.min(MAX_VERIFY, Math.round(opts.limit ?? MAX_AUDIT) || MAX_AUDIT));
  return { ids: pool.slice(0, limit).map((q) => q.id), total: pool.length };
}

/** Progress of the import audit + the questions the next audit run takes (GET /api/verify). */
export function auditStatus(bank: BankState, upcoming: string[] = [], verdicts: VerifyVerdict[] = loadVerdicts(), sealed: ReadonlySet<string> = sealedIds()): AuditStatus {
  const per = byQuestion(bank, verdicts);
  const pool = auditPool(bank, sealed);
  return { imported: pool.length, audited: pool.filter((q) => per.get(q.id)?.solve).length, next: auditTargets(bank, { upcoming }, verdicts, sealed).ids };
}

/**
 * Questions worth a fact-check against AWS documentation (6-07 / 7-05), without one for their current version:
 *   1. the review queue — blind-solve mismatch / ambiguous nobody decided on (newest first);
 *   2. open issues of type wrong-key / outdated;
 *   3. import-audit disagreements: the blind-solve agreed with the key, the local model picked another option with high confidence;
 *   4. stale facts (lint `stale-fact`).
 * Explicit `ids` bypass the rules (sealed allowed only then, like blind-solve runs). Retired questions never. ≤ MAX_GROUNDED.
 */
export function groundedTargets(
  bank: BankState,
  params: { ids?: unknown } = {},
  opts: { issues?: IssueItem[]; limit?: number } = {},
  verdicts: VerifyVerdict[] = loadVerdicts(),
  sealed: ReadonlySet<string> = sealedIds(),
): { ids: string[]; total: number } {
  const limit = Math.max(1, Math.min(MAX_VERIFY, Math.round(opts.limit ?? MAX_GROUNDED) || MAX_GROUNDED));
  const usable = (q: Question | undefined): q is Question => !!q && q.status !== 'retired';
  if (Array.isArray(params.ids)) {
    const ids = [...new Set(params.ids.map((x) => String(x).trim()))].filter((id) => usable(bank.byId.get(id)));
    return { ids: ids.slice(0, limit), total: ids.length };
  }
  const per = byQuestion(bank, verdicts);
  const open = (q: Question) => usable(q) && !sealed.has(q.id) && !per.get(q.id)?.grounded;
  const out: string[] = [];
  const add = (id: string) => {
    const q = bank.byId.get(id);
    if (q && open(q) && !out.includes(id)) out.push(id);
  };
  const review = [...per]
    .filter(([qid, e]) => {
      const q = bank.byId.get(qid)!;
      return !!e.solve && (e.solve.outcome === 'mismatch' || e.solve.outcome === 'ambiguous') && !decided(e) && q.status !== 'retired';
    })
    .sort(([, a], [, b]) => timeOf(b.solve) - timeOf(a.solve));
  for (const [qid] of review) add(qid);
  for (const it of opts.issues ?? safeIssues()) if (it.open && GROUNDED_ISSUE_TYPES.includes(it.type)) add(it.qid);
  for (const [qid, e] of per) if (e.solve?.outcome === 'ok' && e.local && e.local.outcome === 'mismatch' && e.local.confidence === 'high') add(qid);
  const stale = staleFactIds(bank, sealed);
  for (const q of bank.questions.filter((x) => stale.has(x.id)).sort(byNumericId)) add(q.id);
  return { ids: out.slice(0, limit), total: out.length };
}

function safeIssues(): IssueItem[] {
  try {
    return loadIssues();
  } catch {
    return [];
  }
}

// ── [v6] shuffled options ───────────────────────────────────────────────────

const LETTERS = 'ABCDEFGH';

/**
 * [v6] The order a solver sees a question's options in: a permutation of the bank keys, deterministic from the question
 * hash + `seed` (blind solve `solve#<n>`, cue probe `probe#<n>#<run>`) — anyone can re-derive it, and another seed (a
 * retry) gives another order.
 */
export function optionOrder(q: Pick<Question, 'hash' | 'options'>, seed: string): string[] {
  const h = new Map(q.options.map((o) => [o.key, crypto.createHash('sha256').update(`${q.hash}|${seed}|${o.key}`).digest().readUInt32BE(0)] as const));
  return q.options.map((o) => o.key).sort((a, b) => h.get(a)! - h.get(b)! || a.localeCompare(b));
}

/**
 * [v6] Option orders for a blind-solve batch: seed `solve#<n>`, n = answers already in the ledger for that version of the
 * question (error answers included), so solving the same version again shows the options another way.
 */
export function blindOrders(qs: Pick<Question, 'id' | 'hash' | 'options'>[], ledger: VerifyVerdict[] = loadVerdicts()): Map<string, string[]> {
  const ids = new Set(qs.map((q) => q.id));
  const seen = new Map<string, number>();
  for (const v of ledger) if (ids.has(v.qid) && !v.decision && !v.check) seen.set(`${v.qid}|${v.hash}`, (seen.get(`${v.qid}|${v.hash}`) ?? 0) + 1);
  return new Map(qs.map((q) => [q.id, optionOrder(q, `solve#${seen.get(`${q.id}|${q.hash}`) ?? 0}`)]));
}

/** [v6] Option lines as shown: the bank keys of `order` under the letters A, B, C… (bank order with its own keys without one). */
function optionLines(q: Pick<Question, 'options'>, order?: readonly string[]): string[] {
  if (!order) return q.options.map((o) => `- ${o.key}. ${o.text}`);
  return order.map((k, i) => `- ${LETTERS[i]}. ${q.options.find((o) => o.key === k)?.text ?? ''}`);
}

/** [v6] A usable order for `q`: every bank key exactly once (anything else → undefined = bank order). */
function validOrder(q: Pick<Question, 'options'>, order: readonly string[] | undefined): readonly string[] | undefined {
  if (!order || order.length !== q.options.length) return undefined;
  const keys = new Set(q.options.map((o) => o.key));
  return new Set(order).size === order.length && order.every((k) => keys.has(k)) ? order : undefined;
}

/** [v6] Letters as the solver saw them → bank keys (letters outside the shown range dropped), sorted and unique. */
function bankKeys(q: Pick<Question, 'options'>, letters: string[], order: readonly string[] | undefined): string {
  const keys = new Set(q.options.map((o) => o.key));
  const mapped = letters.map((l) => (order ? order[LETTERS.indexOf(l)] : l)).filter((k): k is string => !!k && keys.has(k));
  return [...new Set(mapped)].sort().join('');
}

const OPTION_REF = /((?:[Pp]hương án|[Ll]ựa chọn|[Đđ]áp án|[Oo]ptions?|[Cc]hoices?|[Aa]nswers?)\s+)([A-H](?:\s*(?:,|\/|&|\+|và|hoặc|hay|and|or)\s*[A-H])*)(?![\p{L}\p{N}])/gu;

/**
 * [v6] Option-letter references a shuffled solver wrote anyway ("phương án B và D", "option C") → bank letters. Bare
 * letters stay as written — "VPC A", "bản ghi A" are no option references; the prompt asks for options by content.
 */
export function remapLetterRefs(text: string, order: readonly string[]): string {
  return text.replace(OPTION_REF, (_m, word: string, list: string) => word + list.replace(/[A-H]/g, (l) => order[LETTERS.indexOf(l)] ?? l));
}

// ── the verifier call ───────────────────────────────────────────────────────

/**
 * What the verifier sees: id, stem, options and how many to pick — never the key, explanation, hint or metadata.
 * [v6] `orders` (qid → bank keys in display order, blindOrders) shows the options shuffled under new letters A, B, C…;
 * without one a question keeps its bank order and letters.
 */
export function verifyPrompt(qs: Question[], runId: string, orders?: ReadonlyMap<string, readonly string[]>): string {
  const head = [
    'Bạn là chuyên gia AWS Certified Solutions Architect – Associate (SAA-C03). GIẢI từng câu trắc nghiệm dưới đây như thí sinh trong',
    'phòng thi: bạn chỉ có đề và các lựa chọn — không có đáp án, giải thích hay tài liệu.',
    '',
    'Với mỗi câu trả về:',
    '- `answer`: chữ cái của lựa chọn đúng nhất — đúng số đáp án ghi ở tiêu đề câu ("chọn 2" = 2 chữ cái); luôn chọn, kể cả khi',
    '  câu mơ hồ (chọn lựa chọn bảo vệ được nhất và đặt `ambiguous` = true);',
    '- `confidence`: high | medium | low;',
    '- `ambiguous`: true khi từ 2 lựa chọn trở lên cùng bảo vệ được theo dữ kiện của đề, đề thiếu dữ kiện quyết định, hoặc không lựa',
    '  chọn nào đúng theo kiến thức AWS hiện hành; ngược lại false;',
    '- `reason`: 1–2 câu tiếng Việt: vì sao chọn (và chỗ mơ hồ nếu có). Giữ thuật ngữ AWS bằng tiếng Anh. Nhắc tới lựa chọn bằng',
    `  NỘI DUNG (vd “Multi-AZ”), không bằng chữ cái${orders?.size ? ' — thứ tự lựa chọn của mỗi câu đã được xáo ngẫu nhiên' : ''}.`,
    'Trả lời bằng JSON đúng schema: `results` có đủ mọi id bên dưới. Không dùng công cụ, không hỏi lại.',
    '',
    `- run_id: ${runId}`,
    '',
  ];
  const body = qs.flatMap((q, i) => [`## ${i + 1}. \`${q.id}\` — chọn ${q.answer.length}`, '', q.stem.trim(), '', ...optionLines(q, validOrder(q, orders?.get(q.id))), '']);
  return [...head, ...body].join('\n');
}

/** Batches of ≤ `size` questions whose prompt stays under MAX_PROMPT_CHARS ([v6] `cost`: prompt characters of one question). */
export function verifyBatches(qs: Question[], size: number, cost: (q: Question) => number = (q) => q.stem.length + q.options.reduce((s, o) => s + o.text.length + 8, 0) + 80): Question[][] {
  const n = Math.min(25, Math.max(1, Math.round(size) || 10));
  const out: Question[][] = [];
  let cur: Question[] = [];
  let chars = 1500;
  for (const q of qs) {
    const c = cost(q);
    if (cur.length && (cur.length >= n || chars + c > MAX_PROMPT_CHARS)) {
      out.push(cur);
      cur = [];
      chars = 1500;
    }
    cur.push(q);
    chars += c;
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * Verifier answer for one question → outcome (ambiguous wins over a match: two defensible options is a flaw either way).
 * [v6] `order` = what the solver saw (verifyPrompt orders): its letters are mapped back to bank keys — `picked` / `key`
 * are bank letters, option references in `reason` too (remapLetterRefs) — and the order rides along as `order`.
 */
export function judge(q: Question, r: Record<string, unknown> | undefined, order?: readonly string[]): Pick<VerifyVerdict, 'outcome' | 'picked' | 'key' | 'confidence' | 'reason' | 'order'> {
  const key = [...q.answer].sort().join('');
  const shown = validOrder(q, order);
  const seen = shown ? { order: shown.join('') } : {};
  if (!r) return { outcome: 'error', key, reason: 'model không trả lời câu này', ...seen };
  const raw = Array.isArray(r.answer) ? r.answer.join(',') : String(r.answer ?? '');
  const picked = bankKeys(q, raw.toUpperCase().match(/[A-H]/g) ?? [], shown);
  const confidence = (CONFIDENCES as readonly string[]).includes(String(r.confidence)) ? (r.confidence as VerifyVerdict['confidence']) : undefined;
  const text = clean(r.reason, 600);
  const reason = (shown && text ? remapLetterRefs(text, shown) : text) || undefined;
  // no pick + ambiguous = "no option is correct" (the prompt allows it) — a flaw, not a failed answer
  if (!picked) return r.ambiguous === true ? { outcome: 'ambiguous', key, confidence, reason, ...seen } : { outcome: 'error', key, confidence, reason: reason ?? 'không có đáp án hợp lệ', ...seen };
  const outcome: VerifyOutcome = r.ambiguous === true ? 'ambiguous' : picked === key ? 'ok' : 'mismatch';
  return { outcome, picked, key, confidence, reason, ...seen };
}

/** An id as the model wrote it (`\`doc-x-01\``, " doc-x-01 ") → the bank id. */
export const normalizeId = (v: unknown) => String(v ?? '').replace(/[`'"‘’“”\s]/g, '');

/**
 * Verdicts for one verifier batch from its structured answer (missing ids → 'error', which never counts as verified).
 * [v6] `orders`: the option orders the prompt showed (verifyPrompt) — picks are mapped back to bank letters.
 */
export function verdictsFor(qs: Question[], output: Record<string, unknown> | undefined, meta: { model?: string; runId: string; now?: Date; orders?: ReadonlyMap<string, readonly string[]> }): VerifyVerdict[] {
  const results = Array.isArray(output?.results) ? (output!.results as unknown[]) : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of results) if (r && typeof r === 'object' && !Array.isArray(r)) byId.set(normalizeId((r as Record<string, unknown>).id), r as Record<string, unknown>);
  const now = meta.now ?? new Date();
  return qs.map((q) => ({ date: localDateKey(now), at: localIso(now), qid: q.id, hash: q.hash, model: meta.model, runId: meta.runId, ...judge(q, byId.get(q.id), meta.orders?.get(q.id)) }));
}

// ── drafts & decisions ──────────────────────────────────────────────────────

/**
 * auto_draft policy: a mismatch / ambiguous verdict sends an active question to `status: draft` when it was written by
 * AI (origin ai / doc) or just changed by an AI run (`changed`); imported questions are never auto-drafted.
 */
export function draftCandidates(verdicts: VerifyVerdict[], bank: BankState, changed: Set<string> = new Set(), ledger: VerifyVerdict[] = loadVerdicts()): VerifyVerdict[] {
  const per = byQuestion(bank, ledger);
  return verdicts.filter((v) => {
    const q = bank.byId.get(v.qid);
    if (!q || q.hash !== v.hash || q.status !== 'active' || q.origin === 'imported') return false;
    if (v.outcome !== 'mismatch' && v.outcome !== 'ambiguous') return false;
    if (per.get(q.id)?.decision?.decision === 'approved') return false; // you approved this version: never draft it again
    return q.origin === 'ai' || q.origin === 'doc' || changed.has(q.id);
  });
}

/**
 * A question the blind-solve sent to draft whose current version is now solved correctly (fixed by ENRICH, or simply
 * re-verified) goes back to `status: active` — status-only patch item + an automatic 'approved' decision in the ledger.
 */
export function reactivate(verdicts: VerifyVerdict[], runId: string): { reactivated: string[]; errors: string[] } {
  const bank = loadBank();
  const per = byQuestion(bank, loadVerdicts());
  const ok = verdicts.filter((v) => {
    const q = bank.byId.get(v.qid);
    return !!q && v.outcome === 'ok' && v.hash === q.hash && verifierDrafted(q, per.get(q.id));
  });
  if (!ok.length) return { reactivated: [], errors: [] };
  const r = applyPatchItems(
    ok.map((v) => ({ id: v.qid, base: v.hash, status: 'active' })),
    { label: '(giải mù)', preImage: runId }, // [v5] part of the run: its undo puts the question back to draft
  );
  const done = new Set(r.items.filter((i) => i.status === 'applied' || i.status === 'unchanged').map((i) => i.id));
  const now = new Date();
  appendVerdicts(
    ok
      .filter((v) => done.has(v.qid))
      .map((v) => ({ date: localDateKey(now), at: localIso(now), qid: v.qid, hash: v.hash, outcome: v.outcome, picked: v.picked, key: v.key, decision: 'approved' as const, runId, reason: AUTO_APPROVE })),
  );
  return { reactivated: [...done], errors: r.error ? [r.error] : r.items.filter((i) => !done.has(i.id)).map((i) => `${i.id}: ${i.errors.join(' | ')}`) };
}

/** Status-only patch (coach/patches/<runId>-verify.yaml, kept as audit trail) + 'drafted' decisions in the ledger. */
export function autoDraft(verdicts: VerifyVerdict[], runId: string, today?: string): { drafted: string[]; errors: string[] } {
  if (!verdicts.length) return { drafted: [], errors: [] };
  const file = path.join(PATCHES_DIR, `${runId}-verify.yaml`);
  const items = verdicts.map((v) => ({ id: v.qid, base: v.hash, status: 'draft' }));
  fs.mkdirSync(PATCHES_DIR, { recursive: true });
  fs.writeFileSync(file, `# Giải mù lệch / mơ hồ → status: draft (coach.verify.auto_draft) — lượt ${runId}\n${YAML.stringify({ run_id: `${runId}-verify`, items }, { lineWidth: 0 })}`);
  const r = applyPatch(file, { today, preImage: runId }); // [v5] undo of the run restores the status too
  const ok = new Set(r.items.filter((i) => i.status === 'applied' || i.status === 'unchanged').map((i) => i.id));
  const now = new Date();
  appendVerdicts(
    verdicts
      .filter((v) => ok.has(v.qid))
      .map((v) => ({ date: localDateKey(now), at: localIso(now), qid: v.qid, hash: v.hash, outcome: v.outcome, picked: v.picked, key: v.key, decision: 'drafted' as const, runId })),
  );
  return { drafted: [...ok], errors: r.error ? [r.error] : r.items.filter((i) => !ok.has(i.id)).map((i) => `${i.id}: ${i.errors.join(' | ')}`) };
}

/**
 * The learner's decision on a question in the review queue: approve (keep it; a question the blind-solve sent to draft
 * becomes active again — whatever version it is now) or retire (`status: retired`). Appended to the ledger.
 * `hash` = the version the learner looked at: a different current version → VerifyConflictError (decide again).
 */
export function decide(qid: string, decision: 'approve' | 'retire', note?: string, hash?: string): VerifyVerdict {
  const bank = loadBank();
  const q = bank.byId.get(qid);
  if (!q) throw new VerifyInputError('Không có câu hỏi này trong ngân hàng');
  if (hash && hash !== q.hash) throw new VerifyConflictError('Câu hỏi đã thay đổi sau khi bạn xem (phiên bản khác) — tải lại hàng chờ rồi quyết định lại.');
  const e = byQuestion(bank, loadVerdicts()).get(qid);
  const drafted = verifierDrafted(q, e);
  // [v5] a fact-check of the current version is a basis too (stale-fact / issue questions that were never blind-solved)
  const basis = e?.solve ?? e?.grounded ?? (drafted ? (e?.lastSolve ?? e?.lastDecision) : undefined);
  if (!basis) throw new VerifyInputError('Câu chưa được giải mù (hoặc đã sửa sau lần giải gần nhất) — chạy giải mù trước');
  const status = decision === 'retire' ? 'retired' : drafted ? 'active' : undefined;
  if (status) {
    const r = applyPatchItems([{ id: qid, base: q.hash, status }], { label: '(giải mù)' });
    const it = r.items[0];
    if (r.error || !it || (it.status !== 'applied' && it.status !== 'unchanged')) throw new Error(`Không đổi được trạng thái câu: ${r.error ?? it?.errors.join(' | ') ?? '?'}`);
  }
  const now = new Date();
  const v: VerifyVerdict = {
    date: localDateKey(now),
    at: localIso(now),
    qid,
    hash: q.hash,
    outcome: basis.outcome,
    picked: basis.picked,
    key: basis.key,
    decision: decision === 'approve' ? 'approved' : 'retired',
    ...(note && clean(note, 300) ? { reason: clean(note, 300) } : {}),
  };
  appendVerdicts([v]);
  return loadVerdicts().filter((x) => x.qid === qid && x.decision === v.decision).at(-1) ?? v;
}

// ── [v6] choices-only cue probe ─────────────────────────────────────────────

export const PROBE_KIND = 'choices-only' as const;
/** What a `cue` result means (ledger line, run log). */
export const CUE_LABEL = 'phương án lộ đáp án — đoán được không cần đọc đề';

/** `--json-schema` of a probe call: per item its label, the letters guessed and the giveaway (options named by content). */
export const PROBE_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'nhãn của mục, vd p1-3' },
          answer: { type: 'array', minItems: 1, items: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] }, description: 'chữ cái phương án đoán là đúng (đúng số phương án mục yêu cầu)' },
          reason: { type: 'string', description: '1 câu tiếng Việt: dấu hiệu nào trong các phương án — nêu theo nội dung, không dùng chữ cái' },
        },
        required: ['id', 'answer', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['results'],
  additionalProperties: false,
} as const;

/** One question of a probe call: a neutral label (never the id — ids name the topic), the order its options are shown in. */
export interface ProbeItem {
  q: Question;
  label: string;
  order: readonly string[];
}

/** One probe run of a question: the bank letters it picked ('' = no valid answer), the order it saw, its giveaway. */
export interface ProbeRun {
  picked: string;
  order: readonly string[];
  reason?: string;
}

/** Neutral label of the `n`-th question of a run (1-based) in probe run `run` (1 | 2). */
export const probeLabel = (run: number, n: number) => `p${run}-${n}`;

/** Prompt characters of one probe item (options only) — verifyBatches `cost`. */
export const probeCost = (q: Question) => q.options.reduce((s, o) => s + o.text.length + 8, 0) + 60;

/**
 * The two option orders of a probe: two shuffles, the key on other letters in the second — a model that answers the
 * same letter every time can never look like a cue. `attempt` = probes of this version already in the ledger.
 */
export function probeOrders(q: Pick<Question, 'hash' | 'options' | 'answer'>, attempt = 0): [string[], string[]] {
  const first = optionOrder(q, `probe#${attempt}#1`);
  const at = (o: string[]) => q.answer.map((k) => o.indexOf(k)).sort((a, b) => a - b).join(',');
  for (let i = 0; i < 8; i++) {
    const o = optionOrder(q, `probe#${attempt}#2#${i}`);
    if (at(o) !== at(first)) return [first, o];
  }
  return [first, [...first.slice(1), first[0]]]; // rotated by one: every option moves, the key with it
}

/** Probes already in the ledger for the current version of each question (qid → count) — the next probe's seed. */
export function probeAttempts(qs: Pick<Question, 'id' | 'hash'>[], probes: CueProbe[] = loadProbes()): Map<string, number> {
  const want = new Map(qs.map((q) => [q.id, q.hash]));
  const n = new Map<string, number>();
  for (const p of probes) if (want.get(p.qid) === p.hash) n.set(p.qid, (n.get(p.qid) ?? 0) + 1);
  return n;
}

/** What the probe model sees: per item a neutral label, how many to pick and the shuffled options — no stem, id or metadata. */
export function probePrompt(items: ProbeItem[], runId: string): string {
  const head = [
    'Kiểm tra "chỉ nhìn phương án" (choices-only) cho câu trắc nghiệm AWS SAA-C03. Mỗi mục dưới đây CHỈ có các phương án của một',
    'câu — đề bài được ẩn có chủ đích. Hãy đoán phương án đúng chỉ từ chính các phương án (độ dài, độ chi tiết, cách dùng từ,',
    'phương án "lạc loài", kiến thức AWS chung…).',
    '',
    'Với mỗi mục trả về:',
    '- `id`: nhãn của mục (vd `p1-3`);',
    '- `answer`: chữ cái bạn chọn — đúng số phương án ghi ở tiêu đề mục ("chọn 2" = 2 chữ cái); luôn chọn, kể cả khi chỉ đoán;',
    '- `reason`: 1 câu tiếng Việt — dấu hiệu khiến bạn chọn; nêu phương án bằng NỘI DUNG, không bằng chữ cái (thứ tự phương án đã',
    '  được xáo ngẫu nhiên); nếu chỉ đoán thì ghi "đoán".',
    'Trả lời bằng JSON đúng schema: `results` có đủ mọi nhãn bên dưới. Không dùng công cụ, không hỏi lại.',
    '',
    `- run_id: ${runId}`,
    '',
  ];
  const body = items.flatMap((it, i) => [`## ${i + 1}. \`${it.label}\` — chọn ${it.q.answer.length}`, '', ...optionLines(it.q, validOrder(it.q, it.order)), '']);
  return [...head, ...body].join('\n');
}

/** Answers of one probe call → per question id (by label) the bank letters picked ('' = none valid) and its giveaway. */
export function probeAnswers(items: ProbeItem[], output: Record<string, unknown> | undefined): Map<string, ProbeRun> {
  const results = Array.isArray(output?.results) ? (output!.results as unknown[]) : [];
  const byLabel = new Map<string, Record<string, unknown>>();
  for (const r of results) if (r && typeof r === 'object' && !Array.isArray(r)) byLabel.set(normalizeId((r as Record<string, unknown>).id), r as Record<string, unknown>);
  const out = new Map<string, ProbeRun>();
  for (const it of items) {
    const r = byLabel.get(it.label);
    if (!r) continue;
    const shown = validOrder(it.q, it.order);
    const raw = Array.isArray(r.answer) ? r.answer.join(',') : String(r.answer ?? '');
    const text = clean(r.reason, 300);
    const reason = shown && text ? remapLetterRefs(text, shown) : text;
    out.set(it.q.id, { picked: bankKeys(it.q, raw.toUpperCase().match(/[A-H]/g) ?? [], shown), order: shown ?? it.q.options.map((o) => o.key), ...(reason ? { reason } : {}) });
  }
  return out;
}

/** Runs → outcome: the first run missed the key → clean; both runs exactly the key → cue; else not settled yet (undefined). */
export function judgeProbe(key: string, picks: readonly (string | undefined)[]): ProbeOutcome | undefined {
  const [first, second] = picks;
  if (!first) return undefined;
  if (first !== key) return 'clean';
  if (!second) return undefined;
  return second === key ? 'cue' : 'clean';
}

/** A settled probe as a ledger record (undefined while not settled: no valid first answer, or the second run missing). */
export function probeRecord(q: Question, runs: readonly (ProbeRun | undefined)[], meta: { model?: string; runId: string; now?: Date }): CueProbe | undefined {
  const key = [...q.answer].sort().join('');
  const outcome = judgeProbe(key, runs.map((r) => r?.picked));
  if (!outcome) return undefined;
  const done = (runs[0]!.picked !== key ? runs.slice(0, 1) : runs.slice(0, 2)) as ProbeRun[];
  const reason = outcome === 'cue' ? done.find((r) => r.reason)?.reason : undefined;
  const now = meta.now ?? new Date();
  return {
    date: localDateKey(now),
    at: localIso(now),
    qid: q.id,
    hash: q.hash,
    probe: PROBE_KIND,
    outcome,
    picks: done.map((r) => r.picked),
    key,
    ...(meta.model ? { model: meta.model } : {}),
    runId: meta.runId,
    orders: done.map((r) => r.order.join('')),
    ...(reason ? { reason } : {}),
  };
}

/** One cue-probe ledger line: 🎯 + outcome for people, the JSON (with `"probe":"choices-only"`) for the app. */
export function formatProbe(p: CueProbe): string {
  const what =
    p.outcome === 'cue'
      ? `🎯 ${CUE_LABEL} (${p.picks.length} lần đều chọn ${p.key ?? '—'})`
      : `🎯 dò phương án (không có đề): không lộ đáp án (${p.picks.map((x, i) => `lần ${i + 1} chọn ${x || '—'}`).join(' · ')} · đáp án ${p.key ?? '—'})`;
  const why = clean(p.reason, 160);
  const data = {
    at: p.at,
    hash: p.hash,
    probe: PROBE_KIND,
    outcome: p.outcome,
    picks: p.picks,
    key: p.key,
    model: p.model,
    run: p.runId,
    orders: p.orders?.length ? p.orders.filter((o) => ORDER_RE.test(o)) : undefined,
    reason: p.reason ? clean(p.reason, 300) : undefined,
  };
  return `- ${p.date} · \`${p.qid}\` · ${what}${p.model ? ` · ${p.model}` : ''}${why ? ` — ${why}` : ''} <!-- verify ${ledgerJson(data)} -->`;
}

function parseProbe(d: Record<string, unknown>, date: string, qid: string, line: number): CueProbe | undefined {
  if (d.probe !== PROBE_KIND || typeof d.hash !== 'string' || (d.outcome !== 'cue' && d.outcome !== 'clean')) return undefined;
  const s = (k: string) => (typeof d[k] === 'string' && d[k] ? (d[k] as string) : undefined);
  const picks = Array.isArray(d.picks) ? d.picks.map((x) => String(x ?? '')).filter((x) => /^[A-H]*$/.test(x)).slice(0, 2) : [];
  const p: CueProbe = { line, date, qid, hash: d.hash, probe: PROBE_KIND, outcome: d.outcome, picks };
  if (s('at')) p.at = s('at');
  if (s('key')) p.key = s('key');
  if (s('model')) p.model = s('model');
  if (s('run')) p.runId = s('run');
  const orders = Array.isArray(d.orders) ? d.orders.map((x) => String(x ?? '')).filter((o) => ORDER_RE.test(o)).slice(0, 2) : [];
  if (orders.length) p.orders = orders;
  if (s('reason')) p.reason = s('reason');
  return p;
}

/**
 * Questions for a cue-probe run (verify scope 'cues'): explicit `ids` (retired never, sealed only when named), else the
 * questions of `pack`, else the exam-grade AI questions — active, origin ai / doc, created on or after `since`
 * (quality.exam_spec_since; '' = any date); never sealed, never one already probed for its current version. Newest first,
 * at most MAX_VERIFY.
 */
export function cueTargets(
  bank: BankState,
  params: VerifyParams,
  opts: { since?: string } = {},
  probes: CueProbe[] = loadProbes(),
  sealed: ReadonlySet<string> = sealedIds(),
): { ids: string[]; total: number } {
  if (Array.isArray(params.ids)) {
    const ids = [...new Set(params.ids.map((x) => String(x).trim()))].filter((id) => {
      const q = bank.byId.get(id);
      return !!q && q.status !== 'retired';
    });
    return { ids: ids.slice(0, MAX_VERIFY), total: ids.length };
  }
  const probed = new Set(probes.filter((p) => bank.byId.get(p.qid)?.hash === p.hash).map((p) => p.qid));
  const pack = typeof params.pack === 'string' && params.pack ? params.pack : undefined;
  const since = /^\d{4}-\d{2}-\d{2}/.test(opts.since ?? '') ? opts.since!.slice(0, 10) : '';
  const pool = bank.questions.filter((q) => {
    if (sealed.has(q.id) || probed.has(q.id)) return false;
    if (pack) return q.status !== 'retired' && (q.pack === pack || q.file === pack);
    return q.status === 'active' && (q.origin === 'ai' || q.origin === 'doc') && (!since || (q.created ?? '') >= since);
  });
  pool.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? '') || byNumericId(a, b));
  return { ids: pool.slice(0, MAX_VERIFY).map((q) => q.id), total: pool.length };
}

/** Probe results of the current versions (retired / sealed questions left out); undefined while nothing was probed. */
function cueSummary(bank: BankState, probes: CueProbe[], sealed: ReadonlySet<string>): CueSummary | undefined {
  const current = new Map<string, CueProbe>();
  const any = new Set<string>();
  for (const p of probes) {
    const q = bank.byId.get(p.qid);
    if (!q || q.status === 'retired' || sealed.has(q.id)) continue;
    any.add(q.id);
    if (p.hash === q.hash) current.set(q.id, p); // oldest first: the newest probe of this version wins
  }
  if (!any.size) return undefined;
  const t = (p: CueProbe) => Date.parse(p.at ?? p.date) || 0;
  const items = [...current.values()].filter((p) => p.outcome === 'cue').sort((a, b) => t(b) - t(a) || (b.line ?? 0) - (a.line ?? 0));
  return { probed: current.size, cue: items.length, clean: current.size - items.length, stale: any.size - current.size, items };
}
