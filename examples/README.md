# Insight Analytics - Integration Examples

Complete working examples of Insight Analytics integration across different platforms and frameworks.

## 📁 File Structure

```
examples/
├── README.md                 # This file
├── 01-basic-html.html       # Plain HTML integration
├── 02-react.jsx             # React hooks & components
├── 03-nextjs.jsx            # Next.js App Router integration
└── 04-nodejs-server.js      # Server-side tracking with Node.js/Express
```

## 🚀 Quick Start

### Option 1: Basic HTML (Easiest)

Perfect for testing or simple websites.

1. **Copy the file:**
   ```bash
   cp examples/01-basic-html.html ./my-site.html
   ```

2. **Open in browser:**
   ```bash
   open my-site.html
   # or
   firefox my-site.html
   ```

3. **Ensure backend is running:**
   ```bash
   npm run dev:backend
   ```

4. **Check events in dashboard:**
   - Dashboard: http://localhost:5173
   - Interact with the page to see events appear

---

### Option 2: React Application

For React projects (CRA, Vite, etc.).

1. **Copy the tracking code:**
   ```bash
   cp examples/02-react.jsx ./src/analytics.jsx
   ```

2. **Wrap your app:**
   ```jsx
   // main.jsx
   import { AnalyticsProvider } from './analytics';
   
   ReactDOM.createRoot(document.getElementById('root')).render(
     <AnalyticsProvider>
       <App />
     </AnalyticsProvider>
   );
   ```

3. **Use in components:**
   ```jsx
   import { useTrackEvent } from './analytics';
   
   function MyComponent() {
     const track = useTrackEvent();
     
     return (
       <button onClick={() => track('click', 'my-button')}>
         Click Me
       </button>
     );
   }
   ```

**Events tracked automatically:**
- Page views
- Route changes
- Click events

---

### Option 3: Next.js Application

For Next.js projects with App Router.

1. **Create hooks directory:**
   ```bash
   mkdir -p app/hooks
   mkdir -p app/lib
   ```

2. **Copy files:**
   ```bash
   cp examples/03-nextjs.jsx app/hooks/useInsight.js
   cp examples/03-nextjs.jsx app/lib/analytics.js
   ```

3. **Update layout.jsx:**
   ```jsx
   'use client';
   import { useInsight } from '@/hooks/useInsight';
   
   export default function RootLayout({ children }) {
     useInsight();
     return <html><body>{children}</body></html>;
   }
   ```

4. **Configure environment:**
   ```env
   # .env.local
   NEXT_PUBLIC_ANALYTICS_ENDPOINT=http://localhost:3000/collect
   ```

5. **Use in pages:**
   ```jsx
   'use client';
   import { useInsight } from '@/hooks/useInsight';
   
   export default function Page() {
     const { track } = useInsight();
     return (
       <button onClick={() => track('custom', 'action')}>
         Track Event
       </button>
     );
   }
   ```

---

### Option 4: Node.js/Express Server

For tracking from your backend API.

1. **Copy analytics client:**
   ```bash
   cp examples/04-nodejs-server.js ./lib/analytics.js
   ```

2. **Install dependencies:**
   ```bash
   npm install express
   ```

3. **Setup in your app.js:**
   ```javascript
   const InsightAnalytics = require('./lib/analytics');
   
   const analytics = new InsightAnalytics({
     endpoint: 'http://localhost:3000/collect',
     siteId: 'my-app'
   });
   
   // Track user signup
   analytics.track({
     event_type: 'user-signup',
     event_value: userId,
     metadata: { email: user.email }
   });
   ```

4. **Track business events:**
   ```javascript
   // Order creation
   await analytics.track({
     event_type: 'order-created',
     event_value: orderId,
     metadata: {
       total: order.total,
       items: order.items
     }
   });
   ```

---

## 📊 Event Types

Common events to track:

### User Events
- `user-signup` - New user registration
- `user-login` - User login
- `user-logout` - User logout
- `user-action` - Custom user action
- `profile-update` - Profile changes

### E-Commerce Events
- `product-view` - Product viewed
- `add-to-cart` - Item added to cart
- `checkout-initiated` - Checkout started
- `payment-completed` - Payment successful
- `order-created` - Order placed

### Engagement Events
- `pageview` - Page viewed (automatic)
- `click` - Element clicked (automatic)
- `scroll` - Page scrolled
- `share` - Content shared
- `wishlist` - Item added to wishlist

### Business Events
- `api-request` - API called
- `error` - Error occurred
- `login-failed` - Failed login attempt
- `payment-failed` - Payment failed
- `subscription-created` - Subscription started

### Custom Events
- Anything else specific to your use case

---

## 🔧 Configuration

### Common Settings

**Site ID:**
```javascript
window.InsightConfig = {
  siteId: 'my-website',  // Unique identifier
  endpoint: 'http://localhost:3000/collect'
};
```

**Environment-specific endpoints:**
```javascript
const endpoint = process.env.NODE_ENV === 'production'
  ? 'https://analytics.example.com/collect'
  : 'http://localhost:3000/collect';

window.InsightConfig = { siteId: 'my-app', endpoint };
```

**Debug mode:**
```javascript
window.InsightConfig = {
  siteId: 'my-app',
  endpoint: 'http://localhost:3000/collect',
  debug: true  // Console logging enabled
};
```

---

## 🚦 Testing

### Manual Testing

1. **Start all services:**
   ```bash
   npm run dev:backend      # Terminal 1
   npm run dev:frontend     # Terminal 2
   ```

2. **Open your integration:**
   - HTML: Direct file in browser
   - React: `http://localhost:5173`
   - Next.js: `http://localhost:3000`
   - Node.js: Make API requests

3. **Verify tracking:**
   - Open dashboard: `http://localhost:5173`
   - Interact with your page
   - Events should appear within 5 seconds

4. **Check browser console:**
   ```javascript
   // If debug enabled
   console.log('[Insight] Event tracked:', {
     event_type: 'pageview',
     url: window.location.href
   });
   ```

### Automated Testing

**Check tracker loading:**
```javascript
// In browser console
console.log(window.Insight);  // Should not be undefined
console.log(window.InsightConfig);  // Should show config
```

**Manually track event:**
```javascript
// In browser console
window.Insight.track({
  event_type: 'test-event',
  event_value: 'test-value'
});
```

---

## 🐛 Troubleshooting

### Tracker Script Not Loading
```
❌ GET /tracker.js 404 Not Found
```

**Solution:**
- Ensure backend is running: `npm run dev:backend`
- Check endpoint URL is correct
- Verify CORS settings: `API_CORS_ORIGINS` in `.env`

### Events Not Appearing in Dashboard
```
No data in dashboard after waiting 5+ seconds
```

**Diagnosis:**
1. Check browser Network tab for `/collect` requests
2. Verify events are being sent (look for 200 response)
3. Check API logs: `docker logs analytics-api`

**Solution:**
```bash
# Restart backend
npm run dev:backend

# Or check database connection
curl http://localhost:3000/api/health
```

### CORS Errors
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution:**
```env
# In .env
API_CORS_ORIGINS=http://localhost,http://localhost:3000,http://localhost:5173
```

### Tracker File Too Large
```
bundled code size should not exceed 3KB
```

**Solution:**
- Use tracker from CDN instead of building locally
- Build optimized version: `npm run build:tracker`
- Check size: `npm run check-size`

---

## 📈 Analytics Dashboard

Once events are being tracked, view them in the live dashboard:

**URL:** http://localhost:5173

**Sections:**
- **Overview** - Total events, unique visitors, top pages
- **Time Series** - Events over time
- **Heatmap** - Click hotspots on pages
- **Funnels** - User conversion paths
- **Live Map** - Real-time visitor locations
- **Referrers** - Traffic sources

---

## 🔑 API Key Authentication

For production, use API keys for server-side tracking.

**Create API key:**
```bash
# In dashboard or via API
POST /api/keys
{
  "site_id": "my-site",
  "name": "Backend Tracker"
}
```

**Use in server-side code:**
```javascript
const analytics = new InsightAnalytics({
  endpoint: 'https://analytics.example.com/collect',
  apiKey: 'sk_live_xxx',  // API key
  siteId: 'my-site'
});
```

**Use in requests:**
```javascript
headers: {
  'X-API-Key': 'sk_live_xxx'
}
```

---

## 🚀 Production Deployment

### Client-Side (Frontend)

1. **Update endpoint:**
   ```env
   VITE_API_BASE=https://analytics.example.com
   ```

2. **Build and deploy:**
   ```bash
   npm run build:frontend
   # Deploy dist/ folder to CDN
   ```

3. **Use HTTPS:**
   ```javascript
   endpoint: 'https://analytics.example.com/collect'
   ```

### Server-Side (Backend)

1. **Use HTTPS:**
   ```javascript
   const analytics = new InsightAnalytics({
     endpoint: 'https://analytics.example.com/collect',
     apiKey: 'sk_live_xxx'
   });
   ```

2. **Configure rate limiting:**
   - Batch events when possible
   - Implement retry logic
   - Handle failures gracefully

3. **Monitor:**
   - Track failed requests
   - Monitor latency
   - Set up alerts

---

## 📚 Related Documentation

- **[Integration Guide](../docs/INTEGRATION.md)** - Detailed integration instructions
- **[API Reference](../docs/API.md)** - Complete API documentation
- **[Architecture](../docs/ARCHITECTURE.md)** - System design
- **[Troubleshooting](../docs/TROUBLESHOOTING.md)** - Common issues

---

## 💡 Best Practices

### Event Naming
✅ Use kebab-case: `user-signup`, `add-to-cart`
❌ Avoid camelCase: `userSignup`, `addToCart`

### Event Values
✅ Use meaningful IDs: `prod-123`, `user-456`
❌ Avoid generic values: `true`, `success`

### Metadata
✅ Include context: `{ user_id, category, price }`
❌ Avoid excessive data: Don't track sensitive info

### Rate Limiting
✅ Batch events when possible
✅ Implement server-side rate limiting
❌ Don't send hundreds of events per second

---

## 📝 License

[MIT](../LICENSE)
