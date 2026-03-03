import { Emitter } from "@socket.io/redis-emitter";
import Redis from "ioredis";

let emitter: Emitter | null = null;

/**
 * Get the Socket.IO Redis emitter singleton.
 * Used by the worker process to emit events to browser clients
 * via Redis pub/sub (without needing a direct Socket.IO server connection).
 *
 * Emits to rooms like: user:{userId}, akte:{akteId}, role:{roleName}
 */
export function getSocketEmitter(): Emitter {
  if (emitter) return emitter;

  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const pubClient = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  pubClient.on("error", () => {}); // suppress unhandled Redis errors

  emitter = new Emitter(pubClient);
  return emitter;
}

/**
 * Safe emit helper — emits via Socket.IO but never throws.
 * DB operations should never fail because of Socket.IO/Redis issues.
 */
export function safeEmit(
  room: string,
  event: string,
  payload: unknown
): void {
  try {
    getSocketEmitter().to(room).emit(event, payload);
  } catch {
    // Socket.IO emit is best-effort — client will refetch on reconnect
  }
}
