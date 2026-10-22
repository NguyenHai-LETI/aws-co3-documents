---
pack: ai-2026-10-22-tier-a-4-1
title: "AI · Tầng A · Task 4.1 — Lưu trữ tối ưu chi phí (S3, EBS, EFS, lifecycle)"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 4.1"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 4.1"
---

# AI · Tầng A · Task 4.1 — Lưu trữ tối ưu chi phí (S3, EBS, EFS, lifecycle)

## Q ai-20261022-a41-01
- domain: cost
- task: 4.1
- topic: storage
- services: S3
- tags: requester-pays, data-transfer-cost
- difficulty: medium
- skills: 4.1.k1
- concept: S3 Requester Pays shifts request and data transfer charges to authenticated requesters while the owner pays only for storage
- refs: 02-storage-services.md
- hint: Chủ bucket muốn ngừng trả phí request và tải dữ liệu của người khác, nhưng vẫn chỉ cho đúng các tài khoản đối tác đọc.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A genomics research institute publishes a 300 TB reference dataset in an Amazon S3 bucket. About 40 partner universities, each with its own AWS account, download parts of the dataset every month, and the institute's data transfer and request charges now exceed its research budget. The institute wants to stop paying for the partners' downloads while keeping the data readable only by the partner accounts. Which solution will meet these requirements MOST cost-effectively?

- A. Enable S3 Transfer Acceleration on the bucket and ask the partners to download through the accelerated endpoint so that transfers finish sooner and cost less.
- B. Configure replication from the bucket to a destination bucket in every partner account so that each university reads its own local copy of the dataset.
- C. Enable Requester Pays on the bucket and grant the partner accounts read access with a bucket policy, so that partners include the request-payer parameter in requests.
- D. Make the bucket public, enable Requester Pays, and publish the object URLs so that the partners can download the dataset without presenting any credentials or signing their requests.

**Answer:** C

**Explanation:** Requester Pays makes each authenticated requester pay for its own requests and data transfer, while the institute pays only for storage; the bucket policy limits reads to the partner accounts.
- Transfer Acceleration: speeds up transfers and adds a fee, but the bucket owner still pays (giải bài toán khác)
- Replication to every partner account: the institute pays transfer, requests and storage for each copy (tốn chi phí hơn)
- Public bucket with Requester Pays: anonymous requests are rejected, and public access breaks the access limit (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/RequesterPaysBuckets.html
> 🇻🇳 Muốn đối tác tự trả phí request và tải dữ liệu → bật Requester Pays; bắt buộc có xác thực, không cho truy cập ẩn danh.

---

## Q ai-20261022-a41-02
- domain: cost
- task: 4.1
- topic: storage
- services: S3, Data Firehose, Athena
- tags: s3-batching, request-cost, small-objects
- difficulty: medium
- skills: 4.1.s1
- concept: Batching many tiny writes into larger S3 objects cuts per-request charges (batch uploads versus individual uploads)
- refs: 02-storage-services.md, 09-analytics-bigdata.md
- hint: Hàng trăm triệu object nhỏ ghi riêng lẻ làm phí request chiếm phần lớn hoá đơn — cần giảm số lượng request, không phải số byte.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A logistics company's tracking service writes each GPS event, about 2 KB of JSON, to Amazon S3 as its own object. The service produces roughly 150 million events per day, and S3 request charges are now the largest part of the storage bill. Analysts query the data once a day with Amazon Athena, and a delay of a few minutes before events become queryable is acceptable. Which change will reduce the S3 cost the MOST?

- A. Send the events to Amazon Data Firehose, which buffers them and delivers larger compressed objects to the bucket.
- B. Compress the events with gzip before uploading them, and keep writing one object per event to the bucket.
- C. Upload each event with the S3 multipart upload API so that the request is committed as several smaller parts in parallel.
- D. Enable S3 Transfer Acceleration on the bucket so that each small upload reaches S3 over the AWS edge network.

**Answer:** A

**Explanation:** Firehose concatenates many records into one S3 object per buffering interval, so the number of PUT requests drops by orders of magnitude; larger objects are also cheaper to scan with Athena.
- Per-event gzip: shrinks bytes but not the request count (giải bài toán khác)
- Multipart upload per event: adds extra requests for tiny objects (dùng sai tính năng)
- Transfer Acceleration: adds a per-GB fee and does not reduce requests (giải bài toán khác)
Docs: https://docs.aws.amazon.com/firehose/latest/dev/basic-deliver.html
> 🇻🇳 Phí request S3 lớn vì ghi từng object nhỏ → gom (batch) bằng Firehose thành object lớn hơn.

---

## Q ai-20261022-a41-03
- domain: cost
- task: 4.1
- topic: storage
- services: S3
- tags: s3-storage-classes, s3-intelligent-tiering, small-objects
- difficulty: hard
- skills: 4.1.k10, 4.1.s8
- concept: Objects under 128 KB are not tiered by Intelligent-Tiering and are billed at a 128 KB minimum in IA and Glacier Instant Retrieval, so Standard is cheapest
- refs: 02-storage-services.md, D-kien-truc-luu-tru.md
- hint: Kích thước từng object rất nhỏ — hãy nhớ quy tắc kích thước tối thiểu tính phí và điều kiện tự động chuyển tầng của từng lớp lưu trữ.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 125

A photo-sharing company stores about 600 million profile thumbnails in Amazon S3 Standard. Each thumbnail is about 10 KB. Most thumbnails have not been requested for over a year, but users open old profiles at unpredictable times and the application needs millisecond access. A colleague suggests moving the bucket to a cheaper storage class to save money. The company wants the MOST cost-effective storage approach for this data. What should a solutions architect recommend?

- A. Transition the thumbnails to S3 Standard-IA after 30 days because they are rarely read after the first month.
- B. Transition the thumbnails to S3 Glacier Instant Retrieval after 90 days because they need millisecond access but are rarely read.
- C. Store the thumbnails in S3 Intelligent-Tiering so that unrequested thumbnails move to cheaper access tiers automatically.
- D. Keep the thumbnails in S3 Standard and add no transition rules, because objects this small gain nothing from the cheaper classes.

**Answer:** D

**Explanation:** Standard-IA and Glacier Instant Retrieval bill at least 128 KB per object, and every transition is a per-object request, so for 10 KB objects the savings disappear; Intelligent-Tiering does not monitor or tier objects under 128 KB.
- Standard-IA: the 128 KB minimum billable size and retrieval fees raise the cost (tốn chi phí hơn)
- Glacier Instant Retrieval: the same minimum size, plus transition requests for 600 million objects (tốn chi phí hơn)
- Intelligent-Tiering: small objects stay in the Frequent Access tier at full price (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html
> 🇻🇳 Object nhỏ hơn 128 KB: IA/Glacier IR tính tối thiểu 128 KB và Intelligent-Tiering không chuyển tầng → giữ S3 Standard.

---

## Q ai-20261022-a41-04
- domain: cost
- task: 4.1
- topic: storage
- services: S3
- tags: s3-lifecycle, s3-versioning, s3-multipart-upload
- difficulty: medium
- skills: 4.1.s5, 4.1.s9, 4.1.k7
- concept: Lifecycle rules should expire noncurrent versions after the undo window and abort incomplete multipart uploads
- refs: 02-storage-services.md
- hint: Chi phí tăng do phiên bản cũ và các phần upload dang dở — hai loại dữ liệu này cần hai hành động lifecycle khác nhau.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 125

A document-management company stores customer files in an Amazon S3 bucket that has versioning enabled. The application overwrites files often, so older versions pile up and storage costs keep rising. Staff open current files throughout the day, and users upload large videos with multipart uploads that are frequently abandoned halfway. The company needs only the previous 30 days of versions for undo and wants to cut storage cost without changing the application. Which TWO S3 Lifecycle actions should a solutions architect configure? (Choose TWO)

- A. Transition current object versions to S3 Glacier Deep Archive a few days after they are created.
- B. Expire noncurrent object versions 30 days after they become noncurrent.
- C. Disable versioning on the bucket so that overwrites stop creating new versions.
- D. Abort incomplete uploads that remain unfinished beyond a set number of days.
- E. Transition every object version to S3 One Zone-IA immediately after upload.

**Answer:** B, D

**Explanation:** Expiring noncurrent versions after the undo window removes storage nobody needs, and the abort-incomplete-multipart-upload action deletes orphaned parts that normal expiration rules do not remove.
- Deep Archive for current versions: staff open them daily and restores take hours (vi phạm ràng buộc)
- Disabling versioning: it can only be suspended, and the 30-day undo is required (vi phạm ràng buộc)
- One Zone-IA for everything: frequent reads add retrieval fees and minimum storage charges (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/intro-lifecycle-rules.html
> 🇻🇳 Bucket bật versioning: hết hạn noncurrent version + abort multipart upload dở dang để giảm chi phí.

---

## Q ai-20261022-a41-05
- domain: cost
- task: 4.1
- topic: storage
- services: S3, EFS, EBS, FSx
- tags: storage-types, object-storage, s3-lifecycle
- difficulty: medium
- skills: 4.1.k11, 4.1.k4, 4.1.s10
- concept: Object storage (S3) is the cheapest shared store when the application supports it; file storage (EFS) costs more per GB
- refs: 02-storage-services.md, D-kien-truc-luu-tru.md
- hint: Cả hai back end đều dùng được — loại lưu trữ nào rẻ nhất trên mỗi GB cho dữ liệu ít đọc, tự mở rộng, không cần cấp phát trước?
- family: cms-media-storage
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A publishing company is moving its Linux-based content management system (CMS) from an on-premises NAS to Amazon EC2 instances in an Auto Scaling group across three Availability Zones. The CMS stores about 60 TB of images and PDFs that grow steadily, and every instance must read and write the same media library. The company does not want to provision capacity in advance. The CMS vendor supports two back ends: a shared POSIX file system mounted over NFS at the same path used today, or an S3 media plugin that is enabled with a configuration setting. Most files are rarely read after their first month. Which solution will meet these requirements MOST cost-effectively?

- A. Create an Amazon FSx for Lustre file system linked to an S3 bucket and mount it on every instance so that each instance shares the media library through it.
- B. Switch the library to an Amazon S3 bucket through its built-in S3 option and use S3 Lifecycle rules to move older media to lower-cost storage classes.
- C. Attach one Multi-Attach enabled Provisioned IOPS (io2) EBS volume to every instance and share the library through a cluster-aware file system.
- D. Create an Amazon EFS file system with lifecycle policies for Infrequent Access and mount it on every instance at the existing media directory.

**Answer:** B

**Explanation:** S3 has the lowest price per GB, grows automatically across all Availability Zones, needs no provisioning, and the built-in option is only a setting; lifecycle rules reduce the price of cold media further.
- EFS with lifecycle policies: managed and shared, but its per-GB price stays above S3 (tốn chi phí hơn)
- Multi-Attach io2 volume: attaches only to instances in one Availability Zone and needs provisioned capacity (vi phạm ràng buộc)
- FSx for Lustre: provisioned high-performance capacity that the CMS does not need (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html
> 🇻🇳 Thư viện media ít đọc, nhiều AZ, nhà cung cấp hỗ trợ S3 → object storage (S3 + lifecycle) rẻ nhất.

---

## Q ai-20261022-a41-06
- domain: cost
- task: 4.1
- topic: storage
- services: S3, EFS, EBS, FSx
- tags: storage-types, file-storage, efs-lifecycle
- difficulty: medium
- skills: 4.1.k11, 4.1.k4
- concept: EFS provides shared POSIX file storage mounted at an existing path, so the application needs no configuration change
- refs: 02-storage-services.md, D-kien-truc-luu-tru.md
- hint: Đề giữ nguyên bối cảnh nhưng yêu cầu thay đổi cấu hình CMS ít nhất — loại lưu trữ nào gắn như hệ thống tệp POSIX dùng chung?
- family: cms-media-storage
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A publishing company is moving its Linux-based content management system (CMS) from an on-premises NAS to Amazon EC2 instances in an Auto Scaling group across three Availability Zones. The CMS stores about 60 TB of images and PDFs that grow steadily, and every instance must read and write the same media library. The company does not want to provision capacity in advance. The CMS vendor supports two back ends: a shared POSIX file system mounted over NFS at the same path used today, or an S3 media plugin that is enabled with a configuration setting. Most files are rarely read after their first month. Which solution will meet these requirements with the LEAST amount of change to the CMS configuration?

- A. Create an Amazon FSx for Lustre file system linked to an S3 bucket and mount it on every instance so that each instance shares the media library through it.
- B. Switch the library to an Amazon S3 bucket through its built-in S3 option and use S3 Lifecycle rules to move older media to lower-cost storage classes.
- C. Attach one Multi-Attach enabled Provisioned IOPS (io2) EBS volume to every instance and share the library through a cluster-aware file system.
- D. Create an Amazon EFS file system with lifecycle policies for Infrequent Access and mount it on every instance at the existing media directory.

**Answer:** D

**Explanation:** EFS is a shared, elastic NFS file system across Availability Zones, so mounting it at the directory the CMS already uses needs no configuration change, and lifecycle policies still move cold files to a cheaper class.
- S3 option: requires enabling the plugin and changing the CMS configuration (vi phạm ràng buộc)
- Multi-Attach io2 volume: attaches only to instances in one Availability Zone and needs provisioned capacity (vi phạm ràng buộc)
- FSx for Lustre: provisioned capacity that the company does not want to size in advance (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/efs/latest/ug/lifecycle-management-efs.html
> 🇻🇳 Giữ nguyên đường dẫn NFS/POSIX, nhiều AZ, không cấp phát trước → EFS (file storage) thay vì sửa cấu hình CMS sang S3.

---

## Q ai-20261022-a41-07
- domain: cost
- task: 4.1
- topic: storage
- services: EBS
- tags: ebs-volume-types, st1
- difficulty: easy
- skills: 4.1.k6, 4.1.s10
- concept: Throughput Optimized HDD (st1) is the cheapest block type for frequently read large sequential data; sc1 is for cold data and gp3/io2 cost more per GiB
- refs: 02-storage-services.md, D-kien-truc-luu-tru.md
- hint: Luồng đọc tuần tự lớn, dữ liệu vẫn được đọc thường xuyên, không phải boot volume — HDD loại nào hướng tới thông lượng?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 105

An analytics company runs a nightly log-processing job on a Linux Amazon EC2 instance. The job streams through about 8 TiB of sequential log files on a data volume and needs sustained throughput of about 300 MiB/s. Other batch jobs read the same files throughout the day, so the data is not cold. Random I/O is minimal and the volume is not the boot volume. The team wants to minimize storage cost. Which solution will meet these requirements MOST cost-effectively?

- A. Create a Throughput Optimized HDD (st1) volume of about 10 TiB, because its baseline throughput scales with the volume size.
- B. Create a General Purpose SSD (gp3) volume of about 10 TiB and provision extra throughput on the volume to reach the required rate.
- C. Create a Cold HDD (sc1) volume of about 10 TiB to get the lowest price per GiB for the large sequential log files.
- D. Create a Provisioned IOPS SSD (io2) volume of about 10 TiB and provision enough IOPS to sustain the required throughput.

**Answer:** A

**Explanation:** An st1 volume is built for large sequential, frequently accessed data, and at about 10 TiB its baseline throughput (40 MiB/s per TiB) exceeds the 300 MiB/s need at a lower price per GiB than SSD.
- gp3 with extra throughput: meets the rate but costs more per GiB than HDD (tốn chi phí hơn)
- sc1: designed for cold data and delivers far less baseline throughput, with a 250 MiB/s ceiling (vi phạm ràng buộc)
- io2: Provisioned IOPS capacity is far more than a sequential workload needs (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/ebs/latest/userguide/hdd-vols.html
> 🇻🇳 Đọc tuần tự lớn, truy cập thường xuyên, cần thông lượng ổn định → EBS st1 (HDD), rẻ hơn SSD; sc1 chỉ cho dữ liệu lạnh.

---

## Q ai-20261022-a41-08
- domain: cost
- task: 4.1
- topic: storage
- services: EBS, CloudWatch
- tags: ebs-volume-types, right-sizing, elastic-volumes
- difficulty: medium
- skills: 4.1.s2, 4.1.s4, 4.1.k6
- concept: EBS volumes cannot be shrunk and have no native auto scaling, so right-size by migrating to a smaller volume and automate growth with Elastic Volumes
- refs: 02-storage-services.md
- hint: EBS chỉ cho tăng dung lượng, không giảm và không tự mở rộng — cần cách thu nhỏ hiện tại và cách tự động hoá việc tăng sau này.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 145

A SaaS company runs a PostgreSQL database on Amazon EC2 with a 6 TiB gp3 data volume. Monitoring shows about 900 GiB in use, growing roughly 40 GiB per month, so the company pays for far more capacity than it needs. The database needs consistent low-latency random I/O, and a short maintenance window is acceptable. The team wants to pay only for the capacity it needs and avoid out-of-space outages. Which TWO actions should a solutions architect take? (Choose TWO)

- A. Create a smaller gp3 volume sized for current data plus growth and copy the database files to it during the maintenance window.
- B. Use the modify-volume operation during the maintenance window to reduce the existing gp3 database volume to a smaller size without detaching it.
- C. Create a CloudWatch alarm on disk usage that triggers automation to increase the volume size with Elastic Volumes and extend the file system.
- D. Enable the EBS automatic scaling setting on the gp3 volume so that the database volume grows by itself when free space is low.
- E. Change the volume type to Throughput Optimized HDD (st1) to lower the price per GiB of the storage that the database uses.

**Answer:** A, C

**Explanation:** EBS cannot decrease a volume, so the team creates a smaller volume and migrates the data; growth is then handled by an alarm-driven increase with Elastic Volumes, which needs no downtime.
- Reducing the volume with modify-volume: size can only increase (cấu hình không tồn tại)
- EBS automatic scaling setting: EBS has no native auto scaling (cấu hình không tồn tại)
- st1 volume: HDD is built for sequential throughput, not random database I/O (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/ebs/latest/userguide/ebs-modify-volume.html
> 🇻🇳 EBS không giảm được dung lượng và không tự scale → tạo volume nhỏ hơn rồi tự động hoá tăng dung lượng bằng alarm + Elastic Volumes.

---

## Q ai-20261022-a41-09
- domain: cost
- task: 4.1
- topic: storage
- services: AWS Backup, EBS
- tags: snapshots, backup-lifecycle, cold-storage
- difficulty: hard
- skills: 4.1.k5, 4.1.s6
- concept: AWS Backup moves monthly EBS recovery points to cold storage (EBS Snapshots Archive) for long retention at lower cost
- refs: 02-storage-services.md, 06-management-governance.md
- hint: Điểm khôi phục hằng tháng giữ nhiều năm, hiếm khi khôi phục — snapshot EBS nằm trong lưu trữ do dịch vụ quản lý, không phải bucket của bạn.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A financial-services company uses AWS Backup to protect 300 Amazon EBS volumes with a daily rule that keeps recovery points for 35 days. Auditors now require one month-end recovery point for every volume to be kept for seven years. These recovery points will almost never be restored, and a restore time of up to three days is acceptable. The company wants the lowest storage cost for the seven-year retention with the LEAST operational effort. Which solution will meet these requirements?

- A. Add a monthly rule to the backup plan that sets seven years of retention in warm storage and copies each recovery point to a second Region.
- B. Create an S3 Lifecycle rule that transitions the recovery points of the month-end EBS snapshots to S3 Glacier Deep Archive after 90 days.
- C. Add a monthly rule to the backup plan that moves recovery points to cold storage after several weeks and sets total retention to seven years.
- D. Run a scheduled Lambda function that copies each month-end volume's data into an S3 bucket with a Deep Archive rule that keeps it for seven years.

**Answer:** C

**Explanation:** For EBS, AWS Backup can transition recovery points of monthly or less frequent rules to cold storage (EBS Snapshots Archive), which costs far less for long retention; total retention must exceed the transition by at least 90 days.
- Warm storage plus a second Region: pays the highest storage price twice (tốn chi phí hơn)
- S3 Lifecycle rule on snapshots: snapshots live in service-managed storage, not in a bucket you own (đặt sai chỗ)
- Custom Lambda copy: block-level copy code to build and maintain (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/aws-backup/latest/devguide/plan-options-and-configuration.html
> 🇻🇳 Backup EBS hằng tháng giữ 7 năm, ít khôi phục → AWS Backup chuyển sang cold storage (Snapshots Archive), không dùng S3 lifecycle.

---

## Q ai-20261022-a41-10
- domain: cost
- task: 4.1
- topic: storage
- services: EFS
- tags: efs-lifecycle, storage-tiering
- difficulty: hard
- skills: 4.1.k4, 4.1.k10, 4.1.s9
- concept: EFS lifecycle policies move cold files to IA and Archive, and Transition into Standard on first access returns reopened files to Standard
- refs: 02-storage-services.md, D-kien-truc-luu-tru.md
- hint: Dự án cũ được mở lại và dùng dày đặc nhiều tuần — chính sách nào đưa tệp quay về lớp Standard khi được truy cập?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A media company stores 120 TB of project files on an Amazon EFS file system that uses the Standard storage class and Elastic throughput. After a project ends, its files are rarely opened. Occasionally an artist reopens an old project and works with it intensively for several weeks, and its files must then open with Standard-class performance. The file system must stay available if an Availability Zone fails, and the company wants to reduce storage cost without manual data movement. Which solution will meet these requirements MOST cost-effectively?

- A. Enable lifecycle transitions to Infrequent Access after 30 days and to Archive after 90 days, and leave the Transition into Standard policy at its default.
- B. Enable lifecycle transitions to Infrequent Access after 30 days and to Archive after 90 days, and set Transition into Standard to On first access.
- C. Use AWS DataSync to copy project folders older than 90 days to an S3 bucket and delete them from EFS, then copy them back when a project reopens.
- D. Migrate the data to an EFS One Zone file system, which has lower per-GB prices than the Regional storage classes.

**Answer:** B

**Explanation:** Lifecycle policies move untouched files to IA and Archive automatically, and Transition into Standard on first access moves a reopened project back to Standard, so intensive work is neither slow nor billed for repeated access in a cold class.
- Default Transition into Standard: reopened files stay in IA or Archive with slower access and per-GB access charges (vi phạm ràng buộc)
- DataSync to S3 and back: manual data movement for every project (tốn vận hành hơn)
- One Zone file system: data is not protected from an Availability Zone failure (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/efs/latest/ug/lifecycle-management-efs.html
> 🇻🇳 EFS: IA sau 30 ngày, Archive sau 90 ngày và "Transition into Standard: On first access" cho dự án mở lại.

---

## Q ai-20261022-a41-11
- domain: cost
- task: 4.1
- topic: storage
- services: S3, Organizations, Athena
- tags: s3-storage-lens, storage-access-patterns
- difficulty: hard
- skills: 4.1.k9, 4.1.k3
- concept: An organization-level S3 Storage Lens dashboard on the advanced tier gives prefix-level activity metrics and recommendations across accounts
- refs: 02-storage-services.md, 06-management-governance.md
- hint: Một khung nhìn toàn tổ chức — cần bật quyền tin cậy từ tài khoản quản lý và chọn tầng có số liệu hoạt động theo prefix.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 145

A company has 85 AWS accounts in AWS Organizations and thousands of Amazon S3 buckets. The finance team wants one view across all accounts that shows buckets without rules to expire incomplete multipart uploads and shows which prefixes are rarely requested, so that the team can add lifecycle transitions. The solution must not require custom code or per-bucket configuration. Which TWO actions will meet these requirements? (Choose TWO)

- A. Create an organization-level S3 Storage Lens dashboard on the free metrics tier and review its summary and recommendations each week.
- B. Turn on S3 Storage Class Analysis in the buckets of every account and export the reports to a central bucket.
- C. From the management account, enable trusted access for S3 Storage Lens in AWS Organizations.
- D. Run S3 Inventory on every bucket and write Athena queries that find large and unused prefixes across the accounts.
- E. Create an organization-level S3 Storage Lens dashboard on the advanced tier with activity metrics and prefix aggregation enabled.

**Answer:** C, E

**Explanation:** Organization-level Storage Lens needs trusted access enabled from the management account; the advanced tier adds prefix-level activity metrics and recommendations for finding rarely requested prefixes.
- Free-tier dashboard: lacks prefix aggregation and activity metrics (đúng một phần)
- Storage Class Analysis per bucket: configured bucket by bucket, with no organization-wide view (tốn vận hành hơn)
- S3 Inventory with Athena: custom queries to build and maintain (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage_lens_basics_metrics_recommendations.html
> 🇻🇳 Toàn tổ chức: bật trusted access cho Storage Lens + dashboard bậc advanced (activity metrics, prefix aggregation).
