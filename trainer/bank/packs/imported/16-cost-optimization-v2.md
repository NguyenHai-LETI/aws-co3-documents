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
- topic: cost
- tags: reserved-instances
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q1

A predictable production workload runs 24/7 for 3 years on a fixed instance type. MOST cost-effective purchase?

- A. On-Demand
- B. Standard Reserved Instances (3-year)
- C. Spot Instances
- D. Dedicated Hosts

**Answer:** B

**Explanation:** Predictable 24/7 fixed type, 3 years = Standard Reserved Instances.

---

## Q 16-v2-02
- domain: cost
- topic: cost
- tags: high-availability, spot-instances
- difficulty: medium
- time: 45
- source: practice-exams/16-cost-optimization-exam-v2.md#Q2

A fault-tolerant batch job can be interrupted. Cheapest compute?

- A. On-Demand
- B. Reserved Instances
- C. Spot Instances
- D. Dedicated Hosts

**Answer:** C

**Explanation:** Interruptible fault-tolerant batch = Spot Instances.

---

## Q 16-v2-03
- domain: cost
- topic: cost
- tags: savings-plans
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q3

A workload needs flexibility across instance families/Regions with steady usage. Best savings mechanism?

- A. Compute Savings Plans
- B. Standard RIs
- C. On-Demand
- D. Spot only

**Answer:** A

**Explanation:** Flexible across families/Regions, steady = Compute Savings Plans.

---

## Q 16-v2-04
- domain: cost
- topic: cost
- services: S3
- tags: s3-intelligent-tiering
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q4

S3 data has unknown, changing access patterns. Cheapest without lifecycle management?

- A. S3 Standard
- B. S3 Intelligent-Tiering
- C. S3 Standard-IA
- D. Glacier

**Answer:** B

**Explanation:** Unknown/changing pattern, no lifecycle mgmt = S3 Intelligent-Tiering.

---

## Q 16-v2-05
- domain: cost
- topic: cost
- services: S3 Glacier
- tags: s3-storage-classes
- difficulty: medium
- time: 55
- source: practice-exams/16-cost-optimization-exam-v2.md#Q5

Logs are frequently accessed for 30 days, then rarely. Which lifecycle minimizes cost?

- A. Keep in S3 Standard forever
- B. Transition to Standard-IA after 30 days, then Glacier
- C. Delete after 1 day
- D. One Zone-IA immediately

**Answer:** B

**Explanation:** Frequent 30 days then rare = Standard-IA after 30 days then Glacier.

---

## Q 16-v2-06
- domain: cost
- topic: cost
- services: Aurora
- tags: aurora-serverless
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q6

An idle-then-bursty relational workload should minimize cost. Which option?

- A. Aurora Serverless v2
- B. Largest provisioned instance
- C. On-Demand DynamoDB
- D. Multi-AZ RDS max size

**Answer:** A

**Explanation:** Idle-then-bursty relational = Aurora Serverless v2.

---

## Q 16-v2-07
- domain: cost
- topic: cost
- services: Compute Optimizer
- tags: right-sizing
- difficulty: medium
- time: 45
- source: practice-exams/16-cost-optimization-exam-v2.md#Q7

Which tool provides right-sizing recommendations based on actual utilization?

- A. AWS Compute Optimizer
- B. CloudTrail
- C. Config
- D. GuardDuty

**Answer:** A

**Explanation:** Right-sizing from utilization = AWS Compute Optimizer.

---

## Q 16-v2-08
- domain: cost
- topic: cost
- services: Cost Explorer
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q8

Which tool visualizes and analyzes historical spend and forecasts future cost?

- A. AWS Cost Explorer
- B. CloudWatch
- C. Trusted Advisor
- D. Config

**Answer:** A

**Explanation:** Visualize/forecast spend = AWS Cost Explorer.

---

## Q 16-v2-09
- domain: cost
- topic: cost
- services: AWS Budgets
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q9

A team must be alerted when monthly spend exceeds a threshold. Which service?

- A. AWS Budgets
- B. Cost Explorer only
- C. CloudTrail
- D. Config

**Answer:** A

**Explanation:** Alert on budget threshold = AWS Budgets.

---

## Q 16-v2-10
- domain: cost
- topic: cost
- services: Cost Anomaly Detection
- tags: threat-detection
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q10

Which feature automatically detects unusual spend spikes using ML?

- A. AWS Cost Anomaly Detection
- B. Trusted Advisor
- C. CloudWatch alarm
- D. Config rule

**Answer:** A

**Explanation:** ML-based spend spike detection = Cost Anomaly Detection.

---

## Q 16-v2-11
- domain: cost
- topic: cost
- services: VPC Endpoint, S3, NAT Gateway
- difficulty: medium
- time: 55
- source: practice-exams/16-cost-optimization-exam-v2.md#Q11

NAT Gateway data processing costs are high for traffic to S3. Which reduces cost?

- A. Gateway VPC endpoint for S3 (avoids NAT)
- B. Larger NAT Gateway
- C. More NAT Gateways
- D. Interface endpoint for S3

**Answer:** A

**Explanation:** Avoid NAT cost for S3 = Gateway VPC endpoint.

---

## Q 16-v2-12
- domain: cost
- topic: cost
- services: Organizations
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q12

A company wants volume discounts and one bill across many accounts. Which feature?

- A. Consolidated billing via AWS Organizations
- B. Separate bills
- C. Per-account RIs only
- D. Savings Plans per user

**Answer:** A

**Explanation:** Volume discounts + one bill = Consolidated billing via Organizations.

---

## Q 16-v2-13
- domain: cost
- topic: cost
- tags: tagging
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q13

Cost must be allocated per team/project across resources. Which mechanism?

- A. Cost allocation tags
- B. IAM policies
- C. Security groups
- D. Config rules

**Answer:** A

**Explanation:** Per-team cost attribution = Cost allocation tags.

---

## Q 16-v2-14
- domain: cost
- topic: cost
- difficulty: medium
- time: 55
- source: practice-exams/16-cost-optimization-exam-v2.md#Q14

A dev/test environment runs only during business hours. Cheapest approach?

- A. Schedule start/stop (e.g., Instance Scheduler) to run only when needed
- B. Run 24/7 On-Demand
- C. Buy 3-year RIs
- D. Dedicated Hosts

**Answer:** A

**Explanation:** Dev/test only business hours = schedule start/stop.

---

## Q 16-v2-15
- domain: cost
- topic: cost
- services: EBS
- tags: right-sizing, ebs-volume-types
- difficulty: medium
- time: 55
- source: practice-exams/16-cost-optimization-exam-v2.md#Q15

Over-provisioned EBS gp2 volumes cost too much. Which switch can reduce cost and let you tune IOPS/throughput independently?

- A. Migrate to gp3
- B. Migrate to io2
- C. Migrate to st1 for boot
- D. Use Instance Store

**Answer:** A

**Explanation:** Cheaper tunable EBS = migrate gp2 to gp3.

---

## Q 16-v2-16
- domain: cost
- topic: cost
- services: EBS
- tags: snapshots
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q16

Rarely accessed EBS snapshots must cost less; slower restore is OK. Which feature?

- A. EBS Snapshot Archive
- B. Fast Snapshot Restore
- C. Multi-Attach
- D. gp3

**Answer:** A

**Explanation:** Cheap rarely-restored snapshots = EBS Snapshot Archive.

---

## Q 16-v2-17
- domain: cost
- topic: cost
- services: Fargate, ECS
- tags: spot-instances
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q17

A containerized, interruption-tolerant workload should minimize cost on ECS. Which option?

- A. Fargate Spot
- B. Fargate On-Demand
- C. EC2 On-Demand
- D. Dedicated Hosts

**Answer:** A

**Explanation:** Interruption-tolerant container cost = Fargate Spot.

---

## Q 16-v2-18
- domain: cost
- topic: cost
- services: RDS, ElastiCache, Redshift
- tags: reserved-instances
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q18

A steady-usage RDS/ElastiCache/Redshift deployment should reduce cost with commitment. Which option?

- A. Reserved Instances / Reserved Nodes
- B. On-Demand only
- C. Spot
- D. Savings Plans (not applicable to these)

**Answer:** A

**Explanation:** Steady RDS/ElastiCache/Redshift = Reserved Instances/Nodes.

---

## Q 16-v2-19
- domain: cost
- topic: cost
- services: CloudFront
- tags: data-transfer-cost
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q19

Global content delivery reduces origin data transfer cost and latency. Which service?

- A. Amazon CloudFront
- B. Global Accelerator
- C. NAT Gateway
- D. Direct Connect

**Answer:** A

**Explanation:** Reduce origin transfer + latency globally = CloudFront.

---

## Q 16-v2-20
- domain: cost
- topic: cost
- services: Compute Optimizer, Lambda
- tags: spot-instances
- difficulty: medium
- time: 50
- source: practice-exams/16-cost-optimization-exam-v2.md#Q20

A Lambda function is over-allocated memory. Which tool helps find the cost/performance sweet spot?

- A. AWS Compute Optimizer / Lambda Power Tuning
- B. Config
- C. CloudTrail
- D. Trusted Advisor only

**Answer:** A

**Explanation:** Lambda memory sweet spot = Compute Optimizer / Lambda Power Tuning.

---

## Q 16-v2-21
- domain: cost
- topic: cost
- services: EC2 Auto Scaling
- tags: savings-plans, reserved-instances, spot-instances
- difficulty: hard
- time: 95
- source: practice-exams/16-cost-optimization-exam-v2.md#Q21

A company has a steady baseline plus variable spikes. Which cost-optimal mix? (Choose TWO)

- A. Savings Plans/Reserved Instances for the steady baseline
- B. Spot or On-Demand Auto Scaling for the variable spikes
- C. Reserved Instances for peak spikes
- D. Dedicated Hosts for everything
- E. On-Demand for the entire baseline

**Answer:** A, B

**Explanation:** Baseline on Savings Plans/RIs + spikes on Spot/On-Demand Auto Scaling.

---

## Q 16-v2-22
- domain: cost
- topic: cost
- difficulty: hard
- time: 95
- source: practice-exams/16-cost-optimization-exam-v2.md#Q22

Cross-AZ data transfer between chatty microservices is costly. Which two reduce this cost? (Choose TWO)

- A. Co-locate communicating instances in the same AZ where availability allows
- B. Use placement/architecture that reduces cross-AZ chatter
- C. Send all traffic through a NAT Gateway
- D. Move to cross-Region
- E. Use public IPs between instances

**Answer:** A, B

**Explanation:** Reduce cross-AZ cost = co-locate in same AZ + reduce cross-AZ chatter.

---

## Q 16-v2-23
- domain: cost
- topic: cost
- tags: spot-instances
- difficulty: hard
- time: 95
- source: practice-exams/16-cost-optimization-exam-v2.md#Q23

A company wants maximum Spot savings for a stateless fleet while minimizing interruptions and capacity gaps. Which two strategies? (Choose TWO)

- A. Diversify across multiple instance types and AZs
- B. Use capacity-optimized allocation strategy
- C. Single instance type in one AZ
- D. Only lowestPrice with one pool
- E. Reserved Instances for Spot

**Answer:** A, B

**Explanation:** Max Spot with fewer interruptions = diversify types/AZs + capacity-optimized strategy.

---

## Q 16-v2-24
- domain: cost
- topic: cost
- services: S3 Glacier, S3, Data Pipeline
- tags: s3-storage-classes
- difficulty: hard
- time: 105
- source: practice-exams/16-cost-optimization-exam-v2.md#Q24

A data pipeline writes to S3 and immediately transitions objects to Glacier, but small objects incur high per-object and minimum-duration charges. Which two considerations apply? (Choose TWO)

- A. IA/Glacier classes have minimum storage durations (30/90 days) and per-object overhead
- B. Very small/short-lived objects may be cheaper in S3 Standard
- C. Glacier is always cheapest regardless of object size/age
- D. Lifecycle transitions are free of minimums
- E. One Zone-IA has no minimum duration

**Answer:** A, B

**Explanation:** IA/Glacier have min durations + per-object overhead; tiny/short objects cheaper in Standard.

---

## Q 16-v2-25
- domain: cost
- topic: cost
- services: Organizations
- tags: scp
- difficulty: hard
- time: 70
- source: practice-exams/16-cost-optimization-exam-v2.md#Q25

An enterprise wants to enforce that only approved, cost-efficient instance types can be launched across accounts. Which service enforces this?

- A. Service Control Policies (SCPs) via Organizations
- B. Cost Explorer
- C. Budgets
- D. Trusted Advisor

**Answer:** A

**Explanation:** Enforce approved instance types = SCPs via Organizations.

---

## Q 16-v2-26
- domain: cost
- topic: cost
- services: Redshift
- difficulty: hard
- time: 75
- source: practice-exams/16-cost-optimization-exam-v2.md#Q26

A Redshift cluster is used heavily during the day and idle at night; the team wants to avoid managing capacity and pay for what they use. Which option?

- A. Amazon Redshift Serverless
- B. Largest RA3 always-on
- C. Reserved nodes only
- D. DC2 dense compute always-on

**Answer:** A

**Explanation:** Redshift pay-per-use, no capacity mgmt = Redshift Serverless.

---

## Q 16-v2-27
- domain: cost
- topic: cost
- services: S3 Glacier, S3
- tags: s3-replication, s3-storage-classes
- difficulty: hard
- time: 100
- source: practice-exams/16-cost-optimization-exam-v2.md#Q27

A company must reduce cost of infrequently accessed cross-Region replication while keeping DR. Which two apply? (Choose TWO)

- A. Replicate to a cheaper storage class in the destination (e.g., Standard-IA/Glacier)
- B. Use S3 Replication with a destination storage class
- C. Replicate everything to S3 Standard only
- D. Disable versioning to save cost
- E. Use Transfer Acceleration for replication

**Answer:** A, B

**Explanation:** Cheaper DR replication = replicate to cheaper destination class via S3 Replication.

---

## Q 16-v2-28
- domain: cost
- topic: cost
- services: S3, DynamoDB, PrivateLink, ECR, Systems Manager, NAT Gateway
- difficulty: hard
- time: 100
- source: practice-exams/16-cost-optimization-exam-v2.md#Q28

A NAT Gateway is used only to let private instances reach a few AWS services (S3, DynamoDB, ECR, SSM). Which two reduce NAT costs? (Choose TWO)

- A. Gateway endpoints for S3/DynamoDB
- B. Interface (PrivateLink) endpoints for services like ECR/SSM
- C. Add more NAT Gateways
- D. Use a public subnet for all instances
- E. Remove all endpoints

**Answer:** A, B

**Explanation:** Cut NAT cost = Gateway endpoints (S3/DynamoDB) + Interface endpoints (ECR/SSM).

---

## Q 16-v2-29
- domain: cost
- topic: cost
- services: EC2, Fargate, Lambda
- tags: savings-plans
- difficulty: hard
- time: 70
- source: practice-exams/16-cost-optimization-exam-v2.md#Q29

A workload's compute commitment must cover Lambda and Fargate too, not just EC2. Which purchasing option applies?

- A. Compute Savings Plans (cover EC2, Fargate, Lambda)
- B. EC2 Instance Savings Plans only
- C. Standard RIs
- D. Spot only

**Answer:** A

**Explanation:** Cover EC2+Fargate+Lambda = Compute Savings Plans.

---

## Q 16-v2-30
- domain: cost
- topic: cost
- services: Cost and Usage Report, S3, Athena
- difficulty: hard
- time: 70
- source: practice-exams/16-cost-optimization-exam-v2.md#Q30

A finance team needs granular, hourly, resource-level cost and usage data for custom analysis in Athena. Which feature?

- A. AWS Cost and Usage Report (CUR) delivered to S3
- B. Cost Explorer UI only
- C. Budgets alerts
- D. Trusted Advisor export

**Answer:** A

**Explanation:** Hourly resource-level cost data for Athena = Cost and Usage Report (CUR) to S3.
