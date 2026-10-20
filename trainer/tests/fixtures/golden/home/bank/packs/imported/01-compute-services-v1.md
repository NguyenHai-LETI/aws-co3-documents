---
pack: saa-01-compute-services-v1
title: 01 · Compute Services · V1
exam: SAA-C03
origin: imported
source: practice-exams/01-compute-services-exam.md
created: 2026-10-16
---

# 01 · Compute Services · V1

> Imported from `practice-exams/01-compute-services-exam.md` + `01-compute-services-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 01-v1-01
- domain: cost
- task: 4.2
- topic: compute
- services: EC2
- tags: reserved-instances
- difficulty: easy
- time: 50
- source: practice-exams/01-compute-services-exam.md#Q1

A company runs a production web application on Amazon EC2 24/7. The workload is steady and predictable for the next 3 years. Which purchasing option is the MOST cost-effective?

- A. Standard Reserved Instances (3-year, All Upfront)
- B. Spot Instances
- C. On-Demand Instances
- D. Dedicated Hosts

**Answer:** A

**Explanation:** Steady, predictable 24/7 for 3 years = Standard RI 3-year All Upfront (highest discount).

---

## Q 01-v1-02
- domain: cost
- task: 4.2
- topic: compute
- services: EC2
- tags: spot-instances
- difficulty: easy
- time: 45
- source: practice-exams/01-compute-services-exam.md#Q2

A data-processing job runs nightly, can be interrupted and restarted, and must minimize cost. Which EC2 purchasing option should the architect choose?

- A. Reserved Instances
- B. Dedicated Instances
- C. Spot Instances
- D. On-Demand Instances

**Answer:** C

**Explanation:** Interruptible + restartable + cheapest = Spot Instances (up to 90% off).

---

## Q 01-v1-03
- domain: performance
- task: 3.2
- topic: compute
- services: ECS, Fargate
- tags: serverless-cost
- difficulty: easy
- time: 55
- source: practice-exams/01-compute-services-exam.md#Q3

A solutions architect needs to run a containerized microservice with NO infrastructure to manage and pay only for the resources each task uses. Which option meets the requirement with the LEAST operational overhead?

- A. Amazon EKS with self-managed nodes
- B. Amazon ECS on AWS Fargate
- C. EC2 Auto Scaling group running Docker
- D. Amazon ECS on EC2 launch type

**Answer:** B

**Explanation:** No infrastructure + pay per task = ECS on Fargate.

---

## Q 01-v1-04
- domain: performance
- task: 3.2
- topic: compute
- services: Lambda, S3
- difficulty: easy
- time: 50
- source: practice-exams/01-compute-services-exam.md#Q4

An application processes images uploaded to Amazon S3. Processing takes about 20 seconds per image and traffic is unpredictable. Which compute service requires the LEAST operational overhead?

- A. AWS Lambda triggered by S3 events
- B. Amazon EC2 with Auto Scaling
- C. Amazon ECS on EC2
- D. AWS Batch on EC2

**Answer:** A

**Explanation:** Event-driven, unpredictable, <15 min = Lambda triggered by S3 (least ops).

---

## Q 01-v1-05
- domain: performance
- task: 3.2
- topic: compute
- tags: placement-groups, efa
- difficulty: easy
- time: 50
- source: practice-exams/01-compute-services-exam.md#Q5

A company wants to run a high-performance computing (HPC) workload that requires the lowest possible network latency between instances. Which configuration should be used?

- A. Spread placement group across multiple AZs
- B. Instances in different Regions behind Global Accelerator
- C. Cluster placement group with Elastic Fabric Adapter (EFA)
- D. Partition placement group

**Answer:** C

**Explanation:** Lowest inter-node latency for HPC = Cluster placement group + EFA.

---

## Q 01-v1-06
- domain: performance
- task: 3.2
- topic: compute
- services: Fargate, AWS Batch, Lambda
- difficulty: easy
- time: 55
- source: practice-exams/01-compute-services-exam.md#Q6

A Lambda function must run for 25 minutes to complete a large data transformation. What should the architect do?

- A. Increase the Lambda timeout to 25 minutes
- B. Split into 2 Lambda functions chained by SNS
- C. Increase the Lambda memory to 10 GB
- D. Use AWS Fargate or AWS Batch instead of Lambda

**Answer:** D

**Explanation:** Lambda max is 15 min; 25-min job needs Fargate or AWS Batch.

---

## Q 01-v1-07
- domain: performance
- task: 3.2
- topic: compute
- services: EC2, EC2 Auto Scaling
- tags: scaling-policies
- difficulty: easy
- time: 50
- source: practice-exams/01-compute-services-exam.md#Q7

A fleet of EC2 instances in an Auto Scaling group must scale to keep average CPU utilization at 60%. Which scaling policy is simplest to configure for this goal?

- A. Step scaling
- B. Simple scaling
- C. Scheduled scaling
- D. Target tracking scaling

**Answer:** D

**Explanation:** Keep a metric (CPU 60%) at target = Target tracking scaling (simplest).

---

## Q 01-v1-08
- domain: performance
- task: 3.2
- topic: compute
- services: Elastic Beanstalk
- difficulty: easy
- time: 45
- source: practice-exams/01-compute-services-exam.md#Q8

An Elastic Beanstalk application must be deployed with ZERO downtime and the ability to quickly roll back if the new version fails. Which deployment policy is BEST?

- A. Immutable
- B. Rolling with additional batch
- C. Rolling
- D. All at once

**Answer:** A

**Explanation:** Zero downtime + easy rollback = Immutable (new ASG, swap if healthy).

---

## Q 01-v1-09
- domain: performance
- task: 3.2
- topic: compute
- services: EC2
- tags: instance-store
- difficulty: easy
- time: 45
- source: practice-exams/01-compute-services-exam.md#Q9

A workload needs temporary scratch storage with very high IOPS that does not need to persist after the instance stops. Which storage should be used?

- A. EC2 Instance Store
- B. Amazon EFS
- C. Amazon EBS gp3
- D. Amazon S3

**Answer:** A

**Explanation:** Temporary, very high IOPS, no persistence = Instance Store.

---

## Q 01-v1-10
- domain: performance
- task: 3.2
- topic: compute
- services: EC2 Auto Scaling
- tags: scaling-policies
- difficulty: easy
- time: 50
- source: practice-exams/01-compute-services-exam.md#Q10

A company predicts traffic spikes every weekday at 8 AM. They want capacity ready before the spike. Which Auto Scaling approach is MOST appropriate?

- A. Scheduled scaling (or predictive scaling)
- B. Spot Fleet with diversified strategy
- C. Manual scaling each morning
- D. Target tracking scaling only

**Answer:** A

**Explanation:** Known time-based spike = Scheduled scaling (predictive also valid/proactive).

---

## Q 01-v1-11
- domain: performance
- task: 3.2
- topic: compute
- services: EKS, ECS
- difficulty: easy
- time: 50
- source: practice-exams/01-compute-services-exam.md#Q11

Which statement about Amazon EKS vs Amazon ECS is correct?

- A. ECS requires you to manage a Kubernetes control plane
- B. EKS runs standard Kubernetes and supports multi-cloud portability
- C. EKS is AWS-proprietary and not portable
- D. ECS cannot run on Fargate

**Answer:** B

**Explanation:** EKS = standard Kubernetes, portable across clouds.

---

## Q 01-v1-12
- domain: performance
- task: 3.2
- topic: compute
- tags: dedicated-hosts
- difficulty: easy
- time: 45
- source: practice-exams/01-compute-services-exam.md#Q12

A company has strict licensing requirements that need visibility and control over the physical server (sockets/cores) where instances run. Which option meets this?

- A. Spot Instances
- B. Dedicated Hosts
- C. Dedicated Instances
- D. Reserved Instances

**Answer:** B

**Explanation:** Visibility/control of physical sockets/cores for licensing = Dedicated Hosts.

---

## Q 01-v1-13
- domain: performance
- task: 3.2
- topic: compute
- services: Fargate, Lambda
- tags: savings-plans
- difficulty: easy
- time: 45
- source: practice-exams/01-compute-services-exam.md#Q13

A team wants flexible Savings on compute that applies across instance families, Regions, and even Fargate/Lambda. Which option should they choose?

- A. Standard Reserved Instances
- B. EC2 Instance Savings Plans
- C. Compute Savings Plans
- D. Spot Instances

**Answer:** C

**Explanation:** Most flexible (families/Regions/Fargate/Lambda) = Compute Savings Plans.

---

## Q 01-v1-14
- domain: performance
- task: 3.2
- topic: compute
- services: EC2 Auto Scaling
- tags: spot-instances, on-demand-instances, launch-template
- difficulty: easy
- time: 45
- source: practice-exams/01-compute-services-exam.md#Q14

An application must mix Spot and On-Demand instances and use multiple instance types in one Auto Scaling group. What enables this?

- A. Placement group
- B. Launch template with mixed instances policy
- C. Launch configuration
- D. Capacity Reservation

**Answer:** B

**Explanation:** Mixed Spot+On-Demand and multiple types = Launch template + mixed instances policy.

---

## Q 01-v1-15
- domain: performance
- task: 3.2
- topic: compute
- services: Lambda
- tags: lambda-concurrency
- difficulty: easy
- time: 45
- source: practice-exams/01-compute-services-exam.md#Q15

Which Lambda feature eliminates cold-start latency for a latency-sensitive API?

- A. Reserved concurrency
- B. Lambda layers
- C. Increasing the memory allocation
- D. Provisioned concurrency

**Answer:** D

**Explanation:** Remove cold starts = Provisioned concurrency (pre-warmed).

---

## Q 01-v1-16
- domain: performance
- task: 3.2
- topic: compute
- services: AWS Batch
- difficulty: easy
- time: 45
- source: practice-exams/01-compute-services-exam.md#Q16

A batch workload runs Docker containers, takes several hours, and should automatically provision and scale the right compute. Which service is purpose-built for this?

- A. AWS Elastic Beanstalk
- B. Amazon Lightsail
- C. AWS Batch
- D. AWS Lambda

**Answer:** C

**Explanation:** Long-running Docker batch jobs with auto provisioning = AWS Batch.

---

## Q 01-v1-17
- domain: performance
- task: 3.2
- topic: compute
- services: EC2
- tags: placement-groups
- difficulty: easy
- time: 45
- source: practice-exams/01-compute-services-exam.md#Q17

To distribute EC2 instances across distinct hardware racks to reduce correlated failures (max 7 per AZ), which placement strategy is used?

- A. Auto Scaling group
- B. Cluster placement group
- C. Spread placement group
- D. Partition placement group

**Answer:** C

**Explanation:** Spread across racks, max 7/AZ = Spread placement group.

---

## Q 01-v1-18
- domain: cost
- task: 4.2
- topic: compute
- services: Lightsail
- difficulty: easy
- time: 45
- source: practice-exams/01-compute-services-exam.md#Q18

A startup wants the simplest way to launch a WordPress site with predictable monthly pricing, bundled compute, storage, and networking. Which service is BEST?

- A. Amazon EC2
- B. Amazon Lightsail
- C. AWS Fargate
- D. AWS Elastic Beanstalk

**Answer:** B

**Explanation:** Simplest, bundled, fixed monthly price = Amazon Lightsail.

---

## Q 01-v1-19
- domain: resilient
- task: 2.2
- topic: compute
- services: EC2 Auto Scaling, ALB, EC2
- tags: high-availability
- difficulty: medium
- time: 85
- source: practice-exams/01-compute-services-exam.md#Q19

An EC2-based web tier must remain highly available across failures of a single Availability Zone. Which design achieves this? (Choose TWO)

- A. Place all instances in a single AZ cluster placement group
- B. Deploy an Auto Scaling group spanning multiple AZs
- C. Use an Application Load Balancer across multiple AZs
- D. Use a larger instance type
- E. Enable detailed monitoring

**Answer:** B, C

**Explanation:** HA across AZ failure = multi-AZ Auto Scaling group + multi-AZ ALB.

---

## Q 01-v1-20
- domain: performance
- task: 3.2
- topic: compute
- services: EC2 Auto Scaling
- tags: ami
- difficulty: easy
- time: 50
- source: practice-exams/01-compute-services-exam.md#Q20

A company wants to reduce Auto Scaling launch time so new instances become healthy faster during scale-out. Which action helps MOST?

- A. Disable ELB health checks
- B. Increase the cooldown period
- C. Use Simple scaling instead of Target tracking
- D. Bake dependencies into a custom AMI (golden AMI)

**Answer:** D

**Explanation:** Faster healthy instances = pre-baked golden AMI (less bootstrap time).
