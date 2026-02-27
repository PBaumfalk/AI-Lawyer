/**
 * Per-user per-hour rate limiting for Helena agent requests.
 *
 * Uses ioredis with INCR + EXPIRE pattern for a fixed-window counter.
 * Rate limit is admin-configurable via SystemSettings.
 *
 * Graceful degradation: if Redis is unavailable, requests are allowed
 * (fail open) with a logged warning.
 */

import type { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { createLogger } from "@/lib/logger";
import { getSettingTyped } from "@/lib/settings/service";

const log = createLogger("helena-ratelimit");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window */
  remaining: number;
  /** Current limit for this user */
  limit: number;
  /** When the window resets */
  resetAt: Date;
  /** German error message if not allowed */
  message?: string;
}

// ---------------------------------------------------------------------------
// Redis connection (lazy singleton)
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;
let redisUnavailable = false;

/**
 * Get or create the Redis connection for rate limiting.
 * Separate from BullMQ connections to avoid maxRetriesPerRequest conflicts.
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) {
          // Stop retrying after 3 attempts -- fail open
          redisUnavailable = true;
          return null;
        }
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redisClient.on("error", (err: Error) => {
      log.error({ err: err.message }, "Rate limiter Redis error");
      redisUnavailable = true;
    });

    redisClient.on("connect", () => {
      redisUnavailable = false;
    });
  }

  return redisClient;
}

// ---------------------------------------------------------------------------
// Rate limit check
// ---------------------------------------------------------------------------

/** Redis key prefix for rate limiting */
const KEY_PREFIX = "helena:ratelimit:";

/** Window duration in seconds (1 hour) */
const WINDOW_SECONDS = 3600;

/** Default rate limit per user per hour */
const DEFAULT_LIMIT = 60;

/**
 * Check if a user has remaining Helena agent request quota.
 *
 * Implementation:
 * 1. Reads configurable limit from SystemSettings (ai.helena.rate_limit_per_hour)
 * 2. Uses Redis INCR + EXPIRE pattern for fixed-window counting
 * 3. Returns result with remaining count, limit, and reset timestamp
 *
 * Graceful degradation: allows request if Redis is unavailable.
 */
export async function checkRateLimit(options: {
  userId: string;
  prisma: PrismaClient;
}): Promise<RateLimitResult> {
  const { userId } = options;

  // Read configurable limit from SystemSettings
  const limit = await getSettingTyped<number>(
    "ai.helena.rate_limit_per_hour",
    DEFAULT_LIMIT,
  );

  // If Redis is known to be unavailable, fail open
  if (redisUnavailable) {
    log.warn(
      { userId },
      "Redis unavailable -- allowing request (fail open)",
    );
    return {
      allowed: true,
      remaining: limit - 1,
      limit,
      resetAt: new Date(Date.now() + WINDOW_SECONDS * 1000),
    };
  }

  const redis = getRedisClient();
  const key = `${KEY_PREFIX}${userId}`;

  try {
    // Ensure connection is established
    if (redis.status !== "ready" && redis.status !== "connect") {
      await redis.connect();
    }

    // Atomic INCR + conditional EXPIRE
    const current = await redis.incr(key);

    if (current === 1) {
      // First request in this window -- set TTL
      await redis.expire(key, WINDOW_SECONDS);
    }

    // Get TTL to calculate reset time
    const ttl = await redis.ttl(key);
    const resetAt = new Date(Date.now() + Math.max(ttl, 0) * 1000);

    if (current > limit) {
      // Rate limit exceeded
      const resetTimeStr = resetAt.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });

      return {
        allowed: false,
        remaining: 0,
        limit,
        resetAt,
        message: `Du hast das Limit von ${limit} Helena-Anfragen pro Stunde erreicht. Bitte warte bis ${resetTimeStr}.`,
      };
    }

    return {
      allowed: true,
      remaining: limit - current,
      limit,
      resetAt,
    };
  } catch (error: unknown) {
    // Redis error -- fail open
    const errMsg = error instanceof Error ? error.message : String(error);
    log.warn(
      { userId, error: errMsg },
      "Rate limit check failed -- allowing request (fail open)",
    );

    return {
      allowed: true,
      remaining: limit - 1,
      limit,
      resetAt: new Date(Date.now() + WINDOW_SECONDS * 1000),
    };
  }
}
