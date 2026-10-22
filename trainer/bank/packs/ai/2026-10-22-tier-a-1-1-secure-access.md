---
pack: ai-2026-10-22-tier-a-1-1
title: "AI · Tầng A · Task 1.1 — Truy cập an toàn (federation, đa tài khoản, hạ tầng toàn cầu, trách nhiệm chung)"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 1.1"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 1.1"
---

# AI · Tầng A · Task 1.1 — Truy cập an toàn (federation, đa tài khoản, hạ tầng toàn cầu, trách nhiệm chung)

## Q ai-20261022-a11-01
- domain: secure
- task: 1.1
- topic: security
- services: IAM Identity Center, Organizations
- tags: federation, iam-identity-center, scim
- difficulty: medium
- skills: 1.1.k2, 1.1.s6
- concept: IAM Identity Center with an external IdP (SAML + SCIM) is the managed way to give a workforce access to many accounts
- refs: 05-security-services.md
- hint: Đề cần SSO nhiều tài khoản từ IdP bên ngoài, nhóm tự đồng bộ, không IAM user — dịch vụ nào quản lý truy cập đa tài khoản tập trung?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A retail company has 30 AWS accounts in AWS Organizations. Its 600 employees authenticate with Okta, which is the company's external identity provider. Engineers need console and AWS CLI access to different accounts depending on their team, and the HR process already adds and removes people in Okta. The security team will not allow IAM users, and group changes in Okta must reach AWS access automatically. Which solution will meet these requirements with the LEAST operational overhead?

- A. Create a SAML identity provider for the external provider in each of the 30 accounts, with federated IAM roles mapped to Okta groups through SAML attribute statements
- B. Enable AWS IAM Identity Center, connect Okta through SAML and SCIM provisioning, and assign the synchronized groups to accounts with permission sets
- C. Create IAM users and groups in one central identity account, and have every engineer reach the other accounts from the console by switching roles
- D. Create an Amazon Cognito user pool federated with Okta and exchange its tokens for temporary AWS credentials through an identity pool for console access

**Answer:** B

**Explanation:** IAM Identity Center is managed workforce SSO: it trusts the identity provider over SAML, receives users and groups through SCIM, and creates roles in each account from permission sets, so no IAM users exist.
- Per-account SAML providers and roles: each account is set up by hand, with no automatic provisioning (tốn vận hành hơn)
- Central IAM users with role switching: creates IAM users, which are not allowed (vi phạm ràng buộc)
- Cognito user pool with an identity pool: built for customer-facing app identities, not workforce console sign-in (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/singlesignon/latest/userguide/provision-automatically.html
> 🇻🇳 SSO nhiều tài khoản từ IdP ngoài + tự đồng bộ nhóm → IAM Identity Center (SAML + SCIM + permission set).
---

## Q ai-20261022-a11-02
- domain: secure
- task: 1.1
- topic: management
- services: Organizations
- tags: scp, region-restriction, aws-global-infrastructure
- difficulty: hard
- skills: 1.1.k3, 1.1.s4, 1.1.k1
- concept: An SCP with aws:RequestedRegion (and NotAction for global services) restricts Regions for every principal in member accounts, including root
- refs: 06-management-governance.md, A-nen-tang-kien-truc.md
- hint: Cần chặn mọi principal, kể cả root của tài khoản thành viên, ở Region ngoài danh sách — nhưng IAM và CloudFront vẫn phải chạy.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A European company uses AWS Organizations with 40 member accounts grouped in a Workloads OU. A regulation requires that workloads run only in the Frankfurt and Ireland Regions. The security team must prevent every principal in the member accounts, including account administrators and the root users of those accounts, from creating resources in other Regions. Global services such as IAM and Amazon CloudFront must keep working, and accounts added to the OU later must be covered automatically. Which solution will meet these requirements?

- A. Attach a permissions boundary to every IAM user and role in each member account that denies actions when the requested Region is not eu-central-1 or eu-west-1
- B. Create an AWS Config rule in each account that detects resources outside the approved Regions and starts an automatic remediation that deletes them
- C. Create an IAM Identity Center permission set with an inline policy that denies other Regions and assign it to every user and group in the organization
- D. Attach an SCP to the OU that denies actions outside eu-central-1 and eu-west-1 by using aws:RequestedRegion, with NotAction for services that are not Region-specific

**Answer:** D

**Explanation:** An SCP caps every principal in the member accounts, including root users, and covers new accounts in the OU. Global services are called through us-east-1, so NotAction must exclude them or they would be denied too.
- Permissions boundary per identity: covers only identities that carry it, not root, and is maintained per account (tốn vận hành hơn)
- Config rule with remediation: detective: resources exist before deletion (vi phạm ràng buộc)
- Identity Center permission set: affects only people who sign in through it, not workload roles or root (đặt sai chỗ)
Docs: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_examples_general.html
> 🇻🇳 Giới hạn Region cho cả tổ chức → SCP deny + aws:RequestedRegion, loại trừ dịch vụ toàn cầu bằng NotAction.
---

## Q ai-20261022-a11-03
- domain: secure
- task: 1.1
- topic: compute
- services: Fargate, ECS
- tags: shared-responsibility
- difficulty: medium
- skills: 1.1.k5
- concept: With AWS Fargate, AWS owns host OS patching and server management, shifting responsibility compared with ECS on EC2
- refs: A-nen-tang-kien-truc.md, 01-compute-services.md
- hint: Kiểm toán xem vá hệ điều hành máy chủ là trách nhiệm của khách hàng — loại launch type nào bỏ hẳn phần đó mà không viết lại ứng dụng?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A healthcare company runs containerized APIs on Amazon ECS with EC2 container instances that its team patches every month. During a compliance audit, the assessors point out that unpatched host operating systems are the customer's responsibility under the AWS shared responsibility model. The company wants to stop being responsible for patching host operating systems and managing the underlying servers, without rewriting the containerized applications. Which solution will meet these requirements?

- A. Move the ECS services to the AWS Fargate launch type and reuse the existing container images with only minor task definition changes
- B. Configure AWS Systems Manager Patch Manager with a weekly maintenance window to patch the ECS container instances automatically
- C. Replace the container instances with Amazon EC2 Dedicated Hosts so that AWS operates the host operating system under a managed tenancy model
- D. Enable Amazon Inspector on the container instances so that AWS remediates vulnerabilities in the host operating system when they are found

**Answer:** A

**Explanation:** With Fargate, AWS provisions, scales and patches the infrastructure that runs the tasks, so the host operating system leaves the customer's scope while the container images stay the same.
- Patch Manager on EC2 container instances: automates the work, but the company still owns the patching (giải bài toán khác)
- Dedicated Hosts: single-tenant hardware, yet the guest operating system remains the customer's job (dùng sai tính năng)
- Amazon Inspector: detects vulnerabilities and reports findings, it does not patch anything (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html
> 🇻🇳 Muốn bỏ trách nhiệm vá OS máy chủ cho container → Fargate (AWS quản lý hạ tầng bên dưới).
---

## Q ai-20261022-a11-04
- domain: secure
- task: 1.1
- topic: security
- services: IAM, STS
- tags: cross-account-access, iam-roles, sts
- difficulty: medium
- skills: 1.1.s3
- concept: Cross-account role access needs a trust policy in the target account and sts:AssumeRole permission in the source account
- refs: 05-security-services.md
- hint: Truy cập chéo tài khoản bằng role cần hai phía: ai được phép đảm nhận role, và ai được phép gọi hành động đảm nhận.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 150

A company's operations team signs in with IAM users in a central tools account. The team must run maintenance scripts that read the configuration of Amazon EC2 and Amazon RDS resources in a separate workloads account. The security team will not allow IAM users or long-term access keys in the workloads account. Which combination of steps will meet these requirements? (Choose TWO)

- A. In the workloads account, create IAM users for each team member and share their access keys with the team through AWS Secrets Manager in the tools account
- B. In the workloads account, create an IAM role that trusts the tools account and attach a permissions policy that grants read-only access to EC2 and RDS
- C. In the workloads account, attach a service control policy that allows the tools account to call the EC2 and RDS describe APIs on behalf of its users
- D. In the tools account, attach an identity policy to the team's IAM group that allows sts:AssumeRole on the ARN of the role in the workloads account
- E. In the tools account, attach a resource-based policy to each IAM user that grants the user access to the EC2 and RDS resources in the workloads account

**Answer:** B, D

**Explanation:** The role in the workloads account carries the read-only permissions and its trust policy names the tools account; the team's group must also be allowed to call sts:AssumeRole on that role. Both sides must allow it, and the scripts get temporary credentials.
- IAM users with shared keys: long-term credentials in the workloads account (vi phạm ràng buộc)
- Service control policy: limits permissions and never grants them (dùng sai tính năng)
- Resource-based policy on IAM users: IAM users do not have resource-based policies (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html
> 🇻🇳 Truy cập chéo tài khoản: role + trust policy ở tài khoản đích, và quyền sts:AssumeRole ở tài khoản nguồn.
---

## Q ai-20261022-a11-05
- domain: secure
- task: 1.1
- topic: security
- services: Cognito, IAM, S3
- tags: federation, web-identity, cognito-identity-pool
- difficulty: medium
- skills: 1.1.k2, 1.1.s3
- concept: Cognito identity pools exchange Google/Apple sign-in for temporary AWS credentials scoped per user
- refs: 05-security-services.md
- hint: Hàng triệu người dùng ứng dụng di động đăng nhập bằng tài khoản mạng xã hội cần credential tạm của AWS — thành phần nào cấp credential?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 130

A photo-sharing startup's mobile app has two million users who sign in with their Google or Apple accounts. The app must upload each user's photos directly to an Amazon S3 bucket, and each user must be able to reach only their own prefix. The company does not want AWS credentials stored in the app or an IAM user for every person. The solution must use managed AWS features and the LEAST amount of custom code. Which solution will meet these requirements?

- A. Create an IAM user for each Google or Apple account that signs in, keep its access key in the app, and limit the user to a prefix named after the user name
- B. Create an Amazon Cognito user pool for the app and configure the S3 bucket policy to accept the user pool's ID tokens as the principal for each prefix
- C. Create an Amazon Cognito identity pool that trusts Google and Apple, and attach an IAM role that limits S3 access to a prefix named after the caller's identity ID
- D. Build an Amazon API Gateway API and an AWS Lambda function that validate the Google and Apple tokens and return presigned S3 URLs for each upload

**Answer:** C

**Explanation:** An identity pool exchanges the provider's token for temporary credentials tied to an IAM role, and a policy variable for the Cognito identity ID restricts each person to their own prefix, with no custom code.
- IAM users per app user: long-term keys in the app and millions of IAM users (vi phạm ràng buộc)
- User pool tokens in a bucket policy: user pools issue JWTs, but S3 cannot evaluate them as principals (cấu hình không tồn tại)
- API Gateway and Lambda issuing presigned URLs: works, but needs custom code to operate (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools.html
> 🇻🇳 Người dùng app đăng nhập Google/Apple cần credential tạm AWS → Cognito identity pool + IAM role.
---

## Q ai-20261022-a11-06
- domain: secure
- task: 1.1
- topic: security
- services: IAM
- tags: root-user, mfa, least-privilege
- difficulty: easy
- skills: 1.1.s1
- concept: Protect the root user: phishing-resistant MFA, no root access keys, monitored contact email
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Root user có toàn quyền — hãy chọn ba biện pháp bảo vệ chuẩn: xác thực nhiều lớp, khóa truy cập, và kênh liên lạc.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 150

A startup has just created a standalone AWS account. The founder signed in as the root user to set it up and is now using the root user's access key in a deployment script. The company will add an administrator for daily work through AWS IAM Identity Center. Which THREE actions should the company take to protect the root user of the account? (Choose THREE)

- A. Create a second access key for the root user and store both keys in AWS Secrets Manager with automatic rotation enabled
- B. Register a passkey or FIDO2 security key as the root user's MFA device and keep a second registered device in a secure location
- C. Share the root user password with the administrators through the team's password manager so that they can sign in during an emergency
- D. Delete the root user's access key and let the pipeline obtain temporary credentials from an IAM role instead
- E. Attach an IAM policy to the root user that limits it to read-only access so that it cannot change the account
- F. Set the root user's email address to a monitored company distribution list and keep the account's alternate contacts up to date

**Answer:** B, D, F

**Explanation:** The root user cannot be limited, so protect its credentials: register MFA (a second device avoids lockout), remove the access key, and use a monitored mailbox so that recovery and AWS notices reach the company.
- Second root access key in Secrets Manager: root access keys should not exist at all (dùng sai tính năng)
- Sharing the root password: spreads the most powerful credential to more people (vi phạm ràng buộc)
- IAM policy on the root user: IAM policies cannot be attached to or restrict the root user (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html
> 🇻🇳 Bảo vệ root: MFA chống phishing, xóa access key, email nhóm có giám sát — không dùng root hằng ngày.
---

## Q ai-20261022-a11-07
- domain: secure
- task: 1.1
- topic: networking
- services: EC2, RAM, VPC
- tags: availability-zones, az-id, vpc-sharing
- difficulty: hard
- skills: 1.1.k3, 1.1.k1
- concept: AZ names map to different physical AZs per account; AZ IDs are consistent across accounts
- refs: A-nen-tang-kien-truc.md, 04-networking-services.md
- hint: Tên AZ như us-east-1a không trùng vị trí vật lý giữa các tài khoản — dùng định danh nào để phối hợp AZ giữa hai tài khoản?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A shared-services account hosts a latency-sensitive in-memory cache cluster in the Availability Zone named us-east-1a of that account. A development account must run its EC2 instances in the same physical Availability Zone as the cache to avoid inter-AZ latency and data transfer charges. The team launched the instances in us-east-1a of the development account, but the bill still shows inter-AZ data transfer for the cache traffic. Which solution will meet the requirement?

- A. Launch the instances in the Availability Zone with the same name in the development account, because AWS maps zone names identically for accounts in one organization
- B. Create a cluster placement group in the development account and specify the cache cluster's zone name as its location so that the instances land beside the cache
- C. Place a Network Load Balancer with cross-zone load balancing disabled in front of the shared-services cache so that each request stays in the client's Availability Zone
- D. Look up the AZ ID of the cache subnet in the shared-services account and launch the instances in the development account's subnet that has the same AZ ID

**Answer:** D

**Explanation:** AWS maps physical Availability Zones to zone names separately for each account, so one name can mean different places. The AZ ID, such as use1-az1, identifies the same physical zone in every account.
- Same zone name across an organization: the mapping is randomized per account (cấu hình không tồn tại)
- Placement group: works inside the owning account and cannot target another account's zone (dùng sai tính năng)
- NLB with cross-zone disabled: changes how the load balancer routes, not where client instances run (giải bài toán khác)
Docs: https://docs.aws.amazon.com/ram/latest/userguide/working-with-az-ids.html
> 🇻🇳 Tên AZ ánh xạ ngẫu nhiên theo từng tài khoản → dùng AZ ID (use1-az1) để định vị cùng một AZ vật lý.
---

## Q ai-20261022-a11-08
- domain: secure
- task: 1.1
- topic: security
- services: IAM
- tags: mfa, iam-users
- difficulty: medium
- skills: 1.1.s1
- family: iam-mfa-device-choice
- concept: Qualifier reading: the cheapest valid MFA device is a virtual authenticator app, the most phishing-resistant is a FIDO2 security key
- refs: 05-security-services.md
- hint: Đề hỏi chi phí thấp nhất — thiết bị MFA nào miễn phí phần cứng và vẫn được IAM hỗ trợ?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 105

A company's 25 cloud administrators sign in to the AWS Management Console with IAM users in a single account. The company will require MFA for every administrator. The administrators work from company laptops and carry personal phones, each administrator already has a console password, and the company has no existing MFA infrastructure. Which solution will meet these requirements MOST cost-effectively?

- A. Give each administrator a FIDO2 hardware security key and register it as the MFA device of the administrator's IAM user
- B. Have each administrator install a virtual authenticator app on a phone and register it as the MFA device of the IAM user
- C. Buy a hardware TOTP token for each administrator and register its serial number and seed with the administrator's IAM user
- D. Enable SMS text message MFA for each IAM user by registering the administrator's mobile phone number as the second factor

**Answer:** B

**Explanation:** A virtual authenticator app is a supported TOTP device that needs no hardware purchase, so it meets the MFA requirement at the lowest cost.
- FIDO2 hardware security keys: strongest option, but each key must be purchased (tốn chi phí hơn)
- Hardware TOTP tokens: cost more than an app and add no stronger protection than TOTP (tốn chi phí hơn)
- SMS text message MFA: AWS ended support for SMS MFA, so it cannot be enabled (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa.html
> 🇻🇳 MFA rẻ nhất cho IAM user → ứng dụng xác thực ảo (TOTP); SMS MFA đã bị AWS ngừng hỗ trợ.
---

## Q ai-20261022-a11-09
- domain: secure
- task: 1.1
- topic: security
- services: IAM
- tags: mfa, iam-users
- difficulty: medium
- skills: 1.1.s1
- family: iam-mfa-device-choice
- concept: Qualifier reading: the cheapest valid MFA device is a virtual authenticator app, the most phishing-resistant is a FIDO2 security key
- refs: 05-security-services.md
- hint: Đề hỏi khả năng chống phishing mạnh nhất — loại xác thực nào dựa trên khóa công khai FIDO?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A company's 25 cloud administrators sign in to the AWS Management Console with IAM users in a single account. The company will require MFA for every administrator. The administrators work from company laptops and carry personal phones, each administrator already has a console password, and the company has no existing MFA infrastructure. Which solution will meet these requirements and provide the STRONGEST protection against phishing attacks?

- A. Give each administrator a FIDO2 hardware security key and register it as the MFA device of the administrator's IAM user
- B. Have each administrator install a virtual authenticator app on a phone and register it as the MFA device of the IAM user
- C. Buy a hardware TOTP token for each administrator and register its serial number and seed with the administrator's IAM user
- D. Enable SMS text message MFA for each IAM user by registering the administrator's mobile phone number as the second factor

**Answer:** A

**Explanation:** FIDO2 security keys use public-key cryptography bound to the sign-in site, which resists phishing, man-in-the-middle and replay attacks and is stronger than any TOTP-based option.
- Virtual authenticator app: TOTP codes can be typed into a fake sign-in page and relayed (giải bài toán khác)
- Hardware TOTP token: also TOTP, so it has the same phishing weakness at a higher cost (giải bài toán khác)
- SMS text message MFA: AWS ended support for SMS MFA, so it cannot be enabled (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa.html
> 🇻🇳 MFA chống phishing mạnh nhất → khóa bảo mật FIDO2 / passkey; TOTP (app hay token) vẫn bị phishing được.
---

## Q ai-20261022-a11-10
- domain: secure
- task: 1.1
- topic: security
- services: ECS, IAM
- tags: iam-roles, least-privilege, ecs-task-role
- difficulty: medium
- skills: 1.1.k4, 1.1.s2
- concept: ECS task roles give each service its own least-privilege credentials instead of the shared instance profile
- refs: 05-security-services.md, 01-compute-services.md
- hint: Mọi container dùng chung instance profile nên quyền là hợp của tất cả dịch vụ — cơ chế nào gắn quyền riêng cho từng task?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 125

A company runs six microservices as Amazon ECS tasks on a shared cluster of EC2 container instances. Each microservice needs a different set of Amazon S3 buckets and DynamoDB tables. Today every task inherits the instance profile of the container instances, which grants the union of all six services' permissions, and a security review flags this as a violation of least privilege. The company wants each microservice to receive only the permissions it needs, with no change to how the code obtains credentials. Which solution will meet these requirements with the LEAST operational overhead?

- A. Create an IAM user for each microservice and inject its access key into the task definition as environment variables stored in AWS Secrets Manager
- B. Split the microservices across six clusters, each with its own Auto Scaling group and an instance profile that holds just that service's permissions
- C. Block container access to the instance metadata service so that tasks can no longer use the shared instance profile credentials
- D. Create an IAM role for each microservice, set it as the task role in its task definition, and trim the shared permissions from the instance profile

**Answer:** D

**Explanation:** A task role delivers temporary credentials to the containers of one task definition through the standard SDK credential chain, so each service gets only its own permissions and the instance profile can shrink.
- IAM users with injected keys: long-term credentials that the code would handle differently (vi phạm ràng buộc)
- Six clusters with separate instance profiles: works, but multiplies instances and Auto Scaling groups to operate (tốn vận hành hơn)
- Blocking the metadata service alone: removes shared access, but the services then have no permissions (giải bài toán khác)
Docs: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html
> 🇻🇳 Mỗi microservice cần quyền riêng trên cùng cluster → task role cho từng task definition, không dùng chung instance profile.
---

## Q ai-20261022-a11-11
- domain: secure
- task: 1.1
- topic: security
- services: IAM Identity Center, Directory Service
- tags: federation, active-directory, ad-connector
- difficulty: hard
- skills: 1.1.k2, 1.1.s6
- concept: AD Connector proxies authentication to on-premises AD without caching; IAM Identity Center assigns AD groups to accounts
- refs: 05-security-services.md
- hint: Xác thực phải do domain controller tại chỗ thực hiện, không sao chép mật khẩu lên AWS — thành phần nào chỉ chuyển tiếp yêu cầu?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 170

A financial firm's 3,000 employees authenticate against Microsoft Active Directory domain controllers in its data center. The firm has 12 AWS accounts in an organization and an existing AWS Direct Connect connection to a VPC. Employees must sign in to the AWS access portal with their existing AD credentials, authentication must be performed by the on-premises domain controllers, and password hashes must not be replicated to AWS. Which combination of steps will meet these requirements with the LEAST operational overhead? (Choose TWO)

- A. Create an AD Connector directory in the VPC that forwards authentication requests to the on-premises domain controllers over the Direct Connect connection
- B. Deploy AWS Managed Microsoft AD in the VPC and migrate the employee accounts and passwords into it so that authentication no longer depends on the data center
- C. Configure AWS IAM Identity Center to use the AD Connector directory as its identity source and assign permission sets to AD groups for the 12 accounts
- D. Create an IAM user for each employee and synchronize the AD passwords to the IAM users with a scheduled AWS Lambda function for authentication
- E. Create an IAM identity provider of type Active Directory in each account that connects to the on-premises domain controllers over the Direct Connect connection

**Answer:** A, C

**Explanation:** AD Connector is a directory gateway that redirects authentication to the on-premises domain controllers without caching credentials in AWS, and IAM Identity Center can use it as the identity source for permission sets.
- Managed Microsoft AD with migrated accounts: moves credentials into AWS (vi phạm ràng buộc)
- IAM users with Lambda password sync: IAM cannot import AD passwords, and it creates long-term users (cấu hình không tồn tại)
- IAM identity provider of type Active Directory: IAM supports only SAML and OIDC providers (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/singlesignon/latest/userguide/manage-your-identity-source-ad.html
> 🇻🇳 AD tại chỗ + không sao chép mật khẩu → AD Connector làm identity source cho IAM Identity Center, gán permission set cho nhóm AD.
---

## Q ai-20261022-a11-12
- domain: secure
- task: 1.1
- topic: security
- services: RDS, EC2
- tags: shared-responsibility
- difficulty: easy
- skills: 1.1.k5
- concept: On managed RDS AWS runs the host and engine patching, while the customer still controls network access and database users
- refs: A-nen-tang-kien-truc.md, 03-database-services.md
- hint: Khi chuyển sang dịch vụ được quản lý, phần nào nằm "trong" đám mây vẫn thuộc về bạn: truy cập mạng và tài khoản database.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 85

A company is migrating a self-managed MySQL database from Amazon EC2 instances to Amazon RDS for MySQL. The security team is updating its responsibility matrix for the AWS shared responsibility model so that auditors know which controls the company must still operate after the migration. Which task will remain the company's responsibility after the migration?

- A. Patching the operating system and the database engine software on the host that runs the MySQL instance
- B. Replacing failed storage hardware and network equipment in the facility that hosts the database servers
- C. Deciding which application servers can connect and which database users hold which permissions
- D. Restricting physical access to the data center rooms that house the servers running the database

**Answer:** C

**Explanation:** For a managed service AWS operates the infrastructure, but security in the cloud stays with the customer: network access through security groups, database accounts and permissions, and the choice to encrypt data.
- Patching the host and engine: managed by AWS in RDS (đặt sai chỗ)
- Replacing failed hardware: part of AWS's operation of the cloud (đặt sai chỗ)
- Physical access to the data center: an inherited control that AWS provides (đặt sai chỗ)
Docs: https://aws.amazon.com/compliance/shared-responsibility-model/
> 🇻🇳 RDS: AWS lo hạ tầng + vá host; bạn vẫn lo security group, user/quyền database và mã hoá dữ liệu.
---

## Q ai-20261022-a11-13
- domain: secure
- task: 1.1
- topic: management
- services: Organizations, IAM, STS
- tags: root-user, centralized-root-access
- difficulty: hard
- skills: 1.1.s1, 1.1.s4, 1.1.k1
- concept: Centralized root access management removes member-account root credentials and offers short-term privileged root sessions
- refs: 05-security-services.md, 06-management-governance.md
- hint: Cần xoá hẳn thông tin đăng nhập root của 300 tài khoản thành viên mà vẫn làm được vài tác vụ chỉ root làm được — không vào từng tài khoản.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 145

A company has 300 member accounts in AWS Organizations. Many were created years ago and have root user passwords and MFA devices that nobody tracks. The security team wants to remove the root user credentials in the member accounts so that nobody can sign in as root or recover the root password. The team must still be able to perform rare root-only tasks, such as deleting an Amazon S3 bucket policy that denies all principals, and does not want to visit each account. What should a solutions architect do?

- A. Register a hardware MFA device for the root user of each member account, keep the devices and credentials in a safe, and sign in as root whenever a root-only task arises
- B. Enable centralized root access management in Organizations, delete the root credentials of member accounts, and run root-only tasks in short-term root sessions
- C. Attach an SCP in AWS Organizations that denies every action for the root user in each member account, and detach the SCP temporarily whenever a root-only task arises
- D. Create an IAM role with AdministratorAccess in each member account that can perform the root-only tasks, and then delete the root user from every account

**Answer:** B

**Explanation:** Centralized root access management lets the management account or the IAM delegated administrator delete member accounts' root credentials and run privileged actions, such as unlocking a bucket policy, in temporary root sessions.
- Hardware MFA per account: leaves 300 standing root credentials to visit and guard (tốn vận hành hơn)
- SCP denying root: credentials still exist and the SCP must be removed to do the task (vi phạm ràng buộc)
- Admin IAM roles and deleting root: root cannot be deleted and roles cannot do root-only tasks (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user.html#id_root-user-access-management
> 🇻🇳 Xoá root credential hàng loạt + vẫn làm tác vụ chỉ root → centralized root access (phiên root đặc quyền ngắn hạn).
---

## Q ai-20261022-a11-14
- domain: secure
- task: 1.1
- topic: security
- services: IAM
- tags: permission-boundaries, privilege-escalation, least-privilege
- difficulty: hard
- skills: 1.1.s2, 1.1.k4
- concept: Delegated role creation is limited by requiring the permissions boundary through the iam:PermissionsBoundary condition key
- refs: 05-security-services.md
- hint: Boundary đặt trên chính nhà phát triển không tự truyền sang role họ tạo — điều kiện nào buộc mọi role mới phải mang boundary?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A company lets application developers create IAM roles for their AWS Lambda functions in a development account so that teams do not wait for the central security team. The security team worries about privilege escalation, because a developer could create a role with AdministratorAccess and use it. Developers must be allowed to create roles and attach policies, but every role they create must never exceed an approved set of permissions, and developers must not be able to lift that limit. Which solution will meet these requirements?

- A. Attach an SCP in the management account that denies iam:CreateRole for the developers, and have the security team create each role on request
- B. Set the approved boundary policy as the permissions boundary of the developers' own IAM identities so that the roles they create inherit the same limit automatically
- C. Allow iam:CreateRole and iam:AttachRolePolicy for developers only when iam:PermissionsBoundary equals the approved boundary, and deny actions that remove it
- D. Turn on IAM Access Analyzer and configure it to delete automatically any role whose attached policies grant more than the approved permissions

**Answer:** C

**Explanation:** Conditioning the developers' IAM permissions on iam:PermissionsBoundary forces every new role to carry the approved boundary, which caps its permissions whatever policies are attached, and an explicit deny on removing the boundary keeps the limit in place.
- SCP denying iam:CreateRole: stops developers from creating roles at all (vi phạm ràng buộc)
- Boundary on the developers' own identities: it limits the developers, not the roles they create (dùng sai tính năng)
- Access Analyzer deleting roles: it reports findings and has no automatic deletion of roles (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html
> 🇻🇳 Cho dev tự tạo role nhưng không leo thang đặc quyền → điều kiện iam:PermissionsBoundary bắt buộc + chặn xoá boundary.
---

## Q ai-20261022-a11-15
- domain: secure
- task: 1.1
- topic: security
- services: IAM, KMS, VPC
- tags: aws-global-infrastructure, regional-vs-global
- difficulty: medium
- skills: 1.1.k3, 1.1.k2
- concept: IAM is global while KMS keys and security groups are Regional resources that must exist in each Region
- refs: A-nen-tang-kien-truc.md, 05-security-services.md
- hint: Tài nguyên toàn cầu dùng lại được ở mọi Region, còn tài nguyên theo Region phải tạo lại — hãy phân loại từng loại.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A company runs production workloads in Europe (Ireland) and is building a disaster recovery environment in Asia Pacific (Sydney). It uses IAM roles with customer managed policies, AWS KMS customer managed keys to encrypt Amazon EBS volumes, and security groups for its instances. An architect must determine which of these security resources have to be created again for the new Region. Which combination of actions is required? (Choose TWO)

- A. Create a customer managed AWS KMS key in the Sydney Region to encrypt the EBS volumes of the recovery instances
- B. Recreate the IAM roles in the Sydney Region and give them access to the KMS key that encrypts the EBS volumes
- C. Recreate the customer managed IAM policies in the Sydney Region and attach them to the roles of the recovery instances
- D. Recreate the IAM users and groups of the security operations team in the Sydney Region and attach the policies to them
- E. Create security groups for the recovery instances in the Sydney Region and reference them in the launch settings

**Answer:** A, E

**Explanation:** KMS keys and security groups belong to a single Region, so Sydney needs its own key and its own security groups. IAM identities, roles and policies are global, so the existing roles can be referenced by resources in any Region.
- Recreating IAM roles: IAM roles are global and already usable in Sydney (đặt sai chỗ)
- Recreating customer managed policies: IAM policies are global as well (đặt sai chỗ)
- Recreating IAM users and groups: IAM users and groups are global (đặt sai chỗ)
Docs: https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/global-services.html
> 🇻🇳 IAM là dịch vụ toàn cầu (dùng ở mọi Region); KMS key và security group theo Region nên phải tạo lại.