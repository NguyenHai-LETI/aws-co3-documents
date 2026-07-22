# 🔧 Practice Exam 13 — Other Services (SAA-C03)

20 questions · scenario-based · English. Answers in `13-other-services-answers.txt`.

---

**1.** A company needs centralized, policy-based backups across EC2, EBS, RDS, DynamoDB, EFS, and FSx with compliance reporting. Which service?

- A. AWS Backup
- B. EBS Snapshots only
- C. AWS DataSync
- D. S3 Lifecycle

**2.** Employees need managed, persistent virtual desktops (Windows/Linux) accessible remotely (VDI/DaaS). Which service?

- A. Amazon WorkSpaces
- B. Amazon AppStream 2.0
- C. Amazon EC2
- D. AWS Outposts

**3.** A company wants to stream a specific desktop APPLICATION to users' browsers without installing it locally. Which service?

- A. Amazon AppStream 2.0
- B. Amazon WorkSpaces
- C. Amazon Lightsail
- D. Amazon Connect

**4.** A factory must connect thousands of IoT devices using MQTT, with device state shadows and a rules engine. Which service?

- A. AWS IoT Core
- B. Amazon Kinesis
- C. AWS Ground Station
- D. Amazon MQ

**5.** A regulated workload must run AWS compute and services ON-PREMISES in the company's data center for low latency and data residency. Which service?

- A. AWS Outposts
- B. AWS Wavelength
- C. AWS Local Zones
- D. Amazon WorkSpaces

**6.** A gaming company needs single-digit millisecond latency to end users in a metro area not near a Region. Which service?

- A. AWS Local Zones
- B. AWS Outposts
- C. AWS Snowcone
- D. AWS Ground Station

**7.** An application needs ultra-low latency to mobile users over 5G carrier networks. Which service?

- A. AWS Wavelength
- B. AWS Local Zones
- C. CloudFront
- D. Global Accelerator

**8.** A research team needs to schedule and downlink data from satellites without owning ground-station infrastructure. Which service?

- A. AWS Ground Station
- B. AWS IoT Core
- C. AWS Outposts
- D. AWS Snowmobile

**9.** Which service provides a fully managed, omnichannel cloud contact center?

- A. Amazon Connect
- B. Amazon Pinpoint
- C. Amazon SES
- D. Amazon Chime

**10.** A company wants a simple recurring schedule (cron) to invoke targets at scale with one-time or recurring schedules and time zones. Which service?

- A. Amazon EventBridge Scheduler
- B. Amazon SQS delay queue
- C. AWS Step Functions wait
- D. AWS Config

**11.** Which service is BEST for centrally managing backup retention to meet a 7-year compliance requirement across services?

- A. AWS Backup with backup vaults and lifecycle policies
- B. Manual EBS snapshots
- C. S3 only
- D. CloudWatch Logs retention

**12.** A team needs human workers to perform small tasks (data labeling, content moderation) at scale (crowdsourcing). Which service?

- A. Amazon Mechanical Turk
- B. AWS Lambda
- C. Amazon SageMaker endpoints
- D. Amazon Connect

**13.** Which statement about AWS Outposts is correct?

- A. It runs AWS services in your own data center as a hybrid extension
- B. It is a CDN
- C. It is a serverless function service
- D. It is only for satellite communications

**14.** A company wants AWS Backup to protect Amazon DynamoDB tables with point-in-time recovery and scheduled backups. Is this supported?

- A. Yes, AWS Backup supports DynamoDB
- B. No, DynamoDB cannot be backed up
- C. Only via manual exports to S3
- D. Only with Global Tables

**15.** Which service is appropriate for streaming GPU-accelerated 3D applications to remote users?

- A. Amazon AppStream 2.0
- B. AWS Backup
- C. Amazon SES
- D. AWS IoT Core

**16.** A hybrid setup needs consistent AWS APIs both in-Region and on-premises for a low-latency manufacturing app. Which is BEST?

- A. AWS Outposts
- B. CloudFront
- C. AWS Snowmobile
- D. AWS Ground Station

**17.** Which option provides disaster recovery by replicating on-premises and cloud servers into AWS for fast recovery (RPO/RTO minutes)?

- A. AWS Elastic Disaster Recovery (DRS)
- B. AWS Backup only
- C. Amazon S3 versioning
- D. AWS Config

**18.** A company wants to deliver low-latency live video to viewers in a specific city far from any Region with minimal architecture change. Which service?

- A. AWS Local Zones
- B. Amazon WorkSpaces
- C. AWS Outposts only
- D. Amazon Connect

**19.** Which two services extend AWS infrastructure closer to users/devices for ultra-low latency? (Choose TWO)

- A. AWS Local Zones
- B. AWS Wavelength
- C. Amazon WorkSpaces
- D. AWS Backup
- E. Amazon SES

**20.** A company must centralize cross-account, cross-Region backup management with a single policy. Which feature supports this?

- A. AWS Backup with Organizations (backup policies)
- B. Per-account manual snapshots
- C. CloudTrail
- D. AWS Budgets
