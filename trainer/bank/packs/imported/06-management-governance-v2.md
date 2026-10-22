---
pack: saa-06-management-governance-v2
title: 06 · Management & Governance · V2
exam: SAA-C03
origin: imported
source: practice-exams/06-management-governance-exam-v2.md
created: 2026-10-16
---

# 06 · Management & Governance · V2

> Imported from `practice-exams/06-management-governance-exam-v2.md` + `06-management-governance-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 06-v2-01
- domain: secure
- task: 1.2
- topic: management
- services: CloudFormation, VPC, EC2, RDS
- difficulty: medium
- time: 50
- enriched: 2026-10-22
- source: practice-exams/06-management-governance-exam-v2.md#Q1

A team wants to provision entire environments (VPC, EC2, RDS) as code, repeatable across Regions. Which service?

- A. AWS Config
- B. AWS OpsWorks
- C. AWS Systems Manager
- D. AWS CloudFormation

**Answer:** D

**Explanation:** CloudFormation models whole environments (VPC, EC2, RDS) as code in templates and deploys them repeatedly as stacks, or across Regions with StackSets.
- AWS Config: records and evaluates resource configuration; it does not provision.
- AWS OpsWorks: Chef/Puppet configuration management, discontinued in 2024 (full shutdown).
- AWS Systems Manager: operates existing resources; it does not define environments as templates.
> 🇻🇳 Dựng cả môi trường bằng code, lặp lại giữa các Region → AWS CloudFormation (OpsWorks đã ngừng hẳn).

---

## Q 06-v2-02
- domain: secure
- task: 1.2
- topic: management
- services: Systems Manager, EC2
- tags: subnets, bastion-host
- difficulty: medium
- time: 55
- source: practice-exams/06-management-governance-exam-v2.md#Q2

Administrators must connect to EC2 instances in private subnets without opening SSH ports or using a bastion host. Which service?

- A. Systems Manager Session Manager
- B. EC2 Instance Connect over the internet
- C. Direct SSH via IGW
- D. RDP Gateway

**Answer:** A

**Explanation:** Private EC2 access, no SSH/bastion = Systems Manager Session Manager.

---

## Q 06-v2-03
- domain: secure
- task: 1.2
- topic: management
- services: CloudWatch, SNS, EC2
- difficulty: medium
- time: 55
- source: practice-exams/06-management-governance-exam-v2.md#Q3

A metric-based alarm must notify an ops team when EC2 CPU exceeds 80% for 5 minutes. Which combination?

- A. VPC Flow Logs + SNS
- B. Config rule + Lambda
- C. CloudTrail + SQS
- D. CloudWatch alarm + SNS

**Answer:** D

**Explanation:** Metric threshold alert = CloudWatch alarm + SNS notification.

---

## Q 06-v2-04
- domain: secure
- task: 1.3
- topic: management
- services: Systems Manager, EC2
- tags: compliance
- difficulty: medium
- time: 50
- source: practice-exams/06-management-governance-exam-v2.md#Q4

A company must patch hundreds of EC2 instances on a schedule with compliance reporting. Which service?

- A. AWS Config
- B. Systems Manager Patch Manager
- C. CloudFormation
- D. Trusted Advisor

**Answer:** B

**Explanation:** Scheduled patching + compliance = Systems Manager Patch Manager.

---

## Q 06-v2-05
- domain: secure
- task: 1.2
- topic: management
- services: CloudFormation
- tags: cfn-drift
- difficulty: medium
- time: 50
- source: practice-exams/06-management-governance-exam-v2.md#Q5

A company needs to detect whether resources drift from their CloudFormation-defined configuration. Which feature?

- A. Drift detection
- B. Nested stacks
- C. Change sets
- D. StackSets

**Answer:** A

**Explanation:** Detect config divergence from template = Drift detection.

---

## Q 06-v2-06
- domain: secure
- task: 1.2
- topic: management
- services: CloudTrail
- tags: compliance
- difficulty: medium
- time: 50
- source: practice-exams/06-management-governance-exam-v2.md#Q6

Which service continuously records API activity for security auditing across the account?

- A. AWS Config
- B. AWS CloudTrail
- C. CloudWatch Logs
- D. Trusted Advisor

**Answer:** B

**Explanation:** Record API activity for audit = AWS CloudTrail.

---

## Q 06-v2-07
- domain: secure
- task: 1.2
- topic: management
- services: CloudFormation
- difficulty: medium
- time: 50
- source: practice-exams/06-management-governance-exam-v2.md#Q7

A company must deploy the same CloudFormation stack across multiple accounts and Regions from one place. Which feature?

- A. StackSets
- B. Nested stacks
- C. Drift detection
- D. Change sets

**Answer:** A

**Explanation:** Same stack across accounts/Regions = StackSets.

---

## Q 06-v2-08
- domain: secure
- task: 1.2
- topic: management
- services: Trusted Advisor
- difficulty: medium
- time: 50
- source: practice-exams/06-management-governance-exam-v2.md#Q8

An organization wants recommendations on cost, security, performance, and service limits. Which service?

- A. GuardDuty
- B. CloudTrail
- C. AWS Config
- D. AWS Trusted Advisor

**Answer:** D

**Explanation:** Cost/security/performance/limits recommendations = Trusted Advisor.

---

## Q 06-v2-09
- domain: secure
- task: 1.2
- topic: management
- services: AWS Config, S3
- difficulty: medium
- time: 50
- source: practice-exams/06-management-governance-exam-v2.md#Q9

A company must evaluate whether S3 buckets are ever public and auto-remediate. Which service?

- A. AWS Config with rules + remediation
- B. Systems Manager Inventory
- C. CloudWatch alarm
- D. CloudTrail

**Answer:** A

**Explanation:** Evaluate + auto-remediate resource config = AWS Config with rules + remediation.

---

## Q 06-v2-10
- domain: secure
- task: 1.3
- topic: management
- services: CloudWatch, EC2
- difficulty: medium
- time: 55
- enriched: 2026-10-22
- source: practice-exams/06-management-governance-exam-v2.md#Q10

Application logs from EC2 must be centralized, searchable, and retained. Which service?

- A. Amazon S3 for raw log storage
- B. CloudWatch Logs
- C. AWS Config resource inventory
- D. AWS CloudTrail management event logs

**Answer:** B

**Explanation:** Centralized searchable app logs = CloudWatch Logs.

---

## Q 06-v2-11
- domain: secure
- task: 1.2
- topic: management
- services: Service Catalog
- difficulty: medium
- time: 50
- source: practice-exams/06-management-governance-exam-v2.md#Q11

A company wants a self-service catalog of approved, pre-configured products for teams to deploy. Which service?

- A. Systems Manager
- B. AWS Config
- C. AWS Marketplace
- D. AWS Service Catalog

**Answer:** D

**Explanation:** Self-service catalog of approved products = AWS Service Catalog.

---

## Q 06-v2-12
- domain: secure
- task: 1.2
- topic: management
- services: CloudFormation
- tags: ami
- difficulty: medium
- time: 50
- source: practice-exams/06-management-governance-exam-v2.md#Q12

A CloudFormation template must accept environment-specific values (instance size, AMI) at deploy time. Which section?

- A. Parameters
- B. Outputs
- C. Resources
- D. Mappings

**Answer:** A

**Explanation:** Deploy-time input values = Parameters section.

---

## Q 06-v2-13
- domain: secure
- task: 1.3
- topic: management
- services: CloudFormation
- difficulty: medium
- time: 50
- source: practice-exams/06-management-governance-exam-v2.md#Q13

A resource must NOT be deleted when its CloudFormation stack is deleted (e.g., a production database). Which attribute?

- A. DependsOn
- B. Metadata
- C. DeletionPolicy: Retain
- D. Condition

**Answer:** C

**Explanation:** Keep resource on stack delete = DeletionPolicy: Retain.

---

## Q 06-v2-14
- domain: secure
- task: 1.2
- topic: management
- services: Systems Manager
- difficulty: medium
- time: 50
- source: practice-exams/06-management-governance-exam-v2.md#Q14

A company must run a command (e.g., install an agent) across many instances without SSH. Which SSM capability?

- A. Inventory
- B. Run Command
- C. Parameter Store
- D. Patch Manager

**Answer:** B

**Explanation:** Run commands across instances without SSH = SSM Run Command.

---

## Q 06-v2-15
- domain: secure
- task: 1.2
- topic: management
- services: CloudFormation
- difficulty: medium
- time: 50
- source: practice-exams/06-management-governance-exam-v2.md#Q15

A team wants to preview the changes CloudFormation will make before applying an update. Which feature?

- A. Drift detection
- B. Change sets
- C. StackSets
- D. Rollback triggers

**Answer:** B

**Explanation:** Preview changes before update = Change sets.

---

## Q 06-v2-16
- domain: secure
- task: 1.2
- topic: management
- services: Health Dashboard
- difficulty: medium
- time: 50
- source: practice-exams/06-management-governance-exam-v2.md#Q16

A company must be alerted to scheduled maintenance and issues affecting its specific AWS resources. Which service?

- A. Trusted Advisor
- B. CloudTrail
- C. Config
- D. AWS Health Dashboard (Personal Health Dashboard)

**Answer:** D

**Explanation:** Alerts for events affecting your resources = AWS Health Dashboard.

---

## Q 06-v2-17
- domain: secure
- task: 1.2
- topic: management
- services: Compute Optimizer, EC2, EBS, Lambda
- tags: right-sizing
- difficulty: medium
- time: 50
- source: practice-exams/06-management-governance-exam-v2.md#Q17

Which service provides right-sizing recommendations for EC2, EBS, Lambda, and ASGs based on utilization?

- A. CloudFormation
- B. AWS Config
- C. AWS Compute Optimizer
- D. Trusted Advisor only

**Answer:** C

**Explanation:** Right-sizing recommendations from utilization = AWS Compute Optimizer.

---

## Q 06-v2-18
- domain: secure
- task: 1.2
- topic: management
- services: Systems Manager
- difficulty: medium
- time: 55
- source: practice-exams/06-management-governance-exam-v2.md#Q18

A company needs to store a database connection string as a hierarchical, versioned configuration value referenced by apps. Which service?

- A. Systems Manager Parameter Store
- B. AWS Config
- C. CloudTrail
- D. CloudFormation Outputs

**Answer:** A

**Explanation:** Hierarchical versioned config values = SSM Parameter Store.

---

## Q 06-v2-19
- domain: secure
- task: 1.2
- topic: management
- services: CloudFormation
- difficulty: medium
- time: 50
- source: practice-exams/06-management-governance-exam-v2.md#Q19

A CloudFormation stack must create resource B only after resource A exists. Which attribute enforces order?

- A. Mappings
- B. DeletionPolicy
- C. DependsOn
- D. Outputs

**Answer:** C

**Explanation:** Enforce creation order = DependsOn.

---

## Q 06-v2-20
- domain: secure
- task: 1.3
- topic: management
- services: S3, CloudTrail
- difficulty: medium
- time: 80
- source: practice-exams/06-management-governance-exam-v2.md#Q20

A company must ensure CloudTrail logs cannot be tampered with and are retained centrally for all accounts. Which two? (Choose TWO)

- A. Enable log file validation
- B. Turn off encryption
- C. Store logs only on EC2
- D. Organization trail delivering to a central S3 bucket
- E. Disable CloudTrail in member accounts

**Answer:** A, D

**Explanation:** Tamper-evident central logging = Organization trail to central S3 + log file validation.

---

## Q 06-v2-21
- domain: secure
- task: 1.2
- topic: management
- services: CloudFormation
- difficulty: hard
- time: 80
- enriched: 2026-10-22
- source: practice-exams/06-management-governance-exam-v2.md#Q21

A CloudFormation update fails midway. The team wants automatic return to the last known good state. Which behavior/feature applies?

- A. StackSets to push the update to other accounts automatically
- B. Termination protection to block deletion of the stack
- C. Automatic rollback that restores the previous stack configuration
- D. Drift detection to review manual configuration changes

**Answer:** C

**Explanation:** When a stack update fails, CloudFormation rolls back by default: every changed resource returns to its previous stable configuration (UPDATE_ROLLBACK_COMPLETE), and rollback triggers can start the same rollback from CloudWatch alarms. https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stack-failure-options.html
- StackSets: deploy one template across accounts and Regions; they do not undo a failed update.
- Termination protection: prevents a stack from being deleted, not an update from failing.
- Drift detection: reports changes made outside CloudFormation; it restores nothing.
> 🇻🇳 Cập nhật stack lỗi giữa chừng → CloudFormation tự rollback về cấu hình ổn định trước đó (mặc định).

---

## Q 06-v2-22
- domain: secure
- task: 1.2
- topic: management
- services: VPC
- difficulty: hard
- time: 95
- source: practice-exams/06-management-governance-exam-v2.md#Q22

A company reuses common infrastructure (a standard VPC) across many stacks and wants to reference its outputs from other stacks. Which two approaches? (Choose TWO)

- A. Nested stacks
- B. Copy-paste resources into each template
- C. Change sets
- D. Drift detection
- E. Cross-stack references via Exports/ImportValue

**Answer:** A, E

**Explanation:** Reuse infra across stacks = nested stacks + cross-stack Exports/ImportValue.

---

## Q 06-v2-23
- domain: secure
- task: 1.2
- topic: management
- services: Systems Manager, S3, CloudWatch
- tags: compliance
- difficulty: hard
- time: 75
- source: practice-exams/06-management-governance-exam-v2.md#Q23

Administrators must give temporary, audited, break-glass shell access to a private instance and log every command to CloudWatch/S3. Which combination?

- A. Open SSH port 22 to the office IP
- B. Session Manager with logging to S3/CloudWatch Logs
- C. Bastion host with shared key
- D. EC2 Instance Connect only

**Answer:** B

**Explanation:** Audited break-glass private access = Session Manager with S3/CloudWatch logging.

---

## Q 06-v2-24
- domain: secure
- task: 1.3
- topic: management
- services: AWS Config, Systems Manager, EBS
- tags: compliance, db-encryption
- difficulty: hard
- time: 70
- source: practice-exams/06-management-governance-exam-v2.md#Q24

A company must automatically remediate non-compliant resources (e.g., unencrypted EBS) detected by AWS Config. Which integration?

- A. GuardDuty + WAF
- B. CloudTrail + SNS
- C. Trusted Advisor + Lambda
- D. Config rule + SSM Automation remediation document

**Answer:** D

**Explanation:** Auto-remediate Config findings = Config rule + SSM Automation document.

---

## Q 06-v2-25
- domain: secure
- task: 1.2
- topic: management
- services: CloudFormation
- difficulty: hard
- time: 70
- source: practice-exams/06-management-governance-exam-v2.md#Q25

A CloudFormation deployment across 500 accounts in an Organization must be automated when new accounts are added. Which feature?

- A. Manual stack per account
- B. Change sets
- C. StackSets with automatic deployment to the OU
- D. Nested stacks

**Answer:** C

**Explanation:** Auto-deploy to new Organization accounts = StackSets with automatic OU deployment.

---

## Q 06-v2-26
- domain: performance
- task: 3.5
- topic: management
- services: CloudWatch, Data Firehose, EC2
- tags: streaming-ingestion, data-lake
- difficulty: hard
- time: 100
- enriched: 2026-10-22
- source: practice-exams/06-management-governance-exam-v2.md#Q26

A company needs to forward EC2 application logs to CloudWatch Logs and also stream them in near real-time to a data lake for analytics. Which two? (Choose TWO)

- A. CloudWatch Logs subscription filter to Amazon Data Firehose
- B. CloudWatch Logs Insights ad-hoc queries
- C. Config aggregator for application logs
- D. CloudWatch agent on the instances
- E. CloudTrail data events (S3 object API calls)

**Answer:** A, D

**Explanation:** Logs to CloudWatch + data lake = CloudWatch agent + subscription filter to Amazon Data Firehose (formerly Kinesis Data Firehose).

---

## Q 06-v2-27
- domain: secure
- task: 1.2
- topic: management
- services: RDS, EBS
- tags: snapshots
- difficulty: hard
- time: 70
- source: practice-exams/06-management-governance-exam-v2.md#Q27

A stateful resource in a stack must be preserved on delete AND a snapshot taken automatically when supported. Which DeletionPolicy value fits an RDS/EBS resource?

- A. DeletionPolicy: Snapshot
- B. DeletionPolicy: Delete
- C. UpdateReplacePolicy: Delete
- D. DeletionPolicy: Retain only

**Answer:** A

**Explanation:** Preserve + snapshot stateful resource on delete = DeletionPolicy: Snapshot.

---

## Q 06-v2-28
- domain: secure
- task: 1.1
- topic: management
- services: Organizations, CloudTrail
- tags: scp
- difficulty: hard
- time: 75
- enriched: 2026-10-22
- source: practice-exams/06-management-governance-exam-v2.md#Q28

A company must enforce that member accounts cannot disable CloudTrail or leave the Organization. Which service enforces this guardrail?

- A. AWS Config conformance packs
- B. AWS Organizations tag policies
- C. Service Control Policies (SCPs) via AWS Organizations
- D. IAM identity policies in each member account

**Answer:** C

**Explanation:** Prevent disabling CloudTrail / leaving org = SCPs via Organizations.

---

## Q 06-v2-29
- domain: secure
- task: 1.2
- topic: management
- services: CloudFormation
- difficulty: hard
- time: 70
- source: practice-exams/06-management-governance-exam-v2.md#Q29

A large template hits CloudFormation resource limits and is hard to maintain. What is the recommended structuring approach?

- A. One giant template
- B. StackSets for a single account
- C. Nested stacks (parent + child templates)
- D. Manual console creation

**Answer:** C

**Explanation:** Break up large template = nested stacks.

---

## Q 06-v2-30
- domain: secure
- task: 1.2
- topic: management
- services: CloudWatch
- difficulty: hard
- time: 70
- source: practice-exams/06-management-governance-exam-v2.md#Q30

A metric that AWS does not publish natively (e.g., app memory usage) must trigger scaling and alarms. Which approach?

- A. Use Config
- B. Use Trusted Advisor
- C. Use CloudTrail
- D. Publish a CloudWatch custom metric (via CloudWatch agent/API)

**Answer:** D

**Explanation:** Non-native metric for alarms/scaling = CloudWatch custom metric.
