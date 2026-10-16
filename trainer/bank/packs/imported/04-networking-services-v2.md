---
pack: saa-04-networking-services-v2
title: 04 · Networking Services · V2
exam: SAA-C03
origin: imported
source: practice-exams/04-networking-services-exam-v2.md
created: 2026-10-16
---

# 04 · Networking Services · V2

> Imported from `practice-exams/04-networking-services-exam-v2.md` + `04-networking-services-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 04-v2-01
- domain: performance
- topic: networking
- services: NAT Gateway, EC2
- tags: subnets
- difficulty: medium
- time: 55
- source: practice-exams/04-networking-services-exam-v2.md#Q1

Private-subnet EC2 instances need outbound internet access to download patches but must not be reachable from the internet. Which component?

- A. Internet Gateway on the private subnet
- B. NAT Gateway in a public subnet
- C. VPC Peering
- D. Egress-Only Internet Gateway

**Answer:** B

**Explanation:** Private subnet outbound only = NAT Gateway in public subnet.

---

## Q 04-v2-02
- domain: secure
- topic: networking
- tags: security-groups
- difficulty: medium
- time: 50
- source: practice-exams/04-networking-services-exam-v2.md#Q2

A stateful firewall that allows return traffic automatically and is applied at the instance level. Which is it?

- A. Network ACL
- B. Security Group
- C. AWS WAF
- D. Route table

**Answer:** B

**Explanation:** Stateful, instance-level, auto return traffic = Security Group.

---

## Q 04-v2-03
- domain: performance
- topic: networking
- services: ALB, ELB
- tags: tls-termination, elb-features
- difficulty: medium
- time: 50
- source: practice-exams/04-networking-services-exam-v2.md#Q3

An application must distribute HTTP/HTTPS traffic with path-based and host-based routing. Which load balancer?

- A. Network Load Balancer
- B. Application Load Balancer
- C. Gateway Load Balancer
- D. Classic Load Balancer

**Answer:** B

**Explanation:** HTTP/HTTPS path & host routing (Layer 7) = Application Load Balancer.

---

## Q 04-v2-04
- domain: performance
- topic: networking
- services: NLB, ELB
- difficulty: medium
- time: 55
- source: practice-exams/04-networking-services-exam-v2.md#Q4

A workload needs extreme performance, millions of requests/sec, static IPs, and TCP/UDP load balancing. Which load balancer?

- A. Application Load Balancer
- B. Network Load Balancer
- C. Gateway Load Balancer
- D. Classic Load Balancer

**Answer:** B

**Explanation:** Millions req/sec, static IP, TCP/UDP (Layer 4) = Network Load Balancer.

---

## Q 04-v2-05
- domain: performance
- topic: networking
- services: VPC Endpoint, VPC, S3, NAT Gateway
- difficulty: medium
- time: 55
- source: practice-exams/04-networking-services-exam-v2.md#Q5

A company wants to privately connect its VPC to S3 without traversing the internet or a NAT Gateway. Which endpoint?

- A. Interface endpoint (PrivateLink)
- B. Gateway VPC endpoint
- C. NAT Gateway
- D. Internet Gateway

**Answer:** B

**Explanation:** Private access to S3 (and DynamoDB) with no NAT = Gateway VPC endpoint.

---

## Q 04-v2-06
- domain: performance
- topic: networking
- services: PrivateLink, VPC, SQS
- difficulty: medium
- time: 55
- source: practice-exams/04-networking-services-exam-v2.md#Q6

A VPC must privately reach an AWS service like SQS or a partner service using an ENI with a private IP. Which endpoint type?

- A. Gateway endpoint
- B. Interface endpoint (PrivateLink)
- C. VPC peering
- D. Transit Gateway

**Answer:** B

**Explanation:** Private access via ENI to AWS/partner services = Interface endpoint (PrivateLink).

---

## Q 04-v2-07
- domain: performance
- topic: networking
- services: VPC Peering
- difficulty: medium
- time: 50
- source: practice-exams/04-networking-services-exam-v2.md#Q7

Two VPCs in different accounts must communicate privately with non-overlapping CIDRs, without transitive routing. Which is SIMPLEST?

- A. VPC Peering
- B. Transit Gateway
- C. Internet Gateway
- D. VPN

**Answer:** A

**Explanation:** Two VPCs, non-overlapping, simplest, no transitive = VPC Peering.

---

## Q 04-v2-08
- domain: performance
- topic: networking
- services: Transit Gateway
- difficulty: medium
- time: 50
- source: practice-exams/04-networking-services-exam-v2.md#Q8

Dozens of VPCs and on-premises networks must interconnect through a single hub with transitive routing. Which service?

- A. VPC Peering mesh
- B. AWS Transit Gateway
- C. NAT Gateway
- D. Internet Gateway

**Answer:** B

**Explanation:** Many VPCs + on-prem hub with transitive routing = Transit Gateway.

---

## Q 04-v2-09
- domain: performance
- topic: networking
- services: Direct Connect
- difficulty: medium
- time: 50
- source: practice-exams/04-networking-services-exam-v2.md#Q9

A company needs a private, dedicated, consistent-bandwidth connection from on-premises to AWS. Which service?

- A. Site-to-Site VPN
- B. AWS Direct Connect
- C. Transit Gateway
- D. CloudFront

**Answer:** B

**Explanation:** Private dedicated consistent-bandwidth line = Direct Connect.

---

## Q 04-v2-10
- domain: performance
- topic: networking
- services: Site-to-Site VPN
- difficulty: medium
- time: 50
- source: practice-exams/04-networking-services-exam-v2.md#Q10

A quick, encrypted connection from on-premises to AWS over the public internet is needed within hours. Which service?

- A. Direct Connect
- B. Site-to-Site VPN
- C. PrivateLink
- D. Global Accelerator

**Answer:** B

**Explanation:** Quick encrypted tunnel over internet = Site-to-Site VPN.

---

## Q 04-v2-11
- domain: performance
- topic: networking
- services: CloudFront
- difficulty: medium
- time: 50
- source: practice-exams/04-networking-services-exam-v2.md#Q11

A global website must cache static content near users to reduce latency. Which service?

- A. CloudFront
- B. Global Accelerator
- C. Route 53
- D. ELB

**Answer:** A

**Explanation:** Cache static content near users = CloudFront.

---

## Q 04-v2-12
- domain: performance
- topic: networking
- services: Global Accelerator
- difficulty: medium
- time: 55
- source: practice-exams/04-networking-services-exam-v2.md#Q12

A company needs to route users to the nearest healthy Regional endpoint using AWS's global network with static anycast IPs. Which service?

- A. CloudFront
- B. AWS Global Accelerator
- C. Route 53 latency routing
- D. Transit Gateway

**Answer:** B

**Explanation:** Nearest healthy Region via AWS network + anycast static IPs = Global Accelerator.

---

## Q 04-v2-13
- domain: performance
- topic: networking
- services: Route 53
- difficulty: medium
- time: 50
- source: practice-exams/04-networking-services-exam-v2.md#Q13

DNS must route users to different Regions based on lowest latency. Which Route 53 routing policy?

- A. Simple
- B. Weighted
- C. Latency-based
- D. Failover

**Answer:** C

**Explanation:** Route by lowest latency = Latency-based routing.

---

## Q 04-v2-14
- domain: performance
- topic: networking
- services: Route 53
- difficulty: medium
- time: 50
- source: practice-exams/04-networking-services-exam-v2.md#Q14

Route 53 must send 90% of traffic to one version and 10% to another for testing. Which policy?

- A. Weighted
- B. Geolocation
- C. Failover
- D. Multivalue

**Answer:** A

**Explanation:** 90/10 traffic split for testing = Weighted routing.

---

## Q 04-v2-15
- domain: secure
- topic: networking
- services: Route 53
- tags: compliance
- difficulty: medium
- time: 50
- source: practice-exams/04-networking-services-exam-v2.md#Q15

Route 53 must direct users in Europe to EU servers for compliance. Which policy?

- A. Latency
- B. Geolocation
- C. Weighted
- D. Simple

**Answer:** B

**Explanation:** Route by user location/compliance = Geolocation routing.

---

## Q 04-v2-16
- domain: performance
- topic: networking
- tags: subnets, nacl
- difficulty: medium
- time: 50
- source: practice-exams/04-networking-services-exam-v2.md#Q16

A subnet-level, stateless firewall controlling inbound/outbound traffic with explicit allow/deny rules. Which is it?

- A. Security Group
- B. Network ACL
- C. AWS WAF
- D. Route 53 Resolver

**Answer:** B

**Explanation:** Subnet-level stateless allow/deny = Network ACL.

---

## Q 04-v2-17
- domain: performance
- topic: networking
- services: VPC, VPC Flow Logs
- difficulty: medium
- time: 55
- source: practice-exams/04-networking-services-exam-v2.md#Q17

A company needs to troubleshoot why traffic is being dropped by capturing accepted/rejected IP traffic metadata in a VPC. Which feature?

- A. CloudTrail
- B. VPC Flow Logs
- C. GuardDuty
- D. Route 53 logs

**Answer:** B

**Explanation:** Capture accept/reject IP traffic metadata = VPC Flow Logs.

---

## Q 04-v2-18
- domain: performance
- topic: networking
- services: ACM, ALB
- tags: tls-termination
- difficulty: medium
- time: 55
- source: practice-exams/04-networking-services-exam-v2.md#Q18

An ALB must terminate HTTPS and present a certificate managed and auto-renewed by AWS. Which service provides the certificate?

- A. AWS KMS
- B. AWS Certificate Manager (ACM)
- C. IAM server certificate
- D. Secrets Manager

**Answer:** B

**Explanation:** AWS-managed auto-renewing TLS cert for ALB = ACM.

---

## Q 04-v2-19
- domain: performance
- topic: networking
- services: Internet Gateway
- tags: ipv6, subnets, egress-only-igw
- difficulty: medium
- time: 55
- source: practice-exams/04-networking-services-exam-v2.md#Q19

An IPv6-only workload in a private subnet needs outbound internet access but must not accept inbound connections. Which component?

- A. NAT Gateway
- B. Egress-Only Internet Gateway
- C. Internet Gateway
- D. VPC endpoint

**Answer:** B

**Explanation:** IPv6 outbound-only, no inbound = Egress-Only Internet Gateway.

---

## Q 04-v2-20
- domain: performance
- topic: networking
- services: NLB
- difficulty: medium
- time: 60
- source: practice-exams/04-networking-services-exam-v2.md#Q20

An NLB must forward traffic to targets while preserving the client's source IP. Which is TRUE?

- A. NLB always hides the client IP
- B. NLB preserves the source IP by default for instance targets
- C. Only ALB preserves source IP
- D. Source IP requires a NAT Gateway

**Answer:** B

**Explanation:** NLB preserves client source IP by default (instance targets).

---

## Q 04-v2-21
- domain: performance
- topic: networking
- services: Route 53 Resolver, VPC
- difficulty: hard
- time: 95
- source: practice-exams/04-networking-services-exam-v2.md#Q21

On-premises servers must resolve DNS records in a private hosted zone in a VPC, and VPC resources must resolve on-premises names. Which two are needed? (Choose TWO)

- A. Route 53 Resolver inbound endpoint
- B. Route 53 Resolver outbound endpoint with forwarding rules
- C. Public hosted zone
- D. CloudFront
- E. NAT Gateway

**Answer:** A, B

**Explanation:** Hybrid DNS = Route 53 Resolver inbound + outbound endpoints with forwarding rules.

---

## Q 04-v2-22
- domain: performance
- topic: networking
- services: GWLB, VPC, ELB
- difficulty: hard
- time: 75
- source: practice-exams/04-networking-services-exam-v2.md#Q22

A traffic-inspection appliance fleet must transparently inspect all north-south VPC traffic and scale horizontally. Which load balancer + integration is designed for this?

- A. ALB with sticky sessions
- B. Gateway Load Balancer with GENEVE-based appliances
- C. NLB with TLS termination
- D. Classic Load Balancer

**Answer:** B

**Explanation:** Transparent scalable traffic inspection = Gateway Load Balancer (GENEVE).

---

## Q 04-v2-23
- domain: performance
- topic: networking
- services: PrivateLink, VPC Endpoint, VPC Peering
- difficulty: hard
- time: 75
- source: practice-exams/04-networking-services-exam-v2.md#Q23

A SaaS provider wants to expose its service privately to thousands of customer VPCs without VPC peering or exposing it to the internet. Which service?

- A. Transit Gateway
- B. AWS PrivateLink (VPC endpoint service + interface endpoints)
- C. VPC Peering
- D. Direct Connect

**Answer:** B

**Explanation:** Expose SaaS privately to many VPCs = AWS PrivateLink (endpoint service).

---

## Q 04-v2-24
- domain: resilient
- topic: networking
- services: Site-to-Site VPN, Direct Connect
- tags: encryption-in-transit
- difficulty: hard
- time: 100
- source: practice-exams/04-networking-services-exam-v2.md#Q24

Direct Connect provides private connectivity, but the company also needs encryption in transit and a backup path. Which two apply? (Choose TWO)

- A. Run an IPsec Site-to-Site VPN over the Direct Connect (or a public VIF)
- B. Direct Connect is encrypted by default
- C. Configure a Site-to-Site VPN as a failover backup
- D. Use CloudFront for encryption
- E. Enable NACL logging

**Answer:** A, C

**Explanation:** Encrypt DX in transit = IPsec VPN over DX; add Site-to-Site VPN as failover backup.

---

## Q 04-v2-25
- domain: performance
- topic: networking
- services: PrivateLink, VPC Peering
- difficulty: hard
- time: 75
- source: practice-exams/04-networking-services-exam-v2.md#Q25

Two VPCs with OVERLAPPING CIDR blocks must share access to specific services. VPC peering is not possible. Which approach works?

- A. VPC peering with route tables
- B. AWS PrivateLink to expose specific endpoints (no full network merge)
- C. Transit Gateway with the same CIDRs
- D. Merge the CIDR blocks

**Answer:** B

**Explanation:** Overlapping CIDRs, expose specific services = AWS PrivateLink.

---

## Q 04-v2-26
- domain: performance
- topic: networking
- services: CloudFront
- tags: signed-urls-cookies
- difficulty: hard
- time: 90
- source: practice-exams/04-networking-services-exam-v2.md#Q26

A CloudFront distribution must serve private content so users can only access files via signed, time-limited access. Which two mechanisms? (Choose TWO)

- A. CloudFront signed URLs
- B. CloudFront signed cookies
- C. Public S3 bucket
- D. NAT Gateway
- E. VPC endpoint policy

**Answer:** A, B

**Explanation:** Private CloudFront content = signed URLs + signed cookies.

---

## Q 04-v2-27
- domain: performance
- topic: networking
- services: ALB
- tags: elb-features
- difficulty: hard
- time: 75
- source: practice-exams/04-networking-services-exam-v2.md#Q27

An application behind an ALB must ensure requests from the same user go to the same target for session state. Which feature?

- A. NLB source IP preservation
- B. ALB sticky sessions (session affinity)
- C. Route 53 failover
- D. Cross-zone load balancing off

**Answer:** B

**Explanation:** Same user to same target = ALB sticky sessions.

---

## Q 04-v2-28
- domain: performance
- topic: networking
- services: Transit Gateway, RAM
- difficulty: hard
- time: 100
- source: practice-exams/04-networking-services-exam-v2.md#Q28

A company must connect 200 VPCs across multiple accounts and Regions with centralized routing and the ability to share the connectivity across accounts. Which two? (Choose TWO)

- A. Transit Gateway with inter-Region peering
- B. Share the Transit Gateway via AWS RAM
- C. Full-mesh VPC peering
- D. One NAT Gateway per VPC
- E. Internet Gateway per account

**Answer:** A, B

**Explanation:** 200 VPCs multi-account/Region = Transit Gateway inter-Region peering + share via AWS RAM.

---

## Q 04-v2-29
- domain: performance
- topic: networking
- services: CloudFront, S3
- tags: cloudfront-origin-security
- difficulty: hard
- time: 75
- source: practice-exams/04-networking-services-exam-v2.md#Q29

A CloudFront origin is an S3 bucket that must NOT be publicly accessible; only CloudFront may fetch objects. Which is BEST?

- A. Make the bucket public
- B. Origin Access Control (OAC) restricting the bucket to the distribution
- C. Signed URLs on the bucket
- D. NAT Gateway in front of S3

**Answer:** B

**Explanation:** Restrict S3 origin to CloudFront only = Origin Access Control (OAC).

---

## Q 04-v2-30
- domain: performance
- topic: networking
- services: Global Accelerator
- tags: ttl
- difficulty: hard
- time: 75
- source: practice-exams/04-networking-services-exam-v2.md#Q30

A latency-sensitive gaming app needs fast regional failover with static entry IPs and instant traffic shifting between endpoints without DNS TTL delays. Which service is BEST?

- A. Route 53 failover (relies on DNS TTL)
- B. AWS Global Accelerator
- C. CloudFront
- D. Transit Gateway

**Answer:** B

**Explanation:** Static IP + instant failover without DNS TTL = Global Accelerator.
