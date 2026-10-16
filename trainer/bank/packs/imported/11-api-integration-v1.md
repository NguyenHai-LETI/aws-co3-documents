---
pack: saa-11-api-integration-v1
title: 11 · API & Integration · V1
exam: SAA-C03
origin: imported
source: practice-exams/11-api-integration-exam.md
created: 2026-10-16
---

# 11 · API & Integration · V1

> Imported from `practice-exams/11-api-integration-exam.md` + `11-api-integration-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 11-v1-01
- domain: performance
- task: 3.4
- topic: api
- services: API Gateway, Lambda
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q1

A company wants a fully managed, serverless REST API backed by Lambda with throttling, authorization, and caching. Which service?

- A. Amazon CloudFront only
- B. Amazon API Gateway + Lambda
- C. AWS AppSync
- D. Application Load Balancer + EC2

**Answer:** B

**Explanation:** Serverless REST API + Lambda + throttling/cache = API Gateway + Lambda.

---

## Q 11-v1-02
- domain: performance
- task: 3.4
- topic: api
- services: AppSync
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q2

A mobile app needs a flexible API where clients request exactly the data they need, with real-time subscriptions and offline sync. Which service?

- A. Amazon SQS
- B. Amazon API Gateway REST API
- C. Amazon SNS
- D. AWS AppSync (GraphQL)

**Answer:** D

**Explanation:** GraphQL, exact data, real-time + offline = AppSync.

---

## Q 11-v1-03
- domain: performance
- task: 3.4
- topic: api
- services: API Gateway
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q3

A chat application needs persistent two-way communication between clients and the backend. Which API Gateway type?

- A. REST API
- B. WebSocket API
- C. Private API
- D. HTTP API

**Answer:** B

**Explanation:** Persistent two-way chat = WebSocket API.

---

## Q 11-v1-04
- domain: performance
- task: 3.2
- topic: api
- services: Lambda, API Gateway
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q4

A team wants the lowest-cost, lowest-latency API for simple proxying to Lambda without advanced features like API keys/usage plans. Which API Gateway type?

- A. HTTP API
- B. REST API
- C. WebSocket API
- D. Edge-optimized REST API

**Answer:** A

**Explanation:** Cheapest/lowest-latency simple proxy = HTTP API.

---

## Q 11-v1-05
- domain: secure
- task: 1.2
- topic: api
- services: API Gateway, Cognito
- tags: cognito-authorizer
- difficulty: easy
- time: 45
- concept: API Gateway Cognito user pool authorizer validates JWT tokens from the user pool
- hint: Token JWT do user pool phát hành — kiểu authorizer nào của API Gateway được tích hợp sẵn để xác thực chúng?
- enriched: 2026-10-16
- source: practice-exams/11-api-integration-exam.md#Q5

Which API Gateway authorization option validates JWT tokens issued by an Amazon Cognito User Pool?

- A. IAM authorization
- B. API key
- C. Resource policy only
- D. Cognito authorizer

**Answer:** D

**Explanation:** The **Cognito authorizer** is built into API Gateway and validates the JWT tokens issued by a Cognito User Pool before the request reaches the backend.
- IAM authorization: verifies SigV4-signed requests from IAM principals, not user pool tokens.
- API key: identifies a client for usage plans; it is not an authentication mechanism.
- Resource policy only: allows or denies by source IP, VPC or account, and does not validate tokens.
> 🇻🇳 JWT của Cognito User Pool → Cognito authorizer.

---

## Q 11-v1-06
- domain: secure
- task: 1.2
- topic: api
- services: API Gateway, Lambda
- tags: lambda-authorizer
- difficulty: easy
- time: 45
- concept: Lambda authorizer runs custom auth logic (e.g. external IdP or token check) before API Gateway allows a request
- hint: Cần chạy code tự viết để kiểm tra yêu cầu (kể cả gọi IdP bên ngoài) trước khi cho phép gọi API.
- enriched: 2026-10-16
- source: practice-exams/11-api-integration-exam.md#Q6

An API must enforce custom authorization logic (e.g., calling an external identity provider) before allowing requests. Which feature?

- A. Stage variable
- B. Mapping template
- C. Lambda authorizer
- D. Usage plan

**Answer:** C

**Explanation:** A **Lambda authorizer** runs your own function on each request (or cached result), so it can call an external identity provider and return an IAM policy allowing or denying the call.
- Stage variable: a per-stage configuration value, not an authorization mechanism.
- Mapping template: transforms request/response payloads; it makes no auth decision.
- Usage plan: throttles and meters API-key clients, not custom authentication.
> 🇻🇳 Logic xác thực tuỳ biến / gọi IdP ngoài → Lambda authorizer.

---

## Q 11-v1-07
- domain: performance
- task: 3.4
- topic: api
- services: API Gateway
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q7

To protect a backend from traffic spikes, API Gateway should be configured with which feature?

- A. Throttling (rate and burst limits)
- B. Canary deploy only
- C. CORS
- D. Mutual TLS only

**Answer:** A

**Explanation:** Protect backend from spikes = Throttling (rate/burst).

---

## Q 11-v1-08
- domain: performance
- task: 3.4
- topic: api
- services: VPC, API Gateway, ALB, NLB
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q8

An API Gateway must reach private resources (an internal ALB/NLB) inside a VPC. Which integration is used?

- A. NAT Gateway
- B. Internet Gateway
- C. Direct Connect
- D. VPC Link

**Answer:** D

**Explanation:** Reach private VPC ALB/NLB = VPC Link.

---

## Q 11-v1-09
- domain: performance
- task: 3.3
- topic: api
- services: API Gateway
- tags: ttl
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q9

Which feature reduces calls to the backend by storing responses for a configurable TTL in API Gateway?

- A. Throttling
- B. Usage plans
- C. Caching
- D. Stages

**Answer:** C

**Explanation:** Cache responses by TTL = API Gateway caching.

---

## Q 11-v1-10
- domain: cost
- task: 4.2
- topic: api
- services: SES
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q10

A company sends large volumes of transactional emails (receipts) and wants a scalable, cost-effective email service. Which service?

- A. Amazon SES
- B. Amazon Pinpoint journeys only
- C. Amazon Connect
- D. Amazon SNS

**Answer:** A

**Explanation:** Scalable transactional email = Amazon SES.

---

## Q 11-v1-11
- domain: performance
- task: 3.4
- topic: api
- services: Pinpoint
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q11

A marketing team needs multi-channel customer engagement (email, SMS, push) with campaigns and analytics. Which service?

- A. Amazon Pinpoint
- B. Amazon SES
- C. Amazon EventBridge
- D. Amazon SNS

**Answer:** A

**Explanation:** Multi-channel campaigns + analytics = Amazon Pinpoint.

---

## Q 11-v1-12
- domain: performance
- task: 3.3
- topic: api
- services: DynamoDB, Lambda, AppSync
- difficulty: medium
- time: 70
- source: practice-exams/11-api-integration-exam.md#Q12

Which AppSync data sources can resolve GraphQL fields? (Choose TWO)

- A. AWS IAM
- B. Amazon EBS
- C. Amazon DynamoDB
- D. Amazon VPC
- E. AWS Lambda

**Answer:** C, E

**Explanation:** AppSync data sources include DynamoDB and Lambda.

---

## Q 11-v1-13
- domain: performance
- task: 3.4
- topic: api
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q13

A REST API should expose different environments (dev, test, prod) with separate configuration. Which feature?

- A. Mapping templates only
- B. Stages and stage variables
- C. Usage plans
- D. Resource policies

**Answer:** B

**Explanation:** Separate environments/config = Stages + stage variables.

---

## Q 11-v1-14
- domain: performance
- task: 3.4
- topic: api
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q14

Which mechanism lets you control which client domains can call your API from a browser?

- A. API keys
- B. Throttling
- C. CORS configuration
- D. WAF only

**Answer:** C

**Explanation:** Browser cross-origin control = CORS.

---

## Q 11-v1-15
- domain: performance
- task: 3.4
- topic: api
- services: API Gateway
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q15

A company wants to issue API keys and meter/limit usage per customer (e.g., free vs paid tiers). Which API Gateway feature?

- A. Lambda authorizer
- B. Caching
- C. VPC Link
- D. Usage plans with API keys

**Answer:** D

**Explanation:** Meter/limit per customer = Usage plans + API keys.

---

## Q 11-v1-16
- domain: performance
- task: 3.4
- topic: api
- services: API Gateway, SQS, Lambda
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q16

Which integration lets API Gateway call AWS services (e.g., put a message in SQS) directly without Lambda?

- A. VPC Link
- B. Mock integration
- C. HTTP proxy integration
- D. AWS service integration

**Answer:** D

**Explanation:** Call AWS services directly (e.g., SQS) = AWS service integration.

---

## Q 11-v1-17
- domain: performance
- task: 3.4
- topic: api
- services: CloudFront, API Gateway
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q17

For an API serving global users with the lowest latency for cached responses, which combination is BEST?

- A. NLB only
- B. CloudFront in front of API Gateway (edge-optimized)
- C. SQS in front of the API
- D. Direct Connect

**Answer:** B

**Explanation:** Global low-latency cached API = CloudFront + edge-optimized API Gateway.

---

## Q 11-v1-18
- domain: secure
- task: 1.2
- topic: api
- services: API Gateway, ACM
- tags: tls-termination
- difficulty: easy
- time: 45
- concept: API Gateway mutual TLS (mTLS) authenticates clients with certificates, e.g. B2B partners
- hint: Khách hàng B2B phải chứng minh danh tính bằng chứng chỉ số — cơ chế TLS hai chiều nào của API Gateway làm được?
- enriched: 2026-10-16
- source: practice-exams/11-api-integration-exam.md#Q18

Which security feature in API Gateway authenticates clients using certificates (e.g., for B2B partners)?

- A. CORS
- B. API key
- C. Mutual TLS (mTLS)
- D. Resource policy

**Answer:** C

**Explanation:** **Mutual TLS** makes API Gateway verify a client certificate against a trusted CA truststore during the TLS handshake, which suits B2B partners that must prove identity with certificates.
- CORS: a browser cross-origin rule; it does not authenticate callers.
- API key: a shared string for identifying and throttling clients, not certificate-based authentication.
- Resource policy: restricts access by IP, VPC or account, and does not check client certificates.
> 🇻🇳 Xác thực client bằng chứng chỉ → Mutual TLS (mTLS).

---

## Q 11-v1-19
- domain: performance
- task: 3.4
- topic: api
- services: API Gateway
- difficulty: medium
- time: 80
- source: practice-exams/11-api-integration-exam.md#Q19

Which two are TRUE about Amazon API Gateway? (Choose TWO)

- A. It cannot integrate with Cognito
- B. It can throttle requests to protect backends
- C. It is only usable with EC2 backends
- D. It is a container orchestration service
- E. It supports REST, HTTP, and WebSocket APIs

**Answer:** B, E

**Explanation:** API Gateway throttles + supports REST/HTTP/WebSocket.

---

## Q 11-v1-20
- domain: performance
- task: 3.4
- topic: api
- services: AppSync
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q20

A serverless backend needs near-real-time data sync to mobile clients and conflict resolution when offline. Which service is purpose-built?

- A. Amazon SQS
- B. Amazon Kinesis
- C. AWS AppSync
- D. Amazon API Gateway REST

**Answer:** C

**Explanation:** Mobile near-real-time sync + offline conflict = AppSync.
