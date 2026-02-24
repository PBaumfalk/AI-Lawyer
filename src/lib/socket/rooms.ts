import type { Server, Socket } from "socket.io";
import { createLogger } from "@/lib/logger";

const log = createLogger("socket:rooms");

/**
 * Install room management logic on Socket.IO server.
 *
 * Room naming conventions:
 * - `user:{userId}` — personal notifications (auto-joined on connect)
 * - `role:{ROLE}` — role-based broadcasts (auto-joined on connect)
 * - `akte:{akteId}` — case-specific updates (joined/left dynamically)
 */
export function setupRooms(io: Server): void {
  io.on("connection", (socket: Socket) => {
    const { userId, role, kanzleiId } = socket.data;

    // Auto-join personal room
    const userRoom = `user:${userId}`;
    socket.join(userRoom);

    // Auto-join role room
    const roleRoom = `role:${role}`;
    socket.join(roleRoom);

    log.info(
      { userId, role, kanzleiId, socketId: socket.id },
      "Client connected and joined rooms"
    );

    // Dynamic Akte room join
    socket.on("join:akte", (akteId: string) => {
      if (!akteId || typeof akteId !== "string") return;
      const akteRoom = `akte:${akteId}`;
      socket.join(akteRoom);
      log.debug({ userId, akteId }, "Joined Akte room");
    });

    // Dynamic Akte room leave
    socket.on("leave:akte", (akteId: string) => {
      if (!akteId || typeof akteId !== "string") return;
      const akteRoom = `akte:${akteId}`;
      socket.leave(akteRoom);
      log.debug({ userId, akteId }, "Left Akte room");
    });

    // Disconnect logging (Socket.IO auto-removes from all rooms)
    socket.on("disconnect", (reason: string) => {
      log.info({ userId, socketId: socket.id, reason }, "Client disconnected");
    });
  });
}
