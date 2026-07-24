# 🧰 Practice Exam 08 — Developer Tools (SAA-C03) · V2

**15 questions** · scenario-based · English. Answers in `08-developer-tools-answers-v2.txt`.

- **Part A — Vận dụng:** Q1–Q10
- **Part B — Khó / Nâng cao:** Q11–Q15

---

## Part A — Vận dụng (10 câu)

**1.** A team needs a fully managed CI/CD service to orchestrate build, test, and deploy stages triggered on code changes. Which service?

- A. AWS CodePipeline
- B. AWS CodeCommit
- C. AWS CodeBuild
- D. AWS CodeDeploy

**2.** A managed service must compile source code and run unit tests on demand without managing build servers. Which service?

- A. CodeBuild
- B. CodeDeploy
- C. CodePipeline
- D. CodeCommit

**3.** A company needs a private, managed Git repository integrated with AWS IAM. Which service?

- A. CodeCommit
- B. CodeArtifact
- C. CodeGuru
- D. Cloud9

**4.** Deployments to EC2/on-prem/Lambda must be automated with rollback on failure. Which service?

- A. CodeDeploy
- B. CodeBuild
- C. CodeCommit
- D. CodePipeline

**5.** A team wants to distribute and troubleshoot performance of a microservices app by tracing requests across services. Which service?

- A. AWS X-Ray
- B. CloudTrail
- C. Config
- D. CodeGuru

**6.** A managed artifact repository for storing and sharing software packages (npm, Maven, PyPI). Which service?

- A. CodeArtifact
- B. CodeCommit
- C. S3 only
- D. ECR

**7.** A Lambda deployment must shift traffic gradually (canary 10% then 90%) with automatic rollback on alarms. Which service enables this?

- A. CodeDeploy (Lambda deployment)
- B. CodeBuild
- C. CodeCommit
- D. CloudFormation only

**8.** A team defines infrastructure using familiar programming languages (TypeScript/Python) that synthesizes CloudFormation. Which tool?

- A. AWS CDK
- B. CodePipeline
- C. CodeBuild
- D. Cloud9

**9.** A serverless application's infrastructure (functions, APIs, tables) must be defined in a simplified template that transforms into CloudFormation. Which framework?

- A. AWS SAM
- B. AWS CDK only
- C. Elastic Beanstalk
- D. CodeDeploy

**10.** Automated code reviews and application profiling to find the most expensive lines of code. Which service?

- A. Amazon CodeGuru
- B. X-Ray
- C. CodeBuild
- D. Trusted Advisor

---

## Part B — Khó / Nâng cao (5 câu)

**11.** A pipeline must run integration tests in a build stage, then deploy to a staging environment, require manual approval, then deploy to production. Which two services combine for this? (Choose TWO)

- A. CodePipeline (stages + manual approval action)
- B. CodeBuild (test/build stage)
- C. CodeCommit only
- D. X-Ray
- E. CodeArtifact only

**12.** A container image built in CI must be stored in a managed, private registry with vulnerability scanning before ECS deploys it. Which service?

- A. Amazon ECR
- B. CodeArtifact
- C. CodeCommit
- D. S3

**13.** An EC2 deployment must avoid downtime by shifting traffic to a new fleet and rolling back automatically if health checks fail. Which CodeDeploy configuration?

- A. Blue/Green deployment with an ELB and automatic rollback
- B. In-place all-at-once
- C. Manual copy
- D. CodeBuild only

**14.** A CodePipeline must be triggered automatically on every commit to the main branch with the lowest latency. Which integration is BEST?

- A. EventBridge (CloudWatch Events) rule on the repository/commit
- B. Periodic polling only
- C. Manual start
- D. SNS to email then manual

**15.** A distributed request is slow and the team must find which downstream service adds latency across Lambda, API Gateway, and DynamoDB. Which service and feature?

- A. X-Ray service map and trace segments
- B. CloudTrail data events
- C. Config timeline
- D. CodeGuru Reviewer
