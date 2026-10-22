---
pack: saa-13-other-services-v1
title: 13 · Other Services · V1
exam: SAA-C03
origin: imported
source: practice-exams/13-other-services-exam.md
created: 2026-10-16
---

# 13 · Other Services · V1

> Imported from `practice-exams/13-other-services-exam.md` + `13-other-services-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 13-v1-01
- domain: resilient
- task: 2.2
- topic: other
- services: AWS Backup, EC2, EBS, RDS, DynamoDB, EFS, FSx
- tags: compliance
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q1

A company needs centralized, policy-based backups across EC2, EBS, RDS, DynamoDB, EFS, and FSx with compliance reporting. Which service?

- A. AWS Backup
- B. S3 Lifecycle
- C. EBS Snapshots only
- D. AWS DataSync

**Answer:** A

**Explanation:** Central policy-based backups across services = AWS Backup.

---

## Q 13-v1-02
- domain: resilient
- task: 2.2
- topic: other
- services: WorkSpaces
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q2

Employees need managed, persistent virtual desktops (Windows/Linux) accessible remotely (VDI/DaaS). Which service?

- A. Amazon WorkSpaces
- B. Amazon AppStream 2.0
- C. Amazon EC2
- D. AWS Outposts

**Answer:** A

**Explanation:** Managed persistent virtual desktops (DaaS) = WorkSpaces.

---

## Q 13-v1-03
- domain: resilient
- task: 2.2
- topic: other
- services: AppStream 2.0
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q3

A company wants to stream a specific desktop APPLICATION to users' browsers without installing it locally. Which service?

- A. Amazon WorkSpaces
- B. Amazon Lightsail
- C. Amazon AppStream 2.0
- D. Amazon Connect

**Answer:** C

**Explanation:** Stream a single app to browser = AppStream 2.0.

---

## Q 13-v1-04
- domain: resilient
- task: 2.2
- topic: other
- services: IoT Core
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q4

A factory must connect thousands of IoT devices using MQTT, with device state shadows and a rules engine. Which service?

- A. AWS IoT Core
- B. AWS Ground Station
- C. Amazon Kinesis
- D. Amazon MQ

**Answer:** A

**Explanation:** MQTT IoT devices + shadows + rules = IoT Core.

---

## Q 13-v1-05
- domain: performance
- task: 3.2
- topic: other
- services: Outposts
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q5

A regulated workload must run AWS compute and services ON-PREMISES in the company's data center for low latency and data residency. Which service?

- A. Amazon WorkSpaces
- B. AWS Local Zones
- C. AWS Wavelength
- D. AWS Outposts

**Answer:** D

**Explanation:** AWS services on-prem (data residency) = Outposts.

---

## Q 13-v1-06
- domain: performance
- task: 3.4
- topic: other
- services: Local Zones
- difficulty: easy
- time: 45
- enriched: 2026-10-22
- source: practice-exams/13-other-services-exam.md#Q6

A gaming company needs single-digit millisecond latency to end users in a metro area not near a Region. Which service?

- A. AWS Outposts
- B. AWS Global Accelerator
- C. AWS Local Zones
- D. AWS Ground Station

**Answer:** C

**Explanation:** Local Zones place AWS compute, storage and database services in large metro areas close to users, giving single-digit millisecond latency where no Region is nearby.
- AWS Outposts: AWS racks in your own data center, for on-premises needs rather than players across a city.
- AWS Global Accelerator: improves routing over the AWS network, but traffic is still served from distant Regional endpoints.
- AWS Ground Station: satellite communications, unrelated to player latency.
> 🇻🇳 Độ trễ vài ms cho người dùng ở đô thị xa Region → AWS Local Zones.

---

## Q 13-v1-07
- domain: performance
- task: 3.4
- topic: other
- services: Wavelength
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q7

An application needs ultra-low latency to mobile users over 5G carrier networks. Which service?

- A. AWS Local Zones
- B. Global Accelerator
- C. AWS Wavelength
- D. CloudFront

**Answer:** C

**Explanation:** 5G edge ultra-low latency = Wavelength.

---

## Q 13-v1-08
- domain: resilient
- task: 2.2
- topic: other
- difficulty: easy
- time: 45
- enriched: 2026-10-22
- source: practice-exams/13-other-services-exam.md#Q8

A research team needs to schedule and downlink data from satellites without owning ground-station infrastructure. Which service?

- A. AWS Snowmobile
- B. AWS Ground Station
- C. AWS IoT Core
- D. AWS Outposts

**Answer:** B

**Explanation:** AWS Ground Station is a managed network of antennas: teams schedule satellite contacts and downlink data directly into AWS without building ground stations.
- AWS Snowmobile: retired (full shutdown in 2024), and it was a truck for offline data transfer.
- AWS IoT Core: connects IoT devices over MQTT, not satellites.
- AWS Outposts: AWS infrastructure on premises, with no satellite antennas.
> 🇻🇳 Điều khiển/tải dữ liệu vệ tinh mà không cần trạm mặt đất riêng → AWS Ground Station.

---

## Q 13-v1-09
- domain: resilient
- task: 2.2
- topic: other
- services: Amazon Connect
- difficulty: easy
- time: 45
- enriched: 2026-10-22
- source: practice-exams/13-other-services-exam.md#Q9

Which service provides a fully managed, omnichannel cloud contact center?

- A. Amazon Connect
- B. Amazon WorkSpaces
- C. Amazon Lex
- D. Amazon SES

**Answer:** A

**Explanation:** Amazon Connect is a fully managed omnichannel cloud contact center (voice, chat, tasks) with pay-per-use pricing and no telephony hardware.
- Amazon WorkSpaces: virtual desktops for staff, not a contact center.
- Amazon Lex: builds chatbots that can plug into Connect, but it is not a contact center by itself.
- Amazon SES: sends email only.
> 🇻🇳 Contact center đa kênh được quản lý hoàn toàn → Amazon Connect.

---

## Q 13-v1-10
- domain: resilient
- task: 2.1
- topic: other
- services: EventBridge
- tags: event-driven
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q10

A company wants a simple recurring schedule (cron) to invoke targets at scale with one-time or recurring schedules and time zones. Which service?

- A. AWS Config
- B. AWS Step Functions wait
- C. Amazon SQS delay queue
- D. Amazon EventBridge Scheduler

**Answer:** D

**Explanation:** Flexible cron/one-time schedules at scale = EventBridge Scheduler.

---

## Q 13-v1-11
- domain: resilient
- task: 2.2
- topic: other
- services: AWS Backup
- tags: compliance, s3-lifecycle
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q11

Which service is BEST for centrally managing backup retention to meet a 7-year compliance requirement across services?

- A. S3 only
- B. AWS Backup with backup vaults and lifecycle policies
- C. Manual EBS snapshots
- D. CloudWatch Logs retention

**Answer:** B

**Explanation:** 7-year retention across services = AWS Backup vaults + lifecycle.

---

## Q 13-v1-12
- domain: resilient
- task: 2.2
- topic: other
- difficulty: easy
- time: 45
- enriched: 2026-10-22
- source: practice-exams/13-other-services-exam.md#Q12

A team needs human workers to perform small tasks (data labeling, content moderation) at scale (crowdsourcing). Which service?

- A. Amazon Connect
- B. Amazon SageMaker AI endpoints
- C. AWS Lambda
- D. Amazon Mechanical Turk

**Answer:** D

**Explanation:** Amazon Mechanical Turk is a crowdsourcing marketplace where human workers complete small tasks such as data labeling or content moderation at scale.
- Amazon Connect: cloud contact center.
- Amazon SageMaker AI endpoints: host trained models for inference; no human workers.
- AWS Lambda: runs code, not human tasks.
> 🇻🇳 Thuê người làm việc nhỏ quy mô lớn (crowdsourcing) → Amazon Mechanical Turk.

---

## Q 13-v1-13
- domain: resilient
- task: 2.2
- topic: other
- services: Outposts
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q13

Which statement about AWS Outposts is correct?

- A. It is a serverless function service
- B. It is only for satellite communications
- C. It runs AWS services in your own data center as a hybrid extension
- D. It is a CDN

**Answer:** C

**Explanation:** Outposts = AWS services in your data center (hybrid).

---

## Q 13-v1-14
- domain: resilient
- task: 2.2
- topic: other
- services: AWS Backup, DynamoDB
- tags: pitr
- difficulty: easy
- time: 50
- source: practice-exams/13-other-services-exam.md#Q14

A company wants AWS Backup to protect Amazon DynamoDB tables with point-in-time recovery and scheduled backups. Is this supported?

- A. No, DynamoDB cannot be backed up
- B. Only via manual exports to S3
- C. Yes, AWS Backup supports DynamoDB
- D. Only with Global Tables

**Answer:** C

**Explanation:** AWS Backup supports DynamoDB.

---

## Q 13-v1-15
- domain: performance
- task: 3.2
- topic: other
- services: AppStream 2.0
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q15

Which service is appropriate for streaming GPU-accelerated 3D applications to remote users?

- A. Amazon SES
- B. AWS Backup
- C. AWS IoT Core
- D. Amazon AppStream 2.0

**Answer:** D

**Explanation:** Stream GPU 3D apps to remote users = AppStream 2.0.

---

## Q 13-v1-16
- domain: performance
- task: 3.2
- topic: other
- services: Outposts
- difficulty: easy
- time: 45
- enriched: 2026-10-22
- source: practice-exams/13-other-services-exam.md#Q16

A hybrid setup needs consistent AWS APIs both in-Region and on-premises for a low-latency manufacturing app. Which is BEST?

- A. AWS Local Zones
- B. AWS Outposts
- C. AWS Ground Station
- D. CloudFront

**Answer:** B

**Explanation:** AWS Outposts installs AWS-managed racks or servers on premises that run the same AWS APIs, tools and services as the Region, for low-latency local processing.
- AWS Local Zones: extend a Region into a metro area, but the infrastructure runs in AWS facilities, not inside the factory.
- AWS Ground Station: satellite communications.
- CloudFront: caches content at edge locations; it does not run the application on premises.
> 🇻🇳 API AWS giống Region nhưng chạy tại chỗ, độ trễ thấp → AWS Outposts.

---

## Q 13-v1-17
- domain: resilient
- task: 2.2
- topic: other
- services: Elastic Disaster Recovery
- tags: rto-rpo
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q17

Which option provides disaster recovery by replicating on-premises and cloud servers into AWS for fast recovery (RPO/RTO minutes)?

- A. AWS Config
- B. AWS Elastic Disaster Recovery (DRS)
- C. Amazon S3 versioning
- D. AWS Backup only

**Answer:** B

**Explanation:** Replicate servers to AWS for fast DR = Elastic Disaster Recovery (DRS).

---

## Q 13-v1-18
- domain: performance
- task: 3.4
- topic: other
- services: Local Zones
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q18

A company wants to deliver low-latency live video to viewers in a specific city far from any Region with minimal architecture change. Which service?

- A. Amazon WorkSpaces
- B. AWS Outposts only
- C. Amazon Connect
- D. AWS Local Zones

**Answer:** D

**Explanation:** Low-latency delivery in distant city = Local Zones.

---

## Q 13-v1-19
- domain: performance
- task: 3.4
- topic: other
- services: Local Zones, Wavelength
- difficulty: medium
- time: 70
- source: practice-exams/13-other-services-exam.md#Q19

Which two services extend AWS infrastructure closer to users/devices for ultra-low latency? (Choose TWO)

- A. AWS Local Zones
- B. Amazon WorkSpaces
- C. Amazon SES
- D. AWS Wavelength
- E. AWS Backup

**Answer:** A, D

**Explanation:** Edge extensions = Local Zones and Wavelength.

---

## Q 13-v1-20
- domain: resilient
- task: 2.2
- topic: other
- services: AWS Backup, Organizations
- tags: cross-account-access, multi-region
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q20

A company must centralize cross-account, cross-Region backup management with a single policy. Which feature supports this?

- A. Per-account manual snapshots
- B. AWS Backup with Organizations (backup policies)
- C. CloudTrail
- D. AWS Budgets

**Answer:** B

**Explanation:** Cross-account/Region central backup policy = AWS Backup + Organizations.
