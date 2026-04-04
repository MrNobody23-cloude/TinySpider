import { createApp } from './app.js';

function validateEnv() {
    const required = ['CLICKHOUSE_URL', 'REDIS_URL', 'JWT_SECRET', 'IP_HASH_SALT'];
    const missing = required.filter((key) => !String(process.env[key] || '').trim());

    if (missing.length > 0) {
        console.warn(`⚠️  Missing recommended environment variables: ${missing.join(', ')}`);
        console.warn('   Continuing with defaults — set these in production!');
    }
}

validateEnv();

const port = Number(process.env.PORT || 3000);
const host = '0.0.0.0';

const app = await createApp({ testMode: false });

const shutdown = async (signal) => {
    app.log.info({ signal }, 'Shutting down API');
    await app.close();
    process.exit(0);
};

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
    void shutdown('SIGINT');
});

try {
    await app.listen({ port, host });
    app.log.info({ port }, 'API started');
} catch (err) {
    app.log.error({ err }, 'Failed to start API');
    process.exit(1);
}
