# 📐 Question Bank Schema (v2)

> Đặc tả định dạng ngân hàng câu hỏi — **nguồn sự thật duy nhất** cho người viết câu hỏi
> (bạn, AI Coach, AI Question Writer, ENRICH). App đọc trực tiếp các file này; không có database.
> Kiểm tra bất kỳ lúc nào: `node trainer/scripts/validate.ts [đường-dẫn-hoặc-chuỗi-con] [--warnings]`.
>
> v2: metadata `task` (exam guide 1.1–4.4), `hint`, `enriched`; giải thích **không nhắc chữ cái đáp án**; độ dài lựa chọn cân bằng;
> câu dài chuẩn đề thi (§4); patch YAML cho chỉnh sửa hàng loạt bằng AI (§8).

---

## 1. Cấu trúc thư mục

```
trainer/bank/
├── SCHEMA.md            ← file này
├── taxonomy.yaml        ← domain, task (exam guide), topic, service, tag hợp lệ + rubric thời gian + từ khoá tô sáng
├── issues.md            ← lỗi câu hỏi người học báo (AI Coach xử lý)
├── ratings.md           ← 👍/👎 của người học cho từng câu
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
| Đáp án | `**Answer:** B` hoặc `**Answer:** A, C`. Câu nhiều đáp án **phải** có `(Choose TWO)` / `(Choose THREE)` trong đề và số đáp án khớp |
| Giải thích | `**Explanation:** …` — Markdown, có thể nhiều dòng/danh sách tới hết block. Không dùng `#`/`##` (dùng `###` hoặc chữ đậm). **Không nhắc chữ cái đáp án** (xem dưới) |
| Phân cách | Dòng `---` giữa các câu (có dòng trống phía trên) — tuỳ chọn, giúp dễ đọc |

**Giải thích không dùng chữ cái.** App xáo thứ tự lựa chọn khi hiển thị, nên “A sai vì…” sẽ trỏ nhầm. Gọi lựa chọn bằng
**nội dung** (“Read Replicas: …”). Validator cảnh báo (và `apply-patch` từ chối) các mẫu: dòng bắt đầu bằng một chữ cái đơn +
`:`/`.`/`)`/`-` (`- A: …`), `option B` / `answer C` / `choice D` / `đáp án A` (không phân biệt hoa thường — cả “answer a question”),
`= A` (cả “= a few”), `(B)`.

**Định dạng giải thích khuyến nghị** (ENRICH dùng định dạng này): 1–2 câu tiếng Anh vì sao đáp án đúng thoả yêu cầu + mỗi
distractor hấp dẫn một dòng `- <nội dung>: <vì sao sai>` + dòng cuối `> 🇻🇳 <tóm tắt tiếng Việt>`; 35–90 từ.

### Metadata

| Key | Bắt buộc | Giá trị |
|-----|----------|---------|
| `domain` | ✅ | `secure` (D1, 30%) · `resilient` (D2, 26%) · `performance` (D3, 24%) · `cost` (D4, 20%) — chọn theo **mục tiêu chính** của câu (từ khoá "MOST cost-effective" → cost; "highly available/failover/DR/decouple" → resilient; "latency/throughput/cache/scale" → performance; "least privilege/encrypt/attack" → secure) |
| `topic` | ✅ | một id trong `taxonomy.yaml → topics` (compute, storage, database, networking, security, management, integration, devtools, analytics, migration, api, ml, other, resilience, cost) |
| `difficulty` | ✅ | `easy` (1 khái niệm, nhận diện trực tiếp) · `medium` (tình huống áp dụng, 2 đáp án gần đúng) · `hard` (kết hợp nhiều khái niệm, bẫy, multi-response) |
| `time` | ✅ | giây, số nguyên — tính theo rubric §4 |
| `task` | khuyến nghị | task statement của exam guide trong `taxonomy.yaml → tasks`: `1.1`–`1.3` (secure), `2.1`–`2.2` (resilient), `3.1`–`3.5` (performance), `4.1`–`4.4` (cost) — **phải cùng domain** (ghi trong ngoặc kép nếu viết trong YAML: `"2.2"`) |
| `services` | khuyến nghị | tên chuẩn trong `taxonomy.yaml → services` (vd `RDS Proxy`, `S3`, `Transit Gateway`). Service mới → thêm vào taxonomy |
| `tags` | khuyến nghị | khái niệm kebab-case, ưu tiên tag có sẵn trong `taxonomy.yaml → features` (vd `multi-az`, `s3-lifecycle`) |
| `variant_of` | khi là biến thể | id câu gốc (có thể nhiều, phân tách dấu phẩy) |
| `concept` | khuyến nghị (AI) | 1 câu ngắn mô tả khái niệm được kiểm tra — AI Coach dùng để gom nhóm điểm yếu |
| `hint` | khuyến nghị | **một dòng** tiếng Việt (≤ 140 ký tự) hiện khi người học bấm “💡 Gợi ý” ở chế độ luyện tập: hướng tới yêu cầu/từ khoá quyết định, **không lộ đáp án** (không nêu tên đáp án đúng, không chữ cái) |
| `refs` | tuỳ chọn | file notes liên quan, vd `03-database-services.md` hoặc `03-database-services.md#rds-proxy` |
| `status` | tuỳ chọn | `active` (mặc định) · `draft` (chưa dùng trong test) · `retired` (ngừng dùng — **không xoá câu**) |
| `created` | tuỳ chọn | `YYYY-MM-DD` |
| `enriched` | tự động | `YYYY-MM-DD` lần cuối ENRICH (patch AI) cải thiện/duyệt câu — app dùng để biết câu nào còn cần bảo trì |
| `source` | tuỳ chọn | nguồn gốc (file + vị trí) |

App tự tính thêm (không ghi vào file): `words` (số từ của đề), `longForm` (đề ≥ `timing.long_form_min_words` = 55 từ) và `hash`
(mã 10 ký tự của đề + lựa chọn + đáp án — dùng làm `base` trong patch §8).

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

**Câu dài (long-form).** Đề thật thường 60–150 từ với nhiều ràng buộc. Câu có đề ≥ 55 từ được tính là *câu dài*: mức sẵn sàng
cho câu dài trọng số cao hơn, thi thử ưu tiên câu dài. Khi viết câu mới mức `medium`/`hard`, ưu tiên đề **60–120 từ**: bối cảnh
công ty + kiến trúc hiện tại + 2–3 ràng buộc cụ thể + qualifier rõ ràng, 4 lựa chọn là giải pháp hoàn chỉnh dài tương đương nhau.

## 5. Id & vòng đời câu hỏi

- **Không bao giờ đổi id hoặc xoá câu** — file kết quả (`trainer/results/`) tham chiếu theo id. Muốn bỏ: `- status: retired`.
- Quy ước id: `<chương>-v1-<nn>` / `<chương>-v2-<nn>` (imported) · `ai-<YYYYMMDD>-<HHmm>-<nn>` (AI Coach) · `ai-<YYYYMMDD>-<HHmm>-lf<nn>` (câu dài ENRICH) · `doc-<slug>-<nn>` (từ tài liệu) · tuỳ ý cho manual (kebab-case).
- Sửa nội dung câu (đáp án sai, đề mơ hồ…): sửa tại chỗ, giữ id (hoặc qua patch §8). App hiển thị cảnh báo ở màn hình kết quả cũ nếu đáp án đã đổi.
- Biến thể (`variant_of`): cùng khái niệm, **tình huống/ngữ cảnh/thứ tự đáp án khác** — không chỉ đổi vài chữ. Tối đa 3 biến thể/câu gốc.

## 6. Tiêu chuẩn chất lượng (bắt buộc với câu AI viết)

1. **Một đáp án tốt nhất duy nhất** (hoặc đúng N đáp án với `Choose N`) — kiểm tra lại từng distractor.
2. Văn phong SAA-C03: tình huống doanh nghiệp + yêu cầu + từ khoá quyết định (*MOST cost-effective, LEAST operational overhead, highly available, MOST secure…*).
3. Distractor **hợp lý**: service/tính năng AWS có thật, hay bị nhầm (vd Read Replica ↔ Multi-AZ, SQS ↔ SNS, Gateway ↔ Interface endpoint). Không dùng "All of the above"/"None of the above".
4. **Độ dài cân bằng**: các lựa chọn dài tương đương nhau và cùng “dáng” câu; đáp án đúng **không** được dài hơn mọi distractor ≥ 15 % (người học đoán được đáp án nhờ độ dài). Tránh từ tuyệt đối (“always”, “only”) làm distractor lộ là sai.
5. Không bịa số liệu/giới hạn. Kiến thức có thể đã đổi theo thời gian → bám **notes trong repo**; nếu không chắc thì không đưa con số vào câu.
6. Giải thích 35–90 từ theo định dạng khuyến nghị ở §3: vì sao đáp án đúng + 1 dòng cho mỗi distractor quan trọng + tóm tắt 🇻🇳 — **gọi lựa chọn bằng nội dung, không bằng chữ cái**.
7. Có `task` (cùng domain) và `hint` (một dòng, không lộ đáp án).
8. Đáp án đúng phân bố đều A/B/C/D — tránh dồn vào B.
9. Đề bài tiếng Anh (giống đề thật); câu `medium`/`hard` ưu tiên dạng câu dài (§4).

## 7. Kiểm tra

```bash
node trainer/scripts/validate.ts                         # toàn bộ ngân hàng
node trainer/scripts/validate.ts packs/ai/2026-10-16     # chỉ file khớp chuỗi (in cả cảnh báo)
node trainer/scripts/validate.ts <file> --fill-time      # tự điền time còn thiếu
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
    base: 1a2b3c4d5e          # hash câu lúc tạo lô (file batch ghi sẵn) — khác hash hiện tại → item bị bỏ qua
    set: { domain: resilient, task: "2.2", tags: [multi-az], services: [RDS], concept: "…", hint: "…" }
    explanation: |
      …
    options: { A: "…", C: "…" }   # thay nội dung lựa chọn; khoá và đáp án giữ nguyên
  - id: 05-v1-12              # chỉ id + base = đã duyệt, không cần đổi (ghi enriched)
    base: 9f8e7d6c5b
  # hiếm: stem: | …   ·   answer: [B] + reason: "bằng chứng"   ·   status: retired
```

- Khoá của item: `id, base, set, explanation, options, stem, answer, reason, status`. Khoá trong `set`:
  `domain, task, topic, services, tags, difficulty, time, concept, refs, hint, variant_of, status`.
- Mỗi item được kiểm tra riêng: `base` khớp hash hiện tại, giá trị hợp lệ (task cùng domain, khoá lựa chọn có thật, đổi đáp án
  phải có `reason`, hint không lộ đáp án, giải thích không chữ cái), rồi block câu hỏi được viết lại bằng serializer và **parse lại**;
  item gây lỗi bị hoàn tác và báo `❌`, các item khác vẫn được ghi. Exit code 1 khi còn item lỗi.
- Item áp dụng được → app ghi `enriched: <hôm nay>` (trừ item chỉ đổi `status`); `time` tính theo rubric được tính lại khi đề/lựa chọn đổi.
- Chạy lại cùng patch là an toàn: item đã áp dụng được nhận ra (`➖`, nhờ `<run_id>.applied.json`), chỉ item còn lỗi được thử lại.
- `base` lệch vì câu chỉ bị **đổi vị trí đáp án** (có bản ghi trong `bank/migrations/`) → apply-patch tự đổi khoá trong `options`/`answer`
  sang bố cục mới (báo ⚠️); lệch vì lý do khác → item bị bỏ qua (`⏭`).
