---
name: trainer-generate
description: Sinh câu hỏi trắc nghiệm phong cách AWS SAA-C03 từ tài liệu (notes trong repo hoặc file trong trainer/inbox/) và lưu thành pack mới trong trainer/bank/packs/docs/. Dùng khi người dùng muốn "tạo câu hỏi từ tài liệu", "sinh thêm câu hỏi về <chủ đề>".
---

Đây là **chế độ tương tác (file)** của `trainer/coach/GENERATE.md`: bạn tự ghi pack mới và tự chạy validator
(nút ✨ trong app dùng chế độ app — JSON, app tự ghi và kiểm tra pack).

1. Đọc toàn bộ `trainer/coach/GENERATE.md` và thực hiện đúng quy trình trong đó (phần “Chế độ tương tác”).
2. Thông tin lượt chạy: `run_id` = `<YYYY-MM-DD>_<HHmmss>_generate` theo giờ hiện tại.
3. Kiểm tra: `node trainer/scripts/validate.ts packs/docs/<tên-file> --fill-time --lint` — sửa mọi ❌ và lỗi lint mức cao.
4. (tuỳ chọn) Cho model thứ hai giải mù pack vừa viết: `npm --prefix trainer run coach -- --verify --pack <pack-id>`
   (câu lệch / mơ hồ chuyển draft chờ duyệt ở *Ngân hàng → Chất lượng*).
5. Nhắm mục đề cương: người dùng nêu mục (vd `3.5.s7`) hoặc “mục còn trống” → đọc `trainer/bank/exam-guide/SAA-C03.yaml`
   (hoặc snapshot §18), ghi `skills` cho mỗi câu (ít nhất một mục được yêu cầu). Tên / giới hạn theo `taxonomy.yaml → currency:`.
6. Tham số từ người dùng (sources, count, topic, difficulty mix, focus, pack slug, skills — thiếu thì tự chọn hợp lý):
   $ARGUMENTS
