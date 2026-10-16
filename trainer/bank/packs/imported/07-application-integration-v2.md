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
- topic: integration
- services: SQS
- tags: decoupling
- difficulty: medium
- time: 55
- source: practice-exams/07-application-integration-exam-v2.md#Q1

A web tier must decouple from a slower processing tier to absorb spikes and process work asynchronously. Which service?

- A. Amazon SQS
- B. Amazon SNS
- C. AWS Step Functions
- D. Amazon Kinesis

**Answer:** A

**Explanation:** Decouple + absorb spikes + async processing = Amazon SQS.

---

## Q 07-v2-02
- domain: resilient
- topic: integration
- services: SQS
- tags: sqs-fifo
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q2

Order processing must preserve strict message order and process each message exactly once. Which SQS type?

- A. Standard queue
- B. FIFO queue
- C. SNS standard topic
- D. Kinesis stream

**Answer:** B

**Explanation:** Strict ordering + exactly-once = SQS FIFO queue.

---

## Q 07-v2-03
- domain: resilient
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
- topic: integration
- services: SQS
- tags: sqs-visibility-timeout
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q4

A consumer needs time to process an SQS message; other consumers must not see it during processing. Which setting?

- A. Delay seconds
- B. Visibility timeout
- C. Message retention
- D. Long polling

**Answer:** B

**Explanation:** Hide message during processing = Visibility timeout.

---

## Q 07-v2-05
- domain: resilient
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
- topic: integration
- services: SQS
- tags: sqs-long-polling
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q6

To reduce empty SQS responses and cost while waiting for messages, which should be enabled?

- A. Short polling
- B. Long polling
- C. Delay seconds
- D. Visibility timeout increase

**Answer:** B

**Explanation:** Reduce empty responses/cost = Long polling.

---

## Q 07-v2-07
- domain: resilient
- topic: integration
- services: Step Functions, Lambda
- tags: orchestration
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q7

A serverless workflow must orchestrate multiple Lambda functions with branching, retries, and error handling. Which service?

- A. AWS Step Functions
- B. Amazon SQS
- C. Amazon SNS
- D. EventBridge only

**Answer:** A

**Explanation:** Orchestrate Lambdas with branching/retries = Step Functions.

---

## Q 07-v2-08
- domain: resilient
- topic: integration
- services: EventBridge
- tags: event-driven
- difficulty: medium
- time: 55
- source: practice-exams/07-application-integration-exam-v2.md#Q8

An event-driven architecture must route events from many AWS services and SaaS apps to targets based on content rules. Which service?

- A. Amazon EventBridge
- B. Amazon SQS
- C. Amazon MQ
- D. AWS Batch

**Answer:** A

**Explanation:** Content-based routing from AWS/SaaS events = EventBridge.

---

## Q 07-v2-09
- domain: resilient
- topic: integration
- services: Amazon MQ
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q9

A company migrating from on-premises apps that use standard AMQP/MQTT messaging wants minimal code change. Which service?

- A. Amazon SQS
- B. Amazon MQ
- C. Amazon SNS
- D. EventBridge

**Answer:** B

**Explanation:** Standard AMQP/MQTT with minimal change = Amazon MQ.

---

## Q 07-v2-10
- domain: resilient
- topic: integration
- services: SNS
- tags: sns-filtering
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q10

SNS must deliver only messages matching certain attributes to a specific subscriber. Which feature?

- A. Message filtering (filter policies)
- B. FIFO
- C. DLQ
- D. Fan-out

**Answer:** A

**Explanation:** Deliver only matching messages = SNS message filtering.

---

## Q 07-v2-11
- domain: resilient
- topic: integration
- services: EventBridge, Lambda
- tags: event-driven
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q11

A cron-like schedule must trigger a Lambda every 15 minutes with minimal setup. Which service?

- A. EventBridge Scheduler / scheduled rule
- B. SQS delay queue
- C. Step Functions
- D. SNS

**Answer:** A

**Explanation:** Cron trigger for Lambda = EventBridge Scheduler/scheduled rule.

---

## Q 07-v2-12
- domain: resilient
- topic: integration
- services: SQS
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q12

SQS messages must be delayed 5 minutes before becoming available to consumers. Which setting?

- A. Visibility timeout
- B. Delay queue (DelaySeconds)
- C. Long polling
- D. Retention period

**Answer:** B

**Explanation:** Delay availability of messages = Delay queue (DelaySeconds).

---

## Q 07-v2-13
- domain: resilient
- topic: integration
- services: Step Functions
- tags: orchestration
- difficulty: medium
- time: 55
- source: practice-exams/07-application-integration-exam-v2.md#Q13

A workflow has thousands of short, high-volume state transitions per second at low cost. Which Step Functions type?

- A. Standard workflows
- B. Express workflows
- C. Activity workers only
- D. Standard with .sync

**Answer:** B

**Explanation:** High-volume short transitions, low cost = Step Functions Express.

---

## Q 07-v2-14
- domain: resilient
- topic: integration
- services: SNS, SQS
- tags: fan-out, decoupling
- difficulty: medium
- time: 55
- source: practice-exams/07-application-integration-exam-v2.md#Q14

SNS + SQS fan-out: multiple queues subscribe to one topic so each service processes its own copy. What is the main benefit?

- A. Ordered processing
- B. Decoupled parallel processing with independent consumers
- C. Lower durability
- D. Synchronous responses

**Answer:** B

**Explanation:** Fan-out benefit = decoupled parallel processing with independent consumers.

---

## Q 07-v2-15
- domain: resilient
- topic: integration
- services: SQS, S3
- tags: sqs-large-messages
- difficulty: medium
- time: 55
- source: practice-exams/07-application-integration-exam-v2.md#Q15

A message larger than the SQS 256 KB limit must be sent. Which approach?

- A. Split manually and hope
- B. SQS Extended Client Library storing payload in S3
- C. Use SNS instead
- D. Compress to under 256 KB always

**Answer:** B

**Explanation:** Payload > 256 KB = SQS Extended Client Library (store in S3).

---

## Q 07-v2-16
- domain: resilient
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
- topic: integration
- services: SQS
- tags: sqs-fifo
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q17

A FIFO SQS queue must guarantee ordering only within a logical group while allowing parallelism across groups. Which attribute?

- A. MessageGroupId
- B. Visibility timeout
- C. DelaySeconds
- D. ReceiveCount

**Answer:** A

**Explanation:** Ordering within group, parallel across groups = MessageGroupId.

---

## Q 07-v2-18
- domain: resilient
- topic: integration
- services: SQS
- tags: decoupling
- difficulty: medium
- time: 55
- source: practice-exams/07-application-integration-exam-v2.md#Q18

A decoupled system must retain messages up to 14 days if consumers are down. Which SQS setting controls this?

- A. Visibility timeout
- B. Message retention period
- C. Long polling
- D. Redrive policy

**Answer:** B

**Explanation:** Retain messages up to 14 days = message retention period.

---

## Q 07-v2-19
- domain: performance
- topic: integration
- services: SQS
- difficulty: medium
- time: 50
- source: practice-exams/07-application-integration-exam-v2.md#Q19

An application needs guaranteed at-least-once delivery and can tolerate occasional duplicates and out-of-order messages for maximum throughput. Which SQS type?

- A. FIFO queue
- B. Standard queue
- C. SNS FIFO
- D. Kinesis

**Answer:** B

**Explanation:** At-least-once, high throughput, dup/out-of-order OK = Standard queue.

---

## Q 07-v2-20
- domain: resilient
- topic: integration
- services: EventBridge, SQS, Kinesis
- tags: event-driven
- difficulty: medium
- time: 55
- source: practice-exams/07-application-integration-exam-v2.md#Q20

A company wants point-to-point integration to pull from a source (SQS/Kinesis), optionally filter/enrich, and deliver to a target with minimal code. Which service?

- A. EventBridge Pipes
- B. Step Functions Standard
- C. SNS
- D. Amazon MQ

**Answer:** A

**Explanation:** Point-to-point source->filter/enrich->target, low code = EventBridge Pipes.

---

## Q 07-v2-21
- domain: resilient
- topic: integration
- services: SQS
- tags: sqs-visibility-timeout
- difficulty: hard
- time: 95
- source: practice-exams/07-application-integration-exam-v2.md#Q21

An SQS consumer sometimes takes longer than the visibility timeout, causing duplicate processing. Which two mitigations are appropriate? (Choose TWO)

- A. Increase the visibility timeout or extend it (ChangeMessageVisibility)
- B. Make processing idempotent
- C. Switch to short polling
- D. Reduce retention period
- E. Delete the DLQ

**Answer:** A, B

**Explanation:** Avoid duplicate processing = increase/extend visibility timeout + idempotent processing.

---

## Q 07-v2-22
- domain: resilient
- topic: integration
- services: SNS, SQS
- tags: fan-out, sqs-fifo
- difficulty: hard
- time: 70
- source: practice-exams/07-application-integration-exam-v2.md#Q22

A fan-out design must guarantee ordered, deduplicated delivery to multiple consumers. Which combination?

- A. SNS Standard + SQS Standard
- B. SNS FIFO topic + SQS FIFO queues
- C. Kinesis + Lambda
- D. EventBridge + SQS Standard

**Answer:** B

**Explanation:** Ordered + deduped fan-out = SNS FIFO + SQS FIFO.

---

## Q 07-v2-23
- domain: resilient
- topic: integration
- services: Step Functions
- tags: orchestration
- difficulty: hard
- time: 70
- source: practice-exams/07-application-integration-exam-v2.md#Q23

A Step Functions workflow must wait for an external human approval that may take days, then continue. Which pattern?

- A. Express workflow with polling
- B. Standard workflow with a callback task (waitForTaskToken)
- C. SQS delay queue
- D. SNS retry

**Answer:** B

**Explanation:** Wait for external approval for days = Standard workflow callback (waitForTaskToken).

---

## Q 07-v2-24
- domain: resilient
- topic: integration
- services: EventBridge
- tags: event-driven, sqs-dlq
- difficulty: hard
- time: 95
- source: practice-exams/07-application-integration-exam-v2.md#Q24

An event-driven pipeline must ensure that events failing all delivery attempts to a target are not lost. Which two EventBridge features help? (Choose TWO)

- A. Dead-letter queue on the target
- B. Retry policy with maximum attempts
- C. Short polling
- D. FIFO ordering
- E. Message group id

**Answer:** A, B

**Explanation:** Prevent event loss = target DLQ + retry policy with max attempts.

---

## Q 07-v2-25
- domain: resilient
- topic: integration
- services: SQS, Lambda
- difficulty: hard
- time: 75
- source: practice-exams/07-application-integration-exam-v2.md#Q25

A company must throttle downstream calls: buffer bursts and process at a steady rate with Lambda. Which design is BEST?

- A. SNS directly to Lambda
- B. SQS as a buffer with Lambda event source mapping and controlled concurrency
- C. EventBridge to Lambda directly
- D. Step Functions Express only

**Answer:** B

**Explanation:** Buffer bursts, steady processing = SQS buffer + Lambda ESM with controlled concurrency.

---

## Q 07-v2-26
- domain: resilient
- topic: integration
- tags: sqs-fifo
- difficulty: hard
- time: 65
- source: practice-exams/07-application-integration-exam-v2.md#Q26

A FIFO queue must avoid processing duplicate messages sent within a 5-minute window. Which mechanism handles this?

- A. Content-based deduplication / MessageDeduplicationId
- B. Visibility timeout
- C. DLQ
- D. Long polling

**Answer:** A

**Explanation:** FIFO dedup within 5 min = content-based dedup / MessageDeduplicationId.

---

## Q 07-v2-27
- domain: resilient
- topic: integration
- services: SNS
- difficulty: hard
- time: 70
- source: practice-exams/07-application-integration-exam-v2.md#Q27

Sensitive PII flowing through SNS must be scanned and blocked/masked before delivery. Which feature?

- A. SNS message data protection (data protection policies)
- B. SNS filter policy
- C. SQS DLQ
- D. KMS only

**Answer:** A

**Explanation:** Scan/mask PII in SNS = message data protection policies.

---

## Q 07-v2-28
- domain: resilient
- topic: integration
- services: Step Functions
- tags: orchestration, compliance
- difficulty: hard
- time: 70
- source: practice-exams/07-application-integration-exam-v2.md#Q28

A workflow orchestrating microservices needs exactly-once execution semantics, visual auditing, and long-running steps up to a year. Which service/type?

- A. Step Functions Standard workflows
- B. Step Functions Express workflows
- C. SQS FIFO
- D. EventBridge rules

**Answer:** A

**Explanation:** Exactly-once, auditable, up to 1 year = Step Functions Standard.

---

## Q 07-v2-29
- domain: resilient
- topic: integration
- services: EventBridge
- tags: cross-account-access, event-driven, iam-policies
- difficulty: hard
- time: 95
- source: practice-exams/07-application-integration-exam-v2.md#Q29

An EventBridge rule must deliver events cross-account to another team's event bus. Which two are required? (Choose TWO)

- A. Resource-based policy on the target event bus allowing the source
- B. A rule with the target bus as target
- C. VPC peering
- D. SQS DLQ mandatory
- E. FIFO topic

**Answer:** A, B

**Explanation:** Cross-account EventBridge = target bus resource policy allow + rule targeting that bus.

---

## Q 07-v2-30
- domain: performance
- topic: integration
- services: Kinesis Data Streams, SQS
- tags: streaming-ingestion
- difficulty: hard
- time: 70
- source: practice-exams/07-application-integration-exam-v2.md#Q30

A high-throughput ingestion needs ordered, replayable streaming to multiple independent consumers reading at their own pace, retaining data for hours. Which service (vs SQS)?

- A. Amazon SQS Standard
- B. Amazon Kinesis Data Streams
- C. Amazon SNS
- D. Amazon MQ

**Answer:** B

**Explanation:** Ordered, replayable, multi-consumer streaming with retention = Kinesis Data Streams.
