# API Reference - Complete Endpoint Documentation

## Base URL

```
http://your-domain/api
```

## Authentication

### Public Endpoints (No Auth Required)
- `POST /collect` - Event collection

### Protected Endpoints (X-API-Key Required)

Include header:
```
X-API-Key: your-api-key-here
```

## Event Collection

### POST /collect

Collect pageview, click, or custom events (no auth required).

**Request:**
```bash
curl -X POST http://localhost:3000/collect \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": "my-site",
    "event_type": "pageview",
    "url": "https://example.com/page",
    "referrer": "https://google.com"
  }'
```

**Request Body:**
```json
{
  "site_id": "string (required)",
  "event_type": "pageview|click|custom (required)",
  "url": "string (required, max 2048)",
  "referrer": "string (optional, max 2048)",
  "click_x": "number (0-1, optional)",
  "click_y": "number (0-1, optional)",
  "session_id": "string (optional)",
  "bot_hint": "boolean (optional)"
}
```

**Response:**
```json
{
  "ok": true
}
```

**Status Codes:**
- `200` - Event accepted
- `400` - Invalid input
- `429` - Rate limit exceeded

---

## Statistics Endpoints

All stats endpoints require `X-API-Key` header and accept these parameters:
- `from` - Start date (ISO 8601 format)
- `to` - End date (ISO 8601 format)
- `include_bots` - Include bot traffic (default: false)

### GET /api/stats/timeseries

Get traffic over time in buckets.

**Request:**
```bash
curl "http://localhost:3000/api/stats/timeseries?site_id=my-site&from=2024-01-01&to=2024-01-31&interval=day"
```

**Query Parameters:**
```
site_id: string (required)
from: ISO8601 date (required)
to: ISO8601 date (required)
interval: minute|hour|day (default: hour)
include_bots: boolean (default: false)
```

**Response:**
```json
[
  {
    "time": "2024-01-01T00:00:00.000Z",
    "pageviews": 1234,
    "sessions": 56
  },
  ...
]
```

---

### GET /api/stats/referrers

Get top traffic sources (referrers).

**Request:**
```bash
curl "http://localhost:3000/api/stats/referrers?site_id=my-site&limit=10"
```

**Query Parameters:**
```
site_id: string (required)
limit: number (default: 10)
include_bots: boolean (default: false)
```

**Response:**
```json
[
  {
    "referrer": "google.com",
    "hits": 1234
  },
  {
    "referrer": "github.com",
    "hits": 567
  },
  ...
]
```

---

### GET /api/stats/pages

Get most visited pages.

**Request:**
```bash
curl "http://localhost:3000/api/stats/pages?site_id=my-site&from=2024-01-01&to=2024-01-31&limit=10"
```

**Query Parameters:**
```
site_id: string (required)
from: ISO8601 date (required)
to: ISO8601 date (required)
limit: number (default: 10)
include_bots: boolean (default: false)
```

**Response:**
```json
[
  {
    "url": "/",
    "pageviews": 5678
  },
  {
    "url": "/pricing",
    "pageviews": 1234
  },
  ...
]
```

---

### GET /api/stats/heatmap

Get click coordinates for heatmap visualization.

**Request:**
```bash
curl "http://localhost:3000/api/stats/heatmap?site_id=my-site&url=/"
```

**Query Parameters:**
```
site_id: string (required)
url: string (required) - Page URL to get heatmap for
include_bots: boolean (default: false)
```

**Response:**
```json
[
  {
    "click_x": 0.45,
    "click_y": 0.82,
    "weight": 23
  },
  ...
]
```

Click coordinates are normalized (0-1) representing viewport percentages.

---

### GET /api/stats/active-users

Get currently active users.

**Request:**
```bash
curl "http://localhost:3000/api/stats/active-users?site_id=my-site"
```

**Query Parameters:**
```
site_id: string (required)
```

**Response:**
```json
{
  "active_users": 42
}
```

Active users are those with activity in the last 5 minutes.

---

## Funnel Endpoints

### POST /api/funnels

Create a new conversion funnel.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/funnels" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": "my-site",
    "name": "Checkout Flow",
    "steps": ["/", "/products", "/checkout", "/success"]
  }'
```

**Request Body:**
```json
{
  "site_id": "string (required)",
  "name": "string (required)",
  "steps": ["string (required, array)"]
}
```

**Response:**
```json
{
  "funnel_id": "uuid",
  "name": "Checkout Flow",
  "steps": ["/", "/products", "/checkout", "/success"]
}
```

---

### GET /api/funnels/:funnel_id/analysis

Analyze funnel drop-off rates.

**Request:**
```bash
curl "http://localhost:3000/api/funnels/uuid/analysis?from=2024-01-01&to=2024-01-31"
```

**Query Parameters:**
```
funnel_id: string (required, in URL)
from: ISO8601 date (required)
to: ISO8601 date (required)
include_bots: boolean (default: false)
```

**Response:**
```json
{
  "funnel_id": "uuid",
  "steps": [
    {
      "step": 0,
      "url": "/",
      "visitors": 1000,
      "drop_off_rate": 0
    },
    {
      "step": 1,
      "url": "/products",
      "visitors": 800,
      "drop_off_rate": 0.2
    },
    {
      "step": 2,
      "url": "/checkout",
      "visitors": 600,
      "drop_off_rate": 0.25
    },
    {
      "step": 3,
      "url": "/success",
      "visitors": 500,
      "drop_off_rate": 0.167
    }
  ]
}
```

Drop-off rate = (step_n_visitors - step_n+1_visitors) / step_n_visitors

---

## Authentication Endpoints

### POST /api/auth/register

Register a new user account.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure-password"
  }'
```

**Request Body:**
```json
{
  "email": "string (required, email format)",
  "password": "string (required, min 6 chars)"
}
```

**Response:**
```json
{
  "token": "jwt-token-here"
}
```

---

### POST /api/auth/login

Login to user account.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure-password"
  }'
```

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response:**
```json
{
  "token": "jwt-token-here"
}
```

---

## Health Check

### GET /api/health

Check API health status.

**Request:**
```bash
curl "http://localhost:3000/api/health"
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## WebSocket: Live Events

### WS /ws-live

Real-time event streaming via WebSocket.

**Connect:**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws-live');

ws.onopen = () => {
  console.log('Connected to live events');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Live event:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from live events');
};
```

**Event Format:**
```json
{
  "site_id": "my-site",
  "event_type": "pageview|click",
  "lat": 37.7749,
  "lon": -122.4194,
  "is_bot": false,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Rate Limiting

- `POST /collect`: 100 requests per minute per IP
- Other endpoints: Standard rate limits per API key

**Response when rate limit exceeded:**
```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "error": "Invalid input",
  "message": "Detailed error message"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## Pagination

Endpoints that return lists support pagination:

**Query Parameters:**
```
page: number (default: 1)
limit: number (default: 10, max: 100)
```

**Response Headers:**
```
X-Total-Count: 1000
X-Page: 1
X-Limit: 10
```

---

## Filtering & Sorting

Most endpoints support filtering:

```
?sort_by=pageviews&order=desc
?from=2024-01-01&to=2024-12-31
?include_bots=false
```

---

## SDK Examples

### cURL

Already shown in examples above.

### JavaScript/Node.js

```javascript
const API_KEY = 'your-api-key';
const BASE_URL = 'http://localhost:3000';

async function getStats(siteId) {
  const response = await fetch(
    `${BASE_URL}/api/stats/timeseries?site_id=${siteId}&from=2024-01-01&to=2024-12-31`,
    {
      headers: { 'X-API-Key': API_KEY }
    }
  );
  return response.json();
}

getStats('my-site').then(console.log);
```

### Python

```python
import requests

API_KEY = 'your-api-key'
BASE_URL = 'http://localhost:3000'

def get_stats(site_id):
    headers = {'X-API-Key': API_KEY}
    url = f'{BASE_URL}/api/stats/timeseries'
    params = {
        'site_id': site_id,
        'from': '2024-01-01',
        'to': '2024-12-31'
    }
    response = requests.get(url, headers=headers, params=params)
    return response.json()

print(get_stats('my-site'))
```

---

## Rate Limits & Quotas

| Endpoint | Rate Limit | Quota |
|----------|-----------|-------|
| POST /collect | 100/min | Unlimited |
| GET /api/stats/* | 1000/hour | Unlimited |
| POST /api/funnels | 100/hour | Unlimited |
| WS /ws-live | Unlimited | 1 connection per client |

---

## Changelog

### v0.1.0 (Current)
- Initial API release
- Event collection
- Statistics queries
- Funnel analysis
- WebSocket live events
