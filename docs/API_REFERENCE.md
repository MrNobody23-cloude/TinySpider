# TinySpider API Reference

> Complete REST API documentation for TinySpider analytics.

**Base URL**: `http://localhost:3000` (development) or `https://analytics.yourdomain.com` (production)

---

## Authentication

### Register a New User

```
POST /api/auth/register
```

**Request Body:**
```json
{
    "email": "user@example.com",
    "password": "minimum6chars"
}
```

**Response** `201 Created`:
```json
{
    "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**
- `400` — Registration failed (e.g., duplicate email)

---

### Login

```
POST /api/auth/login
```

**Request Body:**
```json
{
    "email": "user@example.com",
    "password": "your-password"
}
```

**Response** `200 OK`:
```json
{
    "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**
- `401` — Invalid credentials

---

## Event Collection

### Collect Event

```
POST /collect
```

> No authentication required. Rate limited to 100 req/min per IP.
> CORS: Accepts all origins.

**Request Body:**
```json
{
    "site_id": "my-site",
    "event_type": "pageview",
    "url": "https://example.com/about",
    "referrer": "https://google.com",
    "click_x": 0.45,
    "click_y": 0.62,
    "session_id": "abc-123-def",
    "bot_hint": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `site_id` | string | ✅ | Site identifier |
| `event_type` | enum | ✅ | `pageview`, `click`, or `custom` |
| `url` | string | ✅ | Page URL (max 2048 chars) |
| `referrer` | string | ❌ | Referring URL |
| `click_x` | number | ❌ | Viewport X position (0-1) |
| `click_y` | number | ❌ | Viewport Y position (0-1) |
| `session_id` | string | ❌ | Client session identifier |
| `bot_hint` | boolean | ❌ | Client-side bot suspicion flag |

**Response** `200 OK`:
```json
{
    "ok": true
}
```

**Server-Side Processing:**
- IP address is hashed with SHA-256 (salted)
- GeoIP lookup performed (if MaxMind database configured)
- Bot detection applied (UA signatures, webdriver, Accept-Language)
- Event queued via BullMQ for async ClickHouse insertion
- Live event published to WebSocket clients

---

## Statistics

> All stats endpoints require `X-API-Key` header.

### Traffic Timeseries

```
GET /api/stats/timeseries
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `site_id` | string | ✅ | Site identifier |
| `from` | ISO 8601 | ✅ | Start datetime |
| `to` | ISO 8601 | ✅ | End datetime |
| `interval` | enum | ❌ | `minute`, `hour` (default), or `day` |
| `include_bots` | boolean | ❌ | Include bot traffic (default: `false`) |

**Response** `200 OK`:
```json
[
    {
        "time": "2026-01-15T10:00:00.000Z",
        "pageviews": 1247,
        "sessions": 892
    },
    {
        "time": "2026-01-15T11:00:00.000Z",
        "pageviews": 1583,
        "sessions": 1120
    }
]
```

---

### Top Referrers

```
GET /api/stats/referrers
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `site_id` | string | ✅ | Site identifier |
| `limit` | number | ❌ | Max results (default: 10) |
| `include_bots` | boolean | ❌ | Include bot traffic |

**Response** `200 OK`:
```json
[
    { "referrer": "https://google.com", "hits": 4521 },
    { "referrer": "https://twitter.com", "hits": 1893 },
    { "referrer": "https://reddit.com", "hits": 722 }
]
```

---

### Top Pages

```
GET /api/stats/pages
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `site_id` | string | ✅ | Site identifier |
| `from` | ISO 8601 | ✅ | Start datetime |
| `to` | ISO 8601 | ✅ | End datetime |
| `limit` | number | ❌ | Max results (default: 10) |
| `include_bots` | boolean | ❌ | Include bot traffic |

**Response** `200 OK`:
```json
[
    { "url": "https://example.com/", "pageviews": 8921 },
    { "url": "https://example.com/pricing", "pageviews": 3247 }
]
```

---

### Live Active Users

```
GET /api/stats/live-count
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `site_id` | string | ✅ | Site identifier |

**Response** `200 OK`:
```json
{
    "active_users": 42
}
```

> Returns unique sessions seen in the last 5 minutes.

---

### Click Heatmap Data

```
GET /api/stats/heatmap
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `site_id` | string | ✅ | Site identifier |
| `url` | string | ✅ | Target page URL |
| `from` | ISO 8601 | ✅ | Start datetime |
| `to` | ISO 8601 | ✅ | End datetime |
| `include_bots` | boolean | ❌ | Include bot traffic |

**Response** `200 OK`:
```json
[
    { "x": 0.32, "y": 0.45, "weight": 156 },
    { "x": 0.68, "y": 0.22, "weight": 89 },
    { "x": 0.50, "y": 0.78, "weight": 43 }
]
```

> Coordinates are viewport-normalized (0-1). Weight = click count at that position.

---

### Page Screenshot

```
GET /api/screenshot
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ | URL to screenshot |

**Response** `200 OK`:
```json
{
    "screenshot": "base64-encoded-png",
    "width": 1280,
    "height": 800
}
```

> Requires Puppeteer installed. Falls back to 1x1 transparent PNG placeholder.

---

## Funnels

### Create Funnel

```
POST /api/funnels
```

**Request Body:**
```json
{
    "site_id": "my-site",
    "name": "Checkout Flow",
    "steps": [
        "https://example.com/",
        "https://example.com/products",
        "https://example.com/cart",
        "https://example.com/checkout",
        "https://example.com/thank-you"
    ]
}
```

**Response** `201 Created`:
```json
{
    "funnel_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Checkout Flow",
    "steps": ["https://example.com/", "https://example.com/products", "..."]
}
```

---

### Funnel Analysis

```
GET /api/funnels/:funnel_id/analysis
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | ISO 8601 | ✅ | Start datetime |
| `to` | ISO 8601 | ✅ | End datetime |
| `include_bots` | boolean | ❌ | Include bot traffic |

**Response** `200 OK`:
```json
[
    {
        "step_url": "https://example.com/",
        "visitors": 5000,
        "converted_to_next": 2100,
        "drop_off_rate": 0.58
    },
    {
        "step_url": "https://example.com/products",
        "visitors": 2100,
        "converted_to_next": 800,
        "drop_off_rate": 0.619
    }
]
```

---

## WebSocket

### Live Event Stream

```
WS /ws/live
```

Connect via WebSocket to receive live events:

```javascript
const ws = new WebSocket('wss://analytics.yourdomain.com/ws/live');

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Live event:', data);
    // { site_id, event_type, lat, lon, is_bot, timestamp }
};
```

**Event Payload:**
```json
{
    "site_id": "my-site",
    "event_type": "pageview",
    "lat": 37.7749,
    "lon": -122.4194,
    "is_bot": false,
    "timestamp": "2026-01-15 14:30:00"
}
```

---

## Health Check

### API Health

```
GET /api/health
```

**Response** `200 OK`:
```json
{
    "ok": true
}
```
