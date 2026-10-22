# 🎯 Họ câu “cùng tình huống, đổi yêu cầu”

> Prompt chuẩn cho tác vụ **family**: AI Coach → 🪞 Song sinh & họ câu, `npm run coach -- --family [--topic …] [--task …]
> [--requirement cost|ops|resilient|performance|secure]`, hoặc `/trainer-enrich` (“họ câu”). Working directory = **gốc repo**.

Đề SAA-C03 thật thường có hai phương án **đều chạy được**; câu hỏi cuối (*MOST cost-effective*, *LEAST operational overhead*,
*MOST secure*, *highest availability*, *lowest latency*…) quyết định đáp án. Một **họ câu** luyện đúng kỹ năng đó: **một** tình huống,
**một** bộ lựa chọn dùng chung, 2–4 câu hỏi cuối khác yêu cầu → mỗi câu một đáp án khác. Ở chế độ 🎯 Đọc yêu cầu, các câu cùng họ
được rải xa nhau; sau câu thứ hai, người học thấy bảng “yêu cầu → đáp án”.

## Quy tắc

- Đọc file lô `trainer/coach/enrich/<run_id>-batch.md`: trọng tâm (topic / task / yêu cầu bắt buộc), từ khoá nhận diện từng yêu cầu,
  độ chính xác của người học theo loại yêu cầu (ưu tiên loại “yếu (có bằng chứng)”), ví dụ văn phong (**không chép**).
- Mỗi câu của họ là câu **tầng A** (SCHEMA §6b — đặc tả, nhãn lý do sai, ví dụ): đề ghép (scenario + câu hỏi cuối) 55–130 từ, phương
  án 8–35 từ, có tiêu chí quyết định. Họ câu chỉ có câu **một đáp án** (đáp án các câu phải khác nhau) — chỉ tiêu 25–30 % câu nhiều đáp
  án của §6b không áp dụng.
- **Tình huống** (`scenario`, tiếng Anh, **55–110 từ**): công ty, kiến trúc hiện tại, 2–4 ràng buộc thật (quy mô, dữ liệu, đội vận hành,
  ngân sách, tuân thủ…) đủ để **mỗi** yêu cầu có đúng một đáp án tốt nhất. **Không** có câu hỏi cuối trong scenario.
- **Bộ lựa chọn** (`options`, 4–5 câu, dùng chung): mỗi lựa chọn là giải pháp AWS **chạy được** cho tình huống — hành động hoàn chỉnh
  (service + cấu hình), **8–35 từ**, dài tương đương, cùng “dáng”; mỗi lựa chọn thắng ở một yêu cầu hoặc thua rõ ở mọi yêu cầu. Không
  “All/None of the above”, không từ tuyệt đối. Đáp án đúng không bao giờ là service `scope: out` / `legacy` hay đã đóng với khách hàng
  mới (`currency:`); tên service như exam guide (tên mới ghi ở giải thích).
- **Các câu (`members`, 2–4):** mỗi câu một `ask` khác nhau (`cost`, `ops`, `resilient`, `performance`, `secure`) và một `question`
  chỉ gồm câu hỏi cuối có qualifier rõ (vd “Which solution meets these requirements MOST cost-effectively?”). App ghép đề =
  scenario + question. **Đáp án các câu phải khác nhau** (app từ chối họ có hai câu cùng đáp án hoặc cùng yêu cầu, hoặc câu hỏi cuối
  không nêu yêu cầu). Mỗi câu có `explanation` riêng (50–120 từ): vì sao lựa chọn này thắng **với yêu cầu này** + mỗi lựa chọn khác
  một dòng vì sao thua (theo nội dung, không chữ cái) kèm nhãn của SCHEMA §6b — thường `tốn vận hành/chi phí hơn` hoặc `vi phạm ràng
  buộc` ứng với yêu cầu của câu đó, vd `- <nội dung>: <vì sao thua> (tốn vận hành/chi phí hơn "MOST cost-effectively")` — + ≥ 1 URL tài
  liệu AWS + `> 🇻🇳 …`; `hint` riêng không lộ đáp án.
- Metadata của họ: `domain, task` (câu nào nghiêng về domain khác thì ghi `domain` / `task` riêng ở câu đó), `topic, services, tags,
  difficulty` (thường hard), `concept` (vd “Spot (rẻ nhất) vs Fargate (ít vận hành nhất) cho xử lý chịu gián đoạn”), `refs`, `skills`.
- Kiến thức hiện hành (`taxonomy.yaml → currency:`); Grep notes trước khi viết; không dịch vụ ngoài phạm vi đề thi (`scope: out` /
  `legacy`); tính năng GA ≥ 3 tháng; không con số / giới hạn nếu không có URL tài liệu AWS xác nhận.
- Mỗi câu của họ được **giải mù riêng** — câu nào lệch / mơ hồ chuyển `draft` chờ duyệt.

## Chế độ app (JSON)

Chỉ đọc, không ghi file. Trả `pack` (`slug`, `title`), `families` (mỗi họ: metadata, `scenario`, `options`, `members` [{`ask`,
`question`, `answer`, `explanation`, `hint`}]) và `summary`. App gán id câu (`<tiền tố>01`, …) và id họ (`<tiền tố họ>1`, …), ghi
`family: <id họ>` cho mọi câu, tính `time`, tạo pack `trainer/bank/packs/ai/<ngày>-<giờ>-family-<slug>.md`. Họ bị từ chối được gửi
lại **một lần**: trả lại chỉ các họ đó, mỗi họ ghi `id` = id họ app đã gán.

## Chế độ tương tác (file)

1. `node trainer/scripts/enrich-batch.ts --family --run-id <run_id> [--count 2] [--topic …] [--task …] [--requirement …]`.
2. Viết pack mới đúng đường dẫn: front matter như TWINS.md (`title: "AI · Họ câu đổi yêu cầu · <chủ đề>"`); mỗi câu một block
   `## Q <id>` với `- family: <id họ>`, đề = tình huống + câu hỏi cuối, **cùng bộ lựa chọn theo cùng thứ tự** trong mọi câu của họ.
3. `node trainer/scripts/validate.ts packs/ai/<tên-file> --fill-time --lint` — lint `family-options` báo câu trong họ khác bộ lựa chọn;
   sửa cả lint chuẩn đề (`stem-short`, `options-bare`, `no-criterion`, `explanation-coverage`, `doc-url-missing`, `options-nonparallel`).
   Cảnh báo cấp pack “câu nhiều đáp án < 20 %” không áp dụng cho pack họ câu — bỏ qua.

## Trả lời cuối

2–4 dòng tiếng Việt: số họ, các cặp yêu cầu đã dùng (vd cost ⟷ ops), họ bị loại và vì sao, kết quả kiểm tra.
