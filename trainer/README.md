# 🎓 SAA-C03 Trainer — hệ thống luyện thi AWS chạy local

Ứng dụng web chạy **hoàn toàn trên máy bạn** (`127.0.0.1`) để luyện câu hỏi trắc nghiệm AWS SAA-C03:

- **Ngân hàng câu hỏi = file Markdown** trong `bank/packs/` (đã import **745 câu** từ `practice-exams/` V1 + V2, đã cân lại vị trí đáp án đúng,
  gắn mục exam guide 1.1–4.4). Mở rộng: tự viết, AI sinh từ tài liệu, AI Coach tự bổ sung, AI bảo trì dần (ENRICH).
- **Kết quả = file Markdown** trong `results/` (1 file/bài) — không database. Thống kê, lịch sử, lịch ôn FSRS đều tính lại từ các file này.
- **AI Coach** (Claude Code): phân tích kết quả → vá điểm yếu bằng câu biến thể/mở rộng → kế hoạch luyện tập; **ENRICH** làm giàu giải thích,
  gợi ý, phân loại, cân độ dài đáp án, sinh câu dài chuẩn đề thật; **Hỏi AI** về từng câu. Chạy bằng nút bấm, lịch tự động, Cowork hoặc Claude Code.

```
 ┌──────────── bank/packs/*.md ◄─────────────────────────────────────────────┐
 │   (câu hỏi + thời gian chuẩn + task + gợi ý)                               │ bổ sung biến thể / câu dài,
 ▼                                                                            │ sửa câu lỗi, làm giàu giải thích
 Tạo bài test ──► Làm bài (đồng hồ) ──► results/*.md ──► coach/snapshot.md ──► AI Coach · ENRICH (Claude)
 (13 chế độ + Pearson)  (gạch đáp án, tô từ khoá,   (1 file/bài)    (số liệu tổng hợp)        │
 ▲                       nhớ trước, gợi ý, "vì sao")                                          │ kế hoạch
 └──────────────── coach/plans/*.md  (các phiên luyện có nút “Bắt đầu”) ◄─────────────────────┘
```

---

## 🚀 Chạy nhanh

```bash
cd trainer
npm install        # lần đầu
npm start          # → http://localhost:3003   (OPEN=1 npm start: tự mở trình duyệt)
```

Hoặc **double-click** `trainer/start.command` (macOS) · `trainer/start.bat` (Windows) · `sh trainer/start.sh` (Linux):
tự `npm install` lần đầu, chạy server và mở trình duyệt.

Yêu cầu: **Node.js ≥ 22.18** (chạy TypeScript trực tiếp, không cần build). AI cần **Claude Code** đã đăng nhập —
app tự tìm CLI trong `PATH`, `~/.local/bin`, `~/.claude/local`, hoặc bản CLI đi kèm extension VS Code (macOS/Linux/Windows).
Đổi cổng: `PORT=4000 npm start`.

## 🗂️ Cấu trúc

```
trainer/
├── bank/                     🗂️ NGÂN HÀNG CÂU HỎI (nguồn sự thật)
│   ├── SCHEMA.md             định dạng câu hỏi + rubric thời gian + chuẩn chất lượng + định dạng patch
│   ├── taxonomy.yaml         domain (trọng số đề), task exam guide 1.1–4.4, topic, service, tag, từ khoá tô sáng
│   ├── issues.md · ratings.md   lỗi câu hỏi bạn báo · đánh giá 👍/👎
│   ├── migrations/           lịch sử migration (vd cân lại vị trí đáp án)
│   └── packs/{imported,ai,docs,manual}/*.md
├── results/YYYY/MM/*.md      📝 KẾT QUẢ — front matter (máy đọc) + báo cáo (người/AI đọc)
├── coach/                    🤖 AI
│   ├── COACH.md · GENERATE.md · ENRICH.md   prompt chuẩn (dùng chung cho app, lịch, Cowork, Claude Code)
│   ├── snapshot.md           (tự sinh, git-ignored) số liệu tổng hợp cho AI
│   ├── learner-profile.md    (AI duy trì) trí nhớ dài hạn về người học
│   ├── plans/ · patches/ · enrich/ · qa/   kế hoạch · patch AI đã áp · lô ENRICH · hỏi đáp “Hỏi AI”
│   └── runs/                 log các lượt chạy (git-ignored)
├── inbox/                    📥 thả tài liệu (md/txt/pdf) để sinh câu hỏi
├── config.yaml               model theo tác vụ, lịch, FSRS, thống kê, đồng bộ
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
| 🧠 Ôn tập ngắt quãng | câu đến hạn theo **FSRS** (ưu tiên câu sắp quên nhất), tối đa `srs.daily_limit` câu/ngày, phần dư thành “tồn” |
| 🔁 Làm lại câu sai | câu mà lần gần nhất trả lời sai |
| 💪 Củng cố điểm yếu | lấy mẫu có trọng số: topic/tag/service tỉ lệ thấp, câu sai, câu “chưa chắc” |
| 🆕 Câu chưa làm · 🚩 Cờ/chưa chắc · 🐢 Tốc độ · ⚡ Luyện nhanh | như tên |
| 🛠️ Tùy chỉnh | lọc tự do: domain, **mục exam guide**, chủ đề, độ khó, nguồn, service, tag, từ khoá |
| 🤖 Kế hoạch AI Coach · 📌 Danh sách | phiên của coach · danh sách chọn tay / “làm lại N câu sai” |

Tuỳ chọn mọi chế độ: **chấm cuối bài** hoặc **xem đáp án ngay** · **xáo đáp án (mặc định bật)** · preset thời gian ·
**🧠 Nhớ trước khi xem đáp án** (viết đáp án mình nghĩ trước, rồi mới hiện lựa chọn).

Khi làm bài: **gạch loại đáp án** (nút ✕, chuột phải hoặc `Shift`+số) · **🖍 tô từ khoá** qualifier (MOST cost-effective, LEAST operational
overhead, highly available…) · **💡 gợi ý** (chế độ xem đáp án ngay) · ô **“Vì sao bạn chọn?”** khi sai · 🚩 cờ · 🤔 chưa chắc.

## ⏱ Đồng hồ & thời gian chuẩn

Mỗi câu có `time` (giây) theo rubric chuẩn SAA-C03 (130 phút/65 câu ≈ 120 s cho câu dài ~170 từ; câu ngắn ít hơn) —
xem `bank/SCHEMA.md §4`. **Đồng hồ = Σ time các câu × hệ số preset** (Chuẩn ×1.0 · Áp lực ×0.8 · ESL +30′ · Thoải mái ×1.5 ·
Chuẩn đề thật 2′/câu · Tự nhập · Không giới hạn). Hết giờ → tự nộp; cảnh báo khi còn 15′ và 5′; thanh trên cho biết nhanh/chậm so với chuẩn.

Phím tắt: `1`–`5`/`A`–`E` chọn · `Shift`+số gạch · `←` `→` chuyển câu · `Enter` tiếp/kiểm tra · `F` cờ · `U` chưa chắc · `H` gợi ý.

## 📝 Kết quả, lịch sử, thống kê

- Nộp bài → `results/YYYY/MM/<ngày>_<giờ>_<chế-độ>.md` (đáp án chọn, đáp án gạch, câu “nhớ trước”, gợi ý đã xem, lý do chọn, câu thử nghiệm…).
- **Màn hình kết quả**: điểm, quy đổi /1000, đạt/chưa đạt, xem lại từng câu + giải thích + link tài liệu; **ghi “vì sao chọn”** cho câu sai
  (AI Coach đọc để chẩn đoán hiểu nhầm); 👍/👎 chất lượng câu; **🤖 Hỏi AI** về câu đó; 🐞 báo lỗi; sức bền theo phần tư (thi thử).
- **Thống kê**: **mức sẵn sàng v2** (giảm dần theo thời gian, trọng số độ khó/câu dài, khoảng tin cậy 90 %, **xác suất đỗ**) ·
  theo domain / **mục exam guide** / chủ đề / service / khái niệm · độ bền trí nhớ (FSRS) · hiệu chỉnh độ tự tin (chắc vs chưa chắc) ·
  số lần **gạch nhầm đáp án đúng** · tỉ lệ “nhớ trước” đúng · câu dài vs câu ngắn · tốc độ · hoạt động.
- **Bài làm vội** (thời gian trung vị/câu < `stats.rushed_median_seconds`) được đánh dấu và **không tính** vào thống kê/lịch ôn.

## 🗂️ Ngân hàng & chất lượng

Trang **Ngân hàng → 📐 Chất lượng**: phân bố vị trí đáp án đúng, tỉ lệ “đáp án đúng dài nhất”, độ dài đề, số câu dài chuẩn thi thật,
giải thích ngắn, gợi ý, mục exam guide, câu gần trùng, câu bị đánh giá thấp, hiệu quả của câu biến thể, tiến độ ENRICH.

Migration đã áp cho bộ đề gốc: `npm run rebalance` (cân vị trí đáp án — kết quả cũ được tự chuyển đổi theo `bank/migrations/`) và
`npm run classify-tasks` (gắn mục exam guide theo heuristic; AI tinh chỉnh dần qua ENRICH).

## 🤖 AI Coach · ENRICH · Hỏi AI

| Tác vụ | Làm gì | Prompt |
|--------|--------|--------|
| **Phân tích** (🔍 Phân tích ngay) | đọc snapshot (gồm lý do chọn sai, đáp án gạch nhầm, câu hỏi AI, đánh giá 👎, câu trùng) → sửa issue → sinh câu biến thể/contrast/mở rộng → kế hoạch → hồ sơ người học | `coach/COACH.md` |
| **ENRICH** (🧹 bảo trì ngân hàng) | theo lô N câu: giải thích EN theo nội dung từng đáp án + tóm tắt 🇻🇳, gợi ý, phân loại domain/task/tag, cân độ dài đáp án — AI ghi **patch YAML**, `apply-patch` kiểm tra rồi mới áp | `coach/ENRICH.md` |
| **Câu dài** (long-form) | sinh phiên bản đề dài chuẩn thi thật (60–120 từ) cho khái niệm cốt lõi | `coach/ENRICH.md` |
| **Sinh từ tài liệu** | đọc notes/inbox → pack mới trong `packs/docs/` | `coach/GENERATE.md` |
| **Hỏi AI** | hỏi tiếp về 1 câu (“vì sao không phải C?”) — chỉ đọc, lưu vào `coach/qa/<id>.md` | — |

| Cách chạy | Lệnh / thao tác |
|-----------|-----------------|
| Nút trong app | AI Coach (Phân tích, ✨ Sinh câu, 🧹 ENRICH, câu dài) · Ngân hàng → Chất lượng · Hỏi AI ở kết quả/ngân hàng |
| Lịch tự động (macOS/Linux/Windows) | `npm run schedule -- install` (giờ trong `config.yaml → coach.schedule`; `status`, `run`, `uninstall`). Không có dữ liệu mới → chạy 1 lô ENRICH thay vì phân tích (`coach.enrich_on_idle`) |
| Terminal | `npm run coach` · `-- --force` · `-- --enrich --size 20 --batches 3` · `-- --longform --count 5` · `-- --generate --sources 03-database-services.md --count 15` |
| Claude Cowork | dán prompt từ nút **📋 Prompt cho Claude Cowork**; định kỳ: **Scheduled → New task → Set up manually** (task dùng file local chỉ chạy khi máy bật, Claude Desktop mở) |
| Claude Code | `/trainer-coach` · `/trainer-generate <tham số>` · `/trainer-enrich` |

**Model & chi phí**: `config.yaml → coach.models` chọn model theo tác vụ (mặc định sonnet cho sinh câu/ENRICH/Hỏi AI); trang AI Coach hiển thị
số lượt và chi phí quy đổi 30 ngày. **Quyền của AI** (`--permission-mode dontAsk`): chỉ đọc file trong repo; chỉ ghi `trainer/bank/**`,
`trainer/coach/**`; Bash chỉ chạy `validate.ts`, `snapshot.ts`, `apply-patch.ts`. Không bao giờ sửa `results/`. Coach dùng đăng nhập
claude.ai (bỏ `ANTHROPIC_API_KEY` trừ khi `coach.use_api_key: true`). Nút bấm dùng Claude Code CLI vì Cowork không thể kích hoạt từ app khác.

## 🔄 Dùng trên 2 máy

- Nút **⇅ Đồng bộ** (góc dưới thanh bên) hoặc `npm run sync`: commit `trainer/results`, `trainer/coach`, `trainer/bank` → `pull --rebase` → `push`
  (cần quyền push vào repo; lỗi xác thực có hướng dẫn). Chỉ commit 3 thư mục dữ liệu; không bao giờ hỏi mật khẩu (thiếu đăng nhập → báo lỗi ngay);
  conflict → huỷ rebase, dữ liệu máy này vẫn nằm trong commit cục bộ. Nút pill: ↑ commit chưa đẩy · ↓ commit mới trên remote · ● file dữ liệu chưa commit.
- **AI Coach tự đồng bộ** (`config.yaml → sync.before_ai`, `sync.after_ai`, mặc định bật): mỗi lượt phân tích / sinh câu / ENRICH / câu dài
  đồng bộ **trước** khi gọi Claude (AI thấy cả bài làm của máy kia; ENRICH / câu dài chọn lại lô câu nếu vừa nhận dữ liệu từ máy kia) và **sau** lượt chạy thành công
  (kế hoạch, câu mới, patch lên GitHub ngay). Lịch tự động đồng bộ trước khi xét "có bài mới không". Đồng bộ lỗi chỉ ghi cảnh báo vào log —
  AI vẫn chạy với dữ liệu trên máy. "Hỏi AI" không đồng bộ (chỉ đọc câu hỏi).
- `config.yaml → coach.hosts: ["<tên-máy>"]` để **chỉ một máy** chạy coach theo lịch (tránh conflict). `issues.md`, `ratings.md`, `coach/qa/*`
  dùng `merge=union` (`.gitattributes`) nên ghi song song không conflict.

## ➕ Mở rộng ngân hàng câu hỏi

1. **Tự viết**: tạo file trong `bank/packs/manual/` theo `bank/SCHEMA.md`, chạy `npm run validate`.
2. **Từ tài liệu**: thả file vào `inbox/` (hoặc chọn notes có sẵn) → AI Coach → ✨ Sinh câu hỏi.
3. **AI Coach / ENRICH** tự bổ sung và làm giàu dần (`bank/packs/ai/`, patch trong `coach/patches/`).

App tự nạp lại khi file thay đổi. Câu lỗi định dạng bị loại khỏi test và hiện ở *Ngân hàng → Kiểm tra định dạng*.

## 🧰 Lệnh

| Lệnh | Việc |
|------|------|
| `npm start` · `npm run dev` | chạy app · tự khởi động lại server khi sửa code |
| `npm run validate [-- <file> --warnings --fill-time]` | kiểm tra ngân hàng / tự điền thời gian |
| `npm run rebalance [-- --apply]` · `npm run classify-tasks [-- --apply]` | migration: cân vị trí đáp án · gắn mục exam guide |
| `npm run apply-patch -- <patch.yaml> [--dry-run]` · `npm run enrich-batch [-- --status | --longform]` | áp patch AI · xem lô ENRICH kế tiếp / tiến độ / ứng viên câu dài |
| `npm run snapshot` | cập nhật `coach/snapshot.md` |
| `npm run coach [-- …]` | chạy AI 1 lần (xem bảng trên) |
| `npm run schedule -- install|status|run|uninstall` | lịch chạy tự động (launchd / crontab / Task Scheduler) |
| `npm run sync [-- --dry-run | --status | --force]` | đồng bộ dữ liệu học qua git (xem trước · trạng thái · chạy cả khi coach đang chạy) |
| `npm run typecheck` · `npm test` · `npm run test:e2e` · `npm run test:ui` | kiểm tra kiểu · unit · e2e API · UI smoke (Playwright) |

CI (GitHub Actions): workflow nằm sẵn ở `trainer/ci/trainer-ci.yml` (validate + typecheck + unit + e2e + UI smoke). Để bật: chuyển file vào
`.github/workflows/trainer-ci.yml` rồi push — token GitHub cần quyền **`workflow`** (GitHub từ chối token chỉ có quyền `repo`).

## 🔒 Bảo mật

Server chỉ lắng nghe `127.0.0.1`, từ chối Host lạ (chống DNS rebinding) và mọi POST thiếu header `X-Trainer`
(trang web khác không thể kích hoạt AI). Không gửi dữ liệu ra ngoài ngoại trừ nội dung Claude Code đọc khi bạn chạy AI.

## ❓ Sự cố thường gặp

- **“Không tìm thấy Claude Code CLI”** → cài Claude Code (`curl -fsSL https://claude.ai/install.sh | bash` hoặc `npm i -g @anthropic-ai/claude-code`),
  chạy `claude` → `/login`; hoặc đặt `coach.claude_bin` trong `config.yaml` / biến `CLAUDE_BIN`.
- **Cổng 3003 đang được dùng** → app đã chạy sẵn: mở http://localhost:3003, hoặc `lsof -ti tcp:3003 | xargs kill`.
- **Lịch không chạy** → `npm run schedule -- status`, xem `coach/runs/launchd.log`; kiểm tra `coach.hosts` có tên máy này không.
- **Đồng bộ lỗi 403 / Authentication failed** → token GitHub không có quyền ghi repo (xem hướng dẫn trong hộp thoại đồng bộ).
- **Câu hỏi AI sinh bị lỗi định dạng** → *Ngân hàng → Kiểm tra định dạng* chỉ rõ file:dòng; patch lỗi bị từ chối tự động.
- **Muốn xoá 1 kết quả** → xoá file `.md` tương ứng trong `results/` (thống kê tự tính lại).
