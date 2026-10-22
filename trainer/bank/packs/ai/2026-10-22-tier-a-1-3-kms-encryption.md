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
- time: 160
- skills: 1.3.s4, 1.3.s2
- concept: Sharing an encrypted EBS snapshot needs a customer managed key (not aws/ebs), a key policy that admits the other account, and snapshot sharing
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Snapshot mã hoá bằng khoá do AWS quản lý không chia sẻ được — cần khoá nào và ai phải được phép dùng khoá đó?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A software company encrypts the Amazon EBS volumes of its build servers with the default AWS managed key for Amazon EBS (aws/ebs). A customer in another AWS account must receive a point-in-time copy of one volume so that the customer can create its own volume from it. The customer's administrators will manage permissions for their own users, and the data must remain encrypted at all times. Which combination of steps should a solutions architect take? (Choose THREE)

- A. Create an AMI from the build server and share the AMI with the customer's account ID by adding a launch permission
- B. Create a copy of the snapshot in the same Region that uses a customer managed KMS key
- C. Use an AWS Backup copy job to copy the recovery point of the volume into a backup vault in the customer's account
- D. Add a key policy statement that lets the customer's account decrypt with the customer managed key and create grants for volumes
- E. Modify the permissions of the new snapshot copy so that it is shared with the customer's AWS account ID
- F. Create KMS grants on the customer managed key for each of the customer's IAM users so that they can decrypt the copy

**Answer:** B, D, E

**Explanation:** A snapshot encrypted with the AWS managed key cannot be shared, so the copy is re-encrypted with a customer managed key, that key's policy admits the customer's account, and the copy is then shared with the account ID.
- AMI shared through a launch permission: its snapshots still use aws/ebs, which cannot be shared with another account (vi phạm ràng buộc).
- AWS Backup cross-account copy: works only between accounts of the same organization, and the customer is an external company (vi phạm ràng buộc).
- KMS grants for the customer's IAM users: bypasses the customer's administrators, who must manage permissions for their own users (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/ebs/latest/userguide/ebs-modifying-snapshot-permissions.html
> 🇻🇳 Chia sẻ snapshot mã hoá: copy lại bằng CMK → key policy cho tài khoản kia → share snapshot; khoá aws/ebs không chia sẻ được.

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
- time: 155
- skills: 1.3.s4, 1.3.k1
- concept: Org-wide key sharing with aws:PrincipalOrgID plus kms:ViaService limits use to S3 without per-account policy edits
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Cần ba điều cùng lúc: mọi tài khoản trong tổ chức (kể cả tài khoản mới), chỉ qua S3, và không sửa key policy mỗi lần thêm tài khoản.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A central security account owns a customer managed KMS key that encrypts objects in Amazon S3 buckets across the 70 accounts of an AWS Organization. New accounts join every month. Principals in member accounts must be able to use the key when they access S3 objects with SSE-KMS, but must not be able to call AWS KMS directly to decrypt data. Principals outside the organization must never be able to use the key. The solution must not require a key policy change when an account is added. Which key policy design meets these requirements?

- A. Allow Principal "*" for the KMS actions that Amazon S3 needs, with conditions that aws:PrincipalOrgID matches the organization ID and kms:CallerAccount matches the security account ID
- B. Allow the root principal of each member account for the KMS actions that Amazon S3 needs, with a condition that kms:ViaService matches the S3 endpoint of the key's Region
- C. Allow Principal "*" for the KMS actions that Amazon S3 needs, with conditions that aws:PrincipalOrgID matches the organization ID and kms:ViaService matches the S3 endpoint of the key's Region
- D. Allow Principal "*" for the KMS actions that Amazon S3 needs, with conditions that kms:ViaService matches the S3 endpoint of the key's Region and the S3 encryption context matches the listed bucket ARNs

**Answer:** C

**Explanation:** The organization condition admits every current and future member account and excludes outsiders, and kms:ViaService limits use to requests that S3 makes on the principal's behalf, so no direct KMS calls and no edits when accounts join.
- kms:CallerAccount set to the security account: member-account principals are their own caller accounts, so they are denied (vi phạm ràng buộc).
- Root principal of each member account: every new account needs a key policy change (vi phạm ràng buộc).
- Encryption context listing bucket ARNs: new accounts bring new buckets, so the key policy changes each time (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/kms/latest/developerguide/conditions-kms.html
> 🇻🇳 aws:PrincipalOrgID (cả tổ chức, tự gồm tài khoản mới) + kms:ViaService (chỉ qua S3) trong key policy.

---

## Q ai-20261022-a13-04
- domain: secure
- task: 1.3
- topic: security
- services: KMS, EBS, RDS
- tags: iam-policies, least-privilege, encryption-at-rest
- difficulty: hard
- time: 135
- skills: 1.3.s4
- concept: kms:CreateGrant with kms:GrantIsForAWSResource lets integrated services use a key on a user's behalf without letting the user delegate it arbitrarily
- refs: 05-security-services.md
- hint: EBS và RDS dùng grant thay mặt người dùng — cần cho phép tạo grant nhưng chỉ khi dịch vụ AWS thực hiện, không phải người dùng.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A platform team launches encrypted Amazon EBS volumes and Amazon RDS DB instances that use a customer managed KMS key. The team's IAM role has kms:Encrypt, kms:Decrypt and kms:GenerateDataKey on the key, but attaching encrypted volumes to instances fails because the services cannot use the key on the team's behalf. The security team does not allow the role to create grants that let arbitrary principals use the key. Which key policy statement should a solutions architect add?

- A. Allow the platform role kms:CreateGrant on the key with a kms:GrantOperations condition that limits grants to the Decrypt and GenerateDataKey operations
- B. Allow the platform role kms:CreateGrant, kms:ListGrants and kms:RevokeGrant with a condition that kms:GrantIsForAWSResource is true
- C. Allow the Amazon EC2 and Amazon RDS service principals to call kms:Decrypt and kms:GenerateDataKey on the key in a new key policy statement
- D. Allow the platform role kms:CreateGrant, kms:ListGrants and kms:RevokeGrant with a condition that kms:CallerAccount matches the company's account ID

**Answer:** B

**Explanation:** Integrated services use grants to act on the user's behalf. The kms:GrantIsForAWSResource condition allows the role's CreateGrant only when an AWS service such as EBS or RDS makes the call, so users cannot hand out the key themselves.
- GrantOperations condition: limits what a grant allows, but the role can still create grants for any grantee principal (vi phạm ràng buộc).
- EC2 and RDS service principals in the key policy: these services use grants created for the user, not service-principal permissions (dùng sai tính năng).
- CallerAccount condition: always true for the company's own role, so it is effectively unconditional (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/kms/latest/developerguide/key-policy-default.html
> 🇻🇳 CreateGrant kèm kms:GrantIsForAWSResource = true để dịch vụ AWS dùng khoá thay người dùng, người dùng không tự cấp quyền được.

---

## Q ai-20261022-a13-05
- domain: secure
- task: 1.3
- topic: security
- services: IAM, KMS, Organizations
- tags: cross-account-access, compliance, iam-policies
- difficulty: medium
- time: 110
- skills: 1.3.s4, 1.3.k1
- concept: IAM Access Analyzer external access analyzer evaluates KMS key policies and grants and reports access from outside the zone of trust
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Cần công cụ phân tích chính sách (không phải phát hiện hành vi) và không viết code — vùng tin cậy là cả tổ chức.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company has 90 AWS accounts in an AWS Organization. An audit found a customer managed KMS key whose key policy allowed a principal from an unknown external account to decrypt data. The security team wants to be alerted automatically whenever any KMS key policy or grant in the organization allows access from outside the organization, without writing custom code. Which solution will meet these requirements?

- A. Create an IAM Access Analyzer external access analyzer for the organization and send new findings to an SNS topic through EventBridge
- B. Enable AWS Security Hub with the AWS Foundational Security Best Practices standard and send failed KMS control findings to an SNS topic through EventBridge
- C. Create an EventBridge rule that matches PutKeyPolicy and CreateGrant events from CloudTrail and sends each event to an SNS topic for external-access review
- D. Create an IAM Access Analyzer unused access analyzer for the organization and send new findings to an SNS topic through EventBridge

**Answer:** A

**Explanation:** An external access analyzer evaluates key policies and grants against the zone of trust (here, the organization) and creates findings that EventBridge can forward to SNS, with no custom code.
- Security Hub KMS controls: check for publicly accessible keys and broad IAM policies, not access granted to one external account (giải bài toán khác).
- EventBridge rule on PutKeyPolicy and CreateGrant: alerts on every change without deciding whether access is external, and misses existing keys (giải bài toán khác).
- Unused access analyzer: reports unused roles and permissions, not external access (dùng sai tính năng).
Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-resources.html
> 🇻🇳 Phát hiện key policy/grant cho bên ngoài tổ chức → IAM Access Analyzer external access (zone of trust = organization).

---

## Q ai-20261022-a13-06
- domain: secure
- task: 1.3
- topic: storage
- services: S3, KMS
- tags: sse-s3, sse-kms, encryption-at-rest
- difficulty: easy
- time: 105
- skills: 1.3.s2, 1.3.k4
- family: s3-key-management-choice
- concept: S3 encrypts every new object with SSE-S3 by default at no cost, so no extra configuration is the cheapest compliant answer
- refs: 02-storage-services.md, B-bao-mat-compliance.md
- hint: S3 đã tự mã hoá mọi object mới từ lâu — nếu không có yêu cầu nào thêm thì cấu hình nào rẻ nhất?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A genomics research company stores sequencing results in a new Amazon S3 bucket in its production account. The data must be encrypted at rest. Applications upload objects with the AWS SDK and do not set any encryption parameters. The company has no other data-protection requirements and wants to avoid extra charges. Which solution will meet the requirement MOST cost-effectively?

- A. Keep the bucket's default encryption with Amazon S3 managed keys (SSE-S3), which Amazon S3 generates for each object that applications upload, and make no other changes
- B. Set the bucket's default encryption to SSE-KMS with the AWS managed key for Amazon S3 (aws/s3), which AWS KMS creates in the account and rotates every year
- C. Set the bucket's default encryption to SSE-KMS with a customer managed KMS key that the security team creates in AWS KMS with automatic rotation enabled
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
- time: 125
- skills: 1.3.s2, 1.3.k4
- family: s3-key-management-choice
- concept: A customer managed KMS key gives key-policy control, disable switch and CloudTrail usage logs; AWS managed key policies are not editable
- refs: 02-storage-services.md, 05-security-services.md
- hint: Cần quyền sở hữu key policy và tắt khoá bất cứ lúc nào — khoá do AWS quản lý không cho sửa chính sách.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A genomics research company stores sequencing results in a new Amazon S3 bucket in its production account. The data must be encrypted at rest. Applications upload objects with the AWS SDK and do not set any encryption parameters. The security team must own the key policy, be able to disable access to the data at any time, and review every use of the key in AWS CloudTrail. Which solution will meet these requirements with the LEAST operational overhead?

- A. Keep the bucket's default encryption with Amazon S3 managed keys (SSE-S3), which Amazon S3 generates for each object that applications upload, and make no other changes
- B. Set the bucket's default encryption to SSE-KMS with the AWS managed key for Amazon S3 (aws/s3), which AWS KMS creates in the account and rotates every year
- C. Set the bucket's default encryption to SSE-KMS with a customer managed KMS key that the security team creates in AWS KMS with automatic rotation enabled
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
- time: 135
- skills: 1.3.k4, 1.3.s2
- family: s3-key-management-choice
- concept: Keys that must live in single-tenant HSMs under exclusive customer control point to CloudHSM, not KMS standard keys
- refs: B-bao-mat-compliance.md, Q-service-comparisons.md
- hint: Quy định đòi HSM đơn khách hàng do công ty toàn quyền kiểm soát — KMS dùng HSM nhiều khách hàng do AWS vận hành.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A genomics research company stores sequencing results in a new Amazon S3 bucket in its production account. The data must be encrypted at rest. Applications upload objects with the AWS SDK and do not set any encryption parameters. A regulator now requires that encryption keys be generated and stored in single-tenant hardware security modules that only the company controls and that AWS staff cannot access. Which solution will meet this requirement?

- A. Keep the bucket's default encryption with Amazon S3 managed keys (SSE-S3), which Amazon S3 generates for each object that applications upload, and make no other changes
- B. Set the bucket's default encryption to SSE-KMS with the AWS managed key for Amazon S3 (aws/s3), which AWS KMS creates in the account and rotates every year
- C. Set the bucket's default encryption to SSE-KMS with a customer managed KMS key that the security team creates in AWS KMS with automatic rotation enabled
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
- time: 110
- skills: 1.3.s2, 1.3.s5
- concept: KMS keys are Regional, so an encrypted cross-Region RDS read replica needs a KMS key from the destination Region
- refs: 03-database-services.md, 05-security-services.md
- hint: Khoá KMS gắn với một Region — replica ở Region khác phải mã hoá bằng khoá nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company runs a production Amazon RDS for PostgreSQL DB instance in us-east-1 that is encrypted with a customer managed KMS key. For disaster recovery, a solutions architect tries to create a cross-Region read replica in eu-west-1, and the request fails because no KMS key is available for the destination Region. The replica must remain encrypted. What should the architect do?

- A. Copy an encrypted snapshot of the DB instance to eu-west-1 with a KMS key from that Region and restore it as a new DB instance
- B. Replicate the source KMS key to eu-west-1 as a multi-Region replica key and select the replica key when creating the read replica
- C. Turn on cross-Region automated backup replication to eu-west-1 with a KMS key from that Region for the source DB instance
- D. Create the read replica and select a KMS key that exists in eu-west-1 as the key that encrypts the read replica

**Answer:** D

**Explanation:** KMS keys are Regional, so the cross-Region read replica is encrypted with a key that exists in the destination Region, which the architect selects when creating the replica.
- Snapshot copy and restore: gives a standalone copy, not a continuously replicating read replica (giải bài toán khác).
- Replicating the source key: an existing single-Region key cannot become a multi-Region key, so it has no replica (cấu hình không tồn tại).
- Cross-Region automated backup replication: supports point-in-time restore, not a running read replica (giải bài toán khác).
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.XRgn.html
> 🇻🇳 Read replica mã hoá khác Region phải chọn KMS key ở Region đích; snapshot/backup copy không phải replica.

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
- time: 155
- skills: 1.3.k4, 1.3.s2
- concept: Multi-Region keys let client-side encrypted data be decrypted in another Region by a local KMS call with the same key ID, without re-encryption
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Dữ liệu mã hoá phía client phải giải mã được ở Region khác bằng lời gọi KMS tại chỗ — khoá cùng ID và cùng key material ở mọi Region.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company is building a new active-active application in us-east-1 and eu-west-1. Compliance requires sensitive fields to be encrypted on the client side with the AWS Encryption SDK before items are written to an Amazon DynamoDB global table. Items written in either Region must be readable in the other Region by calling AWS KMS in the local Region only, and no data may be re-encrypted during replication. Which TWO steps will meet these requirements? (Choose TWO)

- A. Create a multi-Region primary key in us-east-1 and replicate it to eu-west-1 as a replica key
- B. Keep one single-Region key in us-east-1 and let the eu-west-1 application decrypt the replicated items through the AWS KMS endpoint in us-east-1
- C. Turn on DynamoDB encryption at rest with a customer managed key in each Region and stop encrypting the fields in the application
- D. Configure the application in each Region to encrypt and decrypt with the multi-Region key that exists in that Region
- E. Create a separate multi-Region primary key in each Region and configure each application to encrypt with its local primary key

**Answer:** A, D

**Explanation:** Related multi-Region keys share key ID and key material, so ciphertext produced in one Region decrypts in the other through a local KMS call, with no re-encryption. Each Region's application uses its own replica.
- Single-Region key called across Regions: eu-west-1 reads depend on KMS in us-east-1 (vi phạm ràng buộc).
- DynamoDB encryption at rest only: drops the required client-side field encryption (vi phạm ràng buộc).
- Separate primary keys per Region: unrelated key material, so the other Region cannot decrypt locally (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/kms/latest/developerguide/multi-region-keys-overview.html
> 🇻🇳 Giải mã chéo Region bằng KMS tại chỗ, không mã hoá lại → một multi-Region primary key + replica, mỗi Region dùng key của mình.

---

## Q ai-20261022-a13-12
- domain: secure
- task: 1.3
- topic: storage
- services: S3, KMS
- tags: sse-kms, s3-lifecycle, encryption-at-rest
- difficulty: medium
- time: 145
- skills: 1.3.s2, 1.3.s6
- concept: S3 default encryption and Bucket Keys affect only new objects; existing unencrypted objects need an S3 Batch Operations copy
- refs: 02-storage-services.md, 05-security-services.md
- hint: Mã hoá mặc định chỉ áp cho object ghi mới — object cũ cần thao tác riêng, và chi phí KMS giảm nhờ khoá cấp bucket.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company's Amazon S3 bucket holds about 40 million objects, many uploaded before January 2023 by applications that do not send any encryption headers and cannot be modified. The bucket does not use versioning. A new policy requires every object in the bucket, existing and future, to be encrypted with the company's customer managed KMS key, and the security team wants to keep AWS KMS request costs low. Which TWO actions will meet these requirements? (Choose TWO)

- A. Set the bucket's default encryption to DSSE-KMS with the customer managed key so that each object receives two layers of encryption
- B. Set the bucket's default encryption to SSE-KMS with the customer managed key and turn on an S3 Bucket Key
- C. Run an S3 Batch Operations copy job from an S3 Inventory manifest that rewrites each object in place with SSE-KMS and the Bucket Key
- D. Configure S3 Batch Replication into a new bucket whose replication rule encrypts the replicas with the customer managed key
- E. Add a bucket policy that denies PutObject requests that do not specify SSE-KMS with the customer managed key ID

**Answer:** B, C

**Explanation:** Default encryption with a Bucket Key covers new uploads and cuts KMS request costs; a Batch Operations copy rewrites the existing objects in place with the key.
- DSSE-KMS default encryption: does not support S3 Bucket Keys, so KMS request costs stay high (tốn chi phí hơn).
- Batch Replication into a new bucket: the encrypted copies live in another bucket, not in this one (giải bài toán khác).
- Deny policy without the KMS header: rejects the unmodifiable applications, which send no encryption headers (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-key.html
> 🇻🇳 Object mới: default SSE-KMS + Bucket Key (rẻ); object cũ: S3 Batch Operations copy tại chỗ.

---

## Q ai-20261022-a13-13
- domain: secure
- task: 1.3
- topic: security
- services: KMS, S3, EBS, AWS Backup
- tags: encryption-at-rest, snapshots, compliance
- difficulty: hard
- time: 125
- skills: 1.3.k3, 1.3.k4
- concept: Crypto-shredding — scheduling deletion of a dedicated customer managed key irreversibly renders every encrypted copy unreadable; disabling is reversible
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Muốn mọi bản sao, kể cả backup, không đọc được vĩnh viễn mà không phải tìm từng bản — khoá giải mã là điểm chung.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A SaaS company stores each enterprise customer's data in Amazon S3, in Amazon EBS snapshots and in AWS Backup recovery points, all encrypted under a dedicated customer managed KMS key per customer. A departing customer invokes its contractual right to have all of its data irrecoverably destroyed, including every backup copy, within 45 days. The company wants to make every copy unreadable with the LEAST effort, without locating each copy. Which action should a solutions architect take?

- A. Schedule deletion of the customer's KMS key and let the waiting period complete
- B. Disable the customer's KMS key and revoke its grants so that AWS services can no longer decrypt the data
- C. Edit the customer's key policy so that the key administrators are the sole principals allowed to use the key, and remove its grants
- D. Delete the customer's objects, snapshots and recovery points, and add lifecycle rules that remove older object versions

**Answer:** A

**Explanation:** Deleting the key is irreversible once the waiting period (7 to 30 days) ends, so all ciphertext under that key, including backups, becomes unrecoverable within 45 days without finding each copy.
- Disabling the key and revoking grants: the key can be re-enabled, so the data is not irrecoverably destroyed (vi phạm ràng buộc).
- Restricting the key policy to administrators: the key still exists and its administrators can restore access (vi phạm ràng buộc).
- Deleting objects, snapshots and recovery points: each copy must be located and removed (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys.html
> 🇻🇳 Hủy mọi bản sao không thể khôi phục → lên lịch xoá CMK riêng của khách hàng (crypto-shredding); disable/sửa policy vẫn đảo ngược được.

---

## Q ai-20261022-a13-14
- domain: secure
- task: 1.3
- topic: security
- services: ACM, CloudFront, ALB
- tags: tls-termination, encryption-in-transit
- difficulty: medium
- time: 140
- skills: 1.3.s3, 1.3.s7
- concept: ACM certificates for CloudFront must be in us-east-1, while the ALB origin certificate is requested in the load balancer's Region from a public CA
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Chứng chỉ cho CloudFront và chứng chỉ cho ALB origin nằm ở hai Region khác nhau — và origin phải dùng chứng chỉ từ CA đáng tin cậy.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company is launching a global website at www.example.com that is served by Amazon CloudFront with an Application Load Balancer in eu-central-1 as the origin at origin.example.com. Viewers must connect over HTTPS with the company's domain, and CloudFront must also use HTTPS to reach the load balancer. The company wants free, automatically renewed public certificates from AWS Certificate Manager (ACM) and no certificate installation on instances. Which TWO actions will meet these requirements? (Choose TWO)

- A. Request a public ACM certificate for www.example.com in us-east-1 and attach it to the CloudFront distribution
- B. Request one public ACM certificate for www.example.com and origin.example.com in eu-central-1 and attach it to both the CloudFront distribution and the load balancer
- C. Request a public ACM certificate for origin.example.com in us-east-1 and attach it to the HTTPS listener of the load balancer
- D. Request a private certificate from AWS Private CA for origin.example.com through ACM and attach it to the load balancer listener
- E. Request a public ACM certificate for origin.example.com in eu-central-1, attach it to the load balancer's HTTPS listener, and require HTTPS to the origin

**Answer:** A, E

**Explanation:** CloudFront can use only ACM certificates from us-east-1 for viewer connections, while the load balancer needs its own public ACM certificate in its Region; both renew automatically and need no instance changes.
- One certificate in eu-central-1 for both: CloudFront cannot use an ACM certificate from that Region (đặt sai chỗ).
- Origin certificate in us-east-1: a load balancer can use only certificates from its own Region (đặt sai chỗ).
- Private CA certificate: it is not a free public certificate, and CloudFront requires a publicly trusted origin certificate (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html
> 🇻🇳 Cert ACM cho CloudFront ở us-east-1; ALB origin cần cert ACM public riêng ở Region của nó.
