# 🔒 Practice Exam 05 — Security, Identity & Compliance (SAA-C03)

20 questions · scenario-based · English (Domain 1 = 30% of exam). Answers in `05-security-services-answers.txt`.

---

**1.** An EC2 instance must read objects from an S3 bucket. What is the MOST secure way to grant access?

- A. Store IAM access keys in the application config
- B. Attach an IAM role to the EC2 instance
- C. Make the bucket public
- D. Use the root account credentials

**2.** A company needs to automatically rotate RDS database credentials every 30 days. Which service is purpose-built for this?

- A. Systems Manager Parameter Store (Standard)
- B. AWS Secrets Manager
- C. AWS KMS
- D. AWS Config

**3.** Which service provides intelligent threat detection by analyzing CloudTrail, VPC Flow Logs, and DNS logs with machine learning?

- A. Amazon Inspector
- B. Amazon GuardDuty
- C. Amazon Macie
- D. AWS Config

**4.** A team must discover and classify PII (personally identifiable information) stored in Amazon S3 for compliance. Which service?

- A. Amazon Macie
- B. Amazon GuardDuty
- C. AWS WAF
- D. Amazon Inspector

**5.** A compliance rule requires that all EBS volumes are encrypted, with automatic detection of non-compliant resources. Which service?

- A. AWS CloudTrail
- B. AWS Config with managed rules
- C. Amazon GuardDuty
- D. AWS Trusted Advisor

**6.** You must identify WHO terminated a specific EC2 instance and WHEN. Which service provides this audit trail?

- A. Amazon CloudWatch
- B. AWS CloudTrail
- C. AWS Config
- D. VPC Flow Logs

**7.** A company wants centrally managed encryption keys with full control over rotation and key policies, plus an audit trail of key usage. Which service?

- A. AWS KMS Customer Managed Key
- B. AWS Secrets Manager
- C. AWS Certificate Manager
- D. SSE-S3

**8.** Which approach enforces a maximum permission boundary across ALL accounts in an AWS Organization (even if account admins grant more)?

- A. IAM policies in each account
- B. Service Control Policies (SCPs)
- C. Resource-based policies
- D. Permissions boundary on a single role

**9.** A mobile app must authenticate users (sign-up/sign-in) and then grant them temporary access to AWS resources. Which combination?

- A. Cognito User Pool for auth + Identity Pool for AWS credentials
- B. IAM users for each mobile user
- C. KMS + Secrets Manager
- D. Directory Service only

**10.** A web application behind CloudFront and an ALB needs protection from large-scale Layer 3/4 DDoS attacks with 24/7 support and cost protection. Which service?

- A. AWS Shield Standard
- B. AWS Shield Advanced
- C. AWS WAF only
- D. Security Groups

**11.** Which service issues FREE public SSL/TLS certificates that auto-renew and integrate with ALB and CloudFront?

- A. AWS KMS
- B. AWS Certificate Manager (ACM)
- C. AWS Secrets Manager
- D. IAM

**12.** A company must give an external auditor read-only access to its account without creating long-term credentials. Which approach is BEST?

- A. Create an IAM user with access keys
- B. Use an IAM role with cross-account AssumeRole and least privilege
- C. Share the root password
- D. Add the auditor to an admin group

**13.** Which service centralizes and aggregates security findings from GuardDuty, Inspector, and Macie, and runs compliance standard checks?

- A. AWS Security Hub
- B. AWS Config
- C. AWS Organizations
- D. Amazon Detective

**14.** To encrypt data larger than 4 KB efficiently while minimizing KMS API calls, which technique is used?

- A. Directly encrypting with the CMK
- B. Envelope encryption with a data key
- C. SSE-C
- D. Client-side hashing

**15.** Which service performs automated vulnerability (CVE) scanning of EC2 instances, container images in ECR, and Lambda functions?

- A. Amazon Inspector
- B. Amazon Macie
- C. AWS WAF
- D. AWS Shield

**16.** A company wants to centrally manage WAF rules and Shield Advanced protections across many accounts in its Organization. Which service?

- A. AWS Firewall Manager
- B. AWS Config
- C. AWS WAF only
- D. Security Hub

**17.** Which IAM best practice should be applied to the AWS account root user?

- A. Use it for daily administrative tasks
- B. Enable MFA and avoid using it for everyday work
- C. Create access keys for automation
- D. Share it across the admin team

**18.** An application on EC2 in a private subnet needs to call AWS APIs (e.g., KMS) without traversing the internet. Which solution is BEST?

- A. NAT Gateway only
- B. Interface VPC Endpoint (PrivateLink)
- C. Internet Gateway
- D. Public IP on the instance

**19.** Which two are TRUE about AWS WAF? (Choose TWO)

- A. It protects against SQL injection and cross-site scripting
- B. It can apply rate-based rules to limit requests from an IP
- C. It is a network-layer DDoS scrubbing appliance
- D. It only works with EC2 instances
- E. It replaces IAM for authentication

**20.** A company needs to integrate its existing on-premises Microsoft Active Directory so Windows EC2 instances can join the domain, while keeping a trust to on-premises AD. Which option?

- A. Simple AD
- B. AWS Managed Microsoft AD (with trust) 
- C. Amazon Cognito
- D. IAM Identity Center only
