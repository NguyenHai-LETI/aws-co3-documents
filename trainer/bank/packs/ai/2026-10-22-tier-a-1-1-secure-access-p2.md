---
pack: ai-2026-10-22-tier-a-1-1-p2
title: "AI · Tầng A · Task 1.1 (p2) — Đa tài khoản, SCP/RCP, resource policy, least privilege"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 1.1"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 1.1, phần 2"
---

# AI · Tầng A · Task 1.1 (p2) — Đa tài khoản, SCP/RCP, resource policy, least privilege

## Q ai-20261022-a11-16
- domain: secure
- task: 1.1
- topic: security
- services: IAM, STS
- tags: federation, oidc, iam-roles, least-privilege
- difficulty: medium
- skills: 1.1.k2, 1.1.s3, 1.1.k4
- concept: An IAM OIDC identity provider lets an external CI platform assume a scoped role with temporary credentials instead of long-term keys
- refs: 05-security-services.md
- hint: Pipeline ngoài AWS cần bỏ khóa dài hạn và chỉ cho đúng repository/nhánh — cơ chế federation nào cấp credential tạm?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 125

A company's deployment pipeline runs on GitHub Actions, outside AWS. The pipeline currently deploys to an AWS account with an IAM user's access key stored as a repository secret. A security audit requires removing long-term credentials from the pipeline, and the deployment permissions must be usable only by workflows that run from one specific repository and its main branch. Which solution will meet these requirements with the LEAST operational overhead?

- A. Rotate the IAM user's access key every 30 days with an AWS Secrets Manager rotation function that updates the repository secret for each branch through the GitHub API
- B. Create an IAM Roles Anywhere trust anchor and issue an X.509 client certificate to each workflow runner, stored in the repository as an encrypted secret and renewed on a schedule
- C. Create an IAM OIDC identity provider for the GitHub token issuer and a role whose trust policy accepts tokens only when the subject claim matches the repository and branch
- D. Create an Amazon Cognito identity pool with unauthenticated access enabled and attach an IAM role that grants the deployment permissions to the guest identities

**Answer:** C

**Explanation:** The OIDC provider lets the workflow exchange its signed token for temporary credentials, and conditions on the subject claim in the role's trust policy limit the role to one repository and branch, so no long-term key exists.
- Rotating the IAM user key: the pipeline still holds a long-term credential (vi phạm ràng buộc)
- Roles Anywhere with certificates per runner: needs certificate issuance and renewal plus a long-lived private key secret (tốn vận hành hơn)
- Identity pool with guest access: any caller could obtain the deployment role (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html
> 🇻🇳 CI bên ngoài AWS bỏ access key → IAM OIDC provider + role có điều kiện claim sub (repo/nhánh).
---

## Q ai-20261022-a11-17
- domain: secure
- task: 1.1
- topic: security
- services: AWS Artifact, AWS Config
- tags: shared-responsibility, compliance
- difficulty: medium
- skills: 1.1.k5, 1.1.k4
- concept: Shared responsibility evidence: AWS Artifact for AWS-side attestations, AWS Config conformance packs for the customer's own configuration
- refs: A-nen-tang-kien-truc.md, B-bao-mat-compliance.md
- hint: Một bằng chứng thuộc "bảo mật của đám mây" (phía AWS), một bằng chứng thuộc "bảo mật trong đám mây" (phía bạn) — công cụ nào cho từng loại?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A company is preparing for a PCI DSS assessment. The assessors ask for two kinds of evidence: independent attestations covering the physical data centers and the AWS-managed infrastructure, and continuous evidence that the company's own Amazon S3 buckets and security groups meet the required configuration standards. The company wants to produce this evidence with the LEAST operational overhead. Which combination of actions will meet these requirements? (Choose TWO)

- A. Open an AWS Support case that asks AWS to inspect the company's account configuration and issue an attestation that its S3 bucket and security group settings meet PCI DSS
- B. Download the AWS PCI DSS attestation of compliance and the related audit reports from AWS Artifact on demand at no charge
- C. Run Amazon Inspector scans against the AWS data center hosts to generate evidence about the infrastructure that AWS manages
- D. Deploy an AWS Config conformance pack that evaluates the company's S3 buckets and security groups against the required configuration rules
- E. Schedule an on-site audit with the company's assessors at an AWS data center to inspect the physical access controls required by PCI DSS

**Answer:** B, D

**Explanation:** AWS Artifact provides on-demand compliance reports for the infrastructure AWS secures, and a Config conformance pack continuously evaluates the customer's own resources, which are the customer's side of the shared responsibility model.
- AWS Support certifying the account: configuration of customer resources is the customer's responsibility (đặt sai chỗ)
- Inspector scans of AWS hosts: Inspector assesses the customer's own workloads, not AWS infrastructure (dùng sai tính năng)
- On-site data center audit: AWS shares independent audit reports instead of customer inspections (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/artifact/latest/ug/what-is-aws-artifact.html
> 🇻🇳 Bằng chứng phía AWS → AWS Artifact; bằng chứng cấu hình phía khách hàng → AWS Config conformance pack.

---

## Q ai-20261022-a11-18
- domain: secure
- task: 1.1
- topic: security
- services: IAM
- tags: least-privilege, access-analyzer, policy-generation
- difficulty: easy
- skills: 1.1.k4
- concept: IAM Access Analyzer generates a least-privilege policy from the CloudTrail activity of a role
- refs: 05-security-services.md
- hint: Role đã chạy hai tháng với quyền quản trị — công cụ nào dựng chính sách chỉ gồm các hành động thực sự được gọi, dựa trên log?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 105

An application's IAM role was created with the AdministratorAccess managed policy during development. The application has now run in production for two months, and AWS CloudTrail is logging management events for the account. The security team must replace the role's permissions with a policy that grants only the actions the application actually used. The team wants to do this with the LEAST manual effort. Which solution will meet these requirements?

- A. Use IAM Access Analyzer to generate a policy from the role's CloudTrail activity, review it, and attach it in place of AdministratorAccess
- B. Use IAM Access Advisor to read the services the role last accessed and write a new policy by hand that lists every action for each of those services
- C. Attach a permissions boundary that allows just the services in the Access Advisor report and keep AdministratorAccess attached to the role
- D. Use the IAM policy simulator to replay the CloudTrail events of the role and add the actions that succeed to a new policy

**Answer:** A

**Explanation:** IAM Access Analyzer reviews the role's CloudTrail events over a chosen period and generates a policy template with the permissions actually used, which can be reviewed and attached instead of the broad managed policy.
- Access Advisor and a hand-written policy: shows last-accessed services, but writing the policy stays manual (tốn vận hành hơn)
- Boundary with AdministratorAccess kept: caps by service only, so actions inside those services stay broad (giải bài toán khác)
- Policy simulator: tests how a policy evaluates, not what the application used (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html
> 🇻🇳 Thu hẹp quyền theo hành vi thực tế → IAM Access Analyzer policy generation (dựa trên CloudTrail).
---

## Q ai-20261022-a11-19
- domain: secure
- task: 1.1
- topic: security
- services: IAM, IAM Identity Center
- tags: abac, tagging, iam-policies, least-privilege
- difficulty: hard
- time: 160
- skills: 1.1.s2
- concept: Attribute-based access control matches principal tags to resource tags so one policy scales to many projects
- refs: 05-security-services.md
- hint: Sáu mươi dự án, thêm mới mỗi tuần mà không viết policy mới — cần một điều kiện tự mở rộng theo dự án thay vì liệt kê từng tài nguyên.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company runs 60 projects in one AWS account. Each project team may start, stop and tag only the Amazon EC2 instances that belong to its own project. Engineers sign in through IAM Identity Center, and new projects are created every week. The security team wants to avoid writing and updating a separate IAM policy for every project. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create one identity policy that allows the EC2 actions only when the Project tag on the instance equals the Project tag of the calling principal
- B. Create a customer managed identity policy for each project that lists the ARNs of the instances that carry the project's tag and attach it to the project's group
- C. Create a permissions boundary for each project that lists the project's instance IDs and attach it to the identity of every engineer
- D. Attach a resource-based policy to each EC2 instance that names the engineer roles allowed to manage it
- E. Tag every instance with a Project tag and pass each engineer's project to the session as an attribute for access control

**Answer:** A, E

**Explanation:** Attribute-based access control compares the Project tag of the resource with the Project tag of the principal in one policy, and Identity Center passes the engineer's project attribute into the session, so a new project needs only correct tags and no new policy.
- One policy per project: a new policy to create and attach each week (tốn vận hành hơn)
- Boundary per project: same per-project maintenance, and boundaries only cap permissions (tốn vận hành hơn)
- Resource-based policy on instances: EC2 instances do not support resource-based policies (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction_attribute-based-access-control.html
> 🇻🇳 Nhiều dự án, thêm liên tục → ABAC: một policy so khớp aws:PrincipalTag với thẻ tài nguyên.

---

## Q ai-20261022-a11-20
- domain: secure
- task: 1.1
- topic: management
- services: Organizations
- tags: scp, allow-list, multi-account
- difficulty: hard
- time: 160
- skills: 1.1.s4, 1.1.k1
- concept: An SCP allow list works only when FullAWSAccess is replaced at that level; deny lists leave future services open
- refs: 06-management-governance.md
- hint: Đề chặn cả dịch vụ AWS ra mắt sau này — SCP kiểu allow hay deny làm được, và SCP mặc định đang gắn ở OU ảnh hưởng thế nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company has 20 sandbox accounts in a Sandbox OU. The sandbox accounts must be able to use only Amazon EC2, Amazon S3 and AWS Lambda, and no other AWS service, including services that AWS launches in the future, even if a sandbox administrator attaches AdministratorAccess to a user. The organization has all features enabled, and the default FullAWSAccess SCP is attached to the root, the Sandbox OU and every account. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create a permissions boundary that allows the three services and attach it to each sandbox administrator
- B. Create an SCP that allows only the ec2:*, s3:* and lambda:* actions and attach it to the Sandbox OU for the 20 sandbox accounts
- C. Attach the new SCP to the management account, keeping FullAWSAccess in place, so that it restricts the sandbox accounts through the hierarchy
- D. Create an SCP that denies every other AWS service by name, leaving EC2, S3 and Lambda untouched, and attach it to the Sandbox OU
- E. Detach the FullAWSAccess SCP from the Sandbox OU so that the allow list is the only policy granting access at that level

**Answer:** B, E

**Explanation:** For an allow list, an Allow for the three services must exist at every level and FullAWSAccess must be removed where the list is applied, or the OU still allows everything. As an SCP, it caps even an AdministratorAccess user.
- Permissions boundary per administrator: covers only identities that carry it (tốn vận hành hơn)
- SCP on the management account: SCPs do not affect the management account or other accounts through it (đặt sai chỗ)
- Deny list by service name: services launched later are not denied (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_evaluation.html
> 🇻🇳 Allow-list SCP: gỡ FullAWSAccess ở cấp đó và gắn SCP chỉ cho phép dịch vụ cần dùng; deny-list bỏ sót dịch vụ mới.
---

## Q ai-20261022-a11-21
- domain: secure
- task: 1.1
- topic: management
- services: Organizations, S3
- tags: rcp, data-perimeter, scp
- difficulty: hard
- skills: 1.1.s4, 1.1.s5, 1.1.k1
- concept: A resource control policy restricts access to resources in member accounts by principals outside the organization, which SCPs cannot do
- refs: 05-security-services.md, 06-management-governance.md
- hint: Cần chặn principal bên ngoài tổ chức truy cập bucket kể cả khi dev tự thêm bucket policy — SCP chỉ kiểm soát principal bên trong.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A company stores sensitive datasets in Amazon S3 buckets across 80 member accounts in AWS Organizations. Developers sometimes write bucket policies with overly broad principals. The security team must guarantee that principals outside the organization can never read objects in any bucket of the member accounts, even if a developer later adds a bucket policy that grants an external account access. AWS services that read the buckets on behalf of the organization must keep working, and individual buckets must not need changes. Which solution will meet these requirements?

- A. Attach a service control policy to the organization root that denies S3 actions when the request comes from a principal outside the organization's accounts
- B. Enable S3 Block Public Access on every bucket and at the account level in each member account so that external accounts lose access
- C. Enable IAM Access Analyzer with the organization as the zone of trust and send external access findings to an Amazon SNS topic for review
- D. Attach a resource control policy to the root that denies S3 actions unless aws:PrincipalOrgID matches, excepting AWS service principals

**Answer:** D

**Explanation:** A resource control policy sets the maximum access to resources in member accounts for any caller, including outsiders, so it overrides a later bucket policy. The organization ID condition and the service exception keep internal access working.
- SCP on the root: affects only principals in the organization's accounts, not external callers (dùng sai tính năng)
- Block Public Access: stops public access, but a grant to one external account is not public (giải bài toán khác)
- Access Analyzer findings: detects external access afterward and does not prevent it (giải bài toán khác)
Docs: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_rcps.html
> 🇻🇳 Chặn principal ngoài tổ chức truy cập tài nguyên → RCP (aws:PrincipalOrgID); SCP chỉ giới hạn principal bên trong.
---

## Q ai-20261022-a11-22
- domain: secure
- task: 1.1
- topic: security
- services: IAM, S3, DynamoDB, Lambda
- tags: resource-based-policies, cross-account-access
- difficulty: medium
- skills: 1.1.s5, 1.1.s3
- concept: A resource-based policy grants cross-account access without the caller giving up its own permissions, unlike assuming a role
- refs: 05-security-services.md
- hint: Hàm Lambda phải đọc ở tài khoản A và ghi ở tài khoản B trong cùng một lần chạy — cách nào không bắt đổi danh tính?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 125

An AWS Lambda function in account B reads objects from an Amazon S3 bucket in account A and writes the results to an Amazon DynamoDB table in account B during the same invocation. The objects must stay in account A, and the developers do not want to add code that switches credentials between the two accounts. The function should keep using its existing execution role. Which solution will meet these requirements with the LEAST code change?

- A. Create an IAM role in account A that trusts account B and update the function code to call sts:AssumeRole with its execution role before each read, then switch back for the write
- B. Add a bucket policy in account A that allows the function's execution role in account B to read the objects, and allow the action in the role's policy
- C. Create an IAM user in account A with read access to the bucket and store its access key in the function's environment variables
- D. Create a replication rule that copies the objects to a bucket in account B and change the function to read from the replica

**Answer:** B

**Explanation:** A resource-based policy names the principal from the other account, which keeps its own credentials, and cross-account access also needs an allow in the caller's identity policy. No role switching.
- Assume a role in account A: the function gives up its own permissions while using the role, so code must switch back (tốn vận hành hơn)
- IAM user with an access key: long-term credentials in the function (vi phạm ràng buộc)
- Replicating to account B: the objects would no longer stay only in account A (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies-cross-account-resource-access.html
> 🇻🇳 Truy cập chéo tài khoản không đổi danh tính → resource-based policy (bucket policy) + quyền ở identity policy của người gọi.
---

## Q ai-20261022-a11-23
- domain: secure
- task: 1.1
- topic: security
- services: S3, SQS, IAM
- tags: resource-based-policies, confused-deputy
- difficulty: hard
- time: 135
- skills: 1.1.s5
- concept: S3 event notifications to SQS use the queue's resource policy for the S3 service principal, scoped with aws:SourceArn and aws:SourceAccount
- refs: 05-security-services.md, 07-application-integration.md
- hint: S3 giao thông báo với tư cách gì — và điều kiện nào ngăn bucket của tài khoản khác dùng hàng đợi (confused deputy)?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company configures Amazon S3 event notifications so that a bucket sends messages to an Amazon SQS queue in the same account. The configuration fails validation because the queue's access policy has no statements. The security team also requires that only this specific bucket can send messages to the queue, and that buckets in other accounts cannot use the queue even if they name it as a destination. Which solution will meet these requirements?

- A. Attach an identity policy to the IAM user who configures the notification that allows sqs:SendMessage on the queue, and let S3 use that user's permissions at delivery time
- B. Create an IAM role that allows sqs:SendMessage and name the role as the notification role in the bucket's notification configuration so S3 assumes it
- C. Add a statement to the queue's access policy that allows the s3.amazonaws.com service principal to call sqs:SendMessage, with aws:SourceArn and aws:SourceAccount conditions
- D. Add a statement to the queue's access policy that allows the s3.amazonaws.com service principal to call sqs:SendMessage on the queue without adding any conditions

**Answer:** C

**Explanation:** S3 delivers notifications as a service principal, so the destination queue's resource-based policy must allow it. The aws:SourceArn and aws:SourceAccount conditions restrict delivery to this bucket and account and prevent the confused deputy problem.
- Identity policy for the configuring user: the user's permissions are not used when S3 delivers messages (dùng sai tính năng)
- Notification role: S3 notifications to SQS have no role setting (cấu hình không tồn tại)
- Service principal without conditions: any bucket, including other accounts', could send to the queue (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/grant-destinations-permissions-to-s3.html
> 🇻🇳 S3 → SQS: queue policy cho principal s3.amazonaws.com + điều kiện aws:SourceArn/SourceAccount để chống confused deputy.

---

## Q ai-20261022-a11-24
- domain: secure
- task: 1.1
- topic: security
- services: S3, IAM, Organizations
- tags: resource-based-policies, cross-account-access, aws-principalorgid
- difficulty: medium
- skills: 1.1.s5, 1.1.k1
- family: s3-data-lake-org-access
- concept: Qualifier reading: aws:PrincipalOrgID in a bucket policy minimizes operations, naming approved roles gives the tightest control
- refs: 05-security-services.md
- hint: Tài khoản mới tạo mỗi tuần và không muốn sửa policy mỗi lần — điều kiện nào theo ID của tổ chức?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A company keeps a central data lake in an Amazon S3 bucket owned by a data platform account in AWS Organizations. About 150 analytics accounts in the same organization read from the bucket through application roles, and new analytics accounts are created every week. The data must never be readable by principals outside the company. Which solution will meet these requirements with the LEAST operational overhead?

- A. Add a bucket policy statement that allows read access to principals of the organization through aws:PrincipalOrgID, and let each account grant access to its own roles
- B. Add a bucket policy statement that lists the ARN of every approved analytics role as a principal, and update the statement whenever a role needs access
- C. Create an IAM user in the data platform account for every analytics account of the organization and share its access keys with that account's administrators through AWS Secrets Manager
- D. Enable S3 ACLs on the bucket and grant READ permission to the canonical user ID of each analytics account so that its roles can read, then remove the bucket policy

**Answer:** A

**Explanation:** One bucket policy statement keyed on aws:PrincipalOrgID covers every current and future account in the organization and excludes outsiders, so new analytics accounts need no change to the bucket policy.
- Listing every approved role: precise, but the statement changes for each new account or role (tốn vận hành hơn)
- IAM users with shared keys: long-term credentials to create and distribute per account (tốn vận hành hơn)
- S3 ACLs per canonical user ID: ACLs are disabled by default on new buckets and grant whole accounts (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html#condition-keys-principalorgid
> 🇻🇳 Ít vận hành nhất khi tài khoản tăng liên tục → bucket policy với aws:PrincipalOrgID thay vì liệt kê từng role.
---

## Q ai-20261022-a11-25
- domain: secure
- task: 1.1
- topic: security
- services: S3, IAM, Organizations
- tags: resource-based-policies, cross-account-access, least-privilege
- difficulty: medium
- time: 130
- skills: 1.1.s5, 1.1.k4
- family: s3-data-lake-org-access
- concept: Qualifier reading: aws:PrincipalOrgID in a bucket policy minimizes operations, naming approved roles gives the tightest control
- refs: 05-security-services.md
- hint: Đề hỏi kiểm soát chặt nhất việc role nào được đọc — phương án nào chỉ định rõ từng role được phê duyệt?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company keeps a central data lake in an Amazon S3 bucket owned by a data platform account in AWS Organizations. About 150 analytics accounts in the same organization read from the bucket through application roles, and new analytics accounts are created every week. The data must never be readable by principals outside the company. Which solution will meet these requirements and give the data platform team the TIGHTEST control over exactly which roles can read the data?

- A. Add a bucket policy statement that allows read access to principals of the organization through aws:PrincipalOrgID, and let each account grant access to its own roles
- B. Add a bucket policy statement that lists the ARN of every approved analytics role as a principal, and update the statement whenever a role needs access
- C. Create an IAM user in the data platform account for every analytics account of the organization and share its access keys with that account's administrators through AWS Secrets Manager
- D. Enable S3 ACLs on the bucket and grant READ permission to the canonical user ID of each analytics account so that its roles can read, then remove the bucket policy

**Answer:** B

**Explanation:** Naming each approved role in the bucket policy means only those roles can be granted access, whatever an account administrator attaches in their own account, the tightest least-privilege control at the resource.
- Organization-wide condition: any role in the organization can be granted access by its own administrator (giải bài toán khác)
- IAM users with shared keys: control is per account, not per role, and every holder of the key can read (giải bài toán khác)
- S3 ACLs per canonical user ID: grants to whole accounts, and ACLs are disabled by default (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies-cross-account-resource-access.html
> 🇻🇳 Kiểm soát chặt nhất role nào được đọc → bucket policy liệt kê từng role được duyệt (đánh đổi: tốn vận hành hơn).
---

## Q ai-20261022-a11-26
- domain: secure
- task: 1.1
- topic: security
- services: IAM, STS
- tags: cross-account-access, external-id, confused-deputy
- difficulty: medium
- skills: 1.1.s3
- concept: A third-party cross-account role should require a vendor-generated external ID to prevent the confused deputy problem
- refs: 05-security-services.md
- hint: Nhà cung cấp phục vụ hàng trăm khách hàng dùng chung tài khoản AWS — giá trị nào trong trust policy ngăn khách khác lợi dụng?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 130

A company hires a SaaS vendor to analyze its AWS costs. The vendor serves hundreds of customers and reaches each customer account by assuming a cross-account IAM role. The security team wants the vendor to be able to assume the company's role only when acting on the company's behalf, so that another customer of the vendor cannot trick the vendor's service into accessing the company's account. The solution must not share long-term credentials. Which solution will meet these requirements?

- A. Create an IAM user for the vendor with read-only permissions and MFA, and send the access key to the vendor through encrypted email, rotating the key each quarter by hand
- B. Create an IAM role that trusts the vendor's AWS account and add an aws:SourceIp condition to the trust policy that lists the vendor's published public IP ranges
- C. Attach an SCP to the company's account that denies sts:AssumeRole unless the caller belongs to the vendor's AWS account and presents a valid MFA code with each request
- D. Create an IAM role that trusts the vendor's AWS account and requires a unique external ID, generated by the vendor for the company, in the sts:ExternalId condition

**Answer:** D

**Explanation:** The vendor passes the external ID unique to this customer when it assumes the role, so a request made for another customer lacks the right ID and is rejected, preventing the confused deputy problem.
- IAM user and emailed key: long-term credentials (vi phạm ràng buộc)
- Source IP condition: the vendor's IP ranges are shared by its customers and do not identify one (giải bài toán khác)
- SCP on the company's account: SCPs do not apply to principals outside the organization, and cannot grant access (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios_third-party.html
> 🇻🇳 Bên thứ ba truy cập chéo tài khoản → role + trust policy với sts:ExternalId duy nhất cho từng khách hàng (chống confused deputy).

---

## Q ai-20261022-a11-27
- domain: secure
- task: 1.1
- topic: management
- services: Control Tower, Organizations
- tags: control-tower, account-factory, guardrails, multi-account
- difficulty: medium
- skills: 1.1.s4, 1.1.k1
- concept: AWS Control Tower provides a landing zone, Account Factory and preventive controls with the least effort
- refs: 06-management-governance.md
- hint: Tạo tài khoản tự phục vụ, tự cài logging và vai trò nền, kế thừa guardrail — đội cloud nhỏ nên chọn dịch vụ dựng sẵn nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A company is starting its multi-account strategy and expects to create about five new accounts each month for product teams. Each new account must be created through a self-service process, be placed in the correct OU, receive centralized logging and baseline security roles automatically, and inherit preventive controls that stop users from disabling logging. The cloud team is small. Which solution will meet these requirements with the LEAST operational overhead?

- A. Create the accounts with the Organizations API and maintain a CloudFormation StackSet that the cloud team customizes to deploy logging, baseline roles and preventive controls through each new account
- B. Ask product teams to create standalone AWS accounts, invite them into the organization, and apply a one-time AWS Config conformance pack as a detective control
- C. Set up an AWS Control Tower landing zone and let product teams request accounts through Account Factory, with the preventive controls enabled on the OUs
- D. Use AWS Service Catalog to provision IAM roles and S3 buckets for each product team inside one shared account and attach an SCP to that account

**Answer:** C

**Explanation:** Control Tower builds the landing zone with centralized logging, vends accounts through Account Factory into the right OU with the baseline applied, and enforces preventive controls implemented as SCPs, so the small team writes almost no automation.
- Custom Organizations API and StackSets: achieves the same, but the team builds and maintains the automation (tốn vận hành hơn)
- Standalone accounts and a one-time conformance pack: not self-service vending, and no preventive control (vi phạm ràng buộc)
- Service Catalog in one shared account: gives no new accounts or account-level isolation (giải bài toán khác)
Docs: https://docs.aws.amazon.com/controltower/latest/userguide/what-is-control-tower.html
> 🇻🇳 Landing zone + Account Factory + control phòng ngừa với ít vận hành nhất → AWS Control Tower.
