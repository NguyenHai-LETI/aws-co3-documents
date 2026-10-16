# 🎯 AWS SAA-C03 Practice Exams (English)

Bộ đề luyện thi tiếng Anh, chia theo từng chủ đề đánh số trùng với tài liệu gốc trong folder cha.

## 📂 Cách dùng
1. Mở file `XX-...-exam.md` → tự làm 20 câu (đừng xem đáp án).
2. Chấm điểm bằng file `XX-...-answers.txt` (định dạng `số_đápán`, ví dụ `1_C`), kèm giải thích ngắn.
3. Câu nào sai → quay lại đọc file lý thuyết tương ứng ở folder cha (`01-compute-services.md`, …).

## 📋 Danh sách đề
| # | Đề | Số câu | Trọng tâm |
|---|----|--------|-----------|
| 00 | `00-DANH-GIA-COVERAGE.md` | — | Đánh giá độ bao phủ + đề xuất (Task 1) |
| 01 | Compute | 20 | EC2, Lambda, ECS/EKS/Fargate, ASG |
| 02 | Storage | 20 | S3, EBS, EFS, FSx, Snow, Storage Gateway |
| 03 | Database | 20 | RDS, Aurora, DynamoDB, ElastiCache, Redshift |
| 04 | Networking | 20 | VPC, ELB, Route 53, CloudFront, DX/VPN |
| 05 | Security | 20 | IAM, KMS, WAF/Shield, GuardDuty, Cognito |
| 06 | Management & Governance | 20 | CloudFormation, SSM, Organizations |
| 07 | Application Integration | 20 | SQS, SNS, EventBridge, Step Functions |
| 08 | Developer Tools | 20 | Code* services, CI/CD |
| 09 | Analytics & Big Data | 20 | Kinesis, Athena, Glue, EMR, OpenSearch |
| 10 | Migration & Transfer | 20 | DMS, Snow, DataSync, MGN |
| 11 | API & Integration | 20 | API Gateway, AppSync, SES |
| 12 | ML / AI | 20 | Rekognition, Comprehend, SageMaker… |
| 13 | Other Services | 20 | WorkSpaces, Outposts, AWS Backup |
| 14 | Service Comparisons | 20 | Câu "chọn đúng service" dễ nhầm |
| 15 | **Resilience & Disaster Recovery** | 20 | HA, Multi-AZ/Region, DR (gap) |
| 16 | **Cost Optimization** | 20 | Pricing, right-sizing (gap) |
| 17 | **Gap Services** | 20 | RDS Proxy, RAM, Flow Logs, Route 53 Resolver, MSK… |

**Tổng: 340 câu.**

## ✍️ Quy ước
- `(Choose TWO)` / `(Choose THREE)` = câu multiple-response → đáp án dạng `12_BD`.
- Đáp án txt: mỗi dòng `số_đápán - giải thích ngắn`. Token đầu (`1_C`) đúng định dạng yêu cầu.

> ⚖️ Câu hỏi là **nguyên gốc, mô phỏng sát phong cách đề thi** (không sao chép đề thật vì lý do bản quyền/NDA).

---

## 🆕 Bộ đề mở rộng V2 (405 câu)

Bộ đề `XX-...-exam-v2.md` + `XX-...-answers-v2.txt` là bản mở rộng, mỗi chapter chia 2 phần:
- **Part A — Vận dụng (Application):** tình huống áp dụng trực tiếp.
- **Part B — Khó / Nâng cao (Advanced):** kết hợp nhiều khái niệm, câu bẫy, multiple-response.

Phân loại theo trọng số domain thi:

| Loại | Chapter | Số câu (A + B) |
|------|---------|----------------|
| **LỚN** | 01, 02, 03, 04, 05, 06, 07, 09, 15, 16 | 30 (20 + 10) |
| **NHỎ** | 08, 10, 11, 12, 13, 14, 17 | 15 (10 + 5) |

**Tổng V2: 10×30 + 7×15 = 405 câu.** Đáp án `.txt` cùng format `số_đápán - giải thích` (multi-response: `21_BD`).

> File V1 (20 câu/chapter) vẫn giữ nguyên để đối chiếu.
