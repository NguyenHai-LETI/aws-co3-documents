---
pack: saa-17-gap-services-v1
title: 17 · Gap Services (frequently-tested but under-covered) · V1
exam: SAA-C03
origin: imported
source: practice-exams/17-gap-services-exam.md
created: 2026-10-16
---

# 17 · Gap Services (frequently-tested but under-covered) · V1

> Imported from `practice-exams/17-gap-services-exam.md` + `17-gap-services-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 17-v1-01
- domain: resilient
- topic: database
- services: RDS Proxy, Lambda, RDS
- tags: connection-pooling
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q1

Hundreds of Lambda functions open too many connections to an RDS database, exhausting it. Which managed service provides connection pooling and faster failover?

- A. RDS Proxy
- B. ElastiCache
- C. Read Replica
- D. DAX

**Answer:** A

**Explanation:** Connection pooling + faster failover for Lambda+RDS = RDS Proxy.

---

## Q 17-v1-02
- domain: secure
- topic: security
- services: RAM, VPC, Transit Gateway
- tags: subnets
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q2

An organization wants to SHARE a centrally-managed VPC subnet (and Transit Gateway) with other accounts in its Organization. Which service?

- A. AWS Resource Access Manager (RAM)
- B. VPC Peering
- C. AWS Organizations SCP
- D. PrivateLink

**Answer:** A

**Explanation:** Share subnets/Transit Gateway across accounts = AWS RAM.

---

## Q 17-v1-03
- domain: secure
- topic: networking
- services: VPC, VPC Flow Logs
- tags: subnets
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q3

A security team must investigate which source/destination IPs were ACCEPTED or REJECTED for traffic in a VPC subnet. Which feature provides this data?

- A. VPC Flow Logs
- B. CloudTrail
- C. AWS Config
- D. GuardDuty only

**Answer:** A

**Explanation:** Accepted/Rejected IP traffic detail = VPC Flow Logs.

---

## Q 17-v1-04
- domain: secure
- topic: networking
- services: Route 53 Resolver, VPC
- tags: hybrid-dns
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q4

On-premises servers must resolve DNS names of resources in a VPC (and vice versa) for hybrid DNS. Which feature?

- A. Route 53 Resolver inbound/outbound endpoints
- B. Route 53 public hosted zone
- C. CloudFront
- D. Internet Gateway

**Answer:** A

**Explanation:** Hybrid DNS on-prem <-> VPC = Route 53 Resolver endpoints.

---

## Q 17-v1-05
- domain: secure
- topic: analytics
- services: MSK
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q5

A company migrating self-managed Apache Kafka wants a managed, Kafka-compatible streaming service. Which service?

- A. Amazon MSK
- B. Amazon Kinesis Data Streams
- C. Amazon SQS
- D. Amazon MQ

**Answer:** A

**Explanation:** Managed Kafka-compatible streaming = Amazon MSK.

---

## Q 17-v1-06
- domain: secure
- topic: networking
- services: Network Firewall, VPC
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q6

A VPC needs stateful, managed network firewall capabilities (intrusion prevention, domain filtering) at the VPC perimeter. Which service?

- A. AWS Network Firewall
- B. Security Groups only
- C. AWS WAF
- D. Amazon GuardDuty

**Answer:** A

**Explanation:** Stateful managed VPC firewall/IPS/domain filtering = AWS Network Firewall.

---

## Q 17-v1-07
- domain: secure
- topic: networking
- services: GWLB, ELB
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q7

Traffic must be transparently inspected by third-party virtual firewall appliances before reaching applications. Which load balancer enables this insertion?

- A. Gateway Load Balancer (GWLB)
- B. Application Load Balancer
- C. Network Load Balancer
- D. Classic Load Balancer

**Answer:** A

**Explanation:** Insert third-party firewall appliances transparently = Gateway Load Balancer.

---

## Q 17-v1-08
- domain: cost
- topic: storage
- services: S3
- tags: s3-storage-lens
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q8

Which service provides organization-wide visibility and recommendations on S3 storage usage and activity to optimize cost?

- A. S3 Storage Lens
- B. S3 Inventory only
- C. Amazon Macie
- D. AWS Config

**Answer:** A

**Explanation:** Org-wide S3 usage visibility/optimization = S3 Storage Lens.

---

## Q 17-v1-09
- domain: performance
- topic: database
- services: Aurora
- tags: aurora-serverless
- difficulty: easy
- time: 50
- source: practice-exams/17-gap-services-exam.md#Q9

A serverless internal app is idle most of the time but bursts during the day; the team wants a relational DB that scales capacity automatically and quickly. Which option?

- A. Aurora Serverless v2
- B. RDS Single-AZ largest instance
- C. DynamoDB on-demand
- D. Redshift Serverless

**Answer:** A

**Explanation:** Idle-then-bursty relational, fast auto-scale = Aurora Serverless v2.

---

## Q 17-v1-10
- domain: secure
- topic: storage
- services: S3, Lambda
- tags: s3-object-lambda
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q10

Which feature lets you transform and modify objects retrieved from S3 on the fly (e.g., redact PII) using a Lambda without storing copies?

- A. S3 Object Lambda
- B. S3 Select
- C. S3 Batch Operations
- D. S3 Inventory

**Answer:** A

**Explanation:** Modify S3 objects on retrieval via Lambda = S3 Object Lambda.

---

## Q 17-v1-11
- domain: secure
- topic: integration
- services: EventBridge, SQS, DynamoDB, MSK
- tags: dynamodb-streams, event-driven
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q11

Which service creates a point-to-point integration between a source (e.g., SQS, DynamoDB Streams, Kafka) and a target, with optional filtering and enrichment, with minimal code?

- A. Amazon EventBridge Pipes
- B. AWS Step Functions
- C. Amazon SNS
- D. AWS Glue

**Answer:** A

**Explanation:** Point-to-point source->target w/ filter/enrich = EventBridge Pipes.

---

## Q 17-v1-12
- domain: secure
- topic: security
- services: IAM, Secrets Manager, Lambda, RDS Proxy
- tags: iam-db-auth
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q12

A company wants IAM database authentication and to avoid storing DB passwords in Lambda. RDS Proxy supports which of these?

- A. IAM authentication and Secrets Manager integration
- B. Only username/password in code
- C. Encryption of the database engine
- D. Cross-Region replication

**Answer:** A

**Explanation:** RDS Proxy supports IAM auth + Secrets Manager.

---

## Q 17-v1-13
- domain: secure
- topic: management
- services: CloudWatch, S3, VPC, VPC Flow Logs
- difficulty: medium
- time: 70
- source: practice-exams/17-gap-services-exam.md#Q13

VPC Flow Logs can be delivered to which destinations? (Choose TWO)

- A. Amazon CloudWatch Logs
- B. Amazon S3
- C. Amazon SQS
- D. Amazon EBS
- E. AWS Config

**Answer:** A, B

**Explanation:** Flow Logs delivered to CloudWatch Logs and S3 (also Firehose).

---

## Q 17-v1-14
- domain: secure
- topic: security
- services: RAM, License Manager, Route 53 Resolver
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q14

A company wants to centrally share License Manager configurations and Route 53 Resolver rules across accounts. Which service enables resource sharing?

- A. AWS RAM
- B. AWS Organizations only
- C. AWS Config
- D. AWS Control Tower

**Answer:** A

**Explanation:** Share License Manager/Resolver rules across accounts = AWS RAM.

---

## Q 17-v1-15
- domain: secure
- topic: networking
- services: Internet Gateway, NAT Gateway
- tags: ipv6, subnets, egress-only-igw
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q15

An IPv6-only workload in a private subnet needs outbound-only internet access. Which component is used (NAT Gateway is IPv4)?

- A. Egress-only Internet Gateway
- B. NAT Gateway
- C. Internet Gateway
- D. Transit Gateway

**Answer:** A

**Explanation:** IPv6 outbound-only = Egress-only Internet Gateway.

---

## Q 17-v1-16
- domain: secure
- topic: networking
- services: Network Firewall, VPC
- difficulty: easy
- time: 50
- source: practice-exams/17-gap-services-exam.md#Q16

Which is the BEST way to enforce that outbound traffic from a VPC can only reach an approved list of domains?

- A. AWS Network Firewall with domain filtering
- B. Security Group outbound rules by domain
- C. NACL by domain name
- D. Route 53 public zone

**Answer:** A

**Explanation:** Approved-domain egress filtering = Network Firewall domain filtering.

---

## Q 17-v1-17
- domain: secure
- topic: security
- services: GuardDuty, VPC, VPC Flow Logs, CloudTrail
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q17

A team wants to detect threats by analyzing VPC Flow Logs, DNS logs, and CloudTrail automatically. Which service consumes these?

- A. Amazon GuardDuty
- B. AWS Config
- C. Amazon Macie
- D. AWS WAF

**Answer:** A

**Explanation:** Consumes Flow/DNS/CloudTrail logs for threats = GuardDuty.

---

## Q 17-v1-18
- domain: resilient
- topic: database
- services: RDS Proxy
- difficulty: easy
- time: 50
- source: practice-exams/17-gap-services-exam.md#Q18

Which RDS Proxy benefit is MOST relevant to improving application resilience during a database failover?

- A. It reduces failover time by managing connections and routing to the new primary
- B. It encrypts data at rest
- C. It adds read replicas automatically
- D. It provides a CDN

**Answer:** A

**Explanation:** RDS Proxy reduces failover time by managing/rerouting connections.

---

## Q 17-v1-19
- domain: secure
- topic: networking
- services: Transit Gateway, VPC, RAM
- tags: subnets, vpc-sharing
- difficulty: medium
- time: 75
- source: practice-exams/17-gap-services-exam.md#Q19

Which two scenarios are ideal use cases for AWS Resource Access Manager? (Choose TWO)

- A. Sharing a Transit Gateway across accounts
- B. Sharing subnets in a shared VPC
- C. Encrypting S3 objects
- D. Filtering web traffic for XSS
- E. Forecasting demand

**Answer:** A, B

**Explanation:** RAM use cases = share Transit Gateway and shared-VPC subnets.

---

## Q 17-v1-20
- domain: secure
- topic: networking
- services: Route 53 Resolver
- difficulty: easy
- time: 45
- source: practice-exams/17-gap-services-exam.md#Q20

A hybrid environment needs on-premises apps to send queries to AWS-hosted private DNS names. Which Route 53 Resolver endpoint type is used?

- A. Inbound endpoint
- B. Outbound endpoint
- C. Public hosted zone
- D. Health check

**Answer:** A

**Explanation:** On-prem queries to AWS private DNS = Route 53 Resolver inbound endpoint.
