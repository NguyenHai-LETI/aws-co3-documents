// [v5 τ] 🧑‍🏫 Socratic tutor: give-up / leak detection, CLI arguments (no tools, model, system prompt, --resume), and whole
// dialogs through the fake CLI (tests/helpers/fake-claude-tutor.mjs): the key stays hidden until the 3rd learner turn or
// "tôi chịu", the learner can find it first, the turn cap, the daily cap (no AI past it), sealed refusal, the leak guard,
// the transcript in coach/qa (kind tutor) and the closing rule in the notebook. Run: npm test
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-tutor-')));
const LOG = path.join(home, 'fake-claude.log');
fs.mkdirSync(path.join(home, 'bank', 'packs', 'manual'), { recursive: true });
fs.copyFileSync(path.join(here, '..', 'bank', 'taxonomy.yaml'), path.join(home, 'bank', 'taxonomy.yaml'));
for (const d of ['results', 'coach/qa']) fs.mkdirSync(path.join(home, d), { recursive: true });
fs.copyFileSync(path.join(here, '..', 'coach', 'TUTOR.md'), path.join(home, 'coach', 'TUTOR.md'));
const CFG = path.join(home, 'config.yaml');
const config = (turns: number) => fs.writeFileSync(CFG, `coach:\n  model: opus\n  models: { tutor: haiku }\n  tutor_daily_turns: ${turns}\nexam:\n  sealed_forms: 0\nsync:\n  auto: off\n`);
config(40);
const qtext = (id: string, stem: string, options: string[], answer: string) =>
  [`## Q ${id}`, '- domain: resilient', '- topic: database', '- difficulty: medium', '- time: 60', '- refs: 03-database-services.md', '', stem, '', ...options.map((o, i) => `- ${'ABCD'[i]}. ${o}`), '', `**Answer:** ${answer}`, '', '**Explanation:** Multi-AZ gives automatic failover with a synchronous standby.', '', '---', ''].join('\n');
const OPTS = ['Read Replicas in another Availability Zone', 'Multi-AZ deployment with a synchronous standby', 'Hourly snapshots copied to another Region', 'A bigger DB instance class'];
fs.writeFileSync(
  path.join(home, 'bank', 'packs', 'manual', 'tu.md'),
  ['---\npack: tu-pack\ntitle: Tutor pack\norigin: manual\n---\n\n# Tutor pack\n', ...['tu-01', 'tu-02', 'tu-03', 'tu-04', 'tu-05', 'tu-06', 'tu-07'].map((id) => qtext(id, `(${id}) A database must fail over automatically when an Availability Zone fails. Which feature should be used?`, OPTS, 'B'))].join('\n'),
);
process.env.TRAINER_HOME = home;
process.env.TRAINER_ALLOW_COACH = '1';
process.env.CLAUDE_BIN = path.join(here, 'helpers', 'fake-claude-tutor.mjs');
process.env.FAKE_CLAUDE_LOG = LOG;
process.env.FAKE_TUTOR_DIR = path.join(home, 'fake-sessions');
after(() => fs.rmSync(home, { recursive: true, force: true }));

const tutor = await import('../server/lib/tutor.ts');
const { loadQa } = await import('../server/lib/ask.ts');
const { loadNotebook } = await import('../server/lib/notebook.ts');
const { loadConfig } = await import('../server/config.ts');
const { loadBank } = await import('../server/lib/bank.ts');
const { createAttempt } = await import('../server/lib/results.ts');

type Call = { argv: string[]; stdin: string };
const calls = (): Call[] => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Call) : []);
const flag = (argv: string[], name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const rejects = (p: Promise<unknown> | (() => unknown), status: number) =>
  assert.rejects(async () => (typeof p === 'function' ? p() : p), (e: Error & { status?: number }) => {
    assert.equal(e.status, status, e.message);
    return true;
  });

beforeEach(() => {
  config(40);
  delete process.env.FAKE_TUTOR_LEAK;
});

test('give-up and leak detection', () => {
  for (const t of ['tôi chịu', 'Chịu rồi!', 'bó tay', 'không biết', 'Mình chịu, cho mình xem đáp án', 'nói luôn đáp án đi', 'pass']) assert.ok(tutor.isGiveUp(t), t);
  for (const t of ['Tôi không biết SQS có fan-out không, nhưng chắc là có', 'Vì read replica nằm ở AZ khác', 'chịu khó đọc lại đề thì thấy cần failover']) assert.ok(!tutor.isGiveUp(t), t);
  const q = loadBank().byId.get('tu-01')!;
  assert.ok(tutor.leaksAnswer('Có lẽ bạn nên xem multi-AZ deployment with a synchronous standby…', q));
  assert.ok(!tutor.leaksAnswer('Read Replicas khác Multi-AZ ở điểm nào khi một AZ hỏng?', q), 'naming a service to compare is not a leak');
});

test('CLI arguments: prompt on stdin, no tools / MCP / skills, JSON schema, TUTOR.md, the tutor model, --resume', () => {
  const cfg = loadConfig();
  const a = tutor.tutorArgs(cfg);
  assert.deepEqual(a.slice(0, 3), ['-p', '--output-format', 'json']);
  assert.equal(flag(a, '--tools'), '');
  assert.ok(a.includes('--strict-mcp-config') && a.includes('--disable-slash-commands'));
  assert.equal(flag(a, '--model'), 'haiku');
  assert.match(flag(a, '--system-prompt-file') ?? '', /coach[\\/]TUTOR\.md$/);
  assert.deepEqual(JSON.parse(flag(a, '--json-schema')!).required, ['message', 'learnerFound', 'rule']);
  assert.ok(!a.includes('--resume') && !a.includes('--no-session-persistence'), 'the session is kept for the next turn');
  assert.equal(flag(tutor.tutorArgs(cfg, { resume: 'abc' }), '--resume'), 'abc');
  assert.equal(flag(tutor.tutorArgs({ ...cfg, coach: { ...cfg.coach, models: { ...cfg.coach.models, tutor: '' } } }), '--model'), 'opus', 'falls back to coach.model');
  const prompt = tutor.buildOpeningPrompt(loadBank().byId.get('tu-01')!, { pick: 'A', why: 'replica ở AZ khác', elim: 'D', unsure: false, hinted: false, pickOk: false });
  assert.match(prompt, /- \[B\] Multi-AZ deployment with a synchronous standby {2}✅ đáp án đúng/);
  assert.match(prompt, /- \[A\] Read Replicas in another Availability Zone {2}← người học đã chọn/);
  assert.match(prompt, /- \[D\] A bigger DB instance class {2}✗ người học đã gạch bỏ/);
  assert.match(prompt, /Vì sao chọn: “replica ở AZ khác”/);
  assert.match(prompt, /CHƯA được nêu hay ám chỉ đáp án đúng/);
});

test('a dialog: hidden key, 3 learner turns, reveal + rule → transcript (kind tutor) + notebook; turn cap', async () => {
  const before = calls().length;
  const d0 = await tutor.startTutor({ qid: 'tu-01', pick: 'A', why: 'replica ở AZ khác', unsure: false });
  assert.equal(d0.status, 'open');
  assert.equal(d0.messages.length, 1);
  assert.equal(d0.answer, undefined, 'the key is hidden');
  assert.equal(d0.usage.used, 1);
  assert.equal((await tutor.startTutor({ qid: 'tu-01' })).id, d0.id, 'start again → the open dialog, no new call');
  const d1 = await tutor.tutorTurn({ id: d0.id, text: 'Vì replica cũng có dữ liệu' });
  assert.equal(d1.learnerTurns, 1);
  assert.equal(d1.answer, undefined);
  const d2 = await tutor.tutorTurn({ id: d0.id, text: 'Có thể là cần đồng bộ?' });
  assert.equal(d2.status, 'open');
  const d3 = await tutor.tutorTurn({ id: d0.id, text: 'Tôi nghĩ là snapshot' });
  assert.equal(d3.status, 'closed');
  assert.equal(d3.outcome, 'revealed');
  assert.deepEqual(d3.answer, ['B']);
  assert.match(d3.rule ?? '', /^Khi đề yêu cầu/);
  assert.equal(d3.notebookKey, 'fake-rule-tu-01');
  assert.equal(d3.messages.length, 7);
  await rejects(tutor.tutorTurn({ id: d0.id, text: 'thêm một câu' }), 409);

  const c = calls().slice(before);
  assert.equal(c.length, 4, 'opening + 3 turns');
  assert.ok(!c[0].argv.includes('--resume'));
  const session = JSON.parse(fs.readFileSync(path.join(home, 'fake-sessions', fs.readdirSync(path.join(home, 'fake-sessions'))[0]), 'utf8')) as { prompts: string[] };
  assert.ok(session.prompts.length >= 1);
  const resumeIds = new Set(c.slice(1).map((x) => flag(x.argv, '--resume')));
  assert.equal(resumeIds.size, 1, 'every turn resumes the same session');
  assert.ok([...resumeIds][0]);
  for (const x of c) {
    assert.equal(flag(x.argv, '--tools'), '');
    assert.equal(flag(x.argv, '--model'), 'haiku');
  }
  assert.match(c[0].stdin, /Phiên gia sư mới về câu `tu-01`/);
  assert.match(c[3].stdin, /Đã đủ 3 lượt\. BÂY GIỜ nêu đáp án/);
  assert.match(c[1].stdin, /> Vì replica cũng có dữ liệu/);

  const qa = loadQa('tu-01');
  assert.equal(qa.length, 1);
  assert.equal(qa[0].kind, 'tutor');
  assert.equal(qa[0].turns, 3);
  assert.equal(qa[0].calls, 4);
  assert.equal(qa[0].outcome, 'revealed');
  assert.equal(qa[0].pick, 'A');
  assert.match(qa[0].answer, /\*\*🧑‍🏫 Gia sư:\*\* Câu hỏi dẫn dắt 1/);
  assert.match(qa[0].answer, /> 🙋 Tôi nghĩ là snapshot/);
  assert.match(qa[0].answer, /\*\*📌 Quy tắc:\*\* Khi đề yêu cầu/);
  const e = loadNotebook().find((x) => x.key === 'fake-rule-tu-01')!;
  assert.ok(e, 'the rule is in the notebook');
  assert.deepEqual(e.qids, ['tu-01']);
  assert.equal(e.source, 'tutor');
  assert.equal(e.confident, true, 'wrong, not unsure, no hint');
  assert.equal(e.contrast, 'RDS Multi-AZ ⟷ Read Replica');
  assert.equal(tutor.tutorStatus('tu-01').dialog?.status, 'closed', 'the closed dialog stays visible');
});

test('"tôi chịu" reveals at once; the learner can also find the answer first', async () => {
  const g = await tutor.startTutor({ qid: 'tu-02', pick: 'A' });
  const g1 = await tutor.tutorTurn({ id: g.id, text: '', giveUp: true });
  assert.equal(g1.outcome, 'gave-up');
  assert.deepEqual(g1.answer, ['B']);
  assert.match(calls().at(-1)!.stdin, /Người học xin xem đáp án\. BÂY GIỜ/);
  const t = await tutor.startTutor({ qid: 'tu-03', pick: 'A' });
  const t1 = await tutor.tutorTurn({ id: t.id, text: 'À, là Multi-AZ deployment with a synchronous standby vì cần failover tự động' });
  assert.equal(t1.status, 'closed');
  assert.equal(t1.outcome, 'found');
  assert.equal(t1.learnerTurns, 1);
  await rejects(tutor.tutorTurn({ id: t.id, text: 'x' }), 409);
});

test('leak guard: a guiding reply that names the key is asked again once', async () => {
  process.env.FAKE_TUTOR_LEAK = '1';
  const before = calls().length;
  const d = await tutor.startTutor({ qid: 'tu-04', pick: 'A' });
  assert.equal(calls().length - before, 2, 'the opening question was rewritten');
  assert.match(calls().at(-1)!.stdin, /đã nêu đáp án đúng trong khi chưa được phép/);
  assert.ok(!/Multi-AZ deployment with a synchronous standby/i.test(d.messages[0].text));
  assert.equal(d.usage.used >= 2, true, 'both replies count');
  process.env.FAKE_TUTOR_LEAK = 'always';
  const d1 = await tutor.tutorTurn({ id: d.id, text: 'không chắc lắm, có lẽ là replica' });
  assert.ok(!/synchronous standby/i.test(d1.messages.at(-1)!.text), 'still leaking after the rewrite: a neutral question is shown instead');
  assert.match(d1.messages.at(-1)!.text, /yêu cầu \*\*chính\*\*/);
  tutor.endTutor({ id: d.id });
  assert.match(loadQa('tu-04')[0].question, /nêu đáp án sớm \(đã chặn\)/);
});

test('daily cap: every AI reply counts; past the cap the dialog ends with the bank explanation, no AI; start refused', async () => {
  const used = tutor.tutorUsage(loadConfig()).used;
  config(used + 2);
  const d = await tutor.startTutor({ qid: 'tu-05', pick: 'A' });
  const d1 = await tutor.tutorTurn({ id: d.id, text: 'replica?' });
  assert.equal(d1.usage.remaining, 0);
  const n = calls().length;
  const d2 = await tutor.tutorTurn({ id: d.id, text: 'vẫn chưa ra' });
  assert.equal(calls().length, n, 'no AI call past the cap');
  assert.equal(d2.outcome, 'capped');
  assert.deepEqual(d2.answer, ['B']);
  assert.match(d2.messages.at(-1)!.text, /hết .* lượt gia sư/);
  assert.match(d2.messages.at(-1)!.text, /Multi-AZ gives automatic failover/);
  await rejects(tutor.startTutor({ qid: 'tu-06' }), 429);
  config(0);
  await rejects(tutor.startTutor({ qid: 'tu-06' }), 409);
  assert.equal(tutor.tutorStatus('tu-06').enabled, false);
  assert.match(tutor.tutorStatus('tu-06').reason ?? '', /tutor_daily_turns: 0/);
});

test('refusals: unknown, sealed (never sent to the AI), empty text; end keeps the transcript; context from the attempt', async () => {
  await rejects(tutor.startTutor({ qid: 'nope' }), 400);
  const SEALED = path.join(home, 'results', 'sealed.md');
  fs.writeFileSync(SEALED, '---\nkind: sealed\nsize: 1\nforms:\n  - id: S1\n    status: sealed\n    ids: [ tu-07 ]\n---\n');
  try {
    const before = calls().length;
    await rejects(tutor.startTutor({ qid: 'tu-07' }), 403);
    assert.equal(calls().length, before);
    const s = tutor.tutorStatus('tu-07');
    assert.equal(s.sealed, true);
    assert.equal(s.enabled, false);
  } finally {
    fs.rmSync(SEALED);
  }
  // pick / why / elim / unsure come from the attempt's record when the page sends only the attempt id
  const bank = loadBank();
  const a = createAttempt({ mode: 'quick', title: 'x', started: new Date().toISOString(), finished: new Date().toISOString(), answers: [{ q: 'tu-06', pick: 'C', key: 'B', ok: false, t: 20, est: 60, why: 'snapshot là đủ', elim: 'D', unsure: true }] }, bank);
  const d = await tutor.startTutor({ qid: 'tu-06', attemptId: a.id });
  const opening = calls().at(-1)!.stdin;
  assert.match(opening, /Đã chọn: “Hourly snapshots copied to another Region” \(sai\)/);
  assert.match(opening, /Đánh dấu chưa chắc: có/);
  assert.match(opening, /Vì sao chọn: “snapshot là đủ”/);
  await rejects(tutor.tutorTurn({ id: d.id, text: '   ' }), 400);
  const e = tutor.endTutor({ id: d.id });
  assert.equal(e.outcome, 'ended');
  assert.deepEqual(e.answer, ['B']);
  assert.equal(loadQa('tu-06').at(-1)?.outcome, 'ended');
  assert.ok(!loadNotebook().some((x) => x.qids.includes('tu-06')), 'no rule, no notebook entry');
  assert.ok(!fs.existsSync(path.join(home, '.local', 'tutor', `${d.id}.json`)), 'the open-dialog file is gone');
});

test('open dialogs are persisted, survive a reload and are closed after 30 idle minutes', async () => {
  config(100);
  const d = await tutor.startTutor({ qid: 'tu-02', pick: 'C' });
  const file = path.join(home, '.local', 'tutor', `${d.id}.json`);
  assert.ok(fs.existsSync(file));
  tutor.resetTutor();
  assert.equal(tutor.tutorStatus('tu-02').dialog?.id, d.id, 'reloaded from .local/tutor');
  tutor.sweep(Date.now() + 31 * 60_000);
  assert.equal(tutor.tutorStatus('tu-02').dialog?.status, 'closed');
  assert.ok(!fs.existsSync(file));
  assert.equal(loadQa('tu-02').at(-1)?.outcome, 'ended');
});

test('[R2] learnerFound without a rule closes nothing and never bypasses the leak guard (opening or turn)', async () => {
  config(100);
  process.env.FAKE_TUTOR_FOUND_NORULE = '1';
  try {
    const before = calls().length;
    const d = await tutor.startTutor({ qid: 'tu-05', pick: 'C' });
    assert.equal(d.status, 'open');
    assert.equal(calls().length - before, 2, 'the leaking opening was rewritten');
    assert.ok(!/synchronous standby/i.test(d.messages[0].text), 'the opening does not name the key');
    assert.equal(d.answer, undefined);
    const d1 = await tutor.tutorTurn({ id: d.id, text: 'cho gợi ý' });
    assert.equal(d1.status, 'open', 'no rule → not closed');
    assert.ok(!/synchronous standby/i.test(d1.messages.at(-1)!.text), 'turn 1 reply rewritten too');
    assert.equal(d1.answer, undefined);
    tutor.endTutor({ id: d.id });
  } finally {
    delete process.env.FAKE_TUTOR_FOUND_NORULE;
  }
});

test('[R2] a start that fails after a call still counts that call toward the daily cap', async () => {
  config(100);
  const used = tutor.tutorUsage(loadConfig()).used;
  process.env.FAKE_TUTOR_LEAK = '1';
  process.env.FAKE_TUTOR_FAIL_RESUME = '1';
  try {
    await rejects(tutor.startTutor({ qid: 'tu-03', pick: 'A' }), 502);
  } finally {
    delete process.env.FAKE_TUTOR_FAIL_RESUME;
  }
  assert.equal(tutor.tutorUsage(loadConfig()).used, used + 2, 'the opening + the failed retry');
  assert.notEqual(tutor.tutorStatus('tu-03').dialog?.status, 'open', 'no open dialog is left behind');
});
