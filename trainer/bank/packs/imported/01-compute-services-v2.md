---
pack: saa-01-compute-services-v2
title: 01 · Compute Services · V2
exam: SAA-C03
origin: imported
source: practice-exams/01-compute-services-exam-v2.md
created: 2026-10-16
---

# 01 · Compute Services · V2

> Imported from `practice-exams/01-compute-services-exam-v2.md` + `01-compute-services-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 01-v2-01
- domain: cost
- topic: compute
- services: EC2
- tags: spot-instances
- difficulty: medium
- time: 55
- source: practice-exams/01-compute-services-exam-v2.md#Q1

A batch-processing workload runs nightly, can be interrupted and restarted safely, and must be as cheap as possible. Which EC2 purchasing option is BEST?

- A. On-Demand Instances
- B. Reserved Instances (3-year, All Upfront)
- C. Spot Instances
- D. Dedicated Hosts

**Answer:** C

**Explanation:** Interruptible, restartable, cheapest = Spot Instances.

---

## Q 01-v2-02
- domain: performance
- topic: compute
- tags: savings-plans
- difficulty: medium
- time: 60
- source: practice-exams/01-compute-services-exam-v2.md#Q2

A company runs a steady-state production application 24/7 and wants maximum savings but retain the flexibility to change instance family, size, OS, and Region over a 3-year commitment. Which option is BEST?

- A. Standard Reserved Instances
- B. EC2 Instance Savings Plans
- C. Compute Savings Plans
- D. Spot Fleet

**Answer:** C

**Explanation:** Steady 24/7 + max flexibility (family/size/OS/Region) over 3 years = Compute Savings Plans.

---

## Q 01-v2-03
- domain: performance
- topic: compute
- tags: dedicated-hosts
- difficulty: medium
- time: 55
- source: practice-exams/01-compute-services-exam-v2.md#Q3

An application must run on physical servers dedicated to a single customer to satisfy a per-socket software license that is tied to physical cores. Which option meets this?

- A. Dedicated Instances
- B. Dedicated Hosts
- C. Spot Instances
- D. Cluster Placement Group

**Answer:** B

**Explanation:** Per-socket/physical-core license, single-tenant hardware, visibility into sockets = Dedicated Hosts.

---

## Q 01-v2-04
- domain: performance
- topic: compute
- tags: scaling-policies
- difficulty: medium
- time: 55
- source: practice-exams/01-compute-services-exam-v2.md#Q4

A web tier must automatically add instances when average CPU utilization exceeds 60% and remove them when it drops. Which scaling policy is SIMPLEST to configure?

- A. Simple scaling
- B. Step scaling
- C. Target tracking scaling
- D. Scheduled scaling

**Answer:** C

**Explanation:** Keep a metric (CPU 60%) at target, easiest setup = Target tracking scaling.

---

## Q 01-v2-05
- domain: performance
- topic: compute
- tags: scaling-policies
- difficulty: medium
- time: 60
- source: practice-exams/01-compute-services-exam-v2.md#Q5

Traffic to an application spikes predictably every weekday at 9 AM. The team wants capacity ready before the spike. Which approach is BEST?

- A. Target tracking scaling only
- B. Scheduled scaling
- C. Manual scaling each morning
- D. Larger instance with no Auto Scaling

**Answer:** B

**Explanation:** Predictable time-based spike, pre-provision capacity = Scheduled scaling.

---

## Q 01-v2-06
- domain: performance
- topic: compute
- services: Lambda, S3
- difficulty: medium
- time: 60
- source: practice-exams/01-compute-services-exam-v2.md#Q6

A serverless function processes images uploaded to S3. Occasionally a function needs 8 minutes and 4 GB of memory. Which service fits with the LEAST operational overhead?

- A. AWS Lambda
- B. EC2 with a cron job
- C. AWS Batch on EC2
- D. ECS on EC2

**Answer:** A

**Explanation:** Serverless, up to 15 min, up to 10 GB, least ops = AWS Lambda (8 min/4 GB fits).

---

## Q 01-v2-07
- domain: performance
- topic: compute
- services: Lambda
- tags: lambda-concurrency
- difficulty: medium
- time: 55
- source: practice-exams/01-compute-services-exam-v2.md#Q7

A Lambda-based API experiences slow first responses (cold starts) during traffic bursts, and low latency is required. What should be enabled?

- A. Reserved concurrency
- B. Provisioned concurrency
- C. Lambda Layers
- D. A larger /tmp size

**Answer:** B

**Explanation:** Eliminate cold starts / pre-warm for low latency = Provisioned concurrency (Reserved only caps concurrency).

---

## Q 01-v2-08
- domain: performance
- topic: compute
- services: ECS, Fargate, EC2
- difficulty: medium
- time: 55
- source: practice-exams/01-compute-services-exam-v2.md#Q8

A company wants to run Docker containers without managing any EC2 instances or scaling the cluster. Which is BEST?

- A. ECS on EC2 launch type
- B. ECS on Fargate
- C. EKS with self-managed nodes
- D. EC2 with Docker installed

**Answer:** B

**Explanation:** Containers with no cluster/EC2 management = ECS on Fargate.

---

## Q 01-v2-09
- domain: performance
- topic: compute
- services: EKS
- difficulty: medium
- time: 55
- source: practice-exams/01-compute-services-exam-v2.md#Q9

A team already uses Kubernetes on-premises and wants a managed control plane on AWS while keeping standard K8s tooling. Which service?

- A. Amazon ECS
- B. Amazon EKS
- C. AWS Batch
- D. Elastic Beanstalk

**Answer:** B

**Explanation:** Managed Kubernetes control plane + standard tooling = Amazon EKS.

---

## Q 01-v2-10
- domain: performance
- topic: compute
- services: Elastic Beanstalk, EC2, ELB, EC2 Auto Scaling
- difficulty: medium
- time: 55
- source: practice-exams/01-compute-services-exam-v2.md#Q10

A developer wants to deploy a Python web app quickly without managing the underlying EC2, load balancer, or Auto Scaling directly. Which service?

- A. AWS Lambda
- B. Amazon EC2
- C. AWS Elastic Beanstalk
- D. Amazon Lightsail

**Answer:** C

**Explanation:** Deploy app fast, AWS provisions ELB/ASG/EC2 for you = Elastic Beanstalk (PaaS).

---

## Q 01-v2-11
- domain: performance
- topic: compute
- tags: placement-groups
- difficulty: medium
- time: 55
- source: practice-exams/01-compute-services-exam-v2.md#Q11

An HPC application needs the lowest possible network latency between instances performing tightly-coupled computation. Which placement strategy is BEST?

- A. Spread placement group
- B. Partition placement group
- C. Cluster placement group
- D. Instances in different AZs

**Answer:** C

**Explanation:** Lowest latency, tightly-coupled, same-AZ = Cluster placement group.

---

## Q 01-v2-12
- domain: performance
- topic: compute
- tags: placement-groups
- difficulty: medium
- time: 55
- source: practice-exams/01-compute-services-exam-v2.md#Q12

A critical set of 6 instances must be placed on distinct underlying hardware to minimize simultaneous failure. Which placement group is appropriate?

- A. Cluster
- B. Spread
- C. Partition
- D. None; use one large instance

**Answer:** B

**Explanation:** Distinct hardware to reduce correlated failure = Spread placement group (max 7/AZ).

---

## Q 01-v2-13
- domain: performance
- topic: compute
- services: Elastic Beanstalk
- tags: deployment-strategies
- difficulty: medium
- time: 50
- source: practice-exams/01-compute-services-exam-v2.md#Q13

An Elastic Beanstalk environment must deploy a new version with ZERO downtime and easy rollback by swapping environments. Which deployment policy?

- A. All at once
- B. Rolling
- C. Immutable
- D. Blue/Green

**Answer:** D

**Explanation:** Zero downtime + swap environments + easy rollback = Blue/Green.

---

## Q 01-v2-14
- domain: cost
- topic: compute
- tags: instance-store
- difficulty: medium
- time: 55
- source: practice-exams/01-compute-services-exam-v2.md#Q14

An application temporarily stores scratch data that can be regenerated and needs the highest possible IOPS at the lowest cost. Which storage should the instance use?

- A. gp3 EBS volume
- B. io2 EBS volume
- C. Instance Store
- D. EFS

**Answer:** C

**Explanation:** Regenerable scratch data, highest IOPS, cheapest = Instance Store (ephemeral).

---

## Q 01-v2-15
- domain: performance
- topic: compute
- services: Lambda, VPC, RDS
- tags: subnets
- difficulty: medium
- time: 60
- source: practice-exams/01-compute-services-exam-v2.md#Q15

A workload needs Lambda functions to reach an RDS database inside a private subnet. What must be configured?

- A. Attach the Lambda function to the VPC and its private subnets
- B. Make the RDS instance public
- C. Use Lambda Layers
- D. Increase Lambda memory

**Answer:** A

**Explanation:** Lambda reaching private RDS = attach function to VPC/private subnets.

---

## Q 01-v2-16
- domain: performance
- topic: compute
- services: ALB
- tags: scaling-policies
- difficulty: medium
- time: 60
- source: practice-exams/01-compute-services-exam-v2.md#Q16

A fleet of stateless web servers should scale based on the number of requests per instance behind an ALB. Which metric-based policy fits best?

- A. Target tracking on ALBRequestCountPerTarget
- B. Scheduled scaling
- C. Step scaling on disk I/O
- D. Manual desired capacity

**Answer:** A

**Explanation:** Scale on requests per target behind ALB = Target tracking on ALBRequestCountPerTarget.

---

## Q 01-v2-17
- domain: performance
- topic: compute
- services: Lightsail
- difficulty: medium
- time: 55
- source: practice-exams/01-compute-services-exam-v2.md#Q17

A company wants a simple, fixed monthly price to host a small WordPress site including compute, storage, and networking. Which service?

- A. Amazon EC2
- B. AWS Fargate
- C. Amazon Lightsail
- D. AWS Batch

**Answer:** C

**Explanation:** Fixed monthly price bundle for small WordPress site = Amazon Lightsail.

---

## Q 01-v2-18
- domain: cost
- topic: compute
- services: AWS Batch
- tags: spot-instances
- difficulty: medium
- time: 50
- source: practice-exams/01-compute-services-exam-v2.md#Q18

Long-running (multi-hour) containerized jobs must be queued, scheduled, and run cost-effectively with Spot capacity. Which service is purpose-built?

- A. AWS Lambda
- B. AWS Batch
- C. Elastic Beanstalk
- D. Amazon Lightsail

**Answer:** B

**Explanation:** Queued, scheduled, long-running containers on Spot = AWS Batch.

---

## Q 01-v2-19
- domain: performance
- topic: compute
- services: ELB, EC2 Auto Scaling, EC2
- tags: route53-health-checks
- difficulty: medium
- time: 55
- source: practice-exams/01-compute-services-exam-v2.md#Q19

An Auto Scaling group should replace instances that fail application-level health checks, not just EC2 status checks. What should be configured?

- A. EC2 health checks only
- B. ELB (target group) health checks
- C. A larger cooldown
- D. Scheduled scaling

**Answer:** B

**Explanation:** Replace app-unhealthy instances (not just EC2 status) = ELB/target group health checks.

---

## Q 01-v2-20
- domain: performance
- topic: compute
- services: Lambda
- difficulty: medium
- time: 55
- source: practice-exams/01-compute-services-exam-v2.md#Q20

A company wants to reduce Lambda cost and improve performance for a CPU-bound function. Increasing which setting also proportionally increases CPU allocation?

- A. Timeout
- B. Memory
- C. Reserved concurrency
- D. Ephemeral /tmp storage

**Answer:** B

**Explanation:** More Lambda memory = proportionally more CPU (helps CPU-bound funcs).

---

## Q 01-v2-21
- domain: cost
- topic: compute
- services: Fargate, ECS
- tags: spot-instances
- difficulty: hard
- time: 85
- source: practice-exams/01-compute-services-exam-v2.md#Q21

A stateless containerized workload must run on ECS at the LOWEST cost while tolerating interruptions, but a minimum baseline of tasks must always stay available. Which approach is BEST?

- A. Run everything on Fargate On-Demand
- B. Use a capacity provider strategy mixing Fargate and Fargate Spot with a base of On-Demand tasks
- C. Run all tasks on EC2 On-Demand only
- D. Run all tasks on Fargate Spot only

**Answer:** B

**Explanation:** Lowest cost + interruption-tolerant + guaranteed base = capacity provider mixing Fargate + Fargate Spot with On-Demand base.

---

## Q 01-v2-22
- domain: performance
- topic: compute
- services: EC2 Auto Scaling
- tags: asg-lifecycle-hooks, asg-warm-pool
- difficulty: hard
- time: 95
- source: practice-exams/01-compute-services-exam-v2.md#Q22

An Auto Scaling group must ensure new instances are fully bootstrapped (config pulled, warmed) before receiving traffic, and must run cleanup logic before termination. Which two features address this? (Choose TWO)

- A. Lifecycle hooks
- B. Larger cooldown period
- C. Warm pools
- D. Spot Fleet
- E. Predictive scaling only

**Answer:** A, C

**Explanation:** Bootstrap-before-traffic and pre-termination cleanup = Warm pools + Lifecycle hooks.

---

## Q 01-v2-23
- domain: performance
- topic: compute
- tags: placement-groups, efa
- difficulty: hard
- time: 75
- source: practice-exams/01-compute-services-exam-v2.md#Q23

A machine-learning training job needs many instances communicating with very high throughput and low, consistent latency using OS-bypass networking. Which combination is BEST?

- A. Spread placement group + ENA
- B. Cluster placement group + Elastic Fabric Adapter (EFA)
- C. Partition placement group + EBS-optimized
- D. Multiple AZs + Global Accelerator

**Answer:** B

**Explanation:** HPC/ML tightly-coupled, OS-bypass, high throughput = Cluster placement group + EFA.

---

## Q 01-v2-24
- domain: performance
- topic: compute
- services: EC2 Auto Scaling
- tags: scaling-policies
- difficulty: hard
- time: 70
- source: practice-exams/01-compute-services-exam-v2.md#Q24

A company wants an ASG to scale proactively based on forecasted daily/weekly cyclical demand rather than reacting to current metrics. Which policy?

- A. Simple scaling
- B. Step scaling
- C. Predictive scaling
- D. Target tracking only

**Answer:** C

**Explanation:** Proactive scaling from forecasted cyclical demand = Predictive scaling.

---

## Q 01-v2-25
- domain: resilient
- topic: compute
- services: Lambda, S3
- tags: sqs-dlq
- difficulty: hard
- time: 75
- source: practice-exams/01-compute-services-exam-v2.md#Q25

A Lambda function is invoked asynchronously from S3. Some events fail all retries and must be captured for later inspection without losing data. What should be configured?

- A. Provisioned concurrency
- B. A Lambda destination or dead-letter queue (DLQ) for failures
- C. Reserved concurrency
- D. A larger timeout

**Answer:** B

**Explanation:** Capture async failures after retries without data loss = Lambda on-failure destination or DLQ.

---

## Q 01-v2-26
- domain: performance
- topic: compute
- services: EC2, EC2 Auto Scaling
- tags: ami, user-data
- difficulty: hard
- time: 75
- source: practice-exams/01-compute-services-exam-v2.md#Q26

During instance launch, an application must run different bootstrap logic depending on which ASG the instance belongs to, without baking multiple AMIs. Which approach is BEST?

- A. Separate AMI per ASG
- B. EC2 user data with instance metadata / tags to branch logic
- C. Manual SSH configuration
- D. Dedicated Hosts

**Answer:** B

**Explanation:** Branch bootstrap by ASG without multiple AMIs = user data + instance metadata/tags.

---

## Q 01-v2-27
- domain: cost
- topic: compute
- tags: spot-instances
- difficulty: hard
- time: 70
- source: practice-exams/01-compute-services-exam-v2.md#Q27

A fleet uses Spot Instances for cost but must minimize interruptions during capacity reclamation. Which allocation strategy for the Spot request is BEST?

- A. lowestPrice
- B. capacityOptimized
- C. diversified across the fewest pools
- D. Single instance type in one AZ

**Answer:** B

**Explanation:** Minimize Spot interruptions = capacityOptimized allocation strategy.

---

## Q 01-v2-28
- domain: secure
- topic: compute
- services: EC2
- tags: dedicated-hosts
- difficulty: hard
- time: 95
- source: practice-exams/01-compute-services-exam-v2.md#Q28

A regulated workload must keep a specific EC2 instance running on the SAME physical host over time for a socket-based BYOL license, and needs visibility into physical cores. Which two are required? (Choose TWO)

- A. Dedicated Hosts
- B. Host affinity set to "Host"
- C. Dedicated Instances
- D. Spot Instances
- E. Cluster placement group

**Answer:** A, B

**Explanation:** Same physical host over time for socket BYOL + core visibility = Dedicated Hosts with host affinity = Host.

---

## Q 01-v2-29
- domain: performance
- topic: compute
- services: EC2 Auto Scaling, EC2
- tags: asg-warm-pool, ec2-hibernation
- difficulty: hard
- time: 75
- source: practice-exams/01-compute-services-exam-v2.md#Q29

A latency-sensitive gaming backend needs to keep a pool of pre-initialized EC2 instances that can enter service in seconds during sudden spikes, minimizing scale-out time and cost of idle full-price instances. Which feature?

- A. Provisioned concurrency
- B. ASG warm pools (stopped/hibernated pre-initialized instances)
- C. Scheduled scaling only
- D. Larger cooldown

**Answer:** B

**Explanation:** Pre-initialized pool entering service in seconds, low idle cost = ASG warm pools.

---

## Q 01-v2-30
- domain: performance
- topic: compute
- services: EC2, Lambda, EBS
- tags: ec2-hibernation
- difficulty: hard
- time: 75
- source: practice-exams/01-compute-services-exam-v2.md#Q30

A Lambda function must resume a long process quickly and preserve in-memory state across a stop, on an EC2-based alternative. For the EC2 fallback, which feature lets an instance save RAM to EBS and resume state on start?

- A. EC2 Hibernation
- B. Instance Store
- C. Placement group
- D. Enhanced networking

**Answer:** A

**Explanation:** Save RAM to EBS and resume in-memory state on start = EC2 Hibernation.
