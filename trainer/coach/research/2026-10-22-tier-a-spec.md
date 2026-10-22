# Tier-A generation spec (v6) — read fully before writing

You write ORIGINAL exam-grade SAA-C03 questions ("tầng A") for a Vietnamese learner's trainer app.
Exam date: 2026-11-13. These questions are the learner's main exam simulation, so they must read exactly like real AWS items
and be 100 % correct. A second model will blind-solve every question you write, and an independent reviewer will audit them.

## 0. Hard rules
- Original scenarios only. Never copy or paraphrase AWS official sample / practice questions, third-party practice exams or
  anything from "dump" sites. Knowledge sources: the repo's notes (root of the repo: 01-…14-*.md, A-…T-*.md), the exam guide
  (`trainer/bank/exam-guide/SAA-C03.yaml`), AWS documentation (WebFetch on docs.aws.amazon.com / aws.amazon.com only, load
  it with ToolSearch "select:WebFetch"), and your solid AWS knowledge.
- Current AWS (Oct 2026). Section 9 of the research notes
  (/private/tmp/claude-501/-Users-ntq-Desktop-aws-co3-documents/230078f4-b82c-4a47-9750-d6bc282b2c3d/scratchpad/research-2026-10-22.md)
  lists 50 verified changes 2022 → 2026. Respect them, e.g. S3 encrypts new objects by default (SSE-S3); new buckets block
  public access and disable ACLs; CloudFront uses OAC (OAI is legacy); public IPv4 addresses are billed; Aurora Serverless v1
  is gone; Kinesis Data Firehose is "Amazon Data Firehose"; DynamoDB on-demand is often cheapest for spiky traffic;
  EC2 Instance Connect Endpoint / Session Manager instead of public bastions.
- Never make one of these the correct answer: Data Pipeline, AppSync, QLDB, Pinpoint, Forecast, Fraud Detector, Kendra,
  Proton, Application Discovery Service, Migration Hub, Audit Manager, Elastic Transcoder, Snowmobile, Snowcone,
  S3 Select / Glacier Select, S3 Object Lambda, Glacier vaults / Vault Lock (the S3 Glacier storage classes are fine),
  Aurora Serverless v1, Kinesis Data Analytics for SQL, App Mesh, App Runner, OpsWorks, CloudTrail Lake, Simple AD,
  FSx File Gateway, Server Migration Service, CloudEndure, CodeCommit / Cloud9 (out of scope), any service on the official
  out-of-scope list (`scope: out` in trainer/bank/taxonomy.yaml). Avoid Snowball Edge as a key unless the stem makes an
  offline transfer the only option (it is closed to new customers since 2025-11-07).
- Features must have been generally available ≥ 3 months (launched before ~July 2026). Prefer stable, core concepts.
- No numeric limit in a stem, option or explanation unless you verified it on an AWS page (cite the URL in the explanation).
- Service names as the exam guide writes them (Amazon Data Firehose, Amazon Quick, Amazon SageMaker AI, AWS IAM Identity
  Center, AWS Application Migration Service); mention renamed names in the explanation only when useful.

## 1. Stem (55–130 words; aim 70–100)
Structure: company / industry context → current architecture or situation → 2–4 hard constraints (e.g. "must not traverse
the public internet", "without application code changes", "RPO of 15 minutes", "the operations team is small", "keys must be
rotated automatically", "traffic is unpredictable") → decision criterion → closed question.
- Decision criterion in ≥ 90 % of questions: a qualifier (MOST cost-effective, LEAST operational overhead, MOST secure,
  highest availability, LEAST latency, minimal changes…) or a closing question that names the requirements.
- Closing question: "Which solution will meet these requirements?" / "Which solution will meet these requirements MOST
  cost-effectively?" / "What should a solutions architect do to meet these requirements?" / "Which combination of steps
  will meet these requirements? (Choose TWO)".
- One realistic but irrelevant detail is allowed (real items include some). No trick wording. Positive phrasing; a negative
  stem (NOT/EXCEPT/LEAST likely) only rarely and CAPITALIZED.
- Every fact needed to decide is in the stem (a strong candidate could predict the kind of solution before reading options).

## 2. Options
- Single answer: exactly 4 options, 1 key. Multiple response: "(Choose TWO)" with 5 options (2 keys) or "(Choose THREE)" with
  6 options (3 keys). In each pack: 25–30 % multiple response; at most one "Choose THREE" per pack.
- Each option is a complete action (service + configuration), 8–35 words, written in the same shape as the others (all start
  with a verb like "Use…", "Configure…", "Create…", "Deploy…"), homogeneous (comparable on one dimension).
- The key must NOT stand out: in each pack it is the strictly longest option in at most 25 % of questions; no word echoes
  from the stem that only the key repeats; no absolute words ("always", "only", "never", "guarantee") in distractors; no
  "all/none of the above"; no overlapping options.
- Correct-answer positions evenly spread A–D across the pack (and across key pairs for multiple response).

## 3. Distractors — each fails for exactly ONE reason stated in the stem
Use these labels (in the explanation): vi phạm ràng buộc · dùng sai tính năng · cấu hình không tồn tại · đặt sai chỗ ·
giải bài toán khác · tốn vận hành hơn · tốn chi phí hơn · (MR) đúng một phần.
Distractors must be plausible to a candidate with partial knowledge: real services/features that are commonly confused with
the key (Multi-AZ ↔ read replicas, SQS ↔ SNS ↔ EventBridge, gateway ↔ interface endpoints, SCP ↔ RCP ↔ permissions
boundary, Global Accelerator ↔ CloudFront, EFS ↔ FSx ↔ S3, Kinesis Data Streams ↔ Data Firehose, Storage Gateway types…).
Seed them from the learner's real confusions in `trainer/coach/snapshot.md` (§7 wrong answers with "why" notes, §9 confused
pairs) when relevant. "Cấu hình không tồn tại" only when you are sure the setting does not exist.

## 4. Explanation (50–120 words, English + one Vietnamese line)
```
**Explanation:** <1–2 sentences: which constraint each part of the key satisfies>
- <distractor content, short>: <why it fails> (<label>)
- …one line per distractor…
Docs: <one AWS documentation URL that supports the key>
> 🇻🇳 <one-line Vietnamese summary of the decision rule>
```
Refer to options by CONTENT, never by letter (the app shuffles options): no "A:", "option B", "(C)", "đáp án D".

## 5. Metadata (SCHEMA §3) — every question
```
## Q <id>
- domain: secure | resilient | performance | cost     (must match the task's domain)
- task: "x.y"                                        (write without quotes in the pack: `- task: 1.1`)
- topic: <taxonomy topic id>
- services: <canonical names from taxonomy.yaml → services>
- tags: <kebab-case concepts, prefer taxonomy features>
- difficulty: medium | hard | easy                   (mix per pack ≈ medium 55 % · hard 35 % · easy 10 %)
- skills: <1–3 exam-guide bullet ids of this task, e.g. 1.1.k2, 1.1.s4>
- concept: <one short sentence: the decision point tested>
- refs: <repo notes file(s) used, e.g. 05-security-services.md>
- hint: <ONE Vietnamese line ≤ 140 chars pointing at the deciding constraint, never naming the key>
- family: <id>   (only for family questions, see §6)
- status: draft  (ALWAYS — the orchestrator activates after verification)
- created: 2026-10-22
- enriched: 2026-10-22
```
Do NOT write `time` (the validator fills it). Then a blank line, the stem, the options (`- A. …`), `**Answer:** B` or
`**Answer:** A, D`, then `**Explanation:** …`. Separate questions with a line `---` (blank line above it).

## 6. Families (qualifier reading)
Per agent: 2 families of 2–3 questions. Same scenario text and the SAME option set (identical text, identical order), only
the final question / qualifier differs (e.g. MOST cost-effective vs LEAST operational overhead vs MOST secure) and therefore
the key differs. Metadata `family: <kebab-id>` on each member. Each member must have a single defensible key for its own
qualifier.

## 7. Pack file
Path: /Users/ntq/Desktop/aws-co3-documents/trainer/bank/packs/ai/2026-10-22-tier-a-<task as x-y>-<slug>.md
(≤ 15 questions per pack; split a task into several packs if needed: add -p2, -p3).
```
---
pack: ai-2026-10-22-tier-a-<x-y>[-p2]
title: "AI · Tầng A · Task <x.y> — <chủ đề ngắn>"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương <x.y>"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task <x.y>"
---

# AI · Tầng A · Task <x.y> — <chủ đề ngắn>

## Q ai-20261022-a<xy>-01
…
```
Question ids: `ai-20261022-a<xy>-<nn>` (task 1.1 → a11, 4.4 → a44), nn = 01, 02… unique across your packs.

## 8. Process
1. Read: this spec; `trainer/bank/SCHEMA.md` §3–§6 (format + quality rules); the exam-guide bullets of your tasks in
   `trainer/bank/exam-guide/SAA-C03.yaml`; `trainer/bank/taxonomy.yaml` (topics, services names, features, `currency:`);
   the relevant notes; `trainer/coach/snapshot.md` §7/§9 (learner confusions).
2. Plan your questions so they cover EVERY exam-guide bullet (knowledge + skills) of your tasks at least once, prioritizing
   bullets that have no question yet (listed in your brief). Vary industries, scales and qualifiers; avoid near-duplicates of
   existing bank questions (grep `trainer/bank/packs/` for the main service/concept) and of each other.
3. Write the packs. Then validate each from /Users/ntq/Desktop/aws-co3-documents:
   `node trainer/scripts/validate.ts packs/ai/2026-10-22-tier-a-<x-y> --fill-time --lint`
   Fix every ❌ and every lint warning on your questions (longest-correct, stem-echo, absolute-terms, letter-ref,
   grammar-cue, overlapping-options, choose-count, oos-answer, stale-fact…). Re-run until clean.
4. Self-review each question as a skeptical examiner: exactly one defensible key (or exactly N); each distractor clearly
   wrong for its labelled reason; facts current; stem ≥ 55 words; options ≥ 8 words; criterion present; hint doesn't leak.
5. Do not touch any other file; no git; do not run the coach / AI commands.

## 9. Final report (≤ 200 words)
Pack files + question counts per task, multiple-response count, families, bullets covered, validator result, any question
you are unsure about (id + why).
