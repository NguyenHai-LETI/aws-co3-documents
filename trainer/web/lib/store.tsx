import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { api, ApiError } from './api.ts';
import type {
  BankProblem,
  ClaudeStatus,
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
}

interface DataCtx {
  meta?: Meta;
  bank?: BankData;
  state?: StateData;
  byId: Map<string, Question>;
  error?: string;
  /** increments whenever results/bank/plans change on disk — pages use it as a refetch key */
  version: number;
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

  const refresh = useCallback(async () => {
    try {
      const [m, b, s] = await Promise.all([api.get<Meta>('/api/meta'), api.get<BankData>('/api/bank'), api.get<StateData>('/api/state')]);
      setMeta(m);
      setBank((prev) => (prev?.version === b.version ? prev : b));
      setState(s);
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useServerEvent('data', () => {
    void refresh().then(() => setVersion((v) => v + 1));
  });
  useServerEvent('coach-done', () => {
    void refresh().then(() => setVersion((v) => v + 1));
  });

  const byId = useMemo(() => new Map((bank?.questions ?? []).map((q) => [q.id, q])), [bank]);
  const topic = useCallback((id: string) => meta?.topics.find((t) => t.id === id), [meta]);
  const domain = useCallback((id: string) => meta?.domains.find((d) => d.id === id), [meta]);
  const task = useCallback((id: string | undefined) => (id ? meta?.tasks?.find((t) => t.id === id) : undefined), [meta]);

  const value = useMemo<DataCtx>(
    () => ({ meta, bank, state, byId, error, version, refresh, topic, domain, task }),
    [meta, bank, state, byId, error, version, refresh, topic, domain, task],
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
 * same URL keeps the previous data on screen; switching to another URL never shows stale data.
 */
export function useFetch<T>(url: string | null, deps: unknown[] = []): FetchResult<T> {
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
  return { data: cur?.data, error: cur?.error, status: cur?.status, loading: !!url && (loading || !cur), reload };
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
  loadedVersion?: number;
  inflight?: Promise<void>;
  listeners: Set<() => void>;
}
const sharedCache = new Map<string, SharedEntry>();
const EMPTY_SHARED: SharedState = {};

function sharedEntry(url: string): SharedEntry {
  let e = sharedCache.get(url);
  if (!e) {
    e = { state: EMPTY_SHARED, listeners: new Set() };
    sharedCache.set(url, e);
  }
  return e;
}

function emitShared(e: SharedEntry, state: SharedState) {
  e.state = state;
  for (const l of e.listeners) l();
}

/** (Re)load a shared URL; concurrent callers share one request. */
export function loadShared(url: string, version = -1): Promise<void> {
  const e = sharedEntry(url);
  if (e.inflight) return e.inflight;
  e.loadedVersion = version;
  e.inflight = api
    .get<unknown>(url)
    .then((d) => emitShared(e, { data: d }))
    .catch((err: Error) => emitShared(e, { data: e.state.data, error: err.message, status: err instanceof ApiError ? err.status : undefined }))
    .finally(() => {
      e.inflight = undefined;
    });
  return e.inflight;
}

/** Locally update shared data (e.g. append the item a POST returned). */
export function updateShared<T>(url: string, fn: (prev: T | undefined) => T) {
  const e = sharedEntry(url);
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
    if (url && e && e.loadedVersion !== version && !e.inflight) void loadShared(url, version);
  }, [url, e, version]);
  const reload = useCallback(() => {
    if (url) void loadShared(url, version);
  }, [url, version]);
  return { data: state.data as T | undefined, error: state.error, status: state.status, reload };
}
