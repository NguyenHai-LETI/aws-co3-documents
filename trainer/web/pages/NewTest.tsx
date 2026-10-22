import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../lib/store.tsx';
import { startTest } from '../lib/start.ts';
import { api } from '../lib/api.ts';
import { Chip, Seg, toggle } from '../components/ui.tsx';
import { fmtDuration } from '../lib/format.ts';
import { MODE_INFO, FEEDBACK_INFO, REQUIREMENTS, REQUIREMENT_INFO } from '../../shared/labels.ts';
import { EXAM_PACE_PRESETS, TIMING_PRESETS, computeTimeLimit, defaultTimingPreset } from '../../shared/timing.ts';
import { applyFilters, modePool, newOrder, practicePool, taskQuotas } from '../../shared/filters.ts';
import { REALISM_LOW_HINT, REFERENCE_WORDS_PER_QUESTION, isExamLike, questionWords, realismLow, realismText, realismTitle, testRealism } from '../../shared/realism.ts';
import { tierOf } from '../../shared/tier.ts';
import { TIERS, TIER_INFO, isTier } from '../components/TierBadge.tsx';
import type {
  BuildTestRequest,
  ConfusableGroup,
  Difficulty,
  DomainId,
  FeedbackMode,
  PackOrigin,
  ProgressResponse,
  SelectionFilters,
  TestMode,
  TestRealism,
  Tier,
  TodayPreview,
} from '../../shared/types.ts';

const MODES: TestMode[] = ['today', 'exam', 'sealed', 'diagnostic', 'topic', 'pack', 'srs', 'retry-wrong', 'yesterday', 'weak', 'discriminate', 'qualifier', 'new', 'flagged', 'slow', 'quick', 'custom'];
/** Modes whose questions do not depend on the content filters. */
const FIXED: TestMode[] = ['exam', 'sealed', 'diagnostic', 'today', 'discriminate', 'yesterday'];
/** [v5] Modes the server composes itself (counts come from the server, not from modePool). */
const SERVER_MODES: TestMode[] = ['today', 'discriminate', 'qualifier', 'yesterday'];
/** [v5] Modes whose feedback defaults to "xem đáp án ngay" (server: select.ts PRACTICE_MODES). */
const PRACTICE_DEFAULT: TestMode[] = ['quick', 'today', 'discriminate', 'qualifier', 'yesterday'];
/** [v5] "▶ Học hôm nay" budget chips (minutes). */
const TODAY_CHIPS = [5, 10, 25, 45];
const DISCRIMINATE_DEFAULT = 12;
const YESTERDAY_MAX = 8;
const ORIGINS: { id: PackOrigin; label: string }[] = [
  { id: 'imported', label: '📚 Đề gốc (V1/V2)' },
  { id: 'ai', label: '🤖 AI sinh' },
  { id: 'doc', label: '📄 Từ tài liệu' },
  { id: 'manual', label: '✍️ Thủ công' },
];
const PILOT = 15; // unscored pilot items in a Pearson-style exam (like the real SAA-C03)
const SEALED_STATUS: Record<string, string> = { sealed: '🔒 chưa làm', used: '✓ đã làm', released: '🔓 đã mở sớm' };

interface Init {
  mode?: TestMode;
  count?: number;
  filters: SelectionFilters;
  pearson?: boolean;
  recall?: boolean;
  feedback?: FeedbackMode;
  form?: string;
  contrast?: string[]; // [v5] mode discriminate: services / feature tags to tell apart
  minutes?: number; // [v5] mode today: budget
}

/**
 * `#/new` query: mode, count, topics, domains, packs, services, tags, tasks, requirements, form, pearson=1, recall=1, feedback;
 * [v5] contrast=a,b (discriminate), minutes=N (today); [v6] tiers=A,B (custom mode) — mode=exam&tiers=A = "Chỉ dùng câu tầng A".
 */
function parseQuery(q: URLSearchParams): Init {
  const list = (k: string) => {
    const v = q.get(k)?.split(',').map((s) => s.trim()).filter(Boolean);
    return v?.length ? v : undefined;
  };
  const flag = (k: string) => {
    const v = q.get(k);
    return v === null ? undefined : !['0', 'false', 'no', 'off'].includes(v.toLowerCase());
  };
  const mode = q.get('mode') as TestMode | null;
  const count = Number(q.get('count'));
  const minutes = Number(q.get('minutes'));
  const fb = q.get('feedback');
  const tiers = list('tiers')
    ?.map((t) => t.toUpperCase())
    .filter(isTier);
  return {
    mode: mode && MODES.includes(mode) ? mode : undefined,
    count: Number.isFinite(count) && count > 0 ? Math.round(count) : undefined,
    filters: {
      topics: list('topics'),
      domains: list('domains') as DomainId[] | undefined,
      packs: list('packs'),
      services: list('services'),
      tags: list('tags'),
      tasks: list('tasks'),
      requirements: list('requirements'),
      tiers: tiers?.length ? [...new Set(tiers)] : undefined,
    },
    pearson: flag('pearson'),
    recall: flag('recall'),
    feedback: fb === 'practice' || fb === 'exam' ? fb : undefined,
    form: q.get('form')?.trim() || undefined,
    contrast: list('contrast'),
    minutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : undefined,
  };
}

const shortTask = (label: string) => label.split(' (')[0];
/** [v6] `mode=exam&tiers=A`: the mock draws tier-A questions only. */
const tierAOnly = (init: Init) => init.mode === 'exam' && init.filters.tiers?.length === 1 && init.filters.tiers[0] === 'A';

/** Expected realism of `n` questions drawn at random from `pool` (the badge before a random selection exists). */
function expectedRealism(pool: Parameters<typeof testRealism>[0], n: number, tax: Parameters<typeof testRealism>[1]): TestRealism {
  if (!pool.length || n <= 0) return { items: 0, total: Math.max(0, n), words: 0, referenceWords: Math.max(0, n) * REFERENCE_WORDS_PER_QUESTION };
  const exam = pool.filter((q) => isExamLike(q, tax)).length;
  const words = pool.reduce((s, q) => s + questionWords(q), 0);
  return { items: Math.round((exam * n) / pool.length), total: n, words: Math.round((words * n) / pool.length), referenceWords: n * REFERENCE_WORDS_PER_QUESTION };
}

/** `<key>.items|words|total|estimate|pilots` preview counters of /api/state (server modeCounts). */
function preview(counts: Record<string, number> | undefined, key: string): { realism: TestRealism; estimate: number; pilots: number } | undefined {
  const total = counts?.[`${key}.total`];
  if (!counts || !total) return undefined;
  return {
    realism: { items: counts[`${key}.items`] ?? 0, total, words: counts[`${key}.words`] ?? 0, referenceWords: total * REFERENCE_WORDS_PER_QUESTION },
    estimate: counts[`${key}.estimate`] ?? 0,
    pilots: counts[`${key}.pilots`] ?? 0,
  };
}

export function NewTest({ query }: { query: URLSearchParams }) {
  const { meta, bank, state } = useData();
  const queryKey = query.toString();
  const init = useMemo(() => parseQuery(query), [query]);
  const diagDefault = 2 * (meta?.tasks?.length || 14);
  const [mode, setMode] = useState<TestMode>(init.mode ?? 'topic');
  const [filters, setFilters] = useState<SelectionFilters>(init.filters);
  const [count, setCount] = useState<number>(init.mode !== 'diagnostic' ? (init.count ?? meta?.practice.default_count ?? 20) : (meta?.practice.default_count ?? 20));
  const [diagCount, setDiagCount] = useState<number>(init.mode === 'diagnostic' && init.count ? init.count : diagDefault);
  const [feedback, setFeedback] = useState<FeedbackMode>(init.feedback ?? 'exam');
  const [timing, setTiming] = useState('standard');
  const [minutes, setMinutes] = useState(30);
  const [eslChoice, setEslChoice] = useState<boolean>(); // undefined = follow goal.esl
  const [goalEsl, setGoalEsl] = useState(false);
  const [form, setForm] = useState<string | undefined>(init.form);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(() => meta?.practice?.shuffle_options ?? true);
  const [pearson, setPearson] = useState<boolean>(init.pearson ?? true);
  const [examTierA, setExamTierA] = useState<boolean>(() => tierAOnly(init)); // [v6] 🎯 Thi thử: "Chỉ dùng câu tầng A"
  const [recallFirst, setRecallFirst] = useState<boolean>(init.recall ?? false);
  const [busy, setBusy] = useState(false);
  const [serviceQuery, setServiceQuery] = useState('');
  // [v5] "▶ Học hôm nay" budget (undefined = the daily goal) + its preview; discriminate groups (GET /api/pairs) + choice
  const [todayMins, setTodayMins] = useState<number | undefined>(init.minutes);
  const [todayPreview, setTodayPreview] = useState<TodayPreview>();
  const [groups, setGroups] = useState<ConfusableGroup[]>();
  const [contrast, setContrast] = useState<string[] | undefined>(init.contrast);
  const firstMode = useRef(true);
  const autoTiming = useRef(false);
  const goalAsked = useRef(false);
  const lastQuery = useRef(queryKey);

  // A new #/new?… link while the page is open (e.g. Stats → "luyện task 2.2") re-applies the query.
  useEffect(() => {
    if (lastQuery.current === queryKey) return;
    lastQuery.current = queryKey;
    if (init.mode) setMode(init.mode);
    setFilters(init.filters);
    if (init.count) (init.mode === 'diagnostic' ? setDiagCount : setCount)(init.count);
    if (init.pearson !== undefined) setPearson(init.pearson);
    if (init.mode === 'exam') setExamTierA(tierAOnly(init));
    if (init.recall !== undefined) setRecallFirst(init.recall);
    if (init.feedback) setFeedback(init.feedback);
    if (init.form) setForm(init.form);
    if (init.contrast) setContrast(init.contrast);
    if (init.minutes) setTodayMins(init.minutes);
  }, [queryKey, init]);

  useEffect(() => {
    const first = firstMode.current;
    firstMode.current = false;
    if (PRACTICE_DEFAULT.includes(mode) && !(first && init.feedback)) setFeedback('practice');
    if (mode === 'diagnostic' && !(first && init.feedback)) setFeedback('exam'); // a pretest: answers after the end
    if (first && init.count) return; // an explicit ?count= wins on the first render
    if (mode === 'exam') setCount(meta?.exam.questions ?? 65);
    else if (mode === 'quick') setCount(meta?.practice.quick_count ?? 10);
    else if (mode === 'discriminate') setCount(DISCRIMINATE_DEFAULT);
    else if (mode === 'yesterday') setCount(YESTERDAY_MAX);
    else if (count === (meta?.exam.questions ?? 65)) setCount(meta?.practice.default_count ?? 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Full mocks and sealed forms default to the honest reading-load clock; undo only what we changed ourselves.
  const examClock = mode === 'exam' || mode === 'sealed';
  useEffect(() => {
    if (examClock && timing === 'standard') {
      setTiming(defaultTimingPreset(mode));
      autoTiming.current = true;
    } else if (!examClock && autoTiming.current && timing === defaultTimingPreset('exam')) {
      setTiming('standard');
      autoTiming.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examClock]);

  // ESL default = the learner's goal (Thống kê → 🎯 Ngày thi): asked once, when an exam-pace clock is first shown
  const paceClock = EXAM_PACE_PRESETS.includes(timing);
  useEffect(() => {
    if (!paceClock || goalAsked.current) return;
    goalAsked.current = true; // once per visit (StrictMode re-runs effects: no cleanup that would drop the answer)
    api
      .get<ProgressResponse>('/api/progress')
      .then((p) => setGoalEsl(!!p.goal?.esl))
      .catch(() => undefined);
  }, [paceClock]);

  // [v5] today's preview (same composer as the session) — refreshed when the budget or the data change
  const stateCounts = state?.counts;
  useEffect(() => {
    let alive = true;
    api
      .get<TodayPreview>(`/api/today${todayMins ? `?minutes=${todayMins}` : ''}`)
      .then((p) => alive && setTodayPreview(p))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [todayMins, stateCounts]);
  // [v5] confusable groups, fetched the first time "🔀 Phân biệt" is chosen
  useEffect(() => {
    if (mode !== 'discriminate' || groups) return;
    api
      .get<ConfusableGroup[]>('/api/pairs')
      .then((g) => setGroups(Array.isArray(g) ? g : []))
      .catch(() => setGroups([]));
  }, [mode, groups]);

  const sealedIds = useMemo(() => new Set(bank?.sealed ?? []), [bank]);
  const excludeOos = (meta?.practice as { exclude_out_of_scope?: boolean } | undefined)?.exclude_out_of_scope ?? true;
  // practice pools: sealed questions only ever appear in their sealed exam; out-of-scope ones stay in explicit packs
  const active = useMemo(() => (bank?.questions ?? []).filter((q) => q.status === 'active'), [bank]);
  const withOos = useMemo(() => practicePool(active, { sealed: sealedIds }), [active, sealedIds]);
  const practice = useMemo(() => (excludeOos ? withOos.filter((q) => !q.outOfScope) : withOos), [withOos, excludeOos]);
  // [v6] mocks never serve an out-of-scope / legacy answer, whatever practice.exclude_out_of_scope says (server mockScope)
  const mocks = useMemo(() => (excludeOos ? practice : withOos.filter((q) => !q.outOfScope)), [excludeOos, practice, withOos]);
  // [v6] tiers (Question.tier, else shared/tier.ts): 🛠️ Tùy chỉnh chip counts (practice pool) and the mock's tier-A option
  const tierStats = useMemo(() => {
    const n: Record<Tier, number> = { A: 0, B: 0, C: 0 };
    for (const q of practice) n[tierOf(q, meta)]++;
    const clustersA = new Set<string>(); // a mock never takes two questions of one sibling cluster
    let mockA = 0;
    for (const q of mocks) {
      if (tierOf(q, meta) !== 'A') continue;
      mockA++;
      clustersA.add(q.cluster ?? q.id);
    }
    return { n, mockA, eligibleA: clustersA.size };
  }, [practice, mocks, meta]);
  const tierAReady = tierStats.eligibleA >= (meta?.exam.questions ?? 65);
  const tierAOn = mode === 'exam' && examTierA && tierAReady;
  const states = state?.states ?? {};
  const counts = state?.counts;
  const srsLimit = counts?.srsRemaining; // today's review allowance after srs.daily_limit
  const backlog = counts?.backlog ?? 0;
  const filterable = !FIXED.includes(mode) && mode !== 'pack';
  // [v6] tiers reach the server from the 🛠️ Tùy chỉnh chips and the mock's "Chỉ dùng câu tầng A" only (the modes that apply them)
  const effectiveFilters: SelectionFilters =
    mode === 'pack'
      ? { packs: filters.packs?.slice(0, 1) }
      : tierAOn
        ? { tiers: ['A'] }
        : FIXED.includes(mode)
          ? {}
          : mode === 'custom'
            ? filters
            : { ...filters, tiers: undefined };
  const filterKey = JSON.stringify(effectiveFilters);
  const pool = useMemo(() => {
    const base = applyFilters(mode === 'pack' ? withOos : mode === 'exam' ? mocks : practice, { ...effectiveFilters, tiers: undefined });
    const tiers = effectiveFilters.tiers;
    return tiers?.length ? base.filter((q) => tiers.includes(tierOf(q, meta))) : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, withOos, mocks, practice, filterKey, meta]);
  const mPool = useMemo(() => modePool(mode, pool, states, { srsLimit }), [mode, pool, states, srsLimit]);
  const countsByMode = useMemo(
    () => Object.fromEntries(MODES.map((m) => [m, modePool(m, m === 'pack' ? withOos : practice, states, { srsLimit }).length])),
    [withOos, practice, states, srsLimit],
  );
  // [v5] the server composes these modes: its counts (and the today preview) are the truth
  const serverCount: Partial<Record<TestMode, number>> = {
    today: todayPreview?.count ?? 0,
    discriminate: stateCounts?.discriminate ?? 0,
    qualifier: stateCounts?.qualifier ?? 0,
    yesterday: stateCounts?.yesterday ?? 0,
  };
  // discriminate: the chosen services (default: the first group not separated yet) and how many questions they have
  const defaultGroup = groups?.find((g) => !g.learner?.separated) ?? groups?.[0];
  const chosen = contrast?.length ? contrast : defaultGroup?.services;
  const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const chosenGroup = chosen ? groups?.find((g) => sameSet(g.services, chosen) || chosen.every((x) => g.services.includes(x))) : undefined;
  const chosenPair = chosen?.length === 2 ? chosenGroup?.pairs.find((p) => sameSet([p.a, p.b], chosen)) : undefined;
  const discAvailable = chosenPair ? chosenPair.n : chosenGroup && chosen && sameSet(chosenGroup.services, chosen) ? chosenGroup.questions : (chosenGroup?.questions ?? 0);
  const taskCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of practice) if (q.task) m.set(q.task, (m.get(q.task) ?? 0) + 1);
    return m;
  }, [practice]);
  const reqCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of practice) for (const r of q.requirements ?? []) m.set(r, (m.get(r) ?? 0) + 1);
    return m;
  }, [practice]);
  const packCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of withOos) m.set(q.pack, (m.get(q.pack) ?? 0) + 1);
    return m;
  }, [withOos]);

  // diagnostic: an even share per exam-guide task (same split as the server), limited by what each task has
  const diag = useMemo(() => {
    const quotas = taskQuotas(diagCount, meta?.tasks ?? [], meta?.domains ?? []);
    let n = 0;
    const short: string[] = [];
    for (const [task, want] of quotas) {
      const have = Math.min(want, taskCounts.get(task) ?? 0);
      n += have;
      if (have < want) short.push(`${task} (${have}/${want})`);
    }
    return { n, short, per: new Set(quotas.values()).size === 1 ? [...quotas.values()][0] : 0 };
  }, [diagCount, meta, taskCounts]);

  const sealedForms = meta?.sealed ?? [];
  const openForms = sealedForms.filter((f) => f.status === 'sealed');
  const formId = form && openForms.some((f) => f.id === form) ? form : openForms[0]?.id;

  if (!meta || !bank) return null;
  const set = (patch: Partial<SelectionFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const topicCount = (id: string) => practice.filter((q) => q.topic === id).length;
  const showAdvanced = mode === 'custom';
  const tasks = meta.tasks ?? [];
  const showTasks = tasks.length > 0 && filterable && (showAdvanced || (filters.tasks?.length ?? 0) > 0);
  const showRequirements = filterable && (showAdvanced || (filters.requirements?.length ?? 0) > 0);
  const classified = taskCounts.size > 0;
  const examN = meta.exam.questions ?? 65;
  const pearsonOn = mode === 'exam' && pearson;
  const pearsonLike = pearsonOn || mode === 'sealed';

  // what will be served: size, Σ estimates and realism (server previews for the full mock and the sealed forms)
  const examPreview = mode === 'exam' && !tierAOn ? preview(counts, 'exam') : undefined; // the server previews the unfiltered mock
  const sealedPreview = mode === 'sealed' && formId ? preview(counts, `sealed.${formId}`) : undefined;
  const sealedMeta = sealedForms.find((f) => f.id === formId);
  const n =
    mode === 'today'
      ? (todayPreview?.count ?? 0)
      : mode === 'discriminate'
        ? Math.min(count, discAvailable)
        : mode === 'qualifier'
          ? Math.min(count, stateCounts?.qualifier ?? 0)
          : mode === 'yesterday'
            ? Math.min(count, stateCounts?.['yesterday.all'] ?? 0)
            : mode === 'sealed'
      ? (sealedPreview?.realism.total ?? (sealedMeta ? sealedMeta.count + PILOT : 0))
      : mode === 'diagnostic'
        ? diag.n
        : pearsonOn
          ? Math.min(examN, mPool.length)
          : mode === 'pack'
            ? mPool.length
            : Math.min(count, mPool.length);
  // questions the chosen mode can serve (the server knows it for the modes it composes)
  const available =
    mode === 'discriminate' ? discAvailable : mode === 'qualifier' ? (stateCounts?.qualifier ?? 0) : mode === 'yesterday' ? (stateCounts?.['yesterday.all'] ?? 0) : mPool.length;
  const avg = mPool.length ? mPool.reduce((s, q) => s + q.time, 0) / mPool.length : 0;
  const exact = mode === 'sealed' ? sealedPreview : examPreview && examPreview.realism.total === n ? examPreview : undefined;
  // deterministic selections are known exactly: a whole pack, the next never-seen questions (newOrder)
  const known = exact ? undefined : mode === 'pack' ? mPool : mode === 'new' ? newOrder(mPool, meta.domains).slice(0, n) : undefined;
  const estimate =
    mode === 'today' && todayPreview
      ? Math.round(todayPreview.mix.seconds / (todayPreview.mix.pace || 1))
      : exact
        ? exact.estimate
        : known
          ? known.reduce((s, q) => s + q.time, 0)
          : Math.round(avg * n);
  const realism: TestRealism = exact ? exact.realism : known ? testRealism(known, meta) : expectedRealism(mPool, n, meta);
  const approx = !exact && !known;
  const eslOn = paceClock && (eslChoice ?? goalEsl);
  // today: no clock that submits — the runner shows a soft budget timer (session.budgetMinutes)
  const limit = mode === 'today' ? 0 : computeTimeLimit(estimate, n, timing, minutes, meta.timing, { words: realism.words, esl: eslOn });
  const lowRealism = realismLow(realism);
  const pilots = mode === 'sealed' ? (sealedPreview?.pilots ?? PILOT) : PILOT;
  const scored = Math.max(0, n - pilots);
  const heldBack = counts?.sealed ?? sealedIds.size;
  const outOfScope = mode === 'pack' ? 0 : (counts?.outOfScope ?? 0);

  const start = async () => {
    setBusy(true);
    const req: BuildTestRequest =
      mode === 'today'
        ? { mode, budgetMinutes: todayMins ?? todayPreview?.minutes, feedback, shuffleOptions, ...(recallFirst ? { recallFirst: true } : {}) }
        : {
            mode,
            count: mode === 'pack' || mode === 'sealed' ? undefined : mode === 'diagnostic' ? diagCount : pearsonOn ? examN : count,
            filters: effectiveFilters,
            feedback: pearsonLike ? 'exam' : feedback,
            timing: { preset: timing, minutes, ...(paceClock && eslChoice !== undefined ? { esl: eslChoice } : {}) },
            shuffleOptions,
            ...(mode === 'exam' ? { pearson } : {}),
            ...(mode === 'sealed' && formId ? { form: formId } : {}),
            ...(mode === 'discriminate' && chosen?.length ? { contrast: chosen } : {}),
            ...(recallFirst ? { recallFirst: true } : {}),
          };
    await startTest(req);
    setBusy(false);
  };

  const services = (meta.services ?? []).filter((s) => !serviceQuery || s.name.toLowerCase().includes(serviceQuery.toLowerCase()));
  const modeLine = (m: TestMode, c: number) => {
    if (m === 'exam') return `${meta.exam.questions} câu · ${meta.exam.duration_min}′ thi thật`;
    if (m === 'srs') return `${c} câu đến hạn hôm nay${backlog ? ` · ${backlog} câu dồn sang ngày sau` : ''}`;
    if (m === 'sealed') return openForms.length ? `${openForms.map((f) => f.id).join(', ')} · ${openForms[0].count} câu + ${PILOT} thử nghiệm` : 'Đã dùng hết đề niêm phong';
    if (m === 'diagnostic') return `${diag.n} câu${diag.per ? ` · ${diag.per} câu/task` : ''}`;
    if (m === 'today') return todayPreview ? todayPreview.label : 'Đang tính…';
    if (m === 'discriminate') return c ? `${c} nhóm dịch vụ dễ nhầm` : 'Chưa có cặp dễ nhầm';
    if (m === 'qualifier') return `${c} câu${stateCounts?.['qualifier.families'] ? ` · ${stateCounts['qualifier.families']} họ câu` : ''}`;
    if (m === 'yesterday') return c ? `${c} câu · ≈ ${Math.max(1, Math.round((stateCounts?.['yesterday.estimate'] ?? 0) / 60))}′` : 'Hôm qua không có lỗi cần ôn';
    return `${c} câu khả dụng`;
  };

  return (
    <div className="new-test">
      <div className="page-head">
        <div>
          <h1>✍️ Tạo bài test</h1>
          <p>Chọn chế độ, lọc câu hỏi, đặt thời gian — đồng hồ chạy theo tổng thời gian chuẩn của các câu được chọn.</p>
        </div>
      </div>

      <section>
        <div className="grid auto">
          {MODES.map((m) => {
            if (m === 'sealed' && !sealedForms.length && !meta?.sealedError) return null; // no forms (exam.sealed_forms: 0) → no card
            const info = MODE_INFO[m];
            const c = SERVER_MODES.includes(m) ? (serverCount[m] ?? 0) : countsByMode[m];
            const disabled =
              (['retry-wrong', 'srs', 'flagged', 'slow', 'discriminate', 'qualifier', 'yesterday'].includes(m) && !c) ||
              (m === 'today' && !!todayPreview && !c) ||
              (m === 'sealed' && !openForms.length) ||
              (m === 'diagnostic' && !diag.n);
            return (
              <button key={m} className={`mode-card ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)} style={disabled ? { opacity: 0.55 } : undefined}>
                <span className="t">
                  {info.icon} {info.label}
                </span>
                <span className="d">{info.desc}</span>
                <span className="n">{modeLine(m, c)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="split-r">
        <div className="card stack">
          {mode === 'exam' && (
            <>
              <label className={`toggle-card ${pearson ? 'on' : ''}`}>
                <input type="checkbox" checked={pearson} onChange={(e) => setPearson(e.target.checked)} />
                <span className="stack sm">
                  <b>🏛 Mô phỏng Pearson VUE (khuyến nghị)</b>
                  <span className="small dim">
                    {meta.exam.questions} câu = {Math.max(0, meta.exam.questions - PILOT)} tính điểm + {PILOT} câu thử nghiệm <b>không tính điểm và không báo trước</b> (như đề thật) ·
                    đồng hồ không tạm dừng · cảnh báo khi còn 15′ và 5′ · cuối bài có <b>màn hình xem lại</b> (lọc câu cắm cờ / chưa trả lời) trước khi “Kết thúc bài thi”.
                  </span>
                </span>
              </label>
              <label className={`toggle-card ${tierAOn ? 'on' : ''}`} style={tierAReady ? undefined : { opacity: 0.6, cursor: 'default' }}>
                <input type="checkbox" checked={tierAOn} disabled={!tierAReady} onChange={(e) => setExamTierA(e.target.checked)} />
                <span className="stack sm">
                  <b>🏷️ Chỉ dùng câu tầng A</b>
                  <span className="small dim">
                    {tierAReady ? (
                      <>
                        Chỉ lấy câu <b>giống đề thật</b> (tình huống dài, phương án là câu đầy đủ, có tiêu chí như MOST cost-effective) — ngân hàng có {tierStats.mockA} câu tầng A
                        dùng được. Vẫn chia theo trọng số domain: domain nào thiếu câu tầng A thì được bù bằng câu tầng khác, app báo khi tạo bài.
                      </>
                    ) : (
                      <>
                        Cần ít nhất {meta.exam.questions} câu tầng A khác nhau (không tính câu anh em) — ngân hàng mới có {tierStats.eligibleA}. Xem số câu theo domain ở Ngân hàng
                        → 📐 Chất lượng → 🏷️ Tầng câu hỏi.
                      </>
                    )}
                  </span>
                </span>
              </label>
              <div className="alert info">
                Phân bổ theo trọng số đề thật: {meta.domains.map((d) => `${d.code} ${d.weight}%`).join(' · ')}. Ưu tiên câu bạn chưa gặp, <b>câu giống đề thật</b> (đề ≥{' '}
                {meta.timing.long_form_min_words ?? 55} từ, phương án là câu đầy đủ) rồi câu lâu chưa gặp; không bao giờ lấy cả câu gốc lẫn câu biến thể của nó. Đồng hồ mặc
                định <b>theo tải đọc đề thật</b>: bài ít chữ hơn đề thật thì ít thời gian hơn 130′ (chọn “Chuẩn đề thật” để luyện đủ 2′/câu). Kết quả quy đổi thang 1000
                (đỗ ≥ {meta.exam.pass_scaled}).
              </div>
            </>
          )}

          {mode === 'sealed' && (
            <>
              {meta.sealedError && (
                <div className="alert bad ins-wrap" role="alert">
                  ⛔ {meta.sealedError}
                </div>
              )}
              <div className="alert info">
                🔒 <b>Đề niêm phong</b>: {sealedMeta?.count ?? meta.exam.questions - PILOT} câu tính điểm <b>chưa từng xuất hiện</b> khi luyện (cả tìm kiếm, Ngân hàng và Anki
                đều không hiện) + {pilots} câu thử nghiệm không tính điểm — mô phỏng Pearson VUE: không tạm dừng, màn hình xem lại cuối bài, đồng hồ theo tải đọc đề thật. Điểm
                của đề là <b>điểm trên câu mới</b>, thước đo trung thực nhất trước ngày thi. Nộp bài xong đề được đánh dấu đã dùng và các câu trở lại ngân hàng luyện.
              </div>
              {sealedForms.length > 0 && (
                <div className="stack sm">
                  <b className="small">Chọn đề</b>
                  <div className="row" style={{ gap: 6 }}>
                    {sealedForms.map((f) => {
                      const usable = f.status === 'sealed';
                      const on = f.id === formId;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          className={`chip ${on ? 'on' : ''}`}
                          aria-pressed={on}
                          disabled={!usable}
                          style={usable ? undefined : { opacity: 0.55, cursor: 'default' }}
                          title={f.usedAt ? `Làm ngày ${f.usedAt.slice(0, 10)}` : undefined}
                          onClick={() => usable && setForm(f.id)}
                        >
                          <b>{f.id}</b> · {SEALED_STATUS[f.status] ?? f.status}
                          {f.usedAt ? ` ${f.usedAt.slice(0, 10)}` : ''} <span className="n">{f.count} câu</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {!openForms.length && !meta.sealedError && (
                <div className="alert warn">
                  {sealedForms.length ? (
                    <>
                      Không còn đề niêm phong nào chưa làm. Tạo đề mới bằng <code>npm run seal -- --forms 1</code> khi ngân hàng còn đủ câu bạn chưa gặp.
                    </>
                  ) : (
                    <>
                      Chưa có đề niêm phong. Tạo bằng <code>npm run seal -- --forms 2</code> (hoặc đặt <code>exam.sealed_forms</code> trong config.yaml rồi khởi động lại app).
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {mode === 'today' && (
            <>
              <div className="alert info">
                ▶️ <b>Học hôm nay</b>: một phiên vừa quỹ phút của bạn — làm lại câu vừa sai (≤ 20 %), câu đến hạn ôn (≤ 50 %), rồi chia đôi phần còn lại cho task yếu nhất và
                câu mới, xen kẽ chủ đề, xem đáp án ngay. Không lấy câu đã làm hôm nay hay câu anh em của chúng. Dừng sớm không bị phạt: câu chưa xem quay lại hàng chờ.
              </div>
              <div className="stack sm">
                <b className="small">Quỹ thời gian</b>
                <div className="row" style={{ gap: 6 }}>
                  {TODAY_CHIPS.map((m) => (
                    <Chip key={m} on={(todayMins ?? todayPreview?.minutes) === m} onClick={() => setTodayMins(m)}>
                      {m}′
                    </Chip>
                  ))}
                  {todayPreview && !TODAY_CHIPS.includes(todayPreview.minutes) && (
                    <Chip on onClick={() => setTodayMins(todayPreview.minutes)}>
                      {todayPreview.minutes}′ (mục tiêu)
                    </Chip>
                  )}
                </div>
              </div>
              {todayPreview && (
                <div className="nt-today stack sm">
                  <b>{todayPreview.label}</b>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {(
                      [
                        ['retry', '🔁 làm lại'],
                        ['review', '🧠 ôn đến hạn'],
                        ['weak', `💪 vá ${todayPreview.mix.weakTasks?.length ? `task ${todayPreview.mix.weakTasks.join(', ')}` : 'điểm yếu'}`],
                        ['new', '🆕 câu mới'],
                        ['advance', '🧲 ôn chốt'],
                        ['extra', '⚡ luyện thêm'],
                      ] as const
                    ).map(([k, label]) =>
                      todayPreview.mix[k] ? (
                        <span key={k} className="badge">
                          {label} <b className="num">{todayPreview.mix[k]}</b>
                        </span>
                      ) : null,
                    )}
                    {todayPreview.mix.swapped > 0 && <span className="badge accent">🔀 {todayPreview.mix.swapped} câu hỏi bằng câu anh em</span>}
                  </div>
                  {todayPreview.mix.pace !== 1 && (
                    <div className="tiny muted">Tính theo tốc độ thật của bạn: ×{todayPreview.mix.pace.toFixed(2)} thời gian chuẩn mỗi câu.</div>
                  )}
                  {todayPreview.mix.coach && <div className="small">🤖 Có phiên AI Coach mới chưa làm — nên làm trước (ở Tổng quan).</div>}
                  {todayPreview.note && <div className="small warn">{todayPreview.note}</div>}
                  <div className="small muted">
                    Hôm nay đã học {todayPreview.done.answers} câu · {todayPreview.done.minutes}′{todayPreview.done.goalMet ? ' — Đã đạt mục tiêu hôm nay ✓' : ''}
                  </div>
                </div>
              )}
            </>
          )}

          {mode === 'discriminate' && (
            <>
              <div className="alert info">
                🔀 <b>Phân biệt</b>: các câu mà những dịch vụ dễ nhầm cạnh tranh nhau (một ở đáp án, một ở phương án nhiễu), đáp án đúng luân phiên giữa các dịch vụ, mỗi
                cụm câu anh em chỉ một câu. Sau mỗi câu có thể mở bảng so sánh.
              </div>
              {!groups ? (
                <div className="small muted">Đang tải các nhóm dịch vụ dễ nhầm…</div>
              ) : !groups.length ? (
                <div className="small muted">Ngân hàng chưa có nhóm dịch vụ nào cạnh tranh trong đủ nhiều câu.</div>
              ) : (
                <div className="stack sm nt-groups">
                  <b className="small">Nhóm dịch vụ</b>
                  {groups.map((g) => {
                    const on = chosenGroup?.id === g.id;
                    return (
                      <div key={g.id} className={`nt-group ${on ? 'on' : ''}`}>
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          <button type="button" className={`chip ${chosen && sameSet(g.services, chosen) ? 'on' : ''}`} aria-pressed={!!chosen && sameSet(g.services, chosen)} onClick={() => setContrast(g.services)}>
                            {g.confused ? '⚠️ ' : ''}
                            {g.services.join(' · ')} <span className="n">{g.questions}</span>
                          </button>
                          {g.learner && g.learner.answers > 0 && (
                            <span className={`tiny ${g.learner.separated ? 'good' : 'muted'}`}>
                              {g.learner.separated ? '✓ đã tách được' : `${g.learner.correct}/${g.learner.answers} đúng`}
                            </span>
                          )}
                        </div>
                        {on && g.pairs.length > 1 && (
                          <div className="row nt-pairs" style={{ gap: 6 }}>
                            {g.pairs.map((p) => (
                              <Chip key={`${p.a}|${p.b}`} on={chosen?.length === 2 && sameSet([p.a, p.b], chosen)} onClick={() => setContrast([p.a, p.b])} count={p.n}>
                                {p.a} ⟷ {p.b}
                              </Chip>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {chosen?.length === 2 && (
                <a className="small" href={`#/pair?a=${encodeURIComponent(chosen[0])}&b=${encodeURIComponent(chosen[1])}`}>
                  📖 Bảng so sánh {chosen[0]} ⟷ {chosen[1]}
                </a>
              )}
            </>
          )}

          {mode === 'qualifier' && (
            <div className="alert info">
              🎯 <b>Đọc yêu cầu</b>: cùng tình huống, đổi câu hỏi cuối (rẻ nhất / ít vận hành nhất / an toàn nhất…) — các câu cùng họ cách nhau ít nhất 5 câu, sau câu thứ hai
              có bảng “yêu cầu → đáp án”.{' '}
              {stateCounts?.['qualifier.families']
                ? `Ngân hàng có ${stateCounts['qualifier.families']} họ câu; phần còn lại là câu có tiêu chí, xen kẽ.`
                : 'Ngân hàng chưa có họ câu (AI Coach tạo bằng tác vụ “family”) — bài gồm các câu có tiêu chí chi phí, vận hành, sẵn sàng, hiệu năng, bảo mật, xen kẽ nhau.'}
            </div>
          )}

          {mode === 'yesterday' && (
            <div className="alert info">
              ☀️ <b>Ôn lại lỗi hôm qua</b>: câu sai, chưa chắc hoặc phải xem gợi ý hôm qua — lỗi “chắc mà sai” trước, tối đa {YESTERDAY_MAX} câu (≈ 5′). Ôn lại sau một giấc
              ngủ giúp nhớ lâu hơn; câu đã làm lại hôm nay được bỏ qua.
            </div>
          )}

          {mode === 'diagnostic' && (
            <>
              <div className="alert info">
                🧭 <b>Chẩn đoán đầu vào</b>: mỗi mục exam guide 1.1–4.4 lấy câu bạn <b>chưa gặp</b> (cố định, không ngẫu nhiên), chấm cuối bài → “bản đồ xuất phát” ✓/~/✗ theo task
                để lập kế hoạch tuần đầu. Là điểm khởi đầu, không phải “đạt/chưa đạt”. Có thể chia 2 lần × 14 câu: lần sau tự lấy 14 câu khác.
              </div>
              <label className="field">
                Số câu
                <Seg
                  value={String(diagCount)}
                  onChange={(v) => setDiagCount(Number(v))}
                  items={[
                    { id: String(diagDefault), label: `${diagDefault} câu · 2 câu/task` },
                    { id: String(diagDefault / 2), label: `${diagDefault / 2} câu · 1 câu/task (chia 2 lần)` },
                  ]}
                />
              </label>
              {!classified && <div className="small muted">Chưa có câu nào được gắn task — chạy <code>npm run classify-tasks</code> hoặc ENRICH để phân loại.</div>}
              {classified && diag.short.length > 0 && <div className="small warn">Chưa đủ câu cho task {diag.short.join(', ')}.</div>}
            </>
          )}

          {mode === 'pack' && (
            <label className="field">
              Bộ đề
              <select value={filters.packs?.[0] ?? ''} onChange={(e) => set({ packs: e.target.value ? [e.target.value] : [] })}>
                <option value="">— Chọn bộ đề —</option>
                {ORIGINS.map((o) => {
                  const packs = bank.packs.filter((p) => p.origin === o.id);
                  if (!packs.length) return null;
                  return (
                    <optgroup key={o.id} label={o.label}>
                      {packs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({packCounts.get(p.id) ?? 0} câu)
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </label>
          )}

          {filterable && (
            <div className="stack sm">
              <div className="row between">
                <b className="small">Chủ đề {mode !== 'topic' && <span className="muted">(tùy chọn)</span>}</b>
                {filters.topics?.length ? (
                  <button className="btn ghost sm" onClick={() => set({ topics: [] })}>
                    Bỏ chọn
                  </button>
                ) : null}
              </div>
              <div className="row" style={{ gap: 6 }}>
                {meta.topics.map((t) => (
                  <Chip key={t.id} on={filters.topics?.includes(t.id)} onClick={() => set({ topics: toggle(filters.topics, t.id) })} count={topicCount(t.id)}>
                    {t.icon} {t.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {filterable && (showAdvanced || mode === 'weak' || mode === 'topic') && (
            <div className="stack sm">
              <b className="small">Domain</b>
              <div className="row" style={{ gap: 6 }}>
                {meta.domains.map((d) => (
                  <Chip key={d.id} on={filters.domains?.includes(d.id)} onClick={() => set({ domains: toggle(filters.domains, d.id) })}>
                    {d.code} · {d.label_vi}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {filterable && (filters.tags?.length ?? 0) > 0 && (
            <div className="stack sm">
              <div className="row between">
                <b className="small">Tag đang lọc</b>
                <button className="btn ghost sm" onClick={() => set({ tags: [] })}>
                  Bỏ chọn
                </button>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {filters.tags!.map((tg) => (
                  <Chip key={tg} on onClick={() => set({ tags: toggle(filters.tags, tg) })} count={practice.filter((q) => q.tags.includes(tg)).length}>
                    {tg} ✕
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {showRequirements && (
            <div className="stack sm">
              <div className="row between">
                <b className="small">
                  Tiêu chí đề hỏi {filters.requirements?.length ? <span className="badge accent">{filters.requirements.length}</span> : null}
                </b>
                {filters.requirements?.length ? (
                  <button className="btn ghost sm" onClick={() => set({ requirements: [] })}>
                    Bỏ chọn
                  </button>
                ) : null}
              </div>
              {reqCounts.size === 0 && (
                <div className="tiny muted">Chưa có câu nào được gắn tiêu chí — ngân hàng nhận diện từ khoá của đề (MOST cost-effective, LEAST operational overhead…).</div>
              )}
              <div className="row" style={{ gap: 6 }}>
                {REQUIREMENTS.map((r) => (
                  <Chip key={r} on={filters.requirements?.includes(r)} onClick={() => set({ requirements: toggle(filters.requirements, r) })} count={reqCounts.get(r) ?? 0}>
                    {REQUIREMENT_INFO[r].icon} {REQUIREMENT_INFO[r].label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {showTasks && (
            <div className="stack sm">
              <div className="row between">
                <b className="small">
                  Task (exam guide 1.1–4.4) {filters.tasks?.length ? <span className="badge accent">{filters.tasks.length}</span> : null}
                </b>
                {filters.tasks?.length ? (
                  <button className="btn ghost sm" onClick={() => set({ tasks: [] })}>
                    Bỏ chọn
                  </button>
                ) : null}
              </div>
              {!classified && (
                <div className="tiny muted">
                  Chưa có câu nào được gắn task — chạy <code>npm run classify-tasks</code> hoặc ENRICH để phân loại.
                </div>
              )}
              <div className="task-groups">
                {meta.domains.map((d) => {
                  const list = tasks.filter((x) => x.domain === d.id);
                  if (!list.length) return null;
                  return (
                    <div key={d.id} className="task-group">
                      <span className="task-dom" title={`${d.label} — ${d.label_vi}`}>
                        {d.code}
                      </span>
                      <div className="row" style={{ gap: 6 }}>
                        {list.map((x) => {
                          const on = !!filters.tasks?.includes(x.id);
                          return (
                            <button
                              key={x.id}
                              type="button"
                              className={`chip task-chip ${on ? 'on' : ''}`}
                              aria-pressed={on}
                              title={`${x.id} ${x.label} — ${x.label_vi}`}
                              onClick={() => set({ tasks: toggle(filters.tasks, x.id) })}
                            >
                              <b className="num">{x.id}</b> {shortTask(x.label_vi)} <span className="n">{taskCounts.get(x.id) ?? 0}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filterable && (showAdvanced || mode === 'topic') && (
            <div className="stack sm">
              <b className="small">Độ khó</b>
              <div className="row" style={{ gap: 6 }}>
                {meta.difficulties.map((d) => (
                  <Chip key={d.id} on={filters.difficulties?.includes(d.id)} onClick={() => set({ difficulties: toggle(filters.difficulties, d.id as Difficulty) })}>
                    {d.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {showAdvanced && (
            <div className="stack sm">
              <div className="row between">
                <b className="small">
                  Tầng câu hỏi {filters.tiers?.length ? <span className="badge accent">{filters.tiers.length}</span> : null}
                </b>
                {filters.tiers?.length ? (
                  <button className="btn ghost sm" onClick={() => set({ tiers: [] })}>
                    Bỏ chọn
                  </button>
                ) : null}
              </div>
              <div className="row" style={{ gap: 6 }}>
                {TIERS.map((t) => (
                  <Chip key={t} on={filters.tiers?.includes(t)} onClick={() => set({ tiers: toggle(filters.tiers, t) })} count={tierStats.n[t]} title={TIER_INFO[t].title}>
                    {TIER_INFO[t].label} · {TIER_INFO[t].short}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {showAdvanced && (
            <>
              <div className="stack sm">
                <b className="small">Nguồn câu hỏi</b>
                <div className="row" style={{ gap: 6 }}>
                  {ORIGINS.map((o) => (
                    <Chip key={o.id} on={filters.origins?.includes(o.id)} onClick={() => set({ origins: toggle(filters.origins, o.id) })} count={practice.filter((q) => q.origin === o.id).length}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="stack sm">
                <div className="row between">
                  <b className="small">Service {filters.services?.length ? <span className="badge accent">{filters.services.length}</span> : null}</b>
                  <input type="search" placeholder="Tìm service…" value={serviceQuery} onChange={(e) => setServiceQuery(e.target.value)} className="svc-search" />
                </div>
                <div className="row" style={{ gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {services.map((s) => {
                    const c = practice.filter((q) => q.services.includes(s.name)).length;
                    if (!c && !filters.services?.includes(s.name)) return null;
                    return (
                      <Chip key={s.name} on={filters.services?.includes(s.name)} onClick={() => set({ services: toggle(filters.services, s.name) })} count={c}>
                        {s.name}
                      </Chip>
                    );
                  })}
                </div>
              </div>
              <label className="field">
                Từ khóa (stem, đáp án, service, tag)
                <input type="search" value={filters.search ?? ''} onChange={(e) => set({ search: e.target.value })} placeholder="ví dụ: Multi-AZ, PrivateLink, cost-effective…" />
              </label>
            </>
          )}
        </div>

        <div className="card stack sticky-side" style={{ position: 'sticky', top: 16 }}>
          <div>
            <div className="small muted">Bài test</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {MODE_INFO[mode].icon} {MODE_INFO[mode].label}
              {mode === 'sealed' && formId ? ` ${formId}` : ''}
            </div>
            {pearsonLike && <div className="small nt-accent">🏛 Mô phỏng Pearson VUE</div>}
            {tierAOn && <div className="small nt-accent">🏷️ Chỉ câu tầng A (giống đề thật)</div>}
          </div>

          {mode !== 'pack' && !pearsonLike && mode !== 'diagnostic' && mode !== 'today' && (
            <label className="field">
              Số câu
              <div className="row nowrap">
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, Math.min(mode === 'exam' ? 130 : 100, available || 1))}
                  value={Math.min(count, Math.max(1, available))}
                  onChange={(e) => setCount(Number(e.target.value))}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} style={{ width: 70 }} />
              </div>
            </label>
          )}

          {pearsonLike ? (
            <div className="field-static small">
              <span className="dim">Chấm điểm</span>
              <b>
                {FEEDBACK_INFO.exam.icon} {FEEDBACK_INFO.exam.label} (như thi thật)
              </b>
            </div>
          ) : (
            <label className="field">
              Chấm điểm
              <Seg value={feedback} onChange={setFeedback} items={(['exam', 'practice'] as FeedbackMode[]).map((f) => ({ id: f, label: `${FEEDBACK_INFO[f].icon} ${FEEDBACK_INFO[f].label}`, title: FEEDBACK_INFO[f].desc }))} />
            </label>
          )}

          {mode === 'today' ? (
            <div className="field-static small">
              <span className="dim">Đồng hồ</span>
              <b>⏱ mềm theo quỹ {todayMins ?? todayPreview?.minutes ?? ''}′ — nhắc khi hết giờ, không tự nộp</b>
            </div>
          ) : (
          <label className="field">
            Thời gian
            <select
              value={timing}
              onChange={(e) => {
                autoTiming.current = false;
                setTiming(e.target.value);
              }}
            >
              {TIMING_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {p.hint}
                </option>
              ))}
            </select>
            {timing === 'custom' && (
              <div className="row nowrap">
                <input type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} style={{ width: 80 }} /> phút
              </div>
            )}
          </label>
          )}
          {paceClock && (
            <label className="check-line small" title="Thí sinh thi bằng tiếng Anh không phải tiếng mẹ đẻ được AWS cộng 30 phút (130′ → 160′) nếu đăng ký ESL +30 trước khi đặt lịch thi">
              <input type="checkbox" checked={eslOn} onChange={(e) => setEslChoice(e.target.checked)} />
              <span>
                🌐 ESL +30′ <span className="muted">— ×160/130 như chế độ ESL của AWS{goalEsl && eslChoice === undefined ? ' (theo mục tiêu thi của bạn)' : ''}</span>
              </span>
            </label>
          )}

          <div className="stack sm">
            <label className="check-line small">
              <input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} />
              <span>Xáo thứ tự đáp án (chống nhớ vị trí)</span>
            </label>
            <label className="check-line small" title="Ẩn các lựa chọn cho tới khi bạn viết ra đáp án mình nghĩ — luyện nhớ chủ động (active recall)">
              <input type="checkbox" checked={recallFirst} onChange={(e) => setRecallFirst(e.target.checked)} />
              <span>
                🧠 Nhớ lại trước <span className="muted">— tự viết đáp án trước khi xem lựa chọn</span>
              </span>
            </label>
          </div>

          <div className="divider" style={{ margin: '4px 0' }} />
          <div className="stack sm small">
            <div className="row between">
              <span className="muted">Số câu sẽ làm</span>
              <b className="num">
                {n}
                {pearsonLike
                  ? mode === 'sealed' || n >= examN
                    ? n > 0
                      ? ` (${scored} + ${pilots} thử nghiệm)`
                      : ''
                    : ` / ${examN} (ngân hàng chỉ có ${mPool.length})`
                  : mode !== 'pack' && mode !== 'diagnostic' && mode !== 'today' && available < count
                    ? ` / ${count} (chỉ có ${available})`
                    : ''}
              </b>
            </div>
            <div className="row between">
              <span className="muted" title="Tổng thời gian chuẩn ước lượng của các câu">
                Σ thời gian chuẩn
              </span>
              <b className="num">≈ {fmtDuration(estimate, { long: true })}</b>
            </div>
            <div className="row between">
              <span className="muted">Đồng hồ</span>
              <b className="num">
                {mode === 'today' ? `mềm · ${todayMins ?? todayPreview?.minutes ?? ''}′` : limit ? fmtDuration(limit, { long: true }) : 'không giới hạn'}
                {pearsonLike && limit ? ' · không tạm dừng' : ''}
              </b>
            </div>
            {n > 0 && (
              <div className="stack sm" style={{ gap: 4 }}>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} title={`${realismTitle(realism, meta)}${lowRealism ? `\n${REALISM_LOW_HINT}` : ''}`}>
                  <span className={`badge ${lowRealism ? 'warn' : 'good'}`}>
                    🎯 {approx ? '≈ ' : ''}
                    {realismText(realism)}
                  </span>
                </div>
                {/* the hint matters where a score is read as a measure (mocks, sealed forms, the diagnostic) */}
                {lowRealism && ['exam', 'sealed', 'diagnostic'].includes(mode) && <div className="tiny warn">⚠ {REALISM_LOW_HINT}</div>}
              </div>
            )}
            {(heldBack > 0 || outOfScope > 0) && (
              <div className="tiny muted">
                {[heldBack > 0 ? `🔒 ${heldBack} câu đang niêm phong` : '', outOfScope > 0 ? `🎯 ${outOfScope} câu ngoài phạm vi đề thi` : ''].filter(Boolean).join(' · ')}{' '}
                không dùng khi luyện.
              </div>
            )}
          </div>
          <button className="btn primary lg" disabled={busy || n === 0 || (mode === 'pack' && !filters.packs?.length)} onClick={start}>
            {busy ? 'Đang tạo…' : mode === 'sealed' ? '▶ Bắt đầu đề niêm phong' : pearsonOn ? '▶ Bắt đầu thi thử' : mode === 'today' ? '▶ Học hôm nay' : '▶ Bắt đầu'}
          </button>
          {n === 0 && (
            <div className="small muted">
              {mode === 'sealed' ? 'Chưa có đề niêm phong nào để làm.' : 'Không có câu nào khớp — đổi chế độ hoặc bỏ bớt bộ lọc.'}
            </div>
          )}
          <div className="tiny muted shortcut-help">
            Phím tắt khi làm bài: <span className="kbd">1</span>–<span className="kbd">5</span> chọn · <span className="kbd">Shift</span>+<span className="kbd">1</span>–<span className="kbd">5</span> gạch bỏ
            (hoặc chuột phải) · <span className="kbd">←</span>
            <span className="kbd">→</span> chuyển câu · <span className="kbd">F</span> cắm cờ · <span className="kbd">U</span> chưa chắc · <span className="kbd">H</span> gợi ý (chế độ xem
            đáp án ngay) · <span className="kbd">K</span> tô từ khóa
          </div>
        </div>
      </section>
    </div>
  );
}
