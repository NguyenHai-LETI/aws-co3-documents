---
pack: ai-2026-10-22-tier-a-3-3
title: "AI · Tầng A · Task 3.3 — Database hiệu năng cao (phần 1)"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 3.3"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 3.3"
---

# AI · Tầng A · Task 3.3 — Database hiệu năng cao (phần 1)

## Q ai-20261022-a33-01
- domain: performance
- task: 3.3
- topic: database
- services: RDS, Aurora
- tags: read-replicas, aurora-endpoints
- difficulty: medium
- time: 120
- skills: 3.3.s1, 3.3.k7
- concept: RDS cannot autoscale read replicas, while Aurora Auto Scaling adds and removes Aurora Replicas behind the reader endpoint
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Cần số replica tự tăng giảm theo tải đọc — dịch vụ nào có chính sách tự động thêm/bớt replica, dịch vụ nào chỉ cho tạo thủ công?
- created: 2026-10-22
- enriched: 2026-10-22

An online retailer runs its catalog on Amazon RDS for MySQL with a Multi-AZ instance deployment. Reporting dashboards and a public search page generate heavy read traffic that rises unpredictably during campaigns and slows the primary. The team has added two read replicas, but each campaign still requires an engineer to create more replicas by hand and delete them afterward. The company wants read capacity to be added and removed automatically, with no application changes beyond using a read endpoint. Which solution will meet these requirements?

- A. Keep RDS for MySQL and use an EventBridge schedule with a Lambda function to add read replicas before each campaign and remove them afterward.
- B. Convert the Multi-AZ deployment to a Multi-AZ DB cluster and send the reporting and search reads to its reader endpoint.
- C. Migrate to Amazon Aurora MySQL and apply Aurora Auto Scaling to the Aurora Replicas, with reads sent to the reader endpoint.
- D. Migrate to Amazon Aurora MySQL with a fixed set of Aurora Replicas sized for the campaign peak, with reads sent to the reader endpoint.

**Answer:** C

**Explanation:** Amazon RDS does not autoscale read replicas, but Aurora Auto Scaling adds and removes Aurora Replicas with a target tracking policy on reader metrics, and the reader endpoint balances connections across them, so the application only needs the reader endpoint.
- Scheduled Lambda that adds RDS replicas: campaign traffic rises unpredictably, so a schedule cannot follow it (vi phạm ràng buộc)
- Multi-AZ DB cluster: its two readable standbys are a fixed number, not elastic (giải bài toán khác)
- Aurora with replicas sized for the peak: one read endpoint, but capacity is not added and removed automatically (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Integrating.AutoScaling.html
> 🇻🇳 RDS không tự scale read replica; Aurora có Aurora Auto Scaling cho replica (theo CPU/số kết nối) + reader endpoint.

---

## Q ai-20261022-a33-02
- domain: performance
- task: 3.3
- topic: database
- services: Aurora
- tags: aurora-endpoints, read-replicas
- difficulty: medium
- time: 145
- skills: 3.3.s1, 3.3.k7, 3.3.k3
- concept: Aurora custom endpoints group chosen replicas so that application reads and heavy BI queries use different replicas; the reader endpoint balances across all replicas and promotion tiers do not steer reads
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Reader endpoint chia kết nối cho mọi replica — cần cơ chế nào gom một nhóm replica nhất định vào một tên kết nối riêng?
- created: 2026-10-22
- enriched: 2026-10-22

A SaaS company runs an Amazon Aurora PostgreSQL cluster with one writer and four Aurora Replicas: two small replicas that serve the user-facing application and two large replicas intended for heavy business-intelligence queries. Analysts' long queries are slowing application reads because the application connects to the reader endpoint, which spreads connections across all four replicas. The company wants the application and the analytics tools each to use only their own replicas, with connection strings that do not depend on individual instance names. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create a custom endpoint that contains the two large replicas and point the analytics tools at it.
- B. Create an RDS Proxy with a read-only endpoint for the cluster and point the application at that proxy endpoint.
- C. Create a clone of the cluster each night and point the analytics tools at the cluster endpoint of the clone.
- D. Create a custom endpoint that contains the two small replicas and point the application at it.
- E. Set the promotion tier of the two large replicas to the lowest priority so that the reader endpoint favors the small replicas.

**Answer:** A, D

**Explanation:** A custom endpoint load-balances connections across a chosen subset of replicas, so one endpoint for the small replicas and one for the large replicas isolate the two workloads without naming any instance.
- RDS Proxy read-only endpoint: spreads connections across all readers, so the large replicas still serve the application (dùng sai tính năng)
- Nightly clone: a second cluster to pay for that serves stale data (tốn chi phí hơn)
- Promotion tier: sets the failover order, not where reader connections go (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Overview.Endpoints.html
> 🇻🇳 Tách tải bằng custom endpoint: một cho replica nhỏ (app), một cho replica lớn (BI); instance endpoint hay promotion tier không làm việc này.

---

## Q ai-20261022-a33-03
- domain: performance
- task: 3.3
- topic: database
- services: Aurora
- tags: aurora-serverless, read-replicas, capacity-planning
- difficulty: hard
- time: 140
- skills: 3.3.k8, 3.3.k4, 3.3.s1
- concept: A cluster can mix provisioned and Serverless v2 instances; Serverless v2 readers in promotion tier 2 or higher scale in place, independently of the writer, which makes only the spiky reader capacity elastic
- refs: 03-database-services.md, R-performance-benchmarks.md
- hint: Chỉ phần đọc phân tích bị đột biến ngắn, writer ổn định đã có Reserved Instance — làm sao chỉ reader co giãn tại chỗ, độc lập với writer?
- created: 2026-10-22
- enriched: 2026-10-22

A media company runs an Amazon Aurora MySQL cluster with a provisioned writer that carries a steady transactional load and is covered by Reserved Instances. Two provisioned readers sized for peak serve analytics queries that spike for a few minutes at unpredictable times and otherwise sit nearly idle, and adding Aurora Replicas during a spike takes too long to help. The company wants reader capacity to follow the spikes inside the cluster, without changing the writer or the application, and with the LEAST operational effort. Which solution will meet these requirements?

- A. Apply Aurora Auto Scaling to the cluster with a target on reader CPU utilization so that more provisioned replicas are added during each spike.
- B. Replace the provisioned readers with Aurora Serverless v2 readers in the same cluster and keep their promotion tier at 0 or 1.
- C. Convert the writer and the readers to Aurora Serverless v2 so that every instance in the cluster scales with the analytics spikes.
- D. Replace the provisioned readers with Aurora Serverless v2 readers in the same cluster and set their promotion tier to 2 or higher.

**Answer:** D

**Explanation:** A cluster can mix provisioned and Serverless v2 instances; Serverless v2 readers scale in place in fine-grained steps, and readers in promotion tier 2 or higher scale independently of the writer, so only the readers become elastic.
- Aurora Auto Scaling: adds fixed-size provisioned replicas, which launch too slowly for short spikes (giải bài toán khác)
- Serverless v2 readers in tier 0 or 1: their capacity is tied to the writer, so they do not scale with the analytics spikes (dùng sai tính năng)
- Converting the writer too: changes the steady writer that must stay as it is and wastes its reservation (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.setting-capacity.html
> 🇻🇳 Writer ổn định + reader đột biến ngắn → reader Aurora Serverless v2 (promotion tier ≥ 2) co giãn độc lập writer; Auto Scaling replica quá chậm.

---

## Q ai-20261022-a33-04
- domain: performance
- task: 3.3
- topic: database
- services: RDS Proxy, Lambda, RDS, Secrets Manager
- tags: connection-pooling, rds-proxy
- difficulty: medium
- time: 120
- skills: 3.3.k5
- concept: RDS Proxy pools and reuses connections for bursts of short-lived Lambda functions and keeps client connections during failover while using Secrets Manager credentials
- refs: 03-database-services.md, 01-compute-services.md
- hint: Hàng nghìn hàm Lambda mở kết nối cùng lúc và failover làm treo ứng dụng — thành phần nào đứng giữa để gom và giữ kết nối khi chuyển DB?
- created: 2026-10-22
- enriched: 2026-10-22

A ticketing company runs a serverless backend on AWS Lambda that connects to an Amazon RDS for PostgreSQL Multi-AZ database. When a popular event goes on sale, thousands of function instances open new database connections at once, the database runs out of connections, and failovers during maintenance leave functions hanging while DNS updates. Database credentials must stay in AWS Secrets Manager. The company wants to protect the database from connection storms and shorten application recovery after a failover, with minimal code changes. Which solution will meet these requirements?

- A. Run PgBouncer on an Auto Scaling group of Amazon EC2 instances and have the Lambda functions connect through a Network Load Balancer.
- B. Create an RDS Proxy that uses the credentials in Secrets Manager, and have the Lambda functions connect to the proxy endpoint.
- C. Create an RDS Proxy for the database and copy the credentials from Secrets Manager into encrypted Lambda environment variables.
- D. Convert the database to a Multi-AZ DB cluster deployment so that failovers complete faster, and keep the existing connection code.

**Answer:** B

**Explanation:** RDS Proxy pools and reuses connections, so thousands of short-lived function instances share a small number of database connections, and it connects to the standby during a failover while preserving application connections, with Secrets Manager credentials and few code changes.
- Self-managed PgBouncer on EC2: pools connections, but adds servers to run and does not follow RDS failovers itself (tốn vận hành hơn)
- Password in environment variables: the credentials must stay in Secrets Manager (vi phạm ràng buộc)
- Multi-AZ DB cluster: shortens failover but does nothing about the connection storms (giải bài toán khác)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html
> 🇻🇳 Lambda mở ồ ạt kết nối + failover chậm → RDS Proxy (pool kết nối, giữ kết nối khi failover, dùng Secrets Manager).

---

## Q ai-20261022-a33-05
- domain: performance
- task: 3.3
- topic: database
- services: ElastiCache
- tags: read-replicas, multi-az, redis-vs-memcached
- difficulty: medium
- time: 145
- skills: 3.3.k7, 3.3.k2, 3.3.s5
- concept: A replication group with replicas in other AZs and Multi-AZ automatic failover scales cache reads through the reader endpoint and survives a node loss; vertical sizing, extra shards and Memcached do neither
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Đọc làm nghẽn CPU của một node duy nhất và node hỏng làm mất sạch cache — thêm bản sao ở AZ khác và gửi lệnh đọc tới đúng endpoint.
- created: 2026-10-22
- enriched: 2026-10-22

A forum runs a single-node Amazon ElastiCache for Valkey cache in front of its database. Read commands now saturate the node's CPU, and a node failure empties the cache and sends a surge of queries to the database. The data set fits in one node's memory and the write volume is low. The company wants to scale read throughput and fail over automatically, with minimal application change. Which combination of steps will meet these requirements? (Choose TWO)

- A. Move to a cluster-mode-enabled configuration and add shards so that the write load is spread across more primary nodes.
- B. Create a replication group with a primary node and replicas in other Availability Zones, and turn on Multi-AZ with automatic failover.
- C. Move to a larger node type so that a single node has more CPU and can keep serving the read commands.
- D. Send the read commands to the replicas by using the reader endpoint and keep the write commands on the primary endpoint.
- E. Replace the cache with an ElastiCache for Memcached cluster and let the client library spread the keys across the nodes with automatic node discovery.

**Answer:** B, D

**Explanation:** A replication group adds read-only replicas in other zones, and with Multi-AZ a replica is promoted if the primary fails, so the cache survives a node loss; sending reads to the reader endpoint moves read load off the primary.
- Adding shards: spreads writes, which are low here, and the cache still lacks a replica (giải bài toán khác)
- Larger node type: raises one node's capacity but adds no failover (vi phạm ràng buộc)
- Memcached: has no replication or automatic failover, so a node loss still empties part of the cache (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Replication.html
> 🇻🇳 Đọc nghẽn + node đơn là điểm lỗi → replication group (replica khác AZ, Multi-AZ failover) + gửi đọc tới reader endpoint.

---

## Q ai-20261022-a33-06
- domain: performance
- task: 3.3
- topic: database
- services: DynamoDB
- tags: sharding, hot-partition, dynamodb-capacity
- difficulty: hard
- time: 135
- skills: 3.3.k3, 3.3.s4
- concept: A partition key that is the current date funnels all writes into one partition; write sharding with a suffix spreads them, whereas more capacity, on-demand mode or a GSI do not lift the per-partition limit
- refs: 03-database-services.md, E-kien-truc-database.md
- hint: Throttle dù dung lượng của bảng còn dư — giới hạn nằm ở đơn vị nào, và làm sao để các ghi không dồn vào cùng một giá trị khoá?
- created: 2026-10-22
- enriched: 2026-10-22

A fleet-tracking company stores vehicle telemetry in an Amazon DynamoDB table whose partition key is the current date, such as 2026-10-22, and whose sort key is a timestamp. The table is provisioned with 10,000 write capacity units, yet during peak hours writes are throttled although consumed capacity stays well below the provisioned amount. Reads always target one calendar day at a time. The company wants the table to sustain peak write rates without moving to a different database. Which solution will meet these requirements?

- A. Add a random suffix to the date in the partition key on writes, and query each suffix for the requested date and merge the results.
- B. Change the partition key to the vehicle ID and keep the timestamp as the sort key so that the writes spread evenly across many partitions.
- C. Switch the table to on-demand capacity mode so that DynamoDB adds partitions for the date key as the load grows.
- D. Place a DynamoDB Accelerator (DAX) cluster in front of the table so that the telemetry writes are absorbed during peak hours.

**Answer:** A

**Explanation:** All writes for one date hit one partition key value with a fixed maximum write rate, so throttling occurs despite unused capacity; a random suffix spreads writes across partitions, and reads query each suffix and merge.
- Vehicle ID as partition key: spreads writes, but a one-day read would then need a scan or an index keyed on the hot date (vi phạm ràng buộc)
- On-demand mode: keeps the same per-partition limit, so the hot date key still throttles (giải bài toán khác)
- DAX: a write-through cache that passes every write to the table, so the hot key still throttles (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-sharding.html
> 🇻🇳 Khoá phân vùng là ngày hiện tại → mọi ghi dồn vào một partition; thêm hậu tố ngẫu nhiên (write sharding), tăng WCU hay on-demand không gỡ giới hạn.

---

## Q ai-20261022-a33-07
- domain: performance
- task: 3.3
- topic: database
- services: DAX, DynamoDB, ElastiCache, Aurora
- tags: caching-strategies, dax
- difficulty: medium
- time: 120
- skills: 3.3.s5, 3.3.k2
- family: dynamodb-aurora-cache-choice
- concept: DAX is API-compatible with DynamoDB and needs the fewest application changes, but it caches DynamoDB only
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Chỉ xét các lần đọc DynamoDB và muốn sửa ứng dụng ít nhất — loại cache nào dùng cùng API với DynamoDB?
- created: 2026-10-22
- enriched: 2026-10-22

A gaming company stores player profiles in an Amazon DynamoDB table and match catalogs in an Amazon Aurora MySQL database. A small set of popular streamer profiles accounts for most profile reads, and the same hot match-catalog queries repeat constantly, so both data stores are slowed by repeated reads. The profile reads are eventually consistent, and the application is written with the AWS SDK for DynamoDB and a MySQL driver. Which solution will reduce read latency for the profile reads with the LEAST application change?

- A. Deploy an Amazon ElastiCache for Valkey cache, check it first on every read, and load it on a miss for both data stores.
- B. Add a second Region with DynamoDB global tables and Aurora Replicas so that reads are served from the Region nearest to each player.
- C. Create an Amazon DynamoDB Accelerator (DAX) cluster in the VPC and point the application's DynamoDB calls at the DAX endpoint.
- D. Switch the DynamoDB table to provisioned capacity with a high read capacity setting and add a larger Aurora writer instance.

**Answer:** C

**Explanation:** DAX is API-compatible with DynamoDB and serves repeated eventually consistent reads from memory in microseconds, so the application only swaps in the DAX client and endpoint.
- ElastiCache: also caches the profiles, but the application needs new cache-check and populate logic (tốn vận hành hơn)
- Second Region with global tables and replicas: moves data closer to players but does not cache repeated reads (giải bài toán khác)
- Higher provisioned capacity and a larger writer: adds throughput, not in-memory read latency (giải bài toán khác)
Docs: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DAX.html
> 🇻🇳 Chỉ cần giảm độ trễ đọc DynamoDB, ít sửa code nhất → DAX (tương thích API DynamoDB); ElastiCache phải tự viết logic cache.

---

## Q ai-20261022-a33-08
- domain: performance
- task: 3.3
- topic: database
- services: DAX, DynamoDB, ElastiCache, Aurora
- tags: caching-strategies, redis-vs-memcached
- difficulty: medium
- time: 120
- skills: 3.3.s5, 3.3.k2
- family: dynamodb-aurora-cache-choice
- concept: ElastiCache is a general-purpose cache usable with any data store, so one layer can serve both DynamoDB and Aurora; DAX caches DynamoDB only
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Đổi câu hỏi: một lớp cache chung cho cả DynamoDB lẫn Aurora — loại cache nào không bị ràng buộc vào một kho dữ liệu?
- created: 2026-10-22
- enriched: 2026-10-22

A gaming company stores player profiles in an Amazon DynamoDB table and match catalogs in an Amazon Aurora MySQL database. A small set of popular streamer profiles accounts for most profile reads, and the same hot match-catalog queries repeat constantly, so both data stores are slowed by repeated reads. The profile reads are eventually consistent, and the application is written with the AWS SDK for DynamoDB and a MySQL driver. Which solution will meet the requirement to accelerate both the profile reads and the catalog queries with a single caching layer?

- A. Deploy an Amazon ElastiCache for Valkey cache, check it first on every read, and load it on a miss for both data stores.
- B. Add a second Region with DynamoDB global tables and Aurora Replicas so that reads are served from the Region nearest to each player.
- C. Create an Amazon DynamoDB Accelerator (DAX) cluster in the VPC and point the application's DynamoDB calls at the DAX endpoint.
- D. Switch the DynamoDB table to provisioned capacity with a high read capacity setting and add a larger Aurora writer instance.

**Answer:** A

**Explanation:** ElastiCache for Valkey is a general-purpose in-memory cache that the application can use with any data store, so one lazy-loading layer can serve both the DynamoDB profiles and the Aurora catalog queries.
- DAX: caches DynamoDB only, so the Aurora queries stay uncached (dùng sai tính năng)
- Second Region with global tables and replicas: moves data closer to players but does not cache repeated reads (giải bài toán khác)
- Higher provisioned capacity and a larger writer: adds throughput, not in-memory read latency (giải bài toán khác)
Docs: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.html
> 🇻🇳 Một lớp cache dùng chung cho cả DynamoDB và Aurora → ElastiCache (DAX chỉ dành cho DynamoDB).

---

## Q ai-20261022-a33-09
- domain: performance
- task: 3.3
- topic: database
- services: Aurora, DynamoDB, DocumentDB, Keyspaces
- tags: relational-vs-nonrelational, purpose-built
- difficulty: easy
- time: 90
- skills: 3.3.s4, 3.3.k8
- concept: Complex joins, multi-table ACID transactions and ad hoc SQL reporting call for a relational engine such as Aurora, not a key-value, document or wide-column store
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Truy vấn join phức tạp, giao dịch ACID nhiều bảng và báo cáo SQL tùy ý — nhóm cơ sở dữ liệu nào được thiết kế cho các yêu cầu đó?
- created: 2026-10-22
- enriched: 2026-10-22

A wholesale distributor is replacing its legacy order-management system. The application runs complex multi-table joins for invoicing, requires ACID transactions across orders, line items, and inventory, and lets analysts run ad hoc SQL reports. Order volume is growing quickly, and the company wants a managed database with automatic failover, read scaling, and storage that grows without manual provisioning. Which database should a solutions architect choose?

- A. Use Amazon RDS for PostgreSQL in a Single-AZ deployment with read replicas and storage autoscaling turned on.
- B. Use Amazon Redshift Serverless for the order data so that analysts run ad hoc SQL reports on the same database.
- C. Use Amazon DynamoDB transactions with TransactWriteItems across the order, line item, and inventory tables.
- D. Use Amazon Aurora with a MySQL-compatible or PostgreSQL-compatible cluster and add Aurora Replicas for reads.

**Answer:** D

**Explanation:** Aurora is a managed relational engine with SQL joins and ACID transactions across tables, automatic failover, up to 15 low-lag Aurora Replicas for read scaling, and storage that grows automatically.
- RDS Single-AZ with replicas: relational with read scaling, but no automatic failover (vi phạm ràng buộc)
- Redshift Serverless: an analytics warehouse, not an OLTP store for high-rate transactional orders (dùng sai tính năng)
- DynamoDB transactions: ACID writes, but no joins or ad hoc SQL reports (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_AuroraOverview.html
> 🇻🇳 Join phức tạp + giao dịch ACID + báo cáo SQL → cơ sở dữ liệu quan hệ (Amazon Aurora), không phải DynamoDB/DocumentDB/Keyspaces.

---

## Q ai-20261022-a33-10
- domain: performance
- task: 3.3
- topic: database
- services: DynamoDB, ElastiCache, Aurora, Neptune, RDS
- tags: purpose-built, database-design
- difficulty: hard
- time: 175
- skills: 3.3.s2, 3.3.k8, 3.3.s4
- concept: Design the data layer from purpose-built engines: DynamoDB for key-value player data at scale, ElastiCache sorted sets for the leaderboard, and Aurora for ACID purchase transactions
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md, E-kien-truc-database.md
- hint: Mỗi nhu cầu có một kiểu truy cập chiếm ưu thế (khoá–giá trị, xếp hạng trong bộ nhớ, giao dịch ACID) — ghép mỗi nhu cầu với một engine.
- created: 2026-10-22
- enriched: 2026-10-22

A game studio is designing the data layer for a global online game that expects millions of concurrent players. Player profiles and inventories are read and written by player ID at very high request rates and must scale horizontally with single-digit millisecond latency. A live leaderboard must rank millions of players and refresh in under a millisecond. Purchase transactions require ACID guarantees across multiple related tables. The team wants to use purpose-built managed databases. Which combination of designs will meet these requirements? (Choose THREE)

- A. Store the player profiles and inventories in a single Amazon Aurora Serverless v2 cluster so that capacity follows demand.
- B. Store the player profiles and inventories in Amazon DynamoDB with on-demand capacity so that throughput follows demand.
- C. Compute the leaderboard by querying a DynamoDB global secondary index whose sort key is the player's score after each match.
- D. Compute the leaderboard with sorted sets in Amazon ElastiCache for Valkey and update the scores after each match result.
- E. Store the purchase transactions in Amazon Keyspaces and use lightweight transactions to protect each purchase.
- F. Store the purchase transactions in Amazon Aurora so that every purchase commits or rolls back as a single unit.

**Answer:** B, D, F

**Explanation:** Match each need to a purpose-built engine: DynamoDB scales key-value access by player ID, ElastiCache sorted sets rank players in memory, and Aurora provides ACID transactions across related tables.
- Aurora Serverless v2 for profiles: scales capacity, but every write still goes to one writer instead of scaling horizontally (vi phạm ràng buộc)
- GSI sorted by score: returns ranked items in milliseconds, not the sub-millisecond refresh of an in-memory sorted set (vi phạm ràng buộc)
- Keyspaces lightweight transactions: conditional writes within one partition, not ACID transactions across related tables (dùng sai tính năng)
Docs: https://aws.amazon.com/products/databases/
> 🇻🇳 Chọn DB theo kiểu truy cập: DynamoDB cho key–value quy mô lớn, ElastiCache (sorted set) cho leaderboard, Aurora cho giao dịch ACID.
