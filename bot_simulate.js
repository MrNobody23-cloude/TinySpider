/**
 * Insight-OS Bot Simulator
 * ────────────────────────
 * Generates various types of "bot" traffic to test the detection engine.
 * 
 * Usage: node bot_simulate.js
 */

const http = require('http');

const API_TRACK = 'http://localhost:3001/track';

const BOT_TYPES = [
    {
        name: 'Googlebot (Crawl)',
        ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        behavior: 'rapid_pageviews',
        count: 10
    },
    {
        name: 'Suspicious Scraper (Python)',
        ua: 'python-requests/2.25.1',
        behavior: 'high_rate',
        count: 60
    },
    {
        name: 'Headless Browser (Puppeteer)',
        ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/91.0.4472.114 Safari/537.36',
        behavior: 'robotic_clicks',
        count: 15
    },
    {
        name: 'Human Guest (Verified)',
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        behavior: 'normal',
        count: 3
    }
];

function sendEvent(payload) {
    const data = JSON.stringify(payload);
    const url = new URL(API_TRACK);
    
    const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            'User-Agent': payload.ua
        }
    }, (res) => {
        // Silent
    });
    
    req.on('error', (e) => console.error(`[Error] Connection refused to 3001. Ensure backend is running.`));
    req.write(data);
    req.end();
}

async function simulate() {
    console.log('\n🚀 Starting Bot Intelligence Simulation...');
    console.log('Sending patterned traffic to http://localhost:3001/track\n');

    for (const bot of BOT_TYPES) {
        console.log(`[Simulating] ${bot.name}...`);
        const sessionId = `sim-session-${Math.random().toString(36).substring(7)}`;

        for (let i = 0; i < bot.count; i++) {
            const payload = {
                type: 'pageview',
                sessionId: sessionId,
                page: '/',
                referrer: 'direct',
                ua: bot.ua,
                ts: Date.now()
            };

            if (bot.behavior === 'robotic_clicks') {
                payload.type = 'click';
                payload.x = 100; // Constant X (Robotic)
                payload.y = 100; // Constant Y (Robotic)
            }

            sendEvent(payload);
            
            // Artificial delay (very small for bots, larger for humans)
            const delay = bot.behavior === 'normal' ? 1000 : 50;
            await new Promise(r => setTimeout(r, delay));
        }
    }

    console.log('\n✅ Simulation complete. Check your dashboard "Bots" tab.');
}

simulate();
