---
pack: saa-02-storage-services-v2
title: 02 · Storage Services · V2
exam: SAA-C03
origin: imported
source: practice-exams/02-storage-services-exam-v2.md
created: 2026-10-16
---

# 02 · Storage Services · V2

> Imported from `practice-exams/02-storage-services-exam-v2.md` + `02-storage-services-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 02-v2-01
- domain: cost
- task: 4.1
- topic: storage
- services: S3
- tags: s3-storage-classes
- difficulty: medium
- time: 60
- source: practice-exams/02-storage-services-exam-v2.md#Q1

Objects are accessed frequently for 30 days, then rarely but must be retrievable in milliseconds when needed. Which lifecycle is MOST cost-effective?

- A. S3 Standard → S3 Standard-IA
- B. Keep everything in S3 Standard
- C. S3 Standard → Glacier Deep Archive
- D. S3 Standard → S3 One Zone-IA immediately

**Answer:** A

**Explanation:** Frequent then rare but instant retrieval = transition to S3 Standard-IA (min 30 days first).

---

## Q 02-v2-02
- domain: performance
- task: 3.1
- topic: storage
- services: S3
- tags: s3-lifecycle, s3-storage-classes, s3-intelligent-tiering
- difficulty: medium
- time: 55
- source: practice-exams/02-storage-services-exam-v2.md#Q2

A dataset has unpredictable, changing access patterns and the team does not want to manage lifecycle rules. Which storage class is BEST?

- A. S3 Standard
- B. S3 Intelligent-Tiering
- C. S3 Glacier Instant Retrieval
- D. S3 Standard-IA

**Answer:** B

**Explanation:** Unpredictable/changing pattern, no lifecycle management = S3 Intelligent-Tiering.

---

## Q 02-v2-03
- domain: cost
- task: 4.1
- topic: storage
- services: S3, S3 Glacier
- tags: s3-glacier-tiers
- difficulty: medium
- time: 55
- source: practice-exams/02-storage-services-exam-v2.md#Q3

Backups must be archived for 7 years at the LOWEST cost; retrieval within 12–48 hours is acceptable. Which class?

- A. S3 Glacier Flexible Retrieval
- B. S3 One Zone-IA
- C. S3 Glacier Instant Retrieval
- D. S3 Glacier Deep Archive

**Answer:** D

**Explanation:** 7-year archive, lowest cost, 12-48h retrieval OK = Glacier Deep Archive.

---

## Q 02-v2-04
- domain: secure
- task: 1.3
- topic: storage
- services: S3
- tags: s3-object-lock, compliance
- difficulty: medium
- time: 60
- source: practice-exams/02-storage-services-exam-v2.md#Q4

Regulatory rules require that financial records in S3 cannot be deleted or overwritten by anyone, including the root user, for 5 years. Which feature?

- A. S3 Versioning
- B. S3 Object Lock in Compliance mode
- C. MFA Delete
- D. Bucket policy denying Delete

**Answer:** B

**Explanation:** Cannot delete/overwrite even by root, fixed retention = Object Lock Compliance mode.

---

## Q 02-v2-05
- domain: resilient
- task: 2.2
- topic: storage
- services: S3
- tags: multi-region, s3-versioning
- difficulty: medium
- time: 55
- source: practice-exams/02-storage-services-exam-v2.md#Q5

A company must replicate S3 objects to a bucket in another Region for disaster recovery. What is a REQUIREMENT?

- A. Same-Region Replication
- B. Versioning enabled on both buckets
- C. Buckets must have the same name
- D. Objects must be in Glacier

**Answer:** B

**Explanation:** CRR requirement = Versioning enabled on both source and destination buckets.

---

## Q 02-v2-06
- domain: performance
- task: 3.1
- topic: storage
- services: EC2, EBS
- tags: ebs-volume-types
- difficulty: medium
- time: 50
- source: practice-exams/02-storage-services-exam-v2.md#Q6

A database on EC2 needs 40,000 IOPS with consistent low latency. Which EBS volume type?

- A. io2
- B. st1
- C. gp2
- D. gp3

**Answer:** A

**Explanation:** 40,000 IOPS consistent low latency = io2 (Provisioned IOPS SSD).

---

## Q 02-v2-07
- domain: performance
- task: 3.1
- topic: storage
- services: EBS
- tags: ebs-volume-types
- difficulty: medium
- time: 50
- source: practice-exams/02-storage-services-exam-v2.md#Q7

A big-data workload streams large sequential files and cares about throughput, not IOPS, at low cost. Which EBS type?

- A. gp3
- B. sc1
- C. st1
- D. io1

**Answer:** C

**Explanation:** Sequential large files, throughput-focused, low cost = st1 (Throughput Optimized HDD).

---

## Q 02-v2-08
- domain: performance
- task: 3.1
- topic: storage
- services: EFS, EC2
- difficulty: medium
- time: 50
- source: practice-exams/02-storage-services-exam-v2.md#Q8

Multiple Linux EC2 instances across AZs must share the same file system concurrently. Which service?

- A. S3
- B. Instance Store
- C. EBS with Multi-Attach
- D. Amazon EFS

**Answer:** D

**Explanation:** Shared file system across AZs for Linux = Amazon EFS.

---

## Q 02-v2-09
- domain: performance
- task: 3.1
- topic: storage
- services: FSx
- tags: fsx-windows
- difficulty: medium
- time: 55
- source: practice-exams/02-storage-services-exam-v2.md#Q9

A Windows application needs a shared file system with SMB protocol and Active Directory integration. Which service?

- A. S3 File Gateway
- B. FSx for Lustre
- C. Amazon EFS
- D. FSx for Windows File Server

**Answer:** D

**Explanation:** Windows SMB + Active Directory = FSx for Windows File Server.

---

## Q 02-v2-10
- domain: performance
- task: 3.1
- topic: storage
- services: FSx, S3
- tags: fsx-lustre
- difficulty: medium
- time: 50
- source: practice-exams/02-storage-services-exam-v2.md#Q10

An HPC/ML workload needs a high-performance file system tightly integrated with S3 for input/output. Which service?

- A. Storage Gateway (Tape)
- B. EFS
- C. FSx for Windows
- D. FSx for Lustre

**Answer:** D

**Explanation:** HPC/ML high-performance FS integrated with S3 = FSx for Lustre.

---

## Q 02-v2-11
- domain: performance
- task: 3.1
- topic: storage
- services: S3, Storage Gateway
- difficulty: medium
- time: 50
- source: practice-exams/02-storage-services-exam-v2.md#Q11

On-premises servers need NFS/SMB file shares backed by S3, with a local cache for hot files. Which service?

- A. Volume Gateway (Stored)
- B. Tape Gateway
- C. S3 File Gateway
- D. DataSync

**Answer:** C

**Explanation:** On-prem NFS/SMB backed by S3 with local cache = S3 File Gateway.

---

## Q 02-v2-12
- domain: performance
- task: 3.5
- topic: storage
- services: Snow Family
- difficulty: medium
- time: 55
- source: practice-exams/02-storage-services-exam-v2.md#Q12

A company must migrate 500 TB to AWS but has limited network bandwidth and a tight deadline. Which is BEST?

- A. AWS Snowball Edge
- B. Direct upload via CLI
- C. AWS DataSync over the internet
- D. S3 Transfer Acceleration

**Answer:** A

**Explanation:** 500 TB, limited bandwidth, deadline = Snowball Edge.

---

## Q 02-v2-13
- domain: secure
- task: 1.3
- topic: storage
- services: EBS
- tags: db-encryption, snapshots
- difficulty: medium
- time: 55
- source: practice-exams/02-storage-services-exam-v2.md#Q13

An unencrypted EBS volume must be encrypted. What is the correct approach?

- A. Toggle encryption on the live volume
- B. Enable Multi-Attach
- C. Snapshot → copy snapshot with encryption → create new volume
- D. Detach and reattach the volume

**Answer:** C

**Explanation:** Encrypt existing EBS = snapshot, copy with encryption, create new volume.

---

## Q 02-v2-14
- domain: performance
- task: 3.1
- topic: storage
- services: EBS
- tags: snapshots
- difficulty: medium
- time: 60
- source: practice-exams/02-storage-services-exam-v2.md#Q14

An EBS volume in us-east-1a must be used by an instance in us-east-1b. What must be done?

- A. Snapshot the volume, create a new volume from it in us-east-1b
- B. Enable Multi-Attach
- C. Attach directly across AZs
- D. Use EFS instead of moving

**Answer:** A

**Explanation:** Move EBS across AZ = snapshot then create volume in target AZ (EBS is AZ-locked).

---

## Q 02-v2-15
- domain: performance
- task: 3.1
- topic: storage
- services: S3
- tags: s3-transfer-acceleration
- difficulty: medium
- time: 55
- source: practice-exams/02-storage-services-exam-v2.md#Q15

Global users upload large files to a single S3 bucket and complain about slow uploads. Which feature helps MOST?

- A. S3 Select
- B. Byte-range fetches
- C. S3 Inventory
- D. S3 Transfer Acceleration

**Answer:** D

**Explanation:** Speed up global large uploads to one bucket = S3 Transfer Acceleration.

---

## Q 02-v2-16
- domain: performance
- task: 3.1
- topic: storage
- services: S3, Lambda
- tags: s3-event-notifications
- difficulty: medium
- time: 60
- source: practice-exams/02-storage-services-exam-v2.md#Q16

An application must be notified to run a Lambda function whenever a new object is created in a bucket. Which is the SIMPLEST?

- A. CloudTrail data events → email
- B. S3 Event Notification → Lambda
- C. Poll the bucket from EC2
- D. S3 Inventory daily report

**Answer:** B

**Explanation:** Trigger Lambda on object create, simplest = S3 Event Notification to Lambda.

---

## Q 02-v2-17
- domain: performance
- task: 3.1
- topic: storage
- services: S3
- difficulty: medium
- time: 55
- source: practice-exams/02-storage-services-exam-v2.md#Q17

A team needs to run SQL queries to retrieve only a subset of rows from large CSV objects without downloading whole files. Which feature?

- A. S3 Transfer Acceleration
- B. S3 Inventory
- C. S3 Select
- D. S3 Batch Operations

**Answer:** C

**Explanation:** SQL to retrieve subset from objects without full download = S3 Select.

---

## Q 02-v2-18
- domain: performance
- task: 3.1
- topic: storage
- services: S3
- tags: s3-storage-classes
- difficulty: medium
- time: 55
- source: practice-exams/02-storage-services-exam-v2.md#Q18

Dev/test data can tolerate the loss of a single AZ and must cost as little as possible while staying in S3 with millisecond access. Which class?

- A. S3 Standard
- B. S3 One Zone-IA
- C. S3 Standard-IA
- D. S3 Glacier Deep Archive

**Answer:** B

**Explanation:** Single-AZ tolerable, cheapest S3 with ms access = S3 One Zone-IA.

---

## Q 02-v2-19
- domain: performance
- task: 3.5
- topic: storage
- services: DataSync, EFS
- difficulty: medium
- time: 50
- source: practice-exams/02-storage-services-exam-v2.md#Q19

A company wants automated, scheduled, incremental transfer of files from on-premises NFS to EFS with integrity verification. Which service?

- A. Storage Gateway (Volume)
- B. Snowball
- C. S3 CRR
- D. AWS DataSync

**Answer:** D

**Explanation:** Scheduled incremental on-prem NFS to EFS with verification = AWS DataSync.

---

## Q 02-v2-20
- domain: resilient
- task: 2.2
- topic: storage
- services: Storage Gateway
- difficulty: medium
- time: 50
- source: practice-exams/02-storage-services-exam-v2.md#Q20

Backup software on-premises writes to virtual tapes that should be stored durably in AWS. Which service?

- A. Tape Gateway (VTL)
- B. EFS
- C. S3 File Gateway
- D. FSx for OpenZFS

**Answer:** A

**Explanation:** Virtual tape backups stored in AWS = Tape Gateway (VTL).

---

## Q 02-v2-21
- domain: performance
- task: 3.1
- topic: storage
- services: EBS, EC2
- tags: ebs-multi-attach, ebs-volume-types
- difficulty: hard
- time: 95
- source: practice-exams/02-storage-services-exam-v2.md#Q21

A clustered Linux application needs the SAME block volume attached to multiple EC2 instances in one AZ for shared-disk access. Which is required? (Choose TWO)

- A. Instances in different AZs
- B. io1/io2 volume type
- C. EBS Multi-Attach
- D. gp3 volume type
- E. EFS mount targets

**Answer:** B, C

**Explanation:** Shared block volume, multiple instances same AZ = EBS Multi-Attach on io1/io2.

---

## Q 02-v2-22
- domain: performance
- task: 3.1
- topic: storage
- services: S3
- tags: iam-policies, s3-access-points
- difficulty: hard
- time: 80
- source: practice-exams/02-storage-services-exam-v2.md#Q22

A bucket must allow one team read-only access to a prefix and another team read-write to a different prefix at scale, without a giant bucket policy. Which feature is BEST?

- A. Multiple IAM users sharing one key
- B. One large bucket policy with many statements
- C. Object ACLs
- D. S3 Access Points, each with its own policy

**Answer:** D

**Explanation:** Per-team scoped access at scale without huge policy = S3 Access Points.

---

## Q 02-v2-23
- domain: secure
- task: 1.3
- topic: storage
- services: KMS, S3, CloudTrail
- tags: compliance, sse-kms
- difficulty: hard
- time: 80
- source: practice-exams/02-storage-services-exam-v2.md#Q23

Objects must be encrypted with keys managed by the customer's own KMS CMK, with CloudTrail auditing of every decrypt. Under heavy load, requests are throttled. What explains this and the fix?

- A. KMS request quotas on SSE-KMS; request a quota increase or use S3 Bucket Keys
- B. Object Lock throttling; disable it
- C. Versioning overhead; suspend versioning
- D. SSE-S3 limits; switch to SSE-C

**Answer:** A

**Explanation:** SSE-KMS hits KMS request quotas; fix with quota increase or S3 Bucket Keys.

---

## Q 02-v2-24
- domain: resilient
- task: 2.2
- topic: storage
- services: S3
- tags: s3-replication
- difficulty: hard
- time: 70
- source: practice-exams/02-storage-services-exam-v2.md#Q24

A cross-Region replication must guarantee that 99.99% of objects replicate within 15 minutes. Which feature provides this SLA?

- A. Standard CRR
- B. Batch Replication
- C. S3 Replication Time Control (RTC)
- D. Transfer Acceleration

**Answer:** C

**Explanation:** 15-min replication SLA = S3 Replication Time Control (RTC).

---

## Q 02-v2-25
- domain: performance
- task: 3.1
- topic: storage
- services: EBS
- tags: snapshots
- difficulty: hard
- time: 70
- source: practice-exams/02-storage-services-exam-v2.md#Q25

An application experiences slow first-read latency from newly created EBS volumes restored from snapshots. Which feature eliminates this initialization penalty?

- A. gp3 provisioning
- B. EBS Snapshot Archive
- C. Fast Snapshot Restore (FSR)
- D. EBS Multi-Attach

**Answer:** C

**Explanation:** Remove first-read init penalty on restored volumes = Fast Snapshot Restore.

---

## Q 02-v2-26
- domain: cost
- task: 4.1
- topic: storage
- services: EBS
- tags: snapshots
- difficulty: hard
- time: 70
- source: practice-exams/02-storage-services-exam-v2.md#Q26

A company wants to reduce EBS snapshot storage costs for snapshots rarely restored, accepting 24–72h restore time. Which feature?

- A. Recycle Bin
- B. Multi-Attach
- C. EBS Snapshot Archive
- D. Fast Snapshot Restore

**Answer:** C

**Explanation:** Cheap storage for rarely restored snapshots, 24-72h = EBS Snapshot Archive.

---

## Q 02-v2-27
- domain: performance
- task: 3.1
- topic: storage
- services: FSx, S3
- tags: fsx-lustre
- difficulty: hard
- time: 70
- source: practice-exams/02-storage-services-exam-v2.md#Q27

An FSx for Lustre file system is used only for a short, throughput-intensive processing job and data is persisted in S3. Which deployment option minimizes cost?

- A. NetApp ONTAP
- B. Scratch deployment
- C. Persistent deployment
- D. Multi-AZ Windows

**Answer:** B

**Explanation:** Short throughput job, data in S3 = FSx for Lustre Scratch deployment.

---

## Q 02-v2-28
- domain: performance
- task: 3.1
- topic: storage
- tags: tls-termination, iam-policies
- difficulty: hard
- time: 70
- source: practice-exams/02-storage-services-exam-v2.md#Q28

A bucket must reject any request that is not sent over HTTPS. What enforces this?

- A. A bucket policy denying requests where aws:SecureTransport is false
- B. S3 Block Public Access
- C. Object Lock
- D. Default encryption

**Answer:** A

**Explanation:** Force HTTPS = bucket policy denying aws:SecureTransport = false.

---

## Q 02-v2-29
- domain: resilient
- task: 2.2
- topic: storage
- services: S3
- tags: cross-account-access
- difficulty: hard
- time: 100
- source: practice-exams/02-storage-services-exam-v2.md#Q29

A company needs cross-account access to objects, wants the destination account to OWN replicated objects, and must replicate existing objects already in the bucket. Which two apply? (Choose TWO)

- A. Object Lock Compliance mode
- B. Transfer Acceleration for existing objects
- C. S3 Batch Replication for existing objects
- D. SSE-C encryption is required
- E. Replication owner override (change object ownership to destination)

**Answer:** C, E

**Explanation:** Destination owns objects = owner override; replicate existing = S3 Batch Replication.

---

## Q 02-v2-30
- domain: performance
- task: 3.5
- topic: storage
- services: Snow Family
- difficulty: hard
- time: 70
- source: practice-exams/02-storage-services-exam-v2.md#Q30

An edge site with intermittent connectivity needs a small, rugged device to collect data and run limited compute, later shipping data to AWS. Which device?

- A. Snowball Edge Storage Optimized (80 TB)
- B. Snowcone
- C. Snowmobile
- D. Storage Gateway appliance

**Answer:** B

**Explanation:** Small rugged edge device with limited compute = AWS Snowcone.
