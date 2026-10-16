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
- topic: integration
- services: SQS
- tags: decoupling, sqs-fifo
- difficulty: medium
- time: 50
- source: practice-exams/14-service-comparisons-exam-v2.md#Q1

Decouple with ordered, exactly-once queue processing → which service (vs the alternatives)?

- A. SQS FIFO
- B. SNS
- C. Kinesis Data Streams
- D. EventBridge

**Answer:** A

**Explanation:** Ordered, exactly-once queue = SQS FIFO.

---

## Q 14-v2-02
- domain: performance
- topic: integration
- services: SNS
- tags: fan-out
- difficulty: medium
- time: 45
- source: practice-exams/14-service-comparisons-exam-v2.md#Q2

Fan-out one message to many subscribers → which service?

- A. SNS
- B. SQS
- C. Step Functions
- D. Amazon MQ

**Answer:** A

**Explanation:** Fan-out to many subscribers = SNS.

---

## Q 14-v2-03
- domain: performance
- topic: networking
- services: CloudFront, Global Accelerator
- difficulty: medium
- time: 60
- source: practice-exams/14-service-comparisons-exam-v2.md#Q3

Cache near users for static content (HTTP) vs route to nearest healthy endpoint (TCP/UDP, static IP) — which pair is CORRECT?

- A. CloudFront = static content caching; Global Accelerator = nearest endpoint with static anycast IPs
- B. Both do the same thing
- C. Route 53 = caching; CloudFront = routing
- D. Global Accelerator caches HTML

**Answer:** A

**Explanation:** CloudFront caches static content; Global Accelerator routes to nearest endpoint via static anycast IPs.

---

## Q 14-v2-04
- domain: performance
- topic: networking
- services: VPC Endpoint, S3, DynamoDB, PrivateLink
- difficulty: medium
- time: 55
- source: practice-exams/14-service-comparisons-exam-v2.md#Q4

Gateway endpoint vs Interface endpoint — which is TRUE?

- A. Gateway endpoint = S3/DynamoDB; Interface endpoint (PrivateLink) = most other services via ENI
- B. Gateway endpoint uses ENIs
- C. Interface endpoint is only for S3
- D. They are identical

**Answer:** A

**Explanation:** Gateway endpoint = S3/DynamoDB; Interface endpoint (PrivateLink) = other services via ENI.

---

## Q 14-v2-05
- domain: resilient
- topic: database
- services: ElastiCache
- tags: redis-vs-memcached
- difficulty: medium
- time: 50
- source: practice-exams/14-service-comparisons-exam-v2.md#Q5

ElastiCache Redis vs Memcached — which favors Redis?

- A. Persistence, replication, sorted sets, pub/sub
- B. Pure simple multithreaded caching only
- C. No failover needed
- D. Sharding only, no data structures

**Answer:** A

**Explanation:** Redis favored by persistence/replication/sorted sets/pub-sub.

---

## Q 14-v2-06
- domain: performance
- topic: storage
- services: S3, Athena, Redshift
- difficulty: medium
- time: 55
- source: practice-exams/14-service-comparisons-exam-v2.md#Q6

Athena vs Redshift — which favors Athena?

- A. Ad-hoc SQL on S3, serverless, pay per query
- B. Petabyte data warehouse with heavy concurrent BI
- C. Constant complex joins 24/7
- D. Sub-second dashboards for thousands of users

**Answer:** A

**Explanation:** Athena favored by ad-hoc serverless SQL on S3, pay per query.

---

## Q 14-v2-07
- domain: performance
- topic: storage
- services: EFS, FSx
- tags: fsx-windows
- difficulty: medium
- time: 50
- source: practice-exams/14-service-comparisons-exam-v2.md#Q7

EFS vs FSx for Windows — which favors FSx for Windows?

- A. SMB + Active Directory for Windows apps
- B. Linux NFS shared storage
- C. HPC S3 integration
- D. Object storage

**Answer:** A

**Explanation:** FSx for Windows favored by SMB + Active Directory.

---

## Q 14-v2-08
- domain: performance
- topic: database
- services: DynamoDB, RDS
- difficulty: medium
- time: 50
- source: practice-exams/14-service-comparisons-exam-v2.md#Q8

DynamoDB vs RDS — which favors DynamoDB?

- A. Key-value/document, massive scale, single-digit ms, serverless
- B. Complex multi-table joins and transactions across schemas
- C. Strong relational integrity with SQL joins
- D. OLAP reporting

**Answer:** A

**Explanation:** DynamoDB favored by key-value/document, massive scale, serverless.

---

## Q 14-v2-09
- domain: performance
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
- topic: integration
- services: Step Functions, SQS
- tags: orchestration
- difficulty: medium
- time: 50
- source: practice-exams/14-service-comparisons-exam-v2.md#Q10

Step Functions vs SQS — which favors Step Functions?

- A. Orchestrating multi-step workflow with branching/retries/state
- B. Simple buffering of messages
- C. Storing millions of messages
- D. Fan-out to subscribers

**Answer:** A

**Explanation:** Step Functions favored by multi-step workflow orchestration.

---

## Q 14-v2-11
- domain: performance
- topic: analytics
- services: Data Firehose, S3, Redshift, OpenSearch, SQS, Kinesis Data Streams
- tags: streaming-ingestion, sharding, decoupling
- difficulty: hard
- time: 80
- source: practice-exams/14-service-comparisons-exam-v2.md#Q11

Kinesis Data Streams vs Kinesis Data Firehose vs SQS — which statement set is CORRECT?

- A. Data Streams = real-time, replay, multiple consumers, shards; Firehose = managed buffered delivery to S3/Redshift/OpenSearch; SQS = decoupling queue, no replay
- B. All three replay data
- C. Firehose supports multiple consumer replay
- D. SQS delivers directly to S3 with no code

**Answer:** A

**Explanation:** Data Streams=real-time/replay/shards; Firehose=managed delivery; SQS=decoupling, no replay.

---

## Q 14-v2-12
- domain: performance
- topic: networking
- services: NAT Gateway, EC2, Internet Gateway
- tags: egress-only-igw, ipv6
- difficulty: hard
- time: 75
- source: practice-exams/14-service-comparisons-exam-v2.md#Q12

NAT Gateway vs NAT Instance vs Egress-Only IGW — which is TRUE?

- A. NAT Gateway = managed IPv4 outbound; NAT Instance = self-managed EC2; Egress-Only IGW = IPv6 outbound-only
- B. Egress-Only IGW is for IPv4
- C. NAT Gateway supports inbound connections
- D. NAT Instance requires no management

**Answer:** A

**Explanation:** NAT Gateway=managed IPv4 outbound; NAT Instance=self-managed; Egress-Only IGW=IPv6 outbound-only.

---

## Q 14-v2-13
- domain: performance
- topic: database
- services: Aurora, DynamoDB
- tags: aurora-global-database, dynamodb-global-tables, multi-region
- difficulty: hard
- time: 70
- source: practice-exams/14-service-comparisons-exam-v2.md#Q13

Aurora Global Database vs DynamoDB Global Tables — which favors Aurora Global Database?

- A. Relational (SQL) workload needing cross-Region reads + fast DR
- B. Multi-Region active-active NoSQL key-value writes
- C. Schemaless massive-scale writes everywhere
- D. Single-digit ms NoSQL with no SQL needs

**Answer:** A

**Explanation:** Aurora Global DB favored by relational cross-Region reads + fast DR.

---

## Q 14-v2-14
- domain: secure
- topic: security
- services: Cognito
- difficulty: hard
- time: 75
- source: practice-exams/14-service-comparisons-exam-v2.md#Q14

Cognito User Pools vs Identity Pools — which is TRUE?

- A. User Pools = authentication (sign-in, tokens); Identity Pools = authorization to AWS resources via temporary credentials
- B. Identity Pools handle sign-up UI
- C. User Pools grant IAM credentials directly
- D. They are the same

**Answer:** A

**Explanation:** User Pools=authentication; Identity Pools=authorize AWS resources via temp credentials.

---

## Q 14-v2-15
- domain: secure
- topic: security
- services: WAF, Shield
- tags: security-groups, web-attacks, ddos-protection
- difficulty: hard
- time: 70
- source: practice-exams/14-service-comparisons-exam-v2.md#Q15

WAF vs Shield vs Security Group — which mapping is CORRECT?

- A. WAF = Layer 7 filtering (SQLi/XSS/rate); Shield = DDoS protection; Security Group = stateful instance firewall
- B. Shield = SQL injection filtering
- C. Security Group = Layer 7 web rules
- D. WAF = DDoS-only

**Answer:** A

**Explanation:** WAF=Layer 7 filtering; Shield=DDoS; Security Group=stateful instance firewall.
