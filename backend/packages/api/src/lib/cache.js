export async function withCache(redis, key, ttlSeconds, fn) {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
    const result = await fn();
    await redis.setex(key, ttlSeconds, JSON.stringify(result));
    return result;
}
