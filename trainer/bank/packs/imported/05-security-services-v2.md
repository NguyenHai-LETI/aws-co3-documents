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
- task: 1.1
- topic: security
- services: IAM, EC2, S3
- tags: iam-roles
- difficulty: medium
- time: 60
- source: practice-exams/05-security-services-exam-v2.md#Q1

An EC2 application needs to access S3 without storing long-term credentials on the instance. What is BEST practice?

- A. Hardcode keys in the app
- B. Use the root account keys
- C. Store an IAM user's access keys on the instance
- D. Attach an IAM role to the EC2 instance

**Answer:** D

**Explanation:** EC2 access to S3 without stored keys = attach IAM role to instance.

---

## Q 05-v2-02
- domain: secure
- task: 1.1
- topic: security
- services: IAM, STS
- tags: cross-account-access, iam-roles
- difficulty: medium
- time: 55
- source: practice-exams/05-security-services-exam-v2.md#Q2

A company must grant a third-party AWS account temporary access to specific resources. Which mechanism?

- A. Root account access
- B. Make resources public
- C. Share IAM user credentials
- D. Cross-account IAM role with sts:AssumeRole

**Answer:** D

**Explanation:** Temporary cross-account access = cross-account IAM role + sts:AssumeRole.

---

## Q 05-v2-03
- domain: secure
- task: 1.2
- topic: security
- services: Secrets Manager
- tags: key-rotation
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q3

Sensitive application secrets (DB passwords) need automatic rotation and secure storage. Which service?

- A. AWS Secrets Manager
- B. IAM policy
- C. Systems Manager Parameter Store (standard)
- D. S3 with encryption

**Answer:** A

**Explanation:** Secrets with automatic rotation = AWS Secrets Manager.

---

## Q 05-v2-04
- domain: secure
- task: 1.3
- topic: security
- services: KMS
- tags: encryption-at-rest, compliance
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q4

Data at rest must be encrypted with customer-managed keys and full audit of key usage. Which service?

- A. IAM
- B. AWS KMS
- C. AWS Config
- D. AWS Certificate Manager

**Answer:** B

**Explanation:** Customer-managed keys + key-usage audit = AWS KMS.

---

## Q 05-v2-05
- domain: secure
- task: 1.2
- topic: security
- services: WAF
- tags: web-attacks
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q5

A web application must be protected against SQL injection and cross-site scripting at the HTTP layer. Which service?

- A. GuardDuty
- B. AWS Shield
- C. Security Groups
- D. AWS WAF

**Answer:** D

**Explanation:** SQLi/XSS protection at HTTP layer = AWS WAF.

---

## Q 05-v2-06
- domain: secure
- task: 1.2
- topic: security
- services: Shield
- tags: ddos-protection
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q6

An application needs protection against large-scale DDoS attacks with 24/7 support and cost protection. Which service?

- A. AWS WAF only
- B. Network ACLs
- C. AWS Shield Advanced
- D. GuardDuty

**Answer:** C

**Explanation:** Large DDoS + 24/7 + cost protection = AWS Shield Advanced.

---

## Q 05-v2-07
- domain: secure
- task: 1.2
- topic: security
- services: GuardDuty, VPC, VPC Flow Logs, CloudTrail
- tags: threat-detection
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q7

A company wants continuous threat detection analyzing VPC Flow Logs, DNS logs, and CloudTrail for malicious activity. Which service?

- A. AWS Config
- B. Amazon GuardDuty
- C. Amazon Macie
- D. Amazon Inspector

**Answer:** B

**Explanation:** Threat detection from Flow Logs/DNS/CloudTrail = Amazon GuardDuty.

---

## Q 05-v2-08
- domain: secure
- task: 1.3
- topic: security
- services: Macie, S3
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q8

A company must discover and classify sensitive PII stored in S3 buckets automatically. Which service?

- A. AWS WAF
- B. AWS Config
- C. Amazon Macie
- D. Amazon GuardDuty

**Answer:** C

**Explanation:** Discover/classify PII in S3 = Amazon Macie.

---

## Q 05-v2-09
- domain: secure
- task: 1.2
- topic: security
- services: Inspector, EC2
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q9

EC2 instances and container images must be scanned for software vulnerabilities and unintended network exposure. Which service?

- A. Amazon Inspector
- B. AWS Shield
- C. AWS WAF
- D. Amazon Macie

**Answer:** A

**Explanation:** Vulnerability + network exposure scanning = Amazon Inspector.

---

## Q 05-v2-10
- domain: secure
- task: 1.2
- topic: security
- services: Cognito
- tags: federation
- difficulty: medium
- time: 55
- enriched: 2026-10-22
- source: practice-exams/05-security-services-exam-v2.md#Q10

A mobile app needs user sign-up, sign-in, and federated identity (Google/Facebook) with tokens. Which service?

- A. Amazon Cognito User Pools
- B. IAM Identity Center (AWS SSO) only
- C. IAM users
- D. AWS Directory Service

**Answer:** A

**Explanation:** Cognito user pools provide a managed user directory with sign-up and sign-in, federation with social identity providers such as Google and Facebook, and JWT tokens for the mobile app.
- IAM Identity Center (formerly AWS SSO): workforce single sign-on to AWS accounts and business apps, not end-user sign-up for a consumer app.
- IAM users: long-term credentials inside your AWS account, not built for millions of app users.
- AWS Directory Service: managed Microsoft AD for enterprise workloads, no social federation.
> 🇻🇳 Đăng ký/đăng nhập người dùng app + federation Google/Facebook + token → Cognito User Pools (IAM Identity Center dành cho nhân viên).

---

## Q 05-v2-11
- domain: secure
- task: 1.1
- topic: security
- services: Organizations
- tags: scp
- difficulty: medium
- time: 75
- source: practice-exams/05-security-services-exam-v2.md#Q11

A company wants to centrally manage multiple AWS accounts and apply guardrails restricting which services can be used. Which two? (Choose TWO)

- A. Service Control Policies (SCPs)
- B. NACLs
- C. AWS Organizations
- D. IAM access keys
- E. Security Groups

**Answer:** A, C

**Explanation:** Central multi-account guardrails = AWS Organizations + SCPs.

---

## Q 05-v2-12
- domain: secure
- task: 1.3
- topic: security
- services: ACM, ALB
- tags: tls-termination
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q12

TLS certificates for an ALB must be provisioned and auto-renewed at no additional cost. Which service?

- A. CloudHSM
- B. AWS Certificate Manager (ACM)
- C. Secrets Manager
- D. AWS KMS

**Answer:** B

**Explanation:** Free auto-renewing TLS cert for ALB = ACM.

---

## Q 05-v2-13
- domain: secure
- task: 1.1
- topic: security
- services: IAM
- tags: mfa, iam-policies
- difficulty: medium
- time: 70
- enriched: 2026-10-21
- source: practice-exams/05-security-services-exam-v2.md#Q13

An organization must enforce MFA for all IAM users performing sensitive actions. Which approach?

- A. Disable programmatic (CLI/API) access for all IAM users, with no MFA requirement added for console sign-in
- B. Require long, complex passwords through the account password policy, with no added MFA condition
- C. Enable MFA and use IAM policy conditions requiring aws:MultiFactorAuthPresent
- D. Enable MFA on the root user while leaving individual IAM users without an MFA requirement

**Answer:** C

**Explanation:** Enabling MFA devices for IAM users and then adding an explicit aws:MultiFactorAuthPresent condition to the relevant IAM policies blocks sensitive actions unless the request was authenticated with MFA, which directly enforces the requirement for every IAM user.
- Disabling programmatic access: removes CLI/API access but adds no MFA requirement, so sensitive actions via the console still need no second factor.
- Requiring long, complex passwords: raises the bar against guessing but adds no MFA condition, so a single compromised password is still enough.
- Enabling MFA on the root user only: protects just the root account; the individual IAM users who actually perform the sensitive actions remain without an MFA requirement.
> 🇻🇳 Bắt buộc MFA cho hành động nhạy cảm cần bật MFA + policy condition aws:MultiFactorAuthPresent; chỉ làm root MFA hay mật khẩu mạnh là chưa đủ.

---

## Q 05-v2-14
- domain: secure
- task: 1.3
- topic: security
- services: CloudHSM
- difficulty: medium
- time: 55
- source: practice-exams/05-security-services-exam-v2.md#Q14

A regulated workload requires a dedicated, single-tenant hardware security module for key management with FIPS 140-2 Level 3. Which service?

- A. AWS KMS (multi-tenant)
- B. AWS CloudHSM
- C. ACM
- D. Secrets Manager

**Answer:** B

**Explanation:** Single-tenant HSM, FIPS 140-2 L3 = AWS CloudHSM.

---

## Q 05-v2-15
- domain: secure
- task: 1.3
- topic: security
- services: AWS Config
- tags: compliance
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q15

A company needs to record and evaluate resource configurations against compliance rules over time. Which service?

- A. CloudTrail
- B. AWS Config
- C. Inspector
- D. GuardDuty

**Answer:** B

**Explanation:** Record/evaluate config compliance over time = AWS Config.

---

## Q 05-v2-16
- domain: secure
- task: 1.2
- topic: security
- services: CloudTrail
- tags: compliance
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q16

Which service records API calls and management events for auditing "who did what" in the account?

- A. VPC Flow Logs
- B. GuardDuty
- C. AWS CloudTrail
- D. AWS Config

**Answer:** C

**Explanation:** Record API calls / who did what = AWS CloudTrail.

---

## Q 05-v2-17
- domain: secure
- task: 1.2
- topic: security
- services: Security Hub, GuardDuty, Inspector, Macie
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q17

A company wants to aggregate and prioritize security findings from GuardDuty, Inspector, and Macie in one place. Which service?

- A. Trusted Advisor
- B. AWS Config
- C. AWS Security Hub
- D. CloudWatch

**Answer:** C

**Explanation:** Aggregate/prioritize security findings = AWS Security Hub.

---

## Q 05-v2-18
- domain: secure
- task: 1.1
- topic: security
- services: Directory Service
- difficulty: medium
- time: 55
- source: practice-exams/05-security-services-exam-v2.md#Q18

Employees should use existing corporate Active Directory credentials to access AWS. Which service integrates on-prem AD?

- A. Cognito User Pools
- B. Secrets Manager
- C. AWS Directory Service (AD Connector / Managed Microsoft AD)
- D. IAM users

**Answer:** C

**Explanation:** Integrate on-prem AD with AWS = AWS Directory Service (AD Connector / Managed Microsoft AD).

---

## Q 05-v2-19
- domain: secure
- task: 1.2
- topic: security
- services: Systems Manager
- tags: s3-versioning
- difficulty: medium
- time: 50
- source: practice-exams/05-security-services-exam-v2.md#Q19

A parameter (non-secret config value) must be stored free of charge with hierarchy and versioning. Which service?

- A. Systems Manager Parameter Store
- B. KMS
- C. Secrets Manager
- D. S3

**Answer:** A

**Explanation:** Free hierarchical versioned config values = SSM Parameter Store.

---

## Q 05-v2-20
- domain: secure
- task: 1.3
- topic: security
- services: S3
- tags: sse-s3
- difficulty: medium
- time: 55
- source: practice-exams/05-security-services-exam-v2.md#Q20

An S3 bucket must be encrypted so that AWS manages the keys with no extra cost and no key management by the customer. Which option?

- A. SSE-KMS with customer-managed key
- B. SSE-C
- C. Client-side encryption
- D. SSE-S3

**Answer:** D

**Explanation:** AWS-managed keys, no cost, no key mgmt = SSE-S3.

---

## Q 05-v2-21
- domain: secure
- task: 1.1
- topic: security
- services: IAM
- tags: permission-boundaries
- difficulty: hard
- time: 75
- source: practice-exams/05-security-services-exam-v2.md#Q21

A team's IAM permissions are granted by their identity policy, but administrators must cap the MAXIMUM permissions those users can ever have, even if new policies are attached. Which feature?

- A. Service Control Policy on the user
- B. IAM permissions boundary
- C. Session policy only
- D. Resource-based policy

**Answer:** B

**Explanation:** Cap maximum permissions of a user = IAM permissions boundary.

---

## Q 05-v2-22
- domain: secure
- task: 1.1
- topic: security
- services: IAM
- tags: scp
- difficulty: hard
- time: 75
- source: practice-exams/05-security-services-exam-v2.md#Q22

An IAM principal has an identity policy allowing an action, but an SCP on the account denies it. What is the effective result?

- A. Allowed, identity policy wins
- B. Denied — an explicit deny / SCP restriction always overrides an allow
- C. Allowed if MFA present
- D. Depends on resource policy

**Answer:** B

**Explanation:** Explicit deny / SCP always overrides an allow = Denied.

---

## Q 05-v2-23
- domain: secure
- task: 1.1
- topic: security
- services: IAM, KMS
- tags: iam-policies
- difficulty: hard
- time: 100
- source: practice-exams/05-security-services-exam-v2.md#Q23

A KMS customer-managed key must be usable by another AWS account for decrypting shared objects. Which two are required? (Choose TWO)

- A. IAM policy in the external account allowing kms:Decrypt
- B. Key policy granting the external account access
- C. Rotating the key hourly
- D. SSE-S3 on the bucket
- E. Making the key public

**Answer:** A, B

**Explanation:** Cross-account KMS use = key policy grants external account + external IAM policy allows kms:Decrypt.

---

## Q 05-v2-24
- domain: secure
- task: 1.3
- topic: security
- services: KMS
- tags: key-rotation
- difficulty: hard
- time: 75
- source: practice-exams/05-security-services-exam-v2.md#Q24

A company wants automatic annual rotation of a KMS customer-managed symmetric key with no application changes. What happens to old data?

- A. KMS retains old key material and can still decrypt old ciphertext
- B. Data must be re-encrypted manually
- C. Rotation is not supported
- D. Old ciphertext becomes unreadable

**Answer:** A

**Explanation:** KMS rotation keeps old key material to decrypt old ciphertext (transparent).

---

## Q 05-v2-25
- domain: secure
- task: 1.1
- topic: security
- services: IAM, STS
- tags: iam-roles
- difficulty: hard
- time: 75
- source: practice-exams/05-security-services-exam-v2.md#Q25

An application running on-premises must call AWS APIs with temporary credentials without embedding long-term keys. Which is BEST?

- A. Root credentials
- B. IAM user access keys stored in a file
- C. Hardcoded keys in code
- D. IAM Roles Anywhere / STS with a trusted identity source

**Answer:** D

**Explanation:** On-prem temporary AWS creds without long-term keys = IAM Roles Anywhere / STS.

---

## Q 05-v2-26
- domain: secure
- task: 1.1
- topic: security
- services: S3
- tags: cross-account-access, iam-policies, scp
- difficulty: hard
- time: 105
- source: practice-exams/05-security-services-exam-v2.md#Q26

A cross-account S3 access must work even though the bucket policy allows the role but the role's account SCP is restrictive. Which two must ALIGN for access? (Choose TWO)

- A. The resource-based (bucket) policy must allow the principal
- B. Only the bucket policy matters
- C. Public access must be enabled
- D. The principal's identity policy (and SCP) must allow the action
- E. Only the IAM policy matters

**Answer:** A, D

**Explanation:** Cross-account access needs both resource policy allow AND principal identity/SCP allow.

---

## Q 05-v2-27
- domain: secure
- task: 1.2
- topic: security
- services: WAF
- tags: web-attacks
- difficulty: hard
- time: 70
- source: practice-exams/05-security-services-exam-v2.md#Q27

A WAF must block requests exceeding a request-rate threshold from a single IP to mitigate HTTP floods. Which rule type?

- A. Rate-based rule
- B. IP reputation only
- C. Managed rule for SQLi only
- D. Geo match rule

**Answer:** A

**Explanation:** Block per-IP request floods = WAF rate-based rule.

---

## Q 05-v2-28
- domain: secure
- task: 1.1
- topic: security
- tags: mfa
- difficulty: hard
- time: 95
- source: practice-exams/05-security-services-exam-v2.md#Q28

A company must ensure that developers can assume a role only from within the corporate network and only with MFA. Which two policy conditions? (Choose TWO)

- A. s3:x-amz-acl condition
- B. aws:SourceIp condition on the trust/permission policy
- C. kms:ViaService only
- D. Making the role public
- E. aws:MultiFactorAuthPresent condition

**Answer:** B, E

**Explanation:** Restrict assume-role to corp network + MFA = aws:SourceIp + aws:MultiFactorAuthPresent.

---

## Q 05-v2-29
- domain: secure
- task: 1.1
- topic: security
- services: Control Tower
- tags: centralized-logging
- difficulty: hard
- time: 70
- source: practice-exams/05-security-services-exam-v2.md#Q29

An organization wants new accounts to automatically have baseline guardrails, a landing zone, and centralized logging with minimal setup. Which service?

- A. AWS Config only
- B. IAM Identity Center only
- C. AWS Control Tower
- D. CloudFormation StackSets only

**Answer:** C

**Explanation:** Landing zone + baseline guardrails + central logging = AWS Control Tower.

---

## Q 05-v2-30
- domain: secure
- task: 1.3
- topic: security
- services: KMS
- tags: envelope-encryption
- difficulty: hard
- time: 75
- source: practice-exams/05-security-services-exam-v2.md#Q30

A company needs envelope encryption for large objects: encrypt data locally with a data key while protecting the data key with KMS. Which KMS operation generates the data key?

- A. kms:Decrypt only
- B. kms:Encrypt on the whole object
- C. kms:CreateGrant
- D. kms:GenerateDataKey (returns plaintext + encrypted data key)

**Answer:** D

**Explanation:** Envelope encryption data key = kms:GenerateDataKey (plaintext + encrypted copy).
