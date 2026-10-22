---
pack: ai-2026-10-22-tier-a-4-1-p2
title: "AI · Tầng A · Task 4.1 — Lưu trữ hybrid, chuyển dữ liệu, FSx, hoá đơn (p2)"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 4.1"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 4.1 — phần 2"
---

# AI · Tầng A · Task 4.1 — Lưu trữ hybrid, chuyển dữ liệu, FSx, hoá đơn (p2)

## Q ai-20261022-a41-12
- domain: cost
- task: 4.1
- topic: migration
- services: DataSync, S3, Direct Connect, Storage Gateway, Snow Family
- tags: data-transfer-cost, datasync
- difficulty: medium
- time: 125
- skills: 4.1.s3, 4.1.s7, 4.1.k8
- concept: AWS DataSync over an existing network link is the lowest-cost managed method when bandwidth and time allow, with no new circuit or devices
- refs: 10-migration-transfer.md, 02-storage-services.md
- hint: Đường truyền hiện có còn dư băng thông và chưa có hạn chót gần — phương pháp nào không cần mua thêm kết nối hay thiết bị?
- created: 2026-10-22
- enriched: 2026-10-22

A manufacturing company must copy 45 TB of historical sensor archives from an on-premises NFS server to Amazon S3 once, and then keep the bucket updated with about 200 GB of weekly changes. The company's 1 Gbps internet link has plenty of spare capacity, and no deadline falls within the next three months. Transfers must be verified for integrity, must resume automatically after interruptions, and must run on a schedule without custom scripting. The company wants the lowest-cost transfer method. Which solution will meet these requirements?

- A. Install an AWS DataSync agent on premises and run scheduled tasks that copy the NFS data to S3 over the existing internet link.
- B. Provision a dedicated AWS Direct Connect connection instead of the internet link and run AWS DataSync tasks over it to copy the NFS data to S3.
- C. Deploy an S3 File Gateway virtual machine on premises and copy the files into its NFS share by running rsync scripts on a schedule.
- D. Order AWS Snowball Edge devices, copy the data onto them, and ship them to AWS so that the data is imported into the bucket.

**Answer:** A

**Explanation:** DataSync verifies integrity, resumes after interruptions and runs on a schedule, and the existing link is enough, so the only charge is its per-GB fee.
- Direct Connect plus DataSync: adds port charges and weeks of setup for a one-time copy the current link can handle (tốn chi phí hơn)
- File Gateway with rsync scripts: custom scripting and no built-in verification or scheduling (vi phạm ràng buộc)
- Snowball Edge: device fees and shipping when bandwidth is sufficient (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/datasync/latest/userguide/what-is-datasync.html
> 🇻🇳 Băng thông dư, không gấp, cần kiểm tra toàn vẹn và lịch chạy → DataSync qua đường truyền hiện có là cách rẻ nhất.

---

## Q ai-20261022-a41-13
- domain: cost
- task: 4.1
- topic: migration
- services: Transfer Family, S3, Route 53, Storage Gateway, DataSync, EC2
- tags: hybrid-storage, sftp
- difficulty: medium
- time: 145
- skills: 4.1.k8, 4.1.s7
- concept: AWS Transfer Family provides managed SFTP endpoints backed by S3, and Route 53 maps the existing hostname so partner clients stay unchanged
- refs: 10-migration-transfer.md
- hint: Nhà cung cấp dùng SFTP cố định và hostname cũ, đội IT nhỏ — cần máy chủ SFTP không phải quản trị và cách giữ nguyên hostname.
- created: 2026-10-22
- enriched: 2026-10-22

A retailer receives daily order files from 60 suppliers over SFTP on two on-premises Linux servers that the company is retiring. The suppliers' SFTP clients are fixed and use the existing hostname, which the suppliers cannot change. Files must land in Amazon S3, where a Lambda function processes them. The IT team is small and wants to avoid patching and scaling servers. Which TWO actions should a solutions architect take to meet these requirements with the LEAST operational overhead? (Choose TWO)

- A. Create an AWS Transfer Family web app so that suppliers upload their order files through a browser into the S3 bucket.
- B. Create an AWS Transfer Family server that uses the SFTP protocol and stores the uploaded files in an Amazon S3 bucket.
- C. Create an AWS Transfer Family server that uses the AS2 protocol and stores the uploaded files in an Amazon S3 bucket.
- D. Create an Amazon Route 53 record that maps the existing SFTP hostname to the endpoint of the Transfer Family server.
- E. Ask each supplier to add a DNS record in its own network that maps the existing SFTP hostname to the Transfer Family endpoint.

**Answer:** B, D

**Explanation:** Transfer Family is a managed SFTP endpoint that writes to S3 with no servers to patch, and a Route 53 record keeps the existing hostname so supplier clients stay unchanged.
- Transfer Family web app: browser uploads, but the suppliers' SFTP clients cannot be changed (vi phạm ràng buộc)
- AS2 server: a different protocol from the suppliers' SFTP clients (vi phạm ràng buộc)
- DNS records in the suppliers' networks: the suppliers cannot change their configuration (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/transfer/latest/userguide/what-is-aws-transfer-family.html
> 🇻🇳 SFTP giữ nguyên client + hostname, không quản trị máy chủ → Transfer Family (S3) và bản ghi Route 53 trỏ hostname cũ.

---

## Q ai-20261022-a41-14
- domain: cost
- task: 4.1
- topic: storage
- services: Storage Gateway, S3 Glacier
- tags: tape-gateway, backup-archival
- difficulty: medium
- time: 110
- skills: 4.1.k8, 4.1.s6, 4.1.k5
- concept: Tape Gateway presents an iSCSI virtual tape library and archives virtual tapes to S3 Glacier Deep Archive without changing the backup software
- refs: 02-storage-services.md
- hint: Phần mềm sao lưu ghi qua thư viện băng ảo iSCSI và không được đổi — loại gateway nào thay thế băng vật lý và lưu trữ lạnh?
- created: 2026-10-22
- enriched: 2026-10-22

A healthcare provider backs up imaging archives to a physical tape library. The backup software writes to the tapes through an iSCSI virtual tape library interface, and the tape hardware lease ends soon. Backups must be retained for 10 years, are almost never restored, and a restore time of up to 12 hours is acceptable. The backup software and its processes must stay unchanged. Which solution will meet these requirements MOST cost-effectively?

- A. Deploy a Tape Gateway and archive the virtual tapes to S3 Glacier Flexible Retrieval when the backup jobs finish.
- B. Deploy a Tape Gateway and keep the virtual tapes in the virtual tape library for the full ten-year retention period.
- C. Deploy a Tape Gateway and archive the virtual tapes to S3 Glacier Deep Archive when the backup jobs finish.
- D. Deploy an S3 File Gateway with lifecycle rules to S3 Glacier Deep Archive and point the backup software at its file share.

**Answer:** C

**Explanation:** Tape Gateway exposes the same virtual tape library interface, so the backup software is unchanged, and archived tapes sit in S3 Glacier Deep Archive, the lowest-cost class, with retrieval within the accepted window.
- Archiving to Glacier Flexible Retrieval: meets the restore window but costs more per GB than Deep Archive (tốn chi phí hơn)
- Tapes kept in the library: stored in S3 Standard for ten years at a much higher price (tốn chi phí hơn)
- S3 File Gateway: the backup software would write files to a share instead of tapes, so its processes change (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/storagegateway/latest/tgw/WhatIsStorageGateway.html
> 🇻🇳 Thay thư viện băng, giữ nguyên phần mềm backup iSCSI VTL, lưu 10 năm → Tape Gateway + S3 Glacier Deep Archive.

---

## Q ai-20261022-a41-15
- domain: cost
- task: 4.1
- topic: storage
- services: FSx
- tags: fsx-windows, data-deduplication, storage-cost
- difficulty: medium
- time: 125
- skills: 4.1.k4
- concept: FSx for Windows File Server cost levers are HDD storage for low-I/O shares and Data Deduplication, while Multi-AZ stays for availability
- refs: 02-storage-services.md, D-kien-truc-luu-tru.md
- hint: Chia sẻ tệp ít I/O và nhiều tệp trùng lặp, vẫn phải chịu được lỗi một AZ — hai tuỳ chọn cấu hình nào giảm chi phí lưu trữ?
- created: 2026-10-22
- enriched: 2026-10-22

A university is migrating 80 TB of departmental file shares and student home directories to Amazon FSx for Windows File Server. Users access the shares over SMB from domain-joined computers, I/O demand is low, and many files are duplicated across departments. The file system must be Multi-AZ so that it survives an Availability Zone failure. The university wants the lowest storage cost. Which TWO configuration choices will meet these requirements? (Choose TWO)

- A. Enable Data Deduplication on the file system so that duplicated data is stored once.
- B. Enable shadow copies on the file system so that users can restore earlier versions of their files themselves.
- C. Enable user storage quotas so that each department's home directories, including duplicated files, stay within an assigned capacity.
- D. Deploy the file system as Single-AZ 2 with HDD storage so that there is no standby file server to pay for.
- E. Choose the HDD storage type, which costs less per GiB and suits file systems with modest I/O needs.

**Answer:** A, E

**Explanation:** HDD storage costs less than SSD and fits low-I/O shares, and Data Deduplication stores duplicate content once, cutting the capacity that must be paid for.
- Shadow copies: add restore points and consume more storage (giải bài toán khác)
- User storage quotas: cap usage per user but remove no duplicate data (giải bài toán khác)
- Single-AZ 2 deployment: cheaper, but it does not survive an Availability Zone failure (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/fsx/latest/WindowsGuide/managing-storage-configuration.html
> 🇻🇳 FSx for Windows ít I/O, nhiều tệp trùng, Multi-AZ → HDD + Data Deduplication.

---

## Q ai-20261022-a41-16
- domain: cost
- task: 4.1
- topic: database
- services: RDS
- tags: storage-autoscaling, right-sizing
- difficulty: hard
- time: 135
- skills: 4.1.s4
- concept: RDS storage autoscaling with a maximum threshold lets storage start small and grow, because allocated storage cannot be reduced later
- refs: 03-database-services.md
- hint: Dung lượng RDS đã cấp phát không giảm lại được — cần bắt đầu vừa đủ và tự mở rộng có giới hạn trên.
- created: 2026-10-22
- enriched: 2026-10-22

A game studio is launching a leaderboard service on Amazon RDS for MySQL. Data growth is unknown: the database might stay near 200 GiB or grow to several terabytes within months. A previous database ran out of storage and caused an outage, but the studio also does not want to pay for large amounts of unused storage during the first months. The team does not want to manage storage by hand. Which solution will meet these requirements MOST cost-effectively?

- A. Provision 10 TiB of RDS storage at launch so that the database cannot run out of space during the first months.
- B. Create a CloudWatch alarm on free storage space that invokes a Lambda function to increase the allocated storage by a fixed amount.
- C. Provision storage for the first months of expected data and set CloudWatch alarms that notify the team to increase the allocated storage when space runs low.
- D. Provision storage for the first months of expected data and enable RDS storage autoscaling with a maximum storage threshold set to an acceptable size.

**Answer:** D

**Explanation:** Storage autoscaling adds capacity when free space runs low, up to the maximum threshold, so the studio pays for what it needs now without manual work; allocated storage can never be reduced afterwards.
- 10 TiB up front: pays for unused storage, and allocated storage cannot be reduced later (tốn chi phí hơn)
- Alarm plus Lambda: custom automation for a capability RDS already provides (tốn vận hành hơn)
- Alarms with manual resizing: the team would manage storage by hand (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIOPS.Autoscaling.html
> 🇻🇳 Dữ liệu tăng không rõ trước: cấp vừa đủ + bật RDS storage autoscaling với ngưỡng tối đa; dung lượng đã cấp không giảm được.

---

## Q ai-20261022-a41-17
- domain: cost
- task: 4.1
- topic: storage
- services: S3, Cost Explorer, AWS Budgets
- tags: tagging, s3-cost-allocation
- difficulty: hard
- time: 120
- skills: 4.1.k2, 4.1.k3
- concept: S3 cost allocation tags apply to buckets only, so per-project costs in Cost Explorer need a bucket per project with an activated tag
- refs: 06-management-governance.md, 02-storage-services.md
- hint: Thẻ phân bổ chi phí của S3 gắn ở cấp nào — object, prefix hay bucket? Cost Explorer chỉ nhóm theo thẻ đã kích hoạt.
- created: 2026-10-22
- enriched: 2026-10-22

A consulting firm keeps client deliverables in one Amazon S3 bucket per environment, with one key prefix per client project. Finance wants the monthly storage cost of each client project to appear in AWS Cost Explorer. A developer proposes tagging every object with a client tag and activating that tag for cost allocation. Which solution will meet these requirements?

- A. Tag every object with a client tag and activate the tag in the Billing and Cost Management console as a cost allocation tag.
- B. Create a separate bucket for each client project, tag each bucket with a client tag, and activate the tag as a cost allocation tag.
- C. Enable S3 Storage Lens with prefix aggregation and multiply each project's stored bytes by the storage price in a monthly report.
- D. Turn on the Cost and Usage Report with resource IDs and group the bucket's storage charges by object key prefix with Amazon Athena.

**Answer:** B

**Explanation:** S3 cost allocation tags can be applied only to buckets, so each project needs its own bucket; once the tag is activated in Billing, Cost Explorer can group storage cost by it.
- Object tags: not used for cost allocation, so no cost appears per client (dùng sai tính năng)
- Storage Lens bytes priced by hand: a manual estimate outside Cost Explorer (vi phạm ràng buộc)
- CUR grouped by key prefix: billing line items stop at the bucket, not the prefix (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/CostAllocTagging.html
> 🇻🇳 Thẻ phân bổ chi phí S3 chỉ gắn cho bucket (không phải object/prefix) → mỗi dự án một bucket + kích hoạt thẻ.

---

## Q ai-20261022-a41-18
- domain: cost
- task: 4.1
- topic: storage
- services: S3, S3 Glacier
- tags: s3-glacier-tiers, retrieval-cost
- difficulty: hard
- time: 120
- skills: 4.1.k10, 4.1.s8, 4.1.k9
- concept: Glacier Flexible Retrieval has free Bulk retrievals and Expedited retrievals in minutes, which beats Instant Retrieval on retrieval cost and Deep Archive on speed
- refs: 02-storage-services.md, D-kien-truc-luu-tru.md
- hint: Tổng chi phí gồm cả phí truy xuất — lớp nào có truy xuất hàng loạt miễn phí và vẫn có lựa chọn lấy tệp trong vài phút?
- created: 2026-10-22
- enriched: 2026-10-22

An environmental agency archives 800 TB of satellite imagery. Scientists plan restores of about 20 TB of older imagery a few times a year and can wait up to a day for them. Rarely, a scientist needs a handful of files within minutes. The agency wants the lowest total cost, including retrieval charges, and will not tier data by hand. Which storage solution will meet these requirements MOST cost-effectively?

- A. Store the imagery in S3 Glacier Instant Retrieval and read the planned and urgent files directly with GET requests.
- B. Store the imagery in S3 Intelligent-Tiering with the Archive Access and Deep Archive Access tiers activated.
- C. Store the imagery in S3 Glacier Flexible Retrieval and use Bulk retrievals for planned restores and Expedited for urgent files.
- D. Store the imagery in S3 Glacier Deep Archive and use Bulk retrievals for planned restores and Standard retrievals for urgent files.

**Answer:** C

**Explanation:** Flexible Retrieval has a low storage price, Bulk retrievals are free for the planned restores, and Expedited retrievals return urgent files within minutes.
- Glacier Instant Retrieval: millisecond reads, but a higher storage price plus per-GB retrieval fees on every planned restore (tốn chi phí hơn)
- Intelligent-Tiering with both archive tiers: older imagery sits in Deep Archive Access, which cannot return files within minutes (vi phạm ràng buộc)
- Deep Archive: Standard retrieval takes hours and Expedited is not available, so urgent requests miss the minutes requirement (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects-retrieval-options.html
> 🇻🇳 Khôi phục hàng loạt theo kế hoạch + hiếm khi cần trong vài phút → Glacier Flexible Retrieval (Bulk miễn phí, Expedited).

---

## Q ai-20261022-a41-19
- domain: cost
- task: 4.1
- topic: cost
- services: Organizations, S3
- tags: consolidated-billing, volume-discount
- difficulty: easy
- time: 95
- skills: 4.1.k2
- concept: Consolidated billing in AWS Organizations combines usage across accounts so that volume pricing tiers and shared discounts apply
- refs: 06-management-governance.md
- hint: Mỗi tài khoản riêng lẻ chưa đủ lớn để vào bậc giá thấp hơn — tính năng nào gộp mức sử dụng của nhiều tài khoản mà không đổi kiến trúc?
- created: 2026-10-22
- enriched: 2026-10-22

A retail group has seven business units, each with its own standalone AWS account that is paid with a separate corporate credit card. Together the accounts store about 280 TB in Amazon S3 Standard, but no single account is large enough to reach the lower per-GB price tiers, so every account pays the highest storage rate. The group does not want to move data or change any architecture. Which action will reduce the S3 storage cost while meeting these requirements?

- A. Purchase a Compute Savings Plan in one account and share its discount across the seven accounts to cover their Amazon S3 storage.
- B. Purchase S3 reserved capacity in each account for a one-year term to receive a discount on the storage that it uses.
- C. Activate cost allocation tags in every account so that the tagged storage qualifies for lower tiered pricing rates.
- D. Create an AWS Organizations organization, invite the seven accounts, and use consolidated billing so that usage is combined.

**Answer:** D

**Explanation:** Consolidated billing combines usage across member accounts, so the group reaches the lower volume price tiers (and shares Reserved Instance and Savings Plans discounts) at no extra fee, with no data movement.
- Savings Plan sharing: Compute Savings Plans discount compute, not S3 storage (dùng sai tính năng)
- Moving data into one account: violates the rule to leave data and architecture unchanged (vi phạm ràng buộc)
- Cost allocation tags: tags only organize reporting and do not change prices (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/consolidated-billing.html
> 🇻🇳 Nhiều tài khoản riêng lẻ → AWS Organizations + consolidated billing để gộp mức dùng, hưởng bậc giá theo khối lượng.
