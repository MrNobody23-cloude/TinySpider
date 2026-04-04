/**
 * Insight Analytics - Server-Side Tracking Examples
 * 
 * Send events from your backend/API to Insight Analytics
 */

// lib/analytics.js - Server-side analytics client
const https = require('https');
const http = require('http');

class InsightAnalytics {
  constructor(config = {}) {
    this.endpoint = config.endpoint || 'http://localhost:3000/collect';
    this.apiKey = config.apiKey;
    this.siteId = config.siteId || 'my-app';
    this.timeout = config.timeout || 5000;
  }

  /**
   * Track an event
   */
  async track(event) {
    return new Promise((resolve, reject) => {
      const payload = {
        site_id: this.siteId,
        event_type: event.event_type,
        event_value: event.event_value,
        metadata: {
          timestamp: new Date().toISOString(),
          server: true,
          ...event.metadata
        }
      };

      const url = new URL(this.endpoint);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(JSON.stringify(payload))
        },
        timeout: this.timeout
      };

      if (this.apiKey) {
        options.headers['X-API-Key'] = this.apiKey;
      }

      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({ ok: true });
          } else {
            reject(new Error(`API returned ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  /**
   * Batch track multiple events (more efficient)
   */
  async trackBatch(events) {
    return Promise.all(events.map(e => this.track(e)));
  }

  /**
   * Track user action
   */
  async trackUserAction(userId, action, metadata = {}) {
    return this.track({
      event_type: 'user-action',
      event_value: action,
      metadata: {
        user_id: userId,
        ...metadata
      }
    });
  }

  /**
   * Track API request
   */
  async trackApiRequest(endpoint, method, statusCode, duration, metadata = {}) {
    return this.track({
      event_type: 'api-request',
      event_value: `${method} ${endpoint}`,
      metadata: {
        status_code: statusCode,
        duration_ms: duration,
        ...metadata
      }
    });
  }

  /**
   * Track error
   */
  async trackError(errorType, message, metadata = {}) {
    return this.track({
      event_type: 'error',
      event_value: errorType,
      metadata: {
        error_message: message,
        severity: metadata.severity || 'error',
        ...metadata
      }
    }).catch(err => {
      console.error('Failed to track error:', err);
    });
  }
}

module.exports = InsightAnalytics;

// ============================================
// EXAMPLE: Express.js Integration
// ============================================

// middleware/analytics.js
const InsightAnalytics = require('../lib/analytics');

const analytics = new InsightAnalytics({
  endpoint: process.env.ANALYTICS_ENDPOINT || 'http://localhost:3000/collect',
  siteId: 'my-api',
  apiKey: process.env.ANALYTICS_API_KEY
});

// Middleware to track API requests
function analyticsMiddleware(req, res, next) {
  const startTime = Date.now();

  // Capture original send
  const originalSend = res.send;

  res.send = function(data) {
    const duration = Date.now() - startTime;

    // Track successful requests
    if (res.statusCode < 400) {
      analytics.trackApiRequest(req.path, req.method, res.statusCode, duration, {
        user_id: req.user?.id,
        ip: req.ip,
        user_agent: req.get('user-agent')
      }).catch(err => console.error('Analytics error:', err));
    }

    // Track errors
    if (res.statusCode >= 400) {
      analytics.trackError('http-error', `${res.statusCode} ${req.path}`, {
        severity: res.statusCode >= 500 ? 'error' : 'warning',
        path: req.path,
        method: req.method
      }).catch(err => console.error('Analytics error:', err));
    }

    // Call original send
    return originalSend.call(this, data);
  };

  next();
}

module.exports = { analytics, analyticsMiddleware };

// routes/orders.js - Example: Track business events
const express = require('express');
const { analytics } = require('../middleware/analytics');

const router = express.Router();

router.post('/orders', async (req, res) => {
  try {
    const order = {
      id: 'order-123',
      user_id: req.user.id,
      total: 299.99,
      items: 2
    };

    // Track order creation
    await analytics.track({
      event_type: 'order-created',
      event_value: order.id,
      metadata: {
        user_id: order.user_id,
        total: order.total,
        items: order.items,
        user_country: req.user.country
      }
    });

    // Business logic...

    res.json({ ok: true, order });
  } catch (err) {
    await analytics.trackError('order-creation-error', err.message, {
      user_id: req.user?.id,
      severity: 'error'
    });

    res.status(500).json({ error: 'Failed to create order' });
  }
});

// routes/auth.js - Example: Track authentication events
router.post('/signup', async (req, res) => {
  try {
    const user = {
      id: 'user-' + Date.now(),
      email: req.body.email
    };

    // Track signup
    await analytics.track({
      event_type: 'user-signup',
      event_value: user.id,
      metadata: {
        user_id: user.id,
        signup_method: req.body.method || 'email',
        signup_source: req.query.utm_source
      }
    });

    res.json({ ok: true, user });
  } catch (err) {
    await analytics.trackError('signup-error', err.message, {
      email: req.body.email
    });

    res.status(500).json({ error: 'Signup failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    // Track login - only if successful
    const user = authenticate(req.body);

    await analytics.track({
      event_type: 'user-login',
      event_value: user.id,
      metadata: {
        user_id: user.id,
        login_method: 'password',
        last_login: user.last_login
      }
    });

    res.json({ ok: true, token: generateToken(user) });
  } catch (err) {
    // Track failed login attempt
    await analytics.track({
      event_type: 'login-failed',
      event_value: req.body.email,
      metadata: {
        reason: 'invalid-credentials'
      }
    });

    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// routes/payments.js - Example: Track payment events
router.post('/payments', async (req, res) => {
  try {
    const payment = {
      id: 'payment-' + Date.now(),
      amount: req.body.amount,
      currency: 'USD',
      method: req.body.method
    };

    // Process payment...
    const result = await processPayment(payment);

    if (result.success) {
      // Track successful payment
      await analytics.track({
        event_type: 'payment-completed',
        event_value: payment.id,
        metadata: {
          user_id: req.user.id,
          amount: payment.amount,
          currency: payment.currency,
          payment_method: payment.method,
          processor: result.processor
        }
      });

      res.json({ ok: true, payment_id: payment.id });
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    // Track failed payment
    await analytics.track({
      event_type: 'payment-failed',
      event_value: req.body.amount,
      metadata: {
        user_id: req.user?.id,
        error: err.message,
        payment_method: req.body.method
      }
    });

    res.status(400).json({ error: 'Payment failed' });
  }
});

module.exports = router;

// app.js - Setup
const express = require('express');
const { analyticsMiddleware } = require('./middleware/analytics');

const app = express();

// Apply analytics tracking to all routes
app.use(analyticsMiddleware);

// Routes
app.use('/api/orders', require('./routes/orders'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payments', require('./routes/payments'));

if (process.env.NODE_ENV !== 'test') {
  app.listen(3001, () => {
    console.log('API server running with Insight Analytics tracking');
  });
}

module.exports = app;

// ============================================
// SETUP
// ============================================

/*
1. Install package:
   npm install

2. Configure environment:
   ANALYTICS_ENDPOINT=http://localhost:3000/collect
   ANALYTICS_API_KEY=your-api-key
   ANALYTICS_SITE_ID=my-api

3. Start server:
   npm start

Events tracked:
- All HTTP requests (method, path, status, duration)
- User signups and logins
- Order creation
- Payments
- Errors and exceptions
*/
