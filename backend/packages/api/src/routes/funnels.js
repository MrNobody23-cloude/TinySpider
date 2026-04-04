import { withCache } from '../lib/cache.js';

const createFunnelSchema = {
    body: {
        type: 'object',
        additionalProperties: false,
        required: ['site_id', 'name', 'steps'],
        properties: {
            site_id: { type: 'string', minLength: 1, maxLength: 255 },
            name: { type: 'string', minLength: 1, maxLength: 255 },
            steps: {
                type: 'array',
                minItems: 1,
                items: { type: 'string', minLength: 1, maxLength: 2048 }
            }
        }
    }
};

function safeRate(visitors, converted) {
    if (!visitors || visitors <= 0) return 0;
    const raw = 1 - converted / visitors;
    if (raw < 0) return 0;
    if (raw > 1) return 1;
    return raw;
}

export async function registerFunnelRoutes(fastify) {
    fastify.post('/api/funnels', { schema: createFunnelSchema }, async (request, reply) => {
        const { site_id: siteId, name, steps } = request.body;

        const inserted = await fastify.insight.postgres.query(
            'INSERT INTO funnels (site_id, name, steps) VALUES ($1, $2, $3::jsonb) RETURNING id, name, steps',
            [siteId, name, JSON.stringify(steps)]
        );

        const row = inserted.rows[0];
        return reply.code(201).send({
            funnel_id: row.id,
            name: row.name,
            steps: Array.isArray(row.steps) ? row.steps : JSON.parse(row.steps || '[]')
        });
    });

    fastify.get('/api/funnels/:funnel_id/analysis', async (request, reply) => {
        const { funnel_id: funnelId } = request.params;
        const { from, to } = request.query;
        const includeBots = String(request.query.include_bots || '').toLowerCase() === 'true';

        if (!from || !to) {
            return reply.code(400).send({ error: 'from and to are required' });
        }

        const funnelResult = await fastify.insight.postgres.query(
            'SELECT id, site_id, name, steps FROM funnels WHERE id = $1 LIMIT 1',
            [funnelId]
        );

        const funnel = funnelResult.rows[0];
        if (!funnel) {
            return reply.code(404).send({ error: 'Funnel not found' });
        }

        const siteId = funnel.site_id;
        const steps = Array.isArray(funnel.steps) ? funnel.steps : JSON.parse(funnel.steps || '[]');

        const cacheKey = `funnel:${funnelId}:${from}:${to}:${includeBots ? 'bots' : 'nobots'}`;
        const analysis = await withCache(fastify.insight.redis, cacheKey, 300, async () => {
            const visitorsByStep = [];
            for (const stepUrl of steps) {
                const visitorsResult = await fastify.insight.clickhouse.query({
                    query: `
                        SELECT uniqExact(session_id) AS visitors
                        FROM events
                        WHERE site_id = {siteId:String}
                          AND url = {url:String}
                          ${includeBots ? '' : 'AND is_bot = false'}
                          AND timestamp BETWEEN parseDateTimeBestEffort({from:String}) AND parseDateTimeBestEffort({to:String})
                    `,
                    query_params: { siteId, url: stepUrl, from, to, includeBots }
                });
                const rows = (await visitorsResult.json()).data || [];
                visitorsByStep.push(Number(rows[0]?.visitors || 0));
            }

            const convertedToNext = [];
            for (let i = 0; i < steps.length - 1; i += 1) {
                const conversionResult = await fastify.insight.clickhouse.query({
                    query: `
                        SELECT count() AS converted FROM (
                            SELECT
                                session_id,
                                minIf(timestamp, url = {stepN:String}) AS t_n,
                                minIf(timestamp, url = {stepN1:String}) AS t_n1
                            FROM events
                            WHERE site_id = {siteId:String}
                              ${includeBots ? '' : 'AND is_bot = false'}
                              AND timestamp BETWEEN parseDateTimeBestEffort({from:String}) AND parseDateTimeBestEffort({to:String})
                            GROUP BY session_id
                            HAVING t_n > 0 AND t_n1 > t_n
                        )
                    `,
                    query_params: {
                        siteId,
                        stepN: steps[i],
                        stepN1: steps[i + 1],
                        from,
                        to,
                        includeBots
                    }
                });
                const rows = (await conversionResult.json()).data || [];
                convertedToNext.push(Number(rows[0]?.converted || 0));
            }

            return steps.map((stepUrl, idx) => {
                const visitors = visitorsByStep[idx] || 0;
                const converted = convertedToNext[idx] || 0;
                return {
                    step_url: stepUrl,
                    visitors,
                    converted_to_next: converted,
                    drop_off_rate: safeRate(visitors, converted)
                };
            });
        });

        return reply.code(200).send(analysis);
    });
}
