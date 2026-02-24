import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { createRedisConnection } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { setupSocketAuth } from "@/lib/socket/auth";
import { setupRooms } from "@/lib/socket/rooms";

const log = createLogger("socket:server");

/**
 * Create and configure a Socket.IO server instance attached to the given HTTP server.
 *
 * Features:
 * - Redis adapter for cross-process pub/sub (horizontal scaling)
 * - JWT authentication middleware (cookie or explicit token)
 * - Room management (user, role, akte rooms)
 * - CORS: permissive in dev, disabled in production (same-origin)
 */
export function setupSocketIO(httpServer: HttpServer): SocketIOServer {
  const dev = process.env.NODE_ENV !== "production";

  const io = new SocketIOServer(httpServer, {
    cors: dev
      ? { origin: "*", methods: ["GET", "POST"] }
      : { origin: false },
    // Allow cookie-based auth (same-origin)
    allowEIO3: false,
    transports: ["websocket", "polling"],
  });

  // Attach Redis adapter for horizontal scaling
  try {
    const pubClient = createRedisConnection();
    const subClient = pubClient.duplicate();

    io.adapter(createAdapter(pubClient, subClient));
    log.info("Socket.IO Redis adapter attached");
  } catch (err) {
    log.error({ err }, "Failed to attach Redis adapter — running without pub/sub");
  }

  // JWT authentication middleware
  setupSocketAuth(io);

  // Room management
  setupRooms(io);

  log.info({ dev }, "Socket.IO server initialized");

  return io;
}
