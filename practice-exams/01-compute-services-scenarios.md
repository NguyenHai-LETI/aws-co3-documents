# 🎬 KỊCH BẢN PRACTICE — COMPUTE SERVICES (SAA-C03)

> Bộ luyện **ghi nhớ chủ động (active recall)** cho [01-compute-services.md](../01-compute-services.md).
> Khác với [01-compute-services-exam-v2.md](01-compute-services-exam-v2.md) (30 câu trắc nghiệm),
> file này bắt bạn **tự nghĩ ra câu trả lời trước khi nhìn đáp án**.

## 📖 Cách dùng

1. Đọc bối cảnh, **che đáp án** (đáp án nằm trong khối `<details>` — chỉ mở sau khi đã tự trả lời).
2. Nói/viết ra câu trả lời + **lý do**. Không được nghĩ trong đầu "à biết rồi" rồi mở đáp án — đó là ảo giác thuộc bài.
3. Chấm điểm: đúng service **và** đúng lý do = 1đ. Đúng service, sai lý do = 0.5đ.
4. Lặp lại theo lịch ở [Phần 7](#7️⃣-lịch-ôn-3-vòng).

| Phần | Nội dung | Kỹ năng rèn |
|------|----------|-------------|
| 1 | 10 kịch bản case-study | Đọc requirement → chọn service |
| 2 | Kịch bản tiến hóa (1 công ty, 7 giai đoạn) | Nối kiến thức thành hệ thống |
| 3 | Drill keyword → service (60 giây) | Phản xạ nhận diện từ khóa |
| 4 | Số liệu phải thuộc | Nhớ con số (bẫy phổ biến) |
| 5 | "Tìm lỗi kiến trúc" | Loại trừ đáp án sai |
| 6 | Cặp dễ nhầm — phân biệt trong 1 câu | Chống bẫy distractor |

---

## 1️⃣ MƯỜI KỊCH BẢN CASE-STUDY

### 🎬 Kịch bản 1 — Công ty phân tích gen

Một startup sinh học chạy job phân tích chuỗi gen. Đặc điểm:
- Mỗi job chạy **4–6 tiếng**, đóng gói sẵn trong **Docker image**
- Job có **checkpoint**, bị kill giữa chừng thì chạy lại được
- Chạy **không theo lịch cố định**, có tuần chạy 500 job, có tuần chạy 5 job
- Yêu cầu: **rẻ nhất có thể**, team không muốn quản lý server

**Câu hỏi:**
- a) Dùng compute service nào? Vì sao **không** dùng Lambda?
- b) Dùng pricing model nào? Rủi ro là gì và vì sao chấp nhận được?

<details>
<summary>💡 Đáp án</summary>

**a) AWS Batch** (compute environment chạy container).
- ❌ Lambda **KHÔNG** được: max execution time **15 phút**, job này 4–6 tiếng.
- ✅ Batch được sinh ra đúng cho việc này: Job Queues + Job Definitions + Compute Environments, tự động schedule và provision resource theo tải (tuần 500 job hay 5 job đều được).

**b) Spot Instances** (Batch compute environment dùng Spot).
- Tiết kiệm **50–90%** so với On-Demand.
- Rủi ro: AWS có thể terminate với **2-minute warning**.
- Chấp nhận được vì workload **fault-tolerant** (có checkpoint, chạy lại được).

**🔑 Keyword nhận diện:** "long-running (>15 min)" + "Docker" + "batch" → **AWS Batch**; "fault-tolerant" + "cost-effective" → **Spot**.
</details>

---

### 🎬 Kịch bản 2 — Hệ thống ERP cũ có license

Công ty migrate ERP lên AWS. Ràng buộc:
- License phần mềm tính theo **physical socket / physical core**, phải khai báo số core vật lý cho hãng audit
- Compliance yêu cầu server **không chia sẻ hardware** với khách hàng khác
- Instance phải nằm trên **cùng một máy vật lý** qua các lần stop/start (license bind theo host)

**Câu hỏi:** Chọn gì? Vì sao không chọn phương án "rẻ hơn"?

<details>
<summary>💡 Đáp án</summary>

**Dedicated Hosts** + bật **host affinity = Host**.

Vì sao không phải **Dedicated Instances** (rẻ hơn):
- Dedicated Instances: hardware dedicated **nhưng KHÔNG control được placement** → không thấy số socket/core vật lý, không đảm bảo quay lại đúng host cũ.
- Dedicated Hosts: **full control over instance placement**, nhìn được physical cores → đáp ứng BYOL theo socket + audit.

**🔑 Phân biệt 1 câu:** *Dedicated Instances = "riêng hardware"; Dedicated Hosts = "riêng hardware + biết mình nằm ở đâu".*
</details>

---

### 🎬 Kịch bản 3 — Cluster Cassandra

Team data dựng cluster **Cassandra 12 node** trên EC2.
- Cassandra tự replicate data giữa các node
- Yêu cầu: khi **một rack vật lý chết**, chỉ được mất **một phần** dữ liệu replica, không mất toàn bộ
- Cần throughput mạng cao giữa các node

**Câu hỏi:**
- a) Placement group nào? Vì sao không phải 2 loại còn lại?
- b) Giới hạn của loại đó là gì?

<details>
<summary>💡 Đáp án</summary>

**a) Partition Placement Group.**
- ❌ **Cluster**: dồn tất cả vào cùng 1 AZ, gần nhau → 1 sự cố hạ tầng có thể ảnh hưởng cả cụm; không có khái niệm partition/rack.
- ❌ **Spread**: max **7 instances/AZ** → không đủ cho 12 node; Spread dành cho vài instance critical, không dành cho cluster lớn.
- ✅ **Partition**: instance nằm trong các **partition (rack) khác nhau**, hỏng 1 rack chỉ mất 1 partition — đúng mô hình rack-awareness của Cassandra.

**b)** Max **7 partitions per AZ**.

**🔑 Nhớ nhanh:**
```
Cluster    → Low latency, same AZ          (HPC)
Spread     → HA, max 7 instances/AZ        (vài app critical)
Partition  → Big data, max 7 partitions/AZ (Hadoop, Cassandra, Kafka)
```
</details>

---

### 🎬 Kịch bản 4 — API bán vé concert

API bán vé chạy trên Lambda sau API Gateway.
- **99% thời gian** traffic rất thấp
- Đúng **10:00 sáng thứ Bảy** mở bán, traffic tăng 500 lần trong 30 giây
- Khách phàn nàn: những request đầu tiên **chậm 2–3 giây**
- Yêu cầu: latency thấp ngay từ request đầu

**Câu hỏi:**
- a) Nguyên nhân chậm là gì? Bật tính năng nào?
- b) Nếu đề nói *"đảm bảo function này luôn có đủ quota, không bị function khác trong account ăn hết"* thì dùng tính năng nào? Có giống câu a không?

<details>
<summary>💡 Đáp án</summary>

**a)** Nguyên nhân: **cold start**. → Bật **Provisioned Concurrency** (pre-warmed instances, không cold start).

**b)** Đó là **Reserved Concurrency** — **KHÁC** hoàn toàn:

| | Mục đích |
|---|---|
| **Provisioned Concurrency** | Pre-warm sẵn instance → **giết cold start** |
| **Reserved Concurrency** | **Giữ chỗ quota** cho function (và giới hạn trần của nó) |

Default limit: **1,000 concurrent executions per region**.

**🎯 Bẫy kinh điển:** đề hỏi "cold start / low latency" mà chọn Reserved là sai. Đề hỏi "guarantee capacity / không để function khác chiếm" mà chọn Provisioned là sai.
</details>

---

### 🎬 Kịch bản 5 — Deploy không được rớt request

App Java deploy bằng **Elastic Beanstalk**, đang chạy 10 instance.
- SLA: **không được giảm capacity** trong lúc deploy (10 instance phải luôn phục vụ)
- Nếu version mới lỗi phải **rollback nhanh**
- Team chấp nhận trả thêm tiền trong thời gian deploy

**Câu hỏi:**
- a) Deployment policy nào? So sánh với Rolling thường.
- b) Nếu đổi yêu cầu thành *"muốn test version mới với 10% traffic thật trước khi rollout"* → policy nào?
- c) Nếu đổi thành *"zero downtime + rollback bằng cách swap URL"* → policy nào?

<details>
<summary>💡 Đáp án</summary>

**a) Immutable** (hoặc **Rolling with Additional Batch** nếu đề nhấn "cost-effective hơn").
- **Rolling** thường: deploy theo batch trên chính instance đang chạy → **giảm capacity** trong lúc deploy → vi phạm SLA.
- **Rolling with Additional Batch**: thêm instance mới trước → **giữ full capacity**, no downtime.
- **Immutable**: tạo instance mới trong **ASG mới** → **an toàn nhất, rollback dễ nhất** (chỉ việc bỏ ASG mới). Đề nhấn "rollback nhanh" → Immutable.

**b) Traffic Splitting** (canary testing — đẩy % traffic sang version mới).

**c) Blue/Green** — môi trường mới, **swap URLs**, zero downtime.

**🔑 Bảng thần chú:**
```
Nhanh nhất, chấp nhận downtime  → All at Once
No downtime, tiết kiệm          → Rolling
Full capacity + no downtime     → Rolling with Additional Batch
An toàn nhất, rollback dễ       → Immutable
Zero downtime, swap URL         → Blue/Green
Test % traffic                  → Traffic Splitting
```
</details>

---

### 🎬 Kịch bản 6 — Training model AI

Team ML train model deep learning:
- Cần **GPU**
- 32 instance chạy **MPI**, giao tiếp liên tục với nhau, cực nhạy với latency mạng
- Cần bandwidth cao nhất, **OS-bypass networking**

**Câu hỏi:** Kể đủ **3 thành phần**: instance family, placement group, network adapter.

<details>
<summary>💡 Đáp án</summary>

1. **Instance family: P3/P4** — Accelerated Computing, **P**ower (GPU), dùng cho ML training & HPC.
   *(G4/G5 là graphics / ML **inference** — không phải training.)*
2. **Placement group: Cluster** — cùng 1 AZ, đặt gần nhau, low latency, high throughput (10 Gbps).
3. **Network adapter: EFA (Elastic Fabric Adapter)** — dành cho HPC, **OS-bypass**, latency thấp, đúng cho **MPI applications**.

*(Nếu đề không nhắc MPI/HPC mà chỉ nói "high bandwidth" → **ENA**, up to 100 Gbps.)*

**🎯 Đây là combo hay ra thi:** Cluster PG + Enhanced Networking (ENA) + EFA.
</details>

---

### 🎬 Kịch bản 7 — Web tier co giãn

Website thương mại điện tử sau ALB:
- Traffic tăng đều từ 8h, đỉnh 20h, giảm về đêm — **lặp lại theo chu kỳ tuần**
- Ban ngày CPU dao động thất thường theo campaign marketing
- Có sự cố: instance vẫn "running" (EC2 status OK) nhưng **app treo**, ASG không thay thế
- Scale out xong instance mất **4 phút** cài đặt mới nhận traffic được

**Câu hỏi:** Xử lý từng vấn đề:
- a) Scale theo chu kỳ tuần dự đoán được
- b) Scale theo CPU thất thường
- c) ASG không phát hiện app treo
- d) Instance mới mất 4 phút mới sẵn sàng (2 cách)

<details>
<summary>💡 Đáp án</summary>

**a) Predictive Scaling** — ML-based, forecast traffic, scale **proactive** theo chu kỳ ngày/tuần.
*(Scheduled Scaling cũng chấp nhận nếu đề nói giờ cố định cứng, ví dụ "scale up 9 AM, down 6 PM".)*

**b) Target Tracking Scaling** — giữ metric ở giá trị mục tiêu (ví dụ CPU 50%), **dễ setup nhất**.
*(Metric tốt hơn cho web sau ALB: `ALBRequestCountPerTarget`.)*

**c)** Đổi từ **EC2 health check** sang **ELB health check** — ELB check **application health** (recommended), EC2 chỉ check instance status.

**d)** Hai cách:
- **Dùng pre-configured AMI** (bake sẵn app/config) → giảm thời gian bootstrap và **giảm cooldown** (default cooldown = **300 giây**).
- **Warm pools** — giữ sẵn pool instance đã pre-initialize (stopped/hibernated), vào phục vụ trong vài giây.
- *(Bổ sung: **Lifecycle hooks** nếu cần chạy logic bootstrap trước khi nhận traffic / cleanup trước khi terminate.)*
</details>

---

### 🎬 Kịch bản 8 — Chọn instance family

Nối mỗi workload với instance family và giải thích mnemonic:

| # | Workload |
|---|----------|
| 1 | In-memory cache Redis 500 GB RAM |
| 2 | Video transcoding, CPU chạy 100% liên tục |
| 3 | Web server nội bộ, ngày thường idle, thỉnh thoảng có burst |
| 4 | SAP HANA cần RAM cực lớn |
| 5 | NoSQL database cần IOPS local cực cao |
| 6 | Cluster Hadoop/HDFS cần dung lượng đĩa dày |
| 7 | App backend cân bằng CPU và RAM |
| 8 | Render đồ họa 3D / ML inference |

<details>
<summary>💡 Đáp án</summary>

| # | Family | Mnemonic |
|---|--------|----------|
| 1 | **R5/R6** — Memory Optimized | **R**AM |
| 2 | **C5/C6** — Compute Optimized | **C**ompute |
| 3 | **T3/T4g** — Burstable | **T**hink **T**iny |
| 4 | **X1/X2** — Memory Optimized (extreme) | E**x**treme memory |
| 5 | **I3/I4** — Storage Optimized | **I**OPS |
| 6 | **D2/D3** — Storage Optimized | **D**ense storage |
| 7 | **M5/M6** — General Purpose | **M**ost scenarios |
| 8 | **G4/G5** — Accelerated Computing | **G**raphics |

**🎯 Bẫy:** R vs X (X = RAM cực lớn, SAP HANA/big data) · I vs D (I = IOPS nhanh, D = Dense dung lượng) · P vs G (P = training, G = graphics/inference).

**Nhắc cách đọc tên:** `m5.2xlarge` → `m` = family, `5` = generation, `2xlarge` = size.
</details>

---

### 🎬 Kịch bản 9 — Bài toán tiết kiệm chi phí hỗn hợp

Công ty có 4 nhóm workload, hãy chọn pricing model cho **từng nhóm**:

| Nhóm | Mô tả |
|------|-------|
| A | 20 instance chạy 24/7 suốt 3 năm tới, cấu hình chốt không đổi, muốn **giảm giá tối đa** |
| B | 50 instance xử lý ảnh, chạy lúc rảnh, **bị kill lúc nào cũng được** |
| C | Môi trường dev/test, dev tự bật tắt, không đoán trước, chỉ chạy vài tuần |
| D | Cam kết chi $10/giờ trong 3 năm nhưng **muốn tự do đổi instance family, OS, Region** |

<details>
<summary>💡 Đáp án</summary>

| Nhóm | Chọn | Lý do |
|------|------|-------|
| A | **Standard Reserved Instances, 3-year, All Upfront** | Predictable + cấu hình cố định → Standard RI cho **discount cao nhất (40–60%)**; All Upfront = discount cao nhất trong 3 payment options |
| B | **Spot Instances** | Fault-tolerant → tiết kiệm **50–90%**, chấp nhận 2-minute warning |
| C | **On-Demand** | Short-term, unpredictable, no commitment |
| D | **Compute Savings Plans** | Cam kết theo **$/hour** (40–66%), **flexible** across instance family / Region / OS |

**🎯 Phân biệt bẫy lớn nhất — RI vs Savings Plans:**
- Cam kết **một cấu hình instance cụ thể** → Reserved Instances
- Cam kết **một mức chi tiêu $/giờ** → Savings Plans
- Cần đổi được instance type nhưng vẫn muốn RI → **Convertible RI** (discount thấp hơn Standard)
- Savings Plans muốn discount cao hơn, chấp nhận kém linh hoạt → **EC2 Instance Savings Plans**
</details>

---

### 🎬 Kịch bản 10 — Chọn nền tảng container

Ba công ty, cùng chạy container. Chọn service cho mỗi bên:

- **Công ty X:** team nhỏ, chỉ dùng AWS, muốn chạy Docker **đơn giản nhất**, không muốn động vào EC2 hay scaling cluster.
- **Công ty Y:** đang chạy Kubernetes on-premises với Helm chart, muốn lên cloud nhưng **giữ nguyên toolchain K8s** và có thể chuyển sang cloud khác sau này.
- **Công ty Z:** chạy container nhưng cần **GPU instance đặc thù** và muốn tối ưu chi phí bằng RI/Spot mua sẵn, chấp nhận tự quản lý node.

<details>
<summary>💡 Đáp án</summary>

- **X → ECS on Fargate.** Serverless containers, AWS quản lý hạ tầng, **simplest**, pay per task.
- **Y → EKS.** Managed Kubernetes, dùng standard K8s tools, **multi-cloud portability**, control plane multi-AZ. Đổi lại: phức tạp và đắt hơn ECS.
- **Z → ECS on EC2 launch type.** **Full control**, chọn được instance đặc thù, tối ưu chi phí bằng RI/Spot.

**🔑 Thần chú:**
```
Docker on AWS               → ECS
Kubernetes on AWS           → EKS
Serverless containers       → Fargate
No infrastructure management→ Fargate
Full control                → ECS on EC2
```
**⚠️ Common mistake #5:** dùng EKS khi ECS đã đủ → phức tạp và đắt hơn không cần thiết.
</details>

---

## 2️⃣ KỊCH BẢN TIẾN HÓA — Startup "ShopFast"

> Một công ty đi qua 7 giai đoạn. **Trả lời tuần tự**, mỗi giai đoạn dựa trên giai đoạn trước.
> Đây là bài tập nối kiến thức thành một hệ thống thay vì học rời rạc.

**Giai đoạn 1.** Founder solo, muốn dựng website WordPress giới thiệu sản phẩm trong 1 buổi chiều, muốn **biết trước hóa đơn hàng tháng**, không rành AWS.
<details><summary>💡</summary>

**Amazon Lightsail** — VPS đơn giản, pre-configured **WordPress**, **fixed pricing** (predictable monthly cost), đã gồm compute + storage + networking + DNS. Dành cho beginner / simple application.
</details>

**Giai đoạn 2.** App backend Node.js ra đời. Dev muốn **push code là chạy**, tự có load balancer + auto scaling, nhưng vẫn muốn nhìn thấy/EC2 tinh chỉnh được khi cần.
<details><summary>💡</summary>

**AWS Elastic Beanstalk** (PaaS). Deploy app không phải tự dựng ELB/ASG/EC2, hỗ trợ Node.js. Components: Application → Application Version → Environment (**Web Server** env cho phần này).
</details>

**Giai đoạn 3.** Có thêm luồng xử lý đơn hàng chạy nền, không phục vụ HTTP request. Beanstalk có kiểu environment nào cho việc này?
<details><summary>💡</summary>

**Worker environment** (Beanstalk có 2 loại environment: **Web Server** và **Worker**).
</details>

**Giai đoạn 4.** Traffic tăng, cần tự động thêm/bớt EC2. Cần khai báo những gì?
<details><summary>💡</summary>

- **Launch Template** (khuyến nghị, thay cho Launch Configuration legacy): có **versioning**, hỗ trợ **multiple instance types**, mix **Spot + On-Demand**.
- **Auto Scaling Group**: **Min / Max / Desired capacity**, **health checks** (EC2 hoặc **ELB**), và **scaling policies**.
</details>

**Giai đoạn 5.** Người dùng upload ảnh sản phẩm lên S3, cần tạo thumbnail ngay, mỗi lần xử lý ~5 giây. Không muốn nuôi server.
<details><summary>💡</summary>

**S3 + Lambda** (real-time file processing). S3 gọi Lambda kiểu **asynchronous** (Lambda queue request, **retry 2 lần**).
Nếu event fail hết retry → cấu hình **DLQ / on-failure destination** để không mất dữ liệu.
</details>

**Giai đoạn 6.** Cần chạy job tổng hợp doanh thu **mỗi đêm 2h sáng**, chạy ~3 phút.
<details><summary>💡</summary>

**EventBridge + Lambda** (scheduled tasks). 3 phút < 15 phút nên Lambda vẫn hợp lệ.
*(Nếu job phình lên >15 phút → chuyển sang **AWS Batch** hoặc **ECS**.)*
</details>

**Giai đoạn 7.** Công ty lên global, cần chạy logic auth/redirect/A-B testing **ngay tại edge**, gần user nhất.
<details><summary>💡</summary>

**Lambda@Edge** — chạy Lambda tại **CloudFront edge locations**. Use case: **A/B testing, authentication, redirects**.
</details>

---

## 3️⃣ DRILL KEYWORD → SERVICE (60 giây)

Che cột phải. Đọc keyword, bật ra đáp án trong **dưới 3 giây**.

<details>
<summary>💡 Mở bảng đáp án</summary>

| Keyword trong đề | Đáp án phản xạ |
|---|---|
| "Serverless" | Lambda, Fargate |
| "No infrastructure management" | Lambda / Fargate |
| "Event-driven" | Lambda |
| "Containers" | ECS, EKS |
| "Kubernetes" | EKS |
| "Docker on AWS", đơn giản | ECS |
| "Batch processing" | AWS Batch, Spot Instances |
| "Cost-effective" + "fault-tolerant" | Spot Instances |
| "Predictable workload" + "1–3 years" | Reserved Instances |
| "Commit $/hour" + "flexible" | Savings Plans |
| "Licensing requirements" / "compliance" + physical host | Dedicated Hosts |
| "Automatically scale" | Auto Scaling Group |
| "High availability" | Multi-AZ, Auto Scaling, ELB |
| "Low latency" giữa các instance | Cluster Placement Group, Enhanced Networking |
| "HPC" + "MPI" + "OS-bypass" | EFA |
| "Temporary data" + "high IOPS" | Instance Store |
| "Cold start" | Provisioned Concurrency |
| "Guarantee capacity" cho 1 function | Reserved Concurrency |
| "Reusable libraries" cho Lambda | Lambda Layers |
| "Run at CloudFront edge" | Lambda@Edge |
| "Persistent storage cho Lambda" | EFS (không phải /tmp) |
| "Fixed monthly price", "WordPress" | Lightsail |
| "Forecast traffic", proactive | Predictive Scaling |
| "Scale up 9 AM, down 6 PM" | Scheduled Scaling |
| "Keep CPU at 50%", dễ setup nhất | Target Tracking |
| "Different thresholds, different steps" | Step Scaling |

</details>

**Decision tree tự vẽ lại từ trí nhớ (rồi so với file 01):**
<details><summary>💡 Đáp án</summary>

```
Need compute?
├─ Serverless? → Lambda
├─ Containers?
│  ├─ Kubernetes? → EKS
│  └─ Simple? → ECS (Fargate)
├─ VMs?
│  ├─ Simple? → Lightsail
│  └─ Advanced? → EC2
└─ Batch? → AWS Batch
```
</details>

---

## 4️⃣ SỐ LIỆU PHẢI THUỘC (điền vào chỗ trống)

Tự điền trước khi mở:

1. Lambda max execution time: `____`
2. Lambda memory: `____ MB` → `____ GB`
3. Lambda default concurrency limit / region: `____`
4. Lambda `/tmp`: `____ MB` → `____ GB`
5. Lambda environment variables limit: `____ KB`
6. Lambda Layers: max `____` layers, tổng `____ MB`
7. Lambda async invocation retry: `____` lần
8. Lambda free tier: `____` requests/tháng + `____` GB-seconds
9. Spread placement group: max `____` instances per AZ
10. Partition placement group: max `____` partitions per AZ
11. Cluster placement group network throughput: `____ Gbps`
12. ASG default cooldown: `____` giây
13. Spot termination warning: `____` phút
14. Reserved Instances discount: `____%`
15. Spot discount: `____%`
16. Savings Plans discount: `____%`
17. ENA bandwidth: up to `____ Gbps`; Intel 82599 VF (legacy): up to `____ Gbps`

<details>
<summary>💡 Đáp án</summary>

1. **15 phút**
2. **128 MB → 10 GB**
3. **1,000** concurrent executions per region
4. **512 MB → 10 GB** (ephemeral)
5. **4 KB**
6. **5** layers, **250 MB** tổng
7. **2** lần
8. **1M** requests/tháng + **400,000** GB-seconds
9. **7** instances / AZ
10. **7** partitions / AZ
11. **10 Gbps**
12. **300 giây**
13. **2 phút**
14. **40–60%**
15. **50–90%**
16. **40–66%**
17. ENA **100 Gbps**; Intel 82599 VF **10 Gbps**

**🎯 Bẫy hay gặp:** nhầm "7 instances/AZ" (Spread) với "7 partitions/AZ" (Partition) — Partition mỗi partition chứa **nhiều** instance.
</details>

---

## 5️⃣ TÌM LỖI KIẾN TRÚC

Mỗi kịch bản dưới đây **có ít nhất 1 lỗi**. Chỉ ra lỗi và sửa.

**Lỗi 1.** Team dùng Lambda để convert file video dài, mỗi file mất khoảng 40 phút. Họ tăng memory lên 10 GB để "chạy nhanh hơn cho kịp".
<details><summary>💡</summary>

Lỗi: Lambda **max 15 phút**, tăng memory không phá được giới hạn này.
Sửa: chuyển sang **ECS/Fargate** hoặc **AWS Batch** (long-running, container).
*(Common mistake #2 trong file 01.)*
</details>

**Lỗi 2.** Production app chạy 24/7 ổn định suốt 2 năm qua, vẫn để nguyên **On-Demand** vì "linh hoạt".
<details><summary>💡</summary>

Lỗi: steady-state mà dùng On-Demand → **đắt nhất**.
Sửa: **Reserved Instances** hoặc **Savings Plans** (tiết kiệm 40–66%).
*(Common mistake #1.)*
</details>

**Lỗi 3.** App lưu session và file upload của user vào **Instance Store** để "IOPS cao"; ASG có scale-in scale-out bình thường.
<details><summary>💡</summary>

Lỗi: Instance Store là **ephemeral** — data mất khi instance stop/terminate. ASG scale-in sẽ terminate instance → mất session và file user.
Sửa: Instance Store chỉ cho **cache, buffer, temporary data**. Session → ElastiCache/DynamoDB; file → S3/EFS; data cần bền → **EBS**.
</details>

**Lỗi 4.** Để đạt HA, team đặt 10 instance vào **một Cluster Placement Group** trong 1 AZ.
<details><summary>💡</summary>

Lỗi: Cluster PG là **single AZ → không phải HA**. Cluster dành cho **low latency (HPC, big data)**, không dành cho high availability.
Sửa: HA → **Spread placement group** (max 7/AZ) và/hoặc **Multi-AZ + ASG + ELB**.
</details>

**Lỗi 5.** ASG cấu hình health check = **EC2**. App bị memory leak treo process nhưng OS vẫn chạy; instance không bao giờ bị thay thế.
<details><summary>💡</summary>

Lỗi: EC2 health check chỉ nhìn **instance status**, không biết app chết.
Sửa: dùng **ELB health check** (application health — recommended).
</details>

**Lỗi 6.** Team chọn **EKS** cho 3 microservice đơn giản, chỉ chạy trên AWS, không ai trong team biết Kubernetes; lý do: "nghe nói mạnh hơn".
<details><summary>💡</summary>

Lỗi: **Common mistake #5** — dùng EKS khi ECS đã đủ. EKS **phức tạp và đắt hơn**.
Sửa: **ECS on Fargate** (AWS-native, simpler setup, lower cost).
</details>

**Lỗi 7.** Function Lambda cần query RDS trong private subnet, team **mở RDS ra public** cho tiện.
<details><summary>💡</summary>

Lỗi: bảo mật. Sửa: **attach Lambda vào VPC** (private subnets). Nếu Lambda trong VPC cần gọi AWS services → dùng **VPC endpoints**.
</details>

---

## 6️⃣ CẶP DỄ NHẦM — phân biệt trong 1 câu

Tự nói ra sự khác biệt **trong một câu**, rồi đối chiếu:

<details>
<summary>💡 Đáp án</summary>

| Cặp | Phân biệt trong 1 câu |
|---|---|
| Standard RI vs Convertible RI | Standard discount cao nhất nhưng **không đổi được instance type**; Convertible đổi được, discount thấp hơn |
| Reserved Instances vs Savings Plans | RI cam kết **cấu hình instance**; SP cam kết **$/giờ** và linh hoạt hơn |
| Compute SP vs EC2 Instance SP | Compute SP **flexible** (family/Region/OS); EC2 Instance SP **kém linh hoạt, discount cao hơn** |
| Dedicated Hosts vs Dedicated Instances | Hosts **control được placement** (đắt nhất); Instances chỉ dedicated hardware, không control placement |
| Instance Store vs EBS | Instance Store **ephemeral, IOPS rất cao**; EBS bền vững |
| Cluster vs Spread vs Partition PG | Cluster = **low latency 1 AZ**; Spread = **HA, 7 instance/AZ**; Partition = **big data, 7 partition/AZ** |
| ENA vs EFA | ENA = băng thông cao (**100 Gbps**); EFA = **OS-bypass** cho **HPC/MPI** |
| Launch Template vs Launch Configuration | Template có **versioning + multi instance type + Spot/On-Demand mix**; Configuration là legacy, single type |
| Target Tracking vs Step Scaling | Target Tracking giữ **1 metric ở target, dễ nhất**; Step scaling nhiều **ngưỡng alarm khác nhau** |
| Scheduled vs Predictive Scaling | Scheduled = **giờ cố định do người đặt**; Predictive = **ML forecast** |
| Reserved vs Provisioned Concurrency | Reserved = **giữ quota**; Provisioned = **pre-warm, hết cold start** |
| Sync vs Async vs Event Source Mapping | Sync = chờ response (**API Gateway, ALB**); Async = Lambda queue, retry 2 lần (**S3, SNS, EventBridge**); ESM = **Lambda poll nguồn** (SQS, Kinesis, DynamoDB Streams) |
| Lambda vs AWS Batch | Lambda **<15 phút, event-driven**; Batch **>15 phút, Docker, batch processing** |
| ECS vs EKS | ECS **AWS proprietary, đơn giản, rẻ**; EKS **Kubernetes, portable, phức tạp/đắt hơn** |
| EC2 launch type vs Fargate | EC2 = **bạn quản lý instance, control + tối ưu chi phí**; Fargate = **serverless, pay per task** |
| Immutable vs Blue/Green | Immutable = **ASG mới trong cùng environment**; Blue/Green = **environment mới, swap URL** |
| Rolling vs Rolling with Additional Batch | Rolling **giảm capacity**; with Additional Batch **giữ full capacity** |
| Lightsail vs EC2 | Lightsail = **fixed price, đơn giản, beginner**; EC2 = **pay-as-you-go, kiến trúc phức tạp** |
| P3/P4 vs G4/G5 | P = **ML training / HPC**; G = **graphics / ML inference** |
| R5/R6 vs X1/X2 | R = memory optimized thường; X = **extreme memory** (SAP HANA, big data) |
| I3/I4 vs D2/D3 | I = **IOPS** (NoSQL, data warehouse); D = **Dense storage** (MapReduce, HDFS) |

</details>

---

## 7️⃣ LỊCH ÔN 3 VÒNG

| Vòng | Thời điểm | Làm gì | Mục tiêu |
|------|-----------|--------|----------|
| **V1** | Ngay sau khi đọc [01-compute-services.md](../01-compute-services.md) | Phần 1 + Phần 2, cho phép mở đáp án sớm | Hiểu logic chọn service |
| **V2** | Sau 24 giờ | Phần 3 + 4 + 5, **không mở đáp án cho tới khi viết xong** | Nhớ số liệu + phản xạ keyword |
| **V3** | Sau 3–7 ngày | Phần 6 + làm lại [01-compute-services-exam-v2.md](01-compute-services-exam-v2.md) | Chống bẫy distractor |

**Chuẩn "thuộc bài"** — làm được hết checklist trong file 01 mà không cần mở tài liệu:

- [ ] Kể đủ **6 EC2 pricing models** + khi nào dùng cái nào
- [ ] Phân biệt **T, M, C, R, X, P, G, I, D** kèm mnemonic
- [ ] Kể **3 placement groups** + giới hạn số của từng loại
- [ ] Kể **5 scaling policies** + phân biệt Target Tracking / Step / Scheduled / Predictive
- [ ] Đọc thuộc **giới hạn Lambda** (15 phút, 10 GB, 1000 concurrency, 5 layers/250 MB)
- [ ] Phân biệt **ECS vs EKS vs Fargate** trong 1 câu mỗi cái
- [ ] Kể **6 Beanstalk deployment strategies** theo thứ tự downtime/an toàn
- [ ] Nói được **Spot vs Reserved vs On-Demand vs Savings Plans** chọn khi nào

---

**Liên quan:** [01-compute-services.md](../01-compute-services.md) · [01-compute-services-exam-v2.md](01-compute-services-exam-v2.md) · [L-quyet-dinh-nhanh.md](../L-quyet-dinh-nhanh.md) · [M-keywords-mapping.md](../M-keywords-mapping.md)
