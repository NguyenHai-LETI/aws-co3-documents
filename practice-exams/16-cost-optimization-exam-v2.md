# 💰 Practice Exam 16 — Cost Optimization (SAA-C03) · V2

**30 questions** · scenario-based · English. Answers in `16-cost-optimization-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q20
- **Part B — Khó / Nâng cao:** Q21–Q30

---

## Part A — Vận dụng (20 câu)

**1.** A predictable production workload runs 24/7 for 3 years on a fixed instance type. MOST cost-effective purchase?

- A. On-Demand
- B. Standard Reserved Instances (3-year)
- C. Spot Instances
- D. Dedicated Hosts

**2.** A fault-tolerant batch job can be interrupted. Cheapest compute?

- A. On-Demand
- B. Reserved Instances
- C. Spot Instances
- D. Dedicated Hosts

**3.** A workload needs flexibility across instance families/Regions with steady usage. Best savings mechanism?

- A. Compute Savings Plans
- B. Standard RIs
- C. On-Demand
- D. Spot only

**4.** S3 data has unknown, changing access patterns. Cheapest without lifecycle management?

- A. S3 Standard
- B. S3 Intelligent-Tiering
- C. S3 Standard-IA
- D. Glacier

**5.** Logs are frequently accessed for 30 days, then rarely. Which lifecycle minimizes cost?

- A. Keep in S3 Standard forever
- B. Transition to Standard-IA after 30 days, then Glacier
- C. Delete after 1 day
- D. One Zone-IA immediately

**6.** An idle-then-bursty relational workload should minimize cost. Which option?

- A. Aurora Serverless v2
- B. Largest provisioned instance
- C. On-Demand DynamoDB
- D. Multi-AZ RDS max size

**7.** Which tool provides right-sizing recommendations based on actual utilization?

- A. AWS Compute Optimizer
- B. CloudTrail
- C. Config
- D. GuardDuty

**8.** Which tool visualizes and analyzes historical spend and forecasts future cost?

- A. AWS Cost Explorer
- B. CloudWatch
- C. Trusted Advisor
- D. Config

**9.** A team must be alerted when monthly spend exceeds a threshold. Which service?

- A. AWS Budgets
- B. Cost Explorer only
- C. CloudTrail
- D. Config

**10.** Which feature automatically detects unusual spend spikes using ML?

- A. AWS Cost Anomaly Detection
- B. Trusted Advisor
- C. CloudWatch alarm
- D. Config rule

**11.** NAT Gateway data processing costs are high for traffic to S3. Which reduces cost?

- A. Gateway VPC endpoint for S3 (avoids NAT)
- B. Larger NAT Gateway
- C. More NAT Gateways
- D. Interface endpoint for S3

**12.** A company wants volume discounts and one bill across many accounts. Which feature?

- A. Consolidated billing via AWS Organizations
- B. Separate bills
- C. Per-account RIs only
- D. Savings Plans per user

**13.** Cost must be allocated per team/project across resources. Which mechanism?

- A. Cost allocation tags
- B. IAM policies
- C. Security groups
- D. Config rules

**14.** A dev/test environment runs only during business hours. Cheapest approach?

- A. Schedule start/stop (e.g., Instance Scheduler) to run only when needed
- B. Run 24/7 On-Demand
- C. Buy 3-year RIs
- D. Dedicated Hosts

**15.** Over-provisioned EBS gp2 volumes cost too much. Which switch can reduce cost and let you tune IOPS/throughput independently?

- A. Migrate to gp3
- B. Migrate to io2
- C. Migrate to st1 for boot
- D. Use Instance Store

**16.** Rarely accessed EBS snapshots must cost less; slower restore is OK. Which feature?

- A. EBS Snapshot Archive
- B. Fast Snapshot Restore
- C. Multi-Attach
- D. gp3

**17.** A containerized, interruption-tolerant workload should minimize cost on ECS. Which option?

- A. Fargate Spot
- B. Fargate On-Demand
- C. EC2 On-Demand
- D. Dedicated Hosts

**18.** A steady-usage RDS/ElastiCache/Redshift deployment should reduce cost with commitment. Which option?

- A. Reserved Instances / Reserved Nodes
- B. On-Demand only
- C. Spot
- D. Savings Plans (not applicable to these)

**19.** Global content delivery reduces origin data transfer cost and latency. Which service?

- A. Amazon CloudFront
- B. Global Accelerator
- C. NAT Gateway
- D. Direct Connect

**20.** A Lambda function is over-allocated memory. Which tool helps find the cost/performance sweet spot?

- A. AWS Compute Optimizer / Lambda Power Tuning
- B. Config
- C. CloudTrail
- D. Trusted Advisor only

---

## Part B — Khó / Nâng cao (10 câu)

**21.** A company has a steady baseline plus variable spikes. Which cost-optimal mix? (Choose TWO)

- A. Savings Plans/Reserved Instances for the steady baseline
- B. Spot or On-Demand Auto Scaling for the variable spikes
- C. Reserved Instances for peak spikes
- D. Dedicated Hosts for everything
- E. On-Demand for the entire baseline

**22.** Cross-AZ data transfer between chatty microservices is costly. Which two reduce this cost? (Choose TWO)

- A. Co-locate communicating instances in the same AZ where availability allows
- B. Use placement/architecture that reduces cross-AZ chatter
- C. Send all traffic through a NAT Gateway
- D. Move to cross-Region
- E. Use public IPs between instances

**23.** A company wants maximum Spot savings for a stateless fleet while minimizing interruptions and capacity gaps. Which two strategies? (Choose TWO)

- A. Diversify across multiple instance types and AZs
- B. Use capacity-optimized allocation strategy
- C. Single instance type in one AZ
- D. Only lowestPrice with one pool
- E. Reserved Instances for Spot

**24.** A data pipeline writes to S3 and immediately transitions objects to Glacier, but small objects incur high per-object and minimum-duration charges. Which two considerations apply? (Choose TWO)

- A. IA/Glacier classes have minimum storage durations (30/90 days) and per-object overhead
- B. Very small/short-lived objects may be cheaper in S3 Standard
- C. Glacier is always cheapest regardless of object size/age
- D. Lifecycle transitions are free of minimums
- E. One Zone-IA has no minimum duration

**25.** An enterprise wants to enforce that only approved, cost-efficient instance types can be launched across accounts. Which service enforces this?

- A. Service Control Policies (SCPs) via Organizations
- B. Cost Explorer
- C. Budgets
- D. Trusted Advisor

**26.** A Redshift cluster is used heavily during the day and idle at night; the team wants to avoid managing capacity and pay for what they use. Which option?

- A. Amazon Redshift Serverless
- B. Largest RA3 always-on
- C. Reserved nodes only
- D. DC2 dense compute always-on

**27.** A company must reduce cost of infrequently accessed cross-Region replication while keeping DR. Which two apply? (Choose TWO)

- A. Replicate to a cheaper storage class in the destination (e.g., Standard-IA/Glacier)
- B. Use S3 Replication with a destination storage class
- C. Replicate everything to S3 Standard only
- D. Disable versioning to save cost
- E. Use Transfer Acceleration for replication

**28.** A NAT Gateway is used only to let private instances reach a few AWS services (S3, DynamoDB, ECR, SSM). Which two reduce NAT costs? (Choose TWO)

- A. Gateway endpoints for S3/DynamoDB
- B. Interface (PrivateLink) endpoints for services like ECR/SSM
- C. Add more NAT Gateways
- D. Use a public subnet for all instances
- E. Remove all endpoints

**29.** A workload's compute commitment must cover Lambda and Fargate too, not just EC2. Which purchasing option applies?

- A. Compute Savings Plans (cover EC2, Fargate, Lambda)
- B. EC2 Instance Savings Plans only
- C. Standard RIs
- D. Spot only

**30.** A finance team needs granular, hourly, resource-level cost and usage data for custom analysis in Athena. Which feature?

- A. AWS Cost and Usage Report (CUR) delivered to S3
- B. Cost Explorer UI only
- C. Budgets alerts
- D. Trusted Advisor export
