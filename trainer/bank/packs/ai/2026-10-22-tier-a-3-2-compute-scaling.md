---
pack: ai-2026-10-22-tier-a-3-2
title: "AI · Tầng A · Task 3.2 — Compute hiệu năng cao và co giãn"
exam: SAA-C03
origin: ai
created: 2026-10-22
generated_by: 2026-10-22_tier-a
source: "v6 tầng A — đề cương 3.2"
description: "Câu tình huống chuẩn đề thật (tầng A) cho task 3.2"
---

# AI · Tầng A · Task 3.2 — Compute hiệu năng cao và co giãn

## Q ai-20261022-a32-01
- domain: performance
- task: 3.2
- topic: compute
- services: EC2 Auto Scaling, SQS, S3, ELB
- tags: decoupling, scaling-policies, sqs-backlog-per-instance
- difficulty: medium
- time: 160
- skills: 3.2.s1, 3.2.k3, 3.2.s2
- concept: Decouple a synchronous heavy task with S3 plus SQS and scale the worker group with target tracking on a backlog-per-instance metric, not on raw queue length
- refs: 07-application-integration.md, 01-compute-services.md
- hint: Hai tầng phải scale độc lập và không mất upload — chỉ số nào tăng/giảm tỉ lệ với số instance để target tracking hội tụ?
- created: 2026-10-22
- enriched: 2026-10-22

A media company's web application runs on Amazon EC2 instances in an Auto Scaling group behind an Application Load Balancer. When a user uploads a video, the web server transcodes it synchronously, which takes up to 20 minutes of CPU time. During promotions the web tier saturates, page requests time out, and uploads are lost when instances are replaced. The company wants the web tier and the transcoding workers to scale independently, to absorb bursts without losing uploads, and to add worker capacity in proportion to the amount of waiting work. Which combination of steps will meet these requirements? (Choose TWO)

- A. Store each upload in Amazon S3 and configure an S3 event notification that invokes an AWS Lambda function to transcode each video.
- B. Store each upload in Amazon S3, send a message that references it to an Amazon SQS queue, and run the transcoding workers in a separate Auto Scaling group.
- C. Configure target tracking on the queue's ApproximateNumberOfMessagesVisible metric so that the worker Auto Scaling group's capacity follows the number of waiting messages.
- D. Configure target tracking on a backlog-per-instance metric calculated from the queue length and the number of in-service instances.
- E. Configure step scaling on the worker group's average CPU utilization so that workers are added whenever busy workers exceed 70 percent.

**Answer:** B, D

**Explanation:** The queue buffers uploads so the two tiers scale independently and nothing is lost, and a backlog-per-instance metric (queue length divided by in-service instances) gives target tracking a value that moves in proportion to the waiting work.
- S3 event invoking Lambda: decouples, but a function run is limited to 15 minutes, shorter than the 20-minute jobs (vi phạm ràng buộc)
- Target tracking on raw queue length: it does not change in proportion to group size, so it cannot converge (dùng sai tính năng)
- Step scaling on worker CPU: busy workers run near full CPU whatever the backlog, so capacity does not follow waiting work (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-using-sqs-queue.html
> 🇻🇳 Tách tầng bằng SQS; scale worker theo backlog-per-instance (độ dài hàng đợi / số instance), không dùng thẳng số message.

---

## Q ai-20261022-a32-02
- domain: performance
- task: 3.2
- topic: compute
- services: EC2 Auto Scaling, ALB, EC2
- tags: scaling-policies, alb-request-count-per-target
- difficulty: medium
- time: 125
- skills: 3.2.s2, 3.2.k4
- concept: For an I/O-bound service whose CPU stays low, target tracking on ALBRequestCountPerTarget follows demand; load balancer RequestCount and CPU do not
- refs: 01-compute-services.md, 04-networking-services.md
- hint: Ứng dụng chủ yếu chờ dịch vụ ngoài nên CPU không phản ánh tải — chỉ số nào chia tải cho số target và đổi ngược chiều với số instance?
- created: 2026-10-22
- enriched: 2026-10-22

An online ticketing platform runs its API on Amazon EC2 instances in an Auto Scaling group behind an Application Load Balancer. Each request spends most of its time waiting on a payment provider, so average CPU utilization stays near 20% even while response times climb during on-sale events. The group scales with a target tracking policy on average CPU utilization, which almost never triggers, and the start times of sales are not announced in advance. The company wants capacity to follow demand automatically with the LEAST operational effort. Which change should a solutions architect make?

- A. Replace the policy with predictive scaling so that the group launches capacity ahead of the forecast load of each on-sale event.
- B. Replace the policy with step scaling on the load balancer TargetResponseTime metric so that instances are added when latency rises.
- C. Replace the policy with target tracking on the total RequestCount metric of the load balancer and set a target the fleet can serve.
- D. Replace the policy with target tracking on the ALBRequestCountPerTarget metric and set a target value that one instance can serve.

**Answer:** D

**Explanation:** ALBRequestCountPerTarget divides the load balancer's requests by the number of targets, so it falls as instances are added and rises with demand, as target tracking needs; CPU ignores time spent waiting on a downstream service.
- Predictive scaling: forecasts from repeating patterns, but sale start times are not announced (vi phạm ràng buộc)
- Step scaling on TargetResponseTime: the latency comes from the payment provider, so added instances do not bring it down (dùng sai tính năng)
- Total RequestCount: does not shrink as instances are added, so target tracking cannot converge on it (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html
> 🇻🇳 App chờ I/O nên CPU thấp → target tracking theo ALBRequestCountPerTarget (request mỗi target), không dùng CPU hay RequestCount toàn ALB.

---

## Q ai-20261022-a32-03
- domain: performance
- task: 3.2
- topic: compute
- services: EC2 Auto Scaling, EC2
- tags: scaling-policies, asg-warm-pool, asg-lifecycle-hooks
- difficulty: hard
- time: 165
- skills: 3.2.s2, 3.2.k4
- concept: Shifting cyclical load plus long instance initialization: predictive scaling launches capacity ahead of the forecast and a warm pool of pre-initialized stopped instances removes boot time from scale-out
- refs: 01-compute-services.md
- hint: Mẫu tải đổi theo chiến dịch và mỗi instance mất vài phút để sẵn sàng — cần vừa dự báo trước vừa rút ngắn thời gian khởi động.
- created: 2026-10-22
- enriched: 2026-10-22

A retail analytics company runs a web application on Amazon EC2 instances in an Auto Scaling group. Traffic follows daily and weekly patterns that shift as marketing campaigns change, so fixed schedules are frequently wrong. Each new instance needs about 8 minutes to boot and load a local data cache, so users see slow responses at the start of every busy period while the group scales out reactively. The company wants capacity to be ready before demand arrives while limiting the cost of idle capacity. Which combination of steps will meet these requirements? (Choose TWO)

- A. Create a predictive scaling policy that forecasts capacity needs from the group's history and launches instances ahead of the forecast.
- B. Create scheduled scaling actions that raise the desired capacity at the start of each weekday morning and lower it each evening.
- C. Create a warm pool of stopped, pre-initialized instances and use a lifecycle hook to finish their initialization.
- D. Create a step scaling policy that adds several instances whenever the average CPU utilization of the group exceeds 30 percent.
- E. Raise the group's minimum capacity to the expected daily peak so that enough instances are running before every busy period starts.

**Answer:** A, C

**Explanation:** Predictive scaling forecasts daily and weekly load and launches capacity ahead of it, and a warm pool of pre-initialized stopped instances removes the 8-minute boot from the scale-out path while costing little more than storage.
- Fixed scheduled actions: rely on stable patterns, but the patterns keep shifting (vi phạm ràng buộc)
- Step scaling on CPU: still reactive, so each scale-out waits for the full boot time (giải bài toán khác)
- Higher minimum capacity: keeps peak-sized capacity running all day (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-warm-pools.html
> 🇻🇳 Mẫu tải đổi liên tục + khởi động 8 phút → predictive scaling (dự báo) + warm pool (instance khởi tạo sẵn, trạng thái Stopped).

---

## Q ai-20261022-a32-04
- domain: performance
- task: 3.2
- topic: compute
- services: Lambda, API Gateway
- tags: lambda-concurrency, snapstart, cold-start
- difficulty: medium
- time: 120
- skills: 3.2.k5, 3.2.s4
- family: lambda-java-cold-start
- concept: For a Java Lambda function, SnapStart removes most of the cold-start delay at no additional charge, which beats provisioned concurrency on cost
- refs: 01-compute-services.md, R-performance-benchmarks.md
- hint: Runtime là Java và đề hỏi phương án tiết kiệm nhất — tính năng nào giảm khởi tạo mà không tính thêm phí cho Java?
- created: 2026-10-22
- enriched: 2026-10-22

A fintech company hosts a customer-facing REST API on AWS Lambda behind Amazon API Gateway. The functions use the Java 17 runtime and load a large dependency framework during start-up, so the first request that reaches each new execution environment takes several seconds. Traffic is spiky: it jumps from a handful of requests to thousands per second within a minute after each push notification, and the marketing team sends the notifications at fixed, published times. The company wants to remove this start-up delay without rewriting the functions. Which solution will meet these requirements MOST cost-effectively?

- A. Raise the memory setting of each function to the maximum value so that the start-up code finishes faster on every new execution environment.
- B. Enable Lambda SnapStart on each function, publish a version, and send traffic to that version through an alias.
- C. Set reserved concurrency on each function to the expected peak so that Lambda keeps initialized execution environments ready for traffic.
- D. Configure provisioned concurrency on a published version and adjust it with Application Auto Scaling to match the expected traffic.

**Answer:** B

**Explanation:** For Java runtimes SnapStart adds no extra charge and resumes new execution environments from a cached snapshot of the initialized function, which removes most of the start-up delay.
- Maximum memory: more CPU shortens initialization a little but does not remove it, and every millisecond costs more (dùng sai tính năng)
- Reserved concurrency: only guarantees and caps how many environments can run; it pre-initializes none (dùng sai tính năng)
- Provisioned concurrency: keeps initialized environments ready, but you pay for them all the time (tốn chi phí hơn)
Docs: https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html
> 🇻🇳 Java + cold start + tiết kiệm nhất → SnapStart (không phụ phí cho Java); provisioned concurrency tính tiền liên tục.

---

## Q ai-20261022-a32-05
- domain: performance
- task: 3.2
- topic: compute
- services: Lambda, API Gateway
- tags: lambda-concurrency, provisioned-concurrency, cold-start
- difficulty: hard
- time: 135
- skills: 3.2.k5, 3.2.s4
- family: lambda-java-cold-start
- concept: When start-up latency must be the lowest and most predictable, provisioned concurrency (double-digit milliseconds) beats SnapStart (sub-second at best)
- refs: 01-compute-services.md, R-performance-benchmarks.md
- hint: Đổi qualifier: giờ cần độ trễ khởi động thấp và dễ đoán nhất — tính năng nào giữ sẵn môi trường đã khởi tạo thay vì khôi phục theo yêu cầu?
- created: 2026-10-22
- enriched: 2026-10-22

A fintech company hosts a customer-facing REST API on AWS Lambda behind Amazon API Gateway. The functions use the Java 17 runtime and load a large dependency framework during start-up, so the first request that reaches each new execution environment takes several seconds. Traffic is spiky: it jumps from a handful of requests to thousands per second within a minute after each push notification, and the marketing team sends the notifications at fixed, published times. The company wants to remove this start-up delay without rewriting the functions. Which solution will give the LOWEST and most predictable start-up latency?

- A. Raise the memory setting of each function to the maximum value so that the start-up code finishes faster on every new execution environment.
- B. Enable Lambda SnapStart on each function, publish a version, and send traffic to that version through an alias.
- C. Set reserved concurrency on each function to the expected peak so that Lambda keeps initialized execution environments ready for traffic.
- D. Configure provisioned concurrency on a published version and adjust it with Application Auto Scaling to match the expected traffic.

**Answer:** D

**Explanation:** Provisioned concurrency keeps execution environments initialized and ready to respond in double-digit milliseconds, and because the notification times are known, Application Auto Scaling scheduled actions can raise it before each burst. AWS recommends provisioned concurrency when start-up targets are stricter than SnapStart can meet.
- SnapStart: cuts start-up to as low as sub-second but still restores each new environment on demand, so start-up latency is lower but not the lowest (vi phạm ràng buộc "LOWEST and most predictable")
- Maximum memory: initialization still runs on every new environment (vi phạm ràng buộc)
- Reserved concurrency: caps or reserves capacity but pre-initializes nothing (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html
> 🇻🇳 Cần độ trễ khởi động thấp và dễ đoán nhất, giờ cao điểm biết trước → provisioned concurrency (hàng chục ms, scale theo lịch); SnapStart chỉ giảm xuống mức dưới một giây.

---

## Q ai-20261022-a32-06
- domain: performance
- task: 3.2
- topic: compute
- services: Lambda, API Gateway, SQS
- tags: decoupling, async-invocation, lambda-destinations
- difficulty: medium
- time: 135
- skills: 3.2.s1, 3.2.k5, 3.2.k3
- concept: Invoking a function asynchronously hands the event to Lambda's internal queue with automatic retries, decoupling the caller from a slow step, and an on-failure destination captures events that still fail
- refs: 01-compute-services.md, 07-application-integration.md
- hint: Bước biên lai chậm và hay lỗi làm checkout chậm theo — cách gọi hàm nào cho phép bên gọi trả lời ngay mà Lambda tự xếp hàng và thử lại?
- created: 2026-10-22
- enriched: 2026-10-22

A subscription company's checkout API runs on AWS Lambda behind Amazon API Gateway. After charging the card, the checkout function synchronously invokes a second function that generates a PDF receipt, uploads it to Amazon S3, and emails the customer. The second function takes about four seconds and sometimes fails when the email provider is down, so checkout responses are slow and customers see errors for receipts they do not need immediately. The company wants checkout to respond right away, the receipt step to scale on its own with automatic retries, and failed receipt events to be kept for inspection, with the LEAST code. Which solution will meet these requirements?

- A. Invoke the receipt function asynchronously from the checkout function and configure an on-failure destination, such as an Amazon SQS queue, on the receipt function.
- B. Invoke the receipt function asynchronously from the checkout function and set its maximum retry attempts to zero so that failures surface at once.
- C. Start a synchronous AWS Step Functions Express workflow from the checkout function that runs the receipt step with Retry and Catch rules.
- D. Keep the synchronous invocation and configure an on-failure destination, such as an Amazon SQS queue, on the receipt function to capture the failed receipt events for inspection.

**Answer:** A

**Explanation:** Asynchronous invocation hands the event to Lambda, which queues it, returns at once, and retries failures automatically; an on-failure destination keeps events that still fail, so checkout is decoupled and the receipt step scales on its own with almost no code.
- Asynchronous call with zero retries: returns at once but gives up the automatic retries (vi phạm ràng buộc)
- Synchronous Express workflow: adds retries, but checkout still waits for the workflow to finish (vi phạm ràng buộc)
- On-failure destination on a synchronous call: destinations apply only to asynchronous and stream invocations (cấu hình không tồn tại)
Docs: https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html
> 🇻🇳 Bước phụ chậm/hay lỗi → gọi bất đồng bộ (Lambda tự xếp hàng, thử lại) + on-failure destination; không cần thêm code.

---

## Q ai-20261022-a32-07
- domain: performance
- task: 3.2
- topic: compute
- services: Lambda
- tags: lambda-memory, right-sizing
- difficulty: easy
- time: 100
- skills: 3.2.s4, 3.2.k5
- concept: Lambda allocates CPU in proportion to memory, so a CPU-bound function that uses little memory is sped up by raising the memory setting
- refs: 01-compute-services.md, R-performance-benchmarks.md
- hint: Hàm nặng CPU dù chỉ dùng ít bộ nhớ — Lambda chỉ cho một thiết lập duy nhất để điều chỉnh sức mạnh tính toán, đó là gì?
- created: 2026-10-22
- enriched: 2026-10-22

A company runs an image-resizing AWS Lambda function that a web application invokes synchronously whenever a user uploads a photo. The function is configured with 256 MB of memory, never uses more than 150 MB, and each invocation is CPU-bound and takes about 6 seconds. The product team wants invocations to finish in under 2 seconds without rewriting the code, and the traffic level is moderate and steady. Which action will meet this requirement with the LEAST effort?

- A. Turn on Lambda SnapStart for the function so that each invocation resumes from a snapshot of an initialized environment.
- B. Configure provisioned concurrency on the function so that warm execution environments with the same memory are ready for every upload.
- C. Raise the function's memory setting and benchmark a few sizes to find the smallest one that meets the duration goal.
- D. Switch the function to the arm64 architecture so that the image processing runs on AWS Graviton processors.

**Answer:** C

**Explanation:** Lambda allocates CPU power in proportion to the configured memory, so raising memory speeds up a CPU-bound function even though it uses little of it; testing a few sizes finds the cheapest setting that meets the 2-second goal.
- SnapStart: shortens initialization, but the 6 seconds are spent in the handler (giải bài toán khác)
- Provisioned concurrency: removes cold starts, but each warm invocation is still CPU-bound for 6 seconds (giải bài toán khác)
- arm64 architecture: better price performance, but it does not add the CPU needed to cut 6 seconds to under 2 (vi phạm ràng buộc)
Docs: https://docs.aws.amazon.com/lambda/latest/dg/configuration-memory.html
> 🇻🇳 Hàm Lambda nặng CPU → tăng memory (CPU tỉ lệ theo memory) và thử vài mức để đạt thời gian mong muốn.

---

## Q ai-20261022-a32-08
- domain: performance
- task: 3.2
- topic: compute
- services: ECS, EC2 Auto Scaling, EC2
- tags: ecs-capacity-provider, scaling-policies
- difficulty: medium
- time: 130
- skills: 3.2.k6, 3.2.k4, 3.2.s2
- concept: ECS service auto scaling adds tasks, but the container instances need an Auto Scaling group capacity provider with managed scaling so that tasks do not sit in PENDING
- refs: 01-compute-services.md
- hint: Task chờ ở trạng thái PENDING vì cụm hết chỗ — ai chịu trách nhiệm thêm instance khi không đặt được task?
- created: 2026-10-22
- enriched: 2026-10-22

A company runs a containerized API as an Amazon ECS service on Amazon EC2 container instances that belong to an Auto Scaling group. The service uses target tracking on CPU to add tasks during traffic spikes, but new tasks often stay in the PENDING state for several minutes because the cluster has no free capacity until an operator raises the group's desired capacity by hand. The company has standardized on EC2 container instances for this cluster. It wants tasks to start promptly during spikes and the instance fleet to follow the tasks that need to run, with minimal ongoing effort. Which solution will meet these requirements?

- A. Create an ECS capacity provider for the Auto Scaling group with managed scaling turned on, and add it to the service's strategy.
- B. Move the service to AWS Fargate capacity so that each new task receives its own compute without container instances to scale.
- C. Add a target tracking policy to the Auto Scaling group that keeps the average CPU utilization of the container instances at 50 percent.
- D. Add a step scaling policy to the ECS service on its CPU utilization so that tasks are requested earlier in each traffic spike.

**Answer:** A

**Explanation:** An ECS capacity provider with managed scaling publishes a reservation metric and scales the Auto Scaling group, adding instances when tasks cannot be placed and removing idle ones, with no manual changes.
- Fargate: removes instance scaling, but the company has standardized on EC2 container instances (vi phạm ràng buộc)
- Instance CPU target tracking: pending tasks create no CPU load, so the group does not grow when tasks cannot be placed (dùng sai tính năng)
- Service step scaling: requests tasks sooner but adds no container instances to place them on (giải bài toán khác)
Docs: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cluster-auto-scaling.html
> 🇻🇳 ECS trên EC2: service auto scaling tăng số task, còn capacity provider + managed scaling tăng/giảm số instance theo nhu cầu đặt task.

---

## Q ai-20261022-a32-09
- domain: performance
- task: 3.2
- topic: compute
- services: EKS, Fargate
- tags: eks-auto-mode, node-autoscaling
- difficulty: hard
- time: 145
- skills: 3.2.k6, 3.2.s3
- concept: EKS Auto Mode provisions and removes right-sized nodes for unschedulable pods with the least operational overhead; Fargate has no GPUs, self-managed Karpenter adds ops, HPA scales pods not nodes
- refs: 01-compute-services.md
- hint: Pod chờ vì không có node đúng cỡ và đội vận hành nhỏ — giải pháp nào để AWS lo việc chọn cỡ và thêm/bớt node?
- created: 2026-10-22
- enriched: 2026-10-22

A company runs batch workloads on an Amazon EKS cluster that uses one managed node group of general purpose instances. Jobs arrive in bursts, and their pods request very different amounts of CPU, memory, and GPU. Pods wait for several minutes while the Cluster Autoscaler grows the node group, and many nodes sit mostly idle because the pod sizes do not fit the single instance type. The platform team is small. It wants nodes to be provisioned quickly, sized to the pending pods, and removed when unused, with the LEAST operational overhead. Which solution will meet these requirements?

- A. Move the batch pods from the EKS node group to AWS Fargate profiles so that each pod receives its own right-sized compute capacity.
- B. Install and operate Karpenter on the EKS cluster and define NodePools that provision nodes of the instance types that the pods need.
- C. Enable EKS Auto Mode on the cluster so that AWS provisions nodes for pods that cannot be scheduled and deletes nodes that are no longer needed.
- D. Configure a Horizontal Pod Autoscaler on the EKS cluster to increase the number of pod replicas when the average CPU utilization of the pods rises.

**Answer:** C

**Explanation:** EKS Auto Mode runs Karpenter-based compute autoscaling for you: it watches for pods that cannot be scheduled, launches nodes sized to them, and deletes unused nodes, while AWS operates the node infrastructure, which minimizes operational overhead.
- Fargate profiles: GPUs are not available on Fargate, but some pods need them (vi phạm ràng buộc)
- Self-managed Karpenter: provisions similarly, but the team must install, upgrade, and operate it (tốn vận hành hơn)
- Horizontal Pod Autoscaler: changes the number of pods, not the number or size of nodes (giải bài toán khác)
Docs: https://docs.aws.amazon.com/eks/latest/userguide/automode.html
> 🇻🇳 Pod pending vì thiếu node đúng cỡ, đội nhỏ → EKS Auto Mode (Karpenter do AWS vận hành); Fargate không có GPU; HPA chỉ scale pod.

---

## Q ai-20261022-a32-10
- domain: performance
- task: 3.2
- topic: compute
- services: EC2
- tags: placement-groups, efa
- difficulty: hard
- time: 155
- skills: 3.2.s3, 3.2.k2
- concept: Tightly coupled MPI jobs need a cluster placement group (one AZ, launched together) plus Elastic Fabric Adapter; spread and partition groups are for fault isolation and multiple AZs add latency
- refs: 01-compute-services.md, R-performance-benchmarks.md
- hint: Mục tiêu duy nhất là độ trễ và băng thông giữa các node — chiến lược đặt máy nào gom gần nhau, và card mạng nào bỏ qua kernel?
- created: 2026-10-22
- enriched: 2026-10-22

An engineering firm runs tightly coupled computational fluid dynamics simulations that use the Message Passing Interface (MPI) across 64 Amazon EC2 instances. Profiling shows that network latency and per-flow throughput between the instances limit how well the jobs scale. The jobs run for hours, checkpoint to Amazon S3, and can tolerate running in a single Availability Zone. Which combination of steps will give the instances the lowest-latency, highest-throughput communication? (Choose TWO)

- A. Launch the instances in a cluster placement group that spans two Availability Zones so that capacity is easier to obtain.
- B. Use instance types with enhanced networking through the Elastic Network Adapter and turn on jumbo frames for the MPI traffic.
- C. Launch all of the instances in one request into a cluster placement group in one Availability Zone.
- D. Launch the instances in a partition placement group in one Availability Zone and place each group of MPI ranks in its own partition.
- E. Use instance types that support Elastic Fabric Adapter and attach an EFA to each instance for the MPI traffic.

**Answer:** C, E

**Explanation:** A cluster placement group packs the instances close together in one Availability Zone for low latency and high per-flow throughput, and an Elastic Fabric Adapter lets MPI bypass the operating system network stack for lower, more consistent latency.
- Cluster placement group across two zones: a cluster placement group lives in a single Availability Zone (cấu hình không tồn tại)
- ENA with jumbo frames: helps throughput, but MPI still goes through the kernel network stack, so latency stays above EFA (đúng một phần)
- Partition placement group: separates racks for fault isolation, not for tightly coupled MPI (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/placement-strategies.html
> 🇻🇳 HPC/MPI cần độ trễ thấp nhất → cluster placement group (một AZ) + EFA; spread/partition để chịu lỗi, nhiều AZ làm tăng độ trễ.

---

## Q ai-20261022-a32-11
- domain: performance
- task: 3.2
- topic: compute
- services: EC2
- tags: instance-families, right-sizing
- difficulty: hard
- time: 155
- skills: 3.2.s3, 3.2.k1
- concept: Pick the instance family by the dominant resource: memory optimized for in-memory data, compute optimized for CPU-bound encoding, accelerated computing for GPU training
- refs: 01-compute-services.md, R-performance-benchmarks.md
- hint: Với mỗi tầng, tìm tài nguyên chiếm ưu thế (RAM, CPU hay GPU) rồi chọn họ instance tương ứng — mỗi tầng chỉ có một lựa chọn đúng.
- created: 2026-10-22
- enriched: 2026-10-22

A data-science platform team is choosing Amazon EC2 instance families for three tiers. The first tier is an in-memory analytics engine that keeps a 400 GiB working set in RAM. The second is a video-encoding service that is CPU-bound and needs no GPU. The third trains deep-learning models with GPU-accelerated frameworks. The team wants each tier to run on the family whose dominant resource matches its workload. Which combination of choices will meet these requirements? (Choose THREE)

- A. Run the in-memory analytics tier on memory optimized instances such as the R family.
- B. Run the video-encoding tier on general purpose instances such as the M family.
- C. Run the model-training tier on accelerated computing instances such as the Inf family.
- D. Run the in-memory analytics tier on storage optimized instances such as the I family.
- E. Run the video-encoding tier on compute optimized instances such as the C family.
- F. Run the model-training tier on accelerated computing instances such as the P family.

**Answer:** A, E, F

**Explanation:** Match each tier's dominant resource: memory optimized R instances give the high RAM-to-vCPU ratio for in-memory data, compute optimized C instances give the most CPU per dollar for encoding, and accelerated computing P instances provide the GPUs for training.
- General purpose M instances for encoding: a balanced ratio, so the CPU-bound tier does not run on a CPU-dominant family (vi phạm ràng buộc)
- Inferentia Inf instances for training: accelerators built for inference, not for training models (dùng sai tính năng)
- Storage optimized I instances for analytics: fast local NVMe disk, not the RAM a 400 GiB working set needs (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/ec2/latest/instancetypes/instance-types.html
> 🇻🇳 Chọn họ instance theo tài nguyên chính: R cho RAM, C cho CPU, P cho GPU; T (burst), I (NVMe) và M không hợp.

---

## Q ai-20261022-a32-12
- domain: performance
- task: 3.2
- topic: compute
- services: AWS Batch, EMR, Lambda, ECS
- tags: batch-processing, spot-instances
- difficulty: medium
- time: 125
- skills: 3.2.k1, 3.2.s3
- concept: Large numbers of independent, long-running containerized tasks fit AWS Batch (queue, automatic scaling, Spot); EMR targets Spark/Hadoop and Lambda has a runtime limit
- refs: 01-compute-services.md, 09-analytics-bigdata.md
- hint: Hàng nghìn tác vụ container độc lập, chạy hàng chục phút — dịch vụ nào có hàng đợi job và tự co giãn năng lực tính toán theo số job?
- created: 2026-10-22
- enriched: 2026-10-22

A pharmaceutical company runs a molecular-docking simulation made of about 8,000 independent containerized tasks. Each task needs 4 vCPUs and 16 GiB of memory, runs for 30 to 90 minutes, and writes its results to Amazon S3. Today engineers launch EC2 instances and start the containers by hand, which leaves capacity idle and delays queued work. The company wants submitted tasks to wait for capacity automatically, compute capacity to scale with the number of waiting tasks, and the lowest compute cost, with its container images unchanged. Which solution will meet these requirements with the LEAST operational overhead?

- A. Start each task as an Amazon ECS task on AWS Fargate Spot from an EventBridge rule and retry the tasks that fail to start.
- B. Submit the tasks to AWS Batch as an array job on a managed compute environment that uses Spot Instances and a job queue.
- C. Submit the tasks to AWS Batch as an array job on a managed compute environment that uses On-Demand Instances and a job queue.
- D. Run the containers on an Amazon EKS cluster that uses Karpenter, and submit each task as a Kubernetes Job resource.

**Answer:** B

**Explanation:** AWS Batch queues jobs, provisions and scales compute for them, runs unchanged container images, and can use Spot Instances for the lowest cost; an array job submits many tasks as one request.
- ECS on Fargate Spot from EventBridge: no job queue, so tasks that cannot start need custom retry logic (tốn vận hành hơn)
- AWS Batch on On-Demand Instances: meets the queueing needs but misses the lowest compute cost (tốn chi phí hơn)
- EKS with Karpenter and Kubernetes Jobs: scales nodes, but the team operates the cluster and the job scheduling (tốn vận hành hơn)
Docs: https://docs.aws.amazon.com/batch/latest/userguide/what-is-batch.html
> 🇻🇳 Hàng nghìn job container độc lập, chạy lâu → AWS Batch (hàng đợi, tự scale, Spot); Lambda có giới hạn thời gian, EMR dành cho Spark/Hadoop.

---

## Q ai-20261022-a32-13
- domain: performance
- task: 3.2
- topic: compute
- services: CloudFront, Lambda
- tags: lambda-edge, edge-compute
- difficulty: medium
- time: 110
- skills: 3.2.k2, 3.2.k5
- concept: Edge logic that needs network access, the AWS SDK, or more than a few milliseconds belongs in Lambda@Edge; CloudFront Functions and KeyValueStore cannot call external services
- refs: 04-networking-services.md, 01-compute-services.md
- hint: Logic phải gọi API bên ngoài và AWS SDK ngay tại edge — loại edge function nào được phép truy cập mạng, loại nào thì không?
- created: 2026-10-22
- enriched: 2026-10-22

An online retailer serves its storefront through Amazon CloudFront. Before a request is forwarded to the origin, the retailer must validate a session token by calling an external identity API over HTTPS and must read a per-country pricing rule with the AWS SDK. The extra processing may take a few tens of milliseconds, and the retailer wants the logic to run close to viewers without managing servers. Which solution will meet these requirements?

- A. Associate CloudFront Functions with the viewer request event and have the function call the identity API and read the pricing rule.
- B. Copy the identity provider's token data into a CloudFront KeyValueStore and look it up from a CloudFront Function on every request.
- C. Associate Lambda@Edge functions with the viewer request event of the distribution to call the identity API and read the pricing rule.
- D. Run the checks on the origin servers behind an Application Load Balancer and reject invalid requests there before serving the page.

**Answer:** C

**Explanation:** Lambda@Edge runs Node.js or Python code at the edge with network access, support for the AWS SDK, and longer run times, so it can call the identity API and read the pricing rule without servers to manage.
- CloudFront Functions calling an API: they have no network access and run for under a millisecond (vi phạm ràng buộc)
- KeyValueStore lookup: holds static data that you publish, so it cannot validate tokens against a live API (dùng sai tính năng)
- Checks at the origin: every request pays an origin round trip, so the logic is not close to viewers (đặt sai chỗ)
Docs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/edge-functions-choosing.html
> 🇻🇳 Logic cần gọi API ngoài/AWS SDK tại edge → Lambda@Edge; CloudFront Functions không có truy cập mạng.
