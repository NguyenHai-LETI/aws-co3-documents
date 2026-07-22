# 💾 Practice Exam 02 — Storage Services (SAA-C03)

20 questions · scenario-based · English. Answers in `02-storage-services-answers.txt`.

---

**1.** Logs are accessed frequently for 30 days, then rarely but must be retrievable within milliseconds for 1 year, then archived for 7 years where 12-hour retrieval is acceptable. Which lifecycle is MOST cost-effective?

- A. S3 Standard → S3 One Zone-IA → S3 Glacier Deep Archive
- B. S3 Standard → S3 Standard-IA → S3 Glacier Deep Archive
- C. S3 Standard → S3 Glacier Instant Retrieval → S3 Standard-IA
- D. S3 Intelligent-Tiering → S3 Standard → Glacier Flexible Retrieval

**2.** A bucket stores data with unknown and changing access patterns. The company wants automatic cost optimization without performance impact or retrieval fees. Which storage class is BEST?

- A. S3 Standard
- B. S3 Standard-IA
- C. S3 Intelligent-Tiering
- D. S3 One Zone-IA

**3.** Multiple Linux EC2 instances across AZs need a shared, POSIX-compliant file system that scales automatically. Which service?

- A. Amazon EBS Multi-Attach
- B. Amazon EFS
- C. Amazon FSx for Windows File Server
- D. Amazon S3

**4.** A relational database on EC2 needs a volume delivering 50,000 IOPS with consistent low latency. Which EBS volume type?

- A. gp2
- B. gp3
- C. io2 / io2 Block Express
- D. st1

**5.** To meet a regulatory requirement that objects cannot be deleted or overwritten by anyone (including root) for 5 years, which feature should be enabled?

- A. S3 Versioning only
- B. S3 Object Lock in Compliance mode
- C. S3 Object Lock in Governance mode
- D. MFA Delete

**6.** A company must replicate S3 objects to another Region for disaster recovery and compliance. What is REQUIRED for replication?

- A. Object Lock enabled
- B. Versioning enabled on source and destination buckets
- C. Transfer Acceleration enabled
- D. The buckets must be in the same account

**7.** An on-premises application uses NFS/SMB and needs low-latency local access while storing data durably in Amazon S3. Which solution?

- A. AWS DataSync
- B. Amazon S3 File Gateway
- C. AWS Snowball Edge
- D. Volume Gateway (Stored)

**8.** A company must transfer 600 TB to AWS within two weeks over a 200 Mbps internet link. Which solution is MOST appropriate?

- A. AWS DataSync over the internet
- B. S3 Transfer Acceleration
- C. AWS Snowball Edge Storage Optimized
- D. AWS Storage Gateway

**9.** Which approach lets you move an unencrypted EBS volume's data to an encrypted volume?

- A. Toggle encryption on the existing volume
- B. Create a snapshot, copy it with encryption enabled, then create a new volume
- C. Use EBS Multi-Attach
- D. Detach and re-attach the volume

**10.** An HPC and machine-learning workload needs a high-throughput, sub-millisecond file system tightly integrated with data in Amazon S3. Which service?

- A. Amazon EFS
- B. Amazon FSx for Lustre
- C. Amazon FSx for Windows File Server
- D. Amazon EBS st1

**11.** A Windows-based application needs shared storage over SMB with Active Directory integration. Which service?

- A. Amazon EFS
- B. Amazon FSx for Windows File Server
- C. Amazon S3
- D. Instance Store

**12.** To speed up uploads of large files from users worldwide to a single S3 bucket, which feature should be used?

- A. S3 Cross-Region Replication
- B. S3 Transfer Acceleration
- C. S3 Select
- D. Byte-range fetches

**13.** Which design retrieves only specific rows/columns from large CSV/Parquet objects in S3 using SQL, reducing data scanned?

- A. S3 Inventory
- B. S3 Select
- C. S3 Batch Operations
- D. S3 Storage Lens

**14.** An object-processing pipeline must trigger a Lambda function whenever a new object is created in a bucket. Which is the simplest configuration?

- A. CloudTrail data events polled by Lambda
- B. S3 Event Notification to Lambda (or via EventBridge)
- C. A scheduled Lambda that lists the bucket
- D. S3 Replication to a processing bucket

**15.** A non-critical, easily reproducible dataset can tolerate the loss of a single AZ and must be stored at the lowest cost for infrequent access. Which storage class?

- A. S3 Standard-IA
- B. S3 One Zone-IA
- C. S3 Glacier Instant Retrieval
- D. S3 Standard

**16.** What is the minimum number of days an object must stay in S3 Standard before a lifecycle rule can transition it to S3 Standard-IA?

- A. 0 days
- B. 1 day
- C. 30 days
- D. 90 days

**17.** A company wants to protect S3 objects against accidental deletion and keep previous copies for rollback. Which feature should be enabled?

- A. Cross-Region Replication
- B. Versioning
- C. Transfer Acceleration
- D. Requester Pays

**18.** A clustered application needs the SAME EBS volume attached to multiple EC2 instances in the same AZ concurrently. What is required?

- A. EFS instead of EBS
- B. io1/io2 volume with EBS Multi-Attach
- C. gp3 with Fast Snapshot Restore
- D. st1 throughput-optimized volume

**19.** Which two AWS services let an on-premises data center perform an automated, scheduled, incremental data transfer into AWS storage? (Choose TWO)

- A. AWS DataSync
- B. Amazon S3 Transfer Acceleration
- C. AWS Storage Gateway
- D. AWS Snowmobile
- E. Amazon Macie

**20.** A company stores backups that are rarely accessed but, when needed, must be available within minutes a few times per year, at the lowest cost. Which storage class?

- A. S3 Glacier Deep Archive
- B. S3 Glacier Flexible Retrieval (Expedited/Standard)
- C. S3 Standard-IA
- D. S3 Intelligent-Tiering Frequent Access tier
