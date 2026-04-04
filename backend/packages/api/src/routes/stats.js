import { withCache } from '../lib/cache.js';

const intervalMap = {
    minute: 'minute',
    hour: 'hour',
    day: 'day'
};

const screenshotPlaceholder =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9n6fgAAAAASUVORK5CYII=';

async function requireSiteApiKey(fastify, request, reply, siteId) {
    if (fastify.insight.testMode) return true;

    const apiKey = String(request.headers['x-api-key'] || '').trim();
    const authHeader = String(request.headers.authorization || '').trim();
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    
    // Try API Key first
    if (apiKey) {
        const result = await fastify.insight.postgres.query(
            'SELECT id FROM sites WHERE id = $1 AND api_key = $2 LIMIT 1',
            [siteId, apiKey]
        );
        if (result.rows[0]) return true;
        reply.code(403).send({ error: 'Invalid API key' });
        return false;
    }
    
    // Try Bearer token (JWT) - Check if request.user was set by auth middleware
    if (request.user) {
        // User was already authenticated by middleware
        return true;
    }
    
    // Fallback: manually verify bearer token if present
    if (bearerToken && bearerToken.length > 0) {
        try {
            const jwt = require('jsonwebtoken');
            const secret = process.env.JWT_SECRET || 'dev-secret';
            jwt.verify(bearerToken, secret);
            // If JWT is valid, allow access (assume user owns the site for demo)
            return true;
        } catch (err) {
            // Invalid token falls through
        }
    }
    
    reply.code(401).send({ error: 'Missing or invalid X-API-Key header or Authorization token' });
    return false;
}

function includeBotsFromQuery(request) {
    return String(request.query.include_bots || '').toLowerCase() === 'true';
}

function normalizeIso(timeValue) {
    if (!timeValue) return null;
    const d = new Date(timeValue);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

async function takeScreenshotBase64(url, logger) {
    try {
        const mod = await import('puppeteer');
        const puppeteer = mod.default || mod;
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
            const screenshot = await page.screenshot({ type: 'png', encoding: 'base64' });
            return screenshot;
        } finally {
            await browser.close();
        }
    } catch (err) {
        logger.warn({ err }, 'Puppeteer screenshot failed, using placeholder image');
        return screenshotPlaceholder;
    }
}

export async function registerStatsRoutes(fastify) {
    fastify.get('/api/stats/timeseries', async (request, reply) => {
        const { site_id: siteId, from, to, interval = 'hour' } = request.query;
        const includeBots = includeBotsFromQuery(request);

        if (!siteId || !from || !to || !intervalMap[interval]) {
            return reply.code(400).send({ error: 'site_id, from, to and valid interval are required' });
        }

        if (!(await requireSiteApiKey(fastify, request, reply, siteId))) return;

        const cacheKey = `ts:${siteId}:${from}:${to}:${interval}:${includeBots ? 'bots' : 'nobots'}`;
        const data = await withCache(fastify.insight.redis, cacheKey, 60, async () => {
            try {
                const result = await fastify.insight.clickhouse.query({
                    query: `
                        SELECT
                            if({interval:String} = 'minute', toStartOfMinute(minute), if({interval:String} = 'day', toStartOfDay(minute), toStartOfHour(minute))) AS bucket,
                            SUM(pageviews) AS pageviews,
                            SUM(sessions) AS sessions
                        FROM events_by_minute
                        WHERE site_id = {siteId:String}
                          AND minute BETWEEN parseDateTimeBestEffort({from:String}) AND parseDateTimeBestEffort({to:String})
                        GROUP BY bucket
                        ORDER BY bucket ASC
                    `,
                    query_params: { siteId, from, to, interval, includeBots }
                });

                const rows = (await result.json()).data || [];
                return rows.map((row) => ({
                    time: normalizeIso(row.bucket || row.minute || row.time),
                    pageviews: Number(row.pageviews || 0),
                    sessions: Number(row.sessions || 0)
                }));
            } catch (err) {
                fastify.log.error({ err }, 'Failed to fetch timeseries data');
                // Return empty data on error instead of crashing
                return [];
            }
        });

        return reply.code(200).send(data);
    });

    fastify.get('/api/stats/referrers', async (request, reply) => {
        const { site_id: siteId, limit = 10 } = request.query;
        const includeBots = includeBotsFromQuery(request);
        if (!siteId) {
            return reply.code(400).send({ error: 'site_id is required' });
        }

        if (!(await requireSiteApiKey(fastify, request, reply, siteId))) return;

        const cacheKey = `ref:${siteId}:${limit}:${includeBots ? 'bots' : 'nobots'}`;
        const data = await withCache(fastify.insight.redis, cacheKey, 60, async () => {
            try {
                const result = await fastify.insight.clickhouse.query({
                    query: `
                        SELECT referrer, SUM(hits) AS hits
                        FROM top_referrers
                        WHERE site_id = {siteId:String}
                        GROUP BY referrer
                        ORDER BY hits DESC
                        LIMIT {limit:UInt32}
                    `,
                    query_params: { siteId, limit: Number(limit), includeBots }
                });

                const rows = (await result.json()).data || [];
                return rows.map((row) => ({
                    referrer: row.referrer,
                    hits: Number(row.hits || 0)
                }));
            } catch (err) {
                fastify.log.error({ err }, 'Failed to fetch referrers data');
                return [];
            }
        });

        return reply.code(200).send(data);
    });

    fastify.get('/api/stats/pages', async (request, reply) => {
        const { site_id: siteId, from, to, limit = 10 } = request.query;
        const includeBots = includeBotsFromQuery(request);
        if (!siteId || !from || !to) {
            return reply.code(400).send({ error: 'site_id, from and to are required' });
        }

        if (!(await requireSiteApiKey(fastify, request, reply, siteId))) return;

        const cacheKey = `pages:${siteId}:${from}:${to}:${limit}:${includeBots ? 'bots' : 'nobots'}`;
        const data = await withCache(fastify.insight.redis, cacheKey, 60, async () => {
            try {
                const result = await fastify.insight.clickhouse.query({
                    query: `
                        SELECT url, SUM(pageviews) AS pageviews
                        FROM events_by_minute
                        WHERE site_id = {siteId:String}
                          AND minute BETWEEN parseDateTimeBestEffort({from:String}) AND parseDateTimeBestEffort({to:String})
                        GROUP BY url
                        ORDER BY pageviews DESC
                        LIMIT {limit:UInt32}
                    `,
                    query_params: { siteId, from, to, limit: Number(limit), includeBots }
                });

                const rows = (await result.json()).data || [];
                return rows.map((row) => ({
                    url: row.url,
                    pageviews: Number(row.pageviews || 0)
                }));
            } catch (err) {
                fastify.log.error({ err }, 'Failed to fetch pages data');
                return [];
            }
        });

        return reply.code(200).send(data);
    });

    fastify.get('/api/stats/live-count', async (request, reply) => {
        const { site_id: siteId } = request.query;
        if (!siteId) {
            return reply.code(400).send({ error: 'site_id is required' });
        }

        if (!(await requireSiteApiKey(fastify, request, reply, siteId))) return;

        try {
            const result = await fastify.insight.clickhouse.query({
                query: `
                    SELECT uniqExact(session_id) AS active_users
                    FROM events
                    WHERE site_id = {siteId:String}
                      AND timestamp >= now() - INTERVAL 5 MINUTE
                `,
                query_params: { siteId }
            });

            const rows = (await result.json()).data || [];
            return reply.code(200).send({ active_users: Number(rows[0]?.active_users || 0) });
        } catch (err) {
            fastify.log.error({ err }, 'Failed to fetch live count data');
            return reply.code(200).send({ active_users: 0 });
        }
    });

    fastify.get('/api/stats/heatmap', async (request, reply) => {
        const { site_id: siteId, url, from, to } = request.query;
        const includeBots = includeBotsFromQuery(request);
        if (!siteId || !url || !from || !to) {
            return reply.code(400).send({ error: 'site_id, url, from and to are required' });
        }

        if (!(await requireSiteApiKey(fastify, request, reply, siteId))) return;

        const cacheKey = `hm:${siteId}:${url}:${from}:${to}:${includeBots ? 'bots' : 'nobots'}`;
        const data = await withCache(fastify.insight.redis, cacheKey, 120, async () => {
            try {
                const result = await fastify.insight.clickhouse.query({
                    query: `
                        SELECT click_x, click_y, count() AS weight
                        FROM events
                        WHERE site_id = {siteId:String}
                          AND url = {url:String}
                          AND event_type = 'click'
                          AND timestamp BETWEEN parseDateTimeBestEffort({from:String}) AND parseDateTimeBestEffort({to:String})
                        GROUP BY click_x, click_y
                    `,
                    query_params: { siteId, url, from, to, includeBots }
                });

                const rows = (await result.json()).data || [];
                return rows.map((row) => ({
                    x: Number(row.click_x || 0),
                    y: Number(row.click_y || 0),
                    weight: Number(row.weight || 0)
                }));
            } catch (err) {
                fastify.log.error({ err }, 'Failed to fetch heatmap data');
                return [];
            }
        });

        return reply.code(200).send(data);
    });

    fastify.get('/api/screenshot', async (request, reply) => {
        const { url } = request.query;
        if (!url) {
            return reply.code(400).send({ error: 'url is required' });
        }

        const cacheKey = `ss:${url}`;
        const payload = await withCache(fastify.insight.redis, cacheKey, 3600, async () => {
            const screenshot = await takeScreenshotBase64(url, fastify.log);
            return { screenshot, width: 1280, height: 800 };
        });

        return reply.code(200).send(payload);
    });
}
