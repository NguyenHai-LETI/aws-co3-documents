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
- topic: api
- services: API Gateway, Lambda
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q1

A company wants a fully managed, serverless REST API backed by Lambda with throttling, authorization, and caching. Which service?

- A. Amazon API Gateway + Lambda
- B. Application Load Balancer + EC2
- C. Amazon CloudFront only
- D. AWS AppSync

**Answer:** A

**Explanation:** Serverless REST API + Lambda + throttling/cache = API Gateway + Lambda.

---

## Q 11-v1-02
- domain: performance
- topic: api
- services: AppSync
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q2

A mobile app needs a flexible API where clients request exactly the data they need, with real-time subscriptions and offline sync. Which service?

- A. Amazon API Gateway REST API
- B. AWS AppSync (GraphQL)
- C. Amazon SQS
- D. Amazon SNS

**Answer:** B

**Explanation:** GraphQL, exact data, real-time + offline = AppSync.

---

## Q 11-v1-03
- domain: performance
- topic: api
- services: API Gateway
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q3

A chat application needs persistent two-way communication between clients and the backend. Which API Gateway type?

- A. REST API
- B. HTTP API
- C. WebSocket API
- D. Private API

**Answer:** C

**Explanation:** Persistent two-way chat = WebSocket API.

---

## Q 11-v1-04
- domain: performance
- topic: api
- services: Lambda, API Gateway
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q4

A team wants the lowest-cost, lowest-latency API for simple proxying to Lambda without advanced features like API keys/usage plans. Which API Gateway type?

- A. REST API
- B. HTTP API
- C. WebSocket API
- D. Edge-optimized REST API

**Answer:** B

**Explanation:** Cheapest/lowest-latency simple proxy = HTTP API.

---

## Q 11-v1-05
- domain: secure
- topic: api
- services: Cognito, API Gateway
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q5

Which API Gateway authorization option validates JWT tokens issued by an Amazon Cognito User Pool?

- A. Cognito authorizer
- B. IAM authorization
- C. Resource policy only
- D. API key

**Answer:** A

**Explanation:** Validate Cognito JWT = Cognito authorizer.

---

## Q 11-v1-06
- domain: secure
- topic: api
- services: Lambda
- tags: federation
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q6

An API must enforce custom authorization logic (e.g., calling an external identity provider) before allowing requests. Which feature?

- A. Lambda authorizer
- B. Usage plan
- C. Stage variable
- D. Mapping template

**Answer:** A

**Explanation:** Custom auth logic = Lambda authorizer.

---

## Q 11-v1-07
- domain: performance
- topic: api
- services: API Gateway
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q7

To protect a backend from traffic spikes, API Gateway should be configured with which feature?

- A. Throttling (rate and burst limits)
- B. Mutual TLS only
- C. Canary deploy only
- D. CORS

**Answer:** A

**Explanation:** Protect backend from spikes = Throttling (rate/burst).

---

## Q 11-v1-08
- domain: performance
- topic: api
- services: VPC, API Gateway, ALB, NLB
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q8

An API Gateway must reach private resources (an internal ALB/NLB) inside a VPC. Which integration is used?

- A. VPC Link
- B. NAT Gateway
- C. Internet Gateway
- D. Direct Connect

**Answer:** A

**Explanation:** Reach private VPC ALB/NLB = VPC Link.

---

## Q 11-v1-09
- domain: performance
- topic: api
- services: API Gateway
- tags: ttl
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q9

Which feature reduces calls to the backend by storing responses for a configurable TTL in API Gateway?

- A. Caching
- B. Usage plans
- C. Stages
- D. Throttling

**Answer:** A

**Explanation:** Cache responses by TTL = API Gateway caching.

---

## Q 11-v1-10
- domain: cost
- topic: api
- services: SES
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q10

A company sends large volumes of transactional emails (receipts) and wants a scalable, cost-effective email service. Which service?

- A. Amazon SES
- B. Amazon SNS
- C. Amazon Pinpoint journeys only
- D. Amazon Connect

**Answer:** A

**Explanation:** Scalable transactional email = Amazon SES.

---

## Q 11-v1-11
- domain: performance
- topic: api
- services: Pinpoint
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q11

A marketing team needs multi-channel customer engagement (email, SMS, push) with campaigns and analytics. Which service?

- A. Amazon Pinpoint
- B. Amazon SES
- C. Amazon SNS
- D. Amazon EventBridge

**Answer:** A

**Explanation:** Multi-channel campaigns + analytics = Amazon Pinpoint.

---

## Q 11-v1-12
- domain: performance
- topic: api
- services: DynamoDB, Lambda, AppSync
- difficulty: medium
- time: 70
- source: practice-exams/11-api-integration-exam.md#Q12

Which AppSync data sources can resolve GraphQL fields? (Choose TWO)

- A. Amazon DynamoDB
- B. AWS Lambda
- C. Amazon EBS
- D. Amazon VPC
- E. AWS IAM

**Answer:** A, B

**Explanation:** AppSync data sources include DynamoDB and Lambda.

---

## Q 11-v1-13
- domain: performance
- topic: api
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q13

A REST API should expose different environments (dev, test, prod) with separate configuration. Which feature?

- A. Stages and stage variables
- B. Usage plans
- C. Resource policies
- D. Mapping templates only

**Answer:** A

**Explanation:** Separate environments/config = Stages + stage variables.

---

## Q 11-v1-14
- domain: performance
- topic: api
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q14

Which mechanism lets you control which client domains can call your API from a browser?

- A. CORS configuration
- B. Throttling
- C. API keys
- D. WAF only

**Answer:** A

**Explanation:** Browser cross-origin control = CORS.

---

## Q 11-v1-15
- domain: performance
- topic: api
- services: API Gateway
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q15

A company wants to issue API keys and meter/limit usage per customer (e.g., free vs paid tiers). Which API Gateway feature?

- A. Usage plans with API keys
- B. Lambda authorizer
- C. VPC Link
- D. Caching

**Answer:** A

**Explanation:** Meter/limit per customer = Usage plans + API keys.

---

## Q 11-v1-16
- domain: performance
- topic: api
- services: API Gateway, SQS, Lambda
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q16

Which integration lets API Gateway call AWS services (e.g., put a message in SQS) directly without Lambda?

- A. AWS service integration
- B. HTTP proxy integration
- C. VPC Link
- D. Mock integration

**Answer:** A

**Explanation:** Call AWS services directly (e.g., SQS) = AWS service integration.

---

## Q 11-v1-17
- domain: performance
- topic: api
- services: CloudFront, API Gateway
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q17

For an API serving global users with the lowest latency for cached responses, which combination is BEST?

- A. CloudFront in front of API Gateway (edge-optimized)
- B. NLB only
- C. SQS in front of the API
- D. Direct Connect

**Answer:** A

**Explanation:** Global low-latency cached API = CloudFront + edge-optimized API Gateway.

---

## Q 11-v1-18
- domain: secure
- topic: api
- services: API Gateway
- tags: tls-termination
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q18

Which security feature in API Gateway authenticates clients using certificates (e.g., for B2B partners)?

- A. Mutual TLS (mTLS)
- B. API key
- C. CORS
- D. Resource policy

**Answer:** A

**Explanation:** Certificate-based client auth = Mutual TLS (mTLS).

---

## Q 11-v1-19
- domain: performance
- topic: api
- services: API Gateway
- difficulty: medium
- time: 80
- source: practice-exams/11-api-integration-exam.md#Q19

Which two are TRUE about Amazon API Gateway? (Choose TWO)

- A. It can throttle requests to protect backends
- B. It supports REST, HTTP, and WebSocket APIs
- C. It is a container orchestration service
- D. It is only usable with EC2 backends
- E. It cannot integrate with Cognito

**Answer:** A, B

**Explanation:** API Gateway throttles + supports REST/HTTP/WebSocket.

---

## Q 11-v1-20
- domain: performance
- topic: api
- services: AppSync
- tags: streaming-ingestion
- difficulty: easy
- time: 45
- source: practice-exams/11-api-integration-exam.md#Q20

A serverless backend needs near-real-time data sync to mobile clients and conflict resolution when offline. Which service is purpose-built?

- A. AWS AppSync
- B. Amazon API Gateway REST
- C. Amazon SQS
- D. Amazon Kinesis

**Answer:** A

**Explanation:** Mobile near-real-time sync + offline conflict = AppSync.
