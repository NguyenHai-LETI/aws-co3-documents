# 🪞 Câu song sinh — chống học vẹt

> Prompt chuẩn cho tác vụ **twins**: AI Coach → 🪞 Song sinh & họ câu, `npm run coach -- --twins`, lịch rảnh khi `coach.idle_tasks`
> có `twins`, nút “✨ câu tương phản” ở Thống kê → Câu dai dẳng, hoặc `/trainer-enrich` (“câu song sinh”). Working directory = **gốc repo**.

Người học sắp ôn lại các câu trong file lô. Họ đã gặp mỗi câu ≥ 2 lần nên có thể đang **nhớ mặt chữ** (đề, vị trí đáp án) thay vì
hiểu khái niệm. Bạn viết cho **mỗi câu gốc đúng một câu song sinh**; khi ôn, app hỏi bằng câu song sinh thay cho câu cũ và đo xem
người học có làm đúng ngay lần đầu không (chỉ số chuyển giao).

## Hai loại (file lô ghi loại cho từng câu gốc — làm đúng loại đó)

- **surface — diễn đạt lại:** giữ **khái niệm, ràng buộc quyết định và qualifier** (MOST cost-effective…), giữ đáp án đúng *về nội
  dung*; đổi mọi thứ bề mặt: công ty / ngành, quy mô, số liệu, câu chữ, thứ tự ý, cách viết các lựa chọn, vị trí đáp án đúng.
  App từ chối câu có đề trùng ≥ 60 % từ với câu gốc.
- **contrast — tương phản:** giữ tình huống nhưng đổi **MỘT** yêu cầu / ràng buộc để **một phương án nhiễu của câu gốc trở thành
  đúng** (vd “failover tự động” → “mở rộng đọc”, “ít vận hành nhất” → “rẻ nhất”, “trong một Region” → “khác Region”). Đáp án đúng
  phải khác câu gốc (app kiểm tra), đề phải nêu rõ yêu cầu đã đổi để chỉ còn một đáp án tốt nhất. Dùng cho câu người học hay nhầm
  cùng một phương án — dòng “người học” trong file lô cho biết phương án đó; dựng tình huống mà chính hiểu lầm ấy dẫn tới đáp án sai.

## Quy tắc chung

- Đọc toàn bộ file lô `trainer/coach/enrich/<run_id>-batch.md` (đề, lựa chọn, đáp án, giải thích, người học, câu anh em đã có).
  **Không chép** câu anh em / biến thể đã có. Grep notes khi chưa chắc một chi tiết.
- Câu mới: **cùng số lựa chọn và cùng số đáp án như câu gốc** (câu gốc “Choose TWO” → câu song sinh cũng “(Choose TWO)”), các lựa chọn dài tương đương nhau, đáp án đúng không dài nhất; distractor là dịch vụ / tính năng có thật, sai vì
  một chi tiết cụ thể; giải thích theo SCHEMA §3 (vì sao đúng + từng distractor theo **nội dung**, không chữ cái + dòng `> 🇻🇳 …`);
  `hint` 1 dòng tiếng Việt không lộ đáp án; `task` cùng domain; `skills` như câu gốc nếu đúng; độ dài đề tương tự câu gốc (câu dài
  → câu dài).
- Kiến thức hiện hành (`taxonomy.yaml → currency:`); không đưa con số không chắc chắn. Không dùng dịch vụ ngoài phạm vi đề thi.
- Mỗi câu mới được **model thứ hai giải mù**; câu lệch / mơ hồ chuyển `draft` chờ duyệt — đề phải đủ dữ kiện cho một đáp án.

## Chế độ app (JSON)

Prompt ghi “CHẾ ĐỘ APP (JSON)”: chỉ đọc (Read / Grep / Glob), không ghi file. Trả `pack` (`slug` 2–4 từ kebab-case, `title`),
`questions` — mỗi câu gốc một câu với `domain, task, topic, services, tags, difficulty, concept, refs, skills, hint, stem, options`
(mảng nội dung theo thứ tự A, B, C… không tiền tố), `answer` (mảng chữ cái), `explanation`, `variant_of: [<id gốc>]`, `kind`
(`surface` | `contrast`, đúng loại của câu gốc) — và `summary` (2–4 dòng tiếng Việt). App gán id, tính `time`, ghi pack
`trainer/bank/packs/ai/<ngày>-<giờ>-twins-<slug>.md`, kiểm tra và gửi lại câu lỗi **một lần** (trả lại chỉ các câu đó, đúng `id`).

## Chế độ tương tác (file)

1. `node trainer/scripts/enrich-batch.ts --twins --run-id <run_id> [--count 10] [--ids a,b --kind surface|contrast]` — in đường dẫn
   file lô, pack mới, pack id và tiền tố id câu.
2. Viết pack mới đúng đường dẫn (thay `<slug>`): front matter `pack`, `title: "AI · Câu song sinh · <chủ đề>"`, `exam: SAA-C03`,
   `origin: ai`, `created`, `generated_by: <run_id>`, `source: <file lô>`; block `## Q <id>` (SCHEMA §3) với `- variant_of: <id gốc>`,
   bỏ trống `time`.
3. `node trainer/scripts/validate.ts packs/ai/<tên-file> --fill-time --lint` — sửa mọi ❌ và lỗi lint mức cao.

## Trả lời cuối

2–4 dòng tiếng Việt: số câu theo loại (surface / contrast), câu gốc khó viết và vì sao, kết quả kiểm tra.
