---
pack: ai-2026-10-22-tier-a-2-1
title: "AI · Tầng A · Task 2.1 — Tách rời: hàng đợi, pub/sub, sự kiện và workflow"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 2.1"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 2.1"
---

# AI · Tầng A · Task 2.1 — Tách rời: hàng đợi, pub/sub, sự kiện và workflow

## Q ai-20261022-a21-01
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS, Kinesis Data Streams
- tags: sqs-fifo, decoupling
- difficulty: medium
- time: 135
- skills: 2.1.k11, 2.1.s3
- concept: SQS FIFO with a message group ID per entity keeps order inside each group, drops duplicate sends, and still lets many consumers work on different groups in parallel
- refs: 07-application-integration.md
- hint: Thứ tự chỉ cần đúng trong từng tài khoản và gửi lại không được xử lý hai lần — loại hàng đợi nào cho nhóm tin nhắn chạy song song?
- created: 2026-10-22
- enriched: 2026-10-22

A payments company ingests transaction events from its mobile app and processes them with a fleet of worker instances. Events for the same customer account must be processed in the exact order they were sent, but events for different accounts can be processed in parallel. The app sometimes retries a send after a network timeout, and a retried event must not be processed twice. The company expects steady growth and wants to add workers without code changes. Which solution will meet these requirements?

- A. Send events to an Amazon SQS FIFO queue, use the account ID as the message group ID, enable content-based deduplication, and run multiple consumers on the queue.
- B. Send events to an Amazon SQS FIFO queue, use a random UUID as the message group ID of each event, enable content-based deduplication, and run multiple consumers on the queue.
- C. Send events to an Amazon Kinesis data stream with the account ID as the partition key, and run one consumer for each shard so that the shards are processed in parallel.
- D. Send events to an Amazon SQS FIFO queue, use the account ID as the message group ID, set a new random deduplication ID on every send attempt, and run multiple consumers.

**Answer:** A

**Explanation:** FIFO keeps order within a message group and drops duplicate sends, and the account ID as group ID still allows parallel processing across accounts.
- Random group ID for each event: maximizes parallelism but loses the per-account order (vi phạm ràng buộc)
- Kinesis stream keyed by account ID: keeps per-account order, but a retried put is stored as a second record and processed twice (vi phạm ràng buộc)
- New random deduplication ID per attempt: every retry looks like a new message, so a retried event is processed twice (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-fifo-queues.html
> 🇻🇳 Cần thứ tự theo từng tài khoản + chống gửi trùng + song song giữa các tài khoản → SQS FIFO với MessageGroupId = account ID.

---

## Q ai-20261022-a21-02
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS, EC2
- tags: sqs-visibility-timeout, sqs-long-polling
- difficulty: hard
- time: 145
- skills: 2.1.k11, 2.1.k2
- concept: For mixed short and very long jobs, keep the SQS visibility timeout short and extend it per message with ChangeMessageVisibility while a job still runs
- refs: 07-application-integration.md
- hint: Việc ngắn lẫn việc rất dài, worker hỏng thì tin phải hiện lại nhanh — chỉnh thời gian ẩn một lần cho cả queue có đủ không?
- created: 2026-10-22
- enriched: 2026-10-22

An engineering firm renders CAD files with worker instances that poll an Amazon SQS standard queue. Most render jobs finish within a minute, but a few large jobs run for up to 40 minutes. With the default visibility timeout, a large job's message becomes visible again and a second worker renders the same file. The firm raised the visibility timeout to the 12-hour maximum, but now messages from crashed workers stay hidden for hours, and customers wait too long for their renders. Which solution will fix both problems?

- A. Set the queue's visibility timeout to 45 minutes, just above the longest render job, so that no message becomes visible again while a worker still renders it.
- B. Convert the queue to an SQS FIFO queue and use each file name as the message group ID so that one worker at a time renders a given file.
- C. Set a short visibility timeout on the queue and have each worker call ChangeMessageVisibility periodically while a render job is still running.
- D. Keep the default visibility timeout and have each worker call ChangeMessageVisibility with a value of zero whenever a render job fails, so the job is retried quickly.

**Answer:** C

**Explanation:** A short timeout lets messages from crashed workers reappear quickly, and a worker still rendering extends the timeout of its own message, so only long jobs stay hidden.
- 45-minute visibility timeout: stops duplicate renders, but a crashed worker's message still stays hidden for up to 45 minutes (vi phạm ràng buộc)
- FIFO queue with a group per file: an in-flight message still becomes visible again when the timeout expires, so a long job is received twice (dùng sai tính năng)
- Zero timeout on failure: speeds up retries of failed jobs but does nothing for long jobs that outlast the default timeout (giải bài toán khác)
Docs: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
> 🇻🇳 Job dài ngắn lẫn lộn → visibility timeout ngắn + "heartbeat" ChangeMessageVisibility; timeout 12 giờ làm tin của worker hỏng ẩn quá lâu.

---

## Q ai-20261022-a21-03
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS
- tags: sqs-dlq, decoupling
- difficulty: medium
- time: 150
- skills: 2.1.k11, 2.1.k2
- concept: A redrive policy with a maximum receive count sends poison messages to a same-type DLQ, whose retention must exceed the source queue's because the original enqueue time is kept
- refs: 07-application-integration.md
- hint: Tin lỗi phải tự được cô lập và còn đủ lâu để xem — DLQ phải cùng loại với queue gốc và thời gian lưu tính từ lúc nào?
- created: 2026-10-22
- enriched: 2026-10-22

A streaming-video company processes upload notifications from an Amazon SQS standard queue by using a fleet of consumers. Some messages are malformed and fail on every attempt, so consumers keep retrying them and waste capacity. The operations team wants messages that fail repeatedly to be set aside automatically and wants a full week to inspect each one afterward, even though the source queue keeps messages for only four days. Which combination of actions will meet these requirements? (Choose TWO)

- A. Set the message retention period of the source queue to 14 days so that messages that keep failing remain available for a full week of inspection.
- B. Create a standard SQS queue as the dead-letter queue and add a redrive policy with a maximum receive count to the source queue.
- C. Enable a redrive allow policy on the dead-letter queue and start a dead-letter queue redrive that moves failed messages back to the source SQS queue.
- D. Set the message retention period of the dead-letter queue to a value that is longer than the retention period of the source queue.
- E. Create the standard dead-letter queue in a second AWS Region so that the failed messages are isolated from the production queue and its consumers.

**Answer:** B, D

**Explanation:** A redrive policy moves a message to a dead-letter queue after repeated failed receives, and because the message keeps its original enqueue time, the dead-letter queue needs longer retention than the source queue.
- Longer source retention: failing messages stay in the source queue and keep being retried, so nothing sets them aside (giải bài toán khác)
- Redrive back to the source queue: returns messages for reprocessing, the opposite of setting them aside (giải bài toán khác)
- Dead-letter queue in another Region: a dead-letter queue must be in the same account and Region as its source queue (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html
> 🇻🇳 Cô lập tin lỗi → DLQ cùng loại + redrive policy (maxReceiveCount); retention của DLQ phải dài hơn queue gốc vì tính từ lúc tin vào queue gốc.

---

## Q ai-20261022-a21-04
- domain: resilient
- task: 2.1
- topic: integration
- services: SNS, SQS, Lambda
- tags: fan-out, sns-filtering, decoupling
- difficulty: medium
- time: 150
- skills: 2.1.k11, 2.1.s3
- concept: SNS-to-SQS fan-out with one queue per subscriber buffers events while a consumer is offline, and subscription filter policies deliver only the needed event types
- refs: 07-application-integration.md
- hint: Mỗi dịch vụ chỉ cần một phần sự kiện và có lúc ngừng bảo trì — thứ gì giữ sự kiện cho dịch vụ offline và ai lọc theo loại?
- created: 2026-10-22
- enriched: 2026-10-22

An online marketplace publishes an event whenever an order changes state: PLACED, PAID, SHIPPED, or CANCELED. The order service already publishes every event to a single Amazon SNS topic. The billing service needs only PAID and CANCELED events, the warehouse service needs only PAID and SHIPPED events, and the analytics service needs every event. Each service must still receive events that arrive while it is offline for maintenance, and the order service must not be changed when new subscribers are added later. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create one Amazon SQS queue for each service and subscribe each queue to the SNS topic.
- B. Subscribe the HTTPS endpoints of the three services to the topic, with filter policies on the order state for the billing and warehouse subscriptions.
- C. Add a subscription filter policy on the order state to the billing and warehouse subscriptions.
- D. Create one Amazon SQS FIFO queue for each service and subscribe each FIFO queue to the existing SNS standard topic.
- E. Subscribe one shared SQS queue to the topic and add a Lambda function that forwards each event to the services that need it.

**Answer:** A, C

**Explanation:** A queue per service holds events while that service is offline, and filter policies deliver only the order states each service needs, so subscribers can be added without touching the publisher.
- HTTPS subscriptions with filter policies: events are filtered, but nothing holds them while a service is offline, so they are dropped once retries end (vi phạm ràng buộc)
- FIFO queues on a standard topic: only an SNS FIFO topic can deliver to SQS FIFO queues (cấu hình không tồn tại)
- Shared queue with a forwarding function: the function pushes events to the services, so a service in maintenance misses them (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/sns/latest/dg/sns-sqs-as-subscriber.html
> 🇻🇳 Fan-out chuẩn: SNS topic → mỗi dịch vụ một hàng đợi SQS (đệm khi offline) + filter policy; thêm subscriber không sửa nguồn phát.

---

## Q ai-20261022-a21-05
- domain: resilient
- task: 2.1
- topic: integration
- services: EventBridge, Lambda, Step Functions, DynamoDB
- tags: event-driven, serverless-cost
- difficulty: hard
- time: 140
- skills: 2.1.k5, 2.1.s1
- concept: EventBridge Scheduler one-time schedules in a chosen time zone scale to millions with no polling code, unlike scheduled rules (UTC, legacy, limited per bus), a Step Functions Wait state (one-year limit), or a table polled every minute
- refs: 07-application-integration.md
- hint: Nhắc hẹn một lần, giờ địa phương, đặt trước nhiều năm, hàng triệu lịch, sai số khoảng một phút — công cụ lên lịch nào đáp ứng cả bốn?
- created: 2026-10-22
- enriched: 2026-10-22

A car-leasing company sends each customer a renewal reminder by SMS at 09:00 local time, 30 days before the lease ends. Leases run for as long as five years, so reminders are scheduled up to five years ahead for customers in many time zones, and millions of reminders can be pending at once. Each reminder must be delivered within about a minute of its target time. The company wants a serverless solution with the LEAST operational overhead. Which solution will meet these requirements?

- A. Create a one-time schedule in Amazon EventBridge Scheduler for each reminder, set to the customer's time zone, with a Lambda function as the target.
- B. Start an AWS Step Functions Standard workflow for each lease with a Wait state that reads the reminder timestamp, followed by a task that invokes the SMS function.
- C. Store each reminder in a DynamoDB table and run a Lambda function every minute from a recurring EventBridge Scheduler schedule that queries and sends due reminders.
- D. Create an Amazon EventBridge scheduled rule for each reminder with a cron expression converted from the customer's local time to UTC and a Lambda function target.

**Answer:** A

**Explanation:** EventBridge Scheduler supports one-time schedules in a time zone you choose, scales to millions of schedules, and invokes targets with about one-minute precision, with no servers to run.
- Step Functions Wait state: a Standard execution runs for at most one year (https://docs.aws.amazon.com/step-functions/latest/dg/choosing-workflow-type.html), so it cannot wait five years (vi phạm ràng buộc)
- Table polled every minute: works, but adds a table, an index, and query code to build and operate (tốn vận hành hơn)
- Scheduled rule per reminder: rules per event bus are limited and scheduled rules are a legacy feature, so millions of one-time reminders do not fit (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html
> 🇻🇳 Nhắc hẹn một lần, đúng giờ địa phương, hàng triệu lịch → EventBridge Scheduler (one-time + time zone); Wait state tối đa 1 năm, bảng quét mỗi phút tốn vận hành hơn.

---

## Q ai-20261022-a21-06
- domain: resilient
- task: 2.1
- topic: integration
- services: EventBridge, DynamoDB, API Gateway, SQS, Lambda
- tags: event-driven, dynamodb-streams, decoupling
- difficulty: medium
- time: 150
- skills: 2.1.k5, 2.1.s1
- concept: EventBridge Pipes connects a polled source such as a DynamoDB stream to a target with filtering and enrichment and no glue code; event bus rules cannot read streams
- refs: 07-application-integration.md
- hint: Nguồn là stream cần được poll, có lọc và gọi API để làm giàu, không muốn code keo — rule trên event bus có đọc được stream không?
- created: 2026-10-22
- enriched: 2026-10-22

A fitness-app company records workout sessions in an Amazon DynamoDB table. When a new session item is inserted with a status of COMPLETED, the company must look up the user's coaching plan by calling its Amazon API Gateway REST API and then send the combined data to an Amazon SQS queue for a recommendation engine. Today a Lambda function that polls the table's stream does the filtering, the API call, and the queue write. The team wants to remove this custom glue code while keeping the events for each item in order. Which solution will meet these requirements with the LEAST operational overhead?

- A. Keep a Lambda function on the table's stream, add an event source mapping filter for INSERT events with COMPLETED status, and let the function call the API and send the message to the queue.
- B. Create an Amazon EventBridge rule on the default event bus that uses the table's DynamoDB stream as its source for INSERT events with COMPLETED status and the SQS queue as its target.
- C. Create an Amazon EventBridge pipe with the table's stream as the source and a Step Functions Express workflow as the target that filters the events, calls the API, and writes to the queue.
- D. Create an Amazon EventBridge pipe with the table's stream as the source, a filter for INSERT events with COMPLETED status, the API as an enrichment step, and the queue as the target.

**Answer:** D

**Explanation:** EventBridge Pipes reads the DynamoDB stream in order, filters the records, enriches each one through API Gateway, and delivers it to SQS, so the glue function disappears.
- Lambda with an event filter: the function still holds the API call and the queue write (tốn vận hành hơn)
- EventBridge rule on the bus: a rule matches events sent to a bus and cannot read a DynamoDB stream, the polled source that pipes are built for (cấu hình không tồn tại)
- Pipe with a Step Functions target: also removes the function, but adds a workflow to build and run for filtering and enrichment that a pipe performs natively (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes.html
> 🇻🇳 Nguồn stream/queue + lọc + làm giàu + đích, không muốn code keo → EventBridge Pipes (rule trên bus không đọc được DynamoDB stream).

---

## Q ai-20261022-a21-07
- domain: resilient
- task: 2.1
- topic: integration
- services: Step Functions, Lambda, ECS, Fargate
- tags: orchestration, serverless-cost
- difficulty: medium
- time: 115
- skills: 2.1.k16, 2.1.s5
- concept: Step Functions Express workflows (billed per execution and duration) are cheaper than Standard (billed per state transition) for high-volume, short, idempotent workflows
- refs: 07-application-integration.md
- hint: Bước ngắn, idempotent, hàng trăm nghìn sự kiện mỗi phút — hai loại workflow tính tiền khác nhau thế nào ở khối lượng này?
- created: 2026-10-22
- enriched: 2026-10-22

A mobile-gaming company validates in-game purchase events. Each event passes through three short steps: a fraud check, a currency conversion, and an entitlement update. The steps finish in under 10 seconds in total, every step is idempotent, and the platform receives several hundred thousand events per minute. The company wants built-in retries and error handling, no servers to manage, and the lowest possible cost. Which solution will meet these requirements MOST cost-effectively?

- A. Define the workflow as an AWS Step Functions Standard workflow and use its Retry and Catch settings to handle errors in the three steps.
- B. Define the workflow as an AWS Step Functions Express workflow and use its Retry and Catch settings to handle errors in the three steps.
- C. Chain three AWS Lambda functions so that each function invokes the next one synchronously and retries failed calls in its own code.
- D. Run the three steps in one container on Amazon ECS with AWS Fargate and implement the retries and error handling in the application code.

**Answer:** B

**Explanation:** Express workflows suit high-volume, short executions and are billed by executions and duration, not state transitions; at-least-once semantics are fine because every step is idempotent.
- Standard workflow: billed per state transition and built for long, exactly-once work, so it costs far more at this volume (tốn chi phí hơn)
- Chained Lambda functions: each caller waits and is billed, and retries are hand-coded (tốn vận hành hơn)
- Fargate container: pays for always-running tasks and needs custom retry code (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/step-functions/latest/dg/choosing-workflow-type.html
> 🇻🇳 Sự kiện ngắn, khối lượng rất lớn, bước idempotent → Step Functions Express (tính phí theo lần chạy/thời lượng); Standard tính theo state transition nên đắt.

---

## Q ai-20261022-a21-08
- domain: resilient
- task: 2.1
- topic: integration
- services: Lambda, Kinesis Data Streams, SQS
- tags: event-driven, lambda-concurrency
- difficulty: hard
- time: 180
- skills: 2.1.k12, 2.1.k5
- concept: A poison record blocks a Kinesis shard for a Lambda event source mapping until bisect-on-error, retry and age limits, and an on-failure destination are set; a function DLQ covers only asynchronous invocations
- refs: 01-compute-services.md, 07-application-integration.md
- hint: Bản ghi lỗi chặn shard vì Lambda thử lại vô hạn — thiết lập nào nằm trên event source mapping, và DLQ của function dành cho kiểu gọi nào?
- created: 2026-10-22
- enriched: 2026-10-22

A ride-hailing company processes GPS pings with an AWS Lambda function that reads from an Amazon Kinesis data stream through an event source mapping. Occasionally a malformed record makes the function throw an error. Lambda keeps retrying the same batch, the affected shard stops advancing, and the pings behind the bad record are delayed for hours. The company wants healthy records to keep flowing, wants to limit both the number of retries and the age of records that Lambda still processes, and wants details about discarded records saved for later analysis. Which combination of changes will meet these requirements? (Choose THREE)

- A. Enable enhanced fan-out for the event source mapping so that the function reads each shard through a dedicated connection with a lower iterator age.
- B. Enable the bisect batch on function error setting so that Lambda splits a failing batch to isolate the malformed record.
- C. Set a maximum number of retry attempts and a maximum record age on the event source mapping so that Lambda gives up on old records.
- D. Configure an Amazon SQS dead-letter queue in the function's asynchronous invocation settings to capture the batches that Lambda discards from the stream.
- E. Configure an on-failure destination, such as an Amazon SQS queue, on the event source mapping to keep metadata of the records that Lambda skips.
- F. Increase the batch size and the batching window of the event source mapping so that Lambda reads a larger number of records per invocation and gets past the malformed record faster after an error.

**Answer:** B, C, E

**Explanation:** Bisecting isolates the bad record, a retry limit and maximum record age end the endless retries, and an on-failure destination keeps details of what was discarded.
- Enhanced fan-out: lowers read latency, but the failing batch still blocks the shard (giải bài toán khác)
- Dead-letter queue for asynchronous invocations: it applies to asynchronous invocations, not to a stream event source mapping (dùng sai tính năng)
- Larger batch size and window: more records per call, but the batch with the bad record keeps failing (giải bài toán khác)
Docs: https://docs.aws.amazon.com/lambda/latest/dg/services-kinesis-parameters.html
> 🇻🇳 Bản ghi lỗi chặn shard → bisect batch + giới hạn retry/tuổi bản ghi + on-failure destination; DLQ của function chỉ cho gọi bất đồng bộ.

---

## Q ai-20261022-a21-09
- domain: resilient
- task: 2.1
- topic: integration
- services: Lambda, SQS
- tags: lambda-concurrency, sqs-dlq, decoupling
- difficulty: hard
- time: 140
- skills: 2.1.k12, 2.1.s3
- concept: To cap how fast Lambda drains an SQS queue, set maximum concurrency on the event source mapping; reserved concurrency throttles invocations and can push messages to the DLQ
- refs: 01-compute-services.md, 07-application-integration.md
- hint: Cần giới hạn song song mà tin không bị đẩy vào DLQ chỉ vì bị throttle — giới hạn đặt trên function hay trên nguồn sự kiện?
- created: 2026-10-22
- enriched: 2026-10-22

A tax-preparation company processes submitted returns with an AWS Lambda function that is triggered by an Amazon SQS standard queue. During filing season the queue holds millions of messages, and Lambda scales out until the partner e-filing API that the function calls starts rejecting requests because it allows only a limited number of parallel calls. The backlog can take longer to drain, but no message may be lost, and messages must not be moved to the dead-letter queue merely because the function was throttled. Which solution will meet these requirements?

- A. Set the reserved concurrency of the function that processes the SQS messages to the number of parallel calls that the partner API can handle.
- B. Set a maximum batching window of five minutes on the SQS event source mapping so that the function is invoked with fewer, larger batches.
- C. Set the maximum concurrency of the SQS event source mapping to the number of parallel calls that the partner API can handle.
- D. Set the provisioned concurrency of the function that processes the SQS messages to the number of parallel calls that the partner API can handle.

**Answer:** C

**Explanation:** Maximum concurrency on the SQS event source mapping caps how many function instances that queue can invoke, so Lambda reads fewer messages and the backlog waits safely in the queue.
- Reserved concurrency: throttled invocations send messages back to the queue, and repeated failed receives can move them to the dead-letter queue (vi phạm ràng buộc)
- Batching window: fewer invocations, but Lambda can still scale out and call the partner in parallel (giải bài toán khác)
- Provisioned concurrency: keeps execution environments initialized but does not cap how far the function scales (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-scaling.html
> 🇻🇳 Giới hạn song song khi Lambda đọc SQS → đặt maximum concurrency ở event source mapping; reserved concurrency gây throttle và tin có thể rơi vào DLQ.

---

## Q ai-20261022-a21-10
- domain: resilient
- task: 2.1
- topic: integration
- services: S3, EventBridge, Step Functions, Lambda, SNS
- tags: event-driven, s3-event-notifications, orchestration
- difficulty: hard
- time: 170
- skills: 2.1.k5, 2.1.s1
- concept: S3 notifications cannot target Step Functions or filter on size; enabling EventBridge on the bucket lets a rule filter by prefix, suffix, and size and start the state machine directly
- refs: 07-application-integration.md
- hint: Đích của S3 event notification chỉ gồm vài loại và không lọc theo kích thước — kênh sự kiện nào cho rule lọc sâu rồi gọi thẳng workflow?
- created: 2026-10-22
- enriched: 2026-10-22

A genomics lab uploads sequencing files to an Amazon S3 bucket. The lab wants an AWS Step Functions state machine to start automatically only when a new object under the raw/ prefix has the .fastq.gz suffix and is larger than a minimum size. The solution must not use custom code to poll the bucket or to forward events, and the lab expects to add other targets for the same events later. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create an Amazon S3 event notification on the bucket that uses the state machine as the target, with prefix and suffix filters for the object events.
- B. Enable Amazon EventBridge notifications on the S3 bucket so that object events are delivered to the default event bus.
- C. Create an S3 event notification on the bucket that invokes a Lambda function, which checks the object size of each event and then calls StartExecution on the state machine.
- D. Create an Amazon EventBridge rule that matches Object Created events by key prefix, suffix, and object size and uses the state machine as its target.
- E. Subscribe the state machine to an Amazon SNS topic that receives the bucket events and apply a filter policy on the object size in each event message.

**Answer:** B, D

**Explanation:** EventBridge notifications put the bucket's object events on the event bus, where a rule can match prefix, suffix, and size and start the state machine directly; more targets can be added later.
- S3 notification to a state machine: S3 notifications can target only SNS, SQS, Lambda, or EventBridge (cấu hình không tồn tại)
- Notification to Lambda calling StartExecution: it is the custom forwarding code the lab wants to avoid (vi phạm ràng buộc)
- SNS topic with the state machine as subscriber: a state machine is not a supported SNS subscription endpoint (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventBridge.html
> 🇻🇳 S3 không gửi thẳng tới Step Functions → bật EventBridge cho bucket + rule lọc prefix/suffix/size → target là state machine.

---

## Q ai-20261022-a21-11
- domain: resilient
- task: 2.1
- topic: integration
- services: Amazon MQ, MSK, EC2
- tags: decoupling
- difficulty: easy
- time: 100
- skills: 2.1.k2, 2.1.s7
- concept: Amazon MQ for RabbitMQ keeps AMQP 0-9-1 clients unchanged; only its cluster deployment survives an AZ failure, while ActiveMQ (AMQP 1.0, OpenWire) and MSK (Kafka) would need client changes
- refs: 07-application-integration.md
- hint: Giữ nguyên giao thức AMQP và mã nguồn, bỏ việc vá broker, chịu lỗi một AZ — dịch vụ managed nào nói giao thức này, và kiểu triển khai nào trải qua nhiều AZ?
- created: 2026-10-22
- enriched: 2026-10-22

A logistics company runs an order-routing application on premises. Its services exchange messages through a RabbitMQ broker by using AMQP 0-9-1 client libraries. The company is moving the application to Amazon EC2 and wants to stop patching and operating broker servers while keeping the application code and messaging protocol unchanged. The broker must stay available if an Availability Zone fails. Which solution will meet these requirements?

- A. Create an Amazon MQ for ActiveMQ broker with an active/standby deployment across two Availability Zones and point the application at its endpoint.
- B. Create an Amazon MQ for RabbitMQ broker with a cluster deployment across three Availability Zones and point the application at its endpoint.
- C. Create an Amazon MQ for RabbitMQ single-instance broker, enable automatic minor version upgrades, and point the application at its endpoint.
- D. Replace the broker with an Amazon MSK cluster that has brokers in three Availability Zones and point the application's clients at the bootstrap brokers.

**Answer:** B

**Explanation:** Amazon MQ for RabbitMQ runs a managed RabbitMQ broker that existing AMQP 0-9-1 clients use without code changes, and a cluster deployment places three broker nodes in different Availability Zones behind one endpoint, while AWS handles patching.
- Amazon MQ for ActiveMQ: highly available and managed, but ActiveMQ supports AMQP 1.0, not the AMQP 0-9-1 protocol of the RabbitMQ clients (vi phạm ràng buộc)
- Single-instance RabbitMQ broker: one node in one Availability Zone, so a zone failure stops messaging (vi phạm ràng buộc)
- Amazon MSK: speaks the Apache Kafka protocol, so the AMQP clients would have to be rewritten (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/amazon-mq/latest/developer-guide/rabbitmq-broker-architecture.html
> 🇻🇳 Giữ giao thức AMQP của RabbitMQ, bỏ quản trị broker, chịu lỗi AZ → Amazon MQ for RabbitMQ kiểu cluster deployment (3 node, nhiều AZ); single-instance chỉ ở 1 AZ, MSK là Kafka.

---

## Q ai-20261022-a21-12
- domain: resilient
- task: 2.1
- topic: integration
- services: Step Functions, SQS, EventBridge, Lambda
- tags: orchestration, event-driven, decoupling
- difficulty: medium
- time: 135
- skills: 2.1.k16, 2.1.s1
- family: parcel-stage-integration
- concept: Step Functions gives per-execution visibility, retries, and callback waits with the least custom code when stages need orchestration
- refs: 07-application-integration.md
- hint: Cần xem tiến trình từng lô hàng và tự retry, chờ phản hồi nhiều ngày — kiểu tích hợp nào cho sẵn lịch sử từng lần chạy?
- created: 2026-10-22
- enriched: 2026-10-22

A parcel-delivery company moves each shipment through five stages: label validation, route planning, customs pre-check, carrier handoff, and delivery confirmation. Each stage is a separate AWS Lambda function owned by a different team, and each function calls the next one directly through the AWS SDK. When a downstream function fails or is throttled, the shipment is lost, and nobody can tell where it stopped. The customs pre-check can wait several days for a customs broker's reply. Which solution will give the operations team a visual, per-shipment view of progress with the LEAST custom code?

- A. Place an Amazon SQS queue in front of each function and configure the function of each stage to send its result to the queue of the next stage.
- B. Define the five stages as tasks in an AWS Step Functions Standard state machine, with retry and catch settings and a task token for the broker's reply.
- C. Combine the five stages into one AWS Lambda function that calls each stage in sequence and waits for the broker's reply before it returns the result.
- D. Publish an event from each function to an Amazon EventBridge event bus and have each stage's function invoked by a rule on the previous stage's event.

**Answer:** B

**Explanation:** A state machine records every execution's path, shows it as a graph per shipment, and offers retry, catch, and a task-token callback for the multi-day broker reply, so no tracking or retry code is needed.
- SQS queue per stage: buffers messages but gives no per-shipment path, so tracking is hand-built (tốn vận hành hơn)
- Single Lambda function: one invocation has a short maximum run time and cannot wait days (vi phạm ràng buộc)
- EventBridge bus with rules: decouples stages but needs extra tracking code for a progress view (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html
> 🇻🇳 Cần nhìn thấy tiến trình từng lô hàng + retry/catch + chờ callback nhiều ngày, ít code nhất → Step Functions Standard.

---

## Q ai-20261022-a21-13
- domain: resilient
- task: 2.1
- topic: integration
- services: Step Functions, SQS, EventBridge, Lambda
- tags: orchestration, event-driven, decoupling
- difficulty: medium
- time: 135
- skills: 2.1.k5, 2.1.s3
- family: parcel-stage-integration
- concept: Publishing events to an EventBridge bus lets new stages subscribe with their own rules without changing producers or a central workflow
- refs: 07-application-integration.md
- hint: Đội mới phải gắn thêm giai đoạn mà không động vào thành phần cũ — mô hình nào chỉ cần phát sự kiện và để bên nhận tự đăng ký?
- created: 2026-10-22
- enriched: 2026-10-22

A parcel-delivery company moves each shipment through five stages: label validation, route planning, customs pre-check, carrier handoff, and delivery confirmation. Each stage is a separate AWS Lambda function owned by a different team, and each function calls the next one directly through the AWS SDK. When a downstream function fails or is throttled, the shipment is lost, and nobody can tell where it stopped. The customs pre-check can wait several days for a customs broker's reply. Which solution will allow a new team to add a stage that reacts to finished carrier handoffs without changing any existing function or workflow definition?

- A. Place an Amazon SQS queue in front of each function and configure the function of each stage to send its result to the queue of the next stage.
- B. Define the five stages as tasks in an AWS Step Functions Standard state machine, with retry and catch settings and a task token for the broker's reply.
- C. Combine the five stages into one AWS Lambda function that calls each stage in sequence and waits for the broker's reply before it returns the result.
- D. Publish an event from each function to an Amazon EventBridge event bus and have each stage's function invoked by a rule on the previous stage's event.

**Answer:** D

**Explanation:** With an event bus, each function only announces what it finished and any team can add a rule that reacts, so a new stage plugs in without touching existing functions or a central workflow.
- Step Functions state machine: adding a stage means editing its central definition (vi phạm ràng buộc)
- SQS queue per stage: the handoff function would have to change to send to the new stage's queue (vi phạm ràng buộc)
- Single Lambda function: each change modifies the shared function, and it cannot wait days (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-rules.html
> 🇻🇳 Thêm giai đoạn mới mà không sửa thành phần cũ → phát sự kiện lên EventBridge bus, mỗi đội tự tạo rule của mình (choreography).

---

## Q ai-20261022-a21-14
- domain: resilient
- task: 2.1
- topic: integration
- services: Kinesis Data Streams, SNS, SQS
- tags: decoupling, streaming-ingestion
- difficulty: medium
- time: 125
- skills: 2.1.k11, 2.1.s3
- concept: When several teams must each read every record in per-key order and re-read recent history, a Kinesis data stream fits; SQS and SNS delete or reorder messages
- refs: 07-application-integration.md, 09-analytics-bigdata.md
- hint: Ba đội cùng đọc toàn bộ, đúng thứ tự theo khoá và đọc lại 24 giờ trước — dịch vụ nào còn giữ dữ liệu sau khi đã được đọc?
- created: 2026-10-22
- enriched: 2026-10-22

A food-delivery company streams courier location updates from its app. Three independent teams — dispatching, fraud analysis, and machine-learning features — must each read every update, in order for each courier, at their own pace. After deploying a bug fix, a team must be able to re-read the previous 24 hours of updates. The company wants a managed service with the LEAST operational overhead. Which solution will meet these requirements?

- A. Write the updates to an Amazon Kinesis data stream with the courier ID as the partition key, and let each team read as a separate consumer.
- B. Publish the updates to an Amazon SNS standard topic and subscribe a separate Amazon SQS queue for each team so that each team can read the stream of updates.
- C. Send the updates to an Amazon SQS FIFO queue with the courier ID as the message group ID and let the three teams read from the shared queue.
- D. Have the app send each update to three Amazon SQS FIFO queues, one for each team, with the courier ID as the message group ID, and let each team read its own queue.

**Answer:** A

**Explanation:** A Kinesis data stream keeps records in order per partition key, lets each team read all records independently, and retains them (24 hours by default) so a consumer can restart from an earlier position.
- SNS standard topic with queues: standard topics do not preserve order, and queues delete processed messages (vi phạm ràng buộc)
- Shared FIFO queue: each message goes to one consumer, so teams split the updates (dùng sai tính năng)
- One FIFO queue per team: processed messages are deleted, so 24 hours of history cannot be re-read (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/streams/latest/dev/kinesis-extended-retention.html
> 🇻🇳 Nhiều đội cùng đọc toàn bộ, đúng thứ tự theo khoá, đọc lại 24h → Kinesis Data Streams (SQS/SNS xoá tin sau khi xử lý).
