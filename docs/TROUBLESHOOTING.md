# Troubleshooting Guide

## Common Issues & Solutions

### Installation Issues

#### npm workspace error
**Error:** `This version of npm does not support workspaces`

**Solution:**
```bash
npm --version  # Should be 8.0+
npm install -g npm@latest
```

#### Missing dependencies
**Error:** `Cannot find module 'X'`

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install:all
```

#### Port already in use
**Error:** `listen EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find process using port
lsof -i :3000      # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process (macOS/Linux)
kill -9 <PID>

# Or change port in .env
PORT=3001
```

---

### Database Connection Issues

#### ClickHouse Connection Error
**Error:** `connect ECONNREFUSED 127.0.0.1:8123`

**Diagnosis:**
```bash
# Check if running
curl http://localhost:8123/ping

# Docker
docker ps | grep clickhouse
docker logs clickhouse
```

**Solution:**
```bash
# Start ClickHouse
docker run -d --name clickhouse -p 8123:8123 clickhouse/clickhouse-server:23.8

# Or with docker-compose
docker-compose up -d clickhouse
```

#### PostgreSQL Connection Error
**Error:** `connect ECONNREFUSED 127.0.0.1:5432`

**Diagnosis:**
```bash
# Check if running
pg_isready -h localhost -p 5432

# Docker
docker ps | grep postgres
docker logs postgres
```

**Solution:**
```bash
# Start PostgreSQL
docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15-alpine

# Or verify credentials in .env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_PASSWORD=postgres
```

#### Redis Connection Error
**Error:** Error: connect ECONNREFUSED 127.0.0.1:6379

**Diagnosis:**
```bash
# Check if running
redis-cli ping

# Docker
docker ps | grep redis
docker logs redis
```

**Solution:**
```bash
# Start Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Or with docker-compose
docker-compose up -d redis
```

---

### API Server Issues

#### API Won't Start
**Error:** `API server fails to start`

**Diagnosis:**
```bash
# Check logs
npm run dev:backend

# Or with docker
docker logs analytics-api
```

**Solutions:**
```bash
# Check environment variables
cat .env | grep "NODE_ENV\|PORT\|JWT_SECRET"

# Verify all secrets are set
# (Must not be empty)
```

#### 502 Bad Gateway
**Error:** `502 Bad Gateway from Nginx`

**Diagnosis:**
```bash
# Test API directly
curl http://localhost:3000/api/health

# Check Nginx logs
docker logs nginx
tail /var/log/nginx/error.log
```

**Solution:**
```bash
# Ensure API is running
npm run dev:backend

# Check Nginx config
docker exec nginx nginx -t

# Restart Nginx
docker restart nginx
```

#### High Memory Usage
**Error:** API process using > 80% memory

**Diagnosis:**
```bash
# Check memory
docker stats

# Check Node process
ps aux | grep node
```

**Solution:**
```bash
# Increase Node memory limit
NODE_OPTIONS=--max-old-space-size=4096 npm run dev:backend

# Or in docker-compose.yml
environment:
  NODE_OPTIONS: "--max-old-space-size=4096"
```

#### Slow Queries
**Error:** Dashboard is loading slowly

**Diagnosis:**
```bash
# Check query performance
EXPLAIN SELECT * FROM events WHERE site_id = 'test';
```

**Solution:**
```
# Enable Redis caching
# Already enabled by default (60-second TTL)

# Or increase TTL
# In API code, modify cache duration
```

---

### Dashboard Issues

#### Dashboard Won't Load
**Error:** Blank page or loading forever

**Diagnosis:**
```bash
# Check browser console
# Open DevTools: F12 → Console

# Check if API is accessible
curl http://localhost:3000/api/health

# Check if dashboard is running
curl http://localhost:5173
```

**Solution:**
```bash
# Restart dashboard
npm run dev:frontend

# Or with docker
docker restart dashboard

# Check API_BASE URL in vite.config.js
```

#### CORS Error in Dashboard
**Error:** `Access to XMLHttpRequest blocked by CORS`

**Diagnosis:**
```javascript
// In browser console
// Look for CORS error message
```

**Solution:**
```env
# Update .env with dashboard domain
API_CORS_ORIGINS=http://localhost,http://localhost:5173

# For production
API_CORS_ORIGINS=https://example.com,https://dashboard.example.com
```

#### Charts Not Displaying
**Error:** "Loading..." forever or blank charts

**Diagnosis:**
```bash
# Check API responses
curl "http://localhost:3000/api/stats/timeseries?site_id=test&from=2024-01-01&to=2024-12-31"

# Check browser network tab
# DevTools → Network → Filter XHR
```

**Solution:**
```bash
# Ensure API is returning data
# Send test event first
curl -X POST http://localhost:3000/collect \
  -H "Content-Type: application/json" \
  -d '{"site_id":"test","event_type":"pageview","url":"/"}'

# Wait a moment, then refresh dashboard
```

---

### Event Collection Issues

#### Events Not Being Recorded
**Error:** Dashboard shows no data

**Diagnosis:**
```bash
# Check if tracker is loading
# Browser DevTools → Network → Look for /tracker.js

# Check if /collect is being called
# DevTools → Network →  Filter "collect"

# Check API logs
docker logs analytics-api
```

**Solutions:**

1. **Verify tracker is embedded:**
```html
<script>
  window.InsightConfig = {
    siteId: 'test-site',
    endpoint: 'http://localhost:3000/collect'
  };
</script>
<script src="http://localhost:3000/tracker.js"></script>
```

2. **Check CORS headers:**
```bash
curl -v -X POST http://localhost:3000/collect \
  -H "Content-Type: application/json" \
  -d '{"site_id":"test","event_type":"pageview","url":"/"}'

# Should return 200 with { "ok": true }
```

3. **Verify API is running:**
```bash
curl http://localhost:3000/api/health
# Should return { "status": "ok", ... }
```

#### Rate Limit Exceeded
**Error:** `429 Too Many Requests`

**Cause:** Too many events sent too quickly (>100/min)

**Solution:**
```env
# Increase rate limit if needed
# In backend/packages/api/src/routes/collect.js
# Change max: 100 to higher value

# Or wait a minute before retrying
```

#### Wrong Event Type
**Error:** Events appear but with wrong type

**Diagnosis:**
```bash
# Check event_type in request
curl -X POST http://localhost:3000/collect \
  -H "Content-Type: application/json" \
  -d '{"site_id":"test","event_type":"INVALID"}'

# Should return 400 error
```

**Solution:**
```javascript
// Valid event types only
const validTypes = ['pageview', 'click', 'custom'];

// In tracker or API validation
```

---

### Docker/Container Issues

#### Container Won't Start
**Error:** `docker: Error response from daemon`

**Diagnosis:**
```bash
# Check logs
docker logs <container_name>

# Check image exists
docker images | grep analytics
```

**Solution:**
```bash
# Build image
docker-compose build

# Try running again
docker-compose up
```

#### Docker Compose Services Wait Too Long
**Error:** Services timeout waiting for dependencies

**Solution:**
```yaml
# In docker-compose.yml
services:
  api:
    depends_on:
      clickhouse:
        condition: service_healthy
```

#### Volumes Not Mounting
**Error:** Files not persisting between restarts

**Diagnosis:**
```bash
# Check volume mounts
docker inspect <container_name> | grep Mounts

# Check disk space
df -h
```

**Solution:**
```bash
# Verify volumes in docker-compose.yml
volumes:
  - clickhouse_data:/var/lib/clickhouse

# Create volume manually if needed
docker volume create clickhouse_data
```

---

### Performance Issues

#### Dashboard Slow After Few Days
**Error:** UI becomes sluggish

**Cause:** Large event tables slowing queries

**Solution:**
```sql
-- Check table size
SELECT
  table,
  formatReadableSize(size) as size
FROM system.tables
WHERE database='default';

-- Optimize ClickHouse
OPTIMIZE TABLE events FINAL;
```

#### API Response Times Increasing
**Error:** API responses slow down over time

**Diagnosis:**
```bash
# Check database size
psql -U postgres -d insightdb -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) FROM pg_database ORDER BY pg_database_size DESC;"
```

**Solution:**
```sql
-- Analyze tables (PostgreSQL)
ANALYZE;

-- Create indexes if missing
CREATE INDEX ON events (site_id, timestamp);
```

---

### Authentication Issues

#### Can't Login
**Error:** `Invalid credentials` despite correct password

**Diagnosis:**
```bash
# Check if user exists
psql -U postgres -d insightdb -c "SELECT * FROM users;"

# Check password hash
```

**Solution:**
```sql
-- Reset user password
UPDATE users SET password_hash = '$2b$12$...' WHERE email = 'user@example.com';

-- Or delete and recreate user
DELETE FROM users WHERE email = 'user@example.com';
-- Then register new account
```

#### JWT Token Expired
**Error:** `Token expired` or `Invalid token`

**Solution:**
```bash
# Token expires after 7 days
# Login again to get new token

# Or increase expiration in code
# src/routes/auth.js
expiresIn: '30d'  # Change from '7d'
```

---

### Heatmap Issues

#### Heatmap Not Showing
**Error:** "Loading..." or blank heatmap

**Diagnosis:**
```bash
# Check if click events are being recorded
curl "http://localhost:3000/api/stats/heatmap?site_id=test&url=/"

# Should return click coordinates
```

**Solution:**
```bash
# Make sure to click on the page
# Then check again

# Verify clicks are being tracked
# In browser, look for click events in Network tab
```

#### Heatmap Coordinates Wrong
**Error:** Hotspots not aligned with actual clicks

**Cause:** Screen resolution mismatch

**Solution:**
```javascript
// Coordinates are normalized 0-1
// Should match any screen resolution
// No fix needed - this is by design
```

---

### Funnel Issues

#### Funnel Analysis Returns No Data
**Error:** Empty funnel results

**Diagnosis:**
```bash
# Check if funnel exists
curl "http://localhost:3000/api/funnels"

# Check sessions matching all steps
```

**Solution:**
```bash
# Create funnel with real page URLs
curl -X POST http://localhost:3000/api/funnels \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": "test",
    "name": "Test Funnel",
    "steps": ["/", "/page1", "/page2"]
  }'
```

---

### Logs & Monitoring

#### Where are logs?
**Location:**
- Docker: `docker logs <container_name>`
- Local: `~/.pm2/logs/` or `./logs/`
- Files:
  - API: `backend/packages/api/logs/`
  - Dashboard: `frontend/packages/dashboard/logs/`

#### Enable Debug Logging
```bash
# In .env
LOG_LEVEL=debug

# Or in code  
app.log.debug('Message', { data })
```

#### Monitor Memory Usage
```bash
# Docker
docker stats

# Command line
ps aux | grep node
```

---

### Getting Help

1. **Check Documentation**
   - [SETUP.md](SETUP.md) - Installation
   - [API.md](API.md) - API reference
   - [ARCHITECTURE.md](ARCHITECTURE.md) - System design

2. **Check Logs**
   - API logs
   - Database logs
   - Nginx logs

3. **Test Components Individually**
   - Test API: `curl http://localhost:3000/api/health`
   - Test Database: Connection tools
   - Test Dashboard: Browser console

4. **Search Issues**
   - GitHub issues
   - Stack Overflow
   - Documentation

5. **Report Issues**
   - Include: Error message, steps to reproduce, environment
   - Attach: Log files, screenshots
   - Contact: Support team or issue tracker

---

### Quick Fixes

```bash
# Restart everything
docker-compose down
docker-compose up -d

# Clean slate
docker-compose down -v
docker-compose up -d

# View all logs
docker-compose logs -f

# Check specific service
docker logs -f analytics-api
docker logs -f postgres
docker logs -f clickhouse
```
