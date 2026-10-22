---
name: trainer-enrich
description: Bảo trì ngân hàng câu hỏi AWS SAA-C03 (thư mục trainer/) theo lô — viết lại giải thích (vì sao đúng + từng phương án nhiễu theo nội dung + tóm tắt tiếng Việt), thêm gợi ý không lộ đáp án, phân loại domain/task 1.1–4.4/mục đề cương (skills)/services/tags, cân độ dài đáp án, viết lại phương án nhiễu quá dễ loại, cập nhật kiến thức lỗi thời; hoặc sinh câu dài chuẩn đề thi, câu song sinh (diễn đạt lại / tương phản) và họ câu đổi yêu cầu. Dùng khi người dùng muốn "enrich", "làm giàu giải thích", "thêm gợi ý", "phân loại câu hỏi", "bảo trì ngân hàng", "viết lại phương án nhiễu", "sinh câu dài", "câu song sinh", "chống học vẹt", "họ câu", "đổi qualifier".
---

Đây là **chế độ tương tác (file)** của `trainer/coach/ENRICH.md`: bạn tự ghi patch / pack và tự chạy lệnh kiểm tra
(nút trong app dùng chế độ app — JSON, app tự ghi file).

1. Chọn loại lượt chạy từ yêu cầu của người dùng: **bảo trì** (mặc định), **câu dài** (“câu dài”, “long-form”), **câu song sinh**
   (“song sinh”, “twins”, “chống học vẹt”, “câu tương phản”) hoặc **họ câu** (“họ câu”, “đổi qualifier / yêu cầu”).
2. `run_id` = `<YYYY-MM-DD>_<HHmmss>_enrich` (hoặc `_longform`, `_twins`, `_family`) theo giờ hiện tại.
3. Chuẩn bị lô câu hỏi (app chọn câu theo mức ưu tiên và ghi file batch):
   - bảo trì: `node trainer/scripts/enrich-batch.ts --run-id <run_id> --size <N, mặc định 20> [--tasks explain,hint,classify,balance,distractors]`
   - câu cụ thể: `node trainer/scripts/enrich-batch.ts --run-id <run_id> --ids <id1,id2,…> [--tasks distractors] [--note "<ghi chú>"]`
     (`--ids` khi người dùng đưa danh sách câu cụ thể, vd câu nghi phân loại sai từ `/trainer-coverage`)
     (`distractors` = viết lại phương án nhiễu quá dễ loại theo số liệu 📊 trong file batch)
   - câu dài (biến thể tầng A): `node trainer/scripts/enrich-batch.ts --longform --run-id <run_id> --count <N, mặc định 5>`
   - câu song sinh: `node trainer/scripts/enrich-batch.ts --twins --run-id <run_id> [--count 10] [--ids <id1,id2> --kind surface|contrast]`
   - họ câu: `node trainer/scripts/enrich-batch.ts --family --run-id <run_id> [--count 2] [--topic …] [--task 2.2] [--requirement cost]`
   Lệnh in đường dẫn file batch (`trainer/coach/enrich/<run_id>-batch.md`) và nơi ghi patch / pack mới.
   Xem tiến độ: `node trainer/scripts/enrich-batch.ts --status`.
4. Đọc toàn bộ `trainer/coach/ENRICH.md` và làm đúng phần A (bảo trì: patch + `node trainer/scripts/apply-patch.ts …` — apply-patch
   kiểm tra cả lint lỗi viết câu; dòng 🔗 trích dẫn tài liệu AWS và ⏳ kiến thức cũ trong file lô là bằng chứng) hoặc phần B (câu dài:
   pack mới + `node trainer/scripts/validate.ts … --fill-time --lint`). Câu song sinh / họ câu: đọc `trainer/coach/TWINS.md` /
   `trainer/coach/FAMILY.md` (phần “Chế độ tương tác”). Patch có `run_id` được lưu bản trước khi sửa → hoàn tác được ở AI Coach.
   [v6] Câu dài, họ câu, câu song sinh của câu giống đề thật và mọi giải thích viết lại cho câu tầng A theo **chuẩn câu tầng A —
   `trainer/bank/SCHEMA.md` §6b** (đề 55–130 từ có tiêu chí, phương án 8–35 từ song song, nhãn lý do sai cho mọi phương án nhiễu,
   giải thích 50–120 từ + URL tài liệu AWS; đáp án không bao giờ là service `scope: out` / `legacy` hay đã đóng với khách hàng mới).
   Sửa cả lint chuẩn đề (`stem-short`, `options-bare`, `no-criterion`, `explanation-coverage`, `doc-url-missing`, `options-nonparallel`)
   — trừ câu song sinh của câu ngắn: giữ dáng câu gốc, không độn chữ để qua lint (TWINS.md).
5. (tuỳ chọn) Cho model thứ hai giải mù các câu vừa sửa / vừa viết: `npm --prefix trainer run coach -- --verify --ids <id1,id2,…>`
   (cần Claude Code CLI; phương án được xáo; kết quả ghi vào `trainer/bank/verify.md`). Câu tầng A vừa viết / vừa đổi phương án: thêm
   phép thử chỉ nhìn phương án `npm --prefix trainer run coach -- --verify --scope cues --ids <id1,id2,…>` (dòng 🎯 `cue` = phương án lộ
   đáp án → lô mới `enrich-batch.ts --ids <các câu đó> --tasks distractors --note "cue: đoán được đáp án chỉ từ phương án"`).
6. Tham số thêm của người dùng (số câu, loại todo, task/chủ đề cần ưu tiên…): $ARGUMENTS
