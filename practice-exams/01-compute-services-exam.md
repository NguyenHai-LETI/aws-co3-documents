# 🖥️ Practice Exam 01 — Compute Services (SAA-C03)

20 questions · scenario-based · English. Answers in `01-compute-services-answers.txt`.

---

**1.** A company runs a production web application on Amazon EC2 24/7. The workload is steady and predictable for the next 3 years. Which purchasing option is the MOST cost-effective?

- A. On-Demand Instances
- B. Spot Instances
- C. Standard Reserved Instances (3-year, All Upfront)
- D. Dedicated Hosts

**2.** A data-processing job runs nightly, can be interrupted and restarted, and must minimize cost. Which EC2 purchasing option should the architect choose?

- A. On-Demand Instances
- B. Spot Instances
- C. Reserved Instances
- D. Dedicated Instances

**3.** A solutions architect needs to run a containerized microservice with NO infrastructure to manage and pay only for the resources each task uses. Which option meets the requirement with the LEAST operational overhead?

- A. Amazon ECS on EC2 launch type
- B. Amazon ECS on AWS Fargate
- C. Amazon EKS with self-managed nodes
- D. EC2 Auto Scaling group running Docker

**4.** An application processes images uploaded to Amazon S3. Processing takes about 20 seconds per image and traffic is unpredictable. Which compute service requires the LEAST operational overhead?

- A. AWS Lambda triggered by S3 events
- B. Amazon EC2 with Auto Scaling
- C. AWS Batch on EC2
- D. Amazon ECS on EC2

**5.** A company wants to run a high-performance computing (HPC) workload that requires the lowest possible network latency between instances. Which configuration should be used?

- A. Spread placement group across multiple AZs
- B. Partition placement group
- C. Cluster placement group with Elastic Fabric Adapter (EFA)
- D. Instances in different Regions behind Global Accelerator

**6.** A Lambda function must run for 25 minutes to complete a large data transformation. What should the architect do?

- A. Increase the Lambda memory to 10 GB
- B. Increase the Lambda timeout to 25 minutes
- C. Use AWS Fargate or AWS Batch instead of Lambda
- D. Split into 2 Lambda functions chained by SNS

**7.** A fleet of EC2 instances in an Auto Scaling group must scale to keep average CPU utilization at 60%. Which scaling policy is simplest to configure for this goal?

- A. Simple scaling
- B. Step scaling
- C. Target tracking scaling
- D. Scheduled scaling

**8.** An Elastic Beanstalk application must be deployed with ZERO downtime and the ability to quickly roll back if the new version fails. Which deployment policy is BEST?

- A. All at once
- B. Rolling
- C. Rolling with additional batch
- D. Immutable

**9.** A workload needs temporary scratch storage with very high IOPS that does not need to persist after the instance stops. Which storage should be used?

- A. Amazon EBS gp3
- B. EC2 Instance Store
- C. Amazon EFS
- D. Amazon S3

**10.** A company predicts traffic spikes every weekday at 8 AM. They want capacity ready before the spike. Which Auto Scaling approach is MOST appropriate?

- A. Target tracking scaling only
- B. Scheduled scaling (or predictive scaling)
- C. Manual scaling each morning
- D. Spot Fleet with diversified strategy

**11.** Which statement about Amazon EKS vs Amazon ECS is correct?

- A. ECS requires you to manage a Kubernetes control plane
- B. EKS is AWS-proprietary and not portable
- C. EKS runs standard Kubernetes and supports multi-cloud portability
- D. ECS cannot run on Fargate

**12.** A company has strict licensing requirements that need visibility and control over the physical server (sockets/cores) where instances run. Which option meets this?

- A. Dedicated Instances
- B. Dedicated Hosts
- C. Spot Instances
- D. Reserved Instances

**13.** A team wants flexible Savings on compute that applies across instance families, Regions, and even Fargate/Lambda. Which option should they choose?

- A. Standard Reserved Instances
- B. EC2 Instance Savings Plans
- C. Compute Savings Plans
- D. Spot Instances

**14.** An application must mix Spot and On-Demand instances and use multiple instance types in one Auto Scaling group. What enables this?

- A. Launch configuration
- B. Launch template with mixed instances policy
- C. Placement group
- D. Capacity Reservation

**15.** Which Lambda feature eliminates cold-start latency for a latency-sensitive API?

- A. Reserved concurrency
- B. Provisioned concurrency
- C. Lambda layers
- D. Increasing the memory allocation

**16.** A batch workload runs Docker containers, takes several hours, and should automatically provision and scale the right compute. Which service is purpose-built for this?

- A. AWS Lambda
- B. AWS Batch
- C. Amazon Lightsail
- D. AWS Elastic Beanstalk

**17.** To distribute EC2 instances across distinct hardware racks to reduce correlated failures (max 7 per AZ), which placement strategy is used?

- A. Cluster placement group
- B. Spread placement group
- C. Partition placement group
- D. Auto Scaling group

**18.** A startup wants the simplest way to launch a WordPress site with predictable monthly pricing, bundled compute, storage, and networking. Which service is BEST?

- A. Amazon EC2
- B. AWS Elastic Beanstalk
- C. Amazon Lightsail
- D. AWS Fargate

**19.** An EC2-based web tier must remain highly available across failures of a single Availability Zone. Which design achieves this? (Choose TWO)

- A. Place all instances in a single AZ cluster placement group
- B. Deploy an Auto Scaling group spanning multiple AZs
- C. Use an Application Load Balancer across multiple AZs
- D. Use a larger instance type
- E. Enable detailed monitoring

**20.** A company wants to reduce Auto Scaling launch time so new instances become healthy faster during scale-out. Which action helps MOST?

- A. Increase the cooldown period
- B. Bake dependencies into a custom AMI (golden AMI)
- C. Use Simple scaling instead of Target tracking
- D. Disable ELB health checks
