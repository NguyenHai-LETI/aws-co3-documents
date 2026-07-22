# 🗄️ Practice Exam 03 — Database Services (SAA-C03)

20 questions · scenario-based · English. Answers in `03-database-services-answers.txt`.

---

**1.** A production MySQL database on Amazon RDS must survive an Availability Zone failure with automatic failover and minimal downtime. Which feature should be enabled?

- A. Read Replicas
- B. Multi-AZ deployment
- C. Cross-Region snapshots
- D. RDS Proxy

**2.** A PostgreSQL database is read-heavy; reporting queries are slowing down transactions. What scales reads with the LEAST impact on the primary?

- A. Enable Multi-AZ
- B. Add Read Replicas
- C. Increase instance size only
- D. Switch to On-Demand DynamoDB

**3.** A serverless application needs a NoSQL database with single-digit millisecond latency and unpredictable, spiky traffic with no capacity planning. Which choice is BEST?

- A. DynamoDB with provisioned capacity
- B. DynamoDB with on-demand capacity
- C. RDS MySQL Multi-AZ
- D. Amazon Redshift

**4.** A globally distributed application needs an active-active relational database with cross-Region reads and disaster recovery, RPO near zero. Which is BEST?

- A. RDS Multi-AZ
- B. Aurora Global Database
- C. DynamoDB Global Tables
- D. Read Replica in another Region

**5.** A read-heavy DynamoDB workload needs microsecond response times for repeated reads without changing application logic significantly. Which service?

- A. Amazon ElastiCache for Memcached
- B. DynamoDB Accelerator (DAX)
- C. DynamoDB Streams
- D. Global Secondary Index

**6.** A gaming app needs an in-memory data store for a real-time leaderboard with sorted sets and persistence. Which engine?

- A. ElastiCache for Memcached
- B. ElastiCache for Redis
- C. DynamoDB
- D. Neptune

**7.** A company needs a petabyte-scale data warehouse for complex analytical (OLAP) queries over structured data. Which service?

- A. Amazon RDS
- B. Amazon Aurora
- C. Amazon Redshift
- D. Amazon DynamoDB

**8.** An Oracle database must be migrated to Aurora PostgreSQL with minimal downtime. Which combination is correct?

- A. AWS DataSync only
- B. AWS DMS only
- C. AWS Schema Conversion Tool (SCT) + AWS DMS
- D. Native Oracle Data Pump only

**9.** Hundreds of concurrent Lambda functions are exhausting RDS database connections. Which managed service solves this with connection pooling?

- A. RDS Read Replica
- B. RDS Proxy
- C. ElastiCache
- D. DynamoDB Accelerator

**10.** A workload needs a fully managed database storing highly connected data to power a recommendation/fraud-detection engine using graph queries. Which service?

- A. Amazon Neptune
- B. Amazon DocumentDB
- C. Amazon Keyspaces
- D. Amazon Timestream

**11.** Which DynamoDB index allows querying on a completely different partition key and sort key, and can be added after table creation?

- A. Local Secondary Index (LSI)
- B. Global Secondary Index (GSI)
- C. DynamoDB Streams
- D. Composite primary key

**12.** A company wants an immutable, cryptographically verifiable ledger of financial transactions. Which service?

- A. Amazon QLDB
- B. Amazon Aurora
- C. Amazon DynamoDB
- D. Amazon Redshift

**13.** An application has predictable, steady database read/write throughput and wants the lowest DynamoDB cost. Which capacity mode?

- A. On-demand capacity
- B. Provisioned capacity with auto scaling
- C. DAX only
- D. Reserved instances for DynamoDB tables are not possible

**14.** Which managed database is MongoDB-compatible and lets teams reuse existing MongoDB drivers and tools?

- A. Amazon Keyspaces
- B. Amazon DocumentDB
- C. Amazon Neptune
- D. Amazon RDS for PostgreSQL

**15.** An RDS database must encrypt data at rest, but it was created unencrypted. What is the correct approach?

- A. Toggle encryption on the running instance
- B. Create an encrypted snapshot copy and restore a new encrypted instance
- C. Use SSL/TLS, which encrypts at rest
- D. Enable Multi-AZ to encrypt

**16.** A workload ingests IoT sensor metrics and needs efficient storage and time-based analytics at scale. Which purpose-built database?

- A. Amazon Timestream
- B. Amazon RDS
- C. Amazon Neptune
- D. Amazon QLDB

**17.** Which caching strategy loads data into the cache only when there is a cache miss, ensuring only requested data is cached?

- A. Write-through
- B. Lazy loading (cache-aside)
- C. Write-behind
- D. TTL-only

**18.** A company wants to reduce the cost of an Aurora cluster used by an internal app that is idle most nights and weekends, with bursts during business hours. Which is BEST?

- A. Aurora provisioned with largest instance
- B. Aurora Serverless v2
- C. RDS Single-AZ
- D. DynamoDB on-demand

**19.** Which two are TRUE about RDS Multi-AZ vs Read Replicas? (Choose TWO)

- A. Multi-AZ standby is readable to offload queries
- B. Multi-AZ uses synchronous replication for high availability
- C. Read Replicas use asynchronous replication and can be promoted
- D. Read Replicas provide automatic failover
- E. Multi-AZ is primarily a read-scaling feature

**20.** A Cassandra workload must be migrated to a fully managed, serverless, Cassandra-compatible database (CQL). Which service?

- A. Amazon Keyspaces
- B. Amazon DynamoDB
- C. Amazon DocumentDB
- D. Amazon Redshift
