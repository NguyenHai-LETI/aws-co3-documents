// [γ] Sealed forms (A1): questions held back from every practice mode, search, Anki, the Bank lists and the AI coach so
// that readiness can be measured on questions the learner has never seen ("điểm trên câu mới"). Stored in
// <data>/results/sealed.md — synced with the results, written by the app only (never by the AI).
//
// File: YAML front matter `kind: sealed`, `size` (questions per form) and `forms: [{id, status, used_at?, attempt_id?,
// released_at?, ids: [...]}]` + a short Markdown note. Creation is deterministic — no timestamps, ids in a seeded-hash
// order — so two machines creating the forms from the same bank and history write byte-identical files.
//
// Selection (createForms): active questions that are in the exam scope, have no sibling ([v5] clusters.ts: variant_of either
// way, lexical / semantic duplicates, a similar stem with the same topic or key), no open issue, no low
// rating, no high-severity lint flaw and were never in an earlier form. Stratified by exam domain weight and round-robin
// over the tasks of each domain; never-seen questions first (a second pass may take seen ones), [v6] tier A then the
// other exam-like questions (shared/tier.ts), longer stems first, a seeded hash for ties. The picks of each task are
// dealt to the forms in snake order, so the forms are equivalent.
// [v6] addForm (`npm run seal -- --add`): one more form while others are still sealed — never-seen questions only,
// optionally one tier, refused (or smaller with allowShort) when a domain lacks eligible questions.
//
// A sealed exam (mode 'sealed', [α]) uses one form as its scored items; after submit results.ts calls markFormUsed()
// and the questions return to practice. "Mở sớm" = releaseForm(). Must not import results.ts.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { RESULTS_DIR, rel, type AppConfig } from '../config.ts';
import { correctOutOfScope, type BankState } from './bank.ts';
import { fileSig } from './index-db.ts';
import { asString, asStringList, splitFrontMatter } from './frontmatter.ts';
import { lintQuestion } from './lint.ts';
import { loadIssues } from './issues.ts';
import { aggregateRatings, loadRatings, lowRatedIds } from './ratings.ts';
import { CLUSTER_RULES, buildClusters, clusterIndex, clusteredIds } from './clusters.ts';
import { localIso } from './time.ts';
import { latestVerdicts } from './verify.ts'; // used at call time only (verify.ts imports this module too)
import { examRank, tierOf } from '../../shared/tier.ts';
import type { Attempt, Question, SealedForm, SealedFormSummary, SealedState, SealedStatus, Taxonomy, Tier, VerifyVerdict } from '../../shared/types.ts';

export const SEALED_FILE = path.join(RESULTS_DIR, 'sealed.md');
export const MIN_FORM_SIZE = 10;
export const MAX_FORMS = 5;
export const MAX_FORM_SIZE = 65;
const SEED = 'saa-c03-sealed-v1'; // changing it changes every future selection (existing files are never re-picked)

/** A refused sealed-form operation; `status` is the HTTP status the routes answer with. */
export class SealedError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ── file ────────────────────────────────────────────────────────────────────

interface Loaded {
  state: SealedState;
  sealed: Set<string>; // ids of forms with status 'sealed' — on a broken file: every id the file lists (fail closed)
  key: string; // short hash of the sealed ids ('' = none)
  exists: boolean;
  error?: string; // the file exists but cannot be read: no form is usable, nothing is written until it is fixed
}

const EMPTY: SealedState = { forms: [], size: 0 };
let memo: { sig: string; loaded: Loaded } | undefined;
const ID_LIKE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/**
 * Every question id the raw text lists after an `ids:` key — a flow list (`ids: [a, b]`, possibly over several lines) or a
 * block list (`ids:` then `- a` lines). Used when the file cannot be read: those questions stay hidden (fail closed).
 */
export function idsInText(text: string): string[] {
  const out = new Set<string>();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*(?:-\s*)?ids:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const rest = m[1].trim();
    if (rest.startsWith('[')) {
      let body = rest.slice(1);
      for (let j = i; !body.includes(']') && j + 1 < lines.length; ) body += ` ${lines[++j]}`;
      for (const x of body.split(']')[0].split(',')) {
        const id = x.trim().replace(/^['"]|['"]$/g, '');
        if (ID_LIKE.test(id)) out.add(id);
      }
    } else if (!rest) {
      for (let j = i + 1; j < lines.length; j++) {
        const b = /^\s*-\s+['"]?([A-Za-z0-9][\w-]*)['"]?\s*$/.exec(lines[j]);
        if (!b) break;
        out.add(b[1]);
      }
    }
  }
  return [...out];
}

const STATUSES: readonly SealedForm['status'][] = ['sealed', 'used', 'released'];

/** Strict parse: any doubt (conflict markers, YAML error, missing / duplicate form id, unknown status) is an error. */
function parseSealed(text: string): { state: SealedState; error?: string } {
  if (/^(?:<{7}|={7}|>{7})(?:\s|$)/m.test(text)) return { state: EMPTY, error: 'còn dấu xung đột git (<<<<<<< / ======= / >>>>>>>)' };
  const fm = splitFrontMatter(text);
  if (!fm.hasFrontMatter || fm.error) return { state: EMPTY, error: fm.error ?? 'không có front matter' };
  const d = fm.data;
  if (d.kind !== 'sealed') return { state: EMPTY, error: 'front matter không có kind: sealed' };
  if (!Array.isArray(d.forms)) return { state: EMPTY, error: 'thiếu danh sách forms' };
  const forms: SealedForm[] = [];
  for (const [n, raw] of d.forms.entries()) {
    if (!raw || typeof raw !== 'object') return { state: EMPTY, error: `mục thứ ${n + 1} của forms không hợp lệ` };
    const r = raw as Record<string, unknown>;
    const id = asString(r.id)?.trim();
    if (!id) return { state: EMPTY, error: `đề thứ ${n + 1} thiếu id` };
    if (forms.some((f) => f.id === id)) return { state: EMPTY, error: `id đề trùng: ${id}` };
    if (!STATUSES.includes(r.status as SealedForm['status'])) return { state: EMPTY, error: `status của ${id} không hợp lệ (“${String(r.status ?? '')}”)` };
    if (!Array.isArray(r.ids)) return { state: EMPTY, error: `${id} thiếu danh sách ids` };
    const f: SealedForm = { id, ids: [...new Set(asStringList(r.ids))], status: r.status as SealedForm['status'] };
    const usedAt = asString(r.used_at);
    const attempt = asString(r.attempt_id);
    const releasedAt = asString(r.released_at);
    if (usedAt) f.usedAt = usedAt;
    if (attempt) f.attempt = attempt;
    if (releasedAt) f.releasedAt = releasedAt;
    forms.push(f);
  }
  const size = Number(d.size) > 0 ? Math.round(Number(d.size)) : Math.max(0, ...forms.map((f) => f.ids.length));
  return { state: { forms, size, file: rel(SEALED_FILE) } };
}

/** The file as parsed now (re-read only when its signature changes — cheap enough for every request). */
function current(): Loaded {
  const sig = fileSig(SEALED_FILE);
  if (memo && memo.sig === sig) return memo.loaded;
  let loaded: Loaded = { state: EMPTY, sealed: new Set(), key: '', exists: false };
  if (sig) {
    let text = '';
    let readError: string | undefined;
    try {
      text = fs.readFileSync(SEALED_FILE, 'utf8');
    } catch (e) {
      readError = (e as Error).message;
    }
    const p = readError ? { state: EMPTY, error: readError } : parseSealed(text);
    // fail closed: a file that cannot be trusted keeps every id it lists hidden (a conflict or hand edit never releases)
    const sealed = new Set(p.error ? idsInText(text) : p.state.forms.filter((f) => f.status === 'sealed').flatMap((f) => f.ids));
    if (p.error) console.warn(`  ⚠️ ${rel(SEALED_FILE)} đang lỗi (${p.error}) — ${sealed.size} câu trong file vẫn được giữ kín, app không ghi vào file cho tới khi sửa xong.`);
    const key = sealed.size ? crypto.createHash('sha1').update([...sealed].sort().join(',')).digest('hex').slice(0, 12) : '';
    loaded = { state: p.state, sealed, key, exists: true, error: p.error };
  }
  memo = { sig, loaded };
  return loaded;
}

/**
 * What is wrong with results/sealed.md and how to fix it (Vietnamese, shown by /api/sealed, /api/meta, Thống kê and Tạo
 * bài test) — undefined while the file is fine or absent.
 */
export function sealedError(): string | undefined {
  const cur = current();
  if (!cur.error) return undefined;
  return (
    `${rel(SEALED_FILE)} đang lỗi: ${cur.error}. ${cur.sealed.size} câu có trong file vẫn được giữ kín và app không ghi gì vào file cho tới khi sửa xong. ` +
    'Cách sửa: mở file, bỏ các dòng xung đột <<<<<<< / ======= / >>>>>>> (giữ một phiên bản đầy đủ), mỗi đề một id riêng (S1, S2…), ' +
    'status là sealed / used / released — hoặc chạy `npm run seal -- --reset --force` để bỏ mọi đề rồi tạo lại.'
  );
}

/** Refuses a write while the file is broken (it would overwrite what the learner still has to fix). */
function assertWritable(cur: Loaded): void {
  if (cur.error) throw new SealedError(409, sealedError() ?? `${rel(SEALED_FILE)} đang lỗi`);
}

const STATUS_VI: Record<SealedForm['status'], string> = { sealed: '🔒 niêm phong', used: '✅ đã làm', released: '🔓 đã mở sớm' };

/** Front matter + note. Deterministic: same state → same bytes (ids as one flow list per form). */
function renderSealed(state: SealedState): string {
  const forms = state.forms.map((f) => {
    const o: Record<string, unknown> = { id: f.id, status: f.status };
    if (f.usedAt) o.used_at = f.usedAt;
    if (f.attempt) o.attempt_id = f.attempt; // not "attempt": results.ts skips files whose front matter lacks that word
    if (f.releasedAt) o.released_at = f.releasedAt;
    o.ids = f.ids;
    return o;
  });
  const doc = new YAML.Document({ kind: 'sealed', size: state.size, forms });
  const seq = doc.get('forms', true);
  if (YAML.isSeq(seq)) {
    for (const item of seq.items) {
      const ids = YAML.isMap(item) ? item.get('ids', true) : undefined;
      if (YAML.isSeq(ids)) ids.flow = true;
    }
  }
  const rows = state.forms.map((f) => {
    const when = f.status === 'used' ? f.usedAt : f.status === 'released' ? f.releasedAt : undefined;
    return `| ${f.id} | ${STATUS_VI[f.status]}${when ? ` ${when.slice(0, 10)}` : ''} | ${f.ids.length} |`;
  });
  return [
    `---\n${doc.toString({ lineWidth: 0 })}---`,
    '',
    '# 🔒 Đề niêm phong',
    '',
    '> File do app quản lý (`npm run seal`) — đừng sửa tay. Câu của đề đang niêm phong không xuất hiện khi luyện, tìm kiếm, xuất Anki,',
    '> danh sách Ngân hàng hay kế hoạch AI Coach, để điểm đề niêm phong đo năng lực trên câu **chưa từng gặp**.',
    '> Đọc danh sách id ở trên làm mất ý nghĩa đó. Làm đề: Thống kê → Đề niêm phong · `npm run seal -- --status | --release S1`.',
    '',
    '| Đề | Trạng thái | Số câu |',
    '|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

function saveSealed(state: SealedState): void {
  fs.mkdirSync(path.dirname(SEALED_FILE), { recursive: true });
  const tmp = `${SEALED_FILE}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, renderSealed(state));
  fs.renameSync(tmp, SEALED_FILE); // a new inode → fileSig changes → every reader re-parses
  memo = undefined;
}

// ── reading ─────────────────────────────────────────────────────────────────

/** Current sealed forms (empty when none were created). Shared object — do not mutate. */
export function loadSealed(): SealedState {
  return current().state;
}

/** Ids of every question in a form whose status is 'sealed' (hidden everywhere except the sealed exam). Shared — do not mutate. */
export function sealedIds(): Set<string> {
  return current().sealed;
}

/** Short hash of sealedIds() ('' = nothing sealed) — part of the cache keys of what hides sealed questions. */
export function sealedKey(): string {
  return current().key;
}

/** Question ids of one form ([] when unknown), whatever its status. */
export function formIds(formId: string): string[] {
  return [...(current().state.forms.find((f) => f.id === formId)?.ids ?? [])];
}

function summary(f: SealedForm): SealedFormSummary {
  const o: SealedFormSummary = { id: f.id, status: f.status, count: f.ids.length };
  if (f.usedAt) o.usedAt = f.usedAt;
  if (f.attempt) o.attempt = f.attempt;
  if (f.releasedAt) o.releasedAt = f.releasedAt;
  return o;
}

/** GET /api/sealed: the forms without any question id. */
export function sealedStatus(): SealedStatus {
  const cur = current();
  const error = sealedError();
  return { forms: cur.state.forms.map(summary), size: cur.state.size, ...(cur.exists ? { file: rel(SEALED_FILE) } : {}), sealed: cur.sealed.size, ...(error ? { error } : {}) };
}

// ── transitions ─────────────────────────────────────────────────────────────

/**
 * A sealed exam was submitted: the form becomes 'used' and its questions return to the practice pool. No-op for an
 * unknown form or one that is not sealed any more (a second submit of the same form keeps the first use). Never throws:
 * results.ts calls it after the attempt file was written.
 */
export function markFormUsed(formId: string, attemptId: string, at: string): void {
  try {
    const cur = current();
    if (cur.error) {
      console.warn(`  ⚠️ Chưa đánh dấu được đề ${formId} đã làm (bài ${attemptId}): ${rel(SEALED_FILE)} đang lỗi (${cur.error}) — sửa file rồi đánh dấu lại.`);
      return;
    }
    const form = cur.state.forms.find((f) => f.id === formId);
    if (!form || form.status !== 'sealed') return;
    saveSealed({ ...cur.state, forms: cur.state.forms.map((f) => (f.id === formId ? { ...f, status: 'used' as const, usedAt: at, attempt: attemptId } : f)) });
  } catch (e) {
    console.error('markFormUsed failed', e);
  }
}

/** Learner opens a form early: status 'released', questions return to the practice pool without a sealed score. */
export function releaseForm(formId: string): SealedForm {
  const id = String(formId ?? '').trim();
  if (!id) throw new SealedError(400, 'Thiếu mã đề (form), ví dụ “S1”.');
  const cur = current();
  assertWritable(cur);
  const form = cur.state.forms.find((f) => f.id === id);
  if (!form) throw new SealedError(404, `Không có đề niêm phong “${id}”.`);
  if (form.status !== 'sealed') throw new SealedError(409, `Đề ${id} không còn niêm phong (đã làm hoặc đã mở sớm).`);
  const released: SealedForm = { ...form, status: 'released', releasedAt: localIso() };
  saveSealed({ ...cur.state, forms: cur.state.forms.map((f) => (f.id === id ? released : f)) });
  return released;
}

/**
 * `npm run seal -- --reset`: forget every form (attempt files keep their `sealed_form`; new forms continue the numbering).
 * Refused while the file is broken unless `force` (`--reset --force`): fixing the file by hand keeps the forms.
 */
export function resetSealed(opts: { force?: boolean } = {}): void {
  if (!opts.force) assertWritable(current());
  fs.rmSync(SEALED_FILE, { force: true });
  memo = undefined;
}

// ── selection ───────────────────────────────────────────────────────────────

const hashOf = (s: string) => crypto.createHash('sha1').update(s).digest('hex');
const clampInt = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, n)) : dflt;
};

export const SIBLING_STEM = CLUSTER_RULES.similarStem; // stem word overlap that links two questions (same topic or same key)
export const SIBLING_SAME_KEY = CLUSTER_RULES.sameKeyStem; // …or this much with the same topic + correct option text (rephrased V1/V2 twins)

/**
 * [v5] Questions with a sibling — practising one would leak the other's answer. The single definition lives in
 * clusters.ts (variant_of either way, lexical / semantic duplicates (`pairs`), similar stems with the same topic or key,
 * anti-chaining guards). Retired questions are no siblings (nobody practises them).
 */
export function siblingIds(questions: (Pick<Question, 'id' | 'stem' | 'options' | 'answer' | 'variantOf' | 'status'> & { topic?: string })[], pairs: { a: string; b: string }[] = []): Set<string> {
  return clusteredIds(buildClusters(questions, pairs));
}

/** Questions the learner has seen: an answer with a pick or time on it (a never-viewed blank is no exposure). */
export function seenIds(attempts: Attempt[]): Set<string> {
  const seen = new Set<string>();
  for (const a of attempts) for (const r of a.answers) if (r.pick || r.t > 0) seen.add(r.q);
  return seen;
}

export interface Eligibility {
  pool: Question[];
  excluded: { inactive: number; earlier: number; outOfScope: number; siblings: number; quality: number; unverified: number };
}

/**
 * An AI-written question (origin ai / doc) may be sealed only once a second model confirmed its key for the current version:
 * blind solve `ok`, a grounded fact-check `correct`, or a review the learner approved. A sealed question is never shown in
 * practice, so a wrong key there would go unnoticed until the form is taken. Imported / hand-written questions need no verdict.
 */
export function verifiedForSealing(q: Pick<Question, 'origin' | 'hash'>, v: VerifyVerdict | undefined): boolean {
  if (q.origin !== 'ai' && q.origin !== 'doc') return true;
  const ok = (x: VerifyVerdict | undefined) =>
    !!x && x.hash === q.hash && (x.outcome === 'ok' || x.decision === 'approved' || (x.check === 'grounded' && x.fact === 'correct'));
  return ok(v) || ok(v?.grounded);
}

/** Candidates for new forms and why the others were left out (see the header for the rules). */
export function eligibleForSealing(bank: BankState, _cfg: AppConfig, history: Set<string> = new Set(), verdicts?: Record<string, VerifyVerdict>): Eligibility {
  const tax = bank.taxonomy;
  const active = bank.questions.filter((q) => q.status === 'active');
  // [v5] the cluster index (clusters.ts, semantic pairs per the current config) is the single sibling definition; only
  // forms created from now on see it — an existing results/sealed.md is never re-picked
  const siblings = clusteredIds(clusterIndex(bank));
  let issues = new Set<string>();
  let lowRated = new Set<string>();
  try {
    issues = new Set(loadIssues().filter((i) => i.open).map((i) => i.qid));
    lowRated = new Set(lowRatedIds(aggregateRatings(loadRatings())));
  } catch {
    // unreadable issue / rating files: no exclusion from them
  }
  let verdictOf = verdicts;
  if (!verdictOf) {
    try {
      verdictOf = latestVerdicts(bank);
    } catch {
      verdictOf = {}; // unreadable bank/verify.md: AI-written questions simply count as unverified
    }
  }
  const excluded = { inactive: bank.questions.length - active.length, earlier: 0, outOfScope: 0, siblings: 0, quality: 0, unverified: 0 };
  const pool: Question[] = [];
  for (const q of active) {
    if (history.has(q.id)) excluded.earlier++;
    else if (correctOutOfScope(q, tax).length) excluded.outOfScope++; // never on the real exam, whatever practice.exclude_out_of_scope says
    else if (siblings.has(q.id)) excluded.siblings++;
    else if (issues.has(q.id) || lowRated.has(q.id) || lintQuestion(q, tax).some((f) => f.severity === 'high')) excluded.quality++;
    else if (!verifiedForSealing(q, verdictOf[q.id])) excluded.unverified++;
    else pool.push(q);
  }
  return { pool, excluded };
}

/** Questions per form for each domain: exam weights, largest remainder (50 → 15 / 13 / 12 / 10). */
export function domainQuotas(size: number, tax: Taxonomy): Map<string, number> {
  const total = tax.domains.reduce((s, d) => s + d.weight, 0) || 1;
  const rows = tax.domains.map((d, i) => ({ id: d.id, i, exact: (size * d.weight) / total, n: Math.floor((size * d.weight) / total) }));
  let left = size - rows.reduce((s, r) => s + r.n, 0);
  for (const r of [...rows].sort((a, b) => b.exact - b.n - (a.exact - a.n) || a.i - b.i)) {
    if (left <= 0) break;
    r.n++;
    left--;
  }
  return new Map(rows.map((r) => [r.id, r.n]));
}

interface Candidate {
  q: Question;
  seen: boolean;
  rank: [number, number, number, string]; // never-seen first · [v6] tier A, other exam-like, rest · longer stems first (10-word bands) · seeded hash
}

/** `nForms` forms of up to `size` questions from `pool` (best candidates first, see the header). */
export function pickForms(pool: Question[], nForms: number, size: number, tax: Taxonomy, seen: Set<string>): Question[][] {
  const ranked: Candidate[] = pool
    .map((q) => ({
      q,
      seen: seen.has(q.id),
      rank: [seen.has(q.id) ? 1 : 0, examRank(q, tax), -Math.min(12, Math.floor((q.words ?? 0) / 10)), hashOf(`${SEED}|${q.id}`)] as Candidate['rank'],
    }))
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2] || (a.rank[3] < b.rank[3] ? -1 : a.rank[3] > b.rank[3] ? 1 : 0));
  const forms: Question[][] = Array.from({ length: nForms }, () => []);
  const taken = new Set<string>();
  const quota = domainQuotas(size, tax);
  const inDomain = (f: number, d: string) => forms[f].reduce((n, q) => n + (q.domain === d ? 1 : 0), 0);
  // multiple-response items are harder: keep their number equal across forms (± 1)
  const multi = (q: Question) => q.answer.length > 1;
  const multiIn = (f: number) => forms[f].reduce((n, q) => n + (multi(q) ? 1 : 0), 0);
  const take = (bucket: Candidate[], f: number): Candidate | undefined => {
    if (!bucket.length) return undefined;
    const ahead = multiIn(f) > Math.min(...forms.map((_, i) => multiIn(i)));
    const i = ahead ? bucket.findIndex((c) => !multi(c.q)) : 0;
    return bucket.splice(Math.max(0, i), 1)[0];
  };
  const forward = forms.map((_, i) => i);
  const backward = [...forward].reverse();
  for (const pass of [0, 1]) {
    for (const d of tax.domains) {
      const want = quota.get(d.id) ?? 0;
      const tasks = tax.tasks.filter((t) => t.domain === d.id).map((t) => t.id);
      const buckets = [...tasks, ''].map((t) =>
        ranked.filter((c) => c.q.domain === d.id && !taken.has(c.q.id) && (pass === 1 || !c.seen) && (tasks.includes(c.q.task ?? '') ? c.q.task : '') === t),
      );
      for (let round = 0; ; round++) {
        let progress = false;
        buckets.forEach((bucket, ti) => {
          for (const f of (round + ti) % 2 ? backward : forward) {
            if (inDomain(f, d.id) >= want) continue;
            const c = take(bucket, f);
            if (!c) break;
            forms[f].push(c.q);
            taken.add(c.q.id);
            progress = true;
          }
        });
        if (!progress) break;
      }
    }
  }
  // a domain without enough candidates: fill up with the best remaining questions of any domain (never-seen first)
  for (const pass of [0, 1]) {
    const rest = ranked.filter((c) => !taken.has(c.q.id) && (pass === 1 || !c.seen));
    for (;;) {
      let f = -1;
      for (let i = 0; i < forms.length; i++) if (forms[i].length < size && (f < 0 || forms[i].length < forms[f].length)) f = i;
      const c = f < 0 ? undefined : take(rest, f);
      if (!c) break;
      forms[f].push(c.q);
      taken.add(c.q.id);
    }
  }
  return forms;
}

/** Next form ids after every "S<n>" used so far (in the file or in attempt files): S1, S2 … then S3, S4 after a reset. */
function nextFormIds(forms: SealedForm[], attempts: Attempt[], n: number): string[] {
  let max = 0;
  for (const id of [...forms.map((f) => f.id), ...attempts.map((a) => a.sealedForm ?? '')]) {
    const m = /^S(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Array.from({ length: n }, (_, i) => `S${max + i + 1}`);
}

export interface CreateResult {
  state: SealedState;
  created: string[];
  notes: string[];
  excluded: Eligibility['excluded'];
  pool: number;
}

/**
 * Creates `forms` new forms of `size` questions (defaults: config exam.sealed_forms — 2 when it is 0 — and
 * exam.sealed_size). Refused while a form is still sealed (409) or when the bank cannot fill ≥ 10 questions per form (422).
 * Used and released forms stay in the file (history); numbering continues after them.
 */
export function createForms(bank: BankState, attempts: Attempt[], cfg: AppConfig, opts: { forms?: number; size?: number } = {}): CreateResult {
  const cur = current();
  assertWritable(cur);
  const open = cur.state.forms.filter((f) => f.status === 'sealed');
  if (open.length) throw new SealedError(409, `Đang có đề niêm phong chưa làm (${open.map((f) => f.id).join(', ')}) — làm hoặc mở sớm các đề đó trước khi tạo đề mới.`);
  const n = clampInt(opts.forms ?? (cfg.exam?.sealed_forms > 0 ? cfg.exam.sealed_forms : 2), 1, MAX_FORMS, 2);
  const size = clampInt(opts.size ?? cfg.exam?.sealed_size, MIN_FORM_SIZE, MAX_FORM_SIZE, 50);
  const history = new Set(cur.state.forms.flatMap((f) => f.ids));
  const { pool, excluded } = eligibleForSealing(bank, cfg, history);
  if (pool.length < MIN_FORM_SIZE * n) throw new SealedError(422, `Không đủ câu để niêm phong: cần ít nhất ${MIN_FORM_SIZE} câu đủ điều kiện cho mỗi đề, hiện chỉ có ${pool.length}.`);
  const picks = pickForms(pool, n, size, bank.taxonomy, seenIds(attempts));
  const ids = nextFormIds(cur.state.forms, attempts, n);
  const notes: string[] = [];
  const forms: SealedForm[] = picks.map((qs, i) => {
    if (qs.length < size) notes.push(`Đề ${ids[i]} chỉ có ${qs.length}/${size} câu — ngân hàng thiếu câu đủ điều kiện (chưa gặp, trong phạm vi, không có câu anh em).`);
    // stored in a seeded-hash order: a sealed exam that keeps the form order still mixes domains and tasks
    const order = qs.map((q) => q.id).sort((a, b) => (hashOf(`order|${SEED}|${a}`) < hashOf(`order|${SEED}|${b}`) ? -1 : 1));
    return { id: ids[i], status: 'sealed', ids: order };
  });
  saveSealed({ forms: [...cur.state.forms, ...forms], size, file: rel(SEALED_FILE) });
  return { state: loadSealed(), created: ids, notes, excluded, pool: pool.length };
}

export interface AddResult extends CreateResult {
  excluded: Eligibility['excluded'] & { seen: number; tier: number }; // + seen in practice · of another tier than `tier`
  size: number; // questions in the new form
}

/**
 * [v6] `npm run seal -- --add`: ONE more form, also while other forms are still sealed (numbering continues; at most
 * MAX_FORMS sealed at once). Eligible: eligibleForSealing (active, in scope — not out / legacy —, no sibling, quality ok,
 * an AI-written key verified for its current version, never in a form), never seen (seenIds — no second pass with seen
 * questions: an added form measures questions the learner has not met) and, with `tier`, of that tier only.
 * Domain-weighted like createForms (pickForms). A domain short of eligible questions → 422 saying how many are missing
 * per domain; `allowShort` → the largest form (≥ MIN_FORM_SIZE) whose domain quotas the eligible questions fill, so the
 * smaller form keeps the exam weights.
 */
export function addForm(bank: BankState, attempts: Attempt[], cfg: AppConfig, opts: { size?: number; tier?: Tier; allowShort?: boolean } = {}): AddResult {
  const cur = current();
  assertWritable(cur);
  const open = cur.state.forms.filter((f) => f.status === 'sealed');
  if (open.length >= MAX_FORMS) {
    throw new SealedError(409, `Đang có ${open.length} đề niêm phong chưa làm (${open.map((f) => f.id).join(', ')}) — tối đa ${MAX_FORMS} đề cùng lúc: làm hoặc mở sớm bớt một đề trước khi thêm.`);
  }
  const size = clampInt(opts.size ?? cfg.exam?.sealed_size, MIN_FORM_SIZE, MAX_FORM_SIZE, 50);
  const tax = bank.taxonomy;
  const elig = eligibleForSealing(bank, cfg, new Set(cur.state.forms.flatMap((f) => f.ids)));
  const seen = seenIds(attempts);
  const excluded = { ...elig.excluded, seen: 0, tier: 0 };
  const pool: Question[] = [];
  for (const q of elig.pool) {
    if (seen.has(q.id)) excluded.seen++;
    else if (opts.tier && tierOf(q, tax) !== opts.tier) excluded.tier++;
    else pool.push(q);
  }
  const have = new Map<string, number>();
  for (const q of pool) have.set(q.domain, (have.get(q.domain) ?? 0) + 1);
  const code = (d: string) => tax.domains.find((x) => x.id === d)?.code ?? d;
  /** Domains whose quota for an `n`-question form the eligible questions cannot fill ('' = none). */
  const missing = (n: number) =>
    [...domainQuotas(n, tax)]
      .filter(([d, want]) => (have.get(d) ?? 0) < want)
      .map(([d, want]) => `${code(d)} thiếu ${want - (have.get(d) ?? 0)} câu (có ${have.get(d) ?? 0}/${want})`)
      .join(', ');
  const which = opts.tier ? ` (chỉ câu tầng ${opts.tier})` : '';
  let n = size;
  const short = missing(size);
  if (short) {
    if (!opts.allowShort) {
      throw new SealedError(
        422,
        `Không đủ câu đủ điều kiện để thêm một đề ${size} câu${which}: ${short}. Viết thêm câu cho các domain đó, giảm --size, hoặc thêm --allow-short để tạo đề nhỏ hơn vẫn giữ trọng số domain.`,
      );
    }
    // largest remainder quotas are not monotone in the size: walk down to the largest size every domain can fill
    while (n > MIN_FORM_SIZE && missing(n)) n--;
    if (missing(n)) throw new SealedError(422, `Không đủ câu đủ điều kiện cho cả một đề ${MIN_FORM_SIZE} câu${which}: ${missing(n)}.`);
  }
  const [qs] = pickForms(pool, 1, n, tax, seen);
  const [id] = nextFormIds(cur.state.forms, attempts, 1);
  const notes = n < size ? [`Đề ${id} có ${qs.length}/${size} câu${which}: ${short} — đề nhỏ hơn vẫn giữ trọng số domain.`] : [];
  const order = qs.map((q) => q.id).sort((a, b) => (hashOf(`order|${SEED}|${a}`) < hashOf(`order|${SEED}|${b}`) ? -1 : 1));
  // the file's `size` (questions per form, shown by --status) stays that of the forms already there
  saveSealed({ forms: [...cur.state.forms, { id, status: 'sealed', ids: order }], size: cur.state.forms.length ? cur.state.size : size, file: rel(SEALED_FILE) });
  return { state: loadSealed(), created: [id], notes, excluded, pool: pool.length, size: qs.length };
}

/**
 * Server start (and `npm run seal`): creates the forms when config asks for them (exam.sealed_forms > 0) and no
 * results/sealed.md exists yet — before the first practice session. An existing file is never touched (also when every
 * form is used: new forms only on request). A bank too small for the forms is reported, not thrown.
 */
export function ensureSealed(bank: BankState, attempts: Attempt[], cfg: AppConfig): SealedState {
  const want = Math.floor(Number(cfg.exam?.sealed_forms) || 0);
  const cur = current();
  if (want <= 0 || cur.exists) return cur.state;
  try {
    return createForms(bank, attempts, cfg, { forms: want, size: cfg.exam.sealed_size }).state;
  } catch (e) {
    if (!(e instanceof SealedError)) throw e;
    console.warn(`  ⚠️ Đề niêm phong chưa tạo được: ${e.message}`);
    return cur.state;
  }
}
