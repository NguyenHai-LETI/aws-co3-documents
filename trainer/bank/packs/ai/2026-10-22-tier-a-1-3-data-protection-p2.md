---
pack: ai-2026-10-22-tier-a-1-3-p2
title: "AI · Tầng A · Task 1.3 — Backup, retention, tuân thủ, phân loại và mã hoá đường truyền"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 1.3"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 1.3: Object Lock, lifecycle, AWS Backup, Config, Macie, TLS, ACM, SCP mã hoá"
---

# AI · Tầng A · Task 1.3 — Backup, retention, tuân thủ, phân loại và mã hoá đường truyền

## Q ai-20261022-a13-15
- domain: secure
- task: 1.3
- topic: storage
- services: S3
- tags: s3-object-lock, s3-versioning, compliance
- difficulty: medium
- time: 105
- skills: 1.3.k3, 1.3.s6
- family: s3-retention-and-deletion
- concept: Object Lock compliance mode prevents any user, including root, from deleting or overwriting a version during retention
- refs: 02-storage-services.md
- hint: Yêu cầu loại trừ cả root user — chế độ nào của Object Lock không ai bypass được?
- created: 2026-10-22
- enriched: 2026-10-22

A mortgage lender stores signed loan documents in a new Amazon S3 bucket that has versioning enabled. Documents are uploaded once under unique keys and are never overwritten. Company policy sets a seven-year life for each document. No user, including the root user, may delete or overwrite a document during the seven years. Which solution will meet this requirement?

- A. Enable Object Lock in compliance mode with a default retention of seven years on the bucket
- B. Enable Object Lock in governance mode with a default retention of seven years and grant s3:BypassGovernanceRetention to the compliance team
- C. Add an S3 Lifecycle rule that expires current versions after seven years and permanently deletes noncurrent versions as soon as they become noncurrent
- D. Turn on MFA delete for the bucket and require the root user's MFA device whenever a version is deleted permanently

**Answer:** A

**Explanation:** In compliance mode no user, including the root user, can delete or overwrite a protected version or shorten its retention until the period ends.
- Governance mode with a bypass permission: privileged users can remove the lock (vi phạm ràng buộc).
- Lifecycle rule: it deletes after seven years but does not block earlier deletion (giải bài toán khác).
- MFA delete: the root user can still delete versions with its device, and nothing becomes immutable (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html
> 🇻🇳 Không ai (kể cả root) được xoá trong thời gian giữ → Object Lock chế độ compliance.

---

## Q ai-20261022-a13-16
- domain: secure
- task: 1.3
- topic: storage
- services: S3, IAM
- tags: s3-object-lock, s3-versioning, compliance
- difficulty: medium
- time: 110
- skills: 1.3.k3, 1.3.s6
- family: s3-retention-and-deletion
- concept: Governance mode protects against most users while permitting principals with s3:BypassGovernanceRetention to remove objects early
- refs: 02-storage-services.md
- hint: Một nhóm đặc quyền vẫn phải xoá được sớm — chế độ nào cho phép bypass bằng quyền riêng?
- created: 2026-10-22
- enriched: 2026-10-22

A mortgage lender stores signed loan documents in a new Amazon S3 bucket that has versioning enabled. Documents are uploaded once under unique keys and are never overwritten. Company policy sets a seven-year life for each document. Most users must be unable to delete a document for seven years, but the compliance team must be able to remove one early when a customer withdraws consent. Which solution will meet these requirements?

- A. Enable Object Lock in compliance mode with a default retention of seven years on the bucket
- B. Enable Object Lock in governance mode with a default retention of seven years and grant s3:BypassGovernanceRetention to the compliance team
- C. Add an S3 Lifecycle rule that expires current versions after seven years and permanently deletes noncurrent versions as soon as they become noncurrent
- D. Turn on MFA delete for the bucket and require the root user's MFA device whenever a version is deleted permanently

**Answer:** B

**Explanation:** Governance mode locks versions against deletion for most users, while principals holding s3:BypassGovernanceRetention can delete a version early when they send the bypass header.
- Compliance mode: nobody can remove a version before retention ends (vi phạm ràng buộc).
- Lifecycle rule: gives no protection during the seven years (giải bài toán khác).
- MFA delete: requires the root user's device, so the compliance team cannot act without root credentials (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-managing.html
> 🇻🇳 Bảo vệ khỏi đa số người dùng nhưng nhóm compliance xoá sớm được → Object Lock governance + quyền s3:BypassGovernanceRetention.

---

## Q ai-20261022-a13-17
- domain: secure
- task: 1.3
- topic: storage
- services: S3
- tags: s3-lifecycle, s3-versioning, compliance
- difficulty: hard
- time: 120
- skills: 1.3.k3, 1.3.s6
- family: s3-retention-and-deletion
- concept: In a versioned bucket a lifecycle expiration only adds a delete marker; permanent deletion also needs noncurrent version expiration
- refs: 02-storage-services.md
- hint: Trong bucket bật versioning, hết hạn bản hiện tại chỉ tạo delete marker — bản cũ vẫn còn nếu không có quy tắc cho nó.
- created: 2026-10-22
- enriched: 2026-10-22

A mortgage lender stores signed loan documents in a new Amazon S3 bucket that has versioning enabled. Documents are uploaded once under unique keys and are never overwritten. Company policy sets a seven-year life for each document. Each document must be deleted automatically seven years after upload, and no protection is required before then. Which solution will meet this requirement with the LEAST operational overhead?

- A. Enable Object Lock in compliance mode with a default retention of seven years on the bucket
- B. Enable Object Lock in governance mode with a default retention of seven years and grant s3:BypassGovernanceRetention to the compliance team
- C. Add an S3 Lifecycle rule that expires current versions after seven years and permanently deletes noncurrent versions as soon as they become noncurrent
- D. Turn on MFA delete for the bucket and require the root user's MFA device whenever a version is deleted permanently

**Answer:** C

**Explanation:** In a versioned bucket, expiring the current version only adds a delete marker. Adding noncurrent version expiration permanently removes the original version, so the document is actually deleted with no manual work.
- Object Lock in compliance mode: only prevents deletion until retention ends; nothing deletes the data afterwards (giải bài toán khác).
- Object Lock in governance mode with a bypass permission: also only blocks deletion and schedules nothing (giải bài toán khác).
- MFA delete: adds manual friction to deletions and never schedules them (giải bài toán khác).
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-expire-general-considerations.html
> 🇻🇳 Xoá tự động sau 7 năm trong bucket versioning → lifecycle expire bản hiện tại + xoá vĩnh viễn noncurrent version; Object Lock chỉ chặn xoá.

---

## Q ai-20261022-a13-18
- domain: secure
- task: 1.3
- topic: other
- services: AWS Backup, EBS, RDS, RAM
- tags: automated-backups, compliance, cross-account-access
- difficulty: hard
- time: 145
- skills: 1.3.s5, 1.3.k2
- concept: A logically air-gapped vault holds immutable copies outside the source account's control and can be shared with a recovery account through AWS RAM
- refs: 13-other-services.md, Q-service-comparisons.md
- hint: Kẻ tấn công có quyền admin ở account production — bản sao phải nằm ngoài tầm với của account đó và khôi phục được từ account khác.
- created: 2026-10-22
- enriched: 2026-10-22

A company runs production workloads on Amazon EBS volumes and Amazon RDS databases in one AWS account and protects them with AWS Backup plans that store recovery points in a standard backup vault in the same account. The company wants protection against an attacker who obtains administrator credentials for the production account and deletes both the resources and the backups. Recovery points must be immutable for their retention period, and the company wants to restore from a separate recovery account without copying data back by hand. Which solution will meet these requirements with the LEAST operational overhead?

- A. Add a copy rule that copies recovery points to a second standard backup vault in another AWS Region of the production account
- B. Add a copy rule that copies recovery points to a standard backup vault owned by the recovery account, using cross-account backup in AWS Organizations
- C. Apply AWS Backup Vault Lock in compliance mode to the existing standard vault in the production account so that recovery points cannot be deleted early
- D. Add a copy rule that copies recovery points to a logically air-gapped vault and share that vault with the recovery account by using AWS RAM

**Answer:** D

**Explanation:** A logically air-gapped vault is locked in compliance mode by default, so its recovery points are immutable, and a recovery account that receives the vault through AWS RAM can restore from it.
- Second standard vault in another Region of the production account: an administrator there can still delete the copies (vi phạm ràng buộc).
- Unlocked standard vault in the recovery account: the copies are outside production but not immutable (vi phạm ràng buộc).
- Compliance-mode Vault Lock in the production vault: immutable, but restores cannot run from a separate recovery account (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/aws-backup/latest/devguide/logicallyairgappedvault.html
> 🇻🇳 Chống mất quyền admin: copy sang logically air-gapped vault (bất biến) rồi chia sẻ qua RAM để khôi phục từ account khác.

---

## Q ai-20261022-a13-19
- domain: secure
- task: 1.3
- topic: other
- services: AWS Backup, Organizations
- tags: automated-backups, cross-account-access, multi-region
- difficulty: hard
- time: 180
- skills: 1.3.s5, 1.3.k1
- concept: Central backup governance combines an Organizations backup policy, cross-account backup enabled in the management account, and a destination vault access policy
- refs: 13-other-services.md, A-nen-tang-kien-truc.md
- hint: Ba mảnh ghép: định nghĩa tập trung cho cả OU, bật tính năng ở account quản lý, và vault đích phải cho phép ghi vào.
- created: 2026-10-22
- enriched: 2026-10-22

A company with 60 AWS accounts in one AWS Organization wants every Amazon EBS volume and Amazon RDS database tagged backup=true to be backed up daily by one centrally managed definition. Recovery points must also be copied to a vault in a dedicated backup account. The company wants to avoid configuring each member account by hand. Which combination of steps will meet these requirements? (Choose THREE)

- A. Create an Organizations backup policy with a daily plan and a copy action to the backup account vault, select resources tagged backup=true, and attach it to the OU
- B. Deploy the AWS Config managed rules that check whether resources tagged backup=true are protected by a daily backup plan through an organization conformance pack
- C. In the management account of the organization, enable cross-account backup in the AWS Backup settings so that member accounts can copy recovery points out
- D. Share the backup account's vault with the organization through AWS RAM so that member accounts can copy recovery points into it
- E. Allow backup:CopyIntoBackupVault in the access policy of the destination vault in the backup account
- F. Add a vault access policy to the source vault in each member account that allows the backup account to copy recovery points out of it

**Answer:** A, C, E

**Explanation:** A backup policy pushes one plan to member accounts by tag, cross-account backup must be enabled from the management account, and the destination vault's access policy must allow copies into it.
- Config rules in a conformance pack: report unprotected resources but create no backups (giải bài toán khác).
- Sharing the vault through AWS RAM: RAM sharing serves restores from air-gapped vaults, not copy authorization (dùng sai tính năng).
- Source vault policies in each member account: authorization belongs on the destination vault, and it needs per-account setup (đặt sai chỗ).
Docs: https://docs.aws.amazon.com/aws-backup/latest/devguide/create-cross-account-backup.html
> 🇻🇳 Backup tập trung: Organizations backup policy + bật cross-account backup ở management account + vault đích cho phép CopyIntoBackupVault.

---

## Q ai-20261022-a13-20
- domain: secure
- task: 1.3
- topic: database
- services: DynamoDB, AWS Backup
- tags: pitr, automated-backups, compliance
- difficulty: medium
- time: 105
- skills: 1.3.k3, 1.3.s5
- concept: DynamoDB point-in-time recovery covers a short window; long-term retention uses AWS Backup plans with a retention period
- refs: 03-database-services.md, 13-other-services.md
- hint: PITR chỉ giữ được một khoảng ngắn — cần lịch backup tự động với thời hạn lưu trữ dài và tự hết hạn.
- created: 2026-10-22
- enriched: 2026-10-22

A lender stores loan-servicing data in an Amazon DynamoDB table with point-in-time recovery already enabled. Regulation requires restorable copies of the table to be kept for seven years, with a daily recovery point. The team wants a managed schedule and automatic expiry of old copies with the LEAST operational overhead. Which solution will meet these requirements?

- A. Create an AWS Backup plan with a rule that runs every day and a seven-year retention period for the DynamoDB data
- B. Keep point-in-time recovery on the table and set its recovery period to the maximum so that any second can be restored
- C. Add a replica of the table in a second AWS Region with DynamoDB global tables so that a restorable copy is kept
- D. Create an EventBridge Scheduler schedule that calls the DynamoDB CreateBackup API every night to take an on-demand backup of the table

**Answer:** A

**Explanation:** AWS Backup schedules daily backups, keeps each one for the configured retention period and expires it automatically, a managed design with no code.
- Maximum point-in-time recovery period: covers at most 35 days, not seven years (vi phạm ràng buộc).
- Global table replica: mirrors every change, including deletes, so it keeps no daily point-in-time copies (giải bài toán khác).
- Scheduled on-demand backups: they are kept until someone deletes them, so nothing expires automatically (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Point-in-time-recovery.html
> 🇻🇳 Lưu nhiều năm + tự hết hạn cho DynamoDB → AWS Backup plan có retention; PITR tối đa 35 ngày.

---

## Q ai-20261022-a13-21
- domain: secure
- task: 1.3
- topic: other
- services: AWS Backup, RDS, EBS
- tags: automated-backups, compliance, snapshots
- difficulty: medium
- time: 100
- skills: 1.3.k2, 1.3.s1
- concept: AWS Backup restore testing plans automatically restore sampled recovery points, measure restore time and clean up, giving audit evidence
- refs: 13-other-services.md
- hint: Bằng chứng khôi phục được phải sinh ra định kỳ và tự dọn tài nguyên thử — không muốn tự viết hay làm tay.
- created: 2026-10-22
- enriched: 2026-10-22

A healthcare company backs up Amazon RDS databases and Amazon EBS volumes with AWS Backup. An auditor requires periodic evidence that the backups can actually be restored and how long restores take, and the company must not leave test copies running. Staff currently restore samples by hand each quarter. Which solution will meet these requirements with the LEAST operational overhead?

- A. Create an AWS Backup report plan for backup and restore jobs and give the auditor the daily job reports as evidence
- B. Apply AWS Backup Vault Lock in compliance mode to the vault and give the auditor the lock configuration as evidence
- C. Write a Systems Manager Automation runbook, run it on a quarterly schedule to restore sampled recovery points, and delete the restored resources
- D. Create an AWS Backup restore testing plan that restores sampled recovery points on a schedule and use the results as evidence

**Answer:** D

**Explanation:** Restore testing runs scheduled restore jobs on selected recovery points, records restore times, and deletes the restored resources after validation, so its results serve as compliance evidence without custom code.
- Backup job reports: list jobs that ran but perform no restore, so restorability is not shown (giải bài toán khác).
- Vault Lock configuration: proves immutability, not restorability or restore time (giải bài toán khác).
- Automation runbook: restore and cleanup logic to write and maintain (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/aws-backup/latest/devguide/restore-testing.html
> 🇻🇳 Chứng minh backup khôi phục được + thời gian restore → AWS Backup restore testing plan (tự restore mẫu, tự dọn).

---

## Q ai-20261022-a13-22
- domain: secure
- task: 1.3
- topic: management
- services: AWS Config, CloudTrail, Organizations
- tags: compliance, centralized-logging
- difficulty: hard
- time: 155
- skills: 1.3.s1, 1.3.k1
- concept: Compliance evidence combines Config organization conformance packs (what state and when) with an organization trail in CloudTrail (who changed it)
- refs: 06-management-governance.md, B-bao-mat-compliance.md
- hint: Hai câu hỏi kiểm toán khác nhau: trạng thái tuân thủ theo thời gian (kèm khắc phục) và ai đã đổi cấu hình, khi nào.
- created: 2026-10-22
- enriched: 2026-10-22

A payments company operates 80 AWS accounts in an AWS Organization. Auditors ask for two kinds of evidence. First, a continuous record of which S3 buckets and EBS volumes violated the company's encryption rules over time, deployed to every account from one place with automatic remediation. Second, proof of which principal changed encryption settings and when. Which TWO actions will provide this evidence with the LEAST operational overhead? (Choose TWO)

- A. Enable AWS Security Hub with the Foundational Security Best Practices standard in every account and keep its encryption control findings as the record
- B. Deploy an organization conformance pack that bundles the encryption Config rules and Systems Manager Automation remediation runbooks
- C. Create an AWS Config aggregator in the management account that collects the configuration history of S3 buckets and EBS volumes from every account
- D. Create an organization trail in AWS CloudTrail that records management events for every account in a central S3 bucket
- E. Deploy the individual encryption Config rules and their Systems Manager Automation remediation with CloudFormation StackSets for the organization

**Answer:** B, D

**Explanation:** An organization conformance pack deploys Config rules and remediation runbooks from one place and records compliance over time; an organization trail records which principal made each API call and when.
- Security Hub standard: reports control findings but performs no automatic remediation (vi phạm ràng buộc).
- Config aggregator: collects data but deploys no rules or remediation (giải bài toán khác).
- Individual rules through StackSets: works, but each rule and remediation is packaged and maintained separately (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/config/latest/developerguide/conformance-packs.html
> 🇻🇳 Config organization conformance pack = tuân thủ theo thời gian + remediation; CloudTrail organization trail = ai đổi, khi nào.

---

## Q ai-20261022-a13-23
- domain: secure
- task: 1.3
- topic: security
- services: AWS Artifact
- tags: compliance
- difficulty: easy
- time: 95
- skills: 1.3.s1
- concept: AWS Artifact gives on-demand AWS compliance reports and lets customers accept agreements such as the BAA
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Cần tài liệu tuân thủ do chính AWS phát hành và ký thỏa thuận trực tuyến — không phải kiểm tra tài nguyên của bạn.
- created: 2026-10-22
- enriched: 2026-10-22

A healthcare startup is preparing for an external audit. The auditor asks for the most recent AWS SOC 2 report, and the company must also accept the HIPAA business associate addendum with AWS before storing protected health information. The team wants to obtain both items on demand without contacting sales. Which solution will meet these requirements?

- A. Open an AWS Support case that requests the latest SOC 2 report and the business associate addendum for the company's account
- B. Use AWS Artifact to download the SOC 2 report and accept the business associate addendum in the console
- C. Download the publicly available AWS SOC 3 report from the AWS website and accept the business associate addendum in AWS Artifact
- D. Deploy the Operational Best Practices for HIPAA Security conformance pack in AWS Config and share its compliance report with the auditor

**Answer:** B

**Explanation:** AWS Artifact provides on-demand, self-service access to AWS compliance reports such as SOC 2 and lets customers review and accept agreements such as the HIPAA business associate addendum.
- Support case: not on demand, and the request waits for AWS staff (vi phạm ràng buộc).
- Public SOC 3 report: a summary report, not the SOC 2 report the auditor asked for (giải bài toán khác).
- HIPAA conformance pack: assesses the company's own resources, not AWS's audit report (giải bài toán khác).
Docs: https://docs.aws.amazon.com/artifact/latest/ug/what-is-aws-artifact.html
> 🇻🇳 Báo cáo tuân thủ của AWS (SOC 2…) và chấp nhận BAA tự phục vụ → AWS Artifact.

---

## Q ai-20261022-a13-24
- domain: secure
- task: 1.3
- topic: security
- services: Macie, S3, Organizations, EventBridge
- tags: compliance, data-classification
- difficulty: medium
- time: 105
- skills: 1.3.k3, 1.3.s1
- concept: Macie automated sensitive data discovery with a delegated administrator classifies S3 data across an organization and emits findings to EventBridge
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Cần phân loại dữ liệu cá nhân trong S3 trên nhiều account, tự cập nhật bucket mới — không tự viết bộ quét.
- created: 2026-10-22
- enriched: 2026-10-22

A retailer stores customer exports in about 300 Amazon S3 buckets across 40 accounts in an AWS Organization. The security team must find which buckets hold personal data such as names and payment card numbers, keep that inventory current as new buckets appear, and notify the team of new findings, with the LEAST operational overhead. Which solution will meet these requirements?

- A. Enable Macie in each account and run a one-time sensitive data discovery job on the current buckets, sending findings to EventBridge
- B. Enable AWS Security Hub with a delegated administrator and the Foundational Security Best Practices standard, and send findings to EventBridge
- C. Enable Amazon GuardDuty S3 Protection with a delegated administrator for the organization and send its findings to EventBridge
- D. Enable Macie with a delegated administrator, turn on automated sensitive data discovery for the organization, and send findings to EventBridge

**Answer:** D

**Explanation:** Macie's automated sensitive data discovery samples objects across the organization's buckets, covers new buckets automatically, and publishes findings that EventBridge can route to notifications.
- One-time Macie job per account: does not keep the inventory current as new buckets appear (vi phạm ràng buộc).
- Security Hub standard: checks resource configuration, not the content of objects (giải bài toán khác).
- GuardDuty S3 Protection: detects suspicious access, not personal data in objects (giải bài toán khác).
Docs: https://docs.aws.amazon.com/macie/latest/user/discovery-asdd.html
> 🇻🇳 Tìm dữ liệu cá nhân trong S3 nhiều account, tự theo dõi bucket mới → Macie automated discovery (delegated admin) + EventBridge.

---

## Q ai-20261022-a13-25
- domain: secure
- task: 1.3
- topic: security
- services: S3, EFS
- tags: encryption-in-transit, tls-termination, iam-policies
- difficulty: medium
- time: 135
- skills: 1.3.s3, 1.3.s6
- concept: Enforce TLS with aws:SecureTransport in the S3 bucket policy and the EFS file system policy; encryption at rest or private paths do not enforce TLS
- refs: B-bao-mat-compliance.md, 02-storage-services.md
- hint: Cần chính sách từ chối kết nối không dùng TLS ở cả hai nơi lưu trữ — mã hoá at rest hay đường đi riêng không thay thế được.
- created: 2026-10-22
- enriched: 2026-10-22

A company's compliance policy requires encryption in transit for all access to its data. The data is stored in an Amazon S3 bucket and on an Amazon EFS file system that Amazon EC2 instances mount over NFS. Some older scripts still use plain HTTP to reach the bucket and unencrypted NFS mounts. Which TWO actions will enforce the policy? (Choose TWO)

- A. Update the scripts to use HTTPS endpoints and mount the file system with the EFS mount helper's TLS option on each instance
- B. Create an interface VPC endpoint for Amazon S3 and an endpoint policy that allows access to the bucket from the instance subnets
- C. Add a bucket policy statement that denies requests when the aws:SecureTransport condition key is false
- D. Turn on encryption for the EFS file system with a customer managed KMS key and require it through an IAM policy condition
- E. Attach an EFS file system policy that denies access when aws:SecureTransport is false and mount with the TLS option

**Answer:** C, E

**Explanation:** The aws:SecureTransport condition in the bucket policy and in the EFS file system policy denies any connection that does not use TLS, and the EFS mount helper's TLS option encrypts the NFS traffic.
- Updating scripts and mounts: encrypts today's clients but enforces nothing for the next unencrypted one (giải bài toán khác).
- Interface endpoint with a policy: makes the path private but does not require TLS (giải bài toán khác).
- EFS encryption with a KMS key: protects data at rest, not the connection (giải bài toán khác).
Docs: https://docs.aws.amazon.com/efs/latest/ug/iam-access-control-nfs-efs.html
> 🇻🇳 Ép TLS: deny khi aws:SecureTransport=false trong bucket policy (S3) và file system policy (EFS) + mount EFS với TLS.

---

## Q ai-20261022-a13-26
- domain: secure
- task: 1.3
- topic: security
- services: ACM, ALB, Route 53
- tags: tls-termination, key-rotation, encryption-in-transit
- difficulty: medium
- time: 115
- skills: 1.3.s7, 1.3.s3
- concept: ACM renews public certificates automatically when DNS validation records stay in place; imported certificates are not renewed by ACM
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Chứng chỉ import không được ACM tự gia hạn — loại xác thực nào cho phép gia hạn hoàn toàn tự động?
- created: 2026-10-22
- enriched: 2026-10-22

An online retailer serves several domains through Application Load Balancers using certificates bought from a commercial certificate authority and imported into AWS Certificate Manager (ACM). Twice this year a certificate expired and caused an outage because a manual renewal was missed. The company hosts the domains in Amazon Route 53 and wants to eliminate manual renewals with the LEAST operational overhead. Which solution will meet these requirements?

- A. Keep the imported certificates and use the ACM certificate expiration events in EventBridge to open a renewal ticket 45 days before expiry
- B. Issue private certificates from AWS Private CA through ACM with managed renewal, attach them to the load balancers, and remove the imported certificates
- C. Request public certificates from ACM with DNS validation in Route 53, attach them to the load balancers, and remove the imported certificates
- D. Request public certificates from ACM with email validation for each Route 53 domain, attach them to the load balancers, and remove the imported certificates

**Answer:** C

**Explanation:** ACM-issued public certificates that are in use and validated by DNS renew automatically while the validation CNAME stays in Route 53. Imported certificates are not renewed by ACM.
- Expiration events opening tickets: renewal and re-import stay manual (tốn vận hành hơn).
- Private CA certificates: renew automatically but are not trusted by customers' browsers (giải bài toán khác).
- Email validation: each renewal waits for a domain owner to approve an email (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/acm/latest/userguide/managed-renewal.html
> 🇻🇳 Bỏ gia hạn thủ công → cert public do ACM cấp + DNS validation (Route 53); cert import và email validation vẫn cần người.

---

## Q ai-20261022-a13-27
- domain: secure
- task: 1.3
- topic: storage
- services: S3, VPC Endpoint
- tags: s3-access-points, iam-policies, least-privilege
- difficulty: medium
- time: 120
- skills: 1.3.s6, 1.3.k1
- concept: S3 Access Points give each team a dedicated policy and optional VPC restriction, replacing an ever-growing bucket policy
- refs: 02-storage-services.md
- hint: Mỗi nhóm cần chính sách và ràng buộc mạng riêng trên cùng một bucket dùng chung — endpoint truy cập nào mang policy riêng?
- created: 2026-10-22
- enriched: 2026-10-22

A data platform team keeps a shared data lake in one Amazon S3 bucket with prefixes for 40 analytics teams. The bucket policy has grown so large that it is hard to review. Each team must be restricted to its own prefix, and some teams must be able to reach their data only from their own VPC. The company wants to simplify access management without moving the data or changing the bucket's location. Which solution will meet these requirements?

- A. Create an S3 access point per team with its own policy and VPC restriction, and delegate access control from the bucket policy to them
- B. Copy each team's prefix into its own bucket with S3 Batch Operations and give each bucket a policy with the team's VPC condition
- C. Rewrite the bucket policy as one statement per team with a prefix and aws:SourceVpce restriction, and validate it with IAM Access Analyzer
- D. Create a gateway VPC endpoint in each team's VPC with an endpoint policy that limits requests to that team's prefix in the bucket

**Answer:** A

**Explanation:** Each access point enforces its own policy and can accept requests from a single VPC, while the bucket policy just delegates to the access points, so permissions scale per team without moving data.
- Bucket per team: moves the data out of the shared bucket (vi phạm ràng buộc).
- One statement per team: keeps the oversized bucket policy that is hard to review (tốn vận hành hơn).
- Endpoint policies per VPC: limit traffic through that endpoint, not each team's access from other paths (giải bài toán khác).
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-points.html
> 🇻🇳 Bucket dùng chung nhiều nhóm → S3 Access Points (policy + giới hạn VPC riêng), bucket policy chỉ uỷ quyền.

---

## Q ai-20261022-a13-28
- domain: secure
- task: 1.3
- topic: storage
- services: EBS, Organizations, KMS
- tags: scp, db-encryption, encryption-at-rest
- difficulty: medium
- time: 130
- skills: 1.3.s6, 1.3.s2
- concept: Block unencrypted EBS volumes with an SCP on ec2:Encrypted and make encryption the default setting in each account and Region
- refs: 02-storage-services.md, 05-security-services.md
- hint: Cần vừa tự động mã hoá volume mới vừa chặn tạo volume không mã hoá ở mọi account — hai lớp khác nhau.
- created: 2026-10-22
- enriched: 2026-10-22

An AWS Organization has accounts in which engineers sometimes launch EC2 instances with unencrypted EBS volumes. The security team must make sure new EBS volumes in all accounts are encrypted, including volumes created from unencrypted snapshots, and that any attempt to create an unencrypted volume is blocked. Which TWO actions will meet these requirements? (Choose TWO)

- A. Deploy the encrypted-volumes AWS Config managed rule with automatic remediation to each account through an organization conformance pack
- B. Attach an SCP that denies ec2:RunInstances and ec2:CreateVolume when the ec2:Encrypted condition key is false
- C. Attach an SCP that denies ec2:CreateSnapshot and ec2:CopySnapshot when the ec2:Encrypted condition key is false
- D. Enable EBS encryption by default in each account and in each Region that is in use
- E. Set a customer managed KMS key as the default EBS encryption key in each account and in each Region that is in use

**Answer:** B, D

**Explanation:** Encryption by default encrypts new volumes, including those created from unencrypted snapshots, and the SCP denies requests for unencrypted volumes, a preventive guardrail across accounts.
- Config rule with remediation: acts after the volume exists, so creation is not blocked (vi phạm ràng buộc).
- SCP on snapshot actions: governs snapshots, not the creation of volumes (giải bài toán khác).
- Default KMS key setting: selects the key but does not turn on encryption by default (dùng sai tính năng).
Docs: https://docs.aws.amazon.com/ebs/latest/userguide/ebs-encryption.html
> 🇻🇳 Chặn volume không mã hoá: bật EBS encryption by default (mỗi Region) + SCP deny khi ec2:Encrypted=false.
