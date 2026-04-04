# Integration Guide - Adding TinySpider to Your Website

## Quick Start (2 minutes)

### 1. Get Your Tracker Script

The tracker script is available at:
```
http://your-analytics-domain/tracker.js
```

Or use the built version from the repository:
```
frontend/packages/tracker/dist/insight.min.js
```

### 2. Add to Your HTML

Insert this snippet in your website's `<head>` or before `</body>`:

```html
<script>
  window.InsightConfig = {
    siteId: 'your-site-id-here',
    endpoint: 'http://your-analytics-domain/collect'
  };
</script>
<script src="http://your-analytics-domain/tracker.js" async></script>
```

### 3. Done!

The tracker will now:
- ✅ Capture pageviews
- ✅ Track navigation in SPAs
- ✅ Record click events with coordinates
- ✅ Detect bot traffic
- ✅ Send data asynchronously

## Configuration

### Required Parameters

```javascript
window.InsightConfig = {
  siteId: 'unique-site-identifier',      // Required: Unique ID for your site
  endpoint: 'http://api.example.com/collect'  // Required: Analytics endpoint
};
```

### Optional Parameters

```javascript
window.InsightConfig = {
  // Required
  siteId: 'my-website',
  endpoint: 'http://localhost:3000/collect',
  
  // Optional
  debug: false,           // Log events to console
  customUserAgent: null,  // Override user agent
  sessionTimeout: 1800000 // Session timeout in ms (default: 30 min)
};
```

## Tracking Events

### Automatic Events (Always Tracked)

1. **Pageviews**: Automatically on page load and SPA navigation
2. **Clicks**: Mouse clicks with normalized X/Y coordinates (0-1)

### Manual Event Tracking

To track custom events:

```javascript
// Track a custom event (if API supports it)
if (window._insightTrack) {
  window._insightTrack('custom-event', {
    // Custom properties
  });
}
```

## Examples by Framework

### Plain HTML

```html
<!DOCTYPE html>
<html>
<head>
    <script>
        window.InsightConfig = {
            siteId: 'my-site',
            endpoint: '/collect'
        };
    </script>
    <script src="/tracker.js"></script>
</head>
<body>
    <h1>Hello World</h1>
</body>
</html>
```

### React

```jsx
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Configure tracker
    window.InsightConfig = {
      siteId: 'react-app',
      endpoint: 'http://localhost:3000/collect'
    };
    
    // Load tracker script
    const script = document.createElement('script');
    script.src = 'http://localhost:3000/tracker.js';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  return <h1>Welcome to My App</h1>;
}

export default App;
```

### Next.js

```jsx
// pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.InsightConfig = {
                siteId: 'nextjs-app',
                endpoint: 'http://localhost:3000/collect'
              };
            `,
          }}
        />
        <script src="http://localhost:3000/tracker.js" async />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

### Vue.js

```vue
<!-- nuxt.config.ts or vue build config -->
export default defineNuxtConfig({
  modules: [],
  app: {
    head: {
      script: [
        {
          src: 'http://localhost:3000/tracker.js',
          async: true
        }
      ]
    }
  }
});

// In your layout or main app component
<script setup>
import { onMounted } from 'vue';

onMounted(() => {
  window.InsightConfig = {
    siteId: 'vue-app',
    endpoint: 'http://localhost:3000/collect'
  };
});
</script>
```

### Gatsby

```javascript
// gatsby-browser.js
export const onClientEntry = () => {
  window.InsightConfig = {
    siteId: 'gatsby-site',
    endpoint: 'http://localhost:3000/collect'
  };
};

// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-plugin-script-ext',
      options: {
        async: true,
        src: 'http://localhost:3000/tracker.js'
      }
    }
  ]
};
```

### WordPress

Add to theme's `header.php`:

```php
<!-- Before </head> -->
<script>
  window.InsightConfig = {
    siteId: 'wordpress-site',
    endpoint: '<?php echo home_url('/analytics'); ?>/collect'
  };
</script>
<script src="<?php echo home_url('/analytics'); ?>/tracker.js" async></script>
```

Or use a WordPress plugin to inject the script.

## Testing Integration

### Step 1: Verify Script is Loaded

Open browser DevTools (F12) → Console:

```javascript
// Check if tracker config is set
console.log(window.InsightConfig);

// Should output:
// {siteId: "my-site", endpoint: "http://localhost:3000/collect"}
```

### Step 2: Check Network Requests

DevTools → Network tab:

```
POST /collect
Status: 200
Payload: {
  site_id: "my-site",
  event_type: "pageview",
  url: "https://example.com",
  ...
}
```

### Step 3: View in Dashboard

1. Open dashboard: http://localhost:5173
2. Go to **Overview** tab
3. Should see your site's traffic appearing in real-time

## Verifying Data Collection

### Check Events via API

```bash
# Query recent events
curl 'http://localhost:3000/api/stats/timeseries?site_id=my-site&from=2024-01-01&to=2024-12-31'

# Get referrers
curl 'http://localhost:3000/api/stats/referrers?site_id=my-site'

# Get clicks heatmap
curl 'http://localhost:3000/api/stats/heatmap?site_id=my-site&url=/'
```

### Check Events via Database

```bash
# ClickHouse
curl -X POST 'http://localhost:8123' \
  --data-binary 'SELECT COUNT(*) FROM events WHERE site_id = "my-site"'
```

## Troubleshooting

### Events Not Showing Up

**Problem**: No events appear in dashboard

**Solutions**:
1. Verify tracker script is loaded (check DevTools Network)
2. Check browser console for errors
3. Verify `siteId` matches exactly
4. Check endpoint is correct and accessible
5. Check API is running: `curl http://localhost:3000/health`
6. Check CORS headers: Look for CORS errors in Network tab

### High Bot Traffic

**Problem**: Dashboard shows high percentage of bot traffic

**Only happens if**:
- User-Agent is in bot signatures list
- JavaScript execution is blocked
- Missing Accept-Language header
- Honeypot image fails to load

**Solution**: This is expected behavior - bots are being filtered correctly. Use dashboard toggle to exclude bots.

### Script Size Concerns

**Info**: Tracker is only 2.1 KB gzipped, negligible performance impact

- Total bandwidth: ~1 KB per page load
- Non-blocking: Loads asynchronously
- Minimal impact on page speed

### CORS Errors

**Problem**: Script blocks with CORS error

**Solution**: Update `.env` to allow your domain:

```env
API_CORS_ORIGINS=https://example.com,https://www.example.com
```

## Performance Considerations

### Tracker Impact
- **Size**: 2.1 KB minified, 1.04 KB gzipped
- **Load**: ~5ms on typical network
- **Execution**: Non-blocking, uses `requestIdleCallback`

### Network Impact
- **Per pageview**: ~200 bytes
- **Per click**: ~300 bytes
- **Batching**: Events batched in queue
- **Method**: Uses `sendBeacon()` when available

## Best Practices

1. **Use HTTPS**: Always use HTTPS in production
2. **Configure CORS**: Whitelist your domain in `.env`
3. **Monitor Traffic**: Check dashboard regularly
4. **Update Scripts**: Keep tracker updated for bug fixes
5. **Test Locally**: Test integration on localhost first
6. **Use Site IDs**: Use meaningful site IDs for organization
7. **Document Funnels**: Document conversion paths for analysis

## Advanced Configuration

### Content Security Policy (CSP)

If using CSP, allow the tracker:

```html
<meta http-equiv="Content-Security-Policy" 
  content="script-src 'self' http://localhost:3000">
```

### Subdomains

Track multiple subdomains separately:

```javascript
// On subdomain1.example.com
window.InsightConfig = {
  siteId: 'subdomain1-site',
  endpoint: 'http://localhost:3000/collect'
};

// On subdomain2.example.com
window.InsightConfig = {
  siteId: 'subdomain2-site',
  endpoint: 'http://localhost:3000/collect'
};
```

Or track them as one site if preferred.

## Next Steps

1. **Create Funnels**: Define conversion paths in dashboard
2. **Analyze Heatmaps**: Understand where users click
3. **View Reports**: Check traffic, referrers, pages
4. **Set Alerts**: Configure notifications for events (enterprise feature)

## Support

For issues or questions, check:
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common problems
- [API.md](API.md) for API documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) for system design
