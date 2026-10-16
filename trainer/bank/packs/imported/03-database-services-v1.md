---
pack: saa-03-database-services-v1
title: 03 · Database Services · V1
exam: SAA-C03
origin: imported
source: practice-exams/03-database-services-exam.md
created: 2026-10-16
---

# 03 · Database Services · V1

> Imported from `practice-exams/03-database-services-exam.md` + `03-database-services-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 03-v1-01
- domain: resilient
- topic: database
- services: RDS
- tags: multi-az
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q1

A production MySQL database on Amazon RDS must survive an Availability Zone failure with automatic failover and minimal downtime. Which feature should be enabled?

- A. Read Replicas
- B. Multi-AZ deployment
- C. Cross-Region snapshots
- D. RDS Proxy

**Answer:** B

**Explanation:** AZ failure + automatic failover for RDS = Multi-AZ deployment.

---

## Q 03-v1-02
- domain: performance
- topic: database
- tags: read-replicas
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q2

A PostgreSQL database is read-heavy; reporting queries are slowing down transactions. What scales reads with the LEAST impact on the primary?

- A. Enable Multi-AZ
- B. Add Read Replicas
- C. Increase instance size only
- D. Switch to On-Demand DynamoDB

**Answer:** B

**Explanation:** Scale reads without hurting primary = Read Replicas.

---

## Q 03-v1-03
- domain: performance
- topic: database
- services: DynamoDB
- tags: dynamodb-capacity
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q3

A serverless application needs a NoSQL database with single-digit millisecond latency and unpredictable, spiky traffic with no capacity planning. Which choice is BEST?

- A. DynamoDB with provisioned capacity
- B. DynamoDB with on-demand capacity
- C. RDS MySQL Multi-AZ
- D. Amazon Redshift

**Answer:** B

**Explanation:** Serverless NoSQL, spiky traffic, no planning = DynamoDB on-demand.

---

## Q 03-v1-04
- domain: resilient
- topic: database
- services: Aurora
- tags: dr-multi-site, multi-region, rto-rpo, aurora-global-database
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q4

A globally distributed application needs an active-active relational database with cross-Region reads and disaster recovery, RPO near zero. Which is BEST?

- A. RDS Multi-AZ
- B. Aurora Global Database
- C. DynamoDB Global Tables
- D. Read Replica in another Region

**Answer:** B

**Explanation:** Active-active relational, global, near-zero RPO = Aurora Global Database.

---

## Q 03-v1-05
- domain: performance
- topic: database
- services: DAX, DynamoDB
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q5

A read-heavy DynamoDB workload needs microsecond response times for repeated reads without changing application logic significantly. Which service?

- A. Amazon ElastiCache for Memcached
- B. DynamoDB Accelerator (DAX)
- C. DynamoDB Streams
- D. Global Secondary Index

**Answer:** B

**Explanation:** Microsecond DynamoDB reads, minimal code change = DAX.

---

## Q 03-v1-06
- domain: performance
- topic: database
- services: ElastiCache
- tags: streaming-ingestion, redis-vs-memcached
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q6

A gaming app needs an in-memory data store for a real-time leaderboard with sorted sets and persistence. Which engine?

- A. ElastiCache for Memcached
- B. ElastiCache for Redis
- C. DynamoDB
- D. Neptune

**Answer:** B

**Explanation:** Leaderboard sorted sets + persistence = ElastiCache for Redis.

---

## Q 03-v1-07
- domain: resilient
- topic: database
- services: Redshift
- tags: offline-transfer
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q7

A company needs a petabyte-scale data warehouse for complex analytical (OLAP) queries over structured data. Which service?

- A. Amazon RDS
- B. Amazon Aurora
- C. Amazon Redshift
- D. Amazon DynamoDB

**Answer:** C

**Explanation:** Petabyte OLAP data warehouse = Amazon Redshift.

---

## Q 03-v1-08
- domain: resilient
- topic: database
- services: SCT, DMS, Aurora
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q8

An Oracle database must be migrated to Aurora PostgreSQL with minimal downtime. Which combination is correct?

- A. AWS DataSync only
- B. AWS DMS only
- C. AWS Schema Conversion Tool (SCT) + AWS DMS
- D. Native Oracle Data Pump only

**Answer:** C

**Explanation:** Heterogeneous migration (Oracle->Aurora PG) = SCT + DMS.

---

## Q 03-v1-09
- domain: performance
- topic: database
- services: RDS Proxy, Lambda, RDS
- tags: connection-pooling
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q9

Hundreds of concurrent Lambda functions are exhausting RDS database connections. Which managed service solves this with connection pooling?

- A. RDS Read Replica
- B. RDS Proxy
- C. ElastiCache
- D. DynamoDB Accelerator

**Answer:** B

**Explanation:** Connection pooling for Lambda+RDS = RDS Proxy.

---

## Q 03-v1-10
- domain: resilient
- topic: database
- services: Neptune
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q10

A workload needs a fully managed database storing highly connected data to power a recommendation/fraud-detection engine using graph queries. Which service?

- A. Amazon Neptune
- B. Amazon DocumentDB
- C. Amazon Keyspaces
- D. Amazon Timestream

**Answer:** A

**Explanation:** Highly connected/graph data = Amazon Neptune.

---

## Q 03-v1-11
- domain: resilient
- topic: database
- services: DynamoDB
- tags: sharding, dynamodb-indexes
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q11

Which DynamoDB index allows querying on a completely different partition key and sort key, and can be added after table creation?

- A. Local Secondary Index (LSI)
- B. Global Secondary Index (GSI)
- C. DynamoDB Streams
- D. Composite primary key

**Answer:** B

**Explanation:** Different PK/SK, add later = Global Secondary Index (GSI).

---

## Q 03-v1-12
- domain: resilient
- topic: database
- services: QLDB
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q12

A company wants an immutable, cryptographically verifiable ledger of financial transactions. Which service?

- A. Amazon QLDB
- B. Amazon Aurora
- C. Amazon DynamoDB
- D. Amazon Redshift

**Answer:** A

**Explanation:** Immutable, cryptographically verifiable ledger = QLDB.

---

## Q 03-v1-13
- domain: performance
- topic: database
- services: EC2 Auto Scaling, DynamoDB
- tags: dynamodb-capacity
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q13

An application has predictable, steady database read/write throughput and wants the lowest DynamoDB cost. Which capacity mode?

- A. On-demand capacity
- B. Provisioned capacity with auto scaling
- C. DAX only
- D. Reserved instances for DynamoDB tables are not possible

**Answer:** B

**Explanation:** Predictable steady throughput, lowest cost = Provisioned + auto scaling.

---

## Q 03-v1-14
- domain: resilient
- topic: database
- services: DocumentDB
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q14

Which managed database is MongoDB-compatible and lets teams reuse existing MongoDB drivers and tools?

- A. Amazon Keyspaces
- B. Amazon DocumentDB
- C. Amazon Neptune
- D. Amazon RDS for PostgreSQL

**Answer:** B

**Explanation:** MongoDB-compatible managed DB = DocumentDB.

---

## Q 03-v1-15
- domain: resilient
- topic: database
- services: RDS
- tags: encryption-at-rest, db-encryption
- difficulty: easy
- time: 50
- source: practice-exams/03-database-services-exam.md#Q15

An RDS database must encrypt data at rest, but it was created unencrypted. What is the correct approach?

- A. Toggle encryption on the running instance
- B. Create an encrypted snapshot copy and restore a new encrypted instance
- C. Use SSL/TLS, which encrypts at rest
- D. Enable Multi-AZ to encrypt

**Answer:** B

**Explanation:** Encrypt existing RDS = encrypted snapshot copy -> restore new instance.

---

## Q 03-v1-16
- domain: resilient
- topic: database
- services: Timestream
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q16

A workload ingests IoT sensor metrics and needs efficient storage and time-based analytics at scale. Which purpose-built database?

- A. Amazon Timestream
- B. Amazon RDS
- C. Amazon Neptune
- D. Amazon QLDB

**Answer:** A

**Explanation:** Time-series IoT metrics = Amazon Timestream.

---

## Q 03-v1-17
- domain: performance
- topic: database
- tags: caching-strategies
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q17

Which caching strategy loads data into the cache only when there is a cache miss, ensuring only requested data is cached?

- A. Write-through
- B. Lazy loading (cache-aside)
- C. Write-behind
- D. TTL-only

**Answer:** B

**Explanation:** Cache only on miss = Lazy loading (cache-aside).

---

## Q 03-v1-18
- domain: cost
- topic: database
- services: Aurora
- tags: aurora-serverless
- difficulty: easy
- time: 50
- source: practice-exams/03-database-services-exam.md#Q18

A company wants to reduce the cost of an Aurora cluster used by an internal app that is idle most nights and weekends, with bursts during business hours. Which is BEST?

- A. Aurora provisioned with largest instance
- B. Aurora Serverless v2
- C. RDS Single-AZ
- D. DynamoDB on-demand

**Answer:** B

**Explanation:** Idle-then-bursty Aurora cost optimization = Aurora Serverless v2.

---

## Q 03-v1-19
- domain: resilient
- topic: database
- services: RDS
- tags: multi-az, read-replicas, high-availability
- difficulty: medium
- time: 80
- source: practice-exams/03-database-services-exam.md#Q19

Which two are TRUE about RDS Multi-AZ vs Read Replicas? (Choose TWO)

- A. Multi-AZ standby is readable to offload queries
- B. Multi-AZ uses synchronous replication for high availability
- C. Read Replicas use asynchronous replication and can be promoted
- D. Read Replicas provide automatic failover
- E. Multi-AZ is primarily a read-scaling feature

**Answer:** B, C

**Explanation:** Multi-AZ = synchronous HA; Read Replicas = async, promotable.

---

## Q 03-v1-20
- domain: resilient
- topic: database
- services: Keyspaces
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q20

A Cassandra workload must be migrated to a fully managed, serverless, Cassandra-compatible database (CQL). Which service?

- A. Amazon Keyspaces
- B. Amazon DynamoDB
- C. Amazon DocumentDB
- D. Amazon Redshift

**Answer:** A

**Explanation:** Managed serverless Cassandra (CQL) = Amazon Keyspaces.
