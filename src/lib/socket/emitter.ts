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
  const pubClient = new Redis(url);

  emitter = new Emitter(pubClient);
  return emitter;
}
