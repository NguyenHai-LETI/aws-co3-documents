# 🧩 Practice Exam 13 — Other Services (SAA-C03) · V2

**15 questions** · scenario-based · English. Answers in `13-other-services-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q10
- **Part B — Khó / Nâng cao:** Q11–Q15

---

## Part A — Vận dụng (10 câu)

**1.** A company must provide managed virtual desktops (DaaS) to remote employees. Which service?

- A. Amazon WorkSpaces
- B. Amazon AppStream 2.0
- C. Amazon EC2
- D. AWS Outposts

**2.** A company must stream a desktop application to users' browsers without installing it locally. Which service?

- A. Amazon AppStream 2.0
- B. Amazon WorkSpaces
- C. Lightsail
- D. WorkDocs

**3.** A company needs AWS infrastructure (compute/storage) running physically in its own data center for low latency and data residency. Which service?

- A. AWS Outposts
- B. AWS Local Zones
- C. AWS Wavelength
- D. Snowball

**4.** An application needs single-digit millisecond latency to end users in a specific metro area near, but not in, an AWS Region. Which service?

- A. AWS Local Zones
- B. AWS Outposts
- C. Global Accelerator
- D. CloudFront

**5.** A mobile app requires ultra-low latency by running compute at the edge of 5G networks. Which service?

- A. AWS Wavelength
- B. AWS Outposts
- C. Local Zones
- D. Direct Connect

**6.** A company wants a centralized, policy-based backup service across EBS, RDS, DynamoDB, EFS, and more. Which service?

- A. AWS Backup
- B. EBS snapshots only
- C. S3 lifecycle
- D. Storage Gateway

**7.** A company needs disaster recovery that continuously replicates on-premises servers to AWS for fast failover. Which service?

- A. AWS Elastic Disaster Recovery (DRS)
- B. AWS Backup
- C. DataSync
- D. Snowball

**8.** A company wants a managed cloud contact center for customer service. Which service?

- A. Amazon Connect
- B. Amazon Chime
- C. Amazon Pinpoint
- D. WorkMail

**9.** A company must connect and manage millions of IoT devices sending telemetry. Which service?

- A. AWS IoT Core
- B. Kinesis only
- C. SQS
- D. AppSync

**10.** A company wants managed business email and calendaring. Which service?

- A. Amazon WorkMail
- B. Amazon WorkDocs
- C. Amazon Connect
- D. SES

---

## Part B — Khó / Nâng cao (5 câu)

**11.** A regulated workload must keep data on-premises for residency but use AWS APIs/services locally, with a consistent hybrid experience. Which two are appropriate? (Choose TWO)

- A. AWS Outposts (rack/servers)
- B. Local Zones for metro low latency
- C. Snowmobile
- D. CloudFront
- E. Global Accelerator

**12.** AWS Backup must enforce that backups cannot be deleted before a retention period, even by admins (ransomware protection). Which feature?

- A. AWS Backup Vault Lock (compliance mode)
- B. S3 Object Lock only
- C. IAM policy only
- D. KMS grant

**13.** A company needs cross-Region, cross-account centralized backups with a single policy. Which two AWS Backup features apply? (Choose TWO)

- A. Backup plans with cross-Region copy
- B. Cross-account backup via Organizations
- C. Manual snapshots per resource only
- D. Storage Gateway tapes
- E. EFS lifecycle only

**14.** Elastic Disaster Recovery (DRS) minimizes cost during steady state. How does it achieve low-cost standby?

- A. Continuous block-level replication into low-cost staging, launching full instances only on failover/drill
- B. Running full-size duplicate instances 24/7
- C. Taking daily snapshots only
- D. Using Snowball for replication

**15.** A company must give contractors temporary, non-persistent virtual desktops that reset after each session. Which WorkSpaces/related option fits?

- A. Non-persistent streaming (AppStream 2.0) or WorkSpaces with rebuild
- B. Persistent WorkSpaces only
- C. EC2 with manual reset
- D. Outposts desktops
