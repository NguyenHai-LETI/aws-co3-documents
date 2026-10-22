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
- skills: 1.2.k1, 1.2.s3
- concept: Secrets Manager rotates credentials automatically and replicates the rotated value to replica Regions; Parameter Store has no native rotation or multi-Region replication
- refs: 05-security-services.md
- hint: Xoay mật khẩu tự động và đọc được bản sao ngay tại Region phụ — dịch vụ nào có sẵn cả hai, còn Parameter Store thì không?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 125

A fintech company runs an order service on Amazon ECS with AWS Fargate in two Regions in front of an Amazon Aurora global database. The packaged application supports only user name and password authentication to the database. Policy requires the database password to be rotated on a 30-day schedule, and the application in the secondary Region must read the same credentials from a local source even when the primary Region is unavailable. The team wants the LEAST operational overhead. Which solution will meet these requirements?

- A. Store the credentials as SecureString parameters in Parameter Store in each Region and schedule a Lambda function in each Region on a 30-day cycle to change the password and update the parameter
- B. Store the credentials in AWS Secrets Manager, configure rotation on a 30-day schedule for the secret, and replicate the secret to the secondary Region
- C. Turn on IAM database authentication for the Aurora cluster so that the tasks request short-lived authentication tokens instead of using a stored password
- D. Store the credentials as a SecureString parameter in the primary Region and let the tasks in the secondary Region read the parameter across Regions

**Answer:** B

**Explanation:** Secrets Manager rotates the password on a schedule and propagates the rotated value to replica secrets, so the secondary Region reads a local copy without custom code.
- Parameter Store with scheduled Lambda functions: has no native rotation, so the team builds and runs the logic in each Region (tốn vận hành hơn)
- IAM database authentication: the application supports passwords only (vi phạm ràng buộc)
- Cross-Region parameter reads: no rotation, and the secondary Region depends on the primary Region (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/secretsmanager/latest/userguide/replicate-secrets.html
> 🇻🇳 Xoay mật khẩu tự động + bản sao đa Region → Secrets Manager; Parameter Store không có rotation hay replication.

---

## Q ai-20261022-a12-12
- domain: secure
- task: 1.2
- topic: security
- services: Secrets Manager, KMS, Lambda, IAM
- tags: cross-account-access, iam-policies
- difficulty: hard
- skills: 1.2.k1, 1.2.s3
- concept: Cross-account access to a secret needs a resource policy, an identity policy, and a customer managed KMS key because the aws/secretsmanager key policy cannot be changed
- refs: 05-security-services.md
- hint: Khoá KMS mặc định do AWS quản lý không cho sửa key policy — bí mật dùng chung giữa hai tài khoản cần loại khoá nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 130

A central security account stores a database secret in AWS Secrets Manager. The secret is encrypted with the default AWS managed key aws/secretsmanager. An AWS Lambda function in a separate application account must retrieve the secret at runtime. The security team wants to grant this access without copying the secret and without sharing IAM user credentials between accounts. Which solution will meet these requirements?

- A. Add the application account to the key policy of the aws/secretsmanager key and attach a resource policy that allows the Lambda execution role to the secret
- B. Create an IAM user in the security account and store its access keys in environment variables of the Lambda function in the application account
- C. Re-encrypt the secret with a customer managed KMS key, attach a resource policy for the Lambda role to the secret, and let the role call kms:Decrypt on that key
- D. Use Secrets Manager replication to copy the secret into the application account and let the Lambda function read the replica from there

**Answer:** C

**Explanation:** Cross-account access needs the secret's resource policy, an identity policy for the role, and permission on the KMS key. The AWS managed key cannot be shared, so a customer managed key with a key policy is required.
- Editing the aws/secretsmanager key policy: AWS managed key policies cannot be changed (cấu hình không tồn tại)
- IAM user access keys: shares long-term credentials across accounts (vi phạm ràng buộc)
- Replication to the application account: replication copies secrets to other Regions, not accounts (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access_examples_cross.html
> 🇻🇳 Chia sẻ secret giữa tài khoản: resource policy + identity policy + khoá KMS tự quản (không dùng aws/secretsmanager).

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
- B. Create an IAM user for each app user and ship the long-term credentials as access keys in the secure storage of the mobile device on each phone
- C. Attach an IAM role to the identity pool that allows object actions under a prefix built with the cognito-identity.amazonaws.com:sub variable
- D. Attach the S3 permissions policy directly to the Cognito user pool so that signed-in users inherit access to their own prefix in the bucket and its objects
- E. Configure a bucket policy that allows uploads from any principal and require the app to use random object names for the videos that it stores

**Answer:** A, C

**Explanation:** The user pool handles sign-up and sign-in, the identity pool trades the token for temporary credentials, and a role policy with the identity ID variable limits each user to a personal prefix.
- IAM user per app user: long-term keys on devices, and this does not scale (vi phạm ràng buộc)
- Policy attached to the user pool: user pools cannot hold IAM permissions (cấu hình không tồn tại)
- Open bucket policy with random names: obscurity is not access control (vi phạm ràng buộc)
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
- skills: 1.2.k5
- concept: GuardDuty Malware Protection for S3 scans new uploads for malware; Macie discovers PII in S3 objects; Inspector and Security Hub do neither
- refs: 05-security-services.md
- hint: Hai nhu cầu khác nhau trên cùng bucket: tìm mã độc trong file mới tải lên và tìm dữ liệu cá nhân — mỗi nhu cầu một dịch vụ.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 130

An insurance company lets customers upload claim documents, such as PDF files and images, to an Amazon S3 bucket. Security must detect uploaded files that contain malware before downstream workflows use them, and must discover which objects contain personally identifiable information such as national ID numbers. The team wants managed services and no custom scanning code. Which combination of actions will meet these requirements? (Choose TWO)

- A. Enable Amazon Inspector so that it scans the objects in the bucket for malware and for personally identifiable information
- B. Enable GuardDuty Malware Protection for S3 on the bucket so that newly uploaded objects are scanned automatically
- C. Enable AWS Security Hub so that it runs sensitive data discovery and malware checks on the content of the uploaded objects
- D. Enable GuardDuty S3 Protection so that it identifies the objects that contain national ID numbers in their content
- E. Create an Amazon Macie sensitive data discovery job for the bucket to find objects that contain national ID numbers

**Answer:** B, E

**Explanation:** Malware Protection for S3 scans each new object and publishes the result, while Macie uses managed data identifiers to find PII such as national ID numbers.
- Inspector: scans EC2 instances, container images, and Lambda functions, not S3 objects (dùng sai tính năng)
- Security Hub: aggregates findings and does not inspect object content (giải bài toán khác)
- GuardDuty S3 Protection: detects suspicious access patterns, not the content of objects (dùng sai tính năng)
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
- skills: 1.2.k5
- concept: Amazon Inspector continuously scans EC2, ECR images, and Lambda functions for software vulnerabilities and can be activated organization-wide
- refs: 05-security-services.md
- hint: Cần phát hiện lỗ hổng phần mềm (CVE) mới công bố trên cả ba loại workload — liên tục, không lập lịch quét thủ công.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 100

A SaaS company runs several hundred Amazon EC2 instances, container images in Amazon ECR, and AWS Lambda functions across ten AWS accounts in an AWS Organizations organization. After a critical software vulnerability was published last week, the security team spent two days checking by hand which workloads were affected. The company wants continuous, automated detection of newly published software vulnerabilities for all three workload types, with findings reviewed in one place. Which solution will meet these requirements with the LEAST operational overhead?

- A. Activate Amazon Inspector for the organization by using a delegated administrator account and review the findings centrally
- B. Enable Amazon GuardDuty for the organization by using a delegated administrator account and review its findings for software vulnerabilities
- C. Run AWS Systems Manager Patch Manager scans on a schedule in each account and review the compliance reports centrally
- D. Create an AWS Config conformance pack that evaluates the installed software versions and aggregate the results in one account

**Answer:** A

**Explanation:** Inspector discovers EC2 instances, ECR images, and Lambda functions automatically, rescans when a new CVE is published, and a delegated administrator gives one place to review findings.
- GuardDuty: detects threats such as unusual activity, not software vulnerabilities (giải bài toán khác)
- Patch Manager scans: cover missing patches on managed instances on a schedule, not images or functions (giải bài toán khác)
- Config conformance pack: evaluates resource configuration and does not match packages to CVEs (dùng sai tính năng)
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
- skills: 1.2.k5
- concept: Security Hub aggregates findings from GuardDuty, Inspector, and Macie across accounts with a delegated administrator and across Regions with an aggregation Region
- refs: 05-security-services.md
- hint: Cần một chỗ tập trung xem finding của nhiều dịch vụ, nhiều tài khoản, nhiều Region — dịch vụ gom và chuẩn hoá finding.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 105

A retail company uses AWS Organizations with 60 member accounts in three AWS Regions. GuardDuty, Inspector, and Macie are enabled in every account. Security analysts must review the findings of these services from a single console, in a normalized format, with findings from the member accounts and from all three Regions visible in one Region. Which solution will meet these requirements with the LEAST operational overhead?

- A. Export the findings of each service in each account to an S3 bucket in a central security account and query the findings with Amazon Athena
- B. Enable Amazon Detective in the AWS Organizations management account and add the member accounts to its behavior graph in each Region
- C. Create an AWS Config aggregator in the management account and review the aggregated compliance results of the member accounts
- D. Designate a Security Hub delegated administrator in Organizations, enable Security Hub in each Region, and choose an aggregation Region

**Answer:** D

**Explanation:** Security Hub receives findings from GuardDuty, Inspector, and Macie in a standard format, a delegated administrator covers the member accounts, and an aggregation Region brings findings from the other Regions into one place.
- S3 export with Athena: custom pipeline to build and maintain, with no normalization (tốn vận hành hơn)
- Detective: investigates the root cause of findings and does not aggregate them (giải bài toán khác)
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
- skills: 1.2.k6, 1.2.s3
- concept: AWS WAF web ACLs attach to API Gateway REST API stages; managed SQL rule groups and rate-based rules block injection and abusive IPs
- refs: 05-security-services.md
- hint: Chặn SQL injection và IP gọi quá nhanh trước khi tới API, không sửa code — lớp L7 nào gắn được vào stage của API?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

An online retailer exposes a REST API through a Regional Amazon API Gateway endpoint. Attackers send SQL injection payloads in the request bodies, and a few IP addresses call the checkout resource thousands of times per minute. The company must block both kinds of traffic without changing the API code and with the LEAST operational overhead. Which solution will meet these requirements?

- A. Configure usage plans with API keys and per-key throttling limits on the API stage and require every client to send a key
- B. Add network ACL deny entries for the offending IP addresses and for known SQL injection patterns to the subnets of the API clients
- C. Associate an AWS WAF web ACL with the API stage that uses the AWS managed SQL database rule group and a rate-based rule
- D. Enable AWS Shield Advanced on the API stage and rely on its automatic mitigation to block the injection attempts and the IP addresses

**Answer:** C

**Explanation:** A web ACL attached to the API stage inspects request content with the managed SQL database rule group and blocks IP addresses that exceed a request rate, with no code change.
- Usage plans with API keys: throttle per key, do not inspect payloads or block IP addresses (dùng sai tính năng)
- Network ACL entries: API Gateway endpoints are outside the client subnets and ACLs cannot read request bodies (đặt sai chỗ)
- Shield Advanced on the API stage: protects other resource types and targets DDoS events, not injection (giải bài toán khác)
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

- A. Subscribe to AWS Shield Advanced, add the CloudFront distribution and the load balancer as protected resources, and add the AWS WAF Anti-DDoS managed rule group to their web ACLs
- B. Rely on AWS Shield Standard for DDoS protection and create AWS WAF rate-based rules on the CloudFront distribution that block IP addresses above a request threshold
- C. Deploy AWS Network Firewall in the VPC with automatic layer 4 rules that drop traffic from known attacker IP address ranges as DDoS mitigation at the subnet edge
- D. Use AWS Firewall Manager to create security group policies that restrict the load balancer to the CloudFront IP address ranges

**Answer:** A

**Explanation:** Shield Advanced provides access to the Shield Response Team (with Business or Enterprise Support) and cost protection through service credits for attack-related scaling. The AWS WAF Anti-DDoS managed rule group detects HTTP floods against the traffic baseline and challenges or blocks attack requests automatically; since March 2026 it replaces Shield Advanced's legacy automatic layer 7 mitigation.
- Shield Standard with rate-based rules: no expert team, no cost protection, and rules are written by hand (vi phạm ràng buộc)
- Network Firewall in the VPC: not an edge DDoS service and offers neither experts nor credits (dùng sai tính năng)
- Firewall Manager security group policies: restrict the origin but do not mitigate floods (giải bài toán khác)
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

- A. Deploy a CloudFormation StackSet in AWS Organizations that creates a web ACL in each member account and associates it with the load balancers that exist today
- B. Designate a delegated Firewall Manager administrator account for the policies of the organization
- C. Create a service control policy that denies creation of load balancers and distributions that lack an associated web ACL, with automatic remediation of older ones
- D. Enable AWS Config in each member account and Region that is in scope for the Firewall Manager policies
- E. Enable AWS Security Hub in the management account so that it applies the WAF web ACL and Shield Advanced protection to each new resource
- F. Create Firewall Manager AWS WAF and Shield Advanced policies scoped to the organization with automatic remediation turned on

**Answer:** B, D, F

**Explanation:** Firewall Manager needs an administrator account and AWS Config, and its policies keep protecting new resources and new accounts, remediating non-compliant ones automatically.
- StackSet of web ACLs: covers today's load balancers but not resources created later (vi phạm ràng buộc)
- Service control policy: cannot evaluate whether a web ACL is associated (dùng sai tính năng)
- Security Hub in the management account: reports findings and does not apply protections (giải bài toán khác)
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
- skills: 1.2.s4, 1.2.s3
- concept: Client VPN with SAML federation, group-based authorization rules per subnet, and connection logging fits remote workforce access
- refs: 04-networking-services.md
- hint: Người dùng từ xa, IdP SAML có MFA, mỗi nhóm chỉ vào subnet của mình, cần log kết nối — dịch vụ VPN dành cho người dùng.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A consulting firm's 400 employees work remotely and must reach internal web applications on EC2 instances in several private subnets of a VPC. Employees authenticate through the company's SAML 2.0 identity provider, which enforces multi-factor authentication. Members of the finance group must reach only the finance subnet, and engineers must reach only the engineering subnet. Auditors need connection logs, and the company does not want VPN servers to patch. Which solution will meet these requirements?

- A. Create a Site-to-Site VPN connection from each employee laptop to a virtual private gateway and restrict each group with security group rules
- B. Create a Client VPN endpoint with SAML federated authentication, add an authorization rule per group for each subnet CIDR, and log connections to CloudWatch Logs
- C. Deploy OpenVPN servers on EC2 instances in public subnets, connect them to the SAML identity provider, and collect the connection logs on the servers
- D. Create a Client VPN endpoint with mutual certificate authentication, issue one shared client certificate to the employees, and add one authorization rule for the VPC CIDR

**Answer:** B

**Explanation:** Client VPN is a managed service for remote users. SAML federation keeps IdP controls such as MFA, group-based authorization rules limit each group to its subnet, and connection logs go to CloudWatch Logs.
- Site-to-Site VPN per laptop: built to connect networks, not individual users (dùng sai tính năng)
- OpenVPN on EC2: servers to patch and scale, which the company wants to avoid (tốn vận hành hơn)
- Shared certificate with one rule: no per-user identity, MFA, or group separation (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/cvpn-working-rules.html
> 🇻🇳 Truy cập từ xa + SAML/MFA + phân quyền theo nhóm/subnet + log → Client VPN (authorization rules + connection logging).
