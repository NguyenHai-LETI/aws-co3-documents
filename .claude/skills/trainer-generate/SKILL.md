---
name: trainer-generate
description: Sinh câu hỏi trắc nghiệm phong cách AWS SAA-C03 từ tài liệu (notes trong repo hoặc file trong trainer/inbox/) và lưu thành pack mới trong trainer/bank/packs/docs/. Dùng khi người dùng muốn "tạo câu hỏi từ tài liệu", "sinh thêm câu hỏi về <chủ đề>".
---

1. Đọc toàn bộ `trainer/coach/GENERATE.md` và thực hiện đúng quy trình trong đó.
2. Thông tin lượt chạy: `run_id` = `<YYYY-MM-DD>_<HHmmss>_generate` theo giờ hiện tại.
3. Tham số từ người dùng (sources, count, topic, difficulty mix, focus, pack slug — thiếu thì tự chọn hợp lý):
   $ARGUMENTS
