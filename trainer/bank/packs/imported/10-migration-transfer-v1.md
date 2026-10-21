---
pack: saa-10-migration-transfer-v1
title: 10 · Migration & Transfer · V1
exam: SAA-C03
origin: imported
source: practice-exams/10-migration-transfer-exam.md
created: 2026-10-16
---

# 10 · Migration & Transfer · V1

> Imported from `practice-exams/10-migration-transfer-exam.md` + `10-migration-transfer-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 10-v1-01
- domain: resilient
- task: 2.2
- topic: migration
- services: DMS, RDS
- tags: cdc-replication
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q1

A company migrates an on-premises MySQL database to Amazon RDS MySQL with minimal downtime and ongoing replication during cutover. Which service?

- A. AWS Backup
- B. AWS DataSync
- C. AWS Database Migration Service (DMS)
- D. AWS Snowball

**Answer:** C

**Explanation:** DB migration w/ minimal downtime + replication = DMS.

---

## Q 10-v1-02
- domain: performance
- task: 3.3
- topic: migration
- services: SCT, Aurora
- difficulty: easy
- time: 50
- enriched: 2026-10-22
- source: practice-exams/10-migration-transfer-exam.md#Q2

An Oracle database must be migrated to Amazon Aurora PostgreSQL (different engine). Which tool converts the schema?

- A. AWS Glue, a schema cataloging tool
- B. AWS DMS replicates data without converting the schema
- C. AWS DataSync for file and object transfer
- D. AWS Schema Conversion Tool (SCT)

**Answer:** D

**Explanation:** Convert different-engine schema = Schema Conversion Tool (SCT).

---

## Q 10-v1-03
- domain: performance
- task: 3.5
- topic: migration
- services: Snow Family
- tags: offline-transfer
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q3

A company must move 80 TB to AWS but has limited bandwidth and a tight deadline. Which service?

- A. AWS DataSync
- B. S3 Transfer Acceleration
- C. AWS Snowball Edge
- D. AWS Storage Gateway

**Answer:** C

**Explanation:** 80 TB, limited bandwidth, deadline = Snowball Edge.

---

## Q 10-v1-04
- domain: resilient
- task: 2.2
- topic: migration
- services: Application Migration Service, EC2
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q4

A data center needs to migrate hundreds of physical and virtual servers to EC2 with continuous block-level replication and minimal downtime (lift-and-shift). Which service?

- A. AWS Snowmobile
- B. AWS DMS
- C. AWS DataSync
- D. AWS Application Migration Service (MGN)

**Answer:** D

**Explanation:** Lift-and-shift servers w/ continuous replication = MGN.

---

## Q 10-v1-05
- domain: performance
- task: 3.5
- topic: migration
- services: DataSync, EFS
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q5

A company needs automated, scheduled, incremental file transfers from on-premises NFS to Amazon EFS. Which service?

- A. AWS DataSync
- B. AWS Transfer Family
- C. AWS Snowcone
- D. AWS Backup

**Answer:** A

**Explanation:** Scheduled incremental NFS->EFS = DataSync.

---

## Q 10-v1-06
- domain: performance
- task: 3.5
- topic: migration
- services: Transfer Family, S3
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q6

Legacy partners upload files via SFTP that must land in Amazon S3, keeping the SFTP interface. Which service?

- A. Amazon S3 File Gateway
- B. AWS Transfer Family
- C. AWS DMS
- D. AWS DataSync

**Answer:** B

**Explanation:** Keep SFTP, land in S3 = AWS Transfer Family.

---

## Q 10-v1-07
- domain: performance
- task: 3.5
- topic: migration
- services: DMS
- tags: cdc-replication
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q7

A company needs ongoing change data capture (CDC) to keep a target database continuously in sync during a long migration. Which DMS mode?

- A. Full load + CDC
- B. Schema conversion only
- C. One-time export
- D. Full load only

**Answer:** A

**Explanation:** Continuous sync during migration = Full load + CDC.

---

## Q 10-v1-08
- domain: performance
- task: 3.5
- topic: migration
- services: Migration Hub, DMS, Application Migration Service
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q8

Which service provides a central dashboard to track the status of migrations across DMS, MGN, and discovery tools?

- A. AWS Config
- B. AWS Migration Hub
- C. AWS Organizations
- D. AWS Control Tower

**Answer:** B

**Explanation:** Central migration tracking = Migration Hub.

---

## Q 10-v1-09
- domain: performance
- task: 3.5
- topic: migration
- services: Snow Family
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q9

An exabyte-scale (100 PB) data-center migration must move data physically. Which device?

- A. Snowball Edge Storage Optimized
- B. DataSync
- C. Snowmobile
- D. Snowcone

**Answer:** C

**Explanation:** 100 PB physical move = Snowmobile.

---

## Q 10-v1-10
- domain: performance
- task: 3.5
- topic: migration
- services: Snow Family
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q10

A remote edge site with intermittent connectivity needs a small, rugged, portable device to collect and ship a few terabytes of data. Which device?

- A. AWS Snowcone
- B. Storage Gateway
- C. Direct Connect
- D. Snowmobile

**Answer:** A

**Explanation:** Small, rugged, portable few-TB device = Snowcone.

---

## Q 10-v1-11
- domain: performance
- task: 3.3
- topic: migration
- services: RDS, DMS, SCT
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q11

Which DMS migration is "homogeneous" and does NOT require SCT?

- A. MongoDB → DynamoDB
- B. Oracle → Aurora PostgreSQL
- C. SQL Server → Aurora MySQL
- D. MySQL → RDS MySQL

**Answer:** D

**Explanation:** Same engine, no SCT = MySQL -> RDS MySQL (homogeneous).

---

## Q 10-v1-12
- domain: performance
- task: 3.5
- topic: migration
- services: Application Discovery Service, Migration Evaluator
- tags: right-sizing
- difficulty: easy
- time: 50
- enriched: 2026-10-22
- source: practice-exams/10-migration-transfer-exam.md#Q12

A company wants to discover on-premises server dependencies and right-size before migrating. Which tool helps plan the migration?

- A. AWS Config resource discovery for AWS compliance
- B. AWS Application Discovery Service / Migration Evaluator
- C. AWS Migration Hub for tracking migration progress
- D. Amazon Inspector vulnerability scans

**Answer:** B

**Explanation:** Discover dependencies/right-size = Application Discovery Service/Migration Evaluator.

---

## Q 10-v1-13
- domain: performance
- task: 3.5
- topic: migration
- services: Snow Family, DataSync
- tags: offline-transfer
- difficulty: easy
- time: 50
- source: practice-exams/10-migration-transfer-exam.md#Q13

Which is the BEST reason to choose Snowball Edge over network transfer (DataSync)?

- A. The data is already in AWS
- B. The dataset is small and bandwidth is high
- C. Transferring over the network would take weeks due to limited bandwidth
- D. Real-time continuous replication is required

**Answer:** C

**Explanation:** Network would take weeks = use Snowball Edge.

---

## Q 10-v1-14
- domain: performance
- task: 3.2
- topic: migration
- services: Snow Family
- difficulty: easy
- time: 50
- enriched: 2026-10-22
- source: practice-exams/10-migration-transfer-exam.md#Q14

A Snowball Edge Compute Optimized device is chosen primarily because the use case also needs:

- A. Snowball Edge Storage Optimized for bulk storage
- B. Storage capacity without onboard compute
- C. Local compute/edge processing during the transfer
- D. Continuous DB replication to the cloud

**Answer:** C

**Explanation:** Compute Optimized = local/edge compute during transfer.

---

## Q 10-v1-15
- domain: secure
- task: 1.3
- topic: migration
- services: AWS Backup, EC2, EBS, RDS, DynamoDB, EFS
- tags: compliance
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q15

A company wants to back up EC2, EBS, RDS, DynamoDB, and EFS centrally with policies and compliance. Which service?

- A. Snowball
- B. AWS DMS
- C. AWS DataSync
- D. AWS Backup

**Answer:** D

**Explanation:** Central backup across services = AWS Backup.

---

## Q 10-v1-16
- domain: performance
- task: 3.1
- topic: migration
- services: S3, EFS, DataSync
- difficulty: medium
- time: 70
- source: practice-exams/10-migration-transfer-exam.md#Q16

Which two destinations are supported by AWS DataSync? (Choose TWO)

- A. Amazon SQS
- B. Amazon Redshift
- C. Amazon S3
- D. Amazon EFS
- E. Amazon DynamoDB

**Answer:** C, D

**Explanation:** DataSync destinations include S3 and EFS (and FSx).

---

## Q 10-v1-17
- domain: performance
- task: 3.3
- topic: migration
- services: SCT, DMS
- tags: heterogeneous-migration
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q17

During a heterogeneous database migration, what is the recommended sequence?

- A. Use Snowball to ship the database
- B. DMS first, then SCT
- C. Use DataSync to replicate tables
- D. Convert schema with SCT, then migrate data with DMS

**Answer:** D

**Explanation:** Heterogeneous: SCT (schema) then DMS (data).

---

## Q 10-v1-18
- domain: performance
- task: 3.1
- topic: migration
- services: Storage Gateway
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q18

A workload needs to continuously replicate an on-premises file share to AWS and serve it locally with low latency using a cached gateway. Which service?

- A. AWS Transfer Family
- B. AWS Storage Gateway (File/Volume Gateway)
- C. AWS Snowmobile
- D. AWS DMS

**Answer:** B

**Explanation:** On-prem file share cached locally + replicate to AWS = Storage Gateway.

---

## Q 10-v1-19
- domain: performance
- task: 3.4
- topic: migration
- services: Snow Family
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q19

Which factor MOST determines whether to use Snow Family vs online transfer?

- A. Data size relative to available bandwidth and time
- B. The Region's name
- C. The S3 storage class
- D. Number of AWS accounts

**Answer:** A

**Explanation:** Snow vs online decided by data size vs bandwidth/time.

---

## Q 10-v1-20
- domain: performance
- task: 3.5
- topic: migration
- services: Application Migration Service
- difficulty: easy
- time: 45
- source: practice-exams/10-migration-transfer-exam.md#Q20

A company must migrate a large VMware-based estate to AWS with minimal refactoring and cutover risk. Which approach is BEST?

- A. AWS Application Migration Service (MGN) for lift-and-shift
- B. Snowmobile
- C. AWS Glue ETL
- D. Rebuild every app manually on EC2

**Answer:** A

**Explanation:** Large VMware lift-and-shift, low risk = MGN.
