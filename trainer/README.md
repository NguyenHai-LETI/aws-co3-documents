# 🎓 SAA-C03 Trainer — hệ thống luyện thi AWS chạy local

Ứng dụng web chạy **hoàn toàn trên máy bạn** (`127.0.0.1`) để luyện câu hỏi trắc nghiệm AWS SAA-C03:

- **Ngân hàng câu hỏi = file Markdown** trong `bank/packs/` (đã import sẵn **745 câu** từ `practice-exams/` V1 + V2). Dễ mở rộng: tự viết, AI sinh từ tài liệu, hoặc AI Coach tự bổ sung.
- **Kết quả = file Markdown** trong `results/` (1 file/bài) — không database. Thống kê, lịch sử, lịch ôn đều tính lại từ các file này.
- **AI Coach** (Claude): phân tích kết quả → vá điểm yếu bằng câu biến thể/mở rộng → viết kế hoạch luyện tập. Chạy bằng **nút bấm**, **lịch tự động** vài lần/ngày, **Claude Cowork** hoặc **Claude Code**.

```
 ┌──────────── bank/packs/*.md ◄──────────────────────────────┐
 │   (câu hỏi + thời gian chuẩn)                               │ 3. bổ sung biến thể /
 ▼                                                             │    mở rộng, sửa câu lỗi
 Tạo bài test ──► Làm bài (đồng hồ) ──► results/*.md ──► coach/snapshot.md ──► AI Coach (Claude)
 (13 chế độ)        (chấm, giải thích)    (1 file/bài)      (số liệu tổng hợp)         │
 ▲                                                                                    │ 4. kế hoạch
 └──────────────── coach/plans/*.md  (các phiên luyện có nút “Bắt đầu”) ◄─────────────┘
```

---

## 🚀 Chạy nhanh

```bash
cd trainer
npm install        # lần đầu
npm start          # → http://localhost:3003
```

Yêu cầu: **Node.js ≥ 22.18** (chạy TypeScript trực tiếp, không cần build). AI Coach cần **Claude Code** đã đăng nhập —
app tự tìm CLI trong `PATH`, `~/.claude/local`, hoặc bản CLI đi kèm extension VS Code (máy này: đã tìm thấy).
Đổi cổng: `PORT=4000 npm start`.

## 🗂️ Cấu trúc

```
trainer/
├── bank/                     🗂️ NGÂN HÀNG CÂU HỎI (nguồn sự thật)
│   ├── SCHEMA.md             định dạng câu hỏi + rubric thời gian + chuẩn chất lượng
│   ├── taxonomy.yaml         domain (trọng số đề), topic (+ notes), service, tag
│   ├── issues.md             lỗi câu hỏi bạn báo từ màn hình kết quả
│   └── packs/{imported,ai,docs,manual}/*.md
├── results/YYYY/MM/*.md      📝 KẾT QUẢ — front matter (máy đọc) + báo cáo (người/AI đọc)
├── coach/                    🤖 AI COACH
│   ├── COACH.md · GENERATE.md   prompt chuẩn (dùng chung cho app, lịch, Cowork, Claude Code)
│   ├── snapshot.md           (tự sinh) số liệu tổng hợp cho AI
│   ├── learner-profile.md    (AI duy trì) trí nhớ dài hạn về người học
│   ├── plans/*.md            kế hoạch luyện tập
│   └── runs/                 log các lượt chạy (git-ignored)
├── inbox/                    📥 thả tài liệu (md/txt/pdf) để sinh câu hỏi
├── config.yaml               cấu hình coach (model, lịch chạy), SRS, số câu mặc định
├── server/ · shared/ · web/  code (Node + React/Vite)
└── scripts/                  import, validate, snapshot, coach-run, schedule
```

## ✍️ Các chế độ test

| Chế độ | Lấy câu nào |
|--------|-------------|
| 🎯 Thi thử SAA-C03 | 65 câu, phân bổ theo trọng số domain 30/26/24/20, ưu tiên câu lâu chưa gặp |
| 📚 Theo chủ đề | chọn 1+ chủ đề (+ domain, độ khó) |
| 📦 Theo bộ đề | làm lại nguyên 1 pack (V1, V2, pack AI, pack tài liệu) theo thứ tự gốc |
| 🧠 Ôn tập ngắt quãng | câu đến hạn theo Leitner (1 → 3 → 7 → 14 → 30 ngày) |
| 🔁 Làm lại câu sai | câu mà lần gần nhất trả lời sai |
| 💪 Củng cố điểm yếu | lấy mẫu có trọng số: topic/tag/service tỉ lệ thấp, câu sai, câu “chưa chắc” |
| 🆕 Câu chưa làm | tăng độ phủ ngân hàng |
| 🚩 Đánh dấu / chưa chắc | câu cắm cờ hoặc chọn “🤔 chưa chắc” lần gần nhất |
| 🐢 Luyện tốc độ | câu từng làm chậm > 1.5× thời gian chuẩn |
| ⚡ Luyện nhanh | 10 câu, xem đáp án ngay |
| 🛠️ Tùy chỉnh | lọc tự do: domain, chủ đề, độ khó, nguồn, service, tag, từ khoá |
| 🤖 Kế hoạch AI Coach | các phiên trong kế hoạch mới nhất (Dashboard / AI Coach) |
| 📌 Danh sách chọn sẵn | chọn tay trong Ngân hàng, hoặc “Làm lại N câu sai” ở màn hình kết quả |

Mỗi chế độ chọn được: **chấm cuối bài** (như thi thật) hoặc **xem đáp án ngay**, xáo thứ tự đáp án, và preset thời gian.

## ⏱ Đồng hồ & thời gian chuẩn

Mỗi câu có `time` (giây) theo rubric chuẩn SAA-C03 (130 phút/65 câu ≈ 120 s cho câu dài ~170 từ; câu ngắn ít hơn) —
xem `bank/SCHEMA.md §4`. **Đồng hồ bài test = Σ time các câu × hệ số preset**: Chuẩn ×1.0 · Áp lực ×0.8 ·
ESL +30′ ×1.23 · Thoải mái ×1.5 · Chuẩn đề thật (2 phút/câu) · Tự nhập · Không giới hạn.
Hết giờ → tự nộp. Thanh trên cùng cho biết bạn đang **nhanh/chậm so với chuẩn**; mỗi câu ghi lại thời gian làm.
Bài làm dở được lưu trong trình duyệt → đóng tab vẫn làm tiếp được (chế độ thi thử không cho tạm dừng).

Phím tắt: `1`–`5`/`A`–`E` chọn · `←` `→` chuyển câu · `Enter` tiếp/kiểm tra · `F` cắm cờ · `U` chưa chắc.

## 📝 Kết quả, lịch sử, thống kê

- Nộp bài → `results/YYYY/MM/<ngày>_<giờ>_<chế-độ>.md`: front matter chứa từng câu (`pick`, `key`, `ok`, thời gian, cờ)
  + báo cáo Markdown (điểm, theo domain/chủ đề, bảng từng câu, câu sai kèm giải thích).
- **Màn hình kết quả**: điểm %, quy đổi /1000, đạt/chưa đạt (72%), xem lại từng câu + giải thích + link tài liệu,
  lọc câu sai/cờ/chậm, “🔁 Làm lại câu sai”, “🐞 Báo lỗi câu hỏi” (ghi vào `bank/issues.md` cho AI Coach).
- **Lịch sử**: mọi bài, biểu đồ điểm theo thời gian.
- **Thống kê**: mức sẵn sàng thi (trọng số domain), tỉ lệ đúng theo domain/chủ đề/service/khái niệm, tốc độ,
  phân bố Leitner, lịch hoạt động, câu sai nhiều nhất — bấm vào là tạo bài luyện đúng chỗ đó.

## 🤖 AI Coach

Quy trình chuẩn nằm ở `coach/COACH.md` (phân tích) và `coach/GENERATE.md` (sinh từ tài liệu). Mỗi lượt phân tích:
đọc `snapshot.md` → phân loại điểm yếu (lỗ hổng kiến thức, nhầm cặp service, đọc sai qualifier, chưa chắc, tốc độ) →
**sửa câu bị báo lỗi** → **làm giàu giải thích** câu đang sai → **sinh pack câu mới** (biến thể `variant_of`, câu contrast,
câu mở rộng) → chạy validator → **viết kế hoạch** `coach/plans/*.md` (2–5 phiên, mỗi phiên có nút Bắt đầu) →
cập nhật `learner-profile.md`.

| Cách chạy | Lệnh / thao tác |
|-----------|-----------------|
| Nút **🔍 Phân tích ngay** | trang AI Coach — log hiển thị realtime, có nút dừng |
| Tự động vài lần/ngày (macOS) | `npm run schedule -- install` (giờ trong `config.yaml → coach.schedule`; `status`, `run`, `uninstall`) |
| Chạy tay từ terminal | `npm run coach` (bỏ qua nếu không có dữ liệu mới) · `npm run coach -- --force` |
| Sinh câu từ tài liệu | tab ✨ trong AI Coach · `npm run coach -- --generate --sources 03-database-services.md --count 15 --focus "RDS Proxy"` |
| Claude Cowork | chọn thư mục repo, dán prompt từ nút **📋 Prompt cho Claude Cowork** (hoặc “Thực hiện quy trình trong trainer/coach/COACH.md”). Định kỳ: thanh bên **Scheduled → New task → Set up manually** → chọn tần suất + thư mục repo + dán prompt (task dùng file local chỉ chạy khi máy bật, Claude Desktop mở) |
| Claude Code | `/trainer-coach` · `/trainer-generate <tham số>` (skill trong `.claude/skills/`) |

**Quyền của AI khi chạy từ app/lịch** (`claude -p --permission-mode dontAsk`): chỉ đọc file **trong repo** (đọc ngoài repo bị chặn);
**chỉ ghi** trong `trainer/bank/**` và `trainer/coach/**`; Bash chỉ chạy được `node trainer/scripts/validate.ts|snapshot.ts`
(và các lệnh chỉ-đọc có sẵn của Claude Code như `ls`). Không bao giờ sửa `results/`. Mọi thứ AI ghi đều là Markdown → xem/diff/revert bằng git.
Coach dùng **đăng nhập claude.ai** của Claude Code (gói subscription); nếu môi trường có `ANTHROPIC_API_KEY`, app bỏ biến này khi gọi coach
để không bị tính phí API ngoài ý muốn (đổi bằng `coach.use_api_key: true` trong `config.yaml`).
Nút “Phân tích ngay” dùng Claude Code CLI vì Cowork không có cách kích hoạt task từ ứng dụng khác.

## ➕ Mở rộng ngân hàng câu hỏi

1. **Tự viết**: tạo file trong `bank/packs/manual/` theo `bank/SCHEMA.md` (có ví dụ đầy đủ), chạy `npm run validate`.
2. **Từ tài liệu**: thả file vào `inbox/` (hoặc chọn notes có sẵn) → AI Coach → ✨ Sinh câu hỏi.
3. **AI Coach tự bổ sung** sau mỗi lần phân tích (`bank/packs/ai/`).
4. Import lại đề gốc (chỉ khi cần): `npm run import` (không ghi đè pack đã có trừ khi `-- --force`).

App tự nạp lại khi file thay đổi. Câu lỗi định dạng bị loại khỏi test và hiện ở *Ngân hàng → Kiểm tra định dạng*.

## 🧰 Lệnh

| Lệnh | Việc |
|------|------|
| `npm start` | chạy app (http://localhost:3003) |
| `npm run dev` | như start + tự khởi động lại server khi sửa code server |
| `npm run validate [-- <file> --warnings --fill-time]` | kiểm tra định dạng ngân hàng / tự điền thời gian |
| `npm run snapshot` | cập nhật `coach/snapshot.md` |
| `npm run coach [-- --force | --generate …]` | chạy AI Coach 1 lần |
| `npm run schedule -- install|status|run|uninstall` | lịch chạy coach (launchd) |
| `npm run import` | import lại `practice-exams/` |
| `npm run typecheck` · `npm test` | kiểm tra kiểu TypeScript · unit test |

## 🔒 Bảo mật

Server chỉ lắng nghe `127.0.0.1`, từ chối Host lạ (chống DNS rebinding) và mọi POST thiếu header `X-Trainer`
(trang web khác không thể kích hoạt AI Coach). Không gửi dữ liệu ra ngoài ngoại trừ nội dung Claude Code đọc khi bạn chạy coach.

## ❓ Sự cố thường gặp

- **“Không tìm thấy Claude Code CLI”** → cài `npm i -g @anthropic-ai/claude-code` rồi chạy `claude` để đăng nhập, hoặc đặt
  `coach.claude_bin` trong `config.yaml` / biến `CLAUDE_BIN`.
- **Lịch không chạy** → `npm run schedule -- status`, xem `coach/runs/launchd.log` (máy phải bật; launchd chạy bù khi máy thức).
- **Câu hỏi AI sinh bị lỗi định dạng** → *Ngân hàng → Kiểm tra định dạng* chỉ rõ file:dòng; sửa tay hoặc chạy lại coach.
- **Muốn xoá 1 kết quả** → xoá file `.md` tương ứng trong `results/` (thống kê tự tính lại).
