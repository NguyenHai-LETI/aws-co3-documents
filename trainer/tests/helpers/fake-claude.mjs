#!/usr/bin/env node
// Stand-in for the Claude Code CLI in tests — never calls a model. `--version` and `auth status` answer like the real CLI.
//   -p <prompt>                      (file mode) writes the learner profile, as an analyze run would, recording what the run
//                                    could see (result files on disk, attempts in the snapshot); stream-json transcript.
//   -p <prompt> --json-schema <s>    (structured output) answers through a StructuredOutput tool call + result.structured_output,
//                                    derived from the prompt and the files it names — never writes a file:
//                                      items     ENRICH: one item per question of the batch file named in the prompt
//                                      questions generate: `count` questions · longform: one long variant per original
//                                      results   verify: the real key of each question (read from the bank), unless FAKE_VERIFY
//                                      [v5] twins: one sibling per original of the batch (kind from the batch) ·
//                                      families: `count` qualifier families (2 members: cost ⟷ ops, different keys) ·
//                                      grounded (results with citations): verdict correct + a docs.aws.amazon.com quote,
//                                      unless FAKE_GROUNDED · generate with exam-guide bullets: `skills` = first bullet
//   --resume <session>               repair round: corrected items for the ids listed in the prompt.
// Knobs (environment, inherited from the test server):
//   FAKE_CLAUDE_LOG=<file>     append {argv, cwd} per call (tests assert flags)
//   FAKE_BAD=<id|#n,…>         the first answer is wrong for these ENRICH ids / n-th new questions (option letters in the explanation)
//   FAKE_REPAIR_FAIL=1         the repair answer is still wrong
//   FAKE_OPTIONS=<id,…>        ENRICH rewrites a distractor of these questions (new hash → auto blind-solve)
//   FAKE_VERIFY=<json>         {"<id or pattern with *>": {"answer": ["C"], "ambiguous": false, "confidence": "high", "reason": "…",
//                              "until": "<text>"}} — with `until`: the override applies only while the question does not contain
//                              that text (e.g. a distractor ENRICH rewrote), afterwards the real key is given
//   FAKE_SLOW_RESUME_MS / FAKE_SLOW_VERIFY_MS   sleep before answering a repair (--resume) / blind-solve call
//   FAKE_SLOW_FILE_MS          sleep before a file-mode (analyze) call writes anything
//   FAKE_RESULT_ERROR=1        the result line reports an error
//   FAKE_GROUNDED=<json>       {"<id or pattern with *>": {"verdict": "wrong", "answer": ["C"], "citations": [...]}} (grounded calls)
//   FAKE_BAD=fam#n             the n-th family's 2nd member repeats the 1st member's key (rejected, fixed by the repair round)
//   FAKE_TWIN_COPY=<id,…>      the surface twin of these originals copies the original stem (rejected, then reworded on repair)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
if (argv[0] === '--version') {
  console.log('2.1.301 (Claude Code)');
  process.exit(0);
}
if (argv[0] === 'auth') {
  console.log(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max' }));
  process.exit(0);
}
if (process.env.FAKE_CLAUDE_LOG) fs.appendFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify({ argv, cwd: process.cwd() }) + '\n');

const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const prompt = arg('-p') ?? '';
const runId = /run_id: (\S+)/.exec(prompt)?.[1] ?? '?';
const say = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const list = (v) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const schemaText = arg('--json-schema');
const resume = arg('--resume');
const session = resume ?? crypto.randomUUID();
const model = arg('--model') ?? 'fake-claude';

// ── file mode (analyze) ─────────────────────────────────────────────────────

if (!schemaText) {
  if (Number(process.env.FAKE_SLOW_FILE_MS || 0) > 0) await new Promise((r) => setTimeout(r, Number(process.env.FAKE_SLOW_FILE_MS)));
  const dir = 'trainer/results';
  const results = fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.md')).length : 0;
  let snapshotAttempts = '?';
  try {
    snapshotAttempts = /^attempts: (\d+)/m.exec(fs.readFileSync('trainer/coach/snapshot.md', 'utf8'))?.[1] ?? '?';
  } catch {
    // no snapshot
  }
  say({ type: 'system', subtype: 'init', model, permissionMode: 'dontAsk', session_id: session });
  fs.writeFileSync('trainer/coach/learner-profile.md', `# Learner profile\n\nrun: ${runId}\nresults_on_disk: ${results}\nsnapshot_attempts: ${snapshotAttempts}\n`);
  say({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'trainer/coach/learner-profile.md' } }] } });
  say({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0, result: `fake run ${runId}`, permission_denials: [], session_id: session });
  process.exit(0);
}

// ── structured output ───────────────────────────────────────────────────────

const schema = JSON.parse(schemaText);
const slow = resume ? Number(process.env.FAKE_SLOW_RESUME_MS || 0) : schema.properties?.results ? Number(process.env.FAKE_SLOW_VERIFY_MS || 0) : 0;
if (slow > 0) await new Promise((r) => setTimeout(r, slow));
const props = schema.properties ?? {};
const bad = new Set(list(process.env.FAKE_BAD));
const stillBad = process.env.FAKE_REPAIR_FAIL === '1';
const failing = [...prompt.matchAll(/^- `([^`]+)`/gm)].map((m) => m[1]); // repair prompt: "- `id` (…): errors"

const GOOD_EXPLANATION = (others) =>
  [
    'The chosen design meets the stated requirement directly with the least operational effort, which is exactly what the scenario asks the architect to deliver here.',
    ...others.slice(0, 2).map((t) => `- ${t.replace(/[:.]+$/, '').slice(0, 60)}: misses a key constraint of the scenario.`),
    '> 🇻🇳 Đọc kỹ ràng buộc chính của đề rồi chọn giải pháp đáp ứng trực tiếp.',
  ].join('\n');
const BAD_EXPLANATION = 'Option B is correct because it is the only answer that meets the requirement; answer C does not.';
const HINT = 'Đề nhấn mạnh ràng buộc nào là quyết định — giải pháp nào đáp ứng đúng ràng buộc đó mà ít vận hành nhất?';

function readText(p) {
  for (const f of [p, path.resolve(process.cwd(), p)]) {
    try {
      return fs.readFileSync(f, 'utf8');
    } catch {
      // try the next form
    }
  }
  return '';
}

/** Question sections of a batch file written by the app (enrich.ts questionSection). */
function batchQuestions(text) {
  const out = [];
  for (const sec of text.split(/\n(?=## \d+\. `)/).slice(1)) {
    const id = /^## \d+\. `([^`]+)`/.exec(sec)?.[1];
    if (!id) continue;
    const domain = /domain `(\w+)`/.exec(sec)?.[1] ?? 'resilient';
    const topic = /topic `([\w-]+)`/.exec(sec)?.[1] ?? 'database';
    const options = [...sec.matchAll(/^- ([A-H])\. (.*?)(?: {2}⟨\d+⟩)?( {2}✅)?$/gm)].map((m) => ({ key: m[1], text: m[2], ok: !!m[3] }));
    out.push({ id, domain, topic, options });
  }
  return out;
}

function taskFor(text, domain) {
  for (const m of text.matchAll(/^- `(\d\.\d)` \((\w+)\)/gm)) if (m[2] === domain) return m[1];
  return { secure: '1.1', resilient: '2.2', performance: '3.1', cost: '4.1' }[domain] ?? '2.2';
}

function enrichAnswer() {
  const batchPath = /lô câu hỏi: `([^`]+)`/.exec(prompt)?.[1];
  const text = batchPath ? readText(batchPath) : '';
  // the repair prompt has no batch path: find it from the run id
  const batch = text || readText(`trainer/coach/enrich/${runId}-batch.md`) || readText(path.join(process.env.TRAINER_HOME ?? 'trainer', 'coach', 'enrich', `${runId}-batch.md`));
  const qs = batchQuestions(batch);
  const pick = resume ? qs.filter((q) => failing.includes(q.id)) : qs;
  const optionIds = new Set(list(process.env.FAKE_OPTIONS));
  const items = pick.map((q) => {
    const wrong = (!resume && bad.has(q.id)) || (resume && stillBad);
    const others = q.options.filter((o) => !o.ok).map((o) => o.text);
    const item = { id: q.id, set: { task: taskFor(batch, q.domain), hint: HINT, concept: `Fake concept for ${q.id}` }, explanation: wrong ? BAD_EXPLANATION : GOOD_EXPLANATION(others) };
    const d = q.options.find((o) => !o.ok);
    if (optionIds.has(q.id) && d) item.options = { [d.key]: `${d.text} in a second AWS Region` };
    return item;
  });
  return { items, summary: `fake ENRICH: ${items.length} item` };
}

const STEM = (n, topic) =>
  `A retail company runs its order service on Amazon EC2 instances in two Availability Zones and stores orders in an Amazon RDS for PostgreSQL database (${topic} scenario ${n}). The database must keep running with automatic failover if one Availability Zone becomes unavailable, recovery must not require any application changes, and the small operations team wants to keep administrative work low. Which solution will meet these requirements?`;
const OPTIONS = [
  'Convert the DB instance to a Multi-AZ deployment with a synchronous standby',
  'Create a read replica in another Availability Zone and promote it manually',
  'Take automated snapshots every hour and restore them in another zone',
  'Export the data nightly to Amazon S3 and reload it after an outage',
];

function newQuestion(n, opts = {}) {
  const shift = (n - 1) % 4; // rotate the key over A–D
  const options = OPTIONS.map((_, i) => OPTIONS[(i - shift + 4) % 4]);
  const key = 'ABCD'[shift];
  const others = options.filter((_, i) => i !== shift);
  return {
    ...(opts.id ? { id: opts.id } : {}),
    domain: 'resilient',
    task: '2.2',
    topic: opts.topic ?? 'database',
    services: ['RDS'],
    tags: ['multi-az'],
    difficulty: 'medium',
    ...(opts.variantOf ? { variant_of: [opts.variantOf] } : {}),
    concept: 'RDS Multi-AZ (synchronous standby, automatic failover) vs read replicas and snapshots',
    refs: ['03-database-services.md'],
    hint: HINT,
    stem: STEM(n, opts.topic ?? 'database'),
    options,
    answer: [key],
    explanation: opts.bad ? BAD_EXPLANATION : GOOD_EXPLANATION(others),
  };
}

function packAnswer() {
  const longform = resume ? failing.some((id) => /-lf\d+$/.test(id)) : /phần \*\*B\*\*/.test(prompt) && !/GENERATE\.md/.test(prompt);
  if (resume) {
    // corrected questions for the ids listed in the repair prompt (generate ids end in -NN, long-form ids in lfNN)
    const questions = failing.map((id) => newQuestion(Number(/(\d+)$/.exec(id)?.[1] ?? 1), { id, bad: stillBad, variantOf: longform ? originalsOf(runId)[Number(/(\d+)$/.exec(id)?.[1] ?? 1) - 1] : undefined }));
    return { pack: { slug: 'fake-pack', title: 'Fake pack' }, questions, summary: `fake repair: ${questions.length} câu` };
  }
  if (longform) {
    const originals = originalsOf(runId);
    const questions = originals.map((o, i) => newQuestion(i + 1, { variantOf: o, bad: bad.has(`#${i + 1}`) }));
    return { pack: { slug: 'fake-longform', title: 'RDS failover' }, questions, summary: `fake longform: ${questions.length} câu` };
  }
  const count = Number(/- count: (\d+)/.exec(prompt)?.[1] ?? 3);
  const questions = Array.from({ length: count }, (_, i) => newQuestion(i + 1, { bad: bad.has(`#${i + 1}`) }));
  return { pack: { slug: 'fake-pack', title: 'Fake pack', description: 'generated by fake-claude' }, questions, summary: `fake generate: ${questions.length} câu` };
}

function originalsOf(id) {
  const batchPath = /câu gốc: `([^`]+)`/.exec(prompt)?.[1];
  const text = (batchPath && readText(batchPath)) || readText(`trainer/coach/enrich/${id}-batch.md`) || readText(path.join(process.env.TRAINER_HOME ?? 'trainer', 'coach', 'enrich', `${id}-batch.md`));
  return batchQuestions(text).map((q) => q.id);
}

/** Answer keys of every question in the bank ($TRAINER_HOME/bank/packs). */
function bankKeys() {
  const root = path.join(process.env.TRAINER_HOME ?? 'trainer', 'bank', 'packs');
  const keys = new Map();
  const walk = (d) => {
    for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) {
        for (const block of fs.readFileSync(p, 'utf8').split(/\n(?=## Q )/)) {
          const id = /^## Q:? (\S+)/.exec(block)?.[1];
          const ans = /\*\*Answer:\*\*\s*([A-H](?:\s*,\s*[A-H])*)/.exec(block)?.[1];
          if (id && ans) keys.set(id, ans.match(/[A-H]/g));
        }
      }
    }
  };
  walk(root);
  return keys;
}

function verifyAnswer() {
  const overrides = Object.entries(JSON.parse(process.env.FAKE_VERIFY || '{}')).map(([k, v]) => [new RegExp(`^${k.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`), v]);
  const keys = bankKeys();
  const sections = prompt.split(/\n(?=## \d+\. `)/).slice(1);
  const ids = sections.map((sec) => /^## \d+\. `([^`]+)`/.exec(sec)?.[1]).filter(Boolean);
  const results = ids.map((id) => {
    const section = sections.find((sec) => sec.startsWith(`## `) && sec.includes(`\`${id}\``)) ?? '';
    const found = overrides.find(([re]) => re.test(id))?.[1];
    const o = found && !(found.until && section.includes(found.until)) ? found : undefined;
    return { id, answer: o?.answer ?? keys.get(id) ?? ['A'], confidence: o?.confidence ?? 'high', ambiguous: o?.ambiguous ?? false, reason: o?.reason ?? 'Giải thử: lựa chọn này đáp ứng đúng yêu cầu chính của đề.' };
  });
  return { results };
}

// ── [v5] twins / families / grounded ────────────────────────────────────────

function twinsAnswer() {
  const batchPath = /câu gốc: `([^`]+)`/.exec(prompt)?.[1];
  const text = (batchPath && readText(batchPath)) || readText(`trainer/coach/enrich/${runId}-batch.md`) || readText(path.join(process.env.TRAINER_HOME ?? 'trainer', 'coach', 'enrich', `${runId}-batch.md`));
  const sections = text.split(/\n(?=## \d+\. `)/).slice(1);
  const originals = batchQuestions(text).map((q, i) => ({ ...q, kind: /loại: \*\*(\w+)\*\*/.exec(sections[i] ?? '')?.[1] ?? 'surface', stem: /\*\*Stem\*\*[^\n]*\n\n([\s\S]*?)\n\n\*\*Options/.exec(sections[i] ?? '')?.[1] ?? '' }));
  const copy = new Set(list(process.env.FAKE_TWIN_COPY));
  const pick = resume ? originals.filter((o, i) => failing.some((id) => Number(/(\d+)$/.exec(id)?.[1]) === i + 1)) : originals;
  const questions = pick.map((o) => {
    const n = originals.indexOf(o) + 1;
    const q = newQuestion(n, { variantOf: o.id, bad: !resume && bad.has(`#${n}`) });
    if (!resume && copy.has(o.id) && o.stem) q.stem = o.stem;
    return { ...(resume ? { id: failing.find((id) => Number(/(\d+)$/.exec(id)?.[1]) === n) } : {}), ...q, kind: o.kind };
  });
  return { pack: { slug: 'fake-twins', title: 'Twins' }, questions, summary: `fake twins: ${questions.length} câu` };
}

const FAMILY_OPTIONS = [
  'Run the workload on Amazon EC2 Spot Instances in an Auto Scaling group',
  'Move the workload to AWS Fargate tasks behind an Application Load Balancer',
  'Run the workload on Amazon EC2 Reserved Instances managed by the team',
  'Run the workload on Amazon EC2 Dedicated Hosts with custom AMIs',
];

function familyOne(n, opts = {}) {
  const others = (k) => FAMILY_OPTIONS.filter((_, i) => i !== k);
  return {
    ...(opts.id ? { id: opts.id } : {}),
    domain: 'cost',
    task: '4.2',
    topic: 'compute',
    services: ['EC2', 'Fargate'],
    tags: ['spot-instances'],
    difficulty: 'hard',
    concept: 'Same workload: the cheapest option vs the least operational overhead',
    refs: ['01-compute-services.md'],
    scenario: `A media company runs a stateless video thumbnail service (family scenario ${n}) on a fleet of Amazon EC2 instances that a small team patches by hand. The service can tolerate interruptions and must scale with an unpredictable number of uploads during the day while the company wants to control spending.`,
    options: FAMILY_OPTIONS,
    members: [
      { ask: 'cost', question: 'Which solution meets these requirements MOST cost-effectively?', answer: ['A'], explanation: GOOD_EXPLANATION(others(0)), hint: HINT },
      { ask: 'ops', question: 'Which solution meets these requirements with the LEAST operational overhead?', answer: [opts.bad ? 'A' : 'B'], explanation: GOOD_EXPLANATION(others(1)), hint: HINT },
    ],
  };
}

function familyAnswer() {
  if (resume) {
    const families = failing.map((id) => familyOne(Number(/(\d+)$/.exec(id)?.[1] ?? 1), { id, bad: stillBad }));
    return { pack: { slug: 'fake-family', title: 'Family' }, families, summary: `fake repair: ${families.length} họ` };
  }
  const count = Number(/viết đúng (\d+) họ/.exec(prompt)?.[1] ?? 2);
  const families = Array.from({ length: count }, (_, i) => familyOne(i + 1, { bad: bad.has(`fam#${i + 1}`) }));
  return { pack: { slug: 'fake-family', title: 'Family' }, families, summary: `fake family: ${families.length} họ` };
}

function groundedAnswer() {
  const overrides = Object.entries(JSON.parse(process.env.FAKE_GROUNDED || '{}')).map(([k, v]) => [new RegExp(`^${k.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`), v]);
  const keys = bankKeys();
  const ids = [...prompt.matchAll(/^## \d+\. `([^`]+)`/gm)].map((m) => m[1]);
  const results = ids.map((id) => {
    const o = overrides.find(([re]) => re.test(id))?.[1];
    return {
      id,
      verdict: o?.verdict ?? 'correct',
      answer: o?.answer ?? keys.get(id) ?? ['A'],
      citations: o?.citations ?? [{ url: 'https://docs.aws.amazon.com/fake/latest/userguide/feature.html', quote: `Fake documentation quote for ${id}.` }],
      reason: o?.reason ?? 'Tài liệu AWS xác nhận.',
    };
  });
  return { results };
}

const isGrounded = !!props.results?.items?.properties?.citations;
const isTwins = !!props.questions?.items?.properties?.kind;
// the repair round keeps the session's context: remember the bullets of the first call per run
const skillMemo = path.join(process.env.TRAINER_HOME ?? '.', `.fake-skills-${runId}.json`);
let skillIds = [...prompt.matchAll(/^ {2}- `(\d\.\d\.[ks]\d+)`/gm)].map((m) => m[1]);
if (skillIds.length && !resume) fs.writeFileSync(skillMemo, JSON.stringify(skillIds));
else if (resume && fs.existsSync(skillMemo)) skillIds = JSON.parse(fs.readFileSync(skillMemo, 'utf8'));
let answer = isGrounded ? groundedAnswer() : props.results ? verifyAnswer() : props.items ? enrichAnswer() : props.families ? familyAnswer() : isTwins ? twinsAnswer() : packAnswer();
if (skillIds.length && Array.isArray(answer.questions)) answer = { ...answer, questions: answer.questions.map((q) => ({ ...q, skills: [skillIds[0]] })) };
const failed = process.env.FAKE_RESULT_ERROR === '1';
say({ type: 'system', subtype: 'init', model, permissionMode: arg('--permission-mode') ?? 'default', session_id: session });
say({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'StructuredOutput', input: answer }] } });
say({
  type: 'result',
  subtype: failed ? 'error_during_execution' : 'success',
  is_error: failed,
  total_cost_usd: 0.01,
  result: failed ? 'fake failure' : JSON.stringify(answer),
  ...(failed ? {} : { structured_output: answer }),
  session_id: session,
  permission_denials: [],
});
