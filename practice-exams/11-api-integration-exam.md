# 🔌 Practice Exam 11 — API & Integration (SAA-C03)

20 questions · scenario-based · English. Answers in `11-api-integration-answers.txt`.

---

**1.** A company wants a fully managed, serverless REST API backed by Lambda with throttling, authorization, and caching. Which service?

- A. Amazon API Gateway + Lambda
- B. Application Load Balancer + EC2
- C. Amazon CloudFront only
- D. AWS AppSync

**2.** A mobile app needs a flexible API where clients request exactly the data they need, with real-time subscriptions and offline sync. Which service?

- A. Amazon API Gateway REST API
- B. AWS AppSync (GraphQL)
- C. Amazon SQS
- D. Amazon SNS

**3.** A chat application needs persistent two-way communication between clients and the backend. Which API Gateway type?

- A. REST API
- B. HTTP API
- C. WebSocket API
- D. Private API

**4.** A team wants the lowest-cost, lowest-latency API for simple proxying to Lambda without advanced features like API keys/usage plans. Which API Gateway type?

- A. REST API
- B. HTTP API
- C. WebSocket API
- D. Edge-optimized REST API

**5.** Which API Gateway authorization option validates JWT tokens issued by an Amazon Cognito User Pool?

- A. Cognito authorizer
- B. IAM authorization
- C. Resource policy only
- D. API key

**6.** An API must enforce custom authorization logic (e.g., calling an external identity provider) before allowing requests. Which feature?

- A. Lambda authorizer
- B. Usage plan
- C. Stage variable
- D. Mapping template

**7.** To protect a backend from traffic spikes, API Gateway should be configured with which feature?

- A. Throttling (rate and burst limits)
- B. Mutual TLS only
- C. Canary deploy only
- D. CORS

**8.** An API Gateway must reach private resources (an internal ALB/NLB) inside a VPC. Which integration is used?

- A. VPC Link
- B. NAT Gateway
- C. Internet Gateway
- D. Direct Connect

**9.** Which feature reduces calls to the backend by storing responses for a configurable TTL in API Gateway?

- A. Caching
- B. Usage plans
- C. Stages
- D. Throttling

**10.** A company sends large volumes of transactional emails (receipts) and wants a scalable, cost-effective email service. Which service?

- A. Amazon SES
- B. Amazon SNS
- C. Amazon Pinpoint journeys only
- D. Amazon Connect

**11.** A marketing team needs multi-channel customer engagement (email, SMS, push) with campaigns and analytics. Which service?

- A. Amazon Pinpoint
- B. Amazon SES
- C. Amazon SNS
- D. Amazon EventBridge

**12.** Which AppSync data sources can resolve GraphQL fields? (Choose TWO)

- A. Amazon DynamoDB
- B. AWS Lambda
- C. Amazon EBS
- D. Amazon VPC
- E. AWS IAM

**13.** A REST API should expose different environments (dev, test, prod) with separate configuration. Which feature?

- A. Stages and stage variables
- B. Usage plans
- C. Resource policies
- D. Mapping templates only

**14.** Which mechanism lets you control which client domains can call your API from a browser?

- A. CORS configuration
- B. Throttling
- C. API keys
- D. WAF only

**15.** A company wants to issue API keys and meter/limit usage per customer (e.g., free vs paid tiers). Which API Gateway feature?

- A. Usage plans with API keys
- B. Lambda authorizer
- C. VPC Link
- D. Caching

**16.** Which integration lets API Gateway call AWS services (e.g., put a message in SQS) directly without Lambda?

- A. AWS service integration
- B. HTTP proxy integration
- C. VPC Link
- D. Mock integration

**17.** For an API serving global users with the lowest latency for cached responses, which combination is BEST?

- A. CloudFront in front of API Gateway (edge-optimized)
- B. NLB only
- C. SQS in front of the API
- D. Direct Connect

**18.** Which security feature in API Gateway authenticates clients using certificates (e.g., for B2B partners)?

- A. Mutual TLS (mTLS)
- B. API key
- C. CORS
- D. Resource policy

**19.** Which two are TRUE about Amazon API Gateway? (Choose TWO)

- A. It can throttle requests to protect backends
- B. It supports REST, HTTP, and WebSocket APIs
- C. It is a container orchestration service
- D. It is only usable with EC2 backends
- E. It cannot integrate with Cognito

**20.** A serverless backend needs near-real-time data sync to mobile clients and conflict resolution when offline. Which service is purpose-built?

- A. AWS AppSync
- B. Amazon API Gateway REST
- C. Amazon SQS
- D. Amazon Kinesis
