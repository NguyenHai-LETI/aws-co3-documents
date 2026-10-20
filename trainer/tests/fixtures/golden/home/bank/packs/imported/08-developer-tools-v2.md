---
pack: saa-08-developer-tools-v2
title: 08 · Developer Tools · V2
exam: SAA-C03
origin: imported
source: practice-exams/08-developer-tools-exam-v2.md
created: 2026-10-16
---

# 08 · Developer Tools · V2

> Imported from `practice-exams/08-developer-tools-exam-v2.md` + `08-developer-tools-answers-v2.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 08-v2-01
- domain: resilient
- task: 2.1
- topic: devtools
- services: CodePipeline
- tags: orchestration
- difficulty: medium
- time: 55
- source: practice-exams/08-developer-tools-exam-v2.md#Q1

A team needs a fully managed CI/CD service to orchestrate build, test, and deploy stages triggered on code changes. Which service?

- A. AWS CodeDeploy
- B. AWS CodeCommit
- C. AWS CodePipeline
- D. AWS CodeBuild

**Answer:** C

**Explanation:** Orchestrate CI/CD stages = AWS CodePipeline.

---

## Q 08-v2-02
- domain: resilient
- task: 2.2
- topic: devtools
- services: CodeBuild
- difficulty: medium
- time: 50
- source: practice-exams/08-developer-tools-exam-v2.md#Q2

A managed service must compile source code and run unit tests on demand without managing build servers. Which service?

- A. CodePipeline
- B. CodeCommit
- C. CodeBuild
- D. CodeDeploy

**Answer:** C

**Explanation:** Managed build/test, no build servers = AWS CodeBuild.

---

## Q 08-v2-03
- domain: secure
- task: 1.1
- topic: devtools
- services: CodeCommit, IAM
- difficulty: medium
- time: 50
- source: practice-exams/08-developer-tools-exam-v2.md#Q3

A company needs a private, managed Git repository integrated with AWS IAM. Which service?

- A. CodeGuru
- B. Cloud9
- C. CodeArtifact
- D. CodeCommit

**Answer:** D

**Explanation:** Private managed Git with IAM = AWS CodeCommit.

---

## Q 08-v2-04
- domain: resilient
- task: 2.1
- topic: devtools
- services: CodeDeploy, EC2, Lambda
- difficulty: medium
- time: 45
- source: practice-exams/08-developer-tools-exam-v2.md#Q4

Deployments to EC2/on-prem/Lambda must be automated with rollback on failure. Which service?

- A. CodeBuild
- B. CodeDeploy
- C. CodeCommit
- D. CodePipeline

**Answer:** B

**Explanation:** Automated deploy with rollback = AWS CodeDeploy.

---

## Q 08-v2-05
- domain: performance
- task: 3.2
- topic: devtools
- services: X-Ray
- difficulty: medium
- time: 50
- source: practice-exams/08-developer-tools-exam-v2.md#Q5

A team wants to distribute and troubleshoot performance of a microservices app by tracing requests across services. Which service?

- A. AWS X-Ray
- B. Config
- C. CloudTrail
- D. CodeGuru

**Answer:** A

**Explanation:** Distributed tracing across microservices = AWS X-Ray.

---

## Q 08-v2-06
- domain: resilient
- task: 2.2
- topic: devtools
- services: CodeArtifact
- difficulty: medium
- time: 50
- source: practice-exams/08-developer-tools-exam-v2.md#Q6

A managed artifact repository for storing and sharing software packages (npm, Maven, PyPI). Which service?

- A. S3 only
- B. CodeCommit
- C. CodeArtifact
- D. ECR

**Answer:** C

**Explanation:** Managed package/artifact repo = AWS CodeArtifact.

---

## Q 08-v2-07
- domain: resilient
- task: 2.1
- topic: devtools
- services: CodeDeploy, Lambda
- tags: deployment-strategies
- difficulty: medium
- time: 50
- source: practice-exams/08-developer-tools-exam-v2.md#Q7

A Lambda deployment must shift traffic gradually (canary 10% then 90%) with automatic rollback on alarms. Which service enables this?

- A. CodeBuild
- B. CodeDeploy (Lambda deployment)
- C. CloudFormation only
- D. CodeCommit

**Answer:** B

**Explanation:** Lambda canary traffic shifting + rollback = CodeDeploy Lambda deployment.

---

## Q 08-v2-08
- domain: resilient
- task: 2.2
- topic: devtools
- services: CDK, CloudFormation
- difficulty: medium
- time: 50
- source: practice-exams/08-developer-tools-exam-v2.md#Q8

A team defines infrastructure using familiar programming languages (TypeScript/Python) that synthesizes CloudFormation. Which tool?

- A. CodeBuild
- B. Cloud9
- C. CodePipeline
- D. AWS CDK

**Answer:** D

**Explanation:** IaC in programming languages -> CloudFormation = AWS CDK.

---

## Q 08-v2-09
- domain: resilient
- task: 2.1
- topic: devtools
- services: SAM, CloudFormation
- difficulty: medium
- time: 55
- source: practice-exams/08-developer-tools-exam-v2.md#Q9

A serverless application's infrastructure (functions, APIs, tables) must be defined in a simplified template that transforms into CloudFormation. Which framework?

- A. AWS SAM
- B. CodeDeploy
- C. AWS CDK only
- D. Elastic Beanstalk

**Answer:** A

**Explanation:** Simplified serverless template -> CloudFormation = AWS SAM.

---

## Q 08-v2-10
- domain: cost
- task: 4.2
- topic: devtools
- difficulty: medium
- time: 50
- source: practice-exams/08-developer-tools-exam-v2.md#Q10

Automated code reviews and application profiling to find the most expensive lines of code. Which service?

- A. Trusted Advisor
- B. X-Ray
- C. CodeBuild
- D. Amazon CodeGuru

**Answer:** D

**Explanation:** Automated code review + profiling = Amazon CodeGuru.

---

## Q 08-v2-11
- domain: resilient
- task: 2.2
- topic: devtools
- services: CodePipeline, CodeBuild
- difficulty: hard
- time: 95
- source: practice-exams/08-developer-tools-exam-v2.md#Q11

A pipeline must run integration tests in a build stage, then deploy to a staging environment, require manual approval, then deploy to production. Which two services combine for this? (Choose TWO)

- A. CodePipeline (stages + manual approval action)
- B. CodeArtifact only
- C. CodeCommit only
- D. X-Ray
- E. CodeBuild (test/build stage)

**Answer:** A, E

**Explanation:** Pipeline with test/build + approval + deploy = CodePipeline + CodeBuild.

---

## Q 08-v2-12
- domain: secure
- task: 1.2
- topic: devtools
- services: ECR, ECS
- difficulty: hard
- time: 70
- source: practice-exams/08-developer-tools-exam-v2.md#Q12

A container image built in CI must be stored in a managed, private registry with vulnerability scanning before ECS deploys it. Which service?

- A. CodeArtifact
- B. CodeCommit
- C. Amazon ECR
- D. S3

**Answer:** C

**Explanation:** Private container registry with scanning = Amazon ECR.

---

## Q 08-v2-13
- domain: resilient
- task: 2.2
- topic: devtools
- services: ELB, EC2, CodeDeploy
- tags: route53-health-checks, deployment-strategies
- difficulty: hard
- time: 75
- source: practice-exams/08-developer-tools-exam-v2.md#Q13

An EC2 deployment must avoid downtime by shifting traffic to a new fleet and rolling back automatically if health checks fail. Which CodeDeploy configuration?

- A. Manual copy
- B. CodeBuild only
- C. In-place all-at-once
- D. Blue/Green deployment with an ELB and automatic rollback

**Answer:** D

**Explanation:** Zero-downtime EC2 deploy with auto rollback = CodeDeploy Blue/Green with ELB.

---

## Q 08-v2-14
- domain: performance
- task: 3.2
- topic: devtools
- services: EventBridge, CodePipeline
- difficulty: hard
- time: 75
- source: practice-exams/08-developer-tools-exam-v2.md#Q14

A CodePipeline must be triggered automatically on every commit to the main branch with the lowest latency. Which integration is BEST?

- A. Periodic polling only
- B. EventBridge (CloudWatch Events) rule on the repository/commit
- C. SNS to email then manual
- D. Manual start

**Answer:** B

**Explanation:** Low-latency pipeline trigger on commit = EventBridge rule on the repo.

---

## Q 08-v2-15
- domain: performance
- task: 3.2
- topic: devtools
- services: X-Ray, Lambda, API Gateway, DynamoDB
- difficulty: hard
- time: 75
- source: practice-exams/08-developer-tools-exam-v2.md#Q15

A distributed request is slow and the team must find which downstream service adds latency across Lambda, API Gateway, and DynamoDB. Which service and feature?

- A. X-Ray service map and trace segments
- B. CodeGuru Reviewer
- C. CloudTrail data events
- D. Config timeline

**Answer:** A

**Explanation:** Find latency across services = X-Ray service map/trace segments.
