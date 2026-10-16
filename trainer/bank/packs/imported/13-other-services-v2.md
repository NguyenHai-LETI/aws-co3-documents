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
- topic: other
- services: WorkSpaces
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q1

A company must provide managed virtual desktops (DaaS) to remote employees. Which service?

- A. Amazon WorkSpaces
- B. Amazon AppStream 2.0
- C. Amazon EC2
- D. AWS Outposts

**Answer:** A

**Explanation:** Managed virtual desktops (DaaS) = Amazon WorkSpaces.

---

## Q 13-v2-02
- domain: resilient
- topic: other
- services: AppStream 2.0
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q2

A company must stream a desktop application to users' browsers without installing it locally. Which service?

- A. Amazon AppStream 2.0
- B. Amazon WorkSpaces
- C. Lightsail
- D. WorkDocs

**Answer:** A

**Explanation:** Stream desktop app to browser = Amazon AppStream 2.0.

---

## Q 13-v2-03
- domain: performance
- topic: other
- services: Outposts
- difficulty: medium
- time: 55
- source: practice-exams/13-other-services-exam-v2.md#Q3

A company needs AWS infrastructure (compute/storage) running physically in its own data center for low latency and data residency. Which service?

- A. AWS Outposts
- B. AWS Local Zones
- C. AWS Wavelength
- D. Snowball

**Answer:** A

**Explanation:** AWS infra in your data center, residency = AWS Outposts.

---

## Q 13-v2-04
- domain: performance
- topic: other
- services: Local Zones
- difficulty: medium
- time: 55
- source: practice-exams/13-other-services-exam-v2.md#Q4

An application needs single-digit millisecond latency to end users in a specific metro area near, but not in, an AWS Region. Which service?

- A. AWS Local Zones
- B. AWS Outposts
- C. Global Accelerator
- D. CloudFront

**Answer:** A

**Explanation:** Low latency in metro near a Region = AWS Local Zones.

---

## Q 13-v2-05
- domain: performance
- topic: other
- services: Wavelength
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q5

A mobile app requires ultra-low latency by running compute at the edge of 5G networks. Which service?

- A. AWS Wavelength
- B. AWS Outposts
- C. Local Zones
- D. Direct Connect

**Answer:** A

**Explanation:** Ultra-low latency at 5G edge = AWS Wavelength.

---

## Q 13-v2-06
- domain: resilient
- topic: other
- services: AWS Backup, EBS, RDS, DynamoDB, EFS
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q6

A company wants a centralized, policy-based backup service across EBS, RDS, DynamoDB, EFS, and more. Which service?

- A. AWS Backup
- B. EBS snapshots only
- C. S3 lifecycle
- D. Storage Gateway

**Answer:** A

**Explanation:** Centralized policy-based backups across services = AWS Backup.

---

## Q 13-v2-07
- domain: resilient
- topic: other
- services: Elastic Disaster Recovery
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q7

A company needs disaster recovery that continuously replicates on-premises servers to AWS for fast failover. Which service?

- A. AWS Elastic Disaster Recovery (DRS)
- B. AWS Backup
- C. DataSync
- D. Snowball

**Answer:** A

**Explanation:** Continuous replication DR for on-prem servers = Elastic Disaster Recovery (DRS).

---

## Q 13-v2-08
- domain: resilient
- topic: other
- services: Amazon Connect
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q8

A company wants a managed cloud contact center for customer service. Which service?

- A. Amazon Connect
- B. Amazon Chime
- C. Amazon Pinpoint
- D. WorkMail

**Answer:** A

**Explanation:** Managed cloud contact center = Amazon Connect.

---

## Q 13-v2-09
- domain: resilient
- topic: other
- services: IoT Core
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q9

A company must connect and manage millions of IoT devices sending telemetry. Which service?

- A. AWS IoT Core
- B. Kinesis only
- C. SQS
- D. AppSync

**Answer:** A

**Explanation:** Connect/manage millions of IoT devices = AWS IoT Core.

---

## Q 13-v2-10
- domain: resilient
- topic: other
- difficulty: medium
- time: 50
- source: practice-exams/13-other-services-exam-v2.md#Q10

A company wants managed business email and calendaring. Which service?

- A. Amazon WorkMail
- B. Amazon WorkDocs
- C. Amazon Connect
- D. SES

**Answer:** A

**Explanation:** Managed email + calendaring = Amazon WorkMail.

---

## Q 13-v2-11
- domain: performance
- topic: other
- services: Outposts, Local Zones
- difficulty: hard
- time: 95
- source: practice-exams/13-other-services-exam-v2.md#Q11

A regulated workload must keep data on-premises for residency but use AWS APIs/services locally, with a consistent hybrid experience. Which two are appropriate? (Choose TWO)

- A. AWS Outposts (rack/servers)
- B. Local Zones for metro low latency
- C. Snowmobile
- D. CloudFront
- E. Global Accelerator

**Answer:** A, B

**Explanation:** On-prem residency + metro low latency = Outposts + Local Zones.

---

## Q 13-v2-12
- domain: resilient
- topic: other
- services: AWS Backup
- tags: s3-object-lock, compliance
- difficulty: hard
- time: 70
- source: practice-exams/13-other-services-exam-v2.md#Q12

AWS Backup must enforce that backups cannot be deleted before a retention period, even by admins (ransomware protection). Which feature?

- A. AWS Backup Vault Lock (compliance mode)
- B. S3 Object Lock only
- C. IAM policy only
- D. KMS grant

**Answer:** A

**Explanation:** Immutable backups vs ransomware = AWS Backup Vault Lock (compliance mode).

---

## Q 13-v2-13
- domain: resilient
- topic: other
- services: Organizations, AWS Backup
- tags: multi-region, cross-account-access
- difficulty: hard
- time: 95
- source: practice-exams/13-other-services-exam-v2.md#Q13

A company needs cross-Region, cross-account centralized backups with a single policy. Which two AWS Backup features apply? (Choose TWO)

- A. Backup plans with cross-Region copy
- B. Cross-account backup via Organizations
- C. Manual snapshots per resource only
- D. Storage Gateway tapes
- E. EFS lifecycle only

**Answer:** A, B

**Explanation:** Central backups = cross-Region copy + cross-account via Organizations.

---

## Q 13-v2-14
- domain: resilient
- topic: other
- services: Elastic Disaster Recovery
- difficulty: hard
- time: 75
- source: practice-exams/13-other-services-exam-v2.md#Q14

Elastic Disaster Recovery (DRS) minimizes cost during steady state. How does it achieve low-cost standby?

- A. Continuous block-level replication into low-cost staging, launching full instances only on failover/drill
- B. Running full-size duplicate instances 24/7
- C. Taking daily snapshots only
- D. Using Snowball for replication

**Answer:** A

**Explanation:** DRS low-cost standby = continuous block replication to cheap staging, full instances only on failover.

---

## Q 13-v2-15
- domain: resilient
- topic: other
- services: AppStream 2.0, WorkSpaces
- tags: streaming-ingestion
- difficulty: hard
- time: 70
- source: practice-exams/13-other-services-exam-v2.md#Q15

A company must give contractors temporary, non-persistent virtual desktops that reset after each session. Which WorkSpaces/related option fits?

- A. Non-persistent streaming (AppStream 2.0) or WorkSpaces with rebuild
- B. Persistent WorkSpaces only
- C. EC2 with manual reset
- D. Outposts desktops

**Answer:** A

**Explanation:** Temporary reset-after-session desktops = non-persistent AppStream 2.0 / WorkSpaces rebuild.
