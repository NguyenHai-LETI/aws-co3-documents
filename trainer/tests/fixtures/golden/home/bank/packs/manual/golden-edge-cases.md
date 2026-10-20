---
pack: golden-edge-cases
title: "Golden · format edge cases"
exam: SAA-C03
origin: manual
created: 2026-10-20
description: "Hand-written variations of the pack format (tests/golden.test.ts) — never edit without regenerating the golden files"
defaults:
  domain: cost
  topic: storage
  difficulty: easy
---

# Golden · format edge cases

Text outside question blocks is ignored by the parser.

## Q golden-checkbox-01
- services: S3
- tags: storage-classes, lifecycle
- time: 1m30s

A company keeps **monthly** reports in Amazon S3. Reports are read often for 30 days and almost never after that,
but they must stay available within milliseconds for audits. Which storage approach is the MOST cost-effective?

- [ ] A. Keep every report in S3 Standard and rely on S3 Intelligent-Tiering monitoring fees to stay low over time
- [x] B. Add a lifecycle rule that transitions objects to S3 Standard-Infrequent Access 30 days after creation
- [ ] C. Move the reports to S3 Glacier Deep Archive after 30 days and restore them
  in bulk when an audit starts
- [ ] D. Copy the reports to an Amazon EBS Cold HDD volume attached to a small EC2 instance

> **Explanation:** Standard-IA keeps millisecond access at a lower storage price once access drops.
> - Deep Archive restores take hours.
> - EBS adds an instance to run.

---

## Q golden-multi-02
- domain: resilient
- task: 2.2
- topic: database
- services: RDS, Aurora
- difficulty: hard
- time: 1:45
- variant_of: 03-v1-01
- refs: 03-database-services.md, E-kien-truc-database.md
- hint: Một lựa chọn lo phần đọc, một lựa chọn lo phần chuyển đổi dự phòng.
- status: draft
- created: 2026-10-20
- concept: read scaling vs automatic failover

A relational database must keep serving reads when one Availability Zone fails and must scale read traffic during
monthly reporting. Which TWO actions meet these requirements? (Choose TWO.)

- A. Enable automated backups with a 35-day retention period
- B. Deploy the DB instance as a Multi-AZ deployment
- C. Increase the instance size before every reporting window
- D. Add read replicas and point the reporting tool at the reader endpoint
- E. Turn on Performance Insights for the database

**Answer:** B, D

**Explanation:** Multi-AZ provides automatic failover; read replicas absorb the reporting reads.

---

## Q golden-viet-03
- domain: cost
- task: 4.1
- services: S3
- status: retired
- enriched: 2026-10-19

Một công ty muốn giảm chi phí lưu trữ log cũ trên Amazon S3 mà không cần truy cập nhanh. Chọn giải pháp nào?

- A. S3 Standard
- B. S3 One Zone-IA cho log cần đọc mỗi ngày
- C. S3 Glacier Flexible Retrieval với lifecycle rule
- D. Amazon EFS Standard

Correct answer: C

Giải thích: Glacier Flexible Retrieval rẻ nhất trong các lựa chọn cho dữ liệu hiếm khi đọc.

---

## Q golden-warnings-04
- domain: performance
- task: 3.1
- topic: compute
- foo: bar

An application needs more CPU only during business hours. What should the architect do?

- A. Use a scheduled scaling action for the Auto Scaling group
- B. Buy a three-year Reserved Instance for the peak capacity
- C. Run the largest instance type all the time

Remember to read every option.

**Answer:** A

**Explanation:** Option A matches a predictable schedule; B and C pay for idle capacity.

---

## Q golden-choose-mismatch-05
- domain: secure
- task: 1.1
- topic: security
- time: 60

Which service should store database credentials and rotate them automatically? (Choose TWO.)

- A. AWS Secrets Manager
- B. Amazon S3 with versioning
- C. AWS Config
- D. Amazon Inspector

**Answer:** A

**Explanation:** Secrets Manager stores secrets and rotates them on a schedule.

---

## Q golden-no-answer-06
- domain: cost
- time: 50

This block has options but no answer line, so the parser drops it with an error.

- A. First
- B. Second
- C. Third
- D. Fourth

**Explanation:** Missing answer on purpose.

---

## Q Golden_Bad_ID
- domain: cost
- time: 50

Invalid id and option keys that skip a letter.

- A. One
- B. Two
- D. Four

**Answer:** B

**Explanation:** Kept as an error case.

---

## Q golden-checkbox-01
- domain: cost
- time: 50

Duplicate id inside the same pack — the bank keeps the first definition.

- A. One
- B. Two
- C. Three
- D. Four

**Answer:** D

**Explanation:** Duplicate on purpose.
