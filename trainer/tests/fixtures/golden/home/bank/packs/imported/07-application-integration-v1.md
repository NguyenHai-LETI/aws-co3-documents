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
- task: 2.1
- topic: integration
- services: SQS
- tags: decoupling
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q1

A web tier produces work faster than a processing tier can handle, causing dropped requests during spikes. Which service decouples them and buffers the load?

- A. Amazon SNS
- B. Amazon Kinesis Data Streams
- C. AWS Step Functions
- D. Amazon SQS

**Answer:** D

**Explanation:** Decouple + buffer spikes = Amazon SQS.

---

## Q 07-v1-02
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS
- tags: sqs-fifo
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q2

An order-processing system must process messages in EXACT order and guarantee no duplicates. Which SQS queue type?

- A. Delay queue
- B. Standard queue
- C. FIFO queue
- D. Dead-letter queue

**Answer:** C

**Explanation:** Exact order + no duplicates = SQS FIFO.

---

## Q 07-v1-03
- domain: resilient
- task: 2.1
- topic: integration
- services: S3, SNS, SQS
- tags: fan-out
- difficulty: easy
- time: 50
- source: practice-exams/07-application-integration-exam.md#Q3

When an S3 object is uploaded, three independent pipelines must each receive the event and process it in parallel. Which pattern is BEST?

- A. S3 → single SQS queue
- B. S3 → SNS topic → three SQS queues (fan-out)
- C. S3 → Kinesis Firehose
- D. S3 → Lambda only

**Answer:** B

**Explanation:** Parallel fan-out = S3 -> SNS -> multiple SQS queues.

---

## Q 07-v1-04
- domain: resilient
- task: 2.1
- topic: integration
- tags: sqs-dlq
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q4

Messages that repeatedly fail processing should be moved aside for later inspection instead of blocking the queue. Which feature?

- A. Dead-letter queue (DLQ)
- B. Visibility timeout
- C. Long polling
- D. Message filtering

**Answer:** A

**Explanation:** Isolate repeatedly failing messages = Dead-letter queue.

---

## Q 07-v1-05
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS
- tags: sqs-visibility-timeout
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q5

Which SQS setting prevents other consumers from receiving a message while it is being processed?

- A. Message retention period
- B. Delay seconds
- C. Visibility timeout
- D. Long polling wait time

**Answer:** C

**Explanation:** Hide in-flight message from other consumers = Visibility timeout.

---

## Q 07-v1-06
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS
- tags: sqs-long-polling
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q6

A company wants to reduce empty SQS receive responses and lower API costs. Which should be enabled?

- A. Long polling
- B. FIFO queue
- C. Delay queue
- D. Short polling

**Answer:** A

**Explanation:** Fewer empty receives, lower cost = Long polling.

---

## Q 07-v1-07
- domain: resilient
- task: 2.1
- topic: integration
- services: EventBridge
- tags: event-driven
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q7

An event-driven architecture must route AWS service events and third-party SaaS events to multiple targets based on event patterns. Which service?

- A. Amazon SQS
- B. AWS Step Functions
- C. Amazon MQ
- D. Amazon EventBridge

**Answer:** D

**Explanation:** Route AWS + SaaS events by pattern = EventBridge.

---

## Q 07-v1-08
- domain: resilient
- task: 2.1
- topic: integration
- services: Step Functions, Lambda
- tags: orchestration
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q8

A workflow must orchestrate multiple Lambda functions with branching, retries, and error handling, and may run for hours. Which service and type?

- A. SQS FIFO
- B. Step Functions Standard workflow
- C. Step Functions Express workflow
- D. EventBridge rules only

**Answer:** B

**Explanation:** Long-running orchestration with retries = Step Functions Standard.

---

## Q 07-v1-09
- domain: resilient
- task: 2.1
- topic: integration
- services: Amazon MQ
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q9

A company is migrating an on-premises application that uses industry-standard messaging protocols (AMQP, MQTT, STOMP) and wants minimal code changes. Which service?

- A. Amazon SQS
- B. Amazon SNS
- C. Amazon Kinesis
- D. Amazon MQ

**Answer:** D

**Explanation:** On-prem AMQP/MQTT/STOMP, minimal change = Amazon MQ.

---

## Q 07-v1-10
- domain: resilient
- task: 2.1
- topic: integration
- services: SNS
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q10

Which messaging pattern does Amazon SNS implement?

- A. Publish/subscribe push (1:many)
- B. Request/response
- C. Stream processing
- D. Pull-based queue (1:1)

**Answer:** A

**Explanation:** SNS = pub/sub push (1:many).

---

## Q 07-v1-11
- domain: resilient
- task: 2.1
- topic: integration
- services: SNS
- tags: sns-filtering
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q11

SNS subscribers should each receive only a subset of messages relevant to them based on message attributes. Which feature?

- A. Dead-letter queue
- B. Message filtering with filter policies
- C. FIFO topic
- D. Message deduplication

**Answer:** B

**Explanation:** Subset per subscriber = SNS message filtering policies.

---

## Q 07-v1-12
- domain: resilient
- task: 2.1
- topic: integration
- services: EventBridge, Lambda
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q12

A scheduled job must run a Lambda function every day at 2 AM UTC. Which is the simplest serverless approach?

- A. SQS delay queue
- B. Step Functions wait state loop
- C. EventBridge rule with a cron/schedule expression
- D. EC2 cron job

**Answer:** C

**Explanation:** Daily serverless schedule = EventBridge cron rule.

---

## Q 07-v1-13
- domain: performance
- task: 3.2
- topic: integration
- services: SQS
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q13

Which is TRUE about SQS Standard queues?

- A. Names must end with `.fifo`
- B. Limited to 300 TPS
- C. Guaranteed ordering and exactly-once
- D. Nearly unlimited throughput with at-least-once delivery

**Answer:** D

**Explanation:** Standard = high throughput, at-least-once.

---

## Q 07-v1-14
- domain: resilient
- task: 2.1
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
- task: 2.1
- topic: integration
- services: SQS, S3
- tags: sqs-large-messages
- difficulty: easy
- time: 50
- source: practice-exams/07-application-integration-exam.md#Q15

A producer must send messages larger than 256 KB through SQS. What is the recommended approach?

- A. Use the SQS Extended Client Library with payloads stored in S3
- B. Switch to SNS
- C. Use a FIFO queue
- D. Compress and hope it fits

**Answer:** A

**Explanation:** >256 KB messages = SQS Extended Client + S3.

---

## Q 07-v1-16
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS
- tags: decoupling, sqs-dlq
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q16

Which combination implements a durable, decoupled async architecture where a failed consumer does not lose messages?

- A. Direct Lambda invocation
- B. EventBridge bus only
- C. SQS queue with message retention and a DLQ
- D. SNS only

**Answer:** C

**Explanation:** Durable decoupling, no message loss = SQS with retention + DLQ.

---

## Q 07-v1-17
- domain: resilient
- task: 2.1
- topic: integration
- services: Step Functions
- tags: orchestration
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q17

A human-approval step is needed in an automated workflow before continuing. Which service supports waiting for an external callback/approval?

- A. Amazon MQ
- B. Amazon SQS FIFO
- C. AWS Step Functions (task token / wait for callback)
- D. Amazon SNS

**Answer:** C

**Explanation:** Wait for human approval/callback = Step Functions task token.

---

## Q 07-v1-18
- domain: resilient
- task: 2.1
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
- task: 2.1
- topic: integration
- services: SQS, Lambda, SNS
- difficulty: medium
- time: 70
- source: practice-exams/07-application-integration-exam.md#Q19

Which two are valid SNS subscriber/target types? (Choose TWO)

- A. Amazon EC2 instance store
- B. Amazon SQS queue
- C. Amazon VPC subnet
- D. Amazon EBS volume
- E. AWS Lambda function

**Answer:** B, E

**Explanation:** SNS targets include SQS and Lambda.

---

## Q 07-v1-20
- domain: resilient
- task: 2.1
- topic: integration
- services: Kinesis Data Streams
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/07-application-integration-exam.md#Q20

A streaming analytics pipeline must ingest high-volume, ordered records and allow multiple consumers to replay data within a retention window. Which service fits BEST?

- A. Amazon MQ
- B. Amazon Kinesis Data Streams
- C. Amazon SQS Standard
- D. Amazon SNS

**Answer:** B

**Explanation:** Ordered, high-volume, replayable streaming = Kinesis Data Streams.
