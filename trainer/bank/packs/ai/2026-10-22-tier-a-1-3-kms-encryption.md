---
pack: ai-2026-10-22-tier-a-1-3
title: "AI · Tầng A · Task 1.3 — KMS, chính sách khoá và mã hoá dữ liệu"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 1.3"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 1.3: key policy, grants, xoay khoá, multi-Region key, ACM, mã hoá S3/EBS/RDS"
---

# AI · Tầng A · Task 1.3 — KMS, chính sách khoá và mã hoá dữ liệu

## Q ai-20261022-a13-01
- domain: secure
- task: 1.3
- topic: storage
- services: EBS, KMS
- tags: snapshots, cross-account-access, iam-policies
- difficulty: medium
- skills: 1.3.s4, 1.3.s2
- concept: Sharing an encrypted EBS snapshot needs a customer managed key (not aws/ebs), a key policy that admits the other account, and snapshot sharing
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Snapshot mã hoá bằng khoá do AWS quản lý không chia sẻ được — cần khoá nào và ai phải được phép dùng khoá đó?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 160

A software company encrypts the Amazon EBS volumes of its build servers with the default AWS managed key for Amazon EBS (aws/ebs). A customer in another AWS account must receive a point-in-time copy of one volume so that the customer can create its own volume from it. The customer's administrators will manage permissions for their own users, and the data must remain encrypted at all times. Which combination of steps should a solutions architect take? (Choose THREE)

- A. Share the original snapshot with the customer's account ID and ask the customer to re-encrypt it with its own KMS key
- B. Create a copy of the snapshot in the same Region and encrypt the copy with a customer managed KMS key
- C. Make the encrypted snapshot public by changing its permissions so that the customer can copy it into its own account
- D. Add a key policy statement that lets the customer's account decrypt with the customer managed key and create grants for volumes
- E. Modify the permissions of the encrypted copy so that it is shared with the customer's AWS account ID
- F. Edit the key policy of the aws/ebs key to add the customer's account as a principal that is allowed to decrypt volumes

**Answer:** B, D, E

**Explanation:** A snapshot encrypted with an AWS managed key cannot be shared, so the copy is re-encrypted with a customer managed key, that key's policy admits the customer's account, and the copy is then shared with the account ID.
- Sharing the original snapshot: snapshots encrypted with the default AWS managed key cannot be shared (vi phạm ràng buộc).
- Public snapshot: only unencrypted snapshots can be public (dùng sai tính năng).
- Editing the aws/ebs key policy: AWS managed key policies are immutable (cấu hình không tồn tại).
Docs: https://docs.aws.amazon.com/ebs/latest/userguide/ebs-modifying-snapshot-permissions.html
> 🇻🇳 Chia sẻ snapshot mã hoá: copy lại bằng CMK → cho tài khoản kia dùng CMK (key policy) → share snapshot; khoá aws/ebs không chia sẻ được.

---

## Q ai-20261022-a13-02
- domain: secure
- task: 1.3
- topic: security
- services: KMS, IAM
- tags: iam-policies, least-privilege
- difficulty: medium
- skills: 1.3.s4
- concept: A KMS key policy must enable IAM policies (account root statement) before identity policies can grant access to the key
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Khác các resource policy khác, key policy không tự cấp quyền cho tài khoản — IAM policy chỉ hiệu lực khi key policy cho phép điều đó.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 115

Developers created a customer managed KMS key by calling the CreateKey API with a custom key policy that grants permissions only to a DevOps role. Application roles in the same account have IAM policies that allow kms:Decrypt on the key ARN, but every decrypt call fails with AccessDenied. The company wants to manage application access to the key through IAM policies from now on. Which solution will meet these requirements with the LEAST operational overhead?

- A. Attach an IAM policy that allows kms:* on the key ARN to every application role, because IAM policies override a key policy that grants nothing
- B. Add a key policy statement that allows the account's root principal to perform kms:*, which lets IAM policies delegate access
- C. Create a grant for each application role by calling CreateGrant with the Decrypt operation, and retire the grants when roles change
- D. Add each application role as a principal with kms:Decrypt in the key policy and update that policy whenever a role is added

**Answer:** B

**Explanation:** The root-principal statement enables IAM policies for the account, so the existing identity policies take effect and future access is managed in IAM without touching the key policy again.
- Broader IAM policy: without that key policy statement, IAM allows are ineffective, so access is still denied (dùng sai tính năng).
- Grants per role: works but is not IAM-based and needs one call per role (tốn vận hành hơn).
- Each role in the key policy: every new role requires a key policy edit (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/kms/latest/developerguide/key-policy-default.html
> 🇻🇳 Key policy phải có statement cho root account (enable IAM policies) thì IAM policy mới có tác dụng với khoá KMS.

---

## Q ai-20261022-a13-03
- domain: secure
- task: 1.3
- topic: security
- services: KMS, S3, Organizations
- tags: cross-account-access, sse-kms, iam-policies
- difficulty: hard
- skills: 1.3.s4, 1.3.k1
- concept: Org-wide key sharing with aws:PrincipalOrgID plus kms:ViaService limits use to S3 without per-account policy edits
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Cần ba điều cùng lúc: mọi tài khoản trong tổ chức (kể cả tài khoản mới), chỉ qua S3, và không sửa key policy mỗi lần thêm tài khoản.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 145

A central security account owns a customer managed KMS key that encrypts objects in Amazon S3 buckets across the 70 accounts of an AWS Organization. New accounts join every month. Principals in member accounts must be able to use the key when they access S3 objects with SSE-KMS, but must not be able to call AWS KMS directly to decrypt data. The solution must not require a key policy change when an account is added. Which key policy design meets these requirements?

- A. Allow Principal "*" for the KMS actions that Amazon S3 needs, with a single condition that aws:PrincipalOrgID matches the ID of the organization and no other restriction
- B. List the root principal of every member account in the key policy and add each new account to that list at the time the account joins the organization
- C. Allow Principal "*" for the KMS actions that Amazon S3 needs, with conditions that aws:PrincipalOrgID matches the organization ID and kms:ViaService matches the S3 endpoint of the key's Region
- D. Allow Principal "*" for the KMS actions that Amazon S3 needs, with a single condition that kms:ViaService matches the S3 endpoint of the key's Region and no other restriction

**Answer:** C

**Explanation:** The organization condition admits every current and future member account, and kms:ViaService limits use to requests made by S3 on the principal's behalf; member-account IAM policies still decide who may use S3.
- Organization condition only: principals could call AWS KMS directly (vi phạm ràng buộc).
- Root of every account in the key policy: needs a policy change for each new account (vi phạm ràng buộc).
- ViaService only: any AWS account's principals could use the key through S3 (đặt sai chỗ).
Docs: https://docs.aws.amazon.com/kms/latest/developerguide/conditions-kms.html
> 🇻🇳 Dùng aws:PrincipalOrgID (cả tổ chức) kết hợp kms:ViaService (chỉ qua S3) trong key policy — không cần sửa khi thêm account.

---

## Q ai-20261022-a13-04
- domain: secure
- task: 1.3
- topic: security
- services: KMS, EBS, RDS
- tags: iam-policies, least-privilege, encryption-at-rest
- difficulty: hard
- skills: 1.3.s4
- concept: kms:CreateGrant with kms:GrantIsForAWSResource lets integrated services use a key on a user's behalf without letting the user delegate it arbitrarily
- refs: 05-security-services.md
- hint: EBS và RDS dùng grant thay mặt người dùng — cần cho phép tạo grant nhưng chỉ khi dịch vụ AWS thực hiện, không phải người dùng.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 130

A platform team launches encrypted Amazon EBS volumes and Amazon RDS DB instances that use a customer managed KMS key. The team's IAM role has kms:Encrypt, kms:Decrypt and kms:GenerateDataKey on the key, but attaching encrypted volumes to instances fails because the services cannot use the key on the team's behalf. The security team does not allow the role to create grants that let arbitrary principals use the key. Which key policy statement should a solutions architect add?

- A. Allow the platform role kms:CreateGrant on the key with no condition so that the AWS services can create the grants they need
- B. Allow the platform role kms:CreateGrant, kms:ListGrants and kms:RevokeGrant with a condition that kms:GrantIsForAWSResource is true
- C. Add kms:ReEncrypt* and kms:DescribeKey to the permissions of the platform role in the key policy to complete the attachment
- D. Deny kms:CreateGrant to every principal in the key policy so that nobody can delegate use of the key to another party

**Answer:** B

**Explanation:** Integrated services use grants to act on the user's behalf. The GrantIsForAWSResource condition allows the role's CreateGrant only when an AWS service makes the call, so users cannot hand out the key themselves.
- Unconditional CreateGrant: the role could create grants for arbitrary principals (vi phạm ràng buộc).
- ReEncrypt and DescribeKey: do not give the services a grant, so attachment still fails (giải bài toán khác).
- Deny CreateGrant: breaks EBS and RDS encryption, which depend on grants (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/kms/latest/developerguide/key-policy-default.html
> 🇻🇳 Cho phép CreateGrant kèm điều kiện kms:GrantIsForAWSResource = true để dịch vụ AWS dùng khoá, người dùng không tự cấp quyền được.

---

## Q ai-20261022-a13-05
- domain: secure
- task: 1.3
- topic: security
- services: IAM, KMS, Organizations
- tags: cross-account-access, compliance, iam-policies
- difficulty: medium
- skills: 1.3.s4, 1.3.k1
- concept: IAM Access Analyzer external access analyzer evaluates KMS key policies and grants and reports access from outside the zone of trust
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Cần công cụ phân tích chính sách (không phải phát hiện hành vi) và không viết code — vùng tin cậy là cả tổ chức.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A company has 90 AWS accounts in an AWS Organization. An audit found a customer managed KMS key whose key policy allowed a principal from an unknown external account to decrypt data. The security team wants to be alerted automatically whenever any KMS key policy or grant in the organization allows access from outside the organization, without writing custom code. Which solution will meet these requirements?

- A. Create an IAM Access Analyzer external access analyzer for the organization and send new findings to an SNS topic through EventBridge
- B. Enable Amazon GuardDuty in every account and have the security team review its findings for unusual external use of the keys
- C. Record the KMS keys with AWS Config and write a custom rule backed by a Lambda function that parses each key policy for external principals
- D. Turn on CloudTrail Insights in an organization trail and send an alert when unusual KMS API activity from external accounts appears

**Answer:** A

**Explanation:** An external access analyzer evaluates key policies and grants against the zone of trust (here, the organization) and creates findings that EventBridge can forward to SNS, with no custom code.
- GuardDuty: detects suspicious activity from logs but does not analyze key policies (giải bài toán khác).
- Config custom rule with Lambda: requires code to write and maintain (tốn vận hành hơn).
- CloudTrail Insights: flags unusual API call volume, not external policy grants (giải bài toán khác).
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-resources.html
> 🇻🇳 Phát hiện key policy/grant cho bên ngoài tổ chức = IAM Access Analyzer (external access, zone of trust = organization).

---

## Q ai-20261022-a13-06
- domain: secure
- task: 1.3
- topic: storage
- services: S3, KMS
- tags: sse-s3, sse-kms, encryption-at-rest
- difficulty: easy
- skills: 1.3.s2, 1.3.k4
- concept: S3 encrypts every new object with SSE-S3 by default at no cost, so no extra configuration is the cheapest compliant answer
- refs: 02-storage-services.md, B-bao-mat-compliance.md
- hint: S3 đã tự mã hoá mọi object mới từ lâu — nếu không có yêu cầu nào thêm thì cấu hình nào rẻ nhất?
- family: s3-key-management-choice
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 105

A genomics research company stores sequencing results in a new Amazon S3 bucket in its production account. The data must be encrypted at rest. Applications upload objects with the AWS SDK and do not set any encryption parameters. The company has no other data-protection requirements and wants to avoid extra charges. Which solution will meet the requirement MOST cost-effectively?

- A. Keep the bucket's default encryption with Amazon S3 managed keys (SSE-S3), which Amazon S3 generates for each object that applications upload, and make no other changes
- B. Set the bucket's default encryption to SSE-KMS with the AWS managed key for Amazon S3 (aws/s3), whose key policy AWS maintains and whose material AWS KMS stores
- C. Set the bucket's default encryption to SSE-KMS with a customer managed KMS key whose key policy the security team owns and whose material AWS KMS stores
- D. Encrypt objects in the application with keys that are generated and stored in an AWS CloudHSM cluster that the security team operates, then upload the ciphertext

**Answer:** A

**Explanation:** Since January 2023 Amazon S3 applies SSE-S3 to every new object at no additional cost, which satisfies encryption at rest with no configuration.
- SSE-KMS with aws/s3: adds KMS request charges for no stated benefit (tốn chi phí hơn).
- Customer managed key: adds key and request charges and key management (tốn chi phí hơn).
- Client-side encryption with CloudHSM: HSM hourly cost plus application changes (tốn chi phí hơn).
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/default-encryption-faq.html
> 🇻🇳 Chỉ cần mã hoá at rest và rẻ nhất → SSE-S3 mặc định của S3 (miễn phí, tự bật).

---

## Q ai-20261022-a13-07
- domain: secure
- task: 1.3
- topic: storage
- services: S3, KMS, CloudTrail
- tags: sse-kms, iam-policies, encryption-at-rest
- difficulty: medium
- skills: 1.3.s2, 1.3.k4
- concept: A customer managed KMS key gives key-policy control, disable switch and CloudTrail usage logs; AWS managed key policies are not editable
- refs: 02-storage-services.md, 05-security-services.md
- hint: Cần quyền sở hữu key policy và tắt khoá bất cứ lúc nào — khoá do AWS quản lý không cho sửa chính sách.
- family: s3-key-management-choice
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 125

A genomics research company stores sequencing results in a new Amazon S3 bucket in its production account. The data must be encrypted at rest. Applications upload objects with the AWS SDK and do not set any encryption parameters. The security team must own the key policy, be able to disable access to the data at any time, and review every use of the key in AWS CloudTrail. Which solution will meet these requirements with the LEAST operational overhead?

- A. Keep the bucket's default encryption with Amazon S3 managed keys (SSE-S3), which Amazon S3 generates for each object that applications upload, and make no other changes
- B. Set the bucket's default encryption to SSE-KMS with the AWS managed key for Amazon S3 (aws/s3), whose key policy AWS maintains and whose material AWS KMS stores
- C. Set the bucket's default encryption to SSE-KMS with a customer managed KMS key whose key policy the security team owns and whose material AWS KMS stores
- D. Encrypt objects in the application with keys that are generated and stored in an AWS CloudHSM cluster that the security team operates, then upload the ciphertext

**Answer:** C

**Explanation:** A customer managed key lets the security team write the key policy, disable the key, and see each use in CloudTrail, and S3 default encryption applies it without any application change.
- SSE-S3: the key is invisible to the customer, so there is no policy, disable switch or usage log (vi phạm ràng buộc).
- aws/s3: its key policy is managed by AWS and cannot be edited (vi phạm ràng buộc).
- CloudHSM client-side encryption: meets the need but needs a cluster and application changes (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html
> 🇻🇳 Muốn tự quản key policy, tắt khoá, audit từng lần dùng → SSE-KMS với customer managed key.

---

## Q ai-20261022-a13-08
- domain: secure
- task: 1.3
- topic: security
- services: S3, CloudHSM, KMS
- tags: client-side-encryption, encryption-at-rest
- difficulty: hard
- skills: 1.3.k4, 1.3.s2
- concept: Keys that must live in single-tenant HSMs under exclusive customer control point to CloudHSM, not KMS standard keys
- refs: B-bao-mat-compliance.md, Q-service-comparisons.md
- hint: Quy định đòi HSM đơn khách hàng do công ty toàn quyền kiểm soát — KMS dùng HSM nhiều khách hàng do AWS vận hành.
- family: s3-key-management-choice
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A genomics research company stores sequencing results in a new Amazon S3 bucket in its production account. The data must be encrypted at rest. Applications upload objects with the AWS SDK and do not set any encryption parameters. A regulator now requires that encryption keys be generated and stored in single-tenant hardware security modules that only the company controls and that AWS staff cannot access. Which solution will meet this requirement?

- A. Keep the bucket's default encryption with Amazon S3 managed keys (SSE-S3), which Amazon S3 generates for each object that applications upload, and make no other changes
- B. Set the bucket's default encryption to SSE-KMS with the AWS managed key for Amazon S3 (aws/s3), whose key policy AWS maintains and whose material AWS KMS stores
- C. Set the bucket's default encryption to SSE-KMS with a customer managed KMS key whose key policy the security team owns and whose material AWS KMS stores
- D. Encrypt objects in the application with keys that are generated and stored in an AWS CloudHSM cluster that the security team operates, then upload the ciphertext

**Answer:** D

**Explanation:** AWS CloudHSM provides single-tenant HSMs whose keys the customer controls and AWS cannot use, so client-side encryption with CloudHSM-held keys satisfies the regulator while S3 stores only ciphertext.
- SSE-S3: keys are generated and held by S3 (vi phạm ràng buộc).
- aws/s3: key material sits in AWS-operated KMS HSMs shared across customers (vi phạm ràng buộc).
- Customer managed KMS key: still held in the standard KMS key store, not in HSMs the company controls (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/cloudhsm/latest/userguide/introduction.html
> 🇻🇳 Khoá phải nằm trong HSM đơn khách hàng, công ty toàn quyền → CloudHSM (mã hoá phía client), không phải KMS tiêu chuẩn.

---

## Q ai-20261022-a13-09
- domain: secure
- task: 1.3
- topic: database
- services: RDS, KMS
- tags: db-encryption, multi-region, encryption-at-rest
- difficulty: medium
- skills: 1.3.s2, 1.3.s5
- concept: KMS keys are Regional, so an encrypted cross-Region RDS read replica needs a KMS key from the destination Region
- refs: 03-database-services.md, 05-security-services.md
- hint: Khoá KMS gắn với một Region — replica ở Region khác phải mã hoá bằng khoá nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A company runs a production Amazon RDS for PostgreSQL DB instance in us-east-1 that is encrypted with a customer managed KMS key. For disaster recovery, a solutions architect tries to create a cross-Region read replica in eu-west-1, and the request fails because no KMS key is available for the destination Region. The replica must remain encrypted. What should the architect do?

- A. Share the us-east-1 KMS key with eu-west-1 by adding the destination Region to its key policy and select it for the read replica
- B. Create the read replica without encryption and then modify it to turn on encryption with a KMS key after it becomes available
- C. Convert the source KMS key to a multi-Region key and reuse its key ID so that the read replica needs no separate key
- D. Create the read replica and select a KMS key that exists in eu-west-1 as the key that encrypts the read replica

**Answer:** D

**Explanation:** KMS keys are Regional, so the replica is encrypted with a key created in the destination Region, which the architect selects when creating the replica.
- Sharing the key through its policy: a key policy cannot extend a key into another Region (cấu hình không tồn tại).
- Encrypting the replica afterwards: encryption cannot be turned on after creation (cấu hình không tồn tại).
- Converting to a multi-Region key: an existing single-Region key cannot be converted (cấu hình không tồn tại).
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.XRgn.html
> 🇻🇳 Replica mã hoá khác Region phải chọn KMS key nằm ở Region đích — khoá KMS không dùng chéo Region.

---

## Q ai-20261022-a13-10
- domain: secure
- task: 1.3
- topic: security
- services: KMS, CloudTrail, S3, RDS
- tags: key-rotation, encryption-at-rest, compliance
- difficulty: medium
- skills: 1.3.s7, 1.3.k4
- concept: Automatic rotation of a customer managed key supports a custom period (shorter than the default year) and keeps old key material for decryption
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Chu kỳ mặc định của xoay khoá tự động dài hơn yêu cầu — cấu hình nào cho phép tự đặt chu kỳ mà không cần mã hoá lại dữ liệu?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 115

A company encrypts data in Amazon S3 and Amazon RDS with symmetric customer managed KMS keys. Automatic rotation is currently disabled. A new policy requires rotating the key material every 180 days and producing evidence of each rotation. Application code and IAM policies reference the key ARNs and must not change, and previously encrypted data must stay readable without re-encryption. Which solution will meet these requirements with the LEAST operational overhead?

- A. Switch each service to its AWS managed key, which rotates automatically on a schedule that the company can configure, and use its rotation records as evidence
- B. Enable automatic key rotation on each key with a 180-day rotation period and keep the RotateKey events in AWS CloudTrail as audit evidence
- C. Enable automatic key rotation on each key with the default settings and use the rotation events that AWS KMS performs as evidence
- D. Create a new KMS key every 180 days, update the alias to point to it, and re-encrypt the existing data with the new key

**Answer:** B

**Explanation:** Customer managed keys support a configurable rotation period (90 to 2,560 days). The key ID and ARN stay the same, KMS decrypts old data with the retained key material, and each rotation is logged as a RotateKey event.
- AWS managed keys: they rotate yearly and the schedule cannot be changed (cấu hình không tồn tại).
- Default settings: the default period is 365 days, longer than required (vi phạm ràng buộc).
- New key every 180 days: re-encryption and alias changes add work (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html
> 🇻🇳 Cần xoay khoá 180 ngày → bật auto-rotation trên CMK với rotation period tuỳ chỉnh; ARN và dữ liệu cũ không đổi.

---

## Q ai-20261022-a13-11
- domain: secure
- task: 1.3
- topic: security
- services: KMS, DynamoDB
- tags: multi-region, client-side-encryption, encryption-at-rest
- difficulty: hard
- skills: 1.3.k4, 1.3.s2
- concept: Multi-Region keys let client-side encrypted data be decrypted in another Region by a local KMS call with the same key ID, without re-encryption
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Dữ liệu mã hoá phía client phải giải mã được ở Region khác bằng lời gọi KMS tại chỗ — khoá cùng ID và cùng key material ở mọi Region.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 150

A company is building a new active-active application in us-east-1 and eu-west-1. The application encrypts sensitive fields on the client side with the AWS Encryption SDK before writing items to an Amazon DynamoDB global table. Items written in either Region must be readable in the other Region by calling AWS KMS in the local Region only, and no data may be re-encrypted during replication. Which TWO steps will meet these requirements? (Choose TWO)

- A. Create a multi-Region primary key in us-east-1 and replicate it to eu-west-1 as a replica key
- B. Encrypt with a single-Region key in us-east-1 and let the eu-west-1 application call AWS KMS in us-east-1 to decrypt
- C. Create unrelated customer managed keys in each Region and run a function that re-encrypts items as they replicate
- D. Configure the application in each Region to encrypt and decrypt with the multi-Region key that exists in that Region
- E. Enable the automatic replication setting on the key so that AWS KMS creates replica keys in other Regions on demand

**Answer:** A, D

**Explanation:** Related multi-Region keys share key ID and key material, so ciphertext produced in one Region decrypts in the other through a local KMS call, with no re-encryption. Each Region's application uses its own replica.
- Cross-Region decrypt calls: depends on us-east-1 KMS, violating the local-Region requirement (vi phạm ràng buộc).
- Unrelated keys plus re-encryption: breaks the no re-encryption rule (vi phạm ràng buộc).
- Automatic replication setting: KMS never creates replica keys by itself (cấu hình không tồn tại).
Docs: https://docs.aws.amazon.com/kms/latest/developerguide/multi-region-keys-overview.html
> 🇻🇳 Giải mã chéo Region bằng KMS tại chỗ, không mã hoá lại → multi-Region key (tạo primary rồi replicate, mỗi Region dùng key của mình).

---

## Q ai-20261022-a13-12
- domain: secure
- task: 1.3
- topic: storage
- services: S3, KMS
- tags: sse-kms, s3-lifecycle, encryption-at-rest
- difficulty: medium
- skills: 1.3.s2, 1.3.s6
- concept: S3 default encryption and Bucket Keys affect only new objects; existing unencrypted objects need an S3 Batch Operations copy
- refs: 02-storage-services.md, 05-security-services.md
- hint: Mã hoá mặc định chỉ áp cho object ghi mới — object cũ cần thao tác riêng, và chi phí KMS giảm nhờ khoá cấp bucket.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A company's Amazon S3 bucket holds about 40 million objects, many uploaded before January 2023 by applications that do not send any encryption headers. The bucket does not use versioning. A new policy requires every object in the bucket, existing and future, to be encrypted with the company's customer managed KMS key, and the security team wants to keep AWS KMS request costs low. Which TWO actions will meet these requirements? (Choose TWO)

- A. Rely on the bucket's default SSE-S3 encryption, which re-encrypts existing objects automatically at no additional cost
- B. Set the bucket's default encryption to SSE-KMS with the customer managed key and turn on an S3 Bucket Key
- C. Run an S3 Batch Operations copy job from an S3 Inventory manifest that rewrites each object in place with SSE-KMS and the Bucket Key
- D. Add an S3 Lifecycle rule that transitions the objects to another storage class so that S3 re-encrypts them with the key
- E. Add a bucket policy that denies PutObject requests that omit the KMS key header, which also encrypts existing objects

**Answer:** B, C

**Explanation:** Default encryption with a Bucket Key covers new uploads and cuts KMS request costs; a Batch Operations copy rewrites the existing objects with the key.
- Default SSE-S3: applies only to new uploads and does not use the customer key (vi phạm ràng buộc).
- Lifecycle transition: does not change an object's encryption (cấu hình không tồn tại).
- Deny policy: acts on new uploads only and would reject the applications that send no header (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/default-encryption-faq.html
> 🇻🇳 Default encryption + Bucket Key chỉ cho object mới; object cũ phải copy lại bằng S3 Batch Operations để mã hoá bằng CMK.

---

## Q ai-20261022-a13-13
- domain: secure
- task: 1.3
- topic: security
- services: KMS, S3, EBS, AWS Backup
- tags: encryption-at-rest, snapshots, compliance
- difficulty: hard
- skills: 1.3.k3, 1.3.k4
- concept: Crypto-shredding — scheduling deletion of a dedicated customer managed key irreversibly renders every encrypted copy unreadable; disabling is reversible
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Muốn mọi bản sao, kể cả backup, không đọc được vĩnh viễn mà không phải tìm từng bản — khoá giải mã là điểm chung.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 115

A SaaS company stores each enterprise customer's data in Amazon S3, in Amazon EBS snapshots and in AWS Backup recovery points, all encrypted under a dedicated customer managed KMS key per customer. A departing customer invokes its contractual right to have all of its data irrecoverably destroyed, including every backup copy, within 45 days. The company wants to make every copy unreadable with the LEAST effort, without locating each copy. Which action should a solutions architect take?

- A. Schedule deletion of the customer's KMS key and let the waiting period complete
- B. Disable the customer's KMS key and keep it disabled from that point on
- C. Enable automatic rotation on the customer's key and remove the old key material
- D. Delete the customer's objects and snapshots and run lifecycle rules to remove older versions

**Answer:** A

**Explanation:** Deleting the key is irreversible once the waiting period (7 to 30 days) ends, so all ciphertext under that key becomes unrecoverable, including backups, which fits within 45 days.
- Disabling the key: it can be re-enabled, so the data is not irrecoverably destroyed (vi phạm ràng buộc).
- Rotation: KMS keeps old key material for decryption and does not allow removing it (cấu hình không tồn tại).
- Deleting objects and snapshots: recovery points and other copies remain and each must be found (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys.html
> 🇻🇳 Xoá dữ liệu mọi bản sao không thể khôi phục → lên lịch xoá CMK riêng của khách hàng (crypto-shredding); disable thì còn bật lại được.

---

## Q ai-20261022-a13-14
- domain: secure
- task: 1.3
- topic: security
- services: ACM, CloudFront, ALB
- tags: tls-termination, encryption-in-transit
- difficulty: medium
- skills: 1.3.s3, 1.3.s7
- concept: ACM certificates for CloudFront must be in us-east-1, while the ALB origin certificate is requested in the load balancer's Region from a public CA
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Chứng chỉ cho CloudFront và chứng chỉ cho ALB origin nằm ở hai Region khác nhau — và origin phải dùng chứng chỉ từ CA đáng tin cậy.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 145

A company is launching a global website at www.example.com that is served by Amazon CloudFront with an Application Load Balancer in eu-central-1 as the origin at origin.example.com. Viewers must connect over HTTPS with the company's domain, and CloudFront must also use HTTPS to reach the load balancer. The company wants free, automatically renewed public certificates from AWS Certificate Manager (ACM) and no certificate installation on instances. Which TWO actions will meet these requirements? (Choose TWO)

- A. Request a public ACM certificate for www.example.com in us-east-1 and attach it to the CloudFront distribution
- B. Request one public ACM certificate for www.example.com and origin.example.com in eu-central-1 and attach it to both the CloudFront distribution and the load balancer
- C. Install a self-signed certificate on the Application Load Balancer listener and set the CloudFront origin protocol policy to HTTPS for the origin
- D. Export an ACM certificate and install it on each EC2 instance that runs behind the Application Load Balancer, then renew it by hand
- E. Request a public ACM certificate for origin.example.com in eu-central-1, attach it to the load balancer's HTTPS listener, and require HTTPS to the origin

**Answer:** A, E

**Explanation:** CloudFront can use only ACM certificates from us-east-1 for viewer connections, while the load balancer needs its own ACM certificate in its Region; both renew automatically and need no instance changes.
- One certificate in eu-central-1 for both: CloudFront cannot use an ACM certificate from that Region (đặt sai chỗ).
- Self-signed certificate on the load balancer: CloudFront requires an origin certificate from a trusted CA (vi phạm ràng buộc).
- Exporting a certificate to instances: requires installing and managing certificates on instances (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html
> 🇻🇳 Cert ACM cho CloudFront phải ở us-east-1; ALB origin cần cert ACM riêng ở Region của nó, CA đáng tin cậy.
