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
| **0. Nền tảng dữ liệu** | SCHEMA v1, taxonomy, parser + serializer, validator (`--fill-time`), importer 745 câu V1+V2 | ✅ v1 |
| **1. Luyện thi** | 13 chế độ, runner (timer Σ time, autosave, pause, phím tắt, practice/exam), kết quả .md, màn hình kết quả, báo lỗi | ✅ v1 |
| **2. Thống kê** | readiness theo domain, theo topic/service/tag/độ khó, tốc độ, Leitner, heatmap, lịch sử | ✅ v1 |
| **3. AI Coach** | snapshot, COACH/GENERATE, runner headless, kế hoạch có phiên, learner profile, issues, inbox, lịch, skill, Cowork | ✅ v1 |
| **4. Chất lượng dữ liệu (v2)** | #1–#5 §7 | ✅ v2 |
| **5. Học hiệu quả hơn (v2)** | #6–#12 §7 | ✅ v2 |
| **6. AI & vận hành (v2)** | #13–#17 §7 | ✅ v2 |
| **7. Hiệu năng & chất lượng câu hỏi (v3, đợt 2)** | #18–#23 §7.4 | ✅ v3 |
| **8. Nâng cao (v3, đợt 3)** | #24–#29 §7.5 | ✅ v3 |
| **9. Đo trung thực & quick wins (v4, đợt A + B của buổi brainstorm)** | #30–#43 §7.6 | ✅ v4 |
| **10. Học mỗi ngày, bám ngày thi, chống học vẹt (v5, đợt C + D)** | #44–#59 §7.7 | ✅ v5 |
| **11. Tiếp theo** | §7.8 | 💡 đề xuất |

## 7. Tính năng

### 7.1 Chất lượng dữ liệu (v2)

Đo trên 745 câu gốc trước v2: đáp án đúng **A 55 % · B 39 % · C 5 % · D 0,6 %**; đáp án đúng là đáp án dài nhất ở **62 %** câu; đề trung vị
**18 từ** (đề thật 60–120 từ); **729/745** giải thích < 15 từ; domain gán bằng từ khoá lệch về performance (41 % so với 24 %).

| # | Tính năng | Cách làm |
|---|-----------|----------|
| 1 | Cân vị trí đáp án | `scripts/rebalance-answers.ts`: hoán vị tất định theo id, phân bố đều A–D; ghi `bank/migrations/*.json`; kết quả cũ tự chuyển đổi khi khởi động (`migrateResults`); **xáo đáp án khi hiển thị mặc định bật** (`practice.shuffle_options`) |
| 2 | Đáp án đúng quá dài | chỉ số trong *Ngân hàng → Chất lượng*; cảnh báo validator cho pack AI/tài liệu/thủ công; ENRICH `balance` viết lại distractor |
| 3 | Câu dài chuẩn thi thật | ENRICH `longform` sinh biến thể 60–120 từ; `longForm` tính tự động; mức sẵn sàng v2 có trọng số ×1.5; thi thử ưu tiên câu dài |
| 4 | Giải thích sơ sài | ENRICH `explain`: lý do đúng + từng distractor **theo nội dung** + tóm tắt 🇻🇳; `hint`; chạy dần theo lô, lúc rảnh của lịch |
| 5 | Domain & mục exam guide | `task: 1.1…4.4` trong taxonomy/metadata; `scripts/classify-tasks.ts` gán heuristic ngay; ENRICH `classify` tinh chỉnh; thống kê & lọc theo task |

### 7.2 Học hiệu quả hơn (v2)

| # | Tính năng | Cách làm |
|---|-----------|----------|
| 6 | “Vì sao bạn chọn?” | ô nhập khi sai (practice) và ở màn hình kết quả → `why` trong file kết quả → snapshot → AI Coach chẩn đoán hiểu nhầm |
| 7 | Gạch đáp án + tô từ khoá | ✕ / chuột phải / Shift+số; `elim` lưu vào kết quả; thống kê “gạch nhầm đáp án đúng”; tô qualifier theo `taxonomy.keywords` |
| 8 | Thi thử 2.0 (Pearson VUE) | 15 câu thử nghiệm không tính điểm, màn hình Review cuối bài, không tạm dừng, cảnh báo 15′/5′, sức bền theo phần tư |
| 9 | Nhớ trước khi xem đáp án | ẩn lựa chọn đến khi người học viết đáp án mình nghĩ; `recallHit` chấm tự động theo service/khái niệm |
| 10 | FSRS + giới hạn ôn/ngày | FSRS-4.5 ở v2 → **FSRS-6** ở v3 (#24) (grade theo đúng/sai, chưa chắc, gợi ý, tốc độ); ôn câu sắp quên nhất trước; `daily_limit` + tồn đọng |
| 11 | Mức sẵn sàng v2 + lọc nhiễu | trọng số thời gian/độ khó/câu dài, prior Laplace, khoảng tin cậy 90 %, xác suất đỗ; loại bài làm vội |
| 12 | Hỏi AI + gợi ý | `claude -p` chỉ đọc, trả lời tiếng Việt, lưu `coach/qa/<id>.md`; gợi ý (`hint`) do ENRICH soạn sẵn |

### 7.3 AI & vận hành (v2)

| # | Tính năng | Cách làm |
|---|-----------|----------|
| 13 | Chi phí & model theo tác vụ | `coach.models.{analyze,generate,enrich,ask}`; tổng lượt & chi phí quy đổi 30 ngày ở trang AI Coach |
| 14 | Vòng chất lượng câu AI | 👍/👎 (`bank/ratings.md`), danh sách đánh giá thấp, phát hiện câu gần trùng, đo hiệu quả biến thể → snapshot → coach sửa/retire |
| 15 | Đồng bộ 2 máy | nút ⇅ / `npm run sync` (commit dữ liệu → pull --rebase → push, không treo khi thiếu credential); `coach.hosts`; `merge=union`; AI Coach tự đồng bộ trước & sau mỗi lượt (`sync.before_ai` / `sync.after_ai`) |
| 16 | CI + test | GitHub Actions (`trainer/ci/trainer-ci.yml` — chuyển vào `.github/workflows/` khi token có quyền `workflow`): validate, typecheck, unit, e2e API (TRAINER_HOME tạm), UI smoke Playwright |
| 17 | Launcher + Windows | `start.command` / `start.sh` / `start.bat`, `OPEN=1`; dò CLI trên Windows; lịch đa nền tảng (launchd / crontab / schtasks) |

### 7.4 Hiệu năng & chất lượng câu hỏi (v3 — đợt 2 của bản rà soát)

Rà soát v2 (đo trên bộ dữ liệu giả lập 2 năm: 1.500 bài, 47 nghìn câu trả lời, 700 kế hoạch): nộp bài chặn server ~3,5 s (snapshot tính lại
toàn lịch sử), khởi động đọc mọi file kết quả 2 lần (~4,3 s), mỗi request 130–170 ms, `/api/plans` 3,2 MB. Nghiên cứu sinh câu trắc nghiệm
bằng LLM (2025–2026): AI tự sửa câu thì 56–68 % bản sửa phát sinh lỗi mới; model thứ hai giải mù bắt được nhiều câu lỗi hơn tự kiểm (63,6 % vs 27 %).

| # | Tính năng | Cách làm |
|---|-----------|----------|
| 18 | Hiệu năng | snapshot ra khỏi request (debounce 3 s, cache theo phiên bản câu); parse cache SQLite (`node:sqlite`, `.cache/trainer.db`, mỗi file đọc 1 lần); `context()` memo theo phiên bản dữ liệu; chỉ mục kế hoạch; phân trang `/api/results?limit&offset`, `/api/plans` (+ `/api/plans/:id`); gzip JSON; web chỉ tải lại phần đã đổi. Kết quả: nộp bài 3.301 → 7 ms; meta/state/stats ~12 ms; khởi động 5,7 → 0,6–1 s; mỗi trang < 200 KB |
| 19 | Giải mù bằng model thứ hai | task `verify`: model khác (`coach.models.verify`, mặc định opus) giải câu chỉ với đề + phương án (`--tools ""`, `--json-schema`); sổ `bank/verify.md` (merge=union); tự chạy sau lượt AI có câu mới/câu bị đổi; câu AI lệch/mơ hồ → `draft` chờ duyệt (Duyệt/Loại/Sửa bằng ENRICH); câu draft không bao giờ vào bài |
| 20 | Lint lỗi viết câu | `server/lib/lint.ts`: 11 luật (nặng: trùng phương án, All/None of the above, Choose N, nhắc chữ cái; vừa: đáp án đúng dài nhất, lặp từ đề, từ tuyệt đối, phủ định, a/an, chồng lấn; nhẹ: giải thích ngắn); `validate --lint`; patch AI làm phát sinh lỗi nặng mới bị từ chối |
| 21 | Phân tích phương án nhiễu | từ bài làm (chỉ phiên bản hiện tại của câu): phương án không ai chọn mà hay bị gạch → ENRICH `distractors`; cùng phương án sai được chọn chắc chắn nhiều lần → nghi sai đáp án → giải mù / báo lỗi; vào snapshot cho coach |
| 22 | Phiên bản câu & chấm lại | mỗi câu trả lời lưu `h` = hash câu hỏi lúc làm; đáp án đổi → `regradeAttempts` chấm lại trong thống kê/FSRS/snapshot (file kết quả giữ nguyên); trang kết quả ghi ↻ / ✎ |
| 23 | AI trả JSON | Sinh câu / ENRICH / Câu dài: `--json-schema` + công cụ chỉ đọc; app tự ghi patch/pack sau khi kiểm tra (định dạng, task–domain, chữ cái, gợi ý lộ đáp án, Choose N, lint nặng); 1 vòng sửa qua `--resume`; chế độ ghi file giữ cho `/trainer-*` & Cowork |

### 7.5 Nâng cao (v3 — đợt 3)

| # | Tính năng | Cách làm |
|---|-----------|----------|
| 24 | FSRS-6 + tham số cá nhân | ts-fsrs 5.4 (theo ngày, short-term); tối ưu bằng `@open-spaced-repetition/binding` trong **tiến trình con** (lỗi native không làm sập server); chỉ dùng khi log-loss tốt hơn mặc định; `results/fsrs-params.json` (merge=union); `srs.optimize auto/manual/off` |
| 25 | Ngày thi & dự báo | `results/goal.md`; dự báo theo domain đúng ngày thi (nếu dừng học / nếu ôn đúng lịch), độ phủ, lịch ôn sắp tới; thẻ đếm ngược ở Tổng quan |
| 26 | Đối chiếu điểm thi chính thức | `results/external/*.md`; mức sẵn sàng tại ngày thi thử → độ lệch → mức sẵn sàng hiệu chỉnh |
| 27 | Tìm kiếm toàn văn | SQLite FTS5 (`unicode61 remove_diacritics 2`, gập “đ”), câu hỏi + tài liệu theo heading, ô tìm kiếm toàn cục (`/`), fallback quét bộ nhớ |
| 28 | Câu trùng theo nghĩa | embedding chạy trên máy qua Ollama (`embeddinggemma`), cache theo nội dung, chạy nền, cosine ≥ 0,88, gộp với trùng từ khoá |
| 29 | Điện thoại (LAN) + Anki | LAN opt-in: listener 0.0.0.0, mã truy cập + cookie HMAC, Host allow-list, giao diện đóng gói cho điện thoại, QR; Anki: TSV có GUID cố định + AnkiConnect (cập nhật thẻ cũ) |

### 7.6 Đo trung thực & quick wins (v4 — đợt A + B của buổi brainstorm 9 lăng kính)

Buổi brainstorm (20/10/2026, 9 agent mỗi agent một lăng kính → 106 ý tưởng, 18 chủ đề; backlog đầy đủ ở trang "Backlog Trainer v4") cho thấy:
ngân hàng chưa giống đề thật (đề trung vị 18 từ so với ~60–115 từ của đề mẫu; một bài thi thử ≈ 2.300/7.500 từ), 36 % là câu anh em → rủi ro
học vẹt; sau ~4 tuần hết câu chưa gặp nên mọi con số chỉ còn đo trí nhớ câu ngân hàng.

| # | Tính năng | Cách làm |
|---|-----------|----------|
| 30 | Đề niêm phong | 2 đề × 50 câu giữ riêng từ trước buổi luyện đầu (`results/sealed.md`, tất định, phân tầng domain/task, ưu tiên câu chưa gặp, loại câu ngoài phạm vi / có câu anh em); ẩn khỏi mọi chế độ, tìm kiếm, Anki, Ngân hàng, Chất lượng, snapshot AI; làm = Pearson 50 + 15 thử nghiệm → "điểm trên câu mới" thành điểm hiệu chỉnh nội bộ; gợi ý T−21 / T−7; `npm run seal` |
| 31 | Ngày đầu | trình hướng dẫn 3 bước (mục tiêu → chẩn đoán 28 câu 2/task → Bản đồ xuất phát) + kế hoạch tuần 1 tự lập (`coach/plans/<ngày>-onboarding.md`, không AI) |
| 32 | Câu chưa xem không phải lượt ôn | `!pick && !t` → không vào FSRS/trạng thái/pool/hạn mức/mức sẵn sàng/thống kê; vẫn sai trong điểm bài (sửa lỗi đợt 1) |
| 33 | Thi thử trung thực | `shared/realism.ts`: câu giống đề thật (≥ 55 từ, phương án ≥ 8 từ), huy hiệu "Giống đề thật a/N · w/W từ", "điểm lạc quan"; đồng hồ **theo tải đọc đề thật** mặc định (130′ × số chữ/7.475, kẹp [Σ chuẩn, 2′/câu]) + ESL ×160/130 |
| 34 | Lần đầu gặp / gặp lại | `exposure`, `recognized` (gặp lại mà đúng nhanh hơn 300 từ/phút) → FSRS tối đa Good, mức sẵn sàng ×0,3; thống kê 14 ngày; "đã gặp n/N · điểm phần câu mới" |
| 35 | Cặp hay nhầm đã lọc nhiễu | tỉ lệ chọn X khi đáp án Y ÷ số lần cùng xuất hiện; xác nhận ≥ 4 lần, ≥ 3 câu, cận dưới 80 % > 2× mức nền; gộp cùng gốc; "Luyện cặp này"; thay §9 thô của snapshot |
| 36 | Theo tiêu chí đề | `Question.requirements` từ `taxonomy.keywords` (cost/ops/resilient/performance/secure/negative); thẻ thống kê + bộ lọc Tùy chỉnh |
| 37 | Phạm vi đề thi | danh sách ngoài phạm vi chính thức + alias đổi tên; `Question.outOfScope`; lint `oos-answer`/`oos-distractor`; loại khỏi chế độ luyện (`practice.exclude_out_of_scope`) |
| 38 | Checklist ngày thi | 8 mục có hạn + link chính thức (ESL +30 phải xin trước khi đặt lịch, OnVUE, hạn dời lịch…); goal.md lưu lịch học, giờ thi, hình thức thi, ESL |
| 39 | Thời gian đọc & nộp an toàn | `rt` tách khỏi `t` sau "Kiểm tra"; nộp bài idempotent theo `sessionId` + hộp thư đi khi mất mạng |
| 40 | Tự đồng bộ khi rảnh | `sync.auto: idle`: đồng bộ vài phút sau bài nộp, kéo về khi mở app (trước khi chuẩn bị đề niêm phong), đẩy khi tắt |
| 41 | Code mới sau đồng bộ | `codeVersion`, SSE `update`/`hello`, banner, `POST /api/restart` (exit 75) + vòng lặp launcher |
| 42 | Cổng kiểm tra | `npm run check` / `check:fast`, `.githooks/pre-push` (`npm run hooks:install`), preflight trình duyệt cho UI smoke, test golden parse |
| 43 | ENRICH câu sắp gặp | lô ENRICH ưu tiên câu đến hạn ngày mai / câu chưa làm kế tiếp / phiên kế hoạch; `coach.enrich_after_analyze` |

### 7.7 Học mỗi ngày, bám ngày thi, chống học vẹt (v5 — đợt C + D của buổi brainstorm)

Đợt C (chính) và D (thử nghiệm, mọi tính năng tốn quota AI hoặc chạm vào hệ thống đều chỉ chạy khi bấm / bật trong config). 8 sub-agent làm
song song trong một git worktree riêng (để app đang dùng và tự đồng bộ của người học không bị ảnh hưởng) → tích hợp → 3 agent rà soát độc lập.

| # | Tính năng | Cách làm |
|---|-----------|----------|
| 44 | ▶ Học hôm nay | `server/lib/today.ts` + mode `today`, `GET /api/today`: quỹ phút × tốc độ cá nhân (median t/est), làm lại ≤ 20 %, đến hạn ≤ 50 % (trong `daily_limit`), task yếu / câu mới theo hạn mức, pha thi; tất định (ngày + quỹ + phiên bản dữ liệu); hero ở Tổng quan |
| 45 | Dừng sớm & làm tiếp trên máy khác | `stoppedEarly` (câu chưa xem không lưu, câu mở mà trống = `skipped`, `planned`), `.local/active.json` + `GET/PUT/DELETE /api/active` (người ghi sau thắng, chống ghi đè bản mới hơn) |
| 46 | Học lại trong phiên & lý do một chạm | câu sai / có gợi ý quay lại sau 3–6 câu với cổng nhớ trước; bản ghi `relearn` ngoài điểm, một bước FSRS cùng ngày ≤ good; `WHY_CHIPS` |
| 47 | Lịch bám ngày thi | `exam-schedule.ts` (pha build/measure/consolidate/light, hạn mức câu mới, hàng ôn trước hạn, đuổi kịp, thi hay dời), `due-planner.ts` (rải tải ±5 %, kéo hạn vào [thi−7, thi−2], ramp retention) — tắt cả 3 = đúng lịch v4; dự báo `examAware` + `capacity` |
| 48 | Kế hoạch nước rút | `POST /api/plan/sprint` → `coach/plans/<ngày>-sprint.md` tất định, một file/ngày, dùng đề niêm phong, Pearson, lỗi hôm qua, ôn trước hạn |
| 49 | Cụm câu anh em & chuyển giao | `clusters.ts` (variant_of ∪ trùng ∪ cùng chủ đề + đáp án + đề giống; chống nối chuỗi: luật hub > 8, cụm text ≤ 6); 1 câu/cụm/phiên, chôn anh em của câu làm hôm nay; thay câu đã bền bằng anh em chưa gặp (`for` → FSRS ghi cho cả câu gốc); `transferStats` |
| 50 | Câu song sinh & họ câu (AI) | tác vụ `twins` (diễn đạt lại / tương phản) và `family` (một tình huống, một bộ lựa chọn, 2–4 câu hỏi cuối); qua lint + giải mù + auto-draft; lint `family-options` |
| 51 | Phân biệt dịch vụ dễ nhầm | `confusables.ts` (dịch vụ cạnh tranh đáp án ↔ phương án nhiễu, ≥ 8 câu; nhầm lẫn của người học ≥ 3), mode `discriminate` (đáp án luân phiên), `#/pair?a=&b=` trích mục so sánh trong notes |
| 52 | Đọc yêu cầu, lỗi hôm qua, kiểm tra lại | mode `qualifier` (họ câu cách ≥ 5, dự phòng theo tiêu chí đề), `yesterday` (≤ 8), `retest` (`retestIds` dùng chung với bước Chữa bài) |
| 53 | Chữa bài & câu dai dẳng | Kết quả: tab Sai mặc định, stepper "🩹 Chữa N câu" (thử lại trước khi xem → `POST /api/results/:id/retry`, chỉ hiển thị), đính chính; `leech.ts` + `results/leeches.md` (union), tạm gác ≤ 3 ngày |
| 54 | Lá chắn thống kê | `shared/evidence.ts`: Beta co về mức chung (k = 10, phân tầng), khoảng 80 %, verdict chỉ khi khoảng loại trừ mức nền, "cần ~N câu nữa"; mọi bucket, sức bền, độ tự tin, snapshot, weakPick |
| 55 | Đề cương chính thức & mục tiêu sinh câu | `bank/exam-guide/SAA-C03.yaml` (189 mục, chép từ trang AWS 2026-10-20), `skills` (lưu sẵn hoặc đoán theo cue), Chất lượng → 🗺️ Đề cương, generate/longform `params.skills`, `taskDeficits`; thi thử ≥ 50 % câu giống đề mỗi domain |
| 56 | Nội dung chính xác | lint `stale-fact` (11 mục `currency:` đã đối chiếu trang AWS), kiểm chứng có nguồn (WebFetch chỉ docs.aws.amazon.com / aws.amazon.com, trích dẫn), kiểm toán câu nhập (+ phiếu Ollama tuỳ chọn), `disputedIds()` ngoài mức sẵn sàng, ↩️ hoàn tác lượt AI (bản trước trong `coach/patches/<run>.before.json`) |
| 57 | Gia sư & sổ lỗi & nghe | `tutor.ts` (`claude -p --resume`, không công cụ, đáp án sau 3 lượt / "tôi chịu", giới hạn ngày), `notebook.ts` (`coach/notebook/<domain>.md`, gộp theo key), `#/listen` (speechSynthesis, Media Session, tự chấm → mode `listen`) |
| 58 | Học mọi nơi | MCP server không phụ thuộc (`scripts/mcp-server.ts`, cả handshake cũ lẫn bản stateless 2026-07-28) + skill `/trainer-quiz`; micro API + status line + mod Claude Code; nhập lượt ôn Anki (`mode: anki`, idempotent theo khoảng review) |
| 59 | Nền tảng | `npm start` phục vụ bản build (lazy routes, manifest + service worker chỉ app shell, app badge, giữ asset cũ một thế hệ); `npm run service`; LAN: phạm vi luyện tập mặc định (`lan-scope.ts`, mọi route được phân loại), token riêng từng thiết bị 30 ngày, HTTPS (tailscale / mkcert, cùng cổng) |

### 7.8 Lộ trình tiếp theo (đề xuất)

0. **Dùng thật v5 rồi tinh chỉnh**: trọng số "Học hôm nay", ngưỡng lá chắn thống kê, luật đoán `skills`, bản đồ cue; chạy dần câu dài /
   câu song sinh / kiểm toán câu nhập bằng `coach.idle_tasks` khi quota cho phép.
1. **Đợt 1 của bản rà soát (phần còn lại; mục "câu chưa xem" đã làm ở v4 #32)**: mức sẵn sàng dựa cả câu ôn lặp lại /
   gợi ý (σ chỉ có sai số mẫu → xác suất đỗ quá tự tin; v4 đã giảm trọng số câu nhận diện); `taxonomy.yaml` lỗi làm sập app; kế hoạch AI có `feedback` sai làm nộp bài lỗi 500;
   tự đặt `coach.hosts` khi cài lịch; kiểm tra đăng nhập sau khi CLI cập nhật (`--bare` có thể thành mặc định cho `-p`); thu hẹp quyền ghi
   của phân tích (không ghi `bank/migrations/`); bỏ `ANTHROPIC_AUTH_TOKEN` khỏi môi trường coach; kiểm tra `session.mode` phía server.
2. **Hạn mức & token (bỏ qua theo yêu cầu)**: nhận biết hết hạn mức 5 giờ/tuần, hẹn chạy lại, bớt token mỗi lượt.
3. **Bản đồ phủ notes** — mục `##/###` nào trong notes chưa có câu hỏi → sinh câu cho đúng mục đó (có thể dùng FTS5/embedding).
4. **Flashcard từ khoá → service** (từ `M-keywords-mapping.md`, `L-quyet-dinh-nhanh.md`).
5. **Báo cáo tuần do AI viết** (`coach/reports/`); đưa dự báo ngày thi vào snapshot để coach ưu tiên theo thời gian còn lại.
6. **Nhiều kỳ thi** (DVA-C02, SOA-C02, SAP-C02) — taxonomy theo `exam`.
7. **“Giải thích lại” (explain-back)** — người học tự giải thích, AI chấm mức hiểu; PWA cho điện thoại.

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

**v1** — 9 unit test; E2E API trên sandbox (7 bài mô phỏng); quyền agent headless; 2 lượt AI Coach thật trên sandbox; chụp 9 trang.

**v2** (6 sub-agent làm song song theo vùng file riêng, sau đó tích hợp):

| Hạng mục | Kết quả |
|----------|---------|
| Typecheck · build | `tsc --noEmit` sạch · `vite build` OK |
| Unit (`npm test`) | 48/48 — core, learning (FSRS, readiness, Pearson, recallHit, rewriteAttempt), quality (rebalance, migration, task heuristic, duplicates, ratings), ai (patch, enrich, schedule) |
| E2E API (`npm run test:e2e`) | 36/36 — mọi chế độ, Pearson, elim/recall/why, rushed, stats, quality/ratings, issues, coach/qa chỉ đọc, đồng bộ thật với bare remote (union merge, conflict, 401/403/timeout không treo); AI Coach tự đồng bộ trước/sau lượt chạy với 2 máy + Claude CLI giả (cả `coach-run.ts`, remote lỗi, tắt bằng config) |
| UI smoke (`npm run test:ui`) | 19/19 — desktop, 390 px (không tràn ngang), dark; luồng tạo bài → làm → nộp → kết quả |
| Migration trên dữ liệu thật | đáp án đúng **A 55,2 / B 38,9 / C 5,3 / D 0,6 % → A 24,2 / B 25,0 / C 25,8 / D 25,0 %**; 716 câu đổi thứ tự; **745/745 câu giữ nguyên nội dung đáp án đúng, đề và bộ lựa chọn**; 745 câu gắn task 1.1–4.4; validate 0 lỗi / 0 cảnh báo |
| AI thật trên repo (sonnet) | ENRICH 10 câu: 10/10 áp dụng, 0 lỗi, $0.237 (tự sửa 2 câu MSK sai domain, cân độ dài 4 câu) · câu dài: 3 câu 70–85 từ, $0.215 |
| QA giao diện | các agent UI chụp & soát > 120 ảnh (light/dark, 1440/390 px); orchestrator soát lại các trang chính với dữ liệu thật đã migration |
| Lỗi tìm thấy & sửa trong lúc làm | thời gian từng câu luôn = 0 dưới React StrictMode (lỗi từ v1); regex nhận diện chữ cái đáp án bắt nhầm chữ thường; modal đồng bộ bị đè; tràn ngang trang Coach ở 390 px |

**v3** (đợt 2 + 3 của bản rà soát; 5 sub-agent làm song song theo vùng file riêng → tích hợp → 3 agent rà soát độc lập → sửa → kiểm lại):

| Hạng mục | Kết quả |
|----------|---------|
| Typecheck · build | `tsc --noEmit` sạch · `vite build` OK |
| Unit (`npm test`) | 146/146 — thêm lint (17), embeddings + Ollama giả (7), Anki (15), progress/FSRS-6/optimizer/forecast (12+), perf/parse cache/snapshot (12+), search FTS5 (9), AI pipeline (structured output, repair, verify, lock) |
| E2E API (`npm run test:e2e`) | 97/97 (2 lần liên tiếp) — thêm search, progress, quality (lint/distractor/semantic/verify), ai-pipeline (sinh câu + sửa + giải mù + auto-draft, ENRICH ids/distractors, huỷ, 2 tiến trình song song, deadline), LAN (Host/token/cookie, rebinding, file ẩn, upgrade DoS, redirect, mở lại khi đổi mạng), lan-anki, lifecycle (SIGHUP/SIGTERM ghi snapshot, sự kiện SSE) |
| UI smoke (`npm run test:ui`) | 21/21 — thêm trang 🧰 Công cụ; các agent tự soát thêm bằng Playwright (1440/390 px, sáng/tối) mọi màn hình mới |
| Hiệu năng (1.500 bài / 47 nghìn câu / 700 kế hoạch) | nộp bài 3.301 → 7 ms · meta/state/stats 140–186 → 11–14 ms · khởi động 5,7 → 0,6–1 s · mỗi trang 2,3–5,6 MB → 163–187 KB · tìm kiếm 2–10 ms · giao diện điện thoại tải 2,7 → 0,6 s |
| Ngân hàng thật (chỉ đọc) | validate 0 lỗi / 0 cảnh báo · lint: 0 câu lỗi nặng, 480 câu lỗi vừa (đáp án đúng dài nhất 348, lặp từ đề 273, từ tuyệt đối 168) |
| Claude CLI thật (sandbox, 6 lượt) | giải mù 3/3 · ENRICH 2/2 + giải mù · sinh 2 câu từ tài liệu + giải mù · câu dài 1 · `--resume` + `--json-schema` OK — ≈ $0,62 quy đổi API |
| Rà soát độc lập | 26 lỗi được tái hiện (AI 11, học/hiệu năng 10, bảo mật LAN 5) → 25 đã sửa kèm test hồi quy (+1 lỗi sập server do EPIPE khi upgrade bị reset); 1 để lại vì thuộc đợt 1 (FSRS vẫn tính câu bỏ trống chưa xem là quên) |

**v4** (đợt A + B của buổi brainstorm 9 lăng kính; 5 sub-agent làm song song theo vùng file riêng → tích hợp → 2 agent rà soát độc lập → sửa → kiểm lại):

| Hạng mục | Kết quả |
|----------|---------|
| Typecheck · build | `tsc --noEmit` sạch · `vite build` OK |
| Unit (`npm test`) | 224/224 — thêm đề niêm phong (chọn câu tất định, trạng thái, file hỏng → vẫn giữ kín), tín hiệu học (câu chưa xem, đã gặp/nhận ra, cặp nhầm lẫn, nhóm yêu cầu, điểm phần câu mới), độ giống đề thật + đồng hồ theo tải đọc, chẩn đoán, onboarding + checklist, ngoài phạm vi đề, golden fixtures cho bộ đọc Markdown (35 pack + kết quả mẫu) |
| E2E API (`npm run test:e2e`) | 156/156 (2 lần liên tiếp) — thêm: câu niêm phong không lộ ở mọi chế độ, tìm kiếm, Anki, Ngân hàng, Chất lượng, file thô, snapshot, Hỏi AI, nhật ký giải mù; tiến độ v4; nộp bài idempotent + outbox; tự đồng bộ (kéo khi mở, đẩy khi rảnh / khi tắt, tắt giữa lúc đồng bộ, không đẩy commit code, không autostash); cập nhật code + khởi động lại (exit 75); pre-push gate |
| UI smoke (`npm run test:ui`) | 22/22; các agent tự soát thêm bằng Playwright (1440/390 px, sáng/tối) mọi màn hình mới |
| Đề niêm phong trên ngân hàng thật | 748 câu → 420 đủ điều kiện (loại 22 câu đáp án ngoài phạm vi đề, 306 câu là cặp V1/V2 hoặc biến thể của câu khác) → 2 đề × 50 câu theo trọng số domain; `npm run seal` và lúc mở app cho cùng kết quả · validate 0 lỗi / 0 cảnh báo |
| Rà soát độc lập | 17 lỗi được xác nhận (gần như tất cả tái hiện bằng script trên sandbox) → **17/17 đã sửa kèm test hồi quy**. Vận hành 9: tắt app giữa lúc đồng bộ để lại rebase dở và gợi ý `--continue` làm mất kết quả; tự đồng bộ đẩy commit code bỏ qua pre-push; autostash để lại conflict marker mà vẫn báo ổn; hỏi ký GPG để lại `index.lock`; hook CRLF trên Windows; code do tiến trình khác kéo về không báo cập nhật; pre-push kiểm working tree thay vì commit được đẩy; giới hạn khởi động lại không reset; outbox khi localStorage đầy. Đề niêm phong & tín hiệu học 8: file pack thô (📄) lộ câu niêm phong kèm đáp án; làm lại đề vẫn tính "điểm trên câu mới"; điểm phần câu mới bỏ qua câu chưa xem; `sealed.md` hỏng → mở hết câu; ngày gợi ý sai khi đã dùng đề trước; kế hoạch onboarding không ghim đề; snapshot nêu id câu niêm phong; Hỏi AI / giải mù có thể lộ câu niêm phong. Agent tự tìm thêm 2 lỗi cùng loại (`practice-exams/` chứa đáp án gốc; snapshot §16 lấy cả lần làm lại) |
| Lỗi tìm thấy & sửa khi tích hợp | xuất bài bỏ mất bộ lọc `requirements`; huy hiệu đạt/chưa đạt ở Lịch sử trong tuần đầu (nay trung tính); trang không tải lại danh sách câu khi đề niêm phong đổi trạng thái; bỏ dở đề niêm phong không cảnh báo; 3 server sandbox của test chạy sót |

**v5** (đợt C + D của buổi brainstorm; 8 sub-agent làm song song trong một git worktree riêng → tích hợp → 3 agent rà soát độc lập → sửa → kiểm lại):

| Hạng mục | Kết quả |
|----------|---------|
| Typecheck · build | `tsc --noEmit` sạch · `vite build` OK (trang nặng tải lười: gói chính 675 → 492 KB) |
| Unit (`npm test`) | 403/404 (1 bỏ qua: `systemd-analyze` không có trên macOS) — thêm today composer, luật cụm / thay câu anh em, các chế độ mới, lá chắn thống kê (phân vị Beta khớp dạng đóng ~1e-15), lịch bám ngày thi (rải tải bật, kéo hạn ôn chốt, ramp, ổn định khi có kết quả mới), câu dai dẳng, chuyển giao, kế hoạch nước rút, cụm câu anh em + chống nối chuỗi, cặp dễ nhầm, đề cương, lint `family-options` / `stale-fact`, twins / family / kiểm chứng / kiểm toán / hoàn tác (CLI giả), gia sư / sổ lỗi / nghe, phạm vi LAN (mọi route được phân loại), token thiết bị, HTTPS, file dịch vụ, MCP, mod Claude Code |
| E2E API (`npm run test:e2e`) | 218/218 (2 lần liên tiếp) — thêm /api/today, mọi chế độ mới, dừng sớm / học lại / thử lại / `for`, mirror bài dở 2 thiết bị (đồng hồ lệch), tiến độ v5 + kế hoạch nước rút, câu dai dẳng, cặp dễ nhầm, đề cương, hoàn tác, kiểm chứng có nguồn, gia sư + nghe, micro, MCP qua stdio, LAN (phạm vi, thiết bị, HTTPS cùng cổng, POST không mở Vite), UI build + asset cũ |
| UI smoke (`npm run test:ui`) | 34/34 (2 lần) — thêm dừng sớm, học lại, Học hôm nay, Chữa bài → thử lại, trang cặp, Đề cương, Nghe, Sổ lỗi; các agent tự soát thêm bằng Playwright (1440/390 px, sáng/tối) |
| Dữ liệu thật (chỉ đọc) | validate 0 lỗi / 0 cảnh báo · 133 cụm câu anh em (287 câu, lớn nhất 5) · 5 nhóm dịch vụ dễ nhầm · đề cương 189 mục (chép từ trang AWS 2026-10-20), 50 mục chưa có câu · `stale-fact` gắn cờ 58 câu (11 mục `currency:` đều có nguồn AWS) · `results/sealed.md` không đổi, 0 id niêm phong trong mọi thay đổi |
| Hiệu năng (5.000 câu) | `clusterIndex` nguội 4,6 s → 0,18 s, `/api/state` nguội 4,7 s → 0,13 s, `composeToday` 20–30 ms, `computeProgress` 0,1–0,2 s (memo theo dữ liệu) |
| Rà soát độc lập | 3 agent (chọn câu & động cơ · làm bài / UI / gia sư / rò rỉ đề niêm phong · bảo mật / nền tảng / AI): **0 rò rỉ câu niêm phong** qua mọi route mới; ~40 lỗi được xác nhận (2 nặng: POST lạ khiến server production mở Vite và trả file thô cho điện thoại; unit systemd không chạy) → **đã sửa hết kèm test hồi quy** |
| Lỗi tìm thấy & sửa khi tích hợp | phiên kế hoạch mất quỹ phút / cặp dịch vụ / bài gốc; "Học hôm nay" rỗng khi câu mới bị dừng; trang mở trước khi build lại hỏng ở route tải lười; lượt chấm của Anki / Nghe bị coi là "làm vội"; loại câu giữa lượt AI bị lượt hoàn tác đảo ngược |
