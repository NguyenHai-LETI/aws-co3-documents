# 🚚 Practice Exam 10 — Migration & Transfer (SAA-C03) · V2

**15 questions** · scenario-based · English. Answers in `10-migration-transfer-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q10
- **Part B — Khó / Nâng cao:** Q11–Q15

---

## Part A — Vận dụng (10 câu)

**1.** A company must migrate an on-premises MySQL database to RDS MySQL with minimal downtime and ongoing replication until cutover. Which service?

- A. AWS DMS with continuous replication (CDC)
- B. AWS DataSync
- C. AWS Snowball
- D. S3 Transfer Acceleration

**2.** A heterogeneous migration from SQL Server to Aurora PostgreSQL requires converting schema and stored procedures. Which tool?

- A. AWS Schema Conversion Tool (SCT)
- B. AWS DataSync
- C. AWS Backup
- D. Storage Gateway

**3.** A company must transfer 200 TB to S3 over a limited-bandwidth link within a tight deadline. Which service?

- A. AWS Snowball Edge
- B. AWS DataSync over the internet
- C. Direct upload via CLI
- D. AWS Transfer Family

**4.** Partners upload files daily using SFTP; the company wants a managed SFTP endpoint storing files in S3. Which service?

- A. AWS Transfer Family
- B. AWS DataSync
- C. Storage Gateway
- D. Snowcone

**5.** A company must continuously replicate on-premises NFS files to EFS on a schedule with integrity checks. Which service?

- A. AWS DataSync
- B. AWS Transfer Family
- C. DMS
- D. Snowball

**6.** A company needs to discover on-premises server inventory and dependencies before migrating. Which service?

- A. AWS Application Discovery Service
- B. AWS DMS
- C. AWS Config
- D. Trusted Advisor

**7.** A company wants to lift-and-shift (rehost) hundreds of on-premises VMs to EC2 with minimal changes. Which service?

- A. AWS Application Migration Service (MGN)
- B. AWS DMS
- C. AWS Glue
- D. DataSync

**8.** A single dashboard must track migration progress across multiple tools and accounts. Which service?

- A. AWS Migration Hub
- B. AWS Config
- C. CloudWatch
- D. Trusted Advisor

**9.** DataSync vs Snowball: which factor MOST favors Snowball?

- A. Limited network bandwidth + large data + deadline
- B. Continuous ongoing sync
- C. Small daily incremental transfers
- D. Real-time replication

**10.** A company must migrate an Oracle database to RDS Oracle (same engine) with minimal downtime. Which service?

- A. AWS DMS (homogeneous, with CDC)
- B. Storage Gateway
- C. DataSync
- D. Snowmobile

---

## Part B — Khó / Nâng cao (5 câu)

**11.** A migration must keep the source database fully operational and continuously replicate changes until cutover, then switch. Which two DMS concepts apply? (Choose TWO)

- A. Full load + Change Data Capture (CDC)
- B. Replication instance running the task
- C. Schema Conversion is required for homogeneous migrations
- D. DataSync agent
- E. Snowball seeding is mandatory

**12.** A very large database migration over limited bandwidth must combine offline bulk transfer with ongoing change capture. Which approach?

- A. DMS with Snowball Edge for initial bulk load, then CDC over the network
- B. DataSync only
- C. Transfer Family only
- D. Manual export/import once

**13.** DataSync vs Storage Gateway vs Transfer Family — which statement is TRUE?

- A. DataSync = one-time/scheduled bulk transfer; Storage Gateway = ongoing hybrid access; Transfer Family = managed SFTP/FTPS/FTP
- B. All three are for real-time database replication
- C. Transfer Family is for Hadoop clusters
- D. Storage Gateway only does SFTP

**14.** A company wants recommendations on the cost of running on-premises workloads in AWS before migrating. Which service?

- A. AWS Migration Evaluator
- B. AWS DMS
- C. AWS Config
- D. Compute Optimizer

**15.** A DMS migration from Oracle to Aurora PostgreSQL must minimize application downtime. Which sequence is BEST?

- A. SCT to convert schema → DMS full load + CDC → validate → cutover
- B. Snowball → restore → done
- C. DataSync files → import → cutover
- D. Manual dump/restore during a long maintenance window
