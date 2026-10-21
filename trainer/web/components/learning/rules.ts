// [μ v5] Pure rules of the v5 learning screens (no React, no fetch — unit-tested in tests/learning-ui.test.ts):
// "▶ Học hôm nay" budget chips and composition, the exam-phase / new-question / catch-up lines, the statistical
// shield's texts (bucket evidence, two-rate gaps behind the stamina / calibration / length-split / exposure notes),
// the result page's correction steps and "đính chính" list, attempt badges (stopped early, source, retest), the pair
// page's progress line, go / no-go and the capacity forecast rows.
import { isCorrect, normalizeKeys, scaledScore } from '../../../shared/scoring.ts';
import { retestIds } from '../../../shared/filters.ts';
import { NEED_MAX, compareRates, estimate, undecidedText as undecided, weakFirst } from '../../../shared/evidence.ts';
import type { AnswerRecord, AttemptSource, AttemptSummary, Bucket, ExamForecast, ExamPhaseInfo, GoNoGo, NewQuota, PairCompare, Question, TodayMix, TodayPreview } from '../../../shared/types.ts';

const round1 = (x: number) => Math.round(x * 10) / 10;
/** "dd/mm" of a YYYY-MM-DD key (no time-zone shift). */
export const dayMonth = (key: string) => {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
};
/** Signed points: "+4", "−3", "0" — one decimal under 1 point ("+0.2"), so a bound just off zero never reads "0". */
export const signedPts = (x: number) => {
  const v = Math.abs(x) < 1 ? Math.round(x * 10) / 10 : Math.round(x);
  return v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0';
};

// ── C1 "Học hôm nay" ────────────────────────────────────────────────────────

/** Budget chips of the Dashboard hero (minutes). */
export const BUDGET_CHIPS = [5, 10, 25, 45];
/** "Thêm 10 câu" after the daily goal: another today build with this budget (Design C1). */
export const EXTRA_MINUTES = 10;

/**
 * Chips to offer: 5 / 10 / 25 / 45 plus the learner's own budget when it is another value, ascending. In a phase with a
 * daily cap (light: 30′) the larger chips give way to the cap itself.
 */
export function budgetOptions(defaultMinutes?: number, maxMinutes?: number): number[] {
  const set = new Set<number>(BUDGET_CHIPS);
  if (defaultMinutes && defaultMinutes > 0) set.add(Math.round(defaultMinutes));
  let list = [...set].sort((a, b) => a - b);
  if (maxMinutes && maxMinutes > 0) {
    list = list.filter((m) => m < maxMinutes);
    list.push(maxMinutes);
  }
  return list;
}

/** What the session is made of, fixed order, non-empty parts only: "12 ôn · 6 làm lại · 10 vá task 1.2 · 4 mới". */
export function mixParts(p: { count: number; mix?: Partial<TodayMix> }): string[] {
  const m = p.mix ?? {};
  const parts: string[] = [];
  if (m.review) parts.push(`${m.review} ôn${m.swapped ? ` (${m.swapped} câu anh em)` : ''}`);
  if (m.retry) parts.push(`${m.retry} làm lại`);
  if (m.weak) parts.push(`${m.weak} vá ${m.weakTasks?.length ? `task ${m.weakTasks.join(', ')}` : 'task yếu'}`);
  if (m.new) parts.push(`${m.new} mới`);
  if (m.advance) parts.push(`${m.advance} ôn trước hạn`);
  const known = (m.review ?? 0) + (m.retry ?? 0) + (m.weak ?? 0) + (m.new ?? 0) + (m.advance ?? 0);
  // the composer tops up a short session with quick practice questions (step 5)
  if (known > 0 && p.count > known) parts.push(`${p.count - known} luyện thêm`);
  return parts;
}

/** Today's study so far against the daily goal (minutes): share 0..100 and a short line. */
export function todayProgress(done: TodayPreview['done'] | undefined, goalMinutes: number): { pct: number; text: string; met: boolean } {
  const d = done ?? { answers: 0, minutes: 0, goalMet: false };
  const pct = goalMinutes > 0 ? Math.max(0, Math.min(100, Math.round((d.minutes / goalMinutes) * 100))) : 0;
  const text = d.answers ? `Hôm nay đã học ${d.answers} câu · ${Math.round(d.minutes)}′ / ${goalMinutes}′` : `Hôm nay chưa học câu nào · mục tiêu ${goalMinutes}′`;
  return { pct, text, met: !!d.goalMet };
}

/** "<planId>#<sessionId>" (TodayMix.coach, plan session refs) → its parts. */
export function parseSessionRef(ref: string | undefined): { plan: string; session: string } | undefined {
  if (!ref) return undefined;
  const i = ref.lastIndexOf('#');
  if (i <= 0 || i === ref.length - 1) return undefined;
  return { plan: ref.slice(0, i), session: ref.slice(i + 1) };
}

// ── C2 exam phases, new-question quota, catch-up, sprint ────────────────────

/** "Hôm nay: 34 ôn + 18 mới → phủ 100 % trước 25/11" — or why new questions are held back. */
export function newQuotaLine(q: NewQuota | undefined, reviews: number): { text: string; paused: boolean } | undefined {
  if (!q) return undefined;
  const rev = `${reviews} ôn`;
  if (q.paused) return { text: `Hôm nay: ${rev} · ⏸ tạm dừng câu mới — ${q.paused}`, paused: true };
  if (q.unseen <= 0) return { text: `Hôm nay: ${rev} · ✓ đã gặp hết câu trong ngân hàng`, paused: false };
  const done = q.doneToday >= q.perDay && q.perDay > 0 ? ' ✓' : q.doneToday > 0 ? ` (đã làm ${q.doneToday})` : '';
  return { text: `Hôm nay: ${rev} + ${q.perDay} mới${done} → phủ 100 % trước ${dayMonth(q.cutoff)}`, paused: false };
}

/** Behind schedule: how to clear the review backlog instead of letting it pile up silently. */
export function catchUpLine(c: { backlog: number; days: number; perDay: number } | undefined): string | undefined {
  if (!c || c.backlog <= 0) return undefined;
  return `Đang tồn ${c.backlog} lượt ôn — ôn khoảng ${c.perDay} câu/ngày trong ${c.days} ngày tới để bắt kịp lịch, thay vì để tồn dồn lên.`;
}

/** "T−12 · 08/11 → 14/11" for the phase banner. */
export function phaseSpan(p: Pick<ExamPhaseInfo, 'daysLeft' | 'from' | 'to'>): string {
  const left = p.daysLeft > 0 ? `T−${p.daysLeft}` : p.daysLeft === 0 ? 'thi hôm nay' : `đã thi ${-p.daysLeft} ngày trước`;
  const span = p.from && p.to ? (p.from === p.to ? dayMonth(p.from) : `${dayMonth(p.from)} → ${dayMonth(p.to)}`) : p.to ? `tới ${dayMonth(p.to)}` : '';
  return span ? `${left} · ${span}` : left;
}

/** The sprint / final-week plan is offered from 14 days before the exam until the day before it. */
export function sprintOffered(daysLeft: number | undefined): boolean {
  return typeof daysLeft === 'number' && daysLeft >= 1 && daysLeft <= 14;
}

// ── C8 statistical shield ───────────────────────────────────────────────────

/** Copy for an undecided verdict (Design C8, λ's wording); without a target just "chưa đủ dữ liệu". */
export function undecidedText(needMore?: number): string {
  return needMore && needMore > 0 ? undecided(needMore) : 'chưa đủ dữ liệu';
}

/** A bucket against the learner's own base rate, or undefined on a server without the shield. */
export function evidenceNote(b: Pick<Bucket, 'verdict' | 'needMore'>): { text: string; tone: 'bad' | 'good' | 'dim' } | undefined {
  switch (b.verdict) {
    case 'below':
      return { text: 'thấp hơn mức chung của bạn', tone: 'bad' };
    case 'above':
      return { text: 'cao hơn mức chung của bạn', tone: 'good' };
    case 'same':
      return { text: 'ngang mức chung của bạn', tone: 'dim' };
    case 'unknown':
      return { text: undecidedText(b.needMore), tone: 'dim' };
    default:
      return undefined;
  }
}

/** "31–60%" — the bucket's 80 % interval, when the server sends one. */
export function intervalText(b: Pick<Bucket, 'lo' | 'hi'>): string | undefined {
  if (typeof b.lo !== 'number' || typeof b.hi !== 'number') return undefined;
  return `${Math.round(b.lo)}–${Math.round(b.hi)}%`;
}

/**
 * Weakest first by the pessimistic bound (λ's weakFirst: lo, else shrunk, else raw accuracy; ties: more answers first),
 * answered buckets only.
 */
export function weakSort<T extends Pick<Bucket, 'lo' | 'shrunk' | 'accuracy' | 'attempts' | 'key'>>(rows: T[]): T[] {
  return rows.filter((b) => b.attempts > 0).sort(weakFirst);
}

/**
 * Dashboard "Chủ đề yếu nhất": topics confirmed below the learner's base rate, pessimistic bound first. A server without
 * the shield (no `verdict`) keeps the v4 rule: ≥ 5 answers, lowest accuracy.
 */
export function weakestTopics(byTopic: Bucket[], n = 3): { list: Bucket[]; shielded: boolean } {
  const shielded = byTopic.some((b) => b.verdict !== undefined);
  if (!shielded) return { list: byTopic.filter((b) => b.attempts >= 5).sort((a, b) => a.accuracy - b.accuracy).slice(0, n), shielded };
  return { list: weakSort(byTopic.filter((b) => b.verdict === 'below')).slice(0, n), shielded };
}

export interface Rate {
  correct: number;
  answers: number;
}

export interface Gap {
  diff: number; // a − b, raw percentage points (1 decimal)
  lo: number; // 80 % interval of the difference, points (shared/evidence.ts compareRates)
  hi: number;
  verdict: 'higher' | 'lower' | 'same' | 'unknown'; // a vs b; 'same' = the difference is surely within ± 10 points
  needMore?: number; // answers per side still needed before a verdict is likely (undefined = decided)
}

const rate = (r: Rate) => (r.answers > 0 ? r.correct / r.answers : 0);
/** Accuracy in % with one decimal (0 without answers). */
export const ratePct = (r: Rate) => round1(rate(r) * 100);

/**
 * a − b with the app's statistical shield (λ's compareRates: Jeffreys posteriors, 80 % level, ≥ 5 answers a side): a
 * verdict only when the interval of the difference excludes 0 ('same' when it surely stays within ± 10 points).
 */
export function rateGap(a: Rate, b: Rate): Gap {
  const c = compareRates(a.correct, a.answers, b.correct, b.answers);
  const verdict = c.verdict === 'above' ? 'higher' : c.verdict === 'below' ? 'lower' : c.verdict;
  return { diff: round1((rate(a) - rate(b)) * 100), lo: round1(c.lo * 100), hi: round1(c.hi * 100), verdict, needMore: c.needMore > 0 ? c.needMore : undefined };
}

/** The 80 % upper bound (%) of one rate, without shrinkage (Jeffreys interval: Beta(½ + correct, ½ + wrong)). */
export function upperBound(r: Rate): number {
  return round1(estimate(r.correct, r.answers, { p: 0.5, k: 1 }).hi * 100);
}

/** More answers at the same rate before the 80 % upper bound drops below `threshold` (%), or undefined (≤ 500). */
export function needMoreBelow(r: Rate, threshold: number): number | undefined {
  const p = rate(r);
  if (!r.answers || p * 100 >= threshold) return undefined;
  const below = (k: number) => upperBound({ correct: p * (r.answers + k), answers: r.answers + k }) < threshold;
  if (below(0)) return undefined;
  if (!below(NEED_MAX)) return NEED_MAX;
  let lo = 0;
  let hi = NEED_MAX;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (below(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

const ciPts = (g: Gap) => `khoảng 80%: ${signedPts(g.lo)} … ${signedPts(g.hi)} điểm`;

export interface Note {
  cls: '' | 'warn' | 'good' | 'dim';
  text: string;
}

/** Exam stamina (first vs last quarter): a warning or praise only with evidence (Design C8). */
export function staminaNote(qs: (Rate & { acc: number; avgT: number })[]): Note {
  const first = qs[0];
  const last = qs[qs.length - 1];
  const g = rateGap(first, last);
  const drop = Math.round(g.diff);
  if (g.verdict === 'higher') return { cls: 'warn', text: `⚠ Độ chính xác giảm ${drop} điểm từ phần đầu tới phần cuối (${ciPts(g)}) — dấu hiệu mệt/mất tập trung. Luyện thêm bài thi đủ 65 câu để tăng sức bền.` };
  if (first.avgT > 0 && last.avgT < first.avgT * 0.6)
    return { cls: 'warn', text: `⚠ Phần cuối bạn làm nhanh hơn hẳn (${first.avgT}s → ${last.avgT}s/câu) — có thể đang chạy đua với đồng hồ. Giữ nhịp ~2 phút/câu ngay từ đầu.` };
  if (g.verdict === 'lower') return { cls: '', text: `📈 Bạn làm tốt hơn về cuối (+${-drop} điểm, ${ciPts(g)}) — có thể khởi động chậm; làm vài câu dễ trước để vào nhịp.` };
  if (g.verdict === 'same') return { cls: 'good', text: `✓ Độ chính xác khá đều giữa phần đầu và phần cuối (${ciPts(g)}) — sức bền tốt.` };
  const per = Math.min(first.answers, last.answers);
  if (Math.abs(drop) >= 15)
    return { cls: 'dim', text: `Phần đầu ${first.acc}% · phần cuối ${last.acc}% — với ${per} câu mỗi phần, chênh ${Math.abs(drop)} điểm vẫn có thể là ngẫu nhiên: chưa đủ dữ liệu để kết luận về sức bền.` };
  return { cls: 'dim', text: `Phần đầu ${first.acc}% · phần cuối ${last.acc}% — chưa thấy chênh lệch rõ giữa các phần (${per} câu mỗi phần).` };
}

/** "Độ tự tin vs kết quả": over- / under-confidence or a good calibration, each only with evidence. */
export function calibrationNote(c: { sure: Rate; unsure: Rate }): Note | undefined {
  const sure = ratePct(c.sure);
  const unsure = ratePct(c.unsure);
  if (!c.sure.answers) return undefined;
  if (c.sure.answers >= 5 && sure < 80) {
    const upper = Math.round(upperBound(c.sure));
    if (upper < 80)
      return {
        cls: 'warn',
        text: `⚠ Tự tin quá mức: khi “chắc chắn” bạn chỉ đúng ${sure}% (${c.sure.answers} câu, cận trên 80%: ${upper}%). Đề thật hay có phương án gần đúng — khi còn phân vân giữa 2 phương án, đánh dấu 🤔 để được ôn lại sớm.`,
      };
    return { cls: 'dim', text: `Khi “chắc chắn” bạn đúng ${sure}% (${c.sure.answers} câu) — có thể là tự tin quá mức, nhưng ${undecidedText(needMoreBelow(c.sure, 80))}.` };
  }
  if (!c.unsure.answers) return { cls: 'dim', text: 'Chưa có câu nào đánh dấu 🤔 chưa chắc — đánh dấu khi còn phân vân để so cảm giác với kết quả.' };
  const g = rateGap(c.sure, c.unsure);
  if (g.verdict === 'higher') return { cls: 'good', text: `✓ Bạn tự đánh giá khá chuẩn: chắc chắn → đúng ${sure}%, chưa chắc → đúng ${unsure}% (${ciPts(g)}).` };
  if (g.verdict === 'same' || g.verdict === 'lower')
    return { cls: '', text: `ℹ️ Câu “chưa chắc” bạn vẫn đúng ${unsure}% — gần bằng lúc chắc chắn (${sure}%). Bạn đang đánh giá thấp mình; tin vào phương pháp loại trừ hơn.` };
  return { cls: 'dim', text: `Chắc chắn → đúng ${sure}% · chưa chắc → đúng ${unsure}% — ${undecidedText(g.needMore)}.` };
}

/** "Câu dài vs câu ngắn": the long-question penalty only with evidence; `examLink` = suggest the mock exam. */
export function lengthNote(l: { long: Rate; short: Rate }, share: number): (Note & { examLink?: boolean }) | undefined {
  const g = rateGap(l.short, l.long);
  if (g.verdict === 'higher') return { cls: 'warn', text: `⚠ Câu dài kéo điểm xuống ${Math.round(g.diff)} điểm (${ciPts(g)}) — đọc câu hỏi cuối đề trước để biết cần tìm gì, rồi mới đọc bối cảnh.` };
  if (l.long.answers && l.short.answers && g.diff >= 10) return { cls: 'dim', text: `Câu dài thấp hơn câu ngắn ${Math.round(g.diff)} điểm — ${undecidedText(g.needMore)}.` };
  if (share < 30) return { cls: 'dim', text: `ℹ️ Bạn mới làm ${share}% câu dài.`, examLink: true };
  if (g.verdict === 'same') return { cls: 'good', text: `✓ Câu dài không kéo điểm xuống (${ciPts(g)}).` };
  return undefined;
}

/** "Câu mới vs câu gặp lại": the memorisation gap only with evidence. */
export function exposureNote(e: { first: Rate; repeat: Rate }, minSplit = 10): Note {
  const g = rateGap(e.repeat, e.first);
  const gap = Math.round(g.diff);
  if (e.first.answers < minSplit || e.repeat.answers < minSplit) return { cls: 'dim', text: `Cần ≥ ${minSplit} câu mỗi nhóm để so sánh.` };
  if (g.verdict === 'higher' && gap >= 5)
    return { cls: 'warn', text: `⚠ Câu gặp lại cao hơn câu mới ${gap} điểm (${ciPts(g)}) — một phần điểm đến từ việc nhớ câu. Đề thật toàn câu mới: ưu tiên câu chưa làm, câu dài và đề niêm phong để đo đúng.` };
  if (g.verdict === 'same' || g.verdict === 'lower') return { cls: 'good', text: `✓ Câu mới và câu gặp lại gần như nhau (${ciPts(g)}) — điểm phản ánh hiểu bài, không phải nhớ đáp án.` };
  if (gap >= 10) return { cls: 'dim', text: `Câu gặp lại cao hơn câu mới ${gap} điểm — ${undecidedText(g.needMore)}.` };
  return { cls: 'dim', text: `Câu gặp lại cao hơn câu mới ${gap} điểm — bình thường khi đang ôn; theo dõi để khoảng cách không nới rộng.` };
}

// ── C7 correction stepper, D3 "đính chính" ──────────────────────────────────

/** A graded first attempt: in the score / stats (mirrors server results.ts isGraded — not a relearn retry, not a skipped blank, not a pilot). */
export const isGraded = (r: Pick<AnswerRecord, 'scored' | 'relearn' | 'skipped'>) => r.scored !== false && !r.relearn && !r.skipped;

/**
 * Question numbers of a result's records: first attempts (skipped blanks included) are 1..N in order; an in-session
 * relearn retry carries the number of its own question (0 when that question has no first attempt in the file).
 */
export function numberAnswers(answers: Pick<AnswerRecord, 'q' | 'relearn'>[]): number[] {
  const first = new Map<string, number>();
  let n = 0;
  const out = answers.map((r) => {
    if (r.relearn) return -1;
    n++;
    if (!first.has(r.q)) first.set(r.q, n);
    return n;
  });
  return out.map((v, i) => (v >= 0 ? v : (first.get(answers[i].q) ?? 0)));
}

/** Viewed: a pick or some time spent (never-viewed answers are not reviews). */
export const viewedAnswer = (r: Pick<AnswerRecord, 'pick' | 't'>) => !!r.pick || r.t > 0;

export type FixKind = 'confident' | 'wrong' | 'unsure';
export const FIX_KIND_INFO: Record<FixKind, { icon: string; label: string; title: string }> = {
  confident: { icon: '🔥', label: 'sai dù chắc chắn', title: 'Không đánh 🤔, không mở gợi ý mà vẫn sai — loại lỗi sửa được nhiều nhất khi xem lại ngay (hypercorrection)' },
  wrong: { icon: '❌', label: 'sai', title: 'Sai khi đã phân vân, đã mở gợi ý, hoặc bỏ trống sau khi đọc' },
  unsure: { icon: '🤔', label: 'đúng nhưng chưa chắc', title: 'Đúng nhưng bạn đánh dấu chưa chắc — xem lại để chắc hơn lần sau' },
};

/**
 * "🩹 Chữa N câu": exactly the set the retest asks again (σ's retestIds — first attempts answered wrong, viewed and not
 * skipped, or right but unsure; confident errors first), minus questions no longer in the bank and wrong answers a fixed
 * key now counts as right (`okNow`). Indexes into `rows`.
 */
export function correctionSteps(rows: { r: AnswerRecord; known: boolean; okNow?: boolean }[]): { index: number; kind: FixKind }[] {
  const out: { index: number; kind: FixKind }[] = [];
  for (const id of retestIds(rows.map((x) => x.r))) {
    const index = rows.findIndex((x) => x.r.q === id && !x.r.relearn && !x.r.skipped);
    if (index < 0 || !rows[index].known) continue;
    const r = rows[index].r;
    // a key fixed after the test that now counts this pick as right: nothing to correct ("đính chính" card covers it)
    if (!r.ok && rows[index].okNow === true && !r.unsure) continue;
    out.push({ index, kind: !r.ok ? (r.pick && !r.unsure && !r.hinted ? 'confident' : 'wrong') : 'unsure' });
  }
  return out;
}

/** Retry pick: multiple-response toggles, single answer replaces (the same key again clears) — like the runner. */
export function togglePick(cur: string[], key: string, multi: boolean): string[] {
  if (multi) return cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
  return cur[0] === key ? [] : [key];
}

/** Retry graded locally (display only, never a review): all-or-nothing like the exam. */
export const retryCorrect = (pick: string[], q: Pick<Question, 'answer'>) => isCorrect(pick, q.answer);

/**
 * Item versioning: the result keeps the key the answer was graded with (`key`) and the question version (`h`).
 * keyChanged → statistics, readiness and the review schedule count this answer against the current key (`nowOk`);
 * edited → the question text/options changed since, the key did not.
 */
export function versionOf(r: AnswerRecord, q: Pick<Question, 'answer' | 'hash'>): { keyChanged: boolean; nowOk: boolean; edited: boolean } {
  const now = normalizeKeys(q.answer);
  const keyChanged = !!r.regraded || (!!r.key && normalizeKeys([...r.key].filter((c) => /[a-z]/i.test(c))) !== now);
  return { keyChanged, nowOk: isCorrect([...r.pick], q.answer), edited: !keyChanged && !!r.h && !!q.hash && r.h !== q.hash };
}

export interface CorrectionItem {
  n: number; // question number in the result
  q: string;
  oldKey: string; // '' when unknown
  newKey: string;
  wasOk: boolean; // as graded then
  nowOk: boolean; // against the current key
}

/** D3 "đính chính": answers whose key was fixed after the test (relearn records left out), the ones learnt wrong first. */
export function correctionsOf(rows: { r: AnswerRecord; q: Pick<Question, 'answer' | 'hash'> | null; n: number }[]): CorrectionItem[] {
  const out: CorrectionItem[] = [];
  for (const { r, q, n } of rows) {
    if (!q || r.relearn || r.skipped) continue;
    const v = versionOf(r, q);
    if (!v.keyChanged) continue;
    const newKey = normalizeKeys(q.answer);
    const oldKey = r.key ? normalizeKeys([...r.key].filter((c) => /[a-z]/i.test(c))) : '';
    out.push({ n, q: r.q, oldKey: oldKey === newKey ? '' : oldKey, newKey, wasOk: r.ok, nowOk: v.nowOk });
  }
  // picked the old key (right then, wrong now) = learnt a wrong answer: those first
  return out.sort((a, b) => Number(b.wasOk && !b.nowOk) - Number(a.wasOk && !a.nowOk) || a.n - b.n);
}

// ── badges: stopped early, source, retest (History, Dashboard, Result) ───────

export const SOURCE_INFO: Record<AttemptSource, { icon: string; label: string; title: string }> = {
  anki: { icon: '🃏', label: 'Anki', title: 'Lượt ôn nhập từ Anki — tự chấm, không tính vào mức sẵn sàng và thống kê tốc độ' },
  listen: { icon: '🎧', label: 'Nghe', title: 'Chế độ nghe — tự chấm, không tính vào mức sẵn sàng và thống kê tốc độ' },
  micro: { icon: '☕', label: 'nhanh', title: 'Câu hỏi nhanh (Claude Code / micro) — gom thành một bài mỗi ngày, không tính vào thống kê tốc độ' },
  chat: { icon: '💬', label: 'chat', title: 'Làm qua Claude (MCP) — thời gian trả lời không tính vào thống kê tốc độ' },
};

export interface BadgeSpec {
  key: string;
  text: string;
  title: string;
  cls: '' | 'accent' | 'warn' | 'good' | 'bad';
}

type BadgeAttempt = Partial<Pick<AttemptSummary, 'pearson' | 'rushed' | 'medianTime' | 'pilotTotal' | 'stoppedEarly' | 'planned' | 'total' | 'answered' | 'source' | 'mode' | 'retestOf'>>;

/** Markers of an attempt in result lists and headers (status colour always with an icon + text). */
export function attemptBadges(a: BadgeAttempt): BadgeSpec[] {
  const out: BadgeSpec[] = [];
  if (a.pearson)
    out.push({ key: 'pearson', cls: 'accent', text: '🎓 Pearson', title: `Mô phỏng Pearson VUE${a.pilotTotal ? `: ${a.pilotTotal} câu thử nghiệm không tính điểm` : ''}, review cuối bài, không tạm dừng` });
  if (a.rushed) out.push({ key: 'rushed', cls: 'warn', text: '⚡ làm vội', title: `Thời gian trung vị ${a.medianTime ?? '?'}s/câu — quá nhanh nên không tính vào thống kê, mức sẵn sàng và lịch ôn` });
  if (a.stoppedEarly) {
    const done = a.total ?? a.answered;
    const frac = a.planned && done !== undefined ? `${done}/${a.planned} · ` : '';
    out.push({ key: 'stopped', cls: '', text: `⏹ ${frac}dừng sớm`, title: 'Dừng ở đây: chỉ lưu câu đã làm, câu chưa xem quay lại hàng chờ — điểm tính trên phần đã làm' });
  }
  if (a.mode === 'retest' || a.retestOf) out.push({ key: 'retest', cls: '', text: '🩹 kiểm tra lại', title: 'Hỏi lại các câu vừa chữa (đáp án được xáo) — không tính vào mức sẵn sàng' });
  const src = a.source ? SOURCE_INFO[a.source] : undefined;
  if (src) out.push({ key: `src-${a.source}`, cls: '', text: `${src.icon} ${src.label}`, title: src.title });
  return out;
}

// ── C4 pair page ─────────────────────────────────────────────────────────────

/** #/pair?a=&b= */
export const pairHref = (a: string, b: string) => `/pair?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`;

/** Progress on one pair: "đã tách được" = ≥ 80 % over the last 10 contrast answers. `last10` is a percentage. */
export function separationText(p: PairCompare['progress'] | undefined): { text: string; cls: 'good' | 'warn' | 'dim' } {
  if (!p || !p.answers) return { text: 'Chưa làm câu phân biệt nào cho cặp này.', cls: 'dim' };
  if (p.separated) return { text: `✓ Đã tách được: đúng ${Math.round(p.last10)}% trong 10 câu gần nhất.`, cls: 'good' };
  if (p.answers < 10) return { text: `Mới ${p.answers} câu (đúng ${p.correct}) — cần ~${10 - p.answers} câu nữa để đánh giá (mốc: ≥ 80% trong 10 câu gần nhất).`, cls: 'dim' };
  return { text: `Chưa tách được: đúng ${Math.round(p.last10)}% trong 10 câu gần nhất (mốc ≥ 80%).`, cls: 'warn' };
}

// ── C2 go / no-go, capacity forecast ─────────────────────────────────────────

export function goNoGoBadge(v: GoNoGo['verdict']): { cls: 'good' | 'warn' | ''; text: string } {
  if (v === 'go') return { cls: 'good', text: '✓ Giữ lịch thi' };
  if (v === 'reschedule') return { cls: 'warn', text: '⚠ Nên cân nhắc dời lịch' };
  return { cls: '', text: '? Chưa đủ dữ liệu để khuyên' };
}

export const checkGlyph = (ok: boolean | null) => (ok === true ? '✓' : ok === false ? '✗' : '?');

/** "16/11 08:00 · còn 3 ngày" for the reschedule deadline (ISO local time); past → "đã qua". */
export function deadlineText(iso: string | undefined, now = new Date()): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, '0');
  const when = `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const ms = d.getTime() - now.getTime();
  if (ms <= 0) return `${when} · đã qua`;
  const hours = ms / 3_600_000;
  return `${when} · còn ${hours < 48 ? `${Math.max(1, Math.floor(hours))} giờ` : `${Math.floor(hours / 24)} ngày`}`;
}

/** Expected exam-day score if only N minutes a day are studied (ExamForecast.capacity), fewest minutes first. */
export function capacityRows(f: Pick<ExamForecast, 'capacity'>, goalMinutes?: number): { minutes: number; pct: number; scaled: number; reviewsPerDay: number; goal: boolean }[] {
  return [...(f.capacity ?? [])]
    .sort((a, b) => a.minutesPerDay - b.minutesPerDay)
    .map((c) => ({ minutes: c.minutesPerDay, pct: c.expected, scaled: scaledScore(c.expected), reviewsPerDay: c.reviewsPerDay, goal: !!goalMinutes && c.minutesPerDay === goalMinutes }));
}
