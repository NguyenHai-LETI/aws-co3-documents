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
- topic: networking
- services: NAT Gateway, EC2
- tags: subnets
- difficulty: easy
- time: 55
- source: practice-exams/04-networking-services-exam.md#Q1

EC2 instances in a private subnet must download OS patches from the internet but must NOT be reachable from the internet. What should be configured?

- A. Internet Gateway attached to the private subnet
- B. NAT Gateway in a public subnet with a route from the private subnet
- C. Egress-only Internet Gateway
- D. VPC Peering

**Answer:** B

**Explanation:** Outbound-only internet for private subnet = NAT Gateway in public subnet + route.

---

## Q 04-v1-02
- domain: secure
- topic: networking
- tags: threat-detection, subnets, nacl
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q2

A security team must BLOCK a specific malicious IP range from reaching all instances in a subnet. Which control is appropriate?

- A. Security Group inbound allow rule
- B. Network ACL with a deny rule
- C. IAM policy
- D. Route table blackhole

**Answer:** B

**Explanation:** Block a specific IP range at subnet level = NACL deny rule (SG has no deny).

---

## Q 04-v1-03
- domain: secure
- topic: networking
- tags: security-groups, nacl
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q3

Which statement about Security Groups vs Network ACLs is correct?

- A. Security Groups are stateless; NACLs are stateful
- B. Security Groups are stateful; NACLs are stateless
- C. Both support explicit deny rules
- D. NACLs operate at the instance/ENI level

**Answer:** B

**Explanation:** Security Groups stateful; NACLs stateless.

---

## Q 04-v1-04
- domain: performance
- topic: networking
- services: ALB, ELB
- tags: elb-features, tls-termination
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q4

An application needs path-based routing (`/api` and `/web` to different target groups) over HTTPS. Which load balancer?

- A. Network Load Balancer
- B. Application Load Balancer
- C. Gateway Load Balancer
- D. Classic Load Balancer

**Answer:** B

**Explanation:** HTTP(S) path-based routing = Application Load Balancer.

---

## Q 04-v1-05
- domain: performance
- topic: networking
- services: NLB, ELB
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q5

A workload needs ultra-low latency, millions of requests per second, and a static IP per AZ for TCP traffic. Which load balancer?

- A. Application Load Balancer
- B. Network Load Balancer
- C. Gateway Load Balancer
- D. Classic Load Balancer

**Answer:** B

**Explanation:** Ultra-low latency, millions rps, static IP, TCP = Network Load Balancer.

---

## Q 04-v1-06
- domain: cost
- topic: networking
- services: VPC Endpoint, VPC, S3, DynamoDB
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q6

A company wants private connectivity from a VPC to Amazon S3 and DynamoDB without using the internet, at no additional cost. Which is BEST?

- A. Interface Endpoint (PrivateLink)
- B. Gateway VPC Endpoint
- C. NAT Gateway
- D. Internet Gateway

**Answer:** B

**Explanation:** Free private access to S3/DynamoDB = Gateway VPC Endpoint.

---

## Q 04-v1-07
- domain: performance
- topic: networking
- services: Transit Gateway
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q7

A company needs to connect 60 VPCs and its on-premises network with transitive routing and centralized management. Which service?

- A. VPC Peering mesh
- B. AWS Transit Gateway
- C. Direct Connect only
- D. PrivateLink

**Answer:** B

**Explanation:** Many VPCs + on-prem, transitive, central = Transit Gateway.

---

## Q 04-v1-08
- domain: performance
- topic: networking
- services: CloudFront, S3
- difficulty: easy
- time: 50
- source: practice-exams/04-networking-services-exam.md#Q8

Static content stored in S3 must be delivered to global users with the lowest latency and cached at the edge. Which solution?

- A. S3 Cross-Region Replication
- B. Amazon CloudFront with the S3 bucket as origin
- C. AWS Global Accelerator
- D. Multi-Region Access Points only

**Answer:** B

**Explanation:** Global cached static delivery = CloudFront with S3 origin.

---

## Q 04-v1-09
- domain: performance
- topic: networking
- services: Global Accelerator
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q9

A multiplayer game uses TCP/UDP and needs two static anycast IPs plus fast failover over the AWS backbone. Which service?

- A. Amazon CloudFront
- B. AWS Global Accelerator
- C. Route 53 latency routing
- D. Network Load Balancer only

**Answer:** B

**Explanation:** TCP/UDP, 2 static anycast IPs, backbone failover = Global Accelerator.

---

## Q 04-v1-10
- domain: performance
- topic: networking
- services: Route 53, ALB
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q10

Which Route 53 record type can be used at the zone apex (e.g., `example.com`) to point to an ALB, with no query charges and health-check support?

- A. CNAME
- B. Alias (A/AAAA)
- C. TXT
- D. NS

**Answer:** B

**Explanation:** Zone apex to ALB, free, health checks = Alias record.

---

## Q 04-v1-11
- domain: performance
- topic: networking
- services: Route 53
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q11

A company is gradually shifting traffic from an old environment to a new one (e.g., 90/10 split) for testing. Which Route 53 routing policy?

- A. Failover
- B. Weighted
- C. Geolocation
- D. Latency-based

**Answer:** B

**Explanation:** Percentage traffic split / A-B test = Weighted routing.

---

## Q 04-v1-12
- domain: performance
- topic: networking
- services: Route 53
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q12

Users must be served from the AWS Region that gives them the lowest network latency. Which Route 53 routing policy?

- A. Simple
- B. Latency-based
- C. Geolocation
- D. Multivalue answer

**Answer:** B

**Explanation:** Lowest network latency Region = Latency-based routing.

---

## Q 04-v1-13
- domain: performance
- topic: networking
- services: S3, CloudFront
- tags: cloudfront-origin-security
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q13

Restricting access so that an S3 origin can ONLY be reached through CloudFront uses which feature?

- A. Bucket ACL public-read
- B. Origin Access Control (OAC) / Origin Access Identity (OAI)
- C. Signed URLs only
- D. VPC endpoint policy

**Answer:** B

**Explanation:** Lock S3 origin to CloudFront only = OAC/OAI.

---

## Q 04-v1-14
- domain: secure
- topic: networking
- services: CloudFront
- tags: signed-urls-cookies
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q14

A premium video service must restrict content so only authenticated, paying users can access multiple files for a session. Which CloudFront feature?

- A. Signed URLs
- B. Signed Cookies
- C. Field-level encryption
- D. Geo restriction

**Answer:** B

**Explanation:** Restrict multiple files per session = Signed Cookies (single file = Signed URL).

---

## Q 04-v1-15
- domain: performance
- topic: networking
- services: Direct Connect
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q15

An on-premises data center needs a dedicated, consistent, high-bandwidth private connection to AWS (not over the public internet). Which service?

- A. Site-to-Site VPN
- B. AWS Direct Connect
- C. AWS Client VPN
- D. Transit Gateway

**Answer:** B

**Explanation:** Dedicated private high-bandwidth link = Direct Connect.

---

## Q 04-v1-16
- domain: performance
- topic: networking
- services: Site-to-Site VPN
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q16

A company needs to connect on-premises to AWS quickly with an encrypted IPsec tunnel as a temporary or backup link. Which service?

- A. Direct Connect
- B. Site-to-Site VPN
- C. PrivateLink
- D. CloudFront

**Answer:** B

**Explanation:** Quick encrypted IPsec tunnel/backup = Site-to-Site VPN.

---

## Q 04-v1-17
- domain: performance
- topic: networking
- services: PrivateLink, NLB, VPC Peering
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q17

A SaaS provider wants to expose its application privately to many customer VPCs without VPC peering or exposing it to the internet. Which service?

- A. Transit Gateway
- B. AWS PrivateLink with an endpoint service (NLB)
- C. VPC Peering
- D. NAT Gateway

**Answer:** B

**Explanation:** Expose service privately to many VPCs = PrivateLink endpoint service (NLB).

---

## Q 04-v1-18
- domain: performance
- topic: networking
- tags: subnets
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q18

A subnet `10.0.1.0/24` is created. How many usable host IP addresses are available?

- A. 256
- B. 254
- C. 251
- D. 250

**Answer:** C

**Explanation:** /24 = 256 - 5 reserved = 251 usable.

---

## Q 04-v1-19
- domain: performance
- topic: networking
- services: NAT Gateway
- tags: subnets, elastic-ip
- difficulty: medium
- time: 85
- source: practice-exams/04-networking-services-exam.md#Q19

Which two statements about NAT Gateway are TRUE? (Choose TWO)

- A. It must be placed in a private subnet
- B. It is deployed in a public subnet and needs an Elastic IP
- C. It is a managed, horizontally scaled service within an AZ
- D. It allows inbound connections initiated from the internet
- E. It requires you to patch the underlying instance

**Answer:** B, C

**Explanation:** NAT GW lives in public subnet w/ EIP and is managed/HA within an AZ.

---

## Q 04-v1-20
- domain: secure
- topic: networking
- services: WAF, ALB
- tags: web-attacks
- difficulty: easy
- time: 45
- source: practice-exams/04-networking-services-exam.md#Q20

A web application behind an ALB must protect against SQL injection and apply rate-based rules. Which service integrates with the ALB for this?

- A. AWS Shield Standard
- B. AWS WAF
- C. Security Groups
- D. Network ACLs

**Answer:** B

**Explanation:** SQLi + rate-based rules on ALB = AWS WAF.
