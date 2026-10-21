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
- task: 1.1
- topic: security
- services: IAM, EC2, S3
- tags: iam-roles
- difficulty: easy
- time: 50
- source: practice-exams/05-security-services-exam.md#Q1

An EC2 instance must read objects from an S3 bucket. What is the MOST secure way to grant access?

- A. Attach an IAM role to the EC2 instance
- B. Make the bucket public
- C. Use the root account credentials
- D. Store IAM access keys in the application config

**Answer:** A

**Explanation:** EC2 -> S3 securely = IAM role on the instance (never store keys).

---

## Q 05-v1-02
- domain: secure
- task: 1.2
- topic: security
- services: Secrets Manager, RDS
- tags: key-rotation
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q2

A company needs to automatically rotate RDS database credentials every 30 days. Which service is purpose-built for this?

- A. AWS Config
- B. AWS Secrets Manager
- C. AWS KMS
- D. Systems Manager Parameter Store (Standard)

**Answer:** B

**Explanation:** Auto-rotate DB credentials = AWS Secrets Manager.

---

## Q 05-v1-03
- domain: secure
- task: 1.2
- topic: security
- services: GuardDuty, CloudTrail, VPC, VPC Flow Logs
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q3

Which service provides intelligent threat detection by analyzing CloudTrail, VPC Flow Logs, and DNS logs with machine learning?

- A. Amazon Inspector
- B. Amazon Macie
- C. AWS Config
- D. Amazon GuardDuty

**Answer:** D

**Explanation:** ML threat detection from CloudTrail/Flow/DNS logs = GuardDuty.

---

## Q 05-v1-04
- domain: secure
- task: 1.3
- topic: security
- services: Macie, S3
- tags: compliance
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q4

A team must discover and classify PII (personally identifiable information) stored in Amazon S3 for compliance. Which service?

- A. AWS WAF
- B. Amazon GuardDuty
- C. Amazon Inspector
- D. Amazon Macie

**Answer:** D

**Explanation:** Discover/classify PII in S3 = Amazon Macie.

---

## Q 05-v1-05
- domain: secure
- task: 1.3
- topic: security
- services: AWS Config, EBS
- tags: compliance
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q5

A compliance rule requires that all EBS volumes are encrypted, with automatic detection of non-compliant resources. Which service?

- A. AWS Config with managed rules
- B. Amazon GuardDuty
- C. AWS Trusted Advisor
- D. AWS CloudTrail

**Answer:** A

**Explanation:** Detect non-compliant resources (EBS encrypted) = AWS Config rules.

---

## Q 05-v1-06
- domain: secure
- task: 1.2
- topic: security
- services: CloudTrail, EC2
- tags: compliance
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q6

You must identify WHO terminated a specific EC2 instance and WHEN. Which service provides this audit trail?

- A. VPC Flow Logs
- B. Amazon CloudWatch
- C. AWS CloudTrail
- D. AWS Config

**Answer:** C

**Explanation:** Who/when of API actions = CloudTrail.

---

## Q 05-v1-07
- domain: secure
- task: 1.3
- topic: security
- services: KMS
- tags: key-rotation, iam-policies, compliance
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q7

A company wants centrally managed encryption keys with full control over rotation and key policies, plus an audit trail of key usage. Which service?

- A. AWS Secrets Manager
- B. AWS Certificate Manager
- C. AWS KMS Customer Managed Key
- D. SSE-S3

**Answer:** C

**Explanation:** Full control of keys + usage audit = KMS Customer Managed Key.

---

## Q 05-v1-08
- domain: secure
- task: 1.1
- topic: security
- tags: permission-boundaries, scp
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q8

Which approach enforces a maximum permission boundary across ALL accounts in an AWS Organization (even if account admins grant more)?

- A. Service Control Policies (SCPs)
- B. Permissions boundary on a single role
- C. IAM policies in each account
- D. Resource-based policies

**Answer:** A

**Explanation:** Max permission guardrail across accounts = SCPs.

---

## Q 05-v1-09
- domain: secure
- task: 1.2
- topic: security
- services: Cognito
- difficulty: easy
- time: 50
- source: practice-exams/05-security-services-exam.md#Q9

A mobile app must authenticate users (sign-up/sign-in) and then grant them temporary access to AWS resources. Which combination?

- A. KMS + Secrets Manager
- B. Cognito User Pool for auth + Identity Pool for AWS credentials
- C. Directory Service only
- D. IAM users for each mobile user

**Answer:** B

**Explanation:** Auth + temporary AWS creds = Cognito User Pool + Identity Pool.

---

## Q 05-v1-10
- domain: secure
- task: 1.2
- topic: security
- services: Shield, CloudFront, ALB
- tags: ddos-protection
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q10

A web application behind CloudFront and an ALB needs protection from large-scale Layer 3/4 DDoS attacks with 24/7 support and cost protection. Which service?

- A. AWS WAF only
- B. AWS Shield Advanced
- C. Security Groups
- D. AWS Shield Standard

**Answer:** B

**Explanation:** Advanced DDoS, 24/7 DRT, cost protection = Shield Advanced.

---

## Q 05-v1-11
- domain: secure
- task: 1.3
- topic: security
- services: ACM, ALB, CloudFront
- tags: tls-termination
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q11

Which service issues FREE public SSL/TLS certificates that auto-renew and integrate with ALB and CloudFront?

- A. AWS Certificate Manager (ACM)
- B. AWS KMS
- C. AWS Secrets Manager
- D. IAM

**Answer:** A

**Explanation:** Free auto-renewing public certs = ACM.

---

## Q 05-v1-12
- domain: secure
- task: 1.1
- topic: security
- services: IAM, STS
- tags: compliance, iam-roles, cross-account-access, least-privilege
- difficulty: easy
- time: 50
- source: practice-exams/05-security-services-exam.md#Q12

A company must give an external auditor read-only access to its account without creating long-term credentials. Which approach is BEST?

- A. Share the root password
- B. Use an IAM role with cross-account AssumeRole and least privilege
- C. Add the auditor to an admin group
- D. Create an IAM user with access keys

**Answer:** B

**Explanation:** External auditor, no long-term keys = cross-account IAM role (AssumeRole).

---

## Q 05-v1-13
- domain: secure
- task: 1.2
- topic: security
- services: Security Hub, GuardDuty, Inspector, Macie
- tags: compliance
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q13

Which service centralizes and aggregates security findings from GuardDuty, Inspector, and Macie, and runs compliance standard checks?

- A. AWS Organizations
- B. AWS Config
- C. AWS Security Hub
- D. Amazon Detective

**Answer:** C

**Explanation:** Aggregate findings + compliance checks = Security Hub.

---

## Q 05-v1-14
- domain: secure
- task: 1.3
- topic: security
- services: KMS
- tags: envelope-encryption
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q14

To encrypt data larger than 4 KB efficiently while minimizing KMS API calls, which technique is used?

- A. Client-side hashing
- B. Directly encrypting with the CMK
- C. Envelope encryption with a data key
- D. SSE-C

**Answer:** C

**Explanation:** Encrypt large data, fewer KMS calls = envelope encryption (data key).

---

## Q 05-v1-15
- domain: secure
- task: 1.2
- topic: security
- services: Inspector, EC2, ECR, Lambda
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q15

Which service performs automated vulnerability (CVE) scanning of EC2 instances, container images in ECR, and Lambda functions?

- A. AWS WAF
- B. AWS Shield
- C. Amazon Inspector
- D. Amazon Macie

**Answer:** C

**Explanation:** CVE scanning of EC2/ECR/Lambda = Amazon Inspector.

---

## Q 05-v1-16
- domain: secure
- task: 1.2
- topic: security
- services: Firewall Manager, WAF, Shield
- difficulty: easy
- time: 45
- source: practice-exams/05-security-services-exam.md#Q16

A company wants to centrally manage WAF rules and Shield Advanced protections across many accounts in its Organization. Which service?

- A. AWS Firewall Manager
- B. Security Hub
- C. AWS Config
- D. AWS WAF only

**Answer:** A

**Explanation:** Central WAF/Shield across accounts = AWS Firewall Manager.

---

## Q 05-v1-17
- domain: secure
- task: 1.1
- topic: security
- services: IAM
- tags: mfa
- difficulty: easy
- time: 50
- source: practice-exams/05-security-services-exam.md#Q17

Which IAM best practice should be applied to the AWS account root user?

- A. Use it for daily administrative tasks
- B. Create access keys for automation
- C. Share it across the admin team
- D. Enable MFA and avoid using it for everyday work

**Answer:** D

**Explanation:** Root user = enable MFA, don't use daily.

---

## Q 05-v1-18
- domain: secure
- task: 1.2
- topic: security
- services: PrivateLink, EC2, KMS
- tags: subnets
- difficulty: easy
- time: 70
- enriched: 2026-10-21
- source: practice-exams/05-security-services-exam.md#Q18

An application on EC2 in a private subnet needs to call AWS APIs (e.g., KMS) without traversing the internet. Which solution is BEST?

- A. A NAT Gateway in a public subnet routing the instance's API calls out to the internet
- B. An Interface VPC Endpoint (PrivateLink) for KMS placed in the private subnet
- C. A bastion host in a public subnet that proxies the EC2 instance's API calls to KMS
- D. A public IP assigned to the EC2 instance so it can reach KMS over the internet

**Answer:** B

**Explanation:** An Interface VPC Endpoint powered by AWS PrivateLink places a private IP for the KMS API inside the VPC, so the EC2 instance calls KMS entirely over the AWS network without ever routing through the internet.
- A NAT Gateway: routes outbound traffic to the internet through an internet gateway, which is exactly the path the requirement rules out.
- A bastion host proxying the calls: still needs its own path to the internet (or an internet-facing hop) to reach the public KMS endpoint, so traffic still leaves the AWS private network.
- A public IP on the instance: a private subnet has no route to an internet gateway, and even if it did, the traffic would traverse the internet.
> 🇻🇳 Gọi API AWS từ subnet private mà không ra internet → Interface VPC Endpoint (PrivateLink); NAT/IGW/public IP đều cần đường ra internet.

---

## Q 05-v1-19
- domain: secure
- task: 1.2
- topic: security
- services: WAF
- tags: web-attacks
- difficulty: medium
- time: 80
- source: practice-exams/05-security-services-exam.md#Q19

Which two are TRUE about AWS WAF? (Choose TWO)

- A. It can apply rate-based rules to limit requests from an IP
- B. It is a network-layer DDoS scrubbing appliance
- C. It replaces IAM for authentication
- D. It protects against SQL injection and cross-site scripting
- E. It only works with EC2 instances

**Answer:** A, D

**Explanation:** WAF blocks SQLi/XSS and supports rate-based rules.

---

## Q 05-v1-20
- domain: secure
- task: 1.1
- topic: security
- services: Directory Service, EC2
- difficulty: easy
- time: 50
- source: practice-exams/05-security-services-exam.md#Q20

A company needs to integrate its existing on-premises Microsoft Active Directory so Windows EC2 instances can join the domain, while keeping a trust to on-premises AD. Which option?

- A. Amazon Cognito
- B. Simple AD
- C. IAM Identity Center only
- D. AWS Managed Microsoft AD (with trust)

**Answer:** D

**Explanation:** Domain join + trust to on-prem AD = AWS Managed Microsoft AD.
