# Architecture - System Design Overview

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────┐
│                   Traffic Sources                          │
│  (Websites, Web Apps, Mobile Apps)                        │
└───────────────────┬──────────────────────────────────────┘
                    │ POST /collect
                    │ (2.1KB tracker)
                    │
┌───────────────────▼──────────────────────────────────────┐
│              Nginx Reverse Proxy                          │
│         (Port 80/443 - SSL Termination)                  │
└────┬────────────────┬──────────────────┬────────────────┘
     │                │                  │
  /collect         /api/*            /tracker.js
     │                │                  │
┌────▼────────────────▼──────────────────▼────────────────┐
│            Fastify API Server (Port 3000)               │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Routes:                                          │   │
│  │ • POST /collect  - Event ingest                 │   │
│  │ • GET  /api/* - Statistics queries              │   │
│  │ • WS   /ws-live - Live event stream            │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Middleware:                                      │   │
│  │ • Authentication (JWT)                          │   │
│  │ • Rate Limiting                                 │   │
│  │ • CORS                                          │   │
│  │ • Security Headers (Helmet)                     │   │
│  └──────────────────────────────────────────────────┘   │
└────┬──────┬──────┬──────────────────────────────────────┘
     │      │      │
┌────▼─┐┌───▼──┐┌──▼─────────────────────────────────────┐
│Redis ││Queue ││ BullMQ Event Writer Worker             │
│Cache ││Jobs  ││ • Asynchronous event processing       │
└──────┘└───┬──┘└──┬────────────────────────────────────┘
            │      │
┌───────────▼──────▼────────────────────────────────────┐
│        Data Layer (Persistent Storage)                │
│  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │ ClickHouse       │  │ PostgreSQL                 │ │
│  │ (Time-Series)    │  │ (Metadata)                 │ │
│  │                  │  │                            │ │
│  │ • Raw Events     │  │ • Sites                    │ │
│  │ • Materialized   │  │ • Users                    │ │
│  │   Views          │  │ • Funnels                  │ │
│  │ • TTL: 1 year    │  │ • API Keys                 │ │
│  └──────────────────┘  └────────────────────────────┘ │
└───────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│     React Dashboard (Port 5173)                       │
│  • Overview (traffic charts)                          │
│  • Heatmap (click visualization)                     │
│  • Funnels (conversion analysis)                     │
│  • Live Map (real-time users)                        │
│  • Authentication (JWT)                              │
└──────────────────────────────────────────────────────┘
```

## Component Overview

### 1. Tracker (Frontend)
**Location:** `frontend/packages/tracker/`

**Responsibilities:**
- Minimal JavaScript snippet (~2.1 KB)
- Captures pageviews and clicks
- Detects bot activity
- Non-blocking event transmission
- Session management

**Key Features:**
- SPA support (history.pushState detection)
- Click coordinate normalization (0-1)
- Honeypot bot detection
- Uses `sendBeacon()` for reliability

### 2. API Server (Backend)
**Location:** `backend/packages/api/`

**Responsibilities:**
- Event collection and ingestion
- Statistics queries and aggregation
- User authentication
- Funnel analysis
- Real-time WebSocket events

**Key Components:**
- **Routes:** Event collection, stats queries, auth
- **Services:** Database clients, caching logic
- **Middleware:** Auth, rate limiting, CORS
- **Workers:** Async event processing

### 3. Dashboard (Frontend)
**Location:** `frontend/packages/dashboard/`

**Responsibilities:**
- User interface for analytics
- Real-time chart visualization
- Data query and filtering
- User authentication

**Key Features:**
- React 18 with Vite
- Recharts for visualization
- SWR for data fetching
- WebSocket for live updates

### 4. Demo Site (Frontend)
**Location:** `frontend/packages/demo-site/`

**Responsibilities:**
- Example website for testing
- Demonstrates tracker integration
- Generates test data

## Data Flow

### Event Collection Flow

```
1. User visits website
   ↓
2. Tracker script loads (2.1 KB)
   ↓
3. Tracker captures pageview event
   {site_id, event_type: "pageview", url, ...}
   ↓
4. Asynchronously sends POST /collect
   ↓
5. API validates and enqueues event
   ↓
6. BullMQ worker processes asynchronously
   ↓
7. Event written to ClickHouse
   ↓
8. Materialized views auto-update
   ↓
9. Dashboard reflects changes in real-time
```

### Query Flow

```
1. Dashboard requests stats
   GET /api/stats/timeseries?site_id=...&from=...&to=...
   ↓
2. API checks Redis cache
   ↓
3. Cache hit? → Return cached data
   ↓
4. Cache miss? → Query ClickHouse
   ↓
5. Store result in Redis (60s TTL)
   ↓
6. Return to dashboard
   ↓
7. Dashboard renders chart
```

## Database Schema

### ClickHouse (Time-Series Analytics)

**events table:**
```sql
CREATE TABLE events (
  event_id UUID,
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
  is_bot Bool,
  timestamp DateTime
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (site_id, timestamp)
TTL timestamp + INTERVAL 1 YEAR;
```

**Materialized Views:**
- `events_by_minute` - Pre-aggregated hourly stats
- `top_referrers` - Pre-aggregated referrer data

### PostgreSQL (Metadata)

**sites table:**
- Storage for tracked websites
- API keys
- Configuration

**users table:**
- User accounts
- Authentication credentials
- Permissions

**funnels table:**
- Funnel definitions
- Step URLs
- Conversion tracking

## Caching Strategy

### Redis Cache Layers

1. **Statistics Cache** (60 seconds)
   - Timeseries aggregations
   - Referrer statistics
   - Page statistics

2. **Query Result Cache** (300 seconds)
   - API responses
   - Complex queries

3. **Session Cache** (24 hours)
   - User authentication tokens
   - Session IDs

4. **Job Queue** (via BullMQ)
   - Event processing tasks
   - Async operations

## Security Architecture

### Authentication
- JWT tokens (~7 days expiration)
- API keys for service-to-service
- Bcrypt password hashing

### Encryption
- IP address hashing (SHA-256 + salt)
- HTTPS recommended for production
- Helmet security headers

### Rate Limiting
- 100 requests/min on `/collect`
- Standard limits on API endpoints
- Per-IP tracking

### Data Privacy
- No plaintext IP storage
- Customizable data retention (TTL)
- GDPR-compliant deletion

## Scalability Considerations

### Horizontal Scaling

**Frontend:**
- Dashboard: Stateless, scales horizontally via load balancer
- Tracker: Client-side, no scaling needed

**Backend:**
- API: Stateless, multiple instances behind load balancer
- Workers: Horizontal scaling via job queue

**Databases:**
- ClickHouse: Cluster mode for large deployments
- PostgreSQL: Replication/sharding
- Redis: Sentinel mode for HA

### Performance Optimizations

**Tracker:**
- Minimal size: 2.1 KB gzipped
- Lazy loading with `requestIdleCallback`
- Batch event transmission

**API:**
- Redis caching layer
- Materialized views in ClickHouse
- Index optimization

**Dashboard:**
- SWR data fetching
- Virtual scrolling for large lists
- Incremental loading

## Deployment Options

### Development
- Local Node.js servers
- Docker Compose for databases

### Staging
- Single Docker container per service
- Local persistent volumes

### Production
- Kubernetes clusters or VPS
- Managed database services
- CDN for static assets
- Nginx reverse proxy

## Integration Points

### Third-Party Services (Optional)
- MaxMind GeoIP API
- SendGrid for emails
- DataDog for monitoring
- GitHub for CI/CD

### Data Exports
- ClickHouse: Multiple format support (CSV, JSON, Parquet)
- PostgreSQL: Standard SQL dumps
- API: RESTful endpoints

## Technology Decisions

### Why ClickHouse?
- Optimized for OLAP (analytical queries)
- Excellent compression
- Fast aggregation queries
- TTL for automatic data cleanup
- Materialized views for pre-aggregation

### Why FastAPI isn't used?
- Node.js for JavaScript ecosystem consistency
- Fastify: High performance, minimal overhead
- Async-first architecture
- Built-in schema validation

### Why React for Dashboard?
- Component reusability
- Rich ecosystem (Recharts, Leaflet)
- Development speed
- SPA capabilities

## Monitoring & Observability

### Logging
- Pino logger (structured JSON logging)
- Log levels: debug, info, warn, error

### Metrics
- Request count
- Response time
- Error rate
- Queue depth

### Health Checks
- `/api/health` endpoint
- Database connectivity
- Service availability

## Future Enhancements

1. **Advanced Analytics**
   - A/B testing framework
   - Custom events
   - Cohort analysis

2. **Real-time Features**
   - Alert system
   - Anomaly detection
   - Notifications

3. **Enterprise Features**
   - SAML/SSO
   - Multi-tenancy
   - Advanced permissions
   - Audit logging

4. **Performance**
   - GraphQL API
   - Event batching improvements
   - Edge computing support
