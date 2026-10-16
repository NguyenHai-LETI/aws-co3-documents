---
pack: saa-03-database-services-v2
title: 03 · Database Services · V2
exam: SAA-C03
origin: imported
source: practice-exams/03-database-services-exam-v2.md
created: 2026-10-16
---

# 03 · Database Services · V2

> Imported from `practice-exams/03-database-services-exam-v2.md` + `03-database-services-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 03-v2-01
- domain: resilient
- topic: database
- services: RDS
- tags: multi-az
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q1

A MySQL RDS database must survive an AZ outage with automatic failover and no manual intervention. Which feature?

- A. Read Replicas
- B. Multi-AZ deployment
- C. Cross-Region snapshots
- D. Aurora Global Database

**Answer:** B

**Explanation:** AZ outage + automatic failover for RDS = Multi-AZ deployment.

---

## Q 03-v2-02
- domain: performance
- topic: database
- services: RDS
- tags: read-replicas
- difficulty: medium
- time: 55
- source: practice-exams/03-database-services-exam-v2.md#Q2

A read-heavy reporting workload is slowing down the primary PostgreSQL RDS instance. What offloads reads with LEAST impact on writes?

- A. Enable Multi-AZ
- B. Add Read Replicas
- C. Increase storage size
- D. Enable RDS Proxy

**Answer:** B

**Explanation:** Offload reads with least write impact = Read Replicas.

---

## Q 03-v2-03
- domain: resilient
- topic: database
- services: RDS Proxy, Lambda, RDS
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q3

Hundreds of Lambda functions open too many connections and exhaust the RDS connection limit. Which managed service solves this?

- A. RDS Read Replica
- B. RDS Proxy
- C. ElastiCache
- D. DAX

**Answer:** B

**Explanation:** Lambda exhausting RDS connections = RDS Proxy (connection pooling).

---

## Q 03-v2-04
- domain: performance
- topic: database
- services: Aurora
- tags: multi-region, rto-rpo, aurora-global-database
- difficulty: medium
- time: 60
- source: practice-exams/03-database-services-exam-v2.md#Q4

A globally distributed app needs a relational database with low-latency reads in multiple Regions and fast cross-Region DR (RPO near zero). Which is BEST?

- A. RDS Multi-AZ
- B. Aurora Global Database
- C. DynamoDB Global Tables
- D. Cross-Region Read Replica of RDS MySQL

**Answer:** B

**Explanation:** Global relational, low-latency multi-Region reads, near-zero RPO DR = Aurora Global Database.

---

## Q 03-v2-05
- domain: performance
- topic: database
- services: DynamoDB
- tags: dynamodb-capacity
- difficulty: medium
- time: 55
- source: practice-exams/03-database-services-exam-v2.md#Q5

A NoSQL workload has spiky, unpredictable traffic and the team wants no capacity planning with single-digit ms latency. Which choice?

- A. DynamoDB provisioned capacity
- B. DynamoDB on-demand capacity
- C. RDS MySQL
- D. Redshift

**Answer:** B

**Explanation:** Spiky NoSQL, no capacity planning, single-digit ms = DynamoDB on-demand.

---

## Q 03-v2-06
- domain: performance
- topic: database
- services: DAX, DynamoDB
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q6

A DynamoDB workload needs microsecond read latency for repeated reads with minimal app changes. Which service?

- A. ElastiCache for Memcached
- B. DynamoDB Accelerator (DAX)
- C. Global Secondary Index
- D. DynamoDB Streams

**Answer:** B

**Explanation:** Microsecond DynamoDB reads, minimal code change = DAX.

---

## Q 03-v2-07
- domain: performance
- topic: database
- services: ElastiCache
- tags: redis-vs-memcached
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q7

A gaming leaderboard needs an in-memory store with sorted sets and persistence. Which engine?

- A. ElastiCache for Memcached
- B. ElastiCache for Redis
- C. DynamoDB
- D. Neptune

**Answer:** B

**Explanation:** Leaderboard sorted sets + persistence = ElastiCache for Redis.

---

## Q 03-v2-08
- domain: resilient
- topic: database
- services: Redshift
- tags: offline-transfer
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q8

A company needs a petabyte-scale data warehouse for complex OLAP queries over structured data. Which service?

- A. RDS
- B. Aurora
- C. Redshift
- D. DynamoDB

**Answer:** C

**Explanation:** Petabyte OLAP data warehouse = Amazon Redshift.

---

## Q 03-v2-09
- domain: resilient
- topic: database
- services: SCT, DMS, Aurora
- difficulty: medium
- time: 55
- source: practice-exams/03-database-services-exam-v2.md#Q9

An Oracle database must be migrated to Aurora PostgreSQL (different engine) with minimal downtime. Which combination?

- A. DataSync only
- B. DMS only
- C. Schema Conversion Tool (SCT) + DMS
- D. Native Data Pump only

**Answer:** C

**Explanation:** Heterogeneous migration (Oracle->Aurora PG) = SCT + DMS.

---

## Q 03-v2-10
- domain: cost
- topic: database
- services: Aurora
- tags: aurora-serverless
- difficulty: medium
- time: 55
- source: practice-exams/03-database-services-exam-v2.md#Q10

An internal Aurora app is idle most nights/weekends with bursts during business hours; minimize cost while staying relational. Which is BEST?

- A. Aurora provisioned largest instance
- B. Aurora Serverless v2
- C. RDS Single-AZ
- D. DynamoDB on-demand

**Answer:** B

**Explanation:** Idle-then-bursty Aurora cost optimization = Aurora Serverless v2.

---

## Q 03-v2-11
- domain: resilient
- topic: database
- services: Neptune
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q11

A workload stores highly connected data for a recommendation/fraud engine using graph queries. Which service?

- A. Neptune
- B. DocumentDB
- C. Keyspaces
- D. Timestream

**Answer:** A

**Explanation:** Highly connected/graph queries = Amazon Neptune.

---

## Q 03-v2-12
- domain: resilient
- topic: database
- services: Timestream
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q12

IoT sensors send time-stamped metrics needing efficient storage and time-series analytics at scale. Which service?

- A. Timestream
- B. RDS
- C. Neptune
- D. QLDB

**Answer:** A

**Explanation:** Time-series IoT metrics = Amazon Timestream.

---

## Q 03-v2-13
- domain: resilient
- topic: database
- services: QLDB
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q13

A company wants an immutable, cryptographically verifiable ledger of financial transactions. Which service?

- A. QLDB
- B. Aurora
- C. DynamoDB
- D. Redshift

**Answer:** A

**Explanation:** Immutable cryptographically verifiable ledger = QLDB.

---

## Q 03-v2-14
- domain: resilient
- topic: database
- services: DocumentDB
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q14

A MongoDB workload should move to a managed, MongoDB-compatible database reusing existing drivers. Which service?

- A. Keyspaces
- B. DocumentDB
- C. Neptune
- D. RDS PostgreSQL

**Answer:** B

**Explanation:** MongoDB-compatible managed DB = DocumentDB.

---

## Q 03-v2-15
- domain: resilient
- topic: database
- services: Keyspaces
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q15

A Cassandra workload must move to a fully managed, serverless, Cassandra-compatible (CQL) database. Which service?

- A. Keyspaces
- B. DynamoDB
- C. DocumentDB
- D. Redshift

**Answer:** A

**Explanation:** Serverless Cassandra-compatible (CQL) = Amazon Keyspaces.

---

## Q 03-v2-16
- domain: resilient
- topic: database
- services: DynamoDB
- tags: dynamodb-indexes
- difficulty: medium
- time: 55
- source: practice-exams/03-database-services-exam-v2.md#Q16

A DynamoDB table needs to query on a completely different partition/sort key, added after creation. Which index?

- A. Local Secondary Index (LSI)
- B. Global Secondary Index (GSI)
- C. DynamoDB Streams
- D. Composite primary key

**Answer:** B

**Explanation:** Different PK/SK, added after creation = Global Secondary Index (GSI).

---

## Q 03-v2-17
- domain: resilient
- topic: database
- services: RDS
- tags: db-encryption, encryption-at-rest
- difficulty: medium
- time: 55
- source: practice-exams/03-database-services-exam-v2.md#Q17

An RDS instance was created unencrypted; it must now be encrypted at rest. Correct approach?

- A. Toggle encryption on the running instance
- B. Create an encrypted snapshot copy and restore a new instance
- C. SSL/TLS encrypts at rest
- D. Enable Multi-AZ

**Answer:** B

**Explanation:** Encrypt existing RDS = encrypted snapshot copy -> restore new instance.

---

## Q 03-v2-18
- domain: performance
- topic: database
- tags: caching-strategies
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q18

Which caching strategy loads data into the cache only on a cache miss?

- A. Write-through
- B. Lazy loading (cache-aside)
- C. Write-behind
- D. TTL-only

**Answer:** B

**Explanation:** Cache only on miss = Lazy loading (cache-aside).

---

## Q 03-v2-19
- domain: cost
- topic: database
- services: DynamoDB
- tags: ttl
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q19

DynamoDB must automatically delete expired session items to save cost without a scheduled job. Which feature?

- A. DynamoDB Streams
- B. Time to Live (TTL)
- C. Global tables
- D. On-demand backup

**Answer:** B

**Explanation:** Auto-delete expired items with no job = DynamoDB TTL.

---

## Q 03-v2-20
- domain: resilient
- topic: database
- services: RDS
- tags: multi-az, read-replicas
- difficulty: medium
- time: 80
- source: practice-exams/03-database-services-exam-v2.md#Q20

Which two are TRUE about RDS Multi-AZ vs Read Replicas? (Choose TWO)

- A. Multi-AZ standby is readable to offload queries
- B. Multi-AZ uses synchronous replication for HA
- C. Read Replicas use asynchronous replication and can be promoted
- D. Read Replicas provide automatic failover
- E. Multi-AZ is primarily a read-scaling feature

**Answer:** B, C

**Explanation:** Multi-AZ = synchronous HA; Read Replicas = async, promotable.

---

## Q 03-v2-21
- domain: resilient
- topic: database
- services: RDS Proxy, IAM, Lambda, RDS
- tags: iam-db-auth, connection-pooling
- difficulty: hard
- time: 100
- source: practice-exams/03-database-services-exam-v2.md#Q21

A serverless app on Lambda + RDS must survive DB failover quickly, pool connections, and authenticate without storing DB passwords. Which two features address this? (Choose TWO)

- A. RDS Proxy with IAM authentication
- B. Storing the password in Lambda env variables
- C. RDS Proxy connection pooling with faster failover
- D. DynamoDB DAX
- E. Read Replica promotion

**Answer:** A, C

**Explanation:** Lambda+RDS: RDS Proxy with IAM auth (no stored password) + pooling with faster failover.

---

## Q 03-v2-22
- domain: performance
- topic: database
- services: DynamoDB
- tags: multi-region, dr-multi-site, dynamodb-global-tables
- difficulty: hard
- time: 70
- source: practice-exams/03-database-services-exam-v2.md#Q22

A DynamoDB table serves a global user base needing multi-Region, active-active read/write with local low latency. Which feature?

- A. DynamoDB DAX
- B. DynamoDB Global Tables
- C. Cross-Region Read Replicas
- D. Aurora Global Database

**Answer:** B

**Explanation:** Multi-Region active-active DynamoDB = Global Tables.

---

## Q 03-v2-23
- domain: resilient
- topic: database
- services: DAX, DynamoDB
- tags: sharding
- difficulty: hard
- time: 100
- source: practice-exams/03-database-services-exam-v2.md#Q23

A DynamoDB partition receives far more traffic than others causing throttling on a small set of hot keys. Which two mitigate this? (Choose TWO)

- A. Add write sharding / high-cardinality partition key design
- B. Use DAX to absorb hot read traffic
- C. Switch to a single partition key value
- D. Enable Multi-AZ
- E. Reduce provisioned capacity

**Answer:** A, B

**Explanation:** Hot partition fix = write sharding/high-cardinality key + DAX for hot reads.

---

## Q 03-v2-24
- domain: resilient
- topic: database
- services: Aurora
- tags: aurora-endpoints
- difficulty: hard
- time: 100
- source: practice-exams/03-database-services-exam-v2.md#Q24

An Aurora cluster needs near-instant read scaling and automatic replacement of the writer without changing the application endpoint. Which two are relevant? (Choose TWO)

- A. Aurora reader endpoint for load-balanced reads
- B. Aurora cluster (writer) endpoint that always points to the primary
- C. Manually updating the app to the new IP after failover
- D. DynamoDB Streams
- E. RDS Proxy is mandatory for failover

**Answer:** A, B

**Explanation:** Reader endpoint for load-balanced reads + writer/cluster endpoint auto-tracks primary after failover.

---

## Q 03-v2-25
- domain: resilient
- topic: database
- services: RDS
- tags: automated-backups, pitr
- difficulty: hard
- time: 70
- source: practice-exams/03-database-services-exam-v2.md#Q25

A regulated database must retain automated backups and enable point-in-time recovery to any second within the retention window. Which RDS capability provides this?

- A. Manual snapshots only
- B. Automated backups with transaction logs (PITR)
- C. Read Replicas
- D. Multi-AZ standby

**Answer:** B

**Explanation:** PITR to any second = automated backups + transaction logs.

---

## Q 03-v2-26
- domain: resilient
- topic: database
- services: Aurora
- tags: multi-region, aurora-global-database
- difficulty: hard
- time: 75
- source: practice-exams/03-database-services-exam-v2.md#Q26

An Aurora database must tolerate the loss of an entire Region with minimal downtime and allow promoting a secondary Region to primary in under a minute. Which feature?

- A. Aurora Multi-AZ
- B. Aurora Global Database with managed planned failover / unplanned failover
- C. RDS cross-Region snapshot copy
- D. DynamoDB Global Tables

**Answer:** B

**Explanation:** Region loss, sub-minute promotion = Aurora Global Database failover.

---

## Q 03-v2-27
- domain: resilient
- topic: database
- services: DynamoDB, Kinesis Data Streams, Lambda
- tags: dynamodb-streams
- difficulty: hard
- time: 70
- source: practice-exams/03-database-services-exam-v2.md#Q27

A DynamoDB-based system must trigger a Lambda function for every item-level change to update a search index. Which feature integrates natively?

- A. DynamoDB TTL
- B. DynamoDB Streams (or Kinesis Data Streams for DynamoDB)
- C. Global Secondary Index
- D. DAX

**Answer:** B

**Explanation:** Trigger Lambda per item change = DynamoDB Streams.

---

## Q 03-v2-28
- domain: performance
- topic: database
- tags: caching-strategies
- difficulty: hard
- time: 70
- source: practice-exams/03-database-services-exam-v2.md#Q28

A read-heavy relational workload needs caching where the cache is always consistent with the DB on writes, accepting higher write latency. Which strategy?

- A. Lazy loading only
- B. Write-through caching
- C. TTL-only
- D. No caching

**Answer:** B

**Explanation:** Cache always consistent on writes, higher write latency = write-through.

---

## Q 03-v2-29
- domain: resilient
- topic: database
- services: Redshift, S3
- tags: redshift-spectrum
- difficulty: hard
- time: 70
- source: practice-exams/03-database-services-exam-v2.md#Q29

A company runs Redshift and must query large amounts of infrequently accessed data in S3 without loading it into the cluster. Which feature?

- A. Redshift Spectrum
- B. Redshift RA3 managed storage only
- C. DynamoDB export
- D. Aurora parallel query

**Answer:** A

**Explanation:** Query S3 data from Redshift without loading = Redshift Spectrum.

---

## Q 03-v2-30
- domain: resilient
- topic: database
- services: ElastiCache
- tags: redis-vs-memcached, multi-az
- difficulty: hard
- time: 75
- source: practice-exams/03-database-services-exam-v2.md#Q30

An ElastiCache for Redis deployment must survive an AZ failure with automatic failover to a replica and minimal data loss. Which configuration?

- A. Single-node cluster
- B. Multi-AZ with automatic failover (replication group with replicas)
- C. Memcached multi-node
- D. Cluster mode disabled, single node

**Answer:** B

**Explanation:** Redis AZ failover with minimal loss = Multi-AZ replication group with automatic failover.
