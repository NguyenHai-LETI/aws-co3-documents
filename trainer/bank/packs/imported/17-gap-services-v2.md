---
pack: saa-17-gap-services-v2
title: 17 · Gap Services · V2
exam: SAA-C03
origin: imported
source: practice-exams/17-gap-services-exam-v2.md
created: 2026-10-16
---

# 17 · Gap Services · V2

> Imported from `practice-exams/17-gap-services-exam-v2.md` + `17-gap-services-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 17-v2-01
- domain: secure
- task: 1.1
- topic: database
- services: RDS Proxy, Lambda, RDS, IAM
- difficulty: medium
- time: 50
- source: practice-exams/17-gap-services-exam-v2.md#Q1

Lambda functions exhaust RDS connections during spikes and need pooling + IAM auth + fast failover. Which service?

- A. Read Replica
- B. DAX
- C. ElastiCache
- D. RDS Proxy

**Answer:** D

**Explanation:** Lambda pooling + IAM auth + fast failover for RDS = RDS Proxy.

---

## Q 17-v2-02
- domain: secure
- task: 1.1
- topic: security
- services: RAM, Transit Gateway
- tags: subnets
- difficulty: medium
- time: 50
- source: practice-exams/17-gap-services-exam-v2.md#Q2

An organization must share private subnets and Transit Gateway across accounts within its Organization. Which service?

- A. AWS Resource Access Manager (RAM)
- B. VPC Peering
- C. PrivateLink
- D. Organizations SCP

**Answer:** A

**Explanation:** Share subnets/Transit Gateway across accounts = AWS Resource Access Manager (RAM).

---

## Q 17-v2-03
- domain: secure
- task: 1.2
- topic: networking
- services: VPC, VPC Flow Logs
- difficulty: medium
- time: 50
- source: practice-exams/17-gap-services-exam-v2.md#Q3

A team must troubleshoot dropped connectivity by capturing accepted/rejected IP traffic in a VPC. Which feature?

- A. Config
- B. CloudTrail
- C. GuardDuty
- D. VPC Flow Logs

**Answer:** D

**Explanation:** Capture accept/reject IP traffic = VPC Flow Logs.

---

## Q 17-v2-04
- domain: secure
- task: 1.2
- topic: networking
- services: Route 53 Resolver, Route 53
- difficulty: medium
- time: 50
- source: practice-exams/17-gap-services-exam-v2.md#Q4

On-premises servers must resolve records in a Route 53 private hosted zone. Which feature?

- A. Route 53 Resolver inbound endpoint
- B. Public hosted zone
- C. NAT Gateway
- D. CloudFront

**Answer:** A

**Explanation:** On-prem resolving Route 53 private zone = Resolver inbound endpoint.

---

## Q 17-v2-05
- domain: performance
- task: 3.5
- topic: analytics
- services: MSK, Kinesis Data Streams
- tags: streaming-ingestion
- difficulty: medium
- time: 50
- concept: Amazon MSK = managed service with native Apache Kafka APIs
- hint: Đề nhấn mạnh API Kafka gốc — chọn dịch vụ streaming được quản lý mà ứng dụng Kafka dùng nguyên không cần viết lại.
- enriched: 2026-10-16
- source: practice-exams/17-gap-services-exam-v2.md#Q5

A company using Apache Kafka wants a managed service with native Kafka APIs. Which service?

- A. SQS
- B. Amazon MSK
- C. Kinesis Data Streams
- D. Amazon MQ

**Answer:** B

**Explanation:** **Amazon MSK** is managed Apache Kafka, exposing native Kafka APIs so existing applications connect without code changes.
- SQS: a queue service with its own API, no Kafka protocol.
- Kinesis Data Streams: managed streaming, but it uses AWS-specific APIs rather than Kafka's.
- Amazon MQ: managed message broker for ActiveMQ/RabbitMQ protocols, not Kafka.
> 🇻🇳 Cần API Kafka gốc + managed → Amazon MSK.

---

## Q 17-v2-06
- domain: secure
- task: 1.2
- topic: database
- services: DynamoDB
- tags: ttl
- difficulty: medium
- time: 50
- source: practice-exams/17-gap-services-exam-v2.md#Q6

A DynamoDB table must auto-delete expired session records without a scheduled job. Which feature?

- A. DynamoDB TTL
- B. Global Tables
- C. Streams
- D. DAX

**Answer:** A

**Explanation:** Auto-delete expired items, no job = DynamoDB TTL.

---

## Q 17-v2-07
- domain: secure
- task: 1.2
- topic: networking
- services: GWLB, ELB
- difficulty: medium
- time: 55
- source: practice-exams/17-gap-services-exam-v2.md#Q7

Traffic must be transparently inspected by a fleet of third-party firewall appliances that scale horizontally. Which load balancer?

- A. Application Load Balancer
- B. Classic Load Balancer
- C. Network Load Balancer
- D. Gateway Load Balancer

**Answer:** D

**Explanation:** Transparent scalable appliance inspection = Gateway Load Balancer.

---

## Q 17-v2-08
- domain: secure
- task: 1.2
- topic: networking
- services: Network Firewall, VPC
- difficulty: medium
- time: 65
- enriched: 2026-10-21
- source: practice-exams/17-gap-services-exam-v2.md#Q8

A managed, stateful network firewall with intrusion prevention across a VPC is needed. Which service?

- A. AWS WAF, a web application firewall with no network-layer intrusion-prevention capability
- B. Security groups, stateful instance-level firewalls with no intrusion-prevention signatures
- C. AWS Network Firewall, a managed, stateful firewall with intrusion-prevention rule groups across the VPC
- D. Network ACLs, stateless subnet-level filters with no intrusion-prevention capability

**Answer:** C

**Explanation:** AWS Network Firewall is the managed service built specifically for stateful, VPC-wide traffic inspection, offering intrusion-prevention rule groups (Suricata-compatible) that security groups, NACLs, and WAF do not provide.
- AWS WAF: protects HTTP(S) applications at Layer 7 (behind CloudFront, ALB, or API Gateway); it has no network-layer intrusion-prevention capability.
- Security groups: stateful but instance-level only, with no deep packet inspection or intrusion-prevention signatures.
- Network ACLs: stateless subnet-level allow/deny rules, with no intrusion-prevention capability at all.
> 🇻🇳 Cần tường lửa có trạng thái + IPS toàn VPC → AWS Network Firewall; WAF/SG/NACL đều thiếu một phần yêu cầu này.

---

## Q 17-v2-09
- domain: secure
- task: 1.2
- topic: storage
- services: S3
- tags: s3-storage-lens
- difficulty: medium
- time: 50
- source: practice-exams/17-gap-services-exam-v2.md#Q9

A company wants organization-wide visibility into S3 usage and activity metrics with recommendations. Which feature?

- A. S3 Storage Lens
- B. S3 Inventory only
- C. Config
- D. CloudTrail

**Answer:** A

**Explanation:** Org-wide S3 usage metrics + recommendations = S3 Storage Lens.

---

## Q 17-v2-10
- domain: secure
- task: 1.3
- topic: storage
- services: S3, Lambda
- tags: s3-object-lambda
- difficulty: medium
- time: 55
- source: practice-exams/17-gap-services-exam-v2.md#Q10

Objects must be transformed (e.g., redact PII) as they are retrieved via a GET, without changing the stored object. Which feature?

- A. Byte-range fetch
- B. S3 Select
- C. S3 Object Lambda
- D. Lifecycle rule

**Answer:** C

**Explanation:** Transform objects on GET without changing stored object = S3 Object Lambda.

---

## Q 17-v2-11
- domain: secure
- task: 1.2
- topic: networking
- services: Route 53 Resolver, VPC
- tags: hybrid-dns
- difficulty: hard
- time: 95
- source: practice-exams/17-gap-services-exam-v2.md#Q11

A hybrid DNS setup needs VPC resources to resolve on-premises names AND on-premises to resolve VPC private names. Which two? (Choose TWO)

- A. Route 53 Resolver outbound endpoint with forwarding rules
- B. CloudFront
- C. Route 53 Resolver inbound endpoint
- D. Public hosted zone only
- E. Transit Gateway DNS

**Answer:** A, C

**Explanation:** Hybrid DNS = Resolver outbound (to on-prem) + inbound (from on-prem).

---

## Q 17-v2-12
- domain: secure
- task: 1.2
- topic: networking
- services: GWLB
- difficulty: hard
- time: 65
- source: practice-exams/17-gap-services-exam-v2.md#Q12

A traffic-inspection architecture chains a Gateway Load Balancer with appliances. Which encapsulation protocol does GWLB use?

- A. BGP
- B. GENEVE (port 6081)
- C. TLS only
- D. HTTP/2

**Answer:** B

**Explanation:** GWLB encapsulation = GENEVE (port 6081).

---

## Q 17-v2-13
- domain: secure
- task: 1.2
- topic: integration
- services: EventBridge, SQS
- tags: event-driven
- difficulty: hard
- time: 70
- source: practice-exams/17-gap-services-exam-v2.md#Q13

A serverless point-to-point integration must consume from an SQS queue, filter and enrich events, then send to a target with minimal code. Which service?

- A. Amazon MQ
- B. EventBridge Pipes
- C. SNS fan-out
- D. Step Functions Standard

**Answer:** B

**Explanation:** SQS -> filter/enrich -> target, low code = EventBridge Pipes.

---

## Q 17-v2-14
- domain: resilient
- task: 2.2
- topic: database
- services: RDS Proxy, Lambda, Aurora
- difficulty: hard
- time: 95
- source: practice-exams/17-gap-services-exam-v2.md#Q14

An RDS Proxy deployment for a Lambda + Aurora app improves resilience how? (Choose TWO)

- A. Caches query results like DAX
- B. Reduces failover time by managing connections during failover
- C. Pools and reuses database connections to avoid exhaustion
- D. Replaces the need for Multi-AZ
- E. Provides cross-Region replication

**Answer:** B, C

**Explanation:** RDS Proxy = connection pooling + reduced failover time.

---

## Q 17-v2-15
- domain: resilient
- task: 2.1
- topic: integration
- services: EventBridge
- tags: decoupling, event-driven
- difficulty: hard
- time: 70
- source: practice-exams/17-gap-services-exam-v2.md#Q15

A company must schedule millions of one-time and recurring tasks (cron/rate) with a managed, serverless scheduler decoupled from EventBridge buses. Which service?

- A. CloudWatch Logs
- B. Step Functions only
- C. Amazon EventBridge Scheduler
- D. SQS delay queue

**Answer:** C

**Explanation:** Managed serverless cron/rate scheduler = EventBridge Scheduler.
