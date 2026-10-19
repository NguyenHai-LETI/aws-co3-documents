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
│   ├── goal.md · external/*.md   ngày thi + điểm mục tiêu · điểm thi thử bên ngoài
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
└── tests/                    unit · e2e API · UI smoke (Playwright)
```

## ✍️ Các chế độ test

| Chế độ | Lấy câu nào |
|--------|-------------|
| 🎯 Thi thử SAA-C03 | 65 câu theo trọng số domain 30/26/24/20, ưu tiên câu lâu chưa gặp và câu dài. **Mô phỏng Pearson VUE**: 15 câu thử nghiệm không tính điểm (chỉ lộ sau khi nộp), màn hình Review cuối bài, không tạm dừng, 130 phút, cảnh báo 15′/5′, phân tích sức bền theo từng phần tư |
| 📚 Theo chủ đề | chọn 1+ chủ đề (+ domain, độ khó) |
| 📦 Theo bộ đề | làm lại nguyên 1 pack |
| 🧠 Ôn tập ngắt quãng | câu đến hạn theo **FSRS-6** (ưu tiên câu sắp quên nhất), tối đa `srs.daily_limit` câu/ngày, phần dư thành “tồn” |
| 🔁 Làm lại câu sai | câu mà lần gần nhất trả lời sai |
| 💪 Củng cố điểm yếu | lấy mẫu có trọng số: topic/tag/service tỉ lệ thấp, câu sai, câu “chưa chắc” |
| 🆕 Câu chưa làm · 🚩 Cờ/chưa chắc · 🐢 Tốc độ · ⚡ Luyện nhanh | như tên |
| 🛠️ Tùy chỉnh | lọc tự do: domain, **mục exam guide**, chủ đề, độ khó, nguồn, service, tag, từ khoá |
| 🤖 Kế hoạch AI Coach · 📌 Danh sách | phiên của coach · danh sách chọn tay / “làm lại N câu sai” (câu đang chờ duyệt — draft — luôn bị bỏ qua) |

Tuỳ chọn mọi chế độ: **chấm cuối bài** hoặc **xem đáp án ngay** · **xáo đáp án (mặc định bật)** · preset thời gian ·
**🧠 Nhớ trước khi xem đáp án** (viết đáp án mình nghĩ trước, rồi mới hiện lựa chọn).

Khi làm bài: **gạch loại đáp án** (nút ✕, chuột phải hoặc `Shift`+số) · **🖍 tô từ khoá** qualifier (MOST cost-effective, LEAST operational
overhead, highly available…) · **💡 gợi ý** (chế độ xem đáp án ngay) · ô **“Vì sao bạn chọn?”** khi sai · 🚩 cờ · 🤔 chưa chắc.

## ⏱ Đồng hồ & thời gian chuẩn

Mỗi câu có `time` (giây) theo rubric chuẩn SAA-C03 (130 phút/65 câu ≈ 120 s cho câu dài ~170 từ; câu ngắn ít hơn) —
xem `bank/SCHEMA.md §4`. **Đồng hồ = Σ time các câu × hệ số preset** (Chuẩn ×1.0 · Áp lực ×0.8 · ESL +30′ · Thoải mái ×1.5 ·
Chuẩn đề thật 2′/câu · Tự nhập · Không giới hạn). Hết giờ → tự nộp; cảnh báo khi còn 15′ và 5′; thanh trên cho biết nhanh/chậm so với chuẩn.

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

### 🎯 Ngày thi, dự báo & FSRS-6

- **Thống kê → 🎯 Ngày thi & dự báo**: đặt ngày thi + điểm mục tiêu (`results/goal.md`, đồng bộ cùng kết quả) → đếm ngược và **dự báo điểm
  đúng ngày thi** theo từng domain (trọng số 30/26/24/20): câu đã gặp = xác suất còn nhớ của FSRS-6 *nếu dừng học hôm nay* / *nếu ôn đúng
  lịch*; câu chưa gặp = tỉ lệ đúng lần đầu của bạn; kèm độ phủ ngân hàng và **📆 lịch ôn sắp tới** (số câu đến hạn mỗi ngày tới ngày thi).
  Trang Tổng quan có thẻ đếm ngược. Dự báo đo khả năng nhớ *câu trong ngân hàng* nên lạc quan hơn đề thật — dùng điểm thi thử bên ngoài để hiệu chỉnh.
- **📝 Điểm thi thử bên ngoài** (AWS Official Practice Exam, Tutorials Dojo…, lưu `results/external/`): app so với mức sẵn sàng của chính nó
  vào ngày đó → **mức sẵn sàng hiệu chỉnh** (độ lệch trung bình 5 lần gần nhất).
- **FSRS-6** (thư viện ts-fsrs, tính theo ngày: câu đến hạn từ đầu ngày). **⚙️ Tham số FSRS → 🎛️ Tối ưu tham số FSRS** học bộ tham số riêng
  từ lịch sử của bạn (tiến trình nền, cần ≥ `srs.optimize_min_reviews` lượt ôn; chỉ dùng khi dự đoán tốt hơn mặc định; lưu
  `results/fsrs-params.json`). `srs.optimize: auto` tự tối ưu lại tối đa 1 lần/tuần khi lịch sử tăng ≥ 20 % · `manual` · `off`;
  `srs.weights` để tự đặt 21 tham số. Bài làm vội và câu bỏ trống chưa xem không được dùng để tối ưu.

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

Khung chi tiết câu hỏi hiện lỗi viết câu và kết quả giải mù của câu đó. AI Coach đọc cả bốn phần này trong snapshot §14.
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
| **Hỏi AI** | hỏi tiếp về 1 câu (“vì sao không phải C?”) — chỉ đọc, lưu vào `coach/qa/<id>.md` | — |

**AI trả JSON, app tự kiểm tra** (`coach.structured_output: true`, mặc định): Sinh câu, ENRICH và Câu dài chạy Claude **chỉ đọc**
(`--tools Read,Glob,Grep`, `--json-schema`); app tự ghi patch `coach/patches/<run>.yaml` hoặc pack mới sau khi kiểm tra từng câu (định dạng,
task cùng domain, chữ cái đáp án trong giải thích, gợi ý lộ đáp án, “Choose N”, lint lỗi nặng). Câu lỗi được gửi lại **một lần** trong cùng
phiên (`--resume`) để AI sửa; còn lỗi thì bỏ qua và ghi log. Mọi patch (ENRICH, coach, `npm run apply-patch`) đều chạy lint sau từng item.
**Giải mù tự động** (`coach.verify.auto`): sau mỗi lượt AI có câu mới hoặc câu bị đổi đề/phương án/đáp án, model thứ hai giải các câu đó;
câu do AI viết bị **lệch đáp án / mơ hồ** tự chuyển `draft` (`coach.verify.auto_draft`) chờ bạn duyệt — câu đề gốc không bao giờ tự bị chuyển draft.
`/trainer-enrich`, `/trainer-generate` và Cowork vẫn dùng chế độ tương tác (AI tự ghi file).

| Cách chạy | Lệnh / thao tác |
|-----------|-----------------|
| Nút trong app | AI Coach (Phân tích, ✨ Sinh câu, 🧹 ENRICH, câu dài) · Ngân hàng → Chất lượng (lint, phương án nhiễu, giải mù) · Hỏi AI ở kết quả/ngân hàng |
| Lịch tự động (macOS/Linux/Windows) | `npm run schedule -- install` (giờ trong `config.yaml → coach.schedule`; `status`, `run`, `uninstall`). Không có dữ liệu mới → chạy 1 lô ENRICH thay vì phân tích (`coach.enrich_on_idle`) |
| Terminal | `npm run coach` · `-- --force` · `-- --enrich --size 20 --batches 3` · `-- --enrich --ids a,b --tasks distractors --note "…"` · `-- --longform --count 5` · `-- --generate --sources 03-database-services.md --count 15` · `-- --verify [--ids a,b \| --pack <id> \| --scope unverified-ai\|new\|changed]` |
| Claude Cowork | dán prompt từ nút **📋 Prompt cho Claude Cowork**; định kỳ: **Scheduled → New task → Set up manually** (task dùng file local chỉ chạy khi máy bật, Claude Desktop mở) |
| Claude Code | `/trainer-coach` · `/trainer-generate <tham số>` · `/trainer-enrich` |

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
- `config.yaml → coach.hosts: ["<tên-máy>"]` để **chỉ một máy** chạy coach theo lịch (tránh conflict). `issues.md`, `ratings.md`, `verify.md`,
  `coach/qa/*`, `results/fsrs-params.json` dùng `merge=union` (`.gitattributes`) nên ghi song song không conflict.

## ➕ Mở rộng ngân hàng câu hỏi

1. **Tự viết**: tạo file trong `bank/packs/manual/` theo `bank/SCHEMA.md`, chạy `npm run validate` (`-- --lint` để soát lỗi viết câu).
2. **Từ tài liệu**: thả file vào `inbox/` (hoặc chọn notes có sẵn) → AI Coach → ✨ Sinh câu hỏi.
3. **AI Coach / ENRICH** tự bổ sung và làm giàu dần (`bank/packs/ai/`, patch trong `coach/patches/`), mỗi câu mới được giải mù trước khi dùng.

App tự nạp lại khi file thay đổi. Câu lỗi định dạng bị loại khỏi test và hiện ở *Ngân hàng → Kiểm tra định dạng*.

## 🧰 Lệnh

| Lệnh | Việc |
|------|------|
| `npm start` · `npm run dev` | chạy app (`-- --lan`: mở cho điện thoại) · tự khởi động lại server khi sửa code |
| `npm run validate [-- <file> --warnings --fill-time --lint[=luật] --json]` | kiểm tra ngân hàng / tự điền thời gian / lint lỗi viết câu |
| `npm run rebalance [-- --apply]` · `npm run classify-tasks [-- --apply]` | migration: cân vị trí đáp án · gắn mục exam guide |
| `npm run apply-patch -- <patch.yaml> [--dry-run]` · `npm run enrich-batch [-- --status \| --longform \| --ids a,b --tasks distractors]` | áp patch AI · xem lô ENRICH kế tiếp / tiến độ / ứng viên câu dài |
| `npm run snapshot` | cập nhật `coach/snapshot.md` |
| `npm run coach [-- …]` | chạy AI 1 lần (xem bảng trên, gồm `--verify`) |
| `npm run schedule -- install\|status\|run\|uninstall` | lịch chạy tự động (launchd / crontab / Task Scheduler) |
| `npm run sync [-- --dry-run \| --status \| --force]` | đồng bộ dữ liệu học qua git (xem trước · trạng thái · chạy cả khi coach đang chạy) |
| `npm run typecheck` · `npm test` · `npm run test:e2e` · `npm run test:ui` | kiểm tra kiểu · unit · e2e API · UI smoke (Playwright) |

CI (GitHub Actions): workflow nằm sẵn ở `trainer/ci/trainer-ci.yml` (validate + typecheck + unit + e2e + UI smoke). Để bật: chuyển file vào
`.github/workflows/trainer-ci.yml` rồi push — token GitHub cần quyền **`workflow`** (GitHub từ chối token chỉ có quyền `repo`).

## 🔒 Bảo mật

Server lắng nghe `127.0.0.1`; chỉ khi bật LAN mới mở thêm cổng trên mạng nội bộ, và mọi thiết bị khác phải có mã truy cập (so khớp thời gian
hằng, cookie HttpOnly SameSite=Strict chứa HMAC chứ không chứa mã). Mã và QR chỉ hiện trên máy chạy app, không bao giờ gửi cho thiết bị LAN hay
ghi vào log. Thiết bị LAN chỉ nhận bản giao diện đã đóng gói và API (không thấy mã nguồn / dev server); mã truy cập, cache và file ẩn
không bao giờ được phục vụ. Server từ chối Host lạ (chống DNS rebinding) và mọi POST thiếu header `X-Trainer` (trang web khác không thể kích hoạt AI).
Không gửi dữ liệu ra ngoài ngoại trừ nội dung Claude Code đọc khi bạn chạy AI (Ollama, AnkiConnect đều chạy trên máy bạn).

## ❓ Sự cố thường gặp

- **“Không tìm thấy Claude Code CLI”** → cài Claude Code (`curl -fsSL https://claude.ai/install.sh | bash` hoặc `npm i -g @anthropic-ai/claude-code`),
  chạy `claude` → `/login`; hoặc đặt `coach.claude_bin` trong `config.yaml` / biến `CLAUDE_BIN`.
- **Cổng 3003 đang được dùng** → app đã chạy sẵn: mở http://localhost:3003, hoặc `lsof -ti tcp:3003 | xargs kill`.
- **Lịch không chạy** → `npm run schedule -- status`, xem `coach/runs/launchd.log`; kiểm tra `coach.hosts` có tên máy này không.
- **Đồng bộ lỗi 403 / Authentication failed** → token GitHub không có quyền ghi repo (xem hướng dẫn trong hộp thoại đồng bộ).
- **Câu hỏi AI sinh bị lỗi định dạng** → *Ngân hàng → Kiểm tra định dạng* chỉ rõ file:dòng; patch lỗi bị từ chối tự động.
- **Câu trùng theo nghĩa không chạy** → cài và mở Ollama, `ollama pull embeddinggemma`, rồi *Chất lượng → 👯 Câu trùng → ↻ Kiểm tra lại*.
- **Nút tối ưu FSRS báo chưa đủ dữ liệu** → cần ≥ `srs.optimize_min_reviews` lượt ôn (mặc định 400); trước đó app dùng tham số mặc định.
- **Lạ sau khi nâng cấp / dữ liệu hiển thị cũ** → tắt app, xoá thư mục `trainer/.cache/`, chạy lại (cache tự dựng lại).
- **Muốn xoá 1 kết quả** → xoá file `.md` tương ứng trong `results/` (thống kê tự tính lại).
