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
- time: 115
- skills: 3.5.k4, 3.5.s7
- concept: Glue job bookmarks track already processed input so scheduled jobs process only new files
- refs: 09-analytics-bigdata.md
- hint: Mỗi lần chạy đều đọc lại toàn bộ file cũ — tính năng nào của Glue job nhớ dữ liệu đã xử lý ở các lần chạy trước?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A data engineering team runs an AWS Glue Spark job every hour to convert newly arrived CSV files in an S3 prefix to Parquet. Each run reads every file in the prefix, so run time and cost keep growing, and the Parquet output contains duplicate rows. The team wants each run to process only the files that arrived since the previous successful run, without writing custom tracking code. Which solution will meet these requirements?

- A. Start the Glue job from S3 object-created events through EventBridge so that each run begins as soon as new files arrive
- B. Turn on Auto Scaling for the Glue job so that the number of workers matches the amount of input data in each run
- C. Add a pushdown predicate on the date partition to the job script so that each run reads just the current day's partition
- D. Turn on job bookmarks for the Glue job so that it remembers which input files the earlier runs already read

**Answer:** D

**Explanation:** Job bookmarks persist state about the input a job has processed, so each scheduled run reads only new data and does not write the same rows again.
- Event-driven starts: runs sooner, but each run still reads every file in the prefix (giải bài toán khác)
- Glue Auto Scaling: sizes workers to the input, but still reprocesses old files and duplicates rows (giải bài toán khác)
- Pushdown predicate on the day: hourly runs still reread the day's earlier files, and the filter is code to maintain (vi phạm ràng buộc)
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
- time: 170
- skills: 3.5.s1, 3.5.k1
- concept: Lake Formation provides central column and row-level permissions with data filters and cross-account sharing of Data Catalog tables
- refs: 09-analytics-bigdata.md
- hint: Phân quyền theo cột và theo hàng, chia sẻ bảng cho tài khoản khác, quản lý tập trung — không viết bucket policy cho từng người.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A healthcare research company keeps de-identified patient data in an Amazon S3 data lake that is cataloged in the AWS Glue Data Catalog. Analysts in three departments query it with Amazon Athena. Each department must see only its own columns, regional managers must see only the rows for their region, and a partner university in another AWS account needs read access to a few tables. The company wants central, auditable permission management and does not want to maintain per-user S3 bucket policies. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create an Athena workgroup for each department with IAM permissions on Data Catalog views that select each department's permitted columns and rows for its analysts
- B. Register the S3 location with AWS Lake Formation and grant column-level permissions and row filters on the Data Catalog tables to the department roles
- C. Share the Data Catalog tables with the partner account by using Lake Formation cross-account grants, which use AWS RAM for the share
- D. Add a bucket policy that grants the partner account read access to the data lake prefixes and let it crawl the tables itself
- E. Register the S3 location with Lake Formation and grant the department roles SELECT on whole tables through LF-Tag expressions

**Answer:** B, C

**Explanation:** Lake Formation enforces permissions at column, row, and cell level for Athena and other engines, and its cross-account grants share Data Catalog tables through AWS RAM, all managed and audited in one place.
- Athena workgroups with views: views do not stop direct table or S3 access, so they are not central permission control (dùng sai tính năng)
- Bucket policy for the partner: grants raw S3 access outside central, table-level permissions (vi phạm ràng buộc)
- Whole-table grants through LF-Tags: central, but with no column or row restriction (vi phạm ràng buộc)
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
- time: 125
- skills: 3.5.k3, 3.5.s3, 3.5.k5
- concept: DataSync with an agent activated through a VPC endpoint and a scheduled task copies NFS data to S3 privately over Direct Connect with verification
- refs: 10-migration-transfer.md
- hint: Đã có Direct Connect, dữ liệu không được đi qua internet, cần đồng bộ thay đổi hằng ngày và kiểm tra toàn vẹn — dịch vụ chuyển dữ liệu nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A video-production company has 90 TB of finished footage on an on-premises NFS file server and adds about 200 GB each day. The footage must be copied to Amazon S3 with file metadata and integrity verification, and the daily changes must keep syncing during a six-month transition. The company has an AWS Direct Connect connection with a private virtual interface, and security does not allow the data to cross the public internet. The team wants the LEAST operational overhead. Which solution will meet these requirements?

- A. Deploy a DataSync agent on premises, activate it through a VPC interface endpoint, and create a daily task from the NFS server to S3 with verification
- B. Deploy a DataSync agent on premises, activate it through a public service endpoint, and create a daily task from the NFS server to S3 with verification
- C. Deploy an S3 File Gateway on premises and copy the footage into its NFS file share with a scheduled rsync job that runs every night
- D. Create an AWS Transfer Family SFTP server with an internal VPC interface endpoint reached over Direct Connect and run a nightly upload job on the file server

**Answer:** A

**Explanation:** DataSync copies from NFS to S3 with metadata and verification and runs incremental scheduled tasks. With an interface endpoint, agent traffic stays on Direct Connect and the AWS network, not the internet.
- DataSync with a public service endpoint: the transfer traffic goes to public endpoints over the internet (vi phạm ràng buộc)
- File Gateway with rsync: scripted copies to maintain, with no built-in transfer verification (tốn vận hành hơn)
- Transfer Family over Direct Connect: private, but change detection, uploads, and verification are custom scripting (tốn vận hành hơn)
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
- time: 140
- skills: 3.5.k1, 3.5.s7, 3.5.s1
- concept: Converting CSV to Parquet and partitioning by the filter column cuts the data Athena scans, lowering cost and runtime
- refs: 09-analytics-bigdata.md
- hint: Truy vấn luôn lọc theo ngày và chỉ đọc vài cột — hai thay đổi bố cục dữ liệu nào làm Athena quét ít byte hơn?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A marketing team stores 4 TB of gzip-compressed CSV clickstream files per day under a single S3 prefix. Analysts run Amazon Athena queries that nearly always filter on the event date and read only a few of the 60 columns. Queries are slow, and Athena charges are growing. The team wants to cut query cost and runtime without substantially changing the analysts' SQL. Which combination of actions will meet these requirements MOST cost-effectively? (Choose TWO)

- A. Convert the files to Apache Avro by using an AWS Glue ETL job and register the new Avro table in the AWS Glue Data Catalog
- B. Convert the files to Apache Parquet by using an AWS Glue ETL job and register the new table in the Data Catalog
- C. Turn on Athena query result reuse for the workgroup so that queries with the same day filters are answered from earlier results
- D. Recompress the CSV files with Snappy instead of gzip so that Athena can decompress and scan them faster
- E. Partition the converted data by day with Hive-style folders so that each query reads just the days that it filters on

**Answer:** B, E

**Explanation:** Athena charges by data scanned. Parquet is columnar, so queries read only the needed columns, and date partitions let a query skip every other day, which cuts cost and runtime with the same SQL.
- Apache Avro: a row-based format, so queries still read every column (dùng sai tính năng)
- Query result reuse: returns cached results only for identical repeated queries (giải bài toán khác)
- Snappy-compressed CSV: still a row format, so every column is scanned (dùng sai tính năng)
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
- time: 125
- skills: 3.5.k3, 3.5.k2, 3.5.s3
- concept: S3 File Gateway ingests continuously written SMB or NFS files to S3 within minutes with a local cache; DataSync schedules run at one-hour intervals at the shortest
- refs: 10-migration-transfer.md
- hint: Tệp phải lên S3 trong vài phút và nhân viên vẫn đọc nhanh tệp gần đây tại chỗ — lịch DataSync ngắn nhất là bao lâu?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A genomics lab's sequencers write result files to an SMB share on an on-premises Windows server. The files must appear in Amazon S3 within minutes so that analysts can start Amazon Athena and Amazon EMR jobs, while lab staff keep opening recent files locally with low latency. The sequencer software cannot be changed, and the server has limited disk space. Which solution will meet these requirements?

- A. Schedule an AWS DataSync task at the shortest supported interval to copy new files from the SMB share to the S3 bucket for the analysts
- B. Mount an Amazon EFS file system on the sequencers and use AWS DataSync to copy the result files from EFS to the S3 bucket
- C. Deploy an S3 File Gateway on premises, create an SMB file share backed by the bucket, and point the sequencers at the share
- D. Deploy an AWS Transfer Family SFTP server and have lab staff upload the result files from the Windows server each hour by hand

**Answer:** C

**Explanation:** S3 File Gateway presents an SMB share, uploads each written file to S3 in the background, and keeps recently used data in a local cache, so the sequencers need no change, analysts see files within minutes, and the server needs little disk.
- DataSync on a schedule: the shortest schedule interval is one hour, longer than minutes (vi phạm ràng buộc)
- EFS mounted on the sequencers: the sequencer software cannot be changed to use it (vi phạm ràng buộc)
- Transfer Family with hourly manual uploads: manual work and hourly delay (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/filegateway/latest/files3/what-is-file-s3.html
> 🇻🇳 File ghi liên tục lên S3 trong vài phút + cache cục bộ → S3 File Gateway; DataSync có lịch tối thiểu 1 giờ.

---

## Q ai-20261022-a35-16
- domain: performance
- task: 3.5
- topic: analytics
- services: EMR, S3, EC2
- tags: spot-instances, etl
- difficulty: hard
- time: 140
- skills: 3.5.s5, 3.5.k1
- concept: A transient EMR cluster with On-Demand primary and core nodes and Spot task nodes is the cost-effective, HDFS-safe layout for fault-tolerant nightly Spark jobs
- refs: 09-analytics-bigdata.md
- hint: Mất dữ liệu HDFS buộc chạy lại từ đầu — node loại nào được phép dùng Spot và cụm nên tồn tại bao lâu?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A genomics company runs a Spark job every night on 30 TB of data in Amazon S3. The job needs custom native libraries installed on every node and Spark settings tuned by the engineers. It runs for about four hours, individual task failures are retried automatically, but losing the intermediate data stored in HDFS would force the job to restart from the beginning, which the company cannot afford. Nothing runs between nightly jobs. Which solution will meet these requirements MOST cost-effectively?

- A. Launch a transient EMR cluster each night with On-Demand primary nodes and Spot core and task nodes, add the libraries with bootstrap actions, and shut it down
- B. Launch a transient EMR cluster each night with On-Demand primary and core nodes and Spot task nodes, add the libraries with bootstrap actions, and shut it down
- C. Keep a long-running EMR cluster with managed scaling that shrinks to a minimum number of core nodes between the nightly jobs
- D. Run the job as AWS Glue Spark ETL jobs and pass the native libraries and the tuned Spark settings in the job parameters

**Answer:** B

**Explanation:** A transient cluster avoids idle cost, task nodes hold no HDFS data so Spot interruptions only retry tasks, and On-Demand core nodes protect the intermediate data. Bootstrap actions install the native libraries.
- Spot core nodes: core nodes hold HDFS data, so an interruption can lose it and restart the job (vi phạm ràng buộc)
- Long-running cluster with managed scaling: shrinks, but still pays for idle nodes between the nightly jobs (tốn chi phí hơn)
- AWS Glue Spark jobs: a managed environment where engineers cannot install native libraries on every node or tune Spark freely (dùng sai tính năng)
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
- time: 105
- skills: 3.5.s4, 3.5.k1
- concept: Amazon Quick datasets on Athena with SPICE and row-level security via a permissions dataset give serverless dashboards restricted per region
- refs: 09-analytics-bigdata.md
- hint: Dashboard tương tác, mỗi quản lý chỉ thấy vùng của mình, không muốn quản lý server BI — dịch vụ BI serverless nào có row-level security?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A retail company stores sales data in Amazon S3 and queries it with Amazon Athena. Executives need interactive dashboards that respond quickly to filtering, regional managers must see only the rows for their own region, and the dashboards must open in a web browser without VPN software. The company does not want to manage BI servers. Which solution will meet these requirements?

- A. Create an Amazon Quick analysis on Athena in direct query mode and publish a separate copy of the dashboard for each region
- B. Create an Amazon Managed Grafana workspace that queries Athena and give each regional manager a folder that holds that region's panels
- C. Create an Amazon Quick dataset on the Athena data source, load it into SPICE, and apply column-level security to the region columns for each regional manager
- D. Create an Amazon Quick dataset on the Athena data source, load it into SPICE, and apply row-level security with a permissions dataset for the regions

**Answer:** D

**Explanation:** Amazon Quick (Quick Sight) is a serverless BI service. SPICE keeps the data in memory for fast filtering, and row-level security with a permissions dataset limits each user to the rows of a region.
- Separate dashboard copies in direct query mode: every filter runs a new Athena query and the per-region copies are maintained by hand (tốn vận hành hơn)
- Managed Grafana folders: control who sees which panels, not which rows a query returns (dùng sai tính năng)
- Column-level security: hides columns, not the rows of other regions (dùng sai tính năng)
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
- time: 115
- skills: 3.5.k2, 3.5.k3, 3.5.s6
- concept: Amazon AppFlow ingests SaaS data such as Salesforce into S3 on a schedule with filters and Parquet output and no code
- refs: 07-application-integration.md
- hint: Nguồn là ứng dụng SaaS, không có lập trình viên, cần lịch chạy, bộ lọc và định dạng Parquet — dịch vụ tích hợp nào không cần code?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company's sales team keeps opportunity and account data in Salesforce. Data engineers must load both objects into an Amazon S3 data lake every night, filter out closed-lost opportunities, and store the output in Parquet so that Amazon Athena queries are efficient. No developers are available to build API integrations, and the team wants the LEAST operational overhead. Which solution will meet these requirements?

- A. Create an Amazon AppFlow flow from Salesforce to S3 with a daily schedule trigger, a filter on opportunity status, and Parquet as the output format
- B. Create an Amazon AppFlow flow from Salesforce to Amazon Redshift with a daily schedule trigger, a filter on opportunity status, and a Redshift table target
- C. Create an Amazon AppFlow flow from Salesforce to S3 that runs on Salesforce change events and writes the records as JSON output files
- D. Write a Lambda function that calls the Salesforce API each night, drops closed-lost records, and writes Parquet files to S3

**Answer:** A

**Explanation:** AppFlow is a managed integration service with Salesforce connectors, schedule triggers, filters, and Parquet output to S3, so no integration code or servers are needed.
- AppFlow to Redshift: lands the data in a warehouse instead of the S3 data lake (vi phạm ràng buộc)
- Event-driven flow writing JSON: writes JSON, not the Parquet that the Athena queries need (vi phạm ràng buộc)
- Lambda with the Salesforce API: integration code that no developer is available to build and maintain (vi phạm ràng buộc)
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
- time: 100
- skills: 3.5.k2, 3.5.s6
- concept: A once-a-day file calls for event-driven batch ETL, not an always-on streaming pipeline
- refs: 09-analytics-bigdata.md
- hint: Một file lớn mỗi đêm — tần suất thu thập này hợp với xử lý theo lô theo sự kiện hay với luồng chạy liên tục 24/7?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A bank receives one 40 GB CSV settlement file in an Amazon S3 bucket every night between 01:00 and 03:00. The data lake must contain the data in Parquet format by 06:00. Analysts do not need the data at any other time of day. The company wants the MOST cost-effective ingestion design. Which solution will meet these requirements?

- A. Schedule an AWS Glue job to run at 01:00 every night that converts the files that are in the bucket at that time to Parquet
- B. Configure an Amazon Data Firehose stream with the S3 bucket as its source and record format conversion that writes Parquet files to the data lake
- C. Create an Amazon EventBridge rule for the S3 object-created event that starts an AWS Glue workflow, which converts the file to Parquet
- D. Run an AWS Glue streaming job around the clock that watches the bucket and converts each new file to Parquet as it arrives

**Answer:** C

**Explanation:** The data arrives as one file per night, so an event-driven batch job pays only for the minutes it runs, and finishes well before the deadline.
- Glue job scheduled at 01:00: the file can arrive as late as 03:00, so the run can miss it (vi phạm ràng buộc)
- Firehose with an S3 source: Firehose does not read existing objects from a bucket (cấu hình không tồn tại)
- Always-on Glue streaming job: pays for workers all day for one nightly file (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/glue/latest/dg/starting-workflow-eventbridge.html
> 🇻🇳 Một file mỗi đêm → xử lý theo lô kích hoạt bằng sự kiện (EventBridge + Glue), không dùng streaming chạy liên tục.
