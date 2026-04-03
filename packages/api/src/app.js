import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';

import { createServices } from './services.js';
import { registerCollectRoute } from './routes/collect.js';
import { registerLiveWsRoute } from './routes/ws-live.js';
import { registerApiHealthRoute } from './routes/api-health.js';

function buildApiOriginChecker() {
    const allowlist = (process.env.API_CORS_ORIGINS || 'http://localhost:5173')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    return (origin) => {
        if (!origin) return true;
        return allowlist.includes(origin);
    };
}

export async function createApp({ testMode = false } = {}) {
    const app = Fastify({
        logger: {
            level: process.env.LOG_LEVEL || 'info'
        }
    });

    const services = await createServices({ logger: app.log, testMode });
    app.decorate('insight', services);
    app.decorate('liveSockets', new Set());

    await app.register(helmet);
    await app.register(rateLimit, { global: false });
    await app.register(websocket);

    const apiOriginChecker = buildApiOriginChecker();
    await app.register(cors, {
        delegator: (req, cb) => {
            if (req.raw.url?.startsWith('/collect')) {
                cb(null, { origin: true });
                return;
            }
            cb(null, { origin: apiOriginChecker });
        }
    });

    await registerCollectRoute(app);
    await registerLiveWsRoute(app);
    await registerApiHealthRoute(app);

    app.addHook('onClose', async (instance) => {
        await instance.insight.close();
    });

    return app;
}
