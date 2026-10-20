// Export & device routes: Anki export (TSV download / AnkiConnect push) and LAN access for phones. (owner: [X])
import { HttpError, RawResponse, attachment, decodeParam, isLocalRequest, readBody, route } from '../http.ts';
import type http from 'node:http';
import { context } from '../context.ts';
import { loadConfig } from '../config.ts';
import { stampParts } from '../lib/time.ts';
import { ANKI_SCOPES, AnkiError, DEFAULT_MODEL, ankiStatus, ankiTsv, cardBack, cardFront, cardTags, notebookCard, pushToAnki, readAnkiReviews, selectForAnki, type AnkiNoteOptions } from '../lib/anki.ts';
import { loadNotebook } from '../lib/notebook.ts';
import { createAttempt } from '../lib/results.ts';
import { sealedIds } from '../lib/sealed.ts';
import { scheduleSnapshot } from '../lib/snapshot.ts';
import { localDateKey } from '../lib/time.ts';
import { lanInfo, renameLanDevice, renewLanCert, revokeLanDevice, rotateLanToken, setLanAdmin, setLanEnabled } from '../lib/lan.ts';
import type { AnkiExportRequest, AnkiImportResult, AnkiPreview, AnswerRecord, SelectionFilters } from '../../shared/types.ts';

// ── LAN (phone) access ──────────────────────────────────────────────────────

/** Turning LAN access on/off and changing the code are for the person at this machine, never for a LAN device. */
function localOnly(req: http.IncomingMessage) {
  if (!isLocalRequest(req)) throw new HttpError(403, 'Chỉ thao tác được trên máy chạy app.');
}

/** LanInfo — token, QR code and devices only for this machine. */
route('GET', '/api/lan', (req) => lanInfo(req));

/** Body `{enabled: boolean}` → LanInfo. Lasts until a restart or a config.yaml server.lan change. */
route('POST', '/api/lan', async (req) => {
  localOnly(req);
  const body = await readBody<{ enabled?: unknown }>(req);
  if (typeof body.enabled !== 'boolean') throw new HttpError(400, 'enabled (boolean) is required');
  await setLanEnabled(body.enabled);
  return lanInfo(req);
});

/** New access code: every LAN device is signed out (must scan the new QR code). → LanInfo */
route('POST', '/api/lan/rotate', (req) => {
  localOnly(req);
  rotateLanToken();
  return lanInfo(req);
});

/** [v5] Body `{enabled: boolean}`: LAN devices may also use admin routes (AI, sync, verify, settings) until a restart. → LanInfo */
route('POST', '/api/lan/admin', async (req) => {
  localOnly(req);
  const body = await readBody<{ enabled?: unknown }>(req);
  if (typeof body.enabled !== 'boolean') throw new HttpError(400, 'enabled (boolean) is required');
  setLanAdmin(body.enabled);
  return lanInfo(req);
});

/** [v5] Rename a paired device: body `{name}`. → LanInfo */
route('POST', '/api/lan/devices/:id', async (req, _url, [id]) => {
  localOnly(req);
  const body = await readBody<{ name?: unknown }>(req);
  if (!renameLanDevice(decodeParam(id), typeof body.name === 'string' ? body.name : '')) throw new HttpError(404, 'Không có thiết bị này (hoặc tên trống)');
  return lanInfo(req);
});

/** [v5] Sign one device out now (its open pages lose access at once). → LanInfo */
route('POST', '/api/lan/devices/:id/revoke', (req, _url, [id]) => {
  localOnly(req);
  if (!revokeLanDevice(decodeParam(id))) throw new HttpError(404, 'Không có thiết bị này hoặc đã thu hồi');
  return lanInfo(req);
});

/** [v5] server.https: tailscale — run `tailscale cert` now (normally monthly, by itself). → LanInfo */
route('POST', '/api/lan/https/renew', async (req) => {
  localOnly(req);
  await renewLanCert();
  return lanInfo(req);
});

// ── Anki ────────────────────────────────────────────────────────────────────

const cleanName = (s: unknown) =>
  typeof s === 'string'
    ? s
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .trim()
        .slice(0, 120)
    : '';

/** Only well-formed filter fields reach the selection (lists of strings, a string search). */
function cleanFilters(f: unknown): SelectionFilters | undefined {
  if (!f || typeof f !== 'object') return undefined;
  const src = f as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of ['packs', 'topics', 'domains', 'difficulties', 'origins', 'services', 'tags', 'tasks', 'requirements']) {
    if (Array.isArray(src[k])) out[k] = (src[k] as unknown[]).filter((x): x is string => typeof x === 'string');
  }
  if (typeof src.search === 'string') out.search = src.search.slice(0, 200);
  return out as SelectionFilters;
}

function noteOptions(body: AnkiExportRequest, defaultDeck: string): AnkiNoteOptions {
  if (!body || typeof body !== 'object' || !ANKI_SCOPES.includes(body.scope)) throw new HttpError(400, `scope must be one of: ${ANKI_SCOPES.join(', ')}`);
  if (body.scope === 'ids' && (!Array.isArray(body.ids) || !body.ids.length)) throw new HttpError(400, 'ids is required for scope "ids"');
  return {
    deck: cleanName(body.deck) || cleanName(defaultDeck) || 'AWS SAA-C03',
    model: cleanName(body.model) || DEFAULT_MODEL,
    includeExplanation: body.includeExplanation !== false,
  };
}

/** Export defaults (config `export.*`) + whether AnkiConnect answers (decks, note types). */
route('GET', '/api/export/anki/status', () => {
  const cfg = loadConfig();
  return ankiStatus(cfg.export.ankiconnect_url, cfg.export.anki_deck);
});

/**
 * Body AnkiExportRequest. Default → TSV attachment (Anki: File → Import). `?preview=1` → AnkiPreview (count + one
 * rendered card). `?push=1` → AnkiPushResult through AnkiConnect (config export.ankiconnect_url; never from the body).
 */
route('POST', '/api/export/anki', async (req, url) => {
  const body = await readBody<AnkiExportRequest>(req);
  const ctx = context();
  const opts = noteOptions(body, ctx.cfg.export.anki_deck);
  // [v5 γ1] scope 'notebook': one rule card per 📒 mistake-notebook entry (τ's loadNotebook — sealed ids already left out)
  if (body.scope === 'notebook') {
    const cards = loadNotebook().map(notebookCard);
    if (url.searchParams.get('preview') === '1') {
      const out: AnkiPreview = { count: cards.length, missing: [], deck: opts.deck };
      const c = cards[0];
      if (c) out.sample = { id: c.idTag.split('::').pop() ?? '', front: c.front, back: c.back, tags: c.tags };
      return out;
    }
    if (!cards.length) throw new HttpError(422, 'Sổ lỗi chưa có mục nào — cập nhật sổ ở Tài liệu → 📒 Sổ lỗi trước.');
    if (url.searchParams.get('push') === '1') return pushToAnki(ctx.cfg.export.ankiconnect_url, cards, opts);
    return new RawResponse(ankiTsv(cards, opts), 'text/plain; charset=utf-8', attachment(`anki-saa-c03-notebook-${stampParts().date}.txt`));
  }
  const sel = selectForAnki({ ...body, filters: cleanFilters(body.filters) }, ctx.bank, Object.fromEntries(ctx.states));
  if (url.searchParams.get('preview') === '1') {
    const out: AnkiPreview = { count: sel.questions.length, missing: sel.missing, deck: opts.deck };
    const q = sel.questions[0];
    if (q) out.sample = { id: q.id, front: cardFront(q), back: cardBack(q, opts.includeExplanation), tags: cardTags(q) };
    return out;
  }
  if (!sel.questions.length) throw new HttpError(422, 'Không có câu hỏi nào khớp phạm vi / bộ lọc đã chọn.');
  if (url.searchParams.get('push') === '1') return pushToAnki(ctx.cfg.export.ankiconnect_url, sel.questions, opts);
  const name = `anki-saa-c03-${body.scope}-${stampParts().date}.txt`;
  return new RawResponse(ankiTsv(sel.questions, opts), 'text/plain; charset=utf-8', attachment(name));
});

const ANKI_SESSION = /^anki:(\d+)-(\d+)$/;
let importing = false;

/**
 * [v5 γ1] Body `{deck?}` → AnkiImportResult. Reviews done in Anki since the last import (AnkiConnect cardReviews, review id
 * > the largest `anki:<from>-<to>` session already stored) become one attempt (mode / source 'anki', `grade` = the button,
 * `t` = review time; later reviews of a question on the same day are relearn steps). Idempotent: a range is written once.
 * HTTP 200 with ok:false + hint when Anki is unreachable.
 */
route('POST', '/api/export/anki/import', async (req) => {
  const body = await readBody<{ deck?: unknown }>(req);
  const ctx = context();
  const deck = cleanName(body.deck) || cleanName(ctx.cfg.export.anki_deck) || 'AWS SAA-C03';
  const res: AnkiImportResult = { ok: false, deck, reviews: 0, imported: 0, skipped: 0 };
  if (importing) throw new HttpError(409, 'Đang nhập lượt ôn từ Anki — đợi lượt trước xong.');
  importing = true;
  try {
    let after = 0;
    for (const a of ctx.attempts) {
      const m = ANKI_SESSION.exec(a.sessionId ?? '');
      if (m) after = Math.max(after, Number(m[2]));
    }
    const batch = await readAnkiReviews({ url: ctx.cfg.export.ankiconnect_url, deck, bank: ctx.bank, sealed: sealedIds(), after });
    Object.assign(res, { ok: true, reviews: batch.reviews, skipped: batch.skipped, from: batch.from, to: batch.to });
    if (batch.from === undefined || batch.to === undefined) return res;
    const sessionId = `anki:${batch.from}-${batch.to}`;
    if (ctx.attempts.some((a) => a.sessionId === sessionId)) return { ...res, duplicate: true };
    if (!batch.answers.length) return res;
    const seenDay = new Set<string>();
    const answers: AnswerRecord[] = batch.answers.map((r) => {
      const q = ctx.bank.byId.get(r.q)!;
      const day = `${r.q}|${localDateKey(new Date(r.at))}`;
      const relearn = seenDay.has(day);
      seenDay.add(day);
      return { q: r.q, pick: '', key: q.answer.join(''), ok: r.grade >= 3, t: r.t, est: q.time, grade: r.grade, h: q.hash, ...(relearn ? { relearn: true } : {}) };
    });
    const attempt = createAttempt(
      {
        mode: 'anki',
        source: 'anki',
        title: `🃏 Ôn trên Anki · ${answers.length} lượt`,
        started: new Date(batch.answers[0].at).toISOString(),
        finished: new Date(batch.answers[batch.answers.length - 1].at).toISOString(),
        answers,
        sessionId,
        extra: { anki_deck: deck, anki_from: batch.from, anki_to: batch.to },
      },
      ctx.bank,
    );
    scheduleSnapshot();
    return { ...res, imported: answers.length, attempt: attempt.id };
  } catch (e) {
    if (!(e instanceof AnkiError)) throw e;
    return { ...res, ok: false, error: e.message, hint: e.hint };
  } finally {
    importing = false;
  }
});
