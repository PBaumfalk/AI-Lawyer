import Redis from "ioredis";
import { createLogger } from "@/lib/logger";

const log = createLogger("redis");

interface RedisConnectionOptions {
  /** Set to null for BullMQ workers (required by BullMQ). Default: 20. */
  maxRetriesPerRequest?: number | null;
}

/**
 * Create a new Redis connection using REDIS_URL env var.
 *
 * Workers MUST pass { maxRetriesPerRequest: null } per BullMQ requirement.
 * API routes use the default (20) for fail-fast behavior.
 */
export function createRedisConnection(
  options: RedisConnectionOptions = {}
): Redis {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const maxRetriesPerRequest =
    options.maxRetriesPerRequest === undefined
      ? 20
      : options.maxRetriesPerRequest;

  const redis = new Redis(url, {
    maxRetriesPerRequest,
    retryStrategy(times: number) {
      // Exponential backoff: min 1s, max 20s
      return Math.max(Math.min(Math.exp(times), 20000), 1000);
    },
    // Do NOT set keyPrefix — incompatible with BullMQ
  });

  redis.on("connect", () => {
    log.info("Redis connected");
  });

  redis.on("error", (err: Error) => {
    log.error({ err }, "Redis connection error");
  });

  return redis;
}
