# 🖥️ Practice Exam 01 — Compute Services (SAA-C03) · V2

**30 questions** · scenario-based · English. Answers in `01-compute-services-answers-v2.txt`.

- **Part A — Vận dụng (Application):** Q1–Q20
- **Part B — Khó / Nâng cao (Advanced):** Q21–Q30

Format quy ước: `(Choose TWO)` = multiple-response. Đáp án `1_C`, multi-response `21_BD`.

---

## Part A — Vận dụng (20 câu)

**1.** A batch-processing workload runs nightly, can be interrupted and restarted safely, and must be as cheap as possible. Which EC2 purchasing option is BEST?

- A. On-Demand Instances
- B. Reserved Instances (3-year, All Upfront)
- C. Spot Instances
- D. Dedicated Hosts

**2.** A company runs a steady-state production application 24/7 and wants maximum savings but retain the flexibility to change instance family, size, OS, and Region over a 3-year commitment. Which option is BEST?

- A. Standard Reserved Instances
- B. EC2 Instance Savings Plans
- C. Compute Savings Plans
- D. Spot Fleet

**3.** An application must run on physical servers dedicated to a single customer to satisfy a per-socket software license that is tied to physical cores. Which option meets this?

- A. Dedicated Instances
- B. Dedicated Hosts
- C. Spot Instances
- D. Cluster Placement Group

**4.** A web tier must automatically add instances when average CPU utilization exceeds 60% and remove them when it drops. Which scaling policy is SIMPLEST to configure?

- A. Simple scaling
- B. Step scaling
- C. Target tracking scaling
- D. Scheduled scaling

**5.** Traffic to an application spikes predictably every weekday at 9 AM. The team wants capacity ready before the spike. Which approach is BEST?

- A. Target tracking scaling only
- B. Scheduled scaling
- C. Manual scaling each morning
- D. Larger instance with no Auto Scaling

**6.** A serverless function processes images uploaded to S3. Occasionally a function needs 8 minutes and 4 GB of memory. Which service fits with the LEAST operational overhead?

- A. AWS Lambda
- B. EC2 with a cron job
- C. AWS Batch on EC2
- D. ECS on EC2

**7.** A Lambda-based API experiences slow first responses (cold starts) during traffic bursts, and low latency is required. What should be enabled?

- A. Reserved concurrency
- B. Provisioned concurrency
- C. Lambda Layers
- D. A larger /tmp size

**8.** A company wants to run Docker containers without managing any EC2 instances or scaling the cluster. Which is BEST?

- A. ECS on EC2 launch type
- B. ECS on Fargate
- C. EKS with self-managed nodes
- D. EC2 with Docker installed

**9.** A team already uses Kubernetes on-premises and wants a managed control plane on AWS while keeping standard K8s tooling. Which service?

- A. Amazon ECS
- B. Amazon EKS
- C. AWS Batch
- D. Elastic Beanstalk

**10.** A developer wants to deploy a Python web app quickly without managing the underlying EC2, load balancer, or Auto Scaling directly. Which service?

- A. AWS Lambda
- B. Amazon EC2
- C. AWS Elastic Beanstalk
- D. Amazon Lightsail

**11.** An HPC application needs the lowest possible network latency between instances performing tightly-coupled computation. Which placement strategy is BEST?

- A. Spread placement group
- B. Partition placement group
- C. Cluster placement group
- D. Instances in different AZs

**12.** A critical set of 6 instances must be placed on distinct underlying hardware to minimize simultaneous failure. Which placement group is appropriate?

- A. Cluster
- B. Spread
- C. Partition
- D. None; use one large instance

**13.** An Elastic Beanstalk environment must deploy a new version with ZERO downtime and easy rollback by swapping environments. Which deployment policy?

- A. All at once
- B. Rolling
- C. Immutable
- D. Blue/Green

**14.** An application temporarily stores scratch data that can be regenerated and needs the highest possible IOPS at the lowest cost. Which storage should the instance use?

- A. gp3 EBS volume
- B. io2 EBS volume
- C. Instance Store
- D. EFS

**15.** A workload needs Lambda functions to reach an RDS database inside a private subnet. What must be configured?

- A. Attach the Lambda function to the VPC and its private subnets
- B. Make the RDS instance public
- C. Use Lambda Layers
- D. Increase Lambda memory

**16.** A fleet of stateless web servers should scale based on the number of requests per instance behind an ALB. Which metric-based policy fits best?

- A. Target tracking on ALBRequestCountPerTarget
- B. Scheduled scaling
- C. Step scaling on disk I/O
- D. Manual desired capacity

**17.** A company wants a simple, fixed monthly price to host a small WordPress site including compute, storage, and networking. Which service?

- A. Amazon EC2
- B. AWS Fargate
- C. Amazon Lightsail
- D. AWS Batch

**18.** Long-running (multi-hour) containerized jobs must be queued, scheduled, and run cost-effectively with Spot capacity. Which service is purpose-built?

- A. AWS Lambda
- B. AWS Batch
- C. Elastic Beanstalk
- D. Amazon Lightsail

**19.** An Auto Scaling group should replace instances that fail application-level health checks, not just EC2 status checks. What should be configured?

- A. EC2 health checks only
- B. ELB (target group) health checks
- C. A larger cooldown
- D. Scheduled scaling

**20.** A company wants to reduce Lambda cost and improve performance for a CPU-bound function. Increasing which setting also proportionally increases CPU allocation?

- A. Timeout
- B. Memory
- C. Reserved concurrency
- D. Ephemeral /tmp storage

---

## Part B — Khó / Nâng cao (10 câu)

**21.** A stateless containerized workload must run on ECS at the LOWEST cost while tolerating interruptions, but a minimum baseline of tasks must always stay available. Which approach is BEST?

- A. Run everything on Fargate On-Demand
- B. Use a capacity provider strategy mixing Fargate and Fargate Spot with a base of On-Demand tasks
- C. Run all tasks on EC2 On-Demand only
- D. Run all tasks on Fargate Spot only

**22.** An Auto Scaling group must ensure new instances are fully bootstrapped (config pulled, warmed) before receiving traffic, and must run cleanup logic before termination. Which two features address this? (Choose TWO)

- A. Lifecycle hooks
- B. Larger cooldown period
- C. Warm pools
- D. Spot Fleet
- E. Predictive scaling only

**23.** A machine-learning training job needs many instances communicating with very high throughput and low, consistent latency using OS-bypass networking. Which combination is BEST?

- A. Spread placement group + ENA
- B. Cluster placement group + Elastic Fabric Adapter (EFA)
- C. Partition placement group + EBS-optimized
- D. Multiple AZs + Global Accelerator

**24.** A company wants an ASG to scale proactively based on forecasted daily/weekly cyclical demand rather than reacting to current metrics. Which policy?

- A. Simple scaling
- B. Step scaling
- C. Predictive scaling
- D. Target tracking only

**25.** A Lambda function is invoked asynchronously from S3. Some events fail all retries and must be captured for later inspection without losing data. What should be configured?

- A. Provisioned concurrency
- B. A Lambda destination or dead-letter queue (DLQ) for failures
- C. Reserved concurrency
- D. A larger timeout

**26.** During instance launch, an application must run different bootstrap logic depending on which ASG the instance belongs to, without baking multiple AMIs. Which approach is BEST?

- A. Separate AMI per ASG
- B. EC2 user data with instance metadata / tags to branch logic
- C. Manual SSH configuration
- D. Dedicated Hosts

**27.** A fleet uses Spot Instances for cost but must minimize interruptions during capacity reclamation. Which allocation strategy for the Spot request is BEST?

- A. lowestPrice
- B. capacityOptimized
- C. diversified across the fewest pools
- D. Single instance type in one AZ

**28.** A regulated workload must keep a specific EC2 instance running on the SAME physical host over time for a socket-based BYOL license, and needs visibility into physical cores. Which two are required? (Choose TWO)

- A. Dedicated Hosts
- B. Host affinity set to "Host"
- C. Dedicated Instances
- D. Spot Instances
- E. Cluster placement group

**29.** A latency-sensitive gaming backend needs to keep a pool of pre-initialized EC2 instances that can enter service in seconds during sudden spikes, minimizing scale-out time and cost of idle full-price instances. Which feature?

- A. Provisioned concurrency
- B. ASG warm pools (stopped/hibernated pre-initialized instances)
- C. Scheduled scaling only
- D. Larger cooldown

**30.** A Lambda function must resume a long process quickly and preserve in-memory state across a stop, on an EC2-based alternative. For the EC2 fallback, which feature lets an instance save RAM to EBS and resume state on start?

- A. EC2 Hibernation
- B. Instance Store
- C. Placement group
- D. Enhanced networking
