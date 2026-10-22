---
pack: ai-2026-10-22-tier-a-2-1-p2
title: "AI · Tầng A · Task 2.1 — Mở rộng, container, serverless và microservices"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 2.1"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 2.1"
---

# AI · Tầng A · Task 2.1 — Mở rộng, container, serverless và microservices

## Q ai-20261022-a21-15
- domain: resilient
- task: 2.1
- topic: compute
- services: ECS, Fargate, EKS, Lambda, EC2, SQS
- tags: serverless-cost, spot-instances
- difficulty: medium
- skills: 2.1.k14, 2.1.s4
- family: route-service-container-platform
- concept: Fargate removes instance patching and capacity management, so it has the least operational overhead for interruption-tolerant queue workers that outlast Lambda's time limit
- refs: 01-compute-services.md, C-kien-truc-web-app.md
- hint: Đội nhỏ đang vá tay các máy EC2 — nền tảng container nào bỏ hẳn việc quản lý máy chủ mà vẫn chạy được job dài 25 phút?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A logistics company runs a stateless route-optimization service packaged as a Docker image. Each routing request arrives as a message on an Amazon SQS queue, and a container processes it for between 2 and 25 minutes. Any request can safely be retried if a container is interrupted. Request volume stays high throughout the business day and drops overnight. The service runs on a few always-on EC2 instances that the small platform team patches by hand, and the team also keeps Kubernetes manifests and Helm charts from an earlier on-premises deployment of the service. Which solution will meet these requirements with the LEAST operational overhead?

- A. Run the containers on an Amazon EKS cluster that uses managed node groups with On-Demand instances, and scale the nodes with the Kubernetes Cluster Autoscaler.
- B. Run the containers as Amazon ECS tasks on AWS Fargate, translating the Kubernetes manifests into task definitions, and scale the number of tasks with the backlog of the SQS queue.
- C. Package the code as an AWS Lambda container image and invoke it through an SQS event source mapping that scales the number of concurrent invocations with the backlog of the queue.
- D. Run the containers on Amazon ECS with an Auto Scaling group capacity provider that launches Spot Instances across several types, translating the manifests into task definitions.

**Answer:** B

**Explanation:** Fargate removes instance patching and capacity management, and ECS service auto scaling can follow the queue backlog, even down to zero tasks.
- EKS with managed node groups: cluster upgrades and node patching stay with the team (tốn vận hành hơn)
- Lambda container image: an invocation is limited to 15 minutes (https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html), shorter than the 25-minute requests (vi phạm ràng buộc)
- ECS on Spot EC2 instances: the team still manages AMIs and instance patching (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-auto-scaling.html
> 🇻🇳 Ít vận hành nhất cho worker container chịu gián đoạn, chạy tới 25 phút → ECS trên Fargate (không vá máy chủ); Lambda bị giới hạn thời gian chạy.

---

## Q ai-20261022-a21-16
- domain: resilient
- task: 2.1
- topic: compute
- services: EC2 Auto Scaling, ALB, ElastiCache
- tags: elb-features, redis-vs-memcached, ttl
- difficulty: medium
- skills: 2.1.k4, 2.1.k6
- concept: Externalizing session state to a shared in-memory store makes web instances stateless and replaceable; sticky sessions and bigger instances do not survive termination
- refs: C-kien-truc-web-app.md, E-kien-truc-database.md
- hint: Giỏ hàng mất khi instance bị thay — dữ liệu phiên phải nằm ở đâu để mọi instance đều đọc được và instance dùng xong bỏ được?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 130

A ticket-resale website runs a Java web application on EC2 instances in an Auto Scaling group behind an Application Load Balancer. User sessions live in each instance's memory, and the load balancer uses sticky sessions. During scale-in events and deployments, customers lose their shopping carts, and traffic spreads unevenly across instances. The company wants instances to be replaceable at any time, with sessions that survive instance termination and low-latency access to session data, while keeping code changes small. Which solution will meet these requirements?

- A. Increase the stickiness duration on the target group to its maximum so that each customer stays on the same instance for the whole shopping session, even during deployments.
- B. Write session data to a local Amazon EBS volume on each instance and take frequent snapshots so that a replacement instance can restore the carts of the instance that it replaces.
- C. Store session data in an Amazon ElastiCache replication group with Multi-AZ enabled and a TTL on each session key, shared by every instance.
- D. Replace the instances with a larger instance type that has more memory so that fewer instances are needed and scale-in events and deployments become rare.

**Answer:** C

**Explanation:** A shared in-memory session store takes state off the instances, so any instance can serve any request, instances can be terminated freely, and load spreads evenly without stickiness.
- Longer stickiness: affinity does not survive the termination of the instance (dùng sai tính năng)
- Local EBS volume with snapshots: volumes belong to one instance, and restoring snapshots is slow and manual (tốn vận hành hơn)
- Larger instances: sessions stay in instance memory and scale-in still happens (giải bài toán khác)
Docs: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/elasticache-use-cases.html
> 🇻🇳 Muốn instance thay thế được và phiên không mất → đưa session ra kho dùng chung (ElastiCache + TTL); sticky session không sống sót khi instance bị huỷ.

---

## Q ai-20261022-a21-17
- domain: resilient
- task: 2.1
- topic: compute
- services: EC2 Auto Scaling, SQS, Aurora
- tags: scaling-policies, aurora-serverless, read-replicas
- difficulty: hard
- skills: 2.1.k6, 2.1.s2
- concept: Match each tier to its scaling strategy: stateless web scales out on load per target, queue workers scale out on backlog per instance, and a single relational writer scales up (or uses Aurora Serverless v2)
- refs: A-nen-tang-kien-truc.md, C-kien-truc-web-app.md, E-kien-truc-database.md
- hint: Mỗi tầng một cách: web không trạng thái, worker theo hàng đợi, tầng ghi của CSDL — cái nào scale ngang được, cái nào chỉ scale dọc?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 180

A travel-booking company runs a three-tier application. The stateless web tier on EC2 receives unpredictable traffic spikes. The order-processing tier consists of EC2 workers that pull booking jobs from an Amazon SQS queue whose backlog varies widely. The data tier is a single-writer Amazon Aurora database with a steady write load that occasionally needs more CPU and memory on the writer. Which combination of scaling strategies will meet these requirements? (Choose THREE)

- A. Scale the web tier vertically by replacing its instances with a larger instance type before each expected traffic spike, using a new AMI for the larger size.
- B. Scale the web tier horizontally with an Auto Scaling group and a target tracking policy on the request count per target.
- C. Scale the worker tier with scheduled scaling actions that are based on the average backlog of the queue during the previous month.
- D. Scale the worker tier horizontally with an Auto Scaling group and a target tracking policy on the backlog per instance of the queue.
- E. Scale the database writer vertically with a larger DB instance class, or use Aurora Serverless v2 capacity so that it scales in place.
- F. Scale the database horizontally by adding Aurora Replicas to the cluster so that the capacity of the writer is multiplied across the replicas.

**Answer:** B, D, E

**Explanation:** Stateless web instances scale out on load per target, queue workers scale out on backlog per instance, and a single writer scales up (or uses Aurora Serverless v2) because write capacity cannot be spread over replicas.
- Larger web instances before spikes: vertical, slow, and the spikes are unpredictable (dùng sai tính năng)
- Scheduled scaling from last month's queue length: the backlog varies widely, so a schedule cannot track it (dùng sai tính năng)
- Aurora Replicas: they add read capacity, not write capacity (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-using-sqs-queue.html
> 🇻🇳 Web stateless → scale ngang theo request/target; worker → scale ngang theo backlog/instance; writer đơn → scale dọc (hoặc Aurora Serverless v2); replica chỉ tăng đọc.

---

## Q ai-20261022-a21-18
- domain: resilient
- task: 2.1
- topic: compute
- services: EC2 Auto Scaling, EBS, ALB
- tags: asg-warm-pool, scaling-policies, launch-template
- difficulty: hard
- time: 145
- skills: 2.1.k6, 2.1.s2
- concept: A warm pool of stopped, pre-initialized instances cuts scale-out latency for slow-booting instances at a cost of EBS only, unlike scheduled scaling, timer tweaks, or a peak-sized minimum
- refs: 01-compute-services.md, C-kien-truc-web-app.md
- hint: Boot mất chừng mười phút, tải tăng bất ngờ nên không đặt lịch được và không muốn chạy sẵn cả ngày — làm sao có sẵn máy đã khởi tạo mà rẻ?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A genomics SaaS company runs a web application on EC2 instances in an Auto Scaling group. Each new instance downloads a large reference dataset to its EBS root volume and builds index files on that volume during boot, which takes about ten minutes before the instance passes load balancer health checks. Request volume rises sharply and unpredictably several times a day, and users see timeouts while new instances are still starting. Keeping the group scaled for the peak all day would be too expensive. Which solution will reduce the scale-out delay MOST cost-effectively?

- A. Reduce the health check grace period and the scaling cooldown of the Auto Scaling group so that new instances are launched and registered with the load balancer sooner.
- B. Add a warm pool of pre-initialized instances in the Stopped state and use a lifecycle hook to finish initialization before the instances stop.
- C. Configure scheduled scaling actions that add capacity at the times of day when the traffic spikes usually occur, based on the graphs of last week.
- D. Raise the minimum capacity of the group to the number of instances that the peak needs so that enough instances are running through the whole day.

**Answer:** B

**Explanation:** A warm pool keeps initialized instances stopped, so scale-out starts from a prepared instance instead of a ten-minute boot, and stopped instances cost only for their EBS volumes.
- Shorter grace period and cooldown: they do not shorten the boot time of an instance (dùng sai tính năng)
- Scheduled scaling: the spikes are unpredictable, so no schedule matches them (vi phạm ràng buộc)
- Minimum capacity at peak: keeps peak capacity running all day (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-warm-pools.html
> 🇻🇳 Instance khởi động lâu + tải bất ngờ + tiết kiệm → warm pool (instance đã khởi tạo ở trạng thái Stopped, chỉ trả phí EBS).

---

## Q ai-20261022-a21-19
- domain: resilient
- task: 2.1
- topic: compute
- services: ECS, Fargate, EKS, Lambda, EC2, SQS
- tags: serverless-cost, spot-instances
- difficulty: medium
- skills: 2.1.k14, 2.1.s4
- family: route-service-container-platform
- concept: ECS tasks on an Auto Scaling group capacity provider with Spot Instances are the cheapest option for steady, interruption-tolerant container work
- refs: 01-compute-services.md, C-kien-truc-web-app.md
- hint: Việc chạy nền đều đặn cả ngày và thử lại được nếu bị ngắt — loại năng lực tính toán nào rẻ nhất cho tải chịu gián đoạn?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A logistics company runs a stateless route-optimization service packaged as a Docker image. Each routing request arrives as a message on an Amazon SQS queue, and a container processes it for between 2 and 25 minutes. Any request can safely be retried if a container is interrupted. Request volume stays high throughout the business day and drops overnight. The service runs on a few always-on EC2 instances that the small platform team patches by hand, and the team also keeps Kubernetes manifests and Helm charts from an earlier on-premises deployment of the service. Which solution will meet these requirements MOST cost-effectively?

- A. Run the containers on an Amazon EKS cluster that uses managed node groups with On-Demand instances, and scale the nodes with the Kubernetes Cluster Autoscaler.
- B. Run the containers as Amazon ECS tasks on AWS Fargate, translating the Kubernetes manifests into task definitions, and scale the number of tasks with the backlog of the SQS queue.
- C. Package the code as an AWS Lambda container image and invoke it through an SQS event source mapping that scales the number of concurrent invocations with the backlog of the queue.
- D. Run the containers on Amazon ECS with an Auto Scaling group capacity provider that launches Spot Instances across several types, translating the manifests into task definitions.

**Answer:** D

**Explanation:** Spot Instances are the cheapest compute for work that can be retried, and an Auto Scaling group capacity provider lets ECS scale them with demand, so interruptions only cause a retry.
- EKS with On-Demand nodes: On-Demand prices plus a per-cluster charge (tốn chi phí hơn)
- Fargate tasks: a premium for serverless operation that the steady, retryable work does not need (tốn chi phí hơn)
- Lambda container image: an invocation is limited to 15 minutes (https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html), shorter than the 25-minute requests (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/asg-capacity-providers.html
> 🇻🇳 Tải đều, chịu gián đoạn, thử lại được → ECS với capacity provider dùng EC2 Spot là rẻ nhất; Lambda bị giới hạn thời gian chạy.

---

## Q ai-20261022-a21-20
- domain: resilient
- task: 2.1
- topic: networking
- services: ALB, EC2 Auto Scaling
- tags: elb-features, scaling-policies
- difficulty: hard
- skills: 2.1.k9, 2.1.s2
- concept: ALB slow start mode ramps a new target's share of requests gradually, unlike deregistration delay, ASG health check grace period, or predictive scaling
- refs: C-kien-truc-web-app.md
- hint: Instance mới nhận đủ phần tải ngay khi đăng ký và trả lỗi trong lúc khởi động — tham số nào của target group làm tải tăng dần?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 130

An online retailer runs a Java application on EC2 instances behind an Application Load Balancer. When the Auto Scaling group adds instances during a sale, each new instance immediately receives its full share of requests and returns errors for about two minutes while its JIT compiler and caches warm up. Existing instances are healthy and lightly loaded. The company wants new instances to receive traffic gradually, without keeping extra instances running. Which change will meet these requirements?

- A. Enable slow start mode on the target group with a duration that matches the warm-up period of the instances.
- B. Increase the deregistration delay on the target group so that new instances have time to warm up before they receive requests.
- C. Increase the health check grace period of the Auto Scaling group so that the load balancer waits before it sends requests to new instances.
- D. Configure predictive scaling so that instances are launched before the sale begins and have time to warm up.

**Answer:** A

**Explanation:** Slow start mode makes the load balancer increase a new target's share of requests linearly over the configured duration, so a warming instance never takes a full share at once.
- Deregistration delay: applies to targets being removed, not to new ones (dùng sai tính năng)
- Health check grace period: delays the group's own health checks, not how the load balancer routes requests (dùng sai tính năng)
- Predictive scaling: launches capacity earlier, but each instance still takes a full share when it registers (giải bài toán khác)
Docs: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-target-group-attributes.html
> 🇻🇳 Instance mới cần được tăng tải dần trong lúc khởi động → slow start mode trên target group; deregistration delay chỉ áp dụng khi gỡ target.

---

## Q ai-20261022-a21-21
- domain: resilient
- task: 2.1
- topic: integration
- services: SNS, SQS, ALB
- tags: decoupling, fan-out, high-availability
- difficulty: medium
- skills: 2.1.k4, 2.1.s1
- concept: In microservices, keep a call synchronous when the caller needs the result now, and decouple the rest with SNS and per-service SQS queues so a slow dependency cannot fail the request
- refs: A-nen-tang-kien-truc.md, 07-application-integration.md
- hint: Kết quả thanh toán phải có ngay, còn kho và giao hàng làm chậm vài giây được — bước nào giữ đồng bộ, bước nào nên tách bằng thông điệp?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 150

An e-commerce platform is built from microservices. When a customer places an order, the order service calls the payment, inventory, and shipping services one after another over HTTP. When the shipping service slows down, order requests time out and customers see errors even though payment succeeded. The customer must still see the payment result immediately, but inventory reservation and shipping can complete a few seconds later. Teams must be able to deploy their services independently. Which combination of changes will improve resilience? (Choose TWO)

- A. Convert the payment call to an asynchronous SQS message as well, and show customers a confirmation page that does not include the payment result.
- B. Keep the payment call synchronous through an internal load balancer and add client-side timeouts and retries with exponential backoff.
- C. Merge the inventory and shipping logic into the order service so that fewer network calls are needed between the services.
- D. Publish an OrderPlaced event to an Amazon SNS topic and have the inventory and shipping services consume it through their own Amazon SQS queues.
- E. Increase the timeouts on each service call so that slow dependencies have more time to respond before the call fails.

**Answer:** B, D

**Explanation:** The payment result is needed immediately, so that call stays synchronous with timeouts and backoff; inventory and shipping can finish later, so an SNS topic with a queue per service decouples them and a slow shipping service no longer fails orders.
- Asynchronous payment: the customer must see the payment result immediately (vi phạm ràng buộc)
- Merging services: removes independent deployment (vi phạm ràng buộc)
- Longer timeouts everywhere: callers wait longer and slow dependencies cascade (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/sns/latest/dg/sns-sqs-as-subscriber.html
> 🇻🇳 Bước cần kết quả ngay giữ đồng bộ (timeout + retry backoff); bước làm sau được thì tách bằng SNS → SQS; gộp dịch vụ hay tăng timeout đều sai hướng.

---

## Q ai-20261022-a21-22
- domain: resilient
- task: 2.1
- topic: compute
- services: ECS, Fargate, ECR, EFS, ALB, S3, EBS
- tags: ecr-containers, efs-throughput-modes
- difficulty: hard
- skills: 2.1.k8, 2.1.s4, 2.1.k13
- concept: Moving a legacy app into containers without code changes: build an image on ECS with Fargate, and mount EFS so every task shares the same POSIX directory (EBS is per task, S3 needs code changes)
- refs: 01-compute-services.md, D-kien-truc-luu-tru.md
- hint: Không được sửa mã nguồn và vẫn cần thư mục ghi chung kiểu POSIX cho nhiều bản sao — loại lưu trữ nào gắn vào task được dùng chung?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 180

A company runs a monolithic Java web application on a single large EC2 instance. The application writes uploaded documents to a local directory and reads them back on later requests, and it relies on POSIX file semantics. User sessions are already stored in a shared database. The company wants to move the application into containers so that several copies can run behind a load balancer and scale on demand, without servers to manage and without changing the application code. Which combination of steps will meet these requirements? (Choose TWO)

- A. Build a container image, push it to Amazon ECR, and run it as an Amazon ECS service on AWS Fargate behind an Application Load Balancer.
- B. Modify the application to upload documents to an Amazon S3 bucket by using the AWS SDK and serve them to users through presigned URLs behind the load balancer.
- C. Mount an Amazon EFS file system in the ECS task definition at the uploads directory path so that every task behind the load balancer shares the same files.
- D. Attach a separate Amazon EBS volume to each Fargate task behind the load balancer and mount it at the uploads directory path for the document files.
- E. Install Kubernetes on EC2 instances that the team manages and deploy the container behind a load balancer with hostPath volumes on the local file system of each node for the uploads directory.

**Answer:** A, C

**Explanation:** An image on ECS with Fargate removes servers, and an EFS volume gives all tasks the same POSIX directory with no code change.
- S3 with the SDK: requires application code changes (vi phạm ràng buộc)
- EBS volume per task: each task gets its own volume, so copies cannot share documents (dùng sai tính năng)
- Self-managed Kubernetes with hostPath: servers to manage, and files stay on one host (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/efs-volumes.html
> 🇻🇳 Đưa app cũ vào container không sửa code → image trên ECS Fargate + mount EFS làm thư mục POSIX dùng chung; EBS gắn riêng từng task, S3 phải sửa code.

---

## Q ai-20261022-a21-23
- domain: resilient
- task: 2.1
- topic: compute
- services: Lambda, API Gateway, DynamoDB, SES, EC2, Fargate
- tags: serverless-cost
- difficulty: easy
- time: 120
- skills: 2.1.k12, 2.1.s5
- concept: Bursty, rare, short work with no operations staff fits Lambda with API Gateway because it bills only while requests run and needs no capacity planning
- refs: 01-compute-services.md, C-kien-truc-web-app.md
- hint: Tải rải rác theo đợt, mỗi lần chỉ vài giây, không có đội vận hành — mô hình tính phí nào chỉ trả khi có xử lý?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A small online-learning company creates a student profile and sends a welcome email each time a student registers through a web form. Registrations arrive in short bursts after marketing campaigns and are rare otherwise, and each registration needs about two seconds of processing. The company has no operations staff and wants to pay only while registrations are processed, with no servers to manage and no capacity to plan. Which solution will meet these requirements MOST cost-effectively?

- A. Run the code that creates the profile and sends the welcome email on two Amazon EC2 instances in an Auto Scaling group behind an Application Load Balancer.
- B. Run the code that creates the profile and sends the welcome email as an Amazon ECS service on AWS Fargate with a minimum of one task behind an Application Load Balancer.
- C. Expose an Amazon API Gateway HTTP API that invokes an AWS Lambda function, which writes the profile to DynamoDB and sends the email by using SES.
- D. Run the code that creates the profile and sends the welcome email on one Amazon EC2 instance that is covered by a one-year Savings Plan to lower its hourly price.

**Answer:** C

**Explanation:** Lambda behind API Gateway bills for requests and run time, scales through bursts, and needs no servers, so idle periods cost almost nothing.
- EC2 Auto Scaling group with ALB: instances and a load balancer bill around the clock (tốn chi phí hơn)
- Fargate with one minimum task: a task and a load balancer run even when idle (tốn chi phí hơn)
- One instance with a Savings Plan: still a server to manage, and the commitment pays for idle hours (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/lambda/latest/dg/welcome.html
> 🇻🇳 Tải rải rác, ngắn, không có đội vận hành, chỉ muốn trả khi có xử lý → Lambda + API Gateway; EC2/Fargate tối thiểu vẫn tính tiền khi rảnh.

---

## Q ai-20261022-a21-24
- domain: resilient
- task: 2.1
- topic: compute
- services: ECS, Fargate, EKS, Lambda, EC2, SQS
- tags: serverless-cost, spot-instances
- difficulty: medium
- skills: 2.1.k14, 2.1.s4
- family: route-service-container-platform
- concept: EKS is Kubernetes-conformant, so existing manifests and Helm charts run with the least rework compared with ECS or Lambda
- refs: 01-compute-services.md, C-kien-truc-web-app.md
- hint: Đã có manifest và Helm chart của Kubernetes — nền tảng nào chạy chúng gần như nguyên vẹn, không phải viết lại định nghĩa triển khai?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 140

A logistics company runs a stateless route-optimization service packaged as a Docker image. Each routing request arrives as a message on an Amazon SQS queue, and a container processes it for between 2 and 25 minutes. Any request can safely be retried if a container is interrupted. Request volume stays high throughout the business day and drops overnight. The service runs on a few always-on EC2 instances that the small platform team patches by hand, and the team also keeps Kubernetes manifests and Helm charts from an earlier on-premises deployment of the service. Which solution will meet these requirements with the LEAST rework of the team's existing deployment manifests?

- A. Run the containers on an Amazon EKS cluster that uses managed node groups with On-Demand instances, and scale the nodes with the Kubernetes Cluster Autoscaler.
- B. Run the containers as Amazon ECS tasks on AWS Fargate, translating the Kubernetes manifests into task definitions, and scale the number of tasks with the backlog of the SQS queue.
- C. Package the code as an AWS Lambda container image and invoke it through an SQS event source mapping that scales the number of concurrent invocations with the backlog of the queue.
- D. Run the containers on Amazon ECS with an Auto Scaling group capacity provider that launches Spot Instances across several types, translating the manifests into task definitions.

**Answer:** A

**Explanation:** EKS is certified Kubernetes-conformant, so the existing manifests and Helm charts can be applied with little change, and managed node groups limit node work.
- ECS on Fargate: the manifests must be rewritten as task definitions (vi phạm ràng buộc)
- Lambda container image: needs repackaging for the Lambda model and its run-time limit (vi phạm ràng buộc)
- ECS on Spot EC2 instances: the manifests must be rewritten as ECS task definitions (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html
> 🇻🇳 Đã có manifest/Helm chart Kubernetes, ít phải viết lại nhất → Amazon EKS (tương thích chuẩn Kubernetes); ECS/Lambda phải chuyển định nghĩa.

---

## Q ai-20261022-a21-25
- domain: resilient
- task: 2.1
- topic: networking
- services: ALB, EC2 Auto Scaling, NAT Gateway, VPC
- tags: subnets, security-groups, elb-features
- difficulty: easy
- skills: 2.1.k10, 2.1.s1
- concept: In a multi-tier design, give each tier its own Auto Scaling group and put an internal load balancer in private subnets between the web tier and the logic tier
- refs: C-kien-truc-web-app.md, A-nen-tang-kien-truc.md
- hint: Hai tầng phải scale riêng và tầng logic không được ra internet — thứ gì đặt giữa tầng web và tầng logic trong subnet riêng?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A university runs a three-tier application. The web servers and the business-logic servers run together on the same EC2 instances in public subnets behind one internet-facing Application Load Balancer. Releases are slow because the layers must be deployed and scaled together, and auditors want the business-logic layer to be unreachable from the internet. Which architecture will let each tier scale independently while keeping the logic tier private?

- A. Keep both layers on the same instances, move them to private subnets, and place a NAT gateway in front of them to receive client requests.
- B. Run both layers in one larger Auto Scaling group behind the internet-facing load balancer with a step scaling policy and restrict the logic layer with security group rules.
- C. Run the logic tier on instances in public subnets with Elastic IP addresses and have the internet-facing web tier call those addresses, restricting access with network ACLs.
- D. Put the web tier in an Auto Scaling group and the logic tier in its own private-subnet group behind an internal ALB that is called by the web tier.

**Answer:** D

**Explanation:** Separate Auto Scaling groups let each tier scale on its own, and an internal load balancer in private subnets lets the web tier call the logic tier without exposing it to the internet.
- NAT gateway in front: NAT handles outbound connections and cannot receive client requests (đặt sai chỗ)
- One larger group: the layers still deploy and scale together (vi phạm ràng buộc)
- Public subnets with Elastic IP addresses: the logic tier stays reachable from the internet (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html
> 🇻🇳 Đa tầng, mỗi tầng scale riêng, tầng logic private → ASG riêng cho từng tầng + ALB nội bộ (internal) trong private subnet giữa web và logic.

---

## Q ai-20261022-a21-26
- domain: resilient
- task: 2.1
- topic: compute
- services: EC2 Auto Scaling, SQS, CloudWatch
- tags: scaling-policies, decoupling
- difficulty: medium
- time: 135
- skills: 2.1.s2, 2.1.k6
- concept: Scale queue workers with target tracking on a backlog-per-instance metric derived from acceptable latency and processing time, not on CPU, raw queue length, or a fixed schedule
- refs: C-kien-truc-web-app.md, 07-application-integration.md
- hint: CPU thấp vì worker chờ API ngoài trong khi hàng đợi dài ra — chỉ số nào tỉ lệ với việc đang chờ trên mỗi instance?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22

A photo-printing company runs worker instances in an Auto Scaling group that pull print jobs from an Amazon SQS queue. Job arrival rates change unpredictably during the day, and the average processing time per job is a stable 6 seconds. The company wants jobs to wait no longer than about 2 minutes, without keeping unused instances. The group scales on average CPU utilization, which stays low even when the backlog grows because workers spend most of their time waiting on a slow third-party API. Which scaling approach will meet these requirements?

- A. Use a target tracking policy on the ApproximateNumberOfMessagesVisible metric of the queue with a backlog target of 20 messages, the number of jobs one instance can process in 2 minutes.
- B. Use a target tracking policy on a backlog-per-instance metric, calculated as queue length divided by in-service instances, with a target based on acceptable latency and job processing time.
- C. Use a scheduled scaling action that doubles the desired capacity of the group every morning and halves it every evening to follow the average daily pattern of jobs.
- D. Lower the CPU target value of the existing target tracking policy so that the group scales out at a lower average CPU utilization of the instances that process a job.

**Answer:** B

**Explanation:** Backlog per instance scales the fleet with the waiting work, using a target of acceptable latency divided by processing time (here 120 s ÷ 6 s = 20 messages per instance), independent of CPU.
- Raw queue length with a fixed target: the metric ignores how many instances share the backlog, so a per-instance figure applied to the whole queue makes the group scale out of proportion (dùng sai tính năng)
- Scheduled scaling: arrival rates are unpredictable, so a schedule cannot track them (vi phạm ràng buộc)
- Lower CPU target: CPU stays low while workers wait on the API, so it is the wrong signal (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-using-sqs-queue.html
> 🇻🇳 Worker đọc SQS, CPU thấp giả → target tracking theo "backlog per instance" (độ dài hàng đợi ÷ số instance), đích = độ trễ chấp nhận ÷ thời gian xử lý.

---

## Q ai-20261022-a21-27
- domain: resilient
- task: 2.1
- topic: compute
- services: EC2 Auto Scaling, SQS
- tags: scaling-policies, asg-lifecycle-hooks
- difficulty: hard
- skills: 2.1.s2, 2.1.k6
- concept: Workers on long, non-resumable jobs call SetInstanceProtection to keep Auto Scaling from terminating them mid-job while dynamic scaling stays in place
- refs: C-kien-truc-web-app.md
- hint: Scale-in huỷ instance đang xuất file dở, việc không chạy lại được — cơ chế nào cho phép chính worker khoá instance của mình lúc đang làm?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 150

A video-editing SaaS company runs export workers on EC2 instances in an Auto Scaling group that pulls export jobs from an Amazon SQS queue. Each export is not idempotent, takes up to 45 minutes, and cannot be resumed. A target tracking policy on the queue backlog scales the group in when the backlog shrinks, and the group terminates instances that are in the middle of an export, which corrupts customers' output files. The company wants to keep the dynamic scaling policy and stop in-progress exports from being terminated by scale-in events, with minimal changes. Which solution will meet these requirements?

- A. Increase the visibility timeout of the queue to more than the longest export so that a worker whose export was cut off by a scale-in termination does not start it again.
- B. Replace the target tracking policy with a scheduled scaling action that reduces capacity after business hours, when no worker is expected to run an export.
- C. Have each worker enable scale-in protection on its own instance during an export and disable it afterwards, by calling the SetInstanceProtection API.
- D. Increase the cooldown period of the scaling policy to more than the longest export so that the group cannot scale in while a worker runs an export.

**Answer:** C

**Explanation:** Scale-in protection stops Auto Scaling from choosing a protected instance during scale-in, so each worker protects itself only while it runs an export and the dynamic policy stays in place.
- Longer visibility timeout: it does not stop a termination, and a non-idempotent export would be corrupted anyway (dùng sai tính năng)
- Scheduled scaling instead of target tracking: gives up the dynamic scaling policy the company wants to keep (vi phạm ràng buộc)
- Longer cooldown: delays every scaling action rather than protecting specific instances (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-instance-protection.html
> 🇻🇳 Worker xử lý job dài không chạy lại được → worker tự bật scale-in protection (SetInstanceProtection) khi bắt đầu job, tắt khi xong; vẫn giữ dynamic scaling.

---

## Q ai-20261022-a21-28
- domain: resilient
- task: 2.1
- topic: networking
- services: ALB, NLB, GWLB, Lambda
- tags: elb-features, tls-termination
- difficulty: medium
- skills: 2.1.k9, 2.1.s6
- concept: ALB routes HTTP by path to containers and Lambda targets; NLB serves TCP at layer 4 with a static Elastic IP per Availability Zone for partner allow-lists
- refs: C-kien-truc-web-app.md, 04-networking-services.md
- hint: Một workload HTTP cần định tuyến theo đường dẫn, một workload TCP cần IP cố định cho đối tác — mỗi loại load balancer làm được việc nào?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 150

A financial-data company is migrating two workloads to AWS. The first is a set of HTTP microservices that must be reachable through different URL paths on one domain name and are served by containers and an AWS Lambda function. The second is a proprietary TCP feed that trading partners reach through a fixed set of IP addresses that the partners have allow-listed in their firewalls, with very high connection rates and low latency. Which combination of load balancers will meet these requirements? (Choose TWO)

- A. Use an Application Load Balancer with a TCP listener for the proprietary feed and share its DNS name with the trading partners instead of fixed IP addresses.
- B. Use an Application Load Balancer with path-based listener rules that forward to target groups for the containers and the Lambda function.
- C. Use a Gateway Load Balancer in front of the microservices and containers to route requests by URL path to the right target group.
- D. Use a Network Load Balancer with TLS listener rules that route HTTP requests to the containers and Lambda functions by URL path.
- E. Use a Network Load Balancer with an Elastic IP address in each Availability Zone and forward its TCP listener to the feed servers.

**Answer:** B, E

**Explanation:** An ALB routes HTTP by URL path to container and Lambda targets, while an NLB works at layer 4 for TCP at high rates and can use an Elastic IP per Availability Zone for allow-lists.
- ALB with a TCP listener: an ALB handles HTTP and HTTPS and offers no static IPs for allow-lists (dùng sai tính năng)
- Gateway Load Balancer for path routing: it fronts virtual appliances, not microservices (dùng sai tính năng)
- NLB path rules to Lambda: an NLB works at layer 4 and has no URL path routing (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html
> 🇻🇳 HTTP theo path tới container/Lambda → ALB; TCP tốc độ cao + IP cố định cho đối tác → NLB với Elastic IP mỗi AZ.
