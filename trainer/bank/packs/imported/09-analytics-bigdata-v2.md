---
pack: saa-09-analytics-bigdata-v2
title: 09 · Analytics & Big Data · V2
exam: SAA-C03
origin: imported
source: practice-exams/09-analytics-bigdata-exam-v2.md
created: 2026-10-16
---

# 09 · Analytics & Big Data · V2

> Imported from `practice-exams/09-analytics-bigdata-exam-v2.md` + `09-analytics-bigdata-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 09-v2-01
- domain: performance
- task: 3.5
- topic: analytics
- services: Kinesis Data Streams
- tags: streaming-ingestion
- difficulty: medium
- time: 55
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q1

A company must ingest streaming clickstream data in real time and allow multiple applications to process the same records. Which service?

- A. Amazon SQS
- B. Kinesis Data Streams
- C. Amazon Athena
- D. Kinesis Data Firehose

**Answer:** B

**Explanation:** Real-time ingest, multiple consumers, replay = Kinesis Data Streams.

---

## Q 09-v2-02
- domain: performance
- task: 3.5
- topic: analytics
- services: Data Firehose, S3, Redshift
- tags: streaming-ingestion
- difficulty: medium
- time: 55
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q2

Streaming data must be delivered to S3/Redshift with the LEAST management and near-real-time (buffered) loading, no custom consumers. Which service?

- A. Kinesis Data Firehose
- B. Amazon MSK
- C. Kinesis Data Streams
- D. EMR

**Answer:** A

**Explanation:** Managed buffered delivery to S3/Redshift, no consumers = Kinesis Data Firehose.

---

## Q 09-v2-03
- domain: performance
- task: 3.5
- topic: analytics
- services: Athena, S3
- difficulty: medium
- time: 55
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q3

A company wants to run SQL queries directly on data stored in S3 without loading it into a database, paying per query. Which service?

- A. Amazon Redshift
- B. Amazon Athena
- C. Amazon EMR
- D. Amazon RDS

**Answer:** B

**Explanation:** SQL on S3, pay per query, serverless = Amazon Athena.

---

## Q 09-v2-04
- domain: performance
- task: 3.5
- topic: analytics
- services: Glue
- tags: etl
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q4

A serverless ETL service must crawl data, build a catalog, and transform data between stores. Which service?

- A. Amazon EMR
- B. Athena
- C. AWS Glue
- D. Kinesis

**Answer:** C

**Explanation:** Serverless ETL + crawler + catalog = AWS Glue.

---

## Q 09-v2-05
- domain: performance
- task: 3.2
- topic: analytics
- services: EMR
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q5

A team needs managed Hadoop/Spark clusters for large-scale big-data processing with full control. Which service?

- A. Athena
- B. Amazon EMR
- C. AWS Glue
- D. QuickSight

**Answer:** B

**Explanation:** Managed Hadoop/Spark with control = Amazon EMR.

---

## Q 09-v2-06
- domain: performance
- task: 3.5
- topic: analytics
- services: OpenSearch
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q6

A company needs a managed search and log analytics engine with dashboards (Kibana-style). Which service?

- A. Kinesis
- B. Amazon OpenSearch Service
- C. Amazon Redshift
- D. Amazon Athena

**Answer:** B

**Explanation:** Search + log analytics + dashboards = Amazon OpenSearch Service.

---

## Q 09-v2-07
- domain: performance
- task: 3.5
- topic: analytics
- services: QuickSight
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q7

Business users need interactive BI dashboards and visualizations with a managed, serverless service. Which service?

- A. Amazon Athena
- B. AWS Glue
- C. OpenSearch
- D. Amazon QuickSight

**Answer:** D

**Explanation:** Managed BI dashboards/visualizations = Amazon QuickSight.

---

## Q 09-v2-08
- domain: cost
- task: 4.1
- topic: analytics
- services: S3, Athena
- tags: columnar-formats
- difficulty: medium
- time: 80
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q8

Athena queries on large S3 datasets are slow and expensive. Which two optimizations reduce cost and improve performance? (Choose TWO)

- A. Store as uncompressed CSV
- B. Use a single large file
- C. Partition the data in S3
- D. Convert data to columnar formats (Parquet/ORC)
- E. Query with SELECT *

**Answer:** C, D

**Explanation:** Cheaper/faster Athena = columnar (Parquet/ORC) + partitioning.

---

## Q 09-v2-09
- domain: performance
- task: 3.5
- topic: analytics
- services: Glue, Athena, EMR, Redshift
- tags: redshift-spectrum
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q9

A company must catalog metadata so Athena, EMR, and Redshift Spectrum can share table definitions. Which component?

- A. CloudTrail
- B. S3 Inventory
- C. AWS Glue Data Catalog
- D. DynamoDB

**Answer:** C

**Explanation:** Shared metadata catalog = AWS Glue Data Catalog.

---

## Q 09-v2-10
- domain: performance
- task: 3.3
- topic: analytics
- services: Redshift, S3
- tags: redshift-spectrum
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q10

Redshift must query data in S3 without loading it into the cluster. Which feature?

- A. Glue crawler
- B. EMR
- C. Athena federation
- D. Redshift Spectrum

**Answer:** D

**Explanation:** Query S3 from Redshift without loading = Redshift Spectrum.

---

## Q 09-v2-11
- domain: performance
- task: 3.5
- topic: analytics
- services: Managed Apache Flink
- tags: streaming-ingestion
- difficulty: medium
- time: 55
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q11

A streaming pipeline must transform and enrich records in real time using SQL/Apache Flink. Which service?

- A. Glue
- B. Kinesis Data Firehose
- C. Kinesis Data Analytics (Managed Service for Apache Flink)
- D. Athena

**Answer:** C

**Explanation:** Real-time SQL/Flink stream processing = Kinesis Data Analytics (Managed Flink).

---

## Q 09-v2-12
- domain: performance
- task: 3.5
- topic: analytics
- services: MSK
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q12

A company already uses Apache Kafka and wants a managed Kafka service on AWS. Which service?

- A. Amazon MQ
- B. Amazon MSK
- C. Amazon SQS
- D. Kinesis Data Streams

**Answer:** B

**Explanation:** Managed Kafka = Amazon MSK.

---

## Q 09-v2-13
- domain: performance
- task: 3.5
- topic: analytics
- services: Data Firehose, S3
- tags: streaming-ingestion, columnar-formats
- difficulty: medium
- time: 55
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q13

Firehose must deliver streaming data to S3 in Parquet format and buffer records before writing. Which capability applies?

- A. Firehose record format conversion + buffering
- B. Kinesis Data Streams shards
- C. Athena partitions
- D. Glue crawler

**Answer:** A

**Explanation:** Firehose Parquet conversion + buffering = Firehose record format conversion.

---

## Q 09-v2-14
- domain: performance
- task: 3.5
- topic: analytics
- services: Kinesis
- tags: sharding, kinesis-shards
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q14

A Kinesis Data Stream is throttling on writes. Which action increases capacity?

- A. Increase the number of shards (resharding/split)
- B. Add a DLQ
- C. Increase visibility timeout
- D. Enable long polling

**Answer:** A

**Explanation:** Increase Kinesis write capacity = add shards (resharding).

---

## Q 09-v2-15
- domain: secure
- task: 1.3
- topic: analytics
- services: Lake Formation, Glue, Athena, Redshift
- tags: data-lake
- difficulty: medium
- time: 55
- concept: Lake Formation governs S3 data lake tables with fine-grained permissions across Athena, Redshift Spectrum, EMR
- hint: Cần lớp quản trị dùng chung, phân quyền chi tiết cho bảng trên S3 và áp dụng cho nhiều dịch vụ phân tích.
- enriched: 2026-10-16
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q15

A company needs a governed data lake with fine-grained permissions on S3-based tables across analytics services. Which service?

- A. AWS Glue crawlers
- B. Redshift data shares
- C. AWS Lake Formation
- D. Amazon Athena SQL

**Answer:** C

**Explanation:** **AWS Lake Formation** provides a governed data lake with centrally managed, fine-grained permissions on S3-based tables that are enforced across integrated analytics services.
- AWS Glue crawlers: build the Data Catalog but do not define or enforce access policy.
- Redshift data shares: share warehouse data between clusters; not a governance layer for the lake.
- Amazon Athena SQL: a query engine that consumes permissions rather than providing the governance layer.
> 🇻🇳 Data lake có quản trị + phân quyền chi tiết dùng chung nhiều dịch vụ → Lake Formation.

---

## Q 09-v2-16
- domain: performance
- task: 3.5
- topic: analytics
- services: OpenSearch
- tags: streaming-ingestion
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q16

Which service is BEST to visualize log data ingested from applications for near-real-time operational dashboards and full-text search?

- A. Amazon Athena
- B. Amazon Redshift
- C. QuickSight only
- D. Amazon OpenSearch Service

**Answer:** D

**Explanation:** Near-real-time log dashboards + full-text search = OpenSearch.

---

## Q 09-v2-17
- domain: cost
- task: 4.1
- topic: analytics
- services: Athena, S3
- difficulty: medium
- time: 55
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q17

A one-time ad-hoc analysis of infrequently accessed S3 logs is needed with no infrastructure to manage. Which is MOST cost-effective?

- A. RDS
- B. Amazon Redshift cluster
- C. Amazon Athena
- D. Amazon EMR cluster

**Answer:** C

**Explanation:** Ad-hoc S3 log analysis, no infra = Amazon Athena.

---

## Q 09-v2-18
- domain: performance
- task: 3.5
- topic: analytics
- services: Data Firehose
- difficulty: medium
- time: 60
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q18

Firehose vs Data Streams: which statement is TRUE?

- A. Firehose is fully managed delivery with no consumer code; Data Streams requires consumers and allows replay
- B. They are identical
- C. Firehose supports replay and shards
- D. Data Streams delivers directly to S3 with no code

**Answer:** A

**Explanation:** Firehose = managed delivery no code; Data Streams = consumers + replay.

---

## Q 09-v2-19
- domain: performance
- task: 3.5
- topic: analytics
- services: Glue, S3, Redshift
- tags: etl
- difficulty: medium
- time: 60
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q19

A pipeline must load transformed data into Redshift daily and support complex joins for BI. Which combination is appropriate?

- A. DynamoDB Streams to Redshift directly
- B. Athena writes directly into Redshift tables
- C. Kinesis Firehose only, no transform
- D. Glue ETL to S3 → COPY into Redshift

**Answer:** D

**Explanation:** Daily transform + BI joins = Glue ETL to S3 then COPY to Redshift.

---

## Q 09-v2-20
- domain: cost
- task: 4.2
- topic: analytics
- services: EMR
- difficulty: medium
- time: 55
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q20

A team needs to run Spark jobs on transient clusters that spin up, process, and terminate to save cost. Which service + option?

- A. Redshift Spectrum
- B. EMR always-on cluster
- C. Glue crawler only
- D. EMR with transient clusters (auto-terminate)

**Answer:** D

**Explanation:** Cost-saving Spark = EMR transient auto-terminating clusters.

---

## Q 09-v2-21
- domain: performance
- task: 3.3
- topic: analytics
- services: Kinesis
- tags: sharding
- difficulty: hard
- time: 75
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q21

A Kinesis Data Stream must ingest 5,000 records/sec, each 2 KB. Each shard supports 1 MB/s or 1,000 records/s ingest. How many shards are needed (approximately)?

- A. 5 shards (record-limit bound: 5,000/1,000)
- B. 2 shards
- C. 1 shard
- D. 50 shards

**Answer:** A

**Explanation:** 5,000 rec/s / 1,000 per shard = ~5 shards (record limit binding).

---

## Q 09-v2-22
- domain: performance
- task: 3.2
- topic: analytics
- tags: sharding, fan-out
- difficulty: hard
- time: 75
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q22

Multiple independent consumers must each read the full stream at full throughput without contending for the 2 MB/s per-shard read limit. Which feature?

- A. Standard iterator only
- B. More visibility timeout
- C. Enhanced fan-out (dedicated 2 MB/s per consumer)
- D. Firehose delivery

**Answer:** C

**Explanation:** Multiple full-throughput consumers = enhanced fan-out.

---

## Q 09-v2-23
- domain: performance
- task: 3.3
- topic: analytics
- services: Kinesis
- tags: sharding
- difficulty: hard
- time: 70
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q23

An analytics platform must guarantee ordering of events per user while scaling across many users. In Kinesis, which controls which shard a record goes to?

- A. Consumer group id
- B. Sequence number
- C. Shard iterator
- D. Partition key

**Answer:** D

**Explanation:** Controls shard placement/ordering = partition key.

---

## Q 09-v2-24
- domain: cost
- task: 4.1
- topic: analytics
- services: Athena
- tags: columnar-formats
- difficulty: hard
- time: 95
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q24

A company must minimize Athena cost on a multi-TB dataset queried by date. Which two design choices help MOST? (Choose TWO)

- A. Always SELECT *
- B. Partition by date (e.g., year/month/day prefixes)
- C. Store as one giant JSON file
- D. Use columnar compressed formats (Parquet)
- E. Disable partition projection

**Answer:** B, D

**Explanation:** Minimize Athena cost = partition by date + Parquet columnar.

---

## Q 09-v2-25
- domain: performance
- task: 3.5
- topic: analytics
- services: Managed Apache Flink
- tags: streaming-ingestion
- difficulty: hard
- time: 70
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q25

A streaming pipeline needs sub-second, exactly-once, stateful stream processing with windowing. Which service is BEST?

- A. Managed Service for Apache Flink (Kinesis Data Analytics)
- B. Glue crawler
- C. Kinesis Data Firehose
- D. Athena

**Answer:** A

**Explanation:** Sub-second exactly-once stateful windowing = Managed Service for Apache Flink.

---

## Q 09-v2-26
- domain: performance
- task: 3.5
- topic: analytics
- services: MSK, Kinesis Data Streams
- difficulty: hard
- time: 95
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q26

A company compares MSK vs Kinesis Data Streams. Which two are advantages of MSK? (Choose TWO)

- A. No consumer code ever needed
- B. Native Kafka API compatibility for existing Kafka apps
- C. Automatic delivery to S3 without config
- D. Fully serverless with no partition/shard concept ever
- E. Configurable retention and partitions like Kafka

**Answer:** B, E

**Explanation:** MSK advantages = native Kafka API + configurable retention/partitions.

---

## Q 09-v2-27
- domain: performance
- task: 3.5
- topic: analytics
- services: Data Firehose, OpenSearch
- tags: streaming-ingestion
- difficulty: hard
- time: 75
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q27

A near-real-time dashboard must be fed from a stream, buffering and delivering to OpenSearch with transformation. Which service handles delivery with format conversion and buffering?

- A. Athena federation
- B. Kinesis Data Firehose (to OpenSearch)
- C. Kinesis Data Streams alone
- D. Glue crawler

**Answer:** B

**Explanation:** Buffered transform delivery to OpenSearch = Kinesis Data Firehose.

---

## Q 09-v2-28
- domain: cost
- task: 4.2
- topic: analytics
- services: EMR
- tags: spot-instances
- difficulty: hard
- time: 75
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q28

An EMR cluster processing sensitive data must minimize cost on task nodes while keeping core/HDFS stable. Which strategy?

- A. On-Demand for everything
- B. Spot for all nodes including core
- C. Spot Instances for task nodes, On-Demand/Reserved for core nodes
- D. Task nodes on Dedicated Hosts

**Answer:** C

**Explanation:** EMR cost = Spot task nodes + On-Demand/Reserved core nodes.

---

## Q 09-v2-29
- domain: secure
- task: 1.3
- topic: analytics
- services: Lake Formation, Athena, Redshift
- tags: data-lake, redshift-spectrum
- difficulty: hard
- time: 75
- concept: Lake Formation column/row-level security enforced consistently across Athena and Redshift Spectrum
- hint: Cần một lớp quản trị duy nhất áp dụng bảo mật mức cột và dòng nhất quán cho nhiều engine truy vấn.
- enriched: 2026-10-16
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q29

A data lake must enforce column- and row-level security across Athena and Redshift Spectrum consistently. Which service provides this governance layer?

- A. AWS Lake Formation permissions
- B. IAM identity policies per role
- C. S3 bucket policies and ACLs
- D. KMS grants on each dataset

**Answer:** A

**Explanation:** **Lake Formation permissions** define column-level and row-level (data filter) access once and enforce it consistently for Athena and Redshift Spectrum.
- IAM identity policies: control API actions and S3 paths, but cannot express column or row filters.
- S3 bucket policies and ACLs: work at bucket/prefix/object level only, with no column or row awareness.
- KMS grants: delegate use of encryption keys; they do not filter data a query returns.
> 🇻🇳 Bảo mật mức cột/dòng nhất quán cho Athena + Spectrum → Lake Formation permissions.

---

## Q 09-v2-30
- domain: performance
- task: 3.2
- topic: analytics
- services: Lambda, Data Firehose, S3
- difficulty: hard
- time: 70
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q30

A Firehose stream must transform records with custom logic before delivery to S3. Which integration provides this?

- A. Kinesis shard split
- B. Athena UDF
- C. Glue crawler
- D. A Lambda function invoked by Firehose for record transformation

**Answer:** D

**Explanation:** Firehose custom transform = Lambda transformation function.
