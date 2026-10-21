---
pack: ai-2026-10-16-1757-longform
title: "AI · Câu dài chuẩn đề thi · Secure (Dedicated Hosts, SSE-KMS, Permissions boundary)"
exam: SAA-C03
origin: ai
created: 2026-10-16
generated_by: 2026-10-16_175724_longform
source: trainer/coach/enrich/2026-10-16_175724_longform-batch.md
description: "Biến thể dài (60–120 từ) của các câu ngắn hay gặp/hay sai"
---

# AI · Câu dài chuẩn đề thi · Secure (Dedicated Hosts, SSE-KMS, Permissions boundary)

## Q ai-20261016-1757-lf01
- domain: secure
- task: 1.2
- topic: compute
- services: EC2
- tags: dedicated-hosts, host-affinity
- difficulty: hard
- variant_of: 01-v2-28
- concept: Dedicated Hosts with host affinity (same physical host over time, socket/core visibility) vs Dedicated Instances
- refs: 01-compute-services.md, C-kien-truc-web-app.md
- hint: Giấy phép tính theo socket/core và phải chứng minh cùng một máy vật lý theo thời gian — loại tenancy nào cho thấy phần cứng?
- created: 2026-10-16
- enriched: 2026-10-16
- time: 125

A financial services company is migrating a legacy database application to AWS. The software vendor licenses the product per physical socket and core under a bring-your-own-license model, and auditors require proof that each licensed instance stays on the same physical server over time. The operations team also needs visibility into the physical sockets and cores in use. The security team requires that no other customer's workloads share the underlying hardware. Which solution will meet these requirements?

- A. Launch the instances as Dedicated Instances in a dedicated-tenancy VPC and report the physical core count from instance metadata
- B. Launch Spot Instances in a cluster placement group and tag each instance with its license details to document placement over time
- C. Launch On-Demand Instances with default tenancy in a partition placement group and map each partition to a licensed server
- D. Allocate Dedicated Hosts, launch the instances onto them with host affinity set to Host, and track sockets and cores per host

**Answer:** D

**Explanation:** Dedicated Hosts expose the physical sockets and cores, and host affinity set to **Host** keeps an instance on the same physical server after stop/start, which is what a per-socket BYOL audit needs.
- Dedicated Instances: single-tenant hardware, but no host affinity and no visibility into sockets or cores.
- Spot Instances in a cluster placement group: placement groups control network locality, not which physical host is used, and Spot can be reclaimed.
- Partition placement group on default tenancy: partitions isolate failure domains on shared hardware and give no socket or core visibility.
> 🇻🇳 BYOL theo socket/core + cùng máy vật lý → Dedicated Hosts với host affinity = Host.

---

## Q ai-20261016-1757-lf02
- domain: secure
- task: 1.3
- topic: storage
- services: S3, KMS, CloudTrail
- tags: sse-kms, bucket-keys
- difficulty: hard
- variant_of: 02-v2-23
- concept: SSE-KMS request throttling due to KMS quotas; fix with S3 Bucket Keys or quota increase
- refs: 02-storage-services.md, D-kien-truc-luu-tru.md
- hint: Mã hoá phía server bằng khoá do khách hàng quản lý, tải đọc tăng mạnh thì bị giới hạn — giới hạn đó nằm ở dịch vụ nào?
- created: 2026-10-16
- enriched: 2026-10-16
- time: 140

A healthcare analytics company stores patient records in an Amazon S3 bucket that has versioning and Object Lock enabled. Compliance rules require server-side encryption with a customer managed AWS KMS key controlled by the security team, and AWS CloudTrail must continue to log KMS key usage. After a new batch job began reading millions of objects per hour, the application started receiving throttling errors on S3 requests. The team must stop the throttling while keeping the customer managed key and the audit trail, with the LEAST change to the application. Which solution will meet these requirements?

- A. Switch the bucket to SSE-C and have the application supply its own encryption key with every request to avoid calls to AWS KMS
- B. Suspend versioning and disable Object Lock on the bucket to remove the metadata overhead that is causing the throttling errors
- C. Enable S3 Bucket Keys on the bucket and request a service quota increase for AWS KMS requests if throttling continues
- D. Switch the bucket to SSE-S3 so that Amazon S3 manages the encryption keys and no AWS KMS request limits apply to reads

**Answer:** C

**Explanation:** Each SSE-KMS object operation calls AWS KMS, so heavy traffic hits KMS request quotas; **S3 Bucket Keys** cut KMS calls sharply, and a quota increase covers any remaining gap, all without changing the application or the key.
- SSE-C: the key is supplied by the client, not KMS, so the KMS key and its CloudTrail usage records are lost and the application must change.
- Suspending versioning and Object Lock: neither causes request throttling, and Object Lock may be a compliance requirement.
- SSE-S3: keys are owned by S3, so the company no longer controls a customer managed key or gets KMS audit events.
> 🇻🇳 SSE-KMS bị throttle do quota của KMS → bật S3 Bucket Keys hoặc xin tăng quota.

---

## Q ai-20261016-1757-lf03
- domain: secure
- task: 1.1
- topic: security
- services: IAM
- tags: permission-boundaries
- difficulty: medium
- variant_of: 05-v2-21
- concept: IAM permissions boundary caps the maximum permissions of a principal regardless of attached identity policies
- refs: 05-security-services.md, B-bao-mat-compliance.md
- hint: Quyền thực tế là giao điểm của hai tập — cơ chế nào đặt trần cho một người dùng dù có gắn thêm policy gì?
- created: 2026-10-16
- enriched: 2026-10-16
- time: 130

A company has 40 engineers who use IAM users in a single AWS account. Administrators grant permissions with identity policies, and team leads are allowed to create new IAM users and attach policies to them. The security team must guarantee that no user in this account can ever exceed a defined set of permissions, such as launching only approved instance types and never modifying IAM or AWS CloudTrail, even if a team lead attaches AdministratorAccess to a user. The organization's management account is owned by another team and cannot be changed. Which solution will meet these requirements with the LEAST operational overhead?

- A. Create a managed policy with the approved maximum permissions and require it as the permissions boundary on every IAM user that team leads create
- B. Attach a Service Control Policy directly to each IAM user in the account that denies every action outside the approved permissions list
- C. Require each engineer to pass a session policy listing only the approved actions whenever they sign in or assume a role in the account
- D. Add a resource-based policy to every AWS resource in the account that denies access to any principal outside the approved list

**Answer:** A

**Explanation:** A **permissions boundary** sets the maximum permissions an IAM user or role can have; effective access is the intersection of the boundary and the identity policy, so attaching AdministratorAccess cannot exceed it. It can be enforced by allowing team leads to create users only when the boundary is attached.
- Service Control Policy: applies to accounts or OUs through Organizations, not to individual IAM users, and the management account cannot be changed.
- Session policy: limits a single session and depends on each user passing it, so it is not a standing cap.
- Resource-based policies on every resource: huge operational burden, and new resources would be unprotected.
> 🇻🇳 Đặt trần quyền tối đa cho IAM user/role dù gắn thêm policy nào → permissions boundary.
