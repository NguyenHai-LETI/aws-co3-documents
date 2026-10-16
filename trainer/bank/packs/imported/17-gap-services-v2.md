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
- topic: database
- services: RDS Proxy, Lambda, RDS, IAM
- difficulty: medium
- time: 50
- source: practice-exams/17-gap-services-exam-v2.md#Q1

Lambda functions exhaust RDS connections during spikes and need pooling + IAM auth + fast failover. Which service?

- A. RDS Proxy
- B. ElastiCache
- C. Read Replica
- D. DAX

**Answer:** A

**Explanation:** Lambda pooling + IAM auth + fast failover for RDS = RDS Proxy.

---

## Q 17-v2-02
- domain: secure
- topic: security
- services: RAM, Transit Gateway
- tags: subnets
- difficulty: medium
- time: 50
- source: practice-exams/17-gap-services-exam-v2.md#Q2

An organization must share private subnets and Transit Gateway across accounts within its Organization. Which service?

- A. AWS Resource Access Manager (RAM)
- B. VPC Peering
- C. Organizations SCP
- D. PrivateLink

**Answer:** A

**Explanation:** Share subnets/Transit Gateway across accounts = AWS Resource Access Manager (RAM).

---

## Q 17-v2-03
- domain: secure
- topic: networking
- services: VPC, VPC Flow Logs
- difficulty: medium
- time: 50
- source: practice-exams/17-gap-services-exam-v2.md#Q3

A team must troubleshoot dropped connectivity by capturing accepted/rejected IP traffic in a VPC. Which feature?

- A. VPC Flow Logs
- B. CloudTrail
- C. GuardDuty
- D. Config

**Answer:** A

**Explanation:** Capture accept/reject IP traffic = VPC Flow Logs.

---

## Q 17-v2-04
- domain: secure
- topic: networking
- services: Route 53 Resolver, Route 53
- difficulty: medium
- time: 50
- source: practice-exams/17-gap-services-exam-v2.md#Q4

On-premises servers must resolve records in a Route 53 private hosted zone. Which feature?

- A. Route 53 Resolver inbound endpoint
- B. Public hosted zone
- C. CloudFront
- D. NAT Gateway

**Answer:** A

**Explanation:** On-prem resolving Route 53 private zone = Resolver inbound endpoint.

---

## Q 17-v2-05
- domain: secure
- topic: analytics
- services: MSK
- difficulty: medium
- time: 50
- source: practice-exams/17-gap-services-exam-v2.md#Q5

A company using Apache Kafka wants a managed service with native Kafka APIs. Which service?

- A. Amazon MSK
- B. Kinesis Data Streams
- C. SQS
- D. Amazon MQ

**Answer:** A

**Explanation:** Managed Kafka with native APIs = Amazon MSK.

---

## Q 17-v2-06
- domain: secure
- topic: database
- services: DynamoDB
- tags: ttl
- difficulty: medium
- time: 50
- source: practice-exams/17-gap-services-exam-v2.md#Q6

A DynamoDB table must auto-delete expired session records without a scheduled job. Which feature?

- A. DynamoDB TTL
- B. Streams
- C. Global Tables
- D. DAX

**Answer:** A

**Explanation:** Auto-delete expired items, no job = DynamoDB TTL.

---

## Q 17-v2-07
- domain: secure
- topic: networking
- services: GWLB, ELB
- difficulty: medium
- time: 55
- source: practice-exams/17-gap-services-exam-v2.md#Q7

Traffic must be transparently inspected by a fleet of third-party firewall appliances that scale horizontally. Which load balancer?

- A. Gateway Load Balancer
- B. Application Load Balancer
- C. Network Load Balancer
- D. Classic Load Balancer

**Answer:** A

**Explanation:** Transparent scalable appliance inspection = Gateway Load Balancer.

---

## Q 17-v2-08
- domain: secure
- topic: networking
- services: Network Firewall, VPC
- difficulty: medium
- time: 50
- source: practice-exams/17-gap-services-exam-v2.md#Q8

A managed, stateful network firewall with intrusion prevention across a VPC is needed. Which service?

- A. AWS Network Firewall
- B. Security Groups only
- C. WAF only
- D. NACLs only

**Answer:** A

**Explanation:** Managed stateful firewall + IPS for VPC = AWS Network Firewall.

---

## Q 17-v2-09
- domain: secure
- topic: storage
- services: S3
- tags: s3-storage-lens
- difficulty: medium
- time: 50
- source: practice-exams/17-gap-services-exam-v2.md#Q9

A company wants organization-wide visibility into S3 usage and activity metrics with recommendations. Which feature?

- A. S3 Storage Lens
- B. S3 Inventory only
- C. CloudTrail
- D. Config

**Answer:** A

**Explanation:** Org-wide S3 usage metrics + recommendations = S3 Storage Lens.

---

## Q 17-v2-10
- domain: secure
- topic: storage
- services: S3, Lambda
- tags: s3-object-lambda
- difficulty: medium
- time: 55
- source: practice-exams/17-gap-services-exam-v2.md#Q10

Objects must be transformed (e.g., redact PII) as they are retrieved via a GET, without changing the stored object. Which feature?

- A. S3 Object Lambda
- B. S3 Select
- C. Lifecycle rule
- D. Byte-range fetch

**Answer:** A

**Explanation:** Transform objects on GET without changing stored object = S3 Object Lambda.

---

## Q 17-v2-11
- domain: secure
- topic: networking
- services: Route 53 Resolver, VPC
- tags: hybrid-dns
- difficulty: hard
- time: 95
- source: practice-exams/17-gap-services-exam-v2.md#Q11

A hybrid DNS setup needs VPC resources to resolve on-premises names AND on-premises to resolve VPC private names. Which two? (Choose TWO)

- A. Route 53 Resolver outbound endpoint with forwarding rules
- B. Route 53 Resolver inbound endpoint
- C. Public hosted zone only
- D. Transit Gateway DNS
- E. CloudFront

**Answer:** A, B

**Explanation:** Hybrid DNS = Resolver outbound (to on-prem) + inbound (from on-prem).

---

## Q 17-v2-12
- domain: secure
- topic: networking
- services: GWLB
- difficulty: hard
- time: 65
- source: practice-exams/17-gap-services-exam-v2.md#Q12

A traffic-inspection architecture chains a Gateway Load Balancer with appliances. Which encapsulation protocol does GWLB use?

- A. GENEVE (port 6081)
- B. HTTP/2
- C. TLS only
- D. BGP

**Answer:** A

**Explanation:** GWLB encapsulation = GENEVE (port 6081).

---

## Q 17-v2-13
- domain: secure
- topic: integration
- services: EventBridge, SQS
- tags: event-driven
- difficulty: hard
- time: 70
- source: practice-exams/17-gap-services-exam-v2.md#Q13

A serverless point-to-point integration must consume from an SQS queue, filter and enrich events, then send to a target with minimal code. Which service?

- A. EventBridge Pipes
- B. Step Functions Standard
- C. SNS fan-out
- D. Amazon MQ

**Answer:** A

**Explanation:** SQS -> filter/enrich -> target, low code = EventBridge Pipes.

---

## Q 17-v2-14
- domain: resilient
- topic: database
- services: RDS Proxy, Lambda, Aurora
- difficulty: hard
- time: 95
- source: practice-exams/17-gap-services-exam-v2.md#Q14

An RDS Proxy deployment for a Lambda + Aurora app improves resilience how? (Choose TWO)

- A. Pools and reuses database connections to avoid exhaustion
- B. Reduces failover time by managing connections during failover
- C. Caches query results like DAX
- D. Provides cross-Region replication
- E. Replaces the need for Multi-AZ

**Answer:** A, B

**Explanation:** RDS Proxy = connection pooling + reduced failover time.

---

## Q 17-v2-15
- domain: resilient
- topic: integration
- services: EventBridge
- tags: decoupling, event-driven
- difficulty: hard
- time: 70
- source: practice-exams/17-gap-services-exam-v2.md#Q15

A company must schedule millions of one-time and recurring tasks (cron/rate) with a managed, serverless scheduler decoupled from EventBridge buses. Which service?

- A. Amazon EventBridge Scheduler
- B. SQS delay queue
- C. Step Functions only
- D. CloudWatch Logs

**Answer:** A

**Explanation:** Managed serverless cron/rate scheduler = EventBridge Scheduler.
