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
- topic: api
- services: API Gateway, Lambda
- difficulty: medium
- time: 50
- source: practice-exams/11-api-integration-exam-v2.md#Q1

A serverless REST API must front Lambda functions with throttling, authorization, and caching. Which service?

- A. Amazon API Gateway
- B. Application Load Balancer
- C. CloudFront
- D. AppSync

**Answer:** A

**Explanation:** Serverless REST front for Lambda with throttling/auth/caching = API Gateway.

---

## Q 11-v2-02
- domain: performance
- topic: api
- services: AppSync
- tags: streaming-ingestion
- difficulty: medium
- time: 50
- source: practice-exams/11-api-integration-exam-v2.md#Q2

A mobile app needs a managed GraphQL API with real-time subscriptions and offline sync. Which service?

- A. AWS AppSync
- B. API Gateway REST
- C. Amazon SES
- D. Cognito

**Answer:** A

**Explanation:** Managed GraphQL + real-time + offline sync = AWS AppSync.

---

## Q 11-v2-03
- domain: performance
- topic: api
- services: SES
- difficulty: medium
- time: 50
- source: practice-exams/11-api-integration-exam-v2.md#Q3

An application must send transactional and marketing emails at scale. Which service?

- A. Amazon SES
- B. Amazon SNS
- C. Amazon Pinpoint only
- D. API Gateway

**Answer:** A

**Explanation:** Transactional/marketing email at scale = Amazon SES.

---

## Q 11-v2-04
- domain: performance
- topic: api
- services: API Gateway
- difficulty: medium
- time: 55
- source: practice-exams/11-api-integration-exam-v2.md#Q4

API Gateway must limit each customer to a number of requests per month with API keys. Which feature?

- A. Usage plans + API keys
- B. Resource policies
- C. Stage variables
- D. Mapping templates

**Answer:** A

**Explanation:** Per-customer request quotas with keys = Usage plans + API keys.

---

## Q 11-v2-05
- domain: performance
- topic: api
- services: Lambda, API Gateway
- difficulty: medium
- time: 55
- source: practice-exams/11-api-integration-exam-v2.md#Q5

A cost-sensitive team needs a simple, low-latency HTTP API proxying to Lambda without advanced features. Which API Gateway type?

- A. HTTP API
- B. REST API
- C. WebSocket API
- D. Private REST only

**Answer:** A

**Explanation:** Simple low-latency low-cost HTTP proxy to Lambda = HTTP API.

---

## Q 11-v2-06
- domain: performance
- topic: api
- services: API Gateway
- tags: streaming-ingestion
- difficulty: medium
- time: 50
- source: practice-exams/11-api-integration-exam-v2.md#Q6

A chat application needs bidirectional real-time communication between clients and backend. Which API Gateway type?

- A. WebSocket API
- B. REST API
- C. HTTP API
- D. GraphQL only

**Answer:** A

**Explanation:** Bidirectional real-time = WebSocket API.

---

## Q 11-v2-07
- domain: secure
- topic: api
- services: Cognito, API Gateway
- difficulty: medium
- time: 50
- source: practice-exams/11-api-integration-exam-v2.md#Q7

API Gateway must authorize requests using Cognito user pool tokens. Which feature?

- A. Cognito authorizer
- B. API keys
- C. Usage plans
- D. Stage variables

**Answer:** A

**Explanation:** Authorize with Cognito tokens = Cognito authorizer.

---

## Q 11-v2-08
- domain: performance
- topic: api
- services: API Gateway
- difficulty: medium
- time: 50
- source: practice-exams/11-api-integration-exam-v2.md#Q8

Repeated identical GET requests hit the backend unnecessarily. Which API Gateway feature reduces backend load?

- A. API caching on the stage
- B. Throttling
- C. Usage plans
- D. Mapping templates

**Answer:** A

**Explanation:** Reduce backend load for repeated GETs = API caching.

---

## Q 11-v2-09
- domain: performance
- topic: api
- services: PrivateLink, VPC, API Gateway
- difficulty: medium
- time: 55
- source: practice-exams/11-api-integration-exam-v2.md#Q9

An API must only be reachable from within a VPC, not the public internet. Which API Gateway option?

- A. Private REST API with an interface VPC endpoint
- B. Edge-optimized API
- C. Regional public API
- D. WebSocket API

**Answer:** A

**Explanation:** VPC-only API = Private REST API with interface VPC endpoint.

---

## Q 11-v2-10
- domain: performance
- topic: api
- services: API Gateway
- difficulty: medium
- time: 50
- source: practice-exams/11-api-integration-exam-v2.md#Q10

API Gateway must protect the backend from traffic spikes with request rate/burst limits. Which feature?

- A. Throttling limits
- B. Caching
- C. Mapping templates
- D. Stage variables

**Answer:** A

**Explanation:** Protect backend from spikes = throttling limits.

---

## Q 11-v2-11
- domain: performance
- topic: api
- services: Lambda
- difficulty: hard
- time: 70
- source: practice-exams/11-api-integration-exam-v2.md#Q11

A custom authorization scheme must validate a bearer token via a Lambda before allowing API access, caching the result. Which feature?

- A. Lambda authorizer (token-based) with result caching
- B. IAM authorization only
- C. API keys
- D. Cognito only

**Answer:** A

**Explanation:** Custom token validation with caching = Lambda authorizer (token-based).

---

## Q 11-v2-12
- domain: secure
- topic: api
- services: S3
- tags: tls-termination
- difficulty: hard
- time: 95
- source: practice-exams/11-api-integration-exam-v2.md#Q12

A B2B API must authenticate clients using client certificates (mutual TLS). Which two are needed? (Choose TWO)

- A. Enable mutual TLS on a custom domain
- B. A truststore of client CA certificates in S3
- C. API keys only
- D. CloudFront signed cookies
- E. WAF rate rule

**Answer:** A, B

**Explanation:** Mutual TLS = enable mTLS on custom domain + truststore of client CAs in S3.

---

## Q 11-v2-13
- domain: performance
- topic: api
- services: CloudFront
- difficulty: hard
- time: 70
- source: practice-exams/11-api-integration-exam-v2.md#Q13

An edge-optimized REST API serving global users must reduce latency for clients far from the Region. What does edge-optimized use?

- A. CloudFront edge locations in front of the API
- B. Global Accelerator only
- C. Multiple Regions manually
- D. VPC endpoints

**Answer:** A

**Explanation:** Edge-optimized reduces latency via CloudFront edge locations.

---

## Q 11-v2-14
- domain: performance
- topic: api
- difficulty: hard
- time: 95
- source: practice-exams/11-api-integration-exam-v2.md#Q14

Choosing between REST API and HTTP API — which two are reasons to pick REST API? (Choose TWO)

- A. Need API caching
- B. Need request/response mapping templates and usage plans/API keys
- C. Lowest cost and latency with minimal features
- D. Native OIDC/JWT only with no advanced features
- E. No need for WAF integration

**Answer:** A, B

**Explanation:** REST API reasons = caching + mapping templates/usage plans/API keys.

---

## Q 11-v2-15
- domain: performance
- topic: api
- difficulty: hard
- time: 70
- source: practice-exams/11-api-integration-exam-v2.md#Q15

An API integration must transform the incoming request payload before passing to the backend and reshape the response. Which REST API feature?

- A. Mapping templates (integration request/response with VTL)
- B. Usage plans
- C. Stage variables
- D. Throttling

**Answer:** A

**Explanation:** Transform request/response payloads = mapping templates (VTL).
