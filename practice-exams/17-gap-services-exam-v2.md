# 🕳️ Practice Exam 17 — Gap Services (SAA-C03) · V2

**15 questions** · high-frequency "trap" services · English. Answers in `17-gap-services-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q10
- **Part B — Khó / Nâng cao:** Q11–Q15

---

## Part A — Vận dụng (10 câu)

**1.** Lambda functions exhaust RDS connections during spikes and need pooling + IAM auth + fast failover. Which service?

- A. RDS Proxy
- B. ElastiCache
- C. Read Replica
- D. DAX

**2.** An organization must share private subnets and Transit Gateway across accounts within its Organization. Which service?

- A. AWS Resource Access Manager (RAM)
- B. VPC Peering
- C. Organizations SCP
- D. PrivateLink

**3.** A team must troubleshoot dropped connectivity by capturing accepted/rejected IP traffic in a VPC. Which feature?

- A. VPC Flow Logs
- B. CloudTrail
- C. GuardDuty
- D. Config

**4.** On-premises servers must resolve records in a Route 53 private hosted zone. Which feature?

- A. Route 53 Resolver inbound endpoint
- B. Public hosted zone
- C. CloudFront
- D. NAT Gateway

**5.** A company using Apache Kafka wants a managed service with native Kafka APIs. Which service?

- A. Amazon MSK
- B. Kinesis Data Streams
- C. SQS
- D. Amazon MQ

**6.** A DynamoDB table must auto-delete expired session records without a scheduled job. Which feature?

- A. DynamoDB TTL
- B. Streams
- C. Global Tables
- D. DAX

**7.** Traffic must be transparently inspected by a fleet of third-party firewall appliances that scale horizontally. Which load balancer?

- A. Gateway Load Balancer
- B. Application Load Balancer
- C. Network Load Balancer
- D. Classic Load Balancer

**8.** A managed, stateful network firewall with intrusion prevention across a VPC is needed. Which service?

- A. AWS Network Firewall
- B. Security Groups only
- C. WAF only
- D. NACLs only

**9.** A company wants organization-wide visibility into S3 usage and activity metrics with recommendations. Which feature?

- A. S3 Storage Lens
- B. S3 Inventory only
- C. CloudTrail
- D. Config

**10.** Objects must be transformed (e.g., redact PII) as they are retrieved via a GET, without changing the stored object. Which feature?

- A. S3 Object Lambda
- B. S3 Select
- C. Lifecycle rule
- D. Byte-range fetch

---

## Part B — Khó / Nâng cao (5 câu)

**11.** A hybrid DNS setup needs VPC resources to resolve on-premises names AND on-premises to resolve VPC private names. Which two? (Choose TWO)

- A. Route 53 Resolver outbound endpoint with forwarding rules
- B. Route 53 Resolver inbound endpoint
- C. Public hosted zone only
- D. Transit Gateway DNS
- E. CloudFront

**12.** A traffic-inspection architecture chains a Gateway Load Balancer with appliances. Which encapsulation protocol does GWLB use?

- A. GENEVE (port 6081)
- B. HTTP/2
- C. TLS only
- D. BGP

**13.** A serverless point-to-point integration must consume from an SQS queue, filter and enrich events, then send to a target with minimal code. Which service?

- A. EventBridge Pipes
- B. Step Functions Standard
- C. SNS fan-out
- D. Amazon MQ

**14.** An RDS Proxy deployment for a Lambda + Aurora app improves resilience how? (Choose TWO)

- A. Pools and reuses database connections to avoid exhaustion
- B. Reduces failover time by managing connections during failover
- C. Caches query results like DAX
- D. Provides cross-Region replication
- E. Replaces the need for Multi-AZ

**15.** A company must schedule millions of one-time and recurring tasks (cron/rate) with a managed, serverless scheduler decoupled from EventBridge buses. Which service?

- A. Amazon EventBridge Scheduler
- B. SQS delay queue
- C. Step Functions only
- D. CloudWatch Logs
