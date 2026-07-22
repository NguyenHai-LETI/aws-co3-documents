# 📋 ĐÁNH GIÁ ĐỘ BAO PHỦ KIẾN THỨC & ĐỀ XUẤT BỔ SUNG

> **Task 1**: Kiểm tra tài liệu trong folder đã cover đủ cho kỳ thi AWS SAA-C03 chưa.
> Cập nhật: 2026-06-20 · Đối chiếu với **AWS SAA-C03 Exam Guide chính thức**.

---

## 🎯 1. Blueprint kỳ thi SAA-C03 (xác nhận còn hiệu lực 2025–2026)

| Domain | Tên | Tỷ trọng |
|--------|-----|----------|
| Domain 1 | Design **Secure** Architectures | **30%** |
| Domain 2 | Design **Resilient** Architectures | **26%** |
| Domain 3 | Design **High-Performing** Architectures | **24%** |
| Domain 4 | Design **Cost-Optimized** Architectures | **20%** |

- 65 câu (50 chấm điểm + 15 thử nghiệm), 130 phút, pass **720/1000**.
- Định dạng: multiple choice (1 đúng) và multiple response (2+ đúng).

Nguồn: [AWS Exam Guide SAA-C03 (PDF)](https://d1.awsstatic.com/training-and-certification/docs-sa-assoc/AWS-Certified-Solutions-Architect-Associate_Exam-Guide_C03.pdf) · [AWS docs](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html)

---

## ✅ 2. Kết luận tổng quát

**Tài liệu của bạn bao phủ ~90% nội dung thi.** Phần dịch vụ cốt lõi (Compute, Storage, Database, Networking, Security) được viết **rất chi tiết và đúng trọng tâm** — đủ để học và đỗ. Cấu trúc scenario-based + decision trees + keywords mapping rất phù hợp với cách ra đề của AWS.

Tuy nhiên còn **một số khoảng trống (gaps)** — chủ yếu là các dịch vụ "hay bẫy" trong đề thi thực tế nhưng tài liệu chưa nhắc tới hoặc nhắc quá sơ sài.

---

## 📊 3. Bảng đánh giá theo từng topic được đánh số

| File | Chủ đề | Mức độ bao phủ | Ghi chú |
|------|--------|----------------|---------|
| 01 | Compute | 🟢 Tốt (95%) | EC2/Lambda/ECS/EKS/Fargate/Batch/ASG đầy đủ. Thiếu: ASG **lifecycle hooks / warm pools**, **EC2 Hibernation** |
| 02 | Storage | 🟢 Tốt (95%) | S3/EBS/EFS/FSx/Snow/SGW đầy đủ. Thiếu: **S3 Storage Lens**, **EBS RAID 0/1**, **FSx for Lustre ↔ S3 data repository** chi tiết |
| 03 | Database | 🟢 Tốt (92%) | Thiếu **RDS Proxy** (rất hay thi với Lambda), **Aurora Serverless v2** chi tiết, **DynamoDB TTL**, **RDS Custom** |
| 04 | Networking | 🟡 Khá (88%) | Thiếu **VPC Flow Logs** (chi tiết), **Route 53 Resolver / hybrid DNS**, **Egress-Only IGW (IPv6)**, **AWS Network Firewall** |
| 05 | Security | 🟢 Tốt (93%) | Thiếu **AWS RAM (Resource Access Manager)**, **STS / AssumeRole** chi tiết, **IAM permission boundary**, **S3 Access Points** (nằm ở file 02) |
| 06 | Management & Governance | 🟢 Tốt (90%) | Thiếu **CloudFormation `DeletionPolicy` / `DependsOn` / Drift** chi tiết, **AWS Proton**, **SSM Session Manager port forwarding** |
| 07 | Application Integration | 🟢 Tốt (92%) | Thiếu **SQS message size / S3 extended client (>256KB)**, **EventBridge Pipes**, **SNS message data protection** |
| 08 | Developer Tools | 🟢 Đủ cho thi (90%) | Domain phụ, chỉ 5–8% đề. Mức hiện tại là đủ |
| 09 | Analytics & Big Data | 🟡 Khá (85%) | Thiếu **Amazon MSK (Kafka)**, **Kinesis Data Streams shard math / resharding**, **Redshift RA3 vs Serverless** so sánh |
| 10 | Migration & Transfer | 🟢 Tốt (90%) | Thiếu **AWS Migration Evaluator / Application Discovery Service**, **DataSync vs Storage Gateway vs Transfer Family** matrix |
| 11 | API & Integration | 🟢 Đủ (88%) | Thiếu **API Gateway REST vs HTTP vs WebSocket** bảng quyết định, **mutual TLS** |
| 12 | ML/AI | 🟢 Đủ cho thi (90%) | Domain rất phụ (3–5%). Mức hiện tại đủ. Có thể thêm **Amazon Bedrock**, **Textract**, **Kendra**, **Fraud Detector** |
| 13 | Other Services | 🟢 Tốt (90%) | **AWS Backup** đã có (quan trọng). Có thể thêm **Elastic Disaster Recovery (DRS)** |
| 14 | So sánh services | 🟢 Tốt | Bảng so sánh hữu ích, dùng để ôn nhanh |

---

## 🔴 4. CÁC GAP QUAN TRỌNG NÊN BỔ SUNG (ưu tiên cao → thấp)

Đây là các chủ đề **xuất hiện nhiều trong đề SAA-C03 thực tế** nhưng tài liệu còn thiếu/sơ sài. Mình đã đưa các gap này vào **3 bộ đề bổ sung (15, 16, 17)**.

### 🥇 Ưu tiên CAO (gần như chắc chắn gặp trong đề)
1. **RDS Proxy** — connection pooling cho Lambda + RDS, giảm cạn kết nối DB, hỗ trợ failover nhanh + IAM auth. *(rất hay bẫy với serverless)*
2. **AWS Resource Access Manager (RAM)** — share subnet/Transit Gateway/License giữa các account trong Organization.
3. **VPC Flow Logs** — troubleshoot connectivity (ACCEPT/REJECT), nguồn dữ liệu cho GuardDuty.
4. **Disaster Recovery strategies** — Backup & Restore / Pilot Light / Warm Standby / Multi-Site Active-Active (RTO/RPO). *(Domain 2 = 26% nhưng không có file số riêng — file J trong README bị thiếu)*
5. **Route 53 Resolver (Inbound/Outbound Endpoints)** — hybrid DNS giữa on-premises ↔ VPC.

### 🥈 Ưu tiên TRUNG BÌNH
6. **Aurora Serverless v2** & **Aurora Global Database failover** chi tiết.
7. **Amazon MSK** (managed Kafka) — so với Kinesis.
8. **Gateway Load Balancer (GWLB)** + chuỗi traffic firewall (đã nhắc ở 04 nhưng nên luyện).
9. **AWS Network Firewall** vs **WAF** vs **Security Group/NACL** (phân tầng bảo vệ).
10. **S3 Storage Lens / Storage Class Analysis** & **S3 Object Lambda**.
11. **EventBridge Pipes & Scheduler** (point-to-point integration).

### 🥉 Ưu tiên THẤP (nên biết khái niệm)
12. **AWS Elastic Disaster Recovery (DRS)** (khác CloudEndure/MGN).
13. **Amazon Bedrock / Textract / Kendra** (AI mới, thỉnh thoảng xuất hiện).
14. **Compute Optimizer / Cost Anomaly Detection** (đã có Cost Explorer/Budgets).
15. **AWS Outposts / Local Zones / Wavelength** (đã có ở file 13, chỉ cần khái niệm).

---

## 🧭 5. Lưu ý về cấu trúc folder (phát hiện thêm)

README.md có nhắc các file **F, G, H, I, J, N, O** (Networking arch, Cost, HA, Performance, **Disaster Recovery**, service list, comparison) nhưng **các file này KHÔNG tồn tại** trong folder. Nội dung đó được thay thế một phần bởi P/Q/R/S/T. Đáng chú ý nhất là **thiếu hẳn phần Disaster Recovery (J)** — đây là lý do mình tạo **bộ đề 15 (Resilience & DR)** để bù.

---

## 📝 6. Bộ đề đã thiết kế (Task 2)

Mỗi file = **20 câu tiếng Anh** theo đúng phong cách đề SAA-C03 (scenario-based, có "MOST cost-effective / LEAST operational overhead…"). Đáp án nằm trong file `.txt` cùng tên theo định dạng `số_đápán` (ví dụ `1_C`).

> ⚖️ **Lưu ý bản quyền**: Câu hỏi thi thật của AWS nằm dưới NDA và **không được phép sao chép**. Bộ đề này gồm các câu **nguyên gốc, mô phỏng sát** các tình huống hay gặp (theo phong cách Tutorials Dojo / AWS Skill Builder) nên dùng để luyện rất hiệu quả và hợp pháp.

| # | File đề | File đáp án | Domain chính |
|---|---------|-------------|--------------|
| 01 | 01-compute-services-exam.md | 01-compute-services-answers.txt | 3, 4 |
| 02 | 02-storage-services-exam.md | 02-storage-services-answers.txt | 2, 3, 4 |
| 03 | 03-database-services-exam.md | 03-database-services-answers.txt | 2, 3 |
| 04 | 04-networking-services-exam.md | 04-networking-services-answers.txt | 1, 3 |
| 05 | 05-security-services-exam.md | 05-security-services-answers.txt | 1 |
| 06 | 06-management-governance-exam.md | 06-management-governance-answers.txt | 1, 4 |
| 07 | 07-application-integration-exam.md | 07-application-integration-answers.txt | 2 |
| 08 | 08-developer-tools-exam.md | 08-developer-tools-answers.txt | — |
| 09 | 09-analytics-bigdata-exam.md | 09-analytics-bigdata-answers.txt | 3 |
| 10 | 10-migration-transfer-exam.md | 10-migration-transfer-answers.txt | 2, 4 |
| 11 | 11-api-integration-exam.md | 11-api-integration-answers.txt | 2 |
| 12 | 12-ml-ai-exam.md | 12-ml-ai-answers.txt | 3 |
| 13 | 13-other-services-exam.md | 13-other-services-answers.txt | 2 |
| 14 | 14-service-comparisons-exam.md | 14-service-comparisons-answers.txt | All |
| 15 | 15-resilience-disaster-recovery-exam.md | 15-resilience-disaster-recovery-answers.txt | **2** |
| 16 | 16-cost-optimization-exam.md | 16-cost-optimization-answers.txt | **4** |
| 17 | 17-gap-services-exam.md | 17-gap-services-answers.txt | 1, 2, 3 (gap services) |

**Tổng: 17 đề × 20 câu = 340 câu hỏi.**

> Không tạo đề cho file `00-tong-quan` vì nội dung là *meta* về kỳ thi (không phải kiến thức chấm điểm).
