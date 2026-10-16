---
pack: saa-07-application-integration-v2
title: 07 · Application Integration · V2
exam: SAA-C03
origin: imported
source: practice-exams/07-application-integration-exam-v2.md
created: 2026-10-16
---

# 07 · Application Integration · V2

> Imported from `practice-exams/07-application-integration-exam-v2.md` + `07-application-integration-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 07-v2-01
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS
- tags: decoupling
- difficulty: medium
- time: 55
- source: practice-exams/07-application-integration-exam-v2.md#Q1

A web tier must decouple from a slower processing tier to absorb spikes and process work asynchronously. Which service?

- A. Amazon Kinesis
- B. Amazon SQS
- C. Amazon SNS
- D. AWS Step Functions

**Answer:** B

**Explanation:** Decouple + absorb spikes + async processing = Amazon SQS.

---

## Q 07-v2-02
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS
- tags: sqs-fifo
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q2

Order processing must preserve strict message order and process each message exactly once. Which SQS type?

- A. Standard queue
- B. SNS standard topic
- C. FIFO queue
- D. Kinesis stream

**Answer:** C

**Explanation:** Strict ordering + exactly-once = SQS FIFO queue.

---

## Q 07-v2-03
- domain: resilient
- task: 2.1
- topic: integration
- services: SNS, Lambda, SQS
- tags: fan-out
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q3

One event must be delivered to multiple subscribers (email, Lambda, SQS) simultaneously. Which pattern?

- A. SQS queue
- B. SNS fan-out to multiple subscribers
- C. Step Functions
- D. Kinesis

**Answer:** B

**Explanation:** One event to many subscribers = SNS fan-out.

---

## Q 07-v2-04
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS
- tags: sqs-visibility-timeout
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q4

A consumer needs time to process an SQS message; other consumers must not see it during processing. Which setting?

- A. Long polling
- B. Message retention
- C. Visibility timeout
- D. Delay seconds

**Answer:** C

**Explanation:** Hide message during processing = Visibility timeout.

---

## Q 07-v2-05
- domain: resilient
- task: 2.1
- topic: integration
- tags: sqs-dlq
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q5

Messages that repeatedly fail processing must be moved aside for later analysis instead of blocking the queue. Which feature?

- A. Dead-letter queue (DLQ)
- B. Long polling
- C. FIFO
- D. Delay queue

**Answer:** A

**Explanation:** Isolate repeatedly failing messages = Dead-letter queue.

---

## Q 07-v2-06
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS
- tags: sqs-long-polling
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q6

To reduce empty SQS responses and cost while waiting for messages, which should be enabled?

- A. Delay seconds
- B. Short polling
- C. Long polling
- D. Visibility timeout increase

**Answer:** C

**Explanation:** Reduce empty responses/cost = Long polling.

---

## Q 07-v2-07
- domain: resilient
- task: 2.1
- topic: integration
- services: Step Functions, Lambda
- tags: orchestration
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q7

A serverless workflow must orchestrate multiple Lambda functions with branching, retries, and error handling. Which service?

- A. Amazon SQS
- B. AWS Step Functions
- C. Amazon SNS
- D. EventBridge only

**Answer:** B

**Explanation:** Orchestrate Lambdas with branching/retries = Step Functions.

---

## Q 07-v2-08
- domain: resilient
- task: 2.1
- topic: integration
- services: EventBridge
- tags: event-driven
- difficulty: medium
- time: 55
- source: practice-exams/07-application-integration-exam-v2.md#Q8

An event-driven architecture must route events from many AWS services and SaaS apps to targets based on content rules. Which service?

- A. Amazon SQS
- B. AWS Batch
- C. Amazon MQ
- D. Amazon EventBridge

**Answer:** D

**Explanation:** Content-based routing from AWS/SaaS events = EventBridge.

---

## Q 07-v2-09
- domain: resilient
- task: 2.1
- topic: integration
- services: Amazon MQ
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q9

A company migrating from on-premises apps that use standard AMQP/MQTT messaging wants minimal code change. Which service?

- A. Amazon MQ
- B. EventBridge
- C. Amazon SQS
- D. Amazon SNS

**Answer:** A

**Explanation:** Standard AMQP/MQTT with minimal change = Amazon MQ.

---

## Q 07-v2-10
- domain: resilient
- task: 2.1
- topic: integration
- services: SNS
- tags: sns-filtering
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q10

SNS must deliver only messages matching certain attributes to a specific subscriber. Which feature?

- A. DLQ
- B. Fan-out
- C. FIFO
- D. Message filtering (filter policies)

**Answer:** D

**Explanation:** Deliver only matching messages = SNS message filtering.

---

## Q 07-v2-11
- domain: resilient
- task: 2.1
- topic: integration
- services: EventBridge, Lambda
- tags: event-driven
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q11

A cron-like schedule must trigger a Lambda every 15 minutes with minimal setup. Which service?

- A. SNS
- B. SQS delay queue
- C. Step Functions
- D. EventBridge Scheduler / scheduled rule

**Answer:** D

**Explanation:** Cron trigger for Lambda = EventBridge Scheduler/scheduled rule.

---

## Q 07-v2-12
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q12

SQS messages must be delayed 5 minutes before becoming available to consumers. Which setting?

- A. Long polling
- B. Visibility timeout
- C. Retention period
- D. Delay queue (DelaySeconds)

**Answer:** D

**Explanation:** Delay availability of messages = Delay queue (DelaySeconds).

---

## Q 07-v2-13
- domain: resilient
- task: 2.1
- topic: integration
- services: Step Functions
- tags: orchestration
- difficulty: medium
- time: 55
- source: practice-exams/07-application-integration-exam-v2.md#Q13

A workflow has thousands of short, high-volume state transitions per second at low cost. Which Step Functions type?

- A. Express workflows
- B. Activity workers only
- C. Standard workflows
- D. Standard with .sync

**Answer:** A

**Explanation:** High-volume short transitions, low cost = Step Functions Express.

---

## Q 07-v2-14
- domain: resilient
- task: 2.1
- topic: integration
- services: SNS, SQS
- tags: fan-out, decoupling
- difficulty: medium
- time: 55
- source: practice-exams/07-application-integration-exam-v2.md#Q14

SNS + SQS fan-out: multiple queues subscribe to one topic so each service processes its own copy. What is the main benefit?

- A. Synchronous responses
- B. Lower durability
- C. Decoupled parallel processing with independent consumers
- D. Ordered processing

**Answer:** C

**Explanation:** Fan-out benefit = decoupled parallel processing with independent consumers.

---

## Q 07-v2-15
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS, S3
- tags: sqs-large-messages
- difficulty: medium
- time: 55
- source: practice-exams/07-application-integration-exam-v2.md#Q15

A message larger than the SQS 256 KB limit must be sent. Which approach?

- A. Compress to under 256 KB always
- B. SQS Extended Client Library storing payload in S3
- C. Use SNS instead
- D. Split manually and hope

**Answer:** B

**Explanation:** Payload > 256 KB = SQS Extended Client Library (store in S3).

---

## Q 07-v2-16
- domain: resilient
- task: 2.1
- topic: integration
- services: EC2, EventBridge
- tags: event-driven
- difficulty: medium
- time: 60
- source: practice-exams/07-application-integration-exam-v2.md#Q16

EventBridge must trigger a target when an EC2 instance changes to "stopped" state. What is the source of this event?

- A. AWS service event (EC2 state-change) on the default event bus
- B. Custom event only
- C. CloudTrail data event only
- D. SQS message

**Answer:** A

**Explanation:** EC2 state-change event = AWS service event on default event bus.

---

## Q 07-v2-17
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS
- tags: sqs-fifo
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q17

A FIFO SQS queue must guarantee ordering only within a logical group while allowing parallelism across groups. Which attribute?

- A. Visibility timeout
- B. ReceiveCount
- C. MessageGroupId
- D. DelaySeconds

**Answer:** C

**Explanation:** Ordering within group, parallel across groups = MessageGroupId.

---

## Q 07-v2-18
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS
- tags: decoupling
- difficulty: medium
- time: 55
- source: practice-exams/07-application-integration-exam-v2.md#Q18

A decoupled system must retain messages up to 14 days if consumers are down. Which SQS setting controls this?

- A. Visibility timeout
- B. Message retention period
- C. Redrive policy
- D. Long polling

**Answer:** B

**Explanation:** Retain messages up to 14 days = message retention period.

---

## Q 07-v2-19
- domain: performance
- task: 3.2
- topic: integration
- services: SQS
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q19

An application needs guaranteed at-least-once delivery and can tolerate occasional duplicates and out-of-order messages for maximum throughput. Which SQS type?

- A. Standard queue
- B. FIFO queue
- C. Kinesis
- D. SNS FIFO

**Answer:** A

**Explanation:** At-least-once, high throughput, dup/out-of-order OK = Standard queue.

---

## Q 07-v2-20
- domain: resilient
- task: 2.1
- topic: integration
- services: EventBridge, SQS, Kinesis
- tags: event-driven
- difficulty: medium
- time: 55
- source: practice-exams/07-application-integration-exam-v2.md#Q20

A company wants point-to-point integration to pull from a source (SQS/Kinesis), optionally filter/enrich, and deliver to a target with minimal code. Which service?

- A. Amazon MQ
- B. EventBridge Pipes
- C. SNS
- D. Step Functions Standard

**Answer:** B

**Explanation:** Point-to-point source->filter/enrich->target, low code = EventBridge Pipes.

---

## Q 07-v2-21
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS
- tags: sqs-visibility-timeout
- difficulty: hard
- time: 95
- source: practice-exams/07-application-integration-exam-v2.md#Q21

An SQS consumer sometimes takes longer than the visibility timeout, causing duplicate processing. Which two mitigations are appropriate? (Choose TWO)

- A. Make processing idempotent
- B. Delete the DLQ
- C. Reduce retention period
- D. Increase the visibility timeout or extend it (ChangeMessageVisibility)
- E. Switch to short polling

**Answer:** A, D

**Explanation:** Avoid duplicate processing = increase/extend visibility timeout + idempotent processing.

---

## Q 07-v2-22
- domain: resilient
- task: 2.1
- topic: integration
- services: SNS, SQS
- tags: fan-out, sqs-fifo
- difficulty: hard
- time: 70
- source: practice-exams/07-application-integration-exam-v2.md#Q22

A fan-out design must guarantee ordered, deduplicated delivery to multiple consumers. Which combination?

- A. EventBridge + SQS Standard
- B. Kinesis + Lambda
- C. SNS Standard + SQS Standard
- D. SNS FIFO topic + SQS FIFO queues

**Answer:** D

**Explanation:** Ordered + deduped fan-out = SNS FIFO + SQS FIFO.

---

## Q 07-v2-23
- domain: resilient
- task: 2.1
- topic: integration
- services: Step Functions
- tags: orchestration
- difficulty: hard
- time: 70
- source: practice-exams/07-application-integration-exam-v2.md#Q23

A Step Functions workflow must wait for an external human approval that may take days, then continue. Which pattern?

- A. Standard workflow with a callback task (waitForTaskToken)
- B. Express workflow with polling
- C. SQS delay queue
- D. SNS retry

**Answer:** A

**Explanation:** Wait for external approval for days = Standard workflow callback (waitForTaskToken).

---

## Q 07-v2-24
- domain: resilient
- task: 2.1
- topic: integration
- services: EventBridge
- tags: event-driven, sqs-dlq
- difficulty: hard
- time: 95
- source: practice-exams/07-application-integration-exam-v2.md#Q24

An event-driven pipeline must ensure that events failing all delivery attempts to a target are not lost. Which two EventBridge features help? (Choose TWO)

- A. Dead-letter queue on the target
- B. Message group id
- C. FIFO ordering
- D. Short polling
- E. Retry policy with maximum attempts

**Answer:** A, E

**Explanation:** Prevent event loss = target DLQ + retry policy with max attempts.

---

## Q 07-v2-25
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS, Lambda
- difficulty: hard
- time: 75
- source: practice-exams/07-application-integration-exam-v2.md#Q25

A company must throttle downstream calls: buffer bursts and process at a steady rate with Lambda. Which design is BEST?

- A. Step Functions Express only
- B. SQS as a buffer with Lambda event source mapping and controlled concurrency
- C. SNS directly to Lambda
- D. EventBridge to Lambda directly

**Answer:** B

**Explanation:** Buffer bursts, steady processing = SQS buffer + Lambda ESM with controlled concurrency.

---

## Q 07-v2-26
- domain: resilient
- task: 2.1
- topic: integration
- tags: sqs-fifo
- difficulty: hard
- time: 65
- source: practice-exams/07-application-integration-exam-v2.md#Q26

A FIFO queue must avoid processing duplicate messages sent within a 5-minute window. Which mechanism handles this?

- A. Long polling
- B. DLQ
- C. Content-based deduplication / MessageDeduplicationId
- D. Visibility timeout

**Answer:** C

**Explanation:** FIFO dedup within 5 min = content-based dedup / MessageDeduplicationId.

---

## Q 07-v2-27
- domain: resilient
- task: 2.1
- topic: integration
- services: SNS
- difficulty: hard
- time: 70
- source: practice-exams/07-application-integration-exam-v2.md#Q27

Sensitive PII flowing through SNS must be scanned and blocked/masked before delivery. Which feature?

- A. SQS DLQ
- B. SNS filter policy
- C. KMS only
- D. SNS message data protection (data protection policies)

**Answer:** D

**Explanation:** Scan/mask PII in SNS = message data protection policies.

---

## Q 07-v2-28
- domain: resilient
- task: 2.1
- topic: integration
- services: Step Functions
- tags: orchestration, compliance
- difficulty: hard
- time: 70
- source: practice-exams/07-application-integration-exam-v2.md#Q28

A workflow orchestrating microservices needs exactly-once execution semantics, visual auditing, and long-running steps up to a year. Which service/type?

- A. EventBridge rules
- B. SQS FIFO
- C. Step Functions Standard workflows
- D. Step Functions Express workflows

**Answer:** C

**Explanation:** Exactly-once, auditable, up to 1 year = Step Functions Standard.

---

## Q 07-v2-29
- domain: resilient
- task: 2.1
- topic: integration
- services: EventBridge
- tags: cross-account-access, event-driven, iam-policies
- difficulty: hard
- time: 95
- source: practice-exams/07-application-integration-exam-v2.md#Q29

An EventBridge rule must deliver events cross-account to another team's event bus. Which two are required? (Choose TWO)

- A. FIFO topic
- B. Resource-based policy on the target event bus allowing the source
- C. SQS DLQ mandatory
- D. VPC peering
- E. A rule with the target bus as target

**Answer:** B, E

**Explanation:** Cross-account EventBridge = target bus resource policy allow + rule targeting that bus.

---

## Q 07-v2-30
- domain: performance
- task: 3.5
- topic: integration
- services: Kinesis Data Streams, SQS
- tags: streaming-ingestion
- difficulty: hard
- time: 70
- source: practice-exams/07-application-integration-exam-v2.md#Q30

A high-throughput ingestion needs ordered, replayable streaming to multiple independent consumers reading at their own pace, retaining data for hours. Which service (vs SQS)?

- A. Amazon SQS Standard
- B. Amazon MQ
- C. Amazon SNS
- D. Amazon Kinesis Data Streams

**Answer:** D

**Explanation:** Ordered, replayable, multi-consumer streaming with retention = Kinesis Data Streams.
