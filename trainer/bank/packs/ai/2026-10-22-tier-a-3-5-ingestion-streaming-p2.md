---
pack: ai-2026-10-22-tier-a-3-5-p2
title: "AI · Tầng A · Task 3.5 — Data lake, chuyển đổi và truyền tải dữ liệu"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 3.5"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 3.5: Lake Formation, Athena/Parquet, Glue, DataSync, Storage Gateway, EMR, Amazon Quick, AppFlow, mẫu thu thập theo tần suất"
---

# AI · Tầng A · Task 3.5 — Data lake, chuyển đổi và truyền tải dữ liệu

## Q ai-20261022-a35-11
- domain: performance
- task: 3.5
- topic: analytics
- services: Glue, S3
- tags: etl, columnar-formats
- difficulty: medium
- skills: 3.5.k4, 3.5.s7
- concept: Glue job bookmarks track already processed input so scheduled jobs process only new files
- refs: 09-analytics-bigdata.md
- hint: Mỗi lần chạy đều đọc lại toàn bộ file cũ — tính năng nào của Glue job nhớ dữ liệu đã xử lý ở các lần chạy trước?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 115

A data engineering team runs an AWS Glue Spark job every hour to convert newly arrived CSV files in an S3 prefix to Parquet. Each run reads every file in the prefix, so run time and cost keep growing, and the Parquet output contains duplicate rows. The team wants each run to process only the files that arrived since the previous successful run, without writing custom tracking code. Which solution will meet these requirements?

- A. Increase the number of workers and use a larger worker type so that each run finishes well before the next scheduled run starts
- B. Configure the Glue crawler to recrawl just the new folders so that the job reads the new partitions that the crawler adds to the table
- C. Rewrite the job as a Python shell job that deletes the source files after they are converted so that later runs skip them
- D. Turn on job bookmarks for the Glue job so that it remembers which input files the earlier runs already read

**Answer:** D

**Explanation:** Job bookmarks persist state about the input a job has processed, so each scheduled run reads only new data and does not write the same rows again.
- More or larger workers: finishes sooner but still reprocesses every file and duplicates output (giải bài toán khác)
- Crawler recrawl of new folders: updates the Data Catalog and does not limit what the job reads (dùng sai tính năng)
- Python shell job that deletes sources: custom code, risks data loss, and does not scale for large files (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/glue/latest/dg/monitor-continuations.html
> 🇻🇳 Job Glue chạy định kỳ chỉ xử lý file mới → bật job bookmarks.

---

## Q ai-20261022-a35-12
- domain: performance
- task: 3.5
- topic: analytics
- services: Lake Formation, Glue, Athena, S3, RAM
- tags: data-lake, least-privilege, cross-account-access
- difficulty: hard
- skills: 3.5.s1, 3.5.k1
- concept: Lake Formation provides central column and row-level permissions with data filters and cross-account sharing of Data Catalog tables
- refs: 09-analytics-bigdata.md
- hint: Phân quyền theo cột và theo hàng, chia sẻ bảng cho tài khoản khác, quản lý tập trung — không viết bucket policy cho từng người.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 170

A healthcare research company keeps de-identified patient data in an Amazon S3 data lake that is cataloged in the AWS Glue Data Catalog. Analysts in three departments query it with Amazon Athena. Each department must see only its own columns, regional managers must see only the rows for their region, and a partner university in another AWS account needs read access to a few tables. The company wants central, auditable permission management and does not want to maintain per-user S3 bucket policies. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create an IAM policy for each analyst that limits the permissions on S3 object prefixes by department and add a bucket policy for the partner account that owns the catalog tables
- B. Register the S3 location with AWS Lake Formation and grant column-level permissions and row filters on the Data Catalog tables to the department roles
- C. Share the Data Catalog tables with the partner account by using Lake Formation cross-account grants, which use AWS RAM for the share
- D. Create a separate S3 bucket for each department and run Glue jobs that copy the permitted columns and rows of the catalog tables into it
- E. Enable Amazon Macie on the data lake so that it hides sensitive columns from the analysts who are not allowed to see them

**Answer:** B, C

**Explanation:** Lake Formation enforces permissions at column, row, and cell level for Athena and other engines, and its cross-account grants share Data Catalog tables through AWS RAM, all managed and audited in one place.
- Per-analyst IAM and bucket policies: cannot filter columns or rows and are hard to audit (vi phạm ràng buộc)
- Separate buckets with copy jobs: duplicates data and adds jobs to maintain (tốn vận hành hơn)
- Macie: discovers sensitive data but does not enforce access (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/lake-formation/latest/dg/what-is-lake-formation.html
> 🇻🇳 Data lake phân quyền cột/hàng + chia sẻ chéo tài khoản, tập trung → Lake Formation (data filter + cross-account grant).

---

## Q ai-20261022-a35-13
- domain: performance
- task: 3.5
- topic: migration
- services: DataSync, S3, Direct Connect, VPC Endpoint
- tags: offline-transfer
- difficulty: medium
- skills: 3.5.k3, 3.5.s3, 3.5.k5
- concept: DataSync with an agent activated through a VPC endpoint and a scheduled task copies NFS data to S3 privately over Direct Connect with verification
- refs: 10-migration-transfer.md
- hint: Đã có Direct Connect, dữ liệu không được đi qua internet, cần đồng bộ thay đổi hằng ngày và kiểm tra toàn vẹn — dịch vụ chuyển dữ liệu nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 125

A video-production company has 90 TB of finished footage on an on-premises NFS file server and adds about 200 GB each day. The footage must be copied to Amazon S3 with file metadata and integrity verification, and the daily changes must keep syncing during a six-month transition. The company has an AWS Direct Connect connection with a private virtual interface, and security does not allow the data to cross the public internet. The team wants the LEAST operational overhead. Which solution will meet these requirements?

- A. Deploy a DataSync agent on premises, activate it through a VPC interface endpoint, and create a task from the NFS server to S3 that runs daily with verification
- B. Write scripts that run aws s3 sync from the NFS server over the public S3 endpoint as a daily job and verify the checksums of the copied files after each run
- C. Deploy an S3 File Gateway on premises and ask the editors to move the existing footage into its NFS file interface over several weeks while new files keep arriving
- D. Create an AWS Transfer Family SFTP server and run a nightly cron job on the file server that uploads the new and changed files over SFTP with a verification step

**Answer:** A

**Explanation:** DataSync copies from NFS to S3 with metadata and verification and runs incremental scheduled tasks. With an interface endpoint, agent traffic stays on Direct Connect and the AWS network, not the internet.
- Scripted s3 sync over the public endpoint: crosses the internet and is custom code (vi phạm ràng buộc)
- S3 File Gateway: built for ongoing hybrid file access, and the bulk move depends on manual copying (tốn vận hành hơn)
- Transfer Family with cron uploads: custom scripting and no built-in metadata verification (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/datasync/latest/userguide/datasync-network.html
> 🇻🇳 Đồng bộ NFS → S3 định kỳ, riêng tư qua Direct Connect, có kiểm tra toàn vẹn → DataSync (agent + VPC endpoint).

---

## Q ai-20261022-a35-14
- domain: performance
- task: 3.5
- topic: analytics
- services: Athena, S3, Glue
- tags: columnar-formats, data-lake
- difficulty: medium
- skills: 3.5.k1, 3.5.s7, 3.5.s1
- concept: Converting CSV to Parquet and partitioning by the filter column cuts the data Athena scans, lowering cost and runtime
- refs: 09-analytics-bigdata.md
- hint: Truy vấn luôn lọc theo ngày và chỉ đọc vài cột — hai thay đổi bố cục dữ liệu nào làm Athena quét ít byte hơn?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A marketing team stores 4 TB of gzip-compressed CSV clickstream files per day under a single S3 prefix. Analysts run Amazon Athena queries that nearly always filter on the event date and read only a few of the 60 columns. Queries are slow, and Athena charges are growing. The team wants to cut query cost and runtime without substantially changing the analysts' SQL. Which combination of actions will meet these requirements MOST cost-effectively? (Choose TWO)

- A. Load the clickstream files into an Amazon Redshift cluster and ask the analysts to run their event date filter queries there instead of in Athena
- B. Convert the files to Apache Parquet by using an AWS Glue ETL job and register the new table in the Data Catalog
- C. Split the files into many small objects under the same prefixes so that Athena can read more of them in parallel during each query
- D. Turn on Athena provisioned capacity for the workgroup so that the queries have dedicated processing capacity around the clock
- E. Partition the converted data by event date by using Hive-style prefixes so that queries read just the dates they filter on

**Answer:** B, E

**Explanation:** Athena charges by data scanned. Parquet is columnar, so queries read only the needed columns, and date partitions let a query skip every other day, which cuts cost and runtime with the same SQL.
- Redshift cluster: adds a warehouse to run and load, which is more cost than needed (tốn chi phí hơn)
- Many small objects: increases request overhead and slows queries (dùng sai tính năng)
- Provisioned capacity: adds a fixed charge and does not reduce the data scanned (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/athena/latest/ug/columnar-storage.html
> 🇻🇳 Giảm chi phí Athena: chuyển CSV sang Parquet (cột) và partition theo ngày để quét ít dữ liệu hơn.

---

## Q ai-20261022-a35-15
- domain: performance
- task: 3.5
- topic: storage
- services: Storage Gateway, DataSync, S3, Transfer Family
- tags: sgw-volume-modes
- difficulty: hard
- skills: 3.5.k3, 3.5.k2, 3.5.s3
- concept: S3 File Gateway ingests continuously written SMB or NFS files to S3 within minutes with a local cache; DataSync schedules run at one-hour intervals at the shortest
- refs: 10-migration-transfer.md
- hint: Tệp phải lên S3 trong vài phút và nhân viên vẫn đọc nhanh tệp gần đây tại chỗ — lịch DataSync ngắn nhất là bao lâu?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 125

A genomics lab's sequencers write result files to an SMB share on an on-premises Windows server. The files must appear in Amazon S3 within minutes so that analysts can start Amazon Athena and Amazon EMR jobs, while lab staff keep opening recent files locally with low latency. The sequencer software cannot be changed, and the server has limited disk space. Which solution will meet these requirements?

- A. Schedule an AWS DataSync task at the shortest supported interval to copy new files from the SMB share to the S3 bucket for the analysts
- B. Mount an Amazon EFS file system on the sequencers and use AWS DataSync to copy the result files from EFS to the S3 bucket
- C. Deploy an S3 File Gateway on premises, create an SMB file share backed by the bucket, and point the sequencers at the share
- D. Deploy an AWS Transfer Family SFTP server and have lab staff upload the result files from the Windows server each hour by hand

**Answer:** C

**Explanation:** S3 File Gateway presents an SMB share, uploads each written file to S3 in the background, and keeps recently used data in a local cache, so the sequencers need no change and the server needs little disk.
- DataSync on a schedule: the shortest schedule interval is one hour, longer than minutes (vi phạm ràng buộc)
- EFS mounted on the sequencers: the sequencer software cannot be changed to use it (vi phạm ràng buộc)
- Transfer Family with hourly manual uploads: manual work and hourly delay (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/datasync/latest/userguide/task-scheduling.html
> 🇻🇳 File ghi liên tục lên S3 trong vài phút + cache cục bộ → S3 File Gateway; DataSync có lịch tối thiểu 1 giờ.

---

## Q ai-20261022-a35-16
- domain: performance
- task: 3.5
- topic: analytics
- services: EMR, S3, EC2
- tags: spot-instances, etl
- difficulty: hard
- skills: 3.5.s5, 3.5.k1
- concept: A transient EMR cluster with On-Demand primary and core nodes and Spot task nodes is the cost-effective, HDFS-safe layout for fault-tolerant nightly Spark jobs
- refs: 09-analytics-bigdata.md
- hint: Mất dữ liệu HDFS buộc chạy lại từ đầu — node loại nào được phép dùng Spot và cụm nên tồn tại bao lâu?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A genomics company runs a Spark job every night on 30 TB of data in Amazon S3. The job needs custom native libraries installed on every node and Spark settings tuned by the engineers. It runs for about four hours, individual task failures are retried automatically, but losing the intermediate data stored in HDFS would force the job to restart from the beginning, which the company cannot afford. Nothing runs between nightly jobs. Which solution will meet these requirements MOST cost-effectively?

- A. Keep a long-running Amazon EMR cluster on On-Demand Instances that is sized for the nightly peak and run the job on it every night with the libraries installed once
- B. Launch a transient EMR cluster each night with On-Demand primary and core nodes and Spot task nodes, add the libraries with bootstrap actions, and shut it down
- C. Launch a transient EMR cluster each night with the primary, core, and task nodes on Spot Instances to get the lowest hourly price for the cluster
- D. Rewrite the job as Amazon Athena SQL queries that run against the data in S3 and keep the custom libraries and the tuned settings in the query configuration

**Answer:** B

**Explanation:** A transient cluster avoids idle cost, task nodes hold no HDFS data so Spot interruptions only retry tasks, and On-Demand core nodes protect the intermediate data. Bootstrap actions install the native libraries.
- Long-running On-Demand cluster: pays for idle hours between jobs (tốn chi phí hơn)
- All-Spot cluster: losing core nodes can destroy HDFS data and restart the job (vi phạm ràng buộc)
- Athena SQL: cannot run Spark code with native libraries and custom Spark settings (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-plan-instances-guidelines.html
> 🇻🇳 Spark batch hằng đêm: cụm EMR tạm thời, primary + core On-Demand, task node Spot (không giữ HDFS).

---

## Q ai-20261022-a35-17
- domain: performance
- task: 3.5
- topic: analytics
- services: QuickSight, Athena, S3
- tags: data-lake
- difficulty: medium
- skills: 3.5.s4, 3.5.k1
- concept: Amazon Quick datasets on Athena with SPICE and row-level security via a permissions dataset give serverless dashboards restricted per region
- refs: 09-analytics-bigdata.md
- hint: Dashboard tương tác, mỗi quản lý chỉ thấy vùng của mình, không muốn quản lý server BI — dịch vụ BI serverless nào có row-level security?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 105

A retail company stores sales data in Amazon S3 and queries it with Amazon Athena. Executives need interactive dashboards that respond quickly to filtering, regional managers must see only the rows for their own region, and the dashboards must open in a web browser without VPN software. The company does not want to manage BI servers. Which solution will meet these requirements?

- A. Deploy an open-source dashboard tool on EC2 instances that queries Athena and give each manager a separate dashboard for the region of that manager
- B. Create an Amazon OpenSearch Service domain, index the sales data, and use OpenSearch Dashboards with a separate role for each region of the company
- C. Export Athena query results to CSV files each week and let the managers filter the files in spreadsheets that are stored in S3 for them
- D. Create an Amazon Quick dataset on the Athena data source, load it into SPICE, and apply row-level security with a permissions dataset for the regions

**Answer:** D

**Explanation:** Amazon Quick (Quick Sight) is a serverless BI service. SPICE keeps the data in memory for fast filtering, and row-level security with a permissions dataset limits each user to the rows of a region.
- Open-source tool on EC2: servers to patch and scale, which the company wants to avoid (tốn vận hành hơn)
- OpenSearch Dashboards: built for search and log analytics, and needs indexing of the data (giải bài toán khác)
- Weekly CSV exports: not interactive and gives no row-level control (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/quicksight/latest/user/restrict-access-to-a-data-set-using-row-level-security.html
> 🇻🇳 BI serverless trên Athena + RLS theo vùng → Amazon Quick (Quick Sight) với SPICE và permissions dataset.

---

## Q ai-20261022-a35-18
- domain: performance
- task: 3.5
- topic: integration
- services: AppFlow, S3, Athena, Lambda, DMS, MSK, Secrets Manager
- tags: etl, columnar-formats
- difficulty: medium
- skills: 3.5.k2, 3.5.k3, 3.5.s6
- concept: Amazon AppFlow ingests SaaS data such as Salesforce into S3 on a schedule with filters and Parquet output and no code
- refs: 07-application-integration.md
- hint: Nguồn là ứng dụng SaaS, không có lập trình viên, cần lịch chạy, bộ lọc và định dạng Parquet — dịch vụ tích hợp nào không cần code?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 115

A company's sales team keeps opportunity and account data in Salesforce. Data engineers must load both objects into an Amazon S3 data lake every night, filter out closed-lost opportunities, and store the output in Parquet so that Amazon Athena queries are efficient. No developers are available to build API integrations, and the team wants the LEAST operational overhead. Which solution will meet these requirements?

- A. Create an Amazon AppFlow flow from Salesforce to S3 with a daily schedule trigger, a filter on opportunity status, and Parquet as the output format
- B. Write a Lambda function that calls the Salesforce API every night, drops closed-lost opportunity records, keeps credentials in Secrets Manager, and writes the output as Parquet files to S3
- C. Create an AWS DMS task with Salesforce as the source endpoint and a table filter for opportunity status, with S3 as the target, and run it every night
- D. Deploy an Amazon MSK cluster with a Kafka Connect Salesforce source connector and an S3 sink connector that writes the output as Parquet files

**Answer:** A

**Explanation:** AppFlow is a managed integration service with Salesforce connectors, schedule triggers, filters, and Parquet output to S3, so no integration code or servers are needed.
- Lambda function with the Salesforce API: custom code, credentials, and Parquet handling to maintain (tốn vận hành hơn)
- DMS with Salesforce as source: DMS migrates databases and has no Salesforce endpoint (cấu hình không tồn tại)
- MSK with Kafka Connect: a cluster and connectors to build and run for a nightly load (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/appflow/latest/userguide/what-is-appflow.html
> 🇻🇳 Đưa dữ liệu SaaS (Salesforce) vào S3 theo lịch, có lọc, Parquet, không code → Amazon AppFlow.

---

## Q ai-20261022-a35-19
- domain: performance
- task: 3.5
- topic: analytics
- services: Glue, EventBridge, S3, Kinesis Data Streams, Managed Apache Flink, MSK, EMR
- tags: etl, streaming-ingestion
- difficulty: easy
- skills: 3.5.k2, 3.5.s6
- concept: A once-a-day file calls for event-driven batch ETL, not an always-on streaming pipeline
- refs: 09-analytics-bigdata.md
- hint: Một file lớn mỗi đêm — tần suất thu thập này hợp với xử lý theo lô theo sự kiện hay với luồng chạy liên tục 24/7?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 100

A bank receives one 40 GB CSV settlement file in an Amazon S3 bucket every night between 01:00 and 03:00. The data lake must contain the data in Parquet format by 06:00. Analysts do not need the data at any other time of day. The company wants the MOST cost-effective ingestion design. Which solution will meet these requirements?

- A. Send the rows of the file to a Kinesis data stream and process them continuously with an Amazon Managed Service for Apache Flink application
- B. Publish the rows of the file to an Amazon MSK cluster and use an MSK Connect S3 sink connector to write Parquet files to the lake
- C. Create an Amazon EventBridge rule for the S3 object-created event that starts an AWS Glue workflow, which converts the file to Parquet
- D. Keep an Amazon EMR cluster running around the clock that polls the bucket every minute and converts each new file to Parquet

**Answer:** C

**Explanation:** The data arrives as one file per night, so an event-driven batch job pays only for the minutes it runs, and finishes well before the deadline.
- Kinesis with Flink: an always-on streaming application for one daily file (tốn chi phí hơn)
- MSK with MSK Connect: a running cluster and connector for one daily file (tốn chi phí hơn)
- EMR cluster running all day with polling: pays for 24 hours of capacity for one conversion (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/glue/latest/dg/starting-workflow-eventbridge.html
> 🇻🇳 Một file mỗi đêm → xử lý theo lô kích hoạt bằng sự kiện (EventBridge + Glue), không dùng streaming chạy liên tục.
