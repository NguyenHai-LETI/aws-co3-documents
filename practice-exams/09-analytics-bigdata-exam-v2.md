# 📊 Practice Exam 09 — Analytics & Big Data (SAA-C03) · V2

**30 questions** · scenario-based · English. Answers in `09-analytics-bigdata-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q20
- **Part B — Khó / Nâng cao:** Q21–Q30

---

## Part A — Vận dụng (20 câu)

**1.** A company must ingest streaming clickstream data in real time and allow multiple applications to process the same records. Which service?

- A. Kinesis Data Streams
- B. Kinesis Data Firehose
- C. Amazon SQS
- D. Amazon Athena

**2.** Streaming data must be delivered to S3/Redshift with the LEAST management and near-real-time (buffered) loading, no custom consumers. Which service?

- A. Kinesis Data Streams
- B. Kinesis Data Firehose
- C. Amazon MSK
- D. EMR

**3.** A company wants to run SQL queries directly on data stored in S3 without loading it into a database, paying per query. Which service?

- A. Amazon Athena
- B. Amazon Redshift
- C. Amazon RDS
- D. Amazon EMR

**4.** A serverless ETL service must crawl data, build a catalog, and transform data between stores. Which service?

- A. AWS Glue
- B. Amazon EMR
- C. Kinesis
- D. Athena

**5.** A team needs managed Hadoop/Spark clusters for large-scale big-data processing with full control. Which service?

- A. Amazon EMR
- B. AWS Glue
- C. Athena
- D. QuickSight

**6.** A company needs a managed search and log analytics engine with dashboards (Kibana-style). Which service?

- A. Amazon OpenSearch Service
- B. Amazon Athena
- C. Amazon Redshift
- D. Kinesis

**7.** Business users need interactive BI dashboards and visualizations with a managed, serverless service. Which service?

- A. Amazon QuickSight
- B. Amazon Athena
- C. AWS Glue
- D. OpenSearch

**8.** Athena queries on large S3 datasets are slow and expensive. Which two optimizations reduce cost and improve performance? (Choose TWO)

- A. Convert data to columnar formats (Parquet/ORC)
- B. Partition the data in S3
- C. Store as uncompressed CSV
- D. Query with SELECT *
- E. Use a single large file

**9.** A company must catalog metadata so Athena, EMR, and Redshift Spectrum can share table definitions. Which component?

- A. AWS Glue Data Catalog
- B. S3 Inventory
- C. DynamoDB
- D. CloudTrail

**10.** Redshift must query data in S3 without loading it into the cluster. Which feature?

- A. Redshift Spectrum
- B. Athena federation
- C. Glue crawler
- D. EMR

**11.** A streaming pipeline must transform and enrich records in real time using SQL/Apache Flink. Which service?

- A. Kinesis Data Analytics (Managed Service for Apache Flink)
- B. Kinesis Data Firehose
- C. Athena
- D. Glue

**12.** A company already uses Apache Kafka and wants a managed Kafka service on AWS. Which service?

- A. Amazon MSK
- B. Kinesis Data Streams
- C. Amazon SQS
- D. Amazon MQ

**13.** Firehose must deliver streaming data to S3 in Parquet format and buffer records before writing. Which capability applies?

- A. Firehose record format conversion + buffering
- B. Kinesis Data Streams shards
- C. Athena partitions
- D. Glue crawler

**14.** A Kinesis Data Stream is throttling on writes. Which action increases capacity?

- A. Increase the number of shards (resharding/split)
- B. Increase visibility timeout
- C. Add a DLQ
- D. Enable long polling

**15.** A company needs a governed data lake with fine-grained permissions on S3-based tables across analytics services. Which service?

- A. AWS Lake Formation
- B. Amazon Athena
- C. AWS Glue only
- D. Redshift

**16.** Which service is BEST to visualize log data ingested from applications for near-real-time operational dashboards and full-text search?

- A. Amazon OpenSearch Service
- B. Amazon Redshift
- C. Amazon Athena
- D. QuickSight only

**17.** A one-time ad-hoc analysis of infrequently accessed S3 logs is needed with no infrastructure to manage. Which is MOST cost-effective?

- A. Amazon Athena
- B. Amazon Redshift cluster
- C. Amazon EMR cluster
- D. RDS

**18.** Firehose vs Data Streams: which statement is TRUE?

- A. Firehose is fully managed delivery with no consumer code; Data Streams requires consumers and allows replay
- B. Firehose supports replay and shards
- C. Data Streams delivers directly to S3 with no code
- D. They are identical

**19.** A pipeline must load transformed data into Redshift daily and support complex joins for BI. Which combination is appropriate?

- A. Glue ETL to S3 → COPY into Redshift
- B. Athena writes directly into Redshift tables
- C. Kinesis Firehose only, no transform
- D. DynamoDB Streams to Redshift directly

**20.** A team needs to run Spark jobs on transient clusters that spin up, process, and terminate to save cost. Which service + option?

- A. EMR with transient clusters (auto-terminate)
- B. EMR always-on cluster
- C. Glue crawler only
- D. Redshift Spectrum

---

## Part B — Khó / Nâng cao (10 câu)

**21.** A Kinesis Data Stream must ingest 5,000 records/sec, each 2 KB. Each shard supports 1 MB/s or 1,000 records/s ingest. How many shards are needed (approximately)?

- A. 1 shard
- B. 5 shards (record-limit bound: 5,000/1,000)
- C. 2 shards
- D. 50 shards

**22.** Multiple independent consumers must each read the full stream at full throughput without contending for the 2 MB/s per-shard read limit. Which feature?

- A. Enhanced fan-out (dedicated 2 MB/s per consumer)
- B. More visibility timeout
- C. Firehose delivery
- D. Standard iterator only

**23.** An analytics platform must guarantee ordering of events per user while scaling across many users. In Kinesis, which controls which shard a record goes to?

- A. Partition key
- B. Sequence number
- C. Shard iterator
- D. Consumer group id

**24.** A company must minimize Athena cost on a multi-TB dataset queried by date. Which two design choices help MOST? (Choose TWO)

- A. Partition by date (e.g., year/month/day prefixes)
- B. Use columnar compressed formats (Parquet)
- C. Store as one giant JSON file
- D. Always SELECT *
- E. Disable partition projection

**25.** A streaming pipeline needs sub-second, exactly-once, stateful stream processing with windowing. Which service is BEST?

- A. Managed Service for Apache Flink (Kinesis Data Analytics)
- B. Kinesis Data Firehose
- C. Glue crawler
- D. Athena

**26.** A company compares MSK vs Kinesis Data Streams. Which two are advantages of MSK? (Choose TWO)

- A. Native Kafka API compatibility for existing Kafka apps
- B. Configurable retention and partitions like Kafka
- C. Fully serverless with no partition/shard concept ever
- D. No consumer code ever needed
- E. Automatic delivery to S3 without config

**27.** A near-real-time dashboard must be fed from a stream, buffering and delivering to OpenSearch with transformation. Which service handles delivery with format conversion and buffering?

- A. Kinesis Data Firehose (to OpenSearch)
- B. Kinesis Data Streams alone
- C. Glue crawler
- D. Athena federation

**28.** An EMR cluster processing sensitive data must minimize cost on task nodes while keeping core/HDFS stable. Which strategy?

- A. Spot Instances for task nodes, On-Demand/Reserved for core nodes
- B. Spot for all nodes including core
- C. On-Demand for everything
- D. Task nodes on Dedicated Hosts

**29.** A data lake must enforce column- and row-level security across Athena and Redshift Spectrum consistently. Which service provides this governance layer?

- A. AWS Lake Formation permissions
- B. S3 bucket policies only
- C. IAM only
- D. KMS grants

**30.** A Firehose stream must transform records with custom logic before delivery to S3. Which integration provides this?

- A. A Lambda function invoked by Firehose for record transformation
- B. Athena UDF
- C. Glue crawler
- D. Kinesis shard split
