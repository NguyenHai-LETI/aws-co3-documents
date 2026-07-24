# 🛡️ Practice Exam 15 — Resilience & Disaster Recovery (SAA-C03) · V2

**30 questions** · scenario-based · English. Answers in `15-resilience-disaster-recovery-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q20
- **Part B — Khó / Nâng cao:** Q21–Q30

---

## Part A — Vận dụng (20 câu)

**1.** A stateless web app must stay available if one AZ fails. Which design is BEST?

- A. Single EC2 in one AZ
- B. Auto Scaling group across multiple AZs behind an ELB
- C. Larger instance in one AZ
- D. EC2 with Elastic IP only

**2.** A DR strategy with the LOWEST cost that accepts hours of RTO/RPO by restoring from backups. Which strategy?

- A. Backup & Restore
- B. Pilot Light
- C. Warm Standby
- D. Multi-Site Active-Active

**3.** A DR strategy keeps a minimal core (e.g., database replica) running in another Region, scaling up on disaster. Which strategy?

- A. Backup & Restore
- B. Pilot Light
- C. Multi-Site Active-Active
- D. Cold standby only

**4.** A DR strategy runs a scaled-down but fully functional copy in another Region, ready to scale up quickly. Which strategy?

- A. Warm Standby
- B. Backup & Restore
- C. Pilot Light
- D. Single AZ

**5.** A DR strategy with near-zero RTO/RPO serving traffic from multiple Regions simultaneously. Which strategy?

- A. Multi-Site Active-Active
- B. Pilot Light
- C. Backup & Restore
- D. Warm Standby

**6.** RTO and RPO — which definition is CORRECT?

- A. RTO = max acceptable downtime; RPO = max acceptable data loss (time)
- B. RTO = data loss; RPO = downtime
- C. Both mean the same
- D. RPO = recovery cost

**7.** A relational database must fail over automatically to another AZ with synchronous replication. Which feature?

- A. RDS Multi-AZ
- B. Read Replica
- C. Cross-Region snapshot
- D. DynamoDB

**8.** S3 data must be copied to another Region for DR and compliance. Which feature?

- A. Cross-Region Replication (CRR)
- B. Same-Region Replication
- C. Lifecycle to Glacier
- D. Transfer Acceleration

**9.** Route 53 must stop sending traffic to an unhealthy Regional endpoint and send it to a standby. Which combination?

- A. Health checks + failover routing
- B. Weighted routing only
- C. Simple routing
- D. Geolocation only

**10.** A DynamoDB table needs multi-Region resilience with active-active writes. Which feature?

- A. Global Tables
- B. DAX
- C. Streams only
- D. On-demand backup

**11.** An Aurora database needs cross-Region DR with fast failover and low replication lag. Which feature?

- A. Aurora Global Database
- B. RDS Multi-AZ
- C. Read Replica in same Region
- D. Manual snapshot copy

**12.** A fleet must automatically replace unhealthy instances to maintain capacity. Which service?

- A. Auto Scaling group with health checks
- B. Single instance with CloudWatch
- C. Elastic IP
- D. Placement group

**13.** A workload must survive the loss of an entire Region. Which approach is required?

- A. Multi-Region architecture
- B. Multi-AZ in one Region only
- C. Larger instances
- D. More EBS volumes

**14.** Backups of EBS, RDS, DynamoDB, and EFS must be centrally scheduled and retained by policy. Which service?

- A. AWS Backup
- B. Manual snapshots
- C. S3 CRR
- D. Storage Gateway

**15.** An SQS-decoupled worker tier ensures messages are not lost if workers fail. Which property provides this resilience?

- A. Messages persist in the queue until successfully processed/deleted
- B. Messages are lost immediately
- C. Only FIFO retains messages
- D. SNS retains messages

**16.** A single point of failure exists because the app uses one NAT Instance. What improves resilience?

- A. NAT Gateway per AZ (redundant) or multiple NAT Gateways
- B. One larger NAT Instance
- C. Remove NAT entirely
- D. Elastic IP on the instance

**17.** A database read replica must be promotable to primary during a DR event. Which is TRUE?

- A. Read Replicas can be manually promoted to standalone primaries
- B. Read Replicas fail over automatically like Multi-AZ
- C. Read Replicas are synchronous
- D. Read Replicas cannot be promoted

**18.** To reduce RPO for a database DR, which approach helps MOST?

- A. Continuous/asynchronous replication to the DR Region
- B. Weekly backups only
- C. Monthly snapshots
- D. No replication

**19.** An application must maintain sessions across instance failures. Which approach avoids losing session state?

- A. Store sessions in ElastiCache/DynamoDB (externalized state)
- B. Store sessions in instance memory
- C. Sticky sessions only
- D. Local disk

**20.** Cross-zone load balancing on an ELB provides what resilience benefit?

- A. Even distribution of traffic across targets in all enabled AZs
- B. Cross-Region failover
- C. Data replication
- D. DDoS protection

---

## Part B — Khó / Nâng cao (10 câu)

**21.** A company needs RTO of minutes and RPO of seconds across Regions, at moderate cost, without running full production capacity idle. Which strategy is BEST?

- A. Backup & Restore
- B. Pilot Light
- C. Warm Standby
- D. Cold backups only

**22.** An active-active multi-Region app must route users to the closest Region and fail over instantly. Which two support this? (Choose TWO)

- A. Route 53 latency-based routing with health checks
- B. AWS Global Accelerator with endpoint health checks
- C. Single-Region ALB
- D. EBS Multi-Attach
- E. NAT Gateway

**23.** A DR plan must be validated regularly without impacting production. Which service enables non-disruptive DR drills for on-prem/EC2 replication?

- A. AWS Elastic Disaster Recovery (DRS) drill launches
- B. Manual failover to prod
- C. S3 CRR only
- D. Snapshot copy only

**24.** An Aurora Global Database must be promoted in the secondary Region during a Regional outage. Which two are TRUE? (Choose TWO)

- A. Managed unplanned failover promotes the secondary Region
- B. Typical cross-Region replication lag is under a second
- C. Promotion loses all data always
- D. Aurora Global requires DynamoDB
- E. Only Multi-AZ is involved

**25.** A stateful application on EC2 needs data durability across AZ failure without cross-AZ EBS. Which approach?

- A. Use EFS (multi-AZ) for shared data or replicate/snapshot across AZs
- B. Single EBS volume in one AZ
- C. Instance Store
- D. Local disk only

**26.** A company must guarantee automated backups are immutable and cannot be deleted during a retention window (ransomware resilience). Which feature?

- A. AWS Backup Vault Lock
- B. IAM deny policy only
- C. KMS rotation
- D. S3 lifecycle

**27.** A multi-tier app must avoid cascading failure when a downstream dependency is slow. Which two resilience patterns apply? (Choose TWO)

- A. Queue-based load leveling (SQS) to absorb bursts
- B. Circuit breaker / timeouts and retries with backoff
- C. Removing all retries
- D. Synchronous tight coupling
- E. Single-threaded processing

**28.** A DR requirement is RPO near zero for S3 objects across Regions with a 15-minute replication SLA. Which feature?

- A. S3 Replication Time Control (RTC)
- B. Standard CRR only
- C. Lifecycle transition
- D. Versioning alone

**29.** During failover, DNS changes are slow due to caching. Which service provides near-instant traffic shifting independent of DNS TTL?

- A. AWS Global Accelerator
- B. Route 53 with high TTL
- C. CloudFront only
- D. Longer TTL values

**30.** A workload must tolerate an AZ failure for both compute and a self-managed database. Which two are appropriate? (Choose TWO)

- A. Multi-AZ Auto Scaling for compute
- B. Database replication/standby in a second AZ (e.g., RDS Multi-AZ)
- C. Single-AZ database with hourly backups only
- D. One instance with Elastic IP
- E. Instance Store for the database
