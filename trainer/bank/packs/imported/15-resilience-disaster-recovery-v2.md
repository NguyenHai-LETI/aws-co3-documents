---
pack: saa-15-resilience-disaster-recovery-v2
title: 15 · Resilience & Disaster Recovery · V2
exam: SAA-C03
origin: imported
source: practice-exams/15-resilience-disaster-recovery-exam-v2.md
created: 2026-10-16
---

# 15 · Resilience & Disaster Recovery · V2

> Imported from `practice-exams/15-resilience-disaster-recovery-exam-v2.md` + `15-resilience-disaster-recovery-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 15-v2-01
- domain: resilient
- task: 2.1
- topic: resilience
- services: EC2 Auto Scaling, ELB
- difficulty: medium
- time: 60
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q1

A stateless web app must stay available if one AZ fails. Which design is BEST?

- A. Larger instance in one AZ
- B. Auto Scaling group across multiple AZs behind an ELB
- C. EC2 with Elastic IP only
- D. Single EC2 in one AZ

**Answer:** B

**Explanation:** Survive AZ failure = ASG across multiple AZs behind ELB.

---

## Q 15-v2-02
- domain: resilient
- task: 2.2
- topic: resilience
- tags: rto-rpo, dr-backup-restore
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q2

A DR strategy with the LOWEST cost that accepts hours of RTO/RPO by restoring from backups. Which strategy?

- A. Warm Standby
- B. Multi-Site Active-Active
- C. Backup & Restore
- D. Pilot Light

**Answer:** C

**Explanation:** Lowest cost, hours RTO/RPO, restore from backup = Backup & Restore.

---

## Q 15-v2-03
- domain: resilient
- task: 2.2
- topic: resilience
- tags: multi-region, dr-pilot-light
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q3

A DR strategy keeps a minimal core (e.g., database replica) running in another Region, scaling up on disaster. Which strategy?

- A. Backup & Restore
- B. Cold standby only
- C. Pilot Light
- D. Multi-Site Active-Active

**Answer:** C

**Explanation:** Minimal core running, scale on disaster = Pilot Light.

---

## Q 15-v2-04
- domain: resilient
- task: 2.2
- topic: resilience
- tags: multi-region, dr-warm-standby
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q4

A DR strategy runs a scaled-down but fully functional copy in another Region, ready to scale up quickly. Which strategy?

- A. Single AZ
- B. Warm Standby
- C. Backup & Restore
- D. Pilot Light

**Answer:** B

**Explanation:** Scaled-down fully functional, quick scale up = Warm Standby.

---

## Q 15-v2-05
- domain: resilient
- task: 2.2
- topic: resilience
- tags: rto-rpo, dr-multi-site
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q5

A DR strategy with near-zero RTO/RPO serving traffic from multiple Regions simultaneously. Which strategy?

- A. Pilot Light
- B. Warm Standby
- C. Backup & Restore
- D. Multi-Site Active-Active

**Answer:** D

**Explanation:** Near-zero RTO/RPO, multi-Region serving = Multi-Site Active-Active.

---

## Q 15-v2-06
- domain: resilient
- task: 2.2
- topic: resilience
- tags: rto-rpo
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q6

RTO and RPO — which definition is CORRECT?

- A. RPO = recovery cost
- B. Both mean the same
- C. RTO = max acceptable downtime; RPO = max acceptable data loss (time)
- D. RTO = data loss; RPO = downtime

**Answer:** C

**Explanation:** RTO = max downtime; RPO = max data loss.

---

## Q 15-v2-07
- domain: resilient
- task: 2.2
- topic: resilience
- services: RDS
- tags: multi-az
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q7

A relational database must fail over automatically to another AZ with synchronous replication. Which feature?

- A. RDS Multi-AZ
- B. Cross-Region snapshot
- C. DynamoDB
- D. Read Replica

**Answer:** A

**Explanation:** Auto failover with sync replication = RDS Multi-AZ.

---

## Q 15-v2-08
- domain: resilient
- task: 2.2
- topic: resilience
- services: S3
- tags: multi-region, compliance, s3-replication
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q8

S3 data must be copied to another Region for DR and compliance. Which feature?

- A. Same-Region Replication
- B. Cross-Region Replication (CRR)
- C. Lifecycle to Glacier
- D. Transfer Acceleration

**Answer:** B

**Explanation:** S3 copy to another Region for DR = Cross-Region Replication.

---

## Q 15-v2-09
- domain: resilient
- task: 2.2
- topic: resilience
- services: Route 53
- tags: route53-health-checks, route53-routing
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q9

Route 53 must stop sending traffic to an unhealthy Regional endpoint and send it to a standby. Which combination?

- A. Geolocation only
- B. Simple routing
- C. Weighted routing only
- D. Health checks + failover routing

**Answer:** D

**Explanation:** Route around unhealthy Region = health checks + failover routing.

---

## Q 15-v2-10
- domain: resilient
- task: 2.2
- topic: resilience
- services: DynamoDB
- tags: multi-region, dr-multi-site, dynamodb-global-tables
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q10

A DynamoDB table needs multi-Region resilience with active-active writes. Which feature?

- A. Global Tables
- B. DAX
- C. Streams only
- D. On-demand backup

**Answer:** A

**Explanation:** Multi-Region active-active NoSQL = DynamoDB Global Tables.

---

## Q 15-v2-11
- domain: resilient
- task: 2.2
- topic: resilience
- services: Aurora
- tags: multi-region, aurora-global-database
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q11

An Aurora database needs cross-Region DR with fast failover and low replication lag. Which feature?

- A. Read Replica in same Region
- B. Manual snapshot copy
- C. Aurora Global Database
- D. RDS Multi-AZ

**Answer:** C

**Explanation:** Aurora cross-Region DR, fast failover, low lag = Aurora Global Database.

---

## Q 15-v2-12
- domain: resilient
- task: 2.1
- topic: resilience
- services: EC2 Auto Scaling
- tags: route53-health-checks
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q12

A fleet must automatically replace unhealthy instances to maintain capacity. Which service?

- A. Elastic IP
- B. Placement group
- C. Auto Scaling group with health checks
- D. Single instance with CloudWatch

**Answer:** C

**Explanation:** Auto-replace unhealthy instances = Auto Scaling group with health checks.

---

## Q 15-v2-13
- domain: resilient
- task: 2.2
- topic: resilience
- tags: multi-region
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q13

A workload must survive the loss of an entire Region. Which approach is required?

- A. Multi-Region architecture
- B. More EBS volumes
- C. Larger instances
- D. Multi-AZ in one Region only

**Answer:** A

**Explanation:** Survive whole-Region loss = Multi-Region architecture.

---

## Q 15-v2-14
- domain: resilient
- task: 2.2
- topic: resilience
- services: AWS Backup, EBS, RDS, DynamoDB, EFS
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q14

Backups of EBS, RDS, DynamoDB, and EFS must be centrally scheduled and retained by policy. Which service?

- A. Storage Gateway
- B. S3 CRR
- C. Manual snapshots
- D. AWS Backup

**Answer:** D

**Explanation:** Central scheduled policy backups = AWS Backup.

---

## Q 15-v2-15
- domain: resilient
- task: 2.1
- topic: resilience
- services: SQS
- tags: decoupling
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q15

An SQS-decoupled worker tier ensures messages are not lost if workers fail. Which property provides this resilience?

- A. SNS retains messages
- B. Messages are lost immediately
- C. Messages persist in the queue until successfully processed/deleted
- D. Only FIFO retains messages

**Answer:** C

**Explanation:** SQS resilience = messages persist until processed/deleted.

---

## Q 15-v2-16
- domain: resilient
- task: 2.2
- topic: resilience
- services: NAT Gateway
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q16

A single point of failure exists because the app uses one NAT Instance. What improves resilience?

- A. One larger NAT Instance
- B. Elastic IP on the instance
- C. Remove NAT entirely
- D. NAT Gateway per AZ (redundant) or multiple NAT Gateways

**Answer:** D

**Explanation:** NAT resilience = redundant NAT Gateways per AZ.

---

## Q 15-v2-17
- domain: resilient
- task: 2.2
- topic: resilience
- tags: read-replicas
- difficulty: medium
- time: 60
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q17

A database read replica must be promotable to primary during a DR event. Which is TRUE?

- A. Read Replicas are synchronous
- B. Read Replicas fail over automatically like Multi-AZ
- C. Read Replicas cannot be promoted
- D. Read Replicas can be manually promoted to standalone primaries

**Answer:** D

**Explanation:** Read Replicas can be manually promoted to primary.

---

## Q 15-v2-18
- domain: resilient
- task: 2.2
- topic: resilience
- tags: rto-rpo
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q18

To reduce RPO for a database DR, which approach helps MOST?

- A. No replication
- B. Weekly backups only
- C. Monthly snapshots
- D. Continuous/asynchronous replication to the DR Region

**Answer:** D

**Explanation:** Lower RPO = continuous/async replication to DR Region.

---

## Q 15-v2-19
- domain: resilient
- task: 2.2
- topic: resilience
- services: ElastiCache, DynamoDB
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q19

An application must maintain sessions across instance failures. Which approach avoids losing session state?

- A. Store sessions in ElastiCache/DynamoDB (externalized state)
- B. Store sessions in instance memory
- C. Sticky sessions only
- D. Local disk

**Answer:** A

**Explanation:** Avoid session loss = externalize state to ElastiCache/DynamoDB.

---

## Q 15-v2-20
- domain: resilient
- task: 2.2
- topic: resilience
- services: ELB
- tags: elb-features
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q20

Cross-zone load balancing on an ELB provides what resilience benefit?

- A. Data replication
- B. Cross-Region failover
- C. Even distribution of traffic across targets in all enabled AZs
- D. DDoS protection

**Answer:** C

**Explanation:** Cross-zone LB = even distribution across targets in all AZs.

---

## Q 15-v2-21
- domain: resilient
- task: 2.2
- topic: resilience
- tags: rto-rpo, dr-warm-standby
- difficulty: hard
- time: 70
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q21

A company needs RTO of minutes and RPO of seconds across Regions, at moderate cost, without running full production capacity idle. Which strategy is BEST?

- A. Pilot Light
- B. Warm Standby
- C. Cold backups only
- D. Backup & Restore

**Answer:** B

**Explanation:** Minutes RTO, seconds RPO, moderate cost, no full idle = Warm Standby.

---

## Q 15-v2-22
- domain: resilient
- task: 2.2
- topic: resilience
- services: Route 53, Global Accelerator
- tags: dr-multi-site, multi-region, route53-routing, route53-health-checks
- difficulty: hard
- time: 95
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q22

An active-active multi-Region app must route users to the closest Region and fail over instantly. Which two support this? (Choose TWO)

- A. Single-Region ALB
- B. NAT Gateway
- C. Route 53 latency-based routing with health checks
- D. AWS Global Accelerator with endpoint health checks
- E. EBS Multi-Attach

**Answer:** C, D

**Explanation:** Active-active closest + instant failover = Route 53 latency + health checks / Global Accelerator.

---

## Q 15-v2-23
- domain: resilient
- task: 2.2
- topic: resilience
- services: Elastic Disaster Recovery, EC2
- difficulty: hard
- time: 70
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q23

A DR plan must be validated regularly without impacting production. Which service enables non-disruptive DR drills for on-prem/EC2 replication?

- A. AWS Elastic Disaster Recovery (DRS) drill launches
- B. Manual failover to prod
- C. Snapshot copy only
- D. S3 CRR only

**Answer:** A

**Explanation:** Non-disruptive DR drills = Elastic Disaster Recovery drill launches.

---

## Q 15-v2-24
- domain: resilient
- task: 2.2
- topic: resilience
- services: Aurora
- tags: aurora-global-database, multi-region, s3-replication
- difficulty: hard
- time: 120
- enriched: 2026-10-21
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q24

An Aurora Global Database must be promoted in the secondary Region during a Regional outage. Which two are TRUE? (Choose TWO)

- A. Promoting the secondary Region discards every change that was not yet captured by the most recent manual snapshot
- B. A separate Multi-AZ deployment must be manually configured in the secondary Region before failover is possible
- C. A one-click managed failover switches the standby cluster in the other Region to primary
- D. Typical cross-Region replication lag is under a second
- E. Aurora Global Database requires a Network Load Balancer in front of each Region's cluster to support failover

**Answer:** C, D

**Explanation:** Aurora Global Database offers a managed, one-click failover that switches the standby cluster in the other Region to primary without manual snapshot recovery, and under typical conditions the cross-Region replication lag is well under a second, so little data is at risk.
- Discarding everything since the last manual snapshot: failover promotes the continuously replicated cluster itself, it is not a snapshot restore.
- Requiring a separately configured Multi-AZ deployment first: the secondary cluster's built-in cross-Region replication already supports failover without a separate Multi-AZ setup.
- Requiring a Network Load Balancer in front of each cluster: failover is handled through Aurora's own cluster endpoints, not an external load balancer.
> 🇻🇳 Aurora Global Database: failover quản lý một cú click + độ trễ sao chép thường dưới 1 giây; không cần snapshot, Multi-AZ riêng, hay NLB.

---

## Q 15-v2-25
- domain: resilient
- task: 2.2
- topic: resilience
- services: EFS, EC2, EBS
- tags: multi-az, snapshots
- difficulty: hard
- time: 70
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q25

A stateful application on EC2 needs data durability across AZ failure without cross-AZ EBS. Which approach?

- A. Single EBS volume in one AZ
- B. Use EFS (multi-AZ) for shared data or replicate/snapshot across AZs
- C. Instance Store
- D. Local disk only

**Answer:** B

**Explanation:** Durable cross-AZ data = EFS multi-AZ or replicate/snapshot across AZs.

---

## Q 15-v2-26
- domain: resilient
- task: 2.2
- topic: resilience
- services: AWS Backup
- tags: automated-backups, s3-object-lock
- difficulty: hard
- time: 70
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q26

A company must guarantee automated backups are immutable and cannot be deleted during a retention window (ransomware resilience). Which feature?

- A. AWS Backup Vault Lock
- B. IAM deny policy only
- C. KMS rotation
- D. S3 lifecycle

**Answer:** A

**Explanation:** Immutable backups vs ransomware = AWS Backup Vault Lock.

---

## Q 15-v2-27
- domain: resilient
- task: 2.1
- topic: resilience
- services: SQS
- difficulty: hard
- time: 95
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q27

A multi-tier app must avoid cascading failure when a downstream dependency is slow. Which two resilience patterns apply? (Choose TWO)

- A. Circuit breaker / timeouts and retries with backoff
- B. Single-threaded processing
- C. Queue-based load leveling (SQS) to absorb bursts
- D. Removing all retries
- E. Synchronous tight coupling

**Answer:** A, C

**Explanation:** Prevent cascading failure = queue-based load leveling + circuit breaker/timeouts+backoff.

---

## Q 15-v2-28
- domain: resilient
- task: 2.2
- topic: resilience
- services: S3
- tags: rto-rpo, s3-replication
- difficulty: hard
- time: 70
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q28

A DR requirement is RPO near zero for S3 objects across Regions with a 15-minute replication SLA. Which feature?

- A. Versioning alone
- B. S3 Replication Time Control (RTC)
- C. Lifecycle transition
- D. Standard CRR only

**Answer:** B

**Explanation:** Near-zero RPO S3 with 15-min SLA = S3 Replication Time Control (RTC).

---

## Q 15-v2-29
- domain: resilient
- task: 2.2
- topic: resilience
- services: Global Accelerator
- tags: ttl
- difficulty: hard
- time: 70
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q29

During failover, DNS changes are slow due to caching. Which service provides near-instant traffic shifting independent of DNS TTL?

- A. Longer TTL values
- B. AWS Global Accelerator
- C. CloudFront only
- D. Route 53 with high TTL

**Answer:** B

**Explanation:** Instant failover independent of DNS TTL = Global Accelerator.

---

## Q 15-v2-30
- domain: resilient
- task: 2.2
- topic: resilience
- services: EC2 Auto Scaling, RDS
- tags: multi-az
- difficulty: hard
- time: 100
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q30

A workload must tolerate an AZ failure for both compute and a self-managed database. Which two are appropriate? (Choose TWO)

- A. Multi-AZ Auto Scaling for compute
- B. One instance with Elastic IP
- C. Single-AZ database with hourly backups only
- D. Database replication/standby in a second AZ (e.g., RDS Multi-AZ)
- E. Instance Store for the database

**Answer:** A, D

**Explanation:** AZ tolerance = Multi-AZ ASG compute + RDS Multi-AZ standby.
