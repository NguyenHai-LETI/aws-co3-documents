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
- task: 2.2
- topic: devtools
- services: CodeCommit
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q1

A team wants a fully managed, private Git repository in AWS integrated with other CI/CD services. Which service?

- A. AWS CodeCommit
- B. AWS CodeArtifact
- C. AWS CodeDeploy
- D. AWS CodeBuild

**Answer:** A

**Explanation:** Managed private Git repo = CodeCommit.

---

## Q 08-v1-02
- domain: resilient
- task: 2.1
- topic: devtools
- services: CodeBuild
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q2

Which service compiles source code, runs tests, and produces deployable artifacts, charging per build minute (serverless)?

- A. AWS CodeDeploy
- B. AWS CodePipeline
- C. AWS CodeBuild
- D. AWS CodeGuru

**Answer:** C

**Explanation:** Serverless build/test, per-minute = CodeBuild.

---

## Q 08-v1-03
- domain: resilient
- task: 2.1
- topic: devtools
- services: CodeDeploy, EC2, Lambda, ECS
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q3

Which service automates deploying applications to EC2, on-premises, Lambda, and ECS with rollback support?

- A. AWS CodeArtifact
- B. AWS CodeCommit
- C. AWS CloudFormation
- D. AWS CodeDeploy

**Answer:** D

**Explanation:** Automated deploys to EC2/Lambda/ECS w/ rollback = CodeDeploy.

---

## Q 08-v1-04
- domain: resilient
- task: 2.1
- topic: devtools
- services: CodePipeline
- tags: orchestration
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q4

Which service orchestrates an end-to-end release pipeline (Source → Build → Test → Deploy)?

- A. AWS CodeBuild
- B. AWS CodePipeline
- C. AWS CodeCommit
- D. AWS Step Functions

**Answer:** B

**Explanation:** End-to-end pipeline orchestration = CodePipeline.

---

## Q 08-v1-05
- domain: resilient
- task: 2.2
- topic: devtools
- services: CodeDeploy
- tags: deployment-strategies
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q5

A deployment must shift traffic to a NEW fleet and instantly roll back by swapping back if errors occur. Which CodeDeploy strategy?

- A. Canary build
- B. Rolling update
- C. Blue/green deployment
- D. In-place deployment

**Answer:** C

**Explanation:** New fleet + instant rollback by swap = Blue/green deployment.

---

## Q 08-v1-06
- domain: resilient
- task: 2.2
- topic: devtools
- services: CodeArtifact
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q6

A company wants to store and share private build dependencies (npm, Maven, PyPI) and proxy public package repositories. Which service?

- A. AWS CodeArtifact
- B. AWS CodeCommit
- C. Amazon ECR
- D. Amazon S3

**Answer:** A

**Explanation:** Private package repo + proxy public = CodeArtifact.

---

## Q 08-v1-07
- domain: performance
- task: 3.2
- topic: devtools
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q7

Which service uses ML to provide automated code reviews and runtime performance profiling recommendations?

- A. Amazon Inspector
- B. AWS CodeGuru
- C. AWS X-Ray
- D. AWS CodeBuild

**Answer:** B

**Explanation:** ML code review + profiling = CodeGuru.

---

## Q 08-v1-08
- domain: resilient
- task: 2.2
- topic: devtools
- services: CodeBuild
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q8

Which build configuration file does CodeBuild use to define build phases and commands?

- A. `buildspec.yml`
- B. `appspec.yml`
- C. `Dockerfile`
- D. `template.yaml`

**Answer:** A

**Explanation:** CodeBuild build phases file = buildspec.yml.

---

## Q 08-v1-09
- domain: resilient
- task: 2.1
- topic: devtools
- services: CodeDeploy
- tags: asg-lifecycle-hooks
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q9

Which file does CodeDeploy use to define deployment lifecycle hooks and target locations?

- A. `pipeline.json`
- B. `appspec.yml`
- C. `taskdef.json`
- D. `buildspec.yml`

**Answer:** B

**Explanation:** CodeDeploy lifecycle hooks file = appspec.yml.

---

## Q 08-v1-10
- domain: resilient
- task: 2.1
- topic: devtools
- services: ECR, ECS, EKS
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q10

A container image must be stored in a managed, private registry that integrates with ECS/EKS. Which service?

- A. AWS CodeArtifact
- B. AWS CodeCommit
- C. Amazon Elastic Container Registry (ECR)
- D. Amazon S3

**Answer:** C

**Explanation:** Private container registry for ECS/EKS = Amazon ECR.

---

## Q 08-v1-11
- domain: resilient
- task: 2.2
- topic: devtools
- services: CodeDeploy
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q11

Which CodeDeploy deployment configuration updates instances a few at a time to reduce risk?

- A. Blue/green only
- B. Immutable
- C. OneAtATime / HalfAtATime
- D. AllAtOnce

**Answer:** C

**Explanation:** Update a few at a time = OneAtATime/HalfAtATime.

---

## Q 08-v1-12
- domain: performance
- task: 3.4
- topic: devtools
- services: X-Ray
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q12

A team needs to trace requests across microservices to find latency bottlenecks. Which service?

- A. CloudTrail
- B. AWS Config
- C. AWS X-Ray
- D. AWS CodeGuru Reviewer

**Answer:** C

**Explanation:** Distributed request tracing = AWS X-Ray.

---

## Q 08-v1-13
- domain: resilient
- task: 2.1
- topic: devtools
- services: SAM, CloudFormation
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q13

Which service helps deploy a serverless application defined with a simplified template (transforms to CloudFormation)?

- A. AWS CodeArtifact
- B. AWS OpsWorks
- C. AWS CodeDeploy
- D. AWS SAM (Serverless Application Model)

**Answer:** D

**Explanation:** Simplified serverless template -> CFN = AWS SAM.

---

## Q 08-v1-14
- domain: resilient
- task: 2.2
- topic: devtools
- services: CodeCommit, CodePipeline
- difficulty: easy
- time: 60
- enriched: 2026-10-21
- source: practice-exams/08-developer-tools-exam.md#Q14

A pipeline should automatically start when code is pushed to the main branch. Which source integration provides this?

- A. A manual approval action configured before the pipeline reaches the production stage
- B. A CloudFormation stack update applied manually after each push to the source repository
- C. Amazon S3 versioning enabled on the pipeline's artifact bucket
- D. A CodeCommit (or GitHub) source action configured in CodePipeline

**Answer:** D

**Explanation:** A source action for CodeCommit or GitHub in CodePipeline listens for commits and automatically starts a new pipeline execution whenever code lands on the configured branch.
- A manual approval action: gates a later stage from proceeding; it does not start the pipeline when code is pushed.
- A CloudFormation stack update applied manually: requires a human to run the update, so nothing happens automatically on push.
- S3 versioning on the artifact bucket: tracks object versions for rollback, it does not watch a source repository for new commits.
> 🇻🇳 Cần tự khởi chạy khi có commit → source action (CodeCommit/GitHub) gắn trong CodePipeline; các lựa chọn khác không theo dõi commit.

---

## Q 08-v1-15
- domain: resilient
- task: 2.1
- topic: devtools
- services: CodeBuild, EC2
- difficulty: easy
- time: 50
- source: practice-exams/08-developer-tools-exam.md#Q15

Which is a valid reason to choose CodeBuild over self-managed build servers on EC2?

- A. It avoids paying for build minutes
- B. It is serverless with no build infrastructure to manage
- C. It requires patching the build OS yourself
- D. It cannot run tests

**Answer:** B

**Explanation:** Serverless build, no infra to manage = CodeBuild advantage.

---

## Q 08-v1-16
- domain: resilient
- task: 2.2
- topic: devtools
- services: CodePipeline
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q16

A release process must require manual sign-off before deploying to production. Which CodePipeline feature?

- A. Build stage
- B. Manual approval action
- C. Test stage only
- D. Source stage

**Answer:** B

**Explanation:** Production sign-off = Manual approval action.

---

## Q 08-v1-17
- domain: resilient
- task: 2.1
- topic: devtools
- services: CodeCommit, CodeBuild, CodeDeploy, CodePipeline
- tags: orchestration
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q17

Which AWS service combination represents a fully native CI/CD chain?

- A. S3 → Lambda → DynamoDB
- B. SNS → SQS → Lambda
- C. EC2 → ELB → ASG
- D. CodeCommit → CodeBuild → CodeDeploy, orchestrated by CodePipeline

**Answer:** D

**Explanation:** Native CI/CD chain = CodeCommit->CodeBuild->CodeDeploy via CodePipeline.

---

## Q 08-v1-18
- domain: secure
- task: 1.2
- topic: devtools
- services: Systems Manager, Secrets Manager, CodeBuild
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q18

Where should CodeBuild store secrets (e.g., a registry password) securely at build time?

- A. Hard-coded in buildspec.yml
- B. In the container image layers
- C. A public S3 bucket
- D. Systems Manager Parameter Store / Secrets Manager referenced in buildspec

**Answer:** D

**Explanation:** Build-time secrets = Parameter Store/Secrets Manager refs.

---

## Q 08-v1-19
- domain: resilient
- task: 2.2
- topic: devtools
- services: CodePipeline
- difficulty: medium
- time: 80
- source: practice-exams/08-developer-tools-exam.md#Q19

Which two are TRUE about AWS CodePipeline? (Choose TWO)

- A. It performs DDoS protection
- B. It models release stages and transitions
- C. It stores container images as a registry
- D. It can integrate third-party actions (e.g., GitHub, Jenkins)
- E. It is a managed Git server

**Answer:** B, D

**Explanation:** CodePipeline models stages and integrates 3rd-party actions.

---

## Q 08-v1-20
- domain: resilient
- task: 2.2
- topic: devtools
- services: CloudFormation
- tags: infrastructure-as-code, cfn-drift
- difficulty: easy
- time: 45
- source: practice-exams/08-developer-tools-exam.md#Q20

A company runs infrastructure as code and wants application + infra deployed together with drift detection. Which service underpins this?

- A. AWS CloudFormation
- B. AWS CodeGuru
- C. AWS CodeArtifact
- D. Amazon ECR

**Answer:** A

**Explanation:** IaC + drift detection = CloudFormation.
