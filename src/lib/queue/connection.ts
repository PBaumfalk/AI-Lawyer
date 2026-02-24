import { createRedisConnection } from "@/lib/redis";
import type Redis from "ioredis";

/**
 * Get a Redis connection for BullMQ Queue instances (used by app/API routes).
 * Uses default maxRetriesPerRequest (20) for fail-fast behavior.
 */
export function getQueueConnection(): Redis {
  return createRedisConnection();
}

/**
 * Get a Redis connection for BullMQ Worker instances.
 * MUST use maxRetriesPerRequest: null per BullMQ requirement.
 */
export function getWorkerConnection(): Redis {
  return createRedisConnection({ maxRetriesPerRequest: null });
}
