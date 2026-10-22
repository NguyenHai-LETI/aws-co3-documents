---
name: trainer-coverage
description: Đo độ phủ ngân hàng câu hỏi AWS SAA-C03 (trainer/) so với exam guide — tỉ lệ domain so với trọng số đề, số câu theo task 1.1–4.4, service chưa có câu, câu nghi bị phân loại sai, số câu tầng A (giống đề thật) so với mục tiêu, câu dùng service legacy — rồi lập kế hoạch bổ sung và (khi được yêu cầu) sinh câu đúng chỗ thiếu. Dùng khi người dùng hỏi "ngân hàng đủ chưa", "thiếu câu phần nào", "độ phủ", "coverage", "domain nào ít câu", "đủ câu tầng A chưa".
argument-hint: "[trống = báo cáo + kế hoạch | sinh = sinh luôn câu cho chỗ thiếu]"
allowed-tools: Bash(node trainer/scripts/coverage.ts), Bash(node trainer/scripts/coverage.ts *), Bash(node trainer/scripts/enrich-batch.ts *), Bash(node trainer/scripts/coach-run.ts --generate *), Bash(node trainer/scripts/coach-run.ts --longform *), Edit(trainer/coach/coverage.md)
---

Working directory = gốc repo. Skill này đo và lập kế hoạch; chỉ ghi `trainer/coach/coverage.md` (và pack mới khi chạy bước 6).
Không sửa `practice-exams/`, notes hay pack có sẵn.

1. **Số liệu:** `node trainer/scripts/coverage.ts` — domain so với trọng số đề, task statement (⚠️ = dưới 50 % kỳ vọng), service trong taxonomy
   chưa có/có ít câu, câu có qualifier lệch domain, và **mục 5: đề cương chính thức** (189 mục Knowledge/Skills trong `trainer/bank/exam-guide/`,
   cùng số liệu với app → Ngân hàng → Chất lượng → 🗺️ Đề cương): câu / câu dài theo task, mục chưa có câu nào, tỉ lệ câu nhiều đáp án.
   [v6] Thêm hai mục: **tầng câu** — số câu tầng A / B / C (A giống đề thật + có tiêu chí, B tình huống ngắn, C câu ôn nhanh —
   `trainer/bank/SCHEMA.md` §6b) theo domain và task, so với mục tiêu **280 câu tầng A** (D1 84 · D2 73 · D3 67 · D4 56, chia cho task
   theo số mục đề cương của task); **legacy** — câu active có đáp án / phương án nhiễu là service `scope: legacy` (bị gỡ khỏi danh sách
   trong phạm vi hoặc đã ngừng không có kế nhiệm). Dùng đúng các con số này, không tự đếm lại. Báo cáo không bao giờ liệt kê câu đang
   niêm phong — đừng tìm hay nêu id của chúng.
2. **Tách “phân loại sai” khỏi “thiếu thật”** trước khi kết luận:
   - Cột *Chưa ENRICH*: domain/task của câu chưa qua ENRICH được gán bằng từ khoá với mặc định theo chương (chương 01, 02, 04, 09–12, 14 mặc định
     *performance*) — D3 bị thổi phồng, D1/D4 bị thiếu. Nói rõ con số còn tạm thời khi phần lớn câu chưa ENRICH.
   - Mục 4 của báo cáo (qualifier ≠ domain): đọc từng câu để xác nhận mục tiêu chính của đề. Câu đúng là bị gán sai → cho ENRICH xử lý đúng các câu
     đó: `/trainer-enrich ids: <id,…>` (skill đó chạy `enrich-batch.ts --ids …`).
   - Thiếu thật = task/khái niệm vẫn ít câu sau khi trừ phần phân loại sai, hoặc service quan trọng cho task statement chưa có câu
     (vd task 1.1 mà IAM Identity Center, SCP, STS AssumeRole ít câu).
   - [v6] **Thiếu tầng A** tách riêng khỏi thiếu câu: task có đủ câu nhưng phần lớn là tầng B/C vẫn là chỗ thiếu cho thi thử / đề niêm
     phong. Câu legacy đã bị loại khỏi luyện / thi thử / niêm phong — đừng coi chúng là đã phủ; cách xử lý ở bước 5.
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
   ## 3. Kế hoạch bổ sung     (ưu tiên = trọng số domain × mức thiếu, thiếu tầng A trước)
   | # | Task / khái niệm | Hiện có (tầng A) | Mục tiêu (tầng A) | Cách bổ sung | Nguồn notes |
   ## 4. Số liệu              (dán nguyên output của coverage.ts)
   ```

   *Cách bổ sung*: `/trainer-generate` (sources = notes, count, topic, focus) · `/trainer-enrich ids: …` (phân loại lại) ·
   `/trainer-enrich câu dài` (task có câu nhưng thiếu câu tầng A). Mục tiêu hợp lý: đưa task ⚠️ lên ≥ 50 % kỳ vọng trước; 10–20 câu mỗi lượt sinh;
   câu `medium`/`hard` theo chuẩn tầng A (SCHEMA §6b). Câu legacy: `/trainer-enrich ids: …` (`--tasks distractors` khi chỉ phương án nhiễu
   là legacy) hoặc retire khi đáp án là legacy.
6. **Sinh câu** — chỉ khi `$ARGUMENTS` có “sinh” hoặc người dùng đồng ý sau khi xem kế hoạch. Ưu tiên **task thiếu tầng A nhiều nhất**
   (theo mục tầng câu, nhân trọng số domain) và trong task đó các mục đề cương trống:
   `node trainer/scripts/coach-run.ts --generate --skills <id,…> --count 6` (câu mới phải gắn đúng mục đó; câu `medium`/`hard` viết theo
   chuẩn tầng A; qua lint chuẩn đề + giải mù như mọi câu AI), hoặc `--longform --skills <id,…>` để nâng câu ngắn sẵn có của task thành
   câu tầng A; tối đa 3 lượt. Hoặc chạy tối đa 3 lượt skill `trainer-generate`, mỗi lượt
   một dòng của kế hoạch, truyền `sources` (notes), `count`, `topic`, và `focus` = task statement + khái niệm cụ thể
   (vd “4.3 — DynamoDB on-demand vs provisioned, Aurora Serverless v2, caching để giảm chi phí đọc”). Xong thì chạy lại
   `node trainer/scripts/coverage.ts` và cập nhật mục 4 của `coverage.md`.

Trả lời (3–6 dòng tiếng Việt): chỗ lệch chính (có số), số câu tầng A so với mục tiêu 280 (domain / task thiếu nhất), số câu legacy,
bao nhiêu là phân loại sai và bao nhiêu là thiếu thật, 3 việc ưu tiên trong kế hoạch,
đường dẫn `coverage.md`; nếu đã sinh câu thì nêu pack mới và độ phủ sau khi sinh. Gợi ý `/trainer-review` cho các câu vừa sinh.
