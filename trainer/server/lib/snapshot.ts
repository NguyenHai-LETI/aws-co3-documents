// coach/snapshot.md — a compact, pre-computed digest of the learner's history for the AI coach.
// The coach reads this first instead of parsing every result file (cheaper and less error-prone).
import fs from 'node:fs';
import { SNAPSHOT_FILE, type AppConfig } from '../config.ts';
import type { BankState } from './bank.ts';
import { detectFeatures, detectServices } from './classify.ts';
import { loadIssues } from './issues.ts';
import { loadPlans } from './plans.ts';
import { loadAttempts } from './results.ts';
import { computeStates, computeStats, struckCorrect } from './stats.ts';
import { qualitySnapshotLines } from './quality.ts';
import { qaSnapshotLines } from './ask.ts';
import { fmtLocal, localDateKey, localIso } from './time.ts';
import { stringifyFrontMatter } from './frontmatter.ts';
import { fmtDuration } from '../../shared/timing.ts';
import { pct } from '../../shared/scoring.ts';
import { MODE_INFO } from '../../shared/labels.ts';
import type { AnswerRecord, Attempt, Bucket, Plan, Question } from '../../shared/types.ts';

function oneLine(s: string, max = 200): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

const cell = (s: string) => s.replace(/\|/g, '/');

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

export function buildSnapshot(bank: BankState, cfg: AppConfig): { text: string; meta: Record<string, unknown> } {
  const tax = bank.taxonomy;
  const all = loadAttempts(cfg);
  const attempts = all.filter((a) => !a.rushed);
  const rushed = all.filter((a) => a.rushed);
  const states = computeStates(all, cfg);
  const stats = computeStats(all, bank, states, cfg);
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
  for (const a of attempts) for (const r of a.answers) history.set(r.q, [...(history.get(r.q) ?? []), { r, a }]);

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
    '> Thứ tự ưu tiên khi phân tích: §7 câu sai (kèm ghi chú “vì sao chọn” của người học) → §9 nhầm lẫn lặp lại → §2b/§3–5 điểm yếu → §8 chưa chắc/chậm → §10 tiến độ kế hoạch.',
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
  for (const q of bank.questions) for (const v of q.variantOf) variantsOf.set(v, [...(variantsOf.get(v) ?? []), q.id]);
  const wrongQs = [...states.values()]
    .filter((s) => s.lastOk === false && bank.byId.has(s.id))
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
    .flatMap(([qid, h]) => h.filter((x) => x.r.why && !wrongSet.has(qid)).map((x) => ({ qid, ...x })))
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
    .filter((s) => bank.byId.has(s.id) && s.lastOk && (s.lastUnsure || s.lastFlag || s.slowCount > 0 || s.lastGrade === 2))
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

  // ── confusion pairs: services/features of the chosen wrong option vs the correct option
  const pairs = new Map<string, { n: number; qs: Set<string> }>();
  for (const a of attempts) {
    for (const r of a.answers) {
      if (r.ok || !r.pick) continue;
      const q = bank.byId.get(r.q);
      if (!q) continue;
      const text = (keys: string) => q.options.filter((x) => keys.includes(x.key)).map((x) => x.text).join(' ');
      const wrongKeys = [...r.pick].filter((k) => !q.answer.includes(k)).join('');
      const pickedAll = [...detectServices(text(wrongKeys), tax), ...detectFeatures(text(wrongKeys), tax)];
      const rightAll = [...detectServices(text(q.answer.join('')), tax), ...detectFeatures(text(q.answer.join('')), tax)];
      // keep only what differs between the chosen and the correct option(s)
      const picked = pickedAll.filter((x) => !rightAll.includes(x));
      const right = rightAll.filter((x) => !pickedAll.includes(x));
      const label =
        picked.length && right.length
          ? `${picked.slice(0, 2).join(' + ')} ⟶ ${right.slice(0, 2).join(' + ')}`
          : `${oneLine(text(wrongKeys), 50)} ⟶ ${oneLine(text(q.answer.join('')), 50)}`;
      const e = pairs.get(label) ?? { n: 0, qs: new Set<string>() };
      e.n++;
      e.qs.add(q.id);
      pairs.set(label, e);
    }
  }
  const topPairs = [...pairs].sort((a, b) => b[1].n - a[1].n).slice(0, 25);
  o.push('## 9. Nhầm lẫn lặp lại (đáp án đã chọn ⟶ đáp án đúng)', '');
  if (!topPairs.length) o.push('_Chưa có dữ liệu._');
  else {
    o.push('| Đã chọn ⟶ Đúng | Số lần | Câu |', '|---|---|---|');
    for (const [label, e] of topPairs) o.push(`| ${cell(label)} | ${e.n} | ${[...e.qs].slice(0, 6).map((x) => `\`${x}\``).join(' ')} |`);
  }
  o.push('');

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

  o.push(`## 11. Issues đang mở (${openIssues.length}) — \`trainer/bank/issues.md\``, '');
  if (!openIssues.length) o.push('_Không có._');
  for (const i of openIssues) {
    const q = bank.byId.get(i.qid);
    o.push(`- dòng ${i.line}: \`${i.qid}\` · ${i.type} · ${i.note}${q ? ` · file: \`${q.file}\`` : ' · ⚠️ id không tồn tại'}`);
  }
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

  return { text: stringifyFrontMatter(meta) + '\n' + o.join('\n'), meta };
}

export function writeSnapshot(bank: BankState, cfg: AppConfig): Record<string, unknown> {
  const { text, meta } = buildSnapshot(bank, cfg);
  fs.writeFileSync(SNAPSHOT_FILE, text);
  return meta;
}

export function questionsFor(bank: BankState, ids: string[]): Question[] {
  return ids.map((id) => bank.byId.get(id)).filter((q): q is Question => !!q);
}
