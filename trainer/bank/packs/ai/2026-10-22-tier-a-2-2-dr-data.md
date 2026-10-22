---
pack: ai-2026-10-22-tier-a-2-2
title: "AI · Tầng A · Task 2.2 — DR & bảo vệ dữ liệu"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 2.2"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 2.2"
---

# AI · Tầng A · Task 2.2 — DR & bảo vệ dữ liệu

## Q ai-20261022-a22-01
- domain: resilient
- task: 2.2
- topic: resilience
- services: DynamoDB, EC2 Auto Scaling, ALB, Route 53, AWS Backup, CloudFormation
- tags: dr-pilot-light, rto-rpo, dynamodb-global-tables, multi-region
- difficulty: medium
- time: 140
- skills: 2.2.k4, 2.2.s6
- family: dr-strategy-qualifier
- concept: Pilot light is the cheapest DR strategy that meets an RPO of seconds when the RTO allows an hour of downtime
- refs: A-nen-tang-kien-truc.md, P-architecture-diagrams.md
- hint: RPO vài giây loại được phương án nào? Với RTO một giờ, thành phần nào thật sự phải chạy sẵn ở Region DR, và tiền nằm ở đâu?
- created: 2026-10-22
- enriched: 2026-10-22

A ride-sharing company runs its trip-booking API in us-east-1 on an Auto Scaling group of Amazon EC2 instances fronted by an Application Load Balancer, with trip data in an Amazon DynamoDB table. Client traffic is routed by Amazon Route 53. The company is designing disaster recovery in us-west-2 in case us-east-1 becomes unavailable. The business accepts up to one hour of downtime but only a few seconds of data loss. The application tier is stateless, and its AMIs and infrastructure are defined in AWS CloudFormation templates. Which solution meets these requirements MOST cost-effectively?

- A. Schedule hourly AWS Backup copies of the DynamoDB table and the AMIs to us-west-2, then run the CloudFormation templates, restore the table, and update the Route 53 record after a disaster
- B. Add a us-west-2 replica to form a global table and copy the AMIs, then launch the load balancer and Auto Scaling group from CloudFormation and update Route 53 once a disaster is declared
- C. Add a us-west-2 replica to form a global table, run a minimum-size Auto Scaling group behind a load balancer, and fail over with Route 53 and scale out when a disaster is declared
- D. Add a us-west-2 replica to form a global table, run full-capacity stacks in both Regions, and use Route 53 latency records with health checks to serve users from the closest healthy Region

**Answer:** B

**Explanation:** A global table keeps the DR copy current within seconds, and since an hour of downtime is acceptable, compute can stay switched off until a disaster is declared (pilot light), the cheapest design meeting the RPO.
- Hourly AWS Backup copies: up to an hour of data loss instead of seconds (vi phạm ràng buộc).
- Minimum-size group always running: meets the goals but pays for compute that a one-hour RTO does not need (tốn chi phí hơn).
- Full-capacity stacks in both Regions: near-zero RTO nobody asked for, at the highest cost (tốn chi phí hơn).
Docs: https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html
> 🇻🇳 RPO vài giây + RTO 1 giờ → pilot light: chỉ nhân bản dữ liệu liên tục, phần tính toán bật khi có thảm hoạ.

---

## Q ai-20261022-a22-02
- domain: resilient
- task: 2.2
- topic: resilience
- services: DynamoDB, EC2 Auto Scaling, ALB, Route 53, AWS Backup, CloudFormation
- tags: dr-warm-standby, dr-pilot-light, rto-rpo, dynamodb-global-tables
- difficulty: hard
- time: 160
- skills: 2.2.k4, 2.2.s6
- family: dr-strategy-qualifier
- concept: Warm standby (scaled-down but running) can serve traffic immediately, unlike pilot light, and costs less than active-active
- refs: A-nen-tang-kien-truc.md, P-architecture-diagrams.md
- hint: Điểm khác nhau nằm ở câu hỏi cuối: DR Region phải phục vụ được ngay sau failover nhưng vẫn không muốn trả tiền cho công suất đầy đủ.
- created: 2026-10-22
- enriched: 2026-10-22

A ride-sharing company runs its trip-booking API in us-east-1 on an Auto Scaling group of Amazon EC2 instances fronted by an Application Load Balancer, with trip data in an Amazon DynamoDB table. Client traffic is routed by Amazon Route 53. The company is designing disaster recovery in us-west-2 in case us-east-1 becomes unavailable. The business accepts up to one hour of downtime but only a few seconds of data loss. The application tier is stateless, and its AMIs and infrastructure are defined in AWS CloudFormation templates. Which solution meets these requirements MOST cost-effectively while letting the DR Region serve requests immediately after failover?

- A. Schedule hourly AWS Backup copies of the DynamoDB table and the AMIs to us-west-2, then run the CloudFormation templates, restore the table, and update the Route 53 record after a disaster
- B. Add a us-west-2 replica to form a global table and copy the AMIs, then launch the load balancer and Auto Scaling group from CloudFormation and update Route 53 once a disaster is declared
- C. Add a us-west-2 replica to form a global table, run a minimum-size Auto Scaling group behind a load balancer, and fail over with Route 53 and scale out when a disaster is declared
- D. Add a us-west-2 replica to form a global table, run full-capacity stacks in both Regions, and use Route 53 latency records with health checks to serve users from the closest healthy Region

**Answer:** C

**Explanation:** A minimum-size Auto Scaling group behind a load balancer is already running in the DR Region, so it can take requests at reduced capacity right after failover (warm standby) and then scale out, without paying for full capacity.
- Hourly backup copies: cannot serve anything until the stack is rebuilt and the table restored (vi phạm ràng buộc).
- Launching the load balancer and group after the disaster: nothing can process requests until the launch finishes (vi phạm ràng buộc).
- Full-capacity stacks in both Regions: serves immediately but doubles the compute bill (tốn chi phí hơn).
Docs: https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html
> 🇻🇳 Pilot light chưa xử lý được request; warm standby chạy sẵn bản thu nhỏ nên phục vụ ngay — rẻ hơn active-active.

---

## Q ai-20261022-a22-03
- domain: resilient
- task: 2.2
- topic: resilience
- services: DynamoDB, EC2 Auto Scaling, ALB, Route 53, AWS Backup, CloudFormation
- tags: dr-multi-site, rto-rpo, dynamodb-global-tables, route53-routing
- difficulty: medium
- time: 145
- skills: 2.2.k4, 2.2.k6
- family: dr-strategy-qualifier
- concept: Multi-site active-active has the lowest RTO because both Regions already serve traffic and no failover steps remain
- refs: A-nen-tang-kien-truc.md, P-architecture-diagrams.md
- hint: Câu hỏi cuối đổi sang thời gian khôi phục thấp nhất — phương án nào không còn bước bật hay mở rộng nào sau thảm hoạ?
- created: 2026-10-22
- enriched: 2026-10-22

A ride-sharing company runs its trip-booking API in us-east-1 on an Auto Scaling group of Amazon EC2 instances fronted by an Application Load Balancer, with trip data in an Amazon DynamoDB table. Client traffic is routed by Amazon Route 53. The company is designing disaster recovery in us-west-2 in case us-east-1 becomes unavailable. The business accepts up to one hour of downtime but only a few seconds of data loss. The application tier is stateless, and its AMIs and infrastructure are defined in AWS CloudFormation templates. Which solution meets these requirements with the LOWEST recovery time?

- A. Schedule hourly AWS Backup copies of the DynamoDB table and the AMIs to us-west-2, then run the CloudFormation templates, restore the table, and update the Route 53 record after a disaster
- B. Add a us-west-2 replica to form a global table and copy the AMIs, then launch the load balancer and Auto Scaling group from CloudFormation and update Route 53 once a disaster is declared
- C. Add a us-west-2 replica to form a global table, run a minimum-size Auto Scaling group behind a load balancer, and fail over with Route 53 and scale out when a disaster is declared
- D. Add a us-west-2 replica to form a global table, run full-capacity stacks in both Regions, and use Route 53 latency records with health checks to serve users from the closest healthy Region

**Answer:** D

**Explanation:** With full-capacity stacks and a multi-active global table in both Regions, Route 53 health checks simply stop returning the failed Region, so there is no launch, scale-out, or promotion step and the RTO is near zero (multi-site active-active).
- Hourly backup copies: the slowest path, a full rebuild plus a restore (vi phạm ràng buộc).
- Launching the load balancer and group after the disaster: provisioning time is added to the RTO (vi phạm ràng buộc).
- Minimum-size group scaled out after the disaster: capacity must ramp up before full load is served (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html
> 🇻🇳 RTO thấp nhất = active-active: cả hai Region đang phục vụ, Route 53 chỉ loại Region lỗi.

---

## Q ai-20261022-a22-04
- domain: resilient
- task: 2.2
- topic: resilience
- services: Elastic Disaster Recovery, AWS Backup, Application Migration Service, DMS, EC2
- tags: rto-rpo, cdc-replication, multi-region, high-availability
- difficulty: medium
- time: 135
- skills: 2.2.s6, 2.2.s7, 2.2.k4
- concept: AWS Elastic Disaster Recovery gives low-cost continuous replication, drills, and failback for on-premises servers that cannot change
- refs: 13-other-services.md, A-nen-tang-kien-truc.md
- hint: Cần sao chép liên tục (RPO giây) nhưng không trả tiền cho đội máy chạy nhàn rỗi, lại phải chạy diễn tập và failback về data center.
- created: 2026-10-22
- enriched: 2026-10-22

A manufacturing company runs its ERP system on 40 on-premises servers, a mix of VMware virtual machines and one physical database server. The applications are legacy and cannot be modified. The company needs a disaster recovery site in an AWS Region with a data-loss limit of seconds and a recovery time of minutes. The company will not pay for an idle duplicate server fleet, must be able to run recovery drills without affecting production, and must fail back to its data center after an outage. Which solution will meet these requirements?

- A. Use AWS Elastic Disaster Recovery to replicate each server's disks continuously to a low-cost staging area and launch recovery instances for drills or a disaster
- B. Use AWS Backup with a Backup gateway to back up the VMware virtual machines hourly to the DR Region and restore them as EC2 instances after a disaster
- C. Replicate the servers continuously with AWS Application Migration Service, launch test instances for the drills, and launch cutover instances for recovery in the DR Region during an outage
- D. Run a scaled-down copy of every server in the DR Region, kept current by AWS DMS for the database and continuous file replication for the application servers

**Answer:** A

**Explanation:** AWS Elastic Disaster Recovery replicates servers at block level to a staging area that uses inexpensive storage and minimal compute, so the RPO is seconds; recovery instances launch within minutes only for drills or a disaster, and it supports point-in-time recovery and failback.
- Hourly AWS Backup of the VMware VMs: restore points up to an hour old, far from an RPO of seconds (vi phạm ràng buộc).
- AWS Application Migration Service: built for one-time cutover migrations and has no failback to the data center (dùng sai tính năng).
- Scaled-down running copy: still pays for an idle duplicate fleet that the company refuses (tốn chi phí hơn).
Docs: https://docs.aws.amazon.com/drs/latest/userguide/what-is-drs.html
> 🇻🇳 DR cho server on-premises (RPO giây, RTO phút, rẻ, có drill + failback) → AWS Elastic Disaster Recovery.

---

## Q ai-20261022-a22-05
- domain: resilient
- task: 2.2
- topic: database
- services: Aurora, RDS, AWS Backup
- tags: aurora-global-database, aurora-endpoints, multi-region, rto-rpo
- difficulty: hard
- time: 155
- skills: 2.2.s2, 2.2.k6
- concept: Aurora Global Database plus a managed failover and the global writer endpoint gives Regional DR with an RPO of seconds
- refs: 03-database-services.md, E-kien-truc-database.md
- hint: Mất cả Region, RPO giây, đội nhỏ không muốn tự cấu hình sao chép — cần bước tạo bản sao cấp lưu trữ và bước chuyển vai khi có sự cố.
- created: 2026-10-22
- enriched: 2026-10-22

A travel-booking company runs an Amazon Aurora MySQL cluster with one writer and two Aurora Replicas in eu-west-1. A new resilience policy requires the database to recover from the loss of an entire AWS Region with a data-loss limit of seconds and downtime of minutes. The application connects to the cluster endpoint, and the small operations team does not want to configure or monitor replication itself. Which combination of actions will meet these requirements? (Choose TWO)

- A. Add an Aurora Replica in a third Availability Zone of eu-west-1 and give it the highest failover priority so that it can take over the writer role
- B. Add a secondary cluster in eu-central-1 by converting the Aurora cluster into an Aurora global database
- C. Create an Aurora MySQL cross-Region read replica that uses binary log replication and promote it manually and connect the application to its endpoint when the Region fails
- D. During a Regional outage, fail over the global database to the secondary cluster and connect the application through the global writer endpoint
- E. Enable continuous backups for the cluster in AWS Backup and copy the recovery points to eu-central-1 to restore a secondary database cluster if the Region fails

**Answer:** B, D

**Explanation:** Aurora Global Database replicates at the storage layer to a secondary Region, typically in under a second, and a managed failover promotes that cluster within minutes; the global writer endpoint keeps pointing at whichever cluster is primary.
- Replica in a third Availability Zone: protects against an AZ failure, not the loss of the Region (giải bài toán khác).
- Binary log cross-Region replica: replication the team must configure and monitor, with promotion and re-pointing done by hand (tốn vận hành hơn).
- Continuous backups copied cross-Region: the copies become periodic snapshots, so data loss is far more than seconds (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database-disaster-recovery.html
> 🇻🇳 Aurora mất cả Region, RPO giây: tạo Global Database + failover có quản lý, app dùng global writer endpoint.

---

## Q ai-20261022-a22-06
- domain: resilient
- task: 2.2
- topic: database
- services: DynamoDB
- tags: dynamodb-global-tables, multi-region, rto-rpo
- difficulty: hard
- time: 130
- skills: 2.2.k11, 2.2.s2
- concept: DynamoDB global tables with multi-Region strong consistency give an RPO of zero; the default eventual-consistency mode does not
- refs: 03-database-services.md, E-kien-truc-database.md
- hint: Không được mất giao dịch nào đã commit và đọc nhất quán mạnh ở mọi Region — chế độ mặc định của bảng toàn cầu có đủ không?
- created: 2026-10-22
- enriched: 2026-10-22

A payments company is building a new service that stores account balances in Amazon DynamoDB. Regulators require that no committed balance update is lost if an AWS Region fails, and that a strongly consistent read of a balance in any Region returns the latest committed write. The application will run in us-east-1, us-east-2, and us-west-2, and the team wants no custom code to copy data between Regions and the lowest operational effort. Which solution will meet these requirements?

- A. Create a table in each Region, enable DynamoDB Streams, and run a Lambda function in each Region that applies every change to the other tables
- B. Create a global table with the default multi-Region eventual consistency and use strongly consistent reads in every Region
- C. Create a table in us-east-1 with point-in-time recovery and copy its continuous backups to us-east-2 and us-west-2 at short intervals
- D. Create the table as a global table with multi-Region strong consistency and replicas in us-east-1, us-east-2, and us-west-2

**Answer:** D

**Explanation:** Multi-Region strong consistency (MRSC) global tables replicate each write synchronously to at least one other Region before acknowledging it, so the RPO is zero and strongly consistent reads in any replica return the latest item; it needs exactly three Regions.
- Default eventual-consistency global table: asynchronous replication can lose recent writes, and strongly consistent reads may be stale (dùng sai tính năng).
- Streams plus Lambda copies: asynchronous and relies on the custom code the team ruled out (tốn vận hành hơn).
- Continuous backups copied between Regions: recovery points are minutes old and restores are manual (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2globaltables_HowItWorks.html
> 🇻🇳 RPO = 0 và đọc nhất quán mạnh giữa các Region → global table chế độ MRSC (đúng 3 Region).

---

## Q ai-20261022-a22-07
- domain: resilient
- task: 2.2
- topic: storage
- services: S3, DataSync
- tags: s3-replication, s3-versioning, multi-region, rto-rpo
- difficulty: hard
- time: 160
- skills: 2.2.k11, 2.2.s5
- concept: S3 Replication Time Control gives an SLA-backed 15-minute window for new objects, while Batch Replication copies existing objects
- refs: 02-storage-services.md, D-kien-truc-luu-tru.md
- hint: Hai yêu cầu độc lập: đối tượng mới phải có cam kết thời gian có SLA, còn đối tượng đã tồn tại thì replication trực tiếp không chạm tới.
- created: 2026-10-22
- enriched: 2026-10-22

A media company stores 120 TB of raw footage in an Amazon S3 bucket in eu-west-1 and uploads new files continuously. A compliance policy requires a copy of every object, including the existing footage, in a bucket in eu-central-1. New uploads must be replicated within a predictable 15-minute window that is backed by an SLA, and the company wants to avoid scripts and manual copy jobs. Which combination of steps will meet these requirements? (Choose TWO)

- A. Enable versioning on both buckets and create a Cross-Region Replication rule with S3 Replication Time Control enabled
- B. Create an AWS DataSync task between the two buckets that runs every 15 minutes to copy new and changed objects to eu-central-1
- C. Create a Cross-Region Replication rule without Replication Time Control and enable S3 replication metrics to track how long objects take to replicate
- D. Run an S3 Batch Operations Copy job from an S3 Inventory report each week to copy objects that are missing from the destination bucket
- E. Run an S3 Batch Replication job to copy the objects that existed before the replication rule was created

**Answer:** A, E

**Explanation:** A replication rule with S3 Replication Time Control provides the SLA-backed 15-minute replication for new objects, but live replication skips objects that already exist, so an S3 Batch Replication job copies the existing footage without scripts.
- DataSync every 15 minutes: scheduled copies carry no replication-time SLA (vi phạm ràng buộc).
- Replication without Replication Time Control: new objects usually replicate quickly, but with no 15-minute SLA (vi phạm ràng buộc).
- Weekly Batch Operations copy: a recurring copy job the company wants to avoid (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-time-control.html
> 🇻🇳 Đối tượng mới trong 15 phút có SLA → CRR + RTC; đối tượng đã có sẵn → S3 Batch Replication.

---

## Q ai-20261022-a22-08
- domain: resilient
- task: 2.2
- topic: storage
- services: S3
- tags: s3-replication, s3-versioning, compliance
- difficulty: medium
- time: 110
- skills: 2.2.k11, 2.2.s5
- concept: Same-Region Replication to another account with replica owner override keeps an independent copy inside the Region
- refs: 02-storage-services.md, D-kien-truc-luu-tru.md
- hint: Dữ liệu không được rời Region nhưng cần bản sao độc lập ở tài khoản khác, tự động khi đối tượng đến — loại sao chép nào giữ nguyên Region?
- created: 2026-10-22
- enriched: 2026-10-22

A healthcare company stores audit logs in an Amazon S3 bucket in its production account in ap-southeast-2. Regulations require that all data stay in that Region. Auditors also require an independent copy of every new log object in a separate backup account, owned by that account, so that compromised production credentials cannot delete the copy. The copy must be created automatically as objects arrive. Which solution will meet these requirements?

- A. Enable versioning on both buckets and configure Same-Region Replication to a bucket in the backup account with the replica owner changed to the backup account
- B. Enable versioning on both buckets and configure Cross-Region Replication to a bucket in a second Region, such as ap-southeast-1, which the backup account owns and controls
- C. Enable versioning with MFA Delete on the production bucket and retain noncurrent versions for the required retention period so that deleted logs can be restored
- D. Schedule a nightly S3 Batch Operations job that copies the new objects from the production bucket to a bucket in the backup account in the same Region

**Answer:** A

**Explanation:** Same-Region Replication copies each new object automatically to a bucket in another account in the same Region, and the replica owner change gives the backup account ownership; version-specific deletes are not replicated and production credentials cannot delete objects in the backup account.
- Cross-Region Replication: sends data to a second Region, breaking the residency rule (vi phạm ràng buộc).
- Versioning with MFA Delete: protects objects inside the production account only, so no independent copy exists elsewhere (giải bài toán khác).
- Nightly Batch Operations copy: leaves new objects uncopied for hours and must be maintained (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html
> 🇻🇳 Bản sao độc lập khác account, cùng Region → Same-Region Replication + đổi chủ sở hữu replica.

---

## Q ai-20261022-a22-09
- domain: resilient
- task: 2.2
- topic: resilience
- services: AWS Backup, Organizations, EBS, Aurora, EFS
- tags: automated-backups, multi-region, cross-account-access, snapshots
- difficulty: hard
- time: 180
- skills: 2.2.s5, 2.2.s1
- concept: AWS Backup Organizations policies, cross-account backup, and a logically air-gapped vault protect backups from a compromised account
- refs: 13-other-services.md, B-bao-mat-compliance.md
- hint: Cần ba mảnh ghép: chính sách áp tự động cho cả tổ chức, cho phép chép sang tài khoản khác, và kho đích mà tài khoản bị chiếm không xoá được.
- created: 2026-10-22
- enriched: 2026-10-22

A retailer runs workloads in 25 AWS accounts managed with AWS Organizations. Amazon EBS volumes, Amazon Aurora DB clusters, and Amazon EFS file systems must be backed up daily and retained for 90 days; all of them are encrypted with customer managed AWS KMS keys. After a ransomware scare, the security team requires a copy of every backup in a second Region and in a separate backup account, stored in a vault that attackers who compromise a workload account cannot delete. The same policy must apply automatically to new accounts. Which combination of steps will meet these requirements? (Choose THREE)

- A. Create an AWS Organizations backup policy that defines a daily plan with 90-day retention and a copy action, and attach it to the organization root
- B. Register the backup account as the AWS Backup delegated administrator for AWS Organizations and create daily plans there that back up the workload accounts' resources by tag to a second Region
- C. Create a logically air-gapped vault in the backup account in the second Region and use it as the copy destination
- D. Create a standard backup vault in the backup account in the same Region as the workloads and use it as the copy destination of the plan
- E. Store the backups in a standard vault in each workload account and attach a vault access policy that denies the DeleteRecoveryPoint action
- F. Enable cross-account backup in the AWS Backup settings of the management account so that member accounts can copy recovery points to other accounts

**Answer:** A, C, F

**Explanation:** An Organizations backup policy applies the daily plan, retention, and copy action to every account, including new ones; cross-account backup lets copies leave the workload accounts, and a logically air-gapped vault is locked in compliance mode, so a compromised workload account cannot delete those recovery points.
- Delegated administrator with plans that select other accounts' resources: a backup plan protects resources in its own account only; delegation is for managing backup policies (cấu hình không tồn tại).
- Standard vault in the same Region: leaves no copy in a second Region (vi phạm ràng buộc).
- Workload-account vault with a deny policy: an administrator of the compromised account can change the vault policy (dùng sai tính năng).
Docs: https://docs.aws.amazon.com/aws-backup/latest/devguide/logicallyairgappedvault.html
> 🇻🇳 Backup chống ransomware đa tài khoản: Organizations backup policy + bật cross-account + vault air-gapped ở tài khoản backup, khác Region (Aurora/EBS/EFS chép vào được; RDS DB instance hiện chưa hỗ trợ loại vault này).

---

## Q ai-20261022-a22-10
- domain: resilient
- task: 2.2
- topic: database
- services: RDS
- tags: pitr, automated-backups, multi-az, read-replicas
- difficulty: medium
- time: 125
- skills: 2.2.s5, 2.2.k11
- concept: Multi-AZ and read replicas replicate logical errors; point-in-time recovery restores to a new instance from before the mistake
- refs: 03-database-services.md, E-kien-truc-database.md
- hint: Xoá nhầm dữ liệu được sao chép sang mọi bản sao gần như tức thì — cần quay về một thời điểm trước lỗi chứ không phải chuyển sang bản sao.
- created: 2026-10-22
- enriched: 2026-10-22

A SaaS company runs its order database on Amazon RDS for PostgreSQL in a Multi-AZ DB instance deployment with a read replica for reporting and automated backups retained for 14 days. At 14:20 a faulty deployment script deleted thousands of rows from the orders table, and the team noticed at 14:45. The application has kept running and has written valid data since then. The company must recover the deleted rows with the LEAST possible data loss. Which solution will meet these requirements?

- A. Restore the DB instance to a point in time just before 14:20 as a new DB instance and switch the application's connection string to the restored instance
- B. Promote the read replica to a standalone DB instance and copy the deleted rows from it back into the production database
- C. Restore the DB instance to a point in time just before 14:20 as a new DB instance, then copy the missing data back into the production database
- D. Take a manual snapshot of the standby in the other Availability Zone, restore it, and copy the deleted rows back into the production database

**Answer:** C

**Explanation:** Automated backups with transaction logs let RDS restore to any second inside the retention window as a new DB instance, so the team recovers the data from just before the script ran and copies it back without losing newer valid writes.
- Point-in-time restore and switching the application: recovers the rows but discards the valid writes made since 14:20 (vi phạm ràng buộc).
- Promoted read replica: it applied the same deletes within seconds (dùng sai tính năng).
- Snapshot of the standby: synchronous replication already removed the rows there (dùng sai tính năng).
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html
> 🇻🇳 Multi-AZ/replica chỉ chống hỏng hạ tầng; xoá nhầm dữ liệu → PITR ra instance mới rồi copy lại.

---

## Q ai-20261022-a22-11
- domain: resilient
- task: 2.2
- topic: database
- services: RDS, Aurora, RDS Proxy
- tags: multi-az, read-replicas, high-availability
- difficulty: hard
- time: 125
- skills: 2.2.k6, 2.2.s2
- concept: A Multi-AZ DB cluster has readable standbys, lower write latency and faster failover than a Multi-AZ DB instance deployment
- refs: 03-database-services.md, E-kien-truc-database.md
- hint: Standby của Multi-AZ instance không đọc được; cần chế độ Multi-AZ khác có standby phục vụ đọc mà vẫn là RDS PostgreSQL.
- created: 2026-10-22
- enriched: 2026-10-22

An online marketplace runs Amazon RDS for PostgreSQL as a Multi-AZ DB instance deployment. Dashboard queries saturate the primary, so the company pays for two read replicas while the synchronous standby serves no traffic. Management wants to cut cost by removing the read replicas, shorten failover time, and lower write latency, without leaving RDS for PostgreSQL or changing the application's query logic. Which solution will meet these requirements?

- A. Migrate to Amazon Aurora PostgreSQL and use Aurora Replicas as failover targets and for the dashboard queries
- B. Move the database to a Multi-AZ DB cluster deployment with two readable standby instances and send the dashboard queries to the reader endpoint
- C. Place an Amazon RDS Proxy in front of the Multi-AZ DB instance deployment and keep both read replicas for the dashboard queries and the standby for failover
- D. Remove one read replica, turn on Multi-AZ for the remaining read replica, and send the dashboard queries to that highly available replica

**Answer:** B

**Explanation:** A Multi-AZ DB cluster has a writer and two readable standbys in three Availability Zones with semisynchronous replication, which lowers write latency and fails over faster; the standbys serve the dashboards through the reader endpoint, so the read replicas can go.
- Aurora PostgreSQL: meets the goals but means leaving RDS for PostgreSQL (vi phạm ràng buộc).
- RDS Proxy on the existing deployment: shortens failover, but the standby stays unreadable and write latency is unchanged (giải bài toán khác).
- Multi-AZ read replica: keeps a highly available reader, but the primary's failover time and write latency stay the same (giải bài toán khác).
Docs: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/multi-az-db-clusters-concepts.html
> 🇻🇳 Standby đọc được + failover nhanh + ghi nhanh hơn, vẫn là RDS → Multi-AZ DB cluster (không phải Multi-AZ instance).

---

## Q ai-20261022-a22-12
- domain: resilient
- task: 2.2
- topic: resilience
- services: EC2 Auto Scaling, ALB, RDS, EFS, EBS, Route 53
- tags: multi-az, high-availability, multi-region
- difficulty: easy
- time: 115
- skills: 2.2.k1, 2.2.s2
- concept: Surviving the loss of one Availability Zone needs a Multi-AZ design inside the Region, not Multi-Region, when data must stay in the Region
- refs: A-nen-tang-kien-truc.md, 14-so-sanh-services.md
- hint: Chỉ cần chịu mất một AZ và dữ liệu bị giữ trong một Region — Multi-AZ trong Region là đủ, đừng trả thêm cho Multi-Region.
- created: 2026-10-22
- enriched: 2026-10-22

A German insurance company is moving its claims portal to AWS. A privacy regulation requires that all customer data stay in eu-central-1. The portal must keep running if a single Availability Zone fails, with automatic recovery and without data loss, and the company wants to avoid unnecessary cost. The portal uses a web tier on Amazon EC2, a relational database, and shared document storage. Which design will meet these requirements MOST cost-effectively?

- A. Deploy identical stacks in eu-central-1 and eu-west-1, replicate the database and the documents between them, and use Route 53 failover routing
- B. Deploy the web tier in an Auto Scaling group across three Availability Zones behind a load balancer, with an RDS Multi-AZ deployment and an EFS One Zone file system backed up daily
- C. Deploy the web tier in an Auto Scaling group across three Availability Zones behind a load balancer, with an RDS Multi-AZ deployment and an EBS Multi-Attach volume for documents
- D. Deploy the web tier in an Auto Scaling group across three Availability Zones behind a load balancer, with an RDS Multi-AZ deployment and a Regional EFS file system

**Answer:** D

**Explanation:** Surviving an AZ failure needs Multi-AZ design, not Multi-Region: compute across zones behind a load balancer, an RDS Multi-AZ deployment with synchronous replication and automatic failover, and Regional EFS, all inside the permitted Region.
- Stacks in two Regions: send personal data outside eu-central-1 and double the cost (vi phạm ràng buộc).
- EFS One Zone with daily backups: the documents live in one zone, so its failure loses availability and recent documents (vi phạm ràng buộc).
- EBS Multi-Attach for documents: a Multi-Attach volume stays in one Availability Zone (đặt sai chỗ).
Docs: https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_fault_isolation_multiaz_region_system.html
> 🇻🇳 Chịu lỗi 1 AZ + dữ liệu phải ở trong Region → Multi-AZ trong cùng Region, không cần Multi-Region.
