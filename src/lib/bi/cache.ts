import { createRedisConnection } from "@/lib/redis";
import { createLogger } from "@/lib/logger";

const log = createLogger("bi-cache");

let redis: ReturnType<typeof createRedisConnection> | null = null;

function getRedis() {
  if (!redis) {
    redis = createRedisConnection();
  }
  return redis;
}

const KEY_PREFIX = "bi:";

/**
 * Execute a query with Redis caching.
 * On cache hit: returns parsed data with cached=true.
 * On cache miss: executes queryFn, stores result with SETEX, returns cached=false.
 * On Redis error: logs warning, falls through to queryFn (no cache).
 */
export async function cachedQuery<T>(
  key: string,
  ttlSeconds: number,
  queryFn: () => Promise<T>
): Promise<{ data: T; cached: boolean }> {
  const fullKey = `${KEY_PREFIX}${key}`;

  try {
    const client = getRedis();
    const cached = await client.get(fullKey);

    if (cached !== null) {
      const data = JSON.parse(cached) as T;
      return { data, cached: true };
    }
  } catch (err) {
    log.warn({ err, key: fullKey }, "Redis cache read failed, falling through to query");
  }

  // Cache miss or Redis error -- execute query
  const data = await queryFn();

  try {
    const client = getRedis();
    await client.setex(fullKey, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    log.warn({ err, key: fullKey }, "Redis cache write failed");
  }

  return { data, cached: false };
}
