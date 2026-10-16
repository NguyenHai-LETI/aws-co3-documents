---
pack: saa-05-security-services-v1
title: 05 · Security, Identity & Compliance · V1
exam: SAA-C03
origin: imported
source: practice-exams/05-security-services-exam.md
created: 2026-10-16
---

# 05 · Security, Identity & Compliance · V1

> Imported from `practice-exams/05-security-services-exam.md` + `05-security-services-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 05-v1-01
- domain: secure
- topic: security
- services: IAM, EC2, S3
- tags: iam-roles
- difficulty: easy
- time: 50
- source: practice-exams/05-security-services-exam.md#Q1

An EC2 instance must read objects from an S3 bucket. What is the MOST secure way to grant access?

- A. Store IAM access keys in the application config
- B. Attach an IAM role to the EC2 instance
- C. Make the bucket public
- D. Use the root account credentials

**Answer:** B

**Explanation:** EC2 -> S3 securely = IAM role on the instance (never store keys).

---

## Q 05-v1-02
- domain: secure
- topic: security
- services: Secrets Manager, RDS
- tags: key-rotation
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q2

A company needs to automatically rotate RDS database credentials every 30 days. Which service is purpose-built for this?

- A. Systems Manager Parameter Store (Standard)
- B. AWS Secrets Manager
- C. AWS KMS
- D. AWS Config

**Answer:** B

**Explanation:** Auto-rotate DB credentials = AWS Secrets Manager.

---

## Q 05-v1-03
- domain: secure
- topic: security
- services: GuardDuty, CloudTrail, VPC, VPC Flow Logs
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q3

Which service provides intelligent threat detection by analyzing CloudTrail, VPC Flow Logs, and DNS logs with machine learning?

- A. Amazon Inspector
- B. Amazon GuardDuty
- C. Amazon Macie
- D. AWS Config

**Answer:** B

**Explanation:** ML threat detection from CloudTrail/Flow/DNS logs = GuardDuty.

---

## Q 05-v1-04
- domain: secure
- topic: security
- services: Macie, S3
- tags: compliance
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q4

A team must discover and classify PII (personally identifiable information) stored in Amazon S3 for compliance. Which service?

- A. Amazon Macie
- B. Amazon GuardDuty
- C. AWS WAF
- D. Amazon Inspector

**Answer:** A

**Explanation:** Discover/classify PII in S3 = Amazon Macie.

---

## Q 05-v1-05
- domain: secure
- topic: security
- services: AWS Config, EBS
- tags: compliance
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q5

A compliance rule requires that all EBS volumes are encrypted, with automatic detection of non-compliant resources. Which service?

- A. AWS CloudTrail
- B. AWS Config with managed rules
- C. Amazon GuardDuty
- D. AWS Trusted Advisor

**Answer:** B

**Explanation:** Detect non-compliant resources (EBS encrypted) = AWS Config rules.

---

## Q 05-v1-06
- domain: secure
- topic: security
- services: CloudTrail, EC2
- tags: compliance
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q6

You must identify WHO terminated a specific EC2 instance and WHEN. Which service provides this audit trail?

- A. Amazon CloudWatch
- B. AWS CloudTrail
- C. AWS Config
- D. VPC Flow Logs

**Answer:** B

**Explanation:** Who/when of API actions = CloudTrail.

---

## Q 05-v1-07
- domain: secure
- topic: security
- services: KMS
- tags: key-rotation, iam-policies, compliance
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q7

A company wants centrally managed encryption keys with full control over rotation and key policies, plus an audit trail of key usage. Which service?

- A. AWS KMS Customer Managed Key
- B. AWS Secrets Manager
- C. AWS Certificate Manager
- D. SSE-S3

**Answer:** A

**Explanation:** Full control of keys + usage audit = KMS Customer Managed Key.

---

## Q 05-v1-08
- domain: secure
- topic: security
- tags: permission-boundaries, scp
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q8

Which approach enforces a maximum permission boundary across ALL accounts in an AWS Organization (even if account admins grant more)?

- A. IAM policies in each account
- B. Service Control Policies (SCPs)
- C. Resource-based policies
- D. Permissions boundary on a single role

**Answer:** B

**Explanation:** Max permission guardrail across accounts = SCPs.

---

## Q 05-v1-09
- domain: secure
- topic: security
- services: Cognito
- difficulty: easy
- time: 50
- source: practice-exams/05-security-services-exam.md#Q9

A mobile app must authenticate users (sign-up/sign-in) and then grant them temporary access to AWS resources. Which combination?

- A. Cognito User Pool for auth + Identity Pool for AWS credentials
- B. IAM users for each mobile user
- C. KMS + Secrets Manager
- D. Directory Service only

**Answer:** A

**Explanation:** Auth + temporary AWS creds = Cognito User Pool + Identity Pool.

---

## Q 05-v1-10
- domain: secure
- topic: security
- services: Shield, CloudFront, ALB
- tags: ddos-protection
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q10

A web application behind CloudFront and an ALB needs protection from large-scale Layer 3/4 DDoS attacks with 24/7 support and cost protection. Which service?

- A. AWS Shield Standard
- B. AWS Shield Advanced
- C. AWS WAF only
- D. Security Groups

**Answer:** B

**Explanation:** Advanced DDoS, 24/7 DRT, cost protection = Shield Advanced.

---

## Q 05-v1-11
- domain: secure
- topic: security
- services: ACM, ALB, CloudFront
- tags: tls-termination
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q11

Which service issues FREE public SSL/TLS certificates that auto-renew and integrate with ALB and CloudFront?

- A. AWS KMS
- B. AWS Certificate Manager (ACM)
- C. AWS Secrets Manager
- D. IAM

**Answer:** B

**Explanation:** Free auto-renewing public certs = ACM.

---

## Q 05-v1-12
- domain: secure
- topic: security
- services: IAM, STS
- tags: compliance, iam-roles, cross-account-access, least-privilege
- difficulty: easy
- time: 50
- source: practice-exams/05-security-services-exam.md#Q12

A company must give an external auditor read-only access to its account without creating long-term credentials. Which approach is BEST?

- A. Create an IAM user with access keys
- B. Use an IAM role with cross-account AssumeRole and least privilege
- C. Share the root password
- D. Add the auditor to an admin group

**Answer:** B

**Explanation:** External auditor, no long-term keys = cross-account IAM role (AssumeRole).

---

## Q 05-v1-13
- domain: secure
- topic: security
- services: Security Hub, GuardDuty, Inspector, Macie
- tags: compliance
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q13

Which service centralizes and aggregates security findings from GuardDuty, Inspector, and Macie, and runs compliance standard checks?

- A. AWS Security Hub
- B. AWS Config
- C. AWS Organizations
- D. Amazon Detective

**Answer:** A

**Explanation:** Aggregate findings + compliance checks = Security Hub.

---

## Q 05-v1-14
- domain: secure
- topic: security
- services: KMS
- tags: envelope-encryption
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q14

To encrypt data larger than 4 KB efficiently while minimizing KMS API calls, which technique is used?

- A. Directly encrypting with the CMK
- B. Envelope encryption with a data key
- C. SSE-C
- D. Client-side hashing

**Answer:** B

**Explanation:** Encrypt large data, fewer KMS calls = envelope encryption (data key).

---

## Q 05-v1-15
- domain: secure
- topic: security
- services: Inspector, EC2, ECR, Lambda
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q15

Which service performs automated vulnerability (CVE) scanning of EC2 instances, container images in ECR, and Lambda functions?

- A. Amazon Inspector
- B. Amazon Macie
- C. AWS WAF
- D. AWS Shield

**Answer:** A

**Explanation:** CVE scanning of EC2/ECR/Lambda = Amazon Inspector.

---

## Q 05-v1-16
- domain: secure
- topic: security
- services: Firewall Manager, WAF, Shield
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q16

A company wants to centrally manage WAF rules and Shield Advanced protections across many accounts in its Organization. Which service?

- A. AWS Firewall Manager
- B. AWS Config
- C. AWS WAF only
- D. Security Hub

**Answer:** A

**Explanation:** Central WAF/Shield across accounts = AWS Firewall Manager.

---

## Q 05-v1-17
- domain: secure
- topic: security
- services: IAM
- tags: mfa
- difficulty: easy
- time: 50
- source: practice-exams/05-security-services-exam.md#Q17

Which IAM best practice should be applied to the AWS account root user?

- A. Use it for daily administrative tasks
- B. Enable MFA and avoid using it for everyday work
- C. Create access keys for automation
- D. Share it across the admin team

**Answer:** B

**Explanation:** Root user = enable MFA, don't use daily.

---

## Q 05-v1-18
- domain: secure
- topic: security
- services: PrivateLink, EC2, KMS
- tags: subnets
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q18

An application on EC2 in a private subnet needs to call AWS APIs (e.g., KMS) without traversing the internet. Which solution is BEST?

- A. NAT Gateway only
- B. Interface VPC Endpoint (PrivateLink)
- C. Internet Gateway
- D. Public IP on the instance

**Answer:** B

**Explanation:** Private API access from private subnet = Interface VPC Endpoint.

---

## Q 05-v1-19
- domain: secure
- topic: security
- services: WAF
- tags: web-attacks
- difficulty: medium
- time: 80
- source: practice-exams/05-security-services-exam.md#Q19

Which two are TRUE about AWS WAF? (Choose TWO)

- A. It protects against SQL injection and cross-site scripting
- B. It can apply rate-based rules to limit requests from an IP
- C. It is a network-layer DDoS scrubbing appliance
- D. It only works with EC2 instances
- E. It replaces IAM for authentication

**Answer:** A, B

**Explanation:** WAF blocks SQLi/XSS and supports rate-based rules.

---

## Q 05-v1-20
- domain: secure
- topic: security
- services: Directory Service, EC2
- difficulty: easy
- time: 50
- source: practice-exams/05-security-services-exam.md#Q20

A company needs to integrate its existing on-premises Microsoft Active Directory so Windows EC2 instances can join the domain, while keeping a trust to on-premises AD. Which option?

- A. Simple AD
- B. AWS Managed Microsoft AD (with trust)
- C. Amazon Cognito
- D. IAM Identity Center only

**Answer:** B

**Explanation:** Domain join + trust to on-prem AD = AWS Managed Microsoft AD.
