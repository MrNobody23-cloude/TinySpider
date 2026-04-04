# 🕸️ TinySpider — Privacy-First Web Analytics

A high-performance, self-hosted analytics platform. Track pageviews, clicks, conversions, and more — all while keeping user data private and on your own infrastructure.

**< 3KB tracker** · **Zero cookies** · **Real-time dashboard** · **Click heatmaps** · **Funnel analysis** · **Bot detection**

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Minimal Tracker (~3KB)** | Lightweight JavaScript snippet using `sendBeacon()` and `requestIdleCallback` |
| **Real-Time Dashboard** | Live charts, active user counts, and WebSocket event streaming |
| **Click Heatmaps** | Viewport-normalized KDE rendering — works at any screen resolution |
| **Funnel Analysis** | Define URL-based conversion funnels and track drop-off rates |
| **Bot Detection** | Multi-layer filtering: UA signatures, webdriver, honeypot, behavioral |
| **Live Pulse Map** | Geo-located real-time map of active users (MaxMind GeoIP) |
| **Privacy-First** | IP hashing (SHA-256), no cookies, self-hosted, GDPR-ready |
| **Session Tracking** | Client-side session persistence via `sessionStorage` |

---

## 🏗️ Architecture

```
Tracker (3KB) → Nginx → Fastify API → Redis Queue → ClickHouse
                          ↓
                      PostgreSQL (metadata)
                          ↓
                      WebSocket Live Events
                          ↓
                      React Dashboard
```

### Stack

- **Frontend**: React 18, Vite, Recharts, React-Leaflet
- **Backend**: Fastify, Node.js
- **Analytics DB**: ClickHouse (columnar OLAP)
- **Metadata DB**: PostgreSQL (sites, funnels, users)
- **Queue/Cache**: Redis + BullMQ
- **Geo-location**: MaxMind GeoIP2

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+**
- **Docker & Docker Compose** (recommended) — or ClickHouse, PostgreSQL, Redis running locally

### Option A: Docker Compose (Easiest)

```bash
# 1. Clone and install
git clone https://github.com/your-org/tinyspider.git
cd tinyspider
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Start all services
docker-compose up -d

# 4. Build the tracker
npm run tracker:build

# 5. Open the dashboard
open http://localhost:5173
```

### Option B: Manual Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Start databases (ensure they're running)
#    - ClickHouse on 8123
#    - PostgreSQL on 5432
#    - Redis on 6379

# 3. Run database migrations
node packages/api/scripts/migrate.js

# 4. Build the tracker
npm run tracker:build

# 5. Start the API (terminal 1)
cd packages/api && npm start

# 6. Start the dashboard (terminal 2)
cd packages/dashboard && npm run dev

# 7. Start the demo site (terminal 3, optional)
cd packages/demo-site && npm run dev
```

### Option C: Demo Site Only

To quickly see TinySpider tracking in action:

```bash
npm install
npm run tracker:build

# Start API (needs databases running)
cd packages/api && npm start &

# Start demo site
cd packages/demo-site && npm run dev

# Open http://localhost:8080
# Click around — watch events in the live event stream (bottom-right badge)
```

---

## 📊 Demo Site

A fully-functional demo website is included at `packages/demo-site/` to showcase tracking capabilities:

- **5 pages**: Home, Features, Pricing, Blog, Contact
- **Interactive elements**: Buttons, forms, navigation, cards — all generating trackable events
- **Live event stream**: Click the green badge (bottom-right) to see events in real-time
- **Scroll tracking**: Progress bar shows scroll depth tracking
- **Toast notifications**: Visual feedback for every tracked interaction

---

## 📦 Project Structure

```
packages/
├── api/                    # Fastify backend
│   ├── src/
│   │   ├── routes/         # API endpoints (collect, stats, funnels, auth)
│   │   ├── middleware/     # Auth middleware
│   │   ├── workers/        # BullMQ event writer
│   │   ├── lib/            # Cache utilities
│   │   ├── db/             # SQL schemas (ClickHouse + PostgreSQL)
│   │   └── services.js     # DB clients & service layer
│   ├── scripts/
│   │   ├── migrate.js      # Database migration runner
│   │   └── load-test.js    # Performance load testing
│   └── test/               # API tests
├── dashboard/              # React frontend
│   ├── src/
│   │   ├── components/     # Charts, Heatmap, LiveMap, Layout
│   │   ├── hooks/          # SWR data-fetching hooks
│   │   ├── api/            # API client
│   │   └── store/          # Zustand state management
│   └── test/               # Component tests
├── tracker/                # Minimal tracker script
│   ├── src/insight.js      # Main tracker logic
│   ├── dist/               # Built output (insight.min.js)
│   └── scripts/check-size.mjs
└── demo-site/              # Demo website for testing
    ├── server.js            # Node HTTP server
    ├── pages/               # HTML pages (Home, Features, Pricing, Blog, Contact)
    └── public/              # CSS, JS assets
docs/
├── INTEGRATION_GUIDE.md    # Full integration documentation
└── API_REFERENCE.md        # REST API reference
```

---

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3000` |
| `IP_HASH_SALT` | Salt for IP hashing (⚠️ change in production) | dev placeholder |
| `JWT_SECRET` | JWT signing key (⚠️ change in production) | dev placeholder |
| `CLICKHOUSE_URL` | ClickHouse HTTP endpoint | `http://localhost:8123` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `POSTGRES_*` | PostgreSQL connection settings | local defaults |
| `API_CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:5173` |
| `GEOIP_MMDB_PATH` | Path to MaxMind GeoLite2 database (optional) | — |

Generate secure secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📡 Adding the Tracker to Your Website

```html
<script>
    window.InsightConfig = {
        siteId: 'your-site-id',
        endpoint: 'https://analytics.yourdomain.com/collect'
    };
</script>
<script src="https://analytics.yourdomain.com/tracker.js" defer></script>
```

See the full [Integration Guide](docs/INTEGRATION_GUIDE.md) for:
- Custom event tracking
- Form & scroll depth tracking
- Opt-out mechanisms
- GDPR/CCPA compliance

---

## 📚 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/collect` | None | Event collection (rate limited) |
| `GET` | `/api/stats/timeseries` | API Key | Traffic over time |
| `GET` | `/api/stats/referrers` | API Key | Top referrers |
| `GET` | `/api/stats/pages` | API Key | Top pages |
| `GET` | `/api/stats/heatmap` | API Key | Click heatmap data |
| `GET` | `/api/stats/live-count` | API Key | Active user count |
| `POST` | `/api/funnels` | JWT | Create conversion funnel |
| `GET` | `/api/funnels/:id/analysis` | JWT | Funnel drop-off analysis |
| `POST` | `/api/auth/register` | None | User registration |
| `POST` | `/api/auth/login` | None | User login |
| `WS` | `/ws/live` | None | Live event stream |
| `GET` | `/api/health` | None | Health check |

Full documentation: [API Reference](docs/API_REFERENCE.md)

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# API-specific tests
npm run api:test

# Check tracker bundle size
npm run tracker:build
```

---

## 🚀 Production Deployment

### Docker Compose (Recommended)

```bash
# Configure production environment
cp .env.example .env
# Edit .env with strong secrets, real hostnames

# Start with production overrides
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Database Migrations

```bash
# Run all migrations
node packages/api/scripts/migrate.js

# PostgreSQL only
node packages/api/scripts/migrate.js postgres

# ClickHouse only
node packages/api/scripts/migrate.js clickhouse
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong, unique values for `IP_HASH_SALT` and `JWT_SECRET`
- [ ] Configure `API_CORS_ORIGINS` to your actual domain(s)
- [ ] Enable HTTPS (terminate TLS at nginx/load balancer)
- [ ] Set passwords for ClickHouse, PostgreSQL, Redis
- [ ] Download MaxMind GeoIP database for geo-location
- [ ] Configure Redis `maxmemory` and `maxmemory-policy`
- [ ] Set up monitoring and log aggregation

---

## 📈 Performance Notes

- **Tracker size**: < 5KB (minified, no gzip)
- **Event ingestion**: Non-blocking via Redis queue + BullMQ workers
- **Dashboard refresh**: 30-second polling with WebSocket live fallback
- **ClickHouse TTL**: Events auto-purged after 1 year
- **Materialized views**: Pre-computed aggregations for fast dashboard queries
- **Caching**: Redis-backed query caching with configurable TTLs

---

## 🔐 Privacy & Security

- All analytics data stays on **your infrastructure**
- **No cookies** used — `sessionStorage` only
- IP addresses **hashed** with salted SHA-256, never stored in plaintext
- Configurable CORS for API endpoints
- Rate limiting on `/collect` (100 req/min default)
- GDPR-compliant by design (see [Integration Guide § Privacy](docs/INTEGRATION_GUIDE.md#8-data-privacy--compliance))

---

## 📄 License

MIT License — See [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

Built as a hackathon project inspired by:
- [Umami Analytics](https://umami.is/)
- [Plausible Analytics](https://plausible.io/)
- Google Analytics Live Map

---

**Questions?** See the [Integration Guide](docs/INTEGRATION_GUIDE.md) or [API Reference](docs/API_REFERENCE.md).
