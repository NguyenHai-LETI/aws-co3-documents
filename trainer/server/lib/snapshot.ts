// coach/snapshot.md — a compact, pre-computed digest of the learner's history for the AI coach.
// The coach reads this first instead of parsing every result file (cheaper and less error-prone).
// Written off the request path: routes call scheduleSnapshot() (debounced), GET /api/snapshot and the coach runner
// build it right away when it is stale. Every number goes through regradeAttempts() (answer-key fixes, [L]).
// [γ] Questions of a sealed form never appear here (no id, no stem): §16 only says how many are held back.
import fs from 'node:fs';
import path from 'node:path';
import { BANK_DIR, CONFIG_FILE, ISSUES_FILE, QA_DIR, RATINGS_FILE, SNAPSHOT_FILE, loadConfig, type AppConfig } from '../config.ts';
import { FSRS_PARAMS_FILE, context, contextStats } from '../context.ts';
import { loadBank, type BankState } from './bank.ts';
import { loadIssues } from './issues.ts';
import { loadPlans, plansVersion } from './plans.ts';
import { attemptsVersion, loadAttempts } from './results.ts';
import { fileSig } from './index-db.ts';
import { regradeAttempts } from './regrade.ts';
import { computeStates, computeStats, struckCorrect } from './stats.ts';
import { qualitySnapshotLines } from './quality.ts';
import { qaSnapshotLines } from './ask.ts';
import { confusionPairs } from './insights.ts';
import { loadSealed, sealedIds } from './sealed.ts';
import { fmtLocal, localDateKey, localIso } from './time.ts';
import { stringifyFrontMatter } from './frontmatter.ts';
import { fmtDuration } from '../../shared/timing.ts';
import { pct } from '../../shared/scoring.ts';
import { MODE_INFO } from '../../shared/labels.ts';
import type { AnswerRecord, Attempt, Bucket, ConfusionPair, Plan, Question, QuestionState, StatsResponse } from '../../shared/types.ts';

function oneLine(s: string, max = 200): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

const cell = (s: string) => s.replace(/\|/g, '/');
const pct0 = (x: number) => `${Math.round(x * 100)}%`;

/** New (non-rushed) attempts since the given plan was written — rushed click-throughs are noise, not new data. */
export function newDataSince(plan: Plan | undefined, attempts: Attempt[]): { attempts: number; answers: number } {
  const since = plan ? new Date(plan.created).getTime() : 0;
  const fresh = attempts.filter((a) => !a.rushed && new Date(a.finished).getTime() > since);
  return { attempts: fresh.length, answers: fresh.reduce((s, a) => s + a.answers.length, 0) };
}

/** Lines from another module's snapshot section; a failure there must not break the snapshot. */
function safeLines(fn: () => string[], label: string): string[] {
  try {
    return fn();
  } catch (e) {
    return [`_(${label}: lỗi khi tính — ${(e as Error).message})_`, ''];
  }
}

/**
 * Re-graded attempts, states and stats for this bank + config: the request-path context when they match (no second
 * FSRS replay / stats pass), computed here otherwise (scripts with another config).
 */
function derived(bank: BankState, cfg: AppConfig): { all: Attempt[]; states: Map<string, QuestionState>; stats: StatsResponse } {
  const ctx = context();
  if (ctx.bank === bank && (ctx.cfg === cfg || JSON.stringify(ctx.cfg) === JSON.stringify(cfg))) {
    return { all: ctx.attempts, states: ctx.states, stats: contextStats(ctx) };
  }
  const all = regradeAttempts(loadAttempts(cfg), bank, cfg);
  const states = computeStates(all, cfg);
  return { all, states, stats: computeStats(all, bank, states, cfg) };
}

/** §9 table: confirmed confusion pairs (insights.ts, normalised by co-occurrence) with their evidence. */
function confusionLines(pairs: ConfusionPair[]): string[] {
  const o = ['## 9. Cặp hay nhầm (đã xác nhận — chuẩn hoá theo số lần cùng xuất hiện)', ''];
  if (!pairs.length) {
    o.push('_Chưa có cặp nào đủ bằng chứng (cần ≥ 4 lần chọn nhầm trên ≥ 3 câu khác nhau, và cao hơn hẳn mức nhầm nền của chính người học)._', '');
    return o;
  }
  o.push(
    '> X ⟶ Y = chọn phương án có X khi đáp án có Y. Tỉ lệ = số lần chọn nhầm / số lần gặp cặp đó; cận dưới 80 % vẫn > 2 × mức nền. “Câu luyện cặp” = câu có cả X lẫn Y (dùng cho phiên contrast).',
    '',
    '| Chọn ⟶ Đúng | Chọn nhầm / lần gặp | Tỉ lệ (cận dưới) | × mức nền | Số câu | Câu luyện cặp |',
    '|---|---|---|---|---|---|',
  );
  for (const p of pairs.slice(0, 15)) {
    const lift = p.base > 0 ? `×${(p.rate / p.base).toFixed(1)}` : '—';
    const merged = p.merged?.length ? ` (gộp: ${p.merged.join('; ')})` : '';
    o.push(
      `| ${cell(`${p.picked} ⟶ ${p.correct}`)}${cell(merged)} | ${p.picks}/${p.exposures} | ${pct0(p.rate)} (≥ ${pct0(p.low)}) | ${lift} (nền ${pct0(p.base)}) | ${p.questions} | ${p.ids.slice(0, 8).map((x) => `\`${x}\``).join(' ')}${p.ids.length > 8 ? ' …' : ''} |`,
    );
  }
  o.push('');
  return o;
}

export function buildSnapshot(bank: BankState, cfg: AppConfig): { text: string; meta: Record<string, unknown> } {
  const tax = bank.taxonomy;
  const { all, states, stats } = derived(bank, cfg);
  const attempts = all.filter((a) => !a.rushed);
  const sealed = sealedIds(); // never named here: the coach must not see, vary or plan these questions
  const open = (id: string) => !sealed.has(id);
  const rushed = all.filter((a) => a.rushed);
  const plans = loadPlans(attempts); // a rushed click-through does not complete a plan session for the coach
  const latest = plans[0];
  const fresh = newDataSince(latest, all);
  const issues = loadIssues();
  const openIssues = issues.filter((i) => i.open);
  const T = stats.totals;
  const fsrs = cfg.srs.algorithm !== 'leitner';
  const o: string[] = [];

  // answer history per question (chronological, non-rushed)
  const history = new Map<string, { r: AnswerRecord; a: Attempt }[]>();
  for (const a of attempts) {
    for (const r of a.answers) {
      const h = history.get(r.q);
      if (h) h.push({ r, a });
      else history.set(r.q, [{ r, a }]);
    }
  }

  const meta = {
    kind: 'snapshot',
    generated: localIso(),
    attempts: T.attempts,
    answers: T.answers,
    accuracy: T.accuracy,
    rushed_attempts: rushed.length,
    readiness: T.readiness,
    readiness_interval: [T.readinessLow, T.readinessHigh],
    pass_probability: T.passProbability,
    due_today: T.dueToday,
    backlog: T.backlog,
    latest_plan: latest?.id ?? null,
    new_since_latest_plan: fresh,
    open_issues: openIssues.length,
    bank_version: bank.version,
  };

  o.push('# 📸 Learner snapshot — dữ liệu cho AI Coach', '');
  o.push(
    '> File tự sinh bởi trainer app (`npm run snapshot`) — **không sửa tay**. Mọi số liệu tính từ `trainer/results/**/*.md` (bài “làm vội” đã bị loại).',
    '> Thứ tự ưu tiên khi phân tích: §7 câu sai (kèm ghi chú “vì sao chọn” của người học) → §9 cặp hay nhầm → §2b/§2c/§3–5 điểm yếu → §8 chưa chắc/chậm → §10 tiến độ kế hoạch.',
    '> Câu đang niêm phong (§16) không bao giờ xuất hiện trong file này — không dùng chúng làm câu gốc, không đưa vào kế hoạch.',
    '',
  );

  o.push('## 1. Tổng quan', '');
  o.push(`- Bài test: **${T.attempts}** · câu đã trả lời: **${T.answers}** · đúng **${T.correct}** (${T.accuracy}%) · thời gian học ${fmtDuration(T.studySeconds, { long: true })} · streak ${T.streakDays} ngày`);
  o.push(
    `- Readiness v2 (trọng số domain; kết quả gần đây nặng hơn — bán rã ${cfg.stats.recency_half_life_days} ngày; câu dài ×1.5; khó ×1.2 / dễ ×0.8): **${T.readiness}%** ≈ ${T.readinessScaled}/1000 · khoảng tin cậy 90%: ${T.readinessLow}–${T.readinessHigh}% · xác suất đỗ ≈ **${Math.round(T.passProbability * 100)}%** (đỗ ≥ ${tax.exam.pass_scaled} ≈ ${tax.exam.pass_pct}%) · độ tin cậy: ${T.readinessConfidence}`,
  );
  const masteredRule = fsrs ? `FSRS: độ bền trí nhớ ≥ ${cfg.srs.mastered_stability_days} ngày` : `Leitner box ≥ ${cfg.srs.mastered_box}`;
  o.push(
    `- Ngân hàng: ${T.bankActive} câu active · đã gặp ${T.distinctSeen} (${pct(T.distinctSeen, T.bankActive)}%) · đã thuộc (${masteredRule}) ${T.mastered} · đến hạn ôn ${T.due} (hôm nay ${T.dueToday} theo giới hạn ${cfg.srs.daily_limit} câu/ngày, tồn ${T.backlog}) · lần cuối sai ${T.wrongOpen} · cờ/chưa chắc ${T.flagged}`,
  );
  o.push(`- Mức nhớ (${fsrs ? 'FSRS, theo độ bền' : 'Leitner box'}): ${stats.boxLabels.map((l, i) => `${l}: ${stats.boxes[i] ?? 0}`).join(' · ')}`);
  const L = stats.lengthSplit;
  o.push(
    `- Câu dài (đề ≥ ${tax.timing.long_form_min_words ?? 55} từ, giống đề thật): ${T.longFormShare}% lượt trả lời · đúng ${pct(L.long.correct, L.long.answers)}% câu dài (${L.long.answers} lượt) vs ${pct(L.short.correct, L.short.answers)}% câu ngắn (${L.short.answers} lượt)`,
  );
  const C = stats.calibration;
  const sureAcc = pct(C.sure.correct, C.sure.answers);
  const overconfident = C.sure.answers >= 20 && sureAcc < tax.exam.pass_pct;
  o.push(
    `- Độ tự tin: chắc chắn ${sureAcc}% đúng (${C.sure.answers} lượt) · “chưa chắc” ${pct(C.unsure.correct, C.unsure.answers)}% (${C.unsure.answers}) · có mở gợi ý ${pct(C.hinted.correct, C.hinted.answers)}% (${C.hinted.answers})${overconfident ? ' · ⚠️ tự tin quá mức: câu “chắc chắn” vẫn sai nhiều' : ''}`,
  );
  const E = stats.elimination;
  o.push(`- Gạch bỏ đáp án: ${E.answersWithElim} lượt có gạch · **${E.correctEliminated} lượt gạch nhầm đáp án đúng**${E.questions.length ? ` (${E.questions.slice(0, 10).map((x) => `\`${x}\``).join(' ')})` : ''}`);
  const R = stats.recall;
  if (R.answers) o.push(`- Recall-first (viết đáp án trước khi xem lựa chọn): ${R.answers} lượt · khớp ${R.hits} · đúng khi khớp ${R.hitAccuracy}% / khi không khớp ${R.missAccuracy}%`);
  o.push(`- Dữ liệu mới kể từ kế hoạch gần nhất (${latest?.id ?? 'chưa có'}): ${fresh.attempts} bài / ${fresh.answers} câu`);
  if (rushed.length) {
    o.push(`- ⚡ Bài làm vội (trung vị < ${cfg.stats.rushed_median_seconds}s/câu) — **đã loại khỏi mọi số liệu & phân tích**: ${rushed.length} bài`);
    for (const a of [...rushed].reverse().slice(0, 10)) o.push(`  - ${fmtLocal(a.finished)} · ${a.title} · ${a.answers.length} câu · trung vị ${a.medianTime ?? 0}s · \`${a.file}\``);
  }
  o.push('');

  const table = (rows: Bucket[], head: string, minAttempts = 1) => {
    o.push(`| ${head} | Lượt | Đúng | Tỉ lệ | Đã gặp/Ngân hàng | TG TB / chuẩn |`, '|---|---|---|---|---|---|');
    for (const b of rows.filter((x) => x.attempts >= minAttempts)) {
      o.push(`| ${cell(b.label)} | ${b.attempts} | ${b.correct} | ${b.accuracy}% | ${b.questions}/${b.bank} | ${b.avgTime}s / ${b.avgEst}s |`);
    }
    o.push('');
  };

  o.push('## 2. Theo domain (trọng số đề thi)', '');
  table(stats.byDomain.map((b) => ({ ...b, label: `${b.label} (${tax.domains.find((d) => d.id === b.key)?.weight ?? '?'}%)` })), 'Domain', 0);
  o.push('## 2b. Theo task statement (exam guide 1.1–4.4)', '');
  const taskCovered = stats.byTask.reduce((s, b) => s + b.bank, 0);
  if (!taskCovered) o.push('_Chưa có câu nào được gán `task`._', '');
  else {
    table(stats.byTask, 'Task', 0);
    const thin = stats.byTask.filter((b) => b.bank < 10).map((b) => b.key);
    if (thin.length) o.push(`- Task có < 10 câu trong ngân hàng: ${thin.join(', ')}`, '');
  }
  // what the stem asks to optimise (Question.requirements: taxonomy.keywords groups + NOT/EXCEPT questions)
  o.push('## 2c. Theo tiêu chí đề (từ khoá yêu cầu trong đề: chi phí, vận hành, sẵn sàng cao, hiệu năng, bảo mật, phủ định)', '');
  const req = stats.byRequirement ?? [];
  if (!req.some((b) => b.bank > 0)) o.push('_Chưa có số liệu theo tiêu chí đề._', '');
  else {
    table(req, 'Tiêu chí', 0);
    o.push('- Tiêu chí tỉ lệ thấp → biến thể giữ khái niệm nhưng đổi tiêu chí (vd cùng kiến trúc, hỏi *LEAST operational overhead* thay vì *MOST cost-effective*).', '');
  }
  o.push('## 3. Theo chủ đề (yếu → mạnh, có ≥ 1 lượt)', '');
  table([...stats.byTopic].filter((b) => b.attempts).sort((a, b) => a.accuracy - b.accuracy), 'Topic');
  o.push('## 4. Service yếu nhất (≥ 3 lượt)', '');
  table([...stats.byService].filter((b) => b.attempts >= 3).sort((a, b) => a.accuracy - b.accuracy).slice(0, 20), 'Service', 3);
  o.push('## 5. Khái niệm/tag yếu nhất (≥ 3 lượt)', '');
  table([...stats.byTag].filter((b) => b.attempts >= 3).sort((a, b) => a.accuracy - b.accuracy).slice(0, 20), 'Tag', 3);

  o.push('## 6. Bài làm gần đây', '', '| Kết thúc | Chế độ | Tiêu đề | Điểm | Thời gian | Kế hoạch |', '|---|---|---|---|---|---|');
  for (const a of [...attempts].reverse().slice(0, 12)) {
    const pilot = a.pearson ? ` · thử nghiệm ${a.pilotCorrect ?? 0}/${a.pilotTotal ?? 0}` : '';
    o.push(
      `| ${fmtLocal(a.finished)} | ${MODE_INFO[a.mode]?.label ?? a.mode}${a.pearson ? ' 🧪 Pearson' : ''} | ${cell(a.title)} | ${a.correct}/${a.total} (${a.score}%)${pilot} | ${fmtDuration(a.timeUsed)}${a.timedOut ? ' ⏰' : ''} | ${a.plan ?? ''} |`,
    );
  }
  o.push('');

  // ── wrong answers (latest first), with option texts so the coach can spot misconceptions
  const variantsOf = new Map<string, string[]>();
  for (const q of bank.questions) {
    for (const v of q.variantOf) {
      const l = variantsOf.get(v);
      if (l) l.push(q.id);
      else variantsOf.set(v, [q.id]);
    }
  }
  const wrongQs = [...states.values()]
    .filter((s) => s.lastOk === false && bank.byId.has(s.id) && open(s.id))
    .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
    .slice(0, 40);
  o.push(`## 7. Câu đang sai (lần làm gần nhất sai) — ${wrongQs.length} câu mới nhất`, '');
  if (!wrongQs.length) o.push('_Không có._', '');
  for (const s of wrongQs) {
    const q = bank.byId.get(s.id)!;
    const h = history.get(q.id) ?? [];
    const picks = Object.entries(s.wrongPicks).map(([k, n]) => `${k}×${n}`).join(', ');
    o.push(`### \`${q.id}\` · ${q.topic} · ${q.domain}${q.task ? ` · task ${q.task}` : ''} · ${q.difficulty}${q.longForm ? ' · câu dài' : ''}`);
    o.push(`- services: ${q.services.join(', ') || '—'} · tags: ${q.tags.join(', ') || '—'}${q.concept ? ` · concept: ${q.concept}` : ''}`);
    o.push(`- lịch sử: sai ${s.attempts - s.correct}/${s.attempts} lượt · lần cuối ${s.lastAt ? fmtLocal(s.lastAt) : '?'} · đã chọn sai: ${picks || '—'} · TG TB ${s.avgTime}s/chuẩn ${q.time}s`);
    const variants = variantsOf.get(q.id) ?? [];
    o.push(`- biến thể đã có: ${variants.length ? variants.join(', ') : 'chưa có'} · file: \`${q.file}\``);
    const whys = h.filter((x) => x.r.why).reverse().slice(0, 3);
    for (const { r, a } of whys) o.push(`- 🗣️ người học giải thích vì sao chọn ${r.pick || '(bỏ trống)'} (${localDateKey(a.finished)}): “${oneLine(r.why ?? '', 300)}”`);
    const struck = h.filter((x) => struckCorrect(x.r)).length;
    if (struck) o.push(`- ✂️ đã gạch bỏ chính đáp án đúng ${struck} lần (loại trừ sai — hiểu nhầm về đáp án đúng)`);
    const lastRecall = [...h].reverse().find((x) => x.r.recall);
    if (lastRecall) o.push(`- 🧠 recall gần nhất (trước khi xem lựa chọn): “${oneLine(lastRecall.r.recall ?? '', 200)}” → ${lastRecall.r.recallHit ? 'khớp đáp án đúng' : 'không khớp'}`);
    const hinted = h.filter((x) => x.r.hinted).length;
    if (hinted) o.push(`- 💡 đã mở gợi ý ${hinted} lần`);
    o.push('');
    o.push(`**Q:** ${oneLine(q.stem, 600)}`, '');
    for (const opt of q.options) {
      const marks = [q.answer.includes(opt.key) ? '✅ đúng' : '', s.lastPick?.includes(opt.key) && !q.answer.includes(opt.key) ? '❌ bạn chọn' : ''].filter(Boolean).join(' · ');
      o.push(`- ${opt.key}. ${opt.text}${marks ? `  ← ${marks}` : ''}`);
    }
    o.push('', `**Giải thích hiện tại:** ${oneLine(q.explanation || '(trống)', 500)}`, '');
  }

  // why-notes on questions that are no longer wrong — still evidence of a misconception
  const wrongSet = new Set(wrongQs.map((s) => s.id));
  const otherWhys = [...history.entries()]
    .flatMap(([qid, h]) => h.filter((x) => x.r.why && !wrongSet.has(qid) && open(qid)).map((x) => ({ qid, ...x })))
    .sort((x, y) => y.a.finished.localeCompare(x.a.finished))
    .slice(0, 20);
  if (otherWhys.length) {
    o.push(`## 7b. Ghi chú “vì sao chọn” ở câu đã làm đúng lại (${otherWhys.length})`, '');
    for (const { qid, r, a } of otherWhys) {
      const q = bank.byId.get(qid);
      o.push(`- \`${qid}\` (${localDateKey(a.finished)}, chọn ${r.pick || '—'}, đúng ${r.key}${q ? ` · ${q.topic}` : ''}): “${oneLine(r.why ?? '', 300)}”`);
    }
    o.push('');
  }

  const shaky = [...states.values()]
    .filter((s) => bank.byId.has(s.id) && open(s.id) && s.lastOk && (s.lastUnsure || s.lastFlag || s.slowCount > 0 || s.lastGrade === 2))
    .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
    .slice(0, 30);
  o.push(`## 8. Đúng nhưng chưa chắc / cắm cờ / dùng gợi ý / làm chậm (${shaky.length})`, '');
  if (!shaky.length) o.push('_Không có._');
  for (const s of shaky) {
    const q = bank.byId.get(s.id)!;
    const last = history.get(s.id)?.at(-1)?.r;
    const why = [
      s.lastUnsure ? 'chưa chắc' : '',
      s.lastFlag ? 'cắm cờ' : '',
      last?.hinted ? 'dùng gợi ý' : '',
      last && struckCorrect(last) ? 'gạch nhầm đáp án đúng' : '',
      s.slowCount ? `chậm (${s.avgTime}s/chuẩn ${q.time}s)` : '',
    ].filter(Boolean).join(', ');
    o.push(`- \`${q.id}\` · ${q.topic} · ${why || 'đúng nhưng chậm/không chắc'} — ${oneLine(q.stem, 140)}`);
  }
  o.push('');

  // ── confusion pairs (B3): only pairs confirmed against the learner's own base rate, drill sets without sealed questions
  o.push(...safeLines(() => confusionLines(confusionPairs(attempts, bank, { sealed })), 'cặp hay nhầm'));

  o.push('## 10. Kế hoạch gần nhất & mức hoàn thành', '');
  if (!latest) o.push('_Chưa có kế hoạch nào (lần chạy đầu tiên)._');
  else {
    o.push(`- \`${latest.id}\` (${fmtLocal(latest.created)}, \`${latest.file}\`)${latest.summary ? ` — ${latest.summary}` : ''}`);
    for (const s of latest.sessions) {
      const done = s.done?.length ? `✅ đã làm ${s.done.length} lần, điểm gần nhất ${s.done[s.done.length - 1].score}%` : '⬜ chưa làm';
      o.push(`  - ${s.id} · ${s.title} — ${done}`);
    }
  }
  o.push('');

  const shownIssues = openIssues.filter((i) => open(i.qid));
  o.push(`## 11. Issues đang mở (${shownIssues.length}) — \`trainer/bank/issues.md\``, '');
  if (!shownIssues.length) o.push('_Không có._');
  for (const i of shownIssues) {
    const q = bank.byId.get(i.qid);
    o.push(`- dòng ${i.line}: \`${i.qid}\` · ${i.type} · ${i.note}${q ? ` · file: \`${q.file}\`` : ' · ⚠️ id không tồn tại'}`);
  }
  if (shownIssues.length < openIssues.length) o.push(`- (${openIssues.length - shownIssues.length} issue thuộc câu đang niêm phong — để lại tới khi đề được làm hoặc mở sớm)`);
  o.push('');

  const isAi = (q: Question | undefined) => q?.origin === 'ai' || q?.origin === 'doc';
  const aiQs = bank.questions.filter((q) => isAi(q));
  const aiAnswers = attempts.flatMap((a) => a.answers).filter((r) => isAi(bank.byId.get(r.q)));
  o.push('## 12. Câu hỏi do AI/tài liệu sinh ra', '');
  o.push(
    `- Tổng: ${aiQs.length} câu (${bank.packs.filter((p) => p.origin === 'ai').length} pack AI, ${bank.packs.filter((p) => p.origin === 'doc').length} pack tài liệu) · đã làm ${aiAnswers.length} lượt · đúng ${pct(aiAnswers.filter((r) => r.ok).length, aiAnswers.length)}%`,
  );
  const unseenAi = aiQs.filter((q) => q.status === 'active' && !states.has(q.id)).length;
  o.push(`- Câu AI chưa được làm: ${unseenAi} (đừng sinh thêm quá nhiều nếu con số này còn lớn)`);
  const activeQs = bank.questions.filter((q) => q.status === 'active');
  const longForm = activeQs.filter((q) => q.longForm).length;
  o.push(`- Câu dài chuẩn đề thật trong ngân hàng: ${longForm}/${activeQs.length} (${pct(longForm, activeQs.length)}%)`);
  o.push(`- Câu đến hạn ôn SRS: ${T.due} (hôm nay ${T.dueToday}, tồn ${T.backlog})`, '');

  o.push('## 13. Bank health', '');
  const errors = bank.problems.filter((p) => p.level === 'error');
  o.push(`- ${bank.questions.length} câu trong ${bank.packs.length} pack · ${errors.length} lỗi · ${bank.problems.length - errors.length} cảnh báo`);
  for (const p of errors.slice(0, 15)) o.push(`  - ❗ ${p.file}:${p.line} ${p.qid ? `\`${p.qid}\` ` : ''}${p.message}`);
  o.push('');

  o.push(...safeLines(() => qualitySnapshotLines(bank, attempts), 'chất lượng ngân hàng'));
  o.push(...safeLines(() => qaSnapshotLines(bank), 'câu hỏi AI'));
  o.push(...safeLines(() => sealedLines(all), 'đề niêm phong'));

  return { text: stringifyFrontMatter(meta) + '\n' + o.join('\n'), meta };
}

/** §16: the sealed forms (status, size, the internal "điểm trên câu mới" of a used form) — never a question id. */
function sealedLines(all: Attempt[]): string[] {
  const s = loadSealed();
  const o = ['## 16. Đề niêm phong (đo điểm trên câu chưa từng gặp)', ''];
  if (!s.forms.length) {
    o.push('_Chưa có đề niêm phong._', '');
    return o;
  }
  for (const f of s.forms) {
    const used = f.status === 'used' ? all.find((a) => a.id === f.attempt) ?? all.find((a) => a.sealedForm === f.id) : undefined;
    const what =
      f.status === 'sealed'
        ? '🔒 đang niêm phong'
        : f.status === 'used'
          ? `✅ đã làm ${f.usedAt ? fmtLocal(f.usedAt) : ''}${used ? ` · điểm trên câu mới **${used.score}%** ≈ ${used.scaled}/1000 (${used.correct}/${used.total})` : ''}`
          : `🔓 đã mở sớm ${f.releasedAt ? fmtLocal(f.releasedAt) : ''} (không có điểm)`;
    o.push(`- ${f.id}: ${what} · ${f.ids.length} câu`);
  }
  const held = s.forms.filter((f) => f.status === 'sealed').reduce((n, f) => n + f.ids.length, 0);
  if (held) {
    o.push(
      `- ${held} câu đang được giữ riêng: **không** dùng làm câu gốc cho biến thể / contrast / câu dài, **không** đưa vào kế hoạch, không sửa đề hay đáp án.`,
      '  Danh sách id chỉ có trong `trainer/results/sealed.md` — chỉ đọc file đó để kiểm tra một id trước khi chọn câu gốc ngoài snapshot.',
    );
  }
  o.push('- Điểm đề niêm phong là điểm hiệu chỉnh nội bộ (giống điểm thi thử bên ngoài) — so với mức sẵn sàng §1 để biết độ “học vẹt”.', '');
  return o;
}

// ── writing: debounced, off the request path ─────────────────────────────────

const SNAPSHOT_DEBOUNCE_MS = 3000;
let timer: NodeJS.Timeout | undefined;
let writtenFor = ''; // inputs key of the last snapshot this process wrote

const sig = (file: string) => fileSig(file) || '-';

/** Everything the snapshot is computed from (data versions, FSRS parameters, issue / rating / Q&A / verify files, config, date). */
function inputsKey(): string {
  let qa = '';
  try {
    qa = fs.readdirSync(QA_DIR).sort().map((f) => `${f}:${sig(path.join(QA_DIR, f))}`).join(',');
  } catch {
    // no Q&A yet
  }
  return [loadBank().version, attemptsVersion(), plansVersion(), sig(FSRS_PARAMS_FILE), sig(ISSUES_FILE), sig(RATINGS_FILE), sig(path.join(BANK_DIR, 'verify.md')), sig(CONFIG_FILE), qa, localDateKey(new Date())].join('|');
}

export function writeSnapshot(bank: BankState, cfg: AppConfig): Record<string, unknown> {
  const key = inputsKey();
  const { text, meta } = buildSnapshot(bank, cfg);
  const tmp = `${SNAPSHOT_FILE}.tmp-${process.pid}`; // the coach never reads a half-written file
  fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, SNAPSHOT_FILE);
  writtenFor = key;
  return meta;
}

function writeNow(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  try {
    writeSnapshot(loadBank(), loadConfig());
  } catch (e) {
    console.error('snapshot failed', e);
  }
}

/** Rewrites the snapshot ~3 s after the last call (submit, why-note, issue…) — never inside the request. */
export function scheduleSnapshot(delayMs = SNAPSHOT_DEBOUNCE_MS): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(writeNow, delayMs);
  timer.unref(); // never keeps a script / test process alive
}

/** A scheduled write is pending, or the data changed since this process last wrote the file. */
export function snapshotStale(): boolean {
  return !!timer || !fs.existsSync(SNAPSHOT_FILE) || writtenFor !== inputsKey();
}

/** Builds the snapshot now when it is stale (GET /api/snapshot); returns whether it was rewritten. */
export function ensureSnapshot(): boolean {
  if (!snapshotStale()) return false;
  writeNow();
  return true;
}

/** Writes a pending scheduled snapshot immediately (server shutdown). */
export function flushSnapshot(): void {
  if (timer) writeNow();
}

export function questionsFor(bank: BankState, ids: string[]): Question[] {
  return ids.map((id) => bank.byId.get(id)).filter((q): q is Question => !!q);
}
