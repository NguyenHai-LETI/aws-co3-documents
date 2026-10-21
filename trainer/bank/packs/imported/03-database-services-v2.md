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
- task: 2.2
- topic: database
- services: RDS
- tags: multi-az
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q1

A MySQL RDS database must survive an AZ outage with automatic failover and no manual intervention. Which feature?

- A. Cross-Region snapshots
- B. Multi-AZ deployment
- C. Read Replicas
- D. Aurora Global Database

**Answer:** B

**Explanation:** AZ outage + automatic failover for RDS = Multi-AZ deployment.

---

## Q 03-v2-02
- domain: performance
- task: 3.3
- topic: database
- services: RDS
- tags: read-replicas
- difficulty: medium
- time: 55
- source: practice-exams/03-database-services-exam-v2.md#Q2

A read-heavy reporting workload is slowing down the primary PostgreSQL RDS instance. What offloads reads with LEAST impact on writes?

- A. Enable RDS Proxy
- B. Increase storage size
- C. Add Read Replicas
- D. Enable Multi-AZ

**Answer:** C

**Explanation:** Offload reads with least write impact = Read Replicas.

---

## Q 03-v2-03
- domain: resilient
- task: 2.1
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
- task: 3.3
- topic: database
- services: Aurora
- tags: multi-region, rto-rpo, aurora-global-database
- difficulty: medium
- time: 60
- source: practice-exams/03-database-services-exam-v2.md#Q4

A globally distributed app needs a relational database with low-latency reads in multiple Regions and fast cross-Region DR (RPO near zero). Which is BEST?

- A. DynamoDB Global Tables
- B. Cross-Region Read Replica of RDS MySQL
- C. RDS Multi-AZ
- D. Aurora Global Database

**Answer:** D

**Explanation:** Global relational, low-latency multi-Region reads, near-zero RPO DR = Aurora Global Database.

---

## Q 03-v2-05
- domain: performance
- task: 3.3
- topic: database
- services: DynamoDB
- tags: dynamodb-capacity
- difficulty: medium
- time: 55
- source: practice-exams/03-database-services-exam-v2.md#Q5

A NoSQL workload has spiky, unpredictable traffic and the team wants no capacity planning with single-digit ms latency. Which choice?

- A. RDS MySQL
- B. Redshift
- C. DynamoDB on-demand capacity
- D. DynamoDB provisioned capacity

**Answer:** C

**Explanation:** Spiky NoSQL, no capacity planning, single-digit ms = DynamoDB on-demand.

---

## Q 03-v2-06
- domain: performance
- task: 3.3
- topic: database
- services: DAX, DynamoDB
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q6

A DynamoDB workload needs microsecond read latency for repeated reads with minimal app changes. Which service?

- A. Global Secondary Index
- B. DynamoDB Accelerator (DAX)
- C. DynamoDB Streams
- D. ElastiCache for Memcached

**Answer:** B

**Explanation:** Microsecond DynamoDB reads, minimal code change = DAX.

---

## Q 03-v2-07
- domain: performance
- task: 3.3
- topic: database
- services: ElastiCache
- tags: redis-vs-memcached
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q7

A gaming leaderboard needs an in-memory store with sorted sets and persistence. Which engine?

- A. DynamoDB
- B. ElastiCache for Redis
- C. ElastiCache for Memcached
- D. Neptune

**Answer:** B

**Explanation:** Leaderboard sorted sets + persistence = ElastiCache for Redis.

---

## Q 03-v2-08
- domain: resilient
- task: 2.2
- topic: database
- services: Redshift
- tags: offline-transfer
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q8
- status: retired

A company needs a petabyte-scale data warehouse for complex OLAP queries over structured data. Which service?

- A. RDS
- B. DynamoDB
- C. Aurora
- D. Redshift

**Answer:** D

**Explanation:** Petabyte OLAP data warehouse = Amazon Redshift.

---

## Q 03-v2-09
- domain: resilient
- task: 2.2
- topic: database
- services: SCT, DMS, Aurora
- difficulty: medium
- time: 55
- source: practice-exams/03-database-services-exam-v2.md#Q9

An Oracle database must be migrated to Aurora PostgreSQL (different engine) with minimal downtime. Which combination?

- A. Schema Conversion Tool (SCT) + DMS
- B. DMS only
- C. Native Data Pump only
- D. DataSync only

**Answer:** A

**Explanation:** Heterogeneous migration (Oracle->Aurora PG) = SCT + DMS.

---

## Q 03-v2-10
- domain: cost
- task: 4.3
- topic: database
- services: Aurora
- tags: aurora-serverless
- difficulty: medium
- time: 55
- source: practice-exams/03-database-services-exam-v2.md#Q10

An internal Aurora app is idle most nights/weekends with bursts during business hours; minimize cost while staying relational. Which is BEST?

- A. Aurora provisioned largest instance
- B. RDS Single-AZ
- C. Aurora Serverless v2
- D. DynamoDB on-demand

**Answer:** C

**Explanation:** Idle-then-bursty Aurora cost optimization = Aurora Serverless v2.

---

## Q 03-v2-11
- domain: resilient
- task: 2.2
- topic: database
- services: Neptune
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q11

A workload stores highly connected data for a recommendation/fraud engine using graph queries. Which service?

- A. Timestream
- B. Keyspaces
- C. DocumentDB
- D. Neptune

**Answer:** D

**Explanation:** Highly connected/graph queries = Amazon Neptune.

---

## Q 03-v2-12
- domain: resilient
- task: 2.2
- topic: database
- services: Timestream
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q12

IoT sensors send time-stamped metrics needing efficient storage and time-series analytics at scale. Which service?

- A. QLDB
- B. Timestream
- C. RDS
- D. Neptune

**Answer:** B

**Explanation:** Time-series IoT metrics = Amazon Timestream.

---

## Q 03-v2-13
- domain: resilient
- task: 2.2
- topic: database
- services: QLDB
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q13
- status: retired

A company wants an immutable, cryptographically verifiable ledger of financial transactions. Which service?

- A. QLDB
- B. Aurora
- C. Redshift
- D. DynamoDB

**Answer:** A

**Explanation:** Immutable cryptographically verifiable ledger = QLDB.

---

## Q 03-v2-14
- domain: resilient
- task: 2.2
- topic: database
- services: DocumentDB
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q14

A MongoDB workload should move to a managed, MongoDB-compatible database reusing existing drivers. Which service?

- A. DocumentDB
- B. Keyspaces
- C. Neptune
- D. RDS PostgreSQL

**Answer:** A

**Explanation:** MongoDB-compatible managed DB = DocumentDB.

---

## Q 03-v2-15
- domain: resilient
- task: 2.1
- topic: database
- services: Keyspaces
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q15

A Cassandra workload must move to a fully managed, serverless, Cassandra-compatible (CQL) database. Which service?

- A. DocumentDB
- B. Keyspaces
- C. Redshift
- D. DynamoDB

**Answer:** B

**Explanation:** Serverless Cassandra-compatible (CQL) = Amazon Keyspaces.

---

## Q 03-v2-16
- domain: resilient
- task: 2.2
- topic: database
- services: DynamoDB
- tags: dynamodb-indexes
- difficulty: medium
- time: 55
- source: practice-exams/03-database-services-exam-v2.md#Q16

A DynamoDB table needs to query on a completely different partition/sort key, added after creation. Which index?

- A. Global Secondary Index (GSI)
- B. DynamoDB Streams
- C. Local Secondary Index (LSI)
- D. Composite primary key

**Answer:** A

**Explanation:** Different PK/SK, added after creation = Global Secondary Index (GSI).

---

## Q 03-v2-17
- domain: resilient
- task: 2.2
- topic: database
- services: RDS
- tags: db-encryption, encryption-at-rest
- difficulty: medium
- time: 55
- source: practice-exams/03-database-services-exam-v2.md#Q17

An RDS instance was created unencrypted; it must now be encrypted at rest. Correct approach?

- A. Create an encrypted snapshot copy and restore a new instance
- B. Enable Multi-AZ
- C. Toggle encryption on the running instance
- D. SSL/TLS encrypts at rest

**Answer:** A

**Explanation:** Encrypt existing RDS = encrypted snapshot copy -> restore new instance.

---

## Q 03-v2-18
- domain: performance
- task: 3.3
- topic: database
- tags: caching-strategies
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q18

Which caching strategy loads data into the cache only on a cache miss?

- A. TTL-only
- B. Write-behind
- C. Write-through
- D. Lazy loading (cache-aside)

**Answer:** D

**Explanation:** Cache only on miss = Lazy loading (cache-aside).

---

## Q 03-v2-19
- domain: cost
- task: 4.3
- topic: database
- services: DynamoDB
- tags: ttl
- difficulty: medium
- time: 50
- source: practice-exams/03-database-services-exam-v2.md#Q19

DynamoDB must automatically delete expired session items to save cost without a scheduled job. Which feature?

- A. On-demand backup
- B. Global tables
- C. Time to Live (TTL)
- D. DynamoDB Streams

**Answer:** C

**Explanation:** Auto-delete expired items with no job = DynamoDB TTL.

---

## Q 03-v2-20
- domain: resilient
- task: 2.2
- topic: database
- services: RDS
- tags: multi-az, read-replicas
- difficulty: medium
- time: 80
- source: practice-exams/03-database-services-exam-v2.md#Q20

Which two are TRUE about RDS Multi-AZ vs Read Replicas? (Choose TWO)

- A. Read Replicas provide automatic failover
- B. Multi-AZ standby is readable to offload queries
- C. Multi-AZ uses synchronous replication for HA
- D. Read Replicas use asynchronous replication and can be promoted
- E. Multi-AZ is primarily a read-scaling feature

**Answer:** C, D

**Explanation:** Multi-AZ = synchronous HA; Read Replicas = async, promotable.

---

## Q 03-v2-21
- domain: resilient
- task: 2.2
- topic: database
- services: RDS Proxy, IAM, Lambda, RDS
- tags: iam-db-auth, connection-pooling
- difficulty: hard
- time: 100
- source: practice-exams/03-database-services-exam-v2.md#Q21

A serverless app on Lambda + RDS must survive DB failover quickly, pool connections, and authenticate without storing DB passwords. Which two features address this? (Choose TWO)

- A. DynamoDB DAX
- B. Storing the password in Lambda env variables
- C. Read Replica promotion
- D. RDS Proxy connection pooling with faster failover
- E. RDS Proxy with IAM authentication

**Answer:** D, E

**Explanation:** Lambda+RDS: RDS Proxy with IAM auth (no stored password) + pooling with faster failover.

---

## Q 03-v2-22
- domain: performance
- task: 3.3
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
- task: 2.2
- topic: database
- services: DAX, DynamoDB
- tags: sharding
- difficulty: hard
- time: 100
- source: practice-exams/03-database-services-exam-v2.md#Q23

A DynamoDB partition receives far more traffic than others causing throttling on a small set of hot keys. Which two mitigate this? (Choose TWO)

- A. Reduce provisioned capacity
- B. Enable Multi-AZ
- C. Switch to a single partition key value
- D. Add write sharding / high-cardinality partition key design
- E. Use DAX to absorb hot read traffic

**Answer:** D, E

**Explanation:** Hot partition fix = write sharding/high-cardinality key + DAX for hot reads.

---

## Q 03-v2-24
- domain: resilient
- task: 2.2
- topic: database
- services: Aurora
- tags: aurora-endpoints
- difficulty: hard
- time: 100
- source: practice-exams/03-database-services-exam-v2.md#Q24

An Aurora cluster needs near-instant read scaling and automatic replacement of the writer without changing the application endpoint. Which two are relevant? (Choose TWO)

- A. Manually updating the app to the new IP after failover
- B. Aurora cluster (writer) endpoint that always points to the primary
- C. DynamoDB Streams
- D. RDS Proxy is mandatory for failover
- E. Aurora reader endpoint for load-balanced reads

**Answer:** B, E

**Explanation:** Reader endpoint for load-balanced reads + writer/cluster endpoint auto-tracks primary after failover.

---

## Q 03-v2-25
- domain: resilient
- task: 2.2
- topic: database
- services: RDS
- tags: automated-backups, pitr
- difficulty: hard
- time: 95
- enriched: 2026-10-21
- source: practice-exams/03-database-services-exam-v2.md#Q25

A regulated database must retain automated backups and enable point-in-time recovery to any second within the retention window. Which RDS capability provides this?

- A. Read replicas kept in sync for read scaling, which do not provide a backup or recovery mechanism
- B. Manual snapshots taken periodically, each restoring to a single fixed moment rather than continuously across the retention window
- C. Multi-AZ standby for automatic failover, which is not a point-in-time recovery mechanism
- D. Continuous transaction-log backup that restores the database to any point within the retention window

**Answer:** D

**Explanation:** RDS automated backups continuously capture transaction logs in addition to daily snapshots, which lets you restore the database to any specific second within the configured retention window rather than only to a snapshot's fixed timestamp.
- Read replicas: stay in sync with the primary for read scaling; they are not a backup or point-in-time recovery mechanism.
- Manual snapshots: each one is a fixed restore point at the moment it was taken, not continuous coverage across the retention window.
- Multi-AZ standby: provides automatic failover for availability, it does not offer point-in-time recovery to an arbitrary timestamp.
> 🇻🇳 Khôi phục tới bất kỳ giây nào trong cửa sổ lưu trữ cần backup tự động + transaction log (PITR); Read Replica/Multi-AZ không phải tính năng khôi phục.

---

## Q 03-v2-26
- domain: resilient
- task: 2.2
- topic: database
- services: Aurora
- tags: multi-region, aurora-global-database
- difficulty: hard
- time: 75
- source: practice-exams/03-database-services-exam-v2.md#Q26

An Aurora database must tolerate the loss of an entire Region with minimal downtime and allow promoting a secondary Region to primary in under a minute. Which feature?

- A. Aurora Multi-AZ
- B. RDS cross-Region snapshot copy
- C. DynamoDB Global Tables
- D. Aurora Global Database with managed planned failover / unplanned failover

**Answer:** D

**Explanation:** Region loss, sub-minute promotion = Aurora Global Database failover.

---

## Q 03-v2-27
- domain: resilient
- task: 2.1
- topic: database
- services: DynamoDB, Kinesis Data Streams, Lambda
- tags: dynamodb-streams
- difficulty: hard
- time: 70
- source: practice-exams/03-database-services-exam-v2.md#Q27

A DynamoDB-based system must trigger a Lambda function for every item-level change to update a search index. Which feature integrates natively?

- A. Global Secondary Index
- B. DynamoDB TTL
- C. DynamoDB Streams (or Kinesis Data Streams for DynamoDB)
- D. DAX

**Answer:** C

**Explanation:** Trigger Lambda per item change = DynamoDB Streams.

---

## Q 03-v2-28
- domain: performance
- task: 3.3
- topic: database
- tags: caching-strategies
- difficulty: hard
- time: 70
- source: practice-exams/03-database-services-exam-v2.md#Q28

A read-heavy relational workload needs caching where the cache is always consistent with the DB on writes, accepting higher write latency. Which strategy?

- A. TTL-only
- B. No caching
- C. Write-through caching
- D. Lazy loading only

**Answer:** C

**Explanation:** Cache always consistent on writes, higher write latency = write-through.

---

## Q 03-v2-29
- domain: resilient
- task: 2.2
- topic: database
- services: Redshift, S3
- tags: redshift-spectrum
- difficulty: hard
- time: 70
- source: practice-exams/03-database-services-exam-v2.md#Q29

A company runs Redshift and must query large amounts of infrequently accessed data in S3 without loading it into the cluster. Which feature?

- A. Redshift Spectrum
- B. DynamoDB export
- C. Redshift RA3 managed storage only
- D. Aurora parallel query

**Answer:** A

**Explanation:** Query S3 data from Redshift without loading = Redshift Spectrum.

---

## Q 03-v2-30
- domain: resilient
- task: 2.2
- topic: database
- services: ElastiCache
- tags: redis-vs-memcached, multi-az
- difficulty: hard
- time: 75
- source: practice-exams/03-database-services-exam-v2.md#Q30

An ElastiCache for Redis deployment must survive an AZ failure with automatic failover to a replica and minimal data loss. Which configuration?

- A. Cluster mode disabled, single node
- B. Memcached multi-node
- C. Multi-AZ with automatic failover (replication group with replicas)
- D. Single-node cluster

**Answer:** C

**Explanation:** Redis AZ failover with minimal loss = Multi-AZ replication group with automatic failover.

---

## Q 03-v2-31
- domain: performance
- task: 3.3
- topic: database
- services: Aurora
- difficulty: hard
- time: 75
- created: 2026-10-21
- source: practice-exams/03-database-services-exam-v2.md#Q31

A read-heavy reporting workload must offload reads off a busy relational primary, but reports must reflect just-written data with only millisecond staleness. Which offers the BEST read offloading?

- A. Migrate to Aurora and use Aurora Replicas
- B. RDS Read Replica (asynchronous)
- C. RDS Multi-AZ standby
- D. RDS Proxy

**Answer:** A

**Explanation:** Bẫy: RDS Read Replica là ASYNC → có lag, không đảm bảo "millisecond staleness". Aurora Replicas dùng shared storage, lag ~ms → offload read gần real-time. (Cần strong-consistency tuyệt đối thì đọc thẳng primary.)

---

## Q 03-v2-32
- domain: performance
- task: 3.3
- topic: database
- services: RDS Proxy, Lambda, RDS
- difficulty: hard
- time: 70
- created: 2026-10-21
- source: practice-exams/03-database-services-exam-v2.md#Q32

A Lambda-based application opens too many concurrent connections and exhausts the RDS PostgreSQL connection limit, causing errors. What fixes this?

- A. Add Read Replicas
- B. Increase instance size
- C. Enable Multi-AZ
- D. Enable RDS Proxy

**Answer:** D

**Explanation:** Bẫy: vấn đề là connection exhaustion, KHÔNG phải read scaling → RDS Proxy (connection pooling), chuẩn cho Lambda+RDS. Read Replica/Multi-AZ/scale up đều không giải quyết gốc.

---

## Q 03-v2-33
- domain: resilient
- task: 2.2
- topic: database
- tags: high-availability, multi-az
- difficulty: hard
- time: 75
- created: 2026-10-21
- source: practice-exams/03-database-services-exam-v2.md#Q33

An application needs automatic failover for high availability AND wants the standby to also serve read queries to avoid paying for separate replicas. Which deployment?

- A. Single cross-AZ Read Replica
- B. Multi-AZ DB Cluster
- C. Multi-AZ Instance (classic)
- D. Aurora Global Database

**Answer:** B

**Explanation:** Bẫy: Multi-AZ Instance cổ điển standby KHÔNG đọc được. Cần HA tự động + standby đọc được = RDS Multi-AZ DB Cluster (1 writer + 2 readable standby / 3 AZ, failover ~35s).

---

## Q 03-v2-34
- domain: resilient
- task: 2.2
- topic: database
- services: Aurora
- tags: rto-rpo, aurora-global-database
- difficulty: hard
- time: 70
- created: 2026-10-21
- source: practice-exams/03-database-services-exam-v2.md#Q34

A MySQL-based workload on AWS must survive an entire Region outage with RTO under one minute and provide low-latency reads to users worldwide. Which is BEST?

- A. Cross-Region Read Replica
- B. Aurora Global Database
- C. Cross-Region snapshot copy
- D. Multi-AZ deployment

**Answer:** B

**Explanation:** Bẫy: Multi-AZ chỉ chống AZ sập (trong 1 Region). Region sập + RTO<1 phút + đọc gần user toàn cầu = Aurora Global Database (RPO~1s). Cross-Region Read Replica failover thủ công; snapshot copy khôi phục chậm.
