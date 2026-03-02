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
 * - `mailbox:{kontoId}` — email real-time updates (joined/left dynamically)
 * - `channel:{channelId}` — messaging channel updates (joined/left dynamically)
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

    // Dynamic Mailbox room join (real-time email folder updates)
    socket.on("join:mailbox", (kontoId: string) => {
      if (!kontoId || typeof kontoId !== "string") return;
      const mailboxRoom = `mailbox:${kontoId}`;
      socket.join(mailboxRoom);
      log.debug({ userId, kontoId }, "Joined mailbox room");
    });

    // Dynamic Mailbox room leave
    socket.on("leave:mailbox", (kontoId: string) => {
      if (!kontoId || typeof kontoId !== "string") return;
      const mailboxRoom = `mailbox:${kontoId}`;
      socket.leave(mailboxRoom);
      log.debug({ userId, kontoId }, "Left mailbox room");
    });

    // Dynamic Channel room join
    socket.on("join:channel", (channelId: string) => {
      if (!channelId || typeof channelId !== "string") return;
      const channelRoom = `channel:${channelId}`;
      socket.join(channelRoom);
      log.debug({ userId, channelId }, "Joined channel room");
    });

    // Dynamic Channel room leave
    socket.on("leave:channel", (channelId: string) => {
      if (!channelId || typeof channelId !== "string") return;
      const channelRoom = `channel:${channelId}`;
      socket.leave(channelRoom);
      log.debug({ userId, channelId }, "Left channel room");
    });

    // Typing indicators (ephemeral, no DB persistence, 5s auto-timeout on client)
    socket.on("typing:start", (channelId: string) => {
      if (!channelId || typeof channelId !== "string") return;
      socket.to(`channel:${channelId}`).emit("typing:start", {
        channelId,
        userId,
        userName: socket.data.userName || userId,
      });
    });

    socket.on("typing:stop", (channelId: string) => {
      if (!channelId || typeof channelId !== "string") return;
      socket.to(`channel:${channelId}`).emit("typing:stop", {
        channelId,
        userId,
      });
    });

    // Disconnect logging (Socket.IO auto-removes from all rooms)
    socket.on("disconnect", (reason: string) => {
      log.info({ userId, socketId: socket.id, reason }, "Client disconnected");
    });
  });
}
