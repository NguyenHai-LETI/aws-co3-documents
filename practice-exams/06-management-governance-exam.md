# ⚙️ Practice Exam 06 — Management & Governance (SAA-C03)

20 questions · scenario-based · English. Answers in `06-management-governance-answers.txt`.

---

**1.** A team wants to provision identical infrastructure repeatably across Regions using version-controlled templates. Which service?

- A. AWS Systems Manager
- B. AWS CloudFormation
- C. AWS Config
- D. AWS OpsWorks

**2.** A company manages 50 AWS accounts and wants a single consolidated bill plus the ability to restrict services per account. Which service?

- A. AWS Organizations
- B. AWS Control Tower
- C. AWS Budgets
- D. AWS Cost Explorer

**3.** An administrator must run OS patching on 200 EC2 instances on a schedule, without SSH access. Which Systems Manager capability?

- A. Session Manager
- B. Patch Manager with Maintenance Windows
- C. Parameter Store
- D. Run Command only

**4.** A team needs secure shell access to EC2 instances in private subnets WITHOUT bastion hosts, open SSH ports, or SSH keys, with full audit logging. Which solution?

- A. SSH over the internet
- B. Systems Manager Session Manager
- C. Direct Connect
- D. EC2 Instance Connect over public IP

**5.** Which CloudFormation feature lets you PREVIEW the changes a stack update will make before applying them?

- A. Drift detection
- B. Change sets
- C. Nested stacks
- D. Stack policies

**6.** Which CloudFormation feature detects when resources were changed manually outside of CloudFormation?

- A. Change sets
- B. Drift detection
- C. StackSets
- D. Rollback triggers

**7.** A company wants to deploy the same CloudFormation stack across multiple accounts and Regions from a central place. Which feature?

- A. Nested stacks
- B. StackSets
- C. Change sets
- D. Cross-stack references

**8.** A central security team wants to enforce that no member account can disable CloudTrail. Which control achieves this organization-wide?

- A. IAM policy in each account
- B. Service Control Policy (SCP) via AWS Organizations
- C. AWS Config rule
- D. CloudFormation StackSet

**9.** A company wants an automated landing zone with multi-account best practices, guardrails, and an account factory. Which service?

- A. AWS Organizations only
- B. AWS Control Tower
- C. AWS Service Catalog
- D. AWS Systems Manager

**10.** Which service provides best-practice recommendations across cost, performance, security, fault tolerance, and service limits?

- A. AWS Trusted Advisor
- B. AWS Config
- C. Amazon Inspector
- D. AWS Health Dashboard

**11.** A company wants to store application configuration values and reference encrypted secrets cost-effectively for low-volume usage. Which service?

- A. AWS Secrets Manager
- B. Systems Manager Parameter Store
- C. Amazon S3
- D. AWS KMS only

**12.** Which service gives ML-based right-sizing recommendations for EC2, EBS, Lambda, and Auto Scaling groups?

- A. AWS Compute Optimizer
- B. AWS Trusted Advisor
- C. Amazon CloudWatch
- D. AWS Budgets

**13.** A team must visualize and forecast historical AWS spend and filter by tag/service. Which service?

- A. AWS Budgets
- B. AWS Cost Explorer
- C. AWS Cost and Usage Report only
- D. CloudWatch

**14.** A finance team wants an alert when monthly spend is forecast to exceed $10,000. Which service?

- A. AWS Cost Explorer
- B. AWS Budgets
- C. AWS Trusted Advisor
- D. CloudWatch Logs

**15.** Which service collects system-level metrics (memory, disk) and application logs from EC2 and on-premises servers?

- A. CloudWatch Agent
- B. AWS Config
- C. CloudTrail
- D. AWS X-Ray

**16.** A company wants self-service provisioning of approved, standardized products (CloudFormation templates) for its teams. Which service?

- A. AWS Service Catalog
- B. AWS Control Tower
- C. AWS Marketplace
- D. AWS Organizations

**17.** Which CloudWatch component triggers an action (e.g., SNS or Auto Scaling) when a metric crosses a threshold?

- A. Dashboard
- B. Alarm
- C. Log group
- D. Metric filter

**18.** An operations team needs to be notified about AWS events specifically affecting THEIR account's resources (e.g., scheduled EC2 maintenance). Which service?

- A. Service Health Dashboard (public)
- B. AWS Health Dashboard (Personal/account-level)
- C. AWS Config
- D. CloudTrail

**19.** Which two are valid uses of AWS Systems Manager? (Choose TWO)

- A. Centrally store parameters and secrets
- B. Provide port forwarding/shell access without bastions
- C. Provide DDoS scrubbing
- D. Issue public TLS certificates
- E. Detect PII in S3

**20.** A company needs to extract specific structured fields from CloudWatch Logs and query them with a purpose-built query language. Which feature?

- A. CloudWatch Logs Insights
- B. CloudWatch Dashboards
- C. CloudTrail Insights
- D. Athena federated query
