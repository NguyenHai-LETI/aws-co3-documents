# 🧩 Practice Exam 17 — Gap Services (frequently-tested but under-covered)

20 questions on services your notes missed/under-covered: RDS Proxy, AWS RAM, VPC Flow Logs, Route 53 Resolver, Amazon MSK, Network Firewall, GWLB, S3 Storage Lens, EventBridge Pipes, and more. Answers in `17-gap-services-answers.txt`.

---

**1.** Hundreds of Lambda functions open too many connections to an RDS database, exhausting it. Which managed service provides connection pooling and faster failover?

- A. RDS Proxy
- B. ElastiCache
- C. Read Replica
- D. DAX

**2.** An organization wants to SHARE a centrally-managed VPC subnet (and Transit Gateway) with other accounts in its Organization. Which service?

- A. AWS Resource Access Manager (RAM)
- B. VPC Peering
- C. AWS Organizations SCP
- D. PrivateLink

**3.** A security team must investigate which source/destination IPs were ACCEPTED or REJECTED for traffic in a VPC subnet. Which feature provides this data?

- A. VPC Flow Logs
- B. CloudTrail
- C. AWS Config
- D. GuardDuty only

**4.** On-premises servers must resolve DNS names of resources in a VPC (and vice versa) for hybrid DNS. Which feature?

- A. Route 53 Resolver inbound/outbound endpoints
- B. Route 53 public hosted zone
- C. CloudFront
- D. Internet Gateway

**5.** A company migrating self-managed Apache Kafka wants a managed, Kafka-compatible streaming service. Which service?

- A. Amazon MSK
- B. Amazon Kinesis Data Streams
- C. Amazon SQS
- D. Amazon MQ

**6.** A VPC needs stateful, managed network firewall capabilities (intrusion prevention, domain filtering) at the VPC perimeter. Which service?

- A. AWS Network Firewall
- B. Security Groups only
- C. AWS WAF
- D. Amazon GuardDuty

**7.** Traffic must be transparently inspected by third-party virtual firewall appliances before reaching applications. Which load balancer enables this insertion?

- A. Gateway Load Balancer (GWLB)
- B. Application Load Balancer
- C. Network Load Balancer
- D. Classic Load Balancer

**8.** Which service provides organization-wide visibility and recommendations on S3 storage usage and activity to optimize cost?

- A. S3 Storage Lens
- B. S3 Inventory only
- C. Amazon Macie
- D. AWS Config

**9.** A serverless internal app is idle most of the time but bursts during the day; the team wants a relational DB that scales capacity automatically and quickly. Which option?

- A. Aurora Serverless v2
- B. RDS Single-AZ largest instance
- C. DynamoDB on-demand
- D. Redshift Serverless

**10.** Which feature lets you transform and modify objects retrieved from S3 on the fly (e.g., redact PII) using a Lambda without storing copies?

- A. S3 Object Lambda
- B. S3 Select
- C. S3 Batch Operations
- D. S3 Inventory

**11.** Which service creates a point-to-point integration between a source (e.g., SQS, DynamoDB Streams, Kafka) and a target, with optional filtering and enrichment, with minimal code?

- A. Amazon EventBridge Pipes
- B. AWS Step Functions
- C. Amazon SNS
- D. AWS Glue

**12.** A company wants IAM database authentication and to avoid storing DB passwords in Lambda. RDS Proxy supports which of these?

- A. IAM authentication and Secrets Manager integration
- B. Only username/password in code
- C. Encryption of the database engine
- D. Cross-Region replication

**13.** VPC Flow Logs can be delivered to which destinations? (Choose TWO)

- A. Amazon CloudWatch Logs
- B. Amazon S3
- C. Amazon SQS
- D. Amazon EBS
- E. AWS Config

**14.** A company wants to centrally share License Manager configurations and Route 53 Resolver rules across accounts. Which service enables resource sharing?

- A. AWS RAM
- B. AWS Organizations only
- C. AWS Config
- D. AWS Control Tower

**15.** An IPv6-only workload in a private subnet needs outbound-only internet access. Which component is used (NAT Gateway is IPv4)?

- A. Egress-only Internet Gateway
- B. NAT Gateway
- C. Internet Gateway
- D. Transit Gateway

**16.** Which is the BEST way to enforce that outbound traffic from a VPC can only reach an approved list of domains?

- A. AWS Network Firewall with domain filtering
- B. Security Group outbound rules by domain
- C. NACL by domain name
- D. Route 53 public zone

**17.** A team wants to detect threats by analyzing VPC Flow Logs, DNS logs, and CloudTrail automatically. Which service consumes these?

- A. Amazon GuardDuty
- B. AWS Config
- C. Amazon Macie
- D. AWS WAF

**18.** Which RDS Proxy benefit is MOST relevant to improving application resilience during a database failover?

- A. It reduces failover time by managing connections and routing to the new primary
- B. It encrypts data at rest
- C. It adds read replicas automatically
- D. It provides a CDN

**19.** Which two scenarios are ideal use cases for AWS Resource Access Manager? (Choose TWO)

- A. Sharing a Transit Gateway across accounts
- B. Sharing subnets in a shared VPC
- C. Encrypting S3 objects
- D. Filtering web traffic for XSS
- E. Forecasting demand

**20.** A hybrid environment needs on-premises apps to send queries to AWS-hosted private DNS names. Which Route 53 Resolver endpoint type is used?

- A. Inbound endpoint
- B. Outbound endpoint
- C. Public hosted zone
- D. Health check
