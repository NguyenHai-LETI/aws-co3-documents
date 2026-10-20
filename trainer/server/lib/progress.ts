// [L] Exam goal, external practice-exam scores and the learning-progress payload (GET /api/progress).
// App-owned Markdown files next to the results (synced by git; loadAttempts skips them: `kind` is not `attempt`):
//   results/goal.md                         front matter: kind: goal, exam_date (YYYY-MM-DD), target_scaled,
//                                           minutes_per_day, rest_days [0–6], study_time / exam_time (HH:MM), delivery
//                                           (online | center), esl, checklist [ticked item ids], updated
//   results/external/<date>_<slug>.md       front matter: kind: external, date, source, score (%), scaled?, note?, created
// Sealed forms (results/sealed.md, sealed.ts) show up here as form status + suggested dates, and a used form becomes an
// internal calibration point next to the external scores ("điểm trên câu mới").
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS_DIR, rel, type AppConfig } from '../config.ts';
import type { BankState } from './bank.ts';
import { asString, splitFrontMatter, stringifyFrontMatter } from './frontmatter.ts';
import { localDateKey, localIso } from './time.ts';
import { dayKey, dayOfKey, dayStartMs, localDay } from './fsrs.ts';
import { computeStates, readinessAt } from './stats.ts';
import { fsrsInfo, resolveFsrsParams } from './fsrs-optimize.ts';
import { calibrate, forecastExam, workloadDays } from './forecast.ts';
import { countRegraded } from './regrade.ts';
import { loadSealed } from './sealed.ts';
import { scaledScore } from '../../shared/scoring.ts';
import type { Attempt, ChecklistItem, ExamForecast, ExamGoal, ExternalScore, ProgressResponse, QuestionState, SealedFormProgress, SealedState } from '../../shared/types.ts';

export const GOAL_FILE = path.join(RESULTS_DIR, 'goal.md');
export const EXTERNAL_DIR = path.join(RESULTS_DIR, 'external');
/** An external score enters the calibration only when the app had this many answers before its date. */
export const MIN_CALIBRATION_ANSWERS = 20;
/** Workload horizon without an exam date (with one: today … exam day, at most WORKLOAD_MAX_DAYS). */
export const WORKLOAD_DAYS = 30;
export const WORKLOAD_MAX_DAYS = 60;
/** Suggested sealed-form dates: the first form ≈ exam − 21 days, the last ≈ exam − 7 (a single form: exam − 7). */
export const SEALED_FIRST_OFFSET = 21;
export const SEALED_LAST_OFFSET = 7;
const SOURCE_MAX = 120;
const NOTE_MAX = 500;
const MINUTES_MIN = 5;
const MINUTES_MAX = 600;

/** Invalid input for a progress route (→ HTTP 400 / 404). */
export class ProgressError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const fileSig = (abs: string) => {
  try {
    const st = fs.statSync(abs);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return '';
  }
};

function writeAtomic(abs: string, text: string): void {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, abs);
}

/** YYYY-MM-DD string of a YAML value (plain scalars may arrive as Date with other YAML schemas). */
function dateValue(v: unknown): string | undefined {
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : asString(v)?.trim();
  return s && dayOfKey(s) !== undefined ? s : undefined;
}

function scaledValue(v: unknown): number | undefined {
  const n = Number(v);
  return v !== undefined && v !== null && v !== '' && Number.isFinite(n) && n >= 100 && n <= 1000 ? Math.round(n) : undefined;
}

/** "HH:MM" (24 h) of a value; YAML 1.1 readers may turn an unquoted 20:30 into the sexagesimal number 1230. */
function timeValue(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 24 * 60) return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(asString(v)?.trim() ?? '');
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : undefined;
}

function minutesValue(v: unknown): number | undefined {
  const n = Number(v);
  return v !== undefined && v !== null && v !== '' && Number.isFinite(n) && n >= MINUTES_MIN && n <= MINUTES_MAX ? Math.round(n) : undefined;
}

/** Rest days 0 (Sunday) … 6, unique and sorted; undefined when the value is not such a list. */
function restDaysValue(v: unknown): number[] | undefined {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',').filter((x) => x.trim()) : undefined;
  if (!list) return undefined;
  const days = list.map((x) => Number(typeof x === 'string' ? x.trim() : x));
  if (!days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return undefined;
  return [...new Set(days)].sort((a, b) => a - b);
}

const isBlank = (v: unknown) => v === null || v === '';

// ── exam-day checklist (static content, official links) ─────────────────────

/** When the policy texts and links below were last checked against the official pages. */
export const CHECKLIST_CHECKED = '2026-10-20';

interface ChecklistDef {
  id: string;
  label: string;
  dueText: string;
  offset: number; // due day relative to the exam day (negative = before)
  hint: string;
  link?: string;
  when?: (g: ExamGoal) => boolean;
}

const BEFORE_TESTING = 'https://aws.amazon.com/certification/policies/before-testing/';
const ONVUE = 'https://www.pearsonvue.com/us/en/aws/onvue.html';

export const CHECKLIST: ChecklistDef[] = [
  {
    id: 'esl',
    label: 'Xin ESL +30 phút trong tài khoản AWS Certification',
    dueText: 'trước khi đặt lịch thi',
    offset: -30,
    hint: 'Đề SAA-C03 không có tiếng Việt nên bạn được thêm 30 phút (130′ → 160′). Chỉ cần xin một lần, trước khi đăng ký thi — áp dụng cho mọi kỳ thi sau; đặt lịch rồi mới xin thì phải huỷ và đặt lại.',
    link: BEFORE_TESTING,
  },
  {
    id: 'booked',
    label: 'Đặt lịch thi và chọn khung giờ (thi online OnVUE hay tại trung tâm)',
    dueText: '3 tuần trước ngày thi',
    offset: -21,
    hint: 'OnVUE: thi tại nhà, 1 màn hình, bàn trống, không được nghỉ giữa giờ, check-in sớm 30 phút. Trung tâm thi: được nghỉ nhưng đồng hồ vẫn chạy.',
    link: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
  },
  {
    id: 'id-name',
    label: 'Kiểm tra giấy tờ tuỳ thân: còn hạn, có ảnh, tên khớp đúng tên đăng ký thi',
    dueText: '2 tuần trước ngày thi',
    offset: -14,
    hint: 'Tên trên giấy tờ phải khớp chính xác với hồ sơ AWS Certification / Pearson VUE — sai lệch có thể bị từ chối vào thi.',
    link: ONVUE,
  },
  {
    id: 'rehearsal',
    label: 'Tổng duyệt: thi thử Pearson đúng khung giờ thi thật, đủ thời lượng (160′ nếu có ESL)',
    dueText: '1 tuần trước ngày thi',
    offset: -7,
    hint: 'Không tạm dừng. Câu nào quá 2,5 phút thì cắm cờ, chọn tạm rồi đi tiếp — câu bỏ trống bị tính là sai.',
  },
  {
    id: 'reschedule',
    label: 'Hạn cuối dời hoặc huỷ lịch thi: chậm nhất 24 giờ trước giờ thi',
    dueText: '1 ngày trước ngày thi',
    offset: -1,
    hint: 'Sau mốc này không dời được nữa; mỗi lịch thi chỉ được dời tối đa 2 lần.',
    link: BEFORE_TESTING,
  },
  {
    id: 'system-test',
    label: 'Chạy system test OnVUE trên đúng máy và mạng sẽ dùng để thi',
    dueText: '1 ngày trước ngày thi',
    offset: -1,
    hint: 'Ưu tiên mạng dây, tắt VPN và phần mềm chặn, chuẩn bị bàn trống, 1 màn hình; thi online không được nghỉ giữa giờ.',
    link: ONVUE,
    when: (g) => g.delivery !== 'center',
  },
  {
    id: 'center',
    label: 'Kiểm tra đường tới trung tâm thi; đến sớm 30 phút, mang giấy tờ tuỳ thân',
    dueText: '1 ngày trước ngày thi',
    offset: -1,
    hint: 'Ở trung tâm thi được nghỉ giữa giờ nhưng đồng hồ vẫn chạy.',
    link: 'https://aws.amazon.com/certification/policies/during-testing/',
    when: (g) => g.delivery === 'center',
  },
  {
    id: 'after',
    label: 'Sau khi thi: kết quả trong tối đa 5 ngày làm việc; nếu trượt, chờ 14 ngày mới thi lại được',
    dueText: 'ngày thi',
    offset: 0,
    hint: 'Kết quả và bảng điểm theo domain có trong tài khoản AWS Certification.',
    link: 'https://aws.amazon.com/certification/policies/after-testing/',
  },
];
const CHECKLIST_IDS = new Set(CHECKLIST.map((c) => c.id));

/** The checklist for this goal: due dates relative to the exam day, ticks from goal.checklist. */
export function examChecklist(goal: ExamGoal, now = Date.now()): ChecklistItem[] {
  const today = localDay(now);
  const exam = goal.examDate ? dayOfKey(goal.examDate) : undefined;
  const ticked = goal.checklist ?? {};
  return CHECKLIST.filter((c) => !c.when || c.when(goal)).map((c) => {
    const item: ChecklistItem = { id: c.id, label: c.label, done: ticked[c.id] === true, dueText: c.dueText, hint: c.hint };
    if (c.link) item.link = c.link;
    if (exam !== undefined) {
      const due = exam + c.offset;
      item.due = dayKey(due);
      if (!item.done && due < today) item.overdue = true;
    }
    // booked without the ESL extension: it only applies to registrations made after the request
    if (c.id === 'esl' && !item.done && ticked.booked === true) item.overdue = true;
    return item;
  });
}

// ── goal ────────────────────────────────────────────────────────────────────

let goalCache: { sig: string; goal: ExamGoal } | undefined;

function goalFromData(d: Record<string, unknown>): ExamGoal {
  const goal: ExamGoal = {};
  const examDate = dateValue(d.exam_date);
  const targetScaled = scaledValue(d.target_scaled);
  const minutes = minutesValue(d.minutes_per_day);
  const rest = restDaysValue(d.rest_days);
  const studyTime = timeValue(d.study_time);
  const examTime = timeValue(d.exam_time);
  if (examDate) goal.examDate = examDate;
  if (targetScaled !== undefined) goal.targetScaled = targetScaled;
  if (minutes !== undefined) goal.minutesPerDay = minutes;
  if (rest?.length) goal.restDays = rest;
  if (studyTime) goal.studyTime = studyTime;
  if (examTime) goal.examTime = examTime;
  if (d.delivery === 'online' || d.delivery === 'center') goal.delivery = d.delivery;
  if (d.esl === true) goal.esl = true;
  const ticked = Array.isArray(d.checklist) ? d.checklist.map((x) => String(x).trim()).filter(Boolean) : [];
  if (ticked.length) goal.checklist = Object.fromEntries(ticked.map((id) => [id, true]));
  return goal;
}

export function loadGoal(): ExamGoal {
  const sig = fileSig(GOAL_FILE);
  if (goalCache?.sig === sig) return goalCache.goal;
  let goal: ExamGoal = {};
  if (sig) {
    const fm = splitFrontMatter(fs.readFileSync(GOAL_FILE, 'utf8'));
    if (!fm.error && fm.data.kind === 'goal') goal = goalFromData(fm.data);
  }
  goalCache = { sig, goal };
  return goal;
}

export interface GoalInput {
  examDate?: unknown;
  targetScaled?: unknown;
  minutesPerDay?: unknown;
  restDays?: unknown;
  studyTime?: unknown;
  examTime?: unknown;
  delivery?: unknown;
  esl?: unknown;
  checklist?: unknown;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function goalBody(g: ExamGoal, passScaled: number): string {
  const target = g.targetScaled ?? passScaled;
  const ticked = CHECKLIST.filter((c) => g.checklist?.[c.id]).map((c) => c.label);
  return [
    '# 🎯 Mục tiêu thi',
    '',
    g.examDate ? `- Ngày thi: **${g.examDate}**${g.examTime ? ` lúc ${g.examTime}` : ''}` : '- Ngày thi: _(chưa đặt)_',
    `- Điểm mục tiêu: **${target}**/1000${g.targetScaled === undefined ? ' (mặc định = điểm đỗ)' : ''}`,
    ...(g.minutesPerDay ? [`- Thời gian học: ${g.minutesPerDay} phút/ngày${g.studyTime ? `, khoảng ${g.studyTime}` : ''}`] : g.studyTime ? [`- Giờ học: ${g.studyTime}`] : []),
    ...(g.restDays?.length ? [`- Ngày nghỉ: ${g.restDays.map((d) => WEEKDAYS[d]).join(', ')}`] : []),
    ...(g.delivery ? [`- Hình thức thi: ${g.delivery === 'online' ? 'online (OnVUE)' : 'tại trung tâm thi'}`] : []),
    ...(g.esl ? ['- ESL +30 phút: có (luyện với thời gian 160′)'] : []),
    ...(ticked.length ? ['', '## ✅ Checklist ngày thi đã xong', '', ...ticked.map((l) => `- ${l}`)] : []),
    '',
    '_File do app quản lý — sửa trong app: Thống kê → 🎯 Ngày thi & dự báo._',
    '',
  ].join('\n');
}

/**
 * Updates the goal: a missing field keeps its value, null / '' clears it (esl: false clears it too). `checklist` is merged
 * key by key (true = ticked, false = unticked; ids not sent keep their state). Nothing left → the file is removed.
 * `examDate` YYYY-MM-DD · `targetScaled` 100–1000 · `minutesPerDay` 5–600 · `restDays` 0 (Sunday) … 6 · `studyTime` /
 * `examTime` HH:MM · `delivery` online | center.
 */
export function saveGoal(input: GoalInput, passScaled: number): ExamGoal {
  const cur = loadGoal();
  const next: ExamGoal = { ...cur, ...(cur.checklist ? { checklist: { ...cur.checklist } } : {}) };
  const field = <K extends keyof ExamGoal>(key: K, raw: unknown, parse: (v: unknown) => ExamGoal[K] | undefined, error: string) => {
    if (raw === undefined) return;
    if (isBlank(raw)) {
      delete next[key];
      return;
    }
    const v = parse(raw);
    if (v === undefined) throw new ProgressError(400, error);
    next[key] = v;
  };
  field('examDate', input.examDate, dateValue, 'Ngày thi không hợp lệ (định dạng YYYY-MM-DD).');
  field('targetScaled', input.targetScaled, scaledValue, 'Điểm mục tiêu phải từ 100 đến 1000.');
  field('minutesPerDay', input.minutesPerDay, minutesValue, `Số phút mỗi ngày phải từ ${MINUTES_MIN} đến ${MINUTES_MAX}.`);
  field('studyTime', input.studyTime, timeValue, 'Giờ học không hợp lệ (định dạng HH:MM).');
  field('examTime', input.examTime, timeValue, 'Giờ thi không hợp lệ (định dạng HH:MM).');
  field('delivery', input.delivery, (v) => (v === 'online' || v === 'center' ? v : undefined), 'Hình thức thi phải là online hoặc center.');
  if (input.restDays !== undefined) {
    const rest = isBlank(input.restDays) ? [] : restDaysValue(input.restDays);
    if (!rest) throw new ProgressError(400, 'Ngày nghỉ phải là danh sách số 0 (Chủ nhật) … 6 (Thứ bảy).');
    if (rest.length >= 7) throw new ProgressError(400, 'Cần ít nhất một ngày học trong tuần.');
    if (rest.length) next.restDays = rest;
    else delete next.restDays;
  }
  if (input.esl !== undefined) {
    if (input.esl === true || input.esl === 'true') next.esl = true;
    else if (input.esl === false || input.esl === 'false' || isBlank(input.esl)) delete next.esl;
    else throw new ProgressError(400, 'esl phải là true hoặc false.');
  }
  if (input.checklist !== undefined) {
    if (isBlank(input.checklist)) delete next.checklist;
    else {
      if (typeof input.checklist !== 'object' || Array.isArray(input.checklist)) throw new ProgressError(400, 'checklist phải là { mục: true/false }.');
      const ticks = { ...(next.checklist ?? {}) };
      for (const [id, v] of Object.entries(input.checklist as Record<string, unknown>)) {
        if (!CHECKLIST_IDS.has(id)) continue; // unknown ids are ignored (ticks stored by a newer app version stay)
        if (v === true) ticks[id] = true;
        else delete ticks[id];
      }
      if (Object.keys(ticks).length) next.checklist = ticks;
      else delete next.checklist;
    }
  }
  const hasAny = (Object.keys(next) as (keyof ExamGoal)[]).some((k) => next[k] !== undefined);
  if (!hasAny) {
    fs.rmSync(GOAL_FILE, { force: true });
  } else {
    const data: Record<string, unknown> = {
      kind: 'goal',
      exam_date: next.examDate,
      target_scaled: next.targetScaled,
      minutes_per_day: next.minutesPerDay,
      rest_days: next.restDays,
      study_time: next.studyTime,
      exam_time: next.examTime,
      delivery: next.delivery,
      esl: next.esl,
      checklist: next.checklist ? Object.keys(next.checklist).sort() : undefined,
      updated: localIso(),
    };
    for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
    writeAtomic(GOAL_FILE, stringifyFrontMatter(data) + '\n' + goalBody(next, passScaled));
  }
  goalCache = undefined;
  return loadGoal();
}

// ── external practice-exam scores ───────────────────────────────────────────

let extCache: { sig: string; scores: ExternalScore[] } | undefined;

function externalFiles(): string[] {
  try {
    return fs
      .readdirSync(EXTERNAL_DIR)
      .filter((f) => f.endsWith('.md') && !f.startsWith('.') && !f.startsWith('_'))
      .sort();
  } catch {
    return [];
  }
}

/** Stored external scores, newest first (readinessAtDate not filled in). */
export function loadExternal(): ExternalScore[] {
  const files = externalFiles();
  const sig = files.map((f) => `${f}:${fileSig(path.join(EXTERNAL_DIR, f))}`).join('|');
  if (extCache?.sig === sig) return extCache.scores;
  const scores: ExternalScore[] = [];
  for (const f of files) {
    const abs = path.join(EXTERNAL_DIR, f);
    const fm = splitFrontMatter(fs.readFileSync(abs, 'utf8'));
    if (fm.error || fm.data.kind !== 'external') continue;
    const date = dateValue(fm.data.date);
    const score = Number(fm.data.score);
    if (!date || !Number.isFinite(score)) continue;
    const s: ExternalScore = {
      id: f.slice(0, -3),
      date,
      source: asString(fm.data.source)?.trim() || 'Đề thi thử',
      score: round1(Math.min(100, Math.max(0, score))),
      file: rel(abs),
    };
    const scaled = scaledValue(fm.data.scaled);
    if (scaled !== undefined) s.scaled = scaled;
    const note = asString(fm.data.note)?.trim();
    if (note) s.note = note;
    scores.push(s);
  }
  scores.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  extCache = { sig, scores };
  return scores;
}

/** ASCII slug of a source name ("Tutorials Dojo – Set 2" → "tutorials-dojo-set-2"). */
export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '') || 'thi-thu'
  );
}

/**
 * Logs one external score. `score` = percent (0–100); with only `scaled` (100–1000) the percent is scaled / 10 — the
 * app's own rough mapping. `date` YYYY-MM-DD, not in the future.
 */
export function addExternal(input: { date?: unknown; source?: unknown; score?: unknown; scaled?: unknown; note?: unknown }, now = Date.now()): ExternalScore {
  const date = dateValue(input.date);
  if (!date) throw new ProgressError(400, 'Ngày làm bài không hợp lệ (định dạng YYYY-MM-DD).');
  if ((dayOfKey(date) ?? 0) > localDay(now)) throw new ProgressError(400, 'Ngày làm bài không được ở tương lai.');
  const source = String(input.source ?? '').replace(/\s+/g, ' ').trim().slice(0, SOURCE_MAX);
  if (!source) throw new ProgressError(400, 'Cần tên đề / nguồn (vd “AWS Official Practice Exam”).');
  const hasScore = input.score !== undefined && input.score !== null && input.score !== '';
  const scoreNum = Number(input.score);
  if (hasScore && !(Number.isFinite(scoreNum) && scoreNum >= 0 && scoreNum <= 100)) throw new ProgressError(400, 'Điểm % phải từ 0 đến 100.');
  const hasScaled = input.scaled !== undefined && input.scaled !== null && input.scaled !== '';
  const scaled = scaledValue(input.scaled);
  if (hasScaled && scaled === undefined) throw new ProgressError(400, 'Điểm quy đổi phải từ 100 đến 1000.');
  if (!hasScore && scaled === undefined) throw new ProgressError(400, 'Cần điểm % hoặc điểm quy đổi /1000.');
  const score = round1(hasScore ? scoreNum : (scaled ?? 0) / 10);
  const note = String(input.note ?? '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);

  const base = `${date}_${slugify(source)}`;
  let id = base;
  for (let i = 2; fs.existsSync(path.join(EXTERNAL_DIR, `${id}.md`)); i++) id = `${base}-${i}`;
  const abs = path.join(EXTERNAL_DIR, `${id}.md`);
  const data: Record<string, unknown> = { kind: 'external', date, source, score, scaled, note: note || undefined, created: localIso(new Date(now)) };
  for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
  const body = [
    `# 📝 Điểm thi thử bên ngoài — ${source}`,
    '',
    '| | |',
    '|---|---|',
    `| Ngày làm | ${date} |`,
    `| Điểm | **${score}%**${scaled !== undefined ? ` · ${scaled}/1000` : ` (≈ ${scaledScore(score)}/1000 theo quy đổi của app)`} |`,
    ...(note ? [`| Ghi chú | ${note.replace(/\|/g, '/')} |`] : []),
    '',
    '_File do app quản lý (Thống kê → 🎯 Ngày thi & dự báo). Mức sẵn sàng của app vào ngày này được so với điểm này để hiệu chỉnh._',
    '',
  ].join('\n');
  writeAtomic(abs, stringifyFrontMatter(data) + '\n' + body);
  extCache = undefined;
  return loadExternal().find((s) => s.id === id) ?? { id, date, source, score, scaled, note: note || undefined, file: rel(abs) };
}

export function deleteExternal(id: string): void {
  if (!/^[\w.-]+$/.test(id) || id.startsWith('.')) throw new ProgressError(400, 'Mã điểm không hợp lệ.');
  const abs = path.join(EXTERNAL_DIR, `${id}.md`);
  const fm = fs.existsSync(abs) ? splitFrontMatter(fs.readFileSync(abs, 'utf8')) : undefined;
  if (!fm || fm.data.kind !== 'external') throw new ProgressError(404, 'Không tìm thấy điểm này.');
  fs.rmSync(abs);
  extCache = undefined;
}

// ── sealed forms: status, suggested dates, internal calibration points ──────

/** Days before the exam suggested for form `i` of `n`: first ≈ 21, last ≈ 7, evenly spaced (one form: 7). */
export function sealedOffset(i: number, n: number): number {
  if (n <= 1) return SEALED_LAST_OFFSET;
  return Math.round(SEALED_FIRST_OFFSET - (i * (SEALED_FIRST_OFFSET - SEALED_LAST_OFFSET)) / (n - 1));
}

/** The attempt that used a form: the recorded one, else the latest non-rushed sealed attempt of that form. */
function formAttempt(formId: string, attemptId: string | undefined, attempts: Attempt[]): Attempt | undefined {
  const recorded = attemptId ? attempts.find((a) => a.id === attemptId) : undefined;
  if (recorded) return recorded;
  for (let i = attempts.length - 1; i >= 0; i--) if (attempts[i].sealedForm === formId && !attempts[i].rushed) return attempts[i];
  return undefined;
}

/** Sealed forms for GET /api/progress: no question ids; suggested dates need an exam date that has not passed. */
export function sealedProgress(state: SealedState, attempts: Attempt[], goal: ExamGoal, now = Date.now()): SealedFormProgress[] {
  const today = localDay(now);
  const exam = goal.examDate ? dayOfKey(goal.examDate) : undefined;
  return state.forms.map((f, i) => {
    const p: SealedFormProgress = { id: f.id, status: f.status, count: f.ids.length };
    if (f.usedAt) p.usedAt = f.usedAt;
    if (f.attempt) p.attempt = f.attempt;
    if (f.status === 'used') {
      const a = formAttempt(f.id, f.attempt, attempts);
      if (a) {
        p.attempt ??= a.id;
        p.usedAt ??= a.finished;
        p.score = a.score;
        p.scaled = a.scaled;
      }
    }
    if (f.status === 'sealed' && exam !== undefined && exam >= today) {
      const day = Math.max(today, exam - sealedOffset(i, state.forms.length));
      p.suggested = dayKey(day);
      p.due = day <= today;
    }
    return p;
  });
}

/**
 * Used sealed forms as internal calibration points ("Đề niêm phong S1", internal: true): the score on never-practised
 * questions, compared with the app readiness just before that attempt (the attempt itself left out).
 */
export function sealedScores(attempts: Attempt[], bank: BankState, cfg: AppConfig): ExternalScore[] {
  const out: ExternalScore[] = [];
  for (const a of attempts) {
    if (!a.sealedForm || a.rushed) continue;
    const at = Date.parse(a.finished);
    if (!Number.isFinite(at)) continue;
    const s: ExternalScore = {
      id: `sealed-${a.id}`,
      date: localDateKey(a.finished),
      source: `Đề niêm phong ${a.sealedForm}`,
      score: a.score,
      scaled: a.scaled,
      note: `điểm trên câu mới · ${a.correct}/${a.total} câu tính điểm`,
      file: a.file,
      internal: true,
      attempt: a.id,
    };
    const r = readinessAt(attempts, bank, cfg, at, { exclude: a.id });
    if (r.answers >= MIN_CALIBRATION_ANSWERS) s.readinessAtDate = r.readiness;
    out.push(s);
  }
  return out;
}

// ── GET /api/progress ───────────────────────────────────────────────────────

export interface ProgressCtx {
  cfg: AppConfig;
  bank: BankState;
  attempts: Attempt[]; // learning view (regradeAttempts), rushed ones flagged
  states: Map<string, QuestionState>;
}

type Heavy = Omit<ProgressResponse, 'fsrs'>;
const memo = new WeakMap<Attempt[], { key: string; value: Heavy }>();

/** Goal, forecast, workload, external scores + calibration, sealed forms, checklist (memoized per data version and day), FSRS info (fresh). */
export function computeProgress(ctx: ProgressCtx, now = Date.now()): ProgressResponse {
  const { cfg, bank, attempts } = ctx;
  const goal = loadGoal();
  const external = loadExternal();
  const sealed = loadSealed();
  const today = localDay(now);
  const params = resolveFsrsParams(cfg);
  const key = JSON.stringify([
    bank.version,
    today,
    goal,
    external.map((e) => [e.id, e.date, e.score]),
    sealed.forms.map((f) => [f.id, f.status, f.attempt, f.ids.length]),
    params.weights,
    cfg.srs,
    cfg.stats,
  ]);
  let heavy = memo.get(attempts);
  if (!heavy || heavy.key !== key) {
    heavy = { key, value: computeHeavy(ctx, goal, external, sealed, params.weights, now) };
    memo.set(attempts, heavy);
  }
  return { ...heavy.value, fsrs: fsrsInfo(cfg, attempts) };
}

function computeHeavy(ctx: ProgressCtx, goal: ExamGoal, stored: ExternalScore[], sealed: SealedState, weights: readonly number[], now: number): Heavy {
  const { cfg, bank, attempts } = ctx;
  const today = localDay(now);
  // questions held back in sealed forms are not part of the practice bank (coverage, forecast, workload)
  const held = new Set(sealed.forms.filter((f) => f.status === 'sealed').flatMap((f) => f.ids));
  // the forecast needs FSRS memory even when the review queue runs on Leitner boxes
  const fsrsStates = cfg.srs.algorithm === 'leitner' ? computeStates(attempts, { ...cfg, srs: { ...cfg.srs, algorithm: 'fsrs' } }, now, weights) : ctx.states;
  let forecast: ExamForecast | undefined;
  if (goal.examDate) forecast = forecastExam(fsrsStates, bank, attempts, goal.examDate, { weights, desiredRetention: cfg.srs.desired_retention, now, exclude: held });
  // until the exam (today … exam day), at most WORKLOAD_MAX_DAYS; no exam date or a past one → WORKLOAD_DAYS
  const days = forecast && forecast.daysLeft >= 0 ? Math.min(forecast.daysLeft + 1, WORKLOAD_MAX_DAYS) : WORKLOAD_DAYS;
  const workload = workloadDays(ctx.states, held.size ? bank.questions.filter((q) => !held.has(q.id)) : bank.questions, days, now);

  const external = [
    ...stored.map((s) => {
      const day = dayOfKey(s.date);
      if (day === undefined) return s;
      const r = readinessAt(attempts, bank, cfg, dayStartMs(day + 1) - 1);
      return r.answers >= MIN_CALIBRATION_ANSWERS ? { ...s, readinessAtDate: r.readiness } : s;
    }),
    ...sealedScores(attempts, bank, cfg),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const current = readinessAt(attempts, bank, cfg, now);
  let studyStart: string | undefined;
  let first = Infinity;
  for (const a of attempts) {
    const t = Date.parse(a.finished);
    if (!a.rushed && Number.isFinite(t) && t < first) first = t;
  }
  if (first < Infinity) studyStart = localDateKey(new Date(first));
  return {
    today: dayKey(today),
    workload,
    goal: { ...goal, targetScaled: goal.targetScaled ?? bank.taxonomy.exam.pass_scaled },
    forecast,
    external,
    externalCalibration: current.answers ? calibrate(external, current.readiness) : undefined,
    regraded: countRegraded(attempts),
    sealed: sealedProgress(sealed, attempts, goal, now),
    checklist: examChecklist(goal, now),
    checklistChecked: CHECKLIST_CHECKED,
    studyStart,
  };
}
