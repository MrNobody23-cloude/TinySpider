/**
 * Insight-OS Analytics Backend
 * ─────────────────────────────
 * Self-hosted, privacy-first analytics server.
 * Stores data in-memory (no DB required for demo).
 * 
 * Endpoints:
 *   POST /track              – receive events from tracker.js
 *   GET  /api/overview       – KPI totals
 *   GET  /api/traffic        – time-series pageviews (last 14 days)
 *   GET  /api/pages          – top pages ranked by views
 *   GET  /api/sessions       – currently active sessions
 *   GET  /api/referrers      – referrer breakdown
 *   WS   ws://localhost:3001 – real-time push to dashboard
 */

const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const path       = require('path');
const fs         = require('fs');
const { WebSocketServer } = require('ws');
const { UAParser } = require('ua-parser-js');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

const PORT = 3001;

// ── CORS: allow dashboard (localhost:8080) and demo site (localhost:8081) ──
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ── Serve tracker.js so <script src="http://localhost:3001/tracker.js"> works ──
app.get('/tracker.js', (req, res) => {
    const filePath = path.join(__dirname, '..', 'frontend', 'tracker.js');
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(filePath).pipe(res);
});

// ── Bot detection patterns ────────────────────────────────────────────────
const BOT_PATTERNS = [
    'googlebot', 'bingbot', 'slurp', 'baidu', 'yandex',
    'facebookexternalhit', 'twitterbot', 'linkedinbot', 'whatsapp',
    'pingdom', 'uptimerobot', 'datadog', 'newrelic',
    'curl', 'wget', 'python', 'scrapy', 'httpie', 'postman',
    'bot', 'crawler', 'spider', 'scraper', 'headless', 'phantomjs', 'selenium'
];

function isBotUA(ua) {
    if (!ua) return false;
    const lower = ua.toLowerCase();
    return BOT_PATTERNS.some(p => lower.includes(p));
}

function calculateVariance(arr) {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / arr.length;
}

function getSuspicionScore(sessionId) {
    const events = store.pageviews.filter(p => p.sessionId === sessionId);
    const clicks = store.clicks.filter(c => c.page === events[events.length-1]?.page); // approximate
    let score = 0;

    // 1. High frequency check
    if (events.length > 50) score += 20;

    // 2. Click consistency
    const clickTimes = clicks.map(c => c.ts);
    if (clickTimes.length > 10) {
        const diffs = [];
        for(let i=1; i<clickTimes.length; i++) diffs.push(clickTimes[i] - clickTimes[i-1]);
        if (calculateVariance(diffs) < 100) score += 40; // Too robotic
    }

    // 3. No scroll / interaction variety
    if (events.length > 10 && clicks.length === 0) score += 30;

    return Math.min(score, 100);
}

// ─────────────────────────────────────────────────
// IN-MEMORY STORE
// ─────────────────────────────────────────────────
const store = {
    // Array of all pageview events
    // { id, sessionId, page, referrer, ts, browser, os, timeOnPage }
    pageviews: [],

    // Active sessions map: sessionId → session object
    sessions: new Map(),

    // Unique visitors (Set of sessionIds per day): 'YYYY-MM-DD' → Set<sessionId>
    dailyVisitors: new Map(),

    // Total time-on-page per page: page → [seconds]
    pageTimes: new Map(),

    // Array of all click events
    // { x, y, page, ts }
    clicks: [],
};

let eventIdCounter = 0;

// ── Helpers ────────────────────────────────────────────────────────────────

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function formatDate(d = new Date()) {
    return d.toISOString().slice(0, 10);
}

function getLast14Days() {
    const days = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(formatDate(d));
    }
    return days;
}

function parseUA(uaString = '') {
    const parser = new UAParser(uaString);
    const r      = parser.getResult();
    return {
        browser: r.browser.name || 'Unknown',
        os:      r.os.name      || 'Unknown',
    };
}

function broadcast(data) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(msg);
    });
}

// Clean up sessions inactive for > 30 minutes
function pruneInactiveSessions() {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [id, session] of store.sessions) {
        if (session.lastActive < cutoff) store.sessions.delete(id);
    }
}
setInterval(pruneInactiveSessions, 60_000);

// ─────────────────────────────────────────────────
// POST /track  — main event ingestion endpoint
// ─────────────────────────────────────────────────
app.post('/track', (req, res) => {
    const { type, sessionId, visitorId, page, referrer, timeOnPage, ua } = req.body;
    if (!type || !sessionId) return res.status(200).json({ ok: false });

    const now = Date.now();
    const uaString = ua || req.headers['user-agent'] || '';
    const parsed = parseUA(uaString);

    // ── PROACTIVE BOT IDENTIFICATION ────────────────────────────────────────
    const isBotByUA = isBotUA(uaString);
    let isBotByBehavior = false;
    
    // Check speed (more than 1 hit in 500ms = bot)
    const sessionHistory = store.pageviews.filter(p => p.sessionId === sessionId);
    if (sessionHistory.length > 0) {
        const lastView = sessionHistory[sessionHistory.length - 1];
        if (now - lastView.ts < 500) isBotByBehavior = true;
    }

    // Persist bot status immediately
    if (!store.sessions.has(sessionId)) {
        store.sessions.set(sessionId, { views: 0, lastSeen: now, ua: uaString, isBot: isBotByUA });
    }
    const sess = store.sessions.get(sessionId);
    const finalIsBot = isBotByUA || isBotByBehavior || (sess ? sess.isBot : false);
    if (sess && finalIsBot) sess.isBot = true;

    if (finalIsBot) {
        console.log(`[BOT] Flagged ${type} from ${sessionId.slice(0,8)} (UA:${isBotByUA}, Speed:${isBotByBehavior})`);
    }

    // ── Handle pageview ─────────────────────────────────────────────────────
    if (type === 'pageview') {
        const pv = {
            id:        ++eventIdCounter,
            sessionId,
            page:      page || '/',
            referrer:  referrer || 'direct',
            ts:        now,
            browser:   parsed.browser,
            os:        parsed.os,
            timeOnPage: 0,
            isBot:     finalIsBot,
        };
        store.pageviews.push(pv);

        // Track unique visitors using persistent visitorId (from localStorage)
        // Falls back to sessionId if visitorId wasn’t sent (e.g. older tracker)
        const vid = visitorId || sessionId;
        const day = todayKey();
        if (!store.dailyVisitors.has(day)) store.dailyVisitors.set(day, new Set());
        store.dailyVisitors.get(day).add(vid);

        // Track all-time unique visitors
        if (!store.allTimeVisitors) store.allTimeVisitors = new Set();
        store.allTimeVisitors.add(vid);

        // Upsert session
        if (!store.sessions.has(sessionId)) {
            store.sessions.set(sessionId, {
                id:         sessionId,
                startTime:  now,
                lastActive: now,
                page,
                referrer:   referrer || 'direct',
                browser:    parsed.browser,
                os:         parsed.os,
                views:      1,
            });
        } else {
            const s = store.sessions.get(sessionId);
            s.lastActive = now;
            s.page = page;
            s.views++;
        }

        // Broadcast real-time event to dashboard
        broadcast({
            type:        'pageview',
            page,
            referrer:    referrer || 'direct',
            sessionId,
            liveCount:   store.sessions.size,
            ts:          now,
        });
    }

    // ── Handle timeonpage update ─────────────────────────────────────────────
    if (type === 'timeonpage') {
        const sec = Math.min(Number(timeOnPage) || 0, 3600); // cap at 1hr
        // Update last pageview for this session
        const pvs = store.pageviews.filter(p => p.sessionId === sessionId);
        if (pvs.length) pvs[pvs.length - 1].timeOnPage = sec;

        if (!store.pageTimes.has(page)) store.pageTimes.set(page, []);
        store.pageTimes.get(page).push(sec);

        if (store.sessions.has(sessionId)) {
            store.sessions.get(sessionId).lastActive = now;
        }
    }

    // ── Handle click update ──────────────────────────────────────────────────
    if (type === 'click') {
        // FILTER: Do not count clicks from the dashboard itself (port 8080)
        const origin = req.headers.origin || '';
        if (origin.includes(':8080')) {
            return res.status(200).json({ ok: true, ignored: 'dashboard_origin' });
        }

        const { x, y, pageW, pageH, viewportW } = req.body;
        if (x !== undefined && y !== undefined) {
            const clickEvent = { x, y, page: page || '/', ts: now, pageW: pageW || null, pageH: pageH || null, viewportW: viewportW || null };
            store.clicks.push(clickEvent);

            if (store.clicks.length > 10000) store.clicks.shift();

            broadcast({
                type: 'click',
                page: page || '/',
                x, y,
                pageW: pageW || null,
                pageH: pageH || null,
                viewportW: viewportW || null,
                ts: now
            });
        }
    }

    res.status(200).json({ ok: true });
});

// ─────────────────────────────────────────────────
// GET /api/overview  — KPI totals
// ─────────────────────────────────────────────────
app.get('/api/overview', (req, res) => {
    // FILTER: Main stats must NOT include bots
    const humanViews = store.pageviews.filter(pv => !pv.isBot);
    const totalPageviews = humanViews.length;

    // Unique visitors (exclude bots)
    const humanVids = new Set(humanViews.map(p => p.visitorId || p.sessionId));
    const totalVisitors = humanVids.size;

    // Bounce rate: sessions with only 1 pageview (exclude bots)
    const viewsPerSession = {};
    humanViews.forEach(pv => {
        viewsPerSession[pv.sessionId] = (viewsPerSession[pv.sessionId] || 0) + 1;
    });
    const sessionList = Object.values(viewsPerSession);
    const bounced     = sessionList.filter(v => v === 1).length;
    const bounceRate  = sessionList.length
        ? Math.round((bounced / sessionList.length) * 100)
        : 0;

    // Avg session duration (exclude bots)
    const allTimes = humanViews.map(p => p.timeOnPage).filter(t => t > 0);
    const avgTime  = allTimes.length
        ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length)
        : 0;

    // Live Count (exclude suspected bots)
    let liveCount = 0;
    store.sessions.forEach((s, id) => {
        if (!s.isBot && getSuspicionScore(id) < 40) liveCount++;
    });

    res.json({ totalVisitors, totalPageviews, bounceRate, avgTime, liveCount });
});

// ─────────────────────────────────────────────────
// GET /api/traffic  — time-series (last 14 days)
// ─────────────────────────────────────────────────
app.get('/api/traffic', (req, res) => {
    const days    = getLast14Days();
    const counts  = {};
    days.forEach(d => { counts[d] = 0; });

    store.pageviews.forEach(pv => {
        const day = formatDate(new Date(pv.ts));
        if (counts[day] !== undefined) counts[day]++;
    });

    res.json({
        labels: days.map(d => {
            const date = new Date(d + 'T00:00:00');
            return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
        }),
        data: days.map(d => counts[d]),
    });
});

// ─────────────────────────────────────────────────
// GET /api/pages  — top pages
// ─────────────────────────────────────────────────
app.get('/api/pages', (req, res) => {
    const pageCounts = {};
    store.pageviews.forEach(pv => {
        pageCounts[pv.page] = (pageCounts[pv.page] || 0) + 1;
    });

    const sorted = Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    res.json({
        labels: sorted.map(([p]) => p),
        data:   sorted.map(([, c]) => c),
    });
});

// ─────────────────────────────────────────────────
// GET /api/sessions  — active sessions
// ─────────────────────────────────────────────────
app.get('/api/sessions', (req, res) => {
    pruneInactiveSessions();
    const list = [...store.sessions.values()]
        .sort((a, b) => b.lastActive - a.lastActive)
        .slice(0, 20)
        .map(s => ({
            id:       s.id.slice(0, 8),
            page:     s.page,
            referrer: s.referrer,
            browser:  s.browser,
            views:    s.views,
            duration: Math.round((Date.now() - s.startTime) / 1000),
        }));

    res.json({ count: store.sessions.size, sessions: list });
});

// ─────────────────────────────────────────────────
// GET /api/referrers  — referrer breakdown
// ─────────────────────────────────────────────────
app.get('/api/referrers', (req, res) => {
    const refs = {};
    store.pageviews.forEach(pv => {
        let ref = pv.referrer || 'direct';
        // Simplify to domain
        try {
            if (ref && ref !== 'direct') {
                ref = new URL(ref).hostname.replace('www.', '');
            }
        } catch (_) { ref = 'direct'; }
        refs[ref] = (refs[ref] || 0) + 1;
    });

    const sorted = Object.entries(refs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    res.json({
        labels: sorted.map(([r]) => r),
        data:   sorted.map(([, c]) => c),
    });
});

// ─────────────────────────────────────────────────
// GET /api/heatmaps  — get click coordinates for a page
// ─────────────────────────────────────────────────
app.get('/api/heatmaps', (req, res) => {
    const page = req.query.page || '/';
    const pageClicks = store.clicks.filter(c => c.page === page);

    // Find the most recent click that includes page dimensions
    const lastWithDims = [...pageClicks].reverse().find(c => c.pageW && c.pageH);

    res.json({
        clicks: pageClicks.map(c => ({ x: c.x, y: c.y })),
        pageW:    lastWithDims?.pageW    || null,
        pageH:    lastWithDims?.pageH    || null,
        viewportW: lastWithDims?.viewportW || null,
    });
});

// ─────────────────────────────────────────────────
// GET /api/realtime  — snapshot for realtime chart
// ─────────────────────────────────────────────────
app.get('/api/realtime', (req, res) => {
    // Last 60 seconds, bucket by 2s
    const now    = Date.now();
    const window = 60_000;
    const bucket = 2_000;
    const bins   = Array(30).fill(0);
    const labels = bins.map((_, i) => `-${(29 - i) * 2}s`);

    store.pageviews.forEach(pv => {
        const age = now - pv.ts;
        if (age <= window) {
            const idx = Math.floor((window - age) / bucket);
            if (idx >= 0 && idx < 30) bins[idx]++;
        }
    });

    res.json({ labels, data: bins });
});

// ─────────────────────────────────────────────────
// GET /api/bot-stats — bot detection intelligence
// ─────────────────────────────────────────────────
app.get('/api/bot-stats', (req, res) => {
    const suspiciousSessions = [];
    const now = Date.now();
    
    store.sessions.forEach((s, id) => {
        const score = getSuspicionScore(id);
        const isBot = isBotUA(s.userAgent || '');
        if (score > 30 || isBot) {
            suspiciousSessions.push({
                sessionId: id.slice(0, 8),
                userAgent: s.userAgent || 'Unknown',
                eventCount: s.views,
                score: isBot ? 100 : score,
                risk: isBot ? 'HIGH' : (score > 60 ? 'HIGH' : 'MEDIUM'),
                indicators: [
                    isBot ? 'Bot UA Detected' : null,
                    score > 30 ? 'Robotic Behavior' : null,
                    s.views > 50 ? 'High Rate' : null
                ].filter(Boolean)
            });
        }
    });

    res.json({
        summary: {
            botCount: suspiciousSessions.filter(s => s.risk === 'HIGH').length,
            suspiciousCount: suspiciousSessions.length,
            humanCount: Math.max(0, store.sessions.size - suspiciousSessions.length)
        },
        sessions: suspiciousSessions.slice(0, 10)
    });
});

// ─────────────────────────────────────────────────
// WebSocket — ping/pong keep-alive
// ─────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
    const origin = req.headers.origin || 'unknown';
    console.log(`[WS] Client connected from ${origin}. Total: ${wss.clients.size}`);
    console.log('[WS] Client connected. Total:', wss.clients.size);

    // Send current state immediately on connect
    ws.send(JSON.stringify({ type: 'connected', liveCount: store.sessions.size }));

    ws.on('close', () => {
        console.log('[WS] Client disconnected. Total:', wss.clients.size);
    });
});

// ─────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`\n🚀 Insight-OS backend running at http://localhost:${PORT}`);
    console.log(`   WebSocket live at  ws://localhost:${PORT}`);
    console.log(`\n   Endpoints:`);
    console.log(`   POST http://localhost:${PORT}/track`);
    console.log(`   GET  http://localhost:${PORT}/api/overview`);
    console.log(`   GET  http://localhost:${PORT}/api/traffic`);
    console.log(`   GET  http://localhost:${PORT}/api/pages`);
    console.log(`   GET  http://localhost:${PORT}/api/sessions`);
    console.log(`   GET  http://localhost:${PORT}/api/referrers`);
    console.log(`   GET  http://localhost:${PORT}/api/realtime`);
    console.log('\n   Embed on your demo site:');
    console.log(`   <script src="http://localhost:3001/tracker.js"></script>\n`);
});
