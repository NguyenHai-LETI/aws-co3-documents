# ⚖️ Practice Exam 14 — Service Comparisons (SAA-C03) · V2

**15 questions** · "choose the RIGHT service" · English. Answers in `14-service-comparisons-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q10
- **Part B — Khó / Nâng cao:** Q11–Q15

---

## Part A — Vận dụng (10 câu)

**1.** Decouple with ordered, exactly-once queue processing → which service (vs the alternatives)?

- A. SQS FIFO
- B. SNS
- C. Kinesis Data Streams
- D. EventBridge

**2.** Fan-out one message to many subscribers → which service?

- A. SNS
- B. SQS
- C. Step Functions
- D. Amazon MQ

**3.** Cache near users for static content (HTTP) vs route to nearest healthy endpoint (TCP/UDP, static IP) — which pair is CORRECT?

- A. CloudFront = static content caching; Global Accelerator = nearest endpoint with static anycast IPs
- B. Both do the same thing
- C. Route 53 = caching; CloudFront = routing
- D. Global Accelerator caches HTML

**4.** Gateway endpoint vs Interface endpoint — which is TRUE?

- A. Gateway endpoint = S3/DynamoDB; Interface endpoint (PrivateLink) = most other services via ENI
- B. Gateway endpoint uses ENIs
- C. Interface endpoint is only for S3
- D. They are identical

**5.** ElastiCache Redis vs Memcached — which favors Redis?

- A. Persistence, replication, sorted sets, pub/sub
- B. Pure simple multithreaded caching only
- C. No failover needed
- D. Sharding only, no data structures

**6.** Athena vs Redshift — which favors Athena?

- A. Ad-hoc SQL on S3, serverless, pay per query
- B. Petabyte data warehouse with heavy concurrent BI
- C. Constant complex joins 24/7
- D. Sub-second dashboards for thousands of users

**7.** EFS vs FSx for Windows — which favors FSx for Windows?

- A. SMB + Active Directory for Windows apps
- B. Linux NFS shared storage
- C. HPC S3 integration
- D. Object storage

**8.** DynamoDB vs RDS — which favors DynamoDB?

- A. Key-value/document, massive scale, single-digit ms, serverless
- B. Complex multi-table joins and transactions across schemas
- C. Strong relational integrity with SQL joins
- D. OLAP reporting

**9.** Snowball vs DataSync — which favors DataSync?

- A. Ongoing/scheduled online transfer with adequate bandwidth
- B. 500 TB with almost no bandwidth
- C. One-time offline bulk with a deadline
- D. Air-gapped data center

**10.** Step Functions vs SQS — which favors Step Functions?

- A. Orchestrating multi-step workflow with branching/retries/state
- B. Simple buffering of messages
- C. Storing millions of messages
- D. Fan-out to subscribers

---

## Part B — Khó / Nâng cao (5 câu)

**11.** Kinesis Data Streams vs Kinesis Data Firehose vs SQS — which statement set is CORRECT?

- A. Data Streams = real-time, replay, multiple consumers, shards; Firehose = managed buffered delivery to S3/Redshift/OpenSearch; SQS = decoupling queue, no replay
- B. All three replay data
- C. Firehose supports multiple consumer replay
- D. SQS delivers directly to S3 with no code

**12.** NAT Gateway vs NAT Instance vs Egress-Only IGW — which is TRUE?

- A. NAT Gateway = managed IPv4 outbound; NAT Instance = self-managed EC2; Egress-Only IGW = IPv6 outbound-only
- B. Egress-Only IGW is for IPv4
- C. NAT Gateway supports inbound connections
- D. NAT Instance requires no management

**13.** Aurora Global Database vs DynamoDB Global Tables — which favors Aurora Global Database?

- A. Relational (SQL) workload needing cross-Region reads + fast DR
- B. Multi-Region active-active NoSQL key-value writes
- C. Schemaless massive-scale writes everywhere
- D. Single-digit ms NoSQL with no SQL needs

**14.** Cognito User Pools vs Identity Pools — which is TRUE?

- A. User Pools = authentication (sign-in, tokens); Identity Pools = authorization to AWS resources via temporary credentials
- B. Identity Pools handle sign-up UI
- C. User Pools grant IAM credentials directly
- D. They are the same

**15.** WAF vs Shield vs Security Group — which mapping is CORRECT?

- A. WAF = Layer 7 filtering (SQLi/XSS/rate); Shield = DDoS protection; Security Group = stateful instance firewall
- B. Shield = SQL injection filtering
- C. Security Group = Layer 7 web rules
- D. WAF = DDoS-only
