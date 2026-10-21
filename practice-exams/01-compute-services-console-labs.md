# 🖱️ CONSOLE LABS — COMPUTE SERVICES (SAA-C03)

> **11 bài thực hành bấm tay trên AWS Management Console** cho [01-compute-services.md](../01-compute-services.md).
> Khác với [T-hands-on-labs.md](../T-hands-on-labs.md) (thiên về AWS CLI) — file này đi theo **đường bấm trong Console**,
> vì cái làm kiến thức dính lại là **nhìn tận mắt các dropdown/giới hạn/thông báo lỗi** mà đề thi hay hỏi.

## 🧭 Triết lý của bộ lab này

Bạn **không** cần build hệ thống production. Mục tiêu là **nhìn thấy con số và tùy chọn** bằng chính mắt mình:

> Nhớ "Lambda max 15 phút" vì đã đọc → dễ quên.
> Nhớ vì đã **gõ 16 phút vào ô Timeout và bị Console báo đỏ** → nhớ rất lâu.

Mỗi lab đều có mục **🧠 Ghi nhớ được gì** ánh xạ thẳng về nội dung file 01, và **🎯 Bẫy thi** tương ứng.

---

## ⚠️ LAB 0 — BẢO HIỂM CHI PHÍ (bắt buộc làm trước)

**Thời gian:** 10 phút · **Chi phí:** $0

1. Chọn **một Region duy nhất** cho toàn bộ lab (gợi ý `us-east-1`) và **luôn kiểm tra góc trên bên phải** — sai Region là nguyên nhân số 1 khiến bạn "quên xóa" tài nguyên và bị tính tiền.
2. **Billing and Cost Management** → **Billing preferences** → bật **Receive AWS Free Tier alerts** + nhập email.
3. **Billing and Cost Management** → **Budgets** → **Create budget** → chọn **Zero spend budget** (hoặc Monthly cost budget = **$5**) → nhập email → Create.
4. Mở sẵn một tab **EC2 → Instances** để cuối buổi rà lại.
5. Tự đặt **báo thức điện thoại 90 phút** — hết giờ là chạy phần **Dọn dẹp** của lab đang làm.

> 💡 **Quy tắc vàng:** mọi tài nguyên tạo ra trong lab phải có tag `Purpose = saa-lab` (Console luôn có mục **Tags**). Cuối buổi vào **Resource Groups & Tag Editor** → tìm theo tag này → không bỏ sót gì.

**🧠 Ghi nhớ được gì:** đây chính là tư duy **Cost Optimization** — domain chiếm 20% đề thi.

---

## 🧪 LAB 1 — Đọc "chứng minh thư" của Instance Type

**Mục tiêu:** thuộc bảng instance families mà không cần học vẹt
**Thời gian:** 15 phút · **Chi phí:** $0 (chỉ xem, không launch)

### Các bước

1. **EC2 Console** → menu trái → **Instance Types** (không phải Instances).
2. Ô search gõ `t3.micro`. Nhìn dòng kết quả và tự đọc tên theo công thức file 01:
   `m5.2xlarge` → `m` = **family**, `5` = **generation**, `2xlarge` = **size**.
3. Bật thêm cột bằng nút ⚙️ (Preferences): **Instance storage**, **Network performance**, **ENA support**, **EFA support**, **vCPUs**, **Memory**.
4. Lần lượt search và **ghi vào giấy** vCPU / RAM của: `c5.2xlarge`, `r5.2xlarge`, `m5.2xlarge`.
   → Cùng size `2xlarge` mà 3 con số RAM/vCPU khác hẳn nhau. Đó là toàn bộ ý nghĩa của chữ cái đầu.
5. Search `x1e.xlarge` → nhìn cột Memory (RAM khổng lồ so với vCPU) → hiểu vì sao **X = e**X**treme memory / SAP HANA**.
6. Search `i3.large` rồi `d3.xlarge` → so cột **Instance storage**:
   - `i3` = NVMe SSD → nhanh, **IOPS**
   - `d3` = HDD dung lượng lớn → **D**ense storage
7. Filter cột **EFA support = true** → xem danh sách. Toàn instance to (HPC/ML). Ghi nhớ EFA không phải ai cũng có.
8. Search `p3.2xlarge` và `g4dn.xlarge` → cả hai đều có GPU nhưng đề phân biệt: **P = ML training/HPC**, **G = Graphics/ML inference**.

### 🧠 Ghi nhớ được gì

| Nhìn thấy trong Console | Kiến thức file 01 |
|---|---|
| Cùng size, RAM/vCPU khác nhau | Family quyết định tỉ lệ CPU:RAM |
| Cột Instance storage của i3 vs d3 | **I**OPS vs **D**ense storage |
| RAM của x1e | **X** = extreme memory |
| Cột ENA / EFA support | Enhanced Networking chỉ có trên instance được hỗ trợ |

### 🎯 Bẫy thi
Đề cho "in-memory database" → **R**; "SAP HANA" → **X**. Đề cho "ML training" → **P**; "graphics rendering / inference" → **G**.

### Dọn dẹp
Không có gì để xóa.

---

## 🧪 LAB 2 — Sáu pricing models nằm ở đâu trong Console

**Mục tiêu:** phân biệt On-Demand / Spot / RI / Savings Plans / Dedicated Host / Dedicated Instance
**Thời gian:** 25 phút · **Chi phí:** $0 (dừng trước khi bấm Launch, trừ bước 6)

### Phần A — Trong Launch wizard

1. **EC2** → **Instances** → **Launch instances**.
2. Đặt Name `saa-lab-pricing`, chọn AMI **Amazon Linux 2023**, instance type **t2.micro / t3.micro** (Free tier eligible — chú ý nhãn xanh này).
3. Kéo xuống **Advanced details** → mở rộng. Đây là nơi 4/6 pricing model xuất hiện:
   - **Purchase option** → tick ☑ **Request Spot Instances** → hiện ra các tùy chọn Spot (interruption behavior: *terminate / stop / hibernate*).
   - **Tenancy** → dropdown 3 lựa chọn: **Shared** (mặc định) / **Dedicated instance** / **Dedicated host**.
     → Chọn **Dedicated host** → Console yêu cầu bạn phải có Host sẵn. Đây chính là khác biệt file 01 nói: Dedicated Host = **control placement**.
4. Vẫn trong Advanced details, tìm thêm và **ghi nhớ vị trí** (dùng ở các lab sau): **Placement group**, **Hibernation**, **User data**, **IAM instance profile**, **Metadata**.
5. **KHÔNG bấm Launch.** Thoát ra (hoặc để dành sang Lab 3).

### Phần B — Xem giá Spot thật

6. **EC2** → menu trái → **Spot Requests** → nút **Pricing history**.
7. Chọn instance type `m5.large`, xem biểu đồ theo từng AZ trong 3 tháng.
8. Mở tab mới: **EC2** → **Instance Types** → tìm `m5.large` → xem cột **On-Demand price**.
9. **Tự tính tỉ lệ giảm giá.** Bạn sẽ thấy con số rơi vào đúng khoảng **50–90%** như file 01 ghi.

### Phần C — Reserved Instances & Savings Plans

10. **EC2** → **Reserved Instances** → **Purchase Reserved Instances**. Nhìn form (KHÔNG mua):
    - **Term**: 1 năm / 3 năm → đúng "commitment 1 hoặc 3 năm"
    - **Offering class**: **Standard** vs **Convertible** → Standard rẻ hơn, Convertible đổi được instance type
    - **Payment option**: **All Upfront / Partial Upfront / No Upfront** → nhìn cột giá giảm dần theo thứ tự này
11. **Billing and Cost Management** → **Savings Plans** → **Purchase Savings Plans**. Nhìn form (KHÔNG mua):
    - **Savings Plan type**: **Compute Savings Plans** vs **EC2 Instance Savings Plans**
    - Ô nhập là **$/hour commitment** — chứ **không phải** chọn instance type.

> 🔑 Đây là khoảnh khắc "à ra thế" quan trọng nhất của lab: **RI form bắt chọn instance type; Savings Plans form bắt nhập $/giờ.** Đó chính là câu phân biệt cần nhớ đi thi.

### 🧠 Ghi nhớ được gì
- On-Demand = mặc định, không phải chọn gì.
- Spot = một **checkbox** trong Advanced details (+ hành vi khi bị đòi capacity).
- Dedicated Instance vs Dedicated Host = **hai giá trị khác nhau của cùng dropdown Tenancy**.
- RI = cam kết **cấu hình**; Savings Plans = cam kết **$/giờ**.

### 🎯 Bẫy thi
"Đổi được instance family, OS, Region" → **Compute Savings Plans**.
"License theo socket vật lý + phải cùng một máy vật lý" → **Dedicated Hosts** (không phải Dedicated Instances).

### Dọn dẹp
Không tạo gì (nếu bạn không bấm Launch/Purchase).

---

## 🧪 LAB 3 — Placement Groups: chạm vào giới hạn số

**Mục tiêu:** khắc sâu "7 instances/AZ" vs "7 partitions/AZ"
**Thời gian:** 20 phút · **Chi phí:** $0 (tạo placement group miễn phí)

### Các bước

1. **EC2** → menu trái → **Placement Groups** → **Create placement group**.
2. Tạo lần lượt **3 cái** (đặt tên rõ ràng để nhớ):
   - `saa-cluster` → Strategy **Cluster**
   - `saa-spread` → Strategy **Spread** → nhìn thêm dropdown **Spread level**: *Rack* / *Host*
   - `saa-partition` → Strategy **Partition** → xuất hiện ô **Number of partitions**
3. **Thí nghiệm quan trọng:** ở `saa-partition`, thử gõ **8** vào Number of partitions.
   → Console **chặn**, tối đa **7**. Đây chính là "max 7 partitions per AZ".
4. Mở **Launch instances** → Advanced details → **Placement group** → dropdown giờ hiện cả 3 group vừa tạo.
5. Chọn `saa-cluster` → để ý Console nhắc bạn về ràng buộc **cùng một AZ**.
6. (Tùy chọn, tốn ~vài cent) Launch **8 instance t3.micro** vào `saa-spread` → AWS trả lỗi vì Spread chỉ cho **7 instances mỗi AZ**. Nếu tiếc tiền thì chỉ cần đọc mô tả trong Console, đừng launch.

### 🧠 Ghi nhớ được gì

```
Cluster    → cùng 1 AZ, low latency, high throughput (10 Gbps) — KHÔNG phải HA
Spread     → khác hardware, max 7 INSTANCES / AZ — dành cho vài app critical
Partition  → khác rack, max 7 PARTITIONS / AZ (mỗi partition nhiều instance) — Hadoop/Cassandra/Kafka
```

### 🎯 Bẫy thi
Đề nói "12 node Cassandra" → **Partition** (Spread không đủ chỗ vì trần 7 instance).
Đề nói "HA" mà đáp án là Cluster → sai, Cluster là **single AZ**.

### Dọn dẹp
**Placement Groups** → chọn cả 3 → **Delete** (phải xóa/terminate instance bên trong trước).

---

## 🧪 LAB 4 — Launch Template + Auto Scaling Group (lab quan trọng nhất)

**Mục tiêu:** nhìn tận mắt Min/Max/Desired, health check EC2 vs ELB, 5 loại scaling policy, cooldown 300s, warm pool, lifecycle hook
**Thời gian:** 45 phút · **Chi phí:** ~$0 nếu dùng t2.micro/t3.micro Free Tier và xóa trong ngày

### Phần A — Launch Template

1. **EC2** → **Launch Templates** → **Create launch template**.
2. Name `saa-lt-web`, tick ☑ **Provide guidance to help me set up a template that I can use with EC2 Auto Scaling**.
3. AMI **Amazon Linux 2023**, instance type **t3.micro**, Key pair: *Don't include*.
4. **Advanced details** → **User data**, dán:
   ```bash
   #!/bin/bash
   dnf install -y httpd
   systemctl enable --now httpd
   echo "<h1>SAA lab - $(hostname -f)</h1>" > /var/www/html/index.html
   ```
5. Create. Sau đó vào lại template → **Actions** → **Modify template (Create new version)** → sửa gì đó → Create.
   → Bạn vừa tạo **Version 2**. Quay lại danh sách sẽ thấy cột **Default version / Latest version**.

> 🔑 **Launch Configuration không có tính năng này.** Đó là lý do file 01 ghi Launch Template = *newer, recommended, có versioning*.

### Phần B — Auto Scaling Group

6. **EC2** → **Auto Scaling Groups** → **Create Auto Scaling group**.
7. Step 1: name `saa-asg`, chọn launch template `saa-lt-web` → để ý ô chọn **Version** (Latest / Default / số cụ thể).
8. Step 2: chọn VPC default + **ít nhất 2 Availability Zones** (đây là "Multi-AZ" mà đề luôn nhắc).
   → Để ý mục **Instance type requirements**: cho phép **mix nhiều instance type** và đặt tỉ lệ **On-Demand / Spot**. Chính là "Launch Template hỗ trợ Spot + On-Demand mix".
9. Step 3: **Health checks** — đây là ô rất hay ra thi:
   - **EC2 health checks** luôn bật.
   - ☑ **Turn on Elastic Load Balancing health checks** ← chỉ bật được khi có ELB/target group.
   - **Health check grace period** = 300 giây (mặc định).
10. Step 4: **Group size** → nhập **Desired = 2, Min = 1, Max = 4**.
11. Cùng Step 4: **Scaling policies** → chọn **Target tracking scaling policy**:
    - Metric type dropdown → xem đủ: **Average CPU utilization**, **Average network in/out**, **Application Load Balancer request count per target**.
    - Chọn CPU, Target value **50**.
12. Create ASG. Đợi 2 instance khởi động → tab **Activity** kể lại từng hành động scale.

### Phần C — Nhìn 4 loại scaling policy còn lại

13. Vào ASG → tab **Automatic scaling**:
    - **Dynamic scaling policies** → **Create dynamic scaling policy** → dropdown **Policy type**: **Target tracking / Step scaling / Simple scaling** → xem cả 3 nằm cùng một chỗ.
    - Chọn **Simple scaling** → xuất hiện ô **Cooldown** với giá trị mặc định **300 seconds** ✅ (đúng như file 01).
    - **Predictive scaling policies** → **Create predictive scaling policy** → Console nói rõ nó **forecast** và cần lịch sử metric → đây là loại **ML-based, proactive**.
    - **Scheduled actions** → **Create scheduled action** → nhập Recurrence dạng cron `0 9 * * *` và Desired capacity → đúng ví dụ "scale up 9 AM".
14. Vào ASG → tab **Instance management**:
    - **Lifecycle hooks** → **Create lifecycle hook** → dropdown **Lifecycle transition**: **Instance launch** / **Instance terminate** → đúng nhu cầu "bootstrap trước khi nhận traffic" và "cleanup trước khi terminate".
    - **Warm pool** → **Create warm pool** → chọn trạng thái instance giữ sẵn: **Stopped / Running / Hibernated**.
15. Vào ASG → tab **Details** → **Advanced configurations** → **Edit** → thấy **Default cooldown = 300 seconds**.

### Phần D — Xem ASG tự chữa lành

16. **EC2 → Instances** → chọn 1 instance của ASG → **Instance state → Terminate**.
17. Quay lại ASG → tab **Activity** → đợi vài phút: ASG tự launch instance thay thế để giữ **Desired = 2**.

### 🧠 Ghi nhớ được gì

| Thao tác | Kiến thức file 01 |
|---|---|
| Template có version, Configuration không | Launch Template = newer, recommended |
| Ô On-Demand/Spot percentage | Template hỗ trợ mix Spot + On-Demand |
| Checkbox ELB health check | ELB check **application health** (recommended); EC2 chỉ check instance status |
| Ô Cooldown = 300 | Default cooldown 300 giây |
| 3 policy trong 1 dropdown + Predictive + Scheduled | Đủ **5 scaling policies** |
| Terminate tay → tự mọc lại | ASG giữ **Desired capacity** = self-healing |

### 🎯 Bẫy thi
"App treo nhưng instance vẫn running, ASG không thay thế" → thiếu **ELB health check**.
"Scale theo dự báo chu kỳ" → **Predictive**; "9h sáng cố định" → **Scheduled**; "giữ CPU 50%, dễ nhất" → **Target tracking**.

### Dọn dẹp (làm ngay, đừng để qua đêm)
1. **Auto Scaling Groups** → `saa-asg` → **Delete** (ASG sẽ tự terminate instance bên trong).
2. **Launch Templates** → `saa-lt-web` → **Delete template** (xóa cả các version).
3. Kiểm tra lại **EC2 → Instances** không còn instance nào đang running.

---

## 🧪 LAB 5 — Lambda: đụng vào từng giới hạn

**Mục tiêu:** khắc 15 phút / 128 MB–10 GB / /tmp 512 MB–10 GB / env var 4 KB / retry 2 / concurrency 1000
**Thời gian:** 30 phút · **Chi phí:** $0 (Free tier 1M requests/tháng)

### Các bước

1. **Lambda** → **Create function** → Author from scratch, name `saa-lab-limits`, Runtime **Python 3.12** → Create.
   → Để ý dropdown Runtime có Python, Node.js, Java, Go, Ruby, .NET — đúng danh sách languages file 01.
2. Tab **Configuration** → **General configuration** → **Edit**:
   - **Memory**: kéo slider hết cỡ → dừng ở **10240 MB (10 GB)**. Gõ tay `10241` → **báo lỗi đỏ**.
   - **Ephemeral storage (/tmp)**: mặc định **512 MB**, kéo max → **10240 MB**.
   - **Timeout**: gõ **15 min 0 sec** → OK. Gõ **15 min 1 sec** → **báo lỗi**. ✅ Đây là khoảnh khắc cần nhớ.
3. **Configuration → Environment variables** → thêm vài biến, thử dán một chuỗi rất dài → Console cảnh báo vượt **4 KB**.
4. **Configuration → Concurrency and recursion detection**:
   - **Reserved concurrency** → **Edit** → Console hiện **Unreserved account concurrency** (mặc định tài khoản là **1,000** cho region, trừ khi đã được nâng).
   - **Provisioned concurrency** → **Add configuration** → Console nói rõ nó **pre-initialize execution environments** và **có tính phí**.
   > 🔑 Hai mục này nằm **cạnh nhau nhưng khác chức năng**: Reserved = giữ/giới hạn quota; Provisioned = pre-warm chống **cold start**.
5. **Configuration → Asynchronous invocation** → **Edit**:
   - **Maximum age of event**
   - **Retry attempts** → dropdown chỉ có **0, 1, 2** → đúng "async retry 2 lần"
   - **Dead-letter queue** (SQS/SNS) → nơi hứng event fail hết retry
6. **Configuration → VPC** → **Edit** → chọn VPC + private subnet + security group → Console cảnh báo: vào VPC rồi thì muốn gọi AWS service phải có **NAT hoặc VPC endpoints**.
7. **Configuration → File systems** → **Add file system** → đây là chỗ mount **EFS** (persistent storage) — phân biệt với **/tmp** (ephemeral).
8. Cuộn xuống mục **Layers** (dưới tab **Code**) → **Add a layer** → Console nhắc giới hạn **5 layers**.
9. Bấm **Test** → tạo test event → chạy → đọc phần **Report**: `Duration`, `Billed Duration`, `Memory Size`, `Max Memory Used`, `Init Duration`.
   → **`Init Duration` chỉ xuất hiện ở lần chạy đầu = cold start.** Bấm Test lần 2 ngay → `Init Duration` biến mất.

### 🧠 Ghi nhớ được gì
Bạn đã **tự tay đâm vào tường** ở: 10 GB memory, 15 phút timeout, 10 GB /tmp, 4 KB env var, retry 2, 5 layers — và đã **nhìn thấy cold start** bằng dòng `Init Duration`.

### 🎯 Bẫy thi
"Job 40 phút" → **KHÔNG** phải Lambda → ECS/Batch.
"Request đầu chậm" → **Provisioned** concurrency (không phải Reserved).
"Lambda cần data bền vững" → **EFS** (không phải /tmp).

### Dọn dẹp
**Lambda → Functions** → xóa `saa-lab-limits`. Nếu có bật Provisioned concurrency → **xóa configuration đó trước** (nó tính phí theo giờ!).

---

## 🧪 LAB 6 — Event-driven thật: S3 → Lambda

**Mục tiêu:** hiểu invocation types bằng cách chạy thật
**Thời gian:** 20 phút · **Chi phí:** ~$0

### Các bước

1. **S3** → **Create bucket** → tên duy nhất, ví dụ `saa-lab-<tên-bạn>-2026`.
2. **Lambda** → **Create function** `saa-lab-s3-trigger`, Python 3.12.
3. Dán code và **Deploy**:
   ```python
   def lambda_handler(event, context):
       for r in event.get("Records", []):
           print("BUCKET:", r["s3"]["bucket"]["name"])
           print("KEY:", r["s3"]["object"]["key"])
       return {"ok": True}
   ```
4. Trong function → **Add trigger** → chọn **S3** → chọn bucket → Event types **All object create events** → tick xác nhận → Add.
   → Lambda **tự thêm resource-based policy** cho S3 (xem tab **Configuration → Permissions → Resource-based policy statements**).
5. Quay lại S3 → **Upload** một file ảnh bất kỳ.
6. Lambda → tab **Monitor** → **View CloudWatch logs** → mở log stream mới nhất → thấy tên bucket + key được in ra.

### 🧠 Ghi nhớ được gì

| Nguồn gọi | Kiểu invocation |
|---|---|
| API Gateway, ALB | **Synchronous** (chờ response) |
| **S3**, SNS, EventBridge | **Asynchronous** (Lambda queue, retry 2) ← bạn vừa làm cái này |
| SQS, Kinesis, DynamoDB Streams | **Event Source Mapping** (Lambda **poll** nguồn) |

Đây đúng use case file 01: **"Real-time file processing → S3 + Lambda"**.

### 🎯 Bẫy thi
S3 → Lambda là **async** → nếu đề hỏi "event fail hết retry, không được mất dữ liệu" → **DLQ / on-failure destination** (bạn đã thấy ô đó ở Lab 5 bước 5).

### Dọn dẹp
Xóa **hết object** trong bucket → xóa bucket → xóa Lambda function.

---

## 🧪 LAB 7 — Elastic Beanstalk: 6 deployment policies trong một dropdown

**Mục tiêu:** phân biệt All at once / Rolling / Rolling with additional batch / Immutable / Traffic splitting / Blue-Green
**Thời gian:** 35 phút · **Chi phí:** ⚠️ có phí nhỏ nếu chọn load-balanced (ALB ~$0.6/ngày). **Xóa trong ngày.**

### Các bước

1. **Elastic Beanstalk** → **Create application**.
2. Application name `saa-eb`, Platform **Python** (hoặc Node.js), Application code **Sample application**.
3. **Configure more options** (Configure service access → tạo/chọn role mặc định).
4. Ở bước **Set up networking / Configure instance traffic and scaling**:
   - Chọn **Environment type = Load balanced** (bắt buộc nếu muốn nhìn thấy **đủ** các deployment policy).
   - Min instances **2**, Max **4**.
5. Bước **Configure updates, monitoring, and logging** → mục **Deployment policy** → **mở dropdown và đọc kỹ**:
   - **All at once**
   - **Rolling** → hiện ô **Batch size** (bao nhiêu instance mỗi đợt)
   - **Rolling with additional batch** → so sánh với Rolling: thêm instance mới **trước** nên giữ full capacity
   - **Immutable** → Console mô tả: launch instance mới trong **ASG tạm** rồi mới chuyển sang
   - **Traffic splitting** → hiện thêm ô **% traffic** và **evaluation time** → chính là **canary**
6. Create environment (đợi ~5 phút). Mở **Environment URL** để thấy sample app chạy.
7. Vào environment → **Configuration** → **Updates, monitoring, and logging** → **Edit** → đổi qua đổi lại giữa các policy để xem ô cấu hình thay đổi thế nào.
8. **Blue/Green (thao tác đặc trưng):**
   - Tạo **environment thứ hai** trong cùng application (`saa-eb-green`).
   - Vào **Environments** → chọn env → **Actions** → **Swap environment URLs**.
   → Đây chính xác là "new environment, swap URLs, zero downtime" trong file 01. **Rollback = swap ngược lại.**
9. Để ý ở màn hình tạo env có lựa chọn **Web server environment** vs **Worker environment** → đúng 2 loại environment file 01 liệt kê.

### 🧠 Ghi nhớ được gì
Beanstalk **tự dựng EC2 + ASG + ELB** cho bạn (vào **EC2 Console** xem sẽ thấy ASG tên `awseb-...`) → đó là ý nghĩa của **PaaS**: bạn deploy app, AWS lo hạ tầng.

### 🎯 Bẫy thi
"Zero downtime + swap URL" → **Blue/Green**.
"An toàn nhất, rollback dễ" → **Immutable**.
"Giữ full capacity, không downtime" → **Rolling with additional batch**.
"Test % traffic" → **Traffic splitting**.

### Dọn dẹp ⚠️ QUAN TRỌNG
**Elastic Beanstalk → Applications → `saa-eb` → Actions → Delete application** (xóa cả 2 environment).
Sau đó kiểm tra **EC2 → Load Balancers** và **Auto Scaling Groups** đã sạch chưa — ALB còn sót là tốn tiền nhất.

---

## 🧪 LAB 8 — ECS on Fargate + Fargate Spot

**Mục tiêu:** hiểu Task Definition / Task / Service / Cluster và capacity provider
**Thời gian:** 30 phút · **Chi phí:** vài cent nếu xóa trong 1 giờ

### Các bước

1. **ECS** → **Clusters** → **Create cluster** → name `saa-ecs`, Infrastructure để mặc định **AWS Fargate (serverless)**.
   → Chú ý: có thể tick thêm **Amazon EC2 instances** → đó chính là **EC2 launch type**.
2. **Task definitions** → **Create new task definition**:
   - Family `saa-task`
   - **Launch type: AWS Fargate**
   - **CPU 0.25 vCPU / Memory 0.5 GB** ← để ý Fargate bắt bạn khai báo CPU/RAM **ở mức task**, không phải mua server
   - Container: name `web`, Image URI `public.ecr.aws/nginx/nginx:latest`, Port **80**
   - Create.
3. Vào cluster `saa-ecs` → tab **Services** → **Create**:
   - **Capacity provider strategy** → chọn **Use custom** → thấy **FARGATE** và **FARGATE_SPOT**.
   - Thêm cả hai: FARGATE **Base = 1**, Weight 1 · FARGATE_SPOT Weight 4.
   - Task definition `saa-task`, Desired tasks **3**.
   - Networking: VPC default, public subnets, **Public IP: Turned on**.
4. Đợi service ổn định → tab **Tasks** → nhìn cột **Capacity provider**: sẽ thấy task chạy trên **cả FARGATE lẫn FARGATE_SPOT**.
5. Mở một task → **Public IP** → dán vào trình duyệt → trang nginx.
6. **Thí nghiệm self-healing:** chọn 1 task → **Stop** → ECS **Service** tự tạo task mới để giữ đúng **desired count 3**.

### 🧠 Ghi nhớ được gì

| Khái niệm | Bạn vừa thấy |
|---|---|
| **Task Definition** | Blueprint: image, CPU, memory, ports |
| **Task** | Một instance đang chạy của definition |
| **Service** | Giữ đúng **desired number of tasks** (stop 1 → mọc lại) |
| **Cluster** | Nhóm logic chứa tasks/services |
| **Fargate** | Không hề thấy một EC2 instance nào trong console |

**Base = 1 trên FARGATE** chính là câu trả lời cho kịch bản "rẻ nhất nhưng phải luôn có baseline khả dụng".

### 🎯 Bẫy thi
"Docker, không quản lý hạ tầng" → **ECS on Fargate**.
"Cần instance đặc thù / dùng RI-Spot đã mua" → **ECS on EC2**.
"Đang có Helm chart, cần portability" → **EKS**.

### Dọn dẹp
Service → **Delete** (hoặc set desired = 0 rồi delete) → **Delete cluster** → xóa **Task definition** (Deregister all revisions).

---

## 🧪 LAB 9 — AWS Batch: nhìn thấy "hàng đợi job"

**Mục tiêu:** phân biệt Batch với Lambda bằng trải nghiệm
**Thời gian:** 25 phút · **Chi phí:** vài cent

### Các bước

1. **AWS Batch** → **Compute environments** → **Create**:
   - Type **Fargate** (đơn giản, không phải quản EC2)
   - Name `saa-batch-ce`, Max vCPUs 4
   - ☑ **Use Fargate Spot capacity** ← đúng combo "Batch + Spot" của đề thi
2. **Job queues** → **Create** → name `saa-queue`, Priority 1, gắn compute environment vừa tạo.
3. **Job definitions** → **Create** → Type **Single-node**, Platform **Fargate**, name `saa-jobdef`:
   - Image `public.ecr.aws/amazonlinux/amazonlinux:latest`
   - Command: `sh -c "echo start; sleep 60; echo done"`
   - vCPU 0.25, Memory 512 MiB
   - **Job timeout**: gõ thử **3600** giây → Console nhận bình thường.
     🔑 **So sánh ngay với Lab 5:** Lambda chặn ở 900 giây, Batch cho 3600 giây (và hơn nữa). Đây là toàn bộ khác biệt Batch vs Lambda.
4. **Jobs** → **Submit new job** → chọn queue + job definition → Submit.
5. Nhìn job đi qua các trạng thái: **SUBMITTED → PENDING → RUNNABLE → STARTING → RUNNING → SUCCEEDED**.
   → Bạn đang nhìn thấy chính cái **"Job Queue + scheduler tự provision resource"** mà file 01 mô tả.
6. Submit **5 job liên tiếp** → xem Batch tự xếp hàng và giới hạn theo Max vCPUs.
7. Vào **CloudWatch Logs** (log group `/aws/batch/job`) đọc output.

### 🧠 Ghi nhớ được gì

```
AWS Batch: Jobs · Job Definitions · Job Queues · Compute Environments (EC2 hoặc Fargate)
           → long-running (>15 min), Docker, batch processing
Lambda:    → short (<15 min), event-driven, serverless
```

### 🎯 Bẫy thi
"Nightly batch, chịu được gián đoạn, rẻ" → **AWS Batch với Spot**.

### Dọn dẹp
Xóa theo thứ tự: **Job definitions** (deregister) → **Job queues** (Disable rồi Delete) → **Compute environments** (Disable rồi Delete).

---

## 🧪 LAB 10 — Instance Store vs EBS, và Hibernation

**Mục tiêu:** hiểu "ephemeral" bằng cách **làm mất dữ liệu thật**
**Thời gian:** 25 phút · **Chi phí:** vài cent (instance store cần instance type không thuộc free tier)

### Phần A — Nhìn trước, không tốn tiền

1. **EC2 → Launch instances** → chọn instance type `t3.micro` → xuống mục **Configure storage** → chỉ có **EBS volume** (gp3).
2. Đổi instance type sang `m5d.large` (có chữ **d** = có disk) → mục Configure storage giờ hiện thêm dòng **Instance store volumes** — và bạn **không đổi được size, không tách rời được**.
3. Ở dropdown volume type của EBS, đọc đủ 4 loại file 01 liệt kê: **gp3/gp2**, **io2/io1**, **st1**, **sc1**.

### Phần B — Thí nghiệm mất dữ liệu (tùy chọn, ~$0.10)

4. Launch một `m5d.large` (Amazon Linux 2023, có key pair hoặc bật **EC2 Instance Connect**).
5. SSH/Connect vào, tạo file trên **instance store**:
   ```bash
   lsblk                                   # thấy nvme1n1 = instance store
   sudo mkfs -t xfs /dev/nvme1n1
   sudo mkdir /mnt/ephemeral && sudo mount /dev/nvme1n1 /mnt/ephemeral
   echo "du lieu quan trong" | sudo tee /mnt/ephemeral/test.txt
   echo "du lieu quan trong" | sudo tee ~/test-ebs.txt
   ```
6. **Instance state → Stop instance** → đợi → **Start instance** → Connect lại:
   ```bash
   cat ~/test-ebs.txt        # ✅ còn (EBS bền vững)
   lsblk                      # instance store đã bị xóa sạch, phải format lại
   ```
   → **Đây là bài học không bao giờ quên**: Instance Store = **ephemeral**.

### Phần C — Hibernation

7. **Launch instances** → Advanced details → tick ☑ **Stop - Hibernate behavior**.
   → Console nêu điều kiện: **root volume phải là EBS, phải được mã hóa, đủ dung lượng chứa RAM**.
   → Đó chính là cơ chế "lưu RAM xuống EBS, khôi phục state khi start".

### 🧠 Ghi nhớ được gì
| | Instance Store | EBS |
|---|---|---|
| Bản chất | Physical disk gắn vào host | Network block storage |
| Stop/Terminate | **Mất data** | Còn data |
| Use case | Cache, buffer, temporary data | Data cần bền vững |
| Điểm mạnh | **IOPS rất cao** | Bền vững, snapshot được |

### 🎯 Bẫy thi
"Temporary data + high IOPS" → **Instance Store**.
"Lưu session/upload của user trên instance store + có ASG" → **kiến trúc sai**, scale-in sẽ mất data.

### Dọn dẹp
**Terminate** instance `m5d.large` ngay. Kiểm tra **EC2 → Volumes** không còn volume `available` nào sót lại (volume mồ côi vẫn tính tiền).

---

## 🧪 LAB 11 — Lightsail: cảm nhận "fixed pricing"

**Mục tiêu:** hiểu Lightsail khác EC2 chỗ nào
**Thời gian:** 10 phút · **Chi phí:** $0 nếu chỉ xem (nhiều plan có tháng đầu miễn phí)

### Các bước

1. Vào **Lightsail** (console riêng: `lightsail.aws.amazon.com`).
2. **Create instance** → chọn platform **Linux/Unix** → **Blueprint** → nhìn danh sách **Apps + OS**: **WordPress**, **LAMP**, **Node.js**, Drupal, Magento… → đúng "pre-configured" trong file 01.
3. Kéo xuống mục **instance plan**: giá hiện ra là **$X/tháng cố định**, đã bao gồm **RAM + vCPU + SSD + data transfer**.
4. **So sánh ngay:** mở tab EC2 → Instance Types → giá hiện theo **$/giờ**, và storage, data transfer, Elastic IP đều **tính riêng**.

### 🧠 Ghi nhớ được gì
```
Lightsail: beginner, simple app, PREDICTABLE monthly price, gộp sẵn compute+storage+network+DNS
EC2:       advanced, kiến trúc phức tạp, PAY-AS-YOU-GO, mọi thứ tính riêng
```

### 🎯 Bẫy thi
Đề có "fixed monthly price" + "WordPress" + "simple/beginner" → **Lightsail**, đừng chọn EC2.

### Dọn dẹp
Nếu đã tạo instance → Lightsail → **Manage → Delete** (và xóa cả static IP nếu có).

---

## 🗺️ BẢNG ÁNH XẠ LAB → NỘI DUNG FILE 01

| Mục trong [01-compute-services.md](../01-compute-services.md) | Lab |
|---|---|
| 1️⃣ EC2 instance types & naming | Lab 1 |
| 1️⃣ 6 pricing models | Lab 2 |
| 2️⃣ EC2 storage (EBS, Instance Store) | Lab 10 |
| 3️⃣ EC2 networking (ENA, EFA) | Lab 1 (cột ENA/EFA support), Lab 2 (Advanced details) |
| 4️⃣ Placement Groups | Lab 3 |
| 5️⃣ Auto Scaling (Template, ASG, 5 policies, health check, cooldown) | Lab 4 |
| 6️⃣ Lambda (limits, concurrency, layers, VPC, invocation types) | Lab 5 + Lab 6 |
| 7️⃣ Elastic Beanstalk (6 deployment options) | Lab 7 |
| 8️⃣ ECS (launch types, components) | Lab 8 |
| 9️⃣ EKS | *(không lab — EKS cluster tốn ~$0.10/giờ; xem so sánh ở Lab 8)* |
| 🔟 AWS Batch | Lab 9 |
| 1️⃣1️⃣ Lightsail | Lab 11 |
| Cost optimization mindset | Lab 0 |

---

## 🧹 CHECKLIST DỌN DẸP TỔNG (làm cuối mỗi buổi)

Đi đúng thứ tự này trong **đúng Region đã dùng**:

- [ ] **Elastic Beanstalk** → Applications đã xóa (kéo theo ALB + ASG)
- [ ] **EC2 → Auto Scaling Groups** → trống
- [ ] **EC2 → Instances** → không còn `running` / `stopped`
- [ ] **EC2 → Load Balancers** & **Target Groups** → trống ⚠️ *(tốn tiền nhất)*
- [ ] **EC2 → Volumes** → không còn volume trạng thái `available`
- [ ] **EC2 → Elastic IPs** → không còn IP nào không gắn instance ⚠️ *(IP rảnh vẫn bị tính phí)*
- [ ] **EC2 → Launch Templates / Placement Groups / Snapshots** → đã xóa
- [ ] **EC2 → Spot Requests** → không còn request `active`
- [ ] **ECS** → Services → Clusters → Task definitions đã xóa
- [ ] **AWS Batch** → Job definitions → Job queues → Compute environments đã xóa
- [ ] **Lambda** → xóa function; đặc biệt kiểm tra **Provisioned concurrency** đã gỡ ⚠️
- [ ] **S3** → bucket đã empty rồi delete
- [ ] **Lightsail** → instance + static IP đã xóa
- [ ] **NAT Gateway** (nếu lỡ tạo khi cấu hình Lambda VPC) → đã xóa ⚠️ *(~$32/tháng)*
- [ ] Cuối cùng: **Resource Groups & Tag Editor** → tìm tag `Purpose = saa-lab` → xác nhận trống
- [ ] Hôm sau: mở **Billing → Bills** kiểm tra không có khoản lạ

---

## 📅 LỘ TRÌNH GỢI Ý (3 buổi × ~2 giờ)

| Buổi | Labs | Trọng tâm |
|------|------|-----------|
| **1** | Lab 0 → 1 → 2 → 3 | EC2: instance types, pricing models, placement groups |
| **2** | Lab 4 → 10 | Auto Scaling (nặng nhất, làm khi tỉnh táo) + storage |
| **3** | Lab 5 → 6 → 8 → 9 → 7 → 11 | Serverless & containers |

**Sau mỗi buổi:** quay lại làm phần tương ứng trong [01-compute-services-scenarios.md](01-compute-services-scenarios.md) — làm tay xong rồi trả lời kịch bản thì kiến thức mới thật sự dính.

---

> ⚠️ **Lưu ý về giao diện:** AWS Console thay đổi layout khá thường xuyên. Nếu không thấy đúng tên nút như mô tả,
> tìm theo **từ khóa** (Purchase option, Tenancy, Deployment policy, Ephemeral storage, Capacity provider strategy…) —
> **vị trí có thể đổi, khái niệm thì không**, và đề thi hỏi khái niệm.

**Liên quan:** [01-compute-services.md](../01-compute-services.md) · [01-compute-services-scenarios.md](01-compute-services-scenarios.md) · [01-compute-services-exam-v2.md](01-compute-services-exam-v2.md) · [T-hands-on-labs.md](../T-hands-on-labs.md)
