# 🔗 Practice Exam 07 — Application Integration (SAA-C03)

20 questions · scenario-based · English. Answers in `07-application-integration-answers.txt`.

---

**1.** A web tier produces work faster than a processing tier can handle, causing dropped requests during spikes. Which service decouples them and buffers the load?

- A. Amazon SNS
- B. Amazon SQS
- C. AWS Step Functions
- D. Amazon Kinesis Data Streams

**2.** An order-processing system must process messages in EXACT order and guarantee no duplicates. Which SQS queue type?

- A. Standard queue
- B. FIFO queue
- C. Dead-letter queue
- D. Delay queue

**3.** When an S3 object is uploaded, three independent pipelines must each receive the event and process it in parallel. Which pattern is BEST?

- A. S3 → single SQS queue
- B. S3 → SNS topic → three SQS queues (fan-out)
- C. S3 → Lambda only
- D. S3 → Kinesis Firehose

**4.** Messages that repeatedly fail processing should be moved aside for later inspection instead of blocking the queue. Which feature?

- A. Visibility timeout
- B. Dead-letter queue (DLQ)
- C. Long polling
- D. Message filtering

**5.** Which SQS setting prevents other consumers from receiving a message while it is being processed?

- A. Message retention period
- B. Visibility timeout
- C. Delay seconds
- D. Long polling wait time

**6.** A company wants to reduce empty SQS receive responses and lower API costs. Which should be enabled?

- A. Short polling
- B. Long polling
- C. FIFO queue
- D. Delay queue

**7.** An event-driven architecture must route AWS service events and third-party SaaS events to multiple targets based on event patterns. Which service?

- A. Amazon SQS
- B. Amazon EventBridge
- C. AWS Step Functions
- D. Amazon MQ

**8.** A workflow must orchestrate multiple Lambda functions with branching, retries, and error handling, and may run for hours. Which service and type?

- A. Step Functions Standard workflow
- B. Step Functions Express workflow
- C. SQS FIFO
- D. EventBridge rules only

**9.** A company is migrating an on-premises application that uses industry-standard messaging protocols (AMQP, MQTT, STOMP) and wants minimal code changes. Which service?

- A. Amazon SQS
- B. Amazon SNS
- C. Amazon MQ
- D. Amazon Kinesis

**10.** Which messaging pattern does Amazon SNS implement?

- A. Pull-based queue (1:1)
- B. Publish/subscribe push (1:many)
- C. Stream processing
- D. Request/response

**11.** SNS subscribers should each receive only a subset of messages relevant to them based on message attributes. Which feature?

- A. Message filtering with filter policies
- B. Dead-letter queue
- C. FIFO topic
- D. Message deduplication

**12.** A scheduled job must run a Lambda function every day at 2 AM UTC. Which is the simplest serverless approach?

- A. EC2 cron job
- B. EventBridge rule with a cron/schedule expression
- C. SQS delay queue
- D. Step Functions wait state loop

**13.** Which is TRUE about SQS Standard queues?

- A. Guaranteed ordering and exactly-once
- B. Nearly unlimited throughput with at-least-once delivery
- C. Limited to 300 TPS
- D. Names must end with `.fifo`

**14.** A retail app must send order confirmations via email and SMS to customers. Which service handles multi-protocol notifications natively?

- A. Amazon SQS
- B. Amazon SNS
- C. AWS Step Functions
- D. Amazon EventBridge

**15.** A producer must send messages larger than 256 KB through SQS. What is the recommended approach?

- A. Compress and hope it fits
- B. Use the SQS Extended Client Library with payloads stored in S3
- C. Switch to SNS
- D. Use a FIFO queue

**16.** Which combination implements a durable, decoupled async architecture where a failed consumer does not lose messages?

- A. SNS only
- B. SQS queue with message retention and a DLQ
- C. EventBridge bus only
- D. Direct Lambda invocation

**17.** A human-approval step is needed in an automated workflow before continuing. Which service supports waiting for an external callback/approval?

- A. AWS Step Functions (task token / wait for callback)
- B. Amazon SQS FIFO
- C. Amazon SNS
- D. Amazon MQ

**18.** Which service is BEST to integrate SaaS data (e.g., Salesforce) into Amazon S3 or Redshift without writing custom code?

- A. AWS AppFlow
- B. Amazon EventBridge
- C. Amazon MQ
- D. AWS DataSync

**19.** Which two are valid SNS subscriber/target types? (Choose TWO)

- A. Amazon SQS queue
- B. AWS Lambda function
- C. Amazon EBS volume
- D. Amazon EC2 instance store
- E. Amazon VPC subnet

**20.** A streaming analytics pipeline must ingest high-volume, ordered records and allow multiple consumers to replay data within a retention window. Which service fits BEST?

- A. Amazon SQS Standard
- B. Amazon Kinesis Data Streams
- C. Amazon SNS
- D. Amazon MQ
