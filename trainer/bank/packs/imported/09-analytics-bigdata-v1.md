---
pack: saa-09-analytics-bigdata-v1
title: 09 · Analytics & Big Data · V1
exam: SAA-C03
origin: imported
source: practice-exams/09-analytics-bigdata-exam.md
created: 2026-10-16
---

# 09 · Analytics & Big Data · V1

> Imported from `practice-exams/09-analytics-bigdata-exam.md` + `09-analytics-bigdata-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 09-v1-01
- domain: performance
- topic: analytics
- services: Kinesis Data Streams
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q1

A company must ingest real-time clickstream data (sub-second) and allow multiple applications to consume and replay it. Which service?

- A. Amazon Kinesis Data Streams
- B. Amazon Kinesis Data Firehose
- C. Amazon SQS
- D. Amazon Athena

**Answer:** A

**Explanation:** Real-time, multi-consumer, replay = Kinesis Data Streams.

---

## Q 09-v1-02
- domain: performance
- topic: analytics
- services: Data Firehose, S3, Redshift, Lambda
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q2

Streaming data must be delivered (near real-time) to Amazon S3 and Redshift with optional Lambda transformation and NO server management. Which service?

- A. Kinesis Data Streams
- B. Kinesis Data Firehose
- C. Amazon EMR
- D. AWS Glue

**Answer:** B

**Explanation:** Near-real-time managed delivery to S3/Redshift = Kinesis Firehose.

---

## Q 09-v1-03
- domain: performance
- topic: analytics
- services: Athena, S3
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q3

A team wants to run ad-hoc SQL queries directly against data in S3 without loading it into a database, paying per data scanned. Which service?

- A. Amazon Redshift
- B. Amazon Athena
- C. Amazon EMR
- D. Amazon QuickSight

**Answer:** B

**Explanation:** Ad-hoc SQL on S3, pay per scan = Amazon Athena.

---

## Q 09-v1-04
- domain: performance
- topic: analytics
- services: Glue
- tags: etl
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q4

A company needs a serverless ETL service to crawl data, infer schema into a catalog, and transform data for analytics. Which service?

- A. AWS Glue
- B. Amazon Kinesis
- C. AWS Data Pipeline
- D. Amazon Athena

**Answer:** A

**Explanation:** Serverless ETL + crawler + catalog = AWS Glue.

---

## Q 09-v1-05
- domain: performance
- topic: analytics
- services: EMR
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q5

A data science team must run Apache Spark and Hadoop jobs on large datasets using managed clusters. Which service?

- A. Amazon EMR
- B. Amazon Redshift
- C. AWS Glue
- D. Amazon Athena

**Answer:** A

**Explanation:** Managed Spark/Hadoop clusters = Amazon EMR.

---

## Q 09-v1-06
- domain: performance
- topic: analytics
- services: OpenSearch
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q6

A company needs full-text search and log analytics with dashboards (Kibana/OpenSearch Dashboards). Which service?

- A. Amazon OpenSearch Service
- B. Amazon Athena
- C. Amazon QuickSight
- D. Amazon Redshift

**Answer:** A

**Explanation:** Full-text search + log dashboards = OpenSearch Service.

---

## Q 09-v1-07
- domain: performance
- topic: analytics
- services: QuickSight
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q7

Business analysts need interactive BI dashboards with an in-memory engine (SPICE) and pay-per-session pricing. Which service?

- A. Amazon QuickSight
- B. Amazon OpenSearch
- C. AWS Glue
- D. Amazon EMR

**Answer:** A

**Explanation:** BI dashboards, SPICE, per-session = QuickSight.

---

## Q 09-v1-08
- domain: secure
- topic: analytics
- services: Lake Formation, S3
- tags: data-lake
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q8

A company is building a data lake on S3 and needs centralized, fine-grained permissions and governance over the data. Which service?

- A. AWS Lake Formation
- B. AWS Glue only
- C. Amazon Macie
- D. AWS Config

**Answer:** A

**Explanation:** Data lake governance + fine-grained perms = Lake Formation.

---

## Q 09-v1-09
- domain: performance
- topic: analytics
- services: Athena
- tags: columnar-formats
- difficulty: easy
- time: 50
- source: practice-exams/09-analytics-bigdata-exam.md#Q9

To reduce Athena cost and improve performance on large datasets, which optimization is MOST effective?

- A. Store data as uncompressed CSV
- B. Convert data to columnar formats (Parquet/ORC) and partition it
- C. Increase the S3 storage class to Standard
- D. Use a single large object

**Answer:** B

**Explanation:** Parquet/ORC + partitioning cuts Athena cost/scan.

---

## Q 09-v1-10
- domain: performance
- topic: analytics
- services: Managed Apache Flink
- tags: streaming-ingestion, threat-detection
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q10

A pipeline must run SQL analytics on streaming data in real time (e.g., anomaly detection over a time window). Which service?

- A. Amazon Athena
- B. Amazon Managed Service for Apache Flink (Kinesis Data Analytics)
- C. AWS Glue
- D. Amazon QuickSight

**Answer:** B

**Explanation:** Real-time SQL/stream analytics = Managed Flink (Kinesis Data Analytics).

---

## Q 09-v1-11
- domain: performance
- topic: analytics
- services: Redshift
- tags: offline-transfer
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q11

Which service is BEST for a petabyte-scale data warehouse with complex joins and BI reporting?

- A. Amazon Redshift
- B. Amazon DynamoDB
- C. Amazon Athena
- D. Amazon RDS

**Answer:** A

**Explanation:** Petabyte warehouse + complex joins/BI = Redshift.

---

## Q 09-v1-12
- domain: performance
- topic: analytics
- services: Redshift, S3
- tags: redshift-spectrum
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q12

A company wants to query data stored in both Redshift and S3 in a single query without loading S3 data into Redshift. Which feature?

- A. Redshift Spectrum
- B. Redshift Concurrency Scaling
- C. Redshift RA3 managed storage
- D. Redshift Serverless

**Answer:** A

**Explanation:** Query S3 + Redshift together = Redshift Spectrum.

---

## Q 09-v1-13
- domain: performance
- topic: analytics
- services: Kinesis Data Streams
- tags: dynamodb-capacity, sharding, kinesis-shards
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q13

Kinesis Data Streams throughput is hitting limits. Which action increases capacity in provisioned mode?

- A. Increase message retention
- B. Add more shards (resharding)
- C. Enable long polling
- D. Switch to SQS FIFO

**Answer:** B

**Explanation:** Increase provisioned throughput = add shards (resharding).

---

## Q 09-v1-14
- domain: performance
- topic: analytics
- services: MSK
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q14

A workload needs to migrate from self-managed Apache Kafka with minimal application changes. Which service?

- A. Amazon MSK (Managed Streaming for Apache Kafka)
- B. Amazon Kinesis Data Streams
- C. Amazon SQS
- D. Amazon MQ

**Answer:** A

**Explanation:** Managed Kafka, minimal change = Amazon MSK.

---

## Q 09-v1-15
- domain: performance
- topic: analytics
- services: SQS, Data Firehose
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q15

Which destination is NOT natively supported by Kinesis Data Firehose?

- A. Amazon S3
- B. Amazon Redshift
- C. Amazon OpenSearch
- D. Amazon SQS

**Answer:** D

**Explanation:** Firehose does NOT deliver to SQS (S3/Redshift/OpenSearch/Splunk yes).

---

## Q 09-v1-16
- domain: performance
- topic: analytics
- services: Athena, VPC, VPC Flow Logs, CloudTrail
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q16

A company wants to analyze VPC Flow Logs and CloudTrail logs ad-hoc using SQL with the least setup. Which service?

- A. Amazon Athena
- B. Amazon EMR
- C. Amazon Redshift
- D. AWS Glue DataBrew

**Answer:** A

**Explanation:** Ad-hoc SQL on logs, least setup = Athena.

---

## Q 09-v1-17
- domain: performance
- topic: analytics
- services: Data Firehose, Kinesis Data Streams
- tags: streaming-ingestion
- difficulty: easy
- time: 50
- source: practice-exams/09-analytics-bigdata-exam.md#Q17

Which statement best distinguishes Kinesis Data Streams from Firehose?

- A. Firehose is for custom real-time consumers; Streams auto-loads to destinations
- B. Streams is real-time with custom consumers/replay; Firehose is near-real-time managed delivery
- C. Both guarantee exactly-once ordering at 1 ms latency
- D. Firehose requires managing shards

**Answer:** B

**Explanation:** Streams = real-time custom/replay; Firehose = managed near-real-time delivery.

---

## Q 09-v1-18
- domain: performance
- topic: analytics
- services: EMR, Glue, Redshift
- tags: etl
- difficulty: medium
- time: 80
- source: practice-exams/09-analytics-bigdata-exam.md#Q18

A retail company needs nightly batch ETL over terabytes with Spark, then load results into Redshift. Which two services fit BEST? (Choose TWO)

- A. Amazon EMR (or AWS Glue) for Spark ETL
- B. Amazon Redshift as the warehouse
- C. Amazon SQS
- D. Amazon Cognito
- E. AWS Shield

**Answer:** A, B

**Explanation:** Spark ETL (EMR/Glue) + Redshift warehouse.

---

## Q 09-v1-19
- domain: performance
- topic: analytics
- services: Glue
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q19

A company needs visual data preparation (cleaning/normalizing) for analysts without writing code. Which service?

- A. AWS Glue DataBrew
- B. Amazon Athena
- C. Amazon EMR
- D. Amazon QuickSight

**Answer:** A

**Explanation:** No-code visual data prep = Glue DataBrew.

---

## Q 09-v1-20
- domain: cost
- topic: analytics
- services: Athena, S3
- difficulty: easy
- time: 45
- source: practice-exams/09-analytics-bigdata-exam.md#Q20

Which approach minimizes cost for an analytics workload that queries S3 only a few times per month?

- A. Always-on Redshift cluster
- B. Amazon Athena (serverless, pay-per-query)
- C. Always-on EMR cluster
- D. Provisioned Kinesis stream

**Answer:** B

**Explanation:** Infrequent S3 queries, lowest cost = Athena.
