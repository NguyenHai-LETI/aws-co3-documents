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
- topic: other
- services: AWS Backup, EC2, EBS, RDS, DynamoDB, EFS, FSx
- tags: compliance
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q1

A company needs centralized, policy-based backups across EC2, EBS, RDS, DynamoDB, EFS, and FSx with compliance reporting. Which service?

- A. AWS Backup
- B. EBS Snapshots only
- C. AWS DataSync
- D. S3 Lifecycle

**Answer:** A

**Explanation:** Central policy-based backups across services = AWS Backup.

---

## Q 13-v1-02
- domain: resilient
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
- topic: other
- services: AppStream 2.0
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q3

A company wants to stream a specific desktop APPLICATION to users' browsers without installing it locally. Which service?

- A. Amazon AppStream 2.0
- B. Amazon WorkSpaces
- C. Amazon Lightsail
- D. Amazon Connect

**Answer:** A

**Explanation:** Stream a single app to browser = AppStream 2.0.

---

## Q 13-v1-04
- domain: resilient
- topic: other
- services: IoT Core
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q4

A factory must connect thousands of IoT devices using MQTT, with device state shadows and a rules engine. Which service?

- A. AWS IoT Core
- B. Amazon Kinesis
- C. AWS Ground Station
- D. Amazon MQ

**Answer:** A

**Explanation:** MQTT IoT devices + shadows + rules = IoT Core.

---

## Q 13-v1-05
- domain: performance
- topic: other
- services: Outposts
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q5

A regulated workload must run AWS compute and services ON-PREMISES in the company's data center for low latency and data residency. Which service?

- A. AWS Outposts
- B. AWS Wavelength
- C. AWS Local Zones
- D. Amazon WorkSpaces

**Answer:** A

**Explanation:** AWS services on-prem (data residency) = Outposts.

---

## Q 13-v1-06
- domain: performance
- topic: other
- services: Local Zones
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q6

A gaming company needs single-digit millisecond latency to end users in a metro area not near a Region. Which service?

- A. AWS Local Zones
- B. AWS Outposts
- C. AWS Snowcone
- D. AWS Ground Station

**Answer:** A

**Explanation:** Low latency metro near users = Local Zones.

---

## Q 13-v1-07
- domain: performance
- topic: other
- services: Wavelength
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q7

An application needs ultra-low latency to mobile users over 5G carrier networks. Which service?

- A. AWS Wavelength
- B. AWS Local Zones
- C. CloudFront
- D. Global Accelerator

**Answer:** A

**Explanation:** 5G edge ultra-low latency = Wavelength.

---

## Q 13-v1-08
- domain: resilient
- topic: other
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q8

A research team needs to schedule and downlink data from satellites without owning ground-station infrastructure. Which service?

- A. AWS Ground Station
- B. AWS IoT Core
- C. AWS Outposts
- D. AWS Snowmobile

**Answer:** A

**Explanation:** Satellite downlink as a service = Ground Station.

---

## Q 13-v1-09
- domain: resilient
- topic: other
- services: Amazon Connect
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q9

Which service provides a fully managed, omnichannel cloud contact center?

- A. Amazon Connect
- B. Amazon Pinpoint
- C. Amazon SES
- D. Amazon Chime

**Answer:** A

**Explanation:** Managed omnichannel contact center = Amazon Connect.

---

## Q 13-v1-10
- domain: resilient
- topic: other
- services: EventBridge
- tags: event-driven
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q10

A company wants a simple recurring schedule (cron) to invoke targets at scale with one-time or recurring schedules and time zones. Which service?

- A. Amazon EventBridge Scheduler
- B. Amazon SQS delay queue
- C. AWS Step Functions wait
- D. AWS Config

**Answer:** A

**Explanation:** Flexible cron/one-time schedules at scale = EventBridge Scheduler.

---

## Q 13-v1-11
- domain: resilient
- topic: other
- services: AWS Backup
- tags: compliance, s3-lifecycle
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q11

Which service is BEST for centrally managing backup retention to meet a 7-year compliance requirement across services?

- A. AWS Backup with backup vaults and lifecycle policies
- B. Manual EBS snapshots
- C. S3 only
- D. CloudWatch Logs retention

**Answer:** A

**Explanation:** 7-year retention across services = AWS Backup vaults + lifecycle.

---

## Q 13-v1-12
- domain: resilient
- topic: other
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q12

A team needs human workers to perform small tasks (data labeling, content moderation) at scale (crowdsourcing). Which service?

- A. Amazon Mechanical Turk
- B. AWS Lambda
- C. Amazon SageMaker endpoints
- D. Amazon Connect

**Answer:** A

**Explanation:** Crowdsourced human tasks = Mechanical Turk.

---

## Q 13-v1-13
- domain: resilient
- topic: other
- services: Outposts
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q13

Which statement about AWS Outposts is correct?

- A. It runs AWS services in your own data center as a hybrid extension
- B. It is a CDN
- C. It is a serverless function service
- D. It is only for satellite communications

**Answer:** A

**Explanation:** Outposts = AWS services in your data center (hybrid).

---

## Q 13-v1-14
- domain: resilient
- topic: other
- services: AWS Backup, DynamoDB
- tags: pitr
- difficulty: easy
- time: 50
- source: practice-exams/13-other-services-exam.md#Q14

A company wants AWS Backup to protect Amazon DynamoDB tables with point-in-time recovery and scheduled backups. Is this supported?

- A. Yes, AWS Backup supports DynamoDB
- B. No, DynamoDB cannot be backed up
- C. Only via manual exports to S3
- D. Only with Global Tables

**Answer:** A

**Explanation:** AWS Backup supports DynamoDB.

---

## Q 13-v1-15
- domain: performance
- topic: other
- services: AppStream 2.0
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q15

Which service is appropriate for streaming GPU-accelerated 3D applications to remote users?

- A. Amazon AppStream 2.0
- B. AWS Backup
- C. Amazon SES
- D. AWS IoT Core

**Answer:** A

**Explanation:** Stream GPU 3D apps to remote users = AppStream 2.0.

---

## Q 13-v1-16
- domain: performance
- topic: other
- services: Outposts
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q16

A hybrid setup needs consistent AWS APIs both in-Region and on-premises for a low-latency manufacturing app. Which is BEST?

- A. AWS Outposts
- B. CloudFront
- C. AWS Snowmobile
- D. AWS Ground Station

**Answer:** A

**Explanation:** Consistent AWS APIs on-prem, low latency = Outposts.

---

## Q 13-v1-17
- domain: resilient
- topic: other
- services: Elastic Disaster Recovery
- tags: rto-rpo
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q17

Which option provides disaster recovery by replicating on-premises and cloud servers into AWS for fast recovery (RPO/RTO minutes)?

- A. AWS Elastic Disaster Recovery (DRS)
- B. AWS Backup only
- C. Amazon S3 versioning
- D. AWS Config

**Answer:** A

**Explanation:** Replicate servers to AWS for fast DR = Elastic Disaster Recovery (DRS).

---

## Q 13-v1-18
- domain: performance
- topic: other
- services: Local Zones
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q18

A company wants to deliver low-latency live video to viewers in a specific city far from any Region with minimal architecture change. Which service?

- A. AWS Local Zones
- B. Amazon WorkSpaces
- C. AWS Outposts only
- D. Amazon Connect

**Answer:** A

**Explanation:** Low-latency delivery in distant city = Local Zones.

---

## Q 13-v1-19
- domain: performance
- topic: other
- services: Local Zones, Wavelength
- difficulty: medium
- time: 70
- source: practice-exams/13-other-services-exam.md#Q19

Which two services extend AWS infrastructure closer to users/devices for ultra-low latency? (Choose TWO)

- A. AWS Local Zones
- B. AWS Wavelength
- C. Amazon WorkSpaces
- D. AWS Backup
- E. Amazon SES

**Answer:** A, B

**Explanation:** Edge extensions = Local Zones and Wavelength.

---

## Q 13-v1-20
- domain: resilient
- topic: other
- services: AWS Backup, Organizations
- tags: cross-account-access, multi-region
- difficulty: easy
- time: 45
- source: practice-exams/13-other-services-exam.md#Q20

A company must centralize cross-account, cross-Region backup management with a single policy. Which feature supports this?

- A. AWS Backup with Organizations (backup policies)
- B. Per-account manual snapshots
- C. CloudTrail
- D. AWS Budgets

**Answer:** A

**Explanation:** Cross-account/Region central backup policy = AWS Backup + Organizations.
