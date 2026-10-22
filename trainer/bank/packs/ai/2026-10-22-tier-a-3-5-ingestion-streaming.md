---
pack: ai-2026-10-22-tier-a-3-5
title: "AI · Tầng A · Task 3.5 — Thu thập dữ liệu: streaming, Firehose, MSK, Transfer Family, zero-ETL"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 3.5"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 3.5: Kinesis Data Streams, Amazon Data Firehose, MSK, Managed Service for Apache Flink, Transfer Family, zero-ETL, truy cập an toàn vào điểm thu thập"
---

# AI · Tầng A · Task 3.5 — Thu thập dữ liệu: streaming, Firehose, MSK, Transfer Family, zero-ETL

## Q ai-20261022-a35-01
- domain: performance
- task: 3.5
- topic: analytics
- services: Aurora, Redshift
- tags: etl, streaming-ingestion
- difficulty: easy
- skills: 3.5.k1, 3.5.s2
- concept: Aurora zero-ETL integration with Redshift replicates transactional data continuously without building or running ETL pipelines
- refs: 09-analytics-bigdata.md
- hint: Dữ liệu phải sang Redshift gần như tức thì mà không cần dựng hay bảo trì pipeline ETL — tính năng tích hợp nào của Aurora?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 105

An e-commerce company runs its order database on Amazon Aurora MySQL. Analysts need dashboards in Amazon Redshift that reflect new orders within seconds. Today an hourly AWS Glue job copies changes to Redshift. The job fails when the schema changes and consumes engineering time. The company wants the data in Redshift continuously, without building or maintaining pipelines, and without adding query load to the production database. Which solution will meet these requirements?

- A. Create an Aurora zero-ETL integration with the Redshift data warehouse as the target and query the replicated database in Redshift
- B. Run an AWS DMS task with change data capture that writes to Redshift and keep a replication instance running for the database migration task
- C. Add an Aurora read replica for the analysts and query the database from Redshift by using federated queries instead of copying the data
- D. Send order events from the application to a Kinesis data stream and use Amazon Data Firehose to load them into Redshift

**Answer:** A

**Explanation:** An Aurora zero-ETL integration is a managed pipeline that replicates committed changes to Redshift continuously, so there is no ETL job to build or fix, and analytics run in Redshift rather than on the production cluster.
- DMS with change data capture: needs a replication instance and task to operate (tốn vận hành hơn)
- Federated queries on a read replica: the data is not copied, and the queries still run on Aurora (vi phạm ràng buộc)
- Application events through Kinesis and Firehose: requires application changes and a new pipeline (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/redshift/latest/mgmt/zero-etl-using.html
> 🇻🇳 Dữ liệu Aurora sang Redshift gần real-time, không pipeline → zero-ETL integration.

---

## Q ai-20261022-a35-02
- domain: performance
- task: 3.5
- topic: analytics
- services: Data Firehose, S3, Glue, Athena
- tags: columnar-formats, streaming-ingestion, data-lake
- difficulty: medium
- skills: 3.5.s7, 3.5.s6, 3.5.k7
- concept: Firehose record format conversion (JSON to Parquet using a Glue Data Catalog schema) plus dynamic partitioning by record keys prepares streaming data for Athena
- refs: 09-analytics-bigdata.md
- hint: Hai yêu cầu, hai tính năng của Firehose: định dạng cột cho Athena và thư mục theo trường trong bản ghi — không viết code consumer.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 145

A mobile game studio sends JSON telemetry events directly to Amazon Data Firehose. Analysts query the data in Amazon S3 with Amazon Athena and need it stored in a columnar format and organized by event date and game title so that queries scan less data. New data must be queryable within about ten minutes. The team does not want to write or run consumer code. Which combination of steps will meet these requirements? (Choose TWO)

- A. Add a Lambda transformation that converts the JSON events of the game to gzip format before Firehose delivers them to the S3 bucket in compressed files
- B. Turn on record format conversion to Apache Parquet and reference a Glue Data Catalog table that defines the schema of the JSON events
- C. Set the buffering interval hint to zero seconds so that Firehose delivers each record to the bucket as soon as it arrives in the stream
- D. Turn on dynamic partitioning and extract the event date and game title from each JSON record with jq expressions to form the S3 prefix
- E. Configure a custom S3 prefix that uses the delivery date of each event so that Firehose writes the objects into year, month, and day folders regardless of the game title

**Answer:** B, D

**Explanation:** Format conversion turns the JSON events into Parquet by using the Glue table schema, and dynamic partitioning writes objects under prefixes built from record fields, so Athena scans fewer columns and partitions.
- Gzip in Lambda: compression does not create a columnar format (dùng sai tính năng)
- Zero buffering interval: not available with dynamic partitioning, and it produces many tiny objects (dùng sai tính năng)
- Delivery-timestamp prefix: partitions by arrival time and ignores the game title (đúng một phần)
Docs: https://docs.aws.amazon.com/firehose/latest/dev/record-format-conversion.html
> 🇻🇳 Firehose → S3 cho Athena: chuyển JSON sang Parquet (schema Glue) + dynamic partitioning theo trường dữ liệu.

---

## Q ai-20261022-a35-03
- domain: performance
- task: 3.5
- topic: analytics
- services: Kinesis Data Streams
- tags: streaming-ingestion, kinesis-shards
- difficulty: medium
- skills: 3.5.k7, 3.5.s2
- concept: Enhanced fan-out gives each registered consumer dedicated per-shard read throughput and push delivery, lowering propagation delay when several consumers share a stream
- refs: 09-analytics-bigdata.md
- hint: Nhiều consumer chia sẻ băng thông đọc của mỗi shard nên độ trễ tăng — cơ chế nào cấp băng thông đọc riêng cho từng consumer?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A payments company writes transaction events to an Amazon Kinesis data stream. Five independent applications, including a fraud-scoring service, read every record by using the shared-throughput GetRecords API. After the fifth application was added, the fraud service receives records about a second after they are written, and several consumers report read throttling. The fraud service needs the lowest possible propagation delay, and every consumer must still receive each record. Which solution will meet these requirements?

- A. Register each consumer application as an enhanced fan-out consumer so that each one receives dedicated read throughput per shard
- B. Increase the retention period of the stream so that every slower consumer receives its records later without being throttled by the shards
- C. Replace the stream with an Amazon Data Firehose stream that delivers the records to five separate S3 buckets for the applications
- D. Reduce the polling interval of each consumer so that the applications call GetRecords more often and read records sooner from the shards

**Answer:** A

**Explanation:** Shared-throughput consumers split 2 MB per second per shard, which raises delay as consumers are added. Enhanced fan-out gives each registered consumer its own pipe per shard and pushes records over HTTP/2, so the propagation delay stays low.
- Longer retention: stores records longer but does not add read throughput (giải bài toán khác)
- Firehose to S3 buckets: delivers files near real time and offers no low-latency record reads (giải bài toán khác)
- More frequent polling: consumers still share the same per-shard limit, so throttling increases (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/streams/latest/dev/enhanced-consumers.html
> 🇻🇳 Nhiều consumer + cần độ trễ thấp nhất → enhanced fan-out (băng thông đọc riêng mỗi consumer, push qua HTTP/2).

---

## Q ai-20261022-a35-04
- domain: performance
- task: 3.5
- topic: migration
- services: Transfer Family, S3
- tags: bastion-host
- difficulty: medium
- skills: 3.5.k3, 3.5.k5
- concept: A Transfer Family SFTP server with a public endpoint and service-managed users is the lowest-overhead way to ingest SFTP files into S3
- refs: 10-migration-transfer.md
- hint: Nhà cung cấp giữ nguyên client SFTP và đội vận hành nhỏ không muốn vá server — dịch vụ SFTP được quản lý nào cấu hình ít nhất?
- status: draft
- family: sftp-ingestion-endpoint
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A retail company receives daily inventory files from 40 suppliers. The suppliers use SFTP clients that they cannot change, and the files must be stored in an Amazon S3 bucket. The suppliers' source IP address ranges are static and known. The operations team is small and does not want to patch servers. Which solution will meet these requirements with the LEAST operational overhead?

- A. Launch an EC2 instance with an Elastic IP address that runs an SFTP server, restrict its security group to the supplier IP ranges, and copy new files to the bucket with a scheduled job
- B. Create an Amazon API Gateway REST API with an S3 integration and give each supplier an API key and a script that uploads the files over HTTPS
- C. Create an AWS Transfer Family SFTP server with a publicly accessible endpoint and service-managed users that authenticate with SSH keys and map to the bucket
- D. Create a Transfer Family SFTP server with an internet-facing VPC endpoint, associate Elastic IP addresses, and attach a security group that allows the supplier IP ranges

**Answer:** C

**Explanation:** A Transfer Family server with a public endpoint and service-managed users needs no VPC networking or servers to run, accepts standard SFTP clients, and writes straight to S3.
- EC2-hosted SFTP server: the team patches and operates the server and the copy job (tốn vận hành hơn)
- API Gateway with API keys: suppliers cannot change their SFTP clients (vi phạm ràng buộc)
- VPC endpoint with Elastic IPs and a security group: works but adds networking to configure and maintain (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/transfer/latest/userguide/create-server-in-vpc.html
> 🇻🇳 SFTP vào S3, ít vận hành nhất → Transfer Family với endpoint công khai và user do service quản lý.

---

## Q ai-20261022-a35-05
- domain: performance
- task: 3.5
- topic: analytics
- services: Kinesis Data Streams
- tags: sharding, kinesis-shards, streaming-ingestion
- difficulty: hard
- skills: 3.5.k6, 3.5.s2, 3.5.s6
- concept: A hot partition key can exceed one shard's limit; neither on-demand mode nor more shards fix it, so a higher-cardinality key that keeps per-entity order is needed
- refs: 09-analytics-bigdata.md
- hint: Một khoá phân vùng duy nhất vượt giới hạn của một shard — cần khoá có nhiều giá trị hơn mà vẫn giữ thứ tự theo từng xe.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 130

A logistics company streams GPS events from 60,000 trucks into a provisioned-mode Kinesis data stream. Producers use the truck's depot ID as the partition key, and about 25 depots exist. One central depot generates more traffic than a single shard can ingest, so producers receive WriteProvisionedThroughputExceeded errors while most other shards are nearly idle. Events from the same truck must be processed in order. Which solution will stop the throttling?

- A. Switch the stream to on-demand capacity mode so that Kinesis Data Streams splits the busy shards automatically as traffic grows
- B. Change the partition key to the truck ID so that records spread across the shards while the events of each truck stay in one shard
- C. Double the shard count by calling UpdateShardCount so that the hash key range of the busy depot's truck events is divided across more shards
- D. Use a random UUID as the partition key for each record of the truck events so that the writes spread evenly across the shards of the stream

**Answer:** B

**Explanation:** A partition key maps to exactly one shard, so a depot whose traffic exceeds one shard cannot be fixed by capacity changes. Truck ID has high cardinality and keeps each truck's events in one shard, preserving order.
- On-demand mode: it cannot split a single hot partition key below one shard's limit (dùng sai tính năng)
- More shards: the busy depot's key still hashes to one shard (dùng sai tính năng)
- Random UUID key: spreads writes but breaks per-truck ordering (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/streams/latest/dev/how-do-i-size-a-stream.html
> 🇻🇳 Hot key vượt giới hạn 1 shard → đổi partition key sang giá trị phân tán hơn nhưng vẫn theo từng xe (giữ thứ tự).

---

## Q ai-20261022-a35-06
- domain: performance
- task: 3.5
- topic: analytics
- services: Managed Apache Flink, Kinesis Data Streams, OpenSearch, Lambda, Data Firehose, Athena
- tags: streaming-ingestion
- difficulty: hard
- skills: 3.5.s2, 3.5.k7
- concept: Stateful windowed event-time aggregation over a stream with late events needs Managed Service for Apache Flink, not per-record Lambda or Firehose transformation
- refs: 09-analytics-bigdata.md
- hint: Cửa sổ trượt theo thời gian sự kiện, sự kiện đến muộn vẫn đúng — cần engine xử lý luồng có trạng thái, không chỉ xử lý từng bản ghi.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A ride-sharing company streams driver GPS events into an Amazon Kinesis data stream. The company must show, for each city, the number of distinct active drivers over a five-minute sliding window that updates every minute, and the counts must stay correct when events arrive late or out of order. Results must reach an Amazon OpenSearch Service dashboard within seconds, and the team wants a managed solution. Which solution will meet these requirements?

- A. Create a Lambda function with a Kinesis event source mapping that keeps running counters per city for each sliding window in DynamoDB and expires old counters with a time to live setting
- B. Create an Amazon Managed Service for Apache Flink application that computes sliding event-time windows by city and writes the results to OpenSearch Service
- C. Create an Amazon Data Firehose stream that reads the data stream, applies a Lambda transformation to each record, and delivers the output per city to OpenSearch Service
- D. Schedule an Amazon Athena query every minute against the S3 copy of the events and publish the results to the OpenSearch Service dashboard

**Answer:** B

**Explanation:** Apache Flink keeps state per window and supports event-time windows with late-event handling, and the managed service runs it without cluster administration, writing results to OpenSearch within seconds.
- Lambda with DynamoDB counters: hand-built window state and late-event logic to write and maintain (tốn vận hành hơn)
- Firehose with a Lambda transformation: processes records one at a time and cannot compute windows (dùng sai tính năng)
- Scheduled Athena queries: minute-level batch latency over S3 copies, not seconds (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/managed-flink/latest/java/what-is.html
> 🇻🇳 Cửa sổ trượt + sự kiện đến muộn + trạng thái → Managed Service for Apache Flink (không phải Lambda/Firehose).

---

## Q ai-20261022-a35-07
- domain: performance
- task: 3.5
- topic: migration
- services: Transfer Family, S3
- tags: bastion-host
- difficulty: medium
- skills: 3.5.k5, 3.5.k3
- concept: A VPC-hosted internet-facing Transfer Family endpoint with Elastic IPs and a security group restricts SFTP access to known IP ranges
- refs: 10-migration-transfer.md
- hint: Cần giới hạn ở tầng mạng chỉ các dải IP đã biết mới kết nối được SFTP — endpoint loại nào hỗ trợ security group và IP tĩnh?
- status: draft
- family: sftp-ingestion-endpoint
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A retail company receives daily inventory files from 40 suppliers. The suppliers use SFTP clients that they cannot change, and the files must be stored in an Amazon S3 bucket. The suppliers' source IP address ranges are static and known. The operations team is small and does not want to patch servers. Which solution will meet these requirements MOST securely?

- A. Launch an EC2 instance with an Elastic IP address that runs an SFTP server, restrict its security group to the supplier IP ranges, and copy new files to the bucket with a scheduled job
- B. Create an Amazon API Gateway REST API with an S3 integration and give each supplier an API key and a script that uploads the files over HTTPS
- C. Create an AWS Transfer Family SFTP server with a publicly accessible endpoint and service-managed users that authenticate with SSH keys and map to the bucket
- D. Create a Transfer Family SFTP server with an internet-facing VPC endpoint, associate Elastic IP addresses, and attach a security group that allows the supplier IP ranges

**Answer:** D

**Explanation:** An internet-facing VPC endpoint accepts connections only from the source ranges that its security group allows, and the Elastic IP addresses give the suppliers fixed targets, while the managed service removes servers to patch.
- EC2-hosted SFTP server: you own operating system patching and hardening, a larger attack surface (vi phạm ràng buộc)
- API Gateway with API keys: not SFTP, so the suppliers' clients cannot connect (vi phạm ràng buộc)
- Public endpoint: has no security group, so any internet host can attempt to connect (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/transfer/latest/userguide/create-server-in-vpc.html
> 🇻🇳 Bảo mật nhất cho SFTP vào S3 → Transfer Family endpoint VPC internet-facing + Elastic IP + security group allow-list.

---

## Q ai-20261022-a35-08
- domain: performance
- task: 3.5
- topic: analytics
- services: MSK, IAM
- tags: streaming-ingestion, cross-account-access
- difficulty: hard
- skills: 3.5.k5, 3.5.k7
- concept: MSK multi-VPC private connectivity (PrivateLink) with IAM access control and a cluster policy lets clients in other accounts connect privately, even with overlapping CIDRs
- refs: 09-analytics-bigdata.md
- hint: CIDR trùng nhau nên peering/TGW không dùng được; client nằm ở tài khoản khác, xác thực bằng IAM — tính năng riêng của MSK cho việc này.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 155

A ride-hailing company is moving its event backbone from self-managed Apache Kafka on EC2 to Amazon MSK. The Kafka client applications belong to three other teams, each with its own AWS account and VPC, and several of those VPC CIDR ranges overlap with the cluster's VPC. Traffic must stay off the internet, clients must authenticate with IAM roles instead of shared passwords, and the team wants to avoid managing network routing between the accounts. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create VPC peering connections between the MSK cluster's VPC and each client VPC and update the route tables of the VPCs
- B. Turn on multi-VPC private connectivity with IAM access control on the provisioned MSK cluster
- C. Turn on public access for the cluster and require SASL/SCRAM credentials instead of IAM for the MSK client applications of the three teams
- D. Attach a cluster policy that lets the client accounts create managed VPC connections to the cluster
- E. Replace the cluster with an Amazon Kinesis data stream and create an interface VPC endpoint in each client VPC

**Answer:** B, D

**Explanation:** Multi-VPC private connectivity is built on PrivateLink, works with overlapping CIDRs, and supports IAM authentication. A cluster policy authorizes the client accounts to create their managed VPC connections.
- VPC peering: cannot connect VPCs whose CIDR ranges overlap (vi phạm ràng buộc)
- Public access with SASL/SCRAM: exposes the brokers to the internet and uses passwords (vi phạm ràng buộc)
- Replacing the cluster with Kinesis: forces the teams to rewrite their Kafka client code (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/msk/latest/developerguide/aws-access-mult-vpc.html
> 🇻🇳 Client Kafka ở tài khoản/VPC khác, CIDR trùng, IAM, riêng tư → MSK multi-VPC private connectivity + cluster policy.

---

## Q ai-20261022-a35-09
- domain: performance
- task: 3.5
- topic: analytics
- services: Lambda, Kinesis Data Streams, DynamoDB, Data Firehose, Managed Apache Flink
- tags: streaming-ingestion, serverless-cost
- difficulty: medium
- skills: 3.5.s2, 3.5.k7
- concept: A Lambda event source mapping on Kinesis processes records per shard in order for stateless per-record transformation; Firehose cannot deliver to DynamoDB
- refs: 09-analytics-bigdata.md
- hint: Xử lý độc lập từng bản ghi, giữ thứ tự theo tài xế, không quản lý server, đích là DynamoDB — Firehose có đích này không?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A ride-hailing company writes driver location updates to an Amazon Kinesis data stream, using the driver ID as the partition key. A new feature must enrich each update with the driver's city and store the latest position in an Amazon DynamoDB table within a couple of seconds. Each record is processed independently, updates for one driver must be applied in order, and the team wants the LEAST operational overhead without managing servers. Which solution will meet these requirements?

- A. Create an Amazon Data Firehose stream that reads from the data stream and delivers the enriched records directly to the DynamoDB table
- B. Create an Amazon Managed Service for Apache Flink application that enriches each update and writes it to the DynamoDB table
- C. Create a Lambda function that enriches each record and writes it to the DynamoDB table, with a Kinesis event source mapping on the stream
- D. Run a Kinesis Client Library consumer on an Auto Scaling group of EC2 instances that enriches the updates and writes them to the DynamoDB table

**Answer:** C

**Explanation:** A Lambda event source mapping reads each shard in order, so updates for one driver stay ordered. It scales with the shards, runs the enrichment per record, and needs no servers.
- Firehose to DynamoDB: DynamoDB is not a Firehose destination (cấu hình không tồn tại)
- Managed Service for Apache Flink: a stateful engine that is more than per-record enrichment needs, with more to develop and tune (tốn vận hành hơn)
- KCL consumers on EC2: instances to patch, scale, and monitor (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/lambda/latest/dg/with-kinesis.html
> 🇻🇳 Xử lý từng bản ghi, giữ thứ tự, không server, ghi DynamoDB → Lambda event source mapping (Firehose không có đích DynamoDB).

---

## Q ai-20261022-a35-10
- domain: performance
- task: 3.5
- topic: analytics
- services: Kinesis Data Streams, VPC Endpoint, Route 53 Resolver, Direct Connect
- tags: streaming-ingestion, iam-policies
- difficulty: hard
- skills: 3.5.k5, 3.5.k7
- concept: Securing a Kinesis ingestion point privately: interface endpoint, endpoint policy limited to writes on one stream, and DNS resolution of the private IPs for on-premises producers
- refs: 04-networking-services.md
- hint: Producer ở VPC kín và ở on-premises qua Direct Connect đều phải dùng IP riêng; cần giới hạn endpoint chỉ ghi vào một stream.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 180

A smart-meter company collects readings with collector applications on EC2 instances in private subnets that must have no internet or NAT routes, and with collectors at utility sites connected to the VPC through AWS Direct Connect with a private virtual interface. All readings go to a Kinesis data stream. Security requires that traffic use private IP addresses only, and that the collectors can write to this one stream but cannot read from it or use other streams. Which combination of steps will meet these requirements? (Choose THREE)

- A. Create a gateway VPC endpoint for Kinesis Data Streams and add it to the route tables of the private subnets
- B. Create an interface VPC endpoint for Kinesis Data Streams in the VPC and turn on private DNS for the endpoint
- C. Create a public virtual interface on Direct Connect so that the collectors at the utility sites reach the Kinesis public endpoints
- D. Attach an endpoint policy that limits the endpoint to kinesis:PutRecord and kinesis:PutRecords on the ARN of the stream
- E. Add a NAT gateway for the collector subnets and restrict their security group egress to the Kinesis public IP address ranges
- F. Forward the on-premises DNS queries for the regional Kinesis hostname to a Route 53 Resolver inbound endpoint in the VPC

**Answer:** B, D, F

**Explanation:** The interface endpoint gives private IPs reachable from the VPC and over Direct Connect, its policy allows only writes to the one stream, and the inbound resolver endpoint lets on-premises collectors resolve those private IPs.
- Gateway endpoint for Kinesis: gateway endpoints exist only for S3 and DynamoDB (cấu hình không tồn tại)
- Public virtual interface: reaches public service IPs, not private addresses (vi phạm ràng buộc)
- NAT gateway with security group egress: adds an internet route the subnets must not have (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/streams/latest/dev/vpc.html
> 🇻🇳 Thu thập an toàn vào Kinesis: interface endpoint + endpoint policy chỉ PutRecord + Resolver inbound endpoint cho on-prem.
