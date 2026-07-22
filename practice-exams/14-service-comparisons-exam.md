# ⚖️ Practice Exam 14 — Service Comparisons / Decision (SAA-C03)

20 questions targeting commonly-confused service pairs. Answers in `14-service-comparisons-answers.txt`.

---

**1.** You need a load balancer that preserves the client source IP, gives a static IP, and handles TCP at extreme scale. Which one?

- A. Application Load Balancer
- B. Network Load Balancer
- C. Gateway Load Balancer
- D. Classic Load Balancer

**2.** Choose the service for caching frequently accessed query results to reduce RDS read load with the LEAST code change for a generic SQL DB.

- A. DynamoDB DAX
- B. Amazon ElastiCache
- C. CloudFront
- D. Read Replica only

**3.** "Private access to S3 at no extra cost vs private access to most other AWS services." Which two endpoints correspond? (Choose TWO)

- A. Gateway Endpoint → S3/DynamoDB (free)
- B. Interface Endpoint (PrivateLink) → most services
- C. Gateway Endpoint → all services
- D. Interface Endpoint → S3 only
- E. NAT Gateway → free private access

**4.** For accelerating delivery of CACHEABLE HTTP content globally vs accelerating TCP/UDP with static IPs, which pair is correct?

- A. CloudFront (cache HTTP) vs Global Accelerator (TCP/UDP static IP)
- B. Global Accelerator (cache) vs CloudFront (TCP)
- C. Both cache content equally
- D. Route 53 vs CloudFront

**5.** Choose for "automatic rotation of database credentials" vs "cheap storage of config parameters."

- A. Secrets Manager vs Parameter Store
- B. Parameter Store vs Secrets Manager
- C. KMS vs ACM
- D. Cognito vs IAM

**6.** Which is correct: "Track API calls (who did what)" vs "Track resource configuration/compliance over time"?

- A. CloudTrail vs AWS Config
- B. AWS Config vs CloudTrail
- C. CloudWatch vs CloudTrail
- D. GuardDuty vs Macie

**7.** For "synchronous standby for HA" vs "asynchronous copies for read scaling," which RDS pair?

- A. Multi-AZ vs Read Replicas
- B. Read Replicas vs Multi-AZ
- C. Aurora Global vs Multi-AZ
- D. Snapshot vs Multi-AZ

**8.** Choose for "decouple with a queue (1:1 consumer)" vs "fan-out push to many subscribers (1:N)."

- A. SQS vs SNS
- B. SNS vs SQS
- C. EventBridge vs SQS
- D. Kinesis vs SNS

**9.** Which is correct for "serverless SQL over S3" vs "managed petabyte data warehouse"?

- A. Athena vs Redshift
- B. Redshift vs Athena
- C. EMR vs Athena
- D. Glue vs Redshift

**10.** "Managed Kubernetes" vs "AWS-proprietary container orchestration." Which pair?

- A. EKS vs ECS
- B. ECS vs EKS
- C. Fargate vs EKS
- D. Batch vs ECS

**11.** For "graph relationships" vs "MongoDB-compatible document store," choose the pair.

- A. Neptune vs DocumentDB
- B. DocumentDB vs Neptune
- C. Keyspaces vs Neptune
- D. QLDB vs DocumentDB

**12.** "Real-time streaming with custom consumers/replay" vs "managed near-real-time delivery to S3/Redshift." Which pair?

- A. Kinesis Data Streams vs Firehose
- B. Firehose vs Kinesis Data Streams
- C. SQS vs Kinesis
- D. MSK vs Firehose

**13.** Choose for "block specific IP at subnet (stateless, deny)" vs "instance-level stateful allow rules."

- A. NACL vs Security Group
- B. Security Group vs NACL
- C. WAF vs NACL
- D. Shield vs Security Group

**14.** "DDoS protection (L3/4, free)" vs "web exploit filtering (SQLi/XSS, L7)." Which pair?

- A. Shield Standard vs WAF
- B. WAF vs Shield
- C. GuardDuty vs WAF
- D. Firewall Manager vs Shield

**15.** For "shared file storage for Linux (NFS, multi-AZ)" vs "shared file storage for Windows (SMB, AD)," choose the pair.

- A. EFS vs FSx for Windows
- B. FSx for Windows vs EFS
- C. EBS vs EFS
- D. S3 vs EFS

**16.** "Online automated incremental transfer over network" vs "offline physical device for limited bandwidth." Which pair?

- A. DataSync vs Snowball
- B. Snowball vs DataSync
- C. Storage Gateway vs DataSync
- D. Transfer Family vs Snowball

**17.** Choose for "lift-and-shift server migration" vs "database migration with CDC."

- A. AWS MGN vs AWS DMS
- B. AWS DMS vs AWS MGN
- C. DataSync vs DMS
- D. Snowball vs MGN

**18.** "Authenticate app users (sign-in)" vs "grant temporary AWS credentials to those users." Which Cognito pair?

- A. User Pools vs Identity Pools
- B. Identity Pools vs User Pools
- C. IAM vs Cognito
- D. STS vs User Pools

**19.** For "lowest cost archive, 12h retrieval" vs "archive with millisecond retrieval," which S3 pair?

- A. Glacier Deep Archive vs Glacier Instant Retrieval
- B. Glacier Instant Retrieval vs Deep Archive
- C. Standard-IA vs One Zone-IA
- D. Intelligent-Tiering vs Standard

**20.** "Orchestrate multi-step workflow with state/branching/retries" vs "route events by pattern to targets." Which pair?

- A. Step Functions vs EventBridge
- B. EventBridge vs Step Functions
- C. SQS vs Step Functions
- D. SNS vs EventBridge
