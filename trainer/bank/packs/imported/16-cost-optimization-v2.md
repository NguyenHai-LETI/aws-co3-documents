---
pack: saa-16-cost-optimization-v2
title: 16 · Cost Optimization · V2
exam: SAA-C03
origin: imported
source: practice-exams/16-cost-optimization-exam-v2.md
created: 2026-10-16
---

# 16 · Cost Optimization · V2

> Imported from `practice-exams/16-cost-optimization-exam-v2.md` + `16-cost-optimization-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 16-v2-01
- domain: cost
- task: 4.2
- topic: cost
- tags: reserved-instances
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q1

A predictable production workload runs 24/7 for 3 years on a fixed instance type. MOST cost-effective purchase?

- A. Dedicated Hosts
- B. Spot Instances
- C. On-Demand
- D. Standard Reserved Instances (3-year)

**Answer:** D

**Explanation:** Predictable 24/7 fixed type, 3 years = Standard Reserved Instances.

---

## Q 16-v2-02
- domain: cost
- task: 4.2
- topic: cost
- tags: high-availability, spot-instances
- difficulty: medium
- time: 45
- source: practice-exams/16-cost-optimization-exam-v2.md#Q2

A fault-tolerant batch job can be interrupted. Cheapest compute?

- A. Spot Instances
- B. Dedicated Hosts
- C. On-Demand
- D. Reserved Instances

**Answer:** A

**Explanation:** Interruptible fault-tolerant batch = Spot Instances.

---

## Q 16-v2-03
- domain: cost
- task: 4.2
- topic: cost
- tags: savings-plans
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q3

A workload needs flexibility across instance families/Regions with steady usage. Best savings mechanism?

- A. On-Demand
- B. Compute Savings Plans
- C. Spot only
- D. Standard RIs

**Answer:** B

**Explanation:** Flexible across families/Regions, steady = Compute Savings Plans.

---

## Q 16-v2-04
- domain: cost
- task: 4.1
- topic: cost
- services: S3
- tags: s3-intelligent-tiering
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q4

S3 data has unknown, changing access patterns. Cheapest without lifecycle management?

- A. S3 Standard-IA
- B. S3 Intelligent-Tiering
- C. S3 Standard
- D. Glacier

**Answer:** B

**Explanation:** Unknown/changing pattern, no lifecycle mgmt = S3 Intelligent-Tiering.

---

## Q 16-v2-05
- domain: cost
- task: 4.1
- topic: cost
- services: S3 Glacier
- tags: s3-storage-classes
- difficulty: medium
- time: 55
- source: practice-exams/16-cost-optimization-exam-v2.md#Q5

Logs are frequently accessed for 30 days, then rarely. Which lifecycle minimizes cost?

- A. Transition to Standard-IA after 30 days, then Glacier
- B. Delete after 1 day
- C. One Zone-IA immediately
- D. Keep in S3 Standard forever

**Answer:** A

**Explanation:** Frequent 30 days then rare = Standard-IA after 30 days then Glacier.

---

## Q 16-v2-06
- domain: cost
- task: 4.3
- topic: cost
- services: Aurora
- tags: aurora-serverless
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q6

An idle-then-bursty relational workload should minimize cost. Which option?

- A. Aurora Serverless v2
- B. Multi-AZ RDS max size
- C. On-Demand DynamoDB
- D. Largest provisioned instance

**Answer:** A

**Explanation:** Idle-then-bursty relational = Aurora Serverless v2.

---

## Q 16-v2-07
- domain: cost
- task: 4.2
- topic: cost
- services: Compute Optimizer
- tags: right-sizing
- difficulty: medium
- time: 45
- source: practice-exams/16-cost-optimization-exam-v2.md#Q7

Which tool provides right-sizing recommendations based on actual utilization?

- A. Config
- B. AWS Compute Optimizer
- C. CloudTrail
- D. GuardDuty

**Answer:** B

**Explanation:** Right-sizing from utilization = AWS Compute Optimizer.

---

## Q 16-v2-08
- domain: cost
- task: 4.2
- topic: cost
- services: Cost Explorer
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q8

Which tool visualizes and analyzes historical spend and forecasts future cost?

- A. Config
- B. CloudWatch
- C. AWS Cost Explorer
- D. Trusted Advisor

**Answer:** C

**Explanation:** Visualize/forecast spend = AWS Cost Explorer.

---

## Q 16-v2-09
- domain: cost
- task: 4.2
- topic: cost
- services: AWS Budgets
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q9

A team must be alerted when monthly spend exceeds a threshold. Which service?

- A. CloudTrail
- B. Cost Explorer only
- C. Config
- D. AWS Budgets

**Answer:** D

**Explanation:** Alert on budget threshold = AWS Budgets.

---

## Q 16-v2-10
- domain: cost
- task: 4.2
- topic: cost
- services: Cost Anomaly Detection
- tags: threat-detection
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q10

Which feature automatically detects unusual spend spikes using ML?

- A. CloudWatch alarm
- B. Trusted Advisor
- C. Config rule
- D. AWS Cost Anomaly Detection

**Answer:** D

**Explanation:** ML-based spend spike detection = Cost Anomaly Detection.

---

## Q 16-v2-11
- domain: cost
- task: 4.4
- topic: cost
- services: VPC Endpoint, S3, NAT Gateway
- difficulty: medium
- time: 55
- source: practice-exams/16-cost-optimization-exam-v2.md#Q11

NAT Gateway data processing costs are high for traffic to S3. Which reduces cost?

- A. Larger NAT Gateway
- B. Interface endpoint for S3
- C. Gateway VPC endpoint for S3 (avoids NAT)
- D. More NAT Gateways

**Answer:** C

**Explanation:** Avoid NAT cost for S3 = Gateway VPC endpoint.

---

## Q 16-v2-12
- domain: cost
- task: 4.1
- topic: cost
- services: Organizations
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q12

A company wants volume discounts and one bill across many accounts. Which feature?

- A. Separate bills
- B. Per-account RIs only
- C. Savings Plans per user
- D. Consolidated billing via AWS Organizations

**Answer:** D

**Explanation:** Volume discounts + one bill = Consolidated billing via Organizations.

---

## Q 16-v2-13
- domain: cost
- task: 4.2
- topic: cost
- tags: tagging
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q13

Cost must be allocated per team/project across resources. Which mechanism?

- A. Config rules
- B. IAM policies
- C. Cost allocation tags
- D. Security groups

**Answer:** C

**Explanation:** Per-team cost attribution = Cost allocation tags.

---

## Q 16-v2-14
- domain: cost
- task: 4.2
- topic: cost
- difficulty: medium
- time: 55
- source: practice-exams/16-cost-optimization-exam-v2.md#Q14

A dev/test environment runs only during business hours. Cheapest approach?

- A. Schedule start/stop (e.g., Instance Scheduler) to run only when needed
- B. Dedicated Hosts
- C. Run 24/7 On-Demand
- D. Buy 3-year RIs

**Answer:** A

**Explanation:** Dev/test only business hours = schedule start/stop.

---

## Q 16-v2-15
- domain: cost
- task: 4.1
- topic: cost
- services: EBS
- tags: right-sizing, ebs-volume-types
- difficulty: medium
- time: 55
- source: practice-exams/16-cost-optimization-exam-v2.md#Q15

Over-provisioned EBS gp2 volumes cost too much. Which switch can reduce cost and let you tune IOPS/throughput independently?

- A. Migrate to st1 for boot
- B. Migrate to gp3
- C. Migrate to io2
- D. Use Instance Store

**Answer:** B

**Explanation:** Cheaper tunable EBS = migrate gp2 to gp3.

---

## Q 16-v2-16
- domain: cost
- task: 4.1
- topic: cost
- services: EBS
- tags: snapshots
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q16

Rarely accessed EBS snapshots must cost less; slower restore is OK. Which feature?

- A. Fast Snapshot Restore
- B. EBS Snapshot Archive
- C. gp3
- D. Multi-Attach

**Answer:** B

**Explanation:** Cheap rarely-restored snapshots = EBS Snapshot Archive.

---

## Q 16-v2-17
- domain: cost
- task: 4.2
- topic: cost
- services: Fargate, ECS
- tags: spot-instances
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q17

A containerized, interruption-tolerant workload should minimize cost on ECS. Which option?

- A. Fargate Spot
- B. Dedicated Hosts
- C. Fargate On-Demand
- D. EC2 On-Demand

**Answer:** A

**Explanation:** Interruption-tolerant container cost = Fargate Spot.

---

## Q 16-v2-18
- domain: cost
- task: 4.2
- topic: cost
- services: RDS, ElastiCache, Redshift
- tags: reserved-instances
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q18

A steady-usage RDS/ElastiCache/Redshift deployment should reduce cost with commitment. Which option?

- A. On-Demand only
- B. Savings Plans (not applicable to these)
- C. Reserved Instances / Reserved Nodes
- D. Spot

**Answer:** C

**Explanation:** Steady RDS/ElastiCache/Redshift = Reserved Instances/Nodes.

---

## Q 16-v2-19
- domain: cost
- task: 4.4
- topic: cost
- services: CloudFront
- tags: data-transfer-cost
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q19

Global content delivery reduces origin data transfer cost and latency. Which service?

- A. Amazon CloudFront
- B. NAT Gateway
- C. Direct Connect
- D. Global Accelerator

**Answer:** A

**Explanation:** Reduce origin transfer + latency globally = CloudFront.

---

## Q 16-v2-20
- domain: cost
- task: 4.2
- topic: cost
- services: Compute Optimizer, Lambda
- tags: spot-instances
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q20

A Lambda function is over-allocated memory. Which tool helps find the cost/performance sweet spot?

- A. Config
- B. Trusted Advisor only
- C. AWS Compute Optimizer / Lambda Power Tuning
- D. CloudTrail

**Answer:** C

**Explanation:** Lambda memory sweet spot = Compute Optimizer / Lambda Power Tuning.

---

## Q 16-v2-21
- domain: cost
- task: 4.2
- topic: cost
- services: EC2 Auto Scaling
- tags: savings-plans, reserved-instances, spot-instances
- difficulty: hard
- time: 95
- source: practice-exams/16-cost-optimization-exam-v2.md#Q21

A company has a steady baseline plus variable spikes. Which cost-optimal mix? (Choose TWO)

- A. Dedicated Hosts for everything
- B. Savings Plans/Reserved Instances for the steady baseline
- C. Reserved Instances for peak spikes
- D. On-Demand for the entire baseline
- E. Spot or On-Demand Auto Scaling for the variable spikes

**Answer:** B, E

**Explanation:** Baseline on Savings Plans/RIs + spikes on Spot/On-Demand Auto Scaling.

---

## Q 16-v2-22
- domain: cost
- task: 4.2
- topic: cost
- difficulty: hard
- time: 95
- source: practice-exams/16-cost-optimization-exam-v2.md#Q22

Cross-AZ data transfer between chatty microservices is costly. Which two reduce this cost? (Choose TWO)

- A. Use placement/architecture that reduces cross-AZ chatter
- B. Co-locate communicating instances in the same AZ where availability allows
- C. Move to cross-Region
- D. Send all traffic through a NAT Gateway
- E. Use public IPs between instances

**Answer:** A, B

**Explanation:** Reduce cross-AZ cost = co-locate in same AZ + reduce cross-AZ chatter.

---

## Q 16-v2-23
- domain: cost
- task: 4.2
- topic: cost
- tags: spot-instances
- difficulty: hard
- time: 95
- source: practice-exams/16-cost-optimization-exam-v2.md#Q23

A company wants maximum Spot savings for a stateless fleet while minimizing interruptions and capacity gaps. Which two strategies? (Choose TWO)

- A. Use capacity-optimized allocation strategy
- B. Only lowestPrice with one pool
- C. Reserved Instances for Spot
- D. Diversify across multiple instance types and AZs
- E. Single instance type in one AZ

**Answer:** A, D

**Explanation:** Max Spot with fewer interruptions = diversify types/AZs + capacity-optimized strategy.

---

## Q 16-v2-24
- domain: cost
- task: 4.1
- topic: cost
- services: S3 Glacier, S3
- tags: s3-storage-classes
- difficulty: hard
- time: 105
- enriched: 2026-10-22
- source: practice-exams/16-cost-optimization-exam-v2.md#Q24

An ingestion job writes objects to S3 and immediately transitions them to Glacier, but small objects incur high per-object and minimum-duration charges. Which two considerations apply? (Choose TWO)

- A. IA/Glacier classes have minimum storage durations (30/90 days) and per-object overhead
- B. Very small/short-lived objects may be cheaper in S3 Standard
- C. One Zone-IA has no minimum duration
- D. Lifecycle transitions are free of minimums
- E. Glacier is always cheapest regardless of object size/age

**Answer:** A, B

**Explanation:** S3 Standard-IA and the Glacier storage classes bill a minimum storage duration (30, 90 or 180 days) and per-object overhead (a minimum billable size for IA, extra metadata for each archived object), so very small or short-lived objects are often cheaper left in S3 Standard.
- One Zone-IA has no minimum duration: false, it also bills at least 30 days.
- Lifecycle transitions are free of minimums: transitions are charged per request and the target class minimums still apply.
- Glacier is always cheapest: false for tiny or short-lived objects.
> 🇻🇳 Object nhỏ/ngắn hạn đưa sang IA/Glacier bị tính thời gian tối thiểu + overhead → để ở S3 Standard rẻ hơn.

---

## Q 16-v2-25
- domain: cost
- task: 4.2
- topic: cost
- services: Organizations
- tags: scp
- difficulty: hard
- time: 70
- source: practice-exams/16-cost-optimization-exam-v2.md#Q25

An enterprise wants to enforce that only approved, cost-efficient instance types can be launched across accounts. Which service enforces this?

- A. Cost Explorer
- B. Budgets
- C. Service Control Policies (SCPs) via Organizations
- D. Trusted Advisor

**Answer:** C

**Explanation:** Enforce approved instance types = SCPs via Organizations.

---

## Q 16-v2-26
- domain: cost
- task: 4.3
- topic: cost
- services: Redshift
- difficulty: hard
- time: 75
- source: practice-exams/16-cost-optimization-exam-v2.md#Q26

A Redshift cluster is used heavily during the day and idle at night; the team wants to avoid managing capacity and pay for what they use. Which option?

- A. Reserved nodes only
- B. Amazon Redshift Serverless
- C. Largest RA3 always-on
- D. DC2 dense compute always-on

**Answer:** B

**Explanation:** Redshift pay-per-use, no capacity mgmt = Redshift Serverless.

---

## Q 16-v2-27
- domain: cost
- task: 4.1
- topic: cost
- services: S3 Glacier, S3
- tags: s3-replication, s3-storage-classes
- difficulty: hard
- time: 100
- source: practice-exams/16-cost-optimization-exam-v2.md#Q27

A company must reduce cost of infrequently accessed cross-Region replication while keeping DR. Which two apply? (Choose TWO)

- A. Replicate to a cheaper storage class in the destination (e.g., Standard-IA/Glacier)
- B. Disable versioning to save cost
- C. Use Transfer Acceleration for replication
- D. Replicate everything to S3 Standard only
- E. Use S3 Replication with a destination storage class

**Answer:** A, E

**Explanation:** Cheaper DR replication = replicate to cheaper destination class via S3 Replication.

---

## Q 16-v2-28
- domain: cost
- task: 4.4
- topic: cost
- services: S3, DynamoDB, PrivateLink, ECR, Systems Manager, NAT Gateway
- difficulty: hard
- time: 100
- source: practice-exams/16-cost-optimization-exam-v2.md#Q28

A NAT Gateway is used only to let private instances reach a few AWS services (S3, DynamoDB, ECR, SSM). Which two reduce NAT costs? (Choose TWO)

- A. Gateway endpoints for S3/DynamoDB
- B. Interface (PrivateLink) endpoints for services like ECR/SSM
- C. Use a public subnet for all instances
- D. Add more NAT Gateways
- E. Remove all endpoints

**Answer:** A, B

**Explanation:** Cut NAT cost = Gateway endpoints (S3/DynamoDB) + Interface endpoints (ECR/SSM).

---

## Q 16-v2-29
- domain: cost
- task: 4.2
- topic: cost
- services: EC2, Fargate, Lambda
- tags: savings-plans
- difficulty: hard
- time: 100
- enriched: 2026-10-21
- source: practice-exams/16-cost-optimization-exam-v2.md#Q29

A workload's compute commitment must cover Lambda and Fargate too, not just EC2. Which purchasing option applies?

- A. EC2 Instance Savings Plans, which cap the commitment's reach to EC2 usage and leave Fargate and Lambda spend unaffected
- B. Spot Instances, which lower EC2 costs through interruptible capacity but have no equivalent commitment option for Fargate or Lambda
- C. Standard Reserved Instances, which commit to specific EC2 instance families and do not apply to Fargate or Lambda usage
- D. A Savings Plan that automatically applies its hourly commitment across EC2, Fargate, and Lambda usage, regardless of instance family or Region

**Answer:** D

**Explanation:** A Compute Savings Plan is a flexible, hourly-commitment pricing model that automatically applies its discount to usage across EC2, Fargate, and Lambda, regardless of instance family, size, OS, or Region, which is exactly the cross-service coverage the workload needs.
- EC2 Instance Savings Plans: cap the commitment's reach to EC2 usage within a chosen instance family, leaving Fargate and Lambda spend unaffected.
- Spot Instances: lower EC2 (and some Fargate Spot) costs through interruptible capacity, but there is no equivalent commitment-based discount for Lambda.
- Standard Reserved Instances: tie the commitment to a specific EC2 instance family and Region, with no coverage for Fargate or Lambda at all.
> 🇻🇳 Cần một cam kết áp dụng chung cho EC2 + Fargate + Lambda → Compute Savings Plans; các lựa chọn khác chỉ áp dụng cho một phần compute.

---

## Q 16-v2-30
- domain: cost
- task: 4.1
- topic: cost
- services: Cost and Usage Report, S3, Athena
- difficulty: hard
- time: 70
- source: practice-exams/16-cost-optimization-exam-v2.md#Q30

A finance team needs granular, hourly, resource-level cost and usage data for custom analysis in Athena. Which feature?

- A. Cost Explorer UI only
- B. Budgets alerts
- C. Trusted Advisor export
- D. AWS Cost and Usage Report (CUR) delivered to S3

**Answer:** D

**Explanation:** Hourly resource-level cost data for Athena = Cost and Usage Report (CUR) to S3.
