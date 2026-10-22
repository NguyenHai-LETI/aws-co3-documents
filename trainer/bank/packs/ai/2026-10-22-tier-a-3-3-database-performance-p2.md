---
pack: ai-2026-10-22-tier-a-3-3-p2
title: "AI · Tầng A · Task 3.3 — Database hiệu năng cao (phần 2)"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 3.3"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 3.3"
---

# AI · Tầng A · Task 3.3 — Database hiệu năng cao (phần 2)

## Q ai-20261022-a33-11
- domain: performance
- task: 3.3
- topic: database
- services: DocumentDB, DynamoDB, Aurora
- tags: purpose-built, sharding
- difficulty: hard
- time: 130
- skills: 3.3.k8, 3.3.s4
- concept: DocumentDB elastic clusters shard collections to scale writes horizontally behind a MongoDB-compatible API, whereas replicas of an instance-based cluster only scale reads
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Điểm nghẽn là một primary duy nhất nhận mọi lệnh ghi — loại cluster nào chia dữ liệu theo shard mà vẫn dùng API MongoDB?
- created: 2026-10-22
- enriched: 2026-10-22

A mobile-games company keeps player profiles in a self-managed MongoDB replica set on Amazon EC2. The application uses MongoDB drivers and queries, and profile traffic is growing toward millions of writes per second, which the single primary of the replica set cannot sustain even on the largest instances. The company wants a managed service that scales writes horizontally through sharding, keeps the MongoDB API, and requires minimal application changes. Which solution will meet these requirements?

- A. Migrate to an Amazon DocumentDB instance-based cluster and add replicas so that the replicas share the writes with the primary instance.
- B. Migrate to Amazon DynamoDB and rewrite the data access layer to use the DynamoDB API for the profile data, with a high-cardinality partition key.
- C. Migrate to an Amazon DocumentDB elastic cluster and create the profile collections with a shard key so that writes are spread across shards.
- D. Migrate to Amazon Aurora PostgreSQL with JSONB columns and rewrite the MongoDB queries as SQL statements for the new engine.

**Answer:** C

**Explanation:** DocumentDB elastic clusters shard collections across many compute and storage units, support millions of reads and writes per second and petabytes of data, and keep a MongoDB-compatible API, so writes scale horizontally with few application changes.
- Instance-based cluster with replicas: replicas are read-only, so one primary still takes every write (giải bài toán khác)
- DynamoDB: scales writes but needs a rewrite of the data access layer (vi phạm ràng buộc)
- Aurora PostgreSQL with JSONB: requires rewriting the queries as SQL (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/documentdb/latest/developerguide/docdb-using-elastic-clusters.html
> 🇻🇳 MongoDB cần scale ghi ngang, ít sửa code → DocumentDB elastic cluster (shard); replica chỉ để đọc.

---

## Q ai-20261022-a33-12
- domain: performance
- task: 3.3
- topic: database
- services: Keyspaces, DynamoDB, Timestream, EC2
- tags: purpose-built, serverless-database
- difficulty: medium
- time: 110
- skills: 3.3.k8, 3.3.s4
- concept: Amazon Keyspaces runs existing Cassandra workloads serverlessly with CQL and Cassandra drivers, billed by reads and writes in on-demand mode
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Mã dùng CQL và driver Cassandra, muốn bỏ quản lý node và trả theo lượt đọc/ghi — dịch vụ nào tương thích Cassandra mà không có node?
- created: 2026-10-22
- enriched: 2026-10-22

A logistics company runs a 12-node Apache Cassandra cluster on Amazon EC2 to store package-tracking events. The team spends significant time replacing nodes, running repairs, and changing capacity, and traffic varies widely between weekdays and holidays. The application code uses CQL and Cassandra drivers. The company wants to eliminate node management and pay mainly for the reads and writes it performs, with minimal application changes. Which solution will meet these requirements?

- A. Migrate the tables to Amazon Keyspaces in on-demand capacity mode and point the existing Cassandra drivers at the Keyspaces endpoint.
- B. Migrate the tables to Amazon Keyspaces in provisioned capacity mode with auto scaling and point the existing drivers at its endpoint.
- C. Migrate the data to Amazon DynamoDB in on-demand mode and run the existing CQL statements through the DynamoDB PartiQL interface.
- D. Run the Cassandra cluster on Amazon EKS with a Kubernetes operator that automates node replacement, repairs, and scaling.

**Answer:** A

**Explanation:** Amazon Keyspaces is a serverless, Cassandra-compatible service: the same CQL and drivers keep working, there are no nodes to patch, repair, or resize, and on-demand mode bills for the reads and writes performed.
- Keyspaces provisioned with auto scaling: bills for provisioned capacity rather than for the reads and writes performed (vi phạm ràng buộc)
- DynamoDB through PartiQL: PartiQL is not CQL, so the Cassandra queries and drivers must change (cấu hình không tồn tại)
- Cassandra on EKS with an operator: automates some tasks, but the team still runs Cassandra nodes (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/keyspaces/latest/devguide/what-is-keyspaces.html
> 🇻🇳 Giữ CQL + driver Cassandra, bỏ quản lý node, trả theo request → Amazon Keyspaces (on-demand).

---

## Q ai-20261022-a33-13
- domain: performance
- task: 3.3
- topic: database
- services: Timestream, Aurora, DynamoDB, Keyspaces
- tags: purpose-built, time-series, multi-az
- difficulty: medium
- time: 115
- skills: 3.3.k8, 3.3.s4
- concept: Amazon Timestream for InfluxDB is the managed option for existing InfluxDB workloads, with single-digit-millisecond queries and Multi-AZ failover
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Dữ liệu chuỗi thời gian đang dùng InfluxDB và Telegraf — dịch vụ nào chạy chính engine đó dưới dạng được quản lý?
- created: 2026-10-22
- enriched: 2026-10-22

A manufacturer collects readings from thousands of production-line sensors every second and keeps them in a self-managed InfluxDB 2.x server on Amazon EC2. The operations team spends time patching the server and building failover, and dashboards that query recent data need single-digit millisecond responses. The Telegraf agents and queries already use InfluxDB's line protocol and query languages. The company wants a managed service that keeps the existing agents and queries working, with Multi-AZ availability and minimal changes. Which solution will meet these requirements?

- A. Migrate the readings to Amazon Timestream for InfluxDB in a Single-AZ deployment and restore from snapshots after a failure.
- B. Run the InfluxDB container on Amazon ECS with AWS Fargate and keep its data on an Amazon EFS file system that spans zones.
- C. Migrate the readings to Amazon Aurora PostgreSQL in a Multi-AZ deployment and rewrite the dashboard queries as SQL statements.
- D. Migrate the readings to Amazon Timestream for InfluxDB and run the database instance in a Multi-AZ deployment.

**Answer:** D

**Explanation:** Timestream for InfluxDB is a managed InfluxDB 2.x engine, so Telegraf agents and queries keep working, with single-digit-millisecond query responses, a Multi-AZ standby for failover, and patching handled by AWS.
- Single-AZ Timestream for InfluxDB: keeps the agents and queries, but lacks the required Multi-AZ availability (vi phạm ràng buộc)
- InfluxDB on Fargate with EFS: the team still maintains the database image, upgrades, and failover design (tốn vận hành hơn)
- Aurora PostgreSQL: a relational engine that needs the dashboard queries rewritten as SQL (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/timestream/latest/developerguide/timestream-for-influxdb.html
> 🇻🇳 Chuỗi thời gian đang dùng InfluxDB/Telegraf, cần Multi-AZ ít sửa đổi → Amazon Timestream for InfluxDB.

---

## Q ai-20261022-a33-14
- domain: performance
- task: 3.3
- topic: database
- services: OpenSearch, RDS, DynamoDB, Redshift
- tags: purpose-built, full-text-search
- difficulty: easy
- time: 105
- skills: 3.3.k8, 3.3.s4
- concept: Full-text search with relevance ranking and typo tolerance, plus interactive log analytics, is the use case of Amazon OpenSearch Service rather than relational LIKE queries
- refs: 03-database-services.md, 09-analytics-bigdata.md
- hint: Tìm kiếm văn bản có xếp hạng độ liên quan, chịu lỗi gõ, và phân tích log tương tác — loại dịch vụ nào là công cụ tìm kiếm chuyên dụng?
- created: 2026-10-22
- enriched: 2026-10-22

An online marketplace stores product listings in Amazon RDS for MySQL and offers search with LIKE queries across the title and description columns. As the catalog passes tens of millions of listings, searches take seconds, and shoppers expect relevance ranking and tolerance for typing mistakes. The same platform must also let engineers analyze application logs interactively. The company wants a managed service for both full-text search and log analytics with the LEAST operational overhead. Which solution will meet these requirements?

- A. Index the listings into an Amazon OpenSearch Service domain for search and analyze the application logs with Amazon CloudWatch Logs Insights.
- B. Index the listings and the logs into an Amazon OpenSearch Service domain and send the application's search requests to it.
- C. Run a self-managed OpenSearch cluster on Amazon EC2 instances and index both the listings and the logs into that cluster.
- D. Migrate to Aurora MySQL, create FULLTEXT indexes on the title and description columns, and load the logs into the same cluster.

**Answer:** B

**Explanation:** Amazon OpenSearch Service is a managed search and analytics engine that provides full-text search with relevance scoring and fuzzy matching, and it also supports interactive log analytics and dashboards on the same platform.
- OpenSearch plus CloudWatch Logs Insights: works, but uses two services instead of one managed service for both (vi phạm ràng buộc)
- Self-managed OpenSearch on EC2: the same engine, with nodes to patch and scale (tốn vận hành hơn)
- Aurora FULLTEXT indexes: no typo tolerance for shoppers (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/opensearch-service/latest/developerguide/what-is.html
> 🇻🇳 Tìm kiếm full-text có xếp hạng, chịu lỗi gõ + phân tích log → Amazon OpenSearch Service, không phải LIKE trên RDS.

---

## Q ai-20261022-a33-15
- domain: performance
- task: 3.3
- topic: database
- services: RDS, Aurora, DMS, SCT
- tags: homogeneous-migration, read-replicas
- difficulty: medium
- time: 145
- skills: 3.3.k6, 3.3.s3
- concept: A homogeneous RDS for MySQL to Aurora MySQL move uses an Aurora read replica that is promoted once writes stop and lag is zero; SCT and DMS are for different engines and a dump-and-import needs long downtime
- refs: 03-database-services.md, 10-migration-transfer.md
- hint: Cùng họ engine MySQL nên không cần chuyển đổi schema — cách nào cho phép sao chép nền rồi chỉ ngừng ghi vài phút khi chuyển?
- created: 2026-10-22
- enriched: 2026-10-22

A company runs a 3 TiB Amazon RDS for MySQL database and wants to move it to Amazon Aurora MySQL for better read scaling and storage. The application can be offline for no more than a few minutes during the cutover, the copy can run in the background for hours, and the team does not want to convert schemas or rewrite queries. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create an Aurora MySQL read replica of the RDS for MySQL instance and let it replicate the changes while the application keeps running.
- B. Restore the latest snapshot of the RDS for MySQL instance into a new Aurora MySQL cluster with a read endpoint and move the application to it right away.
- C. Stop the application's writes, wait until the replica lag reaches zero, promote the Aurora replica, and point the application at its endpoint.
- D. Create an RDS Blue/Green Deployment whose green environment is an Aurora MySQL cluster, and switch over once it is in sync.
- E. Promote the Aurora replica immediately while the application keeps writing to the source instance, and then switch the application to the new cluster.

**Answer:** A, C

**Explanation:** An Aurora read replica of an RDS for MySQL instance copies data in the background and keeps replicating; once writes stop and lag reaches zero, promotion makes it a standalone cluster, so downtime is brief with no schema conversion.
- Snapshot restore with an immediate switch: writes made after the snapshot are lost, or the application stays offline for hours (vi phạm ràng buộc)
- Blue/Green Deployment to Aurora: the green environment uses the same engine and cannot be an Aurora cluster (cấu hình không tồn tại)
- Immediate promotion: later writes to the source never reach the new cluster (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraMySQL.Migrating.RDSMySQL.Replica.html
> 🇻🇳 RDS MySQL → Aurora MySQL (cùng engine): tạo Aurora read replica, dừng ghi, chờ lag = 0 rồi promote; SCT/DMS dành cho khác engine.

---

## Q ai-20261022-a33-16
- domain: performance
- task: 3.3
- topic: database
- services: Aurora, ElastiCache, DynamoDB, RDS
- tags: aurora-global-database, write-forwarding, multi-region
- difficulty: hard
- time: 160
- skills: 3.3.k1, 3.3.k7
- concept: An Aurora global database with a secondary cluster gives local low-latency reads in another Region, and write forwarding lets that Region keep one local endpoint for writes too
- refs: 03-database-services.md, E-kien-truc-database.md
- hint: Cần đọc cục bộ độ trễ thấp ở Region thứ hai và vẫn ghi được qua cùng endpoint cục bộ — hai thành phần của Aurora nào phối hợp?
- created: 2026-10-22
- enriched: 2026-10-22

A travel-booking company runs an Amazon Aurora MySQL cluster in us-east-1. Users in Europe see slow page loads because every read crosses the Atlantic, and the European application must also make occasional profile updates without keeping a separate connection to the US Region. The company wants low-latency local reads in eu-west-1 with replication lag that is typically sub-second, and the European application should use one local endpoint for both reads and writes. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create a cross-Region read replica cluster by using binary log replication and point the European reads and writes at it.
- B. Create an Aurora global database by adding a secondary cluster in eu-west-1 to the existing cluster.
- C. Turn on local write forwarding for the primary cluster in us-east-1 so that its reader instances also accept write statements.
- D. Turn on write forwarding for the secondary cluster so that write statements sent to it are forwarded to the primary cluster.
- E. Deploy an Amazon RDS Proxy in eu-west-1 that forwards the European reads and writes to the Aurora cluster in us-east-1.

**Answer:** B, D

**Explanation:** An Aurora global database replicates storage to a secondary cluster in another Region with typical lag under a second, serving local reads, and write forwarding sends write statements from that cluster to the primary, so one local endpoint serves reads and writes.
- Binlog replica used for writes: a cross-Region read replica is read-only, so the writes fail (dùng sai tính năng)
- Local write forwarding in us-east-1: forwards writes inside the primary Region and does nothing for European reads (đặt sai chỗ)
- RDS Proxy in eu-west-1: a proxy does not replicate data, so every read still crosses the Atlantic (đặt sai chỗ)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database-write-forwarding.html
> 🇻🇳 Đọc cục bộ ở Region khác + ghi qua endpoint cục bộ → Aurora global database (cluster phụ) + write forwarding.

---

## Q ai-20261022-a33-17
- domain: performance
- task: 3.3
- topic: database
- services: ElastiCache, Aurora, DAX, Lambda
- tags: elasticache-serverless, capacity-planning
- difficulty: medium
- time: 120
- skills: 3.3.k4, 3.3.k2
- concept: ElastiCache Serverless scales memory, compute, and network automatically with no capacity planning, whereas replicas copy the whole dataset, scheduled resizing still forecasts, and DAX only fronts DynamoDB
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Bộ nhớ đầy gây evict và mỗi chiến dịch phải ước lượng rồi đổi cỡ node — hình thức cache nào không cần lập kế hoạch dung lượng?
- created: 2026-10-22
- enriched: 2026-10-22

A retail company caches product-detail data in an Amazon ElastiCache for Valkey cluster with one shard, while the products themselves live in Amazon Aurora. Before each seasonal campaign, engineers estimate the data set size and resize the node type by hand because evictions rise when memory fills and the node's network saturates. Between campaigns the cache is mostly idle. The company wants the cache to adapt its memory, compute, and network capacity to demand automatically, with no capacity forecasting and the LEAST operational overhead. Which solution will meet these requirements?

- A. Create an ElastiCache Serverless cache for Valkey and point the application at its endpoint instead of the cluster endpoint.
- B. Turn on cluster mode and ElastiCache Auto Scaling for shards with a target on memory usage, and keep the current node type.
- C. Move the cache to data tiering node types so that less frequently used items move from memory to local SSD storage.
- D. Add more read replicas to the existing ElastiCache for Valkey shard so that each replica holds a share of the product data set.

**Answer:** A

**Explanation:** ElastiCache Serverless monitors the memory, compute, and network that the application uses and scales to meet demand, so nobody plans or resizes capacity, and the application sees a single endpoint.
- Shard auto scaling in cluster mode: adapts the shard count, but the node type, limits, and policies are still planned and tuned (tốn vận hành hơn)
- Data tiering nodes: extend memory with SSD, but compute and network stay fixed and the node type is still sized by hand (giải bài toán khác)
- More read replicas: each replica holds a full copy of the data, so memory pressure does not shrink (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.html
> 🇻🇳 Cache phải tự co giãn bộ nhớ/compute/mạng theo nhu cầu, không dự báo → ElastiCache Serverless; replica nhân bản toàn bộ dữ liệu, DAX chỉ cho DynamoDB.
