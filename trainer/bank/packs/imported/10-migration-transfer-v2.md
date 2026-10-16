---
pack: saa-10-migration-transfer-v2
title: 10 · Migration & Transfer · V2
exam: SAA-C03
origin: imported
source: practice-exams/10-migration-transfer-exam-v2.md
created: 2026-10-16
---

# 10 · Migration & Transfer · V2

> Imported from `practice-exams/10-migration-transfer-exam-v2.md` + `10-migration-transfer-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 10-v2-01
- domain: resilient
- topic: migration
- services: DMS, RDS
- tags: cdc-replication
- difficulty: medium
- time: 55
- source: practice-exams/10-migration-transfer-exam-v2.md#Q1

A company must migrate an on-premises MySQL database to RDS MySQL with minimal downtime and ongoing replication until cutover. Which service?

- A. AWS DMS with continuous replication (CDC)
- B. AWS DataSync
- C. AWS Snowball
- D. S3 Transfer Acceleration

**Answer:** A

**Explanation:** DB migration with minimal downtime + ongoing replication = DMS with CDC.

---

## Q 10-v2-02
- domain: performance
- topic: migration
- services: SCT, Aurora
- tags: heterogeneous-migration
- difficulty: medium
- time: 55
- source: practice-exams/10-migration-transfer-exam-v2.md#Q2

A heterogeneous migration from SQL Server to Aurora PostgreSQL requires converting schema and stored procedures. Which tool?

- A. AWS Schema Conversion Tool (SCT)
- B. AWS DataSync
- C. AWS Backup
- D. Storage Gateway

**Answer:** A

**Explanation:** Heterogeneous schema/procedure conversion = Schema Conversion Tool (SCT).

---

## Q 10-v2-03
- domain: performance
- topic: migration
- services: Snow Family, S3
- difficulty: medium
- time: 55
- source: practice-exams/10-migration-transfer-exam-v2.md#Q3

A company must transfer 200 TB to S3 over a limited-bandwidth link within a tight deadline. Which service?

- A. AWS Snowball Edge
- B. AWS DataSync over the internet
- C. Direct upload via CLI
- D. AWS Transfer Family

**Answer:** A

**Explanation:** 200 TB, limited bandwidth, deadline = Snowball Edge.

---

## Q 10-v2-04
- domain: performance
- topic: migration
- services: Transfer Family, S3
- difficulty: medium
- time: 50
- source: practice-exams/10-migration-transfer-exam-v2.md#Q4

Partners upload files daily using SFTP; the company wants a managed SFTP endpoint storing files in S3. Which service?

- A. AWS Transfer Family
- B. AWS DataSync
- C. Storage Gateway
- D. Snowcone

**Answer:** A

**Explanation:** Managed SFTP to S3 = AWS Transfer Family.

---

## Q 10-v2-05
- domain: resilient
- topic: migration
- services: DataSync, EFS
- difficulty: medium
- time: 50
- source: practice-exams/10-migration-transfer-exam-v2.md#Q5

A company must continuously replicate on-premises NFS files to EFS on a schedule with integrity checks. Which service?

- A. AWS DataSync
- B. AWS Transfer Family
- C. DMS
- D. Snowball

**Answer:** A

**Explanation:** Scheduled on-prem NFS to EFS with verification = AWS DataSync.

---

## Q 10-v2-06
- domain: performance
- topic: migration
- services: Application Discovery Service
- difficulty: medium
- time: 50
- source: practice-exams/10-migration-transfer-exam-v2.md#Q6

A company needs to discover on-premises server inventory and dependencies before migrating. Which service?

- A. AWS Application Discovery Service
- B. AWS DMS
- C. AWS Config
- D. Trusted Advisor

**Answer:** A

**Explanation:** Discover server inventory + dependencies = Application Discovery Service.

---

## Q 10-v2-07
- domain: performance
- topic: migration
- services: Application Migration Service, EC2
- difficulty: medium
- time: 50
- source: practice-exams/10-migration-transfer-exam-v2.md#Q7

A company wants to lift-and-shift (rehost) hundreds of on-premises VMs to EC2 with minimal changes. Which service?

- A. AWS Application Migration Service (MGN)
- B. AWS DMS
- C. AWS Glue
- D. DataSync

**Answer:** A

**Explanation:** Lift-and-shift VMs to EC2 = Application Migration Service (MGN).

---

## Q 10-v2-08
- domain: performance
- topic: migration
- services: Migration Hub
- difficulty: medium
- time: 50
- source: practice-exams/10-migration-transfer-exam-v2.md#Q8

A single dashboard must track migration progress across multiple tools and accounts. Which service?

- A. AWS Migration Hub
- B. AWS Config
- C. CloudWatch
- D. Trusted Advisor

**Answer:** A

**Explanation:** Central migration tracking dashboard = AWS Migration Hub.

---

## Q 10-v2-09
- domain: performance
- topic: migration
- services: DataSync, Snow Family
- difficulty: medium
- time: 50
- source: practice-exams/10-migration-transfer-exam-v2.md#Q9

DataSync vs Snowball: which factor MOST favors Snowball?

- A. Limited network bandwidth + large data + deadline
- B. Continuous ongoing sync
- C. Small daily incremental transfers
- D. Real-time replication

**Answer:** A

**Explanation:** Snowball favored by limited bandwidth + large data + deadline.

---

## Q 10-v2-10
- domain: performance
- topic: migration
- services: DMS, RDS
- tags: cdc-replication
- difficulty: medium
- time: 50
- source: practice-exams/10-migration-transfer-exam-v2.md#Q10

A company must migrate an Oracle database to RDS Oracle (same engine) with minimal downtime. Which service?

- A. AWS DMS (homogeneous, with CDC)
- B. Storage Gateway
- C. DataSync
- D. Snowmobile

**Answer:** A

**Explanation:** Homogeneous Oracle->RDS Oracle minimal downtime = DMS with CDC.

---

## Q 10-v2-11
- domain: resilient
- topic: migration
- services: DMS
- tags: cdc-replication
- difficulty: hard
- time: 95
- source: practice-exams/10-migration-transfer-exam-v2.md#Q11

A migration must keep the source database fully operational and continuously replicate changes until cutover, then switch. Which two DMS concepts apply? (Choose TWO)

- A. Full load + Change Data Capture (CDC)
- B. Replication instance running the task
- C. Schema Conversion is required for homogeneous migrations
- D. DataSync agent
- E. Snowball seeding is mandatory

**Answer:** A, B

**Explanation:** Live migration = full load + CDC on a replication instance.

---

## Q 10-v2-12
- domain: performance
- topic: migration
- services: DMS, Snow Family
- tags: offline-transfer, cdc-replication
- difficulty: hard
- time: 75
- source: practice-exams/10-migration-transfer-exam-v2.md#Q12

A very large database migration over limited bandwidth must combine offline bulk transfer with ongoing change capture. Which approach?

- A. DMS with Snowball Edge for initial bulk load, then CDC over the network
- B. DataSync only
- C. Transfer Family only
- D. Manual export/import once

**Answer:** A

**Explanation:** Bulk + ongoing = DMS with Snowball Edge initial load then CDC.

---

## Q 10-v2-13
- domain: performance
- topic: migration
- services: DataSync, Storage Gateway, Transfer Family
- difficulty: hard
- time: 75
- source: practice-exams/10-migration-transfer-exam-v2.md#Q13

DataSync vs Storage Gateway vs Transfer Family — which statement is TRUE?

- A. DataSync = one-time/scheduled bulk transfer; Storage Gateway = ongoing hybrid access; Transfer Family = managed SFTP/FTPS/FTP
- B. All three are for real-time database replication
- C. Transfer Family is for Hadoop clusters
- D. Storage Gateway only does SFTP

**Answer:** A

**Explanation:** DataSync=bulk transfer; Storage Gateway=hybrid access; Transfer Family=managed SFTP/FTPS/FTP.

---

## Q 10-v2-14
- domain: cost
- topic: migration
- services: Migration Evaluator
- difficulty: hard
- time: 65
- source: practice-exams/10-migration-transfer-exam-v2.md#Q14

A company wants recommendations on the cost of running on-premises workloads in AWS before migrating. Which service?

- A. AWS Migration Evaluator
- B. AWS DMS
- C. AWS Config
- D. Compute Optimizer

**Answer:** A

**Explanation:** Pre-migration cost recommendations = Migration Evaluator.

---

## Q 10-v2-15
- domain: performance
- topic: migration
- services: SCT, DMS, Aurora
- tags: cdc-replication
- difficulty: hard
- time: 75
- source: practice-exams/10-migration-transfer-exam-v2.md#Q15

A DMS migration from Oracle to Aurora PostgreSQL must minimize application downtime. Which sequence is BEST?

- A. SCT to convert schema → DMS full load + CDC → validate → cutover
- B. Snowball → restore → done
- C. DataSync files → import → cutover
- D. Manual dump/restore during a long maintenance window

**Answer:** A

**Explanation:** Oracle->Aurora PG minimal downtime = SCT + DMS full load + CDC + validate + cutover.
