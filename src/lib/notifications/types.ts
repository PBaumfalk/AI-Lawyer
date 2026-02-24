/**
 * Notification type literals for all system events.
 * Add new types here as new features are introduced.
 */
export type NotificationType =
  | "job:completed"
  | "job:failed"
  | "document:created"
  | "document:updated"
  | "email:received"
  | "deadline:approaching"
  | "frist:vorfrist"
  | "frist:ueberfaellig"
  | "system:alert";

/**
 * Payload for creating a new notification.
 * Used by the notification service and worker processes.
 */
export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  /** Arbitrary data attached to the notification (link, jobId, akteId, etc.) */
  data?: Record<string, unknown>;
  /** Optional sound identifier for client-side audio */
  soundType?: string;
  /** Target user ID */
  userId: string;
}

/**
 * Notification shape returned by API endpoints.
 * Maps to the Prisma Notification model.
 */
export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  dismissed: boolean;
  soundType: string | null;
  createdAt: string; // ISO timestamp
}
