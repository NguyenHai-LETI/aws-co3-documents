# 🔐 Practice Exam 05 — Security Services (SAA-C03) · V2

**30 questions** · scenario-based · English. Answers in `05-security-services-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q20
- **Part B — Khó / Nâng cao:** Q21–Q30

---

## Part A — Vận dụng (20 câu)

**1.** An EC2 application needs to access S3 without storing long-term credentials on the instance. What is BEST practice?

- A. Store an IAM user's access keys on the instance
- B. Attach an IAM role to the EC2 instance
- C. Hardcode keys in the app
- D. Use the root account keys

**2.** A company must grant a third-party AWS account temporary access to specific resources. Which mechanism?

- A. Share IAM user credentials
- B. Cross-account IAM role with sts:AssumeRole
- C. Make resources public
- D. Root account access

**3.** Sensitive application secrets (DB passwords) need automatic rotation and secure storage. Which service?

- A. Systems Manager Parameter Store (standard)
- B. AWS Secrets Manager
- C. S3 with encryption
- D. IAM policy

**4.** Data at rest must be encrypted with customer-managed keys and full audit of key usage. Which service?

- A. AWS KMS
- B. AWS Certificate Manager
- C. IAM
- D. AWS Config

**5.** A web application must be protected against SQL injection and cross-site scripting at the HTTP layer. Which service?

- A. AWS Shield
- B. AWS WAF
- C. GuardDuty
- D. Security Groups

**6.** An application needs protection against large-scale DDoS attacks with 24/7 support and cost protection. Which service?

- A. AWS WAF only
- B. AWS Shield Advanced
- C. GuardDuty
- D. Network ACLs

**7.** A company wants continuous threat detection analyzing VPC Flow Logs, DNS logs, and CloudTrail for malicious activity. Which service?

- A. Amazon Inspector
- B. Amazon GuardDuty
- C. AWS Config
- D. Amazon Macie

**8.** A company must discover and classify sensitive PII stored in S3 buckets automatically. Which service?

- A. Amazon Macie
- B. Amazon GuardDuty
- C. AWS WAF
- D. AWS Config

**9.** EC2 instances and container images must be scanned for software vulnerabilities and unintended network exposure. Which service?

- A. Amazon Inspector
- B. Amazon Macie
- C. AWS Shield
- D. AWS WAF

**10.** A mobile app needs user sign-up, sign-in, and federated identity (Google/Facebook) with tokens. Which service?

- A. IAM users
- B. Amazon Cognito User Pools
- C. AWS Directory Service
- D. AWS SSO only

**11.** A company wants to centrally manage multiple AWS accounts and apply guardrails restricting which services can be used. Which two? (Choose TWO)

- A. AWS Organizations
- B. Service Control Policies (SCPs)
- C. Security Groups
- D. NACLs
- E. IAM access keys

**12.** TLS certificates for an ALB must be provisioned and auto-renewed at no additional cost. Which service?

- A. AWS KMS
- B. AWS Certificate Manager (ACM)
- C. CloudHSM
- D. Secrets Manager

**13.** An organization must enforce MFA for all IAM users performing sensitive actions. Which approach?

- A. Enable MFA and use IAM policy conditions requiring aws:MultiFactorAuthPresent
- B. Rely on strong passwords
- C. Use root MFA only
- D. Disable programmatic access

**14.** A regulated workload requires a dedicated, single-tenant hardware security module for key management with FIPS 140-2 Level 3. Which service?

- A. AWS KMS (multi-tenant)
- B. AWS CloudHSM
- C. Secrets Manager
- D. ACM

**15.** A company needs to record and evaluate resource configurations against compliance rules over time. Which service?

- A. AWS Config
- B. CloudTrail
- C. GuardDuty
- D. Inspector

**16.** Which service records API calls and management events for auditing "who did what" in the account?

- A. AWS Config
- B. AWS CloudTrail
- C. VPC Flow Logs
- D. GuardDuty

**17.** A company wants to aggregate and prioritize security findings from GuardDuty, Inspector, and Macie in one place. Which service?

- A. AWS Security Hub
- B. AWS Config
- C. CloudWatch
- D. Trusted Advisor

**18.** Employees should use existing corporate Active Directory credentials to access AWS. Which service integrates on-prem AD?

- A. Cognito User Pools
- B. AWS Directory Service (AD Connector / Managed Microsoft AD)
- C. IAM users
- D. Secrets Manager

**19.** A parameter (non-secret config value) must be stored free of charge with hierarchy and versioning. Which service?

- A. Secrets Manager
- B. Systems Manager Parameter Store
- C. KMS
- D. S3

**20.** An S3 bucket must be encrypted so that AWS manages the keys with no extra cost and no key management by the customer. Which option?

- A. SSE-KMS with customer-managed key
- B. SSE-S3
- C. SSE-C
- D. Client-side encryption

---

## Part B — Khó / Nâng cao (10 câu)

**21.** A team's IAM permissions are granted by their identity policy, but administrators must cap the MAXIMUM permissions those users can ever have, even if new policies are attached. Which feature?

- A. Service Control Policy on the user
- B. IAM permissions boundary
- C. Resource-based policy
- D. Session policy only

**22.** An IAM principal has an identity policy allowing an action, but an SCP on the account denies it. What is the effective result?

- A. Allowed, identity policy wins
- B. Denied — an explicit deny / SCP restriction always overrides an allow
- C. Depends on resource policy
- D. Allowed if MFA present

**23.** A KMS customer-managed key must be usable by another AWS account for decrypting shared objects. Which two are required? (Choose TWO)

- A. Key policy granting the external account access
- B. IAM policy in the external account allowing kms:Decrypt
- C. Making the key public
- D. Rotating the key hourly
- E. SSE-S3 on the bucket

**24.** A company wants automatic annual rotation of a KMS customer-managed symmetric key with no application changes. What happens to old data?

- A. Old ciphertext becomes unreadable
- B. KMS retains old key material and can still decrypt old ciphertext
- C. Data must be re-encrypted manually
- D. Rotation is not supported

**25.** An application running on-premises must call AWS APIs with temporary credentials without embedding long-term keys. Which is BEST?

- A. IAM user access keys stored in a file
- B. IAM Roles Anywhere / STS with a trusted identity source
- C. Root credentials
- D. Hardcoded keys in code

**26.** A cross-account S3 access must work even though the bucket policy allows the role but the role's account SCP is restrictive. Which two must ALIGN for access? (Choose TWO)

- A. The resource-based (bucket) policy must allow the principal
- B. The principal's identity policy (and SCP) must allow the action
- C. Only the bucket policy matters
- D. Only the IAM policy matters
- E. Public access must be enabled

**27.** A WAF must block requests exceeding a request-rate threshold from a single IP to mitigate HTTP floods. Which rule type?

- A. Geo match rule
- B. Rate-based rule
- C. Managed rule for SQLi only
- D. IP reputation only

**28.** A company must ensure that developers can assume a role only from within the corporate network and only with MFA. Which two policy conditions? (Choose TWO)

- A. aws:SourceIp condition on the trust/permission policy
- B. aws:MultiFactorAuthPresent condition
- C. Making the role public
- D. s3:x-amz-acl condition
- E. kms:ViaService only

**29.** An organization wants new accounts to automatically have baseline guardrails, a landing zone, and centralized logging with minimal setup. Which service?

- A. AWS Config only
- B. AWS Control Tower
- C. IAM Identity Center only
- D. CloudFormation StackSets only

**30.** A company needs envelope encryption for large objects: encrypt data locally with a data key while protecting the data key with KMS. Which KMS operation generates the data key?

- A. kms:Encrypt on the whole object
- B. kms:GenerateDataKey (returns plaintext + encrypted data key)
- C. kms:Decrypt only
- D. kms:CreateGrant
