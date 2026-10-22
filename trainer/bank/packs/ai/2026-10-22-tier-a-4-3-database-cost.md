---
pack: ai-2026-10-22-tier-a-4-3
title: "AI · Tầng A · Task 4.3 — Database tối ưu chi phí (RDS, Aurora, DynamoDB, DMS)"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 4.3"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 4.3"
---

# AI · Tầng A · Task 4.3 — Database tối ưu chi phí (RDS, Aurora, DynamoDB, DMS)

## Q ai-20261022-a43-01
- domain: cost
- task: 4.3
- topic: cost
- services: Cost Explorer, AWS Budgets, Organizations, Aurora, DynamoDB
- tags: tagging, cost-allocation-tags, multi-account-billing
- difficulty: medium
- time: 135
- skills: 4.3.k1, 4.3.k2
- concept: Cost allocation tags must be activated from the management account, and AWS Budgets filtered by the tag alerts on forecasted spend
- refs: 06-management-governance.md
- hint: Thẻ phân bổ chi phí chỉ kích hoạt được ở một loại tài khoản — và cảnh báo theo dự báo chi tiêu thuộc về công cụ nào?
- created: 2026-10-22
- enriched: 2026-10-22

A software company runs Amazon Aurora and Amazon DynamoDB databases for 30 applications across 14 AWS accounts in AWS Organizations. Finance wants to see database cost per application in AWS Cost Explorer and to receive an email when the forecasted database spend of an application is about to exceed its monthly limit. Engineers already tag every database resource with an application tag. Which TWO actions will meet these requirements? (Choose TWO)

- A. Activate the application tag separately in the billing console of each of the 14 member accounts.
- B. Activate the application tag as a user-defined cost allocation tag from the management account.
- C. Create an AWS Budgets cost budget for each application, filtered on the tag, with an alert when actual spend, not forecasted spend, reaches 100 percent.
- D. Create an AWS Budgets cost budget for each application, filtered on the tag, with an alert on forecasted spend.
- E. Create an AWS Cost Anomaly Detection monitor for each application tag and email finance when unusual spend appears.

**Answer:** B, D

**Explanation:** Only the management account can activate cost allocation tags, after which Cost Explorer and Budgets can group and filter by them; a tag-filtered budget can alert on forecasted spend.
- Activation in each member account: member accounts cannot manage cost allocation tags (đặt sai chỗ)
- Budget alert on actual spend: fires after the limit is reached, not when the forecast approaches it (vi phạm ràng buộc)
- Cost Anomaly Detection: flags unusual spending patterns, not a forecast against a monthly limit (giải bài toán khác)
Docs: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html
> 🇻🇳 Kích hoạt cost allocation tag ở management account, rồi dùng AWS Budgets lọc theo tag với cảnh báo dự báo.

---

## Q ai-20261022-a43-02
- domain: cost
- task: 4.3
- topic: database
- services: ElastiCache, RDS
- tags: caching-strategies, lazy-loading
- difficulty: easy
- time: 110
- skills: 4.3.k3
- concept: Lazy loading with a TTL caches only requested data, while write-through fills the cache with data that may never be read
- refs: 03-database-services.md, E-kien-truc-database.md
- hint: Bộ nhớ cache tốn tiền theo dung lượng — chiến lược nào chỉ nạp mục được đọc và cho phép dữ liệu cũ vài phút?
- created: 2026-10-22
- enriched: 2026-10-22

An online retailer's product-catalog service reads from Amazon RDS for PostgreSQL. A small share of the catalog items accounts for most reads, but the catalog has millions of items and updates arrive throughout the day. The team will put an Amazon ElastiCache cache in front of the database to reduce database load. Memory cost matters: the cache should not hold items that nobody reads, and the application can tolerate data that is a few minutes old. Which caching strategy will meet these requirements MOST cost-effectively?

- A. Use lazy loading that fills the cache on a read miss, and keep each cached item with no expiration time.
- B. Use lazy loading that fills the cache on a read miss, and give every cached item a time to live of a few minutes.
- C. Use write-through caching for every catalog update, and give every cached item a time to live of a few minutes.
- D. Use write-behind caching so that updates go to the cache first and are flushed to the database asynchronously a few minutes later.

**Answer:** B

**Explanation:** Lazy loading caches only items that are actually requested, and a short TTL keeps data from becoming too stale, so the cache stays small and inexpensive.
- Lazy loading without expiration: items stay stale after updates for as long as they are cached (vi phạm ràng buộc)
- Write-through with a TTL: every updated item is cached even if nobody reads it, which wastes memory (tốn chi phí hơn)
- Write-behind: speeds writes and risks data loss, and does not reduce database reads (giải bài toán khác)
Docs: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html
> 🇻🇳 Chỉ cache mục được đọc, chấp nhận dữ liệu cũ vài phút → lazy loading + TTL; write-through lãng phí bộ nhớ.

---

## Q ai-20261022-a43-03
- domain: cost
- task: 4.3
- topic: database
- services: DynamoDB
- tags: dynamodb-capacity, rcu-wcu
- difficulty: medium
- time: 100
- skills: 4.3.k5
- concept: DynamoDB capacity units depend on item size rounding (4 KB reads, 1 KB writes) and read consistency
- refs: 03-database-services.md
- hint: Tính RCU/WCU: làm tròn kích thước mục lên 4 KB cho đọc và 1 KB cho ghi, và đọc nhất quán cuối cùng chỉ tốn một nửa.
- created: 2026-10-22
- enriched: 2026-10-22

A telemetry service stores device records in an Amazon DynamoDB table that uses provisioned capacity mode. Each record is 6 KB. At peak, the application performs 500 reads per second, which can use eventually consistent reads, and 120 writes per second. The team wants to provision just enough capacity to avoid throttling at peak, at the lowest cost. Which provisioned throughput settings will meet these requirements?

- A. Set the table's provisioned throughput to 500 read capacity units and 720 write capacity units.
- B. Set the table's provisioned throughput to 1,000 read capacity units and 720 write capacity units.
- C. Set the table's provisioned throughput to 250 read capacity units and 120 write capacity units.
- D. Set the table's provisioned throughput to 375 read capacity units and 720 write capacity units.

**Answer:** A

**Explanation:** A 6 KB item rounds up to 8 KB (two 4 KB units) and an eventually consistent read costs half, so each read needs 1 RCU (500 total); each 6 KB write needs 6 WCUs (720 total).
- 1,000 RCUs: assumes strongly consistent reads, though eventual is allowed (tốn chi phí hơn)
- 250 RCUs and 120 WCUs: ignores item size, so peak traffic would be throttled (vi phạm ràng buộc)
- 375 RCUs: does not round the item size up to 4 KB multiples, so reads throttle (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/provisioned-capacity-mode.html
> 🇻🇳 RCU: làm tròn lên bội 4 KB (đọc cuối cùng = một nửa); WCU: làm tròn lên bội 1 KB → 500 RCU và 720 WCU.

---

## Q ai-20261022-a43-04
- domain: cost
- task: 4.3
- topic: database
- services: RDS Proxy, RDS, Lambda
- tags: connection-pooling, rds-proxy
- difficulty: medium
- time: 110
- skills: 4.3.k6
- concept: RDS Proxy pools connections so a small instance can serve many Lambda connections instead of scaling the instance up
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: CPU chỉ ~20% nhưng hết kết nối — vấn đề là số kết nối, không phải năng lực tính toán; đừng trả tiền cho instance lớn gấp đôi.
- created: 2026-10-22
- enriched: 2026-10-22

A company runs a serverless order-processing API on AWS Lambda that writes to an Amazon RDS for PostgreSQL db.r6g.4xlarge instance. During flash sales, thousands of concurrent Lambda executions open connections, and the database reaches its connection limit while CPU stays below 20%. The team plans to double the instance size to raise the connection limit, which would double the instance cost. The application code cannot be rewritten. Which solution will stop the connection errors MOST cost-effectively?

- A. Double the size of the RDS DB instance so that its connection limit rises with the larger memory that it gets.
- B. Set reserved concurrency on the Lambda function so that concurrent executions stay below the database connection limit.
- C. Create an Amazon RDS Proxy for the database and point the Lambda functions to the proxy endpoint, keeping the current instance size.
- D. Migrate the database to Amazon Aurora PostgreSQL Serverless v2 so that capacity and the connection limit scale automatically with each flash sale.

**Answer:** C

**Explanation:** RDS Proxy pools and shares database connections, so thousands of short-lived Lambda connections map to a few database connections, and most applications need only an endpoint change; the existing instance size is enough.
- Doubling the instance: pays for compute that is idle at 20% CPU (tốn chi phí hơn)
- Low reserved concurrency: turns connection errors into throttled invocations during the sale (giải bài toán khác)
- Aurora Serverless v2: a migration that pays for more capacity to get more connections (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html
> 🇻🇳 Lambda mở quá nhiều kết nối, CPU thấp → RDS Proxy (connection pooling) thay vì nâng cấp instance.

---

## Q ai-20261022-a43-05
- domain: cost
- task: 4.3
- topic: migration
- services: DMS, Aurora
- tags: heterogeneous-migration, cdc-replication, schema-conversion
- difficulty: hard
- time: 130
- skills: 4.3.k7, 4.3.s5
- concept: A heterogeneous migration needs schema and code conversion (DMS Schema Conversion) plus DMS full load and CDC for the data
- refs: 03-database-services.md, 10-migration-transfer.md
- hint: Đổi sang engine khác để bỏ phí bản quyền — dữ liệu và mã (stored procedure) cần hai công cụ khác nhau.
- created: 2026-10-22
- enriched: 2026-10-22

A logistics company runs a 4 TB Oracle database on premises, and the licensing costs more than the rest of the application. The company wants to move to a managed open-source-compatible engine on AWS to eliminate license fees. The schema has many PL/SQL stored procedures and packages. Downtime must be limited to a short cutover window, and the team wants to use managed AWS tooling. Which solution will meet these requirements?

- A. Use AWS DMS Schema Conversion to convert the schema and code to Amazon Aurora PostgreSQL, then copy the data with one full-load task at cutover.
- B. Use homogeneous data migrations in AWS DMS to move the database to Amazon RDS for Oracle under the Bring Your Own License model.
- C. Run an AWS DMS task with full load and change data capture to Amazon Aurora PostgreSQL and let the task create the tables, packages, and stored procedures.
- D. Use AWS DMS Schema Conversion to convert the schema and code to Amazon Aurora PostgreSQL, then run an AWS DMS task with full load and change data capture.

**Answer:** D

**Explanation:** Moving to a different engine needs schema and code conversion, which DMS Schema Conversion automates and reports on, and a DMS task with full load plus CDC copies the data with a short cutover.
- Full load only at cutover: copying 4 TB inside the cutover window means long downtime (vi phạm ràng buộc)
- RDS for Oracle with BYOL: keeps paying Oracle license fees (vi phạm ràng buộc)
- DMS task creating the objects: DMS creates basic tables only and does not convert stored procedures (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/dms/latest/userguide/Welcome.html
> 🇻🇳 Oracle → engine mã nguồn mở: DMS Schema Conversion (schema + code) rồi DMS full load + CDC để cutover ngắn.

---

## Q ai-20261022-a43-06
- domain: cost
- task: 4.3
- topic: database
- services: RDS
- tags: read-replicas, multi-az
- difficulty: medium
- time: 110
- skills: 4.3.k8
- concept: A read replica isolates reporting at low cost; replicas cannot be stopped and a Multi-AZ instance standby is not readable
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Muốn tách tải báo cáo rẻ nhất mà vẫn giữ failover tự động — bản dự phòng Multi-AZ có đọc được không, và replica có dừng được không?
- created: 2026-10-22
- enriched: 2026-10-22

A media-streaming company runs its subscriber database on Amazon RDS for MySQL with a Multi-AZ instance deployment. Analysts run heavy reporting queries on weekdays from 8 AM to 6 PM, and these queries slow down the production application. Reports can use data that is a few seconds old, and no reporting runs at night. The company must isolate the reporting load while keeping automatic failover, at the lowest cost. Which solution will meet these requirements?

- A. Create an RDS read replica on a smaller instance class and point the reporting tools at the replica endpoint.
- B. Create an RDS read replica and use an EventBridge schedule to stop it each evening and start it each morning.
- C. Create an RDS read replica of the same instance class, enable Multi-AZ on the replica, and point the reporting tools at it.
- D. Use scheduled modifications to scale the primary up each weekday morning and down each evening so the reports fit on it.

**Answer:** A

**Explanation:** A read replica serves reads asynchronously and takes reporting off the primary, and it can run on a smaller class to keep cost low while Multi-AZ keeps failover.
- Stopping the replica nightly: a DB instance that is a read replica cannot be stopped (cấu hình không tồn tại)
- Same-size Multi-AZ replica: isolates reports but pays for a larger replica and its standby (tốn chi phí hơn)
- Scheduled resizing of the primary: the reports still compete with the application on the same instance (giải bài toán khác)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html
> 🇻🇳 Tách báo cáo khỏi primary rẻ nhất → read replica nhỏ; replica không dừng được, standby Multi-AZ không đọc được.

---

## Q ai-20261022-a43-07
- domain: cost
- task: 4.3
- topic: database
- services: RDS, S3, Athena, AWS Backup
- tags: automated-backups, pitr, snapshots, data-retention
- difficulty: hard
- time: 145
- skills: 4.3.s1, 4.3.k4
- concept: For long retention, keep PITR for the short window and export month-end snapshots to S3 in Parquet with a Glacier lifecycle instead of keeping many snapshots
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Chỉ cần truy vấn SQL dữ liệu cũ vài lần mỗi năm, không khôi phục vào DB — có cách lưu rẻ hơn snapshot RDS giữ nhiều năm.
- created: 2026-10-22
- enriched: 2026-10-22

A company runs 50 Amazon RDS for PostgreSQL production databases. It keeps point-in-time recovery for 14 days and also keeps a daily manual snapshot of every database for seven years, although the audit rule requires only the state of each database on the last day of every month to be kept for seven years. Snapshot storage has become the largest part of the database bill. Auditors run SQL queries against old data only a few times a year and accept a one-day delay, and data older than 14 days is never restored into a running database. Which solution will meet these requirements MOST cost-effectively?

- A. Raise the automated backup retention to the maximum number of days allowed and delete the daily manual snapshots after making that change to each database.
- B. Keep 14 days of automated backups, export month-end snapshots to S3 as Parquet with a Glacier Deep Archive lifecycle rule, and delete the rest.
- C. Keep the daily manual snapshots for seven years and copy each snapshot to a second Region to improve their durability.
- D. Add the databases to an AWS Backup plan whose rule moves the RDS snapshots to cold storage and keeps them for seven years.

**Answer:** B

**Explanation:** Automated backups cover the 14-day recovery need; the audit rule needs only end-of-month data, and snapshot exports to S3 as Parquet under a Glacier Deep Archive lifecycle rule cost far less than seven years of daily snapshots and can be queried with Athena after a restore within a day, so the other manual snapshots can be deleted.
- Maximum automated retention: the setting tops out at 35 days, far below seven years (vi phạm ràng buộc)
- Daily snapshots plus a second Region: more snapshots and more storage (tốn chi phí hơn)
- AWS Backup cold storage for RDS: lifecycle to cold storage is not supported for RDS snapshots (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ExportSnapshot.html
> 🇻🇳 PITR cho 14 ngày; audit chỉ cần dữ liệu cuối tháng 7 năm → export snapshot cuối tháng sang S3 (Parquet) + Glacier Deep Archive, truy vấn bằng Athena.

---

## Q ai-20261022-a43-08
- domain: cost
- task: 4.3
- topic: database
- services: Aurora, RDS
- tags: aurora-serverless, serverless-cost, db-engine
- difficulty: medium
- time: 115
- skills: 4.3.s2, 4.3.s3, 4.3.k9
- concept: PostgreSQL extensions such as PostGIS require a PostgreSQL engine, and Aurora Serverless v2 with 0 ACUs pauses compute when idle
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Ứng dụng cần extension chỉ có ở một engine và cơ sở dữ liệu không có kết nối ban đêm — cấu hình dung lượng tối thiểu nào cho phép tạm dừng?
- created: 2026-10-22
- enriched: 2026-10-22

A regional planning agency is moving a land-use mapping application from on premises to AWS. The application uses PostgreSQL with the PostGIS extension, which MySQL does not offer. Planners use it on weekdays from 9 to 5, and the database receives no connections at night or on weekends. The agency wants a managed relational database with no commercial license fees and does not want to pay for compute while the database is idle. Which solution will meet these requirements MOST cost-effectively?

- A. Create an Amazon Aurora MySQL-Compatible cluster that uses Serverless v2 with a minimum capacity of 0 ACUs so that compute pauses when no connections arrive.
- B. Create an Amazon RDS for PostgreSQL instance on a burstable db.t4g class so that the hourly compute charge while idle stays low.
- C. Create an Amazon Aurora PostgreSQL-Compatible cluster that uses Serverless v2 with 0 ACUs as its minimum so that compute pauses without connections.
- D. Create an Amazon Aurora PostgreSQL-Compatible cluster that uses Serverless v2 with a minimum capacity of 0.5 ACUs so that compute scales down overnight.

**Answer:** C

**Explanation:** Aurora PostgreSQL supports PostGIS and has no license fees, and Serverless v2 with a minimum of 0 ACUs pauses after inactivity, so compute is not billed overnight or on weekends.
- Aurora MySQL: lacks the PostGIS extension the application needs (vi phạm ràng buộc)
- Burstable RDS for PostgreSQL instance: cheap per hour, but still billed for compute while idle (tốn chi phí hơn)
- Minimum of 0.5 ACUs: capacity never pauses, so compute is billed continuously (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html
> 🇻🇳 Cần PostGIS (PostgreSQL), nhàn rỗi ban đêm → Aurora PostgreSQL Serverless v2 với min 0 ACU (tự tạm dừng).

---

## Q ai-20261022-a43-09
- domain: cost
- task: 4.3
- topic: database
- services: Timestream, Redshift, DynamoDB, Aurora, ElastiCache, RDS
- tags: columnar-formats, time-series, purpose-built-database
- difficulty: hard
- time: 155
- skills: 4.3.s4, 4.3.k9
- concept: Time series data fits a time series database and wide scans over few columns fit columnar storage such as Redshift
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Hai khối lượng công việc khác bản chất trên một RDS quá lớn — một dạng theo chuỗi thời gian, một dạng quét ít cột trên hàng tỷ dòng.
- created: 2026-10-22
- enriched: 2026-10-22

A smart-building company runs two workloads on one large Amazon RDS for PostgreSQL instance. The first stores readings from 40,000 sensors written every second, which are queried in time windows with downsampling and interpolation. The second holds five years of billing records, billions of rows, that analysts aggregate over a few columns for monthly reports. The instance is oversized and expensive. The company will move each workload to the most cost-effective purpose-built database type, using built-in functions rather than custom code. Which TWO actions should a solutions architect take? (Choose TWO)

- A. Store the sensor readings in Amazon Timestream for InfluxDB, a managed InfluxDB engine for time series data.
- B. Store the sensor readings in Amazon Keyspaces with the sensor ID as the partition key and query time ranges with CQL.
- C. Load the billing records into Amazon Redshift Serverless and run the monthly reports there.
- D. Load the billing records into Amazon Aurora MySQL and run the monthly aggregations with Aurora parallel query.
- E. Index the billing records in Amazon OpenSearch Service and run the monthly reports with its aggregation queries.

**Answer:** A, C

**Explanation:** Timestream for InfluxDB is purpose-built for time series with native windowing, downsampling and interpolation, and Redshift's columnar storage reads only the needed columns for large aggregations, with Serverless billing only for active use.
- Keyspaces for readings: scales writes, but offers no built-in downsampling or interpolation functions (vi phạm ràng buộc)
- Aurora MySQL with parallel query: faster scans on row storage, but a costlier fit than a columnar warehouse for few-column aggregates over billions of rows (tốn chi phí hơn)
- OpenSearch aggregations: a search engine is a costly store for five years of billing rows (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/redshift/latest/dg/c_columnar_storage_disk_mem_mgmnt.html
> 🇻🇳 Chuỗi thời gian → time series DB (Timestream for InfluxDB); quét ít cột trên hàng tỷ dòng → Redshift (columnar).

---

## Q ai-20261022-a43-10
- domain: cost
- task: 4.3
- topic: database
- services: DynamoDB, DAX
- tags: dynamodb-capacity, scaling-policies, serverless-cost
- difficulty: medium
- time: 105
- skills: 4.3.k5, 4.3.s3
- family: ddb-capacity-mode
- concept: Provisioned capacity with auto scaling and scheduled scaling is cheapest for steady, high-utilization traffic with known spikes
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Tải ghi ổn định ở mức cao và đỉnh biết trước theo giờ — chế độ nào có giá đơn vị thấp hơn khi mức sử dụng cao và ổn định?
- created: 2026-10-22
- enriched: 2026-10-22

A ticketing company is launching a new Amazon DynamoDB table for order history. A load test shows that writes hold at about 4,000 per second for most of the day. Twice a day, announced sales raise writes to about twice that rate for roughly 20 minutes, and the sale times are known in advance. Traffic never exceeds twice the previous peak, and the company can change the table's capacity mode at any time. Which solution will meet these requirements MOST cost-effectively?

- A. Use on-demand capacity mode so that DynamoDB scales automatically with each request and no capacity is set.
- B. Use provisioned capacity mode with target tracking auto scaling and no scheduled actions, so that capacity rises after each sale begins.
- C. Use on-demand capacity mode and set a DynamoDB maximum write throughput on the table at the level of the sale peak.
- D. Use provisioned capacity mode with auto scaling for the baseline and scheduled scaling actions before each sale.

**Answer:** D

**Explanation:** For steady, highly utilized traffic the provisioned unit price is lower than per-request on-demand pricing; auto scaling tracks the baseline and scheduled actions raise capacity before each sale without throttling.
- On-demand mode: per-request pricing costs more than provisioned units at steady high utilization (tốn chi phí hơn)
- Auto scaling alone: reacts only after each sale starts, so writes throttle during the 20-minute peak although its time is known (dùng sai tính năng)
- On-demand with a maximum throughput setting: caps runaway spend but keeps per-request pricing for the steady load (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/provisioned-capacity-mode.html
> 🇻🇳 Tải ghi ổn định + đỉnh biết trước → provisioned + auto scaling + scheduled scaling rẻ nhất.

---

## Q ai-20261022-a43-11
- domain: cost
- task: 4.3
- topic: database
- services: DynamoDB, DAX
- tags: dynamodb-capacity, scaling-policies, serverless-cost
- difficulty: medium
- time: 110
- skills: 4.3.k5, 4.3.s3
- family: ddb-capacity-mode
- concept: On-demand capacity mode has no capacity to manage and absorbs spikes up to double the previous peak
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Cùng tình huống nhưng tiêu chí là ít công vận hành nhất — chế độ nào không có cài đặt dung lượng hay chính sách scaling để duy trì?
- created: 2026-10-22
- enriched: 2026-10-22

A ticketing company is launching a new Amazon DynamoDB table for order history. A load test shows that writes hold at about 4,000 per second for most of the day. Twice a day, announced sales raise writes to about twice that rate for roughly 20 minutes, and the sale times are known in advance. Traffic never exceeds twice the previous peak, and the company can change the table's capacity mode at any time. Which solution will meet these requirements with the LEAST operational overhead?

- A. Use on-demand capacity mode so that DynamoDB scales automatically with each request and no capacity is set.
- B. Use provisioned capacity mode with target tracking auto scaling and no scheduled actions, so that capacity rises after each sale begins.
- C. Use on-demand capacity mode and set a DynamoDB maximum write throughput on the table at the level of the sale peak.
- D. Use provisioned capacity mode with auto scaling for the baseline and scheduled scaling actions before each sale.

**Answer:** A

**Explanation:** On-demand mode has no capacity settings, policies or schedules to maintain, and it instantly absorbs traffic up to double the previous peak, so the sales need no preparation.
- Auto scaling alone: a policy to tune that still lags each sale and lets writes throttle (tốn vận hành hơn)
- On-demand with a maximum throughput setting: an extra limit to size and revise as traffic grows (tốn vận hành hơn)
- Auto scaling with scheduled actions: policies and schedules to configure and keep current (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode.html
> 🇻🇳 Ít vận hành nhất → on-demand (không có dung lượng để quản lý, hấp thụ đỉnh tới gấp đôi đỉnh trước).

---

## Q ai-20261022-a43-12
- domain: cost
- task: 4.3
- topic: database
- services: Aurora, RDS
- tags: aurora-io-optimized, savings-plans, rds-extended-support
- difficulty: hard
- time: 170
- skills: 4.3.s3, 4.3.k9
- concept: Aurora I/O-Optimized for I/O-heavy clusters, upgrading past RDS Extended Support, and Database Savings Plans for flexible steady-state commitments
- refs: 03-database-services.md, F-so-sanh-database-theo-dac-diem.md
- hint: Ba nguồn chi phí khác nhau: phí I/O của Aurora, phí hỗ trợ mở rộng của phiên bản cũ, và nhu cầu cam kết linh hoạt cho tải ổn định.
- created: 2026-10-22
- enriched: 2026-10-22

A SaaS company runs 30 Amazon Aurora MySQL provisioned clusters and 20 Amazon RDS for MySQL 5.7 instances in production. A cost review found that read and write I/O charges are about 40% of the Aurora spend, that the RDS for MySQL 5.7 instances show a monthly Extended Support charge, and that instance usage has been steady for two years. The company will commit for one year with no upfront payment but must stay free to change engines, instance families, and Regions. Which THREE actions will meet these requirements and reduce database cost the MOST? (Choose THREE)

- A. Change the Aurora clusters to the Aurora I/O-Optimized configuration so that read and write I/O are no longer billed.
- B. Upgrade the RDS for MySQL 5.7 instances to MySQL 8.0 and stop at that version to end the database Extended Support charge.
- C. Purchase Database Savings Plans with a one-year term and no upfront payment to cover the steady database instance usage.
- D. Purchase three-year All Upfront Reserved Instances for the RDS and Aurora instances that serve read and write traffic, paying the full payment now for steady usage.
- E. Upgrade the RDS for MySQL 5.7 instances through MySQL 8.0 to MySQL 8.4, a major version that is in standard support.
- F. Convert the Aurora clusters to Serverless v2 with a minimum capacity of 0 ACUs so that idle database capacity is not billed.

**Answer:** A, C, E

**Explanation:** I/O-Optimized removes I/O charges when I/O is a large share of Aurora spend, a version in standard support ends Extended Support fees, and Database Savings Plans give a flexible one-year no-upfront discount.
- Stopping at MySQL 8.0: that version is itself in Extended Support now (tốn chi phí hơn)
- Three-year All Upfront Reserved Instances: upfront payment and lock-in to engine and family (vi phạm ràng buộc)
- Serverless v2 with 0 ACUs: pausing saves nothing on steady usage (giải bài toán khác)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/extended-support-charges.html
> 🇻🇳 I/O-Optimized khi phí I/O cao; nâng cấp lên phiên bản còn standard support; Database Savings Plans cho tải ổn định, linh hoạt.
