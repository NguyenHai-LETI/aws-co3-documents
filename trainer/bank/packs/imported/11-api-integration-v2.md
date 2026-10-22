---
pack: saa-11-api-integration-v2
title: 11 · API & Integration · V2
exam: SAA-C03
origin: imported
source: practice-exams/11-api-integration-exam-v2.md
created: 2026-10-16
---

# 11 · API & Integration · V2

> Imported from `practice-exams/11-api-integration-exam-v2.md` + `11-api-integration-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 11-v2-01
- domain: performance
- task: 3.4
- topic: api
- services: API Gateway, Lambda
- difficulty: medium
- time: 50
- source: practice-exams/11-api-integration-exam-v2.md#Q1

A serverless REST API must front Lambda functions with throttling, authorization, and caching. Which service?

- A. Amazon API Gateway
- B. Application Load Balancer
- C. AppSync
- D. CloudFront

**Answer:** A

**Explanation:** Serverless REST front for Lambda with throttling/auth/caching = API Gateway.

---

## Q 11-v2-02
- domain: performance
- task: 3.4
- topic: api
- services: AppSync
- tags: streaming-ingestion
- difficulty: medium
- time: 50
- status: retired
- source: practice-exams/11-api-integration-exam-v2.md#Q2

A mobile app needs a managed GraphQL API with real-time subscriptions and offline sync. Which service?

- A. Amazon SES
- B. Cognito
- C. API Gateway REST
- D. AWS AppSync

**Answer:** D

**Explanation:** Managed GraphQL + real-time + offline sync = AWS AppSync.

---

## Q 11-v2-03
- domain: performance
- task: 3.4
- topic: api
- services: SES
- difficulty: medium
- time: 50
- enriched: 2026-10-22
- source: practice-exams/11-api-integration-exam-v2.md#Q3

An application must send transactional and marketing emails at scale. Which service?

- A. API Gateway
- B. Amazon SES
- C. AWS End User Messaging only
- D. Amazon SNS

**Answer:** B

**Explanation:** Amazon SES sends transactional and marketing email at scale with high deliverability, pay-as-you-go pricing and no mail servers to run.
- API Gateway: exposes APIs; it does not send email.
- AWS End User Messaging: SMS, voice and push channels, not email.
- Amazon SNS: pub/sub notifications to subscribers, not full transactional or marketing email.
> 🇻🇳 Email giao dịch + marketing quy mô lớn → Amazon SES.

---

## Q 11-v2-04
- domain: performance
- task: 3.4
- topic: api
- services: API Gateway
- difficulty: medium
- time: 55
- source: practice-exams/11-api-integration-exam-v2.md#Q4

API Gateway must limit each customer to a number of requests per month with API keys. Which feature?

- A. Usage plans + API keys
- B. Stage variables
- C. Mapping templates
- D. Resource policies

**Answer:** A

**Explanation:** Per-customer request quotas with keys = Usage plans + API keys.

---

## Q 11-v2-05
- domain: performance
- task: 3.2
- topic: api
- services: Lambda, API Gateway
- difficulty: medium
- time: 55
- source: practice-exams/11-api-integration-exam-v2.md#Q5

A cost-sensitive team needs a simple, low-latency HTTP API proxying to Lambda without advanced features. Which API Gateway type?

- A. REST API
- B. WebSocket API
- C. HTTP API
- D. Private REST only

**Answer:** C

**Explanation:** Simple low-latency low-cost HTTP proxy to Lambda = HTTP API.

---

## Q 11-v2-06
- domain: performance
- task: 3.4
- topic: api
- services: API Gateway
- tags: streaming-ingestion
- difficulty: medium
- time: 50
- source: practice-exams/11-api-integration-exam-v2.md#Q6

A chat application needs bidirectional real-time communication between clients and backend. Which API Gateway type?

- A. GraphQL only
- B. REST API
- C. WebSocket API
- D. HTTP API

**Answer:** C

**Explanation:** Bidirectional real-time = WebSocket API.

---

## Q 11-v2-07
- domain: secure
- task: 1.2
- topic: api
- services: API Gateway, Cognito
- tags: cognito-authorizer
- difficulty: medium
- time: 50
- concept: API Gateway Cognito authorizer authorizes requests using Cognito user pool tokens
- hint: Đề dùng token từ user pool để cho phép request — tính năng authorizer nào của API Gateway khớp?
- enriched: 2026-10-16
- source: practice-exams/11-api-integration-exam-v2.md#Q7

API Gateway must authorize requests using Cognito user pool tokens. Which feature?

- A. Stage variable maps
- B. Usage plan throttling
- C. API key validation
- D. Cognito authorizer

**Answer:** D

**Explanation:** The **Cognito authorizer** checks the user pool token on each request and rejects invalid ones before the backend is invoked.
- Stage variable maps: pass per-stage configuration to integrations; they do not authorize callers.
- Usage plan throttling: sets rate and quota limits per API key, not identity checks.
- API key validation: identifies a client application but does not validate user identity or tokens.
> 🇻🇳 Cho phép request bằng token Cognito user pool → Cognito authorizer.

---

## Q 11-v2-08
- domain: performance
- task: 3.3
- topic: api
- services: API Gateway
- difficulty: medium
- time: 50
- source: practice-exams/11-api-integration-exam-v2.md#Q8

Repeated identical GET requests hit the backend unnecessarily. Which API Gateway feature reduces backend load?

- A. Throttling
- B. Usage plans
- C. Mapping templates
- D. API caching on the stage

**Answer:** D

**Explanation:** Reduce backend load for repeated GETs = API caching.

---

## Q 11-v2-09
- domain: performance
- task: 3.4
- topic: api
- services: PrivateLink, VPC, API Gateway
- difficulty: medium
- time: 55
- source: practice-exams/11-api-integration-exam-v2.md#Q9

An API must only be reachable from within a VPC, not the public internet. Which API Gateway option?

- A. Private REST API with an interface VPC endpoint
- B. Regional public API
- C. Edge-optimized API
- D. WebSocket API

**Answer:** A

**Explanation:** VPC-only API = Private REST API with interface VPC endpoint.

---

## Q 11-v2-10
- domain: performance
- task: 3.4
- topic: api
- services: API Gateway
- difficulty: medium
- time: 50
- source: practice-exams/11-api-integration-exam-v2.md#Q10

API Gateway must protect the backend from traffic spikes with request rate/burst limits. Which feature?

- A. Mapping templates
- B. Stage variables
- C. Throttling limits
- D. Caching

**Answer:** C

**Explanation:** Protect backend from spikes = throttling limits.

---

## Q 11-v2-11
- domain: performance
- task: 3.2
- topic: api
- services: Lambda
- difficulty: hard
- time: 70
- source: practice-exams/11-api-integration-exam-v2.md#Q11

A custom authorization scheme must validate a bearer token via a Lambda before allowing API access, caching the result. Which feature?

- A. Lambda authorizer (token-based) with result caching
- B. Cognito only
- C. API keys
- D. IAM authorization only

**Answer:** A

**Explanation:** Custom token validation with caching = Lambda authorizer (token-based).

---

## Q 11-v2-12
- domain: secure
- task: 1.2
- topic: api
- services: API Gateway, S3
- tags: tls-termination
- difficulty: hard
- time: 95
- concept: API Gateway mTLS needs mutual TLS enabled on a custom domain plus a client-CA truststore stored in S3
- hint: Xác thực bằng chứng chỉ client cần hai thành phần: bật TLS hai chiều ở tên miền và nơi lưu danh sách CA tin cậy.
- enriched: 2026-10-16
- source: practice-exams/11-api-integration-exam-v2.md#Q12

A B2B API must authenticate clients using client certificates (mutual TLS). Which two are needed? (Choose TWO)

- A. API keys only
- B. CloudFront signed cookies
- C. Enable mutual TLS on a custom domain
- D. WAF rate rule
- E. A truststore of client CA certificates in S3

**Answer:** C, E

**Explanation:** Mutual TLS on API Gateway needs two parts: **enable mTLS on the custom domain**, and supply a **truststore of client CA certificates in S3** that API Gateway uses to validate client certificates.
- API keys only: identify callers but do not authenticate with certificates.
- CloudFront signed cookies: restrict access to CloudFront content, not client-cert authentication of an API.
- WAF rate rule: throttles request rates and does not verify client identity.
> 🇻🇳 mTLS = bật mTLS trên custom domain + truststore CA của client trong S3.

---

## Q 11-v2-13
- domain: performance
- task: 3.4
- topic: api
- services: CloudFront
- difficulty: hard
- time: 70
- source: practice-exams/11-api-integration-exam-v2.md#Q13

An edge-optimized REST API serving global users must reduce latency for clients far from the Region. What does edge-optimized use?

- A. Global Accelerator only
- B. CloudFront edge locations in front of the API
- C. VPC endpoints
- D. Multiple Regions manually

**Answer:** B

**Explanation:** Edge-optimized reduces latency via CloudFront edge locations.

---

## Q 11-v2-14
- domain: performance
- task: 3.3
- topic: api
- difficulty: hard
- time: 100
- enriched: 2026-10-22
- source: practice-exams/11-api-integration-exam-v2.md#Q14

Choosing between REST API and HTTP API — which two are reasons to pick REST API? (Choose TWO)

- A. Need API caching
- B. Need request/response mapping templates and usage plans/API keys
- C. No need for API Gateway WAF integration
- D. Native OIDC/JWT authorizers for the API
- E. Lowest cost and latency for a simple API

**Answer:** A, B

**Explanation:** REST API reasons = caching + mapping templates/usage plans/API keys.

---

## Q 11-v2-15
- domain: performance
- task: 3.5
- topic: api
- difficulty: hard
- time: 70
- source: practice-exams/11-api-integration-exam-v2.md#Q15

An API integration must transform the incoming request payload before passing to the backend and reshape the response. Which REST API feature?

- A. Throttling
- B. Mapping templates (integration request/response with VTL)
- C. Stage variables
- D. Usage plans

**Answer:** B

**Explanation:** Transform request/response payloads = mapping templates (VTL).
