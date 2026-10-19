// In-memory stand-in for the AnkiConnect add-on (API version 6) used by tests/anki.test.ts and the e2e export tests:
// decks, note types, notes with tags, Anki's duplicate rule (same first field in the deck) and the search syntax the
// exporter uses ("deck:…" "tag:…*" with \ escapes). addNotes is all-or-nothing like current AnkiConnect.
import http from 'node:http';
import type net from 'node:net';

export interface FakeNote {
  id: number;
  deck: string;
  model: string;
  fields: Record<string, string>;
  tags: string[];
}

export interface FakeAnki {
  url: string;
  port: number;
  notes: FakeNote[];
  decks: Set<string>;
  models: Record<string, string[]>;
  calls: string[]; // action names in order
  close(): Promise<void>;
}

/** Anki search value → RegExp: \x literal, * any run, _ one character; case-insensitive full match. */
function pattern(value: string): RegExp {
  let re = '';
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '\\' && i + 1 < value.length) re += value[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (c === '*') re += '.*';
    else if (c === '_') re += '.';
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

export async function startFakeAnki(opts: { models?: Record<string, string[]>; apiKey?: string; port?: number } = {}): Promise<FakeAnki> {
  const models = opts.models ?? { Basic: ['Front', 'Back'], 'Basic (and reversed card)': ['Front', 'Back'], Cloze: ['Text', 'Back Extra'] };
  const decks = new Set(['Default']);
  let notes: FakeNote[] = [];
  const calls: string[] = [];
  let nextId = 1_700_000_000_000;
  const first = (model: string, fields: Record<string, string>) => fields[models[model]?.[0] ?? ''] ?? '';
  const isDup = (deck: string, model: string, fields: Record<string, string>) => notes.some((n) => n.deck === deck && n.model === model && first(n.model, n.fields) === first(model, fields));

  const findNotes = (query: string): number[] => {
    const terms = [...query.matchAll(/"((?:[^"\\]|\\.)*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);
    return notes
      .filter((n) =>
        terms.every((t) => {
          const i = t.indexOf(':');
          const key = t.slice(0, i).toLowerCase();
          const re = pattern(t.slice(i + 1));
          if (key === 'deck') return re.test(n.deck) || n.deck.split('::').some((_, j, parts) => re.test(parts.slice(0, j + 1).join('::')));
          if (key === 'tag') return n.tags.some((tag) => re.test(tag));
          return false;
        }),
      )
      .map((n) => n.id);
  };

  // AnkiConnect params are free-form JSON
  const handle = (action: string, params: any): unknown => {
    calls.push(action);
    switch (action) {
      case 'version':
        return 6;
      case 'deckNames':
        return [...decks];
      case 'modelNames':
        return Object.keys(models);
      case 'modelFieldNames':
        if (!models[params.modelName]) throw new Error(`model was not found: ${params.modelName}`);
        return models[params.modelName];
      case 'createDeck':
        decks.add(params.deck);
        return 1;
      case 'findNotes':
        return findNotes(String(params.query ?? ''));
      case 'notesInfo':
        return (params.notes as number[]).map((id) => {
          const n = notes.find((x) => x.id === id);
          return n ? { noteId: n.id, modelName: n.model, tags: n.tags, fields: Object.fromEntries(Object.entries(n.fields).map(([k, v], order) => [k, { value: v, order }])) } : {};
        });
      case 'updateNoteFields': {
        const n = notes.find((x) => x.id === params.note.id);
        if (!n) throw new Error(`note was not found: ${params.note.id}`);
        Object.assign(n.fields, params.note.fields);
        return null;
      }
      case 'multi':
        return (params.actions as { action: string; params?: unknown }[]).map((a) => {
          try {
            return { result: handle(a.action, a.params ?? {}), error: null };
          } catch (e) {
            return { result: null, error: (e as Error).message };
          }
        });
      case 'canAddNotes':
        return (params.notes as { deckName: string; modelName: string; fields: Record<string, string> }[]).map((n) => !!models[n.modelName] && !isDup(n.deckName, n.modelName, n.fields));
      case 'addNotes': {
        const errors: string[] = [];
        const ids: number[] = [];
        for (const n of params.notes as { deckName: string; modelName: string; fields: Record<string, string>; tags: string[] }[]) {
          if (!models[n.modelName]) errors.push('model was not found');
          else if (isDup(n.deckName, n.modelName, n.fields)) errors.push('cannot create note because it is a duplicate');
          else {
            const id = nextId++;
            decks.add(n.deckName);
            notes.push({ id, deck: n.deckName, model: n.modelName, fields: { ...n.fields }, tags: [...n.tags] });
            ids.push(id);
          }
        }
        if (errors.length) {
          notes = notes.filter((x) => !ids.includes(x.id)); // all or nothing
          throw new Error(JSON.stringify(errors));
        }
        return ids;
      }
      default:
        throw new Error('unsupported action');
    }
  };

  const sockets = new Set<net.Socket>();
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    let reply: { result: unknown; error: string | null };
    try {
      const body = JSON.parse(raw) as { action: string; params?: unknown; key?: string };
      if (opts.apiKey && body.key !== opts.apiKey) reply = { result: null, error: 'valid api key must be provided' };
      else reply = { result: handle(body.action, body.params ?? {}), error: null };
    } catch (e) {
      reply = { result: null, error: (e as Error).message };
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(reply));
  });
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  await new Promise<void>((resolve) => server.listen(opts.port ?? 0, '127.0.0.1', resolve));
  const port = (server.address() as net.AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    get notes() {
      return notes;
    },
    decks,
    models,
    calls,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}
