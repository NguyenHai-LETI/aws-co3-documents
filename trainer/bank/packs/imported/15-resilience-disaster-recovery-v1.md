---
pack: saa-15-resilience-disaster-recovery-v1
title: 15 · Resilience & Disaster Recovery (GAP topic · Domain 2 = 26%) · V1
exam: SAA-C03
origin: imported
source: practice-exams/15-resilience-disaster-recovery-exam.md
created: 2026-10-16
---

# 15 · Resilience & Disaster Recovery (GAP topic · Domain 2 = 26%) · V1

> Imported from `practice-exams/15-resilience-disaster-recovery-exam.md` + `15-resilience-disaster-recovery-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 15-v1-01
- domain: resilient
- topic: resilience
- tags: rto-rpo, dr-backup-restore
- difficulty: easy
- time: 45
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q1

Which DR strategy has the LOWEST cost but the LONGEST recovery time (RTO), restoring infrastructure only after a disaster?

- A. Backup & Restore
- B. Pilot Light
- C. Warm Standby
- D. Multi-Site Active-Active

**Answer:** A

**Explanation:** Lowest cost, longest RTO = Backup & Restore.

---

## Q 15-v1-02
- domain: resilient
- topic: resilience
- tags: dr-warm-standby
- difficulty: easy
- time: 45
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q2

Which DR strategy keeps a scaled-down but fully functional copy always running, ready to scale up on failover?

- A. Backup & Restore
- B. Pilot Light
- C. Warm Standby
- D. Multi-Site Active-Active

**Answer:** C

**Explanation:** Scaled-down but running, scale up on failover = Warm Standby.

---

## Q 15-v1-03
- domain: resilient
- topic: resilience
- tags: rto-rpo, dr-multi-site
- difficulty: easy
- time: 45
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q3

Which DR strategy runs full production capacity in two or more Regions simultaneously, giving near-zero RTO/RPO?

- A. Backup & Restore
- B. Pilot Light
- C. Warm Standby
- D. Multi-Site Active-Active

**Answer:** D

**Explanation:** Full capacity in multiple Regions, near-zero RTO/RPO = Multi-Site Active-Active.

---

## Q 15-v1-04
- domain: resilient
- topic: resilience
- services: Aurora
- tags: rto-rpo, aurora-global-database
- difficulty: easy
- time: 45
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q4

A company needs the recovery POINT objective (RPO) to be near zero for a relational database across Regions. Which solution is BEST?

- A. Daily RDS snapshots copied cross-Region
- B. Aurora Global Database
- C. EBS snapshots
- D. S3 versioning

**Answer:** B

**Explanation:** Near-zero RPO relational cross-Region = Aurora Global Database.

---

## Q 15-v1-05
- domain: resilient
- topic: resilience
- services: EC2 Auto Scaling, ALB
- tags: route53-health-checks
- difficulty: medium
- time: 80
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q5

A web tier must remain available if a single AZ fails. Which design achieves this? (Choose TWO)

- A. Auto Scaling group spanning at least two AZs
- B. ALB across multiple AZs with health checks
- C. Single large instance in one AZ
- D. Vertical scaling only
- E. Storing the app on Instance Store

**Answer:** A, B

**Explanation:** AZ-failure HA = multi-AZ ASG + multi-AZ ALB w/ health checks.

---

## Q 15-v1-06
- domain: resilient
- topic: resilience
- tags: rto-rpo
- difficulty: easy
- time: 45
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q6

Which term describes the maximum acceptable amount of DATA LOSS measured in time?

- A. RTO (Recovery Time Objective)
- B. RPO (Recovery Point Objective)
- C. MTTR
- D. SLA

**Answer:** B

**Explanation:** Max acceptable data loss in time = RPO.

---

## Q 15-v1-07
- domain: resilient
- topic: resilience
- services: ELB, EC2 Auto Scaling, ALB
- tags: route53-health-checks
- difficulty: easy
- time: 45
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q7

A stateless application behind an ALB needs automatic replacement of unhealthy instances. What provides this?

- A. ELB health checks + Auto Scaling group
- B. Larger instance type
- C. Multi-AZ RDS
- D. CloudFront

**Answer:** A

**Explanation:** Auto-replace unhealthy instances = ELB health checks + ASG.

---

## Q 15-v1-08
- domain: resilient
- topic: resilience
- services: S3
- tags: s3-versioning, mfa
- difficulty: easy
- time: 45
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q8

To protect against accidental deletion of critical S3 data and enable recovery of prior versions, enable:

- A. S3 Versioning (optionally with MFA Delete)
- B. S3 Transfer Acceleration
- C. S3 Select
- D. Requester Pays

**Answer:** A

**Explanation:** Protect/recover S3 data = Versioning (+ MFA Delete).

---

## Q 15-v1-09
- domain: resilient
- topic: resilience
- services: DynamoDB
- tags: multi-region, dynamodb-global-tables
- difficulty: easy
- time: 45
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q9

A DynamoDB table must be globally available with low-latency local reads/writes and automatic multi-Region replication. Which feature?

- A. DynamoDB Global Tables
- B. DynamoDB Streams only
- C. DAX
- D. On-demand capacity

**Answer:** A

**Explanation:** Multi-Region active-active DynamoDB = Global Tables.

---

## Q 15-v1-10
- domain: resilient
- topic: resilience
- services: Route 53
- tags: route53-health-checks, route53-routing
- difficulty: easy
- time: 45
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q10

Which Route 53 routing policy with health checks provides active-passive failover between a primary and a standby site?

- A. Failover routing
- B. Weighted routing
- C. Simple routing
- D. Geolocation routing

**Answer:** A

**Explanation:** Active-passive failover = Failover routing + health checks.

---

## Q 15-v1-11
- domain: resilient
- topic: resilience
- services: AWS Backup, EC2, EBS, RDS, DynamoDB, EFS
- tags: automated-backups
- difficulty: easy
- time: 45
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q11

A company wants centralized, automated backups with defined retention across EC2, EBS, RDS, DynamoDB, and EFS. Which service?

- A. AWS Backup
- B. Manual snapshots per service
- C. S3 lifecycle only
- D. AWS Config

**Answer:** A

**Explanation:** Central automated backups w/ retention = AWS Backup.

---

## Q 15-v1-12
- domain: resilient
- topic: resilience
- services: SQS
- tags: decoupling, high-availability, sqs-dlq
- difficulty: easy
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q12

To make an SQS-decoupled processing tier fault tolerant so a consumer crash does not lose work, which design is BEST?

- A. Messages remain in the queue until successfully processed; failures go to a DLQ
- B. Delete messages immediately on receipt
- C. Use a single consumer with no retries
- D. Disable visibility timeout

**Answer:** A

**Explanation:** Keep messages until processed; failures -> DLQ.

---

## Q 15-v1-13
- domain: resilient
- topic: resilience
- services: RDS
- tags: multi-az
- difficulty: easy
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q13

A multi-AZ RDS primary fails. What happens?

- A. Manual promotion of a read replica is required
- B. RDS automatically fails over to the standby in another AZ via DNS
- C. The application must change the connection string
- D. Data is lost since replication is asynchronous

**Answer:** B

**Explanation:** Multi-AZ RDS auto-fails over to standby via DNS.

---

## Q 15-v1-14
- domain: resilient
- topic: resilience
- tags: read-replicas
- difficulty: easy
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q14

A pilot-light DR setup for a database typically keeps which component running in the DR Region?

- A. A continuously replicated database (e.g., read replica) that can be promoted
- B. Nothing at all
- C. Full production fleet at scale
- D. Only S3 backups

**Answer:** A

**Explanation:** Pilot Light DB = continuously replicated DB ready to promote.

---

## Q 15-v1-15
- domain: resilient
- topic: resilience
- services: SQS, EC2 Auto Scaling
- tags: decoupling
- difficulty: medium
- time: 75
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q15

Which combination decouples and adds resilience so traffic spikes don't overwhelm a backend? (Choose TWO)

- A. Amazon SQS to buffer requests
- B. Auto Scaling on the consumer tier
- C. A single fixed-size EC2 instance
- D. Synchronous tight coupling
- E. Disabling retries

**Answer:** A, B

**Explanation:** Resilience to spikes = SQS buffer + Auto Scaling consumers.

---

## Q 15-v1-16
- domain: resilient
- topic: resilience
- services: S3
- tags: multi-region, compliance, s3-replication, s3-versioning
- difficulty: easy
- time: 45
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q16

To achieve cross-Region disaster recovery for objects in S3 with compliance and lower-latency reads in a second Region, use:

- A. S3 Cross-Region Replication (with versioning)
- B. S3 One Zone-IA
- C. S3 Transfer Acceleration
- D. S3 Object Lock only

**Answer:** A

**Explanation:** Cross-Region DR + compliance for S3 = CRR with versioning.

---

## Q 15-v1-17
- domain: resilient
- topic: resilience
- services: Route 53
- tags: rto-rpo, dr-multi-site, route53-routing
- difficulty: easy
- time: 55
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q17

A company wants near-zero RTO for an entire stateless application across two Regions. Which approach fits a Multi-Site Active-Active design?

- A. Route 53 latency/weighted routing to full stacks in both Regions + global data layer
- B. A single Region with Multi-AZ only
- C. Nightly backups restored on demand
- D. Pilot Light with manual scale-up

**Answer:** A

**Explanation:** Active-Active = Route 53 to full stacks in both Regions + global data.

---

## Q 15-v1-18
- domain: resilient
- topic: resilience
- services: EC2 Auto Scaling
- difficulty: easy
- time: 45
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q18

Which AWS feature improves application resilience by distributing instances across multiple AZs automatically and replacing failures?

- A. EC2 Auto Scaling with multiple AZs
- B. Placement group (cluster)
- C. Dedicated Host
- D. Spot Fleet only

**Answer:** A

**Explanation:** Distribute + replace across AZs = EC2 Auto Scaling multi-AZ.

---

## Q 15-v1-19
- domain: cost
- topic: resilience
- tags: rto-rpo, dr-backup-restore, snapshots
- difficulty: easy
- time: 50
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q19

A company has RTO of 1 hour and RPO of 15 minutes for a workload. Which strategy is the MOST cost-effective fit?

- A. Backup & Restore with frequent snapshots/replication
- B. Multi-Site Active-Active
- C. Warm Standby at full scale
- D. No backups, rebuild manually

**Answer:** A

**Explanation:** RTO 1h/RPO 15m cost-effective = Backup & Restore w/ frequent replication (Pilot Light also acceptable; cheapest = A).

---

## Q 15-v1-20
- domain: resilient
- topic: resilience
- tags: high-availability, multi-az
- difficulty: medium
- time: 80
- source: practice-exams/15-resilience-disaster-recovery-exam.md#Q20

Which two practices increase fault tolerance for a 3-tier web app? (Choose TWO)

- A. Deploy each tier across multiple AZs
- B. Use Multi-AZ for the database
- C. Put all tiers on one EC2 instance
- D. Use a single NAT instance with no redundancy
- E. Store session state only in instance memory

**Answer:** A, B

**Explanation:** Fault tolerance = multi-AZ tiers + Multi-AZ database.
