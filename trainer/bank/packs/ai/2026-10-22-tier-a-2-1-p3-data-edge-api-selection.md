---
pack: ai-2026-10-22-tier-a-2-1-p3
title: "AI · Tầng A · Task 2.1 — API, cache, edge, lưu trữ và chọn công nghệ phù hợp"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 2.1"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 2.1"
---

# AI · Tầng A · Task 2.1 — API, cache, edge, lưu trữ và chọn công nghệ phù hợp

## Q ai-20261022-a21-29
- domain: resilient
- task: 2.1
- topic: api
- services: API Gateway, Lambda, WAF
- tags: web-attacks
- difficulty: medium
- time: 125
- skills: 2.1.k1, 2.1.s7
- concept: Only API Gateway REST API usage plans with API keys give per-customer throttling and monthly quotas; stage throttling, WAF rate rules, and HTTP API route throttling do not
- refs: 11-api-integration.md
- hint: Mỗi gói bán có tốc độ và hạn mức tháng riêng, phải nhận diện từng khách — loại API nào có API key và usage plan?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A weather-data provider exposes a REST API backed by AWS Lambda to paying customers. The company sells three plans, each with a different request rate and monthly request quota, and must identify and throttle each customer individually. Customers sign in with an OAuth provider that is already connected through a Lambda authorizer. The company wants the LEAST operational overhead and does not want to write metering code. Which solution will meet these requirements?

- A. Create an Amazon API Gateway REST API and set stage-level and method-level throttling limits that match the request rates and quota limits of the three plans.
- B. Associate an AWS WAF web ACL with the REST API stage and add one rate-based rule for each plan that aggregates the requests by a customer ID header.
- C. Create an Amazon API Gateway HTTP API in place of the REST API, with a JWT authorizer and route-level throttling limits that match each of the three plans.
- D. Create an Amazon API Gateway REST API, define a usage plan with throttling and quota limits for each plan, and give each customer a plan-linked API key.

**Answer:** D

**Explanation:** REST APIs support API keys and usage plans, which apply per-client throttling and quotas without custom code.
- Stage and method throttling: limits all customers together, with no per-customer identity or monthly quota (dùng sai tính năng)
- WAF rate-based rules per customer header: limit request rates but cannot enforce monthly quotas (dùng sai tính năng)
- HTTP API with route throttling: HTTP APIs have no API keys, usage plans, or per-client throttling (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html
> 🇻🇳 Mỗi khách một API key, giới hạn tốc độ + hạn mức tháng theo gói → API Gateway REST API với usage plan (HTTP API không có API key/usage plan).

---

## Q ai-20261022-a21-30
- domain: resilient
- task: 2.1
- topic: api
- services: API Gateway, SQS, SNS, Lambda, RDS, RDS Proxy
- tags: decoupling, lambda-concurrency
- difficulty: hard
- time: 150
- skills: 2.1.k1, 2.1.k11, 2.1.s3
- concept: An API Gateway AWS service integration can write requests straight to SQS, so a burst is buffered without compute and the database is fed at a controlled rate
- refs: 11-api-integration.md, 07-application-integration.md
- hint: API phải xác nhận đơn tin cậy khi tải đột biến mà không thêm compute ở đường nhận — API Gateway có thể ghi thẳng vào dịch vụ nào để đệm?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A ticketing company receives bursts of order submissions from a mobile app through an Amazon API Gateway REST API. The API invokes an AWS Lambda function that writes each order to an Amazon RDS database. During on-sale events the database becomes overloaded and the API returns 5xx errors, so orders are lost. The company wants the API to acknowledge orders reliably during bursts while the database is written at a steady pace, with the LEAST operational overhead and without adding compute to the receive path. Which solution will meet these requirements?

- A. Add an AWS service integration to the API method that sends each order to an Amazon SQS queue, and process the queue with a Lambda function of limited concurrency.
- B. Place Amazon RDS Proxy between the Lambda function and the database so that the burst of order connections is pooled before it reaches the database.
- C. Add an AWS service integration to the API method that publishes each order to an Amazon SNS topic, and subscribe the Lambda function that writes each order to the database.
- D. Set stage throttling on the API to the rate that the database can sustain so that excess submissions are rejected and retried later by the mobile app.

**Answer:** A

**Explanation:** An API Gateway AWS service integration writes straight to SQS, so the API acknowledges orders without compute while consumers drain the queue into the database at a controlled rate.
- RDS Proxy: pools connections, but every order is still written at the burst rate (giải bài toán khác)
- SNS topic with the function subscribed: SNS pushes each order at once, so the database is not written at a steady pace (vi phạm ràng buộc)
- Stage throttling: rejects orders during bursts instead of acknowledging them (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-integration-types.html
> 🇻🇳 Tải đột biến, cần đệm bền và nhẹ vận hành → API Gateway tích hợp thẳng SQS (AWS service integration), consumer xả vào DB với tốc độ kiểm soát.

---

## Q ai-20261022-a21-31
- domain: resilient
- task: 2.1
- topic: database
- services: ElastiCache, Aurora, Lambda
- tags: caching-strategies, ttl
- difficulty: medium
- time: 125
- skills: 2.1.k3, 2.1.s6
- concept: Write-through updates the cache on every database write so cached values are never stale, while a TTL still bounds cache size; shorter TTLs, audit streams, or a bigger cache do not remove staleness
- refs: E-kien-truc-database.md, F-so-sanh-database-theo-dac-diem.md
- hint: Giá đổi hiếm nhưng khách vẫn thấy giá cũ tới hết TTL — chiến lược nào cập nhật cache cùng lúc với lần ghi vào CSDL?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

An e-commerce company caches product prices in Amazon ElastiCache to reduce read load on its Amazon Aurora database. The application uses lazy loading with a 15-minute TTL. When merchants change a price, shoppers keep seeing the old price for up to 15 minutes, which violates a pricing-accuracy policy. Price changes are infrequent and reads are heavy, and the team wants to keep the cache hit rate high without increasing read traffic on the database. Which change will meet these requirements?

- A. Reduce the TTL on every cached price to 30 seconds so that shoppers see a changed price within half a minute while most reads still hit the cache.
- B. Capture price changes with Aurora Database Activity Streams and have a Lambda function update the cached price for each change that the stream reports.
- C. Update the application so that each price write to Aurora also writes the new price to the cache (write-through), and keep the TTL as a safety net.
- D. Migrate the cache to Amazon ElastiCache Serverless so that it scales automatically with the read load and keeps serving prices from memory.

**Answer:** C

**Explanation:** Write-through updates the cache whenever the database is written, so prices are not stale, and the TTL keeps rarely read entries from piling up.
- 30-second TTL: shoppers still see old prices for up to half a minute, which the policy forbids (vi phạm ràng buộc)
- Database Activity Streams: an encrypted audit feed for monitoring database activity, not a change feed for updating a cache (dùng sai tính năng)
- ElastiCache Serverless: scales capacity, but lazily loaded entries stay stale until their TTL ends (giải bài toán khác)
Docs: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html
> 🇻🇳 Cache-aside (lazy loading) gây dữ liệu cũ tới hết TTL → thêm write-through (ghi DB thì ghi cache) + giữ TTL; TTL ngắn vẫn còn giá cũ, Database Activity Streams là luồng audit.

---

## Q ai-20261022-a21-32
- domain: resilient
- task: 2.1
- topic: networking
- services: CloudFront, Global Accelerator, ALB, ElastiCache, Route 53
- tags: caching-strategies, route53-routing
- difficulty: medium
- skills: 2.1.k7, 2.1.k3
- concept: A CDN caches per-article (not per-user) pages at the edge to cut latency and origin load; Global Accelerator does not cache and extra Regions or in-Region caches do not fix distance
- refs: 04-networking-services.md, C-kien-truc-web-app.md
- hint: Trang chỉ đổi khi xuất bản, độc giả khắp thế giới, tải đỉnh gấp bội — dịch vụ nào lưu bản sao gần người đọc và giảm tải máy gốc?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A news publisher serves article pages from an Application Load Balancer and an Auto Scaling group of EC2 instances in one Region. Pages are rendered per article, not per user, and change only when an editor publishes an update. During breaking news, traffic from readers around the world grows fiftyfold, the group scales out slowly, and distant readers see slow page loads while the oversized fleet drives up costs. The publisher wants lower latency for global readers and less load on the origin, with minimal changes to the application. Which solution will meet these requirements?

- A. Create an AWS Global Accelerator standard accelerator with the load balancer as its endpoint so that readers connect to the nearest AWS edge location and the article requests use the AWS global network.
- B. Create an Amazon CloudFront distribution with the load balancer as the origin and cache the article pages for a short TTL so that edge locations serve most requests.
- C. Add an Amazon ElastiCache cluster in front of the instances to hold the rendered pages and relieve the origin, and raise the minimum size of the Auto Scaling group for breaking news.
- D. Create a second Auto Scaling group behind another load balancer in a different Region and use Route 53 latency-based routing to send readers to the origin Region closest to them.

**Answer:** B

**Explanation:** CloudFront caches the pages at edge locations near readers, which lowers latency and absorbs the surge before it reaches the origin, with no application changes.
- Global Accelerator: improves the network path but does not cache, so the origin still serves every request (dùng sai tính năng)
- ElastiCache in the Region: gives distant readers no latency gain and the fleet stays oversized (giải bài toán khác)
- Second Region with latency routing: duplicates the stack, which adds cost and operations (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html
> 🇻🇳 Nội dung giống nhau cho mọi người đọc, khắp thế giới, giảm tải máy gốc → CloudFront cache ở edge; Global Accelerator không cache.

---

## Q ai-20261022-a21-33
- domain: resilient
- task: 2.1
- topic: networking
- services: CloudFront, Global Accelerator, NLB, ALB, S3, Route 53
- tags: route53-health-checks, high-availability
- difficulty: hard
- time: 170
- skills: 2.1.k7, 2.1.s6
- concept: CloudFront accelerates cacheable HTTP content; Global Accelerator gives static anycast IPs and fast health-based failover for UDP/TCP endpoints; DNS routing and wrong pairings fail the stated constraints
- refs: 04-networking-services.md, 14-so-sanh-services.md
- hint: Một phần HTTPS cache được, một phần UDP cần IP cố định và chuyển vùng trong vài giây — mỗi loại traffic hợp dịch vụ tăng tốc biên nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A multiplayer game company serves two kinds of traffic from AWS. A web portal and its marketing images are delivered over HTTPS from an Application Load Balancer and an Amazon S3 bucket in us-east-1. Real-time game sessions run on dedicated servers behind Network Load Balancers in three Regions and use UDP. For game sessions, players' firewalls allow-list a fixed set of IP addresses, and sessions must fail over to another Region within seconds when a Region becomes unhealthy. The company wants better performance for players worldwide for both kinds of traffic. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create an Amazon CloudFront distribution with the S3 bucket and the ALB as origins to cache the portal content close to players.
- B. Create a CloudFront distribution with the three NLBs as origins so that the UDP game sessions travel through CloudFront edge locations to the servers.
- C. Create an AWS Global Accelerator accelerator with the S3 bucket as an endpoint so that the portal images are cached at the edge.
- D. Create Route 53 latency-based records with health checks for the three NLBs and let player clients resolve the nearest healthy Region through DNS with a short TTL.
- E. Create a Global Accelerator standard accelerator with UDP listeners and an endpoint group in each Region that holds the NLB.

**Answer:** A, E

**Explanation:** CloudFront caches the HTTPS portal content at the edge, and Global Accelerator gives UDP traffic static anycast IP addresses and health-based failover across Regions.
- CloudFront for game sessions: it serves HTTP and HTTPS, not UDP (dùng sai tính năng)
- Global Accelerator with an S3 endpoint: it does not cache, and S3 is not an endpoint type (cấu hình không tồn tại)
- Route 53 latency records: DNS caching delays failover and gives no fixed IPs (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/global-accelerator/latest/dg/introduction-components.html
> 🇻🇳 Web HTTPS cache được → CloudFront; UDP + IP cố định + failover vùng trong vài giây → Global Accelerator (listener UDP, endpoint là NLB); DNS không đủ nhanh.

---

## Q ai-20261022-a21-34
- domain: resilient
- task: 2.1
- topic: storage
- services: S3, EFS, EBS, EC2
- tags: ebs-multi-attach, instance-store, ebs-volume-types
- difficulty: hard
- time: 180
- skills: 2.1.k13, 2.1.s6
- concept: Match storage types to workloads: object storage (S3) for HTTP-served images, a shared multi-AZ file system (EFS) for a common POSIX directory, block storage (EBS) for database data files
- refs: D-kien-truc-luu-tru.md, 02-storage-services.md
- hint: Ba kiểu lưu trữ ba workload — ảnh phục vụ qua HTTP, thư mục chung cho nhiều AZ, tệp dữ liệu của CSDL — mỗi cái hợp object, file hay block?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A media company is moving three workloads to AWS. First, a photo-sharing site stores tens of millions of user-uploaded images that web and mobile clients download over HTTP. Second, a content-management system runs on a fleet of Linux web servers in an Auto Scaling group across three Availability Zones, and all servers must read and write the same shared directory of themes and plugins. Third, a single self-managed PostgreSQL server on Amazon EC2 needs low-latency block storage with consistent IOPS for its data files. Which combination of storage choices will meet these requirements? (Choose THREE)

- A. Store the images on an Amazon EBS volume with Multi-Attach enabled and mount it on the back-end instances that serve the web and mobile clients.
- B. Store the images as objects in Amazon S3 and serve them to web and mobile clients over HTTPS.
- C. Mount an Amazon S3 bucket on every web server with Mountpoint for Amazon S3 for the shared theme and plugin directory.
- D. Mount a regional Amazon EFS file share on every web server for the shared theme and plugin directory.
- E. Place the PostgreSQL data files on an Amazon EFS file system with provisioned throughput for consistent IOPS, mounted on the database instance.
- F. Attach a Provisioned IOPS or General Purpose SSD Amazon EBS volume to the PostgreSQL instance for its data files.

**Answer:** B, D, F

**Explanation:** Images are objects for S3, a shared multi-AZ POSIX directory is a file system for EFS, and database data files need block storage from EBS.
- EBS Multi-Attach for images: it works only within one Availability Zone and is not an HTTP object store (dùng sai tính năng)
- Mountpoint for the shared directory: it cannot modify existing files (https://docs.aws.amazon.com/AmazonS3/latest/userguide/mountpoint.html), so servers cannot update themes and plugins in place (vi phạm ràng buộc)
- EFS for the database files: a network file system, not the low-latency block storage the database needs (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/efs/latest/ug/whatisefs.html
> 🇻🇳 Object → S3 (ảnh qua HTTP); file dùng chung nhiều AZ → EFS; block cho dữ liệu CSDL → EBS. Multi-Attach chỉ trong một AZ, S3 không phải block storage.

---

## Q ai-20261022-a21-35
- domain: resilient
- task: 2.1
- topic: database
- services: RDS, EventBridge
- tags: read-replicas, multi-az, multi-region
- difficulty: medium
- time: 145
- skills: 2.1.k15, 2.1.s6
- concept: Read replicas serve stale-tolerant reads for reporting and for users in another Region; a Multi-AZ standby cannot serve reads and Multi-AZ never spans Regions
- refs: E-kien-truc-database.md, 03-database-services.md
- hint: Báo cáo nặng và người dùng ở xa chấp nhận dữ liệu trễ vài giây — bản sao nào phục vụ đọc, còn standby Multi-AZ có đọc được không?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A SaaS provider runs its multi-tenant application on Amazon RDS for PostgreSQL in a Multi-AZ DB instance deployment in us-east-1. Heavy analytical reports that run on the primary during business hours slow down transactions, and the reports tolerate data that is a few seconds old. Customers in Singapore also see slow dashboards because every read crosses the Pacific Ocean, and these dashboards tolerate slightly stale data too. Writes are modest and do not need to scale. Which combination of actions will resolve both problems? (Choose TWO)

- A. Create a read replica in us-east-1 and point the reporting tools at the endpoint of the replica.
- B. Move the analytical reports to a nightly schedule with Amazon EventBridge Scheduler so that they no longer compete with business-hour transactions.
- C. Create a cross-Region read replica in Asia Pacific (Singapore) and point the Singapore dashboards at the endpoint of that replica.
- D. Connect the reporting tools to the standby instance in us-east-1 of the Multi-AZ DB instance deployment to offload the reports from the primary instance.
- E. Add a standby instance in Asia Pacific (Singapore) to the Multi-AZ deployment and point the Singapore dashboards at that standby instance for read traffic.

**Answer:** A, C

**Explanation:** Read replicas copy data asynchronously and serve read-only queries, so a replica in the Region isolates the reports and a cross-Region replica puts reads near Singapore users.
- Nightly reports: stop competing with transactions, but report data becomes up to a day old instead of a few seconds (vi phạm ràng buộc)
- Standby of a Multi-AZ instance deployment: it cannot serve read traffic (cấu hình không tồn tại)
- Standby in Singapore: a Multi-AZ standby stays in the primary's Region and serves no reads (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html
> 🇻🇳 Đọc nặng/báo cáo hoặc đọc gần người dùng ở Region khác → read replica (bất đồng bộ, có thể cross-Region); standby Multi-AZ không đọc được và không vượt Region.

---

## Q ai-20261022-a21-36
- domain: resilient
- task: 2.1
- topic: database
- services: DynamoDB, RDS
- tags: dynamodb-capacity, read-replicas, multi-az
- difficulty: hard
- skills: 2.1.s6, 2.1.s7, 2.1.k15
- concept: A write-heavy, key-based workload with unpredictable spikes fits DynamoDB on-demand; read replicas and Multi-AZ add no write capacity and vertical scaling needs planning
- refs: E-kien-truc-database.md, F-so-sanh-database-theo-dac-diem.md
- hint: Vấn đề nằm ở ghi chứ không phải đọc, truy cập theo khoá, đột biến khó đoán — kiểu CSDL và chế độ dung lượng nào tự co giãn phần ghi?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A ride-sharing startup stores driver location pings in a single Amazon RDS for MySQL instance. Each ping is written once and read later by driver ID only; there are no joins or multi-row transactions. Write volume is highly unpredictable and spikes to many times the average during city events, causing write latency and timeouts. Reads are rare. The company wants to stop planning capacity for the write path and to handle spikes automatically at the lowest cost for this unpredictable load. Which solution will meet these requirements?

- A. Add more read replicas in additional Availability Zones and send the driver location queries to the reader endpoint of the replicas.
- B. Convert the RDS instance to a Multi-AZ deployment so that the standby doubles the write capacity of the database.
- C. Scale the DB instance up to the largest instance class and use scheduled actions to scale it before the expected city events.
- D. Migrate the data to an Amazon DynamoDB table with the driver ID as the partition key and on-demand capacity mode.

**Answer:** D

**Explanation:** A key-based, write-heavy workload with unpredictable spikes fits DynamoDB on-demand, which scales writes automatically and bills per request, while a relational writer scales only up.
- More read replicas: replicas add read capacity, not write capacity (giải bài toán khác)
- Multi-AZ deployment: provides a standby for availability and adds no write capacity (dùng sai tính năng)
- Largest instance class with schedules: spikes are unpredictable, and resizing needs planning and downtime (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode.html
> 🇻🇳 Ghi nhiều, truy cập theo khoá, đột biến khó đoán, không muốn lập kế hoạch dung lượng → DynamoDB on-demand; read replica và Multi-AZ không tăng khả năng ghi.

---

## Q ai-20261022-a21-37
- domain: resilient
- task: 2.1
- topic: database
- services: Neptune, Aurora, DynamoDB, Redshift
- tags: decoupling
- difficulty: medium
- time: 110
- skills: 2.1.s7, 2.1.s6
- concept: Highly connected, multi-hop relationship queries belong in a purpose-built graph database (Neptune), not in recursive SQL joins, key-value traversals, or a data warehouse
- refs: E-kien-truc-database.md
- hint: Truy vấn quan hệ nhiều tầng qua hàng trăm triệu liên kết phải trả lời trong mili giây — kiểu CSDL nào sinh ra cho dữ liệu kết nối dày?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A professional-networking company recommends people that a user might know. The recommendation query traverses connections up to four levels deep across 800 million relationships stored in an Amazon Aurora PostgreSQL database. Recursive SQL joins take minutes and slow the whole cluster, but the query must return in milliseconds. The team is willing to move the relationship data to a different database service. Which solution will meet these requirements?

- A. Move the relationship data to Amazon Neptune and run the traversals with the Gremlin or openCypher query language.
- B. Keep the data in Aurora PostgreSQL, add an Aurora Replica with a larger instance class, and run the recursive queries on the reader endpoint.
- C. Store each user's connections in Amazon DynamoDB with an adjacency-list design and traverse the levels with BatchGetItem calls from the application.
- D. Load the relationship data into Amazon Redshift Serverless and run each traversal as a SQL query on capacity that the warehouse scales automatically.

**Answer:** A

**Explanation:** Neptune is a purpose-built graph database that stores relationships natively and traverses billions of them in milliseconds with Gremlin or openCypher.
- Larger Aurora Replica: offloads the primary, but the recursive joins still take minutes (giải bài toán khác)
- DynamoDB adjacency lists: four levels of fan-out need many sequential round trips from the application, far from milliseconds (vi phạm ràng buộc)
- Redshift Serverless: a warehouse for analytics scans, not millisecond multi-hop traversals (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/neptune/latest/userguide/intro.html
> 🇻🇳 Quan hệ nhiều bước, dữ liệu kết nối dày, cần mili giây → Amazon Neptune (graph DB); join SQL đệ quy, adjacency list trên DynamoDB hay Redshift không đạt mili giây.

---

## Q ai-20261022-a21-38
- domain: resilient
- task: 2.1
- topic: migration
- services: Transfer Family, S3, EC2, EFS
- tags: decoupling
- difficulty: easy
- time: 115
- skills: 2.1.k2, 2.1.s7
- concept: AWS Transfer Family is the managed SFTP endpoint that keeps partners' existing clients and hostname and lands files in S3, replacing self-managed SFTP servers
- refs: 10-migration-transfer.md
- hint: Đối tác giữ nguyên SFTP client, hostname, thông tin đăng nhập; công ty bỏ quản trị máy chủ — dịch vụ nào cấp SFTP được quản lý, ghi vào S3?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A healthcare billing company receives claim files from about 300 external clinics. The clinics upload files by using their own SFTP client software, against a hostname and credentials that the company issued years ago. The company runs the SFTP servers on two Amazon EC2 instances with local disks and spends considerable time on patching and capacity. It wants to stop managing servers, keep every clinic's client configuration unchanged, and land the files in Amazon S3 for downstream processing. Which solution will meet these requirements?

- A. Create an AWS Transfer Family server that uses the FTPS protocol, stores files in Amazon S3, and accepts the clinics' credentials at the existing hostname.
- B. Create an AWS Transfer Family SFTP server that stores files in Amazon S3, and give each clinic the server's endpoint name and a new SSH key pair.
- C. Create an AWS Transfer Family SFTP server that stores files in Amazon S3, point the existing hostname at it, and import the clinics' credentials.
- D. Replace the two EC2 instances with an Auto Scaling group of SFTP servers behind a Network Load Balancer that uses the existing hostname, mount Amazon EFS, and sync its files to Amazon S3.

**Answer:** C

**Explanation:** Transfer Family provides a fully managed SFTP endpoint backed by S3, so clinics keep their clients, hostname, and credentials, and the company runs no servers.
- FTPS server: a different protocol, so the clinics' SFTP clients would need reconfiguration (vi phạm ràng buộc)
- New endpoint name and new keys: every clinic would have to change its client configuration (vi phạm ràng buộc)
- Auto Scaling group of SFTP servers: still servers to patch and operate (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/transfer/latest/userguide/what-is-aws-transfer-family.html
> 🇻🇳 Giữ nguyên SFTP client của đối tác, bỏ quản trị máy chủ, ghi vào S3 → AWS Transfer Family (SFTP được quản lý).

---

## Q ai-20261022-a21-39
- domain: resilient
- task: 2.1
- topic: database
- services: Aurora, RDS, DynamoDB, EventBridge
- tags: aurora-serverless, read-replicas, multi-az
- difficulty: medium
- time: 115
- skills: 2.1.k6, 2.1.s6
- concept: Aurora Serverless v2 scales relational capacity in place within an ACU range with no outage; replicas add only reads, DynamoDB leaves PostgreSQL, and class changes cause outages
- refs: E-kien-truc-database.md, 03-database-services.md
- hint: Tải đỉnh lương gồm cả ghi, đổi instance class thì có gián đoạn — kiểu CSDL quan hệ nào tự co giãn dung lượng tại chỗ?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A startup runs a multi-tenant HR application on an Amazon RDS for PostgreSQL instance sized for its monthly payroll peak. For most of the month the database is mostly idle, and during the three days around payroll its CPU saturates within minutes. Resizing the instance class causes a short outage, so the team keeps over-provisioning. The workload is relational and must stay on PostgreSQL. The company wants the database to follow demand automatically, with no outage and no manual resizing. Which solution will meet these requirements?

- A. Migrate to Amazon Aurora PostgreSQL with provisioned instances and add Aurora Replicas with an Auto Scaling policy on their CPU utilization.
- B. Migrate to Amazon Aurora PostgreSQL with Aurora Serverless v2 and set a minimum and maximum capacity range in ACUs.
- C. Migrate the data to Amazon DynamoDB with on-demand capacity so that throughput follows the payroll peak without any capacity planning.
- D. Use Amazon EventBridge Scheduler to modify the DB instance class up before the payroll days and down afterward, applying each change immediately.

**Answer:** B

**Explanation:** Aurora Serverless v2 scales capacity in place within a configured ACU range as demand changes, with no outage and no manual resizing, and it stays PostgreSQL-compatible.
- Aurora Replicas with auto scaling: add read capacity, but the payroll peak includes writes (giải bài toán khác)
- DynamoDB on-demand: scales automatically, but the workload must stay relational on PostgreSQL (vi phạm ràng buộc)
- Scheduled class changes: each modification causes a short outage (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.how-it-works.html
> 🇻🇳 CSDL quan hệ tải đỉnh ngắn, không muốn gián đoạn hay resize tay → Aurora Serverless v2 (tự co giãn ACU tại chỗ); replica chỉ tăng đọc, DynamoDB không còn là PostgreSQL.
