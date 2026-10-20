---
name: trainer-coach
description: Chạy AI Coach của hệ thống luyện thi AWS SAA-C03 (thư mục trainer/) — phân tích kết quả trong trainer/results, xử lý câu hỏi bị báo lỗi, sinh câu hỏi biến thể/mở rộng vào ngân hàng và viết kế hoạch luyện tập. Dùng khi người dùng muốn "phân tích kết quả", "lập kế hoạch ôn", "chạy coach".
---

1. Chạy `node trainer/scripts/snapshot.ts` để cập nhật `trainer/coach/snapshot.md` (bỏ qua nếu không chạy được lệnh).
2. Đọc toàn bộ `trainer/coach/COACH.md` và thực hiện đúng quy trình trong đó — nhận định điểm yếu theo lá chắn thống kê của snapshot
   (chỉ “⬇️ yếu hơn mức chung” là kết luận chắc), xét §17 (giai đoạn ôn, chuyển giao, câu dai dẳng) và §18 (đề cương) trước khi lập kế hoạch.
3. Thông tin lượt chạy: `run_id` = `<YYYY-MM-DD>_<HHmmss>_analyze` theo giờ hiện tại, `trigger` = `manual`.
   Ghi chú thêm của người dùng (nếu có): $ARGUMENTS
