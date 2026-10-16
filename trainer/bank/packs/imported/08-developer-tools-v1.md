---
pack: saa-08-developer-tools-v1
title: 08 · Developer Tools / CI-CD · V1
exam: SAA-C03
origin: imported
source: practice-exams/08-developer-tools-exam.md
created: 2026-10-16
---

# 08 · Developer Tools / CI-CD · V1

> Imported from `practice-exams/08-developer-tools-exam.md` + `08-developer-tools-answers.txt` by `scripts/import-practice-exams.ts`.
> Metadata (domain, services, tags, time) was inferred automatically — fix it here if it looks wrong.
> Never rename question ids: results in `trainer/results/` reference them.

## Q 08-v1-01
- domain: resilient
- topic: devtools
- services: CodeCommit
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q1

A team wants a fully managed, private Git repository in AWS integrated with other CI/CD services. Which service?

- A. AWS CodeBuild
- B. AWS CodeCommit
- C. AWS CodeDeploy
- D. AWS CodeArtifact

**Answer:** B

**Explanation:** Managed private Git repo = CodeCommit.

---

## Q 08-v1-02
- domain: resilient
- topic: devtools
- services: CodeBuild
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q2

Which service compiles source code, runs tests, and produces deployable artifacts, charging per build minute (serverless)?

- A. AWS CodeBuild
- B. AWS CodePipeline
- C. AWS CodeDeploy
- D. AWS CodeGuru

**Answer:** A

**Explanation:** Serverless build/test, per-minute = CodeBuild.

---

## Q 08-v1-03
- domain: resilient
- topic: devtools
- services: CodeDeploy, EC2, Lambda, ECS
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q3

Which service automates deploying applications to EC2, on-premises, Lambda, and ECS with rollback support?

- A. AWS CodeCommit
- B. AWS CodeDeploy
- C. AWS CodeArtifact
- D. AWS CloudFormation

**Answer:** B

**Explanation:** Automated deploys to EC2/Lambda/ECS w/ rollback = CodeDeploy.

---

## Q 08-v1-04
- domain: resilient
- topic: devtools
- services: CodePipeline
- tags: orchestration
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q4

Which service orchestrates an end-to-end release pipeline (Source → Build → Test → Deploy)?

- A. AWS CodePipeline
- B. AWS CodeBuild
- C. AWS CodeCommit
- D. AWS Step Functions

**Answer:** A

**Explanation:** End-to-end pipeline orchestration = CodePipeline.

---

## Q 08-v1-05
- domain: resilient
- topic: devtools
- services: CodeDeploy
- tags: deployment-strategies
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q5

A deployment must shift traffic to a NEW fleet and instantly roll back by swapping back if errors occur. Which CodeDeploy strategy?

- A. In-place deployment
- B. Blue/green deployment
- C. Rolling update
- D. Canary build

**Answer:** B

**Explanation:** New fleet + instant rollback by swap = Blue/green deployment.

---

## Q 08-v1-06
- domain: resilient
- topic: devtools
- services: CodeArtifact
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q6

A company wants to store and share private build dependencies (npm, Maven, PyPI) and proxy public package repositories. Which service?

- A. AWS CodeArtifact
- B. Amazon S3
- C. AWS CodeCommit
- D. Amazon ECR

**Answer:** A

**Explanation:** Private package repo + proxy public = CodeArtifact.

---

## Q 08-v1-07
- domain: performance
- topic: devtools
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q7

Which service uses ML to provide automated code reviews and runtime performance profiling recommendations?

- A. AWS CodeGuru
- B. AWS CodeBuild
- C. Amazon Inspector
- D. AWS X-Ray

**Answer:** A

**Explanation:** ML code review + profiling = CodeGuru.

---

## Q 08-v1-08
- domain: resilient
- topic: devtools
- services: CodeBuild
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q8

Which build configuration file does CodeBuild use to define build phases and commands?

- A. `appspec.yml`
- B. `buildspec.yml`
- C. `template.yaml`
- D. `Dockerfile`

**Answer:** B

**Explanation:** CodeBuild build phases file = buildspec.yml.

---

## Q 08-v1-09
- domain: resilient
- topic: devtools
- services: CodeDeploy
- tags: asg-lifecycle-hooks
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q9

Which file does CodeDeploy use to define deployment lifecycle hooks and target locations?

- A. `buildspec.yml`
- B. `appspec.yml`
- C. `pipeline.json`
- D. `taskdef.json`

**Answer:** B

**Explanation:** CodeDeploy lifecycle hooks file = appspec.yml.

---

## Q 08-v1-10
- domain: resilient
- topic: devtools
- services: ECR, ECS, EKS
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q10

A container image must be stored in a managed, private registry that integrates with ECS/EKS. Which service?

- A. AWS CodeArtifact
- B. Amazon Elastic Container Registry (ECR)
- C. AWS CodeCommit
- D. Amazon S3

**Answer:** B

**Explanation:** Private container registry for ECS/EKS = Amazon ECR.

---

## Q 08-v1-11
- domain: resilient
- topic: devtools
- services: CodeDeploy
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q11

Which CodeDeploy deployment configuration updates instances a few at a time to reduce risk?

- A. AllAtOnce
- B. OneAtATime / HalfAtATime
- C. Immutable
- D. Blue/green only

**Answer:** B

**Explanation:** Update a few at a time = OneAtATime/HalfAtATime.

---

## Q 08-v1-12
- domain: performance
- topic: devtools
- services: X-Ray
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q12

A team needs to trace requests across microservices to find latency bottlenecks. Which service?

- A. AWS X-Ray
- B. AWS CodeGuru Reviewer
- C. AWS Config
- D. CloudTrail

**Answer:** A

**Explanation:** Distributed request tracing = AWS X-Ray.

---

## Q 08-v1-13
- domain: resilient
- topic: devtools
- services: SAM, CloudFormation
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q13

Which service helps deploy a serverless application defined with a simplified template (transforms to CloudFormation)?

- A. AWS SAM (Serverless Application Model)
- B. AWS CodeDeploy
- C. AWS CodeArtifact
- D. AWS OpsWorks

**Answer:** A

**Explanation:** Simplified serverless template -> CFN = AWS SAM.

---

## Q 08-v1-14
- domain: resilient
- topic: devtools
- services: CodeCommit, CodePipeline
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q14

A pipeline should automatically start when code is pushed to the main branch. Which source integration provides this?

- A. CodeCommit (or GitHub) source action in CodePipeline
- B. CodeBuild webhook only
- C. Manual approval action
- D. S3 versioning

**Answer:** A

**Explanation:** Auto-start on push = CodeCommit/GitHub source action in CodePipeline.

---

## Q 08-v1-15
- domain: resilient
- topic: devtools
- services: CodeBuild, EC2
- difficulty: easy
- time: 50
- source: practice-exams/08-developer-tools-exam.md#Q15

Which is a valid reason to choose CodeBuild over self-managed build servers on EC2?

- A. It avoids paying for build minutes
- B. It is serverless with no build infrastructure to manage
- C. It cannot run tests
- D. It requires patching the build OS yourself

**Answer:** B

**Explanation:** Serverless build, no infra to manage = CodeBuild advantage.

---

## Q 08-v1-16
- domain: resilient
- topic: devtools
- services: CodePipeline
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q16

A release process must require manual sign-off before deploying to production. Which CodePipeline feature?

- A. Manual approval action
- B. Build stage
- C. Source stage
- D. Test stage only

**Answer:** A

**Explanation:** Production sign-off = Manual approval action.

---

## Q 08-v1-17
- domain: resilient
- topic: devtools
- services: CodeCommit, CodeBuild, CodeDeploy, CodePipeline
- tags: orchestration
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q17

Which AWS service combination represents a fully native CI/CD chain?

- A. CodeCommit → CodeBuild → CodeDeploy, orchestrated by CodePipeline
- B. S3 → Lambda → DynamoDB
- C. EC2 → ELB → ASG
- D. SNS → SQS → Lambda

**Answer:** A

**Explanation:** Native CI/CD chain = CodeCommit->CodeBuild->CodeDeploy via CodePipeline.

---

## Q 08-v1-18
- domain: secure
- topic: devtools
- services: Systems Manager, Secrets Manager, CodeBuild
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q18

Where should CodeBuild store secrets (e.g., a registry password) securely at build time?

- A. Hard-coded in buildspec.yml
- B. Systems Manager Parameter Store / Secrets Manager referenced in buildspec
- C. A public S3 bucket
- D. In the container image layers

**Answer:** B

**Explanation:** Build-time secrets = Parameter Store/Secrets Manager refs.

---

## Q 08-v1-19
- domain: resilient
- topic: devtools
- services: CodePipeline
- difficulty: medium
- time: 80
- source: practice-exams/08-developer-tools-exam.md#Q19

Which two are TRUE about AWS CodePipeline? (Choose TWO)

- A. It models release stages and transitions
- B. It can integrate third-party actions (e.g., GitHub, Jenkins)
- C. It stores container images as a registry
- D. It is a managed Git server
- E. It performs DDoS protection

**Answer:** A, B

**Explanation:** CodePipeline models stages and integrates 3rd-party actions.

---

## Q 08-v1-20
- domain: resilient
- topic: devtools
- services: CloudFormation
- tags: infrastructure-as-code, cfn-drift
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q20

A company runs infrastructure as code and wants application + infra deployed together with drift detection. Which service underpins this?

- A. AWS CloudFormation
- B. AWS CodeArtifact
- C. AWS CodeGuru
- D. Amazon ECR

**Answer:** A

**Explanation:** IaC + drift detection = CloudFormation.
