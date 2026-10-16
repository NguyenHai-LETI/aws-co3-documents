# 📐 Question Bank Schema (v1)

> Đặc tả định dạng ngân hàng câu hỏi — **nguồn sự thật duy nhất** cho người viết câu hỏi
> (bạn, AI Coach, AI Question Writer). App đọc trực tiếp các file này; không có database.
> Kiểm tra bất kỳ lúc nào: `node trainer/scripts/validate.ts [đường-dẫn-hoặc-chuỗi-con] [--warnings]`.

---

## 1. Cấu trúc thư mục

```
trainer/bank/
├── SCHEMA.md            ← file này
├── taxonomy.yaml        ← domain, topic, service, tag hợp lệ + rubric thời gian
├── issues.md            ← lỗi câu hỏi người học báo (AI Coach xử lý)
└── packs/               ← mỗi file .md = 1 "pack" (bộ câu hỏi)
    ├── imported/        ← import từ practice-exams/ (V1, V2) — origin: imported
    ├── ai/              ← AI Coach sinh sau mỗi lần phân tích — origin: ai
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
- topic: database
- services: RDS
- tags: multi-az, read-replicas
- difficulty: medium
- time: 85
- variant_of: 03-v2-01
- concept: RDS Multi-AZ (HA, sync standby) vs Read Replica (async, read scaling)
- refs: 03-database-services.md

A healthcare company runs PostgreSQL on Amazon RDS. The database must keep running with
automatic failover if an Availability Zone fails, and the solution must not require any
application changes. Which solution meets these requirements?

- A. Create a cross-Region read replica and promote it during an outage
- B. Convert the DB instance to a Multi-AZ deployment
- C. Take hourly snapshots and restore them in another AZ
- D. Add two read replicas in different AZs behind Route 53

**Answer:** B

**Explanation:** Multi-AZ keeps a synchronous standby in another AZ and fails over automatically
using the same DNS endpoint.
- A: promotion is manual and cross-Region (async → possible data loss).
- C: snapshot restore is slow and manual (high RTO/RPO).
- D: replicas scale reads; promotion is manual, writes are not protected.
```

Câu nhiều đáp án (multiple-response):

```markdown
## Q ai-20261016-1830-02
- domain: performance
- topic: database
- services: Aurora
- tags: aurora-endpoints, read-replicas
- difficulty: hard
- time: 110

An analytics dashboard overloads the writer of an Aurora MySQL cluster. The team wants to
offload reads automatically and keep connecting to the same endpoints after a failover.
Which TWO actions should a solutions architect take? (Choose TWO)

- A. Add Aurora Replicas and point read traffic to the reader endpoint
- B. Point write traffic to the cluster (writer) endpoint
- C. Hard-code the instance endpoint of the current writer
- D. Enable Multi-AZ on each reader individually
- E. Use DynamoDB Accelerator (DAX)

**Answer:** A, B

**Explanation:** Reader endpoint load-balances across replicas; cluster endpoint always follows the writer.
```

### Quy tắc từng phần

| Phần | Quy tắc |
|------|---------|
| Heading | `## Q <id>` — id: `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–60 ký tự, **duy nhất toàn ngân hàng** |
| Metadata | mỗi dòng `- key: value`, ngay dưới heading, trước đề bài. Danh sách = phân tách bằng dấu phẩy |
| Đề bài | Markdown tự do (nhiều đoạn OK). Không dùng heading `#`/`##` bên trong |
| Lựa chọn | mỗi dòng `- A. text` (hoặc `A)`), chữ cái liên tục từ A. 4 lựa chọn cho câu 1 đáp án; 5–6 cho câu nhiều đáp án. Dòng tiếp nối thụt ≥ 2 space |
| Đáp án | `**Answer:** B` hoặc `**Answer:** A, C`. Câu nhiều đáp án **phải** có `(Choose TWO)` / `(Choose THREE)` trong đề và số đáp án khớp |
| Giải thích | `**Explanation:** …` — Markdown, có thể nhiều dòng/danh sách tới hết block. Không dùng `#`/`##` (dùng `###` hoặc chữ đậm) |
| Phân cách | Dòng `---` giữa các câu (có dòng trống phía trên) — tuỳ chọn, giúp dễ đọc |

### Metadata

| Key | Bắt buộc | Giá trị |
|-----|----------|---------|
| `domain` | ✅ | `secure` (D1, 30%) · `resilient` (D2, 26%) · `performance` (D3, 24%) · `cost` (D4, 20%) — chọn theo **mục tiêu chính** của câu (từ khoá "MOST cost-effective" → cost; "highly available/failover/DR/decouple" → resilient; "latency/throughput/cache/scale" → performance; "least privilege/encrypt/attack" → secure) |
| `topic` | ✅ | một id trong `taxonomy.yaml → topics` (compute, storage, database, networking, security, management, integration, devtools, analytics, migration, api, ml, other, resilience, cost) |
| `difficulty` | ✅ | `easy` (1 khái niệm, nhận diện trực tiếp) · `medium` (tình huống áp dụng, 2 đáp án gần đúng) · `hard` (kết hợp nhiều khái niệm, bẫy, multi-response) |
| `time` | ✅ | giây, số nguyên — tính theo rubric §4 |
| `services` | khuyến nghị | tên chuẩn trong `taxonomy.yaml → services` (vd `RDS Proxy`, `S3`, `Transit Gateway`). Service mới → thêm vào taxonomy |
| `tags` | khuyến nghị | khái niệm kebab-case, ưu tiên tag có sẵn trong `taxonomy.yaml → features` (vd `multi-az`, `s3-lifecycle`) |
| `variant_of` | khi là biến thể | id câu gốc (có thể nhiều, phân tách dấu phẩy) |
| `concept` | khuyến nghị (AI) | 1 câu ngắn mô tả khái niệm được kiểm tra — AI Coach dùng để gom nhóm điểm yếu |
| `refs` | tuỳ chọn | file notes liên quan, vd `03-database-services.md` hoặc `03-database-services.md#rds-proxy` |
| `status` | tuỳ chọn | `active` (mặc định) · `draft` (chưa dùng trong test) · `retired` (ngừng dùng — **không xoá câu**) |
| `created` | tuỳ chọn | `YYYY-MM-DD` |
| `source` | tuỳ chọn | nguồn gốc (file + vị trí) |

## 4. Rubric thời gian (`time`)

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

## 5. Id & vòng đời câu hỏi

- **Không bao giờ đổi id hoặc xoá câu** — file kết quả (`trainer/results/`) tham chiếu theo id. Muốn bỏ: `- status: retired`.
- Quy ước id: `<chương>-v1-<nn>` / `<chương>-v2-<nn>` (imported) · `ai-<YYYYMMDD>-<HHmm>-<nn>` (AI Coach) · `doc-<slug>-<nn>` (từ tài liệu) · tuỳ ý cho manual (kebab-case).
- Sửa nội dung câu (đáp án sai, đề mơ hồ…): sửa tại chỗ, giữ id. App hiển thị cảnh báo ở màn hình kết quả cũ nếu đáp án đã đổi.
- Biến thể (`variant_of`): cùng khái niệm, **tình huống/ngữ cảnh/thứ tự đáp án khác** — không chỉ đổi vài chữ. Tối đa 3 biến thể/câu gốc.

## 6. Tiêu chuẩn chất lượng (bắt buộc với câu AI viết)

1. **Một đáp án tốt nhất duy nhất** (hoặc đúng N đáp án với `Choose N`) — kiểm tra lại từng distractor.
2. Văn phong SAA-C03: tình huống doanh nghiệp + yêu cầu + từ khoá quyết định (*MOST cost-effective, LEAST operational overhead, highly available, MOST secure…*).
3. Distractor **hợp lý**: service/tính năng AWS có thật, hay bị nhầm (vd Read Replica ↔ Multi-AZ, SQS ↔ SNS, Gateway ↔ Interface endpoint). Không dùng "All of the above"/"None of the above".
4. Không bịa số liệu/giới hạn. Kiến thức có thể đã đổi theo thời gian → bám **notes trong repo**; nếu không chắc thì không đưa con số vào câu.
5. Giải thích ≤ ~80 từ: vì sao đáp án đúng + 1 dòng cho mỗi distractor quan trọng. Tiếng Anh hoặc Việt đều được (nhất quán trong pack).
6. Đáp án đúng phân bố đều A/B/C/D — tránh dồn vào B.
7. Đề bài tiếng Anh (giống đề thật).

## 7. Kiểm tra

```bash
node trainer/scripts/validate.ts                         # toàn bộ ngân hàng
node trainer/scripts/validate.ts packs/ai/2026-10-16     # chỉ file khớp chuỗi (in cả cảnh báo)
node trainer/scripts/validate.ts <file> --fill-time      # tự điền time còn thiếu
```

Lỗi (`❌`) → câu bị loại khỏi test cho tới khi sửa. Cảnh báo (`⚠️`) → vẫn dùng được nhưng nên sửa.
