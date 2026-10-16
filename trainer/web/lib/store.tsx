import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api.ts';
import type {
  BankProblem,
  ClaudeStatus,
  Difficulty,
  DomainDef,
  Pack,
  Question,
  QuestionState,
  TimingRubric,
  TopicDef,
} from '../../shared/types.ts';

export interface Meta {
  exam: { code: string; name: string; questions: number; duration_min: number; esl_extra_min: number; pass_scaled: number; pass_pct: number };
  domains: DomainDef[];
  topics: TopicDef[];
  difficulties: { id: Difficulty; label: string }[];
  timing: TimingRubric;
  services: { name: string; topic: string }[];
  packs: Pack[];
  bankVersion: string;
  problems: { errors: number; warnings: number };
  openIssues: number;
  practice: { default_count: number; quick_count: number };
  srs: { intervals_days: number[]; mastered_box: number };
  attempts: number;
  latestPlan: { id: string; created: string } | null;
  claude: ClaudeStatus;
  paths: { trainer: string; repo: string };
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

  const value = useMemo<DataCtx>(
    () => ({ meta, bank, state, byId, error, version, refresh, topic, domain }),
    [meta, bank, state, byId, error, version, refresh, topic, domain],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData outside DataProvider');
  return c;
}

/** Fetch helper that refetches when `deps` or the global data version change. */
export function useFetch<T>(url: string | null, deps: unknown[] = []): { data?: T; error?: string; loading: boolean; reload: () => void } {
  const { version } = useData();
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    api
      .get<T>(url)
      .then((d) => {
        if (alive) {
          setData(d);
          setError(undefined);
        }
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, version, n, ...deps]);
  return { data, error, loading, reload: () => setN((x) => x + 1) };
}
