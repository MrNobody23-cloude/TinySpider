# Production Deployment Guide

## Deployment Environments

### Development
- Local machines
- Docker Compose for services
- Hot reload enabled

### Staging
- Single server (VPS or cloud instance)
- Docker containers
- Real SSL certificates
- Representative data

### Production
- Multiple servers (HA setup)
- Managed databases
- Load balancers
- CDN for assets

## Docker Deployment

### Build Images

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build api
docker-compose build dashboard
```

### Running with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Remove volumes (careful!)
docker-compose down -v
```

### Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  clickhouse:
    image: clickhouse/clickhouse-server:23.8
    environment:
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1
    ports:
      - "8123:8123"
    volumes:
      - clickhouse_data:/var/lib/clickhouse
    restart: always

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: insightdb
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: always

  api:
    build:
      context: ./backend/packages/api
    environment:
      NODE_ENV: production
      PORT: 3000
      # ... all environment variables
    depends_on:
      - clickhouse
      - postgres
      - redis
    restart: always

  dashboard:
    build:
      context: ./frontend/packages/dashboard
    restart: always

  nginx:
    image: nginx:1.27-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
      - dashboard
    restart: always

volumes:
  clickhouse_data:
  postgres_data:
  redis_data:
```

Run with:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Kubernetes Deployment

### Helm Chart

Create `helm/analytics/values.yaml`:

```yaml
api:
  replicas: 3
  image: your-registry/analytics-api:latest
  resources:
    requests:
      memory: "256Mi"
      cpu: "250m"
    limits:
      memory: "512Mi"
      cpu: "500m"

dashboard:
  replicas: 2
  image: your-registry/analytics-dashboard:latest

clickhouse:
  replicas: 1
  persistence:
    size: 100Gi

postgres:
  replicas: 1
  persistence:
    size: 20Gi

redis:
  replicas: 1
  persistence:
    size: 10Gi
```

Deploy:
```bash
helm install analytics ./helm/analytics
```

## Cloud Deployment

### AWS

1. **EC2 for API and Dashboard**
2. **RDS for PostgreSQL**
3. **ElastiCache for Redis**
4. **S3 for backups**
5. **CloudFront for CDN**
6. **ALB for load balancing**

```bash
# Example: EC2 deployment
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --security-groups analytics \
  --key-name my-key \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=analytics-api}]'
```

### Azure

1. **App Service for API and Dashboard**
2. **Database for PostgreSQL**
3. **Cache for Redis**
4. **Blob Storage for backups**
5. **CDN for assets**
6. **Application Gateway for load balancing**

```bash
# Example: App Service deployment
az appservice plan create \
  --name analytics-plan \
  --resource-group myResourceGroup \
  --sku B2

az webapp create \
  --resource-group myResourceGroup \
  --plan analytics-plan \
  --name analytics-api
```

### Google Cloud

1. **Compute Engine for API/Dashboard**
2. **Cloud SQL for PostgreSQL**
3. **Memorystore for Redis**
4. **Cloud Storage for backups**
5. **Cloud CDN for assets**
6. **Load Balancer**

## SSL/TLS Configuration

### Let's Encrypt with Nginx

```nginx
# In nginx.conf
server {
    listen 443 ssl http2;
    server_name analytics.example.com;

    ssl_certificate /etc/letsencrypt/live/analytics.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/analytics.example.com/privkey.pem;

    # Modern configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://dashboard:5173;
    }

    location /api {
        proxy_pass http://api:3000;
    }

    location /collect {
        proxy_pass http://api:3000;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name analytics.example.com;
    return 301 https://$server_name$request_uri;
}
```

### Certbot Renewal

```bash
# Automatic renewal
certbot renew --quiet --no-eff-email --agree-tos

# Add to crontab
0 3 * * * certbot renew --quiet
```

## Performance Optimization

### API Optimization

```javascript
// backend/packages/api/src/app.js
export async function createApp() {
    const app = Fastify({
        trustProxy: true,  // Behind nginx
        bodyLimit: 1048576 // 1MB
    });

    // Enable gzip compression
    await app.register(fastifyCompress);

    // HTTP/2 Server Push
    app.get('/api/data', async (req, reply) => {
        reply.header('Link', '</api/meta>; rel=preload; as=fetch');
        return { /* data */ };
    });
}
```

### Dashboard Optimization

```javascript
// frontend/packages/dashboard/vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        minify: 'terser',
        target: 'es2020',
        rollupOptions: {
            output: {
                manualChunks: {
                    'recharts': ['recharts'],
                    'vendor': ['react', 'react-dom']
                }
            }
        }
    }
});
```

### Nginx Caching

```nginx
# Cache static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Cache dashboard for 1 hour
location / {
    expires 1h;
    add_header Cache-Control "public, must-revalidate";
}
```

## Monitoring & Logging

### Application Monitoring

Use services like:
- **DataDog**
- **New Relic**
- **Prometheus + Grafana**
- **Sentry for error tracking**

```javascript
// Integration
import * as Sentry from "@sentry/node";

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0
});
```

### Log Aggregation

Use ELK Stack or managed services:
- **CloudWatch** (AWS)
- **Azure Monitor** (Azure)
- **Stackdriver** (Google Cloud)

## Backup & Disaster Recovery

### Automated Backups

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/backups/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# ClickHouse
docker exec clickhouse clickhouse-client \
  --query "SELECT * FROM events" \
  > $BACKUP_DIR/events.csv

# PostgreSQL
docker exec postgres pg_dump \
  -U postgres insightdb \
  > $BACKUP_DIR/insightdb.sql

# Redis
docker exec redis redis-cli BGSAVE

# Upload to S3
aws s3 sync $BACKUP_DIR s3://my-backups/$(date +%Y%m%d)/
```

Schedule with cron:
```
0 2 * * * /home/user/backup.sh >> /var/log/backup.log 2>&1
```

### Disaster Recovery Plan

1. **RPO** (Recovery Point Objective): Hourly backups
2. **RTO** (Recovery Time Objective): 1 hour to restore
3. **Tested monthly**: Verify backup integrity

## Security Hardening

### Production Checklist

- [ ] Change all default passwords
- [ ] Enable HTTPS/SSL
- [ ] Enable firewall rules
- [ ] Configure CORS properly
- [ ] Use environment variables for secrets
- [ ] Enable rate limiting
- [ ] Configure backup retention
- [ ] Set up monitoring and alerts
- [ ] Regular security audits
- [ ] Database encryption at rest

See [SECURITY.md](SECURITY.md) for detailed security guidelines.

## Rollback Procedures

### Database Rollback

```bash
# Restore from backup
psql -U postgres -d insightdb < backup-date.sql
```

### Application Rollback

```bash
# Tag images
docker tag analytics-api:v1.2.0 analytics-api:latest

# Rollback to previous version
docker pull analytics-api:v1.1.0
docker tag analytics-api:v1.1.0 analytics-api:latest
docker-compose up -d
```

## Scaling Strategies

### Horizontal Scaling

```
Load Balancer
    ↓
├── API Instance 1
├── API Instance 2
└── API Instance 3
```

### Vertical Scaling

Increase resources:
```
- Memory: 2GB → 4GB
- CPU: 2 cores → 4 cores
- Storage: 50GB → 100GB
```

### Database Scaling

For ClickHouse:
- Use cluster mode
- Distributed tables
- Sharding by site_id

## Cost Optimization

- Use reserved instances
- Auto-scaling groups
- Spot instances for non-critical tasks
- Archive old data to cold storage
- Monitor and optimize resource usage

## Maintenance Windows

Schedule during low traffic:
- Database upgrades
- SSL certificate renewal
- Security patches
- Backup testing

## Runbook

Keep a runbook for:
- Emergency procedures
- Common issues and fixes
- Contact information
- Escalation procedures

Example:
```markdown
## Memory Usage High

If memory > 80%:
1. Check Redis keys: `redis-cli INFO`
2. Clear cache if needed: `redis-cli FLUSHALL`
3. Restart Redis: `docker restart redis`
4. Monitor: `docker stats`
```
