---
name: trainer-import
description: Đồng bộ đề luyện trong practice-exams/ vào ngân hàng câu hỏi của app trainer — thêm câu mới (vd Part C vừa viết thêm) mà không ghi đè phần ENRICH/coach đã sửa, đối chiếu câu cũ bị sửa ở nguồn, chỉ ra file không phải trắc nghiệm. Dùng khi người dùng "nhập đề mới", "import practice exam", "vừa thêm câu vào đề", "đồng bộ đề vào app".
argument-hint: "[chương hoặc tên file, vd 03-database — trống = tất cả]"
allowed-tools: Bash(node trainer/scripts/import-practice-exams.ts --merge), Bash(node trainer/scripts/import-practice-exams.ts --merge *), Bash(node trainer/scripts/validate.ts *), Bash(node trainer/scripts/apply-patch.ts *), Bash(git log *), Bash(git diff *)
---

Nguồn: `practice-exams/NN-<slug>-exam[-v2].md` + `NN-<slug>-answers[-v2].txt` → pack `trainer/bank/packs/imported/NN-<slug>-v1|v2.md`.
Id câu = `NN-v1|v2-<số thứ tự trong đề>` (Q31 của đề V2 chương 03 → `03-v2-31`), và kết quả bài làm tham chiếu id. Vì vậy:
**không bao giờ đổi id, không dùng `--force`** (ghi đè cả pack → mất giải thích/hint/task của ENRICH và các sửa lỗi của coach).
Phạm vi người dùng chỉ định: `$ARGUMENTS` → thêm `--only <chuỗi trong tên file>` vào mọi lệnh import bên dưới; trống = tất cả.

1. **Xem trước:** `node trainer/scripts/import-practice-exams.ts --merge --dry-run [--only …]`. Các dòng báo cáo:
   - `+ <pack>: thêm N câu — <id…>`: câu mới sẽ được nối vào cuối pack.
   - `~ <id> [base <hash>] (đã ENRICH): nguồn khác ngân hàng ở <đề | lựa chọn | đáp án | giải thích>`: câu đã có nhưng khác nguồn (bước 4).
   - `✗ <file>: câu trong nguồn đã bị đánh số lại`: file bị từ chối (bước 2).
   - `ℹ️ Không phải đề trắc nghiệm …` (bước 5) · `<file> Qn: no answer in …` (câu thiếu dòng đáp án `n_X - …` → nhắc người dùng bổ sung).
2. **`✗ đánh số lại`** → không tự sửa gì trong ngân hàng. Chỉ cho người dùng câu nào bị chèn giữa đề (so số thứ tự với id trong báo cáo),
   đề nghị chuyển câu mới xuống **cuối** đề (kèm dòng đáp án, đánh số tiếp) để giữ số thứ tự cũ, rồi chạy lại từ bước 1.
3. **Gộp:** `node trainer/scripts/import-practice-exams.ts --merge [--only …]`, rồi với mỗi pack vừa thêm câu:
   `node trainer/scripts/validate.ts packs/imported/<tên-file> --fill-time`. Sửa lỗi ❌ nếu có — chỉ ở các câu mới.
   Câu mới được ghi `created: <hôm nay>`, đáp án đúng đã được xếp vị trí theo bố cục chuẩn (không cần chạy `rebalance`).
4. **Dòng `~` (câu cũ khác nguồn)** — xác định chiều thay đổi trước khi làm gì:
   - Có `(đã ENRICH)` và chỉ khác `lựa chọn`: gần như chắc là ENRICH `balance` đã viết lại distractor (Grep id trong
     `trainer/coach/patches/*.yaml`) → **bỏ qua**, ngân hàng đang tốt hơn nguồn.
   - Ngân hàng đã được sửa có chủ đích (issue `[x]` cho id đó trong `trainer/bank/issues.md`, hoặc patch có `answer:`/`stem:`/`status:`)
     → bỏ qua; nếu nguồn đang sai thì đề nghị người dùng sửa nguồn cho khớp.
   - Nguồn mới được sửa (`git log -p -- practice-exams/<file>`; thay đổi chưa commit: `git diff -- practice-exams/<file>`) → đưa vào ngân hàng
     **qua patch** để giữ phần ENRICH: ghi `trainer/coach/patches/<YYYY-MM-DD>_<HHmmss>_import.yaml` theo `trainer/bank/SCHEMA.md §8`
     (`base` = hash trong dòng `~`; `stem: |` khi đổi đề; `options:` chỉ thay nội dung và **giữ khoá** — thứ tự lựa chọn trong ngân hàng khác
     nguồn, nên tra khoá theo nội dung trong pack hiện tại; `answer:` + `reason:` khi đổi đáp án, kèm `explanation:` viết lại cho khớp, gọi lựa
     chọn bằng nội dung, không bằng chữ cái). Chạy `node trainer/scripts/apply-patch.ts <patch> --dry-run`, đọc báo cáo, rồi chạy lại không có
     `--dry-run`. Nguồn thêm/bớt lựa chọn → patch không làm được: báo người dùng, đề nghị viết thành câu mới ở cuối đề và retire câu cũ
     (`status: retired` qua patch).
5. **`ℹ️ Không phải đề trắc nghiệm`** (kịch bản, console lab…) → không nhập. Người dùng muốn biến nội dung đó thành câu trắc nghiệm →
   `/trainer-generate` với `sources: practice-exams/<file>`.
6. App tự nạp lại ngân hàng khi file đổi — không cần khởi động lại server.

Trả lời (3–6 dòng): số câu đã thêm theo pack (kèm id), dòng `~` đã đưa vào / bỏ qua và lý do, file bị từ chối, kết quả validate.
Gợi ý tiếp: `/trainer-review <id mới,…>` (câu viết tay hoặc do AI viết trong practice-exams chưa ai soát đáp án) và `/trainer-enrich`
(giải thích của câu nhập chỉ có 1 dòng, chưa có gợi ý).
