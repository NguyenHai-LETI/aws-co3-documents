---
pack: ai-2026-10-22-tier-a-4-4
title: "AI · Tầng A · Task 4.4 — Mạng tối ưu chi phí (NAT, kết nối, DNS, billing, throttling)"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 4.4"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 4.4"
---

# AI · Tầng A · Task 4.4 — Mạng tối ưu chi phí (NAT, kết nối, DNS, billing, throttling)

## Q ai-20261022-a44-01
- domain: cost
- task: 4.4
- topic: cost
- services: Cost Explorer, Organizations
- tags: tagging, cost-allocation-tags, consolidated-billing
- difficulty: medium
- time: 145
- skills: 4.4.k1, 4.4.k2
- concept: User-defined tags must be activated as cost allocation tags from the management account before Cost Explorer can group by them
- refs: 06-management-governance.md
- hint: Thẻ đã gắn nhiều tuần nhưng chưa xuất hiện để nhóm chi phí — thẻ phải được kích hoạt ở đâu, bởi tài khoản nào trong tổ chức?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company has 30 AWS accounts in an organization with all features enabled. Teams tag their resources with a ProductLine tag key. Finance wants a monthly view of costs per product line across all accounts, but ProductLine does not appear as a grouping option in AWS Cost Explorer even though the tag has been applied for several weeks. The company wants a solution that covers every member account without building custom reports. Which combination of steps will meet these requirements? (Choose TWO)

- A. Activate the ProductLine user-defined cost allocation tag in the Billing and Cost Management console of the management account
- B. Create an AWS Cost and Usage Report in the management account that includes resource tags and query the monthly costs with Amazon Athena
- C. In AWS Cost Explorer for the management account, group the monthly costs by the ProductLine tag key
- D. Create an AWS Organizations tag policy that enforces the ProductLine key and its allowed values in every member account
- E. Activate the ProductLine cost allocation tag in the Billing and Cost Management console of each member account so that Cost Explorer can group by it

**Answer:** A, C

**Explanation:** A user-defined tag appears in Cost Explorer only after it is activated as a cost allocation tag in the management account, whose Cost Explorer then groups the consolidated costs of every member account by it.
- Cost and Usage Report with Athena: builds the custom reporting the company wants to avoid (vi phạm ràng buộc)
- Tag policy: standardizes tag keys and values but does not activate the tag for billing (giải bài toán khác)
- Activation in each member account: in an organization, the management account activates cost allocation tags (đặt sai chỗ)
Docs: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html
> 🇻🇳 Thẻ chi phí phải được kích hoạt (cost allocation tag) ở tài khoản quản lý rồi mới nhóm được trong Cost Explorer.
---

## Q ai-20261022-a44-02
- domain: cost
- task: 4.4
- topic: networking
- services: NAT Gateway, VPC
- tags: nat-gateway, single-nat, data-transfer-cost
- difficulty: medium
- skills: 4.4.k4, 4.4.s1
- concept: A non-production VPC can share one NAT gateway across AZs to avoid per-AZ hourly charges when brief outages are acceptable
- refs: 04-networking-services.md, L-quyet-dinh-nhanh.md
- hint: Môi trường dev chấp nhận mất kết nối ngắn khi một AZ lỗi và không muốn quản lý instance NAT — một NAT gateway chung hay mỗi AZ một cái?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 120

A company runs a development and test environment in a VPC with private subnets in three Availability Zones. The EC2 instances download packages and container images from the internet over IPv4 and accept no inbound connections. Outbound traffic averages about 40 GB per day. The environment is used during business hours, and a brief loss of internet access during an Availability Zone failure is acceptable. The team has no capacity to patch or operate NAT instances. Which solution will meet these requirements MOST cost-effectively?

- A. Create one NAT gateway in a public subnet of a single Availability Zone and point the default route of every private subnet to it
- B. Create a NAT gateway in a public subnet of each Availability Zone and route each private subnet to the gateway in its own zone
- C. Launch an Auto Scaling group of NAT instances across the three zones with a failover script, and route the private subnets to the instances
- D. Create an egress-only internet gateway and add an IPv4 default route to it in the route tables of every private subnet

**Answer:** A

**Explanation:** NAT gateways are charged per gateway-hour and per GB processed, so one shared gateway avoids two extra hourly charges, and the accepted short outage removes the need for one per zone. It is also managed.
- NAT gateway in every zone: zone independence nobody needs, at triple the hourly cost (tốn chi phí hơn)
- NAT instances in Auto Scaling groups: patching and failover scripts are work the team cannot take (vi phạm ràng buộc)
- Egress-only internet gateway: carries IPv6 only (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-comparison.html
> 🇻🇳 Dev/test chịu được gián đoạn ngắn → một NAT gateway dùng chung rẻ hơn; mỗi AZ một NAT chỉ khi cần độc lập AZ.
---

## Q ai-20261022-a44-03
- domain: cost
- task: 4.4
- topic: networking
- services: NLB, ELB
- tags: elb-features, cross-zone, data-transfer-cost
- difficulty: hard
- time: 140
- skills: 4.4.k3, 4.4.s3
- concept: Enabling cross-zone load balancing on an NLB incurs inter-AZ data transfer charges; disabling it keeps traffic within each AZ
- refs: 04-networking-services.md
- hint: Client đã chia đều ba AZ — phí truyền dữ liệu giữa AZ phát sinh ở chặng nào của đường đi client → NLB → target?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A gaming company runs a TCP-based matchmaking service behind an internet-facing Network Load Balancer that has cross-zone load balancing enabled. The targets are EC2 instances spread evenly across three Availability Zones by an Auto Scaling group, and clients are distributed evenly across the three zonal addresses of the load balancer. The monthly bill shows significant inter-AZ data transfer charges for the service. The company must keep using all three zones for availability, keep the NLB and the TCP protocol, and avoid code changes. Which solution will reduce the data transfer charges MOST cost-effectively?

- A. Replace the Network Load Balancer with an Application Load Balancer, keep cross-zone load balancing enabled, and register the same instances as targets
- B. Turn off cross-zone load balancing and keep the group balanced across the three zones so that each zone has enough targets
- C. Deregister the targets in two of the zones, keep cross-zone load balancing enabled, and let the Auto Scaling group serve every connection from one zone
- D. Put AWS Global Accelerator in front of the load balancer, keep cross-zone load balancing enabled, and let clients enter the AWS network closer to the targets

**Answer:** B

**Explanation:** With cross-zone enabled, an NLB node forwards to targets in other zones and EC2 data transfer charges apply. Disabled, each node serves only its own zone, so balanced capacity per zone removes cross-AZ traffic while all zones stay in use.
- Application Load Balancer: handles HTTP and HTTPS, not the custom TCP protocol (vi phạm ràng buộc)
- Targets in a single zone: removes the multi-zone availability required (vi phạm ràng buộc)
- Global Accelerator: does not change forwarding between zones, and adds charges (giải bài toán khác)
Docs: https://docs.aws.amazon.com/elasticloadbalancing/latest/network/edit-target-group-attributes.html#target-group-cross-zone
> 🇻🇳 NLB bật cross-zone → tính phí truyền dữ liệu giữa AZ; tắt cross-zone và cân bằng số target mỗi AZ để giảm chi phí.
---

## Q ai-20261022-a44-04
- domain: cost
- task: 4.4
- topic: cost
- services: Cost and Usage Report, Athena, VPC Flow Logs, NAT Gateway
- tags: data-transfer-cost, cost-and-usage-report, vpc-flow-logs
- difficulty: hard
- time: 170
- skills: 4.4.s5, 4.4.k2
- concept: Review network cost with CUR resource-level line items queried in Athena plus VPC Flow Logs to find traffic sources
- refs: 06-management-governance.md, 04-networking-services.md
- hint: Cần biết NAT gateway nào tốn nhất và lưu lượng đi đâu — một nguồn cho dữ liệu chi phí theo resource ID, một nguồn cho luồng mạng.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company's monthly bill shows a large increase in NAT gateway data processing charges. The company operates NAT gateways in several VPCs across 12 accounts and cannot tell which gateways are responsible or which applications and destinations generate the traffic. The cloud team wants to identify the most expensive NAT gateways and the main sources and destinations of traffic through them before it decides how to optimize, by using managed services and SQL queries. Which combination of actions will meet these requirements with the LEAST operational overhead? (Choose TWO)

- A. Use AWS Cost Explorer filtered to the NAT gateway usage types and grouped by linked account to find where the charges increased
- B. Create an organization-level Cost and Usage Report with resource IDs delivered to Amazon S3 and query the NAT gateway line items with Athena
- C. Set up VPC Traffic Mirroring for the busiest subnets and analyze the source and destination of mirrored packets on a fleet of EC2 monitoring appliances
- D. Use AWS Compute Optimizer idle resource recommendations for the organization to find the NAT gateways that drive the processing charges
- E. Enable VPC Flow Logs for the NAT gateways' network interfaces, deliver them to Amazon S3, and query the top source and destination addresses with Athena

**Answer:** B, E

**Explanation:** The Cost and Usage Report with resource IDs shows the charge for each NAT gateway, and Flow Logs on the gateway interfaces record each flow, so Athena SQL queries reveal the costliest gateways and who sends data where.
- Cost Explorer grouped by account: shows which accounts spend, not which gateway or traffic (giải bài toán khác)
- Traffic Mirroring to EC2 appliances: self-managed packet analysis instead of managed SQL queries (tốn vận hành hơn)
- Compute Optimizer idle recommendations: flag only unused NAT gateways, not busy ones (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/cur/latest/userguide/what-is-cur.html
> 🇻🇳 Rà soát chi phí mạng: CUR (kèm resource ID) + Athena cho chi phí theo NAT gateway, VPC Flow Logs cho nguồn/đích lưu lượng.
---

## Q ai-20261022-a44-05
- domain: cost
- task: 4.4
- topic: networking
- services: Direct Connect, S3
- tags: direct-connect, hosted-connection, data-transfer-cost
- difficulty: medium
- time: 120
- skills: 4.4.k5, 4.4.s2
- concept: A Direct Connect hosted connection sized to need beats internet or oversized ports on cost and consistent latency for steady heavy traffic
- refs: 04-networking-services.md, L-quyet-dinh-nhanh.md
- hint: Truyền dữ liệu ra nhiều TB mỗi tháng, cần độ trễ ổn định, chỉ cần dưới 1 Gbps — kết nối riêng cỡ nào và loại nào rẻ nhất?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A media company's studio uploads source footage to Amazon S3 and downloads about 15 TB of rendered output from S3 every month. The studio currently uses a Site-to-Site VPN over the internet, which is congested at peak times, and the company needs consistent latency. The studio never needs more than 500 Mbps of throughput, and the company plans to keep the arrangement for at least three years. Which solution will meet these requirements MOST cost-effectively?

- A. Order a 1 Gbps dedicated Direct Connect connection at a Direct Connect location and create a public virtual interface to reach Amazon S3
- B. Order a 500 Mbps hosted Direct Connect connection from a Partner and create a private virtual interface that reaches Amazon S3 through a gateway endpoint
- C. Order a 500 Mbps hosted Direct Connect connection from a Direct Connect Partner and create a public virtual interface to reach Amazon S3
- D. Recreate the Site-to-Site VPN as an accelerated VPN on a transit gateway so that traffic enters the AWS network at the nearest edge location

**Answer:** C

**Explanation:** A private connection avoids internet congestion, data transfer out over Direct Connect costs less per GB than over the internet, and a hosted connection can be sized at 500 Mbps; a public virtual interface reaches the S3 public endpoints.
- 1 Gbps dedicated connection: twice the needed capacity at a higher port-hour price (tốn chi phí hơn)
- Private virtual interface to a gateway endpoint: gateway endpoints cannot be reached from on premises (đặt sai chỗ)
- Accelerated VPN: the internet still carries the first mile, so latency stays inconsistent (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/directconnect/latest/UserGuide/hosted_connection.html
> 🇻🇳 Lưu lượng lớn, ổn định, cần độ trễ đều → Direct Connect; chọn hosted connection đúng băng thông + public VIF tới S3.
---

## Q ai-20261022-a44-06
- domain: cost
- task: 4.4
- topic: networking
- services: Site-to-Site VPN, Direct Connect, Transit Gateway
- tags: vpn, bandwidth, direct-connect
- difficulty: medium
- skills: 4.4.s7, 4.4.k5
- concept: A single Site-to-Site VPN connection already supports up to 1.25 Gbps per tunnel, so moderate bandwidth needs do not justify multiple VPNs or Direct Connect
- refs: 04-networking-services.md
- hint: Nhu cầu khoảng 700 Mbps, cần triển khai trong vài ngày với chi phí thấp nhất — một kết nối VPN có đủ băng thông không?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 105

A company's data center must exchange about 700 Mbps of steady traffic with workloads in a single VPC for the next year. The traffic must be encrypted, the connection must survive the loss of one tunnel endpoint, the link must be running within a few days, and the company wants the LOWEST cost. The customer gateway device supports IPsec and BGP. Which solution will meet these requirements?

- A. Create four Site-to-Site VPN connections attached to a transit gateway, with BGP routing and equal-cost multi-path routing across the tunnels
- B. Order a 1 Gbps dedicated Direct Connect connection and add a backup Site-to-Site VPN connection for encryption and failover
- C. Create an AWS Client VPN endpoint and install the client software on the servers in the data center
- D. Create one Site-to-Site VPN connection to a virtual private gateway and configure both of its tunnels with BGP routing for redundancy

**Answer:** D

**Explanation:** Each standard VPN tunnel supports up to 1.25 Gbps, so one connection covers 700 Mbps, and its two tunnels end in different Availability Zones for redundancy. It is encrypted, ready in minutes, and cheaper than every larger design.
- Four VPN connections with a transit gateway: extra connection, attachment and processing charges for unneeded bandwidth (tốn chi phí hơn)
- Direct Connect with backup VPN: provisioning a physical connection takes far longer than days (vi phạm ràng buộc)
- Client VPN: built for individual remote users, not site-to-site links (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/vpn/latest/s2svpn/vpn-limits.html
> 🇻🇳 700 Mbps vừa trong giới hạn 1,25 Gbps mỗi tunnel → một Site-to-Site VPN (2 tunnel) là đủ và rẻ nhất.
---

## Q ai-20261022-a44-07
- domain: cost
- task: 4.4
- topic: networking
- services: Transit Gateway, VPC Peering, Direct Connect
- tags: transit-gateway, vpc-peering, data-transfer-cost
- difficulty: hard
- skills: 4.4.k6, 4.4.s3
- concept: Peering avoids Transit Gateway data processing charges for a high-volume pair, while the Transit Gateway hub still serves on-premises access
- refs: 04-networking-services.md, Q-service-comparisons.md
- hint: Hai VPC trao đổi hàng trăm TB mỗi tháng nên tính phí xử lý theo GB của Transit Gateway rất lớn — nhưng vẫn cần một trung tâm cho on-premises.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A company runs 12 VPCs in one Region and none of the CIDR blocks overlap. An ingestion VPC and an analytics VPC exchange about 200 TB of data every month. The other ten VPCs need occasional low-volume access to a shared-services VPC. All 12 VPCs must also reach the company's data center through a single Direct Connect connection. The company wants private connectivity with the LOWEST total network cost. Which solution will meet these requirements?

- A. Attach all 12 VPCs to a transit gateway, and add a VPC peering connection between the ingestion and analytics VPCs for their data exchange
- B. Attach all 12 VPCs to a transit gateway and route all traffic, including the data exchange between the ingestion and analytics VPCs, through it
- C. Create a full mesh of VPC peering connections among the analytics VPC, the ingestion VPC and the ten other VPCs, and route on-premises traffic through them
- D. Create AWS PrivateLink endpoint services in the analytics VPC and interface endpoints in each of the other 11 VPCs, including the shared-services VPC

**Answer:** A

**Explanation:** The transit gateway is the hub for Direct Connect, but it charges per attachment hour and per GB processed. Peering has no hourly charge and same-zone traffic is free, so moving the 200 TB flow to peering removes the largest charge.
- Everything through the transit gateway: processing charges apply to all 200 TB (tốn chi phí hơn)
- Full mesh of peering: peering is not transitive, so Direct Connect cannot be shared (vi phạm ràng buộc)
- PrivateLink endpoint services: charge per hour and per GB, and are not general connectivity (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html
> 🇻🇳 Cặp VPC lưu lượng khổng lồ → VPC peering (không phí xử lý/giờ); Transit Gateway vẫn là hub cho on-premises.
---

## Q ai-20261022-a44-08
- domain: cost
- task: 4.4
- topic: networking
- services: Route 53 Resolver, RAM, Route 53
- tags: hybrid-dns, resolver-endpoints, data-transfer-cost
- difficulty: hard
- time: 165
- skills: 4.4.k7
- concept: Resolver endpoints are billed per ENI-hour, so centralize one outbound endpoint and share forwarding rules through AWS RAM
- refs: 04-networking-services.md
- hint: Phí Resolver endpoint tính theo ENI-giờ ở từng VPC — làm sao để 40 VPC dùng chung đường chuyển tiếp DNS mà PHZ và tên dịch vụ AWS vẫn như cũ?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company has 40 VPCs in 40 accounts of one organization. Each VPC has its own Route 53 Resolver outbound endpoint and a forwarding rule for corp.example.com, which resolves on on-premises DNS servers over Direct Connect. The bill shows high Resolver endpoint charges. The company wants to reduce DNS costs while resolution of corp.example.com keeps working from every VPC, private hosted zones and AWS service names keep resolving as they do today, and operational effort stays low. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create one outbound endpoint and forwarding rule in a shared-services VPC and delete the per-VPC endpoints
- B. Create an inbound endpoint in each VPC so that on-premises DNS servers can resolve names hosted in the VPCs of the organization, and keep the outbound forwarding rules
- C. Change the DHCP options set of each VPC to use the on-premises DNS servers directly as the sole name servers, replacing the outbound rule
- D. Share the forwarding rule with the organization by using AWS Resource Access Manager and associate it with each of the 40 VPCs
- E. Create a private hosted zone for corp.example.com in each VPC instead of the forwarding rule and copy the on-premises records into every zone

**Answer:** A, D

**Explanation:** Resolver endpoints are billed per network interface and hour, so one outbound endpoint replaces forty. A rule shared through AWS RAM and associated with each VPC sends queries through it.
- Inbound endpoints in each VPC: serve queries from on-premises to AWS, the opposite direction, and add charges (giải bài toán khác)
- On-premises DNS servers as sole name servers: private hosted zones and AWS names would stop resolving as today (vi phạm ràng buộc)
- Copied records in private hosted zones: forty copies that drift from the source (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver-rules-managing.html
> 🇻🇳 Giảm phí Resolver endpoint: một outbound endpoint dùng chung + chia sẻ forwarding rule qua AWS RAM cho các VPC.
---

## Q ai-20261022-a44-09
- domain: cost
- task: 4.4
- topic: networking
- services: CloudFront, S3
- tags: cloudfront, edge-caching, data-transfer-cost
- difficulty: easy
- time: 105
- skills: 4.4.s4
- concept: CloudFront caches static downloads at the edge, cutting S3 data transfer out and latency while the bucket stays private through origin access control
- refs: 04-networking-services.md
- hint: Tệp ít thay đổi, người dùng toàn cầu, hoá đơn chủ yếu là truyền dữ liệu ra — lớp đệm nào ở biên giảm cả chi phí lẫn độ trễ?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A software company provides installers and updates, each between 200 MB and 2 GB, from an Amazon S3 bucket in us-east-1 directly to customers worldwide. The monthly bill is dominated by S3 data transfer out to the internet, and customers in Asia report slow downloads. The files change only a few times per month, and the bucket must remain private. Which solution will reduce cost and improve download speed MOST cost-effectively?

- A. Create an Amazon CloudFront distribution that uses the bucket's static website endpoint as a custom origin, with public read access on the bucket
- B. Create an Amazon CloudFront distribution with the S3 bucket as its origin by using origin access control, and serve downloads through it
- C. Replicate the bucket to Regions near the customers with S3 Cross-Region Replication and direct each customer to the closest bucket with Route 53 latency routing
- D. Enable S3 Transfer Acceleration on the bucket and have customers download through the accelerated endpoint at the nearest edge location

**Answer:** B

**Explanation:** CloudFront caches the rarely changing files at edge locations, so most downloads never reach S3, origin fetches from S3 are free, and distant customers download faster; origin access control keeps the bucket private.
- Website endpoint origin with public read: the bucket becomes public (vi phạm ràng buộc)
- Cross-Region Replication with latency routing: extra copies and replication transfer, and each download still pays S3 transfer out (tốn chi phí hơn)
- Transfer Acceleration: adds a per-GB fee to every download, with no caching (tốn chi phí hơn)
Docs: https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/
> 🇻🇳 Tệp tĩnh ít đổi cho người dùng toàn cầu → CloudFront (cache ở biên, truyền S3→CloudFront miễn phí, bucket riêng tư qua OAC).
---

## Q ai-20261022-a44-10
- domain: cost
- task: 4.4
- topic: api
- services: API Gateway, Lambda
- tags: throttling, usage-plans, api-keys
- difficulty: medium
- time: 120
- skills: 4.4.s6
- concept: API Gateway usage plans with API keys throttle and cap each client by tier, protecting backend cost without code changes
- refs: 11-api-integration.md, 04-networking-services.md
- hint: Mỗi gói đối tác cần tốc độ và hạn mức tháng khác nhau — tính năng nào của API Gateway giới hạn theo từng khách hàng?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company exposes a REST API through Amazon API Gateway with AWS Lambda integrations. Partners buy the API on three subscription tiers that must allow different steady request rates and different monthly request volumes. A few Basic-tier partners send traffic bursts that raise Lambda concurrency and downstream database costs for everyone. The company wants to cap each partner according to its tier without changing the Lambda code. Which solution will meet these requirements with the LEAST operational overhead?

- A. Associate an AWS WAF web ACL with the stage that has a rate-based rule for each tier, aggregated on the value of the API key header
- B. Configure stage-level and method-level throttling on the API with separate steady-state rate and burst limits for each resource, reviewed against monthly request counts
- C. Create an API Gateway usage plan for each tier with rate, burst and monthly quota limits, and associate each partner's API key with its plan
- D. Deploy a separate API Gateway stage for each tier with its own throttling limits, and give each partner the invoke URL of its tier's stage

**Answer:** C

**Explanation:** A usage plan sets throttling rate, burst and monthly quota for each API key, so every partner is capped by its tier and excess calls get 429 responses before Lambda runs.
- WAF rate-based rules on the key header: limit request rates but cannot enforce monthly request volumes (vi phạm ràng buộc)
- Stage and method throttling: limits apply to all callers together, not to each partner (giải bài toán khác)
- One stage per tier: limits are shared by every partner in the tier, so one partner's bursts still affect the others (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html
> 🇻🇳 Giới hạn tốc độ và hạn mức theo từng gói/khách hàng → usage plan + API key trên API Gateway.