# 🔒 SECURITY SERVICES - AWS SAA-C03

## 📌 Tổng Quan

Security chiếm **30% câu hỏi** (Domain 1) trong kỳ thi SAA-C03. Đây là **DOMAIN LỚN NHẤT** và cực kỳ quan trọng.

---

## 1️⃣ AWS IAM (Identity and Access Management)

### 🎯 Khái Niệm

**IAM** = Manage access to AWS resources. **Free service**, global.

### 📊 IAM Components

#### 1. **Users**
- **Physical person** accessing AWS
- **Credentials**: Password, Access Keys
- **MFA**: Multi-Factor Authentication (recommended)

#### 2. **Groups**
- **Collection of users**
- **Inherit permissions** from group
- **Cannot nest** groups

#### 3. **Roles**
- **For AWS services** or external identities
- **Temporary credentials**
- **Use case**: EC2 accessing S3, Lambda accessing DynamoDB

#### 4. **Policies**
- **JSON documents** defining permissions
- **Types**:
  - **AWS Managed**: Created by AWS
  - **Customer Managed**: Created by you
  - **Inline**: Directly attached to user/group/role

### 📋 IAM Policy Structure

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::bucket-name/*",
      "Condition": {
        "IpAddress": {
          "aws:SourceIp": "203.0.113.0/24"
        }
      }
    }
  ]
}
```

**Components**:
- **Version**: Policy language version
- **Statement**: Permissions
  - **Effect**: Allow or Deny
  - **Action**: API calls (s3:GetObject)
  - **Resource**: AWS resources (ARN)
  - **Condition**: Optional conditions

### 🎯 IAM Best Practices

1. ✅ **Root account**: Don't use for daily tasks, enable MFA
2. ✅ **Least privilege**: Grant minimum permissions
3. ✅ **Use roles**: For EC2, Lambda (not access keys)
4. ✅ **MFA**: Enable for privileged users
5. ✅ **Password policy**: Strong passwords, rotation
6. ✅ **Access Analyzer**: Identify unused permissions
7. ✅ **CloudTrail**: Audit IAM actions

### 🔑 IAM Features

#### 1. **IAM Roles for EC2**
- **Instance Profile**: Container for IAM role
- **Attach to EC2**: No access keys needed
- **Best practice**: Always use roles, never access keys

#### 2. **Cross-Account Access**
- **Assume role** in another account
- **Use case**: Multi-account management

#### 3. **IAM Access Advisor**
- Shows **last accessed** services
- **Use case**: Identify unused permissions

#### 4. **IAM Credentials Report**
- **Account-level**: All users and credentials status
- **Use case**: Audit, compliance

#### 5. **IAM Policy Simulator**
- **Test policies** before applying
- **Use case**: Troubleshooting permissions

#### 6. **Service Control Policies (SCPs)**
- **AWS Organizations** feature
- **Restrict permissions** across accounts
- **Guardrails**: Maximum permissions

**🎯 Exam Tip**: 
- "EC2 accessing S3" = IAM Role (not access keys)
- "Least privilege" = IAM Policy with minimum permissions
- "Cross-account" = Assume Role
- "Restrict across accounts" = SCPs

---

## 2️⃣ AWS KMS (Key Management Service)

### 🔐 Khái Niệm

**KMS** = Managed encryption service, create and control encryption keys.

### 🎯 KMS Key Types

#### 1. **AWS Managed Keys**
- **Created by AWS** (aws/service-name)
- **Free**
- **Automatic rotation**: Every year — **mandatory**, cannot disable or change

#### 2. **Customer Managed Keys (CMK)**
- **Naming**: AWS now calls it **KMS key / customer managed key**; "CMK" is the old term (still seen in exams)
- **Created by customer**
- **$1/month** + usage
- **Rotation**: Optional — default 365 days, configurable **90–2560 days**, plus **on-demand** rotation
- **Full control**: Policies, grants, deletion

#### 3. **AWS Owned Keys**
- **Owned by AWS**, used internally
- **Not visible** to customers

### 📊 KMS Features

#### 1. **Encryption**
- **Encrypt data** up to 4 KB directly
- **Data keys**: For larger data (Envelope Encryption)

#### 2. **Key Policies**
- **Resource-based policies** for keys
- **Default**: Root user has full access
- **Custom**: Define who can use/manage keys

#### 3. **Grants**
- **Programmatic access** to keys
- **Use case**: Temporary permissions

#### 4. **Automatic Rotation**
- **AWS Managed Keys**: Every year, automatic & mandatory
- **Customer Managed Keys**: Optional — you enable/disable, set period (90–2560 days, default 365), or rotate on-demand
- **Keeps old versions** for decryption — key ID unchanged, no app changes needed

#### 5. **Multi-Region Keys**
- **Replicate keys** across regions
- **Same key ID** in all regions
- **Use case**: Global applications, disaster recovery

### 🔒 Envelope Encryption

**Process**:
1. Generate **Data Key** (DEK) from KMS
2. **Encrypt data** with DEK (client-side)
3. **Encrypt DEK** with CMK (KMS)
4. Store encrypted data + encrypted DEK

**Benefits**:
- Encrypt large data
- Reduce KMS API calls
- Better performance

### 💰 KMS Pricing

- **CMK**: $1/month
- **API calls**: $0.03 per 10,000 requests
- **Free tier**: 20,000 requests/month

**🎯 Exam Tip**: 
- "Encryption keys" = KMS
- "Customer-managed encryption" = Customer Managed Keys (CMK)
- "Audit key usage" = CloudTrail (KMS logs all API calls)
- "Encrypt >4 KB" = Envelope Encryption

---

## 3️⃣ AWS SECRETS MANAGER

### 🔑 Khái Niệm

**Secrets Manager** = Store and rotate secrets (passwords, API keys, tokens).

### 🎯 Key Features

- **Automatic rotation**: Lambda-based
- **Integration**: RDS, Redshift, DocumentDB
- **Versioning**: Track secret versions
- **Encryption**: KMS

### 🔄 Secrets Manager vs Systems Manager Parameter Store

| Feature | Secrets Manager | Parameter Store |
|---------|----------------|-----------------|
| **Automatic rotation** | Yes | No |
| **RDS integration** | Yes | No |
| **Cost** | $0.40/secret/month | Free (Standard), $0.05 (Advanced) |
| **Use case** | Database credentials | Application configs |

**🎯 Exam Tip**: 
- "Automatic rotation" + "database passwords" = Secrets Manager
- "Application configs" = Parameter Store
- "Cost-effective secrets" = Parameter Store

---

## 4️⃣ AWS CERTIFICATE MANAGER (ACM)

### 🔒 Khái Niệm

**ACM** = Provision, manage, deploy SSL/TLS certificates.

### 🎯 Key Features

- **Free** public certificates
- **Automatic renewal**
- **Integration**: ELB, CloudFront, API Gateway
- **Cannot export** public certificates (only private)

### 📋 Certificate Types

1. **Public Certificates**: ACM-provided, free
2. **Private Certificates**: AWS Private CA, paid
3. **Imported Certificates**: External CAs

**🎯 Exam Tip**: 
- "SSL/TLS certificates" = ACM
- "Free certificates" = ACM public certificates
- "Automatic renewal" = ACM

---

## 5️⃣ AWS CLOUDTRAIL

### 📝 Khái Niệm

**CloudTrail** = Audit log, records AWS API calls.

### 🎯 Key Features

#### 1. **Events**
- **Management Events**: Control plane (CreateBucket, TerminateInstance)
  - **Read Events**: Don't modify resources
  - **Write Events**: Modify resources
- **Data Events**: Data plane (GetObject, PutObject)
  - **High volume**, disabled by default
- **Insights Events**: Detect unusual activity (ML-based)

#### 2. **Trails**
- **Single Region**: Events in one region
- **All Regions**: Events in all regions (recommended)
- **Organization Trail**: All accounts in AWS Organizations

#### 3. **Log Storage**
- **S3**: Long-term storage
- **CloudWatch Logs**: Real-time monitoring
- **Encryption**: SSE-S3 or SSE-KMS
- **Integrity**: Log file validation

#### 4. **Event History**
- **90 days**: Default retention
- **Free**: View in console

### 🔍 CloudTrail Insights

- **Detect anomalies**: Unusual API activity
- **ML-based**: Baseline normal activity
- **Use case**: Security, troubleshooting

**🎯 Exam Tip**: 
- "Who did what" = CloudTrail
- "API audit" = CloudTrail
- "Compliance" = CloudTrail
- "Unusual activity" = CloudTrail Insights

---

## 6️⃣ AWS CLOUDWATCH

### 📊 Khái Niệm

**CloudWatch** = Monitoring and observability service.

### 🎯 CloudWatch Components

#### 1. **Metrics**
- **Time-series data** (CPU, network, disk)
- **Standard**: 5-minute intervals (free)
- **Detailed**: 1-minute intervals (paid)
- **Custom metrics**: Application-level metrics

#### 2. **Alarms**
- **Trigger actions** based on metrics
- **States**: OK, ALARM, INSUFFICIENT_DATA
- **Actions**: SNS, Auto Scaling, EC2 actions

#### 3. **Logs**
- **Collect logs** from applications, services
- **Log Groups**: Container for log streams
- **Log Streams**: Sequence of log events
- **Retention**: 1 day to 10 years, indefinite

**Log Sources**:
- EC2 (CloudWatch Agent)
- Lambda
- ECS
- VPC Flow Logs
- CloudTrail

#### 4. **Events / EventBridge**
- **Event-driven**: React to AWS events
- **Rules**: Match events and route to targets
- **Scheduled**: Cron expressions

#### 5. **Dashboards**
- **Visualize metrics**
- **Global**: See metrics from all regions

### 🔍 CloudWatch Logs Insights

- **Query logs** with SQL-like syntax
- **Visualize** query results
- **Use case**: Troubleshooting, analysis

### 📦 CloudWatch Agent

- **Collect metrics** from EC2, on-premises
- **System-level metrics**: Memory, disk, processes
- **Logs**: Application logs

**🎯 Exam Tip**: 
- "Monitoring" = CloudWatch
- "Metrics and alarms" = CloudWatch
- "Logs aggregation" = CloudWatch Logs
- "Event-driven" = EventBridge

---

## 7️⃣ AWS CONFIG

### ⚙️ Khái Niệm

**AWS Config** = Track resource configurations and compliance.

### 🎯 Key Features

#### 1. **Configuration Recorder**
- **Record changes** to resources
- **Configuration history**: Timeline of changes

#### 2. **Config Rules**
- **Evaluate compliance**: Managed or custom rules
- **Examples**:
  - S3 buckets are encrypted
  - EC2 instances have approved AMIs
  - EBS volumes are encrypted

#### 3. **Conformance Packs**
- **Collection of Config Rules**
- **Templates**: Pre-defined compliance standards

#### 4. **Remediation**
- **Automatic**: SSM Automation Documents
- **Manual**: Notify via SNS

### 🔄 Config vs CloudTrail

| Feature | Config | CloudTrail |
|---------|--------|------------|
| **Purpose** | Configuration tracking | API audit |
| **Focus** | Resource state | API calls |
| **Use case** | Compliance | Security audit |

**🎯 Exam Tip**: 
- "Configuration compliance" = AWS Config
- "Track resource changes" = AWS Config
- "Automatic remediation" = AWS Config + SSM

---

## 8️⃣ AWS GUARDDUTY

### 🛡️ Khái Niệm

**GuardDuty** = Intelligent threat detection, ML-based.

### 🎯 Key Features

- **Data sources**: CloudTrail, VPC Flow Logs, DNS logs
- **ML-based**: Detect anomalies
- **Findings**: Security issues (severity: Low, Medium, High)
- **Integration**: EventBridge, Lambda

### 🔍 GuardDuty Findings

**Examples**:
- Unusual API calls
- Compromised EC2 instances
- Reconnaissance attacks
- Bitcoin mining

**🎯 Exam Tip**: 
- "Threat detection" = GuardDuty
- "ML-based security" = GuardDuty
- "Detect compromised instances" = GuardDuty

---

## 9️⃣ AWS INSPECTOR

### 🔍 Khái Niệm

**Inspector** = Automated security assessment.

### 🎯 Key Features

#### Inspector Classic (Legacy)
- **Agent-based**: Install on EC2
- **Assessments**: Network, host

#### Inspector v2 (Current)
- **Agentless**: No agent needed (uses SSM)
- **Continuous scanning**: EC2, ECR, Lambda
- **Findings**: CVEs (Common Vulnerabilities and Exposures)

**🎯 Exam Tip**: 
- "Vulnerability scanning" = Inspector
- "CVE detection" = Inspector
- "EC2 security assessment" = Inspector

---

## 🔟 AWS MACIE

### 🔒 Khái Niệm

**Macie** = Discover and protect sensitive data in S3 using ML.

### 🎯 Key Features

- **Data discovery**: Find PII, financial data, credentials
- **ML-based**: Classify data
- **Alerts**: EventBridge integration
- **Use case**: Compliance (GDPR, HIPAA)

**🎯 Exam Tip**: 
- "Sensitive data in S3" = Macie
- "PII detection" = Macie
- "Data classification" = Macie

---

## 1️⃣1️⃣ AWS SECURITY HUB

### 🎯 Khái Niệm

**Security Hub** = Central security dashboard, aggregates findings.

### 🎯 Key Features

- **Aggregate findings**: GuardDuty, Inspector, Macie, Config
- **Compliance checks**: CIS, PCI-DSS
- **Automated remediation**: EventBridge + Lambda

**🎯 Exam Tip**: 
- "Central security dashboard" = Security Hub
- "Aggregate security findings" = Security Hub

---

## 1️⃣2️⃣ AWS WAF (Web Application Firewall)

### 🛡️ Khái Niệm

**WAF** = Protect web applications from common exploits.

### 🎯 Key Features

#### 1. **Web ACLs**
- **Rules**: Allow, block, count requests
- **Conditions**: IP, HTTP headers, body, query strings

#### 2. **Managed Rules**
- **AWS Managed**: Pre-configured rules
- **Marketplace**: Third-party rules

#### 3. **Rate-Based Rules**
- **Limit requests**: From single IP (DDoS protection)

#### 4. **Integration**
- **CloudFront**, **ALB**, **API Gateway**, **AppSync**

### 🔍 WAF Use Cases

- **SQL injection** protection
- **XSS** (Cross-Site Scripting) protection
- **DDoS** mitigation
- **Geo-blocking**
- **Rate limiting**

**🎯 Exam Tip**: 
- "Web application protection" = WAF
- "SQL injection, XSS" = WAF
- "Rate limiting" = WAF

---

## 1️⃣3️⃣ AWS SHIELD

### 🛡️ Khái Niệm

**Shield** = DDoS protection.

### 🎯 Shield Types

#### 1. **Shield Standard**
- **Free**, automatically enabled
- **Layer 3/4 protection** (network, transport)
- **All AWS customers**

#### 2. **Shield Advanced**
- **$3,000/month**
- **Enhanced protection**: Layer 3-7
- **DDoS cost protection**: No charges during attack
- **24/7 DDoS Response Team (DRT)**
- **Integration**: CloudFront, Route 53, ELB, Elastic IP

**🎯 Exam Tip**: 
- "DDoS protection" = Shield
- "Free DDoS protection" = Shield Standard
- "Advanced DDoS" + "cost protection" = Shield Advanced

---

## 1️⃣4️⃣ AWS FIREWALL MANAGER

### 🔥 Khái Niệm

**Firewall Manager** = Centrally manage firewall rules across accounts.

### 🎯 Key Features

- **AWS Organizations**: Multi-account management
- **Manage**: WAF, Shield Advanced, Security Groups, Network Firewall
- **Policies**: Apply rules across accounts

**🎯 Exam Tip**: 
- "Centralized firewall management" = Firewall Manager
- "Multi-account WAF" = Firewall Manager

---

## 1️⃣5️⃣ AMAZON COGNITO

### 👤 Khái Niệm

**Cognito** = User authentication and authorization for web/mobile apps.

### 🎯 Cognito Components

#### 1. **User Pools**
- **User directory**: Sign-up, sign-in
- **Features**: MFA, email/phone verification
- **Integration**: API Gateway, ALB

#### 2. **Identity Pools**
- **Federated identities**: Access AWS resources
- **Temporary credentials**: STS
- **Providers**: Google, Facebook, SAML, User Pools

### 🔄 User Pools vs Identity Pools

| Feature | User Pools | Identity Pools |
|---------|-----------|----------------|
| **Purpose** | Authentication | Authorization |
| **Output** | JWT tokens | AWS credentials |
| **Use case** | User login | Access AWS services |

**🎯 Exam Tip**: 
- "User authentication" = Cognito User Pools
- "Mobile app users" = Cognito
- "Temporary AWS credentials" = Cognito Identity Pools

---

## 1️⃣6️⃣ AWS DIRECTORY SERVICE

### 📁 Khái Niệm

**Directory Service** = Managed Microsoft Active Directory.

### 🎯 Types

#### 1. **AWS Managed Microsoft AD**
- **Full-featured** AD in AWS
- **Trust relationships**: On-premises AD
- **Use case**: Lift-and-shift Windows workloads

#### 2. **AD Connector**
- **Proxy**: Redirect to on-premises AD
- **No caching**: Always connects to on-premises

#### 3. **Simple AD**
- **Standalone**: Powered by Samba
- **Use case**: Small businesses, no trust relationships

**🎯 Exam Tip**: 
- "Active Directory in AWS" = AWS Managed Microsoft AD
- "Proxy to on-premises AD" = AD Connector

---

## 1️⃣7️⃣ AWS SINGLE SIGN-ON (SSO) / IAM IDENTITY CENTER

### 🔑 Khái Niệm

**IAM Identity Center** (formerly SSO) = Centralized access to AWS accounts and applications.

### 🎯 Key Features

- **Single login**: Access multiple AWS accounts
- **Integration**: SAML 2.0, Active Directory
- **Permission sets**: Assign roles to users/groups

**🎯 Exam Tip**: 
- "Single sign-on" = IAM Identity Center
- "Multi-account access" = IAM Identity Center

---

## 📋 SECURITY SERVICES COMPARISON

| Service | Purpose | Use Case |
|---------|---------|----------|
| **IAM** | Access management | Users, roles, policies |
| **KMS** | Encryption keys | Data encryption |
| **Secrets Manager** | Secret rotation | Database passwords |
| **ACM** | SSL/TLS certificates | HTTPS |
| **CloudTrail** | API audit | Compliance |
| **CloudWatch** | Monitoring | Metrics, logs, alarms |
| **Config** | Configuration tracking | Compliance |
| **GuardDuty** | Threat detection | Security monitoring |
| **Inspector** | Vulnerability scanning | CVE detection |
| **Macie** | Data classification | PII in S3 |
| **Security Hub** | Security dashboard | Aggregate findings |
| **WAF** | Web firewall | SQL injection, XSS |
| **Shield** | DDoS protection | Layer 3-7 attacks |
| **Cognito** | User authentication | Mobile/web apps |

---

## 🎯 EXAM SCENARIOS - SECURITY

### Scenario 1: EC2 Accessing S3
**Q**: "EC2 needs to read objects from S3. How to grant access?"

**A**: IAM Role attached to EC2 (not access keys)

---

### Scenario 2: Encrypt Data
**Q**: "Encrypt sensitive data at rest?"

**A**: KMS Customer Managed Key (CMK)

---

### Scenario 3: Audit API Calls
**Q**: "Track who terminated EC2 instance?"

**A**: CloudTrail

---

### Scenario 4: Detect Threats
**Q**: "Detect unusual API calls and compromised instances?"

**A**: Amazon GuardDuty

---

### Scenario 5: Compliance
**Q**: "Ensure all S3 buckets are encrypted?"

**A**: AWS Config with Config Rules

---

### Scenario 6: DDoS Protection
**Q**: "Protect against DDoS attacks?"

**A**: AWS Shield (Standard for free, Advanced for enhanced)

---

### Scenario 7: Web Application Security
**Q**: "Protect web app from SQL injection?"

**A**: AWS WAF

---

## ⚠️ COMMON MISTAKES

1. ❌ **Access keys on EC2** → Use IAM Roles
2. ❌ **Root account for daily tasks** → Create IAM users
3. ❌ **No MFA** → Enable MFA for privileged users
4. ❌ **Overly permissive policies** → Least privilege
5. ❌ **Not enabling CloudTrail** → Enable for audit
6. ❌ **Unencrypted data** → Use KMS

---

## 🎓 TIPS ĐẶC BIỆT

### 1. **Security Decision Tree**

```
Need security?
├─ Access control? → IAM
├─ Encryption? → KMS
├─ Audit? → CloudTrail
├─ Compliance? → Config
├─ Threat detection? → GuardDuty
├─ Vulnerability scan? → Inspector
├─ Sensitive data? → Macie
├─ Web protection? → WAF
└─ DDoS? → Shield
```

### 2. **Keywords Mapping**

```
"Who did what" → CloudTrail
"Encryption" → KMS
"Least privilege" → IAM Policies
"Threat detection" → GuardDuty
"Compliance" → Config
"DDoS" → Shield
"SQL injection" → WAF
"PII" → Macie
```

---

## 📚 CHECKLIST

- [ ] Hiểu IAM (Users, Groups, Roles, Policies)
- [ ] Biết khi nào dùng IAM Role vs Access Keys
- [ ] Nắm KMS encryption và key types
- [ ] Phân biệt CloudTrail vs Config vs CloudWatch
- [ ] Hiểu GuardDuty, Inspector, Macie
- [ ] Biết WAF và Shield use cases
- [ ] Nắm Cognito (User Pools vs Identity Pools)
- [ ] Hiểu Secrets Manager vs Parameter Store

---

**Next**: [06-management-governance.md](06-management-governance.md) 🚀
