# 🌐 Practice Exam 04 — Networking & Content Delivery (SAA-C03)

20 questions · scenario-based · English. Answers in `04-networking-services-answers.txt`.

---

**1.** EC2 instances in a private subnet must download OS patches from the internet but must NOT be reachable from the internet. What should be configured?

- A. Internet Gateway attached to the private subnet
- B. NAT Gateway in a public subnet with a route from the private subnet
- C. Egress-only Internet Gateway
- D. VPC Peering

**2.** A security team must BLOCK a specific malicious IP range from reaching all instances in a subnet. Which control is appropriate?

- A. Security Group inbound allow rule
- B. Network ACL with a deny rule
- C. IAM policy
- D. Route table blackhole

**3.** Which statement about Security Groups vs Network ACLs is correct?

- A. Security Groups are stateless; NACLs are stateful
- B. Security Groups are stateful; NACLs are stateless
- C. Both support explicit deny rules
- D. NACLs operate at the instance/ENI level

**4.** An application needs path-based routing (`/api` and `/web` to different target groups) over HTTPS. Which load balancer?

- A. Network Load Balancer
- B. Application Load Balancer
- C. Gateway Load Balancer
- D. Classic Load Balancer

**5.** A workload needs ultra-low latency, millions of requests per second, and a static IP per AZ for TCP traffic. Which load balancer?

- A. Application Load Balancer
- B. Network Load Balancer
- C. Gateway Load Balancer
- D. Classic Load Balancer

**6.** A company wants private connectivity from a VPC to Amazon S3 and DynamoDB without using the internet, at no additional cost. Which is BEST?

- A. Interface Endpoint (PrivateLink)
- B. Gateway VPC Endpoint
- C. NAT Gateway
- D. Internet Gateway

**7.** A company needs to connect 60 VPCs and its on-premises network with transitive routing and centralized management. Which service?

- A. VPC Peering mesh
- B. AWS Transit Gateway
- C. Direct Connect only
- D. PrivateLink

**8.** Static content stored in S3 must be delivered to global users with the lowest latency and cached at the edge. Which solution?

- A. S3 Cross-Region Replication
- B. Amazon CloudFront with the S3 bucket as origin
- C. AWS Global Accelerator
- D. Multi-Region Access Points only

**9.** A multiplayer game uses TCP/UDP and needs two static anycast IPs plus fast failover over the AWS backbone. Which service?

- A. Amazon CloudFront
- B. AWS Global Accelerator
- C. Route 53 latency routing
- D. Network Load Balancer only

**10.** Which Route 53 record type can be used at the zone apex (e.g., `example.com`) to point to an ALB, with no query charges and health-check support?

- A. CNAME
- B. Alias (A/AAAA)
- C. TXT
- D. NS

**11.** A company is gradually shifting traffic from an old environment to a new one (e.g., 90/10 split) for testing. Which Route 53 routing policy?

- A. Failover
- B. Weighted
- C. Geolocation
- D. Latency-based

**12.** Users must be served from the AWS Region that gives them the lowest network latency. Which Route 53 routing policy?

- A. Simple
- B. Latency-based
- C. Geolocation
- D. Multivalue answer

**13.** Restricting access so that an S3 origin can ONLY be reached through CloudFront uses which feature?

- A. Bucket ACL public-read
- B. Origin Access Control (OAC) / Origin Access Identity (OAI)
- C. Signed URLs only
- D. VPC endpoint policy

**14.** A premium video service must restrict content so only authenticated, paying users can access multiple files for a session. Which CloudFront feature?

- A. Signed URLs
- B. Signed Cookies
- C. Field-level encryption
- D. Geo restriction

**15.** An on-premises data center needs a dedicated, consistent, high-bandwidth private connection to AWS (not over the public internet). Which service?

- A. Site-to-Site VPN
- B. AWS Direct Connect
- C. AWS Client VPN
- D. Transit Gateway

**16.** A company needs to connect on-premises to AWS quickly with an encrypted IPsec tunnel as a temporary or backup link. Which service?

- A. Direct Connect
- B. Site-to-Site VPN
- C. PrivateLink
- D. CloudFront

**17.** A SaaS provider wants to expose its application privately to many customer VPCs without VPC peering or exposing it to the internet. Which service?

- A. Transit Gateway
- B. AWS PrivateLink with an endpoint service (NLB)
- C. VPC Peering
- D. NAT Gateway

**18.** A subnet `10.0.1.0/24` is created. How many usable host IP addresses are available?

- A. 256
- B. 254
- C. 251
- D. 250

**19.** Which two statements about NAT Gateway are TRUE? (Choose TWO)

- A. It must be placed in a private subnet
- B. It is deployed in a public subnet and needs an Elastic IP
- C. It is a managed, horizontally scaled service within an AZ
- D. It allows inbound connections initiated from the internet
- E. It requires you to patch the underlying instance

**20.** A web application behind an ALB must protect against SQL injection and apply rate-based rules. Which service integrates with the ALB for this?

- A. AWS Shield Standard
- B. AWS WAF
- C. Security Groups
- D. Network ACLs
