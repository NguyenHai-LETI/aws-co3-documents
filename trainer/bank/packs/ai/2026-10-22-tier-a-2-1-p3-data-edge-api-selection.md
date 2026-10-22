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
- services: API Gateway, Lambda, WAF, ALB, DynamoDB
- tags: web-attacks
- difficulty: medium
- skills: 2.1.k1, 2.1.s7
- concept: Only API Gateway REST APIs offer API keys and usage plans for per-customer throttling and monthly quotas; HTTP APIs, WAF rate rules, and custom counters do not
- refs: 11-api-integration.md
- hint: Mỗi gói bán có tốc độ và hạn mức tháng riêng, phải nhận diện từng khách — loại API nào có API key và usage plan?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 130

A weather-data provider exposes a REST API backed by AWS Lambda to paying customers. The company sells three plans, each with a different request rate and monthly request quota, and must identify and throttle each customer individually. Customers sign in with an OAuth provider that is already connected through a Lambda authorizer. The company wants the LEAST operational overhead and does not want to write metering code. Which solution will meet these requirements?

- A. Expose the Lambda function through a function URL and count the requests of each customer in an Amazon DynamoDB table from inside the function, rejecting calls over the plan quota.
- B. Place an Application Load Balancer in front of the function and attach an AWS WAF rate-based rule for each plan to limit the request rate of each customer.
- C. Create an Amazon API Gateway HTTP API in place of the REST API, with a JWT authorizer and route-level throttling limits that match each of the three plans.
- D. Create an Amazon API Gateway REST API, define a usage plan with throttling and quota limits for each plan, and give each customer an API key that is associated with its plan.

**Answer:** D

**Explanation:** REST APIs support API keys and usage plans, which apply per-client throttling and quotas without custom code.
- Function URL with custom counting: metering code to write and operate (tốn vận hành hơn)
- WAF rate-based rules on an ALB: limit request rates, not monthly quotas per plan (dùng sai tính năng)
- HTTP API with route throttling: HTTP APIs have no API keys, usage plans, or per-client throttling (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html
> 🇻🇳 Mỗi khách một API key, giới hạn tốc độ + hạn mức tháng theo gói → API Gateway REST API với usage plan (HTTP API không có API key/usage plan).

---

## Q ai-20261022-a21-30
- domain: resilient
- task: 2.1
- topic: api
- services: API Gateway, SQS, Lambda, RDS
- tags: decoupling, lambda-concurrency
- difficulty: hard
- skills: 2.1.k1, 2.1.k11, 2.1.s3
- concept: An API Gateway AWS service integration can write requests straight to SQS, so a burst is buffered without compute and the database is fed at a controlled rate
- refs: 11-api-integration.md, 07-application-integration.md
- hint: API phải xác nhận đơn tin cậy khi tải đột biến mà không thêm compute ở đường nhận — API Gateway có thể ghi thẳng vào dịch vụ nào để đệm?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 150

A ticketing company receives bursts of order submissions from a mobile app through an Amazon API Gateway REST API. The API invokes an AWS Lambda function that writes each order to an Amazon RDS database. During on-sale events the database becomes overloaded and the API returns 5xx errors, so orders are lost. The company wants the API to acknowledge orders reliably during bursts while the database is written at a steady pace, with the LEAST operational overhead and without adding compute to the receive path. Which solution will meet these requirements?

- A. Add an AWS service integration to the API method that sends each order to an Amazon SQS queue, and process the queue with a Lambda function of limited concurrency.
- B. Enable API caching on the POST method of the stage so that repeated order submissions are absorbed before they reach the Lambda function and the database.
- C. Increase the reserved concurrency of the Lambda function and move the RDS instance to a larger instance class so that the database can absorb the full burst of orders.
- D. Replace the REST API with an Application Load Balancer that forwards orders to EC2 instances in an Auto Scaling group, which keep the orders in memory until the database has caught up with the burst.

**Answer:** A

**Explanation:** An API Gateway AWS service integration writes straight to SQS, so the API acknowledges orders without compute while consumers drain the queue into the database at a controlled rate.
- API caching: unique POST submissions cannot be served from a cache (dùng sai tính năng)
- More concurrency and a larger instance: pushes more load at the database and costs more (tốn chi phí hơn)
- ALB with in-memory buffering: adds compute, and orders are lost if an instance terminates (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-integration-types.html
> 🇻🇳 Tải đột biến, cần đệm bền và nhẹ vận hành → API Gateway tích hợp thẳng SQS (AWS service integration), consumer xả vào DB với tốc độ kiểm soát.

---

## Q ai-20261022-a21-31
- domain: resilient
- task: 2.1
- topic: database
- services: ElastiCache, Aurora
- tags: caching-strategies, ttl
- difficulty: medium
- skills: 2.1.k3, 2.1.s6
- concept: Write-through updates the cache on every database write so cached values are never stale, while a TTL still bounds cache size; shrinking the TTL or dropping the cache hurts the hit rate
- refs: E-kien-truc-database.md, F-so-sanh-database-theo-dac-diem.md
- hint: Giá đổi hiếm nhưng khách vẫn thấy giá cũ tới hết TTL — chiến lược nào cập nhật cache cùng lúc với lần ghi vào CSDL?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 125

An e-commerce company caches product prices in Amazon ElastiCache to reduce read load on its Amazon Aurora database. The application uses lazy loading with a 15-minute TTL. When merchants change a price, shoppers keep seeing the old price for up to 15 minutes, which violates a pricing-accuracy policy. Price changes are infrequent and reads are heavy, and the team wants to keep the cache hit rate high without increasing read traffic on the database. Which change will meet these requirements?

- A. Reduce the TTL on every cached price to one second so that the cache is refreshed from the database on almost every read of a price.
- B. Stop caching prices and read them from an Aurora Replica through the reader endpoint so that shoppers see the current price straight from the database.
- C. Update the application so that each price write to Aurora also writes the new price to the cache (write-through), and keep the TTL as a safety net.
- D. Add a second ElastiCache cluster in another Availability Zone and read prices from whichever cluster answers first to reduce the chance of stale data.

**Answer:** C

**Explanation:** Write-through updates the cache whenever the database is written, so prices are not stale, and the TTL keeps rarely read entries from piling up.
- One-second TTL: the hit rate collapses and database reads soar (vi phạm ràng buộc)
- Aurora Replica without a cache: removes the cache and raises database read traffic (vi phạm ràng buộc)
- Second cache cluster: adds availability, but both clusters still hold stale prices after a change (giải bài toán khác)
Docs: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html
> 🇻🇳 Cache-aside (lazy loading) gây dữ liệu cũ tới hết TTL → thêm write-through (ghi DB thì ghi cache) + giữ TTL; TTL 1 giây hay bỏ cache làm tăng tải DB.

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
- skills: 2.1.k13, 2.1.s6
- concept: Match storage types to workloads: object storage (S3) for HTTP-served images, a shared multi-AZ file system (EFS) for a common POSIX directory, block storage (EBS) for database data files
- refs: D-kien-truc-luu-tru.md, 02-storage-services.md
- hint: Ba kiểu lưu trữ ba workload — ảnh phục vụ qua HTTP, thư mục chung cho nhiều AZ, tệp dữ liệu của CSDL — mỗi cái hợp object, file hay block?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 180

A media company is moving three workloads to AWS. First, a photo-sharing site stores tens of millions of user-uploaded images that web and mobile clients download over HTTP. Second, a content-management system runs on a fleet of Linux web servers in an Auto Scaling group across three Availability Zones, and all servers must read and write the same shared directory of themes and plugins. Third, a single self-managed PostgreSQL server on Amazon EC2 needs low-latency block storage with consistent IOPS for its data files. Which combination of storage choices will meet these requirements? (Choose THREE)

- A. Store the images on an Amazon EBS volume with Multi-Attach enabled and mount it on the back-end instances that serve the web and mobile clients.
- B. Store the images as objects in Amazon S3 and serve them to web and mobile clients over HTTPS.
- C. Place the shared theme and plugin directory on the instance store volumes of each web server and keep the copies in sync with a scheduled job.
- D. Mount a regional Amazon EFS file share on every web server for the shared theme and plugin directory.
- E. Mount an Amazon S3 bucket on the PostgreSQL instance with Mountpoint for Amazon S3 and place the database data files there to get consistent IOPS.
- F. Attach a Provisioned IOPS or General Purpose SSD Amazon EBS volume to the PostgreSQL instance for its data files.

**Answer:** B, D, F

**Explanation:** Images are objects for S3, a shared multi-AZ POSIX directory is a file system for EFS, and database data files need block storage from EBS.
- EBS Multi-Attach for images: it works only within one Availability Zone and is not an HTTP object store (dùng sai tính năng)
- Instance store with a sync job: ephemeral, not shared, and fragile to operate (đặt sai chỗ)
- Mountpoint for S3: it cannot modify existing files (https://docs.aws.amazon.com/AmazonS3/latest/userguide/mountpoint.html), so database files cannot live there (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/efs/latest/ug/whatisefs.html
> 🇻🇳 Object → S3 (ảnh qua HTTP); file dùng chung nhiều AZ → EFS; block cho dữ liệu CSDL → EBS. Multi-Attach chỉ trong một AZ, S3 không phải block storage.

---

## Q ai-20261022-a21-35
- domain: resilient
- task: 2.1
- topic: database
- services: RDS
- tags: read-replicas, multi-az, multi-region
- difficulty: medium
- skills: 2.1.k15, 2.1.s6
- concept: Read replicas serve stale-tolerant reads for reporting and for users in another Region; a Multi-AZ standby cannot serve reads and Multi-AZ never spans Regions
- refs: E-kien-truc-database.md, 03-database-services.md
- hint: Báo cáo nặng và người dùng ở xa chấp nhận dữ liệu trễ vài giây — bản sao nào phục vụ đọc, còn standby Multi-AZ có đọc được không?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 145

A SaaS provider runs its multi-tenant application on Amazon RDS for PostgreSQL in a Multi-AZ DB instance deployment in us-east-1. Heavy analytical reports that run on the primary during business hours slow down transactions, and the reports tolerate data that is a few seconds old. Customers in Singapore also see slow dashboards because every read crosses the Pacific Ocean, and these dashboards tolerate slightly stale data too. Writes are modest and do not need to scale. Which combination of actions will resolve both problems? (Choose TWO)

- A. Create a read replica in us-east-1 and point the reporting tools at the endpoint of the replica.
- B. Modify the DB instance to use a larger instance class with more memory and vCPUs so that the primary can run the reports and the transactions together without slowdowns.
- C. Create a cross-Region read replica in Asia Pacific (Singapore) and point the Singapore dashboards at the endpoint of that replica.
- D. Connect the reporting tools to the standby instance in us-east-1 of the Multi-AZ DB instance deployment to offload the reports from the primary instance.
- E. Use Multi-AZ failover to move the primary instance to Singapore so that users across the Pacific read from the new primary and the dashboards stay fast.

**Answer:** A, C

**Explanation:** Read replicas copy data asynchronously and serve read-only queries, so a replica in the Region isolates the reports and a cross-Region replica puts reads near Singapore users.
- Larger instance class: does not isolate the reports or shorten the distance to Singapore (giải bài toán khác)
- Standby of a Multi-AZ instance deployment: it cannot serve read traffic (cấu hình không tồn tại)
- Multi-AZ failover to Singapore: Multi-AZ stays within one Region (cấu hình không tồn tại)
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
- skills: 2.1.s7, 2.1.s6
- concept: Highly connected, multi-hop relationship queries belong in a purpose-built graph database (Neptune), not in recursive SQL joins, key-value traversals, or a data warehouse
- refs: E-kien-truc-database.md
- hint: Truy vấn quan hệ nhiều tầng qua hàng trăm triệu liên kết phải trả lời trong mili giây — kiểu CSDL nào sinh ra cho dữ liệu kết nối dày?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 105

A professional-networking company recommends people that a user might know. The recommendation query traverses connections up to four levels deep across 800 million relationships stored in an Amazon Aurora PostgreSQL database. Recursive SQL joins take minutes and slow the whole cluster, but the query must return in milliseconds. The team is willing to move the relationship data to a different database service. Which solution will meet these requirements?

- A. Move the relationship data to Amazon Neptune and run the traversals with the Gremlin or openCypher query language.
- B. Add several Aurora Replicas and route the recommendation queries to the reader endpoint of the cluster.
- C. Store the connections of each user as a list attribute in Amazon DynamoDB and traverse the lists with repeated GetItem calls from the application.
- D. Export the relationship data every night to Amazon Redshift and run each recommendation query there.

**Answer:** A

**Explanation:** Neptune is a purpose-built graph database that stores relationships natively and traverses billions of them in milliseconds with Gremlin or openCypher.
- Aurora Replicas: add query concurrency, not a cheaper way to run multi-level joins (giải bài toán khác)
- DynamoDB lists with GetItem: each hop is a separate round trip made by the application (tốn vận hành hơn)
- Nightly Redshift export: a warehouse for analytics, with stale data and no millisecond lookups (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/neptune/latest/userguide/intro.html
> 🇻🇳 Quan hệ nhiều bước, dữ liệu kết nối dày, cần mili giây → Amazon Neptune (graph DB); join SQL đệ quy, replica hay Redshift không giải đúng bài toán.

---

## Q ai-20261022-a21-38
- domain: resilient
- task: 2.1
- topic: migration
- services: Transfer Family, S3, EC2, DataSync, EFS
- tags: decoupling
- difficulty: easy
- skills: 2.1.k2, 2.1.s7
- concept: AWS Transfer Family is the managed SFTP endpoint that keeps partners' existing clients and hostname and lands files in S3, replacing self-managed SFTP servers
- refs: 10-migration-transfer.md
- hint: Đối tác giữ nguyên SFTP client, hostname, thông tin đăng nhập; công ty bỏ quản trị máy chủ — dịch vụ nào cấp SFTP được quản lý, ghi vào S3?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 115

A healthcare billing company receives claim files from about 300 external clinics. The clinics upload files by using their own SFTP client software, against a hostname and credentials that the company issued years ago. The company runs the SFTP servers on two Amazon EC2 instances with local disks and spends considerable time on patching and capacity. It wants to stop managing servers, keep every clinic's client configuration unchanged, and land the files in Amazon S3 for downstream processing. Which solution will meet these requirements?

- A. Create an Amazon S3 bucket and give each clinic an IAM user with access key credentials so that the clinics upload their files with the AWS CLI from their own networks.
- B. Deploy an AWS DataSync agent at each clinic to copy the claim files to Amazon S3 on a nightly schedule through the network of the clinic.
- C. Create an AWS Transfer Family SFTP server that stores files in Amazon S3, point the existing hostname at it, and import the clinics' credentials.
- D. Replace the two EC2 instances with an Auto Scaling group of SFTP servers behind a Network Load Balancer that uses the existing hostname, mount Amazon EFS, and sync its files to Amazon S3.

**Answer:** C

**Explanation:** Transfer Family provides a fully managed SFTP endpoint backed by S3, so clinics keep their clients, hostname, and credentials, and the company runs no servers.
- IAM users with the AWS CLI: every clinic would have to change its tooling (vi phạm ràng buộc)
- DataSync agent at each clinic: also changes every clinic's setup and is not an SFTP endpoint (vi phạm ràng buộc)
- Auto Scaling group of SFTP servers: still servers to patch and operate (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/transfer/latest/userguide/what-is-aws-transfer-family.html
> 🇻🇳 Giữ nguyên SFTP client của đối tác, bỏ quản trị máy chủ, ghi vào S3 → AWS Transfer Family (SFTP được quản lý).

---

## Q ai-20261022-a21-39
- domain: resilient
- task: 2.1
- topic: database
- services: Aurora, RDS
- tags: aurora-serverless, read-replicas, multi-az
- difficulty: medium
- skills: 2.1.k6, 2.1.s6
- concept: Aurora Serverless v2 scales database capacity in place within an ACU range, so a spiky relational workload needs no manual resizing or outage; read replicas, Multi-AZ standbys, and scheduled class changes do not
- refs: E-kien-truc-database.md, 03-database-services.md
- hint: Tải đỉnh lương gồm cả ghi, đổi instance class thì có gián đoạn — kiểu CSDL quan hệ nào tự co giãn dung lượng tại chỗ?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 115

A startup runs a multi-tenant HR application on an Amazon RDS for PostgreSQL instance sized for its monthly payroll peak. For most of the month the database is mostly idle, and during the three days around payroll its CPU saturates within minutes. Resizing the instance class causes a short outage, so the team keeps over-provisioning. The workload is relational and must stay on PostgreSQL. The company wants the database to follow demand automatically, with no outage and no manual resizing. Which solution will meet these requirements?

- A. Add read replicas to the RDS for PostgreSQL instance and use the reader endpoint to spread the payroll load across the replicas.
- B. Migrate to Amazon Aurora PostgreSQL with Aurora Serverless v2 and set a minimum and maximum capacity range in ACUs.
- C. Convert the PostgreSQL DB instance to a Multi-AZ DB instance deployment so that a standby of the same size absorbs the payroll peak.
- D. Use scheduled actions to change the class of the PostgreSQL DB instance up before the payroll days and down again afterward.

**Answer:** B

**Explanation:** Aurora Serverless v2 scales capacity in place within a configured ACU range as demand changes, with no outage and no manual resizing, and it stays PostgreSQL-compatible.
- Read replicas: add read capacity, but the payroll peak includes writes (giải bài toán khác)
- Multi-AZ standby: a standby does not serve traffic (dùng sai tính năng)
- Scheduled instance class changes: modifying the class causes an outage and needs manual timing (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.how-it-works.html
> 🇻🇳 CSDL quan hệ tải đỉnh ngắn, không muốn gián đoạn hay resize tay → Aurora Serverless v2 (tự co giãn ACU tại chỗ); read replica/Multi-AZ không giải quyết.
