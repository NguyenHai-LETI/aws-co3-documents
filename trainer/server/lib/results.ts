// Attempts are stored as one Markdown file per finished test under results/YYYY/MM/.
// Front matter = machine-readable record (the app recomputes everything from it);
// body = human/AI-readable report (score, per-question table, wrong answers with explanations).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RESULTS_DIR, rel } from '../config.ts';
import { asString, splitFrontMatter, stringifyFrontMatter } from './frontmatter.ts';
import { listMarkdownFiles, type BankState } from './bank.ts';
import { fmtLocal, localIso, stampParts } from './time.ts';
import { isCorrect, normalizeKeys, pct, scaledScore } from '../../shared/scoring.ts';
import { fmtDuration } from '../../shared/timing.ts';
import { FEEDBACK_INFO, MODE_INFO } from '../../shared/labels.ts';
import type { AnswerRecord, Attempt, AttemptSummary, Question, SubmitRequest, TestMode } from '../../shared/types.ts';

const fileCache = new Map<string, { sig: string; attempt?: Attempt }>();
let listCache: { version: string; attempts: Attempt[] } | undefined;

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function toAttempt(data: Record<string, unknown>, file: string): Attempt | undefined {
  if (data.kind !== 'attempt' || !Array.isArray(data.answers)) return undefined;
  const answers: AnswerRecord[] = (data.answers as Record<string, unknown>[])
    .filter((a) => a && typeof a === 'object' && a.q)
    .map((a) => ({
      q: String(a.q),
      pick: String(a.pick ?? ''),
      key: String(a.key ?? ''),
      ok: a.ok === true,
      t: num(a.t),
      est: num(a.est),
      flag: a.flag === true || undefined,
      unsure: a.unsure === true || undefined,
    }));
  return {
    id: asString(data.id) ?? path.basename(file, '.md'),
    mode: (asString(data.mode) ?? 'custom') as TestMode,
    title: asString(data.title) ?? '',
    feedback: data.feedback === 'practice' ? 'practice' : 'exam',
    started: asString(data.started) ?? '',
    finished: asString(data.finished) ?? '',
    timeLimit: num(data.time_limit),
    timeUsed: num(data.time_used),
    timedOut: data.timed_out === true,
    total: num(data.total, answers.length),
    answered: num(data.answered),
    correct: num(data.correct),
    score: num(data.score),
    scaled: num(data.scaled),
    passed: data.passed === true,
    plan: asString(data.plan),
    selection: data.selection,
    answers,
    file,
  };
}

export function loadAttempts(): Attempt[] {
  const files = listMarkdownFiles(RESULTS_DIR);
  const sigs = files.map((f) => {
    const st = fs.statSync(f);
    return `${st.mtimeMs}:${st.size}`;
  });
  const version = crypto.createHash('sha1').update(files.map((f, i) => f + sigs[i]).join('|')).digest('hex');
  if (listCache?.version === version) return listCache.attempts;
  const attempts: Attempt[] = [];
  files.forEach((abs, i) => {
    let e = fileCache.get(abs);
    if (!e || e.sig !== sigs[i]) {
      const fm = splitFrontMatter(fs.readFileSync(abs, 'utf8'));
      e = { sig: sigs[i], attempt: fm.error ? undefined : toAttempt(fm.data, rel(abs)) };
      fileCache.set(abs, e);
    }
    if (e.attempt) attempts.push(e.attempt);
  });
  attempts.sort((a, b) => a.finished.localeCompare(b.finished));
  listCache = { version, attempts };
  return attempts;
}

export function attemptsVersion(): string {
  loadAttempts();
  return listCache?.version.slice(0, 12) ?? '';
}

export function summarize(a: Attempt, bank: BankState): AttemptSummary {
  const domains: AttemptSummary['domains'] = {};
  const topics: AttemptSummary['topics'] = {};
  for (const r of a.answers) {
    const q = bank.byId.get(r.q);
    if (!q) continue;
    (domains[q.domain] ??= { total: 0, correct: 0 }).total++;
    (topics[q.topic] ??= { total: 0, correct: 0 }).total++;
    if (r.ok) {
      domains[q.domain].correct++;
      topics[q.topic].correct++;
    }
  }
  const { answers: _a, selection: _s, ...rest } = a;
  return { ...rest, domains, topics };
}

// ── writing ─────────────────────────────────────────────────────────────────

export function gradeAndSave(req: SubmitRequest, bank: BankState): Attempt {
  const { session } = req;
  const byQ = new Map(req.answers.map((a) => [a.q, a]));
  const records: AnswerRecord[] = [];
  const questions: Question[] = [];
  for (const ref of session.questions) {
    const q = bank.byId.get(ref.id);
    if (!q) continue;
    const a = byQ.get(ref.id);
    const pick = normalizeKeys(a?.pick ?? []);
    records.push({
      q: q.id,
      pick,
      key: normalizeKeys(q.answer),
      ok: isCorrect(a?.pick ?? [], q.answer),
      t: Math.max(0, Math.round(a?.t ?? 0)),
      est: q.time,
      ...(a?.flag ? { flag: true } : {}),
      ...(a?.unsure ? { unsure: true } : {}),
    });
    questions.push(q);
  }
  const total = records.length;
  const correct = records.filter((r) => r.ok).length;
  const answered = records.filter((r) => r.pick).length;
  const score = pct(correct, total);
  const finished = new Date(req.finishedAt || Date.now());
  const started = new Date(req.startedAt || finished);
  const parts = stampParts(finished);
  const mode = session.mode;
  let id = `${parts.compact}-${parts.time}-${mode}`;
  const dir = path.join(RESULTS_DIR, parts.year, parts.month);
  fs.mkdirSync(dir, { recursive: true });
  let file = path.join(dir, `${parts.date}_${parts.time}_${mode}.md`);
  for (let i = 2; fs.existsSync(file); i++) {
    id = `${parts.compact}-${parts.time}-${mode}-${i}`;
    file = path.join(dir, `${parts.date}_${parts.time}_${mode}-${i}.md`);
  }
  const passPct = bank.taxonomy.exam.pass_pct;
  const { ids: _ids, ...selection } = session.selection;
  const attempt: Attempt = {
    id,
    mode,
    title: session.title,
    feedback: session.feedback,
    started: localIso(started),
    finished: localIso(finished),
    timeLimit: session.timeLimit,
    timeUsed: Math.round(req.timeUsed),
    timedOut: req.timedOut,
    total,
    answered,
    correct,
    score,
    scaled: scaledScore(score),
    passed: score >= passPct,
    plan: session.plan,
    selection,
    answers: records,
    file: rel(file),
  };

  const data: Record<string, unknown> = {
    id,
    kind: 'attempt',
    mode,
    title: attempt.title,
    feedback: attempt.feedback,
    started: attempt.started,
    finished: attempt.finished,
    time_limit: attempt.timeLimit,
    time_used: attempt.timeUsed,
    timed_out: attempt.timedOut,
    estimate_total: session.estimateTotal,
    timing: session.timingPreset,
    total,
    answered,
    correct,
    score,
    scaled: attempt.scaled,
    passed: attempt.passed,
    ...(attempt.plan ? { plan: attempt.plan } : {}),
    selection,
    answers: records,
  };
  const text = stringifyFrontMatter(data, ['answers']) + '\n' + renderBody(attempt, questions, bank, session.estimateTotal);
  fs.writeFileSync(file, text);
  return attempt;
}

function letterText(q: Question, keys: string): string {
  if (!keys) return '_(bỏ trống)_';
  return [...keys].map((k) => `**${k}.** ${q.options.find((o) => o.key === k)?.text ?? '?'}`).join('<br>');
}

function oneLine(s: string, max = 140): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

function renderBody(a: Attempt, questions: Question[], bank: BankState, estimateTotal: number): string {
  const tax = bank.taxonomy;
  const mode = MODE_INFO[a.mode] ?? MODE_INFO.custom;
  const verdict = a.passed ? '✅ ĐẠT' : '❌ CHƯA ĐẠT';
  const out: string[] = [];
  out.push(`# ${verdict} · ${a.correct}/${a.total} câu (${a.score}%) — ${a.title}`, '');
  out.push('| | |', '|---|---|');
  out.push(`| Chế độ | ${mode.icon} ${mode.label} · ${FEEDBACK_INFO[a.feedback].label} |`);
  out.push(`| Bắt đầu → Nộp | ${fmtLocal(a.started)} → ${fmtLocal(a.finished)}${a.timedOut ? ' · ⏰ hết giờ, tự nộp' : ''} |`);
  out.push(`| Thời gian | ${fmtDuration(a.timeUsed)}${a.timeLimit ? ` / giới hạn ${fmtDuration(a.timeLimit)}` : ' (không giới hạn)'} · chuẩn ước lượng ${fmtDuration(estimateTotal)} |`);
  out.push(`| Điểm quy đổi | **${a.scaled}** / 1000 (đỗ ≥ ${tax.exam.pass_scaled}) · đã trả lời ${a.answered}/${a.total} |`);
  if (a.plan) out.push(`| Kế hoạch AI | \`${a.plan}\` |`);
  out.push('');

  const group = (key: (q: Question) => string, label: (k: string) => string, title: string) => {
    const m = new Map<string, { t: number; c: number }>();
    a.answers.forEach((r, i) => {
      const k = key(questions[i]);
      const g = m.get(k) ?? { t: 0, c: 0 };
      g.t++;
      if (r.ok) g.c++;
      m.set(k, g);
    });
    out.push(`## ${title}`, '', '| | Đúng | Tỉ lệ |', '|---|---|---|');
    for (const [k, g] of [...m].sort((x, y) => x[1].c / x[1].t - y[1].c / y[1].t)) out.push(`| ${label(k)} | ${g.c}/${g.t} | ${pct(g.c, g.t)}% |`);
    out.push('');
  };
  group((q) => q.domain, (k) => {
    const d = tax.domains.find((x) => x.id === k);
    return d ? `${d.code} ${d.label}` : k;
  }, 'Theo domain');
  group((q) => q.topic, (k) => {
    const t = tax.topics.find((x) => x.id === k);
    return t ? `${t.icon} ${t.label}` : k;
  }, 'Theo chủ đề');

  out.push('## Chi tiết từng câu', '', '| # | Câu | Chủ đề | Chọn | Đáp án | KQ | Thời gian (làm/chuẩn) | Ghi chú |', '|---|---|---|---|---|---|---|---|');
  a.answers.forEach((r, i) => {
    const q = questions[i];
    const notes = [r.flag ? '🚩' : '', r.unsure ? '🤔 chưa chắc' : '', r.t > r.est * 1.5 ? '🐢 chậm' : ''].filter(Boolean).join(' ');
    out.push(`| ${i + 1} | \`${r.q}\` | ${q.topic} | ${r.pick || '—'} | ${r.key} | ${r.ok ? '✅' : '❌'} | ${r.t}s / ${r.est}s | ${notes} |`);
  });
  out.push('');

  const wrong = a.answers.map((r, i) => ({ r, q: questions[i], n: i + 1 })).filter((x) => !x.r.ok);
  if (wrong.length) {
    out.push(`## ❌ Câu sai (${wrong.length}) — xem lại`, '');
    for (const { r, q, n } of wrong) {
      out.push(`### ${n}. \`${q.id}\` · ${q.topic}${q.services.length ? ' · ' + q.services.slice(0, 3).join(', ') : ''}`, '');
      out.push(`> ${oneLine(q.stem, 400)}`, '');
      out.push(`- Bạn chọn: ${letterText(q, r.pick)}`);
      out.push(`- Đáp án đúng: ${letterText(q, r.key)}`);
      if (q.explanation) out.push(`- Giải thích: ${oneLine(q.explanation, 600)}`);
      out.push('');
    }
  }
  const unsure = a.answers.map((r, i) => ({ r, q: questions[i] })).filter((x) => x.r.ok && (x.r.unsure || x.r.flag));
  if (unsure.length) {
    out.push(`## 🤔 Đúng nhưng chưa chắc (${unsure.length})`, '');
    for (const { q } of unsure) out.push(`- \`${q.id}\` — ${oneLine(q.stem, 120)}`);
    out.push('');
  }
  return out.join('\n');
}
