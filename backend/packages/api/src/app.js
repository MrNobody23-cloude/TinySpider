import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';

import { createServices } from './services.js';
import { registerCollectRoute } from './routes/collect.js';
import { registerLiveWsRoute } from './routes/ws-live.js';
import { registerApiHealthRoute } from './routes/api-health.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerStatsRoutes } from './routes/stats.js';
import { registerFunnelRoutes } from './routes/funnels.js';
import { registerAuthMiddleware } from './middleware/auth.js';

function buildApiOriginChecker() {
    const allowlist = (process.env.API_CORS_ORIGINS || 'http://localhost:5173')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    return allowlist;
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

    // Parse text/plain as JSON to support navigator.sendBeacon
    app.addContentTypeParser('text/plain', { parseAs: 'string' }, function (req, body, done) {
        try {
            const json = body ? JSON.parse(body) : {};
            done(null, json);
        } catch (err) {
            err.statusCode = 400;
            done(err, undefined);
        }
    });

    await app.register(helmet);
    await app.register(rateLimit, { global: false });
    await app.register(websocket);

    const apiOriginChecker = buildApiOriginChecker();
    
    // In development, allow all origins. In production, use whitelist.
    const corsConfig = process.env.NODE_ENV === 'production' 
        ? {
            origin: apiOriginChecker,
            credentials: true
          }
        : {
            origin: true,  // Allow all origins in development
            credentials: true
          };
    
    await app.register(cors, corsConfig);

    await registerCollectRoute(app);
    await registerLiveWsRoute(app);
    await registerApiHealthRoute(app);
    await registerAuthRoutes(app);
    await registerAuthMiddleware(app);
    await registerStatsRoutes(app);
    await registerFunnelRoutes(app);

    app.addHook('onClose', async (instance) => {
        await instance.insight.close();
    });

    return app;
}
