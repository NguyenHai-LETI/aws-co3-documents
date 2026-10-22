---
pack: saa-06-management-governance-v1
title: 06 · Management & Governance · V1
exam: SAA-C03
origin: imported
source: practice-exams/06-management-governance-exam.md
created: 2026-10-16
---

# 06 · Management & Governance · V1

> Imported from `practice-exams/06-management-governance-exam.md` + `06-management-governance-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 06-v1-01
- domain: secure
- task: 1.2
- topic: management
- services: CloudFormation
- difficulty: easy
- time: 45
- enriched: 2026-10-22
- source: practice-exams/06-management-governance-exam.md#Q1

A team wants to provision identical infrastructure repeatably across Regions using version-controlled templates. Which service?

- A. AWS OpsWorks
- B. AWS Systems Manager
- C. AWS CloudFormation
- D. AWS Config

**Answer:** C

**Explanation:** CloudFormation provisions infrastructure from declarative templates that can be kept in version control and deployed repeatedly as stacks (or StackSets) in any Region.
- AWS OpsWorks: Chef/Puppet configuration management, discontinued in 2024 (full shutdown), and never a template-based provisioning service.
- AWS Systems Manager: operates and patches existing resources; it does not model whole environments as templates.
- AWS Config: records and evaluates resource configuration; it does not create resources.
> 🇻🇳 Hạ tầng dạng code, lặp lại được giữa các Region → CloudFormation (OpsWorks đã ngừng hẳn năm 2024).

---

## Q 06-v1-02
- domain: secure
- task: 1.1
- topic: management
- services: Organizations
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q2

A company manages 50 AWS accounts and wants a single consolidated bill plus the ability to restrict services per account. Which service?

- A. AWS Budgets
- B. AWS Cost Explorer
- C. AWS Organizations
- D. AWS Control Tower

**Answer:** C

**Explanation:** Consolidated billing + restrict services = AWS Organizations.

---

## Q 06-v1-03
- domain: secure
- task: 1.2
- topic: management
- services: Systems Manager, EC2
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q3

An administrator must run OS patching on 200 EC2 instances on a schedule, without SSH access. Which Systems Manager capability?

- A. Parameter Store
- B. Run Command only
- C. Session Manager
- D. Patch Manager with Maintenance Windows

**Answer:** D

**Explanation:** Scheduled OS patching at scale = Patch Manager + Maintenance Windows.

---

## Q 06-v1-04
- domain: secure
- task: 1.2
- topic: management
- services: Systems Manager, EC2
- tags: subnets, bastion-host, compliance
- difficulty: easy
- time: 50
- source: practice-exams/06-management-governance-exam.md#Q4

A team needs secure shell access to EC2 instances in private subnets WITHOUT bastion hosts, open SSH ports, or SSH keys, with full audit logging. Which solution?

- A. EC2 Instance Connect over public IP
- B. Direct Connect
- C. SSH over the internet
- D. Systems Manager Session Manager

**Answer:** D

**Explanation:** No-bastion, no-SSH, audited shell = Session Manager.

---

## Q 06-v1-05
- domain: secure
- task: 1.2
- topic: management
- services: CloudFormation
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q5

Which CloudFormation feature lets you PREVIEW the changes a stack update will make before applying them?

- A. Drift detection
- B. Nested stacks
- C. Stack policies
- D. Change sets

**Answer:** D

**Explanation:** Preview stack update changes = Change sets.

---

## Q 06-v1-06
- domain: secure
- task: 1.2
- topic: management
- services: CloudFormation
- tags: cfn-drift
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q6

Which CloudFormation feature detects when resources were changed manually outside of CloudFormation?

- A. Drift detection
- B. Change sets
- C. StackSets
- D. Rollback triggers

**Answer:** A

**Explanation:** Detect manual/out-of-band changes = Drift detection.

---

## Q 06-v1-07
- domain: secure
- task: 1.2
- topic: management
- services: CloudFormation
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q7

A company wants to deploy the same CloudFormation stack across multiple accounts and Regions from a central place. Which feature?

- A. Nested stacks
- B. Change sets
- C. StackSets
- D. Cross-stack references

**Answer:** C

**Explanation:** Deploy stack to many accounts/Regions = StackSets.

---

## Q 06-v1-08
- domain: secure
- task: 1.1
- topic: management
- services: Organizations, CloudTrail
- tags: scp
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q8

A central security team wants to enforce that no member account can disable CloudTrail. Which control achieves this organization-wide?

- A. IAM policy in each account
- B. Service Control Policy (SCP) via AWS Organizations
- C. CloudFormation StackSet
- D. AWS Config rule

**Answer:** B

**Explanation:** Org-wide guardrail (cannot disable CloudTrail) = SCP.

---

## Q 06-v1-09
- domain: secure
- task: 1.1
- topic: management
- services: Control Tower
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q9

A company wants an automated landing zone with multi-account best practices, guardrails, and an account factory. Which service?

- A. AWS Service Catalog
- B. AWS Control Tower
- C. AWS Systems Manager
- D. AWS Organizations only

**Answer:** B

**Explanation:** Landing zone + guardrails + account factory = Control Tower.

---

## Q 06-v1-10
- domain: secure
- task: 1.2
- topic: management
- services: Trusted Advisor
- tags: high-availability
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q10

Which service provides best-practice recommendations across cost, performance, security, fault tolerance, and service limits?

- A. AWS Trusted Advisor
- B. AWS Health Dashboard
- C. Amazon Inspector
- D. AWS Config

**Answer:** A

**Explanation:** Cross-pillar best-practice checks = Trusted Advisor.

---

## Q 06-v1-11
- domain: cost
- task: 4.1
- topic: management
- services: Systems Manager
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q11

A company wants to store application configuration values and reference encrypted secrets cost-effectively for low-volume usage. Which service?

- A. AWS KMS only
- B. Amazon S3
- C. AWS Secrets Manager
- D. Systems Manager Parameter Store

**Answer:** D

**Explanation:** Cheap config + encrypted refs, low volume = Parameter Store.

---

## Q 06-v1-12
- domain: secure
- task: 1.2
- topic: management
- services: Compute Optimizer, EC2, EBS, Lambda, EC2 Auto Scaling
- tags: right-sizing
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q12

Which service gives ML-based right-sizing recommendations for EC2, EBS, Lambda, and Auto Scaling groups?

- A. AWS Compute Optimizer
- B. AWS Budgets
- C. Amazon CloudWatch
- D. AWS Trusted Advisor

**Answer:** A

**Explanation:** ML right-sizing for EC2/EBS/Lambda/ASG = Compute Optimizer.

---

## Q 06-v1-13
- domain: cost
- task: 4.2
- topic: management
- services: Cost Explorer
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q13

A team must visualize and forecast historical AWS spend and filter by tag/service. Which service?

- A. AWS Budgets
- B. AWS Cost Explorer
- C. AWS Cost and Usage Report only
- D. CloudWatch

**Answer:** B

**Explanation:** Visualize/forecast spend by tag/service = Cost Explorer.

---

## Q 06-v1-14
- domain: secure
- task: 1.2
- topic: management
- services: AWS Budgets
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q14

A finance team wants an alert when monthly spend is forecast to exceed $10,000. Which service?

- A. AWS Cost Explorer
- B. CloudWatch Logs
- C. AWS Budgets
- D. AWS Trusted Advisor

**Answer:** C

**Explanation:** Alert on forecast spend threshold = AWS Budgets.

---

## Q 06-v1-15
- domain: secure
- task: 1.2
- topic: management
- services: CloudWatch, EC2
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q15

Which service collects system-level metrics (memory, disk) and application logs from EC2 and on-premises servers?

- A. CloudWatch Agent
- B. AWS X-Ray
- C. AWS Config
- D. CloudTrail

**Answer:** A

**Explanation:** Memory/disk + app logs from EC2/on-prem = CloudWatch Agent.

---

## Q 06-v1-16
- domain: secure
- task: 1.2
- topic: management
- services: Service Catalog, CloudFormation
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q16

A company wants self-service provisioning of approved, standardized products (CloudFormation templates) for its teams. Which service?

- A. AWS Marketplace
- B. AWS Control Tower
- C. AWS Organizations
- D. AWS Service Catalog

**Answer:** D

**Explanation:** Self-service approved products = Service Catalog.

---

## Q 06-v1-17
- domain: secure
- task: 1.2
- topic: management
- services: CloudWatch, SNS, EC2 Auto Scaling
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q17

Which CloudWatch component triggers an action (e.g., SNS or Auto Scaling) when a metric crosses a threshold?

- A. Alarm
- B. Dashboard
- C. Log group
- D. Metric filter

**Answer:** A

**Explanation:** Metric threshold action = CloudWatch Alarm.

---

## Q 06-v1-18
- domain: secure
- task: 1.2
- topic: management
- services: Health Dashboard, EC2
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q18

An operations team needs to be notified about AWS events specifically affecting THEIR account's resources (e.g., scheduled EC2 maintenance). Which service?

- A. AWS Config
- B. CloudTrail
- C. AWS Health Dashboard (Personal/account-level)
- D. Service Health Dashboard (public)

**Answer:** C

**Explanation:** Account-specific events/maintenance = AWS Health (Personal) Dashboard.

---

## Q 06-v1-19
- domain: secure
- task: 1.2
- topic: management
- services: Systems Manager
- tags: bastion-host
- difficulty: medium
- time: 75
- source: practice-exams/06-management-governance-exam.md#Q19

Which two are valid uses of AWS Systems Manager? (Choose TWO)

- A. Centrally store parameters and secrets
- B. Provide port forwarding/shell access without bastions
- C. Issue public TLS certificates
- D. Provide DDoS scrubbing
- E. Detect PII in S3

**Answer:** A, B

**Explanation:** SSM = parameters/secrets + port forwarding/shell access.

---

## Q 06-v1-20
- domain: secure
- task: 1.2
- topic: management
- services: CloudWatch
- tags: centralized-logging
- difficulty: easy
- time: 45
- source: practice-exams/06-management-governance-exam.md#Q20

A company needs to extract specific structured fields from CloudWatch Logs and query them with a purpose-built query language. Which feature?

- A. Athena federated query
- B. CloudWatch Logs Insights
- C. CloudWatch Dashboards
- D. CloudTrail Insights

**Answer:** B

**Explanation:** Query logs with purpose-built language = CloudWatch Logs Insights.
