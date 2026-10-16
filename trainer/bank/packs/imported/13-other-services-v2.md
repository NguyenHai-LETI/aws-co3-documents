---
pack: saa-13-other-services-v2
title: 13 · Other Services · V2
exam: SAA-C03
origin: imported
source: practice-exams/13-other-services-exam-v2.md
created: 2026-10-16
---

# 13 · Other Services · V2

> Imported from `practice-exams/13-other-services-exam-v2.md` + `13-other-services-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 13-v2-01
- domain: resilient
- task: 2.2
- topic: other
- services: WorkSpaces
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q1

A company must provide managed virtual desktops (DaaS) to remote employees. Which service?

- A. Amazon WorkSpaces
- B. Amazon EC2
- C. AWS Outposts
- D. Amazon AppStream 2.0

**Answer:** A

**Explanation:** Managed virtual desktops (DaaS) = Amazon WorkSpaces.

---

## Q 13-v2-02
- domain: resilient
- task: 2.2
- topic: other
- services: AppStream 2.0
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q2

A company must stream a desktop application to users' browsers without installing it locally. Which service?

- A. Amazon WorkSpaces
- B. Amazon AppStream 2.0
- C. Lightsail
- D. WorkDocs

**Answer:** B

**Explanation:** Stream desktop app to browser = Amazon AppStream 2.0.

---

## Q 13-v2-03
- domain: performance
- task: 3.2
- topic: other
- services: Outposts
- difficulty: medium
- time: 55
- source: practice-exams/13-other-services-exam-v2.md#Q3

A company needs AWS infrastructure (compute/storage) running physically in its own data center for low latency and data residency. Which service?

- A. AWS Local Zones
- B. Snowball
- C. AWS Outposts
- D. AWS Wavelength

**Answer:** C

**Explanation:** AWS infra in your data center, residency = AWS Outposts.

---

## Q 13-v2-04
- domain: performance
- task: 3.4
- topic: other
- services: Local Zones
- difficulty: medium
- time: 55
- source: practice-exams/13-other-services-exam-v2.md#Q4

An application needs single-digit millisecond latency to end users in a specific metro area near, but not in, an AWS Region. Which service?

- A. CloudFront
- B. AWS Outposts
- C. Global Accelerator
- D. AWS Local Zones

**Answer:** D

**Explanation:** Low latency in metro near a Region = AWS Local Zones.

---

## Q 13-v2-05
- domain: performance
- task: 3.4
- topic: other
- services: Wavelength
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q5

A mobile app requires ultra-low latency by running compute at the edge of 5G networks. Which service?

- A. AWS Wavelength
- B. Local Zones
- C. Direct Connect
- D. AWS Outposts

**Answer:** A

**Explanation:** Ultra-low latency at 5G edge = AWS Wavelength.

---

## Q 13-v2-06
- domain: resilient
- task: 2.2
- topic: other
- services: AWS Backup, EBS, RDS, DynamoDB, EFS
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q6

A company wants a centralized, policy-based backup service across EBS, RDS, DynamoDB, EFS, and more. Which service?

- A. AWS Backup
- B. Storage Gateway
- C. EBS snapshots only
- D. S3 lifecycle

**Answer:** A

**Explanation:** Centralized policy-based backups across services = AWS Backup.

---

## Q 13-v2-07
- domain: resilient
- task: 2.2
- topic: other
- services: Elastic Disaster Recovery
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q7

A company needs disaster recovery that continuously replicates on-premises servers to AWS for fast failover. Which service?

- A. Snowball
- B. DataSync
- C. AWS Elastic Disaster Recovery (DRS)
- D. AWS Backup

**Answer:** C

**Explanation:** Continuous replication DR for on-prem servers = Elastic Disaster Recovery (DRS).

---

## Q 13-v2-08
- domain: resilient
- task: 2.2
- topic: other
- services: Amazon Connect
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q8

A company wants a managed cloud contact center for customer service. Which service?

- A. Amazon Pinpoint
- B. Amazon Connect
- C. WorkMail
- D. Amazon Chime

**Answer:** B

**Explanation:** Managed cloud contact center = Amazon Connect.

---

## Q 13-v2-09
- domain: resilient
- task: 2.2
- topic: other
- services: IoT Core
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q9

A company must connect and manage millions of IoT devices sending telemetry. Which service?

- A. Kinesis only
- B. SQS
- C. AppSync
- D. AWS IoT Core

**Answer:** D

**Explanation:** Connect/manage millions of IoT devices = AWS IoT Core.

---

## Q 13-v2-10
- domain: resilient
- task: 2.2
- topic: other
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q10

A company wants managed business email and calendaring. Which service?

- A. SES
- B. Amazon Connect
- C. Amazon WorkMail
- D. Amazon WorkDocs

**Answer:** C

**Explanation:** Managed email + calendaring = Amazon WorkMail.

---

## Q 13-v2-11
- domain: performance
- task: 3.2
- topic: other
- services: Outposts, Local Zones
- difficulty: hard
- time: 95
- source: practice-exams/13-other-services-exam-v2.md#Q11

A regulated workload must keep data on-premises for residency but use AWS APIs/services locally, with a consistent hybrid experience. Which two are appropriate? (Choose TWO)

- A. Local Zones for metro low latency
- B. AWS Outposts (rack/servers)
- C. CloudFront
- D. Snowmobile
- E. Global Accelerator

**Answer:** A, B

**Explanation:** On-prem residency + metro low latency = Outposts + Local Zones.

---

## Q 13-v2-12
- domain: resilient
- task: 2.2
- topic: other
- services: AWS Backup
- tags: s3-object-lock, compliance
- difficulty: hard
- time: 70
- source: practice-exams/13-other-services-exam-v2.md#Q12

AWS Backup must enforce that backups cannot be deleted before a retention period, even by admins (ransomware protection). Which feature?

- A. S3 Object Lock only
- B. IAM policy only
- C. KMS grant
- D. AWS Backup Vault Lock (compliance mode)

**Answer:** D

**Explanation:** Immutable backups vs ransomware = AWS Backup Vault Lock (compliance mode).

---

## Q 13-v2-13
- domain: resilient
- task: 2.2
- topic: other
- services: Organizations, AWS Backup
- tags: multi-region, cross-account-access
- difficulty: hard
- time: 95
- source: practice-exams/13-other-services-exam-v2.md#Q13

A company needs cross-Region, cross-account centralized backups with a single policy. Which two AWS Backup features apply? (Choose TWO)

- A. Storage Gateway tapes
- B. Cross-account backup via Organizations
- C. EFS lifecycle only
- D. Manual snapshots per resource only
- E. Backup plans with cross-Region copy

**Answer:** B, E

**Explanation:** Central backups = cross-Region copy + cross-account via Organizations.

---

## Q 13-v2-14
- domain: resilient
- task: 2.2
- topic: other
- services: Elastic Disaster Recovery
- difficulty: hard
- time: 75
- source: practice-exams/13-other-services-exam-v2.md#Q14

Elastic Disaster Recovery (DRS) minimizes cost during steady state. How does it achieve low-cost standby?

- A. Running full-size duplicate instances 24/7
- B. Continuous block-level replication into low-cost staging, launching full instances only on failover/drill
- C. Taking daily snapshots only
- D. Using Snowball for replication

**Answer:** B

**Explanation:** DRS low-cost standby = continuous block replication to cheap staging, full instances only on failover.

---

## Q 13-v2-15
- domain: resilient
- task: 2.2
- topic: other
- services: AppStream 2.0, WorkSpaces
- tags: streaming-ingestion
- difficulty: hard
- time: 70
- source: practice-exams/13-other-services-exam-v2.md#Q15

A company must give contractors temporary, non-persistent virtual desktops that reset after each session. Which WorkSpaces/related option fits?

- A. EC2 with manual reset
- B. Non-persistent streaming (AppStream 2.0) or WorkSpaces with rebuild
- C. Outposts desktops
- D. Persistent WorkSpaces only

**Answer:** B

**Explanation:** Temporary reset-after-session desktops = non-persistent AppStream 2.0 / WorkSpaces rebuild.
