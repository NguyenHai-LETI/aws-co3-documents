# 🎓 SAA-C03 Trainer — hệ thống luyện thi AWS chạy local

Ứng dụng web chạy **hoàn toàn trên máy bạn** (`127.0.0.1`) để luyện câu hỏi trắc nghiệm AWS SAA-C03:

- **Ngân hàng câu hỏi = file Markdown** trong `bank/packs/` (đã import **745 câu** từ `practice-exams/` V1 + V2, đã cân lại vị trí đáp án đúng,
  gắn mục exam guide 1.1–4.4). Mở rộng: tự viết, AI sinh từ tài liệu, AI Coach tự bổ sung, AI bảo trì dần (ENRICH).
- **Kết quả = file Markdown** trong `results/` (1 file/bài) — không database. Thống kê, lịch sử, lịch ôn **FSRS-6**, dự báo điểm ngày thi
  đều tính lại từ các file này (SQLite chỉ là bộ nhớ đệm dựng lại được, không phải nguồn dữ liệu).
- **AI Coach** (Claude Code, dùng gói Claude của bạn): phân tích kết quả → vá điểm yếu bằng câu biến thể/mở rộng → kế hoạch luyện tập;
  **ENRICH** làm giàu giải thích, gợi ý, phân loại, cân độ dài đáp án, viết lại phương án nhiễu, sinh câu dài chuẩn đề thật; **Hỏi AI** về
  từng câu. AI trả **JSON**, app tự kiểm tra (lint lỗi viết câu) rồi mới ghi; **model thứ hai giải mù** mọi câu mới / câu vừa sửa.
- **Học mọi nơi**: 🔎 tìm kiếm toàn văn câu hỏi + tài liệu, 📱 mở trên điện thoại qua Wi-Fi (mã truy cập), 🗂️ xuất sang Anki.
- **Đo trung thực** (v4): 🔒 **đề niêm phong** giữ riêng câu chưa từng gặp để đo "điểm trên câu mới", 🧭 chẩn đoán đầu vào theo 14 mục
  exam guide, huy hiệu "Giống đề thật", tách điểm **lần đầu gặp / gặp lại** để lộ ra học vẹt.
- **Học mỗi ngày & bám ngày thi** (v5): ▶ **Học hôm nay** theo quỹ phút, dừng sớm không bị phạt, lịch ôn và các giai đoạn bám ngày
  thi, chống học vẹt bằng cụm câu anh em / câu song sinh, 🔀 phân biệt dịch vụ dễ nhầm, 🩹 chữa bài từng bước, 🗺️ đề cương chính thức,
  🧑‍🏫 gia sư, 📒 sổ lỗi, 🎧 nghe, lá chắn thống kê; câu hỏi nhanh trong Claude Code, hỏi bài qua MCP, cài như app, điện thoại an toàn hơn.

```
 ┌──────────── bank/packs/*.md ◄─────────────────────────────────────────────┐
 │   (câu hỏi + thời gian chuẩn + task + gợi ý)                               │ bổ sung biến thể / câu dài, sửa câu lỗi,
 ▼                                                                            │ làm giàu giải thích (JSON → app kiểm tra → ghi)
 Tạo bài test ──► Làm bài (đồng hồ) ──► results/*.md ──► coach/snapshot.md ──► AI Coach · ENRICH (Claude) ──► 🧪 giải mù
 (13 chế độ + Pearson)  (gạch đáp án, tô từ khoá,   (1 file/bài)    (số liệu tổng hợp)        │           (model thứ hai)
 ▲                       nhớ trước, gợi ý, "vì sao")                                          │ kế hoạch
 └──────────────── coach/plans/*.md  (các phiên luyện có nút “Bắt đầu”) ◄─────────────────────┘
```

---

## 🚀 Chạy nhanh

```bash
cd trainer
npm install        # lần đầu
npm start          # → http://localhost:3003   (OPEN=1 npm start: tự mở trình duyệt · npm start -- --lan: mở cho điện thoại)
```

Hoặc **double-click** `trainer/start.command` (macOS) · `trainer/start.bat` (Windows) · `sh trainer/start.sh` (Linux):
tự `npm install` lần đầu, chạy server và mở trình duyệt (`--lan` để mở cho điện thoại).

Yêu cầu: **Node.js ≥ 22.18** (chạy TypeScript trực tiếp, không cần build). AI cần **Claude Code** đã đăng nhập —
app tự tìm CLI trong `PATH`, `~/.local/bin`, `~/.claude/local`, hoặc bản CLI đi kèm extension VS Code (macOS/Linux/Windows).
Đổi cổng: `PORT=4000 npm start`. Tuỳ chọn: **Ollama** (tìm câu trùng theo nghĩa), **Anki + AnkiConnect** (đẩy thẻ thẳng vào Anki).

## 🗂️ Cấu trúc

```
trainer/
├── bank/                     🗂️ NGÂN HÀNG CÂU HỎI (nguồn sự thật)
│   ├── SCHEMA.md             định dạng câu hỏi + rubric thời gian + chuẩn chất lượng + patch + JSON của AI + sổ giải mù
│   ├── taxonomy.yaml         domain (trọng số đề), task exam guide 1.1–4.4, topic, service, tag, từ khoá tô sáng
│   ├── issues.md · ratings.md · verify.md   lỗi câu hỏi bạn báo · đánh giá 👍/👎 · kết quả giải mù (merge=union)
│   ├── migrations/           lịch sử migration (vd cân lại vị trí đáp án)
│   └── packs/{imported,ai,docs,manual}/*.md
├── results/YYYY/MM/*.md      📝 KẾT QUẢ — front matter (máy đọc) + báo cáo (người/AI đọc)
│   ├── goal.md · external/*.md   mục tiêu (ngày thi, điểm, lịch học, ESL, checklist) · điểm thi thử bên ngoài
│   ├── sealed.md             đề niêm phong (id câu + trạng thái; app quản lý, đồng bộ cùng kết quả)
│   └── fsrs-params.json      tham số FSRS cá nhân (do app tối ưu)
├── coach/                    🤖 AI
│   ├── COACH.md · GENERATE.md · ENRICH.md   prompt chuẩn (dùng chung cho app, lịch, Cowork, Claude Code)
│   ├── snapshot.md           (tự sinh, git-ignored) số liệu tổng hợp cho AI
│   ├── learner-profile.md    (AI duy trì) trí nhớ dài hạn về người học
│   ├── plans/ · patches/ · enrich/ · qa/   kế hoạch · patch AI đã áp · lô ENRICH · hỏi đáp “Hỏi AI”
│   └── runs/                 log các lượt chạy (git-ignored)
├── inbox/                    📥 thả tài liệu (md/txt/pdf) để sinh câu hỏi
├── .cache/                   (git-ignored, xoá thoải mái) SQLite parse cache + chỉ mục tìm kiếm, embedding, giao diện cho điện thoại
├── .local/                   (git-ignored) mã truy cập LAN của máy này
├── config.yaml               model theo tác vụ, lịch, FSRS, chất lượng, LAN, Anki, cache, đồng bộ
├── server/ · shared/ · web/  code (Node + React/Vite)
├── scripts/                  import, validate, rebalance, classify-tasks, apply-patch, enrich-batch, snapshot, coach-run, schedule, sync
├── .githooks/pre-push        (tuỳ chọn, `npm run hooks:install`) chạy `check:fast` trước khi push code
└── tests/                    unit · e2e API · UI smoke (Playwright) · golden parse (fixtures/golden)
```

## ✍️ Các chế độ test

| Chế độ | Lấy câu nào |
|--------|-------------|
| 🎯 Thi thử SAA-C03 | 65 câu theo trọng số domain 30/26/24/20, ưu tiên câu chưa gặp, rồi câu giống đề thật; không bao giờ lấy cả câu gốc lẫn biến thể của nó. **Mô phỏng Pearson VUE**: 15 câu thử nghiệm không tính điểm (chỉ lộ sau khi nộp), màn hình Review cuối bài, không tạm dừng, cảnh báo 15′/5′, phân tích sức bền theo từng phần tư. Đồng hồ mặc định **theo tải đọc đề thật** (xem dưới) |
| 🔒 Đề niêm phong | 50 câu **chưa từng xuất hiện khi luyện** + 15 câu thử nghiệm, mô phỏng Pearson; chỉ **lần nộp đầu tiên** của mỗi đề là **điểm trên câu mới** (điểm hiệu chỉnh nội bộ) — làm lại = luyện thường (🔁). 2 đề được giữ riêng từ trước buổi luyện đầu tiên (`exam.sealed_forms`, `exam.sealed_size`); câu do AI viết chỉ được chọn khi model thứ hai đã giải mù khớp đáp án; gợi ý làm ≈ 3 tuần và ≈ 1 tuần trước ngày thi |
| 🧭 Chẩn đoán đầu vào | 2 câu cho mỗi mục exam guide 1.1–4.4 (28 câu, chia được 2 × 14), ưu tiên câu chưa gặp, không xét đạt/chưa đạt → **Bản đồ xuất phát** |
| 📚 Theo chủ đề | chọn 1+ chủ đề (+ domain, độ khó) |
| 📦 Theo bộ đề | làm lại nguyên 1 pack |
| 🧠 Ôn tập ngắt quãng | câu đến hạn theo **FSRS-6** (ưu tiên câu sắp quên nhất), tối đa `srs.daily_limit` câu/ngày, phần dư thành “tồn” |
| 🔁 Làm lại câu sai | câu mà lần gần nhất trả lời sai |
| 💪 Củng cố điểm yếu | lấy mẫu có trọng số: topic/tag/service tỉ lệ thấp, câu sai, câu “chưa chắc” |
| 🆕 Câu chưa làm · 🚩 Cờ/chưa chắc · 🐢 Tốc độ · ⚡ Luyện nhanh | như tên (🆕 đi theo thứ tự cố định, cân theo domain) |
| 🛠️ Tùy chỉnh | lọc tự do: domain, **mục exam guide**, chủ đề, độ khó, nguồn, service, tag, **tiêu chí đề** (Chi phí, Vận hành, Sẵn sàng cao, Hiệu năng, Bảo mật, Phủ định), từ khoá |
| 🤖 Kế hoạch AI Coach · 📌 Danh sách | phiên của coach · danh sách chọn tay / “làm lại N câu sai” (câu đang chờ duyệt — draft — luôn bị bỏ qua) |

Câu đang niêm phong và câu có đáp án là dịch vụ **ngoài phạm vi đề** (CodeCommit, IoT…, `practice.exclude_out_of_scope`) không xuất hiện
trong các chế độ luyện (trừ khi chọn hẳn bộ đề / danh sách id). Mọi bài có huy hiệu **“Giống đề thật a/N · w/W từ”** (câu dài ≥ 55 từ,
phương án đủ câu; đề thật ≈ 115 từ/câu) và cảnh báo **“điểm lạc quan”** khi thấp.

Tuỳ chọn mọi chế độ: **chấm cuối bài** hoặc **xem đáp án ngay** · **xáo đáp án (mặc định bật)** · preset thời gian ·
**🧠 Nhớ trước khi xem đáp án** (viết đáp án mình nghĩ trước, rồi mới hiện lựa chọn).

Khi làm bài: **gạch loại đáp án** (nút ✕, chuột phải hoặc `Shift`+số) · **🖍 tô từ khoá** qualifier (MOST cost-effective, LEAST operational
overhead, highly available…) · **💡 gợi ý** (chế độ xem đáp án ngay) · ô **“Vì sao bạn chọn?”** khi sai · 🚩 cờ · 🤔 chưa chắc.

## ⏱ Đồng hồ & thời gian chuẩn

Mỗi câu có `time` (giây) theo rubric chuẩn SAA-C03 (130 phút/65 câu ≈ 120 s cho câu dài ~170 từ; câu ngắn ít hơn) —
xem `bank/SCHEMA.md §4`. **Đồng hồ = Σ time các câu × hệ số preset** (Chuẩn ×1.0 · Áp lực ×0.8 · ESL +30′ · Thoải mái ×1.5 ·
Chuẩn đề thật 2′/câu · **Theo tải đọc đề thật** · Tự nhập · Không giới hạn). Hết giờ → tự nộp; cảnh báo khi còn 15′ và 5′; thanh trên cho
biết nhanh/chậm so với chuẩn. **Theo tải đọc đề thật** (mặc định của thi thử và đề niêm phong): 130′ tính theo số chữ phải đọc so với đề
thật, không ít hơn Σ chuẩn, tối đa 2′/câu — ngân hàng hiện có câu ngắn nên một bài 65 câu ≈ 57–60′ thay vì 130′ thừa thãi. Ô **🌐 ESL +30′**
(×160/130) bật sẵn khi mục tiêu thi có ESL. Ở chế độ xem đáp án ngay, thời gian đọc giải thích sau khi bấm **Kiểm tra** được lưu riêng
(`rt`), không làm câu bị tính là chậm.

Phím tắt: `1`–`5`/`A`–`E` chọn · `Shift`+số gạch · `←` `→` chuyển câu · `Enter` tiếp/kiểm tra · `F` cờ · `U` chưa chắc · `H` gợi ý ·
`/` ô tìm kiếm.

## 📝 Kết quả, lịch sử, thống kê

- Nộp bài → `results/YYYY/MM/<ngày>_<giờ>_<chế-độ>.md` (đáp án chọn, đáp án gạch, câu “nhớ trước”, gợi ý đã xem, lý do chọn, câu thử nghiệm,
  phiên bản câu hỏi đã làm…). Nộp bài trả về ngay; `coach/snapshot.md` được cập nhật nền vài giây sau.
- **Màn hình kết quả**: điểm, quy đổi /1000, đạt/chưa đạt, xem lại từng câu + giải thích + link tài liệu; **ghi “vì sao chọn”** cho câu sai
  (AI Coach đọc để chẩn đoán hiểu nhầm); 👍/👎 chất lượng câu; **🤖 Hỏi AI** về câu đó; 🐞 báo lỗi; sức bền theo phần tư (thi thử).
  Câu được **sửa đáp án** sau bài làm có dấu **↻ chấm lại** (thống kê tính theo đáp án mới, file kết quả giữ nguyên); câu chỉ sửa đề /
  phương án có dấu **✎ đã chỉnh sửa**.
- **Lịch sử**: phân trang (50 bài/trang), lọc theo chế độ / từ khoá, giữ trạng thái trên URL.
- **Thống kê**: **mức sẵn sàng v2** (giảm dần theo thời gian, trọng số độ khó/câu dài, khoảng tin cậy 90 %, **xác suất đỗ**) ·
  theo domain / **mục exam guide** / chủ đề / service / khái niệm · độ bền trí nhớ (FSRS-6) · hiệu chỉnh độ tự tin (chắc vs chưa chắc) ·
  số lần **gạch nhầm đáp án đúng** · tỉ lệ “nhớ trước” đúng · câu dài vs câu ngắn · tốc độ · hoạt động.
- **Bài làm vội** (thời gian trung vị/câu < `stats.rushed_median_seconds`) được đánh dấu và **không tính** vào thống kê/lịch ôn.
- **Câu chưa xem không phải lượt ôn**: câu bỏ trống chưa mở (không chọn, 0 giây) vẫn tính sai trong điểm bài, nhưng không vào FSRS, lịch ôn,
  "Làm lại câu sai", hạn mức ôn/ngày, mức sẵn sàng hay thống kê — câu đó vẫn là câu mới.
- **Lần đầu gặp và gặp lại**: gặp lại mà đúng nhanh hơn thời gian đọc đề + phương án (`stats.recognized_wpm`, 300 từ/phút) là **nhận diện
  mặt chữ** — FSRS chấm tối đa “Good”, mức sẵn sàng chỉ tính 0,3. Thống kê so tỉ lệ đúng lần đầu / gặp lại (14 ngày); kết quả thi thử ghi
  “đã gặp n/N · điểm phần câu mới”; câu nhận diện có dấu ⚡.
- **Thống kê** thêm **🎯 Theo tiêu chí đề** (Chi phí / Vận hành / Sẵn sàng cao / Hiệu năng / Bảo mật / Phủ định so với câu không nêu tiêu chí)
  và **🔀 Cặp hay nhầm**: tỉ lệ chọn phương án chứa X khi đáp án chứa Y, chia cho số lần cả hai cùng xuất hiện; chỉ xác nhận khi ≥ 4 lần chọn
  ở ≥ 3 câu và cận dưới 80 % > 2× mức nhầm nền của bạn; nút **Luyện cặp này**.
- Trong 7 ngày đầu, bài ngắn không phải thi thử không bị chấm đạt/chưa đạt; bài chẩn đoán không bao giờ.

### 🚀 Ngày đầu

Khi chưa có kết quả nào, **Tổng quan** hướng dẫn 3 bước: ① mục tiêu (ngày thi hoặc “Chưa đặt lịch — gợi ý 6–8 tuần”, điểm mục tiêu gợi ý
≥ 780, số phút mỗi ngày, ngày nghỉ, giờ học, ESL +30′) → ② bài chẩn đoán 28 câu (chia được 2 × 14) → ③ **Bản đồ xuất phát** ✓/~/✗ theo
từng mục exam guide và nút **🗓️ Lập kế hoạch tuần 1** (tự lập, không cần AI: vá các task yếu nhất theo trọng số, ôn ngắt quãng, thi thử
Pearson hoặc đề niêm phong cuối tuần; ghi `coach/plans/<ngày>-onboarding.md`). Bỏ qua được; không hiện lại sau bài đầu tiên.

### 🎯 Ngày thi, dự báo & FSRS-6

- **Thống kê → 🎯 Ngày thi & dự báo**: đặt ngày thi + điểm mục tiêu (`results/goal.md`, đồng bộ cùng kết quả) → đếm ngược và **dự báo điểm
  đúng ngày thi** theo từng domain (trọng số 30/26/24/20): câu đã gặp = xác suất còn nhớ của FSRS-6 *nếu dừng học hôm nay* / *nếu ôn đúng
  lịch*; câu chưa gặp = tỉ lệ đúng lần đầu của bạn; kèm độ phủ ngân hàng và **📆 lịch ôn sắp tới** (số câu đến hạn mỗi ngày tới ngày thi).
  Trang Tổng quan có thẻ đếm ngược. Dự báo đo khả năng nhớ *câu trong ngân hàng* nên lạc quan hơn đề thật — dùng điểm thi thử bên ngoài để hiệu chỉnh.
- **📝 Điểm thi thử bên ngoài** (AWS Official Practice Exam, Tutorials Dojo…, lưu `results/external/`): app so với mức sẵn sàng của chính nó
  vào ngày đó → **mức sẵn sàng hiệu chỉnh** (độ lệch trung bình 5 lần gần nhất). Đề niêm phong đã làm cũng vào danh sách này như một điểm
  hiệu chỉnh nội bộ (🔒 câu mới).
- **🔒 Đề niêm phong** (Thống kê → 🎯 Ngày thi): trạng thái, ngày gợi ý, **Làm đề niêm phong**, **Mở sớm** (trả câu về ngân hàng luyện, không
  tính điểm). `npm run seal -- --status` xem trạng thái từ terminal. Chỉ **lần nộp đầu tiên** của mỗi đề được tính (ghi vào `sealed.md`);
  làm lại, hoặc nộp sau khi đã Mở sớm, là bài luyện thường (🔁 trên trang kết quả). Bỏ dở giữa chừng thì đề vẫn niêm phong — nếu đã xem nhiều
  câu, hãy Mở sớm để điểm sau không bị thổi phồng. Câu niêm phong bị ẩn khỏi chế độ luyện, tìm kiếm, Anki, Ngân hàng, mục Chất lượng, nhật
  ký giải mù, snapshot và Hỏi AI; trong app, file pack (📄) hiện một dòng 🔒 thay cho câu niêm phong, còn `sealed.md`, `coach/enrich/` và
  `practice-exams/` không mở được khi còn đề niêm phong (tự giác: đừng mở các file này bằng trình soạn thảo). Nếu `sealed.md` hỏng (sửa tay,
  xung đột git), app **vẫn giữ kín** mọi câu có trong file, báo lỗi ở Thống kê và Tạo bài, và từ chối ghi cho tới khi sửa file
  (hoặc `npm run seal -- --reset --force` để tạo lại).
- **✅ Checklist ngày thi**: xin ESL +30′ (đề SAA-C03 không có tiếng Việt, phải xin **trước khi đặt lịch**), đặt lịch, giấy tờ trùng tên,
  tổng duyệt đúng giờ thi, hạn dời lịch (≥ 24 h, tối đa 2 lần), system test OnVUE / trung tâm thi, sau khi thi — có hạn theo ngày thi và link
  chính thức; thẻ đếm ngược ở Tổng quan nhắc việc kế tiếp và đề niêm phong kế tiếp.
- **FSRS-6** (thư viện ts-fsrs, tính theo ngày: câu đến hạn từ đầu ngày). **⚙️ Tham số FSRS → 🎛️ Tối ưu tham số FSRS** học bộ tham số riêng
  từ lịch sử của bạn (tiến trình nền, cần ≥ `srs.optimize_min_reviews` lượt ôn; chỉ dùng khi dự đoán tốt hơn mặc định; lưu
  `results/fsrs-params.json`). `srs.optimize: auto` tự tối ưu lại tối đa 1 lần/tuần khi lịch sử tăng ≥ 20 % · `manual` · `off`;
  `srs.weights` để tự đặt 21 tham số. Bài làm vội và câu bỏ trống chưa xem không được dùng để tối ưu.

## ✨ v5 — học mỗi ngày, bám ngày thi, chống học vẹt

### ▶ Học hôm nay & làm bài
- **▶ Học hôm nay** (Tổng quan, hoặc Tạo bài test → ▶️): một nút ghép sẵn phiên học vừa quỹ phút (5 / 10 / 25 / 45′ hoặc số phút/ngày
  trong Mục tiêu thi; mặc định `practice.today_minutes`): làm lại câu vừa sai (≤ 20 %), câu đến hạn ôn (≤ 50 %, trong
  `srs.daily_limit`), rồi chia đôi phần còn lại cho task yếu nhất và câu mới theo hạn mức ngày; gần ngày thi đổi sang ôn chốt / chỉ ôn
  lỗi. Câu xen kẽ chủ đề, xem đáp án ngay; tốc độ đọc của chính bạn được tính vào. Cùng dữ liệu + cùng ngày + cùng quỹ phút → cùng một
  bài. Đạt mục tiêu: "✓ Đã đạt mục tiêu hôm nay" + "Thêm 10 câu". Có phiên AI Coach còn mới thì được gợi ý trước. Các thẻ cũ nằm trong
  "Tự chọn khác…"; trên điện thoại nút chính và đếm ngược nằm trên cùng.
- **⏹ Dừng ở đây** (mọi chế độ trừ thi thử, đề niêm phong, chẩn đoán): chỉ lưu câu đã làm, điểm tính trên phần đó; câu chưa xem quay lại
  hàng chờ, câu đã mở mà bỏ trống ghi "bỏ qua". Lịch sử ghi "5/50 · dừng sớm". Phiên Học hôm nay có đồng hồ "⏱ 12:30 / 25′" và nhắc
  "Hết phiên — nộp phần đã làm".
- **🔁 Học lại trong phiên** (`practice.relearn`): câu sai hoặc phải xem gợi ý quay lại sau 3–6 câu, lựa chọn ẩn và đổi thứ tự — gõ ý chính
  rồi mới "Hiện lựa chọn". Lần hỏi lại không tính điểm. Ô "Vì sao bạn chọn" có **lý do một chạm** (Nhầm hai dịch vụ, Đọc sót yêu cầu…).
- **Làm tiếp trên máy khác**: bài đang làm được lưu cả trên máy chủ; mở app trên điện thoại (cùng Wi-Fi) → "⏯️ Tiếp tục bài trên …" →
  "▶ Làm tiếp trên máy này" (mở ở trạng thái tạm dừng). Hai máy cùng sửa thì app hỏi giữ bản nào.
- **Chế độ mới**: 🔀 **Phân biệt** (nhóm dịch vụ dễ nhầm, đáp án đúng luân phiên, nút "So sánh A ⟷ B"), 🎯 **Đọc yêu cầu** (họ câu "cùng
  tình huống, đổi câu hỏi cuối", các câu cùng họ cách nhau ≥ 5 câu; sau câu thứ hai hiện bảng "yêu cầu → đáp án"), ☀️ **Ôn lại lỗi hôm
  qua** (≤ 8 câu, lỗi "chắc mà sai" trước), 🩹 **Kiểm tra lại sau khi chữa**.

### 🩹 Chữa bài, câu dai dẳng, gia sư, sổ lỗi
- **Trang kết quả** mở thẳng tab Sai; **"🩹 Chữa N câu"** đi qua từng câu sai / chưa chắc (lỗi tự tin trước): thử chọn lại trước khi xem
  giải thích, chạm lý do, hỏi AI / Gia sư, rồi **"Kiểm tra lại ngay"** (đáp án xáo, không tính vào mức sẵn sàng; câu vẫn sai được ưu tiên
  trong Học hôm nay). Câu bị sửa đáp án sau khi bạn làm có thẻ **📣 Đính chính** kèm nút ôn lại.
- **🔂 Câu dai dẳng** (Thống kê): câu quên ≥ `srs.leech_lapses` lần hoặc sai ≥ 3 lần trong ≥ 2 ngày — lịch sử lựa chọn, cặp hay nhầm, mẹo
  nhớ, "✨ câu tương phản", "⏸ Tạm gác 3 ngày"; ra khỏi danh sách khi đúng ở 2 ngày khác nhau. Ghi chú lưu ở `results/leeches.md`.
- **🧑‍🏫 Gia sư** (Kết quả → 🤖 Hỏi AI → tab Gia sư, hoặc trong bước Chữa bài): AI không nói ngay đáp án mà hỏi dẫn dắt từ lựa chọn và lý
  do của bạn; đáp án chỉ hiện sau 3 lượt hoặc khi bấm "🏳️ Tôi chịu"; cuối buổi chốt một quy tắc vào Sổ lỗi. Mỗi lượt là một lần gọi
  Claude Code không có công cụ (`coach.models.tutor`), tối đa `coach.tutor_daily_turns` lượt trả lời của AI mỗi ngày (0 = tắt).
- **📒 Sổ lỗi** (Tài liệu → 📒 Sổ lỗi): gom câu sai / chưa chắc thành từng hiểu nhầm — điều bạn đã nghĩ, quy tắc đúng, dấu hiệu trong đề,
  cặp dễ nhầm, tài liệu đọc lại, câu bằng chứng (🔥 = sai dù chắc chắn). Bấm "📒 Cập nhật sổ" (1 lượt AI) hoặc thêm `notebook` vào
  `coach.idle_tasks`. Markdown trong `coach/notebook/`, sửa / xoá / gộp ngay trong app, tìm được bằng ô tìm kiếm, xuất thẻ Anki.
- **🎧 Nghe** (`#/listen`, điện thoại qua LAN cũng được): đọc to câu ngắn đến hạn, dừng để tự nhớ, đọc đáp án; tự chấm Quên / Khó / Nhớ /
  Dễ bằng nút to, phím 1–4 hoặc nút tai nghe. Dùng cho lịch ôn, không tính vào mức sẵn sàng. "📒 Bản tin" đọc lại các quy tắc trong Sổ lỗi.

### 📆 Bám ngày thi & lá chắn thống kê
- **Giai đoạn** (khi đã đặt ngày thi, `srs.exam_aware`): Xây nền → **Đo & vá** (T−14) → **Củng cố** (T−7, không thêm câu mới, ôn trước
  hạn câu có xác suất nhớ hôm thi thấp) → **Nhẹ** (T−2, ≤ 30′). Câu mới có **hạn mức mỗi ngày** để gặp hết trước ngày thi −
  `srs.new_cutoff_days`; câu có hạn ôn rơi sau ngày thi − 2 mà khả năng nhớ hôm thi < 90 % được kéo vào **giai đoạn ôn chốt**
  (`srs.final_review_days`); hạn ôn được **rải đều** sang ngày ít câu (`srs.load_balance`); tồn nhiều thì gợi ý "đuổi kịp".
- Từ T−14: thẻ **"Thi hay dời?"** (Thống kê → 🎯 Ngày thi: 3 tiêu chí, hạn chót dời lịch — chỉ là lời khuyên) và nút **"🏁 Kế hoạch nước
  rút"** tạo lịch từng ngày tới ngày thi (không dùng AI, `coach/plans/<ngày>-sprint.md`). Dự báo thêm dòng "theo lịch bám ngày thi" và
  "nếu mỗi ngày chỉ học 10 / 20 / 45′".
- **Lá chắn thống kê**: mọi nhận xét tự động (chủ đề / service / task yếu, độ tự tin, câu dài, sức bền, câu mới vs gặp lại) dùng tỉ lệ đúng
  đã "co" về mức chung của bạn kèm khoảng tin cậy 80 %; chỉ kết luận khi đủ rõ, nếu chưa thì ghi "chưa đủ dữ liệu — cần ~N câu nữa".

### 🧬 Chống học vẹt, cặp dễ nhầm, đề cương
- **Cụm câu anh em**: app gom các câu "cùng hỏi một điều" (biến thể, gần trùng, cùng chủ đề + cùng đáp án + đề giống nhau). Mỗi phiên chỉ
  một câu mỗi cụm; làm một câu thì các câu cùng cụm để sang hôm sau. Câu đã bền (≥ `srs.sibling_swap_days` ngày) đến hạn có thể được hỏi
  bằng **câu anh em chưa gặp** (↔). Thống kê có thẻ **chuyển giao**: đúng lần đầu gặp câu anh em so với gặp lại câu cũ. Thi thử lấy
  ≥ 50 % câu giống đề thật mỗi domain khi đủ.
- **🪞 Câu song sinh & họ câu** (AI Coach → 🪞): AI viết câu diễn đạt lại / tương phản cho câu bạn sắp ôn, và "họ câu" (một tình huống, một
  bộ lựa chọn, 2–4 câu hỏi cuối khác yêu cầu). Mọi câu qua lint + giải mù; chỉ chạy khi bấm (hoặc `coach.idle_tasks` có `twins`).
- **🔀 Cặp dịch vụ dễ nhầm** (`#/pair?a=SNS&b=SQS`): trích mục so sánh trong tài liệu, tiến độ ("đã tách được" khi ≥ 80 % trong 10 câu gần
  nhất) và nút "Luyện phân biệt".
- **🗺️ Đề cương chính thức** (Ngân hàng → Chất lượng → 🗺️): 189 mục Knowledge/Skills của SAA-C03 (chép nguyên văn từ trang AWS ngày
  2026-10-20, `bank/exam-guide/`): mỗi mục có bao nhiêu câu, bao nhiêu câu dài chuẩn thi, bạn đúng lần đầu bao nhiêu; chọn ô trống →
  "✨ Sinh cho ô trống". Câu được gắn `skills` (lưu sẵn, hoặc đoán theo từ khoá — đánh dấu "đoán").

### 🔗 Nội dung chính xác
- **Kiến thức lỗi thời** (lint `stale-fact`): câu còn dùng tên / giới hạn cũ (SQS 256 KB → 1 MiB, Kinesis Data Firehose → Amazon Data
  Firehose, Snowcone đã ngừng…) theo danh sách `currency:` trong `taxonomy.yaml`, mỗi mục kèm link tài liệu AWS chính thức.
- **🔗 Kiểm chứng có nguồn** (Chất lượng → 🧪): Claude chỉ được đọc docs.aws.amazon.com / aws.amazon.com để kết luận đáp án đúng / sai /
  lỗi thời kèm trích dẫn; câu bị nghi tạm không tính vào mức sẵn sàng tới khi bạn duyệt. **🧾 Kiểm toán 10 câu nhập** giải mù dần các câu từ
  đề luyện (câu sắp gặp trước); tuỳ chọn phiếu thứ ba từ model Ollama (`coach.verify.local_model`). ENRICH sửa câu dựa trên trích dẫn.
- **↩️ Hoàn tác lượt AI** (AI Coach → Lượt chạy, hoặc khung chi tiết câu): khôi phục các câu một lượt AI đã sửa và loại (retired) các câu
  nó tạo; câu đã bị sửa tiếp sau lượt đó được giữ nguyên và báo lại.

### 📱 Học mọi nơi
- **Bản build production**: `npm start` (và start.command / start.bat) phục vụ giao diện đã đóng gói; trang nặng chỉ tải khi mở. Sửa giao
  diện thì dùng `npm run dev` (Vite HMR). Sau khi nhận code mới và bấm "Khởi động lại", app tự dựng lại giao diện. Chrome / Edge: ⋮ →
  Cài đặt ứng dụng để mở như app, số câu đến hạn hiện trên icon.
- **Chạy nền**: `npm run service -- install` cho trainer tự chạy khi đăng nhập (macOS launchd, Linux systemd, Windows Task Scheduler) và tự
  khởi động lại khi cập nhật / lỗi; `status`, `uninstall`, `print` (xem trước file sẽ tạo).
- **Điện thoại an toàn hơn**: mỗi thiết bị quét QR nhận mã riêng 30 ngày, xem / thu hồi ở 🧰 Công cụ → 📱. Điện thoại mặc định **chỉ luyện
  tập**; AI Coach, đồng bộ, kiểm duyệt, cài đặt chỉ dùng trên máy chạy app, trừ khi bật "🔓 Cho phép quản trị từ điện thoại" (tới khi
  khởi động lại) hoặc `server.lan_admin: true`. **HTTPS**: `server.https: tailscale` (app tự chạy `tailscale cert`, học được cả qua 4G)
  hoặc `mkcert` (chứng chỉ ở `.local/certs/`); qua HTTPS điện thoại cài được app (PWA).
- **Câu hỏi nhanh trong Claude Code**: dòng trạng thái `"statusLine": {"type": "command", "command": "node <đường dẫn>/trainer/integrations/claude-code/statusline.mjs"}`
  hiện "📚 12 câu đến hạn · sẵn sàng 63 %"; mod `claude --plugin-dir trainer/integrations/claude-code/mod`: khi Claude đang làm việc, phía
  trên ô nhập hiện một câu ngắn, gõ số 1–5 để trả lời, `/saa off` để tắt. Gom thành bài "☕ Câu hỏi nhanh" mỗi ngày, không tốn hạn mức AI.
- **Hỏi bài qua chat (MCP)**: mở repo bằng Claude Code (cho phép server `saa-trainer` trong `.mcp.json`), gõ `/trainer-quiz` hoặc "hỏi
  mình 10 câu phần yếu". Claude không biết đáp án trước khi bạn trả lời; kết quả lưu với nguồn 💬 chat. Claude Desktop: thêm
  `{"command": "node", "args": ["<đường dẫn tuyệt đối>/trainer/scripts/mcp-server.ts"]}` vào cấu hình MCP. Cần app đang chạy.
- **📥 Nhập lượt ôn từ Anki** (Công cụ → Anki, cần Anki desktop + AnkiConnect): lượt ôn trên Anki vào lịch ôn FSRS (không tính vào mức
  sẵn sàng, mỗi khoảng chỉ nhập một lần). Lịch sử ghi nguồn 🃏 Anki / 🎧 Nghe / ☕ nhanh / 💬 chat.

## 🗂️ Ngân hàng & chất lượng

**Ngân hàng → 📐 Chất lượng** có 5 mục:

- **📐 Tổng quan**: phân bố vị trí đáp án đúng, “đáp án đúng dài nhất”, độ dài đề, câu dài chuẩn thi thật, giải thích ngắn, gợi ý, mục exam
  guide, câu bị đánh giá thấp, hiệu quả câu biến thể, tiến độ ENRICH + ô **Việc cần làm**.
- **🩺 Lỗi viết câu** (lint tự động theo nguyên tắc viết câu trắc nghiệm): đáp án đúng dài nhất, đáp án đúng lặp từ của đề, từ tuyệt đối
  (“always/only…”) ở phương án nhiễu, câu phủ định không nhấn NOT/EXCEPT/LEAST, “All/None of the above”, phương án trùng/chồng lấn,
  mạo từ a/an lộ đáp án, “(Choose N)” sai số đáp án, giải thích nhắc chữ cái / quá ngắn. Mức **nặng** (trùng phương án, All/None,
  Choose N, nhắc chữ cái) → mọi sửa đổi của AI làm phát sinh lỗi nặng mới đều bị từ chối. Bấm một luật để xem câu, lọc tab Câu hỏi
  (`#/bank?lint=<luật>`) hoặc gửi ENRICH sửa. Lệnh: `npm run validate -- --lint` (`--lint=stem-echo`, `--warnings`, `--json`).
- **🎯 Phương án nhiễu** (từ chính bài làm của bạn, chỉ tính phiên bản hiện tại của câu): phương án chưa ai chọn mà hay bị gạch ✕ →
  **🧹 Viết lại phương án nhiễu** (ENRICH `distractors`); cùng một phương án sai được chọn chắc chắn nhiều lần → **🔎 Giải mù** /
  **🚩 Báo lỗi đáp án**.
- **👯 Câu trùng**: so khớp từ khoá, và **theo nghĩa** bằng model embedding chạy trên máy qua **Ollama**
  (`brew install ollama` → `ollama serve` → `ollama pull embeddinggemma`, rồi bấm “↻ Kiểm tra lại”; chạy nền, lưu ở `.cache/`, không gửi
  dữ liệu ra ngoài; `config.yaml → quality.*`).
- **🧪 Giải mù bằng model thứ hai**: kết quả `bank/verify.md`, hàng chờ duyệt (đề + phương án, đáp án ✓, lựa chọn của model 🤖, lý do) →
  👍 Duyệt · 🧹 Sửa bằng ENRICH · 🚩 Báo lỗi · 🗑️ Loại; chạy cho câu AI chưa kiểm, câu đã sửa, một bộ đề hoặc các câu đang chọn
  (tab Câu hỏi → “🔎 Giải mù N câu”).

- **🎯 Phạm vi đề thi**: dịch vụ ngoài phạm vi theo danh sách chính thức của AWS (CodeCommit/CodeBuild/CodeDeploy, IoT, Lightsail…) và tên
  mới của dịch vụ đã đổi tên; câu có đáp án ngoài phạm vi (luật lint `oos-answer`) bị bỏ khỏi các chế độ luyện, có nút loại câu hoặc gửi ENRICH
  thay phương án nhiễu (`oos-distractor`).

Khung chi tiết câu hỏi hiện lỗi viết câu và kết quả giải mù của câu đó (câu đang niêm phong chỉ hiện 🔒). AI Coach đọc các phần này trong snapshot.
Migration đã áp cho bộ đề gốc: `npm run rebalance` (cân vị trí đáp án — kết quả cũ được tự chuyển đổi theo `bank/migrations/`) và
`npm run classify-tasks` (gắn mục exam guide theo heuristic; AI tinh chỉnh dần qua ENRICH).

## 🤖 AI Coach · ENRICH · Hỏi AI

| Tác vụ | Làm gì | Prompt |
|--------|--------|--------|
| **Phân tích** (🔍 Phân tích ngay) | đọc snapshot (gồm lý do chọn sai, đáp án gạch nhầm, câu hỏi AI, đánh giá 👎, câu trùng, lỗi viết câu, phương án nhiễu, hàng chờ giải mù) → sửa issue → sinh câu biến thể/contrast/mở rộng → kế hoạch → hồ sơ người học | `coach/COACH.md` |
| **ENRICH** (🧹 bảo trì ngân hàng) | theo lô N câu (hoặc danh sách id): giải thích EN theo nội dung từng đáp án + tóm tắt 🇻🇳, gợi ý, phân loại domain/task/tag, cân độ dài đáp án, **viết lại phương án nhiễu** (`distractors`) | `coach/ENRICH.md` |
| **Câu dài** (long-form) | sinh phiên bản đề dài chuẩn thi thật (60–120 từ) cho khái niệm cốt lõi | `coach/ENRICH.md` |
| **Sinh từ tài liệu** | đọc notes/inbox → pack mới trong `packs/docs/` | `coach/GENERATE.md` |
| **🧪 Giải mù** | model thứ hai (`coach.models.verify`, mặc định opus) giải câu **không xem đáp án/giải thích** → `bank/verify.md` | — |
| **Hỏi AI** | hỏi tiếp về 1 câu (“vì sao không phải C?”) — chỉ đọc tài liệu ôn ở thư mục gốc (không đọc `trainer/`, `practice-exams/`), lưu vào `coach/qa/<id>.md` | — |

**AI trả JSON, app tự kiểm tra** (`coach.structured_output: true`, mặc định): Sinh câu, ENRICH và Câu dài chạy Claude **chỉ đọc**
(`--tools Read,Glob,Grep`, `--json-schema`); app tự ghi patch `coach/patches/<run>.yaml` hoặc pack mới sau khi kiểm tra từng câu (định dạng,
task cùng domain, chữ cái đáp án trong giải thích, gợi ý lộ đáp án, “Choose N”, lint lỗi nặng). Câu lỗi được gửi lại **một lần** trong cùng
phiên (`--resume`) để AI sửa; còn lỗi thì bỏ qua và ghi log. Mọi patch (ENRICH, coach, `npm run apply-patch`) đều chạy lint sau từng item.
**ENRICH ưu tiên câu sắp gặp**: câu đến hạn ngày mai, các câu "chưa làm" kế tiếp và câu trong phiên kế hoạch được làm giàu giải thích trước
(lần gặp đầu là lúc phản hồi đáng giá nhất); `coach.enrich_after_analyze: true` chạy thêm một lô 10 câu sau mỗi lượt phân tích (tốn thêm quota).
Câu đang niêm phong không bao giờ được dùng làm nguồn câu biến thể / câu dài.
**Giải mù tự động** (`coach.verify.auto`): sau mỗi lượt AI có câu mới hoặc câu bị đổi đề/phương án/đáp án, model thứ hai giải các câu đó;
câu do AI viết bị **lệch đáp án / mơ hồ** tự chuyển `draft` (`coach.verify.auto_draft`) chờ bạn duyệt — câu đề gốc không bao giờ tự bị chuyển draft.
`/trainer-enrich`, `/trainer-generate` và Cowork vẫn dùng chế độ tương tác (AI tự ghi file).

| Cách chạy | Lệnh / thao tác |
|-----------|-----------------|
| Nút trong app | AI Coach (Phân tích, ✨ Sinh câu, 🧹 ENRICH, câu dài) · Ngân hàng → Chất lượng (lint, phương án nhiễu, giải mù) · Hỏi AI ở kết quả/ngân hàng |
| Lịch tự động (macOS/Linux/Windows) | `npm run schedule -- install` (giờ trong `config.yaml → coach.schedule`; `status`, `run`, `uninstall`). Không có dữ liệu mới → chạy 1 lô ENRICH thay vì phân tích (`coach.enrich_on_idle`) |
| Terminal | `npm run coach` · `-- --force` · `-- --enrich --size 20 --batches 3` · `-- --enrich --ids a,b --tasks distractors --note "…"` · `-- --longform --count 5` · `-- --generate --sources 03-database-services.md --count 15` · `-- --verify [--ids a,b \| --pack <id> \| --scope unverified-ai\|new\|changed]` |
| Claude Cowork | dán prompt từ nút **📋 Prompt cho Claude Cowork**; định kỳ: **Scheduled → New task → Set up manually** (task dùng file local chỉ chạy khi máy bật, Claude Desktop mở) |
| Claude Code | `/trainer-coach` · `/trainer-generate <tham số>` · `/trainer-enrich` — vận hành: `/trainer [start\|stop\|restart\|status]` · `/trainer-import` (đề mới trong practice-exams/) · `/trainer-review` (soát độc lập câu AI → issues.md) · `/trainer-coverage` (độ phủ so với exam guide) · `/trainer-quiz` (hỏi bài qua MCP) |

**Model & chi phí**: `config.yaml → coach.models` chọn model theo tác vụ (mặc định sonnet cho sinh câu/ENRICH/Hỏi AI, opus cho giải mù);
trang AI Coach hiển thị số lượt, chi phí quy đổi 30 ngày và tóm tắt kết quả từng lượt. **Quyền của AI** (`--permission-mode dontAsk`):
chỉ đọc file trong repo; Sinh câu / ENRICH / Câu dài không có quyền ghi (app ghi); Giải mù không có công cụ nào; Phân tích chỉ ghi
`trainer/bank/**`, `trainer/coach/**`, Bash chỉ chạy `validate.ts`, `snapshot.ts`, `apply-patch.ts`. Không bao giờ sửa `results/`.
Coach dùng đăng nhập claude.ai (bỏ `ANTHROPIC_API_KEY` trừ khi `coach.use_api_key: true`). Nút bấm dùng Claude Code CLI vì Cowork không thể
kích hoạt từ app khác.

## ⚡ Hiệu năng & 🔎 Tìm kiếm

- Bộ nhớ đệm SQLite dựng lại được ở `trainer/.cache/trainer.db` (không lên git, xoá thoải mái, tắt bằng `cache.sqlite: false`): khởi động lại
  ~1 giây kể cả với hàng nghìn bài làm, mỗi file kết quả chỉ được đọc một lần. Lịch sử và danh sách kế hoạch được phân trang, dữ liệu nén gzip,
  giao diện chỉ tải lại phần đã đổi (đo trên 1.500 bài: nộp bài 3,3 s → 7 ms; mỗi trang tải < 200 KB).
- **Ô tìm kiếm** ở đầu mọi trang (phím `/`, ↑ ↓ chọn, Enter mở, Esc đóng): tìm toàn văn (SQLite FTS5) trong câu hỏi (đề, đáp án, giải thích,
  service, tag, mã câu) và tài liệu (theo từng heading); không cần gõ dấu (“do ben” → “độ bền”). Câu hỏi mở trong Ngân hàng, tài liệu mở đúng mục.

## 📱 Học trên điện thoại (mạng LAN)

Mặc định app chỉ mở cho máy này (`127.0.0.1`). Muốn học trên điện thoại cùng Wi-Fi: **🧰 Công cụ → 📱 Mở trên điện thoại → 📶 Bật truy cập LAN**
(bật đến khi khởi động lại app), hoặc lâu dài: `server.lan: true` trong `config.yaml` · `npm start -- --lan` · `LAN=1 npm start` ·
`./start.sh --lan` / `start.bat --lan`. Quét **mã QR** bằng camera điện thoại là vào được (trình duyệt nhớ 30 ngày); không quét được thì mở
địa chỉ IP trên trang rồi nhập **mã truy cập**. Điện thoại nhận bản giao diện đã đóng gói (tự dựng vào `.cache/lan-ui`, nhanh hơn ~4 lần).
**🔄 Đổi mã** đăng xuất mọi thiết bị. Lưu ý: ai có mã dùng được mọi chức năng (kể cả chạy AI, đồng bộ git) và kết nối LAN là HTTP không mã
hoá — chỉ bật trên Wi-Fi tin cậy, tắt khi không dùng. Không vào được: hai máy cùng Wi-Fi (Wi-Fi khách thường chặn), tường lửa macOS/Windows
cho phép `node`, Android có thể không hiểu tên `.local` (dùng IP).

## 🗂️ Xuất sang Anki

**🧰 Công cụ → 🗂️ Xuất sang Anki**: chọn phạm vi (tất cả · theo bộ lọc · câu sai · đến hạn ôn · cờ/chưa chắc · danh sách id), deck, loại ghi chú
và có kèm giải thích hay không. **⬇️ Tải file** `.txt` có sẵn tiêu đề nhập của Anki (≥ 2.1.55): Anki → File → Import. Mỗi câu có GUID cố định
nên **xuất lại sau khi câu được sửa sẽ cập nhật thẻ cũ, giữ lịch ôn**. **📤 Đẩy thẳng vào Anki** cần Anki đang mở + add-on **AnkiConnect**
(`2055492159`). Thẻ có tag `SAA-C03::domain::…`, `::topic::…`, `::task::…`, `::service::…`. Link nhanh: `#/tools?anki=wrong`,
`#/tools?anki=ids&ids=a,b,c`.

## 🔄 Dùng trên 2 máy

- Nút **⇅ Đồng bộ** (góc dưới thanh bên) hoặc `npm run sync`: commit `trainer/results`, `trainer/coach`, `trainer/bank` → `pull --rebase` → `push`
  (cần quyền push vào repo; lỗi xác thực có hướng dẫn). Chỉ commit 3 thư mục dữ liệu; không bao giờ hỏi mật khẩu (thiếu đăng nhập → báo lỗi ngay);
  conflict → huỷ rebase, dữ liệu máy này vẫn nằm trong commit cục bộ. Nút pill: ↑ commit chưa đẩy · ↓ commit mới trên remote · ● file dữ liệu chưa commit.
- **AI Coach tự đồng bộ** (`config.yaml → sync.before_ai`, `sync.after_ai`, mặc định bật): mỗi lượt phân tích / sinh câu / ENRICH / câu dài
  đồng bộ **trước** khi gọi Claude (AI thấy cả bài làm của máy kia; ENRICH / câu dài chọn lại lô câu nếu vừa nhận dữ liệu từ máy kia) và **sau** lượt chạy thành công
  (kế hoạch, câu mới, patch lên GitHub ngay). Lịch tự động đồng bộ trước khi xét "có bài mới không". Đồng bộ lỗi chỉ ghi cảnh báo vào log —
  AI vẫn chạy với dữ liệu trên máy. "Hỏi AI" không đồng bộ (chỉ đọc câu hỏi).
- **Tự đồng bộ khi rảnh** (`sync.auto: idle`, mặc định bật; `sync.auto_delay_minutes: 4`): nộp bài xong mà vài phút không bắt đầu bài mới
  thì app tự ⇅ Đồng bộ im lặng (không chạy khi AI Coach hay một lượt đồng bộ khác đang chạy; lỗi mạng → thử lại thưa dần tới 1 giờ). Mở app →
  **kéo về trước** (chờ tối đa 8 giây) để lịch ôn, kế hoạch và đề niêm phong thấy bài của máy kia; tắt app (Ctrl+C) → **đẩy phần còn lại**
  (tối đa ~12 giây, chờ lượt đồng bộ đang chạy xong trước; Ctrl+C lần nữa để bỏ qua). Nút ⇅ hiện lần đồng bộ cuối, cảnh báo **⏳** khi dữ liệu
  chưa đẩy quá 24 giờ và **⚠** khi lần tự đồng bộ gần nhất lỗi hoặc bị chặn. Tự đồng bộ **không bao giờ cất tạm (stash) code đang sửa**
  (có file code chưa commit → bỏ qua bước kéo về), **chỉ đẩy dữ liệu học** (có commit code chưa đẩy → giữ lại, bấm ⇅ để đẩy và chạy hook
  pre-push) và không chạy khi nhánh hiện tại khác tên nhánh upstream. Repo kẹt giữa chừng (rebase dở, còn conflict marker) → nút ⇅ chỉ
  đúng lệnh gỡ (`git rebase --abort`, hoặc `git rebase --quit` + `git stash pop`). Tắt: `sync.auto: off`.
- **Code mới từ máy kia**: khi đồng bộ nhận thay đổi code, app hiện banner **🔄 Ứng dụng vừa được cập nhật** — mở bằng `start.command` /
  `start.sh` / `start.bat` thì bấm **↻ Khởi động lại** (tự `npm install` khi thư viện đổi, trang tự tải lại); chạy bằng `npm start` thì tắt rồi
  chạy lại.
- **Nộp bài an toàn**: nộp lại cùng một bài (mạng chập chờn, bấm hai lần) chỉ tạo **một** file kết quả; mất kết nối khi nộp → bài chuyển sang
  **⏳ chờ nộp** (lưu trên trình duyệt), tự nộp lại khi có mạng / mở lại trang, giữ nguyên giờ nộp.
- `config.yaml → coach.hosts: ["<tên-máy>"]` để **chỉ một máy** chạy coach theo lịch (tránh conflict). `issues.md`, `ratings.md`, `verify.md`,
  `coach/qa/*`, `results/fsrs-params.json` dùng `merge=union` (`.gitattributes`) nên ghi song song không conflict.

## ➕ Mở rộng ngân hàng câu hỏi

1. **Tự viết**: tạo file trong `bank/packs/manual/` theo `bank/SCHEMA.md`, chạy `npm run validate` (`-- --lint` để soát lỗi viết câu) — hoặc viết thêm câu vào **cuối**
   đề trong `practice-exams/` rồi `/trainer-import` (`npm run import -- --merge`): chỉ thêm câu mới, không ghi đè phần ENRICH/coach đã sửa.
2. **Từ tài liệu**: thả file vào `inbox/` (hoặc chọn notes có sẵn) → AI Coach → ✨ Sinh câu hỏi.
3. **AI Coach / ENRICH** tự bổ sung và làm giàu dần (`bank/packs/ai/`, patch trong `coach/patches/`), mỗi câu mới được giải mù trước khi dùng.

App tự nạp lại khi file thay đổi. Câu lỗi định dạng bị loại khỏi test và hiện ở *Ngân hàng → Kiểm tra định dạng*.

## 🧰 Lệnh

| Lệnh | Việc |
|------|------|
| `npm start` · `npm run dev` | chạy app với giao diện đã build (`-- --lan`: mở cho điện thoại) · chế độ phát triển: Vite HMR + tự khởi động lại server khi sửa code |
| `npm run validate [-- <file> --warnings --fill-time --lint[=luật] --json]` | kiểm tra ngân hàng / tự điền thời gian / lint lỗi viết câu |
| `npm run rebalance [-- --apply]` · `npm run classify-tasks [-- --apply]` | migration: cân vị trí đáp án · gắn mục exam guide |
| `npm run apply-patch -- <patch.yaml> [--dry-run]` · `npm run enrich-batch [-- --status \| --longform \| --ids a,b --tasks distractors]` | áp patch AI · xem lô ENRICH kế tiếp / tiến độ / ứng viên câu dài |
| `npm run import -- --merge [--dry-run] [--only <chương>]` | thêm câu mới từ `practice-exams/` vào pack imported (không ghi đè; báo câu cũ khác nguồn) |
| `npm run coverage [-- --json]` | độ phủ ngân hàng: domain so với trọng số đề, task 1.1–4.4, service chưa có câu, câu nghi phân loại sai, mục đề cương chính thức chưa có câu |
| `npm run snapshot` | cập nhật `coach/snapshot.md` |
| `npm run coach [-- …]` | chạy AI 1 lần (xem bảng trên, gồm `--verify`) |
| `npm run schedule -- install\|status\|run\|uninstall` | lịch chạy tự động (launchd / crontab / Task Scheduler) |
| `npm run sync [-- --dry-run \| --status \| --force]` | đồng bộ dữ liệu học qua git (xem trước · trạng thái · chạy cả khi coach đang chạy) |
| `npm run seal [-- --status \| --release S1 \| --forms N --size M \| --reset]` | đề niêm phong: trạng thái · mở sớm · tạo · tạo lại |
| `npm run service -- install\|uninstall\|status\|print` | chạy trainer nền khi đăng nhập (tự khởi động lại khi cập nhật / lỗi) |
| `npm run mcp` · `npm run coach -- --twins \| --family` | MCP server cho Claude (hỏi bài qua chat) · sinh câu song sinh / họ câu |
| `npm run typecheck` · `npm test` · `npm run test:e2e` · `npm run test:ui` | kiểm tra kiểu · unit · e2e API · UI smoke (Playwright; thiếu trình duyệt → in lệnh `npx playwright install chromium`) |
| `npm run check` · `npm run check:fast` · `npm run hooks:install` | validate + typecheck + unit + e2e (~40 s) · typecheck + unit (~10 s) · bật hook pre-push trên máy này |

**Hook pre-push** (bật một lần mỗi máy: `cd trainer && npm run hooks:install`): push có thay đổi code sẽ chạy `check:fast` trên **đúng commit
được đẩy** (trong một git worktree tạm, không lẫn file đang sửa dở; bỏ qua: `git push --no-verify`); push chỉ có dữ liệu học, `inbox/` hay
tài liệu `*.md` đi thẳng. Test **golden parse** giữ nguyên cách đọc ngân hàng / file kết quả; đổi parser có
chủ đích → `GOLDEN_UPDATE=1 node --test tests/golden.test.ts` rồi xem `git diff`.

CI (GitHub Actions): workflow nằm sẵn ở `trainer/ci/trainer-ci.yml` (validate + typecheck + unit + e2e + UI smoke). Để bật: trên GitHub chọn
*Add file → Create new file*, đặt tên `.github/workflows/trainer-ci.yml`, dán nội dung file rồi Commit (không cần token đặc biệt); hoặc từ
máy: `gh auth refresh -s workflow` (token cần quyền **`workflow`**), chuyển file vào `.github/workflows/` rồi push.

## 🔒 Bảo mật

Server lắng nghe `127.0.0.1`; chỉ khi bật LAN mới mở thêm cổng trên mạng nội bộ, và mọi thiết bị khác phải có mã truy cập (so khớp thời gian
hằng, cookie HttpOnly SameSite=Strict chứa HMAC chứ không chứa mã). Mã và QR chỉ hiện trên máy chạy app, không bao giờ gửi cho thiết bị LAN hay
ghi vào log. Thiết bị LAN chỉ nhận bản giao diện đã đóng gói và API (không thấy mã nguồn / dev server); mã truy cập, cache và file ẩn
không bao giờ được phục vụ. Server từ chối Host lạ (chống DNS rebinding) và mọi POST thiếu header `X-Trainer` (trang web khác không thể kích hoạt AI).
Không gửi dữ liệu ra ngoài ngoại trừ nội dung Claude Code đọc khi bạn chạy AI (Ollama, AnkiConnect đều chạy trên máy bạn).

## ❓ Sự cố thường gặp

- **“Không tìm thấy Claude Code CLI”** → cài Claude Code (`curl -fsSL https://claude.ai/install.sh | bash` hoặc `npm i -g @anthropic-ai/claude-code`),
  chạy `claude` → `/login`; hoặc đặt `coach.claude_bin` trong `config.yaml` / biến `CLAUDE_BIN`.
- **“Failed to refresh OAuth token: another Claude Code process is refreshing it…”** → một phiên Claude Code khác (VS Code, terminal)
  đang làm mới đăng nhập cùng lúc. App tự thử lại 1 lần sau 60 giây (chỉ khi lượt chạy chưa kịp làm gì); vẫn lỗi thì đóng bớt
  các phiên Claude Code khác rồi chạy lại, hoặc mở terminal chạy `claude` → `/login`.
- **Cổng 3003 đang được dùng** → app đã chạy sẵn: mở http://localhost:3003, hoặc `lsof -ti tcp:3003 | xargs kill`.
- **Lịch không chạy** → `npm run schedule -- status`, xem `coach/runs/launchd.log`; kiểm tra `coach.hosts` có tên máy này không.
- **Đồng bộ lỗi 403 / Authentication failed** → token GitHub không có quyền ghi repo (xem hướng dẫn trong hộp thoại đồng bộ).
- **Câu hỏi AI sinh bị lỗi định dạng** → *Ngân hàng → Kiểm tra định dạng* chỉ rõ file:dòng; patch lỗi bị từ chối tự động.
- **Câu trùng theo nghĩa không chạy** → cài và mở Ollama, `ollama pull embeddinggemma`, rồi *Chất lượng → 👯 Câu trùng → ↻ Kiểm tra lại*.
- **Nút tối ưu FSRS báo chưa đủ dữ liệu** → cần ≥ `srs.optimize_min_reviews` lượt ôn (mặc định 400); trước đó app dùng tham số mặc định.
- **Lạ sau khi nâng cấp / dữ liệu hiển thị cũ** → tắt app, xoá thư mục `trainer/.cache/`, chạy lại (cache tự dựng lại).
- **Muốn xoá 1 kết quả** → xoá file `.md` tương ứng trong `results/` (thống kê tự tính lại).
