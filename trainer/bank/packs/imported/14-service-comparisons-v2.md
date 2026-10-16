---
pack: saa-14-service-comparisons-v2
title: 14 · Service Comparisons · V2
exam: SAA-C03
origin: imported
source: practice-exams/14-service-comparisons-exam-v2.md
created: 2026-10-16
---

# 14 · Service Comparisons · V2

> Imported from `practice-exams/14-service-comparisons-exam-v2.md` + `14-service-comparisons-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 14-v2-01
- domain: resilient
- task: 2.1
- topic: integration
- services: SQS
- tags: decoupling, sqs-fifo
- difficulty: medium
- time: 50
- source: practice-exams/14-service-comparisons-exam-v2.md#Q1

Decouple with ordered, exactly-once queue processing → which service (vs the alternatives)?

- A. SNS
- B. SQS FIFO
- C. Kinesis Data Streams
- D. EventBridge

**Answer:** B

**Explanation:** Ordered, exactly-once queue = SQS FIFO.

---

## Q 14-v2-02
- domain: performance
- task: 3.2
- topic: integration
- services: SNS
- tags: fan-out
- difficulty: medium
- time: 45
- source: practice-exams/14-service-comparisons-exam-v2.md#Q2

Fan-out one message to many subscribers → which service?

- A. Amazon MQ
- B. Step Functions
- C. SQS
- D. SNS

**Answer:** D

**Explanation:** Fan-out to many subscribers = SNS.

---

## Q 14-v2-03
- domain: performance
- task: 3.4
- topic: networking
- services: CloudFront, Global Accelerator
- difficulty: medium
- time: 60
- source: practice-exams/14-service-comparisons-exam-v2.md#Q3

Cache near users for static content (HTTP) vs route to nearest healthy endpoint (TCP/UDP, static IP) — which pair is CORRECT?

- A. Global Accelerator caches HTML
- B. Route 53 = caching; CloudFront = routing
- C. CloudFront = static content caching; Global Accelerator = nearest endpoint with static anycast IPs
- D. Both do the same thing

**Answer:** C

**Explanation:** CloudFront caches static content; Global Accelerator routes to nearest endpoint via static anycast IPs.

---

## Q 14-v2-04
- domain: performance
- task: 3.4
- topic: networking
- services: VPC Endpoint, S3, DynamoDB, PrivateLink
- difficulty: medium
- time: 55
- source: practice-exams/14-service-comparisons-exam-v2.md#Q4

Gateway endpoint vs Interface endpoint — which is TRUE?

- A. Interface endpoint is only for S3
- B. Gateway endpoint uses ENIs
- C. They are identical
- D. Gateway endpoint = S3/DynamoDB; Interface endpoint (PrivateLink) = most other services via ENI

**Answer:** D

**Explanation:** Gateway endpoint = S3/DynamoDB; Interface endpoint (PrivateLink) = other services via ENI.

---

## Q 14-v2-05
- domain: resilient
- task: 2.2
- topic: database
- services: ElastiCache
- tags: redis-vs-memcached
- difficulty: medium
- time: 50
- source: practice-exams/14-service-comparisons-exam-v2.md#Q5

ElastiCache Redis vs Memcached — which favors Redis?

- A. Persistence, replication, sorted sets, pub/sub
- B. Pure simple multithreaded caching only
- C. Sharding only, no data structures
- D. No failover needed

**Answer:** A

**Explanation:** Redis favored by persistence/replication/sorted sets/pub-sub.

---

## Q 14-v2-06
- domain: performance
- task: 3.1
- topic: storage
- services: S3, Athena, Redshift
- difficulty: medium
- time: 55
- source: practice-exams/14-service-comparisons-exam-v2.md#Q6

Athena vs Redshift — which favors Athena?

- A. Petabyte data warehouse with heavy concurrent BI
- B. Ad-hoc SQL on S3, serverless, pay per query
- C. Sub-second dashboards for thousands of users
- D. Constant complex joins 24/7

**Answer:** B

**Explanation:** Athena favored by ad-hoc serverless SQL on S3, pay per query.

---

## Q 14-v2-07
- domain: performance
- task: 3.1
- topic: storage
- services: EFS, FSx
- tags: fsx-windows
- difficulty: medium
- time: 50
- source: practice-exams/14-service-comparisons-exam-v2.md#Q7

EFS vs FSx for Windows — which favors FSx for Windows?

- A. Linux NFS shared storage
- B. HPC S3 integration
- C. Object storage
- D. SMB + Active Directory for Windows apps

**Answer:** D

**Explanation:** FSx for Windows favored by SMB + Active Directory.

---

## Q 14-v2-08
- domain: performance
- task: 3.3
- topic: database
- services: DynamoDB, RDS
- difficulty: medium
- time: 50
- source: practice-exams/14-service-comparisons-exam-v2.md#Q8

DynamoDB vs RDS — which favors DynamoDB?

- A. Complex multi-table joins and transactions across schemas
- B. Key-value/document, massive scale, single-digit ms, serverless
- C. OLAP reporting
- D. Strong relational integrity with SQL joins

**Answer:** B

**Explanation:** DynamoDB favored by key-value/document, massive scale, serverless.

---

## Q 14-v2-09
- domain: performance
- task: 3.4
- topic: migration
- services: Snow Family, DataSync
- difficulty: medium
- time: 50
- source: practice-exams/14-service-comparisons-exam-v2.md#Q9

Snowball vs DataSync — which favors DataSync?

- A. Ongoing/scheduled online transfer with adequate bandwidth
- B. 500 TB with almost no bandwidth
- C. One-time offline bulk with a deadline
- D. Air-gapped data center

**Answer:** A

**Explanation:** DataSync favored by ongoing/scheduled online transfer with bandwidth.

---

## Q 14-v2-10
- domain: resilient
- task: 2.1
- topic: integration
- services: Step Functions, SQS
- tags: orchestration
- difficulty: medium
- time: 50
- source: practice-exams/14-service-comparisons-exam-v2.md#Q10

Step Functions vs SQS — which favors Step Functions?

- A. Simple buffering of messages
- B. Orchestrating multi-step workflow with branching/retries/state
- C. Fan-out to subscribers
- D. Storing millions of messages

**Answer:** B

**Explanation:** Step Functions favored by multi-step workflow orchestration.

---

## Q 14-v2-11
- domain: performance
- task: 3.5
- topic: analytics
- services: Data Firehose, S3, Redshift, OpenSearch, SQS, Kinesis Data Streams
- tags: streaming-ingestion, sharding, decoupling
- difficulty: hard
- time: 80
- source: practice-exams/14-service-comparisons-exam-v2.md#Q11

Kinesis Data Streams vs Kinesis Data Firehose vs SQS — which statement set is CORRECT?

- A. Firehose supports multiple consumer replay
- B. SQS delivers directly to S3 with no code
- C. All three replay data
- D. Data Streams = real-time, replay, multiple consumers, shards; Firehose = managed buffered delivery to S3/Redshift/OpenSearch; SQS = decoupling queue, no replay

**Answer:** D

**Explanation:** Data Streams=real-time/replay/shards; Firehose=managed delivery; SQS=decoupling, no replay.

---

## Q 14-v2-12
- domain: performance
- task: 3.4
- topic: networking
- services: NAT Gateway, EC2, Internet Gateway
- tags: egress-only-igw, ipv6
- difficulty: hard
- time: 75
- source: practice-exams/14-service-comparisons-exam-v2.md#Q12

NAT Gateway vs NAT Instance vs Egress-Only IGW — which is TRUE?

- A. NAT Gateway = managed IPv4 outbound; NAT Instance = self-managed EC2; Egress-Only IGW = IPv6 outbound-only
- B. Egress-Only IGW is for IPv4
- C. NAT Instance requires no management
- D. NAT Gateway supports inbound connections

**Answer:** A

**Explanation:** NAT Gateway=managed IPv4 outbound; NAT Instance=self-managed; Egress-Only IGW=IPv6 outbound-only.

---

## Q 14-v2-13
- domain: performance
- task: 3.3
- topic: database
- services: Aurora, DynamoDB
- tags: aurora-global-database, dynamodb-global-tables, multi-region
- difficulty: hard
- time: 70
- source: practice-exams/14-service-comparisons-exam-v2.md#Q13

Aurora Global Database vs DynamoDB Global Tables — which favors Aurora Global Database?

- A. Multi-Region active-active NoSQL key-value writes
- B. Single-digit ms NoSQL with no SQL needs
- C. Relational (SQL) workload needing cross-Region reads + fast DR
- D. Schemaless massive-scale writes everywhere

**Answer:** C

**Explanation:** Aurora Global DB favored by relational cross-Region reads + fast DR.

---

## Q 14-v2-14
- domain: secure
- task: 1.2
- topic: security
- services: Cognito
- difficulty: hard
- time: 75
- source: practice-exams/14-service-comparisons-exam-v2.md#Q14

Cognito User Pools vs Identity Pools — which is TRUE?

- A. Identity Pools handle sign-up UI
- B. They are the same
- C. User Pools = authentication (sign-in, tokens); Identity Pools = authorization to AWS resources via temporary credentials
- D. User Pools grant IAM credentials directly

**Answer:** C

**Explanation:** User Pools=authentication; Identity Pools=authorize AWS resources via temp credentials.

---

## Q 14-v2-15
- domain: secure
- task: 1.2
- topic: security
- services: WAF, Shield
- tags: security-groups, web-attacks, ddos-protection
- difficulty: hard
- time: 70
- source: practice-exams/14-service-comparisons-exam-v2.md#Q15

WAF vs Shield vs Security Group — which mapping is CORRECT?

- A. WAF = DDoS-only
- B. Security Group = Layer 7 web rules
- C. WAF = Layer 7 filtering (SQLi/XSS/rate); Shield = DDoS protection; Security Group = stateful instance firewall
- D. Shield = SQL injection filtering

**Answer:** C

**Explanation:** WAF=Layer 7 filtering; Shield=DDoS; Security Group=stateful instance firewall.
