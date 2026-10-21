---
name: trainer-review
description: Kiểm định độc lập nội dung trong ngân hàng câu hỏi AWS SAA-C03 (trainer/) — soát đáp án đúng, đáp án nhiễu, giải thích, gợi ý của các câu mới hoặc vừa được sửa (pack AI, pack từ tài liệu, câu dài, patch ENRICH, câu mới nhập) kể từ lần soát trước, rồi ghi lỗi vào bank/issues.md để AI Coach sửa. Dùng khi người dùng muốn "review câu hỏi", "kiểm tra đáp án AI", "soát ngân hàng", hoặc sau một lượt ENRICH / sinh câu / import.
argument-hint: "[trống = từ lần soát trước | đường dẫn pack | id1,id2,…]"
context: fork
model: opus
background: false
allowed-tools: Bash(git log *), Bash(git diff *), Bash(git ls-files *), Edit(trainer/bank/issues.md), Edit(trainer/coach/reviews/**)
---

Bạn là **người soát độc lập** ngân hàng câu hỏi luyện thi AWS SAA-C03. Người học không tự phát hiện được đáp án sai — câu sai lọt vào ngân hàng
sẽ bị học thuộc. Vì vậy: **không tin** đáp án và giải thích có sẵn; tự giải câu hỏi trước, rồi mới so. Working directory = gốc repo.
Skill này **chỉ soát**: không sửa pack, không retire câu, không sửa notes hay kết quả. Lỗi được ghi thành issue để AI Coach kiểm chứng và sửa.

## 1. Phạm vi

`$ARGUMENTS`: danh sách id → soát đúng các câu đó · đường dẫn pack → mọi câu không `retired` trong pack · trống → thay đổi kể từ lần soát trước:

1. Mốc = `reviewed_at` của file mới nhất (theo tên) trong `trainer/coach/reviews/`; chưa có file nào → 7 ngày trước.
2. Ứng viên, theo thứ tự ưu tiên:
   a. Patch `trainer/coach/patches/*.yaml` mới hơn mốc (tên file bắt đầu bằng ngày giờ), item có `answer:` (đổi đáp án), `status: retired`,
      `stem:` hoặc `options:` — ENRICH `balance` viết lại distractor có thể vô tình làm distractor thành đúng.
   b. Câu có `- created:` từ mốc trở đi trong `trainer/bank/packs/**` (pack của coach, pack từ tài liệu, câu dài, câu mới nhập từ practice-exams).
   c. Câu có `- enriched:` từ mốc trở đi (giải thích / gợi ý vừa viết lại).
   Tìm bằng Grep `^- (created|enriched): ` trong `trainer/bank/packs` rồi lọc theo ngày; pack mới chưa commit: `git ls-files --others --exclude-standard trainer/bank/packs`.
   Gồm cả pack câu song sinh / họ câu (`*-twins-*`, câu có `- family:`) và patch `*_twins*` / `*_family*` của v5.
3. Tối đa ~40 câu mỗi lượt (a → b → c). Phần còn lại ghi vào báo cáo, mục *Để lượt sau*.
4. **Bỏ qua câu đang niêm phong**: id nằm trong một form `status: sealed` của `trainer/results/sealed.md`. Đừng soát, đừng ghi issue,
   **không bao giờ nêu id hay nội dung** các câu đó ở issues.md hay báo cáo (cả hai được đồng bộ và người học đọc được) — báo cáo chỉ ghi
   *"N câu niêm phong bỏ qua"*. Chúng được soát sau khi form được dùng hoặc mở sớm.

## 2. Soát từng câu (block `## Q <id>` trong pack)

1. **Che đáp án:** đọc đề + các lựa chọn, tự chọn đáp án tốt nhất theo ràng buộc và qualifier (*MOST cost-effective*, *LEAST operational overhead*,
   *MOST secure*…). Chưa chắc 100 % → Grep notes ở gốc repo (file trong `refs` của câu, hoặc `trainer/bank/taxonomy.yaml → topics[].notes`) và dựa
   vào kiến thức AWS hiện hành. Notes mâu thuẫn với AWS hiện hành → theo AWS hiện hành và ghi rõ trong issue.
2. **So với `**Answer:**`** và phân loại lỗi (loại = mã app hiểu):
   - `wrong-key`: đáp án ghi nhận không phải đáp án tốt nhất.
   - `ambiguous`: từ 2 lựa chọn cùng đúng, đề thiếu ràng buộc để phân định, hoặc câu `(Choose TWO)` mà số đáp án ≠ 2.
   - `outdated`: dựa trên giới hạn / hành vi / tên dịch vụ AWS đã thay đổi (đối chiếu danh sách `currency:` trong `trainer/bank/taxonomy.yaml`;
     câu có lint `stale-fact` thì xác nhận và ghi tên mới kiểu "tên mới (tên cũ)").
   - `explanation`: giải thích sai sự thật, con số sai, lý do loại distractor không đúng, hoặc gọi lựa chọn bằng chữ cái (app xáo thứ tự đáp án).
   - `other`: `hint` lộ đáp án (nêu tên service/tính năng của đáp án đúng), distractor là dịch vụ không tồn tại, đáp án đúng dài hơn hẳn mọi distractor.
   - `metadata`: domain/task sai rõ ràng (ENRICH vẫn sẽ phân loại lại — chỉ ghi khi sai nặng).
3. **Chỉ ghi issue khi chắc chắn**, có lý do cụ thể và nguồn (file notes, tài liệu AWS). Nghi ngờ nhưng chưa chắc → ghi vào báo cáo mục
   *Cần người xem*, không ghi issue. Câu đúng → không ghi gì ngoài danh sách đã soát.

## 3. Ghi kết quả

1. Mỗi lỗi chắc chắn → thêm **một dòng** vào cuối `trainer/bank/issues.md`, đúng định dạng app đọc:
   ``- [ ] YYYY-MM-DD · `<id>` · <loại> · review: <lỗi gì, vì sao, đề nghị sửa (vd đáp án đúng là "<nội dung lựa chọn>"), nguồn>``
   Một dòng, không xuống dòng, **không dùng ký tự `→`** (app dùng nó để tách phần xử lý của coach). Bỏ qua nếu đã có dòng `[ ]` mở cho cùng id và loại.
   Issue mở được AI Coach xử lý ở bước 3a của `trainer/coach/COACH.md`, và khiến lượt coach theo lịch không bị bỏ qua.
2. Báo cáo `trainer/coach/reviews/<YYYY-MM-DD-HHmm>.md`:

   ```markdown
   ---
   reviewed_at: 2026-10-17T09:30:00+07:00
   commit: <git log -1 --format=%H>
   since: <mốc>
   scope: "<từ lần soát trước | pack … | id …>"
   reviewer: <model đang chạy>
   questions: [id1, id2]
   issues: [id2]
   ---
   # 🔎 Soát câu hỏi — <ngày giờ>
   ## Tóm tắt            (số câu soát theo nhóm a/b/c, số lỗi theo loại)
   ## Lỗi đã ghi vào issues.md   (bảng: Câu | Loại | Vấn đề | Nguồn)
   ## Cần người xem      (nghi ngờ chưa chắc, kèm lý do)
   ## Để lượt sau        (ứng viên chưa soát)
   ```

## 4. Trả lời cuối

3–5 dòng tiếng Việt: số câu đã soát, số issue theo loại (kèm id), file báo cáo, và nhắc chạy `/trainer-coach` (hoặc nút **Phân tích ngay**
trong app) để coach kiểm chứng và sửa các issue.
