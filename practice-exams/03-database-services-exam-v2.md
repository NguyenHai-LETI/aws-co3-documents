# 🗄️ Practice Exam 03 — Database Services (SAA-C03) · V2

**30 questions** · scenario-based · English. Answers in `03-database-services-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q20
- **Part B — Khó / Nâng cao:** Q21–Q30

---

## Part A — Vận dụng (20 câu)

**1.** A MySQL RDS database must survive an AZ outage with automatic failover and no manual intervention. Which feature?

- A. Read Replicas
- B. Multi-AZ deployment
- C. Cross-Region snapshots
- D. Aurora Global Database

**2.** A read-heavy reporting workload is slowing down the primary PostgreSQL RDS instance. What offloads reads with LEAST impact on writes?

- A. Enable Multi-AZ
- B. Add Read Replicas
- C. Increase storage size
- D. Enable RDS Proxy

**3.** Hundreds of Lambda functions open too many connections and exhaust the RDS connection limit. Which managed service solves this?

- A. RDS Read Replica
- B. RDS Proxy
- C. ElastiCache
- D. DAX

**4.** A globally distributed app needs a relational database with low-latency reads in multiple Regions and fast cross-Region DR (RPO near zero). Which is BEST?

- A. RDS Multi-AZ
- B. Aurora Global Database
- C. DynamoDB Global Tables
- D. Cross-Region Read Replica of RDS MySQL

**5.** A NoSQL workload has spiky, unpredictable traffic and the team wants no capacity planning with single-digit ms latency. Which choice?

- A. DynamoDB provisioned capacity
- B. DynamoDB on-demand capacity
- C. RDS MySQL
- D. Redshift

**6.** A DynamoDB workload needs microsecond read latency for repeated reads with minimal app changes. Which service?

- A. ElastiCache for Memcached
- B. DynamoDB Accelerator (DAX)
- C. Global Secondary Index
- D. DynamoDB Streams

**7.** A gaming leaderboard needs an in-memory store with sorted sets and persistence. Which engine?

- A. ElastiCache for Memcached
- B. ElastiCache for Redis
- C. DynamoDB
- D. Neptune

**8.** A company needs a petabyte-scale data warehouse for complex OLAP queries over structured data. Which service?

- A. RDS
- B. Aurora
- C. Redshift
- D. DynamoDB

**9.** An Oracle database must be migrated to Aurora PostgreSQL (different engine) with minimal downtime. Which combination?

- A. DataSync only
- B. DMS only
- C. Schema Conversion Tool (SCT) + DMS
- D. Native Data Pump only

**10.** An internal Aurora app is idle most nights/weekends with bursts during business hours; minimize cost while staying relational. Which is BEST?

- A. Aurora provisioned largest instance
- B. Aurora Serverless v2
- C. RDS Single-AZ
- D. DynamoDB on-demand

**11.** A workload stores highly connected data for a recommendation/fraud engine using graph queries. Which service?

- A. Neptune
- B. DocumentDB
- C. Keyspaces
- D. Timestream

**12.** IoT sensors send time-stamped metrics needing efficient storage and time-series analytics at scale. Which service?

- A. Timestream
- B. RDS
- C. Neptune
- D. QLDB

**13.** A company wants an immutable, cryptographically verifiable ledger of financial transactions. Which service?

- A. QLDB
- B. Aurora
- C. DynamoDB
- D. Redshift

**14.** A MongoDB workload should move to a managed, MongoDB-compatible database reusing existing drivers. Which service?

- A. Keyspaces
- B. DocumentDB
- C. Neptune
- D. RDS PostgreSQL

**15.** A Cassandra workload must move to a fully managed, serverless, Cassandra-compatible (CQL) database. Which service?

- A. Keyspaces
- B. DynamoDB
- C. DocumentDB
- D. Redshift

**16.** A DynamoDB table needs to query on a completely different partition/sort key, added after creation. Which index?

- A. Local Secondary Index (LSI)
- B. Global Secondary Index (GSI)
- C. DynamoDB Streams
- D. Composite primary key

**17.** An RDS instance was created unencrypted; it must now be encrypted at rest. Correct approach?

- A. Toggle encryption on the running instance
- B. Create an encrypted snapshot copy and restore a new instance
- C. SSL/TLS encrypts at rest
- D. Enable Multi-AZ

**18.** Which caching strategy loads data into the cache only on a cache miss?

- A. Write-through
- B. Lazy loading (cache-aside)
- C. Write-behind
- D. TTL-only

**19.** DynamoDB must automatically delete expired session items to save cost without a scheduled job. Which feature?

- A. DynamoDB Streams
- B. Time to Live (TTL)
- C. Global tables
- D. On-demand backup

**20.** Which two are TRUE about RDS Multi-AZ vs Read Replicas? (Choose TWO)

- A. Multi-AZ standby is readable to offload queries
- B. Multi-AZ uses synchronous replication for HA
- C. Read Replicas use asynchronous replication and can be promoted
- D. Read Replicas provide automatic failover
- E. Multi-AZ is primarily a read-scaling feature

---

## Part B — Khó / Nâng cao (10 câu)

**21.** A serverless app on Lambda + RDS must survive DB failover quickly, pool connections, and authenticate without storing DB passwords. Which two features address this? (Choose TWO)

- A. RDS Proxy with IAM authentication
- B. Storing the password in Lambda env variables
- C. RDS Proxy connection pooling with faster failover
- D. DynamoDB DAX
- E. Read Replica promotion

**22.** A DynamoDB table serves a global user base needing multi-Region, active-active read/write with local low latency. Which feature?

- A. DynamoDB DAX
- B. DynamoDB Global Tables
- C. Cross-Region Read Replicas
- D. Aurora Global Database

**23.** A DynamoDB partition receives far more traffic than others causing throttling on a small set of hot keys. Which two mitigate this? (Choose TWO)

- A. Add write sharding / high-cardinality partition key design
- B. Use DAX to absorb hot read traffic
- C. Switch to a single partition key value
- D. Enable Multi-AZ
- E. Reduce provisioned capacity

**24.** An Aurora cluster needs near-instant read scaling and automatic replacement of the writer without changing the application endpoint. Which two are relevant? (Choose TWO)

- A. Aurora reader endpoint for load-balanced reads
- B. Aurora cluster (writer) endpoint that always points to the primary
- C. Manually updating the app to the new IP after failover
- D. DynamoDB Streams
- E. RDS Proxy is mandatory for failover

**25.** A regulated database must retain automated backups and enable point-in-time recovery to any second within the retention window. Which RDS capability provides this?

- A. Manual snapshots only
- B. Automated backups with transaction logs (PITR)
- C. Read Replicas
- D. Multi-AZ standby

**26.** An Aurora database must tolerate the loss of an entire Region with minimal downtime and allow promoting a secondary Region to primary in under a minute. Which feature?

- A. Aurora Multi-AZ
- B. Aurora Global Database with managed planned failover / unplanned failover
- C. RDS cross-Region snapshot copy
- D. DynamoDB Global Tables

**27.** A DynamoDB-based system must trigger a Lambda function for every item-level change to update a search index. Which feature integrates natively?

- A. DynamoDB TTL
- B. DynamoDB Streams (or Kinesis Data Streams for DynamoDB)
- C. Global Secondary Index
- D. DAX

**28.** A read-heavy relational workload needs caching where the cache is always consistent with the DB on writes, accepting higher write latency. Which strategy?

- A. Lazy loading only
- B. Write-through caching
- C. TTL-only
- D. No caching

**29.** A company runs Redshift and must query large amounts of infrequently accessed data in S3 without loading it into the cluster. Which feature?

- A. Redshift Spectrum
- B. Redshift RA3 managed storage only
- C. DynamoDB export
- D. Aurora parallel query

**30.** An ElastiCache for Redis deployment must survive an AZ failure with automatic failover to a replica and minimal data loss. Which configuration?

- A. Single-node cluster
- B. Multi-AZ with automatic failover (replication group with replicas)
- C. Memcached multi-node
- D. Cluster mode disabled, single node
