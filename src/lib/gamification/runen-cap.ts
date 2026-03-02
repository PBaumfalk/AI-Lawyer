/**
 * Daily Runen Cap for WV (Wiedervorlage) quests.
 *
 * Uses ioredis with INCR + EXPIRE pattern for a daily counter per user.
 * Cap is admin-configurable via SystemSettings (gamification.daily_runen_cap).
 *
 * Graceful degradation: if Redis is unavailable, full Runen are credited
 * (fail open) with a logged warning.
 *
 * Mirrors the pattern from src/lib/helena/rate-limiter.ts.
 */

import Redis from "ioredis";
import { format } from "date-fns";

import { createLogger } from "@/lib/logger";
import { getSettingTyped } from "@/lib/settings/service";

const log = createLogger("runen-cap");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunenCapResult {
  /** Runen amount actually creditable after cap enforcement */
  runenToCredit: number;
  /** Whether the cap was hit (partial or full) */
  capHit: boolean;
  /** Total Runen used today (after this credit) */
  dailyUsed: number;
  /** Current configured cap */
  cap: number;
}

// ---------------------------------------------------------------------------
// Redis connection (lazy singleton)
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;
let redisUnavailable = false;

/**
 * Get or create the Redis connection for Runen cap tracking.
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
      log.error({ err: err.message }, "Runen cap Redis error");
      redisUnavailable = true;
    });

    redisClient.on("connect", () => {
      redisUnavailable = false;
    });
  }

  return redisClient;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Redis key prefix for daily Runen tracking */
const KEY_PREFIX = "gamification:daily-runen:";

/** TTL for daily keys in seconds (24 hours) */
const DAY_SECONDS = 86400;

/** Default daily Runen cap */
const DEFAULT_CAP = 40;

// ---------------------------------------------------------------------------
// Cap check + record
// ---------------------------------------------------------------------------

/**
 * Check the user's daily Runen usage and record an increment.
 *
 * 1. Reads the configured cap from SystemSettings
 * 2. Gets current daily usage from Redis
 * 3. Calculates headroom (cap - currentUsage)
 * 4. Credits min(runenEarned, headroom) via INCRBY
 * 5. Sets EXPIRE on first increment of the day
 *
 * Fail-open: if Redis is unavailable, returns full runenEarned.
 */
export async function checkAndRecordRunenCap(
  userId: string,
  runenEarned: number,
): Promise<RunenCapResult> {
  const cap = await getSettingTyped<number>(
    "gamification.daily_runen_cap",
    DEFAULT_CAP,
  );

  // If Redis is known to be unavailable, fail open
  if (redisUnavailable) {
    log.warn(
      { userId },
      "Redis unavailable -- crediting full Runen (fail open)",
    );
    return {
      runenToCredit: runenEarned,
      capHit: false,
      dailyUsed: runenEarned,
      cap,
    };
  }

  const redis = getRedisClient();
  const dateKey = format(new Date(), "yyyyMMdd");
  const key = `${KEY_PREFIX}${userId}:${dateKey}`;

  try {
    // Ensure connection is established
    if (redis.status !== "ready" && redis.status !== "connect") {
      await redis.connect();
    }

    // Read current usage
    const currentStr = await redis.get(key);
    const currentUsed = currentStr ? parseInt(currentStr, 10) : 0;

    // Calculate headroom
    const headroom = Math.max(0, cap - currentUsed);
    const runenToCredit = Math.min(runenEarned, headroom);
    const capHit = runenToCredit < runenEarned;

    if (runenToCredit > 0) {
      // Increment by creditable amount
      const newValue = await redis.incrby(key, runenToCredit);

      // On first increment (value equals the increment), set TTL
      if (newValue === runenToCredit && currentUsed === 0) {
        await redis.expire(key, DAY_SECONDS);
      }
    }

    return {
      runenToCredit,
      capHit,
      dailyUsed: currentUsed + runenToCredit,
      cap,
    };
  } catch (error: unknown) {
    // Redis error -- fail open
    const errMsg = error instanceof Error ? error.message : String(error);
    log.warn(
      { userId, error: errMsg },
      "Runen cap check failed -- crediting full Runen (fail open)",
    );

    return {
      runenToCredit: runenEarned,
      capHit: false,
      dailyUsed: runenEarned,
      cap,
    };
  }
}

// ---------------------------------------------------------------------------
// Read-only: daily usage for dashboard display
// ---------------------------------------------------------------------------

/**
 * Get the user's daily Runen usage for display purposes.
 * Returns 0 if Redis is unavailable (no error thrown).
 */
export async function getDailyRunenUsed(userId: string): Promise<number> {
  if (redisUnavailable) return 0;

  const redis = getRedisClient();
  const dateKey = format(new Date(), "yyyyMMdd");
  const key = `${KEY_PREFIX}${userId}:${dateKey}`;

  try {
    if (redis.status !== "ready" && redis.status !== "connect") {
      await redis.connect();
    }

    const val = await redis.get(key);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}
