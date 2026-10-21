# 👤 Hồ sơ người học
_Cập nhật: 2026-10-17 08:23 bởi 2026-10-17_082317_analyze_

## Tổng quan
- 1 bài · 20 câu trả lời · đúng 11 (55%) · readiness 53% (khoảng 26–80%, độ tin cậy low) · xác suất đỗ ≈ 12%.
- Mới gặp 20/748 câu, toàn bộ thuộc topic Networking (D1 7 lượt, D3 11, D4 2, **D2 chưa có lượt nào**).
- Tốc độ xấp xỉ chuẩn (TB 59s/chuẩn 59s), nhưng câu hard về PrivateLink/TGW chậm (109–182s).
- **Tự tin quá mức:** 20/20 lượt đánh “chắc chắn”, chỉ đúng 55%. Chưa dùng gợi ý, chưa gạch đáp án, chưa ghi lý do chọn.

## Điểm mạnh
- ALB 3/3 (nhanh: 31s/chuẩn 55s) — chưa đủ dữ liệu để coi là ổn định.

## Điểm yếu theo dõi
| Mảng | Từ ngày | Xu hướng | Trạng thái |
|------|---------|----------|------------|
| VPC connectivity: Gateway vs Interface endpoint (VPC Endpoint 1/3) | 2026-10-17 | — (mới) | ⏳ s1 plan-2026-10-17-0823 |
| PrivateLink vs Peering vs Transit Gateway (PrivateLink 1/3, TGW 2/4) | 2026-10-17 | — (mới) | ⏳ s1 |
| VPC cơ bản / subnets (VPC 0/4, tag subnets 1/4) | 2026-10-17 | — (mới) | ⏳ s2 |
| Dịch vụ khoảng trống: Route 53 Resolver, Flow Logs, Egress-only IGW, RAM | 2026-10-17 | — (mới) | ⏳ s2 |
| D2 Resilience — chưa có dữ liệu | 2026-10-16 | — | ⏳ chẩn đoán s3 |

## Hiểu nhầm đã ghi nhận
- “Interface endpoint ⟶ Gateway endpoint”: S3/DynamoDB + miễn phí → Gateway endpoint (`04-v1-06`) · ⏳
- “VPC Peering ⟶ PrivateLink”: CIDR trùng / chỉ expose 1 service → PrivateLink (`04-v2-25`) · ⏳
- “Transit Gateway ⟶ PrivateLink”: SaaS cho hàng nghìn VPC khách → PrivateLink (`04-v2-23`) · ⏳
- “Full-mesh peering ⟶ TGW + RAM”: nhiều account/Region → TGW peering + chia sẻ qua RAM (`04-v2-28`, `17-v1-19`) · ⏳
- “Route 53 public hosted zone ⟶ Resolver endpoints”: hybrid DNS → Inbound/Outbound endpoint (`17-v1-04`) · ⏳
- “GuardDuty ⟶ VPC Flow Logs”: IP/port ACCEPT/REJECT → Flow Logs (`17-v1-03`) · ⏳
- “NAT Gateway ⟶ Egress-only IGW”: IPv6 chỉ đi ra → Egress-only IGW (`04-v2-19`) · ⏳
- “Global Accelerator ⟶ CloudFront”: nội dung tĩnh cần cache → CloudFront (`04-v1-08`) · ⏳

## Lịch sử kế hoạch
- 2026-10-16 · plan-2026-10-16-1536 · khởi động: chẩn đoán 30 câu + làm quen D1/D2 · (kế hoạch đầu tiên)
- 2026-10-17 · plan-2026-10-17-0823 · vá networking (endpoint/PrivateLink/TGW, hybrid DNS, Flow Logs, CloudFront vs GA) + chẩn đoán mang sang; pack ai-2026-10-17-0823 (15 câu) · kế hoạch trước: 0/3 phiên làm (người học tự làm bài Networking 20 câu thay thế)
