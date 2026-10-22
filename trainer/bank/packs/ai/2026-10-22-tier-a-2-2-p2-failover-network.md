---
pack: ai-2026-10-22-tier-a-2-2-p2
title: "AI · Tầng A · Task 2.2 (p2) — Failover & mạng chịu lỗi"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 2.2"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 2.2 — Route 53, Global Accelerator, ELB, Auto Scaling, NAT, quota"
---

# AI · Tầng A · Task 2.2 (p2) — Failover & mạng chịu lỗi

## Q ai-20261022-a22-13
- domain: resilient
- task: 2.2
- topic: networking
- services: Route 53, ALB, Global Accelerator, CloudFront
- tags: route53-routing, route53-health-checks, alias-records, multi-region
- difficulty: medium
- skills: 2.2.k1, 2.2.k6
- concept: Route 53 failover alias records with Evaluate Target Health are the cheapest automatic active-passive Regional failover
- refs: 04-networking-services.md
- hint: Cần chuyển Region tự động, không phụ thuộc Region chính, và rẻ nhất — loại giải pháp có phí cố định hoặc không xử lý được POST.
- family: regional-failover-qualifier
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A gaming company serves a REST API at api.example.com from Application Load Balancers in two Regions: us-east-1 is primary and eu-west-1 is a warm standby. Most requests are HTTPS POST calls. The company wants traffic to move to the standby Region automatically when the primary Region's load balancer becomes unhealthy, and the move must not depend on any resource in the primary Region. Which solution meets these requirements MOST cost-effectively?

- A. Create Route 53 primary and secondary failover alias records that point to the two load balancers, with Evaluate Target Health turned on for both records
- B. Create an AWS Global Accelerator standard accelerator with one endpoint group per Region that contains the matching load balancer, and let its health checks shift connections
- C. Create an Amazon CloudFront distribution with an origin group that uses the primary load balancer as the primary origin and the standby load balancer as the secondary origin
- D. Create Route 53 weighted records, and run an AWS Lambda function in us-east-1 that sets the primary Region's weight to zero when a CloudWatch alarm fires

**Answer:** A

**Explanation:** Failover alias records with Evaluate Target Health follow the load balancers' own health, send answers to the standby when the primary is unhealthy, and run on Route 53's data plane without relying on the primary Region; no separate health check fee applies.
- Global Accelerator: also meets the goals but adds a fixed hourly fee plus a data transfer premium (tốn chi phí hơn).
- CloudFront origin group: fails over only GET, HEAD, and OPTIONS requests, not the POST calls (vi phạm ràng buộc).
- Lambda in us-east-1 changing weights: depends on the primary Region and on control-plane calls (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover-types.html
> 🇻🇳 Active-passive rẻ nhất, không phụ thuộc Region chính → Route 53 failover alias + Evaluate Target Health.

---

## Q ai-20261022-a22-14
- domain: resilient
- task: 2.2
- topic: networking
- services: Route 53, ALB, Global Accelerator, CloudFront
- tags: route53-routing, multi-region, high-availability
- difficulty: hard
- skills: 2.2.k6, 2.2.s2
- concept: Global Accelerator moves traffic between Regions without DNS answers, so resolver caching beyond the TTL cannot delay failover
- refs: 04-networking-services.md, 14-so-sanh-services.md
- hint: Điểm khác nằm ở câu hỏi cuối: nhiều resolver giữ cache DNS lâu hơn TTL — cơ chế nào không dựa vào việc client phân giải lại tên?
- family: regional-failover-qualifier
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A gaming company serves a REST API at api.example.com from Application Load Balancers in two Regions: us-east-1 is primary and eu-west-1 is a warm standby. Most requests are HTTPS POST calls. The company wants traffic to move to the standby Region automatically when the primary Region's load balancer becomes unhealthy, and the move must not depend on any resource in the primary Region. Which solution completes the move fastest for clients whose resolvers cache DNS answers beyond the record TTL?

- A. Create Route 53 primary and secondary failover alias records that point to the two load balancers, with Evaluate Target Health turned on for both records
- B. Create an AWS Global Accelerator standard accelerator with one endpoint group per Region that contains the matching load balancer, and let its health checks shift connections
- C. Create an Amazon CloudFront distribution with an origin group that uses the primary load balancer as the primary origin and the standby load balancer as the secondary origin
- D. Create Route 53 weighted records, and run an AWS Lambda function in us-east-1 that sets the primary Region's weight to zero when a CloudWatch alarm fires

**Answer:** B

**Explanation:** Global Accelerator gives clients two static anycast IP addresses, so there is no DNS answer to cache; its health checks steer connections to the standby Region's load balancer inside the AWS network, independent of DNS and of the primary Region.
- Route 53 failover alias records: correct logic, but resolvers that ignore the TTL keep sending clients to the failed Region (dùng sai tính năng).
- CloudFront origin group: does not fail over POST requests (vi phạm ràng buộc).
- Lambda in us-east-1 changing weights: still DNS-based and dependent on the primary Region (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/global-accelerator/latest/dg/what-is-global-accelerator.html
> 🇻🇳 Cần chuyển Region nhanh dù client cache DNS quá TTL → Global Accelerator (IP anycast tĩnh + health check).

---

## Q ai-20261022-a22-15
- domain: resilient
- task: 2.2
- topic: networking
- services: Route 53, ALB, CloudWatch, EC2
- tags: route53-health-checks, route53-routing, high-availability
- difficulty: hard
- skills: 2.2.k1, 2.2.k6
- concept: Route 53 health checkers cannot reach private endpoints, so private resources need a health check that monitors a CloudWatch alarm
- refs: 04-networking-services.md, 06-management-governance.md
- hint: Bộ kiểm tra của Route 53 nằm ngoài VPC và không chạm được IP private — tín hiệu sức khoẻ phải đến từ bên trong.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 160

A company runs an internal claims application on Amazon EC2 instances behind an internal Application Load Balancer in us-east-1. The instances have only private IP addresses, and security policy forbids adding public ones. A standby copy runs in us-west-2. The company created Route 53 failover records in a private hosted zone, but the endpoint health checks for the primary always report unhealthy even though the application works. Which combination of steps will make failover work with the LEAST operational effort? (Choose TWO)

- A. Create a CloudWatch alarm that goes into the ALARM state when the HealthyHostCount metric of the primary target group drops below one
- B. Assign public IP addresses to the instances and allow the Route 53 health checker address ranges in the security groups of the primary instances
- C. Replace the endpoint health check on the failover record with a calculated health check that combines the existing endpoint health checks for the instances
- D. Create a Route 53 health check that monitors the CloudWatch alarm and associate it with the primary failover record
- E. Point an HTTPS endpoint health check at the DNS name of the internal load balancer so that the health checkers connect to it

**Answer:** A, D

**Explanation:** Route 53 health checkers sit outside the VPC and cannot reach private addresses, so the health signal must come from inside: a CloudWatch alarm on the target group's healthy host count, plus a health check that monitors that alarm and is attached to the primary failover record.
- Public IPs plus checker ranges: exposes instances that security policy forbids exposing (vi phạm ràng buộc).
- Calculated health check: only combines other health checks, which would still fail to reach the instances (dùng sai tính năng).
- Endpoint check against the internal load balancer name: resolves to private IPs the checkers cannot reach (đặt sai chỗ).
Docs: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover-private-hosted-zones.html
> 🇻🇳 Tài nguyên private → health check Route 53 dựa trên CloudWatch alarm (không dùng endpoint check).

---

## Q ai-20261022-a22-16
- domain: resilient
- task: 2.2
- topic: networking
- services: Route 53, ALB
- tags: route53-routing, route53-health-checks, multi-region
- difficulty: easy
- skills: 2.2.k1, 2.2.k6
- concept: Latency alias records with Evaluate Target Health route each user to the fastest healthy Region
- refs: 04-networking-services.md
- hint: Cần theo người dùng chứ không theo tỉ lệ hay vị trí địa lý cố định, và tự bỏ Region lỗi — chọn chính sách định tuyến phù hợp.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 100

A photo-sharing startup runs identical application stacks behind Application Load Balancers in us-east-1 and ap-southeast-1. Users are spread across the Americas and Asia. The startup wants each user's requests to go to the Region that responds fastest for that user, and if one Region becomes unhealthy, its users must be served automatically by the other Region. The operations team is small. Which Route 53 configuration meets these requirements?

- A. Create geolocation records that map the Americas to us-east-1 and every other location to ap-southeast-1, with health checks on both load balancers
- B. Create failover alias records with us-east-1 as the primary Region and ap-southeast-1 as the secondary Region, with Evaluate Target Health turned on
- C. Create latency alias records for both load balancers with Evaluate Target Health turned on so that unhealthy Regions are skipped
- D. Create weighted alias records with equal weights for both load balancers and attach health checks so that unhealthy Regions are skipped

**Answer:** C

**Explanation:** Latency alias records send each user to the Region with the lowest measured latency, and with Evaluate Target Health on, Route 53 drops an unhealthy Region's record and answers with the healthy one, with no scripts to maintain.
- Geolocation records: route by the user's location, not by measured latency (dùng sai tính năng).
- Failover records: keep every user on us-east-1 until it fails, so Asian users see higher latency (vi phạm ràng buộc).
- Equal-weight records: split traffic evenly wherever the user is (giải bài toán khác).
Docs: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy-latency.html
> 🇻🇳 Mỗi user vào Region nhanh nhất + tự loại Region lỗi → latency routing + Evaluate Target Health.

---

## Q ai-20261022-a22-17
- domain: resilient
- task: 2.2
- topic: networking
- services: CloudFront, S3, Route 53
- tags: s3-replication, s3-versioning, multi-region, high-availability
- difficulty: medium
- skills: 2.2.k6, 2.2.k11
- concept: A CloudFront origin group with a replicated second bucket fails over per request with unchanged URLs and no DNS logic
- refs: 02-storage-services.md, 04-networking-services.md
- hint: Cần failover tự động mà URL không đổi và không viết logic DNS — thành phần nào của CloudFront chuyển sang nguồn thứ hai theo từng request?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 115

An e-learning company serves course videos and PDFs from an Amazon S3 bucket in eu-west-1 through Amazon CloudFront. After a Regional S3 disruption, learners saw errors for hours. The company wants downloads to keep working automatically if the bucket in eu-west-1 is unavailable, without changing the URLs that learners use or adding DNS failover logic. Objects are written only by a publishing pipeline in eu-west-1. Which solution will meet these requirements with the LEAST operational overhead?

- A. Increase the CloudFront default TTL to seven days so that cached objects remain available during a bucket outage
- B. Enable S3 Versioning and Transfer Acceleration on the bucket so that requests are served through edge locations when its Region fails
- C. Replicate the bucket to a second bucket in eu-central-1 and create a Route 53 failover record that points the course domain name at the second bucket's website endpoint
- D. Replicate the bucket to a second bucket in eu-central-1 with Cross-Region Replication and add both buckets to an origin group on the CloudFront distribution

**Answer:** D

**Explanation:** A CloudFront origin group switches per request to the secondary bucket when the primary returns an error, and Cross-Region Replication keeps the second bucket current, so learners keep the same URLs with no DNS changes.
- Longer CloudFront TTL: helps only objects already cached; everything else still fails (giải bài toán khác).
- Versioning with Transfer Acceleration: Transfer Acceleration speeds transfers and provides neither a second copy nor failover (dùng sai tính năng).
- Route 53 failover to the second bucket: adds the DNS failover logic the company wants to avoid (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/high_availability_origin_failover.html
> 🇻🇳 S3 một Region + CloudFront: bucket thứ hai + CRR + origin group → failover theo từng request, URL không đổi.

---

## Q ai-20261022-a22-18
- domain: resilient
- task: 2.2
- topic: compute
- services: EC2 Auto Scaling, ALB, CloudWatch
- tags: elb-features, scaling-policies, high-availability
- difficulty: medium
- skills: 2.2.k8, 2.2.s1
- concept: An Auto Scaling group ignores load balancer health by default; turning on ELB health checks lets it replace instances the ALB reports unhealthy
- refs: 01-compute-services.md, C-kien-truc-web-app.md
- hint: Status check của EC2 vẫn đạt nên nhóm không thấy lỗi — cần để Auto Scaling dùng thêm một nguồn báo sức khoẻ khác.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 115

An online retailer runs a web application on an Auto Scaling group of EC2 instances behind an Application Load Balancer. Last week an application process hung on several instances and returned HTTP 500 errors for every request. The ALB stopped sending traffic to those instances, but they stayed in service and capacity dropped until the team replaced them manually. The EC2 status checks for the instances were passing. The company wants unhealthy instances replaced automatically without code changes. What should a solutions architect do?

- A. Create a target tracking scaling policy for the Auto Scaling group based on the request count per target of the group
- B. Increase the interval and the unhealthy threshold of the load balancer health checks for the target group
- C. Turn on Elastic Load Balancing health checks for the Auto Scaling group and set a grace period that covers instance startup
- D. Create a CloudWatch alarm on the instance status check metric with an action that reboots the affected instances automatically

**Answer:** C

**Explanation:** By default an Auto Scaling group replaces an instance only when EC2 status checks fail, so instances the load balancer marks unhealthy stay in service; ELB health checks let the group replace them, and the grace period protects new ones.
- Target tracking on request count: adds capacity but never replaces the hung instances (giải bài toán khác).
- Longer interval and threshold: changes when the ALB stops routing, which already happens, not group replacement (dùng sai tính năng).
- Reboot alarm on the status check: the checks pass, so the alarm never fires (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/autoscaling/ec2/userguide/health-checks-overview.html
> 🇻🇳 ASG mặc định chỉ xét EC2 status check → bật ELB health check để thay instance mà ALB báo unhealthy.

---

## Q ai-20261022-a22-19
- domain: resilient
- task: 2.2
- topic: networking
- services: ALB, EC2 Auto Scaling, Route 53
- tags: elb-features, subnets, high-availability
- difficulty: medium
- skills: 2.2.k8, 2.2.s2
- concept: A load balancer routes only to targets in Availability Zones that are enabled for it, so a new zone needs a subnet added to the ALB
- refs: 04-networking-services.md, C-kien-truc-web-app.md
- hint: Instance ở AZ mới đã đăng ký nhưng ở trạng thái unused — tầng nào quyết định AZ nào được nhận traffic?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A company runs a web application on an Auto Scaling group that spans subnets in us-east-1a, us-east-1b, and us-east-1c and registers instances with an Application Load Balancer target group. To improve availability, the company recently added the us-east-1c subnet to the group. The new instances in us-east-1c show as unused in the target group and receive no traffic, while the instances in the other two zones run at high CPU. The load balancer was created with subnets in only us-east-1a and us-east-1b. What should a solutions architect do to use the new capacity?

- A. Create a second Application Load Balancer with a subnet in us-east-1c and use Route 53 weighted records to split traffic between the two load balancers
- B. Enable cross-zone load balancing on the load balancer so that traffic is distributed to every registered instance in each Availability Zone
- C. Increase the health check grace period of the Auto Scaling group so that the new instances are marked healthy
- D. Add a subnet in us-east-1c to the load balancer so that the Availability Zone is enabled for it

**Answer:** D

**Explanation:** A load balancer sends traffic only to targets in Availability Zones that are enabled for it, which requires a subnet in that zone; instances registered from other zones show as unused until then.
- Second ALB with weighted records: adds cost and DNS management for a one-setting problem (tốn vận hành hơn).
- Cross-zone load balancing: already on for an ALB and it does not enable a zone (dùng sai tính năng).
- Longer grace period: concerns when Auto Scaling starts health checks, not where the load balancer routes (giải bài toán khác).
Docs: https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html
> 🇻🇳 ALB chỉ gửi traffic tới AZ đã được bật (có subnet) → thêm subnet của AZ mới vào ALB.

---

## Q ai-20261022-a22-20
- domain: resilient
- task: 2.2
- topic: networking
- services: NAT Gateway, VPC, Internet Gateway
- tags: subnets, high-availability, egress-only-igw
- difficulty: medium
- skills: 2.2.k3, 2.2.s4
- concept: A NAT gateway is resilient only inside its Availability Zone, so each zone needs its own gateway and a route table pointing to it
- refs: 04-networking-services.md
- hint: Một NAT gateway chỉ chịu lỗi trong AZ của nó — cần cả tài nguyên mỗi AZ lẫn bảng định tuyến trỏ đúng NAT cùng AZ.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A company runs application servers in private subnets in three Availability Zones. All three private subnets share one route table whose default route points to a single NAT gateway in a public subnet in us-east-1a. The servers call external payment APIs. During an outage of us-east-1a, servers in all three zones lost outbound internet access. The company wants to remove this single point of failure while avoiding cross-zone dependencies. Which combination of steps will meet these requirements? (Choose TWO)

- A. Add a second NAT gateway to the public subnet in the same Availability Zone and configure equal-cost multipath routing in the route table between the two gateways
- B. Create a NAT gateway in a public subnet in each Availability Zone that contains private subnets
- C. Replace the NAT gateway with a NAT instance in an Auto Scaling group of size one in us-east-1a
- D. Create a route table for each private subnet that sends 0.0.0.0/0 to the NAT gateway in the same Availability Zone
- E. Create an egress-only internet gateway and route 0.0.0.0/0 from the private subnets to it

**Answer:** B, D

**Explanation:** A NAT gateway is resilient only within its own Availability Zone, so each zone needs its own gateway, and each private subnet's route table must send the default route to the same-zone gateway.
- Second gateway in one zone with multipath routing: a route has a single target and both gateways fail together (cấu hình không tồn tại).
- NAT instance in a one-instance group in us-east-1a: still one zone, plus patching work (tốn vận hành hơn).
- Egress-only internet gateway: outbound access for IPv6 only, not IPv4 NAT (dùng sai tính năng).
Docs: https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-scenarios.html
> 🇻🇳 NAT gateway chỉ chịu lỗi trong 1 AZ → mỗi AZ một NAT gateway + route table từng AZ trỏ về NAT cùng AZ.

---

## Q ai-20261022-a22-21
- domain: resilient
- task: 2.2
- topic: compute
- services: EC2, EC2 Auto Scaling, CloudWatch
- tags: capacity-reservation, reserved-instances, dr-warm-standby, multi-region
- difficulty: hard
- skills: 2.2.k10, 2.2.s6
- concept: A standby Region needs raised Regional service quotas and On-Demand Capacity Reservations before a disaster, not just a larger Auto Scaling maximum
- refs: 01-compute-services.md, A-nen-tang-kien-truc.md
- hint: Hai lỗi khác nhau: một là giới hạn vCPU của tài khoản theo Region, một là AWS hết công suất — mỗi lỗi cần biện pháp riêng.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 155

A company keeps a warm standby in us-west-2 for its production workload in us-east-1. The standby runs two m6i.large instances, while production runs 120 instances of that type. During a DR test, the Auto Scaling group in us-west-2, whose maximum size is already 150, tried to scale out and many launches failed: some with VcpuLimitExceeded errors and others with InsufficientInstanceCapacity errors. The company wants the next failover to reach full production capacity without launch failures. Which combination of actions will meet these requirements? (Choose TWO)

- A. Purchase Regional Reserved Instances in us-west-2 for the production fleet size to secure the capacity
- B. Increase the maximum size of the Auto Scaling group in us-west-2 to 200 instances
- C. Request an increase of the On-Demand vCPU service quota in us-west-2 that covers the production fleet at peak size
- D. Create a CloudWatch alarm on the vCPU quota utilization in us-west-2 that notifies the operations team at a high threshold
- E. Create On-Demand Capacity Reservations in us-west-2 for the instances and Availability Zones that a disaster recovery will need

**Answer:** C, E

**Explanation:** VcpuLimitExceeded means the DR Region's On-Demand quota is too low (quotas apply per Region), and InsufficientInstanceCapacity means capacity was not available, which On-Demand Capacity Reservations secure in advance, so both fixes are needed before a disaster.
- Regional Reserved Instances: give a billing discount but reserve no capacity (dùng sai tính năng).
- Higher Auto Scaling maximum: the group's maximum was already above the fleet size, so it was not the limit (giải bài toán khác).
- Quota utilization alarm: a useful alert, but it neither raises the quota nor reserves capacity (đúng một phần).
Docs: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-capacity-reservations.html
> 🇻🇳 Region DR cần tăng quota (theo Region) VÀ đặt Capacity Reservation trước khi thảm hoạ xảy ra.

---

## Q ai-20261022-a22-22
- domain: resilient
- task: 2.2
- topic: networking
- services: Route 53, ALB, Lambda, CloudWatch
- tags: route53-routing, route53-health-checks, dr-warm-standby, multi-region
- difficulty: medium
- skills: 2.2.k1, 2.2.k6
- concept: Weighted alias records with health checks send a small share of real traffic to a warm standby and still shift traffic automatically on failure
- refs: 04-networking-services.md, P-architecture-diagrams.md
- hint: Muốn chứng minh bản dự phòng chạy được bằng traffic thật nhưng chỉ một phần nhỏ, và vẫn tự chuyển khi một Region lỗi.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A logistics company runs its tracking API in us-east-1 and keeps a scaled-down warm standby in eu-west-1. Management wants continuous proof that the standby can serve real production requests without risking the customer experience. About 5 percent of live traffic must be served from eu-west-1 under normal conditions, traffic must return to us-east-1 automatically if the standby becomes unhealthy, and all traffic must move to eu-west-1 automatically if us-east-1 fails. Which Route 53 configuration will meet these requirements?

- A. Create weighted alias records with weights of 95 and 5 for the two load balancers, with Evaluate Target Health turned on for both records
- B. Create failover alias records with us-east-1 as the primary Region and eu-west-1 as the secondary Region, with Evaluate Target Health turned on
- C. Create latency alias records for both load balancers so that users nearest to eu-west-1 are served by the standby Region
- D. Create weighted records with weights of 95 and 5, and run a Lambda function that changes the weights when a CloudWatch alarm detects an unhealthy Region

**Answer:** A

**Explanation:** Weights of 95 and 5 send about 5 percent of lookups to eu-west-1, so real traffic exercises the standby, and with Evaluate Target Health on, Route 53 stops answering with an unhealthy record, shifting traffic without scripts.
- Failover records: the secondary gets traffic only after the primary fails, so it is never exercised (vi phạm ràng buộc).
- Latency records: route by user proximity, so the share cannot be held near 5 percent (giải bài toán khác).
- Weights changed by Lambda on an alarm: custom automation and control-plane calls the design does not need (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy-weighted.html
> 🇻🇳 Thử warm standby bằng 5% traffic thật + tự chuyển khi lỗi → weighted record 95/5 + health check.

---

## Q ai-20261022-a22-23
- domain: resilient
- task: 2.2
- topic: networking
- services: Direct Connect, Site-to-Site VPN, VPC
- tags: dx-resiliency, high-availability
- difficulty: medium
- skills: 2.2.k3, 2.2.s4
- concept: A Site-to-Site VPN on the same virtual private gateway is the cheapest automatic backup for a single Direct Connect connection because BGP prefers Direct Connect
- refs: 04-networking-services.md
- hint: Sự cố ở cả địa điểm Direct Connect, chấp nhận băng thông thấp hơn khi lỗi, chi phí thấp nhất — đường dự phòng độc lập rẻ nhất là gì?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A manufacturing company connects its data center to a VPC with a single AWS Direct Connect connection and a private virtual interface to a virtual private gateway. A power failure at the Direct Connect location disconnected the plants from the ERP system for nine hours. The company wants automatic failover at the LEAST additional cost, accepts reduced bandwidth during a failure, and wants traffic to use Direct Connect under normal conditions. Which solution will meet these requirements?

- A. Add a second Direct Connect connection at the same location and combine both connections in a link aggregation group on the same virtual private gateway
- B. Create a Site-to-Site VPN connection to the same virtual private gateway and advertise the same prefixes so that Direct Connect is preferred
- C. Add a second Direct Connect connection at a different Direct Connect location with its own private virtual interface to the virtual private gateway
- D. Create a VPC peering connection between the VPC and the data center network to serve as the backup path

**Answer:** B

**Explanation:** A Site-to-Site VPN over the internet is the least expensive independent path: on the same virtual private gateway with the same prefixes, Direct Connect routes are preferred while they exist, with automatic fallback to the VPN.
- Aggregation group at the same location: adds bandwidth, but a location failure still isolates the plants (đặt sai chỗ).
- Second connection at another location: the most resilient design, but costs more than the VPN the company accepts (tốn chi phí hơn).
- VPC peering to the data center: peering connects VPCs only, so this does not exist (cấu hình không tồn tại).
Docs: https://docs.aws.amazon.com/vpn/latest/s2svpn/vpn-route-priority.html
> 🇻🇳 Backup rẻ nhất cho Direct Connect = Site-to-Site VPN cùng virtual private gateway; BGP ưu tiên DX, tự chuyển khi mất.
