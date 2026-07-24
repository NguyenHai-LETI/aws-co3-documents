# 🌐 Practice Exam 04 — Networking Services (SAA-C03) · V2

**30 questions** · scenario-based · English. Answers in `04-networking-services-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q20
- **Part B — Khó / Nâng cao:** Q21–Q30

---

## Part A — Vận dụng (20 câu)

**1.** Private-subnet EC2 instances need outbound internet access to download patches but must not be reachable from the internet. Which component?

- A. Internet Gateway on the private subnet
- B. NAT Gateway in a public subnet
- C. VPC Peering
- D. Egress-Only Internet Gateway

**2.** A stateful firewall that allows return traffic automatically and is applied at the instance level. Which is it?

- A. Network ACL
- B. Security Group
- C. AWS WAF
- D. Route table

**3.** An application must distribute HTTP/HTTPS traffic with path-based and host-based routing. Which load balancer?

- A. Network Load Balancer
- B. Application Load Balancer
- C. Gateway Load Balancer
- D. Classic Load Balancer

**4.** A workload needs extreme performance, millions of requests/sec, static IPs, and TCP/UDP load balancing. Which load balancer?

- A. Application Load Balancer
- B. Network Load Balancer
- C. Gateway Load Balancer
- D. Classic Load Balancer

**5.** A company wants to privately connect its VPC to S3 without traversing the internet or a NAT Gateway. Which endpoint?

- A. Interface endpoint (PrivateLink)
- B. Gateway VPC endpoint
- C. NAT Gateway
- D. Internet Gateway

**6.** A VPC must privately reach an AWS service like SQS or a partner service using an ENI with a private IP. Which endpoint type?

- A. Gateway endpoint
- B. Interface endpoint (PrivateLink)
- C. VPC peering
- D. Transit Gateway

**7.** Two VPCs in different accounts must communicate privately with non-overlapping CIDRs, without transitive routing. Which is SIMPLEST?

- A. VPC Peering
- B. Transit Gateway
- C. Internet Gateway
- D. VPN

**8.** Dozens of VPCs and on-premises networks must interconnect through a single hub with transitive routing. Which service?

- A. VPC Peering mesh
- B. AWS Transit Gateway
- C. NAT Gateway
- D. Internet Gateway

**9.** A company needs a private, dedicated, consistent-bandwidth connection from on-premises to AWS. Which service?

- A. Site-to-Site VPN
- B. AWS Direct Connect
- C. Transit Gateway
- D. CloudFront

**10.** A quick, encrypted connection from on-premises to AWS over the public internet is needed within hours. Which service?

- A. Direct Connect
- B. Site-to-Site VPN
- C. PrivateLink
- D. Global Accelerator

**11.** A global website must cache static content near users to reduce latency. Which service?

- A. CloudFront
- B. Global Accelerator
- C. Route 53
- D. ELB

**12.** A company needs to route users to the nearest healthy Regional endpoint using AWS's global network with static anycast IPs. Which service?

- A. CloudFront
- B. AWS Global Accelerator
- C. Route 53 latency routing
- D. Transit Gateway

**13.** DNS must route users to different Regions based on lowest latency. Which Route 53 routing policy?

- A. Simple
- B. Weighted
- C. Latency-based
- D. Failover

**14.** Route 53 must send 90% of traffic to one version and 10% to another for testing. Which policy?

- A. Weighted
- B. Geolocation
- C. Failover
- D. Multivalue

**15.** Route 53 must direct users in Europe to EU servers for compliance. Which policy?

- A. Latency
- B. Geolocation
- C. Weighted
- D. Simple

**16.** A subnet-level, stateless firewall controlling inbound/outbound traffic with explicit allow/deny rules. Which is it?

- A. Security Group
- B. Network ACL
- C. AWS WAF
- D. Route 53 Resolver

**17.** A company needs to troubleshoot why traffic is being dropped by capturing accepted/rejected IP traffic metadata in a VPC. Which feature?

- A. CloudTrail
- B. VPC Flow Logs
- C. GuardDuty
- D. Route 53 logs

**18.** An ALB must terminate HTTPS and present a certificate managed and auto-renewed by AWS. Which service provides the certificate?

- A. AWS KMS
- B. AWS Certificate Manager (ACM)
- C. IAM server certificate
- D. Secrets Manager

**19.** An IPv6-only workload in a private subnet needs outbound internet access but must not accept inbound connections. Which component?

- A. NAT Gateway
- B. Egress-Only Internet Gateway
- C. Internet Gateway
- D. VPC endpoint

**20.** An NLB must forward traffic to targets while preserving the client's source IP. Which is TRUE?

- A. NLB always hides the client IP
- B. NLB preserves the source IP by default for instance targets
- C. Only ALB preserves source IP
- D. Source IP requires a NAT Gateway

---

## Part B — Khó / Nâng cao (10 câu)

**21.** On-premises servers must resolve DNS records in a private hosted zone in a VPC, and VPC resources must resolve on-premises names. Which two are needed? (Choose TWO)

- A. Route 53 Resolver inbound endpoint
- B. Route 53 Resolver outbound endpoint with forwarding rules
- C. Public hosted zone
- D. CloudFront
- E. NAT Gateway

**22.** A traffic-inspection appliance fleet must transparently inspect all north-south VPC traffic and scale horizontally. Which load balancer + integration is designed for this?

- A. ALB with sticky sessions
- B. Gateway Load Balancer with GENEVE-based appliances
- C. NLB with TLS termination
- D. Classic Load Balancer

**23.** A SaaS provider wants to expose its service privately to thousands of customer VPCs without VPC peering or exposing it to the internet. Which service?

- A. Transit Gateway
- B. AWS PrivateLink (VPC endpoint service + interface endpoints)
- C. VPC Peering
- D. Direct Connect

**24.** Direct Connect provides private connectivity, but the company also needs encryption in transit and a backup path. Which two apply? (Choose TWO)

- A. Run an IPsec Site-to-Site VPN over the Direct Connect (or a public VIF)
- B. Direct Connect is encrypted by default
- C. Configure a Site-to-Site VPN as a failover backup
- D. Use CloudFront for encryption
- E. Enable NACL logging

**25.** Two VPCs with OVERLAPPING CIDR blocks must share access to specific services. VPC peering is not possible. Which approach works?

- A. VPC peering with route tables
- B. AWS PrivateLink to expose specific endpoints (no full network merge)
- C. Transit Gateway with the same CIDRs
- D. Merge the CIDR blocks

**26.** A CloudFront distribution must serve private content so users can only access files via signed, time-limited access. Which two mechanisms? (Choose TWO)

- A. CloudFront signed URLs
- B. CloudFront signed cookies
- C. Public S3 bucket
- D. NAT Gateway
- E. VPC endpoint policy

**27.** An application behind an ALB must ensure requests from the same user go to the same target for session state. Which feature?

- A. NLB source IP preservation
- B. ALB sticky sessions (session affinity)
- C. Route 53 failover
- D. Cross-zone load balancing off

**28.** A company must connect 200 VPCs across multiple accounts and Regions with centralized routing and the ability to share the connectivity across accounts. Which two? (Choose TWO)

- A. Transit Gateway with inter-Region peering
- B. Share the Transit Gateway via AWS RAM
- C. Full-mesh VPC peering
- D. One NAT Gateway per VPC
- E. Internet Gateway per account

**29.** A CloudFront origin is an S3 bucket that must NOT be publicly accessible; only CloudFront may fetch objects. Which is BEST?

- A. Make the bucket public
- B. Origin Access Control (OAC) restricting the bucket to the distribution
- C. Signed URLs on the bucket
- D. NAT Gateway in front of S3

**30.** A latency-sensitive gaming app needs fast regional failover with static entry IPs and instant traffic shifting between endpoints without DNS TTL delays. Which service is BEST?

- A. Route 53 failover (relies on DNS TTL)
- B. AWS Global Accelerator
- C. CloudFront
- D. Transit Gateway
