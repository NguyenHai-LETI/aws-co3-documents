---
pack: ai-2026-10-22-tier-a-3-1
title: "AI · Tầng A · Task 3.1 — Lưu trữ hiệu năng cao và mở rộng"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 3.1"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 3.1"
---

# AI · Tầng A · Task 3.1 — Lưu trữ hiệu năng cao và mở rộng

## Q ai-20261022-a31-01
- domain: performance
- task: 3.1
- topic: storage
- services: EBS, EC2
- tags: ebs-volume-types, elastic-volumes
- difficulty: hard
- time: 140
- skills: 3.1.s1, 3.1.k2
- concept: gp3 (up to 80,000 IOPS and 2,000 MiB/s, independent of size) changed online with Elastic Volumes beats resizing gp2 or paying for io2 Block Express when the numbers fit gp3
- refs: 02-storage-services.md, R-performance-benchmarks.md
- hint: So IOPS và throughput cần có với giới hạn hiện hành của gp2, gp3, io2 — loại nào đủ, rẻ nhất và đổi được khi DB vẫn chạy?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A logistics company runs a self-managed PostgreSQL database on a large Nitro-based Amazon EC2 instance. The 3 TiB data volume is a General Purpose SSD (gp2) volume, and month-end batch jobs now saturate it at about 9,000 IOPS and 250 MiB/s. Monitoring shows that the database needs a sustained 45,000 IOPS and 1,200 MiB/s. Single-digit millisecond latency is acceptable, the database cannot be stopped, and the company wants the lowest-cost fix. Which solution will meet these requirements MOST cost-effectively?

- A. Use Elastic Volumes to change the volume type to io2 Block Express and provision 45,000 IOPS while the instance stays in service.
- B. Use Elastic Volumes to increase the size of the gp2 volume until its baseline performance reaches 45,000 IOPS and 1,200 MiB/s.
- C. Use Elastic Volumes to change the volume type to gp3 and provision 45,000 IOPS and 1,200 MiB/s of throughput on the running volume.
- D. Create four gp2 volumes in a RAID 0 array, copy the database files to the array, and cut the database over during a planned maintenance window.

**Answer:** C

**Explanation:** gp3 performance is provisioned separately from capacity: up to 80,000 IOPS (500 IOPS per GiB) and 2,000 MiB/s (0.25 MiB/s per provisioned IOPS), so a 3 TiB volume can carry 45,000 IOPS and 1,200 MiB/s. Elastic Volumes changes the type without stopping the instance, and gp3 is the lowest-cost SSD that meets the numbers.
- io2 Block Express: also works, but nothing requires sub-millisecond latency, so the extra price buys nothing (tốn chi phí hơn)
- Larger gp2 volume: gp2 tops out at 16,000 IOPS and 250 MiB/s whatever its size (cấu hình không tồn tại)
- RAID 0 of gp2 volumes: needs a data copy and a cutover that stops the database (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/ebs/latest/userguide/general-purpose.html
> 🇻🇳 gp3 cấp IOPS/throughput tách khỏi dung lượng (trong tỉ lệ 500 IOPS/GiB, 0,25 MiB/s mỗi IOPS), đổi loại online bằng Elastic Volumes và rẻ hơn io2.

---

## Q ai-20261022-a31-02
- domain: performance
- task: 3.1
- topic: storage
- services: EC2
- tags: instance-store, scratch-storage
- difficulty: easy
- time: 110
- skills: 3.1.s1, 3.1.k3
- concept: Local NVMe instance store gives the lowest latency and highest IOPS for scratch data that need not survive a stop or termination, at no extra storage cost
- refs: 02-storage-services.md, 01-compute-services.md
- hint: Dữ liệu tạm, đọc ngẫu nhiên, không cần sống sót sau khi dừng máy — loại lưu trữ nào gắn thẳng vào host và đã nằm trong giá instance?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A genomics company runs analysis jobs on a fleet of Amazon EC2 instances. Each job writes several hundred gigabytes of intermediate files, reads them back in a random pattern, and deletes them when the job ends; final results are written to Amazon S3. The intermediate files do not need to survive a stop or termination of the instance. The jobs are limited by storage latency and IOPS, and the company does not want to pay for storage on top of the instance price. Which configuration will provide the HIGHEST performance for the intermediate files?

- A. Attach a Provisioned IOPS io2 Block Express volume to each instance and configure the volume to be deleted when the instance terminates.
- B. Choose instance types that include local NVMe instance store volumes and write the intermediate files to those volumes.
- C. Mount an Amazon FSx for Lustre scratch file system on every instance and write the intermediate files to it for sub-millisecond latency.
- D. Write the intermediate files to an S3 Express One Zone directory bucket in the same Availability Zone as the instances.

**Answer:** B

**Explanation:** Instance store volumes sit on the host, so they give the lowest latency and highest IOPS, they are included in the instance price, and losing them on stop or termination is acceptable for scratch data.
- io2 Block Express volume: network-attached storage billed for capacity and IOPS on top of the instance price (vi phạm ràng buộc)
- FSx for Lustre scratch file system: fast shared storage, but billed separately and reached over the network (vi phạm ràng buộc)
- S3 Express One Zone: low-latency object storage, but billed per GB and request and slower than local NVMe (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/InstanceStorage.html
> 🇻🇳 Dữ liệu tạm cần IOPS và độ trễ tốt nhất, không cần bền → instance store (NVMe gắn trực tiếp host), đã nằm trong giá instance.

---

## Q ai-20261022-a31-03
- domain: performance
- task: 3.1
- topic: storage
- services: EFS, EC2
- tags: efs-throughput-modes, elastic-throughput
- difficulty: medium
- skills: 3.1.s2, 3.1.k2
- concept: A new EFS file system for spiky, unpredictable load uses Elastic throughput with General Purpose performance mode (Max I/O is unsupported with Elastic; One Zone is not AZ-resilient)
- refs: 02-storage-services.md, R-performance-benchmarks.md
- hint: Tải đột biến, khó dự báo, phải sống sót khi mất một AZ — hai thiết lập lúc tạo EFS nào cùng dùng được và khỏi phải đoán throughput?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A video-rendering company is moving its Linux render farm to AWS. Hundreds of Amazon EC2 instances in three Availability Zones will mount one shared POSIX file system. Throughput demand is unpredictable: the file system sits idle for hours and then drives large bursts when projects are submitted. The company wants performance to scale automatically without forecasting throughput, and the file system must remain available if one Availability Zone fails. Which combination of settings should a solutions architect choose when creating the Amazon EFS file system? (Choose TWO)

- A. Select Max I/O performance mode so that the highly parallel rendering jobs get the highest aggregate throughput.
- B. Select Elastic throughput mode so that throughput follows the rendering workload up and down.
- C. Select Provisioned throughput mode and set the throughput to the peak that the render farm is expected to reach.
- D. Create a One Zone file system in one Availability Zone and mount it from the instances in the three zones.
- E. Select General Purpose performance mode to get the lowest per-operation latency for the file system.

**Answer:** B, E

**Explanation:** Elastic throughput scales with spiky, unpredictable workloads without forecasting, and General Purpose is the lowest-latency performance mode and the one that works with Elastic throughput.
- Max I/O performance mode: a previous-generation mode with higher latency, not supported with Elastic throughput (dùng sai tính năng)
- Provisioned throughput: sized to the forecast peak and billed for what is provisioned, even while idle (tốn chi phí hơn)
- One Zone file system: keeps data in one Availability Zone, so losing that zone makes it unavailable (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/efs/latest/ug/performance.html
> 🇻🇳 EFS tải đột biến, khó dự báo → Elastic throughput + General Purpose (Max I/O không đi với Elastic; One Zone không chịu được lỗi AZ).

---

## Q ai-20261022-a31-04
- domain: performance
- task: 3.1
- topic: storage
- services: FSx, DataSync
- tags: fsx-ontap, hybrid-storage, multi-protocol
- difficulty: medium
- time: 110
- skills: 3.1.k1, 3.1.k2
- concept: Only FSx for NetApp ONTAP serves the same data over NFS and SMB and keeps NetApp replication working; Lustre is Linux-only, OpenZFS is NFS-only, Windows File Server is SMB-only
- refs: 02-storage-services.md, 10-migration-transfer.md
- hint: Cùng một dữ liệu phải mở được bằng NFS lẫn SMB và còn dùng công cụ nhân bản của NetApp — mỗi loại FSx hỗ trợ giao thức nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

An engineering company stores simulation data on on-premises NetApp file servers. Linux compute nodes read the data over NFS, and engineers on Windows workstations open the same files over SMB. The company will burst simulation jobs into AWS during peak weeks and wants to keep replicating volumes with the NetApp tooling it already uses, without changing how any client mounts the data. Which AWS storage solution will meet these requirements with the LEAST operational overhead?

- A. Create an Amazon FSx for NetApp ONTAP file system and copy the on-premises volumes into it with scheduled AWS DataSync tasks.
- B. Create an Amazon FSx for OpenZFS file system and replicate the on-premises NetApp volumes into it by using NetApp SnapMirror.
- C. Run a self-managed NetApp ONTAP virtual appliance on Amazon EC2 and replicate the on-premises volumes to it with NetApp SnapMirror.
- D. Create an Amazon FSx for NetApp ONTAP file system and replicate the on-premises volumes to it by using NetApp SnapMirror.

**Answer:** D

**Explanation:** FSx for NetApp ONTAP serves the same data over NFS and SMB and supports SnapMirror replication, so existing clients and tooling keep working without changes or servers to manage.
- FSx for ONTAP fed by DataSync: right file system, but the company must keep replicating with its NetApp tooling (vi phạm ràng buộc)
- FSx for OpenZFS with SnapMirror: SnapMirror replicates only between ONTAP systems (cấu hình không tồn tại)
- Self-managed ONTAP on EC2: keeps SnapMirror, but the team patches and operates the appliance (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/what-is-fsx-ontap.html
> 🇻🇳 Cùng dữ liệu cho NFS lẫn SMB + SnapMirror của NetApp → FSx for NetApp ONTAP; Lustre, OpenZFS, Windows chỉ một giao thức.

---

## Q ai-20261022-a31-05
- domain: performance
- task: 3.1
- topic: storage
- services: S3
- tags: s3-transfer-acceleration, s3-multipart-upload
- difficulty: medium
- time: 145
- skills: 3.1.s1, 3.1.k2
- concept: Long-distance uploads of very large objects: Transfer Acceleration for distance plus multipart upload for parallelism and partial retries
- refs: 02-storage-services.md, R-performance-benchmarks.md
- hint: Hai vấn đề tách biệt — khoảng cách địa lý tới bucket và file khổng lồ hay đứt giữa chừng; mỗi vấn đề có một tính năng riêng của S3.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A film-production company's field crews around the world upload raw footage files of 30–60 GB each to a single Amazon S3 bucket in us-east-1 over the public internet. Uploads from Asia and Australia are slow, and a dropped connection near the end of an upload forces the crew to restart the whole file. The company wants faster and more reliable uploads without changing the bucket or the Region where the data is stored. Which combination of actions will meet these requirements? (Choose TWO)

- A. Enable S3 Transfer Acceleration on the bucket and upload through the bucket's accelerate endpoint.
- B. Create an S3 Multi-Region Access Point and have each crew upload through it so that requests travel over the AWS global network.
- C. Upload each file with the S3 multipart upload API, sending the parts in parallel and retrying only the parts that fail.
- D. Connect each crew site with AWS Site-to-Site VPN to a VPC and upload to the bucket through an S3 gateway endpoint in that VPC.
- E. Upload each file in a single PUT request that includes a Content-MD5 checksum so that S3 rejects any corrupted upload.

**Answer:** A, C

**Explanation:** Transfer Acceleration sends each upload to the nearest CloudFront edge location and then over an optimized AWS network path, which helps distant crews, and multipart upload sends parts in parallel and retries only a failed part.
- Multi-Region Access Point: accelerates over the AWS network but needs buckets in several Regions, which changes where data is stored (vi phạm ràng buộc)
- Site-to-Site VPN to a gateway endpoint: gateway endpoints cannot be used from on-premises networks over VPN (cấu hình không tồn tại)
- Single PUT with Content-MD5: checks integrity, but one PUT cannot carry objects larger than 5 GB (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/transfer-acceleration.html
> 🇻🇳 Upload xa, file lớn, hay rớt → Transfer Acceleration + multipart upload (song song, chỉ gửi lại phần lỗi).

---

## Q ai-20261022-a31-06
- domain: performance
- task: 3.1
- topic: storage
- services: S3
- tags: s3-prefixes, request-rate
- difficulty: medium
- time: 120
- skills: 3.1.s2, 3.1.s1
- concept: S3 request rates scale per key prefix; 503 Slow Down on one hot prefix is fixed by spreading keys across many prefixes and parallelizing, not by quotas, acceleration or multipart
- refs: 02-storage-services.md, R-performance-benchmarks.md
- hint: Lỗi 503 Slow Down khi mọi khoá bắt đầu giống nhau — S3 mở rộng tốc độ request theo đơn vị nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

An IoT analytics company ingests sensor files into one Amazon S3 bucket. Thousands of devices upload small objects, and every object key begins with the same date segment, such as 2026-10-22/device-id/file. At peak, the ingestion service sends about 12,000 PUT requests per second to keys that begin with the same date and receives HTTP 503 Slow Down responses. The data must stay in one bucket in the S3 Standard storage class for later queries. The company needs a higher sustained write rate. Which solution will meet these requirements?

- A. Add a short hash to the beginning of each object name so that requests spread across many prefixes, and send the uploads in parallel.
- B. Add exponential backoff with jitter to the ingestion service so that it retries the object uploads that receive a 503 Slow Down response.
- C. Write the sensor files to an S3 Express One Zone directory bucket, which supports far higher request rates than general purpose buckets.
- D. Open an AWS Support case to raise the per-prefix PUT request rate quota of the bucket above its current limit.

**Answer:** A

**Explanation:** S3 scales request rates per key prefix and allows unlimited prefixes, so spreading objects across many prefixes and sending requests in parallel raises the sustained PUT rate.
- Exponential backoff: smooths retries, but the hot prefix keeps the same request-rate ceiling (giải bài toán khác)
- S3 Express One Zone: high request rates, but the data must stay in S3 Standard in the existing bucket (vi phạm ràng buộc)
- Support case for a higher per-prefix rate: request rates scale with prefixes, not through a quota (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html
> 🇻🇳 503 Slow Down trên một prefix → rải object ra nhiều prefix và gửi song song; không có quota để nâng tốc độ request.

---

## Q ai-20261022-a31-07
- domain: performance
- task: 3.1
- topic: storage
- services: S3, EC2
- tags: s3-express-one-zone, low-latency
- difficulty: hard
- time: 140
- skills: 3.1.s1, 3.1.k2
- concept: S3 Express One Zone directory buckets in the compute's Availability Zone give single-digit-millisecond request latency for small-object ML workloads when single-AZ storage is acceptable
- refs: 02-storage-services.md, R-performance-benchmarks.md
- hint: Điểm quyết định là độ trễ của từng request, không phải số request mỗi giây — đọc kỹ ràng buộc về AZ và khả năng tái tạo dữ liệu.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A machine-learning team trains models on a fleet of GPU instances that all run in one Availability Zone. Each training epoch reads tens of millions of small image files from an Amazon S3 Standard bucket, and the GPUs sit idle waiting on the first-byte latency of those requests. The training data is copied from a durable source bucket before every run and can be recreated at any time. The team must keep using the Amazon S3 API and wants the lowest possible request latency. Which solution will meet these requirements?

- A. Mount the Standard bucket on the instances with Mountpoint for Amazon S3 and turn on its local cache for the training data.
- B. Spread the image files across many key prefixes in the Standard bucket and add more reader threads to the training code.
- C. Copy the data set into an S3 Express One Zone directory bucket in the same Availability Zone as the instances and read from it.
- D. Copy the data set into an S3 One Zone-IA bucket in the same Availability Zone as the GPU instances and read the training files from it.

**Answer:** C

**Explanation:** S3 Express One Zone directory buckets give consistent single-digit-millisecond access for many small objects, fastest when placed in the compute's Availability Zone; single-zone storage is acceptable because the data can be recreated.
- Mountpoint for Amazon S3 with caching: presents a file interface, so the code would stop using the S3 API (vi phạm ràng buộc)
- More prefixes and reader threads: raise the request rate, but every request keeps Standard-class latency (giải bài toán khác)
- S3 One Zone-IA: stores data in one zone but has Standard-class first-byte latency plus retrieval fees (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/directory-bucket-high-performance.html
> 🇻🇳 Cần độ trễ S3 thấp nhất, dữ liệu tái tạo được → S3 Express One Zone (directory bucket) cùng AZ với compute.
