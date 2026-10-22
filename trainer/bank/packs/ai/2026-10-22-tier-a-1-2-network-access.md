---
pack: ai-2026-10-22-tier-a-1-2
title: "AI · Tầng A · Task 1.2 — Mạng, truy cập và kết nối an toàn"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 1.2"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 1.2: NACL/SG, phân đoạn subnet, endpoint policy, EIC Endpoint/Session Manager, CloudFront OAC/VPC origin, ALB authentication, VPN/Direct Connect"
---

# AI · Tầng A · Task 1.2 — Mạng, truy cập và kết nối an toàn

## Q ai-20261022-a12-01
- domain: secure
- task: 1.2
- topic: networking
- services: VPC
- tags: nacl, security-groups, subnets
- difficulty: hard
- skills: 1.2.k3, 1.2.s1
- concept: Network ACLs are stateless; return traffic uses ephemeral destination ports, so response rules must allow the ephemeral range, not the service port
- refs: 04-networking-services.md
- hint: ACL không nhớ trạng thái — gói trả lời của kết nối TCP đi tới cổng đích nào, và rule hiện tại có cho phép cổng đó không?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A software company hardened two private subnets by replacing their default network ACLs with custom ones. An application server in subnet A calls a licensing service on TCP port 8443 that runs on an instance in subnet B. The security groups on both instances are correct and allow the traffic. Each custom network ACL has allow rules for TCP 8443 in both directions between the two subnet CIDR ranges and no other allow rules. Calls now time out. The team must restore connectivity while keeping the network ACLs as restrictive as possible. Which change will meet these requirements?

- A. Add an inbound rule to the security group of the licensing instance that allows TCP 8443 from the CIDR range of subnet A and leave the ACL entries unchanged
- B. Change the response-path entries so that outbound on subnet B and inbound on subnet A permit the ephemeral TCP range between the two subnet CIDRs
- C. Associate both subnets with the default network ACL so that traffic between the two subnets is permitted in both directions on every protocol
- D. Add a route to the route table of subnet A that sends traffic for the subnet B CIDR range to a NAT gateway in a public subnet

**Answer:** B

**Explanation:** Network ACLs are stateless, so the reply to a request on port 8443 returns to an ephemeral port that the 8443 entries do not match. Allowing the ephemeral range on the response path restores traffic without opening other ports.
- Security group rule: security groups are stateful and already allow this traffic (dùng sai tính năng)
- Default network ACL: permits every protocol and port, defeating the hardening (vi phạm ràng buộc)
- NAT gateway route: traffic inside one VPC already uses the local route (giải bài toán khác)
Docs: https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html
> 🇻🇳 NACL là stateless: phải cho phép cả dải cổng ephemeral cho chiều trả lời; security group thì stateful nên không cần.

---

## Q ai-20261022-a12-02
- domain: secure
- task: 1.2
- topic: networking
- services: VPC, NAT Gateway, Internet Gateway
- tags: subnets, egress-only-igw
- difficulty: medium
- skills: 1.2.s1, 1.2.s2
- concept: Public subnets route to an internet gateway, private app subnets use a public NAT gateway placed in a public subnet, database subnets keep only the local route
- refs: 04-networking-services.md
- hint: Mỗi tầng cần bảng định tuyến khác nhau: tầng nào có đường ra IGW, tầng nào chỉ ra ngoài qua NAT, tầng nào không có đường nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 165

A startup is building a three-tier web application in a new VPC that spans two Availability Zones. The Application Load Balancer must be the only resource reachable from the internet. The application servers must download operating system patches from the internet but must not accept any connection that is initiated from the internet. The database instances must have no route to the internet or to a NAT device. Which combination of steps will meet these requirements? (Choose THREE)

- A. Place the internet-facing ALB in public subnets whose route table sends 0.0.0.0/0 to an internet gateway attached to the VPC
- B. Create the NAT gateway in a private subnet and route the traffic of the public subnets through that gateway to the internet
- C. Place the application servers in private subnets whose route table sends 0.0.0.0/0 to a public NAT gateway in a public subnet
- D. Place the database instances in private subnets whose route tables contain just the local VPC route and no other route
- E. Add a route from the database subnets to the internet gateway and use security group rules to block inbound connections to the database instances
- F. Attach an egress-only internet gateway to the VPC and route the IPv4 patch downloads of the application servers through it

**Answer:** A, C, D

**Explanation:** The load balancer needs an internet gateway route, the application tier reaches the internet outbound through a public NAT gateway that sits in a public subnet, and the database tier keeps only the local route, so no internet path exists.
- NAT gateway in a private subnet: it has no route to the internet gateway (đặt sai chỗ)
- Internet gateway route for database subnets: creates the forbidden path (vi phạm ràng buộc)
- Egress-only internet gateway for IPv4: works for IPv6 traffic only (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html
> 🇻🇳 Public subnet → IGW; app subnet → NAT gateway đặt trong public subnet; DB subnet chỉ có route local.

---

## Q ai-20261022-a12-03
- domain: secure
- task: 1.2
- topic: networking
- services: VPC Endpoint, S3
- tags: s3-block-public-access, iam-policies
- difficulty: hard
- skills: 1.2.k2, 1.2.k3
- concept: A gateway endpoint policy limits which buckets a VPC can reach (exfiltration control); a bucket policy with aws:SourceVpce limits who can reach a bucket
- refs: 04-networking-services.md
- hint: Cần chặn đường ra tới bucket của người khác, không phải chặn người lạ vào bucket của mình — chính sách nào gắn vào endpoint?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A financial firm runs data-processing instances in private subnets. The instances read and write the firm's Amazon S3 buckets through a gateway VPC endpoint. An audit found that a compromised instance could copy data through the same endpoint to an S3 bucket that belongs to an unknown external account. The firm must close this exfiltration path, keep S3 traffic on the AWS network through the endpoint, and avoid adding proxy servers. Which solution will meet these requirements?

- A. Add a bucket policy to each of the firm's buckets that denies requests that do not arrive through the endpoint by using the aws:SourceVpce condition key
- B. Attach a security group to the gateway endpoint that allows outbound HTTPS traffic to the host names of the firm's buckets
- C. Route S3 traffic through a NAT gateway and deploy AWS Network Firewall with a domain allow list that contains the host names of the firm's buckets
- D. Attach an endpoint policy to the gateway endpoint that limits S3 actions to the ARNs of the firm's buckets and their objects

**Answer:** D

**Explanation:** An endpoint policy is evaluated for every request that uses the endpoint, so restricting its resources to the firm's bucket ARNs blocks copies to external buckets while traffic still stays on the AWS network.
- Bucket policy with aws:SourceVpce: protects the firm's buckets from outside callers but does not stop writes to other buckets (giải bài toán khác)
- Security group on the endpoint: gateway endpoints have no security groups (cấu hình không tồn tại)
- NAT gateway plus Network Firewall: abandons the endpoint and adds firewall infrastructure to run (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html
> 🇻🇳 Endpoint policy = bucket nào VPC được truy cập; bucket policy aws:SourceVpce = ai được vào bucket của mình.

---

## Q ai-20261022-a12-04
- domain: secure
- task: 1.2
- topic: networking
- services: EC2, VPC
- tags: bastion-host, iam-roles
- difficulty: medium
- skills: 1.2.k4, 1.2.s2
- concept: EC2 Instance Connect Endpoint gives IAM-authorized, CloudTrail-logged SSH to private instances without bastion, public IPs or SSM Agent
- refs: 04-networking-services.md
- hint: Instance cũ không có SSM Agent nên Session Manager loại — cần tunnel do IAM cấp quyền, không IP public, không bastion.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 130

A software company's QA environment has about 30 Linux EC2 instances in private subnets of a VPC that has no NAT gateway. Engineers reach the instances through a public bastion host with an Elastic IP address that the platform team patches monthly. Security wants to retire the bastion host, avoid public IPv4 addresses, authorize access through IAM, and record every connection attempt in AWS CloudTrail. Engineers already hold SSH key pairs for the instances. The instances use an older AMI without the Systems Manager Agent, and rebuilding images is out of scope. Which solution meets these requirements with the LEAST operational overhead?

- A. Create an EC2 Instance Connect Endpoint in the VPC, allow SSH from its security group, and grant engineers IAM permission to open tunnels
- B. Attach an IAM instance profile to the EC2 instances and create interface VPC endpoints for Systems Manager so that engineers can open Session Manager sessions
- C. Replace the single bastion host with an Auto Scaling group of bastion hosts behind a Network Load Balancer and rotate the SSH keys each quarter
- D. Create an AWS Client VPN endpoint with a security group, let engineers sign in with SAML credentials, and connect with SSH directly to the private instances

**Answer:** A

**Explanation:** EC2 Instance Connect Endpoint is an identity-aware TCP proxy: IAM permissions authorize each tunnel, CloudTrail logs every attempt, instances need no public IP or agent, and there is no bastion to patch.
- Session Manager with endpoints: requires the SSM Agent, which the older AMI lacks (vi phạm ràng buộc)
- Bastion Auto Scaling group: still public, still patched and key-managed (tốn vận hành hơn)
- Client VPN: authorizes with the SAML provider, not IAM, and CloudTrail does not log each SSH connection (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-with-ec2-instance-connect-endpoint.html
> 🇻🇳 Không bastion, không IP public, IAM + CloudTrail, máy không có SSM Agent → EC2 Instance Connect Endpoint.

---

## Q ai-20261022-a12-05
- domain: secure
- task: 1.2
- topic: management
- services: Systems Manager, VPC Endpoint, IAM
- tags: bastion-host, iam-roles
- difficulty: easy
- skills: 1.2.k2, 1.2.k4
- concept: Session Manager in a VPC without internet needs an instance profile and interface endpoints for the Systems Manager services
- refs: 06-management-governance.md
- hint: Session Manager chỉ cần kết nối đi ra tới dịch vụ SSM và quyền IAM cho instance — không mở cổng vào.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 125

A healthcare analytics company runs Amazon Linux instances in private subnets that have no route to the internet and no NAT gateway. Administrators need interactive shell sessions on these instances. The company does not allow inbound ports, SSH keys, or bastion hosts, and access must be controlled through IAM. The SSM Agent is already installed on the instances. Which combination of steps will meet these requirements? (Choose TWO)

- A. Add an inbound rule to the instance security group that allows TCP port 22 from the corporate CIDR range of the administrators
- B. Create interface VPC endpoints for ssm, ssmmessages, and ec2messages in the VPC and allow HTTPS from the instances
- C. Create a gateway VPC endpoint for Systems Manager (ssm) and add it to the route tables of the private subnets
- D. Attach an instance profile that includes the AmazonSSMManagedInstanceCore managed policy to the instances
- E. Create an EC2 Instance Connect Endpoint and distribute SSH key pairs to the administrators of the instances

**Answer:** B, D

**Explanation:** The agent initiates outbound HTTPS connections to the Systems Manager endpoints, so private interface endpoints give it a path without internet access, and the instance profile lets the instances register with Systems Manager. No inbound port is needed.
- Inbound TCP 22 rule: opens an inbound port the policy forbids (vi phạm ràng buộc)
- Gateway endpoint for Systems Manager: gateway endpoints exist only for S3 and DynamoDB (cấu hình không tồn tại)
- EC2 Instance Connect Endpoint with key pairs: uses SSH keys and a security group rule (đúng một phần)
Docs: https://docs.aws.amazon.com/systems-manager/latest/userguide/setup-create-vpc.html
> 🇻🇳 Session Manager trong VPC kín = instance profile SSM + interface endpoint (ssm, ssmmessages, ec2messages).

---

## Q ai-20261022-a12-06
- domain: secure
- task: 1.2
- topic: networking
- services: CloudFront, S3, KMS
- tags: cloudfront-origin-security, sse-kms
- difficulty: hard
- skills: 1.2.k4, 1.2.s3
- concept: Origin access control supports SSE-KMS objects (OAI does not); the KMS key policy must also allow the CloudFront service principal for the distribution
- refs: 04-networking-services.md
- hint: OAI không giải mã được object SSE-KMS — cơ chế nào thay thế và quyền KMS nào phải bổ sung?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A publishing company serves premium PDF files from an Amazon S3 bucket through an Amazon CloudFront distribution that uses an origin access identity (OAI). A new policy requires every object to be encrypted with SSE-KMS by using a customer managed key, and the bucket must not be reachable directly from the internet. After the team switched the bucket to SSE-KMS, CloudFront began returning 403 errors for existing objects. Which solution will fix the errors and meet the security requirements?

- A. Keep the OAI as the origin identity and add its canonical user ID to the KMS key policy so that the distribution can call kms:Decrypt on the objects
- B. Switch the bucket default encryption back to SSE-S3 so that the OAI can read the objects without any KMS permission and keep CloudFront in place
- C. Replace the OAI with an origin access control, then allow the CloudFront service principal for this distribution in both the bucket policy and the KMS key policy
- D. Make the bucket public with a bucket policy that allows s3:GetObject and enable S3 Bucket Keys so that the customer managed key is still used

**Answer:** C

**Explanation:** OAC signs requests with SigV4 and supports SSE-KMS. The bucket policy and the key policy must both allow the cloudfront.amazonaws.com service principal with a condition that names the distribution, so the bucket stays private.
- OAI canonical user in the key policy: an OAI is not a principal that can decrypt KMS-encrypted objects (cấu hình không tồn tại)
- Return to SSE-S3: drops the required customer managed key (vi phạm ràng buộc)
- Public bucket: exposes the objects directly to the internet (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html
> 🇻🇳 SSE-KMS + CloudFront private bucket → OAC (không phải OAI) + bucket policy + key policy cho cloudfront.amazonaws.com.

---

## Q ai-20261022-a12-07
- domain: secure
- task: 1.2
- topic: networking
- services: CloudFront, ALB, VPC
- tags: cloudfront-origin-security
- difficulty: medium
- skills: 1.2.k4, 1.2.s2
- concept: CloudFront VPC origins let a distribution reach an internal ALB in private subnets, removing public exposure and header-secret management
- refs: 04-networking-services.md
- hint: ALB không được có IP public và không muốn xoay secret header — CloudFront cần cách tới origin nằm trong subnet private.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 145

A ticketing company hosts a web application on EC2 instances behind an internet-facing Application Load Balancer. It is placing Amazon CloudFront and AWS WAF in front of the application to absorb traffic spikes. Security requires that the load balancer have no public IP addresses and that no path other than CloudFront can reach it. The team wants the LEAST operational overhead and does not want to rotate custom header secrets. Which combination of steps will meet these requirements? (Choose TWO)

- A. Configure the security group of the internet-facing load balancer to allow the CloudFront managed prefix list on port 443
- B. Create an internal Application Load Balancer in private subnets and register the application's EC2 instances as its targets
- C. Add a custom header with a secret value in CloudFront and a WAF rule on the load balancer that rejects requests without that header
- D. Create a NAT gateway for the EC2 instances and let CloudFront reach the internal load balancer through the Elastic IP address of the NAT gateway
- E. Create a CloudFront VPC origin that points to the internal load balancer and use it as the origin of the distribution

**Answer:** B, E

**Explanation:** An internal load balancer has no public IP addresses, and a CloudFront VPC origin gives the distribution a private connection to it, so CloudFront becomes the single entry point without ACLs or header secrets.
- Managed prefix list on an internet-facing load balancer: public IPs remain and any CloudFront distribution can reach it (vi phạm ràng buộc)
- Custom secret header with WAF: still public and needs secret rotation (vi phạm ràng buộc)
- NAT gateway toward the origin: NAT gateways handle outbound connections from private subnets, not inbound ones (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-vpc-origins.html
> 🇻🇳 Origin không IP public, chỉ CloudFront vào được → ALB internal + CloudFront VPC origin.

---

## Q ai-20261022-a12-08
- domain: secure
- task: 1.2
- topic: security
- services: ALB, Cognito
- tags: federation, tls-termination
- difficulty: medium
- skills: 1.2.k4, 1.2.s3
- concept: ALB authenticate-cognito offloads sign-up and sign-in (including social IdPs) and passes verified claims to targets
- refs: 05-security-services.md
- hint: Người dùng tự đăng ký + đăng nhập Google, không sửa code — cần user directory đứng sau action xác thực của ALB.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A university runs an alumni portal on EC2 instances behind an Application Load Balancer that has an HTTPS listener. The application contains no sign-in logic. Alumni must be able to sign up with an email address and password or sign in with their Google accounts, and the application should receive verified user claims. The development team cannot modify authentication code in the application. Which solution will meet these requirements?

- A. Configure an authenticate-oidc action on the HTTPS listener that points directly at Google and keep email and password users in the application database
- B. Create a Cognito user pool with Google as an identity provider and add an authenticate-cognito action to the HTTPS listener rules
- C. Create an Amazon Cognito identity pool that issues temporary AWS credentials and attach the resulting IAM role to the load balancer
- D. Enable AWS IAM Identity Center, create a customer managed application for the portal, and assign the alumni to that application

**Answer:** B

**Explanation:** A user pool provides sign-up, sign-in, and Google federation; the authenticate-cognito action makes the load balancer handle authentication and forward signed claims in headers, so the application needs no code change.
- Direct OIDC action to Google: supports no email-and-password sign-up and pushes user storage into the application (vi phạm ràng buộc)
- Identity pool with an IAM role on the load balancer: identity pools issue AWS credentials and load balancers cannot use them (dùng sai tính năng)
- IAM Identity Center application: built for workforce users, not public alumni sign-up (giải bài toán khác)
Docs: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-authenticate-users.html
> 🇻🇳 Khách tự đăng ký + social login, không sửa app → Cognito user pool + action authenticate-cognito trên ALB.

---

## Q ai-20261022-a12-09
- domain: secure
- task: 1.2
- topic: networking
- services: Site-to-Site VPN, Direct Connect, Client VPN
- tags: dx-resiliency
- difficulty: medium
- skills: 1.2.s4
- concept: At low traffic volume a Site-to-Site VPN is the cheapest encrypted hybrid link; Direct Connect alone is not encrypted
- refs: 04-networking-services.md
- hint: Lưu lượng nhỏ, bắt buộc mã hoá — phương án nào vừa mã hoá vừa không phải trả cổng và cross-connect Direct Connect?
- status: draft
- family: hybrid-encrypted-link
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A pharmaceutical company must connect its data center to a VPC to exchange clinical-study reports that total a few gigabytes per day. Compliance requires that all traffic between the data center and AWS be encrypted in transit. The company has no existing connectivity to AWS, and its edge routers support IPsec. Which solution will meet these requirements MOST cost-effectively?

- A. Create an AWS Client VPN endpoint in the VPC and install the Client VPN software on the servers in the data center to encrypt the traffic in transit
- B. Order an AWS Direct Connect connection and create a private virtual interface to the virtual private gateway of the VPC to carry the traffic privately
- C. Create an AWS Site-to-Site VPN connection over the internet between the customer gateway device and the virtual private gateway of the VPC
- D. Order a Direct Connect connection, create a transit virtual interface, and create a private IP Site-to-Site VPN connection attached to a transit gateway

**Answer:** C

**Explanation:** A Site-to-Site VPN provides IPsec encryption and has no port-hour or cross-connect fees, which makes it the cheapest option at a low data volume.
- Client VPN on data center servers: designed for individual clients, not for connecting a site (giải bài toán khác)
- Direct Connect with a private virtual interface: Direct Connect does not encrypt traffic by default (vi phạm ràng buộc)
- Direct Connect with a private IP VPN: meets the encryption requirement but adds port, cross-connect, and transit gateway charges (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/directconnect/latest/UserGuide/encryption-in-transit.html
> 🇻🇳 Cần mã hoá + rẻ nhất + lưu lượng thấp → Site-to-Site VPN; Direct Connect mặc định không mã hoá.

---

## Q ai-20261022-a12-10
- domain: secure
- task: 1.2
- topic: networking
- services: Site-to-Site VPN, Direct Connect, Client VPN
- tags: dx-resiliency
- difficulty: medium
- skills: 1.2.s4
- concept: Private IP VPN over a Direct Connect transit virtual interface gives IPsec encryption and an end-to-end private path
- refs: 04-networking-services.md
- hint: Mã hoá IPsec mà vẫn không đi qua internet và không dùng IP public — kết hợp nào cho đường riêng đã mã hoá?
- status: draft
- family: hybrid-encrypted-link
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A pharmaceutical company must connect its data center to a VPC to exchange clinical-study reports that total a few gigabytes per day. Compliance requires that all traffic between the data center and AWS be encrypted in transit. The company has no existing connectivity to AWS, and its edge routers support IPsec. Which solution will meet these requirements MOST securely?

- A. Create an AWS Client VPN endpoint in the VPC and install the Client VPN software on the servers in the data center to encrypt the traffic in transit
- B. Order an AWS Direct Connect connection and create a private virtual interface to the virtual private gateway of the VPC to carry the traffic privately
- C. Create an AWS Site-to-Site VPN connection over the internet between the customer gateway device and the virtual private gateway of the VPC
- D. Order a Direct Connect connection, create a transit virtual interface, and create a private IP Site-to-Site VPN connection attached to a transit gateway

**Answer:** D

**Explanation:** Private IP VPN over a Direct Connect transit virtual interface encrypts traffic with IPsec and keeps it on a private path with no public IP addresses or internet exposure.
- Client VPN on data center servers: per-client tool that does not connect a site (giải bài toán khác)
- Direct Connect with a private virtual interface: private path but no encryption, which compliance requires (vi phạm ràng buộc)
- Site-to-Site VPN over the internet: encrypted, but the tunnels cross the public internet and are more exposed (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/vpn/latest/s2svpn/private-ip-dx.html
> 🇻🇳 Bảo mật nhất = riêng tư + mã hoá: Direct Connect transit VIF + private IP VPN.
