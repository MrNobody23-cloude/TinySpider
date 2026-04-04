# Insight-OS Quick Start Guide 🚀

## Prerequisites
- **Docker & Docker Compose** (easiest way) OR
- **Node.js 18+** + ClickHouse + PostgreSQL + Redis running locally

## ⚡ Quick Start with Docker (Recommended)

### 1. Start the full stack
```bash
docker-compose up -d
```

### 2. Verify services are running
```bash
docker-compose ps
# You should see: clickhouse, redis, postgres, api, dashboard, nginx all running
```

### 3. Access the dashboard
```
Open browser: http://localhost:5173
```

### 4. Get the tracking code (to embed in your site)
```html
<script>
    window.InsightConfig = {
        siteId: 'my-first-site',
        endpoint: 'http://localhost/collect'
    };
</script>
<script src="http://localhost/tracker.js"></script>
```

### 5. Launch the demo site (optional)
```bash
cd packages/demo-site && npm run dev
# Open http://localhost:8080 — click around to generate tracking events
```

## 🛑 Stop the stack
```bash
docker-compose down  # Keeps data
docker-compose down -v  # Remove volumes/data
```

## 📊 What You Can Do Right Now

### View Charts & Analytics
- Go to **Overview** tab → See traffic timeseries chart
- Go to **Referrers** → Top traffic sources
- Go to **Pages** → Most visited pages

### Test Click Heatmapping
1. Go to **Heatmap** tab
2. Enter a page URL (e.g., `/products`)
3. See KDE-based heatmap of click coordinates

### Create Funnels
1. Go to **Funnels** tab
2. Define steps: `["/", "/pricing", "/checkout", "/thank-you"]`
3. See drop-off rates at each step

### Live User Activity
1. Go to **Live Map** tab
2. See real-time active users (if geo-data available)
3. Watch pulsing dots update every second

## 🔧 Local Development (without Docker)

### 1. Install dependencies
```bash
npm install
```

### 2. Start databases (use Docker just for services)
```bash
docker run -d --name clickhouse -p 8123:8123 clickhouse/clickhouse-server:23.8
docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15-alpine
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### 3. Build tracker
```bash
npm run tracker:build
```

### 4. Start API (terminal 1)
```bash
cd packages/api
npm start
```

### 5. Start Dashboard (terminal 2)
```bash
cd packages/dashboard
npm run dev
```

### 6. Access
```
API: http://localhost:3000
Dashboard: http://localhost:5173
```

## 📈 Key Metrics You Can Track

| Feature | Description | Status |
|---------|-------------|--------|
| **Pageviews** | Track page loads in SPAs | ✅ Working |
| **Sessions** | Unique visitor sessions | ✅ Working |
| **Bot Detection** | Filter out bot traffic | ✅ Working |
| **Click Tracking** | X/Y coordinates of clicks | ✅ Working |
| **Heatmaps** | KDE-based click density | ✅ Working |
| **Funnels** | Conversion funnel analysis | ✅ Working |
| **Real-time** | Live WebSocket updates | ✅ Working |
| **Geo-location** | Live map with active users | ⚠️ Requires GeoIP DB |

## 🔐 Security Notes

- The tracker endpoint (`/collect`) is **rate-limited** to 100 requests/minute per IP
- All API routes except `/collect` require **X-API-Key** header in production
- IP addresses are hashed, not stored in plaintext
- Bot traffic is labeled but never deleted (for analysis)

## 📺 Testing

### Run all tests
```bash
npm test
```

### API tests only
```bash
npm run api:test
```

### Watch mode
```bash
npm run test:watch
```

## 🐛 Troubleshooting

### Dashboard shows "Loading..."
- Check if API is running: `curl http://localhost:3000/api/health`
- Check browser console for CORS errors  
- Ensure `VITE_API_BASE` env var is set correctly

### No events showing
- Check `/collect` endpoint is receiving requests
- Verify `SITE_ID` in tracker config matches your setup
- Check bot detection isn't filtering everything: toggle "Include Bots"

### ClickHouse connection error
- Verify ClickHouse is running: `curl http://localhost:8123/ping`
- Check `CLICKHOUSE_URL` environment variable

### PostgreSQL connection error
- Verify Postgres is running: `psql -U postgres -d insightdb`
- Check credentials in `.env`

## 📚 Next Steps

1. **Deploy to production** → See [README.md](README.md) for deployment guide
2. **Add custom events** → Extend tracker with `track('custom', {...})`
3. **Setup authentication** → Use `/api/auth/register` and `/api/auth/login`
4. **Install GeoIP database** → Download MaxMind GeoLite2-City for live map
5. **Scale it** → Use external ClickHouse/PostgreSQL/Redis services

## 🎯 Project Structure
```
packages/
├── api/          # Fastify backend (port 3000)
├── dashboard/    # React frontend (port 5173)
└── tracker/      # Minimal JS tracker (2.1KB)

Key files:
- .env           → Configuration
- docker-compose.yml → Service definitions
- README.md      → Full documentation
```

## 💡 Pro Tips

1. **Faster updates**: Set `VITE_API_BASE=http://localhost:3000` for direct backend connection
2. **Test tracking**: Send manual events: 
   ```bash
   curl -X POST http://localhost/collect \
     -H "Content-Type: application/json" \
     -d '{"site_id":"test","event_type":"pageview","url":"/"}'
   ```
3. **Debug bot detection**: Add `&include_bots=true` to API queries
4. **Export data**: ClickHouse supports multiple query formats (CSV, JSON, etc.)

---

**Need help?** Check [README.md](README.md) or open an issue!
