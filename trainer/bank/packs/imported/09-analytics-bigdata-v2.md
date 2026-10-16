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
- topic: analytics
- services: Kinesis Data Streams
- tags: streaming-ingestion
- difficulty: medium
- time: 55
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q1

A company must ingest streaming clickstream data in real time and allow multiple applications to process the same records. Which service?

- A. Kinesis Data Streams
- B. Kinesis Data Firehose
- C. Amazon SQS
- D. Amazon Athena

**Answer:** A

**Explanation:** Real-time ingest, multiple consumers, replay = Kinesis Data Streams.

---

## Q 09-v2-02
- domain: performance
- topic: analytics
- services: Data Firehose, S3, Redshift
- tags: streaming-ingestion
- difficulty: medium
- time: 55
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q2

Streaming data must be delivered to S3/Redshift with the LEAST management and near-real-time (buffered) loading, no custom consumers. Which service?

- A. Kinesis Data Streams
- B. Kinesis Data Firehose
- C. Amazon MSK
- D. EMR

**Answer:** B

**Explanation:** Managed buffered delivery to S3/Redshift, no consumers = Kinesis Data Firehose.

---

## Q 09-v2-03
- domain: performance
- topic: analytics
- services: Athena, S3
- difficulty: medium
- time: 55
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q3

A company wants to run SQL queries directly on data stored in S3 without loading it into a database, paying per query. Which service?

- A. Amazon Athena
- B. Amazon Redshift
- C. Amazon RDS
- D. Amazon EMR

**Answer:** A

**Explanation:** SQL on S3, pay per query, serverless = Amazon Athena.

---

## Q 09-v2-04
- domain: performance
- topic: analytics
- services: Glue
- tags: etl
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q4

A serverless ETL service must crawl data, build a catalog, and transform data between stores. Which service?

- A. AWS Glue
- B. Amazon EMR
- C. Kinesis
- D. Athena

**Answer:** A

**Explanation:** Serverless ETL + crawler + catalog = AWS Glue.

---

## Q 09-v2-05
- domain: performance
- topic: analytics
- services: EMR
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q5

A team needs managed Hadoop/Spark clusters for large-scale big-data processing with full control. Which service?

- A. Amazon EMR
- B. AWS Glue
- C. Athena
- D. QuickSight

**Answer:** A

**Explanation:** Managed Hadoop/Spark with control = Amazon EMR.

---

## Q 09-v2-06
- domain: performance
- topic: analytics
- services: OpenSearch
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q6

A company needs a managed search and log analytics engine with dashboards (Kibana-style). Which service?

- A. Amazon OpenSearch Service
- B. Amazon Athena
- C. Amazon Redshift
- D. Kinesis

**Answer:** A

**Explanation:** Search + log analytics + dashboards = Amazon OpenSearch Service.

---

## Q 09-v2-07
- domain: performance
- topic: analytics
- services: QuickSight
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q7

Business users need interactive BI dashboards and visualizations with a managed, serverless service. Which service?

- A. Amazon QuickSight
- B. Amazon Athena
- C. AWS Glue
- D. OpenSearch

**Answer:** A

**Explanation:** Managed BI dashboards/visualizations = Amazon QuickSight.

---

## Q 09-v2-08
- domain: cost
- topic: analytics
- services: S3, Athena
- tags: columnar-formats
- difficulty: medium
- time: 80
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q8

Athena queries on large S3 datasets are slow and expensive. Which two optimizations reduce cost and improve performance? (Choose TWO)

- A. Convert data to columnar formats (Parquet/ORC)
- B. Partition the data in S3
- C. Store as uncompressed CSV
- D. Query with SELECT *
- E. Use a single large file

**Answer:** A, B

**Explanation:** Cheaper/faster Athena = columnar (Parquet/ORC) + partitioning.

---

## Q 09-v2-09
- domain: performance
- topic: analytics
- services: Glue, Athena, EMR, Redshift
- tags: redshift-spectrum
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q9

A company must catalog metadata so Athena, EMR, and Redshift Spectrum can share table definitions. Which component?

- A. AWS Glue Data Catalog
- B. S3 Inventory
- C. DynamoDB
- D. CloudTrail

**Answer:** A

**Explanation:** Shared metadata catalog = AWS Glue Data Catalog.

---

## Q 09-v2-10
- domain: performance
- topic: analytics
- services: Redshift, S3
- tags: redshift-spectrum
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q10

Redshift must query data in S3 without loading it into the cluster. Which feature?

- A. Redshift Spectrum
- B. Athena federation
- C. Glue crawler
- D. EMR

**Answer:** A

**Explanation:** Query S3 from Redshift without loading = Redshift Spectrum.

---

## Q 09-v2-11
- domain: performance
- topic: analytics
- services: Managed Apache Flink
- tags: streaming-ingestion
- difficulty: medium
- time: 55
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q11

A streaming pipeline must transform and enrich records in real time using SQL/Apache Flink. Which service?

- A. Kinesis Data Analytics (Managed Service for Apache Flink)
- B. Kinesis Data Firehose
- C. Athena
- D. Glue

**Answer:** A

**Explanation:** Real-time SQL/Flink stream processing = Kinesis Data Analytics (Managed Flink).

---

## Q 09-v2-12
- domain: performance
- topic: analytics
- services: MSK
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q12

A company already uses Apache Kafka and wants a managed Kafka service on AWS. Which service?

- A. Amazon MSK
- B. Kinesis Data Streams
- C. Amazon SQS
- D. Amazon MQ

**Answer:** A

**Explanation:** Managed Kafka = Amazon MSK.

---

## Q 09-v2-13
- domain: performance
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
- topic: analytics
- services: Kinesis
- tags: sharding, kinesis-shards
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q14

A Kinesis Data Stream is throttling on writes. Which action increases capacity?

- A. Increase the number of shards (resharding/split)
- B. Increase visibility timeout
- C. Add a DLQ
- D. Enable long polling

**Answer:** A

**Explanation:** Increase Kinesis write capacity = add shards (resharding).

---

## Q 09-v2-15
- domain: secure
- topic: analytics
- services: Lake Formation, S3
- tags: data-lake
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q15

A company needs a governed data lake with fine-grained permissions on S3-based tables across analytics services. Which service?

- A. AWS Lake Formation
- B. Amazon Athena
- C. AWS Glue only
- D. Redshift

**Answer:** A

**Explanation:** Governed data lake with fine-grained permissions = AWS Lake Formation.

---

## Q 09-v2-16
- domain: performance
- topic: analytics
- services: OpenSearch
- tags: streaming-ingestion
- difficulty: medium
- time: 50
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q16

Which service is BEST to visualize log data ingested from applications for near-real-time operational dashboards and full-text search?

- A. Amazon OpenSearch Service
- B. Amazon Redshift
- C. Amazon Athena
- D. QuickSight only

**Answer:** A

**Explanation:** Near-real-time log dashboards + full-text search = OpenSearch.

---

## Q 09-v2-17
- domain: cost
- topic: analytics
- services: Athena, S3
- difficulty: medium
- time: 55
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q17

A one-time ad-hoc analysis of infrequently accessed S3 logs is needed with no infrastructure to manage. Which is MOST cost-effective?

- A. Amazon Athena
- B. Amazon Redshift cluster
- C. Amazon EMR cluster
- D. RDS

**Answer:** A

**Explanation:** Ad-hoc S3 log analysis, no infra = Amazon Athena.

---

## Q 09-v2-18
- domain: performance
- topic: analytics
- services: Data Firehose
- difficulty: medium
- time: 60
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q18

Firehose vs Data Streams: which statement is TRUE?

- A. Firehose is fully managed delivery with no consumer code; Data Streams requires consumers and allows replay
- B. Firehose supports replay and shards
- C. Data Streams delivers directly to S3 with no code
- D. They are identical

**Answer:** A

**Explanation:** Firehose = managed delivery no code; Data Streams = consumers + replay.

---

## Q 09-v2-19
- domain: performance
- topic: analytics
- services: Glue, S3, Redshift
- tags: etl
- difficulty: medium
- time: 60
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q19

A pipeline must load transformed data into Redshift daily and support complex joins for BI. Which combination is appropriate?

- A. Glue ETL to S3 → COPY into Redshift
- B. Athena writes directly into Redshift tables
- C. Kinesis Firehose only, no transform
- D. DynamoDB Streams to Redshift directly

**Answer:** A

**Explanation:** Daily transform + BI joins = Glue ETL to S3 then COPY to Redshift.

---

## Q 09-v2-20
- domain: cost
- topic: analytics
- services: EMR
- difficulty: medium
- time: 55
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q20

A team needs to run Spark jobs on transient clusters that spin up, process, and terminate to save cost. Which service + option?

- A. EMR with transient clusters (auto-terminate)
- B. EMR always-on cluster
- C. Glue crawler only
- D. Redshift Spectrum

**Answer:** A

**Explanation:** Cost-saving Spark = EMR transient auto-terminating clusters.

---

## Q 09-v2-21
- domain: performance
- topic: analytics
- services: Kinesis
- tags: sharding
- difficulty: hard
- time: 75
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q21

A Kinesis Data Stream must ingest 5,000 records/sec, each 2 KB. Each shard supports 1 MB/s or 1,000 records/s ingest. How many shards are needed (approximately)?

- A. 1 shard
- B. 5 shards (record-limit bound: 5,000/1,000)
- C. 2 shards
- D. 50 shards

**Answer:** B

**Explanation:** 5,000 rec/s / 1,000 per shard = ~5 shards (record limit binding).

---

## Q 09-v2-22
- domain: performance
- topic: analytics
- tags: sharding, fan-out
- difficulty: hard
- time: 75
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q22

Multiple independent consumers must each read the full stream at full throughput without contending for the 2 MB/s per-shard read limit. Which feature?

- A. Enhanced fan-out (dedicated 2 MB/s per consumer)
- B. More visibility timeout
- C. Firehose delivery
- D. Standard iterator only

**Answer:** A

**Explanation:** Multiple full-throughput consumers = enhanced fan-out.

---

## Q 09-v2-23
- domain: performance
- topic: analytics
- services: Kinesis
- tags: sharding
- difficulty: hard
- time: 70
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q23

An analytics platform must guarantee ordering of events per user while scaling across many users. In Kinesis, which controls which shard a record goes to?

- A. Partition key
- B. Sequence number
- C. Shard iterator
- D. Consumer group id

**Answer:** A

**Explanation:** Controls shard placement/ordering = partition key.

---

## Q 09-v2-24
- domain: cost
- topic: analytics
- services: Athena
- tags: columnar-formats
- difficulty: hard
- time: 95
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q24

A company must minimize Athena cost on a multi-TB dataset queried by date. Which two design choices help MOST? (Choose TWO)

- A. Partition by date (e.g., year/month/day prefixes)
- B. Use columnar compressed formats (Parquet)
- C. Store as one giant JSON file
- D. Always SELECT *
- E. Disable partition projection

**Answer:** A, B

**Explanation:** Minimize Athena cost = partition by date + Parquet columnar.

---

## Q 09-v2-25
- domain: performance
- topic: analytics
- services: Managed Apache Flink
- tags: streaming-ingestion
- difficulty: hard
- time: 70
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q25

A streaming pipeline needs sub-second, exactly-once, stateful stream processing with windowing. Which service is BEST?

- A. Managed Service for Apache Flink (Kinesis Data Analytics)
- B. Kinesis Data Firehose
- C. Glue crawler
- D. Athena

**Answer:** A

**Explanation:** Sub-second exactly-once stateful windowing = Managed Service for Apache Flink.

---

## Q 09-v2-26
- domain: performance
- topic: analytics
- services: MSK, Kinesis Data Streams
- difficulty: hard
- time: 95
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q26

A company compares MSK vs Kinesis Data Streams. Which two are advantages of MSK? (Choose TWO)

- A. Native Kafka API compatibility for existing Kafka apps
- B. Configurable retention and partitions like Kafka
- C. Fully serverless with no partition/shard concept ever
- D. No consumer code ever needed
- E. Automatic delivery to S3 without config

**Answer:** A, B

**Explanation:** MSK advantages = native Kafka API + configurable retention/partitions.

---

## Q 09-v2-27
- domain: performance
- topic: analytics
- services: Data Firehose, OpenSearch
- tags: streaming-ingestion
- difficulty: hard
- time: 75
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q27

A near-real-time dashboard must be fed from a stream, buffering and delivering to OpenSearch with transformation. Which service handles delivery with format conversion and buffering?

- A. Kinesis Data Firehose (to OpenSearch)
- B. Kinesis Data Streams alone
- C. Glue crawler
- D. Athena federation

**Answer:** A

**Explanation:** Buffered transform delivery to OpenSearch = Kinesis Data Firehose.

---

## Q 09-v2-28
- domain: cost
- topic: analytics
- services: EMR
- tags: spot-instances
- difficulty: hard
- time: 75
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q28

An EMR cluster processing sensitive data must minimize cost on task nodes while keeping core/HDFS stable. Which strategy?

- A. Spot Instances for task nodes, On-Demand/Reserved for core nodes
- B. Spot for all nodes including core
- C. On-Demand for everything
- D. Task nodes on Dedicated Hosts

**Answer:** A

**Explanation:** EMR cost = Spot task nodes + On-Demand/Reserved core nodes.

---

## Q 09-v2-29
- domain: secure
- topic: analytics
- services: Lake Formation, Athena, Redshift
- tags: data-lake, redshift-spectrum
- difficulty: hard
- time: 70
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q29

A data lake must enforce column- and row-level security across Athena and Redshift Spectrum consistently. Which service provides this governance layer?

- A. AWS Lake Formation permissions
- B. S3 bucket policies only
- C. IAM only
- D. KMS grants

**Answer:** A

**Explanation:** Column/row-level governance across analytics = Lake Formation.

---

## Q 09-v2-30
- domain: performance
- topic: analytics
- services: Lambda, Data Firehose, S3
- difficulty: hard
- time: 70
- source: practice-exams/09-analytics-bigdata-exam-v2.md#Q30

A Firehose stream must transform records with custom logic before delivery to S3. Which integration provides this?

- A. A Lambda function invoked by Firehose for record transformation
- B. Athena UDF
- C. Glue crawler
- D. Kinesis shard split

**Answer:** A

**Explanation:** Firehose custom transform = Lambda transformation function.
