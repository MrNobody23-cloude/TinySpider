export async function registerApiHealthRoute(fastify) {
    fastify.get(
        '/api/health',
        {
            config: {
                rateLimit: {
                    max: 1000,
                    timeWindow: '1 minute'
                }
            }
        },
        async () => ({ ok: true })
    );
}
