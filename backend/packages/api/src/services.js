import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';

import { createClient } from '@clickhouse/client';
import { Reader } from '@maxmind/geoip2-node';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { Queue } from 'bullmq';

import { createEventWriterWorker } from './workers/event-writer.js';

export let clickhouseClient = null;
export let redisClient = null;
export let postgresClient = null;

function createMemoryClickHouse() {
    const events = [];

    return {
        events,
        async insert({ values }) {
            events.push(...values.map((v) => ({ ...v })));
        },
        async query({ query, query_params }) {
            const siteId = query_params?.siteId;
            const from = query_params?.from;
            const to = query_params?.to;
            const includeBots = query_params?.includeBots === true || query_params?.includeBots === 'true';
            const fromMs = from ? Date.parse(from) : null;
            const toMs = to ? Date.parse(to) : null;

            const filtered = events.filter((e) => {
                if (siteId && e.site_id !== siteId) return false;
                if (!includeBots && e.is_bot) return false;
                const ts = Date.parse(String(e.timestamp).replace(' ', 'T') + 'Z');
                if (Number.isFinite(fromMs) && ts < fromMs) return false;
                if (Number.isFinite(toMs) && ts > toMs) return false;
                return true;
            });

            if (query.includes('SELECT is_bot FROM events')) {
                const row = [...events].reverse().find((e) => e.site_id === siteId);
                return { json: async () => ({ data: row ? [{ is_bot: !!row.is_bot }] : [] }) };
            }
            if (query.includes('SELECT click_x, click_y FROM events')) {
                const row = [...events].reverse().find((e) => e.event_type === 'click');
                return { json: async () => ({ data: row ? [{ click_x: row.click_x, click_y: row.click_y }] : [] }) };
            }
            if (query.includes('FROM events_by_minute') && query.includes('GROUP BY bucket')) {
                const bucketMap = new Map();
                const interval = query_params?.interval || 'hour';

                for (const event of filtered) {
                    if (event.event_type !== 'pageview') continue;
                    const d = new Date(String(event.timestamp).replace(' ', 'T') + 'Z');
                    if (interval === 'minute') {
                        d.setUTCSeconds(0, 0);
                    } else if (interval === 'day') {
                        d.setUTCHours(0, 0, 0, 0);
                    } else {
                        d.setUTCMinutes(0, 0, 0);
                    }

                    const key = d.toISOString();
                    if (!bucketMap.has(key)) {
                        bucketMap.set(key, { bucket: key, pageviews: 0, sessions: new Set() });
                    }

                    const row = bucketMap.get(key);
                    row.pageviews += 1;
                    if (event.session_id) row.sessions.add(event.session_id);
                }

                const data = [...bucketMap.values()]
                    .sort((a, b) => a.bucket.localeCompare(b.bucket))
                    .map((row) => ({
                        bucket: row.bucket,
                        pageviews: row.pageviews,
                        sessions: row.sessions.size
                    }));

                return { json: async () => ({ data }) };
            }
            if (query.includes('FROM top_referrers')) {
                const counts = new Map();
                for (const event of filtered) {
                    if (!event.referrer) continue;
                    counts.set(event.referrer, (counts.get(event.referrer) || 0) + 1);
                }
                const limit = Number(query_params?.limit || 10);
                const data = [...counts.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, limit)
                    .map(([referrer, hits]) => ({ referrer, hits }));
                return { json: async () => ({ data }) };
            }
            if (query.includes('GROUP BY url') && query.includes('SUM(pageviews)')) {
                const counts = new Map();
                for (const event of filtered) {
                    if (event.event_type !== 'pageview') continue;
                    counts.set(event.url, (counts.get(event.url) || 0) + 1);
                }
                const limit = Number(query_params?.limit || 10);
                const data = [...counts.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, limit)
                    .map(([url, pageviews]) => ({ url, pageviews }));
                return { json: async () => ({ data }) };
            }
            if (query.includes('uniqExact(session_id) AS active_users')) {
                const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
                const sessions = new Set();
                for (const event of events) {
                    if (event.site_id !== siteId || event.is_bot) continue;
                    const ts = Date.parse(String(event.timestamp).replace(' ', 'T') + 'Z');
                    if (ts >= fiveMinutesAgo && event.session_id) {
                        sessions.add(event.session_id);
                    }
                }
                return { json: async () => ({ data: [{ active_users: sessions.size }] }) };
            }
            if (query.includes("event_type = 'click'") && query.includes('GROUP BY click_x, click_y')) {
                const targetUrl = query_params?.url;
                const counts = new Map();
                for (const event of filtered) {
                    if (event.event_type !== 'click' || event.url !== targetUrl) continue;
                    const key = `${event.click_x}:${event.click_y}`;
                    counts.set(key, (counts.get(key) || 0) + 1);
                }
                const data = [...counts.entries()].map(([key, weight]) => {
                    const [x, y] = key.split(':').map(Number);
                    return { click_x: x, click_y: y, weight };
                });
                return { json: async () => ({ data }) };
            }
            if (query.includes('uniqExact(session_id) AS visitors') && query.includes('url = {url:String}')) {
                const targetUrl = query_params?.url;
                const sessions = new Set();
                for (const event of filtered) {
                    if (event.url === targetUrl && event.session_id) {
                        sessions.add(event.session_id);
                    }
                }
                return { json: async () => ({ data: [{ visitors: sessions.size }] }) };
            }
            if (query.includes('minIf(timestamp, url = {stepN:String})')) {
                const stepN = query_params?.stepN;
                const stepN1 = query_params?.stepN1;
                const bySession = new Map();
                for (const event of filtered) {
                    if (!event.session_id) continue;
                    if (!bySession.has(event.session_id)) bySession.set(event.session_id, []);
                    bySession.get(event.session_id).push(event);
                }

                let converted = 0;
                for (const sessionEvents of bySession.values()) {
                    let tN = null;
                    let tN1 = null;
                    for (const event of sessionEvents) {
                        const ts = Date.parse(String(event.timestamp).replace(' ', 'T') + 'Z');
                        if (event.url === stepN && (tN == null || ts < tN)) tN = ts;
                        if (event.url === stepN1 && (tN1 == null || ts < tN1)) tN1 = ts;
                    }
                    if (tN != null && tN1 != null && tN1 > tN) {
                        converted += 1;
                    }
                }

                return { json: async () => ({ data: [{ converted }] }) };
            }
            return { json: async () => ({ data: [] }) };
        }
    };
}

function createMemoryRedis() {
    const store = new Map();

    return {
        async get(key) {
            const row = store.get(key);
            if (!row) return null;
            if (row.expiresAt <= Date.now()) {
                store.delete(key);
                return null;
            }
            return row.value;
        },
        async setex(key, ttlSeconds, value) {
            store.set(key, {
                value,
                expiresAt: Date.now() + Number(ttlSeconds) * 1000
            });
            return 'OK';
        },
        async disconnect() { }
    };
}

function createMemoryPostgres() {
    const users = [];
    const funnels = [];
    const sites = [{ id: 'test', api_key: 'test-api-key', name: 'Test Site', domain: 'example.com' }];

    return {
        async query(text, values = []) {
            const q = text.trim().toLowerCase().replace(/\s+/g, ' ');

            // Register user
            if (q.startsWith('insert into users')) {
                const existing = users.find((u) => u.email === values[0]);
                if (existing) {
                    const err = new Error('duplicate key');
                    err.code = '23505';
                    throw err;
                }
                const user = {
                    id: randomUUID(),
                    email: values[0],
                    password_hash: values[1],
                    full_name: values[2] || '',
                    company_name: values[3] || '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    last_login: null,
                    is_active: true,
                    reset_token: null,
                    reset_token_expiry: null,
                    failed_login_count: 0,
                    locked_until: null
                };
                users.push(user);
                return { rows: [user] };
            }

            // Login user lookup (by email)
            if (q.includes('from users where email') && q.includes('password_hash')) {
                const user = users.find((u) => u.email === values[0]);
                return { rows: user ? [user] : [] };
            }

            // Get user by ID (profile)
            if (q.startsWith('select') && q.includes('from users where id')) {
                const user = users.find((u) => u.id === values[0]);
                return { rows: user ? [user] : [] };
            }

            // Update user fields
            if (q.startsWith('update users set')) {
                const userId = values[values.length - 1];
                const user = users.find((u) => u.id === userId);
                if (!user) return { rows: [] };

                // Handle different update patterns
                if (q.includes('failed_login_count = $1')) {
                    user.failed_login_count = values[0];
                    user.locked_until = values[1];
                } else if (q.includes('last_login = now()')) {
                    user.failed_login_count = 0;
                    user.locked_until = null;
                    user.last_login = new Date().toISOString();
                } else if (q.includes('password_hash = $1') && q.includes('reset_token = null')) {
                    user.password_hash = values[0];
                    user.reset_token = null;
                    user.reset_token_expiry = null;
                    user.failed_login_count = 0;
                    user.locked_until = null;
                    user.updated_at = new Date().toISOString();
                } else if (q.includes('password_hash')) {
                    user.password_hash = values[0];
                    user.updated_at = new Date().toISOString();
                } else if (q.includes('reset_token')) {
                    user.reset_token = values[0];
                    user.reset_token_expiry = values[1];
                } else if (q.includes('is_active')) {
                    user.is_active = false;
                    user.updated_at = new Date().toISOString();
                } else if (q.includes('full_name') || q.includes('company_name')) {
                    let idx = 0;
                    if (q.includes('full_name')) user.full_name = values[idx++];
                    if (q.includes('company_name')) user.company_name = values[idx++];
                    user.updated_at = new Date().toISOString();
                }

                return { rows: [user] };
            }

            // Reset password lookup by token
            if (q.includes('reset_token') && q.includes('reset_token_expiry')) {
                const user = users.find((u) =>
                    u.reset_token === values[0] &&
                    u.reset_token_expiry &&
                    new Date(u.reset_token_expiry) > new Date() &&
                    u.is_active
                );
                return { rows: user ? [user] : [] };
            }

            // Funnels
            if (q.startsWith('insert into funnels')) {
                const funnel = {
                    id: randomUUID(),
                    site_id: values[0],
                    name: values[1],
                    steps: values[2]
                };
                funnels.push(funnel);
                return { rows: [{ id: funnel.id, name: funnel.name, steps: funnel.steps }] };
            }

            if (q.startsWith('select id, site_id, name, steps from funnels where id')) {
                const funnel = funnels.find((f) => f.id === values[0]);
                return { rows: funnel ? [funnel] : [] };
            }

            if (q.startsWith('select id from sites where id = $1 and api_key = $2')) {
                const site = sites.find((s) => s.id === values[0] && s.api_key === values[1]);
                return { rows: site ? [{ id: site.id }] : [] };
            }

            return { rows: [] };
        },
        async end() { }
    };
}

export async function createServices({ logger, testMode = false }) {
    const salt = process.env.IP_HASH_SALT || 'dev-salt';

    if (testMode) {
        const emitter = new EventEmitter();
        const clickhouse = createMemoryClickHouse();
        const redis = createMemoryRedis();
        const postgres = createMemoryPostgres();

        clickhouseClient = clickhouse;
        redisClient = redis;
        postgresClient = postgres;

        return {
            testMode: true,
            clickhouse,
            clickhouseClient: clickhouse,
            postgres,
            postgresClient: postgres,
            redis,
            redisClient: redis,
            hashIp: (ip) => createHash('sha256').update(`${ip}${salt}`).digest('hex'),
            async lookupGeo() {
                return { country: 'US', city: 'Testville', lat: 37.7749, lon: -122.4194 };
            },
            async enqueueEvent(event) {
                setTimeout(async () => {
                    await clickhouse.insert({ values: [event] });
                }, 0);
            },
            async publishLive(payload) {
                emitter.emit('live-events', JSON.stringify(payload));
            },
            subscribeLive(onMessage) {
                const listener = (msg) => onMessage(msg);
                emitter.on('live-events', listener);
                return async () => emitter.off('live-events', listener);
            },
            async close() { }
        };
    }

    const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    const clickhouse = createClient({
        url: process.env.CLICKHOUSE_URL || 'http://127.0.0.1:8123',
        username: process.env.CLICKHOUSE_USERNAME || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || '',
        database: process.env.CLICKHOUSE_DATABASE || 'default'
    });

    const postgres = new Pool({
        host: process.env.POSTGRES_HOST || '127.0.0.1',
        port: Number(process.env.POSTGRES_PORT || 5432),
        database: process.env.POSTGRES_DB || 'insightdb',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres'
    });

    const queueConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
        maxRetriesPerRequest: null
    });

    const queue = new Queue('events', { connection: queueConnection });
    const writer = createEventWriterWorker({ connection: queueConnection, clickhouse, logger });

    let geoReader = null;
    const mmdbPath = process.env.MAXMIND_DB_PATH || process.env.GEOIP_MMDB_PATH;
    if (mmdbPath) {
        try {
            geoReader = await Reader.open(mmdbPath);
        } catch (err) {
            logger.warn({ err }, 'GeoIP MMDB not loaded, continuing without location enrichment');
        }
    }

    clickhouseClient = clickhouse;
    redisClient = redis;
    postgresClient = postgres;

    return {
        testMode: false,
        clickhouse,
        clickhouseClient: clickhouse,
        postgres,
        postgresClient: postgres,
        redis,
        redisClient: redis,
        hashIp: (ip) => createHash('sha256').update(`${ip}${salt}`).digest('hex'),
        async lookupGeo(ip) {
            if (!geoReader || !ip) return { country: '', city: '', lat: null, lon: null };
            try {
                const res = geoReader.city(ip);
                return {
                    country: res?.country?.isoCode || '',
                    city: res?.city?.names?.en || '',
                    lat: res?.location?.latitude ?? null,
                    lon: res?.location?.longitude ?? null
                };
            } catch {
                return { country: '', city: '', lat: null, lon: null };
            }
        },
        async enqueueEvent(event) {
            await queue.add('event', event, {
                removeOnComplete: true,
                removeOnFail: 500
            });
        },
        async publishLive(payload) {
            await redis.publish('live-events', JSON.stringify(payload));
        },
        subscribeLive(onMessage) {
            const sub = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
            sub.subscribe('live-events');
            sub.on('message', (_channel, message) => onMessage(message));
            return async () => {
                await sub.unsubscribe('live-events');
                sub.disconnect();
            };
        },
        async close() {
            await writer.close();
            await queue.close();
            queueConnection.disconnect();
            redis.disconnect();
            await postgres.end();
            await clickhouse.close();
        }
    };
}
