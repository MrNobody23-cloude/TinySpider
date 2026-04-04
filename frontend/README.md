# Frontend

User-facing applications for the Insight Analytics platform.

## Overview

The frontend includes:
- **Dashboard** - Real-time analytics dashboard with live map, heatmaps, funnels, and charts
- **Tracker** - Lightweight JavaScript tracker (<3KB) for embedding in websites
- **Demo Site** - Sample website for testing tracker integration

## Packages

### [`packages/dashboard`](packages/dashboard)

React-based analytics dashboard with real-time data visualization.

**Features:**
- Live pulse map showing real-time page views
- Heatmap visualization of user interactions
- Funnel analysis for conversion tracking
- Time-series charts for traffic trends
- Referrer analysis

**Stack:**
- React 18
- Vite (build tool)
- Recharts (charting)
- React-Leaflet (mapping)
- SWR (data fetching)
- Zustand (state management)

**Getting Started:**
```bash
# From root
npm run dev:frontend

# Or from dashboard folder
cd frontend/packages/dashboard
npm install
npm run dev
```

**Build:**
```bash
npm run build:dashboard
```

**Access:** http://localhost:5173

---

### [`packages/tracker`](packages/tracker)

Tiny JavaScript tracker for embedding in websites to collect analytics events.

**Features:**
- Pageview tracking
- Click tracking
- Session management
- Bot detection (multi-layer)
- Custom event support
- Non-blocking (uses sendBeacon)
- ~2.1 KB minified + gzipped

**Integration:**
```html
<!-- In your website -->
<script>
  window.InsightConfig = {
    siteId: 'your-site-id',
    endpoint: 'https://analytics.example.com/collect'
  };
</script>
<script src="https://analytics.example.com/tracker.js"></script>
```

**Size Check:**
```bash
cd frontend/packages/tracker
npm run check-size
```

**See Also:**
- [Integration Guide](../../docs/INTEGRATION.md) - Detailed integration instructions for various frameworks
- [API Documentation](../../docs/API.md) - Event types and parameters

---

### [`packages/demo-site`](packages/demo-site)

Test website for verifying tracker integration and dashboard functionality.

**Getting Started:**
```bash
cd frontend/packages/demo-site
npm install
npm run dev
```

**Default Config:**
```javascript
window.InsightConfig = {
  siteId: 'demo-site',
  endpoint: 'http://localhost:3000/collect'
};
```

**Testing:**
1. Start backend API: `npm run dev:backend` (from root)
2. Start demo site: `npm run dev:frontend` (from root)
3. Open http://localhost:5174
4. Interact with the site (page navigation, clicks)
5. View events in dashboard at http://localhost:5173

---

## Development

### Setup

```bash
# Install all frontend dependencies
npm install:all

# Or install individual packages
cd frontend/packages/<package>
npm install
```

### Available Scripts

From root directory:
```bash
npm run dev:frontend    # Start all frontend apps in dev mode
npm run build:frontend  # Build all frontend packages
npm run build:tracker   # Build tracker specifically
npm run test:dashboard  # Run dashboard tests
```

From individual package directory:
```bash
npm run dev        # Development server
npm run build      # Production build
npm run preview    # Preview built files
npm run test       # Run tests (if configured)
```

### Directory Structure

```
frontend/
├── packages/
│   ├── dashboard/
│   │   ├── src/
│   │   │   ├── App.jsx
│   │   │   ├── main.jsx
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── store/
│   │   ├── package.json
│   │   └── vite.config.js
│   ├── tracker/
│   │   ├── src/
│   │   │   └── insight.js
│   │   ├── package.json
│   │   └── scripts/
│   └── demo-site/
│       ├── src/
│       ├── index.html
│       ├── package.json
│       └── vite.config.js
└── README.md
```

### Environment Variables

Create `.env` file in each package:

**Dashboard** (`frontend/packages/dashboard/.env`):
```env
VITE_API_BASE=http://localhost:3000
VITE_LOG_LEVEL=warn
```

**Tracker** (`frontend/packages/tracker/.env`):
```env
API_ENDPOINT=http://localhost:3000/collect
```

### Development Workflow

1. **Start backend first:**
   ```bash
   npm run dev:backend
   ```

2. **Start frontend services:**
   ```bash
   npm run dev:frontend
   ```

3. **Access applications:**
   - Dashboard: http://localhost:5173
   - Demo Site: http://localhost:5174
   - Tracker script: http://localhost:3000/tracker.js

4. **Test integration:**
   - Open demo site
   - Interact (navigate, click)
   - Check dashboard for events

---

## Building

### Development Build
```bash
npm run dev:frontend
```

Fast reload, source maps, unminified code.

### Production Build
```bash
npm run build:frontend
```

Minified, optimized, ready for deployment.

**Output locations:**
- Dashboard: `frontend/packages/dashboard/dist/`
- Demo Site: `frontend/packages/demo-site/dist/`
- Tracker: `frontend/packages/tracker/dist/tracker.js`

### Docker Build

```bash
# Build images
docker-compose build dashboard

# Run
docker-compose up -d dashboard
```

---

## Testing

### Dashboard Tests
```bash
npm run test:dashboard
```

Tests located in `frontend/packages/dashboard/test/`

### Manual Testing

1. **Tracker Loading:**
   - Open DevTools Network tab
   - Load page with tracker
   - Confirm `/tracker.js` loads

2. **Event Collection:**
   - Look for POST to `/collect`
   - Verify 200 response

3. **Dashboard Display:**
   - Events should appear within ~5 seconds
   - Charts update in real-time

4. **Heatmap:**
   - Click on demo site pages
   - Heatmap should show hotspots

5. **Funnel:**
   - Navigate through several pages
   - Funnel should show drop-off

---

## Performance

### Tracker Size
```bash
npm run build:tracker
npm run check-size

# Expected: ~2.1 KB (1,040 bytes gzipped)
```

### Optimization Tips

**Dashboard:**
- Use code splitting for routes
- Lazy load charts
- Memoize expensive components
- Cache API responses with SWR

**Build:**
- Remove dev dependencies in production
- Use CSS purging
- Optimize images

### Monitoring

Check bundle sizes:
```bash
npm run build:frontend
# Review dist/ folder sizes
```

---

## Troubleshooting

### Dashboard Won't Load
- Check browser console for errors
- Verify API is running: `curl http://localhost:3000/api/health`
- Check CORS headers in API logs

### Tracker Not Recording Events
- Check browser Network tab for `/collect` requests
- Verify tracker is embedded correctly
- Check browser console for errors
- See [Troubleshooting Guide](../../docs/TROUBLESHOOTING.md#event-collection-issues)

### CORS Errors
- Verify `API_CORS_ORIGINS` in backend `.env`
- Check dashboard origin matches
- See [Troubleshooting Guide](../../docs/TROUBLESHOOTING.md#dashboard-issues)

---

## Documentation

- **[Integration Guide](../../docs/INTEGRATION.md)** - Embed tracker in your site
- **[API Reference](../../docs/API.md)** - Event types and endpoints
- **[Troubleshooting](../../docs/TROUBLESHOOTING.md)** - Common issues
- **[Architecture](../../docs/ARCHITECTURE.md)** - System design

---

## Contributing

When adding new frontend features:

1. Create feature branch from `main`
2. Add tests where possible
3. Keep tracker size < 3KB
4. Test with backend API
5. Update relevant documentation
6. Submit PR with description

---

## License

[MIT](../../LICENSE)
