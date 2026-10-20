// Anki export: questions → Anki notes (front = stem + options, back = answer + explanation, tags = domain / topic /
// task / services + an id tag). Two ways in: a TSV file with Anki's import headers (Anki ≥ 2.1.55; the GUID column is
// derived from the question id, so a re-import updates the same notes instead of duplicating them) or a direct push
// through the AnkiConnect add-on (2055492159): notes pushed before are found by their id tag and updated, new ones
// are added with duplicate scope = deck. All HTML is generated here from escaped text (no raw HTML from the bank).
// Questions of a sealed form ([γ] sealed.ts) are never exported, whatever the scope (an explicit id is silently skipped).
import { applyFilters, modePool } from '../../shared/filters.ts';
import { sealedIds } from './sealed.ts';
import type { AnkiExportRequest, AnkiPushResult, AnkiStatus, Question, QuestionState } from '../../shared/types.ts';

export const ANKI_TAG_ROOT = 'SAA-C03';
export const ID_TAG = `${ANKI_TAG_ROOT}::id::`;
export const DEFAULT_MODEL = 'Basic';
export const ANKI_SCOPES: AnkiExportRequest['scope'][] = ['all', 'filter', 'ids', 'wrong', 'due', 'flagged'];

// ── selection ───────────────────────────────────────────────────────────────

export interface AnkiSelection {
  questions: Question[];
  missing: string[]; // scope 'ids': unknown or retired ids
}

/**
 * Questions for an export request. all = every active question · filter = active ∩ filters · wrong / due / flagged =
 * the practice modes' pools (last answer wrong — or ever wrong —, FSRS due without the daily cap, flagged or unsure),
 * optionally narrowed by filters · ids = exactly those (bank order irrelevant; retired ones reported as missing).
 * `sealed` questions (default: the current sealed forms) are left out of every scope — not reported as missing.
 */
export function selectForAnki(
  req: AnkiExportRequest,
  bank: { questions: Question[]; byId: Map<string, Question> },
  states: Record<string, QuestionState>,
  sealed: ReadonlySet<string> = sealedIds(),
): AnkiSelection {
  if (req.scope === 'ids') {
    const questions: Question[] = [];
    const missing: string[] = [];
    for (const id of new Set((req.ids ?? []).map((s) => String(s).trim()).filter(Boolean))) {
      const q = bank.byId.get(id);
      if (q && sealed.has(q.id)) continue;
      if (q && q.status !== 'retired') questions.push(q);
      else missing.push(id);
    }
    return { questions, missing };
  }
  const active = bank.questions.filter((q) => q.status === 'active' && !sealed.has(q.id));
  const pool = req.scope === 'all' ? active : applyFilters(active, req.filters ?? {});
  if (req.scope === 'wrong') return { questions: req.everWrong ? pool.filter((q) => states[q.id]?.everWrong) : modePool('retry-wrong', pool, states), missing: [] };
  if (req.scope === 'due') return { questions: modePool('srs', pool, states), missing: [] };
  if (req.scope === 'flagged') return { questions: modePool('flagged', pool, states), missing: [] };
  return { questions: pool, missing: [] };
}

// ── HTML (safe Markdown subset) ─────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Inline Markdown on escaped text: `code`, **bold**, *italic*, [text](http(s)://…). */
function inline(text: string): string {
  const codes: string[] = [];
  let s = escapeHtml(text.replace(/\0/g, '')).replace(/`([^`]+)`/g, (_, c: string) => `\0${codes.push(`<code>${c}</code>`) - 1}\0`);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "<a href='$2'>$1</a>");
  s = s.replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<b>$1</b>');
  s = s.replace(/(^|[^*\w])\*(?=\S)([^*]+?)(?<=\S)\*(?![*\w])/g, '$1<i>$2</i>');
  return s.replace(/\0(\d+)\0/g, (_, i: string) => codes[Number(i)]);
}

/**
 * Markdown → single-line HTML: paragraphs (soft-wrapped lines joined), - / 1. lists with indented continuations,
 * > quotes, headings as bold lines, ``` fences. Never emits a tab or newline (TSV-safe) nor a double quote.
 */
export function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | undefined;
  let quote: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = undefined;
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote>${mdToHtml(quote.join('\n'))}</blockquote>`);
    quote = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\t/g, '    ');
    if (/^\s*```/.test(line)) {
      flushPara();
      flushList();
      flushQuote();
      const code: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(escapeHtml(lines[i].replace(/\t/g, '    ')));
      out.push(`<pre><code>${code.join('<br>')}</code></pre>`);
      continue;
    }
    if (!line.trim()) {
      flushPara();
      flushList();
      flushQuote();
      continue;
    }
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) {
      flushPara();
      flushList();
      quote.push(q[1]);
      continue;
    }
    flushQuote();
    const h = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      out.push(`<p><b>${inline(h[1])}</b></p>`);
      continue;
    }
    const li = /^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/.exec(line);
    if (li) {
      flushPara();
      const tag = li[1] ? 'ol' : 'ul';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push(li[2]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ' ' + line.trim();
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  flushQuote();
  return out.join('');
}

const option = (key: string, text: string) => `<div style='margin:.35em 0'><b>${escapeHtml(key)}.</b> ${inline(text)}</div>`;

export function cardFront(q: Question): string {
  return `<div style='text-align:left'>${mdToHtml(q.stem)}<div style='margin-top:.8em'>${q.options.map((o) => option(o.key, o.text)).join('')}</div></div>`;
}

export function cardBack(q: Question, includeExplanation = true): string {
  const correct = q.options.filter((o) => q.answer.includes(o.key));
  let html = `<div style='text-align:left'><div><b>✅ ${q.answer.length > 1 ? 'Đáp án đúng' : 'Đáp án'}: ${escapeHtml(q.answer.join(', '))}</b></div>`;
  html += correct.map((o) => option(o.key, o.text)).join('');
  if (includeExplanation && q.explanation.trim()) html += `<hr>${mdToHtml(q.explanation)}`;
  return `${html}<div style='margin-top:.8em;font-size:.75em;opacity:.6'>SAA-C03 · ${escapeHtml(q.id)}</div></div>`;
}

const tagPart = (s: string) => s.trim().replace(/\s+/g, '_').replace(/["\\]/g, '');

/** SAA-C03::domain::…, ::topic::…, ::task::…, ::service::… and SAA-C03::id::<qid> (finds the note again on a push). */
export function cardTags(q: Question): string[] {
  const t = [`${ANKI_TAG_ROOT}::domain::${tagPart(q.domain)}`, `${ANKI_TAG_ROOT}::topic::${tagPart(q.topic)}`];
  if (q.task) t.push(`${ANKI_TAG_ROOT}::task::${tagPart(q.task)}`);
  for (const s of q.services) if (s.trim()) t.push(`${ANKI_TAG_ROOT}::service::${tagPart(s)}`);
  t.push(ID_TAG + tagPart(q.id));
  return [...new Set(t)];
}

/** Stable note GUID per question id: importing a newer file updates the same notes (keeps review history). */
export function noteGuid(id: string): string {
  return `saa-c03:${id}`;
}

// ── TSV file ────────────────────────────────────────────────────────────────

export interface AnkiNoteOptions {
  deck: string;
  model: string;
  includeExplanation: boolean;
}

const oneLine = (s: string) => s.replace(/[\t\r\n]+/g, ' ');

/** Anki "Notes in Plain Text" with file headers: columns guid · front · back · tags. */
export function ankiTsv(questions: Question[], opts: AnkiNoteOptions): string {
  const header = ['#separator:tab', '#html:true', `#notetype:${oneLine(opts.model)}`, `#deck:${oneLine(opts.deck)}`, '#guid column:1', '#tags column:4'];
  const rows = questions.map((q) => [noteGuid(q.id), cardFront(q), cardBack(q, opts.includeExplanation), cardTags(q).join(' ')].map(oneLine).join('\t'));
  return [...header, ...rows].join('\n') + '\n';
}

// ── AnkiConnect ─────────────────────────────────────────────────────────────

export const HINT_NOT_RUNNING =
  'Mở Anki (bản desktop) trên máy chạy trainer và cài add-on AnkiConnect: Tools → Add-ons → Get Add-ons… → nhập mã 2055492159 → OK, rồi khởi động lại Anki. ' +
  'Không muốn cài add-on? Dùng “⬇️ Tải file” rồi File → Import trong Anki.';
const HINT_TIMEOUT =
  'Anki không phản hồi — có thể đang mở một hộp thoại, đang đồng bộ, hoặc bị macOS cho “ngủ” khi chạy nền (App Nap). Đưa cửa sổ Anki lên trước rồi thử lại.';

export class AnkiError extends Error {
  hint?: string;
  fatal: boolean; // connection-level: stop the whole push
  constructor(message: string, hint?: string, fatal = false) {
    super(message);
    this.hint = hint;
    this.fatal = fatal;
  }
}

function hintFor(error: string): string | undefined {
  if (/api ?key/i.test(error)) return 'AnkiConnect đang bật apiKey — xoá apiKey trong Tools → Add-ons → AnkiConnect → Config, hoặc dùng “⬇️ Tải file”.';
  if (/collection is not available|collection.*(closed|not open)/i.test(error)) return 'Anki chưa mở hồ sơ (profile) nào — mở Anki và chọn hồ sơ rồi thử lại.';
  if (/model was not found|notetype|model name/i.test(error)) return 'Chọn loại ghi chú (note type) có sẵn trong Anki và có ít nhất 2 trường (thường là “Basic”).';
  return undefined;
}

/** One AnkiConnect action (API version 6: `{result, error}` replies). */
export async function ankiInvoke<T>(url: string, action: string, params: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, version: 6, params }), signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const timeout = (e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError';
    throw new AnkiError(timeout ? `Anki không trả lời sau ${Math.round(timeoutMs / 1000)} giây (${url}).` : `Không kết nối được AnkiConnect tại ${url}.`, timeout ? HINT_TIMEOUT : HINT_NOT_RUNNING, true);
  }
  let body: { result?: T; error?: string | null };
  try {
    body = (await r.json()) as typeof body;
  } catch {
    throw new AnkiError(`${url} không phải AnkiConnect (HTTP ${r.status}).`, HINT_NOT_RUNNING, true);
  }
  if (body === null || typeof body !== 'object' || !('result' in body)) throw new AnkiError(`${url} không phải AnkiConnect.`, HINT_NOT_RUNNING, true);
  if (body.error) throw new AnkiError(`AnkiConnect: ${body.error}`, hintFor(body.error));
  return body.result as T;
}

export async function ankiStatus(url: string, deck: string): Promise<AnkiStatus> {
  try {
    const version = await ankiInvoke<number>(url, 'version', {}, 2500);
    const decks = await ankiInvoke<string[]>(url, 'deckNames');
    const models = await ankiInvoke<string[]>(url, 'modelNames');
    const sort = (a: string[]) => [...a].sort((x, y) => x.localeCompare(y));
    return { url, deck, available: true, version, decks: sort(decks), models: sort(models) };
  } catch (e) {
    return { url, deck, available: false, error: (e as Error).message, hint: (e as AnkiError).hint };
  }
}

/** Anki search term "key:value" with quotes, backslashes and (optionally) the * _ wildcards escaped. */
export function searchTerm(key: string, value: string, wildcards = false): string {
  let v = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  if (!wildcards) v = v.replace(/\*/g, '\\*').replace(/_/g, '\\_');
  return `"${key}:${v}"`;
}

const CHUNK = 100;

/**
 * createDeck → notes with this deck's id tags are updated in place (updateNoteFields) → the rest go through
 * canAddNotes (duplicate = same front already in the deck) → addNotes. Connection errors stop the push; per-note
 * errors are counted and listed. HTTP-level success either way (`ok:false` + `hint`).
 */
export async function pushToAnki(url: string, questions: Question[], opts: AnkiNoteOptions): Promise<AnkiPushResult> {
  const res: AnkiPushResult = { ok: false, deck: opts.deck, model: opts.model, total: questions.length, added: 0, updated: 0, duplicates: 0, failed: 0, errors: [] };
  const note = (where: string, e: unknown, count: number) => {
    if ((e as AnkiError).fatal) throw e;
    res.failed += count;
    res.errors.push(`${where}: ${(e as Error).message}`);
    res.hint ??= (e as AnkiError).hint;
  };
  try {
    await ankiInvoke<number>(url, 'version', {}, 2500);
    const models = await ankiInvoke<string[]>(url, 'modelNames');
    if (!models.includes(opts.model)) {
      throw new AnkiError(`Anki không có loại ghi chú “${opts.model}”.`, `Loại ghi chú hiện có: ${models.slice(0, 15).join(', ')}. Chọn một loại có ít nhất 2 trường (thường là “Basic”).`);
    }
    const fieldNames = await ankiInvoke<string[]>(url, 'modelFieldNames', { modelName: opts.model });
    if (fieldNames.length < 2) throw new AnkiError(`Loại ghi chú “${opts.model}” chỉ có ${fieldNames.length} trường — cần ít nhất 2 (mặt trước, mặt sau).`);
    const [frontField, backField] = fieldNames;
    const fields = (q: Question) => ({ [frontField]: cardFront(q), [backField]: cardBack(q, opts.includeExplanation) });
    await ankiInvoke(url, 'createDeck', { deck: opts.deck });

    const existing = await ankiInvoke<number[]>(url, 'findNotes', { query: `${searchTerm('deck', opts.deck)} ${searchTerm('tag', `${ID_TAG}*`, true)}` }, 30_000);
    const noteOf = new Map<string, number>();
    for (let i = 0; i < existing.length; i += 500) {
      const info = await ankiInvoke<{ noteId: number; tags: string[] }[]>(url, 'notesInfo', { notes: existing.slice(i, i + 500) }, 30_000);
      for (const n of info) for (const t of n.tags ?? []) if (t.toLowerCase().startsWith(ID_TAG.toLowerCase())) noteOf.set(t.slice(ID_TAG.length).toLowerCase(), n.noteId);
    }

    const updates = questions.filter((q) => noteOf.has(q.id.toLowerCase()));
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK);
      try {
        const actions = chunk.map((q) => ({ action: 'updateNoteFields', version: 6, params: { note: { id: noteOf.get(q.id.toLowerCase()), fields: fields(q) } } }));
        const out = await ankiInvoke<unknown[]>(url, 'multi', { actions }, 60_000);
        out.forEach((r, j) => {
          const err = r && typeof r === 'object' && 'error' in r ? (r as { error: unknown }).error : null;
          if (err) note(chunk[j].id, new AnkiError(String(err), hintFor(String(err))), 1);
          else res.updated++;
        });
      } catch (e) {
        note('updateNoteFields', e, chunk.length);
      }
    }

    const fresh = questions.filter((q) => !noteOf.has(q.id.toLowerCase()));
    const options = { allowDuplicate: false, duplicateScope: 'deck', duplicateScopeOptions: { deckName: opts.deck, checkChildren: false, checkAllModels: false } };
    for (let i = 0; i < fresh.length; i += CHUNK) {
      const notes = fresh.slice(i, i + CHUNK).map((q) => ({ deckName: opts.deck, modelName: opts.model, fields: fields(q), tags: cardTags(q), options }));
      try {
        const can = await ankiInvoke<boolean[]>(url, 'canAddNotes', { notes }, 60_000);
        const addable = notes.filter((_, j) => can[j]);
        res.duplicates += notes.length - addable.length;
        if (!addable.length) continue;
        const ids = await ankiInvoke<(number | null)[]>(url, 'addNotes', { notes: addable }, 120_000);
        for (const id of ids) {
          if (id) res.added++;
          else res.failed++;
        }
      } catch (e) {
        note('addNotes', e, notes.length);
      }
    }
    res.ok = res.failed === 0;
  } catch (e) {
    res.errors.push((e as Error).message);
    res.hint = (e as AnkiError).hint ?? res.hint;
  }
  return res;
}
