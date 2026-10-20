---
pack: saa-02-storage-services-v1
title: 02 · Storage Services · V1
exam: SAA-C03
origin: imported
source: practice-exams/02-storage-services-exam.md
created: 2026-10-16
---

# 02 · Storage Services · V1

> Imported from `practice-exams/02-storage-services-exam.md` + `02-storage-services-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 02-v1-01
- domain: cost
- task: 4.1
- topic: storage
- services: S3, S3 Glacier
- tags: s3-storage-classes, s3-glacier-tiers
- difficulty: easy
- time: 60
- source: practice-exams/02-storage-services-exam.md#Q1

Logs are accessed frequently for 30 days, then rarely but must be retrievable within milliseconds for 1 year, then archived for 7 years where 12-hour retrieval is acceptable. Which lifecycle is MOST cost-effective?

- A. S3 Standard → S3 Standard-IA → S3 Glacier Deep Archive
- B. S3 Intelligent-Tiering → S3 Standard → Glacier Flexible Retrieval
- C. S3 Standard → S3 Glacier Instant Retrieval → S3 Standard-IA
- D. S3 Standard → S3 One Zone-IA → S3 Glacier Deep Archive

**Answer:** A

**Explanation:** Frequent→IA (ms access for a year)→Deep Archive (12h ok, cheapest long-term).

---

## Q 02-v1-02
- domain: performance
- task: 3.1
- topic: storage
- services: S3
- tags: s3-storage-classes, s3-intelligent-tiering
- difficulty: easy
- time: 45
- source: practice-exams/02-storage-services-exam.md#Q2

A bucket stores data with unknown and changing access patterns. The company wants automatic cost optimization without performance impact or retrieval fees. Which storage class is BEST?

- A. S3 One Zone-IA
- B. S3 Standard-IA
- C. S3 Intelligent-Tiering
- D. S3 Standard

**Answer:** C

**Explanation:** Unknown/changing access + auto-tiering, no retrieval fee = Intelligent-Tiering.

---

## Q 02-v1-03
- domain: performance
- task: 3.1
- topic: storage
- services: EFS, EC2
- tags: compliance
- difficulty: easy
- time: 45
- source: practice-exams/02-storage-services-exam.md#Q3

Multiple Linux EC2 instances across AZs need a shared, POSIX-compliant file system that scales automatically. Which service?

- A. Amazon S3
- B. Amazon FSx for Windows File Server
- C. Amazon EFS
- D. Amazon EBS Multi-Attach

**Answer:** C

**Explanation:** Shared multi-AZ POSIX file system for Linux = Amazon EFS.

---

## Q 02-v1-04
- domain: performance
- task: 3.1
- topic: storage
- services: EC2, EBS
- tags: ebs-volume-types
- difficulty: easy
- time: 45
- source: practice-exams/02-storage-services-exam.md#Q4

A relational database on EC2 needs a volume delivering 50,000 IOPS with consistent low latency. Which EBS volume type?

- A. gp2
- B. io2 / io2 Block Express
- C. st1
- D. gp3

**Answer:** B

**Explanation:** 50k IOPS consistent low latency = io2 / io2 Block Express.

---

## Q 02-v1-05
- domain: secure
- task: 1.3
- topic: storage
- services: S3
- tags: s3-object-lock, compliance
- difficulty: easy
- time: 50
- source: practice-exams/02-storage-services-exam.md#Q5

To meet a regulatory requirement that objects cannot be deleted or overwritten by anyone (including root) for 5 years, which feature should be enabled?

- A. MFA Delete
- B. S3 Object Lock in Governance mode
- C. S3 Versioning only
- D. S3 Object Lock in Compliance mode

**Answer:** D

**Explanation:** Cannot delete even by root = S3 Object Lock Compliance mode.

---

## Q 02-v1-06
- domain: resilient
- task: 2.2
- topic: storage
- services: S3
- tags: multi-region, compliance, s3-versioning
- difficulty: easy
- time: 50
- source: practice-exams/02-storage-services-exam.md#Q6

A company must replicate S3 objects to another Region for disaster recovery and compliance. What is REQUIRED for replication?

- A. Versioning enabled on source and destination buckets
- B. Transfer Acceleration enabled
- C. The buckets must be in the same account
- D. Object Lock enabled

**Answer:** A

**Explanation:** Replication requires Versioning on both source and destination.

---

## Q 02-v1-07
- domain: performance
- task: 3.1
- topic: storage
- services: S3, Storage Gateway
- difficulty: easy
- time: 45
- source: practice-exams/02-storage-services-exam.md#Q7

An on-premises application uses NFS/SMB and needs low-latency local access while storing data durably in Amazon S3. Which solution?

- A. AWS DataSync
- B. AWS Snowball Edge
- C. Amazon S3 File Gateway
- D. Volume Gateway (Stored)

**Answer:** C

**Explanation:** On-prem NFS/SMB with local cache backed by S3 = S3 File Gateway.

---

## Q 02-v1-08
- domain: performance
- task: 3.5
- topic: storage
- services: Snow Family
- difficulty: easy
- time: 50
- source: practice-exams/02-storage-services-exam.md#Q8

A company must transfer 600 TB to AWS within two weeks over a 200 Mbps internet link. Which solution is MOST appropriate?

- A. AWS Snowball Edge Storage Optimized
- B. AWS DataSync over the internet
- C. S3 Transfer Acceleration
- D. AWS Storage Gateway

**Answer:** A

**Explanation:** 600 TB in 2 weeks over slow link = Snowball Edge Storage Optimized.

---

## Q 02-v1-09
- domain: secure
- task: 1.3
- topic: storage
- services: EBS
- tags: db-encryption, snapshots
- difficulty: easy
- time: 50
- source: practice-exams/02-storage-services-exam.md#Q9

Which approach lets you move an unencrypted EBS volume's data to an encrypted volume?

- A. Detach and re-attach the volume
- B. Use EBS Multi-Attach
- C. Toggle encryption on the existing volume
- D. Create a snapshot, copy it with encryption enabled, then create a new volume

**Answer:** D

**Explanation:** Snapshot -> copy with encryption -> new encrypted volume.

---

## Q 02-v1-10
- domain: performance
- task: 3.1
- topic: storage
- services: FSx, S3
- tags: fsx-lustre
- difficulty: easy
- time: 45
- source: practice-exams/02-storage-services-exam.md#Q10

An HPC and machine-learning workload needs a high-throughput, sub-millisecond file system tightly integrated with data in Amazon S3. Which service?

- A. Amazon FSx for Windows File Server
- B. Amazon FSx for Lustre
- C. Amazon EBS st1
- D. Amazon EFS

**Answer:** B

**Explanation:** HPC/ML, sub-ms, S3-integrated, high throughput = FSx for Lustre.

---

## Q 02-v1-11
- domain: performance
- task: 3.1
- topic: storage
- services: FSx
- tags: fsx-windows
- difficulty: easy
- time: 45
- source: practice-exams/02-storage-services-exam.md#Q11

A Windows-based application needs shared storage over SMB with Active Directory integration. Which service?

- A. Amazon EFS
- B. Instance Store
- C. Amazon S3
- D. Amazon FSx for Windows File Server

**Answer:** D

**Explanation:** Windows SMB + Active Directory = FSx for Windows File Server.

---

## Q 02-v1-12
- domain: performance
- task: 3.1
- topic: storage
- services: S3
- tags: s3-transfer-acceleration
- difficulty: easy
- time: 45
- source: practice-exams/02-storage-services-exam.md#Q12

To speed up uploads of large files from users worldwide to a single S3 bucket, which feature should be used?

- A. Byte-range fetches
- B. S3 Transfer Acceleration
- C. S3 Select
- D. S3 Cross-Region Replication

**Answer:** B

**Explanation:** Faster global uploads to one bucket = S3 Transfer Acceleration.

---

## Q 02-v1-13
- domain: performance
- task: 3.1
- topic: storage
- services: S3
- tags: columnar-formats
- difficulty: easy
- time: 45
- source: practice-exams/02-storage-services-exam.md#Q13

Which design retrieves only specific rows/columns from large CSV/Parquet objects in S3 using SQL, reducing data scanned?

- A. S3 Storage Lens
- B. S3 Inventory
- C. S3 Batch Operations
- D. S3 Select

**Answer:** D

**Explanation:** SQL to retrieve subset from one object = S3 Select.

---

## Q 02-v1-14
- domain: performance
- task: 3.1
- topic: storage
- services: S3, Lambda, EventBridge
- tags: s3-event-notifications
- difficulty: easy
- time: 55
- source: practice-exams/02-storage-services-exam.md#Q14

An object-processing pipeline must trigger a Lambda function whenever a new object is created in a bucket. Which is the simplest configuration?

- A. S3 Replication to a processing bucket
- B. S3 Event Notification to Lambda (or via EventBridge)
- C. A scheduled Lambda that lists the bucket
- D. CloudTrail data events polled by Lambda

**Answer:** B

**Explanation:** New-object trigger = S3 Event Notification -> Lambda (or EventBridge).

---

## Q 02-v1-15
- domain: cost
- task: 4.1
- topic: storage
- services: S3
- tags: s3-storage-classes
- difficulty: easy
- time: 50
- source: practice-exams/02-storage-services-exam.md#Q15

A non-critical, easily reproducible dataset can tolerate the loss of a single AZ and must be stored at the lowest cost for infrequent access. Which storage class?

- A. S3 Glacier Instant Retrieval
- B. S3 Standard
- C. S3 One Zone-IA
- D. S3 Standard-IA

**Answer:** C

**Explanation:** Single-AZ tolerant, infrequent, lowest cost = S3 One Zone-IA.

---

## Q 02-v1-16
- domain: performance
- task: 3.1
- topic: storage
- services: S3
- tags: s3-storage-classes, s3-lifecycle
- difficulty: easy
- time: 45
- source: practice-exams/02-storage-services-exam.md#Q16

What is the minimum number of days an object must stay in S3 Standard before a lifecycle rule can transition it to S3 Standard-IA?

- A. 1 day
- B. 90 days
- C. 0 days
- D. 30 days

**Answer:** D

**Explanation:** Minimum 30 days in Standard before transition to Standard-IA.

---

## Q 02-v1-17
- domain: performance
- task: 3.1
- topic: storage
- services: S3
- tags: s3-versioning
- difficulty: easy
- time: 45
- source: practice-exams/02-storage-services-exam.md#Q17

A company wants to protect S3 objects against accidental deletion and keep previous copies for rollback. Which feature should be enabled?

- A. Versioning
- B. Requester Pays
- C. Cross-Region Replication
- D. Transfer Acceleration

**Answer:** A

**Explanation:** Protect against accidental delete + rollback = Versioning.

---

## Q 02-v1-18
- domain: performance
- task: 3.1
- topic: storage
- services: EBS, EC2
- tags: ebs-volume-types, ebs-multi-attach
- difficulty: easy
- time: 50
- source: practice-exams/02-storage-services-exam.md#Q18

A clustered application needs the SAME EBS volume attached to multiple EC2 instances in the same AZ concurrently. What is required?

- A. EFS instead of EBS
- B. io1/io2 volume with EBS Multi-Attach
- C. gp3 with Fast Snapshot Restore
- D. st1 throughput-optimized volume

**Answer:** B

**Explanation:** Same volume on multiple instances same AZ = io1/io2 EBS Multi-Attach.

---

## Q 02-v1-19
- domain: performance
- task: 3.5
- topic: storage
- services: DataSync, Storage Gateway
- difficulty: medium
- time: 75
- source: practice-exams/02-storage-services-exam.md#Q19

Which two AWS services let an on-premises data center perform an automated, scheduled, incremental data transfer into AWS storage? (Choose TWO)

- A. Amazon S3 Transfer Acceleration
- B. Amazon Macie
- C. AWS Snowmobile
- D. AWS DataSync
- E. AWS Storage Gateway

**Answer:** D, E

**Explanation:** Automated scheduled incremental transfer = DataSync and Storage Gateway.

---

## Q 02-v1-20
- domain: cost
- task: 4.1
- topic: storage
- services: S3, S3 Glacier
- tags: s3-storage-classes, s3-glacier-tiers
- difficulty: easy
- time: 50
- source: practice-exams/02-storage-services-exam.md#Q20

A company stores backups that are rarely accessed but, when needed, must be available within minutes a few times per year, at the lowest cost. Which storage class?

- A. S3 Standard-IA
- B. S3 Glacier Deep Archive
- C. S3 Glacier Flexible Retrieval (Expedited/Standard)
- D. S3 Intelligent-Tiering Frequent Access tier

**Answer:** C

**Explanation:** Rarely accessed, retrieve in minutes, low cost = Glacier Flexible Retrieval.
