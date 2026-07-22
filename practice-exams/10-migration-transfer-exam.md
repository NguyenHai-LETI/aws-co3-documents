# 🚚 Practice Exam 10 — Migration & Transfer (SAA-C03)

20 questions · scenario-based · English. Answers in `10-migration-transfer-answers.txt`.

---

**1.** A company migrates an on-premises MySQL database to Amazon RDS MySQL with minimal downtime and ongoing replication during cutover. Which service?

- A. AWS DataSync
- B. AWS Database Migration Service (DMS)
- C. AWS Snowball
- D. AWS Backup

**2.** An Oracle database must be migrated to Amazon Aurora PostgreSQL (different engine). Which tool converts the schema?

- A. AWS DMS only
- B. AWS Schema Conversion Tool (SCT)
- C. AWS DataSync
- D. AWS Glue

**3.** A company must move 80 TB to AWS but has limited bandwidth and a tight deadline. Which service?

- A. AWS DataSync
- B. AWS Snowball Edge
- C. S3 Transfer Acceleration
- D. AWS Storage Gateway

**4.** A data center needs to migrate hundreds of physical and virtual servers to EC2 with continuous block-level replication and minimal downtime (lift-and-shift). Which service?

- A. AWS Application Migration Service (MGN)
- B. AWS DataSync
- C. AWS DMS
- D. AWS Snowmobile

**5.** A company needs automated, scheduled, incremental file transfers from on-premises NFS to Amazon EFS. Which service?

- A. AWS DataSync
- B. AWS Snowcone
- C. AWS Transfer Family
- D. AWS Backup

**6.** Legacy partners upload files via SFTP that must land in Amazon S3, keeping the SFTP interface. Which service?

- A. AWS Transfer Family
- B. AWS DataSync
- C. Amazon S3 File Gateway
- D. AWS DMS

**7.** A company needs ongoing change data capture (CDC) to keep a target database continuously in sync during a long migration. Which DMS mode?

- A. Full load only
- B. Full load + CDC
- C. Schema conversion only
- D. One-time export

**8.** Which service provides a central dashboard to track the status of migrations across DMS, MGN, and discovery tools?

- A. AWS Migration Hub
- B. AWS Control Tower
- C. AWS Config
- D. AWS Organizations

**9.** An exabyte-scale (100 PB) data-center migration must move data physically. Which device?

- A. Snowcone
- B. Snowball Edge Storage Optimized
- C. Snowmobile
- D. DataSync

**10.** A remote edge site with intermittent connectivity needs a small, rugged, portable device to collect and ship a few terabytes of data. Which device?

- A. Snowmobile
- B. AWS Snowcone
- C. Storage Gateway
- D. Direct Connect

**11.** Which DMS migration is "homogeneous" and does NOT require SCT?

- A. Oracle → Aurora PostgreSQL
- B. SQL Server → Aurora MySQL
- C. MySQL → RDS MySQL
- D. MongoDB → DynamoDB

**12.** A company wants to discover on-premises server dependencies and right-size before migrating. Which tool helps plan the migration?

- A. AWS Application Discovery Service / Migration Evaluator
- B. AWS Budgets
- C. AWS Config
- D. Amazon Inspector

**13.** Which is the BEST reason to choose Snowball Edge over network transfer (DataSync)?

- A. The dataset is small and bandwidth is high
- B. Transferring over the network would take weeks due to limited bandwidth
- C. Real-time continuous replication is required
- D. The data is already in AWS

**14.** A Snowball Edge Compute Optimized device is chosen primarily because the use case also needs:

- A. Only storage capacity
- B. Local compute/edge processing during the transfer
- C. Petabyte-scale capacity
- D. Continuous DB replication

**15.** A company wants to back up EC2, EBS, RDS, DynamoDB, and EFS centrally with policies and compliance. Which service?

- A. AWS Backup
- B. AWS DataSync
- C. AWS DMS
- D. Snowball

**16.** Which two destinations are supported by AWS DataSync? (Choose TWO)

- A. Amazon S3
- B. Amazon EFS
- C. Amazon DynamoDB
- D. Amazon Redshift
- E. Amazon SQS

**17.** During a heterogeneous database migration, what is the recommended sequence?

- A. DMS first, then SCT
- B. Convert schema with SCT, then migrate data with DMS
- C. Use Snowball to ship the database
- D. Use DataSync to replicate tables

**18.** A workload needs to continuously replicate an on-premises file share to AWS and serve it locally with low latency using a cached gateway. Which service?

- A. AWS Storage Gateway (File/Volume Gateway)
- B. AWS Snowmobile
- C. AWS DMS
- D. AWS Transfer Family

**19.** Which factor MOST determines whether to use Snow Family vs online transfer?

- A. Number of AWS accounts
- B. Data size relative to available bandwidth and time
- C. The S3 storage class
- D. The Region's name

**20.** A company must migrate a large VMware-based estate to AWS with minimal refactoring and cutover risk. Which approach is BEST?

- A. Rebuild every app manually on EC2
- B. AWS Application Migration Service (MGN) for lift-and-shift
- C. AWS Glue ETL
- D. Snowmobile
