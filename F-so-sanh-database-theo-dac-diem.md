# 🔬 SO SÁNH DATABASE THEO ĐẶC ĐIỂM - AWS SAA-C03

> Bảng so sánh **cắt ngang (cross-cutting)** 6 database chính theo từng đặc điểm.
> Bổ sung cho [03-database-services.md](03-database-services.md) (vốn mô tả từng service riêng lẻ).
>
> **Phạm vi**: RDS · Aurora · DynamoDB · ElastiCache · Redshift · DocumentDB

**Legend**: ✅ có / hỗ trợ tốt · ⚠️ có điều kiện / hạn chế · ❌ không có

---

## 1️⃣ REPLICA (Read Replica / Read Scaling)

| Service | Số replica | Kiểu replication | Replica đọc được? | Cross-Region | Ghi chú thi |
|---------|-----------|------------------|-------------------|--------------|-------------|
| **RDS** | **Up to 5** (MySQL/MariaDB có thể 15) | **Asynchronous** (log shipping) | ✅ | ✅ | Có replication lag; promote thành standalone DB được |
| **Aurora** | **Up to 15** | **Shared storage** (lag ~ms, không phải async log) | ✅ | ✅ (Global DB: +5 region) | Reader Endpoint tự load-balance; failover < 30s |
| **DynamoDB** | ❌ Không có "read replica" | — | — | ✅ **Global Tables** (active-active) | Muốn scale đọc → **DAX** (cache); cross-region → Global Tables |
| **ElastiCache** | Redis: **5/shard** · Memcached: ❌ | Redis async | ✅ (Redis) | ⚠️ Global Datastore (Redis) | Memcached KHÔNG replicate → mất data khi node chết |
| **Redshift** | ❌ Không có read replica | — | — | ⚠️ Snapshot copy / Data Sharing (RA3) | Scale đọc bằng **Concurrency Scaling**, không phải replica |
| **DocumentDB** | **Up to 15** | Shared storage (như Aurora) | ✅ | ⚠️ Global Clusters | Reader Endpoint load-balance; failover tự động |

**🎯 Exam Tip**: "Scale reads" cho SQL → Read Replica (RDS/Aurora). "Scale reads" cho DynamoDB → **DAX**. "Scale reads" cho Redshift → **Concurrency Scaling**.

---

## 2️⃣ MULTI-AZ (High Availability / Failover)

| Service | Cơ chế HA | Standby đọc được? | Thời gian failover | Ghi chú thi |
|---------|-----------|-------------------|--------------------|-------------|
| **RDS (Multi-AZ Instance)** | 1 standby sync ở AZ khác | ❌ (chỉ standby) | **60–120s** | Sync replication; DNS tự trỏ sang standby |
| **RDS (Multi-AZ DB Cluster)** ⭐ | 1 writer + **2 readable standby** / 3 AZ | ✅ | **~35s** | Mới, nhanh hơn, standby đọc được — *hay thi, notes cũ chưa có* |
| **Aurora** | Storage **6 copy / 3 AZ** sẵn có | ✅ (replica là standby) | **< 30s** | Single-instance vẫn bền data (3 AZ) nhưng cần replica để failover compute |
| **DynamoDB** | Tự động **3 AZ**, không cần bật | ✅ (luôn) | Trong suốt (managed) | KHÔNG có toggle "Multi-AZ" — mặc định HA |
| **ElastiCache** | Redis: Multi-AZ + auto-failover · Memcached: ❌ | ✅ (Redis) | Vài chục giây | Memcached không có failover |
| **Redshift** | Single-AZ (cổ điển) · **Multi-AZ với RA3** ⭐ | — | — | Cổ điển: khôi phục bằng snapshot. Mới: Multi-AZ trên RA3 |
| **DocumentDB** | Replica ở AZ khác (6 copy/3 AZ) | ✅ | Tự động | Kiến trúc giống Aurora |

**🎯 Exam Tip**: "Automatic failover, minimal downtime" → **Multi-AZ** (RDS/Aurora). "Cần standby **đọc được** + HA" → **RDS Multi-AZ DB Cluster** hoặc Aurora replica.

---

## 3️⃣ SNAPSHOT · BACKUP · RECOVERY

| Service | Automated backup | PITR | Manual snapshot | Điểm đặc biệt |
|---------|------------------|------|-----------------|----------------|
| **RDS** | 1–35 ngày (default 7), lưu S3 | ✅ tới từng giây | ✅ (giữ tới khi xóa, share/copy cross-region) | Single-AZ: backup gây **I/O suspension** ngắn |
| **Aurora** | Continuous → S3 (1–35 ngày) | ✅ | ✅ | **Backtrack** (rewind tại chỗ ≤72h, không tạo cluster mới, chỉ Aurora **MySQL**); **Fast Clone** (copy-on-write) |
| **DynamoDB** | Continuous (PITR 35 ngày) | ✅ tới từng giây | ✅ On-demand backup (giữ tới khi xóa) | Backup **không ảnh hưởng performance** |
| **ElastiCache** | Redis: snapshot → S3 · Memcached: ❌ | ❌ | ✅ (Redis RDB) | Memcached **không backup** (ephemeral) |
| **Redshift** | Auto mỗi **8h hoặc 5GB** (1–35 ngày) | ⚠️ restore từ snapshot | ✅ | Cross-region snapshot copy cho DR |
| **DocumentDB** | Continuous → S3 (1–35 ngày) | ✅ | ✅ | Giống Aurora nhưng **KHÔNG có Backtrack** |

**🎯 Exam Tip**: "Rewind DB nhanh, không tạo instance mới" = **Aurora Backtrack**. "Restore tới bất kỳ giây nào" = **PITR** (RDS/Aurora/DynamoDB/DocumentDB).

---

## 4️⃣ SCALING (Vertical ↕️ & Horizontal ↔️)

| Service | Vertical (scale up) | Horizontal reads | Horizontal **writes** | Storage |
|---------|---------------------|------------------|------------------------|---------|
| **RDS** | Đổi instance class (downtime, hoặc mượt qua Multi-AZ failover) | Read Replica | ❌ (single writer) | Storage auto-scaling (no downtime) |
| **Aurora** | Đổi instance class · Serverless v2 auto | Up to 15 replica | ❌ (single writer)¹ | Auto **10GB increments → 128TB** |
| **DynamoDB** | ❌ Không có instance | ✅ tự động (partition) | ✅ **có** (partition) | Không giới hạn (managed) |
| **ElastiCache** | Đổi node type | Redis: thêm replica | Redis **Cluster Mode** (sharding) | — |
| **Redshift** | Elastic Resize / Classic Resize | Concurrency Scaling | Thêm compute node (MPP) | RA3: compute ⟂ storage riêng |
| **DocumentDB** | Đổi instance class | Up to 15 replica | ❌ (single writer)² | Auto → **64TB** |

¹ Aurora Multi-Master đã bị AWS khai tử → hầu như không phải đáp án đúng.
² DocumentDB **Elastic Clusters** hỗ trợ sharding để scale writes (workload rất lớn).

**🎯 Exam Tip**: DynamoDB là DB duy nhất trong nhóm **scale được writes theo chiều ngang** một cách tự nhiên. SQL (RDS/Aurora) chỉ scale **đọc**.

---

## 5️⃣ SERVERLESS

| Service | Có serverless? | Tên / cơ chế | Ghi chú thi |
|---------|----------------|--------------|-------------|
| **RDS** | ❌ | (bản thân RDS không serverless) | Muốn serverless-SQL → dùng **Aurora Serverless** |
| **Aurora** | ✅ | **Serverless v1** (scale→0, HTTP **Data API**) · **v2** (instant, 0.5 ACU, đủ tính năng) | v1 pause được về 0 (có cold start); v2 min 0.5 ACU, mượt hơn |
| **DynamoDB** | ✅ (bản chất) | **On-Demand** = serverless thực sự | Không cần capacity planning |
| **ElastiCache** | ✅ | **ElastiCache Serverless** (Redis & Memcached) | Auto-scale, trả theo GB-hour + ECPU |
| **Redshift** | ✅ | **Redshift Serverless** (trả theo RPU-second) | Không quản lý cluster |
| **DocumentDB** | ❌ | (chưa có bản serverless pay-per-use) | Có Elastic Clusters nhưng không phải serverless |

**🎯 Exam Tip**: "Unpredictable / infrequent workload" + SQL → **Aurora Serverless**. + NoSQL → **DynamoDB On-Demand**. + Analytics → **Redshift Serverless**.

---

## 6️⃣ COST OPTIMIZATION

| Service | Đòn bẩy chi phí chính |
|---------|------------------------|
| **RDS** | Reserved Instances (1–3y, ~40–69%) · **Stop/Start ≤7 ngày** · right-size · gp3 storage · xóa snapshot cũ |
| **Aurora** | Reserved Instances · **Serverless v2** (trả theo ACU-second) · I/O-Optimized vs Standard · storage trả theo dùng thực |
| **DynamoDB** | Chọn đúng On-Demand vs Provisioned · **Reserved Capacity (đến 77%)** · Auto Scaling · **TTL** (xóa item cũ miễn phí) · **Standard-IA table class** |
| **ElastiCache** | Reserved Nodes (~55%) · right-size · **Data Tiering** (Redis, dữ liệu ít dùng xuống SSD) |
| **Redshift** | Reserved Nodes (đến 75%) · **Pause/Resume** · RA3 (tách compute/storage) · **Spectrum** (query S3 khỏi load) · Concurrency Scaling free credit |
| **DocumentDB** | Reserved Instances · **Stop cluster** · right-size · I/O-Optimized |

**🎯 Exam Tip**: "Chạy không liên tục, muốn tiết kiệm" → **Stop/Start** (RDS/DocumentDB) hoặc **Serverless/Pause** (Aurora/Redshift). "DB lớn giữ lâu, load ổn định" → **Reserved**.

---

## 7️⃣ SECURITY

> **Chung cho tất cả**: Encryption at-rest (**KMS**) · in-transit (**TLS/SSL**) · **IAM** policies · **CloudTrail** audit · **VPC Security Groups**.

| Service | Nét riêng về security |
|---------|------------------------|
| **RDS** | **IAM DB Authentication** (MySQL/PostgreSQL/Aurora) · **Secrets Manager** rotation · **Không SSH** · ⚠️ **không mã hóa DB có sẵn** → phải restore từ encrypted snapshot |
| **Aurora** | Như RDS + IAM auth · chạy trong VPC |
| **DynamoDB** | Mã hóa at-rest **mặc định** · **IAM fine-grained** (tới item/attribute qua condition) · **VPC Gateway Endpoint** · *không nằm trong VPC* (regional) |
| **ElastiCache** | Redis: **AUTH token** + **RBAC/ACL** + TLS · Memcached: chỉ SASL (yếu hơn) · chạy trong VPC |
| **Redshift** | Column-level & **row-level security** · **Enhanced VPC Routing** · KMS/HSM · audit log → S3 |
| **DocumentDB** | **RBAC kiểu MongoDB** (user/role) · TLS · KMS · chạy trong VPC |

**🎯 Exam Tip**: "Xác thực bằng IAM thay vì password" → **RDS/Aurora IAM DB Auth**. "Phân quyền tới từng dòng dữ liệu" → **Redshift row-level security**. "Mã hóa DB RDS đang chạy chưa mã hóa" → snapshot → copy (encrypted) → restore.

---

## ⚠️ ĐIỂM MÙ HAY THI (notes cũ chưa cover)

1. **RDS Multi-AZ DB Cluster** (1 writer + **2 readable standby** / 3 AZ, failover ~35s) — khác hẳn Multi-AZ Instance cổ điển. Đề thường bẫy "cần HA **và** standby đọc được".
2. **RDS Proxy** — connection pooling, giảm số kết nối, tăng tốc failover; **đáp án chuẩn cho Lambda + RDS** (serverless mở nhiều connection).
3. **RDS Blue/Green Deployments** — cập nhật/nâng version an toàn, switchover < 1 phút.
4. **Aurora Backtrack** — ≤72h, chỉ Aurora **MySQL**, KHÔNG phải backup, không tạo cluster mới (khác PITR restore).
5. **Aurora Global Database** — **RPO ~1s, RTO < 1 phút**, có **write forwarding** từ secondary region.
6. **DynamoDB adaptive capacity & hot partition** — throttling do "hot key", không phải do thiếu tổng capacity.
7. **DynamoDB TTL** — tự xóa item hết hạn **miễn phí** (cost + housekeeping).
8. **DynamoDB Global Tables** yêu cầu bật **Streams** + cùng tên table mọi region.
9. **RPO vs RTO** — nên nhớ con số: Aurora Global (RPO~1s/RTO<1m), Multi-AZ (RPO~0/RTO 1–2m).
10. **RDS storage types** — gp3 (baseline), io1/io2 (IOPS cao, low-latency); "consistent high IOPS" → io1/io2.
11. **Cross-Region Read Replica** — dùng cho DR + đọc gần user; promote khi region gốc chết.
12. **ElastiCache Data Tiering** (node R6gd) — cache lớn, giảm chi phí bằng SSD.

---

## 🧭 CHỈNH LẠI vài chỗ trong notes cũ (03-database-services.md)

- Dòng ~42: *"Up to 15 read replicas (Aurora)"* nằm trong mục **RDS** dễ gây nhầm → **RDS = 5** (MySQL/MariaDB có thể tới 15), **Aurora = 15**.
- Mục **Aurora Multi-Master** (dòng ~164): AWS đã **ngừng** tính năng này ở các version mới → hiếm khi là đáp án đúng; đừng chọn cho "continuous write availability" trừ khi đề nêu rõ.
- **Aurora Serverless v2**: bổ sung min **0.5 ACU** (không pause hẳn về 0 như v1); v1 mới là bản pause-to-zero.

---

**Xem thêm**: [03-database-services.md](03-database-services.md) · [E-kien-truc-database.md](E-kien-truc-database.md) · [Q-service-comparisons.md](Q-service-comparisons.md)
