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
- status: retired

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
- enriched: 2026-10-22
- source: practice-exams/13-other-services-exam-v2.md#Q8

A company wants a managed cloud contact center for customer service. Which service?

- A. Amazon Lex
- B. Amazon Connect
- C. WorkMail
- D. Amazon WorkSpaces

**Answer:** B

**Explanation:** Amazon Connect is a fully managed cloud contact center for customer service, with voice and chat channels and pay-per-use pricing.
- Amazon Lex: chatbots that can be added to Connect, not a contact center by itself.
- WorkMail: business email and calendars.
- Amazon WorkSpaces: virtual desktops.
> 🇻🇳 Contact center trên cloud được quản lý → Amazon Connect.

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
- enriched: 2026-10-22
- source: practice-exams/13-other-services-exam-v2.md#Q10

A company wants managed business email and calendaring. Which service?

- A. SES
- B. Amazon Connect
- C. Amazon WorkMail
- D. Amazon WorkSpaces

**Answer:** C

**Explanation:** Amazon WorkMail is a managed business email and calendaring service that works with Microsoft Outlook and mobile clients.
- SES: sends application email (transactional/marketing); no user mailboxes or calendars.
- Amazon Connect: cloud contact center.
- Amazon WorkSpaces: virtual desktops, not an email service.
> 🇻🇳 Email + lịch làm việc được quản lý → Amazon WorkMail.

---

## Q 13-v2-11
- domain: performance
- task: 3.2
- topic: other
- services: Outposts, Local Zones
- difficulty: hard
- time: 130
- enriched: 2026-10-22
- source: practice-exams/13-other-services-exam-v2.md#Q11

A company must keep a regulated workload and its data inside its own data center while using the same AWS APIs and tools as in the Region. It also runs latency-sensitive game servers that need single-digit millisecond latency for players in a large city far from any AWS Region. Which TWO services should a solutions architect use? (Choose TWO)

- A. AWS Local Zones close to the end users for the game servers
- B. AWS Outposts racks installed on premises for the compliance workload
- C. Amazon CloudFront in front of the game servers in the Region
- D. AWS Direct Connect from the data center to the nearest Region
- E. AWS Global Accelerator in front of the game servers in the Region

**Answer:** A, B

**Explanation:** Outposts racks run AWS infrastructure and APIs inside the company's data center, so regulated data never leaves the premises, and Local Zones place compute in a large metro area far from a Region, giving nearby players single-digit millisecond latency.
- CloudFront: caches content at the edge; the game servers still run in the distant Region.
- Direct Connect: a private link to the Region; the regulated workload would then run outside the data center.
- Global Accelerator: optimizes the path to Regional endpoints but cannot remove the distance to the Region.
> 🇻🇳 Dữ liệu phải nằm on-prem → Outposts; người chơi ở đô thị xa Region cần độ trễ vài ms → Local Zones.

---

## Q 13-v2-12
- domain: resilient
- task: 2.2
- topic: other
- services: AWS Backup
- tags: s3-object-lock, compliance
- difficulty: hard
- time: 90
- enriched: 2026-10-21
- source: practice-exams/13-other-services-exam-v2.md#Q12

AWS Backup must enforce that backups cannot be deleted before a retention period, even by admins (ransomware protection). Which feature?

- A. S3 Object Lock applied directly to the backup vault's underlying storage
- B. An IAM policy that denies the backup-delete action for all users
- C. A KMS key policy that restricts who can decrypt the backup data
- D. Vault Lock in compliance mode, which blocks deletion or retention shortening even by the account's root user

**Answer:** D

**Explanation:** Vault Lock in compliance mode makes the retention policy immutable: once locked, nobody — including the account root user — can delete a backup or shorten its retention period before it expires, which is exactly the ransomware-resistant guarantee required here.
- S3 Object Lock on the vault's storage: backup vaults are not buckets you apply Object Lock to directly; vault-level immutability comes from Vault Lock, not S3's feature.
- An IAM deny policy: it only stops users without permission to change it; an admin with sufficient rights can still edit or remove the policy and then delete the backup.
- A KMS key policy restricting decryption: that protects confidentiality, not deletion — the encrypted backup object could still be deleted.
> 🇻🇳 Cần khoá retention không ai sửa/xoá được kể cả admin → Vault Lock compliance mode; IAM/KMS vẫn có thể bị người có quyền thay đổi.

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
