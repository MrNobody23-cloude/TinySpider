# TinySpider Integration Guide

> Complete guide to integrating TinySpider analytics with any live website.

---

## Table of Contents

1. [Quick Installation](#1-quick-installation)
2. [Configuration Guide](#2-configuration-guide)
3. [Event Tracking](#3-event-tracking)
4. [Authentication & Security](#4-authentication--security)
5. [Database Setup](#5-database-setup)
6. [Deployment Instructions](#6-deployment-instructions)
7. [CDN & Performance](#7-cdn--performance)
8. [Data Privacy & Compliance](#8-data-privacy--compliance)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Quick Installation

### Step 1: Add the Tracker Script

Add the following snippet to every page you want to track, just before the closing `</body>` tag:

```html
<script>
    window.InsightConfig = {
        siteId: 'YOUR_SITE_ID',
        endpoint: 'https://analytics.yourdomain.com/collect'
    };
</script>
<script src="https://analytics.yourdomain.com/tracker.js" defer></script>
```

### Step 2: Verify Installation

1. Open your website in a browser
2. Open the browser DevTools → Network tab
3. Look for requests to `/collect` — you should see POST requests on every page load and click
4. Check the TinySpider dashboard at `https://analytics.yourdomain.com` to see data flowing in

### Configuration Options

| Parameter   | Required | Description                                     |
| ----------- | -------- | ----------------------------------------------- |
| `siteId`    | ✅       | Unique identifier for your website              |
| `endpoint`  | ✅       | Full URL to the TinySpider `/collect` endpoint   |

### Script Attributes

```html
<!-- Load asynchronously (recommended) -->
<script src="https://analytics.yourdomain.com/tracker.js" defer></script>

<!-- Or inline the minified tracker for zero external requests -->
<script>
    // Paste contents of tracker/dist/insight.min.js here
</script>
```

---

## 2. Configuration Guide

### Environment Variables

Create a `.env` file in the project root. See `.env.example` for all available options:

```env
# ─── Runtime ─────────────────────────────────────────
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# ─── Security (REQUIRED — use strong random values) ──
IP_HASH_SALT=<64-char-random-hex>
JWT_SECRET=<64-char-random-hex>
BCRYPT_ROUNDS=12

# ─── API Configuration ──────────────────────────────
API_CORS_ORIGINS=https://yourdomain.com,https://dashboard.yourdomain.com

# ─── ClickHouse ──────────────────────────────────────
CLICKHOUSE_URL=http://clickhouse:8123
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=your-clickhouse-password
CLICKHOUSE_DATABASE=analytics

# ─── Redis ───────────────────────────────────────────
REDIS_URL=redis://:password@redis:6379

# ─── PostgreSQL ──────────────────────────────────────
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=insightdb
POSTGRES_USER=insight_app
POSTGRES_PASSWORD=strong-password-here

# ─── GeoIP (Optional) ───────────────────────────────
GEOIP_MMDB_PATH=/app/data/GeoLite2-City.mmdb

# ─── Tracker ─────────────────────────────────────────
TRACKER_ENDPOINT=https://analytics.yourdomain.com/collect
```

### Generating Secure Secrets

```bash
# Generate a 64-character hex string for IP_HASH_SALT and JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### CORS Configuration

Set `API_CORS_ORIGINS` to a comma-separated list of allowed origins:

```env
# Allow specific domains
API_CORS_ORIGINS=https://mysite.com,https://www.mysite.com

# The /collect endpoint accepts all origins by default (tracker needs this)
# The /api/* endpoints are restricted to the configured origins
```

---

## 3. Event Tracking

### Automatic Tracking

The tracker script automatically captures:

| Event Type | Trigger | Data Collected |
|-----------|---------|----------------|
| `pageview` | Initial page load | URL, referrer, session ID |
| `pageview` | SPA route change (`pushState`, `replaceState`, `popstate`) | URL, session ID |
| `click` | Any click event | Click coordinates (viewport-normalized 0-1) |

### Custom Event Tracking

Send custom events by posting directly to the `/collect` endpoint:

```javascript
// Method 1: Using sendBeacon (non-blocking, preferred)
navigator.sendBeacon('https://analytics.yourdomain.com/collect', JSON.stringify({
    site_id: 'your-site-id',
    event_type: 'custom',
    url: window.location.href,
    session_id: sessionStorage.getItem('__insight_session_id__') || ''
}));

// Method 2: Using fetch
fetch('https://analytics.yourdomain.com/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        site_id: 'your-site-id',
        event_type: 'custom',
        url: window.location.href,
        session_id: sessionStorage.getItem('__insight_session_id__') || ''
    }),
    keepalive: true,
    credentials: 'omit'
});
```

### Form Submission Tracking

```javascript
document.getElementById('signup-form').addEventListener('submit', function(e) {
    navigator.sendBeacon('/collect', JSON.stringify({
        site_id: 'your-site-id',
        event_type: 'custom',
        url: window.location.href + '#form_submit',
        session_id: sessionStorage.getItem('__insight_session_id__') || ''
    }));
});
```

### Scroll Depth Tracking

```javascript
let maxScroll = 0;
window.addEventListener('scroll', function() {
    const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
    );
    if (scrollPercent > maxScroll) {
        maxScroll = scrollPercent;
    }
}, { passive: true });

// Send on page unload
window.addEventListener('beforeunload', function() {
    navigator.sendBeacon('/collect', JSON.stringify({
        site_id: 'your-site-id',
        event_type: 'custom',
        url: window.location.href + '#scroll_depth_' + maxScroll,
        session_id: sessionStorage.getItem('__insight_session_id__') || ''
    }));
});
```

### Event Payload Schema

```json
{
    "site_id": "string (required)",
    "event_type": "pageview | click | custom (required)",
    "url": "string (required, max 2048 chars)",
    "referrer": "string (optional, max 2048 chars)",
    "click_x": "number (optional, 0-1 viewport percentage)",
    "click_y": "number (optional, 0-1 viewport percentage)",
    "session_id": "string (optional, max 255 chars)",
    "bot_hint": "boolean (optional, client-side bot detection)"
}
```

---

## 4. Authentication & Security

### User Registration

```bash
curl -X POST https://analytics.yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@yourdomain.com", "password": "strong-password"}'

# Response: { "token": "eyJhbGciOiJIUzI1NiIs..." }
```

### Login

```bash
curl -X POST https://analytics.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@yourdomain.com", "password": "strong-password"}'

# Response: { "token": "eyJhbGciOiJIUzI1NiIs..." }
```

### Using the JWT Token

Include the token in the `Authorization` header for all `/api/*` requests:

```bash
curl https://analytics.yourdomain.com/api/stats/timeseries \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -G -d "site_id=your-site&from=2026-01-01&to=2026-01-31"
```

### Site API Keys

Stats endpoints require an `X-API-Key` header matching the site's registered API key:

```bash
curl https://analytics.yourdomain.com/api/stats/referrers \
  -H "X-API-Key: your-site-api-key" \
  -G -d "site_id=your-site&limit=10"
```

### Rate Limiting

| Endpoint    | Limit              |
| ----------- | ------------------ |
| `/collect`  | 100 req/min per IP |
| `/api/*`    | Default (no global limit) |
| `/api/health` | 1000 req/min     |

### Security Checklist

- [ ] Use strong, unique values for `IP_HASH_SALT` and `JWT_SECRET`
- [ ] Set `NODE_ENV=production` in production
- [ ] Configure `API_CORS_ORIGINS` to only allow your domains
- [ ] Use HTTPS for all traffic (terminate TLS at nginx/load balancer)
- [ ] Set strong passwords for ClickHouse, PostgreSQL, and Redis
- [ ] Rotate JWT secrets periodically
- [ ] Enable Redis authentication (`requirepass`)
- [ ] Keep dependencies updated

---

## 5. Database Setup

### PostgreSQL Setup

```sql
-- 1. Create the database
CREATE DATABASE insightdb;

-- 2. Create a dedicated user
CREATE USER insight_app WITH PASSWORD 'strong-password-here';
GRANT ALL PRIVILEGES ON DATABASE insightdb TO insight_app;

-- 3. Run the schema migration
\c insightdb
\i packages/api/src/db/postgres-schema.sql
```

Or run the migration script:

```bash
node packages/api/scripts/migrate.js
```

### ClickHouse Setup

```bash
# Connect to ClickHouse
clickhouse-client

# Run the schema
cat packages/api/src/db/clickhouse-schema.sql | clickhouse-client --multiquery
```

The schema creates:
- **`events`** table: Main event storage with MergeTree engine, partitioned by month
- **`events_by_minute`**: Materialized view for pre-computed time-series aggregations
- **`top_referrers`**: Materialized view for referrer analytics

### Redis Setup

Redis is used for:
- **Event queue**: BullMQ-powered background job processing
- **Cache**: Query result caching (TTL-based)
- **Pub/Sub**: Live event streaming to WebSocket clients

No schema setup needed. Recommended settings for production:

```conf
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
appendonly yes
requirepass your-redis-password
```

---

## 6. Deployment Instructions

### Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/tinyspider.git
cd tinyspider

# 2. Configure environment
cp .env.example .env
# Edit .env with your production values

# 3. Build and start all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 4. Verify all services are healthy
docker-compose ps
```

### Manual Deployment

```bash
# 1. Install Node.js 18+
# 2. Install and configure ClickHouse, PostgreSQL, Redis

# 3. Install dependencies
npm install

# 4. Build the tracker
npm run tracker:build

# 5. Build the dashboard
cd packages/dashboard && npm run build

# 6. Run database migrations
node packages/api/scripts/migrate.js

# 7. Start the API
cd packages/api && NODE_ENV=production node src/index.js

# 8. Serve dashboard build with nginx/caddy
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name analytics.yourdomain.com;

    ssl_certificate     /etc/ssl/certs/analytics.crt;
    ssl_certificate_key /etc/ssl/private/analytics.key;

    # Tracker script (cacheable)
    location /tracker.js {
        alias /app/packages/tracker/dist/insight.min.js;
        add_header Cache-Control "public, max-age=86400";
        add_header Content-Type "application/javascript";
    }

    # Event collection
    location /collect {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket
    location /ws/live {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Dashboard
    location / {
        root /app/packages/dashboard/dist;
        try_files $uri /index.html;
    }
}
```

---

## 7. CDN & Performance

### Serving the Tracker via CDN

For optimal global performance, serve `tracker.js` through a CDN:

```html
<!-- Via CDN (replace with your CDN URL) -->
<script src="https://cdn.yourdomain.com/tracker/v1/insight.min.js" defer></script>
```

### CDN Configuration

Set these headers on the tracker script:

```
Cache-Control: public, max-age=86400, s-maxage=604800
Content-Type: application/javascript
```

### Self-Hosting the Tracker

Build the tracker and host the output file:

```bash
# Build minified tracker
npm run tracker:build

# Output: packages/tracker/dist/insight.min.js (~3KB)
# Upload this file to your CDN or static hosting
```

### Performance Best Practices

1. **Use `defer`** when loading the tracker script to avoid blocking page rendering
2. **The tracker uses `requestIdleCallback`** — events are sent during browser idle time
3. **`navigator.sendBeacon()`** is used primarily — non-blocking, survives page unload
4. **Queue events server-side** — the API returns `200` immediately and processes asynchronously
5. **Enable Redis caching** — dashboard queries are cached with configurable TTLs

---

## 8. Data Privacy & Compliance

### GDPR Compliance

TinySpider is designed to be privacy-first:

| Feature | Implementation |
|---------|----------------|
| No cookies | Uses `sessionStorage` for session ID (cleared when tab closes) |
| IP hashing | All IPs are SHA-256 hashed with a secret salt before storage |
| No PII | No names, emails, or personal identifiers collected |
| Self-hosted | Data never leaves your infrastructure |
| Data retention | ClickHouse TTL auto-deletes events after 1 year |

### Opt-Out Mechanism

Add an opt-out mechanism for your users:

```javascript
// Check opt-out before loading tracker
if (localStorage.getItem('analytics_opt_out') !== 'true') {
    window.InsightConfig = {
        siteId: 'your-site-id',
        endpoint: 'https://analytics.yourdomain.com/collect'
    };
    var s = document.createElement('script');
    s.src = 'https://analytics.yourdomain.com/tracker.js';
    s.defer = true;
    document.head.appendChild(s);
}
```

```html
<!-- Opt-out toggle for users -->
<button onclick="
    localStorage.setItem('analytics_opt_out', 'true');
    alert('Analytics tracking disabled.');
    location.reload();
">
    Disable Analytics
</button>
```

### Cookie Banner

Since TinySpider doesn't use cookies, you may not need a cookie banner in many jurisdictions. However, consult local regulations. If needed:

```html
<div id="consent-banner" style="display:none;">
    <p>We use privacy-friendly analytics (no cookies, no personal data).</p>
    <button onclick="localStorage.setItem('analytics_consent','true'); document.getElementById('consent-banner').style.display='none';">
        OK
    </button>
</div>
```

### CCPA Compliance

- Provide a "Do Not Sell My Personal Information" link
- Honor `GPC` (Global Privacy Control) headers:

```javascript
// Respect Global Privacy Control
if (navigator.globalPrivacyControl) {
    console.log('GPC detected — analytics disabled');
} else {
    // Load tracker
}
```

### Data Deletion

To delete all data for a specific site:

```sql
-- ClickHouse
ALTER TABLE events DELETE WHERE site_id = 'site-to-delete';

-- PostgreSQL
DELETE FROM funnels WHERE site_id = (SELECT id FROM sites WHERE domain = 'example.com');
DELETE FROM sites WHERE domain = 'example.com';
```

---

## 9. Troubleshooting

### Events Not Appearing in Dashboard

1. **Check browser console** for errors when loading `tracker.js`
2. **Verify the endpoint** is reachable: `curl -X POST https://analytics.yourdomain.com/collect -H "Content-Type: application/json" -d '{"site_id":"test","event_type":"pageview","url":"http://test.com"}'`
3. **Check CORS**: Ensure your site's origin is in `API_CORS_ORIGINS` (for `/api/*` routes — `/collect` is open by default)
4. **Check the API logs**: `docker logs insight-api`

### Tracker Script Not Loading

- Ensure the script URL is correct and accessible
- Check for Content Security Policy (CSP) headers blocking the script
- Add your analytics domain to your CSP: `script-src 'self' analytics.yourdomain.com`

### High Memory Usage

- Set Redis `maxmemory` with `allkeys-lru` eviction policy
- Check ClickHouse materialized view lag: `SELECT * FROM system.mutations`
- Ensure BullMQ completed jobs are being removed (`removeOnComplete: true`)

### Database Connection Errors

```bash
# Test ClickHouse
curl http://localhost:8123/ping

# Test PostgreSQL
pg_isready -h localhost -p 5432 -U postgres

# Test Redis
redis-cli ping
```

### Bot Detection False Positives

If legitimate users are being flagged as bots:
- Check if `navigator.webdriver` is set (some browser extensions set this)
- Verify `Accept-Language` header is present
- Review the honeypot mechanism timing

### Common Error Codes

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Missing X-API-Key` | Stats endpoint called without API key | Add `X-API-Key` header |
| `403 Invalid API key` | Wrong API key for the site | Verify site_id + api_key match |
| `400 Validation error` | Malformed event payload | Check required fields: site_id, event_type, url |
| `429 Too Many Requests` | Rate limit exceeded on `/collect` | Reduce request frequency or increase limit |
