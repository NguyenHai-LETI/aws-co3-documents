---
pack: saa-07-application-integration-v1
title: 07 · Application Integration · V1
exam: SAA-C03
origin: imported
source: practice-exams/07-application-integration-exam.md
created: 2026-10-16
---

# 07 · Application Integration · V1

> Imported from `practice-exams/07-application-integration-exam.md` + `07-application-integration-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 07-v1-01
- domain: resilient
- topic: integration
- services: SQS
- tags: decoupling
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q1

A web tier produces work faster than a processing tier can handle, causing dropped requests during spikes. Which service decouples them and buffers the load?

- A. Amazon SNS
- B. Amazon SQS
- C. AWS Step Functions
- D. Amazon Kinesis Data Streams

**Answer:** B

**Explanation:** Decouple + buffer spikes = Amazon SQS.

---

## Q 07-v1-02
- domain: resilient
- topic: integration
- services: SQS
- tags: sqs-fifo
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q2

An order-processing system must process messages in EXACT order and guarantee no duplicates. Which SQS queue type?

- A. Standard queue
- B. FIFO queue
- C. Dead-letter queue
- D. Delay queue

**Answer:** B

**Explanation:** Exact order + no duplicates = SQS FIFO.

---

## Q 07-v1-03
- domain: resilient
- topic: integration
- services: S3, SNS, SQS
- tags: fan-out
- difficulty: easy
- time: 50
- source: practice-exams/07-application-integration-exam.md#Q3

When an S3 object is uploaded, three independent pipelines must each receive the event and process it in parallel. Which pattern is BEST?

- A. S3 → single SQS queue
- B. S3 → SNS topic → three SQS queues (fan-out)
- C. S3 → Lambda only
- D. S3 → Kinesis Firehose

**Answer:** B

**Explanation:** Parallel fan-out = S3 -> SNS -> multiple SQS queues.

---

## Q 07-v1-04
- domain: resilient
- topic: integration
- tags: sqs-dlq
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q4

Messages that repeatedly fail processing should be moved aside for later inspection instead of blocking the queue. Which feature?

- A. Visibility timeout
- B. Dead-letter queue (DLQ)
- C. Long polling
- D. Message filtering

**Answer:** B

**Explanation:** Isolate repeatedly failing messages = Dead-letter queue.

---

## Q 07-v1-05
- domain: resilient
- topic: integration
- services: SQS
- tags: sqs-visibility-timeout
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q5

Which SQS setting prevents other consumers from receiving a message while it is being processed?

- A. Message retention period
- B. Visibility timeout
- C. Delay seconds
- D. Long polling wait time

**Answer:** B

**Explanation:** Hide in-flight message from other consumers = Visibility timeout.

---

## Q 07-v1-06
- domain: resilient
- topic: integration
- services: SQS
- tags: sqs-long-polling
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q6

A company wants to reduce empty SQS receive responses and lower API costs. Which should be enabled?

- A. Short polling
- B. Long polling
- C. FIFO queue
- D. Delay queue

**Answer:** B

**Explanation:** Fewer empty receives, lower cost = Long polling.

---

## Q 07-v1-07
- domain: resilient
- topic: integration
- services: EventBridge
- tags: event-driven
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q7

An event-driven architecture must route AWS service events and third-party SaaS events to multiple targets based on event patterns. Which service?

- A. Amazon SQS
- B. Amazon EventBridge
- C. AWS Step Functions
- D. Amazon MQ

**Answer:** B

**Explanation:** Route AWS + SaaS events by pattern = EventBridge.

---

## Q 07-v1-08
- domain: resilient
- topic: integration
- services: Step Functions, Lambda
- tags: orchestration
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q8

A workflow must orchestrate multiple Lambda functions with branching, retries, and error handling, and may run for hours. Which service and type?

- A. Step Functions Standard workflow
- B. Step Functions Express workflow
- C. SQS FIFO
- D. EventBridge rules only

**Answer:** A

**Explanation:** Long-running orchestration with retries = Step Functions Standard.

---

## Q 07-v1-09
- domain: resilient
- topic: integration
- services: Amazon MQ
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q9

A company is migrating an on-premises application that uses industry-standard messaging protocols (AMQP, MQTT, STOMP) and wants minimal code changes. Which service?

- A. Amazon SQS
- B. Amazon SNS
- C. Amazon MQ
- D. Amazon Kinesis

**Answer:** C

**Explanation:** On-prem AMQP/MQTT/STOMP, minimal change = Amazon MQ.

---

## Q 07-v1-10
- domain: resilient
- topic: integration
- services: SNS
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q10

Which messaging pattern does Amazon SNS implement?

- A. Pull-based queue (1:1)
- B. Publish/subscribe push (1:many)
- C. Stream processing
- D. Request/response

**Answer:** B

**Explanation:** SNS = pub/sub push (1:many).

---

## Q 07-v1-11
- domain: resilient
- topic: integration
- services: SNS
- tags: sns-filtering
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q11

SNS subscribers should each receive only a subset of messages relevant to them based on message attributes. Which feature?

- A. Message filtering with filter policies
- B. Dead-letter queue
- C. FIFO topic
- D. Message deduplication

**Answer:** A

**Explanation:** Subset per subscriber = SNS message filtering policies.

---

## Q 07-v1-12
- domain: resilient
- topic: integration
- services: EventBridge, Lambda
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q12

A scheduled job must run a Lambda function every day at 2 AM UTC. Which is the simplest serverless approach?

- A. EC2 cron job
- B. EventBridge rule with a cron/schedule expression
- C. SQS delay queue
- D. Step Functions wait state loop

**Answer:** B

**Explanation:** Daily serverless schedule = EventBridge cron rule.

---

## Q 07-v1-13
- domain: performance
- topic: integration
- services: SQS
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q13

Which is TRUE about SQS Standard queues?

- A. Guaranteed ordering and exactly-once
- B. Nearly unlimited throughput with at-least-once delivery
- C. Limited to 300 TPS
- D. Names must end with `.fifo`

**Answer:** B

**Explanation:** Standard = high throughput, at-least-once.

---

## Q 07-v1-14
- domain: resilient
- topic: integration
- services: SNS
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q14

A retail app must send order confirmations via email and SMS to customers. Which service handles multi-protocol notifications natively?

- A. Amazon SQS
- B. Amazon SNS
- C. AWS Step Functions
- D. Amazon EventBridge

**Answer:** B

**Explanation:** Email + SMS notifications = Amazon SNS.

---

## Q 07-v1-15
- domain: resilient
- topic: integration
- services: SQS, S3
- tags: sqs-large-messages
- difficulty: easy
- time: 50
- source: practice-exams/07-application-integration-exam.md#Q15

A producer must send messages larger than 256 KB through SQS. What is the recommended approach?

- A. Compress and hope it fits
- B. Use the SQS Extended Client Library with payloads stored in S3
- C. Switch to SNS
- D. Use a FIFO queue

**Answer:** B

**Explanation:** >256 KB messages = SQS Extended Client + S3.

---

## Q 07-v1-16
- domain: resilient
- topic: integration
- services: SQS
- tags: decoupling, sqs-dlq
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q16

Which combination implements a durable, decoupled async architecture where a failed consumer does not lose messages?

- A. SNS only
- B. SQS queue with message retention and a DLQ
- C. EventBridge bus only
- D. Direct Lambda invocation

**Answer:** B

**Explanation:** Durable decoupling, no message loss = SQS with retention + DLQ.

---

## Q 07-v1-17
- domain: resilient
- topic: integration
- services: Step Functions
- tags: orchestration
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q17

A human-approval step is needed in an automated workflow before continuing. Which service supports waiting for an external callback/approval?

- A. AWS Step Functions (task token / wait for callback)
- B. Amazon SQS FIFO
- C. Amazon SNS
- D. Amazon MQ

**Answer:** A

**Explanation:** Wait for human approval/callback = Step Functions task token.

---

## Q 07-v1-18
- domain: resilient
- topic: integration
- services: AppFlow, S3, Redshift
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q18

Which service is BEST to integrate SaaS data (e.g., Salesforce) into Amazon S3 or Redshift without writing custom code?

- A. AWS AppFlow
- B. Amazon EventBridge
- C. Amazon MQ
- D. AWS DataSync

**Answer:** A

**Explanation:** SaaS (Salesforce) to S3/Redshift no-code = AWS AppFlow.

---

## Q 07-v1-19
- domain: resilient
- topic: integration
- services: SQS, Lambda, SNS
- difficulty: medium
- time: 70
- source: practice-exams/07-application-integration-exam.md#Q19

Which two are valid SNS subscriber/target types? (Choose TWO)

- A. Amazon SQS queue
- B. AWS Lambda function
- C. Amazon EBS volume
- D. Amazon EC2 instance store
- E. Amazon VPC subnet

**Answer:** A, B

**Explanation:** SNS targets include SQS and Lambda.

---

## Q 07-v1-20
- domain: resilient
- topic: integration
- services: Kinesis Data Streams
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q20

A streaming analytics pipeline must ingest high-volume, ordered records and allow multiple consumers to replay data within a retention window. Which service fits BEST?

- A. Amazon SQS Standard
- B. Amazon Kinesis Data Streams
- C. Amazon SNS
- D. Amazon MQ

**Answer:** B

**Explanation:** Ordered, high-volume, replayable streaming = Kinesis Data Streams.
