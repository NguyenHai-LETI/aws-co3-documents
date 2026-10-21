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
- task: 2.2
- topic: migration
- services: DMS, RDS
- tags: cdc-replication
- difficulty: medium
- time: 55
- source: practice-exams/10-migration-transfer-exam-v2.md#Q1

A company must migrate an on-premises MySQL database to RDS MySQL with minimal downtime and ongoing replication until cutover. Which service?

- A. AWS Snowball
- B. S3 Transfer Acceleration
- C. AWS DataSync
- D. AWS DMS with continuous replication (CDC)

**Answer:** D

**Explanation:** DB migration with minimal downtime + ongoing replication = DMS with CDC.

---

## Q 10-v2-02
- domain: performance
- task: 3.3
- topic: migration
- services: SCT, Aurora
- tags: heterogeneous-migration
- difficulty: medium
- time: 55
- source: practice-exams/10-migration-transfer-exam-v2.md#Q2

A heterogeneous migration from SQL Server to Aurora PostgreSQL requires converting schema and stored procedures. Which tool?

- A. AWS Backup
- B. AWS DataSync
- C. AWS Schema Conversion Tool (SCT)
- D. Storage Gateway

**Answer:** C

**Explanation:** Heterogeneous schema/procedure conversion = Schema Conversion Tool (SCT).

---

## Q 10-v2-03
- domain: performance
- task: 3.5
- topic: migration
- services: Snow Family, S3
- difficulty: medium
- time: 55
- source: practice-exams/10-migration-transfer-exam-v2.md#Q3

A company must transfer 200 TB to S3 over a limited-bandwidth link within a tight deadline. Which service?

- A. AWS DataSync over the internet
- B. AWS Transfer Family
- C. Direct upload via CLI
- D. AWS Snowball Edge

**Answer:** D

**Explanation:** 200 TB, limited bandwidth, deadline = Snowball Edge.

---

## Q 10-v2-04
- domain: performance
- task: 3.5
- topic: migration
- services: Transfer Family, S3
- difficulty: medium
- time: 50
- source: practice-exams/10-migration-transfer-exam-v2.md#Q4

Partners upload files daily using SFTP; the company wants a managed SFTP endpoint storing files in S3. Which service?

- A. AWS Transfer Family
- B. Snowcone
- C. AWS DataSync
- D. Storage Gateway

**Answer:** A

**Explanation:** Managed SFTP to S3 = AWS Transfer Family.

---

## Q 10-v2-05
- domain: resilient
- task: 2.2
- topic: migration
- services: DataSync, EFS
- difficulty: medium
- time: 50
- source: practice-exams/10-migration-transfer-exam-v2.md#Q5

A company must continuously replicate on-premises NFS files to EFS on a schedule with integrity checks. Which service?

- A. DMS
- B. AWS Transfer Family
- C. Snowball
- D. AWS DataSync

**Answer:** D

**Explanation:** Scheduled on-prem NFS to EFS with verification = AWS DataSync.

---

## Q 10-v2-06
- domain: performance
- task: 3.5
- topic: migration
- services: Application Discovery Service
- difficulty: medium
- time: 50
- source: practice-exams/10-migration-transfer-exam-v2.md#Q6

A company needs to discover on-premises server inventory and dependencies before migrating. Which service?

- A. Trusted Advisor
- B. AWS Application Discovery Service
- C. AWS Config
- D. AWS DMS

**Answer:** B

**Explanation:** Discover server inventory + dependencies = Application Discovery Service.

---

## Q 10-v2-07
- domain: performance
- task: 3.5
- topic: migration
- services: Application Migration Service, EC2
- difficulty: medium
- time: 50
- source: practice-exams/10-migration-transfer-exam-v2.md#Q7

A company wants to lift-and-shift (rehost) hundreds of on-premises VMs to EC2 with minimal changes. Which service?

- A. DataSync
- B. AWS Application Migration Service (MGN)
- C. AWS DMS
- D. AWS Glue

**Answer:** B

**Explanation:** Lift-and-shift VMs to EC2 = Application Migration Service (MGN).

---

## Q 10-v2-08
- domain: performance
- task: 3.5
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
- task: 3.4
- topic: migration
- services: DataSync, Snow Family
- difficulty: medium
- time: 50
- source: practice-exams/10-migration-transfer-exam-v2.md#Q9

DataSync vs Snowball: which factor MOST favors Snowball?

- A. Continuous ongoing sync
- B. Limited network bandwidth + large data + deadline
- C. Small daily incremental transfers
- D. Real-time replication

**Answer:** B

**Explanation:** Snowball favored by limited bandwidth + large data + deadline.

---

## Q 10-v2-10
- domain: performance
- task: 3.3
- topic: migration
- services: DMS, RDS
- tags: cdc-replication
- difficulty: medium
- time: 50
- source: practice-exams/10-migration-transfer-exam-v2.md#Q10

A company must migrate an Oracle database to RDS Oracle (same engine) with minimal downtime. Which service?

- A. DataSync
- B. Snowmobile
- C. AWS DMS (homogeneous, with CDC)
- D. Storage Gateway

**Answer:** C

**Explanation:** Homogeneous Oracle->RDS Oracle minimal downtime = DMS with CDC.

---

## Q 10-v2-11
- domain: resilient
- task: 2.2
- topic: migration
- services: DMS
- tags: cdc-replication
- difficulty: hard
- time: 95
- source: practice-exams/10-migration-transfer-exam-v2.md#Q11

A migration must keep the source database fully operational and continuously replicate changes until cutover, then switch. Which two DMS concepts apply? (Choose TWO)

- A. Schema Conversion is required for homogeneous migrations
- B. DataSync agent
- C. Full load + Change Data Capture (CDC)
- D. Snowball seeding is mandatory
- E. Replication instance running the task

**Answer:** C, E

**Explanation:** Live migration = full load + CDC on a replication instance.

---

## Q 10-v2-12
- domain: performance
- task: 3.5
- topic: migration
- services: DMS, Snow Family
- tags: offline-transfer, cdc-replication
- difficulty: hard
- time: 95
- enriched: 2026-10-21
- source: practice-exams/10-migration-transfer-exam-v2.md#Q12

A very large database migration over limited bandwidth must combine offline bulk transfer with ongoing change capture. Which approach?

- A. AWS Transfer Family moving nightly file exports of the database to the target environment
- B. AWS DataSync performing a one-time scheduled copy of the exported database files, with no capture of changes made afterward
- C. A single manual export and import of the full database performed once before cutover
- D. DMS paired with a Snow Family device for the initial offline load, then continuous change capture over the network

**Answer:** D

**Explanation:** For a very large database over limited bandwidth, DMS combined with a Snow Family device moves the bulk of the data offline on the device, then DMS continues replicating changes over the network once the device's data lands in AWS.
- Transfer Family: moves files over SFTP/FTPS/FTP; it has no concept of database change capture or continuous replication.
- DataSync: copies files or objects on a one-time or scheduled basis, with no capture of changes made to the source after the copy runs.
- A single manual export and import: only captures the database's state at one point in time, so any changes made during the transfer window are lost.
> 🇻🇳 Dữ liệu lớn + băng thông hạn chế + cần đồng bộ thay đổi liên tục → DMS + Snow Family (offline) rồi CDC qua mạng.

---

## Q 10-v2-13
- domain: performance
- task: 3.5
- topic: migration
- services: DataSync, Storage Gateway, Transfer Family
- difficulty: hard
- time: 85
- enriched: 2026-10-21
- source: practice-exams/10-migration-transfer-exam-v2.md#Q13

DataSync vs Storage Gateway vs Transfer Family — which statement is TRUE?

- A. Storage Gateway provides managed SFTP/FTPS endpoints for exchanging files with external partners
- B. Transfer Family continuously syncs on-premises files to S3 in the background with no user-initiated transfer
- C. DataSync = one-time/scheduled bulk transfer; Storage Gateway = ongoing hybrid access; Transfer Family = managed SFTP/FTPS/FTP
- D. These three services replace AWS DMS for real-time relational database replication

**Answer:** C

**Explanation:** DataSync performs one-time or scheduled bulk data transfers between on-premises storage and AWS, Storage Gateway provides ongoing hybrid access for applications that still read/write data on-premises, and Transfer Family offers managed SFTP/FTPS/FTP endpoints for partner file exchange — each one solves a different hybrid-storage problem.
- Storage Gateway providing managed SFTP endpoints: that is Transfer Family's role, not Storage Gateway's.
- Transfer Family continuously syncing files in the background: that behavior describes DataSync or Storage Gateway, not Transfer Family's user-initiated protocol transfers.
- Replacing DMS for database replication: none of the three move relational data continuously; that is DMS's job, not a storage/file transfer service.
> 🇻🇳 Ba dịch vụ giải quyết ba vấn đề khác nhau: DataSync (chuyển khối), Storage Gateway (truy cập hybrid liên tục), Transfer Family (SFTP/FTPS/FTP quản lý).

---

## Q 10-v2-14
- domain: cost
- task: 4.4
- topic: migration
- services: Migration Evaluator
- difficulty: hard
- time: 75
- enriched: 2026-10-22
- source: practice-exams/10-migration-transfer-exam-v2.md#Q14

A company wants recommendations on the cost of running on-premises workloads in AWS before migrating. Which service?

- A. AWS Migration Evaluator
- B. AWS Migration Hub for migration tracking
- C. AWS DMS for live database replication
- D. AWS Compute Optimizer for existing resources

**Answer:** A

**Explanation:** Pre-migration cost recommendations = Migration Evaluator.

---

## Q 10-v2-15
- domain: performance
- task: 3.3
- topic: migration
- services: SCT, DMS, Aurora
- tags: cdc-replication
- difficulty: hard
- time: 75
- source: practice-exams/10-migration-transfer-exam-v2.md#Q15

A DMS migration from Oracle to Aurora PostgreSQL must minimize application downtime. Which sequence is BEST?

- A. SCT to convert schema → DMS full load + CDC → validate → cutover
- B. Manual dump/restore during a long maintenance window
- C. Snowball → restore → done
- D. DataSync files → import → cutover

**Answer:** A

**Explanation:** Oracle->Aurora PG minimal downtime = SCT + DMS full load + CDC + validate + cutover.
