---
pack: ai-2026-10-17-0823
title: "AI · Kết nối VPC: Endpoint, PrivateLink vs Peering vs TGW, hybrid DNS, CloudFront vs GA"
exam: SAA-C03
origin: ai
created: 2026-10-17
generated_by: 2026-10-17_082317_analyze
source: trainer/coach/plans/2026-10-17-0823.md
description: "Biến thể + contrast cho 9 câu networking sai trong bài 2026-10-17: Gateway vs Interface endpoint, PrivateLink vs Peering/TGW, TGW + RAM, Resolver endpoints, Flow Logs, Egress-only IGW, CloudFront vs Global Accelerator"
defaults:
  topic: networking
---

# AI · Kết nối VPC: Endpoint, PrivateLink vs Peering vs TGW, hybrid DNS, CloudFront vs GA

## Q ai-20261017-0823-01
- domain: cost
- task: 4.4
- topic: networking
- services: VPC Endpoint, S3, NAT Gateway
- tags: subnets
- difficulty: medium
- variant_of: 04-v1-06
- concept: Gateway VPC endpoint for S3 is free and removes NAT data processing cost; interface endpoint is billed
- refs: 04-networking-services.md
- hint: So sánh cách tính phí của từng loại endpoint cho S3 với phí xử lý dữ liệu của NAT.
- created: 2026-10-17
- time: 105

A media company runs batch jobs on EC2 instances in private subnets. Every night the jobs read and write several terabytes of objects in Amazon S3 buckets in the same Region. Today all S3 traffic leaves through a NAT gateway, and the NAT data processing charges have become the largest line on the monthly networking bill. The security team requires that the traffic does not traverse the public internet. Which solution will meet these requirements MOST cost-effectively?

- A. Create a gateway VPC endpoint for S3 and add it to the route tables of the private subnets
- B. Create an interface VPC endpoint for S3 in each private subnet and use its endpoint DNS names
- C. Replace the NAT gateway with a NAT instance on a larger EC2 instance type in the public subnet
- D. Move the instances to public subnets and send S3 traffic through the internet gateway directly

**Answer:** A

**Explanation:** A gateway endpoint for S3 is a route-table target that keeps traffic on the AWS network and has no hourly or per-GB charge, so it removes the NAT processing cost.
- Interface endpoint for S3: also private, but billed per hour and per GB processed.
- NAT instance: still sends traffic toward public endpoints and adds patching and HA work.
- Public subnets with an internet gateway: traffic uses the internet path and exposes the instances.
> 🇻🇳 S3/DynamoDB + private + rẻ nhất → Gateway endpoint (miễn phí); Interface endpoint tính phí theo giờ + GB.

---

## Q ai-20261017-0823-02
- domain: secure
- task: 1.2
- topic: networking
- services: PrivateLink, VPC Endpoint, SQS, KMS
- difficulty: medium
- variant_of: 14-v1-03
- concept: Services other than S3/DynamoDB need interface endpoints (PrivateLink) with private DNS; gateway endpoints exist only for S3 and DynamoDB
- refs: 04-networking-services.md
- hint: Loại endpoint nào hỗ trợ SQS và KMS, và tính năng nào giữ nguyên tên endpoint mặc định của SDK?
- created: 2026-10-17
- time: 100

An application on EC2 instances in private subnets with no internet access must send messages to Amazon SQS and call AWS KMS to decrypt data keys. A compliance rule states that requests to these AWS services must never leave the AWS network. The development team wants to keep using the default SDK endpoint names without changing any application code. Which solution meets these requirements?

- A. Create gateway VPC endpoints for SQS and KMS and add them to the private subnet route tables
- B. Add a NAT gateway in a public subnet and restrict outbound security group rules to AWS ranges
- C. Create interface VPC endpoints for SQS and KMS with private DNS enabled in the private subnets
- D. Create a VPC peering connection to the AWS service VPC that hosts the SQS and KMS endpoints

**Answer:** C

**Explanation:** Interface endpoints (AWS PrivateLink) place ENIs with private IPs in the subnets; with private DNS enabled, the default SQS and KMS hostnames resolve to those private IPs, so no code change is needed.
- Gateway endpoints for SQS and KMS: gateway endpoints exist only for S3 and DynamoDB.
- NAT gateway: requests still go to the public service endpoints over the internet path.
- Peering with an AWS service VPC: not possible; AWS services are reached through endpoints.
> 🇻🇳 Service khác S3/DynamoDB (SQS, KMS…) → Interface endpoint (PrivateLink) + private DNS.

---

## Q ai-20261017-0823-03
- domain: secure
- task: 1.2
- topic: networking
- services: VPC Endpoint, PrivateLink, S3, Direct Connect
- difficulty: hard
- concept: Gateway endpoints are usable only from inside the VPC; on-premises access to S3 over DX/VPN with private IPs needs an S3 interface endpoint
- refs: 04-networking-services.md
- hint: Gateway endpoint hoạt động qua route table của VPC — lưu lượng đi vào từ on-prem có dùng được route đó không?
- created: 2026-10-17
- time: 125

A company connects its data center to a VPC through AWS Direct Connect with a private virtual interface. The VPC already has a gateway VPC endpoint for Amazon S3, which EC2 instances use successfully. On-premises servers now need to upload files to S3 over the Direct Connect link by using private IP addresses, without sending any traffic over the internet. The network team finds that on-premises traffic cannot use the existing endpoint. Which solution meets these requirements?

- A. Add the on-premises CIDR range to the gateway endpoint policy and propagate its route to the virtual private gateway
- B. Create a public virtual interface on Direct Connect and allow the S3 public IP ranges on the on-premises firewall
- C. Deploy a NAT gateway in the VPC and route on-premises S3 traffic through it toward the existing gateway endpoint
- D. Create an interface VPC endpoint for S3 and configure on-premises servers to use its endpoint-specific DNS names

**Answer:** D

**Explanation:** Gateway endpoints work only through the VPC's route tables, so traffic arriving from on-premises cannot use them. An S3 interface endpoint has private IPs in the VPC that on-premises hosts can reach over Direct Connect.
- Endpoint policy plus route propagation: gateway endpoints do not support transitive access from on-premises.
- Public virtual interface: avoids the internet but uses S3 public IPs, not private addresses.
- NAT gateway in the path: edge-to-edge routing from on-premises through a NAT gateway is not supported.
> 🇻🇳 On-prem truy cập S3 qua DX/VPN bằng IP private → Interface endpoint cho S3; Gateway endpoint chỉ dùng trong VPC.

---

## Q ai-20261017-0823-04
- domain: performance
- task: 3.4
- topic: networking
- services: PrivateLink, NLB, VPC Endpoint
- difficulty: hard
- variant_of: 04-v2-23
- concept: PrivateLink (NLB + endpoint service + consumer interface endpoints) exposes one service to thousands of VPCs, even with overlapping CIDRs
- refs: 04-networking-services.md
- hint: Khách hàng chỉ cần gọi một API, CIDR trùng nhau, số lượng rất lớn — giải pháp nào không cần định tuyến giữa hai mạng?
- created: 2026-10-17
- time: 120

A SaaS company hosts a payment-validation API on EC2 instances in its own VPC. More than 2,000 customers, each with their own AWS accounts and VPCs, must call the API. Many customer VPCs use CIDR ranges that overlap with the provider VPC and with each other. Customers must reach only this API, not the rest of the provider network, and the traffic must not traverse the internet. Which solution should a solutions architect recommend?

- A. Attach every customer VPC to a shared Transit Gateway and restrict access with route table segmentation
- B. Publish the API as a VPC endpoint service behind an NLB and have customers create interface endpoints
- C. Create a VPC peering connection with each customer VPC and limit access with security group rules
- D. Expose the API through an internet-facing Application Load Balancer protected by AWS WAF allow lists

**Answer:** B

**Explanation:** AWS PrivateLink exposes a single service behind a Network Load Balancer as an endpoint service; consumers create interface endpoints in their own VPCs, so overlapping CIDRs do not matter and only the API is reachable.
- Shared Transit Gateway: routes whole networks and cannot route between overlapping CIDRs.
- VPC peering per customer: fails with overlapping CIDRs and does not scale to thousands of peers.
- Internet-facing ALB with WAF: the traffic crosses the internet.
> 🇻🇳 Cung cấp 1 dịch vụ riêng tư cho rất nhiều VPC khách (CIDR trùng) → PrivateLink (NLB + endpoint service).

---

## Q ai-20261017-0823-05
- domain: performance
- task: 3.4
- topic: networking
- services: PrivateLink, VPC Peering, Transit Gateway
- difficulty: medium
- variant_of: 04-v2-25
- concept: Overlapping CIDR blocks rule out VPC peering and Transit Gateway routing; PrivateLink exposes one service without routing between networks
- refs: 04-networking-services.md
- hint: Hai VPC dùng cùng một dải CIDR — giải pháp nào không yêu cầu định tuyến IP giữa hai mạng?
- created: 2026-10-17
- time: 100

After an acquisition, a company must let applications in its main VPC call an inventory service that runs in the acquired company's VPC. Both VPCs use the 10.0.0.0/16 CIDR block, and re-addressing either network would take months. The applications need access to the inventory service only, and the solution should require the least network re-engineering. Which solution meets these requirements?

- A. Expose the inventory service through AWS PrivateLink and create an interface endpoint in the main VPC
- B. Create a VPC peering connection and add more specific routes for the inventory service subnets
- C. Attach both VPCs to a Transit Gateway and use separate route tables to isolate the duplicate ranges
- D. Add a secondary CIDR block to one VPC and redeploy the inventory service into the new address range

**Answer:** A

**Explanation:** With PrivateLink, the consumer VPC gets an interface endpoint with a local IP address, so the overlapping CIDRs never need to route to each other and only the inventory service is exposed.
- VPC peering: cannot be created between VPCs with overlapping CIDR blocks.
- Transit Gateway: still routes by CIDR, so identical ranges cannot reach each other.
- Secondary CIDR and redeploy: works eventually but is the heavy re-engineering the company wants to avoid.
> 🇻🇳 CIDR trùng nhau + chỉ cần truy cập 1 dịch vụ → PrivateLink, không phải Peering/TGW.

---

## Q ai-20261017-0823-06
- domain: performance
- task: 3.4
- topic: networking
- services: Transit Gateway, VPC Peering, PrivateLink, Site-to-Site VPN
- difficulty: medium
- variant_of: 04-v2-28
- concept: Transit Gateway = managed hub-and-spoke with transitive routing for many VPCs + VPN; PrivateLink exposes services, not networks
- refs: 04-networking-services.md
- hint: Mọi VPC cần nói chuyện với mọi VPC và on-prem (định tuyến bắc cầu) — chỉ một số giải pháp hỗ trợ transitive routing.
- created: 2026-10-17
- time: 105

A company runs 40 VPCs across several AWS accounts and connects its data center with a Site-to-Site VPN. Every VPC must be able to communicate with every other VPC and with the on-premises network, and all CIDR blocks are unique. The current full mesh of VPC peering connections has become hard to manage, and new VPCs are added every month. Which solution provides centralized, transitive routing with the LEAST operational overhead?

- A. Expose each workload as an endpoint service with AWS PrivateLink and create endpoints in every VPC
- B. Keep the VPC peering mesh and automate new peering connections and routes with CloudFormation
- C. Attach all VPCs and the VPN to a Transit Gateway and manage routing in its route tables centrally
- D. Deploy a transit VPC with EC2-based router appliances and connect each VPC to it over VPN tunnels

**Answer:** C

**Explanation:** Transit Gateway is a managed hub-and-spoke router: each VPC and the VPN attach once, routing is transitive and controlled centrally, and a new VPC needs only one attachment.
- PrivateLink endpoints everywhere: exposes individual services, not full network-to-network routing.
- Automated peering mesh: peering stays non-transitive and the number of connections keeps growing.
- Transit VPC with EC2 routers: works but adds appliances to patch, scale, and make highly available.
> 🇻🇳 Nhiều VPC + on-prem, cần định tuyến bắc cầu, quản lý tập trung → Transit Gateway.

---

## Q ai-20261017-0823-07
- domain: cost
- task: 4.4
- topic: networking
- services: VPC Peering, Transit Gateway, PrivateLink
- difficulty: medium
- concept: For only two VPCs with non-overlapping CIDRs, VPC peering is the cheapest full private connectivity; TGW/PrivateLink add charges
- refs: 04-networking-services.md
- hint: Chỉ có hai VPC, CIDR không trùng, không mở rộng thêm — giải pháp nào không có phí theo giờ cho mỗi kết nối?
- created: 2026-10-17
- time: 100

A company has exactly two VPCs in the same Region: one for a web application and one for a shared reporting database tier. The CIDR blocks do not overlap, and the application servers need full private IP connectivity to several database hosts and ports. No other VPCs or on-premises networks will be connected in the foreseeable future. Which solution meets these requirements MOST cost-effectively?

- A. Attach both VPCs to a new Transit Gateway and add routes to the Transit Gateway route table
- B. Expose each database host through AWS PrivateLink and create interface endpoints in the app VPC
- C. Route traffic between the VPCs over the internet through NAT gateways with TLS on every connection
- D. Create a VPC peering connection and update the route tables and security groups in both VPCs

**Answer:** D

**Explanation:** For two VPCs with non-overlapping CIDRs, VPC peering gives full private connectivity with no hourly connection charge; only route tables and security groups need updating.
- Transit Gateway: works, but adds per-attachment and data processing charges that pay off only with many VPCs.
- PrivateLink per host: built for exposing a service, needs an NLB and endpoints per service, and costs more.
- NAT gateways over the internet: traffic leaves the private network and incurs NAT charges.
> 🇻🇳 Chỉ 2 VPC, CIDR không trùng, cần kết nối đầy đủ, rẻ nhất → VPC Peering.

---

## Q ai-20261017-0823-08
- domain: performance
- task: 3.4
- topic: networking
- services: Transit Gateway, RAM, VPC Peering, PrivateLink
- tags: cross-account-access
- difficulty: hard
- variant_of: 04-v2-28
- concept: Transit Gateway per Region + inter-Region TGW peering for central routing; share TGW with accounts through AWS RAM
- refs: 04-networking-services.md
- hint: Cần một hub định tuyến ở mỗi Region nối với nhau, và các account khác tự gắn VPC — service nào dùng để chia sẻ tài nguyên giữa account?
- created: 2026-10-17
- time: 140

A company uses AWS Organizations with a central networking account and 60 application accounts in two Regions. The networking team wants every application VPC to reach shared services and on-premises networks through a single, centrally managed routing hub in each Region, and the two hubs must exchange traffic. Application teams must attach their own VPCs without the networking team creating resources in each account. Which TWO actions should a solutions architect take? (Choose TWO)

- A. Create a full mesh of VPC peering connections between all application VPCs in both Regions
- B. Create a Transit Gateway in each Region in the networking account and peer the two gateways
- C. Deploy an internet gateway in every application VPC and route inter-VPC traffic through it
- D. Expose each application VPC as an endpoint service and connect them with AWS PrivateLink
- E. Share each Transit Gateway with the organization by using AWS Resource Access Manager

**Answer:** B, E

**Explanation:** A Transit Gateway in each Region provides central, transitive routing, and inter-Region peering links the two hubs. Sharing the gateways with AWS RAM lets each application account create its own VPC attachment.
- Full-mesh peering: non-transitive and unmanageable at this scale.
- Internet gateways: send private traffic toward the internet and provide no central routing.
- PrivateLink per VPC: exposes services, not routed network connectivity.
> 🇻🇳 Nhiều account + nhiều Region → TGW mỗi Region + TGW peering; chia sẻ cho account khác qua RAM.

---

## Q ai-20261017-0823-09
- domain: secure
- task: 1.1
- topic: networking
- services: RAM, VPC
- tags: vpc-sharing, subnets
- difficulty: medium
- variant_of: 17-v1-19
- concept: VPC sharing via AWS RAM: owner account controls VPC/subnets/routes, participant accounts launch resources into shared subnets
- refs: 04-networking-services.md
- hint: Team mạng giữ quyền sở hữu, các account khác chỉ đặt tài nguyên vào subnet — service nào chia sẻ tài nguyên giữa các account trong Organization?
- created: 2026-10-17
- time: 100

A company wants a central networking team to own all VPCs, subnets, route tables, and gateways, while application teams in separate AWS accounts in the same organization launch EC2 instances and RDS databases directly into those subnets. Application teams must not be able to modify the network configuration, and the company wants to avoid creating and connecting a separate VPC in every account. Which solution meets these requirements?

- A. Share the subnets from the networking account with the application accounts by using AWS RAM
- B. Create a VPC in every application account and connect each one to the networking VPC with peering
- C. Grant application teams cross-account IAM roles with full EC2 permissions in the networking account
- D. Use service control policies to let application accounts launch instances into another account's VPC

**Answer:** A

**Explanation:** VPC sharing uses AWS RAM to share subnets with other accounts in the organization; participants launch resources into the shared subnets but cannot modify the VPC, subnets, or route tables owned by the networking account.
- VPC per account plus peering: the separate-VPC sprawl the company wants to avoid.
- Cross-account roles with full EC2 permissions: would let application teams change the network configuration.
- SCPs: only restrict permissions; they cannot grant access to another account's VPC.
> 🇻🇳 Một team sở hữu mạng, nhiều account dùng chung subnet → VPC sharing qua AWS RAM.

---

## Q ai-20261017-0823-10
- domain: secure
- task: 1.2
- topic: networking
- services: Route 53 Resolver, Route 53, Direct Connect
- tags: hybrid-dns
- difficulty: medium
- variant_of: 17-v1-04
- concept: Route 53 Resolver inbound endpoint lets on-premises DNS resolve private hosted zone records in a VPC
- refs: 04-networking-services.md
- hint: Xác định chiều của truy vấn DNS: từ đâu hỏi, và tên cần phân giải nằm ở đâu?
- created: 2026-10-17
- time: 100

A company stores internal records for its applications in an Amazon Route 53 private hosted zone that is associated with a production VPC. The data center is connected to the VPC through AWS Direct Connect. On-premises DNS servers must now resolve names in the private hosted zone, and the company does not want to run and patch its own DNS servers on EC2 instances. Which solution meets these requirements?

- A. Create a Route 53 Resolver outbound endpoint and a forwarding rule for the on-premises domain name
- B. Copy the records into a Route 53 public hosted zone so that on-premises DNS servers can query them
- C. Create a Route 53 Resolver inbound endpoint and forward queries for the zone from on-premises DNS
- D. Associate the private hosted zone with the virtual private gateway that terminates Direct Connect

**Answer:** C

**Explanation:** A Resolver inbound endpoint places IP addresses in the VPC that on-premises DNS servers can forward queries to over Direct Connect, so they resolve private hosted zone records without self-managed DNS servers.
- Outbound endpoint with a forwarding rule: handles the opposite direction, from the VPC to on-premises.
- Public hosted zone: exposes internal names on the internet.
- Associating the zone with a virtual private gateway: private hosted zones are associated with VPCs.
> 🇻🇳 On-prem cần phân giải tên trong VPC → Inbound endpoint; VPC cần phân giải tên on-prem → Outbound endpoint.

---

## Q ai-20261017-0823-11
- domain: secure
- task: 1.2
- topic: networking
- services: Route 53 Resolver, Site-to-Site VPN, RAM
- tags: hybrid-dns
- difficulty: medium
- variant_of: 17-v1-04
- concept: Route 53 Resolver outbound endpoint + conditional forwarding rule lets VPC resources resolve on-premises domains
- refs: 04-networking-services.md
- hint: Lần này truy vấn đi theo chiều ngược lại so với câu “on-prem hỏi tên trong VPC” — chỉ một miền cần chuyển tiếp.
- created: 2026-10-17
- time: 100

EC2 instances in several VPCs must resolve hostnames in the corp.example.com domain, which is hosted only on DNS servers in the company's data center. The data center is reachable through a Site-to-Site VPN. All other DNS queries should continue to use the default Route 53 Resolver, and the company wants a managed solution with minimal operational overhead. Which solution meets these requirements?

- A. Create a Route 53 Resolver inbound endpoint and point the on-premises DNS servers to its IP addresses
- B. Create a Resolver outbound endpoint and a forwarding rule for corp.example.com shared to the VPCs
- C. Create a public hosted zone for corp.example.com and copy the on-premises records into it nightly
- D. Change the DHCP options set of each VPC to send every lookup to the on-premises DNS servers

**Answer:** B

**Explanation:** A Resolver outbound endpoint with a conditional forwarding rule sends only corp.example.com queries to the on-premises DNS servers; the rule can be shared with other VPCs through AWS RAM, and all other queries keep using Route 53 Resolver.
- Inbound endpoint: lets on-premises resolve VPC names, the opposite direction.
- Public hosted zone copy: exposes internal records and needs a sync job.
- DHCP options to on-premises DNS: sends every lookup over the VPN and depends on the data center.
> 🇻🇳 VPC cần phân giải tên on-prem → Outbound endpoint + forwarding rule.

---

## Q ai-20261017-0823-12
- domain: secure
- task: 1.2
- topic: networking
- services: VPC Flow Logs, CloudTrail, GuardDuty, AWS Config
- tags: security-groups, nacl
- difficulty: medium
- variant_of: 17-v1-03
- concept: VPC Flow Logs record IP/port metadata with ACCEPT/REJECT; CloudTrail = API calls, GuardDuty = threat findings, Config = config history
- refs: B-bao-mat-compliance.md, 05-security-services.md
- hint: Cần dữ liệu về từng kết nối mạng (IP, port, chấp nhận/từ chối) chứ không phải lời gọi API hay cảnh báo mối đe doạ.
- created: 2026-10-17
- time: 95

After a network change, an application tier in a private subnet can no longer connect to an Amazon RDS instance on port 5432. The operations team suspects that a network ACL or security group is now rejecting the traffic. They need to see the source and destination IP addresses, ports, and whether each connection attempt was accepted or rejected. Which solution provides this information?

- A. Review AWS CloudTrail event history for the rejected API calls between the two tiers
- B. Enable Amazon GuardDuty and review its findings for the application and database hosts
- C. Use AWS Config rules to evaluate the security group and network ACL changes over time
- D. Enable VPC Flow Logs on the subnets or network interfaces and query the REJECT records

**Answer:** D

**Explanation:** VPC Flow Logs capture IP traffic metadata for a VPC, subnet, or ENI, including source and destination addresses, ports, and an ACCEPT or REJECT action, which pinpoints the blocking rule.
- CloudTrail: records API calls, not packets between instances.
- GuardDuty: produces threat findings (it analyzes flow logs) but does not list every connection attempt.
- AWS Config: shows configuration history, not whether traffic was accepted or rejected.
> 🇻🇳 Cần IP/port + ACCEPT/REJECT → VPC Flow Logs; CloudTrail = API, GuardDuty = phát hiện mối đe doạ.

---

## Q ai-20261017-0823-13
- domain: performance
- task: 3.4
- topic: networking
- services: Internet Gateway, NAT Gateway, VPC
- tags: ipv6, egress-only-igw, subnets
- difficulty: medium
- variant_of: 04-v2-19
- concept: IPv6 is globally routable so NAT is not used; Egress-Only IGW gives outbound-only IPv6 while NAT Gateway handles IPv4
- refs: 04-networking-services.md
- hint: Địa chỉ IPv6 không cần dịch địa chỉ — thành phần nào chỉ cho đi ra mà chặn kết nối khởi tạo từ ngoài vào?
- created: 2026-10-17
- time: 95

A company runs a dual-stack application in private subnets. The instances must download software updates from the internet over both IPv4 and IPv6. Security policy states that no host on the internet may initiate a connection to the instances over either protocol. A NAT gateway already handles the IPv4 traffic. Which additional component should a solutions architect add for the IPv6 traffic?

- A. An egress-only internet gateway with a ::/0 route from the private subnets' route tables
- B. A second NAT gateway in another public subnet with a ::/0 route from the private subnets
- C. An internet gateway with a ::/0 route and security groups that block inbound IPv6 traffic
- D. A gateway VPC endpoint attached to the private route tables for the IPv6 update servers

**Answer:** A

**Explanation:** IPv6 addresses are globally routable, so NAT is not used for them; an egress-only internet gateway allows outbound IPv6 connections and their responses while blocking connections initiated from the internet.
- Second NAT gateway: NAT gateways translate IPv4 and do not provide general IPv6 egress.
- Internet gateway with security groups: the subnet becomes public for IPv6 and protection depends on every security group being correct.
- Gateway endpoint: serves S3 and DynamoDB, not internet hosts.
> 🇻🇳 IPv6 chỉ đi ra, không cho vào → Egress-Only IGW (IPv4 dùng NAT Gateway).

---

## Q ai-20261017-0823-14
- domain: performance
- task: 3.4
- topic: networking
- services: CloudFront, S3, Global Accelerator
- tags: cloudfront-origin-security
- difficulty: medium
- variant_of: 04-v1-08
- concept: CloudFront caches S3 content at the edge (lower latency + fewer origin requests) and OAC keeps the bucket private; Global Accelerator does not cache
- refs: 04-networking-services.md
- hint: Cùng một object bị tải hàng triệu lần — dịch vụ nào lưu bản sao gần người dùng thay vì chỉ tăng tốc đường truyền?
- created: 2026-10-17
- time: 100

A news website stores images, videos, and JavaScript files in an Amazon S3 bucket in us-east-1. Readers in Asia and Europe report slow page loads, and S3 request costs keep rising because the same objects are downloaded millions of times. The company also wants the bucket to stay private so that users cannot bypass the delivery layer. Which solution meets these requirements?

- A. Put AWS Global Accelerator in front of the bucket and allow only its static IP addresses in the bucket policy
- B. Create a CloudFront distribution with the bucket as the origin and restrict access with origin access control
- C. Enable S3 Cross-Region Replication to buckets in Asia and Europe and use Route 53 latency-based routing
- D. Enable S3 Transfer Acceleration on the bucket and give users the accelerated endpoint for all downloads

**Answer:** B

**Explanation:** CloudFront caches the objects at edge locations near readers, which cuts latency and the number of requests that reach S3, and origin access control keeps the bucket private behind the distribution.
- Global Accelerator: routes TCP/UDP over the AWS backbone with static IPs but does not cache, and S3 is not a supported endpoint.
- Cross-Region Replication with latency routing: copies data and adds storage cost without caching.
- Transfer Acceleration: speeds long-distance transfers, but every request still reaches S3.
> 🇻🇳 Nội dung tĩnh toàn cầu, cần cache + giữ bucket private → CloudFront + OAC.

---

## Q ai-20261017-0823-15
- domain: performance
- task: 3.4
- topic: networking
- services: Global Accelerator, NLB, CloudFront, Route 53
- tags: route53-routing
- difficulty: medium
- variant_of: 04-v1-08
- concept: Global Accelerator = 2 static anycast IPs, TCP/UDP over AWS backbone, health-check failover across Regions; CloudFront = HTTP caching
- refs: 04-networking-services.md
- hint: Giao thức UDP tự định nghĩa và đối tác cần danh sách IP cố định — dịch vụ nào cung cấp IP tĩnh toàn cầu?
- created: 2026-10-17
- time: 95

A gaming company runs a multiplayer game server fleet on EC2 instances behind Network Load Balancers in three AWS Regions. The game uses a custom UDP protocol. Players worldwide need consistent low latency, and the company's partners must allow-list a fixed set of IP addresses that does not change when traffic fails over between Regions. Which solution meets these requirements?

- A. Create a CloudFront distribution with the Network Load Balancers as origins and cache game traffic
- B. Use Route 53 latency-based routing records that point to the Network Load Balancers in each Region
- C. Create an AWS Global Accelerator accelerator with the Network Load Balancers as Regional endpoints
- D. Assign Elastic IP addresses to every game server and publish the full list of addresses to partners

**Answer:** C

**Explanation:** Global Accelerator provides two static anycast IP addresses, carries TCP and UDP traffic over the AWS global network, and fails over between Regional endpoints based on health checks, so the allow-listed IPs never change.
- CloudFront: serves HTTP/HTTPS and WebSockets, not custom UDP.
- Route 53 latency routing: returns different IPs per Region and depends on DNS caching for failover.
- Elastic IPs per server: many addresses that change as the fleet scales.
> 🇻🇳 UDP/TCP không phải HTTP + IP tĩnh toàn cầu → Global Accelerator; cache HTTP → CloudFront.
