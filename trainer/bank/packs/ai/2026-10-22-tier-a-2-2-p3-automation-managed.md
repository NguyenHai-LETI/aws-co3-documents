---
pack: ai-2026-10-22-tier-a-2-2-p3
title: "AI · Tầng A · Task 2.2 (p3) — Tự động hoá, quan sát & dịch vụ managed"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 2.2"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 2.2 — immutable, X-Ray, CloudWatch, dịch vụ AI/managed, ứng dụng legacy, pattern phân tán"
---

# AI · Tầng A · Task 2.2 (p3) — Tự động hoá, quan sát & dịch vụ managed

## Q ai-20261022-a22-24
- domain: resilient
- task: 2.2
- topic: compute
- services: EC2, CloudWatch, EC2 Auto Scaling, AWS Backup
- tags: high-availability, snapshots
- difficulty: medium
- skills: 2.2.s4, 2.2.s7
- concept: EC2 automatic recovery restores a single legacy instance on new hardware in the same zone with the same ID, IPs, and volumes
- refs: 01-compute-services.md
- hint: Chỉ hỏng phần cứng host của một instance duy nhất, phần mềm không chạy song song được — giữ nguyên ID, IP, EBS với công sức ít nhất.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A company runs a legacy license-server application on a single Amazon EC2 instance that has an Elastic IP address and attached EBS volumes. The software can run on only one instance at a time and cannot be clustered. The company wants the instance to recover automatically if the underlying host hardware fails, keeping the same instance ID, IP addresses, and data, with the LEAST operational effort and cost. Which solution meets these requirements?

- A. Create a CloudWatch alarm on the StatusCheckFailed_System metric of the instance with the EC2 recover action
- B. Place the instance in an Auto Scaling group with a minimum and maximum size of one and attach the Elastic IP address through user data
- C. Launch a second identical instance in another Availability Zone behind a Network Load Balancer and run the license software on both instances
- D. Take hourly EBS snapshots with AWS Backup and restore them to a new EC2 instance to recover after a failure

**Answer:** A

**Explanation:** EC2 recovers an impaired instance on new hardware in the same zone, keeping its instance ID, IP addresses, and EBS volumes; a CloudWatch alarm on the system status check with the recover action sets it up at no extra cost.
- Auto Scaling group of one: launches a replacement with a new instance ID and without the old volumes (vi phạm ràng buộc).
- Second instance behind a load balancer: the software cannot run on two instances at once (vi phạm ràng buộc).
- Hourly snapshots restored by hand: manual, a new instance ID, and data up to an hour old (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-recover.html
> 🇻🇳 Hỏng phần cứng host của 1 instance (giữ ID/IP/EBS) → EC2 auto recovery (alarm StatusCheckFailed_System).

---

## Q ai-20261022-a22-25
- domain: resilient
- task: 2.2
- topic: compute
- services: EC2 Auto Scaling, ALB, EC2, Systems Manager
- tags: deployment-strategies, ami, launch-template, infrastructure-as-code
- difficulty: hard
- skills: 2.2.k7, 2.2.s1, 2.2.k8
- concept: Immutable infrastructure bakes a new AMI per release and shifts ALB target group weights between old and new groups for instant rollback
- refs: 01-compute-services.md, C-kien-truc-web-app.md
- hint: Không sửa instance đang chạy: mỗi bản phát hành là một image mới, và việc quay lại phải tức thì mà không phải thay instance lần nữa.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 170

A company runs a web application on EC2 instances in an Auto Scaling group behind an Application Load Balancer. Operators patch the instances in place with SSH and Systems Manager Run Command. After months the instances have drifted, with different library versions, and a faulty patch took hours to undo. The company wants every change deployed as a new, tested image to consistent instances, wants to switch back to the previous version immediately without launching or replacing instances again, and wants no one to log in to production instances. Which combination of steps will meet these requirements? (Choose TWO)

- A. Run Systems Manager Patch Manager in a monthly maintenance window to patch the running instances in place
- B. Bake each release into a new AMI and reference it from a new launch template version used by a new Auto Scaling group
- C. Add a user data script that installs the latest application version from a package repository whenever an instance launches
- D. Start an Auto Scaling instance refresh on the existing group behind the load balancer for each release and roll back by starting another refresh
- E. Shift traffic to the new group by changing target group weights on the load balancer listener, and keep the old group running for rollback

**Answer:** B, E

**Explanation:** Immutable infrastructure never changes running servers: each release is a new AMI launched by a new Auto Scaling group, and weighted target groups shift traffic while the old group stays untouched, so rollback means moving weights back.
- Patch Manager on running instances: in-place changes, the cause of the drift (vi phạm ràng buộc).
- User data installing the latest version at launch: instances differ by launch time and no tested image exists (dùng sai tính năng).
- Instance refresh: replaces instances again to roll back, so rollback is not immediate (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_tracking_change_management_immutable_infrastructure.html
> 🇻🇳 Immutable: AMI mới mỗi bản phát hành + chuyển trọng số target group → rollback tức thì, không vá tại chỗ.

---

## Q ai-20261022-a22-26
- domain: resilient
- task: 2.2
- topic: devtools
- services: X-Ray, API Gateway, Lambda, CloudTrail, VPC Flow Logs, CloudWatch
- tags: observability
- difficulty: medium
- skills: 2.2.k12
- concept: AWS X-Ray traces individual requests across services and shows a service map with latency and error rates
- refs: Q-service-comparisons.md, 06-management-governance.md
- hint: Trung bình từng hàm đều bình thường nhưng vẫn có request chậm — cần theo dấu từng request xuyên nhiều dịch vụ, không phải số liệu gộp.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A food-delivery company runs its order workflow as Amazon API Gateway REST APIs that invoke AWS Lambda functions, which call Amazon DynamoDB and other AWS services. Customers report intermittent slow checkouts, yet CloudWatch shows normal average duration for every function. Engineers cannot tell which downstream call adds latency or fails. The company needs end-to-end visibility into individual requests across the services, including a map of dependencies and error rates, with as little change to the application as possible. What should a solutions architect do?

- A. Enable AWS CloudTrail data events for the API Gateway API and the Lambda functions and query the log files with Amazon Athena
- B. Enable AWS X-Ray active tracing on the API Gateway stage and the Lambda functions, then use the service graph and traces to find the failing call
- C. Publish custom CloudWatch metrics for the duration of each call from every Lambda function behind the API Gateway API and build a dashboard of the averages
- D. Turn on VPC Flow Logs for the subnets that the Lambda functions use and analyze the flow records for the API Gateway traffic with CloudWatch Logs Insights

**Answer:** B

**Explanation:** AWS X-Ray collects traces across API Gateway, Lambda, and downstream calls, builds a service map with latency and error rates for each node, and active tracing is mostly a configuration change.
- CloudTrail data events: record who called which API, not latency or the path of a request (dùng sai tính năng).
- Custom CloudWatch metrics: need code changes and show averages per function, not individual requests across services (tốn vận hành hơn).
- VPC Flow Logs: show network flows only, with no request-level view of API calls (giải bài toán khác).
Docs: https://docs.aws.amazon.com/xray/latest/devguide/aws-xray.html
> 🇻🇳 Cần truy vết từng request xuyên nhiều dịch vụ + service map → AWS X-Ray (active tracing).

---

## Q ai-20261022-a22-27
- domain: resilient
- task: 2.2
- topic: ml
- services: Comprehend, SageMaker, Rekognition, Lex, EC2
- tags: managed-service, high-availability
- difficulty: medium
- skills: 2.2.k2, 2.2.s8
- concept: Amazon Comprehend is a managed NLP service that replaces a self-managed model fleet for sentiment, key phrases, and PII detection
- refs: 12-ml-ai.md
- hint: Phân tích cảm xúc, cụm từ khoá và PII trên văn bản mà không tự quản server hay train model — dịch vụ AI nào làm sẵn việc này?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 115

A telecom company runs a self-managed sentiment-analysis pipeline for customer chat transcripts. Two GPU-based Amazon EC2 instances host an open-source NLP model, and the small data science team must patch the servers, retrain the model, and add capacity during campaign peaks. A recent instance failure delayed analysis for a day. The company wants sentiment, key phrases, and detection of personally identifiable information (PII) in English text without managing servers or training models, with the LEAST operational overhead. Which solution meets these requirements?

- A. Move the model to an Amazon SageMaker AI real-time endpoint with auto scaling and keep retraining it on the team's schedule to detect key phrases
- B. Replace the pipeline with Amazon Rekognition and send the transcripts to its text analysis APIs to detect sentiment, key phrases, and PII
- C. Call Amazon Comprehend to detect sentiment, key phrases, and PII, using batch jobs for stored transcripts and real-time APIs for live chats
- D. Use Amazon Lex to analyze the transcripts and detect the sentiment and the PII found in each customer message, and store the key phrases for later reporting

**Answer:** C

**Explanation:** Amazon Comprehend is a managed NLP service with pre-trained models for sentiment, key phrases, and PII detection, available through real-time APIs and asynchronous jobs, so there are no servers, patches, GPUs, or models to maintain.
- SageMaker AI endpoint: still a custom model to train, deploy, scale, and monitor (tốn vận hành hơn).
- Amazon Rekognition: analyzes images and video, not text sentiment (dùng sai tính năng).
- Amazon Lex: builds conversational bots, not text analytics (giải bài toán khác).
Docs: https://docs.aws.amazon.com/comprehend/latest/dg/what-is.html
> 🇻🇳 Phân tích cảm xúc/cụm từ khoá/PII trên văn bản, không tự quản server hay train model → Amazon Comprehend.

---

## Q ai-20261022-a22-28
- domain: resilient
- task: 2.2
- topic: ml
- services: Polly, Transcribe, Translate, EC2 Auto Scaling, S3
- tags: managed-service, serverless-cost
- difficulty: easy
- skills: 2.2.k2, 2.2.s8
- concept: Amazon Polly is a managed text-to-speech service that removes the self-managed engine fleet and its capacity planning
- refs: 12-ml-ai.md
- hint: Đầu vào là văn bản, đầu ra là giọng nói, trả tiền theo lượng văn bản chuyển đổi — chiều chuyển đổi nào đúng với dịch vụ cần chọn?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 95

An e-learning company converts lesson text into audio narration with a text-to-speech engine running on a fixed fleet of Amazon EC2 instances. Demand spikes before exam season, and an instance failure last year left lessons without audio for hours. The company wants natural-sounding voices in several languages for its mobile app and wants to eliminate server and capacity management, paying only for the text it converts. Which solution will meet these requirements?

- A. Move the engine to an Auto Scaling group across two Availability Zones behind an Application Load Balancer
- B. Use Amazon Transcribe to convert the lesson text into audio files and store them in Amazon S3
- C. Use Amazon Translate to generate spoken audio in each language from the lesson text
- D. Call Amazon Polly to synthesize speech from the lesson text and cache the generated audio in Amazon S3

**Answer:** D

**Explanation:** Amazon Polly is a managed text-to-speech service with lifelike voices in many languages; there are no servers or capacity to manage, you pay only for the text you synthesize, and generated audio can be cached and replayed at no extra cost.
- Auto Scaling engine on EC2: more resilient, but the company still runs and patches the fleet (tốn vận hành hơn).
- Amazon Transcribe: converts speech to text, the opposite direction (dùng sai tính năng).
- Amazon Translate: translates text into other languages and produces no audio (giải bài toán khác).
Docs: https://docs.aws.amazon.com/polly/latest/dg/what-is.html
> 🇻🇳 Chuyển văn bản thành giọng nói, không quản server, trả tiền theo ký tự → Amazon Polly.

---

## Q ai-20261022-a22-29
- domain: resilient
- task: 2.2
- topic: management
- services: CloudWatch, ALB, Aurora
- tags: aurora-global-database, rto-rpo, observability
- difficulty: hard
- skills: 2.2.s3, 2.2.k12
- concept: Alarms should track the business requirement directly: the 5XX error ratio for customer success and AuroraGlobalDBRPOLag for cross-Region RPO
- refs: 06-management-governance.md, 03-database-services.md
- hint: Mỗi yêu cầu kinh doanh cần một chỉ số đo đúng nó: trải nghiệm thành công của khách và lượng dữ liệu có thể mất khi mất Region.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 160

A company runs a checkout API on an Application Load Balancer with Amazon EC2 targets in us-east-1. Its Aurora PostgreSQL database uses Aurora Global Database with a DR cluster in us-west-2. The business defines two requirements: at least 99.9 percent of checkout requests must return a successful response, and a Regional failure must lose no more than one minute of committed data. The operations team wants CloudWatch alarms that directly track these two requirements. Which combination of alarms should the team create? (Choose TWO)

- A. An alarm on the ratio of the HTTPCode_Target_5XX_Count metric to the RequestCount metric of the load balancer, calculated with metric math
- B. An alarm on the average CPUUtilization of the EC2 targets in the target group that triggers above 70 percent
- C. An alarm on the AuroraReplicaLag metric of the Aurora Replicas in the primary cluster that triggers above 60,000 milliseconds
- D. An alarm on the UnHealthyHostCount metric of the load balancer target group that triggers when the value is greater than zero for one minute
- E. An alarm on the AuroraGlobalDBRPOLag metric of the secondary cluster that triggers above 60,000 milliseconds

**Answer:** A, E

**Explanation:** Requirements map to outcome metrics: the 5XX-to-request ratio measures what customers experience, and AuroraGlobalDBRPOLag, reported for the secondary cluster, measures how much committed data a Regional failure would lose.
- UnHealthyHostCount above zero: also fires for one bad instance that customers never notice (đúng một phần).
- Average CPU of the instances: a resource metric that says nothing about success rate or data loss (giải bài toán khác).
- AuroraReplicaLag of the primary cluster's replicas: measures lag inside the primary Region, not to the DR cluster (đặt sai chỗ).
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database-disaster-recovery.html
> 🇻🇳 Alarm phải đo đúng yêu cầu kinh doanh: tỉ lệ 5XX/Request (trải nghiệm khách) và AuroraGlobalDBRPOLag (RPO xuyên Region).

---

## Q ai-20261022-a22-30
- domain: resilient
- task: 2.2
- topic: database
- services: RDS Proxy, RDS, EC2, Route 53
- tags: connection-pooling, multi-az, read-replicas
- difficulty: medium
- skills: 2.2.k9, 2.2.s7
- concept: RDS Proxy pools connections and bypasses DNS caches during failover, so an unmodifiable legacy app needs only a new endpoint
- refs: 03-database-services.md, E-kien-truc-database.md
- hint: Không sửa được code, chỉ đổi chuỗi kết nối; JVM cache DNS cũ và quá nhiều kết nối ngắn — lớp trung gian nào giải quyết cả hai?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A company runs a legacy Java application on Amazon EC2 that cannot be modified. It connects to an Amazon RDS for MySQL Multi-AZ DB instance deployment. After a database failover, the application takes minutes to reconnect because the JVM caches the old DNS entry, and thousands of short-lived connections exhaust database memory at peak hours. The team can change only the application's connection string. Which solution will reduce the failover impact and the connection overhead?

- A. Create an RDS Proxy for the database and change the application's connection string to the proxy endpoint
- B. Add a read replica of the RDS database and change the connection string to a Route 53 weighted record that lists the primary and the replica
- C. Convert the RDS DB instance to a Multi-AZ DB cluster so that the reader endpoint absorbs the database connections
- D. Increase the DB instance class of the RDS database and raise the max_connections parameter so that more connections fit in memory

**Answer:** A

**Explanation:** RDS Proxy pools and multiplexes connections, so thousands of short-lived client connections share a few database connections, and during failover it connects to the new primary and preserves client connections without waiting for DNS caches.
- Read replica behind a weighted record: replicas are read-only and do not take over writes (dùng sai tính năng).
- Multi-AZ DB cluster: faster failover, but clients still resolve DNS and open the same number of connections (giải bài toán khác).
- Larger instance and higher max_connections: costs more and leaves the reconnect delay (tốn chi phí hơn).
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-planning.html
> 🇻🇳 App cũ không sửa được, cache DNS + quá nhiều kết nối → RDS Proxy (gộp kết nối, bỏ qua DNS cache khi failover).

---

## Q ai-20261022-a22-31
- domain: resilient
- task: 2.2
- topic: integration
- services: Amazon MQ, SQS, SNS, EC2
- tags: high-availability, decoupling
- difficulty: medium
- skills: 2.2.s7, 2.2.s8, 2.2.s4
- concept: Amazon MQ active/standby brokers across two zones give a managed, JMS-compatible broker that removes the single point of failure without code changes
- refs: 07-application-integration.md
- hint: Dịch vụ cũ nói JMS và không được viết lại — cần broker managed cùng giao thức, có dự phòng ở AZ thứ hai.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A logistics company runs an Apache ActiveMQ broker on a single Amazon EC2 instance. Dozens of legacy Java services exchange order messages with it through JMS, and the code cannot be rewritten. An instance failure last quarter stopped order processing for 90 minutes. The company wants to remove this single point of failure and the broker maintenance work, and to keep the JMS clients unchanged apart from their connection URL. Which solution will meet these requirements?

- A. Migrate the queues to Amazon SQS standard queues and rewrite the services to use the AWS SDK
- B. Create an Amazon MQ for ActiveMQ broker with an active/standby deployment across two Availability Zones and point the clients to its failover endpoints
- C. Run a second ActiveMQ broker on another EC2 instance in a different Availability Zone and configure a network of brokers manually, then point the clients at both brokers
- D. Publish the messages to an Amazon SNS topic and have each service subscribe through its own Amazon SQS queue so that the clients read from the queues

**Answer:** B

**Explanation:** Amazon MQ for ActiveMQ is a managed broker that speaks the same wire-level protocols as the existing JMS clients; an active/standby deployment places two brokers in different Availability Zones with shared storage, fails over automatically, and removes patching, so only the connection URL changes.
- SQS queues with an SDK rewrite: needs the code changes that are ruled out (vi phạm ràng buộc).
- A second self-managed broker: removes the single point of failure but keeps the maintenance burden (tốn vận hành hơn).
- SNS to SQS fan-out: a different messaging model that JMS clients cannot use unchanged (giải bài toán khác).
Docs: https://docs.aws.amazon.com/amazon-mq/latest/developer-guide/amazon-mq-broker-architecture.html
> 🇻🇳 Broker ActiveMQ/JMS legacy, không sửa code, loại SPOF → Amazon MQ active/standby 2 AZ.

---

## Q ai-20261022-a22-32
- domain: resilient
- task: 2.2
- topic: storage
- services: FSx, EFS, EC2, Directory Service
- tags: multi-az, fsx-windows, high-availability
- difficulty: medium
- skills: 2.2.k11, 2.2.s7, 2.2.s8
- concept: FSx for Windows File Server Multi-AZ gives SMB shares with synchronous replication and automatic failover for legacy Windows workloads
- refs: 02-storage-services.md, D-kien-truc-luu-tru.md
- hint: Chia sẻ SMB cho Windows, tích hợp Active Directory, phải sống sót khi mất một AZ mà không tự vận hành — loại EFS vì giao thức.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 115

A company runs a Windows file server on a single EC2 instance in one Availability Zone, with an EBS volume that serves SMB shares to 300 users and applications joined to Active Directory. An Availability Zone outage made the shares unavailable for hours. The company wants a managed solution that keeps the shares available through an Availability Zone failure with automatic failover, preserves NTFS permissions and Active Directory integration, and needs no client changes, with the LEAST operational overhead. Which solution meets these requirements?

- A. Migrate the data to an Amazon EFS Regional file system and mount it on the Windows clients that stay joined to Active Directory
- B. Create a second Windows file server instance joined to Active Directory in another Availability Zone and replicate the shares with DFS Replication, using scripts to manage failover
- C. Migrate the data to an Amazon FSx for Windows File Server Multi-AZ file system joined to Active Directory
- D. Migrate the data to an Amazon FSx for Windows File Server Single-AZ file system joined to Active Directory and enable daily backups

**Answer:** C

**Explanation:** FSx for Windows File Server Multi-AZ runs an active and a standby file server in two Availability Zones with synchronous replication and automatic failover, keeping the same DNS name, NTFS permissions, and Active Directory integration for clients.
- EFS: uses NFS and is not supported on Windows clients (dùng sai tính năng).
- A second self-managed server with DFS Replication: adds patching and failover scripting (tốn vận hành hơn).
- FSx Single-AZ with daily backups: an Availability Zone outage still takes the shares offline until a restore (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/fsx/latest/WindowsGuide/high-availability-multiAZ.html
> 🇻🇳 SMB + AD + chịu lỗi AZ + ít vận hành → FSx for Windows File Server Multi-AZ (EFS không dùng cho Windows).

---

## Q ai-20261022-a22-33
- domain: resilient
- task: 2.2
- topic: database
- services: ElastiCache, EC2 Auto Scaling, ALB, S3, EBS
- tags: redis-vs-memcached, multi-az, high-availability
- difficulty: medium
- skills: 2.2.k5, 2.2.s4
- concept: A stateless web tier keeps session state in a Multi-AZ ElastiCache replication group instead of instance memory with sticky sessions
- refs: 03-database-services.md, C-kien-truc-web-app.md
- hint: Giỏ hàng nằm trong RAM từng instance nên mất khi scale-in hoặc lỗi — đưa trạng thái ra một kho dùng chung, nhanh và chịu lỗi AZ.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

An online ticketing site runs a stateful PHP application on EC2 instances behind an Application Load Balancer with sticky sessions enabled. Sessions are stored in each instance's memory. During Auto Scaling scale-in events and instance failures, customers lose their shopping carts and are signed out. The company wants carts to survive instance failures and scale-in with the lowest latency and minimal code changes; the framework supports external session handlers. Which solution meets these requirements?

- A. Increase the sticky session duration on the load balancer and turn on scale-in protection for the Auto Scaling group so that instances are not terminated
- B. Store each session as an object in Amazon S3 through the framework's session handler and have the application read and write it on every request
- C. Store the sessions on an Amazon EBS volume attached to each instance, point the session handler at it, and snapshot the volumes every five minutes
- D. Store the sessions in an Amazon ElastiCache replication group with Multi-AZ automatic failover and use the framework's session handler

**Answer:** D

**Explanation:** Moving session state out of the instances makes the web tier stateless; an ElastiCache replication group gives in-memory speed, survives web instance failures and scale-in, and with Multi-AZ automatic failover protects the cache itself; framework session handlers need only configuration.
- Longer stickiness with scale-in protection: stickiness still ties a user to one instance, and protection does not help when it fails (dùng sai tính năng).
- Per-request session objects in S3: durable, but every request pays object-store latency (vi phạm ràng buộc).
- Instance-attached EBS with snapshots: volumes go with the instance and snapshots lag minutes (đặt sai chỗ).
Docs: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/AutoFailover.html
> 🇻🇳 Web tier phải stateless: session ra ElastiCache (Multi-AZ) thay vì RAM instance + sticky session.

---

## Q ai-20261022-a22-34
- domain: resilient
- task: 2.2
- topic: resilience
- services: SQS, DynamoDB, EC2, Lambda
- tags: decoupling, dynamodb-capacity, sqs-dlq
- difficulty: hard
- skills: 2.2.k5, 2.2.k10
- concept: Handle throttling with exponential backoff and jitter, buffer bursts in a queue, and let DynamoDB on-demand capacity follow traffic
- refs: 07-application-integration.md, 03-database-services.md
- hint: Throttle xảy ra do tải đột biến và retry dồn dập — cần giãn retry, có vùng đệm cho đợt tăng đột biến, và bảng tự co giãn theo tải.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 165

A company's image-processing service receives bursts of requests from a mobile app. The service calls an Amazon DynamoDB table and a rate-limited partner API. During bursts it receives ProvisionedThroughputExceededException from DynamoDB and HTTP 429 from the partner, retries immediately in a tight loop, then crashes, and requests are lost. The company wants the service to degrade gracefully and recover without losing requests. Which combination of steps will meet these requirements? (Choose THREE)

- A. Disable the partner API calls during bursts and return an error to the app so that the app retries later
- B. Retry throttled calls with exponential backoff and jitter instead of retrying immediately
- C. Move the service to a larger EC2 instance type with more CPU so that it retries faster against the DynamoDB table
- D. Place the requests in an Amazon SQS queue and process them with consumers that scale with the queue depth
- E. Raise the retry count of the client so that every request is retried immediately until the DynamoDB table accepts it
- F. Switch the DynamoDB table to on-demand capacity mode so that throughput follows the traffic

**Answer:** B, D, F

**Explanation:** Exponential backoff with jitter spreads retries so throttled calls recover, an SQS queue absorbs bursts and lets consumers call the partner at its allowed rate, and on-demand capacity lets table throughput follow the bursts.
- Skipping the partner call and returning errors: loses the requests the company wants to keep (vi phạm ràng buộc).
- Larger instance type: only retries sooner and raises no quota (giải bài toán khác).
- Higher retry count without backoff: amplifies the retry storm and the throttling (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html
> 🇻🇳 Bị throttle: retry có exponential backoff + jitter, đệm bằng SQS, và để DynamoDB on-demand co giãn theo tải.
