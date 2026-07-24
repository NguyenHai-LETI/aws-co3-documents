# 🔗 Practice Exam 07 — Application Integration (SAA-C03) · V2

**30 questions** · scenario-based · English. Answers in `07-application-integration-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q20
- **Part B — Khó / Nâng cao:** Q21–Q30

---

## Part A — Vận dụng (20 câu)

**1.** A web tier must decouple from a slower processing tier to absorb spikes and process work asynchronously. Which service?

- A. Amazon SQS
- B. Amazon SNS
- C. AWS Step Functions
- D. Amazon Kinesis

**2.** Order processing must preserve strict message order and process each message exactly once. Which SQS type?

- A. Standard queue
- B. FIFO queue
- C. SNS standard topic
- D. Kinesis stream

**3.** One event must be delivered to multiple subscribers (email, Lambda, SQS) simultaneously. Which pattern?

- A. SQS queue
- B. SNS fan-out to multiple subscribers
- C. Step Functions
- D. Kinesis

**4.** A consumer needs time to process an SQS message; other consumers must not see it during processing. Which setting?

- A. Delay seconds
- B. Visibility timeout
- C. Message retention
- D. Long polling

**5.** Messages that repeatedly fail processing must be moved aside for later analysis instead of blocking the queue. Which feature?

- A. Dead-letter queue (DLQ)
- B. Long polling
- C. FIFO
- D. Delay queue

**6.** To reduce empty SQS responses and cost while waiting for messages, which should be enabled?

- A. Short polling
- B. Long polling
- C. Delay seconds
- D. Visibility timeout increase

**7.** A serverless workflow must orchestrate multiple Lambda functions with branching, retries, and error handling. Which service?

- A. AWS Step Functions
- B. Amazon SQS
- C. Amazon SNS
- D. EventBridge only

**8.** An event-driven architecture must route events from many AWS services and SaaS apps to targets based on content rules. Which service?

- A. Amazon EventBridge
- B. Amazon SQS
- C. Amazon MQ
- D. AWS Batch

**9.** A company migrating from on-premises apps that use standard AMQP/MQTT messaging wants minimal code change. Which service?

- A. Amazon SQS
- B. Amazon MQ
- C. Amazon SNS
- D. EventBridge

**10.** SNS must deliver only messages matching certain attributes to a specific subscriber. Which feature?

- A. Message filtering (filter policies)
- B. FIFO
- C. DLQ
- D. Fan-out

**11.** A cron-like schedule must trigger a Lambda every 15 minutes with minimal setup. Which service?

- A. EventBridge Scheduler / scheduled rule
- B. SQS delay queue
- C. Step Functions
- D. SNS

**12.** SQS messages must be delayed 5 minutes before becoming available to consumers. Which setting?

- A. Visibility timeout
- B. Delay queue (DelaySeconds)
- C. Long polling
- D. Retention period

**13.** A workflow has thousands of short, high-volume state transitions per second at low cost. Which Step Functions type?

- A. Standard workflows
- B. Express workflows
- C. Activity workers only
- D. Standard with .sync

**14.** SNS + SQS fan-out: multiple queues subscribe to one topic so each service processes its own copy. What is the main benefit?

- A. Ordered processing
- B. Decoupled parallel processing with independent consumers
- C. Lower durability
- D. Synchronous responses

**15.** A message larger than the SQS 256 KB limit must be sent. Which approach?

- A. Split manually and hope
- B. SQS Extended Client Library storing payload in S3
- C. Use SNS instead
- D. Compress to under 256 KB always

**16.** EventBridge must trigger a target when an EC2 instance changes to "stopped" state. What is the source of this event?

- A. AWS service event (EC2 state-change) on the default event bus
- B. Custom event only
- C. CloudTrail data event only
- D. SQS message

**17.** A FIFO SQS queue must guarantee ordering only within a logical group while allowing parallelism across groups. Which attribute?

- A. MessageGroupId
- B. Visibility timeout
- C. DelaySeconds
- D. ReceiveCount

**18.** A decoupled system must retain messages up to 14 days if consumers are down. Which SQS setting controls this?

- A. Visibility timeout
- B. Message retention period
- C. Long polling
- D. Redrive policy

**19.** An application needs guaranteed at-least-once delivery and can tolerate occasional duplicates and out-of-order messages for maximum throughput. Which SQS type?

- A. FIFO queue
- B. Standard queue
- C. SNS FIFO
- D. Kinesis

**20.** A company wants point-to-point integration to pull from a source (SQS/Kinesis), optionally filter/enrich, and deliver to a target with minimal code. Which service?

- A. EventBridge Pipes
- B. Step Functions Standard
- C. SNS
- D. Amazon MQ

---

## Part B — Khó / Nâng cao (10 câu)

**21.** An SQS consumer sometimes takes longer than the visibility timeout, causing duplicate processing. Which two mitigations are appropriate? (Choose TWO)

- A. Increase the visibility timeout or extend it (ChangeMessageVisibility)
- B. Make processing idempotent
- C. Switch to short polling
- D. Reduce retention period
- E. Delete the DLQ

**22.** A fan-out design must guarantee ordered, deduplicated delivery to multiple consumers. Which combination?

- A. SNS Standard + SQS Standard
- B. SNS FIFO topic + SQS FIFO queues
- C. Kinesis + Lambda
- D. EventBridge + SQS Standard

**23.** A Step Functions workflow must wait for an external human approval that may take days, then continue. Which pattern?

- A. Express workflow with polling
- B. Standard workflow with a callback task (waitForTaskToken)
- C. SQS delay queue
- D. SNS retry

**24.** An event-driven pipeline must ensure that events failing all delivery attempts to a target are not lost. Which two EventBridge features help? (Choose TWO)

- A. Dead-letter queue on the target
- B. Retry policy with maximum attempts
- C. Short polling
- D. FIFO ordering
- E. Message group id

**25.** A company must throttle downstream calls: buffer bursts and process at a steady rate with Lambda. Which design is BEST?

- A. SNS directly to Lambda
- B. SQS as a buffer with Lambda event source mapping and controlled concurrency
- C. EventBridge to Lambda directly
- D. Step Functions Express only

**26.** A FIFO queue must avoid processing duplicate messages sent within a 5-minute window. Which mechanism handles this?

- A. Content-based deduplication / MessageDeduplicationId
- B. Visibility timeout
- C. DLQ
- D. Long polling

**27.** Sensitive PII flowing through SNS must be scanned and blocked/masked before delivery. Which feature?

- A. SNS message data protection (data protection policies)
- B. SNS filter policy
- C. SQS DLQ
- D. KMS only

**28.** A workflow orchestrating microservices needs exactly-once execution semantics, visual auditing, and long-running steps up to a year. Which service/type?

- A. Step Functions Standard workflows
- B. Step Functions Express workflows
- C. SQS FIFO
- D. EventBridge rules

**29.** An EventBridge rule must deliver events cross-account to another team's event bus. Which two are required? (Choose TWO)

- A. Resource-based policy on the target event bus allowing the source
- B. A rule with the target bus as target
- C. VPC peering
- D. SQS DLQ mandatory
- E. FIFO topic

**30.** A high-throughput ingestion needs ordered, replayable streaming to multiple independent consumers reading at their own pace, retaining data for hours. Which service (vs SQS)?

- A. Amazon SQS Standard
- B. Amazon Kinesis Data Streams
- C. Amazon SNS
- D. Amazon MQ
