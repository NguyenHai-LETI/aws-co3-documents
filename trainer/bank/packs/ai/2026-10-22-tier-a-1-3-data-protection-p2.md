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
- skills: 1.3.k3, 1.3.s6
- concept: Object Lock compliance mode prevents any user, including root, from deleting or overwriting a version during retention
- refs: 02-storage-services.md
- hint: Yêu cầu loại trừ cả root user — chế độ nào của Object Lock không ai bypass được?
- family: s3-retention-and-deletion
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 105

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
- skills: 1.3.k3, 1.3.s6
- concept: Governance mode protects against most users while permitting principals with s3:BypassGovernanceRetention to remove objects early
- refs: 02-storage-services.md
- hint: Một nhóm đặc quyền vẫn phải xoá được sớm — chế độ nào cho phép bypass bằng quyền riêng?
- family: s3-retention-and-deletion
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

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
- status: draft
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
- skills: 1.3.s5, 1.3.k2
- concept: A logically air-gapped vault holds immutable copies outside the source account's control and can be shared with a recovery account through AWS RAM
- refs: 13-other-services.md, Q-service-comparisons.md
- hint: Kẻ tấn công có quyền admin ở account production — bản sao phải nằm ngoài tầm với của account đó và khôi phục được từ account khác.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A company runs production workloads on Amazon EBS volumes and Amazon RDS databases in one AWS account and protects them with AWS Backup plans that store recovery points in a standard backup vault in the same account. The company wants protection against an attacker who obtains administrator credentials for the production account and deletes both the resources and the backups. Recovery points must be immutable for their retention period, and the company wants to restore from a separate recovery account without copying data back by hand. Which solution will meet these requirements with the LEAST operational overhead?

- A. Add a copy rule that copies recovery points to a second standard backup vault in another AWS Region of the production account
- B. Export snapshots to an S3 bucket in the production account that has versioning and MFA delete turned on
- C. Apply AWS Backup Vault Lock in governance mode to the existing standard vault in the production account
- D. Add a copy rule that copies recovery points to a logically air-gapped vault and share that vault with the recovery account by using AWS RAM

**Answer:** D

**Explanation:** A logically air-gapped vault is locked in compliance mode by default, and a recovery account that receives the vault through AWS RAM can restore from it.
- Second standard vault in the same account: an administrator there can still delete the copies (vi phạm ràng buộc).
- Export to S3 with MFA delete: stays in the compromised account and is not an AWS Backup restore path (vi phạm ràng buộc).
- Governance-mode Vault Lock: privileged users can remove the lock, and the vault stays in that account (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/aws-backup/latest/devguide/logicallyairgappedvault.html
> 🇻🇳 Chống ransomware/mất quyền admin: copy sang logically air-gapped vault (lock compliance) rồi chia sẻ qua RAM để khôi phục từ account khác.

---

## Q ai-20261022-a13-19
- domain: secure
- task: 1.3
- topic: other
- services: AWS Backup, Organizations
- tags: automated-backups, cross-account-access, multi-region
- difficulty: hard
- skills: 1.3.s5, 1.3.k1
- concept: Central backup governance combines an Organizations backup policy, cross-account backup enabled in the management account, and a destination vault access policy
- refs: 13-other-services.md, A-nen-tang-kien-truc.md
- hint: Ba mảnh ghép: định nghĩa tập trung cho cả OU, bật tính năng ở account quản lý, và vault đích phải cho phép ghi vào.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 180

A company with 60 AWS accounts in one AWS Organization wants every Amazon EBS volume and Amazon RDS database tagged backup=true to be backed up daily by one centrally managed definition. Recovery points must also be copied to a vault in a dedicated backup account. The company wants to avoid configuring each member account by hand. Which combination of steps will meet these requirements? (Choose THREE)

- A. Create an Organizations backup policy with a daily plan and a copy action to the backup account vault, select resources tagged backup=true, and attach it to the OU
- B. Create the same daily backup plan by hand in each member account of the organization, select the resources tagged backup=true, and update every plan whenever the schedule changes
- C. In the management account of the organization, enable cross-account backup in the AWS Backup settings so that member accounts can copy recovery points out
- D. Share the destination vault with the member accounts through AWS RAM so that their daily plans can write recovery points into it
- E. Allow backup:CopyIntoBackupVault in the access policy of the destination vault in the backup account
- F. Configure S3 Cross-Region Replication to copy the daily recovery points of resources tagged backup=true into a bucket in the backup account

**Answer:** A, C, E

**Explanation:** A backup policy pushes one plan to member accounts by tag, cross-account backup must be enabled from the management account, and the destination vault must allow copies into it.
- Plan by hand in each account: contradicts the central, no-manual-setup goal (tốn vận hành hơn).
- Sharing a standard vault with RAM: not how copies into a destination vault are authorized (cấu hình không tồn tại).
- S3 replication of recovery points: recovery points are not S3 objects you can replicate (dùng sai tính năng).
Docs: https://docs.aws.amazon.com/aws-backup/latest/devguide/create-cross-account-backup.html
> 🇻🇳 Backup tập trung nhiều account: Organizations backup policy + bật cross-account backup ở management account + vault đích cho phép CopyIntoBackupVault.

---

## Q ai-20261022-a13-20
- domain: secure
- task: 1.3
- topic: database
- services: DynamoDB, AWS Backup
- tags: pitr, automated-backups, compliance
- difficulty: medium
- skills: 1.3.k3, 1.3.s5
- concept: DynamoDB point-in-time recovery covers a short window; long-term retention uses AWS Backup plans with a retention period
- refs: 03-database-services.md, 13-other-services.md
- hint: PITR chỉ giữ được một khoảng ngắn — cần lịch backup tự động với thời hạn lưu trữ dài và tự hết hạn.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 105

A lender stores loan-servicing data in an Amazon DynamoDB table with point-in-time recovery already enabled. Regulation requires restorable copies of the table to be kept for seven years, with a daily recovery point. The team wants a managed schedule and automatic expiry of old copies with the LEAST operational overhead. Which solution will meet these requirements?

- A. Create an AWS Backup plan with a rule that runs every day and a seven-year retention period for the DynamoDB data
- B. Keep point-in-time recovery on the table and raise the recovery period setting to its maximum value for the daily recovery points
- C. Enable DynamoDB Streams on the table and use a Lambda function to archive each change record to an S3 bucket every day
- D. Ask the operations team to create an on-demand DynamoDB backup of the table each night and delete backups older than seven years

**Answer:** A

**Explanation:** AWS Backup schedules daily backups, keeps them for the configured retention period and expires them automatically. DynamoDB point-in-time recovery provides at most 35 days of recovery points.
- Longer PITR window: the maximum is 35 days (vi phạm ràng buộc).
- Streams plus Lambda: a custom pipeline with no built-in restore path (tốn vận hành hơn).
- Manual nightly on-demand backups: schedule and cleanup depend on staff (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Point-in-time-recovery.html
> 🇻🇳 Lưu giữ nhiều năm cho DynamoDB → AWS Backup plan có retention; PITR chỉ tối đa 35 ngày.

---

## Q ai-20261022-a13-21
- domain: secure
- task: 1.3
- topic: other
- services: AWS Backup, RDS, EBS
- tags: automated-backups, compliance, snapshots
- difficulty: medium
- skills: 1.3.k2, 1.3.s1
- concept: AWS Backup restore testing plans automatically restore sampled recovery points, measure restore time and clean up, giving audit evidence
- refs: 13-other-services.md
- hint: Bằng chứng khôi phục được phải sinh ra định kỳ và tự dọn tài nguyên thử — không muốn tự viết hay làm tay.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 100

A healthcare company backs up Amazon RDS databases and Amazon EBS volumes with AWS Backup. An auditor requires periodic evidence that the backups can actually be restored and how long restores take, and the company must not leave test copies running. Staff currently restore samples by hand each quarter. Which solution will meet these requirements with the LEAST operational overhead?

- A. Increase the backup frequency in the plan and give the auditor the list of completed backup jobs for each recovery point as evidence
- B. Copy the recovery points to another Region and give the auditor the completed copy jobs as evidence
- C. Write a Lambda function that restores a sampled snapshot each month and deletes the restored resources afterward
- D. Create an AWS Backup restore testing plan that restores sampled recovery points on a schedule and use the results as evidence

**Answer:** D

**Explanation:** Restore testing runs scheduled restore jobs on selected recovery points, records completion times, and deletes the restored resources after validation, so results serve as compliance evidence without custom code.
- More frequent backups: completed backups do not prove that a restore works (giải bài toán khác).
- Cross-Region copies: copy jobs also do not prove restorability (giải bài toán khác).
- Custom Lambda function: code to build, schedule and maintain (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/aws-backup/latest/devguide/restore-testing.html
> 🇻🇳 Chứng minh backup khôi phục được cho kiểm toán → AWS Backup restore testing plan (tự restore mẫu, đo thời gian, tự dọn).

---

## Q ai-20261022-a13-22
- domain: secure
- task: 1.3
- topic: management
- services: AWS Config, CloudTrail, Organizations
- tags: compliance, centralized-logging
- difficulty: hard
- skills: 1.3.s1, 1.3.k1
- concept: Compliance evidence combines Config organization conformance packs (what state and when) with an organization trail in CloudTrail (who changed it)
- refs: 06-management-governance.md, B-bao-mat-compliance.md
- hint: Hai câu hỏi kiểm toán khác nhau: trạng thái tuân thủ theo thời gian (kèm khắc phục) và ai đã đổi cấu hình, khi nào.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 150

A payments company operates 80 AWS accounts in an AWS Organization. Auditors ask for two kinds of evidence. First, a continuous record of which S3 buckets and EBS volumes violated the company's encryption rules over time, deployed to every account from one place with automatic remediation. Second, proof of which principal changed encryption settings and when. Which TWO actions will provide this evidence with the LEAST operational overhead? (Choose TWO)

- A. Enable Amazon GuardDuty in every account and give the auditors its findings, using an automation for threat remediation across the organization
- B. Deploy an organization conformance pack that bundles the encryption Config rules and Systems Manager Automation remediation runbooks
- C. Deploy Amazon Inspector scans across the accounts and keep the reports of S3 findings as records that the encryption rules were reviewed
- D. Create an organization trail in AWS CloudTrail that records management events for every account in a central S3 bucket
- E. Enable Amazon Macie in every account to report which buckets contain unencrypted objects across the organization

**Answer:** B, D

**Explanation:** A conformance pack packages Config rules and remediation actions, deploys them across the organization, and records compliance history; an organization trail records who made each API call.
- GuardDuty: detects threats, not rule compliance over time (giải bài toán khác).
- Inspector: finds software vulnerabilities, not encryption settings (giải bài toán khác).
- Macie: classifies sensitive data in S3 and does not track EBS or rule history (giải bài toán khác).
Docs: https://docs.aws.amazon.com/config/latest/developerguide/conformance-packs.html
> 🇻🇳 Config conformance pack = trạng thái tuân thủ theo thời gian + remediation cho cả tổ chức; CloudTrail = ai đã thay đổi.

---

## Q ai-20261022-a13-23
- domain: secure
- task: 1.3
- topic: security
- services: AWS Artifact
- tags: compliance
- difficulty: easy
- skills: 1.3.s1
- concept: AWS Artifact gives on-demand AWS compliance reports and lets customers accept agreements such as the BAA
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Cần tài liệu tuân thủ do chính AWS phát hành và ký thỏa thuận trực tuyến — không phải kiểm tra tài nguyên của bạn.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 90

A healthcare startup is preparing for an external audit. The auditor asks for the most recent AWS SOC 2 report, and the company must also accept the HIPAA business associate addendum with AWS before storing protected health information. The team wants to obtain both items on demand without contacting sales. Which solution will meet these requirements?

- A. Deploy a HIPAA conformance pack in AWS Config and give the auditor its results as the SOC 2 report and the business associate agreement
- B. Use AWS Artifact to download the SOC 2 report and accept the business associate addendum in the console
- C. Enable AWS Security Hub with a compliance standard and accept the business associate addendum from its console
- D. Use AWS Trusted Advisor to download the SOC 2 report and review the business associate addendum in its security checks

**Answer:** B

**Explanation:** AWS Artifact provides on-demand access to AWS compliance reports such as SOC and lets customers review and accept agreements such as the HIPAA BAA.
- Config conformance pack: assesses the customer's own resources, not AWS's audit reports (giải bài toán khác).
- Security Hub standards: report findings about the account's configuration, not agreements (giải bài toán khác).
- Trusted Advisor checks: best-practice recommendations, not an audit report or agreement (giải bài toán khác).
Docs: https://docs.aws.amazon.com/artifact/latest/ug/what-is-aws-artifact.html
> 🇻🇳 Báo cáo tuân thủ của AWS (SOC...) và ký BAA/thỏa thuận → AWS Artifact.

---

## Q ai-20261022-a13-24
- domain: secure
- task: 1.3
- topic: security
- services: Macie, S3, Organizations, EventBridge
- tags: compliance, data-classification
- difficulty: medium
- skills: 1.3.k3, 1.3.s1
- concept: Macie automated sensitive data discovery with a delegated administrator classifies S3 data across an organization and emits findings to EventBridge
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Cần phân loại dữ liệu cá nhân trong S3 trên nhiều account, tự cập nhật bucket mới — không tự viết bộ quét.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 105

A retailer stores customer exports in about 300 Amazon S3 buckets across 40 accounts in an AWS Organization. The security team must find which buckets hold personal data such as names and payment card numbers, keep that inventory current as new buckets appear, and notify the team of new findings, with the LEAST operational overhead. Which solution will meet these requirements?

- A. Run Amazon Inspector scans against each account in the organization, review the findings for sensitive data patterns, and email the results to the team
- B. Write a Lambda function that scans every new object with regular expressions across the organization and publishes the results to SNS
- C. Enable Amazon GuardDuty S3 protection in each account of the organization and treat its findings as the sensitive data inventory
- D. Enable Macie with a delegated administrator, turn on automated sensitive data discovery for the organization, and send findings to EventBridge

**Answer:** D

**Explanation:** Macie's automated sensitive data discovery samples objects across the buckets of an organization's accounts, covers new buckets automatically, and publishes findings that EventBridge can route to notifications.
- Inspector: scans for software vulnerabilities, not personal data (giải bài toán khác).
- Custom Lambda scanner: code and scaling to build and maintain (tốn vận hành hơn).
- GuardDuty S3 protection: detects suspicious access, not data classification (giải bài toán khác).
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
- skills: 1.3.s3, 1.3.s6
- concept: Enforce TLS with aws:SecureTransport in the S3 bucket policy and the EFS file system policy; encryption at rest or private paths do not enforce TLS
- refs: B-bao-mat-compliance.md, 02-storage-services.md
- hint: Cần chính sách từ chối kết nối không dùng TLS ở cả hai nơi lưu trữ — mã hoá at rest hay đường đi riêng không thay thế được.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A company's compliance policy requires encryption in transit for all access to its data. The data is stored in an Amazon S3 bucket and on an Amazon EFS file system that Amazon EC2 instances mount over NFS. Some older scripts still use plain HTTP to reach the bucket and unencrypted NFS mounts. Which TWO actions will enforce the policy? (Choose TWO)

- A. Enable SSE-KMS as the default encryption on the bucket and on the file system so that stored data stays encrypted at rest
- B. Create a gateway VPC endpoint with an endpoint policy for Amazon S3 and add it to the route tables of the instance subnets
- C. Add a bucket policy statement that denies requests when the aws:SecureTransport condition key is false
- D. Restrict the security group of the EFS file system to allow the NFS port from the subnets of the instances that mount it
- E. Attach an EFS file system policy that denies access when aws:SecureTransport is false and mount with the TLS option

**Answer:** C, E

**Explanation:** The aws:SecureTransport condition in the bucket policy and in the EFS file system policy denies connections that do not use TLS, and the EFS mount helper's TLS option encrypts the NFS traffic.
- SSE-KMS defaults: protect data at rest, not the connection (giải bài toán khác).
- Gateway endpoint: makes the path private but does not require TLS (giải bài toán khác).
- Security group on the NFS port: controls who connects, not whether TLS is used (giải bài toán khác).
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
- skills: 1.3.s7, 1.3.s3
- concept: ACM renews public certificates automatically when DNS validation records stay in place; imported certificates are not renewed by ACM
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Chứng chỉ import không được ACM tự gia hạn — loại xác thực nào cho phép gia hạn hoàn toàn tự động?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

An online retailer serves several domains through Application Load Balancers using certificates bought from a commercial certificate authority and imported into AWS Certificate Manager (ACM). Twice this year a certificate expired and caused an outage because a manual renewal was missed. The company hosts the domains in Amazon Route 53 and wants to eliminate manual renewals with the LEAST operational overhead. Which solution will meet these requirements?

- A. Create an EventBridge rule for expiring certificates that emails the operations team about each load balancer certificate well before expiry
- B. Write a Lambda function that buys a new certificate from the commercial authority each year and imports it into ACM for the load balancers
- C. Request public certificates from ACM with DNS validation in Route 53, attach them to the load balancers, and remove the imported certificates
- D. Request public certificates from ACM with email validation and have the domain owners approve each renewal request, keeping the records in Route 53

**Answer:** C

**Explanation:** ACM-issued certificates that are in use and validated by DNS are renewed automatically while the validation record exists. Imported certificates are not renewed by ACM.
- Expiry email rule: still leaves a manual renewal and re-import (tốn vận hành hơn).
- Lambda that buys and imports: custom code and a paid yearly purchase (tốn vận hành hơn).
- Email validation: ACM sends notices that people must act on (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/acm/latest/userguide/managed-renewal.html
> 🇻🇳 Hết gia hạn thủ công → cert public do ACM cấp với DNS validation (Route 53); cert import thì ACM không tự gia hạn.

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
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A data platform team keeps a shared data lake in one Amazon S3 bucket with prefixes for 40 analytics teams. The bucket policy has grown so large that it is hard to review. Each team must be restricted to its own prefix, and some teams must be able to reach their data only from their own VPC. The company wants to simplify access management without moving the data or changing the bucket's location. Which solution will meet these requirements?

- A. Create an S3 access point per team with its own policy and VPC restriction, and delegate access control from the bucket policy to them
- B. Create a separate bucket for each team, replicate each team's prefix into it with S3 Replication, and apply the VPC restriction per bucket
- C. Use ACLs on every object so that each team owns its objects, and add the network rules and the restriction to the ACLs
- D. Create one gateway VPC endpoint per team and add a statement for each endpoint to the existing bucket policy as a restriction

**Answer:** A

**Explanation:** Each access point enforces its own policy and can accept requests only from a VPC, while the bucket policy just delegates, so permissions scale per team without moving data.
- Separate buckets with replication: moves data and duplicates storage (vi phạm ràng buộc).
- Per-object ACLs: ACLs are disabled by default and cannot express network rules (dùng sai tính năng).
- Endpoint statements in the bucket policy: makes the large policy larger (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-points.html
> 🇻🇳 Bucket dùng chung nhiều nhóm → S3 Access Points (policy + giới hạn VPC riêng) và uỷ quyền từ bucket policy.

---

## Q ai-20261022-a13-28
- domain: secure
- task: 1.3
- topic: storage
- services: EBS, Organizations, KMS
- tags: scp, db-encryption, encryption-at-rest
- difficulty: medium
- skills: 1.3.s6, 1.3.s2
- concept: Block unencrypted EBS volumes with an SCP on ec2:Encrypted and make encryption the default setting in each account and Region
- refs: 02-storage-services.md, 05-security-services.md
- hint: Cần vừa tự động mã hoá volume mới vừa chặn tạo volume không mã hoá ở mọi account — hai lớp khác nhau.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

An AWS Organization has accounts in which engineers sometimes launch EC2 instances with unencrypted EBS volumes. The security team must make sure new EBS volumes in all accounts are encrypted, including volumes created from unencrypted snapshots, and that any attempt to create an unencrypted volume is blocked. Which TWO actions will meet these requirements? (Choose TWO)

- A. Create an AWS Config rule that marks unencrypted volumes noncompliant and notifies the security team
- B. Attach an SCP that denies ec2:RunInstances and ec2:CreateVolume when the ec2:Encrypted condition key is false
- C. Add a tag policy that requires an encryption tag on every EBS volume in the organization
- D. Enable EBS encryption by default in each account and in each Region that is in use
- E. Turn on encryption for the running instances' existing volumes from the EC2 console

**Answer:** B, D

**Explanation:** Encryption by default makes new volumes and snapshot copies encrypted, and the SCP denies creating volumes without encryption, giving a preventive guardrail across accounts.
- Config rule: detects after creation and notifies, but does not block (vi phạm ràng buộc).
- Tag policy: tags do not control encryption (dùng sai tính năng).
- Console toggle on existing volumes: an existing volume cannot be encrypted in place (cấu hình không tồn tại).
Docs: https://docs.aws.amazon.com/ebs/latest/userguide/ebs-encryption.html
> 🇻🇳 Chặn volume không mã hoá: bật EBS encryption by default (mỗi Region) + SCP deny khi ec2:Encrypted=false.
