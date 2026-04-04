# Backend

Server-side APIs and data processing for the Insight Analytics platform.

## Overview

The backend provides:
- **API Server** - RESTful API for data collection, retrieval, and management
- **Event Processing** - Async event handling with BullMQ queue
- **Databases** - Data storage across ClickHouse (analytics), PostgreSQL (metadata), Redis (cache)
- **Authentication** - JWT-based API key authentication
- **Live Updates** - WebSocket support for real-time dashboard updates

## Packages

### [`packages/api`](packages/api)

Main analytics API server built with Fastify.

**Features:**
- Event collection endpoint `/collect`
- Stats retrieval (`/api/stats/*`)
- Funnel analysis (`/api/funnels/*`)
- Heatmap data (`/api/heatmap`)
- WebSocket live updates
- JWT authentication
- Rate limiting
- CORS support

**Stack:**
- Fastify (Node.js framework)
- ClickHouse (time-series OLAP database)
- PostgreSQL (relational database)
- Redis (caching & queue)
- BullMQ (async job processing)

**Getting Started:**
```bash
# From root
npm run dev:backend

# Or from api folder
cd backend/packages/api
npm install
npm run dev
```

**Build & Run:**
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

**API Port:** 3000 (default)

---

## Structure

```
backend/packages/api/
├── src/
│   ├── app.js              # Fastify app setup
│   ├── index.js            # Server entry point
│   ├── services.js         # Service initialization
│   ├── middleware/         # Request middleware
│   │   └── auth.js         # JWT authentication
│   ├── routes/             # API endpoints
│   │   ├── api-health.js   # Health check
│   │   ├── auth.js         # Authentication
│   │   ├── collect.js      # Event collection
│   │   ├── funnels.js      # Funnel analysis
│   │   ├── stats.js        # Statistics
│   │   └── ws-live.js      # WebSocket
│   ├── workers/            # Background jobs
│   │   └── event-writer.js # Event processing
│   ├── lib/
│   │   ├── cache.js        # Redis caching
│   │   └── bot-signatures.js # Bot detection
│   ├── db/
│   │   ├── clickhouse-schema.sql
│   │   └── postgres-schema.sql
│   └── config/             # Configuration
├── package.json
├── Dockerfile
└── test/
```

---

## Development

### Prerequisites

- Node.js 18+ (see [SETUP.md](../../docs/SETUP.md))
- Docker & Docker Compose (for running databases)
- `.env` file with required variables

### Setup

1. **Install dependencies:**
   ```bash
   npm install:all
   ```

2. **Configure environment:**
   ```bash
   # Copy template
   cp .env.example .env
   
   # Edit with your settings
   nano .env
   ```

3. **Start databases:**
   ```bash
   docker-compose up -d postgres clickhouse redis
   
   # Wait for databases to be ready
   sleep 10
   ```

4. **Initialize databases:**
   ```bash
   # Applies SQL schema
   npm run db:init
   ```

5. **Start API:**
   ```bash
   npm run dev:backend
   ```

### Environment Variables

Required `.env` file:

```env
# Server
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# JWT
JWT_SECRET=your-secret-key-here-change-in-production

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=insightdb

# ClickHouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS
API_CORS_ORIGINS=http://localhost,http://localhost:5173

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

See [SETUP.md](../../docs/SETUP.md#environment-configuration) for details.

---

## Available Scripts

From root:
```bash
npm run dev:backend       # Start API in dev mode with hot reload
npm run build:backend     # Build for production
npm run start:backend     # Start built API
npm run test:api          # Run API tests
npm run db:init           # Initialize databases
npm run db:reset          # Reset databases (caution!)
```

From `backend/packages/api`:
```bash
npm run dev              # Development server
npm run build            # Production build
npm run start            # Start production server
npm run test             # Run tests
npm run seed:demo        # Seed demo data
npm run load-test        # Load testing
```

---

## API Endpoints

### Health Check
```bash
GET /api/health
```

Returns server and database status.

### Event Collection
```bash
POST /collect
Content-Type: application/json

{
  "site_id": "my-site",
  "event_type": "pageview",
  "url": "/page",
  "referrer": "google.com",
  "session_id": "....",
  "user_agent": "Mozilla/5.0..."
}
```

Returns: `{ "ok": true }`

### Statistics
```bash
GET /api/stats/overview?site_id=my-site&from=2024-01-01&to=2024-12-31
GET /api/stats/timeseries?site_id=my-site&granularity=day
GET /api/stats/referrers?site_id=my-site
```

### Funnels
```bash
GET /api/funnels?site_id=my-site
GET /api/funnels/my-funnel?site_id=my-site
POST /api/funnels  # Create funnel
PUT /api/funnels/my-funnel  # Update
DELETE /api/funnels/my-funnel  # Delete
```

### Heatmap
```bash
GET /api/heatmap?site_id=my-site&url=/page
```

Returns: Array of click coordinates

### WebSocket
```javascript
ws://localhost:3000/live?site_id=my-site
```

Real-time event stream for dashboard.

See [API.md](../../docs/API.md) for complete reference.

---

## Database Schema

### PostgreSQL Schema
```sql
-- sites, users, api_keys, funnels...
\i db/postgres-schema.sql
```

### ClickHouse Schema
```sql
-- events, materialized views...
-- Run with clickhouse-client
source db/clickhouse-schema.sql
```

See [DATABASE.md](../../docs/DATABASE.md) for details.

---

## Event Processing

Events are processed asynchronously using BullMQ:

1. Event arrives at `/collect`
2. Queued in Redis
3. Worker processes: bot detection, de-duplication, enrichment
4. Written to ClickHouse
5. Cache invalidated
6. WebSocket broadcast (if live subscribers)

**Configuration:**
- Job concurrency: 50
- Retry attempts: 3
- Timeout: 60 seconds

See [workers/event-writer.js](packages/api/src/workers/event-writer.js)

---

## Middleware

### Authentication
```javascript
// routes/stats.js
app.get('/api/stats/:stat', {
  onRequest: app.authenticate,
  handler: statsHandler
});

// Validates X-API-Key header or Authorization bearer token
```

### Rate Limiting
```
/collect - 100 requests per 60 seconds
/api/* - 1000 requests per 60 seconds
```

Automatic 429 response if exceeded.

### CORS
```javascript
app.register(cors, {
  origin: process.env.API_CORS_ORIGINS?.split(','),
  credentials: true
});
```

Configure in `.env`:
```env
API_CORS_ORIGINS=http://localhost,https://example.com
```

---

## Performance

### Caching Strategy
- **Redis TTL:** 60 seconds
- **Cache Keys:** `stats:{site_id}:{metric}:{from}:{to}`
- **Invalidation:** On new events, manual invalidation

### Database Optimization
- ClickHouse: Materialized views, TTL, MergeTree engine
- PostgreSQL: Indexes on site_id, created_at
- Redis: Memory limit with eviction policy

### Monitoring
```bash
# Check API health
curl http://localhost:3000/api/health

# Monitor memory
docker stats analytics-api

# Database queries
# ClickHouse: system.query_log
# PostgreSQL: pg_stat_statements
```

---

## Testing

### Run Tests
```bash
npm run test:api
```

**Test files:**
- `test/collect.test.js` - Event collection tests
- `test/phase2.test.js` - API integration tests

### Test Database
Tests use separate PostgreSQL and ClickHouse instances.

### Load Testing
```bash
npm run load-test

# Or manually
node scripts/load-test.js
```

### Seed Demo Data
```bash
npm run seed:demo
```

Adds sample events for testing dashboard.

---

## Deployment

### Docker

**Build:**
```bash
docker-compose build api
```

**Run:**
```bash
docker-compose up -d api
```

**Logs:**
```bash
docker logs -f analytics-api
```

### Environment Variables

In production, use secure methods:
- `.env` file (when possible)
- System environment variables
- Docker secrets
- AWS Systems Manager Parameter Store
- HashiCorp Vault

**Never:**
- Hardcode secrets
- Commit `.env` to git
- Print secrets in logs

See [DEPLOYMENT.md](../../docs/DEPLOYMENT.md) and [SECURITY.md](../../docs/SECURITY.md).

---

## Troubleshooting

### API Won't Start
1. Check logs: `npm run dev:backend`
2. Verify `.env` has JWT_SECRET
3. Check database connections
4. See [TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md#api-server-issues)

### Events Not Being Recorded
1. Verify `/collect` endpoint is accessible
2. Check CORS configuration
3. Look for errors in API logs
4. See [TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md#event-collection-issues)

### Database Errors
1. Verify databases are running: `docker ps`
2. Check connection credentials in `.env`
3. See database logs: `docker logs postgres`
4. See [TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md#database-connection-issues)

---

## Architecture

For system design, data flows, and security architecture, see:
- [ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
- [DATABASE.md](../../docs/DATABASE.md)
- [SECURITY.md](../../docs/SECURITY.md)

---

## Contributing

When adding API features:

1. Create feature branch
2. Add route in `src/routes/`
3. Add tests in `test/`
4. Update [API.md](../../docs/API.md)
5. Run tests: `npm test`
6. Submit PR with description

**Code Style:**
- Use Fastify conventions
- Add JSDoc comments
- Error handling for all routes
- CORS headers where needed

---

## License

[MIT](../../LICENSE)
