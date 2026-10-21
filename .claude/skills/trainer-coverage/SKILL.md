---
name: trainer-coverage
description: Đo độ phủ ngân hàng câu hỏi AWS SAA-C03 (trainer/) so với exam guide — tỉ lệ domain so với trọng số đề, số câu theo task 1.1–4.4, service chưa có câu, câu nghi bị phân loại sai — rồi lập kế hoạch bổ sung và (khi được yêu cầu) sinh câu đúng chỗ thiếu. Dùng khi người dùng hỏi "ngân hàng đủ chưa", "thiếu câu phần nào", "độ phủ", "coverage", "domain nào ít câu".
argument-hint: "[trống = báo cáo + kế hoạch | sinh = sinh luôn câu cho chỗ thiếu]"
allowed-tools: Bash(node trainer/scripts/coverage.ts), Bash(node trainer/scripts/coverage.ts *), Bash(node trainer/scripts/enrich-batch.ts *), Edit(trainer/coach/coverage.md)
---

Working directory = gốc repo. Skill này đo và lập kế hoạch; chỉ ghi `trainer/coach/coverage.md` (và pack mới khi chạy bước 6).
Không sửa `practice-exams/`, notes hay pack có sẵn.

1. **Số liệu:** `node trainer/scripts/coverage.ts` — domain so với trọng số đề, task statement (⚠️ = dưới 50 % kỳ vọng), service trong taxonomy
   chưa có/có ít câu, câu có qualifier lệch domain. Dùng đúng các con số này, không tự đếm lại.
2. **Tách “phân loại sai” khỏi “thiếu thật”** trước khi kết luận:
   - Cột *Chưa ENRICH*: domain/task của câu chưa qua ENRICH được gán bằng từ khoá với mặc định theo chương (chương 01, 02, 04, 09–12, 14 mặc định
     *performance*) — D3 bị thổi phồng, D1/D4 bị thiếu. Nói rõ con số còn tạm thời khi phần lớn câu chưa ENRICH.
   - Mục 4 của báo cáo (qualifier ≠ domain): đọc từng câu để xác nhận mục tiêu chính của đề. Câu đúng là bị gán sai → cho ENRICH xử lý đúng các câu
     đó: `/trainer-enrich ids: <id,…>` (skill đó chạy `enrich-batch.ts --ids …`).
   - Thiếu thật = task/khái niệm vẫn ít câu sau khi trừ phần phân loại sai, hoặc service quan trọng cho task statement chưa có câu
     (vd task 1.1 mà IAM Identity Center, SCP, STS AssumeRole ít câu).
3. **Gap đã biết:** đối chiếu danh sách ở `practice-exams/00-DANH-GIA-COVERAGE.md` mục 4 (RDS Proxy, RAM, VPC Flow Logs, chiến lược DR, Route 53
   Resolver…): mỗi mục có bao nhiêu câu không `retired` trong `trainer/bank/packs/` (Grep theo service / từ khoá trong đề, `concept`, `services`).
   Chỉ đọc file đó, không sửa.
4. **Notes chưa có câu** (ước lượng nhanh cho các task ⚠️): liệt kê heading `##`/`###` trong file notes của topic liên quan
   (`trainer/bank/taxonomy.yaml → topics[].notes`), Grep từ khoá chính của từng heading trong ngân hàng; heading 0 câu = ứng viên sinh câu.
5. **Ghi `trainer/coach/coverage.md`** (ghi đè mỗi lượt):

   ```markdown
   # 📐 Độ phủ ngân hàng — <ngày>
   ## 1. Tóm tắt              (3–5 dòng có số: domain lệch nhất, task mỏng, service trống quan trọng)
   ## 2. Phân loại sai vs thiếu thật   (bảng: Mảng | Số câu hiện có | Ước lượng sau phân loại lại | Kết luận)
   ## 3. Kế hoạch bổ sung     (ưu tiên = trọng số domain × mức thiếu)
   | # | Task / khái niệm | Hiện có | Mục tiêu | Cách bổ sung | Nguồn notes |
   ## 4. Số liệu              (dán nguyên output của coverage.ts)
   ```

   *Cách bổ sung*: `/trainer-generate` (sources = notes, count, topic, focus) · `/trainer-enrich ids: …` (phân loại lại) ·
   `/trainer-enrich câu dài` (task có câu nhưng không có câu dài). Mục tiêu hợp lý: đưa task ⚠️ lên ≥ 50 % kỳ vọng trước; 10–20 câu mỗi lượt sinh;
   câu `medium`/`hard` dạng câu dài.
6. **Sinh câu** — chỉ khi `$ARGUMENTS` có “sinh” hoặc người dùng đồng ý sau khi xem kế hoạch: chạy tối đa 3 lượt skill `trainer-generate`, mỗi lượt
   một dòng của kế hoạch, truyền `sources` (notes), `count`, `topic`, và `focus` = task statement + khái niệm cụ thể
   (vd “4.3 — DynamoDB on-demand vs provisioned, Aurora Serverless v2, caching để giảm chi phí đọc”). Xong thì chạy lại
   `node trainer/scripts/coverage.ts` và cập nhật mục 4 của `coverage.md`.

Trả lời (3–6 dòng tiếng Việt): chỗ lệch chính (có số), bao nhiêu là phân loại sai và bao nhiêu là thiếu thật, 3 việc ưu tiên trong kế hoạch,
đường dẫn `coverage.md`; nếu đã sinh câu thì nêu pack mới và độ phủ sau khi sinh. Gợi ý `/trainer-review` cho các câu vừa sinh.
