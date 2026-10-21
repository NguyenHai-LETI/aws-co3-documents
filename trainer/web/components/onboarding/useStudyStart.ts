// [β2] First study day for the "no pass/fail on short tests during the first week" rule (rules.ts noVerdict).
import { useData, useFetch } from '../../lib/store.tsx';
import { useProgress } from '../progress/useProgress.ts';
import type { ResultsPage } from '../../../shared/types.ts';

/**
 * ProgressResponse.studyStart (first non-rushed attempt) when the server has it; otherwise (older server, or only
 * rushed attempts so far) the oldest attempt — one small request. undefined = still loading · null = no attempt yet.
 */
export function useStudyStart(): string | undefined | null {
  const { meta } = useData();
  const { data: progress, error } = useProgress();
  const n = meta?.attempts ?? 0;
  const server = progress?.studyStart;
  const settled = !!progress || !!error;
  const { data: oldest } = useFetch<ResultsPage>(!server && settled && n > 0 ? `/api/results?limit=1&offset=${n - 1}` : null);
  if (server) return server;
  if (!meta) return undefined;
  if (n === 0) return null;
  if (!settled || !oldest) return undefined;
  return oldest.items?.[0]?.finished ?? null;
}
