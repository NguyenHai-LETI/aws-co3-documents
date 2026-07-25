# 🧩 PROMPT MẪU — Tạo file so sánh CROSS-CUTTING cho 1 chủ đề AWS SAA-C03

> Copy nguyên khối "PROMPT" bên dưới, điền 3 chỗ `{{...}}`, rồi gửi cho Claude.
> Kết quả: 1 file `.md` so sánh cắt ngang theo từng đặc điểm, cùng style với
> [F-so-sanh-database-theo-dac-diem.md](../F-so-sanh-database-theo-dac-diem.md) (file mẫu chuẩn).

---

## ✍️ 3 chỗ cần điền

- `{{CHỦ_ĐỀ}}` — ví dụ: *Compute*, *Storage*, *Networking*, *Security & Identity*, *Application Integration*, *Monitoring*.
- `{{SERVICES}}` — danh sách service muốn so sánh (chọn nhóm "nặng", bỏ service quá niche). Ví dụ Storage: `S3, EBS, EFS, FSx, S3 Glacier, Storage Gateway`.
- `{{ĐẶC_ĐIỂM}}` — các trục so sánh. Ví dụ Storage: `độ bền/durability, availability, performance (IOPS/throughput), scaling, snapshot & backup, lifecycle/tiering, cost, security/encryption, use case chính`.

---

## 📋 PROMPT (copy từ đây)

```
Dựa vào các notes hiện có trong folder này (đặc biệt file chủ đề tương ứng,
ví dụ 01-compute-services.md / 02-storage-services.md / 04-networking-services.md ...),
hãy tạo MỘT file Markdown mới so sánh CROSS-CUTTING (cắt ngang) cho chủ đề: {{CHỦ_ĐỀ}}.

PHẠM VI service: {{SERVICES}}
CÁC ĐẶC ĐIỂM so sánh (mỗi đặc điểm = 1 bảng riêng): {{ĐẶC_ĐIỂM}}

YÊU CẦU BẮT BUỘC — bám đúng style file mẫu F-so-sanh-database-theo-dac-diem.md:

1. Ngôn ngữ: tiếng Việt, giữ nguyên thuật ngữ kỹ thuật tiếng Anh (không dịch máy móc).
2. Mở đầu: 1 dòng mô tả mục đích + dòng "Phạm vi" liệt kê service + Legend (✅ / ⚠️ / ❌).
3. MỖI đặc điểm là 1 section riêng, đánh số, có:
   - 1 bảng: HÀNG = service, CỘT = các thuộc tính con của đặc điểm đó (không nhồi tất cả vào 1 bảng khổng lồ).
   - 1 dòng "🎯 Exam Tip" ngắn: keyword → đáp án, và các bẫy hay gặp.
4. Cuối file thêm 2 section:
   - "⚠️ ĐIỂM MÙ HAY THI" — liệt kê 8–12 điểm quan trọng mà notes hiện tại CHƯA cover
     (feature mới, số liệu RPO/RTO/limit, bẫy phân biệt cặp service dễ nhầm).
   - "🧭 CHỈNH LẠI notes cũ" — nếu phát hiện chỗ sai/gây nhầm trong file gốc, chỉ rõ dòng
     và cách sửa (đừng tự ý sửa file gốc trừ khi tôi đồng ý).
5. Chốt bằng dòng "Xem thêm" link tới các file liên quan trong folder.

ĐỘ CHÍNH XÁC:
- Ưu tiên kiến thức đúng cho kỳ thi SAA-C03. Khi 1 con số có bản "cổ điển hay thi" và
  bản "mới cập nhật" khác nhau (vd giới hạn replica, Multi-AZ/Serverless mới ra), ghi CẢ HAI
  và chú thích rõ cái nào là bản mới.
- Không bịa feature. Nếu không chắc, đánh dấu ⚠️ và nói rõ cần verify.

QUY TRÌNH THỰC HIỆN:
a) Đọc kỹ file notes gốc của chủ đề trước khi viết (đừng viết từ trí nhớ).
b) Nếu có chỗ mơ hồ về phạm vi/đặc điểm → hỏi lại tôi trước khi tạo.
c) Đặt tên file mới theo mẫu: F-so-sanh-{chu-de}-theo-dac-diem.md
   (nếu F đã dùng thì tăng chữ cái: G-, H-...). Không trùng file cũ.
d) Thêm 1 dòng link tới file mới ở đầu file notes gốc của chủ đề.
e) Commit + push lên GitHub với message rõ ràng bằng tiếng Việt không dấu.
```

---

## 🗂️ Gợi ý điền sẵn cho các chủ đề còn lại

| Chủ đề | File gốc | SERVICES gợi ý | ĐẶC ĐIỂM gợi ý |
|--------|----------|----------------|-----------------|
| **Compute** | [01-compute-services.md](../01-compute-services.md) | EC2, Lambda, ECS, EKS, Fargate, Elastic Beanstalk, Batch | pricing model, scaling (auto scaling), state (stateless/stateful), cold start, networking, use case, cost, security |
| **Storage** | [02-storage-services.md](../02-storage-services.md) | S3, EBS, EFS, FSx, Glacier, Storage Gateway | durability, availability, performance (IOPS/throughput), scaling, backup/snapshot, lifecycle/tiering, encryption, cost, use case |
| **Networking** | [04-networking-services.md](../04-networking-services.md) | VPC, Route 53, CloudFront, ELB (ALB/NLB/GWLB), API Gateway, Direct Connect, VPN, Transit Gateway | layer (L4/L7), routing, HA/failover, scaling, latency, security (SG/NACL/WAF), hybrid, cost |
| **Security & Identity** | [05-security-services.md](../05-security-services.md) | IAM, KMS, Secrets Manager, Cognito, GuardDuty, WAF, Shield, Macie, Inspector | mục đích, phạm vi (region/global), encryption, rotation, detection vs prevention, integration, cost |
| **App Integration** | [07-application-integration.md](../07-application-integration.md) | SQS, SNS, EventBridge, Step Functions, Kinesis, MQ | mô hình (queue/pub-sub/stream), ordering, delivery guarantee, retention, fan-out, throughput, use case |

---

**Xem thêm**: [F-so-sanh-database-theo-dac-diem.md](../F-so-sanh-database-theo-dac-diem.md) (file mẫu) · [README.md](../README.md)
