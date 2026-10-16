---
pack: saa-16-cost-optimization-v1
title: 16 · Cost-Optimized Architectures (GAP topic · Domain 4 = 20%) · V1
exam: SAA-C03
origin: imported
source: practice-exams/16-cost-optimization-exam.md
created: 2026-10-16
---

# 16 · Cost-Optimized Architectures (GAP topic · Domain 4 = 20%) · V1

> Imported from `practice-exams/16-cost-optimization-exam.md` + `16-cost-optimization-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 16-v1-01
- domain: cost
- topic: cost
- services: EC2
- tags: reserved-instances, savings-plans
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q1

A steady production workload runs 24/7 for 3 years. The MOST cost-effective EC2 purchase option is:

- A. On-Demand
- B. Spot
- C. 3-year Standard Reserved Instances / Savings Plans
- D. Dedicated Hosts

**Answer:** C

**Explanation:** Steady 24/7 for 3 years = 3-year Reserved Instances / Savings Plans.

---

## Q 16-v1-02
- domain: cost
- topic: cost
- tags: high-availability, spot-instances
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q2

A fault-tolerant, interruptible batch job should minimize compute cost. Which option?

- A. On-Demand
- B. Spot Instances
- C. Reserved Instances
- D. Dedicated Instances

**Answer:** B

**Explanation:** Interruptible batch, cheapest = Spot Instances.

---

## Q 16-v1-03
- domain: cost
- topic: cost
- services: S3
- tags: s3-storage-classes, s3-intelligent-tiering
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q3

A bucket stores data with unknown/changing access patterns; the company wants automatic cost savings with no retrieval fees. Which storage class?

- A. S3 Standard
- B. S3 Intelligent-Tiering
- C. S3 Standard-IA
- D. S3 Glacier Deep Archive

**Answer:** B

**Explanation:** Unknown/changing access, no retrieval fee = S3 Intelligent-Tiering.

---

## Q 16-v1-04
- domain: cost
- topic: cost
- services: S3
- tags: s3-lifecycle
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q4

Which approach automatically transitions S3 objects to cheaper classes and expires them over time?

- A. S3 Lifecycle policies
- B. S3 Versioning
- C. S3 Transfer Acceleration
- D. Cross-Region Replication

**Answer:** A

**Explanation:** Auto-transition + expire objects = S3 Lifecycle policies.

---

## Q 16-v1-05
- domain: cost
- topic: cost
- services: Compute Optimizer, EC2, EBS, Lambda
- tags: right-sizing
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q5

Which service gives ML-based right-sizing recommendations to reduce EC2/EBS/Lambda costs?

- A. AWS Compute Optimizer
- B. AWS Budgets
- C. AWS CloudTrail
- D. Amazon Inspector

**Answer:** A

**Explanation:** ML right-sizing recommendations = Compute Optimizer.

---

## Q 16-v1-06
- domain: cost
- topic: cost
- services: AWS Budgets
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q6

A finance team wants to be alerted when costs exceed or are forecast to exceed a threshold. Which service?

- A. AWS Budgets
- B. AWS Cost Explorer
- C. AWS Config
- D. Trusted Advisor

**Answer:** A

**Explanation:** Alert on cost threshold/forecast = AWS Budgets.

---

## Q 16-v1-07
- domain: cost
- topic: cost
- services: Fargate, Lambda
- tags: savings-plans
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q7

A company wants the most FLEXIBLE commitment-based discount that applies across instance families, Regions, Fargate, and Lambda. Which option?

- A. Standard Reserved Instances
- B. Compute Savings Plans
- C. EC2 Instance Savings Plans
- D. Spot

**Answer:** B

**Explanation:** Most flexible commitment discount = Compute Savings Plans.

---

## Q 16-v1-08
- domain: cost
- topic: cost
- services: Lambda, API Gateway, EC2 Auto Scaling
- difficulty: easy
- time: 50
- source: practice-exams/16-cost-optimization-exam.md#Q8

Which is the MOST cost-effective way to run a website's variable traffic so you only pay for what you use, with no idle servers?

- A. Always-on large EC2 instance
- B. Serverless (Lambda + API Gateway) or Auto Scaling
- C. Reserved Instances at peak capacity 24/7
- D. Dedicated Hosts

**Answer:** B

**Explanation:** Pay-for-use variable traffic = Serverless or Auto Scaling.

---

## Q 16-v1-09
- domain: cost
- topic: cost
- services: VPC, NAT Gateway, S3, DynamoDB
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q9

To reduce NAT Gateway data-processing charges for private instances that only need S3/DynamoDB access, use:

- A. Gateway VPC Endpoints (free) instead of routing via NAT
- B. A bigger NAT Gateway
- C. Internet Gateway directly
- D. A second NAT instance

**Answer:** A

**Explanation:** Avoid NAT charges for S3/DynamoDB = Gateway VPC Endpoints (free).

---

## Q 16-v1-10
- domain: cost
- topic: cost
- services: EC2 Auto Scaling, DynamoDB
- tags: dynamodb-capacity
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q10

A database has predictable steady usage; the cheapest DynamoDB option is:

- A. On-demand capacity
- B. Provisioned capacity with auto scaling (and reserved capacity)
- C. DAX only
- D. Global Tables

**Answer:** B

**Explanation:** Predictable steady DynamoDB cheapest = Provisioned + auto scaling (+ reserved).

---

## Q 16-v1-11
- domain: cost
- topic: cost
- services: RDS
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q11

Which reduces RDS cost for a non-production database used only during business hours?

- A. Stop/start the instance when not in use
- B. Enable Multi-AZ
- C. Add read replicas
- D. Use Provisioned IOPS

**Answer:** A

**Explanation:** Non-prod business-hours DB = stop/start instance.

---

## Q 16-v1-12
- domain: cost
- topic: cost
- services: EBS
- tags: right-sizing, ebs-volume-types
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q12

A company over-provisioned EBS gp2 volumes. What reduces cost while keeping/raising performance?

- A. Migrate to gp3 and provision only the IOPS/throughput needed
- B. Switch to io2 Block Express
- C. Move to Instance Store
- D. Increase volume size

**Answer:** A

**Explanation:** Over-provisioned gp2 -> gp3 with right IOPS/throughput.

---

## Q 16-v1-13
- domain: cost
- topic: cost
- services: S3, S3 Glacier
- tags: s3-glacier-tiers
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q13

Which lowers cost for archived data that is rarely accessed and tolerates 12-hour retrieval?

- A. S3 Glacier Deep Archive
- B. S3 Standard
- C. S3 Standard-IA
- D. S3 One Zone-IA

**Answer:** A

**Explanation:** Rarely accessed, 12h ok, cheapest = Glacier Deep Archive.

---

## Q 16-v1-14
- domain: cost
- topic: cost
- services: Organizations
- tags: reserved-instances, savings-plans
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q14

A multi-account organization wants aggregated volume discounts and shared Reserved Instance/Savings Plan benefits. Which feature?

- A. AWS Organizations consolidated billing
- B. Separate bills per account
- C. AWS Config
- D. AWS Budgets only

**Answer:** A

**Explanation:** Volume discounts + shared RI/SP = Organizations consolidated billing.

---

## Q 16-v1-15
- domain: cost
- topic: cost
- services: Athena, S3
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q15

Which is the cheapest way to query infrequently accessed data in S3 without running a cluster?

- A. Amazon Athena (pay per query)
- B. Always-on Redshift cluster
- C. Always-on EMR cluster
- D. Provisioned Kinesis

**Answer:** A

**Explanation:** Cheap infrequent S3 queries = Athena.

---

## Q 16-v1-16
- domain: cost
- topic: cost
- services: Trusted Advisor
- tags: right-sizing, reserved-instances
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q16

Which service identifies idle/underutilized resources and Reserved Instance opportunities as part of best-practice checks?

- A. AWS Trusted Advisor
- B. AWS CloudTrail
- C. Amazon GuardDuty
- D. AWS Shield

**Answer:** A

**Explanation:** Idle resources + RI opportunities = Trusted Advisor.

---

## Q 16-v1-17
- domain: cost
- topic: cost
- services: EC2 Auto Scaling
- tags: spot-instances
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q17

To cost-optimize a fleet that can tolerate interruptions but needs some baseline guaranteed capacity, which is BEST?

- A. Mix On-Demand (baseline) + Spot (burst) via Auto Scaling mixed instances policy
- B. All On-Demand
- C. All Dedicated Hosts
- D. All Reserved at peak

**Answer:** A

**Explanation:** Baseline + burst = On-Demand + Spot mixed instances policy.

---

## Q 16-v1-18
- domain: cost
- topic: cost
- services: CloudFront
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q18

Which CloudFront benefit also reduces ORIGIN cost?

- A. Caching at edge reduces requests/data transfer to the origin
- B. It increases origin load
- C. It removes the need for TLS
- D. It replaces S3 storage

**Answer:** A

**Explanation:** Edge caching reduces origin requests/transfer cost.

---

## Q 16-v1-19
- domain: cost
- topic: cost
- services: CloudFront, VPC
- difficulty: medium
- time: 80
- source: practice-exams/16-cost-optimization-exam.md#Q19

Which two actions reduce data-transfer costs? (Choose TWO)

- A. Use CloudFront to serve cacheable content
- B. Keep traffic within the same AZ/Region and use VPC endpoints
- C. Route all internal traffic through the public internet
- D. Cross-AZ chatty traffic for everything
- E. Disable caching

**Answer:** A, B

**Explanation:** CloudFront caching + keep traffic in-Region/VPC endpoints.

---

## Q 16-v1-20
- domain: cost
- topic: cost
- services: Cost Anomaly Detection
- tags: threat-detection
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q20

A company wants to automatically detect unusual spend spikes and get root-cause insights. Which service?

- A. AWS Cost Anomaly Detection
- B. AWS Config
- C. CloudTrail
- D. Compute Optimizer

**Answer:** A

**Explanation:** Detect unusual spend + root cause = Cost Anomaly Detection.
