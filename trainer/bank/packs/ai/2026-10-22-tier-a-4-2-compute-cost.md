---
pack: ai-2026-10-22-tier-a-4-2
title: "AI · Tầng A · Task 4.2 — Compute tối ưu chi phí"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 4.2"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 4.2: edge, Outposts, load balancer, Spot, Savings Plans, Compute Optimizer, Graviton, Lambda, hibernation"
---

# AI · Tầng A · Task 4.2 — Compute tối ưu chi phí

## Q ai-20261022-a42-01
- domain: cost
- task: 4.2
- topic: networking
- services: CloudFront, Lambda
- tags: lambda-edge, serverless-cost
- difficulty: medium
- skills: 4.2.k5
- concept: Lightweight viewer-event logic (rewrites, headers, cache key normalization) is cheapest and fastest with CloudFront Functions, not Lambda@Edge
- refs: 04-networking-services.md, C-kien-truc-web-app.md
- hint: Logic vài dòng chạy trước khi tra cache, không gọi dịch vụ ngoài — loại hàm edge nào rẻ nhất cho hàng trăm triệu request?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 105

A media company serves a marketing site and a product-image catalog through Amazon CloudFront, about 400 million requests a day. For every viewer request the company must rewrite legacy URL paths to new paths and normalize the query string to improve the cache hit ratio, and every response must carry security headers. The logic is a few lines of JavaScript, calls no external services, and must add minimal latency. Which solution will meet these requirements MOST cost-effectively?

- A. Run the rewrite and header logic on the origin web servers behind CloudFront and scale the origin fleet out to absorb the extra work
- B. Associate CloudFront Functions with the viewer request and viewer response events of the distribution
- C. Associate Lambda@Edge functions with the origin request and origin response events of the CloudFront distribution
- D. Associate Lambda@Edge functions with the viewer request and viewer response events of the CloudFront distribution

**Answer:** B

**Explanation:** CloudFront Functions suit short, lightweight logic such as URL rewrites, cache key normalization and header changes at the viewer events, at a fraction of the price of Lambda@Edge.
- Origin servers: query-string normalization after the cache lookup does not raise the hit ratio and adds origin load (đặt sai chỗ).
- Lambda@Edge on origin events: runs only on cache misses, after the cache key is set (đặt sai chỗ).
- Lambda@Edge on viewer events: works but is billed per request and duration at a higher price (tốn chi phí hơn).
Docs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/edge-functions-choosing.html
> 🇻🇳 Logic nhẹ ở viewer request/response (rewrite, header, cache key) → CloudFront Functions rẻ hơn Lambda@Edge.

---

## Q ai-20261022-a42-02
- domain: cost
- task: 4.2
- topic: compute
- services: Outposts, ECS, EC2
- tags: outposts, hybrid-compute
- difficulty: medium
- skills: 4.2.k6
- concept: Outposts servers (1U/2U) fit small sites that need local compute with Region APIs; racks are for larger capacity
- refs: 13-other-services.md, D-kien-truc-luu-tru.md
- hint: 250 địa điểm nhỏ, không có chỗ đặt tủ rack, cần chạy cục bộ khi mất WAN — form factor nào của Outposts?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 105

A restaurant chain runs point-of-sale and kitchen-display applications in 250 locations. Each location needs a few containerized workloads that must respond within single-digit milliseconds to on-site devices and keep running when the WAN link to the AWS Region is down. The company wants the same AWS APIs and tooling it uses in the Region and AWS-managed hardware, but the restaurants have no space for full racks. Which solution will meet these requirements MOST cost-effectively?

- A. Deploy AWS Outposts servers at each location and run the containers on Amazon ECS on the Outposts servers
- B. Deploy an AWS Outposts rack at each location and run the containers on Amazon ECS on the rack
- C. Run the containers in an AWS Local Zone and connect each location with a Site-to-Site VPN connection
- D. Run the containers in the AWS Region and connect each location with an AWS Direct Connect connection

**Answer:** A

**Explanation:** Outposts servers are 1U or 2U units for sites with limited space and smaller capacity, run EC2 and ECS locally with Region APIs, and avoid buying a rack per restaurant.
- Outposts rack per location: needs a 42U rack, which the sites cannot host and which costs more than needed (vi phạm ràng buộc).
- Local Zone: not on the premises and depends on the WAN for local operation (vi phạm ràng buộc).
- Region with Direct Connect: adds WAN latency and stops working when the link is down (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/outposts/latest/userguide/what-is-outposts.html
> 🇻🇳 Site nhỏ, thiếu chỗ đặt rack, cần chạy cục bộ → Outposts servers (1U/2U), không phải Outposts rack.

---

## Q ai-20261022-a42-03
- domain: cost
- task: 4.2
- topic: networking
- services: ALB, NLB, GWLB, ECS, ACM
- tags: elb-features, tls-termination
- difficulty: easy
- time: 100
- skills: 4.2.s1
- concept: One ALB with host-based listener rules replaces many per-service ALBs; NLB cannot route by hostname and GWLB is for appliances
- refs: 04-networking-services.md, C-kien-truc-web-app.md
- hint: Nhiều tên miền HTTPS, mỗi dịch vụ một load balancer ít tải — loại LB nào định tuyến theo hostname trên một bộ cân bằng duy nhất?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A software company hosts 14 containerized microservices on Amazon ECS. Each service is exposed to customers over HTTPS on its own hostname, for example billing.example.com, and each currently has a dedicated internet-facing load balancer that is lightly used. The company wants to cut load balancing cost without changing the hostnames, adding servers, or modifying service code, and must keep TLS termination with certificates from AWS Certificate Manager (ACM). Which solution will meet these requirements MOST cost-effectively?

- A. Replace the load balancers with one Network Load Balancer whose TLS listener holds an ACM certificate for each hostname
- B. Replace the load balancers with Amazon ECS Service Connect and publish each service on its own hostname through it
- C. Keep the existing load balancers and put one Amazon CloudFront distribution with alternate domain names in front of them
- D. Consolidate the services behind one Application Load Balancer with host-based listener rules and a target group for each

**Answer:** D

**Explanation:** An Application Load Balancer routes by host header to separate target groups and terminates HTTPS with ACM certificates, so one load balancer replaces fourteen.
- One NLB with a TLS listener: can present several certificates, but a listener forwards to one target group and cannot route by hostname (dùng sai tính năng).
- ECS Service Connect: service-to-service traffic inside a namespace, not internet-facing HTTPS endpoints (dùng sai tính năng).
- CloudFront in front of the balancers: keeps all fourteen balancers and adds a bill (tốn chi phí hơn).
Docs: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html
> 🇻🇳 Nhiều dịch vụ HTTP(S) theo hostname → gom về một ALB với host-based rule, tiết kiệm phí load balancer.

---

## Q ai-20261022-a42-04
- domain: cost
- task: 4.2
- topic: networking
- services: ALB, NLB, GWLB
- tags: elb-features
- difficulty: medium
- time: 165
- skills: 4.2.s1
- concept: Choose each load balancer by protocol layer: ALB for HTTP routing, NLB for UDP and static IPs, GWLB for transparent appliances
- refs: 04-networking-services.md, Q-service-comparisons.md
- hint: Mỗi tầng một loại LB theo giao thức: HTTP theo đường dẫn, UDP + IP cố định, và chèn thiết bị kiểm tra trong suốt.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A gaming company is moving a multiplayer platform to AWS. The platform has three tiers in one VPC. The first is a set of HTTPS REST services that must be routed by URL path to different Amazon ECS services. The second is a fleet of UDP game-session servers that clients reach through IP addresses allow-listed on partner firewalls. The third is a fleet of third-party intrusion-prevention appliances that must inspect inbound traffic transparently before it reaches the other tiers. Each tier should use the load balancer built for its protocol so that the company does not pay for unnecessary components. Which combination of choices will meet these requirements? (Choose THREE)

- A. Use an Application Load Balancer with host-based listener rules for the REST services
- B. Use an Application Load Balancer with path-based listener rules for the REST services
- C. Use a Network Load Balancer with one Elastic IP per Availability Zone for the UDP game-session servers
- D. Use a Network Load Balancer with UDP listeners behind AWS Global Accelerator for the game-session servers
- E. Use a Network Load Balancer with cross-zone load balancing turned on in front of the intrusion-prevention appliance fleet
- F. Use a Gateway Load Balancer with Gateway Load Balancer endpoints in front of the intrusion-prevention appliances

**Answer:** B, C, F

**Explanation:** ALB is the Layer 7 balancer with path rules, NLB handles UDP and supports a static Elastic IP per Availability Zone, and GWLB inserts and scales transparent appliances.
- ALB with host-based rules: routes by hostname, but the services must be routed by URL path (dùng sai tính năng).
- NLB behind Global Accelerator: works, but pays for an accelerator that the static Elastic IPs make unnecessary (tốn chi phí hơn).
- NLB in front of the appliances: it is not a transparent next hop for route tables (dùng sai tính năng).
Docs: https://docs.aws.amazon.com/elasticloadbalancing/latest/gateway/introduction.html
> 🇻🇳 ALB = HTTP theo path; NLB = UDP/TCP + Elastic IP cố định; GWLB = thiết bị kiểm tra trong suốt (GENEVE).

---

## Q ai-20261022-a42-05
- domain: cost
- task: 4.2
- topic: compute
- services: EC2 Auto Scaling, EC2, ALB
- tags: spot-instances, launch-template, high-availability
- difficulty: hard
- time: 140
- skills: 4.2.k4, 4.2.k9
- concept: A mixed instances policy with an On-Demand base, diversified Spot, price-capacity-optimized allocation and Capacity Rebalancing cuts cost while keeping availability
- refs: 01-compute-services.md, A-nen-tang-kien-truc.md
- hint: Muốn rẻ nhưng không sập khi một pool Spot biến mất — cần nền On-Demand nhỏ, đa dạng loại instance/AZ và chiến lược cấp phát đúng.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

An e-commerce company runs a stateless web tier on an Amazon EC2 Auto Scaling group behind an Application Load Balancer. All instances are On-Demand instances of a single type across three Availability Zones, and traffic peaks sharply during campaigns. The company wants to reduce compute cost, but a minimum amount of capacity must always run on instances that Amazon EC2 cannot reclaim, and the site must stay available if Spot capacity in one capacity pool disappears. Which Auto Scaling configuration will meet these requirements MOST cost-effectively?

- A. Use a mixed instances policy with no On-Demand base and Spot across several instance types in three zones, with price-capacity-optimized allocation and Capacity Rebalancing turned on
- B. Use a mixed instances policy with an On-Demand base sized for the campaign peak, Spot above it, several instance types, and price-capacity-optimized allocation
- C. Use a mixed instances policy with a small On-Demand base, Spot above it, several instance types across three zones, price-capacity-optimized allocation and Capacity Rebalancing
- D. Use a mixed instances policy with a small On-Demand base, Spot above it, the current single instance type, lowest-price allocation and Capacity Rebalancing

**Answer:** C

**Explanation:** The On-Demand base keeps a floor of capacity that EC2 cannot reclaim, diversification spreads Spot across many pools, price-capacity-optimized picks pools that are cheap and unlikely to be interrupted, and Capacity Rebalancing replaces at-risk instances early.
- No On-Demand base: every instance can be reclaimed, so there is no guaranteed floor (vi phạm ràng buộc "capacity that Amazon EC2 cannot reclaim")
- On-Demand base sized for the campaign peak: keeps the floor, but pays On-Demand prices for peak capacity (tốn chi phí hơn)
- One instance type with lowest-price: concentrates Spot capacity in the cheapest pools, so losing one pool removes much of it at once (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-best-practices.html
> 🇻🇳 Spot an toàn: nền On-Demand nhỏ + Spot đa dạng instance/AZ + price-capacity-optimized + Capacity Rebalancing.

---

## Q ai-20261022-a42-06
- domain: cost
- task: 4.2
- topic: compute
- services: ECS, Fargate, SQS
- tags: spot-instances, serverless-cost, sqs-visibility-timeout
- difficulty: hard
- time: 165
- skills: 4.2.k4, 4.2.k8
- concept: ECS capacity provider strategy with a Fargate base and Fargate Spot weight, plus SIGTERM handling for the two-minute Spot warning
- refs: 01-compute-services.md, 07-application-integration.md
- hint: Sáu task nền không được bị ngắt, phần còn lại rẻ nhất có thể — và task bị ngắt phải trả thông điệp về hàng đợi ngay.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A retailer runs a stateless order-export worker as an Amazon ECS service on AWS Fargate that polls an Amazon SQS queue. Six tasks must always run to keep the queue drained, and the service scales out to about sixty tasks during daily sales. Work is idempotent. The company wants to cut Fargate cost, but the six baseline tasks must never be interrupted, and an order held by a task that is interrupted must be retried within seconds rather than after the queue's visibility timeout expires. Which TWO actions will meet these requirements? (Choose TWO)

- A. Handle SIGTERM in the worker by returning its in-flight message to the queue immediately and finishing before the stop timeout
- B. Configure a capacity provider strategy with a base of six tasks on Fargate Spot and weight the additional tasks onto Fargate
- C. Lengthen the queue's visibility timeout to cover a Fargate Spot interruption so that the held order reappears after the task stops
- D. Handle SIGTERM in the worker by deleting its in-flight message from the queue and exiting before the stop timeout
- E. Configure a capacity provider strategy with a base of six tasks on Fargate and weight the additional tasks onto Fargate Spot

**Answer:** A, E

**Explanation:** A base of six on Fargate keeps the baseline on regular capacity while the burst runs on cheaper Fargate Spot. Fargate Spot sends a two-minute warning as SIGTERM, which lets the worker release its message immediately.
- Base of six on Fargate Spot: the baseline tasks could be interrupted (vi phạm ràng buộc).
- Longer visibility timeout: the order is retried only after the timeout expires, not within seconds (vi phạm ràng buộc).
- Deleting the message on SIGTERM: the unfinished order is lost instead of retried (dùng sai tính năng).
Docs: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html
> 🇻🇳 Base trên Fargate + phần burst trên Fargate Spot; xử lý SIGTERM trong 2 phút cảnh báo để trả message về queue ngay.

---

## Q ai-20261022-a42-07
- domain: cost
- task: 4.2
- topic: cost
- services: EC2
- tags: capacity-reservation, savings-plans, reserved-instances
- difficulty: hard
- skills: 4.2.k4
- concept: Savings Plans and regional RIs reserve no capacity; seasonal capacity assurance with no term uses On-Demand Capacity Reservations, discounted by a Savings Plan
- refs: 01-compute-services.md, L-quyet-dinh-nhanh.md
- hint: Phần mùa vụ cần đảm bảo có capacity nhưng huỷ được không phạt; phần nền cần giá rẻ và linh hoạt đổi họ instance.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A payments company runs a settlement platform on Amazon EC2 in a single Availability Zone because of a low-latency link to a partner. For three months each year volume doubles, and the company must be certain that the extra c6i capacity is available in that zone when it launches. Outside that period the extra capacity is not needed, and the company wants to release it without a termination penalty. The year-round baseline should be as inexpensive as possible, and the company may change instance families over the next three years. Which combination meets these requirements MOST cost-effectively?

- A. Create On-Demand Capacity Reservations for the seasonal capacity, cancel them after the peak, and buy a Compute Savings Plan for the baseline
- B. Purchase zonal Standard Reserved Instances for the seasonal capacity of the peak period and a Compute Savings Plan for the year-round baseline
- C. Purchase regional Convertible Reserved Instances for both the peak period capacity and the year-round baseline
- D. Buy a Compute Savings Plan large enough to cover the seasonal peak period as well as the baseline

**Answer:** A

**Explanation:** Capacity Reservations assure capacity in the zone and can be cancelled without a term, and the Compute Savings Plan discounts the baseline and applies across instance families and to the reserved capacity while it runs.
- Zonal Standard RIs for seasonal capacity: a fixed one- or three-year commitment for capacity needed three months a year (vi phạm ràng buộc).
- Regional Convertible RIs: a regional RI reserves no capacity (vi phạm ràng buộc).
- Larger Savings Plan: reserves no capacity and pays for unused commitment (vi phạm ràng buộc).
Docs: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-capacity-reservations.html
> 🇻🇳 Cần đảm bảo capacity theo mùa, huỷ không phạt → On-Demand Capacity Reservation; phần nền → Compute Savings Plan (SP không giữ capacity).

---

## Q ai-20261022-a42-08
- domain: cost
- task: 4.2
- topic: cost
- services: EC2, Cost Explorer, Organizations
- tags: savings-plans, spot-instances, reserved-instances
- difficulty: hard
- time: 145
- skills: 4.2.k4, 4.2.k2
- concept: Commit Savings Plans to the steady baseline and run fault-tolerant peaks on Spot; committing to peaks wastes the unused hours
- refs: 01-compute-services.md, A-nen-tang-kien-truc.md, L-quyet-dinh-nhanh.md
- hint: Savings Plans tính theo cam kết mỗi giờ và không chuyển giờ sau — cam kết ở mức nào, và phần đỉnh chạy trên gì?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

An analytics company's 25 AWS accounts, all in one AWS Organization, run a data-processing platform on Amazon EC2. Hourly compute spend never falls below about $50 but a nightly batch lifts it to about $150 for four hours. Engineers regularly change instance families and sometimes shift workloads between us-east-1 and eu-west-1. The batch jobs are fault tolerant. Which TWO actions will reduce compute cost the MOST while minimizing paid-for but unused commitment? (Choose TWO)

- A. In the management account, buy a Compute Savings Plan whose hourly commitment equals the nightly peak spend
- B. In the management account, buy a Compute Savings Plan whose hourly commitment equals the steady baseline spend
- C. In the management account, buy an EC2 Instance Savings Plan whose hourly commitment equals the steady baseline spend
- D. Run the nightly batch capacity on On-Demand Instances that are covered by On-Demand Capacity Reservations
- E. Run the nightly batch capacity on Spot Instances across several instance types

**Answer:** B, E

**Explanation:** A Compute Savings Plan on the steady baseline is fully used every hour and follows instance family and Region changes; the four-hour fault-tolerant peak is cheapest on diversified Spot.
- Commitment at peak spend: unused commitment is paid in each of the other 20 hours (tốn chi phí hơn).
- EC2 Instance Savings Plan: tied to one family in one Region, which engineers keep changing (vi phạm ràng buộc).
- On-Demand batch with Capacity Reservations: pays full On-Demand rates for fault-tolerant work (tốn chi phí hơn).
Docs: https://docs.aws.amazon.com/savingsplans/latest/userguide/sp-applying.html
> 🇻🇳 Cam kết Savings Plan ở mức nền ổn định (Compute SP, linh hoạt họ/Region); đỉnh chịu lỗi được thì chạy Spot.

---

## Q ai-20261022-a42-09
- domain: cost
- task: 4.2
- topic: cost
- services: Compute Optimizer, CloudWatch, Systems Manager, EC2
- tags: right-sizing
- difficulty: medium
- time: 105
- skills: 4.2.s6, 4.2.s5
- concept: Compute Optimizer analyzes memory only when the CloudWatch agent publishes it; detailed monitoring does not add memory metrics
- refs: 06-management-governance.md
- hint: Recommendation bỏ qua bộ nhớ vì EC2 mặc định không gửi metric bộ nhớ — cần thu thập bằng thành phần nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company runs about 300 Amazon EC2 instances for internal applications. CPU utilization is below 10 percent on most of them, and management wants to cut cost by right-sizing without causing out-of-memory failures. AWS Compute Optimizer is enabled, but its recommendations ignore memory because the instances publish only the default EC2 metrics. What should a solutions architect do to get memory-aware right-sizing recommendations with the LEAST operational effort?

- A. Enable detailed monitoring on the instances so that Compute Optimizer recommendations include memory utilization at one-minute granularity
- B. Activate the Compute Optimizer enhanced infrastructure metrics feature so that the recommendations take memory into account
- C. Sign in to each instance with Session Manager, install the CloudWatch agent by hand so memory utilization is published, then review the recommendations
- D. Use Systems Manager to install the CloudWatch agent so memory utilization is published, then review the recommendations

**Answer:** D

**Explanation:** Compute Optimizer analyzes memory utilization only for instances that publish it through the CloudWatch agent, and Systems Manager can install and configure the agent at scale.
- Detailed monitoring: adds one-minute granularity for existing metrics, not memory (cấu hình không tồn tại).
- Enhanced infrastructure metrics: extends the look-back period, but still has no memory data (dùng sai tính năng).
- Manual agent installation on 300 instances: publishes memory, but with far more effort (tốn vận hành hơn).
Docs: https://docs.aws.amazon.com/compute-optimizer/latest/ug/ec2-metrics-analyzed.html
> 🇻🇳 Right-sizing có tính bộ nhớ cần CloudWatch agent gửi memory metric (cài bằng Systems Manager); detailed monitoring không có memory.

---

## Q ai-20261022-a42-10
- domain: cost
- task: 4.2
- topic: compute
- services: EC2, EC2 Auto Scaling
- tags: right-sizing
- difficulty: easy
- time: 95
- skills: 4.2.k7, 4.2.s5
- concept: Graviton-based instances offer lower cost for portable workloads such as Java after arm64 validation
- refs: A-nen-tang-kien-truc.md
- hint: Ứng dụng Java chạy liên tục, bị giới hạn CPU, muốn giảm chi phí mà không viết lại — họ instance nào rẻ hơn cho cùng tải?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A company runs a Java 17 Spring Boot API on a fleet of x86 c5.2xlarge instances in an Auto Scaling group behind an Application Load Balancer. The workload is CPU-bound and runs around the clock. The team wants to reduce EC2 cost with minimal changes: no rewrite and no new platform to learn. Which solution will meet these requirements MOST cost-effectively?

- A. Update the launch template to the newer Intel-based c7i instances and keep the current x86 image after performance testing
- B. Update the launch template to AMD-based c6a instances, which cost less per hour than the Intel-based c5 instances
- C. Update the launch template to Graviton-based instances and rebuild the image for arm64 after performance testing
- D. Package the API as a container image and run it on AWS Fargate behind the load balancer instead of the Auto Scaling group

**Answer:** C

**Explanation:** Graviton-based instances cost up to 20 percent less than comparable x86 instances, and a JVM application needs only an arm64 image or AMI and testing, with no code rewrite.
- Newer Intel instances: better performance, but a smaller saving than Graviton for the same work (tốn chi phí hơn).
- AMD-based instances: cheaper than Intel, but still behind Graviton price performance (tốn chi phí hơn).
- AWS Fargate: a new platform for the team to learn, which the company ruled out (vi phạm ràng buộc).
Docs: https://aws.amazon.com/ec2/graviton/
> 🇻🇳 Java chạy liên tục, không muốn viết lại → chuyển sang instance Graviton (arm64) sau khi test; rẻ hơn x86 tương đương.

---

## Q ai-20261022-a42-11
- domain: cost
- task: 4.2
- topic: compute
- services: Lambda, Fargate, ALB
- tags: serverless-cost, lambda-concurrency
- difficulty: medium
- time: 125
- skills: 4.2.s3, 4.2.k8
- concept: Idle-most-of-the-day bursty stateless work is cheapest on Lambda with on-demand concurrency; provisioned or always-on capacity pays for idle time
- refs: 01-compute-services.md, L-quyet-dinh-nhanh.md
- hint: Rảnh phần lớn thời gian rồi bùng nổ ngắn, request ngắn và chịu được khởi động chậm — trả tiền theo lần chạy hay theo thời gian chờ?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A property-management company runs a service that generates a PDF statement whenever a tenant asks for one, stores it in Amazon S3, and returns a download link. The service is idle for most of the day and then receives bursts of hundreds of requests within a minute. Each request is stateless, finishes in under 10 seconds, uses 1 GB of memory, and tolerates a short startup delay. The service runs on Amazon ECS with AWS Fargate behind an Application Load Balancer, with a minimum of three tasks to absorb bursts. Which solution will meet these requirements MOST cost-effectively?

- A. Keep the Fargate service behind the load balancer and buy a Compute Savings Plan that covers the three-task baseline
- B. Package the code as a Lambda function and register it as a target of the load balancer with default on-demand concurrency
- C. Move the containers to an EC2 Auto Scaling group behind the load balancer with target tracking and Reserved Instances for the baseline instance
- D. Run the code as a Lambda function behind the load balancer with provisioned concurrency sized for the largest burst

**Answer:** B

**Explanation:** Lambda bills per request and duration, scales out quickly for bursts, and costs nothing while idle, which suits short stateless requests that tolerate a cold start; an Application Load Balancer can invoke a Lambda function as a target, so clients keep the same endpoint.
- Fargate with a Savings Plan: still pays for three always-on tasks and their commitment (tốn chi phí hơn)
- EC2 Auto Scaling with Reserved Instances: pays for idle baseline instances and adds management (tốn chi phí hơn)
- Provisioned concurrency for the largest burst: pays for idle provisioned capacity (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html
> 🇻🇳 Tải thưa, bùng nổ ngắn, request ngắn và stateless → Lambda làm target của ALB (trả theo lần chạy, về 0 khi rảnh), không dùng provisioned concurrency.

---

## Q ai-20261022-a42-12
- domain: cost
- task: 4.2
- topic: compute
- services: EC2 Auto Scaling, EC2
- tags: scaling-policies, reserved-instances
- difficulty: medium
- skills: 4.2.s4, 4.2.k9
- concept: Non-production workloads need lower availability: scale to zero off-hours and drop to one instance in one AZ rather than commit to idle capacity
- refs: 01-compute-services.md, A-nen-tang-kien-truc.md
- hint: Dev/test không cần HA như production và chỉ dùng giờ hành chính — cắt chi phí ở hai hướng: giờ chạy và mức dự phòng.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 130

A company's 10 non-production environments mirror production: each runs an Amazon EC2 Auto Scaling group with a minimum of three On-Demand instances spread across three Availability Zones, 24 hours a day. Developers use the environments on weekdays from 8 AM to 8 PM, and short interruptions are acceptable. Which TWO changes will reduce cost the MOST while still meeting the needs of non-production workloads? (Choose TWO)

- A. Buy three-year Standard Reserved Instances to reduce the cost of the current non-production fleet that runs through the weekday and the weekend
- B. Enable predictive scaling so that the availability of the groups follows production traffic patterns during weekday business hours
- C. Use scheduled scaling actions to set each group to zero instances outside weekday business hours
- D. Reduce each group to a minimum of one instance in one Availability Zone, because high availability is not required
- E. Run the non-production instances on Dedicated Hosts so that licensing is consolidated across the weekday workloads

**Answer:** C, D

**Explanation:** Scheduled scaling removes the off-hours capacity, which is most of the week, and one instance in one zone removes redundancy that non-production does not need.
- Three-year Reserved Instances: commit to capacity that sits idle most of the week (tốn chi phí hơn).
- Predictive scaling: non-production does not follow production traffic, and it does not remove the minimum (giải bài toán khác).
- Dedicated Hosts: no licensing need is stated and the price is higher (tốn chi phí hơn).
Docs: https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-scheduled-scaling.html
> 🇻🇳 Non-prod: scheduled scaling về 0 ngoài giờ + giảm xuống 1 instance/1 AZ (không cần HA); đừng mua RI cho phần chạy rảnh.

---

## Q ai-20261022-a42-13
- domain: cost
- task: 4.2
- topic: compute
- services: EC2 Auto Scaling, EC2
- tags: asg-warm-pool, ec2-hibernation, scaling-policies
- difficulty: hard
- time: 130
- skills: 4.2.k9, 4.2.s2
- concept: A Hibernated warm pool keeps RAM contents on EBS so slow-to-initialize instances enter service fast while compute is not billed
- refs: 01-compute-services.md
- hint: Khởi tạo mất 12 phút vì nạp dữ liệu vào RAM — trạng thái pool nào giữ lại RAM mà không tính tiền instance?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A trading analytics company runs an in-memory risk engine on an Amazon EC2 Auto Scaling group of On-Demand memory-optimized Linux instances with 64 GiB of memory each. Each instance takes about 12 minutes to load reference data into memory before it can serve requests, so the company keeps extra instances running around the clock to absorb spikes triggered by breaking news. The spikes cannot be predicted. The company wants to cut idle compute cost while still putting new capacity in service within a couple of minutes. Which solution will meet these requirements MOST cost-effectively?

- A. Add a warm pool with instances in the Stopped state and let the group draw from the pool during scale-out events
- B. Add a warm pool with instances in the Running state and keep them ready for scale-out events at any time
- C. Add a warm pool with instances in the Hibernated state and enable hibernation in the launch template
- D. Add scheduled scaling actions that add capacity shortly before each expected spike in demand

**Answer:** C

**Explanation:** Hibernation writes RAM to the encrypted EBS root volume, so a resumed instance has its reference data in memory again within minutes, while a hibernated instance incurs charges only for EBS storage and Elastic IPs, not compute. The 64 GiB instances are within the hibernation RAM limit for Linux (less than 150 GiB).
- Stopped state: instances boot fresh and must reload the 12 minutes of data (vi phạm ràng buộc)
- Running state: pays full compute for idle instances, as before (tốn chi phí hơn)
- Scheduled scaling: the spikes are not predictable (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-warm-pools.html
> 🇻🇳 Khởi tạo chậm do nạp RAM, spike không đoán trước → warm pool trạng thái Hibernated (giữ RAM trên EBS, không tính tiền compute; RAM < 150 GiB).
