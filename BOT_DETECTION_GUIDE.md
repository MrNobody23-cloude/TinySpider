# BOT DETECTION & PREVENTION GUIDE
## "The Signal in the Static" Analytics Engine

---

## CURRENT IMPLEMENTATION ANALYSIS

### What's Currently Implemented (In Provided Code)
```
Minimal/None:
❌ No bot detection in collector
❌ No bot prevention in backend
❌ No fingerprinting
❌ No rate limiting (basic structure only)
❌ No user-agent validation
❌ No behavioral analysis
❌ No suspicious pattern detection
```

**Why?** The hackathon solution prioritizes **speed and simplicity** over security. Bot detection adds complexity and would reduce throughput scoring.

---

## BOT DETECTION MECHANISMS (What You SHOULD Add Later)

### 1. USER-AGENT ANALYSIS (LOW EFFORT)
**Location**: `collector/src/tracker.js` + `backend/src/utils/botDetection.js`

#### Known Bot User-Agents
```javascript
const BOT_PATTERNS = [
  // Search engines
  'Googlebot', 'Bingbot', 'Slurp', 'Baidu', 'Yandex',
  // Social media
  'facebookexternalhit', 'Twitterbot', 'LinkedInBot',
  // Monitoring
  'Pingdom', 'UptimeRobot', 'Datadog', 'NewRelic',
  // Scrapers
  'curl', 'wget', 'python', 'scrapy',
  // Others
  'bot', 'crawler', 'spider', 'scraper', 'headless'
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const lower = userAgent.toLowerCase();
  return BOT_PATTERNS.some(pattern => lower.includes(pattern.toLowerCase()));
}
```

**Trade-off**: Easy to bypass (user-agent spoofing)
**Effectiveness**: 30% (low)

---

### 2. BEHAVIORAL ANALYSIS (MEDIUM EFFORT)

#### A. Impossible User Behavior
```javascript
// Check for human-impossible patterns
function detectImpossibleBehavior(session) {
  const events = session.events;
  
  // Instant navigation (0ms between page loads = bot)
  let impossibleSwitches = 0;
  for (let i = 1; i < events.length; i++) {
    const timeDiff = events[i].timestamp - events[i-1].timestamp;
    if (timeDiff < 100) {  // < 100ms = impossible for human
      impossibleSwitches++;
    }
  }
  
  return impossibleSwitches > 3;  // More than 3 = suspicious
}
```

#### B. Non-Human Patterns
```javascript
function analyzeSessionBehavior(sessionId) {
  const session = db.prepare(
    'SELECT * FROM events WHERE sessionId = ? ORDER BY timestamp'
  ).all(sessionId);

  const analysis = {
    isBot: false,
    score: 0,  // 0-100 (100 = definitely bot)
    reasons: []
  };

  // 1. Constant click rate (humans vary)
  const clickIntervals = [];
  for (let i = 1; i < session.length; i++) {
    if (session[i].type === 'click' && session[i-1].type === 'click') {
      clickIntervals.push(session[i].timestamp - session[i-1].timestamp);
    }
  }
  
  const variance = calculateVariance(clickIntervals);
  if (variance < 50) {  // Very consistent = bot
    analysis.score += 30;
    analysis.reasons.push('Unnatural click timing consistency');
  }

  // 2. Never scrolls (bots may not capture scroll)
  const hasScroll = session.some(e => e.type === 'scroll');
  if (!hasScroll && session.length > 20) {
    analysis.score += 20;
    analysis.reasons.push('No scroll events detected');
  }

  // 3. Only clicks, no pageviews
  const pageviews = session.filter(e => e.type === 'pageview').length;
  const clicks = session.filter(e => e.type === 'click').length;
  if (pageviews === 1 && clicks > 50) {
    analysis.score += 25;
    analysis.reasons.push('Excessive clicks on single page');
  }

  // 4. No mouse movement variation
  const xCoords = session
    .filter(e => e.type === 'click')
    .map(e => e.x);
  
  if (xCoords.length > 5) {
    const xVariance = calculateVariance(xCoords);
    if (xVariance < 10) {  // All clicks in same area
      analysis.score += 15;
      analysis.reasons.push('Clicks only in narrow area');
    }
  }

  analysis.isBot = analysis.score > 60;
  return analysis;
}
```

**Trade-off**: Harder to bypass, but may false-positive on humans with unusual patterns
**Effectiveness**: 60% (medium)

---

### 3. RATE LIMITING (MEDIUM EFFORT)

#### A. Request-Based Rate Limiting
```javascript
// backend/src/middleware/rateLimit.js

const requestCounts = new Map();  // In-memory counter
const WINDOW = 60000;  // 1 minute
const MAX_REQUESTS = 1000;

function rateLimit() {
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();

    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, { count: 0, resetAt: now + WINDOW });
    }

    const record = requestCounts.get(ip);

    // Reset window if expired
    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + WINDOW;
    }

    record.count++;

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': MAX_REQUESTS,
      'X-RateLimit-Remaining': Math.max(0, MAX_REQUESTS - record.count),
      'X-RateLimit-Reset': record.resetAt
    });

    if (record.count > MAX_REQUESTS) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((record.resetAt - now) / 1000)
      });
    }

    next();
  };
}

// Use in server.js:
// app.use(rateLimit());
```

**Trade-off**: Blocks legitimate high-traffic users
**Effectiveness**: 70% (good)

#### B. Event-Based Rate Limiting
```javascript
const SESSION_LIMITS = {
  maxEventsPerMinute: 300,      // Humans: 5/sec max
  maxClicksPerSecond: 10,        // Humans: <10/sec
  maxPageviewsPerMinute: 20,     // Humans: <20/min
  minSessionDuration: 2000,      // Min 2 sec
  maxSessionEvents: 10000        // Max per session
};

function checkEventRateLimit(sessionId) {
  const oneMinuteAgo = Date.now() - 60000;
  
  const recentEvents = db.prepare(`
    SELECT COUNT(*) as count, MAX(timestamp) as latest
    FROM events 
    WHERE sessionId = ? AND timestamp > ?
  `).get(sessionId, oneMinuteAgo);

  if (recentEvents.count > SESSION_LIMITS.maxEventsPerMinute) {
    return {
      allowed: false,
      reason: 'Too many events per minute',
      count: recentEvents.count
    };
  }

  return { allowed: true };
}
```

**Trade-off**: Requires tracking per session
**Effectiveness**: 75% (good)

---

### 4. FINGERPRINTING (HIGH EFFORT)

#### A. Device Fingerprint
```javascript
// collector/src/fingerprint.js

function generateFingerprint() {
  const fingerprint = {
    // Browser info
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    
    // Canvas fingerprinting (unique per GPU/driver)
    canvasHash: getCanvasFingerprint(),
    
    // WebGL fingerprinting (GPU info)
    webglHash: getWebGLFingerprint(),
    
    // Storage available
    localStorage: isLocalStorageAvailable(),
    sessionStorage: isSessionStorageAvailable(),
    indexedDB: isIndexedDBAvailable(),
    
    // Plugin list (older browsers)
    plugins: navigator.plugins.length,
    
    // Do Not Track
    doNotTrack: navigator.doNotTrack,
    
    // Timestamp
    createdAt: Date.now()
  };

  return hashFingerprint(fingerprint);
}

function getCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Browser Fingerprint', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Browser Fingerprint', 4, 17);
    
    return hashCanvas(canvas.toDataURL());
  } catch (e) {
    return 'unavailable';
  }
}

function getWebGLFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    
    return hashWebGL(`${vendor}:${renderer}`);
  } catch (e) {
    return 'unavailable';
  }
}

function hashFingerprint(obj) {
  // Simple hash (use crypto for production)
  let hash = 0;
  const str = JSON.stringify(obj);
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;  // Convert to 32-bit integer
  }
  
  return hash.toString(16);
}
```

**Trade-off**: Computationally expensive, privacy concerns
**Effectiveness**: 85% (very good)

#### B. Backend Fingerprint Tracking
```javascript
// backend/src/utils/fingerprinting.js

const fingerprints = new Map();  // fingerprint -> sessions
const FINGERPRINT_WINDOW = 3600000;  // 1 hour

function trackFingerprint(fingerprint, sessionId) {
  if (!fingerprints.has(fingerprint)) {
    fingerprints.set(fingerprint, []);
  }
  
  const sessions = fingerprints.get(fingerprint);
  sessions.push({
    sessionId,
    timestamp: Date.now()
  });
  
  // Clean old entries
  fingerprints.set(
    fingerprint,
    sessions.filter(s => Date.now() - s.timestamp < FINGERPRINT_WINDOW)
  );
  
  // Flag if multiple sessions from same fingerprint
  if (sessions.length > 5) {
    return {
      suspicious: true,
      reason: 'Multiple sessions from same fingerprint',
      sessionCount: sessions.length
    };
  }
  
  return { suspicious: false };
}
```

**Trade-off**: Privacy nightmare, breaks with updates
**Effectiveness**: 90% (excellent, but controversial)

---

### 5. CHALLENGE-RESPONSE (HIGH EFFORT)

#### A. CAPTCHA Integration
```javascript
// collector/src/captcha.js

async function validateWithCAPTCHA() {
  // Use reCAPTCHA v3 (invisible)
  const token = await grecaptcha.execute('YOUR_SITE_KEY', {
    action: 'pageview'
  });
  
  // Send to backend for verification
  const response = await fetch('/api/verify-captcha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  
  const result = await response.json();
  
  if (result.score < 0.5) {
    // Likely bot
    console.warn('Low score - possible bot detected');
    return false;
  }
  
  return true;
}

// backend/src/routes/captcha.js
const https = require('https');

app.post('/api/verify-captcha', (req, res) => {
  const { token } = req.body;
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  
  const postData = `secret=${secret}&response=${token}`;
  
  const options = {
    hostname: 'www.google.com',
    path: '/recaptcha/api/siteverify',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  };
  
  const request = https.request(options, (response) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => {
      const result = JSON.parse(data);
      res.json({
        success: result.success,
        score: result.score,  // 0.0 to 1.0
        action: result.action
      });
    });
  });
  
  request.on('error', (e) => {
    res.status(500).json({ error: e.message });
  });
  
  request.write(postData);
  request.end();
});
```

**Trade-off**: External dependency, may block humans
**Effectiveness**: 95% (excellent)

---

### 6. IP & GEOLOCATION (MEDIUM EFFORT)

#### A. IP-Based Detection
```javascript
// backend/src/utils/ipAnalysis.js

const geoip = require('geoip-lite');

function analyzeIPBehavior(ip, sessionId) {
  const geo = geoip.lookup(ip);
  
  const analysis = {
    isVPN: false,
    isProxy: false,
    isDataCenter: false,
    suspicionScore: 0
  };

  // Check against known VPN/Proxy services
  const VPN_RANGES = [
    // Add known VPN IP ranges
  ];
  
  if (VPN_RANGES.some(range => isIPInRange(ip, range))) {
    analysis.isVPN = true;
    analysis.suspicionScore += 40;
  }

  // Check if datacenter IP (AWS, GCP, Azure, etc.)
  const DATACENTER_ASNS = [16509, 15169, 8075];  // AWS, Google, Microsoft
  if (DATACENTER_ASNS.includes(getASN(ip))) {
    analysis.isDataCenter = true;
    analysis.suspicionScore += 50;
  }

  // Check geographic impossibilities
  const lastSessions = db.prepare(`
    SELECT DISTINCT ip, timestamp FROM events 
    WHERE sessionId = ? 
    ORDER BY timestamp DESC 
    LIMIT 5
  `).all(sessionId);
  
  for (let i = 1; i < lastSessions.length; i++) {
    const prevGeo = geoip.lookup(lastSessions[i].ip);
    const currentGeo = geoip.lookup(lastSessions[i-1].ip);
    
    const distance = calculateDistance(
      prevGeo.ll[0], prevGeo.ll[1],
      currentGeo.ll[0], currentGeo.ll[1]
    );
    
    const timeDiff = (lastSessions[i-1].timestamp - lastSessions[i].timestamp) / 1000 / 60;  // minutes
    const maxSpeed = distance / timeDiff;  // km per minute
    
    if (maxSpeed > 900) {  // Faster than airplane
      analysis.suspicionScore += 50;
      analysis.reasons = analysis.reasons || [];
      analysis.reasons.push(`Impossible travel speed: ${maxSpeed} km/min`);
    }
  }

  return analysis;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  // Haversine formula
  const R = 6371;  // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```

**Trade-off**: Requires IP geolocation service, privacy concerns
**Effectiveness**: 65% (medium-good)

---

### 7. ML-BASED DETECTION (VERY HIGH EFFORT)

```javascript
// backend/src/utils/mlDetection.js
// Using TensorFlow.js or similar

async function predictIsBot(sessionFeatures) {
  // Trained model on known bot/human behavior
  const model = await tf.loadLayersModel('file://./bot-model.json');
  
  const features = tf.tensor2d([
    sessionFeatures.eventCount,
    sessionFeatures.averageClickInterval,
    sessionFeatures.pageviewCount,
    sessionFeatures.clickCount,
    sessionFeatures.scrollCount,
    sessionFeatures.averageSessionDuration,
    sessionFeatures.uniqueIPCount,
    sessionFeatures.fingerprintVariance,
    // ... more features
  ]]);
  
  const prediction = model.predict(features);
  const score = await prediction.data();
  
  return {
    isBot: score[0] > 0.7,
    confidence: score[0],
    model: 'ensemble_v2'
  };
}
```

**Trade-off**: Requires training data and ML knowledge
**Effectiveness**: 92% (excellent)

---

## RECOMMENDED STRATEGY FOR HACKATHON

### Minimal Implementation (Fast - 30 minutes)
```javascript
// Just add to existing code
1. User-Agent blacklist check
2. Basic request rate limiting
3. Event rate per session check
4. Flag and skip events from bots (don't block)
```

### Moderate Implementation (Thorough - 1.5 hours)
```javascript
1. User-Agent + referer analysis
2. Request rate limiting + event rate limiting
3. Behavioral analysis (timing, click patterns)
4. Device fingerprinting
5. Bot flagging in database
6. Dashboard tab: "Suspicious Events"
```

### Complete Implementation (Enterprise - 2-3 hours)
```javascript
1. All of above
2. IP geolocation + VPN detection
3. CAPTCHA challenge
4. ML-based scoring
5. Detailed bot reports
6. Automatic bot event filtering
```

---

## IMPLEMENTATION CHECKLIST (Minimal - Add to Current Code)

### Step 1: Add Bot Detection Utility
```javascript
// backend/src/utils/botDetection.js

module.exports = {
  isBotUserAgent(userAgent) {
    const BOT_PATTERNS = [
      'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget',
      'googlebot', 'bingbot', 'slurp', 'baidu', 'yandex',
      'facebookexternalhit', 'twitterbot', 'linkedinbot'
    ];
    
    const lower = (userAgent || '').toLowerCase();
    return BOT_PATTERNS.some(pattern => lower.includes(pattern));
  },

  checkEventRate(sessionId, db) {
    const oneMinuteAgo = Date.now() - 60000;
    
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM events
      WHERE sessionId = ? AND timestamp > ?
    `).get(sessionId, oneMinuteAgo);
    
    // Humans: max 300 events per minute (5/sec)
    return result.count > 300 ? 'HIGH' : 'NORMAL';
  },

  calculateSuspicionScore(events) {
    let score = 0;
    
    // Check click timing consistency
    const clickTimes = [];
    for (let i = 1; i < events.length; i++) {
      if (events[i].type === 'click' && events[i-1].type === 'click') {
        clickTimes.push(events[i].timestamp - events[i-1].timestamp);
      }
    }
    
    if (clickTimes.length > 5) {
      const variance = calculateVariance(clickTimes);
      if (variance < 50) score += 25;  // Too consistent
    }
    
    // Check no scrolls
    if (!events.some(e => e.type === 'scroll') && events.length > 20) {
      score += 15;
    }
    
    // Check only clicks on one page
    if (events.filter(e => e.type === 'pageview').length === 1 && 
        events.filter(e => e.type === 'click').length > 50) {
      score += 20;
    }
    
    return score;
  }
};

function calculateVariance(arr) {
  const mean = arr.reduce((a, b) => a + b) / arr.length;
  return arr.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / arr.length;
}
```

### Step 2: Modify Backend to Flag Bots
```javascript
// In backend/src/server.js

const botDetection = require('./utils/botDetection');

// Add to events table: isSuspicious BOOLEAN, suspicionScore INTEGER

app.post('/api/events', (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : req.body.events || [];
    
    if (events.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    // Check user-agent
    const userAgent = events[0]?.userAgent;
    const isBotUA = botDetection.isBotUserAgent(userAgent);
    
    const stmt = db.prepare(`
      INSERT INTO events 
      (sessionId, trackingId, type, url, title, x, y, element,
       referrer, userAgent, timestamp, isSuspicious, suspicionScore)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTx = db.transaction(() => {
      let count = 0;
      for (const event of events) {
        const eventRate = botDetection.checkEventRate(
          event.sessionId, 
          db
        );
        
        const isSuspicious = isBotUA || eventRate === 'HIGH';
        
        stmt.run(
          event.sessionId,
          event.trackingId,
          event.type,
          event.url,
          event.title,
          event.x || null,
          event.y || null,
          event.element,
          event.referrer,
          event.userAgent,
          event.timestamp || Date.now(),
          isSuspicious ? 1 : 0,
          isBotUA ? 50 : 0
        );
        count++;
      }
      return count;
    });

    const inserted = insertTx();
    res.json({ success: true, count: inserted });
  } catch (error) {
    console.error('Error inserting events:', error);
    res.status(500).json({ error: 'Failed to insert events' });
  }
});
```

### Step 3: Add Dashboard Tab for Bot Detection
```javascript
// dashboard/src/components/BotDetection.jsx

import React, { useState, useEffect } from 'react';

export default function BotDetection() {
  const [suspiciousData, setSuspiciousData] = useState(null);

  useEffect(() => {
    const fetchSuspicious = async () => {
      try {
        const response = await fetch(
          'http://localhost:5000/api/suspicious?hours=24'
        );
        const data = await response.json();
        setSuspiciousData(data);
      } catch (error) {
        console.error('Error fetching suspicious data:', error);
      }
    };

    fetchSuspicious();
    const interval = setInterval(fetchSuspicious, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!suspiciousData) return <div>Loading...</div>;

  return (
    <div>
      <h2>🤖 Bot Detection</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div style={{ background: '#fef3c7', padding: '20px', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#92400e' }}>SUSPICIOUS EVENTS</p>
          <p style={{ margin: '0', fontSize: '28px', fontWeight: '700', color: '#d97706' }}>
            {suspiciousData.suspiciousCount}
          </p>
        </div>
        
        <div style={{ background: '#dbeafe', padding: '20px', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#1e40af' }}>BOT USER-AGENTS</p>
          <p style={{ margin: '0', fontSize: '28px', fontWeight: '700', color: '#3b82f6' }}>
            {suspiciousData.botUACount}
          </p>
        </div>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        <h3>Recent Suspicious Sessions</h3>
        {suspiciousData.suspiciousSessions?.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Session ID</th>
                <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>User-Agent</th>
                <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Events</th>
                <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {suspiciousData.suspiciousSessions.map((session, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px', fontSize: '12px' }}>{session.sessionId.slice(0, 8)}...</td>
                  <td style={{ padding: '10px', fontSize: '12px' }}>
                    {session.userAgent?.slice(0, 40)}...
                  </td>
                  <td style={{ padding: '10px', fontSize: '12px' }}>{session.eventCount}</td>
                  <td style={{ padding: '10px', fontSize: '12px', color: '#ef4444', fontWeight: '600' }}>
                    {session.avgScore || 50}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: '#6b7280', fontSize: '14px' }}>No suspicious sessions detected</p>
        )}
      </div>
    </div>
  );
}
```

### Step 4: Add API Endpoint
```javascript
// In backend/src/server.js

app.get('/api/suspicious', (req, res) => {
  try {
    const hours = parseInt(req.query.hours || '24', 10);
    const timeAgo = Date.now() - (hours * 60 * 60 * 1000);

    // Suspicious event count
    const suspiciousStmt = db.prepare(`
      SELECT COUNT(*) as count FROM events 
      WHERE isSuspicious = 1 AND timestamp > ?
    `);
    const suspiciousCount = suspiciousStmt.get(timeAgo).count;

    // Bot user-agent count
    const botUAStmt = db.prepare(`
      SELECT COUNT(*) as count FROM events 
      WHERE userAgent LIKE '%bot%' OR userAgent LIKE '%crawler%'
      AND timestamp > ?
    `);
    const botUACount = botUAStmt.get(timeAgo).count;

    // Suspicious sessions
    const sessionsStmt = db.prepare(`
      SELECT 
        sessionId,
        userAgent,
        COUNT(*) as eventCount,
        AVG(suspicionScore) as avgScore
      FROM events
      WHERE isSuspicious = 1 AND timestamp > ?
      GROUP BY sessionId
      ORDER BY avgScore DESC
      LIMIT 10
    `);
    const suspiciousSessions = sessionsStmt.all(timeAgo);

    res.json({
      suspiciousCount,
      botUACount,
      suspiciousSessions,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching suspicious data:', error);
    res.status(500).json({ error: 'Failed to fetch suspicious data' });
  }
});
```

---

## KEY DIFFERENCES: PREVENTION VS DETECTION

### Detection (What You're Checking)
```
✓ Is this event from a bot?
✓ Analyze after the fact
✓ Less performance impact
✓ Good for analytics
```

### Prevention (What You're Blocking)
```
✓ Stop bot before event is recorded
✓ CAPTCHA, IP blocking, challenges
✓ Significant performance impact
✓ Good for security
```

---

## IMPLEMENTATION COMPARISON TABLE

| Method | Effort | Effectiveness | Privacy | False Positives |
|--------|--------|---------------|---------|-----------------|
| User-Agent | Low | 30% | None | Low |
| Rate Limiting | Low | 70% | None | Medium |
| Behavioral | Medium | 60% | None | Medium |
| Fingerprinting | High | 85% | High | Low |
| CAPTCHA | High | 95% | Low | Low |
| IP Geolocation | Medium | 65% | High | Medium |
| ML-Based | Very High | 92% | None | Low |

---

## RECOMMENDED FOR HACKATHON

**Add in 30 minutes:**
1. User-Agent bot check
2. Event rate limiting
3. Suspicious flag in database
4. Show count in dashboard

**Result:** 
- No performance impact
- Shows bot awareness
- Judges impressed by thoughtfulness
- Easy to explain in demo

---

## PRODUCTION DEPLOYMENT

For a real product:
1. Combine multiple methods (defense in depth)
2. Use ML model trained on your data
3. Implement gradual escalation (flag → challenge → block)
4. Monitor false positives
5. Privacy: Anonymize immediately after flagging
6. Regular updates to bot patterns

---

## PRIVACY CONSIDERATIONS

⚠️ **Important**: Some detection methods collect sensitive data
- Fingerprinting: Browser uniqueness
- Geolocation: User location
- IP tracking: User behavior patterns
- User-Agent: Device/OS info

**GDPR Compliance**:
- Disclose in privacy policy
- Get explicit consent
- Allow users to opt-out
- Delete data after 30 days
- Use privacy-friendly methods (UA only)

---

## REFERENCES

1. **OWASP Bot Detection**: https://owasp.org/www-community/attacks/bots
2. **Akismet Bot Protection**: Technical implementation model
3. **reCAPTCHA v3**: Google's approach (behavioral scoring)
4. **FingerprintJS**: Industry standard fingerprinting
5. **Cloudflare Bot Management**: Enterprise approach

---

## QUICK DECISION TREE

```
Is this for a hackathon?
  ├─ Yes, minimal scoring
  │   └─ Add User-Agent check only (5 min)
  │
  ├─ Yes, want to impress judges
  │   └─ Add User-Agent + Rate Limit + Dashboard tab (30 min)
  │
  └─ Real product?
      ├─ Low priority
      │   └─ Behavioral analysis only
      │
      ├─ Medium priority
      │   └─ Behavioral + Fingerprinting
      │
      └─ High priority (e-commerce, ads)
          └─ ML + CAPTCHA + IP geo + Rate limiting
```

---

**BOTTOM LINE**: The current hackathon implementation has ZERO bot detection. Adding minimal detection (user-agent check) takes 5 minutes and impresses judges. Adding comprehensive detection takes 1.5-2 hours and significantly slows throughput scoring.

Choose based on your priority: Speed vs. Security.
