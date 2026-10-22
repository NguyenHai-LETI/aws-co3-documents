---
pack: ai-2026-10-22-tier-a-1-2-p2
title: "AI · Tầng A · Task 1.2 — Danh tính, bí mật, phát hiện mối đe doạ và chống tấn công web"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 1.2"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 1.2: Secrets Manager, Cognito, GuardDuty/Macie/Inspector/Security Hub, WAF, Shield Advanced, Firewall Manager, Client VPN"
---

# AI · Tầng A · Task 1.2 — Danh tính, bí mật, phát hiện mối đe doạ và chống tấn công web

## Q ai-20261022-a12-11
- domain: secure
- task: 1.2
- topic: security
- services: Secrets Manager, Systems Manager, Aurora, ECS, Fargate
- tags: key-rotation, multi-region
- difficulty: medium
- time: 125
- skills: 1.2.k1, 1.2.s3
- concept: Secrets Manager rotates credentials automatically and replicates the rotated value to replica Regions; Parameter Store has no native rotation or multi-Region replication
- refs: 05-security-services.md
- hint: Xoay mật khẩu tự động và đọc được bản sao ngay tại Region phụ — dịch vụ nào có sẵn cả hai, còn Parameter Store thì không?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A fintech company runs an order service on Amazon ECS with AWS Fargate in two Regions in front of an Amazon Aurora global database. The packaged application supports only user name and password authentication to the database. Policy requires the database password to be rotated on a 30-day schedule, and the application in the secondary Region must read the same credentials from a local source even when the primary Region is unavailable. The team wants the LEAST operational overhead. Which solution will meet these requirements?

- A. Store the credentials as separate AWS Secrets Manager secrets in each Region and turn on managed rotation on a 30-day schedule for each secret independently
- B. Store the credentials in AWS Secrets Manager, configure rotation on a 30-day schedule for the secret, and replicate the secret to the secondary Region
- C. Turn on IAM database authentication for the Aurora global database so that the tasks in both Regions request short-lived tokens through their task roles
- D. Store the credentials in AWS Secrets Manager with 30-day rotation in the primary Region and have the tasks in the secondary Region read that secret across Regions

**Answer:** B

**Explanation:** Secrets Manager rotates the password on schedule and propagates each rotated value to the replica secret, so the secondary Region reads the same credentials locally.
- Separate rotating secrets per Region: each rotation sets its own password for the shared database user, so the copies diverge (vi phạm ràng buộc)
- IAM database authentication: the application supports passwords only (vi phạm ràng buộc)
- Cross-Region reads of the primary secret: the secondary Region depends on the primary Region (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/secretsmanager/latest/userguide/replicate-secrets.html
> 🇻🇳 Xoay mật khẩu tự động + bản sao đọc tại chỗ ở Region phụ → một secret Secrets Manager có rotation + replica.

---

## Q ai-20261022-a12-12
- domain: secure
- task: 1.2
- topic: security
- services: Secrets Manager, KMS, Lambda, IAM
- tags: cross-account-access, iam-policies
- difficulty: hard
- time: 130
- skills: 1.2.k1, 1.2.s3
- concept: Cross-account access to a secret needs a resource policy, an identity policy, and a customer managed KMS key because the aws/secretsmanager key policy cannot be changed
- refs: 05-security-services.md
- hint: Khoá KMS mặc định do AWS quản lý không cho sửa key policy — bí mật dùng chung giữa hai tài khoản cần loại khoá nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A central security account stores a database secret in AWS Secrets Manager. The secret is encrypted with the default AWS managed key aws/secretsmanager. An AWS Lambda function in a separate application account must retrieve the secret at runtime. The security team wants to grant this access without copying the secret and without sharing IAM user credentials between accounts. Which solution will meet these requirements?

- A. Keep the aws/secretsmanager key, attach a resource policy that allows the Lambda execution role to read the secret, and grant the role GetSecretValue
- B. Re-encrypt the secret with a customer managed KMS key and attach a resource policy that allows the Lambda execution role to read the secret
- C. Re-encrypt the secret with a customer managed KMS key, attach a resource policy for the Lambda role to the secret, and allow that role kms:Decrypt in the key policy
- D. Replicate the secret into the application account with Secrets Manager replication and let the Lambda function read the replica locally

**Answer:** C

**Explanation:** Cross-account access to a secret needs the secret's resource policy, the role's identity policy, and permission on the KMS key. The AWS managed key cannot be shared, so the secret moves to a customer managed key whose key policy admits the role.
- aws/secretsmanager with a resource policy: the AWS managed key cannot be used from another account (dùng sai tính năng)
- Customer managed key without a key policy grant: the role can request the secret but cannot decrypt it (giải bài toán khác)
- Replication: copies the secret, which the team forbids, and targets other Regions rather than accounts (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access_examples_cross.html
> 🇻🇳 Chia sẻ secret giữa tài khoản: resource policy + identity policy + khoá KMS tự quản có key policy cho role.

---

## Q ai-20261022-a12-13
- domain: secure
- task: 1.2
- topic: security
- services: Cognito, S3, IAM
- tags: federation, iam-roles
- difficulty: medium
- time: 145
- skills: 1.2.k4, 1.2.k5
- concept: Cognito user pool authenticates users; an identity pool exchanges the token for temporary credentials scoped by an IAM role policy variable
- refs: 05-security-services.md
- hint: Một thành phần xác thực người dùng, thành phần khác đổi token thành thông tin xác thực tạm thời giới hạn theo từng người dùng.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A fitness startup is building a mobile app. Users sign up with an email address and password. The app must upload each user's workout videos directly to an Amazon S3 bucket, and each user must be able to reach objects under only their own prefix. The team does not want to run authentication servers or ship long-term AWS credentials inside the app. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create an Amazon Cognito user pool for sign-up and sign-in, and exchange its tokens for temporary AWS credentials by using a Cognito identity pool
- B. Attach an IAM role to the identity pool that allows object actions on the whole bucket and record each user's identity ID as an object tag
- C. Attach an IAM role to the identity pool that allows object actions under a prefix built with the cognito-identity.amazonaws.com:sub variable
- D. Create user pool groups that map to IAM roles in the identity pool, with one role and one bucket prefix for each group of users
- E. Turn on unauthenticated guest access in the identity pool and give the guest role temporary credentials to upload under a prefix for each device

**Answer:** A, C

**Explanation:** The user pool handles sign-up and sign-in, the identity pool trades the token for temporary credentials, and a role policy with the identity ID variable limits each user to a personal prefix.
- Role on the whole bucket with tags: any user could read or overwrite other users' objects (vi phạm ràng buộc)
- Group roles with a prefix per group: users in one group share a prefix (vi phạm ràng buộc)
- Guest access per device: credentials are not tied to the signed-in user, so per-user isolation is lost (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/cognito/latest/developerguide/iam-roles.html
> 🇻🇳 User pool = đăng nhập; identity pool = cấp credential tạm; biến ${cognito-identity.amazonaws.com:sub} giới hạn prefix từng user.

---

## Q ai-20261022-a12-14
- domain: secure
- task: 1.2
- topic: security
- services: GuardDuty, Macie, Inspector, Security Hub, S3
- tags: threat-detection, compliance
- difficulty: medium
- time: 130
- skills: 1.2.k5
- concept: GuardDuty Malware Protection for S3 scans new uploads for malware; Macie discovers PII in S3 objects; Inspector and Security Hub do neither
- refs: 05-security-services.md
- hint: Hai nhu cầu khác nhau trên cùng bucket: tìm mã độc trong file mới tải lên và tìm dữ liệu cá nhân — mỗi nhu cầu một dịch vụ.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

An insurance company lets customers upload claim documents, such as PDF files and images, to an Amazon S3 bucket. Security must detect uploaded files that contain malware before downstream workflows use them, and must discover which objects contain personally identifiable information such as national ID numbers. The team wants managed services and no custom scanning code. Which combination of actions will meet these requirements? (Choose TWO)

- A. Create an Amazon Macie sensitive data discovery job with custom data identifiers that match known malware signatures in the uploaded S3 objects
- B. Enable GuardDuty Malware Protection for S3 on the bucket so that newly uploaded objects are scanned automatically
- C. Enable GuardDuty Malware Protection for EC2 on the instances that process the documents so that their volumes are scanned for malware
- D. Enable AWS Security Hub with the Foundational Security Best Practices standard so that it flags the buckets that contain national ID numbers
- E. Create an Amazon Macie sensitive data discovery job for the bucket to find objects that contain national ID numbers

**Answer:** B, E

**Explanation:** Malware Protection for S3 scans each new object as it arrives and tags the result, while Macie uses managed data identifiers to find PII such as national ID numbers.
- Macie custom identifiers for malware: pattern matching on text is not malware detection (dùng sai tính năng)
- Malware Protection for EC2: scans instance volumes after a GuardDuty finding, so files can reach the workflow first (vi phạm ràng buộc)
- Security Hub best-practice standard: checks bucket configuration, not object content (giải bài toán khác)
Docs: https://docs.aws.amazon.com/guardduty/latest/ug/gdu-malware-protection-s3.html
> 🇻🇳 Mã độc trong file upload → GuardDuty Malware Protection for S3; tìm PII trong S3 → Macie.

---

## Q ai-20261022-a12-15
- domain: secure
- task: 1.2
- topic: security
- services: Inspector, EC2, ECR, Lambda, Organizations
- tags: threat-detection, compliance
- difficulty: easy
- time: 100
- skills: 1.2.k5
- concept: Amazon Inspector continuously scans EC2, ECR images, and Lambda functions for software vulnerabilities and can be activated organization-wide
- refs: 05-security-services.md
- hint: Cần phát hiện lỗ hổng phần mềm (CVE) mới công bố trên cả ba loại workload — liên tục, không lập lịch quét thủ công.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A SaaS company runs several hundred Amazon EC2 instances, container images in Amazon ECR, and AWS Lambda functions across ten AWS accounts in an AWS Organizations organization. After a critical software vulnerability was published last week, the security team spent two days checking by hand which workloads were affected. The company wants continuous, automated detection of newly published software vulnerabilities for all three workload types, with findings reviewed in one place. Which solution will meet these requirements with the LEAST operational overhead?

- A. Activate Amazon Inspector for the organization by using a delegated administrator account and review the findings centrally
- B. Activate Amazon Inspector separately in each of the ten accounts and review the findings in the console of each account
- C. Use Systems Manager Patch Manager patch policies from Quick Setup for the organization and review patch compliance centrally
- D. Turn on Amazon ECR enhanced scanning for the registries in each account and review the image findings centrally

**Answer:** A

**Explanation:** Inspector discovers EC2 instances, ECR images, and Lambda functions automatically, rescans them when new CVEs are published, and a delegated administrator gives one place to review findings for the organization.
- Inspector per account: same scanning, but findings stay in ten separate consoles (vi phạm ràng buộc)
- Patch Manager patch policies: report missing OS patches on managed instances, not images or functions (giải bài toán khác)
- ECR enhanced scanning: covers container images only (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/inspector/latest/user/what-is-inspector.html
> 🇻🇳 Quét lỗ hổng CVE liên tục cho EC2 + ECR + Lambda, quản lý tập trung qua Organizations → Amazon Inspector.

---

## Q ai-20261022-a12-16
- domain: secure
- task: 1.2
- topic: security
- services: Security Hub, GuardDuty, Inspector, Macie, Organizations
- tags: threat-detection, centralized-logging
- difficulty: medium
- time: 105
- skills: 1.2.k5
- concept: Security Hub aggregates findings from GuardDuty, Inspector, and Macie across accounts with a delegated administrator and across Regions with an aggregation Region
- refs: 05-security-services.md
- hint: Cần một chỗ tập trung xem finding của nhiều dịch vụ, nhiều tài khoản, nhiều Region — dịch vụ gom và chuẩn hoá finding.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A retail company uses AWS Organizations with 60 member accounts in three AWS Regions. GuardDuty, Inspector, and Macie are enabled in every account. Security analysts must review the findings of these services from a single console, in a normalized format, with findings from the member accounts and from all three Regions visible in one Region. Which solution will meet these requirements with the LEAST operational overhead?

- A. Designate a Security Hub delegated administrator in Organizations and enable Security Hub in the Region where the security analysts work
- B. Designate a GuardDuty delegated administrator in Organizations and enable GuardDuty in each Region with findings exported to one Region
- C. Create an AWS Config aggregator in a delegated administrator account that collects data from every member account and Region
- D. Designate a Security Hub delegated administrator in Organizations, enable Security Hub in each Region, and choose an aggregation Region

**Answer:** D

**Explanation:** Security Hub receives findings from GuardDuty, Inspector, and Macie in a standard format, a delegated administrator covers the member accounts, and an aggregation Region brings findings from the other Regions into one place.
- Security Hub in the analysts' Region alone: findings from the other two Regions are not collected (vi phạm ràng buộc)
- GuardDuty delegated administrator: centralizes GuardDuty findings only, not Inspector or Macie (giải bài toán khác)
- Config aggregator: collects configuration and compliance data, not security findings (giải bài toán khác)
Docs: https://docs.aws.amazon.com/securityhub/latest/userguide/what-is-securityhub.html
> 🇻🇳 Gom finding GuardDuty/Inspector/Macie nhiều tài khoản + Region vào một chỗ → Security Hub (delegated admin + aggregation Region).

---

## Q ai-20261022-a12-17
- domain: secure
- task: 1.2
- topic: security
- services: WAF, API Gateway, Shield
- tags: web-attacks, ddos-protection
- difficulty: medium
- time: 110
- skills: 1.2.k6, 1.2.s3
- concept: AWS WAF web ACLs attach to API Gateway REST API stages; managed SQL rule groups and rate-based rules block injection and abusive IPs
- refs: 05-security-services.md
- hint: Chặn SQL injection và IP gọi quá nhanh trước khi tới API, không sửa code — lớp L7 nào gắn được vào stage của API?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

An online retailer exposes a REST API through a Regional Amazon API Gateway endpoint. Attackers send SQL injection payloads in the request bodies, and a few IP addresses call the checkout resource thousands of times per minute. The company must block both kinds of traffic without changing the API code and with the LEAST operational overhead. Which solution will meet these requirements?

- A. Associate an AWS WAF web ACL with the API stage that uses the AWS managed SQL database rule group and an IP set of the offending addresses
- B. Configure usage plans with API keys and per-key throttling limits on the API stage, and require every client to send its key
- C. Associate an AWS WAF web ACL with the API stage that uses the AWS managed SQL database rule group and a rate-based rule
- D. Put an Amazon CloudFront distribution in front of the API, subscribe to AWS Shield Advanced, and add the distribution as a protected resource

**Answer:** C

**Explanation:** A web ACL on the API stage inspects request bodies with the managed SQL database rule group, and a rate-based rule blocks whichever IP addresses exceed the rate, with no code change and no list to maintain.
- Web ACL with an IP set of offenders: blocks today's addresses only, so the list needs constant updates (tốn vận hành hơn)
- Usage plans with API keys: throttle per key and do not inspect payloads (giải bài toán khác)
- CloudFront with Shield Advanced: targets DDoS events, not SQL injection payloads (giải bài toán khác)
Docs: https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-use-case.html
> 🇻🇳 SQL injection + giới hạn tốc độ theo IP trên API Gateway → AWS WAF (managed SQLi rule group + rate-based rule).

---

## Q ai-20261022-a12-18
- domain: secure
- task: 1.2
- topic: security
- services: Shield, WAF, CloudFront, ALB, Route 53
- tags: ddos-protection, web-attacks
- difficulty: hard
- time: 130
- skills: 1.2.k6, 1.2.s3
- concept: Shield Advanced adds the Shield Response Team (with Business or Enterprise Support) and cost protection; layer 7 floods are mitigated automatically by the AWS WAF Anti-DDoS managed rule group
- refs: 05-security-services.md
- hint: Cần chuyên gia DDoS 24/7, được hoàn chi phí scale do tấn công, và tự giảm thiểu L7 — gói nào của Shield, và cần gói Support nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A gaming company serves players through Amazon Route 53, an Amazon CloudFront distribution, and an internet-facing Application Load Balancer. A large HTTP flood recently made the game unavailable and caused a large scaling bill. The company has an AWS Enterprise Support plan. It wants 24/7 access to AWS DDoS experts during attacks, credits for attack-related scaling costs, and automatic mitigation of layer 7 floods without writing rules during an incident. Which solution will meet these requirements?

- A. Subscribe to AWS Shield Advanced, protect the CloudFront distribution and the load balancer, and add the AWS WAF Anti-DDoS managed rule group to their web ACLs
- B. Add the AWS WAF Anti-DDoS managed rule group and a rate-based rule to the web ACLs of the CloudFront distribution and the load balancer
- C. Subscribe to AWS Shield Advanced, protect the CloudFront distribution and the load balancer, and have the team add rate-based rules to their web ACLs when an attack starts
- D. Use AWS Firewall Manager to deploy rate-based rules and the AWS managed IP reputation rule group to the distribution and the load balancer

**Answer:** A

**Explanation:** Shield Advanced gives access to the Shield Response Team (with Business or Enterprise Support) and cost protection credits, and the AWS WAF Anti-DDoS managed rule group mitigates HTTP floods automatically against the traffic baseline.
- Anti-DDoS rule group without Shield Advanced: mitigates floods but gives no response team or cost credits (vi phạm ràng buộc)
- Shield Advanced with rate-based rules added during attacks: rules are written by hand during the incident (vi phạm ràng buộc)
- Firewall Manager with rate-based and IP reputation rules: no response team or cost credits (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/waf/latest/developerguide/ddos-automatic-app-layer-response.html
> 🇻🇳 DDoS: chuyên gia SRT 24/7 + hoàn chi phí → Shield Advanced (cần Business/Enterprise Support); tự giảm thiểu L7 → WAF Anti-DDoS managed rule group.

---

## Q ai-20261022-a12-19
- domain: secure
- task: 1.2
- topic: security
- services: Firewall Manager, WAF, Shield, Organizations, AWS Config
- tags: web-attacks, ddos-protection, scp
- difficulty: hard
- time: 165
- skills: 1.2.s3, 1.2.k6
- concept: Firewall Manager needs a delegated administrator and AWS Config, and its WAF and Shield Advanced policies auto-protect new resources and accounts
- refs: 05-security-services.md
- hint: Cần bảo vệ cả tài nguyên tạo sau này ở mọi tài khoản — dịch vụ quản trị tập trung nào có điều kiện tiên quyết là tài khoản admin và Config?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company has 90 accounts in AWS Organizations. Security requires a baseline AWS WAF web ACL and AWS Shield Advanced protection on every Application Load Balancer and CloudFront distribution, including resources that teams create later and accounts that join the organization later. Non-compliant resources must be remediated automatically with the LEAST operational overhead. Which combination of steps will meet these requirements? (Choose THREE)

- A. Deploy a CloudFormation StackSet with automatic deployment to the organization that creates the baseline AWS WAF web ACL in each new member account
- B. Designate a delegated Firewall Manager administrator account for the policies of the organization
- C. Subscribe each account to AWS Shield Advanced and add the existing load balancers and distributions as protected resources in each account
- D. Enable AWS Config in each member account and Region that is in scope for the Firewall Manager policies
- E. Enable AWS Security Hub with the Foundational Security Best Practices standard so that resources without a web ACL appear as findings for remediation
- F. Create Firewall Manager AWS WAF and Shield Advanced policies scoped to the organization with automatic remediation turned on

**Answer:** B, D, F

**Explanation:** Firewall Manager needs an administrator account and AWS Config, and its organization-wide WAF and Shield Advanced policies protect new resources and accounts and remediate non-compliant ones automatically.
- StackSet that creates a web ACL: the web ACL is not associated with resources created later (vi phạm ràng buộc)
- Shield Advanced protections added per account: covers today's resources and needs manual work for each new one (vi phạm ràng buộc)
- Security Hub best-practice standard: reports missing web ACLs but does not remediate (giải bài toán khác)
Docs: https://docs.aws.amazon.com/waf/latest/developerguide/fms-chapter.html
> 🇻🇳 Bảo vệ tự động toàn tổ chức → Firewall Manager (admin + AWS Config + policy WAF/Shield có auto-remediation).

---

## Q ai-20261022-a12-20
- domain: secure
- task: 1.2
- topic: networking
- services: Client VPN, Site-to-Site VPN, IAM Identity Center
- tags: federation, mfa
- difficulty: hard
- time: 135
- skills: 1.2.s4, 1.2.s3
- concept: Client VPN with SAML federation, group-based authorization rules per subnet, and connection logging fits remote workforce access
- refs: 04-networking-services.md
- hint: Người dùng từ xa, IdP SAML có MFA, mỗi nhóm chỉ vào subnet của mình, cần log kết nối — dịch vụ VPN dành cho người dùng.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A consulting firm's 400 employees work remotely and must reach internal web applications on EC2 instances in several private subnets of a VPC. Employees authenticate through the company's SAML 2.0 identity provider, which enforces multi-factor authentication. Members of the finance group must reach only the finance subnet, and engineers must reach only the engineering subnet. Auditors need connection logs, and the company does not want VPN servers to patch. Which solution will meet these requirements?

- A. Create a Client VPN endpoint with SAML federated authentication, add a single authorization rule for the whole VPC CIDR, and send connection logs to CloudWatch Logs
- B. Create a Client VPN endpoint with SAML federated authentication, add a group-based authorization rule for each subnet CIDR, and log connections to CloudWatch Logs
- C. Create a Client VPN endpoint with mutual certificate authentication, issue a certificate to each employee, add an authorization rule per subnet, and log connections
- D. Deploy OpenVPN Access Server from AWS Marketplace on EC2 instances with SAML sign-in, group-based routing, and connection logs sent to CloudWatch

**Answer:** B

**Explanation:** Client VPN is a managed service: SAML federation keeps the identity provider's MFA, group-based authorization rules limit each group to its subnet, and connection logs go to CloudWatch Logs.
- One authorization rule for the VPC CIDR: every employee reaches every subnet (vi phạm ràng buộc)
- Mutual certificate authentication: bypasses the SAML provider and its MFA, with no group identity (vi phạm ràng buộc)
- OpenVPN on EC2: VPN servers to patch and scale (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/cvpn-working-rules.html
> 🇻🇳 Truy cập từ xa + SAML/MFA + phân quyền theo nhóm/subnet + log → Client VPN (authorization rules + connection logging).
