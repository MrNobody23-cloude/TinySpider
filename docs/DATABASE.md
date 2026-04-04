# Database Setup & Configuration

## Overview

TinySpider uses three databases for different purposes:

1. **ClickHouse** - Time-series analytics (events)
2. **PostgreSQL** - Relational metadata (users, sites, funnels)
3. **Redis** - Cache and job queue

## ClickHouse Setup

### Purpose
Stores all analytics events and pre-computed aggregations. Optimized for OLAP queries.

### Installation

#### Docker (Recommended)
```bash
docker run -d \
  --name clickhouse \
  -p 8123:8123 \
  -p 9000:9000 \
  -v clickhouse_data:/var/lib/clickhouse \
  clickhouse/clickhouse-server:23.8
```

#### Local Installation
```bash
# macOS
brew install clickhouse

# Ubuntu/Debian
sudo apt-get install clickhouse-server clickhouse-client
```

### Schema Initialization

The schema initializes automatically on first API start, but you can manually run:

```bash
curl -X POST 'http://localhost:8123' \
  --data-binary @backend/packages/api/src/db/clickhouse-schema.sql
```

### Schema Details

**Main Table: events**
```sql
CREATE TABLE events (
  event_id UUID DEFAULT generateUUIDv4(),
  site_id String,
  event_type Enum8('pageview'=1, 'click'=2, 'custom'=3),
  url String,
  referrer String,
  user_agent String,
  ip_hash FixedString(64),
  country String,
  city String,
  lat Float32,
  lon Float32,
  click_x Float32,
  click_y Float32,
  session_id String,
  is_bot Bool DEFAULT false,
  timestamp DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (site_id, timestamp)
TTL timestamp + INTERVAL 1 YEAR;
```

**Materialized Views:**

1. **events_by_minute** - Pre-aggregated hourly statistics
2. **top_referrers** - Pre-aggregated referrer data

### Configuration

**File:** `.env`

```env
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=default
```

### Commands

```bash
# Check if running
curl http://localhost:8123/ping

# Query data directly
clickhouse-client --query "SELECT COUNT(*) FROM events"

# Export data as CSV
clickhouse-client --format CSV \
  --query "SELECT * FROM events" > events.csv
```

### Monitoring

```bash
# Check table size
SELECT
  table,
  formatReadableSize(size) as size
FROM system.tables
WHERE database='default';

# Check query performance
SELECT query_start_time, query_duration_ms, query
FROM system.query_log
ORDER BY query_start_time DESC
LIMIT 10;
```

## PostgreSQL Setup

### Purpose
Stores metadata: users, sites, API keys, funnels, authentication data.

### Installation

#### Docker (Recommended)
```bash
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine
```

#### Local Installation
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Start service
sudo service postgresql start
```

### Schema Initialization

Schema initializes automatically on first API start:

```bash
# Or manually:
psql -U postgres -d insightdb < backend/packages/api/src/db/postgres-schema.sql
```

### Schema Details

**sites table:**
```sql
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) NOT NULL UNIQUE,
  api_key VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**users table:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**funnels table:**
```sql
CREATE TABLE funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  steps JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Configuration

**File:** `.env`

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=insightdb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

### Commands

```bash
# Connect to database
psql -U postgres -d insightdb

# List tables
\dt

# View table structure
\d sites

# Query data
SELECT * FROM sites;

# Backup database
pg_dump -U postgres -d insightdb > backup.sql

# Restore database
psql -U postgres -d insightdb < backup.sql
```

### User Management

```sql
-- Create new user
CREATE USER analytics_user WITH PASSWORD 'secure_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE insightdb TO analytics_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO analytics_user;
```

## Redis Setup

### Purpose
Caching layer and job queue for asynchronous event processing.

### Installation

#### Docker (Recommended)
```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine
```

#### Local Installation
```bash
# macOS
brew install redis

# Ubuntu/Debian
sudo apt-get install redis-server

# Start service
redis-server
```

### Configuration

**File:** `.env`

```env
REDIS_URL=redis://localhost:6379
```

### Commands

```bash
# Test connection
redis-cli ping

# Get all keys
redis-cli KEYS '*'

# Monitor commands
redis-cli MONITOR

# Check memory usage
redis-cli INFO memory

# Flush cache (careful!)
redis-cli FLUSHALL
```

### Job Queue Configuration

BullMQ uses Redis for storing job queues:

```javascript
// Queue statistics
const queue = new Queue('events');
const stats = await queue.getJobCounts();
console.log(stats);
// { active: 0, completed: 1000, failed: 0, ... }
```

## Database Backups

### ClickHouse Backup

```bash
# Native backup
clickhouse-client --query "BACKUP TABLE events TO '/var/clickhouse-backups/backup-daily'"

# Export as CSV
clickhouse-client --format CSV \
  --query "SELECT * FROM events" > clickhouse_backup.csv
```

### PostgreSQL Backup

```bash
# Full database backup
pg_dump -U postgres -d insightdb > pg_backup.sql

# Compressed backup
pg_dump -U postgres -d insightdb | gzip > pg_backup.sql.gz

# Scheduled backup (cron)
0 2 * * * pg_dump -U postgres insightdb | gzip > /backups/pg_$(date +\%Y\%m\%d).sql.gz
```

### Redis Backup

```bash
# Redis handles persistence automatically
# Configure in redis.conf:
save 900 1      # After 900 sec if 1+ keys changed
save 300 10     # After 300 sec if 10+ keys changed
save 60 10000   # After 60 sec if 10000+ keys changed

# Manual save
redis-cli SAVE
redis-cli BGSAVE
```

## Data Retention

### ClickHouse TTL 

Events automatically deleted after 1 year:

```sql
-- Current TTL
ALTER TABLE events MODIFY TTL timestamp + INTERVAL 1 YEAR;

-- Change to 6 months (example)
ALTER TABLE events MODIFY TTL timestamp + INTERVAL 6 MONTH;
```

### PostgreSQL Cleanup

```sql
-- Manual cleanup (if needed)
DELETE FROM events 
WHERE timestamp < NOW() - INTERVAL '1 year';
DELETE FROM event_logs 
WHERE created_at < NOW() - INTERVAL '90 days';
```

## Performance Tuning

### ClickHouse Optimization

```javascript
// Enable query profiling
SET send_logs_level = 'debug';

// Check query performance
EXPLAIN SELECT * FROM events WHERE site_id = 'test';
```

### PostgreSQL Optimization

```sql
-- Create indexes
CREATE INDEX idx_sites_api_key ON sites(api_key);
CREATE INDEX idx_funnels_site_id ON funnels(site_id);

-- Check index usage
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname != 'pg_catalog';
```

### Redis Optimization

```bash
# Check memory usage
redis-cli INFO stats

# Optimize memory
redis-cli MEMORY DOCTOR

# Configure max memory policy (in redis.conf)
maxmemory 2gb
maxmemory-policy allkeys-lru
```

## Troubleshooting

### ClickHouse Connection Issues

```bash
# Check if running
telnet localhost 8123

# Check logs
docker logs clickhouse

# Restart service
docker restart clickhouse
```

### PostgreSQL Connection Issues

```bash
# Check if running
psql -U postgres -c "SELECT 1"

# Check logs
tail -f /var/log/postgresql/postgresql.log

# Restart service
sudo service postgresql restart
```

### Redis Connection Issues

```bash
# Check if running
redis-cli ping

# Check logs
docker logs redis

# Restart service
docker restart redis
```

## Disaster Recovery

### Complete Database Restoration

```bash
#!/bin/bash
# Backup all databases
mkdir -p backups

# ClickHouse
clickhouse-client --query "SELECT * FROM events" > backups/events.csv

# PostgreSQL
pg_dump -U postgres insightdb > backups/insightdb.sql

# Redis
redis-cli --rdb backups/dump.rdb

echo "Backup complete: $(date)" >> backups/log.txt
```

## Migration

### Migrating to Different Server

```bash
# On old server
pg_dump -U postgres insightdb > insightdb.sql
clickhouse-client --query "SELECT * FROM events" > events.sql

# Transfer files to new server
scp insightdb.sql user@new-server:/tmp/
scp events.sql user@new-server:/tmp/

# On new server
psql -U postgres < /tmp/insightdb.sql
clickhouse-client < /tmp/events.sql
```

### Scaling Databases

1. **ClickHouse Cluster**: Multiple nodes for distributed analytics
2. **PostgreSQL Replication**: Master-slave setup for HA
3. **Redis Cluster**: Distributed cache across multiple nodes

See [DEPLOYMENT.md](DEPLOYMENT.md) for production scaling details.
