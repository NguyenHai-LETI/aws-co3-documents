---
pack: saa-04-networking-services-v1
title: 04 · Networking & Content Delivery · V1
exam: SAA-C03
origin: imported
source: practice-exams/04-networking-services-exam.md
created: 2026-10-16
---

# 04 · Networking & Content Delivery · V1

> Imported from `practice-exams/04-networking-services-exam.md` + `04-networking-services-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 04-v1-01
- domain: performance
- task: 3.4
- topic: networking
- services: NAT Gateway, EC2
- tags: subnets
- difficulty: easy
- time: 55
- source: practice-exams/04-networking-services-exam.md#Q1

EC2 instances in a private subnet must download OS patches from the internet but must NOT be reachable from the internet. What should be configured?

- A. Egress-only Internet Gateway
- B. VPC Peering
- C. NAT Gateway in a public subnet with a route from the private subnet
- D. Internet Gateway attached to the private subnet

**Answer:** C

**Explanation:** Outbound-only internet for private subnet = NAT Gateway in public subnet + route.

---

## Q 04-v1-02
- domain: secure
- task: 1.2
- topic: networking
- tags: threat-detection, subnets, nacl
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q2

A security team must BLOCK a specific malicious IP range from reaching all instances in a subnet. Which control is appropriate?

- A. Route table blackhole
- B. IAM policy
- C. Security Group inbound allow rule
- D. Network ACL with a deny rule

**Answer:** D

**Explanation:** Block a specific IP range at subnet level = NACL deny rule (SG has no deny).

---

## Q 04-v1-03
- domain: secure
- task: 1.2
- topic: networking
- tags: security-groups, nacl
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q3

Which statement about Security Groups vs Network ACLs is correct?

- A. Security Groups are stateless; NACLs are stateful
- B. NACLs operate at the instance/ENI level
- C. Security Groups are stateful; NACLs are stateless
- D. Both support explicit deny rules

**Answer:** C

**Explanation:** Security Groups stateful; NACLs stateless.

---

## Q 04-v1-04
- domain: performance
- task: 3.4
- topic: networking
- services: ALB, ELB
- tags: elb-features, tls-termination
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q4

An application needs path-based routing (`/api` and `/web` to different target groups) over HTTPS. Which load balancer?

- A. Network Load Balancer
- B. Classic Load Balancer
- C. Application Load Balancer
- D. Gateway Load Balancer

**Answer:** C

**Explanation:** HTTP(S) path-based routing = Application Load Balancer.

---

## Q 04-v1-05
- domain: performance
- task: 3.4
- topic: networking
- services: NLB, ELB
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q5

A workload needs ultra-low latency, millions of requests per second, and a static IP per AZ for TCP traffic. Which load balancer?

- A. Network Load Balancer
- B. Application Load Balancer
- C. Classic Load Balancer
- D. Gateway Load Balancer

**Answer:** A

**Explanation:** Ultra-low latency, millions rps, static IP, TCP = Network Load Balancer.

---

## Q 04-v1-06
- domain: cost
- task: 4.4
- topic: networking
- services: VPC Endpoint, VPC, S3, DynamoDB
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q6

A company wants private connectivity from a VPC to Amazon S3 and DynamoDB without using the internet, at no additional cost. Which is BEST?

- A. Internet Gateway
- B. NAT Gateway
- C. Interface Endpoint (PrivateLink)
- D. Gateway VPC Endpoint

**Answer:** D

**Explanation:** Free private access to S3/DynamoDB = Gateway VPC Endpoint.

---

## Q 04-v1-07
- domain: performance
- task: 3.4
- topic: networking
- services: Transit Gateway
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q7

A company needs to connect 60 VPCs and its on-premises network with transitive routing and centralized management. Which service?

- A. Direct Connect only
- B. AWS Transit Gateway
- C. VPC Peering mesh
- D. PrivateLink

**Answer:** B

**Explanation:** Many VPCs + on-prem, transitive, central = Transit Gateway.

---

## Q 04-v1-08
- domain: performance
- task: 3.4
- topic: networking
- services: CloudFront, S3
- difficulty: easy
- time: 50
- source: practice-exams/04-networking-services-exam.md#Q8

Static content stored in S3 must be delivered to global users with the lowest latency and cached at the edge. Which solution?

- A. Amazon CloudFront with the S3 bucket as origin
- B. S3 Cross-Region Replication
- C. Multi-Region Access Points only
- D. AWS Global Accelerator

**Answer:** A

**Explanation:** Global cached static delivery = CloudFront with S3 origin.

---

## Q 04-v1-09
- domain: performance
- task: 3.4
- topic: networking
- services: Global Accelerator
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q9

A multiplayer game uses TCP/UDP and needs two static anycast IPs plus fast failover over the AWS backbone. Which service?

- A. Route 53 latency routing
- B. AWS Global Accelerator
- C. Network Load Balancer only
- D. Amazon CloudFront

**Answer:** B

**Explanation:** TCP/UDP, 2 static anycast IPs, backbone failover = Global Accelerator.

---

## Q 04-v1-10
- domain: performance
- task: 3.4
- topic: networking
- services: Route 53, ALB
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q10

Which Route 53 record type can be used at the zone apex (e.g., `example.com`) to point to an ALB, with no query charges and health-check support?

- A. Alias (A/AAAA)
- B. TXT
- C. CNAME
- D. NS

**Answer:** A

**Explanation:** Zone apex to ALB, free, health checks = Alias record.

---

## Q 04-v1-11
- domain: performance
- task: 3.4
- topic: networking
- services: Route 53
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q11

A company is gradually shifting traffic from an old environment to a new one (e.g., 90/10 split) for testing. Which Route 53 routing policy?

- A. Weighted
- B. Geolocation
- C. Latency-based
- D. Failover

**Answer:** A

**Explanation:** Percentage traffic split / A-B test = Weighted routing.

---

## Q 04-v1-12
- domain: performance
- task: 3.4
- topic: networking
- services: Route 53
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q12

Users must be served from the AWS Region that gives them the lowest network latency. Which Route 53 routing policy?

- A. Multivalue answer
- B. Geolocation
- C. Latency-based
- D. Simple

**Answer:** C

**Explanation:** Lowest network latency Region = Latency-based routing.

---

## Q 04-v1-13
- domain: performance
- task: 3.4
- topic: networking
- services: S3, CloudFront
- tags: cloudfront-origin-security
- difficulty: easy
- time: 65
- enriched: 2026-10-21
- source: practice-exams/04-networking-services-exam.md#Q13

Restricting access so that an S3 origin can ONLY be reached through CloudFront uses which feature?

- A. A VPC endpoint policy restricting which networks can reach the S3 origin directly
- B. A bucket ACL granting public-read access to the S3 origin
- C. CloudFront signed URLs restricting which viewers can request objects, with the S3 origin still open to direct requests
- D. Origin Access Control (OAC), or the older Origin Access Identity (OAI), which lets CloudFront authenticate to the S3 origin through a restrictive bucket policy

**Answer:** D

**Explanation:** Origin Access Control (or the older Origin Access Identity) lets CloudFront sign its requests to the S3 origin, and a matching bucket policy denies any request that is not signed this way — exactly the CloudFront-only restriction required.
- A VPC endpoint policy: controls access from within a VPC; it does not block public internet requests made directly to the S3 origin's public endpoint.
- A bucket ACL granting public-read: makes the origin more open, not less — the opposite of restricting access to CloudFront only.
- CloudFront signed URLs: control which viewers can request objects through CloudFront, but leave the S3 origin itself reachable directly unless paired with OAC/OAI.
> 🇻🇳 Khoá S3 origin chỉ nhận request từ CloudFront cần OAC/OAI + bucket policy; signed URL chỉ kiểm soát phía viewer, không khoá origin.

---

## Q 04-v1-14
- domain: secure
- task: 1.2
- topic: networking
- services: CloudFront
- tags: signed-urls-cookies
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q14

A premium video service must restrict content so only authenticated, paying users can access multiple files for a session. Which CloudFront feature?

- A. Signed Cookies
- B. Geo restriction
- C. Signed URLs
- D. Field-level encryption

**Answer:** A

**Explanation:** Restrict multiple files per session = Signed Cookies (single file = Signed URL).

---

## Q 04-v1-15
- domain: performance
- task: 3.4
- topic: networking
- services: Direct Connect
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q15

An on-premises data center needs a dedicated, consistent, high-bandwidth private connection to AWS (not over the public internet). Which service?

- A. Transit Gateway
- B. AWS Client VPN
- C. AWS Direct Connect
- D. Site-to-Site VPN

**Answer:** C

**Explanation:** Dedicated private high-bandwidth link = Direct Connect.

---

## Q 04-v1-16
- domain: performance
- task: 3.4
- topic: networking
- services: Site-to-Site VPN
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q16

A company needs to connect on-premises to AWS quickly with an encrypted IPsec tunnel as a temporary or backup link. Which service?

- A. CloudFront
- B. Direct Connect
- C. PrivateLink
- D. Site-to-Site VPN

**Answer:** D

**Explanation:** Quick encrypted IPsec tunnel/backup = Site-to-Site VPN.

---

## Q 04-v1-17
- domain: performance
- task: 3.4
- topic: networking
- services: PrivateLink, NLB, VPC Peering
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q17

A SaaS provider wants to expose its application privately to many customer VPCs without VPC peering or exposing it to the internet. Which service?

- A. VPC Peering
- B. AWS PrivateLink with an endpoint service (NLB)
- C. Transit Gateway
- D. NAT Gateway

**Answer:** B

**Explanation:** Expose service privately to many VPCs = PrivateLink endpoint service (NLB).

---

## Q 04-v1-18
- domain: performance
- task: 3.4
- topic: networking
- tags: subnets
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q18

A subnet `10.0.1.0/24` is created. How many usable host IP addresses are available?

- A. 250
- B. 251
- C. 256
- D. 254

**Answer:** B

**Explanation:** /24 = 256 - 5 reserved = 251 usable.

---

## Q 04-v1-19
- domain: performance
- task: 3.4
- topic: networking
- services: NAT Gateway
- tags: subnets, elastic-ip
- difficulty: medium
- time: 85
- source: practice-exams/04-networking-services-exam.md#Q19

Which two statements about NAT Gateway are TRUE? (Choose TWO)

- A. It must be placed in a private subnet
- B. It allows inbound connections initiated from the internet
- C. It is a managed, horizontally scaled service within an AZ
- D. It is deployed in a public subnet and needs an Elastic IP
- E. It requires you to patch the underlying instance

**Answer:** C, D

**Explanation:** NAT GW lives in public subnet w/ EIP and is managed/HA within an AZ.

---

## Q 04-v1-20
- domain: secure
- task: 1.2
- topic: networking
- services: WAF, ALB
- tags: web-attacks
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q20

A web application behind an ALB must protect against SQL injection and apply rate-based rules. Which service integrates with the ALB for this?

- A. Network ACLs
- B. AWS WAF
- C. AWS Shield Standard
- D. Security Groups

**Answer:** B

**Explanation:** SQLi + rate-based rules on ALB = AWS WAF.
