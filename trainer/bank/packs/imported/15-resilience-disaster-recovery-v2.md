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
- topic: resilience
- services: EC2 Auto Scaling, ELB
- difficulty: medium
- time: 60
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q1

A stateless web app must stay available if one AZ fails. Which design is BEST?

- A. Single EC2 in one AZ
- B. Auto Scaling group across multiple AZs behind an ELB
- C. Larger instance in one AZ
- D. EC2 with Elastic IP only

**Answer:** B

**Explanation:** Survive AZ failure = ASG across multiple AZs behind ELB.

---

## Q 15-v2-02
- domain: resilient
- topic: resilience
- tags: rto-rpo, dr-backup-restore
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q2

A DR strategy with the LOWEST cost that accepts hours of RTO/RPO by restoring from backups. Which strategy?

- A. Backup & Restore
- B. Pilot Light
- C. Warm Standby
- D. Multi-Site Active-Active

**Answer:** A

**Explanation:** Lowest cost, hours RTO/RPO, restore from backup = Backup & Restore.

---

## Q 15-v2-03
- domain: resilient
- topic: resilience
- tags: multi-region, dr-pilot-light
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q3

A DR strategy keeps a minimal core (e.g., database replica) running in another Region, scaling up on disaster. Which strategy?

- A. Backup & Restore
- B. Pilot Light
- C. Multi-Site Active-Active
- D. Cold standby only

**Answer:** B

**Explanation:** Minimal core running, scale on disaster = Pilot Light.

---

## Q 15-v2-04
- domain: resilient
- topic: resilience
- tags: multi-region, dr-warm-standby
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q4

A DR strategy runs a scaled-down but fully functional copy in another Region, ready to scale up quickly. Which strategy?

- A. Warm Standby
- B. Backup & Restore
- C. Pilot Light
- D. Single AZ

**Answer:** A

**Explanation:** Scaled-down fully functional, quick scale up = Warm Standby.

---

## Q 15-v2-05
- domain: resilient
- topic: resilience
- tags: rto-rpo, dr-multi-site
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q5

A DR strategy with near-zero RTO/RPO serving traffic from multiple Regions simultaneously. Which strategy?

- A. Multi-Site Active-Active
- B. Pilot Light
- C. Backup & Restore
- D. Warm Standby

**Answer:** A

**Explanation:** Near-zero RTO/RPO, multi-Region serving = Multi-Site Active-Active.

---

## Q 15-v2-06
- domain: resilient
- topic: resilience
- tags: rto-rpo
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q6

RTO and RPO — which definition is CORRECT?

- A. RTO = max acceptable downtime; RPO = max acceptable data loss (time)
- B. RTO = data loss; RPO = downtime
- C. Both mean the same
- D. RPO = recovery cost

**Answer:** A

**Explanation:** RTO = max downtime; RPO = max data loss.

---

## Q 15-v2-07
- domain: resilient
- topic: resilience
- services: RDS
- tags: multi-az
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q7

A relational database must fail over automatically to another AZ with synchronous replication. Which feature?

- A. RDS Multi-AZ
- B. Read Replica
- C. Cross-Region snapshot
- D. DynamoDB

**Answer:** A

**Explanation:** Auto failover with sync replication = RDS Multi-AZ.

---

## Q 15-v2-08
- domain: resilient
- topic: resilience
- services: S3
- tags: multi-region, compliance, s3-replication
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q8

S3 data must be copied to another Region for DR and compliance. Which feature?

- A. Cross-Region Replication (CRR)
- B. Same-Region Replication
- C. Lifecycle to Glacier
- D. Transfer Acceleration

**Answer:** A

**Explanation:** S3 copy to another Region for DR = Cross-Region Replication.

---

## Q 15-v2-09
- domain: resilient
- topic: resilience
- services: Route 53
- tags: route53-health-checks, route53-routing
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q9

Route 53 must stop sending traffic to an unhealthy Regional endpoint and send it to a standby. Which combination?

- A. Health checks + failover routing
- B. Weighted routing only
- C. Simple routing
- D. Geolocation only

**Answer:** A

**Explanation:** Route around unhealthy Region = health checks + failover routing.

---

## Q 15-v2-10
- domain: resilient
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
- topic: resilience
- services: Aurora
- tags: multi-region, aurora-global-database
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q11

An Aurora database needs cross-Region DR with fast failover and low replication lag. Which feature?

- A. Aurora Global Database
- B. RDS Multi-AZ
- C. Read Replica in same Region
- D. Manual snapshot copy

**Answer:** A

**Explanation:** Aurora cross-Region DR, fast failover, low lag = Aurora Global Database.

---

## Q 15-v2-12
- domain: resilient
- topic: resilience
- services: EC2 Auto Scaling
- tags: route53-health-checks
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q12

A fleet must automatically replace unhealthy instances to maintain capacity. Which service?

- A. Auto Scaling group with health checks
- B. Single instance with CloudWatch
- C. Elastic IP
- D. Placement group

**Answer:** A

**Explanation:** Auto-replace unhealthy instances = Auto Scaling group with health checks.

---

## Q 15-v2-13
- domain: resilient
- topic: resilience
- tags: multi-region
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q13

A workload must survive the loss of an entire Region. Which approach is required?

- A. Multi-Region architecture
- B. Multi-AZ in one Region only
- C. Larger instances
- D. More EBS volumes

**Answer:** A

**Explanation:** Survive whole-Region loss = Multi-Region architecture.

---

## Q 15-v2-14
- domain: resilient
- topic: resilience
- services: AWS Backup, EBS, RDS, DynamoDB, EFS
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q14

Backups of EBS, RDS, DynamoDB, and EFS must be centrally scheduled and retained by policy. Which service?

- A. AWS Backup
- B. Manual snapshots
- C. S3 CRR
- D. Storage Gateway

**Answer:** A

**Explanation:** Central scheduled policy backups = AWS Backup.

---

## Q 15-v2-15
- domain: resilient
- topic: resilience
- services: SQS
- tags: decoupling
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q15

An SQS-decoupled worker tier ensures messages are not lost if workers fail. Which property provides this resilience?

- A. Messages persist in the queue until successfully processed/deleted
- B. Messages are lost immediately
- C. Only FIFO retains messages
- D. SNS retains messages

**Answer:** A

**Explanation:** SQS resilience = messages persist until processed/deleted.

---

## Q 15-v2-16
- domain: resilient
- topic: resilience
- services: NAT Gateway
- difficulty: medium
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q16

A single point of failure exists because the app uses one NAT Instance. What improves resilience?

- A. NAT Gateway per AZ (redundant) or multiple NAT Gateways
- B. One larger NAT Instance
- C. Remove NAT entirely
- D. Elastic IP on the instance

**Answer:** A

**Explanation:** NAT resilience = redundant NAT Gateways per AZ.

---

## Q 15-v2-17
- domain: resilient
- topic: resilience
- tags: read-replicas
- difficulty: medium
- time: 60
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q17

A database read replica must be promotable to primary during a DR event. Which is TRUE?

- A. Read Replicas can be manually promoted to standalone primaries
- B. Read Replicas fail over automatically like Multi-AZ
- C. Read Replicas are synchronous
- D. Read Replicas cannot be promoted

**Answer:** A

**Explanation:** Read Replicas can be manually promoted to primary.

---

## Q 15-v2-18
- domain: resilient
- topic: resilience
- tags: rto-rpo
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q18

To reduce RPO for a database DR, which approach helps MOST?

- A. Continuous/asynchronous replication to the DR Region
- B. Weekly backups only
- C. Monthly snapshots
- D. No replication

**Answer:** A

**Explanation:** Lower RPO = continuous/async replication to DR Region.

---

## Q 15-v2-19
- domain: resilient
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
- topic: resilience
- services: ELB
- tags: elb-features
- difficulty: medium
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q20

Cross-zone load balancing on an ELB provides what resilience benefit?

- A. Even distribution of traffic across targets in all enabled AZs
- B. Cross-Region failover
- C. Data replication
- D. DDoS protection

**Answer:** A

**Explanation:** Cross-zone LB = even distribution across targets in all AZs.

---

## Q 15-v2-21
- domain: resilient
- topic: resilience
- tags: rto-rpo, dr-warm-standby
- difficulty: hard
- time: 70
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q21

A company needs RTO of minutes and RPO of seconds across Regions, at moderate cost, without running full production capacity idle. Which strategy is BEST?

- A. Backup & Restore
- B. Pilot Light
- C. Warm Standby
- D. Cold backups only

**Answer:** C

**Explanation:** Minutes RTO, seconds RPO, moderate cost, no full idle = Warm Standby.

---

## Q 15-v2-22
- domain: resilient
- topic: resilience
- services: Route 53, Global Accelerator
- tags: dr-multi-site, multi-region, route53-routing, route53-health-checks
- difficulty: hard
- time: 95
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q22

An active-active multi-Region app must route users to the closest Region and fail over instantly. Which two support this? (Choose TWO)

- A. Route 53 latency-based routing with health checks
- B. AWS Global Accelerator with endpoint health checks
- C. Single-Region ALB
- D. EBS Multi-Attach
- E. NAT Gateway

**Answer:** A, B

**Explanation:** Active-active closest + instant failover = Route 53 latency + health checks / Global Accelerator.

---

## Q 15-v2-23
- domain: resilient
- topic: resilience
- services: Elastic Disaster Recovery, EC2
- difficulty: hard
- time: 70
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q23

A DR plan must be validated regularly without impacting production. Which service enables non-disruptive DR drills for on-prem/EC2 replication?

- A. AWS Elastic Disaster Recovery (DRS) drill launches
- B. Manual failover to prod
- C. S3 CRR only
- D. Snapshot copy only

**Answer:** A

**Explanation:** Non-disruptive DR drills = Elastic Disaster Recovery drill launches.

---

## Q 15-v2-24
- domain: resilient
- topic: resilience
- services: Aurora
- tags: aurora-global-database, multi-region, s3-replication
- difficulty: hard
- time: 100
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q24

An Aurora Global Database must be promoted in the secondary Region during a Regional outage. Which two are TRUE? (Choose TWO)

- A. Managed unplanned failover promotes the secondary Region
- B. Typical cross-Region replication lag is under a second
- C. Promotion loses all data always
- D. Aurora Global requires DynamoDB
- E. Only Multi-AZ is involved

**Answer:** A, B

**Explanation:** Aurora Global = managed unplanned failover + sub-second replication lag.

---

## Q 15-v2-25
- domain: resilient
- topic: resilience
- services: EFS, EC2, EBS
- tags: multi-az, snapshots
- difficulty: hard
- time: 70
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q25

A stateful application on EC2 needs data durability across AZ failure without cross-AZ EBS. Which approach?

- A. Use EFS (multi-AZ) for shared data or replicate/snapshot across AZs
- B. Single EBS volume in one AZ
- C. Instance Store
- D. Local disk only

**Answer:** A

**Explanation:** Durable cross-AZ data = EFS multi-AZ or replicate/snapshot across AZs.

---

## Q 15-v2-26
- domain: resilient
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
- topic: resilience
- services: SQS
- difficulty: hard
- time: 95
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q27

A multi-tier app must avoid cascading failure when a downstream dependency is slow. Which two resilience patterns apply? (Choose TWO)

- A. Queue-based load leveling (SQS) to absorb bursts
- B. Circuit breaker / timeouts and retries with backoff
- C. Removing all retries
- D. Synchronous tight coupling
- E. Single-threaded processing

**Answer:** A, B

**Explanation:** Prevent cascading failure = queue-based load leveling + circuit breaker/timeouts+backoff.

---

## Q 15-v2-28
- domain: resilient
- topic: resilience
- services: S3
- tags: rto-rpo, s3-replication
- difficulty: hard
- time: 70
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q28

A DR requirement is RPO near zero for S3 objects across Regions with a 15-minute replication SLA. Which feature?

- A. S3 Replication Time Control (RTC)
- B. Standard CRR only
- C. Lifecycle transition
- D. Versioning alone

**Answer:** A

**Explanation:** Near-zero RPO S3 with 15-min SLA = S3 Replication Time Control (RTC).

---

## Q 15-v2-29
- domain: resilient
- topic: resilience
- services: Global Accelerator
- tags: ttl
- difficulty: hard
- time: 70
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q29

During failover, DNS changes are slow due to caching. Which service provides near-instant traffic shifting independent of DNS TTL?

- A. AWS Global Accelerator
- B. Route 53 with high TTL
- C. CloudFront only
- D. Longer TTL values

**Answer:** A

**Explanation:** Instant failover independent of DNS TTL = Global Accelerator.

---

## Q 15-v2-30
- domain: resilient
- topic: resilience
- services: EC2 Auto Scaling, RDS
- tags: multi-az
- difficulty: hard
- time: 100
- source: practice-exams/15-resilience-disaster-recovery-exam-v2.md#Q30

A workload must tolerate an AZ failure for both compute and a self-managed database. Which two are appropriate? (Choose TWO)

- A. Multi-AZ Auto Scaling for compute
- B. Database replication/standby in a second AZ (e.g., RDS Multi-AZ)
- C. Single-AZ database with hourly backups only
- D. One instance with Elastic IP
- E. Instance Store for the database

**Answer:** A, B

**Explanation:** AZ tolerance = Multi-AZ ASG compute + RDS Multi-AZ standby.
