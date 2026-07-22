# 📊 Practice Exam 09 — Analytics & Big Data (SAA-C03)

20 questions · scenario-based · English. Answers in `09-analytics-bigdata-answers.txt`.

---

**1.** A company must ingest real-time clickstream data (sub-second) and allow multiple applications to consume and replay it. Which service?

- A. Amazon Kinesis Data Streams
- B. Amazon Kinesis Data Firehose
- C. Amazon SQS
- D. Amazon Athena

**2.** Streaming data must be delivered (near real-time) to Amazon S3 and Redshift with optional Lambda transformation and NO server management. Which service?

- A. Kinesis Data Streams
- B. Kinesis Data Firehose
- C. Amazon EMR
- D. AWS Glue

**3.** A team wants to run ad-hoc SQL queries directly against data in S3 without loading it into a database, paying per data scanned. Which service?

- A. Amazon Redshift
- B. Amazon Athena
- C. Amazon EMR
- D. Amazon QuickSight

**4.** A company needs a serverless ETL service to crawl data, infer schema into a catalog, and transform data for analytics. Which service?

- A. AWS Glue
- B. Amazon Kinesis
- C. AWS Data Pipeline
- D. Amazon Athena

**5.** A data science team must run Apache Spark and Hadoop jobs on large datasets using managed clusters. Which service?

- A. Amazon EMR
- B. Amazon Redshift
- C. AWS Glue
- D. Amazon Athena

**6.** A company needs full-text search and log analytics with dashboards (Kibana/OpenSearch Dashboards). Which service?

- A. Amazon OpenSearch Service
- B. Amazon Athena
- C. Amazon QuickSight
- D. Amazon Redshift

**7.** Business analysts need interactive BI dashboards with an in-memory engine (SPICE) and pay-per-session pricing. Which service?

- A. Amazon QuickSight
- B. Amazon OpenSearch
- C. AWS Glue
- D. Amazon EMR

**8.** A company is building a data lake on S3 and needs centralized, fine-grained permissions and governance over the data. Which service?

- A. AWS Lake Formation
- B. AWS Glue only
- C. Amazon Macie
- D. AWS Config

**9.** To reduce Athena cost and improve performance on large datasets, which optimization is MOST effective?

- A. Store data as uncompressed CSV
- B. Convert data to columnar formats (Parquet/ORC) and partition it
- C. Increase the S3 storage class to Standard
- D. Use a single large object

**10.** A pipeline must run SQL analytics on streaming data in real time (e.g., anomaly detection over a time window). Which service?

- A. Amazon Athena
- B. Amazon Managed Service for Apache Flink (Kinesis Data Analytics)
- C. AWS Glue
- D. Amazon QuickSight

**11.** Which service is BEST for a petabyte-scale data warehouse with complex joins and BI reporting?

- A. Amazon Redshift
- B. Amazon DynamoDB
- C. Amazon Athena
- D. Amazon RDS

**12.** A company wants to query data stored in both Redshift and S3 in a single query without loading S3 data into Redshift. Which feature?

- A. Redshift Spectrum
- B. Redshift Concurrency Scaling
- C. Redshift RA3 managed storage
- D. Redshift Serverless

**13.** Kinesis Data Streams throughput is hitting limits. Which action increases capacity in provisioned mode?

- A. Increase message retention
- B. Add more shards (resharding)
- C. Enable long polling
- D. Switch to SQS FIFO

**14.** A workload needs to migrate from self-managed Apache Kafka with minimal application changes. Which service?

- A. Amazon MSK (Managed Streaming for Apache Kafka)
- B. Amazon Kinesis Data Streams
- C. Amazon SQS
- D. Amazon MQ

**15.** Which destination is NOT natively supported by Kinesis Data Firehose?

- A. Amazon S3
- B. Amazon Redshift
- C. Amazon OpenSearch
- D. Amazon SQS

**16.** A company wants to analyze VPC Flow Logs and CloudTrail logs ad-hoc using SQL with the least setup. Which service?

- A. Amazon Athena
- B. Amazon EMR
- C. Amazon Redshift
- D. AWS Glue DataBrew

**17.** Which statement best distinguishes Kinesis Data Streams from Firehose?

- A. Firehose is for custom real-time consumers; Streams auto-loads to destinations
- B. Streams is real-time with custom consumers/replay; Firehose is near-real-time managed delivery
- C. Both guarantee exactly-once ordering at 1 ms latency
- D. Firehose requires managing shards

**18.** A retail company needs nightly batch ETL over terabytes with Spark, then load results into Redshift. Which two services fit BEST? (Choose TWO)

- A. Amazon EMR (or AWS Glue) for Spark ETL
- B. Amazon Redshift as the warehouse
- C. Amazon SQS
- D. Amazon Cognito
- E. AWS Shield

**19.** A company needs visual data preparation (cleaning/normalizing) for analysts without writing code. Which service?

- A. AWS Glue DataBrew
- B. Amazon Athena
- C. Amazon EMR
- D. Amazon QuickSight

**20.** Which approach minimizes cost for an analytics workload that queries S3 only a few times per month?

- A. Always-on Redshift cluster
- B. Amazon Athena (serverless, pay-per-query)
- C. Always-on EMR cluster
- D. Provisioned Kinesis stream
