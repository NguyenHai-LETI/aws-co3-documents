# 📐 Question Bank Schema (v2)

> Đặc tả định dạng ngân hàng câu hỏi — **nguồn sự thật duy nhất** cho người viết câu hỏi
> (bạn, AI Coach, AI Question Writer, ENRICH). App đọc trực tiếp các file này; không có database.
> Kiểm tra bất kỳ lúc nào: `node trainer/scripts/validate.ts [đường-dẫn-hoặc-chuỗi-con] [--warnings]`.
>
> v2: metadata `task` (exam guide 1.1–4.4), `hint`, `enriched`; giải thích **không nhắc chữ cái đáp án**; độ dài lựa chọn cân bằng;
> câu dài chuẩn đề thi (§4); patch YAML cho chỉnh sửa hàng loạt bằng AI (§8).
> v3: AI trả kết quả bằng JSON (structured output) và app tự ghi patch / pack (§8); lint lỗi viết câu sau mỗi chỉnh sửa (§8);
> giải mù bằng model thứ hai — `bank/verify.md` (§9).
> v4: app tự tính `requirements` (tiêu chí đề) và `outOfScope` (§3); service có `scope: out` / `aliases` trong taxonomy;
> lint `oos-answer` / `oos-distractor`; đề niêm phong — `results/sealed.md` (§10).
> v6: **tầng câu** A (giống đề thật) / B (tình huống ngắn) / C (câu ôn nhanh) — `tier` tự tính, bộ lọc `tiers`, thi thử ưu tiên tầng A;
> **chuẩn câu tầng A** cho câu AI viết + lint chuẩn đề (§6b); service `scope: legacy` (§3); giải mù xáo phương án + phép thử chỉ nhìn
> phương án `--scope cues` (§9); thêm đề niêm phong tầng A `seal --add --tier A` (§10).

---

## 1. Cấu trúc thư mục

```
trainer/bank/
├── SCHEMA.md            ← file này
├── taxonomy.yaml        ← domain, task (exam guide), topic, service, tag hợp lệ + rubric thời gian + từ khoá tô sáng
├── issues.md            ← lỗi câu hỏi người học báo (AI Coach xử lý)
├── ratings.md           ← 👍/👎 của người học cho từng câu
├── verify.md            ← kết quả giải mù của model thứ hai + quyết định duyệt/loại (§9, tự sinh)
├── migrations/          ← bản ghi chuyển đổi dữ liệu (vd đổi vị trí đáp án)
└── packs/               ← mỗi file .md = 1 "pack" (bộ câu hỏi)
    ├── imported/        ← import từ practice-exams/ (V1, V2) — origin: imported
    ├── ai/              ← AI Coach / ENRICH sinh — origin: ai
    ├── docs/            ← sinh từ tài liệu (notes, inbox/) — origin: doc
    └── manual/          ← bạn tự viết — origin: manual
```

- App quét **mọi** `*.md` trong `packs/**` (bỏ qua `README.md` và file bắt đầu bằng `_` hoặc `.`).
- Thêm câu hỏi = thêm file pack mới (khuyến nghị) hoặc thêm block câu hỏi vào pack có sẵn.
- Không cần khởi động lại app: app phát hiện file thay đổi và tự nạp lại.

## 2. File pack

```markdown
---
pack: ai-2026-10-16-1830            # id pack, kebab-case, duy nhất toàn ngân hàng
title: "AI · RDS HA vs Read Scaling"  # tên hiển thị
exam: SAA-C03
origin: ai                           # imported | ai | doc | manual
created: 2026-10-16
generated_by: 2026-10-16_183000_analyze   # (tuỳ chọn) run id của AI
source: trainer/coach/plans/2026-10-16-1830.md   # (tuỳ chọn) nguồn/tài liệu gốc
description: "Biến thể + câu mở rộng cho nhóm lỗi Multi-AZ/Read Replica"   # (tuỳ chọn)
defaults:                            # (tuỳ chọn) áp cho mọi câu nếu câu không ghi đè
  topic: database
---

# AI · RDS HA vs Read Scaling

(Đoạn giới thiệu tuỳ ý — parser bỏ qua mọi thứ không nằm trong block câu hỏi.)

## Q ai-20261016-1830-01
...block câu hỏi...

---

## Q ai-20261016-1830-02
...
```

## 3. Block câu hỏi

Một câu hỏi bắt đầu bằng heading `## Q <id>` và kết thúc ở heading `#`/`##` kế tiếp (hoặc hết file).
Thứ tự **bắt buộc**: heading → metadata → (dòng trống) → đề bài → đáp án lựa chọn → `**Answer:**` → `**Explanation:**`.

```markdown
## Q ai-20261016-1830-01
- domain: resilient
- task: 2.2
- topic: database
- services: RDS
- tags: multi-az, read-replicas
- difficulty: medium
- time: 85
- variant_of: 03-v2-01
- concept: RDS Multi-AZ (HA, sync standby) vs Read Replica (async, read scaling)
- refs: 03-database-services.md
- hint: Đề cần failover tự động khi mất một AZ mà không sửa ứng dụng — cơ chế nào giữ bản sao đồng bộ?
- enriched: 2026-10-16

A healthcare company runs PostgreSQL on Amazon RDS. The database must keep running with
automatic failover if an Availability Zone fails, and the solution must not require any
application changes. Which solution meets these requirements?

- A. Create a cross-Region read replica and promote it during an outage
- B. Convert the DB instance to a Multi-AZ deployment
- C. Take hourly snapshots and restore them in another AZ
- D. Add two read replicas in different AZs behind Route 53

**Answer:** B

**Explanation:** Multi-AZ keeps a synchronous standby in another AZ and fails over automatically
using the same DNS endpoint, so no application change is needed.
- Cross-Region read replica: promotion is manual and replication is asynchronous (possible data loss).
- Hourly snapshots: restore is slow and manual (high RTO/RPO).
- Read replicas behind Route 53: they scale reads; promotion is manual and writes are not protected.
> 🇻🇳 Cần HA + failover tự động trong Region → Multi-AZ; Read Replica chỉ để mở rộng đọc.
```

Câu nhiều đáp án (multiple-response):

```markdown
## Q ai-20261016-1830-02
- domain: performance
- task: 3.3
- topic: database
- services: Aurora
- tags: aurora-endpoints, read-replicas
- difficulty: hard
- time: 110
- hint: Một endpoint luôn đi theo writer, một endpoint chia tải đọc — sau failover ứng dụng vẫn dùng đúng tên.

An analytics dashboard overloads the writer of an Aurora MySQL cluster. The team wants to
offload reads automatically and keep connecting to the same endpoints after a failover.
Which TWO actions should a solutions architect take? (Choose TWO)

- A. Add Aurora Replicas and point read traffic to the reader endpoint
- B. Point write traffic to the cluster (writer) endpoint
- C. Hard-code the instance endpoint of the current writer
- D. Enable Multi-AZ on each reader individually
- E. Use DynamoDB Accelerator (DAX) in front of the cluster

**Answer:** A, B

**Explanation:** The reader endpoint load-balances across Aurora Replicas and the cluster endpoint always follows the writer, so both keep working after a failover.
- Instance endpoint of the writer: breaks when another instance is promoted.
- Multi-AZ per reader: not an Aurora setting; replicas already span AZs.
- DAX: caches DynamoDB, not Aurora.
> 🇻🇳 Aurora: ghi qua cluster endpoint, đọc qua reader endpoint.
```

### Quy tắc từng phần

| Phần | Quy tắc |
|------|---------|
| Heading | `## Q <id>` — id: `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–60 ký tự, **duy nhất toàn ngân hàng** |
| Metadata | mỗi dòng `- key: value`, ngay dưới heading, trước đề bài. Danh sách = phân tách bằng dấu phẩy |
| Đề bài | Markdown tự do (nhiều đoạn OK). Không dùng heading `#`/`##` bên trong |
| Lựa chọn | mỗi dòng `- A. text` (hoặc `A)`), chữ cái liên tục từ A. 4 lựa chọn cho câu 1 đáp án; 5–6 cho câu nhiều đáp án. Dòng tiếp nối thụt ≥ 2 space. Các lựa chọn **dài tương đương nhau** (§6) |
| Đáp án | `**Answer:** B` hoặc `**Answer:** A, C`. Câu nhiều đáp án **phải** có `(Choose TWO)` / `(Choose THREE)` trong đề và số đáp án khớp ([v6] cách viết của đề mẫu chính thức `(Select TWO.)` / `(Select THREE.)` cũng được chấp nhận) |
| Giải thích | `**Explanation:** …` — Markdown, có thể nhiều dòng/danh sách tới hết block. Không dùng `#`/`##` (dùng `###` hoặc chữ đậm). **Không nhắc chữ cái đáp án** (xem dưới) |
| Phân cách | Dòng `---` giữa các câu (có dòng trống phía trên) — tuỳ chọn, giúp dễ đọc |

**Giải thích không dùng chữ cái.** App xáo thứ tự lựa chọn khi hiển thị, nên “A sai vì…” sẽ trỏ nhầm. Gọi lựa chọn bằng
**nội dung** (“Read Replicas: …”). Validator cảnh báo (và `apply-patch` từ chối) các mẫu: dòng bắt đầu bằng một chữ cái đơn +
`:`/`.`/`)`/`-` (`- A: …`), `option B` / `answer C` / `choice D` / `đáp án A` / `phương án B` / `lựa chọn C` (cả “đáp án đúng là B”),
`= A`, `(B)` — chữ cái viết hoa A–H (“answer a few”, “RPO = a few minutes” là văn xuôi, không bị bắt).

**Định dạng giải thích khuyến nghị** (ENRICH dùng định dạng này): 1–2 câu tiếng Anh vì sao đáp án đúng thoả yêu cầu + mỗi
distractor hấp dẫn một dòng `- <nội dung>: <vì sao sai>` + dòng cuối `> 🇻🇳 <tóm tắt tiếng Việt>`; 35–90 từ.
[v6] Câu tầng A (§6b): 50–120 từ, **mọi** phương án nhiễu một dòng kèm nhãn lý do sai, ≥ 1 URL tài liệu AWS.

### Metadata

| Key | Bắt buộc | Giá trị |
|-----|----------|---------|
| `domain` | ✅ | `secure` (D1, 30%) · `resilient` (D2, 26%) · `performance` (D3, 24%) · `cost` (D4, 20%) — chọn theo **mục tiêu chính** của câu (từ khoá "MOST cost-effective" → cost; "highly available/failover/DR/decouple" → resilient; "latency/throughput/cache/scale" → performance; "least privilege/encrypt/attack" → secure) |
| `topic` | ✅ | một id trong `taxonomy.yaml → topics` (compute, storage, database, networking, security, management, integration, devtools, analytics, migration, api, ml, other, resilience, cost) |
| `difficulty` | ✅ | `easy` (1 khái niệm, nhận diện trực tiếp) · `medium` (tình huống áp dụng, 2 đáp án gần đúng) · `hard` (kết hợp nhiều khái niệm, bẫy, multi-response) |
| `time` | ✅ | giây, số nguyên — tính theo rubric §4 |
| `task` | khuyến nghị | task statement của exam guide trong `taxonomy.yaml → tasks`: `1.1`–`1.3` (secure), `2.1`–`2.2` (resilient), `3.1`–`3.5` (performance), `4.1`–`4.4` (cost) — **phải cùng domain** (ghi trong ngoặc kép nếu viết trong YAML: `"2.2"`) |
| `services` | khuyến nghị | tên chuẩn trong `taxonomy.yaml → services` (vd `RDS Proxy`, `S3`, `Transit Gateway`). Service mới → thêm vào taxonomy. Service có `scope: out` (danh sách **ngoài phạm vi** chính thức của SAA-C03) hoặc [v6] `scope: legacy` không dùng cho câu mới — kể cả làm phương án nhiễu |
| `tags` | khuyến nghị | khái niệm kebab-case, ưu tiên tag có sẵn trong `taxonomy.yaml → features` (vd `multi-az`, `s3-lifecycle`) |
| `variant_of` | khi là biến thể | id câu gốc (có thể nhiều, phân tách dấu phẩy) |
| `skills` | khuyến nghị (AI) | [v5] mục đề cương chính thức mà câu kiểm tra: `<task>.k<n>` (Knowledge of) / `<task>.s<n>` (Skills in) theo `bank/exam-guide/SAA-C03.yaml`, vd `3.5.s7, 3.5.k4` (ENRICH classify ghi). Không ghi → app **đoán** bằng từ khoá (`SAA-C03-cues.yaml`, chỉ trong `task` của câu) và không bao giờ ghi lại bản đoán vào file |
| `family` | khi là họ câu | [v5] id họ câu “cùng tình huống, đổi yêu cầu” (kebab-case): các câu cùng họ dùng **y nguyên một bộ phương án** và chỉ khác câu hỏi cuối (MOST cost-effective / LEAST operational overhead …) — lint `family-options` |
| `concept` | khuyến nghị (AI) | 1 câu ngắn mô tả khái niệm được kiểm tra — AI Coach dùng để gom nhóm điểm yếu |
| `hint` | khuyến nghị | **một dòng** tiếng Việt (≤ 140 ký tự) hiện khi người học bấm “💡 Gợi ý” ở chế độ luyện tập: hướng tới yêu cầu/từ khoá quyết định, **không lộ đáp án** (không nêu tên đáp án đúng, không chữ cái) |
| `refs` | tuỳ chọn | file notes liên quan, vd `03-database-services.md` hoặc `03-database-services.md#rds-proxy` (app mở như link notes — [v6] URL tài liệu AWS của câu tầng A đặt trong giải thích, §6b) |
| `status` | tuỳ chọn | `active` (mặc định) · `draft` (chưa dùng trong test) · `retired` (ngừng dùng — **không xoá câu**) |
| `created` | tuỳ chọn | `YYYY-MM-DD` |
| `enriched` | tự động | `YYYY-MM-DD` lần cuối ENRICH (patch AI) cải thiện/duyệt câu — app dùng để biết câu nào còn cần bảo trì |
| `source` | tuỳ chọn | nguồn gốc (file + vị trí) |

App tự tính thêm (không ghi vào file): `words` (số từ của đề), `longForm` (đề ≥ `timing.long_form_min_words` = 55 từ), `hash`
(mã 10 ký tự của đề + lựa chọn + đáp án — dùng làm `base` trong patch §8) và:

- `requirements` — **tiêu chí đề** mà đề bài yêu cầu tối ưu: các nhóm `taxonomy.yaml → keywords` tìm thấy trong đề (`cost`, `ops`,
  `resilient`, `performance`, `secure`; nguyên từ, từ VIẾT HOA phân biệt hoa/thường — cùng quy tắc với tô sáng từ khoá) + `negative`
  cho câu hỏi phủ định (NOT/EXCEPT viết hoa trong câu hỏi, “LEAST likely/suitable…”; “LEAST operational overhead” là `ops`, không
  phải phủ định). Không có tiêu chí nào → `[]`. Dùng cho bộ lọc “tiêu chí đề” và thống kê “Theo tiêu chí đề”.
- `outOfScope` — `true` khi một phương án **đúng** nêu service có `scope: out` trong taxonomy (danh sách ngoài phạm vi chính thức
  của SAA-C03, đối chiếu 2026-10-20) hoặc [v6] `scope: legacy`. `practice.exclude_out_of_scope: true` (mặc định) loại các câu này khỏi
  mọi chế độ luyện trừ “Theo bộ đề” và danh sách id; đề niêm phong và [v6] thi thử không bao giờ chọn chúng (kể cả khi tắt tuỳ chọn đó).
  Lint: `oos-answer` (mức vừa) cho đáp án, `oos-distractor` (mức nhẹ) cho phương án nhiễu nêu service ngoài phạm vi / legacy.
- `tier` — [v6] **tầng câu**: `A` chuẩn đề (giống đề thật + có tiêu chí quyết định) · `B` tình huống ngắn · `C` ôn nhanh — định nghĩa
  và nơi dùng ở §6b (`shared/tier.ts`). Bộ lọc `tiers` (Tùy chỉnh, thi thử); tính lại mỗi khi đề / phương án đổi.

- `cluster` — [v5] nhóm **câu anh em** (`server/lib/clusters.ts`, chỉ có khi nhóm ≥ 2 câu, id nhóm = id nhỏ nhất): `variant_of` hai
  chiều ∪ câu gần trùng chữ / theo nghĩa ∪ cùng chủ đề + cùng đáp án đúng + đề giống ≥ 0,25 ∪ đề giống ≥ 0,5 khi cùng chủ đề hoặc cùng
  đáp án. Chống “dây chuyền”: câu giống hơn 8 câu khác là văn mẫu (không tính), nhóm theo chữ tối đa 6 câu. Một phiên chỉ ra một câu
  mỗi nhóm; làm một câu thì các câu cùng nhóm để sang hôm sau.
- `skills` (khi không ghi trong file) + `skillsGuessed: true` — mục đề cương đoán bằng từ khoá (xem bảng trên).

**Taxonomy — kiến thức đã thay đổi (`currency:`, [v5]):** mỗi mục `{id, pattern, unless?, fact, since, url}` — `pattern` (regex,
không phân biệt hoa thường) trên đề + phương án + giải thích nói kiến thức cũ, `unless` = câu đã dùng cách viết hiện hành thì bỏ qua.
Lint `stale-fact` (mức vừa) báo câu cần cập nhật kèm URL. **Chỉ thêm mục đã đối chiếu trên trang chính thức của AWS** (docs / blog /
What's New), ghi URL — không thêm từ trí nhớ. Sửa câu: viết “tên mới (tên cũ)” hoặc giới hạn mới. [v6] Đợt đối chiếu 2026-10-22 thêm
các thay đổi 2022 → 10/2026 (dịch vụ đóng với khách mới, giới hạn mới, đổi tên); soát định kỳ theo ba danh sách vòng đời chính thức:
[maintenance](https://docs.aws.amazon.com/general/latest/gr/maintenance_services.html) ·
[sunset](https://docs.aws.amazon.com/general/latest/gr/sunset_services.html) ·
[full shutdown](https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html).

**Đề cương (`bank/exam-guide/`, [v5]):** `SAA-C03.yaml` = đề cương chính thức chép **nguyên văn** (189 mục, URL + ngày lấy) — không
sửa tay, muốn cập nhật thì lấy lại trang và chép lại cả file; `SAA-C03-cues.yaml` = từ khoá đoán mục (của app, được sửa).

**Taxonomy — phạm vi đề thi:** mỗi service có thể ghi `scope: out` (ngoài phạm vi) và `aliases: [...]` (tên chính thức hiện tại /
tên mới, vd `QuickSight` → `Amazon Quick`; chỉ để hiển thị — muốn nhận diện tên đó trong câu hỏi thì thêm vào `match`). Không ghi
`scope` = trong phạm vi hoặc chưa được liệt kê (danh sách chính thức không đầy đủ) — không bị loại.
[v6] `scope: legacy` = service **bị gỡ khỏi danh sách trong phạm vi** chính thức (vd Data Pipeline, QLDB) hoặc **đã ngừng mà không có
service kế nhiệm trong phạm vi** (vd Elastic Transcoder — MediaConvert ngoài phạm vi). Xử lý **như `scope: out`** ở mọi nơi:
`outOfScope`, loại khỏi luyện / thi thử / đề niêm phong, lint `oos-answer` / `oos-distractor` (thông báo ghi rõ “legacy”), độ phủ có
mục riêng. Service còn trong phạm vi nhưng đã **đóng với khách hàng mới** (Snowball Edge, S3 Glacier vault API, S3 Select…) không
nhất thiết là `legacy`, nhưng §6b vẫn cấm dùng chúng làm đáp án đúng cho câu mới (mục `currency:` ghi ngày đóng + URL).

## 4. Rubric thời gian (`time`) & câu dài chuẩn đề thi

Chuẩn SAA-C03: **130 phút / 65 câu ≈ 120 giây** cho một câu dài chuẩn (~170 từ gồm cả đáp án).
Đồng hồ của mỗi bài test = **tổng `time` của các câu trong bài** (× hệ số người dùng chọn).

```
words  = số từ (đề bài + tất cả lựa chọn)
read   = words × 60 / 130                (tốc độ đọc kỹ ~130 từ/phút)
think  = easy 30 · medium 40 · hard 55   (giây suy luận)
bonus  = 20 nếu 2 đáp án · 30 nếu ≥ 3 đáp án
time   = làm tròn tới bội số 5 của (read + think + bonus), kẹp trong [45, 180]
```

| Ví dụ | words | difficulty | Answer | time |
|-------|-------|-----------|--------|------|
| Câu ngắn kiểu V1 | 40 | easy | 1 | 50 |
| Câu tình huống vừa | 90 | medium | 1 | 80 |
| Câu chuẩn đề thật | 170 | medium | 1 | 120 |
| Câu dài, bẫy, chọn 2 | 220 | hard | 2 | 175 |

> Không muốn tự đếm từ? Bỏ trống `time` rồi chạy `node trainer/scripts/validate.ts <file> --fill-time`
> — script tự chèn `- time: N` theo đúng rubric (tham số nằm ở `taxonomy.yaml → timing`).

**Câu dài (long-form).** Đề thật thường 60–150 từ với nhiều ràng buộc (đề mẫu chính thức: 33–97 từ, trung vị ~62). Câu có đề ≥ 55 từ
được tính là *câu dài*: mức sẵn sàng cho câu dài trọng số cao hơn, thi thử ưu tiên câu dài. Khi viết câu mới mức `medium`/`hard`, viết
theo **chuẩn tầng A (§6b)**: đề **55–130 từ** — bối cảnh công ty + kiến trúc hiện tại + 2–4 ràng buộc cụ thể + qualifier rõ ràng —,
các lựa chọn là giải pháp hoàn chỉnh 8–35 từ, dài tương đương nhau.

## 5. Id & vòng đời câu hỏi

- **Không bao giờ đổi id hoặc xoá câu** — file kết quả (`trainer/results/`) tham chiếu theo id. Muốn bỏ: `- status: retired`.
- Quy ước id: `<chương>-v1-<nn>` / `<chương>-v2-<nn>` (imported) · `ai-<YYYYMMDD>-<HHmm>-<nn>` (AI Coach) · `ai-<YYYYMMDD>-<HHmm>-lf<nn>` (câu dài ENRICH) · `doc-<slug>-<nn>` (từ tài liệu) · tuỳ ý cho manual (kebab-case).
- Sửa nội dung câu (đáp án sai, đề mơ hồ…): sửa tại chỗ, giữ id (hoặc qua patch §8). App hiển thị cảnh báo ở màn hình kết quả cũ nếu đáp án đã đổi.
- Biến thể (`variant_of`): cùng khái niệm, **tình huống/ngữ cảnh/thứ tự đáp án khác** — không chỉ đổi vài chữ. Tối đa 3 biến thể/câu gốc.

## 6. Tiêu chuẩn chất lượng (bắt buộc với câu AI viết)

Áp dụng cho mọi câu. [v6] Câu `medium`/`hard` AI viết mới còn phải đạt **chuẩn tầng A (§6b)** — chuẩn đó siết thêm các mục dưới đây
(đề 55–130 từ, phương án 8–35 từ, giải thích 50–120 từ có nhãn lý do sai + URL tài liệu AWS, 25–30 % câu nhiều đáp án…).

1. **Một đáp án tốt nhất duy nhất** (hoặc đúng N đáp án với `Choose N`) — kiểm tra lại từng distractor.
2. Văn phong SAA-C03: tình huống doanh nghiệp + yêu cầu + từ khoá quyết định (*MOST cost-effective, LEAST operational overhead, highly available, MOST secure…*).
3. Distractor **hợp lý**: service/tính năng AWS có thật, hay bị nhầm (vd Read Replica ↔ Multi-AZ, SQS ↔ SNS, Gateway ↔ Interface endpoint). Không dùng "All of the above"/"None of the above".
4. **Độ dài cân bằng**: các lựa chọn dài tương đương nhau và cùng “dáng” câu; đáp án đúng **không** được dài hơn mọi distractor ≥ 15 % (người học đoán được đáp án nhờ độ dài). Tránh từ tuyệt đối (“always”, “only”) làm distractor lộ là sai.
5. Không bịa số liệu/giới hạn. Kiến thức có thể đã đổi theo thời gian → bám **notes trong repo**; nếu không chắc thì không đưa con số vào câu.
6. Giải thích 35–90 từ theo định dạng khuyến nghị ở §3: vì sao đáp án đúng + 1 dòng cho mỗi distractor quan trọng + tóm tắt 🇻🇳 — **gọi lựa chọn bằng nội dung, không bằng chữ cái**.
7. Có `task` (cùng domain) và `hint` (một dòng, không lộ đáp án).
8. Đáp án đúng phân bố đều A/B/C/D — tránh dồn vào B.
9. Đề bài tiếng Anh (giống đề thật); câu `medium`/`hard` ưu tiên dạng câu dài (§4) — câu AI viết mới: chuẩn tầng A (§6b).

## 6b. Chuẩn câu tầng A (exam-grade) — [v6]

> **Vì sao.** Đo ngày 2026-10-22 trên 764 câu active: đề trung vị **18 từ** (đề mẫu chính thức ~62, 33–97); chỉ **18 câu (2,4 %)** giống
> đề thật; **73 %** câu có phương án là tên service trơn; **30 %** có qualifier; **8,5 %** câu nhiều đáp án (đề mẫu 3/10); giải thích
> trung vị **9 từ**. Luyện trên câu như vậy đo trí nhớ câu ngắn, không đo khả năng làm đề thật. Chuẩn dưới đây lấy từ exam guide + đề
> mẫu chính thức (tự đo, không chép), nguyên tắc viết câu trắc nghiệm (Haladyna, Downing & Rodriguez 2002; NBME Item-Writing Guide) và
> nghiên cứu về câu trắc nghiệm do LLM viết (câu dễ hơn đề thật, nhiều manh mối, đoán được chỉ nhờ phương án).

**Áp dụng cho:** mọi câu `medium`/`hard` AI viết mới — sinh từ tài liệu (GENERATE), câu dài (ENRICH phần B), câu mới của AI Coach, họ
câu (FAMILY), câu song sinh của câu tầng A (TWINS) — và là đích khi ENRICH viết lại câu tầng A. Câu `easy` và câu song sinh của câu
ngắn giữ dáng câu gốc (không bắt buộc tầng A). Mọi quy tắc §6 vẫn áp dụng.

### Tầng câu (`tier`, app tự tính — `shared/tier.ts`, không ghi vào file)

| Tầng | Điều kiện | Dùng ở |
|------|-----------|--------|
| **A** — giống đề thật (exam-grade) | **giống đề thật** (đề ≥ `timing.long_form_min_words` = 55 từ **và** phương án trung bình ≥ 8 từ) **và** có **tiêu chí quyết định**: `requirements` khác rỗng (qualifier *MOST cost-effective*, *LEAST operational overhead*, *highly available*…, §3) hoặc câu hỏi cuối nêu yêu cầu (“Which solution will meet these **requirements**?”) | 🎯 thi thử (ưu tiên tầng A; tuỳ chọn “🏷️ Chỉ dùng câu tầng A”), 🔒 đề niêm phong (ưu tiên tầng A; `seal --add --tier A`, §10), mức sẵn sàng sát đề thật |
| **B** — tình huống ngắn | đề ≥ 30 từ **và** phương án trung bình ≥ 5 từ; hoặc giống đề thật nhưng thiếu tiêu chí | 📚 luyện theo chủ đề, 💪 củng cố điểm yếu, ▶ Học hôm nay |
| **C** — câu ôn nhanh (drill) | còn lại: đề một dòng, phương án là tên service | 🧠 ôn ngắt quãng, flashcard / Anki, 🎧 Nghe, ☕ câu hỏi nhanh |

Bộ lọc `tiers` (Ngân hàng, 🛠️ Tùy chỉnh, thi thử), huy hiệu “Tầng A/B/C”, thẻ *Chất lượng → 🏷️ Tầng câu hỏi*, độ phủ theo tầng
(`npm run coverage`: mục tiêu **280 câu tầng A** — D1 84 · D2 73 · D3 67 · D4 56, chia cho từng task theo số mục đề cương của task).

### Đặc tả

| Phần | Chuẩn tầng A |
|------|--------------|
| **Đề** | **55–130 từ**, tiếng Anh, theo thứ tự: công ty / bối cảnh → **hiện trạng** (kiến trúc, dữ liệu, quy mô) → **2–4 ràng buộc cứng** (không đi qua internet, không downtime, giữ khoá on-premises, RPO/RTO, đội vận hành nhỏ…) → **qualifier** → **câu hỏi đóng** “Which solution will meet these requirements?” (hoặc “…MOST cost-effectively?”). Được phép **một** chi tiết không liên quan. Che các phương án đi, đọc đề + câu hỏi cuối vẫn biết cần loại giải pháp nào |
| **Tiêu chí** | ≥ 90 % câu của một pack có tiêu chí quyết định (như tầng A). Câu phủ định ≤ 3 %, viết HOA (NOT, EXCEPT, LEAST likely) |
| **Phương án** | **hành động hoàn chỉnh** (service + cấu hình), **8–35 từ**, **song song** (cùng dáng câu, cùng loại giải pháp) và **đồng nhất** (xếp hạng được trên cùng một chiều). Đáp án đúng là phương án dài nhất (dài hơn mọi phương án khác) ở **không quá 25 %** số câu của pack. Không All/None of the above, không từ tuyệt đối ở phương án nhiễu |
| **Nhiều đáp án** | **25–30 %** số câu của pack: `(Choose TWO)` với 5 phương án; `(Choose THREE)` với 6 phương án ≤ 5 %. `(Select TWO.)` cũng được chấp nhận |
| **Phương án nhiễu** | mỗi phương án nhiễu sai vì **đúng một** lý do — thường là một ràng buộc / yêu cầu nêu trong đề —, thuộc một **nhãn** ở bảng dưới, ghi ở cuối dòng của nó trong giải thích. **Gieo từ nhầm lẫn thật**: cặp dịch vụ dễ nhầm (🔀 Phân biệt, snapshot §9, notes so sánh `14-so-sanh-services.md`, `Q-service-comparisons.md`, `F-so-sanh-database-theo-dac-diem.md`), lý do người học chọn sai (🗣️), phương án nhiễu được chọn nhiều (📊) |
| **Kiến thức** | đáp án đúng là service **trong phạm vi và còn mở cho khách hàng mới** — **không bao giờ** là service `scope: out` / `scope: legacy` hay đã đóng với khách mới (`currency:`). Đề và phương án dùng **tên như exam guide** (`bank/exam-guide/SAA-C03.yaml → in_scope`, vd Amazon Data Firehose, AWS Application Migration Service); tên mới / tên cũ khác ghi ở giải thích. Tính năng đã GA ≥ 3 tháng. Không đưa con số / giới hạn trừ khi đã đối chiếu tài liệu AWS có URL |
| **Giải thích** | **50–120 từ**: **ràng buộc → tính năng thoả nó** (vì sao đúng) · **mỗi phương án nhiễu một dòng** nêu ràng buộc nó phá + nhãn · dòng `> 🇻🇳 …` · **≥ 1 URL tài liệu AWS** (docs.aws.amazon.com / aws.amazon.com — chỉ URL chắc chắn tồn tại), khuyến nghị dạng link Markdown cuối đoạn đầu (`refs` vẫn là file notes) |
| **Độ khó (pack)** | medium 55 % · hard 35 % · easy 10 % |
| **Nguồn** | chỉ notes trong repo + tài liệu AWS + exam guide (`bank/exam-guide/`). **Không bao giờ** chép hay diễn đạt lại câu của đề mẫu, Official Practice Question Set / Practice Exam, đề bên thứ ba (Tutorials Dojo, Udemy…) hay “dump” (dùng dump vi phạm AWS Certification Program Agreement) |

**Nhãn lý do sai** (một nhãn cho mỗi phương án nhiễu):

| Nhãn | Phương án nhiễu… | Ví dụ |
|------|------------------|-------|
| `vi phạm ràng buộc` | chạy được nhưng phá một ràng buộc cứng của đề | thêm Lambda@Edge khi đề cấm chạy thêm compute |
| `dùng sai tính năng` | đúng service, nhưng tính năng đó không làm việc đề cần | Read Replica để failover tự động |
| `cấu hình không tồn tại` | quyền / thiết lập / tích hợp không có thật (lý do là chính AWS, không cần cụm trong đề) | security group gắn vào S3 bucket |
| `đặt sai chỗ` | thành phần đúng nhưng sai vị trí / định tuyến (sai Region, VPC, subnet, sai phía của kết nối) | gateway endpoint ở VPC khác, đi qua VPC peering |
| `giải bài toán khác` | tốt cho một vấn đề khác (tốc độ thay vì riêng tư, mã hoá thay vì kiểm soát truy cập…) | chỉ ép HTTPS khi đề cần chặn truy cập thẳng vào bucket |
| `tốn vận hành/chi phí hơn` | đáp ứng mọi ràng buộc nhưng thua ở qualifier | interface endpoint thay vì gateway endpoint khi đề hỏi rẻ nhất |
| `đúng một phần` (chỉ câu nhiều đáp án) | một bước hợp lý nhưng không đủ / không thuộc bộ đáp án tốt nhất | thêm Aurora Replica nhưng vẫn đọc qua writer endpoint |

Dòng phương án nhiễu: `- <nội dung, rút gọn>: <vì sao sai> (<nhãn> "<cụm ràng buộc / yêu cầu trong đề>")`.

**Ví dụ câu tầng A** (73 từ đề · phương án 22–26 từ, đáp án đúng không dài nhất · giải thích 112 từ · lint sạch):

```markdown
## Q doc-cloudfront-oac-04
- domain: secure
- task: 1.3
- topic: networking
- services: CloudFront, S3
- tags: cloudfront-origin-security, s3-block-public-access
- skills: 1.3.s6, 1.3.k1
- difficulty: medium
- time: 120
- concept: CloudFront origin access control + bucket policy (no compute) vs Lambda@Edge, SecureTransport, security groups for locking an S3 origin
- refs: 04-networking-services.md
- hint: Đề có hai ràng buộc: chặn truy cập thẳng vào bucket và không chạy thêm compute — phương án nào thoả cả hai?

A company hosts a static marketing website in an Amazon S3 bucket and serves it to users worldwide through an Amazon
CloudFront distribution. A security audit found that users can bypass CloudFront and download objects directly from the
S3 bucket URL. The company must block direct access to the bucket while keeping the website available through
CloudFront, and the team wants to avoid running any additional compute. Which solution will meet these requirements?

- A. Add a Lambda@Edge function on origin requests that signs each request to the bucket with SigV4, and turn on S3 Block Public Access for the bucket.
- B. Add a bucket policy statement that denies any request where aws:SecureTransport is false, and keep the distribution's HTTPS-only viewer protocol policy.
- C. Create an origin access control for the S3 origin, turn on S3 Block Public Access, and grant the distribution read access in the bucket policy.
- D. Create a security group that allows HTTPS from the CloudFront origin-facing managed prefix list, and associate the security group with the S3 bucket.

**Answer:** C

**Explanation:** Origin access control signs CloudFront requests to the S3 origin; a bucket policy that grants reads to that distribution, with Block Public Access on, rejects direct requests without extra compute ([AWS docs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)).
- Lambda@Edge signing: works, but adds compute to run (vi phạm ràng buộc "avoid running any additional compute").
- Deny when aws:SecureTransport is false: enforces HTTPS only; direct HTTPS requests still succeed (giải bài toán khác "block direct access to the bucket").
- Security group on the bucket: S3 has no security groups; the prefix list suits ALB or EC2 origins (cấu hình không tồn tại).
> 🇻🇳 Chỉ CloudFront được đọc bucket, không thêm compute → OAC + bucket policy + Block Public Access.
```

### Lint chuẩn đề (exam-spec) — `server/lib/lint.ts`

Chỉ áp dụng cho câu **`origin: ai | doc`**, **`medium`/`hard`**, **`created` ≥ `quality.exam_spec_since`** (mặc định `2026-10-22`; `""` = tắt).
Câu nhập, câu tự viết, câu `easy` và câu cũ không bị bắt (vẫn được xếp tầng). Mức vừa / nhẹ → `⚠️` (không chặn ghi), hiện ở
*Chất lượng → 🩺 Lỗi viết câu* và `npm run validate -- --lint`; ngưỡng cụ thể nằm trong `server/lib/lint.ts`.

| Mã | Mức | Bắt khi |
|----|-----|---------|
| `stem-short` | vừa | đề ngắn hơn chuẩn tầng A (< 55 từ) |
| `options-bare` | vừa | phương án quá ngắn (tên service trơn, trung bình < 8 từ) |
| `no-criterion` | vừa | không có tiêu chí quyết định (không qualifier trong `requirements`, câu hỏi cuối không nêu “requirements”) |
| `explanation-coverage` | vừa | số dòng `- <nội dung>: …` trong giải thích ít hơn số phương án nhiễu |
| `doc-url-missing` | nhẹ | không có URL `https://docs.aws.amazon.com/…` / `https://aws.amazon.com/…` trong giải thích hoặc `refs` |
| `options-nonparallel` | nhẹ | đáp án đúng mở đầu bằng động từ hành động (“Use…”, “Configure…”) còn ≥ 2 phương án nhiễu là cụm danh từ — hoặc ngược lại |

Cảnh báo **cấp pack** (`validate`, pack có ≥ 8 câu thuộc phạm vi lint chuẩn đề): câu nhiều đáp án < 20 %, hoặc đáp án đúng dài hơn mọi
phương án khác ở > 25 % số câu.

**Phép thử chỉ nhìn phương án** (`--verify --scope cues`, §9) bắt loại manh mối mà lint không thấy: phương án đúng “nghe đúng” hơn hẳn
dù không đọc đề → viết lại phương án (ENRICH `balance` / `distractors`) trước khi câu vào đề niêm phong.

## 7. Kiểm tra

```bash
node trainer/scripts/validate.ts                         # toàn bộ ngân hàng
node trainer/scripts/validate.ts packs/ai/2026-10-16     # chỉ file khớp chuỗi (in cả cảnh báo)
node trainer/scripts/validate.ts <file> --fill-time      # tự điền time còn thiếu
node trainer/scripts/validate.ts <file> --lint           # + lỗi viết câu (gồm lint chuẩn đề §6b) và cảnh báo cấp pack
node trainer/scripts/apply-patch.ts <patch.yaml> --dry-run   # thử một patch AI mà không ghi (§8)
```

Lỗi (`❌`) → câu bị loại khỏi test cho tới khi sửa. Cảnh báo (`⚠️`) → vẫn dùng được nhưng nên sửa.

## 8. Patch YAML — chỉnh sửa hàng loạt bằng AI

ENRICH (và AI Coach khi cần) **không sửa trực tiếp** file pack khi cải thiện câu có sẵn; nó ghi
`trainer/coach/patches/<run_id>.yaml` rồi chạy `node trainer/scripts/apply-patch.ts <file> [--dry-run]`:

```yaml
run_id: 2026-10-16_190000_enrich
items:
  - id: 03-v2-01
    base: "1a2b3c4d5e"        # hash câu lúc tạo lô (file batch ghi sẵn), LUÔN trong ngoặc kép — khác hash hiện tại → item bị bỏ qua
    set: { domain: resilient, task: "2.2", tags: [multi-az], services: [RDS], concept: "…", hint: "…" }
    explanation: |
      …
    options: { A: "…", C: "…" }   # thay nội dung lựa chọn; khoá và đáp án giữ nguyên
  - id: 05-v1-12              # chỉ id + base = đã duyệt, không cần đổi (ghi enriched)
    base: "9f8e7d6c5b"
  # hiếm: stem: | …   ·   answer: [B] + reason: "bằng chứng"   ·   status: retired
```

- Khoá của item: `id, base, set, explanation, options, stem, answer, reason, status`. Khoá trong `set`:
  `domain, task, topic, services, tags, difficulty, time, concept, refs, hint, variant_of, status`.
- Mỗi item được kiểm tra riêng: `base` khớp hash hiện tại, giá trị hợp lệ (task cùng domain, khoá lựa chọn có thật, đổi đáp án
  phải có `reason`, hint không lộ đáp án, giải thích không chữ cái), rồi block câu hỏi được viết lại bằng serializer và **parse lại**;
  item gây lỗi bị hoàn tác và báo `❌`, các item khác vẫn được ghi. Exit code 1 khi còn item lỗi.
- Item áp dụng được → app ghi `enriched: <hôm nay>` (trừ item chỉ đổi `status`); `time` tính theo rubric được tính lại khi đề/lựa chọn đổi.
- `base` (và `id`) phải là **chuỗi trong ngoặc kép**: YAML đọc hash không có ngoặc như `46794516e3` hay `9e114` thành số → item bị từ chối
  với thông báo rõ ràng (file batch đã ghi sẵn dạng `base: "…"`).
- Chạy lại cùng patch là an toàn: item đã áp dụng được nhận ra (`➖`, nhờ `<run_id>.applied.json`) và **không bao giờ được áp lại**
  (kể cả khi chữ cái của item theo bố cục đáp án cũ đã được đổi khoá ở lần đầu), chỉ item còn lỗi được thử lại. Muốn sửa tiếp một câu
  đã áp dụng → tạo item mới trong patch khác với `base` = hash hiện tại.
- `base` lệch vì câu chỉ bị **đổi vị trí đáp án** (có bản ghi trong `bank/migrations/`) → apply-patch tự đổi khoá trong `options`/`answer`
  sang bố cục mới (báo ⚠️); lệch vì lý do khác → item bị bỏ qua (`⏭`).
- **Lint sau mỗi item** (`server/lib/lint.ts`, cùng bộ luật với `npm run validate -- --lint`): câu sau khi sửa được kiểm lại lỗi viết
  câu; lỗi **mới** (câu cũ chưa có) mức cao — `duplicate-options`, `all-none-above`, `choose-count`, `letter-ref` — → item bị từ chối
  và hoàn tác (`❌ lint (mức cao): … [mã]`); lỗi mới mức vừa/thấp (vd `longest-correct`, `absolute-terms`, `stem-echo`,
  `short-explanation`) → `⚠️ lint: …`. Áp dụng cho mọi đường: ENRICH, patch của coach, `apply-patch` CLI, quyết định giải mù.
  [v6] Câu thuộc phạm vi lint chuẩn đề (§6b) còn được kiểm `stem-short`, `options-bare`, `no-criterion`, `explanation-coverage` (vừa),
  `doc-url-missing`, `options-nonparallel` (nhẹ) → `⚠️`, không chặn ghi.

### Chế độ app (JSON) — structured output

Với `config.yaml → coach.structured_output: true` (mặc định), nút trong app / lịch / `npm run coach` chạy **sinh câu**, **ENRICH** và
**câu dài** bằng `claude -p --json-schema …` với công cụ **chỉ đọc** (`--tools Read,Glob,Grep`, không quyền Edit/Write/Bash):

| Tác vụ | AI trả về (JSON) | App làm |
|--------|------------------|---------|
| ENRICH (phần A) | `items`: mỗi câu trong lô một item với các khoá ở trên **trừ `base`** (app điền hash của lô) + `summary` | ghi `coach/patches/<run_id>.yaml` (audit trail, cùng định dạng §8) → apply như trên |
| Sinh câu / câu dài | `pack {slug, title, description?}` + `questions[]` (`domain, task, topic, services, tags, difficulty, variant_of?, concept, refs, hint, stem, options[]` theo thứ tự A, B…, `answer[]`, `explanation`) + `summary` | gán id (`doc-<slug>-NN` · `<tiền tố lượt>-lfNN`), tính `time` theo rubric, `created`/`enriched` = hôm nay, kiểm tra từng câu (schema, task cùng domain, parse, chữ cái trong giải thích, hint lộ đáp án, “Choose N”, lint mức cao, id trùng) rồi ghi pack bằng serializer |

Item / câu bị từ chối được gửi lại **một lần** trong cùng phiên (`--resume <session_id>`) kèm danh sách lỗi theo id; AI trả lại chỉ những
item / câu đã sửa (cùng schema, giữ `id`) và app **chỉ áp dụng các item đã sửa đó** (item đã được chấp nhận ở vòng đầu không bị áp lại).
Còn lỗi → bỏ qua (không ghi) và báo trong log / `outcome.rejected` của lượt chạy. Bấm dừng trong vòng sửa lỗi → không ghi thêm gì.
`coach.structured_output: false`, `/trainer-enrich`, `/trainer-generate` và Cowork dùng **chế độ tương tác (file)**: AI tự ghi patch /
pack rồi chạy `apply-patch.ts` / `validate.ts` như trên.

## 9. Giải mù (blind-solve) — `bank/verify.md`

Một **model thứ hai** (`coach.models.verify`, mặc định `opus`, dự phòng `sonnet`) giải câu hỏi chỉ với **đề + các lựa chọn + số đáp án
cần chọn** — không thấy đáp án, giải thích, gợi ý hay metadata, không có công cụ nào (`--tools ""`). App so câu trả lời với đáp án:

| Kết quả | Nghĩa |
|---------|-------|
| ✅ `ok` | model chọn đúng đáp án trong ngân hàng |
| ❌ `mismatch` | model chọn khác — đáp án có thể sai, hoặc đề thiếu dữ kiện quyết định |
| ⚠️ `ambiguous` | model cho là ≥ 2 lựa chọn cùng đúng / đề thiếu dữ kiện / không lựa chọn nào đúng (tính cả khi chọn trùng đáp án) |
| 💥 `error` | model không trả lời câu đó (thiếu id / chữ cái không hợp lệ) — **không** tính là đã giải: câu vẫn được chọn lại ở lượt sau |

- **Khi nào chạy**: tự động sau mỗi lượt AI có câu mới hoặc câu bị đổi đề / lựa chọn / đáp án (hash đổi) — sinh câu, câu dài, ENRICH,
  phân tích — như pha thứ hai của cùng lượt chạy (chung khoá, log, chi phí; `coach.verify.auto`); hoặc khi bấm “🧪 Giải mù” ở *Ngân hàng →
  Chất lượng* / `npm run coach -- --verify [--ids a,b | --pack <id> | --scope unverified-ai|new|changed]` (tối đa 60 câu/lượt, mỗi lần
  gọi `coach.verify.batch_size` câu).
- [v6] **Phương án được xáo**: model giải mù thấy các phương án theo thứ tự xáo (chữ cái gán lại A, B, C…; tất định theo hash câu + số
  lần đã giải phiên bản đó, nên lần giải lại thấy thứ tự khác) — LLM hay thiên về một số vị trí, và vị trí đáp án do người viết chọn có
  thể lệch. Lựa chọn của model được đổi về chữ cái trong file: `picked` / `key` luôn là chữ cái của ngân hàng, `order` ghi thứ tự model
  đã thấy.
- [v6] **Phép thử chỉ nhìn phương án** (`npm run coach -- --verify --scope cues [--ids a,b | --pack <id>]`, model
  `coach.verify.probe_model`, mặc định `haiku`; chỉ chạy khi bấm / gõ lệnh): một model rẻ chỉ thấy **các phương án** (không có đề, không
  có id) và đoán đáp án, hai lần với hai thứ tự xáo khác nhau. Đúng **cả hai** lần → `cue`: phương án tự lộ đáp án (dài / chi tiết /
  “nghe đúng” hơn hẳn, lặp ý…) → viết lại phương án (ENRICH `balance` / `distractors`). Không ghi `--ids` / `--pack` → câu AI / tài liệu
  `active` tạo từ `quality.exam_spec_since`, chưa dò ở phiên bản hiện tại, không niêm phong (mới nhất trước, tối đa 60 câu/lượt).
  Dòng 🎯 ghi vào `verify.md` với `"probe":"choices-only"` trong phần dữ liệu và **không bao giờ** được tính là kết quả giải mù: không
  vào số câu đã giải, hàng chờ duyệt, tự chuyển draft / tự dùng lại, điều kiện đề niêm phong hay mức sẵn sàng.
- **Tự chuyển draft** (`coach.verify.auto_draft`): câu `mismatch`/`ambiguous` do AI viết (`origin: ai | doc`) hoặc vừa bị lượt AI sửa →
  `status: draft` qua một patch item (`coach/patches/<run_id>-verify.yaml`) + dòng quyết định `drafted`. Câu **imported** (đề gốc) không
  bao giờ bị tự chuyển draft — chỉ vào hàng chờ duyệt.
- **Tự dùng lại**: câu đang `draft` vì giải mù mà phiên bản hiện tại được giải **khớp** (sau khi sửa bằng ENRICH, hoặc giải lại) → tự trở
  lại `active` + dòng quyết định `approved` tự động (“✅ tự dùng lại”). Câu đã được bạn 👍 duyệt ở một phiên bản thì không bị tự chuyển
  draft lại cho chính phiên bản đó.
- **Duyệt**: *Ngân hàng → Chất lượng* (👍 Duyệt = giữ nguyên, câu đang draft vì giải mù — ở bất kỳ phiên bản nào — trở lại `active`;
  🗑️ Loại = `status: retired`; 🧹 Sửa bằng ENRICH = lô ENRICH cho câu đó, file batch kèm nhận xét của model giải mù). Câu bị giải mù
  chuyển draft **ở lại hàng chờ** cho tới khi bạn quyết định, kể cả khi đã sửa hoặc giải lại. Quyết định gửi kèm `hash` của phiên bản
  bạn đang xem: câu đã đổi trong lúc đó → app từ chối (409) để bạn xem lại.
- **Định dạng**: mỗi dòng một lần giải hoặc một quyết định, chỉ ghi thêm (append-only, `merge=union` giữa hai máy — không conflict):

  ```markdown
  - 2026-10-19 · `doc-rds-proxy-03` · ❌ lệch đáp án (model C · đáp án B) · claude-opus-… · tin cậy cao — Lý do ngắn <!-- verify {"at":"…","hash":"…","outcome":"mismatch","picked":"C","key":"B",…} -->
  - 2026-10-19 · `doc-rds-proxy-03` · 📝 tự chuyển draft <!-- verify {…,"decision":"drafted"} -->
  ```

  Phần `<!-- verify {…} -->` là dữ liệu cho app (đừng sửa tay). Kết quả gắn với **hash** của câu (§3): sửa đề / lựa chọn / đáp án → kết
  quả cũ thành “cũ” (stale) và câu được giải mù lại ở lượt sau (`--scope changed`).

## 10. Đề niêm phong — `results/sealed.md`

Một số câu **chưa từng gặp** được giữ riêng thành *đề niêm phong* (mặc định `config.yaml → exam.sealed_forms: 2` đề ×
`exam.sealed_size: 50` câu), tạo một lần khi mở app (trước buổi luyện đầu tiên) hoặc bằng `npm run seal`. Câu đang niêm phong
không xuất hiện ở bất kỳ chế độ luyện, tìm kiếm, xuất Anki, danh sách Ngân hàng / Chất lượng, snapshot hay kế hoạch AI Coach;
“Đề niêm phong” = mô phỏng Pearson với 50 câu của đề làm câu tính điểm + 15 câu thử nghiệm từ ngân hàng thường → **điểm trên
câu mới** (điểm hiệu chỉnh nội bộ, như điểm thi thử bên ngoài). Nộp bài → đề thành `used`, câu trở lại ngân hàng; “Mở sớm” →
`released` (không có điểm).

```markdown
---
kind: sealed
size: 50
forms:
  - id: S1
    status: sealed                 # sealed | used | released
    ids: [ 06-v1-03, 16-v2-19, … ]
  - id: S2
    status: used
    used_at: 2026-11-01T10:00:00+07:00
    attempt_id: 2026-11-01_100000_sealed
    ids: [ … ]
---
```

- **Do app quản lý — đừng sửa tay** (và đừng đọc danh sách id nếu muốn điểm trung thực). Nội dung lúc tạo **tất định** (không có
  thời điểm, thứ tự theo hash): hai máy tạo độc lập từ cùng ngân hàng + lịch sử ra cùng một file, đồng bộ không xung đột.
- Cách chọn: câu `active`, trong phạm vi đề thi ([v6] không `out` / `legacy`), **không có câu anh em** ([v5] theo nhóm `cluster` ở §3 —
  áp dụng cho đề tạo từ nay; file đề cũ không bị chọn lại), không có issue mở / 👎 nhiều / lỗi lint
  nặng, chưa từng thuộc đề trước; chia theo trọng số domain 30/26/24/20 (50 câu → 15/13/12/10) và xoay vòng các task 1.1–4.4;
  ưu tiên câu **chưa gặp**, rồi [v6] câu tầng A, câu giống đề thật khác, rồi đề dài hơn; số câu nhiều đáp án chia đều giữa các đề.
- [v6] **Thêm một đề khi các đề khác còn niêm phong** — `npm run seal -- --add [--tier A] [--size 50] [--allow-short]`: tạo **một** đề
  mới (đánh số tiếp, vd S3; tối đa 5 đề niêm phong cùng lúc) chỉ từ câu đủ điều kiện như trên **và chưa từng gặp khi luyện** (câu AI
  phải được giải mù khớp đáp án ở phiên bản hiện tại); `--tier A` = chỉ câu tầng A (§6b); `--size` = số câu tính điểm (mặc định
  `exam.sealed_size`), vẫn chia theo trọng số domain. Domain thiếu câu → từ chối và báo mỗi domain thiếu bao nhiêu câu; `--allow-short`
  → đề lớn nhất (nhỏ hơn `--size`, ≥ 10 câu) mà mọi domain lấp đủ. Câu tầng A mới nên qua đủ các cổng (lint, giải mù, phép thử phương án,
  `/trainer-review`) **trước** khi niêm phong — sau đó chúng bị ẩn cho tới khi làm đề.
- AI (COACH, ENRICH) **không bao giờ** dùng câu niêm phong làm câu gốc cho biến thể / câu dài, không đưa vào kế hoạch.
- Lệnh: `npm run seal` (trạng thái, không in id) · `-- --forms 2 --size 50` (tạo khi không còn đề nào đang niêm phong) ·
  [v6] `-- --add --tier A [--size 50]` (thêm một đề tầng A, kể cả khi còn đề đang niêm phong) ·
  `-- --release S1` (mở sớm) · `-- --reset [--forms N --size M]` (bỏ mọi đề rồi tạo lại; `--forms 0` = chỉ bỏ). Đề mới đánh số
  tiếp (S3, S4…) để không trùng `sealed_form` của bài làm cũ.
