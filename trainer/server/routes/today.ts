// [v5 σ] "▶ Học hôm nay" preview (Design C1):
//   GET /api/today[?minutes=N] → TodayPreview — what POST /api/tests {mode: 'today', budgetMinutes: N} would build now (the
//   same composer, server/lib/today.ts). Without `minutes`: the daily goal (goal.minutesPerDay, else practice.today_minutes),
//   so `minutes` in the answer tells the UI which chip is the default. Memoized per data state (context.ts) and budget.
import { HttpError, route } from '../http.ts';
import { context } from '../context.ts';
import { previewToday } from '../lib/select.ts';
import { TODAY_MAX_MINUTES } from '../lib/today.ts';

route('GET', '/api/today', (_req, url) => {
  const raw = url.searchParams.get('minutes');
  let minutes: number | undefined;
  if (raw !== null && raw.trim() !== '') {
    minutes = Number(raw);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > TODAY_MAX_MINUTES) throw new HttpError(400, `minutes phải là số phút từ 1 đến ${TODAY_MAX_MINUTES}.`);
  }
  return previewToday(context(), minutes);
});
