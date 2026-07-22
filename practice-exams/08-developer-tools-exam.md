# 🛠️ Practice Exam 08 — Developer Tools / CI-CD (SAA-C03)

20 questions · scenario-based · English. Answers in `08-developer-tools-answers.txt`.

---

**1.** A team wants a fully managed, private Git repository in AWS integrated with other CI/CD services. Which service?

- A. AWS CodeBuild
- B. AWS CodeCommit
- C. AWS CodeDeploy
- D. AWS CodeArtifact

**2.** Which service compiles source code, runs tests, and produces deployable artifacts, charging per build minute (serverless)?

- A. AWS CodeBuild
- B. AWS CodePipeline
- C. AWS CodeDeploy
- D. AWS CodeGuru

**3.** Which service automates deploying applications to EC2, on-premises, Lambda, and ECS with rollback support?

- A. AWS CodeCommit
- B. AWS CodeDeploy
- C. AWS CodeArtifact
- D. AWS CloudFormation

**4.** Which service orchestrates an end-to-end release pipeline (Source → Build → Test → Deploy)?

- A. AWS CodePipeline
- B. AWS CodeBuild
- C. AWS CodeCommit
- D. AWS Step Functions

**5.** A deployment must shift traffic to a NEW fleet and instantly roll back by swapping back if errors occur. Which CodeDeploy strategy?

- A. In-place deployment
- B. Blue/green deployment
- C. Rolling update
- D. Canary build

**6.** A company wants to store and share private build dependencies (npm, Maven, PyPI) and proxy public package repositories. Which service?

- A. AWS CodeArtifact
- B. Amazon S3
- C. AWS CodeCommit
- D. Amazon ECR

**7.** Which service uses ML to provide automated code reviews and runtime performance profiling recommendations?

- A. AWS CodeGuru
- B. AWS CodeBuild
- C. Amazon Inspector
- D. AWS X-Ray

**8.** Which build configuration file does CodeBuild use to define build phases and commands?

- A. `appspec.yml`
- B. `buildspec.yml`
- C. `template.yaml`
- D. `Dockerfile`

**9.** Which file does CodeDeploy use to define deployment lifecycle hooks and target locations?

- A. `buildspec.yml`
- B. `appspec.yml`
- C. `pipeline.json`
- D. `taskdef.json`

**10.** A container image must be stored in a managed, private registry that integrates with ECS/EKS. Which service?

- A. AWS CodeArtifact
- B. Amazon Elastic Container Registry (ECR)
- C. AWS CodeCommit
- D. Amazon S3

**11.** Which CodeDeploy deployment configuration updates instances a few at a time to reduce risk?

- A. AllAtOnce
- B. OneAtATime / HalfAtATime
- C. Immutable
- D. Blue/green only

**12.** A team needs to trace requests across microservices to find latency bottlenecks. Which service?

- A. AWS X-Ray
- B. AWS CodeGuru Reviewer
- C. AWS Config
- D. CloudTrail

**13.** Which service helps deploy a serverless application defined with a simplified template (transforms to CloudFormation)?

- A. AWS SAM (Serverless Application Model)
- B. AWS CodeDeploy
- C. AWS CodeArtifact
- D. AWS OpsWorks

**14.** A pipeline should automatically start when code is pushed to the main branch. Which source integration provides this?

- A. CodeCommit (or GitHub) source action in CodePipeline
- B. CodeBuild webhook only
- C. Manual approval action
- D. S3 versioning

**15.** Which is a valid reason to choose CodeBuild over self-managed build servers on EC2?

- A. It avoids paying for build minutes
- B. It is serverless with no build infrastructure to manage
- C. It cannot run tests
- D. It requires patching the build OS yourself

**16.** A release process must require manual sign-off before deploying to production. Which CodePipeline feature?

- A. Manual approval action
- B. Build stage
- C. Source stage
- D. Test stage only

**17.** Which AWS service combination represents a fully native CI/CD chain?

- A. CodeCommit → CodeBuild → CodeDeploy, orchestrated by CodePipeline
- B. S3 → Lambda → DynamoDB
- C. EC2 → ELB → ASG
- D. SNS → SQS → Lambda

**18.** Where should CodeBuild store secrets (e.g., a registry password) securely at build time?

- A. Hard-coded in buildspec.yml
- B. Systems Manager Parameter Store / Secrets Manager referenced in buildspec
- C. A public S3 bucket
- D. In the container image layers

**19.** Which two are TRUE about AWS CodePipeline? (Choose TWO)

- A. It models release stages and transitions
- B. It can integrate third-party actions (e.g., GitHub, Jenkins)
- C. It stores container images as a registry
- D. It is a managed Git server
- E. It performs DDoS protection

**20.** A company runs infrastructure as code and wants application + infra deployed together with drift detection. Which service underpins this?

- A. AWS CloudFormation
- B. AWS CodeArtifact
- C. AWS CodeGuru
- D. Amazon ECR
