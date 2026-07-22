# 💰 Practice Exam 16 — Cost-Optimized Architectures (GAP topic · Domain 4 = 20%)

20 questions on pricing models, right-sizing, and cost-effective design. Answers in `16-cost-optimization-answers.txt`.

---

**1.** A steady production workload runs 24/7 for 3 years. The MOST cost-effective EC2 purchase option is:

- A. On-Demand
- B. Spot
- C. 3-year Standard Reserved Instances / Savings Plans
- D. Dedicated Hosts

**2.** A fault-tolerant, interruptible batch job should minimize compute cost. Which option?

- A. On-Demand
- B. Spot Instances
- C. Reserved Instances
- D. Dedicated Instances

**3.** A bucket stores data with unknown/changing access patterns; the company wants automatic cost savings with no retrieval fees. Which storage class?

- A. S3 Standard
- B. S3 Intelligent-Tiering
- C. S3 Standard-IA
- D. S3 Glacier Deep Archive

**4.** Which approach automatically transitions S3 objects to cheaper classes and expires them over time?

- A. S3 Lifecycle policies
- B. S3 Versioning
- C. S3 Transfer Acceleration
- D. Cross-Region Replication

**5.** Which service gives ML-based right-sizing recommendations to reduce EC2/EBS/Lambda costs?

- A. AWS Compute Optimizer
- B. AWS Budgets
- C. AWS CloudTrail
- D. Amazon Inspector

**6.** A finance team wants to be alerted when costs exceed or are forecast to exceed a threshold. Which service?

- A. AWS Budgets
- B. AWS Cost Explorer
- C. AWS Config
- D. Trusted Advisor

**7.** A company wants the most FLEXIBLE commitment-based discount that applies across instance families, Regions, Fargate, and Lambda. Which option?

- A. Standard Reserved Instances
- B. Compute Savings Plans
- C. EC2 Instance Savings Plans
- D. Spot

**8.** Which is the MOST cost-effective way to run a website's variable traffic so you only pay for what you use, with no idle servers?

- A. Always-on large EC2 instance
- B. Serverless (Lambda + API Gateway) or Auto Scaling
- C. Reserved Instances at peak capacity 24/7
- D. Dedicated Hosts

**9.** To reduce NAT Gateway data-processing charges for private instances that only need S3/DynamoDB access, use:

- A. Gateway VPC Endpoints (free) instead of routing via NAT
- B. A bigger NAT Gateway
- C. Internet Gateway directly
- D. A second NAT instance

**10.** A database has predictable steady usage; the cheapest DynamoDB option is:

- A. On-demand capacity
- B. Provisioned capacity with auto scaling (and reserved capacity)
- C. DAX only
- D. Global Tables

**11.** Which reduces RDS cost for a non-production database used only during business hours?

- A. Stop/start the instance when not in use
- B. Enable Multi-AZ
- C. Add read replicas
- D. Use Provisioned IOPS

**12.** A company over-provisioned EBS gp2 volumes. What reduces cost while keeping/raising performance?

- A. Migrate to gp3 and provision only the IOPS/throughput needed
- B. Switch to io2 Block Express
- C. Move to Instance Store
- D. Increase volume size

**13.** Which lowers cost for archived data that is rarely accessed and tolerates 12-hour retrieval?

- A. S3 Glacier Deep Archive
- B. S3 Standard
- C. S3 Standard-IA
- D. S3 One Zone-IA

**14.** A multi-account organization wants aggregated volume discounts and shared Reserved Instance/Savings Plan benefits. Which feature?

- A. AWS Organizations consolidated billing
- B. Separate bills per account
- C. AWS Config
- D. AWS Budgets only

**15.** Which is the cheapest way to query infrequently accessed data in S3 without running a cluster?

- A. Amazon Athena (pay per query)
- B. Always-on Redshift cluster
- C. Always-on EMR cluster
- D. Provisioned Kinesis

**16.** Which service identifies idle/underutilized resources and Reserved Instance opportunities as part of best-practice checks?

- A. AWS Trusted Advisor
- B. AWS CloudTrail
- C. Amazon GuardDuty
- D. AWS Shield

**17.** To cost-optimize a fleet that can tolerate interruptions but needs some baseline guaranteed capacity, which is BEST?

- A. Mix On-Demand (baseline) + Spot (burst) via Auto Scaling mixed instances policy
- B. All On-Demand
- C. All Dedicated Hosts
- D. All Reserved at peak

**18.** Which CloudFront benefit also reduces ORIGIN cost?

- A. Caching at edge reduces requests/data transfer to the origin
- B. It increases origin load
- C. It removes the need for TLS
- D. It replaces S3 storage

**19.** Which two actions reduce data-transfer costs? (Choose TWO)

- A. Use CloudFront to serve cacheable content
- B. Keep traffic within the same AZ/Region and use VPC endpoints
- C. Route all internal traffic through the public internet
- D. Cross-AZ chatty traffic for everything
- E. Disable caching

**20.** A company wants to automatically detect unusual spend spikes and get root-cause insights. Which service?

- A. AWS Cost Anomaly Detection
- B. AWS Config
- C. CloudTrail
- D. Compute Optimizer
