# 🛡️ Practice Exam 15 — Resilience & Disaster Recovery (GAP topic · Domain 2 = 26%)

20 questions on high availability, fault tolerance, backup, and DR strategies — the highest-value gap. Answers in `15-resilience-disaster-recovery-answers.txt`.

---

**1.** Which DR strategy has the LOWEST cost but the LONGEST recovery time (RTO), restoring infrastructure only after a disaster?

- A. Backup & Restore
- B. Pilot Light
- C. Warm Standby
- D. Multi-Site Active-Active

**2.** Which DR strategy keeps a scaled-down but fully functional copy always running, ready to scale up on failover?

- A. Backup & Restore
- B. Pilot Light
- C. Warm Standby
- D. Multi-Site Active-Active

**3.** Which DR strategy runs full production capacity in two or more Regions simultaneously, giving near-zero RTO/RPO?

- A. Backup & Restore
- B. Pilot Light
- C. Warm Standby
- D. Multi-Site Active-Active

**4.** A company needs the recovery POINT objective (RPO) to be near zero for a relational database across Regions. Which solution is BEST?

- A. Daily RDS snapshots copied cross-Region
- B. Aurora Global Database
- C. EBS snapshots
- D. S3 versioning

**5.** A web tier must remain available if a single AZ fails. Which design achieves this? (Choose TWO)

- A. Auto Scaling group spanning at least two AZs
- B. ALB across multiple AZs with health checks
- C. Single large instance in one AZ
- D. Vertical scaling only
- E. Storing the app on Instance Store

**6.** Which term describes the maximum acceptable amount of DATA LOSS measured in time?

- A. RTO (Recovery Time Objective)
- B. RPO (Recovery Point Objective)
- C. MTTR
- D. SLA

**7.** A stateless application behind an ALB needs automatic replacement of unhealthy instances. What provides this?

- A. ELB health checks + Auto Scaling group
- B. Larger instance type
- C. Multi-AZ RDS
- D. CloudFront

**8.** To protect against accidental deletion of critical S3 data and enable recovery of prior versions, enable:

- A. S3 Versioning (optionally with MFA Delete)
- B. S3 Transfer Acceleration
- C. S3 Select
- D. Requester Pays

**9.** A DynamoDB table must be globally available with low-latency local reads/writes and automatic multi-Region replication. Which feature?

- A. DynamoDB Global Tables
- B. DynamoDB Streams only
- C. DAX
- D. On-demand capacity

**10.** Which Route 53 routing policy with health checks provides active-passive failover between a primary and a standby site?

- A. Failover routing
- B. Weighted routing
- C. Simple routing
- D. Geolocation routing

**11.** A company wants centralized, automated backups with defined retention across EC2, EBS, RDS, DynamoDB, and EFS. Which service?

- A. AWS Backup
- B. Manual snapshots per service
- C. S3 lifecycle only
- D. AWS Config

**12.** To make an SQS-decoupled processing tier fault tolerant so a consumer crash does not lose work, which design is BEST?

- A. Messages remain in the queue until successfully processed; failures go to a DLQ
- B. Delete messages immediately on receipt
- C. Use a single consumer with no retries
- D. Disable visibility timeout

**13.** A multi-AZ RDS primary fails. What happens?

- A. Manual promotion of a read replica is required
- B. RDS automatically fails over to the standby in another AZ via DNS
- C. The application must change the connection string
- D. Data is lost since replication is asynchronous

**14.** A pilot-light DR setup for a database typically keeps which component running in the DR Region?

- A. A continuously replicated database (e.g., read replica) that can be promoted
- B. Nothing at all
- C. Full production fleet at scale
- D. Only S3 backups

**15.** Which combination decouples and adds resilience so traffic spikes don't overwhelm a backend? (Choose TWO)

- A. Amazon SQS to buffer requests
- B. Auto Scaling on the consumer tier
- C. A single fixed-size EC2 instance
- D. Synchronous tight coupling
- E. Disabling retries

**16.** To achieve cross-Region disaster recovery for objects in S3 with compliance and lower-latency reads in a second Region, use:

- A. S3 Cross-Region Replication (with versioning)
- B. S3 One Zone-IA
- C. S3 Transfer Acceleration
- D. S3 Object Lock only

**17.** A company wants near-zero RTO for an entire stateless application across two Regions. Which approach fits a Multi-Site Active-Active design?

- A. Route 53 latency/weighted routing to full stacks in both Regions + global data layer
- B. A single Region with Multi-AZ only
- C. Nightly backups restored on demand
- D. Pilot Light with manual scale-up

**18.** Which AWS feature improves application resilience by distributing instances across multiple AZs automatically and replacing failures?

- A. EC2 Auto Scaling with multiple AZs
- B. Placement group (cluster)
- C. Dedicated Host
- D. Spot Fleet only

**19.** A company has RTO of 1 hour and RPO of 15 minutes for a workload. Which strategy is the MOST cost-effective fit?

- A. Backup & Restore with frequent snapshots/replication
- B. Multi-Site Active-Active
- C. Warm Standby at full scale
- D. No backups, rebuild manually

**20.** Which two practices increase fault tolerance for a 3-tier web app? (Choose TWO)

- A. Deploy each tier across multiple AZs
- B. Use Multi-AZ for the database
- C. Put all tiers on one EC2 instance
- D. Use a single NAT instance with no redundancy
- E. Store session state only in instance memory
