import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';

import { createClient } from '@clickhouse/client';
import { Reader } from '@maxmind/geoip2-node';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { Queue } from 'bullmq';

import { createEventWriterWorker } from './workers/event-writer.js';

function createMemoryClickHouse() {
    const events = [];

    return {
        events,
        async insert({ values }) {
            events.push(...values.map((v) => ({ ...v })));
        },
        async query({ query, query_params }) {
            const siteId = query_params?.siteId;
            if (query.includes('SELECT is_bot FROM events')) {
                const row = [...events].reverse().find((e) => e.site_id === siteId);
                return { json: async () => ({ data: row ? [{ is_bot: !!row.is_bot }] : [] }) };
            }
            if (query.includes('SELECT click_x, click_y FROM events')) {
                const row = [...events].reverse().find((e) => e.event_type === 'click');
                return { json: async () => ({ data: row ? [{ click_x: row.click_x, click_y: row.click_y }] : [] }) };
            }
            return { json: async () => ({ data: [] }) };
        }
    };
}

export async function createServices({ logger, testMode = false }) {
    const salt = process.env.IP_HASH_SALT || 'dev-salt';

    if (testMode) {
        const emitter = new EventEmitter();
        const clickhouse = createMemoryClickHouse();

        return {
            testMode: true,
            clickhouse,
            postgres: null,
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
    const mmdbPath = process.env.GEOIP_MMDB_PATH;
    if (mmdbPath) {
        try {
            geoReader = await Reader.open(mmdbPath);
        } catch (err) {
            logger.warn({ err }, 'GeoIP MMDB not loaded, continuing without location enrichment');
        }
    }

    return {
        testMode: false,
        clickhouse,
        postgres,
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
