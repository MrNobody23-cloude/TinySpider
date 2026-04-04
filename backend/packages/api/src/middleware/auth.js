import jwt from 'jsonwebtoken';

/** Routes that do NOT require authentication */
const PUBLIC_PREFIXES = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/health',
    '/collect',
    '/tracker'
];

export async function registerAuthMiddleware(fastify) {
    const secret = process.env.JWT_SECRET || 'dev-secret';

    fastify.addHook('onRequest', async (request, reply) => {
        // Skip OPTIONS preflight requests - CORS must handle them first
        if (request.method === 'OPTIONS') return;

        const path = request.routeOptions?.url || request.url || '';

        // Skip non-API routes and public auth endpoints
        if (!path.startsWith('/api/')) return;
        for (const prefix of PUBLIC_PREFIXES) {
            if (path.startsWith(prefix)) return;
        }

        const authHeader = (request.headers.authorization || '').trim();
        
        // Bearer token validation
        if (!authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'Authentication required' });
        }

        const token = authHeader.slice('Bearer '.length).trim();
        
        // Validate token is not empty after extraction
        if (!token || token.length === 0) {
            return reply.code(401).send({ error: 'Authentication required' });
        }

        // Check if token has been blacklisted (from logout)
        if (fastify.insight?.redis) {
            try {
                const isBlacklisted = await fastify.insight.redis.get(`blacklist:${token}`);
                if (isBlacklisted) {
                    return reply.code(401).send({ error: 'Token has been revoked' });
                }
            } catch (err) {
                // Redis might be down, continue without blacklist check
                fastify.log.debug({ err }, 'Redis blacklist check failed');
            }
        }

        try {
            request.user = jwt.verify(token, secret);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return reply.code(401).send({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
            }
            fastify.log.debug({ err }, 'Token verification failed');
            return reply.code(401).send({ error: 'Invalid token' });
        }
    });
}
