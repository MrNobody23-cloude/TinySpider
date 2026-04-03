import { setTimeout as delay } from 'node:timers/promises';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createApp } from '../src/app.js';

let app;

async function waitFor(assertFn, timeoutMs = 1000, intervalMs = 25) {
    const started = Date.now();
    let lastError;

    while (Date.now() - started < timeoutMs) {
        try {
            await assertFn();
            return;
        } catch (err) {
            lastError = err;
            await delay(intervalMs);
        }
    }

    throw lastError || new Error('Timed out waiting for condition');
}

beforeAll(async () => {
    app = await createApp({ testMode: true });
    await app.listen({ port: 0, host: '127.0.0.1' });
});

afterAll(async () => {
    if (app) {
        await app.close();
    }
});

describe('collect route', () => {
    test('POST /collect with valid pageview returns 200 { ok: true }', async () => {
        const res = await request(app.server).post('/collect').send({
            site_id: 'test-site',
            event_type: 'pageview',
            url: 'https://example.com'
        });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    test('POST /collect with bot user-agent stores event with is_bot=true', async () => {
        await request(app.server).post('/collect').set('User-Agent', 'Googlebot/2.1').send({
            site_id: 'test-site',
            event_type: 'pageview',
            url: 'https://example.com'
        });

        await waitFor(async () => {
            const result = await app.insight.clickhouse.query({
                query: 'SELECT is_bot FROM events WHERE site_id = {siteId:String} ORDER BY timestamp DESC LIMIT 1',
                query_params: { siteId: 'test-site' }
            });
            const rows = (await result.json()).data;
            expect(rows[0].is_bot).toBe(true);
        });
    });

    test('POST /collect with click stores x/y as 0.0-1.0 floats', async () => {
        await request(app.server).post('/collect').send({
            site_id: 'test-site',
            event_type: 'click',
            url: 'https://example.com',
            click_x: 0.45,
            click_y: 0.82
        });

        await waitFor(async () => {
            const result = await app.insight.clickhouse.query({
                query: 'SELECT click_x, click_y FROM events WHERE event_type = \"click\" ORDER BY timestamp DESC LIMIT 1'
            });
            const rows = (await result.json()).data;
            expect(rows[0].click_x).toBeCloseTo(0.45, 2);
            expect(rows[0].click_y).toBeCloseTo(0.82, 2);
        });
    });

    test('POST /collect with invalid click_x (>1) returns 400', async () => {
        const res = await request(app.server).post('/collect').send({
            site_id: 'test-site',
            event_type: 'click',
            url: 'https://x.com',
            click_x: 1.5,
            click_y: 0.5
        });

        expect(res.status).toBe(400);
    });

    test('WebSocket /ws/live receives event within 1s of POST /collect', async () => {
        await new Promise((resolve, reject) => {
            let settled = false;
            let unsubscribe = null;

            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    if (unsubscribe) {
                        void unsubscribe();
                    }
                    reject(new Error('No live event received within 1s'));
                }
            }, 1000);

            Promise.resolve(
                app.insight.subscribeLive((raw) => {
                    if (settled) return;
                    const payload = JSON.parse(raw.toString());
                    if (payload.site_id !== 'test-site') return;

                    settled = true;
                    clearTimeout(timer);
                    if (unsubscribe) {
                        void unsubscribe();
                    }
                    resolve();
                })
            )
                .then((fn) => {
                    unsubscribe = fn;
                    return request(app.server).post('/collect').send({
                        site_id: 'test-site',
                        event_type: 'pageview',
                        url: 'https://example.com/live'
                    });
                })
                .catch((err) => {
                    if (!settled) {
                        settled = true;
                        clearTimeout(timer);
                        reject(err);
                    }
                });
        });
    });
});
