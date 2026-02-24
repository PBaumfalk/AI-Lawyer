import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getSocketEmitter } from "@/lib/socket/emitter";
import { createLogger } from "@/lib/logger";
import type { NotificationPayload, NotificationResponse } from "@/lib/notifications/types";
import type { Notification } from "@prisma/client";

const log = createLogger("notifications");

/**
 * Convert a Prisma Notification model to the API response shape.
 */
function toResponse(n: Notification): NotificationResponse {
  return {
    id: n.id,
    type: n.type as NotificationResponse["type"],
    title: n.title,
    message: n.message,
    data: n.data as Record<string, unknown> | null,
    read: n.read,
    dismissed: n.dismissed,
    soundType: n.soundType,
    createdAt: n.createdAt.toISOString(),
  };
}

/**
 * Create a notification, persist to DB, and deliver in real-time via Socket.IO.
 *
 * Called from worker processes (via emitter) and API routes.
 */
export async function createNotification(
  payload: NotificationPayload
): Promise<NotificationResponse> {
  const notification = await prisma.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data
        ? (payload.data as Prisma.InputJsonValue)
        : undefined,
      soundType: payload.soundType ?? null,
    },
  });

  const response = toResponse(notification);

  // Emit in real-time via Socket.IO Redis emitter
  try {
    getSocketEmitter()
      .to(`user:${payload.userId}`)
      .emit("notification", response);

    log.debug(
      { userId: payload.userId, type: payload.type },
      "Notification created and emitted"
    );
  } catch (err) {
    // Non-fatal: notification is persisted, just not delivered in real-time
    log.warn({ err }, "Failed to emit notification via Socket.IO");
  }

  return response;
}

/**
 * Get unread, non-dismissed notifications for a user.
 */
export async function getUnreadNotifications(
  userId: string,
  limit = 50
): Promise<NotificationResponse[]> {
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      read: false,
      dismissed: false,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return notifications.map(toResponse);
}

/**
 * Get notifications created after a given timestamp.
 * Used for catch-up after client reconnect.
 */
export async function getNotificationsSince(
  userId: string,
  since: Date
): Promise<NotificationResponse[]> {
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      createdAt: { gt: since },
    },
    orderBy: { createdAt: "desc" },
  });

  return notifications.map(toResponse);
}

/**
 * Mark a single notification as read.
 * Security: only the notification owner can mark it.
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });
}

/**
 * Mark all unread notifications as read for a user.
 */
export async function markAllAsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

/**
 * Dismiss (soft-delete) a notification.
 * Security: only the notification owner can dismiss it.
 */
export async function dismissNotification(
  notificationId: string,
  userId: string
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { dismissed: true },
  });
}

/**
 * Get count of unread, non-dismissed notifications for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      read: false,
      dismissed: false,
    },
  });
}
