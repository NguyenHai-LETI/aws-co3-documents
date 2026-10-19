// Export & device routes: Anki export (TSV download / AnkiConnect push) and LAN access for phones. (owner: [X])
import { HttpError, RawResponse, attachment, isLocalRequest, readBody, route } from '../http.ts';
import type http from 'node:http';
import { context } from '../context.ts';
import { loadConfig } from '../config.ts';
import { stampParts } from '../lib/time.ts';
import { ANKI_SCOPES, DEFAULT_MODEL, ankiStatus, ankiTsv, cardBack, cardFront, cardTags, pushToAnki, selectForAnki, type AnkiNoteOptions } from '../lib/anki.ts';
import { lanInfo, rotateLanToken, setLanEnabled } from '../lib/lan.ts';
import type { AnkiExportRequest, AnkiPreview, SelectionFilters } from '../../shared/types.ts';

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
  for (const k of ['packs', 'topics', 'domains', 'difficulties', 'origins', 'services', 'tags', 'tasks']) {
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
