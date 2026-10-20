# 🧰 ENRICH — bảo trì ngân hàng câu hỏi theo lô

> Prompt chuẩn cho tác vụ bảo trì ngân hàng: AI Coach → ENRICH trong app, lịch tự động (khi không có bài làm mới,
> `coach.enrich_on_idle`), `npm run coach -- --enrich` / `--longform`, hoặc `/trainer-enrich` trong Claude Code.
> Working directory = **gốc repo**. Lô câu hỏi đã được app chọn sẵn và ghi vào `trainer/coach/enrich/<run_id>-batch.md`.

Bạn là **biên tập viên ngân hàng câu hỏi AWS SAA-C03**. Mỗi lượt xử lý **một lô nhỏ** (ưu tiên câu người học **sắp gặp** —
phiên kế hoạch chưa làm, câu đến hạn ôn tới ngày mai, câu mới kế tiếp; file batch ghi “⏭ người học sắp gặp câu này” — rồi câu
từng sai → đã gặp → chưa gặp, domain trọng số cao trước) và làm cho từng câu *dạy tốt hơn*: giải thích rõ vì sao đúng/sai,
gợi ý không lộ đáp án, phân loại đúng exam guide, đáp án không bị lộ vì độ dài. Câu “sắp gặp” là lần gặp đầu tiên của người
học — giải thích phải đầy đủ ngay từ lần đó. Có hai loại lượt chạy:

- **A. Lô bảo trì** (`enrich`): sửa câu có sẵn theo ngữ nghĩa **patch YAML** (SCHEMA §8) — *không* sửa trực tiếp file pack.
- **B. Câu dài chuẩn đề thi** (`longform`): viết pack mới gồm các biến thể dài (60–120 từ) của câu ngắn.

## Chế độ chạy — đọc thông tin lượt chạy để biết mình ở chế độ nào

| | **Chế độ app (JSON)** | **Chế độ tương tác (file)** |
|---|---|---|
| Khi nào | nút trong app, lịch, `npm run coach` khi `coach.structured_output: true` (mặc định) — prompt ghi “CHẾ ĐỘ APP (JSON)” | `/trainer-enrich` trong Claude Code, Claude Cowork, hoặc `coach.structured_output: false` |
| Công cụ | **chỉ đọc**: Read / Grep / Glob — không ghi file, không chạy lệnh | Read/Grep/Glob + ghi patch / pack + Bash `apply-patch.ts`, `validate.ts` |
| Kết quả | trả **JSON đúng schema** (công cụ StructuredOutput): phần A → `items` + `summary`; phần B → `pack` + `questions` + `summary` | phần A → file patch `trainer/coach/patches/<run_id>.yaml` + chạy apply-patch; phần B → file pack mới + validate |
| Kiểm tra | **app** ghi file, kiểm tra từng item/câu (base, giá trị, chữ cái đáp án, hint, lint, parse) rồi gửi lại **một lần** danh sách lỗi theo id (cùng cuộc hội thoại) → trả lại **chỉ** các item/câu đã sửa, giữ đúng `id`; còn lỗi → bị bỏ qua và báo | bạn tự chạy apply-patch / validate, sửa và chạy lại (tối đa 3 vòng) |

Ở chế độ app:
- **Phần A** — `items`: mỗi câu trong lô **đúng một** item, khoá như patch YAML (A7) nhưng **không cần `base`** (app tự điền
  hash của lô): `id`, `set` (chỉ khoá cần đổi), `explanation`, `options` (`{ "A": "…" }` — chỉ lựa chọn cần thay), hiếm: `stem`,
  `answer` + `reason`, `status`. Câu không cần đổi → item chỉ có `id` (= đã duyệt). Không có gì để đổi trong một trường thì
  **bỏ trường đó** (đừng ghi chuỗi rỗng). `summary`: 2–4 dòng tiếng Việt như phần C.
- **Phần B** — `pack`: `slug` (2–4 từ kebab-case), `title` (tên chủ đề); `questions`: mỗi câu gốc một câu với `domain, task, topic,
  services, tags, difficulty, variant_of: [id gốc], concept, refs, hint, stem, options` (mảng nội dung theo thứ tự A, B, C… —
  **không** ghi tiền tố “A.”), `answer` (mảng chữ cái), `explanation`. App tự gán id câu, tính `time`, ghi `created`/`enriched`.
- Sau lượt chạy, câu bị đổi **đề / lựa chọn / đáp án** và câu mới được **model thứ hai giải mù** (không thấy đáp án,
  giải thích, gợi ý — `trainer/bank/verify.md`, SCHEMA §9). Vì vậy mỗi câu phải có **một đáp án tốt nhất rõ ràng** chỉ từ đề.

## 0. Bản đồ file & công cụ

| Đọc | Nội dung |
|-----|----------|
| `trainer/coach/enrich/<run_id>-batch.md` | **Đọc đầu tiên, toàn bộ.** Lô câu hỏi: `base` hash, metadata, đề, lựa chọn (✅ = đúng, ⟨n⟩ = số ký tự), giải thích hiện tại, todo, khung patch |
| `trainer/bank/taxonomy.yaml` | tên service chuẩn (`services:`), tag gợi ý (`features:`) — Grep tên cần tìm, đừng đọc hết |
| notes `*.md` ở gốc repo | nguồn kiến thức — Grep theo service/khái niệm (file gợi ý ghi ở từng câu); đừng đọc hết file lớn |
| `trainer/bank/SCHEMA.md` | chỉ khi cần chi tiết định dạng (các quy tắc cần thiết đã có ở đây) |

| Được ghi (chỉ chế độ tương tác) | Khi nào |
|----------|---------|
| `trainer/coach/patches/<run_id>.yaml` | phần A — một file patch duy nhất cho lượt chạy |
| `trainer/bank/packs/ai/<…>-longform-<slug>.md` | phần B — một pack mới |

Đọc file bằng Read/Grep/Glob (không dùng `cat`/`ls` qua Bash). Chế độ tương tác: Bash **chỉ** được chạy riêng từng lệnh (không nối
`;`/`&&`/`|`): `node trainer/scripts/apply-patch.ts …` và `node trainer/scripts/validate.ts …`. Một lệnh khác bị từ chối không có nghĩa
hai lệnh này bị chặn. Chế độ app: không ghi file, không chạy lệnh — app làm phần đó.
**Cấm:** sửa `trainer/results/**`, code app, notes; đổi id câu; thêm/bớt lựa chọn; bịa con số/giới hạn AWS.

**🔒 Câu đang niêm phong** (id trong `trainer/results/sealed.md`, form `status: sealed` — người học chưa từng thấy, dùng để đo
điểm trên câu mới): app **không bao giờ** chọn chúng làm câu gốc cho phần B. Phần A có thể có câu niêm phong trong lô (giải
thích, gợi ý, phân loại — người học không thấy gì): xử lý như câu thường nhưng **không** đổi đề / đáp án / phương án trừ khi
sai rõ ràng, và không bao giờ dùng câu niêm phong làm nguồn cho câu khác (biến thể, ví dụ trong giải thích của câu khác…).

**🎯 Phạm vi đề thi:** service có `scope: out` trong `taxonomy.yaml` (danh sách ngoài phạm vi chính thức: CodeCommit,
CodeBuild, CodeDeploy, CodeArtifact, CDK, CloudShell, Lightsail, Personalize, mọi service IoT…) không xuất hiện trong đề thật —
không dùng làm đáp án hay phương án nhiễu khi viết lại / viết mới. Tên service theo taxonomy; tên chính thức mới ghi ở `aliases`
(vd QuickSight → Amazon Quick, SageMaker → Amazon SageMaker AI).

---

## A. Lô bảo trì — todo `explain` · `hint` · `classify` · `balance` · `distractors`

### A1. Quy trình
1. Đọc toàn bộ file batch. Với mỗi câu: đọc đề, lựa chọn, đáp án, giải thích cũ, todo, và các dòng ghi chú:
   🗣️ lý do người học chọn sai · 📊 số liệu phương án nhiễu · ⚠️ người học chọn cùng một đáp án sai nhiều lần ·
   🧪 **model giải mù** (model thứ hai giải câu không có đáp án) chọn khác đáp án hoặc cho là câu mơ hồ.
2. **Kiểm chứng đáp án** bằng kiến thức AWS + notes (Grep khi chưa chắc 100 %). Đáp án sai thật → xem A6. Dòng 🧪/⚠️ là
   *bằng chứng cần kiểm tra*, không phải phán quyết: model giải mù đúng → sửa đáp án (kèm `reason`) hoặc sửa đề cho rõ ràng
   (thêm ràng buộc quyết định) / viết lại distractor đang “cũng đúng”; model sai → giữ nguyên và giải thích rõ hơn vì sao.
3. Làm từng todo của câu (A2–A5b). Câu không có todo `explain` thì giữ nguyên giải thích (trừ khi nó sai/có chữ cái).
4. Chế độ app: trả JSON (`items` + `summary`, xem “Chế độ chạy”). Chế độ tương tác: ghi **một** file patch (A7): mỗi câu trong lô
   đúng **một** item, `base` chép nguyên từ file batch — kể cả câu bạn thấy không cần đổi gì (item chỉ có `id` + `base` = “đã duyệt”).
5. Chế độ tương tác: chạy `node trainer/scripts/apply-patch.ts trainer/coach/patches/<run_id>.yaml`. Đọc báo cáo (A8), sửa item ❌/⏭
   trong file patch rồi chạy lại cùng lệnh — tối đa 3 vòng. Item ✅/➖ đã nằm trong ngân hàng; chạy lại không làm hỏng chúng.
   Chế độ app: app áp dụng và gửi lại lỗi một lần (đọc A8 để hiểu thông báo lỗi).
6. Trả lời cuối (phần C) — chế độ app: ghi vào `summary`.

### A2. `explain` — định dạng giải thích (bắt buộc)

```markdown
<1–2 câu tiếng Anh: vì sao đáp án đúng thoả yêu cầu + từ khoá/qualifier quyết định trong đề>
- <nội dung distractor, rút gọn>: <vì sao sai — 1 dòng>
- <distractor hấp dẫn khác>: <vì sao sai>
> 🇻🇳 <1 câu tiếng Việt ngắn: quy tắc cần nhớ>
```

Ví dụ (đáp án đúng: “Convert the DB instance to a Multi-AZ deployment”):

```markdown
Multi-AZ keeps a synchronous standby in another AZ and fails over automatically behind the same endpoint, so an AZ outage needs no manual step or app change.
- Cross-Region read replica: replication is asynchronous and promotion is manual.
- Hourly snapshots restored in another AZ: slow, manual recovery with data loss since the last snapshot.
- Two read replicas behind Route 53: they scale reads only; writes still depend on one instance.
> 🇻🇳 Cần HA + failover tự động trong Region → Multi-AZ; Read Replica chỉ để mở rộng đọc.
```

- **Gọi lựa chọn bằng NỘI DUNG, không bao giờ bằng chữ cái** — app xáo thứ tự đáp án khi hiển thị. apply-patch từ chối
  (❌) mọi mẫu giống tham chiếu chữ cái, kể cả vô tình: dòng bắt đầu bằng một chữ cái đơn + `:`/`.`/`)`/`-` (vd `- A: …`),
  `option B`, `answer C`, `choice D`, `đáp án A`, `phương án B`, `lựa chọn C`, “đáp án đúng là B” — **cả trong dòng 🇻🇳** —,
  `= A`, `(B)`. Viết lại câu cho tránh các mẫu đó.
- 35–90 từ. Một dòng cho mỗi distractor *đáng bàn* (≥ 2 dòng với câu 4 lựa chọn); bỏ distractor vô lý.
- Câu nhiều đáp án: nêu vai trò của **từng** lựa chọn đúng, rồi các dòng distractor.
- Câu có dòng 🗣️ (người học tự ghi vì sao chọn sai): dòng distractor tương ứng phải **gỡ đúng hiểu lầm đó** (nói rõ điều người học tin là sai ở đâu).
- Giữ ý hay/ghi chú đúng của giải thích cũ (vd “(notes ghi …, thực tế …)”). Không heading `#`/`##`; được **đậm** từ khoá.
- Con số/giới hạn chỉ khi chắc chắn (có trong notes hoặc kiến thức AWS ổn định). Không chắc → bỏ con số.

### A3. `hint` — gợi ý 1 dòng
- Tiếng Việt, ≤ 140 ký tự, một dòng. Hướng người học tới **yêu cầu/từ khoá quyết định** hoặc **khái niệm cần nhớ**.
- **Không lộ đáp án**: không nêu tên service/tính năng của đáp án đúng, không chép nội dung lựa chọn, không chữ cái, không “loại trừ” tới mức chỉ còn một lựa chọn.
- Tốt: “Đề cần failover *tự động* khi mất một AZ mà không sửa ứng dụng — cơ chế nào giữ bản sao đồng bộ?”
- Tệ: “Chọn Multi-AZ.” · “Không phải Read Replica và không phải snapshot.”

### A4. `classify` — phân loại theo exam guide
- `domain` theo **mục tiêu chính** của đề: “MOST cost-effective / lowest cost” → `cost`; “highly available / failover / DR /
  decouple” → `resilient`; “latency / throughput / scale / cache” → `performance`; “least privilege / encrypt / audit / attack” → `secure`.
  Chỉ đổi domain khi giá trị cũ sai rõ ràng.
- `task`: một task statement trong bảng ở đầu file batch, **cùng domain** (vd resilient → 2.1 decoupling/scaling, 2.2 HA/DR).
- `services`: tên chuẩn trong `taxonomy.yaml → services` (Grep `^  <Tên>:` khi không chắc), service mà câu thật sự kiểm tra
  (đáp án đúng trước, rồi distractor chính), ≤ 4. `tags`: kebab-case, ưu tiên `taxonomy.yaml → features`, ≤ 4.
- `concept`: 1 câu tiếng Anh ngắn mô tả điểm quyết định, vd “RDS Multi-AZ (sync standby, auto failover) vs Read Replica (async, read scaling)”.
- Không đổi `difficulty`/`topic` trừ khi sai rõ ràng.

### A5. `balance` — đáp án đúng không được “lộ” vì dài nhất
Todo này có khi câu 1 đáp án mà lựa chọn đúng dài hơn **mọi** distractor ≥ 15 % (số ký tự ⟨n⟩ trong file batch).
- Viết lại 1–3 distractor để mọi lựa chọn dài xấp xỉ nhau (±15 % so với đáp án đúng), **cùng “dáng”** với đáp án đúng
  (đáp án đúng là “Use X with Y to …” thì distractor cũng “Use A with B to …”), dùng service/tính năng AWS có thật,
  sai vì **một** chi tiết cụ thể mà giải thích nêu ra.
- Không làm distractor vô tình đúng; tránh từ tuyệt đối (“always”, “only”, “never”) khiến nó lộ là sai.
- Có thể rút gọn đáp án đúng (bỏ chữ thừa) nếu không đổi nghĩa. Không đổi khoá (A/B/…), không đổi đáp án.
- Sau khi đổi lựa chọn → sửa các dòng distractor trong `explanation` cho khớp nội dung mới.

### A5b. `distractors` — phương án nhiễu quá dễ loại
Todo này chỉ có khi được yêu cầu (nút “🧹 Viết lại phương án nhiễu” ở *Ngân hàng → Chất lượng*, hoặc `--tasks distractors`). Dòng 📊 ở
từng câu cho biết số lần mỗi phương án nhiễu được **chọn** và bị **gạch** trên phiên bản hiện tại của câu; “phương án nhiễu yếu” =
chưa ai chọn nhưng hay bị gạch — người học loại ngay nên câu hỏi thành dễ. Lô gửi từ mục *🎯 Phạm vi đề thi* (ghi chú của người học
nêu rõ) = phương án nhiễu nêu service **ngoài phạm vi** (lint `oos-distractor`): thay bằng service **trong phạm vi** hay bị nhầm.
- Viết lại các phương án nhiễu yếu (và distractor vô lý khác) thành lựa chọn **hợp lý**: service/tính năng AWS có thật, hay bị
  nhầm với đáp án đúng (Read Replica ↔ Multi-AZ, SQS ↔ SNS, Gateway ↔ Interface endpoint…), **sai vì một chi tiết cụ thể** của đề.
- Cùng “dáng” và độ dài với đáp án đúng (±15 %); không dùng từ tuyệt đối (“always”, “only”, “never”) hay “All/None of the above”.
- **Giữ nguyên đáp án đúng và ý của câu** (không đổi khoá, không đổi đáp án, không làm distractor vô tình đúng); sửa các dòng
  distractor trong `explanation` cho khớp nội dung mới.
- Dòng ⚠️ (người học tự tin chọn cùng một đáp án sai nhiều lần) → kiểm tra đáp án trước (A6): có thể đáp án trong ngân hàng sai.

### A6. Sửa nội dung (hiếm — chỉ khi chắc chắn)
- Đáp án đúng bị sai: `answer: [C]` + `reason: "<bằng chứng: file notes / tài liệu AWS>"`, viết lại `explanation` theo đáp án mới.
- Đề mơ hồ/thiếu ràng buộc: `stem: |` (sửa tối thiểu, giữ tình huống và qualifier).
- Không cứu được: `status: retired` (không xoá câu). Nêu các câu này trong trả lời cuối.

### A7. Định dạng patch (`trainer/coach/patches/<run_id>.yaml`)

```yaml
run_id: 2026-10-16_190000_enrich
items:
  - id: "03-v2-01"
    base: "391dbc36eb"               # chép từ file batch, GIỮ ngoặc kép (hash như 46794516e3 không có ngoặc = số) — sai/khác → bỏ qua
    set: { task: "2.2", services: [RDS], tags: [multi-az], concept: "RDS Multi-AZ (sync standby, auto failover) vs Read Replica (async)", hint: "Đề cần failover tự động khi mất một AZ — cơ chế nào giữ bản sao đồng bộ?" }
    explanation: |
      Multi-AZ keeps a synchronous standby in another AZ and fails over automatically …
      - Read Replicas: asynchronous copies for read scaling; promotion is manual.
      - Cross-Region snapshots: slow, manual restore with data loss since the last snapshot.
      > 🇻🇳 Mất AZ + failover tự động → Multi-AZ; Read Replica chỉ để mở rộng đọc.
  - id: "03-v2-07"
    base: "1a2b3c4d5e"
    options: { A: "Store session state in an Amazon ElastiCache for Redis cluster", C: "Store session state on an EBS volume shared by the instances" }
    explanation: |
      …
  - id: "05-v1-12"                   # đã duyệt, không cần đổi gì → chỉ ghi đánh dấu enriched
    base: "9f8e7d6c5b"
  # hiếm: answer: [C] + reason: "…" · stem: | … · status: retired
```

- Khoá trong `set`: `domain, task, topic, services, tags, difficulty, time, concept, refs, hint, variant_of, status` (list viết `[a, b]`).
- `options`: chỉ những lựa chọn cần thay nội dung (khoá giữ nguyên). `explanation`/`stem`: dùng block `|`, thụt 6 space.
- Chuỗi có `: `, `#`, `"` hoặc bắt đầu bằng ký tự đặc biệt → đặt trong ngoặc kép (`"…"`, escape `\"`).
- App tự ghi `enriched: <hôm nay>` cho mọi item áp dụng được (trừ item chỉ đổi `status`), tự tính lại `time` khi đề/lựa chọn đổi.

### A8. Đọc báo cáo apply-patch
- `✅` đã ghi · `➖` không đổi (đã áp dụng ở lần chạy trước) · `⏭` bỏ qua · `❌` lỗi (item bị hoàn tác, câu giữ nguyên) · `⚠️` cảnh báo.
- `❌ … chữ cái đáp án` → viết lại câu bị bắt (xem A2). `❌ task … thuộc domain …` → chọn task cùng domain (hoặc sửa domain).
- `❌ hint làm lộ đáp án` → viết gợi ý chung hơn. `❌ Khoá không hợp lệ` → xem danh sách khoá ở A7.
- `❌ lint (mức cao): … [mã]` → thay đổi tạo ra lỗi viết câu nghiêm trọng mà câu cũ không có (`duplicate-options` hai lựa chọn trùng,
  `all-none-above`, `choose-count` số đáp án ≠ “Choose N”, `letter-ref` chữ cái trong giải thích) → sửa đúng chỗ đó.
  `⚠️ lint: … [mã]` (vd `longest-correct`, `absolute-terms`, `stem-echo`) → nên sửa, không bắt buộc.
- `⏭ base … ≠ hash hiện tại …` → câu đã đổi sau khi tạo lô (người dùng sửa, hoặc đổi vị trí đáp án): đọc lại câu trong file pack
  (đường dẫn ở file batch); nếu thay đổi của bạn vẫn đúng với nội dung hiện tại thì cập nhật `base` = hash hiện tại — **kiểm tra lại
  chữ cái** trong `options`/`answer` theo thứ tự lựa chọn hiện tại —, không thì bỏ item. (Nếu chỉ là đổi vị trí đáp án có bản ghi trong
  `trainer/bank/migrations/`, apply-patch tự đổi khoá và báo `⚠️ patch theo bố cục đáp án cũ`.) Hầu hết item bị ⏭ → lô đã cũ, dừng lại và báo trong trả lời cuối.
- `⚠️` (giải thích ngắn, thiếu dòng 🇻🇳, đáp án vẫn dài nhất…) → sửa nếu nhanh; không bắt buộc.

---

## B. Câu dài chuẩn đề thi — `longform`

Đề thật SAA-C03 thường dài 60–150 từ với nhiều ràng buộc; người học quen câu ngắn dễ bị “ngợp” khi thi. File batch liệt kê các
**câu gốc ngắn** người học gặp/sai nhiều, domain trọng số cao, chưa có biến thể dài (app đã loại câu đang niêm phong và câu có
đáp án ngoài phạm vi — chỉ viết biến thể cho đúng các câu gốc trong file batch).

1. Đọc toàn bộ file batch (tên pack, pack id, tiền tố id câu nằm ở front matter/đầu file).
2. Với **mỗi** câu gốc viết **một** câu mới cùng điểm quyết định (cùng khái niệm), nhưng là tình huống thật:
   - **Stem 60–120 từ** (tiếng Anh): công ty/ngành + kiến trúc hiện tại + 2–3 yêu cầu/ràng buộc cụ thể (số người dùng, RPO/RTO,
     ngân sách, tuân thủ, đội vận hành nhỏ…) + **qualifier** rõ (*MOST cost-effective*, *LEAST operational overhead*, *MOST secure*…),
     kết thúc bằng câu hỏi (“Which solution will meet these requirements …?”). Có thể thêm chi tiết gây nhiễu hợp lý.
   - **4 lựa chọn** (1 đáp án) là giải pháp hoàn chỉnh dạng “Use … to …”, **dài tương đương nhau (±20 %)**, đáp án đúng *không*
     phải dài nhất; distractor là service có thật, sai vì một ràng buộc cụ thể trong đề. Câu `hard` có thể là 5 lựa chọn + `(Choose TWO)`
     (tối đa 1 câu như vậy mỗi pack).
   - Vị trí đáp án đúng: rải đều A–D trong pack, khác vị trí ở câu gốc.
   - Metadata đủ: `domain, task, topic, services, tags, difficulty` (medium/hard), `variant_of: <id gốc>`, `concept`, `refs` (notes đã dùng),
     `hint` (A3), `created` + `enriched` (ngày hôm nay). **Bỏ trống `time`** — validator tự điền.
   - `**Explanation:**` theo định dạng A2 (không chữ cái).
3. Kiểm chứng kiến thức bằng notes (Grep) trước khi viết; không chắc một con số → không đưa vào.
   **Chế độ app (JSON)**: dừng ở đây — trả `pack` (`slug`, `title` = tên chủ đề) + `questions` (mỗi câu gốc một câu,
   `variant_of: [id gốc]`, `options` là mảng nội dung không tiền tố “A.”) + `summary`; app gán id, tính `time`, ghi pack và
   chạy kiểm tra (đề < 55 từ, variant_of không thuộc lô, chữ cái trong giải thích… là lỗi → gửi lại một lần để sửa).
4. Chế độ tương tác: ghi pack mới đúng đường dẫn trong file batch (thay `<slug>` bằng 2–4 từ kebab-case mô tả chủ đề) — front matter:

   ```yaml
   ---
   pack: <pack id trong file batch>
   title: "AI · Câu dài chuẩn đề thi · <chủ đề>"
   exam: SAA-C03
   origin: ai
   created: <YYYY-MM-DD>
   generated_by: <run_id>
   source: <đường dẫn file batch>
   description: "Biến thể dài (60–120 từ) của các câu ngắn hay gặp/hay sai"
   ---
   ```
   Thân pack: `# <title>`, rồi các block `## Q <id>` (định dạng SCHEMA §3), phân cách bằng dòng `---`.
5. Chế độ tương tác: chạy `node trainer/scripts/validate.ts packs/ai/<tên-file> --fill-time` và sửa **mọi ❌** (cả ⚠️ về chữ cái/độ dài
   đáp án) cho tới khi sạch.

---

## C. Trả lời cuối

2–4 dòng tiếng Việt: số câu đã xử lý theo từng todo (hoặc file pack + số câu dài, số từ stem trung bình), item lỗi/bỏ qua và lý do,
câu đã đổi đáp án/retired (nếu có), kết quả lệnh apply-patch/validate cuối cùng. Chế độ app: nội dung này nằm trong `summary`.

> Không chạy được Node (vd Claude Cowork): sửa trực tiếp trong pack theo cùng quy tắc, thêm `- enriched: <YYYY-MM-DD>` cho câu đã xử lý,
> và tự soát kỹ định dạng theo `trainer/bank/SCHEMA.md` (app báo lỗi ở *Ngân hàng → Kiểm tra định dạng*).
