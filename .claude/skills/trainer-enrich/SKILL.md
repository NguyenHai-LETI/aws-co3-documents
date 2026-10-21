---
name: trainer-enrich
description: Bảo trì ngân hàng câu hỏi AWS SAA-C03 (thư mục trainer/) theo lô — viết lại giải thích (vì sao đúng + từng phương án nhiễu theo nội dung + tóm tắt tiếng Việt), thêm gợi ý không lộ đáp án, phân loại domain/task 1.1–4.4/services/tags, cân độ dài đáp án; hoặc sinh câu dài chuẩn đề thi từ câu ngắn hay sai. Dùng khi người dùng muốn "enrich", "làm giàu giải thích", "thêm gợi ý", "phân loại câu hỏi", "bảo trì ngân hàng", "sinh câu dài".
---

1. Chọn loại lượt chạy từ yêu cầu của người dùng: **bảo trì** (mặc định) hoặc **câu dài** (khi người dùng nói “câu dài”, “long-form”).
2. `run_id` = `<YYYY-MM-DD>_<HHmmss>_enrich` (hoặc `_longform`) theo giờ hiện tại.
3. Chuẩn bị lô câu hỏi (app chọn câu theo mức ưu tiên và ghi file batch):
   - bảo trì: `node trainer/scripts/enrich-batch.ts --run-id <run_id> --size <N, mặc định 20> [--tasks explain,hint,classify,balance] [--ids <id,…>]`
     (`--ids` khi người dùng đưa danh sách câu cụ thể, vd câu nghi phân loại sai từ `/trainer-coverage`)
   - câu dài: `node trainer/scripts/enrich-batch.ts --longform --run-id <run_id> --count <N, mặc định 5>`
   Lệnh in đường dẫn file batch (`trainer/coach/enrich/<run_id>-batch.md`) và nơi ghi patch / pack mới.
   Xem tiến độ: `node trainer/scripts/enrich-batch.ts --status`.
4. Đọc toàn bộ `trainer/coach/ENRICH.md` và làm đúng phần A (bảo trì: patch + `node trainer/scripts/apply-patch.ts …`)
   hoặc phần B (câu dài: pack mới + `node trainer/scripts/validate.ts … --fill-time`).
5. Tham số thêm của người dùng (số câu, loại todo, task/chủ đề cần ưu tiên…): $ARGUMENTS
