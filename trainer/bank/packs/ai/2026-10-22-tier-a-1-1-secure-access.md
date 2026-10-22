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
- time: 120
- skills: 1.1.k2, 1.1.s6
- concept: IAM Identity Center with an external IdP (SAML + SCIM) is the managed way to give a workforce access to many accounts
- refs: 05-security-services.md
- hint: Đề cần SSO nhiều tài khoản từ IdP bên ngoài, nhóm tự đồng bộ, không IAM user — dịch vụ nào quản lý truy cập đa tài khoản tập trung?
- created: 2026-10-22
- enriched: 2026-10-22

A retail company has 30 AWS accounts in AWS Organizations. Its 600 employees authenticate with Okta, which is the company's external identity provider. Engineers need console and AWS CLI access to different accounts depending on their team, and the HR process already adds and removes people in Okta. The security team will not allow IAM users, and group changes in Okta must reach AWS access automatically. Which solution will meet these requirements with the LEAST operational overhead?

- A. Create a SAML identity provider for the external provider in each of the 30 accounts, with federated IAM roles mapped to Okta groups through SAML attribute statements
- B. Enable AWS IAM Identity Center, connect Okta through SAML and SCIM provisioning, and assign the synchronized groups to accounts with permission sets
- C. Enable AWS IAM Identity Center with its built-in identity store, recreate the Okta groups there, and assign the groups to accounts with permission sets
- D. Create a SAML identity provider for Okta in a central identity account and let engineers assume cross-account roles from there into the other 29 accounts

**Answer:** B

**Explanation:** IAM Identity Center is managed workforce SSO: Okta authenticates over SAML, SCIM pushes user and group changes automatically, and permission sets create the roles in each account, so no IAM users exist.
- SAML provider and roles in each of the 30 accounts: works, but every account's provider and role mappings are maintained by hand (tốn vận hành hơn)
- Built-in identity store with recreated groups: Okta group changes must be copied manually (vi phạm ràng buộc)
- Central SAML account with cross-account roles: works, but roles and trust policies in every account must be maintained (tốn vận hành hơn)
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
- time: 140
- skills: 1.1.k3, 1.1.s4, 1.1.k1
- concept: An SCP with aws:RequestedRegion (and NotAction for global services) restricts Regions for every principal in member accounts, including root
- refs: 06-management-governance.md, A-nen-tang-kien-truc.md
- hint: Cần chặn mọi principal, kể cả root của tài khoản thành viên, ở Region ngoài danh sách — nhưng IAM và CloudFront vẫn phải chạy.
- created: 2026-10-22
- enriched: 2026-10-22

A European company uses AWS Organizations with 40 member accounts grouped in a Workloads OU. A regulation requires that workloads run only in the Frankfurt and Ireland Regions. The security team must prevent every principal in the member accounts, including account administrators and the root users of those accounts, from creating resources in other Regions. Global services such as IAM and Amazon CloudFront must keep working, and accounts added to the OU later must be covered automatically. Which solution will meet these requirements?

- A. Attach a permissions boundary to every IAM user and role in each member account that denies actions when the requested Region is not eu-central-1 or eu-west-1
- B. Attach an SCP to each of the 40 member accounts that denies actions outside eu-central-1 and eu-west-1 by using aws:RequestedRegion, with NotAction for global services
- C. Add a statement that denies actions outside eu-central-1 and eu-west-1 to every IAM Identity Center permission set that is assigned in the member accounts
- D. Attach an SCP to the OU that denies actions outside eu-central-1 and eu-west-1 by using aws:RequestedRegion, with NotAction for services that are not Region-specific

**Answer:** D

**Explanation:** An SCP on the OU caps every principal in its accounts, including root users and accounts added later; NotAction keeps global services, which run through us-east-1, working.
- Permissions boundary on each identity: does not apply to root users (vi phạm ràng buộc)
- SCP attached to each current account: accounts added to the OU later are not covered (vi phạm ràng buộc)
- Deny statements in permission sets: do not cover root users or workload roles (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_examples_general.html
> 🇻🇳 Giới hạn Region cho cả OU (kể cả root, tài khoản mới) → SCP gắn ở OU + aws:RequestedRegion, loại trừ dịch vụ toàn cầu bằng NotAction.
---

## Q ai-20261022-a11-03
- domain: secure
- task: 1.1
- topic: compute
- services: Fargate, ECS
- tags: shared-responsibility
- difficulty: medium
- time: 110
- skills: 1.1.k5
- concept: With AWS Fargate, AWS owns host OS patching and server management, shifting responsibility compared with ECS on EC2
- refs: A-nen-tang-kien-truc.md, 01-compute-services.md
- hint: Kiểm toán xem vá hệ điều hành máy chủ là trách nhiệm của khách hàng — loại launch type nào bỏ hẳn phần đó mà không viết lại ứng dụng?
- created: 2026-10-22
- enriched: 2026-10-22

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
- time: 150
- skills: 1.1.s3
- concept: Cross-account role access needs a trust policy in the target account and sts:AssumeRole permission in the source account
- refs: 05-security-services.md
- hint: Truy cập chéo tài khoản bằng role cần hai phía: ai được phép đảm nhận role, và ai được phép gọi hành động đảm nhận.
- created: 2026-10-22
- enriched: 2026-10-22

A company's operations team signs in with IAM users in a central tools account. The team must run maintenance scripts that read the configuration of Amazon EC2 and Amazon RDS resources in a separate workloads account. The security team will not allow IAM users or long-term access keys in the workloads account. Which combination of steps will meet these requirements? (Choose TWO)

- A. In the tools account, create an IAM role that trusts the workloads account and attach a permissions policy that grants read-only access to EC2 and RDS
- B. In the workloads account, create an IAM role that trusts the tools account and attach a permissions policy that grants read-only access to EC2 and RDS
- C. In the workloads account, attach a permissions boundary that allows the tools account's IAM group to call the EC2 and RDS describe APIs
- D. In the tools account, attach an identity policy to the team's IAM group that allows sts:AssumeRole on the ARN of the role in the workloads account
- E. In the workloads account, attach an identity policy to an IAM group that allows sts:AssumeRole on the ARN of a read-only role in the tools account

**Answer:** B, D

**Explanation:** The workloads-account role holds the read-only permissions and trusts the tools account; the team's group must also be allowed sts:AssumeRole on it, so scripts get temporary credentials.
- Role in the tools account that trusts the workloads account: reversed direction (đặt sai chỗ)
- Permissions boundary for the tools group: a boundary only limits identities in its own account and grants nothing (dùng sai tính năng)
- AssumeRole policy for a group in the workloads account: needs IAM users there and points the wrong way (vi phạm ràng buộc)
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
- time: 130
- skills: 1.1.k2, 1.1.s3
- concept: Cognito identity pools exchange Google/Apple sign-in for temporary AWS credentials scoped per user
- refs: 05-security-services.md
- hint: Hàng triệu người dùng ứng dụng di động đăng nhập bằng tài khoản mạng xã hội cần credential tạm của AWS — thành phần nào cấp credential?
- created: 2026-10-22
- enriched: 2026-10-22

A photo-sharing startup's mobile app has two million users who sign in with their Google or Apple accounts. The app must upload each user's photos directly to an Amazon S3 bucket, and each user must be able to reach only their own prefix. The company does not want AWS credentials stored in the app or an IAM user for every person. The solution must use managed AWS features and the LEAST amount of custom code. Which solution will meet these requirements?

- A. Create an Amazon Cognito identity pool that trusts Google and Apple, and attach an IAM role that allows S3 uploads anywhere in the bucket under keys that the app generates
- B. Create an Amazon Cognito user pool federated with Google and Apple, and have a Lambda token broker call AWS STS with a session policy that limits each user to a prefix
- C. Create an Amazon Cognito identity pool that trusts Google and Apple, and attach an IAM role that limits S3 access to a prefix named after the caller's identity ID
- D. Build an Amazon API Gateway API and an AWS Lambda function that validate the Google and Apple tokens and return presigned S3 URLs for each upload

**Answer:** C

**Explanation:** An identity pool exchanges the provider's token for temporary credentials tied to an IAM role, and a policy variable for the Cognito identity ID restricts each person to their own prefix, with no custom code.
- Identity pool role for the whole bucket: any user could reach other users' prefixes (vi phạm ràng buộc)
- User pool with a Lambda token broker: works, but the broker is custom code to build and secure (tốn vận hành hơn)
- API Gateway and Lambda issuing presigned URLs: works, but needs custom code to operate (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools.html
> 🇻🇳 Người dùng app đăng nhập Google/Apple cần credential tạm AWS → Cognito identity pool + IAM role với biến identity ID.
---

## Q ai-20261022-a11-06
- domain: secure
- task: 1.1
- topic: security
- services: IAM
- tags: root-user, mfa, least-privilege
- difficulty: easy
- time: 150
- skills: 1.1.s1
- concept: Protect the root user: phishing-resistant MFA, no root access keys, monitored contact email
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Root user có toàn quyền — hãy chọn ba biện pháp bảo vệ chuẩn: xác thực nhiều lớp, khóa truy cập, và kênh liên lạc.
- created: 2026-10-22
- enriched: 2026-10-22

A startup has just created a standalone AWS account. The founder signed in as the root user to set it up and is now using the root user's access key in a deployment script. The company will add an administrator for daily work through AWS IAM Identity Center. Which THREE actions should the company take to protect the root user of the account? (Choose THREE)

- A. Rotate the root user's access key every 90 days with an AWS Lambda function and store the current key in AWS Secrets Manager for the deployment script
- B. Register a passkey or FIDO2 security key as the root user's MFA device and keep a second registered device in a secure location
- C. Attach a service control policy in AWS Organizations that denies actions by the root user so that it cannot change the account
- D. Delete the root user's access key and let the pipeline obtain temporary credentials from a deployment role instead
- E. Enable Amazon GuardDuty so that it detects and blocks API calls that are signed with the root user's access key
- F. Set the root user's email address to a monitored company distribution list and keep the account's alternate contacts up to date

**Answer:** B, D, F

**Explanation:** Protect the root credentials themselves: register phishing-resistant MFA (a second device avoids lockout), remove the access key so the pipeline uses a role, and use a monitored mailbox so that recovery and AWS notices reach the company.
- Rotating the root access key: the key still exists, and root should have no access keys (giải bài toán khác)
- SCP denying root actions: the account is standalone, and SCPs apply to member accounts of an organization (đặt sai chỗ)
- GuardDuty: detects suspicious root activity but does not block calls (dùng sai tính năng)
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
- time: 140
- skills: 1.1.k3, 1.1.k1
- concept: AZ names map to different physical AZs per account; AZ IDs are consistent across accounts
- refs: A-nen-tang-kien-truc.md, 04-networking-services.md
- hint: Tên AZ như us-east-1a không trùng vị trí vật lý giữa các tài khoản — dùng định danh nào để phối hợp AZ giữa hai tài khoản?
- created: 2026-10-22
- enriched: 2026-10-22

A shared-services account hosts a latency-sensitive in-memory cache cluster in the Availability Zone named us-east-1a of that account. A development account must run its EC2 instances in the same physical Availability Zone as the cache to avoid inter-AZ latency and data transfer charges. The team launched the instances in us-east-1a of the development account, but the bill still shows inter-AZ data transfer for the cache traffic. The instances must stay in a VPC that the development account owns. Which solution will meet these requirements?

- A. Query the Availability Zone name of the cache subnet in the shared-services account and launch the instances in the development subnet that has the same zone name
- B. Share the cache subnet from the shared-services account through AWS RAM and launch the development instances directly into that shared subnet
- C. Create a VPC peering connection between the two VPCs and enable DNS resolution support so that cache traffic stays within one Availability Zone
- D. Look up the AZ ID of the cache subnet in the shared-services account and launch the instances in the development account's subnet that has the same AZ ID

**Answer:** D

**Explanation:** AWS maps physical Availability Zones to zone names randomly for each account, so one name can mean different places. The AZ ID, such as use1-az1, identifies the same physical zone in every account.
- Matching the zone name: names map differently per account, which is why the bill still shows inter-AZ traffic (dùng sai tính năng)
- Shared subnet through AWS RAM: places the instances in the shared-services VPC, not one the development account owns (vi phạm ràng buộc)
- VPC peering with DNS support: connects the VPCs but does not decide which zone the instances run in (giải bài toán khác)
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
- time: 105
- skills: 1.1.s1
- family: iam-mfa-device-choice
- concept: Qualifier reading: the cheapest valid MFA device is a virtual authenticator app, the most phishing-resistant is a FIDO2 security key
- refs: 05-security-services.md
- hint: Đề hỏi chi phí thấp nhất — thiết bị MFA nào miễn phí phần cứng và vẫn được IAM hỗ trợ?
- created: 2026-10-22
- enriched: 2026-10-22

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
- time: 110
- skills: 1.1.s1
- family: iam-mfa-device-choice
- concept: Qualifier reading: the cheapest valid MFA device is a virtual authenticator app, the most phishing-resistant is a FIDO2 security key
- refs: 05-security-services.md
- hint: Đề hỏi khả năng chống phishing mạnh nhất — loại xác thực nào dựa trên khóa công khai FIDO?
- created: 2026-10-22
- enriched: 2026-10-22

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
- time: 130
- skills: 1.1.k4, 1.1.s2
- concept: ECS task roles give each service its own least-privilege credentials instead of the shared instance profile
- refs: 05-security-services.md, 01-compute-services.md
- hint: Mọi container dùng chung instance profile nên quyền là hợp của tất cả dịch vụ — cơ chế nào gắn quyền riêng cho từng task?
- created: 2026-10-22
- enriched: 2026-10-22

A company runs six microservices as Amazon ECS tasks on a shared cluster of EC2 container instances. Each microservice needs a different set of Amazon S3 buckets and DynamoDB tables. Today every task inherits the instance profile of the container instances, which grants the union of all six services' permissions, and a security review flags this as a violation of least privilege. The company wants each microservice to receive only the permissions it needs, with no change to how the code obtains credentials. Which solution will meet these requirements with the LEAST operational overhead?

- A. Create an IAM role for each microservice and have each container call sts:AssumeRole with the instance profile credentials at startup to switch to its role
- B. Run each microservice on its own capacity provider backed by a dedicated Auto Scaling group whose instance profile holds just that service's permissions
- C. Create an IAM role for each microservice, set it as the task execution role in its task definition, and trim the shared permissions from the instance profile
- D. Create an IAM role for each microservice, set it as the task role in its task definition, and trim the shared permissions from the instance profile

**Answer:** D

**Explanation:** A task role delivers temporary credentials to the containers of one task definition through the standard SDK credential chain, so each service gets only its own permissions and the instance profile can shrink.
- AssumeRole at container startup: changes how the code obtains credentials (vi phạm ràng buộc)
- Dedicated capacity provider per service: works, but adds six Auto Scaling groups to operate (tốn vận hành hơn)
- Task execution role: used by the ECS agent to pull images and send logs, not by the application code (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html
> 🇻🇳 Mỗi microservice cần quyền riêng trên cùng cluster → task role (không phải task execution role) cho từng task definition.
---

## Q ai-20261022-a11-11
- domain: secure
- task: 1.1
- topic: security
- services: IAM Identity Center, Directory Service
- tags: federation, active-directory, ad-connector
- difficulty: hard
- time: 170
- skills: 1.1.k2, 1.1.s6
- concept: AD Connector proxies authentication to on-premises AD without caching; IAM Identity Center assigns AD groups to accounts
- refs: 05-security-services.md
- hint: Xác thực phải do domain controller tại chỗ thực hiện, không sao chép mật khẩu lên AWS — thành phần nào chỉ chuyển tiếp yêu cầu?
- created: 2026-10-22
- enriched: 2026-10-22

A financial firm's 3,000 employees authenticate against Microsoft Active Directory domain controllers in its data center. The firm has 12 AWS accounts in an organization and an existing AWS Direct Connect connection to a VPC. Employees must sign in to the AWS access portal with their existing AD credentials, authentication must be performed by the on-premises domain controllers, and password hashes must not be replicated to AWS. Which combination of steps will meet these requirements with the LEAST operational overhead? (Choose TWO)

- A. Create an AD Connector directory in the VPC that forwards authentication requests to the on-premises domain controllers over the Direct Connect connection
- B. Deploy AWS Managed Microsoft AD in the VPC and create a two-way forest trust with the on-premises domain controllers over the Direct Connect connection
- C. Configure AWS IAM Identity Center to use the AD Connector directory as its identity source and assign permission sets to AD groups for the 12 accounts
- D. Deploy AWS Managed Microsoft AD in the VPC and migrate the employee accounts with their password hashes so that authentication works when the data center is offline
- E. Configure AWS IAM Identity Center to use AWS Managed Microsoft AD as its identity source and assign permission sets to AD groups for the 12 accounts

**Answer:** A, C

**Explanation:** AD Connector is a directory gateway that redirects sign-in requests to the on-premises domain controllers without caching credentials in AWS, and IAM Identity Center can use it as the identity source for permission sets.
- Managed Microsoft AD with a forest trust: works, but adds a directory and a trust to run and pay for (tốn vận hành hơn)
- Managed Microsoft AD with migrated password hashes: replicates credentials to AWS (vi phạm ràng buộc)
- Identity Center with Managed Microsoft AD as the source: depends on that extra directory and trust (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/singlesignon/latest/userguide/manage-your-identity-source-ad.html
> 🇻🇳 AD tại chỗ + không sao chép mật khẩu + ít vận hành → AD Connector làm identity source cho IAM Identity Center.
---

## Q ai-20261022-a11-12
- domain: secure
- task: 1.1
- topic: security
- services: RDS, EC2
- tags: shared-responsibility
- difficulty: easy
- time: 85
- skills: 1.1.k5
- concept: On managed RDS AWS runs the host and engine patching, while the customer still controls network access and database users
- refs: A-nen-tang-kien-truc.md, 03-database-services.md
- hint: Khi chuyển sang dịch vụ được quản lý, phần nào nằm "trong" đám mây vẫn thuộc về bạn: truy cập mạng và tài khoản database.
- created: 2026-10-22
- enriched: 2026-10-22

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
- time: 140
- skills: 1.1.s1, 1.1.s4, 1.1.k1
- concept: Centralized root access management removes member-account root credentials and offers short-term privileged root sessions
- refs: 05-security-services.md, 06-management-governance.md
- hint: Cần xoá hẳn thông tin đăng nhập root của 300 tài khoản thành viên mà vẫn làm được vài tác vụ chỉ root làm được — không vào từng tài khoản.
- created: 2026-10-22
- enriched: 2026-10-22

A company has 300 member accounts in AWS Organizations. Many were created years ago and have root user passwords and MFA devices that nobody tracks. The security team wants to remove the root user credentials in the member accounts so that nobody can sign in as root or recover the root password. The team must still be able to perform rare root-only tasks, such as deleting an Amazon S3 bucket policy that denies all principals, and does not want to visit each account. What should a solutions architect do?

- A. Register a FIDO2 security key as the root user's MFA device in each member account and keep the keys in a safe for the rare root-only tasks
- B. Enable centralized root access management in Organizations, delete the root credentials of member accounts, and run root-only tasks in short-term root sessions
- C. Attach an SCP that denies actions by member-account root users, and use OrganizationAccountAccessRole from the management account for the root-only tasks
- D. Enable centralized root access management, delete member root credentials, and enable root password recovery for any account in which a root-only task arises

**Answer:** B

**Explanation:** Centralized root access management lets the management account or a delegated administrator delete member accounts' root credentials and run privileged actions, such as deleting a bucket policy that denies everyone, in short-term root sessions.
- FIDO2 key per member account: the root credentials stay in place and 300 devices must be guarded (vi phạm ràng buộc)
- SCP plus OrganizationAccountAccessRole: root credentials remain, and that role cannot perform root-only tasks (vi phạm ràng buộc)
- Enabling root password recovery: lets someone regain root credentials and sign in to the account (vi phạm ràng buộc)
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
- time: 135
- skills: 1.1.s2, 1.1.k4
- concept: Delegated role creation is limited by requiring the permissions boundary through the iam:PermissionsBoundary condition key
- refs: 05-security-services.md
- hint: Boundary đặt trên chính nhà phát triển không tự truyền sang role họ tạo — điều kiện nào buộc mọi role mới phải mang boundary?
- created: 2026-10-22
- enriched: 2026-10-22

A company lets application developers create IAM roles for their AWS Lambda functions in a development account so that teams do not wait for the central security team. The security team worries about privilege escalation, because a developer could create a role with AdministratorAccess and use it. Developers must be allowed to create roles and attach policies, but every role they create must never exceed an approved set of permissions, and developers must not be able to lift that limit. Which solution will meet these requirements?

- A. Attach an SCP that denies attaching administrative AWS managed policies, such as AdministratorAccess, to any role in the development account
- B. Set the approved boundary policy as the permissions boundary of the developers' own IAM identities so that the roles they create inherit the same limit automatically
- C. Allow iam:CreateRole and iam:AttachRolePolicy for developers only when iam:PermissionsBoundary equals the approved boundary, and deny actions that remove it
- D. Run IAM Access Analyzer custom policy checks in the deployment pipeline to reject role policies that grant more than the approved permissions

**Answer:** C

**Explanation:** Conditioning the developers' IAM permissions on iam:PermissionsBoundary forces every new role to carry the approved boundary, which caps its permissions whatever policies are attached, and an explicit deny on removing the boundary keeps the limit in place.
- SCP blocking administrative managed policies: developers can still write an inline or custom policy with broad access (vi phạm ràng buộc)
- Boundary on the developers' own identities: it limits the developers, not the roles they create (dùng sai tính năng)
- Access Analyzer checks in the pipeline: developers can create roles directly in IAM and bypass the pipeline (vi phạm ràng buộc)
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
- time: 135
- skills: 1.1.k3, 1.1.k2
- concept: IAM is global while KMS keys and security groups are Regional resources that must exist in each Region
- refs: A-nen-tang-kien-truc.md, 05-security-services.md
- hint: Tài nguyên toàn cầu dùng lại được ở mọi Region, còn tài nguyên theo Region phải tạo lại — hãy phân loại từng loại.
- created: 2026-10-22
- enriched: 2026-10-22

A company runs production workloads in Europe (Ireland) and is building a disaster recovery environment in Asia Pacific (Sydney). It uses IAM roles with customer managed policies, AWS KMS customer managed keys to encrypt Amazon EBS volumes, and security groups for its instances. An architect must determine which of these security resources have to be created again for the new Region. Which combination of actions is required? (Choose TWO)

- A. Create a customer managed AWS KMS key in the Sydney Region to encrypt the EBS volumes of the recovery instances
- B. Recreate the IAM roles in the Sydney Region and give them access to the KMS key that encrypts the EBS volumes
- C. Copy the encrypted EBS snapshots to Sydney and encrypt the copies with the existing customer managed KMS key from the Ireland Region
- D. Reference the existing Ireland security groups from the Sydney recovery instances through an inter-Region VPC peering connection
- E. Create security groups for the recovery instances in the Sydney Region and reference them in the launch settings

**Answer:** A, E

**Explanation:** KMS keys and security groups belong to one Region, so Sydney needs its own key and its own security groups. IAM roles and policies are global, so the existing roles can be used by resources in any Region.
- Recreating the IAM roles: IAM is global and the roles already work in Sydney (đặt sai chỗ)
- Encrypting the Sydney copies with the Ireland key: a KMS key works only in its own Region (đặt sai chỗ)
- Referencing Ireland security groups over inter-Region peering: security group references do not work across Regions (đặt sai chỗ)
Docs: https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/global-services.html
> 🇻🇳 IAM là dịch vụ toàn cầu (dùng ở mọi Region); KMS key và security group theo Region nên phải tạo lại.