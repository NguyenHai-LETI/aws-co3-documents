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
- time: 120
- skills: 1.1.k2, 1.1.s3, 1.1.k4
- concept: An IAM OIDC identity provider lets an external CI platform assume a scoped role with temporary credentials instead of long-term keys
- refs: 05-security-services.md
- hint: Pipeline ngoài AWS cần bỏ khóa dài hạn và chỉ cho đúng repository/nhánh — cơ chế federation nào cấp credential tạm?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company's deployment pipeline runs on GitHub Actions, outside AWS. The pipeline currently deploys to an AWS account with an IAM user's access key stored as a repository secret. A security audit requires removing long-term credentials from the pipeline, and the deployment permissions must be usable only by workflows that run from one specific repository and its main branch. Which solution will meet these requirements with the LEAST operational overhead?

- A. Create an IAM OIDC identity provider for the GitHub token issuer and a role whose trust policy accepts tokens whose audience claim is sts.amazonaws.com
- B. Create an IAM Roles Anywhere trust anchor and issue an X.509 client certificate to each workflow runner, stored in the repository as an encrypted secret and renewed on a schedule
- C. Create an IAM OIDC identity provider for the GitHub token issuer and a role whose trust policy accepts tokens only when the subject claim matches the repository and branch
- D. Run self-hosted GitHub Actions runners on Amazon EC2 for the repository and branch, and let the deployment workflows use the instance profile's temporary credentials

**Answer:** C

**Explanation:** The OIDC provider lets the workflow exchange its signed token for temporary credentials, and a condition on the subject claim in the role's trust policy limits the role to one repository and branch, so no long-term key exists.
- Trust policy that checks the audience claim alone: any GitHub repository could assume the role (vi phạm ràng buộc)
- Roles Anywhere with certificates per runner: needs certificate issuance and renewal plus a private key secret (tốn vận hành hơn)
- Self-hosted runners on EC2: removes keys, but adds runner instances to patch and scale (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html
> 🇻🇳 CI bên ngoài AWS bỏ access key → IAM OIDC provider + role có điều kiện claim sub (repo/nhánh), không chỉ aud.
---

## Q ai-20261022-a11-17
- domain: secure
- task: 1.1
- topic: security
- services: AWS Artifact, AWS Config
- tags: shared-responsibility, compliance
- difficulty: medium
- time: 140
- skills: 1.1.k5, 1.1.k4
- concept: Shared responsibility evidence: AWS Artifact for AWS-side attestations, AWS Config conformance packs for the customer's own configuration
- refs: A-nen-tang-kien-truc.md, B-bao-mat-compliance.md
- hint: Một bằng chứng thuộc "bảo mật của đám mây" (phía AWS), một bằng chứng thuộc "bảo mật trong đám mây" (phía bạn) — công cụ nào cho từng loại?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company is preparing for a PCI DSS assessment. The assessors ask for two kinds of evidence: independent attestations covering the physical data centers and the AWS-managed infrastructure, and continuous evidence that the company's own Amazon S3 buckets and security groups meet the required configuration standards. The company wants to produce this evidence with the LEAST operational overhead. Which combination of actions will meet these requirements? (Choose TWO)

- A. Enable AWS Security Hub with the PCI DSS standard and export its findings as the attestation for the physical data centers and the AWS-managed infrastructure
- B. Download the AWS PCI DSS attestation of compliance and the related audit reports from AWS Artifact on demand at no charge
- C. Create an organization trail in AWS CloudTrail and give the assessors the logged API calls as evidence of the S3 bucket and security group configuration
- D. Deploy an AWS Config conformance pack that evaluates the company's S3 buckets and security groups against the required configuration rules
- E. Run an AWS Config advanced query that exports the current S3 bucket and security group configurations, and give the assessors that snapshot

**Answer:** B, D

**Explanation:** AWS Artifact provides on-demand compliance reports for the infrastructure AWS secures, and a Config conformance pack continuously evaluates the customer's own resources, which are the customer's side of the shared responsibility model.
- Security Hub PCI DSS findings: evaluate the company's resources, not AWS data centers or AWS-managed infrastructure (đặt sai chỗ)
- CloudTrail API history: shows who changed what, not whether resources meet the standard (giải bài toán khác)
- One-time Config advanced query: a point-in-time snapshot, not continuous evidence (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/artifact/latest/ug/what-is-aws-artifact.html
> 🇻🇳 Bằng chứng phía AWS → AWS Artifact; bằng chứng cấu hình liên tục phía khách hàng → AWS Config conformance pack.

---

## Q ai-20261022-a11-18
- domain: secure
- task: 1.1
- topic: security
- services: IAM
- tags: least-privilege, access-analyzer, policy-generation
- difficulty: easy
- time: 105
- skills: 1.1.k4
- concept: IAM Access Analyzer generates a least-privilege policy from the CloudTrail activity of a role
- refs: 05-security-services.md
- hint: Role đã chạy hai tháng với quyền quản trị — công cụ nào dựng chính sách chỉ gồm các hành động thực sự được gọi, dựa trên log?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

An application's IAM role was created with the AdministratorAccess managed policy during development. The application has now run in production for two months, and AWS CloudTrail is logging management events for the account. The security team must replace the role's permissions with a policy that grants only the actions the application actually used. The team wants to do this with the LEAST manual effort. Which solution will meet these requirements?

- A. Use IAM Access Analyzer to generate a policy from the role's CloudTrail activity, review it, and attach it in place of AdministratorAccess
- B. Use the IAM last accessed information to find the services the role used, and attach those services' AWS managed full-access policies in place of AdministratorAccess
- C. Query the role's CloudTrail events with Amazon Athena, list the distinct actions it called, and write a customer managed policy from the results
- D. Attach the AWS managed job function policy that best matches the application, such as PowerUserAccess, in place of AdministratorAccess

**Answer:** A

**Explanation:** IAM Access Analyzer reviews the role's CloudTrail events over a chosen period and generates a policy with the actions actually used, which can be reviewed and attached instead of the broad managed policy.
- Full-access policies for the last-accessed services: grant every action of those services, not just the ones used (vi phạm ràng buộc)
- Athena query and a hand-written policy: reaches the same result with more manual work (tốn vận hành hơn)
- Job function policy such as PowerUserAccess: still far broader than the actions used (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html
> 🇻🇳 Thu hẹp quyền theo hành vi thực tế, ít công nhất → IAM Access Analyzer policy generation (dựa trên CloudTrail).
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
- B. Create a customer managed policy for each project that allows EC2 actions when the instance's Project tag equals that project's name, and attach it to the project's group
- C. Create a permission set for each project in IAM Identity Center that allows EC2 actions on the instances that carry that project's tag
- D. Create an AWS Resource Groups group for every project from the Project tag and grant each engineer access to the instances in that group
- E. Tag every instance with a Project tag and pass each engineer's project to the session as an attribute for access control

**Answer:** A, E

**Explanation:** Attribute-based access control compares the Project tag of the resource with the Project tag of the principal in one policy, and Identity Center passes the engineer's project attribute into the session, so a new project needs only correct tags.
- Policy per project: a new policy to write and attach each week (tốn vận hành hơn)
- Permission set per project: the same weekly maintenance in Identity Center (tốn vận hành hơn)
- Resource Groups per project: groups organize resources but do not grant permissions (dùng sai tính năng)
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
- time: 165
- skills: 1.1.s4, 1.1.k1
- concept: An SCP allow list works only when FullAWSAccess is replaced at that level; deny lists leave future services open
- refs: 06-management-governance.md
- hint: Đề chặn cả dịch vụ AWS ra mắt sau này — SCP kiểu allow hay deny làm được, và SCP mặc định đang gắn ở OU ảnh hưởng thế nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company has 20 sandbox accounts in a Sandbox OU. The sandbox accounts must be able to use only Amazon EC2, Amazon S3 and AWS Lambda, and no other AWS service, including services that AWS launches in the future, even if a sandbox administrator attaches AdministratorAccess to a user. The organization has all features enabled, and the default FullAWSAccess SCP is attached to the root, the Sandbox OU and every account. Which combination of steps will meet these requirements? (Choose TWO)

- A. Attach the allow-list SCP to each of the 20 sandbox accounts and keep FullAWSAccess attached to the Sandbox OU and to the accounts
- B. Create an SCP that allows only the ec2:*, s3:* and lambda:* actions and attach it to the Sandbox OU for the 20 sandbox accounts
- C. Detach the FullAWSAccess SCP from the organization root so that the allow list is the policy that grants access above the accounts
- D. Create an SCP that denies every other AWS service by name, leaving EC2, S3 and Lambda untouched, and attach it to the Sandbox OU
- E. Detach the FullAWSAccess SCP from the Sandbox OU so that the allow list is the only policy granting access at that level

**Answer:** B, E

**Explanation:** For an allow list, an Allow for the three services must exist at every level, and FullAWSAccess must be removed where the list is applied, or that level still allows everything. As an SCP, it caps even an AdministratorAccess user.
- Allow list on each account with FullAWSAccess kept: FullAWSAccess still allows every service at each level (dùng sai tính năng)
- Detaching FullAWSAccess from the root: removes access for every account in the organization (giải bài toán khác)
- Deny list by service name: services launched later are not denied (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_evaluation.html
> 🇻🇳 Allow-list SCP: gỡ FullAWSAccess ở cấp OU đó và gắn SCP chỉ cho phép dịch vụ cần dùng; deny-list bỏ sót dịch vụ mới.
---

## Q ai-20261022-a11-21
- domain: secure
- task: 1.1
- topic: management
- services: Organizations, S3
- tags: rcp, data-perimeter, scp
- difficulty: hard
- time: 135
- skills: 1.1.s4, 1.1.s5, 1.1.k1
- concept: A resource control policy restricts access to resources in member accounts by principals outside the organization, which SCPs cannot do
- refs: 05-security-services.md, 06-management-governance.md
- hint: Cần chặn principal bên ngoài tổ chức truy cập bucket kể cả khi dev tự thêm bucket policy — SCP chỉ kiểm soát principal bên trong.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company stores sensitive datasets in Amazon S3 buckets across 80 member accounts in AWS Organizations. Developers sometimes write bucket policies with overly broad principals. The security team must guarantee that principals outside the organization can never read objects in any bucket of the member accounts, even if a developer later adds a bucket policy that grants an external account access. AWS services that read the buckets on behalf of the organization must keep working, and individual buckets must not need changes. Which solution will meet these requirements?

- A. Attach a service control policy to the organization root that denies S3 actions when the request comes from a principal outside the organization's accounts
- B. Attach an SCP to the root that denies s3:PutBucketPolicy to every principal except the security team's role in each member account
- C. Enable IAM Access Analyzer for the organization and run an automatic remediation that removes external principals from bucket policies when a finding appears
- D. Attach a resource control policy to the root that denies S3 actions unless aws:PrincipalOrgID matches, excepting AWS service principals

**Answer:** D

**Explanation:** A resource control policy sets the maximum access to resources in member accounts for any caller, including outsiders, so it overrides any bucket policy. The organization ID condition and the service exception keep internal access working.
- SCP on the root: affects principals in the organization's accounts, not external callers (dùng sai tính năng)
- SCP blocking PutBucketPolicy: stops new policies, but existing broad grants still let outsiders read (vi phạm ràng buộc)
- Access Analyzer with remediation: acts after access is granted and edits individual bucket policies (vi phạm ràng buộc)
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
- time: 125
- skills: 1.1.s5, 1.1.s3
- concept: A resource-based policy grants cross-account access without the caller giving up its own permissions, unlike assuming a role
- refs: 05-security-services.md
- hint: Hàm Lambda phải đọc ở tài khoản A và ghi ở tài khoản B trong cùng một lần chạy — cách nào không bắt đổi danh tính?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

An AWS Lambda function in account B reads objects from an Amazon S3 bucket in account A and writes the results to an Amazon DynamoDB table in account B during the same invocation. The objects must stay in account A, and the developers do not want to add code that switches credentials between the two accounts. The function should keep using its existing execution role. Which solution will meet these requirements with the LEAST code change?

- A. Create an IAM role in account A with read access that trusts the execution role, and have the function assume it through AWS STS before reading the objects
- B. Add a bucket policy in account A that allows the function's execution role in account B to read the objects, and allow the action in the role's policy
- C. Create an IAM role in account A with read access to the bucket and write access to the table, and configure it as the function's execution role
- D. Create a replication rule that copies the objects to a bucket in account B and change the function to read from the replica

**Answer:** B

**Explanation:** A bucket policy names the execution role from account B, which keeps its own credentials, and the role's identity policy also allows the read. Cross-account access needs both, and no credential switching is needed.
- Assuming a role in account A: the code must switch credentials between the read and the write (vi phạm ràng buộc)
- Role from account A as the execution role: a function's execution role must belong to the function's own account (đặt sai chỗ)
- Replicating to account B: copies the objects out of account A (vi phạm ràng buộc)
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

- A. Add a statement to the queue's access policy that allows the s3.amazonaws.com service principal to call sqs:SendMessage, with an aws:PrincipalOrgID condition for the organization
- B. Add a statement to the queue's access policy that allows the bucket owner's account root principal to call sqs:SendMessage on the queue
- C. Add a statement to the queue's access policy that allows the s3.amazonaws.com service principal to call sqs:SendMessage, with aws:SourceArn and aws:SourceAccount conditions
- D. Add a statement to the queue's access policy that allows the s3.amazonaws.com service principal to call sqs:SendMessage, with an aws:SourceAccount condition for the company's account

**Answer:** C

**Explanation:** S3 delivers notifications as a service principal, so the queue's resource-based policy must allow it. The aws:SourceArn condition limits delivery to this bucket and aws:SourceAccount to this account, preventing the confused deputy problem.
- aws:PrincipalOrgID condition: a service principal does not belong to the organization, so S3 deliveries are rejected (dùng sai tính năng)
- Account root principal: S3 sends messages as its service principal, not as the bucket owner's account (dùng sai tính năng)
- aws:SourceAccount alone: any other bucket in the account could send to the queue (vi phạm ràng buộc)
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
- time: 120
- skills: 1.1.s5, 1.1.k1
- family: s3-data-lake-org-access
- concept: Qualifier reading: aws:PrincipalOrgID in a bucket policy minimizes operations, naming approved roles gives the tightest control
- refs: 05-security-services.md
- hint: Tài khoản mới tạo mỗi tuần và không muốn sửa policy mỗi lần — điều kiện nào theo ID của tổ chức?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company keeps a central data lake in an Amazon S3 bucket owned by a data platform account in AWS Organizations. About 150 analytics accounts in the same organization read from the bucket through application roles, and new analytics accounts are created every week. The data must never be readable by principals outside the company. Which solution will meet these requirements with the LEAST operational overhead?

- A. Add a bucket policy statement that allows read access to principals of the organization through aws:PrincipalOrgID, and let each account grant access to its own roles
- B. Add a bucket policy statement that lists the ARN of every approved analytics role as a principal, and update the statement whenever a role needs access
- C. Add a bucket policy statement that allows read access to the root principal of every analytics account, and let each account grant access to its own roles
- D. Create an S3 access point for each analytics account of the organization whose policy allows that account, and delegate access control through the bucket policy

**Answer:** A

**Explanation:** One bucket policy statement keyed on aws:PrincipalOrgID covers every current and future account in the organization and excludes outsiders, so new analytics accounts need no bucket policy change.
- Listing every approved role: precise, but the statement changes for each new account or role (tốn vận hành hơn)
- Root principal of each account: the statement changes every week as accounts are added (tốn vận hành hơn)
- Access point per account: a new access point to create for each new account (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html#condition-keys-principalorgid
> 🇻🇳 Ít vận hành nhất khi tài khoản tăng liên tục → bucket policy với aws:PrincipalOrgID thay vì liệt kê từng account/role.
---

## Q ai-20261022-a11-25
- domain: secure
- task: 1.1
- topic: security
- services: S3, IAM, Organizations
- tags: resource-based-policies, cross-account-access, least-privilege
- difficulty: medium
- time: 125
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
- C. Add a bucket policy statement that allows read access to the root principal of every analytics account, and let each account grant access to its own roles
- D. Create an S3 access point for each analytics account of the organization whose policy allows that account, and delegate access control through the bucket policy

**Answer:** B

**Explanation:** Naming each approved role in the bucket policy means only those roles can be granted access, whatever an account administrator attaches in their own account, the tightest least-privilege control at the resource.
- Organization-wide condition: any role in the organization can be granted access by its own administrator (giải bài toán khác)
- Root principal of each account: each account's administrator decides which of its roles can read (giải bài toán khác)
- Access point per account: control is still per account, not per role (giải bài toán khác)
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
- time: 125
- skills: 1.1.s3
- concept: A third-party cross-account role should require a vendor-generated external ID to prevent the confused deputy problem
- refs: 05-security-services.md
- hint: Nhà cung cấp phục vụ hàng trăm khách hàng dùng chung tài khoản AWS — giá trị nào trong trust policy ngăn khách khác lợi dụng?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company hires a SaaS vendor to analyze its AWS costs. The vendor serves hundreds of customers and reaches each customer account by assuming a cross-account IAM role. The security team wants the vendor to be able to assume the company's role only when acting on the company's behalf, so that another customer of the vendor cannot trick the vendor's service into accessing the company's account. The solution must not share long-term credentials. Which solution will meet these requirements?

- A. Create an IAM role that trusts the vendor's AWS account and requires MFA through the aws:MultiFactorAuthPresent condition in the trust policy
- B. Create an IAM role that trusts the vendor's AWS account and add an aws:SourceIp condition to the trust policy that lists the vendor's published public IP ranges
- C. Create an IAM role whose trust policy names the vendor service's specific IAM role ARN as the principal instead of the vendor's whole account
- D. Create an IAM role that trusts the vendor's AWS account and requires a unique external ID, generated by the vendor for the company, in the sts:ExternalId condition

**Answer:** D

**Explanation:** The vendor passes the external ID unique to this customer when it assumes the role, so a request made for another customer lacks the right ID and is rejected, preventing the confused deputy problem.
- MFA condition: the vendor's automated service cannot present MFA, and MFA does not identify the customer (giải bài toán khác)
- Source IP condition: the vendor's IP ranges are shared by all its customers (giải bài toán khác)
- Vendor's specific role ARN: the same role serves every customer, so it can still be tricked (giải bài toán khác)
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
- time: 120
- skills: 1.1.s4, 1.1.k1
- concept: AWS Control Tower provides a landing zone, Account Factory and preventive controls with the least effort
- refs: 06-management-governance.md
- hint: Tạo tài khoản tự phục vụ, tự cài logging và vai trò nền, kế thừa guardrail — đội cloud nhỏ nên chọn dịch vụ dựng sẵn nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company is starting its multi-account strategy and expects to create about five new accounts each month for product teams. Each new account must be created through a self-service process, be placed in the correct OU, receive centralized logging and baseline security roles automatically, and inherit preventive controls that stop users from disabling logging. The cloud team is small. Which solution will meet these requirements with the LEAST operational overhead?

- A. Create the accounts with the Organizations API and maintain a CloudFormation StackSet that the cloud team customizes to deploy logging, baseline roles and preventive controls through each new account
- B. Have the cloud team create each account in the Organizations console, move it to the OU, and rely on the SCPs and organization trail inherited from the OU
- C. Set up an AWS Control Tower landing zone and let product teams request accounts through Account Factory, with the preventive controls enabled on the OUs
- D. Set up an AWS Control Tower landing zone and enroll the accounts that product teams create themselves, with detective controls enabled on the OUs

**Answer:** C

**Explanation:** Control Tower builds the landing zone with centralized logging, vends accounts through Account Factory into the right OU with the baseline applied, and enforces preventive controls, so the small team writes almost no automation.
- Organizations API with StackSets: achieves the same, but the team builds and maintains the automation (tốn vận hành hơn)
- Accounts created by the cloud team in the console: not a self-service process (vi phạm ràng buộc)
- Control Tower with detective controls: reports drift, but nothing stops users from disabling logging (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/controltower/latest/userguide/what-is-control-tower.html
> 🇻🇳 Landing zone + Account Factory (tự phục vụ) + control phòng ngừa với ít vận hành nhất → AWS Control Tower.
