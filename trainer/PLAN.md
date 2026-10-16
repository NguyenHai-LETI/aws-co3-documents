# 🗺️ SAA-C03 Trainer — Kế hoạch triển khai & đề xuất tính năng

> Tài liệu thiết kế cho hệ thống luyện thi chạy local trong `trainer/`. Hướng dẫn sử dụng: [README.md](README.md).
> Định dạng câu hỏi: [bank/SCHEMA.md](bank/SCHEMA.md). Quy trình AI: [coach/COACH.md](coach/COACH.md), [coach/GENERATE.md](coach/GENERATE.md).

---

## 1. Yêu cầu & nguyên tắc thiết kế

| # | Yêu cầu | Đáp ứng bằng |
|---|---------|--------------|
| R1 | Giao diện trực quan luyện trắc nghiệm AWS, chạy local | Web app React + Node, bind `127.0.0.1:3003` |
| R2 | Ngân hàng câu hỏi trong thư mục, cấu trúc rõ, dễ mở rộng (AI / từ tài liệu) | `bank/packs/**/*.md` theo `SCHEMA.md`, validator, `taxonomy.yaml`, inbox + GENERATE |
| R3 | Kết quả lưu `.md` trong project, không DB | `results/YYYY/MM/*.md` (front matter + báo cáo) — mọi thống kê tính lại từ file |
| R4 | AI agent chạy định kỳ + nút “phân tích ngay” → kế hoạch + câu cần làm lại (giống hệt / tương tự / trộn / mở rộng) + tự cập nhật ngân hàng | `coach/COACH.md` + runner `claude -p` + launchd + Cowork/Claude Code; pack AI, `variant_of`, plan sessions |
| R5 | Nhiều chế độ test | 13 chế độ (§5) |
| R6 | Timer theo thời gian dự kiến từng câu (chuẩn SAA-C03) | `time` mỗi câu theo rubric; đồng hồ = Σ time × preset |
| R7 | Xem kết quả + giải thích ngắn sau khi làm | Màn hình kết quả, giải thích Markdown, link notes |
| R8 | Lịch sử + thống kê | Trang Lịch sử, Thống kê, Dashboard |

**Nguyên tắc**

1. **Markdown-first, git-friendly** — dữ liệu là file text: đọc được bằng mắt, diff/revert bằng git, AI đọc/ghi trực tiếp.
2. **Không trạng thái ẩn** — thống kê, lịch ôn (Leitner), pool “câu sai” đều tính lại từ `results/`; xoá file = xoá dữ liệu.
3. **Một hợp đồng cho mọi agent** — `SCHEMA.md` + `COACH.md` + `GENERATE.md` dùng chung cho nút bấm, lịch tự động, Cowork, Claude Code.
4. **Kiểm tra mọi thứ AI ghi** — parser nghiêm ngặt + validator; câu lỗi tự bị loại khỏi test và hiện ở “Kiểm tra định dạng”.
5. **Quyền tối thiểu cho agent** — chỉ ghi `trainer/bank/**`, `trainer/coach/**`; Bash chỉ chạy validator/snapshot.
6. **Ít phụ thuộc, không build** — Node ≥ 22.18 chạy TypeScript trực tiếp; 7 dependency runtime.

## 2. Kiến trúc

```
┌──────────────────────── Trình duyệt (React SPA, Vite middleware) ────────────────────────┐
│ Tổng quan · Tạo test · Làm bài (timer) · Kết quả · Lịch sử · Thống kê · Ngân hàng · AI Coach · Tài liệu │
└───────────────▲─────────────── JSON + SSE (log coach, “dữ liệu đổi”) ──────┬────────────┘
                │                                                            │ POST + X-Trainer
┌───────────────┴────────────────── Node server 127.0.0.1:3003 ──────────────▼────────────┐
│ bank.ts      parse + validate packs (cache theo mtime)   select.ts    13 chế độ chọn câu   │
│ results.ts   chấm + ghi results/*.md                     stats.ts     Leitner + thống kê    │
│ snapshot.ts  coach/snapshot.md                           plans.ts     đọc kế hoạch + tiến độ│
│ issues.ts    bank/issues.md                              coach-runner spawn `claude -p` stream-json │
└──────┬──────────────────────┬──────────────────────────┬────────────────────────────────┘
       ▼                      ▼                          ▼
 bank/packs/**/*.md     results/YYYY/MM/*.md     coach/{snapshot, plans/, learner-profile}.md
       ▲                                                 ▲
       └────── Claude Code headless · launchd · Claude Cowork · /trainer-coach (COACH.md) ──┘
```

## 3. Mô hình dữ liệu

| Loại | File | Nội dung chính |
|------|------|----------------|
| Câu hỏi | `bank/packs/{imported,ai,docs,manual}/*.md` | front matter pack; mỗi câu `## Q <id>` + metadata (`domain, topic, services, tags, difficulty, time, variant_of, concept, refs, status`) + đề + `- A.` … + `**Answer:**` + `**Explanation:**` |
| Từ điển | `bank/taxonomy.yaml` | 4 domain + trọng số, 15 topic (+ notes), rubric thời gian, ~155 service, ~120 tag |
| Kết quả | `results/YYYY/MM/<ngày>_<giờ>_<mode>.md` | front matter: mode, thời gian, điểm, `selection`, `plan`, `answers: [{q, pick, key, ok, t, est, flag, unsure}]`; thân: báo cáo đọc được |
| Snapshot | `coach/snapshot.md` | số liệu tổng hợp cho AI (domain/topic/service/tag, câu sai kèm lựa chọn, cặp nhầm lẫn, tiến độ kế hoạch, issues) |
| Kế hoạch | `coach/plans/<ngày-giờ>.md` | front matter `sessions: [{id, title, why, feedback, timing, questions[] \| filter{}}]` + phân tích Markdown |
| Hồ sơ | `coach/learner-profile.md` | trí nhớ dài hạn của AI về người học |
| Báo lỗi | `bank/issues.md` | checklist `- [ ] ngày · \`id\` · loại · nội dung` → AI đánh `[x]` + cách xử lý |

## 4. Vòng lặp học tập với AI

```
làm bài → results/*.md → snapshot.md → AI Coach phân tích → (sửa issue · làm giàu giải thích · sinh pack câu mới) → validate
   ▲                                                                                                             │
   └──────────────── kế hoạch: các phiên “Bắt đầu” trong app (gắn plan#session vào kết quả) ◄──────────────────────┘
```

“Câu hỏi cần làm lại” được hiện thực theo 4 kiểu, AI trộn trong mỗi phiên vá lỗi (~40/40/20):

| Kiểu | Cơ chế |
|------|--------|
| **Giống hệt câu cũ** | id gốc trong `questions` của phiên; pool “Làm lại câu sai”; lịch Leitner (sai → mai ôn) |
| **Tương tự** | câu biến thể `variant_of: <id>` — cùng khái niệm, tình huống/qualifier/vị trí đáp án khác → chống học vẹt; tuỳ chọn xáo đáp án |
| **Trộn lẫn** | phiên xen kẽ câu gốc, biến thể và chủ đề khác; phiên `filter` động (`weak`, `srs`, `new`…) |
| **Mở rộng khía cạnh** | câu *contrast* cho cặp nhầm lẫn (X ⟶ Y) + câu *mở rộng* khái niệm lân cận |

Tự cập nhật ngân hàng có kiểm soát: ≤ 3 biến thể/câu gốc, giảm số câu sinh khi còn nhiều câu AI chưa làm, sửa câu bị báo lỗi tại chỗ
(giữ id), `status: retired` thay vì xoá, AI chỉ được **thêm** vào taxonomy. Hiệu quả đo được: kết quả mỗi phiên gắn `plan`, snapshot §10/§12
cho AI thấy phiên nào đã làm và câu AI có giúp tăng điểm không.

## 5. Chế độ test

| Chế độ | Ghi chú |
|--------|---------|
| 🎯 Thi thử | 65 câu theo quota domain 30/26/24/20 (largest remainder), ưu tiên câu lâu chưa gặp; preset “Chuẩn đề thật” = 130′ |
| 📚 Theo chủ đề · 📦 Theo bộ đề · 🛠️ Tùy chỉnh | lọc topic/domain/độ khó/nguồn/service/tag/từ khoá; bộ đề giữ thứ tự gốc |
| 🧠 Ôn ngắt quãng | Leitner box 1–5 (1/3/7/14/30 ngày), “chưa chắc” không lên box |
| 🔁 Làm lại câu sai · 🚩 Cờ/chưa chắc · 🐢 Tốc độ · 🆕 Chưa làm | pool tính từ lịch sử |
| 💪 Củng cố điểm yếu | lấy mẫu có trọng số theo độ yếu của topic/tag/service + trạng thái câu (không cần AI) |
| ⚡ Luyện nhanh | 10 câu, xem đáp án ngay |
| 🤖 Kế hoạch AI · 📌 Danh sách | phiên của coach; danh sách chọn tay / “làm lại N câu sai” |

Tuỳ chọn chung: chấm cuối bài / xem đáp án ngay · preset thời gian (×1.0, ×0.8, ESL ×1.23, ×1.5, 2′/câu, tự nhập, không giới hạn) ·
xáo đáp án · cắm cờ / “chưa chắc” · tạm dừng (trừ thi thử) · tự lưu bài dở · tự nộp khi hết giờ · nhịp nhanh/chậm so với chuẩn.

## 6. Các giai đoạn triển khai

| Phase | Hạng mục | Trạng thái |
|-------|----------|-----------|
| **0. Nền tảng dữ liệu** | SCHEMA v1, taxonomy (domain/topic/service/tag/rubric), parser + serializer, validator (`--fill-time`), importer 745 câu V1+V2 với phân loại domain/service/tag tự động | ✅ xong |
| **1. Luyện thi** | 13 chế độ, builder phía server, runner (timer Σ time, autosave, pause, phím tắt, practice/exam), chấm all-or-nothing, ghi kết quả .md, màn hình kết quả + giải thích + link notes, báo lỗi câu | ✅ xong |
| **2. Thống kê** | readiness có trọng số domain, theo domain/topic/service/tag/độ khó, tốc độ, Leitner, heatmap, câu sai nhiều nhất, lịch sử + biểu đồ | ✅ xong |
| **3. AI Coach** | snapshot, COACH/GENERATE, runner headless (quyền tối thiểu, SSE log, huỷ, lock), kế hoạch có phiên bấm chạy, learner profile, vòng issues, inbox, launchd, skill Claude Code, prompt Cowork | ✅ xong |
| **4. Chất lượng & đo lường** | các mục P1 ở §7 | ⏳ đề xuất làm tiếp |
| **5. Mở rộng** | các mục P2–P3 ở §7 | 💡 tuỳ nhu cầu |

## 7. Đề xuất tính năng tiếp theo

**P1 — nên làm tiếp (tác động lớn tới hiệu quả học)**

1. **“Hỏi AI về câu này”** — ở màn hình kết quả: hỏi tiếp “vì sao không phải C?” → `claude -p` với ngữ cảnh câu hỏi + notes, lưu hỏi đáp vào `coach/qa/<id>.md` (AI Coach đọc để biết chỗ còn mơ hồ).
2. **Biểu đồ hiệu chỉnh độ tự tin (calibration)** — tỉ lệ đúng của câu “chắc chắn” vs “chưa chắc”: phát hiện tự tin sai (nguy hiểm nhất khi thi).
3. **Phân tích chất lượng câu hỏi** — độ khó thực tế & độ phân biệt từng câu; câu mà người học giỏi vẫn sai, hoặc ai cũng chọn cùng 1 đáp án “sai” → tự tạo issue nghi đáp án sai.
4. **Thi thử 2.0** — giống Pearson VUE: 15 câu không tính điểm, màn hình review cuối bài (đã đánh dấu/chưa trả lời), không tạm dừng, cảnh báo 15′ cuối.
5. **Bản đồ phủ notes** — map từng mục `##/###` trong notes → số câu hỏi; mục chưa có câu → nút sinh câu cho đúng mục đó.
6. **Ngày thi & dự báo** — đặt ngày thi trong `config.yaml`; dự báo ngày đạt readiness ≥ 75% theo xu hướng; coach ưu tiên theo thời gian còn lại.

**P2 — tiện ích**

7. Mục tiêu hằng ngày + nhắc bằng thông báo macOS (launchd + `osascript`): “Hôm nay còn 18 câu đến hạn ôn”.
8. Tự `git commit` kết quả/kế hoạch sau mỗi bài (tuỳ chọn) — sao lưu + lịch sử.
9. Phát hiện câu trùng/gần trùng trong ngân hàng (so khớp văn bản/embedding) → gộp hoặc retire.
10. Flashcard từ khoá → service (dựa `M-keywords-mapping.md`, `L-quyet-dinh-nhanh.md`) cho ôn nhanh 5 phút.
11. Lịch ôn FSRS thay Leitner (tận dụng dữ liệu độ tự tin, khoảng ôn cá nhân hoá).
12. Xuất/nhập Anki.

**P3 — mở rộng phạm vi**

13. Nhiều kỳ thi (DVA-C02, SOA-C02, SAP-C02): taxonomy theo `exam`, lọc theo pack.
14. Truy cập từ điện thoại trong mạng LAN (opt-in, token) / PWA.
15. Báo cáo tuần do AI viết (`coach/reports/`), so sánh tuần trước, trọng tâm tuần tới.
16. “Giải thích lại” (explain-back): người học tự giải thích lựa chọn, AI chấm mức hiểu và ghi vào hồ sơ.

## 8. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|--------|-----------|
| AI sinh câu sai kiến thức / sai đáp án | bắt buộc bám notes; checklist chất lượng SCHEMA §6; nút báo lỗi → AI kiểm tra lại; `retired`; mọi thay đổi xem/revert bằng git |
| AI ghi sai định dạng | parser nghiêm ngặt + `validate.ts --fill-time` trong quy trình; câu lỗi tự bị loại; tab “Kiểm tra định dạng” |
| Ngân hàng phình/trùng | giới hạn biến thể; giảm sinh khi còn nhiều câu AI chưa làm; (P2) phát hiện trùng |
| Tốn token khi chạy định kỳ | bỏ qua khi không có dữ liệu mới; snapshot tính sẵn; chọn `model`/`effort` trong `config.yaml` |
| Agent ghi ngoài phạm vi | `--permission-mode dontAsk` + `allowedTools` theo đường dẫn (đã kiểm chứng: ghi ngoài `trainer/` bị chặn) |
| Thời gian chuẩn không sát người học | rubric tham số hoá; preset ×0.8–×1.5; thống kê TG thực tế vs chuẩn theo topic |
| Cowork không chạy được Node | prompt có nhánh tự soát định dạng; app báo lỗi ngay khi nạp file |

## 9. Kiểm thử đã thực hiện

- `npm test` — 9 unit test: rubric thời gian (khớp ví dụ SCHEMA §4), parser/serializer round-trip, báo lỗi có số dòng, ví dụ trong SCHEMA parse sạch, chấm điểm, Leitner, nạp toàn bộ ngân hàng (745 câu, 0 lỗi).
- `npm run typecheck` + `vite build` sạch.
- E2E API trên bản sao sandbox: mô phỏng 7 bài (152 câu, 5 ngày) qua mọi chế độ → kiểm tra quota thi thử (19/17/16/13), pool SRS/câu sai/cờ/chậm, thống kê, báo lỗi, snapshot.
- Quyền agent headless: đọc trong repo ✔, đọc ngoài repo (`/etc/hosts`) bị chặn ✔, ghi trong `trainer/bank|coach` ✔, ghi ngoài bị chặn ✔, chạy validator ✔.
- AI Coach thật trên sandbox (model sonnet):
  - Lượt 1 (CLI): 2,5 phút · $0.59 — 13 câu mới (7 biến thể, 3 contrast, 3 mở rộng), validate 0 lỗi/0 cảnh báo, làm giàu 2 giải thích,
    xử lý issue đúng (giữ đáp án, giải thích vì sao), kế hoạch 4 phiên + hồ sơ người học.
  - Lượt 2 (bấm nút trong UI, log realtime qua SSE): 2,6 phút · $0.63 — tự chạy `validate.ts --fill-time`; nhận ra bài làm vội
    (0–1 giây/câu) và không tính vào điểm yếu; mang phiên chưa làm của kế hoạch cũ sang; 14 câu mới; tự hạn chế sinh thêm vì còn 26 câu AI chưa làm.
- Giao diện: chụp kiểm tra 9 trang (sáng/tối, desktop + mobile 390 px): không tràn ngang, không lỗi JavaScript.
