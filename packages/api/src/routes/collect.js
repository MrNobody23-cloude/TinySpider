import { BOT_SIGNATURES } from '../bot-signatures.js';

const collectSchema = {
    body: {
        type: 'object',
        additionalProperties: false,
        required: ['site_id', 'event_type', 'url'],
        properties: {
            site_id: { type: 'string', minLength: 1 },
            event_type: { type: 'string', enum: ['pageview', 'click', 'custom'] },
            url: { type: 'string', minLength: 1, maxLength: 2048 },
            referrer: { type: 'string', maxLength: 2048 },
            click_x: { type: 'number', minimum: 0, maximum: 1 },
            click_y: { type: 'number', minimum: 0, maximum: 1 },
            session_id: { type: 'string', minLength: 1, maxLength: 255 },
            bot_hint: { type: 'boolean' }
        }
    }
};

function isBotFromUserAgent(userAgent) {
    if (!userAgent) return false;
    return BOT_SIGNATURES.some((regex) => regex.test(userAgent));
}

function normalizeIp(ip) {
    if (!ip) return '';
    if (ip.startsWith('::ffff:')) return ip.slice(7);
    return ip;
}

export async function registerCollectRoute(fastify) {
    fastify.post(
        '/collect',
        {
            schema: collectSchema,
            config: {
                rateLimit: {
                    max: 100,
                    timeWindow: '1 minute'
                }
            }
        },
        async (request, reply) => {
            const ua = String(request.headers['user-agent'] || '');
            const acceptLanguage = request.headers['accept-language'];
            const body = request.body;

            let isBot = false;
            if (isBotFromUserAgent(ua)) {
                isBot = true;
            } else if (body.bot_hint === true) {
                isBot = true;
            } else if (!acceptLanguage) {
                isBot = true;
            }

            const clientIp = normalizeIp(request.ip);
            const geo = await fastify.insight.lookupGeo(clientIp);

            const event = {
                site_id: body.site_id,
                event_type: body.event_type,
                url: body.url,
                referrer: body.referrer || '',
                user_agent: ua,
                ip_hash: fastify.insight.hashIp(clientIp),
                country: geo.country || '',
                city: geo.city || '',
                lat: geo.lat ?? 0,
                lon: geo.lon ?? 0,
                click_x: body.click_x ?? 0,
                click_y: body.click_y ?? 0,
                session_id: body.session_id || '',
                is_bot: isBot,
                timestamp: new Date().toISOString().slice(0, 19).replace('T', ' ')
            };

            // Non-blocking ingestion path: queue write and return immediately.
            void fastify.insight.enqueueEvent(event).catch((err) => {
                fastify.log.error({ err }, 'Failed enqueueing event');
            });

            if (geo.lat != null && geo.lon != null) {
                const livePayload = {
                    site_id: body.site_id,
                    event_type: body.event_type,
                    lat: geo.lat,
                    lon: geo.lon,
                    is_bot: isBot,
                    timestamp: event.timestamp
                };

                void fastify.insight.publishLive({
                    ...livePayload
                }).catch((err) => {
                    fastify.log.warn({ err }, 'Failed publishing live event');
                });

                if (fastify.insight.testMode) {
                    const raw = JSON.stringify(livePayload);
                    for (const ws of fastify.liveSockets) {
                        if (ws.readyState === 1) {
                            ws.send(raw);
                        }
                    }
                }
            }

            return reply.code(200).send({ ok: true });
        }
    );
}
