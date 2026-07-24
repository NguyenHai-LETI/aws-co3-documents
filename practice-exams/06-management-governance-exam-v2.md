# 🛠️ Practice Exam 06 — Management & Governance (SAA-C03) · V2

**30 questions** · scenario-based · English. Answers in `06-management-governance-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q20
- **Part B — Khó / Nâng cao:** Q21–Q30

---

## Part A — Vận dụng (20 câu)

**1.** A team wants to provision entire environments (VPC, EC2, RDS) as code, repeatable across Regions. Which service?

- A. AWS Config
- B. AWS CloudFormation
- C. AWS Systems Manager
- D. AWS OpsWorks

**2.** Administrators must connect to EC2 instances in private subnets without opening SSH ports or using a bastion host. Which service?

- A. Systems Manager Session Manager
- B. EC2 Instance Connect over the internet
- C. Direct SSH via IGW
- D. RDP Gateway

**3.** A metric-based alarm must notify an ops team when EC2 CPU exceeds 80% for 5 minutes. Which combination?

- A. CloudWatch alarm + SNS
- B. CloudTrail + SQS
- C. Config rule + Lambda
- D. VPC Flow Logs + SNS

**4.** A company must patch hundreds of EC2 instances on a schedule with compliance reporting. Which service?

- A. Systems Manager Patch Manager
- B. AWS Config
- C. CloudFormation
- D. Trusted Advisor

**5.** A company needs to detect whether resources drift from their CloudFormation-defined configuration. Which feature?

- A. Change sets
- B. Drift detection
- C. Nested stacks
- D. StackSets

**6.** Which service continuously records API activity for security auditing across the account?

- A. CloudWatch Logs
- B. AWS CloudTrail
- C. AWS Config
- D. Trusted Advisor

**7.** A company must deploy the same CloudFormation stack across multiple accounts and Regions from one place. Which feature?

- A. Nested stacks
- B. StackSets
- C. Change sets
- D. Drift detection

**8.** An organization wants recommendations on cost, security, performance, and service limits. Which service?

- A. AWS Trusted Advisor
- B. AWS Config
- C. CloudTrail
- D. GuardDuty

**9.** A company must evaluate whether S3 buckets are ever public and auto-remediate. Which service?

- A. AWS Config with rules + remediation
- B. CloudTrail
- C. CloudWatch alarm
- D. Systems Manager Inventory

**10.** Application logs from EC2 must be centralized, searchable, and retained. Which service?

- A. CloudWatch Logs
- B. AWS Config
- C. CloudTrail
- D. S3 only

**11.** A company wants a self-service catalog of approved, pre-configured products for teams to deploy. Which service?

- A. AWS Service Catalog
- B. AWS Marketplace
- C. AWS Config
- D. Systems Manager

**12.** A CloudFormation template must accept environment-specific values (instance size, AMI) at deploy time. Which section?

- A. Resources
- B. Parameters
- C. Outputs
- D. Mappings

**13.** A resource must NOT be deleted when its CloudFormation stack is deleted (e.g., a production database). Which attribute?

- A. DependsOn
- B. DeletionPolicy: Retain
- C. Metadata
- D. Condition

**14.** A company must run a command (e.g., install an agent) across many instances without SSH. Which SSM capability?

- A. Run Command
- B. Parameter Store
- C. Patch Manager
- D. Inventory

**15.** A team wants to preview the changes CloudFormation will make before applying an update. Which feature?

- A. Drift detection
- B. Change sets
- C. StackSets
- D. Rollback triggers

**16.** A company must be alerted to scheduled maintenance and issues affecting its specific AWS resources. Which service?

- A. AWS Health Dashboard (Personal Health Dashboard)
- B. Trusted Advisor
- C. CloudTrail
- D. Config

**17.** Which service provides right-sizing recommendations for EC2, EBS, Lambda, and ASGs based on utilization?

- A. AWS Compute Optimizer
- B. AWS Config
- C. Trusted Advisor only
- D. CloudFormation

**18.** A company needs to store a database connection string as a hierarchical, versioned configuration value referenced by apps. Which service?

- A. Systems Manager Parameter Store
- B. CloudFormation Outputs
- C. AWS Config
- D. CloudTrail

**19.** A CloudFormation stack must create resource B only after resource A exists. Which attribute enforces order?

- A. DeletionPolicy
- B. DependsOn
- C. Mappings
- D. Outputs

**20.** A company must ensure CloudTrail logs cannot be tampered with and are retained centrally for all accounts. Which two? (Choose TWO)

- A. Organization trail delivering to a central S3 bucket
- B. Enable log file validation
- C. Disable CloudTrail in member accounts
- D. Store logs only on EC2
- E. Turn off encryption

---

## Part B — Khó / Nâng cao (10 câu)

**21.** A CloudFormation update fails midway. The team wants automatic return to the last known good state. Which behavior/feature applies?

- A. Automatic rollback on stack update failure
- B. Drift detection
- C. StackSets
- D. Manual deletion only

**22.** A company reuses common infrastructure (a standard VPC) across many stacks and wants to reference its outputs from other stacks. Which two approaches? (Choose TWO)

- A. Nested stacks
- B. Cross-stack references via Exports/ImportValue
- C. Copy-paste resources into each template
- D. Drift detection
- E. Change sets

**23.** Administrators must give temporary, audited, break-glass shell access to a private instance and log every command to CloudWatch/S3. Which combination?

- A. Session Manager with logging to S3/CloudWatch Logs
- B. Open SSH port 22 to the office IP
- C. Bastion host with shared key
- D. EC2 Instance Connect only

**24.** A company must automatically remediate non-compliant resources (e.g., unencrypted EBS) detected by AWS Config. Which integration?

- A. Config rule + SSM Automation remediation document
- B. CloudTrail + SNS
- C. Trusted Advisor + Lambda
- D. GuardDuty + WAF

**25.** A CloudFormation deployment across 500 accounts in an Organization must be automated when new accounts are added. Which feature?

- A. StackSets with automatic deployment to the OU
- B. Nested stacks
- C. Manual stack per account
- D. Change sets

**26.** A company needs to forward EC2 application logs to CloudWatch Logs and also stream them in near real-time to a data lake for analytics. Which two? (Choose TWO)

- A. CloudWatch Logs subscription filter to Kinesis Data Firehose
- B. CloudWatch agent on the instances
- C. CloudTrail data events
- D. Config aggregator
- E. Trusted Advisor export

**27.** A stateful resource in a stack must be preserved on delete AND a snapshot taken automatically when supported. Which DeletionPolicy value fits an RDS/EBS resource?

- A. DeletionPolicy: Retain only
- B. DeletionPolicy: Snapshot
- C. DeletionPolicy: Delete
- D. UpdateReplacePolicy: Delete

**28.** A company must enforce that member accounts cannot disable CloudTrail or leave the Organization. Which service enforces this guardrail?

- A. Service Control Policies (SCPs) via AWS Organizations
- B. IAM policies per user
- C. Security Groups
- D. Config rules only

**29.** A large template hits CloudFormation resource limits and is hard to maintain. What is the recommended structuring approach?

- A. One giant template
- B. Nested stacks (parent + child templates)
- C. Manual console creation
- D. StackSets for a single account

**30.** A metric that AWS does not publish natively (e.g., app memory usage) must trigger scaling and alarms. Which approach?

- A. Publish a CloudWatch custom metric (via CloudWatch agent/API)
- B. Use CloudTrail
- C. Use Config
- D. Use Trusted Advisor
