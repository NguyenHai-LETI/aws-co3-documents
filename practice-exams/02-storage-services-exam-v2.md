# 💾 Practice Exam 02 — Storage Services (SAA-C03) · V2

**30 questions** · scenario-based · English. Answers in `02-storage-services-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q20
- **Part B — Khó / Nâng cao:** Q21–Q30

---

## Part A — Vận dụng (20 câu)

**1.** Objects are accessed frequently for 30 days, then rarely but must be retrievable in milliseconds when needed. Which lifecycle is MOST cost-effective?

- A. S3 Standard → Glacier Deep Archive
- B. S3 Standard → S3 Standard-IA
- C. S3 Standard → S3 One Zone-IA immediately
- D. Keep everything in S3 Standard

**2.** A dataset has unpredictable, changing access patterns and the team does not want to manage lifecycle rules. Which storage class is BEST?

- A. S3 Standard
- B. S3 Standard-IA
- C. S3 Intelligent-Tiering
- D. S3 Glacier Instant Retrieval

**3.** Backups must be archived for 7 years at the LOWEST cost; retrieval within 12–48 hours is acceptable. Which class?

- A. S3 Glacier Instant Retrieval
- B. S3 Glacier Flexible Retrieval
- C. S3 Glacier Deep Archive
- D. S3 One Zone-IA

**4.** Regulatory rules require that financial records in S3 cannot be deleted or overwritten by anyone, including the root user, for 5 years. Which feature?

- A. S3 Versioning
- B. S3 Object Lock in Compliance mode
- C. MFA Delete
- D. Bucket policy denying Delete

**5.** A company must replicate S3 objects to a bucket in another Region for disaster recovery. What is a REQUIREMENT?

- A. Same-Region Replication
- B. Versioning enabled on both buckets
- C. Objects must be in Glacier
- D. Buckets must have the same name

**6.** A database on EC2 needs 40,000 IOPS with consistent low latency. Which EBS volume type?

- A. gp2
- B. gp3
- C. io2
- D. st1

**7.** A big-data workload streams large sequential files and cares about throughput, not IOPS, at low cost. Which EBS type?

- A. io1
- B. st1
- C. sc1
- D. gp3

**8.** Multiple Linux EC2 instances across AZs must share the same file system concurrently. Which service?

- A. EBS with Multi-Attach
- B. Amazon EFS
- C. Instance Store
- D. S3

**9.** A Windows application needs a shared file system with SMB protocol and Active Directory integration. Which service?

- A. Amazon EFS
- B. FSx for Windows File Server
- C. FSx for Lustre
- D. S3 File Gateway

**10.** An HPC/ML workload needs a high-performance file system tightly integrated with S3 for input/output. Which service?

- A. FSx for Windows
- B. FSx for Lustre
- C. EFS
- D. Storage Gateway (Tape)

**11.** On-premises servers need NFS/SMB file shares backed by S3, with a local cache for hot files. Which service?

- A. S3 File Gateway
- B. Volume Gateway (Stored)
- C. Tape Gateway
- D. DataSync

**12.** A company must migrate 500 TB to AWS but has limited network bandwidth and a tight deadline. Which is BEST?

- A. AWS DataSync over the internet
- B. AWS Snowball Edge
- C. S3 Transfer Acceleration
- D. Direct upload via CLI

**13.** An unencrypted EBS volume must be encrypted. What is the correct approach?

- A. Toggle encryption on the live volume
- B. Snapshot → copy snapshot with encryption → create new volume
- C. Enable Multi-Attach
- D. Detach and reattach the volume

**14.** An EBS volume in us-east-1a must be used by an instance in us-east-1b. What must be done?

- A. Attach directly across AZs
- B. Snapshot the volume, create a new volume from it in us-east-1b
- C. Enable Multi-Attach
- D. Use EFS instead of moving

**15.** Global users upload large files to a single S3 bucket and complain about slow uploads. Which feature helps MOST?

- A. S3 Select
- B. S3 Transfer Acceleration
- C. Byte-range fetches
- D. S3 Inventory

**16.** An application must be notified to run a Lambda function whenever a new object is created in a bucket. Which is the SIMPLEST?

- A. Poll the bucket from EC2
- B. S3 Event Notification → Lambda
- C. CloudTrail data events → email
- D. S3 Inventory daily report

**17.** A team needs to run SQL queries to retrieve only a subset of rows from large CSV objects without downloading whole files. Which feature?

- A. S3 Select
- B. S3 Inventory
- C. S3 Batch Operations
- D. S3 Transfer Acceleration

**18.** Dev/test data can tolerate the loss of a single AZ and must cost as little as possible while staying in S3 with millisecond access. Which class?

- A. S3 Standard
- B. S3 One Zone-IA
- C. S3 Glacier Deep Archive
- D. S3 Standard-IA

**19.** A company wants automated, scheduled, incremental transfer of files from on-premises NFS to EFS with integrity verification. Which service?

- A. Storage Gateway (Volume)
- B. AWS DataSync
- C. Snowball
- D. S3 CRR

**20.** Backup software on-premises writes to virtual tapes that should be stored durably in AWS. Which service?

- A. S3 File Gateway
- B. Tape Gateway (VTL)
- C. FSx for OpenZFS
- D. EFS

---

## Part B — Khó / Nâng cao (10 câu)

**21.** A clustered Linux application needs the SAME block volume attached to multiple EC2 instances in one AZ for shared-disk access. Which is required? (Choose TWO)

- A. EBS Multi-Attach
- B. io1/io2 volume type
- C. gp3 volume type
- D. EFS mount targets
- E. Instances in different AZs

**22.** A bucket must allow one team read-only access to a prefix and another team read-write to a different prefix at scale, without a giant bucket policy. Which feature is BEST?

- A. Multiple IAM users sharing one key
- B. S3 Access Points, each with its own policy
- C. Object ACLs
- D. One large bucket policy with many statements

**23.** Objects must be encrypted with keys managed by the customer's own KMS CMK, with CloudTrail auditing of every decrypt. Under heavy load, requests are throttled. What explains this and the fix?

- A. SSE-S3 limits; switch to SSE-C
- B. KMS request quotas on SSE-KMS; request a quota increase or use S3 Bucket Keys
- C. Object Lock throttling; disable it
- D. Versioning overhead; suspend versioning

**24.** A cross-Region replication must guarantee that 99.99% of objects replicate within 15 minutes. Which feature provides this SLA?

- A. Standard CRR
- B. S3 Replication Time Control (RTC)
- C. Batch Replication
- D. Transfer Acceleration

**25.** An application experiences slow first-read latency from newly created EBS volumes restored from snapshots. Which feature eliminates this initialization penalty?

- A. EBS Multi-Attach
- B. Fast Snapshot Restore (FSR)
- C. EBS Snapshot Archive
- D. gp3 provisioning

**26.** A company wants to reduce EBS snapshot storage costs for snapshots rarely restored, accepting 24–72h restore time. Which feature?

- A. Fast Snapshot Restore
- B. EBS Snapshot Archive
- C. Recycle Bin
- D. Multi-Attach

**27.** An FSx for Lustre file system is used only for a short, throughput-intensive processing job and data is persisted in S3. Which deployment option minimizes cost?

- A. Persistent deployment
- B. Scratch deployment
- C. Multi-AZ Windows
- D. NetApp ONTAP

**28.** A bucket must reject any request that is not sent over HTTPS. What enforces this?

- A. Default encryption
- B. A bucket policy denying requests where aws:SecureTransport is false
- C. S3 Block Public Access
- D. Object Lock

**29.** A company needs cross-account access to objects, wants the destination account to OWN replicated objects, and must replicate existing objects already in the bucket. Which two apply? (Choose TWO)

- A. Replication owner override (change object ownership to destination)
- B. S3 Batch Replication for existing objects
- C. Object Lock Compliance mode
- D. SSE-C encryption is required
- E. Transfer Acceleration for existing objects

**30.** An edge site with intermittent connectivity needs a small, rugged device to collect data and run limited compute, later shipping data to AWS. Which device?

- A. Snowmobile
- B. Snowcone
- C. Snowball Edge Storage Optimized (80 TB)
- D. Storage Gateway appliance
