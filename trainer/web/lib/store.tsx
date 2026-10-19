import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { api, ApiError } from './api.ts';
import type {
  BankProblem,
  ClaudeStatus,
  DataVersions,
  Difficulty,
  DomainDef,
  Pack,
  Question,
  QuestionState,
  TaskDef,
  TimingRubric,
  TopicDef,
} from '../../shared/types.ts';

export interface Meta {
  exam: { code: string; name: string; questions: number; duration_min: number; esl_extra_min: number; pass_scaled: number; pass_pct: number };
  domains: DomainDef[];
  topics: TopicDef[];
  difficulties: { id: Difficulty; label: string }[];
  tasks: TaskDef[];
  keywords: Record<string, string[]>;
  timing: TimingRubric;
  services: { name: string; topic: string }[];
  packs: Pack[];
  bankVersion: string;
  problems: { errors: number; warnings: number };
  openIssues: number;
  practice: { default_count: number; quick_count: number; shuffle_options: boolean };
  srs: { algorithm: 'fsrs' | 'leitner'; desired_retention: number; daily_limit: number; mastered_stability_days: number; intervals_days: number[]; mastered_box: number };
  attempts: number;
  latestPlan: { id: string; created: string } | null;
  claude: ClaudeStatus;
  paths: { trainer: string; repo: string; data: string };
  host: string;
  coachHosts: string[];
  syncAi?: { before: boolean; after: boolean }; // config sync.before_ai / after_ai (older servers: undefined)
  versions?: DataVersions; // {bank, results, plans} — same values as the SSE `data` event (older servers: undefined)
}

export interface BankData {
  version: string;
  packs: Pack[];
  questions: Question[];
  problems: BankProblem[];
}

export interface StateData {
  states: Record<string, QuestionState>;
  counts: Record<string, number>;
  versions?: DataVersions; // data versions these states were computed from (older servers: undefined)
}

/** What states / counts depend on: everything but the plans (the bank too — pools and counts). */
const stateKey = (v: DataVersions | undefined) => (v ? [v.bank, v.results, v.params ?? '', v.config ?? '', v.day ?? ''].join('|') : '');

interface DataCtx {
  meta?: Meta;
  bank?: BankData;
  state?: StateData;
  byId: Map<string, Question>;
  error?: string;
  /** increments whenever results/bank/plans change on disk — pages use it as a refetch key */
  version: number;
  /** versions of the loaded data (bank / results / plans) — finer refetch keys than `version` */
  versions?: DataVersions;
  /** meta + states again, the bank only when its version changed; resolves when the data is current */
  refresh: () => Promise<void>;
  topic: (id: string) => TopicDef | undefined;
  domain: (id: string) => DomainDef | undefined;
  /** exam-guide task statement ("1.1" … "4.4") */
  task: (id: string | undefined) => TaskDef | undefined;
}

const Ctx = createContext<DataCtx | null>(null);

// One EventSource for the whole app; components subscribe through this bus.
const bus = new EventTarget();
let source: EventSource | undefined;
function ensureSource() {
  if (source) return;
  source = new EventSource('/api/events');
  for (const name of ['data', 'coach', 'coach-done']) {
    source.addEventListener(name, (e) => {
      let data: unknown;
      try {
        data = JSON.parse((e as MessageEvent).data);
      } catch {
        data = undefined;
      }
      bus.dispatchEvent(new CustomEvent(name, { detail: data }));
    });
  }
}

export function useServerEvent<T = unknown>(name: string, handler: (data: T) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    ensureSource();
    const fn = (e: Event) => ref.current((e as CustomEvent).detail as T);
    bus.addEventListener(name, fn);
    return () => bus.removeEventListener(name, fn);
  }, [name]);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta>();
  const [bank, setBank] = useState<BankData>();
  const [state, setState] = useState<StateData>();
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);
  const [versions, setVersions] = useState<DataVersions>();
  // versions = meta's (latest known); stateVersions = what the loaded states were computed from (may lag behind meta)
  const loaded = useRef<{ bank?: BankData; versions?: DataVersions; stateVersions?: DataVersions }>({});
  const queue = useRef<Promise<void>>(Promise.resolve());

  /**
   * Loads the shared data. `next` = versions announced by the server (SSE `data`): meta always (small), the bank
   * (≈ 650 KB) only when its version moved, states / counts when results, the bank, the FSRS parameters, config.yaml
   * or the day moved — compared with the versions the held states were computed from (a parallel meta response may
   * already be newer). Without `next` (first load, explicit refresh): meta + states, and the bank when meta reports
   * another bank version than the one held.
   */
  const load = useCallback(async (next?: DataVersions) => {
    const cur = loaded.current;
    const bankStale = !cur.bank || (!!next && next.bank !== cur.bank.version);
    const stateStale = !next || !cur.stateVersions || stateKey(next) !== stateKey(cur.stateVersions);
    const [m, b, s] = await Promise.all([
      api.get<Meta>('/api/meta'),
      bankStale ? api.get<BankData>('/api/bank') : undefined,
      stateStale ? api.get<StateData>('/api/state') : undefined,
    ]);
    const fresh = b ?? (cur.bank && m.bankVersion !== cur.bank.version ? await api.get<BankData>('/api/bank') : undefined);
    const keepBank = cur.bank && fresh && fresh.version === cur.bank.version ? cur.bank : (fresh ?? cur.bank);
    loaded.current = { bank: keepBank, versions: m.versions ?? next, stateVersions: s ? (s.versions ?? m.versions ?? next) : cur.stateVersions };
    setMeta(m);
    if (keepBank !== cur.bank) setBank(keepBank);
    if (s) setState(s);
    setVersions(m.versions ?? next);
    setError(undefined);
  }, []);

  /** Runs loads one after another (an SSE event during a load must not be overwritten by the older response). */
  const sync = useCallback(
    (next?: DataVersions) => {
      const run = queue.current.then(() => load(next)).catch((e: Error) => setError(e.message));
      queue.current = run;
      return run;
    },
    [load],
  );
  const refresh = useCallback(() => sync(), [sync]);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // StrictMode mounts twice in development — load once
    started.current = true;
    void sync();
  }, [sync]);

  useServerEvent<DataVersions | undefined>('data', (v) => {
    void sync(v && typeof v.bank === 'string' ? v : undefined).then(() => setVersion((x) => x + 1));
  });
  useServerEvent('coach-done', () => {
    void sync().then(() => setVersion((x) => x + 1));
  });

  const byId = useMemo(() => new Map((bank?.questions ?? []).map((q) => [q.id, q])), [bank]);
  const topic = useCallback((id: string) => meta?.topics.find((t) => t.id === id), [meta]);
  const domain = useCallback((id: string) => meta?.domains.find((d) => d.id === id), [meta]);
  const task = useCallback((id: string | undefined) => (id ? meta?.tasks?.find((t) => t.id === id) : undefined), [meta]);

  const value = useMemo<DataCtx>(
    () => ({ meta, bank, state, byId, error, version, versions, refresh, topic, domain, task }),
    [meta, bank, state, byId, error, version, versions, refresh, topic, domain, task],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData outside DataProvider');
  return c;
}

export interface FetchResult<T> {
  data?: T;
  error?: string;
  /** HTTP status of the failed request (404 = endpoint/resource not available on this server) */
  status?: number;
  loading: boolean;
  reload: () => void;
}

/**
 * Fetch helper that refetches when `deps` or the global data version change. A refetch of the
 * same URL keeps the previous data on screen; switching to another URL never shows stale data —
 * unless `keep` is set (pagination, filters): then the previous URL's data stays until the new one arrives.
 */
export function useFetch<T>(url: string | null, deps: unknown[] = [], opts: { keep?: boolean } = {}): FetchResult<T> {
  const { version } = useData();
  const [res, setRes] = useState<{ url: string; data?: T; error?: string; status?: number }>();
  const [loading, setLoading] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    api
      .get<T>(url)
      .then((d) => {
        if (alive) setRes({ url, data: d });
      })
      .catch((e: Error) => {
        if (alive) setRes((prev) => ({ url, data: prev?.url === url ? prev.data : undefined, error: e.message, status: e instanceof ApiError ? e.status : undefined }));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, version, n, ...deps]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  const cur = url && res?.url === url ? res : undefined;
  const shown = cur ?? (opts.keep && url ? res : undefined);
  return { data: shown?.data, error: cur?.error, status: cur?.status, loading: !!url && (loading || !cur), reload };
}

// ── shared GET cache ────────────────────────────────────────────────────────
// For data that many components read at once (e.g. ratings shown on every review card):
// one request per URL and data version, local updates after a POST, no per-component refetch.

interface SharedState {
  data?: unknown;
  error?: string;
  status?: number;
}
interface SharedEntry {
  state: SharedState;
  loadedVersion?: number; // data version the last request was issued for
  inflight?: Promise<void>;
  again?: number; // a newer data version (or an explicit reload) arrived while a request was in flight
  touched: number; // sequence number of the last local update (updateShared)
  listeners: Set<() => void>;
}
let sharedSeq = 0;
const sharedCache = new Map<string, SharedEntry>();
const EMPTY_SHARED: SharedState = {};

function sharedEntry(url: string): SharedEntry {
  let e = sharedCache.get(url);
  if (!e) {
    e = { state: EMPTY_SHARED, touched: 0, listeners: new Set() };
    sharedCache.set(url, e);
  }
  return e;
}

function emitShared(e: SharedEntry, state: SharedState) {
  e.state = state;
  for (const l of e.listeners) l();
}

/**
 * (Re)load a shared URL; concurrent callers share one request. A call while a request is in flight (newer data version,
 * explicit reload) runs another request once it settles — the running one may predate the change; the returned promise
 * resolves after that second load.
 */
export function loadShared(url: string, version = -1): Promise<void> {
  const e = sharedEntry(url);
  if (e.inflight) {
    e.again = version;
    return e.inflight.then(() => e.inflight);
  }
  e.loadedVersion = version;
  const started = ++sharedSeq;
  const run = api
    .get<unknown>(url)
    // a local update (POST result) newer than this request wins over the response
    .then((d) => {
      if (e.touched < started) emitShared(e, { data: d });
    })
    .catch((err: Error) => emitShared(e, { data: e.state.data, error: err.message, status: err instanceof ApiError ? err.status : undefined }))
    .finally(() => {
      e.inflight = undefined;
      const again = e.again;
      e.again = undefined;
      if (again !== undefined) void loadShared(url, again);
    });
  e.inflight = run;
  return run;
}

/** Locally update shared data (e.g. append the item a POST returned). */
export function updateShared<T>(url: string, fn: (prev: T | undefined) => T) {
  const e = sharedEntry(url);
  e.touched = ++sharedSeq;
  emitShared(e, { data: fn(e.state.data as T | undefined) });
}

export function useShared<T>(url: string | null): { data?: T; error?: string; status?: number; reload: () => void } {
  const { version } = useData();
  const e = url ? sharedEntry(url) : undefined;
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!e) return () => undefined;
      e.listeners.add(cb);
      return () => {
        e.listeners.delete(cb);
      };
    },
    [e],
  );
  const getSnapshot = useCallback(() => e?.state ?? EMPTY_SHARED, [e]);
  const state = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => {
    if (url && e && e.loadedVersion !== version) void loadShared(url, version); // in flight → reloads after it settles
  }, [url, e, version]);
  const reload = useCallback(() => {
    if (url) void loadShared(url, version);
  }, [url, version]);
  return { data: state.data as T | undefined, error: state.error, status: state.status, reload };
}
