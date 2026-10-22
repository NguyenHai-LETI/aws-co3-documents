---
pack: saa-14-service-comparisons-v1
title: 14 · Service Comparisons / Decision · V1
exam: SAA-C03
origin: imported
source: practice-exams/14-service-comparisons-exam.md
created: 2026-10-16
---

# 14 · Service Comparisons / Decision · V1

> Imported from `practice-exams/14-service-comparisons-exam.md` + `14-service-comparisons-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 14-v1-01
- domain: performance
- task: 3.4
- topic: networking
- services: NLB, ELB
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q1

You need a load balancer that preserves the client source IP, gives a static IP, and handles TCP at extreme scale. Which one?

- A. Classic Load Balancer
- B. Gateway Load Balancer
- C. Network Load Balancer
- D. Application Load Balancer

**Answer:** C

**Explanation:** Source IP + static IP + TCP at scale = NLB.

---

## Q 14-v1-02
- domain: performance
- task: 3.3
- topic: database
- services: ElastiCache, RDS
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q2

Choose the service for caching frequently accessed query results to reduce RDS read load with the LEAST code change for a generic SQL DB.

- A. Read Replica only
- B. CloudFront
- C. Amazon ElastiCache
- D. DynamoDB DAX

**Answer:** C

**Explanation:** Generic SQL cache, least code change = ElastiCache.

---

## Q 14-v1-03
- domain: cost
- task: 4.4
- topic: networking
- services: VPC Endpoint, S3, DynamoDB, PrivateLink
- difficulty: medium
- time: 80
- source: practice-exams/14-service-comparisons-exam.md#Q3

"Private access to S3 at no extra cost vs private access to most other AWS services." Which two endpoints correspond? (Choose TWO)

- A. Gateway Endpoint → all services
- B. Gateway Endpoint → S3/DynamoDB (free)
- C. NAT Gateway → free private access
- D. Interface Endpoint (PrivateLink) → most services
- E. Interface Endpoint → S3 only

**Answer:** B, D

**Explanation:** Gateway Endpoint (S3/DynamoDB, free) + Interface Endpoint (most services).

---

## Q 14-v1-04
- domain: performance
- task: 3.4
- topic: networking
- services: CloudFront, Global Accelerator
- difficulty: easy
- time: 50
- source: practice-exams/14-service-comparisons-exam.md#Q4

For accelerating delivery of CACHEABLE HTTP content globally vs accelerating TCP/UDP with static IPs, which pair is correct?

- A. CloudFront (cache HTTP) vs Global Accelerator (TCP/UDP static IP)
- B. Global Accelerator (cache) vs CloudFront (TCP)
- C. Both cache content equally
- D. Route 53 vs CloudFront

**Answer:** A

**Explanation:** CloudFront caches HTTP; Global Accelerator = TCP/UDP static IP.

---

## Q 14-v1-05
- domain: cost
- task: 4.3
- topic: security
- services: Secrets Manager, Systems Manager
- tags: key-rotation
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q5

Choose for "automatic rotation of database credentials" vs "cheap storage of config parameters."

- A. Cognito vs IAM
- B. Secrets Manager vs Parameter Store
- C. KMS vs ACM
- D. Parameter Store vs Secrets Manager

**Answer:** B

**Explanation:** Auto rotate DB creds = Secrets Manager; cheap config = Parameter Store.

---

## Q 14-v1-06
- domain: secure
- task: 1.3
- topic: management
- services: CloudTrail, AWS Config
- tags: compliance
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q6

Which is correct: "Track API calls (who did what)" vs "Track resource configuration/compliance over time"?

- A. CloudWatch vs CloudTrail
- B. CloudTrail vs AWS Config
- C. GuardDuty vs Macie
- D. AWS Config vs CloudTrail

**Answer:** B

**Explanation:** Who-did-what = CloudTrail; config/compliance = AWS Config.

---

## Q 14-v1-07
- domain: performance
- task: 3.3
- topic: database
- services: RDS
- tags: multi-az, read-replicas
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q7

For "synchronous standby for HA" vs "asynchronous copies for read scaling," which RDS pair?

- A. Read Replicas vs Multi-AZ
- B. Aurora Global vs Multi-AZ
- C. Snapshot vs Multi-AZ
- D. Multi-AZ vs Read Replicas

**Answer:** D

**Explanation:** Synchronous HA standby = Multi-AZ; async read scaling = Read Replicas.

---

## Q 14-v1-08
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS, SNS
- tags: decoupling, fan-out
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q8

Choose for "decouple with a queue (1:1 consumer)" vs "fan-out push to many subscribers (1:N)."

- A. Kinesis vs SNS
- B. SNS vs SQS
- C. SQS vs SNS
- D. EventBridge vs SQS

**Answer:** C

**Explanation:** Queue 1:1 = SQS; pub/sub 1:N = SNS.

---

## Q 14-v1-09
- domain: performance
- task: 3.5
- topic: analytics
- services: Athena, Redshift, S3
- tags: offline-transfer
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q9

Which is correct for "serverless SQL over S3" vs "managed petabyte data warehouse"?

- A. EMR vs Athena
- B. Athena vs Redshift
- C. Redshift vs Athena
- D. Glue vs Redshift

**Answer:** B

**Explanation:** Serverless SQL over S3 = Athena; warehouse = Redshift.

---

## Q 14-v1-10
- domain: performance
- task: 3.2
- topic: compute
- services: EKS, ECS
- tags: orchestration
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q10

"Managed Kubernetes" vs "AWS-proprietary container orchestration." Which pair?

- A. Fargate vs EKS
- B. Batch vs ECS
- C. ECS vs EKS
- D. EKS vs ECS

**Answer:** D

**Explanation:** Managed Kubernetes = EKS; AWS-proprietary = ECS.

---

## Q 14-v1-11
- domain: performance
- task: 3.3
- topic: database
- services: Neptune, DocumentDB
- difficulty: easy
- time: 45
- enriched: 2026-10-22
- source: practice-exams/14-service-comparisons-exam.md#Q11

For "graph relationships" vs "MongoDB-compatible document store," choose the pair.

- A. Neptune vs DocumentDB
- B. Keyspaces vs Neptune
- C. DynamoDB vs DocumentDB
- D. DocumentDB vs Neptune

**Answer:** A

**Explanation:** Amazon Neptune is the purpose-built graph database for highly connected relationships, and Amazon DocumentDB is the MongoDB-compatible document database.
- Keyspaces vs Neptune: Keyspaces is Cassandra-compatible wide-column, not graph.
- DynamoDB vs DocumentDB: DynamoDB is a key-value/document store, not a graph database.
- DocumentDB vs Neptune: the right services in the reverse order.
> 🇻🇳 Đồ thị → Neptune; tương thích MongoDB → DocumentDB.

---

## Q 14-v1-12
- domain: performance
- task: 3.5
- topic: analytics
- services: Kinesis Data Streams, Data Firehose, S3, Redshift
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q12

"Real-time streaming with custom consumers/replay" vs "managed near-real-time delivery to S3/Redshift." Which pair?

- A. Firehose vs Kinesis Data Streams
- B. SQS vs Kinesis
- C. MSK vs Firehose
- D. Kinesis Data Streams vs Firehose

**Answer:** D

**Explanation:** Real-time custom/replay = Kinesis Data Streams; managed delivery = Firehose.

---

## Q 14-v1-13
- domain: secure
- task: 1.2
- topic: other
- tags: subnets, nacl, security-groups
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q13

Choose for "block specific IP at subnet (stateless, deny)" vs "instance-level stateful allow rules."

- A. Security Group vs NACL
- B. Shield vs Security Group
- C. WAF vs NACL
- D. NACL vs Security Group

**Answer:** D

**Explanation:** Subnet stateless deny = NACL; instance stateful allow = Security Group.

---

## Q 14-v1-14
- domain: secure
- task: 1.2
- topic: security
- services: Shield, WAF
- tags: ddos-protection, web-attacks
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q14

"DDoS protection (L3/4, free)" vs "web exploit filtering (SQLi/XSS, L7)." Which pair?

- A. Shield Standard vs WAF
- B. Firewall Manager vs Shield
- C. WAF vs Shield
- D. GuardDuty vs WAF

**Answer:** A

**Explanation:** Free L3/4 DDoS = Shield Standard; L7 web exploits = WAF.

---

## Q 14-v1-15
- domain: resilient
- task: 2.2
- topic: storage
- services: EFS, FSx
- tags: multi-az, fsx-windows
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q15

For "shared file storage for Linux (NFS, multi-AZ)" vs "shared file storage for Windows (SMB, AD)," choose the pair.

- A. S3 vs EFS
- B. EFS vs FSx for Windows
- C. EBS vs EFS
- D. FSx for Windows vs EFS

**Answer:** B

**Explanation:** Linux NFS multi-AZ = EFS; Windows SMB+AD = FSx for Windows.

---

## Q 14-v1-16
- domain: performance
- task: 3.5
- topic: migration
- services: DataSync, Snow Family
- tags: offline-transfer
- difficulty: easy
- time: 45
- enriched: 2026-10-22
- source: practice-exams/14-service-comparisons-exam.md#Q16

"Online automated incremental transfer over network" vs "offline physical device for limited bandwidth." Which pair?

- A. DataSync vs Snowball
- B. Snowball vs DataSync
- C. Transfer Family vs Snowball
- D. Storage Gateway vs DataSync

**Answer:** A

**Explanation:** DataSync performs online, automated, incremental transfers over the network, while a Snowball device is the offline option when bandwidth is too limited.
- Snowball vs DataSync: the right services in the reverse order.
- Transfer Family vs Snowball: Transfer Family offers SFTP/FTPS endpoints for partners, not incremental sync.
- Storage Gateway vs DataSync: Storage Gateway is hybrid storage access, and DataSync is online, not offline.
Status: Snowball Edge is available only to existing customers since 2025-11-07 (device support ends 2026-12-31).
> 🇻🇳 Online, incremental → DataSync; thiết bị offline → Snowball (chỉ còn cho khách hàng hiện có).

---

## Q 14-v1-17
- domain: performance
- task: 3.5
- topic: migration
- services: Application Migration Service, DMS
- tags: cdc-replication
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q17

Choose for "lift-and-shift server migration" vs "database migration with CDC."

- A. AWS MGN vs AWS DMS
- B. Snowball vs MGN
- C. DataSync vs DMS
- D. AWS DMS vs AWS MGN

**Answer:** A

**Explanation:** Server lift-and-shift = MGN; DB migration w/ CDC = DMS.

---

## Q 14-v1-18
- domain: secure
- task: 1.2
- topic: security
- services: Cognito
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q18

"Authenticate app users (sign-in)" vs "grant temporary AWS credentials to those users." Which Cognito pair?

- A. Identity Pools vs User Pools
- B. IAM vs Cognito
- C. User Pools vs Identity Pools
- D. STS vs User Pools

**Answer:** C

**Explanation:** Sign-in = User Pools; AWS creds = Identity Pools.

---

## Q 14-v1-19
- domain: cost
- task: 4.1
- topic: storage
- services: S3 Glacier, S3
- tags: s3-glacier-tiers
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q19

For "lowest cost archive, 12h retrieval" vs "archive with millisecond retrieval," which S3 pair?

- A. Glacier Instant Retrieval vs Deep Archive
- B. Standard-IA vs One Zone-IA
- C. Glacier Deep Archive vs Glacier Instant Retrieval
- D. Intelligent-Tiering vs Standard

**Answer:** C

**Explanation:** 12h cheapest archive = Deep Archive; ms archive = Glacier Instant Retrieval.

---

## Q 14-v1-20
- domain: resilient
- task: 2.1
- topic: integration
- services: Step Functions, EventBridge
- tags: orchestration
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q20

"Orchestrate multi-step workflow with state/branching/retries" vs "route events by pattern to targets." Which pair?

- A. SQS vs Step Functions
- B. EventBridge vs Step Functions
- C. SNS vs EventBridge
- D. Step Functions vs EventBridge

**Answer:** D

**Explanation:** Workflow orchestration = Step Functions; event routing = EventBridge.
