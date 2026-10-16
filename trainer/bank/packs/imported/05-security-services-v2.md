---
pack: saa-05-security-services-v2
title: 05 · Security Services · V2
exam: SAA-C03
origin: imported
source: practice-exams/05-security-services-exam-v2.md
created: 2026-10-16
---

# 05 · Security Services · V2

> Imported from `practice-exams/05-security-services-exam-v2.md` + `05-security-services-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 05-v2-01
- domain: secure
- topic: security
- services: IAM, EC2, S3
- tags: iam-roles
- difficulty: medium
- time: 60
- source: practice-exams/05-security-services-exam-v2.md#Q1

An EC2 application needs to access S3 without storing long-term credentials on the instance. What is BEST practice?

- A. Store an IAM user's access keys on the instance
- B. Attach an IAM role to the EC2 instance
- C. Hardcode keys in the app
- D. Use the root account keys

**Answer:** B

**Explanation:** EC2 access to S3 without stored keys = attach IAM role to instance.

---

## Q 05-v2-02
- domain: secure
- topic: security
- services: IAM, STS
- tags: cross-account-access, iam-roles
- difficulty: medium
- time: 55
- source: practice-exams/05-security-services-exam-v2.md#Q2

A company must grant a third-party AWS account temporary access to specific resources. Which mechanism?

- A. Share IAM user credentials
- B. Cross-account IAM role with sts:AssumeRole
- C. Make resources public
- D. Root account access

**Answer:** B

**Explanation:** Temporary cross-account access = cross-account IAM role + sts:AssumeRole.

---

## Q 05-v2-03
- domain: secure
- topic: security
- services: Secrets Manager
- tags: key-rotation
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q3

Sensitive application secrets (DB passwords) need automatic rotation and secure storage. Which service?

- A. Systems Manager Parameter Store (standard)
- B. AWS Secrets Manager
- C. S3 with encryption
- D. IAM policy

**Answer:** B

**Explanation:** Secrets with automatic rotation = AWS Secrets Manager.

---

## Q 05-v2-04
- domain: secure
- topic: security
- services: KMS
- tags: encryption-at-rest, compliance
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q4

Data at rest must be encrypted with customer-managed keys and full audit of key usage. Which service?

- A. AWS KMS
- B. AWS Certificate Manager
- C. IAM
- D. AWS Config

**Answer:** A

**Explanation:** Customer-managed keys + key-usage audit = AWS KMS.

---

## Q 05-v2-05
- domain: secure
- topic: security
- services: WAF
- tags: web-attacks
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q5

A web application must be protected against SQL injection and cross-site scripting at the HTTP layer. Which service?

- A. AWS Shield
- B. AWS WAF
- C. GuardDuty
- D. Security Groups

**Answer:** B

**Explanation:** SQLi/XSS protection at HTTP layer = AWS WAF.

---

## Q 05-v2-06
- domain: secure
- topic: security
- services: Shield
- tags: ddos-protection
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q6

An application needs protection against large-scale DDoS attacks with 24/7 support and cost protection. Which service?

- A. AWS WAF only
- B. AWS Shield Advanced
- C. GuardDuty
- D. Network ACLs

**Answer:** B

**Explanation:** Large DDoS + 24/7 + cost protection = AWS Shield Advanced.

---

## Q 05-v2-07
- domain: secure
- topic: security
- services: GuardDuty, VPC, VPC Flow Logs, CloudTrail
- tags: threat-detection
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q7

A company wants continuous threat detection analyzing VPC Flow Logs, DNS logs, and CloudTrail for malicious activity. Which service?

- A. Amazon Inspector
- B. Amazon GuardDuty
- C. AWS Config
- D. Amazon Macie

**Answer:** B

**Explanation:** Threat detection from Flow Logs/DNS/CloudTrail = Amazon GuardDuty.

---

## Q 05-v2-08
- domain: secure
- topic: security
- services: Macie, S3
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q8

A company must discover and classify sensitive PII stored in S3 buckets automatically. Which service?

- A. Amazon Macie
- B. Amazon GuardDuty
- C. AWS WAF
- D. AWS Config

**Answer:** A

**Explanation:** Discover/classify PII in S3 = Amazon Macie.

---

## Q 05-v2-09
- domain: secure
- topic: security
- services: Inspector, EC2
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q9

EC2 instances and container images must be scanned for software vulnerabilities and unintended network exposure. Which service?

- A. Amazon Inspector
- B. Amazon Macie
- C. AWS Shield
- D. AWS WAF

**Answer:** A

**Explanation:** Vulnerability + network exposure scanning = Amazon Inspector.

---

## Q 05-v2-10
- domain: secure
- topic: security
- services: Cognito
- tags: federation
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q10

A mobile app needs user sign-up, sign-in, and federated identity (Google/Facebook) with tokens. Which service?

- A. IAM users
- B. Amazon Cognito User Pools
- C. AWS Directory Service
- D. AWS SSO only

**Answer:** B

**Explanation:** User sign-up/sign-in + federation + tokens = Cognito User Pools.

---

## Q 05-v2-11
- domain: secure
- topic: security
- services: Organizations
- tags: scp
- difficulty: medium
- time: 75
- source: practice-exams/05-security-services-exam-v2.md#Q11

A company wants to centrally manage multiple AWS accounts and apply guardrails restricting which services can be used. Which two? (Choose TWO)

- A. AWS Organizations
- B. Service Control Policies (SCPs)
- C. Security Groups
- D. NACLs
- E. IAM access keys

**Answer:** A, B

**Explanation:** Central multi-account guardrails = AWS Organizations + SCPs.

---

## Q 05-v2-12
- domain: secure
- topic: security
- services: ACM, ALB
- tags: tls-termination
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q12

TLS certificates for an ALB must be provisioned and auto-renewed at no additional cost. Which service?

- A. AWS KMS
- B. AWS Certificate Manager (ACM)
- C. CloudHSM
- D. Secrets Manager

**Answer:** B

**Explanation:** Free auto-renewing TLS cert for ALB = ACM.

---

## Q 05-v2-13
- domain: secure
- topic: security
- services: IAM
- tags: mfa, iam-policies
- difficulty: medium
- time: 55
- source: practice-exams/05-security-services-exam-v2.md#Q13

An organization must enforce MFA for all IAM users performing sensitive actions. Which approach?

- A. Enable MFA and use IAM policy conditions requiring aws:MultiFactorAuthPresent
- B. Rely on strong passwords
- C. Use root MFA only
- D. Disable programmatic access

**Answer:** A

**Explanation:** Enforce MFA on sensitive actions = MFA + policy condition aws:MultiFactorAuthPresent.

---

## Q 05-v2-14
- domain: secure
- topic: security
- services: CloudHSM
- difficulty: medium
- time: 55
- source: practice-exams/05-security-services-exam-v2.md#Q14

A regulated workload requires a dedicated, single-tenant hardware security module for key management with FIPS 140-2 Level 3. Which service?

- A. AWS KMS (multi-tenant)
- B. AWS CloudHSM
- C. Secrets Manager
- D. ACM

**Answer:** B

**Explanation:** Single-tenant HSM, FIPS 140-2 L3 = AWS CloudHSM.

---

## Q 05-v2-15
- domain: secure
- topic: security
- services: AWS Config
- tags: compliance
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q15

A company needs to record and evaluate resource configurations against compliance rules over time. Which service?

- A. AWS Config
- B. CloudTrail
- C. GuardDuty
- D. Inspector

**Answer:** A

**Explanation:** Record/evaluate config compliance over time = AWS Config.

---

## Q 05-v2-16
- domain: secure
- topic: security
- services: CloudTrail
- tags: compliance
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q16

Which service records API calls and management events for auditing "who did what" in the account?

- A. AWS Config
- B. AWS CloudTrail
- C. VPC Flow Logs
- D. GuardDuty

**Answer:** B

**Explanation:** Record API calls / who did what = AWS CloudTrail.

---

## Q 05-v2-17
- domain: secure
- topic: security
- services: Security Hub, GuardDuty, Inspector, Macie
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q17

A company wants to aggregate and prioritize security findings from GuardDuty, Inspector, and Macie in one place. Which service?

- A. AWS Security Hub
- B. AWS Config
- C. CloudWatch
- D. Trusted Advisor

**Answer:** A

**Explanation:** Aggregate/prioritize security findings = AWS Security Hub.

---

## Q 05-v2-18
- domain: secure
- topic: security
- services: Directory Service
- difficulty: medium
- time: 55
- source: practice-exams/05-security-services-exam-v2.md#Q18

Employees should use existing corporate Active Directory credentials to access AWS. Which service integrates on-prem AD?

- A. Cognito User Pools
- B. AWS Directory Service (AD Connector / Managed Microsoft AD)
- C. IAM users
- D. Secrets Manager

**Answer:** B

**Explanation:** Integrate on-prem AD with AWS = AWS Directory Service (AD Connector / Managed Microsoft AD).

---

## Q 05-v2-19
- domain: secure
- topic: security
- services: Systems Manager
- tags: s3-versioning
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q19

A parameter (non-secret config value) must be stored free of charge with hierarchy and versioning. Which service?

- A. Secrets Manager
- B. Systems Manager Parameter Store
- C. KMS
- D. S3

**Answer:** B

**Explanation:** Free hierarchical versioned config values = SSM Parameter Store.

---

## Q 05-v2-20
- domain: secure
- topic: security
- services: S3
- tags: sse-s3
- difficulty: medium
- time: 55
- source: practice-exams/05-security-services-exam-v2.md#Q20

An S3 bucket must be encrypted so that AWS manages the keys with no extra cost and no key management by the customer. Which option?

- A. SSE-KMS with customer-managed key
- B. SSE-S3
- C. SSE-C
- D. Client-side encryption

**Answer:** B

**Explanation:** AWS-managed keys, no cost, no key mgmt = SSE-S3.

---

## Q 05-v2-21
- domain: secure
- topic: security
- services: IAM
- tags: permission-boundaries
- difficulty: hard
- time: 75
- source: practice-exams/05-security-services-exam-v2.md#Q21

A team's IAM permissions are granted by their identity policy, but administrators must cap the MAXIMUM permissions those users can ever have, even if new policies are attached. Which feature?

- A. Service Control Policy on the user
- B. IAM permissions boundary
- C. Resource-based policy
- D. Session policy only

**Answer:** B

**Explanation:** Cap maximum permissions of a user = IAM permissions boundary.

---

## Q 05-v2-22
- domain: secure
- topic: security
- services: IAM
- tags: scp
- difficulty: hard
- time: 75
- source: practice-exams/05-security-services-exam-v2.md#Q22

An IAM principal has an identity policy allowing an action, but an SCP on the account denies it. What is the effective result?

- A. Allowed, identity policy wins
- B. Denied — an explicit deny / SCP restriction always overrides an allow
- C. Depends on resource policy
- D. Allowed if MFA present

**Answer:** B

**Explanation:** Explicit deny / SCP always overrides an allow = Denied.

---

## Q 05-v2-23
- domain: secure
- topic: security
- services: IAM, KMS
- tags: iam-policies
- difficulty: hard
- time: 100
- source: practice-exams/05-security-services-exam-v2.md#Q23

A KMS customer-managed key must be usable by another AWS account for decrypting shared objects. Which two are required? (Choose TWO)

- A. Key policy granting the external account access
- B. IAM policy in the external account allowing kms:Decrypt
- C. Making the key public
- D. Rotating the key hourly
- E. SSE-S3 on the bucket

**Answer:** A, B

**Explanation:** Cross-account KMS use = key policy grants external account + external IAM policy allows kms:Decrypt.

---

## Q 05-v2-24
- domain: secure
- topic: security
- services: KMS
- tags: key-rotation
- difficulty: hard
- time: 75
- source: practice-exams/05-security-services-exam-v2.md#Q24

A company wants automatic annual rotation of a KMS customer-managed symmetric key with no application changes. What happens to old data?

- A. Old ciphertext becomes unreadable
- B. KMS retains old key material and can still decrypt old ciphertext
- C. Data must be re-encrypted manually
- D. Rotation is not supported

**Answer:** B

**Explanation:** KMS rotation keeps old key material to decrypt old ciphertext (transparent).

---

## Q 05-v2-25
- domain: secure
- topic: security
- services: IAM, STS
- tags: iam-roles
- difficulty: hard
- time: 75
- source: practice-exams/05-security-services-exam-v2.md#Q25

An application running on-premises must call AWS APIs with temporary credentials without embedding long-term keys. Which is BEST?

- A. IAM user access keys stored in a file
- B. IAM Roles Anywhere / STS with a trusted identity source
- C. Root credentials
- D. Hardcoded keys in code

**Answer:** B

**Explanation:** On-prem temporary AWS creds without long-term keys = IAM Roles Anywhere / STS.

---

## Q 05-v2-26
- domain: secure
- topic: security
- services: S3
- tags: cross-account-access, iam-policies, scp
- difficulty: hard
- time: 105
- source: practice-exams/05-security-services-exam-v2.md#Q26

A cross-account S3 access must work even though the bucket policy allows the role but the role's account SCP is restrictive. Which two must ALIGN for access? (Choose TWO)

- A. The resource-based (bucket) policy must allow the principal
- B. The principal's identity policy (and SCP) must allow the action
- C. Only the bucket policy matters
- D. Only the IAM policy matters
- E. Public access must be enabled

**Answer:** A, B

**Explanation:** Cross-account access needs both resource policy allow AND principal identity/SCP allow.

---

## Q 05-v2-27
- domain: secure
- topic: security
- services: WAF
- tags: web-attacks
- difficulty: hard
- time: 70
- source: practice-exams/05-security-services-exam-v2.md#Q27

A WAF must block requests exceeding a request-rate threshold from a single IP to mitigate HTTP floods. Which rule type?

- A. Geo match rule
- B. Rate-based rule
- C. Managed rule for SQLi only
- D. IP reputation only

**Answer:** B

**Explanation:** Block per-IP request floods = WAF rate-based rule.

---

## Q 05-v2-28
- domain: secure
- topic: security
- tags: mfa
- difficulty: hard
- time: 95
- source: practice-exams/05-security-services-exam-v2.md#Q28

A company must ensure that developers can assume a role only from within the corporate network and only with MFA. Which two policy conditions? (Choose TWO)

- A. aws:SourceIp condition on the trust/permission policy
- B. aws:MultiFactorAuthPresent condition
- C. Making the role public
- D. s3:x-amz-acl condition
- E. kms:ViaService only

**Answer:** A, B

**Explanation:** Restrict assume-role to corp network + MFA = aws:SourceIp + aws:MultiFactorAuthPresent.

---

## Q 05-v2-29
- domain: secure
- topic: security
- services: Control Tower
- tags: centralized-logging
- difficulty: hard
- time: 70
- source: practice-exams/05-security-services-exam-v2.md#Q29

An organization wants new accounts to automatically have baseline guardrails, a landing zone, and centralized logging with minimal setup. Which service?

- A. AWS Config only
- B. AWS Control Tower
- C. IAM Identity Center only
- D. CloudFormation StackSets only

**Answer:** B

**Explanation:** Landing zone + baseline guardrails + central logging = AWS Control Tower.

---

## Q 05-v2-30
- domain: secure
- topic: security
- services: KMS
- tags: envelope-encryption
- difficulty: hard
- time: 75
- source: practice-exams/05-security-services-exam-v2.md#Q30

A company needs envelope encryption for large objects: encrypt data locally with a data key while protecting the data key with KMS. Which KMS operation generates the data key?

- A. kms:Encrypt on the whole object
- B. kms:GenerateDataKey (returns plaintext + encrypted data key)
- C. kms:Decrypt only
- D. kms:CreateGrant

**Answer:** B

**Explanation:** Envelope encryption data key = kms:GenerateDataKey (plaintext + encrypted copy).
