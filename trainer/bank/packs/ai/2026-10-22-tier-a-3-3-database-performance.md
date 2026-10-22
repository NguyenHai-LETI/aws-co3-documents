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
- skills: 3.3.s1, 3.3.k7
- concept: RDS cannot autoscale read replicas, while Aurora Auto Scaling adds and removes Aurora Replicas behind the reader endpoint
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Cần số replica tự tăng giảm theo tải đọc — dịch vụ nào có chính sách tự động thêm/bớt replica, dịch vụ nào chỉ cho tạo thủ công?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

An online retailer runs its catalog on Amazon RDS for MySQL with a Multi-AZ instance deployment. Reporting dashboards and a public search page generate heavy read traffic that rises unpredictably during campaigns and slows the primary. The team has added two read replicas, but each campaign still requires an engineer to create more replicas by hand and delete them afterward. The company wants read capacity to be added and removed automatically, with no application changes beyond using a read endpoint. Which solution will meet these requirements?

- A. Add an Auto Scaling policy to the RDS for MySQL instance so that RDS creates and removes read replicas based on CPU utilization during each campaign.
- B. Convert the Multi-AZ deployment to a Multi-AZ DB cluster so that its two readable standby instances absorb the reporting and search reads.
- C. Migrate to Amazon Aurora MySQL and apply Aurora Auto Scaling to the Aurora Replicas, with reads sent to the reader endpoint.
- D. Create a larger number of RDS read replicas before each campaign and keep them running year-round behind a weighted Route 53 read endpoint.

**Answer:** C

**Explanation:** Amazon RDS does not autoscale read replicas, but Aurora Auto Scaling adds and removes Aurora Replicas with a target tracking policy on reader metrics, and the reader endpoint balances connections across them, so the application only needs the reader endpoint.
- RDS auto scaling policy for replicas: RDS has no such setting (cấu hình không tồn tại)
- Multi-AZ DB cluster: its two readable standbys are a fixed number, not elastic (giải bài toán khác)
- Replicas kept running all year: pays for peak read capacity continuously and is still manual (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Integrating.AutoScaling.html
> 🇻🇳 RDS không tự scale read replica; Aurora có Aurora Auto Scaling cho replica (theo CPU/số kết nối) + reader endpoint.

---

## Q ai-20261022-a33-02
- domain: performance
- task: 3.3
- topic: database
- services: Aurora
- tags: aurora-endpoints, read-replicas
- difficulty: hard
- skills: 3.3.s1, 3.3.k7, 3.3.k3
- concept: Aurora custom endpoints group chosen replicas so that application reads and heavy BI queries use different replicas; the reader endpoint balances across all replicas and promotion tiers do not steer reads
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Reader endpoint chia kết nối cho mọi replica — cần cơ chế nào gom một nhóm replica nhất định vào một tên kết nối riêng?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 160

A SaaS company runs an Amazon Aurora PostgreSQL cluster with one writer and four Aurora Replicas: two small replicas that serve the user-facing application and two large replicas intended for heavy business-intelligence queries. Analysts' long queries are slowing application reads because the application connects to the reader endpoint, which spreads connections across all four replicas. The company wants the application and the analytics tools each to use only their own replicas, with connection strings that do not depend on individual instance names. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create a custom endpoint that contains the two large replicas and point the analytics tools at it.
- B. Point the application at the instance endpoint of each small replica and rotate the list in the application configuration.
- C. Create a second Aurora cluster by cloning the cluster and refresh the clone every night for the analytics tools.
- D. Create a custom endpoint that contains the two small replicas and point the application at it.
- E. Set the promotion tier of the two large replicas to the lowest priority so that the reader endpoint stops sending application connections to them.

**Answer:** A, D

**Explanation:** A custom endpoint load-balances connections across a chosen subset of replicas, so one endpoint for the small replicas and one for the large replicas isolate the two workloads without naming any instance.
- Instance endpoints: tie the application to specific instances, which contradicts the connection-string requirement (vi phạm ràng buộc)
- Nightly clone: adds a second cluster to pay for and serves stale data (tốn chi phí hơn)
- Promotion tier: decides which replica is promoted on failover, not where reader connections go (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Overview.Endpoints.html
> 🇻🇳 Tách tải bằng custom endpoint: một cho replica nhỏ (app), một cho replica lớn (BI); instance endpoint hay promotion tier không làm việc này.

---

## Q ai-20261022-a33-03
- domain: performance
- task: 3.3
- topic: database
- services: Aurora
- tags: aurora-serverless, capacity-planning
- difficulty: medium
- skills: 3.3.k8, 3.3.k4
- concept: Aurora Serverless v2 scales compute in fine-grained ACU steps in place, which suits many clusters with unpredictable, spiky load better than peak-sized provisioned instances
- refs: 03-database-services.md, R-performance-benchmarks.md
- hint: Tải đột biến khó đoán, phần lớn thời gian rảnh, không muốn ai phải đổi cỡ instance — dung lượng tính toán nên tự co giãn tại chỗ.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A software company hosts a multi-tenant reporting product on Amazon Aurora MySQL, with one isolated cluster for each customer. Usage is highly variable: most clusters are nearly idle, but a few jump from light to heavy use within minutes when customers run month-end reports, and the timing is unpredictable. Every writer is a provisioned instance sized for peak load, so most capacity sits idle. The company wants each cluster's compute capacity to follow its load without interrupting running queries and without the operations team resizing instances. Which solution will meet these requirements?

- A. Keep the provisioned writers and schedule instance class changes with AWS Lambda functions before each customer's expected month-end window.
- B. Add Aurora Replicas to each cluster and apply Aurora Auto Scaling so that reader capacity grows while the month-end reports run.
- C. Move each customer's data to Amazon DynamoDB on-demand tables so that capacity follows the request rate of each customer.
- D. Convert the writer and reader instances to Aurora Serverless v2 and set a minimum and maximum capacity range for each cluster.

**Answer:** D

**Explanation:** Aurora Serverless v2 adjusts capacity in fine-grained ACU increments, in place and without disrupting running queries, so idle clusters cost little and busy ones grow quickly within their range with nobody resizing instances.
- Scheduled instance class changes: the busy times are unpredictable and each change interrupts connections (vi phạm ràng buộc)
- Replicas with Aurora Auto Scaling: the writer stays sized for peak and each replica is a fixed-size instance (giải bài toán khác)
- DynamoDB: would force a redesign of the relational reports (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html
> 🇻🇳 Tải biến động khó đoán, nhiều cluster rảnh → Aurora Serverless v2 (ACU tự co giãn tại chỗ, không gián đoạn).

---

## Q ai-20261022-a33-04
- domain: performance
- task: 3.3
- topic: database
- services: RDS Proxy, Lambda, RDS, Secrets Manager
- tags: connection-pooling, rds-proxy
- difficulty: medium
- skills: 3.3.k5
- concept: RDS Proxy pools and reuses connections for bursts of short-lived Lambda functions and keeps client connections during failover while using Secrets Manager credentials
- refs: 03-database-services.md, 01-compute-services.md
- hint: Hàng nghìn hàm Lambda mở kết nối cùng lúc và failover làm treo ứng dụng — thành phần nào đứng giữa để gom và giữ kết nối khi chuyển DB?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A ticketing company runs a serverless backend on AWS Lambda that connects to an Amazon RDS for PostgreSQL Multi-AZ database. When a popular event goes on sale, thousands of function instances open new database connections at once, the database runs out of connections, and failovers during maintenance leave functions hanging while DNS updates. Database credentials must stay in AWS Secrets Manager. The company wants to protect the database from connection storms and shorten application recovery after a failover, with minimal code changes. Which solution will meet these requirements?

- A. Increase the max_connections value in the DB parameter group, move the database to a larger instance class, and keep the credentials in Secrets Manager.
- B. Create an RDS Proxy that uses the credentials in Secrets Manager, and have the Lambda functions connect to the proxy endpoint.
- C. Set the Lambda functions' reserved concurrency to a low value so that fewer functions connect to the database at the same time.
- D. Create an RDS read replica and have the Lambda functions send their connections to the replica's endpoint.

**Answer:** B

**Explanation:** RDS Proxy pools and reuses connections, so thousands of short-lived function instances share a small number of database connections, and it connects to the standby during a failover while preserving application connections, with Secrets Manager credentials and few code changes.
- Higher max_connections and a bigger instance: more memory per connection, but the storm and the failover delay remain (dùng sai tính năng)
- Low reserved concurrency: throttles customers during the sale (vi phạm ràng buộc)
- Read replica: read-only, and it fixes neither writes nor failover (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html
> 🇻🇳 Lambda mở ồ ạt kết nối + failover chậm → RDS Proxy (pool kết nối, giữ kết nối khi failover, dùng Secrets Manager).

---

## Q ai-20261022-a33-05
- domain: performance
- task: 3.3
- topic: database
- services: ElastiCache, RDS
- tags: caching-strategies, write-through
- difficulty: medium
- skills: 3.3.k2, 3.3.s5
- concept: When users must never see an outdated value, write-through keeps the cache current on every write, and lazy loading as a fallback refills a replaced node; long TTLs leave stale data and ElastiCache has no write-behind to a database
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Giá thay đổi phải hiện ngay sau khi commit, nhưng node mới thay thế bắt đầu rỗng — kết hợp hai chiến lược nạp cache nào bù cho nhau?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A trading-education platform keeps course prices in Amazon RDS for PostgreSQL and caches them in Amazon ElastiCache. Almost every price is read many times a minute, and prices change a few times a day. After a price change commits, users must never see the old price, and the application must still answer quickly after a cache node is replaced and starts empty. Which combination of actions will meet these requirements? (Choose TWO)

- A. Cache each price with a time to live of 24 hours and rely on expiration to remove outdated prices after each change.
- B. Update the cached price in the same code path that writes the new price to the database, so the cache cannot lag.
- C. Remove the cache and read every price from a read replica of the database so that the data stays current for readers.
- D. Load a missing price from the database and store it in the cache when it is requested, so that a replaced node refills itself.
- E. Configure the cache node to acknowledge price changes immediately and copy them to the database afterward, even if the node is replaced.

**Answer:** B, D

**Explanation:** Write-through updates the cache whenever the database is written, so readers never see a stale price, and lazy loading as a fallback reloads missing prices after a node replacement, covering write-through's gap.
- Long time to live: leaves the old price visible for hours after a change (vi phạm ràng buộc)
- Read replica without a cache: replication is asynchronous, so reads can lag the primary (giải bài toán khác)
- Write-behind to the database: ElastiCache does not write changes back to a database (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html
> 🇻🇳 Không bao giờ thấy giá cũ → write-through; node mới rỗng → thêm lazy loading làm dự phòng (TTL dài gây dữ liệu cũ).

---

## Q ai-20261022-a33-06
- domain: performance
- task: 3.3
- topic: database
- services: DynamoDB
- tags: sharding, hot-partition, dynamodb-capacity
- difficulty: hard
- skills: 3.3.k3, 3.3.s4
- concept: A partition key that is the current date funnels all writes into one partition; write sharding with a suffix spreads them, whereas more capacity, on-demand mode or a GSI do not lift the per-partition limit
- refs: 03-database-services.md, E-kien-truc-database.md
- hint: Throttle dù dung lượng của bảng còn dư — giới hạn nằm ở đơn vị nào, và làm sao để các ghi không dồn vào cùng một giá trị khoá?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A fleet-tracking company stores vehicle telemetry in an Amazon DynamoDB table whose partition key is the current date, such as 2026-10-22, and whose sort key is a timestamp. The table is provisioned with 10,000 write capacity units, yet during peak hours writes are throttled although consumed capacity stays well below the provisioned amount. Reads always target one calendar day at a time. The company wants the table to sustain peak write rates without moving to a different database. Which solution will meet these requirements?

- A. Add a random suffix to the date in the partition key on writes, and query each suffix for the requested date and merge the results.
- B. Increase the provisioned write capacity to 40,000 units so that every partition of the table receives a larger share of the capacity.
- C. Switch the table to on-demand capacity mode so that DynamoDB adds partitions for the date key as the load grows.
- D. Create a global secondary index on the timestamp attribute and direct the writes to the index instead of to the table itself.

**Answer:** A

**Explanation:** All writes for one date hit one partition key value with a fixed maximum write rate, so throttling occurs despite unused capacity; a random suffix spreads writes across partitions, and reads query each suffix and merge.
- More provisioned capacity: the per-partition limit stays, so the hot key still throttles (giải bài toán khác)
- On-demand mode: has the same per-partition limits, so one hot key still throttles (giải bài toán khác)
- Global secondary index: updated from table writes and cannot be written to directly (cấu hình không tồn tại)
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
- skills: 3.3.s5, 3.3.k2
- family: dynamodb-aurora-cache-choice
- concept: DAX is API-compatible with DynamoDB and needs the fewest application changes, but it caches DynamoDB only
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Chỉ xét các lần đọc DynamoDB và muốn sửa ứng dụng ít nhất — loại cache nào dùng cùng API với DynamoDB?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

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
- skills: 3.3.s5, 3.3.k2
- family: dynamodb-aurora-cache-choice
- concept: ElastiCache is a general-purpose cache usable with any data store, so one layer can serve both DynamoDB and Aurora; DAX caches DynamoDB only
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Đổi câu hỏi: một lớp cache chung cho cả DynamoDB lẫn Aurora — loại cache nào không bị ràng buộc vào một kho dữ liệu?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A gaming company stores player profiles in an Amazon DynamoDB table and match catalogs in an Amazon Aurora MySQL database. A small set of popular streamer profiles accounts for most profile reads, and the same hot match-catalog queries repeat constantly, so both data stores are slowed by repeated reads. The profile reads are eventually consistent, and the application is written with the AWS SDK for DynamoDB and a MySQL driver. Which solution will accelerate both the profile reads and the catalog queries by using a single caching layer?

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
- services: Neptune, Aurora, DocumentDB, Redshift
- tags: graph-database, purpose-built
- difficulty: easy
- skills: 3.3.s4, 3.3.k8
- concept: Multi-hop relationship traversals over billions of connections are the use case of Amazon Neptune, a purpose-built graph database
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Truy vấn nhiều bước qua các mối quan hệ chung thiết bị/địa chỉ/số điện thoại — kiểu dữ liệu nào lưu quan hệ như thành phần chính?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 100

A financial-services company wants to detect fraud rings by finding accounts that share devices, addresses, and phone numbers across several hops of relationships. In its current Amazon Aurora PostgreSQL database these queries need deeply nested self-joins across billions of rows and take minutes. The company wants these relationship traversals to return in milliseconds, and it wants a managed service that offers high availability and read replicas. Which solution will meet these requirements?

- A. Migrate the data to Amazon DocumentDB and store each account's connections as nested documents inside the account document.
- B. Migrate the data to Amazon Redshift and run the traversals as SQL window functions over the full table of relationships.
- C. Add Aurora Replicas and create composite indexes on every column that the self-joins use, then tune the join order.
- D. Migrate the data to Amazon Neptune and run the traversals with a graph query language such as Gremlin or openCypher.

**Answer:** D

**Explanation:** Neptune is a purpose-built graph database that stores relationships natively and is optimized for querying billions of relationships with millisecond latency using Gremlin, openCypher, or SPARQL, with Multi-AZ storage and up to 15 read replicas.
- DocumentDB: a document store whose nested documents do not make multi-hop traversals fast (dùng sai tính năng)
- Redshift: an analytic warehouse tuned for scans and aggregations, not interactive traversals (giải bài toán khác)
- More replicas and indexes: self-joins stay expensive at every extra hop (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/neptune/latest/userguide/intro.html
> 🇻🇳 Truy vấn quan hệ nhiều bước trên hàng tỷ kết nối, cần mili giây → Amazon Neptune (graph database).

---

## Q ai-20261022-a33-10
- domain: performance
- task: 3.3
- topic: database
- services: DynamoDB, ElastiCache, Aurora, Neptune, RDS
- tags: purpose-built, database-design
- difficulty: hard
- skills: 3.3.s2, 3.3.k8, 3.3.s4
- concept: Design the data layer from purpose-built engines: DynamoDB for key-value player data at scale, ElastiCache sorted sets for the leaderboard, and Aurora for ACID purchase transactions
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md, E-kien-truc-database.md
- hint: Mỗi nhu cầu có một kiểu truy cập chiếm ưu thế (khoá–giá trị, xếp hạng trong bộ nhớ, giao dịch ACID) — ghép mỗi nhu cầu với một engine.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 180

A game studio is designing the data layer for a global online game that expects millions of concurrent players. Player profiles and inventories are read and written by player ID at very high request rates and must scale horizontally with single-digit millisecond latency. A live leaderboard must rank millions of players and refresh in under a millisecond. Purchase transactions require ACID guarantees across multiple related tables. The team wants to use purpose-built managed databases. Which combination of designs will meet these requirements? (Choose THREE)

- A. Store the player profiles and inventories on a single Amazon RDS for MySQL instance that is sized for the peak load.
- B. Store the player profiles and inventories in Amazon DynamoDB with on-demand capacity so that throughput follows demand.
- C. Compute the leaderboard by scanning the DynamoDB profile table and sorting the scores in the application on every request.
- D. Compute the leaderboard with sorted sets in Amazon ElastiCache for Valkey and update the scores after each match result.
- E. Store the purchase transactions in Amazon Neptune as graph edges that connect each player to the items that the player bought.
- F. Store the purchase transactions in Amazon Aurora so that every purchase commits or rolls back as a single unit.

**Answer:** B, D, F

**Explanation:** Match each need to a purpose-built engine: DynamoDB scales key-value access by player ID, ElastiCache sorted sets rank players in memory, and Aurora provides ACID transactions across related tables.
- Single RDS instance for profiles: cannot scale horizontally for peak key-value traffic (vi phạm ràng buộc)
- Scanning DynamoDB to rank: reads the whole table on each request, too slow and costly (dùng sai tính năng)
- Neptune for purchases: a graph engine, not a transactional relational store (dùng sai tính năng)
Docs: https://aws.amazon.com/products/databases/
> 🇻🇳 Chọn DB theo kiểu truy cập: DynamoDB cho key–value quy mô lớn, ElastiCache (sorted set) cho leaderboard, Aurora cho giao dịch ACID.
