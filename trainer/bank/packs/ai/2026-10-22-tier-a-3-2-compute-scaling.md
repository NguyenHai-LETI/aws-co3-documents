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
- skills: 3.2.s1, 3.2.k3, 3.2.s2
- concept: Decouple a synchronous heavy task with S3 plus SQS and scale the worker group with target tracking on a backlog-per-instance metric, not on raw queue length
- refs: 07-application-integration.md, 01-compute-services.md
- hint: Hai tầng phải scale độc lập và không mất upload — chỉ số nào tăng/giảm tỉ lệ với số instance để target tracking hội tụ?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 160

A media company's web application runs on Amazon EC2 instances in an Auto Scaling group behind an Application Load Balancer. When a user uploads a video, the web server transcodes it synchronously, which takes up to 20 minutes of CPU time. During promotions the web tier saturates, page requests time out, and uploads are lost when instances are replaced. The company wants the web tier and the transcoding workers to scale independently, to absorb bursts without losing uploads, and to add worker capacity in proportion to the amount of waiting work. Which combination of steps will meet these requirements? (Choose TWO)

- A. Publish each upload to an Amazon SNS topic that has the transcoding workers' HTTP endpoints subscribed, and scale the web tier's Auto Scaling group on CPU utilization.
- B. Store each upload in Amazon S3, send a message that references it to an Amazon SQS queue, and run the transcoding workers in a separate Auto Scaling group.
- C. Configure target tracking on the queue's ApproximateNumberOfMessagesVisible metric so that the worker group's capacity follows the queue length.
- D. Configure target tracking on a backlog-per-instance metric calculated from the queue length and the number of in-service instances.
- E. Invoke an AWS Lambda function synchronously from the web servers to transcode each upload and increase the function's reserved concurrency.

**Answer:** B, D

**Explanation:** The queue buffers uploads so the two tiers scale independently and nothing is lost, and a backlog-per-instance metric (queue length divided by in-service instances) gives target tracking a value that moves in proportion to the waiting work.
- SNS push to worker endpoints: no durable buffer, so bursts overload or drop work (dùng sai tính năng)
- Target tracking on raw queue length: it does not change in proportion to group size, so it cannot converge (dùng sai tính năng)
- Synchronous Lambda calls: a function's maximum run time is shorter than the 20-minute jobs (vi phạm ràng buộc)
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
- skills: 3.2.s2, 3.2.k4
- concept: For an I/O-bound service whose CPU stays low, target tracking on ALBRequestCountPerTarget follows demand; load balancer RequestCount and CPU do not
- refs: 01-compute-services.md, 04-networking-services.md
- hint: Ứng dụng chủ yếu chờ dịch vụ ngoài nên CPU không phản ánh tải — chỉ số nào chia tải cho số target và đổi ngược chiều với số instance?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 125

An online ticketing platform runs its API on Amazon EC2 instances in an Auto Scaling group behind an Application Load Balancer. Each request spends most of its time waiting on a payment provider, so average CPU utilization stays near 20% even while response times climb during on-sale events. The group scales with a target tracking policy on average CPU utilization, which almost never triggers, and the start times of sales are not announced in advance. The company wants capacity to follow demand automatically with the LEAST operational effort. Which change should a solutions architect make?

- A. Add scheduled scaling actions that raise the desired capacity at the usual start times of past on-sale events and lower it afterward.
- B. Lower the CPU utilization target of the existing policy to 10% so that the group reacts to even small increases in load on the instances.
- C. Replace the policy with target tracking on the Application Load Balancer RequestCount metric, which counts every request that reaches the load balancer.
- D. Replace the policy with target tracking on the ALBRequestCountPerTarget metric and set a target value that one instance can serve.

**Answer:** D

**Explanation:** ALBRequestCountPerTarget divides the load balancer's requests by the number of targets, so it falls as instances are added and rises with demand, as target tracking needs; CPU ignores time spent waiting on a downstream service.
- Scheduled scaling: relies on repeating start times, but sale times are not announced (vi phạm ràng buộc)
- A 10% CPU target: CPU still does not reflect the real load, so it would mostly over-provision (dùng sai tính năng)
- Load balancer RequestCount: total requests do not shrink as instances are added, so target tracking cannot converge on it (dùng sai tính năng)
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
- skills: 3.2.s2, 3.2.k4
- concept: Shifting cyclical load plus long instance initialization: predictive scaling launches capacity ahead of the forecast and a warm pool of pre-initialized stopped instances removes boot time from scale-out
- refs: 01-compute-services.md
- hint: Mẫu tải đổi theo chiến dịch và mỗi instance mất vài phút để sẵn sàng — cần vừa dự báo trước vừa rút ngắn thời gian khởi động.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 165

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
- skills: 3.2.k5, 3.2.s4
- family: lambda-java-cold-start
- concept: For a Java Lambda function, SnapStart removes most of the cold-start delay at no additional charge, which beats provisioned concurrency on cost
- refs: 01-compute-services.md, R-performance-benchmarks.md
- hint: Runtime là Java và đề hỏi phương án tiết kiệm nhất — tính năng nào giảm khởi tạo mà không tính thêm phí cho Java?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 115

A fintech company hosts a customer-facing REST API on AWS Lambda behind Amazon API Gateway. The functions use the Java 17 runtime and load a large dependency framework during start-up, so the first request that reaches each new execution environment takes several seconds. Traffic is spiky: it can jump from a handful of requests to thousands per second within a minute after a push notification. The company wants to remove this start-up delay without rewriting the functions. Which solution will meet these requirements MOST cost-effectively?

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
- skills: 3.2.k5, 3.2.s4
- family: lambda-java-cold-start
- concept: When start-up latency must be the lowest and most predictable, provisioned concurrency (double-digit milliseconds) beats SnapStart (sub-second at best)
- refs: 01-compute-services.md, R-performance-benchmarks.md
- hint: Đổi qualifier: giờ cần độ trễ khởi động thấp và dễ đoán nhất — tính năng nào giữ sẵn môi trường đã khởi tạo thay vì khôi phục theo yêu cầu?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A fintech company hosts a customer-facing REST API on AWS Lambda behind Amazon API Gateway. The functions use the Java 17 runtime and load a large dependency framework during start-up, so the first request that reaches each new execution environment takes several seconds. Traffic is spiky: it can jump from a handful of requests to thousands per second within a minute after a push notification. The company wants to remove this start-up delay without rewriting the functions. Which solution will give the LOWEST and most predictable start-up latency?

- A. Raise the memory setting of each function to the maximum value so that the start-up code finishes faster on every new execution environment.
- B. Enable Lambda SnapStart on each function, publish a version, and send traffic to that version through an alias.
- C. Set reserved concurrency on each function to the expected peak so that Lambda keeps initialized execution environments ready for traffic.
- D. Configure provisioned concurrency on a published version and adjust it with Application Auto Scaling to match the expected traffic.

**Answer:** D

**Explanation:** Provisioned concurrency keeps execution environments initialized and ready to respond in double-digit milliseconds, and Application Auto Scaling can follow the traffic; AWS recommends it when SnapStart cannot meet strict start-up targets.
- SnapStart: cuts start-up to sub-second at best but still resumes environments on demand, so latency is not eliminated (vi phạm ràng buộc)
- Maximum memory: initialization still runs on every new environment (vi phạm ràng buộc)
- Reserved concurrency: caps or reserves capacity but pre-initializes nothing (dùng sai tính năng)
Docs: https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html
> 🇻🇳 Cần độ trễ khởi động thấp và dễ đoán nhất → provisioned concurrency (hàng chục ms); SnapStart chỉ giảm xuống dưới một giây.

---

## Q ai-20261022-a32-06
- domain: performance
- task: 3.2
- topic: compute
- services: Lambda, API Gateway, SQS
- tags: decoupling, async-invocation, lambda-destinations
- difficulty: medium
- skills: 3.2.s1, 3.2.k5, 3.2.k3
- concept: Invoking a function asynchronously hands the event to Lambda's internal queue with automatic retries, decoupling the caller from a slow step, and an on-failure destination captures events that still fail
- refs: 01-compute-services.md, 07-application-integration.md
- hint: Bước biên lai chậm và hay lỗi làm checkout chậm theo — cách gọi hàm nào cho phép bên gọi trả lời ngay mà Lambda tự xếp hàng và thử lại?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 135

A subscription company's checkout API runs on AWS Lambda behind Amazon API Gateway. After charging the card, the checkout function synchronously invokes a second function that generates a PDF receipt, uploads it to Amazon S3, and emails the customer. The second function takes about four seconds and sometimes fails when the email provider is down, so checkout responses are slow and customers see errors for receipts they do not need immediately. The company wants checkout to respond right away, the receipt step to scale on its own with automatic retries, and failed receipt events to be kept for inspection, with the LEAST code. Which solution will meet these requirements?

- A. Invoke the receipt function asynchronously from the checkout function and configure an on-failure destination, such as an Amazon SQS queue, on the receipt function.
- B. Keep the synchronous invocation and raise the memory of the receipt function so that it finishes before the checkout function times out.
- C. Increase the timeout of the checkout function and add code that invokes the receipt function again whenever the first call fails.
- D. Set the reserved concurrency of the receipt function to one so that receipts are generated one at a time and cannot overwhelm the email provider.

**Answer:** A

**Explanation:** Asynchronous invocation hands the event to Lambda, which queues it, returns at once, and retries failures automatically; an on-failure destination keeps events that still fail, so checkout is decoupled and the receipt step scales on its own with almost no code.
- Synchronous call with more memory: the caller still waits and fails when the callee fails (vi phạm ràng buộc)
- Retry code in the caller: more code, and the caller still blocks (tốn vận hành hơn)
- Reserved concurrency of one: throttles receipts and does not decouple the caller (giải bài toán khác)
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
- skills: 3.2.s4, 3.2.k5
- concept: Lambda allocates CPU in proportion to memory, so a CPU-bound function that uses little memory is sped up by raising the memory setting
- refs: 01-compute-services.md, R-performance-benchmarks.md
- hint: Hàm nặng CPU dù chỉ dùng ít bộ nhớ — Lambda chỉ cho một thiết lập duy nhất để điều chỉnh sức mạnh tính toán, đó là gì?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

A company runs an image-resizing AWS Lambda function that a web application invokes synchronously whenever a user uploads a photo. The function is configured with 256 MB of memory, never uses more than 150 MB, and each invocation is CPU-bound and takes about 6 seconds. The product team wants invocations to finish in under 2 seconds without rewriting the code, and the traffic level is moderate and steady. Which action will meet this requirement with the LEAST effort?

- A. Increase the Lambda function's ephemeral storage size so that the image data is processed from a larger local disk instead of from memory.
- B. Raise the Lambda function's reserved concurrency so that more invocations can run in parallel at the same time during each upload burst.
- C. Increase the function's memory setting, because Lambda allocates CPU power in proportion to memory, and test sizes against the duration goal.
- D. Request a higher vCPU quota for the Lambda function through Service Quotas so that each invocation can use more CPU than its memory setting allows.

**Answer:** C

**Explanation:** Lambda allocates CPU power in proportion to the configured memory, so raising memory speeds up a CPU-bound function even though it uses little of it; testing a few sizes finds the cheapest setting that meets the 2-second goal.
- Ephemeral storage: adds scratch disk space, not CPU (dùng sai tính năng)
- Reserved concurrency: runs more invocations in parallel but shortens none of them (giải bài toán khác)
- vCPU quota request: Lambda has no CPU setting or quota; CPU follows memory (cấu hình không tồn tại)
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
- skills: 3.2.k6, 3.2.k4, 3.2.s2
- concept: ECS service auto scaling adds tasks, but the container instances need an Auto Scaling group capacity provider with managed scaling so that tasks do not sit in PENDING
- refs: 01-compute-services.md
- hint: Task chờ ở trạng thái PENDING vì cụm hết chỗ — ai chịu trách nhiệm thêm instance khi không đặt được task?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 130

A company runs a containerized API as an Amazon ECS service on Amazon EC2 container instances that belong to an Auto Scaling group. The service uses target tracking on CPU to add tasks during traffic spikes, but new tasks often stay in the PENDING state for several minutes because the cluster has no free capacity until an operator raises the group's desired capacity by hand. The company has standardized on EC2 container instances for this cluster. It wants tasks to start promptly during spikes and the instance fleet to follow the tasks that need to run, with minimal ongoing effort. Which solution will meet these requirements?

- A. Create an ECS capacity provider for the Auto Scaling group with managed scaling turned on, and add it to the service's strategy.
- B. Add a target tracking policy on the Auto Scaling group that keeps the average CPU utilization of the ECS container instances at 50 percent.
- C. Raise the service's minimum task count to the expected peak so that every task that might be needed is already running.
- D. Replace the container instances with a larger instance type so that each instance can host more tasks at the same time, which adds capacity.

**Answer:** A

**Explanation:** An ECS capacity provider with managed scaling publishes a reservation metric and scales the Auto Scaling group, adding instances when tasks cannot be placed and removing idle ones, with no manual changes.
- Instance CPU policy: pending tasks create no CPU load, so the group does not scale out (dùng sai tính năng)
- Higher minimum task count: pays for peak-sized capacity all day and still needs instances (tốn chi phí hơn)
- Larger instance type: raises per-instance capacity but adds no instances when the cluster is full (giải bài toán khác)
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
- skills: 3.2.k6, 3.2.s3
- concept: EKS Auto Mode provisions and removes right-sized nodes for unschedulable pods with the least operational overhead; Fargate has no GPUs, self-managed Karpenter adds ops, HPA scales pods not nodes
- refs: 01-compute-services.md
- hint: Pod chờ vì không có node đúng cỡ và đội vận hành nhỏ — giải pháp nào để AWS lo việc chọn cỡ và thêm/bớt node?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 145

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
- skills: 3.2.s3, 3.2.k2
- concept: Tightly coupled MPI jobs need a cluster placement group (one AZ, launched together) plus Elastic Fabric Adapter; spread and partition groups are for fault isolation and multiple AZs add latency
- refs: 01-compute-services.md, R-performance-benchmarks.md
- hint: Mục tiêu duy nhất là độ trễ và băng thông giữa các node — chiến lược đặt máy nào gom gần nhau, và card mạng nào bỏ qua kernel?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 150

An engineering firm runs tightly coupled computational fluid dynamics simulations that use the Message Passing Interface (MPI) across 64 Amazon EC2 instances. Profiling shows that network latency and per-flow throughput between the instances limit how well the jobs scale. The jobs run for hours, checkpoint to Amazon S3, and can tolerate running in a single Availability Zone. Which combination of steps will give the instances the lowest-latency, highest-throughput communication? (Choose TWO)

- A. Launch the instances in a spread placement group in one Availability Zone so that each instance runs on distinct underlying hardware.
- B. Launch the instances in a partition placement group and assign each MPI rank to a separate partition.
- C. Launch all of the instances in one request into a cluster placement group in one Availability Zone.
- D. Spread the instances evenly across three Availability Zones so that the loss of one zone cannot stop the simulation.
- E. Use instance types that support Elastic Fabric Adapter and attach an EFA to each instance for the MPI traffic.

**Answer:** C, E

**Explanation:** A cluster placement group packs the instances close together in one Availability Zone for low latency and high per-flow throughput, and an Elastic Fabric Adapter lets MPI bypass the operating system network stack for lower, more consistent latency.
- Spread placement group: isolates instances on distinct hardware for fault tolerance, not for speed (dùng sai tính năng)
- Partition placement group: separates racks for large distributed stores such as HDFS, not tightly coupled MPI (dùng sai tính năng)
- Three Availability Zones: improves resilience but adds inter-zone latency (giải bài toán khác)
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
- skills: 3.2.s3, 3.2.k1
- concept: Pick the instance family by the dominant resource: memory optimized for in-memory data, compute optimized for CPU-bound encoding, accelerated computing for GPU training
- refs: 01-compute-services.md, R-performance-benchmarks.md
- hint: Với mỗi tầng, tìm tài nguyên chiếm ưu thế (RAM, CPU hay GPU) rồi chọn họ instance tương ứng — mỗi tầng chỉ có một lựa chọn đúng.
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 155

A data-science platform team is choosing Amazon EC2 instance families for three tiers. The first tier is an in-memory analytics engine that keeps a 400 GiB working set in RAM. The second is a video-encoding service that is CPU-bound and needs no GPU. The third trains deep-learning models with GPU-accelerated frameworks. The team wants each tier to run on the family whose dominant resource matches its workload. Which combination of choices will meet these requirements? (Choose THREE)

- A. Run the in-memory analytics tier on memory optimized instances such as the R family.
- B. Run the video-encoding tier on storage optimized instances such as the I family.
- C. Run the model-training tier on general purpose instances such as the M family.
- D. Run the in-memory analytics tier on burstable performance instances such as the T family.
- E. Run the video-encoding tier on compute optimized instances such as the C family.
- F. Run the model-training tier on accelerated computing instances such as the P family.

**Answer:** A, E, F

**Explanation:** Match each tier's dominant resource: memory optimized R instances give the high RAM-to-vCPU ratio for in-memory data, compute optimized C instances give the most CPU per dollar for encoding, and accelerated computing P instances provide the GPUs for training.
- Burstable T instances for analytics: limited memory and CPU credits cannot sustain the load (vi phạm ràng buộc)
- Storage optimized I instances for encoding: pay for local NVMe that CPU-bound encoding does not use (tốn chi phí hơn)
- General purpose M instances for training: no GPUs (vi phạm ràng buộc)
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
- skills: 3.2.k1, 3.2.s3
- concept: Large numbers of independent, long-running containerized tasks fit AWS Batch (queue, automatic scaling, Spot); EMR targets Spark/Hadoop and Lambda has a runtime limit
- refs: 01-compute-services.md, 09-analytics-bigdata.md
- hint: Hàng nghìn tác vụ container độc lập, chạy hàng chục phút — dịch vụ nào có hàng đợi job và tự co giãn năng lực tính toán theo số job?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 125

A pharmaceutical company runs a molecular-docking simulation made of about 8,000 independent containerized tasks. Each task needs 4 vCPUs and 16 GiB of memory, runs for 30 to 90 minutes, and writes its results to Amazon S3. Today engineers launch EC2 instances and start the containers by hand, which leaves capacity idle and delays queued work. The company wants submitted tasks to wait for capacity automatically, compute capacity to scale with the number of waiting tasks, and the lowest compute cost, with its container images unchanged. Which solution will meet these requirements with the LEAST operational overhead?

- A. Create an Amazon EMR cluster, install the container runtime on the core nodes, and submit the tasks as Spark steps.
- B. Submit the tasks to AWS Batch as an array job on a managed compute environment that uses Spot Instances and a job queue.
- C. Invoke an AWS Lambda function for every task and configure the function with its maximum timeout and memory for the compute.
- D. Run each task as an Amazon ECS task on an Auto Scaling group whose compute capacity is sized in advance with scheduled scaling actions.

**Answer:** B

**Explanation:** AWS Batch queues jobs, provisions and scales compute for them, runs unchanged container images, and can use Spot Instances for the lowest cost; an array job submits many tasks as one request.
- EMR: managed Hadoop and Spark for data-processing frameworks, not a scheduler for arbitrary containers (dùng sai tính năng)
- Lambda: a function cannot run for 30 to 90 minutes (vi phạm ràng buộc)
- ECS with scheduled scaling: the team must build the queueing and capacity logic itself (tốn vận hành hơn)
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
- skills: 3.2.k2, 3.2.k5
- concept: Edge logic that needs network access, the AWS SDK, or more than a few milliseconds belongs in Lambda@Edge; CloudFront Functions and KeyValueStore cannot call external services
- refs: 04-networking-services.md, 01-compute-services.md
- hint: Logic phải gọi API bên ngoài và AWS SDK ngay tại edge — loại edge function nào được phép truy cập mạng, loại nào thì không?
- status: draft
- created: 2026-10-22
- enriched: 2026-10-22
- time: 110

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
