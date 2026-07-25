# 🗄️ DATABASE SERVICES - AWS SAA-C03

## 📌 Tổng Quan

Database services chiếm **15-20% câu hỏi** trong kỳ thi. Phải hiểu rõ khi nào dùng relational, NoSQL, cache, hay graph database.

> 📌 **Bảng so sánh cắt ngang theo đặc điểm** (replica · Multi-AZ · backup · scaling · cost · serverless · security): xem [F-so-sanh-database-theo-dac-diem.md](F-so-sanh-database-theo-dac-diem.md)

---

## 1️⃣ AMAZON RDS (Relational Database Service)

### 🎯 Khái Niệm

**RDS** = Managed relational database service. AWS quản lý patching, backups, scaling.

### 📊 RDS Database Engines

| Engine | Use Case | Notes |
|--------|----------|-------|
| **MySQL** | General purpose | Open-source, widely used |
| **PostgreSQL** | Advanced features | JSON support, extensions |
| **MariaDB** | MySQL fork | Open-source |
| **Oracle** | Enterprise | License included or BYOL |
| **SQL Server** | Microsoft | Windows-based |
| **Aurora** | High performance | AWS proprietary, 5x MySQL |

### 🎯 Key Features

#### 1. **Automated Backups**
- **Retention**: 1-35 days (default 7)
- **Backup window**: Define maintenance window
- **Point-in-Time Recovery**: Restore to any second
- **Stored in S3**

#### 2. **Manual Snapshots**
- User-initiated
- **Retention**: Until manually deleted
- **Can share** across accounts
- **Can copy** across regions

#### 3. **Read Replicas**
- **Asynchronous replication**
- Up to **15 read replicas** (Aurora)
- **Use case**: Read-heavy workloads, analytics
- **Cross-Region**: Yes
- **Can promote** to standalone DB

**Read Replica Benefits**:
- Offload read traffic
- Disaster recovery
- Analytics without impacting production

#### 4. **Multi-AZ Deployment**
- **Synchronous replication**
- **Automatic failover** (60-120 seconds)
- **Standby** in different AZ (not readable)
- **Use case**: High availability, disaster recovery
- **DNS**: Single DNS name, automatic failover

### 🔄 Read Replicas vs Multi-AZ

| Feature | Read Replicas | Multi-AZ |
|---------|---------------|----------|
| **Purpose** | Scale reads | High availability |
| **Replication** | Asynchronous | Synchronous |
| **Readable** | Yes | No (standby) |
| **Failover** | Manual promotion | Automatic |
| **Cross-Region** | Yes | No |

**🎯 Exam Tip**: 
- "Read scaling" = Read Replicas
- "High availability" + "automatic failover" = Multi-AZ
- "Disaster recovery" = Multi-AZ + Read Replicas in other region

### 🔒 RDS Security

#### 1. **Encryption at Rest**
- **AWS KMS** (AES-256)
- Encrypt master + replicas + backups
- **Cannot encrypt existing DB** (must create new from snapshot)

#### 2. **Encryption in Transit**
- **SSL/TLS** certificates
- Force SSL: Set `rds.force_ssl=1`

#### 3. **Network Security**
- **Security Groups**: Control inbound/outbound
- **No SSH access** (managed service)

#### 4. **IAM Authentication**
- Use IAM roles instead of passwords
- **Supported**: MySQL, PostgreSQL, Aurora

#### 5. **Audit Logs**
- CloudWatch Logs integration
- CloudTrail for API calls

### ⚙️ RDS Scaling

#### 1. **Vertical Scaling** (Scale Up)
- Change instance type
- **Downtime**: Few minutes

#### 2. **Horizontal Scaling** (Scale Out)
- Add Read Replicas
- **No downtime**

#### 3. **Storage Auto Scaling**
- Automatically increase storage
- Set maximum threshold
- **No downtime**

### 💰 RDS Cost Optimization

- **Reserved Instances**: 1-3 years, 40-60% discount
- **Stop/Start**: Stop for up to 7 days (save compute costs)
- **Right-size**: Monitor CloudWatch metrics
- **Delete unused snapshots**

**🎯 Exam Tip**: 
- "Managed database" = RDS
- "Automatic backups" = RDS (enabled by default)
- "Read-heavy" = Read Replicas
- "High availability" = Multi-AZ

---

## 2️⃣ AMAZON AURORA

### 🌟 Khái Niệm

**Aurora** = AWS proprietary database, MySQL/PostgreSQL compatible.

### 🎯 Key Features

- **5x faster** than MySQL, **3x faster** than PostgreSQL
- **Storage**: Auto-scaling, 10 GB - 128 TB
- **6 copies** across 3 AZs
- **Self-healing**: Automatic corruption detection
- **Backups**: Continuous backup to S3

### 📊 Aurora Architecture

#### 1. **Storage**
- **Shared storage volume**: All instances share
- **Auto-scaling**: Grows in 10 GB increments
- **Replication**: 6 copies across 3 AZs
- **Fast recovery**: <30 seconds

#### 2. **Endpoints**

| Endpoint | Purpose | Load Balancing |
|----------|---------|----------------|
| **Writer Endpoint** | Write operations | Single master |
| **Reader Endpoint** | Read operations | Load-balanced across replicas |
| **Custom Endpoint** | Specific instances | User-defined |

### 🔄 Aurora High Availability

#### 1. **Aurora Replicas**
- Up to **15 replicas**
- **Automatic failover** (<30 seconds)
- **Priority tiers**: 0-15 (0 = highest)

#### 2. **Aurora Multi-Master**
- **Multiple write nodes**
- **Immediate failover** (no promotion)
- **Use case**: Continuous write availability

#### 3. **Aurora Global Database**
- **1 primary region** + up to **5 secondary regions**
- **Replication lag**: <1 second
- **RTO**: <1 minute
- **Use case**: Disaster recovery, global applications

### ⚡ Aurora Serverless

- **Auto-scaling**: Based on load
- **Pay per second**: No idle capacity charges
- **Use case**: Infrequent, unpredictable workloads
- **Versions**: v1 (older), v2 (newer, better)

**Aurora Serverless v2**:
- Instant scaling
- Fine-grained scaling (0.5 ACU increments)
- Compatible with Aurora features

### 🔄 Aurora vs RDS

| Feature | Aurora | RDS |
|---------|--------|-----|
| **Performance** | 5x MySQL, 3x PostgreSQL | Standard |
| **Storage** | Auto-scaling, shared | Fixed, instance-specific |
| **Replicas** | Up to 15 | Up to 5 (MySQL) |
| **Failover** | <30 seconds | 60-120 seconds |
| **Cost** | 20% more | Baseline |
| **Backtrack** | Yes (point-in-time) | No |

**🎯 Exam Tip**: 
- "High performance" + "MySQL/PostgreSQL" = Aurora
- "Global application" + "low latency" = Aurora Global Database
- "Unpredictable workload" + "cost-effective" = Aurora Serverless
- "Fastest failover" = Aurora

---

## 3️⃣ AMAZON DYNAMODB

### 🎯 Khái Niệm

**DynamoDB** = Fully managed NoSQL database, serverless, millisecond latency.

### 📊 DynamoDB Basics

#### Data Model
- **Table**: Collection of items
- **Item**: Collection of attributes (row)
- **Attribute**: Key-value pair (column)
- **Primary Key**: Required
  - **Partition Key** (hash key): Single attribute
  - **Composite Key**: Partition Key + Sort Key (range key)

#### Capacity Modes

##### 1. **Provisioned Capacity**
- Specify RCU (Read) and WCU (Write)
- **Auto Scaling**: Automatic adjustment
- **Cheaper**: For predictable workloads

**Capacity Units**:
- **1 RCU** = 1 strongly consistent read/sec (4 KB)
- **1 WCU** = 1 write/sec (1 KB)

##### 2. **On-Demand Capacity**
- Pay per request
- **No capacity planning**
- **Use case**: Unpredictable traffic, new applications
- **Cost**: 5x more expensive per request

### 🔄 DynamoDB Features

#### 1. **Secondary Indexes**

**Global Secondary Index (GSI)**:
- Different partition key + sort key
- **Separate RCU/WCU**
- Can create after table creation
- **Use case**: Query on non-key attributes

**Local Secondary Index (LSI)**:
- Same partition key, different sort key
- **Shares RCU/WCU** with table
- Must create at table creation
- **Use case**: Alternative sort key

#### 2. **DynamoDB Streams**
- **Change data capture** (CDC)
- **Retention**: 24 hours
- **Use case**: Trigger Lambda, replication, analytics
- **Ordering**: Per partition key

#### 3. **DynamoDB Accelerator (DAX)**
- **In-memory cache**
- **Microsecond latency**
- **Compatible**: No code changes
- **Use case**: Read-heavy, low-latency

**DAX vs ElastiCache**:
- **DAX**: DynamoDB-specific, seamless integration
- **ElastiCache**: General-purpose, requires code changes

#### 4. **Global Tables**
- **Multi-region, multi-active**
- **Two-way replication**
- **Active-active**: Write to any region
- **Use case**: Global applications, DR

**Requirements**:
- DynamoDB Streams enabled
- Same table name in all regions

#### 5. **Point-in-Time Recovery (PITR)**
- **Continuous backups** (last 35 days)
- **Restore** to any second
- **No performance impact**

#### 6. **On-Demand Backup**
- **Manual backups**
- **Retention**: Until deleted
- **Restore**: New table

### 🔒 DynamoDB Security

- **Encryption at rest**: KMS (default)
- **Encryption in transit**: SSL/TLS
- **IAM**: Fine-grained access control
- **VPC Endpoints**: Private access
- **CloudTrail**: Audit logs

### 💰 DynamoDB Cost Optimization

- **On-Demand vs Provisioned**: Choose based on traffic pattern
- **Auto Scaling**: Adjust RCU/WCU automatically
- **Reserved Capacity**: 1-3 years, save up to 77%
- **Delete unused tables/indexes**

**🎯 Exam Tip**: 
- "NoSQL" + "millisecond latency" = DynamoDB
- "Serverless database" = DynamoDB
- "Key-value" or "document" = DynamoDB
- "Global application" + "multi-region" = DynamoDB Global Tables
- "Microsecond latency" = DynamoDB + DAX

---

## 4️⃣ AMAZON ELASTICACHE

### 🚀 Khái Niệm

**ElastiCache** = Managed in-memory cache (Redis, Memcached).

### 📊 ElastiCache Engines

| Feature | Redis | Memcached |
|---------|-------|-----------|
| **Data Types** | Rich (strings, lists, sets) | Simple (strings) |
| **Persistence** | Yes (RDB, AOF) | No |
| **Replication** | Yes (Multi-AZ) | No |
| **Backup/Restore** | Yes | No |
| **Pub/Sub** | Yes | No |
| **Transactions** | Yes | No |
| **Multi-threading** | No | Yes |
| **Sharding** | Yes (Cluster Mode) | Yes |

### 🎯 Redis Features

#### 1. **Redis Cluster Mode**
- **Disabled**: Single shard, up to 5 replicas
- **Enabled**: Multiple shards (partitions), scale writes

#### 2. **Redis Replication**
- **Multi-AZ**: Automatic failover
- **Read Replicas**: Up to 5 per shard

#### 3. **Redis Persistence**
- **RDB**: Point-in-time snapshots
- **AOF**: Append-only file (every write)

#### 4. **Redis Auth**
- **AUTH token**: Password protection
- **In-transit encryption**: TLS

### 🔄 ElastiCache Use Cases

```
Session store → Redis (persistence)
Leaderboard → Redis (sorted sets)
Pub/Sub → Redis
Simple cache → Memcached
Multi-threaded → Memcached
Database query cache → Redis or Memcached
```

### 🎯 Caching Strategies

#### 1. **Lazy Loading** (Cache-Aside)
- Read from cache first
- If miss, read from DB and populate cache
- **Pros**: Only requested data cached
- **Cons**: Cache miss penalty, stale data

#### 2. **Write-Through**
- Write to cache and DB simultaneously
- **Pros**: Data never stale
- **Cons**: Write penalty, unnecessary writes

#### 3. **TTL** (Time-To-Live)
- Expire data after time period
- **Balance**: Freshness vs cache hits

**🎯 Exam Tip**: 
- "In-memory cache" = ElastiCache
- "Session store" + "persistence" = Redis
- "Leaderboard" = Redis (sorted sets)
- "Multi-threaded" = Memcached
- "Pub/Sub" = Redis

---

## 5️⃣ AMAZON REDSHIFT

### 📊 Khái Niệm

**Redshift** = Managed data warehouse, OLAP (Online Analytical Processing).

### 🎯 Key Features

- **Columnar storage**: Optimized for analytics
- **Massively Parallel Processing (MPP)**
- **SQL-based**: PostgreSQL compatible
- **Petabyte-scale**: 1 PB+
- **Compression**: Automatic

### 📊 Redshift Architecture

#### 1. **Cluster**
- **Leader Node**: Query planning, coordination
- **Compute Nodes**: Execute queries, store data

#### 2. **Node Types**

| Type | Use Case |
|------|----------|
| **Dense Compute (DC2)** | High performance, SSD |
| **Dense Storage (DS2)** | Large datasets, HDD |
| **RA3** | Managed storage, separate compute/storage |

### 🔄 Redshift Features

#### 1. **Redshift Spectrum**
- Query data in S3 without loading
- **Use case**: Extend data warehouse to S3

#### 2. **Enhanced VPC Routing**
- Force traffic through VPC
- **Use case**: Compliance, security

#### 3. **Snapshots**
- **Automated**: Every 8 hours or 5 GB
- **Manual**: User-initiated
- **Cross-Region**: Copy for DR

#### 4. **Redshift Serverless**
- No cluster management
- **Pay per query**
- **Use case**: Unpredictable workloads

### 💰 Redshift Cost Optimization

- **Reserved Nodes**: 1-3 years, save up to 75%
- **Pause/Resume**: Pause when not in use
- **Spectrum**: Query S3 without loading
- **Concurrency Scaling**: Pay only when needed

**🎯 Exam Tip**: 
- "Data warehouse" = Redshift
- "OLAP" = Redshift
- "Analytics" + "petabyte" = Redshift
- "Query S3" = Redshift Spectrum

---

## 6️⃣ AMAZON NEPTUNE

### 🕸️ Khái Niệm

**Neptune** = Managed graph database.

### 🎯 Key Features

- **Graph models**: Property Graph, RDF
- **Query languages**: Gremlin, SPARQL
- **High availability**: Multi-AZ
- **Use case**: Social networks, fraud detection, recommendation engines

**🎯 Exam Tip**: 
- "Graph database" = Neptune
- "Relationships" + "connections" = Neptune

---

## 7️⃣ AMAZON DOCUMENTDB

### 📄 Khái Niệm

**DocumentDB** = Managed MongoDB-compatible database.

### 🎯 Key Features

- **MongoDB compatible**: Use MongoDB drivers
- **Fully managed**: Backups, patching
- **Storage**: Auto-scaling to 64 TB
- **Replication**: 6 copies across 3 AZs

**🎯 Exam Tip**: 
- "MongoDB" + "managed" = DocumentDB

---

## 8️⃣ AMAZON KEYSPACES

### 🔑 Khái Niệm

**Keyspaces** = Managed Apache Cassandra-compatible database.

### 🎯 Key Features

- **Cassandra compatible**: Use CQL (Cassandra Query Language)
- **Serverless**: Auto-scaling
- **Use case**: IoT, time-series data

**🎯 Exam Tip**: 
- "Cassandra" + "managed" = Keyspaces

---

## 9️⃣ AMAZON QLDB

### 📒 Khái Niệm

**QLDB** = Quantum Ledger Database, immutable, cryptographically verifiable.

### 🎯 Key Features

- **Ledger**: Immutable transaction log
- **Cryptographic verification**: SHA-256
- **SQL-like**: PartiQL query language
- **Use case**: Financial transactions, supply chain, audit logs

**🎯 Exam Tip**: 
- "Immutable" + "audit trail" = QLDB
- "Ledger" = QLDB
- "Cryptographically verifiable" = QLDB

---

## 🔟 AMAZON TIMESTREAM

### ⏱️ Khái Niệm

**Timestream** = Managed time-series database.

### 🎯 Key Features

- **Time-series data**: IoT, metrics, logs
- **Auto-scaling**: Serverless
- **Built-in analytics**: Time-series functions
- **Tiered storage**: Memory + SSD

**🎯 Exam Tip**: 
- "Time-series" = Timestream
- "IoT metrics" = Timestream

---

## 1️⃣1️⃣ AWS DATABASE MIGRATION SERVICE (DMS)

### 🔄 Khái Niệm

**DMS** = Migrate databases to AWS with minimal downtime.

### 🎯 Key Features

#### Migration Types
1. **Homogeneous**: Same engine (MySQL → MySQL)
2. **Heterogeneous**: Different engine (Oracle → Aurora)
   - Requires **AWS Schema Conversion Tool (SCT)**

#### Migration Strategies
1. **Full Load**: One-time migration
2. **Full Load + CDC**: Continuous replication (Change Data Capture)
3. **CDC Only**: Ongoing replication

### 📊 DMS Sources & Targets

**Sources**: On-premises, EC2, RDS, S3, Azure SQL, MongoDB
**Targets**: RDS, Aurora, Redshift, DynamoDB, S3, ElastiCache, Kinesis

### 🎯 DMS Use Cases

- Database migration to AWS
- Database replication (DR)
- Database consolidation
- Continuous data replication

**🎯 Exam Tip**: 
- "Database migration" + "minimal downtime" = DMS
- "Different database engines" = DMS + SCT
- "Continuous replication" = DMS with CDC

---

## 📋 DATABASE SERVICES COMPARISON

| Service | Type | Use Case | Managed |
|---------|------|----------|---------|
| **RDS** | Relational (OLTP) | Transactional applications | Yes |
| **Aurora** | Relational (OLTP) | High-performance RDBMS | Yes |
| **DynamoDB** | NoSQL (Key-Value) | Serverless, low latency | Yes |
| **ElastiCache** | In-Memory | Caching, session store | Yes |
| **Redshift** | Data Warehouse (OLAP) | Analytics, BI | Yes |
| **Neptune** | Graph | Relationships, networks | Yes |
| **DocumentDB** | NoSQL (Document) | MongoDB workloads | Yes |
| **Keyspaces** | NoSQL (Wide-Column) | Cassandra workloads | Yes |
| **QLDB** | Ledger | Immutable audit logs | Yes |
| **Timestream** | Time-Series | IoT, metrics | Yes |

---

## 🎯 DATABASE SELECTION DECISION TREE

```
Need database?
├─ Relational (SQL)?
│  ├─ High performance? → Aurora
│  ├─ Specific engine? → RDS
│  └─ Data warehouse? → Redshift
├─ NoSQL?
│  ├─ Key-value, serverless? → DynamoDB
│  ├─ Document (MongoDB)? → DocumentDB
│  ├─ Wide-column (Cassandra)? → Keyspaces
│  └─ Graph? → Neptune
├─ In-memory cache? → ElastiCache (Redis/Memcached)
├─ Ledger? → QLDB
└─ Time-series? → Timestream
```

---

## 🎯 EXAM SCENARIOS - DATABASE

### Scenario 1: High Availability
**Q**: "MySQL database with automatic failover, minimal downtime?"

**A**: RDS MySQL with Multi-AZ

---

### Scenario 2: Read Scaling
**Q**: "PostgreSQL database, read-heavy workload, scale reads?"

**A**: RDS PostgreSQL with Read Replicas

---

### Scenario 3: Global Application
**Q**: "Low-latency database for global users?"

**A**: DynamoDB Global Tables or Aurora Global Database

---

### Scenario 4: Serverless NoSQL
**Q**: "Serverless, NoSQL, millisecond latency, unpredictable traffic?"

**A**: DynamoDB with On-Demand capacity

---

### Scenario 5: Caching
**Q**: "Reduce database load, cache frequently accessed data?"

**A**: ElastiCache (Redis for persistence, Memcached for simple)

---

### Scenario 6: Data Warehouse
**Q**: "Analyze petabytes of data, complex queries?"

**A**: Amazon Redshift

---

### Scenario 7: Database Migration
**Q**: "Migrate Oracle database to Aurora with minimal downtime?"

**A**: AWS DMS + Schema Conversion Tool (SCT)

---

## ⚠️ COMMON MISTAKES

1. ❌ **Dùng RDS cho analytics workload** → Dùng Redshift
2. ❌ **Không enable Multi-AZ cho production** → Always enable for HA
3. ❌ **Quên Read Replicas cho read-heavy** → Scale reads
4. ❌ **Dùng Provisioned DynamoDB cho unpredictable traffic** → Use On-Demand
5. ❌ **Không dùng ElastiCache** → Reduce database load
6. ❌ **Chọn Aurora cho simple workload** → RDS đủ, rẻ hơn

---

## 🎓 TIPS ĐẶC BIỆT

### 1. **Keywords Mapping**

```
"High availability" → Multi-AZ
"Read scaling" → Read Replicas
"Global" → Global Tables/Database
"Serverless" → DynamoDB, Aurora Serverless
"Cache" → ElastiCache
"Analytics" → Redshift
"Graph" → Neptune
"Ledger" → QLDB
"Time-series" → Timestream
"Migration" → DMS
```

### 2. **OLTP vs OLAP**

```
OLTP (Transactional):
- RDS, Aurora, DynamoDB
- Many small transactions
- Low latency

OLAP (Analytical):
- Redshift
- Complex queries
- Large datasets
```

### 3. **Backup Strategy**

```
RDS:
- Automated backups (1-35 days)
- Manual snapshots (indefinite)
- Point-in-time recovery

DynamoDB:
- On-demand backups
- Point-in-time recovery (35 days)
- Continuous backups
```

---

## 📚 CHECKLIST

- [ ] Hiểu RDS engines và use cases
- [ ] Phân biệt Read Replicas vs Multi-AZ
- [ ] Nắm vững Aurora features (Global, Serverless)
- [ ] Biết DynamoDB capacity modes (Provisioned vs On-Demand)
- [ ] Hiểu DynamoDB indexes (GSI vs LSI)
- [ ] Phân biệt Redis vs Memcached
- [ ] Biết khi nào dùng Redshift
- [ ] Nắm các specialized databases (Neptune, DocumentDB, QLDB, Timestream)
- [ ] Hiểu DMS và SCT

---

**Next**: [04-networking-services.md](04-networking-services.md) - Networking là foundation của AWS! 🚀
