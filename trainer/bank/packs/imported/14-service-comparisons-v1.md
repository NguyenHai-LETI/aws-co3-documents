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
- topic: networking
- services: NLB, ELB
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q1

You need a load balancer that preserves the client source IP, gives a static IP, and handles TCP at extreme scale. Which one?

- A. Application Load Balancer
- B. Network Load Balancer
- C. Gateway Load Balancer
- D. Classic Load Balancer

**Answer:** B

**Explanation:** Source IP + static IP + TCP at scale = NLB.

---

## Q 14-v1-02
- domain: performance
- topic: database
- services: ElastiCache, RDS
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q2

Choose the service for caching frequently accessed query results to reduce RDS read load with the LEAST code change for a generic SQL DB.

- A. DynamoDB DAX
- B. Amazon ElastiCache
- C. CloudFront
- D. Read Replica only

**Answer:** B

**Explanation:** Generic SQL cache, least code change = ElastiCache.

---

## Q 14-v1-03
- domain: cost
- topic: networking
- services: VPC Endpoint, S3, DynamoDB, PrivateLink
- difficulty: medium
- time: 80
- source: practice-exams/14-service-comparisons-exam.md#Q3

"Private access to S3 at no extra cost vs private access to most other AWS services." Which two endpoints correspond? (Choose TWO)

- A. Gateway Endpoint → S3/DynamoDB (free)
- B. Interface Endpoint (PrivateLink) → most services
- C. Gateway Endpoint → all services
- D. Interface Endpoint → S3 only
- E. NAT Gateway → free private access

**Answer:** A, B

**Explanation:** Gateway Endpoint (S3/DynamoDB, free) + Interface Endpoint (most services).

---

## Q 14-v1-04
- domain: performance
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
- topic: security
- services: Secrets Manager, Systems Manager
- tags: key-rotation
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q5

Choose for "automatic rotation of database credentials" vs "cheap storage of config parameters."

- A. Secrets Manager vs Parameter Store
- B. Parameter Store vs Secrets Manager
- C. KMS vs ACM
- D. Cognito vs IAM

**Answer:** A

**Explanation:** Auto rotate DB creds = Secrets Manager; cheap config = Parameter Store.

---

## Q 14-v1-06
- domain: secure
- topic: management
- services: CloudTrail, AWS Config
- tags: compliance
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q6

Which is correct: "Track API calls (who did what)" vs "Track resource configuration/compliance over time"?

- A. CloudTrail vs AWS Config
- B. AWS Config vs CloudTrail
- C. CloudWatch vs CloudTrail
- D. GuardDuty vs Macie

**Answer:** A

**Explanation:** Who-did-what = CloudTrail; config/compliance = AWS Config.

---

## Q 14-v1-07
- domain: performance
- topic: database
- services: RDS
- tags: multi-az, read-replicas
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q7

For "synchronous standby for HA" vs "asynchronous copies for read scaling," which RDS pair?

- A. Multi-AZ vs Read Replicas
- B. Read Replicas vs Multi-AZ
- C. Aurora Global vs Multi-AZ
- D. Snapshot vs Multi-AZ

**Answer:** A

**Explanation:** Synchronous HA standby = Multi-AZ; async read scaling = Read Replicas.

---

## Q 14-v1-08
- domain: resilient
- topic: integration
- services: SQS, SNS
- tags: decoupling, fan-out
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q8

Choose for "decouple with a queue (1:1 consumer)" vs "fan-out push to many subscribers (1:N)."

- A. SQS vs SNS
- B. SNS vs SQS
- C. EventBridge vs SQS
- D. Kinesis vs SNS

**Answer:** A

**Explanation:** Queue 1:1 = SQS; pub/sub 1:N = SNS.

---

## Q 14-v1-09
- domain: performance
- topic: analytics
- services: Athena, Redshift, S3
- tags: offline-transfer
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q9

Which is correct for "serverless SQL over S3" vs "managed petabyte data warehouse"?

- A. Athena vs Redshift
- B. Redshift vs Athena
- C. EMR vs Athena
- D. Glue vs Redshift

**Answer:** A

**Explanation:** Serverless SQL over S3 = Athena; warehouse = Redshift.

---

## Q 14-v1-10
- domain: performance
- topic: compute
- services: EKS, ECS
- tags: orchestration
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q10

"Managed Kubernetes" vs "AWS-proprietary container orchestration." Which pair?

- A. EKS vs ECS
- B. ECS vs EKS
- C. Fargate vs EKS
- D. Batch vs ECS

**Answer:** A

**Explanation:** Managed Kubernetes = EKS; AWS-proprietary = ECS.

---

## Q 14-v1-11
- domain: performance
- topic: database
- services: Neptune, DocumentDB
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q11

For "graph relationships" vs "MongoDB-compatible document store," choose the pair.

- A. Neptune vs DocumentDB
- B. DocumentDB vs Neptune
- C. Keyspaces vs Neptune
- D. QLDB vs DocumentDB

**Answer:** A

**Explanation:** Graph = Neptune; MongoDB-compatible = DocumentDB.

---

## Q 14-v1-12
- domain: performance
- topic: analytics
- services: Kinesis Data Streams, Data Firehose, S3, Redshift
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q12

"Real-time streaming with custom consumers/replay" vs "managed near-real-time delivery to S3/Redshift." Which pair?

- A. Kinesis Data Streams vs Firehose
- B. Firehose vs Kinesis Data Streams
- C. SQS vs Kinesis
- D. MSK vs Firehose

**Answer:** A

**Explanation:** Real-time custom/replay = Kinesis Data Streams; managed delivery = Firehose.

---

## Q 14-v1-13
- domain: secure
- topic: other
- tags: subnets, nacl, security-groups
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q13

Choose for "block specific IP at subnet (stateless, deny)" vs "instance-level stateful allow rules."

- A. NACL vs Security Group
- B. Security Group vs NACL
- C. WAF vs NACL
- D. Shield vs Security Group

**Answer:** A

**Explanation:** Subnet stateless deny = NACL; instance stateful allow = Security Group.

---

## Q 14-v1-14
- domain: secure
- topic: security
- services: Shield, WAF
- tags: ddos-protection, web-attacks
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q14

"DDoS protection (L3/4, free)" vs "web exploit filtering (SQLi/XSS, L7)." Which pair?

- A. Shield Standard vs WAF
- B. WAF vs Shield
- C. GuardDuty vs WAF
- D. Firewall Manager vs Shield

**Answer:** A

**Explanation:** Free L3/4 DDoS = Shield Standard; L7 web exploits = WAF.

---

## Q 14-v1-15
- domain: resilient
- topic: storage
- services: EFS, FSx
- tags: multi-az, fsx-windows
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q15

For "shared file storage for Linux (NFS, multi-AZ)" vs "shared file storage for Windows (SMB, AD)," choose the pair.

- A. EFS vs FSx for Windows
- B. FSx for Windows vs EFS
- C. EBS vs EFS
- D. S3 vs EFS

**Answer:** A

**Explanation:** Linux NFS multi-AZ = EFS; Windows SMB+AD = FSx for Windows.

---

## Q 14-v1-16
- domain: performance
- topic: migration
- services: DataSync, Snow Family
- tags: offline-transfer
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q16

"Online automated incremental transfer over network" vs "offline physical device for limited bandwidth." Which pair?

- A. DataSync vs Snowball
- B. Snowball vs DataSync
- C. Storage Gateway vs DataSync
- D. Transfer Family vs Snowball

**Answer:** A

**Explanation:** Online incremental = DataSync; offline device = Snowball.

---

## Q 14-v1-17
- domain: performance
- topic: migration
- services: Application Migration Service, DMS
- tags: cdc-replication
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q17

Choose for "lift-and-shift server migration" vs "database migration with CDC."

- A. AWS MGN vs AWS DMS
- B. AWS DMS vs AWS MGN
- C. DataSync vs DMS
- D. Snowball vs MGN

**Answer:** A

**Explanation:** Server lift-and-shift = MGN; DB migration w/ CDC = DMS.

---

## Q 14-v1-18
- domain: secure
- topic: security
- services: Cognito
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q18

"Authenticate app users (sign-in)" vs "grant temporary AWS credentials to those users." Which Cognito pair?

- A. User Pools vs Identity Pools
- B. Identity Pools vs User Pools
- C. IAM vs Cognito
- D. STS vs User Pools

**Answer:** A

**Explanation:** Sign-in = User Pools; AWS creds = Identity Pools.

---

## Q 14-v1-19
- domain: cost
- topic: storage
- services: S3 Glacier, S3
- tags: s3-glacier-tiers
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q19

For "lowest cost archive, 12h retrieval" vs "archive with millisecond retrieval," which S3 pair?

- A. Glacier Deep Archive vs Glacier Instant Retrieval
- B. Glacier Instant Retrieval vs Deep Archive
- C. Standard-IA vs One Zone-IA
- D. Intelligent-Tiering vs Standard

**Answer:** A

**Explanation:** 12h cheapest archive = Deep Archive; ms archive = Glacier Instant Retrieval.

---

## Q 14-v1-20
- domain: resilient
- topic: integration
- services: Step Functions, EventBridge
- tags: orchestration
- difficulty: easy
- time: 45
- source: practice-exams/14-service-comparisons-exam.md#Q20

"Orchestrate multi-step workflow with state/branching/retries" vs "route events by pattern to targets." Which pair?

- A. Step Functions vs EventBridge
- B. EventBridge vs Step Functions
- C. SQS vs Step Functions
- D. SNS vs EventBridge

**Answer:** A

**Explanation:** Workflow orchestration = Step Functions; event routing = EventBridge.
