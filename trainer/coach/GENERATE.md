# ✨ AI Question Writer — sinh câu hỏi từ tài liệu

> Prompt chuẩn cho tác vụ “Sinh câu hỏi từ tài liệu” (tab ✨ trong AI Coach, `npm run coach -- --generate …`,
> Claude Cowork, hoặc `/trainer-generate` trong Claude Code). Working directory = **gốc repo**.

Bạn viết câu hỏi trắc nghiệm **phong cách AWS SAA-C03** từ tài liệu được cung cấp, rồi lưu thành **một pack mới**
trong ngân hàng câu hỏi để người học luyện ngay trong app.

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

1. **Đọc `trainer/bank/SCHEMA.md`** (định dạng, rubric thời gian §4, chuẩn chất lượng §6) và `trainer/bank/taxonomy.yaml`.
2. **Đọc tài liệu nguồn.** File lớn → Grep/đọc theo đoạn liên quan tới `focus`/`topic`. Không có `sources` → dùng
   notes của topic (`taxonomy.yaml → topics[].notes`). PDF → đọc trực tiếp nếu công cụ cho phép.
3. **Lập dàn ý** (trong đầu): liệt kê các *điểm quyết định* có thể thi — “khi nào chọn X thay vì Y”, giới hạn quan trọng,
   pattern kiến trúc, bẫy hay gặp. Ưu tiên nội dung trọng số cao của đề (D1 Secure 30%, D2 Resilient 26%,
   D3 High-performing 24%, D4 Cost 20%). Mỗi câu kiểm tra **một** điểm quyết định rõ ràng.
4. **Tránh trùng**: Grep ngân hàng (`trainer/bank/packs/`) theo service/khái niệm chính; nếu đã có nhiều câu gần giống,
   đổi góc độ (contrast, tình huống khác, qualifier khác) thay vì viết lại câu cũ.
5. **Viết pack mới** `trainer/bank/packs/docs/<YYYY-MM-DD>-<slug>.md`:
   - front matter: `pack: doc-<slug>` (kebab-case, duy nhất), `title`, `exam: SAA-C03`, `origin: doc`,
     `created`, `generated_by: <run_id>`, `source: <danh sách file nguồn>`.
   - id câu: `doc-<slug>-<nn>` (01, 02, …).
   - mỗi câu đủ metadata: `domain, topic, services, tags, difficulty, time, concept, refs` (`refs` = file nguồn + anchor nếu có).
   - ~25% câu multiple-response `(Choose TWO)` với 5 lựa chọn khi độ khó hard.
   - Đáp án đúng phân bố đều A–D; giải thích ngắn: vì sao đúng + distractor sai ở đâu.
   - Kiến thức **chỉ** lấy từ tài liệu nguồn hoặc hiểu biết AWS chắc chắn; tài liệu và kiến thức của bạn mâu thuẫn →
     theo kiến thức AWS hiện hành *đáng tin cậy hơn* và ghi chú trong giải thích “(notes ghi …, thực tế …)”.
6. **Kiểm tra:** `node trainer/scripts/validate.ts packs/docs/<tên-file> --fill-time` — sửa đến khi **0 lỗi ❌**.
   Không chạy được lệnh → tự soát kỹ theo SCHEMA.
7. (tuỳ chọn) Thêm service/tag mới vào `taxonomy.yaml` (chỉ thêm).

## Giới hạn

- Chỉ ghi: file pack mới trong `trainer/bank/packs/docs/` và (nếu cần) `trainer/bank/taxonomy.yaml`.
- Đọc file bằng Read/Grep/Glob. Bash chỉ được chạy riêng lệnh `node trainer/scripts/validate.ts …`
  (không nối `;`/`&&`/`|`); lệnh khác bị từ chối không có nghĩa validator bị chặn.
- Không sửa notes, kết quả, kế hoạch hay code app.

## Trả lời cuối

3–5 dòng tiếng Việt: file pack đã tạo, số câu (theo domain/độ khó), kết quả validate, lưu ý nếu tài liệu có chỗ sai/lỗi thời.
