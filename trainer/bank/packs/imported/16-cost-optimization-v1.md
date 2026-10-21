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
- task: 4.2
- topic: cost
- services: EC2
- tags: reserved-instances, savings-plans
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q1

A steady production workload runs 24/7 for 3 years. The MOST cost-effective EC2 purchase option is:

- A. 3-year Standard Reserved Instances / Savings Plans
- B. Dedicated Hosts
- C. Spot
- D. On-Demand

**Answer:** A

**Explanation:** Steady 24/7 for 3 years = 3-year Reserved Instances / Savings Plans.

---

## Q 16-v1-02
- domain: cost
- task: 4.2
- topic: cost
- tags: high-availability, spot-instances
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q2

A fault-tolerant, interruptible batch job should minimize compute cost. Which option?

- A. On-Demand
- B. Dedicated Instances
- C. Reserved Instances
- D. Spot Instances

**Answer:** D

**Explanation:** Interruptible batch, cheapest = Spot Instances.

---

## Q 16-v1-03
- domain: cost
- task: 4.1
- topic: cost
- services: S3
- tags: s3-storage-classes, s3-intelligent-tiering
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q3

A bucket stores data with unknown/changing access patterns; the company wants automatic cost savings with no retrieval fees. Which storage class?

- A. S3 Standard
- B. S3 Standard-IA
- C. S3 Intelligent-Tiering
- D. S3 Glacier Deep Archive

**Answer:** C

**Explanation:** Unknown/changing access, no retrieval fee = S3 Intelligent-Tiering.

---

## Q 16-v1-04
- domain: cost
- task: 4.1
- topic: cost
- services: S3
- tags: s3-lifecycle
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q4

Which approach automatically transitions S3 objects to cheaper classes and expires them over time?

- A. S3 Transfer Acceleration
- B. S3 Versioning
- C. S3 Lifecycle policies
- D. Cross-Region Replication

**Answer:** C

**Explanation:** Auto-transition + expire objects = S3 Lifecycle policies.

---

## Q 16-v1-05
- domain: cost
- task: 4.2
- topic: cost
- services: Compute Optimizer, EC2, EBS, Lambda
- tags: right-sizing
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q5

Which service gives ML-based right-sizing recommendations to reduce EC2/EBS/Lambda costs?

- A. AWS CloudTrail
- B. AWS Budgets
- C. Amazon Inspector
- D. AWS Compute Optimizer

**Answer:** D

**Explanation:** ML right-sizing recommendations = Compute Optimizer.

---

## Q 16-v1-06
- domain: cost
- task: 4.2
- topic: cost
- services: AWS Budgets
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q6

A finance team wants to be alerted when costs exceed or are forecast to exceed a threshold. Which service?

- A. Trusted Advisor
- B. AWS Cost Explorer
- C. AWS Budgets
- D. AWS Config

**Answer:** C

**Explanation:** Alert on cost threshold/forecast = AWS Budgets.

---

## Q 16-v1-07
- domain: cost
- task: 4.2
- topic: cost
- services: Fargate, Lambda
- tags: savings-plans
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q7

A company wants the most FLEXIBLE commitment-based discount that applies across instance families, Regions, Fargate, and Lambda. Which option?

- A. Spot
- B. Standard Reserved Instances
- C. Compute Savings Plans
- D. EC2 Instance Savings Plans

**Answer:** C

**Explanation:** Most flexible commitment discount = Compute Savings Plans.

---

## Q 16-v1-08
- domain: cost
- task: 4.2
- topic: cost
- services: Lambda, API Gateway, EC2 Auto Scaling
- difficulty: easy
- time: 50
- source: practice-exams/16-cost-optimization-exam.md#Q8

Which is the MOST cost-effective way to run a website's variable traffic so you only pay for what you use, with no idle servers?

- A. Dedicated Hosts
- B. Serverless (Lambda + API Gateway) or Auto Scaling
- C. Always-on large EC2 instance
- D. Reserved Instances at peak capacity 24/7

**Answer:** B

**Explanation:** Pay-for-use variable traffic = Serverless or Auto Scaling.

---

## Q 16-v1-09
- domain: cost
- task: 4.4
- topic: cost
- services: VPC, NAT Gateway, S3, DynamoDB
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q9

To reduce NAT Gateway data-processing charges for private instances that only need S3/DynamoDB access, use:

- A. A second NAT instance
- B. Internet Gateway directly
- C. Gateway VPC Endpoints (free) instead of routing via NAT
- D. A bigger NAT Gateway

**Answer:** C

**Explanation:** Avoid NAT charges for S3/DynamoDB = Gateway VPC Endpoints (free).

---

## Q 16-v1-10
- domain: cost
- task: 4.2
- topic: cost
- services: EC2 Auto Scaling, DynamoDB
- tags: dynamodb-capacity
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q10

A database has predictable steady usage; the cheapest DynamoDB option is:

- A. Provisioned capacity with auto scaling (and reserved capacity)
- B. DAX only
- C. On-demand capacity
- D. Global Tables

**Answer:** A

**Explanation:** Predictable steady DynamoDB cheapest = Provisioned + auto scaling (+ reserved).

---

## Q 16-v1-11
- domain: cost
- task: 4.2
- topic: cost
- services: RDS
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q11

Which reduces RDS cost for a non-production database used only during business hours?

- A. Enable Multi-AZ
- B. Stop/start the instance when not in use
- C. Add read replicas
- D. Use Provisioned IOPS

**Answer:** B

**Explanation:** Non-prod business-hours DB = stop/start instance.

---

## Q 16-v1-12
- domain: cost
- task: 4.1
- topic: cost
- services: EBS
- tags: right-sizing, ebs-volume-types
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q12

A company over-provisioned EBS gp2 volumes. What reduces cost while keeping/raising performance?

- A. Migrate to gp3 and provision only the IOPS/throughput needed
- B. Increase volume size
- C. Switch to io2 Block Express
- D. Move to Instance Store

**Answer:** A

**Explanation:** Over-provisioned gp2 -> gp3 with right IOPS/throughput.

---

## Q 16-v1-13
- domain: cost
- task: 4.1
- topic: cost
- services: S3, S3 Glacier
- tags: s3-glacier-tiers
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q13

Which lowers cost for archived data that is rarely accessed and tolerates 12-hour retrieval?

- A. S3 One Zone-IA
- B. S3 Standard
- C. S3 Standard-IA
- D. S3 Glacier Deep Archive

**Answer:** D

**Explanation:** Rarely accessed, 12h ok, cheapest = Glacier Deep Archive.

---

## Q 16-v1-14
- domain: cost
- task: 4.2
- topic: cost
- services: Organizations
- tags: reserved-instances, savings-plans
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q14

A multi-account organization wants aggregated volume discounts and shared Reserved Instance/Savings Plan benefits. Which feature?

- A. Separate bills per account
- B. AWS Organizations consolidated billing
- C. AWS Budgets only
- D. AWS Config

**Answer:** B

**Explanation:** Volume discounts + shared RI/SP = Organizations consolidated billing.

---

## Q 16-v1-15
- domain: cost
- task: 4.1
- topic: cost
- services: Athena, S3
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q15

Which is the cheapest way to query infrequently accessed data in S3 without running a cluster?

- A. Amazon Athena (pay per query)
- B. Always-on EMR cluster
- C. Always-on Redshift cluster
- D. Provisioned Kinesis

**Answer:** A

**Explanation:** Cheap infrequent S3 queries = Athena.

---

## Q 16-v1-16
- domain: cost
- task: 4.2
- topic: cost
- services: Trusted Advisor
- tags: right-sizing, reserved-instances
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q16

Which service identifies idle/underutilized resources and Reserved Instance opportunities as part of best-practice checks?

- A. Amazon GuardDuty
- B. AWS Trusted Advisor
- C. AWS CloudTrail
- D. AWS Shield

**Answer:** B

**Explanation:** Idle resources + RI opportunities = Trusted Advisor.

---

## Q 16-v1-17
- domain: cost
- task: 4.2
- topic: cost
- services: EC2 Auto Scaling
- tags: spot-instances
- difficulty: easy
- time: 70
- enriched: 2026-10-21
- source: practice-exams/16-cost-optimization-exam.md#Q17

To cost-optimize a fleet that can tolerate interruptions but needs some baseline guaranteed capacity, which is BEST?

- A. Use an Auto Scaling mixed instances policy that pairs On-Demand for the capacity that must keep running with Spot Instances for the rest
- B. Size Standard Reserved Instances to cover the fleet's peak demand, committing to a one- or three-year term
- C. Run the entire fleet as On-Demand instances at the standard hourly rate with no long-term commitment
- D. Run the fleet on Dedicated Hosts, which bill per physical host rather than per instance

**Answer:** A

**Explanation:** An Auto Scaling mixed instances policy lets you pin a portion of the group to On-Demand for the capacity that must stay up while filling the rest with cheaper Spot Instances for the interruption-tolerant workload.
- Reserved Instances sized for peak: locks in a long-term commitment priced for the busiest hour, so most of the time you pay for capacity you do not use.
- On-Demand for the entire fleet: no commitment discount and no Spot savings, so it costs more than necessary for capacity that can tolerate interruption.
- Dedicated Hosts: billed per physical host for licensing/compliance needs, not a cost-optimization option for an interruption-tolerant fleet.
> 🇻🇳 Cần vừa có phần chạy ổn định vừa tận dụng giá rẻ khi chấp nhận gián đoạn → mixed instances policy (On-Demand + Spot).

---

## Q 16-v1-18
- domain: cost
- task: 4.4
- topic: cost
- services: CloudFront
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q18

Which CloudFront benefit also reduces ORIGIN cost?

- A. It increases origin load
- B. It removes the need for TLS
- C. It replaces S3 storage
- D. Caching at edge reduces requests/data transfer to the origin

**Answer:** D

**Explanation:** Edge caching reduces origin requests/transfer cost.

---

## Q 16-v1-19
- domain: cost
- task: 4.4
- topic: cost
- services: CloudFront, VPC
- difficulty: medium
- time: 80
- source: practice-exams/16-cost-optimization-exam.md#Q19

Which two actions reduce data-transfer costs? (Choose TWO)

- A. Route all internal traffic through the public internet
- B. Keep traffic within the same AZ/Region and use VPC endpoints
- C. Cross-AZ chatty traffic for everything
- D. Disable caching
- E. Use CloudFront to serve cacheable content

**Answer:** B, E

**Explanation:** CloudFront caching + keep traffic in-Region/VPC endpoints.

---

## Q 16-v1-20
- domain: cost
- task: 4.2
- topic: cost
- services: Cost Anomaly Detection
- tags: threat-detection
- difficulty: easy
- time: 45
- source: practice-exams/16-cost-optimization-exam.md#Q20

A company wants to automatically detect unusual spend spikes and get root-cause insights. Which service?

- A. CloudTrail
- B. AWS Config
- C. Compute Optimizer
- D. AWS Cost Anomaly Detection

**Answer:** D

**Explanation:** Detect unusual spend + root cause = Cost Anomaly Detection.
