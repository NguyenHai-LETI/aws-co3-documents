---
pack: ai-2026-10-22-tier-a-3-4
title: "AI · Tầng A · Task 3.4 — Mạng hiệu năng cao và mở rộng"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 3.4"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 3.4"
---

# AI · Tầng A · Task 3.4 — Mạng hiệu năng cao và mở rộng

## Q ai-20261022-a34-01
- domain: performance
- task: 3.4
- topic: networking
- services: CloudFront, EC2
- tags: cloudfront-origin-shield, edge-caching
- difficulty: medium
- time: 150
- skills: 3.4.k1, 3.4.s3
- concept: CloudFront Origin Shield consolidates duplicate requests from all caching layers before the origin and belongs in the Region with the lowest latency to the origin; origin groups and longer TTLs do not consolidate first requests
- refs: 04-networking-services.md, 14-so-sanh-services.md
- hint: Nhiều điểm biên cùng xin một đối tượng mới từ origin — thêm lớp cache nào gom các yêu cầu trùng, và đặt nó ở Region nào?
- created: 2026-10-22
- enriched: 2026-10-22

A sports broadcaster delivers live-event video segments through Amazon CloudFront from a packaging origin that runs on EC2 instances in eu-west-1. Viewers are spread across Europe, North America, and Asia. During big matches, many CloudFront locations request the same new segment from the origin at the same moment, and the origin's CPU saturates because every request triggers just-in-time packaging. The company wants to cut duplicate origin requests and protect the origin without changing how viewers fetch segments. Which combination of steps will meet these requirements? (Choose TWO)

- A. Enable Origin Shield on the packaging origin so that requests from the caching layers are consolidated before they reach it.
- B. Choose the Origin Shield Region that has the lowest latency to the origin, which is the origin's own Region, eu-west-1.
- C. Choose us-east-1 as the Origin Shield Region because most of the viewers who watch the live events are located in North America.
- D. Add a CloudFront origin group with a second packaging origin in eu-central-1 next to the eu-west-1 origin so that requests fail over when it is overloaded.
- E. Raise the CloudFront cache TTL of the segments so that edge locations keep each new segment for longer before they request it again.

**Answer:** A, B

**Explanation:** Origin Shield adds a caching layer that consolidates requests from edge and regional caches into as few as one request per object; enable it in the Region with the lowest latency to the origin, here the origin's own Region.
- Region near the viewers: Origin Shield belongs next to the origin, not the audience (đặt sai chỗ)
- Origin group with a second origin: fails over on errors but does not reduce duplicate requests (giải bài toán khác)
- Longer TTL: each location still requests every new segment once, so the first requests still pile up at the origin (giải bài toán khác)
Docs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/origin-shield.html
> 🇻🇳 Origin Shield gom request trùng trước origin; bật ở Region có độ trễ thấp nhất tới origin, không phải gần người xem.

---

## Q ai-20261022-a34-02
- domain: performance
- task: 3.4
- topic: networking
- services: NLB, ALB, ECS, Global Accelerator
- tags: elb-features, static-ip
- difficulty: hard
- time: 135
- skills: 3.4.s4, 3.4.k3
- concept: Static IP addresses plus layer 7 routing within Elastic Load Balancing means an NLB with Elastic IPs that registers an ALB as its target; an ALB cannot take Elastic IPs and an NLB alone has no path or host routing
- refs: 04-networking-services.md, 14-so-sanh-services.md
- hint: Đối tác chỉ cho phép vài địa chỉ IP cố định nhưng vẫn cần định tuyến theo đường dẫn và tên miền — loại ELB nào có IP tĩnh, loại nào hiểu L7?
- created: 2026-10-22
- enriched: 2026-10-22

A B2B platform exposes HTTPS microservices on Amazon ECS. Requests must be routed to different services by URL path and host name, and some partners need WebSocket connections. The partners' firewalls allow outbound traffic only to a small fixed set of IP addresses, so the platform needs static IP addresses for its endpoint. The platform team wants to keep path and host routing at layer 7, avoid managing proxy servers, and use only Elastic Load Balancing features. Which solution will meet these requirements?

- A. Associate an Elastic IP address with each Availability Zone of an Application Load Balancer and publish those addresses to the partners.
- B. Create a Network Load Balancer with an Elastic IP address in each zone and register an Application Load Balancer as its target.
- C. Create an AWS Global Accelerator standard accelerator with the Application Load Balancer as its endpoint and publish its static IP addresses to the partners.
- D. Create a Network Load Balancer with an Elastic IP address in each zone and register the ECS tasks directly as IP targets of its TLS listener.

**Answer:** B

**Explanation:** A Network Load Balancer gives each zone a static IP address, optionally an Elastic IP, and can register an Application Load Balancer as a target, so partners see fixed addresses while the ALB keeps path, host, and WebSocket routing.
- ALB with Elastic IPs: an Application Load Balancer cannot be assigned Elastic IPs (cấu hình không tồn tại)
- Global Accelerator: provides static IPs, but it is not an Elastic Load Balancing feature, which the team requires (vi phạm ràng buộc)
- NLB with tasks as IP targets: static IPs, but no path or host routing at layer 7 (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html
> 🇻🇳 IP tĩnh + định tuyến L7: NLB (Elastic IP mỗi AZ) trước ALB làm target; ALB không gán được Elastic IP, NLB đơn lẻ không có path/host routing.

---

## Q ai-20261022-a34-03
- domain: performance
- task: 3.4
- topic: networking
- services: Site-to-Site VPN, Transit Gateway, Direct Connect
- tags: transit-gateway, ecmp, vpn-throughput
- difficulty: hard
- time: 130
- skills: 3.4.k4, 3.4.s2
- concept: Standard VPN tunnels are limited in throughput; aggregating several VPN connections needs a transit gateway with BGP and ECMP, which a virtual private gateway, static routing or acceleration cannot provide
- refs: 04-networking-services.md, 14-so-sanh-services.md
- hint: Mỗi tunnel VPN có trần băng thông — chỉ một loại gateway cộng gộp được nhiều tunnel, và nó đòi hỏi kiểu định tuyến nào?
- created: 2026-10-22
- enriched: 2026-10-22

A company connects its data center to AWS with a Site-to-Site VPN that terminates on a virtual private gateway. A new nightly replication job needs about 4 Gbps of throughput to workloads in VPCs that belong to three accounts, but one VPN connection carries far less than that. A Direct Connect connection will not be ready for several months, and the company's router supports BGP. The company wants the interim connection to carry the load and reach all three VPCs. Which solution will meet these requirements?

- A. Attach several VPN connections that use BGP to the virtual private gateway and let BGP balance the traffic across their tunnels.
- B. Attach two VPN connections that use static routing to a transit gateway, and enable equal-cost multipath routing on the gateway.
- C. Enable acceleration on the existing VPN connection so that the traffic uses the AWS global network and the tunnel throughput increases.
- D. Attach several VPN connections to a transit gateway that use BGP, and enable equal-cost multipath routing on the gateway.

**Answer:** D

**Explanation:** A transit gateway aggregates the bandwidth of several VPN tunnels with ECMP when the connections use dynamic routing, and it connects many VPCs; a standard tunnel carries up to 1.25 Gbps, so two connections with four tunnels cover 4 Gbps. (Transit gateways can also use large-bandwidth tunnels of up to 5 Gbps.)
- Virtual private gateway: no tunnel aggregation, and one VPC only (đặt sai chỗ)
- Static routes with ECMP: ECMP is not supported with static routing (cấu hình không tồn tại)
- Acceleration: improves the network path but leaves each tunnel's throughput limit unchanged (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/vpn/latest/s2svpn/vpn-limits.html
> 🇻🇳 Cần ~4 Gbps qua VPN tới nhiều VPC → nhiều VPN vào Transit Gateway + BGP + ECMP; VGW, route tĩnh hay acceleration không cộng gộp được băng thông.

---

## Q ai-20261022-a34-04
- domain: performance
- task: 3.4
- topic: networking
- services: Local Zones, Outposts, Wavelength, Direct Connect, EC2
- tags: local-zones, resource-placement
- difficulty: medium
- time: 110
- skills: 3.4.s3, 3.4.s1, 3.4.k2
- concept: To place compute close to users in a metro area without on-premises hardware, extend the VPC to a Local Zone; Outposts needs on-site racks, Wavelength targets 5G mobile users, and Direct Connect cannot remove distance latency
- refs: 13-other-services.md, 04-networking-services.md
- hint: Cần độ trễ một chữ số mili giây tới người dùng trong một khu vực đô thị, không có chỗ đặt rack — hạ tầng AWS nào mở rộng Region ra gần họ?
- created: 2026-10-22
- enriched: 2026-10-22

A video-production studio in Denver edits high-resolution footage in virtual workstations that run on GPU instances. The nearest AWS Region is more than 20 milliseconds away, and editors report laggy scrubbing. The studio needs single-digit millisecond latency to the workstations. It has no space for on-premises racks, wants to keep using EC2 and the AWS APIs it already uses, and keeps its projects database in the parent Region. Which solution will meet these requirements?

- A. Order AWS Outposts racks for the studio's building and run the GPU workstations on them.
- B. Launch the GPU workstations in a Wavelength Zone so that the editors connect through a carrier's 5G network.
- C. Extend the VPC to an AWS Local Zone in the Denver area and run the GPU workstations and their EBS volumes there.
- D. Launch the GPU workstations in the nearest Region and connect the Denver studio to it over an AWS Direct Connect link for a private, consistent path.

**Answer:** C

**Explanation:** A Local Zone places compute and storage close to a large population center, so a VPC subnet there gives editors low latency with the same EC2 and APIs while the database stays in the parent Region.
- Outposts racks: need physical space in the studio, which it lacks (vi phạm ràng buộc)
- Wavelength Zone: puts compute in carrier 5G networks for mobile users (dùng sai tính năng)
- Direct Connect to the nearest Region: a consistent private path, but the distance still keeps latency above 20 milliseconds (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/local-zones/latest/ug/what-is-aws-local-zones.html
> 🇻🇳 Cần độ trễ thấp cho người dùng ở một thành phố, không có chỗ đặt rack → Local Zone (mở rộng VPC); Outposts cần rack tại chỗ, Wavelength dành cho 5G.
