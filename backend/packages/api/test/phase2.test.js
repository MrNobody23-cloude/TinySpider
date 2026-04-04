import request from 'supertest';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { clickhouseClient } from '../src/services.js';

let app;
let testJWT;
let testFunnelId;
let redis;

beforeAll(async () => {
    app = await createApp({ testMode: true });
    await app.listen({ port: 0, host: '127.0.0.1' });

    await request(app.server)
        .post('/api/auth/register')
        .send({ email: 'phase2@example.com', password: 'secret123' });

    const login = await request(app.server)
        .post('/api/auth/login')
        .send({ email: 'phase2@example.com', password: 'secret123' });

    testJWT = login.body.token;
    redis = app.insight.redis;

    const funnel = await request(app.server)
        .post('/api/funnels')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({ site_id: 'test', name: 'Seed funnel', steps: ['/', '/pricing', '/checkout'] });

    testFunnelId = funnel.body.funnel_id;
});

afterAll(async () => {
    if (app) {
        await app.close();
    }
});

test('GET /api/stats/timeseries returns array of time buckets', async () => {
    const res = await request(app.server)
        .get('/api/stats/timeseries?site_id=test&from=2024-01-01&to=2024-01-02&interval=hour')
        .set('Authorization', `Bearer ${testJWT}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('time');
        expect(res.body[0]).toHaveProperty('pageviews');
    }
});

test('Second call to /api/stats/timeseries is served from Redis cache', async () => {
    await request(app.server)
        .get('/api/stats/timeseries?site_id=test&from=2024-01-01&to=2024-01-02&interval=hour')
        .set('Authorization', `Bearer ${testJWT}`);

    const spy = vi.spyOn(clickhouseClient, 'query');

    await request(app.server)
        .get('/api/stats/timeseries?site_id=test&from=2024-01-01&to=2024-01-02&interval=hour')
        .set('Authorization', `Bearer ${testJWT}`);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
});

test('GET /api/stats/heatmap returns x/y between 0 and 1', async () => {
    const res = await request(app.server)
        .get('/api/stats/heatmap?site_id=test&url=https://example.com&from=2024-01-01&to=2024-01-02')
        .set('Authorization', `Bearer ${testJWT}`);

    expect(res.status).toBe(200);
    res.body.forEach((point) => {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(1);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(1);
    });
});

test('POST /api/funnels creates funnel and returns funnel_id', async () => {
    const res = await request(app.server)
        .post('/api/funnels')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({ site_id: 'test', name: 'Main funnel', steps: ['/', 'pricing', '/checkout'] });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('funnel_id');
});

test('GET /api/funnels/:id/analysis returns drop_off_rate between 0 and 1', async () => {
    const res = await request(app.server)
        .get(`/api/funnels/${testFunnelId}/analysis?from=2024-01-01&to=2024-01-02`)
        .set('Authorization', `Bearer ${testJWT}`);

    expect(res.status).toBe(200);
    res.body.forEach((step) => {
        expect(step.drop_off_rate).toBeGreaterThanOrEqual(0);
        expect(step.drop_off_rate).toBeLessThanOrEqual(1);
    });
});

test('POST /api/auth/login with wrong password returns 401', async () => {
    const res = await request(app.server)
        .post('/api/auth/login')
        .send({ email: 'x@x.com', password: 'wrong' });

    expect(res.status).toBe(401);
});

test('GET /api/screenshot caches result in Redis', async () => {
    await request(app.server)
        .get('/api/screenshot?url=https://example.com')
        .set('Authorization', `Bearer ${testJWT}`);

    const cached = await redis.get('ss:https://example.com');
    expect(cached).not.toBeNull();
});
