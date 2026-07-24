# 🔌 Practice Exam 11 — API & Integration (SAA-C03) · V2

**15 questions** · scenario-based · English. Answers in `11-api-integration-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q10
- **Part B — Khó / Nâng cao:** Q11–Q15

---

## Part A — Vận dụng (10 câu)

**1.** A serverless REST API must front Lambda functions with throttling, authorization, and caching. Which service?

- A. Amazon API Gateway
- B. Application Load Balancer
- C. CloudFront
- D. AppSync

**2.** A mobile app needs a managed GraphQL API with real-time subscriptions and offline sync. Which service?

- A. AWS AppSync
- B. API Gateway REST
- C. Amazon SES
- D. Cognito

**3.** An application must send transactional and marketing emails at scale. Which service?

- A. Amazon SES
- B. Amazon SNS
- C. Amazon Pinpoint only
- D. API Gateway

**4.** API Gateway must limit each customer to a number of requests per month with API keys. Which feature?

- A. Usage plans + API keys
- B. Resource policies
- C. Stage variables
- D. Mapping templates

**5.** A cost-sensitive team needs a simple, low-latency HTTP API proxying to Lambda without advanced features. Which API Gateway type?

- A. HTTP API
- B. REST API
- C. WebSocket API
- D. Private REST only

**6.** A chat application needs bidirectional real-time communication between clients and backend. Which API Gateway type?

- A. WebSocket API
- B. REST API
- C. HTTP API
- D. GraphQL only

**7.** API Gateway must authorize requests using Cognito user pool tokens. Which feature?

- A. Cognito authorizer
- B. API keys
- C. Usage plans
- D. Stage variables

**8.** Repeated identical GET requests hit the backend unnecessarily. Which API Gateway feature reduces backend load?

- A. API caching on the stage
- B. Throttling
- C. Usage plans
- D. Mapping templates

**9.** An API must only be reachable from within a VPC, not the public internet. Which API Gateway option?

- A. Private REST API with an interface VPC endpoint
- B. Edge-optimized API
- C. Regional public API
- D. WebSocket API

**10.** API Gateway must protect the backend from traffic spikes with request rate/burst limits. Which feature?

- A. Throttling limits
- B. Caching
- C. Mapping templates
- D. Stage variables

---

## Part B — Khó / Nâng cao (5 câu)

**11.** A custom authorization scheme must validate a bearer token via a Lambda before allowing API access, caching the result. Which feature?

- A. Lambda authorizer (token-based) with result caching
- B. IAM authorization only
- C. API keys
- D. Cognito only

**12.** A B2B API must authenticate clients using client certificates (mutual TLS). Which two are needed? (Choose TWO)

- A. Enable mutual TLS on a custom domain
- B. A truststore of client CA certificates in S3
- C. API keys only
- D. CloudFront signed cookies
- E. WAF rate rule

**13.** An edge-optimized REST API serving global users must reduce latency for clients far from the Region. What does edge-optimized use?

- A. CloudFront edge locations in front of the API
- B. Global Accelerator only
- C. Multiple Regions manually
- D. VPC endpoints

**14.** Choosing between REST API and HTTP API — which two are reasons to pick REST API? (Choose TWO)

- A. Need API caching
- B. Need request/response mapping templates and usage plans/API keys
- C. Lowest cost and latency with minimal features
- D. Native OIDC/JWT only with no advanced features
- E. No need for WAF integration

**15.** An API integration must transform the incoming request payload before passing to the backend and reshape the response. Which REST API feature?

- A. Mapping templates (integration request/response with VTL)
- B. Usage plans
- C. Stage variables
- D. Throttling
