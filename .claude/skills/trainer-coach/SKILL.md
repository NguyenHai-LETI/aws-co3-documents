---
name: trainer-coach
description: Chạy AI Coach của hệ thống luyện thi AWS SAA-C03 (thư mục trainer/) — phân tích kết quả trong trainer/results, xử lý câu hỏi bị báo lỗi, sinh câu hỏi biến thể/mở rộng vào ngân hàng và viết kế hoạch luyện tập. Dùng khi người dùng muốn "phân tích kết quả", "lập kế hoạch ôn", "chạy coach".
---

1. Chạy `node trainer/scripts/snapshot.ts` để cập nhật `trainer/coach/snapshot.md` (bỏ qua nếu không chạy được lệnh).
2. Đọc toàn bộ `trainer/coach/COACH.md` và thực hiện đúng quy trình trong đó.
3. Thông tin lượt chạy: `run_id` = `<YYYY-MM-DD>_<HHmmss>_analyze` theo giờ hiện tại, `trigger` = `manual`.
   Ghi chú thêm của người dùng (nếu có): $ARGUMENTS
