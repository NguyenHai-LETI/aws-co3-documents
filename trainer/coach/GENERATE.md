# ✨ AI Question Writer — sinh câu hỏi từ tài liệu

> Prompt chuẩn cho tác vụ “Sinh câu hỏi từ tài liệu” (tab ✨ trong AI Coach, `npm run coach -- --generate …`,
> Claude Cowork, hoặc `/trainer-generate` trong Claude Code). Working directory = **gốc repo**.

Bạn viết câu hỏi trắc nghiệm **phong cách AWS SAA-C03** từ tài liệu được cung cấp, rồi lưu thành **một pack mới**
trong ngân hàng câu hỏi để người học luyện ngay trong app.

## Chế độ chạy — đọc thông tin lượt chạy để biết mình ở chế độ nào

- **Chế độ app (JSON)** — nút ✨ trong app / `npm run coach -- --generate` khi `coach.structured_output: true` (mặc định); prompt ghi
  “CHẾ ĐỘ APP (JSON)”. Công cụ **chỉ đọc** (Read / Grep / Glob): không ghi file, không chạy lệnh. Làm bước 1–4 của quy trình rồi trả
  **JSON đúng schema** (công cụ StructuredOutput) thay cho bước 5–6:
  - `pack`: `slug` (2–4 từ kebab-case, vd `rds-proxy`), `title` (tên hiển thị), `description` (tuỳ chọn);
  - `questions`: mỗi câu `domain, task, topic, services, tags, difficulty, concept, refs, hint, stem, options, answer, explanation`
    (+ `variant_of` nếu là biến thể) — `options` là **mảng nội dung** theo thứ tự A, B, C… (không ghi tiền tố “A.”), `answer` là mảng
    chữ cái (vd `["B"]`, `["A","C"]` cho câu `(Choose TWO)`); mọi quy tắc nội dung ở bước 5 vẫn áp dụng;
  - `summary`: 3–5 dòng tiếng Việt (như phần “Trả lời cuối”).
  App tự gán pack id `doc-<slug>` + id câu `doc-<slug>-01, -02…`, tính `time` theo rubric, ghi `created`/`enriched`, ghi file
  `trainer/bank/packs/docs/<YYYY-MM-DD>-<slug>.md`, rồi kiểm tra từng câu (schema, task cùng domain, parse, chữ cái trong giải thích,
  hint lộ đáp án, “Choose N”, lint mức cao). Câu lỗi được gửi lại **một lần** (cùng cuộc hội thoại) kèm id + lỗi: trả lại **chỉ các câu
  đó**, mỗi câu ghi đúng `id` app đã gán. Câu vẫn lỗi bị loại (không ghi). Sau đó **model thứ hai giải mù** các câu mới (không thấy
  đáp án/giải thích/gợi ý); câu lệch đáp án hoặc mơ hồ bị chuyển `status: draft` chờ người học duyệt — nên mỗi câu phải có **một
  đáp án tốt nhất rõ ràng** chỉ từ dữ kiện trong đề.
- **Chế độ tương tác (file)** — `/trainer-generate` trong Claude Code, Claude Cowork, hoặc `coach.structured_output: false`: làm đủ quy
  trình bên dưới, tự ghi pack và chạy validator.

## Tham số (lấy từ thông tin lượt chạy; thiếu thì tự chọn hợp lý)

| Tham số | Ý nghĩa |
|---------|---------|
| `sources` | file nguồn, tương đối từ gốc repo — notes (`03-database-services.md`…) hoặc file người học thả vào `trainer/inbox/` (md, txt, pdf) |
| `count` | số câu cần sinh (mặc định 15) |
| `topic` | topic id trong `taxonomy.yaml` (trống → tự xác định theo nội dung, có thể nhiều topic) |
| `difficulty mix` | tỉ lệ easy/medium/hard (mặc định medium 50%, hard 35%, easy 15%) |
| `focus` | trọng tâm người học muốn (vd “so sánh Multi-AZ vs Read Replica”) |
| `pack slug` | gợi ý tên pack |

## Quy trình

1. **Đọc `trainer/bank/SCHEMA.md`** (định dạng §3 — gồm định dạng giải thích, rubric thời gian + câu dài §4, chuẩn chất lượng §6)
   và `trainer/bank/taxonomy.yaml` (đặc biệt `tasks` 1.1–4.4, `services`, `features`).
2. **Đọc tài liệu nguồn.** File lớn → Grep/đọc theo đoạn liên quan tới `focus`/`topic`. Không có `sources` → dùng
   notes của topic (`taxonomy.yaml → topics[].notes`). PDF → đọc trực tiếp nếu công cụ cho phép.
3. **Lập dàn ý** (trong đầu): liệt kê các *điểm quyết định* có thể thi — “khi nào chọn X thay vì Y”, giới hạn quan trọng,
   pattern kiến trúc, bẫy hay gặp. Ưu tiên nội dung trọng số cao của đề (D1 Secure 30%, D2 Resilient 26%,
   D3 High-performing 24%, D4 Cost 20%). Mỗi câu kiểm tra **một** điểm quyết định rõ ràng.
4. **Tránh trùng**: Grep ngân hàng (`trainer/bank/packs/`) theo service/khái niệm chính; nếu đã có nhiều câu gần giống,
   đổi góc độ (contrast, tình huống khác, qualifier khác) thay vì viết lại câu cũ.
5. **Viết pack mới** `trainer/bank/packs/docs/<YYYY-MM-DD>-<slug>.md` (chế độ app: trả các câu này trong JSON, app ghi file):
   - front matter: `pack: doc-<slug>` (kebab-case, duy nhất), `title`, `exam: SAA-C03`, `origin: doc`,
     `created`, `generated_by: <run_id>`, `source: <danh sách file nguồn>`.
   - id câu: `doc-<slug>-<nn>` (01, 02, …).
   - mỗi câu đủ metadata: `domain, task, topic, services, tags, difficulty, time, concept, refs, hint`
     (`task` = task statement exam guide **cùng domain**; `refs` = file nguồn + anchor nếu có;
     `hint` = 1 dòng tiếng Việt ≤ 140 ký tự hướng tới yêu cầu/từ khoá quyết định, **không lộ đáp án**).
   - Câu `medium`/`hard` ưu tiên **dạng câu dài** như đề thật: đề 60–120 từ (bối cảnh + 2–3 ràng buộc + qualifier) — SCHEMA §4.
   - ~25% câu multiple-response `(Choose TWO)` với 5 lựa chọn khi độ khó hard.
   - **Lựa chọn dài tương đương nhau**, cùng “dáng” câu; đáp án đúng **không** được dài nhất (≥ 15 % so với mọi distractor là lỗi chất lượng).
   - Đáp án đúng phân bố đều A–D.
   - Giải thích theo định dạng SCHEMA §3: 1–2 câu vì sao đúng + mỗi distractor hấp dẫn một dòng `- <nội dung>: <vì sao sai>`
     + dòng cuối `> 🇻🇳 …`; **gọi lựa chọn bằng nội dung, không bao giờ bằng chữ cái** (app xáo thứ tự đáp án).
   - Ghi `enriched: <YYYY-MM-DD>` khi câu đã có đủ giải thích chuẩn + hint + task (để ENRICH không xử lý lại).
   - Kiến thức **chỉ** lấy từ tài liệu nguồn hoặc hiểu biết AWS chắc chắn; tài liệu và kiến thức của bạn mâu thuẫn →
     theo kiến thức AWS hiện hành *đáng tin cậy hơn* và ghi chú trong giải thích “(notes ghi …, thực tế …)”.
6. **Kiểm tra** (chế độ tương tác): `node trainer/scripts/validate.ts packs/docs/<tên-file> --fill-time` — sửa đến khi **0 lỗi ❌**
   và không còn cảnh báo về chữ cái trong giải thích / đáp án đúng dài nhất (`--lint` liệt kê thêm lỗi viết câu).
   Không chạy được lệnh → tự soát kỹ theo SCHEMA.
7. (tuỳ chọn, chế độ tương tác) Thêm service/tag mới vào `taxonomy.yaml` (chỉ thêm).

## Giới hạn

- Chế độ tương tác — chỉ ghi: file pack mới trong `trainer/bank/packs/docs/` và (nếu cần) `trainer/bank/taxonomy.yaml`. Chế độ app:
  không ghi gì (app ghi pack).
- Đọc file bằng Read/Grep/Glob. Bash (chế độ tương tác) chỉ được chạy riêng lệnh `node trainer/scripts/validate.ts …`
  (không nối `;`/`&&`/`|`); lệnh khác bị từ chối không có nghĩa validator bị chặn.
- Không sửa notes, kết quả, kế hoạch hay code app.

## Trả lời cuối

3–5 dòng tiếng Việt: file pack đã tạo, số câu (theo domain/độ khó), kết quả validate, lưu ý nếu tài liệu có chỗ sai/lỗi thời.
Chế độ app: nội dung này nằm trong `summary` (file pack do app tạo).
