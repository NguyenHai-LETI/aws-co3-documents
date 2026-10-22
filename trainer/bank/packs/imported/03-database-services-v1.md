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
- task: 2.2
- topic: database
- services: RDS
- tags: multi-az
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q1

A production MySQL database on Amazon RDS must survive an Availability Zone failure with automatic failover and minimal downtime. Which feature should be enabled?

- A. RDS Proxy
- B. Cross-Region snapshots
- C. Read Replicas
- D. Multi-AZ deployment

**Answer:** D

**Explanation:** AZ failure + automatic failover for RDS = Multi-AZ deployment.

---

## Q 03-v1-02
- domain: performance
- task: 3.3
- topic: database
- tags: read-replicas
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q2

A PostgreSQL database is read-heavy; reporting queries are slowing down transactions. What scales reads with the LEAST impact on the primary?

- A. Increase instance size only
- B. Add Read Replicas
- C. Switch to On-Demand DynamoDB
- D. Enable Multi-AZ

**Answer:** B

**Explanation:** Scale reads without hurting primary = Read Replicas.

---

## Q 03-v1-03
- domain: performance
- task: 3.3
- topic: database
- services: DynamoDB
- tags: dynamodb-capacity
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q3

A serverless application needs a NoSQL database with single-digit millisecond latency and unpredictable, spiky traffic with no capacity planning. Which choice is BEST?

- A. DynamoDB with on-demand capacity
- B. RDS MySQL Multi-AZ
- C. DynamoDB with provisioned capacity
- D. Amazon Redshift

**Answer:** A

**Explanation:** Serverless NoSQL, spiky traffic, no planning = DynamoDB on-demand.

---

## Q 03-v1-04
- domain: resilient
- task: 2.2
- topic: database
- services: Aurora
- tags: dr-multi-site, multi-region, rto-rpo, aurora-global-database
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q4

A globally distributed application needs an active-active relational database with cross-Region reads and disaster recovery, RPO near zero. Which is BEST?

- A. RDS Multi-AZ
- B. DynamoDB Global Tables
- C. Read Replica in another Region
- D. Aurora Global Database

**Answer:** D

**Explanation:** Active-active relational, global, near-zero RPO = Aurora Global Database.

---

## Q 03-v1-05
- domain: performance
- task: 3.3
- topic: database
- services: DAX, DynamoDB
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q5

A read-heavy DynamoDB workload needs microsecond response times for repeated reads without changing application logic significantly. Which service?

- A. DynamoDB Streams
- B. Amazon ElastiCache for Memcached
- C. DynamoDB Accelerator (DAX)
- D. Global Secondary Index

**Answer:** C

**Explanation:** Microsecond DynamoDB reads, minimal code change = DAX.

---

## Q 03-v1-06
- domain: performance
- task: 3.3
- topic: database
- services: ElastiCache
- tags: streaming-ingestion, redis-vs-memcached
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q6

A gaming app needs an in-memory data store for a real-time leaderboard with sorted sets and persistence. Which engine?

- A. DynamoDB
- B. Neptune
- C. ElastiCache for Memcached
- D. ElastiCache for Redis

**Answer:** D

**Explanation:** Leaderboard sorted sets + persistence = ElastiCache for Redis.

---

## Q 03-v1-07
- domain: resilient
- task: 2.2
- topic: database
- services: Redshift
- tags: offline-transfer
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q7

A company needs a petabyte-scale data warehouse for complex analytical (OLAP) queries over structured data. Which service?

- A. Amazon Aurora
- B. Amazon Redshift
- C. Amazon DynamoDB
- D. Amazon RDS

**Answer:** B

**Explanation:** Petabyte OLAP data warehouse = Amazon Redshift.

---

## Q 03-v1-08
- domain: resilient
- task: 2.2
- topic: database
- services: SCT, DMS, Aurora
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q8

An Oracle database must be migrated to Aurora PostgreSQL with minimal downtime. Which combination is correct?

- A. AWS Schema Conversion Tool (SCT) + AWS DMS
- B. AWS DMS only
- C. Native Oracle Data Pump only
- D. AWS DataSync only

**Answer:** A

**Explanation:** Heterogeneous migration (Oracle->Aurora PG) = SCT + DMS.

---

## Q 03-v1-09
- domain: performance
- task: 3.3
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
- task: 2.2
- topic: database
- services: Neptune
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q10

A workload needs a fully managed database storing highly connected data to power a recommendation/fraud-detection engine using graph queries. Which service?

- A. Amazon Timestream
- B. Amazon Keyspaces
- C. Amazon Neptune
- D. Amazon DocumentDB

**Answer:** C

**Explanation:** Highly connected/graph data = Amazon Neptune.

---

## Q 03-v1-11
- domain: resilient
- task: 2.2
- topic: database
- services: DynamoDB
- tags: sharding, dynamodb-indexes
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q11

Which DynamoDB index allows querying on a completely different partition key and sort key, and can be added after table creation?

- A. Local Secondary Index (LSI)
- B. Composite primary key
- C. Global Secondary Index (GSI)
- D. DynamoDB Streams

**Answer:** C

**Explanation:** Different PK/SK, add later = Global Secondary Index (GSI).

---

## Q 03-v1-12
- domain: resilient
- task: 2.2
- topic: database
- services: QLDB
- difficulty: easy
- time: 45
- status: retired
- source: practice-exams/03-database-services-exam.md#Q12

A company wants an immutable, cryptographically verifiable ledger of financial transactions. Which service?

- A. Amazon Redshift
- B. Amazon QLDB
- C. Amazon DynamoDB
- D. Amazon Aurora

**Answer:** B

**Explanation:** Immutable, cryptographically verifiable ledger = QLDB.

---

## Q 03-v1-13
- domain: performance
- task: 3.2
- topic: database
- services: EC2 Auto Scaling, DynamoDB
- tags: dynamodb-capacity
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q13

An application has predictable, steady database read/write throughput and wants the lowest DynamoDB cost. Which capacity mode?

- A. DAX only
- B. Reserved instances for DynamoDB tables are not possible
- C. On-demand capacity
- D. Provisioned capacity with auto scaling

**Answer:** D

**Explanation:** Predictable steady throughput, lowest cost = Provisioned + auto scaling.

---

## Q 03-v1-14
- domain: resilient
- task: 2.2
- topic: database
- services: DocumentDB
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q14

Which managed database is MongoDB-compatible and lets teams reuse existing MongoDB drivers and tools?

- A. Amazon DocumentDB
- B. Amazon RDS for PostgreSQL
- C. Amazon Keyspaces
- D. Amazon Neptune

**Answer:** A

**Explanation:** MongoDB-compatible managed DB = DocumentDB.

---

## Q 03-v1-15
- domain: resilient
- task: 2.2
- topic: database
- services: RDS
- tags: encryption-at-rest, db-encryption
- difficulty: easy
- time: 50
- source: practice-exams/03-database-services-exam.md#Q15

An RDS database must encrypt data at rest, but it was created unencrypted. What is the correct approach?

- A. Enable Multi-AZ to encrypt
- B. Toggle encryption on the running instance
- C. Use SSL/TLS, which encrypts at rest
- D. Create an encrypted snapshot copy and restore a new encrypted instance

**Answer:** D

**Explanation:** Encrypt existing RDS = encrypted snapshot copy -> restore new instance.

---

## Q 03-v1-16
- domain: resilient
- task: 2.2
- topic: database
- services: Timestream
- difficulty: easy
- time: 45
- enriched: 2026-10-22
- source: practice-exams/03-database-services-exam.md#Q16

A workload ingests IoT sensor metrics and needs efficient storage and time-based analytics at scale. Which purpose-built database?

- A. Amazon RDS
- B. Amazon Neptune
- C. Amazon Timestream for InfluxDB
- D. Amazon DocumentDB (with MongoDB compatibility)

**Answer:** C

**Explanation:** Timestream for InfluxDB is a managed time-series database: it stores time-stamped sensor metrics efficiently and supports time-window queries and aggregations at scale. The original Timestream for LiveAnalytics accepts no new customers since 2025-06-20, so new time-series workloads use Timestream for InfluxDB.
- Amazon RDS: general relational engine, not optimized for high-volume time-series ingest and retention.
- Amazon Neptune: graph database for relationships, not metrics over time.
- Amazon DocumentDB: JSON document store without native time-series functions.
> 🇻🇳 Dữ liệu time-series (IoT metrics) → Amazon Timestream for InfluxDB (bản LiveAnalytics không nhận khách mới từ 2025-06-20).

---

## Q 03-v1-17
- domain: performance
- task: 3.3
- topic: database
- tags: caching-strategies
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q17

Which caching strategy loads data into the cache only when there is a cache miss, ensuring only requested data is cached?

- A. Write-through
- B. Lazy loading (cache-aside)
- C. TTL-only
- D. Write-behind

**Answer:** B

**Explanation:** Cache only on miss = Lazy loading (cache-aside).

---

## Q 03-v1-18
- domain: cost
- task: 4.3
- topic: database
- services: Aurora
- tags: aurora-serverless
- difficulty: easy
- time: 50
- source: practice-exams/03-database-services-exam.md#Q18

A company wants to reduce the cost of an Aurora cluster used by an internal app that is idle most nights and weekends, with bursts during business hours. Which is BEST?

- A. Aurora provisioned with largest instance
- B. RDS Single-AZ
- C. Aurora Serverless v2
- D. DynamoDB on-demand

**Answer:** C

**Explanation:** Idle-then-bursty Aurora cost optimization = Aurora Serverless v2.

---

## Q 03-v1-19
- domain: resilient
- task: 2.2
- topic: database
- services: RDS
- tags: multi-az, read-replicas, high-availability
- difficulty: medium
- time: 80
- source: practice-exams/03-database-services-exam.md#Q19

Which two are TRUE about RDS Multi-AZ vs Read Replicas? (Choose TWO)

- A. Multi-AZ uses synchronous replication for high availability
- B. Multi-AZ is primarily a read-scaling feature
- C. Read Replicas provide automatic failover
- D. Multi-AZ standby is readable to offload queries
- E. Read Replicas use asynchronous replication and can be promoted

**Answer:** A, E

**Explanation:** Multi-AZ = synchronous HA; Read Replicas = async, promotable.

---

## Q 03-v1-20
- domain: resilient
- task: 2.1
- topic: database
- services: Keyspaces
- difficulty: easy
- time: 45
- source: practice-exams/03-database-services-exam.md#Q20

A Cassandra workload must be migrated to a fully managed, serverless, Cassandra-compatible database (CQL). Which service?

- A. Amazon Keyspaces
- B. Amazon DocumentDB
- C. Amazon DynamoDB
- D. Amazon Redshift

**Answer:** A

**Explanation:** Managed serverless Cassandra (CQL) = Amazon Keyspaces.
