---
name: trainer-quiz
description: Hỏi bài luyện thi AWS SAA-C03 ngay trong cuộc trò chuyện, dùng ngân hàng câu hỏi và lịch ôn FSRS của trainer (thư mục trainer/) qua MCP server `saa-trainer` — từng câu một, chấm điểm, giải thích ngắn, lưu kết quả vào trainer/results. Dùng khi người dùng muốn "hỏi bài", "quiz", "kiểm tra mình 10 câu", "ôn câu đến hạn", "luyện phần yếu", "hỏi về <chủ đề>".
---

Đây là **chế độ hỏi bài qua chat** của trainer: câu hỏi, đáp án và lịch ôn nằm trong app, bạn chỉ dẫn dắt.
Cần app đang chạy (`cd trainer && npm start`, hoặc `npm run service -- install` để chạy nền) và MCP server `saa-trainer`
(file `.mcp.json` ở gốc repo; lần đầu Claude Code hỏi cho phép — chọn đồng ý).

1. Chọn chế độ từ yêu cầu (mặc định `srs` nếu còn câu đến hạn, nếu không thì `weak`):
   - `srs` câu đến hạn ôn · `weak` phần yếu · `topic` một chủ đề (truyền `topic`) · `quick` 10 câu trộn · `today` phiên hôm nay (`minutes`).
   - Không rõ nên ôn gì → gọi `weak_areas` trước rồi đề xuất.
2. `start_quiz {mode, n}` (mặc định n = 10; người dùng nói số câu thì dùng số đó). Giữ `quiz` trả về.
3. Lặp từng câu:
   - `next_question` → trình bày **nguyên văn** đề và mọi phương án kèm chữ cái (A, B, C…), ghi rõ "chọn 2" nếu có.
   - **Dừng, chờ người học trả lời.** Không gợi ý, không loại trừ phương án, không đoán hộ, không nói đáp án trước.
   - `answer {pick, unsure?}` với đúng chữ cái người học chọn (`unsure: true` nếu họ nói "chắc là…", "không chắc").
   - Đọc kết quả + giải thích ngắn; trả lời câu hỏi thêm của người học (có thể `search_notes` để trích tài liệu).
   - Người học thấy câu sai đáp án / mơ hồ → `report_issue {type, note}`.
4. Hết câu hoặc người học muốn dừng → `finish` (câu chưa làm quay lại hàng chờ) → báo điểm và đường dẫn kết quả.
5. Mỗi câu tốn vài lượt model; muốn tiết kiệm hạn mức thì học trên app (🌐 http://localhost:3003 hoặc điện thoại qua LAN).
6. Tham số thêm của người dùng (chế độ, số câu, chủ đề, phút): $ARGUMENTS
