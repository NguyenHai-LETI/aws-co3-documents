---
name: trainer-generate
description: Sinh câu hỏi trắc nghiệm phong cách AWS SAA-C03 từ tài liệu (notes trong repo hoặc file trong trainer/inbox/) và lưu thành pack mới trong trainer/bank/packs/docs/. Dùng khi người dùng muốn "tạo câu hỏi từ tài liệu", "sinh thêm câu hỏi về <chủ đề>".
---

Đây là **chế độ tương tác (file)** của `trainer/coach/GENERATE.md`: bạn tự ghi pack mới và tự chạy validator
(nút ✨ trong app dùng chế độ app — JSON, app tự ghi và kiểm tra pack).

1. Đọc toàn bộ `trainer/coach/GENERATE.md` và thực hiện đúng quy trình trong đó (phần “Chế độ tương tác”). Câu `medium`/`hard`
   viết theo **chuẩn câu tầng A — `trainer/bank/SCHEMA.md` §6b** (đề 55–130 từ có tiêu chí, phương án 8–35 từ song song, 25–30 % câu
   nhiều đáp án, nhãn lý do sai cho mọi phương án nhiễu, giải thích 50–120 từ + URL tài liệu AWS); đọc cả ví dụ trong §6b.
2. Thông tin lượt chạy: `run_id` = `<YYYY-MM-DD>_<HHmmss>_generate` theo giờ hiện tại.
3. Kiểm tra: `node trainer/scripts/validate.ts packs/docs/<tên-file> --fill-time --lint` — sửa mọi ❌, lỗi lint mức cao và lint chuẩn đề
   (`stem-short`, `options-bare`, `no-criterion`, `explanation-coverage`, `doc-url-missing`, `options-nonparallel` + cảnh báo cấp pack).
4. (tuỳ chọn) Cho model thứ hai giải mù pack vừa viết: `npm --prefix trainer run coach -- --verify --pack <pack-id>`
   (phương án được xáo; câu lệch / mơ hồ chuyển draft chờ duyệt ở *Ngân hàng → Chất lượng*), rồi phép thử chỉ nhìn phương án
   `npm --prefix trainer run coach -- --verify --scope cues --pack <pack-id>` — câu `cue` (đoán được đáp án mà không đọc đề) → viết lại
   phương án nhiễu (`/trainer-enrich ids: <id,…>`, todo `distractors`).
5. Nhắm mục đề cương: người dùng nêu mục (vd `3.5.s7`) hoặc “mục còn trống” → đọc `trainer/bank/exam-guide/SAA-C03.yaml`
   (hoặc snapshot §18), ghi `skills` cho mỗi câu (ít nhất một mục được yêu cầu). Nhắm **chỗ thiếu câu tầng A**: số liệu ở
   `node trainer/scripts/coverage.ts` (mục tầng câu) — xem `/trainer-coverage`. Tên / giới hạn theo `taxonomy.yaml → currency:`; không
   dùng service `scope: out` / `legacy` hay đã đóng với khách hàng mới làm đáp án.
6. Tham số từ người dùng (sources, count, topic, difficulty mix, focus, pack slug, skills — thiếu thì tự chọn hợp lý):
   $ARGUMENTS
